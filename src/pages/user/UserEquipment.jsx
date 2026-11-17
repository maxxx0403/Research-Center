import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { FlaskConical, Package, Search, ChevronRight, Lock, Clock, X, CalendarPlus, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentEquipmentStock } from '@/hooks/useEquipmentAvailability';
import { availableNowOf, isOutOfService, equipmentStatusLabel } from '@/lib/equipmentAvailability';
import { APP_TIMEZONE, manilaInputToISO, todayManilaDate } from '@/lib/timezone';
import { categoryOf, summarizeCategories } from '@/lib/equipmentCategories';
import FormSelect from '@/components/FormSelect';
import StatusBadge from '@/components/StatusBadge';

const timeText = (iso) =>
  new Date(iso).toLocaleTimeString('en-US', { timeZone: APP_TIMEZONE, hour: 'numeric', minute: '2-digit' });

const cardClass = 'text-left rounded-2xl p-4 bg-card border-2 border-border shadow-card transition-all relative overflow-hidden';
const clickableClass = 'cursor-pointer hover:border-primary hover:-translate-y-0.5 hover:shadow-lg';

// ---------------------------------------------------------------------------
// Laboratories & Equipment: what is free right now, what is already reserved
// today. Clicking one opens the reserve form with it already selected, so the
// user only sets the date and time.
// ---------------------------------------------------------------------------
const UserEquipment = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('labs');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all'); // all | free | busy | blocked
  const [labs, setLabs] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [todayBookings, setTodayBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  // Card clicked: { type: 'lab' | 'equipment', id } -> shows the details pop-up
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const nowISO = new Date().toISOString();
      const endOfToday = manilaInputToISO(`${todayManilaDate()}T23:59`);
      const [labRes, eqRes, bookRes] = await Promise.all([
        supabase.from('laboratories').select('*').order('lab_code'),
        supabase.from('equipment').select('*, laboratories(lab_name, lab_code, floor)').order('name'),
        supabase
          .from('reservations')
          .select('id, laboratory_id, start_datetime, end_datetime, status')
          .in('status', ['reserved', 'in_use'])
          .gt('end_datetime', nowISO)
          .lt('start_datetime', endOfToday)
          .order('start_datetime'),
      ]);
      if (!active) return;
      setLabs(labRes.data || []);
      setEquipment(eqRes.data || []);
      setTodayBookings(bookRes.data || []);
      setLoading(false);
    };
    load();
    const channel = supabase
      .channel(`user-facility-availability-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'laboratories' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment' }, load)
      .subscribe();
    const intervalId = window.setInterval(load, 60000);
    return () => { active = false; window.clearInterval(intervalId); supabase.removeChannel(channel); };
  }, []);

  const { stock } = useCurrentEquipmentStock(equipment.map((e) => e.id));

  // Esc closes the details pop-up
  useEffect(() => {
    if (!selected) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const term = search.trim().toLowerCase();
  const shownLabs = useMemo(() => labs.filter((l) => !term
    || [l.lab_name, l.lab_code, l.floor].some((v) => String(v || '').toLowerCase().includes(term))), [labs, term]);
  const shownEquipment = useMemo(() => equipment.filter((e) => !term
    || [e.name, e.brand, e.model, e.laboratories?.lab_name, e.laboratories?.lab_code].some((v) => String(v || '').toLowerCase().includes(term))), [equipment, term]);

  const labState = (lab) => {
    const nowMs = Date.now();
    const bookings = todayBookings.filter((b) => b.laboratory_id === lab.id);
    const current = bookings.find((b) => new Date(b.start_datetime).getTime() <= nowMs);
    const later = bookings.filter((b) => b !== current);
    if (lab.status === 'maintenance') return { kind: 'blocked', label: 'Under Maintenance', bookings: [] };
    if (current || lab.status === 'occupied') {
      return { kind: 'busy', label: current ? `In use until ${timeText(current.end_datetime)}` : 'In use now', bookings: later };
    }
    return { kind: later.length ? 'reserved' : 'free', label: later.length ? 'Available now · reserved later today' : 'Available', bookings: later };
  };

  const equipmentState = (item) => {
    if (isOutOfService(item)) return { kind: 'blocked', label: equipmentStatusLabel(item.status) };
    const total = Number(item.quantity) || 0;
    const free = availableNowOf(item, stock);
    if (free == null) return { kind: 'free', label: `${total} unit${total === 1 ? '' : 's'}`, free: null, total };
    if (free <= 0) return { kind: 'busy', label: 'All units reserved / in use now', free, total };
    if (free < total) return { kind: 'reserved', label: `${free} of ${total} available now`, free, total };
    return { kind: 'free', label: `${free} of ${total} available now`, free, total };
  };

  // Availability filter groups: free = available now, busy = reserved / in use, blocked = cannot be reserved
  const matchesAvailability = (kind) => availabilityFilter === 'all'
    || (availabilityFilter === 'free' && kind === 'free')
    || (availabilityFilter === 'busy' && (kind === 'reserved' || kind === 'busy'))
    || (availabilityFilter === 'blocked' && kind === 'blocked');
  const visibleLabs = shownLabs.filter((lab) => matchesAvailability(labState(lab).kind));
  const visibleEquipment = shownEquipment
    .filter((item) => categoryFilter === 'all' || categoryOf(item) === categoryFilter)
    .filter((item) => matchesAvailability(equipmentState(item).kind));
  const categoryOptions = [
    { value: 'all', label: `All categories (${equipment.length})` },
    ...summarizeCategories(equipment).map(({ category, count }) => ({ value: category, label: `${category} (${count})` })),
  ];
  const availabilityOptions = [
    { value: 'all', label: 'All availability' },
    { value: 'free', label: 'Available now' },
    { value: 'busy', label: tab === 'labs' ? 'In use / reserved today' : 'Reserved / in use' },
    { value: 'blocked', label: 'Not available' },
  ];

  const tone = {
    free: { bar: 'gradient-primary', text: 'text-success' },
    reserved: { bar: 'bg-warning', text: 'text-warning' },
    busy: { bar: 'bg-warning', text: 'text-warning' },
    blocked: { bar: 'bg-destructive', text: 'text-destructive' },
  };

  return (
    <div className="bg-card rounded-2xl shadow-card overflow-hidden dash-black">
      <div className="px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-base font-bold">Laboratories &amp; Equipment</h1>
          <p className="text-xs text-muted-foreground">Click one to see its details. Press Reserve Now and it will already be selected; just set the date and time.</p>
        </div>
        <div role="tablist" className="inline-flex p-1 rounded-xl bg-muted/60 border border-border">
          {[
            { value: 'labs', label: 'Laboratories', icon: FlaskConical, count: labs.length },
            { value: 'equipment', label: 'Equipment', icon: Package, count: equipment.length },
          ].map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                tab === t.value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
              <span className={`text-[11px] font-normal ${tab === t.value ? 'text-primary-foreground/80' : ''}`}>({t.count})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'labs' ? 'Search laboratories by name, code or floor…' : 'Search equipment by name, brand, model or laboratory…'}
            className="w-full pl-9 pr-4 py-2.5 border-2 border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary"
          />
        </div>
        {tab === 'equipment' && (
          <div className="md:w-64">
            <FormSelect
              value={categoryFilter}
              onChange={(v) => setCategoryFilter(v || 'all')}
              placeholder="All categories"
              className="w-full px-3 py-2.5 border-2 border-border rounded-lg text-sm bg-card text-foreground"
              options={categoryOptions}
            />
          </div>
        )}
        <div className="md:w-56">
          <FormSelect
            value={availabilityFilter}
            onChange={(v) => setAvailabilityFilter(v || 'all')}
            placeholder="All availability"
            className="w-full px-3 py-2.5 border-2 border-border rounded-lg text-sm bg-card text-foreground"
            options={availabilityOptions}
          />
        </div>
        </div>

        {loading ? (
          <p className="text-center py-10 text-muted-foreground text-sm">Loading…</p>
        ) : tab === 'labs' ? (
          visibleLabs.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground text-sm">No laboratories found.</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3 ">
              {visibleLabs.map((lab) => {
                const st = labState(lab);
                const canReserve = st.kind !== 'blocked';
                return (
                  <button
                    key={lab.id}
                    type="button"
                    onClick={() => setSelected({ type: 'lab', id: lab.id })}
                    className={`${cardClass} ${clickableClass} ${canReserve ? '' : 'opacity-80'}`}
                  >
                    <span className={`absolute top-0 left-0 right-0 h-1 ${tone[st.kind].bar}`} />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <code className="text-[0.7rem] bg-muted px-1.5 py-0.5 rounded font-semibold">{lab.lab_code}</code>
                        <div className="font-heading font-bold text-sm text-foreground mt-1.5 leading-snug">{lab.lab_name}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{[lab.floor, lab.max_capacity ? `Capacity ${lab.max_capacity}` : null].filter(Boolean).join(' · ')}</div>
                      </div>
                      {canReserve ? <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-1" /> : <Lock className="w-4 h-4 text-destructive flex-shrink-0 mt-1" />}
                    </div>
                    <div className={`text-xs font-semibold mt-3 ${tone[st.kind].text}`}>{st.label}</div>
                    {st.bookings.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {st.bookings.slice(0, 3).map((b) => (
                          <div key={b.id} className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Reserved {timeText(b.start_datetime)} – {timeText(b.end_datetime)}
                          </div>
                        ))}
                        {st.bookings.length > 3 && <div className="text-[11px] text-muted-foreground">+{st.bookings.length - 3} more today</div>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )
        ) : visibleEquipment.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground text-sm">No equipment found.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3 ">
            {visibleEquipment.map((item) => {
              const st = equipmentState(item);
              const canReserve = st.kind !== 'blocked';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected({ type: 'equipment', id: item.id })}
                  className={`${cardClass} ${clickableClass} ${canReserve ? '' : 'opacity-80'}`}
                >
                  <span className={`absolute top-0 left-0 right-0 h-1 ${tone[st.kind].bar}`} />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-heading font-bold text-sm text-foreground leading-snug">{item.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{[item.brand, item.model].filter(Boolean).join(' · ') || '—'}</div>
                      {item.laboratories?.lab_code && (
                        <code className="inline-block mt-1.5 text-[0.7rem] bg-muted px-1.5 py-0.5 rounded">{item.laboratories.lab_code}</code>
                      )}
                    </div>
                    {canReserve ? <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-1" /> : <Lock className="w-4 h-4 text-destructive flex-shrink-0 mt-1" />}
                  </div>
                  <div className={`text-xs font-semibold mt-3 ${tone[st.kind].text}`}>{st.label}</div>
                  {st.kind === 'busy' && <div className="text-[11px] text-muted-foreground mt-0.5">You can still reserve it for another time.</div>}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground pt-1">
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-success" /> Available</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-warning" /> Reserved / in use</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-destructive" /> Not available</span>
        </div>
      </div>
      {selected && (() => {
        const isLab = selected.type === 'lab';
        const lab = isLab ? labs.find((l) => l.id === selected.id) : null;
        const item = !isLab ? equipment.find((e) => e.id === selected.id) : null;
        if (!lab && !item) return null;
        const st = isLab ? labState(lab) : equipmentState(item);
        const canReserve = st.kind !== 'blocked';
        const labEquipment = isLab ? equipment.filter((e) => e.laboratory_id === lab.id) : [];
        const close = () => setSelected(null);
        const reserve = () => navigate(isLab ? `/user/reserve?lab_id=${lab.id}` : `/user/reserve-equipment?equipment_id=${item.id}`);
        const rows = isLab
          ? [
            ['Lab Code', lab.lab_code],
            ['Floor', lab.floor],
            ['Capacity', lab.max_capacity ? `${lab.max_capacity} persons` : null],
            ['Friday – Sunday', lab.allow_non_official_hours ? 'Accepts reservations' : 'Not accepted (Mon–Thu only)'],
            ['Equipment in this lab', labEquipment.length ? `${labEquipment.length} item${labEquipment.length === 1 ? '' : 's'}` : 'None listed'],
          ]
          : [
            ['Category', categoryOf(item)],
            ['Brand', item.brand],
            ['Model', item.model],
            ['Laboratory', [item.laboratories?.lab_code, item.laboratories?.lab_name].filter(Boolean).join(' - ')],
            ['Floor', item.laboratories?.floor],
            ['Total Units', `${Number(item.quantity) || 0}`],
            ['Friday – Sunday', item.allow_non_official_hours ? 'Accepts reservations' : 'Not accepted (Mon–Thu only)'],
          ];
        // Portal to <body>: the glass card around this page would otherwise trap a fixed pop-up inside it.
        return createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-black/60" onClick={close} role="dialog" aria-modal="true" aria-label="Details">
            <div className="bg-card text-foreground rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    {isLab ? <FlaskConical className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
                    {isLab ? 'Laboratory' : 'Equipment'}
                  </p>
                  <h2 className="font-heading text-base sm:text-lg font-bold text-primary leading-snug">
                    {isLab ? [lab.lab_code, lab.lab_name].filter(Boolean).join(' - ') : item.name}
                  </h2>
                  <div className="mt-1.5"><StatusBadge status={isLab ? lab.status : item.status} type={isLab ? undefined : 'equipment'} /></div>
                </div>
                <button type="button" onClick={close} aria-label="Close" className="bg-transparent border-none text-muted-foreground hover:text-foreground cursor-pointer p-1 flex-shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 py-5 overflow-y-auto text-sm space-y-4">
                <div className={`rounded-xl border-2 px-4 py-3 ${st.kind === 'blocked' ? 'border-destructive/30 bg-destructive/5' : st.kind === 'free' ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5'}`}>
                  <p className={`font-semibold ${tone[st.kind].text}`}>{st.label}</p>
                  {isLab && st.bookings.length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {st.bookings.map((b) => (
                        <div key={b.id} className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Reserved today {timeText(b.start_datetime)} – {timeText(b.end_datetime)}
                        </div>
                      ))}
                    </div>
                  )}
                  {st.kind === 'busy' && <p className="text-xs text-muted-foreground mt-1">You can still reserve it for another date or time.</p>}
                  {st.kind === 'blocked' && <p className="text-xs text-muted-foreground mt-1">This cannot be reserved right now.</p>}
                </div>

                {(isLab ? lab.description : item.description) && (
                  <p className="text-muted-foreground leading-relaxed flex gap-2">
                    <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{isLab ? lab.description : item.description}</span>
                  </p>
                )}

                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                  {rows.filter(([, value]) => value).map(([label, value]) => (
                    <div key={label} className="contents">
                      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
                      <dd className="text-sm text-foreground m-0">{value}</dd>
                    </div>
                  ))}
                </dl>

                {isLab && labEquipment.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">Equipment available in this lab</p>
                    <div className="flex flex-wrap gap-1.5">
                      {labEquipment.slice(0, 12).map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => setSelected({ type: 'equipment', id: e.id })}
                          className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-primary/10 hover:text-primary border-none cursor-pointer"
                        >
                          {e.name}
                        </button>
                      ))}
                      {labEquipment.length > 12 && <span className="text-xs text-muted-foreground px-1 py-1">+{labEquipment.length - 12} more</span>}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
                <button type="button" onClick={close} className="px-4 py-2 rounded-lg text-sm font-semibold bg-muted text-foreground border border-border cursor-pointer hover:bg-border transition-colors">
                  Close
                </button>
                <button
                  type="button"
                  onClick={reserve}
                  disabled={!canReserve}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold gradient-primary text-primary-foreground border-none cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {canReserve ? <CalendarPlus className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  {canReserve ? 'Reserve Now' : 'Not Available'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        );
      })()}
    </div>
  );
};

export default UserEquipment;