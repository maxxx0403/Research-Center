import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, X, Pencil, RefreshCw, CalendarCheck } from 'lucide-react';
import RowActions from '@/components/RowActions';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { NonOfficialBulk, saveNonOfficialHours } from '@/components/NonOfficialToggle';
import { logCatalogAction, summarizeChanges } from '@/lib/activityLog';
import CatalogPagination from '@/components/CatalogPagination';
import { catalogDuplicateErrorMessage, findDuplicateEquipment } from '@/lib/catalogValidation';
import { addEquipmentOrMerge, updateEquipmentOrMerge, availableNowOf, stockLevelOf, inUseNowOf, damagedCountOf, maintenanceCountOf, underRepairCountOf, EQUIPMENT_STATUSES, equipmentStatusLabel } from '@/lib/equipmentAvailability';
import { useCurrentEquipmentStock } from '@/hooks/useEquipmentAvailability';
import { EquipmentStockAlert, EquipmentStockBadge } from '@/components/StatusBadge';
import { EQUIPMENT_CATEGORIES, categoryOf } from '@/lib/equipmentCategories';

const EQ_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'brand', label: 'Brand' },
  { key: 'model', label: 'Model' },
  { key: 'laboratory_id', label: 'Laboratory ID' },
  { key: 'quantity', label: 'Quantity' },
];
const EMPTY_EQ = { name: '', category: '', brand: '', model: '', laboratory_id: '', quantity: '1', min_quantity: '' };
const EQUIPMENT_PER_PAGE = 20;
const inputCls = "w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary";

