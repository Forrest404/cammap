-- ------------------------------------------------------------------
--    cammap - migration 001: periods
--
--    Adds to public.cameras a jsonb column, periods, holding the
--    deployment count broken down by the period the source gives it
--    in - {"2023-24": 1}, {"2023-2025": 3}, {"2026": 4} - and the two
--    helper functions and two check constraints that keep it honest.
--    deployments stays and is the sum.
--
--    Run this in the Supabase SQL editor, then run backend/seed.sql
--    again: the seed's on-conflict update carries periods, so the
--    re-run fills the column on every seed row. Nothing is applied by
--    anything in this repository; the maintainer runs it.
--
--    Safe to run on a database that already has it - every statement
--    is add-if-missing or drop-then-add - and a fresh database gets
--    the same result from schema.sql, which carries this block as
--    "version 2.3". The two must say the same thing; if you change one,
--    change the other.
--
--    Why by period and not by year: the Met publishes "3 deployments
--    2023-2025" and not which year each fell in. A column keyed by
--    year would hold an estimate, and this project does not estimate
--    ("Nothing here is estimated", data/points.js). The key is the
--    period exactly as the record states it, one of YYYY, YYYY-YY or
--    YYYY-YYYY, which is the whole of the vocabulary the sources use.
--    null means the source names no period - a shop, a fixed install,
--    a camera that came from a report - and never an empty object.
-- ------------------------------------------------------------------

-- Valid: null, or a non-empty object whose every key is a period and
-- whose every value is a positive integer. Immutable so a check
-- constraint may call it. The key pattern is the same one
-- tools/build_points.py and tools/check.js use; change one, change
-- the three.
create or replace function public.periods_valid(p jsonb)
returns boolean
language sql
immutable
as $$
  select p is null
      or (jsonb_typeof(p) = 'object'
          and p <> '{}'::jsonb
          and not exists (
            select 1
              from jsonb_each(p) as kv(key, value)
             where kv.key !~ '^\d{4}(-\d{2}|-\d{4})?$'
                or jsonb_typeof(kv.value) <> 'number'
                or kv.value::text !~ '^[1-9]\d*$'));
$$;

-- The sum of a valid breakdown, or null for anything else - so the
-- constraint below compares deployments with a number, or with null,
-- and never raises a cast error on a value periods_valid would already
-- have refused.
create or replace function public.periods_total(p jsonb)
returns integer
language sql
immutable
as $$
  select case
           when p is not null and public.periods_valid(p)
           then (select sum((kv.value::text)::integer)::integer
                   from jsonb_each(p) as kv(key, value))
         end;
$$;

alter table public.cameras
  add column if not exists periods jsonb;

alter table public.cameras drop constraint if exists cameras_periods_check;
alter table public.cameras add constraint cameras_periods_check
  check (public.periods_valid(periods));

alter table public.cameras drop constraint if exists cameras_periods_total_check;
alter table public.cameras add constraint cameras_periods_total_check
  check (periods is null or deployments = public.periods_total(periods));

comment on column public.cameras.periods is
  'Deployments counted by the period the source gives them in, {"2023-24": 1}; null where the source names no period. deployments is the sum.';
