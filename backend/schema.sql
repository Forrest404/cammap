-- ------------------------------------------------------------------
--    cammap - supabase schema, version 2
--
--    Backs the whole site now, not just the accounts page. The map
--    reads its pins from the cameras table; points.js is the seed for
--    that table (see seed.sql, written out by build_points.py) and the
--    offline fallback if the database cannot be reached.
--
--    What a signed-in person can do through the anon key:
--      - save cameras to a private list (as before)
--      - report a new camera, or report the status of one on the map
--        (nonfunctional, removed, active again), with photo or video
--        proof in a private storage bucket
--      - see their own reports and XP, and the public leaderboards
--
--    What they can never do through the anon key: put a pin on the
--    map, change a report's state, change their own role, or award
--    themselves XP. Those happen only inside security definer
--    functions below, or with the service role key, which never goes
--    near the browser.
--
--    A report becomes a camera in one of two ways: a moderator
--    approves it (moderate_report), or enough separate people report
--    the same thing in the same place and it approves itself
--    (try_auto_approve - the threshold, radius and account-age floor
--    live in the settings table). Either way approve_report does the
--    work, so both paths behave identically.
--
--    Paste this whole file into the supabase SQL editor and run it,
--    then run seed.sql. It is safe to run more than once: tables and
--    indexes are guarded, functions are create-or-replace, policies
--    and triggers are dropped and recreated, and the upgrade from
--    version 1 (further down) is a no-op on a database that never had
--    version 1.
--
--    Every function that reads or writes a table is security definer
--    with search_path pinned to "public, pg_temp" - pg_temp last, so a
--    temporary table of the same name as a real one can never shadow
--    it. Each function is revoked from anon and authenticated first
--    and then granted only to whoever is meant to call it.
-- ------------------------------------------------------------------

-- ---------------- helpers used inside policies ----------------

-- These come first because policies further down mention them.
-- plpgsql does not look tables up until the function first runs, so
-- it is fine for them to be defined before the tables exist.

-- True if the caller is a moderator or admin. Read from the profiles
-- row on every statement rather than from a claim in the JWT: a claim
-- is minted at sign-in and lasts for the life of the token, so a
-- demotion would take up to an hour to bite, and adding custom claims
-- means an access-token hook in the dashboard - one more thing to set
-- up and get wrong. This is a single primary-key lookup on a cached
-- plan. Where a policy says "own row or moderator", it is only reached
-- for rows the first half did not already admit - so never for a
-- person reading their own things, and once per row on a moderator's
-- page of fifty.
create or replace function public.is_moderator()
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return coalesce(
    (select p.role in ('moderator', 'admin')
       from public.profiles p
      where p.id = auth.uid()),
    false);
end;
$$;

-- Granted to anon as well: the cameras policy asks it, and a signed-
-- out map visitor must get "false" from it, not "permission denied".
revoke all on function public.is_moderator() from public, anon, authenticated;
grant execute on function public.is_moderator() to anon, authenticated, service_role;

