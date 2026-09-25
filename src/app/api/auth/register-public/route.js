import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { hashPassword, errorResponse } from '@/lib/auth';
import { isStrongPassword } from '@/lib/validatePassword';
import { checkRateLimit } from '@/lib/rateLimit';
import sendEmail from '@/lib/sendEmail';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  try {
    const { email, password, role, studentId, preApprovalCode, mobile } = await request.json();
    const limited = checkRateLimit(request, 'register-public', email, { limit: 8, windowMs: 15 * 60 * 1000 });
    if (limited) return NextResponse.json({ success: false, message: limited.message }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } });
    if (role !== 'student') return NextResponse.json({ success: false, message: 'Only Students can register here.' }, { status: 400 });
    if (!email || !password || !role) return NextResponse.json({ success: false, message: 'Enter Email, Password and role' }, { status: 400 });
    const pwCheck = isStrongPassword(password);
    if (!pwCheck.ok) return NextResponse.json({ success: false, message: pwCheck.message }, { status: 400 });
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findFirst({ where: { email: normalizedEmail, registered: { not: false } } });
    if (existing) return NextResponse.json({ success: false, message: 'An account already exists with this email' }, { status: 400 });
    if (!studentId) return NextResponse.json({ success: false, message: 'Enter your Student Roll' }, { status: 400 });
    if (!mobile?.trim()) return NextResponse.json({ success: false, message: 'Mobile Number is required' }, { status: 400 });
    if (!/^01[0-9]{9}$/.test(mobile.trim())) return NextResponse.json({ success: false, message: 'Enter a valid 11-digit mobile number' }, { status: 400 });
    const existingStudent = await prisma.user.findFirst({ where: { studentId, registered: { not: false } } });
    if (existingStudent) return NextResponse.json({ success: false, message: 'This Student ID is already registered' }, { status: 400 });
    if (!preApprovalCode) return NextResponse.json({ success: false, message: 'Enter the 12-digit Registration Code' }, { status: 400 });
    const shadow = await prisma.user.findFirst({ where: { studentId: studentId.trim(), email: normalizedEmail, role: 'student', registered: false, regCode: preApprovalCode.trim().toUpperCase(), regCodeExpire: { gt: new Date() } } });
    if (!shadow) return NextResponse.json({ success: false, message: 'Roll, Email or Code does not match, or Code has expired.' }, { status: 400 });
    const name = shadow.name;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpire = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.pendingRegistration.deleteMany({ where: { email: normalizedEmail } });
    const hashed = await hashPassword(password);
    const pending = await prisma.pendingRegistration.create({ data: { name, email: normalizedEmail, password: hashed, role: 'student', studentIdText: studentId, departmentId: shadow.departmentId, semester: shadow.semester, section: shadow.section, shift: shadow.shift, shadowStudentId: shadow.id, mobile: mobile.trim(), otp, otpExpire } });
    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e2e8f0;border-radius:12px;"><h2 style="color:#1a6b4a;text-align:center;">Welcome to PolyAttend</h2><p>Hello <strong>${name}</strong>,</p><div style="background:#f0fdf4;border:2px dashed #1a6b4a;border-radius:8px;padding:15px;text-align:center;margin:20px 0;"><span style="font-size:24px;font-weight:bold;color:#1a6b4a;letter-spacing:5px;">${otp}</span></div><p style="color:#64748b;font-size:13px;">Valid for 10 minutes.</p></div>`;
    try { await sendEmail({ email: normalizedEmail, subject: 'PolyAttend Email Verification Code', message: `OTP: ${otp}`, html }); }
    catch (e) { await prisma.pendingRegistration.delete({ where: { id: pending.id } }); throw e; }
    return NextResponse.json({ success: true, message: 'Registration successful! Check your email for verification code.', email: pending.email, requiresVerification: true }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
