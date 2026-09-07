# cammap

A map of facial recognition cameras in London: LFR vans, fixed installs,
British Transport Police, Facewatch shops. Static files on GitHub Pages plus
one Supabase project. `NOTES.md` is the long version — goals, setup, tuning,
and what "anonymous" honestly means here. Read it before changing anything to
do with the data or the database.

## How this project is built

**There is no build step.** No npm, no bundler, no transpiler, no modules. What
is in the repository is what the browser runs.

- Plain browser JavaScript: `var`, named functions, no `let`/`const`/arrow
  functions/`class`. This is not nostalgia — it is so a page opened straight
  off the disk works, and so no toolchain can rot.
- **No CDN.** MapLibre and supabase-js are vendored into `lib/`, IBM Plex Mono
  into `fonts/`. Both are pinned by version and are not ours to edit. The
  Content-Security-Policy on every page now enforces this; a script from
  anywhere but `'self'` will not run.
- Everything the site talks to over the network is named in that CSP. Adding an
  outbound call means adding it there too, or it will silently fail.

## Before every commit

```
python3 tools/stamp.py
```

GitHub Pages caches for ten minutes. The stamp puts a content hash on the
site's own `<script>` and `<link>` tags so a returning visitor never pairs new
HTML with old JavaScript. Skip it and the first visit after a deploy can show a
page whose buttons do nothing. If you add a file to `frontend/`, add it to
`OWN` in `tools/stamp.py` — the script now fails if a page loads one of ours
that is not there. If you changed `data/cameras.csv`, run
`python3 tools/build_points.py` first; `stamp.py` fails if either output is
not what the CSV produces.

The same run then checks everything this repository writes out more than
once, and fails naming the page, row or constraint: the CSP, nav and footer
are the same on every page; `points.js` and `seed.sql` agree row for row and
every `seed_key` matches its row; every camera is inside `LONDON_BOUNDS` and
the three schema constraints carry the same numbers; every `vancam` is
`legacy`; `CAMERA_TYPES` and the three `type` constraints hold the same list
bar `nonfunccam`. `python3 tools/stamp.py --check` runs all of it and writes
nothing; that is what CI runs, and a stale stamp fails it.

GitHub runs the same two scripts on every push and every pull request —
`python3 tools/stamp.py --check` then `node tools/check.js`, from
`.github/workflows/check.yml` — on its runner's own Python and Node,
installing nothing. It is the pre-commit check run where forgetting is not
possible; a red run names the page, row or constraint. For a stale stamp, run
`python3 tools/stamp.py` with no flag locally and commit what it writes. It
does not stop a Pages deploy: that needs branch protection requiring the
`check` status.

## Where things live

```
index.html          the map. At the root, because that is what a web
                    server hands out for the site's own address.
404.html            what Pages serves for any missing address, at any
                    depth - so it carries a <base href="/cammap/"> and
                    no account.js, whose path guess is wrong there. In
                    stamp.py's page set like the others: eight pages now.
pages/              about, blog, account, report, moderate, leaderboard
frontend/shared.js  what the other files must agree on: camera types,
                    London bounds, the base styles and the dark lift
frontend/map.js     the map: layers, glow, the list, edit mode
frontend/picker.js  the pin-dropping map: the report form, and the
                    moderation page's Move
frontend/account.js accounts, reports, moderation, leaderboard - runs
                    on every page, because the nav does
frontend/style.css  all of it
data/cameras.csv    the record: the one data file you edit
data/points.js      written out from cameras.csv by tools/build_points.py,
                    never by hand - the map's fallback when the database
                    cannot be reached
backend/            schema.sql; seed.sql (also written by the script);
                    migrations/ (numbered, run by the maintainer, never
                    by anything here)
img/                favicon.svg and the rasters made from it, and
                    share.png, the card a pasted link turns into
manifest.json       "Add to Home Screen"; robots.txt and sitemap.xml
robots.txt          tell crawlers what is here; LICENSE says the record
sitemap.xml         is ODbL 1.0 and the code is not licensed for reuse.
LICENSE             NOTES.md "Sharing the site" is the long version.
tools/share-card.html  photographs the glow for img/share.png, by hand,
                    whenever the count changes; its header says how
lib/ fonts/         vendored, pinned, do not edit
tools/stamp.py      run before every commit: stamps, then checks every
                    copied thing still agrees (--check writes nothing)
tools/check.js      run before every commit too: the record and the pure
                    functions, checked in bare Node with nothing installed
tools/build_points.py  writes both data files from cameras.csv; --check
                    compares, --import reads a points.js back into it
.github/workflows/  check.yml: GitHub runs both scripts on every push and
                    pull request. Not served by Pages.
```

