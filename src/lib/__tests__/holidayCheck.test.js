import { describe, it, expect, vi, beforeEach } from 'vitest';

// holidayCheck hits the DB on weekdays only — Friday/Saturday short-circuit
// before any query. Mock the DB module so no Postgres is needed.
vi.mock('../db', () => ({
  default: { holiday: { findFirst: vi.fn() } },
}));

import { checkHoliday, isWeekend } from '../holidayCheck';
import prisma from '../db';

beforeEach(() => {
  prisma.holiday.findFirst.mockReset();
});

describe('isWeekend', () => {
  it('treats Friday and Saturday as the weekend', () => {
    expect(isWeekend('2026-11-27')).toBe(true); // Friday
    expect(isWeekend('2026-11-28')).toBe(true); // Saturday
  });

  it('leaves Sunday–Thursday as working days', () => {
    expect(isWeekend('2026-11-29')).toBe(false); // Sunday
    expect(isWeekend('2026-11-25')).toBe(false); // Wednesday
    expect(isWeekend('2026-11-26')).toBe(false); // Thursday
  });
});

describe('checkHoliday', () => {
  it('answers Friday/Saturday without touching the database', async () => {
    const res = await checkHoliday('2026-11-27'); // Friday
    expect(res).toEqual({ isHoliday: true, reason: 'Friday', holiday: null });
    expect(prisma.holiday.findFirst).not.toHaveBeenCalled();
  });

  it('queries the DB on a weekday and reports no holiday when none matches', async () => {
    prisma.holiday.findFirst.mockResolvedValue(null);
    const res = await checkHoliday('2026-11-25'); // Wednesday
    expect(res).toEqual({ isHoliday: false, reason: null, holiday: null });
    expect(prisma.holiday.findFirst).toHaveBeenCalledTimes(1);
  });

  it('returns the holiday row when the date falls inside one', async () => {
    const holiday = { id: 'h1', name: 'Victory Day', startDate: '2026-12-16', endDate: '2026-12-16' };
    prisma.holiday.findFirst.mockResolvedValue(holiday);
    const res = await checkHoliday('2026-12-16'); // Wednesday
    expect(res).toEqual({ isHoliday: true, reason: 'holiday', holiday });
  });

  it('spans the query window across the whole local day', async () => {
    prisma.holiday.findFirst.mockResolvedValue(null);
    await checkHoliday('2026-11-25T09:30:00');
    const where = prisma.holiday.findFirst.mock.calls[0][0].where;
    expect(where.startDate.lte.getHours()).toBe(23);
    expect(where.startDate.lte.getMilliseconds()).toBe(999);
    expect(where.endDate.gte.getHours()).toBe(0);
    expect(where.endDate.gte.getMinutes()).toBe(0);
  });
});
