'use client';
import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import Modal from '@/components/common/Modal';
import toast from 'react-hot-toast';
import { formatDepartment, formatShift, formatSubject } from '@/lib/display';

// Admin's Subject directory: every Subject by Department, with a Create
// button for making one (Name / Code / Department only — a Subject starts
// unplaced and gets its Semester / Group / Shift when a Teacher is given
// it through Assign Subject, which keeps the "one Subject = one Teacher"
// rule in one place). Delete sits behind a confirmation dialog (no
// accidental clicks) and is a soft delete — the Subject vanishes from
// every list while its Session/Attendance history stays in the database.
export default function AdminSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDept, setFilterDept] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', code: '', departmentId: '' });

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

  const setCreate = f => e => setCreateForm(p => ({ ...p, [f]: e.target.value }));

  const handleCreate = async () => {
    const name = createForm.name.trim();
    const code = createForm.code.trim().toUpperCase();
    if (!name) return toast.error('Enter Subject Name');
    if (!code) return toast.error('Enter Subject Code');
    if (!createForm.departmentId) return toast.error('Select a Department');

    setCreating(true);
    try {
      const res = await api.post('/subjects', {
        name,
        code,
        departmentId: createForm.departmentId,
      });
      toast.success(res.data.message || 'Subject created');
      setCreateOpen(false);
      setCreateForm({ name: '', code: '', departmentId: '' });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not create Subject');
    } finally {
      setCreating(false);
    }
  };

  // Group subjects by Department first, then by Semester+Shift+Group
  // within it, so the page reads as one section per department. Subjects
  // created but not yet assigned to a Teacher have no slot yet and are
  // collected under their own "not placed" section.
  const byDepartment = {};
  subjects.forEach(s => {
    const deptName = formatDepartment(s.departmentId, s.departmentCode) || 'Unknown Department';
    if (!byDepartment[deptName]) byDepartment[deptName] = {};
    const subKey = s.semester
      ? `Semester ${s.semester} • ${formatShift(s.shift) || s.shift} Shift • Group ${s.section}`
      : 'Not placed yet (no Teacher assigned)';
    if (!byDepartment[deptName][subKey]) byDepartment[deptName][subKey] = [];
    byDepartment[deptName][subKey].push(s);
  });

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title">Subjects</h2>
          <p className="page-sub">All Subjects by Department ({subjects.length})</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          style={{ width: 'auto', padding: '9px 18px' }}
          onClick={() => setCreateOpen(true)}
        >
          <Icon name="plus" size={16} /> Create Subject
        </button>
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

      {/* CREATE SUBJECT — only Name, Code and Department. The Subject starts
          unplaced: Semester / Group / Shift are filled in when a Teacher is
          given this Subject through Assign Subject. */}
      <Modal open={createOpen} onClose={() => !creating && setCreateOpen(false)}>
        <div className="modal-title">Create Subject</div>
        <p style={{ fontSize: 12.5, color: 'var(--txt2)', margin: '2px 0 14px', lineHeight: 1.6 }}>
          Create the Subject here, then assign it to a Teacher from the
          Teachers page — the Teacher's Semester, Group and Shift are set
          there.
        </p>

        <div className="form-group">
          <label className="form-label">Subject Name *</label>
          <input
            className="form-input"
            placeholder="e.g. Data Structure"
            value={createForm.name}
            onChange={setCreate('name')}
            disabled={creating}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Subject Code *</label>
          <input
            className="form-input"
            placeholder="e.g. CST-301"
            value={createForm.code}
            onChange={setCreate('code')}
            disabled={creating}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Department *</label>
          <select
            className="form-select"
            value={createForm.departmentId}
            onChange={setCreate('departmentId')}
            disabled={creating}
          >
            <option value="">— Select Department —</option>
            {departments.map(d => (
              <option key={d.id || d._id} value={d.id || d._id}>{d.name} ({d.code})</option>
            ))}
          </select>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleCreate} disabled={creating}>
            {creating ? <><div className="spinner spinner-sm" /> Creating...</> : 'Create Subject'}
          </button>
        </div>
      </Modal>

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
