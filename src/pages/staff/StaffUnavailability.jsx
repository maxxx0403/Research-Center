import { useState, useEffect } from 'react';
import { CalendarOff, Trash2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const inputCls = "w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary";

const todayStr = () => new Date().toISOString().slice(0, 10);

const StaffUnavailability = () => {
  const { user, assignedRooms } = useAuth();

  const [unavailableDates, setUnavailableDates] = useState([]);
  const [newDate, setNewDate] = useState('');
  const [newReason, setNewReason] = useState('');
  const [newLabId, setNewLabId] = useState(''); // '' = all rooms
  const [addingDate, setAddingDate] = useState(false);
  const [loadingDates, setLoadingDates] = useState(true);
  const [labs, setLabs] = useState([]);

  const fetchUnavailableDates = async () => {
    if (!user) return;
    setLoadingDates(true);
    const { data, error } = await supabase
      .from('staff_unavailability')
      .select('*, laboratories(lab_name, lab_code)')
      .eq('user_id', user.id)
      .order('unavailable_date', { ascending: true });
    if (!error) setUnavailableDates(data || []);
    setLoadingDates(false);
  };

  useEffect(() => {
    fetchUnavailableDates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Rooms this staff member can pick from: their assigned rooms if they have
  // any, otherwise fall back to every laboratory.
  useEffect(() => {
    (async () => {
      if (assignedRooms && assignedRooms.length > 0) {
        setLabs(assignedRooms);
        setNewLabId((prev) => prev || String(assignedRooms[0].id));
        return;
      }
      const { data } = await supabase.from('laboratories').select('id, lab_name, lab_code').order('lab_name');
      setLabs(data || []);
      setNewLabId((prev) => prev || (data?.[0] ? String(data[0].id) : ''));
    })();
  }, [assignedRooms]);

  const handleAddUnavailableDate = async (e) => {
    e.preventDefault();
    if (!newDate) {
      toast.error('Please select a date.');
      return;
    }
    if (!newLabId) {
      toast.error('Please select which room you\'ll be unavailable for.');
      return;
    }
    setAddingDate(true);
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle();
    const { error } = await supabase.from('staff_unavailability').insert({
      user_id: user.id,
      unavailable_date: newDate,
      reason: newReason.trim() || null,
      staff_name: profile?.full_name || user.email || 'A staff member',
      laboratory_id: Number(newLabId),
    });
    setAddingDate(false);
    if (error) {
      if (error.code === '23505') {
        toast.error('That date (and room) is already marked as unavailable.');
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

  return (
    <div className="max-w-md space-y-5">
      <div>
        <h2 className="font-heading text-lg font-bold">My Unavailable Dates</h2>
        <p className="text-xs text-muted-foreground">Dates you won't be available get shown on the shared calendar and reported to admin.</p>
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <CalendarOff className="w-4 h-4 text-primary" />
          <h2 className="font-heading text-sm font-bold">My Unavailable Dates</h2>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-xs text-muted-foreground">
            Mark dates you won't be available so the admin knows not to schedule you then.
          </p>

          <form onSubmit={handleAddUnavailableDate} className="flex flex-col sm:flex-row gap-2 sm:items-end sm:flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-semibold text-foreground mb-1">Date <span className="text-destructive">*</span></label>
              <input
                type="date"
                min={todayStr()}
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className={inputCls}
                required
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-semibold text-foreground mb-1">Room <span className="text-destructive">*</span></label>
              <select
                value={newLabId}
                onChange={(e) => setNewLabId(e.target.value)}
                className={inputCls}
                required
              >
                {labs.length === 0 && <option value="">No rooms found</option>}
                {labs.map((lab) => (
                  <option key={lab.id} value={lab.id}>{lab.lab_name} ({lab.lab_code})</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[160px]">
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
                    <p className="text-xs text-primary font-medium">
                      {d.laboratories ? `${d.laboratories.lab_name} (${d.laboratories.lab_code})` : 'All rooms'}
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
    </div>
  );
};

export default StaffUnavailability;