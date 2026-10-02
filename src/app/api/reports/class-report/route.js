import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// How far back the report looks. The rolling window is a READ filter only:
// nothing is deleted from the database, so a class that falls out of this
// window is still counted in a Student's attendance, in the subject/student
// reports, and in the 3-day-or-older exports. Turning this into a delete
// would silently rewrite every Student's attendance history.
const WINDOW_DAYS = 3;

const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60 * 1000;

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Dhaka',
  day: '2-digit', month: 'short', year: 'numeric',
});
const fmtTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Dhaka',
  hour: '2-digit', minute: '2-digit', hour12: true,
});

// GET /api/reports/class-report
// Which classes each Teacher actually took, newest first, limited to the last
// WINDOW_DAYS.
//
// Scope:
//   Admin             — every Department in the institution.
//   Department Admin  — own Department + own Shift.
//   Teacher           — own classes only.
//
// Read-only. There is no delete here on purpose; see WINDOW_DAYS above.
export async function GET(request) {
  const auth = await requireAuth(request, ['admin', 'departmentAdmin', 'teacher']);
  if (auth.error) return auth.error;

  try {
    const since = new Date(Date.now() - WINDOW_MS);

    const where = { date: { gte: since } };

    if (auth.user.role === 'teacher') {
      where.teacherId = auth.user.id;
    } else if (auth.user.role === 'departmentAdmin') {
      if (!auth.user.departmentId) {
        return NextResponse.json({ success: false, message: 'Your account has no Department' }, { status: 400 });
      }
      where.departmentId = auth.user.departmentId;
      // A Department Admin's Shift scopes them, exactly as everywhere else in
      // the app. Sessions without a shift stay visible so a class never
      // silently disappears from their own report.
      if (auth.user.shift) {
        where.OR = [
          { shift: auth.user.shift },
          { shift: null, subject: { shift: auth.user.shift } },
        ];
      }
    }

    const sessions = await prisma.session.findMany({
      where,
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
      include: {
        teacher: { select: { id: true, name: true, email: true, mobile: true } },
        department: { select: { id: true, name: true, code: true } },
        subject: { select: { id: true, name: true, code: true, shift: true, semester: true, section: true } },
      },
    });

    const classes = sessions.map((s) => {
      // Prefer the Session's own shift; fall back to the Subject's, which is
      // where a shiftless session still inherits one from.
      const shift = s.shift || s.subject?.shift || null;
      const start = fmtTime.format(s.startTime);
      const end = s.endTime ? fmtTime.format(s.endTime) : null;
      return {
        id: s.id,
        // The class title: the subject is what identifies a class, so it leads.
        subjectName: s.subject?.name || 'Unknown Subject',
        subjectCode: s.subject?.code || '',
        teacherName: s.teacher?.name || 'Unknown Teacher',
        teacherMobile: s.teacher?.mobile || '',
        departmentName: s.department?.name || '',
        departmentCode: s.department?.code || '',
        shift,
        semester: s.semester,
        section: s.section,
        date: fmt.format(s.date),
        // YYYY-MM-DD in Bangladesh time, so the browser groups by the campus
        // calendar day rather than the server's.
        dateKey: new Date(s.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }),
        startTime: start,
        endTime: end,
        timeRange: end ? `${start} – ${end}` : start,
        status: s.status,
        isSubstitute: s.isSubstitute,
        presentCount: s.presentCount,
        totalStudents: s.totalStudents,
      };
    });

    return NextResponse.json({
      success: true,
      classes,
      windowDays: WINDOW_DAYS,
      since: fmt.format(since),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
