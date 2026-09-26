'use client';
import React, { useState, useEffect, useCallback } from 'react';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import { useAuth } from '@/context/AuthContext';
import { formatDepartment, formatShift, formatSubject } from '@/lib/display';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

/* ------------------------------------------------------------------ */
/*  NOTE: All data-fetching, state, and business logic below is       */
/*  UNCHANGED from the original component. Only markup + styling      */
/*  (Tailwind utility classes + framer-motion) has been redesigned.   */
/* ------------------------------------------------------------------ */

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateNice(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// TODAY CUTOFF — same rule used everywhere else Missed Classes are shown:
// today's own class only counts as missed once it's past 7:00 PM local
// time (it could still happen later today).
const TODAY_CUTOFF_HOUR = 19;

export default function TeacherDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  // MISSED CLASSES — this Teacher's own missed classes over the last 7
  // days (see /api/reports/missed-sessions). Lets them retake/cover a
  // class they missed themselves, with the Attendance correctly saved
  // under the day it was actually missed — not today.
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

  // purely presentational clock — does not touch fetched data
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const includeToday = now.getHours() >= TODAY_CUTOFF_HOUR;

  const loadMissed = useCallback(() => {
    setMissedLoading(true);
    api.get('/reports/missed-sessions', { params: { asOfDate: todayISO(), includeToday } })
      .then(r => setMissedEntries(r.data.missed || []))
      .catch(() => { })
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
      toast.success(`Starting attendance for ${formatDateNice(entry.date)}…`);
      router.push('/teacher/attendance');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Problem starting Session');
      setCoveringKey(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 bg-transparent">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-[#1C3A2B]" />
          <div className="absolute inset-0 rounded-full border-2 border-t-indigo-400 animate-spin" />
        </div>
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    );
  }

  const totalPresent = sessions.reduce((s, r) => s + (r.presentCount || 0), 0);
  const totalStudents = sessions.reduce((s, r) => s + (r.totalStudents || 0), 0);
  const avgAtt = totalStudents ? Math.round(totalPresent / totalStudents * 100) : 0;

  const firstName = user?.name?.split(' ')[0] || '';

  const dateStr = now.toLocaleDateString('en-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' });
  const departmentDisplay = formatDepartment(
    user?.departmentId?.name ? user.departmentId : user?.department,
    user?.departmentCode
  );
  const subjectChips = subjects.flatMap(subject => [
    {
      id: `subject-${subject._id || subject.id}`,
      text: formatSubject(subject),
      tone: 'text-indigo-300',
    },
    {
      id: `group-${subject._id || subject.id}`,
      text: `Group ${subject.section}`,
      tone: 'text-amber-300',
    },
  ]);
  const scopeChips = [
    { id: 'department', text: departmentDisplay, tone: 'text-blue-300' },
    { id: 'semester', text: user?.semester ? `Semester ${user.semester}` : '', tone: 'text-emerald-300' },
    { id: 'shift', text: formatShift(user?.shift) ? `${formatShift(user.shift)} Shift` : '', tone: 'text-purple-300' },
  ].filter(chip => chip.text);

  return (
    <div className="min-h-screen bg-transparent text-slate-200 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="space-y-8">

        {/* ---------------- HERO ---------------- */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative overflow-hidden rounded-2xl bg-[#0D2419]/70 p-6 sm:p-8"
        >
          {/* subtle animated gradient accent */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, #6366F1 0%, transparent 70%)' }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-16 w-64 h-64 rounded-full opacity-10 blur-3xl"
            style={{ background: 'radial-gradient(circle, #10B981 0%, transparent 70%)' }}
          />

          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl font-semibold text-white shrink-0 shadow-lg shadow-indigo-950/40">
                {firstName.charAt(0).toUpperCase() || 'T'}
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
                  {firstName}
                </h1>
                {subjectChips.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                     {subjectChips.map(chip => (
                       <span key={chip.id} className={`text-xs font-medium border border-[#303747] rounded-md px-2 py-1 leading-4 ${chip.tone}`}>
                         {chip.text}
                       </span>
                     ))}
                   </div>
                ) : (
                  <p className="text-sm text-slate-400 mt-1">Which class will you take today?</p>
                )}
                {scopeChips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {scopeChips.map(chip => (
                       <span key={chip.id} className={`text-xs font-medium border border-[#303747] rounded-md px-2 py-1 leading-4 ${chip.tone}`}>
                         {chip.text}
                       </span>
                     ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex sm:flex-col items-start sm:items-end gap-1 shrink-0">
              <span className="text-xs text-slate-500">{dateStr}</span>
              <span className="text-lg font-medium text-slate-200 tabular-nums">{timeStr}</span>
            </div>
          </div>
        </motion.div>

        {/* ---------------- MISSED CLASSES ---------------- */}
        {!missedLoading && missedEntries.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Icon name="clock" size={15} className="text-amber-400" />
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Missed Classes</h2>
              <span className="text-xs text-slate-500">(last 7 days)</span>
            </div>
            <div className="rounded-2xl bg-amber-500/[0.04] divide-y divide-[#1C3A2B] overflow-hidden">
              {missedEntries.map(entry => {
                const key = `${entry.subjectId}_${entry.date}`;
                return (
                  <div key={key} className="flex items-center gap-4 px-5 py-4 flex-wrap">
                    <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Icon name="alert" size={16} className="text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">
                        {entry.subjectName} — Group {entry.section}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{formatDateNice(entry.date)}</p>
                    </div>
                    <button
                      onClick={() => retakeMissedClass(entry)}
                      disabled={coveringKey === key}
                      className="shrink-0 flex items-center gap-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 disabled:opacity-50 text-amber-300 text-xs font-semibold px-3 py-2 transition-colors"
                    >
                      {coveringKey === key ? <div className="spinner spinner-sm" /> : <Icon name="play" size={12} />}
                      Retake This Class
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* ---------------- STATS ---------------- */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            index={0}
            icon="clipboard"
            label="Sessions Taken"
            value={sessions.length}
            accent="blue"
          />
          <StatCard
            index={1}
            icon="chart"
            label="Avg Attendance"
            value={`${avgAtt}%`}
            accent="emerald"
          />
          <StatCard
            index={2}
            icon="users"
            label="Total Present"
            value={totalPresent}
            accent="amber"
          />
        </div>

        {/* ---------------- ASSIGNED SUBJECTS ---------------- */}
        {subjects.length > 0 && (
          <section>
            <div className="flex items-center justify-between gap-3 mb-4">
              <SectionHeader title="My Assigned Subjects" />
              <button
                type="button"
                onClick={() => router.push('/teacher/subjects')}
                className="text-xs font-semibold text-indigo-300 hover:text-indigo-200 transition-colors"
              >
                View all
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subjects.map((subject, index) => (
                <motion.div
                  key={subject._id || subject.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: index * 0.05 }}
                  className="rounded-2xl bg-[#0D2419]/70 p-4 sm:p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                      <Icon name="book" size={18} className="text-indigo-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white truncate">{subject.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{subject.code}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {formatDepartment(subject.departmentId, subject.departmentCode) ? (
                      <span className="rounded-full bg-blue-500/10 text-blue-300 border border-[#303747] px-2.5 py-1 text-[10px] font-semibold">
                        {formatDepartment(subject.departmentId, subject.departmentCode)}
                      </span>
                    ) : null}
                    <span className="rounded-full bg-emerald-500/10 text-emerald-300 border border-[#303747] px-2.5 py-1 text-[10px] font-semibold">
                      Sem {subject.semester}
                    </span>
                    <span className="rounded-full bg-amber-500/10 text-amber-300 border border-[#303747] px-2.5 py-1 text-[10px] font-semibold">
                      Group {subject.section}
                    </span>
                    {subject.shift ? (
                      <span className="rounded-full bg-purple-500/10 text-purple-300 border border-[#303747] px-2.5 py-1 text-[10px] font-semibold">
                        {formatShift(subject.shift)} Shift
                      </span>
                    ) : null}
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ---------------- RECENT SESSIONS ---------------- */}
        {sessions.length > 0 && (
          <section>
            <SectionHeader title="Recent Sessions" />
            <div className="rounded-2xl bg-[#0D2419]/70 divide-y divide-[#1C3A2B] overflow-hidden">
              {sessions.map((s, i) => {
                const pct = s.totalStudents ? Math.round(s.presentCount / s.totalStudents * 100) : 0;
                return (
                  <motion.div
                    key={s._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.2) }}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors duration-150"
                  >
                    <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <Icon name="check" size={16} className="text-emerald-400" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">
                        {formatSubject(s.subjectId)} — Sem {s.semester}, Group {s.section}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatDepartment(s.departmentId)} • {formatShift(s.shift || s.subjectId?.shift)} Shift • {new Date(s.date).toLocaleDateString('en-BD')}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-white tabular-nums">
                        {s.presentCount}/{s.totalStudents}
                      </p>
                      <p className={`text-xs mt-0.5 font-medium ${attendanceColor(pct)}`}>
                        {pct}%
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Presentational helpers only — no data logic                      */
/* ------------------------------------------------------------------ */

function attendanceColor(pct) {
  if (pct >= 85) return 'text-emerald-400';
  if (pct >= 60) return 'text-amber-400';
  return 'text-rose-400';
}

const ACCENTS = {
  indigo: { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', top: 'from-indigo-500' },
  blue: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', top: 'from-blue-500' },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', top: 'from-emerald-500' },
  amber: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', top: 'from-amber-500' },
  purple: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', top: 'from-purple-500' },
  rose: { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', top: 'from-rose-500' },
};

function StatCard({ icon, label, value, accent, index }) {
  const a = ACCENTS[accent] || ACCENTS.indigo;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ y: -2 }}
      className="relative overflow-hidden rounded-2xl bg-[#0D2419]/70 p-4 sm:p-5"
    >
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${a.top} to-transparent`} />
      <div className={`w-9 h-9 rounded-lg ${a.bg} flex items-center justify-center mb-3`}>
        <Icon name={icon} size={16} className={a.text} />
      </div>
      <div className="text-2xl font-semibold text-white tracking-tight tabular-nums">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </motion.div>
  );
}

function SectionHeader({ title }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">{title}</h2>
    </div>
  );
}