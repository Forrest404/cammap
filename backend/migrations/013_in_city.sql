-- ------------------------------------------------------------------
--    cammap - migration 013: one copy of the city's box, in SQL
--
--    Adds the function in_city(lat, lon), points the three London
--    check constraints at it, and replaces the body of
--    pending_near(lat, lon) so that it asks the same function
--    instead of writing the numbers out a fourth time. No row
--    changes, no column is added or dropped, and the box is the same
--    box it has always been.
--
--    Run this in the Supabase SQL editor, after 012. Nothing is
--    applied automatically; the maintainer runs
--    it. Safe to run again - the function is create-or-replace and
--    each constraint is dropped by name and re-added - and a fresh
--    database gets the same result from schema.sql, which carries
--    this as "version 2.15". The two must say the same thing; if you
--    change one, change the other.
--
--    Why. The four numbers that say where this map is were written
--    out five times: CITY.bounds (until now LONDON_BOUNDS) in
--    frontend/shared.js, and four times in schema.sql - a check
--    constraint on cameras, one on reports, one on saved_cameras,
--    and a fourth inline in pending_near, the copy nothing was
--    holding to the others.
--    tools/stamp.py compared three of the four with shared.js and
--    could not see the fourth. Four copies that must agree, changed
--    by hand, in the one place where a wrong answer is a camera the
--    server refuses to store or a corner of London the report form
--    says nothing about.
--
--    The test is "there is exactly one place to change". SQL
--    cannot read JavaScript, so the honest reading of that is one
--    place per language and a check that holds the two together:
--    CITY in shared.js, in_city here, and stamp.py reading the four
--    numbers out of both. It also fails if a constraint or
--    pending_near goes back to writing them itself, so the shape
--    cannot quietly come apart again. A second city is then two
--    edits, and a commit that makes only one of them does not pass.
--
--    Why the function may be called from a check constraint at all:
--    it is immutable - the answer depends on its two arguments and
--    nothing else, no table, no clock, no setting - which is
--    PostgreSQL's condition for it. It is deliberately not "set
--    search_path": the body names no object, so there is nothing for
--    a search path to resolve, and a function carrying one cannot be
--    inlined by the planner, which this must be - it runs on every
--    insert into three tables and inside a function anyone may call.
--
--    Adding a check constraint validates every existing row. The box
--    has not moved, so every row already satisfies it; the point of
--    letting PostgreSQL check rather than declaring it NOT VALID is
--    that a database whose rows had somehow drifted outside the box
--    would say so here rather than years later.
--
--    Nothing about what anyone may read or do changes. The function
--    answers a question whose answer is published in shared.js and
--    drawn on every page - which part of the world this map covers -
--    so there is nothing in it to withhold; the revoke below is only
--    so the grant is written down rather than inherited from PUBLIC.
-- ------------------------------------------------------------------

create or replace function public.in_city(lat double precision, lon double precision)
returns boolean
language sql
immutable
parallel safe
as $$
  select lat between 51.28 and 51.70
     and lon between -0.51 and 0.33;
$$;

comment on function public.in_city(double precision, double precision) is
  'True where a point is inside the city this map is of. The one copy of the box on the SQL side; CITY.bounds in frontend/shared.js is the other, and tools/stamp.py holds the two together.';

revoke all on function public.in_city(double precision, double precision) from public;
grant execute on function public.in_city(double precision, double precision) to anon, authenticated, service_role;

-- The three constraints. Dropped by name first, because a constraint
-- cannot be redefined in place and a second one under a new name
-- would be a second copy again. Written out per table rather than in
-- a loop: three names, and a loop would hide which tables carry the
-- box from anyone reading this file for that answer.
alter table public.cameras drop constraint if exists cameras_in_london;
alter table public.cameras add constraint cameras_in_london
  check (public.in_city(lat, lon));

alter table public.reports drop constraint if exists reports_in_london;
alter table public.reports add constraint reports_in_london
  check (public.in_city(lat, lon));

alter table public.saved_cameras drop constraint if exists saved_cameras_in_london;
alter table public.saved_cameras add constraint saved_cameras_in_london
  check (public.in_city(lat, lon));

-- The fourth copy. Same name, same two arguments, same two output
-- columns, same grants, same answers: the only change is that the
-- "is this point in London at all" guard now asks in_city. It is a
-- cost guard rather than a lock - a caller outside London learns
-- nothing either way - but a guard that disagreed with the
-- constraints would answer "nothing here" for a corner of London
-- where a report can perfectly well be waiting. The rest of the
-- body, and the reasoning behind answering per cell rather than per
-- circle, is migration 011's and is unchanged.
create or replace function public.pending_near(lat double precision, lon double precision)
returns table (found boolean, days_ago integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with here as (
    select round(pending_near.lat::numeric, 3) as clat,
           round(pending_near.lon::numeric, 3) as clon),
  newest as (
    select max(r.created_at) as at
      from public.reports r, here
     where public.in_city(pending_near.lat, pending_near.lon)
       and r.kind = 'new'
       and r.state = 'pending'
       and r.cell_lat between here.clat - 0.001 and here.clat + 0.001
       and r.cell_lon between here.clon - 0.001 and here.clon + 0.001)
  select at is not null,
         case when at is null then null
              else floor(extract(epoch from (now() - at)) / 86400)::integer end
    from newest;
$$;

revoke all on function public.pending_near(double precision, double precision) from public, anon, authenticated;
grant execute on function public.pending_near(double precision, double precision) to anon, authenticated, service_role;
