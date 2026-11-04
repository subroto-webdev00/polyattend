'use client';
import React from 'react';
import { motion } from 'framer-motion';
import Icon from './Icon';
import { formatDepartment, formatShift, formatSubject } from '@/lib/display';

// Shared building blocks for every role's Dashboard (home) page. One light
// surface language across Super Admin, Department Admin, Teacher and Student so
// the four dashboards read as the same product.
//
// Layout convention throughout, matching the reference design: a pale slate
// canvas, pure-white cards with a hairline border, a blue accent, and generous
// 24px gutters between panels.

export const ACCENTS = {
  blue: { text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', solid: 'bg-blue-600', soft: 'text-blue-50' },
  purple: { text: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', solid: 'bg-purple-600', soft: 'text-purple-50' },
  emerald: { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', solid: 'bg-emerald-600', soft: 'text-emerald-50' },
  amber: { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', solid: 'bg-amber-600', soft: 'text-amber-50' },
  rose: { text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', solid: 'bg-rose-600', soft: 'text-rose-50' },
  indigo: { text: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', solid: 'bg-indigo-600', soft: 'text-indigo-50' },
  cyan: { text: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200', solid: 'bg-cyan-600', soft: 'text-cyan-50' },
  teal: { text: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200', solid: 'bg-teal-600', soft: 'text-teal-50' },
};

// `overflow-hidden` is baked in here rather than added per-component: the stat
// cards and subject cards both place a decorative watermark, and anything that
// escapes a rounded corner looks like a rendering bug.
const CARD = 'bg-white rounded-2xl border border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden';

// ── Page shell ────────────────────────────────────────────────────────────
export function DashboardLoading() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
      <div className="relative w-11 h-11">
        <div className="absolute inset-0 rounded-full border-[3px] border-slate-200" />
        <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-blue-600 animate-spin" />
      </div>
      <p className="text-sm text-slate-500">Loading...</p>
    </div>
  );
}

export function DashboardPage({ children }) {
  return (
    <div className="px-5 sm:px-7 py-6">
      <div className="space-y-5 max-w-[1600px]">{children}</div>
    </div>
  );
}

// ── Header: greeting on the left, date + time on the right ────────────────
// Rendered as a card rather than bare text on the canvas. The greeting, the
// scope chips and the clock are all "context about right now", so they belong
// in one surface instead of floating above the stat tiles as loose headings.
//
// `chips` renders the signed-in person's own scope (department, shift,
// semester, …) directly under the subtitle, so they never have to open a
// profile page to confirm which department or shift they are looking at.
export function DashboardHeader({ greeting, subtitle, name, now, chips = [] }) {
  const visible = chips.filter(Boolean);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`${CARD} relative p-5 sm:p-6`}
    >
      {/* Soft blue wash bleeding in from the top-right corner. Purely decorative,
          so it is hidden from assistive tech and never intercepts clicks. */}
      <div
        aria-hidden
        className="absolute top-0 right-0 h-full w-1/2 pointer-events-none select-none"
        style={{
          background: 'radial-gradient(120% 100% at 100% 0%, rgba(37,99,235,0.07) 0%, rgba(37,99,235,0) 70%)',
        }}
      />

      <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div className="min-w-0">
          {/* Greeting icon tile, matching the stat tiles' icon-square shape so
              the two read as siblings rather than unrelated decoration. */}
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 grid place-items-center shrink-0">
              <Icon name="dashboard" size={19} />
            </span>
            <h1 className="text-[24px] sm:text-[28px] font-extrabold text-slate-900 tracking-tight leading-tight">
              {greeting}{name ? `, ${name}` : ''} <span aria-hidden>👋</span>
            </h1>
          </div>

          {subtitle && <p className="text-[13.5px] text-slate-500 mt-2.5">{subtitle}</p>}

          {visible.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mt-3">
              {visible.map((chip, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[12px] font-semibold text-slate-600"
                >
                  {chip.icon && <Icon name={chip.icon} size={13} className="text-slate-400 shrink-0" />}
                  <span className="text-slate-400 font-medium">{chip.label}</span>
                  <span className="text-slate-800">{chip.value}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {now && <DateTimeBlock now={now} />}
      </div>
    </motion.div>
  );
}

// The calendar-icon + date line with the clock underneath, as on the reference.
// Sits in its own tinted sub-panel so it reads as a distinct block inside the
// header card instead of drifting against the white background.
export function DateTimeBlock({ now }) {
  const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return (
    <div className="shrink-0">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 lg:text-right">
        <div className="flex items-center gap-2 justify-start lg:justify-end">
          <Icon name="calendar" size={15} className="text-slate-400 shrink-0" />
          <span className="text-[13px] text-slate-500 font-medium">{date}</span>
        </div>
        <div className="text-[22px] font-bold text-slate-900 tabular-nums mt-0.5">{time}</div>
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────
// Icon tile + title on the first row, a "…" affordance on the right, the big
// number, an optional trend line, and a large faded glyph bleeding off the
// bottom-right corner — the exact composition of the reference stat tiles.
export function StatCard({
  icon, label, value, accent = 'blue', trend, trendLabel,
  illustration, index = 0, onClick,
}) {
  const a = ACCENTS[accent] || ACCENTS.blue;
  const Wrapper = onClick ? motion.button : motion.div;
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={onClick ? { y: -3 } : undefined}
      onClick={onClick}
      className={`${CARD} relative overflow-hidden p-4 text-left w-full
        ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`w-9 h-9 rounded-lg ${a.bg} ${a.text} grid place-items-center shrink-0`}>
          <Icon name={icon} size={17} />
        </span>
        <span className="text-[14px] font-bold text-slate-800 truncate">{label}</span>
        <span className="ml-auto text-slate-300 shrink-0" aria-hidden>
          <Icon name="more" size={15} />
        </span>
      </div>

      <div className="mt-2.5 text-[26px] font-extrabold text-slate-900 tracking-tight leading-none tabular-nums">
        {value}
      </div>

      {trend != null && (
        <div className="mt-2 flex items-center gap-2 text-[12px]">
          <span className={`font-bold ${trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
          {trendLabel && <span className="text-slate-400">{trendLabel}</span>}
        </div>
      )}

      {/* Watermark illustration. Deliberately positioned with POSITIVE insets so
          it sits wholly inside the card. The earlier negative offsets
          (-bottom-2 / -right-2) pushed it past the card edge, and only looked
          right because `overflow-hidden` happened to be clipping it. */}
      {illustration && (
        <div
          className={`absolute bottom-3 right-3 ${a.soft} opacity-70 pointer-events-none select-none`}
          aria-hidden
        >
          {illustration}
        </div>
      )}
    </Wrapper>
  );
}

// Big faded glyph used as a stat-card illustration. Kept small on purpose: at
// the original 78px it bled past the card edge and read as a second, competing
// icon rather than a watermark.
export function CardGlyph({ name, size = 52 }) {
  return (
    <span className="block" style={{ width: size, height: size }}>
      <Icon name={name} size={size} />
    </span>
  );
}

// A progress ring, used where the reference shows a donut (e.g. Attendance).
export function ProgressRing({ percent = 0, size = 54, stroke = 8, color = '#10b981', track = '#d1fae5' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset .6s ease' }}
      />
    </svg>
  );
}

export function StatGrid({ children, cols = 4 }) {
  const cls = cols === 3 ? 'grid grid-cols-1 sm:grid-cols-3 gap-4'
    : cols === 2 ? 'grid grid-cols-1 sm:grid-cols-2 gap-4'
      : 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4';
  return <div className={cls}>{children}</div>;
}

// ── Panel ─────────────────────────────────────────────────────────────────
export function Panel({ title, icon, iconAccent = 'blue', subtitle, action, children, className = '', bodyClassName = 'px-5 pb-5' }) {
  return (
    <section className={`${CARD} overflow-hidden ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-slate-800">
              {icon && (
                <span className={`w-7 h-7 rounded-lg ${(ACCENTS[iconAccent] || ACCENTS.blue).bg} ${(ACCENTS[iconAccent] || ACCENTS.blue).text} grid place-items-center shrink-0`}>
                  <Icon name={icon} size={15} />
                </span>
              )}
              {title}
            </h2>
            {subtitle && <p className="text-[12.5px] text-slate-500 mt-1 ml-9">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function ViewAll({ children = 'View All', onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="text-[12.5px] font-bold text-blue-600 hover:text-blue-700 transition-colors inline-flex items-center gap-1">
      {children} <Icon name="chevronRight" size={13} />
    </button>
  );
}

// A small "Last 7 days" style dropdown control.
export function RangeSelect({ value = 'Last 7 days', options = ['Last 7 days', 'Last 30 days', 'This semester'], onChange }) {
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white pl-3 pr-2 py-1.5 cursor-pointer hover:border-slate-300 transition-colors">
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="text-[12.5px] font-semibold text-slate-600 bg-transparent outline-none cursor-pointer"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <Icon name="chevronDown" size={13} className="text-slate-400 pointer-events-none" />
    </label>
  );
}

// ── Area chart (hand-rolled SVG — no chart dependency) ─────────────────────
// Smooth line, gradient fill under it, horizontal gridlines with y labels,
// x labels beneath, and a hover crosshair + tooltip.
//
// The viewBox is built from the container's ACTUAL measured width rather than a
// fixed number with preserveAspectRatio="none". Forcing a non-uniform scale is
// what squashed the y-axis labels ("100%" rendered as "00%") and flattened the
// point circles into ellipses on any panel whose width didn't match the assumed
// 640px. Measuring keeps 1 SVG unit equal to 1 CSS pixel, so text and circles
// stay round at every width.
export function AreaChart({ data, height = 210, unit = '%' }) {
  const [hover, setHover] = React.useState(null);
  const wrapRef = React.useRef(null);
  const [width, setWidth] = React.useState(640);
  // Unique per instance: two charts on one page would otherwise share a
  // gradient id and the second would silently paint with the first's fill.
  // Declared with the other hooks, above the `if (!data) return null` guard.
  const gradId = React.useId().replace(/:/g, '');

  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The y-domain follows the DATA, not a fixed 60-100 band. A hard-coded
  // domain silently pushed any real value outside it off the bottom of the
  // plot area: with 0% attendance the whole line rendered below the axis and
  // the chart looked empty. It is now padded around whatever is actually
  // there, with the floor kept at 0 so a percentage can never imply more
  // than 100.
  const [yMin, yMax] = React.useMemo(() => {
    const vals = (data || []).map((d) => d.value).filter((v) => v != null);
    if (vals.length === 0) return [0, 100];
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    if (lo === hi) {
      // A flat series still deserves a readable band around the value.
      const pad = Math.max(10, Math.round(hi * 0.2));
      return [Math.max(0, Math.round(lo - pad)), Math.min(100, Math.round(hi + pad))];
    }
    const pad = Math.max(5, Math.ceil((hi - lo) * 0.25));
    return [Math.max(0, Math.floor((lo - pad) / 5) * 5), Math.min(100, Math.ceil((hi + pad) / 5) * 5)];
  }, [data]);

  const H = height;
  // Below this width there is no room for a readable axis label.
  const compact = width < 380;
  const padL = compact ? 34 : 42;
  const padR = compact ? 8 : 14;
  const padT = 12;
  const padB = compact ? 22 : 26;
  const W = Math.max(width, 260);
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  if (!data || data.length === 0) return null;

  const x = (i) => padL + (data.length === 1 ? innerW / 2 : (i * innerW) / (data.length - 1));
  const y = (v) => padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  // `value: null` means "no class on that day", not 0%. Those points are dropped
  // rather than passed to y(), where they would produce NaN and corrupt the
  // whole path. With at least one real day left the line spans those days
  // instead of dipping to the floor.
  const points = data
    .map((d, i) => ({ ...d, value: d.value == null ? null : d.value, i }))
    .filter((d) => d.value != null);

  // Catmull-Rom → cubic bezier, so the line curves through every point the way
  // the reference does instead of showing hard corners.
  const line = (() => {
    const pts = points.map((d) => [x(d.i), y(d.value)]);
    if (pts.length < 2) return '';
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
    }
    return d;
  })();

  const area = line
    ? `${line} L ${x(points[points.length - 1].i)} ${padT + innerH} L ${x(points[0].i)} ${padT + innerH} Z`
    : '';

  // Four or five gridlines, always stepping on a round 5/10 boundary.
  const ticks = (() => {
    const span = yMax - yMin;
    if (span <= 0) return [yMin];
    const step = span > 60 ? 20 : span > 30 ? 10 : span > 12 ? 5 : 2;
    const out = [];
    for (let v = yMin; v <= yMax + 0.001; v += step) out.push(Math.round(v * 10) / 10);
    if (out[out.length - 1] !== yMax) out.push(yMax);
    return out;
  })();

  const hp = hover != null ? data[hover] : null;

  // Nothing to plot: no class was held on any of the days shown. Say so rather
  // than drawing an empty grid with no explanation.
  if (points.length === 0) {
    return (
      <div ref={wrapRef} style={{
        height, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 6, textAlign: 'center',
      }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--txt2)' }}>
          No class was held in this period
        </span>
        <span style={{ fontSize: 11.5, color: 'var(--txt3)' }}>
          The attendance rate appears once a teacher takes a class.
        </span>
      </div>
    );
  }

  return (
    <div className="relative" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        style={{ width: '100%', height }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {ticks.map(v => (
          <g key={v}>
            <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="#e8edf5" strokeWidth="1" />
            <text x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize="10.5" fill="#94a3b8">{v}%</text>
          </g>
        ))}

        {area && <path d={area} fill={`url(#${gradId})`} />}
        {line && <path d={line} fill="none" stroke="#2563eb" strokeWidth="2.4" strokeLinecap="round" />}

        {hp && <line x1={x(hover)} y1={padT} x2={x(hover)} y2={padT + innerH} stroke="#2563eb" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />}

        {/* Points and dots come from `points` (null-valued days excluded); the
            x-axis labels keep every day so the weekday scale stays intact. */}
        {points.map((d) => (
          <circle key={d.label + d.i} cx={x(d.i)} cy={y(d.value)} r={hover === d.i ? 5 : 3.6}
            fill="#ffffff" stroke="#2563eb" strokeWidth="2.4" />
        ))}

        {data.map((d, i) => (
          <text key={'t' + i} x={x(i)} y={H - 7} textAnchor="middle" fontSize="10.5"
            fill={d.value == null ? '#cbd5e1' : '#94a3b8'}>{d.label}</text>
        ))}

        {/* Invisible hit columns drive the hover state. */}
        {data.map((d, i) => (
          <rect
            key={'h' + i}
            x={x(i) - innerW / (data.length * 2 || 1)}
            y={padT}
            width={innerW / (data.length || 1)}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => (d.value != null ? setHover(i) : setHover(null))}
          />
        ))}
      </svg>

      {hp && (
        <div
          className="pointer-events-none absolute z-10"
          style={{
            // Clamped so the tooltip never spills past the panel at either end
            // of the series.
            left: Math.min(Math.max(x(hover), 52), W - 52),
            top: Math.max(y(hp.value) - 10, 40),
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="relative bg-slate-900 text-white rounded-lg px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap shadow-lg">
            <div className="text-slate-300">{hp.label}</div>
            <div className="tabular-nums">{hp.value}{unit}</div>
            {/* caret pointing down at the hovered point */}
            <span className="absolute left-1/2 -bottom-[5px] -translate-x-1/2 border-x-[5px] border-x-transparent border-t-[5px] border-t-slate-900" />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Today's classes list ──────────────────────────────────────────────────
const TIME_ACCENTS = ['blue', 'purple', 'amber', 'teal', 'rose', 'indigo'];

export function ClassRow({ time, title, subtitle, status, statusLabel, index = 0, onClick }) {
  const a = ACCENTS[TIME_ACCENTS[index % TIME_ACCENTS.length]] || ACCENTS.blue;
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.25) }}
      onClick={onClick}
      className={`flex items-center gap-3 py-2.5 ${onClick ? 'cursor-pointer' : ''}`}
    >
      {time && (
        <span className={`shrink-0 w-[74px] text-center text-[11.5px] font-bold px-2 py-1.5 rounded-lg ${a.bg} ${a.text}`}>
          {time}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-bold text-slate-800 truncate">{title}</div>
        {subtitle && <div className="text-[11.5px] text-slate-500 truncate">{subtitle}</div>}
      </div>
      {status && <StatusPill status={status} label={statusLabel} />}
    </motion.div>
  );
}

const STATUS_STYLE = {
  ongoing: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  upcoming: 'bg-blue-50 text-blue-700 border border-blue-200',
  done: 'bg-slate-100 text-slate-600 border border-slate-200',
  active: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  ended: 'bg-slate-100 text-slate-600 border border-slate-200',
};

export function StatusPill({ status, label }) {
  const cls = STATUS_STYLE[String(status || '').toLowerCase()] || STATUS_STYLE.done;
  const isOngoing = String(status || '').toLowerCase() === 'ongoing' || String(status || '').toLowerCase() === 'active';
  return (
    <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${cls}`}>
      {isOngoing && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
      {label || status}
    </span>
  );
}

// ── Subject overview ──────────────────────────────────────────────────────
export function MetaChip({ kind = 'sem', value }) {
  if (value == null || value === '') return null;
  const map = {
    sem: ['bg-emerald-50 text-emerald-700', `Sem ${value}`],
    group: ['bg-blue-50 text-blue-700', `Group ${value}`],
    dept: ['bg-blue-50 text-blue-700', `${value}`],
    shift: ['bg-purple-50 text-purple-700', value],
  };
  const [cls, text] = map[kind] || map.sem;
  return <span className={`inline-flex items-center px-2 py-[3px] rounded-md text-[10.5px] font-bold ${cls}`}>{text}</span>;
}

export function SubjectCard({ subject, index = 0, onClick, footer }) {
  const glyphs = ['code', 'layers', 'chip', 'book', 'share', 'clipboard'];
  const palette = ['blue', 'purple', 'emerald', 'amber', 'indigo', 'rose'];
  const glyph = glyphs[index % glyphs.length];
  const a = ACCENTS[palette[index % palette.length]] || ACCENTS.blue;
  const dept = formatDepartment(subject.departmentId, subject.departmentCode) || '—';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.25) }}
      onClick={onClick}
      className={`${CARD} p-3.5 flex flex-col gap-2.5 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`w-9 h-9 rounded-lg ${a.bg} ${a.text} grid place-items-center shrink-0`}>
          <Icon name={glyph} size={17} />
        </span>
        <div className="min-w-0 flex-1">
          {/* formatSubject already renders "Name (CODE)" — appending the code
              again here is what produced "afsd (451) (451)". */}
          <div className="text-[13px] font-bold text-slate-800 truncate">
            {formatSubject(subject)}
          </div>
          <div className="text-[11px] text-slate-500 truncate">{dept}</div>
        </div>
        {onClick && (
          <span className="shrink-0 w-7 h-7 rounded-full border border-slate-200 grid place-items-center text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-colors">
            <Icon name="chevronRight" size={13} />
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <MetaChip kind="sem" value={subject.semester} />
        <MetaChip kind="group" value={subject.section} />
        {subject.shift && <MetaChip kind="shift" value={`${formatShift(subject.shift)} Shift`} />}
      </div>

      {footer && <div className="text-[11px] text-slate-500 flex items-center gap-3">{footer}</div>}
    </motion.div>
  );
}

export function SubjectOverview({ subjects = [], title = 'Subject Overview', limit = 4, action, footerFor }) {
  if (!subjects || subjects.length === 0) return null;
  const visible = subjects.slice(0, limit);
  return (
    <Panel
      title={title}
      icon="book"
      iconAccent="blue"
      action={action}
      bodyClassName="px-5 pb-5"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {visible.map((s, i) => (
          <SubjectCard
            key={s._id || s.id || i}
            subject={s}
            index={i}
            footer={footerFor ? footerFor(s) : null}
          />
        ))}
      </div>
    </Panel>
  );
}

// ── Recent sessions table ─────────────────────────────────────────────────
export function SessionTable({ columns, rows, emptyTitle = 'No sessions yet', emptyHint = 'Attendance sessions will appear here once one are started.' }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c} className="px-3 py-2.5 text-[11px] font-bold text-slate-500 border-b border-slate-200 whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-12 text-center">
                <div className="flex flex-col items-center gap-2">
                  <span className="w-10 h-10 rounded-full bg-slate-100 grid place-items-center">
                    <Icon name="clipboard" size={18} className="text-slate-400" />
                  </span>
                  <div className="text-[13.5px] font-bold text-slate-700">{emptyTitle}</div>
                  <div className="text-[12px] text-slate-400 max-w-[280px]">{emptyHint}</div>
                </div>
              </td>
            </tr>
          ) : rows.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50/80 transition-colors">
              {columns.map(c => (
                <td key={c} className="px-3 py-3 text-[12.5px] text-slate-600 whitespace-nowrap">
                  {r[c]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Quick actions ─────────────────────────────────────────────────────────
export function QuickActions({ actions = [] }) {
  if (!actions.length) return null;
  return (
    <Panel title="Quick Actions" icon="zap" iconAccent="blue" bodyClassName="px-4 pb-4">
      <div className="grid grid-cols-2 gap-2.5">
        {actions.map((a) => {
          const acc = ACCENTS[a.accent] || ACCENTS.blue;
          return (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left hover:border-blue-300 hover:bg-blue-50/40 transition-colors group"
            >
              <span className={`w-8 h-8 rounded-lg ${acc.bg} ${acc.text} grid place-items-center shrink-0`}>
                <Icon name={a.icon} size={15} />
              </span>
              <span className="text-[12.5px] font-bold text-slate-700 group-hover:text-blue-700 transition-colors truncate">
                {a.label}
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

// ── Misc ──────────────────────────────────────────────────────────────────
export function EmptyState({ icon = 'users', title, text, hint }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 gap-2">
      <span className="w-11 h-11 rounded-full bg-slate-100 grid place-items-center">
        <Icon name={icon} size={19} className="text-slate-400" />
      </span>
      {title && <div className="text-[13.5px] font-bold text-slate-700">{title}</div>}
      {text && <p className="text-[13px] text-slate-500 max-w-sm">{text}</p>}
      {hint && <p className="text-[12px] text-slate-400 max-w-sm">{hint}</p>}
    </div>
  );
}

export function ListRow({ icon = 'check', iconAccent = 'blue', title, subtitle, trailing, index = 0, onClick }) {
  const a = ACCENTS[iconAccent] || ACCENTS.blue;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.25) }}
      onClick={onClick}
      className={`flex items-center gap-3 py-2.5 ${onClick ? 'cursor-pointer' : ''}`}
    >
      <span className={`w-8 h-8 rounded-full ${a.bg} ${a.text} grid place-items-center shrink-0`}>
        <Icon name={icon} size={15} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-slate-700 truncate">{title}</div>
        {subtitle && <div className="text-[11.5px] text-slate-500 truncate">{subtitle}</div>}
      </div>
      {trailing && <div className="shrink-0 text-[11px] text-slate-400">{trailing}</div>}
    </motion.div>
  );
}

export function RollLookup({ api }) {
  const [roll, setRoll] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    const trimmed = roll.trim();
    if (!trimmed) return;
    setLoading(true); setError(''); setResult(null);
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
    <Panel title="Search by Roll" icon="search" bodyClassName="px-5 pb-5">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text" value={roll}
          onChange={e => { setRoll(e.target.value); setError(''); setResult(null); }}
          placeholder="e.g. 800768"
          className="flex-1 min-w-0 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-[13px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
        />
        <button type="submit" disabled={loading || !roll.trim()}
          className="shrink-0 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-[13px] font-bold transition-colors">
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>
      {error && <div className="mt-3 text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}
      {result && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="w-9 h-9 rounded-full bg-blue-600 text-white grid place-items-center text-[12px] font-bold shrink-0">
            {(result.name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold text-slate-800 truncate">{result.name}</div>
            <div className="text-[11.5px] text-slate-500 truncate">
              Roll: {result.studentId} • {formatDepartment(result.departmentId, result.departmentCode) || '-'} • Sem {result.semester} • Group {result.section}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
