import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/departmentAdmin/teachers
// Teacher Management list for a Department Admin.
//
// There is deliberately NO POST here. Creating a Teacher is a Super Admin
// action, so this route is read-only apart from /assign-subject.
//
// The list is scoped automatically to the caller's own Department AND Shift;
// there is no filter parameter to set.
export async function GET(request) {
  const auth = await requireAuth(request, ['departmentAdmin']);
  if (auth.error) return auth.error;
  try {
    const departmentId = auth.user.departmentId;
    if (!departmentId) {
      return NextResponse.json({
        success: true,
        teachers: [],
        noDepartment: true,
        message: 'Your account has no Department, so there are no Teachers to show.',
      });
    }

    // A Department Admin heads ONE shift (Morning or Day) of the Department, and
    // the Super Admin creates Morning and Day Teachers separately, so the list
    // shows only Teachers of the caller's own shift. A Teacher who has no shift
    // yet (created before shifts were required) stays visible so they can still
    // be given a Subject; they adopt the shift of that first Subject.
    const shift = auth.user.shift;
    const teacherRows = await prisma.user.findMany({
      where: {
        role: 'teacher',
        departmentId,
        ...(shift && { OR: [{ shift }, { shift: null }] }),
      },
      select: {
        id: true, name: true, email: true, role: true, mobile: true,
        departmentId: true, departmentCode: true, shift: true,
        semester: true, semesters: true, section: true, subjectId: true,
        isActive: true,
        department: { select: { id: true, name: true, code: true } },
        taughtSubjects: {
          // Deleted Subjects are soft-deleted (`isActive: false`) so their
          // attendance history survives — but they must not keep showing up
          // on the Teacher's card afterwards.
          where: { isActive: true },
          select: { id: true, name: true, code: true, semester: true, section: true, shift: true, isActive: true },
        },
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });

    // `_id` and `subjects` are the shapes the shared PersonCard consumes.
    const teachers = teacherRows.map(teacher => ({
      ...teacher,
      _id: teacher.id,
      subjects: teacher.taughtSubjects.map(subject => ({ ...subject, _id: subject.id })),
      departmentId: teacher.department
        ? { ...teacher.department, _id: teacher.department.id }
        : teacher.departmentId,
    }));

    return NextResponse.json({ success: true, teachers });
  } catch (error) { return errorResponse(error); }
}
