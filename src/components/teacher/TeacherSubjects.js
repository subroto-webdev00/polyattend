'use client';
import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import { formatDepartment, formatShift } from '@/lib/display';

// View-only: a Teacher can be assigned multiple Subjects (across
// different Semesters/Groups, even different Shifts) by one or more
// Semester Admins. This page just lists everything they've been
// assigned — creating/editing a Subject is an Admin action, not
// something a Teacher does here (see admin/teachers/assign-subject).
export default function TeacherSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/subjects').then(r => setSubjects(r.data.subjects || [])).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">My Subjects</h2>
          <p className="page-sub">Subjects you have been assigned to ({subjects.length})</p>
        </div>
      </div>

      {subjects.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon"><Icon name="book" size={24} /></div>
            <p>No Subject assigned yet</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {subjects.map(s => (
            <div key={s._id} style={{
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
              padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: 'var(--primary-light)', color: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="book" size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--txt2)' }}>{s.code}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                <span className="tag tag-blue" style={{ fontSize: 10 }}>{formatDepartment(s.departmentId, s.departmentCode)}</span>
                <span className="tag tag-green" style={{ fontSize: 10 }}>Sem {s.semester}</span>
                <span className="tag tag-amber" style={{ fontSize: 10 }}>Group {s.section}</span>
                {s.shift && <span className="tag tag-purple" style={{ fontSize: 10 }}>{formatShift(s.shift)} Shift</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
