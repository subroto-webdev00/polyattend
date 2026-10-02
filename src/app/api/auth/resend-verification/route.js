import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import sendEmail from '@/lib/sendEmail';
import { errorResponse } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  try {
    const { email } = await request.json();
    if (!email) return NextResponse.json({ success: false, message: 'Enter email' }, { status: 400 });
    const normalizedEmail = email.toLowerCase().trim();
    const limited = await checkRateLimit(request, 'resend-verification', normalizedEmail, { limit: 10, windowMs: 15 * 60 * 1000 });
    if (limited) return NextResponse.json({ success: false, message: limited.message }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } });
    const pending = await prisma.pendingRegistration.findFirst({ where: { email: normalizedEmail } });
    if (pending) {
      const remaining = pending.otpExpire ? pending.otpExpire.getTime() - Date.now() : 0;
      if (remaining > 2 * 60 * 1000) return NextResponse.json({ success: false, message: `Please wait ${Math.ceil(remaining / 60000)} minute(s)` }, { status: 429 });
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      await prisma.pendingRegistration.update({ where: { id: pending.id }, data: { otp, otpExpire: new Date(Date.now() + 10 * 60 * 1000) } });
      const html = `<div style="font-family:Arial;padding:20px;border:1px solid #e2e8f0;border-radius:12px;"><h2 style="color:#1a6b4a;text-align:center;">Email Verification</h2><p>Hello <strong>${pending.name}</strong>,</p><div style="background:#f0fdf4;border:2px dashed #1a6b4a;border-radius:8px;padding:15px;text-align:center;margin:20px 0;"><span style="font-size:28px;font-weight:bold;color:#1a6b4a;letter-spacing:8px;">${otp}</span></div><p style="color:#64748b;font-size:13px;">Valid for 10 minutes.</p></div>`;
      await sendEmail({ email: pending.email, subject: 'PolyAttend â€” New Verification Code', message: `Your new OTP: ${otp}`, html });
      return NextResponse.json({ success: true, message: 'New OTP sent' });
    }
    const user = await prisma.user.findFirst({ where: { email: normalizedEmail } });
    if (!user) return NextResponse.json({ success: false, message: 'No account exists with this email' }, { status: 404 });
    if (user.isVerified) return NextResponse.json({ success: false, message: 'This account is already verified' }, { status: 400 });
    const remaining = user.verificationExpire ? user.verificationExpire.getTime() - Date.now() : 0;
    if (remaining > 2 * 60 * 1000) return NextResponse.json({ success: false, message: `Please wait ${Math.ceil(remaining / 60000)} minute(s)` }, { status: 429 });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await prisma.user.update({ where: { id: user.id }, data: { verificationOTP: otp, verificationExpire: new Date(Date.now() + 10 * 60 * 1000) } });
    const html = `<div style="font-family:Arial;padding:20px;border:1px solid #e2e8f0;border-radius:12px;"><h2 style="color:#1a6b4a;text-align:center;">Email Verification</h2><div style="background:#f0fdf4;border:2px dashed #1a6b4a;border-radius:8px;padding:15px;text-align:center;margin:20px 0;"><span style="font-size:28px;font-weight:bold;color:#1a6b4a;letter-spacing:8px;">${otp}</span></div><p style="color:#64748b;font-size:13px;">Valid for 10 minutes.</p></div>`;
    await sendEmail({ email: user.email, subject: 'PolyAttend â€” New Verification Code', message: `Your new OTP: ${otp}`, html });
    return NextResponse.json({ success: true, message: 'New OTP sent' });
  } catch (error) { return errorResponse(error); }
}
