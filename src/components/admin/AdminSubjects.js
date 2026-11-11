'use client';
import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import Modal from '@/components/common/Modal';
import toast from 'react-hot-toast';
import { formatDepartment, formatShift, formatSubject } from '@/lib/display';

// MISTAKE FIX: Admin could previously create/edit/delete Subjects
// directly here, which bypassed the actual rule now in place — a Teacher
// and their one Subject are only ever created together, by a Semester
// Admin, through the invite flow. This page is now read-only apart from
// Delete: it exists so Admin can see everything that exists, grouped by
// Department, without being able to create a Subject with no Teacher
// behind it. Delete sits behind a confirmation dialog (no accidental
// clicks) and is a soft delete — the Subject vanishes from every list
// while its Session/Attendance history stays in the database.
export default function AdminSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDept, setFilterDept] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

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

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/subjects/${deleteTarget._id}`);
      toast.success('Subject deleted');
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

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
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(s)}
                        title="Delete Subject"
                        aria-label={`Delete ${formatSubject(s)}`}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4, flexShrink: 0 }}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      {/* Delete confirmation — always shown before the DELETE request goes
          out, so a stray click on the trash icon can never remove a Subject.
          The attendance-history note is there because the delete is a soft
          delete: past Sessions/Attendances are kept. */}
      <Modal open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)}>
        <div className="modal-title">Delete Subject</div>
        {deleteTarget && (
          <>
            <p style={{ fontSize: 13.5, color: 'var(--txt2)', lineHeight: 1.6, margin: '4px 0 14px' }}>
              Are you sure you want to delete <strong style={{ color: 'var(--txt)' }}>{formatSubject(deleteTarget)}</strong>
              {' '}({formatDepartment(deleteTarget.departmentId, deleteTarget.departmentCode)})?
            </p>
            <div className="info-banner" style={{ marginBottom: 16 }}>
              <Icon name="info" size={16} />
              <span className="info-text">
                The Subject will be removed from every list. Attendance already taken for it will be kept in the database.
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button type="button" className="btn-secondary w-full" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
              <button type="button" className="btn-danger w-full" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
