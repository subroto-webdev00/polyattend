'use client';
import React, { useState, useEffect, useMemo } from 'react';
import api, { getBlobErrorMessage } from '@/utils/api';
import Icon from '@/components/common/Icon';
import { formatDepartment, formatShift, formatSubject } from '@/lib/display';
import toast from 'react-hot-toast';

// ── FIX (grouping request): wherever a Section is shown in a list, group the
// list by Section instead of showing it flat, so items from the same
// section sit together under a "Section: X" heading.
function groupBySection(items) {
  const groups = {};
  items.forEach(item => {
    const key = item.section || 'Unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return Object.keys(groups).sort().map(key => ({ section: key, items: groups[key] }));
}

// ── FIX (Search Box Focus Issue) ────────────────────────────────────────
// SearchBox, DownloadButtons, and SectionHeading used to be defined INSIDE
// the AdminReports function body. That meant every time state changed
// (e.g. typing a single character into the search box, which calls
// setSubjectSearch and re-renders AdminReports), JavaScript created a
// brand-new SearchBox *function* on that render — a different component
// type than the one from the previous render, even though it looks
// identical. React has no way to know it's "the same" component across
// renders in that situation, so it unmounts the old <input> DOM node and
// mounts a fresh one in its place. A freshly-mounted input always starts
// unfocused — which is exactly why the search box lost focus after every
// single keystroke, forcing a re-click before typing the next character.
//
// The fix is simply moving these component definitions to module scope
// (outside AdminReports), so they're the same stable function/component
// identity across every re-render, and React correctly reuses the existing
// DOM node (and its focus) instead of recreating it.
function SearchBox({ value, onChange, placeholder }) {
  return (
    <div style={{ position: 'relative', marginBottom: 14 }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--txt3)' }}>
        <Icon name="search" size={15} />
      </span>
      <input
        type="text"
        className="form-input"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ paddingLeft: 36 }}
      />
    </div>
  );
}

function SectionHeading({ label }) {  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', background: 'var(--bg3)', padding: '6px 12px', borderRadius: 8, margin: '10px 0 6px' }}>
      Group: {label}
    </div>
  );
}

function DownloadButtons({ id, endpoint, baseName, downloadingId, onDownload }) {
  return (
    <div className="ar-actions">
      <button className="btn-secondary btn-sm" onClick={() => onDownload(endpoint, id, 'excel', `${baseName}.xlsx`)} disabled={downloadingId === `${id}-excel`}>
        {downloadingId === `${id}-excel` ? <div className="spinner spinner-sm" /> : <><Icon name="download" size={14} /> Excel</>}
      </button>
      <button className="btn-secondary btn-sm" onClick={() => onDownload(endpoint, id, 'pdf', `${baseName}.pdf`)} disabled={downloadingId === `${id}-pdf`}>
        {downloadingId === `${id}-pdf` ? <div className="spinner spinner-sm" /> : <><Icon name="download" size={14} /> PDF</>}
      </button>
    </div>
  );
}

// Tab strip — identical layout and icons to the Teacher panel's Reports page.
// The " Report" suffix is its own span so the narrow-screen rule below can
// drop it: at 375px "Subject Report" + icon cannot share one 108px tab
// without wrapping to two lines, while "Subject" fits comfortably.
const TABS = [
  { key: 'subject', label: 'Subject', icon: 'book' },
  { key: 'session', label: 'Session', icon: 'clipboard' },
  { key: 'student', label: 'Student', icon: 'users' },
];

