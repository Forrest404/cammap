-- ------------------------------------------------------------------
--    cammap - migration 008: delete your own account
--
--    Adds delete_my_account(): the one call a signed-in person may
--    make to remove their account, and everything the site holds
--    about them, in one statement. Nothing else changes.
--
--    Run this in the Supabase SQL editor, after 007. Nothing is
--    applied by the programme that wrote this; the maintainer runs
--    it. Safe to run again - the function is create-or-replace - and
--    a fresh database gets the same result from schema.sql, which
--    carries this as "version 2.10". The two must say the same
--    thing; if you change one, change the other.
--
--    Why: there was no way out but abandonment. A site built on
--    collecting nothing should let a person take back the little it
--    holds, and be honest about what it cannot take back. What it
--    cannot: a camera that is on the map because of that person's
--    report stays on the map. It is part of the record now, and
--    deleting a person does not un-see a camera.
--
--    What goes, and by what route, is the cascade the tables already
--    declare: profiles.id references auth.users on delete cascade,
--    and reports, report_proof, xp_events and saved_cameras all
--    reference profiles on delete cascade. So the function deletes
--    the auth.users row and the rest follows - the profile, every
--    report the person sent, the proof rows attached to them, the XP
--    awards and the saved list. Three columns elsewhere point at a
--    person and are set null rather than cascading, as they were
--    already declared: cameras.approved_by, reports.resolved_by and
--    moderation_log.actor, so a camera a moderator approved, a
--    decision they made and a change they logged all outlive the
--    moderator, which an audit record must. The comment on the
--    function says why the reports go rather than staying detached.
--
--    On Supabase the function's owner is the postgres role, which
--    may delete from auth.users (the housekeeping lines in NOTES.md
--    already do, from the SQL editor) and, with bypassrls, from
--    storage.objects. If a run of this ever raises "permission
--    denied for table objects", grant delete on storage.objects to
--    postgres and run it again; the function is not written to
--    swallow that, because a deletion that silently left the photos
--    behind would be a lie to the person who asked for it.
-- ------------------------------------------------------------------

-- The proof files go by their own route. report_proof rows cascade
-- with the reports, but the files themselves are rows of
-- storage.objects, which references nothing of ours; the storage
-- policies keep them under <user id>/<report id>/<file>, so the
-- caller's are the ones under their own prefix. Deleting the object
-- row is what makes a file unreachable through the storage API - no
-- signed URL can be made for a row that is not there. Whether the
-- bytes behind it are cleared from the bucket's store at once is
-- Supabase's to promise, not this schema's; NOTES.md says so.
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
