'use client';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import toast from 'react-hot-toast';
import useSessionExitGuard from '@/hooks/useSessionExitGuard';
import { formatDepartment, formatShift } from '@/lib/display';

// Natural sort by Roll (studentId) — so that "2" comes before "10",
// avoiding the plain alphabetical mistake where "10" comes before "2".
const sortByRoll = (list) =>
  [...list].sort((a, b) =>
    (a.studentId || '').localeCompare(b.studentId || '', undefined, { numeric: true, sensitivity: 'base' })
  );

function formatDateNice(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isToday(date) {
  if (!date) return true;
  const d = new Date(date);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export default function TeacherTakeAttendance() {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false); // used only by startSession (subject-select screen)
  const [savingOnly, setSavingOnly] = useState(false); // Attendance Save button — independent of endingOnly
  const [endingOnly, setEndingOnly] = useState(false); // Session End button — independent of savingOnly
  const [step, setStep] = useState('select'); // select | mark | done
  const [search, setSearch] = useState('');
  const touchedRef = useRef(new Set());

  // FIX: teacher must not be able to leave this page mid-session (Back,
  // Refresh, other page, Logout) without ending it first — see
  // src/hooks/useSessionExitGuard.js.
  useSessionExitGuard(step === 'mark', selectedSubject ? `Manual Attendance — ${selectedSubject.name}` : 'Manual Attendance');

  useEffect(() => {
    api.get('/subjects').then(r => setSubjects(r.data.subjects || [])).finally(() => setLoading(false));
    // Check for any active session
    api.get('/sessions?status=active').then(r => {
      if (r.data.sessions?.length > 0) {
        const active = r.data.sessions[0];
        setSession(active);
        // Set selectedSubject from session data so 'done' step shows correct subject name
        if (active.subjectId) {
          setSelectedSubject(active.subjectId);
        }
        // Load students for this session
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
        section: sess.section
      };
      // If the session has a shift, fetch students of that shift
      if (sess.shift) params.shift = sess.shift;

      // PERFORMANCE: these two requests don't depend on each other — the
      // student list only needs `sess` (department/semester/section), and
      // the existing-attendance list only needs `sess._id`. This used to
      // `await` them one after another, so "Start Attendance" waited for
      // the full round-trip time of BOTH calls added together before the
      // class list appeared. Firing them together with Promise.all cuts
      // that wait roughly in half — the class list now appears as soon as
      // the slower of the two finishes, not the sum of both.
      const [res, attRes] = await Promise.all([
        api.get('/users', { params }),
        api.get(`/attendance/session/${sess._id}`),
      ]);
      // Sorted in order by Roll (studentId) — students will appear
      // in the attendance list in roll-number order.
      const stds = sortByRoll(res.data.users || []);
      setStudents(stds);
      // Load existing attendance
      const existing = {};
      (attRes.data.attendance || []).forEach(a => { if (a?.studentId?._id) existing[a.studentId._id] = { status: a.status, markedBy: a.markedBy }; });
      // Default remaining to 'absent' — teacher (or the student themself via
      // self-check-in) has to actively mark someone present.
      const attMap = {};
      stds.forEach(s => { attMap[s._id] = existing[s._id] || { status: 'absent', markedBy: null }; });
      setAttendance(attMap);
      touchedRef.current = new Set();
    } catch (e) { console.error(e); toast.error('Problem loading Students'); }
  };

  // Background poll while marking: pulls the latest attendance from the
  // server (picks up students who self-check-in from their own dashboard,
  // including WHO marked it — self vs teacher) and merges it in — but
  // only for students the teacher hasn't touched themselves yet, so it
  // never overwrites an in-progress manual edit.
  const refreshFromServer = useCallback(async (sessionId) => {
    try {
      const attRes = await api.get(`/attendance/session/${sessionId}`);
      const existing = {};
      (attRes.data.attendance || []).forEach(a => { if (a?.studentId?._id) existing[a.studentId._id] = { status: a.status, markedBy: a.markedBy }; });
      setAttendance(prev => {
        const next = { ...prev };
        Object.keys(existing).forEach(studentId => {
          if (!touchedRef.current.has(studentId)) {
            next[studentId] = existing[studentId];
          }
        });
        return next;
      });
    } catch (e) {
      // silent — background poll, don't interrupt the teacher with errors
    }
  }, []);

  useEffect(() => {
    if (step !== 'mark' || !session?._id) return;
    const interval = setInterval(() => {
      refreshFromServer(session._id);
    }, 4000);
    return () => clearInterval(interval);
  }, [step, session?._id, refreshFromServer]);

  const startSession = async (subject) => {
    // Guard: a subject whose Department reference is missing/broken used to send
    // departmentId: null to the server and crash the whole attendance flow later.
    // Catch it here with a clear, actionable message instead.
    if (!subject?.departmentId) {
      toast.error('This subject has no Department set. Edit it from the "Subjects" page and set a Department.');
      return;
    }
    setSelectedSubject(subject);
    setSaving(true);
    try {
      const res = await api.post('/sessions', {
        subjectId: subject._id,
        semester: subject.semester,
        section: subject.section
      });
      const sess = res.data.session;
      setSession(sess);
      await loadStudentsForSession(sess);
      setStep('mark');
      toast.success(`Session started: ${subject.name}`);
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

  // FEATURE: save attendance progress WITHOUT ending the session — lets a
  // teacher mark students as they arrive over the course of the class and
  // save periodically, without being forced to close the session yet.
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

  // FEATURE: explicit "End Session" — closes the session only.
  // After this, the session can no longer accept attendance (neither manual
  // marks here, nor self check-in) — a brand new session has to be
  // started for the next class.
  //
  // CHANGED: endSession() now ONLY ends the session — it no longer saves
  // attendance first. Saving and ending are fully separate actions: use the
  // "Save Attendance" button to save, and this only closes the session.
  // If the teacher wants their latest marks saved before ending, they need
  // to tap Save first, then End. Uses its own endingOnly loading flag so it
  // never visually affects the Save button.
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
    setStudents([]); setAttendance({}); setSearch('');
    setStep('select');
    api.get('/subjects').then(r => setSubjects(r.data.subjects || []));
  };

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(s =>
      s.name?.toLowerCase().includes(q) || s.studentId?.toLowerCase().includes(q)
    );
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
        <h3 className="text-xl font-bold text-slate-900 mb-1.5">Attendance Complete!</h3>
        <p className="text-slate-500 mb-6">{selectedSubject?.name} — Group {selectedSubject?.section}</p>
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
          Take New Attendance
        </button>
      </div>
    </div>
  );

  if (step === 'mark') return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shadow-soft">
        <button
          onClick={() => { if (window.confirm('Cancel Session?')) { api.put(`/sessions/${session?._id}/end`).catch(() => { }); resetAll(); } }}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 shrink-0"
        >
          <Icon name="chevronLeft" size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-900 truncate">{session?.subjectId?.name}</div>
          <div className="text-xs text-slate-500">
            Sem {session?.semester} • Group {session?.section}
            {session?.date && !isToday(session.date) && <> • Class of {formatDateNice(session.date)}</>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0 items-center">
          <span className="text-xs font-semibold bg-brand-100 text-brand-700 rounded-full px-2.5 py-1">{presentCount}P</span>
          <span className="text-xs font-semibold bg-red-100 text-red-700 rounded-full px-2.5 py-1">{absentCount}A</span>
          {/* Quick-access Save in the top bar, in addition to the full action bar at the bottom */}
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

      {/* FIX (Requirement: explicit End Session button + warning while a
          session is active): this used to be a single combined "Save &
          End" button, so there was no way to save progress mid-class
          without immediately closing the session. Now there are two clearly
          separate actions. */}
      <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center gap-2 text-xs text-amber-800">
        <Icon name="alert" size={14} />
        <span>
          {session?.date && !isToday(session.date)
            ? <>Retaking a Missed Class — this Attendance will be saved under <strong>{formatDateNice(session.date)}</strong>, not today.</>
            : 'Session is active — Save Attendance or End Session first, then go to another page.'}
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

      {/*
        Save/End action bar — restored to the original two-button, side-by-side
        layout. Save and End are fully independent actions with their OWN
        loading state (savingOnly / endingOnly) so clicking one never shows a
        spinner or disables the other — previously both buttons shared the
        single `saving` flag, which made it look like clicking End was also
        "doing something" to Save.
        - Save: writes attendance, session stays open.
        - End: only closes the session (PUT /sessions/:id/end) — does NOT
          save attendance. If unsaved marks exist, save first.
      */}
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
        <h2 className="page-title">Take Attendance</h2>
        <p className="page-sub">Which subject's attendance do you want to take?</p>
      </div>

      {subjects.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-3">
            <Icon name="book" size={22} />
          </div>
          <p className="text-slate-500">No subjects yet. First create a subject from &quot;Subjects&quot;.</p>
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {subjects.map(s => (
            <button
              key={s._id}
              disabled={saving}
              onClick={() => startSession(s)}
              className="text-left rounded-2xl border border-slate-200 bg-white p-4 hover:border-brand-300 hover:shadow-card transition-all disabled:opacity-60"
            >
              <div className="text-xs font-mono font-semibold text-brand-600 mb-1">{s.code}</div>
              <div className="font-semibold text-slate-900 mb-1">{s.name}</div>
              <div className="text-xs text-slate-500">
                {formatDepartment(s.departmentId, s.departmentCode) || <span className="text-amber-600">No Department</span>} • Sem {s.semester} • Group {s.section} • {formatShift(s.shift)} Shift
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-brand-600 text-sm font-semibold">
                <Icon name="play" size={14} /> Start Attendance
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}