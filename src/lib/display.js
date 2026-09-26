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

// Current hour in Bangladesh time (UTC+6), independent of whatever timezone
// the server or visitor's browser happens to be in. TPI is in Bangladesh, so
// "Good Morning" must follow the campus clock, not the viewer's.
export function getBangladeshHour(date = new Date()) {
  const bdString = date.toLocaleString('en-US', { timeZone: 'Asia/Dhaka', hour12: false, hour: '2-digit' });
  return parseInt(bdString, 10) % 24;
}

// "Good Morning" / "Good Afternoon" / "Good Evening" for the top bar greeting.
export function getGreetingText(date = new Date()) {
  const h = getBangladeshHour(date);
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}
