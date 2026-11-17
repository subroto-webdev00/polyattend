import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
export const dynamic = 'force-dynamic';
function classNameFromSession(s) { return (s?.semester != null && s?.section) ? `Class ${s.semester}-${s.section}` : 'Class unknown'; }
export async function POST(request) {
  const auth = await requireAuth(request, ['teacher', 'admin']);
  if (auth.error) return auth.error;
  try {
    const { sessionId, studentId } = await request.json();
    if (!sessionId || !studentId) return NextResponse.json({ success: false, message: 'Enter sessionId and studentId' }, { status: 400 });
    const session = await prisma.session.findUnique({ where: { id: sessionId }, include: { subject: { select: { shift: true } } } });
    if (!session) return NextResponse.json({ success: false, message: 'Session not found' }, { status: 404 });
    if (session.status !== 'active') return NextResponse.json({ success: false, message: 'Session is not active' }, { status: 400 });
    if (auth.user.role !== 'admin' && session.teacherId !== auth.user.id) return NextResponse.json({ success: false, message: 'Not your session' }, { status: 403 });
    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!student || student.role !== 'student') return NextResponse.json({ success: false, message: 'Student not found' }, { status: 404 });
    // Cancelled invites / deactivated accounts can never be marked — every
    // report filters `isActive: true`, so a mark written here would silently
    // disappear from the report. Pending (invited) students ARE markable:
    // they are isActive with role student, so they pass this guard.
    if (!student.isActive) return NextResponse.json({ success: false, message: `${student.name}'s account is deactivated` }, { status: 400 });
    const sessionShift = session.shift || session.subject?.shift;
    if (sessionShift && student.shift !== sessionShift) return NextResponse.json({ success: false, message: `${student.name} is not a student of this shift` }, { status: 400 });
    if (student.semester !== session.semester || student.section !== session.section || student.departmentId !== session.departmentId) return NextResponse.json({ success: false, message: `${student.name} is not a student of this class` }, { status: 400 });
    const existing = await prisma.attendance.findFirst({ where: { sessionId, studentId: student.id } });
    if (existing) {
      if (existing.status === 'present') return NextResponse.json({ success: false, message: `${student.name} is already marked present`, student: { name: student.name, studentId: student.studentId } }, { status: 400 });
      await prisma.attendance.update({ where: { id: existing.id }, data: { status: 'present', scannedAt: new Date(), markedBy: 'search' } });
      await prisma.session.update({ where: { id: sessionId }, data: { presentCount: { increment: 1 } } });
      return NextResponse.json({ success: true, message: `✅ ${student.name} present marked (search)`, student: { name: student.name, studentId: student.studentId, section: student.section, shift: student.shift } });
    }
    const attendance = await prisma.attendance.create({ data: { sessionId, studentId: student.id, subjectId: session.subjectId, departmentId: session.departmentId, semester: session.semester, section: session.section, className: classNameFromSession(session), date: new Date(), status: 'present', scannedAt: new Date(), markedBy: 'search' } });
    await prisma.session.update({ where: { id: sessionId }, data: { presentCount: { increment: 1 } } });
    return NextResponse.json({ success: true, message: `✅ ${student.name} present marked (search)`, student: { name: student.name, studentId: student.studentId, section: student.section, shift: student.shift }, attendance });
  } catch (error) { return errorResponse(error); }
}
