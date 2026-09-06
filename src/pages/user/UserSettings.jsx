import { useState, useEffect } from 'react';
import { CheckCircle2, KeyRound, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const inputCls = "w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary";

const UserSettings = () => {
  const { user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (user?.user_metadata?.full_name) {
      setFullName(user.user_metadata.full_name);
    }
  }, [user]);

  // Update Full Name / Username
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Name cannot be empty.');
      return;
    }
    setSavingProfile(true);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName.trim() }
    });
    setSavingProfile(false);

    if (error) {
      toast.error('Failed to update name: ' + error.message);
    } else {
      toast.success('Name updated successfully!');
    }
  };

  // Change Password
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);

    if (error) {
      toast.error('Failed to update password: ' + error.message);
      return;
    }
    setNewPassword('');
    setConfirmPassword('');
    toast.success('Password updated successfully.');
  };

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h2 className="font-heading text-lg font-bold">Settings</h2>
        <p className="text-xs text-muted-foreground">Manage your profile and account settings</p>
      </div>

      {/* Profile / Username Section */}
      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          <h2 className="font-heading text-sm font-bold">Profile Settings</h2>
        </div>
        <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Email</label>
            <input value={user?.email || ''} disabled className={`${inputCls} opacity-60 cursor-not-allowed`} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Full Name / Username</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your name"
              className={inputCls}
              required
            />
          </div>
          <button
            type="submit"
            disabled={savingProfile}
            className="gradient-primary text-primary-foreground px-6 py-2.5 rounded-lg font-semibold text-sm border-none cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50"
          >
            {savingProfile ? 'Saving…' : 'Update Profile'}
          </button>
        </form>
      </div>

      {/* Security Section */}
      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary" />
          <h2 className="font-heading text-sm font-bold">Change Password</h2>
        </div>
        <form onSubmit={handleUpdatePassword} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 6 characters"
              className={inputCls}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className={inputCls}
              required
            />
          </div>
          <button
            type="submit"
            disabled={savingPassword}
            className="gradient-primary text-primary-foreground px-6 py-2.5 rounded-lg font-semibold text-sm border-none cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50"
          >
            {savingPassword ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UserSettings;