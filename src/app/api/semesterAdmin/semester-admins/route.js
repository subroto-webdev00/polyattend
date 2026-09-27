import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import sendEmail from '@/lib/sendEmail';
import { inviteCodeEmail } from '@/lib/notify';
import { generateInviteCode, oneMonthFromNow } from '@/lib/inviteCode';
import { requireAuth, errorResponse } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const auth = await requireAuth(request, ['semesterAdmin']);
  if (auth.error) return auth.error;
  try {
    const semAdmins = await prisma.user.findMany({
      where: { role: 'semesterAdmin', departmentId: auth.user.departmentId, shift: auth.user.shift },
      select: { id:true, name:true, email:true, shift:true, semesters:true, semester:true, isActive:true, createdAt:true, department: { select: { id:true, name:true, code:true } } },
      orderBy: { createdAt: 'desc' }
    });
    const pendingInvites = await prisma.adminInvite.findMany({
      where: { role: 'semesterAdmin', departmentId: auth.user.departmentId, shift: auth.user.shift, used: false, codeExpire: { gt: new Date() } },
      orderBy: { createdAt: 'desc' }
    });
    const normalizedSemAdmins = semAdmins.map(admin => ({
      ...admin,
      _id: admin.id,
      departmentId: admin.department
        ? { ...admin.department, _id: admin.department.id }
        : admin.departmentId,
    }));
    return NextResponse.json({ success: true, semesterAdmins: normalizedSemAdmins, semAdmins: normalizedSemAdmins, pendingInvites });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request) {
  const auth = await requireAuth(request, ['semesterAdmin']);
  if (auth.error) return auth.error;
  try {
    const { name, email, semester } = await request.json();
    if (typeof email !== 'string' || !email.trim() || semester == null) {
      return NextResponse.json({ success: false, message: 'Enter Email and Semester' }, { status: 400 });
    }

    const semInt = Number(semester);
    if (!Number.isInteger(semInt) || semInt < 1 || semInt > 8) {
      return NextResponse.json({ success: false, message: 'Semester must be between 1 and 8' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    const departmentId = auth.user.departmentId;
    const shift = auth.user.shift;

    // A Semester Admin can manage several Semesters with one login. The
    // legacy `semester` field is still populated for older rows, so check
    // both representations when enforcing one-admin-per-semester.
    const existingSemAdmin = await prisma.user.findFirst({
      where: {
        role: 'semesterAdmin',
        departmentId,
        shift,
        isActive: true,
        OR: [
          { semesters: { has: semInt } },
          { semester: semInt },
        ],
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
      // Reuse only an existing Semester Admin in the exact same scope. Never
      // silently merge the email into a different role, department, or shift.
      const isOwnScopeSemesterAdmin = existingUser.role === 'semesterAdmin'
        && existingUser.departmentId === departmentId
        && existingUser.shift === shift;

      if (!isOwnScopeSemesterAdmin) {
        return NextResponse.json({ success: false, message: 'An account already exists with this email' }, { status: 400 });
      }
      if (!existingUser.isActive) {
        return NextResponse.json({
          success: false,
          message: 'This Semester Admin is inactive. Activate the account before adding another Semester.',
        }, { status: 400 });
      }

      const assignedSemesters = new Set(
        (Array.isArray(existingUser.semesters) ? existingUser.semesters : [])
          .map(Number)
          .filter(Number.isInteger),
      );
      if (existingUser.semester != null) {
        const legacySemester = Number(existingUser.semester);
        if (Number.isInteger(legacySemester)) assignedSemesters.add(legacySemester);
      }

      if (assignedSemesters.has(semInt)) {
        return NextResponse.json({
          success: false,
          message: `${existingUser.name || 'This Semester Admin'} already manages Semester ${semInt}`,
        }, { status: 400 });
      }

      if (existingSemAdmin) {
        const message = existingSemAdmin.id === existingUser.id
          ? `${existingUser.name || 'This Semester Admin'} already manages Semester ${semInt}`
          : `A Semester Admin (${existingSemAdmin.name || 'Unnamed Semester Admin'}) already exists for Semester ${semInt}`;
        return NextResponse.json({ success: false, message }, { status: 400 });
      }

      const existingInvite = await prisma.adminInvite.findFirst({
        where: {
          role: 'semesterAdmin',
          departmentId,
          shift,
          semester: semInt,
          used: false,
          codeExpire: { gt: new Date() },
        },
      });
      if (existingInvite) {
        return NextResponse.json({
          success: false,
          message: `An invite (${existingInvite.email}) is already pending for Semester ${semInt}`,
        }, { status: 400 });
      }

      assignedSemesters.add(semInt);
      const updatedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          semesters: Array.from(assignedSemesters).sort((a, b) => a - b),
          // Keep the legacy single-semester field populated for older clients
          // if this row came from a pre-multi-semester database.
          ...(existingUser.semester == null ? { semester: semInt } : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          departmentId: true,
          shift: true,
          semesters: true,
          semester: true,
        },
      });

      return NextResponse.json({
        success: true,
        addedToExisting: true,
        message: `Semester ${semInt} added to ${updatedUser.name || 'the existing Semester Admin'}'s account`,
        semesterAdmin: { ...updatedUser, _id: updatedUser.id },
      }, { status: 200 });
    }

    // A name is required only when this is a genuinely new account. Existing
    // Semester Admin emails are handled above and do not need another invite.
    if (!normalizedName) {
      return NextResponse.json({ success: false, message: 'Enter Name for the new Semester Admin' }, { status: 400 });
    }

    if (existingSemAdmin) {
      return NextResponse.json({
        success: false,
        message: `A Semester Admin (${existingSemAdmin.name || 'Unnamed Semester Admin'}) already exists for Semester ${semInt}`,
      }, { status: 400 });
    }

    const existingInvite = await prisma.adminInvite.findFirst({
      where: {
        role: 'semesterAdmin',
        departmentId,
        shift,
        semester: semInt,
        used: false,
        codeExpire: { gt: new Date() },
      },
    });
    if (existingInvite) {
      return NextResponse.json({
        success: false,
        message: `An invite (${existingInvite.email}) is already pending for Semester ${semInt}`,
      }, { status: 400 });
    }

    const code = generateInviteCode();
    const invite = await prisma.adminInvite.create({
      data: {
        role: 'semesterAdmin',
        name: normalizedName,
        email: normalizedEmail,
        departmentId,
        departmentCode: auth.user.departmentCode || null,
        shift,
        semester: semInt,
        invitedById: auth.user.id,
        code,
        codeExpire: oneMonthFromNow(),
      },
    });
    const { subject, message, html } = inviteCodeEmail({ name: normalizedName, role: 'semesterAdmin', code });
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
      invite: { _id: invite.id, name: invite.name, email: invite.email, semester: semInt, codeExpire: invite.codeExpire },
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
