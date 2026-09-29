import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const auth = await requireAuth(request, ['teacher','admin','departmentAdmin']);
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subjectId');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const where = { date: { gte: sevenDaysAgo } };

    if (subjectId) {
      // A subject must be inside the caller's own Department + Shift before
      // its missed classes are readable. This used to be skipped entirely:
      // the `where` object below was never actually passed to the query, so
      // any authenticated caller could read any subject's ignored classes by
      // guessing its id.
      const subject = await prisma.subject.findUnique({
        where: { id: subjectId },
        select: { id: true, departmentId: true, shift: true },
      });
      if (!subject) {
        return NextResponse.json({ success: false, message: 'Subject not found' }, { status: 404 });
      }
      if (auth.user.role !== 'admin') {
        const sameDept = subject.departmentId === auth.user.departmentId;
        const sameShift = !auth.user.shift || !subject.shift || subject.shift === auth.user.shift;
        if (!sameDept || !sameShift) {
          return NextResponse.json({ success: false, message: 'This subject is outside your scope' }, { status: 403 });
        }
      }
      where.subjectId = subjectId;
    } else if (auth.user.role === 'teacher') {
      where.subject = { teacherId: auth.user.id };
    } else if (auth.user.role === 'departmentAdmin') {
      // Department-wide: every subject in the Department Admin's Department.
      where.subject = {
        departmentId: auth.user.departmentId,
        ...(auth.user.shift ? { shift: auth.user.shift } : {}),
      };
    }

    const missedDates = await prisma.ignoredMiss.findMany({
      where,
      include: { subject: { select: { id:true, name:true } }, ignoredBy: { select: { id:true, name:true } } },
    });
    return NextResponse.json({ success: true, missedDates });
  } catch (error) { return errorResponse(error); }
}
