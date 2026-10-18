import { useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { currentMonthManila, monthLabel, monthRangeISO } from '@/lib/monthRange';
import { USED_STATUSES } from '@/lib/reportUsage';

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/**
 * Laboratory report: which laboratories were actually USED in a month.
 * Only reservations that were used (in use / completed) are counted, and only
 * laboratories that were used in that month are listed.
 *
 * Props:
 *  - roomIds: optional array of laboratory ids to limit the report to (staff).
 *  - month: "YYYY-MM" - only reservations scheduled in this month are counted
 *    (defaults to the current month). The CSV export uses the same month.
 */
const LaboratoryReport = ({ roomIds = [], month = currentMonthManila() }) => {
  const [labs, setLabs] = useState([]);
  const [usage, setUsage] = useState([]); // [{ laboratory_id, status }] (used reservations only)
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const roomKey = roomIds.join(',');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { startISO, endISO } = monthRangeISO(month);
      const [labRes, resRes] = await Promise.all([
        supabase.from('laboratories').select('id, lab_name, lab_code, floor').order('lab_code'),
        supabase
          .from('reservations')
          .select('laboratory_id, status')
          .in('status', USED_STATUSES)
          .gte('start_datetime', startISO)
          .lt('start_datetime', endISO),
      ]);
      if (cancelled) return;

      const scoped = (labRes.data || []).filter((l) => !roomIds.length || roomIds.includes(l.id));
      const ids = new Set(scoped.map((l) => l.id));

      setLabs(scoped);
      setUsage((resRes.data || []).filter((r) => ids.has(r.laboratory_id)));
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomKey, month]);

  // Only laboratories that were used this month
  const rows = useMemo(() => {
    const map = new Map(labs.map((l) => [l.id, { ...l, total: 0, completed: 0, inUse: 0 }]));
    usage.forEach((u) => {
      const row = map.get(u.laboratory_id);
      if (!row) return;
      row.total += 1;
      if (u.status === 'completed') row.completed += 1;
      else if (u.status === 'in_use') row.inUse += 1;
    });
    return [...map.values()]
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total || a.lab_name.localeCompare(b.lab_name));
  }, [labs, usage]);

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

  const exportCsv = () => {
    const header = ['Month', 'Laboratory', 'Lab Code', 'Floor', 'Times Used', 'Completed', 'In Use'];
    const lines = filtered.map((r) => [
      monthLabel(month), r.lab_name, r.lab_code, r.floor, r.total, r.completed, r.inUse,
    ].map(csvCell).join(','));
    const csv = '\uFEFF' + [header.map(csvCell).join(','), ...lines].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `laboratory-report-${month}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

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
          <div className="flex flex-wrap items-center gap-2">
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
          <div className="text-center py-10 text-muted-foreground">
            {search ? 'No matching laboratory' : `No laboratory was used in ${monthLabel(month)}`}
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
                  </div>
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

export default LaboratoryReport;