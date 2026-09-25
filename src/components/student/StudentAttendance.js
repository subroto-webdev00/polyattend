'use client';
import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import { useAuth } from '@/context/AuthContext';
import { formatDepartment, formatShift, formatSubject } from '@/lib/display';

export default function StudentAttendance() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?._id) {
      api.get(`/attendance/student/${user._id}`)
        .then(r => setSummary(r.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [user]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  if (selectedSubject) {
    const recs = selectedSubject.records || [];
    return (
      <div>
        <div className="action-bar">
          <button className="btn-icon" onClick={() => setSelectedSubject(null)}><Icon name="chevronLeft" size={18} /></button>
          <div style={{ flex: 1 }}>
            <div className="action-bar-title">{formatSubject(selectedSubject.subject)}</div>
            <div style={{ fontSize: 12, color: 'var(--txt2)' }}>{formatDepartment(selectedSubject.subject?.departmentId, selectedSubject.subject?.departmentCode)} • Sem {selectedSubject.subject?.semester || selectedSubject.semester || '—'} • Group {selectedSubject.subject?.section || selectedSubject.section || '—'} • {formatShift(selectedSubject.subject?.shift)} Shift</div>
          </div>
          <span style={{
            fontWeight: 700, fontSize: 14,
            color: selectedSubject.percentage >= 75 ? 'var(--primary)' : selectedSubject.percentage >= 60 ? 'var(--accent)' : 'var(--danger)'
          }}>{selectedSubject.percentage}%</span>
        </div>

        <div className="page" style={{ paddingTop: 16 }}>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
            <div className="stat-card stat-blue"><div className="stat-val">{selectedSubject.total}</div><div className="stat-lbl">Total</div></div>
            <div className="stat-card stat-green"><div className="stat-val">{selectedSubject.present}</div><div className="stat-lbl">Present</div></div>
            <div className="stat-card stat-red"><div className="stat-val">{selectedSubject.absent}</div><div className="stat-lbl">Absent</div></div>
          </div>

          <div className="section-title">Date-wise Records</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Status</th></tr>
              </thead>
              <tbody>
                {recs.map((r, i) => (
                  <tr key={i}>
                    <td>{new Date(r.date).toLocaleDateString('en-BD', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</td>
                    <td>
                      {r.status === 'present'
                        ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span className="att-p">✓ Present</span>
                            {r.markedBy === 'self' && (
                              <span className="tag tag-amber" style={{ fontSize: 10, padding: '2px 6px' }} title="You marked this attendance yourself">Self</span>
                            )}
                          </span>
                        )
                        : <span className="att-a">✗ Absent</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Attendance History</h2>
        <p className="page-sub">View Subject-wise details</p>
      </div>

      {(summary?.summary || []).length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon"><Icon name="clipboard" size={24} /></div>
            <p>No attendance records yet.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          {(summary?.summary || []).map((s, i) => {
            const pct = s.percentage;
            const color = pct >= 75 ? 'var(--primary)' : pct >= 60 ? 'var(--accent)' : 'var(--danger)';
            return (
              <div key={i} className="list-item" onClick={() => setSelectedSubject(s)}>
                <div className={`item-icon ${pct >= 75 ? 'icon-green' : pct >= 60 ? 'icon-amber' : 'icon-red'}`}>
                  <Icon name="book" size={18} />
                </div>
                <div className="item-content">
                  <div className="item-title">{formatSubject(s.subject)}</div>
                  <div className="item-sub">{formatDepartment(s.subject?.departmentId, s.subject?.departmentCode)} • Sem {s.subject?.semester || s.semester || '—'} • Group {s.subject?.section || s.section || '—'} • {formatShift(s.subject?.shift)} Shift • {s.present}/{s.total} classes</div>
                </div>
                <div className="item-right">
                  <div style={{ fontWeight: 700, color, fontSize: 15 }}>{pct}%</div>
                  <div className="text-xs text-muted">{s.records?.length} records</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
