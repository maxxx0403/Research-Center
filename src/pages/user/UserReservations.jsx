import { Fragment, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Edit2, Trash2, X, Check, ChevronDown, ChevronUp, Package, FlaskConical, FileDown, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/StatusBadge';
import { cancelReservation, updateReservation } from '@/lib/reservationUtils';
import { downloadRequestForm } from '@/lib/generateRequestForm';
import ReservationMessagesPanel from '@/components/ReservationMessagesPanel';

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

  const handleCancelEqReservation = async (id) => {
    if (!confirm('Cancel this equipment reservation?')) return;
    try {
      await supabase.from('equipment_reservations').update({ status: 'cancelled' }).eq('id', id);
      fetchData();
    } catch (error) {
      console.error('Error cancelling equipment reservation:', error);
      alert('Failed to cancel equipment reservation');
    }
  };

  const startEdit = (reservation) => {
    setEditingId(reservation.id);
    setEditData({
      start_datetime: reservation.start_datetime,
      end_datetime: reservation.end_datetime,
      research_purpose: reservation.research_purpose,
      special_requirements: reservation.special_requirements
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = async (id) => {
    setSaving(true);
    try {
      await updateReservation(id, editData);
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
        <h2 className="font-heading text-sm font-bold">My Lab Reservations <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs ml-2">{reservations.length}</span></h2>
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
            ) : reservations.length ? reservations.map((r) => {
              const hasEquipment = r.reservation_equipment && r.reservation_equipment.length > 0;
              const isExpanded = expandedEquipment[r.id];
              return (
                <Fragment key={r.id}>
                  <tr id={`row-lab-${r.id}`} className={`border-b border-muted hover:bg-muted/30 transition-colors ${highlightId === `lab-${r.id}` ? 'bg-primary/10 ring-2 ring-primary/40' : ''}`}>
                    <td className="px-4 py-3 font-semibold text-xs">#RC{String(r.id).padStart(5, '0')}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{r.laboratories?.lab_name}</div>
                      <code className="text-[0.7rem] bg-muted px-1 py-0.5 rounded">{r.laboratories?.lab_code}</code>
                    </td>
                    <td className="px-4 py-3">
                      {hasEquipment ? (
                        <button
                          onClick={() => toggleEquipment(r.id)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full hover:bg-primary/20 transition-colors cursor-pointer"
                        >
                          <Package className="w-3 h-3" />
                          {r.reservation_equipment.length} item{r.reservation_equipment.length > 1 ? 's' : ''}
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[200px]">{r.research_purpose?.slice(0, 80)}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {new Date(r.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}<br />
                      {new Date(r.start_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – {new Date(r.end_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                      {r.status === 'rejected' && r.rejection_reason && (
                        <p className="text-[0.7rem] text-destructive mt-1 max-w-[160px]">{r.rejection_reason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 flex gap-2 flex-wrap">
                      {(r.status === 'pending' || r.status === 'reserved') && (
                        <button
                          onClick={() => startEdit(r)}
                          className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded text-xs font-semibold cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors inline-flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" /> Edit
                        </button>
                      )}
                      {(r.status === 'pending' || r.status === 'reserved') && (
                        <button
                          onClick={() => handleCancelReservation(r.id)}
                          className="bg-destructive/10 text-destructive border border-destructive/20 px-3 py-1 rounded text-xs font-semibold cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Cancel
                        </button>
                      )}
                      {(r.status === 'reserved' || r.status === 'in_use' || r.status === 'completed') && (
                        <button
                          onClick={() => handleDownloadForm(r)}
                          disabled={downloadingId === r.id}
                          className="bg-success/10 text-success border border-success/20 px-3 py-1 rounded text-xs font-semibold cursor-pointer hover:bg-success hover:text-success-foreground transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <FileDown className="w-3 h-3" /> {downloadingId === r.id ? 'Preparing…' : 'Download Form'}
                        </button>
                      )}
                      <button
                        onClick={() => setMessagingItem({ type: 'lab', id: r.id, label: `Reservation #RC${String(r.id).padStart(5, '0')}`, reason: r.rejection_reason })}
                        className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-colors inline-flex items-center gap-1 ${r.status === 'rejected' ? 'bg-destructive text-destructive-foreground hover:brightness-110' : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground'}`}
                      >
                        <MessageSquare className="w-3 h-3" /> {r.status === 'rejected' ? 'Ask why' : 'Message'}
                      </button>
                    </td>
                  </tr>

                  {/* Equipment expand row */}
                  {hasEquipment && isExpanded && (
                    <tr key={`eq-${r.id}`} className="bg-primary/5 border-b border-primary/10">
                      <td colSpan={7} className="px-6 py-3">
                        <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5" /> Reserved Equipment
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {r.reservation_equipment.map((re) => (
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

                  {/* Edit modal row */}
                  {editingId === r.id && (
                    <tr key={`edit-${r.id}`} className="bg-primary/5 border-2 border-primary">
                      <td colSpan={7} className="p-6">
                        <div className="space-y-4">
                          <h3 className="font-bold text-foreground">Edit Reservation #{String(editingId).padStart(5, '0')}</h3>
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
                              <Check className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
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
        <h2 className="font-heading text-sm font-bold">My Equipment Reservations <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs ml-2">{eqReservations.length}</span></h2>
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
            ) : eqReservations.length ? eqReservations.map((r) => (
              <tr key={r.id} id={`row-equipment-${r.id}`} className={`border-b border-muted hover:bg-muted/30 transition-colors ${highlightId === `equipment-${r.id}` ? 'bg-primary/10 ring-2 ring-primary/40' : ''}`}>
                <td className="px-4 py-3 font-semibold text-xs">#EQ{String(r.id).padStart(5, '0')}</td>
                <td className="px-4 py-3">
                  <div className="font-semibold">{r.equipment?.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.equipment?.brand && <span>{r.equipment.brand} </span>}
                    <code className="bg-muted px-1 py-0.5 rounded text-[0.7rem]">{r.equipment?.laboratories?.lab_code}</code>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs font-semibold">x{r.quantity_reserved}</td>
                <td className="px-4 py-3 text-xs whitespace-nowrap">
                  {new Date(r.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}<br />
                  {new Date(r.start_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – {new Date(r.end_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                  {r.status === 'rejected' && r.rejection_reason && (
                    <p className="text-[0.7rem] text-destructive mt-1 max-w-[160px]">{r.rejection_reason}</p>
                  )}
                </td>
                <td className="px-4 py-3 flex gap-2 flex-wrap">
                  {(r.status === 'pending' || r.status === 'reserved') && (
                    <button
                      onClick={() => handleCancelEqReservation(r.id)}
                      className="bg-destructive/10 text-destructive border border-destructive/20 px-3 py-1 rounded text-xs font-semibold cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Cancel
                    </button>
                  )}
                  <button
                    onClick={() => setMessagingItem({ type: 'equipment', id: r.id, label: `Equipment request #EQ${String(r.id).padStart(5, '0')}`, reason: r.rejection_reason })}
                    className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-colors inline-flex items-center gap-1 ${r.status === 'rejected' ? 'bg-destructive text-destructive-foreground hover:brightness-110' : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground'}`}
                  >
                    <MessageSquare className="w-3 h-3" /> {r.status === 'rejected' ? 'Ask why' : 'Message'}
                  </button>
                </td>
              </tr>
            )) : (
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