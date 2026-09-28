import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SECTIONS = ['A', 'B', 'C', 'D'];
const VALID_SHIFTS = ['1st', '2nd', 'first', 'second'];

const normalizeShift = shift => (shift === '1st' ? 'first' : shift === '2nd' ? 'second' : shift);

// POST /api/admin/teachers/assign-subject
// Attach a Subject to a Teacher who already has an account.
//
// This is a separate step from inviting a Teacher because a Subject is not a
// property of a person: it belongs to one Department, one Semester, one Group
// and one Shift. Collecting those on a "create this person" form would force
// placeholder values, so the Admin picks them here, once the Teacher exists.
//
// The Department always comes from the Teacher's own account rather than the
// request body — a Teacher can only teach inside the Department they were
// invited to, and trusting a client-supplied departmentId would let a request
// silently re-scope an account.
export async function POST(request) {
  const auth = await requireAuth(request, ['admin']);
  if (auth.error) return auth.error;
  try {
    const { teacherId, subjectName, subjectCode, semester, section, shift } = await request.json();

    if (!teacherId) {
      return NextResponse.json({ success: false, message: 'Select a Teacher' }, { status: 400 });
    }

    const normalizedName = String(subjectName || '').trim();
    const normalizedCode = String(subjectCode || '').trim().toUpperCase();
    if (!normalizedName || !normalizedCode) {
      return NextResponse.json({ success: false, message: 'Enter Subject Name and Subject Code' }, { status: 400 });
    }

    if (!SECTIONS.includes(section)) {
      return NextResponse.json({ success: false, message: 'Select a valid Group (A-D)' }, { status: 400 });
    }

    const semesterNum = Number(semester);
    if (!Number.isInteger(semesterNum) || semesterNum < 1 || semesterNum > 8) {
      return NextResponse.json({ success: false, message: 'Select a valid Semester' }, { status: 400 });
    }

    const teacher = await prisma.user.findUnique({
      where: { id: teacherId },
      select: { id: true, name: true, role: true, departmentId: true, shift: true, isActive: true },
    });
    if (!teacher || teacher.role !== 'teacher') {
      return NextResponse.json({ success: false, message: 'Teacher not found' }, { status: 404 });
    }
    if (!teacher.isActive) {
      return NextResponse.json({
        success: false,
        message: 'This Teacher is deactivated. Activate the account before assigning a Subject.',
      }, { status: 400 });
    }
    if (!teacher.departmentId) {
      return NextResponse.json({
        success: false,
        message: 'This Teacher has no Department. Re-invite them with a Department first.',
      }, { status: 400 });
    }

    // The invite no longer collects a Shift, so this is the only place a
    // Teacher gets one. Reuse theirs when they already have it (they may
    // teach several Subjects in the same shift), otherwise the admin must
    // pick — silently defaulting to Morning would quietly misfile the
    // Subject into the wrong shift.
    const requestedShift = shift || teacher.shift;
    if (!VALID_SHIFTS.includes(requestedShift)) {
      return NextResponse.json({ success: false, message: 'Select a Shift' }, { status: 400 });
    }
    const normalizedShift = normalizeShift(requestedShift);

    // A Subject+Group slot can only ever have one Teacher. A Subject left
    // behind by a deleted Teacher is free to be reassigned.
    const existingSubject = await prisma.subject.findFirst({
      where: {
        code: normalizedCode,
        departmentId: teacher.departmentId,
        semester: semesterNum,
        section,
        shift: normalizedShift,
      },
      select: { id: true, teacherId: true, name: true },
    });
    if (existingSubject?.teacherId && existingSubject.teacherId !== teacher.id) {
      const holder = await prisma.user.findUnique({
        where: { id: existingSubject.teacherId },
        select: { name: true },
      });
      return NextResponse.json({
        success: false,
        message: `${holder?.name || 'Another Teacher'} is already assigned to ${normalizedName} (${normalizedCode}) — Group ${section}, Sem ${semesterNum}`,
      }, { status: 400 });
    }

    const subject = existingSubject
      ? await prisma.subject.update({
          where: { id: existingSubject.id },
          data: { name: normalizedName, teacherId: teacher.id, isActive: true },
        })
      : await prisma.subject.create({
          data: {
            name: normalizedName,
            code: normalizedCode,
            departmentId: teacher.departmentId,
            semester: semesterNum,
            section,
            shift: normalizedShift,
            teacherId: teacher.id,
          },
        });

    // First Subject for a Teacher who was invited without a shift: adopt
    // theirs now, so later Subjects reuse it instead of asking again.
    if (!teacher.shift) {
      await prisma.user.update({ where: { id: teacher.id }, data: { shift: normalizedShift } });
    }

    return NextResponse.json({
      success: true,
      message: `${normalizedName} (${normalizedCode}) assigned to ${teacher.name || 'the Teacher'}`,
      subject: { ...subject, _id: subject.id },
    }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
