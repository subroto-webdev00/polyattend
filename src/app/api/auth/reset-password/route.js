import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { hashPassword, errorResponse } from '@/lib/auth';
import { isStrongPassword } from '@/lib/validatePassword';
import { checkRateLimit } from '@/lib/rateLimit';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  try {
    const { email, otp, newPassword } = await request.json();
    if (!email || !otp || !newPassword) return NextResponse.json({ success: false, message: 'Enter all fields' }, { status: 400 });
    const pwCheck = isStrongPassword(newPassword);
    if (!pwCheck.ok) return NextResponse.json({ success: false, message: pwCheck.message }, { status: 400 });
    const limited = await checkRateLimit(request, 'reset-password', email, { limit: 6, windowMs: 10 * 60 * 1000 });
    if (limited) return NextResponse.json({ success: false, message: limited.message }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } });
    const user = await prisma.user.findFirst({ where: { email: email.toLowerCase(), resetPasswordOTP: otp, resetPasswordExpire: { gt: new Date() } } });
    if (!user) return NextResponse.json({ success: false, message: 'Wrong OTP or the OTP has expired' }, { status: 400 });
    await prisma.user.update({ where: { id: user.id }, data: { password: await hashPassword(newPassword), isVerified: true, resetPasswordOTP: null, resetPasswordExpire: null } });
    return NextResponse.json({ success: true, message: 'Password changed successfully. Please log in.' });
  } catch (error) { return errorResponse(error); }
}
