import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const auth = await requireAuth(request, ['teacher','admin','semesterAdmin']);
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const teacherId = auth.user.role === 'teacher' ? auth.user.id : searchParams.get('teacherId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (!teacherId) return NextResponse.json({ success: false, message: 'teacherId required' }, { status: 400 });
    const dateFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    const sessions = await prisma.session.findMany({
      where: { teacherId, ...(from||to ? { date: dateFilter } : {}) },
      include: { subject: { select: { id:true, name:true, code:true } }, department: { select: { id:true, name:true, code:true } } },
      orderBy: { date: 'desc' }
    });
    return NextResponse.json({ success: true, count: sessions.length, sessions });
  } catch (error) { return errorResponse(error); }
}
