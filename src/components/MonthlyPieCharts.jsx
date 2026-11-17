import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts';
import { useEquipmentInventoryStatus } from '@/hooks/useEquipmentAvailability';
import { supabase } from '@/integrations/supabase/client';
import { accountTypeOf } from '@/lib/stakeholder';

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
const topSlices = (names, fullNames = {}) => {
  const counts = new Map();
  names.forEach((n) => counts.set(n, (counts.get(n) || 0) + 1));
  const sorted = [...counts.entries()].sort((x, y) => y[1] - x[1]);
  const top = sorted.slice(0, TOP_N).map(([name, value], i) => ({ key: name, name, fullName: fullNames[name] || name, value, color: SLICE_COLORS[i % SLICE_COLORS.length] }));
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

// Splits a name into at most 2 short lines so it fits inside a slice.
const wrapName = (name, max = 14) => {
  const words = String(name || '').split(/\s+/).filter(Boolean);
  const lines = [''];
  words.forEach((w) => {
    const cur = lines[lines.length - 1];
    if (!cur) lines[lines.length - 1] = w;
    else if ((cur + ' ' + w).length <= max) lines[lines.length - 1] = `${cur} ${w}`;
    else lines.push(w);
  });
  if (lines.length > 2) lines.splice(1, lines.length - 1, `${lines.slice(1).join(' ')}`);
  return lines.map((l) => (l.length > max + 2 ? `${l.slice(0, max)}…` : l));
};

const RADIAN = Math.PI / 180;

// Name and number written INSIDE each slice (no legend outside the pie).
const makeSliceLabel = (total) => ({ cx, cy, midAngle, innerRadius, outerRadius, percent, payload }) => {
  const share = percent * 100;
  const r = innerRadius + (outerRadius - innerRadius) * (share < 12 ? 0.68 : 0.58);
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  const numberText = `${payload.value} (${Math.round(share)}%)`;
  const textProps = {
    x, textAnchor: 'middle', fill: '#fff',
    style: { paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.25)', strokeWidth: 2, pointerEvents: 'none' },
  };
  // Very thin slices: only the number fits; the name is in the tooltip.
  if (share < 6) {
    return <text {...textProps} y={y} dominantBaseline="central" fontSize={10} fontWeight={700}>{payload.value}</text>;
  }
  const lines = wrapName(payload.label || payload.name, share < 12 ? 10 : 14);
  const lineHeight = 13;
  const startY = y - ((lines.length) * lineHeight) / 2 + lineHeight / 2 - 2;
  return (
    <text {...textProps} y={startY} fontSize={11} fontWeight={700}>
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : lineHeight}>{line}</tspan>
      ))}
      <tspan x={x} dy={lineHeight + 1} fontSize={11} fontWeight={600}>{numberText}</tspan>
    </text>
  );
};

