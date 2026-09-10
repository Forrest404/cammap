-- ------------------------------------------------------------------
--    cammap - migration 012: a public view of the cameras
--
--    Adds the view cameras_public - every visible camera, and only
--    the fourteen columns that are public - and moves the browser's
--    read of the cameras table onto it: anon's select on the table
--    is withdrawn altogether, and authenticated's is narrowed to a
--    column-level grant that leaves out approved_by, approved_at,
--    created_at and updated_at. Nothing is deleted; no row changes.
--
--    Run this in the Supabase SQL editor, after 011. Nothing is
--    applied automatically; the maintainer runs
--    it. Safe to run again - the view is create-or-replace, the
--    grants are revoked and re-granted by name - and a fresh database
--    gets the same result from schema.sql, which carries this as
--    "version 2.14". The two must say the same thing; if you change
--    one, change the other. Run it together with the site that reads
--    the view (map.js, picker.js and account.js after the privacy
--    fix round): until it is run those fall back to the table, and
--    once it is run the fallback is never taken.
--
--    Why. Every browser held the anon key, and the anon key had
--    select on the whole table: the read policy hid the rows that
--    are not visible and nothing hid a column. So anyone could group
--    the map by approved_by - a moderator's uuid, one per row they
--    approved - with approved_at and updated_at to the microsecond,
--    which is a moderator's working hours; and could set a camera's
--    approved_at beside the daily leaderboard, where a username's XP
--    rose by exactly that camera's rule in the same five-minute
--    window, which ties the username to the place and the moment
--    (NOTES.md "Anonymity"). Neither column was
--    ever read by a page.
--
--    The view is the read API - the one thing a browser, or anyone
--    with the anon key, may select cameras from - and the map's
--    source. It is not security_invoker: it is owned by the role
--    that runs this file, reads the table on that role's behalf,
--    and applies its own "where visible", so the table's grant to
--    anon can go entirely and the row policy on the table is no
--    longer what stands between a stranger and a hidden row - the
--    view's filter is. The dashboard's Security Advisor will list it
--    as a "security definer view"; that is this, on purpose. A
--    column added to cameras is not public until it is added here,
--    at the end of the list so that create-or-replace still applies.
--
--    A moderator's browser keeps reading the table, because the
--    moderation page needs hidden rows and source, which the view
--    does not carry, under the same row policy as before. What it
--    reads was checked column by column - the Cameras tab, Move,
--    Edit, Merge, the history, the queue and the activity log - and
--    none of it names the four withheld columns, so the grant is
--    exactly the columns it does read plus the public ones. One
--    consequence to keep: PostgREST refuses a star select when any
--    column is denied, so a read of cameras from account.js must
--    always name its columns, and does.
-- ------------------------------------------------------------------

create or replace view public.cameras_public as
  select id, name, note, lat, lon, type, status, last_seen, deployments,
         seed_key, periods, source_label, source_url, approximate
    from public.cameras
   where visible;

comment on view public.cameras_public is
  'The read API and the map''s source: every visible camera, and only the columns that are public. A column added to cameras is not public until it is added here.';

revoke all on public.cameras_public from anon, authenticated;
grant select on public.cameras_public to anon, authenticated, service_role;

-- The table itself: nothing for anon; for authenticated, the columns
-- the moderation page reads and no others. A revoke of a table-level
-- privilege takes its column-level privileges with it, so this is
-- the same on a second run.
revoke all on public.cameras from anon, authenticated;
grant select (id, name, note, lat, lon, type, status, last_seen, deployments,
              source, seed_key, visible, periods, source_label, source_url, approximate)
  on public.cameras to authenticated;
