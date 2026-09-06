import { useState } from 'react';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const inputCls = "w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary";

const StaffSettings = () => {
  const { user, assignedRooms } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) {
      toast.error('Failed to update password: ' + error.message);
      return;
    }
    setNewPassword('');
    setConfirmPassword('');
    setSaved(true);
    toast.success('Password updated successfully.');
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-md space-y-5">
      <div>
        <h2 className="font-heading text-lg font-bold">Settings</h2>
        <p className="text-xs text-muted-foreground">{assignedRooms.length ? assignedRooms.map((r) => r.lab_name).join(', ') : 'all rooms'}</p>
      </div>

      {saved &&
      <div className="bg-success/10 border border-success/25 text-success rounded-xl p-4 flex items-center gap-2 font-medium text-sm">
          <CheckCircle2 className="w-5 h-5" /> Password updated successfully.
        </div>
      }

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary" />
          <h2 className="font-heading text-sm font-bold">Change Password</h2>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Email</label>
            <input value={user?.email || ''} disabled className={`${inputCls} opacity-60 cursor-not-allowed`} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">New Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 6 characters" className={inputCls} required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" className={inputCls} required />
          </div>
          <button type="submit" disabled={saving} className="gradient-primary text-primary-foreground px-6 py-2.5 rounded-lg font-semibold text-sm border-none cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>);

};

export default StaffSettings;
