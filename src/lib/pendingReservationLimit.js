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

// Which labs / equipment are behind the pending count of each date.
// Returns { 'YYYY-MM-DD': [ { key, kind: 'lab' | 'equipment', items: [ { kind, labId, labName, labCode, itemName, quantity, start, end } ] } ] }
// No researcher names or personal data are returned (safe to show to every user).
export const fetchPendingReservationDetails = async (dates) => {
  const uniqueDates = [...new Set(dates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date || '')))];
  if (!uniqueDates.length) return {};

  const { data, error } = await supabase.rpc('get_pending_reservation_details', { p_dates: uniqueDates });
  if (error) throw error;

  const byDate = {};
  (data || []).forEach((row) => {
    const date = row.reservation_date;
    if (!byDate[date]) byDate[date] = new Map();
    const bookings = byDate[date];
    if (!bookings.has(row.booking_key)) bookings.set(row.booking_key, { key: row.booking_key, kind: row.kind, items: [] });
    bookings.get(row.booking_key).items.push({
      kind: row.kind,
      labId: row.laboratory_id != null ? Number(row.laboratory_id) : null,
      labName: row.lab_name || '',
      labCode: row.lab_code || '',
      itemName: row.item_name || '',
      quantity: row.quantity != null ? Number(row.quantity) : null,
      start: row.start_datetime,
      end: row.end_datetime,
    });
  });

  return Object.fromEntries(
    Object.entries(byDate).map(([date, bookings]) => [
      date,
      Array.from(bookings.values()).map((b) => ({
        ...b,
        items: b.items.sort((a, c) => new Date(a.start) - new Date(c.start)),
      })).sort((a, c) => new Date(a.items[0].start) - new Date(c.items[0].start)),
    ])
  );
};