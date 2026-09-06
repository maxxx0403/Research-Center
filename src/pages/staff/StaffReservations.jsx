import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Users, Check, X, MessageSquare } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { notifyReservationApproved, notifyReservationRejected } from '@/lib/notifications';
import ReservationMessagesPanel from '@/components/ReservationMessagesPanel';

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

  const loadData = async () => {
    const [labRes, eqRes] = await Promise.all([
    supabase.
    from('reservations').
    select('id, user_id, researcher_name, email, start_datetime, end_datetime, status, rejection_reason, members_list, laboratory_id, laboratories(lab_name, lab_code, floor)').
    order('start_datetime', { ascending: false }),
    supabase.
    from('equipment_reservations').
    select('id, user_id, researcher_name, email, quantity_reserved, start_datetime, end_datetime, status, rejection_reason, equipment(name, brand, laboratory_id, laboratories(lab_code, floor))').
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

  const filteredLab = labItems.filter((r) =>
  !search ||
  r.researcher_name.toLowerCase().includes(search.toLowerCase()) ||
  (r.email || '').toLowerCase().includes(search.toLowerCase())
  );
  const filteredEq = eqItems.filter((r) =>
  !search ||
  r.researcher_name.toLowerCase().includes(search.toLowerCase()) ||
  (r.equipment?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const fmt = (d) => new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  const approveLab = async (id) => {
    const item = labItems.find((r) => r.id === id);
    const { error } = await supabase.from('reservations').update({
      status: 'reserved',
      approved_by: user.id,
      approved_at: new Date().toISOString()
    }).eq('id', id);
    if (error) { toast.error('Failed to approve: ' + error.message); return; }
    setLabItems((prev) => prev.map((r) => r.id === id ? { ...r, status: 'reserved' } : r));
    toast.success('Reservation approved.');
    if (item?.user_id) notifyReservationApproved({ userId: item.user_id, label: `Reservation #RC${String(id).padStart(5, '0')}`, reservationType: 'lab', reservationId: id });
  };

  const rejectLab = async () => {
    if (!rejectingId) return;
    const item = labItems.find((r) => r.id === rejectingId);
    const { error } = await supabase.from('reservations').update({
      status: 'rejected',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      rejection_reason: rejectionReason || null
    }).eq('id', rejectingId);
    if (error) { toast.error('Failed to reject: ' + error.message); return; }
    setLabItems((prev) => prev.map((r) => r.id === rejectingId ? { ...r, status: 'rejected', rejection_reason: rejectionReason || null } : r));
    toast.success('Reservation rejected.');
    if (item?.user_id) notifyReservationRejected({ userId: item.user_id, label: `Reservation #RC${String(rejectingId).padStart(5, '0')}`, reason: rejectionReason, reservationType: 'lab', reservationId: rejectingId });
    setRejectingId(null);
    setRejectionReason('');
  };

  const approveEq = async (id) => {
    const item = eqItems.find((r) => r.id === id);
    const { error } = await supabase.from('equipment_reservations').update({
      status: 'reserved',
      approved_by: user.id,
      approved_at: new Date().toISOString()
    }).eq('id', id);
    if (error) { toast.error('Failed to approve: ' + error.message); return; }
    setEqItems((prev) => prev.map((r) => r.id === id ? { ...r, status: 'reserved' } : r));
    toast.success('Equipment reservation approved.');
    if (item?.user_id) notifyReservationApproved({ userId: item.user_id, label: `Equipment request #EQ${String(id).padStart(5, '0')}`, reservationType: 'equipment', reservationId: id });
  };

  const rejectEq = async () => {
    if (!rejectingEqId) return;
    const item = eqItems.find((r) => r.id === rejectingEqId);
    const { error } = await supabase.from('equipment_reservations').update({
      status: 'rejected',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      rejection_reason: rejectionEqReason || null
    }).eq('id', rejectingEqId);
    if (error) { toast.error('Failed to reject: ' + error.message); return; }
    setEqItems((prev) => prev.map((r) => r.id === rejectingEqId ? { ...r, status: 'rejected', rejection_reason: rejectionEqReason || null } : r));
    toast.success('Equipment reservation rejected.');
    if (item?.user_id) notifyReservationRejected({ userId: item.user_id, label: `Equipment request #EQ${String(rejectingEqId).padStart(5, '0')}`, reason: rejectionEqReason, reservationType: 'equipment', reservationId: rejectingEqId });
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
        <h3 className="font-heading text-sm font-bold mb-3">Laboratory Reservations <span className="text-muted-foreground font-normal">({filteredLab.length})</span></h3>
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
              ) : filteredLab.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground text-xs">No reservations found.</td></tr>
              ) : filteredLab.map((r) =>
              <tr key={r.id} id={`row-lab-${r.id}`} className={`border-b border-muted last:border-0 transition-colors ${highlightId === `lab-${r.id}` ? 'bg-primary/10 ring-2 ring-primary/40' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{r.researcher_name}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {r.members_list?.length > 0 ?
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Users className="w-3.5 h-3.5" /> {r.members_list.length} member{r.members_list.length > 1 ? 's' : ''}</span> :

                  <span className="text-xs text-muted-foreground">—</span>
                  }
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.laboratories?.lab_name}</div>
                    <div className="text-xs text-muted-foreground">{r.laboratories?.lab_code}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">{fmt(r.start_datetime)} – {fmt(r.end_datetime)}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3">
                    {r.status === 'pending' ?
                  <div className="flex gap-1.5">
                        <button onClick={() => approveLab(r.id)} className="bg-success text-success-foreground px-2 py-1 rounded text-xs font-semibold border-none cursor-pointer hover:brightness-110 inline-flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Accept
                        </button>
                        <button onClick={() => setRejectingId(r.id)} className="bg-destructive text-destructive-foreground px-2 py-1 rounded text-xs font-semibold border-none cursor-pointer hover:brightness-110 inline-flex items-center gap-1">
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
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="font-heading text-sm font-bold mb-3">Equipment Reservations <span className="text-muted-foreground font-normal">({filteredEq.length})</span></h3>
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
              ) : filteredEq.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-muted-foreground text-xs">No equipment reservations found.</td></tr>
              ) : filteredEq.map((r) =>
              <tr key={r.id} id={`row-equipment-${r.id}`} className={`border-b border-muted last:border-0 transition-colors ${highlightId === `equipment-${r.id}` ? 'bg-primary/10 ring-2 ring-primary/40' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{r.researcher_name}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.equipment?.name}</div>
                    <div className="text-xs text-muted-foreground">{r.equipment?.brand} · Qty {r.quantity_reserved}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">{fmt(r.start_datetime)} – {fmt(r.end_datetime)}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3">
                    {r.status === 'pending' ?
                  <div className="flex gap-1.5">
                        <button onClick={() => approveEq(r.id)} className="bg-success text-success-foreground px-2 py-1 rounded text-xs font-semibold border-none cursor-pointer hover:brightness-110 inline-flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Accept
                        </button>
                        <button onClick={() => setRejectingEqId(r.id)} className="bg-destructive text-destructive-foreground px-2 py-1 rounded text-xs font-semibold border-none cursor-pointer hover:brightness-110 inline-flex items-center gap-1">
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
              )}
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