import { useState, useEffect, useMemo, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Users, Check, X, MessageSquare, FlaskConical, Package, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Download, Printer, RefreshCw, PackageCheck, PackageOpen } from 'lucide-react';
import StatusBadge, { BorrowInfo } from '@/components/StatusBadge';
import { ReturnEquipmentDialog } from '@/components/FormSelect';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { notifyReservationApproved, notifyReservationRejected, notifyReservationCancelled, notifyReservationStatusChanged } from '@/lib/notifications';
import { cancelReservationItems, releaseEquipment, returnEquipment, releasableRows, returnableRows, isLabConflictError, LAB_CONFLICT_MESSAGE, fetchSupersededRequests, labSeatCheck } from '@/lib/reservationUtils';
import { sendReservationEmail } from '@/lib/reservationEmail';
import ReservationMessagesPanel from '@/components/ReservationMessagesPanel';
import { logReservationAction } from '@/lib/activityLog';
import RowActions, { ItemCancelControls, SelectedCancelBar, useCancelSelection } from '@/components/RowActions';
import { downloadReservationsExcel, printReservations } from '@/lib/exportReservations';
import ReservationMonthFilter from '@/components/ReservationMonthFilter';
import { isInMonth, monthLabel, monthRangeISO } from '@/lib/monthRange';
import { matchesStakeholderGroup, stakeholderTypesOf, stakeholderGroupLabel } from '@/lib/stakeholder';

// Rows of a multi-reservation that staff can still cancel one by one.
const CANCELLABLE_ITEM_STATUSES = ['pending', 'reserved', 'in_use'];
const STATUS_PRIORITY = ['rejected', 'pending', 'reserved', 'in_use', 'completed', 'cancelled'];
const RESERVATIONS_PER_PAGE = 15;

const ReservationsPagination = ({ count, page, onPageChange }) => {
  if (!count) return null;
  const pageCount = Math.ceil(count / RESERVATIONS_PER_PAGE);
  const start = (page - 1) * RESERVATIONS_PER_PAGE;
  return (
    <div className="px-4 sm:px-6 py-3 border-t border-border flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">
        Showing {start + 1}–{Math.min(start + RESERVATIONS_PER_PAGE, count)} of {count}
      </span>
      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-border bg-card text-foreground font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <span className="text-muted-foreground">{page} / {pageCount}</span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(pageCount, page + 1))}
            disabled={page === pageCount}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-border bg-card text-foreground font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

