import { useState, useEffect } from 'react';
import { Plus, X, Pencil, Trash2, Search, Minus, UserPlus } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const EMPTY_LAB = { lab_name: '', lab_code: '', floor: '', description: '', max_capacity: '', equipment_list: '', status: 'available' };
const inputCls = "w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary";

const Laboratories = () => {
  const [labs, setLabs] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_LAB);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase.from('laboratories').select('*').order('id').then(({ data }) => setLabs(data || []));
  }, []);

  const filtered = labs.filter((l) =>
    !search ||
    l.lab_name.toLowerCase().includes(search.toLowerCase()) ||
    l.lab_code.toLowerCase().includes(search.toLowerCase())
  );

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));


  const openAdd = () => { setEditTarget(null); setForm(EMPTY_LAB); setShowModal(true); };

  const openEdit = (lab) => {
    setEditTarget(lab);
    setForm({
      lab_name: lab.lab_name,
      lab_code: lab.lab_code,
      floor: lab.floor || '',
      description: lab.description || '',
      max_capacity: lab.max_capacity ? String(lab.max_capacity) : '',
      equipment_list: lab.equipment_list || '',
      status: lab.status,
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.lab_name.trim() || !form.lab_code.trim()) { toast.error('Lab name and code are required.'); return; }
    setSaving(true);
    const payload = {
      lab_name: form.lab_name.trim(),
      lab_code: form.lab_code.trim().toUpperCase(),
      floor: form.floor.trim() || null,
      description: form.description.trim() || null,
      max_capacity: form.max_capacity ? Number(form.max_capacity) : 0,
      equipment_list: form.equipment_list.trim() || null,
      status: form.status,
    };

    if (editTarget) {
      const { data, error } = await supabase.from('laboratories').update(payload).eq('id', editTarget.id).select().single();
      setSaving(false);
      if (error) { toast.error('Failed to update: ' + error.message); return; }
      setLabs((prev) => prev.map((l) => l.id === editTarget.id ? data : l));
      toast.success(`${data.lab_name} updated successfully!`);
    } else {
      const { data, error } = await supabase.from('laboratories').insert({ ...payload, current_occupancy: 0 }).select().single();
      setSaving(false);
      if (error) { toast.error('Failed to add: ' + error.message); return; }
      setLabs((prev) => [...prev, data]);
      toast.success(`${data.lab_name} added successfully!`);
    }

    setForm(EMPTY_LAB); setShowModal(false); setEditTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('laboratories').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) { toast.error('Failed to delete: ' + error.message); return; }
    setLabs((prev) => prev.filter((l) => l.id !== deleteTarget.id));
    toast.success(`${deleteTarget.lab_name} deleted.`);
    setDeleteTarget(null);
  };

  // Manually adjust how many people are currently inside a lab. The room's
  // status follows this count: it becomes "occupied" as soon as someone's
  // inside, and back to "available" once it's empty. A room under
  // maintenance keeps that status regardless of occupancy.
  const adjustOccupancy = async (lab, delta) => {
    const current = lab.current_occupancy ?? 0;
    const max = lab.max_capacity || 0;
    const next = Math.max(0, max > 0 ? Math.min(max, current + delta) : current + delta);
    if (next === current) return;

    const updates = { current_occupancy: next };
    if (lab.status !== 'maintenance') {
      updates.status = next > 0 ? 'occupied' : 'available';
    }

    const { error } = await supabase.from('laboratories').update(updates).eq('id', lab.id);
    if (error) { toast.error('Failed to update occupancy: ' + error.message); return; }
    setLabs((prev) => prev.map((l) => l.id === lab.id ? { ...l, ...updates } : l));
  };

  return (
    <>
      {/* Search + Add */}
      <div className="bg-card rounded-xl shadow-card p-4 mb-5">
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
          <button
            onClick={openAdd}
            className="gradient-primary text-primary-foreground px-4 py-2 rounded-xl font-semibold text-sm border-none cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Laboratory
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{filtered.length} laborator{filtered.length === 1 ? 'y' : 'ies'}</p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(420px,1fr))] gap-5">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full text-center py-8">No laboratories found.</p>
        )}
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
                  <button onClick={() => openEdit(lab)} className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors border-none cursor-pointer" title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDeleteTarget(lab)} className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors border-none cursor-pointer" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">{lab.description}</p>
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
                {lab.equipment_list && (
                  <div className="text-xs text-muted-foreground"><strong className="text-foreground">Equipment:</strong> {lab.equipment_list}</div>
                )}
                <div className="flex gap-2 pt-2 border-t border-border">
                  {['available', 'maintenance'].map((s) =>
                    <button
                      key={s}
                      disabled={lab.status === s}
                      onClick={async () => {
                        const { error } = await supabase.from('laboratories').update({ status: s }).eq('id', lab.id);
                        if (error) { toast.error('Failed to update status'); return; }
                        setLabs((prev) => prev.map((l) => l.id === lab.id ? { ...l, status: s } : l));
                        toast.success(`Status updated to ${s}`);
                      }}
                      className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors ${lab.status === s ? 'bg-primary/20 text-primary cursor-default' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}`}
                    >
                      {s === 'maintenance' ? 'Under Maintenance' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h3 className="font-heading text-base font-bold">{editTarget ? 'Edit Laboratory' : 'Add New Laboratory'}</h3>
              <button onClick={() => { setShowModal(false); setEditTarget(null); }} className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Lab Name <span className="text-destructive">*</span></label>
                  <input name="lab_name" value={form.lab_name} onChange={handleChange} placeholder="e.g. Chemistry Lab" className={inputCls} required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Lab Code <span className="text-destructive">*</span></label>
                  <input name="lab_code" value={form.lab_code} onChange={handleChange} placeholder="e.g. CHEM-01" className={inputCls} required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Floor</label>
                <input name="floor" value={form.floor} onChange={handleChange} placeholder="e.g. 2nd Floor" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Description</label>
                <textarea name="description" value={form.description} onChange={handleChange} placeholder="Brief description of the laboratory…" rows={3} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Max Capacity</label>
                  <input name="max_capacity" type="number" min="0" value={form.max_capacity} onChange={handleChange} placeholder="e.g. 20" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Status</label>
                  <select name="status" value={form.status} onChange={handleChange} className={inputCls}>
                    <option value="available">Available</option>
                    <option value="maintenance">Under Maintenance</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Equipment List</label>
                <input name="equipment_list" value={form.equipment_list} onChange={handleChange} placeholder="e.g. Microscope, Centrifuge, pH Meter" className={inputCls} />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditTarget(null); }} className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-semibold cursor-pointer bg-transparent text-foreground">Cancel</button>
                <button type="submit" disabled={saving} className="gradient-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold border-none cursor-pointer hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? (editTarget ? 'Saving…' : 'Adding…') : (editTarget ? 'Save Changes' : 'Add Laboratory')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-lg w-full max-w-sm p-6">
            <h3 className="font-heading text-base font-bold mb-2">Delete Laboratory</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to delete <strong className="text-foreground">{deleteTarget.lab_name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-semibold cursor-pointer bg-transparent text-foreground">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold border-none cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Laboratories;