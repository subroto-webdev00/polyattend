'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';

function VerifyEmailPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get email from router state (comes when navigating from RegisterPage)
  // fallback: URL query string ?email=...
  const stateEmail = searchParams.get('email') || '';
  const prefillEmail = stateEmail;

  const [email, setEmail] = useState(prefillEmail);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0); // resend cooldown

  useEffect(() => {
    if (prefillEmail) setEmail(prefillEmail);
  }, [prefillEmail]);

  // Resend countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !otp) return toast.error('Enter email and verification OTP');
    if (otp.length < 6) return toast.error('OTP must be at least 6 digits');

    setLoading(true);
    try {
      await api.post('/auth/verify-email', { email, otp });
      toast.success('Email verification successful! 🎉');
      router.push('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed. Please check the OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return toast.error('Enter email first');
    if (countdown > 0) return;

    setResending(true);
    try {
      await api.post('/auth/resend-verification', { email });
      toast.success('New OTP sent! Check your email 📧');
      setCountdown(60); // 60 second cooldown
      setOtp('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send OTP, please try again');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />

      <div className="auth-card" style={{ maxWidth: 420, animation: 'authFadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>

        {/* Header */}
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <Icon name="mail" size={28} />
          </div>
          <h1 className="auth-title">Verify Email</h1>
          <p className="auth-sub">
            {email
              ? <><strong>{email}</strong>-A 6-digit code has been sent to</>
              : 'Enter the OTP code sent to your email'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Email — only shown if not prefilled */}
          {!stateEmail && (
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                className="form-input"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          )}

          {/* OTP Input */}
          <div className="form-group">
            <label className="form-label">Verification Code (OTP)</label>
            <input
              className="form-input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="• • • • • •"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              required
              autoFocus
              style={{ letterSpacing: 8, fontSize: 20, textAlign: 'center' }}
            />
            <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 6 }}>
              If you didn't receive the email, check your Spam/Junk folder
            </div>
          </div>

          <button
            className="btn-primary"
            type="submit"
            disabled={loading || otp.length < 6}
            style={{ marginTop: 4 }}
          >
            {loading
              ? <><div className="spinner spinner-sm" /> Verifying...</>
              : 'Verify →'}
          </button>
        </form>

        {/* Resend OTP */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--txt2)' }}>Didn't get the code? </span>
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || countdown > 0}
            style={{
              background: 'none', border: 'none', cursor: countdown > 0 ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 600,
              color: countdown > 0 ? 'var(--txt3)' : 'var(--primary)',
              padding: 0
            }}
          >
            {resending
              ? 'Sending...'
              : countdown > 0
                ? `Resend (${countdown}s)`
                : 'Resend'}
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: 'var(--txt2)' }}>
          <Link href="/login" style={{ color: 'var(--txt3)', textDecoration: 'none' }}>
            ← Back to Login
          </Link>
        </p>

      </div>
    </div>
  );
}
export default function VerifyEmailPage() {
  return (
    <React.Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>}>
      <VerifyEmailPageInner />
    </React.Suspense>
  );
}
