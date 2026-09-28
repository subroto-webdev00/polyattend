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

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [deptFilter, setDeptFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [resendingId, setResendingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);

  // Create-Teacher form. Note there is no semester / section / subject /
  // shift field here on purpose — those describe a Subject, not a person,
  // and are collected in the "Assign Subject" step instead.
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', departmentId: '' });

  const [assignForm, setAssignForm] = useState({ subjectName: '', subjectCode: '', semester: null, section: '', shift: '' });

  useEffect(() => {
    api.get('/departments').then(r => setDepartments(r.data.departments || [])).catch(() => {});
  }, []);

  const load = () => {
    setLoading(true);
    const query = deptFilter ? `?departmentId=${encodeURIComponent(deptFilter)}` : '';
    api.get(`/admin/teachers${query}`)
      .then(r => { setTeachers(r.data.teachers || []); setPendingInvites(r.data.pendingInvites || []); })
      .catch(() => toast.error('Could not load Teachers'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [deptFilter]);

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));
  const setAssign = f => e => setAssignForm(p => ({ ...p, [f]: e.target.value }));

  const openCreate = () => {
    setForm({ name: '', email: '', departmentId: deptFilter || '' });
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return toast.error('Enter Name for the new Teacher');
    if (!form.email.trim()) return toast.error('Enter Email');
    if (!form.departmentId) return toast.error('Select a Department');

    setSaving(true);
    try {
      const res = await api.post('/admin/teachers', form);
      toast.success(res.data.message || 'Teacher invite sent');
      setShowCreate(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const openAssign = (teacher) => {
    setAssignTarget(teacher);
    // A Teacher only picks a shift here if they don't have one yet —
    // otherwise their existing shift is reused and not asked again.
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
      const res = await api.post('/admin/teachers/assign-subject', {
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
    } catch { toast.error('Error'); }
  };

  const cancelInvite = async (invite) => {
    if (!window.confirm(`Cancel invite for ${invite.name}? This email's code will stop working.`)) return;
    const inviteId = getRecordId(invite);
    setCancellingId(inviteId);
    try {
      await api.delete(`/admin/teachers/${inviteId}`);
      toast.success('Invite cancelled');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    } finally {
      setCancellingId(null);
    }
  };

  const resendInvite = async (invite) => {
    const inviteId = getRecordId(invite);
    setResendingId(inviteId);
    try {
      const response = await api.post(`/admin/teachers/${inviteId}`);
      toast.success(response.data.message || 'Invite email sent again');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not resend invite');
    } finally {
      setResendingId(null);
    }
  };

  const filtered = teachers.filter(t =>
    !search
    || (t.name || '').toLowerCase().includes(search.toLowerCase())
    || (t.email || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title">Teacher</h2>
          <p className="page-sub">Create a Teacher in any Department, then assign them the Subjects they teach</p>
        </div>
        <button className="btn-primary" style={{ width: 'auto', padding: '9px 18px' }} onClick={openCreate}>
          <Icon name="plus" size={16} /> Create Teacher
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--txt3)' }}>
            <Icon name="search" size={14} />
          </span>
          <input
            className="form-input" style={{ paddingLeft: 34, fontSize: 13 }}
            placeholder="Search by name or Email" value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="form-select" style={{ maxWidth: 240 }} value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
          aria-label="Filter by Department"
        >
          <option value="">All Departments</option>
          {departments.map(d => (
            <option key={d.id || d._id} value={d.id || d._id}>{d.name}{d.code ? ` (${d.code})` : ''}</option>
          ))}
        </select>
      </div>

      {pendingInvites.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="section-title" style={{ marginBottom: 8 }}>Pending Invite ({pendingInvites.length})</div>
          <PersonCardGrid>
            {pendingInvites.map(inv => (
              <div key={getRecordId(inv)} style={{
                background: 'var(--bg)', border: '1px dashed var(--border2)',
                borderRadius: 'var(--radius-lg)', padding: '12px 14px',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{inv.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--txt2)' }}>{inv.email}</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  <span className="tag tag-amber" style={{ fontSize: 10 }}>Registration Pending</span>
                  {formatDepartment(inv.departmentId, inv.departmentCode) && (
                    <span className="sa-chip">{formatDepartment(inv.departmentId, inv.departmentCode)}</span>
                  )}
                  {inv.shift && (
                    <span className="sa-chip">{formatShift(inv.shift)} Shift</span>
                  )}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--txt3)' }}>
                  Subjects and shift are assigned after they register.
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button
                    onClick={() => resendInvite(inv)}
                    disabled={resendingId === getRecordId(inv) || cancellingId === getRecordId(inv)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      padding: '7px 8px', borderRadius: 8, fontSize: 11.5, fontWeight: 700,
                      border: '1px solid var(--border2)', background: 'var(--primary-light)', color: 'var(--primary)',
                      cursor: resendingId === getRecordId(inv) ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                      opacity: resendingId === getRecordId(inv) ? 0.6 : 1,
                    }}
                  >
                    <Icon name="mail" size={13} /> {resendingId === getRecordId(inv) ? 'Sending...' : 'Resend'}
                  </button>
                  <button
                    onClick={() => cancelInvite(inv)}
                    disabled={cancellingId === getRecordId(inv) || resendingId === getRecordId(inv)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      padding: '7px 8px', borderRadius: 8, fontSize: 11.5, fontWeight: 700,
                      border: '1px solid var(--border2)', background: 'transparent', color: 'var(--txt2)',
                      cursor: cancellingId === getRecordId(inv) ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                      opacity: cancellingId === getRecordId(inv) ? 0.6 : 1,
                    }}
                    onMouseEnter={e => { if (cancellingId !== getRecordId(inv)) { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; } }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--txt2)'; }}
                  >
                    <Icon name="x" size={13} /> {cancellingId === getRecordId(inv) ? 'Cancelling...' : 'Cancel'}
                  </button>
                </div>
              </div>
            ))}
          </PersonCardGrid>
        </div>
      )}

      <div className="section-title" style={{ marginBottom: 8 }}>Active Teachers ({filtered.length})</div>
      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon"><Icon name="school" size={24} /></div>
            <p>No Teachers yet</p>
          </div>
        </div>
      ) : (
        <PersonCardGrid>
          {filtered.map(t => (
            <PersonCard
              key={getRecordId(t)}
              person={t}
              actions={[
                { label: 'Assign Subject', icon: 'book', onClick: () => openAssign(t) },
                { label: t.isActive ? 'Deactivate' : 'Activate', variant: t.isActive ? 'danger' : undefined, onClick: () => toggleActive(t) },
                { label: 'Delete', variant: 'danger', onClick: () => setDeleteTarget(t) },
              ]}
            />
          ))}
        </PersonCardGrid>
      )}

      {/* CREATE TEACHER — no Subject / Semester / Group on this form. */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)}>
        <div className="modal-title">Create Teacher</div>

        <div className="form-group">
          <label className="form-label">Email *</label>
          <input className="form-input" type="email" placeholder="email@example.com" value={form.email} onChange={set('email')} />
        </div>

        <div className="form-group">
          <label className="form-label">Teacher Name *</label>
          <input className="form-input" placeholder="Full Name" value={form.name} onChange={set('name')} />
        </div>

        <div className="form-group">
          <label className="form-label">Department Name *</label>
          <select className="form-select" value={form.departmentId} onChange={set('departmentId')}>
            <option value="">— Select Department —</option>
            {departments.map(d => (
              <option key={d.id || d._id} value={d.id || d._id}>{d.name}{d.code ? ` (${d.code})` : ''}</option>
            ))}
          </select>
          {departments.length === 0 && (
            <span style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 4, display: 'block' }}>
              No departments yet — create one from the Departments page first.
            </span>
          )}
        </div>

        <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 4, marginBottom: 4 }}>
          Submitting sends a Registration Code to this email (valid for 1 month).
          Subjects are assigned after the Teacher registers.
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleCreate} disabled={saving}>
            {saving ? <><div className="spinner spinner-sm" /> Sending...</> : 'Send Invite'}
          </button>
        </div>
      </Modal>

      {/* ASSIGN SUBJECT — a Subject belongs to one Semester and one Group, so
          these are asked here and only here. */}
      <Modal open={!!assignTarget} onClose={() => setAssignTarget(null)}>
        <div className="modal-title">Assign Subject to {assignTarget?.name}</div>

        <div style={{
          fontSize: 12, color: 'var(--txt2)', background: 'var(--bg3)',
          padding: '8px 10px', borderRadius: 8, marginBottom: 14,
        }}>
          {formatDepartment(assignTarget?.departmentId, assignTarget?.departmentCode)}
          {assignTarget?.shift ? ` • ${formatShift(assignTarget.shift)} Shift` : ''}
        </div>

        {/* A Teacher invited without a shift needs one before any Subject can
            be filed, so it is asked here — but only then. Once they have one
            it is reused and this disappears. */}
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
