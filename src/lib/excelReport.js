import ExcelJS from 'exceljs';

// ── FEATURE: Excel (.xlsx) report downloads ────────────────────────────────
// Companion to `pdfReport.js`. Every report that can be downloaded as a PDF
// can also be downloaded as a real Excel workbook, built here with `exceljs`.
//
// Before this existed the report routes returned JSON for both formats, so a
// file named "report.xlsx" actually contained JSON and Excel refused to open
// it. These builders emit a genuine workbook (a ZIP container), which is why
// the tests assert the PK magic bytes.
//
// A note on ids: these builders accept the *normalised* shapes the report
// routes already produce, i.e. records carry both `id` and `_id`, and
// populated relations are the objects the query returned (`subject`,
// `department`, `session`, `teacher`).

const GREEN = 'FF1A6B4A';
const HEADER_FILL = 'FF1A6B4A';
const ZEBRA = 'FFF1F5F9';

function pctOf(present, total) {
  return total ? Math.round((present / total) * 100) : 0;
}

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  row.alignment = { vertical: 'middle', horizontal: 'center' };
  row.height = 20;
}

function styleBody(ws, fromRow, zebra = true) {
  for (let r = fromRow; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (zebra && (r - fromRow) % 2 === 1) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
    }
    row.alignment = { vertical: 'middle' };
  }
}

function autoWidth(ws, min = 10, max = 34) {
  for (let c = 1; c <= ws.columnCount; c++) {
    const col = ws.getColumn(c);
    let width = min;
    col.eachCell({ includeEmpty: false }, cell => {
      const text = cell.value == null ? '' : String(cell.value);
      width = Math.max(width, Math.min(text.length + 3, max));
    });
    col.width = width;
  }
}

function titleBlock(ws, title, subtitle) {
  const t = ws.addRow([title]);
  t.font = { bold: true, size: 14, color: { argb: GREEN } };
  const s = ws.addRow([subtitle]);
  s.font = { size: 10, color: { argb: 'FF475569' } };
  ws.addRow([]);
  return ws.rowCount + 1;
}

async function toBuffer(workbook) {
  // exceljs writes to a stream; collect it into a Buffer for the route.
  return workbook.xlsx.writeBuffer();
}

// ── Subject report: one row per student, grouped by Section ───────────────
export async function buildSubjectReportExcel({ subject, students, sessions, attMap }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PolyAttend';
  wb.created = new Date();
  const ws = wb.addWorksheet('Attendance');

  const start = titleBlock(
    ws,
    `ATTENDANCE REPORT - ${subject.departmentId?.name || subject.department?.name || 'N/A'}`,
    `Subject: ${subject.name} (${subject.code}) | Semester: ${subject.semester} | Shift: ${subject.shift || 'N/A'} | Teacher: ${subject.teacherId?.name || subject.teacher?.name || 'N/A'}`,
  );

  ws.addRow(['#', 'Student ID', 'Name', 'Group', 'Total', 'Present', 'Absent', '%', 'Last Self?'])
    .eachCell((c) => (c.border = {}));
  styleHeader(ws.getRow(start));

  const total = sessions.length;
  let idx = 0;
  for (const student of students) {
    const sid = String(student._id || student.id);
    const recs = attMap[sid] || {};
    let present = 0;
    let selfCount = 0;
    for (const s of sessions) {
      const rec = recs[String(s._id || s.id)];
      if (rec?.status === 'present') present++;
      if (rec?.markedBy === 'self') selfCount++;
    }
    const pct = pctOf(present, total);
    const row = ws.addRow([
      ++idx,
      student.studentId || '',
      student.name || '',
      student.section || '',
      total,
      present,
      total - present,
      pct / 100,
      selfCount > 0 ? `${selfCount}x Self` : '-',
    ]);
    row.getCell(8).numFmt = '0%';
    if (pct >= 75) row.getCell(8).font = { color: { argb: GREEN }, bold: true };
    else if (pct < 60) row.getCell(8).font = { color: { argb: 'FFB91C1C' }, bold: true };
  }

  styleBody(ws, start + 1);
  autoWidth(ws);
  ws.views = [{ state: 'frozen', ySplit: start }];
  return toBuffer(wb);
}

