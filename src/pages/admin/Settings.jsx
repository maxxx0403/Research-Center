import { useState, useEffect, Fragment } from 'react';
import { CheckCircle2, UserPlus, Trash2, Users, KeyRound, Pencil, X, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const inputCls = "w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary";
const EMPTY_STAFF = { full_name: '', email: '', password: '', room_ids: [] };

// supabase-js only gives a generic "non-2xx status code" message by default —
// the real reason lives in the response body, reachable via error.context.
const getFunctionErrorMessage = async (error, data) => {
  if (data?.error) return data.error;
  if (error?.context && typeof error.context.json === 'function') {
    try {
      const body = await error.context.json();
      if (body?.error) return body.error;
    } catch {
      // response wasn't JSON, fall through
    }
  }
  return error?.message || 'Unknown error.';
};

const AdminSettings = () => {
  const { user } = useAuth();

  // ── Admin password change ──
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!newPassword) {
      toast.error('Enter a new password.');
      return;
    }
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
    setSaved(true);
    toast.success('Password updated successfully.');
    setTimeout(() => setSaved(false), 3000);
  };

  // ── Staff accounts ──
  const [staff, setStaff] = useState([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_STAFF);
  const [creating, setCreating] = useState(false);
  const [rooms, setRooms] = useState([]); // all laboratories, used to build the room picker

  const loadStaff = async () => {
    setStaffLoading(true);
    const { data, error } = await supabase.rpc('get_staff_list');
    if (error) { toast.error('Failed to load staff: ' + error.message); setStaffLoading(false); return; }
    setStaff(data || []);
    setStaffLoading(false);
  };

  useEffect(() => {
    loadStaff();
    supabase.from('laboratories').select('id, lab_name, lab_code, floor').order('floor').order('lab_name').then(({ data }) => {
      setRooms(data || []);
    });
  }, []);

  // Rooms grouped by floor, for a friendlier checklist (unassigned floor bucketed as "Other").
  const roomsByFloor = rooms.reduce((acc, r) => {
    const key = r.floor || 'Other';
    (acc[key] = acc[key] || []).push(r);
    return acc;
  }, {});

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const toggleRoom = (roomId) => {
    setForm((f) => ({
      ...f,
      room_ids: f.room_ids.includes(roomId) ?
      f.room_ids.filter((id) => id !== roomId) :
      [...f.room_ids, roomId]
    }));
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!form.email.trim() || !form.password || form.room_ids.length === 0) {
      toast.error('Email, password, and at least one room are required.');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke('create-staff', {
      body: {
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        room_ids: form.room_ids,
      },
    });
    setCreating(false);

    if (error || data?.error) {
      const message = await getFunctionErrorMessage(error, data);
      toast.error('Failed to create staff account: ' + message);
      return;
    }

    toast.success(`Staff account created for ${form.email}`);
    setForm(EMPTY_STAFF);
    loadStaff();
  };

  // ── Edit an existing staff member's assigned rooms ──
  const [editingStaff, setEditingStaff] = useState(null); // { user_id, email, room_ids }
  const [savingEdit, setSavingEdit] = useState(false);

  const startEditRooms = (member) => {
    setEditingStaff({
      user_id: member.user_id,
      email: member.email,
      room_ids: (member.assigned_rooms || []).map((r) => r.id),
    });
  };

  const cancelEditRooms = () => setEditingStaff(null);

  const toggleEditRoom = (roomId) => {
    setEditingStaff((s) => ({
      ...s,
      room_ids: s.room_ids.includes(roomId) ?
      s.room_ids.filter((id) => id !== roomId) :
      [...s.room_ids, roomId]
    }));
  };

  const handleSaveRooms = async () => {
    if (!editingStaff.room_ids.length) {
      toast.error('Select at least one room.');
      return;
    }
    setSavingEdit(true);
    const { data, error } = await supabase.functions.invoke('create-staff', {
      body: {
        action: 'update_rooms',
        user_id: editingStaff.user_id,
        room_ids: editingStaff.room_ids,
      },
    });
    setSavingEdit(false);

    if (error || data?.error) {
      const message = await getFunctionErrorMessage(error, data);
      toast.error('Failed to update rooms: ' + message);
      return;
    }

    toast.success(`Rooms updated for ${editingStaff.email}`);
    setEditingStaff(null);
    loadStaff();
  };

  const handleDeleteStaff = async (member) => {
    if (!confirm(`Remove staff account "${member.email}"?`)) return;
    const { data, error } = await supabase.functions.invoke('create-staff', {
      body: { action: 'delete', user_id: member.user_id },
    });
    if (error || data?.error) {
      const message = await getFunctionErrorMessage(error, data);
      toast.error('Failed to remove staff: ' + message);
      return;
    }
    toast.success(`${member.email} removed.`);
    setStaff((prev) => prev.filter((s) => s.user_id !== member.user_id));
  };

  return (
    <div className="max-w-4xl space-y-5">
      {saved &&
      <div className="bg-success/10 border border-success/25 text-success rounded-xl p-4 flex items-center gap-2 font-medium text-sm animate-slide-in">
          <CheckCircle2 className="w-5 h-5" /> Password updated successfully.
        </div>
      }
      <form onSubmit={handleSave} className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary" />
          <h2 className="font-heading text-sm font-bold">Admin Profile</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Email</label>
            <input value={user?.email || ''} disabled className={`${inputCls} opacity-60 cursor-not-allowed`} />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">New Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 6 characters" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" className={inputCls} />
          </div>
          <button type="submit" disabled={savingPassword} className="gradient-primary text-primary-foreground px-6 py-2.5 rounded-lg font-semibold text-sm border-none cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {savingPassword ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* ── Staff Accounts ── */}
      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h2 className="font-heading text-sm font-bold">Staff Accounts</h2>
        </div>
        <div className="p-6 space-y-5">
          <p className="text-xs text-muted-foreground -mt-2">
            Staff accounts can monitor equipment and laboratories, and view reservations for their
            assigned rooms only. They cannot approve/reject reservations or access the Dashboard.
          </p>

          <form onSubmit={handleCreateStaff} className="space-y-4 bg-muted/30 rounded-xl p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-foreground mb-1">Full Name</label>
                <input name="full_name" value={form.full_name} onChange={handleChange} placeholder="e.g. Juan Dela Cruz" className={inputCls} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-foreground mb-1">Email <span className="text-destructive">*</span></label>
                <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="staff@researchcenter.com" className={inputCls} required />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-foreground mb-1">Temporary Password <span className="text-destructive">*</span></label>
                <input name="password" type="text" value={form.password} onChange={handleChange} placeholder="Min. 6 characters" className={inputCls} required />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Assigned Rooms <span className="text-destructive">*</span>
                {form.room_ids.length > 0 && <span className="text-muted-foreground font-normal"> ({form.room_ids.length} selected)</span>}
              </label>
              {Object.keys(roomsByFloor).length === 0 ?
              <p className="text-xs text-muted-foreground">No laboratories found — add one under Laboratories first.</p> :

              <div className="border border-border rounded-lg bg-card max-h-56 overflow-y-auto divide-y divide-border">
                  {Object.entries(roomsByFloor).map(([floor, floorRooms]) =>
                <div key={floor} className="p-3">
                      <div className="text-[0.7rem] font-bold text-muted-foreground uppercase tracking-wider mb-2">{floor}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {floorRooms.map((r) =>
                    <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer select-none px-2 py-1 rounded-lg hover:bg-muted/60">
                            <input
                        type="checkbox"
                        checked={form.room_ids.includes(r.id)}
                        onChange={() => toggleRoom(r.id)}
                        className="accent-primary" />

                            <span>{r.lab_name} <span className="text-muted-foreground text-xs">({r.lab_code})</span></span>
                          </label>
                    )}
                      </div>
                    </div>
                )}
                </div>
              }
            </div>

            <div>
              <button type="submit" disabled={creating} className="gradient-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold border-none cursor-pointer hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> {creating ? 'Creating…' : 'Create Staff Account'}
              </button>
            </div>
          </form>

          <div className="border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[560px]">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Name</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Email</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Rooms</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody>
                {staffLoading ? (
                  <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-xs">Loading…</td></tr>
                ) : staff.length ? staff.map((m) => (
                  <Fragment key={m.user_id}>
                    <tr className="border-b border-muted last:border-0">
                      <td className="px-4 py-2.5">{m.full_name || '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{m.email}</td>
                      <td className="px-4 py-2.5">
                        {m.assigned_rooms?.length > 0 ?
                      <div className="flex flex-wrap gap-1">
                            {m.assigned_rooms.map((r) =>
                        <span key={r.id} className="bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                                {r.floor ? `${r.floor} · ` : ''}{r.lab_name}
                              </span>
                        )}
                          </div> :

                      <span className="text-muted-foreground text-xs">No rooms assigned</span>
                      }
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button onClick={() => editingStaff?.user_id === m.user_id ? cancelEditRooms() : startEditRooms(m)} className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors border-none cursor-pointer mr-1.5" title="Edit assigned rooms">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteStaff(m)} className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors border-none cursor-pointer" title="Remove">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                    {editingStaff?.user_id === m.user_id &&
                    <tr className="border-b border-muted last:border-0">
                        <td colSpan={4} className="px-4 py-4 bg-muted/30">
                          <div className="space-y-3">
                            <div className="text-xs font-semibold text-foreground">
                              Editing rooms for {m.email}
                              {editingStaff.room_ids.length > 0 && <span className="text-muted-foreground font-normal"> ({editingStaff.room_ids.length} selected)</span>}
                            </div>
                            {Object.keys(roomsByFloor).length === 0 ?
                          <p className="text-xs text-muted-foreground">No laboratories found — add one under Laboratories first.</p> :

                          <div className="border border-border rounded-lg bg-card max-h-56 overflow-y-auto divide-y divide-border">
                                {Object.entries(roomsByFloor).map(([floor, floorRooms]) =>
                            <div key={floor} className="p-3">
                                    <div className="text-[0.7rem] font-bold text-muted-foreground uppercase tracking-wider mb-2">{floor}</div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                      {floorRooms.map((r) =>
                              <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer select-none px-2 py-1 rounded-lg hover:bg-muted/60">
                                          <input
                                  type="checkbox"
                                  checked={editingStaff.room_ids.includes(r.id)}
                                  onChange={() => toggleEditRoom(r.id)}
                                  className="accent-primary" />

                                          <span>{r.lab_name} <span className="text-muted-foreground text-xs">({r.lab_code})</span></span>
                                        </label>
                              )}
                                    </div>
                                  </div>
                            )}
                              </div>
                          }
                            <div className="flex gap-2">
                              <button onClick={handleSaveRooms} disabled={savingEdit} className="gradient-primary text-primary-foreground px-4 py-1.5 rounded-lg text-xs font-semibold border-none cursor-pointer hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5">
                                <Save className="w-3.5 h-3.5" /> {savingEdit ? 'Saving…' : 'Save Rooms'}
                              </button>
                              <button onClick={cancelEditRooms} disabled={savingEdit} className="px-4 py-1.5 rounded-lg text-xs font-semibold border border-border cursor-pointer hover:bg-muted/60 transition-all disabled:opacity-50 inline-flex items-center gap-1.5">
                                <X className="w-3.5 h-3.5" /> Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    }
                  </Fragment>
                )) : (
                  <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-xs">No staff accounts yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;