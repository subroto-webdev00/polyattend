'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/utils/api';
import { useAuth } from '@/context/AuthContext';
import { formatDepartment, formatShift } from '@/lib/display';
import {
  DashboardPage, DashboardLoading, DashboardHeader,
  StatGrid, StatCard, CardGlyph,
  Panel, ListRow, EmptyState, ViewAll, QuickActions, SubjectOverview, AreaChart,
} from '@/components/common/DashboardKit';

const ALL_SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export default function DepartmentAdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({ teachers: 0, students: 0, pendingStudents: 0 });
  const [subjects, setSubjects] = useState([]);
  const [validation, setValidation] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    // PERFORMANCE: the full teacher and student lists are never downloaded just
    // to read a count — `countOnly` runs a plain database count instead.
    // Pending Validation is fetched once per granted Semester (the endpoint
    // keeps each Semester's queue strictly separate) and summed here.
    Promise.all([
      api.get('/users', { params: { role: 'teacher', countOnly: true } }),
      api.get('/users', { params: { role: 'student', countOnly: true } }),
      Promise.all(ALL_SEMESTERS.map(sem => api.get('/departmentAdmin/students', { params: { semester: sem } }))),
      api.get('/subjects').catch(() => ({ data: { subjects: [] } })),
      api.get('/sessions').catch(() => ({ data: { sessions: [] } })),
    ]).then(([t, st, preResults, subs, sess]) => {
      const all = preResults.flatMap(r => (r.data.entries || []).map(e => ({
        ...e, semester: r.data.semester ?? e.semester,
      })));
      setValidation(
        all.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 6),
      );
      setStats({
        teachers: t.data.count || 0,
        students: st.data.count || 0,
        pendingStudents: all.filter(e => !e.used).length,
      });
      setSubjects(subs.data.subjects || []);
      setSessions(sess.data.sessions || []);
    }).catch((error) => {
      console.error('Could not load Department Admin dashboard', error);
    }).finally(() => setLoading(false));
  }, [user]);

  if (loading) return <DashboardLoading />;

  const granted = user?.semesters?.length ? user.semesters : (user?.semester ? [user.semester] : []);

  // 7-day attendance series, from this department's own sessions.
  const weekSeries = (() => {
    const overall = (() => {
      const p = sessions.reduce((s, x) => s + (x.presentCount || 0), 0);
      const t = sessions.reduce((s, x) => s + (x.totalStudents || 0), 0);
      return t ? Math.round((p / t) * 100) : 0;
    })();
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
    let last = overall;
    return days.map((d) => {
      if (d.value == null) return { ...d, value: last };
      last = d.value;
      return d;
    });
  })();

  const statConfigs = [
    { key: 'teachers', label: 'Teachers', icon: 'school', accent: 'blue', value: String(stats.teachers), art: <CardGlyph name="school" /> },
    { key: 'students', label: 'Students', icon: 'users', accent: 'emerald', value: String(stats.students), art: <CardGlyph name="users" /> },
    { key: 'pending', label: 'Pending Validation', icon: 'shield', accent: 'amber', value: String(stats.pendingStudents), art: <CardGlyph name="clipboard" /> },
  ];

  return (
    <DashboardPage>
      <DashboardHeader
        greeting={greeting()}
        name={user?.name}
        subtitle={[
          formatDepartment(user?.departmentId, user?.departmentCode) || 'No Department',
          formatShift(user?.shift) ? `${formatShift(user.shift)} Shift` : '',
        ].filter(Boolean).join(' • ')}
        now={now}
      />

      <div className="flex flex-wrap gap-1.5">
        {ALL_SEMESTERS.map(sem => (
          <span
            key={sem}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
              granted.includes(sem)
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-400 border-slate-200'
            }`}
          >
            Semester {sem}
          </span>
        ))}
      </div>

      <StatGrid cols={3}>
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Panel
          className="xl:col-span-2"
          title="Attendance Overview"
          icon="chart"
          subtitle="Last 7 days attendance rate"
        >
          <AreaChart data={weekSeries} />
        </Panel>

        <QuickActions
          actions={[
            { icon: 'school', label: 'Teacher Management', accent: 'blue', onClick: () => router.push('/departmentAdmin/teachers') },
            { icon: 'check', label: 'Student Validation', accent: 'emerald', onClick: () => router.push('/departmentAdmin/students') },
            { icon: 'chevronRight', label: 'Semester Promotion', accent: 'purple', onClick: () => router.push('/departmentAdmin/promotion') },
            { icon: 'chart', label: 'Reports', accent: 'amber', onClick: () => router.push('/departmentAdmin/reports') },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Panel
          className="xl:col-span-2"
          title="Student Validation Activity"
          icon="clipboard"
          action={<ViewAll onClick={() => router.push('/departmentAdmin/students')}>View All</ViewAll>}
        >
          {validation.length === 0 ? (
            <EmptyState
              icon="check"
              title="No validation activity yet"
              text="Pre-approved students will show up here once you approve them."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {validation.map((e, i) => (
                <ListRow
                  key={e._id || e.id || i}
                  index={i}
                  icon="users"
                  iconAccent={e.used ? 'emerald' : 'amber'}
                  title={e.name}
                  subtitle={`Sem ${e.semester} • Group ${e.section || '—'}`}
                  trailing={<RelativeTime value={e.createdAt} />}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Semester Coverage" icon="book">
          <div className="space-y-2.5">
            {ALL_SEMESTERS.map(sem => {
              const count = subjects.filter(s => s.semester === sem).length;
              const pct = Math.round((count / Math.max(subjects.length, 1)) * 100);
              return (
                <div key={sem} className="flex items-center gap-2.5">
                  <span className="text-[11px] font-bold text-slate-500 w-12 shrink-0">Sem {sem}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 tabular-nums w-6 text-right shrink-0">{count}</span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <SubjectOverview
        subjects={subjects}
        title="My Scope Subjects"
        limit={4}
        action={<ViewAll onClick={() => router.push('/departmentAdmin/teachers')}>View All Subjects</ViewAll>}
      />
    </DashboardPage>
  );
}

function RelativeTime({ value }) {
  if (!value) return null;
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return null;
  const mins = Math.max(0, Math.round((Date.now() - then.getTime()) / 60000));
  let text;
  if (mins < 1) text = 'just now';
  else if (mins < 60) text = `${mins} min ago`;
  else if (mins < 60 * 24) text = `${Math.round(mins / 60)} hours ago`;
  else text = `${Math.round(mins / (60 * 24))} days ago`;
  return <span className="text-[11px] text-slate-400 whitespace-nowrap">{text}</span>;
}
