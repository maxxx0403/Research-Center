import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, AlertCircle, CheckCircle, Check, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import cvsuLogo from '@/assets/cvsu-logo.png';
import { validatePassword } from '@/lib/validation';
import { clearActivity } from '@/lib/sessionActivity';
import { isRecoveryActive, endRecovery } from '@/lib/passwordRecovery';
import { getAuthErrorMessage } from '@/lib/authErrors';

const REDIRECT_DELAY_MS = 3000;

const PASSWORD_RULES = [
  { test: (pw) => pw.length >= 8, label: 'At least 8 characters' },
  { test: (pw) => /[A-Za-z]/.test(pw), label: 'Contains a letter' },
  { test: (pw) => /[0-9]/.test(pw), label: 'Contains a number' }
];

// ---------------------------------------------------------------------------
// Read what the emailed link carried BEFORE the Supabase client strips it from
// the address bar. This runs once, when the page first loads.
// ---------------------------------------------------------------------------
const readLinkInfo = () => {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return {
    hasLink: !!search.get('code') || hash.get('type') === 'recovery',
    errorCode: search.get('error_code') || hash.get('error_code') || '',
    errorDescription: search.get('error_description') || hash.get('error_description') || ''
  };
};
const LINK_INFO = readLinkInfo();
const LINK_FAILED = !!(LINK_INFO.errorCode || LINK_INFO.errorDescription);

const inputClass = 'w-full pl-10 pr-4 py-3 bg-white/50 border-2 border-white/70 rounded-lg text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors text-sm';

const glassCard = 'rounded-2xl p-6 sm:p-8 bg-white/55 backdrop-blur-2xl backdrop-saturate-[1.8] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.9),inset_0_0_24px_rgba(255,255,255,0.25)]';

const PasswordRequirements = ({ password }) =>
<ul className="list-none space-y-1 mt-2 mb-1">
    {PASSWORD_RULES.map((rule) => {
    const met = rule.test(password);
    return (
      <li key={rule.label} className={`flex items-center gap-1.5 text-xs transition-colors ${met ? 'text-success' : 'text-muted-foreground'}`}>
          {met ? <Check className="w-3.5 h-3.5 flex-shrink-0" /> : <X className="w-3.5 h-3.5 flex-shrink-0 opacity-40" />}
          {rule.label}
        </li>);

  })}
  </ul>;

// Same page shell as the Login page (green gradient, grid, frosted-glass card).
const Shell = ({ banner, onBack, children }) =>
<div className="min-h-screen flex items-center justify-center p-4 sm:p-6 gradient-dark relative overflow-hidden">
    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
    <div className="absolute inset-[-50%] bg-[radial-gradient(circle_at_25%_30%,hsl(145_75%_45%/0.50),transparent_45%),radial-gradient(circle_at_75%_70%,hsl(100_70%_50%/0.35),transparent_45%)] animate-float z-0" />

    <div className="relative z-10 w-full max-w-md flex flex-col items-center">
      {banner && <div className="w-full mb-4">{banner}</div>}

      <div className="w-full animate-fade-up">
        <div className="text-center mb-6">
          <img src={cvsuLogo} alt="CvSU Logo" className="w-16 h-16 mx-auto mb-3" width={64} height={64} />
          <h1 className="font-heading text-xl font-bold text-primary-foreground mb-1">CvSU Research Center</h1>
          <p className="text-primary-foreground/50 text-sm">Laboratory Reservation System</p>
        </div>

        <div className={glassCard}>{children}</div>

        <div className="text-center mt-6">
          <a href="/login" onClick={(e) => { e.preventDefault(); onBack(); }} className="text-primary-foreground/50 hover:text-primary-foreground/80 text-sm no-underline transition-colors cursor-pointer">
            ← Back to Login
          </a>
        </div>
      </div>
    </div>
  </div>;

