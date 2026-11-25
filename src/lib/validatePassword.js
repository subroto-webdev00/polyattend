// @ts-check
// Shared "strong password" rule — used by every backend route that sets a
// password (register-public, admin-register, reset-password,
// change-password) so the requirement can never drift out of sync between
// them. The frontend forms check the same rule for instant feedback, but
// this is the source of truth: even if a request bypasses the UI, the
// backend never accepts a weak password.
//
// Rule: at least 8 characters, with at least one uppercase letter, one
// lowercase letter, and one number. (No mandatory special character — a
// deliberate balance between real strength and not frustrating students
// typing on a phone keyboard.)
export function isStrongPassword(pw) {
  if (!pw || typeof pw !== 'string') return { ok: false, message: 'Password is required' };
  if (pw.length < 8) return { ok: false, message: 'Password must be at least 8 characters' };
  if (!/[A-Z]/.test(pw)) return { ok: false, message: 'Password must include at least one uppercase letter' };
  if (!/[a-z]/.test(pw)) return { ok: false, message: 'Password must include at least one lowercase letter' };
  if (!/[0-9]/.test(pw)) return { ok: false, message: 'Password must include at least one number' };
  return { ok: true };
}
