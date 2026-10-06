import { useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const ACTIVE = ['reserved', 'in_use'];
const CLOSED = ['cancelled', 'rejected'];

const statusLabel = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/**
 * Equipment report: inventory summary + how often each equipment was reserved.
 * Counts both standalone equipment requests (equipment_reservations) and
 * equipment attached to laboratory reservations (reservation_equipment).
 *
 * Props:
 *  - roomIds: optional array of laboratory ids to limit the report to (staff).
 */
const EquipmentReport = ({ roomIds = [] }) => {
  const [equipment, setEquipment] = useState([]);
  const [usage, setUsage] = useState([]); // [{ equipment_id, status, qty }]
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const roomKey = roomIds.join(',');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [eqRes, standaloneRes, attachedRes] = await Promise.all([
        supabase.from('equipment').select('id, name, brand, model, quantity, available_quantity, status, laboratory_id, laboratories(lab_name, lab_code)').order('name'),
        supabase.from('equipment_reservations').select('equipment_id, status, quantity_reserved'),
        supabase.from('reservation_equipment').select('equipment_id, quantity_reserved, reservations!inner(status)'),
      ]);
      if (cancelled) return;

      const scoped = (eqRes.data || []).filter((e) => !roomIds.length || roomIds.includes(e.laboratory_id));
      const ids = new Set(scoped.map((e) => e.id));

      const rows = [
        ...(standaloneRes.data || []).map((r) => ({ equipment_id: r.equipment_id, status: r.status, qty: r.quantity_reserved || 0 })),
        ...(attachedRes.data || []).map((r) => ({ equipment_id: r.equipment_id, status: r.reservations?.status, qty: r.quantity_reserved || 0 })),
      ].filter((r) => ids.has(r.equipment_id));

      setEquipment(scoped);
      setUsage(rows);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomKey]);

  const rows = useMemo(() => {
    const map = new Map(equipment.map((e) => [e.id, { ...e, total: 0, completed: 0, active: 0, pending: 0, closed: 0, units: 0 }]));
    usage.forEach((u) => {
      const row = map.get(u.equipment_id);
      if (!row) return;
      row.total += 1;
      row.units += u.qty;
      if (u.status === 'completed') row.completed += 1;
      else if (ACTIVE.includes(u.status)) row.active += 1;
      else if (u.status === 'pending') row.pending += 1;
      else if (CLOSED.includes(u.status)) row.closed += 1;
    });
    return [...map.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [equipment, usage]);

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.name.toLowerCase().includes(q) || (r.brand || '').toLowerCase().includes(q) || (r.laboratories?.lab_code || '').toLowerCase().includes(q);
  });

  const totals = useMemo(() => ({
    items: equipment.length,
    units: equipment.reduce((sum, e) => sum + (e.quantity || 0), 0),
    available: equipment.filter((e) => e.status === 'available').length,
    inUse: equipment.filter((e) => e.status === 'in_use').length,
    maintenance: equipment.filter((e) => e.status === 'maintenance').length,
    reservations: usage.length,
    completed: usage.filter((u) => u.status === 'completed').length,
    active: usage.filter((u) => ACTIVE.includes(u.status)).length,
    cancelled: usage.filter((u) => CLOSED.includes(u.status)).length,
  }), [equipment, usage]);

  const exportCsv = () => {
    const header = ['Equipment', 'Brand', 'Model', 'Laboratory', 'Qty', 'Available Qty', 'Status', 'Total Reservations', 'Completed', 'Active', 'Pending', 'Cancelled/Rejected'];
    const lines = filtered.map((r) => [
      r.name, r.brand, r.model, r.laboratories?.lab_code, r.quantity, r.available_quantity, statusLabel(r.status),
      r.total, r.completed, r.active, r.pending, r.closed,
    ].map(csvCell).join(','));
    const csv = '\uFEFF' + [header.map(csvCell).join(','), ...lines].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `equipment-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const cards = [
    { label: 'Total Units', value: totals.units, color: 'text-primary' },
    { label: 'Total Reservations', value: totals.reservations, color: 'text-primary' },
    { label: 'Completed', value: totals.completed, color: 'text-success' },
    { label: 'Under Maintenance', value: totals.maintenance, color: 'text-destructive' },
    { label: 'Cancelled / Rejected', value: totals.cancelled, color: 'text-destructive' },
  ];

  const th = 'px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
        {cards.map((s) => (
          <div key={s.label} className="bg-card rounded-xl p-5 shadow-card text-center">
            <div className={`font-heading text-3xl font-bold ${s.color}`}>{loading ? '…' : s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-sm font-bold">Reservations by Equipment</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search equipment…"
                className="pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary w-52"
              />
            </div>
            <button
              type="button"
              onClick={exportCsv}
              disabled={loading || filtered.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted text-sm font-semibold text-foreground cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10 text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">No equipment found</div>
        ) : (
          <>
            {/* Phone: stacked cards */}
            <div className="sm:hidden divide-y divide-muted">
              {filtered.map((r) => (
                <div key={r.id} className="px-4 py-3 space-y-1.5">
                  <div className="font-semibold text-sm">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[r.brand, r.laboratories?.lab_code].filter(Boolean).join(' · ') || '—'} · Qty {r.quantity}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className="text-muted-foreground">Total: <span className="font-semibold text-foreground">{r.total}</span></span>
                    <span className="text-success font-semibold">Completed: {r.completed}</span>
                    <span className="text-warning font-semibold">Active: {r.active}</span>
                    <span className="text-destructive font-semibold">Cancelled: {r.closed}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Tablet+: table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b-2 border-border">
                    <th className={th}>Equipment</th>
                    <th className={th}>Laboratory</th>
                    <th className={th}>Qty</th>
                    <th className={th}>Total</th>
                    <th className={th}>Completed</th>
                    <th className={th}>Active</th>
                    <th className={th}>Pending</th>
                    <th className={th}>Cancelled</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-muted hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{r.name}</div>
                        {(r.brand || r.model) && <div className="text-xs text-muted-foreground">{[r.brand, r.model].filter(Boolean).join(' · ')}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <code className="bg-muted px-1.5 py-0.5 rounded">{r.laboratories?.lab_code || '—'}</code>
                      </td>
                      <td className="px-4 py-3">{r.quantity}</td>
                      <td className="px-4 py-3 font-semibold">{r.total}</td>
                      <td className="px-4 py-3 text-success font-semibold">{r.completed}</td>
                      <td className="px-4 py-3 text-warning font-semibold">{r.active}</td>
                      <td className="px-4 py-3 text-muted-foreground font-semibold">{r.pending}</td>
                      <td className="px-4 py-3 text-destructive font-semibold">{r.closed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EquipmentReport;