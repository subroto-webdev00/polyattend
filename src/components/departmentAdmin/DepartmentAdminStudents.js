'use client';
import React, { useState, useEffect, useRef } from 'react';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import toast from 'react-hot-toast';
import Modal from '@/components/common/Modal';
import ConfirmDeleteModal from '@/components/common/ConfirmDeleteModal';

// Every Semester a diploma programme runs. A Department Admin is department-wide
// and manages all of them, so this is the full list rather than whatever the
// account happens to hold.
const ALL_SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

// The four teaching Groups of a Section. Mirrors the server's own GROUPS
// check in /api/departmentAdmin/students, so a Group that can never be stored
// never appears as a filter here either.
const GROUPS = ['A', 'B', 'C', 'D'];

// `section` is a Prisma enum (Section = A|B|C|D), so the only value that can
// fall outside GROUPS is null — an unassigned student. Normalising still guards
// against whitespace/casing in anything that ever bypasses the enum.
const normalizeGroup = section => {
  const g = String(section || '').trim().toUpperCase();
  return GROUPS.find(x => g === x || g.startsWith(x)) || '';
};

// A distinct colour per Group so the badge is recognisable at a glance while
// scrolling, rather than four identical lettered squares.
const GROUP_ACCENT = {
  A: { bg: '#dbeafe', fg: '#1d4ed8' },
  B: { bg: '#ede9fe', fg: '#6d28d9' },
  C: { bg: '#d1fae5', fg: '#047857' },
  D: { bg: '#fef3c7', fg: '#b45309' },
  unassigned: { bg: '#f1f5f9', fg: '#64748b' },
};

