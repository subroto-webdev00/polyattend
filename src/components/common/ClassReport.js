'use client';
import React, { useState, useEffect, useCallback } from 'react';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';

const WINDOW_DAYS = 3;

// Reads /api/reports/class-report, which returns the classes actually taken
// inside a rolling WINDOW_DAYS window. Nothing is deleted — an older class
// simply stops appearing here while remaining in every attendance report.
export default function ClassReport() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [shiftFilter, setShiftFilter] = useState('all');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/reports/class-report')
      .then(r => setClasses(r.data.classes || []))
      .catch(err => { if (err.response?.status !== 401) setClasses([]); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filter controls are derived from what actually came back, so a Department
  // or Shift nobody used this window never appears as an empty option.
  const departments = [...new Set(classes.map(c => c.departmentName).filter(Boolean))].sort();
  const shifts = [...new Set(classes.map(c => c.shift).filter(Boolean))].sort();

  const filtered = classes.filter(c => {
    if (deptFilter !== 'all' && c.departmentName !== deptFilter) return false;
    if (shiftFilter !== 'all' && c.shift !== shiftFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${c.subjectName} ${c.subjectCode} ${c.teacherName} ${c.departmentName} ${c.departmentCode} ${c.section}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // One heading per calendar day, newest first.
  const byDate = filtered.reduce((acc, c) => {
    (acc[c.dateKey] ||= []).push(c);
    return acc;
  }, {});

  const SHIFT_LABEL = { first: 'Morning', second: 'Day', '1st': 'Morning', '2nd': 'Day' };
  const shiftText = s => (s ? (SHIFT_LABEL[s] || s) : '—');

  const total = filtered.length;
  const teacherCount = new Set(filtered.map(c => c.teacherName)).size;
  const activeNow = filtered.filter(c => c.status === 'active').length;

  const selStyle = {
    padding: '7px 12px', borderRadius: 10, fontFamily: 'inherit', fontSize: 12.5,
    border: '1px solid var(--border2)', background: 'var(--bg)', color: 'var(--txt2)', cursor: 'pointer',
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h2 className="page-title">Class Report</h2>
        <p className="page-sub">
          Every class taken in the last {WINDOW_DAYS} days, with the Teacher, Department, Shift and time.
          {' '}Classes older than {WINDOW_DAYS} days leave this list — the attendance data itself is kept.
        </p>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              { label: 'Classes', value: total },
              { label: 'Teachers', value: teacherCount },
              { label: 'Running now', value: activeNow },
            ].map(s => (
              <div key={s.label} style={{
                background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10,
                padding: '8px 14px', minWidth: 104,
              }}>
                <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--txt)', lineHeight: 1.15 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--txt3)' }}>
                <Icon name="search" size={14} />
              </span>
              <input
                className="form-input" style={{ paddingLeft: 34, fontSize: 13, width: 230 }}
                placeholder="Search Subject, Teacher, Department..."
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
            {departments.length > 1 && (
              <select className="form-select" style={selStyle} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                <option value="all">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
            {shifts.length > 1 && (
              <select className="form-select" style={selStyle} value={shiftFilter} onChange={e => setShiftFilter(e.target.value)}>
                <option value="all">All Shifts</option>
                {shifts.map(s => <option key={s} value={s}>{shiftText(s)}</option>)}
              </select>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="card fade-in">
              <div className="empty">
                <div className="empty-icon"><Icon name="clock" size={24} /></div>
                <p>No classes taken in the last {WINDOW_DAYS} days</p>
                {classes.length > 0 && (
                  <p style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 4 }}>
                    {classes.length} class{classes.length === 1 ? '' : 'es'} exist — clear the filters to see them.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {Object.entries(byDate).map(([dateKey, dayClasses]) => (
                <div key={dateKey}>
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: 'var(--txt2)', marginBottom: 9,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <Icon name="calendar" size={14} className="text-slate-400" />
                    {dayClasses[0].date}
                    <span style={{ fontWeight: 500, color: 'var(--txt3)' }}>
                      ({dayClasses.length} class{dayClasses.length === 1 ? '' : 'es'})
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {dayClasses.map(c => (
                      <div key={c.id} className="class-row" style={{
                        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
                        padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                      }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: c.status === 'active' ? 'var(--primary)' : 'var(--primary-mid, #3b82f6)',
                          opacity: c.status === 'active' ? 1 : 0.45,
                        }} />
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                            {c.subjectName}{c.subjectCode ? ` (${c.subjectCode})` : ''}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--txt2)', display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Icon name="users" size={11} /> {c.teacherName}
                            </span>
                            {c.departmentName && (
                              <>
                                <span aria-hidden>•</span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <Icon name="department" size={11} />
                                  {c.departmentName}{c.departmentCode ? ` (${c.departmentCode})` : ''}
                                </span>
                              </>
                            )}
                            <span aria-hidden>•</span>
                            <span>Sem {c.semester} • Group {c.section}</span>
                            {c.isSubstitute && <span className="tag tag-purple" style={{ fontSize: 10 }}>Substitute</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span className="sa-chip">{shiftText(c.shift)} Shift</span>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 12, fontWeight: 700, color: 'var(--txt2)',
                          }}>
                            <Icon name="clock" size={12} /> {c.timeRange}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <style jsx>{`
        .fade-in { animation: fadeIn .3s ease both; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .class-row { transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
        .class-row:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.06); border-color: var(--primary); }
      `}</style>
    </div>
  );
}
