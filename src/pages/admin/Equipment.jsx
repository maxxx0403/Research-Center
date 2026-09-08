import { useState, useEffect } from 'react';
import { Search, Plus, X, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import StatusBadge from '@/components/StatusBadge';
import { toast } from 'sonner';

const EMPTY_EQ = { name: '', brand: '', model: '', laboratory_id: '', quantity: '1', status: 'available' };
const inputCls = "w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary";

const AdminEquipment = () => {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLab, setSelectedLab] = useState(0);
  const [labs, setLabs] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_EQ);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const [{ data: eqData }, { data: labData }] = await Promise.all([
        supabase.from('equipment').select('*, laboratories(lab_name, lab_code, floor)').order('name'),
        supabase.from('laboratories').select('id, lab_name, lab_code, floor').order('lab_code'),
      ]);
      setEquipment(eqData || []);
      setLabs(labData || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = equipment.filter((e) => {
    const matchesSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || (e.brand || '').toLowerCase().includes(search.toLowerCase());
    const matchesLab = !selectedLab || e.laboratories && labs.find((l) => l.id === selectedLab)?.lab_code === e.laboratories.lab_code;
    return matchesSearch && matchesLab;
  });

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const openAdd = () => { setEditTarget(null); setForm(EMPTY_EQ); setShowModal(true); };

  const openEdit = (eq) => {
    setEditTarget(eq);
    setForm({
      name: eq.name,
      brand: eq.brand || '',
      model: eq.model || '',
      laboratory_id: eq.laboratory_id ? String(eq.laboratory_id) : '',
      quantity: String(eq.quantity),
      status: eq.status,
    });
    setShowModal(true);
  };

  const handleSave = async (ev) => {
    ev.preventDefault();
    if (!form.name.trim()) { toast.error('Equipment name is required.'); return; }
    setSaving(true);
    const qty = Math.max(1, Number(form.quantity) || 1);
    const payload = {
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      model: form.model.trim() || null,
      laboratory_id: form.laboratory_id ? Number(form.laboratory_id) : null,
      quantity: qty,
      status: form.status,
    };

    if (editTarget) {
      const { data, error } = await supabase.from('equipment').update(payload).eq('id', editTarget.id).select('*, laboratories(lab_name, lab_code)').single();
      setSaving(false);
      if (error) { toast.error('Failed to update: ' + error.message); return; }
      setEquipment((prev) => prev.map((e) => e.id === editTarget.id ? data : e));
      toast.success(`${data.name} updated successfully!`);
    } else {
      const { data, error } = await supabase.from('equipment').insert({ ...payload, available_quantity: qty }).select('*, laboratories(lab_name, lab_code)').single();
      setSaving(false);
      if (error) { toast.error('Failed to add: ' + error.message); return; }
      setEquipment((prev) => [...prev, data]);
      toast.success(`${data.name} added successfully!`);
    }

    setForm(EMPTY_EQ); setShowModal(false); setEditTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('equipment').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) { toast.error('Failed to delete: ' + error.message); return; }
    setEquipment((prev) => prev.filter((e) => e.id !== deleteTarget.id));
    toast.success(`${deleteTarget.name} deleted.`);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-5">
      <div className="bg-card rounded-xl shadow-card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Equipment name or brand…" className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div className="min-w-[200px]">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Laboratory</label>
            <select value={selectedLab} onChange={(e) => setSelectedLab(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground">
              <option value={0}>All Laboratories</option>
              {labs.map((l) => <option key={l.id} value={l.id}>{l.lab_code} - {l.lab_name}</option>)}
            </select>
          </div>
          <button onClick={openAdd} className="gradient-primary text-primary-foreground px-4 py-2 rounded-xl font-semibold text-sm border-none cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all inline-flex items-center gap-2 whitespace-nowrap">
            <Plus className="w-4 h-4" /> Add Equipment
          </button>
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-heading text-sm font-bold">Equipment Inventory <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs ml-2">{filtered.length}</span></h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b-2 border-border">
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Equipment</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Brand</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Model</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Laboratory</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ?
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Loading…</td></tr> :
                filtered.length ? filtered.map((e) =>
                  <tr key={e.id} className="border-b border-muted hover:bg-muted/30">
                    <td className="px-4 py-3 font-semibold">{e.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.brand || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{e.model || '—'}</td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{e.laboratories?.lab_code || '—'}</code>
                      <div className="text-xs text-muted-foreground mt-0.5">{e.laboratories?.lab_name}</div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold">{e.quantity}</td>
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
                          className="text-xs px-2 py-1 border border-border rounded-lg bg-card text-foreground"
                        >
                          <option value="available">Available</option>
                          <option value="maintenance">Under Maintenance</option>
                          <option value="in_use">In Use</option>
                        </select>
                        <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors border-none cursor-pointer" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteTarget(e)} className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors border-none cursor-pointer" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) :
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No equipment found</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
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
                  <label className="block text-xs font-semibold text-foreground mb-1">Laboratory</label>
                  <select name="laboratory_id" value={form.laboratory_id} onChange={handleChange} className={inputCls}>
                    <option value="">None / Unassigned</option>
                    {labs.map((l) => <option key={l.id} value={l.id}>{l.lab_code} – {l.lab_name}</option>)}
                  </select>
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
                  <option value="maintenance">Under Maintenance</option>
                  <option value="in_use">In Use</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditTarget(null); }} className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-semibold cursor-pointer bg-transparent text-foreground">Cancel</button>
                <button type="submit" disabled={saving} className="gradient-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold border-none cursor-pointer hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? (editTarget ? 'Saving…' : 'Adding…') : (editTarget ? 'Save Changes' : 'Add Equipment')}
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
            <h3 className="font-heading text-base font-bold mb-2">Delete Equipment</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to delete <strong className="text-foreground">{deleteTarget.name}</strong>? This action cannot be undone.
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
    </div>
  );
};

export default AdminEquipment;