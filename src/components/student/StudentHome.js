'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import { useAuth } from '@/context/AuthContext';
import { formatDepartment, formatShift, formatSubject } from '@/lib/display';
import SessionCheckIn from './SessionCheckIn';
import {
  DashboardPage, DashboardLoading, DashboardHeader,
  StatGrid, StatCard, CardGlyph, ProgressRing,
  Panel, EmptyState, QuickActions, ViewAll, MetaChip,
} from '@/components/common/DashboardKit';
import NoticeBoard from '@/components/common/NoticeBoard';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export default function StudentHome() {
  const { user } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState(null);
  const [threshold, setThreshold] = useState(70);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

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

  if (loading) return <DashboardLoading />;

  const overall = summary?.overall || {};
  // The threshold is admin-configurable (default 70%) — the same number used
  // for the per-subject "exam eligibility" warning below.
  const lowAtt = summary?.summary?.filter(s => s.percentage < threshold) || [];
  const subjects = summary?.summary || [];
  const rate = overall.percentage || 0;

  const statConfigs = [
    {
      key: 'att', label: 'My Attendance', icon: 'chart', accent: 'blue',
      value: `${rate}%`, art: <ProgressRing percent={rate} />,
    },
    {
      key: 'classes', label: 'My Classes', icon: 'calendar', accent: 'purple',
      value: String(summary?.classesTaken ?? subjects.length ?? 0),
      art: <CardGlyph name="calendar" />,
    },
    {
      key: 'subjects', label: 'My Subjects', icon: 'book', accent: 'emerald',
      value: String(subjects.length),
      art: <CardGlyph name="book" />,
    },
    {
      key: 'low', label: `Below ${threshold}%`, icon: 'alert', accent: 'rose',
      value: String(lowAtt.length),
      art: <CardGlyph name="alert" />,
    },
  ];

  return (
    <DashboardPage>
      {/* Auto-appears the moment a teacher starts a session for this class */}
      <SessionCheckIn />

      <DashboardHeader
        greeting={greeting()}
        name={user?.name}
        subtitle="Keep going! Your attendance and performance are on track."
        now={now}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-bold text-slate-400 mr-1">My Details</span>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg border bg-white text-slate-600 border-slate-200">
          Roll: {user?.studentId || '—'}
        </span>
        <MetaChip kind="dept" value={formatDepartment(user?.departmentId, user?.departmentCode)} />
        <MetaChip kind="sem" value={user?.semester} />
        <MetaChip kind="group" value={user?.section} />
        {formatShift(user?.shift) && <MetaChip kind="shift" value={`${formatShift(user.shift)} Shift`} />}
      </div>

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

      {lowAtt.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Icon name="alert" size={17} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[12.5px] text-amber-800 leading-relaxed">
            <strong>{lowAtt.length} subject(s)</strong> have attendance below {threshold}% — you cannot sit
            for the exam in these subjects. Attend class now!
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Panel
          className="xl:col-span-2"
          title="Subject-wise Attendance"
          icon="book"
          action={<ViewAll onClick={() => router.push('/student/attendance')}>View All</ViewAll>}
          bodyClassName="px-2 pb-3"
        >
          {subjects.length === 0 ? (
            <EmptyState
              icon="book"
              title="No attendance records yet"
              text="Once a Teacher marks a class for you, your attendance will show up here."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {subjects.map((s, i) => {
                const pct = s.percentage;
                const fill = pct >= 75 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-rose-500';
                const text = pct >= 75 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-rose-600';
                const ineligible = pct < threshold;
                const shift = formatShift(s.subject?.shift);

                return (
                  <div key={i} className="px-2 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="text-[13.5px] font-bold text-slate-800 truncate">
                        {formatSubject(s.subject)}
                      </span>
                      <span className={`ml-auto text-[12px] font-bold tabular-nums shrink-0 ${text}`}>
                        {s.present}/{s.total} ({pct}%)
                      </span>
                    </div>

                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-2">
                      <div className={`h-full rounded-full ${fill} transition-all`} style={{ width: `${pct}%` }} />
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <MetaChip kind="sem" value={s.subject?.semester || s.semester} />
                      <MetaChip kind="group" value={s.subject?.section} />
                      {shift && <MetaChip kind="shift" value={`${shift} Shift`} />}
                      <span className="text-[11px] text-slate-500">
                        {s.present} present, {s.absent} absent
                      </span>
                    </div>

                    {/* FEATURE: exam-eligibility warning, threshold set by admin */}
                    {ineligible && (
                      <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1.5 text-[11.5px] font-semibold">
                        <Icon name="alert" size={13} />
                        You cannot sit for the exam in this subject, attendance {pct}%
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <div className="space-y-5">
          <QuickActions
            actions={[
              { icon: 'chart', label: 'My Attendance', accent: 'blue', onClick: () => router.push('/student/attendance') },
              { icon: 'users', label: 'My Teachers', accent: 'emerald', onClick: () => router.push('/student/subjects') },
              { icon: 'excel', label: 'Download Report', accent: 'purple', onClick: () => router.push('/student/report') },
              { icon: 'id', label: 'My Profile', accent: 'cyan', onClick: () => router.push('/student') },
            ]}
          />

          <Panel title="Attendance Summary" icon="info">
            <div className="space-y-2.5 text-[12.5px]">
              {[
                ['Overall attendance', `${rate}%`],
                ['Total classes', String(summary?.classesTaken ?? subjects.length)],
                ['Classes present', String(overall.present ?? 0)],
                ['Classes absent', String(overall.absent ?? 0)],
                ['Subjects below ' + threshold + '%', String(lowAtt.length)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">{k}</span>
                  <span className="font-bold text-slate-800 tabular-nums">{v}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <NoticeBoard />
    </DashboardPage>
  );
}
