import { useEffect, useState } from 'react';
import { fetchEquipmentAvailability } from '@/lib/equipmentAvailability';
import { supabase } from '@/integrations/supabase/client';
import { manilaInputToISO } from '@/lib/timezone';

const REFRESH_INTERVAL_MS = 15000;

const useEquipmentAvailability = (requests) => {
  const requestKey = JSON.stringify(
    (requests || []).map((request) => ({
      equipmentId: request.equipmentId,
      startDatetime: request.startDatetime ? manilaInputToISO(request.startDatetime) : '',
      endDatetime: request.endDatetime ? manilaInputToISO(request.endDatetime) : '',
    }))
  );
  const [availability, setAvailability] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const normalizedRequests = JSON.parse(requestKey);
    let active = true;

    if (!normalizedRequests.length) {
      setAvailability({});
      setLoading(false);
      setError(false);
      return undefined;
    }

    const refresh = async () => {
      if (active) setLoading(true);
      try {
        const result = await fetchEquipmentAvailability(normalizedRequests);
        if (active) {
          setAvailability(result);
          setError(false);
        }
      } catch (fetchError) {
        console.error('Error fetching equipment availability:', fetchError);
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    setAvailability({});
    setError(false);
    refresh();

    const channel = supabase
      .channel(`equipment-availability-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment_reservations' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservation_equipment' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment' }, refresh)
      .subscribe();
    const intervalId = window.setInterval(refresh, REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [requestKey]);

  return { availability, loading, error };
};

export default useEquipmentAvailability;
