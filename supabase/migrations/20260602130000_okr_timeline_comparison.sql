-- OKR timeline: month_number + cumulative comparison by day of year

create or replace function public.parse_okr_month_number(label text)
returns integer
language plpgsql
immutable
as $$
declare
  text_value text;
begin
  text_value := lower(trim(coalesce(label, '')));
  if text_value = '' then
    return 0;
  end if;
  if text_value in ('gennaio', 'gen', '1', '01') then return 1; end if;
  if text_value in ('febbraio', 'feb', '2', '02') then return 2; end if;
  if text_value in ('marzo', 'mar', '3', '03') then return 3; end if;
  if text_value in ('aprile', 'apr', '4', '04') then return 4; end if;
  if text_value in ('maggio', 'mag', '5', '05') then return 5; end if;
  if text_value in ('giugno', 'giu', '6', '06') then return 6; end if;
  if text_value in ('luglio', 'lug', '7', '07') then return 7; end if;
  if text_value in ('agosto', 'ago', '8', '08') then return 8; end if;
  if text_value in ('settembre', 'set', '9', '09') then return 9; end if;
  if text_value in ('ottobre', 'ott', '10') then return 10; end if;
  if text_value in ('novembre', 'nov', '11') then return 11; end if;
  if text_value in ('dicembre', 'dic', '12') then return 12; end if;
  return 0;
end;
$$;

alter table public.okr_records
  add column if not exists month_number integer not null default 0
  check (month_number >= 0 and month_number <= 12);

update public.okr_records
set month_number = public.parse_okr_month_number(month_label)
where month_number = 0 or month_number is null;

create index if not exists idx_okr_records_year_month
  on public.okr_records (year, month_number);

create or replace function public.get_okr_year_comparison_at_day(
  target_day integer,
  compare_years integer[] default array[2025, 2026]
)
returns table (
  year integer,
  okr_count bigint,
  okr_amount numeric,
  through_month integer,
  through_day integer
)
language plpgsql
stable
as $$
declare
  y integer;
  ref_date date;
  month_limit integer;
begin
  if target_day is null or target_day < 1 or target_day > 366 then
    raise exception 'target_day must be between 1 and 366';
  end if;

  foreach y in array compare_years loop
    ref_date := make_date(y, 1, 1) + (target_day - 1);
    month_limit := extract(month from ref_date)::integer;

    return query
    select
      y,
      count(*)::bigint,
      coalesce(sum(r.amount), 0::numeric),
      month_limit,
      extract(day from ref_date)::integer
    from public.okr_records r
    where r.year = y
      and r.month_number > 0
      and r.month_number <= month_limit;
  end loop;
end;
$$;

grant execute on function public.get_okr_year_comparison_at_day(integer, integer[]) to authenticated, anon;
