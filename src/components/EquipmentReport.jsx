import { useEffect, useMemo, useState } from 'react';
import { History, Download, Printer, Search, Boxes, CheckCircle2, Activity, CalendarClock, AlertOctagon, Wrench, Hammer, Package, Repeat } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { currentMonthManila, monthLabel, monthRangeISO, shortDateManila } from '@/lib/monthRange';
import { fetchAllPages } from '@/lib/fetchAllPages';
import { USED_STATUSES } from '@/lib/reportUsage';
import { matchesStakeholderGroup, stakeholderGroupLabel } from '@/lib/stakeholder';
import { useEquipmentInventoryStatus } from '@/hooks/useEquipmentAvailability';
import { EquipmentStockAlert } from '@/components/StatusBadge';
import { UsageHistoryDialog, historySheetRows } from '@/components/LaboratoryReport';
import { downloadExcelReport, excelFileName, generatedOnText, printReport, reportInfo } from '@/lib/exportReservations';
import { availableNowOf, damagedCountOf, maintenanceCountOf, underRepairCountOf, equipmentStatusLabel, OUT_OF_SERVICE_STATUSES } from '@/lib/equipmentAvailability';


/**
 * Equipment report: which equipment was actually USED in a month.
 * Counts both standalone equipment requests (equipment_reservations) and
 * equipment attached to laboratory reservations (reservation_equipment).
 * Only used reservations (in use / completed) are counted, and only equipment
 * that was used in that month is listed.
 *
 * Props:
 *  - roomIds: optional array of laboratory ids to limit the report to (staff).
 *  - month: "YYYY-MM" - only reservations scheduled in this month are counted
 *    (defaults to the current month). The CSV export uses the same month.
 *  - stakeholder: 'all' | 'cvsu' | 'non_cvsu' - only count reservations of that stakeholder group.
 */