export const PieCard = ({ title, subtitle, data, loading, emptyText = 'No data for this month' }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <div className="bg-card rounded-xl shadow-card p-5">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <h3 className="font-heading text-sm font-bold">{title}</h3>
        <span className="text-xs text-muted-foreground">{loading ? '…' : `${total} total`}</span>
      </div>
      {subtitle && <p className="text-xs text-muted-foreground mb-2">{subtitle}</p>}

      {loading ? (
        <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
      ) : total === 0 ? (
        <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">{emptyText}</div>
      ) : (
        <div className="w-full h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius="98%"
                paddingAngle={data.length > 1 ? 1 : 0}
                stroke="#fff"
                strokeWidth={2}
                labelLine={false}
                label={makeSliceLabel(total)}
                isAnimationActive={false}
              >
                {data.map((d) => <Cell key={d.key} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={(value, name, item) => [`${value} (${Math.round((value / total) * 100)}%)`, item?.payload?.fullName || name]} />
            </PieChart>
          </ResponsiveContainer>
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
  // Lab code inside the slice (short enough to fit); full "CODE - Name" in the tooltip.
  const labReportData = useMemo(() => {
    const fullNames = {};
    const names = labRows.map((r) => {
      const short = r.laboratories?.lab_code || r.laboratories?.lab_name || 'Unknown lab';
      fullNames[short] = [r.laboratories?.lab_code, r.laboratories?.lab_name].filter(Boolean).join(' - ') || short;
      return short;
    });
    return topSlices(names, fullNames);
  }, [labRows]);
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

// ---------------------------------------------------------------------------
// Bar graph: equipment status right now, counted in units (live).
// Bars are named on the axis and carry their number, so color is not the only cue.
// ---------------------------------------------------------------------------
const EQUIPMENT_STATUS_BARS = [
  { key: 'available', label: 'Available', color: '#16a34a' },
  { key: 'inUse', label: 'Borrowed / In Use', color: '#d97706' },
  { key: 'reserved', label: 'Reserved', color: '#2563eb' },
  { key: 'underRepair', label: 'Under Repair', color: '#0891b2' },
  { key: 'damaged', label: 'Lost or Damaged', color: '#dc2626' },
  { key: 'maintenance', label: 'For Maintenance', color: '#64748b' },
];

const BarTick = ({ x, y, payload }) => {
  const words = String(payload.value).split(' ');
  const lines = words.length > 2 ? [words.slice(0, 2).join(' '), words.slice(2).join(' ')] : [String(payload.value)];
  return (
    <text x={x} y={y + 12} textAnchor="middle" fontSize={11} fill="hsl(var(--muted-foreground))">
      {lines.map((line, i) => <tspan key={i} x={x} dy={i === 0 ? 0 : 13}>{line}</tspan>)}
    </text>
  );
};

export const EquipmentStatusBarChart = ({ roomIds = [] }) => {
  const { summary, loaded } = useEquipmentInventoryStatus(roomIds);
  const data = EQUIPMENT_STATUS_BARS.map((b) => ({ ...b, value: summary[b.key] || 0 }));
  return (
    <div className="bg-card rounded-xl shadow-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h3 className="font-heading text-sm font-bold">Equipment Status</h3>
        <span className="text-xs text-muted-foreground">{loaded ? `${summary.total} units total` : '…'}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">Live count of equipment units by status · Reserved = approved reservations that have not finished yet</p>
      {!loaded ? (
        <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="w-full h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 22, right: 8, left: -12, bottom: 18 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="label" interval={0} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} tick={<BarTick />} height={38} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
                formatter={(value) => [`${value} unit${value === 1 ? '' : 's'}`, 'Count']}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={56}>
                {data.map((d) => <Cell key={d.key} fill={d.color} />)}
                <LabelList dataKey="value" position="top" fontSize={12} fontWeight={700} fill="hsl(var(--foreground))" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

/**
 * Registered user accounts (admin and staff not counted): CvSU vs Non-CvSU and account types.
 * Live: refreshes when someone registers. Same data as Reports → User Accounts.
 */
export const UserAccountPieCharts = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = () => supabase.rpc('get_user_account_report').then(({ data, error: rpcError }) => {
      if (!active) return;
      if (rpcError) {
        console.error('User account charts failed:', rpcError);
        setError('Could not load the user accounts.');
      } else {
        setError('');
        setUsers(data || []);
      }
      setLoading(false);
    });
    load();
    const timer = setInterval(load, 60000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  const counts = useMemo(() => {
    const c = { student: 0, faculty_staff: 0, non_cvsu: 0 };
    users.forEach((u) => { c[accountTypeOf(u)] += 1; });
    return c;
  }, [users]);

  const cvsuData = [
    { key: 'cvsu', name: 'CvSU', value: counts.student + counts.faculty_staff, color: '#16a34a' },
    { key: 'non', name: 'Non-CvSU', value: counts.non_cvsu, color: '#2563eb' },
  ].filter((d) => d.value > 0);
  const typeData = [
    { key: 'student', name: 'Students', value: counts.student, color: '#16a34a' },
    { key: 'faculty', name: 'Instructors', value: counts.faculty_staff, color: '#d97706' },
    { key: 'non', name: 'Non-CvSU', value: counts.non_cvsu, color: '#2563eb' },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-heading text-base font-bold">Registered User Accounts</h2>
        <p className="text-xs text-muted-foreground">All registered accounts, admin and staff not counted. The full list is in Reports → User Accounts.</p>
      </div>
      {error ? (
        <div className="bg-card rounded-xl shadow-card p-5 text-sm text-destructive">{error}</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PieCard title="CvSU vs Non-CvSU" subtitle="Registered accounts" data={cvsuData} loading={loading} emptyText="No registered accounts yet" />
          <PieCard title="Account Types" subtitle="Students, instructors and Non-CvSU" data={typeData} loading={loading} emptyText="No registered accounts yet" />
        </div>
      )}
    </div>
  );
};

export default MonthlyPieCharts;