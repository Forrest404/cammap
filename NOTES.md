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

### The words

*(Written by the Wave 4 words agent: what About draws from these notes,
the rights page and its citations, post anchors and dates, and the feed.)*

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
    cameras        merge two rows that are one camera      moderate_merge_cameras

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

### The reporting loop

The picker with its crosshair, the context dots and the upload that
strips a photograph were all well judged. What surrounded them was
not: a wall in front and a void behind. In front, an account was
required before a person could so much as look at the form. Behind,
a report went into a queue and nothing was ever heard of it again -
no number, no list, no word of what a moderator decided. This section
is the two ends of that loop closed, and the reasoning at each step.

**The form is everyone's; the account is asked for at the end.** The
report page used to show one sentence to anyone signed out - "You
need an account to send a report in" - and hide the map, the
crosshair and the photo picker behind it. That order lost the people
the form exists for. Most people who have just seen a van will never
make an account first: they do not yet know what is being asked, or
that it is only two words and a password, and by the time the account
page had explained it they had gone. So the whole form is shown to
anyone, signed in or not, and the account is asked for at the one
moment it is needed: when *Send for review* is pressed. The account
page's own two boxes - *Make an account*, with the generated
username, the passphrase button, the recovery card and its tick; and
*Sign back in* - are written out on the report page with the same
ids, under the form, and `setUpAccountForms()` in `account.js` wires
them once for both pages, with a hook for what each page does next.
On the account page that is "show the signed-in half". On the report
page it is "send the report that was waiting". The card is offered
after sign-up exactly as it is there, in a box under the form, and
it prints alone by the same `body.printing-card` rules - checked on
the report page with `Page.printToPDF` - because the rules were
written against `.sheet` and `#recovery`, not against the account
page. The nav offers *Report a camera* signed out as well now, for
the same reason the form does.

What Send does when nobody is signed in: it validates the form as it
would for a send, prepares the photograph as it would for a send,
reads every value off the form once, and keeps the function that
would have sent them in `pendingSend`. Then it shows the two boxes
and moves focus to them. The moment an account exists - made or
signed into - `accountArrived()` calls that function, and the report
goes exactly as it stood, with nothing retyped. That path is whole
on its own; nothing about it depends on storage. The draft is also
written to `sessionStorage` - the pin, the kind, the name and the
note - so that a reload in the middle of signing up (a phone that
reloads a tab it put in the background, a mis-tap on the address
bar) does not lose them; on the next load the form is filled back in
and a line says so. Session storage rather than local, because a
draft is for this visit and a report half-written on a shared
machine should not greet the next person to open the page. A photo
cannot survive a reload - a blob is not something storage holds at
that size, and a file input cannot be refilled by script - so the
line says the photo needs choosing again. Storage may be refused
outright; every touch of it is wrapped, and refused, the in-memory
path is all there is and it is enough. The key is a constant in
`account.js` until it is moved beside the others in `STORAGE`.

The lock did not move. The reports insert policy needs
`auth.uid() = user_id`, so nothing on the page could ever send a
report from nobody however the form was arranged; hiding the form
was only a courtesy withheld, and showing it is the courtesy given.
Signing out on the report page no longer sends the person to the
map: the form is theirs whether or not they are signed in, and what
is in it stays.

**Reporting from the map.** The popup on a camera offered "Report
its state"; a gap on the map offered nothing, and a gap is exactly
where a camera the map does not have would be. A right-click on the
map, or a long press on a phone, now opens a small popup at that
spot with one row, *Report a camera here*, which opens the report
form with the pin already placed - `report.html?lat=&lon=`, six
decimals, the precision the map writes everywhere else. The
right-click is MapLibre's own `contextmenu` map event: the library
already keeps the browser's menu off the canvas (its mouse handlers
call `preventDefault` there so a right-drag can rotate the map) and
fires the map event on mouseup only if the mouse did not drag in
between, so a right-drag is a rotate and never a report, and
nothing on the page touches `contextmenu` anywhere but the canvas -
the browser's menu on a link or a paragraph is what it always was.
The long press is timed in `map.js`, because iOS Safari fires no
`contextmenu` for a touch: one finger down for 600 ms within eight
pixels is a press, and a finger that drifts further is a pan, so a
press that turns into a drag is a pan and nothing else. Android
Chrome fires `contextmenu` for a long press on its own account, a
little before the timer; `offerReportAt()` will not open a second
popup for the same spot within a second, so one press is one popup
whichever way it arrived. After a press the `touchend` is
`preventDefault`-ed so the browser does not make a click of it,
because a MapLibre popup closes on a map click and the one just
opened would close under the finger that opened it. Checked over
the DevTools protocol: a right-click on the canvas opens the popup
and its `defaultPrevented` is true; a synthetic right-click on a nav
link is not prevented; a 600 ms touch with no movement opens the
popup; a touch that moves 30 px and lifts opens nothing.

**The duplicate check, and what it does not say.** The database
refuses a person's second pending new-camera report in the same
0.0001° cell, and a camera approves itself once enough *different*
people have reported it within the auto-approve radius; the
reporter learned neither until Send, after the typing and the
photograph. Now, as the pin lands - the picker's move event,
settled for half a second so a drag across the map is one question
and not sixty - the form asks `pending_near(lat, lon)` (migration
009, schema version 2.11) whether a new-camera report is waiting
within the radius and how many days ago the newest was sent, and
says so under the map: "Someone reported this corner two days ago
and it is waiting to be checked. Adding yours helps it through: 3
people reporting the same kind of camera here puts it on the map
without a moderator." The threshold is quoted from `settings`,
which is public, rather than written as "enough". The sentence sits
in a live region so a screen reader hears it arrive.

