import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import sendEmail from '@/lib/sendEmail';
import { inviteCodeEmail } from '@/lib/notify';
import { generateInviteCode, oneMonthFromNow } from '@/lib/inviteCode';
import { requireAuth, errorResponse } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const auth = await requireAuth(request, ['departmentAdmin']);
  if (auth.error) return auth.error;
  try {
    const semAdmins = await prisma.user.findMany({
      where: { role: 'departmentAdmin', departmentId: auth.user.departmentId, shift: auth.user.shift },
      select: { id:true, name:true, email:true, shift:true, semesters:true, semester:true, isActive:true, createdAt:true, department: { select: { id:true, name:true, code:true } } },
      orderBy: { createdAt: 'desc' }
    });
    const pendingInvites = await prisma.adminInvite.findMany({
      where: { role: 'departmentAdmin', departmentId: auth.user.departmentId, shift: auth.user.shift, used: false, codeExpire: { gt: new Date() } },
      orderBy: { createdAt: 'desc' }
    });
    const normalizedSemAdmins = semAdmins.map(admin => ({
      ...admin,
      _id: admin.id,
      departmentId: admin.department
        ? { ...admin.department, _id: admin.department.id }
        : admin.departmentId,
    }));
    return NextResponse.json({ success: true, departmentAdmins: normalizedSemAdmins, semAdmins: normalizedSemAdmins, pendingInvites });
  } catch (error) { return errorResponse(error); }
}
// Every Semester a diploma programme runs. A Department Admin is
// department-wide, so a new account covers all of them rather than one
// Semester picked at invite time.
const ALL_SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

export async function POST(request) {
  const auth = await requireAuth(request, ['departmentAdmin']);
  if (auth.error) return auth.error;
  try {
    const { name, email } = await request.json();
    if (typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ success: false, message: 'Enter Email' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    const departmentId = auth.user.departmentId;
    const shift = auth.user.shift;

    if (!departmentId) {
      return NextResponse.json({
        success: false,
        message: 'Your account has no Department, so you cannot invite a Department Admin.',
      }, { status: 403 });
    }

    // Scope is Department + Shift. No Semester: they manage every Semester in
    // their Department, so there is nothing per-semester left to claim.
    const existingSemAdmin = await prisma.user.findFirst({
      where: {
        role: 'departmentAdmin',
        departmentId,
        shift,
        isActive: true,
      },
      select: { id: true, name: true },
    });

    const existingUser = await prisma.user.findFirst({
      where: { email: normalizedEmail },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        shift: true,
        semesters: true,
        semester: true,
        isActive: true,
      },
    });

    if (existingUser) {
      // Reuse only an existing Department Admin in the exact same scope. Never
      // silently merge the email into a different role, department, or shift.
      const isOwnScopeDepartmentAdmin = existingUser.role === 'departmentAdmin'
        && existingUser.departmentId === departmentId
        && existingUser.shift === shift;

      if (!isOwnScopeDepartmentAdmin) {
        return NextResponse.json({ success: false, message: 'An account already exists with this email' }, { status: 400 });
      }
      if (!existingUser.isActive) {
        return NextResponse.json({
          success: false,
          message: 'This Department Admin is inactive. Activate the account first.',
        }, { status: 400 });
      }

      // They already cover this Department + Shift. Their semester list may
      // predate the department-wide model, so backfill it rather than
      // pretending there is a Semester left to add.
      const assigned = new Set(
        (Array.isArray(existingUser.semesters) ? existingUser.semesters : [])
          .map(Number)
          .filter(Number.isInteger),
      );
      const needsBackfill = ALL_SEMESTERS.some(s => !assigned.has(s));
      const updatedUser = needsBackfill
        ? await prisma.user.update({
            where: { id: existingUser.id },
            data: { semesters: [...ALL_SEMESTERS], semester: existingUser.semester ?? ALL_SEMESTERS[0] },
            select: {
              id: true, name: true, email: true, role: true,
              departmentId: true, shift: true, semesters: true, semester: true,
            },
          })
        : existingUser;

      return NextResponse.json({
        success: true,
        alreadyExists: true,
        updated: needsBackfill,
        message: needsBackfill
          ? `${updatedUser.name || 'This Department Admin'} now covers all Semesters`
          : `${updatedUser.name || 'This Department Admin'} already covers your Department and Shift`,
        departmentAdmin: { ...updatedUser, _id: updatedUser.id },
      }, { status: 200 });
    }

    // A name is required only when this is a genuinely new account.
    if (!normalizedName) {
      return NextResponse.json({ success: false, message: 'Enter Name for the new Department Admin' }, { status: 400 });
    }

    if (existingSemAdmin) {
      return NextResponse.json({
        success: false,
        message: `A Department Admin (${existingSemAdmin.name || 'Unnamed Department Admin'}) already covers this Department and Shift`,
      }, { status: 400 });
    }

    const existingInvite = await prisma.adminInvite.findFirst({
      where: {
        role: 'departmentAdmin',
        departmentId,
        shift,
        used: false,
        codeExpire: { gt: new Date() },
      },
    });
    if (existingInvite) {
      return NextResponse.json({
        success: false,
        message: `An invite (${existingInvite.email}) is already pending for this Department and Shift`,
      }, { status: 400 });
    }

    const code = generateInviteCode();
    const invite = await prisma.adminInvite.create({
      data: {
        role: 'departmentAdmin',
        name: normalizedName,
        email: normalizedEmail,
        departmentId,
        departmentCode: auth.user.departmentCode || null,
        shift,
        semester: ALL_SEMESTERS[0],
        invitedById: auth.user.id,
        code,
        codeExpire: oneMonthFromNow(),
      },
    });
    const { subject, message, html } = inviteCodeEmail({ name: normalizedName, role: 'departmentAdmin', code });
    try {
      await sendEmail({ email: normalizedEmail, subject, message, html });
    } catch (e) {
      await prisma.adminInvite.delete({ where: { id: invite.id } });
      throw e;
    }
    return NextResponse.json({
      success: true,
      addedToExisting: false,
      message: `Registration code sent to ${normalizedName}'s email`,
      invite: { _id: invite.id, name: invite.name, email: invite.email, codeExpire: invite.codeExpire },
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
