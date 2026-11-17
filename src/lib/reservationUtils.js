import { supabase } from '@/integrations/supabase/client';
import { APP_TIMEZONE, manilaInputToISO, todayManilaDate } from '@/lib/timezone';
import { notifyEquipmentReleased, notifyEquipmentReturned } from '@/lib/notifications';
import { fetchEquipmentAvailability } from '@/lib/equipmentAvailability';

/**
 * Check for conflicts with existing reservations
 * @param {number} labId - Laboratory ID
 * @param {string} startDateTime - Start datetime ISO string
 * @param {string} endDateTime - End datetime ISO string
 * @param {number} excludeReservationId - Optional reservation ID to exclude (for edits)
 * @returns {Promise<{hasConflict: boolean, conflicts: Array}>}
 */
export const checkLabReservationConflict = async (labId, startDateTime, endDateTime, excludeReservationId = null) => {
  try {
    let query = supabase
      .from('reservations')
      .select('id, researcher_name, start_datetime, end_datetime, status')
      .eq('laboratory_id', labId)
      .in('status', ['pending', 'reserved', 'in_use'])
      .or(
        `and(start_datetime.lt.${manilaInputToISO(endDateTime)},end_datetime.gt.${manilaInputToISO(startDateTime)})`
      );

    if (excludeReservationId) {
      query = query.neq('id', excludeReservationId);
    }

    const { data: conflicts, error } = await query;

    if (error) throw error;

    return {
      hasConflict: conflicts && conflicts.length > 0,
      conflicts: conflicts || []
    };
  } catch (error) {
    console.error('Error checking reservation conflicts:', error);
    throw error;
  }
};

/**
 * Check for conflicts with equipment reservations
 * @param {number} equipmentId - Equipment ID
 * @param {string} startDateTime - Start datetime ISO string
 * @param {string} endDateTime - End datetime ISO string
 * @param {number} excludeReservationId - Optional reservation ID to exclude (for edits)
 * @returns {Promise<{hasConflict: boolean, conflicts: Array}>}
 */
export const checkEquipmentReservationConflict = async (equipmentId, startDateTime, endDateTime, excludeReservationId = null) => {
  try {
    let query = supabase
      .from('equipment_reservations')
      .select('id, researcher_name, start_datetime, end_datetime, status')
      .eq('equipment_id', equipmentId)
      .in('status', ['pending', 'reserved', 'in_use'])
      .or(
        `and(start_datetime.lt.${manilaInputToISO(endDateTime)},end_datetime.gt.${manilaInputToISO(startDateTime)})`
      );

    if (excludeReservationId) {
      query = query.neq('id', excludeReservationId);
    }

    const { data: conflicts, error } = await query;

    if (error) throw error;

    return {
      hasConflict: conflicts && conflicts.length > 0,
      conflicts: conflicts || []
    };
  } catch (error) {
    console.error('Error checking equipment conflicts:', error);
    throw error;
  }
};

/**
 * Check for conflicts with equipment assigned to a lab reservation
 * @param {number} reservationId - Lab reservation ID
 * @param {Array<{equipmentId: number, quantity: number}>} equipment - Equipment to check
 * @param {string} startDateTime - Start datetime ISO string
 * @param {string} endDateTime - End datetime ISO string
 * @returns {Promise<{hasConflict: boolean, conflicts: Array}>}
 */
export const checkEquipmentAvailability = async (equipment, startDateTime, endDateTime) => {
  try {
    const availability = await fetchEquipmentAvailability(
      equipment.map((item) => ({
        equipmentId: item.equipmentId,
        startDatetime: startDateTime,
        endDatetime: endDateTime,
      }))
    );
    const allConflicts = equipment.flatMap((item) => {
      const available = availability[item.equipmentId]?.available ?? 0;
      const requested = Number(item.quantity) || 1;
      return available < requested ? [{ equipmentId: item.equipmentId, available, requested }] : [];
    });

    return {
      hasConflict: allConflicts.length > 0,
      conflicts: allConflicts
    };
  } catch (error) {
    console.error('Error checking equipment availability:', error);
    throw error;
  }
};

/**
 * Get all reservations for a date range (for calendar view)
 * @param {string} startDate - Start date ISO string
 * @param {string} endDate - End date ISO string
 * @param {number} labId - Optional lab ID to filter
 * @returns {Promise<Array>}
 */
