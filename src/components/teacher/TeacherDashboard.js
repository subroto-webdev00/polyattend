'use client';
import React, { useState, useEffect, useCallback } from 'react';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import { useAuth } from '@/context/AuthContext';
import { formatDepartment, formatShift, formatSubject } from '@/lib/display';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import {
  DashboardPage, DashboardLoading, DashboardHeader,
  StatGrid, StatCard, CardGlyph, ProgressRing,
  Panel, EmptyState, SubjectCard, SessionTable,
  StatusPill, QuickActions, ViewAll, AreaChart, ClassRow,
} from '@/components/common/DashboardKit';
import NoticeBoard from '@/components/common/NoticeBoard';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateNice(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// Today's own class only counts as missed once it's past this hour — it could
// still happen later today. Same cutoff used everywhere else in the app.
const TODAY_CUTOFF_HOUR = 19;

export default function TeacherDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  // This Teacher's own missed classes over the last 7 days, so they can
  // retake a class they missed with the Attendance saved under the day it was
  // actually missed — not today.
  const [missedEntries, setMissedEntries] = useState([]);
  const [missedLoading, setMissedLoading] = useState(true);
  const [coveringKey, setCoveringKey] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/sessions?status=ended'),
      api.get('/subjects'),
    ]).then(([sess, subs]) => {
      setSessions(sess.data.sessions?.slice(0, 5) || []);
      setSubjects(subs.data.subjects || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const includeToday = now.getHours() >= TODAY_CUTOFF_HOUR;

  const loadMissed = useCallback(() => {
    setMissedLoading(true);
    api.get('/reports/missed-sessions', { params: { asOfDate: todayISO(), includeToday } })
      .then(r => setMissedEntries(r.data.missed || []))
      .catch(() => {})
      .finally(() => setMissedLoading(false));
  }, [includeToday]);

  useEffect(() => { loadMissed(); }, [loadMissed]);

  const retakeMissedClass = async (entry) => {
    const key = `${entry.subjectId}_${entry.date}`;
    setCoveringKey(key);
    try {
      await api.post('/sessions', {
        subjectId: entry.subjectId,
        semester: entry.semester,
        section: entry.section,
        date: entry.date,
      });
      toast.success(`Starting attendance for ${formatDateNice(entry.date)}`);
      router.push('/teacher/attendance');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Problem starting Session');
      setCoveringKey(null);
    }
  };

  if (loading) return <DashboardLoading />;

  const totalPresent = sessions.reduce((s, r) => s + (r.presentCount || 0), 0);
  const totalStudents = sessions.reduce((s, r) => s + (r.totalStudents || 0), 0);
  const avgAtt = totalStudents ? Math.round((totalPresent / totalStudents) * 100) : 0;

  // Same 7-day series as the Admin dashboard, built from this Teacher's own
  // sessions so the trend reflects their classes and nobody else's.
  const weekSeries = (() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toDateString();
      const own = sessions.filter((s) => s.date && new Date(s.date).toDateString() === key);
      const present = own.reduce((s, x) => s + (x.presentCount || 0), 0);
      const total = own.reduce((s, x) => s + (x.totalStudents || 0), 0);
      days.push({
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        value: total ? Math.round((present / total) * 100) : null,
      });
    }
    // A day with no Session stays null. Carrying the previous day's rate across
    // it invented data: a day with no class looked identical to a day where
    // every student was absent. AreaChart draws a break instead.
    return days;
  })();

  const todayClasses = sessions
    .filter((s) => s.date && new Date(s.date).toDateString() === new Date().toDateString())
    .slice(0, 6);

  // The Teacher's own scope, read off their account rather than inferred from
  // the subjects below. A Teacher can hold Subjects in more than one
  // Department in principle, so "which department am I in" has a single
  // truthful answer and it lives on the user row.
  const department = formatDepartment(user?.departmentId, user?.departmentCode);
  const shiftLabel = formatShift(user?.shift) ? `${formatShift(user.shift)} Shift` : 'Not assigned';

  const statConfigs = [
    { key: 'classes', label: 'My Classes', icon: 'calendar', accent: 'blue', value: String(sessions.length), art: <CardGlyph name="calendar" /> },
    { key: 'students', label: 'My Students', icon: 'users', accent: 'emerald', value: String(totalStudents), art: <CardGlyph name="users" /> },
    { key: 'rate', label: 'Attendance Rate', icon: 'chart', accent: 'purple', value: `${avgAtt}%`, art: <ProgressRing percent={avgAtt} /> },
    { key: 'present', label: 'Total Present', icon: 'check', accent: 'amber', value: String(totalPresent), art: <CardGlyph name="check" /> },
  ];

  return (
    <DashboardPage>
      <DashboardHeader
        greeting={greeting()}
        name={user?.name}
        subtitle="Here's your class and attendance overview for today."
        now={now}
        chips={[
          { icon: 'department', label: 'Department', value: department || 'Not assigned' },
          { icon: 'clock', label: 'Shift', value: shiftLabel },
        ]}
      />

      <StatGrid>
        {statConfigs.map((c, i) => (
          <StatCard
            key={c.key}
            index={i}
            icon={c.icon}
            label={c.label}
            value={c.value}
            accent={c.accent}
            illustration={c.art}
          />
        ))}
      </StatGrid>

      {!missedLoading && missedEntries.length > 0 && (
        <Panel title="Missed Classes" icon="clock" iconAccent="amber" subtitle="Last 7 days">
          <div className="divide-y divide-slate-100">
            {missedEntries.map((entry) => {
              const key = `${entry.subjectId}_${entry.date}`;
              return (
                <div key={key} className="flex items-center gap-3 py-3">
                  <span className="w-9 h-9 rounded-full bg-amber-50 text-amber-600 grid place-items-center shrink-0">
                    <Icon name="alert" size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-bold text-slate-800 truncate">
                      {entry.subjectName} — Group {entry.section}
                    </div>
                    <div className="text-[11.5px] text-slate-500">{formatDateNice(entry.date)}</div>
                  </div>
                  <button
                    onClick={() => retakeMissedClass(entry)}
                    disabled={coveringKey === key}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-white hover:bg-amber-50 border border-amber-300 disabled:opacity-50 text-amber-700 text-[12px] font-bold px-3 py-2 transition-colors"
                  >
                    {coveringKey === key ? <div className="spinner spinner-sm" /> : <Icon name="play" size={12} />}
                    Retake This Class
                  </button>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Panel
          className="xl:col-span-2"
          title="Attendance Overview"
          icon="chart"
          subtitle="Last 7 days attendance rate"
        >
          <AreaChart data={weekSeries} />
        </Panel>

        <Panel
          title="Today's Classes"
          icon="calendar"
          // Class Report is where the full list of classes taken lives, with
          // subject, department, shift and time. /teacher/sessions is the
          // teacher's own session history, which is not the same thing.
          action={<ViewAll onClick={() => router.push('/teacher/class-report')}>View All</ViewAll>}
        >
          {todayClasses.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="No classes today"
              text="Start a session to take attendance."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {todayClasses.map((s, i) => (
                <ClassRow
                  key={s._id}
                  index={i}
                  time={new Date(s.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  title={formatSubject(s.subjectId)}
                  subtitle={[
                    formatDepartment(s.departmentId, s.departmentCode),
                    `Sem ${s.semester}`,
                    `Group ${s.section}`,
                  ].filter(Boolean).join(' • ')}
                  status={s.status === 'active' ? 'ongoing' : 'upcoming'}
                  statusLabel={s.status === 'active' ? 'Ongoing' : 'Upcoming'}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>

      {subjects.length > 0 && (
        <Panel
          title="My Subjects"
          icon="book"
          action={<ViewAll onClick={() => router.push('/teacher/subjects')}>View All Subjects</ViewAll>}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {subjects.slice(0, 4).map((s, i) => (
              <SubjectCard
                key={s._id || s.id || i}
                subject={s}
                index={i}
                footer={
                  <span className="inline-flex items-center gap-1">
                    <Icon name="users" size={12} /> {s.teacherId?.name || user?.name}
                  </span>
                }
              />
            ))}
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Panel
          className="xl:col-span-2"
          title="Recent Sessions"
          icon="clock"
          bodyClassName="px-2 pb-3"
        >
          <SessionTable
            columns={['#', 'Subject', 'Class', 'Group', 'Shift', 'Date & Time', 'Status']}
            rows={sessions.map((s, i) => ({
              '#': i + 1,
              Subject: formatSubject(s.subjectId),
              Class: `Sem ${s.semester}`,
              Group: s.section || '—',
              Shift: formatShift(s.shift || s.subjectId?.shift) || '—',
              'Date & Time': s.date ? new Date(s.date).toLocaleString('en-US') : '—',
              Status: <StatusPill status={s.status} />,
            }))}
          />
        </Panel>

        <QuickActions
          actions={[
            { icon: 'check', label: 'Take Attendance', accent: 'emerald', onClick: () => router.push('/teacher/attendance') },
            { icon: 'users', label: 'View Students', accent: 'blue', onClick: () => router.push('/teacher/students') },
            { icon: 'chart', label: 'View Reports', accent: 'purple', onClick: () => router.push('/teacher/reports') },
            { icon: 'book', label: 'Session History', accent: 'amber', onClick: () => router.push('/teacher/sessions') },
          ]}
        />
      </div>

      <NoticeBoard />
    </DashboardPage>
  );
}