Why a function: the reports read policy shows a person their own
rows and a moderator everyone's, and that is right - it is what
keeps who-reported-what from anyone else. A plain select from the
form could therefore never see another person's pending report,
which is exactly the one the question is about; the function is a
`security definer` window through the policy that answers two
fields. What a stranger learns by calling it repeatedly: whether a
new-camera report is waiting within about a hundred metres of any
point in London, and how many days ago the newest was sent. Not
who, not how many, not its kind, note or exact position. That is
the same thing the map would show at that spot once the report is
approved, minus the position, and it says nothing about any
account - which is why it is acceptable, and why it is granted to
`anon` as well, since the signed-out visitor is filling the form
now. What is withheld and why: the count, because the sentence has
no use for it and a count is a finer instrument than a flag -
watched over time it would say when each report arrived, one by
one; and the exact time, rounded to whole days for the same reason.
Coordinates in, two fields out, no identity anywhere: that is the
line CLAUDE.md draws for every call the browser may make. The kind
is not taken either - a per-kind probe would be finer for nothing
the sentence needs - so the sentence says "the same kind of camera"
and leaves the kind to the person. The column is `found`, not
`exists`, because `exists` is a keyword that would need quoting
wherever it is read. Where the migration has not been run, or the
network is gone, the line stays empty, which is what the page
showed before there was a line.

The refusal that still happens - a person's own earlier pending
report in the same cell - is reworded from "You have already
reported this one" to "You already have a report waiting at this
spot", and told apart from the one-state-report-per-camera refusal
by the index named in the error. Proved on a throwaway PostgreSQL:
anon and a signed-in user get `(true, 2)` beside another person's
two-day-old report and `(false, null)` elsewhere and outside London;
anon's plain select on reports is refused; a user's second pending
report in a cell raises on `reports_one_new_per_cell_idx` while
another person's at the same spot is accepted.

**Three photos.** One file per report was the rule, and a moderator
deciding whether a pole on a street corner is a camera often needs
two pictures: a close one that shows the thing and a wide one that
shows where it is. `report_proof` was always a separate table with
a `report_id`, so the schema expected more; the form now takes up
to three, on both the new-camera and the state form. Each is
prepared the moment it is chosen - re-saved through the canvas,
which is what strips the position and the device out of it - and
shown as a thumbnail with a real remove button that names the
photo it removes. Chosen time rather than Send time, for three
reasons: the person sees what they are about to send; a file that
cannot be sent is refused beside the picker rather than after
everything else; and what the form holds is the re-saved copy and
never the original - the file input is emptied after each choice,
so the bytes with the location in them are not sitting in the form.
The 20 MB cap is per file, because it is the bucket's per-object
limit and the `report_proof.bytes` check is per row, and the hint
says "each"; it is checked on the original, before re-saving,
because a phone photo that large is not a photo but a mistake.
Sending is one file at a time, in order, each its own upload and
its own `report_proof` row. If the second of three fails, the
report is in and the first is attached, and neither is undone: the
report is the person's own and still pending, so the insert policy
admits the rest whenever they are sent, and the form offers *Try
the photos again* for exactly the ones that did not go, without
choosing them again. A partial failure is a report with fewer
pictures than meant, said plainly - never a report lost. Checked
with the fake client: a forced failure on the second upload left
one proof row and a retry sent only the second; the re-saved JPEG
read back byte by byte carried no `Exif` segment, no make and no
model where the original had all three.

**Why video is refused.** The form took MP4 and WebM and sent them
as they were, with a hint asking the person to "check what yours
contains". On a site whose whole promise is anonymity that was a
promise handed to the reporter to keep for us, and handed to the
one person who can least afford to leak a position: someone
standing in front of a van, filming it. A video file carries what a
photo does - a GPS track, the device that made it, the time - in a
container the browser cannot rebuild the way it re-saves a photo
through a canvas; there is no canvas for a video, and stripping an
MP4's atoms in plain JavaScript would take a library the
Content-Security-Policy will not load. The two honest choices were
to refuse video or to warn far more loudly at the moment of
choosing the file; the maintainer took the first (QUESTIONS.md,
item 1), and this is it. A video is refused the moment it is
chosen, by type or by extension, with the reason in full - "a video
file carries its location and the device that made it, and this
site cannot strip that in your browser; a photo is re-saved here
first, which removes it" - and the `accept` on both file pickers
names the three photo types. The server refuses it too, whatever a
form does: migration 010 (schema version 2.12) narrows the check on
`report_proof.mime` and the proof bucket's `allowed_mime_types` to
the three types. Nothing is deleted: a video row that exists stays,
with its file, because taking a person's evidence away when the
rule changed is not the schema's to do; the check is added `not
valid` and validated only where no video row exists, so a clean
database ends up identical to a fresh one and one with old video
rows keeps them, still refusing new ones, until the maintainer
decides. The moderation queue's "video →" link stays for exactly
those rows. What the Anonymity section above used to say about
video is gone with it.

**Your reports.** The other end of the loop. A report went into a
queue and nothing was ever heard of it again: the account page
listed saved cameras and an XP number and never what a person had
sent or what became of it, though the reports read policy admitted
a person's own rows all along and the columns a decision writes -
`state`, `resolved_at`, `resolution_note` - were there to be read.
People who send evidence somewhere want to know it arrived and what
was done with it, and this was the cheapest retention work the site
had. The account page now has *Your reports* under *Saved cameras*:
a pager, like every list that can grow (Wave 2's `makePager()`, for
the reason in "Moderating at scale"), newest first, thirty a page
with *Load more*, and the `.eq` on `user_id` the policy's comment
asks for - without it a moderator's own page would read the whole
table. Each row is the report as it stands: what it was about (the
kind and the name, or the camera and the claim), the day it was
sent, its state in the reporter's words - waiting to be checked,
accepted and on the map, not accepted, merged into a camera already
there - the day it was decided, the moderator's note when one was
left, and a link to the map for an accepted one. A state report
about a camera since taken off the map says "camera #id", because
the cameras read policy returns nothing for a hidden row and that
number is what is known. `#report-<id>` in the address - the
receipt's link - lights that row, scrolls to it and gives it focus,
loading pages on until it is found or ten pages are in; a link to
one older than that says so rather than loading for ever. While in
`savedState()`: the saved-camera lines "Since marked non-functional"
and "Since marked no longer in use" now read "The map now shows this
as …", because from the browser it cannot be known whether the shop
was already paused on the day the star was pressed - the saved row
is a copy of name, kind and position, deliberately not of state -
and the line should say only what is known.

