import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { errorResponse } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { cacheDelPrefix } from '@/lib/cache';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  try {
    const { email, otp } = await request.json();
    if (!email || !otp) return NextResponse.json({ success: false, message: 'Enter Email and OTP' }, { status: 400 });
    const normalizedEmail = email.toLowerCase().trim();
    const limited = await checkRateLimit(request, 'verify-email', normalizedEmail, { limit: 6, windowMs: 10 * 60 * 1000 });
    if (limited) return NextResponse.json({ success: false, message: limited.message }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } });
    const pending = await prisma.pendingRegistration.findFirst({ where: { email: normalizedEmail, otp, otpExpire: { gt: new Date() } } });
    if (pending) {
      const emailTaken = await prisma.user.findFirst({ where: { email: pending.email, registered: { not: false } } });
      if (emailTaken) { await prisma.pendingRegistration.delete({ where: { id: pending.id } }); return NextResponse.json({ success: false, message: 'An account already exists with this email' }, { status: 400 }); }
      if (pending.role === 'student' && pending.studentIdText) {
        const studentIdTaken = await prisma.user.findFirst({ where: { studentId: pending.studentIdText, registered: { not: false } } });
        if (studentIdTaken) { await prisma.pendingRegistration.delete({ where: { id: pending.id } }); return NextResponse.json({ success: false, message: 'This Student ID is already registered' }, { status: 400 }); }
      }
      // Student: update shadow profile
      if (pending.role === 'student' && pending.shadowStudentId) {
        const updated = await prisma.user.updateMany({ where: { id: pending.shadowStudentId, role: 'student', registered: false }, data: { name: pending.name, password: pending.password, mobile: pending.mobile, departmentId: pending.departmentId, semester: pending.semester, section: pending.section, shift: pending.shift, isActive: true, isVerified: true, registered: true, regCode: null, regCodeExpire: null } });
        if (updated.count === 0) {
          await prisma.user.create({ data: { name: pending.name, email: pending.email, password: pending.password, role: 'student', studentId: pending.studentIdText, departmentId: pending.departmentId, semester: pending.semester, section: pending.section, shift: pending.shift, mobile: pending.mobile, isActive: true, isVerified: true, registered: true } });
        }
      } else {
        await prisma.user.create({ data: { name: pending.name, email: pending.email, password: pending.password, role: pending.role, studentId: pending.studentIdText, departmentId: pending.departmentId, semester: pending.semester, section: pending.section, shift: pending.shift, mobile: pending.mobile, isActive: true, isVerified: true, registered: true } });
      }
      await prisma.pendingRegistration.delete({ where: { id: pending.id } });
      // Verification turns a pending/shadow account into a real registered one,
      // which moves the Student/Teacher counts and the department roster.
      await Promise.all([cacheDelPrefix('users'), cacheDelPrefix('deptadmin')]);
      return NextResponse.json({ success: true, message: 'Email verification successful! You can now log in.' });
    }
    // Legacy path â€” unverified User doc
    const user = await prisma.user.findFirst({ where: { email: normalizedEmail, verificationOTP: otp, verificationExpire: { gt: new Date() } } });
    if (!user) return NextResponse.json({ success: false, message: 'Wrong OTP or the OTP has expired' }, { status: 400 });
    await prisma.user.update({ where: { id: user.id }, data: { isVerified: true, verificationOTP: null, verificationExpire: null } });
    return NextResponse.json({ success: true, message: 'Email verification successful! You can now log in.' });
  } catch (error) { return errorResponse(error); }
}
