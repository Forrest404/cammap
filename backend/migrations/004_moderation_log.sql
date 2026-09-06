-- ------------------------------------------------------------------
--    cammap - migration 004: moderation_log
--
--    Adds public.moderation_log - one row per thing a moderator does
--    to a camera by hand: adding one, editing one, moving one, hiding
--    or unhiding one, merging two - and teaches the functions that do
--    those things to write it. Moderator id, action, camera, a note,
--    a time; nothing more, and nothing about a reporter that the
--    reports table does not already hold. Readable by moderators only.
--
--    Run this in the Supabase SQL editor, before 005 and 006, which
--    write to it. Nothing is applied by the programme that wrote
--    this; the maintainer runs it. Safe to run on a database that
--    already has it - the table is create-if-missing, the policy is
--    dropped and recreated, the functions are create-or-replace, and
--    the one signature change (move_camera gains an actor) drops the
--    old signature by name first, which is a no-op once it is gone.
--    A fresh database gets the same result from schema.sql, which
--    carries this as "version 2.6". The two must say the same thing;
--    if you change one, change the other.
--
--    Why a table: a report's decision has always been recorded on the
--    report - resolved_by, resolved_at, resolution_note - but a
--    camera's had nowhere to go. Hiding one left a note on its
--    approved reports, if it had any; moving one, unhiding one, or
--    (from 005) editing one left only updated_at, which says when and
--    not who or what. On a project that publishes accusations about
--    surveillance, being able to audit its own moderators is not
--    optional, and "the row was touched at 14:02" is not an audit.
--
--    Report decisions are deliberately not copied in here. The
--    reports table already records them, in columns the functions
--    that make them already write, and two records of one decision
--    would be two things to keep in step. The Activity tab on the
--    moderation page reads both.
-- ------------------------------------------------------------------

-- ---------------- the table ----------------

-- actor is null for something done without a moderator behind it -
-- a script run with the service role - and becomes null if the
-- moderator's account is ever deleted, so the row outlives the
-- person, which an audit record must. camera_id likewise: cameras
-- are never deleted, but if one ever were the log should not go
-- with it. The action list carries merge_cameras from the start
-- rather than being widened by 006, so the constraint is complete
-- whichever migrations have run.
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
-- inserted by the functions below, which run as the table's owner
-- and are not subject to this policy; withholding insert, update and
-- delete from the client roles altogether is what makes the log a
-- record rather than a notebook.
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

-- ---------------- the functions that now write it ----------------

-- hide_camera: as before, and a log row with the reason. The note on
-- the approved reports stays too - it is what the reporter reads.
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

-- unhide_camera: as before, and a log row. Only when something
-- happened - a second call on a camera already on the map is nothing
-- to record.
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

-- add_camera: as before, and a log row. The row's own approved_by
-- already says who; the log is so that the Activity tab has one
-- list of camera actions rather than one per kind.
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

-- move_camera gains an actor, so the log can say who moved it, and
-- records where the pin was: the row carries where it is now, and
-- an audit of a move that cannot say where from is half an audit.
-- A new parameter is a new signature, and create-or-replace would
-- leave the old three-argument function standing beside the new
-- one; it is dropped by name first. Everything the old comment said
-- still holds: seed_key is not touched, and the London box is the
-- table's check constraint, not repeated here.
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

-- The browser's way in, unchanged in shape: it now passes the
-- moderator through.
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
