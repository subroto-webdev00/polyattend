import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// DELETE /api/admin/semester-admins/[id]
// A Super Admin can cancel a pending invite or deactivate a Department Admin
// anywhere in the institution, so there is deliberately no Department + Shift
// scope check here (unlike the Department Admin's own route).
export async function DELETE(request, { params }) {
  const auth = await requireAuth(request, ['admin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;

    // It may be a pending invite rather than a real account.
    const invite = await prisma.adminInvite.findUnique({ where: { id } });
    if (invite) {
      if (invite.role !== 'semesterAdmin') {
        return NextResponse.json({ success: false, message: 'Not a Department Admin invite' }, { status: 400 });
      }
      await prisma.adminInvite.delete({ where: { id } });
      return NextResponse.json({ success: true, message: 'Invite cancelled' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    }
    if (user.role !== 'semesterAdmin') {
      return NextResponse.json({ success: false, message: 'Not a Department Admin' }, { status: 400 });
    }

    // No "last admin" guard is needed here: a Department Admin can never
    // create another Department Admin outside their own department, and the
    // Super Admin is above this role entirely — deactivating every Semester
    // Admin would still leave the Super Admin able to invite new ones.
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true, message: 'Department Admin deactivated' });
  } catch (error) { return errorResponse(error); }
}
