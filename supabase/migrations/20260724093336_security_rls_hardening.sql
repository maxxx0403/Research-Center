-- =============================================================================
-- Security hardening migration: Row Level Security (RLS) for all tables.
--
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- or via `supabase db push` if you use the CLI with a linked project.
--
-- Assumes the `has_role(_user_id uuid, _role app_role)` function already
-- exists (it's referenced in src/integrations/supabase/types.ts and used by
-- the create-staff edge function). If it does not exist yet, uncomment and
-- run the CREATE FUNCTION block near the bottom first.
--
-- Safe to re-run: every policy is dropped before being recreated.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. profiles — a user can see/edit only their own profile.
--    Admin/staff can view all profiles (needed for admin/staff dashboards).
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own_or_staff" on public.profiles;
create policy "profiles_select_own_or_staff"
  on public.profiles for select
  using (
    auth.uid() = user_id
    or has_role(auth.uid(), 'admin')
    or has_role(auth.uid(), 'staff')
  );

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 2. user_roles — a user can read only their own role row (AuthContext
--    fetches this on login). Only admins can grant/revoke/list all roles.
--    Staff creation itself goes through the create-staff Edge Function,
--    which uses the service_role key and therefore bypasses RLS entirely —
--    that path is protected by the has_role(admin) check inside the function.
-- -----------------------------------------------------------------------------
alter table public.user_roles enable row level security;

drop policy if exists "user_roles_select_own_or_admin" on public.user_roles;
create policy "user_roles_select_own_or_admin"
  on public.user_roles for select
  using (auth.uid() = user_id or has_role(auth.uid(), 'admin'));

drop policy if exists "user_roles_admin_write" on public.user_roles;
create policy "user_roles_admin_write"
  on public.user_roles for all
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

-- -----------------------------------------------------------------------------
-- 3. laboratories — public read (needed to populate reservation forms),
--    only admin/staff can create/edit/delete.
-- -----------------------------------------------------------------------------
alter table public.laboratories enable row level security;

drop policy if exists "laboratories_select_all" on public.laboratories;
create policy "laboratories_select_all"
  on public.laboratories for select
  using (true);

drop policy if exists "laboratories_staff_write" on public.laboratories;
create policy "laboratories_staff_write"
  on public.laboratories for all
  using (has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'staff'))
  with check (has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'staff'));

-- -----------------------------------------------------------------------------
-- 4. equipment — public read, only admin/staff can create/edit/delete.
-- -----------------------------------------------------------------------------
alter table public.equipment enable row level security;

drop policy if exists "equipment_select_all" on public.equipment;
create policy "equipment_select_all"
  on public.equipment for select
  using (true);

drop policy if exists "equipment_staff_write" on public.equipment;
create policy "equipment_staff_write"
  on public.equipment for all
  using (has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'staff'))
  with check (has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'staff'));

-- -----------------------------------------------------------------------------
-- 5. reservations (lab bookings) — a user can create/view/cancel their own;
--    admin/staff can view and update (approve/reject) all.
-- -----------------------------------------------------------------------------
alter table public.reservations enable row level security;

drop policy if exists "reservations_select_own_or_staff" on public.reservations;
create policy "reservations_select_own_or_staff"
  on public.reservations for select
  using (
    auth.uid() = user_id
    or has_role(auth.uid(), 'admin')
    or has_role(auth.uid(), 'staff')
  );

drop policy if exists "reservations_insert_own" on public.reservations;
create policy "reservations_insert_own"
  on public.reservations for insert
  with check (auth.uid() = user_id);

drop policy if exists "reservations_update_own_pending_or_staff" on public.reservations;
create policy "reservations_update_own_pending_or_staff"
  on public.reservations for update
  using (
    (auth.uid() = user_id and status = 'pending')
    or has_role(auth.uid(), 'admin')
    or has_role(auth.uid(), 'staff')
  )
  with check (
    (auth.uid() = user_id and status = 'pending')
    or has_role(auth.uid(), 'admin')
    or has_role(auth.uid(), 'staff')
  );

drop policy if exists "reservations_delete_admin_only" on public.reservations;
create policy "reservations_delete_admin_only"
  on public.reservations for delete
  using (has_role(auth.uid(), 'admin'));

-- -----------------------------------------------------------------------------
-- 6. equipment_reservations — same pattern as reservations.
-- -----------------------------------------------------------------------------
alter table public.equipment_reservations enable row level security;

drop policy if exists "equipment_reservations_select_own_or_staff" on public.equipment_reservations;
create policy "equipment_reservations_select_own_or_staff"
  on public.equipment_reservations for select
  using (
    auth.uid() = user_id
    or has_role(auth.uid(), 'admin')
    or has_role(auth.uid(), 'staff')
  );

