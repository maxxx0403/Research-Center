import { useState, useEffect, useMemo, Fragment } from 'react';
import { Check, X, Trash2, AlertCircle, FlaskConical, Package, Users, ChevronDown, ChevronUp, FileDown, MessageSquare } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { updateReservationApproval, updateReservationApprovalBatch } from '@/lib/reservationUtils';
import { downloadRequestForm, downloadLabBatchRequestForm } from '@/lib/generateRequestForm';
import { notifyReservationApproved, notifyReservationRejected } from '@/lib/notifications';
import ReservationMessagesPanel from '@/components/ReservationMessagesPanel';

const STATUS_PRIORITY = ['rejected', 'pending', 'reserved', 'in_use', 'completed', 'cancelled'];

// Groups rows that share a batch_id (i.e. were submitted together in one
// multi-lab or multi-equipment request) into a single logical entry, so the
// approval queue shows one ID/one row per submission instead of one row per
// laboratory/equipment item.
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
      mixedStatus: !sorted.every((it) => it.status === sorted[0].status),
    };
  });
};

const Reservations = () => {
  const { user } = useAuth();

  // Laboratory reservations state
  const [labItems, setLabItems] = useState([]);
  const [labSearch, setLabSearch] = useState('');
  const [labFilterStatus, setLabFilterStatus] = useState('');
  const [labLoading, setLabLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [expandedMembers, setExpandedMembers] = useState({});
  const [expandedEquipment, setExpandedEquipment] = useState({});
  const [expandedLabGroups, setExpandedLabGroups] = useState({});
  const [expandedEqGroups, setExpandedEqGroups] = useState({});

  // Equipment reservations state
  const [eqItems, setEqItems] = useState([]);
  const [eqSearch, setEqSearch] = useState('');
  const [eqFilterStatus, setEqFilterStatus] = useState('');
  const [eqLoading, setEqLoading] = useState(true);

  const [downloadingId, setDownloadingId] = useState(null);
  const [messagingItem, setMessagingItem] = useState(null);

  const fetchLabData = async () => {
    const { data } = await supabase
      .from('reservations')
      .select('id, user_id, researcher_name, email, phone, unit_college, adviser_name, study_title, stakeholder_type, status, approved_at, rejection_reason, start_datetime, end_datetime, members_list, batch_id, laboratories(lab_name, lab_code, floor), reservation_equipment(id, quantity_reserved, equipment(id, name, brand, model))')
      .order('created_at', { ascending: false });
    setLabItems(data || []);
    setLabLoading(false);
  };

  const fetchEqData = async () => {
    const { data } = await supabase
      .from('equipment_reservations')
      .select('id, user_id, researcher_name, email, purpose, quantity_reserved, start_datetime, end_datetime, status, rejection_reason, created_at, batch_id, members_list, equipment(name, brand, laboratories(lab_code, floor))')
      .order('created_at', { ascending: false });
    setEqItems(data || []);
    setEqLoading(false);
  };

  useEffect(() => { fetchLabData(); fetchEqData(); }, []);

  // Group rows submitted together (same batch_id) into one entry, then filter
  // on the group's representative fields so a multi-lab/multi-equipment
  // submission is searched/filtered — and shown — as a single row.
  const labGroups = useMemo(() => groupByBatch(labItems), [labItems]);
  const filteredLabGroups = labGroups.filter((g) => {
    const r = g.primary;
    const matchSearch = !labSearch || r.researcher_name.toLowerCase().includes(labSearch.toLowerCase()) || (r.email || '').toLowerCase().includes(labSearch.toLowerCase());
    const matchStatus = !labFilterStatus || g.items.some((it) => it.status === labFilterStatus);
    return matchSearch && matchStatus;
  });

  const eqGroups = useMemo(() => groupByBatch(eqItems), [eqItems]);
  const filteredEqGroups = eqGroups.filter((g) => {
    const r = g.primary;
    const matchSearch = !eqSearch || r.researcher_name.toLowerCase().includes(eqSearch.toLowerCase()) || g.items.some((it) => (it.equipment?.name || '').toLowerCase().includes(eqSearch.toLowerCase()));
    const matchStatus = !eqFilterStatus || g.items.some((it) => it.status === eqFilterStatus);
    return matchSearch && matchStatus;
  });

  // Lab actions
  const updateLabStatusBatch = async (ids, status) => {
    await supabase.from('reservations').update({ status }).in('id', ids);
    setLabItems((prev) => prev.map((r) => ids.includes(r.id) ? { ...r, status } : r));
  };

  const approveLabGroup = async (group) => {
    try {
      const ids = group.ids;
      const label = ids.length > 1
        ? `Reservation #RC${String(ids[0]).padStart(5, '0')} (${ids.length} laboratories)`
        : `Reservation #RC${String(ids[0]).padStart(5, '0')}`;
      if (ids.length > 1) {
        await updateReservationApprovalBatch(ids, 'reserved', user.id);
      } else {
        await updateReservationApproval(ids[0], 'reserved', user.id);
      }
      setLabItems((prev) => prev.map((r) => ids.includes(r.id) ? { ...r, status: 'reserved' } : r));
      if (group.primary?.user_id) {
        notifyReservationApproved({ userId: group.primary.user_id, label });
      }
    } catch (error) {
      console.error('Error approving reservation:', error);
      alert('Failed to approve reservation');
    }
  };

  const rejectLabGroup = async (group) => {
    try {
      const ids = group.ids;
      const label = ids.length > 1
        ? `Reservation #RC${String(ids[0]).padStart(5, '0')} (${ids.length} laboratories)`
        : `Reservation #RC${String(ids[0]).padStart(5, '0')}`;
      if (ids.length > 1) {
        await updateReservationApprovalBatch(ids, 'rejected', user.id, rejectionReason);
      } else {
        await updateReservationApproval(ids[0], 'rejected', user.id, rejectionReason);
      }
      setLabItems((prev) => prev.map((r) => ids.includes(r.id) ? { ...r, status: 'rejected', rejection_reason: rejectionReason || null } : r));
      if (group.primary?.user_id) {
        notifyReservationRejected({ userId: group.primary.user_id, label, reason: rejectionReason });
      }
      setRejectingId(null);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting reservation:', error);
      alert('Failed to reject reservation');
    }
  };

  const deleteLabGroup = async (group) => {
    const ids = group.ids;
    const label = ids.length > 1 ? `reservation #RC${String(ids[0]).padStart(5, '0')} (${ids.length} laboratories)` : `reservation #${ids[0]}`;
    if (!confirm(`Delete ${label}?`)) return;
    await supabase.from('reservations').delete().in('id', ids);
    setLabItems((prev) => prev.filter((r) => !ids.includes(r.id)));
  };

  const handleDownloadLabGroupForm = async (group) => {
    setDownloadingId(group.primary.id);
    try {
      if (group.items.length > 1) {
        await downloadLabBatchRequestForm(group.items);
      } else {
        await downloadRequestForm(group.primary);
      }
    } catch (error) {
      console.error('Error generating request form:', error);
      alert('Failed to generate the request form. Please try again.');
    }
    setDownloadingId(null);
  };

  // Equipment actions
  const [rejectingEqId, setRejectingEqId] = useState(null);
  const [rejectionEqReason, setRejectionEqReason] = useState('');

  const updateEqStatus = async (id, status) => {
    await supabase.from('equipment_reservations').update({ status }).eq('id', id);
    setEqItems((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
  };

  const approveEqGroup = async (group) => {
    const ids = group.ids;
    const label = ids.length > 1
      ? `Equipment request #EQ${String(ids[0]).padStart(5, '0')} (${ids.length} items)`
      : `Equipment request #EQ${String(ids[0]).padStart(5, '0')}`;
    await supabase.from('equipment_reservations').update({
      status: 'reserved',
      approved_by: user.id,
      approved_at: new Date().toISOString()
    }).in('id', ids);
    setEqItems((prev) => prev.map((r) => ids.includes(r.id) ? { ...r, status: 'reserved' } : r));
    if (group.primary?.user_id) {
      notifyReservationApproved({ userId: group.primary.user_id, label });
    }
  };

  const rejectEqGroup = async (group) => {
    const ids = group.ids;
    const label = ids.length > 1
      ? `Equipment request #EQ${String(ids[0]).padStart(5, '0')} (${ids.length} items)`
      : `Equipment request #EQ${String(ids[0]).padStart(5, '0')}`;
    await supabase.from('equipment_reservations').update({
      status: 'rejected',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      rejection_reason: rejectionEqReason || null
    }).in('id', ids);
    setEqItems((prev) => prev.map((r) => ids.includes(r.id) ? { ...r, status: 'rejected', rejection_reason: rejectionEqReason || null } : r));
    if (group.primary?.user_id) {
      notifyReservationRejected({ userId: group.primary.user_id, label, reason: rejectionEqReason });
    }
    setRejectingEqId(null);
    setRejectionEqReason('');
  };

  const updateEqStatusBatch = async (ids, status) => {
    await supabase.from('equipment_reservations').update({ status }).in('id', ids);
    setEqItems((prev) => prev.map((r) => ids.includes(r.id) ? { ...r, status } : r));
  };

  const deleteEqGroup = async (group) => {
    const ids = group.ids;
    const label = ids.length > 1 ? `equipment request #EQ${String(ids[0]).padStart(5, '0')} (${ids.length} items)` : `equipment reservation #${ids[0]}`;
    if (!confirm(`Delete ${label}?`)) return;
    await supabase.from('equipment_reservations').delete().in('id', ids);
    setEqItems((prev) => prev.filter((r) => !ids.includes(r.id)));
  };

  const toggleMembers = (id) => setExpandedMembers(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleEquipment = (id) => setExpandedEquipment(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleLabGroup = (key) => setExpandedLabGroups(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleEqGroup = (key) => setExpandedEqGroups(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-8">

      {/* ── LABORATORY RESERVATIONS ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-primary" />
          <h2 className="font-heading text-base font-bold text-foreground">Laboratory Reservations</h2>
        </div>

        {/* Lab search bar */}
        <div className="bg-card rounded-xl shadow-card p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Search</label>
              <input value={labSearch} onChange={(e) => setLabSearch(e.target.value)} placeholder="Name / email…" className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="min-w-[140px]">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Status</label>
              <select value={labFilterStatus} onChange={(e) => setLabFilterStatus(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground">
                <option value="">All</option>
                {['pending', 'reserved', 'in_use', 'completed', 'cancelled', 'rejected'].map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <button onClick={() => { setLabSearch(''); setLabFilterStatus(''); }} className="bg-muted text-muted-foreground border border-border px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:bg-border transition-colors">Reset</button>
          </div>
        </div>

        {/* Lab table */}
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
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Equipment</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Schedule</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {labLoading ? (
                  <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
                ) : filteredLabGroups.length ? filteredLabGroups.map((group) => {
                  const r = group.primary;
                  const isBatch = group.items.length > 1;
                  const isGroupExpanded = expandedLabGroups[group.key];
                  const totalEquipment = group.items.reduce((sum, it) => sum + (it.reservation_equipment?.length || 0), 0);
                  return (
                  <Fragment key={group.key}>
                  <tr className="border-b border-muted hover:bg-muted/30">
                    <td className="px-4 py-3 font-semibold text-xs">
                      #RC{String(r.id).padStart(5, '0')}
                      {isBatch && <span className="text-muted-foreground font-normal"> (+{group.items.length - 1})</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{r.researcher_name}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {r.members_list && r.members_list.length > 0 ? (
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
                          <div className="font-semibold">{r.laboratories?.lab_name}</div>
                          <div className="text-xs text-muted-foreground">{r.laboratories?.lab_code}</div>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isBatch ? (
                        totalEquipment > 0 ? (
                          <span className="text-xs text-muted-foreground italic">{totalEquipment} item{totalEquipment > 1 ? 's' : ''} — see breakdown</span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">—</span>
                        )
                      ) : r.reservation_equipment && r.reservation_equipment.length > 0 ? (
                        <div className="space-y-1">
                          <button
                            onClick={() => toggleEquipment(r.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full hover:bg-primary/20 transition-colors cursor-pointer"
                          >
                            <Package className="w-3 h-3" />
                            {r.reservation_equipment.length} item{r.reservation_equipment.length > 1 ? 's' : ''}
                            {expandedEquipment[r.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                          {expandedEquipment[r.id] && (
                            <div className="mt-1.5 space-y-1">
                              {r.reservation_equipment.map((re) => (
                                <div key={re.id} className="text-xs text-foreground flex items-center gap-1.5 bg-muted/40 rounded px-2 py-1">
                                  <Package className="w-3 h-3 text-primary flex-shrink-0" />
                                  <span className="font-medium">{re.equipment?.name}</span>
                                  {re.equipment?.brand && <span className="text-muted-foreground">{re.equipment.brand}</span>}
                                  <span className="ml-auto bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded text-[10px]">x{re.quantity_reserved}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">—</span>
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
                    <td className="px-4 py-3">
                      <StatusBadge status={group.status} />
                      {group.mixedStatus && <p className="text-[0.65rem] text-muted-foreground mt-1">Mixed — see breakdown</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap items-center">
                        {group.status === 'pending' ? (
                          <>
                            <button onClick={() => approveLabGroup(group)} className="bg-success text-success-foreground px-2 py-1 rounded text-xs font-semibold border-none cursor-pointer hover:brightness-110 inline-flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Accept
                            </button>
                            <button onClick={() => setRejectingId(group.key)} className="bg-destructive text-destructive-foreground px-2 py-1 rounded text-xs font-semibold border-none cursor-pointer hover:brightness-110 inline-flex items-center gap-1">
                              <X className="w-3.5 h-3.5" /> Reject
                            </button>
                          </>
                        ) : (
                          <select defaultValue={group.status} onChange={(e) => updateLabStatusBatch(group.ids, e.target.value)} className="px-2 py-1 border border-border rounded text-xs bg-card text-foreground">
                            {['reserved', 'in_use', 'completed', 'cancelled'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                          </select>
                        )}
                        {['reserved', 'in_use', 'completed'].includes(group.status) && (
                          <button
                            onClick={() => handleDownloadLabGroupForm(group)}
                            disabled={downloadingId === r.id}
                            className="bg-success/10 text-success border border-success/20 px-2 py-1 rounded text-xs font-semibold cursor-pointer hover:bg-success hover:text-success-foreground transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            <FileDown className="w-3.5 h-3.5" /> {downloadingId === r.id ? '…' : 'Form'}
                          </button>
                        )}
                        <button
                          onClick={() => setMessagingItem({ type: 'lab', id: r.id, label: `Reservation #RC${String(r.id).padStart(5, '0')}`, reason: r.rejection_reason })}
                          className="bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded text-xs font-semibold cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                          title="Messages"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteLabGroup(group)} className="bg-destructive text-destructive-foreground px-2 py-1 rounded text-xs font-semibold border-none cursor-pointer hover:brightness-110">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isBatch && isGroupExpanded && (
                    <tr key={`${group.key}-breakdown`} className="bg-primary/5 border-b border-primary/10">
                      <td colSpan={8} className="px-6 py-3">
                        <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <FlaskConical className="w-3.5 h-3.5" /> Laboratories in this Reservation
                        </p>
                        <div className="space-y-2">
                          {group.items.map((it) => (
                            <div key={it.id} className="bg-card border border-border rounded-lg px-3 py-2.5 text-xs">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <span className="font-semibold text-foreground">{it.laboratories?.lab_name}</span>{' '}
                                  <code className="bg-muted px-1 py-0.5 rounded text-[0.7rem]">{it.laboratories?.lab_code}</code>
                                  <span className="text-muted-foreground ml-2">
                                    {new Date(it.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                                    {new Date(it.start_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – {new Date(it.end_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                  </span>
                                </div>
                                <StatusBadge status={it.status} />
                              </div>
                              {it.reservation_equipment && it.reservation_equipment.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {it.reservation_equipment.map((re) => (
                                    <div key={re.id} className="bg-secondary/40 border border-border rounded px-2 py-1 text-[0.7rem] flex items-center gap-1.5">
                                      <span className="font-semibold text-foreground">{re.equipment?.name}</span>
                                      <span className="bg-primary/10 text-primary font-bold px-1 py-0.5 rounded">x{re.quantity_reserved}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  );
                }) : (
                  <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No reservations found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── EQUIPMENT RESERVATIONS ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          <h2 className="font-heading text-base font-bold text-foreground">Equipment Reservations</h2>
        </div>

        {/* Equipment search bar */}
        <div className="bg-card rounded-xl shadow-card p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Search</label>
              <input value={eqSearch} onChange={(e) => setEqSearch(e.target.value)} placeholder="Researcher or equipment…" className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="min-w-[140px]">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Status</label>
              <select value={eqFilterStatus} onChange={(e) => setEqFilterStatus(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground">
                <option value="">All</option>
                {['pending', 'reserved', 'in_use', 'completed', 'cancelled', 'rejected'].map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <button onClick={() => { setEqSearch(''); setEqFilterStatus(''); }} className="bg-muted text-muted-foreground border border-border px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:bg-border transition-colors">Reset</button>
          </div>
        </div>

        {/* Equipment table */}
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="font-heading text-sm font-bold">
              Equipment Reservations <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs ml-2">{filteredEqGroups.length}</span>
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
                {eqLoading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
                ) : filteredEqGroups.length ? filteredEqGroups.map((group) => {
                  const r = group.primary;
                  const isBatch = group.items.length > 1;
                  const isGroupExpanded = expandedEqGroups[group.key];
                  return (
                  <Fragment key={group.key}>
                  <tr className="border-b border-muted hover:bg-muted/30">
                    <td className="px-4 py-3 font-semibold text-xs">
                      #EQ{String(r.id).padStart(5, '0')}
                      {isBatch && <span className="text-muted-foreground font-normal"> (+{group.items.length - 1})</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{r.researcher_name}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {r.members_list && r.members_list.length > 0 ? (
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
                          <div className="font-semibold">{r.equipment?.name}</div>
                          <div className="text-xs text-muted-foreground">{r.equipment?.brand} · Qty: {r.quantity_reserved}</div>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {new Date(r.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}<br />
                      {new Date(r.start_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – {new Date(r.end_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={group.status} />
                      {group.mixedStatus && <p className="text-[0.65rem] text-muted-foreground mt-1">Mixed — see breakdown</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap items-center">
                        {group.status === 'pending' ? (
                          <>
                            <button onClick={() => approveEqGroup(group)} className="bg-success text-success-foreground px-2 py-1 rounded text-xs font-semibold border-none cursor-pointer hover:brightness-110 inline-flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Accept
                            </button>
                            <button onClick={() => setRejectingEqId(group.key)} className="bg-destructive text-destructive-foreground px-2 py-1 rounded text-xs font-semibold border-none cursor-pointer hover:brightness-110 inline-flex items-center gap-1">
                              <X className="w-3.5 h-3.5" /> Reject
                            </button>
                          </>
                        ) : (
                          <select defaultValue={group.status} onChange={(e) => updateEqStatusBatch(group.ids, e.target.value)} className="px-2 py-1 border border-border rounded text-xs bg-card text-foreground">
                            {['pending', 'reserved', 'in_use', 'completed', 'cancelled', 'rejected'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                          </select>
                        )}
                        <button
                          onClick={() => setMessagingItem({ type: 'equipment', id: r.id, label: `Equipment request #EQ${String(r.id).padStart(5, '0')}`, reason: r.rejection_reason })}
                          className="bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded text-xs font-semibold cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                          title="Messages"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteEqGroup(group)} className="bg-destructive text-destructive-foreground px-2 py-1 rounded text-xs font-semibold border-none cursor-pointer hover:brightness-110">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isBatch && isGroupExpanded && (
                    <tr key={`${group.key}-breakdown`} className="bg-primary/5 border-b border-primary/10">
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
                }) : (
                  <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No equipment reservations found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Rejection Reason Modal */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-lg p-6 max-w-md w-full">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-foreground">Reject Reservation</h3>
                {(() => {
                  const group = labGroups.find((g) => g.key === rejectingId);
                  if (!group) return null;
                  return (
                    <p className="text-sm text-muted-foreground">
                      #RC{String(group.primary.id).padStart(5, '0')}
                      {group.items.length > 1 && ` (${group.items.length} laboratories)`}
                    </p>
                  );
                })()}
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-foreground mb-2">Reason (Optional)</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Why is this reservation being rejected?"
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setRejectingId(null); setRejectionReason(''); }} className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-semibold cursor-pointer">
                Cancel
              </button>
              <button onClick={() => rejectLabGroup(labGroups.find((g) => g.key === rejectingId))} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold cursor-pointer hover:brightness-110">
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Equipment Rejection Modal */}
      {rejectingEqId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-lg p-6 max-w-md w-full">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-foreground">Reject Equipment Reservation</h3>
                {(() => {
                  const group = eqGroups.find((g) => g.key === rejectingEqId);
                  if (!group) return null;
                  return (
                    <p className="text-sm text-muted-foreground">
                      #EQ{String(group.primary.id).padStart(5, '0')}
                      {group.items.length > 1 && ` (${group.items.length} items)`}
                    </p>
                  );
                })()}
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-foreground mb-2">Reason (Optional)</label>
              <textarea
                value={rejectionEqReason}
                onChange={(e) => setRejectionEqReason(e.target.value)}
                placeholder="Why is this equipment reservation being rejected?"
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setRejectingEqId(null); setRejectionEqReason(''); }} className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-semibold cursor-pointer">
                Cancel
              </button>
              <button onClick={() => rejectEqGroup(eqGroups.find((g) => g.key === rejectingEqId))} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold cursor-pointer hover:brightness-110">
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {messagingItem && (
        <ReservationMessagesPanel
          reservationType={messagingItem.type}
          reservationId={messagingItem.id}
          label={messagingItem.label}
          rejectionReason={messagingItem.reason}
          onClose={() => setMessagingItem(null)}
        />
      )}
    </div>
  );
};

export default Reservations;