import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const auth = await requireAuth(request, ['semesterAdmin', 'admin', 'subAdmin']);
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const email = (searchParams.get('email') || searchParams.get('q'))?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ success: false, message: 'Email is required' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, message: 'Enter a valid email address' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true, name: true, email: true, mobile: true, role: true,
        departmentId: true, shift: true, semester: true,
        taughtSubjects: {
          select: { id: true, name: true, code: true, semester: true, section: true, shift: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ success: true, found: false, isTeacher: false });
    }
    if (user.role !== 'teacher') {
      return NextResponse.json({ success: true, found: true, isTeacher: false, role: user.role });
    }

    return NextResponse.json({
      success: true,
      found: true,
      isTeacher: true,
      teacher: { ...user, _id: user.id },
      subjects: user.taughtSubjects,
    });
  } catch (error) { return errorResponse(error); }
}
