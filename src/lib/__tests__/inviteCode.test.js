import { describe, it, expect } from 'vitest';
import { generateInviteCode, oneMonthFromNow } from '../inviteCode';

// 12-char code from an alphabet with confusable characters removed.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

describe('generateInviteCode', () => {
  it('generates a 12-character code by default', () => {
    expect(generateInviteCode()).toHaveLength(12);
  });

  it('honours a custom length', () => {
    expect(generateInviteCode(8)).toHaveLength(8);
    expect(generateInviteCode(1)).toHaveLength(1);
  });

  it('only uses alphabet characters (no 0/O/1/I/L confusion)', () => {
    const code = generateInviteCode(200); // long draw to cover the alphabet
    for (const ch of code) expect(ALPHABET).toContain(ch);
    expect(code).not.toMatch(/[01OIL]/);
  });

  it('produces different codes on successive draws', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateInviteCode()));
    expect(codes.size).toBe(20);
  });
});

describe('oneMonthFromNow', () => {
  it('returns a date one calendar month ahead', () => {
    const d = oneMonthFromNow();
    const now = new Date();
    expect(d.getTime()).toBeGreaterThan(now.getTime());
    const expected = new Date(now);
    expected.setMonth(expected.getMonth() + 1);
    // Allow a small slack for the milliseconds elapsed between the two calls.
    expect(Math.abs(d.getTime() - expected.getTime())).toBeLessThan(5000);
  });

  it('agrees with Date#setMonth semantics (month overflow clamps)', () => {
    const now = new Date();
    const expected = new Date(now);
    expected.setMonth(expected.getMonth() + 1);
    expect(oneMonthFromNow().getMonth()).toBe(expected.getMonth());
    expect(oneMonthFromNow().getDate()).toBe(expected.getDate());
  });
});
