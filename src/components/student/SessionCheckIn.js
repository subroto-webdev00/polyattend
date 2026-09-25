'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import { toast } from 'react-hot-toast';
import { formatDepartment, formatShift, formatSubject } from '@/lib/display';

// PERFORMANCE: this polls every Student's dashboard for an active session.
// At small scale 8s was fine, but with enrollment in the thousands, every
// student who has their dashboard open (very common while a class is in
// progress) fires a request this often — that adds up to steady, constant
// database load network-wide, on top of everything else the app is doing.
// 15s roughly halves that request volume while the actual experience is
// unchanged: a class runs for tens of minutes, so a few extra seconds
// before "Mark My Attendance" appears is not noticeable.
const POLL_MS = 15000;

// Always visible on the student dashboard. Has 3 states:
//  1. No active session  -> button disabled, greyed out
//  2. Active session      -> button enabled, "Mark My Attendance"
//  3. Already marked      -> done state, green check
export default function SessionCheckIn() {
  const [session, setSession] = useState(null);
  const [alreadyMarked, setAlreadyMarked] = useState(false);
  const [markedBy, setMarkedBy] = useState(null);
  const [marking, setMarking] = useState(false);
  const timerRef = useRef(null);

  const fetchActive = useCallback(async () => {
    try {
      const { data } = await api.get('/attendance/active-session');
      setSession(data.session || null);
      setAlreadyMarked(!!data.alreadyMarked);
      setMarkedBy(data.markedBy || null);
    } catch (e) {
      // silent — don't spam the dashboard with errors on every poll
    }
  }, []);

  useEffect(() => {
    fetchActive();
    timerRef.current = setInterval(fetchActive, POLL_MS);
    return () => clearInterval(timerRef.current);
  }, [fetchActive]);

  const handleMark = async () => {
    if (!session?._id) return;
    setMarking(true);
    try {
      const { data } = await api.post('/attendance/self-mark', { sessionId: session._id });
      toast.success(data.message || 'Attendance marked!');
      setAlreadyMarked(true);
      setMarkedBy('self');
    } catch (e) {
      const msg = e?.response?.data?.message || 'A problem occurred, please try again';
      toast.error(msg);
      // Session may have just ended, or teacher already marked it — re-sync.
      fetchActive();
    } finally {
      setMarking(false);
    }
  };

  const isActive = !!session;
  const isDone = isActive && alreadyMarked;

  const bg = isDone
    ? 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))'
    : isActive
      ? 'linear-gradient(135deg, rgba(99,102,241,0.14), rgba(99,102,241,0.05))'
      : 'var(--card-bg, rgba(148,163,184,0.06))';

  const border = isDone ? 'rgba(34,197,94,0.35)' : isActive ? 'rgba(99,102,241,0.35)' : 'var(--border)';
  const iconBg = isDone ? 'rgba(34,197,94,0.18)' : isActive ? 'rgba(99,102,241,0.18)' : 'rgba(148,163,184,0.15)';
  const iconName = isDone ? 'check' : isActive ? 'play' : 'clipboard';

  return (
    <div className="card checkin-card" style={{
      marginBottom: 16, padding: 18,
      background: bg,
      border: `1px solid ${border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: iconBg, flexShrink: 0,
        }}>
          <Icon name={iconName} size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {isActive
              ? `${formatSubject(session.subjectId)} is ongoing`
              : 'Attendance'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--txt2)' }}>
            {isActive
              ? `${formatDepartment(session.departmentId)} • ${formatShift(session.shift || session.subjectId?.shift)} Shift • ${session.teacherId?.name || 'Teacher'}`
              : 'No class session is running right now'}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        {isDone ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, color: 'var(--primary)' }}>
            <Icon name="check" size={16} />
            Your attendance has been marked{markedBy === 'self' ? ' (marked by you)' : ''}
          </div>
        ) : (
          <button
            className="btn btn-primary"
            style={{ width: '100%', opacity: isActive ? 1 : 0.5, cursor: isActive ? 'pointer' : 'not-allowed' }}
            onClick={handleMark}
            disabled={!isActive || marking}
          >
            <Icon name="check" size={16} />
            {marking ? 'Sending...' : isActive ? 'I am Present — Mark Attendance' : 'Button will enable when class starts'}
          </button>
        )}
      </div>
    </div>
  );
}
