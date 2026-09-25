import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const auth = await requireAuth(request, ['admin', 'subAdmin', 'semesterAdmin']);
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || searchParams.get('name'))?.trim();
    const requestedRole = searchParams.get('role');
    const staffRoles = ['teacher', 'subAdmin', 'semesterAdmin', 'admin'];
    const roleFilter = staffRoles.includes(requestedRole)
      ? requestedRole
      : { in: staffRoles };
    if (!q) return NextResponse.json({ success: false, message: 'q is required' }, { status: 400 });

    const where = {
      role: roleFilter,
      isActive: true,
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    };

    // Non-admin users may only search staff inside their own scope.
    if (auth.user.role !== 'admin') {
      where.departmentId = auth.user.departmentId;
      where.shift = auth.user.shift;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, role: true, mobile: true,
        departmentId: true, departmentCode: true, shift: true,
        department: { select: { id: true, name: true, code: true } },
      },
      take: 10,
    });

    const staff = users.map(user => ({
      ...user,
      _id: user.id,
      departmentId: user.department || user.departmentId,
    }));
    return NextResponse.json({ success: true, staff });
  } catch (error) { return errorResponse(error); }
}