// ── Class / session report: present-or-absent list for one session ────────
export async function buildSessionReportExcel({ session, allStudents, presentMap }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PolyAttend';
  const ws = wb.addWorksheet('Attendance Sheet');

  const start = titleBlock(
    ws,
    `${session.departmentId?.name || session.department?.name || 'N/A'} - Attendance Sheet`,
    `Subject: ${session.subjectId?.name || session.subject?.name || 'N/A'} | Semester: ${session.semester} | Shift: ${session.shift || 'N/A'} | Date: ${new Date(session.date).toLocaleDateString('en-BD')} | Teacher: ${session.teacherId?.name || session.teacher?.name || 'N/A'}`,
  );

  ws.addRow(['#', 'Student ID', 'Name', 'Group', 'Status']);
  styleHeader(ws.getRow(start));

  const sid = String(session._id || session.id);
  allStudents.forEach((student, i) => {
    const rec = presentMap[sid]?.[String(student._id || student.id)];
    const status = rec?.status || 'absent';
    const row = ws.addRow([
      i + 1,
      student.studentId || '',
      student.name || '',
      student.section || '',
      status,
    ]);
    const isSelf = rec?.markedBy === 'self';
    row.getCell(5).font = status === 'present'
      ? { color: { argb: GREEN }, bold: true }
      : { color: { argb: 'FFB91C1C' } };
    if (isSelf) row.getCell(5).value = 'present (self)';
  });

  styleBody(ws, start + 1);
  autoWidth(ws);
  ws.views = [{ state: 'frozen', ySplit: start }];
  return toBuffer(wb);
}

// ── Student report: summary + full date-wise history, two sheets ──────────
export async function buildStudentReportExcel({ student, bySubject, records }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PolyAttend';

  // Sheet 1: subject-wise summary
  const sum = wb.addWorksheet('Summary');
  const start = titleBlock(
    sum,
    'STUDENT ATTENDANCE REPORT',
    `${student.name} (${student.studentId || ''}) | ${student.departmentId?.name || student.department?.name || 'N/A'} | Semester: ${student.semester} | Group: ${student.section || ''}`,
  );
  sum.addRow(['Subject', 'Code', 'Total', 'Present', 'Absent', '%']);
  styleHeader(sum.getRow(start));

  for (const s of Object.values(bySubject)) {
    const pct = pctOf(s.present, s.total);
    const row = sum.addRow([
      s.subject?.name || '-',
      s.subject?.code || '-',
      s.total,
      s.present,
      s.absent,
      pct / 100,
    ]);
    row.getCell(6).numFmt = '0%';
    if (pct >= 75) row.getCell(6).font = { color: { argb: GREEN }, bold: true };
    else if (pct < 60) row.getCell(6).font = { color: { argb: 'FFB91C1C' }, bold: true };
  }
  styleBody(sum, start + 1);
  autoWidth(sum);
  sum.views = [{ state: 'frozen', ySplit: start }];

  // Sheet 2: every individual mark
  const det = wb.addWorksheet('Records');
  const dstart = titleBlock(
    det,
    'Date-wise Records',
    `${student.name} (${student.studentId || ''}) - ${records.length} record(s)`,
  );
  det.addRow(['Date', 'Subject', 'Code', 'Status', 'Method']);
  styleHeader(det.getRow(dstart));

  for (const r of records) {
    const method = r.status !== 'present'
      ? '-'
      : r.markedBy === 'self' ? 'Self'
      : r.markedBy === 'manual' ? 'Manual'
      : r.markedBy === 'search' ? 'Search' : '-';
    const row = det.addRow([
      new Date(r.date).toLocaleDateString('en-BD'),
      r.subjectId?.name || '-',
      r.subjectId?.code || '-',
      r.status,
      method,
    ]);
    row.getCell(4).font = r.status === 'present'
      ? { color: { argb: GREEN }, bold: true }
      : { color: { argb: 'FFB91C1C' } };
  }
  styleBody(det, dstart + 1);
  autoWidth(det);
  det.views = [{ state: 'frozen', ySplit: dstart }];

  return toBuffer(wb);
}
