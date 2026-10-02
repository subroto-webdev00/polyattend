import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
import { cacheDelPrefix } from '@/lib/cache';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  const auth = await requireAuth(request, ['departmentAdmin']);
  if (auth.error) return auth.error;
  try {
    const { studentIds, fromSemester } = await request.json();
    if (!Array.isArray(studentIds) || !studentIds.length) return NextResponse.json({ success: false, message: 'Select at least one Student' }, { status: 400 });
    // The UI normally sends UUIDs, but never pass null/undefined values to
    // Prisma's `in` filter. This also gives a clear 400 response if a stale
    // client sends the old `_id`-only payload.
    const validStudentIds = [...new Set(studentIds.filter(id => typeof id === 'string' && id.trim()))];
    if (!validStudentIds.length) return NextResponse.json({ success: false, message: 'Select at least one valid Student' }, { status: 400 });
    const allowedSemesters = (auth.user.semesters || []).map(Number);
    const currentSemester = fromSemester!=null ? parseInt(fromSemester, 10) : (allowedSemesters.length===1 ? allowedSemesters[0] : null);
    if (currentSemester==null || !Number.isFinite(currentSemester)) return NextResponse.json({ success: false, message: 'Select which Semester to promote from' }, { status: 400 });
    if (!allowedSemesters.includes(Number(currentSemester))) return NextResponse.json({ success: false, message: 'That Semester is outside your scope' }, { status: 403 });
    if (currentSemester >= 8) return NextResponse.json({ success: false, message: 'Cannot promote from Semester 8' }, { status: 400 });
    const result = await prisma.user.updateMany({ where: { id: { in: validStudentIds }, role: 'student', departmentId: auth.user.departmentId, shift: auth.user.shift, semester: currentSemester }, data: { semester: currentSemester + 1 } });
    // Promotion moves students between the two cached semester rosters and the
    // semester coverage counters on the Department Admin dashboard.
    if (result.count) {
      await Promise.all([cacheDelPrefix('deptadmin'), cacheDelPrefix('users')]);
    }
    return NextResponse.json({ success: true, message: `${result.count} Student(s) promoted to Semester ${currentSemester + 1}`, promotedCount: result.count });
  } catch (error) { return errorResponse(error); }
}
