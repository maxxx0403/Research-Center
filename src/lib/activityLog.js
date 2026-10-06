import { supabase } from '@/integrations/supabase/client';

// Activity logs record what ADMIN / STAFF do (accept, reject, delete, ...),
// not what regular users do. `actor` is the admin/staff who did the action.

const actorCache = new Map();

// Who is doing the action: display name + role (admin / staff).
const getActor = async (userId) => {
  if (actorCache.has(userId)) return actorCache.get(userId);
  let name = null;
  let role = null;
  try {
    const [{ data: profile }, { data: roleRow }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('user_id', userId).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
    ]);
    name = profile?.full_name?.trim() || null;
    role = roleRow?.role || null;
    if (!name) {
      const { data: { user } } = await supabase.auth.getUser();
      name = user?.email || null;
    }
  } catch {
    /* fall through */
  }
  const actor = { name: name || 'Unknown', role };
  actorCache.set(userId, actor);
  return actor;
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
    const labIds = items.map((i) => i.equipment?.laboratory_id ?? i.equipment?.laboratories?.id);
    return { ref, who, detail, floor: first.equipment?.laboratories?.floor || null, labIds };
  }
  const ref = `Reservation #RC${pad(first.id)}${many ? ` (${items.length} laboratories)` : ''}`;
  const detail = items.map((i) => i.laboratories?.lab_name).filter(Boolean).join(', ');
  const labIds = items.map((i) => i.laboratory_id ?? i.laboratories?.id);
  return { ref, who, detail, floor: first.laboratories?.floor || null, labIds };
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
    const { ref, who, detail, floor, labIds } = describe(type, items);
    let description = `${verb} ${ref} of ${who}${detail ? ` — ${detail}` : ''}`;
    if (reason) description += ` (Reason: ${reason})`;
    const action = `${type === 'equipment' ? 'equipment_reservation' : 'reservation'}_${verb.toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '')}`;
    const actor = await getActor(userId);
    const laboratory_ids = [...new Set(labIds.filter((id) => id != null).map(Number))];
    const { error } = await supabase
      .from('activity_logs')
      .insert({
        action,
        description,
        floor,
        actor: actor.name,
        actor_id: userId,
        actor_role: actor.role,
        laboratory_ids,
      });
    if (error) console.error('Failed to write activity log:', error);
  } catch (e) {
    console.error('Failed to write activity log:', e);
  }
};

/**
 * Record an admin action about a staff account (created, rooms changed, removed).
 * The staff member being acted on can see it in their own activity log.
 * @param {object} p
 * @param {string} p.userId        - the signed-in admin id
 * @param {string} p.targetUserId  - the staff member's user id
 * @param {string} p.verb          - 'Created' | 'Updated rooms of' | 'Removed' ...
 * @param {string} p.targetLabel   - staff email or name shown in the description
 * @param {number[]} [p.laboratoryIds] - rooms involved, if any
 */
export const logStaffAccountAction = async ({ userId, targetUserId, verb, targetLabel, laboratoryIds = [] }) => {
  try {
    if (!userId || !targetUserId) return;
    const actor = await getActor(userId);
    const action = `staff_account_${verb.toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '')}`;
    const { error } = await supabase.from('activity_logs').insert({
      action,
      description: `${verb} staff account of ${targetLabel}`,
      floor: null,
      actor: actor.name,
      actor_id: userId,
      actor_role: actor.role,
      target_user_id: targetUserId,
      laboratory_ids: laboratoryIds.map(Number),
    });
    if (error) console.error('Failed to write activity log:', error);
  } catch (e) {
    console.error('Failed to write activity log:', e);
  }
};