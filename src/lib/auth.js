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

// Every Semester a diploma programme runs.
const ALL_SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

// A Department Admin is department-wide: they manage every Semester in their
// Department, not the single Semester their row happens to carry. Older rows
// were created before that was the rule and hold either no array or a one-entry
// one, which made the Promotion page render "No Semester is assigned to you"
// and the semester tabs collapse to one — even though the admin could in fact
// see and promote students in all eight.
//
// So the grant is re-derived from the ROLE here rather than trusted from the
// column, and the column is only used as a sanity check. Returning all eight
// is not a privilege escalation: every department-admin API route independently
// re-checks the caller's own department and shift before returning anything.
export function normalizeDepartmentAdmin(user) {
  if (user?.role === 'departmentAdmin') {
    user.semesters = [...ALL_SEMESTERS];
    // `semester` is kept in step so any consumer still reading the singular
    // column agrees with the array rather than contradicting it.
    if (!user.semester || !ALL_SEMESTERS.includes(Number(user.semester))) {
      user.semester = 1;
    }
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

    normalizeDepartmentAdmin(user);
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
