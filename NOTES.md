# Notes and details about the project

## Project goals

- The goal of *cammap* is to create a website that:
    - Maps all LFR vans and fixed cameras across london - with locations all over the world planned after finishing the london version
    - It differentiates between different types of cameras - fixed cameras, van cameras, nonfunctional cameras, supermarket (facewatch) cameras, british transport map, and more - using different colours which are visible in the bottom right corner below the map - It does this by using an SQL database which has different identifiers - e.g. fixedcam, nonfunccam, facewatchcam, vancam, transportcam, etc, which makes things easier. The names must be unique as such to make the map scalable to different cities and countries.
    - It shows previous facial recognition cameras with a "legacy" toggle, and may have a feature that uses AI to predict/track the facial recognition vans
    - The map can be viewed as a normal street map or in a satellite, etc view.
    - It has an accounts feature where users sign up with a simple username and password - Accounts should be completely anonymous - a user makes an account under a username and has to assign a strong password (one capital letter, number and symbol...). IP addresses might be logged to prevent spam but hopefully not to maintain complete anonymity
    - The accounts feature distinguishes between moderators/admins and normal users. The normal user has access to a "report camera" button which allows them to report cameras and also report the status of cameras - e.g. if they are nonfunctional. They can upload images for proof and videos too, in a totally anonymous manner. They also have access to a leaderboard which displays the top users. Different camera categories have different ammounts of XP (experience points) gained. For example, a normal camera will gain 5xp whereas a nonfunctional or transport one will gain 50XP (as an example). New users gain more xp than established ones (perhaps) and there are daily/weekly EXP counts too.
    - Admins however have a different view. They can authorise cameras which have been reported to enable them to be seen on the map. Cameras are also added if 3 (or 5) or more users report them within the same fixed radius, to bypass moderation, in case the site becomes very popular.

    - The UI must be easy to use, lightweight, working on mobile, and polished.

## Where things are

    index.html          the map. Stays at the root: it is what a web server
                        hands out for the site's own address.
    .claude/CLAUDE.md   the house rules, for anyone (or anything) picking
                        the project up cold.
    supabase-config.js  the two public values you paste after making a
                        Supabase project.

    pages/              every other page - about, blog, account, report,
                        moderate, leaderboard.
    frontend/           the code that runs in a browser: shared.js, map.js,
                        picker.js, account.js, style.css.
    data/               cameras.csv, the record - the one file you edit -
                        and points.js, written out from it by
                        tools/build_points.py along with backend/seed.sql.
    backend/            schema.sql and seed.sql - the database.
    lib/ fonts/         vendored, pinned by version, not ours to edit.
    tools/              stamp.py and check.js, both run before every
                        commit: the first stamps the assets, then checks
                        that every copy of what this repository writes out
                        twice still agrees; the second checks the record
                        and the pure functions in bare Node (see
                        "Deploying a change" below).
    .github/workflows/  check.yml - GitHub runs stamp.py --check and
                        check.js on every push and pull request. Not
                        served by Pages.

Links are written relative to wherever the page sits, so index.html reaches
`pages/about.html` while a page in pages/ reaches `../index.html`. account.js
works this out with `pageHref()` rather than hard-coding either.

`frontend/shared.js` holds what the other files must agree on: the kinds of
camera (`CAMERA_TYPES` - colour, label, identifier), the London bounds, the two
base map styles, and the correction the dark one needs against this page
(`LIFT`, `tidyBaseStyle`). The legend, every drop-down on every page, and every
label are built from it, so adding a kind of camera is one edit rather than
five. The database keeps its own copy of the types and the bounds in `check`
constraints, on purpose: the server has to refuse a bad row without trusting
anything a browser sent.

`frontend/picker.js` is the pin-dropping map - drop a pin, drag it, and the two
coordinate boxes follow. It draws the same base map through the same shared
code, so the picker and the map cannot come to disagree about what London looks
like. Two pages besides the map itself load MapLibre for it: the report form,
where someone is placing a camera, and the moderation page's Cameras tab, where
a moderator is correcting where one already is. Same question, so the same map.

It carries the same two toggles the map page has. **Satellite** is the one that
earns its place on a form: a street diagram tells you which road, a photograph
tells you which pole. **Legacy** filters the context dots, which are active
cameras by default - a retired camera on your corner does not make your
sighting a duplicate, and may be the reason you are reporting it.

**The build script.** `tools/build_points.py` writes `data/points.js` and
`backend/seed.sql` from `data/cameras.csv`, which is the record. Edit the
CSV, run the script, commit all three. `stamp.py` regenerates both outputs
on every run and fails if either is not what the CSV produces, so neither
can be hand-edited by accident, and a CSV edit cannot be committed without
being built. For a long time the script was missing and the two files were
kept in step by hand; the long version is "The build script and the record"
below.

## TODO

- [x] Make it *active* facial recognition cameras, and add a legacy toggle to show ones previously in use. (Done, then rethought - see "What active means" below. Every van site is now legacy; only the 17 cameras fixed to something show by default.)
- [x] ~~Use AI to predict where the next LFR deployments will be.~~ **Dropped, deliberately.** 182 sites drawn from annual FOI records cannot support a credible forecast, and this map's own data note says "Nothing here is estimated" - a confident guess printed beside a public record invites people to read it as one. On a civil liberties map that is a liability, not a feature.

  What was built instead answers the question people actually have, out of data already held: **Most used**, the sort beside the camera list, orders by `deployments` - how many times a source records a spot being used. Same number the glow is weighed by. It says where they have gone again and again, which the record does support.
- [x] Make the fixed LFR cameras (not vans) a different color to the vans. (Done: one colour per kind, legend under the map, built from the same table the map paints from.)
- [x] Add satellite, etc views. (Done: three base views under the map - Dark, Light and Satellite. Light is OpenFreeMap's Bright - blue water, green parks, warm off-white land; Positron was tried first but is colourless by design; Satellite is Esri World Imagery under the dark style's labels. Which one you chose is remembered.)
- [x] Accounts should be completely anonymous - a user makes an account under a username and has to assign a strong password. (Done: the site generates the username - two words, `copper.heron` - and the person sets a password. No email, no name. See "Anonymity" below for what "completely" honestly means.)
- [ ] Make it so that when reporting the state of a camera, you have to upload an image
- [ ] Get the Met's 2026 deployment record (met.police.uk blocks scripted downloads; it needs a real browser), add its sites to `data/cameras.csv`, and run `python3 tools/build_points.py`.
- [ ] Other cities. The type identifiers and the schema carry over; the London bounds are now `LONDON_BOUNDS` in `frontend/shared.js` (one place, shared by the map and the report form), the opening centre `LONDON_CENTRE` beside it, the opening zoom in `frontend/map.js`, and three `check` constraints in `backend/schema.sql` - on `cameras`, `reports` and `saved_cameras`. Wherever the user is located, thats where the map displays by default.

  Worth saying plainly before that last part is built: asking every visitor for their location, to centre a map, is a real cost to a site whose whole argument is that it collects nothing. `navigator.geolocation` prompts, and a refusal has to work as well as a yes. If it is done, it should be a button the visitor presses rather than something that happens to them on arrival - which is how the report form already does it.

