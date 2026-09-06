import { useState, useEffect } from 'react';
import { Search, Plus, X, Pencil } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const EMPTY_EQ = { name: '', brand: '', model: '', laboratory_id: '', quantity: '1', status: 'available' };
const inputCls = "w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary";

const StaffEquipment = () => {
  const { assignedRoomIds } = useAuth();
  const [equipment, setEquipment] = useState([]);
  const [floorLabs, setFloorLabs] = useState([]); // rooms this staff member is assigned to only
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_EQ);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    const [{ data: eqData }, { data: labData }] = await Promise.all([
    supabase.from('equipment').select('*, laboratories(lab_name, lab_code, floor)').order('name'),
    supabase.from('laboratories').select('id, lab_name, lab_code, floor').order('lab_code')]
    );
    const scopedEq = assignedRoomIds.length ? (eqData || []).filter((e) => assignedRoomIds.includes(e.laboratory_id)) : eqData || [];
    const scopedLabs = assignedRoomIds.length ? (labData || []).filter((l) => assignedRoomIds.includes(l.id)) : labData || [];
    setEquipment(scopedEq);
    setFloorLabs(scopedLabs);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [assignedRoomIds]);

  const filtered = equipment.filter((e) =>
  !search ||
  e.name.toLowerCase().includes(search.toLowerCase()) ||
  (e.brand || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const openAdd = () => {
    setEditTarget(null);
    setForm({ ...EMPTY_EQ, laboratory_id: floorLabs[0]?.id ? String(floorLabs[0].id) : '' });
    setShowModal(true);
  };

  const openEdit = (eq) => {
    setEditTarget(eq);
    setForm({
      name: eq.name,
      brand: eq.brand || '',
      model: eq.model || '',
      laboratory_id: eq.laboratory_id ? String(eq.laboratory_id) : '',
      quantity: String(eq.quantity),
      status: eq.status
    });
    setShowModal(true);
  };

  const handleSave = async (ev) => {
    ev.preventDefault();
    if (!form.name.trim()) { toast.error('Equipment name is required.'); return; }
    if (!form.laboratory_id) { toast.error('Please select a laboratory on your floor.'); return; }
    setSaving(true);
    const qty = Math.max(1, Number(form.quantity) || 1);
    const payload = {
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      model: form.model.trim() || null,
      laboratory_id: Number(form.laboratory_id),
      quantity: qty,
      status: form.status
    };

    if (editTarget) {
      const { error } = await supabase.from('equipment').update(payload).eq('id', editTarget.id);
      setSaving(false);
      if (error) { toast.error('Failed to update: ' + error.message); return; }
      toast.success(`${payload.name} updated.`);
    } else {
      const { error } = await supabase.from('equipment').insert({ ...payload, available_quantity: qty });
      setSaving(false);
      if (error) { toast.error('Failed to add: ' + error.message); return; }
      toast.success(`${payload.name} added.`);
    }

    setShowModal(false);
    setEditTarget(null);
    loadData();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold">Equipment</h2>
          <p className="text-xs text-muted-foreground">{assignedRoomIds.length ? `${assignedRoomIds.length} assigned room${assignedRoomIds.length > 1 ? 's' : ''}` : 'all rooms'} — you can add/edit equipment in your assigned rooms</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search equipment..." className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary" />
          </div>
          <button onClick={openAdd} className="gradient-primary text-primary-foreground px-4 py-2 rounded-xl font-semibold text-sm border-none cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all inline-flex items-center gap-2 whitespace-nowrap">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Name</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Laboratory</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Qty Available</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-10 text-muted-foreground text-xs">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-muted-foreground text-xs">No equipment found for your assigned rooms.</td></tr>
            ) : filtered.map((e) =>
            <tr key={e.id} className="border-b border-muted last:border-0">
                <td className="px-4 py-3">
                  <div className="font-semibold">{e.name}</div>
                  {e.brand && <div className="text-xs text-muted-foreground">{e.brand}{e.model ? ` · ${e.model}` : ''}</div>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{e.laboratories?.lab_code || '—'}</td>
                <td className="px-4 py-3">{e.available_quantity} / {e.quantity}</td>
                <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <select
                    value={e.status}
                    onChange={async (ev) => {
                      const newStatus = ev.target.value;
                      const { error } = await supabase.from('equipment').update({ status: newStatus }).eq('id', e.id);
                      if (error) { toast.error('Failed to update status'); return; }
                      setEquipment((prev) => prev.map((eq) => eq.id === e.id ? { ...eq, status: newStatus } : eq));
                      toast.success(`Status updated to ${newStatus}`);
                    }}
                    className="text-xs px-2 py-1 border border-border rounded-lg bg-card text-foreground">

                      <option value="available">Available</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="in_use">In Use</option>
                    </select>
                    <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors border-none cursor-pointer" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal &&
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h3 className="font-heading text-base font-bold">{editTarget ? 'Edit Equipment' : 'Add New Equipment'}</h3>
              <button onClick={() => { setShowModal(false); setEditTarget(null); }} className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Equipment Name <span className="text-destructive">*</span></label>
                <input name="name" value={form.name} onChange={handleChange} placeholder="e.g. Digital Microscope" className={inputCls} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Brand</label>
                  <input name="brand" value={form.brand} onChange={handleChange} placeholder="e.g. Olympus" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Model</label>
                  <input name="model" value={form.model} onChange={handleChange} placeholder="e.g. CX23" className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Laboratory <span className="text-destructive">*</span></label>
                  <select name="laboratory_id" value={form.laboratory_id} onChange={handleChange} className={inputCls} required>
                    <option value="">Select laboratory…</option>
                    {floorLabs.map((l) => <option key={l.id} value={l.id}>{l.lab_code} – {l.lab_name}{l.floor ? ` (${l.floor})` : ''}</option>)}
                  </select>
                  <p className="text-[0.7rem] text-muted-foreground mt-1">Only your assigned rooms are shown.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Quantity</label>
                  <input name="quantity" type="number" min="1" value={form.quantity} onChange={handleChange} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Status</label>
                <select name="status" value={form.status} onChange={handleChange} className={inputCls}>
                  <option value="available">Available</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="in_use">In Use</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditTarget(null); }} className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-semibold cursor-pointer bg-transparent text-foreground">Cancel</button>
                <button type="submit" disabled={saving} className="gradient-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold border-none cursor-pointer hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? editTarget ? 'Saving…' : 'Adding…' : editTarget ? 'Save Changes' : 'Add Equipment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>);

};

export default StaffEquipment;
