'use client';
import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import { useAuth } from '@/context/AuthContext';
import { formatDepartment, formatShift } from '@/lib/display';
import {
  DashboardPage, DashboardLoading, DashboardHero, DashboardClock,
  StatGrid, StatCard, SectionHeader, EmptyState, ListRow, SubjectOverview,
} from '@/components/common/DashboardKit';

/* ------------------------------------------------------------------ */
/*  All data-fetching / business logic below is unchanged from the     */
/*  original component — only markup + styling has been redesigned    */
/*  to match Teacher Dashboard's dark theme via the shared DashboardKit.*/
/* ------------------------------------------------------------------ */

export default function SubAdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ semesterAdmins: 0, teachers: 0, students: 0 });
  const [subjects, setSubjects] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    // PERFORMANCE: the student count here only ever reads `.count` — it
    // never touches `st.data.users` below, unlike the semesterAdmin/teacher
    // calls (their user lists feed the "recent" list). So only the student
    // call needs to become `countOnly` — that's the one whose full roster
    // download was pure waste (and, with thousands of students, the
    // expensive one).
    Promise.all([
      api.get('/users', { params: { role: 'semesterAdmin', departmentId: user.departmentId?._id, shift: user.shift } }),
      api.get('/users', { params: { role: 'teacher', departmentId: user.departmentId?._id, shift: user.shift } }),
      api.get('/users', { params: { role: 'student', departmentId: user.departmentId?._id, shift: user.shift, countOnly: true } }),
       api.get('/subjects').catch(() => ({ data: { subjects: [] } })),
    ]).then(([sa, t, st, subs]) => {
      setStats({
        semesterAdmins: sa.data.count || 0,
        teachers: t.data.count || 0,
        students: st.data.count || 0,
      });
      setSubjects(subs.data.subjects || []);

      const merged = [
        ...(sa.data.users || sa.data.entries || []).map(u => ({ ...u, roleLabel: 'Semester Admin' })),
        ...(t.data.users || t.data.entries || []).map(u => ({ ...u, roleLabel: 'Teacher' })),
      ]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);
      setRecent(merged);
     }).catch((error) => {
       console.error('Could not load Department Admin dashboard', error);
    }).finally(() => setLoading(false));
  }, [user]);

  if (loading) return <DashboardLoading />;


  const badges = [
    formatDepartment(user?.departmentId, user?.departmentCode),
    formatShift(user?.shift) ? `${formatShift(user.shift)} Shift` : '',
  ].filter(Boolean);

  return (
    <DashboardPage>
      <DashboardHero

        name={user?.name}
        subtitle="Department Admin"
        subtitleColor="text-indigo-300"
        badges={badges}
        rightSlot={<DashboardClock now={now} />}
      />

      <StatGrid>
        <StatCard index={0} icon="users" label="Semester Admin" value={stats.semesterAdmins} accent="blue" />
        <StatCard index={1} icon="school" label="Teacher" value={stats.teachers} accent="emerald" />
        <StatCard index={2} icon="users" label="Student" value={stats.students} accent="amber" />
      </StatGrid>

      <SubjectOverview subjects={subjects} title="Department Subjects" limit={6} />

      <section>
        <SectionHeader title="Recently Added" />
        {recent.length === 0 ? (
          <EmptyState icon="users" text="No data yet" />
        ) : (
          <div className="space-y-2">
            {recent.map((u, i) => (
              <ListRow
                key={u._id}
                index={i}
                icon="check"
                iconAccent="emerald"
                title={u.name}
                subtitle={[
                  u.roleLabel,
                  formatDepartment(u.departmentId, u.departmentCode),
                  formatShift(u.shift) ? `${formatShift(u.shift)} Shift` : '',
                  u.semester ? `Semester ${u.semester}` : '',
                ].filter(Boolean).join(' • ')}
                trailing={
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB') : '-'}
                  </span>
                }
              />
            ))}
          </div>
        )}
      </section>
    </DashboardPage>
  );
}
