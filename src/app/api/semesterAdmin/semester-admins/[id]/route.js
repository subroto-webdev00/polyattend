import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function DELETE(request, { params }) {
  const auth = await requireAuth(request, ['semesterAdmin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const invite = await prisma.adminInvite.findUnique({ where: { id } });
    if (invite) {
      if (invite.departmentId !== auth.user.departmentId || invite.shift !== auth.user.shift)
        return NextResponse.json({ success: false, message: 'Outside your scope' }, { status: 403 });
      await prisma.adminInvite.delete({ where: { id } });
      return NextResponse.json({ success: true, message: 'Invite cancelled' });
    }
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    if (user.departmentId !== auth.user.departmentId || user.shift !== auth.user.shift)
      return NextResponse.json({ success: false, message: 'Outside your scope' }, { status: 403 });
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true, message: 'Semester Admin deactivated' });
  } catch (error) { return errorResponse(error); }
}