-- True if the report exists, belongs to the caller and is still
-- pending. Used to gate proof uploads and deletions.
create or replace function public.owns_pending_report(rid bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return exists (
    select 1 from public.reports r
     where r.id = rid and r.user_id = auth.uid() and r.state = 'pending');
end;
$$;

revoke all on function public.owns_pending_report(bigint) from public, anon, authenticated;
grant execute on function public.owns_pending_report(bigint) to authenticated, service_role;

-- Proof files live at <user id>/<report id>/<file name> in the proof
-- bucket. This checks that a path is under the caller's own prefix
-- and names a pending report of theirs. The digits check comes before
-- the cast on purpose - plpgsql runs statements in order, whereas a
-- plain SQL "and" makes no promise about which side runs first.
create or replace function public.proof_path_pending(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  who text := split_part(object_name, '/', 1);
  rid text := split_part(object_name, '/', 2);
begin
  if who = '' or who <> coalesce(auth.uid()::text, '') then
    return false;
  end if;
  if rid !~ '^[0-9]{1,18}$' then
    return false;
  end if;
  return public.owns_pending_report(rid::bigint);
end;
$$;

revoke all on function public.proof_path_pending(text) from public, anon, authenticated;
grant execute on function public.proof_path_pending(text) to authenticated, service_role;

-- ---------------- profiles ----------------

-- One row per account, keyed to auth.users so it can never outlive the
-- user it belongs to. Created automatically by the trigger further
-- down - the frontend never inserts into this table itself.
--
-- username is the site-generated two-word name (copper.heron) that
-- sign-up passes in options.data.username; the sign-up trigger copies
-- it here. It is null only on the anonymous accounts version 1 made,
-- which are left as they are. role is user, moderator or admin and
-- only the service role can change it - see the column grant below.
-- xp_total is a running total kept in step by a trigger on xp_events,
-- so the leaderboard never has to add anything up.
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text,
  role       text not null default 'user',
  xp_total   integer not null default 0,
  created_at timestamptz not null default now()
);

-- Upgrade from version 1, where profiles had only id, a handle and
-- created_at. The handle was never used by the site and is dropped;
-- the rest is added. Harmless on a fresh database.
alter table public.profiles
  add column if not exists username text,
  add column if not exists role text not null default 'user',
  add column if not exists xp_total integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'profiles_role_check'
                    and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_role_check
      check (role in ('user', 'moderator', 'admin'));
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'profiles_username_check'
                    and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_username_check
      check (username is null or username ~ '^[a-z]{3,12}\.[a-z]{3,12}$');
  end if;
end $$;

-- Case-insensitive uniqueness. The pattern above is lower-case only,
-- so this is belt and braces against anything that writes a profile
-- row without going through the sign-up trigger.
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

alter table public.profiles enable row level security;

-- A person reads their own row; a moderator reads anyone's, because
-- the queue shows who sent each report. Nothing in a profile is
-- secret from a moderator - a username, a role, a total - and the
-- reports themselves already carry the user id.
drop policy if exists "profiles: read own" on public.profiles;
drop policy if exists "profiles: read own or moderator" on public.profiles;
create policy "profiles: read own or moderator"
  on public.profiles for select
  using (auth.uid() = id or public.is_moderator());

drop policy if exists "profiles: update own" on public.profiles;

-- No insert or delete policy. Rows are created by the trigger below,
-- which runs as the table owner and so is not subject to these
-- policies at all, and are removed only by deleting the auth.users
-- row (which cascades here), not by a client request.

-- Revoke from both roles first, so the grant that follows is the whole
-- truth. Supabase hands `authenticated` a full set of table rights by
-- default on anything created in public, and a plain `grant` does not
-- take those away. Left alone, the only thing stopping an update or a
-- delete is row level security - which does hold, but a refusal then
-- comes back as a silent "nothing changed" rather than an error. This
-- makes the refusal explicit as well.
--
-- No update at all from the client. There is nothing on a profile a
-- person should be able to change themselves - the username is
-- generated, the role and the total are the server's - so rather
-- than a column grant that has to stay exactly right, the whole
-- privilege is withheld. A row policy would let a person update
-- their own row; this makes sure there is no way to try.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

-- ---------------- settings ----------------

-- The knobs for auto-approval and rate limiting, in one row so they
-- can be changed in the dashboard without touching a function. The
-- defaults are only inserted if the row is missing, so re-running
-- this file never undoes an edit.
create table if not exists public.settings (
  id                       integer primary key check (id = 1),
  auto_approve_users       integer  not null,   -- distinct people needed to approve without a moderator
  auto_approve_radius_m    integer  not null,   -- how close their reports must be to count as the same camera
  min_account_age_for_auto interval not null,   -- accounts younger than this do not count toward that number
  reports_per_10min        integer  not null    -- per person, any kind
);

insert into public.settings
  (id, auto_approve_users, auto_approve_radius_m, min_account_age_for_auto, reports_per_10min)
values
  (1, 3, 100, interval '1 hour', 5)
on conflict (id) do nothing;

alter table public.settings enable row level security;

drop policy if exists "settings: read" on public.settings;
create policy "settings: read"
  on public.settings for select
  using (true);

revoke all on public.settings from anon, authenticated;
grant select on public.settings to anon, authenticated;

-- ---------------- xp_rules ----------------

-- How much each kind of approved report is worth. new_<type> for a
-- new camera of that type, status_<claim> for a status report, and a
-- one-off bonus on a person's first approved report. A type or claim
-- with no row here is worth nothing - new_nonfunccam is left out on
-- purpose, because "a new camera that does not work" is really a
-- status report, and status_active likewise, so that flipping a
-- camera back and forth cannot be farmed.
create table if not exists public.xp_rules (
  key text primary key,
  xp  integer not null
);

insert into public.xp_rules (key, xp) values
  ('new_fixedcam',         20),
  ('new_vancam',            5),
  ('new_transportcam',     50),
  ('new_facewatchcam',     10),
  ('new_privatecam',       10),
  ('status_nonfunctional', 50),
  ('status_removed',       20),
  ('first_report_bonus',   10)
on conflict (key) do nothing;

alter table public.xp_rules enable row level security;

drop policy if exists "xp_rules: read" on public.xp_rules;
create policy "xp_rules: read"
  on public.xp_rules for select
  using (true);

revoke all on public.xp_rules from anon, authenticated;
grant select on public.xp_rules to anon, authenticated;

-- ---------------- cameras ----------------

-- The pins on the map. The site loads every visible row on page open,
-- so the table is kept narrow. type uses the same identifiers as
-- points.js and map.js; status is what the pin looks like (legacy is
-- the hollow ring, nonfunctional the purple one). A camera that has
-- been removed is not deleted but hidden with visible = false, so the
-- reports that pointed at it still make sense.
--
-- source says where a row came from: seed rows are written by
-- seed.sql and carry a seed_key so the seed can be re-run without
-- doubling up; report rows are made by approve_report.
create table if not exists public.cameras (
  id          bigint generated always as identity primary key,
  name        text not null,
  note        text not null default '',
  lat         double precision not null,
  lon         double precision not null,
  -- the same list as CAMERA_TYPES in frontend/shared.js. Kept
  -- separately on purpose: the server has to be able to refuse a bad
  -- row without trusting anything a browser sent. Change one, change
  -- the other.
  type        text not null
                check (type in ('fixedcam', 'vancam', 'transportcam',
                                'facewatchcam', 'privatecam', 'nonfunccam')),
  status      text not null default 'active'
                check (status in ('active', 'legacy', 'nonfunctional')),
  last_seen   integer,                     -- the last year a source records it, or null
  deployments integer not null default 1,  -- how many times a source records it being used

  source      text not null check (source in ('seed', 'report', 'admin')),
  seed_key    text unique,                 -- name|lat|lon|type, seed rows only
  visible     boolean not null default true,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,   -- null when auto-approved or seeded
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- same bounds as LONDON_BOUNDS in frontend/shared.js
  constraint cameras_in_london check (
    lat between 51.28 and 51.70 and
    lon between -0.51 and 0.33
  )
);

-- version 2.1 widened source to allow 'admin'; on an older table the
-- check constraint has the old list, so it is replaced.
-- version 2.2 added deployments, which the map weighs its heat by.
-- A camera from a user report has no deployment history, so one.
alter table public.cameras
  add column if not exists deployments integer not null default 1;

alter table public.cameras drop constraint if exists cameras_source_check;
alter table public.cameras add constraint cameras_source_check
  check (source in ('seed', 'report', 'admin'));

create index if not exists cameras_visible_idx on public.cameras (visible);

-- Coordinates rounded to 0.001 degrees make a grid of roughly 111 m by
-- 69 m cells over London. Anything that asks "is there a camera near
-- here" first narrows to the handful of cells around the point through
-- this index and only then measures real distances, so the cost never
-- grows with the size of the table. Only visible cameras are ever
-- candidates, so only they are indexed.
create index if not exists cameras_cell_idx
  on public.cameras ((round(lat::numeric, 3)), (round(lon::numeric, 3)))
  where visible;

alter table public.cameras enable row level security;

drop policy if exists "cameras: read visible" on public.cameras;
drop policy if exists "cameras: read visible or moderator" on public.cameras;
create policy "cameras: read visible or moderator"
  on public.cameras for select
  using (visible or public.is_moderator());

-- Read only, for everyone. Nothing a browser sends can create, move,
-- rename or hide a camera - only approve_report and the service role
-- can, and the revoke makes an attempt fail loudly rather than
-- quietly doing nothing.
revoke all on public.cameras from anon, authenticated;
grant select on public.cameras to anon, authenticated;

-- ---------------- reports ----------------

-- Everything a signed-in person sends in. kind = new proposes a camera
-- that is not on the map; kind = status says something about one that
-- is (camera_id), namely that it is nonfunctional, has been removed,
-- or is active again. Both carry coordinates - a status report copies
-- the camera's - so the cell columns always exist.
--
-- state moves pending -> approved, rejected or merged, and only
-- approve_report and reject_report move it. merged means "this was a
-- camera already on the map"; it earns no XP.
create table if not exists public.reports (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  kind            text not null check (kind in ('new', 'status')),
  camera_id       bigint references public.cameras(id) on delete cascade,
  type            text
                    check (type in ('fixedcam', 'vancam', 'transportcam',
                                    'facewatchcam', 'privatecam', 'nonfunccam')),
  status_claim    text check (status_claim in ('nonfunctional', 'removed', 'active')),
  name            text,
  note            text not null default '',
  lat             double precision not null,
  lon             double precision not null,
  cell_lat        numeric generated always as (round(lat::numeric, 3)) stored,
  cell_lon        numeric generated always as (round(lon::numeric, 3)) stored,
  state           text not null default 'pending'
                    check (state in ('pending', 'approved', 'rejected', 'merged')),
  resolved_by     uuid references public.profiles(id) on delete set null,   -- null when auto-approved
  resolved_at     timestamptz,
  resolution_note text,
  created_at      timestamptz not null default now(),

  constraint reports_in_london check (
    lat between 51.28 and 51.70 and
    lon between -0.51 and 0.33
  ),

  -- a new-camera report needs a type and a name and makes no claim; a
  -- status report needs a camera and a claim (its type is the
  -- camera's). camera_id on a new report is filled in on approval.
  constraint reports_shape check (
    (kind = 'new'    and type is not null and name is not null and status_claim is null) or
    (kind = 'status' and camera_id is not null and status_claim is not null)
  )
);

-- The moderation queue: "pending, newest first".
create index if not exists reports_state_created_idx
  on public.reports (state, created_at desc);

-- Same grid as cameras_cell_idx, for finding the other pending reports
-- near a new one. Only pending rows are ever looked up this way, so
-- only they are indexed and the index stays small however long the
-- history grows.
create index if not exists reports_pending_cell_idx
  on public.reports (cell_lat, cell_lon)
  where state = 'pending';

-- A person's own list, and the rate limit's "how many in the last ten
-- minutes" - both walk this from the newest end.
create index if not exists reports_user_created_idx
  on public.reports (user_id, created_at desc);

-- Pending status reports for one camera, for counting agreement.
create index if not exists reports_pending_status_camera_idx
  on public.reports (camera_id)
  where kind = 'status' and state = 'pending';

-- One pending new-camera report per person per 0.0001 degree cell
-- (about 11 m by 7 m). Three reports from one account do not make a
-- crowd, and this is the cheap way to say so.
create unique index if not exists reports_one_new_per_cell_idx
  on public.reports (user_id, (round(lat::numeric, 4)), (round(lon::numeric, 4)))
  where kind = 'new' and state = 'pending';

-- One status report per person per camera, ever - so a camera cannot
-- be flipped nonfunctional, then active, then nonfunctional again by
-- the same account for XP each time. A moderator can delete a row with
-- the service role if someone genuinely needs a second go.
create unique index if not exists reports_one_status_per_camera_idx
  on public.reports (user_id, camera_id)
  where kind = 'status';

alter table public.reports enable row level security;

-- One thing the client must do: filter the "my reports" list by
-- user_id (.eq('user_id', uid)) rather than lean on this policy alone.
-- The moderator half of the "or" has no column in it, so the planner
-- cannot reach reports_user_created_idx through the policy by itself
-- and an unfiltered select would read the whole table; with the
-- filter it is one index probe. A moderator's queue is likewise
-- filtered by state and reads reports_state_created_idx, with
-- is_moderator() answered once per row on the page.
drop policy if exists "reports: read own or moderator" on public.reports;
create policy "reports: read own or moderator"
  on public.reports for select
  using (auth.uid() = user_id or public.is_moderator());

-- A person may send a report, but only as pending and only about
-- themselves: state, and the resolution columns, are pinned here
-- regardless of what the insert tries to send. A status report must
-- point at a camera the person can actually see.
drop policy if exists "reports: insert own pending" on public.reports;
create policy "reports: insert own pending"
  on public.reports for insert
  with check (
    auth.uid() = user_id
    and state = 'pending'
    and resolved_by is null and resolved_at is null and resolution_note is null
    and (
      (kind = 'new' and camera_id is null) or
      (kind = 'status' and exists (
        select 1 from public.cameras c where c.id = camera_id and c.visible))
    )
  );

-- Deliberately no update policy and no delete policy. A report's state
-- changes only inside approve_report and reject_report, which run as
-- the table owner. Giving the anon key no update path at all is
-- simpler and safer than a with-check that tries to let state move in
-- one direction only.
revoke all on public.reports from anon, authenticated;
grant select, insert on public.reports to authenticated;

-- ---------------- report_proof ----------------

-- One row per photo or video attached to a report. The file itself
-- sits in the private "proof" storage bucket (set up further down) at
-- storage_path, which must be <user id>/<report id>/<file name>. A
-- moderator sees the file through a signed URL the client asks for;
-- nobody else can reach it.
create table if not exists public.report_proof (
  id           bigint generated always as identity primary key,
  report_id    bigint not null references public.reports(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  mime         text not null
                 check (mime in ('image/jpeg', 'image/png', 'image/webp',
                                 'video/mp4', 'video/webm')),
  bytes        bigint not null check (bytes > 0 and bytes <= 20971520),   -- 20 MB, same as the bucket
  created_at   timestamptz not null default now()
);

create index if not exists report_proof_report_id_idx on public.report_proof (report_id);
create index if not exists report_proof_user_id_idx on public.report_proof (user_id);

alter table public.report_proof enable row level security;

drop policy if exists "report_proof: read own or moderator" on public.report_proof;
create policy "report_proof: read own or moderator"
  on public.report_proof for select
  using (auth.uid() = user_id or public.is_moderator());

-- Attach proof only to your own report, only while it is pending, and
-- only at the path convention the bucket policies expect.
drop policy if exists "report_proof: insert own pending" on public.report_proof;
create policy "report_proof: insert own pending"
  on public.report_proof for insert
  with check (
    auth.uid() = user_id
    and public.owns_pending_report(report_id)
    and split_part(storage_path, '/', 1) = auth.uid()::text
    and split_part(storage_path, '/', 2) = report_id::text
  );

drop policy if exists "report_proof: delete own pending" on public.report_proof;
create policy "report_proof: delete own pending"
  on public.report_proof for delete
  using (auth.uid() = user_id and public.owns_pending_report(report_id));

revoke all on public.report_proof from anon, authenticated;
grant select, insert, delete on public.report_proof to authenticated;

-- ---------------- xp_events ----------------

-- One row per award, written only by approve_report - the anon key
-- can read its own and nothing more. profiles.xp_total is the sum of
-- these per person, kept up to date by the trigger below so that no
-- page ever has to add them up.
create table if not exists public.xp_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  report_id  bigint not null unique references public.reports(id) on delete cascade,
  xp         integer not null,
  reason     text not null,
  created_at timestamptz not null default now()
);

create index if not exists xp_events_user_id_idx on public.xp_events (user_id);
create index if not exists xp_events_created_at_idx on public.xp_events (created_at desc);

alter table public.xp_events enable row level security;

drop policy if exists "xp_events: read own" on public.xp_events;
create policy "xp_events: read own"
  on public.xp_events for select
  using (auth.uid() = user_id);

revoke all on public.xp_events from anon, authenticated;
grant select on public.xp_events to authenticated;

-- ---------------- saved_cameras ----------------

-- A user's private starred list. Nothing in here is ever shown to
-- anyone but the user who saved it. Still keyed on name + coordinates
-- rather than a camera id, because the offline fallback (points.js)
-- has no ids; camera_type joined the key in version 2 because Croydon
-- North End is on the map twice, once as a fixed camera and once as a
-- van site, and either should be saveable.
create table if not exists public.saved_cameras (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  camera_name text not null,
  lat         double precision not null,
  lon         double precision not null,
  note        text default '',
  camera_type text not null default 'vancam',
  created_at  timestamptz default now(),

  -- same bounds as LONDON_BOUNDS in frontend/shared.js - a save outside Greater
  -- London means something is wrong upstream, so reject it here too
  -- rather than only in the browser.
  constraint saved_cameras_in_london check (
    lat between 51.28 and 51.70 and
    lon between -0.51 and 0.33
  ),

  constraint saved_cameras_unique_per_user_v2
    unique (user_id, camera_name, lat, lon, camera_type)
);

-- Upgrade from version 1: add the type, and swap the old four-column
-- unique for the five-column one.
alter table public.saved_cameras
  add column if not exists camera_type text not null default 'vancam';

alter table public.saved_cameras
  drop constraint if exists saved_cameras_unique_per_user;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'saved_cameras_unique_per_user_v2'
                    and conrelid = 'public.saved_cameras'::regclass) then
    alter table public.saved_cameras add constraint saved_cameras_unique_per_user_v2
      unique (user_id, camera_name, lat, lon, camera_type);
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'saved_cameras_camera_type_check'
                    and conrelid = 'public.saved_cameras'::regclass) then
    alter table public.saved_cameras add constraint saved_cameras_camera_type_check
      check (camera_type in ('fixedcam', 'vancam', 'transportcam',
                             'facewatchcam', 'privatecam', 'nonfunccam'));
  end if;
