'use client';
import React from 'react';
import Icon from './Icon';
import { formatShift } from '@/lib/display';

// ── SHARED COMPACT CARD ─────────────────────────────────────────────────
// Used everywhere a person (Student, Teacher, Department Admin, Semester Admin)
// needs to be shown as a small, information-dense card instead of a full
// table row — grids of these scan much faster than a long list. Each role
// shows a different, relevant subset of fields (a Student's Roll/Group
// isn't relevant to a Department Admin, a Department Admin's Department+Shift isn't
// relevant to a Teacher's Subject, etc.) but the visual shape stays the
// same everywhere so the whole app feels consistent.
//
// Props:
//   person: the user object (name, email, role, departmentId, shift,
//     semester, section, studentId, mobile, subjectId, isActive, ...)
//   subtitleFields: optional override array of {label, value} to force
//     specific fields (falls back to role-based defaults below)
//   actions: optional array of {label, icon, onClick, variant} rendered
//     as small buttons at the bottom-right of the card
//   onClick: optional — makes the whole card clickable (e.g. open detail/edit)

const ROLE_META = {
  admin: { label: 'Admin', tag: 'tag-blue', color: '#60a5fa' },
  subAdmin: { label: 'Department Admin', tag: 'tag-purple', color: '#a78bfa' },
  semesterAdmin: { label: 'Semester Admin', tag: 'tag-blue', color: '#38bdf8' },
  teacher: { label: 'Teacher', tag: 'tag-green', color: '#34d399' },
  student: { label: 'Student', tag: 'tag-amber', color: '#fbbf24' },
};

