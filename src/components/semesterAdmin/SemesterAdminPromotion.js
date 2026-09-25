'use client';
import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import Modal from '@/components/common/Modal';

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

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
export default function SemesterAdminPromotion() {
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
    api.get('/semesterAdmin/students', {
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

  const toggle = (id) => {
    if (!id) return;
    setSelected(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const visibleIds = filtered.map(getStudentId).filter(Boolean);
    const allVisibleSelected = visibleIds.length > 0
      && visibleIds.every(id => selected.has(id));
    setSelected(allVisibleSelected ? new Set() : new Set(visibleIds));
  };

  const currentSemester = fromSemester;
  const nextSemester = currentSemester != null ? currentSemester + 1 : null;
  const previousSemester = currentSemester != null ? currentSemester - 1 : null;
  const availableSemesters = getAvailableSemesters(mode, allowedSemesters);
  const canMove = mode === 'demote'
    ? currentSemester != null && currentSemester >= 2
    : currentSemester != null && currentSemester < 8;
  const notSelectedCount = Math.max(0, students.length - selected.size);
  const visibleSelected = filtered.filter(student => selected.has(getStudentId(student))).length;
  const allVisibleSelected = filtered.length > 0 && visibleSelected === filtered.length;

  const handleMovement = async () => {
    if (!canMove || currentSemester == null || selected.size === 0) return;
    setSubmitting(true);
    try {
      const endpoint = mode === 'demote'
        ? '/semesterAdmin/demote'
        : '/semesterAdmin/promote';
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
                  onChange={event => {
                    setSearch(event.target.value);
                    setSelected(new Set());
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn-secondary" style={{ width: 'auto', padding: '8px 14px', fontSize: 12.5 }} onClick={toggleAll}>
                  {allVisibleSelected ? 'Deselect All' : 'Select All'}
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

          {filtered.length === 0 ? (
            <div className="card">
              <div className="empty">
                <div className="empty-icon"><Icon name="users" size={24} /></div>
                <p>No active registered students found</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(student => {
                const id = getStudentId(student);
                const isSelected = selected.has(id);
                return (
                  <div
                    key={id}
                    onClick={() => canMove && toggle(id)}
                    style={{
                      background: isSelected ? 'var(--primary-light)' : 'var(--bg)',
                      border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-lg)', padding: '12px 14px',
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
                        Roll: {student.studentId || '—'} • Group {student.section || '—'}{student.mobile ? ` • 📱 ${student.mobile}` : ''}
                      </div>
                    </div>
                    <span className="tag tag-blue" style={{ fontSize: 10, flexShrink: 0 }}>Sem {student.semester}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <Modal open={showConfirm} onClose={() => !submitting && setShowConfirm(false)}>
        <div className="modal-title">{mode === 'demote' ? 'Confirm Demotion' : 'Confirm Promotion'}</div>
        <p style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 8 }}>
          <strong>{selected.size} Student(s)</strong> will be {mode === 'demote' ? 'demoted' : 'promoted'} from Semester {currentSemester} to <strong>Semester {mode === 'demote' ? previousSemester : nextSemester}</strong>.
        </p>
        {notSelectedCount > 0 && (
          <p style={{ fontSize: 12.5, color: 'var(--txt3)', marginBottom: 8 }}>
            The remaining {notSelectedCount} student(s) will stay in Semester {currentSemester}.
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
