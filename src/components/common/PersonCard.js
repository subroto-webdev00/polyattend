'use client';
import React from 'react';
import Icon from './Icon';
import { formatShift } from '@/lib/display';

// ── SHARED COMPACT CARD ─────────────────────────────────────────────────
// Used everywhere a person (Student, Teacher, Department Admin)
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
//   actions: optional — array of {label, icon, onClick, variant, disabled}.
//     `variant: 'primary'` marks THE main action of the card and renders it
//     filled, so "Assign Subject" reads as the thing to press rather than
//     competing with "Deactivate" and "Delete" on equal footing.
//   onClick: optional — makes the whole card clickable (e.g. open detail/edit)

const ROLE_META = {
  admin: { label: 'Admin', tag: 'tag-blue', color: '#60a5fa' },
  departmentAdmin: { label: 'Department Admin', tag: 'tag-blue', color: '#38bdf8' },
  teacher: { label: 'Teacher', tag: 'tag-green', color: '#34d399' },
  student: { label: 'Student', tag: 'tag-amber', color: '#fbbf24' },
};

// A card is a glance, not a table. Past this many Subjects the rest collapse
// into a counter so one heavily-loaded Teacher can't stretch the grid.
const MAX_SUBJECT_ROWS = 4;

function initials(name) {
  return (name || '').trim().split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

// Short metadata chips (department, shift, roll...) — the small, fixed-length
// facts. Subjects deliberately do NOT come through here; they get their own
// block below because they are variable in number and need a readable layout.
function metaForRole(p) {
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

    case 'teacher':
      return [
        deptCode ? { icon: 'department', text: deptCode } : null,
        shiftLabel ? { icon: 'clock', text: `${shiftLabel} Shift` } : null,
      ].filter(Boolean);

    case 'departmentAdmin':
      return [
        deptCode ? { icon: 'department', text: deptCode } : null,
        p.semester ? { icon: 'book', text: `Sem ${p.semester}` } : null,
        shiftLabel ? { icon: 'clock', text: `${shiftLabel} Shift` } : null,
      ].filter(Boolean);

    default:
      return [];
  }
}

// Every Subject this Teacher carries. Accepts either the `subjects` array the
// teacher lists send or the raw `taughtSubjects` relation, and falls back to a
// plain populated `subjectId` for any caller passing a bare User document.
function subjectsFor(p) {
  if (Array.isArray(p.subjects)) return p.subjects;
  if (Array.isArray(p.taughtSubjects)) return p.taughtSubjects;
  if (p.subjectId && typeof p.subjectId === 'object' && p.subjectId.name) return [p.subjectId];
  return [];
}

function SubjectsBlock({ person }) {
  const subjects = subjectsFor(person);
  // Only Teachers carry Subjects; a Student or Department Admin reading this
  // branch would just get an empty block, so skip it entirely.
  if (person.role !== 'teacher') return null;

  if (subjects.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '9px 11px', borderRadius: 10,
        background: 'var(--bg3)', border: '1px dashed var(--border2)',
        fontSize: 11.5, color: 'var(--txt3)', fontWeight: 600,
      }}>
        <Icon name="book" size={13} /> No Subject assigned yet
      </div>
    );
  }

  const shown = subjects.slice(0, MAX_SUBJECT_ROWS);
  const hidden = subjects.length - shown.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{
        fontSize: 9.5, fontWeight: 800, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--txt3)',
      }}>
        Subjects ({subjects.length})
      </div>

      {shown.map((s, i) => (
        <div
          key={s._id || s.id || i}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 10px', borderRadius: 9,
            background: 'var(--bg3)', border: '1px solid var(--border)',
          }}
        >
          <span style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{
              fontSize: 12, fontWeight: 650, color: 'var(--txt)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {s.name}
            </span>
            {s.code && (
              <span style={{ fontSize: 10.5, color: 'var(--txt3)', fontWeight: 600, flexShrink: 0 }}>
                {s.code}
              </span>
            )}
          </span>

          {(s.semester || s.section) && (
            <span style={{
              flexShrink: 0, fontSize: 10, fontWeight: 700,
              color: 'var(--primary)', background: 'var(--primary-light)',
              border: '1px solid rgba(34, 197, 94, 0.28)',
              padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap',
            }}>
              {s.semester ? `Sem ${s.semester}` : ''}{s.section ? ` · Grp ${s.section}` : ''}
            </span>
          )}
        </div>
      ))}

      {hidden > 0 && (
        <div style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 600, paddingLeft: 2 }}>
          +{hidden} more
        </div>
      )}
    </div>
  );
}

