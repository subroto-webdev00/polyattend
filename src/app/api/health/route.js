import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { cacheBackend, redisEnabled } from '@/lib/cache';

export const dynamic = 'force-dynamic';

// GET /api/health
// Liveness plus which cache backend is active, so it is obvious from a deploy
// whether UPSTASH_REDIS_REST_URL/TOKEN actually took effect — a mis-spelled env
// var silently falls back to in-memory and that is otherwise invisible.
export async function GET() {
  const started = Date.now();

  let database = 'down';
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = 'up';
  } catch {
    database = 'down';
  }

  return NextResponse.json({
    success: database === 'up',
    database,
    databaseMs: Date.now() - started,
    cache: {
      backend: cacheBackend(),
      redisConfigured: redisEnabled,
    },
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  }, { status: database === 'up' ? 200 : 503 });
}
