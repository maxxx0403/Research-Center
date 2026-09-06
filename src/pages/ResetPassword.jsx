import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Microscope, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { validatePassword } from '@/lib/validation';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setIsRecovery(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    const passwordErr = validatePassword(password);
    if (passwordErr) {
      setError(passwordErr);
      return;
    }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    }
    setLoading(false);
  };

  if (!isRecovery && !success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 gradient-dark relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        <div className="w-full max-w-md relative z-10 text-center">
          <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Microscope className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-primary-foreground mb-2">Invalid Link</h1>
          <p className="text-primary-foreground/50 text-sm mb-6">This password reset link is invalid or has expired.</p>
          <button onClick={() => navigate('/login')} className="py-3 px-6 gradient-primary text-primary-foreground border-none rounded-xl font-bold text-base cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all">
            Back to Login
          </button>
        </div>
      </div>);

  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 gradient-dark relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="absolute inset-[-50%] bg-[radial-gradient(circle_at_25%_30%,hsl(224_72%_40%/0.25),transparent_45%),radial-gradient(circle_at_75%_70%,hsl(187_92%_42%/0.15),transparent_45%)] animate-float z-0" />

      <div className="w-full max-w-md relative z-10 animate-fade-up">
        <div className="text-center mb-8">
          <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Microscope className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-primary-foreground mb-1">Reset Password</h1>
          <p className="text-primary-foreground/50 text-sm">Enter your new password below</p>
        </div>

        <div className="bg-card/10 backdrop-blur-2xl border border-primary-foreground/10 rounded-2xl p-8 shadow-xl">
          {error &&
          <div className="bg-destructive/20 border border-destructive/30 text-destructive-foreground rounded-xl p-3 mb-6 flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          }
          {success ?
          <div className="bg-green-500/20 border border-green-500/30 text-green-200 rounded-xl p-3 flex items-center gap-2 text-sm font-medium">
              <CheckCircle className="w-4 h-4 flex-shrink-0" /> Password updated! Redirecting to login…
            </div> :

          <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block mb-1.5 text-primary-foreground/80 font-semibold text-sm">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-foreground/30" />
                  <input type={showPassword ? 'text' : 'password'} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password"
                className="w-full pl-10 pr-10 py-3 bg-primary-foreground/5 border border-primary-foreground/10 rounded-lg text-primary-foreground placeholder:text-primary-foreground/30 focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-colors" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-primary-foreground/40 hover:text-primary-foreground/70 cursor-pointer">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block mb-1.5 text-primary-foreground/80 font-semibold text-sm">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-foreground/30" />
                  <input type={showPassword ? 'text' : 'password'} required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password"
                className="w-full pl-10 pr-10 py-3 bg-primary-foreground/5 border border-primary-foreground/10 rounded-lg text-primary-foreground placeholder:text-primary-foreground/30 focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-colors" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-primary-foreground/40 hover:text-primary-foreground/70 cursor-pointer">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
            className="w-full py-3 gradient-primary text-primary-foreground border-none rounded-xl font-bold text-base cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          }
        </div>
      </div>
    </div>);

};

export default ResetPassword;