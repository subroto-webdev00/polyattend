import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/db';
import sendEmail from '@/lib/sendEmail';
import { generateToken, comparePassword, normalizeDepartmentAdmin, errorResponse } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const TWO_FA_ENABLED = false;
const REQUIRES_2FA = TWO_FA_ENABLED ? ['admin', 'departmentAdmin'] : [];

function generateOTP() { return crypto.randomInt(100000, 1000000).toString(); }

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password)
      return NextResponse.json({ success: false, message: 'Please provide email and password' }, { status: 400 });

    const limited = await checkRateLimit(request, 'login', email, { limit: 8, windowMs: 15 * 60 * 1000 });
    if (limited) return NextResponse.json({ success: false, message: limited.message }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } });

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
      include: { department: { select: { id: true, name: true, code: true } }, subject: { select: { id: true, name: true, code: true, semester: true, section: true, shift: true } } },
    });
    if (!user) return NextResponse.json({ success: false, message: 'Invalid email or password' }, { status: 401 });
    if (!user.isActive) return NextResponse.json({ success: false, message: 'Account is deactivated' }, { status: 403 });
    if (!(await comparePassword(password, user.password || '')))
      return NextResponse.json({ success: false, message: 'Invalid email or password' }, { status: 401 });

    if (REQUIRES_2FA.includes(user.role)) {
      const otp = generateOTP();
      await prisma.user.update({ where: { id: user.id }, data: { loginOTP: otp, loginOTPExpire: new Date(Date.now() + 10 * 60 * 1000) } });
      const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e2e8f0;border-radius:12px;"><h2 style="color:#1a6b4a;text-align:center;">ðŸ” Login Verification</h2><p>Hello <strong>${user.name}</strong>,</p><div style="background:#f0fdf4;border:2px dashed #1a6b4a;border-radius:8px;padding:15px;text-align:center;margin:20px 0;"><span style="font-size:26px;font-weight:bold;color:#1a6b4a;letter-spacing:6px;">${otp}</span></div><p style="color:#64748b;font-size:13px;">Valid for 10 minutes.</p></div>`;
      await sendEmail({ email: user.email, subject: 'PolyAttend â€” Login Verification Code', message: `OTP: ${otp}`, html });
      return NextResponse.json({ success: true, requiresOtp: true, email: user.email, message: 'Login OTP sent to your email' });
    }

    const token = generateToken(user.id);
    normalizeDepartmentAdmin(user);
    const response = NextResponse.json({
      success: true,
      user: {
        _id: user.id, name: user.name, email: user.email, role: user.role, shift: user.shift,
        studentId: user.studentId, departmentId: user.department, departmentCode: user.departmentCode,
        semester: user.semester, semesters: user.role === 'departmentAdmin' ? (user.semesters?.length ? user.semesters : user.semester ? [user.semester] : []) : undefined,
        section: user.section, subjectId: user.subject,
      },
    });
    response.cookies.set('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', maxAge: 7 * 24 * 60 * 60, path: '/' });
    return response;
  } catch (error) { return errorResponse(error); }
}
