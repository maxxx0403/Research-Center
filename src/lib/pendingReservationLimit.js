import { supabase } from '@/integrations/supabase/client';

export const MAX_PENDING_RESERVATIONS_PER_DATE = 3;
export const PENDING_RESERVATION_LIMIT_ERROR = 'PENDING_RESERVATION_DATE_LIMIT';

export const fetchPendingReservationCounts = async (dates) => {
  const uniqueDates = [...new Set(dates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date || '')))];
  if (!uniqueDates.length) return {};

  const { data, error } = await supabase.rpc('get_pending_reservation_counts', {
    p_dates: uniqueDates,
  });
  if (error) throw error;

  return Object.fromEntries(
    (data || []).map(({ reservation_date: date, pending_count: count }) => [date, Number(count)])
  );
};

export const getFullPendingReservationDate = (counts) =>
  Object.entries(counts).find(([, count]) => count >= MAX_PENDING_RESERVATIONS_PER_DATE)?.[0] || null;

export const getPendingReservationLimitMessage = (date) =>
  `${date ? `${date}: ` : ''}The limit of ${MAX_PENDING_RESERVATIONS_PER_DATE} pending bookings for this date has been reached. Please choose another date.`;
