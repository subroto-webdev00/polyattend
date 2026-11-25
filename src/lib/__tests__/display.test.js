import { describe, it, expect } from 'vitest';
import {
  formatShift,
  formatDepartment,
  formatSubject,
  getBangladeshHour,
  getGreetingText,
} from '../display';

describe('formatShift', () => {
  it('maps Prisma enum values and raw DB values to the same label', () => {
    expect(formatShift('first')).toBe('Morning');
    expect(formatShift('second')).toBe('Day');
    expect(formatShift('1st')).toBe('Morning');
    expect(formatShift('2nd')).toBe('Day');
  });

  it('passes unknown values through and empty values as blank', () => {
    expect(formatShift('night')).toBe('night');
    expect(formatShift('')).toBe('');
    expect(formatShift(null)).toBe('');
    expect(formatShift(undefined)).toBe('');
  });
});

describe('formatDepartment', () => {
  it('returns the fallback code when no department is given', () => {
    expect(formatDepartment(null, 'CST')).toBe('CST');
    expect(formatDepartment(null)).toBe('');
  });

  it('returns strings as-is (already-formatted input)', () => {
    expect(formatDepartment('Computer Science')).toBe('Computer Science');
  });

  it('joins name and code when they differ', () => {
    expect(formatDepartment({ name: 'Computer science & technology', code: '85' }))
      .toBe('Computer science & technology (85)');
  });

  it('does not duplicate when name equals code', () => {
    expect(formatDepartment({ name: 'CST', code: 'CST' })).toBe('CST');
  });

  it('falls back to whichever part exists', () => {
    expect(formatDepartment({ name: 'Electrical' })).toBe('Electrical');
    expect(formatDepartment({ code: 'EL' })).toBe('EL');
    expect(formatDepartment({}, 'RC')).toBe('RC');
    expect(formatDepartment({})).toBe('');
  });
});

describe('formatSubject', () => {
  it('returns a placeholder for missing subjects', () => {
    expect(formatSubject(null)).toBe('Unknown Subject');
    expect(formatSubject(undefined)).toBe('Unknown Subject');
  });

  it('appends the code when present', () => {
    expect(formatSubject({ name: 'Math', code: 'MATH101' })).toBe('Math (MATH101)');
  });

  it('uses the name alone when there is no code', () => {
    expect(formatSubject({ name: 'Math' })).toBe('Math');
    expect(formatSubject({})).toBe('Unknown Subject');
  });
});

describe('Bangladesh-time greeting', () => {
  // getGreetingText must follow the campus clock (UTC+6), not the viewer's
  // timezone — pin the instant and assert the Dhaka-hour result.
  it('reads the hour in Asia/Dhaka regardless of the host timezone', () => {
    expect(getBangladeshHour(new Date('2026-01-01T04:00:00Z'))).toBe(10); // 10:00 BD
    expect(getBangladeshHour(new Date('2026-01-01T18:30:00Z'))).toBe(0); // 00:30 BD next day
  });

  it('greets by the Dhaka hour boundaries', () => {
    expect(getGreetingText(new Date('2026-01-01T04:00:00Z'))).toBe('Good Morning'); // 10:00 BD
    expect(getGreetingText(new Date('2026-01-01T00:00:00Z'))).toBe('Good Morning'); // 06:00 BD
    expect(getGreetingText(new Date('2026-01-01T06:00:00Z'))).toBe('Good Afternoon'); // 12:00 BD
    expect(getGreetingText(new Date('2026-01-01T10:59:00Z'))).toBe('Good Afternoon'); // 16:59 BD
    expect(getGreetingText(new Date('2026-01-01T11:00:00Z'))).toBe('Good Evening'); // 17:00 BD
    expect(getGreetingText(new Date('2026-01-01T17:00:00Z'))).toBe('Good Evening'); // 23:00 BD
  });
});