export default function DepartmentAdminStudents() {
  // Student Validation is kept SEPARATE per Semester — never a merged list.
  // A Department Admin is department-wide, so all eight Semesters are offered
  // and the tabs pick which one they're viewing/adding to. This used to be
  // limited to `user.semesters`, the per-account grant left over from the
  // removed role split, which is why only four tabs ever appeared.
  const allowedSemesters = ALL_SEMESTERS;
  const [selectedSemester, setSelectedSemester] = useState(ALL_SEMESTERS[0]);
  useEffect(() => {
    if (selectedSemester == null) setSelectedSemester(ALL_SEMESTERS[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | pending | used
  // Which Group's students are on screen. 'all' shows every Group under its
  // own heading instead of one merged list, because a Section's roll numbers
  // only mean anything relative to the Group they belong to.
  const [groupFilter, setGroupFilter] = useState('all');
  // Group headings start open; a Collapse toggle remembers per Group.
  const [collapsed, setCollapsed] = useState({});
  const [form, setForm] = useState({ name: '', roll: '', email: '', section: '' });
  const [uploadResult, setUploadResult] = useState(null);
  const fileInputRef = useRef(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // a `used` entry, needs typed-name confirm

  const load = () => {
    if (selectedSemester == null) return;
    setLoading(true);
    api.get('/departmentAdmin/students', { params: { semester: selectedSemester } })
      .then(r => setEntries(r.data.entries || []))
      .finally(() => setLoading(false));
  };
  useEffect(load, [selectedSemester]);

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  // Pre-selects the Group currently being viewed. Adding a student while looking
  // at Group B should not make you re-pick B from a form that also asks for
  // everything you already know.
  const openCreate = () => {
    const preset = groupFilter === 'all' ? '' : groupFilter;
    setForm({ name: '', roll: '', email: '', section: preset });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.roll || !form.email || !form.section) return toast.error('Enter Name, Roll, Email and Group');
    setSaving(true);
    try {
      await api.post('/departmentAdmin/students', { ...form, semester: selectedSemester }, { params: { semester: selectedSemester } });
      toast.success('Student pre-approved — code sent to their email');
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('semester', String(selectedSemester));
      // IMPORTANT: don't set Content-Type manually here — axios/the browser
      // needs to generate the multipart boundary itself.
      const res = await api.post('/departmentAdmin/students', formData, { params: { semester: selectedSemester } });
      const data = res.data || {};
      const added = data.added || (data.results || []).filter(r => r.ok);
      const skipped = data.skipped || (data.results || []).filter(r => !r.ok);
      setUploadResult({ ...data, added, skipped });
      if (added.length) toast.success(data.message || `${added.length} student(s) added`);
      else toast.error(data.message || 'No students were added — check skipped rows');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Status + search only. Group is applied separately below so the Group chip
// counts describe what a click would actually reveal rather than collapsing
// to zero once a Group is already selected.
  const searched = entries.filter(en => {
    if (statusFilter === 'pending' && en.used) return false;
    if (statusFilter === 'used' && !en.used) return false;
    if (search && !en.roll.toLowerCase().includes(search.toLowerCase()) && !en.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const pendingCount = entries.filter(en => !en.used).length;
  const usedCount = entries.filter(en => en.used).length;

  // One bucket per Group that actually has students, in A→D order, plus an
  // "Unassigned" bucket last for anything the server let through without a
  // usable Group letter.
  const groupBuckets = GROUPS
    .map(g => ({
      key: g,
      label: `Group ${g}`,
      items: searched.filter(en => normalizeGroup(en.section) === g),
    }))
    .filter(b => b.items.length > 0);

  const unassigned = searched.filter(en => !normalizeGroup(en.section));
  if (unassigned.length) {
    groupBuckets.push({ key: 'unassigned', label: 'Unassigned', items: unassigned });
  }

  const visibleBuckets = groupFilter === 'all'
    ? groupBuckets
    : groupBuckets.filter(b => b.key === groupFilter);

  // Counts shown on the chips: taken from `searched` so they stay put when a
  // Group is selected, and add up to what a user can actually see.
  const groupCounts = Object.fromEntries(GROUPS.map(g => [g, 0]));
  for (const en of searched) {
    const g = normalizeGroup(en.section);
    if (g) groupCounts[g] += 1;
  }
  const unassignedCount = unassigned.length;

  // Not yet registered — nothing real to lose beyond the pre-approval
  // entry itself, so a lightweight confirm is enough (no typed-name step).
  const handleDeletePending = async (entry) => {
    if (!window.confirm(`Delete pre-approval entry for Roll ${entry.roll}?`)) return;
    try {
      await api.delete(`/departmentAdmin/students/${entry._id}`);
      toast.success('Deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div className="skeleton" style={{ width: 180, height: 22, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: 320, height: 13 }} />
          </div>
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 56, borderRadius: 12, marginBottom: 8 }} />
        ))}
        <style jsx>{`
          .skeleton {
            background: linear-gradient(90deg, var(--bg3) 25%, var(--border) 50%, var(--bg3) 75%);
            background-size: 200% 100%;
            animation: shimmer 1.4s ease-in-out infinite;
          }
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="page fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title">Student Validation</h2>
          <p className="page-sub">Pre-approve Roll + Email in advance — registration is allowed only once with the same Roll/Email</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary btn-anim" style={{ width: 'auto', padding: '9px 18px' }} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <><div className="spinner spinner-sm" /> Uploading...</> : <><Icon name="excel" size={16} /> Excel Upload</>}
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFileUpload} />
          <button className="btn-primary btn-anim" style={{ width: 'auto', padding: '9px 18px' }} onClick={openCreate}>
            <Icon name="plus" size={16} /> Add One
          </button>
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: 16, background: 'var(--bg3)', padding: '10px 14px', borderRadius: 10 }}>
        📄 The Excel/CSV file must have <strong>Name</strong>, <strong>Roll</strong>, <strong>Email</strong> and <strong>Group</strong> — these four columns (as headers in the first row, Group as A/B/C/D). Each Student's email will get a separate 12-digit code.
      </div>

      {/* DEPARTMENT-WIDE ADMIN: Student Validation stays strictly separate
          per Semester — this tab bar only appears once this admin has
          more than one granted Semester; switching tabs reloads the list
          scoped to that Semester only. */}
      {allowedSemesters.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {allowedSemesters.map(sem => (
            <button
              key={sem}
              onClick={() => setSelectedSemester(sem)}
              style={{
                padding: '7px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                background: selectedSemester === sem ? 'var(--primary)' : 'var(--bg3)',
                color: selectedSemester === sem ? '#fff' : 'var(--txt2)',
                transition: 'all .18s ease',
              }}
            >
              Semester {sem}
            </button>
          ))}
        </div>
      )}

      {uploading && (
        <div className="progress-track" style={{ marginBottom: 16 }}>
          <div className="progress-fill" />
        </div>
      )}

      {uploadResult && (
        <div className="card slide-in" style={{ marginBottom: 16, background: 'var(--primary-light)', border: '1px solid var(--primary)' }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--primary)', marginBottom: 6 }}>
            ✅ {uploadResult.added?.length || 0} added
            {uploadResult.skipped?.length > 0 && `, ${uploadResult.skipped.length} rows skipped`}
          </div>
          {uploadResult.skipped?.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--txt2)' }}>
              {uploadResult.skipped.slice(0, 10).map((s, i) => (
                <div key={i} style={{ animation: `fadeInUp .3s ease ${i * 0.03}s both` }}>Row {s.row}: {s.roll || '-'} / {s.email || '-'} — {s.reason}</div>
              ))}
              {uploadResult.skipped.length > 10 && <div>... {uploadResult.skipped.length - 10} more</div>}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, background: 'var(--bg3)', padding: 4, borderRadius: 24 }}>
          {[
            { key: 'all', label: `All (${entries.length})` },
            { key: 'pending', label: `Registration Pending (${pendingCount})` },
            { key: 'used', label: `Completed (${usedCount})` },
          ].map(f => (
            <button
              key={f.key} onClick={() => setStatusFilter(f.key)}
              className="filter-btn"
              style={{
                padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                background: statusFilter === f.key ? 'var(--primary)' : 'transparent',
                color: statusFilter === f.key ? '#fff' : 'var(--txt2)',
                boxShadow: statusFilter === f.key ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                transition: 'all .25s ease',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--txt3)' }}>
            <Icon name="search" size={14} />
          </span>
          <input
            className="form-input search-anim" style={{ paddingLeft: 34, fontSize: 13, width: 200 }}
            placeholder="Search by Roll or Email" value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* GROUP FILTER — a Section's roll numbers only mean something relative
          to their Group, so this sits directly under the status filter. */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt3)', marginRight: 2 }}>Group</span>
        {[
          { key: 'all', label: `All Groups (${searched.length})` },
          ...GROUPS.map(g => ({ key: g, label: `${g} (${groupCounts[g]})` })),
          ...(unassignedCount ? [{ key: 'unassigned', label: `Unassigned (${unassignedCount})` }] : []),
        ].map(f => {
          const active = groupFilter === f.key;
          // A chip with nothing behind it stays visible but disabled, so the
          // layout does not jump around as students are added.
          const empty = f.key !== 'all' && (f.key === 'unassigned' ? !unassignedCount : groupCounts[f.key] === 0);
          return (
            <button
              key={f.key}
              onClick={() => setGroupFilter(f.key)}
              disabled={empty}
              className="group-chip"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 999, cursor: empty ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                border: `1px solid ${active ? 'var(--primary)' : 'var(--border2)'}`,
                background: active ? 'var(--primary)' : 'var(--bg)',
                color: active ? '#fff' : empty ? 'var(--txt3)' : 'var(--txt2)',
                opacity: empty ? 0.5 : 1,
                transition: 'all .18s ease',
              }}
            >
              {f.key !== 'all' && f.key !== 'unassigned' && (
                <span style={{
                  width: 16, height: 16, borderRadius: 5, display: 'grid', placeItems: 'center',
                  fontSize: 10, fontWeight: 800,
                  background: active ? 'rgba(255,255,255,.22)' : 'var(--primary-light)',
                  color: active ? '#fff' : 'var(--primary)',
                }}>
                  {f.key}
                </span>
              )}
              {f.label}
            </button>
          );
        })}
      </div>

      {visibleBuckets.length === 0 ? (
        <div className="card fade-in">
          <div className="empty">
            <div className="empty-icon"><Icon name="clipboard" size={24} /></div>
            <p>No data yet</p>
            <p style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 4 }}>
              {entries.length === 0
                ? `No students pre-approved for Semester ${selectedSemester} yet.`
                : groupFilter !== 'all'
                  ? `No students in ${groupFilter === 'unassigned' ? 'Unassigned' : `Group ${groupFilter}`} match the current filter.`
                  : 'No students match the current filter.'}
            </p>
            {groupFilter !== 'all' && (
              <button
                onClick={() => setGroupFilter('all')}
                style={{
                  marginTop: 10, padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                  border: '1px solid var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)',
                }}
              >
                Show all groups
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {visibleBuckets.map(bucket => {
            const isOpen = !collapsed[bucket.key];
            const bucketPending = bucket.items.filter(en => !en.used).length;
            const bucketDone = bucket.items.length - bucketPending;
            const accent = GROUP_ACCENT[bucket.key] || GROUP_ACCENT.unassigned;
            return (
              <section
                key={bucket.key}
                className="group-block"
                style={{
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                }}
              >
                <button
                  onClick={() => setCollapsed(p => ({ ...p, [bucket.key]: isOpen }))}
                  aria-expanded={isOpen}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '11px 14px', border: 'none', cursor: 'pointer',
                    background: 'transparent', fontFamily: 'inherit', textAlign: 'left',
                  }}
                >
                  <span style={{
                    width: 28, height: 28, borderRadius: 9, flexShrink: 0,
                    display: 'grid', placeItems: 'center',
                    fontSize: 13, fontWeight: 800,
                    background: accent.bg, color: accent.fg,
                  }}>
                    {bucket.key === 'unassigned' ? '?' : bucket.key}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 800, fontSize: 13.5, color: 'var(--txt)' }}>
                      {bucket.label}
                      <span style={{ fontWeight: 600, color: 'var(--txt3)', marginLeft: 6, fontSize: 12 }}>
                        Semester {selectedSemester}
                      </span>
                    </span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>
                      {bucketPending > 0 && <>{bucketPending} pending</>}
                      {bucketPending > 0 && bucketDone > 0 && ' • '}
                      {bucketDone > 0 && <>{bucketDone} completed</>}
                    </span>
                  </span>
                  <span style={{
                    fontSize: 12, fontWeight: 800, color: 'var(--txt2)',
                    background: 'var(--bg3)', borderRadius: 999, padding: '3px 10px', flexShrink: 0,
                  }}>
                    {bucket.items.length}
                  </span>
                  <span style={{
                    color: 'var(--txt3)', display: 'grid', placeItems: 'center', flexShrink: 0,
                    transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .2s ease',
                  }}>
                    <Icon name="chevronDown" size={15} />
                  </span>
                </button>

                {isOpen && (
                  <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {bucket.items.map((en, i) => (
                      <div
                        key={en._id}
                        className="student-row"
                        style={{
                          background: 'var(--bg3)', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md, 10px)',
                          padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                          animation: `fadeInUp .35s ease ${Math.min(i * 0.03, 0.5)}s both`,
                        }}
                      >
                        <span className={en.used ? 'dot-used' : 'dot-pending'} style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 160 }}>
                          <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                            {en.name ? en.name : `Roll: ${en.roll}`}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--txt2)', wordBreak: 'break-word' }}>
                            {en.name ? `Roll: ${en.roll} • ` : ''}{en.email}
                          </div>
                        </div>
                        <span className={`tag ${en.used ? 'tag-green' : 'tag-amber'}`}>
                          {en.used ? 'Registration Complete' : 'Pending'}
                        </span>
                        <button
                          onClick={() => en.used ? setDeleteTarget(en) : handleDeletePending(en)}
                          title="Delete"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            border: '1px solid var(--danger-light)', borderRadius: 8, cursor: 'pointer',
                            padding: '5px 10px', fontSize: 11, fontWeight: 700,
                            fontFamily: 'inherit', background: 'transparent', color: 'var(--danger)',
                          }}
                        >
                          <Icon name="trash" size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <div className="modal-title">Add One Student</div>

        <div className="form-group">
          <label className="form-label">Full Name *</label>
          <input className="form-input" placeholder="Student's full name" value={form.name} onChange={set('name')} />
        </div>
        <div className="form-group">
          <label className="form-label">Roll *</label>
          <input className="form-input" placeholder="e.g. 800768" value={form.roll} onChange={set('roll')} />
        </div>
        <div className="form-group">
          <label className="form-label">Email *</label>
          <input className="form-input" type="email" placeholder="email@example.com" value={form.email} onChange={set('email')} />
        </div>
        <div className="form-group">
          <label className="form-label">Group *</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {['A', 'B', 'C', 'D'].map(g => {
              const selected = form.section === g;
              return (
                <button
                  key={g} type="button"
                  onClick={() => setForm(p => ({ ...p, section: g }))}
                  style={{
                    padding: '10px 0', borderRadius: 10, textAlign: 'center',
                    border: selected ? '2px solid var(--primary)' : '2px solid var(--border2)',
                    background: selected ? 'var(--primary-light)' : 'var(--bg)',
                    color: selected ? 'var(--primary)' : 'var(--txt)',
                    cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
                  }}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 4, marginBottom: 4 }}>
          A Student Profile is created right away with the Name, Roll, Email, Group and Semester you enter. Submitting will send a 12-digit Registration Code to this email (valid for 1 month).
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? <><div className="spinner spinner-sm" /> Sending...</> : 'Add'}
          </button>
        </div>
      </Modal>

      <ConfirmDeleteModal
        target={deleteTarget ? { name: deleteTarget.usedByUserId?.name || deleteTarget.roll } : null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async (confirmName) => {
          await api.delete(`/departmentAdmin/students/${deleteTarget._id}`, { data: { confirmName } });
          toast.success('Deleted');
          load();
        }}
      />

      <style jsx>{`
        .fade-in { animation: fadeIn .3s ease both; }
        .slide-in { animation: fadeInUp .35s ease both; }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .btn-anim { transition: transform .15s ease, box-shadow .15s ease; }
        .btn-anim:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
        .btn-anim:active:not(:disabled) { transform: translateY(0); }

        .student-row { transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
        .student-row:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.06); border-color: var(--primary); }

        .dot-used { background: var(--primary-mid); }
        .dot-pending {
          background: var(--warning, #f59e0b);
          box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.5);
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.5); }
          70% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
          100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }

        .search-anim { transition: box-shadow .2s ease, border-color .2s ease; }
        .search-anim:focus { box-shadow: 0 0 0 3px var(--primary-light); border-color: var(--primary); }

        .filter-btn:hover { opacity: 0.85; }

        .progress-track {
          height: 4px; border-radius: 4px; background: var(--bg3); overflow: hidden;
        }
        .progress-fill {
          height: 100%; width: 40%; border-radius: 4px; background: var(--primary);
          animation: indeterminate 1.2s ease-in-out infinite;
        }
        @keyframes indeterminate {
          0% { margin-left: -40%; }
          100% { margin-left: 100%; }
        }
      `}</style>
    </div>
  );
}