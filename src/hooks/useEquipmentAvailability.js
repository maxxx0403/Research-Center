import { useEffect, useState } from 'react';
import { fetchEquipmentAvailability } from '@/lib/equipmentAvailability';
import { supabase } from '@/integrations/supabase/client';
import { manilaInputToISO } from '@/lib/timezone';

const REFRESH_INTERVAL_MS = 15000;
const LIVE_STOCK_REFRESH_MS = 30000;

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


/**
 * How many units of each equipment are free RIGHT NOW (not borrowed or
 * reserved for the current time). Refreshes when reservations change.
 * Returns { stock: { [equipmentId]: { available, reserved } }, loaded }.
 */
export const useCurrentEquipmentStock = (equipmentIds) => {
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
      const nowISO = now.toISOString();
      const [{ data, error }, standaloneRes, attachedRes] = await Promise.all([
        supabase.rpc('get_equipment_availability', {
          p_equipment_ids: ids,
          p_start_datetime: nowISO,
          p_end_datetime: new Date(now.getTime() + 60 * 1000).toISOString(),
        }),
        // Units being used right now
        supabase
          .from('equipment_reservations')
          .select('equipment_id, quantity_reserved')
          .in('equipment_id', ids)
          .eq('status', 'in_use')
          .lte('start_datetime', nowISO)
          .gt('end_datetime', nowISO),
        supabase
          .from('reservation_equipment')
          .select('equipment_id, quantity_reserved, reservations!inner(status, start_datetime, end_datetime)')
          .in('equipment_id', ids)
          .eq('reservations.status', 'in_use')
          .lte('reservations.start_datetime', nowISO)
          .gt('reservations.end_datetime', nowISO),
      ]);
      if (!active) return;
      if (error) { console.error('Error fetching current equipment stock:', error); return; }
      const next = {};
      (data || []).forEach((row) => {
        next[row.equipment_id] = {
          available: Number(row.available_quantity),
          reserved: Number(row.reserved_quantity),
          inUse: 0,
        };
      });
      [...(standaloneRes.data || []), ...(attachedRes.data || [])].forEach((row) => {
        const entry = next[row.equipment_id] || (next[row.equipment_id] = { available: null, reserved: 0, inUse: 0 });
        entry.inUse += Number(row.quantity_reserved) || 0;
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
    const intervalId = window.setInterval(refresh, LIVE_STOCK_REFRESH_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [idsKey]);

  return { stock, loaded };
};

const OUT_OF_SERVICE = ['under_repair', 'damaged', 'maintenance'];

const EMPTY = { total: 0, available: 0, inUse: 0, reserved: 0, underRepair: 0, damaged: 0, maintenance: 0 };

/**
 * Live inventory counts (in units). Reads the equipment itself so a status
 * change (Damaged, Under Maintenance) shows right away.
 *  roomIds: optional laboratory ids to limit the counts to (staff).
 *  - total:       all units
 *  - available:   units free right now (not borrowed/reserved right now,
 *                 not damaged, not under maintenance)
 *  - inUse:       units being used right now
 *  - reserved:    units in approved reservations that have not finished yet
 *  - damaged:     units of equipment marked Damaged
 *  - maintenance: units of equipment marked Under Maintenance
 * Also returns `items` (the equipment rows) and `stock`
 * ({ [id]: { available, reserved } }) for the stock warnings.
 */
export const useEquipmentInventoryStatus = (roomIds = []) => {
  const roomKey = (roomIds || []).map(String).sort().join(',');
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(EMPTY);
  const [stock, setStock] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const rooms = roomKey ? new Set(roomKey.split(',')) : null;
    let active = true;

    const refresh = async () => {
      const { data: eqData, error: eqError } = await supabase
        .from('equipment')
        .select('id, name, brand, model, quantity, status, laboratory_id, laboratories(lab_name, lab_code)')
        .order('name');
      if (!active) return;
      if (eqError) { console.error('Error fetching equipment:', eqError); return; }
      const rows = (eqData || []).filter((e) => !rooms || (e.laboratory_id != null && rooms.has(String(e.laboratory_id))));
      if (!rows.length) {
        setItems([]); setSummary(EMPTY); setStock({}); setLoaded(true);
        return;
      }
      const ids = rows.map((e) => e.id);
      const idSet = new Set(ids);

      const now = new Date();
      const nowISO = now.toISOString();
      const [availabilityRes, standaloneRes, attachedRes] = await Promise.all([
        supabase.rpc('get_equipment_availability', {
          p_equipment_ids: ids,
          p_start_datetime: nowISO,
          p_end_datetime: new Date(now.getTime() + 60 * 1000).toISOString(),
        }),
        supabase
          .from('equipment_reservations')
          .select('equipment_id, status, quantity_reserved, start_datetime, end_datetime')
          .in('status', ['in_use', 'reserved'])
          .gt('end_datetime', nowISO),
        supabase
          .from('reservation_equipment')
          .select('equipment_id, quantity_reserved, reservations!inner(status, start_datetime, end_datetime)')
          .in('reservations.status', ['in_use', 'reserved'])
          .gt('reservations.end_datetime', nowISO),
      ]);
      if (!active) return;
      if (availabilityRes.error) console.error('Error fetching equipment availability:', availabilityRes.error);

      const nextStock = {};
      (availabilityRes.data || []).forEach((row) => {
        nextStock[row.equipment_id] = {
          available: Number(row.available_quantity),
          reserved: Number(row.reserved_quantity),
        };
      });

      const bookings = [
        ...(standaloneRes.data || []).map((r) => ({
          equipment_id: r.equipment_id, status: r.status, qty: Number(r.quantity_reserved) || 0,
          start: r.start_datetime, end: r.end_datetime,
        })),
        ...(attachedRes.data || []).map((r) => ({
          equipment_id: r.equipment_id, status: r.reservations?.status, qty: Number(r.quantity_reserved) || 0,
          start: r.reservations?.start_datetime, end: r.reservations?.end_datetime,
        })),
      ].filter((b) => idSet.has(Number(b.equipment_id)));

      const nowMs = now.getTime();
      const next = { ...EMPTY };
      rows.forEach((row) => {
        const item = { ...row, quantity: Number(row.quantity) || 0 };
        next.total += item.quantity;
        if (item.status === 'under_repair') { next.underRepair += item.quantity; return; }
        if (item.status === 'damaged') { next.damaged += item.quantity; return; }
        if (item.status === 'maintenance') { next.maintenance += item.quantity; return; }
        const free = nextStock[item.id]?.available;
        next.available += free == null ? item.quantity : Math.max(0, Math.min(free, item.quantity));
      });
      const outOfService = new Set(rows.filter((e) => OUT_OF_SERVICE.includes(e.status)).map((e) => e.id));
      bookings.forEach((b) => {
        const id = Number(b.equipment_id);
        if (outOfService.has(id)) return;
        const entry = nextStock[id] || (nextStock[id] = { available: null, reserved: 0 });
        const startsMs = new Date(b.start).getTime();
        if (b.status === 'in_use' && startsMs <= nowMs) {
          next.inUse += b.qty;
          entry.inUseNow = (entry.inUseNow || 0) + b.qty;
        } else if (b.status === 'reserved') {
          next.reserved += b.qty;
          entry.reservedUpcoming = (entry.reservedUpcoming || 0) + b.qty;
        }
      });

      setItems(rows);
      setStock(nextStock);
      setSummary(next);
      setLoaded(true);
    };

    refresh();
    const channel = supabase
      .channel(`equipment-inventory-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment_reservations' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservation_equipment' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment' }, refresh)
      .subscribe();
    const intervalId = window.setInterval(refresh, LIVE_STOCK_REFRESH_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [roomKey]);

  return { items, summary, stock, loaded };
};

export default useEquipmentAvailability;