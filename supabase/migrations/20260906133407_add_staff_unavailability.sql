-- =============================================================================
-- Adds a staff_unavailability table so staff members can mark specific dates
-- on which they are not available (e.g. leave, time off). Admins can see
-- everyone's unavailable dates; each staff member can only manage their own.
-- Safe to re-run: table creation is guarded, policies are dropped first.
-- =============================================================================

create table if not exists public.staff_unavailability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  unavailable_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (user_id, unavailable_date)
);

create index if not exists staff_unavailability_user_id_idx
  on public.staff_unavailability (user_id);

create index if not exists staff_unavailability_date_idx
  on public.staff_unavailability (unavailable_date);

alter table public.staff_unavailability enable row level security;

-- A staff member can see their own unavailable dates; admins can see everyone's
-- (e.g. to avoid scheduling that staff member on those days).
drop policy if exists "staff_unavailability_select_own_or_admin" on public.staff_unavailability;
create policy "staff_unavailability_select_own_or_admin"
  on public.staff_unavailability for select
  using (
    auth.uid() = user_id
    or has_role(auth.uid(), 'admin')
  );

-- Only the staff member themselves can add/remove their own unavailable dates.
drop policy if exists "staff_unavailability_insert_own" on public.staff_unavailability;
create policy "staff_unavailability_insert_own"
  on public.staff_unavailability for insert
  with check (auth.uid() = user_id and has_role(auth.uid(), 'staff'));

drop policy if exists "staff_unavailability_delete_own" on public.staff_unavailability;
create policy "staff_unavailability_delete_own"
  on public.staff_unavailability for delete
  using (auth.uid() = user_id);
