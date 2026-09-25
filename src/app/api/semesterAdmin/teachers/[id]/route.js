import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import sendEmail from '@/lib/sendEmail';
import { inviteCodeEmail } from '@/lib/notify';
import { requireAuth, errorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function isInviteInScope(invite, authUser) {
  if (authUser.role === 'admin') return true;
  if (authUser.role === 'subAdmin') {
    // Department Admin — scoped to their own Department + Shift, but (like
    // top-level admin) not restricted to specific Semesters.
    return invite.role === 'teacher'
      && invite.departmentId === authUser.departmentId
      && invite.shift === authUser.shift;
  }
  return invite.role === 'teacher'
    && invite.departmentId === authUser.departmentId
    && invite.shift === authUser.shift
    && (authUser.semesters || []).includes(invite.semester);
}

// POST /api/semesterAdmin/teachers/[id] — resend a pending Teacher invite.
// This is safe because it reuses the existing, still-valid registration code.
export async function POST(request, { params }) {
  const auth = await requireAuth(request, ['semesterAdmin', 'subAdmin', 'admin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const invite = await prisma.adminInvite.findUnique({ where: { id } });
    if (!invite || invite.role !== 'teacher') {
      return NextResponse.json({ success: false, message: 'Pending invite not found' }, { status: 404 });
    }
    if (!isInviteInScope(invite, auth.user)) {
      return NextResponse.json({ success: false, message: 'This invite is outside your scope' }, { status: 403 });
    }
    if (invite.used) {
      return NextResponse.json({ success: false, message: 'This invite has already been used' }, { status: 400 });
    }
    if (invite.codeExpire <= new Date()) {
      return NextResponse.json({ success: false, message: 'This invite has expired. Cancel it and send a new invite.' }, { status: 400 });
    }

    const { subject, message, html } = inviteCodeEmail({
      name: invite.name,
      role: 'teacher',
      code: invite.code,
    });

    try {
      const delivery = await sendEmail({ email: invite.email, subject, message, html });
      if (!delivery?.success) throw new Error('Email delivery did not complete');
    } catch (mailError) {
      return NextResponse.json({
        success: false,
        message: 'Invite email could not be sent. Check the SMTP configuration and try Resend again.',
      }, { status: 502 });
    }

    return NextResponse.json({ success: true, message: `Invite resent to ${invite.email}` });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/semesterAdmin/teachers/[id] — cancel a pending Teacher invite.
export async function DELETE(request, { params }) {
  const auth = await requireAuth(request, ['semesterAdmin', 'subAdmin', 'admin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const invite = await prisma.adminInvite.findUnique({ where: { id } });
    if (invite) {
      if (invite.role !== 'teacher') {
        return NextResponse.json({ success: false, message: 'Invite not found' }, { status: 404 });
      }
      if (!isInviteInScope(invite, auth.user)) {
        return NextResponse.json({ success: false, message: 'This invite is outside your scope' }, { status: 403 });
      }
      if (invite.used) {
        return NextResponse.json({ success: false, message: 'This invite has already been used and cannot be cancelled' }, { status: 400 });
      }
      await prisma.adminInvite.delete({ where: { id } });
      return NextResponse.json({ success: true, message: 'Invite cancelled' });
    }

    // Backward-compatible fallback for callers that still use this route to
    // deactivate an already-registered Teacher.
    const teacher = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, departmentId: true, shift: true, semester: true, taughtSubjects: { select: { semester: true } } },
    });
    if (!teacher || teacher.role !== 'teacher') {
      return NextResponse.json({ success: false, message: 'Teacher not found' }, { status: 404 });
    }
    const inScope = auth.user.role === 'admin' || (
      teacher.departmentId === auth.user.departmentId
      && teacher.shift === auth.user.shift
      && (
        auth.user.role === 'subAdmin' // Department Admin — any Semester within their Department
        || (auth.user.semesters || []).includes(teacher.semester)
        || teacher.taughtSubjects.some(subject => (auth.user.semesters || []).includes(subject.semester))
      )
    );
    if (!inScope) {
      return NextResponse.json({ success: false, message: 'This Teacher is outside your scope' }, { status: 403 });
    }
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true, message: 'Teacher deactivated' });
  } catch (error) {
    return errorResponse(error);
  }
}
