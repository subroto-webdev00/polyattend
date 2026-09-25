'use client';
import React, { useState, useEffect, useMemo } from 'react';
import api, { getBlobErrorMessage } from '@/utils/api';
import Icon from '@/components/common/Icon';
import toast from 'react-hot-toast';
import { formatDepartment, formatShift, formatSubject } from '@/lib/display';

export default function TeacherReports() {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [report, setReport] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(true);

  // ── FIX (Requirement #3): search bars ──────────────────────────────────
  const [subjectSearch, setSubjectSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  useEffect(() => {
    api.get('/subjects').then(r => setSubjects(r.data.subjects || [])).finally(() => setLoadingSubjects(false));
  }, []);

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

  const filteredReport = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!report) return [];
    if (!q) return report;
    return report.filter(r =>
      r.student.name?.toLowerCase().includes(q) ||
      r.student.studentId?.toLowerCase().includes(q)
    );
  }, [report, studentSearch]);

  const loadReport = async (subject) => {
    setSelectedSubject(subject);
    setLoading(true);
    setStudentSearch('');
    try {
      const res = await api.get(`/attendance/subject/${subject._id}`);
      setReport(res.data.report);
      setSessions(res.data.sessions);
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setLoading(false); }
  };

  const downloadReport = async (endpoint, filenameBase, format) => {
    try {
      const res = await api.get(`${endpoint}${format === 'pdf' ? '?format=pdf' : ''}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `${filenameBase}.${format === 'pdf' ? 'pdf' : 'xlsx'}`; a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Report download started!');
    } catch (err) { toast.error(await getBlobErrorMessage(err)); }
  };

  const downloadSubjectReport = (subjectId, format) => downloadReport(`/reports/subject/${subjectId}`, 'subject_report', format);
  const downloadStudentReport = (studentId, format) => downloadReport(`/reports/student/${studentId}`, 'student_report', format);
  const downloadSessionReport = (sessionId, format) => downloadReport(`/reports/class/${sessionId}`, 'session_report', format);

  // ── FIX (grouping request): group subjects by Section wherever the list
  // shows a Section, instead of a flat grid.
  const groupedSubjects = useMemo(() => {
    const groups = {};
    filteredSubjects.forEach(s => {
      const key = s.section || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    return Object.keys(groups).sort().map(key => ({ section: key, items: groups[key] }));
  }, [filteredSubjects]);

  if (loadingSubjects) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Attendance Reports</h2>
        <p className="page-sub">View Subject-wise attendance and download as Excel/PDF</p>
      </div>

      {!selectedSubject ? (
        <>
          <div className="section-title">Select Subject</div>
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--txt3)' }}>
              <Icon name="search" size={15} />
            </span>
            <input
              type="text"
              className="form-input"
              placeholder="Search by Subject name or code..."
              value={subjectSearch}
              onChange={e => setSubjectSearch(e.target.value)}
              style={{ paddingLeft: 36, maxWidth: 360 }}
            />
          </div>
          {filteredSubjects.length === 0 ? (
            <div className="card"><div className="empty"><p>{subjects.length === 0 ? 'No subjects yet' : 'No subject found'}</p></div></div>
          ) : groupedSubjects.map(group => (
            <div key={group.section} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', background: 'var(--bg3)', padding: '6px 12px', borderRadius: 8, marginBottom: 8 }}>
                Group: {group.section}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {group.items.map(s => (
                  <div key={s._id} className="subject-card" onClick={() => loadReport(s)}>
                    <div className="subject-code">{s.code}</div>
                    <div className="subject-name">{s.name}</div>
                    <div className="subject-meta">{formatDepartment(s.departmentId, s.departmentCode)} • Sem {s.semester} • Group {s.section} • {formatShift(s.shift)} Shift</div>
                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--info)', fontSize: 13, fontWeight: 600 }}>
                      <Icon name="eye" size={14} /> View Report
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <button className="btn-secondary btn-sm" onClick={() => { setSelectedSubject(null); setReport(null); }}>
              <Icon name="chevronLeft" size={14} /> Back
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{formatSubject(selectedSubject)}</div>
              <div style={{ fontSize: 12, color: 'var(--txt2)' }}>{formatDepartment(selectedSubject.departmentId, selectedSubject.departmentCode)} • Sem {selectedSubject.semester} • Group {selectedSubject.section} • {formatShift(selectedSubject.shift)} Shift</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn-secondary btn-sm" onClick={() => downloadSubjectReport(selectedSubject._id, 'excel')}>
                <Icon name="download" size={14} /> Excel
              </button>
              <button className="btn-secondary btn-sm" onClick={() => downloadSubjectReport(selectedSubject._id, 'pdf')}>
                <Icon name="download" size={14} /> PDF
              </button>
            </div>
          </div>

          {loading ? <div className="loading"><div className="spinner" /></div> : !report ? null : (
            <>
              <div className="stats-grid" style={{ marginBottom: 16 }}>
                <div className="stat-card stat-blue">
                  <div className="stat-val">{sessions.length}</div>
                  <div className="stat-lbl">Total Classes</div>
                </div>
                <div className="stat-card stat-green">
                  <div className="stat-val">{report.length}</div>
                  <div className="stat-lbl">Students</div>
                </div>
                <div className="stat-card stat-amber">
                  <div className="stat-val">
                    {report.length ? Math.round(report.reduce((s, r) => s + r.percentage, 0) / report.length) : 0}%
                  </div>
                  <div className="stat-lbl">Class Avg</div>
                </div>
                <div className="stat-card stat-red">
                  <div className="stat-val">{report.filter(r => r.percentage < 75).length}</div>
                  <div className="stat-lbl">Below 75%</div>
                </div>
              </div>

              <div className="section-title">Student-wise Attendance</div>
              <div style={{ position: 'relative', marginBottom: 14 }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--txt3)' }}>
                  <Icon name="search" size={15} />
                </span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search by Student name or ID..."
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  style={{ paddingLeft: 36, maxWidth: 360 }}
                />
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Student</th>
                      <th>ID</th>
                      <th>Total</th>
                      <th>Present</th>
                      <th>Absent</th>
                      <th>%</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReport.length === 0 ? (
                      <tr><td colSpan={8} style={{ textAlign: 'center', padding: 20, color: 'var(--txt2)' }}>No student found</td></tr>
                    ) : filteredReport.map((r, i) => (
                      <tr key={r.student._id}>
                        <td>{i + 1}</td>
                        <td style={{ fontWeight: 500 }}>{r.student.name}</td>
                        <td><code style={{ fontSize: 11 }}>{r.student.studentId}</code></td>
                        <td>{r.total}</td>
                        <td><span className="att-p">{r.present}</span></td>
                        <td><span className="att-a">{r.absent}</span></td>
                        <td>
                          <span style={{ fontWeight: 700, color: r.percentage >= 75 ? 'var(--primary)' : r.percentage >= 60 ? 'var(--accent)' : 'var(--danger)' }}>
                            {r.percentage}%
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn-icon" title="Download Excel" onClick={() => downloadStudentReport(r.student._id, 'excel')}>
                              <Icon name="download" size={14} />
                            </button>
                            <button className="btn-icon" title="Download PDF" onClick={() => downloadStudentReport(r.student._id, 'pdf')}>
                              <Icon name="download" size={14} style={{ opacity: 0.7 }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {sessions.length > 0 && (
                <>
                  <div className="section-title" style={{ marginTop: 20 }}>Sessions</div>
                  <div className="card">
                    {sessions.map(s => (
                      <div key={s._id} className="list-item" style={{ cursor: 'default' }}>
                        <div className="item-icon icon-blue"><Icon name="calendar" size={18} /></div>
                        <div className="item-content">
                          <div className="item-title">{new Date(s.date).toLocaleDateString('en-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                          <div className="item-sub">{s.presentCount}/{s.totalStudents} present</div>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn-icon" title="Download Excel" onClick={() => downloadSessionReport(s._id, 'excel')}>
                            <Icon name="download" size={16} />
                          </button>
                          <button className="btn-icon" title="Download PDF" onClick={() => downloadSessionReport(s._id, 'pdf')}>
                            <Icon name="download" size={16} style={{ opacity: 0.7 }} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
