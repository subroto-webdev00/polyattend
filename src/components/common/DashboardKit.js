'use client';
import React from 'react';
import { motion } from 'framer-motion';
import Icon from './Icon';
import { formatDepartment, formatShift, formatSubject } from '@/lib/display';

// Shared building blocks for every role's Dashboard (home) page — Super
// Admin and Department Admin - so they both visually match Teacher
// Dashboard exactly (same dark palette, same hero/blob treatment, same
// StatCard, same motion timing) without each page re-implementing it.
export const ACCENTS = {
  indigo: { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', top: 'from-indigo-500' },
  blue: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', top: 'from-blue-500' },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', top: 'from-emerald-500' },
  amber: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', top: 'from-amber-500' },
  purple: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', top: 'from-purple-500' },
  rose: { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', top: 'from-rose-500' },
};

// Full-page loading state — identical to Teacher Dashboard's.
export function DashboardLoading() {
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

// Outer page wrapper — full-width + vertical rhythm.
// `max-w-7xl mx-auto` was removed: it capped the content at 1280px AND
// centred it, which left a large dead gap between the sidebar and the first
// card on a desktop monitor. Now the dashboard fills the content column and
// starts flush beside the sidebar, matching the `.page` wrapper.
export function DashboardPage({ children }) {
  return (
    <div className="min-h-screen bg-transparent text-slate-200 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="space-y-8">{children}</div>
    </div>
  );
}

// Hero card — avatar, name, subtitle line, optional scope chips
// (department/shift/semester), plus the animated gradient-blob accent.
// `badges` is an array of short strings shown as pill chips under the name
// (e.g. department name, shift, semester) — used by Semester
// Admin to show their scope, which Teacher's hero doesn't need.
// The old `greeting` prop was dropped: the top bar now shows the greeting
// on every page, so repeating it inside the hero was a duplicate.
export function DashboardHero({ name, subtitle, subtitleColor = 'text-slate-400', badges, rightSlot }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl border border-[#1C3A2B] bg-[#0D2419]/70 p-6 sm:p-8"
    >
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
            {initial}
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">{name}</h1>
            {subtitle && <p className={`text-sm ${subtitleColor} mt-1 font-medium`}>{subtitle}</p>}
            {badges && badges.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {badges.map((b, i) => (
                  <span key={i} className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/[0.05] border border-[#303747] text-slate-300">
                    {b}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        {rightSlot}
      </div>
    </motion.div>
  );
}

// Right-hand date/time block, as used in the hero on the right side.
export function DashboardClock({ now }) {
  const dateStr = now.toLocaleDateString('en-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="relative text-left sm:text-right shrink-0">
      <p className="text-sm text-slate-400">{dateStr}</p>
      <p className="text-lg font-semibold text-white tabular-nums">{timeStr}</p>
    </div>
  );
}

export function StatCard({ icon, label, value, accent, index = 0 }) {
  const a = ACCENTS[accent] || ACCENTS.indigo;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ y: -2 }}
      className="relative overflow-hidden rounded-2xl border border-[#1C3A2B] bg-[#0D2419]/70 p-4 sm:p-5"
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

export function StatGrid({ children }) {
  return <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{children}</div>;
}

export function SectionHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">{title}</h2>
      {action}
    </div>
  );
}

export function SubjectOverview({ subjects = [], title = 'Assigned Subjects', limit = 12 }) {
  const visible = subjects.slice(0, limit);
  if (visible.length === 0) return null;

  return (
    <section>
      <SectionHeader title={`${title} (${subjects.length})`} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {visible.map((subject, index) => (
          <motion.div
            key={subject._id || subject.id || `${subject.name}-${index}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.2) }}
            className="rounded-2xl border border-[#1C3A2B] bg-[#0D2419]/70 p-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <Icon name="book" size={16} className="text-amber-300" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{formatSubject(subject)}</p>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {formatDepartment(subject.departmentId, subject.departmentCode) || 'Department unavailable'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="rounded-full bg-emerald-500/10 text-emerald-300 border border-[#303747] px-2.5 py-1 text-[10px] font-semibold">Sem {subject.semester}</span>
              <span className="rounded-full bg-blue-500/10 text-blue-300 border border-[#303747] px-2.5 py-1 text-[10px] font-semibold">Group {subject.section}</span>
              {subject.shift ? <span className="rounded-full bg-purple-500/10 text-purple-300 border border-[#303747] px-2.5 py-1 text-[10px] font-semibold">{formatShift(subject.shift)} Shift</span> : null}
            </div>
            {subject.teacherId?.name ? (
              <p className="text-xs text-slate-500 mt-3">Teacher: {subject.teacherId.name}</p>
            ) : null}
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export function EmptyState({ icon = 'users', text }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#27523C] bg-[#0D2419]/60 p-10 flex flex-col items-center justify-center text-center">
      <div className="w-11 h-11 rounded-full bg-white/5 flex items-center justify-center mb-3">
        <Icon name={icon} size={20} className="text-slate-500" />
      </div>
      <p className="text-sm text-slate-500 max-w-sm">{text}</p>
    </div>
  );
}

// "Search by Roll" — a quick single-student lookup box for the
// Dashboard (home) page. Types a Roll, hits /api/users/lookup-by-roll
// (already scoped server-side to whichever admin is asking), and shows
// the student's Mobile Number + basic info inline.
export function RollLookup({ api }) {
  const [roll, setRoll] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    const trimmed = roll.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.get('/users/lookup-by-roll', { params: { roll: trimmed } });
      setResult(res.data.student);
    } catch (err) {
      setError(err.response?.data?.message || 'Not found');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="rounded-2xl border border-[#1C3A2B] bg-[#0D2419]/70 p-4 sm:p-5"
    >
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">Search by Roll</h2>
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={roll}
          onChange={e => { setRoll(e.target.value); setError(''); setResult(null); }}
          placeholder="e.g. 800768"
          className="flex-1 min-w-0 rounded-lg bg-white/[0.03] border border-[#1C3A2B] px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-indigo-500/50 transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !roll.trim()}
          className="shrink-0 rounded-lg bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-2"
        >
          <Icon name="search" size={14} />
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="mt-3 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#1C3A2B] bg-white/[0.02] px-4 py-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-semibold text-white shrink-0">
            {(result.name || '?').trim().charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">{result.name}</div>
            <div className="text-xs text-slate-500 truncate">
              Roll: {result.studentId} • {formatDepartment(result.departmentId, result.departmentCode) || '-'} • {formatShift(result.shift)} Shift • Sem {result.semester} • Group {result.section}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xs text-slate-500">Mobile</div>
            <div className="text-sm font-semibold text-emerald-400 tabular-nums">
              {result.mobile || <span className="text-slate-600 font-normal">Not provided</span>}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// A single row inside a "recent activity"-style list — icon bubble, name,
// subtitle, and a small trailing tag/date on the right.
export function ListRow({ icon = 'check', iconAccent = 'emerald', title, subtitle, trailing, index = 0 }) {
  const a = ACCENTS[iconAccent] || ACCENTS.emerald;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3) }}
      className="flex items-center gap-3 rounded-xl border border-[#1C3A2B] bg-[#0D2419]/70 px-4 py-3"
    >
      <span className={`w-8 h-8 rounded-full ${a.bg} ${a.text} flex items-center justify-center shrink-0`}>
        <Icon name={icon} size={14} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">{title}</div>
        {subtitle && <div className="text-xs text-slate-500 truncate">{subtitle}</div>}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </motion.div>
  );
}
