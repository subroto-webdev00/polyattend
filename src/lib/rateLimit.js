// Rate limiter for sensitive auth endpoints (login, OTP verify, password
// reset, registration).
//
// The counter lives in Redis when UPSTASH_REDIS_REST_URL/TOKEN are configured,
// and falls back to a plain in-memory Map otherwise. That distinction matters on
// serverless: an in-memory Map only limits requests handled by the SAME warm
// instance, so with several Vercel lambdas a brute-force loop gets several
// times the intended budget. With Redis the counter is shared, so the limit is
// real.
//
// The Redis path uses a fixed-window INCR + EXPIRE, which is one round trip for
// the increment and one for the expiry. If Redis is unreachable the limiter
// falls back to in-memory rather than failing the request — a login must never
// 500 because the cache is down.

import { redisEnabled, cacheKey } from '@/lib/cache';

const buckets = new Map();

// Periodically clear out old buckets so this doesn't grow forever.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastSweep = Date.now();
function sweep(now) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > bucket.windowMs) buckets.delete(key);
  }
}

/**
 * Records a hit for `key` and returns whether it's allowed.
 *
 * Async because the shared (Redis) counter needs a round trip. Every caller
 * awaits it; the in-memory path still resolves immediately.
 *
 * @param {string} key - unique identifier, e.g. `login:<ip>:<email>`
 * @param {number} limit - max hits allowed within the window
 * @param {number} windowMs - window size in ms
 * @returns {Promise<{ allowed: boolean, remaining: number, retryAfterMs: number }>}
 */
export async function hit(key, limit, windowMs) {
  if (redisEnabled) {
    try {
      return await redisHit(key, limit, windowMs);
    } catch {
      // Redis is down. Degrade to the local counter rather than refusing the
      // request or (worse) treating every attempt as the first one.
      return memHit(key, limit, windowMs);
    }
  }
  return memHit(key, limit, windowMs);
}

/** Shared fixed-window counter. */
async function redisHit(key, limit, windowMs) {
  const windowSeconds = Math.max(1, Math.round(windowMs / 1000));
  const full = cacheKey('rl', key);
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const headers = { Authorization: `Bearer ${token}` };

  // INCR then EXPIRE only when the counter is brand new, so the TTL is not
  // extended on every hit (which would let a slow attacker keep the window
  // open forever).
  const incrRes = await fetch(`${url}/incr/${encodeURIComponent(full)}`, {
    method: 'POST', headers, cache: 'no-store',
  });
  if (!incrRes.ok) throw new Error(`rl INCR ${incrRes.status}`);
  const count = Number((await incrRes.json())?.result ?? 0);

  if (count === 1) {
    await fetch(`${url}/expire/${encodeURIComponent(full)}/${windowSeconds}`, {
      method: 'POST', headers, cache: 'no-store',
    });
  }

  const remaining = Math.max(0, limit - count);
  // Without a stored window start the best remaining-time estimate is a full
  // window; callers only use it for Retry-After, so an approximation is fine.
  const retryAfterMs = count <= limit ? 0 : windowMs;

  return { allowed: count <= limit, remaining, retryAfterMs };
}

/** Per-process counter, used when Redis is not configured or unreachable. */
function memHit(key, limit, windowMs) {
  const now = Date.now();
  sweep(now);

  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart > windowMs) {
    bucket = { windowStart: now, windowMs, count: 0 };
    buckets.set(key, bucket);
  }
  bucket.count += 1;

  const allowed = bucket.count <= limit;
  const remaining = Math.max(0, limit - bucket.count);
  const retryAfterMs = Math.max(0, bucket.windowStart + windowMs - now);
  return { allowed, remaining, retryAfterMs };
}

/**
 * Best-effort client IP extraction behind a proxy/load balancer
 * (Vercel, most reverse proxies). Falls back to a constant so
 * rate limiting still works (shared bucket) even if no IP header
 * is present, rather than silently no-op'ing.
 */
export function getClientIp(request) {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

/**
 * Convenience wrapper: rate-limit by IP + an optional identifier
 * (e.g. the email being logged into), so one IP can't hammer a
 * single account, AND a distributed attacker can't hammer one
 * account from many IPs beyond a looser global cap.
 *
 * Returns null if allowed, or a NextResponse-ready payload if blocked:
 *   { blocked: true, message, retryAfterSeconds }
 */
export async function checkRateLimit(request, routeName, identifier, { limit = 5, windowMs = 15 * 60 * 1000 } = {}) {
  const ip = getClientIp(request);
  const perIpKey = `${routeName}:ip:${ip}`;
  const perIpResult = await hit(perIpKey, limit, windowMs);

  if (!perIpResult.allowed) {
    return {
      blocked: true,
      message: 'Too many attempts. Please try again later.',
      retryAfterSeconds: Math.ceil(perIpResult.retryAfterMs / 1000),
    };
  }

  if (identifier) {
    // Slightly looser cap per-identifier (e.g. per-email) than per-IP,
    // since legitimate shared IPs (campus wifi, office NAT) hit the
    // per-IP bucket faster across many different users.
    const perIdKey = `${routeName}:id:${String(identifier).toLowerCase()}`;
    const perIdResult = await hit(perIdKey, limit * 2, windowMs);
    if (!perIdResult.allowed) {
      return {
        blocked: true,
        message: 'Too many attempts for this account. Please try again later.',
        retryAfterSeconds: Math.ceil(perIdResult.retryAfterMs / 1000),
      };
    }
  }

  return null;
}
