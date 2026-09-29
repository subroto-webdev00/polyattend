import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function GET(request, { params }) {
  const auth = await requireAuth(request, ['teacher','admin','departmentAdmin']);
  if (auth.error) return auth.error;
  try {
    const { sessionId } = await params;
    const attendance = await prisma.attendance.findMany({
      where: { sessionId },
      include: { student: { select: { id:true, name:true, studentId:true, section:true } } },
      orderBy: { student: { name: 'asc' } }
    });
    const normalized = attendance.map(record => ({
      ...record,
      _id: record.id,
      studentId: record.student
        ? { ...record.student, _id: record.student.id }
        : record.studentId,
    }));
    return NextResponse.json({ success: true, count: normalized.length, attendance: normalized });
  } catch (error) { return errorResponse(error); }
}
