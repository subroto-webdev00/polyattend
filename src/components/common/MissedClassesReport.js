'use client';
import React, { useState, useEffect, useCallback } from 'react';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateNice(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function groupByDate(entries) {
  const map = new Map();
  entries.forEach(e => {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date).push(e);
  });
  return Array.from(map.entries());
}

const TODAY_CUTOFF_HOUR = 19; // 7:00 PM — same rule everywhere Missed Classes are shown

// Read-only Missed Classes report — used by Admin (/admin/missed-classes,
// all Departments), Department Admin (/subAdmin/missed-classes, own Department+
// Shift), and Semester Admin (/semesterAdmin/missed-classes, own Department+
// Shift+Semester). Backed by the same /api/reports/missed-sessions endpoint
// used by the Teacher's own Dashboard and Covered Miss Class page, just
// without any Cover/Dismiss actions — this is visibility only. Actually
// covering (or dismissing) a missed class is intentionally left to the
// assigned Teacher themselves, not Super/Sub/Semester Admin.
export default function MissedClassesReport() {
  const [now, setNow] = useState(new Date());
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const includeToday = now.getHours() >= TODAY_CUTOFF_HOUR;

  const load = useCallback(() => {
    setLoading(true);
    api.get('/reports/missed-sessions', { params: { asOfDate: todayISO(), includeToday } })
      .then(r => setEntries(r.data.missed || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [includeToday]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Missed Classes Report</h2>
        <p className="page-sub">
          Every Subject with no Session in the last 7 days, grouped by date.
          {' '}{includeToday ? "Today's classes are included (past 7:00 PM)." : "Today isn't counted yet — added after 7:00 PM."}
        </p>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : entries.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon"><Icon name="check" size={24} /></div>
            <p>No missed classes in the last 7 days 🎉</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {groupByDate(entries).map(([date, dateEntries]) => (
            <div key={date}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt2)', marginBottom: 8 }}>
                {formatDateNice(date)}
                <span style={{ fontWeight: 500, marginLeft: 8, color: 'var(--txt3)' }}>({dateEntries.length} missed)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dateEntries.map(entry => (
                  <div key={`${entry.subjectId}_${entry.date}`} style={{
                    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
                    padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: 'var(--danger)' }} />
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{entry.teacherName}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--txt2)' }}>
                        {entry.subjectName} ({entry.subjectCode})
                        {entry.departmentCode ? ` • ${entry.departmentCode}` : ''} • Sem {entry.semester} • Group {entry.section}
                      </div>
                    </div>
                    {entry.teacherMobile ? (
                      <a
                        href={`tel:${entry.teacherMobile}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', flexShrink: 0 }}
                      >
                        <Icon name="phone" size={13} /> {entry.teacherMobile}
                      </a>
                    ) : (
                      <span style={{ fontSize: 11.5, color: 'var(--txt3)', flexShrink: 0 }}>No mobile on file</span>
                    )}
                    <span className="tag tag-red">Miss</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
