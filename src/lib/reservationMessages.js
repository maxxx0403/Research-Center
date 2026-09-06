import { supabase } from '@/integrations/supabase/client';

/**
 * Fetch the full message thread for one reservation.
 * @param {'lab'|'equipment'} reservationType
 * @param {number} reservationId
 */
export const getReservationMessages = async (reservationType, reservationId) => {
  const { data, error } = await supabase
    .from('reservation_messages')
    .select('*')
    .eq('reservation_type', reservationType)
    .eq('reservation_id', reservationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

/**
 * Post a message into a reservation's thread.
 * @param {'lab'|'equipment'} reservationType
 * @param {number} reservationId
 * @param {string} senderId
 * @param {'user'|'staff'|'admin'} senderRole
 * @param {string} message
 */
export const sendReservationMessage = async (reservationType, reservationId, senderId, senderRole, message) => {
  const trimmed = message.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from('reservation_messages')
    .insert({
      reservation_type: reservationType,
      reservation_id: reservationId,
      sender_id: senderId,
      sender_role: senderRole,
      message: trimmed
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

/** Subscribe to new messages in a thread; returns an unsubscribe function. */
export const subscribeToReservationMessages = (reservationType, reservationId, onInsert) => {
  const channel = supabase
    .channel(`reservation_messages:${reservationType}:${reservationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'reservation_messages',
        filter: `reservation_id=eq.${reservationId}`
      },
      (payload) => {
        if (payload.new.reservation_type === reservationType) onInsert(payload.new);
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
};
