'use client';
import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import { formatDepartment, formatShift, formatSubject } from '@/lib/display';

// Department Admin's own Subject list — read-only.
//
// The scoping is NOT done here: GET /api/subjects forces
// `departmentId = auth.user.departmentId` AND `shift = auth.user.shift`
// from the signed-in account *after* any query params, so this page only
// ever receives the Subjects of its own Department and Shift no matter
// what the URL says. Other departments' Subjects can never reach it.
// Delete stays a Super Admin action (Admin Panel → Subjects).
export default function DepartmentAdminSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/subjects')
      .then(r => setSubjects(r.data.subjects || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Group by Semester+Shift+Group, same reading order as the Admin page.
  const groups = {};
  subjects.forEach(s => {
    const key = `Semester ${s.semester} • ${formatShift(s.shift) || s.shift || '—'} Shift • Group ${s.section}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Subjects</h2>
          <p className="page-sub">Subjects assigned to your Department ({subjects.length})</p>
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : subjects.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon"><Icon name="book" size={24} /></div>
            <p>No Subjects in your Department yet</p>
          </div>
        </div>
      ) : (
        Object.entries(groups).map(([subKey, items]) => (
          <div key={subKey} style={{ marginBottom: 14 }}>
            <div className="section-title">{subKey}</div>
            <div className="card">
              {items.map(s => (
                <div key={s._id} className="list-item">
                  <div className="item-icon icon-green"><Icon name="book" size={18} /></div>
                  <div className="item-content">
                    <div className="item-title">{formatSubject(s)}</div>
                    <div className="item-sub">
                      {formatDepartment(s.departmentId, s.departmentCode)} • Teacher: {s.teacherId?.name || 'Unassigned'}
                    </div>
                  </div>
                  <span className="tag tag-green">Active</span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
