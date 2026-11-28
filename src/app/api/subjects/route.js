import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
export const dynamic = 'force-dynamic';
const subjInclude = {
  department: { select: { id: true, name: true, code: true } },
  teacher: { select: { id: true, name: true, email: true, mobile: true, role: true } },
};

// The UI was written for populated MongoDB documents. Prisma exposes scalar
// foreign keys (`id`) and separate relations (`department`, `teacher`), so
// normalize the response to the shape every existing component expects.
function normalizeSubject(subject) {
  return {
    ...subject,
    _id: subject.id,
    departmentId: subject.department
      ? { ...subject.department, _id: subject.department.id }
      : subject.departmentId,
    teacherId: subject.teacher
      ? { ...subject.teacher, _id: subject.teacher.id }
      : subject.teacherId,
  };
}
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const where = {};
    if (auth.user.role === 'teacher') where.teacherId = auth.user.id;
    if (auth.user.role === 'student') {
      where.departmentId = auth.user.departmentId;
      where.semester = auth.user.semester;
      where.section = auth.user.section;
      if (auth.user.shift) where.shift = auth.user.shift;
    }
    if (searchParams.get('departmentId')) where.departmentId = searchParams.get('departmentId');
    if (searchParams.get('shift')) where.shift = searchParams.get('shift');
    if (searchParams.get('semester')) where.semester = parseInt(searchParams.get('semester'));
    if (searchParams.get('section')) where.section = searchParams.get('section');
    if (searchParams.get('isActive') !== null) where.isActive = searchParams.get('isActive') !== 'false';
    // Deleted Subjects are soft-deleted (`isActive: false`) so their Session
    // and Attendance rows survive. Without this default they stayed in every
    // list forever, which made Delete look like it never worked. Anyone who
    // genuinely wants the inactive rows can still ask for them explicitly
    // with `?isActive=false`.
    else where.isActive = true;
    // Re-apply role scope after optional query filters so a Student or
    // scoped admin cannot widen their own dashboard by changing URL params.
    if (auth.user.role === 'student') {
      where.departmentId = auth.user.departmentId;
      where.semester = auth.user.semester;
      where.section = auth.user.section;
      if (auth.user.shift) where.shift = auth.user.shift;
    }
    // Department Admin sees their own Department: Subjects in their own Shift
    // plus not-yet-placed ones (a Subject starts with no Shift and gains one
    // when it is assigned to a Teacher). The other shift's Subjects belong to
    // the other Department Admin.
    if (auth.user.role === 'departmentAdmin') {
      where.departmentId = auth.user.departmentId;
      where.shift = undefined;
      if (auth.user.shift) where.OR = [{ shift: auth.user.shift }, { shift: null }];
    }
    const subjects = await prisma.subject.findMany({ where, include: subjInclude, orderBy: { name: 'asc' } });
    return NextResponse.json({ success: true, subjects: subjects.map(normalizeSubject) });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request) {
  const auth = await requireAuth(request, ['admin', 'departmentAdmin']);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();

    // Validation — Name, Code and Department are required. Semester, Group
    // and Shift are NOT: a Subject is created first (Create Subject) and
    // placed into a slot later, when it is assigned to a Teacher. When a
    // slot part is present it must use the app's vocabulary.
    const name = (body.name || '').trim();
    const code = (body.code || '').trim().toUpperCase();
    const VALID_SECTIONS = ['A', 'B', 'C', 'D'];
    const VALID_SHIFTS = ['1st', '2nd', 'first', 'second'];
    const normalizeShift = s => (s === '1st' ? 'first' : s === '2nd' ? 'second' : s);
    const hasValue = v => v !== undefined && v !== null && v !== '';
    if (!name) return NextResponse.json({ success: false, message: 'Enter Subject Name' }, { status: 400 });
    if (!code) return NextResponse.json({ success: false, message: 'Enter Subject Code' }, { status: 400 });
    if (!body.departmentId) return NextResponse.json({ success: false, message: 'Select a Department' }, { status: 400 });

    let semester = null;
    if (hasValue(body.semester)) {
      semester = parseInt(body.semester, 10);
      if (!Number.isInteger(semester) || semester < 1 || semester > 8) {
        return NextResponse.json({ success: false, message: 'Semester must be 1-8' }, { status: 400 });
      }
    }
    let section = null;
    if (hasValue(body.section)) {
      if (!VALID_SECTIONS.includes(body.section)) {
        return NextResponse.json({ success: false, message: 'Group must be A-D' }, { status: 400 });
      }
      section = body.section;
    }
    let shift = null;
    if (hasValue(body.shift)) {
      if (!VALID_SHIFTS.includes(body.shift)) {
        return NextResponse.json({ success: false, message: 'Select a valid Shift' }, { status: 400 });
      }
      shift = normalizeShift(body.shift);
    }

    const data = {
      name,
      code,
      departmentId: body.departmentId,
      semester,
      section,
      shift,
      teacherId: body.teacherId || null,
    };
    // A Department Admin may only ever create Subjects inside their own
    // Department and Shift — the request body cannot widen that, exactly
    // like the GET scope below and the assign-subject route.
    if (auth.user.role === 'departmentAdmin') {
      if (!auth.user.departmentId) {
        return NextResponse.json({ success: false, message: 'Your account has no Department' }, { status: 400 });
      }
      data.departmentId = auth.user.departmentId;
      if (shift && auth.user.shift) data.shift = auth.user.shift;
    }

    // Duplicate guard: same Code in the same Department and the same slot
    // (null parts match null parts, so two unplaced Subjects with the same
    // Code collide too). Same Code in a different slot is a different Subject.
    const duplicate = await prisma.subject.findFirst({
      where: {
        code: data.code,
        departmentId: data.departmentId,
        semester: data.semester,
        section: data.section,
        shift: data.shift,
      },
      select: { id: true },
    });
    if (duplicate) {
      const slot = data.semester ? `Semester ${data.semester}, Group ${data.section}` : 'this Department';
      return NextResponse.json({
        success: false,
        message: `A Subject with code ${data.code} already exists for ${slot}`,
      }, { status: 400 });
    }

    const subject = await prisma.subject.create({ data, include: subjInclude });
    return NextResponse.json({ success: true, subject: normalizeSubject(subject) }, { status: 201 });
  } catch (error) { return errorResponse(error, 400); }
}