**The receipt.** "Sent for review. Thank you." and the form
clearing was all a person got for a report: no number, no link,
nothing to come back with. Now, the moment the insert returns, the
form shows the report's number - the database's own id, so it is
known at once and survives anything - in a box that copies it, with
a link to `account.html#report-<id>`, which *Your reports* finds and
lights. The receipt is shown before the photos are attached and
whatever happens to them, because nothing that happens to a photo
changes the number. The last number sent is kept in
`sessionStorage` (`cammap.report-receipt`, a constant in
`account.js` until it joins `STORAGE`), so a reload of the report
page shows "Your last report this session is #1234" rather than a
blank form; session storage for the draft's reason, that a number
left on a shared machine would tell the next person which report
was sent from it; refused, the receipt is shown once. Copying is
`map.js`'s Copy-link pattern - the clipboard API, then `execCommand`
on the selected box, then the box left selected with a sentence
saying which key finishes it - because the clipboard API is refused
on a page opened off the disk and on plain http. The own-duplicate
refusal now ends "It is listed under Your reports on your account
page", since there is such a list.

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

**The queue can be sorted and filtered, and the sort sees all of
it.** Newest first, everything mixed, was the only order there was.
The order a moderator wants is *the likely duplicates first*: a report
dropped on top of a camera the map already has is the quickest
decision on the page and the commonest. So the queue is now two
fetches. The first is an index - every pending report's small columns
(id, kind, type, position, time) in one request, under the same 5,000
ceiling the cameras fetch uses and for the same reason: those rows
are a few dozen bytes each, five thousand of them are smaller than one
proof photograph, and a queue that long is a problem the page will
have earned. The index is measured, filtered and sorted in the
browser, and the pager fetches each page's full rows - note, reporter,
proof - by id from the order it settled on. Sorting thirty loaded rows
and then loading thirty more that are nearer would be worse than no
sort, which is why the whole set is sorted and not the page.

Filter by what a report is (a new camera, a state report) and by kind
(from `CAMERA_TYPES`; a state report's kind is its camera's, which is
why the cameras are loaded first). Sort newest, oldest, or nearest to
a camera on the map; nearest puts state reports last, since they sit
on the camera they are about and the distance says nothing. Every
new-camera row shows its nearest camera and the distance whatever the
order, so a report 15 m from a camera of the same kind announces
itself.

The distance is `metresBetween()` in `account.js`, the twin of
`metres_between` in `schema.sql` - same formula, same radius, written
once in each. It is computed in the browser and not by a new server
function on purpose. An endpoint answering "how far is this report
from the nearest camera" would say nothing about accounts and so would
pass the anonymity test; but it would be a new surface, with a grant
to get right and a policy to keep in step, for a number the browser
already has both halves of. Paging by id also closes a gap offset
paging had: a *Load more* pressed after rows have left the page - in a
batch, say - does not skip the rows that shifted up to fill the gap,
and an id decided since the index was taken comes back empty rather
than as a decided row with live buttons.

**Activity: who did what.** A fourth tab. The upper list is every
decided report read the other way round from the history tab - by the
moderator who decided it: who, when, what they said, and what it was
about, through a second join on `profiles` told apart from the
reporter's by its foreign key (`profiles!reports_resolved_by_fkey`).
A report that approved itself, because enough people agreed, says so
in as many words: it is the one kind of approval nobody made, and an
audit should be able to tell. The lower list is `moderation_log`: every
change made to a camera by hand, with the moderator, the time, and the
note that keeps what the row no longer has. Two lists rather than one
stream because they are two tables with two clocks, and a single
stream in time order would need both fetched whole to page honestly;
each is a pager of its own. Moderators only, and the server says so -
the reports, profiles and log policies all ask `is_moderator()`; the
tab hiding itself is the courtesy. Until migration 004 is run the
lower list says which migration to run, and the upper list is
unaffected.

**Merge** is for two rows that are one camera. `approve_report`
clusters and merges *incoming* reports, so two people reporting one
van site make one camera; two rows already on the map - a seed entry
and a reported one at the same spot, two reports approved a month
apart at 150 m - had no way to become one, and hiding one lost its
reports to a hidden row nobody would look at again.
`moderate_merge_cameras(loser, survivor)` (migration 006, schema
version 2.8) repoints the loser's reports at the survivor, hides the
loser through the existing `hide_camera` with a note naming the
survivor, logs it, and returns which row survived and how many reports
moved. Nothing is deleted: the loser is still in the table, off the
map. It refuses the same id twice, a missing id, a loser that is
already hidden (its reports belong to whatever took it off - a merge
already done, a "removed" claim approved - and moving them now could
put them under a camera they were never about; put it back first if
it really is a duplicate) and a survivor that is hidden (two cameras
lost for one). One report may stay behind: a state report by someone
who has also reported the survivor's state, because
`reports_one_status_per_camera_idx` allows one per person per camera
and it is still their evidence about the loser; the result counts
those as *kept*. `saved_cameras` holds no camera id by design, so
nothing there is touched, and the survivor's own `deployments`,
`periods` and source are left as the record gave them - a sum of two
records of one site would be a count the source never gave. It takes
the same two advisory locks `approve_report` does, so an approval
racing it cannot point a fresh report at a camera that is about to
go.

The panel opens under the row that will go. It asks for the survivor
by name, offering the nearest cameras first because the nearest is
the likeliest duplicate, and before anything is sent it says in one
sentence which row survives, which is hidden, and how many reports
move, and waits for a press on a button that says the same. A merge
is the one action here without an undo button - the loser can be put
back on the map, but its reports have moved - so the statement is the
confirmation.

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

The drawing was the strongest thing in the project. What it lacked was
the handful of controls that turn a picture into a tool: a way to say
"here is the camera outside my station" as a link, a way to ask "is
there one near me", a way to find a place without knowing where it is
on a dark map, and an honest count where two cameras sit on one spot.
All of it is in `frontend/map.js`, each under its own heading, and
each block there says why it is the way it is; this is the shorter
account, and the reasoning that did not fit in a comment.

**Deep links and the hash (MAP-1).** The address bar follows the map
in the form OpenStreetMap uses, `#14/51.5169/-0.0977` - zoom, latitude,
longitude - and carries `&camera=<id>` after it while a popup is open,
so copying the address bar and opening it elsewhere gives back the
view and the popup both. `#camera=<id>` on its own opens the camera
close in. The old `#51.51234,-0.12345` form is kept exactly as it was,
zoom 17 at the spot: the moderation queue writes it (`cameraMapHref()`
in `account.js`), and it costs nothing to keep. A hash changed by hand
while the page is open is followed too.

