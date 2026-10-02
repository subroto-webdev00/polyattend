'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import { formatDepartment, formatShift, formatSubject } from '@/lib/display';
import {
  DashboardPage, DashboardLoading, DashboardHeader,
  StatGrid, StatCard, CardGlyph, ProgressRing,
  Panel, EmptyState, SubjectCard, SessionTable,
  StatusPill, QuickActions, ViewAll, RangeSelect, AreaChart, ClassRow,
} from '@/components/common/DashboardKit';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// Change between the current count and the count one month ago, rounded to one
// decimal. Returns null when there is no usable baseline (a fresh install, or
// a count that was zero a month ago) so the caller can leave the trend line
// out rather than print a number that isn't real.
function pctChange(current, previous) {
  if (!previous || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({ students: 0, teachers: 0, subjects: 0 });
  const [prev, setPrev] = useState({ students: 0, teachers: 0, subjects: 0 });
  const [subjects, setSubjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [adminName, setAdminName] = useState('');

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) setAdminName(JSON.parse(raw)?.name || '');
    } catch {
      // ignore — the greeting just falls back to a generic label
    }
  }, []);

  useEffect(() => {
    // A month ago, used only as the baseline for the "from last month" trend.
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    Promise.all([
      api.get('/users', { params: { role: 'student', countOnly: true } }),
      api.get('/users', { params: { role: 'teacher', countOnly: true } }),
      api.get('/users', { params: { role: 'student', countOnly: true, since: monthAgo.toISOString() } }),
      api.get('/users', { params: { role: 'teacher', countOnly: true, since: monthAgo.toISOString() } }),
      api.get('/subjects'),
      api.get('/sessions'),
    ])
      .then(([st, te, stNew, teNew, su, se]) => {
        const allSubjects = su.data.subjects || [];
        const subjectsNew = allSubjects.filter(
          s => s.createdAt && new Date(s.createdAt) >= monthAgo,
        ).length;

        setStats({
          students: st.data.count || 0,
          teachers: te.data.count || 0,
          subjects: allSubjects.length,
        });
        // The month-ago figure is the current count minus what arrived since.
        setPrev({
          students: Math.max(0, (st.data.count || 0) - (stNew.data.newCount || 0)),
          teachers: Math.max(0, (te.data.count || 0) - (teNew.data.newCount || 0)),
          subjects: Math.max(0, allSubjects.length - subjectsNew),
        });
        setSubjects(allSubjects);
        setSessions(se.data.sessions || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardLoading />;

  // ── Attendance rate per day, for the 7-day area chart ────────────────
  // Built from the sessions already in hand, so it is a real measurement
  // rather than a decorative curve. Days with no class carry the last known
  // rate forward, otherwise the line would break on every empty day.
  const rateAll = (() => {
    const p = sessions.reduce((s, x) => s + (x.presentCount || 0), 0);
    const t = sessions.reduce((s, x) => s + (x.totalStudents || 0), 0);
    return t ? Math.round((p / t) * 1000) / 10 : 0;
  })();

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
    let last = rateAll;
    return days.map((d) => {
      if (d.value == null) return { ...d, value: last };
      last = d.value;
      return d;
    });
  })();

  // Today's classes — anything that started today, most recent first.
  const todayClasses = sessions
    .filter((s) => s.date && new Date(s.date).toDateString() === new Date().toDateString())
    .slice(0, 6);

  const statConfigs = [
    {
      key: 'students', label: 'Students', icon: 'users', accent: 'blue',
      value: stats.students.toLocaleString(),
      trend: pctChange(stats.students, prev.students),
      art: <CardGlyph name="users" />,
    },
    {
      key: 'teachers', label: 'Teachers', icon: 'users', accent: 'purple',
      value: stats.teachers.toLocaleString(),
      trend: pctChange(stats.teachers, prev.teachers),
      art: <CardGlyph name="school" />,
    },
    {
      key: 'subjects', label: 'Subjects', icon: 'book', accent: 'amber',
      value: String(stats.subjects),
      trend: pctChange(stats.subjects, prev.subjects),
      art: <CardGlyph name="book" />,
    },
    {
      key: 'attendance', label: 'Attendance', icon: 'clipboard', accent: 'emerald',
      value: `${rateAll}%`,
      // Attendance has no month-over-month count, so no trend here — the
      // ProgressRing already carries the "how good is it" signal.
      art: <ProgressRing percent={rateAll} />,
    },
  ];

  return (
    <DashboardPage>
      <DashboardHeader
        greeting={greeting()}
        name={adminName || 'Admin'}
        subtitle="Here's what's happening in your PolyAttend system today."
        now={now}
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
            trend={c.trend}
            trendLabel="from last month"
          />
        ))}
      </StatGrid>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Panel
          className="xl:col-span-2"
          title="Attendance Overview"
          icon="clipboard"
          subtitle="Last 7 days attendance rate"
          action={<RangeSelect />}
        >
          <AreaChart data={weekSeries} />
        </Panel>

        <Panel
          title="Today's Classes"
          icon="calendar"
          // The panel lists today's classes, and Class Report is the page that
          // lists every class taken with its time — so that is where "View All"
          // belongs. It used to point at /admin/reports, which is a PDF/Excel
          // export screen with no class list on it at all.
          action={<ViewAll onClick={() => router.push('/admin/missed-classes')}>View All</ViewAll>}
        >
          {todayClasses.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="No classes today"
              text="Attendance sessions will appear here once a Teacher starts one."
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

      <Panel
        title="Subject Overview"
        icon="book"
        action={<ViewAll onClick={() => router.push('/admin/subjects')}>View All Subjects</ViewAll>}
      >
        {subjects.length === 0 ? (
          <EmptyState
            icon="book"
            title="No subjects yet"
            text="Subjects will appear here once you add them."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {subjects.slice(0, 4).map((s, i) => {
              // Teacher and student counts come from this subject's sessions —
              // the only per-subject numbers the app already stores.
              const mine = sessions.filter(
                (x) => (x.subjectId?._id || x.subjectId?.id) === (s._id || s.id),
              );
              const teachers = new Set(mine.map((x) => x.teacherId?.name).filter(Boolean)).size;
              const students = Math.max(0, ...mine.map((x) => x.totalStudents || 0));

              return (
                <SubjectCard
                  key={s._id || s.id || i}
                  subject={s}
                  index={i}
                  footer={
                    <>
                      <span className="inline-flex items-center gap-1">
                        <Icon name="users" size={12} /> {teachers} Teachers
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Icon name="id" size={12} /> {students} Students
                      </span>
                    </>
                  }
                />
              );
            })}
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Panel
          className="xl:col-span-2"
          title="Recent Sessions"
          icon="clock"
          bodyClassName="px-2 pb-3"
        >
          <SessionTable
            columns={['#', 'Subject', 'Class', 'Group', 'Shift', 'Date & Time', 'Status']}
            rows={sessions.slice(0, 6).map((s, i) => ({
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
            { icon: 'users', label: 'Add Teacher', accent: 'blue', onClick: () => router.push('/admin/teachers') },
            // Labelled "View Subject" because /admin/subjects is a read-only
            // list grouped by department: it has no create form, so "Add
            // Subject" sent you somewhere that cannot add one. Subjects are
            // created from Teacher Management -> Assign Subject, which needs a
            // teacher and a group to file them under.
            { icon: 'book', label: 'View Subject', accent: 'emerald', onClick: () => router.push('/admin/subjects') },
            { icon: 'excel', label: 'Generate Report', accent: 'purple', onClick: () => router.push('/admin/reports') },
            { icon: 'settings', label: 'Manage Users', accent: 'cyan', onClick: () => router.push('/admin/users') },
          ]}
        />
      </div>
    </DashboardPage>
  );
}
