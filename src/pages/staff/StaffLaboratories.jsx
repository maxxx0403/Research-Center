import { useState, useEffect } from 'react';
import { Search, Minus, Plus, UserPlus, RefreshCw, Pencil, X } from 'lucide-react';
import RowActions from '@/components/RowActions';
import StatusBadge from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import NonOfficialToggle, { NonOfficialBulk, saveNonOfficialHours } from '@/components/NonOfficialToggle';
import { logCatalogAction, summarizeChanges } from '@/lib/activityLog';
import { catalogDuplicateErrorMessage, isDuplicateLaboratory } from '@/lib/catalogValidation';

const LAB_FIELDS = [
  { key: 'lab_name', label: 'Name' },
  { key: 'lab_code', label: 'Code' },
  { key: 'floor', label: 'Floor' },
  { key: 'description', label: 'Description' },
  { key: 'max_capacity', label: 'Max capacity' },
  { key: 'equipment_list', label: 'Equipment list' },
];
const inputCls = "w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary";

const StaffLaboratories = () => {
  const { user, assignedRoomIds } = useAuth();
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadLabs = async () => {
    let query = supabase.from('laboratories').select('*').order('lab_code');
    if (assignedRoomIds.length) query = query.in('id', assignedRoomIds);
    const { data } = await query;
    setLabs(data || []);
    setLoading(false);
  };

  useEffect(() => { loadLabs(); }, [assignedRoomIds]);

  const updateStatus = async (lab, newStatus) => {
    const { error } = await supabase.from('laboratories').update({ status: newStatus }).eq('id', lab.id);
    if (error) { toast.error('Failed to update status: ' + error.message); return; }
    setLabs((prev) => prev.map((l) => l.id === lab.id ? { ...l, status: newStatus } : l));
    logCatalogAction({ userId: user?.id, type: 'laboratory', verb: 'Updated', item: lab, laboratoryIds: [lab.id], detail: `Status: ${lab.status} → ${newStatus}` });
    toast.success(`${lab.lab_name} marked as ${newStatus}.`);
  };

  // Manually adjust how many people are currently inside a lab. The room's
  // status follows this count: it stays "available" while there's still room,
  // and becomes "occupied" only once it's full (current === max capacity).
  // A room under maintenance keeps that status regardless of occupancy.
  const adjustOccupancy = async (lab, delta) => {
    const current = lab.current_occupancy ?? 0;
    const max = lab.max_capacity || 0;
    const next = Math.max(0, max > 0 ? Math.min(max, current + delta) : current + delta);
    if (next === current) return;

    const updates = { current_occupancy: next };
    if (lab.status !== 'maintenance') {
      updates.status = max > 0 && next >= max ? 'occupied' : 'available';
    }

    const { error } = await supabase.from('laboratories').update(updates).eq('id', lab.id);
    if (error) { toast.error('Failed to update occupancy: ' + error.message); return; }
    setLabs((prev) => prev.map((l) => l.id === lab.id ? { ...l, ...updates } : l));
  };

  const openEdit = (lab) => {
    setEditTarget(lab);
    setForm({
      lab_name: lab.lab_name || '',
      lab_code: lab.lab_code || '',
      floor: lab.floor || '',
      description: lab.description || '',
      max_capacity: lab.max_capacity ? String(lab.max_capacity) : '',
      equipment_list: lab.equipment_list || '',
    });
  };

  const closeEdit = () => { setEditTarget(null); setForm(null); };

  const handleFormChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editTarget || !form) return;
    if (!form.lab_name.trim() || !form.lab_code.trim()) { toast.error('Lab name and code are required.'); return; }
    const payload = {
      lab_name: form.lab_name.trim(),
      lab_code: form.lab_code.trim().toUpperCase(),
      floor: form.floor.trim() || null,
      description: form.description.trim() || null,
      max_capacity: form.max_capacity ? Number(form.max_capacity) : 0,
      equipment_list: form.equipment_list.trim() || null,
    };
    if (isDuplicateLaboratory(labs, payload, editTarget.id)) {
      toast.error('A laboratory with the same code or the same name and floor already exists.');
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.from('laboratories').update(payload).eq('id', editTarget.id).select().single();
    setSaving(false);
    if (error) { toast.error(catalogDuplicateErrorMessage(error, 'update')); return; }
    setLabs((prev) => prev.map((l) => (l.id === editTarget.id ? data : l)));
    logCatalogAction({
      userId: user?.id,
      type: 'laboratory',
      verb: 'Updated',
      item: data,
      laboratoryIds: [data.id],
      detail: summarizeChanges(editTarget, data, LAB_FIELDS),
    });
    toast.success(`${data.lab_name} updated successfully!`);
    closeEdit();
  };

  const filtered = labs.filter((l) =>
  !search ||
  l.lab_name.toLowerCase().includes(search.toLowerCase()) ||
  l.lab_code.toLowerCase().includes(search.toLowerCase())
  );

  // Friday - Sunday bookings ON/OFF
  const toggleNonOfficial = async (lab, value) => {
    const error = await saveNonOfficialHours('laboratories', [lab.id], value);
    if (error) { toast.error('Failed to update: ' + error.message); return; }
    setLabs((prev) => prev.map((l) => (l.id === lab.id ? { ...l, allow_non_official_hours: value } : l)));
    logCatalogAction({ userId: user?.id, type: 'laboratory', verb: 'Updated', item: lab, laboratoryIds: [lab.id], detail: `Friday–Sunday bookings: ${value ? 'ON' : 'OFF'}` });
    toast.success(`${lab.lab_name}: Friday–Sunday bookings ${value ? 'ON' : 'OFF'}.`);
  };

  const setAllNonOfficial = async (value) => {
    const ids = filtered.map((l) => l.id);
    if (!ids.length) return;
    const error = await saveNonOfficialHours('laboratories', ids, value);
    if (error) { toast.error('Failed to update: ' + error.message); return; }
    const changed = labs.filter((l) => ids.includes(l.id) && !!l.allow_non_official_hours !== value);
    setLabs((prev) => prev.map((l) => (ids.includes(l.id) ? { ...l, allow_non_official_hours: value } : l)));
    changed.forEach((l) => logCatalogAction({ userId: user?.id, type: 'laboratory', verb: 'Updated', item: l, laboratoryIds: [l.id], detail: `Friday–Sunday bookings: ${value ? 'ON' : 'OFF'}` }));
    toast.success(`Friday–Sunday bookings turned ${value ? 'ON' : 'OFF'} for ${ids.length} laborator${ids.length === 1 ? 'y' : 'ies'}.`);
  };

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="bg-card rounded-xl shadow-card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Lab name or code…"
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
          <p className="text-xs text-muted-foreground">{filtered.length} laborator{filtered.length === 1 ? 'y' : 'ies'}</p>
          <NonOfficialBulk count={filtered.length} disabled={filtered.length === 0} onAll={setAllNonOfficial} />
        </div>
      </div>

      {loading ?
      <div className="text-center py-16 text-muted-foreground text-sm">Loading...</div> :
      filtered.length === 0 ?
      <div className="text-center py-16 text-muted-foreground text-sm bg-card rounded-xl shadow-card">No laboratories found for your assigned rooms.</div> :

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,420px),1fr))] gap-5">
          {filtered.map((lab) => {
          const pct = (lab.max_capacity ?? 0) > 0 ? Math.round((lab.current_occupancy ?? 0) / (lab.max_capacity ?? 1) * 100) : 0;
          const barColor = pct >= 90 ? 'bg-destructive' : pct >= 70 ? 'bg-warning' : 'bg-success';
          return (
            <div key={lab.id} className="bg-card rounded-xl shadow-card overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex justify-between items-start gap-2">
                <div>
                  <h2 className="font-heading text-sm font-bold">{lab.lab_name}</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <code className="text-[0.7rem] bg-muted px-1.5 py-0.5 rounded text-primary">{lab.lab_code}</code>
                    {lab.floor && <span className="text-[0.7rem] text-muted-foreground">· {lab.floor}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={lab.status} />
                  <RowActions
                    items={[
                      { label: 'Edit', icon: Pencil, onClick: () => openEdit(lab) },
                      {
                        label: 'Change status',
                        icon: RefreshCw,
                        value: lab.status,
                        options: [
                          { value: 'available', label: 'Available' },
                          { value: 'maintenance', label: 'Under Maintenance' },
                        ],
                        onChange: (st) => updateStatus(lab, st),
                      },
                    ]}
                  />
                </div>
              </div>
              <div className="p-5 space-y-4">
                {lab.description && <p className="text-xs text-muted-foreground leading-relaxed">{lab.description}</p>}
                <div>
                  <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground mb-1">
                    <span className="inline-flex items-center gap-1"><UserPlus className="w-3.5 h-3.5" /> Occupancy</span>
                    <span>{lab.current_occupancy ?? 0} / {lab.max_capacity ?? 0} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden mb-2"><div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => adjustOccupancy(lab, -1)}
                      disabled={(lab.current_occupancy ?? 0) <= 0}
                      className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground disabled:opacity-40 disabled:cursor-not-allowed border-none cursor-pointer transition-colors"
                      title="Remove one person"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs text-muted-foreground w-28 text-center">people inside</span>
                    <button
                      type="button"
                      onClick={() => adjustOccupancy(lab, 1)}
                      disabled={lab.max_capacity ? (lab.current_occupancy ?? 0) >= lab.max_capacity : false}
                      className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground disabled:opacity-40 disabled:cursor-not-allowed border-none cursor-pointer transition-colors"
                      title="Add one person"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-semibold text-foreground">Friday – Sunday bookings</div>
                    <div className="text-muted-foreground">Non-official hours (7:00 AM – 6:00 PM)</div>
                  </div>
                  <NonOfficialToggle checked={!!lab.allow_non_official_hours} onChange={(v) => toggleNonOfficial(lab, v)} />
                </div>
                {lab.equipment_list && (
                  <div className="text-xs text-muted-foreground"><strong className="text-foreground">Equipment:</strong> {lab.equipment_list}</div>
                )}
              </div>
            </div>
          );
        })}
        </div>
      }
      {editTarget && form && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h3 className="font-heading text-base font-bold">Edit Laboratory</h3>
              <button type="button" onClick={closeEdit} className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Lab Name <span className="text-destructive">*</span></label>
                  <input name="lab_name" value={form.lab_name} onChange={handleFormChange} className={inputCls} required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Lab Code <span className="text-destructive">*</span></label>
                  <input name="lab_code" value={form.lab_code} onChange={handleFormChange} className={inputCls} required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Floor</label>
                <input name="floor" value={form.floor} onChange={handleFormChange} placeholder="e.g. 2nd Floor" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Description</label>
                <textarea name="description" value={form.description} onChange={handleFormChange} rows={3} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Max Capacity</label>
                <input name="max_capacity" type="number" min="0" value={form.max_capacity} onChange={handleFormChange} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Equipment List</label>
                <input name="equipment_list" value={form.equipment_list} onChange={handleFormChange} placeholder="e.g. Microscope, Centrifuge" className={inputCls} />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={closeEdit} className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-semibold cursor-pointer bg-transparent text-foreground">Cancel</button>
                <button type="submit" disabled={saving} className="gradient-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold border-none cursor-pointer hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>);

};

export default StaffLaboratories;