## Setting the site up

The site is static files on GitHub Pages plus one Supabase project. Everything below is a one-off.

### Supabase dashboard

1. **Authentication -> Providers -> Email**: on. **Confirm email: OFF.** With it on, every sign-up tries to send mail and the free tier refuses the fourth in an hour, which caps real sign-ups. The hidden login email (`<username>@users.cammap.app`) is never a real mailbox; it exists because Supabase wants one to hang a password on. **It must not change**, or every existing account stops matching.
2. **Authentication -> Providers -> Email -> Password requirements**: "Lowercase, uppercase letters, digits and symbols", minimum length **10**. The client repeats this rule so the message is ours; the dashboard is what enforces it.
3. **Authentication -> Providers -> Anonymous sign-ins: OFF.** The old one-press accounts are retired; the client signs any it finds out.
4. **Authentication -> Rate Limits**: leave the defaults, tighten if abuse appears. (CAPTCHA needs a remote script, which this site's no-CDN rule forbids - and the Content-Security-Policy on every page now enforces that rule rather than trusting it; rate limits and the report throttle in the database come first.)
5. **SQL Editor**: paste and run `backend/schema.sql`, then `backend/seed.sql`. Both are safe to run again.
6. **Database -> Extensions**: enable `pg_cron`, then run `backend/schema.sql` once more - the leaderboard refresh is scheduled only when the extension is present. Without it the leaderboards are still there, just never updated; refresh by hand with `select refresh_leaderboards();`.
7. **Storage**: the `proof` bucket is created by `backend/schema.sql` (private, 20 MB, images and MP4/WebM only). Nothing to do.

### Deploying a change

GitHub Pages caches files for ten minutes. Run `python3 tools/stamp.py` before
committing: it puts a version on the site's own script and stylesheet
tags so a returning visitor's browser fetches them afresh instead of
pairing new HTML with old JavaScript. Skip it and the first visit after
a deploy can show a page whose buttons do nothing.

The same run then checks the things this repository writes out more than
once. There is no build step, so there are no partials and no generator:
the shared parts of the site are copied onto every page, and the camera
record is kept in two forms, all in step by hand. Each check below guards
a copy that has drifted, or nearly drifted, before, and a failure names
the page, the row or the constraint and exits non-zero:

- the Content-Security-Policy is the same on every page;
- the nav and the footer are the same on every page. They are compared
  with the `../` and `pages/` prefixes taken off hrefs, `class="current"`
  ignored, and whitespace collapsed - those legitimately differ by page -
  so a link missing from one page still fails while a page in a deeper
  folder does not;
- every script and stylesheet a page loads from this repository is in the
  `OWN` list the stamp covers, so nothing of ours is ever left unstamped;
- `data/points.js` and `backend/seed.sql` hold the same cameras, in the
  same order, field for field, and every `seed_key` is what its own row's
  name, position and type say it should be;
- every camera in both files is inside `LONDON_BOUNDS`, and the three
  `check` constraints in `schema.sql` carry the same four numbers as it;
- every `vancam` is `legacy`, in both files ("What active means", below);
- every type in `CAMERA_TYPES` is in all three `check (type in ...)`
  constraints, and nothing is in a constraint that is not a `CAMERA_TYPES`
  type or `NONFUNCTIONAL_TYPE`.

Every page is found rather than listed - whatever `.html` is at the root
and everything under `pages/`, however deep - so a new page is checked from
the moment it exists. The bounds and the types are read from `shared.js`
and `schema.sql` on each run rather than copied into the script, so it is
not one more copy to keep in step.

`python3 tools/stamp.py --check` runs every check and writes nothing. A
page whose stamps would change is then a failure naming the page, not a
repair. That is the form for CI: on a checked-out tree a stale stamp means
somebody committed without running the script, and the build should say so
rather than quietly fix it.

That is what `.github/workflows/check.yml` does. On every push to every
branch and every pull request, GitHub checks out the tree and runs
`python3 tools/stamp.py --check`, then `node tools/check.js`, on the
runner's own Python and Node with nothing installed, and the run goes red
if either exits non-zero. It is a checker, not a build: the site is still
served from `main` as committed, and nothing under `.github/` reaches it. A
red run is a notice, not a lock - Pages deploys regardless - so a commit
that reached `main` without the scripts is fixed forward. To make it a
lock, require the `check` status in the branch protection for `main`.

`node tools/check.js` is the nearest thing to tests. It needs Node and
nothing else, and it exits non-zero naming what broke - a van site claiming
to be active, a colour that is not a colour, a seed key the SQL and the
JavaScript build differently. `seedKeyOf` now lives in `shared.js` so it can
be checked and so the build script has one place to copy the format from.
Run both scripts before every commit.

### Sharing the site

Everything that decides what the site looks like from outside a
browser tab - in a link preview, a search result, on a home screen, in
a crawler's list - and the two files that say how it may be reused.
None of it touches the map, the record or the database; all of it is
static files and the `<head>` of every page.

**The site's address is written in nine places.** The site lives at
`https://forrest404.github.io/cammap/` - GitHub Pages, branch `main`,
no custom domain - and because a link preview, a sitemap and a manifest
all need an absolute address, it is written out rather than worked out.
If it ever moves to a domain of its own, every one of these changes in
the same commit:

    robots.txt              the Sitemap line
    sitemap.xml             every <loc>
    every page's <head>     <link rel="canonical">, og:url, og:image,
                            twitter:image (seven pages, absolute)
    404.html                <base href="/cammap/"> - the path only;
                            at the root of a domain it becomes "/"
    manifest.json           nothing: start_url and scope are "./" and
                            resolve against wherever the manifest is
    LICENSE                 the attribution line for the data
    tools/share-card.html   the address in the caption, and so
                            img/share.png, which needs making again

**Share cards (REACH-1).** Every page carries a `<meta name="description">`,
a canonical link, and the Open Graph and Twitter tags that turn a pasted
link into a card: `og:title`, `og:description`, `og:url`, `og:image`
with its width and height and an `alt`, and `twitter:card` set to
`summary_large_image`. Each page's title and description are its own
and say what that page is - the map, the account, the report form -
because one description across seven pages is the failure mode. None
of them names the count: a number in a `<meta>` goes stale without a
sound, and the count belongs to the map page, which computes it.

All seven show the same picture, `img/share.png`, 1200 by 630, which
is the map itself photographed and committed, because a static site
has nothing to draw one with on request. `tools/share-card.html` is
the page that gets photographed: it loads the record, `shared.js` and
`map.js` exactly as `index.html` does, and deliberately not
`supabase-config.js`, so the card is the published record and never
the live table (which has been seen at 117 of 187 while the record
said 17 of 182). Nothing on it is scripted inline - it runs under the
site's own policy - so the count in the corner is written by
`map.js`'s `render()` into an element it already knows the id of, and
the glow is turned on with `map.js`'s own Legacy button. The header of
that file has the full recipe; the short form is: serve the repository,
open the page, press Legacy, paste
`map.jumpTo({ center: [-0.12, 51.47], zoom: 10 })` into the console,
wait for the tiles, and capture the `.card` element at pixel ratio 1.
Zoom 10 rather than the map page's 11 because at 11 Croydon - the
record's hottest spot - is off the bottom; the centre is a little south
and west of `LONDON_CENTRE` so that Croydon and Romford are both on the
card and Croydon's glow clears the caption. The first card was made
the same way headless, driving the system Chrome over the DevTools
protocol with the same three lines as the expression to run before the
shot; any such harness will do. Judge the result at thumbnail size - it
is seen in a feed at 400 pixels wide, not at 1200 - and make it again
whenever the count changes. The platforms cache a card by its URL, so
after a change their own debuggers (Facebook's sharing debugger,
LinkedIn's post inspector) are how to make them fetch it afresh.

**The favicon and the manifest (REACH-2).** `img/favicon.svg` is the
source: a filled dot inside a hollow ring, the accent on the page
black - the map's own vocabulary, a solid dot for a fixed camera and a
ring for a van site. The rasters beside it are drawn from the same
geometry with Pillow, which is on the machine the site is maintained
from and is not a dependency of the site: three discs at 24.5, 17.5
and 8 sixty-fourths of the width, drawn at eight times the size and
brought down with Lanczos, for 180 (`apple-touch-icon.png`, iOS), 192
and 512 (`icon-192.png`, `icon-512.png`, the manifest). `favicon.ico`
carries 16, 32 and 48 for Safari and anything older, each drawn at its
own size rather than shrunk from one, so the 16 is a ring and not a
smudge; Pillow's ICO writer drops any size larger than the image it is
handed, so the 48 has to be the base and the others appended.

`manifest.json` cannot carry a comment, so its reasoning is here. It
names the site, opens it `standalone` - a window without browser
chrome, which is what "Add to Home Screen" wants to produce - and
paints the splash and the frame the page's own `#0d0d0d`. `start_url`
and `scope` are `./`, which resolve against the manifest's own address
and so mean the site root without writing it. The 512 is listed twice,
once as `any` and once as `maskable`: Android crops a maskable icon to
a circle and keeps only the inner 80%, and the ring's outer edge sits
at 38% of the width, so the same file serves. `theme-color` on every
page colours the browser's own frame around the page to match, and
`apple-mobile-web-app-title` is the name iOS puts under the icon,
which would otherwise be the page's `<title>`. All of it is linked from
every head with `img/` at the root and `../img/` under `pages/`; the
404 page's `<base>` makes the root form right there too. A linked icon
also stops the browser probing for `/favicon.ico` at the origin root,
which is not ours on `github.io` and was a 404 in every console.

**robots.txt and sitemap.xml (REACH-3).** `robots.txt` allows
everything and names the sitemap. `sitemap.xml` is hand-written - six
addresses do not need a generator - and each carries the date of the
page's last commit, which is what a crawler uses to decide whether to
come back. When a page changes, update its `lastmod` with

    git log -1 --format=%cs -- pages/about.html

(the command cannot be written in the sitemap's own comment: an XML
comment may not contain two hyphens in a row). The moderation page is
the one page not meant to turn up in a search, and it is kept out with
`<meta name="robots" content="noindex">` in its own head rather than a
`Disallow` here. The two are not interchangeable: a crawler forbidden
to fetch a page never reads the `noindex` inside it and can still list
the address from links elsewhere, so a `Disallow` keeps a page in
search results rather than out of them. The sitemap leaves it out for
the same reason - a page that is listed and refuses indexing is a
contradiction Search Console reports as an error. The 404 page is
`noindex` too, though Pages serves it with a 404 status and that alone
would do.

**The 404 page (REACH-4).** GitHub Pages serves a root `404.html` for
any address it cannot find, so one page covers every rotted link. It
is one of `stamp.py`'s pages the moment it exists, so it carries the
same CSP, nav and footer as the rest and is checked with them. Two
things about it are unlike the others, both because it is served at
every missing path rather than one: a `<base href="/cammap/">` makes
every relative URL on it resolve from the site root whatever was asked
for (the CSP's `base-uri 'self'` allows it; it is the one place the
Pages path is written into a page); and `account.js` is not loaded,
because it decides where it is by looking for `/pages/` in the URL,
which on this page is wrong half the time, and under the `<base>` a
wrong guess is a broken account link. The nav keeps its three static
links. A local `python3 -m http.server` serves its own error page for
a missing path, so to check this one, open `/404.html` directly - and
serve the repository as `/cammap/` under something (a symlink in a
temporary directory does it) if the `<base>` is to resolve locally.

**The licence (REACH-7).** `LICENSE` at the root. The record -
`data/cameras.csv`, `data/points.js`, `backend/seed.sql`, and any download
of the same cameras in another format - is under the Open Database License
1.0, with the attribution line to use. ODbL over CC BY-SA because the
record is a database, queried and joined, rather than a document read and
quoted; it is what OpenStreetMap chose for the same reason, and the base
tiles are already under it. The code is deliberately not licensed: the
maintainer decided on 2026-09-06 that the project is not open source, so
everything that is not the record is all rights reserved, and `LICENSE`
says so in as many words. The copyright holder is "cammap contributors",
because the site puts no names on itself and its licence is not the place
to start. The footer on every page says "Data ODbL 1.0 · licence"; both
links leave the site, because Pages serves a file with no extension as an
untyped download in most browsers. `lib/` and `fonts/` are vendored under
their own licences and are not ours to license either way.

**The donate line (WORD-5).** The footer says donations pay for the
hosting and names no figure. It should: a precise small number is far
more persuasive than an unspecified appeal, and it fits a site that
says exactly what it knows everywhere else. The figure was not
available when this was written, and on a site whose argument is that
nothing on it is estimated, a hosting cost that was is worse than
none. So the sentence stands as it was, and beside it on all eight
pages is a `TODO (WORD-5)` comment - seen by whoever edits the footer,
never by a visitor - with the exact sentence to type once the number
is known (QUESTIONS.md, item 2). Eight copies because the footer is
written out per page and `stamp.py` holds them to be the same; when
the number goes in, it goes in everywhere at once.

### What active means

Every one of the 163 LFR van sites carries `status: legacy`, so the map opens
on the 17 cameras that are actually fixed to something - the two Croydon
installs, the nine station deployments, the seven shops - and the van record is
behind the **Legacy** toggle.

It used to split them. A van site was active if the newest Met record we held
(2025) listed a deployment there, legacy if it did not, and `build_points.py`
computed that from `LATEST_MET_YEAR`. The split was dropped because it drew a
line between two things that are equally uncertain in the only sense a visitor
cares about: an LFR van parks for a shift and drives away, so a 2025 deployment
is no more a claim that a van is at that spot today than a 2024 one is. Calling
one of them "active" on a map of surveillance invites exactly the reading the
project refuses everywhere else - see the dropped prediction feature above, and
"Nothing here is estimated" in the `points.js` header.

Nothing was deleted, and the recency did not go anywhere. `last` still carries
the year of the most recent recorded deployment and `deployments` still carries
the count, so a popup still reads "LFR van site · legacy · last seen 2025", the
glow is still weighed by how often a spot was used, and **Most used** still
sorts by it. What changed is that the map no longer opens by asserting a van is
anywhere.

Two things will quietly undo it:

- **The original `build_points.py`**, if it ever turns up. It computed the
  split, and a re-run of it would set 97 van sites back to active. The script
  now in `tools/` is not it and does not compute a status for anything: it
  writes what `data/cameras.csv` says, treats a blank status on a `vancam` as
  legacy, and refuses to build a record in which any van site is active. Do
  not replace it with the old one.
- **A re-run of `seed.sql` against a database seeded before this change** is
  what applies it, not what breaks it - `status` is in the `on conflict do
  update` list, so the 97 rows are rewritten in place. Do run it.

Cameras that came from user reports have no `seed_key` and are not touched by
the seed, so a reported van site stays whatever the moderator approved it as.
To bring those into line too:

    update cameras set status = 'legacy' where type = 'vancam' and status = 'active';

### The build script and the record

The record is `data/cameras.csv`: one header row, one camera per line.
`tools/build_points.py` writes `data/points.js` and `backend/seed.sql` from
it, and nothing else does. The two outputs were kept in step by hand for a
long time - both said they were written by a script that was not in the
repository - and the invariant that they agree was documented in four
places and enforced in none. Now it is enforced in one: `stamp.py`
regenerates both from the CSV in memory on every run and fails, naming the
file and the first differing line, if what is committed is not what the CSV
produces. A hand edit to either output cannot survive a commit, and neither
can a CSV edit that was not built.

This is not a build step in the sense the project refuses. The browser runs
the committed `points.js` exactly as before; nothing has to run for the
site to be served; CI only reads. It is a generator the maintainer runs by
hand, the way `stamp.py` is a checker they run by hand.

    python3 tools/build_points.py            write both files from the CSV
    python3 tools/build_points.py --check    the same comparison stamp.py
                                             makes, on its own
    python3 tools/build_points.py --import data/points.js
                                             read a points.js back into
                                             the CSV (see below)

**The columns**, in the order they are written: `name`, `type`, `status`,
`lat`, `lon`, `approximate`, `last`, `periods`, `deployments`,
`source_label`, `source_url`, `note`. The prose is last because it is the
long one, so a line reads as the structured fields first and the note
trailing; `approximate` sits beside the position it qualifies. The
script's docstring documents each column; the ones worth knowing about
before editing:

- `status` may be left blank. A `vancam` is then legacy and anything else
  active - the same default `tidy()` in `map.js` gives a hand-typed entry.
  A `vancam` written as `active` is refused, naming the row. The script
  never computes a status from a year: see "What active means" above.
- `lat` and `lon` are read as exact decimals, at most six places, and
  written with exactly six. A spreadsheet that drops a trailing zero is
  fine; a seventh decimal is refused rather than rounded, because rounding
  it would be the script deciding where a camera is.
- `last` blank is null. `deployments` blank is one, or the sum of `periods`
  where that is given - see below.
- Row order does not matter. The outputs are written in a canonical order
  - by name, case-insensitively, then type, then position - so a row
  appended at the bottom lands in its alphabetical place in both files, and
  the same CSV always produces the same bytes. That order is what the
  published files already had; the first build reproduced them to the byte
  from the CSV before anything was changed, which is the proof that the
  script reads the record right.

**What the script will not do.** It does not look anything up, fetch
anything, or infer anything. Every value in the outputs is a value in the
CSV, a fixed default named in the docstring, or `seed_key`, which is built
from three of them. Where the CSV is wrong the build fails and names the
row; where it is incomplete the output is null or the default, never a
plausible value. "Nothing here is estimated" is the record's own promise
and a generator that filled a blank by guessing would break it quietly.

**Deployments by period.** `deployments` is a single count, and until now
it was the whole of what the record held about how often a site was used:
"8 deployments 2023-2025" could not be broken down. The obvious column,
one count per calendar year, is not one the record can fill. The Met
publishes "3 deployments 2023-2025" and not which year each fell in, and
the record's own vocabulary, read off the notes, is `2023-24`, `2025`,
`2023-2025`, `2020-2025`, `2020-24`, `2020-22` and "the 2026 station
trial". Splitting any of the spans by year would be estimating, which is
the one thing this map promises not to do. So the breakdown is **by the
period the source gives**, exactly as it gives it.

- In the CSV, `periods` is `PERIOD:COUNT` items separated by semicolons -
  `2023-24:1`, `2023-2025:3`, `2026:4`, or `2023-24:1;2025:3` once a site
  has counts from more than one record. Text, so it survives a spreadsheet.
  Blank is null: the source names no period, which is every shop, both
  fixed installs and the King's Cross estate.
- In `points.js` it is a JSON object, `periods: {"2023-24": 1}`, keys
  earliest first; in the database a `jsonb` column of the same shape. A
  key is `YYYY`, `YYYY-YY` or `YYYY-YYYY` and nothing else, and the same
  expression checks that in `build_points.py`, `check.js` and the
  `cameras_periods_check` constraint - change one, change the three.
- `deployments` stays, because the glow is weighed by it, **Most used**
  sorts by it, and a camera that came from a report has no history to
  break down. Where `periods` is given, `deployments` is its sum by
  construction: the script fills it in if blank and refuses a value that
  disagrees, `check.js` asserts it, and `cameras_periods_total_check`
  refuses the row on the server. The old integer is therefore always
  derivable from the new column, and the two cannot drift.
- The first values were read off the notes at import - "N deployment(s)
  PERIOD" for a Met van site, "N deployment(s) in the YYYY station trial"
  for a BTP one - which is reading the record's own sentence about a
  site, not guessing at it. Every note in either form agreed with its
  `deployments`; the import refuses to write a row where they do not.
  From here on it is a column, edited in the CSV like any other.
- One row is worth knowing about: **High Road, Haringey** says
  "3 deployments 2023-24" in its note and `2025` in `last`. Both are
  preserved exactly as they were; the period is `2023-24` because that is
  what the note says. One of the two is wrong and the record itself does
  not say which.

What a per-period column makes possible is a time filter that shows a
site in every year its period covers and never in one it does not, and a
popup that lists "1 in 2023-24, 3 in 2025" rather than "4". What it does
not make possible is a bar per year for a site the record only gives as a
span - and that is the point. The Met's deployment-record PDFs carry a
date per deployment, so a finer breakdown is a data-collection task for
whoever next sits down with those PDFs, not something the script can
manufacture.

Adding it to the database is `backend/migrations/001_periods.sql`, run in
the SQL editor and followed by a re-run of `seed.sql`, whose on-conflict
update fills the column on every seed row. `schema.sql` carries the same
block as version 2.3 so a fresh database ends up identical.

**Where each camera comes from.** Provenance used to live in the prose of
`note` with nothing to click: "Met Police LFR van - 3 deployments
2023-2025" says which record without saying where it is. Two columns now
carry it. `source_label` names the record or report the entry rests on;
`source_url` is where that document is. Both are null where none is known,
and null is what the map should show as nothing at all - a camera without
a source says nothing rather than something vague. Two rules hold in the
script, in `check.js` and on the server: a URL is `https` with no
whitespace, and a URL needs a label, because a link with no name is not a
citation. The `note` prose is untouched.

How the values were set, so they can be checked one by one:

- **Met van sites (163)**: label and URL derived at import from the period
  in the note, through the `MET_RECORDS` table in the script, which lists
  the Met's published deployment-record PDFs and the years each covers. A
  period inside one record gets that record's PDF and the label "Met
  Police LFR deployment record, PERIOD": `2023-24` (65 rows) the
  2023-to-2024 grid, `2025` (63) the 2025 record, `2020-22` (1) the
  2020-2022 grid. A period spanning more than one record - `2023-2025`
  (31), `2020-2025` (2), `2020-24` (1) - has no single document to point
  at, so it gets the Met's page the records are published on, under
  "Deployment records", and the label reads "records", plural. That page
  is the most specific address there is for those 34 rows; if it is ever
  judged too coarse, the honest alternative is null, not a guess at one of
  the PDFs.
- **BTP stations (9)**: "British Transport Police LFR deployment register,
  2026" and the register PDF, also derived from the note.
- **Everything else (10)** was set by hand in the CSV from the research
  survey in `london-lfr-cameras/`, per QUESTIONS.md item 8, only where the
  survey's site and the record's entry are plainly the same place. The
  label is the publication and date as the survey gives them; the URL is
  the survey's, verbatim. The two Croydon installs share the Met's own
  press release of 13 May 2026, which describes the pair ("static cameras
  at two locations, at the north and south ends of Croydon's high
  street") - the record's two rows are the two cameras the Met's March
  2025 announcement named as "North End and London Road", and the release
  is a source for each, without a claim about which is which:

      King's Cross Central              The Register, 6 September 2019
      London Road, Croydon (fixed)      Met Police press release, 13 May 2026
      North End, Croydon (fixed)        Met Police press release, 13 May 2026
      Sainsbury's Camden Town           Retail Technology Innovation Hub, 1 July 2026
      Sainsbury's Dalston               Retail Technology Innovation Hub, 1 July 2026
      Sainsbury's Ladbroke Grove        Retail Technology Innovation Hub, 1 July 2026
      Sainsbury's Whitechapel           Retail Technology Innovation Hub, 1 July 2026
      Sainsbury's Elephant and Castle   The Register, 6 February 2026
      Sainsbury's Sydenham              The Grocer, July 2026
      Sainsbury's East Dulwich          Retail Gazette, August 2026

  The survey's own dates for these stores - installed January 2026 for the
  five the record gives as "from early 2026", September 2025 for Sydenham,
  paused for East Dulwich - agree with the notes, which is the check that
  they are the same shops and not merely the same names.

None of the URLs was fetched by the programme that set them: the Met and
BTP sites refuse scripted requests, and the rest are cited as the survey
cites them. A dead link is a data correction in the CSV, one cell.

Adding the columns to the database is `backend/migrations/002_source.sql`,
after 001, then a re-run of `seed.sql`. `schema.sql` carries the same block
as version 2.4. What the popup shows for them is the next wave's; today the
data is exact and nothing on the page reads it yet.

**What is not known.** The Met's record gives some van sites as a borough
or a district rather than a street, and the pin for those sits at the
middle of the area. The note has always said so - "(pin marks the
surrounding area, not an exact spot)", 43 sites - and the map drew them
exactly like a pin on a known pole. `approximate` is that fact as a
column: `true`/`false` in the CSV (blank is false, and TRUE from a
spreadsheet is read), a boolean in `points.js`, `boolean not null default
false` in the database. It was filled once at import from the phrase, and
from here on it is a cell: a pin the maintainer knows to be approximate for
another reason is a cell to set, not a phrase to match. **Station Parade**
is the case in point - its note says "this pin is a guess", which is a
stronger admission than the phrase, and it is not flagged only because the
import read the one phrase the brief named. Setting it is one cell.

The note keeps its phrase, because the prose is preserved and a reader of
the popup should still be told. `check.js` holds the two together in one
direction: a note that carries the phrase while the field says false is a
column somebody blanked, and fails; the other direction is allowed, for
Station Parade's reason. The map must never search the note for the
phrase; the field is what it draws from. Drawing the difference - a wider,
softer dot or a ring, under the brightness rule - and the legend entry are
the next wave's, in `map.js` and `shared.js`.

Default false because a camera that came from a report is where the
reporter dropped the pin, and that is a claim about a spot. A moderator
who corrects a seed pin with **Move** can then clear the flag - a cell, not
an edit to prose - and the seed's re-run will not put it back, because a
re-run rewrites `approximate` from the record, and the record's cell is the
one that was cleared.

Adding it is `backend/migrations/003_approximate.sql`, after 001 and 002,
then a re-run of `seed.sql`. `schema.sql` carries the same block as version
2.5.

**`--import`** reads a `points.js` - the committed one, or one pasted out
of `index.html?edit` - and writes the CSV from it. It was used once, to make
the CSV from the published file, and it is kept because a hand-published
`points.js` is the one situation in which an output knows more than the
source, and the way back is to import it, read the diff git shows on the
CSV, and build. It reads the file with the same patterns `stamp.py` does and
refuses anything it cannot read rather than skipping it. A field the entry
carries is taken as it is; a field it lacks is read off the note where the
note states it outright (`periods`, above), and is null otherwise.

**`?edit` and the CSV.** `index.html?edit` still exports a `points.js`.
Pasting that over the committed file and committing it now fails
`stamp.py`, correctly: the CSV did not change, so the output should not
have. Either import it (above) or, better, have `?edit` export CSV rows in
the column order above and paste those into `data/cameras.csv` instead.
That change belongs to `map.js` and has not been made yet.

**The download.** When the site publishes the record as a download, the
file to publish is this one, served as it is. It is already the most
portable form of the record, it carries nothing that is not public, and a
file that *is* the record cannot drift from it. A second CSV derived from
the first would exist only to hide columns, and there are none to hide.

### Roles

Moderators and admins are set here, not on the site:

    update profiles set role = 'moderator' where username = 'copper.heron';
    update profiles set role = 'admin'     where username = 'copper.heron';

`admin` and `moderator` are the same on the site today; the two exist so they can differ later.

### What a moderator can change

Everything a moderator does is gated in the database - a page hiding itself
from a non-moderator is a courtesy, never the lock.

    the queue      approve or reject a pending report      moderate_report
    history        take an approval back, reconsider a
                   rejection, hide or unhide a camera      moderate_undo
    cameras        put one on the map by hand              moderate_add_camera
    cameras        correct where one is                    moderate_move_camera
    cameras        correct its name, note, kind or state   moderate_edit_camera

**Move** is the newest of those and the one worth explaining. A pin in the
wrong place is the commonest thing wrong with a camera that is otherwise right:
the Met's record gives a van site as a borough rather than a street, and a
reporter drops the pin where they were standing rather than on the pole
opposite. Everything else about a camera could already be corrected; its
position could not. The Cameras tab now opens the report form's own picker
under a row - same map, same crosshair, same Satellite toggle, same pair of
coordinate boxes - and saves the new position through `moderate_move_camera`.

Two things make a correction stick, and both are easy to undo by accident:

- `move_camera` does not touch `seed_key`. The key reads
  `name|lat|lon|type` as the *published record* gave them, and it is how
  `seed.sql` finds a row it has already written. Because the seed's
  `on conflict` never writes coordinates, a re-run brings the name, note and
  state up to date and leaves the moved pin where the moderator put it.
  Rewriting the key to the new position would make the next seed run insert a
  second camera back at the old one.
- `overlayCameras()` in `frontend/map.js` takes `lat`/`lon` from the database
  row when it lays the table over a seed entry. It did not before - it copied
  the name, note and state and left the position to `points.js` - so a moved
  seed camera would have shown at its old spot on the map however the database
  read.

A moved seed camera therefore disagrees with `data/points.js`, which still
carries the published position. That is the right way round: the database is
what the map reads, and `points.js` is the fallback for when it cannot be
reached.

Moving is in `schema.sql`, so an existing project needs the file re-run in the
SQL editor before the button works. It is safe to run again, as always.

### Moderating at scale

The moderation page was built for a queue of a dozen and will be used,
if the site does what it is for, on a queue of hundreds. Every change
in this section is judged by one measure: decisions per minute.
Moderation is volunteer time, and it is the scarcest thing the project
has.

**Every list goes on past thirty.** For a long time the queue and the
history each asked the database for thirty rows and stopped -
`.limit(30)`, no `.range()` anywhere - so report thirty-one was not
hidden or collapsed but simply never fetched, and nobody noticed
because nobody had sent thirty-one reports. That is the failure that
arrives exactly when the project succeeds. Every list in `account.js`
that can grow is now a pager: `makePager()` fetches a page, appends
the rows and offers **Load more** until a page comes back short;
`loadPage()` is the request under it, `.range(offset, offset + 29)`
on whatever query the list needs. Thirty is still the page, because a
page that fits a screen is the one a moderator can act on without
scrolling back up for the button. The two are separate so a list can
fetch a page however it likes - straight from a table, or by id from
a set it sorted itself (the queue, below) - and the button, the empty
message and the "Loading…" note behave the same either way. The
**Your reports** list that the account page is due to gain should be
built on the same pager; the comment above it in `account.js` says
how. The two `.limit(5000)` calls on the cameras table are not lists
and are left alone: they are a ceiling on a fetch that is meant to
bring everything, and the moderation page holds all the cameras in
memory on purpose so that a search for "Croydon" does not cost a
round trip per letter.

**The backlog is counted.** The Moderate link in the nav reads
"Moderate (12)" on every page, and the top of the queue says how long
the oldest report has waited - which is the number that says whether
the queue is being kept up with, more than the count is. The count is
a head request (`count: "exact", head: true` on the pending reports;
no rows come back), so a moderator pays for one small answer per page
load and never for the queue itself; the oldest is one row, sorted
the other way from the queue. Both run only for a moderator, and not
only because the number means nothing to anyone else: the reports
read policy lets a person see their own reports, so the same query
from a plain account would count *theirs* and the nav would show it
as the site's. `isModerator()` in `account.js` is the guard; the
server's policy is what makes the count a moderator's. `refreshBacklog()`
runs again after every decision, after a bulk run, and after an
approval is taken back (which is a report pending again).

**Edit** is the sibling of Move, for the rest of the row: the name,
the note, the kind and the state. A typo in a name used to be
permanent - the only thing that rewrote one was the seed, which cannot
reach a camera that came from a report. `moderate_edit_camera` is the
same shape as `moderate_move_camera`: an inner `edit_camera` for the
service role, a wrapper that checks the role first, the same
inline panel under the row. It refuses a blank name and a wrong id
the way Add and Move do, leaves a bad kind or state to the table's
check constraints for the reason Move leaves the bounds to them, and
refuses one thing of its own: a van site marked active. Every van
site is legacy ("What active means", above); the build script refuses
it in the CSV and this refuses it on the row. It is not a check
constraint on the table because the live database still carries van
rows that say active from before the change (QUESTIONS.md, item 9)
and adding the constraint would fail on them; `approve_report` also
still writes a reported van as active, and the one-line update above
is still the way to bring those into line.

`seed_key` is left alone, for Move's reason - it is how the seed finds
a row it has already written - and the consequence is the opposite of
Move's, so it is said in the panel: the seed's `on conflict` rewrites
`name`, `note` and `status` from the record, so an edit to a seed
camera holds only until the next re-run of `seed.sql`. Make the
correction in `data/cameras.csv` as well, or it will be undone. (A
corrected *type* survives a re-seed, because the type is part of the
key and not in the update list - which is the same reason to fix the
CSV, or the row is orphaned from its line the day the record is next
built.)

**Who did what** is now a table. A report's decision was always
recorded on the report - `resolved_by`, `resolved_at`,
`resolution_note` - but a camera's had nowhere to go: hiding one left
a note on its approved reports if it had any, and moving, unhiding
or editing one left only `updated_at`, which says when and not who or
what. `moderation_log` (migration 004, schema version 2.6) holds one
row per thing a moderator does to a camera by hand - add, edit, move,
hide, unhide, merge - with the moderator's id, the camera, a note and
the time, and nothing more; nothing about a reporter that `reports`
does not already hold. The functions that do those things write it
through their existing `actor` parameter (`move_camera` gained one,
which is a new signature, so the migration drops the old one by name
first). The note carries what an audit needs and the row no longer
does: a move says where the pin was, an edit says which fields changed
and what they said, a hide says why. Moderators read it through RLS
(`is_moderator()`); no client role can write it, so it is a record and
not a notebook. Report decisions are deliberately not copied into it -
two records of one decision are two things to keep in step - and the
Activity tab reads both.

**Many decisions in one press.** Twenty approvals were twenty clicks
and twenty round trips. Every queue row now has a tick box - a real
checkbox in a real label, its words for a screen reader - and a bar
over the list holds *Select all on this page*, *Approve selected* and
*Reject selected*, with one note for a batch of rejections. Two rules
hold it honest. It is not a second way in: `bulkDecide()` calls
`moderate_report` once per report, through the row's own `act()`,
which is the same call the row's own buttons make - the same function,
the same role check on the server. There is deliberately no server
function that takes a list; one would be a second door to keep locked,
and the per-report function already does the clustering, the merging
and the XP that an approval means. Four requests go at a time, so
twenty take about as long as five. And it does not fail quietly: each
row reports its own outcome, a row that went through leaves the list
when the batch is in, a row that did not stays where it was with the
server's reason beside it, and the line under the buttons says how
many of each. "Select all" reaches only the rows that are loaded: a
moderator should not be able to approve what they have not seen.

### Housekeeping SQL

Old anonymous accounts and test users:

    delete from auth.users where is_anonymous = true;
    delete from auth.users where email like 'probe%@users.cammap.app';

Reports nobody acted on in a long time (they are not on the map and never will be without approval):

    delete from reports where state = 'pending' and created_at < now() - interval '180 days';

### Tuning

One row in `settings`: how many distinct people must report the same spot for it to go on the map by itself (3), within how many metres (100), how old an account must be to count (1 hour), and how many reports one account may send in ten minutes (5). Change them with `update settings set ... where id = 1;` - no deploy needed. XP per kind of report is the `xp_rules` table, likewise.

### Tuning the dark map

The dark style is drawn for a pure black page, so `frontend/map.js`
lifts its colours against ours. The `LIFT` table there gives each kind
of layer a factor and a floor. The floor is the half that matters: a
near-black colour multiplied is still near-black, and the dark end is
where a map keeps its texture. Buildings have their own entry because
they start at almost nothing and a floor alone will not rescue them.

The rule the numbers answer to: **nothing the base map draws may be
brighter than the dimmest camera dot** (perceived brightness 134, the
fixed-camera red). The map is the backdrop; the cameras are the point.
Getting that backwards once turned London into a white web with the
cameras lost in it. The brightest thing the base map draws is now 92.

Raise a floor to bring the street grid up, and check the result
against that ceiling before committing it.

The `noisy` list in the same file names layers that are removed
outright - country borders, ice shelves, Heathrow's taxiways and so
on. Add to it rather than hiding a layer with CSS: not drawing
something is cheaper than drawing it and covering it up.

### Tuning the glow

The glow is weighed by `deployments`, the number of times a source
records a spot being used. It is square-rooted first: Westminster's
twenty-two against a suburb's one is a twenty-one to one range, and
raw it would let that one place carry a sixteenth of all the heat in
London and flatten its neighbours.

Three arrays in `heatRamp()` in `frontend/map.js` control the look:

    at     where each colour stop sits on the density scale. The first
           coloured stop is deliberately late (0.42) so a camera on its
           own makes no glow at all - it has a dot, and a halo round it
           would only say the same thing twice. Lower it and lone
           cameras start to glow again.
    alpha  how opaque each stop is. The glow sits over the streets, so
           even at its hottest it lets about forty per cent through.
    lift   how far the colour is pushed as cameras pile up - toward
           white on the dark map, toward black on the light one.

Judge changes to these by looking at the map, not by reading them.

### Satellite imagery

The satellite view uses Esri's World Imagery from the open tile endpoint, with attribution, which is allowed for non-commercial use. It is not guaranteed. If it stops, the toggle stops showing imagery and nothing else breaks; the whole of it is one block at the top of `frontend/map.js`.

### The map as a tool

*(Written by the Wave 2 map agent: deep links and the hash, Near me and
what it does not do, the place search for everyone, stacked dots, and the
last-updated line.)*

### Keyboard focus and print

**The focus ring.** Everything Tab can reach shows two pixels of the
accent, two pixels clear of it, on `:focus-visible` - so a keyboard
sees it and a click does not. Before, only the text fields and Donate
said where focus was; every button, every nav link, every row of the
list and the map itself said nothing. The rule and its exceptions are
under KEYBOARD FOCUS in `frontend/style.css`. This is the arithmetic
behind the exceptions - WCAG 2.x relative luminance, the bar is 4.5:1
(`#cf6a58` is the accent):

    the surface the ring lands on                         ratio
    the page, #0d0d0d                                     5.42:1
    the page through a scanline, #151515                  5.09:1
    an input well, #141414                                5.14:1
    a pressed toggle's accent fill                        1.00:1  ring goes inside, in the page colour: 5.42:1
    the attribution bar over white at 0.86, #2f2f2f       3.73:1  bar raised to 0.94, #1c1c1c: 4.75:1
    the light map's land, #f8f4f0                         3.28:1  never landed on
    the light map's water, #aecfe2                        2.19:1  never landed on
    the dark map's brightest grey, #5c5c5c                1.86:1  never landed on
    MapLibre's default white button                       3.59:1  not a surface here; the site paints them #0d0d0d

Where the accent cannot be read the ring moves rather than changing
colour:

- **Toggles** carry it inside, three pixels in, because the segmented
  rows (Dark | Light | Satellite, A-Z | Most used, the moderation tabs)
  abut and a ring outside one would cross a pressed neighbour and
  vanish on it. A pressed toggle draws the ring in the page colour:
  the same 5.42:1 seen from the other side.
- **The zoom buttons and the popup's close button** carry it inside
  too, because they float over the map, and what the map shows under
  them changes with the view. MapLibre's own focus - a blue
  `box-shadow` and a rounded corner - is unset in the same block.
  Checking a hovered zoom button turned up that MapLibre's hover rule
  outranked ours, so the buttons had never filled on hover and their
  glyph, flipped dark to suit the fill, vanished under the pointer;
  the selector now carries `:not(:disabled)` for weight.
- **The map canvas** is focusable because MapLibre makes it so (the
  arrow keys pan, `+`/`-` zoom), and it clips to its box. The ring is
  drawn round the map's container instead, through `:has()`, on the
  page, whatever the view. A browser without `:has()` gets a ring
  inside the canvas.
- **The attribution bar** is the page colour at 0.94 now, not 0.86:
  over white land it composited to `#2f2f2f`, where the accent links
  in it, their ring, and its own dim text all failed. The map still
  shows through, less.
- **The compact attribution control** - the round "i" on a map under
  640px, which is the report form's picker and Move's - is a
  `<summary>` in MapLibre 5, not a button. `summary` is in the rule
  for that reason. It is round because MapLibre draws it round and the
  site has never squared it, so the ring is round with it.
- **`select`** takes the accent border on focus like a text field.
  **File inputs** get the ring, and so will a checkbox, radio or range
  when one is added: the FORMS rule that colours a field's border on
  focus also says `outline: none`, for every input, and a control with
  no border to colour went dark.

How it was checked: a Tab walk of the map page in all three views,
the report form, and the moderation page with Move open, at 1400px
and 390px, in headless Chrome over the DevTools protocol with real Tab
keystrokes. Worth knowing before believing the ring is missing: a
script's `.focus()` does not trigger `:focus-visible` in Chrome until
the document has seen a keyboard event, so a console `focus()` on a
freshly loaded page shows nothing, and that is not a bug.

**Printing the map page.** Paper gets the list, not the picture. Before,
it got the dark page as it stood: a dark rectangle where the map is - a
WebGL canvas that was never asked to keep its drawing prints as nothing
- and the list cut off at the bottom of the box it scrolls in. Now it
is one column, black on white, every camera with its name, its note,
its coordinates at the size of the name, and the kind and state in
words at the right of the row - "LFR van site · legacy · last seen
2024" - so a black-and-white printer loses nothing the swatch's colour
carried. No row is split across a page.

What the list is a list *of* prints with it, because "17 of 187" on
its own does not say why: the count, the legend with any kind that is
switched off struck through, a line saying whether the legacy van sites
are included, the order in force, and the search term if there is one.
That is the filter state, and it needs no help from JavaScript: the
list is rendered from the same state as the dots, so the print view
only keeps what is already on the page and says it plainly.

Dropped: the map, and its attribution with it, since that credits tiles
that are not on the page; the view buttons and the sort button not in
force; the search box while it is empty; the nav; Donate; the star and
remove buttons on rows; the editing boxes, even in edit mode.

The palette flips once, in `:root` under `@media print` at the end of
`frontend/style.css`, and every rule that names a variable follows. The
accent goes to black, because at 3.6:1 on white it cannot carry text
and there is nothing on paper for a link colour to mean. That one flip
is why the other pages print as readable prose without a rule each.
The rest is the PAPER block, which is the whole of it.

To try it: print preview on the map page, with any filter set. A
borough search with Legacy on is what it was built for. It was checked
with Chrome's `Page.printToPDF` over the DevTools protocol at A4, and
the page breaks read back with pypdf: every page starts on a name and
ends on a coordinates line.

Two things the print view would be better with, and both need markup
or JavaScript rather than a stylesheet: a text label of the kind in
each row - it is read back off the swatch's `title` with `attr()` now,
which works but is a stylesheet reaching for data the row should carry,
and a screen reader would want the same words (MAP-9); and a line
saying when the record was last checked, which is REACH-5's count line
and will print with the list once it exists.

## Anonymity

What the site keeps about a person: a username of two random words, a password hash, the reports they sent, and their XP. No email, no name, no IP address in any of our tables.

Two honest limits. Supabase's own auth logs record request IPs for a period the project cannot turn off - that is theirs, not ours, and it should not be claimed otherwise. And a photo of a camera is a photo of a street; the site strips the location and camera data out of photos before upload, but the picture itself is still the picture. Videos are sent as they are, and the page says so.

## Forrest404

- Leaderboard
- Superbase (server setup)
- Accounts functionality
etc

## Laki2128

- Fix and build UI
etc

https://www.instagram.com/reels/DatEAylKkdA/
https://www.jaredkrauss.art/a-london-history-of-facial-recognition-systems - the LFR map
jared_krauss

https://www.gov.uk/government/consultations/legal-framework-for-using-facial-recognition-in-law-enforcement/consultation-on-a-new-legal-framework-for-law-enforcement-use-of-biometrics-facial-recognition-and-similar-technologies-accessible
https://gdprcourse.co.uk/blog/cctv-and-surveillance-statistics-uk
https://www.met.police.uk/foi-ai/metropolitan-police/disclosure-2024/april-2024/locations-facial-recognition-cameras-arrests-london-boroughs-2021-2023/
https://www.btp.police.uk/SysSiteAssets/media/images/british-transport-police/live-facial-recognition/lfr-deployment-register.pdf
https://www.btp.police.uk/news/btp/news/england/btp-expands-live-facial-recognition-lfr-trial-into-london-underground-stations/
https://tfl.gov.uk/info-for/media/press-releases/2026/august/british-transport-police-trialling-live-facial-recognition-at-transport-for-london-stations
https://www.bbc.co.uk/news/articles/c07r0gvgjxyo
https://bigbrotherwatch.org.uk/campaigns/stop-facial-recognition/
https://www.instagram.com/jared_krauss/reels/
https://surfshark.com/facial-recognition-map
https://www.btp.police.uk/police-forces/british-transport-police/areas/about-us/about-us/facial-recognition-technology/?ref=ed_direct
https://www.google.com/search?q=is+there+a+project+mapping+out+all+london+facial+recognition+camera&client=firefox-b-d&hs=96DB&sxsrf=APpeQnsGjz1cBU2pBPccTpziHPlJMXNubw%3A1788370446786&vsint=&aep=1&ntc=1&cs=1&dpr=1.33&atvm=2&mstk=AUtExfAKoTorR-OWR0S-9UlIn5PwCIawdaxqFnYGBmQ-neUkdTBABiLUCakauTopSQ_O33OAc5cDAL7kh_3IjwfrAoSV396qpc3cyqK2bfy4-026BPh2NBaq43aaiRQ1YCDsRtN7gloDvm8GKcPpPntE1jBG4NnpiZsSiDKyTDRkyf0_1KBIrUhAZI5JPskEaXiydnAMbNCk9-7j5nGcqeGjfISuHWVy1j8XIw2od1YFxaaRbO4oqq7FidClMQ&csuir=1&udm=50

## NAME IDEAS
- LFR Watch
- Watch Face
- Cam Watch
- No Match 
- 