Links are relative to wherever the page sits, so `account.js` writes them
through `pageHref()` rather than hard-coding `../`. Use it.

## What is copied on purpose, and must be changed everywhere

With no build step there are no partials, so four things are written out once
per page. Changing one copy and not the others is the easiest mistake to make
here, and the least visible.

| Copied on all 8 pages | If you change it |
| --- | --- |
| `<nav class="bar">` | edit all 8 — `stamp.py` **fails** if they drift |
| `<footer class="foot">` | same — `stamp.py` **fails** if they drift |
| The `<meta>` Content-Security-Policy | same — `stamp.py` **fails** if they drift |
| `<script>` tags for shared.js / account.js | same, plus add to `OWN` in `stamp.py` |

`stamp.py` compares the copies on every run and exits non-zero naming the odd
page out, so none of these drifts can survive a commit. The nav and footer are
compared with the per-page parts taken off first — the `../` on hrefs and
which link is `class="current"` — so a missing link still fails while a page
in a deeper folder does not. The `<script>` tags are covered too: a file of
ours a page loads that is not in `OWN` fails the run.

## The Content-Security-Policy

Every page carries the same one. It is what turns "no CDN" from a rule we
remember into a rule the browser enforces — a `<script>` added from anywhere
but `'self'` will not run, whoever added it.

What it allows out, and why:

- `https://*.supabase.co` — the database, auth and the private proof bucket.
- `https://tiles.openfreemap.org` — the vector tiles and the sprite.
- `https://server.arcgisonline.com` — Esri imagery, for the satellite view.
- `https://nominatim.openstreetmap.org` — the place search, `?edit` only.
- `worker-src blob:` — **required.** MapLibre starts its tile workers from a
  blob, and without it the map does not draw at all.
- `style-src 'unsafe-inline'` — the swatches and the legend are coloured from
  `CAMERA_TYPES` by setting `style.background`, which is an inline style.

Adding an outbound call means adding its host here too, on all eight pages, or
it fails silently with only a console warning.

## Traps

Things that look like they would work and do not:

- **Camera colours are not in `style.css`.** There were six `--t-*` variables
  holding a second copy; nothing read them, so editing them changed nothing.
  They are gone. `CAMERA_TYPES` in `shared.js` is the only copy.
- **`localStorage` keys are in `STORAGE` in `shared.js`,** not written inline.
  Four files touch the camera cache; a half-updated string does not error, it
  just silently stops finding the cache.
- **`flyTo` will not appear to work in a headless or backgrounded tab.**
  MapLibre advances camera flights on `requestAnimationFrame`, which a hidden
  tab does not run. `jumpTo` does work. This is an artifact of the harness, not
  a bug — check `document.hidden` before believing a map animation is broken.
- **`?edit` writes nothing to the server, and it exports CSV rows, not a
  `points.js`.** `points.js` is generated from `data/cameras.csv`; a
  `points.js` the CSV did not produce fails `stamp.py`. Paste the export over
  `data/cameras.csv`, run `python3 tools/build_points.py`, commit all three.
- **The site's absolute address is written in more than one place.**
  `https://forrest404.github.io/cammap/` is in `sitemap.xml`, `robots.txt`,
  every page's `og:url`, `og:image` and canonical link, and the `<base>` in
  `404.html`. `NOTES.md` "Sharing the site" lists them all; a custom domain
  means changing every one in the same commit.
- **`img/share.png` is a photograph, not a render.** Nothing draws it on
  request. It is regenerated by hand from `tools/share-card.html` whenever
  the count changes, and its header says how.
- **`:focus-visible` does not follow a script's `.focus()` in Chrome** until
  the document has seen a real keyboard event. A console `focus()` on a fresh
  page shows no ring; that is the harness, not a bug. Test with a real Tab.
- **MapLibre's own selectors carry `:not(:disabled)`.** A plain
  `.maplibregl-ctrl-group button:hover` loses to them and looks as though it
  did nothing.
