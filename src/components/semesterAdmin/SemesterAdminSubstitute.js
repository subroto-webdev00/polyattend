'use client';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import toast from 'react-hot-toast';
import useSessionExitGuard from '@/hooks/useSessionExitGuard';

// SUBSTITUTE CLASS FEATURE
// If a Teacher misses their class for some reason (sickness, emergency,
// etc.), the Department Admin for that Teacher's own Department+Shift+
// Semester can come here, start that subject's session themselves, and
// take manual attendance for whichever students actually showed up.
//
// The saved attendance is credited to the ORIGINAL Teacher (Session.teacherId
// stays the assigned Teacher — see /api/sessions POST), so it's not lost or
// misattributed. It's flagged as `isSubstitute` so the Teacher Session
// Report shows "Substitute Covered" for that day instead of a plain "Miss".
//
// Reuses the same manual-attendance flow/UI pattern as
// components/teacher/TeacherTakeAttendance.js.

const sortByRoll = (list) =>
  [...list].sort((a, b) =>
    (a.studentId || '').localeCompare(b.studentId || '', undefined, { numeric: true, sensitivity: 'base' })
  );

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateNice(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Groups a flat, date-descending-sorted entries array into
// [ [date, entries[]], ... ] pairs, preserving date order — used to render
// the Missed Classes list with a date heading per group instead of one
// long flat list.
function groupByDate(entries) {
  const map = new Map();
  entries.forEach(e => {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date).push(e);
  });
  return Array.from(map.entries());
}

// TODAY CUTOFF: today's own class is only ever counted as "missed" once
// it's past 7:00 PM local time — a class could still happen later today.
// This does NOT gate the whole Missed Sessions panel (older unresolved
// misses always show, any time of day) — it only decides whether TODAY's
// date gets added to that list yet.
const TODAY_CUTOFF_HOUR = 19; // 7:00 PM

function isPastTodayCutoff(d = new Date()) {
  return d.getHours() >= TODAY_CUTOFF_HOUR;
}

