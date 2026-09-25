'use client';
import React, { useState } from 'react';
import api from '@/utils/api';
import Icon from './Icon';

// Two search modes:
//   - "Student" (by Roll) — the original behaviour, unchanged.
//   - "Staff" (by Name) — Teachers, and for Admin also Department Admin /
//     Semester Admin / other Admin accounts. Not shown to Teacher role
//     (their layout never links here with canStaffSearch — see the
//     `canStaffSearch` prop passed from each role's page).
export default function SearchMobilePage({ canStaffSearch = false }) {
  const [mode, setMode] = useState('student'); // student | staff

  const [roll, setRoll] = useState('');
  const [rollLoading, setRollLoading] = useState(false);
  const [rollResult, setRollResult] = useState(null);
  const [rollError, setRollError] = useState('');

  const [name, setName] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffResults, setStaffResults] = useState(null);
  const [staffError, setStaffError] = useState('');

  const handleRollSearch = async (e) => {
    e.preventDefault();
    const trimmed = roll.trim();
    if (!trimmed) return;
    setRollLoading(true);
    setRollError('');
    setRollResult(null);
    try {
      const res = await api.get('/users/lookup-by-roll', { params: { roll: trimmed } });
      setRollResult(res.data.student);
    } catch (err) {
      setRollError(err.response?.data?.message || 'Not found');
    } finally {
      setRollLoading(false);
    }
  };

  const handleStaffSearch = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setStaffLoading(true);
    setStaffError('');
    setStaffResults(null);
    try {
      const res = await api.get('/users/lookup-staff', { params: { name: trimmed } });
      setStaffResults(res.data.staff || []);
    } catch (err) {
      setStaffError(err.response?.data?.message || 'Search failed');
    } finally {
      setStaffLoading(false);
    }
  };

  const roleLabel = { teacher: 'Teacher', subAdmin: 'Department Admin', semesterAdmin: 'Semester Admin', admin: 'Admin' };

  return (
    <div className="page">
      <style suppressHydrationWarning>{`
        .smb-card {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 28px;
          max-width: 560px;
          box-shadow: var(--shadow);
          box-sizing: border-box;
        }
        .smb-tabs { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
        .smb-tab {
          padding: 8px 16px; border-radius: 10px; border: 1.5px solid var(--border);
          background: var(--bg2); color: var(--txt2); font-size: 13px; font-weight: 700;
          cursor: pointer; transition: all 0.15s;
        }
        .smb-tab.active { background: var(--primary); border-color: var(--primary); color: #fff; }
        .smb-title { font-size: 20px; font-weight: 800; color: var(--txt); margin-bottom: 4px; }
        .smb-sub { font-size: 13px; color: var(--txt2); margin-bottom: 24px; }
        .smb-input-wrap { display: flex; gap: 10px; margin-bottom: 16px; }
        .smb-input {
          flex: 1; min-width: 0; width: 100%; background: var(--bg2); border: 1.5px solid var(--border); border-radius: 12px;
          padding: 12px 16px; font-size: 15px; color: var(--txt); outline: none;
          transition: border-color 0.18s; box-sizing: border-box;
        }
        .smb-input.mono { font-family: monospace; letter-spacing: 1px; }
        .smb-input:focus { border-color: var(--primary); }
        .smb-btn {
          background: var(--primary); color: #fff; border: none; border-radius: 12px;
          padding: 12px 22px; font-size: 13px; font-weight: 700; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 6px; transition: opacity 0.15s, transform 0.15s;
          white-space: nowrap; box-sizing: border-box; flex-shrink: 0;
        }
        .smb-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .smb-btn:not(:disabled):hover { opacity: 0.88; transform: scale(1.03); }
        .smb-error {
          background: rgba(248, 113, 113, 0.1); border: 1px solid rgba(248, 113, 113, 0.25);
          border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #f87171; margin-top: 8px;
        }
        .smb-result {
          margin-top: 18px; background: var(--bg2); border: 1.5px solid var(--border);
          border-radius: 14px; padding: 18px; display: flex; align-items: center; gap: 14px;
          flex-wrap: wrap; box-sizing: border-box;
        }
        .smb-avatar {
          width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700;
          color: #fff; flex-shrink: 0;
        }
        .smb-name { font-size: 15px; font-weight: 700; color: var(--txt); margin-bottom: 3px; }
        .smb-meta { font-size: 12px; color: var(--txt2); }
        .smb-mobile-box { margin-left: auto; text-align: right; flex-shrink: 0; }
        .smb-mobile-label { font-size: 11px; color: var(--txt3); margin-bottom: 2px; }
        .smb-mobile-number { font-size: 17px; font-weight: 800; color: #34d399; letter-spacing: 0.5px; font-family: monospace; }
        .smb-mobile-empty { font-size: 13px; color: var(--txt3); }
        .smb-hint {
          display: flex; align-items: center; gap: 8px; background: var(--bg2); border: 1px solid var(--border);
          border-radius: 10px; padding: 12px 16px; font-size: 12.5px; color: var(--txt2); margin-top: 20px;
        }

        /* FIX: on narrow (mobile) viewports the input+button flex row no
           longer fits side-by-side within the card — the button was
           overflowing past the card's (and page's) right edge instead of
           wrapping. Below 480px, stack the input above a full-width
           button instead, and trim the card's own padding so nothing
           else pushes past the viewport either. */
        @media (max-width: 480px) {
          .smb-card { padding: 18px; max-width: 100%; }
          .smb-input-wrap { flex-direction: column; }
          .smb-btn { width: 100%; }
          .smb-mobile-box { margin-left: 0; text-align: left; }
        }
      `}</style>

      <div className="page-header" style={{ marginBottom: 24 }}>
        <h2 className="page-title" style={{ fontSize: 22, fontWeight: 800, color: 'var(--txt)' }}>
          Search Profile
        </h2>
        <p style={{ color: 'var(--txt2)', fontSize: 13, marginTop: 3 }}>
          Look up a Mobile Number by Student Roll, or by Teacher/Admin name
        </p>
      </div>

      <div className="smb-card">
        {canStaffSearch && (
          <div className="smb-tabs">
            <button className={`smb-tab ${mode === 'student' ? 'active' : ''}`} onClick={() => setMode('student')}>
              🎓 Student
            </button>
            <button className={`smb-tab ${mode === 'staff' ? 'active' : ''}`} onClick={() => setMode('staff')}>
              👤 Teacher / Admin
            </button>
          </div>
        )}

        {mode === 'student' ? (
          <>
            <div className="smb-title">📱 Search by Roll</div>
            <div className="smb-sub">See a Student's Mobile Number using their Roll (e.g. 800768)</div>

            <form onSubmit={handleRollSearch}>
              <div className="smb-input-wrap">
                <input
                  className="smb-input mono" type="text"
                  value={roll}
                  onChange={e => { setRoll(e.target.value); setRollError(''); setRollResult(null); }}
                  placeholder="Enter Roll number…" autoFocus
                />
                <button className="smb-btn" type="submit" disabled={rollLoading || !roll.trim()}>
                  <Icon name="search" size={15} />
                  {rollLoading ? 'Searching…' : 'Search'}
                </button>
              </div>
            </form>

            {rollError && <div className="smb-error">⚠️ {rollError}</div>}

            {rollResult && (
              <div className="smb-result">
                <div className="smb-avatar">{(rollResult.name || '?').trim().charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="smb-name">{rollResult.name}</div>
                  <div className="smb-meta">
                    Roll: {rollResult.studentId}
                    {rollResult.departmentId?.code ? ` · ${rollResult.departmentId.code}` : ''}
                    {rollResult.semester ? ` · Sem ${rollResult.semester}` : ''}
                    {rollResult.section ? ` · Group ${rollResult.section}` : ''}
                  </div>
                </div>
                <div className="smb-mobile-box">
                  <div className="smb-mobile-label">Mobile Number</div>
                  {rollResult.mobile
                    ? <div className="smb-mobile-number">{rollResult.mobile}</div>
                    : <div className="smb-mobile-empty">Not provided</div>}
                </div>
              </div>
            )}

            <div className="smb-hint">
              <Icon name="info" size={14} />
              You can only search Students in your Department / Shift
            </div>
          </>
        ) : (
          <>
            <div className="smb-title">📱 Search by Name</div>
            <div className="smb-sub">See a Teacher{roleLabel && "'s or Admin's"} Mobile Number by their name</div>

            <form onSubmit={handleStaffSearch}>
              <div className="smb-input-wrap">
                <input
                  className="smb-input" type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); setStaffError(''); setStaffResults(null); }}
                  placeholder="Enter name…" autoFocus
                />
                <button className="smb-btn" type="submit" disabled={staffLoading || !name.trim()}>
                  <Icon name="search" size={15} />
                  {staffLoading ? 'Searching…' : 'Search'}
                </button>
              </div>
            </form>

            {staffError && <div className="smb-error">⚠️ {staffError}</div>}

            {staffResults && staffResults.length === 0 && (
              <div className="smb-error" style={{ background: 'var(--bg2)', color: 'var(--txt2)', border: '1px solid var(--border)' }}>
                No match found
              </div>
            )}

            {staffResults && staffResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
                {staffResults.map(person => (
                  <div className="smb-result" key={person.id || person._id} style={{ marginTop: 0 }}>
                    <div className="smb-avatar">{(person.name || '?').trim().charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="smb-name">{person.name}</div>
                      <div className="smb-meta">
                        {roleLabel[person.role] || person.role}
                        {person.departmentId?.code ? ` · ${person.departmentId.code}` : ''}
                        {person.semester ? ` · Sem ${person.semester}` : ''}
                        {person.shift ? ` · ${person.shift} shift` : ''}
                      </div>
                    </div>
                    <div className="smb-mobile-box">
                      <div className="smb-mobile-label">Mobile Number</div>
                      {person.mobile
                        ? <div className="smb-mobile-number">{person.mobile}</div>
                        : <div className="smb-mobile-empty">Not provided</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="smb-hint">
              <Icon name="info" size={14} />
              Search results are limited to your Admin scope
            </div>
          </>
        )}
      </div>
    </div>
  );
}