Written with `replaceState`, never `pushState`: every pan as a history
entry would turn the back button into a tour of everywhere you had
been. Held to one write a quarter of a second, taken at the end of the
interval, so a drag writes where it got to. A page opened plain keeps a
plain address until the map moves; the URL only ever carries a view
the visitor made or asked for.

Which id a camera carries is the decision worth recording. A camera
the database has given an id links by that: it is the same for every
visitor and survives a rename or a Move. A camera the database has not
- the seed, when the database is unreachable or not configured, or
before it has answered - links by its `seed_key`, URL-encoded, which is
its identity in the published record and what the row carries too.
Either resolves on load: a number against `cameraId`, anything else
against `seedKey`, which `tidy()` fixes on every point when it is read
from `points.js` (that also makes the overlay's match stable after a
Move, which `overlayCameras()` used to work out from a position it
was about to overwrite). A numeric id cannot be answered until the
database has spoken, so it waits for the overlay and is answered then;
where the database does not answer, or the camera is gone, the line
under the map says so rather than showing central London in silence.
The trade-off is known: a seed-key link works for anyone in any state
and is long; a numeric link is short and needs the database. Flipping
the preference is one line in `cameraLinkId()`.

A link is allowed to switch Legacy on, or a kind the legend has
switched off, for the visit and without saving it - a link to a camera
that then does not appear is a broken link, and the link asked, not
the visitor.

"Copy link" in the popup is an anchor whose `href` is the link itself,
so a right-click and "copy link address" works before any script does.
A click copies it by the clipboard API, then `execCommand`, then a
selected box with the address in it - none of the three is everywhere:
the API is refused off the disk and on plain http, `execCommand` is
deprecated, and a selected box needs only Ctrl-C. A popup opened by a
link or a list row now lands its dot three tenths of the map's height
below the middle, through `popupRoom()`, because on a phone the map is
462 pixels tall and MapLibre hangs a popup taller than the room above
its dot below the dot instead, where the map's edge cut it off. Note
for whoever makes movement a cut rather than a flight: `jumpTo`
ignores `offset`, silently; `easeTo` with a duration of 0 is the cut
that honours it, and `showCameraLink()` uses that.

**Near me, and what it does not do (MAP-2).** Pressed, never automatic
- the line the TODO above drew before this was built, and a privacy
position rather than a preference. The browser is asked for a location
only when the button under the map is pressed. The answer lives in one
variable for the visit and is written nowhere: not to storage, not to
the database, not to the hash on its own account. The one honest
caveat is that the hash follows the map, and after Near me the map is
looking at where you are, as it would be after you panned there;
copying the address bar then is copying a view of your street, which
is the visitor's act and not the site's.

A press centres the map, closer or wider by how good the fix is
(`zoomForAccuracy()`), draws where you are as a ring with a dot in it
and the browser's stated accuracy as a larger ring round that, and
sorts the list by distance with the distance on every row, whatever
the order - "130 m", "1.6 km", rounded to what a phone can know. A
Nearest sort button appears while a fix is held; a second press clears
everything and puts the list back in the order it was in, and the
order remembered between visits is never "near". The request asks for
a rough fix (`enableHighAccuracy: false`), waits ten seconds, and
accepts a fix up to three minutes old: a rough fix says which street,
arrives sooner and costs a phone less.

The rings answer to the brightness rule. They are `#5c5c5c`, the dark
map's own brightest grey, and measured with every other layer hidden
the brightest pixel they put on the dark view is 89 against the rule's
134. Over imagery that grey vanished, and the rule allows nothing
brighter, so the answer was darker: a casing in the page black under
the ring and the marker, shown on the satellite view only - on the
dark map it would be black on black, on the light map it would turn a
quiet grey ring into a heavy one. The marker is a ring with a dot in
it because a plain grey dot is what a private camera looks like and a
hollow ring is what a legacy site looks like. The fill inside the
accuracy ring is all but transparent: the ring says how far the
browser might be wrong, and a filled disc would say "here" with a
confidence the browser did not offer.