// A submission (batch) is shown under a month when any of its items is scheduled in that month.
const groupInMonth = (g, month) => !month || g.items.some((it) => isInMonth(it.start_datetime, month));
// ...and under a stakeholder group (All / CvSU / Non-CvSU) when any of its items belongs to it.
const groupInStakeholder = (g, group) => group === 'all' || g.items.some((it) => matchesStakeholderGroup(it.stakeholder_type, group));

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
      // Rows still in play: bulk approve/reject/status changes skip rows that were cancelled one by one
      // (unless every row is cancelled).
      activeIds: (sorted.some((it) => it.status !== 'cancelled') ? sorted.filter((it) => it.status !== 'cancelled') : sorted).map((it) => it.id),
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
  const [tab, setTab] = useState('lab');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  // "YYYY-MM" (by scheduled date) or '' for all months. Also decides what Export Excel and Print contain.
  const [month, setMonth] = useState('');
  const [stakeholder, setStakeholder] = useState('all'); // 'all' | 'cvsu' | 'non_cvsu'
  const [page, setPage] = useState(1);
  const [expandedMembers, setExpandedMembers] = useState({});
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectingEqId, setRejectingEqId] = useState(null);
  const [rejectionEqReason, setRejectionEqReason] = useState('');
  const [messagingItem, setMessagingItem] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [expandedLabGroups, setExpandedLabGroups] = useState({});
  const cancelSel = useCancelSelection();
  const [cancellingItems, setCancellingItems] = useState(false);
  const [expandedEqGroups, setExpandedEqGroups] = useState({});

  const [exportingFile, setExportingFile] = useState(''); // '' | 'excel' | 'print'

  // Exports (Excel) or prints this staff member's reservations (assigned rooms) of the current tab, with the selected date + stakeholder filters.
  const handleExport = async (mode) => {
    setExportingFile(mode);
    try {
      const range = month ? monthRangeISO(month) : null;
      const stakeholderTypes = stakeholderTypesOf(stakeholder);
      const withMonth = (q) => {
        let out = range ? q.gte('start_datetime', range.startISO).lt('start_datetime', range.endISO) : q;
        if (stakeholderTypes) out = out.in('stakeholder_type', stakeholderTypes); // same CvSU / Non-CvSU filter as the list
        return out;
      };
      const [{ data: labData, error: labErr }, { data: eqData, error: eqErr }] = await Promise.all([
        withMonth(supabase
          .from('reservations')
          .select('id, laboratory_id, researcher_name, email, phone, unit_college, adviser_name, study_title, stakeholder_type, status, approved_at, rejection_reason, start_datetime, end_datetime, members_list, batch_id, created_at, laboratories(id, lab_name, lab_code, floor, max_capacity), reservation_equipment(id, quantity_reserved, equipment(id, name, brand, model))')
          .order('created_at', { ascending: false })),
        withMonth(supabase
          .from('equipment_reservations')
          .select('id, researcher_name, email, purpose, stakeholder_type, quantity_reserved, start_datetime, end_datetime, status, rejection_reason, created_at, batch_id, members_list, released_at, released_by_name, returned_at, returned_by_name, return_condition, return_notes, equipment(name, brand, model, laboratory_id, laboratories(id, lab_code, floor))')
          .order('created_at', { ascending: false })),
      ]);
      if (labErr || eqErr) throw labErr || eqErr;

      const ids = new Set((assignedRoomIds || []).map((id) => String(id)));
      const labScoped = ids.size
        ? (labData || []).filter((r) => ids.has(String(r.laboratory_id ?? r.laboratories?.id)))
        : (labData || []);
      const eqScoped = ids.size
        ? (eqData || []).filter((r) => r.equipment?.laboratory_id != null && ids.has(String(r.equipment.laboratory_id)))
        : (eqData || []);

      const type = tab === 'lab' ? 'lab' : 'equipment';
      if (!(type === 'lab' ? labScoped : eqScoped).length) {
        toast.info(`There are no ${type === 'lab' ? 'laboratory' : 'equipment'} reservations to export for the selected filters.`);
        return;
      }
      const opts = { type, month, stakeholder };
      if (mode === 'print') printReservations(labScoped, eqScoped, opts);
      else await downloadReservationsExcel(labScoped, eqScoped, opts);
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Could not export reservations. Please try again.');
    } finally {
      setExportingFile('');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [labRes, eqRes] = await Promise.all([
        supabase
          .from('reservations')
          .select('id, user_id, researcher_name, email, phone, stakeholder_type, start_datetime, end_datetime, status, rejection_reason, members_list, laboratory_id, batch_id, created_at, laboratories(id, lab_name, lab_code, floor, max_capacity)')
          .order('created_at', { ascending: false }),
        supabase
          .from('equipment_reservations')
          .select('id, user_id, researcher_name, email, stakeholder_type, quantity_reserved, start_datetime, end_datetime, status, rejection_reason, batch_id, members_list, released_at, released_by_name, returned_at, returned_by_name, return_condition, return_notes, created_at, equipment(name, brand, model, laboratory_id, laboratories(id, lab_code, floor))')
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
      const groups = groupByBatch(list);
      const groupIndex = groups.findIndex((group) => group.ids.includes(id));
      const label = type === 'lab' ? `Reservation #RC${String(id).padStart(5, '0')}` : `Equipment request #EQ${String(id).padStart(5, '0')}`;
      setMessagingItem({ type, id, label, reason: item.rejection_reason });
      setHighlightId(`${type}-${id}`);
      setTab(type === 'lab' ? 'lab' : 'equipment');
      setSearch('');
      setStatusFilter('');
      setMonth('');
      setStakeholder('all');
      setPage(Math.floor(Math.max(groupIndex, 0) / RESERVATIONS_PER_PAGE) + 1);
      setTimeout(() => {
        document.getElementById(`row-${type}-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      setTimeout(() => setHighlightId(null), 3000);
    }
    setSearchParams({}, { replace: true });
  }, [loading, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const labGroups = useMemo(() => groupByBatch(labItems), [labItems]);
  const filteredLabGroups = labGroups.filter((g) => {
    if (!groupInMonth(g, month) || !groupInStakeholder(g, stakeholder)) return false;
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
    if (!groupInMonth(g, month) || !groupInStakeholder(g, stakeholder)) return false;
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
  const pageCount = Math.max(1, Math.ceil((tab === 'lab' ? filteredLabGroups : filteredEqGroups).length / RESERVATIONS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * RESERVATIONS_PER_PAGE;
  const paginatedLabGroups = filteredLabGroups.slice(pageStart, pageStart + RESERVATIONS_PER_PAGE);
  const paginatedEqGroups = filteredEqGroups.slice(pageStart, pageStart + RESERVATIONS_PER_PAGE);

  const fmt = (d) => new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  const toggleMembers = (id) => setExpandedMembers((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleLabGroup = (key) => setExpandedLabGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleEqGroup = (key) => setExpandedEqGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const approveLabGroup = async (group) => {
    const ids = group.activeIds;
    const label = ids.length > 1 ? `Reservation #RC${String(ids[0]).padStart(5, '0')} (${ids.length} laboratories)` : `Reservation #RC${String(ids[0]).padStart(5, '0')}`;
    const { error } = await supabase.from('reservations').update({
      status: 'reserved',
      approved_by: user.id,
      approved_at: new Date().toISOString()
    }).in('id', ids);
    if (error) { toast.error(isLabConflictError(error) ? LAB_CONFLICT_MESSAGE : 'Failed to approve: ' + error.message); return; }
    setLabItems((prev) => prev.map((r) => ids.includes(r.id) ? { ...r, status: 'reserved' } : r));
    logReservationAction({ userId: user.id, type: 'lab', verb: 'Accepted', items: group.items });
    if (group.primary?.user_id) notifyReservationApproved({ userId: group.primary.user_id, label, reservationType: 'lab', reservationId: ids[0] });
    sendReservationEmail({ event: 'approved', reservationType: 'lab', ids });
    // Competing requests for the same lab and time were rejected by the database
    // (with alternative schedules + a notification). Show it here and e-mail them.
    const superseded = await fetchSupersededRequests(ids);
    if (superseded.length) {
      const byId = new Map(superseded.map((r) => [r.id, r]));
      setLabItems((prev) => prev.map((r) => (byId.has(r.id) ? { ...r, ...byId.get(r.id) } : r)));
      sendReservationEmail({ event: 'rejected', reservationType: 'lab', ids: superseded.map((r) => r.id) });
      toast.success(`Approved. ${superseded.length} competing request${superseded.length === 1 ? ' was' : 's were'} rejected automatically and notified with other available schedules.`);
    } else {
      toast.success('Reservation approved.');
    }
  };

  const rejectLab = async () => {
    if (!rejectingId) return;
    const group = labGroups.find((g) => g.key === rejectingId);
    if (!group) return;
    const ids = group.activeIds;
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
    sendReservationEmail({ event: 'rejected', reservationType: 'lab', ids });
    setRejectingId(null);
    setRejectionReason('');
  };

  // ---- Equipment borrowing: Release -> Return --------------------------------
  const [returningGroup, setReturningGroup] = useState(null);
  const [borrowBusy, setBorrowBusy] = useState(false);
  const actor = { id: user?.id, name: user?.user_metadata?.full_name || user?.email || 'Staff' };

  const releaseEqGroup = async (group) => {
    const rows = releasableRows(group.items);
    if (!rows.length) { toast.error('Nothing to release yet: only approved equipment for today (or earlier) can be released.'); return; }
    setBorrowBusy(true);
    const { data, error } = await releaseEquipment(rows, actor);
    setBorrowBusy(false);
    if (error) { toast.error(`Could not release: ${error.message}`); return; }
    const ids = rows.map((r) => r.id);
    setEqItems((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, ...data } : r)));
    logReservationAction({ userId: user.id, type: 'equipment', verb: 'Released', items: rows });
    toast.success(`Released ${rows.length} item${rows.length === 1 ? '' : 's'}. The borrower was notified.`);
  };

  const confirmReturn = async ({ condition, notes }) => {
    const rows = returnableRows(returningGroup?.items || []);
    if (!rows.length) { setReturningGroup(null); return; }
    setBorrowBusy(true);
    const { data, error } = await returnEquipment(rows, actor, { condition, notes });
    setBorrowBusy(false);
    if (error) { toast.error(`Could not save the return: ${error.message}`); return; }
    const ids = rows.map((r) => r.id);
    setEqItems((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, ...data } : r)));
    logReservationAction({ userId: user.id, type: 'equipment', verb: `Returned (${condition})`, items: rows });
    setReturningGroup(null);
    toast.success('Return recorded. The borrower was notified.');
  };

  const approveEqGroup = async (group) => {
    const ids = group.activeIds;
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
    sendReservationEmail({ event: 'approved', reservationType: 'equipment', ids });
  };

  const rejectEq = async () => {
    if (!rejectingEqId) return;
    const group = eqGroups.find((g) => g.key === rejectingEqId);
    if (!group) return;
    const ids = group.activeIds;
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
    sendReservationEmail({ event: 'rejected', reservationType: 'equipment', ids });
    setRejectingEqId(null);
    setRejectionEqReason('');
  };

  // Cancel only the chosen labs/days (type 'lab') or equipment items (type 'equipment')
  // of a multi-reservation; the other rows keep their status.
  const handleCancelItems = async (type, group, ids) => {
    const items = group.items.filter((it) => ids.includes(it.id) && CANCELLABLE_ITEM_STATUSES.includes(it.status));
    if (!items.length) return;
    const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' });
    const describeItem = (it) => (type === 'lab'
      ? `${it.laboratories?.lab_name || 'Laboratory'} — ${fmtDay(it.start_datetime)}`
      : `${it.equipment?.name || 'Equipment'} x${it.quantity_reserved}`);
    const stillActive = group.items.filter((it) => !ids.includes(it.id) && ['pending', 'reserved', 'in_use'].includes(it.status)).length;
    const note = stillActive === 0 ? '\n\nThis will cancel the whole reservation.' : `\n\nThe other ${stillActive} will stay.`;
    if (!confirm(`Cancel ${items.length === 1 ? 'this' : `these ${items.length}`}?\n\n${items.map((it) => `• ${describeItem(it)}`).join('\n')}${note}`)) return;
    setCancellingItems(true);
    try {
      const done = await cancelReservationItems(type === 'lab' ? 'reservations' : 'equipment_reservations', items.map((it) => it.id), CANCELLABLE_ITEM_STATUSES);
      const doneIds = done.map((r) => r.id);
      if (!doneIds.length) { toast.error('Nothing was cancelled. The status may have changed — please refresh.'); setCancellingItems(false); return; }
      const cancelledItems = group.items.filter((it) => doneIds.includes(it.id));
      (type === 'lab' ? setLabItems : setEqItems)((prev) => prev.map((item) => (doneIds.includes(item.id) ? { ...item, status: 'cancelled' } : item)));
      cancelSel.clear(group.key);
      logReservationAction({
        userId: user.id,
        type,
        verb: 'Cancelled',
        items: cancelledItems,
        note: cancelledItems.map(describeItem).join(', '),
      });
      if (group.primary?.user_id) {
        notifyReservationCancelled({
          userId: group.primary.user_id,
          label: type === 'equipment' ? `Equipment request #EQ${String(group.primary.id).padStart(5, '0')}` : `Reservation #RC${String(group.primary.id).padStart(5, '0')}`,
          detail: cancelledItems.map(describeItem).join(', '),
          reservationType: type,
          reservationId: group.primary.id,
        });
      }
      toast.success(cancelledItems.length === 1 ? 'Cancelled 1 item.' : `Cancelled ${cancelledItems.length} items.`);
    } catch (error) {
      console.error('Error cancelling selected items:', error);
      toast.error('Failed to cancel: ' + (error?.message || 'please try again.'));
    }
    setCancellingItems(false);
  };

  const changeLabStatus = async (group, status) => {
    const { error } = await supabase.from('reservations').update({ status }).in('id', group.activeIds);
    if (error) {
      toast.error(isLabConflictError(error) ? LAB_CONFLICT_MESSAGE : `Failed to update reservation status: ${error.message}`);
      return;
    }
    if (group.primary?.user_id) notifyReservationStatusChanged({ userId: group.primary.user_id, label: `Reservation #RC${String(group.activeIds[0]).padStart(5, '0')}`, status, reservationType: 'lab', reservationId: group.activeIds[0] });
    setLabItems((prev) => prev.map((item) => group.activeIds.includes(item.id) ? { ...item, status } : item));
    logReservationAction({
      userId: user.id,
      type: 'lab',
      verb: `Marked ${status.replace('_', ' ')}:`,
      items: group.items,
    });
    toast.success(`Reservation status updated to ${status.replace('_', ' ')}.`);
  };

  const changeEquipmentStatus = async (group, status) => {
    const { error } = await supabase.from('equipment_reservations').update({ status }).in('id', group.activeIds);
    if (error) {
      toast.error(`Failed to update equipment reservation status: ${error.message}`);
      return;
    }
    if (group.primary?.user_id) notifyReservationStatusChanged({ userId: group.primary.user_id, label: `Equipment request #EQ${String(group.activeIds[0]).padStart(5, '0')}`, status, reservationType: 'equipment', reservationId: group.activeIds[0] });
    setEqItems((prev) => prev.map((item) => group.activeIds.includes(item.id) ? { ...item, status } : item));
    logReservationAction({
      userId: user.id,
      type: 'equipment',
      verb: `Marked ${status.replace('_', ' ')}:`,
      items: group.items,
    });
    toast.success(`Equipment reservation status updated to ${status.replace('_', ' ')}.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border">
        <div className="flex gap-1">
          {[
            { key: 'lab', label: 'Laboratories', icon: FlaskConical, count: filteredLabGroups.length },
            { key: 'equipment', label: 'Equipment', icon: Package, count: filteredEqGroups.length },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => { setTab(t.key); setPage(1); }}
              className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 flex-1 sm:flex-none min-w-0 py-2.5 text-sm font-semibold bg-transparent border-t-0 border-x-0 border-b-2 -mb-px cursor-pointer transition-colors ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${tab === t.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
        <ReservationMonthFilter
          value={month}
          onChange={(value) => { setMonth(value); setPage(1); }}
          stakeholder={stakeholder}
          onStakeholderChange={(value) => { setStakeholder(value); setPage(1); }}
        />
        </div>
      </div>

      {/* Export / print the list (current tab + current filters) */}
      <div className="flex flex-wrap items-center justify-between gap-3 -mt-2">
        {month || stakeholder !== 'all' ? (
          <p className="text-xs text-muted-foreground flex-1 min-w-[220px]">
            Showing reservations
            {month && <> scheduled in <span className="font-semibold text-foreground">{monthLabel(month)}</span></>}
            {stakeholder !== 'all' && <> from <span className="font-semibold text-foreground">{stakeholderGroupLabel(stakeholder)}</span> stakeholders</>}
            . Export Excel and Print use the same filter and the tab you are viewing.
          </p>
        ) : <span />}
        <div className="flex flex-wrap items-center justify-end gap-2 ml-auto">
          <input
            aria-label="Search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name / email…"
            className="w-48 sm:w-60 px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary"
          />
          <select
            aria-label="Status"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground"
          >
            <option value="">All status</option>
            {['pending', 'reserved', 'in_use', 'completed', 'cancelled', 'rejected'].map((st) => (
              <option key={st} value={st}>{st.replace('_', ' ')}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => handleExport('excel')}
            disabled={!!exportingFile || loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            <Download className="w-4 h-4" />
            {exportingFile === 'excel' ? 'Exporting…' : 'Export Excel'}
          </button>
          <button
            type="button"
            onClick={() => handleExport('print')}
            disabled={!!exportingFile || loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-border bg-card text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Printer className="w-4 h-4" />
            {exportingFile === 'print' ? 'Preparing…' : 'Print'}
          </button>
        </div>
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
              ) : paginatedLabGroups.map((group) => {
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
                  <td className="px-4 py-3">
                    <StatusBadge status={group.status} />
                    {group.status === 'pending' && (() => {
                      // Groups share a lab while people fit in its capacity: warn only when they do not all fit.
                      const checks = group.items.map((it) => labSeatCheck(it, labItems));
                      const full = checks.find((c) => !c.fitsNow);
                      const clash = checks.find((c) => c.rivals.length && !c.allFit);
                      const rivals = new Set(checks.flatMap((c) => c.rivals).map((o) => o.batch_id || o.id));
                      if (full) {
                        return (
                          <p className="mt-1 inline-flex items-center gap-1 text-[0.65rem] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full" title="Approving is blocked: the approved groups + this group are over the laboratory capacity.">
                            ⛔ Lab full{full.capacity ? ` (${full.approvedPeople}/${full.capacity} seats taken, needs ${full.people})` : ''}
                          </p>
                        );
                      }
                      return clash && (
                        <p className="mt-1 inline-flex items-center gap-1 text-[0.65rem] font-bold text-warning bg-warning/10 px-2 py-0.5 rounded-full" title="Other pending requests want the same laboratory and time and not all of them fit. Approving one rejects the ones that no longer fit, automatically.">
                          ⚠ {rivals.size} competing request{rivals.size === 1 ? '' : 's'}{clash.capacity ? ` · ${clash.approvedPeople + clash.people + clash.rivalsPeople}/${clash.capacity} seats` : ''}
                        </p>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      items={[
                        { label: 'Accept', icon: Check, success: true, hidden: group.status !== 'pending', onClick: () => approveLabGroup(group) },
                        { label: 'Reject', icon: X, destructive: true, hidden: group.status !== 'pending', onClick: () => setRejectingId(group.key) },
                        {
                          label: 'Change status',
                          icon: RefreshCw,
                          hidden: group.status === 'pending',
                          value: group.status,
                          options: ['reserved', 'in_use', 'completed', 'cancelled'].map((status) => ({
                            value: status,
                            label: status.replace('_', ' ').replace(/^\w/, (letter) => letter.toUpperCase()),
                          })),
                          onChange: (status) => changeLabStatus(group, status),
                        },
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
                      <SelectedCancelBar
                        count={cancelSel.get(group.key).length}
                        disabled={cancellingItems}
                        onClear={() => cancelSel.clear(group.key)}
                        onCancel={() => handleCancelItems('lab', group, cancelSel.get(group.key))}
                      />
                      <div className="space-y-2">
                        {group.items.map((it) => (
                          <div key={it.id} className="bg-card border border-border rounded-lg px-3 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="font-semibold text-foreground">{it.laboratories?.lab_name}</span>{' '}
                              <code className="bg-muted px-1 py-0.5 rounded text-[0.7rem]">{it.laboratories?.lab_code}</code>
                              <span className="text-muted-foreground ml-2">{fmt(it.start_datetime)} – {fmt(it.end_datetime)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusBadge status={it.status} />
                              <ItemCancelControls
                                checked={cancelSel.has(group.key, it.id)}
                                onToggle={() => cancelSel.toggle(group.key, it.id)}
                                canCancel={CANCELLABLE_ITEM_STATUSES.includes(it.status)}
                                disabled={cancellingItems}
                                onCancel={() => handleCancelItems('lab', group, [it.id])}
                              />
                            </div>
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
          <ReservationsPagination count={filteredLabGroups.length} page={currentPage} onPageChange={setPage} />
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
              ) : paginatedEqGroups.map((group) => {
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
                  <td className="px-4 py-3"><StatusBadge status={group.status} /><BorrowInfo rows={group.items} /></td>
                  <td className="px-4 py-3">
                    <RowActions
                      items={[
                        { label: 'Accept', icon: Check, success: true, hidden: group.status !== 'pending', onClick: () => approveEqGroup(group) },
                        { label: 'Reject', icon: X, destructive: true, hidden: group.status !== 'pending', onClick: () => setRejectingEqId(group.key) },
                        { label: 'Release equipment', icon: PackageOpen, success: true, hidden: !releasableRows(group.items).length, onClick: () => releaseEqGroup(group) },
                        { label: 'Mark as returned', icon: PackageCheck, success: true, hidden: !returnableRows(group.items).length, onClick: () => setReturningGroup(group) },
                        {
                          label: 'Change status',
                          icon: RefreshCw,
                          hidden: group.status === 'pending',
                          value: group.status,
                          options: ['reserved', 'in_use', 'completed', 'cancelled'].map((status) => ({
                            value: status,
                            label: status.replace('_', ' ').replace(/^\w/, (letter) => letter.toUpperCase()),
                          })),
                          onChange: (status) => changeEquipmentStatus(group, status),
                        },
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
                      <SelectedCancelBar
                        count={cancelSel.get(group.key).length}
                        disabled={cancellingItems}
                        onClear={() => cancelSel.clear(group.key)}
                        onCancel={() => handleCancelItems('equipment', group, cancelSel.get(group.key))}
                      />
                      <div className="flex flex-wrap gap-2">
                        {group.items.map((it) => (
                          <div key={it.id} className="bg-card border border-border rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                            <span className="font-semibold text-foreground">{it.equipment?.name}</span>
                            {it.equipment?.brand && <span className="text-muted-foreground">{it.equipment.brand}</span>}
                            <span className="bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">x{it.quantity_reserved}</span>
                            <StatusBadge status={it.status} />
                            <ItemCancelControls
                              checked={cancelSel.has(group.key, it.id)}
                              onToggle={() => cancelSel.toggle(group.key, it.id)}
                              canCancel={CANCELLABLE_ITEM_STATUSES.includes(it.status)}
                              disabled={cancellingItems}
                              onCancel={() => handleCancelItems('equipment', group, [it.id])}
                            />
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
          <ReservationsPagination count={filteredEqGroups.length} page={currentPage} onPageChange={setPage} />
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
      {returningGroup && (
        <ReturnEquipmentDialog rows={returnableRows(returningGroup.items)} busy={borrowBusy} onCancel={() => setReturningGroup(null)} onConfirm={confirmReturn} />
      )}
    </div>);

};

export default StaffReservations;