import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { generateToken, normalizeDepartmentAdmin, errorResponse } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  try {
    const { email, otp } = await request.json();
    if (!email || !otp) return NextResponse.json({ success: false, message: 'Enter Email and OTP' }, { status: 400 });
    const normalizedEmail = email.toLowerCase().trim();
    const limited = await checkRateLimit(request, 'verify-login-otp', normalizedEmail, { limit: 6, windowMs: 10 * 60 * 1000 });
    if (limited) return NextResponse.json({ success: false, message: limited.message }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } });
    const user = await prisma.user.findFirst({ where: { email: normalizedEmail, loginOTP: otp, loginOTPExpire: { gt: new Date() } }, include: { department: { select: { id: true, name: true, code: true } } } });
    if (!user) return NextResponse.json({ success: false, message: 'Wrong OTP or the OTP has expired' }, { status: 400 });
    if (!user.isActive) return NextResponse.json({ success: false, message: 'Account is deactivated' }, { status: 403 });
    await prisma.user.update({ where: { id: user.id }, data: { loginOTP: null, loginOTPExpire: null } });
    normalizeDepartmentAdmin(user);
    const token = generateToken(user.id);
    const response = NextResponse.json({ success: true, user: { _id: user.id, name: user.name, email: user.email, role: user.role, shift: user.shift, studentId: user.studentId, departmentId: user.department, departmentCode: user.departmentCode, semester: user.semester, semesters: user.role === 'departmentAdmin' ? (user.semesters?.length ? user.semesters : user.semester ? [user.semester] : []) : undefined, section: user.section } });
    response.cookies.set('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 7 * 24 * 60 * 60, path: '/' });
    return response;
  } catch (error) { return errorResponse(error); }
}