Every failure leaves the map as usable as before and says why, in the
line under the map: refused ("that is fine, the map works without
it"), no fix in ten seconds, could not be worked out. Without
geolocation at all, or off https - browsers refuse to ask on a plain
http page - the button is shown disabled with the reason in its title
and its accessible name. A fix outside London is said to be, and the
distances are shown all the same: "the nearest is 66 km away" is an
answer. The button is not disabled while a request is out, because
disabling a focused button drops the keyboard on the floor; a second
press is ignored until the browser answers.

**The place search, for everyone (MAP-3).** The Nominatim box was
edit-only for no better reason than that it was built for adding
cameras, while the policy already allowed the host on every page. It
now sits under the map - it moves the map, and the list's own search
finds a camera by name; two "find" boxes in one column would ask to be
confused - and is set up for everyone in its own section of `map.js`.
Edit mode keeps its extra: a picked result fills the coordinate boxes.

Nominatim's usage policy asks for one request a second at most, an
identifying header, and no autocomplete. A browser will not let a page
set the header, but it sends the site's address as the referer, which
identifies the caller. The rest is honoured by being a light caller: a
search happens on Enter or the button and never as you type - there is
no search-as-you-type and there must not be; requests are held a
second apart with a press inside that second queued; the same words
asked twice are answered from the last reply; five results at most;
bounded to London by the request and checked against `inLondon()` on
the way back. Nothing found says so in words. The zoom is worked out
from the result's bounding box, so "Croydon" shows Croydon and "Croydon
Road" shows the road - through `moveMap()`, not `fitBounds()`, so that
how the map moves stays decided in one place. The hint under the field
says where the words go, because the site says what it does. The box
is hidden in the markup until `map.js` lifts it, so a page without
JavaScript shows no search that does nothing; paper drops it.

**Movement, in one place.** Every deliberate move the page makes - a
list row, a search result, Near me, the reset in edit mode - goes
through `moveMap(lat, lon, zoom, below)`. It flies, unless the visitor has
asked for less motion - see "Reading the map without a mouse, or without
sight" below, which is where that choice is made. When the page
comes to honour `prefers-reduced-motion` that is the one function to
change, and the note above about `jumpTo` and `offset` is the one
thing to know before changing it. The hash on load is a `jumpTo` on
purpose: there is nowhere to fly from.

**Stacked cameras (MAP-5).** Two cameras on one corner drew as one dot
and `DRAW_ORDER` chose which, so the map under-reported exactly where
it mattered most. North End, Croydon is a fixed install and, at the
same coordinates, the van hotspot with the most deployments in the
record - twenty-one - and the map showed one red dot. London Road,
Croydon is the same pair. Nothing here is estimated, but a count of
one where the record says two is a claim as well.

Two things fix it, and both are needed. A count beside any dot with
others under it - a symbol layer over the dots, from zoom 13 where the
dots stop pooling into the glow and start to be read one by one, in
"Noto Sans Regular" because that is the font both OpenFreeMap styles
set their labels in and a symbol layer in a font the style does not
serve draws nothing. It is `#7f7f7f`, 127 against the rule's 134, on
a halo in the page black; on the light map it is the dark ring colour
the dots wear there. And a chooser on click: a click that lands on more
than one camera - the map is asked what is drawn within six pixels of
the click - opens a small list, swatch, name and kind, and the one
chosen opens as usual. Its buttons are buttons, the first takes focus,
Escape closes it and hands focus back to the map. The keyboard's own
way to any camera is still the list, where a stacked pair is two rows.

"Stacked" is within fifteen metres, the width of a road, counted by a
sorted sweep over the shown points - a few hundred distance sums, no
clustering library, done again whenever the shown set changes. It takes
the two Croydon pairs and Coventry Street with Piccadilly Circus,
eleven metres apart, and leaves Tooting with Tooting Broadway,
twenty-four metres apart, which separate by zoom sixteen; below that
two dots that close are one dot whatever the count says, and the
chooser is the safety net, because it asks at the zoom the click was
made. `DRAW_ORDER` stays as the tiebreak for which paints last; it was
never meant to be a filter. One thing to know when checking this
against the live site: until `seed.sql` is re-run (QUESTIONS.md, item
9) the live table still carries North End's van site as active, so
with Legacy off a click there opens the chooser rather than the fixed
camera's popup - which is right for that data, and goes away with the
re-seed. Against the record, Legacy off gives one dot and one popup.

**The line under the map (REACH-5).** "182 cameras · Met records to
2025, BTP to 2026 · last checked September 2026", written by `render()`
next to the count it already keeps. The count is the published
record's, the length of `points.js`, and never a typed number, so it
cannot go stale. Cameras the database holds beyond the record - reports
moderators approved, not in the CSV - are said separately, "182 cameras
in the record, 5 more from reports", so a reader who opens the CSV to
check finds the figure they were given; edit mode counts nothing beyond
the record. The dates are `RECORD_SOURCES` in `shared.js`, beside the
bounds: three values typed by hand when the record is refreshed, and
the comment there says what each means and why the Met's year is 2025
for now. `img/share.png` carries the count as a picture and moves with
it: when the record is refreshed, update the CSV, run the build script,
change the constants, and make the card again if the count moved.

**What `?edit` exports now.** CSV rows, in the column order the build
script documents, quoted the way Python's `csv` module quotes, with
`periods` sorted by start year by hand because JavaScript puts a key
that looks like a whole number ("2025") ahead of every other key
whatever order it was written in. Export the published record
untouched, paste it over `data/cameras.csv`, run the script, and git
reports nothing changed in any of the three files - that round trip is
the check that the export writes what the script reads. The four newer
fields travel with a point from `tidy()` onward, and `overlayCameras()`
takes them from a database row only when the row has the columns
(`takeRecordFields()`); the fetch does not name them until the
migrations are applied, because PostgREST refuses a whole query for one
column it does not know.

**How it was checked.** Headless Chrome over the DevTools protocol with
real mouse and keyboard events, at 1400 and 390 wide, on all three
views; the harness's `Page.addScriptToEvaluateOnNewDocument` stubbed
`navigator.geolocation` for each of the four outcomes, since a stub
made after load is too late for a button set up at load. Two things
worth knowing before believing a result: a `flyTo` does complete in
this harness (the tab is not hidden), so `document.hidden` is the
thing to check, not the harness; and a screenshot `clip` is in page
coordinates, so a scrolled page clips somewhere else.

### Reading the map without a mouse, or without sight

`style.css` promises 4.5:1 on every colour. This is the same promise
made to people who are not using a mouse, or not using their eyes:
the map moves without sweeping for those who have asked their system
for less motion; a screen reader is told what the map is and where
the words for it are, and hears the count change; a kind can be
picked out of the legend alone from the keyboard; and the legend is
explained in prose. Each piece is under its own heading in
`frontend/map.js` and says why there; this is the shorter account,
the reasoning that did not fit in a comment, and what the
accessibility tree said when it was checked.

**Reduced motion (MAP-8).** `moveMap()` still flies - a flight across
London says where you came from as well as where you are going - but
under `prefers-reduced-motion` it cuts. The cut is `easeTo` with a
duration of 0 and not `jumpTo`, for the reason the note under "Deep
links" above gives: `jumpTo` ignores `offset`, and the popup a list
row opens needs its dot three tenths of the map below the middle or
it is cut off on a phone. The query is read once at load into
`reduceMotion` and read again on its `change` event, so flipping the
setting with the page open takes effect on the next move;
`addEventListener` is the call, with the older `addListener` kept as
the fallback because Safari before 14 knows only that name, and
without `matchMedia` at all the answer is no.

Why the page reads the query itself when MapLibre reads it too: it
does, live, and under it turns every `flyTo` into a `jumpTo` - which
is exactly the call that drops the offset. So the page's own reading
is what `moveMap()` checks before MapLibre gets the chance, and it
chooses the cut that keeps the offset. MapLibre's reading still
covers what it animates on its own account: the zoom buttons go
through `easeTo` and get a duration of 0 from it, so nothing was
needed there. ("Movement, in one place" above says it flies today;
it flies unless asked not to.) Checked with the media feature
emulated over the DevTools protocol: no preference, `flyTo` once;
emulated "reduce", the change event set the variable and the next
row click was `easeTo {duration: 0, offset: [0, 198]}` with `flyTo`
never called and the centre landing 0.0007 degrees north of the dot;
the zoom button went 17 to 18 at once; back to no preference, the
variable re-read false and the next click flew.

**What a screen reader is told (MAP-9).** The dots are drawn into a
canvas, and a canvas has nothing in it assistive technology can read.
The list beside the map was always the same cameras in words, and
nothing said so. Four things now do.

The Cameras box is a region named from its heading and a hidden
sentence after it, so a reader arriving by landmark hears "Cameras.
The map in words. Every camera the map is showing is a row here, and
a row shows its camera on the map." (`aria-labelledby` joins its
parts with a space, which is why the sentence stands on its own
rather than leading with a comma.)

