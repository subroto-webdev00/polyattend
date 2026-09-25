'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import { isStrongPassword } from '@/lib/validatePassword';

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

// Used by Department Admin, Semester Admin, and Teacher to complete registration
// after they receive a 12-digit invite code by email from the admin above
// them (Admin → Department Admin, Department Admin → Semester Admin, Semester
// Admin → Teacher). They only need to supply Email + Code + Password —
// name, department, shift, semester, subject etc. were already fixed by
// whoever sent the invite.
function AdminRegisterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillEmail = searchParams.get('email') || '';

  const [email, setEmail] = useState(prefillEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (prefillEmail) setEmail(prefillEmail); }, [prefillEmail]);

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !code || !password) return toast.error('Enter Email, Code and Password');
    const pwCheck = isStrongPassword(password);
    if (!pwCheck.ok) return toast.error(pwCheck.message);
    // Client-side format check only when something was entered — whether
    // it's actually REQUIRED (Teacher accounts) is decided server-side,
    // since this shared page doesn't know the invite's role in advance.
    if (mobile.trim() && !/^01[0-9]{9}$/.test(mobile.trim())) {
      return toast.error('Enter a valid 11-digit mobile number (e.g. 01XXXXXXXXX)');
    }

    setLoading(true);
    try {
      await api.post('/auth/admin-register', { email, code, password, mobile: mobile.trim() || undefined });
      toast.success('Registration successful! You can now Login 🎉');
      router.push('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed. Please check the Code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />

      <div className="auth-card" style={{ maxWidth: 420, animation: 'authFadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div className="auth-logo">
          <div className="auth-logo-icon"><Icon name="lock" size={28} /></div>
          <h1 className="auth-title">Admin Registration</h1>
          <p className="auth-sub">
            Department Admin / Semester Admin / Teacher — complete registration with the Code sent to your email
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address *</label>
            <input
              className="form-input" type="email" placeholder="your@email.com"
              value={email} onChange={e => setEmail(e.target.value)}
              required autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Registration Code *</label>
            <input
              className="form-input" type="text"
              placeholder="12-digit code (sent to your email)"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              required
              maxLength={12}
              style={{ letterSpacing: 3, fontFamily: 'monospace', fontSize: 16, textAlign: 'center' }}
            />
            <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 6 }}>
              If you didn't receive the email, check your Spam/Junk folder. The code is valid for 1 month.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Mobile Number</label>
            <input
              className="form-input" type="tel"
              placeholder="01XXXXXXXXX"
              value={mobile}
              onChange={e => setMobile(e.target.value)}
              maxLength={11}
              style={{ fontFamily: 'monospace' }}
            />
            <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 6 }}>
              Required for Teacher accounts — your Semester Admin may need to call you if a class needs covering.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password *</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input" type={showPass ? 'text' : 'password'}
                placeholder="At least 8 characters, with upper&lowercase and a number"
                value={password} onChange={e => setPassword(e.target.value)}
                required style={{ paddingRight: 42 }}
              />
              <button type="button" onClick={() => setShowPass(p => !p)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)' }}>
                <Icon name="eye" size={16} />
              </button>
            </div>
            {strength && (
              <>
                <div style={{ height: 5, borderRadius: 4, background: 'var(--border2)', overflow: 'hidden', marginTop: 6 }}>
                  <div style={{ height: '100%', borderRadius: 4, width: strength.width, background: strength.color, transition: 'width .3s ease' }} />
                </div>
                <div style={{ fontSize: 11, color: strength.color, marginTop: 4, fontWeight: 600 }}>{strength.label}</div>
              </>
            )}
          </div>

          <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? <><div className="spinner spinner-sm" /> Registering...</> : 'Complete Registration →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--txt2)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Login</Link>
        </p>
      </div>
    </div>
  );
}

export default function AdminRegisterPage() {
  return (
    <React.Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>}>
      <AdminRegisterPageInner />
    </React.Suspense>
  );
}
