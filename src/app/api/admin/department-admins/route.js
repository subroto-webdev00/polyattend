import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import sendEmail from '@/lib/sendEmail';
import { inviteCodeEmail } from '@/lib/notify';
import { generateInviteCode, oneMonthFromNow } from '@/lib/inviteCode';
import { requireAuth, errorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const VALID_SHIFTS = ['1st', '2nd', 'first', 'second'];

// GET /api/admin/department-admins
// Super Admin view: EVERY Department Admin in the institution, plus their
// pending invites. `?departmentId=` narrows the list to one department.
//
// This is the only route for the job. There used to be a Department Admin
// equivalent scoped to the caller's own Department + Shift, but that scope
// holds exactly one account — themselves — so every invite it could send came
// straight back as "already covers this Department and Shift". Hiring another
// Department Admin is a Super Admin action, and only they can pick the
// Department and Shift, so there is nothing left for the other route to do.
export async function GET(request) {
  const auth = await requireAuth(request, ['admin']);
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const departmentFilter = searchParams.get('departmentId');

    const userWhere = { role: 'departmentAdmin' };
    if (departmentFilter) userWhere.departmentId = departmentFilter;

    const inviteWhere = { role: 'departmentAdmin', used: false, codeExpire: { gt: new Date() } };
    if (departmentFilter) inviteWhere.departmentId = departmentFilter;

    const [departmentAdmins, pendingInvites] = await Promise.all([
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

    const normalizedAdmins = departmentAdmins.map(admin => ({
      ...admin,
      _id: admin.id,
      departmentId: admin.department
        ? { ...admin.department, _id: admin.department.id }
        : admin.departmentId,
    }));

    return NextResponse.json({
      success: true,
      departmentAdmins: normalizedAdmins,
      semAdmins: normalizedAdmins,
      pendingInvites,
    });
  } catch (error) { return errorResponse(error); }
}

// Every Semester a diploma programme runs. A Department Admin is
// department-wide, so a new account is granted all of them rather than a
// single one picked at invite time.
const ALL_SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

// POST /api/admin/department-admins
// Super Admin invites a Department Admin into a specific Department + Shift.
// Department and Shift are required here because a Super Admin has neither
// of their own to inherit.
//
// There is no Semester here on purpose. A Department Admin is department-wide
// — they manage every Semester in their Department — so pinning the account
// to one Semester at invite time described nothing real.
export async function POST(request) {
  const auth = await requireAuth(request, ['admin']);
  if (auth.error) return auth.error;
  try {
    const { name, email, departmentId, shift } = await request.json();

    if (typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ success: false, message: 'Enter Email' }, { status: 400 });
    }
    if (!departmentId) {
      return NextResponse.json({ success: false, message: 'Select a Department' }, { status: 400 });
    }
    if (!VALID_SHIFTS.includes(shift)) {
      return NextResponse.json({ success: false, message: 'Select a Shift' }, { status: 400 });
    }
    // The form speaks 1st/2nd, Prisma's enum is first/second. Without this the
    // raw "1st" reached prisma.user.findFirst and Prisma rejected the whole
    // query with `Invalid value for argument 'shift': Expected Shift`.
    const normalizedShift = shift === '1st' ? 'first' : shift === '2nd' ? 'second' : shift;

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

    const existingInScope = await prisma.user.findFirst({
      where: {
        role: 'departmentAdmin',
        departmentId,
        shift: normalizedShift,
        isActive: true,
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

    // An existing account is never merged into this role or moved to a
    // different Department + Shift. One already covering that scope has
    // nothing left to be granted, so it is simply reported.
    if (existingUser) {
      const isSameScope = existingUser.role === 'departmentAdmin'
        && existingUser.departmentId === departmentId
        && existingUser.shift === normalizedShift;

      if (!isSameScope) {
        return NextResponse.json({ success: false, message: 'An account already exists with this email' }, { status: 400 });
      }
      if (!existingUser.isActive) {
        return NextResponse.json({
          success: false,
          message: 'This Department Admin is inactive. Activate the account first.',
        }, { status: 400 });
      }

      // Their semester list may predate the department-wide model. Backfill it
      // rather than pretending there is a Semester left to add.
      const assigned = new Set(
        (Array.isArray(existingUser.semesters) ? existingUser.semesters : [])
          .map(Number).filter(Number.isInteger),
      );
      const needsBackfill = ALL_SEMESTERS.some(s => !assigned.has(s));
      const updatedUser = needsBackfill
        ? await prisma.user.update({
            where: { id: existingUser.id },
            data: { semesters: [...ALL_SEMESTERS], semester: existingUser.semester ?? ALL_SEMESTERS[0] },
            select: { id: true, name: true, email: true, role: true, departmentId: true, shift: true, semesters: true, semester: true },
          })
        : existingUser;

      return NextResponse.json({
        success: true,
        alreadyExists: true,
        updated: needsBackfill,
        message: needsBackfill
          ? `${updatedUser.name || 'This Department Admin'} now covers all Semesters`
          : `${updatedUser.name || 'This Department Admin'} already covers this Department and Shift`,
        departmentAdmin: { ...updatedUser, _id: updatedUser.id },
      });
    }

    if (!normalizedName) {
      return NextResponse.json({ success: false, message: 'Enter Name for the new Department Admin' }, { status: 400 });
    }

    if (existingInScope) {
      return NextResponse.json({
        success: false,
        message: `A Department Admin (${existingInScope.name || 'Unnamed'}) already covers this Department and Shift`,
      }, { status: 400 });
    }

    const existingInvite = await prisma.adminInvite.findFirst({
      where: { role: 'departmentAdmin', departmentId, shift: normalizedShift, used: false, codeExpire: { gt: new Date() } },
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
        departmentCode: department.code || null,
        shift: normalizedShift,
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
      // Never leave a live invite behind if the mail could not be sent —
      // the code would be unreachable and the row would block retries.
      await prisma.adminInvite.delete({ where: { id: invite.id } });
      return NextResponse.json({ success: false, message: 'Could not send the email. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Invitation sent to ${normalizedEmail}`, invite }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
