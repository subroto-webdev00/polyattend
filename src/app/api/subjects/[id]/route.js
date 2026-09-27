import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function PUT(request, { params }) {
  const auth = await requireAuth(request, ['admin', 'semesterAdmin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const body = await request.json();
    const subject = await prisma.subject.update({ where: { id }, data: { name: body.name, code: body.code, teacherId: body.teacherId || null, isActive: body.isActive } });
    return NextResponse.json({ success: true, subject });
  } catch (error) { return errorResponse(error, 400); }
}
export async function DELETE(request, { params }) {
  const auth = await requireAuth(request, ['admin', 'semesterAdmin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    await prisma.subject.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true, message: 'Subject deactivated' });
  } catch (error) { return errorResponse(error); }
}
