'use client';
import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import Modal from '@/components/common/Modal';

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

// The four teaching Groups of a Section. Mirrors the server's own GROUPS check
// in /api/departmentAdmin/students, so a Group that can never be stored never
// shows up as a filter here either.
const GROUPS = ['A', 'B', 'C', 'D'];

// `section` is a Prisma enum (Section = A|B|C|D), so the only value that can
// fall outside GROUPS is null — an unassigned student. Normalising still guards
// against stray whitespace/casing.
const normalizeGroup = section => {
  const g = String(section || '').trim().toUpperCase();
  return GROUPS.find(x => g === x || g.startsWith(x)) || '';
};

// A distinct colour per Group so the heading is recognisable at a glance while
// scrolling, rather than four identical lettered squares.
const GROUP_ACCENT = {
  A: { bg: '#dbeafe', fg: '#1d4ed8' },
  B: { bg: '#ede9fe', fg: '#6d28d9' },
  C: { bg: '#d1fae5', fg: '#047857' },
  D: { bg: '#fef3c7', fg: '#b45309' },
  unassigned: { bg: '#f1f5f9', fg: '#64748b' },
};

function getStudentId(student) {
  return student?.id || student?._id;
}

function getAvailableSemesters(mode, allowedSemesters) {
  if (mode === 'demote') {
    return allowedSemesters.filter(semester => semester >= 2 && semester <= 8);
  }
  return allowedSemesters.filter(semester => semester >= 1 && semester <= 8);
}

function normalizeRoster(entries, semester) {
  return (entries || [])
    .map(entry => ({
      id: entry.id || entry._id,
      name: entry.name || '',
      studentId: entry.studentId || entry.roll || '',
      section: entry.section,
      mobile: entry.mobile,
      semester: entry.semester ?? semester,
    }))
    .filter(student => student.id);
}

