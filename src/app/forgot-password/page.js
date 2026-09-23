'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return toast.error('Enter your registered email address');

    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      toast.success(res.data?.message || 'Reset code sent to your email!');
      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <style> jsx{`
        @keyframes fpFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .fp-anim { animation: fpFadeUp .5s cubic-bezier(.16,1,.3,1) both; }
        .fp-submit { position: relative; overflow: hidden; }
        .fp-submit:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 12px 28px -8px rgba(22,163,74,0.5); }
        .fp-submit:not(:disabled):active { transform: translateY(0) scale(0.98); }
        .fp-back-link { position: relative; text-decoration: none; }
        .fp-back-link::after {
          content: ''; position: absolute; left: 18px; bottom: -2px; width: 0; height: 1px;
          background: #34d399; transition: width .25s ease;
        }
        .fp-back-link:hover::after { width: calc(100% - 18px); }
        .fp-icon-pulse { animation: authGlowPulse 3s ease-in-out infinite; }
      `}</style>

      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />

      <div className="auth-card fp-anim" style={{ maxWidth: 420 }}>
        {/* Header */}
        <div className="auth-logo">
          <div className="auth-logo-icon fp-icon-pulse">
            <Icon name="lock" size={28} />
          </div>
          <h1 className="auth-title">Forgot Password?</h1>
          <p className="auth-sub" style={{ lineHeight: 1.6 }}>
            Enter your account's registered email. We'll send an OTP to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                color: focused ? '#34d399' : 'rgba(255,255,255,0.35)', transition: 'color 0.2s ease',
                display: 'flex', pointerEvents: 'none',
              }}>
                <Icon name="mail" size={16} />
              </span>
              <input
                type="email"
                required
                placeholder="your@email.edu"
                className="form-input"
                style={{ paddingLeft: 40 }}
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                autoComplete="email"
                autoFocus
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary fp-submit" style={{ marginTop: 8 }}>
            {loading
              ? <><div className="spinner spinner-sm" /> Sending code...</>
              : 'Send OTP Code →'}
          </button>
        </form>

        <div style={{ marginTop: 22, textAlign: 'center' }}>
          <Link href="/login" className="fp-back-link" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.55)',
          }}>
            <Icon name="chevronLeft" size={14} /> Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
