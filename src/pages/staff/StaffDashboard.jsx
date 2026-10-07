import { useState, useEffect } from 'react';
import { CalendarCheck, Hourglass, FlaskConical, Package } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import ReservationCalendarView from '@/components/ReservationCalendarView';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

const StaffDashboard = () => {
  const { assignedRoomIds } = useAuth();
  const [labs, setLabs] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [equipCount, setEquipCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedLabId, setSelectedLabId] = useState(null);

  useEffect(() => {
    (async () => {
      let labQuery = supabase.from('laboratories').select('*').order('id');
      if (assignedRoomIds.length) labQuery = labQuery.in('id', assignedRoomIds);
      const { data: labData } = await labQuery;
      const labIds = (labData || []).map((l) => l.id);

      const [{ data: resData }, { data: eqData }, { data: pendingData }] = await Promise.all([
      supabase.from('reservations').select('id, researcher_name, email, status, created_at, laboratories(lab_name, lab_code)').in('laboratory_id', labIds.length ? labIds : [-1]).order('created_at', { ascending: false }).limit(5),
      supabase.from('equipment').select('id, laboratory_id').in('laboratory_id', labIds.length ? labIds : [-1]),
      supabase.from('reservations').select('id').in('laboratory_id', labIds.length ? labIds : [-1]).eq('status', 'pending')]
      );

      setLabs(labData || []);
      setReservations(resData || []);
      setEquipCount((eqData || []).length);
      setPendingCount((pendingData || []).length);
      setSelectedLabId(labData?.[0]?.id || null);
      setLoading(false);
    })();
  }, [assignedRoomIds]);

  const availLabs = labs.filter((l) => l.status === 'available').length;

  const stats = [
  { icon: FlaskConical, label: 'Assigned Rooms', value: labs.length, color: 'bg-primary/10 text-primary' },
  { icon: CalendarCheck, label: 'Labs Available', value: `${availLabs} / ${labs.length}`, color: 'bg-success/10 text-success' },
  { icon: Package, label: 'Equipment Items', value: equipCount, color: 'bg-accent/10 text-accent' },
  { icon: Hourglass, label: 'Pending Reservations', value: pendingCount, color: 'bg-warning/10 text-warning' }];


  return (
    <div className="space-y-6 dash-black">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
        {stats.map((s) =>
        <div key={s.label} className="bg-card rounded-xl p-5 shadow-card flex items-center gap-4">
            <div className={`w-13 h-13 rounded-xl flex items-center justify-center text-xl ${s.color}`}><s.icon className="w-6 h-6" /></div>
            <div>
              <h3 className="font-heading text-2xl font-bold text-foreground leading-none">{loading ? '…' : s.value}</h3>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          </div>
        )}
      </div>

      <div className="isolate bg-white/30 dark:bg-white/10 backdrop-blur-2xl backdrop-saturate-[1.8] border border-white/70 rounded-xl
          shadow-[0_8px_32px_rgba(20,60,40,0.12),inset_0_1px_1px_rgba(255,255,255,0.9),inset_0_0_24px_rgba(255,255,255,0.3)]
          relative overflow-hidden">
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-white/50 via-white/5 to-transparent" />
        <div className="px-6 py-4 border-b border-white/40 flex flex-wrap gap-3 justify-between items-center">
          <h2 className="font-heading text-sm font-bold">Reservations Calendar</h2>
          <select
            value={selectedLabId || ''}
            onChange={(e) => setSelectedLabId(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-1.5 border-2 border-white/70 rounded-lg text-xs bg-white/50 backdrop-blur-xl text-foreground focus:outline-none focus:border-primary">

            {labs.map((lab) => <option key={lab.id} value={lab.id}>{lab.lab_name} ({lab.lab_code})</option>)}
          </select>
        </div>
        <div className="p-6">
          <ReservationCalendarView labId={selectedLabId} />
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
          <h2 className="font-heading text-sm font-bold">Recent Reservations</h2>
          <Link to="/staff/reservations" className="bg-muted text-muted-foreground border border-border px-3 py-1.5 rounded-lg text-xs font-semibold no-underline hover:bg-border transition-colors">View All</Link>
        </div>
        {reservations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No reservations yet</div>
        ) : (
          <>
            {/* Phone / tablet: stacked cards */}
            <div className="sm:hidden divide-y divide-muted">
              {reservations.map((r) => (
                <div key={r.id} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm">{r.researcher_name}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>#RC{String(r.id).padStart(5, '0')} · {r.laboratories?.lab_name}</span>
                    <span>{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Tablet+: table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b-2 border-border">
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Researcher</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Laboratory</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((r) =>
                  <tr key={r.id} className="border-b border-muted hover:bg-muted/30">
                      <td className="px-4 py-3 font-semibold text-xs">#RC{String(r.id).padStart(5, '0')}</td>
                      <td className="px-4 py-3"><div className="font-semibold">{r.researcher_name}</div><div className="text-xs text-muted-foreground">{r.email}</div></td>
                      <td className="px-4 py-3">{r.laboratories?.lab_name}<br /><code className="text-[0.7rem] bg-muted px-1 py-0.5 rounded">{r.laboratories?.lab_code}</code></td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>);

};

export default StaffDashboard;