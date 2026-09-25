import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import sendEmail from '@/lib/sendEmail';
import { inviteCodeEmail } from '@/lib/notify';
import { generateInviteCode, oneMonthFromNow } from '@/lib/inviteCode';
import { requireAuth, errorResponse } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const auth = await requireAuth(request, ['admin']);
  if (auth.error) return auth.error;
  try {
    const subAdmins = await prisma.user.findMany({ where: { role: 'subAdmin' }, select: { id: true, name: true, email: true, role: true, shift: true, isActive: true, createdAt: true, department: { select: { id: true, name: true, code: true } } }, orderBy: { createdAt: 'desc' } });
    const pendingInvites = await prisma.adminInvite.findMany({ where: { role: 'subAdmin', used: false, codeExpire: { gt: new Date() } }, include: { department: { select: { id: true, name: true, code: true } } }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ success: true, subAdmins, pendingInvites });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request) {
  const auth = await requireAuth(request, ['admin']);
  if (auth.error) return auth.error;
  try {
    let { name, email, departmentId, departmentCode, shift } = await request.json();
    if (!name || !email || !departmentId || !shift) return NextResponse.json({ success: false, message: 'Enter Name, Email, Department and Shift' }, { status: 400 });
    if (shift === '1st') shift = 'first';
    if (shift === '2nd') shift = 'second';
    if (!['first', 'second'].includes(shift)) return NextResponse.json({ success: false, message: 'Select a valid Shift' }, { status: 400 });
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await prisma.user.findFirst({ where: { email: normalizedEmail } });
    if (existingUser) return NextResponse.json({ success: false, message: 'An account already exists with this email' }, { status: 400 });
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) return NextResponse.json({ success: false, message: 'Department not found' }, { status: 404 });
    const existingSubAdmin = await prisma.user.findFirst({ where: { role: 'subAdmin', departmentId, shift, isActive: true } });
    if (existingSubAdmin) return NextResponse.json({ success: false, message: `A Department Admin (${existingSubAdmin.name}) already exists for this Department and Shift` }, { status: 400 });
    const existingInvite = await prisma.adminInvite.findFirst({ where: { role: 'subAdmin', departmentId, shift, used: false, codeExpire: { gt: new Date() } } });
    if (existingInvite) return NextResponse.json({ success: false, message: `An invite (${existingInvite.email}) is already pending for this Department and Shift` }, { status: 400 });
    const code = generateInviteCode();
    const invite = await prisma.adminInvite.create({ data: { role: 'subAdmin', name, email: normalizedEmail, departmentId, departmentCode: departmentCode || department.code, shift, invitedById: auth.user.id, code, codeExpire: oneMonthFromNow() } });
    const { subject, message, html } = inviteCodeEmail({ name, role: 'subAdmin', code });
    try { await sendEmail({ email: normalizedEmail, subject, message, html }); }
    catch (e) { await prisma.adminInvite.delete({ where: { id: invite.id } }); throw e; }
    return NextResponse.json({ success: true, message: `Registration code sent to ${name}'s email`, invite: { id: invite.id, name: invite.name, email: invite.email, departmentId, shift, codeExpire: invite.codeExpire } }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}