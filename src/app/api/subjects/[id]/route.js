import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
export const dynamic = 'force-dynamic';

// A Department Admin may only touch a Subject that belongs to their own
// Department AND Shift — the same scope GET /api/subjects applies to their
// list. Without this check any departmentAdmin could PUT/DELETE another
// department's Subject by guessing its id.
async function loadScopedSubject(id, auth) {
  const subject = await prisma.subject.findUnique({ where: { id } });
  if (!subject) {
    return { error: NextResponse.json({ success: false, message: 'Subject not found' }, { status: 404 }) };
  }
  if (auth.user.role === 'departmentAdmin') {
    const inDept = subject.departmentId === auth.user.departmentId;
    const inShift = !auth.user.shift || !subject.shift || subject.shift === auth.user.shift;
    if (!inDept || !inShift) {
      return { error: NextResponse.json({ success: false, message: 'Not allowed: this Subject belongs to another Department or Shift' }, { status: 403 }) };
    }
  }
  return { subject };
}

export async function PUT(request, { params }) {
  const auth = await requireAuth(request, ['admin', 'departmentAdmin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const { error } = await loadScopedSubject(id, auth);
    if (error) return error;
    const body = await request.json();
    const subject = await prisma.subject.update({ where: { id }, data: { name: body.name, code: body.code, teacherId: body.teacherId || null, isActive: body.isActive } });
    return NextResponse.json({ success: true, subject });
  } catch (error) { return errorResponse(error, 400); }
}

export async function DELETE(request, { params }) {
  const auth = await requireAuth(request, ['admin', 'departmentAdmin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const { error } = await loadScopedSubject(id, auth);
    if (error) return error;
    // Soft delete: the Subject disappears from every list (GET defaults to
    // `isActive: true`), but Sessions, Attendances and IgnoredMiss rows all
    // hold a required FK to it — so the attendance history stays intact.
    await prisma.subject.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true, message: 'Subject deleted. Existing attendance history is kept.' });
  } catch (error) { return errorResponse(error, 400); }
}
