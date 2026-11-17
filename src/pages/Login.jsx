import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, AlertCircle, User, Check, X, Phone, Hash, GraduationCap, Briefcase, Building2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import cvsuLogo from '@/assets/cvsu-logo.png';
import { useAuth } from '@/contexts/AuthContext';
import { markActivity } from '@/lib/sessionActivity';
import { endRecovery } from '@/lib/passwordRecovery';
import { getAuthErrorMessage } from '@/lib/authErrors';
import { validateEmail, validatePassword, sanitizeText, checkLoginThrottle, recordLoginAttempt } from '@/lib/validation';
import { isCvsuEmail } from '@/lib/stakeholder';
import { CVSU_COLLEGES } from '@/lib/cvsuColleges';

// Who is registering. `value` is what gets saved on the account and later used
// by the reserve form (same values the reservations table already uses).
const REGISTER_TYPES = [
  { value: 'faculty_staff', label: 'Instructor', hint: 'CvSU faculty / instructor', icon: Briefcase, cvsu: true, idLabel: 'Employee / ID Number', idPlaceholder: 'e.g. 20150123' },
  { value: 'student', label: 'CvSU Student', hint: 'Currently enrolled at CvSU', icon: GraduationCap, cvsu: true, idLabel: 'Student Number', idPlaceholder: 'e.g. 202302603' },
  { value: 'non_cvsu', label: 'Non-CvSU Stakeholder', hint: 'Outside agency, company or school', icon: Building2, cvsu: false, idLabel: 'ID Number', idPlaceholder: 'e.g. 123456789' },
];

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
      <li key={rule.label} className={`flex items-center gap-1.5 text-xs transition-colors text-black`}>
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

