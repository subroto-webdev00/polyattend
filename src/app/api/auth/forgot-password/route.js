import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import sendEmail from '@/lib/sendEmail';
import { errorResponse } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
export const dynamic = 'force-dynamic';
const GENERIC_MESSAGE = 'If an account exists with this email, a password reset OTP has been sent.';
export async function POST(request) {
  try {
    const { email } = await request.json();
    if (!email) return NextResponse.json({ success: false, message: 'Enter email address' }, { status: 400 });
    const limited = await checkRateLimit(request, 'forgot-password', email, { limit: 5, windowMs: 15 * 60 * 1000 });
    if (limited) return NextResponse.json({ success: false, message: limited.message }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } });
    const user = await prisma.user.findFirst({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive) return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await prisma.user.update({ where: { id: user.id }, data: { resetPasswordOTP: otp, resetPasswordExpire: new Date(Date.now() + 10 * 60 * 1000) } });
    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e2e8f0;border-radius:12px;"><h2 style="color:#1a6b4a;text-align:center;">Reset Your Password</h2><p>Hello <strong>${user.name}</strong>,</p><div style="background:#fffbeb;border:2px dashed #f59e0b;border-radius:8px;padding:15px;text-align:center;margin:20px 0;"><span style="font-size:24px;font-weight:bold;color:#b45309;letter-spacing:5px;">${otp}</span></div><p style="color:#64748b;font-size:13px;">Valid for 10 minutes.</p></div>`;
    try { await sendEmail({ email: user.email, subject: 'PolyAttend Password Reset OTP', message: `OTP: ${otp}`, html }); }
    catch (e) { await prisma.user.update({ where: { id: user.id }, data: { resetPasswordOTP: null, resetPasswordExpire: null } }).catch(() => {}); }
    return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
  } catch (error) { return errorResponse(error); }
}
