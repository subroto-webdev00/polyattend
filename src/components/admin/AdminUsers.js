'use client';
import React, { useState, useEffect, useMemo } from 'react';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import toast from 'react-hot-toast';
import Modal from '@/components/common/Modal';
import { useAuth } from '@/context/AuthContext';
import { formatDepartment, formatShift } from '@/lib/display';

// ─── Role config ────────────────────────────────────────────────
const ROLE_META = {
  admin: { label: 'Admin', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.14)', dot: '#60a5fa' },
  semesterAdmin: { label: 'Semester Admin', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.14)', dot: '#38bdf8' },
  teacher: { label: 'Teacher', color: '#34d399', bg: 'rgba(52, 211, 153, 0.14)', dot: '#34d399' },
  student: { label: 'Student', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.14)', dot: '#fbbf24' },
};

function initials(name) {
  return (name || '').trim().split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function roleLabel(role) {
  return ROLE_META[role]?.label || (role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Unknown');
}

function subInfo(u) {
  const dept = formatDepartment(u.departmentId, u.departmentCode) || null;
  const shift = formatShift(u.shift) ? `${formatShift(u.shift)} Shift` : null;
  if (u.role === 'student') {
    const parts = [
      dept && `${dept}`,
      u.semester && `Sem ${u.semester}`,
      u.section && `Group ${u.section}`,
      shift,
    ].filter(Boolean);
    return parts.join(' · ');
  }
  if (u.role === 'teacher') {
    const parts = [u.subjectId?.name || null, dept, shift].filter(Boolean);
    return parts.join(' · ');
  }
  return [dept, shift].filter(Boolean).join(' · ');
}

// ─── UserCard ───────────────────────────────────────────────────
function UserCard({ user, onToggle, onDelete, isSelf, idx }) {
  const meta = ROLE_META[user.role] || { label: user.role, color: '#94a3b8', bg: 'var(--bg3)', dot: '#94a3b8' };
  const info = subInfo(user);
  const [hov, setHov] = useState(false);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--bg)',
        borderTop: `1px solid ${hov ? meta.color + '55' : 'var(--border)'}`,
        borderRight: `1px solid ${hov ? meta.color + '55' : 'var(--border)'}`,
        borderBottom: `1px solid ${hov ? meta.color + '55' : 'var(--border)'}`,
        borderLeft: `3px solid ${meta.color}`,
        borderRadius: 14,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'all 0.18s ease',
        boxShadow: hov
          ? `0 6px 24px ${meta.color}18, 0 2px 8px rgba(0,0,0,0.25)`
          : 'var(--shadow)',
        transform: hov ? 'translateY(-2px)' : 'none',
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Avatar */}
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`,
          color: '#fff', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 14, fontWeight: 800,
          letterSpacing: '0.02em',
          boxShadow: `0 3px 10px ${meta.color}40`,
        }}>
          {initials(user.name)}
        </div>

        {/* Name / email */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 700, fontSize: 13.5, color: 'var(--txt)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {user.name}
            {isSelf && (
              <span style={{
                marginLeft: 6, fontSize: 9, fontWeight: 700,
                background: 'rgba(96, 165, 250, 0.18)', color: '#60a5fa',
                padding: '1px 6px', borderRadius: 20, letterSpacing: '0.04em',
              }}>
                YOU
              </span>
            )}
          </div>
          <div style={{
            fontSize: 11.5, color: 'var(--txt2)', marginTop: 1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {user.email}
          </div>
        </div>

        {/* Active dot */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <span style={{
            width: 9, height: 9, borderRadius: '50%',
            background: user.isActive ? '#34d399' : '#f87171',
            boxShadow: user.isActive ? '0 0 0 3px rgba(52, 211, 153, 0.18)' : '0 0 0 3px rgba(248, 113, 113, 0.18)',
            display: 'block',
          }} />
        </div>
      </div>

      {/* Chips row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
        {/* Role badge */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: meta.bg, color: meta.color,
          fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
          border: `1px solid ${meta.color}30`,
          letterSpacing: '0.02em',
        }}>
          {meta.label}
        </span>

        {/* Info chips */}
        {info && info.split(' · ').map((chunk, i) => (
          <span key={i} style={{
            display: 'inline-flex', alignItems: 'center',
            background: 'var(--bg3)', color: 'var(--txt2)',
            fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
          }}>
            {chunk}
          </span>
        ))}

        {user.studentId && (
          <span style={{
            background: 'var(--bg3)', color: 'var(--txt2)',
            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
            fontFamily: 'monospace',
          }}>
            #{user.studentId}
          </span>
        )}
      </div>

      {/* Action row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{
          fontSize: 10.5, fontWeight: 600,
          color: user.isActive ? '#34d399' : '#f87171',
        }}>
          {user.isActive ? '● Active' : '○ Inactive'}
        </span>

        <button
          onClick={() => onToggle(user)}
          disabled={isSelf}
          title={isSelf ? "Cannot change your own status" : (user.isActive ? 'Deactivate' : 'Activate')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            border: 'none', borderRadius: 8, cursor: isSelf ? 'not-allowed' : 'pointer',
            padding: '5px 12px', fontSize: 11, fontWeight: 700,
            fontFamily: 'inherit', transition: 'all 0.15s',
            opacity: isSelf ? 0.4 : 1,
            background: user.isActive ? 'rgba(248, 113, 113, 0.16)' : 'rgba(52, 211, 153, 0.16)',
            color: user.isActive ? '#f87171' : '#34d399',
          }}
        >
          <Icon name={user.isActive ? 'x' : 'check'} size={11} />
          {user.isActive ? 'Deactivate' : 'Activate'}
        </button>
      </div>
      {!isSelf && (
        <button
          onClick={() => onDelete(user)}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            border: '1px solid rgba(248, 113, 113, 0.35)', borderRadius: 8, cursor: 'pointer',
            padding: '5px 12px', fontSize: 11, fontWeight: 700,
            fontFamily: 'inherit', transition: 'all 0.15s',
            background: 'transparent', color: '#f87171', width: '100%', marginTop: 4,
          }}
        >
          <Icon name="trash" size={11} /> Delete
        </button>
      )}
    </div>
  );
}

// ─── Table Row ──────────────────────────────────────────────────
function TableRow({ user, rowNum, onToggle, onDelete, isSelf }) {
  const meta = ROLE_META[user.role] || { label: user.role, color: '#94a3b8', bg: 'var(--bg3)' };
  return (
    <tr style={{ transition: 'background 0.12s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
      onMouseLeave={e => e.currentTarget.style.background = ''}
    >
      <td style={{ color: 'var(--txt3)', fontSize: 12, width: 40, paddingLeft: 16 }}>{rowNum}</td>
      <td style={{ paddingLeft: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: `linear-gradient(135deg, ${meta.color}, ${meta.color}bb)`,
            color: '#fff', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 12, fontWeight: 800,
            boxShadow: `0 2px 6px ${meta.color}35`,
          }}>
            {initials(user.name)}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>
              {user.name}
              {isSelf && (
                <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, background: 'rgba(96, 165, 250, 0.18)', color: '#60a5fa', padding: '1px 5px', borderRadius: 20 }}>YOU</span>
              )}
            </div>
            {user.studentId && (
              <div style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--txt3)' }}>#{user.studentId}</div>
            )}
          </div>
        </div>
      </td>
      <td style={{ fontSize: 12, color: 'var(--txt2)' }}>{user.email}</td>
      <td>
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          background: meta.bg, color: meta.color,
          fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
          border: `1px solid ${meta.color}25`,
        }}>
          {meta.label}
        </span>
      </td>
      <td style={{ fontSize: 12, color: 'var(--txt2)' }}>
        {user.role === 'student'
          ? `${formatDepartment(user.departmentId, user.departmentCode) || '—'} · Sem ${user.semester || '?'} · Grp ${user.section || '?'}`
          : formatDepartment(user.departmentId, user.departmentCode) || '—'}
      </td>
      <td>
        {user.shift
          ? <span style={{ fontSize: 11, fontWeight: 600, color: '#a78bfa', background: 'rgba(167, 139, 250, 0.16)', padding: '2px 9px', borderRadius: 20 }}>
            {formatShift(user.shift)}
          </span>
          : <span style={{ color: 'var(--txt3)' }}>—</span>}
      </td>
      <td>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 11, fontWeight: 700,
          color: user.isActive ? '#34d399' : '#f87171',
          background: user.isActive ? 'rgba(52, 211, 153, 0.16)' : 'rgba(248, 113, 113, 0.16)',
          padding: '3px 10px', borderRadius: 20,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
          {user.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td>
        <button
          onClick={() => onToggle(user)}
          disabled={isSelf}
          title={isSelf ? 'Cannot change your own status' : (user.isActive ? 'Deactivate' : 'Activate')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            border: 'none', borderRadius: 8, cursor: isSelf ? 'not-allowed' : 'pointer',
            padding: '5px 10px', fontSize: 11, fontWeight: 700,
            fontFamily: 'inherit', transition: 'all 0.15s', opacity: isSelf ? 0.4 : 1,
            background: user.isActive ? 'rgba(248, 113, 113, 0.16)' : 'rgba(52, 211, 153, 0.16)',
            color: user.isActive ? '#f87171' : '#34d399',
          }}
        >
          <Icon name={user.isActive ? 'x' : 'check'} size={11} />
          {user.isActive ? 'Deactivate' : 'Activate'}
        </button>
      </td>
      <td>
        {!isSelf && (
          <button
            onClick={() => onDelete(user)}
            title="Delete permanently"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              border: '1px solid rgba(248, 113, 113, 0.35)', borderRadius: 8, cursor: 'pointer',
              padding: '5px 10px', fontSize: 11, fontWeight: 700,
              fontFamily: 'inherit', transition: 'all 0.15s',
              background: 'transparent', color: '#f87171',
            }}
          >
            <Icon name="trash" size={11} />
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Main Component ─────────────────────────────────────────────
export default function AdminUsers({
  roleFilters = ['all', 'teacher', 'allAdmins'],
  title = 'Users Management',
  subtitle = 'Manage all system users',
}) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [roleCounts, setRoleCounts] = useState({});
  const allAdminsCount = (roleCounts.admin || 0) + (roleCounts.semesterAdmin || 0);
  const [countLoading, setCountLoading] = useState(true);
  const PAGE_SIZE = 50;

  const groupedUsers = useMemo(() => {
    // The All Admins view is already a role-specific list. Keep all three
    // admin roles together instead of placing a malformed admin with a
    // section into a student "Group" heading.
    if (roleFilter === 'allAdmins') {
      return users.length ? [{ label: 'Admins', items: users }] : [];
    }

    const withSection = {};
    const noSection = [];
    users.forEach(u => {
      if (u.role === 'student' && u.section) {
        if (!withSection[u.section]) withSection[u.section] = [];
        withSection[u.section].push(u);
      } else {
        noSection.push(u);
      }
    });
    const groups = Object.keys(withSection).sort().map(key => ({
      label: `Group ${key}`, items: withSection[key],
    }));
    if (noSection.length) groups.push({ label: 'Teachers & Admins', items: noSection });
    return groups;
  }, [users, roleFilter]);

  const load = (pageToLoad = page) => {
    if (roleFilter === 'all') return; // summary view — no list needed
    setLoading(true);
    const params = { page: pageToLoad, limit: PAGE_SIZE };
    if (roleFilter !== 'browse') params.role = roleFilter; // 'browse' = no role filter
    if (search) params.search = search;
    api.get('/users', { params }).then(r => {
      setUsers(r.data.users || []);
      setTotal(r.data.total ?? (r.data.users || []).length);
      setTotalPages(r.data.totalPages || 1);
      setPage(r.data.page || pageToLoad);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    setUsers([]);
    if (roleFilter !== 'all') load(1);
  }, [roleFilter]);

  // Fetch per-role counts + grand total once on mount
  useEffect(() => {
    setCountLoading(true);
    const roles = ['student', 'teacher', 'admin', 'semesterAdmin'];
    Promise.all([
      // grand total
      api.get('/users', { params: { limit: 1 } })
        .then(res => ({ role: '_total', count: res.data.total ?? 0 }))
        .catch(() => ({ role: '_total', count: 0 })),
      // per role
      ...roles.map(r =>
        api.get('/users', { params: { role: r, limit: 1 } })
          .then(res => ({ role: r, count: res.data.total ?? 0 }))
          .catch(() => ({ role: r, count: 0 }))
      ),
    ]).then(results => {
      const counts = {};
      results.forEach(({ role, count }) => { counts[role] = count; });
      setRoleCounts(counts);
      setTotal(counts._total || 0);
    }).finally(() => setCountLoading(false));
  }, []);

  const handleSearch = (e) => { e.preventDefault(); load(1); };
  const goToPage = (p) => { if (p >= 1 && p <= totalPages && p !== page) load(p); };

  const toggleActive = async (user) => {
    if (currentUser && user._id === currentUser._id) {
      toast.error('You cannot change your own account status');
      return;
    }
    try {
      await api.put(`/users/${user._id}`, { isActive: !user.isActive });
      toast.success(user.isActive ? 'User deactivated' : 'User activated');
      load();
    } catch { toast.error('Something went wrong'); }
  };

  const openDeleteConfirm = (user) => {
    setDeleteTarget(user);
    setConfirmText('');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (confirmText.trim() !== (deleteTarget.name || '').trim()) {
      toast.error('Name does not match — type the exact name');
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/users/${deleteTarget._id}`, { data: { confirmName: confirmText.trim() } });
      toast.success(`${deleteTarget.name} has been deleted`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const FILTER_LABELS = { all: 'All Users', browse: 'Browse', teacher: 'Teachers', admin: 'Admins', allAdmins: 'All Admins' };

  // ── Summary cards shown when roleFilter === 'all' ──
  const SummaryView = () => {
    const cards = [
      { role: 'student',       label: 'Students',        icon: '🎓', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
      { role: 'teacher',       label: 'Teachers',        icon: '👨‍🏫', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
      { role: 'admin',         label: 'Super Admins',    icon: '🛡️', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
      { role: 'semesterAdmin', label: 'Semester Admins', icon: '📋', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
    ];
    return (
      <div>
        {/* Total banner */}
        <div style={{
          background: 'linear-gradient(135deg, var(--primary) 0%, #059669 100%)',
          borderRadius: 16, padding: '24px 28px', marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 4px 20px rgba(22,163,74,0.35)',
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}>
              Total Registered Users
            </div>
            <div style={{ fontSize: 42, fontWeight: 900, color: '#fff', lineHeight: 1 }}>
              {countLoading ? '—' : roleCounts._total ?? total}
            </div>
          </div>
          <div style={{ fontSize: 52, opacity: 0.6 }}>👥</div>
        </div>

        {/* Role count cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
          {cards.map(({ role, label, icon, color, bg }) => (
            <div key={role} style={{
              background: 'var(--bg)', border: `1px solid var(--border)`,
              borderLeft: `4px solid ${color}`, borderRadius: 14,
              padding: '18px 20px', boxShadow: 'var(--shadow)',
              transition: 'transform 0.15s, box-shadow 0.15s',
              cursor: 'default',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${color}22`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}
            >
              <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
              <div style={{ fontSize: 32, fontWeight: 900, color, lineHeight: 1, marginBottom: 4 }}>
                {countLoading ? '…' : (roleCounts[role] ?? 0)}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Browse CTA */}
        <div style={{
          background: 'var(--bg)', border: '1px dashed var(--border)', borderRadius: 14,
          padding: '20px 24px', textAlign: 'center', boxShadow: 'var(--shadow)',
        }}>
          <div style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 12 }}>
            Individual user profiles dekhte "Browse" click koro
          </div>
          <button
            onClick={() => setRoleFilter('browse')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--primary)', color: '#fff',
              border: 'none', borderRadius: 10, padding: '10px 24px',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 3px 12px rgba(22,163,74,0.35)',
              fontFamily: 'inherit',
            }}
          >
            Browse All Users →
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="page">
      <style>{`
        @media (min-width: 768px) { #desktop-tbl { display: block !important; } #mobile-cards { display: none !important; } }
        .pu-filter-btn { border: 1.5px solid var(--border); cursor: pointer; font-family: inherit; transition: all 0.18s; }
        .pu-filter-btn:hover { border-color: var(--primary); opacity: 0.9; }
        .pu-filter-btn.active-tab { border-color: var(--primary) !important; }
        thead th { background: var(--bg3); color: var(--txt2); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 10px 12px; border-bottom: 1px solid var(--border); white-space: nowrap; }
        tbody td { padding: 11px 12px; border-bottom: 1px solid var(--border); vertical-align: middle; }
        tbody tr:last-child td { border-bottom: none; }
        .group-hdr { background: var(--bg3); font-size: 11px; font-weight: 700; color: var(--txt2); padding: 8px 16px !important; letter-spacing: 0.05em; text-transform: uppercase; }
      `}</style>

      {/* ── Page header ── */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h2 className="page-title" style={{ fontSize: 22, fontWeight: 800, color: 'var(--txt)' }}>{title}</h2>
          <p className="page-sub" style={{ color: 'var(--txt2)', fontSize: 13, marginTop: 2 }}>{subtitle}</p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg3)', color: 'var(--txt)',
          padding: '8px 16px', borderRadius: 24,
          fontSize: 13, fontWeight: 700,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
          {total} Total Users
        </div>
      </div>

      {/* ── Filter + Search bar ── */}
      <div style={{
        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14,
        padding: '10px 12px', marginBottom: 18,
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
        boxShadow: 'var(--shadow)',
      }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flex: 1 }}>
          {roleFilters.map(r => {
            const isActive = roleFilter === r;
            const countMap = { all: roleCounts._total, browse: null, teacher: roleCounts.teacher, allAdmins: allAdminsCount };
            const count = countMap[r] ?? null;
            const roleColor = { all: '#34d399', browse: '#a78bfa', teacher: '#34d399', admin: '#60a5fa', allAdmins: '#60a5fa' }[r] || '#94a3b8';
            return (
              <button
                key={r}
                className="pu-filter-btn"
                onClick={() => setRoleFilter(r)}
                style={{
                  padding: '6px 14px', borderRadius: 24, fontSize: 12, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: isActive ? 'var(--primary)' : 'var(--bg3)',
                  color: isActive ? '#fff' : 'var(--txt2)',
                  boxShadow: isActive ? '0 2px 10px rgba(22,163,74,0.3)' : 'none',
                  transform: isActive ? 'scale(1.03)' : 'scale(1)',
                  borderColor: isActive ? 'var(--primary)' : undefined,
                }}
              >
                {FILTER_LABELS[r] || r}
                {count != null && (
                  <span style={{
                    fontSize: 10, fontWeight: 800, lineHeight: 1,
                    padding: '2px 6px', borderRadius: 20,
                    background: isActive ? 'rgba(255,255,255,0.25)' : `${roleColor}22`,
                    color: isActive ? '#fff' : roleColor,
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {roleFilter !== 'all' && <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--txt3)', pointerEvents: 'none' }}>
              <Icon name="search" size={14} />
            </span>
            <input
              className="form-input"
              style={{ paddingLeft: 34, width: 190, fontSize: 13, borderRadius: 10 }}
              placeholder="Search name or ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-secondary btn-sm" style={{ borderRadius: 10 }}>
            <Icon name="search" size={14} />
          </button>
        </form>}
      </div>

      {/* ── Content ── */}
      {roleFilter === 'all' ? <SummaryView /> : loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : users.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--txt)', marginBottom: 4 }}>No users found</div>
          <div style={{ color: 'var(--txt3)', fontSize: 13 }}>Try adjusting your filters or search query</div>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div id="desktop-tbl" style={{ display: 'none', background: 'var(--bg)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>#</th><th>Name</th><th>Email</th><th>Role</th>
                  <th>Department</th><th>Shift</th><th>Status</th><th>Action</th><th>Delete</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let rowNum = 0;
                  return groupedUsers.map(group => (
                    <React.Fragment key={group.label}>
                      <tr>
                        <td colSpan={9} className="group-hdr">{group.label}</td>
                      </tr>
                      {group.items.map(u => {
                        rowNum++;
                        return (
                          <TableRow
                            key={u._id}
                            user={u}
                            rowNum={rowNum}
                            onToggle={toggleActive}
                            onDelete={openDeleteConfirm}
                            isSelf={currentUser && u._id === currentUser._id}
                          />
                        );
                      })}
                    </React.Fragment>
                  ));
                })()}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div id="mobile-cards">
            {groupedUsers.map(group => (
              <div key={group.label} style={{ marginBottom: 20 }}>
                <div style={{
                  fontSize: 11, fontWeight: 800, color: 'var(--txt2)',
                  background: 'var(--bg3)', padding: '6px 12px',
                  borderRadius: 8, marginBottom: 10,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  {group.label}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
                  {group.items.map((u, idx) => (
                    <UserCard
                      key={u._id}
                      user={u}
                      idx={idx}
                      onToggle={toggleActive}
                      onDelete={openDeleteConfirm}
                      isSelf={currentUser && u._id === currentUser._id}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Pagination ── */}
      {roleFilter !== 'all' && !loading && users.length > 0 && totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 18 }}>
          <button
            className="btn-secondary btn-sm"
            style={{ borderRadius: 10 }}
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            <Icon name="chevronLeft" size={14} /> Prev
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt2)' }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn-secondary btn-sm"
            style={{ borderRadius: 10 }}
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
          >
            Next <Icon name="chevronRight" size={14} />
          </button>
        </div>
      )}

      {/* Delete confirmation — irreversible, so require typing the exact name */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <div className="modal-title" style={{ color: 'var(--danger)' }}>Permanently Delete User</div>
        <p style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 4 }}>
          This action <strong>cannot be undone</strong>. Deleting <strong>{deleteTarget?.name}</strong> will also remove related attendance, sessions, invites, and account history. To confirm, type their name exactly below:
        </p>
        <div className="form-group">
          <input
            className="form-input"
            placeholder={deleteTarget?.name || ''}
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            autoFocus
          />
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button
            className="btn-primary"
            style={{ background: 'var(--danger)' }}
            onClick={handleDelete}
            disabled={deleting || confirmText.trim() !== (deleteTarget?.name || '').trim()}
          >
            {deleting ? <><div className="spinner spinner-sm" /> Deleting...</> : 'Permanently Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
}