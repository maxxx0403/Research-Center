import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Search, Printer, History, X } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { currentMonthManila, monthLabel, monthRangeISO, shortDateManila } from '@/lib/monthRange';
import { fetchAllPages } from '@/lib/fetchAllPages';
import { downloadExcelReport, excelFileName, printReport, reportInfo } from '@/lib/exportReservations';
import { USED_STATUSES } from '@/lib/reportUsage';
import { matchesStakeholderGroup, stakeholderGroupLabel } from '@/lib/stakeholder';


/**
 * Laboratory report: which laboratories were actually USED in a month.
 * Only reservations that were used (in use / completed) are counted, and only
 * laboratories that were used in that month are listed.
 *
 * Props:
 *  - roomIds: optional array of laboratory ids to limit the report to (staff).
 *  - month: "YYYY-MM" - only reservations scheduled in this month are counted
 *    (defaults to the current month). The CSV export uses the same month.
 *  - stakeholder: 'all' | 'cvsu' | 'non_cvsu' - only count reservations of that stakeholder group.
 */
// ---------------------------------------------------------------------------
// Usage history pop-up (who used it and when), shared by the Laboratory and
// Equipment reports. entries: [{ key, start, end, who, people, qty, status, stakeholder_type, via }]
// ---------------------------------------------------------------------------
const STAKEHOLDER_TEXT = { student: 'CvSU Student', faculty_staff: 'CvSU Instructor', non_cvsu: 'Non-CvSU' };
export const stakeholderText = (type) => STAKEHOLDER_TEXT[type] || '—';

const historyWhen = (start, end) => {
  const day = new Date(start).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' });
  const t = (iso) => new Date(iso).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
  return end ? `${day}, ${t(start)} – ${t(end)}` : `${day}, ${t(start)}`;
};

export const historySheetRows = (entries, nameOf) => entries.map((e) => ({
  item: nameOf(e),
  when: historyWhen(e.start, e.end),
  who: e.who || '—',
  stakeholder: stakeholderText(e.stakeholder_type),
  qty: e.qty ?? e.people ?? '',
  status: e.status === 'in_use' ? 'In Use' : e.status === 'completed' ? 'Completed' : e.status,
  via: e.via || '',
}));

