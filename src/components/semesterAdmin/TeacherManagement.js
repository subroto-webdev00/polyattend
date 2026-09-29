'use client';
import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import toast from 'react-hot-toast';
import PersonCard, { PersonCardGrid } from '@/components/common/PersonCard';
import Modal from '@/components/common/Modal';
import ConfirmDeleteModal from '@/components/common/ConfirmDeleteModal';
import { formatDepartment, formatShift } from '@/lib/display';

const GROUPS = ['A', 'B', 'C', 'D'];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const SHIFTS = [
  { value: 'first', label: 'Morning' },
  { value: 'second', label: 'Day' },
];

// The API exposes `id`, some older shapes expose `_id` — accept both.
const getRecordId = record => record?.id || record?._id;

// Teacher Management for a Department Admin.
//
// The list is department-wide and needs no filter: the API scopes it to the
// caller's own Department. There is no "Create Teacher" here on purpose —
// creating a Teacher is a Super Admin action (see /admin/teachers). This
// screen is for seeing the Department's Teachers and attaching Subjects to
// them.
export default function TeacherManagement() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [noDepartment, setNoDepartment] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [assignForm, setAssignForm] = useState({ subjectName: '', subjectCode: '', semester: null, section: '', shift: '' });

  const load = () => {
    setLoading(true);
    api.get('/semesterAdmin/teachers')
      .then(r => {
        setTeachers(r.data.teachers || []);
        setNoDepartment(!!r.data.noDepartment);
      })
      .catch(err => toast.error(err.response?.data?.message || 'Could not load Teachers'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const setAssign = f => e => setAssignForm(p => ({ ...p, [f]: e.target.value }));

  const openAssign = (teacher) => {
    setAssignTarget(teacher);
    // Only asked when the Teacher has no shift yet; otherwise it is reused.
    setAssignForm({ subjectName: '', subjectCode: '', semester: null, section: '', shift: teacher?.shift || '' });
  };

  const handleAssign = async () => {
    if (!assignForm.subjectName.trim() || !assignForm.subjectCode.trim()) {
      return toast.error('Enter Subject Name and Subject Code');
    }
    if (!assignForm.semester) return toast.error('Select a Semester');
    if (!assignForm.section) return toast.error('Select a Group');
    if (!assignTarget?.shift && !assignForm.shift) return toast.error('Select a Shift');

    setSaving(true);
    try {
      const res = await api.post('/semesterAdmin/teachers/assign-subject', {
        teacherId: getRecordId(assignTarget),
        subjectName: assignForm.subjectName,
        subjectCode: assignForm.subjectCode,
        semester: assignForm.semester,
        section: assignForm.section,
        shift: assignForm.shift || assignTarget?.shift || '',
      });
      toast.success(res.data.message || 'Subject assigned');
      setAssignTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (teacher) => {
    try {
      await api.put(`/users/${getRecordId(teacher)}`, { isActive: !teacher.isActive });
      toast.success(teacher.isActive ? 'Deactivated' : 'Activated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    }
  };

  const filtered = teachers.filter(t =>
    !search
    || (t.name || '').toLowerCase().includes(search.toLowerCase())
    || (t.email || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const activeCount = teachers.filter(t => t.isActive).length;

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Teacher Management</h2>
        <p className="page-sub">
          Teachers in your Department, and the Subjects assigned to each of them
        </p>
      </div>

      {noDepartment ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon"><Icon name="department" size={24} /></div>
            <p>Your account has no Department</p>
            <p style={{ fontSize: 12, color: 'var(--txt3)' }}>
              Ask an Admin to set your Department, then Teachers will appear here.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 16, position: 'relative', maxWidth: 320 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--txt3)' }}>
              <Icon name="search" size={14} />
            </span>
            <input
              className="form-input" style={{ paddingLeft: 34, fontSize: 13 }}
              placeholder="Search by name or Email" value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="section-title" style={{ marginBottom: 8 }}>
            Teachers ({filtered.length}{activeCount !== teachers.length ? `, ${activeCount} active` : ''})
          </div>

          {filtered.length === 0 ? (
            <div className="card">
              <div className="empty">
                <div className="empty-icon"><Icon name="school" size={24} /></div>
                <p>{search ? 'No Teacher matches your search' : 'No Teachers in your Department yet'}</p>
                {!search && (
                  <p style={{ fontSize: 12, color: 'var(--txt3)' }}>
                    Teachers are created by an Admin. Once one joins your Department they appear here.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <PersonCardGrid>
              {filtered.map(t => (
                <PersonCard
                  key={getRecordId(t)}
                  person={t}
                  actions={[
                    { label: 'Assign Subject', icon: 'book', variant: 'primary', onClick: () => openAssign(t) },
                    { label: t.isActive ? 'Deactivate' : 'Activate', variant: t.isActive ? 'danger' : undefined, onClick: () => toggleActive(t) },
                    { label: 'Delete', variant: 'danger', onClick: () => setDeleteTarget(t) },
                  ]}
                />
              ))}
            </PersonCardGrid>
          )}
        </>
      )}

      {/* ASSIGN SUBJECT — a Subject belongs to one Semester, Group and Shift,
          so those are asked here and only here. */}
      <Modal open={!!assignTarget} onClose={() => setAssignTarget(null)}>
        <div className="modal-title">Assign Subject to {assignTarget?.name}</div>

        <div style={{
          fontSize: 12, color: 'var(--txt2)', background: 'var(--bg3)',
          padding: '8px 10px', borderRadius: 8, marginBottom: 14,
        }}>
          {formatDepartment(assignTarget?.departmentId, assignTarget?.departmentCode)}
          {assignTarget?.shift ? ` • ${formatShift(assignTarget.shift)} Shift` : ''}
        </div>

        {!assignTarget?.shift && (
          <div className="form-group">
            <label className="form-label">Shift *</label>
            <select className="form-select" value={assignForm.shift} onChange={setAssign('shift')}>
              <option value="">— Select Shift —</option>
              {SHIFTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Subject Name *</label>
          <input className="form-input" placeholder="e.g. Data Structure" value={assignForm.subjectName} onChange={setAssign('subjectName')} />
        </div>
        <div className="form-group">
          <label className="form-label">Subject Code *</label>
          <input className="form-input" placeholder="e.g. CST-301" value={assignForm.subjectCode} onChange={setAssign('subjectCode')} />
        </div>

        <div className="form-group">
          <label className="form-label">Semester *</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {SEMESTERS.map(sem => (
              <button
                key={sem} type="button"
                onClick={() => setAssignForm(p => ({ ...p, semester: sem }))}
                style={{
                  padding: '10px 0', borderRadius: 10, textAlign: 'center',
                  border: assignForm.semester === sem ? '2px solid var(--primary)' : '2px solid var(--border2)',
                  background: assignForm.semester === sem ? 'var(--primary-light)' : 'var(--bg)',
                  color: assignForm.semester === sem ? 'var(--primary)' : 'var(--txt)',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
                }}
              >
                {sem}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Group *</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {GROUPS.map(g => (
              <button
                key={g} type="button"
                onClick={() => setAssignForm(p => ({ ...p, section: g }))}
                style={{
                  padding: '10px 0', borderRadius: 10, textAlign: 'center',
                  border: assignForm.section === g ? '2px solid var(--primary)' : '2px solid var(--border2)',
                  background: assignForm.section === g ? 'var(--primary-light)' : 'var(--bg)',
                  color: assignForm.section === g ? 'var(--primary)' : 'var(--txt)',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
                }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {assignTarget?.subjects?.length > 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--txt2)', marginTop: 2, marginBottom: 4 }}>
            Already assigned: {assignTarget.subjects.map(s => `${s.name} (${s.code}) — Sem ${s.semester}, Grp ${s.section}`).join('; ')}
          </div>
        )}

        <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 4, marginBottom: 4 }}>
          Only one Teacher can be assigned to a Subject.
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => setAssignTarget(null)}>Cancel</button>
          <button className="btn-primary" onClick={handleAssign} disabled={saving}>
            {saving ? <><div className="spinner spinner-sm" /> Saving...</> : 'Assign Subject'}
          </button>
        </div>
      </Modal>

      <ConfirmDeleteModal
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async (confirmName) => {
          await api.delete(`/users/${getRecordId(deleteTarget)}`, { data: { confirmName } });
          toast.success(`${deleteTarget.name} has been deleted`);
          load();
        }}
      />
    </div>
  );
}
