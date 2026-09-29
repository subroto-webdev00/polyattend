import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
import { checkHoliday } from '@/lib/holidayCheck';
export const dynamic = 'force-dynamic';
const sessionInclude = {
  teacher: { select: { id: true, name: true, email: true, role: true } },
  department: { select: { id: true, name: true, code: true } },
  subject: { select: { id: true, name: true, code: true } },
};

// Normalize Prisma's separate foreign keys + relations into the populated
// document shape used throughout the existing frontend.
function normalizeSession(session) {
  if (!session) return session;
  return {
    ...session,
    _id: session.id,
    teacherId: session.teacher
      ? { ...session.teacher, _id: session.teacher.id || session.teacher._id }
      : session.teacherId,
    departmentId: session.department
      ? { ...session.department, _id: session.department.id }
      : session.departmentId,
    subjectId: session.subject
      ? { ...session.subject, _id: session.subject.id }
      : session.subjectId,
  };
}
export async function POST(request) {
  const auth = await requireAuth(request, ['teacher', 'admin']);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();
    const { subjectId, semester, section, date: explicitDateParam } = body;
    if (!subjectId || semester == null || !section) return NextResponse.json({ success: false, message: 'Subject, semester and section are required' }, { status: 400 });
    let sessionDate = null;
    if (explicitDateParam && auth.user.role === 'teacher') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(explicitDateParam)) return NextResponse.json({ success: false, message: 'Invalid date format' }, { status: 400 });
      sessionDate = new Date(`${explicitDateParam}T00:00:00`);
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      if (sessionDate > todayStart) return NextResponse.json({ success: false, message: 'Cannot start a session for a future date' }, { status: 400 });
    }
    const holidayResult = await checkHoliday(sessionDate || new Date());
    if (holidayResult.isHoliday) {
      const msg = holidayResult.reason === 'Friday' ? 'That day is Friday' : holidayResult.reason === 'Saturday' ? 'That day is Saturday' : `That day is a holiday (${holidayResult.holiday?.title || 'Declared Holiday'})`;
      return NextResponse.json({ success: false, message: `${msg} — College is closed.` }, { status: 403 });
    }
    let subject;
    if (auth.user.role === 'teacher') {
      subject = await prisma.subject.findFirst({ where: { id: subjectId, teacherId: auth.user.id, isActive: true } });
      if (!subject) return NextResponse.json({ success: false, message: 'You are not assigned to this subject' }, { status: 403 });
    } else {
      subject = await prisma.subject.findUnique({ where: { id: subjectId } });
      if (!subject) return NextResponse.json({ success: false, message: 'Subject not found' }, { status: 404 });
    }
    if (!subject.departmentId) return NextResponse.json({ success: false, message: 'This subject has no valid Department.' }, { status: 400 });
    const existing = await prisma.session.findFirst({ where: { subjectId, semester: parseInt(semester), section, status: 'active' } });
    if (existing) return NextResponse.json({ success: false, message: 'An active session already exists for this class', session: existing }, { status: 400 });
    if (sessionDate) {
      const dayStart = new Date(sessionDate); dayStart.setHours(0,0,0,0);
      const dayEnd = new Date(sessionDate); dayEnd.setHours(23,59,59,999);
      const existingForDate = await prisma.session.findFirst({ where: { subjectId, date: { gte: dayStart, lte: dayEnd } } });
      if (existingForDate) return NextResponse.json({ success: false, message: 'A Session already exists for this date' }, { status: 400 });
    }
    const totalStudents = await prisma.user.count({ where: { role: 'student', departmentId: subject.departmentId, semester: parseInt(semester), section, isActive: true, registered: true, ...(subject.shift ? { shift: subject.shift } : {}) } });
    const data = { teacherId: auth.user.id, departmentId: subject.departmentId, subjectId, semester: parseInt(semester), section, shift: subject.shift || null, totalStudents, ...(sessionDate ? { date: sessionDate } : {}) };
    const session = await prisma.session.create({ data, include: sessionInclude });
    return NextResponse.json({ success: true, session: normalizeSession(session) }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const where = {};
    if (auth.user.role === 'teacher') where.teacherId = auth.user.id;
    if (searchParams.get('departmentId')) where.departmentId = searchParams.get('departmentId');
    if (searchParams.get('subjectId')) where.subjectId = searchParams.get('subjectId');
    if (searchParams.get('semester')) where.semester = parseInt(searchParams.get('semester'));
    if (searchParams.get('section')) where.section = searchParams.get('section');
    if (searchParams.get('status')) where.status = searchParams.get('status');
    // Role scope is applied LAST so it cannot be widened by a query param.
    // A Department Admin is department-wide (own Department + Shift, all
    // Semesters) — the old `semester: { in: ... }` narrowing is gone with
    // the old role split. Without this ordering, `?departmentId=`
    // would let a Department Admin read another department's sessions.
    if (auth.user.role === 'departmentAdmin') { where.departmentId = auth.user.departmentId; where.shift = auth.user.shift; }
    const sessions = await prisma.session.findMany({ where, include: sessionInclude, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], take: 100 });
    return NextResponse.json({ success: true, count: sessions.length, sessions: sessions.map(normalizeSession) });
  } catch (error) { return errorResponse(error); }
}
