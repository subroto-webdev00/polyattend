import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
export const dynamic = 'force-dynamic';
const sessionInclude = { teacher: { select: { id: true, name: true } }, department: { select: { id: true, name: true, code: true } }, subject: { select: { id: true, name: true, code: true } } };
export async function GET(request, { params }) {
  const auth = await requireAuth(request, ['teacher', 'admin', 'subAdmin', 'semesterAdmin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const session = await prisma.session.findUnique({ where: { id }, include: sessionInclude });
    if (!session) return NextResponse.json({ success: false, message: 'Session not found' }, { status: 404 });
    if (auth.user.role === 'teacher' && session.teacherId !== auth.user.id) return NextResponse.json({ success: false, message: 'This is not your session' }, { status: 403 });
    if (auth.user.role === 'subAdmin' && (session.departmentId !== auth.user.departmentId || session.shift !== auth.user.shift)) return NextResponse.json({ success: false, message: 'Outside your scope' }, { status: 403 });
    if (auth.user.role === 'semesterAdmin' && (session.departmentId !== auth.user.departmentId || session.shift !== auth.user.shift || !(auth.user.semesters||[]).includes(session.semester))) return NextResponse.json({ success: false, message: 'Outside your scope' }, { status: 403 });
    const attendance = await prisma.attendance.findMany({ where: { sessionId: id }, include: { student: { select: { id: true, name: true, studentId: true, section: true } } } });
    return NextResponse.json({ success: true, session, attendance });
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(request, { params }) {
  const auth = await requireAuth(request, ['teacher', 'admin', 'subAdmin', 'semesterAdmin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) return NextResponse.json({ success: false, message: 'Session not found' }, { status: 404 });
    if (auth.user.role === 'teacher' && session.teacherId !== auth.user.id) return NextResponse.json({ success: false, message: 'This is not your session' }, { status: 403 });
    if (auth.user.role === 'subAdmin' && (session.departmentId !== auth.user.departmentId || session.shift !== auth.user.shift)) return NextResponse.json({ success: false, message: 'Outside your scope' }, { status: 403 });
    if (session.status === 'active') return NextResponse.json({ success: false, message: 'End the Session first' }, { status: 400 });
    await prisma.attendance.deleteMany({ where: { sessionId: id } });
    await prisma.session.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Session and its attendance have been deleted' });
  } catch (error) { return errorResponse(error); }
}
