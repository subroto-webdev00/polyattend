'use client';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// BUG FIX: every modal in the app was rendered inline inside
// <main className="shell-content"> (see AppShell.js), which is itself a
// scrollable container. Even though .modal-backdrop uses
// `position: fixed`, browsers can end up positioning a fixed element
// relative to that ancestor's scroll state once it's nested this deep in
// a scrolling context — so whenever the page underneath was scrolled, the
// modal's top (title, first fields) rendered off-screen with a large dead
// gap below, exactly as seen on the Department Admin invite and Student
// Validation forms. Rendering the modal through a portal straight onto
// `document.body` takes it out of that nested scroll context entirely, so
// `position: fixed` always measures against the real viewport — matching
// how every other modal-backdrop usage in the app is expected to behave.
//
// Usage (drop-in replacement for the old inline markup):
//   <Modal open={showModal} onClose={() => setShowModal(false)}>
//     <div className="modal-title">...</div>
//     ...fields...
//     <div className="modal-footer">...buttons...</div>
//   </Modal>
export default function Modal({ open, onClose, children, sheetStyle }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="modal-sheet" style={sheetStyle}>
        <div className="modal-handle" />
        {children}
      </div>
    </div>,
    document.body
  );
}
