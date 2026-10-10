import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, AlertCircle, User, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import cvsuLogo from '@/assets/cvsu-logo.png';
import { useAuth } from '@/contexts/AuthContext';
import { markActivity } from '@/lib/sessionActivity';
import { validateEmail, validatePassword, sanitizeText, checkLoginThrottle, recordLoginAttempt } from '@/lib/validation';

const PASSWORD_RULES = [
  { test: (pw) => pw.length >= 8, label: 'At least 8 characters' },
  { test: (pw) => /[A-Za-z]/.test(pw), label: 'Contains a letter' },
  { test: (pw) => /[0-9]/.test(pw), label: 'Contains a number' }
];

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

const TermsModal = ({ onClose, onAgree }) =>
<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60" onClick={onClose} role="dialog" aria-modal="true" aria-label="Terms and Conditions">
    <div className="bg-card text-foreground rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <h2 className="font-heading text-base font-bold">Terms and Conditions</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="bg-transparent border-none text-muted-foreground hover:text-foreground cursor-pointer p-1"><X className="w-4 h-4" /></button>
      </div>
      <div className="px-6 py-4 overflow-y-auto text-sm space-y-3 leading-relaxed">
        <p className="text-muted-foreground">By creating an account in the CvSU Research Center Laboratory Reservation System, you agree to the following:</p>
        <div>
          <h3 className="font-semibold mb-0.5">1. Account security</h3>
          <p className="text-muted-foreground">You are responsible for keeping your password confidential and for all activity under your account. Do not share your login details. Report any unauthorized use to the Research Center right away.</p>
        </div>
        <div>
          <h3 className="font-semibold mb-0.5">2. Accurate information</h3>
          <p className="text-muted-foreground">The details you provide (name, email, college/unit, adviser, study title and members) must be true and up to date. Reservations made with false information may be cancelled.</p>
        </div>
        <div>
          <h3 className="font-semibold mb-0.5">3. Reservations and use of facilities</h3>
          <p className="text-muted-foreground">Reservations are subject to approval and to the schedule and availability of laboratories and equipment. You agree to follow laboratory rules, use equipment only for the approved purpose, and be responsible for any loss or damage caused during your use.</p>
        </div>
        <div>
          <h3 className="font-semibold mb-0.5">4. Data privacy</h3>
          <p className="text-muted-foreground">Your personal information is collected only to process reservations and manage your account, and is handled in line with the Data Privacy Act of 2012 (Republic Act No. 10173). It will not be shared with outside parties except as required by the University or by law.</p>
        </div>
        <div>
          <h3 className="font-semibold mb-0.5">5. Changes and suspension</h3>
          <p className="text-muted-foreground">The Research Center may update these terms, and may suspend accounts that misuse the system or break its rules.</p>
        </div>
      </div>
      <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold bg-muted text-foreground border border-border cursor-pointer hover:bg-border transition-colors">Close</button>
        <button type="button" onClick={onAgree} className="px-4 py-2 rounded-lg text-sm font-semibold gradient-primary text-primary-foreground border-none cursor-pointer hover:opacity-90 transition-opacity">I Agree</button>
      </div>
    </div>
  </div>;

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '';
  const timedOut = searchParams.get('reason') === 'timeout';
  const { user, role, loading: authLoading, signOut } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(timedOut ? 'You were logged out due to 10 minutes of inactivity. Please log in again.' : '');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [signupPassword, setSignupPassword] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Always require a fresh login. If someone lands here with an old session
  // still around (e.g. they left earlier without logging out), end it first
  // instead of sending them straight into the account.
  const signingInRef = useRef(false);
  const checkedRef = useRef(false);
  useEffect(() => {
    if (authLoading || checkedRef.current) return;
    checkedRef.current = true;
    if (user && !signingInRef.current) signOut();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  // Redirect only right after a login made on this page
  useEffect(() => {
    if (!authLoading && user && role && signingInRef.current) {
      if (redirectTo) {
        navigate(redirectTo);
      } else {
        navigate(role === 'admin' ? '/admin/dashboard' : role === 'staff' ? '/staff/dashboard' : '/user/dashboard');
      }
    }
  }, [authLoading, user, role, navigate, redirectTo]);

  const switchMode = (register) => {
    setIsRegister(register);
    setError('');
    setSuccess('');
    setSignupPassword('');
    setAgreedTerms(false);
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const form = new FormData(e.currentTarget);
    const email = (form.get('email') || '').trim();
    const password = form.get('password') || '';

    const emailErr = validateEmail(email);
    if (emailErr) { setError(emailErr); return; }

    const throttle = checkLoginThrottle();
    if (!throttle.allowed) {
      setError(`Too many attempts. Please try again in ${throttle.secondsLeft}s.`);
      return;
    }

    setLoading(true);
    signingInRef.current = true;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    recordLoginAttempt(!error);
    if (error) {
      signingInRef.current = false;
      setError(error.message);
      setLoading(false);
    } else {
      markActivity();
    }
    // Role-based redirect will happen via the useEffect above
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const form = new FormData(e.currentTarget);
    const email = (form.get('email') || '').trim();
    const password = form.get('password') || '';

    const emailErr = validateEmail(email);
    if (emailErr) { setError(emailErr); return; }

    const passwordErr = validatePassword(password);
    if (passwordErr) { setError(passwordErr); return; }
    const confirmPassword = form.get('confirm_password') || '';
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    const fullName = sanitizeText(form.get('full_name'), { maxLength: 150 });
    if (!fullName) { setError('Full name is required.'); return; }
    if (!agreedTerms) { setError('Please agree to the Terms and Conditions to create an account.'); return; }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/login`
      }
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else if (data?.session) {
      // Supabase returned an active session (this happens if "Confirm email"
      // is turned OFF in Auth settings). We don't want registration to
      // auto sign the user in, so immediately sign them back out and show
      // the same "check your email" style message instead.
      await supabase.auth.signOut();
      setSuccess('Account created! You can now log in.');
      setIsRegister(false);
      e.currentTarget.reset();
      setSignupPassword('');
      setAgreedTerms(false);
      setLoading(false);
    } else {
      setSuccess('Account created! Please check your email to confirm your account before logging in.');
      setIsRegister(false);
      e.currentTarget.reset();
      setSignupPassword('');
      setAgreedTerms(false);
      setLoading(false);
    }
  };

  const forgotPassword = async () => {
    const email = document.querySelector('input[name="email"]')?.value;
    if (!email) { setError('Enter your email first, then click Forgot Password.'); return; }
    setLoading(true); setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) { setError(error.message); } else { setSuccess('Password reset link sent! Check your email.'); }
    setLoading(false);
  };

  const inputClass = "w-full pl-10 pr-4 py-3 bg-white/50 border-2 border-white/70 rounded-lg text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors text-sm";

  const compactInput = inputClass.replace('py-3', 'py-2.5');

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 gradient-dark relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="absolute inset-[-50%] bg-[radial-gradient(circle_at_25%_30%,hsl(145_75%_45%/0.50),transparent_45%),radial-gradient(circle_at_75%_70%,hsl(100_70%_50%/0.35),transparent_45%)] animate-float z-0" />

      {showTerms && <TermsModal onClose={() => setShowTerms(false)} onAgree={() => { setAgreedTerms(true); setShowTerms(false); }} />}

      <div className="relative z-10 w-full max-w-3xl flex flex-col items-center">
        {(error || success) &&
        <div className="w-full max-w-md mb-4">
            {error &&
          <div className="bg-destructive/15 border border-destructive/30 text-destructive-foreground rounded-xl p-3 mb-2 flex items-center gap-2 text-sm font-medium animate-slide-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
          }
            {success &&
          <div className="bg-green-500/15 border border-green-500/30 text-green-100 rounded-xl p-3 mb-2 flex items-center gap-2 text-sm font-medium animate-slide-in">
                <Mail className="w-4 h-4 flex-shrink-0" /> {success}
              </div>
          }
          </div>
        }

        {/* ===== Desktop: classic sliding-overlay panel ===== */}
        <div className={`hidden lg:block relative w-full max-w-3xl min-h-[510px] rounded-3xl overflow-hidden animate-fade-up bg-white/55 backdrop-blur-2xl backdrop-saturate-[1.8] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.9),inset_0_0_24px_rgba(255,255,255,0.25)]`}>

          {/* Log In form (left half) */}
          <div className={`absolute top-0 h-full w-1/2 flex items-center transition-all duration-700 ease-in-out ${isRegister ? 'translate-x-full opacity-0 pointer-events-none' : 'translate-x-0 opacity-100 z-20'}`}>
            <form onSubmit={handleSignIn} className="w-full px-10 py-8">
              <h1 className="font-heading text-2xl font-bold text-primary mb-1">Log In</h1>
              <p className="text-muted-foreground text-xs mb-5">Welcome back to CvSU Research Center</p>
              <div className="space-y-3.5">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input name="email" type="email" required placeholder="Email" className={inputClass} />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input name="password" type={showPassword ? 'text' : 'password'} required placeholder="Password" minLength={8} className={inputClass + ' pr-10'} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-muted-foreground hover:text-foreground cursor-pointer">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="button" onClick={forgotPassword} className="bg-transparent border-none text-muted-foreground hover:text-foreground text-xs cursor-pointer underline mt-3 mb-5 p-0">
                Forgot your password?
              </button>
              <button type="submit" disabled={loading}
                className="w-full py-3 gradient-primary text-primary-foreground border-none rounded-xl font-bold text-sm tracking-wide cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? 'Logging in…' : 'Log In'}
              </button>
            </form>
          </div>

          {/* Sign Up form (left half, revealed when register active) */}
          <div className={`absolute top-0 h-full w-1/2 flex items-center transition-all duration-700 ease-in-out ${isRegister ? 'translate-x-full opacity-100 z-20' : 'translate-x-full opacity-0 pointer-events-none z-10'}`}>
            <form onSubmit={handleSignUp} className="w-full px-10 py-5">
              <h1 className="font-heading text-2xl font-bold text-primary mb-1">Create Account</h1>
              <p className="text-muted-foreground text-xs mb-4">Register to start reserving labs & equipment</p>
              <div className="space-y-2.5">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input name="full_name" required placeholder="Full Name" className={compactInput} />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input name="email" type="email" required placeholder="Email" className={compactInput} />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input name="password" type={showPassword ? 'text' : 'password'} required placeholder="Password" minLength={8}
                    value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)}
                    className={compactInput + ' pr-10'} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-muted-foreground hover:text-foreground cursor-pointer">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordRequirements password={signupPassword} />
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input name="confirm_password" type={showPassword ? 'text' : 'password'} required placeholder="Confirm Password" minLength={8} className={compactInput} />
                </div>
              </div>
              <label className="mt-3 flex items-start gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} required className="mt-0.5 w-3.5 h-3.5 accent-[hsl(var(--primary))] cursor-pointer flex-shrink-0" />
                <span>
                  I agree to the{' '}
                  <button type="button" onClick={(e) => { e.preventDefault(); setShowTerms(true); }} className="bg-transparent border-none p-0 text-primary font-semibold underline cursor-pointer text-xs">Terms and Conditions</button>
                  {' '}and Data Privacy notice
                </span>
              </label>
              <button type="submit" disabled={loading}
                className="w-full py-3 gradient-primary text-primary-foreground border-none rounded-xl font-bold text-sm tracking-wide cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-3">
                {loading ? 'Creating account…' : 'Sign Up'}
              </button>
              <div className="text-center mt-3 text-xs text-muted-foreground">
                Already have an account?{' '}
                <button type="button" onClick={() => switchMode(false)}
                  className="bg-transparent border-none text-primary font-semibold hover:underline cursor-pointer p-0">
                  Log in
                </button>
              </div>
            </form>
          </div>

          {/* Sliding overlay */}
          <div className={`absolute top-0 left-1/2 h-full w-1/2 z-30 overflow-hidden transition-transform duration-700 ease-in-out ${isRegister ? '-translate-x-full' : 'translate-x-0'}`}>
            <div className="relative h-full w-full gradient-primary text-primary-foreground">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,hsl(0_0%_100%/0.12),transparent_50%),radial-gradient(circle_at_70%_70%,hsl(43_96%_50%/0.15),transparent_50%)] animate-float pointer-events-none" />

              {/* Sign-in-mode message: invites to Register */}
              <div className={`absolute inset-0 flex flex-col items-center justify-center text-center px-10 transition-opacity duration-500 ${isRegister ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <img src={cvsuLogo} alt="CvSU Logo" className="w-14 h-14 mb-4 opacity-90" width={56} height={56} />
                <h2 className="font-heading text-xl font-bold mb-3">Hello, Researcher!</h2>
                <p className="text-primary-foreground/70 text-sm mb-6 leading-relaxed">
                  New here? Register with your details to start booking labs and equipment.
                </p>
                <button type="button" onClick={() => switchMode(true)}
                  className="px-8 py-2.5 rounded-full border-2 border-primary-foreground/70 text-primary-foreground font-semibold text-sm bg-transparent cursor-pointer hover:bg-primary-foreground/10 transition-colors">
                  Register
                </button>
              </div>

              {/* Register-mode message: invites back to Sign In */}
              <div className={`absolute inset-0 flex flex-col items-center justify-center text-center px-10 transition-opacity duration-500 ${isRegister ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <img src={cvsuLogo} alt="CvSU Logo" className="w-14 h-14 mb-4 opacity-90" width={56} height={56} />
                <h2 className="font-heading text-xl font-bold mb-3">Welcome Back!</h2>
                <p className="text-primary-foreground/70 text-sm mb-6 leading-relaxed">
                  Already have an account? Log in to manage your laboratory and equipment reservations.
                </p>
                <button type="button" onClick={() => switchMode(false)}
                  className="px-8 py-2.5 rounded-full border-2 border-primary-foreground/70 text-primary-foreground font-semibold text-sm bg-transparent cursor-pointer hover:bg-primary-foreground/10 transition-colors">
                  Log In
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sign in / Sign up quick switch below the card (desktop) */}
        <div className="hidden lg:block text-center mt-4 text-sm text-primary-foreground/60">
          {isRegister ? 'Already have an account? ' : "Don't have an account? "}
          <button onClick={() => switchMode(!isRegister)}
            className="bg-transparent border-none text-accent font-semibold hover:underline cursor-pointer p-0">
            {isRegister ? 'Log in here' : 'Register here'}
          </button>
        </div>

        {/* ===== Mobile / tablet fallback: stacked card with simple tab toggle ===== */}
        <div className="lg:hidden w-full max-w-md animate-fade-up">
          <div className="text-center mb-6">
            <img src={cvsuLogo} alt="CvSU Logo" className="w-16 h-16 mx-auto mb-3" width={64} height={64} />
            <h1 className="font-heading text-xl font-bold text-primary-foreground mb-1">CvSU Research Center</h1>
            <p className="text-primary-foreground/50 text-sm">Laboratory Reservation System</p>
          </div>

          <div className="rounded-2xl p-6 sm:p-8 bg-white/55 backdrop-blur-2xl backdrop-saturate-[1.8] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.9),inset_0_0_24px_rgba(255,255,255,0.25)]">
            <div className="flex bg-white/40 rounded-xl p-1 mb-6">
              <button type="button" onClick={() => switchMode(false)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer border-none ${!isRegister ? 'bg-white/85 text-primary shadow-sm' : 'bg-transparent text-muted-foreground hover:text-foreground'}`}>
                Log in
              </button>
              <button type="button" onClick={() => switchMode(true)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer border-none ${isRegister ? 'bg-white/85 text-primary shadow-sm' : 'bg-transparent text-muted-foreground hover:text-foreground'}`}>
                Register
              </button>
            </div>

            {!isRegister ?
            <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block mb-1.5 text-foreground font-semibold text-sm">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input name="email" type="email" required placeholder="your@email.com" className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="block mb-1.5 text-foreground font-semibold text-sm">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input name="password" type={showPassword ? 'text' : 'password'} required placeholder="Your password" minLength={8} className={inputClass + ' pr-10'} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-muted-foreground hover:text-foreground cursor-pointer">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                className="w-full py-3 gradient-primary text-primary-foreground border-none rounded-xl font-bold text-base cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? 'Logging in…' : 'Log In'}
                </button>
                <div className="text-center">
                  <button type="button" onClick={forgotPassword} className="bg-transparent border-none text-muted-foreground hover:text-foreground text-sm cursor-pointer underline">
                    Forgot Password?
                  </button>
                </div>
              </form> :

            <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block mb-1.5 text-foreground font-semibold text-sm">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input name="full_name" required placeholder="Your full name" className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="block mb-1.5 text-foreground font-semibold text-sm">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input name="email" type="email" required placeholder="your@email.com" className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="block mb-1.5 text-foreground font-semibold text-sm">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input name="password" type={showPassword ? 'text' : 'password'} required placeholder="Your password" minLength={8}
                      value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)}
                      className={inputClass + ' pr-10'} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-muted-foreground hover:text-foreground cursor-pointer">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <PasswordRequirements password={signupPassword} />
                </div>
                <div>
                  <label className="block mb-1.5 text-foreground font-semibold text-sm">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input name="confirm_password" type={showPassword ? 'text' : 'password'} required placeholder="Re-enter your password" minLength={8} className={inputClass} />
                  </div>
                </div>
                <label className=" flex items-start gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} required className="mt-0.5 w-3.5 h-3.5 accent-[hsl(var(--primary))] cursor-pointer flex-shrink-0" />
                <span>
                  I agree to the{' '}
                  <button type="button" onClick={(e) => { e.preventDefault(); setShowTerms(true); }} className="bg-transparent border-none p-0 text-primary font-semibold underline cursor-pointer text-xs">Terms and Conditions</button>
                  {' '}and Data Privacy notice
                </span>
              </label>
                <button type="submit" disabled={loading}
                className="w-full py-3 gradient-primary text-primary-foreground border-none rounded-xl font-bold text-base cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? 'Creating account…' : 'Register'}
                </button>
              </form>
            }

            <div className="text-center mt-4 text-sm text-muted-foreground">
              {isRegister ? 'Already have an account? ' : "Don't have an account? "}
              <button onClick={() => switchMode(!isRegister)}
              className="bg-transparent border-none text-accent font-semibold hover:underline cursor-pointer p-0">
                {isRegister ? 'Log in' : 'Register'}
              </button>
            </div>
          </div>

          <div className="text-center mt-6">
            <Link to="/" className="text-primary-foreground/50 hover:text-primary-foreground/80 text-sm no-underline transition-colors">
              ← Back to Home
            </Link>
          </div>
        </div>

        <div className="hidden lg:block text-center mt-6">
          <Link to="/" className="text-primary-foreground/50 hover:text-primary-foreground/80 text-sm no-underline transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>);

};

export default Login;