const ResetPassword = () => {
  const navigate = useNavigate();
  // checking -> ready | invalid ; ready -> success
  const [status, setStatus] = useState(LINK_FAILED ? 'invalid' : 'checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Work out whether this page was opened from a valid password-reset email.
  useEffect(() => {
    if (LINK_FAILED) return undefined;
    let active = true;
    let timer;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && active) {
        clearTimeout(timer);
        setStatus((s) => (s === 'success' ? s : 'ready'));
      }
    });

    // getSession() waits until the client has finished exchanging the link's code.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (session && isRecoveryActive()) {
        setStatus((s) => (s === 'checking' ? 'ready' : s));
      } else if (session && LINK_INFO.hasLink) {
        // The recovery event can arrive a moment after the session is set.
        timer = setTimeout(() => {
          if (active) setStatus((s) => (s === 'checking' ? 'invalid' : s));
        }, 2000);
      } else {
        setStatus((s) => (s === 'checking' ? 'invalid' : s));
      }
    });

    return () => {
      active = false;
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  // Leaving without finishing: drop the temporary reset session so the emailed
  // link can never leave the user logged in.
  const leave = async () => {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    endRecovery();
    clearActivity();
    navigate('/login', { replace: true });
  };

  // After a successful reset, send the user to the login page.
  useEffect(() => {
    if (status !== 'success') return undefined;
    const t = setTimeout(() => navigate('/login?reset=success', { replace: true }), REDIRECT_DELAY_MS);
    return () => clearTimeout(t);
  }, [status, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const passwordErr = validatePassword(password);
    if (passwordErr) { setError(passwordErr); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    setLoading(true);
    // Actually changes the account's password (uses the temporary recovery session).
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      const msg = (updateError.message || '').toLowerCase();
      if (updateError.code === 'same_password' || msg.includes('different from the old')) {
        setError('Your new password must be different from your current password.');
      } else if (msg.includes('session') || updateError.status === 401 || updateError.status === 403) {
        // The recovery session is gone/expired: the link can't be used anymore.
        setStatus('invalid');
      } else {
        setError(getAuthErrorMessage(updateError));
      }
      setLoading(false);
      return;
    }

    // Password is changed. End the temporary session (on every device) so the
    // user has to log in with the new password.
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch {
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
    }
    endRecovery();
    clearActivity();
    setPassword('');
    setConfirmPassword('');
    setLoading(false);
    setStatus('success');
  };

  if (status === 'checking') {
    return (
      <Shell onBack={leave}>
        <div className="flex flex-col items-center text-center py-6">
          <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
          <p className="text-muted-foreground text-sm">Verifying your reset link…</p>
        </div>
      </Shell>);

  }

  if (status === 'invalid') {
    const reason = LINK_INFO.errorCode === 'otp_expired' ?
    'This password reset link has expired.' :
    LINK_INFO.errorDescription ?
    LINK_INFO.errorDescription.replace(/\+/g, ' ') :
    'This password reset link is invalid, has expired, or was opened in a different browser than the one you requested it from.';
    return (
      <Shell onBack={leave}>
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-destructive" />
          </div>
          <h2 className="font-heading text-2xl font-bold text-primary mb-1">Invalid Link</h2>
          <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
            {reason} Please go back to the login page and use <span className="font-semibold">Forgot your password?</span> to get a new link.
          </p>
          <button onClick={leave}
          className="w-full py-3 gradient-primary text-primary-foreground border-none rounded-xl font-bold text-sm tracking-wide cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all">
            Back to Login
          </button>
        </div>
      </Shell>);

  }

  if (status === 'success') {
    return (
      <Shell onBack={leave}>
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-success" />
          </div>
          <h2 className="font-heading text-2xl font-bold text-primary mb-1">Password Updated!</h2>
          <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
            Your password has been reset. Redirecting you to the login page…
          </p>
          <button onClick={() => navigate('/login?reset=success', { replace: true })}
          className="w-full py-3 gradient-primary text-primary-foreground border-none rounded-xl font-bold text-sm tracking-wide cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all">
            Go to Login
          </button>
        </div>
      </Shell>);

  }

  return (
    <Shell
      onBack={leave}
      banner={error &&
      <div className="bg-destructive/15 border border-destructive/30 text-destructive-foreground rounded-xl p-3 flex items-center gap-2 text-sm font-medium animate-slide-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      }>
      
      <h2 className="font-heading text-2xl font-bold text-primary mb-1">Reset Password</h2>
      <p className="text-muted-foreground text-xs mb-5">Enter your new password below</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1.5 text-foreground font-semibold text-sm">New Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type={showPassword ? 'text' : 'password'} required minLength={8} autoComplete="new-password"
            value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password"
            className={inputClass + ' pr-10'} />
            <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-muted-foreground hover:text-foreground cursor-pointer">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <PasswordRequirements password={password} />
        </div>

        <div>
          <label className="block mb-1.5 text-foreground font-semibold text-sm">Confirm Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type={showPassword ? 'text' : 'password'} required minLength={8} autoComplete="new-password"
            value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password"
            className={inputClass} />
          </div>
        </div>

        <button type="submit" disabled={loading}
        className="w-full py-3 gradient-primary text-primary-foreground border-none rounded-xl font-bold text-sm tracking-wide cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? 'Updating…' : 'Update Password'}
        </button>
      </form>
    </Shell>);

};

export default ResetPassword;