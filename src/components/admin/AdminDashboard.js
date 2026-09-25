'use client';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import { formatDepartment, formatShift, formatSubject } from '@/lib/display';
import {
  DashboardPage, DashboardLoading, DashboardHero, DashboardClock,
  StatGrid, StatCard, SectionHeader, EmptyState, ListRow, SubjectOverview,
} from '@/components/common/DashboardKit';

/* ------------------------------------------------------------------ */
/*  All data-fetching / business logic below is unchanged from the     */
/*  original component (animated counters, Bangladesh-time greeting,   */
/*  active-session end action, live pulse indicator) — only markup +   */
/*  styling has been redesigned to match Teacher Dashboard's dark      */
/*  theme via the shared DashboardKit.                                 */
/* ------------------------------------------------------------------ */

function AnimatedNumber({ value, duration = 700 }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const startVal = startRef.current;
    const diff = value - startVal;
    if (diff === 0) { setDisplay(value); return; }
    const startTime = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(Math.round(startVal + diff * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        startRef.current = value;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return display;
}

// Returns the current hour in Bangladesh time (UTC+6), regardless of
// the server's or browser's own timezone.
function getBangladeshHour(date) {
  const bdString = date.toLocaleString('en-US', { timeZone: 'Asia/Dhaka', hour12: false, hour: '2-digit' });
  return parseInt(bdString, 10) % 24;
}

// Returns { text, icon } based on current hour (Bangladesh time).
function getAdminGreeting(hour) {
  if (hour < 5) return { text: 'Good Night', icon: 'moon' };
  if (hour < 12) return { text: 'Good Morning', icon: 'sun' };
  if (hour < 16) return { text: 'Good Afternoon', icon: 'sun' };
  if (hour < 19) return { text: 'Good Evening', icon: 'sunset' };
  return { text: 'Good Evening', icon: 'moon' };
}

function sessionTitle(session) {
  return `${formatSubject(session.subjectId)} — Sem ${session.semester}, Group ${session.section || '—'}`;
}

function sessionSubtitle(session) {
  const shift = formatShift(session.shift || session.subjectId?.shift);
  return [
    formatDepartment(session.departmentId),
    shift ? `${shift} Shift` : '',
    session.teacherId?.name ? `Teacher: ${session.teacherId.name}` : '',
    session.date ? new Date(session.date).toLocaleDateString('en-BD') : '',
  ].filter(Boolean).join(' • ');
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({ students: 0, teachers: 0, subjects: 0, sessions: 0 });
  const [subjects, setSubjects] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [endingId, setEndingId] = useState(null);
  const [now, setNow] = useState(new Date());
  const [adminName, setAdminName] = useState('');

  const handleEndSession = async (id) => {
    if (!confirm('End this session right now? Anyone who has not marked attendance yet will become absent.')) return;
    setEndingId(id);
    try {
      await api.put(`/sessions/${id}/end`);
      setRecentSessions(prev => prev.map(s => s._id === id ? { ...s, status: 'ended' } : s));
      setActiveSessions(prev => prev.filter(s => s._id !== id));
    } catch (e) {
      alert(e?.response?.data?.message || 'Could not end Session');
    } finally {
      setEndingId(null);
    }
  };

  useEffect(() => {
    // Keep the greeting/time fresh without a full page reload.
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const parsed = JSON.parse(raw);
        setAdminName(parsed?.name || parsed?.fullName || '');
      }
    } catch {
      // ignore — greeting just falls back to a generic label
    }
  }, []);

  useEffect(() => {
    // PERFORMANCE: this used to call `/users?role=student` and
    // `/users?role=teacher` with no limit, just to read `.count` off the
    // response — but that meant downloading every student's and every
    // teacher's full record (name, email, department, etc.) on every
    // single dashboard load, for every admin, every time. `countOnly=true`
    // runs a plain database count and returns just the number — no
    // documents are fetched or sent over the network.
    Promise.all([
      api.get('/users?role=student&countOnly=true'),
      api.get('/users?role=teacher&countOnly=true'),
      api.get('/subjects'),
      api.get('/sessions'),
      api.get('/sessions?status=active'),
    ]).then(([st, te, su, se, act]) => {
      setStats({
        students: st.data.count || 0,
        teachers: te.data.count || 0,
        subjects: su.data.subjects?.length || 0,
        sessions: se.data.count || 0,
      });
      setSubjects(su.data.subjects || []);
      setRecentSessions(se.data.sessions?.slice(0, 6) || []);
      // Fetched separately (not just top-6-recent) so an old/stray session
      // that's still active never scrolls out of view.
      setActiveSessions(act.data.sessions || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardLoading />;

  const statConfigs = [
    { key: 'students', label: 'Students', icon: 'users', accent: 'blue', value: stats.students },
    { key: 'teachers', label: 'Teachers', icon: 'users', accent: 'emerald', value: stats.teachers },
    { key: 'subjects', label: 'Subjects', icon: 'book', accent: 'amber', value: stats.subjects },
    { key: 'sessions', label: 'Sessions', icon: 'clipboard', accent: 'purple', value: stats.sessions },
  ];

  const greeting = getAdminGreeting(getBangladeshHour(now));

  return (
    <DashboardPage>
      <DashboardHero
        greeting={greeting.text}
        name={adminName || 'Admin'}
        subtitle="Admin"
        subtitleColor="text-indigo-300"
        rightSlot={<DashboardClock now={now} />}
      />

      <StatGrid>
        {statConfigs.map((c, i) => (
          <StatCard key={c.key} index={i} icon={c.icon} label={c.label} value={<AnimatedNumber value={c.value} />} accent={c.accent} />
        ))}
      </StatGrid>

      <SubjectOverview subjects={subjects} title="Subject Overview" limit={6} />

      <AnimatePresence>
        {activeSessions.length > 0 && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <SectionHeader title={`Currently Active Sessions (${activeSessions.length})`} />
            <div className="space-y-2 mb-2">
              {activeSessions.map((s, i) => (
                <motion.div
                  key={s._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.3) }}
                  className="flex items-center gap-3 rounded-xl bg-[#12141A] px-4 py-3"
                >
                  <span className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                    <Icon name="clipboard" size={14} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{sessionTitle(s)}</div>
                    <div className="text-xs text-slate-500 truncate">{sessionSubtitle(s)}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-sm font-semibold text-white tabular-nums">{s.presentCount}/{s.totalStudents}</div>
                    <button
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 transition-colors disabled:opacity-50"
                      disabled={endingId === s._id}
                      onClick={() => handleEndSession(s._id)}
                    >
                      {endingId === s._id ? '...' : 'End'}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <section>
        <SectionHeader title="Recent Sessions" />
        {recentSessions.length === 0 ? (
          <EmptyState icon="clipboard" text="No sessions yet" />
        ) : (
          <div className="space-y-2">
            {recentSessions.map((s, i) => (
              <ListRow
                key={s._id}
                index={i}
                icon="clipboard"
                iconAccent="emerald"
                title={sessionTitle(s)}
                subtitle={sessionSubtitle(s)}
                trailing={
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-semibold text-white tabular-nums">{s.presentCount}/{s.totalStudents}</div>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        s.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-white/[0.05] text-slate-500'
                      }`}>
                        {s.status === 'active' && <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-400">
                          <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping" />
                        </span>}
                        {s.status}
                      </span>
                    </div>
                    {s.status === 'active' && (
                      <button
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 transition-colors disabled:opacity-50"
                        disabled={endingId === s._id}
                        onClick={() => handleEndSession(s._id)}
                        title="Close a stuck / test session"
                      >
                        {endingId === s._id ? '...' : 'End'}
                      </button>
                    )}
                  </div>
                }
              />
            ))}
          </div>
        )}
      </section>
    </DashboardPage>
  );
}
