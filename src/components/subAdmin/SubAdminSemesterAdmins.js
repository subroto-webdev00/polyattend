'use client';
import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import toast from 'react-hot-toast';
import Modal from '@/components/common/Modal';
import ConfirmDeleteModal from '@/components/common/ConfirmDeleteModal';
import { formatDepartment, formatShift } from '@/lib/display';

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

function SemesterAdminCard({ person, onToggle, onDelete }) {
  const initial = (person.name || '?').trim().charAt(0).toUpperCase();
  return (
    <div className="sa-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div className="sa-avatar">{initial}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {person.name}
            </div>
            <span className={person.isActive ? 'sa-dot sa-dot-on' : 'sa-dot sa-dot-off'} title={person.isActive ? 'Active' : 'Inactive'} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {person.email}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
        <span className="sa-chip sa-chip-primary">Semester Admin</span>
        {formatDepartment(person.departmentId, person.departmentCode) && <span className="sa-chip">{formatDepartment(person.departmentId, person.departmentCode)}</span>}
        {(person.semesters && person.semesters.length ? person.semesters : (person.semester ? [person.semester] : [])).map(sem => (
          <span key={sem} className="sa-chip">Sem {sem}</span>
        ))}
      </div>
      {person.shift && (
        <div style={{ marginTop: 8 }}>
          <span className="sa-chip sa-chip-muted">
            <Icon name="clock" size={11} style={{ marginRight: 4, verticalAlign: -1.5 }} />
            {formatShift(person.shift)} Shift
          </span>
        </div>
      )}

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          className={person.isActive ? 'sa-btn sa-btn-danger' : 'sa-btn sa-btn-primary'}
          onClick={() => onToggle(person)}
        >
          <Icon name={person.isActive ? 'x-circle' : 'check-circle'} size={14} />
          {person.isActive ? 'Deactivate' : 'Activate'}
        </button>
        <button className="sa-btn sa-btn-danger" onClick={() => onDelete(person)}>
          <Icon name="trash" size={14} /> Delete
        </button>
      </div>

      <style jsx>{`
        .sa-card {
          background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-lg);
          padding: 16px; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
        }
        .sa-card:hover {
          transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.08); border-color: var(--primary);
        }
        .sa-avatar {
          width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0;
          background: linear-gradient(135deg, var(--primary), var(--primary-mid));
          color: #fff; font-weight: 800; font-size: 16px;
          display: flex; align-items: center; justify-content: center;
        }
        .sa-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .sa-dot-on {
          background: #22c55e; box-shadow: 0 0 0 0 rgba(34,197,94,0.5); animation: sa-pulse 2s infinite;
        }
        .sa-dot-off { background: var(--txt3); }
        @keyframes sa-pulse {
          0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.45); }
          70% { box-shadow: 0 0 0 6px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
        .sa-chip {
          font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px;
          background: var(--bg3); color: var(--txt2); white-space: nowrap;
        }
        .sa-chip-primary { background: var(--primary-light); color: var(--primary); }
        .sa-chip-muted { background: transparent; border: 1px solid var(--border2); color: var(--txt3); }
        .sa-btn {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 8px 0; border-radius: 10px; border: none; cursor: pointer;
          font-family: inherit; font-size: 12.5px; font-weight: 700;
          transition: transform .15s ease, opacity .15s ease;
        }
        .sa-btn:hover { transform: translateY(-1px); opacity: 0.92; }
        .sa-btn-primary { background: var(--primary-light); color: var(--primary); }
        .sa-btn-danger { background: rgba(239,68,68,0.12); color: #ef4444; }
      `}</style>
    </div>
  );
}

