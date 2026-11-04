'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/utils/api';
import { useAuth } from '@/context/AuthContext';
import NoticeModal from '@/components/common/NoticeModal';
import { AUDIENCE_LABEL, AUDIENCE_STYLE, noticesPath } from '@/components/common/noticeMeta';

// Compact preview used on every dashboard. `bare` drops the outer card (for use
// inside another panel) and shows an empty-state message instead of nothing.
export default function NoticeBoard({ bare = false }) {
  const { user } = useAuth();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    api.get('/notices')
      .then(res => alive && setNotices(res.data.notices || []))
      .catch(() => alive && setNotices([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [user]);

  if (loading) return null;
  if (notices.length === 0) {
    return bare ? <div className="text-sm text-slate-400 py-4 text-center">কোনো নোটিস নেই।</div> : null;
  }

  const list = (
    <div className="space-y-2">
      {notices.map(n => (
        <div
          key={n.id}
          role="button"
          tabIndex={0}
          onClick={() => setActive(n)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActive(n)}
          className="bg-white p-3 rounded-lg border border-slate-200 flex gap-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition"
        >
          {n.imageUrl && (
            <img src={n.imageUrl} alt="" className="w-14 h-14 object-cover rounded-md border border-slate-200 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-semibold text-slate-800">{n.title}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${AUDIENCE_STYLE[n.audience] || AUDIENCE_STYLE.ALL}`}>
                {AUDIENCE_LABEL[n.audience] || n.audience}
              </span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed line-clamp-2 whitespace-pre-line">{n.content}</p>
            <div className="mt-1 text-[11px] text-slate-400">
              {n.createdBy?.name || 'অজানা'} • {new Date(n.createdAt).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const modal = <NoticeModal notice={active} onClose={() => setActive(null)} />;

  if (bare) return <>{list}{modal}</>;

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">গুরুত্বপূর্ণ নোটিস</h3>
        <Link href={noticesPath(user?.role)} className="text-xs font-semibold text-blue-600 hover:underline">সব দেখুন</Link>
      </div>
      {list}
      {modal}
    </div>
  );
}
