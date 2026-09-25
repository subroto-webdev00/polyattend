'use client';
import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import { useAuth } from '@/context/AuthContext';
import { formatDepartment, formatShift, formatSubject } from '@/lib/display';
import SessionCheckIn from './SessionCheckIn';

export default function StudentHome() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [threshold, setThreshold] = useState(70);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?._id) {
      Promise.all([
        api.get(`/attendance/student/${user._id}`),
        api.get('/settings').catch(() => null), // non-fatal if settings fetch fails
      ])
        .then(([attRes, settingsRes]) => {
          setSummary(attRes.data);
          if (settingsRes?.data?.settings?.attendanceThreshold != null) {
            setThreshold(settingsRes.data.settings.attendanceThreshold);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [user]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const overall = summary?.overall || {};
  // FIX: this used to be hard-coded at 75%. Now it uses the admin-configurable
  // threshold from Settings (default 70%) — the same number used for the
  // per-subject "exam eligibility" warning below.
  const lowAtt = summary?.summary?.filter(s => s.percentage < threshold) || [];

  return (
    <div className="page">
      {/* Auto-appears the moment a teacher starts a session for this student's class */}
      <SessionCheckIn />

      {/* Profile Card */}
      <div className="profile-card">
        <div className="profile-avatar">{user?.name?.charAt(0)}</div>
        <div>
          <div className="profile-name">{user?.name}</div>
          <div className="profile-meta">
            {user?.studentId} • {formatDepartment(user?.departmentId, user?.departmentCode)} • Sem {user?.semester} • Group {user?.section} • {formatShift(user?.shift)} Shift
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card stat-green">
          <div className="stat-icon"><Icon name="chart" size={18} /></div>
          <div className="stat-val">{overall.percentage || 0}%</div>
          <div className="stat-lbl">Overall Att.</div>
        </div>
        <div className="stat-card stat-blue">
          <div className="stat-icon"><Icon name="book" size={18} /></div>
          <div className="stat-val">{summary?.summary?.length || 0}</div>
          <div className="stat-lbl">Subjects</div>
        </div>
        <div className="stat-card stat-amber">
          <div className="stat-icon"><Icon name="check" size={18} /></div>
          <div className="stat-val">{overall.present || 0}</div>
          <div className="stat-lbl">Present</div>
        </div>
        <div className="stat-card stat-red">
          <div className="stat-icon"><Icon name="alert" size={18} /></div>
          <div className="stat-val">{lowAtt.length}</div>
          <div className="stat-lbl">Below {threshold}%</div>
        </div>
      </div>

      {lowAtt.length > 0 && (
        <div className="info-banner warn-banner mb-3">
          <Icon name="alert" size={16} />
          <span className="info-text">
            <strong>{lowAtt.length} subject(s)</strong> have attendance below {threshold}% — you cannot sit for the exam in these subjects. Attend class now!
          </span>
        </div>
      )}

      <div className="section-title">Subject-wise Attendance</div>
      <div className="card mb-3">
        {(summary?.summary || []).length === 0 ? (
          <div className="empty"><p>No attendance records yet.</p></div>
        ) : (summary?.summary || []).map((s, i) => {
          const pct = s.percentage;
          const color = pct >= 75 ? 'var(--primary)' : pct >= 60 ? 'var(--accent)' : 'var(--danger)';
          const fillClass = pct >= 75 ? 'fill-green' : pct >= 60 ? 'fill-amber' : 'fill-red';
          const ineligible = pct < threshold;
           const subjectDepartment = formatDepartment(s.subject?.departmentId, s.subject?.departmentCode);
           const subjectShift = formatShift(s.subject?.shift);
          return (
            <div key={i} style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)' }}>
              <div className="progress-row">
                <span className="progress-label">{formatSubject(s.subject)}</span>
                <span style={{ fontSize: 12, color, fontWeight: 700 }}>
                  {s.present}/{s.total} ({pct}%)
                </span>
              </div>
              <div className="progress-bg">
                <div className={`progress-fill ${fillClass}`} style={{ width: `${pct}%` }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 4 }}>
                {formatSubject(s.subject)} • {subjectDepartment || 'Department unavailable'} • Sem {s.subject?.semester || s.semester || '—'} • {subjectShift ? `${subjectShift} Shift` : 'Shift unavailable'} • {s.present} present, {s.absent} absent
              </div>
              {/* FEATURE: exam-eligibility warning badge, threshold set by admin */}
              {ineligible && (
                <div style={{
                  marginTop: 8, display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--danger-light)', color: 'var(--danger)',
                  padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                }}>
                  <Icon name="alert" size={14} />
                  You cannot sit for the exam in this subject, attendance {pct}%
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
