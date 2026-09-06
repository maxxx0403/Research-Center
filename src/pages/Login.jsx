import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, AlertCircle, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import cvsuLogo from '@/assets/cvsu-logo.png';
import { useAuth } from '@/contexts/AuthContext';
import { validateEmail, validatePassword, sanitizeText, checkLoginThrottle, recordLoginAttempt } from '@/lib/validation';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '';
  const timedOut = searchParams.get('reason') === 'timeout';
  const { user, role, loading: authLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(timedOut ? 'You were signed out due to 10 minutes of inactivity. Please sign in again.' : '');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user && role) {
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    recordLoginAttempt(!error);
    if (error) {
      setError(error.message);
      setLoading(false);
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

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin
      }
    });
    if (error) {
      setError(error.message);
    } else {
      setSuccess('Account created! Please check your email to confirm your account before signing in.');
    }
    setLoading(false);
  };

  const forgotPassword = async () => {
    const email = document.querySelector('input[name="email"]')?.value;
    if (!email) { setError('Enter your email first, then click Forgot Password.'); return; }
    setLoading(true); setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) { setError(error.message); } else { setSuccess('Password reset link sent! Check your email.'); }
    setLoading(false);
  };

  const inputClass = "w-full pl-10 pr-4 py-3 bg-muted/50 border-2 border-border rounded-lg text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors text-sm";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 gradient-dark relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="absolute inset-[-50%] bg-[radial-gradient(circle_at_25%_30%,hsl(224_72%_40%/0.25),transparent_45%),radial-gradient(circle_at_75%_70%,hsl(187_92%_42%/0.15),transparent_45%)] animate-float z-0" />

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
        <div className="hidden lg:block relative w-full max-w-3xl min-h-[520px] bg-card rounded-3xl shadow-xl overflow-hidden animate-fade-up">

          {/* Sign In form (left half) */}
          <div className={`absolute top-0 h-full w-1/2 flex items-center transition-all duration-700 ease-in-out ${isRegister ? 'translate-x-full opacity-0 pointer-events-none' : 'translate-x-0 opacity-100 z-20'}`}>
            <form onSubmit={handleSignIn} className="w-full px-10 py-8">
              <h1 className="font-heading text-2xl font-bold text-primary mb-1">Sign In</h1>
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
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </div>

          {/* Sign Up form (left half, revealed when register active) */}
          <div className={`absolute top-0 h-full w-1/2 flex items-center overflow-y-auto transition-all duration-700 ease-in-out ${isRegister ? 'translate-x-full opacity-100 z-20' : 'translate-x-full opacity-0 pointer-events-none z-10'}`}>
            <form onSubmit={handleSignUp} className="w-full px-10 py-8">
              <h1 className="font-heading text-2xl font-bold text-primary mb-1">Create Account</h1>
              <p className="text-muted-foreground text-xs mb-5">Register to start reserving labs & equipment</p>
              <div className="space-y-3">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input name="full_name" required placeholder="Full Name" className={inputClass} />
                </div>
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
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input name="confirm_password" type={showPassword ? 'text' : 'password'} required placeholder="Confirm Password" minLength={8} className={inputClass} />
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 gradient-primary text-primary-foreground border-none rounded-xl font-bold text-sm tracking-wide cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-5">
                {loading ? 'Creating account…' : 'Sign Up'}
              </button>
              <div className="text-center mt-4 text-xs text-muted-foreground">
                Already have an account?{' '}
                <button type="button" onClick={() => switchMode(false)}
                  className="bg-transparent border-none text-primary font-semibold hover:underline cursor-pointer p-0">
                  Sign in
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
                  Already have an account? Sign in to manage your laboratory and equipment reservations.
                </p>
                <button type="button" onClick={() => switchMode(false)}
                  className="px-8 py-2.5 rounded-full border-2 border-primary-foreground/70 text-primary-foreground font-semibold text-sm bg-transparent cursor-pointer hover:bg-primary-foreground/10 transition-colors">
                  Sign In
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
            {isRegister ? 'Sign in here' : 'Register here'}
          </button>
        </div>

        {/* ===== Mobile / tablet fallback: stacked card with simple tab toggle ===== */}
        <div className="lg:hidden w-full max-w-md animate-fade-up">
          <div className="text-center mb-6">
            <img src={cvsuLogo} alt="CvSU Logo" className="w-16 h-16 mx-auto mb-3" width={64} height={64} />
            <h1 className="font-heading text-xl font-bold text-primary-foreground mb-1">CvSU Research Center</h1>
            <p className="text-primary-foreground/50 text-sm">Laboratory Reservation System</p>
          </div>

          <div className="bg-card rounded-2xl p-6 sm:p-8 shadow-xl">
            <div className="flex bg-muted rounded-xl p-1 mb-6">
              <button type="button" onClick={() => switchMode(false)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer border-none ${!isRegister ? 'bg-card text-primary shadow-sm' : 'bg-transparent text-muted-foreground hover:text-foreground'}`}>
                Sign in
              </button>
              <button type="button" onClick={() => switchMode(true)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer border-none ${isRegister ? 'bg-card text-primary shadow-sm' : 'bg-transparent text-muted-foreground hover:text-foreground'}`}>
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
                  {loading ? 'Signing in…' : 'Sign In'}
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
                    <input name="password" type={showPassword ? 'text' : 'password'} required placeholder="Your password" minLength={8} className={inputClass + ' pr-10'} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-muted-foreground hover:text-foreground cursor-pointer">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block mb-1.5 text-foreground font-semibold text-sm">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input name="confirm_password" type={showPassword ? 'text' : 'password'} required placeholder="Re-enter your password" minLength={8} className={inputClass} />
                  </div>
                </div>
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
                {isRegister ? 'Sign in' : 'Register'}
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
