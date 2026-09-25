'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import Icon from '@/components/common/Icon';
import Modal from '@/components/common/Modal';
import api from '@/utils/api';


function TypeWriter({ text, delay = 0, speed = 40 }) {
  const [displayed, setDisplayed] = useState('');
  const [started, setStarted] = useState(false);

  React.useEffect(() => {
    const startTimer = setTimeout(() => {
      setStarted(true);
    }, delay * 1000);
    return () => clearTimeout(startTimer);
  }, [delay]);

  React.useEffect(() => {
    if (!started) return;
    if (displayed.length >= text.length) return;
    const timer = setTimeout(() => {
      setDisplayed(text.slice(0, displayed.length + 1));
    }, speed);
    return () => clearTimeout(timer);
  }, [started, displayed, text, speed]);

  return (
    <span>
      {displayed}
      {started && displayed.length < text.length && (
        <span style={{ animation: 'blink 0.7s step-end infinite', opacity: 1 }}>|</span>
      )}
    </span>
  );
}

export default function LoginPage() {
  const { login, verifyLoginOtp } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [activeRole, setActiveRole] = useState('student');

  // 2FA step (Admin / Department Admin / Semester Admin only): after
  // password verification, the account gets emailed an OTP and this page
  // switches to asking for it instead of granting a token immediately.
  const [otpStep, setOtpStep] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ name: '', email: '', message: '' });
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) return toast.error('Enter Email and Password');
    setLoading(true);
    try {
      const result = await login(form.email, form.password);
      if (result.requiresOtp) {
        setOtpEmail(result.email);
        setOtpStep(true);
        toast.success('Login OTP has been sent to your email');
        return;
      }
      toast.success(`Welcome, ${result.name}! 🎉`);
      router.push(`/${result.role}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (!otp) return toast.error('Enter OTP');
    setOtpLoading(true);
    try {
      const user = await verifyLoginOtp(otpEmail, otp);
      toast.success(`Welcome, ${user.name}! 🎉`);
      router.push(`/${user.role}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Wrong OTP. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackForm.name || !feedbackForm.email || !feedbackForm.message) {
      return toast.error('Please fill in all fields');
    }
    setFeedbackLoading(true);
    try {
      await api.post('/feedback', feedbackForm);
      toast.success('Feedback submitted successfully! Thank you.');
      setFeedbackForm({ name: '', email: '', message: '' });
      setShowFeedbackModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Feedback submission failed.');
    } finally {
      setFeedbackLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-8 gap-7 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d1f0f 40%, #071a0a 70%, #060c18 100%)' }}>
      {/* Ambient orbs */}
      <div className="absolute -top-40 -left-24 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(20,184,166,0.15) 0%, transparent 70%)' }} />
      <div className="absolute -bottom-32 -right-16 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(22,163,74,0.18) 0%, transparent 70%)' }} />
      <div className="absolute top-1/2 -left-20 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)', transform: 'translateY(-50%)' }} />

      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
          backgroundSize: '44px 44px'
        }} />

      {/* Institute Header */}
      <div className="text-center relative z-10 max-w-lg">
        <div className="inline-flex items-center gap-1.5 bg-teal-500/10 border border-teal-500/25 text-teal-300 text-[10px] font-bold tracking-[1.8px] px-3.5 py-1.5 rounded-full mb-4 uppercase"
          style={{ animation: 'fadeUp 0.5s ease both' }}>
          <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          OFFICIAL PORTAL
        </div>

        <h1 className="text-white font-black text-2xl sm:text-3xl leading-tight tracking-tight mb-2"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <TypeWriter text="Thakurgaon Polytechnic Institute" delay={0.6} speed={35} />
        </h1>

        <p className="text-teal-300 text-[11px] font-bold tracking-[2.5px] uppercase mb-2">
          <TypeWriter text="STUDENT ATTENDANCE LOGIN PORTAL" delay={1.8} speed={40} />
        </p>

        <p className="text-white/40 text-[13px]">
          <TypeWriter text="Thakurgaon Polytechnic Institute — Digital Attendance Management" delay={3.0} speed={30} />
        </p>

        {/* Download App Button */}
        <a
          href="/downloads/app-debug.apk"
          download="PolyAttend.apk"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full text-[12px] font-bold text-emerald-300 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all duration-200"
          style={{
            animation: 'fadeUp 0.5s ease both',
            animationDelay: '3.5s',
            opacity: 0
          }}
        >
          <svg
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          Download Android App
        </a>
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-[410px] rounded-[18px] p-7"
        style={{
          background: 'rgba(9,18,32,0.96)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderTopColor: 'rgba(45,212,191,0.12)',
          boxShadow: '0 40px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
          animation: 'cardColorShift 6s ease-in-out infinite'
        }}>

        {/* Card Title */}
        <div className="text-center mb-6">
          <h2 className="text-teal-300 text-[13px] font-extrabold tracking-[2.5px] mb-1.5"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            LOGIN PORTAL
          </h2>
          <p className="text-white/40 text-[13px]">Login with your account</p>
        </div>

        {/* Role Tabs */}
        {!otpStep && (
          <div className="flex p-1 rounded-xl mb-6 gap-4 login-field-anim"
            style={{ animationDelay: "80ms", background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { key: 'student', label: '🎓 STUDENT' },
              { key: 'teacher', label: '👨‍🏫 TEACHER' },
            ].map(r => (
              <button
                key={r.key}
                type="button"
                onClick={() => setActiveRole(r.key)}
                className={`flex-1 py-2.5 rounded-[9px] text-white/100 text-[11px] font-bold tracking-[0.8px] transition-all duration-200 border ${activeRole === r.key

                  }`}
                style={activeRole === r.key ? {
                  background: 'linear-gradient(135deg, rgba(22,163,74,0.2), rgba(74,222,128,0.1))',
                  boxShadow: '0 2px 14px rgba(22,163,74,0.12)'
                } : {}}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}

        {otpStep ? (
          <form onSubmit={handleOtpSubmit}>
            <div className="mb-4 text-center login-field-anim" style={{ animationDelay: '80ms' }}>
              <p className="text-white/70 text-[13px]">
                🔐 <strong className="text-teal-300">{otpEmail}</strong>-Sent a 6-digit OTP to your email
              </p>
            </div>

            <div className="mb-5 relative login-field-anim" style={{ animationDelay: '140ms' }}>
              <input
                type="text"
                placeholder="Enter OTP"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
                maxLength={6}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/30 text-white text-lg outline-none transition-all duration-300 placeholder:text-white/40 hover:border-emerald-500 hover:bg-emerald-500/10 focus:bg-emerald-500/15 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-center"
                style={{ letterSpacing: 8, fontFamily: 'monospace' }}
              />
            </div>

            <button
              type="submit"
              disabled={otpLoading}
              className="w-full py-3.5 rounded-[9px] text-white text-[15px] font-bold flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 login-submit-btn login-field-anim"
              style={{
                background: 'linear-gradient(135deg, #16a34a, #22c55e)',
                boxShadow: '0 4px 20px rgba(22,163,74,0.3)',
                fontFamily: 'inherit',
                animationDelay: '200ms'
              }}
            >
              {otpLoading
                ? <><div className="spinner spinner-sm" style={{ borderColor: 'rgba(255,255,255,0.25)', borderTopColor: '#fff' }} /> Verifying...</>
                : <>✅ Verify</>}
            </button>

            <button
              type="button"
              onClick={() => { setOtpStep(false); setOtp(''); }}
              className="w-full mt-3 py-2 text-white/50 hover:text-white/80 text-[12px] font-semibold transition-colors"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              ← Back to Login page
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div className="mb-4 relative login-field-anim" style={{ animationDelay: "140ms" }}>
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 flex pointer-events-none z-10">
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </span>
              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                autoComplete="email"
                autoFocus
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/10 border border-white/30 text-white text-sm outline-none transition-all duration-300 placeholder:text-white/40 hover:border-emerald-500 hover:bg-emerald-500/10 focus:bg-emerald-500/15 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"

              />
            </div>

            {/* Password */}
            <div className="mb-3 relative login-field-anim" style={{ animationDelay: "200ms" }}>
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 flex pointer-events-none z-10">
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Password"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                autoComplete="current-password"
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/25 text-white text-sm outline-none transition-all duration-200 placeholder:text-white/38 hover:border-emerald-500/60 hover:bg-emerald-500/8 focus:bg-emerald-500/10 focus:border-emerald-400 focus:shadow-[0_0_0_2px_rgba(52,211,153,0.2)]"
              />
              <button
                type="button"
                onClick={() => setShowPass(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors p-1 rounded"
              >
                <Icon name="eye" size={15} />
              </button>
            </div>

            {/* Forgot */}
            <div className="text-right mb-5">
              <Link href="/forgot-password" className="text-teal-300/75 hover:text-teal-300 text-[12px] font-semibold no-underline transition-colors">
                Forgot Password?
              </Link>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-[9px] text-white text-[15px] font-bold flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 login-submit-btn login-field-anim"
              style={{
                background: 'linear-gradient(135deg, #16a34a, #22c55e)',
                boxShadow: '0 4px 20px rgba(22,163,74,0.3)',
                fontFamily: 'inherit',
                animationDelay: '260ms'
              }}
            >
              {loading
                ? <><div className="spinner spinner-sm" style={{ borderColor: 'rgba(255,255,255,0.25)', borderTopColor: '#fff' }} /> Logging in...</>
                : <>🔑 Login</>}
            </button>
          </form>
        )}

        <p className="text-center text-[13px] text-white/100 mt-5">
          New account?{' '}
          <Link href="/register" className="text-green-400 font-bold no-underline hover:text-green-300 transition-colors">
            Register
          </Link>
        </p>

        {/* Feedback button */}
        <div className="flex justify-center mt-4">
          <button
            type="button"
            onClick={() => setShowFeedbackModal(true)}
            className="flex items-center gap-2 text-white/60 hover:text-white/90 text-[11px] font-semibold px-5 py-2.5 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
              fontFamily: 'inherit'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.10)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.22)';
              e.currentTarget.style.boxShadow = '0 6px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.12)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.08)';
            }}
          >
            <Icon name="chat" size={12} />
            <span className='text-white/100'>Need Help?</span>
            <span className="text-emerald-400">Give Feedback</span>
          </button>
        </div>

        {/* Feedback Modal */}
        <Modal open={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} sheetStyle={{ maxWidth: 420 }}>
          <div className="flex justify-between items-center mb-1">
            <h3 className="modal-title" style={{ marginBottom: 0 }}>Need Help or Have Feedback?</h3>
            <button onClick={() => setShowFeedbackModal(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', display: 'flex', padding: 4 }}>
              <Icon name="close" size={18} />
            </button>
          </div>
          <p className="text-[13px] text-[var(--txt2)] mb-4">Let us know if you have any login issues or feedback.</p>
          <form onSubmit={handleFeedbackSubmit}>
            <div className="form-group">
              <label className="form-label">Your Name</label>
              <input type="text" required className="form-input" placeholder="John Doe"
                value={feedbackForm.name} onChange={e => setFeedbackForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input type="email" required className="form-input" placeholder="john@example.com"
                value={feedbackForm.email} onChange={e => setFeedbackForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Your Message</label>
              <textarea required rows={4} className="form-input"
                placeholder="Describe your issue or feedback here..."
                style={{ resize: 'none', height: 'auto' }}
                value={feedbackForm.message} onChange={e => setFeedbackForm(p => ({ ...p, message: e.target.value }))} />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setShowFeedbackModal(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={feedbackLoading}>
                {feedbackLoading ? <><div className="spinner spinner-sm" /> Submitting...</> : 'Submit Feedback'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}