Each row speaks its kind and state after the name, in a hidden span:
"Euston Station, Transport police." or ", LFR van site, legacy, last
seen 2025." Before, the row's name was the camera's name, its note
and its coordinates, and nothing said it was a van site or that it is
legacy: the swatch carried those words as its `title`, which a
pointer sees as a tooltip and paper reads back with `attr()`, and
which a title on a span with no text in it gives to no one else. The
middle dots the label uses are commas in the spoken copy, because a
synthetic voice reads "·" as "middle dot" or not at all. The swatch's
title stays, for the tooltip and for paper.

The count is read out through `#list-status`, a `role="status"` live
region in the list's head hidden from the eye (the visible count
beside the heading already says it there). It is written only from
the places a visitor narrows the list - a filter, the search box -
and never from `render()`, which also runs on load and again when the
database answers: a count read out before anyone has touched anything
is noise over the page's own title. It is held back 600 ms so that
typing "croy" is one sentence and not four, read out only when the
sentence has changed, and cleared after four seconds so a reader
browsing the head later finds the count once; a live region's
clearing is not announced. `announceCount()` is the call;
`announceThenCount(prefix)` is for a change with a word to say first,
which is what the legend's solo uses. For whoever adds a filter
next: call one of the two after `render()`, never write the element
directly, and keep the visible count's text as it is - the share
card (`tools/share-card.html`) reads "182 cameras" out of it.

The canvas keeps its place in the tab order and says what it is.
MapLibre names it "Map", a region, and gives it `tabindex="0"` so the
arrow keys pan and `+`/`-` zoom. The brief said to mark it
`aria-hidden`; the code says otherwise, and the code wins: hiding a
focusable element from assistive technology is the one arrangement
every checker flags, because a reader then lands on a thing it has
been told does not exist, and a sighted person steering by keyboard
would lose keys that work. So it is `role="application"` - the honest
role for a widget that takes the arrow keys for itself, and what tells
a screen reader to pass them through rather than read the page with
them - with the role description "map" said in its place and a label
that sends the reader to the list by its heading: "Map of London with
the recorded facial recognition cameras drawn on it. The same cameras
are listed in words under the heading Cameras, after the map. Arrow
keys pan; plus and minus zoom." Because the canvas stays focusable,
the ring the FOCUS block draws round the map's box keeps working. Set
once; the canvas outlives every style swap.

One more thing turned up on the way: `#map-note`, the line under the
map that Near me and a bad link speak through, was `display: none`
while empty, so it was not in the accessibility tree at the moment
its first sentence arrived - and a live region that appears with its
text is a new element, not a change, and is not read. It keeps its
place now at no height (ACCESSIBILITY in `style.css`). The `.sr-only`
class there is the same recipe as `.pick-text` under MODERATION,
written for the queue's tick boxes before this class existed;
whoever next edits that block should make it this.

What the tree said, over the DevTools protocol
(`Accessibility.getFullAXTree`): `region "CAMERAS The map in words.
…"`; `button "EUSTON STATION , Transport police. British Transport
Police LFR - 4 deployments in the 2026 station trial 51.5289,
-0.1342"`; `application "Map of London with …" {focusable,
roledescription=map}`; `status {live=polite, atomic=true}` reading
"22 of 187 cameras shown" after a legend key and "117 of 187 cameras
shown" after it again; 17 buttons under the list with Legacy off and
182 with it on, matching the DOM; four input events 100 ms apart
producing one announcement; and all three live regions in the tree
at load. Chrome writes names as the stylesheet transforms them, so
"CAMERAS" and "LEGACY" are what a reader is given; that is the
uppercase rule under FORMS, not a bug here.

**Solo: only this kind (MAP-6).** "Only the shops" was four clicks
and could not be undone in one. Each legend key has a small `[only]`
beside it - a second button, because a keyboard needs something it
can land on and a modifier key is invisible - named "Only <kind>"
with `aria-pressed` as its state. A press shows that kind and hides
the rest; a press on it again, or on the soloed key itself, shows
every kind. Click-to-toggle on the keys is as it was.

The solo is not a state of its own. It is the legend showing one kind
and hiding the others, read back from `hiddenTypes` by `soloType()`,
so it is remembered through the same `hidden` map `STORAGE.view` has
always saved, an older saved view loads unchanged, and the solo and
the map cannot disagree. The price is small and deliberate: hiding
four kinds one at a time arrives at the same place as pressing
`[only]` on the fifth, and the legend says so.

Every van site is legacy ("What active means"), so "only the van
sites" with Legacy off would show nothing at all, and the person
asked for the van sites. When the kinds narrow to one whose every
camera is legacy - worked out from the points, not assumed of vans,
because a database still carrying active van rows changes the answer
(QUESTIONS.md, item 9) - Legacy is switched on for them and the line
under the map says so: "Every LFR van site in the record is legacy,
so Legacy has been switched on to show them." Ending the solo
switches it back off, unless the visitor has pressed Legacy
themselves in between, which makes it theirs; and only the solo's own
sentence is taken back from the line, not whatever Near me or a link
has said there since. It is saved with the view like any other press,
which is the difference from a deep link's switch: the visitor asked,
where the link did.

A screen reader hears the pressed state on the control and, through
the status line, "Only one kind, LFR van site. 163 of 182 cameras
shown" and "Every kind. 17 of 182 cameras shown". And the legend is
built afresh after every press, which used to drop a keyboard's focus
on the floor at every key - Space on a key and the reader was back at
the top of the page. Whichever key or `[only]` had focus is noted by
its kind and given focus again once rebuilt. `[only]` is not printed;
the struck-through keys already say what is shown on paper.

**How to read this map (WORD-6).** A `details` element under the map
bar, four sentences: colour says what a camera is; a solid dot is in
use, a hollow ring is a legacy site, the non-functional colour is one
reported as not working; the glow is weighed by how often the record
has a spot used and a lone camera makes none ("Tuning the glow"); and
every van site sits behind Legacy because a van parks for a shift and
drives away ("What active means"). Nothing in it claims what the data
does not. The first sentence's list of kinds is written by `map.js`
from `CAMERA_TYPES`, so the prose cannot name a kind the key lacks or
miss one it has; the labels are lowered into the sentence where they
start with an ordinary word and left alone where they start with an
acronym. Without JavaScript the sentence still reads, without the
list.

