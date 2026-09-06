-- ------------------------------------------------------------------
--    cammap - migration 002: source_label and source_url
--
--    Adds to public.cameras two nullable text columns saying where a
--    row comes from: source_label names the record or report it rests
--    on ("Met Police LFR deployment record, 2025", "British Transport
--    Police LFR deployment register, 2026", "The Register, 6 February
--    2026") and source_url is where that document is. Plus the two
--    check constraints that keep them honest.
--
--    Run this in the Supabase SQL editor, after 001_periods.sql, then
--    run backend/seed.sql again: the seed's on-conflict update carries
--    both columns, so the re-run fills them on every seed row that
--    has a source. Nothing is applied by the programme that wrote
--    this; the maintainer runs it.
--
--    Safe to run on a database that already has it - every statement
--    is add-if-missing or drop-then-add - and a fresh database gets
--    the same result from schema.sql, which carries this block as
--    "version 2.4". The two must say the same thing; if you change
--    one, change the other.
--
--    Why two columns and not a link in the note: provenance was prose
--    inside note with nothing to click. "Met Police LFR van - 3
--    deployments 2023-2025" says which record without saying where it
--    is, and a map that can point at its sources is evidence where
--    one that cannot is a claim. Both columns are null where no
--    source is known, and null is what the map should show as
--    nothing at all - a camera without a source says nothing rather
--    than something vague. A URL is never invented, never a homepage,
--    never a guess; where the only address known is the page a
--    multi-document record is published on, that page is what is
--    given.
--
--    The two rules the server holds whatever wrote the row: a URL is
--    https with no whitespace in it, and a URL needs a label, because
--    a link with no name is not a citation. The same two rules are in
--    tools/build_points.py and tools/check.js.
-- ------------------------------------------------------------------

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
