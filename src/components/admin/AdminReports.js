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

function SectionHeading({ label }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', background: 'var(--bg3)', padding: '6px 12px', borderRadius: 8, margin: '10px 0 6px' }}>
      Group: {label}
    </div>
  );
}

function DownloadButtons({ id, endpoint, baseName, downloadingId, onDownload }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button className="btn-secondary btn-sm" onClick={() => onDownload(endpoint, id, 'excel', `${baseName}.xlsx`)} disabled={downloadingId === `${id}-excel`}>
        {downloadingId === `${id}-excel` ? <div className="spinner spinner-sm" /> : <><Icon name="download" size={14} /> Excel</>}
      </button>
      <button className="btn-secondary btn-sm" onClick={() => onDownload(endpoint, id, 'pdf', `${baseName}.pdf`)} disabled={downloadingId === `${id}-pdf`}>
        {downloadingId === `${id}-pdf` ? <div className="spinner spinner-sm" /> : <><Icon name="download" size={14} /> PDF</>}
      </button>
    </div>
  );
}

export default function AdminReports() {
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('subject');
  const [downloadingId, setDownloadingId] = useState(null); // `${id}-${format}`

  // ── FIX (Requirement #3): search bars on every report tab ──────────────
  const [subjectSearch, setSubjectSearch] = useState('');
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
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Reports & Export</h2>
        <p className="page-sub">Download Excel or PDF reports</p>
      </div>

      <div className="chips" style={{ background: 'none', border: 'none', padding: '0 0 16px 0' }}>
        {[['subject', 'Subject Reports'], ['student', 'Student Reports']].map(([k, l]) => (
          <button key={k} className={`chip${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'subject' && (
        <>
          <div className="section-title">Subject-wise Full Report</div>
          <SearchBox value={subjectSearch} onChange={setSubjectSearch} placeholder="Search by Subject name, code or department..." />
          {filteredSubjects.length === 0 ? (
            <div className="card"><div className="empty"><p>{subjects.length === 0 ? 'No subjects yet' : 'No subject found'}</p></div></div>
          ) : groupedSubjects.map(group => (
            <div key={group.section}>
              <SectionHeading label={group.section} />
              <div className="card">
                {group.items.map(s => (
                  <div key={s._id} className="list-item">
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

      {tab === 'student' && (
        <>
          <div className="section-title">Student Personal Report</div>
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
                  <div key={s._id} className="list-item">
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
  );
}