Open in the markup, so it is open with no JavaScript; open by default
on the first visit only. `STORAGE.explained` is set when it has been
shown open once and again when it is closed, and a visit that finds it
closes the block - so a visitor who read it and moved on and one who
shut it both get one summary line next time. Where storage is refused
the key is never found and it is open on every visit, which is the
harmless way round. Opening it again on a later visit is not
remembered: it is there to be looked at, not to stay open. A
`details`/`summary` rather than a button and a box because the
browser folds it, the keyboard already knows Enter and Space on a
summary, the FOCUS block covers `summary` already, and the tree says
`DisclosureTriangle "How to read this map" {expanded}`, which is what
a reader wants to hear. Not printed: paper has no map to read, and
each printed row already says its kind in words. Two things worth
knowing when checking it: the `toggle` event is delivered after the
click returns, so a key read in the same tick as the click is not yet
set; and `NAV` in the harness keeps the profile, so a second load is
a second visit.

**A link that points outside London (the Wave 2 observation).**
`#99/0/0` used to be ignored in silence, with the address left in the
bar as if it had been honoured. `applyHash()` now says under the map
that the link points outside London and the whole map is shown,
treats the link as having asked for no view (a camera named in the
same link is still followed and centred on), and writes the view as
it stands over the address that was not - forgetting the last write
first, because a hash changed by hand while the map has not moved is
the view `writeHash()` wrote last and it would otherwise see nothing
to do.

**The footer, off paper.** The Wave 1 check found that printing the
nine Croydon rows put only the footer on a second sheet: its ASCII
rule, the donations line and the licence line. None of it is for
someone on a street with a leaflet - the appeal is for a screen, and
the licence is named on the site the paper came from and on the
record itself - so the footer now goes with the nav on paper
(ACCESSIBILITY in `style.css`, beside the other print rules of this
wave), and a borough's list is one side of A4 again. Measured with
`Page.printToPDF`: two pages before, one after.

**How it was checked.** Headless Chrome over the DevTools protocol,
at 1400 and 390, with `Accessibility.getFullAXTree` for what a reader
is given, `Emulation.setEmulatedMedia` for reduced motion,
`Network.setBlockedURLs` on the Supabase host to check against the
published record rather than the live table (QUESTIONS.md, item 9,
still shows 117 of 187 there), real Tab, Space and Enter through
`Input.dispatchKeyEvent`, `localStorage` cleared, set, and redefined
to throw, and `Page.printToPDF` at A4 for the paper.

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

What the site keeps about a person: a username of two random words, a password hash, the reports they sent, their XP, and one setting - whether they appear on the leaderboard, which is true unless they turn it off. No email, no name, no IP address in any of our tables. All of it can be deleted from the account page, in one call, by the person it is about; what cannot be taken back is a camera their report put on the map, and the page says so before it asks.

Three honest limits. Supabase's own auth logs record request IPs for a period the project cannot turn off - that is theirs, not ours, and it should not be claimed otherwise. A photo of a camera is a photo of a street; the site strips the location and camera data out of photos before upload, but the picture itself is still the picture. Video is not accepted at all, because the same data cannot be stripped from a video in the browser, and the page says why. And when an account is deleted, its proof files are made unreachable by deleting their rows in the storage table; whether Supabase clears the bytes behind them from the bucket's store at once is theirs to promise, not ours.

### Changing, leaving and recovering an account

The generated username, the absent email and the refusal to build
`username_available()` are the principled part of the accounts. What
the principle did not cover were the ordinary things an account needs
over its life: ending a session you cannot reach, changing a password
typed on a machine you did not trust, staying off a public list,
keeping the one thing that gets you back in, and leaving. Each is a
box on the account page, and each was built against one test: *an
endpoint that answers questions about accounts leaks as surely as a
column does.* Before any call below was added, the question asked was
what a stranger learns by calling it repeatedly with guesses. The
answer for every one is written beside it here and in the comment
above the function.

**Sign out everywhere.** The nav's Log out ends this browser's session
and no other; a session left open on a borrowed phone or a library
machine could not be closed from anywhere else, and on this site those
are the sessions that matter most. The box on the account page calls
Supabase's sign-out with the global scope, which revokes every refresh
token the account holds, so no session anywhere can renew itself, this
one included. The honest limit, said in the confirmation: the access
token a device already holds stays good until it runs out - the JWT
expiry in the dashboard, an hour by default - and nothing can take it
back sooner. The confirmation is a second button in the page rather
than a browser dialog, because the site uses none and a dialog cannot
carry that sentence. A failure leaves the page signed in and says so:
clearing the page while the server still held every session would say
the opposite of the truth. What a stranger learns by calling it: nothing
- it carries the caller's own token and acts on the account that token
belongs to.

**Changing the password.** There was no way to; a password typed on a
shared machine was the account's for good, and with no email there is
no reset. Supabase's `updateUser({ password })` sets a new one for any
session that holds a token, without asking for the old - which is
exactly the session left open on someone else's machine. So the box
asks for the current password and checks it first, by signing in with
it against the account's own hidden email, and only then sets the new
one. That is the existing sign-in surface, rate-limited by Supabase
like every sign-in, and nothing was added to it: no new function, no
new question the server answers. The username is the caller's own,
read off their session and never typed. The refusal says "That is not
the current password" rather than the sign-in form's "Wrong username or
password", because here the username is known and only one thing can
be wrong; success says "Password changed." and nothing else. What a
stranger learns: whatever the sign-in form already tells them, at the
sign-in form's rate - nothing more.