const EquipmentReport = ({ roomIds = [], month = currentMonthManila(), stakeholder = 'all' }) => {
  const [equipment, setEquipment] = useState([]);
  const [allUsage, setAllUsage] = useState([]); // [{ equipment_id, status, qty, stakeholder_type }] (used reservations only)
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const roomKey = roomIds.join(',');
  const { items: inventoryItems, summary: inventory, stock, loaded: inventoryLoaded } = useEquipmentInventoryStatus(roomIds);
  const inServiceItems = inventoryItems.filter((e) => !OUT_OF_SERVICE_STATUSES.includes(e.status));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // month "" = all dates (no date limit)
      const range = month ? monthRangeISO(month) : null;
      const [eqRes, standaloneRes, attachedRes] = await Promise.all([
        supabase.from('equipment').select('id, name, brand, model, laboratory_id, laboratories(lab_name, lab_code)').order('name'),
        fetchAllPages(() => {
          let q = supabase
            .from('equipment_reservations')
            .select('id, equipment_id, status, quantity_reserved, stakeholder_type, start_datetime, end_datetime, researcher_name')
            .in('status', USED_STATUSES);
          if (range) q = q.gte('start_datetime', range.startISO).lt('start_datetime', range.endISO);
          return q.order('id');
        }),
        fetchAllPages(() => {
          let q = supabase
            .from('reservation_equipment')
            .select('id, equipment_id, quantity_reserved, reservations!inner(id, status, start_datetime, end_datetime, stakeholder_type, researcher_name)')
            .in('reservations.status', USED_STATUSES);
          if (range) q = q.gte('reservations.start_datetime', range.startISO).lt('reservations.start_datetime', range.endISO);
          return q.order('id');
        }),
      ]);
      if (cancelled) return;

      const scoped = (eqRes.data || []).filter((e) => !roomIds.length || roomIds.includes(e.laboratory_id));
      const ids = new Set(scoped.map((e) => e.id));

      const rows = [
        ...(standaloneRes.data || []).map((r) => ({ key: `eq-${r.id}`, equipment_id: r.equipment_id, status: r.status, qty: r.quantity_reserved || 0, stakeholder_type: r.stakeholder_type, start: r.start_datetime, end: r.end_datetime, who: r.researcher_name, via: `Equipment request #EQ${String(r.id).padStart(5, '0')}` })),
        ...(attachedRes.data || []).map((r) => ({ key: `lab-${r.id}`, equipment_id: r.equipment_id, status: r.reservations?.status, qty: r.quantity_reserved || 0, stakeholder_type: r.reservations?.stakeholder_type, start: r.reservations?.start_datetime, end: r.reservations?.end_datetime, who: r.reservations?.researcher_name, via: `With lab reservation #RC${String(r.reservations?.id || '').padStart(5, '0')}` })),
      ].filter((r) => ids.has(r.equipment_id) && USED_STATUSES.includes(r.status));

      setEquipment(scoped);
      setAllUsage(rows);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomKey, month]);

  // Apply the stakeholder filter (CvSU / Non-CvSU) before counting
  const usage = useMemo(() => allUsage.filter((u) => matchesStakeholderGroup(u.stakeholder_type, stakeholder)), [allUsage, stakeholder]);
  const [historyItem, setHistoryItem] = useState(null);
  const historyOf = (equipmentId) => usage.filter((u) => u.equipment_id === equipmentId);

  // Only equipment that was used this month
  const rows = useMemo(() => {
    const map = new Map(equipment.map((e) => [e.id, { ...e, total: 0, completed: 0, inUse: 0, units: 0, lastUsed: null }]));
    usage.forEach((u) => {
      const row = map.get(u.equipment_id);
      if (!row) return;
      row.total += 1;
      row.units += u.qty;
      if (u.start && (!row.lastUsed || u.start > row.lastUsed)) row.lastUsed = u.start;
      if (u.status === 'completed') row.completed += 1;
      else if (u.status === 'in_use') row.inUse += 1;
    });
    return [...map.values()]
      .filter((r) => r.total > 0)
      // All dates: most recently used first. One month/week: most used first.
      .sort((a, b) => (month
        ? b.total - a.total || a.name.localeCompare(b.name)
        : String(b.lastUsed || '').localeCompare(String(a.lastUsed || '')) || a.name.localeCompare(b.name)));
  }, [equipment, usage, month]);

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.name.toLowerCase().includes(q) || (r.brand || '').toLowerCase().includes(q) || (r.laboratories?.lab_code || '').toLowerCase().includes(q);
  });

  const totals = useMemo(() => ({
    equipmentUsed: rows.length,
    uses: usage.length,
    completed: usage.filter((u) => u.status === 'completed').length,
    inUse: usage.filter((u) => u.status === 'in_use').length,
  }), [rows, usage]);



  const inventoryCards = [
    { label: 'Total Equipment', value: inventory.total, icon: Boxes, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Available Equipment', value: inventory.available, icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
    { label: 'Borrowed / In Use', value: inventory.inUse, icon: Activity, color: 'text-warning', bg: 'bg-warning/10' },
    { label: 'Reserved Equipment', value: inventory.reserved, icon: CalendarClock, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Under Repair', value: inventory.underRepair, icon: Hammer, color: 'text-warning', bg: 'bg-warning/10' },
    { label: 'Lost or Damaged', value: inventory.damaged, icon: AlertOctagon, color: 'text-destructive', bg: 'bg-destructive/10' },
    { label: 'For Maintenance', value: inventory.maintenance, icon: Wrench, color: 'text-muted-foreground', bg: 'bg-muted' },
  ].map((c) => ({ ...c, ready: inventoryLoaded }));

  // Usage in the selected month
  // ("In use" is already shown live in "Equipment In Use", and completed uses
  // are part of "Total Uses", so they are not separate cards.)
  const usageCards = [
    { label: 'Equipment Used', value: totals.equipmentUsed, icon: Package, color: 'text-primary', bg: 'bg-primary/10', sub: monthLabel(month) },
    { label: 'Total Uses', value: totals.uses, icon: Repeat, color: 'text-primary', bg: 'bg-primary/10', sub: `${totals.completed} completed · ${monthLabel(month)}` },
  ].map((c) => ({ ...c, ready: !loading }));

  const summaryCards = [...inventoryCards, ...usageCards];

  // ---- Excel / Print: title, dates, every status count, then the full tables
  const [exporting, setExporting] = useState(false);
  const buildSheets = () => {
    const info = reportInfo({ month, stakeholder });
    const statusSummary = [
      { label: 'Total Equipment (units)', value: inventory.total, bold: true },
      { label: 'Available', value: inventory.available },
      { label: 'Borrowed / In Use (now)', value: inventory.inUse },
      { label: 'Reserved (upcoming)', value: inventory.reserved },
      { label: 'Under Repair', value: inventory.underRepair },
      { label: 'Lost or Damaged', value: inventory.damaged },
      { label: 'For Maintenance', value: inventory.maintenance },
    ];
    const usageSheet = {
      name: 'Equipment Usage',
      title: 'Equipment Usage Report',
      info,
      summaryTitle: 'Status Summary',
      summary: [
        ...statusSummary,
        { label: `Equipment Used (${monthLabel(month)})`, value: totals.equipmentUsed },
        { label: 'Total Uses', value: totals.uses },
        { label: 'Completed Uses', value: totals.completed },
        { label: 'In-Use Reservations', value: totals.inUse },
      ],
      columns: [
        { header: 'Equipment', key: 'name' },
        { header: 'Brand', key: 'brand' },
        { header: 'Model', key: 'model' },
        { header: 'Laboratory', key: 'lab' },
        { header: 'Times Used', key: 'total' },
        { header: 'Units Used', key: 'units' },
        { header: 'Completed', key: 'completed' },
        { header: 'In Use', key: 'inUse' },
        { header: 'Last Used', key: 'lastUsed' },
      ],
      rows: filtered.map((r) => ({
        name: r.name,
        brand: r.brand || '',
        model: r.model || '',
        lab: [r.laboratories?.lab_code, r.laboratories?.lab_name].filter(Boolean).join(' – '),
        total: r.total,
        units: r.units,
        completed: r.completed,
        inUse: r.inUse,
        lastUsed: shortDateManila(r.lastUsed),
      })),
      emptyText: `No equipment was used${month ? ` in ${monthLabel(month)}` : ' yet'}.`,
    };
    const inventorySheet = {
      name: 'Current Inventory',
      title: 'Current Equipment Inventory',
      info: [['Counts As Of', `${generatedOnText()} (PH Time)`], ...(roomIds.length ? [['Rooms', 'Your assigned rooms only']] : [])],
      summaryTitle: 'Status Summary',
      summary: statusSummary,
      columns: [
        { header: 'Equipment', key: 'name' },
        { header: 'Brand', key: 'brand' },
        { header: 'Model', key: 'model' },
        { header: 'Laboratory', key: 'lab' },
        { header: 'Status', key: 'status' },
        { header: 'Total Qty', key: 'quantity' },
        { header: 'Available Now', key: 'available' },
        { header: 'Borrowed / In Use Now', key: 'inUse' },
        { header: 'Reserved (Upcoming)', key: 'reserved' },
        { header: 'Under Repair', key: 'underRepair' },
        { header: 'Lost or Damaged', key: 'damaged' },
        { header: 'For Maintenance', key: 'maintenance' },
      ],
      rows: inventoryItems.map((e) => ({
        name: e.name,
        brand: e.brand || '',
        model: e.model || '',
        lab: [e.laboratories?.lab_code, e.laboratories?.lab_name].filter(Boolean).join(' – '),
        status: equipmentStatusLabel(e.status),
        quantity: Number(e.quantity) || 0,
        available: availableNowOf(e, stock) ?? (Number(e.quantity) || 0),
        inUse: stock[e.id]?.inUseNow || 0,
        reserved: stock[e.id]?.reservedUpcoming || 0,
        underRepair: underRepairCountOf(e),
        damaged: damagedCountOf(e),
        maintenance: maintenanceCountOf(e),
      })),
      emptyText: 'No equipment found.',
    };
    const eqName = new Map(equipment.map((e) => [e.id, e.name]));
    const historySheet = {
      name: 'Usage History',
      title: 'Equipment Usage History',
      info,
      columns: [
        { header: 'Equipment', key: 'item' },
        { header: 'Date & Time', key: 'when' },
        { header: 'Used By', key: 'who' },
        { header: 'Stakeholder', key: 'stakeholder' },
        { header: 'Qty', key: 'qty' },
        { header: 'Status', key: 'status' },
        { header: 'Request', key: 'via' },
      ],
      rows: historySheetRows(
        filtered.flatMap((r) => historyOf(r.id)).sort((a, b) => String(b.start).localeCompare(String(a.start))),
        (e) => eqName.get(e.equipment_id) || '',
      ),
      emptyText: 'No uses in this period.',
    };
    return [usageSheet, historySheet, inventorySheet];
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      await downloadExcelReport({ fileName: excelFileName('equipment-report', month, stakeholder), sheets: buildSheets() });
    } catch (err) {
      console.error('Export failed:', err);
      alert('Could not export the report. Please try again.');
    } finally {
      setExporting(false);
    }
  };
  const printEquipmentReport = () => printReport({ title: 'Equipment Report', sheets: buildSheets() });

  const th = 'px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider';

  return (
    <div className="space-y-5">
      {/* Summary: live inventory counts + usage in the selected month */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {summaryCards.map((c) => (
            <div key={c.label} className="bg-card rounded-xl p-4 shadow-card flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${c.bg}`}>
                <c.icon className={`w-5 h-5 ${c.color}`} />
              </div>
              <div className="min-w-0">
                <div className={`font-heading text-2xl font-bold leading-tight ${c.color}`}>{c.ready ? c.value : '…'}</div>
                <div className="text-[11px] text-muted-foreground leading-tight">{c.label}</div>
                {c.sub && <div className="text-[10px] text-muted-foreground/80 leading-tight">{c.sub}</div>}
              </div>
            </div>
          ))}
        </div>
        <EquipmentStockAlert items={inServiceItems} stock={stock} />
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-sm font-bold">Equipment Used <span className="text-muted-foreground font-semibold">· {monthLabel(month)}</span></h2>
          <div className="flex flex-wrap items-center gap-2 ml-auto justify-end">
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
              onClick={exportExcel}
              disabled={loading || !inventoryLoaded || exporting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted text-sm font-semibold text-foreground cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" /> {exporting ? 'Exporting…' : 'Export Excel'}
            </button>
            <button
              type="button"
              onClick={printEquipmentReport}
              disabled={loading || !inventoryLoaded || exporting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted text-sm font-semibold text-foreground cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10 text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            {search ? 'No matching equipment' : `No equipment was used${month ? ` in ${monthLabel(month)}` : ' yet'}${stakeholder === 'all' ? '' : ` by ${stakeholderGroupLabel(stakeholder)} stakeholders`}`}
          </div>
        ) : (
          <>
            {/* Phone: stacked cards */}
            <div className="sm:hidden divide-y divide-muted">
              {filtered.map((r) => (
                <div key={r.id} className="px-4 py-3 space-y-1.5">
                  <div className="font-semibold text-sm">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[r.brand, r.laboratories?.lab_code].filter(Boolean).join(' · ') || '—'}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className="text-muted-foreground">Used: <span className="font-semibold text-foreground">{r.total}</span></span>
                    <span className="text-muted-foreground">Units: <span className="font-semibold text-foreground">{r.units}</span></span>
                    <span className="text-success font-semibold">Completed: {r.completed}</span>
                    <span className="text-warning font-semibold">In use: {r.inUse}</span>
                    <span className="text-muted-foreground">Last used: <span className="font-semibold text-foreground">{shortDateManila(r.lastUsed)}</span></span>
                  </div>
                  <button type="button" onClick={() => setHistoryItem(r)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-card text-xs font-semibold cursor-pointer">
                    <History className="w-3.5 h-3.5" /> Usage history
                  </button>
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
                    <th className={th}>Times Used</th>
                    <th className={th}>Units Used</th>
                    <th className={th}>Completed</th>
                    <th className={th}>In Use</th>
                    <th className={th}>Last Used</th>
                    <th className={th}>History</th>
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
                      <td className="px-4 py-3 font-semibold">{r.total}</td>
                      <td className="px-4 py-3">{r.units}</td>
                      <td className="px-4 py-3 text-success font-semibold">{r.completed}</td>
                      <td className="px-4 py-3 text-warning font-semibold">{r.inUse}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{shortDateManila(r.lastUsed)}</td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => setHistoryItem(r)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold cursor-pointer">
                          <History className="w-3.5 h-3.5" /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      {historyItem && (
        <UsageHistoryDialog
          title={historyItem.name}
          subtitle={`${[historyItem.brand, historyItem.model].filter(Boolean).join(' · ')}${historyItem.brand || historyItem.model ? ' · ' : ''}${monthLabel(month)}${stakeholder !== 'all' ? ` · ${stakeholderGroupLabel(stakeholder)}` : ''}`}
          entries={historyOf(historyItem.id)}
          qtyLabel="Qty"
          onClose={() => setHistoryItem(null)}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Lost, Damaged & Frequently Unavailable Equipment
//   1. equipment marked "Lost or Damaged"
//   2. equipment returned damaged or incomplete (from Release / Return)
//   3. equipment that often runs low or out of stock (low / out-of-stock alerts)
// ---------------------------------------------------------------------------
const CONDITION_TEXT = { damaged: 'Damaged', incomplete: 'Incomplete / missing parts' };
const labOf = (e) => [e?.laboratories?.lab_code, e?.laboratories?.lab_name].filter(Boolean).join(' - ');

export const EquipmentIssuesReport = ({ roomIds = [], month = '' }) => {
  const roomKey = roomIds.join(',');
  const [equipment, setEquipment] = useState([]);
  const [returns, setReturns] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [alertsMissing, setAlertsMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const range = month ? monthRangeISO(month) : null;
      let retQ = supabase.from('equipment_reservations')
        .select('id, equipment_id, researcher_name, quantity_reserved, returned_at, returned_by_name, return_condition, return_notes')
        .in('return_condition', ['damaged', 'incomplete']);
      if (range) retQ = retQ.gte('returned_at', range.startISO).lt('returned_at', range.endISO);
      let alertQ = supabase.from('equipment_stock_alerts').select('equipment_id, level, created_at');
      if (range) alertQ = alertQ.gte('created_at', range.startISO).lt('created_at', range.endISO);
      const [eqRes, retRes, alertRes] = await Promise.all([
        supabase.from('equipment').select('id, name, brand, model, quantity, status, laboratory_id, laboratories(lab_code, lab_name)').order('name'),
        retQ.order('returned_at', { ascending: false }),
        alertQ,
      ]);
      if (!active) return;
      const rooms = roomKey ? new Set(roomKey.split(',').map(Number)) : null;
      const scoped = (eqRes.data || []).filter((e) => !rooms || rooms.has(e.laboratory_id));
      const ids = new Set(scoped.map((e) => e.id));
      setEquipment(scoped);
      setReturns((retRes.data || []).filter((r) => ids.has(r.equipment_id)));
      setAlertsMissing(!!alertRes.error);
      setAlerts((alertRes.data || []).filter((a) => ids.has(a.equipment_id)));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [roomKey, month]);

  const byId = useMemo(() => new Map(equipment.map((e) => [e.id, e])), [equipment]);
  const lost = equipment.filter((e) => e.status === 'damaged');
  const frequent = useMemo(() => {
    const map = new Map();
    alerts.forEach((a) => {
      const row = map.get(a.equipment_id) || { out: 0, low: 0, last: null };
      row[a.level] += 1;
      if (!row.last || a.created_at > row.last) row.last = a.created_at;
      map.set(a.equipment_id, row);
    });
    return [...map.entries()]
      .map(([id, c]) => ({ ...byId.get(id), ...c, times: c.out + c.low }))
      .filter((r) => r.id)
      .sort((a, b) => b.out - a.out || b.times - a.times || String(a.name).localeCompare(String(b.name)));
  }, [alerts, byId]);

  const cards = [
    { label: 'Lost or Damaged (items)', value: lost.length, sub: `${lost.reduce((s, e) => s + (Number(e.quantity) || 0), 0)} units`, cls: 'text-destructive' },
    { label: 'Returned damaged', value: returns.filter((r) => r.return_condition === 'damaged').length, cls: 'text-destructive' },
    { label: 'Returned incomplete', value: returns.filter((r) => r.return_condition === 'incomplete').length, cls: 'text-warning' },
    { label: 'Times out of stock', value: alerts.filter((a) => a.level === 'out').length, sub: `${alerts.filter((a) => a.level === 'low').length} low-stock alerts`, cls: 'text-warning' },
  ];

  const buildSheets = () => {
    const info = reportInfo({ month, extra: roomIds.length ? [['Rooms', 'Your assigned rooms only']] : [] });
    return [
      {
        name: 'Lost or Damaged',
        title: 'Lost or Damaged Equipment',
        info: [['As Of', 'Current status'], ...(roomIds.length ? [['Rooms', 'Your assigned rooms only']] : [])],
        summaryTitle: 'Summary',
        summary: cards.map((c) => ({ label: c.label, value: c.value })),
        columns: [
          { header: 'Equipment', key: 'name' }, { header: 'Brand / Model', key: 'bm' },
          { header: 'Laboratory', key: 'lab' }, { header: 'Units', key: 'qty' },
        ],
        rows: lost.map((e) => ({ name: e.name, bm: [e.brand, e.model].filter(Boolean).join(' · '), lab: labOf(e), qty: e.quantity })),
        emptyText: 'No equipment is marked Lost or Damaged.',
      },
      {
        name: 'Returned Damaged',
        title: 'Equipment Returned Damaged or Incomplete',
        info,
        columns: [
          { header: 'Returned', key: 'when' }, { header: 'Equipment', key: 'name' }, { header: 'Laboratory', key: 'lab' },
          { header: 'Borrower', key: 'who' }, { header: 'Qty', key: 'qty' }, { header: 'Condition', key: 'cond' },
          { header: 'Notes', key: 'notes' }, { header: 'Received By', key: 'by' },
        ],
        rows: returns.map((r) => ({
          when: shortDateManila(r.returned_at), name: byId.get(r.equipment_id)?.name || '', lab: labOf(byId.get(r.equipment_id)),
          who: r.researcher_name || '', qty: r.quantity_reserved, cond: CONDITION_TEXT[r.return_condition] || r.return_condition,
          notes: r.return_notes || '', by: r.returned_by_name || '',
        })),
        emptyText: 'No equipment was returned damaged or incomplete in this period.',
      },
      {
        name: 'Frequently Unavailable',
        title: 'Frequently Unavailable Equipment',
        info,
        columns: [
          { header: 'Equipment', key: 'name' }, { header: 'Laboratory', key: 'lab' }, { header: 'Units', key: 'qty' },
          { header: 'Times Out of Stock', key: 'out' }, { header: 'Low-Stock Alerts', key: 'low' }, { header: 'Last Alert', key: 'last' },
          { header: 'Current Status', key: 'status' },
        ],
        rows: frequent.map((r) => ({
          name: r.name, lab: labOf(r), qty: r.quantity, out: r.out, low: r.low, last: shortDateManila(r.last), status: equipmentStatusLabel(r.status),
        })),
        emptyText: 'No low or out-of-stock alerts in this period.',
      },
    ];
  };
  const exportExcel = async () => {
    setExporting(true);
    try { await downloadExcelReport({ fileName: excelFileName('equipment-issues', month), sheets: buildSheets() }); }
    catch (err) { console.error('Export failed:', err); alert('Could not export the report. Please try again.'); }
    finally { setExporting(false); }
  };

  const th = 'px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider';
  const btn = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted text-sm font-semibold text-foreground cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  const Section = ({ title, subtitle, children }) => (
    <div className="border-t border-border">
      <div className="px-6 pt-4 pb-2">
        <h3 className="font-heading text-sm font-bold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
  const Empty = ({ text }) => <p className="px-6 pb-5 text-sm text-muted-foreground">{text}</p>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-card rounded-xl shadow-card p-4">
            <div className={`font-heading text-2xl font-bold ${c.cls}`}>{loading ? '…' : c.value}</div>
            <div className="text-[11px] text-muted-foreground">{c.label}</div>
            {c.sub && !loading && <div className="text-[10px] text-muted-foreground/80">{c.sub}</div>}
          </div>
        ))}
      </div>
      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-sm font-bold">Lost, Damaged &amp; Frequently Unavailable Equipment</h2>
            <p className="text-xs text-muted-foreground">Returns and stock alerts: {monthLabel(month)}</p>
          </div>
          <div className="flex gap-2 ml-auto justify-end">
            <button type="button" onClick={exportExcel} disabled={loading || exporting} className={btn}><Download className="w-4 h-4" /> {exporting ? 'Exporting…' : 'Export Excel'}</button>
            <button type="button" onClick={() => printReport({ title: 'Lost, Damaged & Frequently Unavailable Equipment', sheets: buildSheets() })} disabled={loading} className={btn}><Printer className="w-4 h-4" /> Print</button>
          </div>
        </div>
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm border-t border-border">Loading…</div>
        ) : (
          <>
            <Section title={`Lost or Damaged (${lost.length})`} subtitle="Equipment with the status Lost or Damaged">
              {lost.length === 0 ? <Empty text="No equipment is marked Lost or Damaged." /> : (
                <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead><tr className="bg-muted/50"><th className={th}>Equipment</th><th className={th}>Laboratory</th><th className={th}>Units</th></tr></thead>
                  <tbody>{lost.map((e) => (
                    <tr key={e.id} className="border-b border-muted">
                      <td className="px-4 py-2.5"><div className="font-semibold">{e.name}</div><div className="text-xs text-muted-foreground">{[e.brand, e.model].filter(Boolean).join(' · ')}</div></td>
                      <td className="px-4 py-2.5 text-xs">{labOf(e) || '—'}</td>
                      <td className="px-4 py-2.5 font-semibold text-destructive">{e.quantity}</td>
                    </tr>))}
                  </tbody></table></div>
              )}
            </Section>
            <Section title={`Returned Damaged or Incomplete (${returns.length})`} subtitle="Recorded when the equipment was received back">
              {returns.length === 0 ? <Empty text="No equipment was returned damaged or incomplete in this period." /> : (
                <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead><tr className="bg-muted/50"><th className={th}>Returned</th><th className={th}>Equipment</th><th className={th}>Borrower</th><th className={th}>Condition</th><th className={th}>Notes</th></tr></thead>
                  <tbody>{returns.map((r) => (
                    <tr key={r.id} className="border-b border-muted">
                      <td className="px-4 py-2.5 text-xs whitespace-nowrap">{shortDateManila(r.returned_at)}{r.returned_by_name && <div className="text-muted-foreground">to {r.returned_by_name}</div>}</td>
                      <td className="px-4 py-2.5"><div className="font-semibold text-xs">{byId.get(r.equipment_id)?.name}</div><div className="text-[11px] text-muted-foreground">Qty {r.quantity_reserved}</div></td>
                      <td className="px-4 py-2.5 text-xs">{r.researcher_name || '—'}</td>
                      <td className="px-4 py-2.5"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.return_condition === 'damaged' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}>{CONDITION_TEXT[r.return_condition]}</span></td>
                      <td className="px-4 py-2.5 text-xs italic text-muted-foreground">{r.return_notes || '—'}</td>
                    </tr>))}
                  </tbody></table></div>
              )}
            </Section>
            <Section title={`Frequently Unavailable (${frequent.length})`} subtitle="How many times each equipment ran out of stock or reached its minimum quantity">
              {alertsMissing ? <Empty text="Run the migration 20261117060000_equipment_stock_alerts.sql to start recording stock alerts." />
                : frequent.length === 0 ? <Empty text="No low or out-of-stock alerts in this period." /> : (
                <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead><tr className="bg-muted/50"><th className={th}>Equipment</th><th className={th}>Laboratory</th><th className={th}>Times Out of Stock</th><th className={th}>Low-Stock Alerts</th><th className={th}>Last Alert</th><th className={th}>Current Status</th></tr></thead>
                  <tbody>{frequent.map((r) => (
                    <tr key={r.id} className="border-b border-muted">
                      <td className="px-4 py-2.5"><div className="font-semibold">{r.name}</div><div className="text-[11px] text-muted-foreground">{r.quantity} units</div></td>
                      <td className="px-4 py-2.5 text-xs">{labOf(r) || '—'}</td>
                      <td className="px-4 py-2.5 font-semibold text-destructive">{r.out}</td>
                      <td className="px-4 py-2.5 font-semibold text-warning">{r.low}</td>
                      <td className="px-4 py-2.5 text-xs whitespace-nowrap">{shortDateManila(r.last)}</td>
                      <td className="px-4 py-2.5 text-xs">{equipmentStatusLabel(r.status)}</td>
                    </tr>))}
                  </tbody></table></div>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  );
};

export default EquipmentReport;