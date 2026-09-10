-- ------------------------------------------------------------------
--    cammap - migration 009: is a report already waiting here?
--
--    Adds pending_near(lat, lon): the one question the report form
--    may ask the database before Send, so a person placing a pin
--    hears "someone reported this corner two days ago" while they
--    are still placing it rather than "refused" after they have
--    typed everything and attached a photograph. Nothing else
--    changes.
--
--    Run this in the Supabase SQL editor, after 008. Nothing is
--    applied automatically; the maintainer runs
--    it. Safe to run again - the function is create-or-replace - and
--    a fresh database gets the same result from schema.sql, which
--    carries this as "version 2.11". The two must say the same
--    thing; if you change one, change the other.
--
--    Why a function and not a select: the reports read policy shows
--    a person their own rows and a moderator everyone's, and that is
--    right - it is the policy that keeps who-reported-what from
--    anyone else. A plain select from the form could therefore never
--    see another person's pending report, which is exactly the one
--    the question is about. So the answer comes through one narrow
--    window, security definer, that reads across the policy and
--    hands back two fields.
--
--    The anonymity test - what does a stranger learn by calling this
--    repeatedly? Whether a new-camera report is waiting within the
--    auto-approve radius of any point in London, and how many days
--    ago the newest was sent. Not who sent it, not how many people,
--    not its kind, note or exact position. "A report is waiting near
--    here" is the same thing the map would show at that spot once
--    the report is approved, minus the position, and it says nothing
--    about any account; that is why it is acceptable, and why the
--    function is granted to anon as well - the signed-out visitor is
--    filling the form now. What is withheld and why: the count of
--    reports, because the sentence has no use for it and a count is
--    a finer instrument than a flag - watched over time it would say
--    when each report arrived, one by one; and the exact time,
--    rounded to whole days for the same reason. Coordinates in, two
--    fields out, no identity anywhere: that is the line, and it is
--    the line every call the browser may make is held to.
--    It is rate-limited by its own cheapness - one probe of
--    reports_pending_cell_idx, the same grid walk cluster_of_report
--    makes - and returns for a point outside London without looking.
--
--    The column is `found`, not `exists`: exists is a keyword, and a
--    column that has to be quoted everywhere it is read is a trap
--    laid for whoever reads it next.
-- ------------------------------------------------------------------

create or replace function public.pending_near(lat double precision, lon double precision)
returns table (found boolean, days_ago integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with s as (
    select auto_approve_radius_m::double precision as radius,
           ceil(auto_approve_radius_m / 111.32)::integer as nlat,
           ceil(auto_approve_radius_m / (111.32 * cos(radians(pending_near.lat))))::integer as nlon
      from public.settings where id = 1),
  here as (
    select round(pending_near.lat::numeric, 3) as clat,
           round(pending_near.lon::numeric, 3) as clon),
  newest as (
    select max(r.created_at) as at
      from public.reports r, s, here
     where pending_near.lat between 51.28 and 51.70
       and pending_near.lon between -0.51 and 0.33
       and r.kind = 'new'
       and r.state = 'pending'
       and r.cell_lat between here.clat - s.nlat * 0.001 and here.clat + s.nlat * 0.001
       and r.cell_lon between here.clon - s.nlon * 0.001 and here.clon + s.nlon * 0.001
       and public.metres_between(pending_near.lat, pending_near.lon, r.lat, r.lon) <= s.radius)
  select at is not null,
         case when at is null then null
              else floor(extract(epoch from (now() - at)) / 86400)::integer end
    from newest;
$$;

revoke all on function public.pending_near(double precision, double precision) from public, anon, authenticated;
grant execute on function public.pending_near(double precision, double precision) to anon, authenticated, service_role;
