create or replace function public.prevent_duplicate_laboratory()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
    and lower(btrim(old.lab_code)) = lower(btrim(new.lab_code))
    and lower(btrim(old.lab_name)) = lower(btrim(new.lab_name))
    and lower(btrim(coalesce(old.floor, ''))) = lower(btrim(coalesce(new.floor, ''))) then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('laboratory-catalog-duplicate-check', 0));

  if exists (
    select 1
    from public.laboratories lab
    where lab.id is distinct from new.id
      and (
        lower(btrim(lab.lab_code)) = lower(btrim(new.lab_code))
        or (
          lower(btrim(lab.lab_name)) = lower(btrim(new.lab_name))
          and lower(btrim(coalesce(lab.floor, ''))) = lower(btrim(coalesce(new.floor, '')))
        )
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'DUPLICATE_LABORATORY',
      detail = 'A laboratory with the same code or the same name and floor already exists.';
  end if;

  return new;
end;
$$;

drop trigger if exists laboratories_prevent_duplicate on public.laboratories;
create trigger laboratories_prevent_duplicate
  before insert or update of lab_name, lab_code, floor on public.laboratories
  for each row execute function public.prevent_duplicate_laboratory();

create or replace function public.prevent_duplicate_equipment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
    and lower(btrim(old.name)) = lower(btrim(new.name))
    and lower(btrim(coalesce(old.brand, ''))) = lower(btrim(coalesce(new.brand, '')))
    and lower(btrim(coalesce(old.model, ''))) = lower(btrim(coalesce(new.model, '')))
    and old.laboratory_id is not distinct from new.laboratory_id then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('equipment-catalog-duplicate-check', 0));

  if exists (
    select 1
    from public.equipment item
    where item.id is distinct from new.id
      and lower(btrim(item.name)) = lower(btrim(new.name))
      and lower(btrim(coalesce(item.brand, ''))) = lower(btrim(coalesce(new.brand, '')))
      and lower(btrim(coalesce(item.model, ''))) = lower(btrim(coalesce(new.model, '')))
      and item.laboratory_id is not distinct from new.laboratory_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'DUPLICATE_EQUIPMENT',
      detail = 'Equipment with the same name, brand, model, and laboratory already exists.';
  end if;

  return new;
end;
$$;

drop trigger if exists equipment_prevent_duplicate on public.equipment;
create trigger equipment_prevent_duplicate
  before insert or update of name, brand, model, laboratory_id on public.equipment
  for each row execute function public.prevent_duplicate_equipment();

notify pgrst, 'reload schema';
