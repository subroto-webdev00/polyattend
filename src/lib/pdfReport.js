import PDFDocument from 'pdfkit';

// pdfkit loads its built-in fonts lazily through ITS OWN package.json
// `imports` field (`#standard-fonts/Helvetica` -> `js/standard-fonts/*.cjs`).
// Webpack cannot resolve those `#` specifiers and the file tracer cannot
// follow them either, so before this import every report route traced 0 font
// files: the deployed lambda carried pdfkit's code but none of its fonts, and
// every PDF download died with `Cannot find module '#standard-fonts/Helvetica'`.
// The helper pulls in the two faces we use via pdfkit's `require` condition —
// the very files its lazy loader asks for at runtime. Add a line there if a
// report ever needs Times/Courier/Symbol.
import './pdfkitFonts.cjs';

// ── FEATURE: PDF download alongside Excel ──────────────────────────────────
// Every place that already offers an Excel (.xlsx) report download now also
// offers a PDF version, generated here with `pdfkit` (a pure-JS PDF library,
// safe to use in a Node.js serverless route — no native binaries needed).
//
// IMPORTANT SETUP NOTE FOR THE PROJECT: this file requires the `pdfkit`
// package. If it isn't already a dependency, add it:
//     npm install pdfkit
//
// NOTE ON FONTS: this uses pdfkit's built-in Helvetica font, which only
// supports Latin/English characters — not Bangla script. If student/subject
// names are typed in Bangla anywhere, those specific characters won't render
// in the PDF (Excel doesn't have this limitation since it just uses whatever
// font Excel opens with). Embedding a Bangla font (e.g. Noto Sans Bengali)
// is possible later if needed, but is a separate, larger change.

const GREEN = '#1a6b4a';
const AMBER = '#92400e';
const RED = '#991b1b';
const GRAY = '#64748b';
const SECTION_BG = '#e2e8f0';
const SECTION_TEXT = '#1e293b';
const ZEBRA_BG = '#f8fafc';
const TEXT = '#1e293b';

function streamToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

function newDoc() {
  return new PDFDocument({ size: 'A4', margin: 36, bufferPages: true });
}

function header(doc, title, subtitleLines) {
  doc.font('Helvetica-Bold').fontSize(16).fillColor(GREEN).text(title, { align: 'center' });
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(9).fillColor(GRAY);
  subtitleLines.forEach((line) => doc.text(line, { align: 'center' }));
  doc.moveDown(0.6);
}

// `legend()` was removed along with the "Last Self?" column: the only two
// things it ever explained were the self-marking marker and the Group
// grouping, and the grouping is self-evident from the "Group: X" rows.

const tableWidth = (columns) => columns.reduce((sum, c) => sum + c.width, 0);

// Generic row-based table renderer used by every report below. Supports
// plain data rows, a "section header" row (used to group students by
// Section, per the request that everywhere a Section is listed, students
// should be grouped by it), pagination, zebra striping, and per-cell colors.
function drawTable(doc, { columns, rows, startX, rowHeight = 20 }) {
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  let y = doc.y;

  const drawHeaderRow = () => {
    doc.rect(startX, y, tableWidth(columns), rowHeight).fill(GREEN);
    let x = startX;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff');
    columns.forEach((col) => {
      doc.text(col.label, x + 4, y + 6, { width: col.width - 8, align: col.align || 'left' });
      x += col.width;
    });
    y += rowHeight;
  };

  drawHeaderRow();

  rows.forEach((row, i) => {
    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      y = doc.page.margins.top;
      drawHeaderRow();
    }

    if (row.isGroupHeader) {
      doc.rect(startX, y, tableWidth(columns), rowHeight).fill(SECTION_BG);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(SECTION_TEXT);
      doc.text(row.label, startX + 4, y + 6, { width: tableWidth(columns) - 8 });
      y += rowHeight;
      return;
    }

    const rowBg = row.bg || (i % 2 === 1 ? ZEBRA_BG : null);
    if (rowBg) doc.rect(startX, y, tableWidth(columns), rowHeight).fill(rowBg);

    let x = startX;
    doc.font('Helvetica').fontSize(8);
    columns.forEach((col) => {
      const val = row.cells[col.key];
      doc.fillColor((row.cellColors && row.cellColors[col.key]) || TEXT);
      doc.text(val === undefined || val === null || val === '' ? '-' : String(val), x + 4, y + 6, {
        width: col.width - 8,
        align: col.align || 'left',
      });
      x += col.width;
    });
    y += rowHeight;
  });

  doc.y = y + 10;
}