**Off the leaderboard.** Every contributor's username, XP and count of
approved reports were public and enumerable, a hundred at a time, to
anyone at all. The names carry nothing personal, but what someone has
reported, and how much, is a pattern, and on this site that can be
enough. `profiles.show_on_leaderboard` (migration 007, schema version
2.9) is true by default - the list is the reward the site offers - and
a tick box on the account page turns it off; the points still count.
The brief asked for the opt-out to be enforced by row-level security
rather than by the query, and it is enforced neither way: the three
leaderboards are materialized views, and PostgreSQL applies no RLS to a
materialized view - a policy on `profiles` is never consulted when the
view is refreshed, and a view cannot carry one of its own. The
equivalent that meets the intent is the view definition itself, which
is where the site's opt-out lives: `and p.show_on_leaderboard` in all
three, so an opted-out row never enters the table the page reads, and
no query a browser could write, and no future page that forgets to
filter, can show it (QUESTIONS.md, item 6). The views are rebuilt every
five minutes, and the page says so rather than promising "now". The
switch is set through `set_leaderboard_visibility(shown boolean)`, the
one thing on a profile a person may change and the only way to: the
client roles have no update privilege on `profiles` at all, and the
function writes the caller's own row by `auth.uid()`, takes no name or
id, and returns nothing. What a stranger learns by calling it: nothing.
The page reads the value on its own and not alongside the role, because
PostgREST refuses a whole select for one column it does not know, and
until the migration is run that refusal would otherwise cost a
moderator their Moderate link; the box catches it and names the
migration instead.

**What a saved camera knows.** A saved camera is a copy - name, kind,
position - taken when the star was pressed, and `saved_cameras` holds
no camera id, deliberately: an id would be a row saying "this person is
interested in this camera", on the one list that is meant to say
nothing about anyone. The copy is kept. What changed is that the list
on the account page now says what the map says about each row today:
"Since marked non-functional", "Since marked no longer in use", or "No
longer on the map at this spot". The matching is done in the browser,
by kind and position, against the cameras the browser already holds
for the map - the rows the map page keeps in storage for five minutes,
or the same whole-table read of visible cameras the report form's
picker makes - so the database gains no id, no join and no query that
carries a saved position to it. Kind as well as position because North
End in Croydon is on the map twice at one set of coordinates; not the
name, because a corrected typo is not a removal. The third line is
worded for what is known and no more: a pin a moderator has moved and
a pin taken off the map look the same from here, and saying "removed"
would be a guess. The row still links to the map at the saved position.
Where the cameras cannot be fetched, the lines are simply absent.

**The recovery card.** Sign-up showed the username and warned, in a
hint, that it was the only way back in and nothing could be reset.
True, and not enough: lockout is the predictable cost of an account
with no email, and a cost that is predictable should be designed for,
not disclosed. Two things were built, both entirely in the browser.
*Make me one* fills both password fields with a passphrase - five
words from the two lists the username is drawn from, the first
capitalised, hyphens between, a number on the end,
`Copper-heron-tidal-marsh-glen-42` - which passes the dashboard's rule
and can be read off a card and typed. How random it is: the lists
together hold 274 distinct words, so five draws are 40.5 bits and the
number adds 6.6, about 47 bits, all from `crypto.getRandomValues`
through a draw that discards the uneven top of the 32-bit range so no
word is favoured; without that source nothing is made and the person
is told to choose their own, because `Math.random` is not a source for
a password. The person may keep it or type over it. Then *the card*: a
box in the sign-up form showing the username and the password as it
stands, masked until *Show* is pressed because a card is read over a
shoulder more easily than a field, with the site's address worked out
from the page's own location rather than typed (so it is not one more
copy of the address to keep in step), a *Print this card* button, and a
real checkbox, "I have saved my username and password somewhere",
without which *Make the account* stays disabled. Print is offered only
for a password the server would accept and both fields agree on. The
same card is shown once more straight after sign-up, and after a
password change, at the top of the signed-in half with the same tick,
because after that the password is never shown again; the tick puts it
away and the password is forgotten with it, and so does a session
ending with the card still out, so a password is never left on the
screen of a machine someone has walked away from. It is one element,
`#recovery`, moved between its two homes. Printing puts
`printing-card` on `<body>` around `window.print()` and takes it off on
`afterprint`; while it is there the ACCOUNTS print rules in `style.css`
hide the sheet with `visibility` (the card is inside it, so `display`
would take the card too), give the sheet no height so the hidden page
does not run to a second sheet, and place the card alone at the top,
90mm wide, password plain - a masked card on paper is no card. Scoped
to the class, not the page, so Ctrl-P on the account page prints prose
like every other page and the Wave 1 print view of the map is not
touched. Checked with `Page.printToPDF` at A4: one page, the card and
nothing else. Nothing about the card is sent anywhere.

**Deleting the account.** There was no way out but abandonment. A site
built on collecting nothing should let a person take back the little it
holds, and be honest about what it cannot take back. The box on the
account page says both before it asks for anything, and then asks for
the username typed out; the button is disabled until it matches. One
call, `delete_my_account()` (migration 008, schema version 2.10): a
`security definer` function that takes nothing, answers nothing, and
deletes the `auth.users` row of the account whose token made the call -
the caller and nobody else. The rest is the cascade the tables already
declared: the profile, every report the person sent, the proof rows on
them, the XP awards and the saved list. The proof *files* go by their
own route, because `storage.objects` references nothing of ours: the
function deletes the rows under the caller's own prefix, which is what
makes a file unreachable through the storage API. What stays, and why:
a camera that is on the map because of that person's report stays on
the map - it is part of the record now, and deleting a person does not
un-see a camera - with `source = 'report'`, `approved_at`, `approved_by`
if a moderator did it, and its `moderation_log` rows, which is what an
audit of it needs; three columns that point at a person
(`cameras.approved_by`, `reports.resolved_by`, `moderation_log.actor`)
are set null rather than cascading, so a moderator's decisions outlive
the moderator. The reports themselves go rather than staying with the
person detached, because they are the little the site holds about a
person - what they reported, where, when, with what photograph - and
taking that back is the point of leaving; what is lost with them is the
note and the picture, which were the person's. The username is released
with the profile row, so the two words may one day be drawn again for
someone else; nothing would connect them, and a leaderboard row up to
five minutes old names an account that no longer exists. Afterwards the
browser still holds a token for an account that does not exist, so the
page signs out locally whatever the server says to that, and says one
sentence. What a stranger learns by calling it repeatedly: nothing.
Proved on a throwaway cluster: the caller's `auth.users` row, profile,
reports, proof rows and storage objects, XP and saved cameras gone; the
count of cameras unchanged and their camera still visible; a plain
`delete from auth.users` or `update profiles` by a client role refused;
anon refused; the released username drawn again by a new account.

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