// Filled for the card's main action, tinted for destructive ones, and flat for
// everything in between so a row of three never turns into three competing
// buttons.
function actionStyle(variant, disabled) {
  if (disabled) {
    return { background: 'var(--bg3)', color: 'var(--txt3)', border: '1px solid var(--border)' };
  }
  if (variant === 'primary') {
    return {
      background: 'linear-gradient(135deg, var(--primary-mid), var(--primary))',
      color: '#fff',
      border: '1px solid rgba(34, 197, 94, 0.5)',
      boxShadow: '0 2px 8px rgba(22, 163, 74, 0.32)',
    };
  }
  if (variant === 'danger') {
    return {
      background: 'var(--danger-light)',
      color: '#f87171',
      border: '1px solid rgba(244, 63, 94, 0.3)',
    };
  }
  return {
    background: 'var(--bg3)',
    color: 'var(--txt2)',
    border: '1px solid var(--border2)',
  };
}

export default function PersonCard({ person, subtitleFields, actions = [], onClick }) {
  const meta = ROLE_META[person.role] || { label: person.role || 'Unknown', tag: 'tag-blue', color: '#94a3b8' };
  const fields = subtitleFields || metaForRole(person);
  const [hov, setHov] = React.useState(false);
  const [actionHover, setActionHover] = React.useState(null);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setActionHover(null); }}
      style={{
        background: `linear-gradient(160deg, ${meta.color}0F 0%, transparent 45%), var(--bg)`,
        borderTop: `1px solid ${hov ? meta.color + '4A' : 'var(--border)'}`,
        borderRight: `1px solid ${hov ? meta.color + '4A' : 'var(--border)'}`,
        borderBottom: `1px solid ${hov ? meta.color + '4A' : 'var(--border)'}`,
        borderLeft: `3px solid ${meta.color}`,
        borderRadius: 'var(--radius-lg)', padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 11,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.18s ease',
        minWidth: 0,
        boxShadow: hov ? `0 8px 28px ${meta.color}1F, 0 2px 8px rgba(0,0,0,0.25)` : 'var(--shadow)',
        transform: hov ? 'translateY(-2px)' : 'none',
      }}
    >
      {/* Header: avatar + name/email + active status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: `linear-gradient(135deg, ${meta.color}, ${meta.color}bb)`,
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

      {/* Role + short metadata as chips */}
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

      <SubjectsBlock person={person} />

      {/* Actions — always one evenly-sized row so nothing orphans onto a line
          of its own, which is what made the old three-button card look
          accidental. */}
      {actions.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          {actions.map((a, i) => {
            const isPrimary = a.variant === 'primary';
            const hovered = actionHover === i;
            return (
              <button
                key={i}
                disabled={a.disabled}
                title={a.title}
                onClick={(e) => { e.stopPropagation(); if (!a.disabled) a.onClick(); }}
                onMouseEnter={() => setActionHover(i)}
                onMouseLeave={() => setActionHover(null)}
                style={{
                  ...actionStyle(a.variant, a.disabled),
                  flex: '1 1 0', minWidth: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  borderRadius: 9, padding: '8px 6px',
                  fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
                  transition: 'all 0.15s',
                  opacity: a.disabled ? 0.5 : 1,
                  cursor: a.disabled ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  ...(hovered && !a.disabled ? {
                    transform: 'translateY(-1px)',
                    boxShadow: isPrimary
                      ? '0 6px 18px rgba(22, 163, 74, 0.45)'
                      : a.variant === 'danger'
                        ? '0 4px 12px rgba(244, 63, 94, 0.28)'
                        : '0 3px 10px rgba(0,0,0,0.3)',
                    filter: 'brightness(1.08)',
                  } : {}),
                }}
              >
                {a.icon && <Icon name={a.icon} size={12} />}
                {a.label}
              </button>
            );
          })}
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
      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
      gap: 12,
    }}>
      {children}
    </div>
  );
}
