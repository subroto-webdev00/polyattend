import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, hashPassword, errorResponse } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  const auth = await requireAuth(request, ['admin']);
  if (auth.error) return auth.error;
  try {
    const { name, email, password, role, studentId, departmentId, semester, section, shift } = await request.json();
    const existing = await prisma.user.findFirst({ where: { email: email.toLowerCase() } });
    if (existing) return NextResponse.json({ success: false, message: 'Email already registered' }, { status: 400 });
    const hashed = await hashPassword(password);
    const user = await prisma.user.create({ data: { name, email: email.toLowerCase(), password: hashed, role, studentId, departmentId, semester, section, shift, isVerified: true } });
    const safeUser = { ...user };
    delete safeUser.password;
    return NextResponse.json({ success: true, message: 'User created successfully', user: safeUser }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
