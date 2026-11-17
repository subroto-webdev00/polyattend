import prisma from '@/lib/db';

// `Session.totalStudents` is stored once, at creation time. Anything that
// changed the class roster afterwards — inviting a batch of students,
// Semester Promotion, a cancelled invite — left that stored number stale, and
// every session card / dashboard percentage divides by it (a class of 40
// marked present against a stored 1 showed "40/1 — 4000%").
//
// This recomputes the roster count at read time for the sessions being
// returned, using EXACTLY the rule the reports use
// (/api/reports/class/[sessionId] and the session-create count):
//
//   role: 'student' + isActive: true + same department/semester/section
//   + the session's shift when it has one (a shiftless session counts every
//     shift, same as the report roster does)
//
// Invited (pending) students are included — they sit in the class and can be
// marked — while cancelled invites and deactivated accounts stay out. One
// grouped query covers every session in the response instead of one count
// per session.
export async function withLiveTotalStudents(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return sessions || [];

  const groups = await prisma.user.groupBy({
    by: ['departmentId', 'semester', 'section', 'shift'],
    where: { role: 'student', isActive: true },
    _count: { _all: true },
  });

  const byShift = new Map();
  const anyShift = new Map();
  for (const g of groups) {
    const base = `${g.departmentId}|${g.semester}|${g.section}`;
    const n = g._count?._all ?? 0;
    byShift.set(`${base}|${g.shift}`, (byShift.get(`${base}|${g.shift}`) || 0) + n);
    anyShift.set(base, (anyShift.get(base) || 0) + n);
  }

  return sessions.map((s) => {
    const base = `${s.departmentId}|${s.semester}|${s.section}`;
    const total = s.shift ? (byShift.get(`${base}|${s.shift}`) || 0) : (anyShift.get(base) || 0);
    return { ...s, totalStudents: total };
  });
}
