create table if not exists public.reservation_occupancy_contributions (
  laboratory_id integer not null references public.laboratories(id) on delete cascade,
  reservation_key text not null,
  attendee_count integer not null check (attendee_count > 0),
  primary key (laboratory_id, reservation_key)
);

alter table public.reservation_occupancy_contributions enable row level security;
revoke all on public.reservation_occupancy_contributions from public, anon, authenticated;

create or replace function public.refresh_reservation_occupancy(
  p_laboratory_id integer,
  p_reservation_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_count integer := 0;
  active_count integer := 0;
begin
  if p_laboratory_id is null or p_reservation_key is null then
    return;
  end if;

  perform 1
  from public.laboratories
  where id = p_laboratory_id
  for update;

  select attendee_count
  into previous_count
  from public.reservation_occupancy_contributions
  where laboratory_id = p_laboratory_id
    and reservation_key = p_reservation_key
  for update;
  previous_count := coalesce(previous_count, 0);

  select coalesce(max(attendee_count), 0)
  into active_count
  from (
    select cardinality(coalesce(r.members_list, array[]::text[])) + 1 as attendee_count
    from public.reservations r
    where r.laboratory_id = p_laboratory_id
      and coalesce(r.batch_id::text, 'lab:' || r.id::text) = p_reservation_key
      and r.status = 'in_use'

    union all

    select cardinality(coalesce(er.members_list, array[]::text[])) + 1 as attendee_count
    from public.equipment_reservations er
    join public.equipment e on e.id = er.equipment_id
    where e.laboratory_id = p_laboratory_id
      and coalesce(er.batch_id::text, 'equipment:' || er.id::text) = p_reservation_key
      and er.status = 'in_use'
  ) active_reservations;

  if active_count = previous_count then
    return;
  elsif active_count = 0 then
    delete from public.reservation_occupancy_contributions
    where laboratory_id = p_laboratory_id
      and reservation_key = p_reservation_key;
  else
    insert into public.reservation_occupancy_contributions (laboratory_id, reservation_key, attendee_count)
    values (p_laboratory_id, p_reservation_key, active_count)
    on conflict (laboratory_id, reservation_key)
    do update set attendee_count = excluded.attendee_count;
  end if;

  update public.laboratories
  set current_occupancy = greatest(coalesce(current_occupancy, 0) + active_count - previous_count, 0),
      status = case
        when status = 'maintenance' then status
        when max_capacity > 0
          and greatest(coalesce(current_occupancy, 0) + active_count - previous_count, 0) >= max_capacity
          then 'occupied'
        else 'available'
      end
  where id = p_laboratory_id;
end;
$$;

revoke all on function public.refresh_reservation_occupancy(integer, text) from public, anon, authenticated;

create or replace function public.sync_lab_reservation_occupancy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_key text;
  new_key text;
begin
  if tg_op = 'DELETE' then
    old_key := coalesce(old.batch_id::text, 'lab:' || old.id::text);
    perform public.refresh_reservation_occupancy(old.laboratory_id, old_key);
    return null;
  end if;

  if tg_op = 'INSERT' then
    new_key := coalesce(new.batch_id::text, 'lab:' || new.id::text);
    perform public.refresh_reservation_occupancy(new.laboratory_id, new_key);
    return null;
  end if;

  old_key := coalesce(old.batch_id::text, 'lab:' || old.id::text);
  new_key := coalesce(new.batch_id::text, 'lab:' || new.id::text);
  if old.laboratory_id is distinct from new.laboratory_id or old_key is distinct from new_key then
    perform public.refresh_reservation_occupancy(old.laboratory_id, old_key);
    perform public.refresh_reservation_occupancy(new.laboratory_id, new_key);
  elsif old.status is distinct from new.status or old.members_list is distinct from new.members_list then
    perform public.refresh_reservation_occupancy(new.laboratory_id, new_key);
  end if;

  return null;
end;
$$;

create or replace function public.sync_equipment_reservation_occupancy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_key text;
  new_key text;
  old_laboratory_id integer;
  new_laboratory_id integer;
begin
  if tg_op = 'DELETE' then
    old_key := coalesce(old.batch_id::text, 'equipment:' || old.id::text);
    select laboratory_id into old_laboratory_id
    from public.equipment
    where id = old.equipment_id;
    perform public.refresh_reservation_occupancy(old_laboratory_id, old_key);
    return null;
  end if;

  if tg_op = 'INSERT' then
    new_key := coalesce(new.batch_id::text, 'equipment:' || new.id::text);
    select laboratory_id into new_laboratory_id
    from public.equipment
    where id = new.equipment_id;
    perform public.refresh_reservation_occupancy(new_laboratory_id, new_key);
    return null;
  end if;

  old_key := coalesce(old.batch_id::text, 'equipment:' || old.id::text);
  new_key := coalesce(new.batch_id::text, 'equipment:' || new.id::text);
  select laboratory_id into old_laboratory_id
  from public.equipment
  where id = old.equipment_id;
  select laboratory_id into new_laboratory_id
  from public.equipment
  where id = new.equipment_id;

  if old_laboratory_id is distinct from new_laboratory_id or old_key is distinct from new_key then
    perform public.refresh_reservation_occupancy(old_laboratory_id, old_key);
    perform public.refresh_reservation_occupancy(new_laboratory_id, new_key);
  elsif old.status is distinct from new.status or old.members_list is distinct from new.members_list then
    perform public.refresh_reservation_occupancy(new_laboratory_id, new_key);
  end if;

  return null;
end;
$$;

revoke all on function public.sync_lab_reservation_occupancy() from public, anon, authenticated;
revoke all on function public.sync_equipment_reservation_occupancy() from public, anon, authenticated;

drop trigger if exists reservations_sync_occupancy on public.reservations;
create trigger reservations_sync_occupancy
after insert or delete or update of status, members_list, laboratory_id, batch_id
on public.reservations
for each row execute function public.sync_lab_reservation_occupancy();

drop trigger if exists equipment_reservations_sync_occupancy on public.equipment_reservations;
create trigger equipment_reservations_sync_occupancy
after insert or delete or update of status, members_list, equipment_id, batch_id
on public.equipment_reservations
for each row execute function public.sync_equipment_reservation_occupancy();

do $$
declare
  reservation_group record;
begin
  for reservation_group in
    select laboratory_id, reservation_key, max(attendee_count) as attendee_count
    from (
      select
        r.laboratory_id,
        coalesce(r.batch_id::text, 'lab:' || r.id::text) as reservation_key,
        cardinality(coalesce(r.members_list, array[]::text[])) + 1 as attendee_count
      from public.reservations r
      where r.status = 'in_use'

      union all

      select
        e.laboratory_id,
        coalesce(er.batch_id::text, 'equipment:' || er.id::text) as reservation_key,
        cardinality(coalesce(er.members_list, array[]::text[])) + 1 as attendee_count
      from public.equipment_reservations er
      join public.equipment e on e.id = er.equipment_id
      where er.status = 'in_use'
        and e.laboratory_id is not null
    ) active_reservations
    group by laboratory_id, reservation_key
  loop
    insert into public.reservation_occupancy_contributions (laboratory_id, reservation_key, attendee_count)
    values (reservation_group.laboratory_id, reservation_group.reservation_key, reservation_group.attendee_count)
    on conflict (laboratory_id, reservation_key) do nothing;
  end loop;

  update public.laboratories l
  set current_occupancy = coalesce(l.current_occupancy, 0) + active_counts.attendee_count,
      status = case
        when l.status = 'maintenance' then l.status
        when l.max_capacity > 0
          and coalesce(l.current_occupancy, 0) + active_counts.attendee_count >= l.max_capacity
          then 'occupied'
        else 'available'
      end
  from (
    select laboratory_id, sum(attendee_count)::integer as attendee_count
    from public.reservation_occupancy_contributions
    group by laboratory_id
  ) active_counts
  where l.id = active_counts.laboratory_id;
end;
$$;
