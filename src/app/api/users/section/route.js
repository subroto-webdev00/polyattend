import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const auth = await requireAuth(request, ['teacher', 'admin', 'semesterAdmin']);
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const semester = searchParams.get('semester');
    const section = searchParams.get('section');
    const shift = searchParams.get('shift');
    if (!departmentId || !semester || !section) return NextResponse.json({ success: false, message: 'departmentId, semester and section required' }, { status: 400 });
    const where = { role: 'student', departmentId, semester: parseInt(semester), section, isActive: true, registered: true };
    if (shift) where.shift = shift;
    const students = await prisma.user.findMany({ where, select: { id: true, name: true, studentId: true, section: true, shift: true }, orderBy: { name: 'asc' } });
    return NextResponse.json({ success: true, students });
  } catch (error) { return errorResponse(error); }
}
