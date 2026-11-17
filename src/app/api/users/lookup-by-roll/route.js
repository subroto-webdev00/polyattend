import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const auth = await requireAuth(request, ['teacher', 'admin', 'departmentAdmin']);
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const roll = searchParams.get('roll')?.trim();
    if (!roll) return NextResponse.json({ success: false, message: 'roll is required' }, { status: 400 });
    const student = await prisma.user.findFirst({
      // Pending invites are findable too: they sit in the class and carry an
      // attendance record, so a roll-number lookup that silently 404'd them
      // made their profile unreachable from Search Profile.
      where: { studentId: roll, role: 'student', isActive: true },
      select: {
        id: true, name: true, studentId: true, email: true, mobile: true, semester: true,
        section: true, shift: true, departmentId: true, departmentCode: true,
        department: { select: { id: true, name: true, code: true } },
      },
    });
    if (!student) return NextResponse.json({ success: false, message: 'Student not found' }, { status: 404 });
    const normalizedStudent = {
      ...student,
      _id: student.id,
      departmentId: student.department
        ? { ...student.department, _id: student.department.id }
        : student.departmentId,
    };
    return NextResponse.json({ success: true, student: normalizedStudent });
  } catch (error) { return errorResponse(error); }
}
