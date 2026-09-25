import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, normalizeSemesterAdmin, errorResponse } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      include: { department: { select: { id: true, name: true, code: true } }, subject: { select: { id: true, name: true, code: true, semester: true, section: true, shift: true } } },
    });
    const { password: _, ...safeUser } = user;
    safeUser._id = safeUser.id;
    // Match the login response shape used by the frontend. Without this,
    // /auth/me overwrites the populated department object with the raw
    // department UUID and dashboards display an internal ID to the user.
    safeUser.departmentId = safeUser.department
      ? { ...safeUser.department, _id: safeUser.department.id }
      : safeUser.departmentId;
    normalizeSemesterAdmin(safeUser);
    return NextResponse.json({ success: true, user: safeUser });
  } catch (error) { return errorResponse(error); }
}