export default function AdminReports() {  const [subjects, setSubjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('subject');
  const [downloadingId, setDownloadingId] = useState(null); // `${id}-${format}`

  // ── FIX (Requirement #3): search bars on every report tab ──────────────
  const [subjectSearch, setSubjectSearch] = useState('');
  const [sessionSearch, setSessionSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  useEffect(() => {
    // PERFORMANCE: this used to also fetch `/users?role=student` here with
    // no limit — fine with a few hundred students, but with enrollment in
    // the thousands that meant downloading the entire student roster (name,
    // ID, department, etc. for every one of them) on every visit to this
    // page, even if the admin only ever wanted the Subject tab. Students
    // are now loaded separately, only for the Student tab, and searched
    // server-side (see the studentSearch effect below) — so this initial
    // load stays small regardless of how many students exist.
    api.get('/subjects')
      .then(r => setSubjects(r.data.subjects || []))
      .catch(err => {
        console.error(err);
        toast.error(err.response?.data?.message || 'Problem loading Reports');
      })
      .finally(() => setLoading(false));

    // Session Report tab: every finished session the role may see. The API
    // applies the scope itself — a Department Admin only ever receives their
    // own Department + Shift sessions, so this is the same call the Teacher
    // panel makes, just without a teacherId restriction for admins.
    api.get('/sessions?status=ended')
      .then(r => setSessions(r.data.sessions || []))
      .catch(err => {
        console.error(err);
        toast.error(err.response?.data?.message || 'Problem loading Sessions');
      });
  }, []);

  // PERFORMANCE: the Student tab searches server-side instead of filtering
  // a full in-browser roster — /api/users already supports `search` (name,
  // email, or Student ID) and `limit` server-side, so this fetches only the
  // matching page (capped at 50) no matter how many students exist overall.
  // Debounced so a fast typist doesn't fire a request per keystroke, and
  // only runs while the Student tab is actually open.
  useEffect(() => {
    if (tab !== 'student') return;
    const q = studentSearch.trim();
    if (!q) { setStudents([]); return; }

    let cancelled = false;
    setStudentsLoading(true);
    const timer = setTimeout(() => {
      api.get(`/users?role=student&search=${encodeURIComponent(q)}&limit=50`)
        .then(r => { if (!cancelled) setStudents(r.data.users || []); })
        .catch(err => {
          if (!cancelled) {
            console.error(err);
            toast.error(err.response?.data?.message || 'Problem searching students');
          }
        })
        .finally(() => { if (!cancelled) setStudentsLoading(false); });
    }, 300);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [tab, studentSearch]);

  const filteredSubjects = useMemo(() => {
    const q = subjectSearch.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      s.code?.toLowerCase().includes(q) ||
      s.departmentId?.name?.toLowerCase().includes(q) ||
      s.departmentId?.code?.toLowerCase().includes(q)
    );
  }, [subjects, subjectSearch]);

  // Student search now happens server-side (see effect above) — `students`
  // already holds just the matching results, so no further in-browser
  // filtering is needed here.
  const groupedSubjects = useMemo(() => groupBySection(filteredSubjects), [filteredSubjects]);
  const groupedStudents = useMemo(() => groupBySection(students), [students]);

  // Session tab search — matches subject name/code, group, or a date typed
  // in any readable form (toLocaleDateString output, ISO prefix).
  const filteredSessions = useMemo(() => {
    const q = sessionSearch.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(s => {
      const d = new Date(s.date);
      const local = d.toLocaleDateString('en-BD').toLowerCase();
      const iso = d.toISOString().slice(0, 10);
      return s.subjectId?.name?.toLowerCase().includes(q) ||
        s.subjectId?.code?.toLowerCase().includes(q) ||
        String(s.section || '').toLowerCase() === q ||
        local.includes(q) || iso.includes(q);
    });
  }, [sessions, sessionSearch]);
  const groupedSessions = useMemo(() => groupBySection(filteredSessions), [filteredSessions]);

  // ── FEATURE: PDF download alongside Excel ──────────────────────────────
  const download = async (endpoint, id, format, filename) => {
    const key = `${id}-${format}`;
    setDownloadingId(key);
    try {
      const res = await api.get(`${endpoint}${format === 'pdf' ? '?format=pdf' : ''}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Download started!');
    } catch (err) { toast.error(await getBlobErrorMessage(err)); }
    finally { setDownloadingId(null); }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div>
      {/* Same chrome as the Teacher panel's Reports page (TeacherExport):
          an action-bar header, a segmented tab switcher, and an info banner
          above each tab — so the two roles read as one product. */}
      <style>{`
        .ar-tabs { display: flex; gap: 4px; background: var(--surface); border-radius: var(--radius); padding: 4px; margin-bottom: 16px; border: 1px solid var(--border); }
        .ar-tab {
          flex: 1; padding: 8px 4px; border: none; border-radius: calc(var(--radius) - 2px);
          cursor: pointer; font-size: 13px; font-weight: 400; background: transparent; color: var(--txt2);
          display: flex; align-items: center; justify-content: center; gap: 6px;
          transition: all 0.15s ease; font-family: inherit; white-space: nowrap;
        }
        .ar-tab-active { background: var(--primary); color: #fff; font-weight: 700; }
        .ar-actions { display: flex; gap: 6px; flex-shrink: 0; }

        /* PHONE (<=640px): the row is icon + text + two download buttons in
           one flex line. At 375px the text column collapses to ~60px, so the
           meta line (date • department • shift • present) and the buttons are
           both squeezed into unreadable slivers. Let the actions wrap onto
           their own line and let the meta text wrap instead of ellipsising. */
        @media (max-width: 640px) {
          .ar-tab { font-size: 12px; padding: 9px 2px; gap: 4px; }
          .ar-tab-suffix { display: none; }
          .ar-row { flex-wrap: wrap; padding: 13px 14px; row-gap: 10px; }
          .ar-row .item-sub { white-space: normal; }
          .ar-row .ar-actions { flex: 1 0 100%; justify-content: flex-end; }
        }
        @media (max-width: 380px) {
          .ar-row .ar-actions { justify-content: stretch; }
          .ar-row .ar-actions .btn-secondary { flex: 1; justify-content: center; }
        }
      `}</style>

      <div className="action-bar">
        <Icon name="chart" size={18} style={{ color: 'var(--txt2)' }} />
        <span className="action-bar-title">Reports</span>
      </div>

      <div className="page" style={{ paddingTop: 8 }}>
        <div className="ar-tabs">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`ar-tab${tab === t.key ? ' ar-tab-active' : ''}`}
            >
              <Icon name={t.icon} size={14} />
              <span>{t.label}<span className="ar-tab-suffix"> Report</span></span>
            </button>
          ))}
        </div>

      {tab === 'subject' && (
        <>
          <div className="info-banner mb-3">
            <Icon name="info" size={16} />
            <span className="info-text">Download the full Excel report of all sessions and students for a Subject</span>
          </div>
          <SearchBox value={subjectSearch} onChange={setSubjectSearch} placeholder="Search by Subject name, code or department..." />
          {filteredSubjects.length === 0 ? (
            <div className="card"><div className="empty"><p>{subjects.length === 0 ? 'No subjects yet' : 'No subject found'}</p></div></div>
          ) : groupedSubjects.map(group => (
            <div key={group.section}>
              <SectionHeading label={group.section} />
              <div className="card">
                {group.items.map(s => (
                  <div key={s._id} className="list-item ar-row">
                    <div className="item-icon icon-green"><Icon name="book" size={18} /></div>
                    <div className="item-content">
                      <div className="item-title">{formatSubject(s)}</div>
                      <div className="item-sub">{formatDepartment(s.departmentId, s.departmentCode)} • Sem {s.semester} • Group {s.section} • {formatShift(s.shift)} Shift</div>
                    </div>
                    <DownloadButtons id={s._id} endpoint={`/reports/subject/${s._id}`} baseName={`subject_${s.code}_report`} downloadingId={downloadingId} onDownload={download} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {tab === 'session' && (
        <>
          <div className="info-banner mb-3">
            <Icon name="info" size={16} />
            <span className="info-text">Download the attendance list for each class session</span>
          </div>
          <SearchBox value={sessionSearch} onChange={setSessionSearch} placeholder="Search by Subject, group or date..." />
          {sessions.length === 0 ? (
            <div className="card"><div className="empty"><p>No completed sessions yet</p></div></div>
          ) : filteredSessions.length === 0 ? (
            <div className="card"><div className="empty"><p>No session found</p></div></div>
          ) : groupedSessions.map(group => (
            <div key={group.section}>
              <SectionHeading label={group.section} />
              <div className="card">
                {group.items.map(s => (
                  <div key={s._id} className="list-item ar-row">
                    <div className="item-icon icon-blue"><Icon name="calendar" size={18} /></div>
                    <div className="item-content">
                      <div className="item-title">{formatSubject(s.subjectId)} — Sem {s.semester} • Group {s.section}</div>
                      <div className="item-sub">
                        {new Date(s.date).toLocaleDateString('en-BD', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                        {' '}• {formatDepartment(s.departmentId)} • {formatShift(s.shift || s.subjectId?.shift)} Shift • {s.presentCount}/{s.totalStudents} present
                      </div>
                    </div>
                    <DownloadButtons
                      id={s._id}
                      endpoint={`/reports/class/${s._id}`}
                      baseName={`session_${s.subjectId?.code || 'report'}_${new Date(s.date).toISOString().slice(0, 10)}`}
                      downloadingId={downloadingId}
                      onDownload={download}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {tab === 'student' && (
        <>
          <div className="info-banner mb-3">
            <Icon name="info" size={16} />
            <span className="info-text">Search by Student's name or ID, then download the report</span>
          </div>
          <SearchBox value={studentSearch} onChange={setStudentSearch} placeholder="Search by Student name or ID..." />
          {studentSearch.trim() === '' ? (
            <div className="card"><div className="empty"><p>Type a name or Student ID to find a student.</p></div></div>
          ) : studentsLoading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : students.length === 0 ? (
            <div className="card"><div className="empty"><p>No student found</p></div></div>
          ) : groupedStudents.map(group => (
            <div key={group.section}>
              <SectionHeading label={group.section} />
              <div className="card">
                {group.items.map(s => (
                  <div key={s._id} className="list-item ar-row">
                    <div className="item-icon icon-amber"><Icon name="users" size={18} /></div>
                    <div className="item-content">
                      <div className="item-title">{s.name}</div>
                      <div className="item-sub">{s.studentId} • {formatDepartment(s.departmentId, s.departmentCode)} • Sem {s.semester} • Group {s.section} • {formatShift(s.shift)} Shift</div>
                    </div>
                    <DownloadButtons id={s._id} endpoint={`/reports/student/${s._id}`} baseName={`student_${s.studentId}_report`} downloadingId={downloadingId} onDownload={download} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
      </div>
    </div>
  );
}