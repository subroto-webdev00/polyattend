import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import prisma from './db';

export function generateToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
}

export function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export function comparePassword(plain, hashed) {
  return bcrypt.compare(plain, hashed);
}

export function normalizeSemesterAdmin(user) {
  if (user?.role === 'semesterAdmin' && (!user.semesters?.length) && user.semester) {
    user.semesters = [user.semester];
  }
  return user;
}

// Shared "departmentId populate" shapes, reused across the report routes.
export const deptSelect = { id: true, name: true, code: true };
export const subjSelect = { id: true, name: true, code: true, semester: true, section: true, shift: true };
export const teacherSelect = { id: true, name: true, email: true, mobile: true };
export const studentSelect = { id: true, name: true, studentId: true, section: true };

export async function requireAuth(request, roles = null) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return { error: NextResponse.json({ success: false, message: 'Not authorized, no token' }, { status: 401 }) };
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true, name: true, email: true, role: true, shift: true,
        departmentId: true, departmentCode: true, semesters: true,
        semester: true, section: true, subjectId: true, studentId: true,
        mobile: true, createdById: true, isActive: true, isVerified: true, registered: true,
      },
    });

    if (!user || !user.isActive) {
      return { error: NextResponse.json({ success: false, message: 'User not found or inactive' }, { status: 401 }) };
    }

    if (roles && !roles.includes(user.role)) {
      return { error: NextResponse.json({ success: false, message: `Role '${user.role}' is not authorized` }, { status: 403 }) };
    }

    normalizeSemesterAdmin(user);
    // Mongoose compat: _id alias
    user._id = user.id;
    return { user };

  } catch {
    return { error: NextResponse.json({ success: false, message: 'Not authorized, token failed' }, { status: 401 }) };
  }
}

export function errorResponse(error, status = 500) {
  console.error('[API ERROR]', error);
  const raw = error?.message || '';
  const isRawJsCrash = /Cannot read propert(y|ies) of (null|undefined)/i.test(raw) || error instanceof TypeError;
  const message = isRawJsCrash
    ? 'An unexpected problem occurred. Please try again.'
    : raw || 'Server error';
  return NextResponse.json(
    { success: false, message, debug: process.env.NODE_ENV !== 'production' ? raw : undefined },
    { status }
  );
}
