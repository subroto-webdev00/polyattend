'use client';
import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Shown at both /admin/session-report (all departments) and
// (own Department+Shift only) — the backend
// (/api/reports/teacher-session) already scopes results per role, so this
// component doesn't need to know which one it's running under.
//
// SUBSTITUTE CLASS: a row can now be "held" because a Semester Admin
// covered the class for the assigned Teacher (r.isSubstitute). That's
// shown with its own amber "Substitute Covered" badge, with the covering
// admin's name, instead of the plain green "Class Held" badge — so an
// admin can tell at a glance which classes actually ran on the Teacher's
// own initiative vs. which ones needed covering.
export default function TeacherSessionReport() {
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | held | missed | substitute

  useEffect(() => {
    setLoading(true);
    api.get('/reports/teacher-session', { params: { date } })
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [date]);

  const rows = (data?.rows || []).filter(r => {
    if (filter === 'all') return true;
    if (filter === 'held') return r.held;
    if (filter === 'missed') return !r.held;
    if (filter === 'substitute') return r.isSubstitute;
    return true;
  });

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Teacher Session Report</h2>
        <p className="page-sub">Which Teacher took class on which day — excluding Friday/Saturday and declared Holidays</p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <input
          type="date" className="form-input" style={{ width: 170, fontSize: 13 }}
          value={date} onChange={e => setDate(e.target.value)}
        />
        {!loading && data && !data.isHoliday && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { key: 'all', label: `All (${data.summary.total})` },
              { key: 'held', label: `Held (${data.summary.held})` },
              { key: 'substitute', label: `Substitute (${data.summary.substitute})` },
              { key: 'missed', label: `Miss (${data.summary.missed})` },
            ].map(f => (
              <button
                key={f.key} onClick={() => setFilter(f.key)}
                style={{
                  padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                  background: filter === f.key ? 'var(--primary)' : 'var(--bg3)',
                  color: filter === f.key ? '#fff' : 'var(--txt2)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : data?.isHoliday ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon"><Icon name="calendar" size={24} /></div>
            <p>
              {data.reason === 'Friday' ? 'Today is Friday — College closed'
                : data.reason === 'Saturday' ? 'Today is Saturday — College closed'
                : `Today is a holiday — ${data.holiday?.title || 'Declared Holiday'}`}
            </p>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon"><Icon name="clipboard" size={24} /></div>
            <p>No data yet</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(r => (
            <div key={r.subjectId} style={{
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
              padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: r.isSubstitute ? 'var(--accent)' : r.held ? 'var(--primary-mid)' : 'var(--danger)',
              }} />
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{r.teacherName}</div>
                <div style={{ fontSize: 11.5, color: 'var(--txt2)' }}>{r.teacherEmail}</div>
                {r.isSubstitute && r.substituteByName && (
                  <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginTop: 2 }}>
                    Covered by {r.substituteByName} (Semester Admin)
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10.5, color: 'var(--txt2)', background: 'var(--bg3)', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                  {r.subjectName} ({r.subjectCode})
                </span>
                <span style={{ fontSize: 10.5, color: 'var(--txt2)', background: 'var(--bg3)', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                  {r.departmentCode} • Sem {r.semester} • Group {r.section}
                </span>
              </div>
              <span className={`tag ${r.isSubstitute ? 'tag-amber' : r.held ? 'tag-green' : 'tag-red'}`}>
                {r.isSubstitute ? 'Substitute Covered' : r.held ? 'Class Held' : 'Miss'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
