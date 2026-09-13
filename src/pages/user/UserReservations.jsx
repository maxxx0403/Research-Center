import { Fragment, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Edit2, Trash2, X, Check, ChevronDown, ChevronUp, Package, FlaskConical, FileDown, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/StatusBadge';
import {
  cancelReservation,
  updateReservation,
  resubmitReservation,
  resubmitEquipmentReservations,
  cancelReservationBatch,
} from '@/lib/reservationUtils';
import { downloadRequestForm, downloadLabBatchRequestForm, downloadEquipmentRequestForm } from '@/lib/generateRequestForm';
import ReservationMessagesPanel from '@/components/ReservationMessagesPanel';

// Statuses a reservation can still be edited/cancelled from.
const EDITABLE_STATUSES = ['pending', 'reserved', 'rejected'];
// Priority order used to pick one badge status to represent a batch of
// equipment rows that don't all share the same status (e.g. admin approved
// one item in the batch but rejected another).
const STATUS_PRIORITY = ['rejected', 'pending', 'reserved', 'in_use', 'completed', 'cancelled'];

const UserReservations = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [reservations, setReservations] = useState([]);
  const [eqReservations, setEqReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [expandedEquipment, setExpandedEquipment] = useState({});
  const [downloadingId, setDownloadingId] = useState(null);
  const [messagingItem, setMessagingItem] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [expandedEqGroups, setExpandedEqGroups] = useState({});
  const [expandedLabGroups, setExpandedLabGroups] = useState({});
  const [editingEqKey, setEditingEqKey] = useState(null);
  const [editEqData, setEditEqData] = useState({});
  const [savingEq, setSavingEq] = useState(false);
  const [downloadingEqKey, setDownloadingEqKey] = useState(null);

  // Group equipment reservation rows that were submitted together (same
  // batch_id) into a single line item, so a multi-equipment request shows
  // up as one entry with an expandable item list instead of N separate rows.
  const eqGroups = useMemo(() => {
    const groups = new Map();
    for (const r of eqReservations) {
      const key = r.batch_id ? `batch-${r.batch_id}` : `single-${r.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    return Array.from(groups.entries()).map(([key, items]) => {
      const sorted = [...items].sort((a, b) => a.id - b.id);
      const status = STATUS_PRIORITY.find((s) => sorted.some((it) => it.status === s)) || sorted[0].status;
      return {
        key,
        ids: sorted.map((it) => it.id),
        items: sorted,
        primary: sorted[0],
        status,
        mixedStatus: !sorted.every((it) => it.status === sorted[0].status),
        totalQuantity: sorted.reduce((sum, it) => sum + (it.quantity_reserved || 0), 0),
        rejectionReasons: [...new Set(sorted.filter((it) => it.rejection_reason).map((it) => it.rejection_reason))],
      };
    });
  }, [eqReservations]);

  // Group laboratory reservation rows that were submitted together (same
  // batch_id) into a single line item, so a multi-lab request shows up as
  // one entry with an expandable lab list instead of N separate rows.
  const labGroups = useMemo(() => {
    const groups = new Map();
    for (const r of reservations) {
      const key = r.batch_id ? `batch-${r.batch_id}` : `single-${r.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    return Array.from(groups.entries()).map(([key, items]) => {
      const sorted = [...items].sort((a, b) => a.id - b.id);
      const status = STATUS_PRIORITY.find((s) => sorted.some((it) => it.status === s)) || sorted[0].status;
      return {
        key,
        ids: sorted.map((it) => it.id),
        items: sorted,
        primary: sorted[0],
        status,
        mixedStatus: !sorted.every((it) => it.status === sorted[0].status),
        rejectionReasons: [...new Set(sorted.filter((it) => it.rejection_reason).map((it) => it.rejection_reason))],
      };
    });
  }, [reservations]);

  const fetchData = async () => {
    const [labRes, eqRes] = await Promise.all([
      supabase
        .from('reservations')
        .select('*, laboratories(lab_name, lab_code), reservation_equipment(id, quantity_reserved, equipment(id, name, brand, model))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('equipment_reservations')
        .select('*, equipment(id, name, brand, model, laboratories(lab_name, lab_code))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ]);
    setReservations(labRes.data || []);
    setEqReservations(eqRes.data || []);
    setLoading(false);
  };

  useEffect(() => { if (user) fetchData(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Coming from a notification click (?open=lab:12 or ?open=equipment:7):
  // open that reservation's message thread and scroll to/highlight its row.
  useEffect(() => {
    if (loading) return;
    const open = searchParams.get('open');
    if (!open) return;
    const [type, idStr] = open.split(':');
    const id = Number(idStr);
    const list = type === 'lab' ? reservations : eqReservations;
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
    // Clear the param so re-navigating doesn't keep re-triggering this.
    setSearchParams({}, { replace: true });
  }, [loading, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancelReservation = async (id) => {
    if (!confirm('Cancel this reservation?')) return;
    try {
      await cancelReservation(id);
      fetchData();
    } catch (error) {
      console.error('Error cancelling reservation:', error);
      alert('Failed to cancel reservation');
    }
  };

  const toggleLabGroup = (key) => {
    setExpandedLabGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCancelLabGroup = async (group) => {
    if (!confirm('Cancel this reservation?')) return;
    try {
      const cancellableIds = group.items.filter((it) => it.status === 'pending' || it.status === 'reserved').map((it) => it.id);
      await cancelReservationBatch(cancellableIds);
      fetchData();
    } catch (error) {
      console.error('Error cancelling reservation:', error);
      alert('Failed to cancel reservation');
    }
  };

  const handleDownloadLabGroupForm = async (group) => {
    setDownloadingId(group.primary.id);
    try {
      const eligible = group.items.filter((it) => ['reserved', 'in_use', 'completed'].includes(it.status));
      await downloadLabBatchRequestForm(eligible.length ? eligible : group.items);
    } catch (error) {
      console.error('Error generating request form:', error);
      alert('Failed to generate the request form. Please try again.');
    }
    setDownloadingId(null);
  };

  const handleCancelEqGroup = async (group) => {
    if (!confirm('Cancel this equipment reservation?')) return;
    try {
      const cancellableIds = group.items.filter((it) => it.status === 'pending' || it.status === 'reserved').map((it) => it.id);
      await supabase.from('equipment_reservations').update({ status: 'cancelled' }).in('id', cancellableIds);
      fetchData();
    } catch (error) {
      console.error('Error cancelling equipment reservation:', error);
      alert('Failed to cancel equipment reservation');
    }
  };

  const toggleEqGroup = (key) => {
    setExpandedEqGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const startEditEq = (group) => {
    setEditingEqKey(group.key);
    setEditEqData({
      start_datetime: group.primary.start_datetime,
      end_datetime: group.primary.end_datetime,
      purpose: group.primary.purpose,
      special_requirements: group.primary.special_requirements,
      wasRejected: group.status === 'rejected',
    });
  };

  const cancelEditEq = () => {
    setEditingEqKey(null);
    setEditEqData({});
  };

  const saveEditEq = async (group) => {
    setSavingEq(true);
    try {
      const { wasRejected, ...fields } = editEqData;
      // Only touch rows that are actually still editable — leave any
      // already-cancelled/in-use/completed items in a mixed batch alone.
      const targetIds = group.items.filter((it) => EDITABLE_STATUSES.includes(it.status)).map((it) => it.id);
      if (wasRejected) {
        await resubmitEquipmentReservations(targetIds, fields);
      } else {
        await supabase.from('equipment_reservations').update(fields).in('id', targetIds);
      }
      setEditingEqKey(null);
      setEditEqData({});
      fetchData();
    } catch (error) {
      console.error('Error updating equipment reservation:', error);
      alert('Failed to update equipment reservation');
    }
    setSavingEq(false);
  };

  const handleDownloadEqForm = async (group) => {
    setDownloadingEqKey(group.key);
    try {
      const eligible = group.items.filter((it) => ['reserved', 'in_use', 'completed'].includes(it.status));
      await downloadEquipmentRequestForm(eligible.length ? eligible : group.items);
    } catch (error) {
      console.error('Error generating equipment request form:', error);
      alert('Failed to generate the request form. Please try again.');
    }
    setDownloadingEqKey(null);
  };

  const startEdit = (reservation) => {
    setEditingId(reservation.id);
    setEditData({
      start_datetime: reservation.start_datetime,
      end_datetime: reservation.end_datetime,
      research_purpose: reservation.research_purpose,
      special_requirements: reservation.special_requirements,
      wasRejected: reservation.status === 'rejected',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = async (id) => {
    setSaving(true);
    try {
      const { wasRejected, ...fields } = editData;
      if (wasRejected) {
        // Editing a rejected reservation resubmits it for another review.
        await resubmitReservation(id, fields);
      } else {
        await updateReservation(id, fields);
      }
      setEditingId(null);
      setEditData({});
      fetchData();
    } catch (error) {
      console.error('Error updating reservation:', error);
      alert('Failed to update reservation');
    }
    setSaving(false);
  };

  const toggleEquipment = (id) => {
    setExpandedEquipment(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDownloadForm = async (reservation) => {
    setDownloadingId(reservation.id);
    try {
      await downloadRequestForm(reservation);
    } catch (error) {
      console.error('Error generating request form:', error);
      alert('Failed to generate the request form. Please try again.');
    }
    setDownloadingId(null);
  };

  return (
    <div className="space-y-6">
    <div className="bg-card rounded-xl shadow-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-2">
        <FlaskConical className="w-4 h-4 text-primary" />
        <h2 className="font-heading text-sm font-bold">My Lab Reservations <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs ml-2">{labGroups.length}</span></h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b-2 border-border">
              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">ID</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Laboratory</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Equipment</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Purpose</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Schedule</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
            ) : labGroups.length ? labGroups.map((group) => {
              const { primary } = group;
              const isBatch = group.items.length > 1;
              const isGroupExpanded = expandedLabGroups[group.key];
              // Single-lab reservations keep their own equipment toggle,
              // scoped by reservation id like before.
              const hasEquipment = !isBatch && primary.reservation_equipment && primary.reservation_equipment.length > 0;
              const isEquipExpanded = expandedEquipment[primary.id];
              return (
                <Fragment key={group.key}>
                  <tr id={`row-lab-${primary.id}`} className={`border-b border-muted hover:bg-muted/30 transition-colors ${highlightId === `lab-${primary.id}` ? 'bg-primary/10 ring-2 ring-primary/40' : ''}`}>
                    <td className="px-4 py-3 font-semibold text-xs">
                      #RC{String(primary.id).padStart(5, '0')}
                      {isBatch && <span className="text-muted-foreground font-normal"> (+{group.items.length - 1} more)</span>}
                    </td>
                    <td className="px-4 py-3">
                      {isBatch ? (
                        <button
                          onClick={() => toggleLabGroup(group.key)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full hover:bg-primary/20 transition-colors cursor-pointer"
                        >
                          <FlaskConical className="w-3 h-3" />
                          {group.items.length} laboratories
                          {isGroupExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      ) : (
                        <>
                          <div className="font-semibold">{primary.laboratories?.lab_name}</div>
                          <code className="text-[0.7rem] bg-muted px-1 py-0.5 rounded">{primary.laboratories?.lab_code}</code>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isBatch ? (
                        <span className="text-xs text-muted-foreground italic">See breakdown</span>
                      ) : hasEquipment ? (
                        <button
                          onClick={() => toggleEquipment(primary.id)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full hover:bg-primary/20 transition-colors cursor-pointer"
                        >
                          <Package className="w-3 h-3" />
                          {primary.reservation_equipment.length} item{primary.reservation_equipment.length > 1 ? 's' : ''}
                          {isEquipExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[200px]">{primary.research_purpose?.slice(0, 80)}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {isBatch ? (
                        <span className="text-muted-foreground italic">Multiple schedules</span>
                      ) : (
                        <>
                          {new Date(primary.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}<br />
                          {new Date(primary.start_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – {new Date(primary.end_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={group.status} />
                      {group.mixedStatus && <p className="text-[0.65rem] text-muted-foreground mt-1">Mixed — see breakdown</p>}
                      {group.rejectionReasons.length > 0 && (
                        <p className="text-[0.7rem] text-destructive mt-1 max-w-[160px]">{group.rejectionReasons.join('; ')}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 flex gap-2 flex-wrap">
                      {!isBatch && EDITABLE_STATUSES.includes(primary.status) && (
                        <button
                          onClick={() => startEdit(primary)}
                          className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded text-xs font-semibold cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors inline-flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" /> {primary.status === 'rejected' ? 'Edit & Resubmit' : 'Edit'}
                        </button>
                      )}
                      {(group.status === 'pending' || group.status === 'reserved') && (
                        <button
                          onClick={() => (isBatch ? handleCancelLabGroup(group) : handleCancelReservation(primary.id))}
                          className="bg-destructive/10 text-destructive border border-destructive/20 px-3 py-1 rounded text-xs font-semibold cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Cancel
                        </button>
                      )}
                      {['reserved', 'in_use', 'completed'].includes(group.status) && (
                        <button
                          onClick={() => (isBatch ? handleDownloadLabGroupForm(group) : handleDownloadForm(primary))}
                          disabled={downloadingId === primary.id}
                          className="bg-success/10 text-success border border-success/20 px-3 py-1 rounded text-xs font-semibold cursor-pointer hover:bg-success hover:text-success-foreground transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <FileDown className="w-3 h-3" /> {downloadingId === primary.id ? 'Preparing…' : 'Download Form'}
                        </button>
                      )}
                      <button
                        onClick={() => setMessagingItem({ type: 'lab', id: primary.id, label: `Reservation #RC${String(primary.id).padStart(5, '0')}`, reason: group.rejectionReasons[0] })}
                        className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-colors inline-flex items-center gap-1 ${group.status === 'rejected' ? 'bg-destructive text-destructive-foreground hover:brightness-110' : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground'}`}
                      >
                        <MessageSquare className="w-3 h-3" /> {group.status === 'rejected' ? 'Ask why' : 'Message'}
                      </button>
                    </td>
                  </tr>

                  {/* Batch breakdown: one lab per item, each with its own schedule, equipment, and edit control */}
                  {isBatch && isGroupExpanded && (
                    <tr key={`lab-items-${group.key}`} className="bg-primary/5 border-b border-primary/10">
                      <td colSpan={7} className="px-6 py-3">
                        <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <FlaskConical className="w-3.5 h-3.5" /> Laboratories in this Reservation
                        </p>
                        <div className="space-y-2">
                          {group.items.map((it) => {
                            const itHasEquipment = it.reservation_equipment && it.reservation_equipment.length > 0;
                            return (
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
                                  <div className="flex items-center gap-2">
                                    <StatusBadge status={it.status} />
                                    {EDITABLE_STATUSES.includes(it.status) && (
                                      <button
                                        onClick={() => startEdit(it)}
                                        className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded text-[0.7rem] font-semibold cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors inline-flex items-center gap-1"
                                      >
                                        <Edit2 className="w-3 h-3" /> {it.status === 'rejected' ? 'Edit & Resubmit' : 'Edit'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {itHasEquipment && (
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
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Equipment expand row (single-lab reservations only) */}
                  {!isBatch && hasEquipment && isEquipExpanded && (
                    <tr key={`eq-${primary.id}`} className="bg-primary/5 border-b border-primary/10">
                      <td colSpan={7} className="px-6 py-3">
                        <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5" /> Reserved Equipment
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {primary.reservation_equipment.map((re) => (
                            <div key={re.id} className="bg-card border border-border rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                              <span className="font-semibold text-foreground">{re.equipment?.name}</span>
                              {re.equipment?.brand && (
                                <span className="text-muted-foreground">{re.equipment.brand} {re.equipment.model}</span>
                              )}
                              <span className="bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">
                                x{re.quantity_reserved}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Edit modal row — applies to whichever single reservation row (batch item or standalone) is being edited */}
                  {group.items.some((it) => editingId === it.id) && (
                    <tr key={`edit-${group.key}`} className="bg-primary/5 border-2 border-primary">
                      <td colSpan={7} className="p-6">
                        <div className="space-y-4">
                          <h3 className="font-bold text-foreground">
                            {editData.wasRejected ? 'Edit & Resubmit' : 'Edit'} Reservation #{String(editingId).padStart(5, '0')}
                          </h3>
                          {editData.wasRejected && (
                            <p className="text-xs text-muted-foreground -mt-2">Saving will resend this reservation for approval.</p>
                          )}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-muted-foreground mb-1">Start Date & Time</label>
                              <input
                                type="datetime-local"
                                value={editData.start_datetime?.slice(0, 16)}
                                onChange={(e) => setEditData({ ...editData, start_datetime: e.target.value })}
                                className="w-full px-3 py-2 border border-border rounded text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-muted-foreground mb-1">End Date & Time</label>
                              <input
                                type="datetime-local"
                                value={editData.end_datetime?.slice(0, 16)}
                                onChange={(e) => setEditData({ ...editData, end_datetime: e.target.value })}
                                className="w-full px-3 py-2 border border-border rounded text-sm"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-semibold text-muted-foreground mb-1">Purpose</label>
                              <textarea
                                value={editData.research_purpose}
                                onChange={(e) => setEditData({ ...editData, research_purpose: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 border border-border rounded text-sm"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-semibold text-muted-foreground mb-1">Special Requirements</label>
                              <textarea
                                value={editData.special_requirements}
                                onChange={(e) => setEditData({ ...editData, special_requirements: e.target.value })}
                                rows={1}
                                className="w-full px-3 py-2 border border-border rounded text-sm"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={cancelEdit}
                              className="px-4 py-2 rounded border border-border hover:bg-muted text-sm font-semibold cursor-pointer inline-flex items-center gap-2"
                            >
                              <X className="w-4 h-4" /> Cancel
                            </button>
                            <button
                              onClick={() => saveEdit(editingId)}
                              disabled={saving}
                              className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-semibold cursor-pointer hover:bg-primary/90 inline-flex items-center gap-2 disabled:opacity-50"
                            >
                              <Check className="w-4 h-4" /> {saving ? 'Saving...' : editData.wasRejected ? 'Save & Resubmit' : 'Save Changes'}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            }) : (
              <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No reservations found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>

    {/* Equipment Reservations */}
    <div className="bg-card rounded-xl shadow-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-2">
        <Package className="w-4 h-4 text-primary" />
        <h2 className="font-heading text-sm font-bold">My Equipment Reservations <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs ml-2">{eqGroups.length}</span></h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b-2 border-border">
              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">ID</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Equipment</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Quantity</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Schedule</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
            ) : eqGroups.length ? eqGroups.map((group) => {
              const { primary } = group;
              const isBatch = group.items.length > 1;
              const isExpanded = expandedEqGroups[group.key];
              return (
                <Fragment key={group.key}>
                  <tr id={`row-equipment-${primary.id}`} className={`border-b border-muted hover:bg-muted/30 transition-colors ${highlightId === `equipment-${primary.id}` ? 'bg-primary/10 ring-2 ring-primary/40' : ''}`}>
                    <td className="px-4 py-3 font-semibold text-xs">
                      #EQ{String(primary.id).padStart(5, '0')}
                      {isBatch && <span className="text-muted-foreground font-normal"> (+{group.items.length - 1} more)</span>}
                    </td>
                    <td className="px-4 py-3">
                      {isBatch ? (
                        <button
                          onClick={() => toggleEqGroup(group.key)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full hover:bg-primary/20 transition-colors cursor-pointer"
                        >
                          <Package className="w-3 h-3" />
                          {group.items.length} items
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      ) : (
                        <>
                          <div className="font-semibold">{primary.equipment?.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {primary.equipment?.brand && <span>{primary.equipment.brand} </span>}
                            <code className="bg-muted px-1 py-0.5 rounded text-[0.7rem]">{primary.equipment?.laboratories?.lab_code}</code>
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">x{group.totalQuantity}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {new Date(primary.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}<br />
                      {new Date(primary.start_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – {new Date(primary.end_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={group.status} />
                      {group.mixedStatus && <p className="text-[0.65rem] text-muted-foreground mt-1">Mixed — see items</p>}
                      {group.rejectionReasons.length > 0 && (
                        <p className="text-[0.7rem] text-destructive mt-1 max-w-[160px]">{group.rejectionReasons.join('; ')}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 flex gap-2 flex-wrap">
                      {EDITABLE_STATUSES.includes(group.status) && (
                        <button
                          onClick={() => startEditEq(group)}
                          className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded text-xs font-semibold cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors inline-flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" /> {group.status === 'rejected' ? 'Edit & Resubmit' : 'Edit'}
                        </button>
                      )}
                      {(group.status === 'pending' || group.status === 'reserved') && (
                        <button
                          onClick={() => handleCancelEqGroup(group)}
                          className="bg-destructive/10 text-destructive border border-destructive/20 px-3 py-1 rounded text-xs font-semibold cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Cancel
                        </button>
                      )}
                      {['reserved', 'in_use', 'completed'].includes(group.status) && (
                        <button
                          onClick={() => handleDownloadEqForm(group)}
                          disabled={downloadingEqKey === group.key}
                          className="bg-success/10 text-success border border-success/20 px-3 py-1 rounded text-xs font-semibold cursor-pointer hover:bg-success hover:text-success-foreground transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <FileDown className="w-3 h-3" /> {downloadingEqKey === group.key ? 'Preparing…' : 'Download Form'}
                        </button>
                      )}
                      <button
                        onClick={() => setMessagingItem({ type: 'equipment', id: primary.id, label: `Equipment request #EQ${String(primary.id).padStart(5, '0')}`, reason: group.rejectionReasons[0] })}
                        className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-colors inline-flex items-center gap-1 ${group.status === 'rejected' ? 'bg-destructive text-destructive-foreground hover:brightness-110' : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground'}`}
                      >
                        <MessageSquare className="w-3 h-3" /> {group.status === 'rejected' ? 'Ask why' : 'Message'}
                      </button>
                    </td>
                  </tr>

                  {/* Batch item breakdown */}
                  {isBatch && isExpanded && (
                    <tr key={`eq-items-${group.key}`} className="bg-primary/5 border-b border-primary/10">
                      <td colSpan={6} className="px-6 py-3">
                        <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5" /> Reserved Equipment
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {group.items.map((it) => (
                            <div key={it.id} className="bg-card border border-border rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                              <span className="font-semibold text-foreground">{it.equipment?.name}</span>
                              {it.equipment?.brand && (
                                <span className="text-muted-foreground">{it.equipment.brand} {it.equipment.model}</span>
                              )}
                              <span className="bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">
                                x{it.quantity_reserved}
                              </span>
                              <StatusBadge status={it.status} />
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Edit modal row */}
                  {editingEqKey === group.key && (
                    <tr key={`edit-eq-${group.key}`} className="bg-primary/5 border-2 border-primary">
                      <td colSpan={6} className="p-6">
                        <div className="space-y-4">
                          <h3 className="font-bold text-foreground">
                            {editEqData.wasRejected ? 'Edit & Resubmit' : 'Edit'} Equipment Request #EQ{String(primary.id).padStart(5, '0')}
                          </h3>
                          {editEqData.wasRejected && (
                            <p className="text-xs text-muted-foreground -mt-2">Saving will resend this request for approval.</p>
                          )}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-muted-foreground mb-1">Start Date & Time</label>
                              <input
                                type="datetime-local"
                                value={editEqData.start_datetime?.slice(0, 16)}
                                onChange={(e) => setEditEqData({ ...editEqData, start_datetime: e.target.value })}
                                className="w-full px-3 py-2 border border-border rounded text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-muted-foreground mb-1">End Date & Time</label>
                              <input
                                type="datetime-local"
                                value={editEqData.end_datetime?.slice(0, 16)}
                                onChange={(e) => setEditEqData({ ...editEqData, end_datetime: e.target.value })}
                                className="w-full px-3 py-2 border border-border rounded text-sm"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-semibold text-muted-foreground mb-1">Purpose</label>
                              <textarea
                                value={editEqData.purpose}
                                onChange={(e) => setEditEqData({ ...editEqData, purpose: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 border border-border rounded text-sm"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-semibold text-muted-foreground mb-1">Special Requirements</label>
                              <textarea
                                value={editEqData.special_requirements}
                                onChange={(e) => setEditEqData({ ...editEqData, special_requirements: e.target.value })}
                                rows={1}
                                className="w-full px-3 py-2 border border-border rounded text-sm"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={cancelEditEq}
                              className="px-4 py-2 rounded border border-border hover:bg-muted text-sm font-semibold cursor-pointer inline-flex items-center gap-2"
                            >
                              <X className="w-4 h-4" /> Cancel
                            </button>
                            <button
                              onClick={() => saveEditEq(group)}
                              disabled={savingEq}
                              className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-semibold cursor-pointer hover:bg-primary/90 inline-flex items-center gap-2 disabled:opacity-50"
                            >
                              <Check className="w-4 h-4" /> {savingEq ? 'Saving...' : editEqData.wasRejected ? 'Save & Resubmit' : 'Save Changes'}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            }) : (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No equipment reservations found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>

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

export default UserReservations;