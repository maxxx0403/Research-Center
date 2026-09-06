import { useState, useEffect } from 'react';
import ReservationCalendarView from '@/components/ReservationCalendarView';
import { supabase } from '@/integrations/supabase/client';

const AdminCalendarReservations = () => {
  const [selectedLabId, setSelectedLabId] = useState(null);
  const [labs, setLabs] = useState([]);
  const [loadingLabs, setLoadingLabs] = useState(true);

  useEffect(() => {
    const fetchLabs = async () => {
      const { data } = await supabase.from('laboratories').select('id, lab_name, lab_code').eq('status', 'available');
      setLabs(data || []);
      setLoadingLabs(false);
    };
    fetchLabs();
  }, []);

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-primary mb-2">Reservations Calendar</h1>
        <p className="text-muted-foreground">View all laboratory reservations in calendar format</p>
      </div>

      <div className="bg-card rounded-xl shadow-card p-6">
        <label className="block text-sm font-semibold text-foreground mb-3">Filter by Laboratory (Optional)</label>
        <select
          value={selectedLabId || ''}
          onChange={(e) => setSelectedLabId(e.target.value ? Number(e.target.value) : null)}
          className="w-full md:w-64 px-4 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary"
        >
          <option value="">All Laboratories</option>
          {labs.map((lab) => (
            <option key={lab.id} value={lab.id}>
              {lab.lab_name} ({lab.lab_code})
            </option>
          ))}
        </select>
      </div>

      <div className="bg-card rounded-xl shadow-card p-6">
        <ReservationCalendarView labId={selectedLabId} />
      </div>
    </div>
  );
};

export default AdminCalendarReservations;
