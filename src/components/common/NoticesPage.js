'use client';
import React, { useState, useEffect, useCallback } from 'react';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import { useAuth } from '@/context/AuthContext';
import { AUDIENCE_LABEL, AUDIENCE_STYLE } from '@/components/common/noticeMeta';
import ImageViewer from '@/components/common/ImageViewer';
import { DashboardPage, DashboardLoading, Panel } from '@/components/common/DashboardKit';
import compressImage from '@/utils/compressImage';

const EMPTY_FORM = { id: '', title: '', content: '', audience: 'ALL', departmentId: '', image: null, removeImage: false };
const INPUT = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const LABEL = 'block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1';

// One Notice Board page for every role. Everyone can read the notices meant for
// them; only an admin sees the post / edit / delete controls.
export default function NoticesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [notices, setNotices] = useState([]);
  const [max, setMax] = useState(2);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [viewer, setViewer] = useState(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const res = await api.get('/notices');
      setNotices(res.data.notices || []);
      if (res.data.max) setMax(res.data.max);
    } catch (err) {
      setError(err.response?.data?.message || 'নোটিস লোড করা যায়নি।');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  useEffect(() => {
    if (!isAdmin) return;
    api.get('/departments').then(r => setDepartments(r.data.departments || [])).catch(() => setDepartments([]));
  }, [isAdmin]);

  // Free the object URL created for the image preview.
  useEffect(() => () => { if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);

  const startCreate = () => { setForm(EMPTY_FORM); setPreview(null); setFormError(''); setOpen(true); };
  const startEdit = (n) => {
    setForm({ id: n.id, title: n.title, content: n.content, audience: n.audience, departmentId: n.departmentId || '', image: null, removeImage: false });
    setPreview(n.imageUrl || null);
    setFormError('');
    setOpen(true);
  };
  const close = () => { setOpen(false); setForm(EMPTY_FORM); setPreview(null); setFormError(''); };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) { setFormError('শিরোনাম এবং বিষয়বস্তু দিন।'); return; }
    const fd = new FormData();
    fd.append('title', form.title.trim());
    fd.append('content', form.content.trim());
    fd.append('audience', form.audience);
    if (form.departmentId) fd.append('departmentId', form.departmentId);
    if (form.image) fd.append('image', form.image);
    if (form.removeImage) fd.append('removeImage', 'true');
    if (form.id) fd.append('id', form.id);

    setSaving(true); setFormError('');
    try {
      const res = form.id ? await api.put('/notices', fd) : await api.post('/notices', fd);
      if (res.data.success) {
        if (res.data.warning) alert(res.data.warning);
        close(); await load();
      }
      else setFormError(res.data.message || 'সংরক্ষণ করা যায়নি।');
    } catch (err) {
      setFormError(err.response?.data?.message || 'সার্ভার এরর।');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (n) => {
    if (!window.confirm(`"${n.title}" নোটিসটি ডিলিট করবেন?`)) return;
    try {
      await api.delete(`/notices?id=${n.id}`);
      setNotices(list => list.filter(x => x.id !== n.id));
    } catch (err) {
      alert(err.response?.data?.message || 'ডিলিট করা যায়নি।');
    }
  };

  if (loading) return <DashboardLoading />;

  const atLimit = notices.length >= max;
  const deptName = (id) => departments.find(d => d.id === id)?.name;

  return (
    <DashboardPage>
      <Panel
        title="Notice"
        icon="megaphone"
        subtitle={isAdmin ? `এক সময় সর্বোচ্চ ${max} টি সক্রিয় নোটিস। নতুন পোস্টের আগে পুরনো একটি ডিলিট করুন।` : 'আপনার জন্য প্রযোজ্য নোটিস'}
        action={isAdmin && !open && (
          <button
            type="button"
            onClick={startCreate}
            disabled={atLimit}
            title={atLimit ? 'সীমা পূর্ণ — আগে একটি নোটিস ডিলিট করুন' : ''}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[13px] font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name="plus" size={14} /> Post Notice
          </button>
        )}
      >
        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between gap-3">
            <span>{error}</span>
            <button type="button" onClick={load} className="font-semibold underline">আবার চেষ্টা করুন</button>
          </div>
        )}

        {isAdmin && open && (
          <form onSubmit={submit} className="mb-5 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-slate-800 text-sm">{form.id ? 'নোটিস এডিট' : 'নতুন নোটিস'}</h3>

            <div>
              <label className={LABEL}>Title</label>
              <input className={INPUT} maxLength={150} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="নোটিসের শিরোনাম" />
            </div>
            <div>
              <label className={LABEL}>Content</label>
              <textarea className={INPUT} rows={5} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="বিস্তারিত লিখুন" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>কারা দেখবে</label>
                <select className={INPUT} value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })}>
                  <option value="ALL">সবাই</option>
                  <option value="DEPARTMENT_ADMIN">শুধু ডিপার্টমেন্ট অ্যাডমিন</option>
                  <option value="TEACHER">শুধু শিক্ষক</option>
                  <option value="STUDENT">শুধু শিক্ষার্থী</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Department (ঐচ্ছিক)</label>
                <select className={INPUT} value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })}>
                  <option value="">সব ডিপার্টমেন্ট</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={LABEL}>Image (ঐচ্ছিক, সর্বোচ্চ ৫ MB)</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className={INPUT}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) { setFormError('ছবির সাইজ সর্বোচ্চ ৫ MB।'); e.target.value = ''; return; }
                  setFormError('');
                  const url = URL.createObjectURL(file);
                  setPreview(url);
                  setForm(s => ({ ...s, image: file, removeImage: false }));
                  // Shrink oversized photos in the browser so the upload fits
                  // inside Vercel's 4.5 MB request limit.
                  compressImage(file).then(small => {
                    if (small !== file) setForm(s => ({ ...s, image: small }));
                  });
                }}
              />
              {preview && (
                <div className="mt-2 flex items-start gap-3">
                  <img src={preview} alt="preview" className="h-24 rounded-lg border border-slate-200 object-cover" />
                  <button
                    type="button"
                    className="text-xs font-semibold text-rose-600 hover:underline"
                    onClick={() => { setForm({ ...form, image: null, removeImage: true }); setPreview(null); }}
                  >
                    ছবি সরান
                  </button>
                </div>
              )}
            </div>

            {formError && <div className="text-sm text-rose-600">{formError}</div>}

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                {saving ? 'সংরক্ষণ হচ্ছে…' : form.id ? 'আপডেট করুন' : 'পোস্ট করুন'}
              </button>
              <button type="button" onClick={close} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200">বাতিল</button>
            </div>
          </form>
        )}

        {isAdmin && (
          <div className="mb-3 flex justify-end">
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">{notices.length} / {max}</span>
          </div>
        )}

        {notices.length === 0 ? (
          <div className="bg-slate-50 rounded-xl p-10 text-center text-slate-400 text-sm">কোনো নোটিস নেই।</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {notices.map(n => (
              <article key={n.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                {n.imageUrl && (
                  <button type="button" onClick={() => setViewer({ src: n.imageUrl, alt: n.title })} className="block w-full relative" title="ছবি বড় করে দেখুন">
                    <img src={n.imageUrl} alt="" className="w-full max-h-64 object-cover cursor-zoom-in" />
                    <span className="absolute bottom-2 right-2 text-[11px] font-semibold bg-slate-900/70 text-white px-2 py-1 rounded-md">🔍 Zoom / Download</span>
                  </button>
                )}
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-slate-800 text-[15px] break-words">{n.title}</h3>
                    {isAdmin && (
                      <div className="flex gap-1 shrink-0">
                        <button type="button" onClick={() => startEdit(n)} title="Edit" className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50"><Icon name="edit" size={15} /></button>
                        <button type="button" onClick={() => remove(n)} title="Delete" className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Icon name="trash" size={15} /></button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${AUDIENCE_STYLE[n.audience] || AUDIENCE_STYLE.ALL}`}>{AUDIENCE_LABEL[n.audience] || n.audience}</span>
                    {n.departmentId && deptName(n.departmentId) && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">{deptName(n.departmentId)}</span>
                    )}
                  </div>
                  <p className="mt-3 text-sm text-slate-600 leading-relaxed whitespace-pre-line break-words">{n.content}</p>
                  <div className="mt-auto pt-3 text-[11px] text-slate-400">
                    {n.createdBy?.name || 'অজানা'} • {new Date(n.createdAt).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
      {viewer && <ImageViewer src={viewer.src} alt={viewer.alt} onClose={() => setViewer(null)} />}
    </DashboardPage>
  );
}
