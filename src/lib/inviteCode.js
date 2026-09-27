import crypto from 'crypto';

// Same as the previous MongoDB version — no database dependency, so nothing
// had to change during the Prisma migration.
// 12-character alphanumeric code, with the visually-confusable characters
// (0/O, 1/I/L) left out.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateInviteCode(length = 12) {
  let code = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

export function oneMonthFromNow() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d;
}
