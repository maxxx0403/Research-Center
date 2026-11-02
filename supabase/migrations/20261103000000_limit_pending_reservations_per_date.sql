create or replace function public.get_pending_reservation_counts(p_dates date[])
returns table (reservation_date date, pending_count bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with requested_dates as (
    select distinct requested_date
    from unnest(coalesce(p_dates, '{}'::date[])) as dates(requested_date)
  ),
  pending_bookings as (
    select
      (r.start_datetime at time zone 'Asia/Manila')::date as booking_date,
      coalesce(r.batch_id::text, 'lab:' || r.id::text) as booking_key
    from public.reservations r
    where r.status = 'pending'
    union all
    select
      (e.start_datetime at time zone 'Asia/Manila')::date as booking_date,
      coalesce(e.batch_id::text, 'equipment:' || e.id::text) as booking_key
    from public.equipment_reservations e
    where e.status = 'pending'
  )
  select requested_dates.requested_date, count(distinct pending_bookings.booking_key)
  from requested_dates
  left join pending_bookings on pending_bookings.booking_date = requested_dates.requested_date
  group by requested_dates.requested_date
  order by requested_dates.requested_date;
$$;

revoke all on function public.get_pending_reservation_counts(date[]) from public, anon;
grant execute on function public.get_pending_reservation_counts(date[]) to authenticated;

create or replace function public.enforce_pending_reservation_date_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  booking_date date;
  pending_booking_count bigint;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.status = 'pending'
    and old.start_datetime is not distinct from new.start_datetime then
    return new;
  end if;

  booking_date := (new.start_datetime at time zone 'Asia/Manila')::date;
  perform pg_advisory_xact_lock(hashtextextended('pending-reservation-date-limit', 0));

  select count(distinct pending.booking_key)
  into pending_booking_count
  from (
    select coalesce(r.batch_id::text, 'lab:' || r.id::text) as booking_key
    from public.reservations r
    where r.status = 'pending'
      and (r.start_datetime at time zone 'Asia/Manila')::date = booking_date
      and not (tg_table_name = 'reservations' and tg_op = 'UPDATE' and r.id = new.id)
    union all
    select coalesce(e.batch_id::text, 'equipment:' || e.id::text) as booking_key
    from public.equipment_reservations e
    where e.status = 'pending'
      and (e.start_datetime at time zone 'Asia/Manila')::date = booking_date
      and not (tg_table_name = 'equipment_reservations' and tg_op = 'UPDATE' and e.id = new.id)
  ) pending;

  if pending_booking_count >= 3 then
    raise exception using
      errcode = 'P0001',
      message = 'PENDING_RESERVATION_DATE_LIMIT',
      detail = 'The limit of 3 pending bookings for this date has been reached.';
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_pending_date_limit on public.reservations;
create trigger reservations_pending_date_limit
  before insert or update of status, start_datetime on public.reservations
  for each row execute function public.enforce_pending_reservation_date_limit();

drop trigger if exists equipment_reservations_pending_date_limit on public.equipment_reservations;
create trigger equipment_reservations_pending_date_limit
  before insert or update of status, start_datetime on public.equipment_reservations
  for each row execute function public.enforce_pending_reservation_date_limit();

notify pgrst, 'reload schema';
