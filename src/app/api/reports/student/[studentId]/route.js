import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
import { wantsJson, wantsPdf, fileResponse } from '@/lib/reportResponse';
import { buildStudentReportPDF } from '@/lib/pdfReport';
import { buildStudentReportExcel } from '@/lib/excelReport';
export const dynamic = 'force-dynamic';
export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  try {
    const { studentId } = await params;
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subjectId');
    if (auth.user.role === 'student' && auth.user.id !== studentId)
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    const student = await prisma.user.findUnique({ where: { id: studentId }, select: { id:true, name:true, studentId:true, semester:true, section:true, shift:true, department: { select: { id:true, name:true, code:true } } } });
    if (!student) return NextResponse.json({ success: false, message: 'Student not found' }, { status: 404 });
    const where = { studentId };
    if (subjectId) where.subjectId = subjectId;
    const records = await prisma.attendance.findMany({
      where,
      include: { subject: { select: { id:true, name:true, code:true } }, session: { select: { id:true, date:true, status:true } } },
      orderBy: { date: 'desc' }
    });
    const subjects = await prisma.subject.findMany({
      where: { departmentId: student.department?.id || undefined, semester: student.semester || undefined, ...(student.shift ? { shift: student.shift } : {}), isActive: true },
      select: { id:true, name:true, code:true }
    });
    const settings = await prisma.settings.findFirst({ where: { key: 'global' } });
    const threshold = settings?.attendanceThreshold ?? 70;
    // Performance: the summary used to re-scan the entire history for every
    // subject (`subjects.map(sub => records.filter(...))` = subjects x records).
    // Grouping once by subjectId makes it a single pass. Output is identical.
    const statsBySubject = new Map();
    for (const r of records) {
      let s = statsBySubject.get(r.subjectId);
      if (!s) { s = { total: 0, present: 0 }; statsBySubject.set(r.subjectId, s); }
      s.total += 1;
      if (r.status === 'present') s.present += 1;
    }
    const summary = subjects.map(sub => {
      const { total, present } = statsBySubject.get(sub.id) || { total: 0, present: 0 };
      const pct = total ? Math.round((present / total) * 100) : 0;
      return { subject: sub, total, present, absent: total - present, percentage: pct, belowThreshold: pct < threshold && total > 0 };
    });

    if (wantsJson(request)) {
      return NextResponse.json({ success: true, student, summary, records, threshold });
    }

    // The report builders index by subject, keyed on the subject id.
    const bySubject = {};
    for (const s of summary) {
      bySubject[String(s.subject.id)] = { subject: s.subject, total: s.total, present: s.present, absent: s.absent };
    }
    // The per-record subject label is read as `subjectId` by the builders.
    const labelledRecords = records.map(r => ({
      ...r,
      subjectId: r.subjectId,
      subject: subjects.find(s => s.id === r.subjectId) || null,
    }));

    const baseName = `student_${student.studentId || 'report'}_report`;
    if (wantsPdf(request)) {
      const buffer = await buildStudentReportPDF({ student, bySubject, records: labelledRecords });
      return fileResponse(buffer, baseName, 'pdf');
    }
    const buffer = await buildStudentReportExcel({ student, bySubject, records: labelledRecords });
    return fileResponse(buffer, baseName, 'xlsx');
  } catch (error) { return errorResponse(error); }
}
