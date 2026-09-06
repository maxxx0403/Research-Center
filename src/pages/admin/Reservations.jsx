import { useState, useEffect } from 'react';
import { Check, X, Trash2, AlertCircle, FlaskConical, Package, Users, ChevronDown, ChevronUp, FileDown, MessageSquare } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { updateReservationApproval } from '@/lib/reservationUtils';
import { downloadRequestForm } from '@/lib/generateRequestForm';
import { notifyReservationApproved, notifyReservationRejected } from '@/lib/notifications';
import ReservationMessagesPanel from '@/components/ReservationMessagesPanel';

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
      .select('id, user_id, researcher_name, email, phone, unit_college, adviser_name, study_title, stakeholder_type, status, approved_at, rejection_reason, start_datetime, end_datetime, members_list, laboratories(lab_name, lab_code, floor), reservation_equipment(id, quantity_reserved, equipment(id, name, brand, model))')
      .order('created_at', { ascending: false });
    setLabItems(data || []);
    setLabLoading(false);
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

  const fetchEqData = async () => {
    const { data } = await supabase
      .from('equipment_reservations')
      .select('id, user_id, researcher_name, email, purpose, quantity_reserved, start_datetime, end_datetime, status, rejection_reason, created_at, equipment(name, brand, laboratories(lab_code, floor))')
      .order('created_at', { ascending: false });
    setEqItems(data || []);
    setEqLoading(false);
  };

  useEffect(() => { fetchLabData(); fetchEqData(); }, []);

  // Lab filtered
  const filteredLab = labItems.filter((r) => {
    const matchSearch = !labSearch || r.researcher_name.toLowerCase().includes(labSearch.toLowerCase()) || (r.email || '').toLowerCase().includes(labSearch.toLowerCase());
    const matchStatus = !labFilterStatus || r.status === labFilterStatus;
    return matchSearch && matchStatus;
  });

  // Equipment filtered
  const filteredEq = eqItems.filter((r) => {
    const matchSearch = !eqSearch || r.researcher_name.toLowerCase().includes(eqSearch.toLowerCase()) || (r.equipment?.name || '').toLowerCase().includes(eqSearch.toLowerCase());
    const matchStatus = !eqFilterStatus || r.status === eqFilterStatus;
    return matchSearch && matchStatus;
  });

  // Lab actions
  const updateLabStatus = async (id, status) => {
    await supabase.from('reservations').update({ status }).eq('id', id);
    setLabItems((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
  };

  const approveReservation = async (id) => {
    try {
      const item = labItems.find((r) => r.id === id);
      await updateReservationApproval(id, 'reserved', user.id);
      setLabItems((prev) => prev.map((r) => r.id === id ? { ...r, status: 'reserved' } : r));
      if (item?.user_id) {
        notifyReservationApproved({ userId: item.user_id, label: `Reservation #RC${String(id).padStart(5, '0')}` });
      }
    } catch (error) {
      console.error('Error approving reservation:', error);
      alert('Failed to approve reservation');
    }
  };

  const rejectReservation = async (id) => {
    try {
      const item = labItems.find((r) => r.id === id);
      await updateReservationApproval(id, 'rejected', user.id, rejectionReason);
      setLabItems((prev) => prev.map((r) => r.id === id ? { ...r, status: 'rejected', rejection_reason: rejectionReason || null } : r));
      if (item?.user_id) {
        notifyReservationRejected({ userId: item.user_id, label: `Reservation #RC${String(id).padStart(5, '0')}`, reason: rejectionReason });
      }
      setRejectingId(null);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting reservation:', error);
      alert('Failed to reject reservation');
    }
  };

  const deleteLabRes = async (id) => {
    if (!confirm('Delete reservation #' + id + '?')) return;
    await supabase.from('reservations').delete().eq('id', id);
    setLabItems((prev) => prev.filter((r) => r.id !== id));
  };

  // Equipment actions
  const [rejectingEqId, setRejectingEqId] = useState(null);
  const [rejectionEqReason, setRejectionEqReason] = useState('');

  const updateEqStatus = async (id, status) => {
    await supabase.from('equipment_reservations').update({ status }).eq('id', id);
    setEqItems((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
  };

  const approveEqReservation = async (id) => {
    const item = eqItems.find((r) => r.id === id);
    await supabase.from('equipment_reservations').update({
      status: 'reserved',
      approved_by: user.id,
      approved_at: new Date().toISOString()
    }).eq('id', id);
    setEqItems((prev) => prev.map((r) => r.id === id ? { ...r, status: 'reserved' } : r));
    if (item?.user_id) {
      notifyReservationApproved({ userId: item.user_id, label: `Equipment request #EQ${String(id).padStart(5, '0')}` });
    }
  };

  const rejectEqReservation = async (id) => {
    const item = eqItems.find((r) => r.id === id);
    await supabase.from('equipment_reservations').update({
      status: 'rejected',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      rejection_reason: rejectionEqReason || null
    }).eq('id', id);
    setEqItems((prev) => prev.map((r) => r.id === id ? { ...r, status: 'rejected', rejection_reason: rejectionEqReason || null } : r));
    if (item?.user_id) {
      notifyReservationRejected({ userId: item.user_id, label: `Equipment request #EQ${String(id).padStart(5, '0')}`, reason: rejectionEqReason });
    }
    setRejectingEqId(null);
    setRejectionEqReason('');
  };

  const deleteEqRes = async (id) => {
    if (!confirm('Delete equipment reservation #' + id + '?')) return;
    await supabase.from('equipment_reservations').delete().eq('id', id);
    setEqItems((prev) => prev.filter((r) => r.id !== id));
  };

  const toggleMembers = (id) => setExpandedMembers(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleEquipment = (id) => setExpandedEquipment(prev => ({ ...prev, [id]: !prev[id] }));

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
              Reservations <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs ml-2">{filteredLab.length}</span>
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
                ) : filteredLab.length ? filteredLab.map((r) => (
                  <tr key={r.id} className="border-b border-muted hover:bg-muted/30">
                    <td className="px-4 py-3 font-semibold text-xs">#RC{String(r.id).padStart(5, '0')}</td>
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
                      <div className="font-semibold">{r.laboratories?.lab_name}</div>
                      <div className="text-xs text-muted-foreground">{r.laboratories?.lab_code}</div>
                    </td>
                    <td className="px-4 py-3">
                      {r.reservation_equipment && r.reservation_equipment.length > 0 ? (
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
                      {new Date(r.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}<br />
                      {new Date(r.start_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – {new Date(r.end_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap items-center">
                        {r.status === 'pending' ? (
                          <>
                            <button onClick={() => approveReservation(r.id)} className="bg-success text-success-foreground px-2 py-1 rounded text-xs font-semibold border-none cursor-pointer hover:brightness-110 inline-flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Accept
                            </button>
                            <button onClick={() => setRejectingId(r.id)} className="bg-destructive text-destructive-foreground px-2 py-1 rounded text-xs font-semibold border-none cursor-pointer hover:brightness-110 inline-flex items-center gap-1">
                              <X className="w-3.5 h-3.5" /> Reject
                            </button>
                          </>
                        ) : (
                          <select defaultValue={r.status} onChange={(e) => updateLabStatus(r.id, e.target.value)} className="px-2 py-1 border border-border rounded text-xs bg-card text-foreground">
                            {['reserved', 'in_use', 'completed', 'cancelled'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                          </select>
                        )}
                        {(r.status === 'reserved' || r.status === 'in_use' || r.status === 'completed') && (
                          <button
                            onClick={() => handleDownloadForm(r)}
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
                        <button onClick={() => deleteLabRes(r.id)} className="bg-destructive text-destructive-foreground px-2 py-1 rounded text-xs font-semibold border-none cursor-pointer hover:brightness-110">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
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
              Equipment Reservations <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs ml-2">{filteredEq.length}</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b-2 border-border">
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Researcher</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Equipment</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Schedule</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {eqLoading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
                ) : filteredEq.length ? filteredEq.map((r) => (
                  <tr key={r.id} className="border-b border-muted hover:bg-muted/30">
                    <td className="px-4 py-3 font-semibold text-xs">#EQ{String(r.id).padStart(5, '0')}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{r.researcher_name}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{r.equipment?.name}</div>
                      <div className="text-xs text-muted-foreground">{r.equipment?.brand} · Qty: {r.quantity_reserved}</div>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {new Date(r.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}<br />
                      {new Date(r.start_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – {new Date(r.end_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap items-center">
                        {r.status === 'pending' ? (
                          <>
                            <button onClick={() => approveEqReservation(r.id)} className="bg-success text-success-foreground px-2 py-1 rounded text-xs font-semibold border-none cursor-pointer hover:brightness-110 inline-flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Accept
                            </button>
                            <button onClick={() => setRejectingEqId(r.id)} className="bg-destructive text-destructive-foreground px-2 py-1 rounded text-xs font-semibold border-none cursor-pointer hover:brightness-110 inline-flex items-center gap-1">
                              <X className="w-3.5 h-3.5" /> Reject
                            </button>
                          </>
                        ) : (
                          <select defaultValue={r.status} onChange={(e) => updateEqStatus(r.id, e.target.value)} className="px-2 py-1 border border-border rounded text-xs bg-card text-foreground">
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
                        <button onClick={() => deleteEqRes(r.id)} className="bg-destructive text-destructive-foreground px-2 py-1 rounded text-xs font-semibold border-none cursor-pointer hover:brightness-110">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No equipment reservations found</td></tr>
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
                <p className="text-sm text-muted-foreground">#{String(rejectingId).padStart(5, '0')}</p>
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
              <button onClick={() => rejectReservation(rejectingId)} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold cursor-pointer hover:brightness-110">
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
                <p className="text-sm text-muted-foreground">#EQ{String(rejectingEqId).padStart(5, '0')}</p>
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
              <button onClick={() => rejectEqReservation(rejectingEqId)} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold cursor-pointer hover:brightness-110">
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