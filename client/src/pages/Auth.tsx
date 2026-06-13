import { useEffect, useRef, useState } from 'react';
import { Chrome, KeyRound, Loader2, Lock, Mail, RotateCcw, ShieldCheck, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SnakeMascot from '../components/SnakeMascot';
import { api, saveSession } from '../lib/api';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const configuredGoogleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
type Mode = 'login' | 'register' | 'forgot' | 'reset' | 'verify';

export default function Auth() {
  const [mode, setMode] = useState<Mode>('login');
  const [googleClientId, setGoogleClientId] = useState(configuredGoogleClientId);
  const [form, setForm] = useState({
    name: '',
    email: 'student@example.com',
    password: 'Student@123',
    college: 'Demo Engineering College',
    code: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [snakeBiting, setSnakeBiting] = useState(false);
  const [showEntryVideo, setShowEntryVideo] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  function finishLogin(token: string, user: any) {
    saveSession(token, user);
    setMessage('Login successful. Opening dashboard...');
    setSnakeBiting(true);
    setShowEntryVideo(true);
    window.setTimeout(() => navigate('/'), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 250 : 2000);
  }

  useEffect(() => {
    if (configuredGoogleClientId) return;
    api<{ googleClientId: string }>('/auth/config').then((config) => setGoogleClientId(config.googleClientId)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!googleClientId) return;

    const renderGoogleButton = () => {
      if (!window.google || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          setError('');
          setMessage('');
          setLoading(true);
          try {
            if (!response.credential) throw new Error('Google did not return a sign-in credential.');
            const result = await api<{ token: string; user: any }>('/auth/google', {
              method: 'POST',
              body: JSON.stringify({ credential: response.credential, college: form.college })
            });
            finishLogin(result.token, result.user);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Google sign-in failed.');
          } finally {
            setLoading(false);
          }
        }
      });
      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        text: 'continue_with',
        shape: 'rectangular',
        width: 360
      });
    };

    if (window.google) {
      renderGoogleButton();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    script.onerror = () => setError('Could not load Google sign-in. Check your internet connection.');
    document.head.appendChild(script);
  }, [form.college, googleClientId, navigate]);

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
    setMessage('');
  }

  async function submitAccount(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register';
      const payload = mode === 'login' ? { email: form.email, password: form.password } : { name: form.name, email: form.email, password: form.password, college: form.college };
      const result = await api<{ token: string; user: any; message?: string; devCode?: string }>(path, { method: 'POST', body: JSON.stringify(payload) });
      if (mode === 'register') {
        saveSession(result.token, result.user);
        setMessage(`${result.message || 'Account created. OTP sent.'}${result.devCode ? ` Development OTP: ${result.devCode}` : ''}`);
        setMode('verify');
      } else {
        finishLogin(result.token, result.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : mode === 'login' ? 'Login failed.' : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  async function sendForgotOtp(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const result = await api<{ message: string; devCode?: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: form.email }) });
      setMessage(`${result.message}${result.devCode ? ` Development OTP: ${result.devCode}` : ''}`);
      setMode('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send password reset code.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyEmail(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const result = await api<{ message: string }>('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email: form.email, code: form.code, purpose: 'email_verification' }) });
      setMessage(result.message);
      window.setTimeout(() => navigate('/'), 450);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const result = await api<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: form.email, code: form.code, newPassword: form.newPassword, confirmPassword: form.confirmPassword })
      });
      setMessage(result.message);
      setMode('login');
      setForm({ ...form, password: '', code: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  }

  const title =
    mode === 'login' ? 'Login to your account' :
    mode === 'register' ? 'Create student account' :
    mode === 'forgot' ? 'Forgot password' :
    mode === 'verify' ? 'Verify your email' :
    'Reset password';

  return (
    <div className="auth-snake-page min-h-screen overflow-hidden text-white">
      {showEntryVideo && (
        <div className="login-entry-video" aria-label="Opening Py Kidda Hub dashboard">
          <video src="/login-entry.mp4" autoPlay muted playsInline preload="auto" />
          <div className="login-entry-glass">
            <div className="text-sm font-bold text-cyan-100">Opening PY Kidda Hub</div>
            <div className="mt-1 text-xs text-slate-300">Preparing your dashboard...</div>
          </div>
        </div>
      )}
      <section className="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-4 py-5 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-8">
        <div className="relative flex min-h-[360px] flex-col justify-between overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950/70 p-6 shadow-[0_24px_80px_rgba(15,23,42,.45)] lg:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,.18),transparent_32%),radial-gradient(circle_at_82%_28%,rgba(168,85,247,.18),transparent_30%)]" />
          <div className="relative z-10 flex items-center gap-3">
            <img className="h-14 w-14 rounded-xl bg-white object-cover shadow-[0_0_28px_rgba(34,211,238,.45)]" src="/py-kidda-hub-logo.png" alt="PY Kidda Hub logo" />
            <div>
              <div className="text-xl font-black">PY Kidda Hub(PKH)</div>
              <div className="text-sm font-semibold text-cyan-100">Be a PY kidda with us</div>
            </div>
          </div>
          <div className="relative z-10 grid items-end gap-5 xl:grid-cols-[0.88fr_1.12fr]">
            <div className="pb-4">
              <div className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-bold text-cyan-100">Interactive Python login</div>
              <h1 className="mt-4 text-4xl font-black leading-tight tracking-normal md:text-6xl">Code. Learn. Achieve.</h1>
              <p className="mt-4 max-w-md text-base leading-7 text-slate-200">A playful coding gateway with secure Google login, OTP recovery, and your own student progress vault.</p>
            </div>
            <SnakeMascot biting={snakeBiting} />
          </div>
        </div>

        <section className="flex items-center justify-center">
          <div className={`auth-card w-full max-w-md p-6 ${snakeBiting ? 'auth-card-success' : ''}`}>
            <div className="mb-5">
              <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-xs font-bold text-cyan-100">
                <ShieldCheck size={15} />
                Secure student access
              </div>
              <h2 className="text-2xl font-black text-white">{title}</h2>
              <p className="mt-1 text-sm text-slate-300">Use Google or email/password. OTP codes expire in 10 minutes.</p>
            </div>

          {(mode === 'login' || mode === 'register') && (
            <div className="mb-5 grid grid-cols-2 rounded-md bg-white/10 p-1">
              <button type="button" className={`rounded px-3 py-2 text-sm font-bold ${mode === 'login' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-300'}`} onClick={() => switchMode('login')}>
                Login
              </button>
              <button type="button" className={`rounded px-3 py-2 text-sm font-bold ${mode === 'register' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-300'}`} onClick={() => switchMode('register')}>
                Sign Up
              </button>
            </div>
          )}

          {(mode === 'login' || mode === 'register') && (
            <div className="mb-4">
              {googleClientId ? (
                <div className="flex min-h-11 items-center justify-center rounded-md border border-slate-200 bg-white p-1" ref={googleButtonRef} />
              ) : (
                <button className="btn btn-soft w-full" type="button" disabled>
                  <Chrome size={16} />
                  Continue with Google
                </button>
              )}
              {!googleClientId && <div className="mt-2 text-xs text-amber-700">Google sign-in needs GOOGLE_CLIENT_ID on the server and VITE_GOOGLE_CLIENT_ID on the client.</div>}
              <div className="my-4 flex items-center gap-3 text-xs font-bold uppercase tracking-normal text-slate-400">
                <div className="h-px flex-1 bg-white/15" /> or use email <div className="h-px flex-1 bg-white/15" />
              </div>
            </div>
          )}

          {(mode === 'login' || mode === 'register') && (
            <form onSubmit={submitAccount} className="space-y-3">
              {mode === 'register' && (
                <label className="block">
                  <span className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-200"><User size={15} /> Full name</span>
                  <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                </label>
              )}
              <label className="block">
                <span className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-200"><Mail size={15} /> Email</span>
                <input className="input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
              </label>
              <label className="block">
                <span className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-200"><Lock size={15} /> Password</span>
                <input className="input" type="password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
              </label>
              {mode === 'register' && (
                <label className="block">
                  <span className="mb-1 text-sm font-semibold text-slate-200">College</span>
                  <input className="input" value={form.college} onChange={(event) => setForm({ ...form, college: event.target.value })} required />
                </label>
              )}
              {mode === 'login' && (
                <button className="text-sm font-bold text-cyan-200 hover:text-white" type="button" onClick={() => switchMode('forgot')}>
                  Forgot Password?
                </button>
              )}
              <button className="btn btn-primary w-full" type="submit" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" size={16} /> : <KeyRound size={16} />}
                {mode === 'login' ? 'Login' : 'Create Account'}
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={sendForgotOtp} className="space-y-3">
              <label className="block">
                <span className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-200"><Mail size={15} /> Registered email</span>
                <input className="input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
              </label>
              <button className="btn btn-primary w-full" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" size={16} /> : <RotateCcw size={16} />}
                Send Reset OTP
              </button>
              <button className="btn btn-soft w-full" type="button" onClick={() => switchMode('login')}>Back to Login</button>
            </form>
          )}

          {mode === 'verify' && (
            <form onSubmit={verifyEmail} className="space-y-3">
              <input className="input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
              <input className="input" inputMode="numeric" maxLength={6} placeholder="6-digit OTP" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required />
              <button className="btn btn-primary w-full" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
                Verify Email
              </button>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={resetPassword} className="space-y-3">
              <input className="input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
              <input className="input" inputMode="numeric" maxLength={6} placeholder="6-digit OTP" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required />
              <input className="input" type="password" placeholder="New password" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} required />
              <input className="input" type="password" placeholder="Confirm password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} required />
              <button className="btn btn-primary w-full" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Lock size={16} />}
                Reset Password
              </button>
              <button className="btn btn-soft w-full" type="button" onClick={() => switchMode('login')}>Back to Login</button>
            </form>
          )}

          {message && <div className="mt-4 rounded-md border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">{message}</div>}
          {error && <div className="mt-4 rounded-md border border-red-300/30 bg-red-400/10 px-3 py-2 text-sm text-red-100">{error}</div>}

          <div className="mt-4 rounded-md border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
            Admin demo: `admin@example.com` / `Admin@123`
          </div>
        </div>
      </section>
      </section>
    </div>
  );
}
