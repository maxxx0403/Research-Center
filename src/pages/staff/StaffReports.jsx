import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const StaffReports = () => {
  const { assignedRoomIds } = useAuth();
  const [labs, setLabs] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      let labQuery = supabase.from('laboratories').select('*').order('lab_code');
      if (assignedRoomIds.length) labQuery = labQuery.in('id', assignedRoomIds);
      const { data: labData } = await labQuery;
      const labIds = (labData || []).map((l) => l.id);

      const { data: resData } = await supabase.
      from('reservations').
      select('id, status, laboratory_id').
      in('laboratory_id', labIds.length ? labIds : [-1]);

      setLabs(labData || []);
      setReservations(resData || []);
      setLoading(false);
    })();
  }, [assignedRoomIds]);

  const completed = reservations.filter((r) => r.status === 'completed').length;
  const cancelled = reservations.filter((r) => r.status === 'cancelled').length;
  const active = reservations.filter((r) => ['reserved', 'in_use'].includes(r.status)).length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-heading text-lg font-bold">Reports</h2>
        <p className="text-xs text-muted-foreground">{assignedRoomIds.length ? `${assignedRoomIds.length} assigned room${assignedRoomIds.length > 1 ? 's' : ''}` : 'all rooms'}</p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
        {[
        { label: 'Total Reservations', value: reservations.length, color: 'text-primary' },
        { label: 'Completed', value: completed, color: 'text-success' },
        { label: 'Active', value: active, color: 'text-warning' },
        { label: 'Cancelled', value: cancelled, color: 'text-destructive' }].
        map((s) =>
        <div key={s.label} className="bg-card rounded-xl p-5 shadow-card text-center">
            <div className={`font-heading text-3xl font-bold ${s.color}`}>{loading ? '…' : s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border"><h2 className="font-heading text-sm font-bold">Reservations by Laboratory</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead><tr className="bg-muted/50 border-b-2 border-border"><th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Laboratory</th><th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Total</th><th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Completed</th><th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Active</th><th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Cancelled</th></tr></thead>
            <tbody>
              {loading ?
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</td></tr> :
              labs.length === 0 ?
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No laboratories found for your assigned rooms.</td></tr> :
              labs.map((l) => {
                const labRes = reservations.filter((r) => r.laboratory_id === l.id);
                return (
                  <tr key={l.id} className="border-b border-muted hover:bg-muted/30">
                    <td className="px-4 py-3 font-semibold">{l.lab_name}</td>
                    <td className="px-4 py-3">{labRes.length}</td>
                    <td className="px-4 py-3 text-success font-semibold">{labRes.filter((r) => r.status === 'completed').length}</td>
                    <td className="px-4 py-3 text-warning font-semibold">{labRes.filter((r) => ['reserved', 'in_use'].includes(r.status)).length}</td>
                    <td className="px-4 py-3 text-destructive font-semibold">{labRes.filter((r) => r.status === 'cancelled').length}</td>
                  </tr>);

              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>);

};

export default StaffReports;