export default function SubAdminSemesterAdmins() {
  const [semesterAdmins, setSemesterAdmins] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', semester: '' });

  const load = () => {
    setLoading(true);
    api.get('/subAdmin/semester-admins')
      .then(r => {
        setSemesterAdmins(r.data.semesterAdmins || []);
        setPendingInvites(r.data.pendingInvites || []);
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  const openCreate = () => { setForm({ name: '', email: '', semester: '' }); setShowModal(true); };

  const handleSubmit = async () => {
    if (!form.email || !form.semester) return toast.error('Enter Email and Semester');
    setSaving(true);
    try {
      // MULTI-SEMESTER ADMIN: if `email` already belongs to a Semester
      // Admin in your own scope, the backend just adds this Semester to
      // their existing account instead of sending a new invite — Name
      // isn't required in that case (only for a genuinely new person).
      const res = await api.post('/subAdmin/semester-admins', form);
      toast.success(res.data.message);
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (person) => {
    try {
      await api.put(`/users/${person._id}`, { isActive: !person.isActive });
      toast.success(person.isActive ? 'Deactivated' : 'Activated');
      load();
    } catch { toast.error('Error'); }
  };

  // Pending invite hasn't become a real account yet — a lightweight confirm
  // is enough (no typed-name step, unlike deleting an active Semester Admin).
  const cancelInvite = async (invite) => {
    if (!window.confirm(`Cancel invite for ${invite.name}? This email's code will stop working.`)) return;
    setCancellingId(invite._id);
    try {
      await api.delete(`/subAdmin/semester-admins/${invite._id}`);
      toast.success('Invite cancelled');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    } finally {
      setCancellingId(null);
    }
  };

  const filtered = semesterAdmins.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase())
  );

  const takenSemesters = new Set([
    ...semesterAdmins.filter(s => s.isActive).flatMap(s => (s.semesters && s.semesters.length ? s.semesters : (s.semester ? [s.semester] : []))),
    ...pendingInvites.map(i => i.semester),
  ]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title">Semester Admin</h2>
          <p className="page-sub">Create a new Semester Admin, or grant an existing one another Semester in your Department and Shift</p>
        </div>
        <button className="btn-primary" style={{ width: 'auto', padding: '9px 18px' }} onClick={openCreate}>
          <Icon name="plus" size={16} /> New Semester Admin
        </button>
      </div>

      <div style={{ marginBottom: 16, position: 'relative', maxWidth: 320 }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--txt3)' }}>
          <Icon name="search" size={14} />
        </span>
        <input
          className="form-input" style={{ paddingLeft: 34, fontSize: 13 }}
          placeholder="Search by name or Email" value={search} onChange={e => setSearch(e.target.value)}
        />
      </div>

      {pendingInvites.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="section-title" style={{ marginBottom: 8 }}>Pending Invite ({pendingInvites.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {pendingInvites.map(inv => (
              <div key={inv._id} style={{
                background: 'var(--bg)', border: '1px dashed var(--border2)',
                borderRadius: 'var(--radius-lg)', padding: '12px 14px',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{inv.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--txt2)' }}>{inv.email}</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  <span className="tag tag-amber" style={{ fontSize: 10 }}>Registration Pending</span>
                  <span style={{ fontSize: 10.5, color: 'var(--txt2)', background: 'var(--bg3)', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                    Sem {inv.semester}
                  </span>
                </div>
                <button
                  onClick={() => cancelInvite(inv)}
                  disabled={cancellingId === inv._id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '7px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                    border: '1px solid var(--border2)', background: 'transparent', color: 'var(--txt2)',
                    cursor: cancellingId === inv._id ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    marginTop: 4, opacity: cancellingId === inv._id ? 0.6 : 1,
                  }}
                  onMouseEnter={e => { if (cancellingId !== inv._id) { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; } }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--txt2)'; }}
                >
                  <Icon name="x" size={13} /> {cancellingId === inv._id ? 'Cancelling...' : 'Cancel Invite'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="section-title" style={{ marginBottom: 8 }}>Active Semester Admins ({filtered.length})</div>
      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon"><Icon name="users" size={24} /></div>
            <p>No Semester Admins yet</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {filtered.map(s => (
            <SemesterAdminCard key={s._id} person={s} onToggle={toggleActive} onDelete={setDeleteTarget} />
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <div className="modal-title">Invite New Semester Admin</div>

        <div className="form-group">
          <label className="form-label">Semester Admin Name</label>
          <input className="form-input" placeholder="Full Name" value={form.name} onChange={set('name')} />
          <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 4 }}>
            Only needed for a brand-new person. If this Email already belongs to an existing Semester Admin, the selected Semester is just added to their account — Name is ignored.
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Email *</label>
          <input className="form-input" type="email" placeholder="email@example.com" value={form.email} onChange={set('email')} />
        </div>
        <div className="form-group">
          <label className="form-label">Semester *</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {SEMESTERS.map(num => {
              const selected = String(form.semester) === String(num);
              const taken = takenSemesters.has(num);
              return (
                <button
                  key={num} type="button" disabled={taken}
                  onClick={() => setForm(p => ({ ...p, semester: num }))}
                  title={taken ? 'Already assigned' : ''}
                  style={{
                    padding: '10px 0', borderRadius: 10, textAlign: 'center',
                    border: selected ? '2px solid var(--primary)' : '2px solid var(--border2)',
                    background: taken ? 'var(--bg3)' : selected ? 'var(--primary-light)' : 'var(--bg)',
                    color: taken ? 'var(--txt3)' : selected ? 'var(--primary)' : 'var(--txt)',
                    cursor: taken ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    fontSize: 13.5, fontWeight: 700, opacity: taken ? 0.55 : 1,
                  }}
                >
                  {num}
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
          await api.delete(`/users/${deleteTarget._id}`, { data: { confirmName } });
          toast.success(`${deleteTarget.name} has been deleted`);
          load();
        }}
      />
    </div>
  );
}