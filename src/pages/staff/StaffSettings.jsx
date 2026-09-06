import { useState, useEffect } from 'react';
import { CheckCircle2, KeyRound, CalendarOff, Trash2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const inputCls = "w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary";

const todayStr = () => new Date().toISOString().slice(0, 10);

const StaffSettings = () => {
  const { user, assignedRooms } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [unavailableDates, setUnavailableDates] = useState([]);
  const [newDate, setNewDate] = useState('');
  const [newReason, setNewReason] = useState('');
  const [addingDate, setAddingDate] = useState(false);
  const [loadingDates, setLoadingDates] = useState(true);

  const fetchUnavailableDates = async () => {
    if (!user) return;
    setLoadingDates(true);
    const { data, error } = await supabase
      .from('staff_unavailability')
      .select('*')
      .eq('user_id', user.id)
      .order('unavailable_date', { ascending: true });
    if (!error) setUnavailableDates(data || []);
    setLoadingDates(false);
  };

  useEffect(() => {
    fetchUnavailableDates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleAddUnavailableDate = async (e) => {
    e.preventDefault();
    if (!newDate) {
      toast.error('Please select a date.');
      return;
    }
    setAddingDate(true);
    const { error } = await supabase.from('staff_unavailability').insert({
      user_id: user.id,
      unavailable_date: newDate,
      reason: newReason.trim() || null,
    });
    setAddingDate(false);
    if (error) {
      if (error.code === '23505') {
        toast.error('That date is already marked as unavailable.');
      } else {
        toast.error('Failed to add date: ' + error.message);
      }
      return;
    }
    setNewDate('');
    setNewReason('');
    toast.success('Date marked as unavailable.');
    fetchUnavailableDates();
  };

  const handleRemoveUnavailableDate = async (id) => {
    const { error } = await supabase.from('staff_unavailability').delete().eq('id', id);
    if (error) {
      toast.error('Failed to remove date: ' + error.message);
      return;
    }
    toast.success('Date removed.');
    setUnavailableDates((prev) => prev.filter((d) => d.id !== id));
  };

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
          <CalendarOff className="w-4 h-4 text-primary" />
          <h2 className="font-heading text-sm font-bold">My Unavailable Dates</h2>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-xs text-muted-foreground">
            Mark dates you won't be available so the admin knows not to schedule you then.
          </p>

          <form onSubmit={handleAddUnavailableDate} className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-foreground mb-1">Date</label>
              <input
                type="date"
                min={todayStr()}
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className={inputCls}
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-foreground mb-1">Reason (optional)</label>
              <input
                type="text"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="e.g. On leave"
                className={inputCls}
              />
            </div>
            <button
              type="submit"
              disabled={addingDate}
              className="gradient-primary text-primary-foreground px-4 py-2.5 rounded-lg font-semibold text-sm border-none cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> {addingDate ? 'Adding…' : 'Add Date'}
            </button>
          </form>

          <div className="space-y-2">
            {loadingDates ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : unavailableDates.length === 0 ? (
              <p className="text-xs text-muted-foreground">No unavailable dates set.</p>
            ) : (
              unavailableDates.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-2.5"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {new Date(`${d.unavailable_date}T00:00:00`).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    {d.reason && <p className="text-xs text-muted-foreground">{d.reason}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveUnavailableDate(d.id)}
                    className="p-1.5 hover:bg-destructive/10 text-destructive rounded transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

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
