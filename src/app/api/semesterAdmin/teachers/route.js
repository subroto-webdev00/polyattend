import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/semesterAdmin/teachers
// Teacher Management list for a Semester Admin.
//
// There is deliberately NO POST here. Creating a Teacher is a Super Admin
// action, so this route is read-only apart from /assign-subject.
//
// The list is department-wide and completely automatic: the Department comes
// from the caller's own account and there is no filter parameter to set. The
// old query also pinned `shift`, but Teachers are no longer created with a
// shift, so pinning it would hide most of them — a Teacher with no shift yet
// has no shift to match.
export async function GET(request) {
  const auth = await requireAuth(request, ['semesterAdmin']);
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

    const teacherRows = await prisma.user.findMany({
      where: { role: 'teacher', departmentId },
      select: {
        id: true, name: true, email: true, role: true, mobile: true,
        departmentId: true, departmentCode: true, shift: true,
        semester: true, semesters: true, section: true, subjectId: true,
        isActive: true,
        department: { select: { id: true, name: true, code: true } },
        taughtSubjects: {
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