- **The print view reads control state off the DOM** (`.toggle.on`,
  `:placeholder-shown`). Keep visible state on the elements, not only in JS
  memory, or paper stops reflecting the filter.
- **`jumpTo` ignores `offset`, silently.** A cut that must land a point
  off-centre is `easeTo` with `duration: 0`; `showCameraLink()` in `map.js`
  is the example. `moveMap()` is the one `flyTo`; route movement through it.
- **A symbol layer in a font the style does not serve draws nothing.** Both
  OpenFreeMap styles carry `Noto Sans Regular`; the stack badge uses it.
- **`edit_camera` leaves `seed_key` alone,** so a re-seed overwrites an
  edited seed camera's name, note and status. Correct `data/cameras.csv` as
  well, or the edit is undone by the next seed.
- **A live region must be in the tree before its first sentence.**
  `display: none` while empty means the first message is never read;
  `.map-note:empty` keeps it at height 0 for that reason.
- **`aria-hidden` on anything Tab reaches is a violation.** The map canvas
  is `role="application"` with a label that points at the list; do not
  hide it.
- **The count beside the list head is the share card's.** Announce through
  `announceCount()` / `announceThenCount()` in `map.js`, never by rewriting
  `#points-count`.
- **`drawLegend()` rebuilds the legend.** Anything that rebuilds a focused
  control must hand focus back, or a keyboard user is dropped on the body.
- **PostgREST refuses a whole select for one column it does not know.**
  Fetch a column a migration adds on its own until the migration is run;
  `loadLeaderboardSwitch()` in `account.js` is the example. Putting it beside
  `role` would cost a moderator their Moderate link.
- **`body.printing-card` prints the recovery card alone.** Set only around
  the account page's Print button; never on another page.

## Things that must not drift apart

- **The base map.** The map itself and every picker - on the report form, and
  under Move on the moderation page - draw through `MAP_STYLES` and
  `tidyBaseStyle()` in `frontend/shared.js`. The dark style is drawn for a pure
  black page and needs lifting against this one; do that there, once, not per
  map.
- **The aerial imagery.** `SATELLITE_TILES`, `addSatellite()` and
  `showSatellite()` in `shared.js`, used by all of them. If Esri's endpoint ever
  changes, that block is the whole of what needs touching, and the toggle stops
  showing imagery rather than breaking anything.
- **A camera's position, in three places at once.** A moderator can move a
  camera (moderation page, Cameras tab, **Move**). For that correction to
  hold, `move_camera` in `schema.sql` must leave `seed_key` alone - it is how
  `seed.sql` matches a row it has already written, and the seed's
  `on conflict` deliberately never writes coordinates - and
  `overlayCameras()` in `map.js` must take `lat`/`lon` from the database row
  rather than from the seed entry it is laying itself over. Miss either and
  the camera silently goes back to where it was: the first on the next seed
  run, the second on the next page load.
- **The camera types.** `CAMERA_TYPES` in `frontend/shared.js` is the one list.
  The legend, every drop-down, and every label come from it. The database keeps
  its own copy in the `type` check constraints — deliberately, because the
  server must be able to refuse a bad row without trusting the browser. Adding
  a kind of camera means editing `shared.js` and `schema.sql`, and nothing else.
- **The London bounds.** `LONDON_BOUNDS` in `frontend/shared.js`, and the
  `check` constraints on `cameras`, `reports` and `saved_cameras`. Same reason.
- **Every `vancam` is `legacy`.** In `data/points.js`, in `backend/seed.sql`,
  and in the default `tidy()` gives an entry with no status. A van parks for a
  shift and drives away, so no van site claims to be active and the map opens
  on the 17 cameras fixed to something. The recency lives in `last` and
  `deployments`, which are untouched. `tools/build_points.py` writes every van
  site legacy and refuses to build a record that says otherwise; the original
  script, which computed a split from the newest Met year, must not be brought
  back. The long version is "What active means" in `NOTES.md`.
- **`data/points.js` and `backend/seed.sql`** are both written by
  `tools/build_points.py` from `data/cameras.csv` and never edited by hand.
  `stamp.py` regenerates both on every run and fails if either differs. Edit
  the CSV, run the script, commit all three.
- **The period vocabulary.** A `periods` key is `YYYY`, `YYYY-YY` or
  `YYYY-YYYY` — one regular expression in `build_points.py`, `check.js` and
  the `cameras_periods_check` constraint. Deployments are counted by the
  period the source gives, never by a year it does not; `deployments` is
  always the sum.
