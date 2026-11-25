import { describe, it, expect, vi, beforeEach } from 'vitest';

// withLiveTotalStudents recomputes roster counts at read time (the stored
// Session.totalStudents goes stale whenever the class roster changes), so
// the DB only needs to answer one grouped query.
vi.mock('@/lib/db', () => ({
  default: { user: { groupBy: vi.fn() } },
}));

import { withLiveTotalStudents } from '@/lib/sessionTotals';
import prisma from '@/lib/db';

const GROUPS = [
  { departmentId: 'dep1', semester: 1, section: 'A', shift: 'first', _count: { _all: 12 } },
  { departmentId: 'dep1', semester: 1, section: 'A', shift: 'second', _count: { _all: 5 } },
  { departmentId: 'dep1', semester: 2, section: 'B', shift: 'first', _count: { _all: 7 } },
];

beforeEach(() => {
  prisma.user.groupBy.mockReset();
  prisma.user.groupBy.mockResolvedValue(GROUPS);
});

describe('withLiveTotalStudents', () => {
  it('returns empty / non-array input untouched without querying', async () => {
    expect(await withLiveTotalStudents([])).toEqual([]);
    expect(await withLiveTotalStudents(undefined)).toEqual([]);
    expect(await withLiveTotalStudents(null)).toEqual([]);
    expect(prisma.user.groupBy).not.toHaveBeenCalled();
  });

  it('counts only the matching shift when the session has one', async () => {
    const sessions = [{ id: 's1', departmentId: 'dep1', semester: 1, section: 'A', shift: 'first', totalStudents: 1 }];
    const out = await withLiveTotalStudents(sessions);
    expect(out[0].totalStudents).toBe(12);
    expect(out[0].id).toBe('s1'); // original fields preserved
    expect(prisma.user.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { role: 'student', isActive: true },
    }));
  });

  it('sums every shift when the session has none', async () => {
    const sessions = [{ id: 's2', departmentId: 'dep1', semester: 1, section: 'A', shift: null }];
    const out = await withLiveTotalStudents(sessions);
    expect(out[0].totalStudents).toBe(17); // 12 + 5
  });

  it('answers 0 for a class with no active students', async () => {
    const sessions = [{ id: 's3', departmentId: 'nope', semester: 9, section: 'Z', shift: 'first' }];
    const out = await withLiveTotalStudents(sessions);
    expect(out[0].totalStudents).toBe(0);
  });

  it('recomputes every session in one grouped query', async () => {
    const sessions = [
      { id: 'a', departmentId: 'dep1', semester: 1, section: 'A', shift: 'first' },
      { id: 'b', departmentId: 'dep1', semester: 1, section: 'A', shift: 'second' },
      { id: 'c', departmentId: 'dep1', semester: 2, section: 'B', shift: 'first' },
    ];
    const out = await withLiveTotalStudents(sessions);
    expect(out.map(s => s.totalStudents)).toEqual([12, 5, 7]);
    expect(prisma.user.groupBy).toHaveBeenCalledTimes(1);
  });

  it('treats a missing _count as zero', async () => {
    prisma.user.groupBy.mockResolvedValue([{ departmentId: 'dep1', semester: 1, section: 'A', shift: 'first' }]);
    const out = await withLiveTotalStudents([{ id: 's4', departmentId: 'dep1', semester: 1, section: 'A', shift: 'first' }]);
    expect(out[0].totalStudents).toBe(0);
  });
});
