'use client';
import React, { useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import { isStrongPassword } from '@/lib/validatePassword';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getPasswordStrength(pw) {
  if (!pw) return null;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { label: 'Weak Password', color: '#ef4444', width: '34%' };
  if (score <= 4) return { label: 'Medium Password', color: '#f59e0b', width: '67%' };
  return { label: 'Strong Password', color: '#22c55e', width: '100%' };
}

export default function RegisterPage() {
  const router = useRouter();
  const role = 'student';
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({
    email: '', password: '',
    studentId: '', preApprovalCode: '', mobile: '',
  });

  // Small derived values — only for UI hint/animation, submit validation stays as-is
  const emailValid = EMAIL_REGEX.test(form.email);
  const passwordValid = isStrongPassword(form.password).ok;
  const strength = getPasswordStrength(form.password);

  const set = field => e => setForm(p => ({ ...p, [field]: e.target.value }));
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) return toast.error('Email and Password are required');
    if (!EMAIL_REGEX.test(form.email)) return toast.error('Enter a valid Email address');
    const pwCheck = isStrongPassword(form.password);
    if (!pwCheck.ok) return toast.error(pwCheck.message);
    if (!form.studentId) return toast.error('Enter your Student Roll');
    if (!form.mobile.trim()) return toast.error('Mobile Number is required');
    if (!/^01[0-9]{9}$/.test(form.mobile.trim())) return toast.error('Enter a valid 11-digit mobile number (e.g. 01XXXXXXXXX)');
    if (!form.preApprovalCode) return toast.error('Enter the Registration Code sent by your Semester Admin');
    setLoading(true);
    try {
      await api.post('/auth/register-public', { ...form, role });
      toast.success('Registration successful! Please verify your Email 📧');
      router.push(`/verify-email?email=${encodeURIComponent(form.email)}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed'); // backend error shown here
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page rp-page" style={{ alignItems: 'flex-start', paddingTop: 24, paddingBottom: 24 }}>
      <style suppressHydrationWarning>{`
        @keyframes rpFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes rpFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes rpPopIn { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: scale(1); } }
        @keyframes rpSlideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes rpShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

        .rp-card-animate { animation: rpFadeUp .55s cubic-bezier(.16,1,.3,1) both; }
        .rp-logo-float { animation: rpFloat 3.2s ease-in-out infinite; }
        .rp-anim-field { animation: rpFadeUp .45s cubic-bezier(.16,1,.3,1) both; }
        .rp-section-enter { animation: rpFadeUp .4s cubic-bezier(.16,1,.3,1) both; }
        .rp-inline-error { animation: rpSlideDown .25s ease both; }

        .rp-check {
          display: inline-flex; align-items: center; justify-content: center;
          color: #22c55e; font-weight: 700; line-height: 1;
          animation: rpPopIn .3s cubic-bezier(.34,1.56,.64,1) both;
        }

        .rp-toggle-btn, .rp-role-btn {
          transition: transform .22s cubic-bezier(.34,1.56,.64,1), border-color .22s ease, background .22s ease, box-shadow .22s ease;
        }
        .rp-toggle-btn:hover, .rp-role-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 18px -10px rgba(0,0,0,0.28); }
        .rp-toggle-btn.is-selected, .rp-role-btn.is-selected { transform: scale(1.02); }
        .rp-toggle-btn:active, .rp-role-btn:active { transform: scale(0.97); }

        .rp-input-wrap { position: relative; }
        .rp-eye-btn { transition: transform .2s ease, color .2s ease; }
        .rp-eye-btn:hover { color: var(--primary); }
        .rp-eye-spin { display: inline-flex; transition: transform .35s ease; }

        .rp-strength-track { height: 5px; border-radius: 4px; background: var(--border2); overflow: hidden; margin-top: 6px; }
        .rp-strength-bar { height: 100%; border-radius: 4px; transition: width .35s cubic-bezier(.16,1,.3,1), background-color .35s ease; }

        .rp-submit { position: relative; overflow: hidden; transition: transform .2s ease, box-shadow .2s ease, filter .2s ease; }
        .rp-submit:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 12px 24px -12px var(--primary); filter: brightness(1.05); }
        .rp-submit:not(:disabled):active { transform: translateY(0) scale(0.98); }
        .rp-submit::after {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%);
          background-size: 200% 100%; background-position: -200% 0;
        }
        .rp-submit:not(:disabled):hover::after { animation: rpShimmer 1.1s ease; }

        .rp-login-link { position: relative; text-decoration: none; }
        .rp-login-link::after {
          content: ''; position: absolute; left: 0; bottom: -2px; width: 0; height: 1px;
          background: var(--primary); transition: width .25s ease;
        }
        .rp-login-link:hover::after { width: 100%; }

        @media (prefers-reduced-motion: reduce) {
          .rp-card-animate, .rp-logo-float, .rp-anim-field, .rp-section-enter,
          .rp-check, .rp-inline-error, .rp-toggle-btn, .rp-role-btn,
          .rp-submit::after, .rp-eye-spin, .rp-strength-bar, .rp-login-link::after {
            animation: none !important; transition: none !important;
          }
        }
      `}</style>

      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />

      <div className="auth-card rp-card-animate" style={{ maxWidth: 420 }}>
        <div className="auth-logo">
          <div className="auth-logo-icon rp-logo-float"><Icon name="school" size={28} /></div>
          <h1 className="auth-title">New Account</h1>
          <p className="auth-sub">Join PolyAttend</p>
        </div>

        {/* MISTAKE FIX: Teacher self-registration (role selector + secret key)
            removed. Teacher accounts are now created only via a
            Semester Admin invite. This page now handles Student
            self-registration only. */}
        <p className="auth-sub" style={{ marginBottom: 20 }}>🎓 Student Registration</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group rp-anim-field" style={{ animationDelay: '120ms' }}>
            <label className="form-label">Email *</label>
            <div className="rp-input-wrap">
              <input
                className="form-input"
                type="email"
                placeholder="your@email.com"
                value={form.email}
                onChange={set('email')}
                required
                style={{ paddingRight: 36 }}
              />
              {form.email && emailValid && (
                <span className="rp-check" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>✓</span>
              )}
            </div>
            {form.email && !emailValid && (
              <span className="rp-inline-error" style={{ color: 'red', fontSize: '13px', marginTop: '4px', display: 'block' }}>
                Enter a valid Email address
              </span>
            )}
          </div>

          <div className="form-group rp-anim-field" style={{ animationDelay: '180ms' }}>
            <label className="form-label">Password *</label>
            <div className="rp-input-wrap">
              <input
                className="form-input"
                type={showPass ? 'text' : 'password'}
                placeholder="At least 8 characters, with upper&lowercase and a number"
                value={form.password}
                onChange={set('password')}
                required
                style={{ paddingRight: 68 }}
              />
              {passwordValid && (
                <span className="rp-check" style={{ position: 'absolute', right: 42, top: '50%', transform: 'translateY(-50%)' }}>✓</span>
              )}
              <button type="button" className="rp-eye-btn" onClick={() => setShowPass(p => !p)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)' }}>
                <span className="rp-eye-spin" style={{ transform: showPass ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                  <Icon name="eye" size={16} />
                </span>
              </button>
            </div>
            {strength && (
              <>
                <div className="rp-strength-track">
                  <div className="rp-strength-bar" style={{ width: strength.width, background: strength.color }} />
                </div>
                <div style={{ fontSize: 11, color: strength.color, marginTop: 4, fontWeight: 600 }}>{strength.label}</div>
              </>
            )}
          </div>

          {/* Student Section */}
          {role === 'student' && (
            <div key="student-section" className="rp-section-enter">
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '14px 0' }} />
              <div style={{ fontSize: 18, fontWeight: 600, color: '#4ade80', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 }}>Student Information</div>
              <div className="form-group">
                <label className="form-label">Student Roll</label>
                <input className="form-input" placeholder="e.g. 800768" value={form.studentId} onChange={set('studentId')} required />
              </div>
              <div className="form-group rp-anim-field" style={{ animationDelay: '220ms' }}>
                <label className="form-label">Mobile Number *</label>
                <input
                  className="form-input"
                  type="tel"
                  placeholder="01XXXXXXXXX"
                  value={form.mobile}
                  onChange={set('mobile')}
                  required
                  style={{ letterSpacing: 1 }}
                />
                <span style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 4, display: 'block' }}>
                  Only admins will see this number, for contact purposes
                </span>
              </div>
              <div className="form-group">
                <label className="form-label">Registration Code *</label>
                <input
                  className="form-input" placeholder="12-digit code (sent to your email)"
                  value={form.preApprovalCode}
                  onChange={e => setForm(p => ({ ...p, preApprovalCode: e.target.value.toUpperCase() }))}
                  required maxLength={12}
                  style={{ letterSpacing: 2, fontFamily: 'monospace' }}
                />
                <span style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 4, display: 'block' }}>
                  Your Semester Admin sent this code to this Roll + Email. Check your Spam folder.
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--txt3)', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 4 }}>
                🎓 Your Name, Department, Semester, Group and Shift were already set by your Semester Admin — no need to enter them again.
              </div>
            </div>
          )}

          <button className="btn-primary rp-submit" type="submit" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? <><div className="spinner spinner-sm" /> Registering...</> : 'Register →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--txt2)' }}>
          Already have an account?{' '}
          <Link href="/login" className="rp-login-link" style={{ color: 'var(--primary)', fontWeight: 600 }}>Login</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 8, fontSize: 12.5, color: 'var(--txt3)' }}>
          Semester Admin / Teacher?{' '}
          <Link href="/admin-register" className="rp-login-link" style={{ color: 'var(--txt2)', fontWeight: 600 }}>Admin Registration</Link>
        </p>
      </div>
    </div>
  );
}