import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { hashPassword, errorResponse } from '@/lib/auth';
import { isStrongPassword } from '@/lib/validatePassword';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  try {
    const { email, code, password, mobile } = await request.json();
    if (!email || !code || !password) return NextResponse.json({ success: false, message: 'Enter Email, Code and Password' }, { status: 400 });
    const pwCheck = isStrongPassword(password);
    if (!pwCheck.ok) return NextResponse.json({ success: false, message: pwCheck.message }, { status: 400 });
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedCode = code.trim().toUpperCase();
    const invite = await prisma.adminInvite.findFirst({ where: { email: normalizedEmail, code: normalizedCode, used: false, codeExpire: { gt: new Date() } } });
    if (!invite) return NextResponse.json({ success: false, message: 'Wrong Code, or the Code has expired.' }, { status: 400 });
    if (invite.role === 'teacher') {
      if (!mobile?.trim()) return NextResponse.json({ success: false, message: 'Mobile Number is required for Teacher accounts' }, { status: 400 });
      if (!/^01[0-9]{9}$/.test(mobile.trim())) return NextResponse.json({ success: false, message: 'Enter a valid 11-digit mobile number' }, { status: 400 });
    }
    const existingUser = await prisma.user.findFirst({ where: { email: normalizedEmail } });
    if (existingUser) {
      await prisma.adminInvite.update({ where: { id: invite.id }, data: { used: true, usedAt: new Date() } });
      return NextResponse.json({ success: false, message: 'An account already exists with this email' }, { status: 400 });
    }
    if (invite.role === 'teacher') {
      const existingSubject = await prisma.subject.findFirst({ where: { code: invite.subjectCode, departmentId: invite.departmentId, semester: invite.semester, section: invite.section, shift: invite.shift, teacherId: { not: null } } });
      if (existingSubject) return NextResponse.json({ success: false, message: 'A Teacher is already assigned for this Subject' }, { status: 400 });
    }
    const hashed = await hashPassword(password);
    const user = await prisma.user.create({ data: { name: invite.name, email: invite.email, password: hashed, role: invite.role, departmentId: invite.departmentId, departmentCode: invite.departmentCode, shift: invite.shift, semester: invite.semester, semesters: invite.role === 'departmentAdmin' && invite.semester ? [invite.semester] : [], section: invite.section, mobile: mobile?.trim() || null, createdById: invite.invitedById, isActive: true, isVerified: true } });
    if (invite.role === 'teacher') {
      let subject = await prisma.subject.findFirst({ where: { code: invite.subjectCode, departmentId: invite.departmentId, semester: invite.semester, section: invite.section, shift: invite.shift } });
      if (subject) { subject = await prisma.subject.update({ where: { id: subject.id }, data: { teacherId: user.id, name: invite.subjectName || subject.name } }); }
      else { subject = await prisma.subject.create({ data: { name: invite.subjectName, code: invite.subjectCode, departmentId: invite.departmentId, semester: invite.semester, section: invite.section, shift: invite.shift, teacherId: user.id } }); }
      await prisma.user.update({ where: { id: user.id }, data: { subjectId: subject.id } });
    }
    await prisma.adminInvite.update({ where: { id: invite.id }, data: { used: true, usedAt: new Date() } });
    return NextResponse.json({ success: true, message: 'Registration successful! You can now log in.' }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
