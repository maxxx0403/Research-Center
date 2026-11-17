import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const REFRESH_INTERVAL_MS = 30000;

/**
 * How many units of each equipment are free RIGHT NOW (not borrowed or
 * reserved for the current time). Refreshes when reservations change.
 * Returns { stock: { [equipmentId]: { available, reserved } }, loaded }.
 */
const useCurrentEquipmentStock = (equipmentIds) => {
  const idsKey = [...new Set((equipmentIds || []).filter((id) => id != null).map(Number))]
    .sort((a, b) => a - b)
    .join(',');
  const [stock, setStock] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const ids = idsKey ? idsKey.split(',').map(Number) : [];
    let active = true;
    if (!ids.length) { setStock({}); setLoaded(true); return undefined; }

    const refresh = async () => {
      const now = new Date();
      const { data, error } = await supabase.rpc('get_equipment_availability', {
        p_equipment_ids: ids,
        p_start_datetime: now.toISOString(),
        p_end_datetime: new Date(now.getTime() + 60 * 1000).toISOString(),
      });
      if (!active) return;
      if (error) { console.error('Error fetching current equipment stock:', error); return; }
      const next = {};
      (data || []).forEach((row) => {
        next[row.equipment_id] = {
          available: Number(row.available_quantity),
          reserved: Number(row.reserved_quantity),
        };
      });
      setStock(next);
      setLoaded(true);
    };

    refresh();
    const channel = supabase
      .channel(`equipment-stock-${Math.random().toString(36).slice(2)}`)
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
  }, [idsKey]);

  return { stock, loaded };
};

export default useCurrentEquipmentStock;