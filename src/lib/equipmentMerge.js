import { supabase } from '@/integrations/supabase/client';
import { findDuplicateEquipment } from '@/lib/catalogValidation';

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