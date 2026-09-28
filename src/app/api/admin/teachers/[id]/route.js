import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import sendEmail from '@/lib/sendEmail';
import { inviteCodeEmail } from '@/lib/notify';
import { requireAuth, errorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/admin/teachers/[id] — resend a pending Teacher invite.
// Safe to repeat: it reuses the existing, still-valid registration code
// rather than minting a new one, so a code already in the teacher's inbox
// keeps working.
export async function POST(request, { params }) {
  const auth = await requireAuth(request, ['admin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const invite = await prisma.adminInvite.findUnique({ where: { id } });
    if (!invite || invite.role !== 'teacher') {
      return NextResponse.json({ success: false, message: 'Pending invite not found' }, { status: 404 });
    }
    if (invite.used) {
      return NextResponse.json({ success: false, message: 'This invite has already been used' }, { status: 400 });
    }
    if (invite.codeExpire <= new Date()) {
      return NextResponse.json({
        success: false,
        message: 'This invite has expired. Cancel it and send a new invite.',
      }, { status: 400 });
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

// DELETE /api/admin/teachers/[id] — cancel a pending Teacher invite.
export async function DELETE(request, { params }) {
  const auth = await requireAuth(request, ['admin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const invite = await prisma.adminInvite.findUnique({ where: { id } });
    if (!invite || invite.role !== 'teacher') {
      return NextResponse.json({ success: false, message: 'Invite not found' }, { status: 404 });
    }
    if (invite.used) {
      return NextResponse.json({
        success: false,
        message: 'This invite has already been used and cannot be cancelled',
      }, { status: 400 });
    }
    await prisma.adminInvite.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Invite cancelled' });
  } catch (error) {
    return errorResponse(error);
  }
}