export default function SemesterAdminSubstitute() {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingOnly, setSavingOnly] = useState(false);
  const [endingOnly, setEndingOnly] = useState(false);
  const [step, setStep] = useState('select'); // select | mark | done
  const [search, setSearch] = useState('');
  // Set when covering a specific date from the Missed Sessions list (a
  // backdated catch-up) — null for a live "right now" substitute. Passed
  // through to POST /sessions so the resulting Session/Attendance is
  // stamped with the ACTUAL missed date, not today.
  const [targetDate, setTargetDate] = useState(null);
  const touchedRef = useRef(new Set());

  // MISSED SESSIONS PANEL — every unresolved missed class across this
  // Department Admin's own Semester, not just today or the last day or two.
  // Gives a call list (Teacher name + mobile) so the admin can confirm the
  // class was actually missed and find out who attended, before starting
  // a Substitute session for that exact date.
  const [now, setNow] = useState(new Date());
  const [missedLoading, setMissedLoading] = useState(true);
  const [missedEntries, setMissedEntries] = useState([]);

  useEffect(() => {
    // Re-check every minute — mainly so the list picks up "today" the
    // moment it crosses 7:00 PM, without needing a page refresh.
    const t = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const includeToday = isPastTodayCutoff(now);

  const loadMissed = useCallback(() => {
    setMissedLoading(true);
    api.get('/reports/missed-sessions', { params: { asOfDate: todayISO(), includeToday } })
      .then(r => setMissedEntries(r.data.missed || []))
      .catch(() => { })
      .finally(() => setMissedLoading(false));
  }, [includeToday]);

  useEffect(() => { loadMissed(); }, [loadMissed]);

  useSessionExitGuard(step === 'mark', selectedSubject ? `Substitute Attendance — ${selectedSubject.name}` : 'Substitute Attendance');

  useEffect(() => {
    // /api/subjects already scopes to this Department Admin's own
    // Department+Shift+Semester — no extra filtering needed here.
    api.get('/subjects').then(r => setSubjects(r.data.subjects || [])).finally(() => setLoading(false));
    // Resume an in-progress substitute session STARTED BY THIS ADMIN only
    // (mine=true) — never auto-attach to a session a real Teacher is
    // currently running themselves.
    api.get('/sessions', { params: { status: 'active', mine: 'true' } }).then(r => {
      if (r.data.sessions?.length > 0) {
        const active = r.data.sessions[0];
        setSession(active);
        if (active.subjectId) setSelectedSubject(active.subjectId);
        loadStudentsForSession(active);
        setStep('mark');
      }
    }).catch(() => { });
  }, []);

  const loadStudentsForSession = async (sess) => {
    try {
      const params = {
        role: 'student',
        departmentId: sess.departmentId?._id || sess.departmentId,
        semester: sess.semester,
        section: sess.section,
      };
      if (sess.shift) params.shift = sess.shift;

      const res = await api.get('/users', { params });
      const stds = sortByRoll(res.data.users || []);
      setStudents(stds);
      const attRes = await api.get(`/attendance/session/${sess._id}`);
      const existing = {};
      (attRes.data.attendance || []).forEach(a => { if (a?.studentId?._id) existing[a.studentId._id] = { status: a.status, markedBy: a.markedBy }; });
      const attMap = {};
      stds.forEach(s => { attMap[s._id] = existing[s._id] || { status: 'absent', markedBy: null }; });
      setAttendance(attMap);
      touchedRef.current = new Set();
    } catch (e) { console.error(e); toast.error('Problem loading Students'); }
  };

  const refreshFromServer = useCallback(async (sessionId) => {
    try {
      const attRes = await api.get(`/attendance/session/${sessionId}`);
      const existing = {};
      (attRes.data.attendance || []).forEach(a => { if (a?.studentId?._id) existing[a.studentId._id] = { status: a.status, markedBy: a.markedBy }; });
      setAttendance(prev => {
        const next = { ...prev };
        Object.keys(existing).forEach(studentId => {
          if (!touchedRef.current.has(studentId)) next[studentId] = existing[studentId];
        });
        return next;
      });
    } catch (e) { /* silent — background poll */ }
  }, []);

  useEffect(() => {
    if (step !== 'mark' || !session?._id) return;
    const interval = setInterval(() => refreshFromServer(session._id), 4000);
    return () => clearInterval(interval);
  }, [step, session?._id, refreshFromServer]);

  const dismissMissed = async (entry) => {
    if (!window.confirm(`Dismiss the missed class for ${entry.subjectName} on ${formatDateNice(entry.date)}? This will NOT create any Attendance — it just removes it from this list.`)) return;
    try {
      await api.delete('/reports/missed-sessions', { params: { subjectId: entry.subjectId, date: entry.date } });
      setMissedEntries(prev => prev.filter(e => !(e.subjectId === entry.subjectId && e.date === entry.date)));
      toast.success('Missed entry dismissed');
    } catch (err) { toast.error(err.response?.data?.message || 'Problem dismissing entry'); }
  };

  const startSession = async (subject, dateStr = null) => {
    if (!subject?.departmentId) {
      toast.error('This subject has no Department set. Edit it from "Subjects" first.');
      return;
    }
    if (!subject?.teacherId) {
      toast.error('This subject has no assigned Teacher — nothing to substitute for.');
      return;
    }
    setSelectedSubject(subject);
    setTargetDate(dateStr || null);
    setSaving(true);
    try {
      const payload = { subjectId: subject._id, semester: subject.semester, section: subject.section };
      if (dateStr) payload.date = dateStr;
      const res = await api.post('/sessions', payload);
      const sess = res.data.session;
      setSession(sess);
      await loadStudentsForSession(sess);
      setStep('mark');
      toast.success(
        dateStr
          ? `Substitute session started for ${formatDateNice(dateStr)}: ${subject.name}`
          : `Substitute session started: ${subject.name}`
      );
    } catch (err) { toast.error(err.response?.data?.message || 'Problem starting Session'); }
    finally { setSaving(false); }
  };

  const toggleStudent = (studentId) => {
    touchedRef.current.add(studentId);
    setAttendance(prev => ({
      ...prev,
      [studentId]: { status: prev[studentId]?.status === 'present' ? 'absent' : 'present', markedBy: 'manual' },
    }));
  };

  const setStatus = (studentId, status) => {
    touchedRef.current.add(studentId);
    setAttendance(prev => ({ ...prev, [studentId]: { status, markedBy: 'manual' } }));
  };

  const markAll = (status) => {
    const updated = {};
    students.forEach(s => { updated[s._id] = { status, markedBy: 'manual' }; touchedRef.current.add(s._id); });
    setAttendance(updated);
  };

  const saveAttendanceOnly = async () => {
    if (!session) return;
    setSavingOnly(true);
    try {
      const attendanceList = students.map(s => ({ studentId: s._id, status: attendance[s._id]?.status || 'absent' }));
      await api.post('/attendance/manual', { sessionId: session._id, attendanceList });
      toast.success('Attendance saved (Session is still ongoing)');
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setSavingOnly(false); }
  };

  const endSession = async () => {
    if (!session) return;
    setEndingOnly(true);
    try {
      await api.put(`/sessions/${session._id}/end`);
      toast.success('Session ended!');
      setStep('done');
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setEndingOnly(false); }
  };

  const resetAll = () => {
    setSession(null); setSelectedSubject(null);
    setStudents([]); setAttendance({}); setSearch(''); setTargetDate(null);
    setStep('select');
    api.get('/subjects').then(r => setSubjects(r.data.subjects || []));
    loadMissed();
  };

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(s => s.name?.toLowerCase().includes(q) || s.studentId?.toLowerCase().includes(q));
  }, [students, search]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const presentCount = Object.values(attendance).filter(v => v?.status === 'present').length;
  const absentCount = students.length - presentCount;

  if (step === 'done') return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mx-auto mb-5 shadow-brand">
          <Icon name="check" size={34} />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-1.5">Substitute Attendance Complete!</h3>
        <p className="text-slate-500 mb-6">
          {selectedSubject?.name} — Group {selectedSubject?.section}
          {targetDate && <> • {formatDateNice(targetDate)}</>}
        </p>
        <div className="grid grid-cols-2 gap-3 mb-7">
          <div className="rounded-2xl bg-brand-50 border border-brand-100 py-4">
            <div className="text-2xl font-extrabold text-brand-700">{presentCount}</div>
            <div className="text-xs font-medium text-brand-600 mt-0.5">Present</div>
          </div>
          <div className="rounded-2xl bg-red-50 border border-red-100 py-4">
            <div className="text-2xl font-extrabold text-red-600">{absentCount}</div>
            <div className="text-xs font-medium text-red-500 mt-0.5">Absent</div>
          </div>
        </div>
        <button
          onClick={resetAll}
          className="w-full rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 shadow-brand transition-colors"
        >
          Cover Another Class
        </button>
      </div>
    </div>
  );

  if (step === 'mark') return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shadow-soft">
        <button
          onClick={() => { if (window.confirm('Cancel this Substitute Session?')) { api.put(`/sessions/${session?._id}/end`).catch(() => { }); resetAll(); } }}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 shrink-0"
        >
          <Icon name="chevronLeft" size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-900 truncate">{session?.subjectId?.name}</div>
          <div className="text-xs text-slate-500">
            Sem {session?.semester} • Group {session?.section} • Substitute for {session?.teacherId?.name}
            {targetDate && <> • Class of {formatDateNice(targetDate)}</>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0 items-center">
          <span className="text-xs font-semibold bg-brand-100 text-brand-700 rounded-full px-2.5 py-1">{presentCount}P</span>
          <span className="text-xs font-semibold bg-red-100 text-red-700 rounded-full px-2.5 py-1">{absentCount}A</span>
          <button
            onClick={saveAttendanceOnly}
            disabled={savingOnly || endingOnly || students.length === 0}
            title="Save attendance marked so far while keeping the Session active"
            className="flex items-center gap-1 rounded-lg bg-brand-50 hover:bg-brand-100 disabled:bg-slate-100 disabled:cursor-not-allowed text-brand-700 text-xs font-semibold px-2.5 py-1.5 transition-colors"
          >
            {savingOnly ? <div className="spinner spinner-sm" /> : <Icon name="check" size={12} />}
            Save
          </button>
        </div>
      </div>

      <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center gap-2 text-xs text-amber-800">
        <Icon name="alert" size={14} />
        <span>
          Substitute class for {session?.teacherId?.name}
          {targetDate ? <> — this Attendance will be saved under <strong>{formatDateNice(targetDate)}</strong>, not today.</> : ' — Save Attendance or End Session first, then go to another page.'}
        </span>
      </div>

      <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Icon name="search" size={16} />
          </span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or Student ID..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => markAll('present')}
            className="flex items-center gap-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold px-3 py-2.5 transition-colors"
          >
            <Icon name="check" size={14} /> All Present
          </button>
          <button
            onClick={() => markAll('absent')}
            className="flex items-center gap-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold px-3 py-2.5 transition-colors"
          >
            <Icon name="x" size={14} /> All Absent
          </button>
        </div>
      </div>

      {search && (
        <div className="px-4 py-2 bg-white border-b border-slate-100 text-xs text-slate-500">
          {filteredStudents.length} found
        </div>
      )}

      <div className="flex-1 bg-white divide-y divide-slate-100">
        {students.length === 0 ? (
          <div className="py-16 text-center text-slate-400">No students in this class</div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Icon name="search" size={22} />
            <p className="mt-2 text-sm">No student found</p>
          </div>
        ) : filteredStudents.map(s => {
          const rec = attendance[s._id];
          const status = rec?.status;
          const isSelf = status === 'present' && rec?.markedBy === 'self';
          return (
            <div key={s._id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
              <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm shrink-0">
                {s.name?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900 truncate flex items-center gap-1.5">
                  <span className="truncate">{s.name}</span>
                  {isSelf && (
                    <span
                      className="tag tag-amber"
                      style={{ fontSize: 10, padding: '2px 6px', flexShrink: 0 }}
                      title="This student marked their own attendance — verify they are physically present in class"
                    >
                      Self
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 font-mono">{s.studentId}</div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => toggleStudent(s._id)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold border transition-colors ${status === 'present'
                    ? 'bg-brand-600 border-brand-600 text-white'
                    : 'bg-white border-slate-200 text-slate-400 hover:border-brand-300 hover:text-brand-600'
                    }`}
                >
                  P
                </button>
                <button
                  onClick={() => setStatus(s._id, 'absent')}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold border transition-colors ${status === 'absent'
                    ? 'bg-red-500 border-red-500 text-white'
                    : 'bg-white border-slate-200 text-slate-400 hover:border-red-300 hover:text-red-500'
                    }`}
                >
                  A
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white border-t border-slate-200 px-4 py-3 flex gap-2">
        <button
          onClick={saveAttendanceOnly}
          disabled={savingOnly || endingOnly || students.length === 0}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50 hover:bg-brand-100 disabled:bg-slate-100 disabled:cursor-not-allowed text-brand-700 text-sm font-semibold py-2.5 transition-colors"
        >
          {savingOnly ? <div className="spinner spinner-sm" /> : <Icon name="check" size={14} />}
          Save Attendance
        </button>
        <button
          onClick={() => {
            if (window.confirm('End Session? This will only close the session, it will not Save attendance — click the Save button first if you haven\'t saved.')) {
              endSession();
            }
          }}
          disabled={savingOnly || endingOnly || students.length === 0}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 shadow-brand transition-colors"
        >
          {endingOnly ? <div className="spinner spinner-sm" /> : <Icon name="stop" size={14} />}
          End Session
        </button>
      </div>
    </div>
  );

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Substitute Class</h2>
        <p className="page-sub">Cover a Teacher&apos;s class ONLY from the confirmed Missed Classes list below — the Attendance will be saved under the Teacher&apos;s own session, marked as Substitute Covered, on the correct date.</p>
      </div>

      {/* MISSED CLASSES PANEL — every unresolved missed class in the last 7 days, grouped by date. */}
      <div style={{
        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
        padding: 16, marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <Icon name="clock" size={16} />
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Missed Classes</h3>
          <span style={{ fontSize: 11, color: 'var(--txt2)' }}>
            {includeToday ? "Today's classes are included (past 7:00 PM) • last 7 days" : "Today isn't counted yet — added after 7:00 PM • last 7 days"}
          </span>
        </div>

        {missedLoading ? (
          <div className="loading" style={{ padding: 12 }}><div className="spinner spinner-sm" /></div>
        ) : missedEntries.length === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--txt2)', margin: 0 }}>No missed classes outstanding — everything in your Semester is covered. 🎉</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 480, overflowY: 'auto' }}>
            {groupByDate(missedEntries).map(([date, entries]) => (
              <div key={date}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', marginBottom: 8 }}>
                  {formatDateNice(date)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {entries.map(entry => {
                    const matchedSubject = subjects.find(s => s._id === entry.subjectId);
                    const key = `${entry.subjectId}_${entry.date}`;
                    return (
                      <div key={key} style={{
                        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px',
                      }}>
                        <div style={{ flex: 1, minWidth: 160 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{entry.teacherName}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--txt2)' }}>{entry.subjectName} ({entry.subjectCode}) • Group {entry.section}</div>
                        </div>
                        {entry.teacherMobile ? (
                          <a
                            href={`tel:${entry.teacherMobile}`}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600,
                              color: 'var(--primary)', textDecoration: 'none', flexShrink: 0,
                            }}
                          >
                            <Icon name="phone" size={13} /> {entry.teacherMobile}
                          </a>
                        ) : (
                          <span style={{ fontSize: 11.5, color: 'var(--txt3)', flexShrink: 0 }}>No mobile on file</span>
                        )}
                        <button
                          onClick={() => matchedSubject && startSession(matchedSubject, entry.date)}
                          disabled={!matchedSubject || saving}
                          title={!matchedSubject ? 'Subject not found in your list' : `Start ${formatDateNice(entry.date)}'s class and take attendance for it now`}
                          style={{
                            flexShrink: 0, fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 8,
                            border: 'none', cursor: matchedSubject ? 'pointer' : 'not-allowed',
                            background: 'var(--primary)', color: '#fff', opacity: matchedSubject ? 1 : 0.5,
                          }}
                        >
                          Cover This Class
                        </button>
                        <button
                          onClick={() => dismissMissed(entry)}
                          disabled={saving}
                          title="Dismiss this entry without creating a Session (no Attendance will be saved)"
                          style={{
                            flexShrink: 0, fontSize: 12, fontWeight: 700, padding: '6px 10px', borderRadius: 8,
                            border: '1px solid var(--border)', cursor: 'pointer',
                            background: 'var(--bg)', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <Icon name="trash" size={12} /> Delete
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
