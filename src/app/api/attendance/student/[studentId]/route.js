import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function withLegacyIds(record) {
  if (!record) return record;
  return {
    ...record,
    _id: record.id,
    departmentId: record.department
      ? { ...record.department, _id: record.department.id }
      : record.departmentId,
  };
}

function normalizeSubject(subject) {
  if (!subject) return subject;
  return {
    ...subject,
    _id: subject.id,
    departmentId: subject.department
      ? { ...subject.department, _id: subject.department.id }
      : subject.departmentId,
  };
}

export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { studentId } = await params;
    if (auth.user.role === 'student' && auth.user.id !== studentId) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: {
        id: true, name: true, studentId: true, departmentId: true,
        departmentCode: true, shift: true, semester: true, section: true,
        department: { select: { id: true, name: true, code: true } },
      },
    });
    if (!student) {
      return NextResponse.json({ success: false, message: 'Student not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subjectId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const where = { studentId };
    if (subjectId) where.subjectId = subjectId;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    // ── Performance fix ────────────────────────────────────────────────
    // This pulled `subject` (plus its department) and `session` for EVERY
    // attendance row, so a senior student's history re-transferred the same
    // handful of subject/department objects once per row — three joins and
    // hundreds of duplicated objects per request.
    //
    // Now the rows come back lean (foreign keys only) and the distinct
    // subjects/sessions are fetched once, then re-attached. The JSON the
    // student dashboard receives is unchanged.
    const leanRecords = await prisma.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    const subjectIds = [...new Set(leanRecords.map(r => r.subjectId).filter(Boolean))];
    const sessionIds = [...new Set(leanRecords.map(r => r.sessionId).filter(Boolean))];

    const [subjectRows, sessionRows] = await Promise.all([
      subjectIds.length
        ? prisma.subject.findMany({
            where: { id: { in: subjectIds } },
            select: {
              id: true, name: true, code: true, semester: true,
              section: true, shift: true,
              department: { select: { id: true, name: true, code: true } },
            },
          })
        : Promise.resolve([]),
      sessionIds.length
        ? prisma.session.findMany({ where: { id: { in: sessionIds } }, select: { id: true, date: true, startTime: true } })
        : Promise.resolve([]),
    ]);

    const subjectById = new Map(subjectRows.map(s => [s.id, s]));
    const sessionById = new Map(sessionRows.map(s => [s.id, s]));

    const records = leanRecords.map(record => ({
      ...record,
      subject: subjectById.get(record.subjectId) || null,
      session: sessionById.get(record.sessionId) || null,
    }));

    const normalizedRecords = records.map(record => ({
      ...withLegacyIds(record),
      subject: normalizeSubject(record.subject),
      session: record.session ? { ...record.session, _id: record.session.id } : record.session,
    }));

    // Preserve the response shape consumed by the existing student dashboard:
    // overall totals plus one summary row per subject with its records.
    const bySubject = new Map();
    normalizedRecords.forEach(record => {
      const id = record.subjectId;
      if (!id) return;
      if (!bySubject.has(id)) {
        bySubject.set(id, {
          subject: record.subject,
          total: 0,
          present: 0,
          absent: 0,
          records: [],
        });
      }
      const item = bySubject.get(id);
      item.total += 1;
      item[record.status] = (item[record.status] || 0) + 1;
      item.records.push(record);
    });

    const summary = Array.from(bySubject.values()).map(item => ({
      ...item,
      percentage: item.total ? Math.round((item.present / item.total) * 100) : 0,
    }));
    const total = normalizedRecords.length;
    const present = normalizedRecords.filter(record => record.status === 'present').length;

    return NextResponse.json({
      success: true,
      count: total,
      student: withLegacyIds(student),
      records: normalizedRecords,
      summary,
      overall: {
        total,
        present,
        absent: total - present,
        percentage: total ? Math.round((present / total) * 100) : 0,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
