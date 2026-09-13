import { supabase } from '@/integrations/supabase/client';

/**
 * Create a notification for a user. Shows up in NotificationBell (navbar,
 * every panel) via realtime, and in the /notifications-backed dashboards.
 * @param {Object} params
 * @param {string} params.userId - Recipient's auth user id.
 * @param {'reservation_approved'|'reservation_rejected'|'new_reservation'|'equipment_added'|'equipment_removed'|'reservation_message'} params.type
 * @param {string} params.title
 * @param {string} [params.message]
 * @param {'lab'|'equipment'} [params.reservationType] - Lets NotificationBell jump straight to this reservation when clicked.
 * @param {number} [params.reservationId]
 * @returns {Promise<Object|null>}
 */
export const createNotification = async ({ userId, type, title, message = null, reservationType = null, reservationId = null }) => {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        reservation_type: reservationType,
        reservation_id: reservationId
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    // Notifications are best-effort — never block the underlying
    // approve/reject action if this fails.
    console.error('Error creating notification:', error);
    return null;
  }
};

/**
 * Convenience wrapper for the most common case: telling a researcher their
 * reservation/request was rejected, with an optional reason.
 */
export const notifyReservationRejected = async ({ userId, label, reason, reservationType, reservationId }) => {
  return createNotification({
    userId,
    type: 'reservation_rejected',
    title: `${label} rejected`,
    message: reason ? `Reason: ${reason}` : 'No reason was given. Open the reservation to ask why.',
    reservationType,
    reservationId
  });
};

export const notifyReservationApproved = async ({ userId, label, reservationType, reservationId }) => {
  return createNotification({
    userId,
    type: 'reservation_approved',
    title: `${label} approved`,
    message: 'Your reservation has been approved.',
    reservationType,
    reservationId
  });
};

/**
 * Tells a researcher that a piece of equipment tied to one of their active
 * reservations was removed from inventory by an admin/staff member.
 */
export const notifyEquipmentRemoved = async ({ userId, equipmentName, reservationType, reservationId }) => {
  return createNotification({
    userId,
    type: 'equipment_removed',
    title: `"${equipmentName}" was removed from inventory`,
    message: 'This equipment was tied to one of your active reservations. Please check your reservation — you may need to choose a replacement or contact the lab.',
    reservationType,
    reservationId
  });
};