function initials(name) {
  return (name || '').trim().split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function fieldsForRole(p) {
  const deptCode = p.departmentId?.code || p.departmentCode || null;
  const shiftLabel = p.shift ? formatShift(p.shift) : null;

  switch (p.role) {
    case 'student':
      return [
        p.studentId ? { icon: 'id', text: `Roll: ${p.studentId}` } : null,
        deptCode ? { icon: 'department', text: deptCode } : null,
        p.semester ? { icon: 'book', text: `Sem ${p.semester}` } : null,
        p.section ? { icon: 'users', text: `Group ${p.section}` } : null,
        shiftLabel ? { icon: 'clock', text: `${shiftLabel} Shift` } : null,
        p.mobile ? { icon: 'phone', text: p.mobile } : null,
      ].filter(Boolean);

    case 'teacher': {
      // MULTI-SUBJECT: the Semester Admin teachers list sends a `subjects`
      // array (every Subject this teacher has within that admin's scope)
      // rather than a single `subjectId`. Each Subject gets its own chip
      // with name, code, semester and group so the card is fully
      // informative at a glance — no need to click in for details. Falls
      // back to the old single-subject shape for any other caller still
      // passing a plain User document with `subjectId`.
      const assignedSubjects = Array.isArray(p.subjects)
        ? p.subjects
        : Array.isArray(p.taughtSubjects) ? p.taughtSubjects : [];

      if (assignedSubjects.length > 0) {
        const subjectChips = assignedSubjects.map(s => ({
          icon: 'book',
          text: `${s.name} (${s.code})${s.semester ? ` · Sem ${s.semester}` : ''} · Grp ${s.section}`,
        }));
        return [
          deptCode ? { icon: 'department', text: deptCode } : null,
          shiftLabel ? { icon: 'clock', text: `${shiftLabel} Shift` } : null,
          ...subjectChips,
        ].filter(Boolean);
      }
      return [
        p.subjectId?.name ? { icon: 'book', text: p.subjectId.name } : null,
        p.subjectId?.code ? { icon: 'tag', text: p.subjectId.code } : null,
        deptCode ? { icon: 'department', text: deptCode } : null,
        p.semester ? { icon: 'book', text: `Sem ${p.semester}` } : null,
        p.section ? { icon: 'users', text: `Group ${p.section}` } : null,
        shiftLabel ? { icon: 'clock', text: `${shiftLabel} Shift` } : null,
      ].filter(Boolean);
    }

    case 'semesterAdmin':
      return [
        deptCode ? { icon: 'department', text: deptCode } : null,
        p.semester ? { icon: 'book', text: `Sem ${p.semester}` } : null,
        shiftLabel ? { icon: 'clock', text: `${shiftLabel} Shift` } : null,
      ].filter(Boolean);

    case 'subAdmin':
      return [
        deptCode ? { icon: 'department', text: deptCode } : null,
        shiftLabel ? { icon: 'clock', text: `${shiftLabel} Shift` } : null,
      ].filter(Boolean);

    default:
      return [];
  }
}

export default function PersonCard({ person, subtitleFields, actions = [], onClick }) {
  const meta = ROLE_META[person.role] || { label: person.role || 'Unknown', tag: 'tag-blue', color: '#94a3b8' };
  const fields = subtitleFields || fieldsForRole(person);
  const [hov, setHov] = React.useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--bg)',
        borderTop: `1px solid ${hov ? meta.color + '55' : 'var(--border)'}`,
        borderRight: `1px solid ${hov ? meta.color + '55' : 'var(--border)'}`,
        borderBottom: `1px solid ${hov ? meta.color + '55' : 'var(--border)'}`,
        borderLeft: `3px solid ${meta.color}`,
        borderRadius: 'var(--radius-lg)', padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 10,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.18s ease',
        minWidth: 0,
        boxShadow: hov ? `0 6px 24px ${meta.color}18, 0 2px 8px rgba(0,0,0,0.25)` : 'var(--shadow)',
        transform: hov ? 'translateY(-2px)' : 'none',
      }}
    >
      {/* Top row: avatar + name/email + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`,
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13.5, fontWeight: 800, letterSpacing: '0.02em',
          boxShadow: `0 3px 10px ${meta.color}40`,
        }}>
          {initials(person.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {person.name}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--txt2)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {person.email}
          </div>
        </div>
        <span
          title={person.isActive === false ? 'Inactive' : 'Active'}
          style={{
            width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
            background: person.isActive === false ? '#f87171' : '#34d399',
            boxShadow: person.isActive === false ? '0 0 0 3px rgba(248, 113, 113, 0.18)' : '0 0 0 3px rgba(52, 211, 153, 0.18)',
          }}
        />
      </div>

      {/* Role tag + key fields as chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: meta.color + '24', color: meta.color,
          fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
          border: `1px solid ${meta.color}30`, letterSpacing: '0.02em',
        }}>
          {meta.label}
        </span>
        {fields.map((f, i) => (
          <span key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10.5, color: 'var(--txt2)', background: 'var(--bg3)',
            padding: '2px 9px', borderRadius: 20, fontWeight: 600,
          }}>
            {f.icon && <Icon name={f.icon} size={11} />}
            {f.text}
          </span>
        ))}
      </div>

      {/* Actions */}
      {actions.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 2, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          {actions.map((a, i) => (
            <button
              key={i}
              disabled={a.disabled}
              title={a.title}
              onClick={(e) => { e.stopPropagation(); if (!a.disabled) a.onClick(); }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                border: 'none', cursor: a.disabled ? 'not-allowed' : 'pointer', borderRadius: 8,
                padding: '5px 12px', fontSize: 11, fontWeight: 700,
                fontFamily: 'inherit', transition: 'all 0.15s',
                opacity: a.disabled ? 0.5 : 1,
                background: a.disabled ? 'var(--bg3)' : a.variant === 'danger' ? 'rgba(248, 113, 113, 0.16)' : 'rgba(52, 211, 153, 0.16)',
                color: a.disabled ? 'var(--txt3)' : a.variant === 'danger' ? '#f87171' : '#34d399',
              }}
            >
              {a.icon && <Icon name={a.icon} size={12} />}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Grid wrapper — a responsive auto-fill grid so cards wrap naturally at any
// screen width instead of stretching too wide on desktop or squeezing on
// mobile.
export function PersonCardGrid({ children }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: 10,
    }}>
      {children}
    </div>
  );
}
