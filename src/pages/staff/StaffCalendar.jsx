import { useState, useEffect } from 'react';
import ReservationCalendarView from '@/components/ReservationCalendarView';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const StaffCalendar = () => {
  const { assignedRoomIds } = useAuth();
  const [selectedLabId, setSelectedLabId] = useState(null);
  const [labs, setLabs] = useState([]);
  const [loadingLabs, setLoadingLabs] = useState(true);

  useEffect(() => {
    (async () => {
      let query = supabase.from('laboratories').select('id, lab_name, lab_code, floor');
      if (assignedRoomIds.length) query = query.in('id', assignedRoomIds);
      const { data } = await query;
      setLabs(data || []);
      setSelectedLabId(data?.[0]?.id || null);
      setLoadingLabs(false);
    })();
  }, [assignedRoomIds]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-lg font-bold">Reservations Calendar</h2>
        <p className="text-xs text-muted-foreground">{assignedRoomIds.length ? `${assignedRoomIds.length} assigned room${assignedRoomIds.length > 1 ? 's' : ''}` : 'all rooms'}</p>
      </div>

      <div className="bg-card rounded-xl shadow-card p-6">
        <label className="block text-sm font-semibold text-foreground mb-3">Laboratory</label>
        {loadingLabs ?
        <p className="text-sm text-muted-foreground">Loading...</p> :
        labs.length === 0 ?
        <p className="text-sm text-muted-foreground">No laboratories found for your assigned rooms.</p> :

        <select
          value={selectedLabId || ''}
          onChange={(e) => setSelectedLabId(e.target.value ? Number(e.target.value) : null)}
          className="w-full md:w-64 px-4 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary">

            {labs.map((lab) => <option key={lab.id} value={lab.id}>{lab.lab_name} ({lab.lab_code})</option>)}
          </select>
        }
      </div>

      {selectedLabId &&
      <div className="bg-card rounded-xl shadow-card p-6">
          <ReservationCalendarView labId={selectedLabId} />
        </div>
      }
    </div>);

};

export default StaffCalendar;
