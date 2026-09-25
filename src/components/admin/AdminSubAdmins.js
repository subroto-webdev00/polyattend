'use client';
import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import toast from 'react-hot-toast';
import Modal from '@/components/common/Modal';
import ConfirmDeleteModal from '@/components/common/ConfirmDeleteModal';
import { formatDepartment, formatShift } from '@/lib/display';

const SHIFT_OPTIONS = [
  { value: '1st', label: '🌅 Morning Shift' },
  { value: '2nd', label: '🌙 Day Shift' },
];

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';
}

// Deterministic gradient per person so avatars aren't all identical
const AVATAR_GRADIENTS = [
  ['#10b981', '#059669'],
  ['#22c55e', '#16a34a'],
  ['#14b8a6', '#0d9488'],
  ['#34d399', '#10b981'],
  ['#4ade80', '#22c55e'],
];
function gradientFor(id = '') {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const [a, b] = AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

function SubAdminCard({ person, index, onToggle, onDelete, busy }) {
  return (
    <div className="sa-card" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="sa-card-top">
        <div className="sa-avatar-wrap">
          <div className="sa-avatar" style={{ background: gradientFor(person.id || person._id || person.email) }}>
            {initials(person.name)}
          </div>
          <span className={`sa-dot ${person.isActive ? 'on' : 'off'}`} />
        </div>
        <div className="sa-info">
          <div className="sa-name">{person.name}</div>
          <div className="sa-email">{person.email}</div>
        </div>
      </div>

      <div className="sa-badges">
        <span className="sa-badge sa-badge-role"><Icon name="shield" size={11} /> Department Admin</span>
        {(person.departmentId || person.department) && <span className="sa-badge sa-badge-dept">{formatDepartment(person.departmentId || person.department, person.departmentCode)}</span>}
        {person.shift && (
          <span className="sa-badge sa-badge-shift">
            {(person.shift === '1st' || person.shift === 'first') ? '🌅 Morning' : '🌙 Day'}
          </span>
        )}
      </div>

      <button
        className={`sa-action ${person.isActive ? 'danger' : 'primary'}`}
        onClick={() => onToggle(person)}
        disabled={busy}
      >
        <Icon name={person.isActive ? 'user-x' : 'user-check'} size={14} />
        {person.isActive ? 'Deactivate' : 'Activate'}
      </button>
      <button className="sa-action danger" onClick={() => onDelete(person)}>
        <Icon name="trash" size={14} /> Delete
      </button>

      <style jsx>{`
        .sa-card {
          position: relative;
          background: var(--bg);
          border: 1px solid var(--border2);
          border-radius: var(--radius-lg);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          opacity: 0;
          animation: saFadeUp 0.45s ease forwards;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .sa-card:hover {
          transform: translateY(-3px);
          border-color: var(--primary);
          box-shadow: 0 10px 24px -12px rgba(16, 185, 129, 0.35);
        }
        .sa-card-top {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .sa-avatar-wrap {
          position: relative;
          flex-shrink: 0;
        }
        .sa-avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: 700;
          font-size: 14px;
          letter-spacing: 0.5px;
          box-shadow: 0 4px 10px -4px rgba(16, 185, 129, 0.5);
        }
        .sa-dot {
          position: absolute;
          bottom: -1px;
          right: -1px;
          width: 11px;
          height: 11px;
          border-radius: 50%;
          border: 2px solid var(--bg);
        }
        .sa-dot.on {
          background: #22c55e;
          animation: saPulse 2s ease-in-out infinite;
        }
        .sa-dot.off {
          background: var(--txt3);
        }
        .sa-info {
          min-width: 0;
        }
        .sa-name {
          font-weight: 700;
          font-size: 14px;
          color: var(--txt);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sa-email {
          font-size: 11.5px;
          color: var(--txt2);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sa-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .sa-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10.5px;
          font-weight: 600;
          padding: 3px 9px;
          border-radius: 20px;
          background: var(--bg3);
          color: var(--txt2);
        }
        .sa-badge-role {
          background: var(--primary-light);
          color: var(--primary);
        }
        .sa-action {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 2px;
          padding: 8px 10px;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 700;
          border: 1px solid var(--border2);
          background: transparent;
          color: var(--txt2);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .sa-action:hover { transform: translateY(-1px); }
        .sa-action.danger:hover {
          background: rgba(239, 68, 68, 0.12);
          border-color: #ef4444;
          color: #ef4444;
        }
        .sa-action.primary:hover {
          background: var(--primary-light);
          border-color: var(--primary);
          color: var(--primary);
        }
        .sa-action:disabled { opacity: 0.6; cursor: not-allowed; }
        @keyframes saFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes saPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
          50% { box-shadow: 0 0 0 5px rgba(34, 197, 94, 0); }
        }
      `}</style>
    </div>
  );
}

function PendingInviteCard({ invite, index, onCancel, cancelling }) {
  const department = invite.department || invite.departmentId;
  const departmentLabel = formatDepartment(department, invite.departmentCode);
  const shiftLabel = formatShift(invite.shift);

  return (
    <div className="pi-card" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="pi-top">
        <div className="pi-icon"><Icon name="mail" size={16} /></div>
        <div>
          <div className="pi-name">{invite.name}</div>
          <div className="pi-email">{invite.email}</div>
        </div>
      </div>
      <div className="pi-badges">
        <span className="pi-badge-waiting">
          <span className="pi-blink" /> Registration Pending
        </span>
        {departmentLabel && <span className="pi-badge-dept"><Icon name="department" size={11} />{departmentLabel}</span>}
        {shiftLabel && <span className="pi-badge-shift"><Icon name="clock" size={11} />{shiftLabel} Shift</span>}
      </div>

      <button className="pi-cancel" onClick={() => onCancel(invite)} disabled={cancelling}>
        <Icon name="x" size={13} /> {cancelling ? 'Cancelling...' : 'Cancel Invite'}
      </button>

      <style jsx>{`
        .pi-card {
          background: var(--bg);
          border: 1px dashed var(--border2);
          border-radius: var(--radius-lg);
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          opacity: 0;
          animation: piFadeUp 0.45s ease forwards;
          transition: border-color 0.2s ease, transform 0.2s ease;
        }
        .pi-card:hover {
          transform: translateY(-2px);
          border-color: #d97706;
        }
        .pi-top {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .pi-icon {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(217, 119, 6, 0.12);
          color: #d97706;
          flex-shrink: 0;
        }
        .pi-name {
          font-weight: 700;
          font-size: 13.5px;
          color: var(--txt);
        }
        .pi-email {
          font-size: 11px;
          color: var(--txt2);
        }
        .pi-badges {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .pi-badge-waiting {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          font-weight: 700;
          padding: 3px 9px;
          border-radius: 20px;
          background: rgba(217, 119, 6, 0.12);
          color: #d97706;
        }
        .pi-badge-dept,
        .pi-badge-shift {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10.5px;
          font-weight: 600;
          color: var(--txt2);
          background: var(--bg3);
          padding: 3px 9px;
          border-radius: 20px;
        }
        .pi-blink {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #d97706;
          animation: piBlink 1.4s ease-in-out infinite;
        }
        .pi-cancel {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 7px 10px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          border: 1px solid var(--border2);
          background: transparent;
          color: var(--txt2);
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s ease;
        }
        .pi-cancel:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.12);
          border-color: #ef4444;
          color: #ef4444;
        }
        .pi-cancel:disabled { opacity: 0.6; cursor: not-allowed; }
        @keyframes piFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes piBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }
      `}</style>
    </div>
  );
}

export default function AdminSubAdmins() {
  const [subAdmins, setSubAdmins] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', email: '', departmentId: '', departmentCode: '', shift: '' });

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/admin/sub-admins'),
      api.get('/departments'),
    ]).then(([subRes, deptRes]) => {
      setSubAdmins(subRes.data.subAdmins || []);
      setPendingInvites(subRes.data.pendingInvites || []);
      setDepartments(deptRes.data.departments || []);
    }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const set = f => e => {
    const value = e.target.value;
    if (f === 'departmentId') {
      const dept = departments.find(d => (d.id || d._id) === value);
      setForm(p => ({ ...p, departmentId: value, departmentCode: dept?.code || '' }));
    } else {
      setForm(p => ({ ...p, [f]: value }));
    }
  };

  const openCreate = () => {
    setForm({ name: '', email: '', departmentId: '', departmentCode: '', shift: '' });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.departmentId || !form.shift) {
      return toast.error('Enter Name, Email, Department and Shift');
    }
    setSaving(true);
    try {
      await api.post('/admin/sub-admins', form);
      toast.success('Department Admin invite sent — ask them to check their email');
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (person) => {
    const targetId = person.id || person._id;
    setTogglingId(targetId);
    try {
      await api.put(`/users/${targetId}`, { isActive: !person.isActive });
      toast.success(person.isActive ? 'Deactivated' : 'Activated');
      load();
    } catch {
      toast.error('Error');
    } finally {
      setTogglingId(null);
    }
  };

  // Pending invite hasn't become a real account yet — a lightweight confirm
  // is enough (no typed-name step, unlike deleting an active Department Admin).
  const cancelInvite = async (invite) => {
    if (!window.confirm(`Cancel invite for ${invite.name}? This email's code will stop working.`)) return;
    const targetId = invite.id || invite._id;
    setCancellingId(targetId);
    try {
      await api.delete(`/admin/sub-admins/${targetId}`);
      toast.success('Invite cancelled');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    } finally {
      setCancellingId(null);
    }
  };

  const filteredSubAdmins = subAdmins.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="page sa-page">
      <div className="page-header sa-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title">Department Admin</h2>
          <p className="page-sub">Create and manage Department Admins by Department + Shift</p>
        </div>
        <button className="btn-primary sa-add-btn" style={{ width: 'auto', padding: '9px 18px' }} onClick={openCreate}>
          <Icon name="plus" size={16} /> New Department Admin
        </button>
      </div>

      <div className="sa-search" style={{ marginBottom: 16, position: 'relative', maxWidth: 320 }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--txt3)' }}>
          <Icon name="search" size={14} />
        </span>
        <input
          className="form-input"
          style={{ paddingLeft: 34, fontSize: 13 }}
          placeholder="Search by name or Email"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {pendingInvites.length > 0 && (
        <div className="sa-section" style={{ marginBottom: 20 }}>
          <div className="section-title" style={{ marginBottom: 8 }}>Pending Invite ({pendingInvites.length})</div>
          <div className="sa-grid">
            {pendingInvites.map((inv, i) => (
              <PendingInviteCard
                key={inv.id || inv._id} invite={inv} index={i}
                onCancel={cancelInvite}
                cancelling={cancellingId === (inv.id || inv._id)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="sa-section">
        <div className="section-title" style={{ marginBottom: 8 }}>Active Department Admins ({filteredSubAdmins.length})</div>
        {filteredSubAdmins.length === 0 ? (
          <div className="card sa-empty">
            <div className="empty">
              <div className="empty-icon"><Icon name="users" size={24} /></div>
              <p>No Department Admins yet</p>
            </div>
          </div>
        ) : (
          <div className="sa-grid">
            {filteredSubAdmins.map((s, i) => (
              <SubAdminCard
                key={s.id || s._id}
                person={s}
                index={i}
                busy={togglingId === (s.id || s._id)}
                onToggle={toggleActive}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <div className="modal-title">Invite New Department Admin</div>

        <div className="form-group">
          <label className="form-label">Department Admin Name *</label>
          <input className="form-input" placeholder="Full Name" value={form.name} onChange={set('name')} />
        </div>
        <div className="form-group">
          <label className="form-label">Email *</label>
          <input className="form-input" type="email" placeholder="email@example.com" value={form.email} onChange={set('email')} />
        </div>
        <div className="form-group">
          <label className="form-label">Department *</label>
          <select className="form-select" value={form.departmentId} onChange={set('departmentId')}>
            <option value="">-- Select Department --</option>
            {departments.map(d => <option key={d.id || d._id} value={d.id || d._id}>{d.name} ({d.code})</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Department Code</label>
          <input className="form-input" value={form.departmentCode} onChange={set('departmentCode')} placeholder="Auto-filled when Department is selected" />
        </div>
        <div className="form-group">
          <label className="form-label">Shift *</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {SHIFT_OPTIONS.map(s => {
              const selected = form.shift === s.value;
              return (
                <button
                  key={s.value} type="button"
                  onClick={() => setForm(p => ({ ...p, shift: s.value }))}
                  style={{
                    flex: 1, padding: '12px 10px', borderRadius: 10,
                    border: selected ? '2px solid var(--primary)' : '2px solid var(--border2)',
                    background: selected ? 'var(--primary-light)' : 'var(--bg)',
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                    fontSize: 13.5, fontWeight: 700, color: selected ? 'var(--primary)' : 'var(--txt)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 4, marginBottom: 4 }}>
          Submitting will send a 12-digit Registration Code to this email (valid for 1 month).
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? <><div className="spinner spinner-sm" /> Sending...</> : 'Send Invite'}
          </button>
        </div>
      </Modal>

      <ConfirmDeleteModal
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async (confirmName) => {
          const targetId = deleteTarget.id || deleteTarget._id;
          await api.delete(`/users/${targetId}`, { data: { confirmName } });
          toast.success(`${deleteTarget.name} has been deleted`);
          load();
        }}
      />

      <style jsx>{`
        .sa-page {
          animation: saPageIn 0.4s ease;
        }
        .sa-header {
          animation: saPageIn 0.4s ease;
        }
        .sa-add-btn {
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .sa-add-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 18px -8px rgba(16, 185, 129, 0.5);
        }
        .sa-search {
          animation: saPageIn 0.4s ease 0.05s backwards;
        }
        .sa-section {
          animation: saPageIn 0.4s ease 0.1s backwards;
        }
        .sa-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 14px;
        }
        .sa-empty {
          animation: saPageIn 0.4s ease;
        }
        @keyframes saPageIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}