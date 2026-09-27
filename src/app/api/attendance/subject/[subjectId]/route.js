import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function GET(request, { params }) {
  const auth = await requireAuth(request, ['teacher','admin','semesterAdmin']);
  if (auth.error) return auth.error;
  try {
    const { subjectId } = await params;
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const dateFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    const records = await prisma.attendance.findMany({
      where: { subjectId, ...(from||to ? { date: dateFilter } : {}) },
      include: { student: { select: { id:true, name:true, studentId:true, section:true } }, session: { select: { id:true, date:true } } },
      orderBy: { date: 'desc' }
    });
    return NextResponse.json({ success: true, count: records.length, records });
  } catch (error) { return errorResponse(error); }
}