const StaffEquipment = () => {
  const { user, assignedRoomIds } = useAuth();
  const [equipment, setEquipment] = useState([]);
  const [floorLabs, setFloorLabs] = useState([]); // rooms this staff member is assigned to only
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_EQ);
  const [saving, setSaving] = useState(false);
  const { stock } = useCurrentEquipmentStock(equipment.map((e) => e.id));

  const loadData = useCallback(async () => {
    const [{ data: eqData }, { data: labData }] = await Promise.all([
    supabase.from('equipment').select('*, laboratories(lab_name, lab_code, floor)').order('name'),
    supabase.from('laboratories').select('id, lab_name, lab_code, floor').order('lab_code')]
    );
    const assignedIdsSet = new Set((assignedRoomIds || []).map((id) => String(id)));
    const scopedEq = assignedIdsSet.size > 0
      ? (eqData || []).filter((e) => e.laboratory_id != null && assignedIdsSet.has(String(e.laboratory_id)))
      : eqData || [];
    const scopedLabs = assignedIdsSet.size > 0
      ? (labData || []).filter((l) => l.id != null && assignedIdsSet.has(String(l.id)))
      : labData || [];
    setEquipment(scopedEq);
    setFloorLabs(scopedLabs);
    setLoading(false);
  }, [assignedRoomIds]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = equipment.filter((e) =>
  !search ||
  e.name.toLowerCase().includes(search.toLowerCase()) ||
  (e.brand || '').toLowerCase().includes(search.toLowerCase())
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / EQUIPMENT_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const paginatedEquipment = filtered.slice(
    (currentPage - 1) * EQUIPMENT_PER_PAGE,
    currentPage * EQUIPMENT_PER_PAGE
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
      category: eq.category || '',
      brand: eq.brand || '',
      model: eq.model || '',
      laboratory_id: eq.laboratory_id ? String(eq.laboratory_id) : '',
      quantity: String(eq.quantity),
      min_quantity: eq.min_quantity == null ? '' : String(eq.min_quantity)
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
      category: form.category.trim() || null,
      brand: form.brand.trim() || null,
      model: form.model.trim() || null,
      laboratory_id: Number(form.laboratory_id),
      quantity: qty,
      // Warning level for low stock (empty = default: warn at 1 left)
      min_quantity: form.min_quantity === '' ? null : Math.max(0, Number(form.min_quantity) || 0)
    };

    const floor = floorLabs.find((l) => l.id === payload.laboratory_id)?.floor || null;

    if (editTarget) {
      const { data, error, merged, mergedInto } = await updateEquipmentOrMerge(editTarget, payload);
      setSaving(false);
      if (error) { toast.error(catalogDuplicateErrorMessage(error, 'update')); return; }
      if (merged) {
        logCatalogAction({
          userId: user?.id,
          type: 'equipment',
          verb: 'Updated',
          item: { ...data, floor },
          laboratoryIds: [editTarget.laboratory_id, data.laboratory_id],
          detail: `Merged duplicate entry; Quantity: ${mergedInto.quantity} → ${data.quantity}`,
        });
        toast.success(`${data.name} already exists in this laboratory — merged. Quantity is now ${data.quantity}.`);
      } else {
        logCatalogAction({
          userId: user?.id,
          type: 'equipment',
          verb: 'Updated',
          item: { ...payload, floor },
          laboratoryIds: [editTarget.laboratory_id, payload.laboratory_id],
          detail: summarizeChanges(editTarget, payload, EQ_FIELDS),
        });
        toast.success(`${payload.name} updated.`);
      }
    } else {
      const { data, error, merged, addedQuantity } = await addEquipmentOrMerge(payload);
      setSaving(false);
      if (error) { toast.error(catalogDuplicateErrorMessage(error, 'add')); return; }
      if (merged) {
        logCatalogAction({
          userId: user?.id,
          type: 'equipment',
          verb: 'Updated',
          item: { ...data, floor },
          laboratoryIds: [data.laboratory_id],
          detail: `Added ${addedQuantity} unit${addedQuantity === 1 ? '' : 's'}; Quantity: ${data.quantity - addedQuantity} → ${data.quantity}`,
        });
        toast.success(`${data.name} already exists in this laboratory — added ${addedQuantity} to its quantity (now ${data.quantity}).`);
      } else {
        logCatalogAction({ userId: user?.id, type: 'equipment', verb: 'Added', item: payload, laboratoryIds: [payload.laboratory_id] });
        toast.success(`${payload.name} added.`);
      }
    }

    setShowModal(false);
    setEditTarget(null);
    setPage(1);
    loadData();
  };

  // Live check while the form is open: same name, brand, model and laboratory
  // as an existing item means the quantity will be added to that item.
  const duplicateMatch = showModal && form.name.trim()
    ? findDuplicateEquipment(equipment, { ...form, laboratory_id: form.laboratory_id || null }, editTarget?.id)
    : null;
  const enteredQty = Math.max(1, Number(form.quantity) || 1);

  // Friday - Sunday bookings ON/OFF
  const toggleNonOfficial = async (item, value) => {
    const error = await saveNonOfficialHours('equipment', [item.id], value);
    if (error) { toast.error('Failed to update: ' + error.message); return; }
    setEquipment((prev) => prev.map((e) => (e.id === item.id ? { ...e, allow_non_official_hours: value } : e)));
    logCatalogAction({ userId: user?.id, type: 'equipment', verb: 'Updated', item, laboratoryIds: [item.laboratory_id], detail: `Friday–Sunday bookings: ${value ? 'ON' : 'OFF'}` });
    toast.success(`${item.name}: Friday–Sunday bookings ${value ? 'ON' : 'OFF'}.`);
  };

  const setAllNonOfficial = async (value) => {
    const ids = filtered.map((e) => e.id);
    if (!ids.length) return;
    const error = await saveNonOfficialHours('equipment', ids, value);
    if (error) { toast.error('Failed to update: ' + error.message); return; }
    const changed = equipment.filter((e) => ids.includes(e.id) && !!e.allow_non_official_hours !== value);
    setEquipment((prev) => prev.map((e) => (ids.includes(e.id) ? { ...e, allow_non_official_hours: value } : e)));
    changed.forEach((e) => logCatalogAction({ userId: user?.id, type: 'equipment', verb: 'Updated', item: e, laboratoryIds: [e.laboratory_id], detail: `Friday–Sunday bookings: ${value ? 'ON' : 'OFF'}` }));
    toast.success(`Friday–Sunday bookings turned ${value ? 'ON' : 'OFF'} for ${ids.length} equipment item${ids.length === 1 ? '' : 's'}.`);
  };

  return (
    <div className="space-y-5">
      <div className="bg-card rounded-xl shadow-card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Equipment name or brand…" className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary" />
            </div>
          </div>
          <NonOfficialBulk count={filtered.length} disabled={filtered.length === 0} onAll={setAllNonOfficial} />
          <button onClick={openAdd} className="gradient-primary text-primary-foreground px-4 py-2 rounded-xl font-semibold text-sm border-none cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all inline-flex items-center gap-2 whitespace-nowrap">
            <Plus className="w-4 h-4" /> Add Equipment
          </button>
        </div>
      </div>

      <EquipmentStockAlert items={filtered} stock={stock} />

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-heading text-sm font-bold">Equipment Inventory <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs ml-2">{filtered.length}</span></h2>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b-2 border-border">
              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Laboratory</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Qty Available</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">In Use</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Under Repair</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Lost / Damaged</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">For Maintenance</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-10 text-muted-foreground text-xs">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-10 text-muted-foreground text-xs">No equipment found for your assigned rooms.</td></tr>
            ) : paginatedEquipment.map((e) =>
            <tr key={e.id} className="border-b border-muted hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="font-semibold">{e.name}</div>
                  <div className="text-[11px] text-muted-foreground">{categoryOf(e)}</div>
                  {e.brand && <div className="text-xs text-muted-foreground">{e.brand}{e.model ? ` · ${e.model}` : ''}</div>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{e.laboratories?.lab_code || '—'}</td>
                <td className="px-4 py-3">
                  <div className="font-semibold whitespace-nowrap">{availableNowOf(e, stock) ?? e.quantity} / {e.quantity}</div>
                  {stockLevelOf(e, stock) !== 'ok' && <div className="mt-1"><EquipmentStockBadge item={e} stock={stock} /></div>}
                </td>
                <td className="px-4 py-3">{inUseNowOf(e, stock) > 0 ? <span className="font-semibold text-warning">{inUseNowOf(e, stock)}</span> : <span className="text-muted-foreground">0</span>}</td>
                <td className="px-4 py-3">{underRepairCountOf(e) > 0 ? <span className="font-semibold text-warning">{underRepairCountOf(e)}</span> : <span className="text-muted-foreground">0</span>}</td>
                <td className="px-4 py-3">{damagedCountOf(e) > 0 ? <span className="font-semibold text-destructive">{damagedCountOf(e)}</span> : <span className="text-muted-foreground">0</span>}</td>
                <td className="px-4 py-3">{maintenanceCountOf(e) > 0 ? <span className="font-semibold text-foreground">{maintenanceCountOf(e)}</span> : <span className="text-muted-foreground">0</span>}</td>
                <td className="px-4 py-3">
                  <RowActions
                    items={[
                      { label: 'Edit', icon: Pencil, onClick: () => openEdit(e) },
                      {
                        label: 'Fri–Sun bookings',
                        icon: CalendarCheck,
                        value: e.allow_non_official_hours ? 'on' : 'off',
                        options: [{ value: 'on', label: 'ON' }, { value: 'off', label: 'OFF' }],
                        onChange: (v) => toggleNonOfficial(e, v === 'on'),
                      },
                      {
                        label: 'Change status',
                        icon: RefreshCw,
                        value: e.status,
                        options: EQUIPMENT_STATUSES,
                        onChange: async (newStatus) => {
                          const { error } = await supabase.from('equipment').update({ status: newStatus }).eq('id', e.id);
                          if (error) { toast.error('Failed to update status'); return; }
                          setEquipment((prev) => prev.map((eq) => eq.id === e.id ? { ...eq, status: newStatus } : eq));
                          logCatalogAction({ userId: user?.id, type: 'equipment', verb: 'Updated', item: e, laboratoryIds: [e.laboratory_id], detail: `Status: ${equipmentStatusLabel(e.status)} → ${equipmentStatusLabel(newStatus)}` });
                          toast.success(`Status updated to ${equipmentStatusLabel(newStatus)}`);
                        },
                      },
                    ]}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
        <CatalogPagination
          page={currentPage}
          pageCount={pageCount}
          itemCount={filtered.length}
          pageSize={EQUIPMENT_PER_PAGE}
          itemLabel="equipment items"
          onPageChange={setPage}
        />
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
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Category</label>
                <select name="category" value={form.category} onChange={handleChange} className={inputCls}>
                  <option value="">Automatic (based on the equipment name)</option>
                  {[...new Set([...(form.category && !EQUIPMENT_CATEGORIES.includes(form.category) ? [form.category] : []), ...EQUIPMENT_CATEGORIES])].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">Researchers use the category to find this equipment faster when reserving.</p>
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
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Minimum Quantity <span className="font-normal text-muted-foreground">(low-stock warning)</span></label>
                  <input name="min_quantity" type="number" min="0" value={form.min_quantity} onChange={handleChange} placeholder="Default: 1" className={inputCls} />
                  <p className="text-[0.7rem] text-muted-foreground mt-1">Admins and staff are notified when the units available drop to this number.</p>
                </div>
              </div>
              {duplicateMatch && (
                <div className="bg-primary/10 border border-primary/25 rounded-lg p-3 text-xs text-foreground">
                  <strong>{duplicateMatch.name}</strong> with the same brand and model already exists in this laboratory (Qty {duplicateMatch.quantity}).
                  {editTarget
                    ? <> Saving will merge this entry into it — the quantity will become <strong>{(Number(duplicateMatch.quantity) || 0) + enteredQty}</strong>.</>
                    : <> Saving will add {enteredQty} to it — the quantity will become <strong>{(Number(duplicateMatch.quantity) || 0) + enteredQty}</strong>.</>}
                </div>
              )}
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditTarget(null); }} className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-semibold cursor-pointer bg-transparent text-foreground">Cancel</button>
                <button type="submit" disabled={saving} className="gradient-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold border-none cursor-pointer hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? (editTarget ? 'Saving…' : 'Adding…') : duplicateMatch ? (editTarget ? 'Merge & Save' : 'Add to Quantity') : (editTarget ? 'Save Changes' : 'Add Equipment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>);

};

export default StaffEquipment;