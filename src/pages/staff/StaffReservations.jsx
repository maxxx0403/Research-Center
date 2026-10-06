import { useState, useEffect, useMemo, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Users, Check, X, MessageSquare, FlaskConical, Package, ChevronDown, ChevronUp, FileSpreadsheet } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { notifyReservationApproved, notifyReservationRejected } from '@/lib/notifications';
import ReservationMessagesPanel from '@/components/ReservationMessagesPanel';
import { logReservationAction } from '@/lib/activityLog';
import RowActions from '@/components/RowActions';
import { downloadReservationsExcel } from '@/lib/exportReservations';

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
  const { user, assignedRoomIds, refreshRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [labItems, setLabItems] = useState([]);
  const [eqItems, setEqItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('lab');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedMembers, setExpandedMembers] = useState({});
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectingEqId, setRejectingEqId] = useState(null);
  const [rejectionEqReason, setRejectionEqReason] = useState('');
  const [messagingItem, setMessagingItem] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [expandedLabGroups, setExpandedLabGroups] = useState({});
  const [expandedEqGroups, setExpandedEqGroups] = useState({});

  const [exportingExcel, setExportingExcel] = useState(false);

  // Exports every lab + equipment reservation in this staff member's assigned rooms to one Excel file.
  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const [{ data: labData, error: labErr }, { data: eqData, error: eqErr }] = await Promise.all([
        supabase
          .from('reservations')
          .select('id, laboratory_id, researcher_name, email, phone, unit_college, adviser_name, study_title, stakeholder_type, status, approved_at, rejection_reason, start_datetime, end_datetime, members_list, batch_id, created_at, laboratories(id, lab_name, lab_code, floor), reservation_equipment(id, quantity_reserved, equipment(id, name, brand, model))')
          .order('created_at', { ascending: false }),
        supabase
          .from('equipment_reservations')
          .select('id, researcher_name, email, purpose, quantity_reserved, start_datetime, end_datetime, status, rejection_reason, created_at, batch_id, members_list, equipment(name, brand, laboratory_id, laboratories(id, lab_code, floor))')
          .order('created_at', { ascending: false }),
      ]);
      if (labErr || eqErr) throw labErr || eqErr;

      const ids = new Set((assignedRoomIds || []).map((id) => String(id)));
      const labScoped = ids.size
        ? (labData || []).filter((r) => ids.has(String(r.laboratory_id ?? r.laboratories?.id)))
        : (labData || []);
      const eqScoped = ids.size
        ? (eqData || []).filter((r) => r.equipment?.laboratory_id != null && ids.has(String(r.equipment.laboratory_id)))
        : (eqData || []);

      await downloadReservationsExcel(labScoped, eqScoped);
    } catch (err) {
      console.error('Excel export failed:', err);
      toast.error('Could not export reservations. Please try again.');
    } finally {
      setExportingExcel(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [labRes, eqRes] = await Promise.all([
        supabase
          .from('reservations')
          .select('id, user_id, researcher_name, email, phone, start_datetime, end_datetime, status, rejection_reason, members_list, laboratory_id, batch_id, created_at, laboratories(id, lab_name, lab_code, floor)')
          .order('created_at', { ascending: false }),
        supabase
          .from('equipment_reservations')
          .select('id, user_id, researcher_name, email, quantity_reserved, start_datetime, end_datetime, status, rejection_reason, batch_id, members_list, created_at, equipment(name, brand, laboratory_id, laboratories(id, lab_code, floor))')
          .order('created_at', { ascending: false })
      ]);

      if (labRes.error) {
        console.error('Staff lab reservations fetch error:', labRes.error);
        toast.error('Failed to load lab reservations: ' + labRes.error.message);
      }
      if (eqRes.error) {
        console.error('Staff equipment reservations fetch error:', eqRes.error);
      }

      const assignedIdsSet = new Set((assignedRoomIds || []).map((id) => String(id)));

      const labScoped = assignedIdsSet.size > 0
        ? (labRes.data || []).filter((r) => {
            const labId = r.laboratory_id != null ? String(r.laboratory_id) : (r.laboratories?.id != null ? String(r.laboratories.id) : null);
            return labId != null && assignedIdsSet.has(labId);
          })
        : (labRes.data || []);

      const eqScoped = assignedIdsSet.size > 0
        ? (eqRes.data || []).filter((r) => {
            const labId = r.equipment?.laboratory_id != null ? String(r.equipment.laboratory_id) : null;
            return labId != null && assignedIdsSet.has(labId);
          })
        : (eqRes.data || []);

      setLabItems(labScoped);
      setEqItems(eqScoped);
    } catch (err) {
      console.error('Error loading staff reservations:', err);
    } finally {
      setLoading(false);
    }
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
      setTab(type === 'lab' ? 'lab' : 'equipment');
      setTimeout(() => {
        document.getElementById(`row-${type}-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      setTimeout(() => setHighlightId(null), 3000);
    }
    setSearchParams({}, { replace: true });
  }, [loading, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const labGroups = useMemo(() => groupByBatch(labItems), [labItems]);
  const filteredLabGroups = labGroups.filter((g) => {
    if (statusFilter && !g.items.some((it) => it.status === statusFilter)) return false;
    const term = search.toLowerCase().trim();
    if (!term) return true;
    const r = g.primary;
    return (
      r.researcher_name.toLowerCase().includes(term) ||
      (r.email || '').toLowerCase().includes(term) ||
      `rc${String(r.id).padStart(5, '0')}`.includes(term.replace('#', '')) ||
      String(r.id).includes(term.replace('#', '')) ||
      g.items.some((it) =>
        (it.laboratories?.lab_name || '').toLowerCase().includes(term) ||
        (it.laboratories?.lab_code || '').toLowerCase().includes(term)
      )
    );
  });
  const eqGroups = useMemo(() => groupByBatch(eqItems), [eqItems]);
  const filteredEqGroups = eqGroups.filter((g) => {
    if (statusFilter && !g.items.some((it) => it.status === statusFilter)) return false;
    const term = search.toLowerCase().trim();
    if (!term) return true;
    const r = g.primary;
    return (
      r.researcher_name.toLowerCase().includes(term) ||
      (r.email || '').toLowerCase().includes(term) ||
      `eq${String(r.id).padStart(5, '0')}`.includes(term.replace('#', '')) ||
      String(r.id).includes(term.replace('#', '')) ||
      g.items.some((it) => (it.equipment?.name || '').toLowerCase().includes(term))
    );
  });

  const fmt = (d) => new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  const toggleMembers = (id) => setExpandedMembers((prev) => ({ ...prev, [id]: !prev[id] }));
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
    logReservationAction({ userId: user.id, type: 'lab', verb: 'Accepted', items: group.items });
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
    logReservationAction({ userId: user.id, type: 'lab', verb: 'Rejected', items: group.items, reason: rejectionReason });
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
    logReservationAction({ userId: user.id, type: 'equipment', verb: 'Accepted', items: group.items });
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
    logReservationAction({ userId: user.id, type: 'equipment', verb: 'Rejected', items: group.items, reason: rejectionEqReason });
    if (group.primary?.user_id) notifyReservationRejected({ userId: group.primary.user_id, label, reason: rejectionEqReason, reservationType: 'equipment', reservationId: ids[0] });
    setRejectingEqId(null);
    setRejectionEqReason('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl shadow-card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Search</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name / email…" className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary" />
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground">
              <option value="">All</option>
              {['pending', 'reserved', 'in_use', 'completed', 'cancelled', 'rejected'].map((st) => (
                <option key={st} value={st}>{st.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={async () => {
              setSearch('');
              setStatusFilter('');
              if (refreshRole) await refreshRole();
              loadData();
            }}
            className="bg-muted text-muted-foreground border border-border px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:bg-border transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border">
        <div className="flex gap-1">
          {[
            { key: 'lab', label: 'Laboratories', icon: FlaskConical, count: filteredLabGroups.length },
            { key: 'equipment', label: 'Equipment', icon: Package, count: filteredEqGroups.length },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-transparent border-t-0 border-x-0 border-b-2 -mb-px cursor-pointer transition-colors ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${tab === t.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleExportExcel}
          disabled={exportingExcel || loading}
          className="inline-flex items-center gap-2 px-4 py-2 mb-2 sm:mb-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity self-start sm:self-auto"
        >
          <FileSpreadsheet className="w-4 h-4" />
          {exportingExcel ? 'Exporting…' : 'Export All to Excel'}
        </button>
      </div>

      {tab === 'lab' && (
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="font-heading text-sm font-bold">
              Reservations <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs ml-2">{filteredLabGroups.length}</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b-2 border-border">
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">ID</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Researcher</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Members</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Laboratory</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Schedule</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-xs">Loading...</td></tr>
              ) : filteredLabGroups.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-xs">No reservations found.</td></tr>
              ) : filteredLabGroups.map((group) => {
                const r = group.primary;
                const isBatch = group.items.length > 1;
                const isGroupExpanded = expandedLabGroups[group.key];
                return (
                <Fragment key={group.key}>
                <tr id={`row-lab-${r.id}`} className={`border-b border-muted hover:bg-muted/30 transition-colors ${highlightId === `lab-${r.id}` ? 'bg-primary/10 ring-2 ring-primary/40' : ''}`}>
                  <td className="px-4 py-3 font-semibold text-xs">
                    #RC{String(r.id).padStart(5, '0')}
                    {isBatch && <span className="text-muted-foreground font-normal"> (+{group.items.length - 1})</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{r.researcher_name}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {r.members_list?.length > 0 ? (
                      <div className="space-y-1">
                        <button
                          onClick={() => toggleMembers(r.id)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full hover:bg-primary/20 transition-colors cursor-pointer"
                        >
                          <Users className="w-3 h-3" />
                          {r.members_list.length} member{r.members_list.length > 1 ? 's' : ''}
                          {expandedMembers[r.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {expandedMembers[r.id] && (
                          <ol className="mt-1.5 space-y-0.5 pl-1">
                            {r.members_list.map((name, i) => (
                              <li key={i} className="text-xs text-foreground flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-muted-foreground w-4">{i + 1}.</span>
                                {name}
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">—</span>
                    )}
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
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {isBatch ? (
                      <span className="text-muted-foreground italic">Multiple schedules</span>
                    ) : (
                      <>
                        {new Date(r.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}<br />
                        {new Date(r.start_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – {new Date(r.end_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={group.status} /></td>
                  <td className="px-4 py-3">
                    <RowActions
                      items={[
                        { label: 'Accept', icon: Check, success: true, hidden: group.status !== 'pending', onClick: () => approveLabGroup(group) },
                        { label: 'Reject', icon: X, destructive: true, hidden: group.status !== 'pending', onClick: () => setRejectingId(group.key) },
                        {
                          label: 'Messages',
                          icon: MessageSquare,
                          onClick: () => setMessagingItem({ type: 'lab', id: r.id, label: `Reservation #RC${String(r.id).padStart(5, '0')}`, reason: r.rejection_reason }),
                        },
                      ]}
                    />
                  </td>
                </tr>
                {isBatch && isGroupExpanded && (
                  <tr className="bg-primary/5 border-b border-muted">
                    <td colSpan={7} className="px-6 py-3">
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
      )}

      {tab === 'equipment' && (
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="font-heading text-sm font-bold">
              Reservations <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs ml-2">{filteredEqGroups.length}</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b-2 border-border">
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">ID</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Researcher</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Members</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Equipment</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Schedule</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-xs">Loading...</td></tr>
              ) : filteredEqGroups.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-xs">No equipment reservations found.</td></tr>
              ) : filteredEqGroups.map((group) => {
                const r = group.primary;
                const isBatch = group.items.length > 1;
                const isGroupExpanded = expandedEqGroups[group.key];
                return (
                <Fragment key={group.key}>
                <tr id={`row-equipment-${r.id}`} className={`border-b border-muted hover:bg-muted/30 transition-colors ${highlightId === `equipment-${r.id}` ? 'bg-primary/10 ring-2 ring-primary/40' : ''}`}>
                  <td className="px-4 py-3 font-semibold text-xs">
                    #EQ{String(r.id).padStart(5, '0')}
                    {isBatch && <span className="text-muted-foreground font-normal"> (+{group.items.length - 1})</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{r.researcher_name}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {r.members_list?.length > 0 ? (
                      <div className="space-y-1">
                        <button
                          onClick={() => toggleMembers(`eq-${r.id}`)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full hover:bg-primary/20 transition-colors cursor-pointer"
                        >
                          <Users className="w-3 h-3" />
                          {r.members_list.length} member{r.members_list.length > 1 ? 's' : ''}
                          {expandedMembers[`eq-${r.id}`] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {expandedMembers[`eq-${r.id}`] && (
                          <ol className="mt-1.5 space-y-0.5 pl-1">
                            {r.members_list.map((name, i) => (
                              <li key={i} className="text-xs text-foreground flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-muted-foreground w-4">{i + 1}.</span>
                                {name}
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">—</span>
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
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {isBatch ? (
                      <span className="text-muted-foreground italic">Multiple schedules</span>
                    ) : (
                      <>
                        {new Date(r.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}<br />
                        {new Date(r.start_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – {new Date(r.end_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={group.status} /></td>
                  <td className="px-4 py-3">
                    <RowActions
                      items={[
                        { label: 'Accept', icon: Check, success: true, hidden: group.status !== 'pending', onClick: () => approveEqGroup(group) },
                        { label: 'Reject', icon: X, destructive: true, hidden: group.status !== 'pending', onClick: () => setRejectingEqId(group.key) },
                        {
                          label: 'Messages',
                          icon: MessageSquare,
                          onClick: () => setMessagingItem({ type: 'equipment', id: r.id, label: `Equipment request #EQ${String(r.id).padStart(5, '0')}`, reason: r.rejection_reason }),
                        },
                      ]}
                    />
                  </td>
                </tr>
                {isBatch && isGroupExpanded && (
                  <tr className="bg-primary/5 border-b border-muted">
                    <td colSpan={7} className="px-6 py-3">
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
      )}

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