import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function DELETE(request, { params }) {
  const auth = await requireAuth(request, ['admin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    // Check if it's a pending invite or real user
    const invite = await prisma.adminInvite.findUnique({ where: { id } });
    if (invite) { await prisma.adminInvite.delete({ where: { id } }); return NextResponse.json({ success: true, message: 'Invite cancelled' }); }
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true, message: 'Department Admin deactivated' });
  } catch (error) { return errorResponse(error); }
}