drop policy if exists "equipment_reservations_insert_own" on public.equipment_reservations;
create policy "equipment_reservations_insert_own"
  on public.equipment_reservations for insert
  with check (auth.uid() = user_id);

drop policy if exists "equipment_reservations_update_own_pending_or_staff" on public.equipment_reservations;
create policy "equipment_reservations_update_own_pending_or_staff"
  on public.equipment_reservations for update
  using (
    (auth.uid() = user_id and status = 'pending')
    or has_role(auth.uid(), 'admin')
    or has_role(auth.uid(), 'staff')
  )
  with check (
    (auth.uid() = user_id and status = 'pending')
    or has_role(auth.uid(), 'admin')
    or has_role(auth.uid(), 'staff')
  );

drop policy if exists "equipment_reservations_delete_admin_only" on public.equipment_reservations;
create policy "equipment_reservations_delete_admin_only"
  on public.equipment_reservations for delete
  using (has_role(auth.uid(), 'admin'));

-- -----------------------------------------------------------------------------
-- 7. feedbacks — a user can create/view their own; admin/staff view all.
--    Nobody (except admin, for moderation) can update/delete feedback —
--    keeps reviews honest.
-- -----------------------------------------------------------------------------
alter table public.feedbacks enable row level security;

drop policy if exists "feedbacks_select_own_or_staff" on public.feedbacks;
create policy "feedbacks_select_own_or_staff"
  on public.feedbacks for select
  using (
    auth.uid() = user_id
    or has_role(auth.uid(), 'admin')
    or has_role(auth.uid(), 'staff')
  );

drop policy if exists "feedbacks_insert_own" on public.feedbacks;
create policy "feedbacks_insert_own"
  on public.feedbacks for insert
  with check (auth.uid() = user_id);

drop policy if exists "feedbacks_admin_moderate" on public.feedbacks;
create policy "feedbacks_admin_moderate"
  on public.feedbacks for update
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

drop policy if exists "feedbacks_delete_admin_only" on public.feedbacks;
create policy "feedbacks_delete_admin_only"
  on public.feedbacks for delete
  using (has_role(auth.uid(), 'admin'));

-- -----------------------------------------------------------------------------
-- 8. paper_submissions — a user can create/view/delete their own submission
--    while it's still pending; admins manage everything through the existing
--    SECURITY DEFINER RPCs (get_all_submissions / admin_update_submission_status
--    / admin_delete_submission), so no separate admin RLS policy is needed
--    here as long as those functions stay SECURITY DEFINER.
-- -----------------------------------------------------------------------------
alter table public.paper_submissions enable row level security;

drop policy if exists "paper_submissions_select_own" on public.paper_submissions;
create policy "paper_submissions_select_own"
  on public.paper_submissions for select
  using (auth.uid() = user_id);

drop policy if exists "paper_submissions_insert_own" on public.paper_submissions;
create policy "paper_submissions_insert_own"
  on public.paper_submissions for insert
  with check (auth.uid() = user_id);

drop policy if exists "paper_submissions_delete_own_pending" on public.paper_submissions;
create policy "paper_submissions_delete_own_pending"
  on public.paper_submissions for delete
  using (auth.uid() = user_id and status = 'submitted');

-- -----------------------------------------------------------------------------
-- 9. Storage: the "submissions" bucket should be private, with access scoped
--    to the owning user's folder (files are stored as `${user.id}/...`,
--    see src/pages/user/UserForms.jsx). Admin access to files goes through
--    getPublicUrl() only if the bucket is public — if you want admins to be
--    able to open submitted files, either keep the bucket public (files are
--    already keyed by random timestamp + user id, so this is "unlisted" not
--    private) or add an admin storage policy below and switch UserForms.jsx
--    to use createSignedUrl() instead of getPublicUrl().
-- -----------------------------------------------------------------------------
drop policy if exists "submissions_owner_access" on storage.objects;
create policy "submissions_owner_access"
  on storage.objects for all
  using (
    bucket_id = 'submissions'
    and (auth.uid()::text = (storage.foldername(name))[1] or has_role(auth.uid(), 'admin'))
  )
  with check (
    bucket_id = 'submissions'
    and (auth.uid()::text = (storage.foldername(name))[1] or has_role(auth.uid(), 'admin'))
  );

-- =============================================================================
-- Reference only — the has_role() function this migration depends on.
-- Uncomment and run ONCE if it does not already exist in your project
-- (it's already referenced by supabase/create-staff/index.ts, so it most
-- likely exists already).
-- =============================================================================
-- create or replace function public.has_role(_user_id uuid, _role public.app_role)
-- returns boolean
-- language sql
-- stable
-- security definer
-- set search_path = public
-- as $$
--   select exists (
--     select 1 from public.user_roles
--     where user_id = _user_id and role = _role
--   )
-- $$;
