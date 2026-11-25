import { describe, it, expect, vi, afterEach } from 'vitest';
import { hit, getClientIp, checkRateLimit } from '../rateLimit';

// The in-memory path is exercised by default (no Upstash env vars in tests).
// Each test uses a unique key so the module-level bucket Map never bleeds
// state between cases.
afterEach(() => {
  vi.useRealTimers();
});

describe('hit (in-memory limiter)', () => {
  it('allows up to the limit, then blocks', async () => {
    const key = `t:ip:${Date.now()}-a`;
    expect((await hit(key, 2, 60_000)).allowed).toBe(true);
    const second = await hit(key, 2, 60_000);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
    const third = await hit(key, 2, 60_000);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfterMs).toBeGreaterThan(0);
  });

  it('starts a fresh window after windowMs elapses', async () => {
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const key = `t:ip:${Date.now()}-b`;
    expect((await hit(key, 1, 1000)).allowed).toBe(true);
    expect((await hit(key, 1, 1000)).allowed).toBe(false);
    vi.advanceTimersByTime(1001);
    expect((await hit(key, 1, 1000)).allowed).toBe(true);
  });

  it('keeps separate keys in separate buckets', async () => {
    const base = `t:ip:${Date.now()}-c`;
    expect((await hit(`${base}:one`, 1, 60_000)).allowed).toBe(true);
    expect((await hit(`${base}:one`, 1, 60_000)).allowed).toBe(false);
    expect((await hit(`${base}:two`, 1, 60_000)).allowed).toBe(true);
  });
});

describe('getClientIp', () => {
  const req = (headers) => ({ headers: { get: (k) => headers[k.toLowerCase()] ?? null } });

  it('prefers the first entry of x-forwarded-for', () => {
    expect(getClientIp(req({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4');
  });

  it('falls back to x-real-ip, then to a shared default', () => {
    expect(getClientIp(req({ 'x-real-ip': ' 9.9.9.9 ' }))).toBe('9.9.9.9');
    expect(getClientIp(req({}))).toBe('unknown');
  });
});

describe('checkRateLimit', () => {
  const req = (ip) => ({ headers: { get: (k) => (k.toLowerCase() === 'x-forwarded-for' ? ip : null) } });

  it('returns null while under the limit', async () => {
    const ip = `10.0.${Math.floor(Math.random() * 255)}.1`;
    expect(await checkRateLimit(req(ip), `t-rl-${Date.now()}`, 'user@example.com')).toBeNull();
  });

  it('blocks with a retry hint once the per-IP budget is spent', async () => {
    const route = `t-rl-${Date.now()}`;
    const ip = `10.1.${Math.floor(Math.random() * 255)}.1`;
    const opts = { limit: 2, windowMs: 60_000 };
    expect(await checkRateLimit(req(ip), route, null, opts)).toBeNull();
    expect(await checkRateLimit(req(ip), route, null, opts)).toBeNull();
    const blocked = await checkRateLimit(req(ip), route, null, opts);
    expect(blocked.blocked).toBe(true);
    expect(blocked.message).toMatch('Too many attempts');
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });
});
