import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

// Serves uploaded notice images. Files written to /public after `next start`
// are not reliably served by Next's static handler in production, so they are
// streamed from here instead.
export async function GET(_request, { params }) {
  const { name } = await params;
  if (!/^notice_[\w-]+\.(jpg|png|webp|gif)$/.test(name || '')) {
    return new NextResponse('Not found', { status: 404 });
  }
  const full = path.join(process.cwd(), 'public', 'uploads', 'notices', name);
  if (!fs.existsSync(full)) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(fs.readFileSync(full), {
    headers: {
      'Content-Type': TYPES[name.split('.').pop()],
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
