# Setting up accounts

This covers the Supabase side of the "save a camera" / "submit a sighting"
feature: making a project, turning on anonymous accounts, loading the
schema, and keeping an eye on what gets submitted. It does not cover the
site itself - that is `README.md`.

## 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), sign in, and create a new
project. Any region is fine; pick one near London if you care. Note the
database password it asks you to set - you probably won't need it again,
but write it down somewhere anyway.

## 2. Turn on anonymous sign-ins

This is the step that's easy to miss, and the whole feature fails silently
without it.

In the dashboard: **Authentication → Sign In / Providers → Anonymous
Sign-Ins**, and switch it on. It is **off by default** on every new
project. Until you do this, every call the site makes to sign someone in
anonymously will fail, the account button will not work, and there is
nothing in the browser console that makes the reason obvious.

## 3. Copy the URL and the anon key

**Project Settings → API** has two things you need:

- **Project URL** - looks like `https://xxxxxxxx.supabase.co`
- **anon / public key** (Supabase may also call this the "publishable"
  key). Newer projects give you one starting `sb_publishable_...`;
  older ones give a long JWT starting `eyJ...`. Either works - paste
  whichever your project shows you.

Paste both into `supabase-config.js` in place of the placeholder values.
See that file for exactly which two variables to set.

Do **not** copy the **service_role** key into anything on this page. See
the warning below.

## 4. Run the schema

Open **SQL Editor** in the dashboard, paste in the entire contents of
`schema.sql`, and run it. It creates the three tables, turns on row level
security, adds the trigger that gives every new account a profile row, and
adds the moderation view. It is safe to re-run if you ever need to - it
won't duplicate anything or error on things that already exist.

## 5. Review the submissions queue

Submissions never appear on the live map by themselves - they land in the
`submissions` table with `status = 'pending'` and sit there until you look
at them.

The easy way: **SQL Editor**, and run

    select * from submissions where status = 'pending' order by created_at;

(The SQL editor runs as the database owner, so it sees every row
regardless of row level security - you don't need any special key for
this, just being logged into the dashboard.)

There's also a `admin_submissions_queue` view, which joins each submission
to the handle of whoever sent it. It's there for a script or admin tool
that connects with the **service_role** key rather than the dashboard -
the anon key the site uses cannot read it at all.

When you're happy with a submission, add it to `points.js` by hand the
same way you always do, commit, and push. Then, optionally, mark the row
so you don't look at it again:

    update submissions set status = 'accepted' where id = 123;
    -- or
    update submissions set status = 'rejected' where id = 123;

Only you, running SQL directly (or a service-role script), can do this -
the site itself has no way to change a submission's status, on purpose.

## Keys: what's safe to publish and what isn't

This is a static site with no server, so the browser needs a real key to
talk to Supabase, and that key ends up in your public repository and in
every visitor's network tab whether you like it or not. Supabase is built
around that:

- The **anon / public key** is *meant* to be public. It identifies your
  project, not a user, and it can only do what the row level security
  policies in `schema.sql` allow - which, by design, is read and write a
  signed-in user's own rows and nothing else. Commit it. There is no
  static-site alternative.
- The **service_role key** bypasses row level security entirely - it can
  read and write every row in every table, including other people's. It
  must **never** appear in this repository, in `supabase-config.js`, in a
  commit, in a build log, or anywhere else a browser or a public GitHub
  page could expose it. Keep it only in the Supabase dashboard, or in your
  own local shell / password manager if you need it for a one-off script.

If the service_role key ever does leak, generate a new one from **Project
Settings → API** immediately - that revokes the old one.

## The real abuse risk: anonymous accounts are cheap

Anonymous sign-in has no password, no email, nothing to fill in - which is
the point, but it also means a bot can call `signInAnonymously()` in a
loop and mint thousands of accounts a minute if nothing is stopping it.
None of those accounts can touch the published map, but they can still
fill your database with junk rows and use up your project's free-tier
limits.

Two things to look at in the dashboard:

- **Authentication → Rate Limits** - Supabase applies a default limit to
  sign-ins per IP per hour; check it hasn't been loosened, and tighten it
  further if this site ever gets unwanted attention.
- **Authentication → Attack Protection** (CAPTCHA) - you can require a
  CAPTCHA (hCaptcha or Turnstile) before sign-in succeeds. Worth turning
  on if you ever see a spike of anonymous accounts with nothing attached
  to them.

You can also clean up stale anonymous accounts by hand - ones that never
saved a camera or submitted anything, and are old enough that they're
clearly not mid-visit. Run this in the SQL editor now and then:

    delete from auth.users
    where is_anonymous = true
      and created_at < now() - interval '30 days'
      and id not in (select user_id from saved_cameras)
      and id not in (select user_id from submissions);

That only removes accounts with nothing attached to them - anyone who
actually used the site (saved a camera or sent a submission) is left
alone, forever, until they clear their own browser storage and lose their
own way back into the account.
