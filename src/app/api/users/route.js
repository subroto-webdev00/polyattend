import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['admin', 'semesterAdmin'];
const USER_ROLES = ['admin', 'semesterAdmin', 'teacher', 'student'];

export async function GET(request) {
  const auth = await requireAuth(request, ['admin', 'semesterAdmin', 'teacher']);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const where = {};
    const requestedRole = searchParams.get('role');

    // `allAdmins` is a UI-level group, not a database Role enum value. Keep
    // `role=admin` exact for existing consumers while allowing the Users page
    // to show Super Admin + Semester Admin together.
    if (requestedRole === 'allAdmins') {
      where.role = { in: ADMIN_ROLES };
    } else if (requestedRole) {
      if (!USER_ROLES.includes(requestedRole)) {
        return NextResponse.json({ success: false, message: 'Select a valid role' }, { status: 400 });
      }
      where.role = requestedRole;
    }

    if (searchParams.get('departmentId')) where.departmentId = searchParams.get('departmentId');
    if (searchParams.get('shift')) where.shift = searchParams.get('shift');
    if (searchParams.get('semester')) where.semester = parseInt(searchParams.get('semester'), 10);
    if (searchParams.get('section')) where.section = searchParams.get('section');

    const search = searchParams.get('search')?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { studentId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (auth.user.role === 'semesterAdmin') {
      // Department-wide: a Semester Admin now sees their entire department
      // + shift, not just the semesters on their own account. The old
      // `where.semester = { in: auth.user.semesters }` restriction came from
      // the old role split and no longer applies.
      where.departmentId = auth.user.departmentId;
      where.shift = auth.user.shift;
    }

    // Dashboard callers only need the matching number, not full user
    // documents. Search and role-group filters must still affect the count.
    if (searchParams.get('countOnly') === 'true') {
      const count = await prisma.user.count({ where });
      return NextResponse.json({ success: true, count, total: count });
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const parsedLimit = parseInt(searchParams.get('limit') || '', 10);
    const limit = Number.isInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 100)
      : null;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, name: true, email: true, role: true, shift: true,
          departmentId: true, departmentCode: true, semesters: true,
          semester: true, section: true, studentId: true, mobile: true,
          isActive: true, isVerified: true, registered: true, createdAt: true,
          department: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...(limit ? { skip: (page - 1) * limit, take: limit } : {}),
      }),
      prisma.user.count({ where }),
    ]);

    // Keep the legacy `_id` alias used by the existing frontend while Prisma
    // continues to expose the canonical `id` field.
    const normalizedUsers = users.map(user => ({
      ...user,
      _id: user.id,
      departmentId: user.department
        ? { ...user.department, _id: user.department.id }
        : user.departmentId,
    }));

    return NextResponse.json({
      success: true,
      count: normalizedUsers.length,
      total,
      totalPages: limit ? Math.max(1, Math.ceil(total / limit)) : 1,
      page,
      users: normalizedUsers,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
