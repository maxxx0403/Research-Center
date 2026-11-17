import { supabase } from '@/integrations/supabase/client';
import { manilaInputToISO } from '@/lib/timezone';
import { findDuplicateEquipment } from '@/lib/catalogValidation';

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

// ---------------------------------------------------------------------------
// Stock level of an equipment right now (used for the warnings)
// ---------------------------------------------------------------------------
// 'out'  = every unit is borrowed/reserved right now
// 'low'  = only 1 unit left (for equipment that has more than 1 unit)
// 'ok'   = enough units left, or the stock is not loaded yet
// Equipment statuses (value saved in the database -> label shown everywhere).
export const EQUIPMENT_STATUSES = [
  { value: 'available', label: 'Available' },
  { value: 'in_use', label: 'Borrowed / In Use' },
  { value: 'under_repair', label: 'Under Repair' },
  { value: 'damaged', label: 'Lost or Damaged' },
  { value: 'maintenance', label: 'For Maintenance' },
];
export const equipmentStatusLabel = (status) =>
  EQUIPMENT_STATUSES.find((s) => s.value === status)?.label
  || String(status || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Statuses that cannot be reserved (not counted as available units).
export const OUT_OF_SERVICE_STATUSES = ['under_repair', 'damaged', 'maintenance'];
export const isOutOfService = (item) => OUT_OF_SERVICE_STATUSES.includes(item?.status);

export const stockLevelOf = (item, stock) => {
  const entry = stock?.[item.id];
  // Damaged / Under Maintenance have their own columns, no stock warning.
  if (!entry || entry.available == null || isOutOfService(item)) return 'ok';
  const total = Number(item.quantity) || 0;
  if (total > 0 && entry.available <= 0) return 'out';
  const warnAt = lowStockLevelOf(item);
  if (warnAt > 0 && entry.available <= warnAt) return 'low';
  return 'ok';
};

// Warning level: the minimum quantity set on the equipment; if none, "1 left" for items with more than 1 unit.
export const lowStockLevelOf = (item) => {
  const min = item?.min_quantity;
  if (min !== null && min !== undefined && min !== '') return Number(min) || 0;
  return (Number(item?.quantity) || 0) > 1 ? 1 : 0;
};

// Units that can be borrowed right now (0 when Under Repair / Lost or Damaged / For Maintenance).
export const availableNowOf = (item, stock) => {
  if (isOutOfService(item)) return 0;
  return stock?.[item.id]?.available ?? null;
};

// Units being used right now.
export const inUseNowOf = (item, stock) => stock?.[item.id]?.inUse ?? 0;

// Units marked Under Repair / Lost or Damaged / For Maintenance (the status covers the whole item).
const unitsIf = (item, status) => (item?.status === status ? Number(item.quantity) || 0 : 0);
export const underRepairCountOf = (item) => unitsIf(item, 'under_repair');
export const damagedCountOf = (item) => unitsIf(item, 'damaged');
export const maintenanceCountOf = (item) => unitsIf(item, 'maintenance');

// ---------------------------------------------------------------------------
// Same equipment in the same laboratory: add to quantity instead of a new row
// ---------------------------------------------------------------------------
export const EQUIPMENT_SELECT = '*, laboratories(lab_name, lab_code, floor)';

const withoutCategory = (payload) => {
  const { category: _skip, ...rest } = payload;
  return rest;
};

// Re-reads the equipment of the same laboratory from the database so the
// match is right even when the list on screen is out of date.
const findExistingInDatabase = async (payload, excludeId) => {
  let query = supabase.from('equipment').select(EQUIPMENT_SELECT);
  query = payload.laboratory_id == null
    ? query.is('laboratory_id', null)
    : query.eq('laboratory_id', payload.laboratory_id);
  const { data, error } = await query;
  if (error) return { error };
  return { match: findDuplicateEquipment(data || [], payload, excludeId) };
};

const addToQuantity = async (existing, qty) => {
  const quantity = (Number(existing.quantity) || 0) + qty;
  const available = (Number(existing.available_quantity ?? existing.quantity) || 0) + qty;
  return supabase
    .from('equipment')
    .update({ quantity, available_quantity: available })
    .eq('id', existing.id)
    .select(EQUIPMENT_SELECT)
    .single();
};

/**
 * Adds new equipment. If the same equipment (same name, brand, model and
 * laboratory) already exists, its quantity is increased instead of creating
 * a second row.
 * Returns { data, error, merged, addedQuantity }.
 */
export const addEquipmentOrMerge = async (payload) => {
  const qty = Math.max(1, Number(payload.quantity) || 1);

  const tryMerge = async () => {
    const { match, error } = await findExistingInDatabase(payload);
    if (error) return { error };
    if (!match) return null;
    const { data, error: updateError } = await addToQuantity(match, qty);
    return { data, error: updateError, merged: true, addedQuantity: qty };
  };

  const merged = await tryMerge();
  if (merged) return merged;

  const row = { ...payload, quantity: qty, status: 'available', available_quantity: qty };
  let { data, error } = await supabase.from('equipment').insert(row).select(EQUIPMENT_SELECT).single();
  if (error && /category/i.test(error.message || '')) {
    // The category column is not in the database yet: save everything else.
    ({ data, error } = await supabase.from('equipment').insert(withoutCategory(row)).select(EQUIPMENT_SELECT).single());
  }
  if (error?.message?.includes('DUPLICATE_EQUIPMENT')) {
    // Someone added the same item at the same time: add to that one instead.
    const retry = await tryMerge();
    if (retry) return retry;
  }
  return { data, error, merged: false, addedQuantity: qty };
};

/**
 * Saves an edit. If the edited equipment now has the same name, brand, model
 * and laboratory as another row, the two are merged into that other row:
 * the quantity is added to it, reservations are moved to it, and the edited
 * row is removed.
 * Returns { data, error, merged, mergedInto }.
 */
export const updateEquipmentOrMerge = async (target, payload) => {
  const { match, error: findError } = await findExistingInDatabase(payload, target.id);
  if (findError) return { error: findError };

  if (match) {
    const { data, error } = await supabase.rpc('merge_equipment', {
      p_source_id: target.id,
      p_target_id: match.id,
      p_add_quantity: Math.max(1, Number(payload.quantity) || 1),
    });
    if (error) {
      const missing = /merge_equipment/i.test(error.message || '') && /(find|exist|schema cache)/i.test(error.message || '');
      return {
        error: missing
          ? { message: 'The database is missing the merge_equipment function. Please run the latest Supabase migration (20261117000000_merge_duplicate_equipment.sql).' }
          : error,
      };
    }
    const mergedRow = Array.isArray(data) ? data[0] : data;
    // Get the row again so it comes with its laboratory details.
    const { data: fresh } = await supabase.from('equipment').select(EQUIPMENT_SELECT).eq('id', mergedRow?.id ?? match.id).single();
    return { data: fresh || { ...match, ...mergedRow }, merged: true, mergedInto: match };
  }

  let { data, error } = await supabase.from('equipment').update(payload).eq('id', target.id).select(EQUIPMENT_SELECT).single();
  if (error && /category/i.test(error.message || '')) {
    ({ data, error } = await supabase.from('equipment').update(withoutCategory(payload)).eq('id', target.id).select(EQUIPMENT_SELECT).single());
  }
  return { data, error, merged: false };
};