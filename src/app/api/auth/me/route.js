import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, normalizeDepartmentAdmin, errorResponse } from '@/lib/auth';
import { cacheWrap, cacheKey, cacheDel } from '@/lib/cache';
export const dynamic = 'force-dynamic';

// This runs on every authenticated page load, and its result only changes when
// the account itself is edited. Keyed by user id, so one user can never read
// another's row. Cached for 60s: long enough to absorb a dashboard's several
// dependent requests, short enough that a profile edit shows up quickly.
const TTL = 60;

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  try {
    const { value: safeUser, cached } = await cacheWrap(
      cacheKey('auth', 'me', auth.user.id),
      TTL,
      async () => {
        const user = await prisma.user.findUnique({
          where: { id: auth.user.id },
          include: { department: { select: { id: true, name: true, code: true } }, subject: { select: { id: true, name: true, code: true, semester: true, section: true, shift: true } } },
        });
        if (!user) return null;
        const { password: _, ...rest } = user;
        rest._id = rest.id;
        // Match the login response shape used by the frontend. Without this,
        // /auth/me overwrites the populated department object with the raw
        // department UUID and dashboards display an internal ID to the user.
        rest.departmentId = rest.department
          ? { ...rest.department, _id: rest.department.id }
          : rest.departmentId;
        normalizeDepartmentAdmin(rest);
        return rest;
      }
    );

    if (!safeUser) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });

    // Any edit to this account invalidates its own cache entry immediately
    // rather than waiting out the TTL.
    const response = NextResponse.json({ success: true, user: safeUser });
    response.headers.set('X-Cache', cached ? 'HIT' : 'MISS');
    return response;
  } catch (error) { return errorResponse(error); }
}
