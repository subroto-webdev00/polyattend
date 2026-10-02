import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, hashPassword, errorResponse } from '@/lib/auth';
import { cacheDel, cacheDelPrefix, cacheKey } from '@/lib/cache';
export const dynamic = 'force-dynamic';

// Any change to a user can move a dashboard count, and an edit can change the
// shape /auth/me returns (name, shift, department, semesters, active flag).
// Dropping both is cheaper than reasoning about which dashboard notices which
// edit, and both have short TTLs anyway.
async function invalidateUserCaches(id) {
  await Promise.all([
    cacheDel(cacheKey('auth', 'me', id)),
    cacheDelPrefix('users'),
  ]);
}
// Roles a Department Admin is allowed to act on. `admin` is deliberately absent:
// a Department Admin must never be able to reach a Super Admin account, even
// just to flip its active flag.
const SEMESTER_ADMIN_MANAGABLE_ROLES = ['teacher', 'student', 'departmentAdmin'];

export async function PUT(request, { params }) {
  const auth = await requireAuth(request, ['admin', 'departmentAdmin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const body = await request.json();
    let data = { ...body };
    if (data.password) data.password = await hashPassword(data.password);

    if (auth.user.role === 'departmentAdmin') {
      // This used to pass the request body straight into prisma.user.update
      // with no scope check at all, so a Department Admin could rewrite anyone's
      // role, password, department or semesters — i.e. promote themselves to
      // admin. Restrict them to the one field the UI actually sends, and only
      // for people inside their own Department.
      const target = await prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true, departmentId: true },
      });
      if (!target) {
        return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
      }
      const inScope = target.departmentId === auth.user.departmentId
        && SEMESTER_ADMIN_MANAGABLE_ROLES.includes(target.role);
      if (!inScope) {
        return NextResponse.json({ success: false, message: 'You cannot edit a user outside your scope' }, { status: 403 });
      }

      const safe = {};
      if (typeof body.isActive === 'boolean') safe.isActive = body.isActive;
      if (Object.keys(safe).length === 0) {
        return NextResponse.json({
          success: false,
          message: 'You can only change whether an account is active',
        }, { status: 403 });
      }
      data = safe;
    }

    const user = await prisma.user.update({ where: { id }, data, select: { id: true, name: true, email: true, role: true, isActive: true } });
    await invalidateUserCaches(id);
    return NextResponse.json({ success: true, user });
  } catch (error) { return errorResponse(error, 400); }
}
export async function DELETE(request, { params }) {
  const auth = await requireAuth(request, ['admin', 'departmentAdmin']);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, studentId: true, role: true,
        departmentId: true, shift: true, semester: true,
        taughtSubjects: { select: { semester: true } },
      },
    });
    if (!target) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    if (target.id === auth.user.id) {
      return NextResponse.json({ success: false, message: 'You cannot delete your own account' }, { status: 400 });
    }

    if (auth.user.role === 'departmentAdmin') {
      // Department-wide: a Department Admin manages Teachers, Students and other
      // Department Admins in their whole Department. Shift is NOT part of the
      // test any more — Teachers are no longer created with a shift, so
      // requiring a match hid every Teacher who had not been assigned a
      // Subject yet.
      const inScope = target.departmentId === auth.user.departmentId
        && SEMESTER_ADMIN_MANAGABLE_ROLES.includes(target.role);
      if (!inScope) {
        return NextResponse.json({ success: false, message: 'You cannot delete a user outside your scope' }, { status: 403 });
      }
    }

    let confirmName = '';
    try { confirmName = (await request.json())?.confirmName || ''; } catch { /* no body sent */ }
    const typed = String(confirmName).trim().toLowerCase();
    const nameMatch = target.name && typed === target.name.trim().toLowerCase();
    const rollMatch = target.studentId && typed === String(target.studentId).trim().toLowerCase();
    if (!typed || (!nameMatch && !rollMatch)) {
      return NextResponse.json({ success: false, message: 'Type the exact name or roll to confirm deletion' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // Collect sessions owned by a teacher before deleting anything. Their
      // attendance rows must be removed first because Session -> Attendance
      // and Attendance -> User are required foreign-key relations.
      const ownedSessions = await tx.session.findMany({
        where: { teacherId: target.id },
        select: { id: true },
      });
      const ownedSessionIds = ownedSessions.map(session => session.id);

      // Optional relations can be detached while preserving the related
      // account/record. This also covers users who created other accounts or
      // served as a substitute teacher.
      await tx.user.updateMany({
        where: { createdById: target.id },
        data: { createdById: null },
      });
      await tx.subject.updateMany({
        where: { teacherId: target.id },
        data: { teacherId: null, isActive: false },
      });
      await tx.session.updateMany({
        where: { substituteById: target.id },
        data: { substituteById: null },
      });

      // A user may be a student, a teacher, or both in legacy data. Remove
      // attendance belonging directly to the user and attendance belonging to
      // any session they own.
      const attendanceWhere = { OR: [{ studentId: target.id }] };
      if (ownedSessionIds.length) {
        attendanceWhere.OR.push({ sessionId: { in: ownedSessionIds } });
      }
      await tx.attendance.deleteMany({ where: attendanceWhere });
      await tx.session.deleteMany({ where: { teacherId: target.id } });

      // These relations have required foreign keys to User. Permanent delete
      // intentionally removes their history along with the account.
      await tx.ignoredMiss.deleteMany({ where: { ignoredById: target.id } });
      await tx.adminInvite.deleteMany({ where: { invitedById: target.id } });
      await tx.studentPreApproval.deleteMany({ where: { addedById: target.id } });
      await tx.studentPreApproval.updateMany({
        where: { usedByUserId: target.id },
        data: { usedByUserId: null },
      });
      await tx.pendingRegistration.deleteMany({ where: { shadowStudentId: target.id } });

      await tx.user.delete({ where: { id: target.id } });
    });

    await invalidateUserCaches(target.id);
    return NextResponse.json({ success: true, message: 'User and related history permanently deleted' });
  } catch (error) {
    // Attendance, sessions, invites, etc. still reference this user. The
    // transaction rolls back the subject update, so the data stays consistent.
    if (error?.code === 'P2001' || error?.code === 'P2003') {
      return NextResponse.json({
        success: false,
        message: 'Cannot delete — this user still has related records. No changes were saved. Please try again or deactivate the user instead.',
      }, { status: 409 });
    }
    return errorResponse(error);
  }
}
