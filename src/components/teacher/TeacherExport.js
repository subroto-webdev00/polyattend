'use client';
import React, { useState, useEffect } from 'react';
import api, { getBlobErrorMessage } from '@/utils/api';
import Icon from '@/components/common/Icon';
import toast from 'react-hot-toast';
import { formatDepartment, formatShift, formatSubject } from '@/lib/display';

export default function TeacherExport() {
  const [subjects, setSubjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  // FIX (Requirement #3): search bars for the subject & session tabs too
  const [subjectFilter, setSubjectFilter] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [activeTab, setActiveTab] = useState('subject'); // subject | session | student
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [downloading, setDownloading] = useState(null); // stores id being downloaded

  // FIX (hydration mismatch): this used to read `window.innerWidth` directly
  // inside the render body. `window` doesn't exist during server rendering,
  // and even where it's polyfilled, the server's and the browser's viewport
  // width will never match — so React renders one thing on the server and a
  // different thing on the client, which is exactly what triggers
  // "Text content does not match server-rendered HTML". Reading it inside
  // useEffect instead means the very first client render matches the server
  // render exactly, and only updates afterwards (safe, since that happens
  // after hydration completes).
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);
  useEffect(() => {
    const checkWidth = () => setIsNarrowScreen(window.innerWidth < 400);
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  const filteredSubjects = subjects.filter(s => {
    const q = subjectFilter.trim().toLowerCase();
    if (!q) return true;
    return s.name?.toLowerCase().includes(q) || s.code?.toLowerCase().includes(q) || s.departmentId?.name?.toLowerCase().includes(q) || s.departmentId?.code?.toLowerCase().includes(q);
  });

  const filteredSessions = sessions.filter(s => {
    const q = sessionFilter.trim().toLowerCase();
    if (!q) return true;
    return s.subjectId?.name?.toLowerCase().includes(q) || s.section?.toLowerCase().includes(q) ||
      new Date(s.date).toLocaleDateString('en-BD').toLowerCase().includes(q);
  });

  // ── FIX (grouping request): group by Section wherever a list shows one,
  // instead of a flat list.
  const groupBySection = (items) => {
    const groups = {};
    items.forEach(item => {
      const key = item.section || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.keys(groups).sort().map(key => ({ section: key, items: groups[key] }));
  };
  const groupedSubjects = groupBySection(filteredSubjects);
  const groupedSessions = groupBySection(filteredSessions);
  const groupedStudents = groupBySection(students);

  useEffect(() => {
    api.get('/subjects')
      .then(r => setSubjects(r.data.subjects || []))
      .catch(() => toast.error('Problem loading Subject'))
      .finally(() => setLoadingSubjects(false));

    api.get('/sessions?status=ended')
      .then(r => setSessions(r.data.sessions || []))
      .catch(() => toast.error('Problem loading Session'))
      .finally(() => setLoadingSessions(false));
  }, []);

  const triggerDownload = (blob, filename) => {
    const url = window.URL.createObjectURL(new Blob([blob]));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const downloadSubjectReport = async (subject, format = 'excel') => {
    setDownloading(`${subject._id}-${format}`);
    try {
      const res = await api.get(`/reports/subject/${subject._id}${format === 'pdf' ? '?format=pdf' : ''}`, { responseType: 'blob' });
      triggerDownload(res.data, `${subject.code}_${subject.section}_report.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
      toast.success(`"${subject.name}" report downloaded!`);
    } catch (err) {
      toast.error(await getBlobErrorMessage(err, 'Download failed'));
    } finally {
      setDownloading(null);
    }
  };

  const downloadSessionReport = async (session, format = 'excel') => {
    setDownloading(`${session._id}-${format}`);
    try {
      const res = await api.get(`/reports/class/${session._id}${format === 'pdf' ? '?format=pdf' : ''}`, { responseType: 'blob' });
      const dateStr = new Date(session.date).toLocaleDateString('en-BD').replace(/\//g, '-');
      triggerDownload(res.data, `session_${session.subjectId?.code || 'report'}_${dateStr}.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
      toast.success('Session report downloaded!');
    } catch (err) {
      toast.error(await getBlobErrorMessage(err, 'Download failed'));
    } finally {
      setDownloading(null);
    }
  };

  const downloadStudentReport = async (student, format = 'excel') => {
    setDownloading(`${student._id}-${format}`);
    try {
      const res = await api.get(`/reports/student/${student._id}${format === 'pdf' ? '?format=pdf' : ''}`, { responseType: 'blob' });
      triggerDownload(res.data, `student_${student.studentId || student.name}_report.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
      toast.success(`${student.name}'s report downloaded!`);
    } catch (err) {
      toast.error(await getBlobErrorMessage(err, 'Download failed'));
    } finally {
      setDownloading(null);
    }
  };

  const searchStudents = async () => {
    const q = studentSearch.trim();
    if (!q) return toast.error('Enter name or Student ID');
    try {
      const res = await api.get('/users', { params: { role: 'student', search: q } });
      const found = res.data.users || [];
      setStudents(found);
      if (found.length === 0) toast('No student found', { icon: '🔍' });
    } catch {
      toast.error('Problem searching for Student');
    }
  };

  const tabs = [
    { key: 'subject', label: 'Subject Report', icon: 'book' },
    { key: 'session', label: 'Session Report', icon: 'clipboard' },
    { key: 'student', label: 'Student Report', icon: 'users' },
  ];

  return (
    <div>
      <div className="action-bar">
        <Icon name="chart" size={18} style={{ color: 'var(--txt2)' }} />
        <span className="action-bar-title">Reports</span>
      </div>

      <div className="page" style={{ paddingTop: 8 }}>
        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 4, marginBottom: 16, border: '1px solid var(--border)' }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                padding: '8px 4px',
                border: 'none',
                borderRadius: 'calc(var(--radius) - 2px)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === tab.key ? 700 : 400,
                background: activeTab === tab.key ? 'var(--primary)' : 'transparent',
                color: activeTab === tab.key ? '#fff' : 'var(--txt2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 0.15s ease',
              }}
            >
              <Icon name={tab.icon} size={14} />
              <span style={{ display: isNarrowScreen ? 'none' : undefined }}>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── Subject Report Tab ── */}
        {activeTab === 'subject' && (
          <>
            <div className="info-banner mb-3">
              <Icon name="info" size={16} />
              <span className="info-text">Download the full Excel report of all sessions and students for a Subject</span>
            </div>
            {loadingSubjects ? (
              <div className="loading"><div className="spinner" /></div>
            ) : subjects.length === 0 ? (
              <div className="card"><div className="empty"><Icon name="book" size={32} /><p>No subjects yet</p></div></div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input
                    className="form-input"
                    placeholder="Search by Subject name, code or department..."
                    value={subjectFilter}
                    onChange={e => setSubjectFilter(e.target.value)}
                  />
                </div>
                {filteredSubjects.length === 0 ? (
                  <div className="card"><div className="empty"><Icon name="search" size={32} /><p>No subject found</p></div></div>
                ) : groupedSubjects.map(group => (
                  <div key={group.section} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', background: 'var(--bg3)', padding: '6px 12px', borderRadius: 8, marginBottom: 8 }}>
                      Group: {group.section}
                    </div>
                    <div className="card">
                      {group.items.map(s => (
                        <div key={s._id} className="list-item">
                          <div className="item-icon icon-green">
                            <Icon name="book" size={18} />
                          </div>
                          <div className="item-content">
                            <div className="item-title">{formatSubject(s)}</div>
                            <div className="item-sub">
                              {formatDepartment(s.departmentId, s.departmentCode)} • Sem {s.semester} • Group {s.section} • {formatShift(s.shift)} Shift
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="btn-secondary btn-sm"
                              onClick={() => downloadSubjectReport(s, 'excel')}
                              disabled={downloading === `${s._id}-excel`}
                              title="Full Subject Excel Download"
                            >
                              {downloading === `${s._id}-excel` ? <div className="spinner spinner-sm" /> : <><Icon name="download" size={14} /> Excel</>}
                            </button>
                            <button
                              className="btn-secondary btn-sm"
                              onClick={() => downloadSubjectReport(s, 'pdf')}
                              disabled={downloading === `${s._id}-pdf`}
                              title="Full Subject PDF Download"
                            >
                              {downloading === `${s._id}-pdf` ? <div className="spinner spinner-sm" /> : <><Icon name="download" size={14} /> PDF</>}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* ── Session Report Tab ── */}
        {activeTab === 'session' && (
          <>
            <div className="info-banner mb-3">
              <Icon name="info" size={16} />
              <span className="info-text">Download the attendance list for each class session</span>
            </div>
            {loadingSessions ? (
              <div className="loading"><div className="spinner" /></div>
            ) : sessions.length === 0 ? (
              <div className="card"><div className="empty"><Icon name="clipboard" size={32} /><p>No completed sessions yet</p></div></div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input
                    className="form-input"
                    placeholder="Search by Subject, section or date..."
                    value={sessionFilter}
                    onChange={e => setSessionFilter(e.target.value)}
                  />
                </div>
                {filteredSessions.length === 0 ? (
                  <div className="card"><div className="empty"><Icon name="search" size={32} /><p>No session found</p></div></div>
                ) : groupedSessions.map(group => (
                  <div key={group.section} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', background: 'var(--bg3)', padding: '6px 12px', borderRadius: 8, marginBottom: 8 }}>
                      Group: {group.section}
                    </div>
                    <div className="card">
                      {group.items.map(s => (
                        <div key={s._id} className="list-item">
                          <div className="item-icon icon-blue">
                            <Icon name="calendar" size={18} />
                          </div>
                          <div className="item-content">
                            <div className="item-title">{formatSubject(s.subjectId)} — Sem {s.semester} • Group {s.section}</div>
                            <div className="item-sub">
                              {new Date(s.date).toLocaleDateString('en-BD', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                              {' '}• {formatDepartment(s.departmentId)} • {formatShift(s.shift || s.subjectId?.shift)} Shift • {s.presentCount}/{s.totalStudents} present
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              className="btn-icon"
                              onClick={() => downloadSessionReport(s, 'excel')}
                              disabled={downloading === `${s._id}-excel`}
                              title="Session Attendance Excel Download"
                            >
                              {downloading === `${s._id}-excel` ? <div className="spinner spinner-sm" /> : <Icon name="download" size={14} />}
                            </button>
                            <button
                              className="btn-icon"
                              onClick={() => downloadSessionReport(s, 'pdf')}
                              disabled={downloading === `${s._id}-pdf`}
                              title="Session Attendance PDF Download"
                            >
                              {downloading === `${s._id}-pdf` ? <div className="spinner spinner-sm" /> : <Icon name="download" size={14} style={{ opacity: 0.7 }} />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* ── Student Report Tab ── */}
        {activeTab === 'student' && (
          <>
            <div className="info-banner mb-3">
              <Icon name="info" size={16} />
              <span className="info-text">Search by Student's name or ID, then download the report</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                className="form-input"
                placeholder="Enter Student name or ID..."
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchStudents()}
                style={{ flex: 1 }}
              />
              <button className="btn-secondary" onClick={searchStudents}>
                <Icon name="search" size={16} />
              </button>
            </div>
            {students.length === 0 ? (
              <div className="card">
                <div className="empty">
                  <Icon name="search" size={32} />
                  <p>Search for a Student, then download the report</p>
                </div>
              </div>
            ) : groupedStudents.map(group => (
              <div key={group.section} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', background: 'var(--bg3)', padding: '6px 12px', borderRadius: 8, marginBottom: 8 }}>
                  Group: {group.section}
                </div>
                <div className="card">
                  {group.items.map(s => (
                    <div key={s._id} className="list-item">
                      <div className="item-icon icon-amber">
                        <Icon name="users" size={18} />
                      </div>
                      <div className="item-content">
                        <div className="item-title">{s.name}</div>
                        <div className="item-sub">
                          {s.studentId} • {formatDepartment(s.departmentId, s.departmentCode)} • Sem {s.semester} • Group {s.section} • {formatShift(s.shift)} Shift
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => downloadStudentReport(s, 'excel')}
                          disabled={downloading === `${s._id}-excel`}
                          title="Student Report Excel Download"
                        >
                          {downloading === `${s._id}-excel` ? <div className="spinner spinner-sm" /> : <><Icon name="download" size={14} /> Excel</>}
                        </button>
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => downloadStudentReport(s, 'pdf')}
                          disabled={downloading === `${s._id}-pdf`}
                          title="Student Report PDF Download"
                        >
                          {downloading === `${s._id}-pdf` ? <div className="spinner spinner-sm" /> : <><Icon name="download" size={14} /> PDF</>}
                        </button>
                      </div>
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
