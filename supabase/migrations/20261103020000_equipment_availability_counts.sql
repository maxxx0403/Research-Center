create or replace function public.get_equipment_availability(
  p_equipment_ids integer[],
  p_start_datetime timestamptz,
  p_end_datetime timestamptz
)
returns table (
  equipment_id integer,
  available_quantity integer,
  reserved_quantity integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with requested_equipment as (
    select item.id, item.quantity
    from public.equipment item
    where item.id = any(coalesce(p_equipment_ids, '{}'::integer[]))
  ),
  overlapping_reservations as (
    select
      reservation.equipment_id,
      greatest(reservation.start_datetime, p_start_datetime) as overlap_start,
      least(reservation.end_datetime, p_end_datetime) as overlap_end,
      reservation.quantity_reserved
    from public.equipment_reservations reservation
    where reservation.equipment_id = any(coalesce(p_equipment_ids, '{}'::integer[]))
      and reservation.status in ('pending', 'reserved', 'in_use')
      and reservation.start_datetime < p_end_datetime
      and reservation.end_datetime > p_start_datetime

    union all

    select
      reservation_equipment.equipment_id,
      greatest(reservation.start_datetime, p_start_datetime) as overlap_start,
      least(reservation.end_datetime, p_end_datetime) as overlap_end,
      reservation_equipment.quantity_reserved
    from public.reservation_equipment reservation_equipment
    join public.reservations reservation
      on reservation.id = reservation_equipment.reservation_id
    where reservation_equipment.equipment_id = any(coalesce(p_equipment_ids, '{}'::integer[]))
      and reservation.status in ('pending', 'reserved', 'in_use')
      and reservation.start_datetime < p_end_datetime
      and reservation.end_datetime > p_start_datetime
  ),
  reservation_events as (
    select equipment_id, overlap_start as event_time, quantity_reserved as quantity_delta
    from overlapping_reservations
    union all
    select equipment_id, overlap_end as event_time, -quantity_reserved as quantity_delta
    from overlapping_reservations
  ),
  grouped_events as (
    select equipment_id, event_time, sum(quantity_delta) as quantity_delta
    from reservation_events
    group by equipment_id, event_time
  ),
  running_reserved as (
    select
      equipment_id,
      sum(quantity_delta) over (
        partition by equipment_id
        order by event_time
        rows between unbounded preceding and current row
      ) as quantity
    from grouped_events
  ),
  reserved_totals as (
    select equipment_id, greatest(max(quantity), 0)::integer as quantity
    from running_reserved
    group by equipment_id
  )
  select requested_equipment.id,
    greatest(requested_equipment.quantity - coalesce(reserved_totals.quantity, 0), 0),
    coalesce(reserved_totals.quantity, 0)
  from requested_equipment
  left join reserved_totals on reserved_totals.equipment_id = requested_equipment.id
  order by requested_equipment.id;
$$;

revoke all on function public.get_equipment_availability(integer[], timestamptz, timestamptz) from public, anon;
grant execute on function public.get_equipment_availability(integer[], timestamptz, timestamptz) to authenticated;

notify pgrst, 'reload schema';
