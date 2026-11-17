import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
export const dynamic = 'force-dynamic';
function classNameFromSession(s) { return (s?.semester != null && s?.section) ? `Class ${s.semester}-${s.section}` : 'Class unknown'; }
export async function POST(request) {
  const auth = await requireAuth(request, ['teacher', 'admin']);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();
    const { sessionId, attendanceList } = body;
    if (!sessionId || !Array.isArray(attendanceList)) return NextResponse.json({ success: false, message: 'sessionId and attendanceList are required' }, { status: 400 });
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return NextResponse.json({ success: false, message: 'Session not found' }, { status: 404 });
    if (session.status !== 'active') return NextResponse.json({ success: false, message: 'Session not active' }, { status: 400 });
    if (auth.user.role !== 'admin' && session.teacherId !== auth.user.id) return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
    if (!session.departmentId || !session.subjectId) return NextResponse.json({ success: false, message: 'Subject/Department data is incomplete' }, { status: 400 });
    const className = classNameFromSession(session);
    const validItems = attendanceList.filter(item => item?.studentId);
    if (!validItems.length) return NextResponse.json({ success: false, message: 'No valid student found' }, { status: 400 });
    // Only ACTIVE members of this class may be written. The posted list can
    // be stale — a cancelled invite, a deactivated account, a student who
    // moved class — and a mark on anyone the reports filter out would never
    // show up in a report (same "marked but missing" bug). Pending (invited)
    // students are active, so they are written like everyone else.
    const itemIds = [...new Set(validItems.map(i => i.studentId))];
    const members = await prisma.user.findMany({
      where: {
        id: { in: itemIds },
        role: 'student',
        isActive: true,
        departmentId: session.departmentId,
        semester: session.semester,
        section: session.section,
        ...(session.shift ? { shift: session.shift } : {}),
      },
      select: { id: true },
    });
    const memberIds = new Set(members.map(m => m.id));
    const items = validItems.filter(i => memberIds.has(i.studentId));
    if (!items.length) return NextResponse.json({ success: false, message: 'No active student of this class in the list' }, { status: 400 });
    await prisma.$transaction(items.map(item =>
      prisma.attendance.upsert({
        where: { sessionId_studentId: { sessionId, studentId: item.studentId } },
        update: { status: item.status === 'present' ? 'present' : 'absent', markedBy: 'manual' },
        create: { sessionId, studentId: item.studentId, subjectId: session.subjectId, departmentId: session.departmentId, semester: session.semester, section: session.section, className, date: session.date, status: item.status === 'present' ? 'present' : 'absent', markedBy: 'manual' },
      })
    ));
    const presentCount = items.filter(a => a.status === 'present').length;
    await prisma.session.update({ where: { id: sessionId }, data: { presentCount } });
    return NextResponse.json({ success: true, message: 'Attendance saved', presentCount });
  } catch (error) { return errorResponse(error); }
}
