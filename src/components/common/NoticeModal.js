'use client';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import ImageViewer from './ImageViewer';
import { AUDIENCE_LABEL, AUDIENCE_STYLE } from './noticeMeta';

// Shows one notice in full (title, text, picture). Clicking the picture opens
// the zoom / download viewer. Used by the notification bell, the dashboard
// preview and anywhere else a notice can be clicked.
export default function NoticeModal({ notice, onClose }) {
  const [mounted, setMounted] = useState(false);
  const [viewing, setViewing] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!notice) return;
    const onKey = (e) => { if (e.key === 'Escape' && !viewing) onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [notice, viewing, onClose]);

  useEffect(() => { setViewing(false); }, [notice?.id]);

  if (!mounted || !notice) return null;

  return createPortal(
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        onClick={(e) => e.target === e.currentTarget && onClose?.()}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>
          <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-2">
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-base break-words">{notice.title}</h3>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${AUDIENCE_STYLE[notice.audience] || AUDIENCE_STYLE.ALL}`}>
                  {AUDIENCE_LABEL[notice.audience] || notice.audience}
                </span>
                <span className="text-[11px] text-slate-400">
                  {notice.createdBy?.name || 'অজানা'} • {new Date(notice.createdAt).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700 text-2xl leading-none px-1">&times;</button>
          </div>

          <div className="px-5 pb-5 pt-2 overflow-y-auto">
            {notice.imageUrl && (
              <button type="button" onClick={() => setViewing(true)} className="block w-full mb-3 relative group" title="ছবি বড় করে দেখুন">
                <img src={notice.imageUrl} alt="" className="w-full max-h-72 object-cover rounded-xl border border-slate-200" />
                <span className="absolute bottom-2 right-2 text-[11px] font-semibold bg-slate-900/70 text-white px-2 py-1 rounded-md">
                  🔍 Zoom / Download
                </span>
              </button>
            )}
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line break-words">{notice.content}</p>
          </div>
        </div>
      </div>
      {viewing && notice.imageUrl && <ImageViewer src={notice.imageUrl} alt={notice.title} onClose={() => setViewing(false)} />}
    </>,
    document.body
  );
}
