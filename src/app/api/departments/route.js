import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
import { cacheWrap, cacheKey, cacheDel } from '@/lib/cache';
export const dynamic = 'force-dynamic';

// The Department list is read by nearly every dropdown in the app and changes
// perhaps once a term, so it is the cheapest useful thing to cache.
const TTL = 600;

export async function GET(request) {
  const auth = await requireAuth(request, ['admin']);
  if (auth.error) return auth.error;
  try {
    const { value: departments, cached } = await cacheWrap(cacheKey('departments'), TTL, () =>
      prisma.department.findMany({ orderBy: { name: 'asc' } })
    );
    const response = NextResponse.json({ success: true, departments });
    response.headers.set('X-Cache', cached ? 'HIT' : 'MISS');
    return response;
  } catch (error) { return errorResponse(error); }
}
export async function POST(request) {
  const auth = await requireAuth(request, ['admin']);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();
    const dept = await prisma.department.create({ data: { name: body.name, code: body.code?.toUpperCase(), technologyCode: body.technologyCode || body.technology_code || '', description: body.description || null } });
    await cacheDel(cacheKey('departments'));
    return NextResponse.json({ success: true, department: dept }, { status: 201 });
  } catch (error) { return errorResponse(error, 400); }
}
