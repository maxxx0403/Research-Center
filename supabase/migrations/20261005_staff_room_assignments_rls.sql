-- =============================================================================
-- Migration: Row Level Security (RLS) for staff_room_assignments
--
-- Ensures staff can read their own room assignments (or staff/admin can read all)
-- and admins have full read/write privileges.
-- =============================================================================

alter table if exists public.staff_room_assignments enable row level security;

drop policy if exists "staff_room_assignments_select" on public.staff_room_assignments;
create policy "staff_room_assignments_select"
  on public.staff_room_assignments for select
  using (
    auth.uid() = user_id
    or has_role(auth.uid(), 'admin')
    or has_role(auth.uid(), 'staff')
  );

drop policy if exists "staff_room_assignments_admin_all" on public.staff_room_assignments;
create policy "staff_room_assignments_admin_all"
  on public.staff_room_assignments for all
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));