end $$;

create index if not exists saved_cameras_user_id_idx on public.saved_cameras(user_id);

alter table public.saved_cameras enable row level security;

drop policy if exists "saved_cameras: read own" on public.saved_cameras;
create policy "saved_cameras: read own"
  on public.saved_cameras for select
  using (auth.uid() = user_id);

drop policy if exists "saved_cameras: insert own" on public.saved_cameras;
create policy "saved_cameras: insert own"
  on public.saved_cameras for insert
  with check (auth.uid() = user_id);

drop policy if exists "saved_cameras: update own" on public.saved_cameras;
create policy "saved_cameras: update own"
  on public.saved_cameras for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "saved_cameras: delete own" on public.saved_cameras;
create policy "saved_cameras: delete own"
  on public.saved_cameras for delete
  using (auth.uid() = user_id);

revoke all on public.saved_cameras from anon, authenticated;
grant select, insert, update, delete on public.saved_cameras to authenticated;

-- ---------------- upgrade from version 1 ----------------

-- Version 1 kept proposed sightings in a submissions table that the
-- owner read by hand. They become new-camera reports here (every
-- version 1 sighting was a van), keeping their state and date, and
-- the old table and its queue view go. This runs before the report
-- triggers are attached, so nothing old is rate-limited or
-- auto-approved on the way across. If there is no submissions table -
-- a fresh database, or a second run - nothing happens.
do $$
begin
  if to_regclass('public.submissions') is not null then
    insert into public.reports (user_id, kind, type, name, note, lat, lon, state, created_at)
    select user_id, 'new', 'vancam', name, coalesce(note, ''), lat, lon,
           case status when 'accepted' then 'approved'
                       when 'rejected' then 'rejected'
                       else 'pending' end,
           coalesce(created_at, now())
      from public.submissions
    on conflict do nothing;

    drop view if exists public.admin_submissions_queue;
    drop table public.submissions;
  end if;
