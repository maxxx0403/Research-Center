import { supabase } from '@/integrations/supabase/client';

// Activity logs record what ADMIN / STAFF do (accept, reject, delete, ...),
// not what regular users do. `actor` is the admin/staff who did the action.

const nameCache = new Map();

const getActorName = async (userId) => {
  if (nameCache.has(userId)) return nameCache.get(userId);
  let name = null;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', userId)
      .maybeSingle();
    name = data?.full_name?.trim() || null;
    if (!name) {
      const { data: { user } } = await supabase.auth.getUser();
      name = user?.email || null;
    }
  } catch {
    /* fall through */
  }
  name = name || 'Unknown';
  nameCache.set(userId, name);
  return name;
};

const pad = (n) => String(n).padStart(5, '0');

const describe = (type, items) => {
  const first = items[0];
  const many = items.length > 1;
  const who = first.researcher_name || 'a user';
  if (type === 'equipment') {
    const ref = `Equipment request #EQ${pad(first.id)}${many ? ` (${items.length} items)` : ''}`;
    const detail = items
      .map((i) => `${i.quantity_reserved ?? 1} × ${i.equipment?.name || 'equipment'}`)
      .join(', ');
    return { ref, who, detail, floor: first.equipment?.laboratories?.floor || null };
  }
  const ref = `Reservation #RC${pad(first.id)}${many ? ` (${items.length} laboratories)` : ''}`;
  const detail = items.map((i) => i.laboratories?.lab_name).filter(Boolean).join(', ');
  return { ref, who, detail, floor: first.laboratories?.floor || null };
};

/**
 * Record an admin/staff action on a reservation.
 * @param {object} p
 * @param {string} p.userId  - the signed-in admin/staff id (user.id)
 * @param {'lab'|'equipment'} p.type
 * @param {string} p.verb    - 'Accepted' | 'Rejected' | 'Deleted' | ...
 * @param {Array}  p.items   - the reservation row(s) acted on
 * @param {string} [p.reason]
 */
export const logReservationAction = async ({ userId, type, verb, items, reason }) => {
  try {
    if (!userId || !items?.length) return;
    const { ref, who, detail, floor } = describe(type, items);
    let description = `${verb} ${ref} of ${who}${detail ? ` — ${detail}` : ''}`;
    if (reason) description += ` (Reason: ${reason})`;
    const action = `${type === 'equipment' ? 'equipment_reservation' : 'reservation'}_${verb.toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '')}`;
    const actor = await getActorName(userId);
    const { error } = await supabase
      .from('activity_logs')
      .insert({ action, description, floor, actor });
    if (error) console.error('Failed to write activity log:', error);
  } catch (e) {
    console.error('Failed to write activity log:', e);
  }
};