-- =============================================================================
-- Store the staff member's display name directly on each staff_unavailability
-- row. This lets the reservation calendar show "who" is unavailable to any
-- signed-in user without needing to read other people's `profiles` rows,
-- which stay restricted to their owner (plus admin/staff) under RLS.
-- =============================================================================

alter table public.staff_unavailability
  add column if not exists staff_name text;
