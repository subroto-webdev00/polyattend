import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Demote selected students one semester at a time. The destination is always
// derived on the server so a client cannot move a student to Semester 0 or
// an arbitrary/unauthorised semester.
export async function POST(request) {
  const auth = await requireAuth(request, ['semesterAdmin']);
  if (auth.error) return auth.error;

  try {
    const { studentIds, fromSemester } = await request.json();

    if (!Array.isArray(studentIds) || !studentIds.length) {
      return NextResponse.json({ success: false, message: 'Select at least one Student' }, { status: 400 });
    }

    const validStudentIds = [...new Set(
      studentIds
        .filter(id => typeof id === 'string' && id.trim())
        .map(id => id.trim()),
    )];
    if (!validStudentIds.length) {
      return NextResponse.json({ success: false, message: 'Select at least one valid Student' }, { status: 400 });
    }

    const sourceSemester = Number(fromSemester);
    if (!Number.isInteger(sourceSemester) || sourceSemester < 2 || sourceSemester > 8) {
      return NextResponse.json({ success: false, message: 'Select a Semester between 2 and 8 to demote from' }, { status: 400 });
    }

    const allowedSemesters = (auth.user.semesters?.length
      ? auth.user.semesters
      : auth.user.semester != null ? [auth.user.semester] : []
    ).map(Number);
    if (!allowedSemesters.includes(sourceSemester)) {
      return NextResponse.json({ success: false, message: 'That Semester is outside your scope' }, { status: 403 });
    }

    const eligibleWhere = {
      id: { in: validStudentIds },
      role: 'student',
      departmentId: auth.user.departmentId,
      shift: auth.user.shift,
      semester: sourceSemester,
      isActive: true,
      registered: true,
    };

    const result = await prisma.$transaction(async (tx) => {
      // Re-check all IDs at write time. A roster can become stale while the
      // confirmation modal is open, and stale IDs must never be moved.
      const eligibleStudents = await tx.user.findMany({
        where: eligibleWhere,
        select: { id: true, section: true },
      });

      if (eligibleStudents.length !== validStudentIds.length) {
        return { stale: true, eligibleCount: eligibleStudents.length };
      }

      // Do not move a student while their class has a live attendance
      // session. Otherwise a teacher can retain a stale roster and submit
      // attendance for the previous semester after the movement.
      const sections = [...new Set(
        eligibleStudents.map(student => student.section).filter(Boolean),
      )];
      if (sections.length) {
        const activeSession = await tx.session.findFirst({
          where: {
            status: 'active',
            departmentId: auth.user.departmentId,
            semester: sourceSemester,
            section: { in: sections },
            OR: [
              { shift: auth.user.shift },
              { shift: null },
            ],
          },
          select: { id: true },
        });
        if (activeSession) return { activeSession: true };
      }

      const updated = await tx.user.updateMany({
        where: eligibleWhere,
        data: { semester: sourceSemester - 1 },
      });

      return { count: updated.count };
    });

    if (result.stale) {
      return NextResponse.json({
        success: false,
        message: `Some selected students are no longer eligible in Semester ${sourceSemester}. Refresh the list and try again.`,
        requestedCount: validStudentIds.length,
        eligibleCount: result.eligibleCount,
      }, { status: 409 });
    }

    if (result.activeSession) {
      return NextResponse.json({
        success: false,
        message: `Cannot demote while an active class session is running in Semester ${sourceSemester}. End the session first.`,
      }, { status: 409 });
    }

    if (result.count !== validStudentIds.length) {
      return NextResponse.json({
        success: false,
        message: 'Some selected students could not be demoted. Refresh the list and try again.',
        requestedCount: validStudentIds.length,
        demotedCount: result.count,
      }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      message: `${result.count} Student(s) demoted from Semester ${sourceSemester} to Semester ${sourceSemester - 1}`,
      demotedCount: result.count,
    }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
