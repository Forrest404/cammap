-- ------------------------------------------------------------------
--    cammap - migration 011: pending_near answers per cell
--
--    Replaces the body of pending_near(lat, lon) - same name, same
--    two arguments, same two output columns, same grants - so that
--    it answers for the 0.001 degree cell the caller's point falls
--    in, and the eight cells around it, rather than for a circle
--    drawn around every pending report. Nothing else changes, and
--    nothing is deleted.
--
--    Run this in the Supabase SQL editor, after 010. Nothing is
--    applied automatically; the maintainer runs
--    it. Safe to run again - the function is create-or-replace - and
--    a fresh database gets the same result from schema.sql, which
--    carries this as "version 2.13" (migration 009 was the first
--    form, "version 2.11"). The two must say the same thing; if you
--    change one, change the other.
--
--    Why. The first form tested metres_between(caller, report) <=
--    the auto-approve radius: a sharp edge exactly 100 m from the
--    report, which a stranger can walk. Its comment said "not its
--    exact position"; that was wrong. An adversarial pass after
--    An adversarial pass bisected the edge - fourteen halvings in
--    each of four
--    directions, 112 anonymous calls, five milliseconds - and
--    recovered a pending report's coordinates to six decimals on a
--    throwaway database. Any answer that changes at a distance
--    measured from the report's own position gives that position
--    away, given enough calls; the circle was the leak.
--
--    A cell is not measured from the report. The caller's point is
--    snapped to round(lat, 3), round(lon, 3) - the grid
--    reports.cell_lat and cell_lon already sit on - and every point
--    in a cell gets the same answer, so the only edge left to find
--    is a cell edge and the finest thing the whole grid of answers
--    gives away is which cell a report is in: one block of about
--    111 m by 69 m, which is what "someone reported this corner"
--    means anyway. The same bisection, run against this body, stops
--    at cell resolution: the box it recovers is the whole cell, and
--    a report anywhere in that cell gives the same box.
--
--    What a stranger learns by calling it repeatedly, honestly: that
--    a new-camera report is waiting somewhere in a three-by-three
--    block of cells around the point - about 330 m by 210 m - and how
--    many days ago the newest of those was sent. Not where in the
--    cell, not who sent it, not how many people, not its kind or
--    note. Walked over all of London, the answers give the set of
--    cells with a pending report in them and the day each arrived,
--    which is what the map will show once those reports are
--    approved, coarsened to the cell, and names no account. days_ago
--    is a clock all the same, at a day's resolution, and that is
--    accepted because it is what the sentence under the pin says.
--
--    Three by three rather than one, because a report a metre over
--    the cell line is still "this corner" and the auto-approve
--    radius reaches into the neighbouring cells. The block is fixed,
--    not derived from the radius the way the first form's search
--    window was, so the resolution of the answer never follows a
--    setting: raising the radius in the dashboard must not widen
--    what this gives away.
--
--    The London bounds are written out here as well as in the check
--    constraints; a point outside them is answered without looking.
--    A second city folds every copy of those four numbers
--    into one place; until then this is one of the copies.
-- ------------------------------------------------------------------

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
     where pending_near.lat between 51.28 and 51.70
       and pending_near.lon between -0.51 and 0.33
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