// Groups a flat list of rows by `row.groupKey`, inserting a group-header row
// (labelled "Section: X") before each group's rows. Used everywhere a
// student list is shown with a Section, so sections are visually grouped
// instead of interleaved.
function groupRowsBySection(rows) {
  const groups = new Map();
  rows.forEach((r) => {
    const key = r.groupKey ?? '—';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });
  const out = [];
  [...groups.keys()].sort().forEach((key) => {
    out.push({ isGroupHeader: true, label: `Group: ${key}` });
    out.push(...groups.get(key));
  });
  return out;
}

// ── Subject report: one row per student, grouped by Section ───────────────
// `subject` is accepted in either the old populated shape
// (`subject.departmentId.name`) or the current Prisma shape
// (`subject.department.name` / `subject.teacher.name`) — this file was
// written before the Prisma migration and was never updated, which is why
// nothing imported it. The same tolerance is applied to the session and
// student builders below.
export async function buildSubjectReportPDF({ subject, students, sessions, attMap }) {
  const doc = newDoc();
  const bufferPromise = streamToBuffer(doc);

  const deptName = subject.departmentId?.name || subject.department?.name || 'N/A';
  const teacherName = subject.teacherId?.name || subject.teacher?.name || 'N/A';

  header(doc, `ATTENDANCE REPORT - ${deptName}`, [
    `Subject: ${subject.name} (${subject.code}) | Semester: ${subject.semester} | Shift: ${subject.shift || 'N/A'} | Teacher: ${teacherName}`,
  ]);

  const columns = [
    { key: 'idx', label: '#', width: 24, align: 'center' },
    { key: 'studentId', label: 'Student ID', width: 70 },
    { key: 'name', label: 'Name', width: 130 },
    { key: 'total', label: 'Total', width: 42, align: 'center' },
    { key: 'present', label: 'Present', width: 50, align: 'center' },
    { key: 'absent', label: 'Absent', width: 46, align: 'center' },
    { key: 'pct', label: '%', width: 42, align: 'center' },
  ];

  const rows = students.map((student, idx) => {
    const sid = String(student._id ?? student.id);
    const recs = attMap[sid] || {};
    const total = sessions.length;
    let present = 0;
    for (const s of sessions) {
      if (recs[String(s._id ?? s.id)]?.status === 'present') present += 1;
    }
    const absent = total - present;
    const pct = total ? Math.round((present / total) * 100) : 0;

    const pctColor = pct >= 75 ? GREEN : pct >= 60 ? AMBER : RED;

    return {
      groupKey: student.section,
      cells: {
        idx: idx + 1,
        studentId: student.studentId,
        name: student.name,
        total,
        present,
        absent,
        pct: `${pct}%`,
      },
      cellColors: { pct: pctColor },
    };
  });

  drawTable(doc, { columns, rows: groupRowsBySection(rows), startX: doc.page.margins.left });

  // Pin the cursor back to the left margin before writing the footer.
  // drawTable leaves `doc.x` sitting at the last cell (the table's right
  // edge), so without this the footer starts mid-page and wraps onto
  // several short lines instead of one line under the table.
  const left = doc.page.margins.left;
  const contentWidth = doc.page.width - left - doc.page.margins.right;
  doc.font('Helvetica').fontSize(8).fillColor(GRAY);
  doc.x = left;
  doc.y += 6;
  doc.text(
    `Total Students: ${students.length}   |   Total Classes: ${sessions.length}   |   Generated: ${new Date().toLocaleString('en-BD')}`,
    left,
    doc.y,
    { width: contentWidth, align: 'left' },
  );

  doc.end();
  return bufferPromise;
}