// Promotion and demotion are deliberately handled one source Semester at a
// time. This keeps the selected roster understandable and makes the server
// able to re-check every student before changing its current semester.
export default function DepartmentAdminPromotion() {
  const { user } = useAuth();
  const allowedSemesters = (user?.semesters && user.semesters.length
    ? user.semesters
    : user?.semester ? [user.semester] : []
  ).map(Number).filter(semester => SEMESTERS.includes(semester));
  const allowedKey = allowedSemesters.join(',');

  const [mode, setMode] = useState('promote');
  const [fromSemester, setFromSemester] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  // Which Group's students are on screen. 'all' shows every Group under its own
  // heading instead of one merged list, because a Section's roll numbers only
  // mean anything relative to the Group they belong to.
  const [groupFilter, setGroupFilter] = useState('all');
  // Group headings start open; a Collapse toggle remembers per Group.
  const [collapsed, setCollapsed] = useState({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const available = getAvailableSemesters(mode, allowedSemesters);
    setFromSemester(previous => (
      available.includes(previous) ? previous : (available[0] ?? null)
    ));
    setSelected(new Set());
    setSearch('');
    setShowConfirm(false);
    // `allowedKey` represents the normalized granted-semester list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, allowedKey]);

  useEffect(() => {
    let cancelled = false;
    if (fromSemester == null) {
      setStudents([]);
      setLoading(false);
      return () => { cancelled = true; };
    }

    setLoading(true);
    api.get('/departmentAdmin/students', {
      params: { semester: fromSemester, promotionRoster: 'true' },
    })
      .then(response => {
        if (!cancelled) {
          setStudents(normalizeRoster(response.data?.entries, fromSemester));
        }
      })
      .catch(error => {
        if (!cancelled) {
          setStudents([]);
          toast.error(error.response?.data?.message || 'Could not load students');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [fromSemester, mode, refreshKey]);

  const filtered = students.filter(student => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (student.name || '').toLowerCase().includes(query)
      || (student.studentId || '').toLowerCase().includes(query);
  });

  // One bucket per Group that actually has students, in A→D order, plus an
  // "Unassigned" bucket last for anything the server let through without a
  // usable Group letter. Built from `filtered`, so the headings always describe
  // exactly what the search box left on screen.
  const groupBuckets = GROUPS
    .map(g => ({
      key: g,
      label: `Group ${g}`,
      items: filtered.filter(student => normalizeGroup(student.section) === g),
    }))
    .filter(bucket => bucket.items.length > 0);

  const unassignedStudents = filtered.filter(student => !normalizeGroup(student.section));
  if (unassignedStudents.length) {
    groupBuckets.push({ key: 'unassigned', label: 'Unassigned', items: unassignedStudents });
  }

  const visibleBuckets = groupFilter === 'all'
    ? groupBuckets
    : groupBuckets.filter(bucket => bucket.key === groupFilter);

  // Counts on the chips come from `filtered` rather than the full semester, so
  // they stay put while a Group is selected and the numbers a click would reveal
  // are always the ones on screen.
  const groupCounts = Object.fromEntries(GROUPS.map(g => [g, 0]));
  for (const student of filtered) {
    const g = normalizeGroup(student.section);
    if (g) groupCounts[g] += 1;
  }

  // Every id the admin can currently see and tick. `filtered` alone would ignore
  // the Group filter, which would make "Select All" reach into hidden Groups.
  const visibleIds = visibleBuckets
    .flatMap(bucket => bucket.items)
    .map(getStudentId)
    .filter(Boolean);
  const visibleSelected = visibleIds.filter(id => selected.has(id)).length;

  const toggle = (id) => {
    if (!id) return;
    setSelected(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Adds the on-screen students to the selection rather than replacing it.
  // Replacing would silently drop anyone already ticked in a Group that is
  // currently filtered out — the exact mistake bulk promotion invites.
  const toggleAll = () => {
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));
    setSelected(previous => {
      const next = new Set(previous);
      for (const id of visibleIds) {
        if (allVisibleSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  // Selects/deselects one Group's on-screen students without touching the rest of
  // the selection. Promoting a whole Section usually means whole Groups, so this
  // saves ticking 30 rows by hand while still letting you mix and match.
  const toggleBucket = bucketIds => {
    const ids = bucketIds.filter(Boolean);
    const allSelected = ids.length > 0 && ids.every(id => selected.has(id));
    setSelected(previous => {
      const next = new Set(previous);
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const isBucketSelected = bucketIds =>
    bucketIds.length > 0 && bucketIds.every(id => selected.has(id));

  const currentSemester = fromSemester;
  const nextSemester = currentSemester != null ? currentSemester + 1 : null;
  const previousSemester = currentSemester != null ? currentSemester - 1 : null;
  const availableSemesters = getAvailableSemesters(mode, allowedSemesters);
  const canMove = mode === 'demote'
    ? currentSemester != null && currentSemester >= 2
    : currentSemester != null && currentSemester < 8;
  const notSelectedCount = Math.max(0, students.length - selected.size);

  // Selected count per Group, so the confirmation shows where those students
  // are coming from. Sorted A→D; a student with no group is counted separately
  // rather than silently dropped from the breakdown.
  const selectedByGroup = (() => {
    const counts = new Map();
    for (const student of students) {
      if (!selected.has(getStudentId(student))) continue;
      const key = normalizeGroup(student.section) || 'unassigned';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const order = [...GROUPS, 'unassigned'];
    return [...counts.entries()]
      .map(([key, count]) => ({
        key,
        label: key === 'unassigned' ? 'No group' : `Group ${key}`,
        count,
        accent: GROUP_ACCENT[key] || GROUP_ACCENT.unassigned,
      }))
      .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  })();
  const allVisibleSelected = visibleIds.length > 0 && visibleSelected === visibleIds.length;

  const handleMovement = async () => {
    if (!canMove || currentSemester == null || selected.size === 0) return;
    setSubmitting(true);
    try {
      const endpoint = mode === 'demote'
        ? '/departmentAdmin/demote'
        : '/departmentAdmin/promote';
      const response = await api.post(endpoint, {
        studentIds: Array.from(selected),
        fromSemester: currentSemester,
      });
      toast.success(response.data.message);
      setSelected(new Set());
      setShowConfirm(false);
      setRefreshKey(previous => previous + 1);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const pageTitle = mode === 'demote' ? 'Semester Demotion' : 'Semester Promotion';
  const pageDescription = currentSemester == null
    ? (mode === 'demote'
      ? 'You do not have a Semester 2–8 permission for demotion.'
      : 'Select a permitted Semester to manage.')
    : mode === 'demote'
      ? `Demote selected Students from Semester ${currentSemester} to Semester ${previousSemester}`
      : currentSemester >= 8
        ? 'You are at Semester 8 — this is the final semester, promotion does not apply'
        : `Promote selected Students from Semester ${currentSemester} to Semester ${nextSemester}`;

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title">{pageTitle}</h2>
          <p className="page-sub">{pageDescription}</p>
        </div>
        <div style={{ display: 'flex', gap: 6, background: 'var(--bg3)', padding: 4, borderRadius: 24 }} role="tablist" aria-label="Semester movement mode">
          {[
            { key: 'promote', label: 'Promotion' },
            { key: 'demote', label: 'Demotion' },
          ].map(option => (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={mode === option.key}
              onClick={() => setMode(option.key)}
              style={{
                padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
                background: mode === option.key ? 'var(--primary)' : 'transparent',
                color: mode === option.key ? '#fff' : 'var(--txt2)',
                transition: 'all .18s ease',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {currentSemester != null && availableSemesters.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }} role="tablist" aria-label="Source semester">
          {availableSemesters.map(semester => (
            <button
              key={semester}
              type="button"
              onClick={() => {
                setFromSemester(semester);
                setSelected(new Set());
                setSearch('');
                setShowConfirm(false);
              }}
              aria-selected={fromSemester === semester}
              style={{
                padding: '7px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                background: fromSemester === semester ? 'var(--primary)' : 'var(--bg3)',
                color: fromSemester === semester ? '#fff' : 'var(--txt2)',
                transition: 'all .18s ease',
              }}
            >
              Semester {semester}
            </button>
          ))}
        </div>
      )}

      {currentSemester == null ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon"><Icon name="users" size={24} /></div>
            <p>{mode === 'demote' ? 'No demotion-eligible Semester is assigned to you.' : 'No Semester is assigned to you.'}</p>
          </div>
        </div>
      ) : (
        <>
          <div style={{
            fontSize: 12.5, color: 'var(--txt2)', background: 'var(--bg3)',
            padding: '10px 14px', borderRadius: 10, marginBottom: 16,
          }}>
            {mode === 'demote'
              ? `💡 Selected students will move from Semester ${currentSemester} to Semester ${previousSemester}. Students not selected will stay in Semester ${currentSemester}.`
              : `💡 Selected students will move from Semester ${currentSemester} to Semester ${nextSemester}. Students not selected will stay in Semester ${currentSemester}.`}
          </div>

          {canMove && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div style={{ position: 'relative', maxWidth: 280, flex: 1, minWidth: 200 }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--txt3)' }}>
                  <Icon name="search" size={14} />
                </span>
                <input
                  className="form-input"
                  style={{ paddingLeft: 34, fontSize: 13 }}
                  placeholder="Search by name or Roll"
                  value={search}
                  // Typing narrows what is *shown*, not what is *selected*.
                  // Clearing the selection on every keystroke used to be
                  // harmless; with whole Groups now selectable in one click it
                  // would throw that work away mid-typing.
                  onChange={event => setSearch(event.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  className="btn-secondary"
                  style={{ width: 'auto', padding: '8px 14px', fontSize: 12.5 }}
                  onClick={toggleAll}
                  disabled={visibleIds.length === 0}
                >
                  {/* The count matters: a bare "Select All" reads as "the whole
                      semester" even while a search box or a Group chip is
                      narrowing the list. */}
                  {allVisibleSelected ? `Deselect All (${visibleSelected})` : `Select All (${visibleIds.length})`}
                </button>
                <button
                  className="btn-primary"
                  style={{ width: 'auto', padding: '8px 16px', fontSize: 12.5 }}
                  disabled={selected.size === 0}
                  onClick={() => setShowConfirm(true)}
                >
                  <Icon name="chevronRight" size={14} /> {mode === 'demote' ? 'Demote' : 'Promote'} {selected.size} Students
                </button>
              </div>
            </div>
          )}

          {/* GROUP FILTER — a Section's roll numbers only mean something relative
              to the Group they belong to, so the students are shown one Group at
              a time rather than as one merged list. */}
          {filtered.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt3)', marginRight: 2 }}>Group</span>
              {[
                { key: 'all', label: `All Groups (${filtered.length})` },
                ...GROUPS.map(g => ({ key: g, label: `${g} (${groupCounts[g]})` })),
                ...(unassignedStudents.length ? [{ key: 'unassigned', label: `Unassigned (${unassignedStudents.length})` }] : []),
              ].map(filter => {
                const active = groupFilter === filter.key;
                // A chip with nothing behind it stays visible but disabled, so the
                // layout does not jump around as students are added.
                const empty = filter.key !== 'all'
                  && (filter.key === 'unassigned' ? !unassignedStudents.length : groupCounts[filter.key] === 0);
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setGroupFilter(filter.key)}
                    disabled={empty}
                    aria-pressed={active}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', borderRadius: 999, cursor: empty ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                      border: `1px solid ${active ? 'var(--primary)' : 'var(--border2)'}`,
                      background: active ? 'var(--primary)' : 'var(--bg)',
                      color: active ? '#fff' : empty ? 'var(--txt3)' : 'var(--txt2)',
                      opacity: empty ? 0.5 : 1,
                      transition: 'all .18s ease',
                    }}
                  >
                    {GROUPS.includes(filter.key) && (
                      <span style={{
                        width: 16, height: 16, borderRadius: 5, display: 'grid', placeItems: 'center',
                        fontSize: 10, fontWeight: 800,
                        background: active ? 'rgba(255,255,255,.22)' : 'var(--primary-light)',
                        color: active ? '#fff' : 'var(--primary)',
                      }}>
                        {filter.key}
                      </span>
                    )}
                    {filter.label}
                  </button>
                );
              })}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="card">
              <div className="empty">
                <div className="empty-icon"><Icon name="users" size={24} /></div>
                <p>No active registered students found</p>
              </div>
            </div>
          ) : visibleBuckets.length === 0 ? (
            <div className="card">
              <div className="empty">
                <div className="empty-icon"><Icon name="users" size={24} /></div>
                <p>
                  {groupFilter === 'unassigned'
                    ? 'No unassigned students match the current filter.'
                    : `No students in Group ${groupFilter} match the current filter.`}
                </p>
                <button
                  type="button"
                  onClick={() => setGroupFilter('all')}
                  style={{
                    marginTop: 10, padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                    border: '1px solid var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)',
                  }}
                >
                  Show all groups
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {visibleBuckets.map(bucket => {
                const isOpen = !collapsed[bucket.key];
                const bucketIds = bucket.items.map(getStudentId).filter(Boolean);
                const bucketSelected = bucketIds.filter(id => selected.has(id)).length;
                const bucketFullySelected = isBucketSelected(bucketIds);
                const accent = GROUP_ACCENT[bucket.key] || GROUP_ACCENT.unassigned;
                return (
                  <section
                    key={bucket.key}
                    style={{
                      background: 'var(--bg)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingRight: 10 }}>
                      <button
                        type="button"
                        onClick={() => setCollapsed(previous => ({ ...previous, [bucket.key]: isOpen }))}
                        aria-expanded={isOpen}
                        style={{
                          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10,
                          padding: '11px 6px 11px 14px', border: 'none', cursor: 'pointer',
                          background: 'transparent', fontFamily: 'inherit', textAlign: 'left',
                        }}
                      >
                        <span style={{
                          width: 28, height: 28, borderRadius: 9, flexShrink: 0,
                          display: 'grid', placeItems: 'center',
                          fontSize: 13, fontWeight: 800,
                          background: accent.bg, color: accent.fg,
                        }}>
                          {bucket.key === 'unassigned' ? '?' : bucket.key}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontWeight: 800, fontSize: 13.5, color: 'var(--txt)' }}>
                            {bucket.label}
                            <span style={{ fontWeight: 600, color: 'var(--txt3)', marginLeft: 6, fontSize: 12 }}>
                              Semester {currentSemester}
                            </span>
                          </span>
                          <span style={{ display: 'block', fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>
                            {bucketSelected > 0 && <>{bucketSelected} selected</>}
                            {bucketSelected > 0 && bucket.items.length > bucketSelected && ' • '}
                            {bucket.items.length - bucketSelected} not selected
                          </span>
                        </span>
                        <span style={{
                          fontSize: 12, fontWeight: 800, color: 'var(--txt2)',
                          background: 'var(--bg3)', borderRadius: 999, padding: '3px 10px', flexShrink: 0,
                        }}>
                          {bucket.items.length}
                        </span>
                        <span style={{
                          color: 'var(--txt3)', display: 'grid', placeItems: 'center', flexShrink: 0,
                          transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .2s ease',
                        }}>
                          <Icon name="chevronDown" size={15} />
                        </span>
                      </button>

                      {/* Selects the whole Group at once — promoting a Section is
                          usually a whole-Group decision, and ticking 30 rows to
                          say so is where mistakes happen. */}
                      {canMove && (
                        <button
                          type="button"
                          onClick={() => toggleBucket(bucketIds)}
                          aria-pressed={bucketFullySelected}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                            padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                            fontFamily: 'inherit', fontSize: 11.5, fontWeight: 800,
                            border: `1px solid ${bucketFullySelected ? 'var(--primary)' : 'var(--border2)'}`,
                            background: bucketFullySelected ? 'var(--primary)' : 'transparent',
                            color: bucketFullySelected ? '#fff' : 'var(--txt2)',
                            transition: 'all .18s ease',
                          }}
                        >
                          <Icon name="check" size={12} style={{ color: bucketFullySelected ? '#fff' : 'var(--txt3)' }} />
                          {bucketFullySelected ? 'Deselect' : 'Select Group'}
                        </button>
                      )}
                    </div>

                    {isOpen && (
                      <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {bucket.items.map(student => {
                          const id = getStudentId(student);
                          const isSelected = selected.has(id);
                          return (
                            <div
                              key={id}
                              onClick={() => canMove && toggle(id)}
                              style={{
                                background: isSelected ? 'var(--primary-light)' : 'var(--bg3)',
                                border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                                borderRadius: 10,
                                padding: '12px 14px',
                                display: 'flex', alignItems: 'center', gap: 12,
                                cursor: canMove ? 'pointer' : 'default', transition: 'all 0.15s',
                              }}
                            >
                              {canMove && (
                                <div style={{
                                  width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                                  border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border2)'}`,
                                  background: isSelected ? 'var(--primary)' : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  {isSelected && <Icon name="check" size={13} style={{ color: '#fff' }} />}
                                </div>
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{student.name || 'Unnamed student'}</div>
                                <div style={{ fontSize: 11.5, color: 'var(--txt2)' }}>
                                  Roll: {student.studentId || '—'}{student.mobile ? ` • 📱 ${student.mobile}` : ''}
                                </div>
                              </div>
                              <span className="tag tag-blue" style={{ fontSize: 10, flexShrink: 0 }}>Sem {student.semester}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      <Modal open={showConfirm} onClose={() => !submitting && setShowConfirm(false)}>
        <div className="modal-title">{mode === 'demote' ? 'Confirm Demotion' : 'Confirm Promotion'}</div>

        {/* The single number the Admin actually asked for: how many students'
            semester is about to change. Broken down by Group as well, because a
            count alone gives no way to tell whether the right people were
            ticked. */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
          background: 'var(--primary-light)', border: '1px solid var(--primary)',
          borderRadius: 12, padding: '12px 14px',
        }}>
          <div style={{ minWidth: 62 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>
              {selected.size}
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--primary)', opacity: 0.8 }}>
              STUDENTS
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--txt2)', lineHeight: 1.5 }}>
            semester will change from{' '}
            <strong style={{ color: 'var(--txt)' }}>Semester {currentSemester}</strong>
            {' → '}
            <strong style={{ color: 'var(--primary)' }}>
              Semester {mode === 'demote' ? previousSemester : nextSemester}
            </strong>
            {selectedByGroup.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {selectedByGroup.map(g => (
                  <span
                    key={g.key}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 9px', borderRadius: 999,
                      fontSize: 11, fontWeight: 800,
                      background: g.accent.bg, color: g.accent.fg,
                    }}
                  >
                    {g.label}: {g.count}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 8 }}>
          <strong>{selected.size} Student(s)</strong> will be {mode === 'demote' ? 'demoted' : 'promoted'} from Semester {currentSemester} to <strong>Semester {mode === 'demote' ? previousSemester : nextSemester}</strong>.
        </p>
        {notSelectedCount > 0 && (
          <p style={{ fontSize: 12.5, color: 'var(--txt3)', marginBottom: 8 }}>
            The remaining {notSelectedCount} student(s) will stay in Semester {currentSemester}.
          </p>
        )}
        {/* Set expectations honestly: the server re-checks every id, so a stale
            selection or a class already running can block the whole move. */}
        {mode === 'demote' && (
          <p style={{ fontSize: 11.5, color: 'var(--txt3)', marginBottom: 4 }}>
            If any class in Semester {currentSemester} is still running, the whole demotion is
            blocked and nothing is changed.
          </p>
        )}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => setShowConfirm(false)} disabled={submitting}>Cancel</button>
          <button className="btn-primary" onClick={handleMovement} disabled={submitting}>
            {submitting
              ? <><div className="spinner spinner-sm" /> {mode === 'demote' ? 'Demoting...' : 'Promoting...'}</>
              : mode === 'demote' ? 'Confirm and Demote' : 'Confirm and Promote'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