export const UsageHistoryDialog = ({ title, subtitle, entries, qtyLabel = 'People', onClose }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const sorted = [...entries].sort((a, b) => String(b.start).localeCompare(String(a.start)));
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-black/60" onClick={onClose} role="dialog" aria-modal="true" aria-label="Usage history">
      <div className="bg-card text-foreground rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Usage history</p>
            <h2 className="font-heading text-base font-bold text-primary leading-snug">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="bg-transparent border-none text-muted-foreground hover:text-foreground cursor-pointer p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto">
          {sorted.length === 0 ? (
            <p className="text-center py-10 text-sm text-muted-foreground">No uses in this period.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  {['Date & Time', 'Used By', 'Stakeholder', qtyLabel, 'Status'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((e) => (
                  <tr key={e.key} className="border-b border-muted">
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap">{historyWhen(e.start, e.end)}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-xs">{e.who || '—'}</div>
                      {e.via && <div className="text-[11px] text-muted-foreground">{e.via}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-xs">{stakeholderText(e.stakeholder_type)}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold">{e.qty ?? e.people ?? '—'}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={e.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-6 py-3 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
          <span>{sorted.length} use{sorted.length === 1 ? '' : 's'}</span>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold bg-muted text-foreground border border-border cursor-pointer hover:bg-border">Close</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

const LaboratoryReport = ({ roomIds = [], month = currentMonthManila(), stakeholder = 'all' }) => {
  const [labs, setLabs] = useState([]);
  const [allUsage, setAllUsage] = useState([]); // [{ laboratory_id, status, stakeholder_type }] (used reservations only)
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const roomKey = roomIds.join(',');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // month "" = all dates (no date limit)
      const range = month ? monthRangeISO(month) : null;
      const [labRes, resRes] = await Promise.all([
        supabase.from('laboratories').select('id, lab_name, lab_code, floor').order('lab_code'),
        fetchAllPages(() => {
          let q = supabase
            .from('reservations')
            .select('id, laboratory_id, status, stakeholder_type, start_datetime, end_datetime, researcher_name, members_list')
            .in('status', USED_STATUSES);
          if (range) q = q.gte('start_datetime', range.startISO).lt('start_datetime', range.endISO);
          return q.order('id');
        }),
      ]);
      if (cancelled) return;

      const scoped = (labRes.data || []).filter((l) => !roomIds.length || roomIds.includes(l.id));
      const ids = new Set(scoped.map((l) => l.id));

      setLabs(scoped);
      setAllUsage((resRes.data || []).filter((r) => ids.has(r.laboratory_id)));
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomKey, month]);

  // Apply the stakeholder filter (CvSU / Non-CvSU) before counting
  const usage = useMemo(() => allUsage.filter((u) => matchesStakeholderGroup(u.stakeholder_type, stakeholder)), [allUsage, stakeholder]);
  const [historyLab, setHistoryLab] = useState(null);
  const historyOf = (labId) => usage.filter((u) => u.laboratory_id === labId).map((u) => ({
    key: u.id,
    start: u.start_datetime,
    end: u.end_datetime,
    who: u.researcher_name,
    people: (Array.isArray(u.members_list) ? u.members_list.length : 0) + 1,
    status: u.status,
    stakeholder_type: u.stakeholder_type,
    labId: u.laboratory_id,
  }));

  // Only laboratories that were used this month
  const rows = useMemo(() => {
    const map = new Map(labs.map((l) => [l.id, { ...l, total: 0, completed: 0, inUse: 0, lastUsed: null }]));
    usage.forEach((u) => {
      const row = map.get(u.laboratory_id);
      if (!row) return;
      row.total += 1;
      if (u.start_datetime && (!row.lastUsed || u.start_datetime > row.lastUsed)) row.lastUsed = u.start_datetime;
      if (u.status === 'completed') row.completed += 1;
      else if (u.status === 'in_use') row.inUse += 1;
    });
    return [...map.values()]
      .filter((r) => r.total > 0)
      // All dates: most recently used first. One month/week: most used first.
      .sort((a, b) => (month
        ? b.total - a.total || a.lab_name.localeCompare(b.lab_name)
        : String(b.lastUsed || '').localeCompare(String(a.lastUsed || '')) || a.lab_name.localeCompare(b.lab_name)));
  }, [labs, usage, month]);

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.lab_name.toLowerCase().includes(q) || (r.lab_code || '').toLowerCase().includes(q) || (r.floor || '').toLowerCase().includes(q);
  });

  const totals = useMemo(() => ({
    labsUsed: rows.length,
    uses: usage.length,
    completed: usage.filter((u) => u.status === 'completed').length,
    inUse: usage.filter((u) => u.status === 'in_use').length,
  }), [rows, usage]);

  // ---- Excel / Print: title, dates, status counts, then the full table
  const [exporting, setExporting] = useState(false);
  // Every use (who and when) of the laboratories in the table
  const buildHistorySheet = () => {
    const labName = new Map(labs.map((l) => [l.id, [l.lab_code, l.lab_name].filter(Boolean).join(' - ')]));
    const entries = filtered.flatMap((r) => historyOf(r.id)).sort((a, b) => String(b.start).localeCompare(String(a.start)));
    return {
      name: 'Usage History',
      title: 'Laboratory Usage History',
      info: reportInfo({ month, stakeholder }),
      columns: [
        { header: 'Laboratory', key: 'item' },
        { header: 'Date & Time', key: 'when' },
        { header: 'Used By', key: 'who' },
        { header: 'Stakeholder', key: 'stakeholder' },
        { header: 'People', key: 'qty' },
        { header: 'Status', key: 'status' },
      ],
      rows: historySheetRows(entries, (e) => labName.get(e.labId) || ''),
      emptyText: 'No uses in this period.',
    };
  };

  const buildSheet = () => ({
    name: 'Laboratory Usage',
    title: 'Laboratory Usage Report',
    info: reportInfo({ month, stakeholder }),
    summaryTitle: 'Status Summary',
    summary: [
      { label: 'Laboratories Used', value: totals.labsUsed },
      { label: 'Completed', value: totals.completed },
      { label: 'In Use', value: totals.inUse },
      { label: 'Total Uses', value: totals.uses, bold: true },
    ],
    columns: [
      { header: 'Laboratory', key: 'lab_name' },
      { header: 'Lab Code', key: 'lab_code' },
      { header: 'Floor', key: 'floor' },
      { header: 'Times Used', key: 'total' },
      { header: 'Completed', key: 'completed' },
      { header: 'In Use', key: 'inUse' },
      { header: 'Last Used', key: 'lastUsed' },
    ],
    rows: filtered.map((r) => ({
      lab_name: r.lab_name,
      lab_code: r.lab_code || '',
      floor: r.floor || '',
      total: r.total,
      completed: r.completed,
      inUse: r.inUse,
      lastUsed: shortDateManila(r.lastUsed),
    })),
    emptyText: `No laboratory was used${month ? ` in ${monthLabel(month)}` : ' yet'}.`,
  });

  const exportExcel = async () => {
    setExporting(true);
    try {
      await downloadExcelReport({ fileName: excelFileName('laboratory-report', month, stakeholder), sheets: [buildSheet(), buildHistorySheet()] });
    } catch (err) {
      console.error('Export failed:', err);
      alert('Could not export the report. Please try again.');
    } finally {
      setExporting(false);
    }
  };
  const printLabReport = () => printReport({ title: 'Laboratory Report', sheets: [buildSheet(), buildHistorySheet()] });

  const cards = [
    { label: 'Laboratories Used', value: totals.labsUsed, color: 'text-primary' },
    { label: 'Total Uses', value: totals.uses, color: 'text-primary' },
    { label: 'Completed', value: totals.completed, color: 'text-success' },
    { label: 'In Use', value: totals.inUse, color: 'text-warning' },
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
          <h2 className="font-heading text-sm font-bold">Laboratories Used <span className="text-muted-foreground font-semibold">· {monthLabel(month)}</span></h2>
          <div className="flex flex-wrap items-center gap-2 ml-auto justify-end">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search laboratory…"
                className="pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary w-52"
              />
            </div>
            <button
              type="button"
              onClick={exportExcel}
              disabled={loading || exporting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted text-sm font-semibold text-foreground cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" /> {exporting ? 'Exporting…' : 'Export Excel'}
            </button>
            <button
              type="button"
              onClick={printLabReport}
              disabled={loading || exporting}
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
            {search ? 'No matching laboratory' : `No laboratory was used${month ? ` in ${monthLabel(month)}` : ' yet'}${stakeholder === 'all' ? '' : ` by ${stakeholderGroupLabel(stakeholder)} stakeholders`}`}
          </div>
        ) : (
          <>
            {/* Phone: stacked cards */}
            <div className="sm:hidden divide-y divide-muted">
              {filtered.map((r) => (
                <div key={r.id} className="px-4 py-3 space-y-1.5">
                  <div className="font-semibold text-sm">{r.lab_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[r.lab_code, r.floor].filter(Boolean).join(' · ') || '—'}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className="text-muted-foreground">Used: <span className="font-semibold text-foreground">{r.total}</span></span>
                    <span className="text-success font-semibold">Completed: {r.completed}</span>
                    <span className="text-warning font-semibold">In use: {r.inUse}</span>
                    <span className="text-muted-foreground">Last used: <span className="font-semibold text-foreground">{shortDateManila(r.lastUsed)}</span></span>
                  </div>
                  <button type="button" onClick={() => setHistoryLab(r)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-card text-xs font-semibold cursor-pointer">
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
                    <th className={th}>Laboratory</th>
                    <th className={th}>Code</th>
                    <th className={th}>Times Used</th>
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
                        <div className="font-semibold">{r.lab_name}</div>
                        {r.floor && <div className="text-xs text-muted-foreground">{r.floor}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <code className="bg-muted px-1.5 py-0.5 rounded">{r.lab_code || '—'}</code>
                      </td>
                      <td className="px-4 py-3 font-semibold">{r.total}</td>
                      <td className="px-4 py-3 text-success font-semibold">{r.completed}</td>
                      <td className="px-4 py-3 text-warning font-semibold">{r.inUse}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{shortDateManila(r.lastUsed)}</td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => setHistoryLab(r)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold cursor-pointer">
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
      {historyLab && (
        <UsageHistoryDialog
          title={[historyLab.lab_code, historyLab.lab_name].filter(Boolean).join(' - ')}
          subtitle={`${monthLabel(month)}${stakeholder !== 'all' ? ` · ${stakeholderGroupLabel(stakeholder)}` : ''}`}
          entries={historyOf(historyLab.id)}
          qtyLabel="People"
          onClose={() => setHistoryLab(null)}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Available Laboratory Facilities: every laboratory with its status, capacity,
// how many people are in it right now and the next booking today (live).
// ---------------------------------------------------------------------------
const FACILITY_STATES = {
  free: { label: 'Available', cls: 'bg-success/10 text-success' },
  shared: { label: 'In use · seats left', cls: 'bg-warning/10 text-warning' },
  full: { label: 'Full / In use', cls: 'bg-destructive/10 text-destructive' },
  blocked: { label: 'Under Maintenance', cls: 'bg-muted text-muted-foreground' },
};
const timeOnly = (iso) => new Date(iso).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
const headcount = (r) => (Array.isArray(r.members_list) ? r.members_list.length : 0) + 1;

export const FacilitiesReport = ({ roomIds = [] }) => {
  const roomKey = roomIds.join(',');
  const [labs, setLabs] = useState([]);
  const [nowBookings, setNowBookings] = useState([]);
  const [laterBookings, setLaterBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const nowISO = new Date().toISOString();
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const endOfToday = new Date(`${today}T23:59:59+08:00`).toISOString();
      const [labRes, nowRes, laterRes] = await Promise.all([
        supabase.from('laboratories').select('id, lab_name, lab_code, floor, status, max_capacity, allow_non_official_hours').order('lab_code'),
        supabase.from('reservations').select('id, laboratory_id, members_list, start_datetime, end_datetime, researcher_name')
          .in('status', ['reserved', 'in_use']).lte('start_datetime', nowISO).gt('end_datetime', nowISO),
        supabase.from('reservations').select('id, laboratory_id, members_list, start_datetime, end_datetime')
          .eq('status', 'reserved').gt('start_datetime', nowISO).lt('start_datetime', endOfToday).order('start_datetime'),
      ]);
      if (!active) return;
      const rooms = roomKey ? new Set(roomKey.split(',').map(Number)) : null;
      setLabs((labRes.data || []).filter((l) => !rooms || rooms.has(l.id)));
      setNowBookings(nowRes.data || []);
      setLaterBookings(laterRes.data || []);
      setLoading(false);
    };
    load();
    const channel = supabase
      .channel(`facilities-report-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'laboratories' }, load)
      .subscribe();
    const timer = window.setInterval(load, 60000);
    return () => { active = false; window.clearInterval(timer); supabase.removeChannel(channel); };
  }, [roomKey]);

  const rows = useMemo(() => labs.map((lab) => {
    const current = nowBookings.filter((b) => b.laboratory_id === lab.id);
    const next = laterBookings.find((b) => b.laboratory_id === lab.id);
    const people = current.reduce((sum, b) => sum + headcount(b), 0);
    const capacity = Number(lab.max_capacity) || null;
    const seatsLeft = capacity ? Math.max(0, capacity - people) : null;
    let kind = 'free';
    if (lab.status === 'maintenance') kind = 'blocked';
    else if (current.length && (capacity ? seatsLeft <= 0 : true)) kind = 'full';
    else if (current.length) kind = 'shared';
    return { ...lab, groups: current.length, people, capacity, seatsLeft, kind, next, freeAt: current.length ? current.map((b) => b.end_datetime).sort().pop() : null };
  }).sort((a, b) => ['free', 'shared', 'full', 'blocked'].indexOf(a.kind) - ['free', 'shared', 'full', 'blocked'].indexOf(b.kind)
    || String(a.lab_code || a.lab_name).localeCompare(String(b.lab_code || b.lab_name), undefined, { numeric: true })), [labs, nowBookings, laterBookings]);

  const count = (kind) => rows.filter((r) => r.kind === kind).length;
  const seatsFree = rows.filter((r) => r.kind !== 'blocked' && r.capacity).reduce((sum, r) => sum + r.seatsLeft, 0);
  const cards = [
    { label: 'Laboratories', value: rows.length, cls: 'text-primary' },
    { label: 'Available now', value: count('free'), cls: 'text-success' },
    { label: 'In use (seats left)', value: count('shared'), cls: 'text-warning' },
    { label: 'Full / in use', value: count('full'), cls: 'text-destructive' },
    { label: 'Under maintenance', value: count('blocked'), cls: 'text-muted-foreground' },
    { label: 'Free seats now', value: seatsFree, cls: 'text-primary' },
  ];

  const stateText = (r) => (r.kind === 'shared' ? `In use · ${r.seatsLeft} seat${r.seatsLeft === 1 ? '' : 's'} left` : FACILITY_STATES[r.kind].label);
  const buildSheet = () => ({
    name: 'Laboratory Facilities',
    title: 'Available Laboratory Facilities',
    info: [['As Of', `${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'long', timeStyle: 'short' })} (PH Time)`], ...(roomIds.length ? [['Rooms', 'Your assigned rooms only']] : [])],
    summaryTitle: 'Summary',
    summary: cards.map((c, i) => ({ label: c.label, value: c.value, bold: i === 0 })),
    columns: [
      { header: 'Laboratory', key: 'lab' },
      { header: 'Floor', key: 'floor' },
      { header: 'Availability Now', key: 'state' },
      { header: 'Capacity', key: 'capacity' },
      { header: 'People Now', key: 'people' },
      { header: 'Seats Left', key: 'seats' },
      { header: 'Free At', key: 'freeAt' },
      { header: 'Next Booking Today', key: 'next' },
      { header: 'Fri–Sun', key: 'weekend' },
    ],
    rows: rows.map((r) => ({
      lab: [r.lab_code, r.lab_name].filter(Boolean).join(' - '),
      floor: r.floor || '',
      state: stateText(r),
      capacity: r.capacity ?? 'Not set',
      people: r.people,
      seats: r.capacity ? r.seatsLeft : '',
      freeAt: r.freeAt ? timeOnly(r.freeAt) : '',
      next: r.next ? `${timeOnly(r.next.start_datetime)} – ${timeOnly(r.next.end_datetime)}` : 'None',
      weekend: r.allow_non_official_hours ? 'Accepts' : 'Mon–Thu only',
    })),
    emptyText: 'No laboratories.',
  });
  const exportExcel = async () => {
    setExporting(true);
    try { await downloadExcelReport({ fileName: excelFileName('laboratory-facilities', ''), sheets: [buildSheet()] }); }
    catch (err) { console.error('Export failed:', err); alert('Could not export the report. Please try again.'); }
    finally { setExporting(false); }
  };

  const th = 'px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider';
  const btn = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted text-sm font-semibold text-foreground cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-card rounded-xl shadow-card p-4">
            <div className={`font-heading text-2xl font-bold ${c.cls}`}>{loading ? '…' : c.value}</div>
            <div className="text-[11px] text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>
      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-sm font-bold">Available Laboratory Facilities</h2>
            <p className="text-xs text-muted-foreground">Live · right now and the rest of today</p>
          </div>
          <div className="flex gap-2 ml-auto justify-end">
            <button type="button" onClick={exportExcel} disabled={loading || exporting} className={btn}><Download className="w-4 h-4" /> {exporting ? 'Exporting…' : 'Export Excel'}</button>
            <button type="button" onClick={() => printReport({ title: 'Available Laboratory Facilities', sheets: [buildSheet()] })} disabled={loading} className={btn}><Printer className="w-4 h-4" /> Print</button>
          </div>
        </div>
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No laboratories.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b-2 border-border">
                  <th className={th}>Laboratory</th>
                  <th className={th}>Availability Now</th>
                  <th className={th}>Capacity</th>
                  <th className={th}>People Now</th>
                  <th className={th}>Next Booking Today</th>
                  <th className={th}>Fri–Sun</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-muted hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{[r.lab_code, r.lab_name].filter(Boolean).join(' - ')}</div>
                      {r.floor && <div className="text-xs text-muted-foreground">{r.floor}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${FACILITY_STATES[r.kind].cls}`}>{stateText(r)}</span>
                      {r.freeAt && <div className="text-[11px] text-muted-foreground mt-1">Free at {timeOnly(r.freeAt)}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs">{r.capacity ?? <span className="text-muted-foreground">Not set (1 group)</span>}</td>
                    <td className="px-4 py-3 text-xs">{r.groups ? `${r.people} (${r.groups} group${r.groups === 1 ? '' : 's'})` : '0'}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">{r.next ? `${timeOnly(r.next.start_datetime)} – ${timeOnly(r.next.end_datetime)}` : <span className="text-muted-foreground">None</span>}</td>
                    <td className="px-4 py-3 text-xs">{r.allow_non_official_hours ? 'Accepts' : 'Mon–Thu only'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LaboratoryReport;