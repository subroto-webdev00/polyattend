'use client';
import React, { useState, useEffect, useMemo } from 'react';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import { formatDepartment, formatShift } from '@/lib/display';

function initials(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

// Teacher: browse every Student in their own Department + Shift
// (server already scopes /api/users this way for the teacher role — see
// /api/users/route.js). Search by name/roll, filter by Semester/Group.
export default function TeacherStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [semester, setSemester] = useState('');
  const [section, setSection] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/users', { params: { role: 'student' } })
      .then(r => setStudents(r.data.users || []))
      .catch(err => setError(err.response?.data?.message || 'Failed to load Students'))
      .finally(() => setLoading(false));
  }, []);

  const semesters = useMemo(
    () => [...new Set(students.map(s => s.semester).filter(Boolean))].sort((a, b) => a - b),
    [students]
  );
  const sections = useMemo(
    () => [...new Set(students.map(s => s.section).filter(Boolean))].sort(),
    [students]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter(s => {
      if (semester && String(s.semester) !== String(semester)) return false;
      if (section && s.section !== section) return false;
      if (q && !(s.name || '').toLowerCase().includes(q) && !(s.studentId || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [students, search, semester, section]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Students</h2>
          <p className="page-sub">All Students in your Department &amp; Shift ({filtered.length}{filtered.length !== students.length ? ` of ${students.length}` : ''})</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or roll…"
          style={{
            flex: '1 1 220px', minWidth: 0, background: 'var(--bg2)', border: '1.5px solid var(--border)',
            borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--txt)', outline: 'none',
          }}
        />
        <select
          value={semester}
          onChange={e => setSemester(e.target.value)}
          style={{
            background: 'var(--bg2)', border: '1.5px solid var(--border)', borderRadius: 10,
            padding: '10px 14px', fontSize: 13, color: 'var(--txt)', outline: 'none',
          }}
        >
          <option value="">All Semesters</option>
          {semesters.map(sem => <option key={sem} value={sem}>Sem {sem}</option>)}
        </select>
        <select
          value={section}
          onChange={e => setSection(e.target.value)}
          style={{
            background: 'var(--bg2)', border: '1.5px solid var(--border)', borderRadius: 10,
            padding: '10px 14px', fontSize: 13, color: 'var(--txt)', outline: 'none',
          }}
        >
          <option value="">All Groups</option>
          {sections.map(sec => <option key={sec} value={sec}>Group {sec}</option>)}
        </select>
      </div>

      {error && (
        <div style={{
          background: 'rgba(248, 113, 113, 0.1)', border: '1px solid rgba(248, 113, 113, 0.25)',
          borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#f87171', marginBottom: 16,
        }}>
          ⚠️ {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon"><Icon name="users" size={24} /></div>
            <p>No Students found</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {filtered.map(s => (
            <div key={s._id} style={{
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
              padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700,
                }}>
                  {initials(s.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--txt2)' }}>Roll: {s.studentId}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {formatDepartment(s.departmentId, s.departmentCode) && <span className="tag tag-blue" style={{ fontSize: 10 }}>{formatDepartment(s.departmentId, s.departmentCode)}</span>}
                {s.shift && <span className="tag tag-purple" style={{ fontSize: 10 }}>{formatShift(s.shift)} Shift</span>}
                 {s.semester && <span className="tag tag-green" style={{ fontSize: 10 }}>Sem {s.semester}</span>}
                {s.section && <span className="tag tag-amber" style={{ fontSize: 10 }}>Group {s.section}</span>}
              </div>
              {s.mobile && (
                <div style={{ fontSize: 12, color: 'var(--txt2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="phone" size={12} /> {s.mobile}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
