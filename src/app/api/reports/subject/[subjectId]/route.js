import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
import { wantsJson, wantsPdf, fileResponse } from '@/lib/reportResponse';
import { buildSubjectReportPDF } from '@/lib/pdfReport';
import { buildSubjectReportExcel } from '@/lib/excelReport';
export const dynamic = 'force-dynamic';
export async function GET(request, { params }) {
  const auth = await requireAuth(request, ['teacher','admin','semesterAdmin']);
  if (auth.error) return auth.error;
  try {
    const { subjectId } = await params;
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const subject = await prisma.subject.findUnique({ where: { id: subjectId }, include: { department: { select: { id:true, name:true, code:true } }, teacher: { select: { id:true, name:true } } } });
    if (!subject) return NextResponse.json({ success: false, message: 'Subject not found' }, { status: 404 });
    const dateFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    const students = await prisma.user.findMany({
      where: { role: 'student', departmentId: subject.departmentId, semester: subject.semester, section: subject.section, isActive: true, registered: true, ...(subject.shift ? { shift: subject.shift } : {}) },
      select: { id:true, name:true, studentId:true, section:true },
      orderBy: { name: 'asc' }
    });

    // ── Performance fix ────────────────────────────────────────────────
    // This used to load every session WITH its full attendances list, and
    // each attendance carried a nested copy of the student object — so the
    // same 40 students were transferred once per attendance row (thousands
    // of duplicated objects). The per-student count was then computed as
    // `students.map(s => sessions.filter(...some(...)))`, i.e.
    // students x sessions x attendances — roughly 160k iterations for one
    // subject report.
    //
    // Now: sessions are fetched without their attendances, the marks are
    // fetched once as three flat columns, and the counts are built in a
    // single pass. The student object is re-attached from the `students`
    // list we already have, so the JSON response is byte-for-byte the same
    // shape — nothing downstream has to change.
    const sessions = await prisma.session.findMany({
      where: { subjectId, ...(from||to ? { date: dateFilter } : {}) },
      orderBy: { date: 'asc' }
    });

    const sessionIds = sessions.map(s => s.id);
    let marks = [];
    if (sessionIds.length > 0) {
      marks = await prisma.attendance.findMany({
        where: { sessionId: { in: sessionIds } },
        select: { sessionId: true, studentId: true, status: true },
      });
    }

    const studentById = new Map(students.map(s => [s.id, s]));

    // marksBySession: sessionId -> attendance rows (re-shaped to keep the
    // original `attendances` key and nested `student` object).
    const marksBySession = new Map();
    for (const m of marks) {
      let list = marksBySession.get(m.sessionId);
      if (!list) { list = []; marksBySession.set(m.sessionId, list); }
      list.push({ studentId: m.studentId, status: m.status, student: studentById.get(m.studentId) || null });
    }

    const presentCountByStudent = new Map();
    for (const m of marks) {
      if (m.status === 'present') presentCountByStudent.set(m.studentId, (presentCountByStudent.get(m.studentId) || 0) + 1);
    }

    const sessionsWithAttendances = sessions.map(s => ({ ...s, attendances: marksBySession.get(s.id) || [] }));

    const settings = await prisma.settings.findFirst({ where: { key: 'global' } });
    const threshold = settings?.attendanceThreshold ?? 70;
    const totalSessions = sessions.length;
    const studentSummary = students.map(st => {
      const presents = presentCountByStudent.get(st.id) || 0;
      const pct = totalSessions ? Math.round((presents / totalSessions) * 100) : 0;
      return { ...st, presents, absents: totalSessions - presents, percentage: pct, belowThreshold: pct < threshold && totalSessions > 0 };
    });

    if (wantsJson(request)) {
      return NextResponse.json({ success: true, subject, sessions: sessionsWithAttendances, studentSummary, totalSessions, threshold });
    }

    // The report builders want the marks indexed as studentId -> sessionId
    // -> mark, which is what the attendance records already give us.
    const attMap = {};
    for (const m of marks) {
      const sKey = String(m.studentId);
      if (!attMap[sKey]) attMap[sKey] = {};
      attMap[sKey][String(m.sessionId)] = m;
    }

    const baseName = `${subject.code || 'subject'}_${subject.section || ''}_report`.replace(/_+/g, '_');
    if (wantsPdf(request)) {
      const buffer = await buildSubjectReportPDF({ subject, students, sessions, attMap });
      return fileResponse(buffer, baseName, 'pdf');
    }
    const buffer = await buildSubjectReportExcel({ subject, students, sessions, attMap });
    return fileResponse(buffer, baseName, 'xlsx');
  } catch (error) { return errorResponse(error); }
}
