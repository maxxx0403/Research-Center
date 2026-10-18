import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const RESERVATION_STATUSES = [
  { key: 'pending', label: 'Pending', color: '#f59e0b' },
  { key: 'reserved', label: 'Reserved', color: '#2563eb' },
  { key: 'in_use', label: 'In use', color: '#7c3aed' },
  { key: 'completed', label: 'Completed', color: '#16a34a' },
  { key: 'cancelled', label: 'Cancelled', color: '#94a3b8' },
  { key: 'rejected', label: 'Rejected', color: '#dc2626' },
];

// Colours for the per-laboratory / per-equipment pies (the last one is "Others").
const SLICE_COLORS = ['#2f855a', '#2563eb', '#f59e0b', '#7c3aed', '#0ea5e9', '#dc2626', '#14b8a6'];
const OTHERS_COLOR = '#94a3b8';
const TOP_N = 6;

// Count rows per name, keep the biggest TOP_N slices and fold the rest into "Others".
const topSlices = (names) => {
  const counts = new Map();
  names.forEach((n) => counts.set(n, (counts.get(n) || 0) + 1));
  const sorted = [...counts.entries()].sort((x, y) => y[1] - x[1]);
  const top = sorted.slice(0, TOP_N).map(([name, value], i) => ({ key: name, name, value, color: SLICE_COLORS[i % SLICE_COLORS.length] }));
  const rest = sorted.slice(TOP_N).reduce((sum, [, v]) => sum + v, 0);
  if (rest > 0) top.push({ key: '__others', name: `Others (${sorted.length - TOP_N})`, value: rest, color: OTHERS_COLOR });
  return top;
};

// Month boundaries in Philippine time (+08:00), as ISO strings.
const monthRange = (year, month) => {
  const pad = (n) => String(n).padStart(2, '0');
  const next = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 };
  return {
    from: `${year}-${pad(month + 1)}-01T00:00:00+08:00`,
    to: `${next.y}-${pad(next.m + 1)}-01T00:00:00+08:00`,
  };
};

const countBy = (rows, statuses) =>
  statuses
    .map((s) => ({ name: s.label, key: s.key, color: s.color, value: rows.filter((r) => r.status === s.key).length }))
    .filter((d) => d.value > 0);

const PieCard = ({ title, subtitle, data, loading }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <div className="bg-card rounded-xl shadow-card p-5">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <h3 className="font-heading text-sm font-bold">{title}</h3>
        <span className="text-xs text-muted-foreground">{loading ? '…' : `${total} total`}</span>
      </div>
      {subtitle && <p className="text-xs text-muted-foreground mb-2">{subtitle}</p>}

      {loading ? (
        <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
      ) : total === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">No data for this month</div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="w-full h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} paddingAngle={data.length > 1 ? 2 : 0} stroke="#fff" strokeWidth={2}>
                  {data.map((d) => <Cell key={d.key} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value} (${Math.round((value / total) * 100)}%)`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="w-full space-y-1.5 text-sm list-none p-0 m-0">
            {data.map((d) => (
              <li key={d.key} className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                  <span className="truncate" title={d.name}>{d.name}</span>
                </span>
                <span className="font-semibold flex-shrink-0">{d.value} <span className="text-xs font-normal text-muted-foreground">({Math.round((d.value / total) * 100)}%)</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/**
 * Pie charts for one month: reservations by status, laboratory report (reservations per laboratory)
 * and equipment report (reservations per equipment).
 * Props:
 *  - roomIds: optional laboratory ids to limit reservations to (staff). Empty = everything.
 */
const MonthlyPieCharts = ({ roomIds = [] }) => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [loading, setLoading] = useState(true);
  const [labRows, setLabRows] = useState([]);
  const [eqRows, setEqRows] = useState([]);

  const roomKey = roomIds.join(',');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { from, to } = monthRange(year, month);
      const [labRes, eqRes] = await Promise.all([
        supabase.from('reservations').select('status, laboratory_id, laboratories(lab_name, lab_code)').gte('start_datetime', from).lt('start_datetime', to),
        supabase.from('equipment_reservations').select('status, equipment_id, equipment(name, laboratory_id)').gte('start_datetime', from).lt('start_datetime', to),
      ]);
      if (cancelled) return;

      const ids = new Set(roomIds.map((id) => String(id)));
      const scoped = ids.size > 0;
      setLabRows((labRes.data || []).filter((r) => !scoped || ids.has(String(r.laboratory_id))));
      setEqRows((eqRes.data || []).filter((r) => !scoped || ids.has(String(r.equipment?.laboratory_id))));
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, roomKey]);

  // 1. all reservations (laboratory + equipment) by status
  const reservationData = useMemo(() => countBy([...labRows, ...eqRows], RESERVATION_STATUSES), [labRows, eqRows]);
  // 2. laboratory report: reservations per laboratory
  const labReportData = useMemo(() => topSlices(labRows.map((r) => r.laboratories?.lab_name || r.laboratories?.lab_code || 'Unknown lab')), [labRows]);
  // 3. equipment report: reservations per equipment
  const eqReportData = useMemo(() => topSlices(eqRows.map((r) => r.equipment?.name || 'Unknown equipment')), [eqRows]);

  const shift = (delta) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const isCurrent = year === now.getFullYear() && month === now.getMonth();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-sm font-bold">Monthly Overview</h2>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="p-2 rounded-lg bg-card border border-border text-foreground cursor-pointer hover:bg-muted transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <span className="min-w-[140px] text-center font-heading text-sm font-bold">{MONTHS[month]} {year}</span>
          <button type="button" onClick={() => shift(1)} aria-label="Next month" className="p-2 rounded-lg bg-card border border-border text-foreground cursor-pointer hover:bg-muted transition-colors"><ChevronRight className="w-4 h-4" /></button>
          {!isCurrent && (
            <button type="button" onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }} className="px-3 py-2 rounded-lg bg-muted text-foreground border border-border text-xs font-semibold cursor-pointer hover:bg-border transition-colors">This month</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <PieCard title="Reservations" subtitle="Laboratory and equipment reservations by status" data={reservationData} loading={loading} />
        <PieCard title="Laboratory Report" subtitle="Reservations per laboratory (top 6)" data={labReportData} loading={loading} />
        <PieCard title="Equipment Report" subtitle="Reservations per equipment (top 6)" data={eqReportData} loading={loading} />
      </div>
    </div>
  );
};

export default MonthlyPieCharts;