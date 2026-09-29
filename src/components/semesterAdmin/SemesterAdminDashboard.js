'use client';
import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import { useAuth } from '@/context/AuthContext';
import { formatDepartment, formatShift } from '@/lib/display';
import {
  DashboardPage, DashboardLoading, DashboardHero, DashboardClock,
  StatGrid, StatCard, SubjectOverview,
} from '@/components/common/DashboardKit';

/* ------------------------------------------------------------------ */
/*  All data-fetching / business logic below is unchanged from the     */
/*  original component — only markup + styling has been redesigned    */
/*  to match Teacher Dashboard's dark theme via the shared DashboardKit.*/
/* ------------------------------------------------------------------ */

export default function SemesterAdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ teachers: 0, students: 0, pendingStudents: 0 });
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    const allowedSemesters = user.semesters && user.semesters.length ? user.semesters : (user.semester ? [user.semester] : []);
    // PERFORMANCE: previously fetched the full teacher and student lists
    // just to read `.count` off the response — downloading every one of
    // this Department Admin's students on every dashboard load. `countOnly`
    // returns just the number, no documents.
    //
    // DEPARTMENT-WIDE ADMIN: Pending Validation is fetched once PER granted
    // Semester (the endpoint itself keeps each Semester's queue strictly
    // separate — see /api/semesterAdmin/students) and summed here just for
    // this one dashboard total.
    Promise.all([
      api.get('/users', { params: { role: 'teacher', countOnly: true } }),
      api.get('/users', { params: { role: 'student', countOnly: true } }),
      Promise.all(allowedSemesters.map(sem => api.get('/semesterAdmin/students', { params: { semester: sem } }))),
       api.get('/subjects').catch(() => ({ data: { subjects: [] } })),
    ]).then(([t, st, preResults, subs]) => {
      const pendingCount = preResults.reduce((sum, r) => sum + (r.data.entries || []).filter(e => !e.used).length, 0);
      setStats({
        teachers: t.data.count || 0,
        students: st.data.count || 0,
        pendingStudents: pendingCount,
      });
      setSubjects(subs.data.subjects || []);
    }).catch((error) => {
      console.error('Could not load Department Admin dashboard', error);
    }).finally(() => setLoading(false));
  }, [user]);

  if (loading) return <DashboardLoading />;


  const grantedSemesters = user?.semesters && user.semesters.length ? user.semesters : (user?.semester ? [user.semester] : []);
  const badges = [
    formatDepartment(user?.departmentId, user?.departmentCode),
    formatShift(user?.shift) ? `${formatShift(user.shift)} Shift` : '',
    ...grantedSemesters.map(sem => `Semester ${sem}`),
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
        <StatCard index={0} icon="school" label="Teacher" value={stats.teachers} accent="emerald" />
        <StatCard index={1} icon="users" label="Student" value={stats.students} accent="amber" />
        <StatCard index={2} icon="clipboard" label="Pending Validation" value={stats.pendingStudents} accent="blue" />
      </StatGrid>

      <SubjectOverview subjects={subjects} title="My Scope Subjects" limit={6} />
    </DashboardPage>
  );
}
