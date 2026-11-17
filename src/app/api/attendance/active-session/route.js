import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
import { normalizeSession } from '@/lib/sessionShape';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const auth = await requireAuth(request, ['student']);
  if (auth.error) return auth.error;
  try {
    const student = auth.user;
    if (!student.departmentId || student.semester == null || !student.section) return NextResponse.json({ success: true, session: null, alreadyMarked: false });
    const where = { status: 'active', departmentId: student.departmentId, semester: student.semester, section: student.section };
    if (student.shift) where.shift = student.shift;
    const session = await prisma.session.findFirst({
      where,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, name: true } },
        department: { select: { id: true, name: true, code: true } },
      },
      orderBy: { startTime: 'desc' },
    });
    if (!session) return NextResponse.json({ success: true, session: null, alreadyMarked: false });
    const existing = await prisma.attendance.findFirst({ where: { sessionId: session.id, studentId: student.id } });
    const alreadyMarked = !!existing && existing.status === 'present';
    // The dashboard component reads `session._id` (to post the self-mark)
    // and `subjectId`/`teacherId`/`departmentId` as populated objects — a raw
    // Prisma row made the button return early without doing anything and
    // rendered "Unknown Subject" + a UUID subtitle. See lib/sessionShape.js.
    return NextResponse.json({ success: true, session: normalizeSession(session), alreadyMarked, markedBy: existing?.markedBy || null });
  } catch (error) { return errorResponse(error); }
}
