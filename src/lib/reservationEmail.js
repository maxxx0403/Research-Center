import { supabase } from '@/integrations/supabase/client';

/**
 * Ask the `send-reservation-email` edge function to send the Gmail notification.
 * The function looks up the reservation rows itself and decides the recipients,
 * so we only send the event type and the ids.
 *
 * Fire-and-forget: a failed email must NEVER block or break the reservation flow.
 *
 * @param {Object} params
 * @param {'new'|'approved'|'rejected'} params.event
 * @param {'lab'|'equipment'} params.reservationType
 * @param {Array<number>} params.ids
 */
export const sendReservationEmail = async ({ event, reservationType, ids }) => {
  try {
    if (!Array.isArray(ids) || ids.length === 0) return null;
    const { data, error } = await supabase.functions.invoke('send-reservation-email', {
      body: { event, reservationType, ids },
    });
    if (error) throw error;
    return data;
  } catch (error) {
    // Email is best-effort (the edge function may not be deployed / Gmail secrets may be missing).
    console.error('Error sending reservation email:', error);
    return null;
  }
};