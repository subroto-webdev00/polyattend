import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import sendEmail from '@/lib/sendEmail';
import { inviteCodeEmail } from '@/lib/notify';
import { generateInviteCode, oneMonthFromNow } from '@/lib/inviteCode';
import { requireAuth, errorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const VALID_SHIFTS = ['1st', '2nd', 'first', 'second'];

// GET /api/admin/semester-admins
// Super Admin view: EVERY Department Admin in the institution, plus their
// pending invites. `?departmentId=` narrows the list to one department.
//
// This deliberately lives in its own route rather than widening
// /api/semesterAdmin/semester-admins: that endpoint is scoped to the
// caller's own Department + Shift, and an admin has neither, so letting it
// in would mean re-deriving the scope on every branch. Keeping the two
// apart means the Department Admin route can never accidentally become
// institution-wide.
export async function GET(request) {
  const auth = await requireAuth(request, ['admin']);
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const departmentFilter = searchParams.get('departmentId');

    const userWhere = { role: 'semesterAdmin' };
    if (departmentFilter) userWhere.departmentId = departmentFilter;

    const inviteWhere = { role: 'semesterAdmin', used: false, codeExpire: { gt: new Date() } };
    if (departmentFilter) inviteWhere.departmentId = departmentFilter;

    const [semesterAdmins, pendingInvites] = await Promise.all([
      prisma.user.findMany({
        where: userWhere,
        select: {
          id: true, name: true, email: true, shift: true, semesters: true, semester: true,
          isActive: true, createdAt: true,
          department: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.adminInvite.findMany({
        where: inviteWhere,
        include: { department: { select: { id: true, name: true, code: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const normalizedAdmins = semesterAdmins.map(admin => ({
      ...admin,
      _id: admin.id,
      departmentId: admin.department
        ? { ...admin.department, _id: admin.department.id }
        : admin.departmentId,
    }));

    return NextResponse.json({
      success: true,
      semesterAdmins: normalizedAdmins,
      semAdmins: normalizedAdmins,
      pendingInvites,
    });
  } catch (error) { return errorResponse(error); }
}

// POST /api/admin/semester-admins
// Super Admin invites a Department Admin into a specific Department + Shift.
// Department and Shift are required here because a Super Admin has neither
// of their own to inherit.
export async function POST(request) {
  const auth = await requireAuth(request, ['admin']);
  if (auth.error) return auth.error;
  try {
    const { name, email, departmentId, shift, semester } = await request.json();

    if (typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ success: false, message: 'Enter Email' }, { status: 400 });
    }
    if (!departmentId) {
      return NextResponse.json({ success: false, message: 'Select a Department' }, { status: 400 });
    }
    if (!VALID_SHIFTS.includes(shift)) {
      return NextResponse.json({ success: false, message: 'Select a Shift' }, { status: 400 });
    }

    const semInt = Number(semester);
    if (!Number.isInteger(semInt) || semInt < 1 || semInt > 8) {
      return NextResponse.json({ success: false, message: 'Select a Semester (1-8)' }, { status: 400 });
    }

    // The Department must actually exist — otherwise the invite would point
    // at a dangling departmentId and the account could never be scoped.
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, name: true, code: true },
    });
    if (!department) {
      return NextResponse.json({ success: false, message: 'That Department no longer exists' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = typeof name === 'string' ? name.trim() : '';

    const existingSemAdmin = await prisma.user.findFirst({
      where: {
        role: 'semesterAdmin',
        departmentId,
        shift,
        isActive: true,
        OR: [{ semesters: { has: semInt } }, { semester: semInt }],
      },
      select: { id: true, name: true },
    });

    const existingUser = await prisma.user.findFirst({
      where: { email: normalizedEmail },
      select: {
        id: true, name: true, email: true, role: true,
        departmentId: true, shift: true, semesters: true, semester: true, isActive: true,
      },
    });

    // Same rule as the Department Admin route: an existing Department Admin in
    // the SAME department + shift simply gains the extra Semester. Never
    // merge the email into a different role or a different scope.
    if (existingUser) {
      const isSameScope = existingUser.role === 'semesterAdmin'
        && existingUser.departmentId === departmentId
        && existingUser.shift === shift;

      if (!isSameScope) {
        return NextResponse.json({ success: false, message: 'An account already exists with this email' }, { status: 400 });
      }
      if (!existingUser.isActive) {
        return NextResponse.json({
          success: false,
          message: 'This Department Admin is inactive. Activate the account before adding another Semester.',
        }, { status: 400 });
      }

      const assignedSemesters = new Set(
        (Array.isArray(existingUser.semesters) ? existingUser.semesters : [])
          .map(Number).filter(Number.isInteger),
      );
      if (existingUser.semester != null) {
        const legacy = Number(existingUser.semester);
        if (Number.isInteger(legacy)) assignedSemesters.add(legacy);
      }
      if (assignedSemesters.has(semInt)) {
        return NextResponse.json({
          success: false,
          message: `${existingUser.name || 'This Department Admin'} already manages Semester ${semInt}`,
        }, { status: 400 });
      }
      if (existingSemAdmin && existingSemAdmin.id !== existingUser.id) {
        return NextResponse.json({
          success: false,
          message: `A Department Admin (${existingSemAdmin.name || 'Unnamed'}) already exists for Semester ${semInt}`,
        }, { status: 400 });
      }

      assignedSemesters.add(semInt);
      const updatedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          semesters: Array.from(assignedSemesters).sort((a, b) => a - b),
          ...(existingUser.semester == null ? { semester: semInt } : {}),
        },
        select: { id: true, name: true, email: true, role: true, departmentId: true, shift: true, semesters: true, semester: true },
      });

      return NextResponse.json({
        success: true,
        addedToExisting: true,
        message: `Semester ${semInt} added to ${updatedUser.name || 'the existing Department Admin'}'s account`,
        semesterAdmin: { ...updatedUser, _id: updatedUser.id },
      });
    }

    if (!normalizedName) {
      return NextResponse.json({ success: false, message: 'Enter Name for the new Department Admin' }, { status: 400 });
    }

    if (existingSemAdmin) {
      return NextResponse.json({
        success: false,
        message: `A Department Admin (${existingSemAdmin.name || 'Unnamed Department Admin'}) already exists for Semester ${semInt}`,
      }, { status: 400 });
    }

    const existingInvite = await prisma.adminInvite.findFirst({
      where: { role: 'semesterAdmin', departmentId, shift, semester: semInt, used: false, codeExpire: { gt: new Date() } },
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
        departmentCode: department.code || null,
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
      // Never leave a live invite behind if the mail could not be sent —
      // the code would be unreachable and the row would block retries.
      await prisma.adminInvite.delete({ where: { id: invite.id } });
      return NextResponse.json({ success: false, message: 'Could not send the email. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Invitation sent to ${normalizedEmail}`, invite }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
