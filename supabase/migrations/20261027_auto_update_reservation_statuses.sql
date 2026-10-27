create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.update_reservation_statuses()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reservations
  set status = 'completed'
  where status in ('reserved', 'in_use')
    and end_datetime <= now();

  update public.reservations
  set status = 'in_use'
  where status = 'reserved'
    and start_datetime <= now()
    and end_datetime > now();

  update public.equipment_reservations
  set status = 'completed'
  where status in ('reserved', 'in_use')
    and end_datetime <= now();

  update public.equipment_reservations
  set status = 'in_use'
  where status = 'reserved'
    and start_datetime <= now()
    and end_datetime > now();
end;
$$;

revoke all on function public.update_reservation_statuses() from public, anon, authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname = 'update-reservation-statuses';

select cron.schedule(
  'update-reservation-statuses',
  '* * * * *',
  'select public.update_reservation_statuses();'
);
