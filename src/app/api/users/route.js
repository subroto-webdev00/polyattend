import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
import { cacheWrap, cacheKey } from '@/lib/cache';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['admin', 'departmentAdmin'];
const USER_ROLES = ['admin', 'departmentAdmin', 'teacher', 'student'];

// Short, because a wrong count on a dashboard is more alarming than a slow
// one. Every write that changes a user count clears this namespace.
const COUNT_TTL = 20;

export async function GET(request) {
  const auth = await requireAuth(request, ['admin', 'departmentAdmin', 'teacher']);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const where = {};
    const requestedRole = searchParams.get('role');

    // `allAdmins` is a UI-level group, not a database Role enum value. Keep
    // `role=admin` exact for existing consumers while allowing the Users page
    // to show Super Admin + Department Admin together.
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

    if (auth.user.role === 'departmentAdmin') {
      // Department-wide: a Department Admin now sees their entire department
      // + shift, not just the semesters on their own account. The old
      // `where.semester = { in: auth.user.semesters }` restriction came from
      // the old role split and no longer applies.
      where.departmentId = auth.user.departmentId;
      where.shift = auth.user.shift;
    }

    // Dashboard callers only need the matching number, not full user
    // documents. Search and role-group filters must still affect the count.
    if (searchParams.get('countOnly') === 'true') {
      // Four dashboards each fire two or three of these on every load, and a
      // Student/Teacher count only moves when someone is added, removed or
      // promoted. Cached briefly so a dashboard's parallel calls collapse into
      // one query. The key carries every filter that shaped `where`, plus the
      // caller's role and department, so a Department Admin's count can never
      // be served to a Super Admin.
      const cacheScope = [
        'count',
        auth.user.role,
        auth.user.departmentId || '-',
        auth.user.shift || '-',
        requestedRole || '-',
        searchParams.get('departmentId') || '-',
        searchParams.get('shift') || '-',
        searchParams.get('semester') || '-',
        searchParams.get('section') || '-',
        search || '-',
        searchParams.get('since') || '-',
      ].join('|');

      const { value: counted, cached } = await cacheWrap(
        cacheKey('users', cacheScope),
        COUNT_TTL,
        async () => {
          const count = await prisma.user.count({ where });

          // `since=<ISO date>` counts only users created on or after that date,
          // so the dashboard can show a real "from last month" delta instead of
          // inventing a percentage.
          const sinceRaw = searchParams.get('since');
          if (sinceRaw) {
            const since = new Date(sinceRaw);
            if (!Number.isNaN(since.getTime())) {
              const newCount = await prisma.user.count({
                where: { ...where, createdAt: { gte: since } },
              });
              return { count, total: count, newCount };
            }
          }

          return { count, total: count };
        }
      );

      const response = NextResponse.json({ success: true, ...counted });
      response.headers.set('X-Cache', cached ? 'HIT' : 'MISS');
      return response;
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
