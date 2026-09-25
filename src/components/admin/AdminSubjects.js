'use client';
import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import { formatDepartment, formatShift, formatSubject } from '@/lib/display';

// MISTAKE FIX: Admin could previously create/edit/delete Subjects
// directly here, which bypassed the actual rule now in place — a Teacher
// and their one Subject are only ever created together, by a Semester
// Admin, through the invite flow. This page is now read-only: it exists
// so Admin can see everything that exists, grouped by Department,
// without being able to create a Subject with no Teacher behind it.
export default function AdminSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDept, setFilterDept] = useState('');

  const load = () => {
    setLoading(true);
    const params = { ...(filterDept && { departmentId: filterDept }) };
    Promise.all([
      api.get('/subjects', { params }),
      api.get('/departments/public'),
    ]).then(([s, d]) => {
      setSubjects(s.data.subjects || []);
      setDepartments(d.data.departments || []);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, [filterDept]);

  // Group subjects by Department first, then by Semester+Shift+Group
  // within it, so the page reads as one section per department.
  const byDepartment = {};
  subjects.forEach(s => {
    const deptName = formatDepartment(s.departmentId, s.departmentCode) || 'Unknown Department';
    if (!byDepartment[deptName]) byDepartment[deptName] = {};
    const subKey = `Semester ${s.semester} • ${formatShift(s.shift) || s.shift} Shift • Group ${s.section}`;
    if (!byDepartment[deptName][subKey]) byDepartment[deptName][subKey] = [];
    byDepartment[deptName][subKey].push(s);
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Subjects</h2>
          <p className="page-sub">All Subjects by Department ({subjects.length})</p>
        </div>
      </div>

      <div className="filter-bar">
        <select className="form-select" style={{ width: 'auto' }} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id || d._id} value={d.id || d._id}>{d.name} ({d.code})</option>)}
        </select>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : subjects.length === 0 ? (
        <div className="card"><div className="empty"><div className="empty-icon"><Icon name="book" size={24} /></div><p>No subjects yet</p></div></div>
      ) : (
        Object.entries(byDepartment).map(([deptName, groups]) => (
          <div key={deptName} style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 14, fontWeight: 800, color: 'var(--primary)', marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Icon name="department" size={16} /> {deptName}
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt3)' }}>
                ({Object.values(groups).reduce((sum, items) => sum + items.length, 0)} Subjects)
              </span>
            </div>
            {Object.entries(groups).map(([subKey, items]) => (
              <div key={subKey} style={{ marginBottom: 14 }}>
                <div className="section-title">{subKey}</div>
                <div className="card">
                  {items.map(s => (
                    <div key={s._id} className="list-item">
                      <div className="item-icon icon-green"><Icon name="book" size={18} /></div>
                      <div className="item-content">
                        <div className="item-title">{formatSubject(s)}</div>
                        <div className="item-sub">{formatDepartment(s.departmentId, s.departmentCode)} • Teacher: {s.teacherId?.name || 'Unassigned'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
