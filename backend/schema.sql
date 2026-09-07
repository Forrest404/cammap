-- ------------------------------------------------------------------
--    cammap - supabase schema, version 2
--
--    Backs the whole site now, not just the accounts page. The map
--    reads its pins from the cameras table; seed.sql fills that table
--    from the published record, and points.js is the same record as
--    the offline fallback if the database cannot be reached. Both are
--    written out by tools/build_points.py from data/cameras.csv and
--    are never edited by hand.
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
-- so the leaderboard never has to add anything up. show_on_leaderboard
-- (version 2.9, added below rather than here so that a fresh database
-- and an upgraded one lay the columns out the same) is the one thing
-- a person may change themselves, and only through
-- set_leaderboard_visibility().
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

-- version 2.9: a way off the leaderboard. Every contributor's
-- username, XP and count of approved reports were public and
-- enumerable, a hundred at a time, to anyone at all. The names carry
-- nothing personal - two random words - but what someone has
-- reported, and how much, is itself a pattern, and on this site that
-- can be enough. A person should be able to keep their name off the
-- list without giving up the account or the points.
--
-- Default true: the list is the reward the site offers, and a new
-- account expects to appear on it. Not null, because a view
-- definition that has to handle "unknown" is a view definition that
-- will one day handle it wrong.
--
-- Where it is enforced, and why not in row-level security: the
-- three leaderboards further down are materialized views, and
-- PostgreSQL does not apply RLS to a materialized view - a policy on
-- profiles is never consulted when the view is refreshed, and a view
-- cannot carry a policy of its own. The equivalent that meets the
-- intent (server-side, never the client's query) is the view
-- definition itself: an opted-out row never enters the table the
-- page reads, so no query the browser could write, and no future
-- page that forgets to filter, can show it. QUESTIONS.md item 6
-- records the substitution. (backend/migrations/007_leaderboard_opt_out.sql
-- is this block and the rebuilt views on their own.)
alter table public.profiles
  add column if not exists show_on_leaderboard boolean not null default true;

comment on column public.profiles.show_on_leaderboard is
  'false keeps the account off leaderboard_all, _daily and _weekly; enforced in the view definitions, since RLS does not reach a materialized view. Set only through set_leaderboard_visibility().';

-- The one thing on a profile a person may change themselves, and
-- the only way they may change it: the client roles have no update
-- privilege on profiles at all (the revoke above), on purpose, so a
-- column-level grant is not the door. This is. It takes a boolean
-- and nothing else, and writes it to the caller's own row, found by
-- auth.uid(); there is no parameter that could name another account,
-- and nothing comes back.
--
-- The anonymity test: what does a stranger learn by calling this
-- repeatedly with guesses? Nothing. It carries no username, no id,
-- answers nothing, and acts only on the account whose token made
-- the call. Signed out, auth.uid() is null and it refuses.
create or replace function public.set_leaderboard_visibility(shown boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  update public.profiles
     set show_on_leaderboard = coalesce(shown, true)
   where id = auth.uid();
end;
$fn$;

revoke all on function public.set_leaderboard_visibility(boolean) from public, anon, authenticated;
grant execute on function public.set_leaderboard_visibility(boolean) to authenticated, service_role;

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
  periods     jsonb,                       -- those uses by the period the source gives, {"2023-24": 1}; null when it gives none
  source_label text,                       -- the record or report the row rests on, named; null when none is known
  source_url  text,                        -- where that record or report is, https; null when unknown, never without a label
  approximate boolean not null default false,  -- the pin marks the surrounding area, not an exact spot

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

-- version 2.3 added periods: the deployments count broken down by the
-- period the source gives it in - {"2023-24": 1}, {"2023-2025": 3},
-- {"2026": 4}. The key is the period exactly as the record states it.
-- The Met publishes "3 deployments 2023-2025" and not which year each
-- fell in, so a column keyed by year would hold an estimate, and this
-- project does not estimate; a reader who wants years goes back to the
-- deployment-record PDFs, which carry dates. null means the source
-- names no period - a shop, a fixed install, a camera from a report -
-- and never an empty object. deployments stays, because the glow and
-- the Most-used sort read it and a report's camera has no history to
-- break down, and where periods is given it is its sum. Both facts are
-- checked here, not only in the build script: the server refuses a
-- malformed breakdown, or one whose total disagrees with the count,
-- without trusting whatever wrote the row.
--
-- The two helpers are plain SQL and immutable, which is what lets a
-- check constraint call them. The key pattern is the same one
-- build_points.py and check.js use; change one, change the three.
-- (backend/migrations/001_periods.sql is this block on its own, for a
-- database that already has the table.)
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

-- The sum of a valid breakdown, or null for anything else - so that
-- the constraint below compares deployments with a number, or with
-- null, and never raises a cast error on a value periods_valid would
-- already have refused.
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

-- version 2.4 added source_label and source_url: where a row comes
-- from, named and linked. Until now provenance was prose inside note
-- with nothing to click - "Met Police LFR van - 3 deployments
-- 2023-2025" says which record without saying where it is. The label
-- names the document ("Met Police LFR deployment record, 2025", "The
-- Register, 6 February 2026") and the URL is the document itself, or
-- the page a multi-document record is published on. Both are null
-- where none is known, and a null is what the map should show as
-- nothing at all: a camera without a source says nothing rather than
-- something vague. Two rules the server holds whatever wrote the row:
-- a URL is https with no whitespace, and a URL needs a label, because
-- a link with no name is not a citation. The same two rules are in
-- build_points.py and check.js. (backend/migrations/002_source.sql is
-- this block on its own.)
alter table public.cameras
  add column if not exists source_label text,
  add column if not exists source_url text;

alter table public.cameras drop constraint if exists cameras_source_label_check;
alter table public.cameras add constraint cameras_source_label_check
  check (source_label is null or source_label = btrim(source_label) and source_label <> '');

alter table public.cameras drop constraint if exists cameras_source_url_check;
alter table public.cameras add constraint cameras_source_url_check
  check (source_url is null or (source_url ~ '^https://\S+$' and source_label is not null));

comment on column public.cameras.source_label is
  'The record or report the row rests on, named. null where none is known; the map then says nothing.';
comment on column public.cameras.source_url is
  'Where the record or report named in source_label is, as an https URL. null where unknown; never set without a label.';

-- version 2.5 added approximate: true where the pin marks the
-- surrounding area rather than an exact spot. The Met's record gives
-- some van sites as a borough or a district, not a street, and the
-- pin for those sits at the middle of the area; 43 sites at the time
-- of writing. The note has always said so in prose - "(pin marks the
-- surrounding area, not an exact spot)" - and the map drew those pins
-- exactly like a pin on a known pole. A column, so that the map can
-- draw the difference from a field rather than by searching the note
-- for a phrase, and so that a moderator's Move, which corrects the
-- position, can be followed by clearing the flag rather than editing
-- prose. Not null, default false: a camera from a report is where the
-- reporter dropped the pin, and that is a claim about a spot.
-- (backend/migrations/003_approximate.sql is this block on its own.)
alter table public.cameras
  add column if not exists approximate boolean not null default false;

comment on column public.cameras.approximate is
  'true where the pin marks the surrounding area rather than an exact spot - the record gave a borough or district, not a street.';

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

-- One row per photo attached to a report. The file itself sits in
-- the private "proof" storage bucket (set up further down) at
-- storage_path, which must be <user id>/<report id>/<file name>. A
-- moderator sees the file through a signed URL the client asks for;
-- nobody else can reach it. Photos only since version 2.12 (the
-- block just below the grants says why); the constraint is named so
-- that block can replace it on an older table.
create table if not exists public.report_proof (
  id           bigint generated always as identity primary key,
  report_id    bigint not null references public.reports(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  mime         text not null
                 constraint report_proof_mime_check
                 check (mime in ('image/jpeg', 'image/png', 'image/webp')),
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

-- version 2.12: video is refused. The form used to take MP4 and WebM
-- and send them as they were, with a hint asking the person to check
-- what theirs contained - on a site whose promise is anonymity, and
-- to the one person who can least afford to leak a position: someone
-- standing in front of a van, filming it. A video carries the same
-- things a photo does - a GPS track, the device, the time - in a
-- container the browser cannot rebuild the way it re-saves a photo
-- through a canvas, and stripping it in plain JavaScript would take a
-- library the Content-Security-Policy will not load. A warning would
-- have made the promise the person's to keep for us. So the form
-- refuses video at the moment of choosing, and this narrows the two
-- places the server decides: the check on report_proof.mime here,
-- and the bucket's allowed_mime_types, below, in the insert that
-- creates it. Migration 010 is the same statements; if you change
-- one, change the other. QUESTIONS.md item 1 records the decision.
--
-- Nothing is deleted. A video row that already exists stays, with
-- its file: taking a person's evidence away because the rule changed
-- is not this schema's to do. The new check is therefore added NOT
-- VALID - checked on every new row, not on old ones - and validated
-- only if no video row exists, so that on a database with none the
-- constraint ends up exactly as a fresh database's does. On one that
-- has some, the notice below says so, and the constraint stays not
-- valid until the maintainer decides what to do with those rows and
-- runs "alter table public.report_proof validate constraint
-- report_proof_mime_check" by hand.
alter table public.report_proof drop constraint if exists report_proof_mime_check;
alter table public.report_proof add constraint report_proof_mime_check
  check (mime in ('image/jpeg', 'image/png', 'image/webp')) not valid;

do $$
declare
  videos integer;
begin
  select count(*) into videos from public.report_proof where mime like 'video/%';
  if videos = 0 then
    alter table public.report_proof validate constraint report_proof_mime_check;
  else
    raise notice 'report_proof has % video row(s) from before version 2.12. They are kept; report_proof_mime_check stays NOT VALID (new rows are still checked) until you decide about them and run: alter table public.report_proof validate constraint report_proof_mime_check', videos;
  end if;
end $$;

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

-- ---------------- moderation_log ----------------

-- version 2.6 added this: one row per thing a moderator does to a
-- camera by hand - adding one, editing one, moving one, hiding or
-- unhiding one, merging two. Moderator id, action, camera, a note, a
-- time; nothing more, and nothing about a reporter that the reports
-- table does not already hold.
--
-- A report's decision has always been recorded on the report -
-- resolved_by, resolved_at, resolution_note - but a camera's had
-- nowhere to go. Hiding one left a note on its approved reports, if
-- it had any; moving one, unhiding one, or editing one left only
-- updated_at, which says when and not who or what. On a project that
-- publishes accusations about surveillance, being able to audit its
-- own moderators is not optional, and "the row was touched at 14:02"
-- is not an audit. Report decisions are deliberately not copied in
-- here: the reports table already records them, in columns the
-- functions that make them already write, and two records of one
-- decision would be two things to keep in step. The Activity tab on
-- the moderation page reads both.
--
-- actor is null for something done without a moderator behind it -
-- a script run with the service role - and becomes null if the
-- moderator's account is ever deleted, so the row outlives the
-- person, which an audit record must. camera_id likewise: cameras
-- are never deleted, but if one ever were the log should not go
-- with it. (backend/migrations/004_moderation_log.sql is this block,
-- and the functions it teaches to write it, on their own.)
create table if not exists public.moderation_log (
  id         bigint generated always as identity primary key,
  actor      uuid references public.profiles(id) on delete set null,
  action     text not null
               check (action in ('add_camera', 'edit_camera', 'move_camera',
                                 'hide_camera', 'unhide_camera', 'merge_cameras')),
  camera_id  bigint references public.cameras(id) on delete set null,
  note       text,
  created_at timestamptz not null default now()
);

-- The Activity tab reads it newest first, a page at a time.
create index if not exists moderation_log_created_idx
  on public.moderation_log (created_at desc);

alter table public.moderation_log enable row level security;

-- Moderators read it; nobody writes it from a browser. The rows are
-- inserted by the functions further down, which run as the table's
-- owner and are not subject to this policy; withholding insert,
-- update and delete from the client roles altogether is what makes
-- the log a record rather than a notebook.
drop policy if exists "moderation_log: read moderator" on public.moderation_log;
create policy "moderation_log: read moderator"
  on public.moderation_log for select
  using (public.is_moderator());

revoke all on public.moderation_log from anon, authenticated;
grant select on public.moderation_log to authenticated;

-- One place the insert is written, so a function that acts on a
-- camera records itself in one line. service_role only: it is
-- called from inside the security definer functions, never from a
-- browser, and a client that could call it directly could write
-- history that did not happen.
create or replace function public.log_moderation(
  actor uuid, action text, cid bigint, note text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  insert into public.moderation_log (actor, action, camera_id, note)
  values (actor, action, cid, note);
end;
$fn$;

revoke all on function public.log_moderation(uuid, text, bigint, text) from public, anon, authenticated;
grant execute on function public.log_moderation(uuid, text, bigint, text) to service_role;

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

-- version 2.11: is a report already waiting here? The one question
-- the report form may ask before Send, so a person placing a pin
-- hears "someone reported this corner two days ago" while they are
-- still placing it rather than "refused" after they have typed
-- everything and attached a photograph. Migration 009 is the same
-- statements; if you change one, change the other.
--
-- Why a function and not a select: the reports read policy shows a
-- person their own rows and a moderator everyone's, and that is
-- right - it is the policy that keeps who-reported-what from anyone
-- else. A plain select from the form could therefore never see
-- another person's pending report, which is exactly the one the
-- question is about. So the answer comes through one narrow window,
-- security definer, that reads across the policy and hands back two
-- fields.
--
-- The anonymity test - what does a stranger learn by calling this
-- repeatedly? Whether a new-camera report is waiting within the
-- auto-approve radius of any point in London, and how many days ago
-- the newest was sent. Not who sent it, not how many people, not its
-- kind, note or exact position. "A report is waiting near here" is
-- the same thing the map would show at that spot once the report is
-- approved, minus the position, and it says nothing about any
-- account; that is why it is acceptable, and why the function is
-- granted to anon as well - the signed-out visitor is filling the
-- form now. What is withheld and why: the count of reports, because
-- the sentence has no use for it and a count is a finer instrument
-- than a flag - watched over time it would say when each report
-- arrived, one by one; and the exact time, rounded to whole days for
-- the same reason. Coordinates in, two fields out, no identity
-- anywhere: that is the line, and it is the one CLAUDE.md draws for
-- every call the browser may make. It is rate-limited by its own
-- cheapness - one probe of reports_pending_cell_idx, the same grid
-- walk cluster_of_report makes - and returns for a point outside
-- London without looking.
--
-- The column is `found`, not `exists`: exists is a keyword, and a
-- column that has to be quoted everywhere it is read is a trap laid
-- for whoever reads it next.
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
-- its reports intact. Idempotent. Since version 2.6 it also writes a
-- moderation_log row with the reason; the note on the approved
-- reports stays too - it is what the reporter reads.
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
  perform public.log_moderation(actor, 'hide_camera', cid, why);
end;
$fn$;

revoke all on function public.hide_camera(bigint, text, uuid) from public, anon, authenticated;
grant execute on function public.hide_camera(bigint, text, uuid) to service_role;

-- Put a hidden camera back. The reverse of hide_camera, for a removal
-- that turned out to be wrong. Logged since version 2.6, but only
-- when something happened - a second call on a camera already on
-- the map is nothing to record.
create or replace function public.unhide_camera(cid bigint, actor uuid default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  update public.cameras set visible = true where id = cid and not visible;
  if not found then
    return;
  end if;
  perform public.log_moderation(actor, 'unhide_camera', cid, null);
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
-- it, with no XP for anyone. Same London box as everything else. The
-- row's own approved_by already says who; the moderation_log row it
-- writes as well (version 2.6) is so the Activity tab has one list
-- of camera actions rather than one per kind.
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
  perform public.log_moderation(actor, 'add_camera', cid, null);
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

-- Move a camera. A pin in the wrong place is the commonest thing
-- wrong with a camera that is otherwise right - a van site the
-- published record gives as a borough rather than a street, a report
-- whose sender dropped the pin on their own doorstep rather than on
-- the pole opposite. Everything else about the row is already
-- correctable: the state through the reports, the presence through
-- hide_camera. The position was the one thing nothing could touch.
--
-- Nothing else on the row changes, and that includes seed_key. It
-- reads "name|lat|lon|type" as the published record gave them, and
-- it is how seed.sql finds a row it has already written. Leaving it
-- alone is what makes a correction survive a re-run of the seed:
-- the row is still matched, its name and note and state are brought
-- up to date, and its coordinates - which the seed's on-conflict
-- deliberately does not write - stay where the moderator put them.
-- Rewriting the key to the new position would make the seed insert
-- a second camera at the old one on its next run.
--
-- The London box is not repeated here. The check constraint on the
-- table is the lock, and the browser checks against LONDON_BOUNDS
-- before sending, so a third copy of the numbers in this function
-- would be one more thing to drift. Out-of-bounds arrives as a
-- constraint violation, which is the honest answer.
--
-- version 2.6 gave it an actor, so the moderation_log can say who
-- moved it, and it records where the pin was: the row carries where
-- it is now, and an audit of a move that cannot say where from is
-- half an audit. A new parameter is a new signature, and
-- create-or-replace would leave the old three-argument function
-- standing beside the new one on a database that has it, so the old
-- one is dropped by name first - a no-op on a fresh database.
drop function if exists public.move_camera(bigint, double precision, double precision);

create or replace function public.move_camera(
  cid bigint, new_lat double precision, new_lon double precision, actor uuid default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  old public.cameras%rowtype;
begin
  if new_lat is null or new_lon is null then
    raise exception 'a camera needs both coordinates';
  end if;

  -- Silence here would look like success to the moderator watching,
  -- and the camera would not have moved. A wrong id is worth hearing
  -- about, unlike hide_camera's second call on an already hidden
  -- camera, which is genuinely nothing to do.
  select * into old from public.cameras where id = cid;
  if not found then
    raise exception 'no camera with id %', cid;
  end if;

  update public.cameras
     set lat = new_lat, lon = new_lon
   where id = cid;

  perform public.log_moderation(actor, 'move_camera', cid,
    format('was at %s, %s', round(old.lat::numeric, 5), round(old.lon::numeric, 5)));
end;
$fn$;

revoke all on function public.move_camera(bigint, double precision, double precision, uuid)
  from public, anon, authenticated;
grant execute on function public.move_camera(bigint, double precision, double precision, uuid)
  to service_role;

-- The browser's way in for a moderator. Checks the role, then moves,
-- passing the moderator through for the log.
create or replace function public.moderate_move_camera(
  cam_id bigint, cam_lat double precision, cam_lon double precision)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not public.is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  perform public.move_camera(cam_id, cam_lat, cam_lon, auth.uid());
end;
$fn$;

revoke all on function public.moderate_move_camera(bigint, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.moderate_move_camera(bigint, double precision, double precision)
  to authenticated, service_role;

-- version 2.7: edit a camera. Everything on the row a moderator might
-- have a reason to correct and that nothing else corrects: the name,
-- the note, the kind, the state. Not the position (move_camera), not
-- visibility (hide_camera), not the counts or the source columns,
-- which are the record's and change in data/cameras.csv. Until this
-- a moderator could add, hide, unhide and move a camera, and a typo
-- in a name was permanent. Same pattern as move_camera: this for the
-- service role, moderate_edit_camera below for the browser.
--
-- What it refuses:
--   - a blank name, as add_camera does;
--   - an id that is not a camera, aloud, as move_camera does;
--   - a van site marked active. Every vancam is legacy - a van parks
--     for a shift and drives away, so no van site claims to be there
--     today - and that is the one invariant of the record this map
--     is most careful about (NOTES.md, "What active means"). The
--     build script refuses it in the CSV; this refuses it here. It is
--     not a check constraint on the table because a live database
--     seeded before every van went legacy still carries van rows that
--     say active (QUESTIONS.md, item 9), and adding the constraint
--     would fail on them; approve_report also still writes a
--     reported van as active, which is left for the maintainer's
--     one-line update in NOTES.md and not changed here.
-- A bad type or state is refused by the table's own check
-- constraints, the same reasoning move_camera gives for the bounds:
-- the constraint is the lock, and a copy of the list here would be
-- one more thing to drift.
--
-- seed_key is not touched, for the reason move_camera does not
-- touch it: it is how seed.sql finds a row it has already written,
-- and rewriting it would make the next seed run insert a second
-- camera. The consequence is worth saying plainly, because it is
-- the opposite of Move's: the seed's on-conflict update rewrites
-- name, note and status from the record, so an edit to a seed
-- camera's name, note or state holds only until the next re-run of
-- seed.sql. A correction to a seed camera is made in
-- data/cameras.csv as well, or it will be undone. (The type is part
-- of the key and not in the update list, so a corrected type
-- survives - and orphans the row from its CSV line the day the
-- record is next built with the old type, which is the same reason
-- to fix the CSV.) The panel on the moderation page says this above
-- the Save button for any camera that came from the seed.
--
-- The log row records which fields changed and what they were, so
-- the previous value is never lost: "name was 'Croydon'; status was
-- active". Nothing is logged, and nothing written, when nothing
-- changed. (backend/migrations/005_edit_camera.sql is this and the
-- wrapper on their own.)
create or replace function public.edit_camera(
  cid bigint, new_name text, new_note text, new_type text, new_status text,
  actor uuid default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  old     public.cameras%rowtype;
  changed text[] := '{}';
  want_name   text;
  want_note   text;
  want_type   text;
  want_status text;
begin
  if new_name is null or btrim(new_name) = '' then
    raise exception 'a camera needs a name';
  end if;

  select * into old from public.cameras where id = cid;
  if not found then
    raise exception 'no camera with id %', cid;
  end if;

  want_name   := btrim(new_name);
  want_note   := coalesce(new_note, '');
  want_type   := coalesce(new_type, old.type);
  want_status := coalesce(new_status, old.status);

  if want_type = 'vancam' and want_status = 'active' then
    raise exception 'a van site cannot be active: a van parks for a shift and drives away, so no van site claims to be there today';
  end if;

  if want_name <> old.name then
    changed := changed || format('name was %L', old.name);
  end if;
  if want_note <> old.note then
    changed := changed || format('note was %L', old.note);
  end if;
  if want_type <> old.type then
    changed := changed || format('type was %s', old.type);
  end if;
  if want_status <> old.status then
    changed := changed || format('status was %s', old.status);
  end if;

  if cardinality(changed) = 0 then
    return;
  end if;

  update public.cameras
     set name = want_name, note = want_note, type = want_type, status = want_status
   where id = cid;

  perform public.log_moderation(actor, 'edit_camera', cid, array_to_string(changed, '; '));
end;
$fn$;

revoke all on function public.edit_camera(bigint, text, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.edit_camera(bigint, text, text, text, text, uuid)
  to service_role;

-- The browser's way in for a moderator. Checks the role, then edits.
create or replace function public.moderate_edit_camera(
  cam_id bigint, cam_name text, cam_note text, cam_type text, cam_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not public.is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  perform public.edit_camera(cam_id, cam_name, cam_note, cam_type, cam_status, auth.uid());
end;
$fn$;

revoke all on function public.moderate_edit_camera(bigint, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.moderate_edit_camera(bigint, text, text, text, text)
  to authenticated, service_role;

-- version 2.8: merge two cameras. approve_report clusters and merges
-- incoming reports, so two people reporting one van site make one
-- camera. But two rows that are already on the map - a seed entry
-- and a reported one at the same spot, or two reports approved a
-- month apart at 150 m - had no way to become one. A moderator could
-- hide one, and lose its reports to a hidden row nobody would look
-- at again. Merging keeps the reports where they can be seen, on the
-- row that stays, and keeps the loser too, hidden, with a note
-- saying where it went. Nothing is deleted. Same pattern as
-- move_camera: this for the service role, moderate_merge_cameras
-- below for the browser. (backend/migrations/006_merge_cameras.sql
-- is this and the wrapper on their own.)
--
-- What it refuses, and why:
--   - the same id twice: there is nothing to merge;
--   - an id that is not a camera, aloud, as move_camera does;
--   - a loser that is already off the map. A hidden camera's reports
--     belong to whatever took it off - a merge already done, a
--     "removed" claim that was approved - and moving them now would
--     put them under a camera they may never have been about. If it
--     really is a duplicate, put it back first and then merge it,
--     so the act is visible for what it is;
--   - a survivor that is off the map. Merging into a hidden camera
--     would take the loser off the map too and leave the reports
--     under a row nobody sees: two cameras lost for one. Merge into
--     one that is on the map, or put the survivor back first.
--
-- What it moves, and what it does not. Every report that pointed at
-- the loser now points at the survivor, with one exception: a state
-- report by someone who has also reported the survivor's state
-- stays where it is, because reports_one_status_per_camera_idx
-- allows one such report per person per camera, and it is still that
-- person's evidence about the loser. The result counts those as
-- "kept". Proof files go with their report; XP was awarded per
-- report and does not change. saved_cameras holds no camera id by
-- design (a position and a name, copied), so nothing there points
-- at either row and nothing there is touched. The survivor's own
-- columns are not touched either: its deployments, periods and
-- source are the record's and the loser's are not added to them,
-- because a sum of two records of the same site would be a count
-- the source never gave.
--
-- The kinds may differ - a shop entered as a fixed install and
-- again as a shop - and the survivor's stands. The panel says which
-- row survives before the moderator confirms.
--
-- The same two advisory locks approve_report takes: an approval
-- racing this could otherwise find the loser still visible, point a
-- fresh report at it, and commit after the loser has gone.
--
-- Returns what the browser needs to say what happened, in one
-- value: which row survived, which was hidden, how many reports
-- moved and how many stayed.
create or replace function public.merge_cameras(loser bigint, survivor bigint, actor uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  l     public.cameras%rowtype;
  s     public.cameras%rowtype;
  moved integer;
  kept  integer;
begin
  if loser is null or survivor is null then
    raise exception 'a merge needs two cameras';
  end if;
  if loser = survivor then
    raise exception 'a camera cannot be merged into itself';
  end if;

  select * into l from public.cameras where id = loser;
  if not found then
    raise exception 'no camera with id %', loser;
  end if;
  select * into s from public.cameras where id = survivor;
  if not found then
    raise exception 'no camera with id %', survivor;
  end if;

  if not l.visible then
    raise exception 'camera % is already off the map: its reports belong to whatever took it off. Put it back first if it is a duplicate', loser;
  end if;
  if not s.visible then
    raise exception 'camera % is off the map: merge into a camera that is on it, or put it back first', survivor;
  end if;

  perform pg_advisory_xact_lock(hashtext('cammap.approve.' || l.type));
  perform pg_advisory_xact_lock(hashtext('cammap.status.' || loser::text));

  update public.reports r
     set camera_id = survivor
   where r.camera_id = loser
     and not (r.kind = 'status' and exists (
           select 1 from public.reports o
            where o.user_id = r.user_id and o.camera_id = survivor and o.kind = 'status'));
  get diagnostics moved = row_count;

  select count(*) into kept from public.reports where camera_id = loser;

  perform public.hide_camera(loser, format('merged into camera #%s', survivor), actor);

  perform public.log_moderation(actor, 'merge_cameras', loser,
    format('merged into camera #%s: %s report(s) moved, %s kept', survivor, moved, kept));

  return jsonb_build_object('survivor', survivor, 'loser', loser, 'moved', moved, 'kept', kept);
end;
$fn$;

revoke all on function public.merge_cameras(bigint, bigint, uuid) from public, anon, authenticated;
grant execute on function public.merge_cameras(bigint, bigint, uuid) to service_role;

-- The browser's way in for a moderator. Checks the role, then merges.
create or replace function public.moderate_merge_cameras(loser bigint, survivor bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not public.is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  return public.merge_cameras(loser, survivor, auth.uid());
end;
$fn$;

revoke all on function public.moderate_merge_cameras(bigint, bigint) from public, anon, authenticated;
grant execute on function public.moderate_merge_cameras(bigint, bigint) to authenticated, service_role;

-- What the moderator's browser calls to undo a decision. Same gate as
-- moderate_report. Actions: hide_camera and unhide_camera take a
-- camera id; retract and reapprove take a report id. Adding, moving,
-- editing and merging cameras are not here - they carry arguments of
-- their own, so each has its own moderate_ function above.
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

-- ---------------- leaving ----------------

-- version 2.10: delete your own account. There was no way out but
-- abandonment. A site built on collecting nothing should let a
-- person take back the little it holds, and be honest about what it
-- cannot take back. What it cannot: a camera that is on the map
-- because of that person's report stays on the map. It is part of
-- the record now, and deleting a person does not un-see a camera.
--
-- What goes, and by what route, is the cascade the tables above
-- already declare: profiles.id references auth.users on delete
-- cascade, and reports, report_proof, xp_events and saved_cameras
-- all reference profiles on delete cascade. So this deletes the
-- auth.users row and the rest follows - the profile, every report
-- the person sent, the proof rows attached to them, the XP awards
-- and the saved list. Three columns elsewhere point at a person and
-- are set null rather than cascading, as they were already declared:
-- cameras.approved_by, reports.resolved_by and moderation_log.actor,
-- so a camera a moderator approved, a decision they made and a
-- change they logged all outlive the moderator, which an audit
-- record must.
--
-- The proof files go by their own route. report_proof rows cascade
-- with the reports, but the files themselves are rows of
-- storage.objects, which references nothing of ours; the storage
-- policies keep them under <user id>/<report id>/<file>, so the
-- caller's are the ones under their own prefix. Deleting the object
-- row is what makes a file unreachable through the storage API - no
-- signed URL can be made for a row that is not there. Whether the
-- bytes behind it are cleared from the bucket's store at once is
-- Supabase's to promise, not this schema's; NOTES.md says so. On
-- Supabase the function's owner is the postgres role, which may
-- delete from auth.users (the housekeeping lines in NOTES.md already
-- do) and, with bypassrls, from storage.objects; if a run ever
-- raises "permission denied for table objects", grant delete on
-- storage.objects to postgres. It is not written to swallow that: a
-- deletion that silently left the photos behind would be a lie to
-- the person who asked for it.
--
-- Why the reports go with the person rather than staying with
-- user_id set null: they are the little the site holds about a
-- person - what they reported, where, when, with what photograph -
-- and taking that back is the point of leaving. What provenance
-- needs of an approved report survives on the camera it made:
-- source = 'report', approved_at, approved_by if a moderator did it,
-- and the camera's rows in moderation_log. What is lost is the
-- report's note and picture, which were the person's.
--
-- The username is released with the profile row - the unique index
-- on lower(username) no longer holds it - so the two words may one
-- day be drawn again for someone else. Nothing would connect them:
-- the reports, the XP and the saved list are gone, and a leaderboard
-- row up to five minutes old names an account that no longer exists.
--
-- The anonymity test: what does a stranger learn by calling this
-- repeatedly with guesses? Nothing. It takes no argument, answers
-- nothing, and deletes the account whose token made the call - the
-- caller and nobody else. Signed out, auth.uid() is null and it
-- refuses. Called twice, the second call finds no session to act on.
-- (backend/migrations/008_delete_account.sql is this on its own.)
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  delete from storage.objects
   where bucket_id = 'proof'
     and split_part(name, '/', 1) = me::text;

  delete from auth.users where id = me;
end;
$fn$;

revoke all on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated, service_role;

-- ---------------- proof bucket ----------------

-- A private bucket for report proof. Rows in storage.objects are what
-- the storage API checks, so the rules live there: upload only under
-- your own user id, to a report of yours that is still pending; read
-- your own or, as a moderator, anyone's; delete your own while the
-- report is pending; never overwrite. The size and type limits are
-- enforced by the bucket itself before a byte is stored. The insert
-- below is what creates the bucket - it appears in the dashboard on
-- its own, and re-running keeps the limits as written here. Photos
-- only since version 2.12 (see report_proof above for why): the
-- on-conflict update is what narrows the list on a bucket that
-- already exists, and the dashboard shows the same list under
-- Storage -> proof -> settings, where it should read the same.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proof', 'proof', false, 20971520,
        array['image/jpeg', 'image/png', 'image/webp'])
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
--
-- "and p.show_on_leaderboard" (version 2.9) is where the opt-out is
-- enforced, in all three: a row that has switched it off never
-- enters the table the page reads. It is here and not in a policy
-- because PostgreSQL applies no row-level security to a materialized
-- view - see the column's comment under profiles.

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
     and p.show_on_leaderboard
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
     and p.show_on_leaderboard
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
     and p.show_on_leaderboard
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
