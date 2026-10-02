import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import sendEmail from '@/lib/sendEmail';
import { generateInviteCode, oneMonthFromNow } from '@/lib/inviteCode';
import { requireAuth, errorResponse } from '@/lib/auth';
import { inviteCodeEmail } from '@/lib/notify';
import { cacheWrap, cacheDelPrefix, cacheKey } from '@/lib/cache';
import ExcelJS from 'exceljs';
export const dynamic = 'force-dynamic';
const GROUPS = ['A','B','C','D'];
function toEntry(u) { return { _id: u.id, id: u.id, name: u.name || '', roll: u.studentId, studentId: u.studentId, email: u.email, mobile: u.mobile, section: u.section, semester: u.semester, used: u.registered !== false, usedByUserId: u.registered !== false ? { name: u.name } : null, createdAt: u.createdAt }; }
// A Department Admin is department-wide, so every Semester a diploma programme
// runs (1-8) is in scope for them. The old narrow list came from the
// per-account `semesters` grant, which belonged to the removed role split and
// left the tabs stuck at whatever the account happened to hold.
const ALL_SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
function allowedList() { return ALL_SEMESTERS; }
function inScope(allowed, semester) { return allowed.includes(Number(semester)); }
function querySemester(request) { return new URL(request.url).searchParams.get('semester'); }
function parseSemester(value, fallback) {
  const raw = value != null && value !== '' ? value : fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : NaN;
}
function cellText(v) { if (v===null||v===undefined) return ''; if (v instanceof Date) return v.toISOString(); if (typeof v==='object') { if (typeof v.text==='string') return v.text; if (Array.isArray(v.richText)) return v.richText.map(r=>r.text).join(''); if (v.result!==undefined) return String(v.result); return ''; } return String(v); }
function parseCsvText(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
  const rows = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; continue; }
      if ((c === ',' || c === ';' || c === '\t') && !inQ) { cells.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    cells.push(cur.trim());
    rows.push(cells);
  }
  return rows;
}
function columnMap(headerCells) {
  const norm = (headerCells || []).map(c => String(c || '').trim().toLowerCase());
  const find = (...names) => {
    for (const n of names) {
      const i = norm.findIndex(h => h === n || h.replace(/\s+/g, '') === n.replace(/\s+/g, '') || h.includes(n));
      if (i >= 0) return i;
    }
    return -1;
  };
  const name = find('name', 'full name', 'student name');
  const roll = find('roll', 'student id', 'studentid');
  const email = find('email', 'mail');
  const group = find('group', 'section');
  if (roll >= 0 && email >= 0 && group >= 0) return { name: name >= 0 ? name : -1, roll, email, group, hasHeader: true };
  if ((headerCells || []).length >= 4) return { name: 0, roll: 1, email: 2, group: 3, hasHeader: false };
  return { name: -1, roll: 0, email: 1, group: 2, hasHeader: false };
}
async function rowsFromUpload(file) {
  const name = (file.name || '').toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    return parseCsvText(buffer.toString('utf8'));
  }
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    if (!ws) return [];
    const rows = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cells[col - 1] = cellText(cell.value);
      });
      rows.push(cells.map(c => c || ''));
    });
    return rows;
  } catch {
    throw new Error('Could not read this file. Upload an .xlsx or .csv with Name, Roll, Email and Group columns.');
  }
}
async function addOneEntry({ name, roll, email, section, scope, invitedBy }) {
  const nn=String(name||'').trim(), nr=String(roll||'').trim(), ne=String(email||'').toLowerCase().trim(), ns=String(section||'').trim().toUpperCase();
  if (!nn||!nr||!ne||!ns) return { ok: false, reason: 'Name, Roll, Email and Group are required' };
  if (!/^\S+@\S+\.\S+$/.test(ne)) return { ok: false, reason: 'Not a valid Email' };
  if (!GROUPS.includes(ns)) return { ok: false, reason: 'Group must be A, B, C or D' };
  const byRoll = await prisma.user.findFirst({ where: { studentId: nr } });
  if (byRoll) return { ok: false, reason: byRoll.registered===false ? 'This Roll is already pre-approved' : 'This Roll is already registered' };
  const byEmail = await prisma.user.findFirst({ where: { email: ne } });
  if (byEmail) { if (byEmail.role!=='student') return { ok: false, reason: 'This Email belongs to a different type of account' }; return { ok: false, reason: byEmail.registered===false ? `This Email is already pre-approved for Roll ${byEmail.studentId}` : `This Email is already registered as Roll ${byEmail.studentId}` }; }
  const code = generateInviteCode();
  const student = await prisma.user.create({ data: { name: nn, email: ne, studentId: nr, section: ns, role: 'student', registered: false, isActive: true, isVerified: false, ...scope, createdById: invitedBy, regCode: code, regCodeExpire: oneMonthFromNow() } });
  // Use the same standard invitation email as Department/Department Admin
  // invites. This keeps the Student wording, layout, expiry instruction, and
  // security guidance consistent across single and Excel-based invites.
  const { subject, message, html } = inviteCodeEmail({ name: nn, role: 'student', code });
  try { await sendEmail({ email: ne, subject, message, html }); } catch {}
  return { ok: true, entry: toEntry(student) };
}
export async function GET(request) {
  const auth = await requireAuth(request, ['departmentAdmin']);
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const allowedSemesters = allowedList();
    const semesterNum = searchParams.get('semester')!=null ? parseInt(searchParams.get('semester'), 10) : (allowedSemesters.length===1 ? allowedSemesters[0] : null);
    if (semesterNum==null || !Number.isFinite(semesterNum)) return NextResponse.json({ success: false, message: 'Select which Semester to view' }, { status: 400 });
    if (!inScope(allowedSemesters, semesterNum)) return NextResponse.json({ success: false, message: 'That Semester is outside your scope' }, { status: 403 });
    const promotionRoster = searchParams.get('promotionRoster') === 'true';
    const where = {
      role: 'student',
      departmentId: auth.user.departmentId,
      shift: auth.user.shift,
      semester: semesterNum,
    };
    if (promotionRoster) {
      where.isActive = true;
      where.registered = true;
    } else {
      // Older failed cancellation attempts only set isActive=false. Hide
      // those stale pending shadows; completed inactive students remain
      // visible so an admin can reactivate them if needed.
      where.OR = [{ registered: true }, { isActive: true }];
    }
    // This is the call the Department Admin dashboard fires EIGHT times on
    // load, once per semester, purely to count students. Cached per
    // (department, shift, semester, roster) so those eight calls collapse into
    // one query and eight database connections instead.
    const { value: students, cached } = await cacheWrap(
      cacheKey('deptadmin', 'students', auth.user.departmentId || '-', auth.user.shift || '-', semesterNum, promotionRoster ? 'roster' : 'all'),
      20,
      () => prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true, studentId: true, mobile: true, section: true, semester: true, registered: true, isActive: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      })
    );
    const response = NextResponse.json({ success: true, entries: students.map(toEntry), semester: semesterNum });
    response.headers.set('X-Cache', cached ? 'HIT' : 'MISS');
    return response;
  } catch (error) { return errorResponse(error); }
}
export async function POST(request) {
  const auth = await requireAuth(request, ['departmentAdmin']);
  if (auth.error) return auth.error;
  try {
    const contentType = request.headers.get('content-type') || '';
    const allowedSemesters = allowedList();
    const fromQuery = querySemester(request);
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      const semester = parseSemester(formData.get('semester'), fromQuery);
      if (!inScope(allowedSemesters, semester)) return NextResponse.json({ success: false, message: 'That Semester is outside your scope' }, { status: 403 });
      if (!file || typeof file.arrayBuffer !== 'function') {
        return NextResponse.json({ success: false, message: 'Choose an Excel or CSV file' }, { status: 400 });
      }
      const scope = { departmentId: auth.user.departmentId, shift: auth.user.shift, semester };
      const table = await rowsFromUpload(file);
      if (!table.length) {
        return NextResponse.json({ success: false, message: 'The file is empty. Put Name, Roll, Email and Group columns.' }, { status: 400 });
      }
      const cols = columnMap(table[0]);
      const start = cols.hasHeader ? 1 : 0;
      const results = [];
      for (let i = start; i < table.length; i++) {
        const cells = table[i] || [];
        const name = cols.name >= 0 ? (cells[cols.name] || '') : '';
        const roll = cells[cols.roll] || '';
        const email = cells[cols.email] || '';
        const section = cells[cols.group] || '';
        if (!name && !roll && !email) continue;
        const result = await addOneEntry({ name, roll, email, section, scope, invitedBy: auth.user.id });
        results.push({ row: i + 1, roll, email, ...result });
      }
      const added = results.filter(r => r.ok);
      const skipped = results.filter(r => !r.ok);
      if (!results.length) {
        return NextResponse.json({ success: false, message: 'No student rows found. Use a header row (Name, Roll, Email, Group) then one student per row.' }, { status: 400 });
      }
      // An upload can touch several semesters at once, so the whole
      // department-admin student namespace is dropped rather than guessing
      // which semesters changed.
      if (added.length) await cacheDelPrefix('deptadmin');
      return NextResponse.json({
        success: true,
        added,
        skipped,
        results,
        message: `${added.length} added${skipped.length ? `, ${skipped.length} rows skipped` : ''}`,
      });
    }
    const { name, roll, email, section, semester } = await request.json();
    const semesterNum = parseSemester(semester, fromQuery);
    if (!inScope(allowedSemesters, semesterNum)) return NextResponse.json({ success: false, message: 'That Semester is outside your scope' }, { status: 403 });
    const scope = { departmentId: auth.user.departmentId, shift: auth.user.shift, semester: semesterNum };
    const result = await addOneEntry({ name, roll, email, section, scope, invitedBy: auth.user.id });
    if (!result.ok) return NextResponse.json({ success: false, message: result.reason }, { status: 400 });
    await cacheDelPrefix('deptadmin');
    return NextResponse.json({ success: true, entry: result.entry }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
