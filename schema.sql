-- ------------------------------------------------------------------
--    cammap - supabase schema
--
--    Backs the "accounts" feature: a visitor presses a button, gets
--    an anonymous supabase account, and can then save cameras to a
--    private list and submit new sightings for review. The published
--    map itself never reads any of this - it is still driven entirely
--    by points.js and a commit. Nothing a client can do through this
--    schema can put a point on the live map. Submissions only ever
--    reach a moderation queue that the site owner reads by hand.
--
--    Paste this whole file into the supabase SQL editor and run it.
--    It is safe to run more than once: tables, indexes and the
--    trigger function are all guarded, and policies are dropped and
--    recreated rather than erroring if they already exist.
-- ------------------------------------------------------------------

-- ---------------- profiles ----------------

-- One row per account, keyed to auth.users so it can never outlive the
-- user it belongs to. Created automatically by the trigger further
-- down - the frontend never inserts into this table itself.
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  handle     text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

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
revoke all on public.profiles from anon, authenticated;
grant select, update on public.profiles to authenticated;

-- ---------------- saved_cameras ----------------

-- A user's private starred list. Nothing in here is ever shown to
-- anyone but the user who saved it.
create table if not exists public.saved_cameras (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  camera_name text not null,
  lat         double precision not null,
  lon         double precision not null,
  note        text default '',
  created_at  timestamptz default now(),

  -- same bounds as LONDON_BOUNDS in map.js - a save outside Greater
  -- London means something is wrong upstream, so reject it here too
  -- rather than only in the browser.
  constraint saved_cameras_in_london check (
    lat between 51.28 and 51.70 and
    lon between -0.51 and 0.33
  ),

  -- stops the same camera being saved twice by the same person. Keyed
  -- on name + coordinates rather than an id because saved cameras are
  -- copied out of points.js, which has no stable id of its own.
  constraint saved_cameras_unique_per_user
    unique (user_id, camera_name, lat, lon)
);

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

-- ---------------- submissions ----------------

-- Proposed sightings, waiting for the site owner to look at them by
-- hand. This table is the entire moderation queue - there is no other
-- copy of it. Getting into points.js is a separate, manual step: the
-- owner reads a row here, checks it, and if it stands up, adds it to
-- points.js themselves and commits. Nothing here ever appears on the
-- live map on its own.
create table if not exists public.submissions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  note       text default '',
  lat        double precision not null,
  lon        double precision not null,
  status     text not null default 'pending'
               check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz default now(),

  constraint submissions_in_london check (
    lat between 51.28 and 51.70 and
    lon between -0.51 and 0.33
  )
);

create index if not exists submissions_user_id_idx on public.submissions(user_id);
create index if not exists submissions_status_idx on public.submissions(status);

alter table public.submissions enable row level security;

drop policy if exists "submissions: read own" on public.submissions;
create policy "submissions: read own"
  on public.submissions for select
  using (auth.uid() = user_id);

-- A user may propose a sighting, but never as anything other than
-- pending: the with-check pins status regardless of what the insert
-- statement tries to send, so there is no way to submit something
-- that is already 'accepted'.
drop policy if exists "submissions: insert own pending" on public.submissions;
create policy "submissions: insert own pending"
  on public.submissions for insert
  with check (auth.uid() = user_id and status = 'pending');

-- Deliberately no update policy and no delete policy on this table
-- at all. The obvious way to stop someone approving their own
-- submission is a with-check that only lets status move in one
-- direction - but that is more moving parts than this needs, and
-- every extra clause is another place to get it wrong. It is
-- simpler and safer to give the anon key no update path on
-- submissions whatsoever: moderation (setting status to accepted or
-- rejected) can only be done with the service role key, which never
-- goes near the browser. If a "withdraw my submission" feature is
-- wanted later, add a narrow delete-own policy then, deliberately.

revoke all on public.submissions from anon, authenticated;
grant select, insert on public.submissions to authenticated;

-- ---------------- new account -> profile row ----------------

-- Runs as the function's owner (whoever ran this script, normally
-- the postgres role), which owns the profiles table too, so this
-- insert goes through regardless of the row level security policies
-- above - those apply to the browser's session, not to this trigger.
-- search_path is pinned so the function can't be tricked by a
-- differently-scoped object of the same name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------- moderation queue ----------------

-- Submissions joined to the handle of whoever sent them, newest
-- first. This is for the site owner's own use with the service role
-- key (or the SQL editor, which already sees everything as the table
-- owner) - it is not reachable through the anon key at all, revoked
-- below on principle even though RLS on the underlying tables would
-- already stop an ordinary user's row showing up here.
create or replace view public.admin_submissions_queue as
select
  s.id,
  s.status,
  s.name,
  s.note,
  s.lat,
  s.lon,
  s.created_at,
  s.user_id,
  p.handle as submitted_by_handle
from public.submissions s
join public.profiles p on p.id = s.user_id
order by s.created_at desc;

revoke all on public.admin_submissions_queue from public, anon, authenticated;
grant select on public.admin_submissions_queue to service_role;
