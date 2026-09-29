import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function PUT(request, { params }) {
  const auth = await requireAuth(request, ['departmentAdmin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const body = await request.json();
    const student = await prisma.user.findUnique({ where: { id } });
    if (!student || student.role !== 'student') return NextResponse.json({ success: false, message: 'Student not found' }, { status: 404 });
    if (student.departmentId !== auth.user.departmentId || student.shift !== auth.user.shift || !(auth.user.semesters||[]).map(Number).includes(Number(student.semester)))
      return NextResponse.json({ success: false, message: 'Outside your scope' }, { status: 403 });
    const updated = await prisma.user.update({ where: { id }, data: { section: body.section, semester: body.semester ? parseInt(body.semester) : undefined, isActive: body.isActive } });
    return NextResponse.json({ success: true, student: updated });
  } catch (error) { return errorResponse(error, 400); }
}
export async function DELETE(request, { params }) {
  const auth = await requireAuth(request, ['departmentAdmin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const student = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        departmentId: true,
        shift: true,
        semester: true,
        registered: true,
        studentId: true,
        email: true,
      },
    });
    if (!student || student.role !== 'student') return NextResponse.json({ success: false, message: 'Student not found' }, { status: 404 });
    if (student.departmentId !== auth.user.departmentId || student.shift !== auth.user.shift || !(auth.user.semesters||[]).map(Number).includes(Number(student.semester)))
      return NextResponse.json({ success: false, message: 'Outside your scope' }, { status: 403 });

    // A pending invitation is a shadow User (registered=false), not a real
    // student account. Remove it and any incomplete registration/legacy
    // pre-approval so the invitation stops appearing in the validation list.
    if (student.registered === false) {
      await prisma.$transaction(async (tx) => {
        await tx.pendingRegistration.deleteMany({ where: { shadowStudentId: student.id } });
        if (student.studentId || student.email) {
          const identityFilters = [];
          if (student.studentId) identityFilters.push({ roll: student.studentId });
          if (student.email) identityFilters.push({ email: student.email });
          await tx.studentPreApproval.deleteMany({ where: { OR: identityFilters } });
        }
        await tx.attendance.deleteMany({ where: { studentId: student.id } });
        await tx.user.delete({ where: { id: student.id } });
      });
      return NextResponse.json({ success: true, message: 'Invitation deleted' });
    }

    // A completed student may have attendance/history, so preserve the row
    // and deactivate the account instead of physically deleting it here.
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true, message: 'Student deactivated' });
  } catch (error) {
    if (error?.code === 'P2001' || error?.code === 'P2003') {
      return NextResponse.json({ success: false, message: 'Could not delete this pending invitation because it has related records.' }, { status: 409 });
    }
    return errorResponse(error);
  }
}
