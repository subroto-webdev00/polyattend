// Shared display helpers for dashboard cards and detail rows.
// Internal Prisma enum values stay unchanged; only the UI text is normalized.
export const SHIFT_LABELS = Object.freeze({
  first: 'Morning',
  second: 'Day',
  '1st': 'Morning',
  '2nd': 'Day',
});

export function formatShift(shift) {
  if (!shift) return '';
  return SHIFT_LABELS[shift] || shift;
}

export function formatDepartment(department, fallbackCode = '') {
  if (!department) return fallbackCode || '';
  if (typeof department === 'string') return department;

  const name = department.name || '';
  const code = department.code || fallbackCode || '';
  if (name && code && name !== code) return `${name} (${code})`;
  return name || code || '';
}

export function formatSubject(subject) {
  if (!subject) return 'Unknown Subject';
  const name = subject.name || 'Unknown Subject';
  return subject.code ? `${name} (${subject.code})` : name;
}
