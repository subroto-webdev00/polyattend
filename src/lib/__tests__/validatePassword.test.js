import { describe, it, expect } from 'vitest';
import { isStrongPassword } from '../validatePassword';

// The backend's single source of truth for "strong password" — every route
// that sets a password defers to this rule.
describe('isStrongPassword', () => {
  it('accepts a password meeting all four rules', () => {
    expect(isStrongPassword('PolyAttend2026')).toEqual({ ok: true });
  });

  it('rejects empty / non-string input', () => {
    expect(isStrongPassword('')).toEqual({ ok: false, message: 'Password is required' });
    expect(isStrongPassword(null)).toEqual({ ok: false, message: 'Password is required' });
    expect(isStrongPassword(12345678)).toEqual({ ok: false, message: 'Password is required' });
  });

  it('rejects passwords shorter than 8 characters', () => {
    expect(isStrongPassword('Ab1').ok).toBe(false);
    expect(isStrongPassword('Ab1').message).toMatch('at least 8 characters');
    expect(isStrongPassword('Abcdef1').message).toMatch('at least 8 characters'); // 7 chars
  });

  it('rejects a missing uppercase letter', () => {
    expect(isStrongPassword('abcdefg1')).toEqual({
      ok: false,
      message: 'Password must include at least one uppercase letter',
    });
  });

  it('rejects a missing lowercase letter', () => {
    expect(isStrongPassword('ABCDEFG1')).toEqual({
      ok: false,
      message: 'Password must include at least one lowercase letter',
    });
  });

  it('rejects a missing number', () => {
    expect(isStrongPassword('Abcdefgh')).toEqual({
      ok: false,
      message: 'Password must include at least one number',
    });
  });

  it('does not require a special character (deliberate rule)', () => {
    expect(isStrongPassword('Abcdefgh').ok).toBe(false); // no digit
    expect(isStrongPassword('Abcdefg1').ok).toBe(true); // no symbol on purpose
  });

  it('checks rules in order: length before character classes', () => {
    expect(isStrongPassword('abc').message).toMatch('at least 8 characters');
  });
});
