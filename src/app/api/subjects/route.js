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
    // Re-apply role scope after optional query filters so a Student or
    // scoped admin cannot widen their own dashboard by changing URL params.
    if (auth.user.role === 'student') {
      where.departmentId = auth.user.departmentId;
      where.semester = auth.user.semester;
      where.section = auth.user.section;
      if (auth.user.shift) where.shift = auth.user.shift;
    }
    // Department Admin is department-wide: own Department + Shift, every
    // Semester. The old `semester: { in: auth.user.semesters }` narrowing
    // belonged to the old role split.
    if (auth.user.role === 'departmentAdmin') { where.departmentId = auth.user.departmentId; where.shift = auth.user.shift; }
    const subjects = await prisma.subject.findMany({ where, include: subjInclude, orderBy: { name: 'asc' } });
    return NextResponse.json({ success: true, subjects: subjects.map(normalizeSubject) });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request) {
  const auth = await requireAuth(request, ['admin', 'departmentAdmin']);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();
    const subject = await prisma.subject.create({ data: { name: body.name, code: body.code, departmentId: body.departmentId, semester: parseInt(body.semester), section: body.section, shift: body.shift, teacherId: body.teacherId || null }, include: subjInclude });
    return NextResponse.json({ success: true, subject: normalizeSubject(subject) }, { status: 201 });
  } catch (error) { return errorResponse(error, 400); }
}
