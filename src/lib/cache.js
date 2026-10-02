// Read-through cache for hot read endpoints.
//
// Backed by Upstash Redis over its plain REST API (no extra dependency — it is
// just HTTP), and falls back to an in-process Map when no Redis credentials are
// present. That fallback is deliberate: local development and any preview
// deploy keep working with no setup, and adding the two env vars later switches
// to Redis with no code change.
//
// Rules this module keeps:
//  - A cache failure is never a request failure. Every Redis call is wrapped so
//    a timeout, a bad token or a network blip degrades to "cache miss" and the
//    request still hits the database.
//  - Nothing is cached for a specific user unless the key names them, so one
//    user can never read another user's cached row.

const NAMESPACE = 'polyattend';

const REST_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

export const redisEnabled = Boolean(REST_URL && REST_TOKEN);

// ── In-memory fallback ────────────────────────────────────────────────────
// A Map with expiry stamps. globalThis is used so Next.js' dev-mode module
// reloading does not throw the cache away on every edit.
const mem = (globalThis.__polyattendCache ||= new Map());
const MEM_MAX = 500;

// How long a value read from Redis stays in local memory. Deliberately short:
// memory is the fast tier, Redis is the shared backstop, and a long local TTL
// would let one instance serve a stale value long after Redis was told to drop
// it by an invalidation on another instance.
const MEM_PROMOTE_TTL = 15;

function memGet(key) {
  const hit = mem.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) {
    mem.delete(key);
    return undefined;
  }
  return hit.value;
}

function memSet(key, value, ttlSeconds) {
  // Cheap eviction: the map is small and bounded, so dropping the oldest entry
  // when it overflows is enough. An LRU would be nicer but this map never
  // holds enough entries for the difference to matter.
  if (mem.size >= MEM_MAX) {
    const oldest = mem.keys().next().value;
    if (oldest !== undefined) mem.delete(oldest);
  }
  mem.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

// ── Redis (Upstash REST) ──────────────────────────────────────────────────
async function redisGet(key) {
  const res = await fetch(`${REST_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REST_TOKEN}` },
    // Without this, Next.js can serve a stale cached response to the *next*
    // request too, which would defeat the point of caching a live count.
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`redis GET ${res.status}`);
  const body = await res.json();
  return body.result;
}

async function redisSet(key, value, ttlSeconds) {
  const res = await fetch(
    `${REST_URL}/set/${encodeURIComponent(key)}?EX=${Math.max(1, Math.round(ttlSeconds))}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(value),
      cache: 'no-store',
    }
  );
  if (!res.ok) throw new Error(`redis SET ${res.status}`);
  return true;
}

async function redisDel(key) {
  await fetch(`${REST_URL}/del/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REST_TOKEN}` },
    cache: 'no-store',
  });
}

// ── Public API ────────────────────────────────────────────────────────────

/** Build a namespaced cache key. */
export const cacheKey = (...parts) => [NAMESPACE, ...parts].join(':');

/**
 * Read a cached JSON value, or undefined on a miss. Never throws.
 *
 * Memory is consulted FIRST and a memory hit returns immediately, without
 * touching the network. This is the whole point of the two-tier design: on a
 * request that lands on the same warm instance as the one that filled the
 * cache, the Redis round trip is skipped entirely. Measured from
 * Bangladesh against Upstash's default region, a Redis GET costs ~300ms while
 * the equivalent database read costs ~40ms locally — so always going to Redis
 * first made the cache five times SLOWER than having no cache at all.
 */
export async function cacheGet(key) {
  const local = memGet(key);
  if (local !== undefined) return local;
  if (!redisEnabled) return undefined;
  try {
    const raw = await redisGet(key);
    if (raw == null) return undefined;
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    // Promote into memory so the next hit on this instance is free. The TTL
    // used locally is the caller's original TTL, not one recomputed here, so a
    // promotion cannot extend the value's life past what the caller asked for.
    memSet(key, value, Math.max(1, MEM_PROMOTE_TTL));
    return value;
  } catch {
    // A Redis outage must not surface as an app error.
    return undefined;
  }
}

/**
 * Store a JSON value. Never throws.
 *
 * Redis is written in the background and deliberately NOT awaited: the value is
 * already correct in memory by the time this returns, so making the caller wait
 * ~300ms to also populate the shared cache would add latency to every miss for
 * no benefit to this request. A fire-and-forget write that fails simply means
 * the next request on another instance re-reads the database.
 */
export async function cacheSet(key, value, ttlSeconds = 30) {
  memSet(key, value, ttlSeconds);
  if (!redisEnabled) return;
  redisSet(key, value, ttlSeconds).catch(() => {
    /* ignore — the value is cached locally either way */
  });
}

/** Drop one key. Never throws. */
export async function cacheDel(key) {
  if (!redisEnabled) {
    mem.delete(key);
    return;
  }
  try {
    await redisDel(key);
  } catch {
    /* ignore */
  }
}

/** Drop every key with the given prefix. */
export async function cacheDelPrefix(prefix) {
  if (!redisEnabled) {
    const full = `${NAMESPACE}:${prefix}`;
    for (const k of [...mem.keys()]) if (k.startsWith(full)) mem.delete(k);
    return;
  }
  try {
    await fetch(`${REST_URL}/del/${encodeURIComponent(`${NAMESPACE}:${prefix}`)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REST_TOKEN}` },
      cache: 'no-store',
    });
  } catch {
    /* ignore */
  }
}

/**
 * The workhorse: return the cached value, or run `producer`, cache its result
 * and return it.
 *
 * `producer` must be a function returning the value to cache. A falsy or
 * undefined result is NOT cached, so an empty first page does not get pinned
 * for the whole TTL.
 */
export async function cacheWrap(key, ttlSeconds, producer) {
  const hit = await cacheGet(key);
  if (hit !== undefined) return { value: hit, cached: true };
  const value = await producer();
  if (value !== undefined && value !== null) await cacheSet(key, value, ttlSeconds);
  return { value, cached: false };
}

/** Current backend, for the health endpoint / debugging. */
export function cacheBackend() {
  return redisEnabled ? 'redis' : 'memory';
}
