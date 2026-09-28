import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import sendEmail from '@/lib/sendEmail';
import { inviteCodeEmail } from '@/lib/notify';
import { generateInviteCode, oneMonthFromNow } from '@/lib/inviteCode';
import { requireAuth, errorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const VALID_SHIFTS = ['1st', '2nd', 'first', 'second'];

// The stored enum uses first/second; the UI has always shown 1st/2nd.
const normalizeShift = shift => (shift === '1st' ? 'first' : shift === '2nd' ? 'second' : shift);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/admin/teachers
// Super Admin view: EVERY Teacher in the institution, plus their pending
// invites. `?departmentId=` narrows both lists to one department.
//
// This is a separate route rather than a widening of
// /api/semesterAdmin/teachers. Creating Teachers is an Admin-only action
// now, and keeping the two apart means the Semester Admin endpoint can
// never quietly become institution-wide.
export async function GET(request) {
  const auth = await requireAuth(request, ['admin']);
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const departmentFilter = searchParams.get('departmentId');

    const userWhere = { role: 'teacher' };
    if (departmentFilter) userWhere.departmentId = departmentFilter;

    const inviteWhere = { role: 'teacher', used: false, codeExpire: { gt: new Date() } };
    if (departmentFilter) inviteWhere.departmentId = departmentFilter;

    const [teacherRows, pendingInvites] = await Promise.all([
      prisma.user.findMany({
        where: userWhere,
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
        orderBy: { createdAt: 'desc' },
      }),
      prisma.adminInvite.findMany({
        where: inviteWhere,
        include: { department: { select: { id: true, name: true, code: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // `_id` alongside `id` keeps the shared PersonCard working with either
    // response shape, matching every other list in the app.
    const teachers = teacherRows.map(teacher => ({
      ...teacher,
      _id: teacher.id,
      subjects: teacher.taughtSubjects.map(subject => ({ ...subject, _id: subject.id })),
      departmentId: teacher.department
        ? { ...teacher.department, _id: teacher.department.id }
        : teacher.departmentId,
    }));

    return NextResponse.json({ success: true, teachers, pendingInvites });
  } catch (error) { return errorResponse(error); }
}

// POST /api/admin/teachers
// Super Admin invites a new Teacher into a Department + Shift.
//
// Deliberately no Subject / Semester / Group here. A Subject always belongs
// to one Semester and one Group, so accepting them on a "create this person"
// form would mean storing a placeholder that quietly becomes real data.
// Subjects are attached afterwards through /assign-subject, where the admin
// is actually choosing them.
export async function POST(request) {
  const auth = await requireAuth(request, ['admin']);
  if (auth.error) return auth.error;
  try {
    const { name, email, departmentId, shift } = await request.json();

    if (typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ success: false, message: 'Enter Email' }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalizedEmail)) {
      return NextResponse.json({ success: false, message: 'Enter a valid Email address' }, { status: 400 });
    }

    const normalizedName = typeof name === 'string' ? name.trim() : '';
    if (!normalizedName) {
      return NextResponse.json({ success: false, message: 'Enter Name for the new Teacher' }, { status: 400 });
    }

    if (!departmentId) {
      return NextResponse.json({ success: false, message: 'Select a Department' }, { status: 400 });
    }
    if (!VALID_SHIFTS.includes(shift)) {
      return NextResponse.json({ success: false, message: 'Select a Shift' }, { status: 400 });
    }
    const normalizedShift = normalizeShift(shift);

    // The Department must actually exist, otherwise the new account would be
    // scoped to a departmentId that matches nothing.
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, name: true, code: true },
    });
    if (!department) {
      return NextResponse.json({ success: false, message: 'That Department no longer exists' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true, role: true, isActive: true },
    });
    if (existingUser) {
      return NextResponse.json({
        success: false,
        message: existingUser.role === 'teacher'
          ? `${existingUser.name || 'That email'} is already a Teacher — use "Assign Subject" to give them another Subject`
          : `An account with this email already exists (${existingUser.role})`,
      }, { status: 400 });
    }

    const existingInvite = await prisma.adminInvite.findFirst({
      where: { role: 'teacher', email: normalizedEmail, used: false, codeExpire: { gt: new Date() } },
    });
    if (existingInvite) {
      return NextResponse.json({
        success: false,
        message: 'An invite is already pending for this email — resend it or cancel it first',
      }, { status: 400 });
    }

    const code = generateInviteCode();
    const invite = await prisma.adminInvite.create({
      data: {
        role: 'teacher',
        name: normalizedName,
        email: normalizedEmail,
        departmentId,
        departmentCode: department.code || null,
        shift: normalizedShift,
        // No subject / semester / section — attached via /assign-subject.
        invitedById: auth.user.id,
        code,
        codeExpire: oneMonthFromNow(),
      },
    });

    const { subject, message, html } = inviteCodeEmail({ name: normalizedName, role: 'teacher', code });
    try {
      await sendEmail({ email: normalizedEmail, subject, message, html });
    } catch (mailError) {
      // Never leave a usable code behind when the email was not delivered.
      await prisma.adminInvite.delete({ where: { id: invite.id } });
      return NextResponse.json(
        { success: false, message: 'Could not send the email. Please try again.' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Registration code sent to ${normalizedEmail}`,
      invite,
    }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
