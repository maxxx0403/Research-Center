import { useState, useEffect, useMemo, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Users, Check, X, MessageSquare, FlaskConical, Package, ChevronDown, ChevronUp } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { notifyReservationApproved, notifyReservationRejected } from '@/lib/notifications';
import ReservationMessagesPanel from '@/components/ReservationMessagesPanel';

const STATUS_PRIORITY = ['rejected', 'pending', 'reserved', 'in_use', 'completed', 'cancelled'];

// Groups rows submitted together (same batch_id) into one entry, so a
// multi-lab or multi-equipment request shows up as a single row/ID in the
// approval queue instead of one row per laboratory/equipment item.
const groupByBatch = (items) => {
  const groups = new Map();
  for (const r of items) {
    const key = r.batch_id ? `batch-${r.batch_id}` : `single-${r.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return Array.from(groups.entries()).map(([key, group]) => {
    const sorted = [...group].sort((a, b) => a.id - b.id);
    return {
      key,
      ids: sorted.map((it) => it.id),
      items: sorted,
      primary: sorted[0],
      status: STATUS_PRIORITY.find((s) => sorted.some((it) => it.status === s)) || sorted[0].status,
    };
  });
};

const StaffReservations = () => {
  const { user, assignedRoomIds } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [labItems, setLabItems] = useState([]);
  const [eqItems, setEqItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectingEqId, setRejectingEqId] = useState(null);
  const [rejectionEqReason, setRejectionEqReason] = useState('');
  const [messagingItem, setMessagingItem] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [expandedLabGroups, setExpandedLabGroups] = useState({});
  const [expandedEqGroups, setExpandedEqGroups] = useState({});

  const loadData = async () => {
    const [labRes, eqRes] = await Promise.all([
    supabase.
    from('reservations').
    select('id, user_id, researcher_name, email, start_datetime, end_datetime, status, rejection_reason, members_list, laboratory_id, batch_id, laboratories(lab_name, lab_code, floor)').
    order('start_datetime', { ascending: false }),
    supabase.
    from('equipment_reservations').
    select('id, user_id, researcher_name, email, quantity_reserved, start_datetime, end_datetime, status, rejection_reason, batch_id, members_list, equipment(name, brand, laboratory_id, laboratories(lab_code, floor))').
    order('start_datetime', { ascending: false })]
    );

    const labScoped = assignedRoomIds.length ?
    (labRes.data || []).filter((r) => assignedRoomIds.includes(r.laboratory_id)) :
    labRes.data || [];
    const eqScoped = assignedRoomIds.length ?
    (eqRes.data || []).filter((r) => assignedRoomIds.includes(r.equipment?.laboratory_id)) :
    eqRes.data || [];

    setLabItems(labScoped);
    setEqItems(eqScoped);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [assignedRoomIds]);

  // Coming from a notification click (?open=lab:12 or ?open=equipment:7):
  // open that reservation's message thread and scroll to/highlight its row.
  useEffect(() => {
    if (loading) return;
    const open = searchParams.get('open');
    if (!open) return;
    const [type, idStr] = open.split(':');
    const id = Number(idStr);
    const list = type === 'lab' ? labItems : eqItems;
    const item = list.find((r) => r.id === id);
    if (item) {
      const label = type === 'lab' ? `Reservation #RC${String(id).padStart(5, '0')}` : `Equipment request #EQ${String(id).padStart(5, '0')}`;
      setMessagingItem({ type, id, label, reason: item.rejection_reason });
      setHighlightId(`${type}-${id}`);
      setTimeout(() => {
        document.getElementById(`row-${type}-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      setTimeout(() => setHighlightId(null), 3000);
    }
    setSearchParams({}, { replace: true });
  }, [loading, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const labGroups = useMemo(() => groupByBatch(labItems), [labItems]);
  const filteredLabGroups = labGroups.filter((g) =>
  !search ||
  g.primary.researcher_name.toLowerCase().includes(search.toLowerCase()) ||
  (g.primary.email || '').toLowerCase().includes(search.toLowerCase())
  );
  const eqGroups = useMemo(() => groupByBatch(eqItems), [eqItems]);
  const filteredEqGroups = eqGroups.filter((g) =>
  !search ||
  g.primary.researcher_name.toLowerCase().includes(search.toLowerCase()) ||
  g.items.some((it) => (it.equipment?.name || '').toLowerCase().includes(search.toLowerCase()))
  );

  const fmt = (d) => new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  const toggleLabGroup = (key) => setExpandedLabGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleEqGroup = (key) => setExpandedEqGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const approveLabGroup = async (group) => {
    const ids = group.ids;
    const label = ids.length > 1 ? `Reservation #RC${String(ids[0]).padStart(5, '0')} (${ids.length} laboratories)` : `Reservation #RC${String(ids[0]).padStart(5, '0')}`;
    const { error } = await supabase.from('reservations').update({
      status: 'reserved',
      approved_by: user.id,
      approved_at: new Date().toISOString()
    }).in('id', ids);
    if (error) { toast.error('Failed to approve: ' + error.message); return; }
    setLabItems((prev) => prev.map((r) => ids.includes(r.id) ? { ...r, status: 'reserved' } : r));
    toast.success('Reservation approved.');
    if (group.primary?.user_id) notifyReservationApproved({ userId: group.primary.user_id, label, reservationType: 'lab', reservationId: ids[0] });
  };

  const rejectLab = async () => {
    if (!rejectingId) return;
    const group = labGroups.find((g) => g.key === rejectingId);
    if (!group) return;
    const ids = group.ids;
    const label = ids.length > 1 ? `Reservation #RC${String(ids[0]).padStart(5, '0')} (${ids.length} laboratories)` : `Reservation #RC${String(ids[0]).padStart(5, '0')}`;
    const { error } = await supabase.from('reservations').update({
      status: 'rejected',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      rejection_reason: rejectionReason || null
    }).in('id', ids);
    if (error) { toast.error('Failed to reject: ' + error.message); return; }
    setLabItems((prev) => prev.map((r) => ids.includes(r.id) ? { ...r, status: 'rejected', rejection_reason: rejectionReason || null } : r));
    toast.success('Reservation rejected.');
    if (group.primary?.user_id) notifyReservationRejected({ userId: group.primary.user_id, label, reason: rejectionReason, reservationType: 'lab', reservationId: ids[0] });
    setRejectingId(null);
    setRejectionReason('');
  };

  const approveEqGroup = async (group) => {
    const ids = group.ids;
    const label = ids.length > 1 ? `Equipment request #EQ${String(ids[0]).padStart(5, '0')} (${ids.length} items)` : `Equipment request #EQ${String(ids[0]).padStart(5, '0')}`;
    const { error } = await supabase.from('equipment_reservations').update({
      status: 'reserved',
      approved_by: user.id,
      approved_at: new Date().toISOString()
    }).in('id', ids);
    if (error) { toast.error('Failed to approve: ' + error.message); return; }
    setEqItems((prev) => prev.map((r) => ids.includes(r.id) ? { ...r, status: 'reserved' } : r));
    toast.success('Equipment reservation approved.');
    if (group.primary?.user_id) notifyReservationApproved({ userId: group.primary.user_id, label, reservationType: 'equipment', reservationId: ids[0] });
  };

  const rejectEq = async () => {
    if (!rejectingEqId) return;
    const group = eqGroups.find((g) => g.key === rejectingEqId);
    if (!group) return;
    const ids = group.ids;
    const label = ids.length > 1 ? `Equipment request #EQ${String(ids[0]).padStart(5, '0')} (${ids.length} items)` : `Equipment request #EQ${String(ids[0]).padStart(5, '0')}`;
    const { error } = await supabase.from('equipment_reservations').update({
      status: 'rejected',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      rejection_reason: rejectionEqReason || null
    }).in('id', ids);
    if (error) { toast.error('Failed to reject: ' + error.message); return; }
    setEqItems((prev) => prev.map((r) => ids.includes(r.id) ? { ...r, status: 'rejected', rejection_reason: rejectionEqReason || null } : r));
    toast.success('Equipment reservation rejected.');
    if (group.primary?.user_id) notifyReservationRejected({ userId: group.primary.user_id, label, reason: rejectionEqReason, reservationType: 'equipment', reservationId: ids[0] });
    setRejectingEqId(null);
    setRejectionEqReason('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold">Reservations</h2>
          <p className="text-xs text-muted-foreground">{assignedRoomIds.length ? `${assignedRoomIds.length} assigned room${assignedRoomIds.length > 1 ? 's' : ''}` : 'all rooms'} — you can approve/reject reservations for your assigned rooms</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search researcher..." className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary" />
        </div>
      </div>

      <div>
        <h3 className="font-heading text-sm font-bold mb-3">Laboratory Reservations <span className="text-muted-foreground font-normal">({filteredLabGroups.length})</span></h3>
        <div className="bg-card rounded-xl shadow-card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Researcher</th>
                <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Members</th>
                <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Laboratory</th>
                <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Schedule</th>
                <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground text-xs">Loading...</td></tr>
              ) : filteredLabGroups.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground text-xs">No reservations found.</td></tr>
              ) : filteredLabGroups.map((group) => {
                const r = group.primary;
                const isBatch = group.items.length > 1;
                const isGroupExpanded = expandedLabGroups[group.key];
                return (
                <Fragment key={group.key}>
                <tr id={`row-lab-${r.id}`} className={`border-b border-muted last:border-0 transition-colors ${highlightId === `lab-${r.id}` ? 'bg-primary/10 ring-2 ring-primary/40' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-semibold">
                      {r.researcher_name}
                      {isBatch && <span className="text-muted-foreground font-normal text-xs"> · #RC{String(r.id).padStart(5, '0')} (+{group.items.length - 1})</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {r.members_list?.length > 0 ?
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Users className="w-3.5 h-3.5" /> {r.members_list.length} member{r.members_list.length > 1 ? 's' : ''}</span> :

                  <span className="text-xs text-muted-foreground">—</span>
                  }
                  </td>
                  <td className="px-4 py-3">
                    {isBatch ? (
                      <button
                        onClick={() => toggleLabGroup(group.key)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full hover:bg-primary/20 transition-colors cursor-pointer"
                      >
                        <FlaskConical className="w-3 h-3" />
                        {group.items.length} labs
                        {isGroupExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    ) : (
                      <>
                        <div className="font-medium">{r.laboratories?.lab_name}</div>
                        <div className="text-xs text-muted-foreground">{r.laboratories?.lab_code}</div>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {isBatch ? <span className="text-muted-foreground italic">Multiple schedules</span> : <>{fmt(r.start_datetime)} – {fmt(r.end_datetime)}</>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={group.status} /></td>
                  <td className="px-4 py-3">
                    {group.status === 'pending' ?
                  <div className="flex gap-1.5">
                        <button onClick={() => approveLabGroup(group)} className="bg-success text-success-foreground px-2 py-1 rounded text-xs font-semibold border-none cursor-pointer hover:brightness-110 inline-flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Accept
                        </button>
                        <button onClick={() => setRejectingId(group.key)} className="bg-destructive text-destructive-foreground px-2 py-1 rounded text-xs font-semibold border-none cursor-pointer hover:brightness-110 inline-flex items-center gap-1">
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div> :

                  <span className="text-xs text-muted-foreground italic">—</span>
                  }
                  <button
                      onClick={() => setMessagingItem({ type: 'lab', id: r.id, label: `Reservation #RC${String(r.id).padStart(5, '0')}`, reason: r.rejection_reason })}
                      className="mt-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded text-xs font-semibold cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                      title="Messages"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
                {isBatch && isGroupExpanded && (
                  <tr className="bg-primary/5 border-b border-muted">
                    <td colSpan={6} className="px-6 py-3">
                      <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <FlaskConical className="w-3.5 h-3.5" /> Laboratories in this Reservation
                      </p>
                      <div className="space-y-2">
                        {group.items.map((it) => (
                          <div key={it.id} className="bg-card border border-border rounded-lg px-3 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="font-semibold text-foreground">{it.laboratories?.lab_name}</span>{' '}
                              <code className="bg-muted px-1 py-0.5 rounded text-[0.7rem]">{it.laboratories?.lab_code}</code>
                              <span className="text-muted-foreground ml-2">{fmt(it.start_datetime)} – {fmt(it.end_datetime)}</span>
                            </div>
                            <StatusBadge status={it.status} />
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="font-heading text-sm font-bold mb-3">Equipment Reservations <span className="text-muted-foreground font-normal">({filteredEqGroups.length})</span></h3>
        <div className="bg-card rounded-xl shadow-card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Researcher</th>
                <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Equipment</th>
                <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Schedule</th>
                <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10 text-muted-foreground text-xs">Loading...</td></tr>
              ) : filteredEqGroups.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-muted-foreground text-xs">No equipment reservations found.</td></tr>
              ) : filteredEqGroups.map((group) => {
                const r = group.primary;
                const isBatch = group.items.length > 1;
                const isGroupExpanded = expandedEqGroups[group.key];
                return (
                <Fragment key={group.key}>
                <tr id={`row-equipment-${r.id}`} className={`border-b border-muted last:border-0 transition-colors ${highlightId === `equipment-${r.id}` ? 'bg-primary/10 ring-2 ring-primary/40' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-semibold">
                      {r.researcher_name}
                      {isBatch && <span className="text-muted-foreground font-normal text-xs"> · #EQ{String(r.id).padStart(5, '0')} (+{group.items.length - 1})</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                    {r.members_list?.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Users className="w-3.5 h-3.5" /> {r.members_list.length} member{r.members_list.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isBatch ? (
                      <button
                        onClick={() => toggleEqGroup(group.key)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full hover:bg-primary/20 transition-colors cursor-pointer"
                      >
                        <Package className="w-3 h-3" />
                        {group.items.length} items
                        {isGroupExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    ) : (
                      <>
                        <div className="font-medium">{r.equipment?.name}</div>
                        <div className="text-xs text-muted-foreground">{r.equipment?.brand} · Qty {r.quantity_reserved}</div>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {isBatch ? <span className="text-muted-foreground italic">Multiple schedules</span> : <>{fmt(r.start_datetime)} – {fmt(r.end_datetime)}</>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={group.status} /></td>
                  <td className="px-4 py-3">
                    {group.status === 'pending' ?
                  <div className="flex gap-1.5">
                        <button onClick={() => approveEqGroup(group)} className="bg-success text-success-foreground px-2 py-1 rounded text-xs font-semibold border-none cursor-pointer hover:brightness-110 inline-flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Accept
                        </button>
                        <button onClick={() => setRejectingEqId(group.key)} className="bg-destructive text-destructive-foreground px-2 py-1 rounded text-xs font-semibold border-none cursor-pointer hover:brightness-110 inline-flex items-center gap-1">
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div> :

                  <span className="text-xs text-muted-foreground italic">—</span>
                  }
                  <button
                      onClick={() => setMessagingItem({ type: 'equipment', id: r.id, label: `Equipment request #EQ${String(r.id).padStart(5, '0')}`, reason: r.rejection_reason })}
                      className="mt-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded text-xs font-semibold cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                      title="Messages"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
                {isBatch && isGroupExpanded && (
                  <tr className="bg-primary/5 border-b border-muted">
                    <td colSpan={5} className="px-6 py-3">
                      <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5" /> Equipment in this Request
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {group.items.map((it) => (
                          <div key={it.id} className="bg-card border border-border rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                            <span className="font-semibold text-foreground">{it.equipment?.name}</span>
                            {it.equipment?.brand && <span className="text-muted-foreground">{it.equipment.brand}</span>}
                            <span className="bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">x{it.quantity_reserved}</span>
                            <StatusBadge status={it.status} />
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {rejectingId &&
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-lg w-full max-w-sm p-6">
            <h3 className="font-heading text-base font-bold mb-3">Reject Reservation</h3>
            <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Reason (optional)"
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary mb-4"
            rows={3} />

            <div className="flex gap-3 justify-end">
              <button onClick={() => { setRejectingId(null); setRejectionReason(''); }} className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-semibold cursor-pointer bg-transparent text-foreground">Cancel</button>
              <button onClick={rejectLab} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold border-none cursor-pointer hover:opacity-90">Reject</button>
            </div>
          </div>
        </div>
      }

      {rejectingEqId &&
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-lg w-full max-w-sm p-6">
            <h3 className="font-heading text-base font-bold mb-3">Reject Equipment Reservation</h3>
            <textarea
            value={rejectionEqReason}
            onChange={(e) => setRejectionEqReason(e.target.value)}
            placeholder="Reason (optional)"
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary mb-4"
            rows={3} />

            <div className="flex gap-3 justify-end">
              <button onClick={() => { setRejectingEqId(null); setRejectionEqReason(''); }} className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-semibold cursor-pointer bg-transparent text-foreground">Cancel</button>
              <button onClick={rejectEq} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold border-none cursor-pointer hover:opacity-90">Reject</button>
            </div>
          </div>
        </div>
      }

      {messagingItem &&
      <ReservationMessagesPanel
        reservationType={messagingItem.type}
        reservationId={messagingItem.id}
        label={messagingItem.label}
        rejectionReason={messagingItem.reason}
        onClose={() => setMessagingItem(null)}
      />
      }
    </div>);

};

export default StaffReservations;