export const getReservationsForDateRange = async (startDate, endDate, labId = null) => {
  try {
    let query = supabase
      .from('reservations')
      .select('*, laboratories(lab_name, lab_code)')
      .gte('start_datetime', startDate)
      .lte('end_datetime', endDate)
      .neq('status', 'rejected')
      .order('start_datetime', { ascending: true });

    if (labId) {
      query = query.eq('laboratory_id', labId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching reservations for date range:', error);
    throw error;
  }
};

/**
 * Get reservation with equipment details
 * @param {number} reservationId - Reservation ID
 * @returns {Promise<Object>}
 */
export const getReservationWithEquipment = async (reservationId) => {
  try {
    const { data: reservation, error: resError } = await supabase
      .from('reservations')
      .select('*, laboratories(lab_name, lab_code)')
      .eq('id', reservationId)
      .single();

    if (resError) throw resError;

    const { data: equipment, error: eqError } = await supabase
      .from('reservation_equipment')
      .select('*, equipment(name, brand, model)')
      .eq('reservation_id', reservationId);

    if (eqError) throw eqError;

    return {
      ...reservation,
      equipment: equipment || []
    };
  } catch (error) {
    console.error('Error fetching reservation with equipment:', error);
    throw error;
  }
};

/**
 * Update reservation status with approval info
 * @param {number} reservationId - Reservation ID
 * @param {string} newStatus - New status
 * @param {string} userId - Admin user ID
 * @param {string} rejectionReason - Optional rejection reason
 * @returns {Promise<Object>}
 */
export const updateReservationApproval = async (reservationId, newStatus, userId, rejectionReason = null) => {
  try {
    const updateData = {
      status: newStatus,
      approved_by: userId,
      approved_at: new Date().toISOString()
    };

    if (rejectionReason) {
      updateData.rejection_reason = rejectionReason;
    }

    const { data, error } = await supabase
      .from('reservations')
      .update(updateData)
      .eq('id', reservationId)
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error updating reservation approval:', error);
    throw error;
  }
};

/**
 * Cancel a reservation
 * @param {number} reservationId - Reservation ID
 * @returns {Promise<Object>}
 */
export const cancelReservation = async (reservationId) => {
  try {
    const { data, error } = await supabase
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('id', reservationId)
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error cancelling reservation:', error);
    throw error;
  }
};

/**
 * Update a reservation (edit)
 * @param {number} reservationId - Reservation ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>}
 */
export const updateReservation = async (reservationId, updates) => {
  try {
    const { data, error } = await supabase
      .from('reservations')
      .update(updates)
      .eq('id', reservationId)
      .in('status', ['pending', 'rejected']) // approved/in-use/completed can't be edited
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error updating reservation:', error);
    throw error;
  }
};

/**
 * Resubmit a rejected lab reservation after edits: applies the updates and
 * sends it back to 'pending' so it re-enters the admin/staff approval queue.
 * @param {number} reservationId - Reservation ID
 * @param {Object} updates - Fields to update alongside the resubmission
 * @returns {Promise<Object>}
 */
export const resubmitReservation = async (reservationId, updates = {}) => {
  try {
    const { data, error } = await supabase
      .from('reservations')
      .update({ ...updates, status: 'pending', rejection_reason: null, approved_by: null, approved_at: null })
      .eq('id', reservationId)
      .in('status', ['pending', 'rejected'])
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error resubmitting reservation:', error);
    throw error;
  }
};

/**
 * Update the status (approve/reject/etc.) for every laboratory row that
 * shares a batch_id (i.e. every lab in a single multi-lab submission), so
 * admins/staff can act on the whole request at once instead of one row at
 * a time.
 * @param {Array<number>} reservationIds - Reservation IDs in the batch
 * @param {string} newStatus - New status
 * @param {string} userId - Admin/staff user ID
 * @param {string} rejectionReason - Optional rejection reason
 * @returns {Promise<Array>}
 */
export const updateReservationApprovalBatch = async (reservationIds, newStatus, userId, rejectionReason = null) => {
  try {
    const updateData = {
      status: newStatus,
      approved_by: userId,
      approved_at: new Date().toISOString()
    };

    if (rejectionReason) {
      updateData.rejection_reason = rejectionReason;
    }

    const { data, error } = await supabase
      .from('reservations')
      .update(updateData)
      .in('id', reservationIds)
      .select();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error updating batch reservation approval:', error);
    throw error;
  }
};

/**
 * Cancel every laboratory row sharing a batch_id in one go.
 * @param {Array<number>} reservationIds - Reservation IDs in the batch
 * @returns {Promise<Array>}
 */
export const cancelReservationBatch = async (reservationIds) => {
  try {
    const { data, error } = await supabase
      .from('reservations')
      .update({ status: 'cancelled' })
      .in('id', reservationIds)
      .select();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error cancelling batch reservation:', error);
    throw error;
  }
};

/**
 * Resubmit one or more rejected lab reservations after edits (e.g. all rows
 * sharing a batch_id), sending them back to 'pending' for re-review.
 * @param {Array<number>} reservationIds - Reservation IDs to resubmit
 * @param {Object} updates - Fields to update alongside the resubmission
 * @returns {Promise<Array>}
 */
export const resubmitReservationBatch = async (reservationIds, updates = {}) => {
  try {
    const { data, error } = await supabase
      .from('reservations')
      .update({ ...updates, status: 'pending', rejection_reason: null, approved_by: null, approved_at: null })
      .in('id', reservationIds)
      .select();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error resubmitting batch reservation:', error);
    throw error;
  }
};

/**
 * Resubmit one or more rejected equipment reservations after edits (e.g. all
 * rows sharing a batch_id), sending them back to 'pending' for re-review.
 * @param {Array<number>} reservationIds - Equipment reservation IDs to resubmit
 * @param {Object} updates - Fields to update alongside the resubmission
 * @returns {Promise<Array>}
 */
export const resubmitEquipmentReservations = async (reservationIds, updates = {}) => {
  try {
    const { data, error } = await supabase
      .from('equipment_reservations')
      .update({ ...updates, status: 'pending', rejection_reason: null })
      .in('id', reservationIds)
      .in('status', ['pending', 'rejected'])
      .select();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error resubmitting equipment reservations:', error);
    throw error;
  }
};

/**
 * Add equipment to a reservation
 * @param {number} reservationId - Reservation ID
 * @param {number} equipmentId - Equipment ID
 * @param {number} quantity - Quantity
 * @returns {Promise<Object>}
 */
export const addEquipmentToReservation = async (reservationId, equipmentId, quantity = 1) => {
  try {
    const { data, error } = await supabase
      .from('reservation_equipment')
      .insert({
        reservation_id: reservationId,
        equipment_id: equipmentId,
        quantity_reserved: quantity
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error adding equipment to reservation:', error);
    throw error;
  }
};

/**
 * Remove equipment from a reservation
 * @param {number} reservationEquipmentId - Reservation equipment ID
 * @returns {Promise<boolean>}
 */
export const removeEquipmentFromReservation = async (reservationEquipmentId) => {
  try {
    const { error } = await supabase
      .from('reservation_equipment')
      .delete()
      .eq('id', reservationEquipmentId);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Error removing equipment from reservation:', error);
    throw error;
  }
};

/**
 * Cancel only the chosen rows of a multi-reservation (one or more labs/days or
 * equipment items that share a batch_id). Rows that are no longer in one of the
 * allowed statuses (e.g. already completed) are left untouched.
 * @param {'reservations'|'equipment_reservations'} table
 * @param {Array<number>} ids - Row IDs to cancel
 * @param {Array<string>} [allowedStatuses] - Statuses a row may be cancelled from
 * @returns {Promise<Array>} the rows that were actually cancelled
 */
export const cancelReservationItems = async (table, ids, allowedStatuses = ['pending', 'reserved']) => {
  if (!ids?.length) return [];
  const { data, error } = await supabase
    .from(table)
    .update({ status: 'cancelled' })
    .in('id', ids)
    .in('status', allowedStatuses)
    .select();

  if (error) throw error;
  return data || [];
};

// ---------------------------------------------------------------------------
// Equipment borrowing: Release -> Return (records who / when / condition)
// ---------------------------------------------------------------------------
export const RETURN_CONDITIONS = [
  { value: 'good', label: 'Good condition' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'incomplete', label: 'Incomplete / missing parts' },
];
export const returnConditionLabel = (value) => RETURN_CONDITIONS.find((c) => c.value === value)?.label || value || '';

export const borrowDateTimeText = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-US', { timeZone: APP_TIMEZONE, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '';

/** Released, not returned, and the end time has passed. */
export const isEquipmentOverdue = (row, nowMs = Date.now()) =>
  row?.status === 'in_use' && !!row.released_at && !row.returned_at && new Date(row.end_datetime).getTime() <= nowMs;

/** Approved rows that can be handed out now (their date is today or earlier). */
export const releasableRows = (rows = []) => {
  const endOfToday = new Date(manilaInputToISO(`${todayManilaDate()}T23:59`)).getTime();
  return rows.filter((r) => r.status === 'reserved' && !r.released_at && new Date(r.start_datetime).getTime() <= endOfToday);
};

/** Rows that are out with the borrower. */
export const returnableRows = (rows = []) => rows.filter((r) => r.status === 'in_use' && !r.returned_at);

const itemLabel = (rows) => {
  const names = [...new Set(rows.map((r) => r.equipment?.name).filter(Boolean))];
  const qty = rows.reduce((sum, r) => sum + (Number(r.quantity_reserved) || 0), 0);
  if (names.length === 1) return `${names[0]} (Qty ${qty})`;
  return `Equipment request #EQ${String(rows[0]?.id || '').padStart(5, '0')}`;
};

const groupByUser = (rows) => {
  const map = new Map();
  rows.forEach((r) => {
    if (!r.user_id) return;
    if (!map.has(r.user_id)) map.set(r.user_id, []);
    map.get(r.user_id).push(r);
  });
  return [...map.entries()];
};

/**
 * Release: the borrower has received the equipment. Sets "In Use", records who
 * released it and when, and notifies the borrower with the return time.
 * @param rows equipment_reservations rows (with id, user_id, end_datetime, quantity_reserved, equipment.name)
 * @param actor { id, name }
 * @returns { data: updatedFields, error }
 */
export const releaseEquipment = async (rows, actor) => {
  const ids = rows.map((r) => r.id);
  const fields = {
    status: 'in_use',
    released_at: new Date().toISOString(),
    released_by: actor.id,
    released_by_name: actor.name,
  };
  const { error } = await supabase.from('equipment_reservations').update(fields).in('id', ids);
  if (error) return { error };
  groupByUser(rows).forEach(([userId, userRows]) => {
    const lastEnd = userRows.map((r) => r.end_datetime).sort().pop();
    notifyEquipmentReleased({ userId, label: itemLabel(userRows), dueText: borrowDateTimeText(lastEnd), reservationId: userRows[0].id });
  });
  return { data: fields };
};

/**
 * Return: the equipment came back. Sets "Completed", records who received it,
 * when, its condition and notes, and notifies the borrower.
 */
export const returnEquipment = async (rows, actor, { condition, notes }) => {
  const ids = rows.map((r) => r.id);
  const fields = {
    status: 'completed',
    returned_at: new Date().toISOString(),
    returned_by: actor.id,
    returned_by_name: actor.name,
    return_condition: condition,
    return_notes: notes?.trim() || null,
  };
  const { error } = await supabase.from('equipment_reservations').update(fields).in('id', ids);
  if (error) return { error };
  groupByUser(rows).forEach(([userId, userRows]) => {
    notifyEquipmentReturned({ userId, label: itemLabel(userRows), conditionText: returnConditionLabel(condition).toLowerCase(), notes: fields.return_notes, reservationId: userRows[0].id });
  });
  return { data: fields };
};

// ---------------------------------------------------------------------------
// Laboratory conflicts: approved reservations block a time; pending requests
// compete and the admin approves one (the others are rejected automatically).
// ---------------------------------------------------------------------------
/** { approved, pending } reservations overlapping this lab and time. Times are Manila input values. */
export const getLabSlotStatus = async (labId, startInput, endInput) => {
  const { data, error } = await supabase.rpc('get_lab_slot_status', {
    p_laboratory_id: labId,
    p_start: manilaInputToISO(startInput),
    p_end: manilaInputToISO(endInput),
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    approved: Number(row?.approved_count) || 0,
    pending: Number(row?.pending_count) || 0,
    capacity: row?.capacity == null ? null : Number(row.capacity),
    approvedPeople: Number(row?.approved_people) || 0,
  };
};

/** Does a group of `people` fit next to the approved groups? (no capacity = one group at a time) */
export const groupFits = (status, people) => (status.capacity
  ? status.approvedPeople + people <= status.capacity
  : status.approved === 0);

const manilaParts = (iso) => {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: APP_TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return { date, time };
};

/** Turns [{ start, end }] (ISO) into [{ start, end, text, date, startTime, endTime }]. */
export const describeLabSchedules = (schedules = []) =>
  (Array.isArray(schedules) ? schedules : []).map((s) => {
    const a = manilaParts(s.start);
    const b = manilaParts(s.end);
    const day = new Date(s.start).toLocaleDateString('en-US', { timeZone: APP_TIMEZONE, weekday: 'short', month: 'short', day: 'numeric' });
    const t = (iso) => new Date(iso).toLocaleTimeString('en-US', { timeZone: APP_TIMEZONE, hour: 'numeric', minute: '2-digit' });
    return { ...s, date: a.date, startTime: a.time, endTime: b.time, text: `${day}, ${t(s.start)} – ${t(s.end)}` };
  });

/** Up to 3 free schedules of the same length for this lab (Manila input values in). */
export const suggestLabSchedules = async (labId, startInput, endInput, limit = 3, people = 1) => {
  const { data, error } = await supabase.rpc('suggest_lab_schedules', {
    p_laboratory_id: labId,
    p_start: manilaInputToISO(startInput),
    p_end: manilaInputToISO(endInput),
    p_limit: limit,
    p_people: people,
  });
  if (error) throw error;
  return describeLabSchedules(data);
};

/** Link to the Reserve Lab form with the lab, date and time already filled in. */
export const reserveLabLink = (labId, schedule) =>
  `/user/reserve?lab_id=${labId}&date=${schedule.date}&start=${schedule.startTime}&end=${schedule.endTime}`;

export const isLabConflictError = (error) => /LAB_SCHEDULE_CONFLICT/.test(error?.message || String(error || ''));
export const LAB_CONFLICT_MESSAGE = 'Cannot approve: the laboratory is already full at that time (the approved groups + this group are over its capacity, or the lab takes one group at a time). Reject this request or ask the applicant to choose another schedule.';

const labIdOfRow = (r) => r?.laboratory_id ?? r?.laboratories?.id ?? null;

/** Other PENDING requests (from other submissions) for the same lab and an overlapping time. */
export const competingRequestsFor = (row, rows = []) => {
  const labId = labIdOfRow(row);
  if (!labId || row.status !== 'pending') return [];
  const start = new Date(row.start_datetime).getTime();
  const end = new Date(row.end_datetime).getTime();
  return rows.filter((o) => o.id !== row.id
    && o.status === 'pending'
    && labIdOfRow(o) === labId
    && (!row.batch_id || o.batch_id !== row.batch_id)
    && new Date(o.start_datetime).getTime() < end
    && new Date(o.end_datetime).getTime() > start);
};

/** Requests that were rejected automatically because one of these reservations was approved. */
export const fetchSupersededRequests = async (approvedIds = []) => {
  if (!approvedIds.length) return [];
  const { data, error } = await supabase
    .from('reservations')
    .select('id, status, rejection_reason, superseded_by, suggested_schedules')
    .in('superseded_by', approvedIds);
  if (error) { console.error('Could not load the auto-rejected requests:', error); return []; }
  return data || [];
};

/** People in one lab reservation: the requester + every member / section student. */
export const headcountOf = (row) => (Array.isArray(row?.members_list) ? row.members_list.length : 0) + 1;

/**
 * Seats picture for a pending lab request (admin/staff review), from the rows on screen.
 * allFit = this request + the competing pending ones + the approved ones fit in the capacity.
 */
export const labSeatCheck = (row, rows = []) => {
  const rivals = competingRequestsFor(row, rows);
  const labId = row?.laboratory_id ?? row?.laboratories?.id ?? null;
  const capacity = row?.laboratories?.max_capacity ?? null;
  const start = new Date(row.start_datetime).getTime();
  const end = new Date(row.end_datetime).getTime();
  const approved = rows.filter((o) => o.id !== row.id
    && ['reserved', 'in_use'].includes(o.status)
    && (o.laboratory_id ?? o.laboratories?.id) === labId
    && new Date(o.start_datetime).getTime() < end
    && new Date(o.end_datetime).getTime() > start);
  const approvedPeople = approved.reduce((sum, o) => sum + headcountOf(o), 0);
  const people = headcountOf(row);
  const rivalsPeople = rivals.reduce((sum, o) => sum + headcountOf(o), 0);
  const fitsNow = capacity ? approvedPeople + people <= capacity : approved.length === 0;
  const allFit = capacity ? approvedPeople + people + rivalsPeople <= capacity : approved.length === 0 && rivals.length === 0;
  return { rivals, capacity, approvedPeople, people, rivalsPeople, fitsNow, allFit };
};