end $$;

-- The version 1 handle column was never used by the site. It goes
-- here rather than with the other profile changes because the
-- version 1 queue view, dropped just above, depended on it.
alter table public.profiles drop column if exists handle;

-- ---------------- distance ----------------

-- Haversine, in metres. Pure arithmetic with nothing to protect, so
-- not security definer - that would only stop the planner inlining
-- it. Immutable so it can sit in an index or a generated column later
-- if ever wanted.
create or replace function public.metres_between(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision)
returns double precision
language sql
immutable
parallel safe
as $$
  select 2 * 6371000.0 * asin(least(1.0, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2))));
$$;

revoke all on function public.metres_between(double precision, double precision, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.metres_between(double precision, double precision, double precision, double precision)
  to service_role;

-- The nearest visible camera of a given type within radius_m of a
-- point, or null. The grid cells (see cameras_cell_idx) are 0.001
-- degrees, which is about 111 m north-south and, at London's
-- latitude, about 69 m east-west - so a 100 m radius needs one cell
-- either side going north-south but two going east-west. The spans
-- are worked out from the radius rather than written as "one", so a
-- change to the setting stays correct.
create or replace function public.camera_near(
  at_lat double precision, at_lon double precision, cam_type text, radius_m double precision)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with cell as (
    select round(at_lat::numeric, 3) as clat,
           round(at_lon::numeric, 3) as clon,
           ceil(radius_m / 111.32)::integer as nlat,
           ceil(radius_m / (111.32 * cos(radians(at_lat))))::integer as nlon)
  select c.id
    from public.cameras c, cell
   where c.visible
     and c.type = cam_type
     and round(c.lat::numeric, 3) between cell.clat - cell.nlat * 0.001 and cell.clat + cell.nlat * 0.001
     and round(c.lon::numeric, 3) between cell.clon - cell.nlon * 0.001 and cell.clon + cell.nlon * 0.001
     and public.metres_between(at_lat, at_lon, c.lat, c.lon) <= radius_m
   order by public.metres_between(at_lat, at_lon, c.lat, c.lon)
   limit 1;
$$;

revoke all on function public.camera_near(double precision, double precision, text, double precision)
  from public, anon, authenticated;
grant execute on function public.camera_near(double precision, double precision, text, double precision)
  to service_role;

-- Every pending new-camera report of the same type within the
-- auto-approve radius of the given one, itself included. Same grid
-- trick as camera_near, over reports_pending_cell_idx.
create or replace function public.cluster_of_report(rid bigint)
returns setof public.reports
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with a as (
    select r.*,
           s.auto_approve_radius_m::double precision as radius,
           ceil(s.auto_approve_radius_m / 111.32)::integer as nlat,
           ceil(s.auto_approve_radius_m / (111.32 * cos(radians(r.lat))))::integer as nlon
      from public.reports r, public.settings s
     where r.id = rid and s.id = 1)
  select r.*
    from public.reports r, a
   where r.kind = 'new'
     and r.state = 'pending'
     and r.type = a.type
     and r.cell_lat between a.cell_lat - a.nlat * 0.001 and a.cell_lat + a.nlat * 0.001
     and r.cell_lon between a.cell_lon - a.nlon * 0.001 and a.cell_lon + a.nlon * 0.001
     and public.metres_between(a.lat, a.lon, r.lat, r.lon) <= a.radius
   order by r.id;
$$;

revoke all on function public.cluster_of_report(bigint) from public, anon, authenticated;
grant execute on function public.cluster_of_report(bigint) to service_role;

-- ---------------- approving and rejecting ----------------

-- The one place a report turns into something on the map. Called by
-- the auto-approve trigger (actor null) and by moderate_report (actor
-- = the moderator). Returns the camera the report now points at.
--
-- A new-camera report brings its whole cluster with it: every pending
-- report of the same type within the radius. If a visible camera of
-- that type is already within the radius of the cluster's centre,
-- they were all reporting that camera - they are marked merged and
-- earn nothing. Otherwise one camera is created at the centre and
-- every report in the cluster is approved.
--
-- A status report likewise brings every pending report making the
-- same claim about the same camera. The claim is applied - removed
-- hides the camera and marks it legacy rather than deleting anything.
--
-- XP is awarded once per person per camera, on their earliest report
-- in the group, so two reports from one account 50 m apart do not pay
-- twice. The first award a person ever gets carries the first-report
-- bonus.
--
-- Approving something that is no longer pending does nothing and just
-- returns its camera, so a double click or a retry is safe. Two
-- approvals racing on the same patch of map queue behind an advisory
-- lock (one per camera type for new reports, one per camera for
-- status ones) and the second sees what the first did.
create or replace function public.approve_report(rid bigint, actor uuid default null)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r        public.reports%rowtype;
  s        public.settings%rowtype;
  ids      bigint[];
  cam      bigint;
  clat     double precision;
  clon     double precision;
  rule_key text;
begin
  select * into r from public.reports where id = rid;
  if not found then
    raise exception 'report % does not exist', rid;
  end if;
  if r.state <> 'pending' then
    return r.camera_id;
  end if;

  select * into s from public.settings where id = 1;

  if r.kind = 'new' then
    perform pg_advisory_xact_lock(hashtext('cammap.approve.' || r.type));

    -- read again now that anything that had the lock has finished
    select * into r from public.reports where id = rid;
    if r.state <> 'pending' then
      return r.camera_id;
    end if;

    select array_agg(c.id), avg(c.lat), avg(c.lon)
      into ids, clat, clon
      from public.cluster_of_report(rid) c;

    cam := public.camera_near(clat, clon, r.type, s.auto_approve_radius_m);
    if cam is not null then
      update public.reports
         set state = 'merged', camera_id = cam, resolved_by = actor, resolved_at = now()
       where id = any(ids);
      return cam;
    end if;

    insert into public.cameras (name, note, lat, lon, type, status, source, approved_at, approved_by)
    values (r.name, r.note, clat, clon, r.type, 'active', 'report', now(), actor)
    returning id into cam;

    update public.reports
       set state = 'approved', camera_id = cam, resolved_by = actor, resolved_at = now()
     where id = any(ids);

    rule_key := 'new_' || r.type;
  else
    perform pg_advisory_xact_lock(hashtext('cammap.status.' || r.camera_id::text));

    select * into r from public.reports where id = rid;
    if r.state <> 'pending' then
      return r.camera_id;
    end if;

    cam := r.camera_id;

    select array_agg(id) into ids
      from public.reports
     where kind = 'status' and state = 'pending'
       and camera_id = cam and status_claim = r.status_claim;

    update public.cameras
       set status  = case r.status_claim
                       when 'nonfunctional' then 'nonfunctional'
                       when 'removed'       then 'legacy'
                       else 'active' end,
           visible = case when r.status_claim = 'removed' then false else visible end
     where id = cam;

    update public.reports
       set state = 'approved', resolved_by = actor, resolved_at = now()
     where id = any(ids);

    rule_key := 'status_' || r.status_claim;
  end if;

  insert into public.xp_events (user_id, report_id, xp, reason)
  select d.user_id,
         d.id,
         coalesce(base.xp, 0) + case when fb.yes then coalesce(bonus.xp, 0) else 0 end,
         rule_key || case when fb.yes then ' + first_report_bonus' else '' end
    from (select distinct on (user_id) user_id, id
            from public.reports
           where id = any(ids)
           order by user_id, id) d
    left join public.xp_rules base  on base.key  = rule_key
    left join public.xp_rules bonus on bonus.key = 'first_report_bonus'
    cross join lateral (
      select not exists (select 1 from public.xp_events e where e.user_id = d.user_id) as yes) fb;

  return cam;
end;
$$;

revoke all on function public.approve_report(bigint, uuid) from public, anon, authenticated;
grant execute on function public.approve_report(bigint, uuid) to service_role;

-- Turns one pending report down, with a note the reporter can read.
-- Does nothing if it is not pending any more.
create or replace function public.reject_report(rid bigint, why text default null, actor uuid default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.reports
     set state = 'rejected', resolution_note = why, resolved_by = actor, resolved_at = now()
   where id = rid and state = 'pending';
end;
$$;

revoke all on function public.reject_report(bigint, text, uuid) from public, anon, authenticated;
grant execute on function public.reject_report(bigint, text, uuid) to service_role;

-- What the moderator's browser calls, through supabase.rpc():
--   moderate_report({ report_id: 12, action: 'approve' })
--   moderate_report({ report_id: 12, action: 'reject', note: '...' })
-- The only function here that a signed-in person can run, and the
-- first thing it does is check they are a moderator. Returns the
-- camera id on approve, null on reject.
create or replace function public.moderate_report(report_id bigint, action text, note text default null)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;

  if action = 'approve' then
    return public.approve_report(report_id, auth.uid());
  elsif action = 'reject' then
    perform public.reject_report(report_id, note, auth.uid());
    return null;
  end if;

  raise exception 'unknown action "%"', action;
end;
$$;

revoke all on function public.moderate_report(bigint, text, text) from public, anon, authenticated;
grant execute on function public.moderate_report(bigint, text, text) to authenticated, service_role;

-- ---------------- undoing things ----------------

-- Moderation is not one-way. A camera can be taken off the map, an
-- approval can be taken back, and a rejection can be reconsidered.
-- None of it deletes anything: a camera is hidden rather than
-- removed, so the reports that pointed at it still make sense, and
-- every report keeps its history in resolved_by / resolved_at /
-- resolution_note. What must not survive an undo is the XP: a report
-- whose approval is taken back loses its award, or approve-retract-
-- approve would pay twice. The xp_events trigger subtracts it from
-- the person's total on delete, so nothing here adds up anything.

-- Take a camera off the map. It stays in the table, invisible, with
-- its reports intact. Idempotent.
create or replace function public.hide_camera(cid bigint, why text default null, actor uuid default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  update public.cameras
     set visible = false
   where id = cid and visible;
  if not found then
    return;
  end if;
  -- leave a note on the reports so the queue's history shows why
  update public.reports
     set resolution_note = coalesce(why, 'camera removed from the map'),
         resolved_by = coalesce(actor, resolved_by),
         resolved_at = now()
   where camera_id = cid and state = 'approved';
end;
$fn$;

revoke all on function public.hide_camera(bigint, text, uuid) from public, anon, authenticated;
grant execute on function public.hide_camera(bigint, text, uuid) to service_role;

-- Put a hidden camera back. The reverse of hide_camera, for a removal
-- that turned out to be wrong.
create or replace function public.unhide_camera(cid bigint, actor uuid default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  update public.cameras set visible = true where id = cid and not visible;
end;
$fn$;

revoke all on function public.unhide_camera(bigint, uuid) from public, anon, authenticated;
grant execute on function public.unhide_camera(bigint, uuid) to service_role;

-- Take back an approval. The report goes back to pending, its XP
-- award is deleted (and so subtracted from the total by the
-- xp_events trigger), and if it was a new-camera report whose camera
-- has no other approved report holding it up, the camera is hidden.
-- A status report's effect on its camera is not unwound here - the
-- moderator decides what the camera's state should be by hand, since
-- "what it was before" may itself have been wrong.
create or replace function public.retract_approval(rid bigint, why text default null, actor uuid default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  r public.reports%rowtype;
begin
  select * into r from public.reports where id = rid;
  if not found or r.state <> 'approved' then
    return;
  end if;

  delete from public.xp_events where report_id = rid;

  update public.reports
     set state = 'pending', resolution_note = why, resolved_by = actor, resolved_at = now()
   where id = rid;

  if r.kind = 'new' and r.camera_id is not null
     and not exists (select 1 from public.reports
                      where camera_id = r.camera_id and kind = 'new'
                        and state = 'approved' and id <> rid) then
    update public.cameras set visible = false where id = r.camera_id;
  end if;
end;
$fn$;

revoke all on function public.retract_approval(bigint, text, uuid) from public, anon, authenticated;
grant execute on function public.retract_approval(bigint, text, uuid) to service_role;

-- Reconsider a rejection: back to pending, then through the ordinary
-- approval so it behaves exactly like any other approval - cluster,
-- merge, XP and all. Returns the camera it now points at.
create or replace function public.reapprove_report(rid bigint, actor uuid default null)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  r public.reports%rowtype;
begin
  select * into r from public.reports where id = rid;
  if not found or r.state not in ('rejected', 'pending') then
    return r.camera_id;
  end if;

  -- A report whose approval was taken back and is now being restored
  -- already has a camera - hidden by the retraction. Put that one
  -- back rather than make a second, or every retract-and-restore
  -- would leave a hidden orphan behind.
  if r.camera_id is not null
     and exists (select 1 from public.cameras where id = r.camera_id and not visible) then
    update public.cameras set visible = true where id = r.camera_id;
    update public.reports
       set state = 'approved', resolution_note = null, resolved_by = actor, resolved_at = now()
     where id = rid;
    -- the XP went with the retraction; award it again, once
    insert into public.xp_events (user_id, report_id, xp, reason)
    select r.user_id, r.id,
           coalesce((select xp from public.xp_rules where key = 'new_' || r.type), 0)
           + case when not exists (select 1 from public.xp_events where user_id = r.user_id)
                  then coalesce((select xp from public.xp_rules where key = 'first_report_bonus'), 0) else 0 end,
           'new_' || r.type || ' (restored)'
     where r.kind = 'new'
    on conflict (report_id) do nothing;
    return r.camera_id;
  end if;

  update public.reports
     set state = 'pending', resolution_note = null
   where id = rid and state = 'rejected';
  return public.approve_report(rid, actor);
end;
$fn$;

revoke all on function public.reapprove_report(bigint, uuid) from public, anon, authenticated;
grant execute on function public.reapprove_report(bigint, uuid) to service_role;

-- Put a camera on the map by hand, without a report. For the things a
-- moderator knows about that nobody has reported - a published record,
-- a site visit. Goes straight on, visible, attributed to whoever added
-- it, with no XP for anyone. Same London box as everything else.
create or replace function public.add_camera(
  cam_name text, cam_note text, cam_lat double precision, cam_lon double precision,
  cam_type text, cam_status text default 'active', actor uuid default null)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  cid bigint;
begin
  if cam_name is null or btrim(cam_name) = '' then
    raise exception 'a camera needs a name';
  end if;
  insert into public.cameras (name, note, lat, lon, type, status, source, approved_at, approved_by)
  values (btrim(cam_name), coalesce(cam_note, ''), cam_lat, cam_lon, cam_type,
          coalesce(cam_status, 'active'), 'admin', now(), actor)
  returning id into cid;
  return cid;
end;
$fn$;

revoke all on function public.add_camera(text, text, double precision, double precision, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.add_camera(text, text, double precision, double precision, text, text, uuid)
  to service_role;

-- The browser's way in for a moderator. Checks the role, then adds.
create or replace function public.moderate_add_camera(
  cam_name text, cam_note text, cam_lat double precision, cam_lon double precision,
  cam_type text, cam_status text default 'active')
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not public.is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  return public.add_camera(cam_name, cam_note, cam_lat, cam_lon, cam_type, cam_status, auth.uid());
end;
$fn$;

revoke all on function public.moderate_add_camera(text, text, double precision, double precision, text, text)
  from public, anon, authenticated;
grant execute on function public.moderate_add_camera(text, text, double precision, double precision, text, text)
  to authenticated, service_role;

-- What the moderator's browser calls for any of the above. Same gate
-- as moderate_report. Actions: hide_camera and unhide_camera take a
-- camera id; retract and reapprove take a report id.
create or replace function public.moderate_undo(target bigint, action text, note text default null)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not public.is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;

  if action = 'hide_camera' then
    perform public.hide_camera(target, note, auth.uid());
    return target;
  elsif action = 'unhide_camera' then
    perform public.unhide_camera(target, auth.uid());
    return target;
  elsif action = 'retract' then
    perform public.retract_approval(target, note, auth.uid());
    return null;
  elsif action = 'reapprove' then
    return public.reapprove_report(target, auth.uid());
  end if;

  raise exception 'unknown action "%"', action;
end;
$fn$;

revoke all on function public.moderate_undo(bigint, text, text) from public, anon, authenticated;
grant execute on function public.moderate_undo(bigint, text, text) to authenticated, service_role;

-- ---------------- report triggers ----------------

-- Before a report is stored: how many has this person sent in the
-- last ten minutes? Walks reports_user_created_idx from the newest
-- end, so it is a few index entries whatever the table size.
create or replace function public.report_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  allowed integer;
  recent  integer;
begin
  select reports_per_10min into allowed from public.settings where id = 1;

  select count(*) into recent
    from public.reports
   where user_id = new.user_id
     and created_at > now() - interval '10 minutes';

  if allowed is not null and recent >= allowed then
    raise exception 'too many reports - wait a few minutes and try again';
  end if;

  return new;
end;
$$;

revoke all on function public.report_rate_limit() from public, anon, authenticated;

-- After a report is stored: does it approve itself? A new-camera
-- report that lands within the radius of a visible camera of the same
-- type is a sighting of that camera and merges straight away. Failing
-- that, it counts the distinct people with a pending report in its
-- cluster whose accounts are older than the floor in settings, and
-- approves when there are enough. A status report counts the people
-- making the same claim about the same camera.
--
-- The account-age floor, the one-report-per-cell rule and the rate
-- limit are what stop one person with three fresh accounts putting a
-- pin on the map in an afternoon.
create or replace function public.try_auto_approve()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s      public.settings%rowtype;
  voices integer;
begin
  select * into s from public.settings where id = 1;
  if s.id is null then
    return null;
  end if;

  if new.kind = 'new' then
    if public.camera_near(new.lat, new.lon, new.type, s.auto_approve_radius_m) is not null then
      perform public.approve_report(new.id, null);
      return null;
    end if;

    select count(distinct c.user_id) into voices
      from public.cluster_of_report(new.id) c
      join public.profiles p on p.id = c.user_id
     where p.created_at < now() - s.min_account_age_for_auto;
  else
    select count(distinct r.user_id) into voices
      from public.reports r
      join public.profiles p on p.id = r.user_id
     where r.kind = 'status' and r.state = 'pending'
       and r.camera_id = new.camera_id
       and r.status_claim = new.status_claim
       and p.created_at < now() - s.min_account_age_for_auto;
  end if;

  if voices >= s.auto_approve_users then
    perform public.approve_report(new.id, null);
  end if;

  return null;
end;
$$;

revoke all on function public.try_auto_approve() from public, anon, authenticated;

drop trigger if exists reports_rate_limit on public.reports;
create trigger reports_rate_limit
  before insert on public.reports
  for each row
  execute function public.report_rate_limit();

drop trigger if exists reports_try_auto_approve on public.reports;
create trigger reports_try_auto_approve
  after insert on public.reports
  for each row
  execute function public.try_auto_approve();

-- ---------------- xp_total in step with xp_events ----------------

create or replace function public.apply_xp_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set xp_total = xp_total + new.xp where id = new.user_id;
  elsif tg_op = 'DELETE' then
    update public.profiles set xp_total = xp_total - old.xp where id = old.user_id;
  else
    update public.profiles set xp_total = xp_total - old.xp where id = old.user_id;
    update public.profiles set xp_total = xp_total + new.xp where id = new.user_id;
  end if;
  return null;
end;
$$;

revoke all on function public.apply_xp_event() from public, anon, authenticated;

drop trigger if exists xp_events_apply on public.xp_events;
create trigger xp_events_apply
  after insert or update of xp, user_id or delete on public.xp_events
  for each row
  execute function public.apply_xp_event();

-- ---------------- updated_at ----------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_updated_at() from public, anon, authenticated;

drop trigger if exists cameras_touch_updated_at on public.cameras;
create trigger cameras_touch_updated_at
  before update on public.cameras
  for each row
  execute function public.touch_updated_at();

-- ---------------- new account -> profile row ----------------

-- Runs as the function's owner (whoever ran this script, normally
-- the postgres role), which owns the profiles table too, so this
-- insert goes through regardless of the row level security policies
-- above - those apply to the browser's session, not to this trigger.
--
-- The username comes from the sign-up call's options.data.username
-- and nowhere else - the email address the client sends alongside it
-- is only a placeholder so that Supabase has one. If the name does
-- not fit the pattern, or is already taken, the exception here rolls
-- the auth.users insert back and the sign-up fails cleanly: the API
-- reports "Database error saving new user" and no half-made account
-- is left behind. The client generates names, so on that error it
-- draws a new pair and tries again. It does not ask first, and there
-- is deliberately nothing here for it to ask: see the note below the
-- trigger.
--
-- An anonymous sign-in (the version 1 way) still gets a profile, with
-- no username, so nothing breaks until anonymous sign-in is switched
-- off in the dashboard.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  wanted text;
begin
  if coalesce(new.is_anonymous, false) then
    insert into public.profiles (id, created_at)
    values (new.id, coalesce(new.created_at, now()))
    on conflict (id) do nothing;
    return new;
  end if;

  wanted := new.raw_user_meta_data ->> 'username';
  if wanted is null or wanted !~ '^[a-z]{3,12}\.[a-z]{3,12}$' then
    raise exception 'username "%" does not fit the pattern word.word (lower-case letters only)',
      coalesce(wanted, '');
  end if;

  begin
    insert into public.profiles (id, username, role, created_at)
    values (new.id, wanted, 'user', coalesce(new.created_at, now()))
    on conflict (id) do nothing;
  exception when unique_violation then
    raise exception 'username "%" is taken', wanted;
  end;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- username_available() used to live here: one lookup that answered, to
-- anyone at all signed out, whether a given username existed.
--
-- It is gone, for two reasons. The client never called it - signUp()
-- in account.js simply tries the name and draws another if it is
-- taken, which is the same answer without asking the question. And on
-- a site whose whole premise is that an account says nothing about a
-- person, an endpoint that confirms a name to a stranger is exactly
-- the wrong shape: given the two word lists in account.js it would
-- enumerate every account on the site in about twenty thousand calls.
--
-- Dropped rather than left with the grant narrowed, so it cannot be
-- re-exposed by a later change to the grants.
drop function if exists public.username_available(text);

-- ---------------- proof bucket ----------------

-- A private bucket for report proof. Rows in storage.objects are what
-- the storage API checks, so the rules live there: upload only under
-- your own user id, to a report of yours that is still pending; read
-- your own or, as a moderator, anyone's; delete your own while the
-- report is pending; never overwrite. The size and type limits are
-- enforced by the bucket itself before a byte is stored. The insert
-- below is what creates the bucket - it appears in the dashboard on
-- its own, and re-running keeps the limits as written here.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proof', 'proof', false, 20971520,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "proof: upload to own pending report" on storage.objects;
create policy "proof: upload to own pending report"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'proof' and public.proof_path_pending(name));

drop policy if exists "proof: read own or moderator" on storage.objects;
create policy "proof: read own or moderator"
  on storage.objects for select to authenticated
  using (bucket_id = 'proof'
         and (split_part(name, '/', 1) = auth.uid()::text or public.is_moderator()));

drop policy if exists "proof: delete own while pending" on storage.objects;
create policy "proof: delete own while pending"
  on storage.objects for delete to authenticated
  using (bucket_id = 'proof' and public.proof_path_pending(name));

-- No update policy: a proof file is never replaced in place. Delete
-- it and upload again while the report is pending.

-- ---------------- leaderboards ----------------

-- Three precomputed tables, refreshed every five minutes, each holding
-- the top hundred. A leaderboard page reads one of these and nothing
-- else - no sum, no group by, however many reports there are. They
-- carry only what the page shows: a username, a total, a count.
--
-- These are dropped and rebuilt on every run of this file (they are
-- derived data, so nothing is lost) so that a change to a definition
-- here always takes. Read them with "order by xp_total desc" - a
-- concurrent refresh does not promise to keep rows in order.

drop materialized view if exists public.leaderboard_all;
create materialized view public.leaderboard_all as
  select p.username,
         p.xp_total,
         coalesce(a.n, 0)::integer as reports_approved
    from public.profiles p
    left join (select user_id, count(*) as n
                 from public.reports
                where state = 'approved'
                group by user_id) a on a.user_id = p.id
   where p.username is not null
     and p.xp_total > 0
   order by p.xp_total desc, p.username
   limit 100;

-- The last 24 hours and the last 7 days, from xp_events by the time of
-- the award, so a person's place is the XP they earned in the window
-- and reports_approved is how many awards that was. Rolling windows
-- rather than calendar days, so the board is not empty at one minute
-- past midnight.
drop materialized view if exists public.leaderboard_daily;
create materialized view public.leaderboard_daily as
  select p.username,
         sum(e.xp)::integer as xp_total,
         count(*)::integer  as reports_approved
    from public.xp_events e
    join public.profiles p on p.id = e.user_id
   where e.created_at > now() - interval '1 day'
     and p.username is not null
   group by p.username
   order by xp_total desc, p.username
   limit 100;

drop materialized view if exists public.leaderboard_weekly;
create materialized view public.leaderboard_weekly as
  select p.username,
         sum(e.xp)::integer as xp_total,
         count(*)::integer  as reports_approved
    from public.xp_events e
    join public.profiles p on p.id = e.user_id
   where e.created_at > now() - interval '7 days'
     and p.username is not null
   group by p.username
   order by xp_total desc, p.username
   limit 100;

-- "refresh ... concurrently" needs a unique index, and in return
-- readers are never blocked while the board is rebuilt.
create unique index if not exists leaderboard_all_username_idx    on public.leaderboard_all (username);
create unique index if not exists leaderboard_daily_username_idx  on public.leaderboard_daily (username);
create unique index if not exists leaderboard_weekly_username_idx on public.leaderboard_weekly (username);

revoke all on public.leaderboard_all, public.leaderboard_daily, public.leaderboard_weekly
  from anon, authenticated;
grant select on public.leaderboard_all, public.leaderboard_daily, public.leaderboard_weekly
  to anon, authenticated, service_role;

create or replace function public.refresh_leaderboards()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  refresh materialized view concurrently public.leaderboard_all;
  refresh materialized view concurrently public.leaderboard_daily;
  refresh materialized view concurrently public.leaderboard_weekly;
end;
$$;

revoke all on function public.refresh_leaderboards() from public, anon, authenticated;
grant execute on function public.refresh_leaderboards() to service_role;

-- Schedule the refresh with pg_cron, every five minutes. Supabase
-- ships pg_cron but it has to be switched on once, under Database ->
-- Extensions in the dashboard; until then this block only prints a
-- notice, and running the file again afterwards schedules the job.
-- plpgsql resolves names when a statement runs, not when the block is
-- parsed, so mentioning cron.schedule inside the "if" is safe where
-- the extension is absent. The job is unscheduled first so a re-run
-- leaves exactly one.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'cammap_refresh_leaderboards';
    perform cron.schedule('cammap_refresh_leaderboards', '*/5 * * * *',
                          'select public.refresh_leaderboards()');
  else
    raise notice 'pg_cron is not enabled: turn it on under Database -> Extensions and run this file again to schedule the leaderboard refresh. Until then, run select public.refresh_leaderboards() by hand.';
  end if;
end $$;
