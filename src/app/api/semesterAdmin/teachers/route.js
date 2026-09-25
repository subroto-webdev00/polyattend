import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import sendEmail from '@/lib/sendEmail';
import { inviteCodeEmail } from '@/lib/notify';
import { generateInviteCode, oneMonthFromNow } from '@/lib/inviteCode';
import { requireAuth, errorResponse } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const auth = await requireAuth(request, ['semesterAdmin', 'subAdmin', 'admin']);
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const where = { role: 'teacher' };
    if (auth.user.role !== 'admin') { where.departmentId = auth.user.departmentId; where.shift = auth.user.shift; }
    if (searchParams.get('semester')) { const sem = parseInt(searchParams.get('semester')); where.taughtSubjects = { some: { semester: sem } }; }
    const teacherRows = await prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, role: true, mobile: true,
        departmentId: true, departmentCode: true, shift: true,
        semester: true, semesters: true, section: true, subjectId: true,
        isActive: true,
        department: { select: { id: true, name: true, code: true } },
        taughtSubjects: { select: { id: true, name: true, code: true, semester: true, section: true, shift: true, isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const teachers = teacherRows.map(teacher => ({
      ...teacher,
      _id: teacher.id,
      // `subjects` is the shape consumed by the shared PersonCard. Keep
      // `taughtSubjects` too for backwards compatibility with existing code.
      subjects: teacher.taughtSubjects.map(subject => ({ ...subject, _id: subject.id })),
      departmentId: teacher.department
        ? { ...teacher.department, _id: teacher.department.id }
        : teacher.departmentId,
    }));
    const pendingWhere = { role: 'teacher', used: false, codeExpire: { gt: new Date() } };
    if (auth.user.role !== 'admin') {
      pendingWhere.departmentId = auth.user.departmentId;
      pendingWhere.shift = auth.user.shift;
    }
    const pendingInvites = await prisma.adminInvite.findMany({ where: pendingWhere, include: { department: { select: { id: true, name: true, code: true } } }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ success: true, teachers, pendingInvites });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request) {
  const auth = await requireAuth(request, ['semesterAdmin', 'subAdmin', 'admin']);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();
    const { name, email, semester, section, subjectName, subjectCode } = body;
    const trimmedName = String(name || '').trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedCode = String(subjectCode || '').trim().toUpperCase();
    const normalizedSubjectName = String(subjectName || '').trim();
    const semesterNum = Number(semester);
    const requestedShift = auth.user.role === 'admin' ? body.shift : auth.user.shift;
    const shift = requestedShift === '1st' ? 'first' : requestedShift === '2nd' ? 'second' : requestedShift;
    // Department Admin (`subAdmin`) is scoped to their own Department,
    // same as Semester Admin — only top-level `admin` may target an
    // arbitrary Department via the request body.
    const departmentId = auth.user.role === 'admin' ? body.departmentId : auth.user.departmentId;

    if (!normalizedEmail || !normalizedSubjectName || !normalizedCode || !section) {
      return NextResponse.json({ success: false, message: 'Enter Email, Subject, Subject Code and Group' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ success: false, message: 'Enter a valid Email address' }, { status: 400 });
    }
    if (!['A', 'B', 'C', 'D'].includes(section)) {
      return NextResponse.json({ success: false, message: 'Select a valid Group (A-D)' }, { status: 400 });
    }
    if (!Number.isInteger(semesterNum) || semesterNum < 1 || semesterNum > 8) {
      return NextResponse.json({ success: false, message: 'Select a valid Semester' }, { status: 400 });
    }
    if (!departmentId || !['first', 'second'].includes(shift)) {
      return NextResponse.json({ success: false, message: 'Department and Shift are required' }, { status: 400 });
    }

    const allowedSemesters = auth.user.semesters || [];
    if (auth.user.role === 'semesterAdmin' && !allowedSemesters.includes(semesterNum)) {
      return NextResponse.json({ success: false, message: 'That Semester is outside your scope' }, { status: 403 });
    }

    const department = auth.user.role === 'admin'
      ? await prisma.department.findUnique({ where: { id: departmentId }, select: { code: true } })
      : null;
    if (auth.user.role === 'admin' && !department) {
      return NextResponse.json({ success: false, message: 'Department not found' }, { status: 404 });
    }
    const departmentCode = auth.user.departmentCode || department?.code || null;

    // A Subject+Group slot can have only one Teacher. An unassigned Subject
    // left by a deleted Teacher can be safely assigned again.
    const existingSubject = await prisma.subject.findFirst({
      where: { code: normalizedCode, departmentId, semester: semesterNum, section, shift },
    });
    if (existingSubject?.teacherId) {
      return NextResponse.json({ success: false, message: `A Teacher is already assigned for ${normalizedSubjectName} (${normalizedCode}) — Group ${section}` }, { status: 400 });
    }

    const existingInvite = await prisma.adminInvite.findFirst({
      where: {
        role: 'teacher', departmentId, shift, semester: semesterNum,
        section, subjectCode: normalizedCode, used: false,
        codeExpire: { gt: new Date() },
      },
    });
    if (existingInvite) {
      return NextResponse.json({ success: false, message: `An invite (${existingInvite.email}) is already pending for ${normalizedSubjectName} (${normalizedCode}) — Group ${section}` }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      if (existingUser.role !== 'teacher') {
        return NextResponse.json({ success: false, message: 'This email belongs to a different account role and cannot be assigned as a Teacher' }, { status: 400 });
      }

      const subject = existingSubject
        ? await prisma.subject.update({
            where: { id: existingSubject.id },
            data: { name: normalizedSubjectName, teacherId: existingUser.id, isActive: true },
          })
        : await prisma.subject.create({
            data: {
              name: normalizedSubjectName, code: normalizedCode,
              departmentId, semester: semesterNum, section, shift,
              teacherId: existingUser.id,
            },
          });

      if (!existingUser.subjectId) {
        await prisma.user.update({ where: { id: existingUser.id }, data: { subjectId: subject.id } });
      }

      return NextResponse.json({
        success: true,
        assignedExisting: true,
        message: `${normalizedSubjectName} (${normalizedCode}) assigned to ${existingUser.name}`,
        subject,
      }, { status: 201 });
    }

    if (!trimmedName) {
      return NextResponse.json({ success: false, message: 'Enter Name for the new Teacher' }, { status: 400 });
    }

    const code = generateInviteCode();
    const invite = await prisma.adminInvite.create({
      data: {
        role: 'teacher', name: trimmedName, email: normalizedEmail,
        departmentId, departmentCode, shift, semester: semesterNum,
        section, subjectName: normalizedSubjectName, subjectCode: normalizedCode,
        invitedById: auth.user.id, code, codeExpire: oneMonthFromNow(),
      },
    });

    const { subject, message, html } = inviteCodeEmail({ name: trimmedName, role: 'teacher', code });
    try {
      await sendEmail({ email: normalizedEmail, subject, message, html });
    } catch (mailError) {
      // Never leave a usable code behind when the email was not delivered.
      await prisma.adminInvite.delete({ where: { id: invite.id } });
      throw mailError;
    }

    return NextResponse.json({
      success: true,
      message: `Registration code sent to ${trimmedName}'s email`,
      invite: {
        id: invite.id, _id: invite.id, name: invite.name,
        email: invite.email, subjectName: normalizedSubjectName,
        subjectCode: normalizedCode, section, semester: semesterNum,
        codeExpire: invite.codeExpire,
      },
    }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
