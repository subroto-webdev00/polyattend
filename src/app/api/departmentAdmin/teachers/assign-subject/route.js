import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SECTIONS = ['A', 'B', 'C', 'D'];
const VALID_SHIFTS = ['1st', '2nd', 'first', 'second'];

const normalizeShift = shift => (shift === '1st' ? 'first' : shift === '2nd' ? 'second' : shift);

// POST /api/departmentAdmin/teachers/assign-subject
// A Department Admin assigns a Subject to a Teacher in their own Department.
//
// Two rules keep this inside the caller's Department no matter what the
// request body says:
//   1. the Department is read from the caller's account, never from the body;
//   2. the target Teacher must already belong to that same Department.
// Without both, a Department Admin could pass someone else's teacherId and
// create a Subject in a Department they have no authority over.
export async function POST(request) {
  const auth = await requireAuth(request, ['departmentAdmin']);
  if (auth.error) return auth.error;
  try {
    const { teacherId, subjectId, subjectName, subjectCode, semester, section, shift } = await request.json();

    const departmentId = auth.user.departmentId;
    if (!departmentId) {
      return NextResponse.json({
        success: false,
        message: 'Your account has no Department, so you cannot assign Subjects.',
      }, { status: 403 });
    }

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
    if (teacher.departmentId !== departmentId) {
      return NextResponse.json({
        success: false,
        message: 'This Teacher belongs to another Department',
      }, { status: 403 });
    }
    // Shift guard: a Department Admin only manages Teachers of their own shift.
    if (auth.user.shift && teacher.shift && teacher.shift !== auth.user.shift) {
      return NextResponse.json({
        success: false,
        message: 'This Teacher belongs to the other shift',
      }, { status: 403 });
    }
    if (!teacher.isActive) {
      return NextResponse.json({
        success: false,
        message: 'This Teacher is deactivated. Activate the account before assigning a Subject.',
      }, { status: 400 });
    }

    // A Teacher is not asked for a shift anywhere now, so this is where they
    // get one. Reuse theirs when they already have it; otherwise the Semester
    // Admin picks, because defaulting to Morning would file the Subject into
    // the wrong shift with no way for anyone to notice.
    const requestedShift = teacher.shift || shift || auth.user.shift;
    if (!VALID_SHIFTS.includes(requestedShift)) {
      return NextResponse.json({ success: false, message: 'Select a Shift' }, { status: 400 });
    }
    const normalizedShift = normalizeShift(requestedShift);
    // A Department Admin can only file Subjects into their own shift.
    if (auth.user.shift && normalizedShift !== auth.user.shift) {
      return NextResponse.json({
        success: false,
        message: 'You can only assign Subjects in your own shift',
      }, { status: 403 });
    }

    // Resolve which Subject row this assignment writes to:
    //   1. the Subject the UI picked (subjectId) — must be in this Department;
    //   2. else a Subject already in exactly this slot (code+dept+semester+
    //      group+shift);
    //   3. else an UNPLACED Subject (created via Create Subject, same Code,
    //      no Semester yet) — assigning it fills its slot in;
    //   4. else a new row is created below.
    // Writing to the unplaced row instead of creating a second one keeps
    // "one row per Subject" true after the Admin creates it up front.
    let target = null;
    if (subjectId) {
      target = await prisma.subject.findFirst({
        where: { id: subjectId, departmentId },
        select: { id: true, code: true, teacherId: true },
      });
      if (!target) {
        return NextResponse.json({ success: false, message: 'Subject not found in your Department' }, { status: 404 });
      }
    }
    if (!target) {
      target = await prisma.subject.findFirst({
        where: { code: normalizedCode, departmentId, semester: semesterNum, section, shift: normalizedShift },
        select: { id: true, code: true, teacherId: true },
      });
    }
    if (!target) {
      target = await prisma.subject.findFirst({
        where: { code: normalizedCode, departmentId, semester: null },
        select: { id: true, code: true, teacherId: true },
      });
    }
    if (target?.teacherId && target.teacherId !== teacher.id) {
      const holder = await prisma.user.findUnique({
        where: { id: target.teacherId },
        select: { name: true },
      });
      return NextResponse.json({
        success: false,
        message: `${holder?.name || 'Another Teacher'} is already assigned to ${normalizedName} (${normalizedCode}) — Group ${section}, Sem ${semesterNum}`,
      }, { status: 400 });
    }
    // A different Subject already occupies this exact slot — one Teacher per
    // slot, so the picked Subject cannot be filed on top of it.
    if (target) {
      const occupant = await prisma.subject.findFirst({
        where: {
          code: normalizedCode,
          departmentId,
          semester: semesterNum,
          section,
          shift: normalizedShift,
          id: { not: target.id },
        },
        select: { id: true, teacherId: true },
      });
      if (occupant?.teacherId && occupant.teacherId !== teacher.id) {
        const holder = await prisma.user.findUnique({
          where: { id: occupant.teacherId },
          select: { name: true },
        });
        return NextResponse.json({
          success: false,
          message: `${holder?.name || 'Another Teacher'} is already assigned to ${normalizedName} (${normalizedCode}) — Group ${section}, Sem ${semesterNum}`,
        }, { status: 400 });
      }
    }

    const subject = target
      ? await prisma.subject.update({
          where: { id: target.id },
          data: {
            name: normalizedName,
            code: normalizedCode,
            semester: semesterNum,
            section,
            shift: normalizedShift,
            teacherId: teacher.id,
            isActive: true,
          },
        })
      : await prisma.subject.create({
          data: {
            name: normalizedName,
            code: normalizedCode,
            departmentId,
            semester: semesterNum,
            section,
            shift: normalizedShift,
            teacherId: teacher.id,
          },
        });

    // First Subject for a Teacher who has no shift yet: adopt it now so later
    // Subjects reuse it instead of asking again.
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
