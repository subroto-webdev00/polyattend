import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const auth = await requireAuth(request, ['teacher', 'admin', 'departmentAdmin']);
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const semester = searchParams.get('semester');
    const section = searchParams.get('section');
    const shift = searchParams.get('shift');
    if (!departmentId || !semester || !section) return NextResponse.json({ success: false, message: 'departmentId, semester and section required' }, { status: 400 });
    // Invited (pending) students belong to this class too, so they are listed
    // here like everyone else — only cancelled invites / deactivated accounts
    // (isActive: false) are left out.
    const where = { role: 'student', departmentId, semester: parseInt(semester), section, isActive: true };
    // The DB stores the shift as `1st`/`2nd` while the Prisma enum is
    // `first`/`second`. A caller passing the raw database value used to hit
    // "Invalid value for argument `shift`" and 500 the whole roster — accept
    // both spellings, same as the assign-subject routes already do.
    const normalizeShift = s => (s === '1st' ? 'first' : s === '2nd' ? 'second' : s);
    if (shift) where.shift = normalizeShift(shift);
    const students = await prisma.user.findMany({ where, select: { id: true, name: true, studentId: true, section: true, shift: true }, orderBy: { name: 'asc' } });
    return NextResponse.json({ success: true, students });
  } catch (error) { return errorResponse(error); }
}
