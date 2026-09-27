import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
import { wantsJson, wantsPdf, fileResponse } from '@/lib/reportResponse';
import { buildSessionReportPDF } from '@/lib/pdfReport';
import { buildSessionReportExcel } from '@/lib/excelReport';
export const dynamic = 'force-dynamic';
export async function GET(request, { params }) {
  const auth = await requireAuth(request, ['teacher','admin','semesterAdmin']);
  if (auth.error) return auth.error;
  try {
    const { sessionId } = await params;
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { subject: { select: { id:true, name:true, code:true } }, teacher: { select: { id:true, name:true } }, department: { select: { id:true, name:true, code:true } } }
    });
    if (!session) return NextResponse.json({ success: false, message: 'Session not found' }, { status: 404 });
    const attendance = await prisma.attendance.findMany({
      where: { sessionId },
      include: { student: { select: { id:true, name:true, studentId:true, section:true } } },
      orderBy: { student: { name: 'asc' } }
    });

    if (wantsJson(request)) {
      return NextResponse.json({ success: true, session, attendance });
    }

    // The sheet lists every student in the session's class, including the
    // ones with no mark row yet — an absent student is still a row in a
    // register. The old JSON path only ever listed students who had a mark,
    // so a partially-taken session silently dropped the unmarked students.
    const allStudents = await prisma.user.findMany({
      where: {
        role: 'student',
        departmentId: session.departmentId,
        semester: session.semester,
        section: session.subjectId?.section ?? session.section,
        isActive: true,
        registered: true,
        ...(session.shift ? { shift: session.shift } : {}),
      },
      select: { id:true, name:true, studentId:true, section:true },
      orderBy: { name: 'asc' },
    });

    // presentMap is keyed sessionId -> studentId -> mark.
    const presentMap = {};
    const sKey = String(session.id);
    presentMap[sKey] = {};
    for (const a of attendance) presentMap[sKey][String(a.studentId)] = a;

    const dateStr = new Date(session.date).toLocaleDateString('en-BD').replace(/\//g, '-');
    const baseName = `session_${session.subject?.code || 'report'}_${dateStr}`;
    if (wantsPdf(request)) {
      const buffer = await buildSessionReportPDF({ session, allStudents, presentMap });
      return fileResponse(buffer, baseName, 'pdf');
    }
    const buffer = await buildSessionReportExcel({ session, allStudents, presentMap });
    return fileResponse(buffer, baseName, 'xlsx');
  } catch (error) { return errorResponse(error); }
}