// ── Class / session report: present-or-absent list for one session ────────
export async function buildSessionReportPDF({ session, allStudents, presentMap }) {
  const doc = newDoc();
  const bufferPromise = streamToBuffer(doc);

  const deptName = session.departmentId?.name || session.department?.name || 'N/A';
  const subjectName = session.subjectId?.name || session.subject?.name || 'N/A';
  const teacherName = session.teacherId?.name || session.teacher?.name || 'N/A';

  header(doc, `${deptName} - Attendance Sheet`, [
    `Subject: ${subjectName} | Semester: ${session.semester} | Shift: ${session.shift || 'N/A'} | Date: ${new Date(session.date).toLocaleDateString('en-BD')} | Teacher: ${teacherName}`,
  ]);

  const columns = [
    { key: 'idx', label: '#', width: 26, align: 'center' },
    { key: 'studentId', label: 'Student ID', width: 76 },
    { key: 'name', label: 'Name', width: 150 },
    { key: 'status', label: 'Status', width: 60, align: 'center' },
    { key: 'time', label: 'Marked Time', width: 90, align: 'center' },
  ];

  // presentMap is keyed sessionId -> studentId -> mark, matching the shape
  // the route builds (and the Excel builder).
  const sessionKey = String(session._id ?? session.id);
  const marks = presentMap[sessionKey] || {};

  const rows = allStudents.map((student, idx) => {
    const rec = marks[String(student._id ?? student.id)];
    const isPresent = !!rec && rec.status === 'present';
    return {
      groupKey: student.section,
      cells: {
        idx: idx + 1,
        studentId: student.studentId,
        name: student.name,
        status: isPresent ? 'Present' : 'Absent',
        time: rec?.scannedAt ? new Date(rec.scannedAt).toLocaleTimeString('en-BD') : '-',
      },
      cellColors: {
        status: isPresent ? GREEN : RED,
      },
    };
  });

  // Count from `marks` (this session's marks), not from `presentMap`:
  // presentMap is keyed sessionId -> studentId, so Object.values on it
  // yields one object per SESSION, not per mark, and the count came out 0.
  const presentCount = Object.values(marks).filter((m) => m && m.status === 'present').length;

  drawTable(doc, { columns, rows: groupRowsBySection(rows), startX: doc.page.margins.left });

  // Same left-margin fix as the subject report: drawTable leaves doc.x at the
  // table's right edge, which would wrap this line onto several lines.
  const sLeft = doc.page.margins.left;
  doc.x = sLeft;
  doc.y += 6;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT).text(
    `Total: ${allStudents.length}   Present: ${presentCount}   Absent: ${allStudents.length - presentCount}   Percentage: ${allStudents.length ? Math.round((presentCount / allStudents.length) * 100) : 0}%`,
    sLeft,
    doc.y,
    { width: doc.page.width - sLeft - doc.page.margins.right, align: 'left' },
  );

  doc.end();
  return bufferPromise;
}

// ── Student report: one student's own history across all subjects ─────────
export async function buildStudentReportPDF({ student, bySubject, records }) {
  const doc = newDoc();
  const bufferPromise = streamToBuffer(doc);

  const deptName = student.departmentId?.name || student.department?.name || 'N/A';
  header(doc, `STUDENT ATTENDANCE REPORT`, [
    `${student.name} (${student.studentId}) | ${deptName} | Semester: ${student.semester} | Group: ${student.section}`,
  ]);

  doc.font('Helvetica-Bold').fontSize(11).fillColor(GREEN).text('Subject-wise Summary');
  doc.moveDown(0.3);

  const summaryColumns = [
    { key: 'subject', label: 'Subject', width: 150 },
    { key: 'code', label: 'Code', width: 60 },
    { key: 'total', label: 'Total', width: 60, align: 'center' },
    { key: 'present', label: 'Present', width: 60, align: 'center' },
    { key: 'absent', label: 'Absent', width: 60, align: 'center' },
    { key: 'pct', label: '%', width: 60, align: 'center' },
  ];
  const summaryRows = Object.values(bySubject).map((s) => {
    const pct = s.total ? Math.round((s.present / s.total) * 100) : 0;
    return {
      cells: { subject: s.subject?.name, code: s.subject?.code, total: s.total, present: s.present, absent: s.absent, pct: `${pct}%` },
      cellColors: { pct: pct >= 75 ? GREEN : pct >= 60 ? AMBER : RED },
    };
  });
  drawTable(doc, { columns: summaryColumns, rows: summaryRows, startX: doc.page.margins.left });

  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(GREEN).text('Date-wise Records');
  doc.moveDown(0.3);

  const recordColumns = [
    { key: 'date', label: 'Date', width: 90 },
    { key: 'subject', label: 'Subject', width: 150 },
    { key: 'code', label: 'Code', width: 60 },
    { key: 'status', label: 'Status', width: 60, align: 'center' },
  ];
  const recordRows = records.map((r) => ({
    cells: {
      date: new Date(r.date).toLocaleDateString('en-BD'),
      // Accept both the populated relation (`subjectId`) and the Prisma key
      // (`subject`), since the two report paths normalise differently.
      subject: r.subjectId?.name || r.subject?.name || '-',
      code: r.subjectId?.code || r.subject?.code || '-',
      status: r.status,
    },
    cellColors: {
      status: r.status === 'present' ? GREEN : RED,
    },
  }));
  drawTable(doc, { columns: recordColumns, rows: recordRows, startX: doc.page.margins.left });

  doc.end();
  return bufferPromise;
}
