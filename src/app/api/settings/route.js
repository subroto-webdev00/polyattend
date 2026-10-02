import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
import { cacheWrap, cacheKey, cacheDel } from '@/lib/cache';
export const dynamic = 'force-dynamic';

// One settings row for the whole institution, read by every Student dashboard
// and every report page. It changes when an Admin changes the threshold, so
// PUT drops the entry rather than waiting out the TTL.
const TTL = 300;

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  try {
    const { value, cached } = await cacheWrap(cacheKey('settings'), TTL, async () => {
      const settings = await prisma.settings.findFirst({ where: { key: 'global' } });
      return settings || { attendanceThreshold: 70 };
    });
    const response = NextResponse.json({ success: true, settings: value });
    response.headers.set('X-Cache', cached ? 'HIT' : 'MISS');
    return response;
  } catch (error) { return errorResponse(error); }
}
export async function PUT(request) {
  const auth = await requireAuth(request, ['admin']);
  if (auth.error) return auth.error;
  try {
    const { attendanceThreshold } = await request.json();
    const settings = await prisma.settings.upsert({ where: { key: 'global' }, update: { attendanceThreshold }, create: { key: 'global', attendanceThreshold } });
    // The new threshold has to be visible to the next page load, not in 5
    // minutes.
    await cacheDel(cacheKey('settings'));
    return NextResponse.json({ success: true, settings });
  } catch (error) { return errorResponse(error); }
}
