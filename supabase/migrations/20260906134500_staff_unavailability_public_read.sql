-- =============================================================================
-- Staff unavailable dates now need to be visible to everyone (users included)
-- on the reservation calendar, not just the staff member themselves and admins.
-- Writing (insert/delete) stays restricted to the staff member who owns the row.
-- Safe to re-run: the policy is dropped before being recreated.
-- =============================================================================

drop policy if exists "staff_unavailability_select_own_or_admin" on public.staff_unavailability;

drop policy if exists "staff_unavailability_select_all" on public.staff_unavailability;
create policy "staff_unavailability_select_all"
  on public.staff_unavailability for select
  using (true);
