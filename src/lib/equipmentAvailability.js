import { supabase } from '@/integrations/supabase/client';
import { manilaInputToISO } from '@/lib/timezone';

export const fetchEquipmentAvailability = async (requests) => {
  const validRequests = (requests || []).filter(
    (request) => request.equipmentId && request.startDatetime && request.endDatetime
  );
  const groups = new Map();

  validRequests.forEach((request) => {
    const startDatetime = manilaInputToISO(request.startDatetime);
    const endDatetime = manilaInputToISO(request.endDatetime);
    const key = `${startDatetime}|${endDatetime}`;
    if (!groups.has(key)) groups.set(key, { startDatetime, endDatetime, equipmentIds: [] });
    groups.get(key).equipmentIds.push(request.equipmentId);
  });

  const results = await Promise.all(
    [...groups.values()].map(({ startDatetime, endDatetime, equipmentIds }) =>
      supabase.rpc('get_equipment_availability', {
        p_equipment_ids: [...new Set(equipmentIds)],
        p_start_datetime: startDatetime,
        p_end_datetime: endDatetime,
      })
    )
  );

  const availability = {};
  results.forEach(({ data, error }) => {
    if (error) throw error;
    (data || []).forEach((row) => {
      availability[row.equipment_id] = {
        available: Number(row.available_quantity),
        reserved: Number(row.reserved_quantity),
      };
    });
  });
  return availability;
};
