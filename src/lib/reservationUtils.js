import { supabase } from '@/integrations/supabase/client';

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
        `and(start_datetime.lt.${new Date(endDateTime).toISOString()},end_datetime.gt.${new Date(startDateTime).toISOString()})`
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
        `and(start_datetime.lt.${new Date(endDateTime).toISOString()},end_datetime.gt.${new Date(startDateTime).toISOString()})`
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
    const allConflicts = [];

    for (const eq of equipment) {
      const { hasConflict, conflicts } = await checkEquipmentReservationConflict(
        eq.equipmentId,
        startDateTime,
        endDateTime
      );

      if (hasConflict) {
        allConflicts.push({
          equipmentId: eq.equipmentId,
          conflicts
        });
      }
    }

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
