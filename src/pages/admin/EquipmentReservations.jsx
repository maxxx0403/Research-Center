import { useState, useEffect } from 'react';
import StatusBadge from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { Trash2, CheckCircle, XCircle } from 'lucide-react';


const AdminEquipmentReservations = () => {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('equipment_reservations')
        .select('id, researcher_name, email, purpose, quantity_reserved, start_datetime, end_datetime, status, created_at, equipment(name, brand, laboratories(lab_code))')
        .order('created_at', { ascending: false });
      setItems(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = items.filter((r) => {
    const matchSearch = !search || r.researcher_name.toLowerCase().includes(search.toLowerCase()) || (r.equipment?.name || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const updateStatus = async (id, status) => {
    await supabase.from('equipment_reservations').update({ status }).eq('id', id);
    setItems((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
  };

  const approveReservation = async (id) => {
    await updateStatus(id, 'reserved');
  };

  const rejectReservation = async (id) => {
    await updateStatus(id, 'rejected');
    setRejectingId(null);
    setRejectionReason('');
  };

  const deleteRes = async (id) => {
    if (!confirm(`Delete equipment reservation #${id}?`)) return;
    await supabase.from('equipment_reservations').delete().eq('id', id);
    setItems((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-5">
      <div className="bg-card rounded-xl shadow-card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Search</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Researcher or equipment…" className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary" />
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Status</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground">
              <option value="">All</option>
              {['pending', 'reserved', 'in_use', 'completed', 'cancelled', 'rejected'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          <button onClick={() => {setSearch('');setFilterStatus('');}} className="bg-muted text-muted-foreground border border-border px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:bg-border transition-colors">Reset</button>
        </div>
      </div>

      {/* Reject modal */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-8 shadow-xl max-w-md w-full mx-4">
            <h3 className="font-heading font-bold text-lg mb-2">Reject Equipment Reservation</h3>
            <p className="text-muted-foreground text-sm mb-4">Optionally provide a reason for rejection.</p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Reason for rejection (optional)…"
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary mb-4 resize-none"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setRejectingId(null); setRejectionReason(''); }} className="bg-muted text-muted-foreground border border-border px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:bg-border transition-colors">Cancel</button>
              <button onClick={() => rejectReservation(rejectingId)} className="bg-destructive text-destructive-foreground px-4 py-2 rounded-lg text-sm font-semibold border-none cursor-pointer hover:brightness-110 transition-all">Confirm Reject</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-heading text-sm font-bold">Equipment Reservations <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs ml-2">{filtered.length}</span></h2>
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
              {loading ?
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Loading…</td></tr> :
              filtered.length ? filtered.map((r) =>
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
                          <button
                            onClick={() => approveReservation(r.id)}
                            title="Approve"
                            className="flex items-center gap-1 bg-success/10 text-success border border-success/30 px-2 py-1 rounded text-xs font-semibold cursor-pointer hover:bg-success hover:text-white transition-colors"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Accept
                          </button>
                          <button
                            onClick={() => setRejectingId(r.id)}
                            title="Reject"
                            className="flex items-center gap-1 bg-destructive/10 text-destructive border border-destructive/30 px-2 py-1 rounded text-xs font-semibold cursor-pointer hover:bg-destructive hover:text-white transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </>
                      ) : (
                        <select defaultValue={r.status} onChange={(e) => updateStatus(r.id, e.target.value)} className="px-2 py-1 border border-border rounded text-xs bg-card text-foreground">
                          {['pending', 'reserved', 'in_use', 'completed', 'cancelled', 'rejected'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                        </select>
                      )}
                      <button onClick={() => deleteRes(r.id)} className="bg-destructive text-destructive-foreground px-2 py-1 rounded text-xs font-semibold border-none cursor-pointer hover:brightness-110"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ) :
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No equipment reservations found</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>);
};

export default AdminEquipmentReservations;