- **`RECORD_SOURCES` in `shared.js` dates the record.** The count line under
  the map is computed; the dates are typed. Change them with the CSV, and
  remake `img/share.png` when the count moves.
- **`metresBetween()` in `account.js` and `metres_between` in `schema.sql`**
  are twins — same formula, same radius. Change one, change the other.
- **Every moderating action on a camera writes `moderation_log`** through its
  `actor`; a new `moderate_` function must too. Bulk actions call the
  per-report function once per row — there is deliberately no server
  function that takes a list.
- **The leaderboard opt-out lives in the three materialized view
  definitions** (`and p.show_on_leaderboard`), not in RLS, which does not
  reach a materialized view. A new leaderboard view must carry it.

## The rule the map's brightness answers to

**Nothing the base map draws may be brighter than the dimmest camera dot**
(perceived brightness 134, the fixed-camera red). The map is the backdrop; the
cameras are the point. Getting it backwards once turned London into a white web
with the cameras lost in it.

The `LIFT` table in `frontend/shared.js` is where that is tuned, and the
"Tuning the dark map" and "Tuning the glow" sections of `NOTES.md` explain what
each number is for. Judge changes to any of it by looking at the map, not by
reading the numbers.

## Database changes

Schema changes land as `backend/migrations/NNN_*.sql` plus the same block in
`schema.sql`, so a fresh and an upgraded database end up identical. Nothing in
the repository applies them; the maintainer runs them in the Supabase SQL
editor, in order, then re-runs `seed.sql`. `BUILD-LOG.md` says which are
unapplied.

## Anonymity is a feature, not a default

The site keeps a two-word username, a password hash, the reports someone sent,
and their XP. No email, no name, no IP in any table. Before adding anything
that stores or exposes more, read the "Anonymity" section of `NOTES.md` — and
note that an endpoint answering questions *about* accounts is as much of a leak
as a column. `username_available()` was dropped from the schema for exactly
that reason.

Every moderating action is gated on the server. A page hiding itself from a
non-moderator is a courtesy, never the lock.

Every account call the browser can make acts on the caller and answers
nothing: `set_leaderboard_visibility`, `delete_my_account`. A new one that
takes a username or an email as input is a decision for the maintainer, not
something to add.

## Checking your work

There are no tests. There is no build. So it is checked by running it:

```
python3 -m http.server 8000     # then open http://localhost:8000/
python3 tools/stamp.py          # last, before committing: stamps and checks
python3 tools/stamp.py --check  # the same checks, writing nothing (what CI runs)
node tools/check.js             # the checks that need no browser
```

`node tools/check.js` is the other half. It loads `points.js` and `shared.js`
in bare Node and checks the things a browser will not tell you about: the type
table, the paint expression, the London box, every seed key against
`seed.sql`, and every entry of the record. It names the case, and the camera,
when it fails. Run both before every commit; if you add a field to the record,
add it to `FIELDS` in `check.js` at the same time you add it to `seed.sql`.

Worth looking at after any change to the map or the picker: the console is
clean (a CSP violation shows up there and nowhere else — known noise that is
not ours: the `frame-ancestors`-in-`<meta>` line, MapLibre's `wood-pattern`
image warning, and three "Expected value to be of type number" worker
warnings from the OpenFreeMap Bright style in the Light view, and that
style's "Image … could not be loaded" lines for shop icons at street zoom),
the camera
dots survive a Dark → Light → Satellite → Dark round trip, and the glow has
one layer per colour shown rather than two —

```js
map.getStyle().layers.filter(l => l.id.startsWith('cammap-heat')).length
```

The report form only renders signed in. To exercise the picker without an
account, show the form and call its setup directly from the console:

```js
document.getElementById('report-form').style.display = 'block';
document.getElementById('report-new').style.display = 'block';
setUpNewReport();
```

## The comments

This repository explains *why*, in prose, at length. That is on purpose: the
reasoning behind the colour lifts, the glow ramp and the layer ordering is not
recoverable from the code, and it was all learned the hard way.

Match it. Say why a thing is the way it is, not what the line does. Do not
strip comments to make a diff smaller — for anyone arriving here cold, human or
otherwise, they are most of what makes this codebase legible.