const Login = ({ mode = 'login' }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isRegister = mode === 'register';
  const redirectTo = searchParams.get('redirect') || '';
  const timedOut = searchParams.get('reason') === 'timeout';
  const resetDone = searchParams.get('reset') === 'success';
  const registered = searchParams.get('registered'); // 'ready' | 'confirm'
  const { user, role, loading: authLoading, signOut } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(timedOut ? 'You were logged out due to 10 minutes of inactivity. Please log in again.' : '');
  const [success, setSuccess] = useState(
    resetDone ? 'Your password has been reset. Please log in with your new password.' :
    registered === 'ready' ? 'Account created! You can now log in.' :
    registered === 'confirm' ? 'Account created! Please check your email to confirm your account before logging in.' : ''
  );
  const [loading, setLoading] = useState(false);
  const [signupPassword, setSignupPassword] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [registerType, setRegisterType] = useState(''); // '' = still choosing
  const typeInfo = REGISTER_TYPES.find((t) => t.value === registerType);

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
    endRecovery();
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
    if (!typeInfo) { setError('Please choose what kind of account you are registering.'); return; }

    const form = new FormData(e.currentTarget);
    const email = (form.get('email') || '').trim();
    const password = form.get('password') || '';

    const emailErr = validateEmail(email);
    if (emailErr) { setError(emailErr); return; }

    // CvSU Student / Instructor need a CvSU email; everyone else uses a non-CvSU email.
    if (typeInfo.cvsu && !isCvsuEmail(email)) {
      setError(`${typeInfo.label} accounts must use a CvSU email (@cvsu.edu.ph).`);
      return;
    }
    if (!typeInfo.cvsu && isCvsuEmail(email)) {
      setError('This is a CvSU email. Please go back and register as an Instructor or CvSU Student instead.');
      return;
    }

    const passwordErr = validatePassword(password);
    if (passwordErr) { setError(passwordErr); return; }
    const confirmPassword = form.get('confirm_password') || '';
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    const firstName = sanitizeText(form.get('first_name'), { maxLength: 60 });
    const lastName = sanitizeText(form.get('last_name'), { maxLength: 60 });
    const middleInitial = String(form.get('middle_initial') || '').trim().replace(/\./g, '').toUpperCase();
    const nameOk = (v) => /^[\p{L}][\p{L}\s.'-]*$/u.test(v);
    if (!firstName) { setError('First name is required.'); return; }
    if (!lastName) { setError('Last name is required.'); return; }
    if (!nameOk(firstName) || !nameOk(lastName)) { setError('Names can only contain letters, spaces, hyphens and apostrophes.'); return; }
    if (middleInitial && !/^\p{L}$/u.test(middleInitial)) { setError('Middle initial must be a single letter.'); return; }
    // "Juan D. Dela Cruz" — this one value is what the reserve form shows and uses.
    const fullName = [firstName, middleInitial ? `${middleInitial}.` : '', lastName].filter(Boolean).join(' ');
    const studentId = String(form.get('student_id') || '').trim();
    if (!/^\d+$/.test(studentId)) { setError(`${typeInfo.idLabel} must contain numbers only.`); return; }
    const phone = String(form.get('phone') || '').trim();
    if (!/^09\d{9}$/.test(phone)) { setError('Phone number must be 11 digits and start with 09 (e.g. 09171234567).'); return; }
    // College (CvSU student / instructor) or school / agency (Non-CvSU). Shown, locked, on the reserve forms.
    const unitCollege = sanitizeText(form.get('unit_college'), { maxLength: 150 });
    if (!unitCollege) { setError(typeInfo.cvsu ? 'Please select your college.' : 'Please enter your school, company or agency.'); return; }
    if (typeInfo.cvsu && !CVSU_COLLEGES.some((c) => c.value === unitCollege)) { setError('Please select your college from the list.'); return; }
    if (!agreedTerms) { setError('Please agree to the Terms and Conditions to create an account.'); return; }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, first_name: firstName, middle_initial: middleInitial, last_name: lastName, stakeholder_type: typeInfo.value, student_id: studentId, phone, unit_college: unitCollege },
        emailRedirectTo: `${window.location.origin}/login`
      }
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (data?.session) {
      // "Confirm email" is OFF in Supabase Auth settings, so signUp logged the
      // user in. Registration should not auto sign in: sign out and go to Log In.
      await supabase.auth.signOut();
    }
    setLoading(false);
    navigate(`/login?registered=${data?.session ? 'ready' : 'confirm'}`, { replace: true });
  };

  const forgotPassword = async (e) => {
    const email = (e?.currentTarget?.form?.elements?.email?.value || '').trim();
    if (!email) { setError('Enter your email first, then click Forgot Password.'); setSuccess(''); return; }
    const emailErr = validateEmail(email);
    if (emailErr) { setError(emailErr); setSuccess(''); return; }
    setLoading(true); setError(''); setSuccess('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (error.status === 429 || msg.includes('rate limit') || msg.includes('only request this after')) {
        setError('Too many reset requests. Please wait a few minutes before trying again.');
      } else {
        setError(getAuthErrorMessage(error));
      }
    } else {
      setSuccess('If that email has an account, a password reset link has been sent. Please check your inbox (and spam folder).');
    }
    setLoading(false);
  };

  const inputClass = "w-full pl-10 pr-4 py-3 bg-white/50 border-2 border-white/70 rounded-lg text-foreground placeholder:text-black/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors text-sm";
  const labelClass = "block mb-1.5 text-foreground font-semibold text-sm";
  const iconClass = "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black";
  const submitClass = "w-full py-3 gradient-primary text-primary-foreground border-none rounded-xl font-bold text-base cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed";
  const showingTypeChoice = isRegister && !typeInfo;

  const passwordToggle =
  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-black hover:text-black/70 cursor-pointer">
      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 gradient-dark relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="absolute inset-[-50%] bg-[radial-gradient(circle_at_25%_30%,hsl(145_75%_45%/0.50),transparent_45%),radial-gradient(circle_at_75%_70%,hsl(100_70%_50%/0.35),transparent_45%)] animate-float z-0" />

      {showTerms && <TermsModal onClose={() => setShowTerms(false)} onAgree={() => { setAgreedTerms(true); setShowTerms(false); }} />}

      <div className={`relative z-10 w-full flex flex-col items-center ${isRegister ? 'max-w-lg' : 'max-w-md'}`}>
        <div className="text-center mb-5">
          <img src={cvsuLogo} alt="CvSU Logo" className="w-16 h-16 mx-auto mb-3" width={64} height={64} />
          <h1 className="font-heading text-xl font-bold text-primary-foreground mb-1">CvSU Research Center</h1>
          <p className="text-primary-foreground/50 text-sm">Laboratory Reservation System</p>
        </div>

        {(error || success) &&
        <div className="w-full mb-4">
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

        <div className="w-full rounded-2xl p-6 sm:p-8 animate-fade-up bg-white/55 backdrop-blur-2xl backdrop-saturate-[1.8] border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.9),inset_0_0_24px_rgba(255,255,255,0.25)]">

          {/* ===== LOG IN ===== */}
          {!isRegister &&
          <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <h2 className="font-heading text-2xl font-bold text-black mb-1">Log In</h2>
                <p className="text-black text-xs">Welcome back to CvSU Research Center</p>
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <div className="relative">
                  <Mail className={iconClass} />
                  <input name="email" type="email" required placeholder="your@email.com" className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Password</label>
                <div className="relative">
                  <Lock className={iconClass} />
                  <input name="password" type={showPassword ? 'text' : 'password'} required placeholder="Your password" minLength={8} className={inputClass + ' pr-10'} />
                  {passwordToggle}
                </div>
              </div>
              <button type="submit" disabled={loading} className={submitClass}>
                {loading ? 'Logging in…' : 'Log In'}
              </button>
              <div className="text-center">
                <button type="button" onClick={forgotPassword} className="bg-transparent border-none text-black hover:text-black/70 text-sm cursor-pointer underline">
                  Forgot Password?
                </button>
              </div>
            </form>
          }

          {/* ===== REGISTER · step 1: choose type ===== */}
          {showingTypeChoice &&
          <div className="space-y-4">
              <div>
                <h2 className="font-heading text-2xl font-bold text-black mb-1">Create Account</h2>
                <p className="text-black text-xs">Who are you registering as?</p>
              </div>
              <div className="space-y-3">
                {REGISTER_TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <button key={t.value} type="button" onClick={() => { setRegisterType(t.value); setError(''); }}
                  className="w-full flex items-center gap-3 text-left px-4 py-3.5 rounded-xl border-2 border-white/70 bg-white/50 hover:border-primary hover:bg-primary/10 transition-colors cursor-pointer">
                      <span className="w-10 h-10 rounded-full bg-primary/10 text-black flex items-center justify-center flex-shrink-0"><Icon className="w-5 h-5" /></span>
                      <span>
                        <span className="block font-semibold text-sm text-foreground">{t.label}</span>
                        <span className="block text-xs text-black">{t.hint}</span>
                      </span>
                    </button>);
              })}
              </div>
            </div>
          }

          {/* ===== REGISTER · step 2: details ===== */}
          {isRegister && typeInfo &&
          <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <h2 className="font-heading text-2xl font-bold text-black mb-1">Create Account</h2>
                <div className="flex items-center justify-between gap-2 mt-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-primary/10 text-black px-3 py-1 rounded-full border border-primary/20">
                    <typeInfo.icon className="w-3.5 h-3.5" /> {typeInfo.label}
                  </span>
                  <button type="button" onClick={() => { setRegisterType(''); setError(''); }} className="bg-transparent border-none text-black hover:text-black/70 text-xs cursor-pointer underline p-0 inline-flex items-center gap-1">
                    <ArrowLeft className="w-3 h-3" /> Change
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_5.5rem_1fr] gap-4">
                <div>
                  <label className={labelClass}>First Name</label>
                  <div className="relative">
                    <User className={iconClass} />
                    <input name="first_name" required maxLength={60} autoComplete="given-name" placeholder="Juan" className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>M.I.</label>
                  <input name="middle_initial" maxLength={2} autoComplete="off" placeholder="D"
                  onInput={(e) => { e.target.value = e.target.value.replace(/[^\p{L}.]/gu, '').slice(0, 2).toUpperCase(); }}
                  className={inputClass.replace('pl-10', 'pl-4') + ' text-center'} />
                </div>
                <div>
                  <label className={labelClass}>Last Name</label>
                  <input name="last_name" required maxLength={60} autoComplete="family-name" placeholder="Dela Cruz" className={inputClass.replace('pl-10', 'pl-4')} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>{typeInfo.idLabel}</label>
                  <div className="relative">
                    <Hash className={iconClass} />
                    <input name="student_id" required inputMode="numeric" pattern="[0-9]*"
                    onInput={(e) => { e.target.value = e.target.value.replace(/\D/g, ''); }}
                    placeholder={typeInfo.idPlaceholder} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Phone Number</label>
                  <div className="relative">
                    <Phone className={iconClass} />
                    <input name="phone" type="tel" required inputMode="numeric" maxLength={11} pattern="09[0-9]{9}"
                    onInput={(e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 11); }}
                    placeholder="e.g. 09171234567" className={inputClass} />
                  </div>
                </div>
              </div>
              <div>
                <label className={labelClass}>{typeInfo.cvsu ? 'College' : 'School / Company / Agency'}</label>
                <div className="relative">
                  <Building2 className={iconClass} />
                  {typeInfo.cvsu ? (
                    <select name="unit_college" required defaultValue="" className={inputClass + ' pr-8 cursor-pointer'}>
                      <option value="" disabled>Select your college…</option>
                      {CVSU_COLLEGES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  ) : (
                    <input name="unit_college" required maxLength={150} autoComplete="organization" placeholder="e.g. Company, school, or agency name" className={inputClass} />
                  )}
                </div>
                <p className="text-xs text-black mt-1">This will be filled in automatically on your reservation forms.</p>
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <div className="relative">
                  <Mail className={iconClass} />
                  <input name="email" type="email" required placeholder={typeInfo.cvsu ? 'yourname@cvsu.edu.ph' : 'your@email.com'} className={inputClass} />
                </div>
                <p className="text-xs text-black mt-1">{typeInfo.cvsu ? 'Use your CvSU email (@cvsu.edu.ph).' : 'Use a personal or company email (not @cvsu.edu.ph).'}</p>
              </div>
              <div>
                <label className={labelClass}>Password</label>
                <div className="relative">
                  <Lock className={iconClass} />
                  <input name="password" type={showPassword ? 'text' : 'password'} required placeholder="Your password" minLength={8}
                  value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)}
                  className={inputClass + ' pr-10'} />
                  {passwordToggle}
                </div>
                <PasswordRequirements password={signupPassword} />
              </div>
              <div>
                <label className={labelClass}>Confirm Password</label>
                <div className="relative">
                  <Lock className={iconClass} />
                  <input name="confirm_password" type={showPassword ? 'text' : 'password'} required placeholder="Re-enter your password" minLength={8} className={inputClass} />
                </div>
              </div>
              <label className="flex items-start gap-2 text-xs text-black cursor-pointer select-none">
                <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} required className="mt-0.5 w-3.5 h-3.5 accent-[hsl(var(--primary))] cursor-pointer flex-shrink-0" />
                <span>
                  I agree to the{' '}
                  <button type="button" onClick={(e) => { e.preventDefault(); setShowTerms(true); }} className="bg-transparent border-none p-0 text-black font-semibold underline cursor-pointer text-xs">Terms and Conditions</button>
                  {' '}and Data Privacy notice
                </span>
              </label>
              <button type="submit" disabled={loading} className={submitClass}>
                {loading ? 'Creating account…' : 'Register'}
              </button>
            </form>
          }

          <div className="text-center mt-5 text-sm text-black">
            {isRegister ?
            <>Already have an account?{' '}<Link to="/login" className="text-black font-semibold hover:underline no-underline">Log in</Link></> :
            <>Don't have an account?{' '}<Link to="/register" className="text-black font-semibold hover:underline no-underline">Register</Link></>
            }
          </div>
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="text-primary-foreground/50 hover:text-primary-foreground/80 text-sm no-underline transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>);

};

export default Login;