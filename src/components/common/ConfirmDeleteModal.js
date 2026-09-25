'use client';
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import toast from 'react-hot-toast';

// Shared "type the name to confirm" delete flow — used everywhere a
// PersonCard shows a Delete action (Department Admin, Semester Admin, Teacher,
// Student lists). Deletion is permanent, so this is the one safeguard
// standing between a misclick and losing the record for good.
//
// Usage:
//   const [deleteTarget, setDeleteTarget] = useState(null);
//   ...
//   <PersonCard actions={[{ label: 'Delete', variant: 'danger', onClick: () => setDeleteTarget(person) }]} />
//   <ConfirmDeleteModal
//     target={deleteTarget}
//     onClose={() => setDeleteTarget(null)}
//     onConfirm={async () => { await api.delete(`/users/${deleteTarget._id}`, { data: { confirmName: deleteTarget.name } }); load(); }}
//   />
export default function ConfirmDeleteModal({ target, onClose, onConfirm }) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { setConfirmText(''); }, [target]);

  const handleConfirm = async () => {
    if (confirmText.trim() !== (target?.name || '').trim()) {
      toast.error('Name does not match — type the exact name');
      return;
    }
    setDeleting(true);
    try {
      await onConfirm(confirmText.trim());
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal open={!!target} onClose={onClose}>
      <div className="modal-title" style={{ color: 'var(--danger)' }}>Permanently Delete</div>
      <p style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 4 }}>
        This action <strong>cannot be undone</strong>. Deleting <strong>{target?.name}</strong> will also remove related attendance, sessions, invites, and account history. To confirm, type their name exactly below:
      </p>
      <div className="form-group">
        <input
          className="form-input"
          placeholder={target?.name || ''}
          value={confirmText}
          onChange={e => setConfirmText(e.target.value)}
          autoFocus
        />
      </div>
      <div className="modal-footer">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button
          className="btn-primary"
          style={{ background: 'var(--danger)' }}
          onClick={handleConfirm}
          disabled={deleting || confirmText.trim() !== (target?.name || '').trim()}
        >
          {deleting ? <><div className="spinner spinner-sm" /> Deleting...</> : 'Permanently Delete'}
        </button>
      </div>
    </Modal>
  );
}
