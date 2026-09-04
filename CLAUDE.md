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
`OWN` in `tools/stamp.py`.

## Where things live

```
index.html          the map. At the root, because that is what a web
                    server hands out for the site's own address.
pages/              about, blog, account, report, moderate, leaderboard
frontend/shared.js  what the other files must agree on: camera types,
                    London bounds, the base styles and the dark lift
frontend/map.js     the map: layers, glow, the list, edit mode
frontend/picker.js  the pin-dropping map on the report form
frontend/account.js accounts, reports, moderation, leaderboard - runs
                    on every page, because the nav does
frontend/style.css  all of it
data/points.js      the cameras, as published
backend/            schema.sql and seed.sql
lib/ fonts/         vendored, pinned, do not edit
tools/stamp.py      run before every commit
```

Links are relative to wherever the page sits, so `account.js` writes them
through `pageHref()` rather than hard-coding `../`. Use it.

## What is copied on purpose, and must be changed everywhere

With no build step there are no partials, so four things are written out once
per page. Changing one copy and not the others is the easiest mistake to make
here, and the least visible.

| Copied on all 7 pages | If you change it |
| --- | --- |
| `<nav class="bar">` | edit all 7, or the nav disagrees with itself |
| `<footer class="foot">` | same |
| The `<meta>` Content-Security-Policy | same — `stamp.py` **fails** if they drift |
| `<script>` tags for shared.js / account.js | same, plus add to `OWN` in `stamp.py` |

`stamp.py` compares the seven policies on every run and exits non-zero naming
the odd page out, so a CSP drift cannot survive a commit. The other three are
on you.

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

Adding an outbound call means adding its host here too, on all seven pages, or
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
- **`?edit` writes nothing to the server.** It is a local drafting tool for
  `points.js`; its export must keep writing every field, `deployments`
  included, or publishing from it silently flattens the glow.

## Things that must not drift apart

- **The base map.** Both maps - the real one and the report form's picker -
  draw through `MAP_STYLES` and `tidyBaseStyle()` in `frontend/shared.js`. The
  dark style is drawn for a pure black page and needs lifting against this one;
  do that there, once, not per map.
- **The aerial imagery.** `SATELLITE_TILES`, `addSatellite()` and
  `showSatellite()` in `shared.js`, used by both maps. If Esri's endpoint ever
  changes, that block is the whole of what needs touching, and the toggle stops
  showing imagery rather than breaking anything.
- **The camera types.** `CAMERA_TYPES` in `frontend/shared.js` is the one list.
  The legend, every drop-down, and every label come from it. The database keeps
  its own copy in the `type` check constraints — deliberately, because the
  server must be able to refuse a bad row without trusting the browser. Adding
  a kind of camera means editing `shared.js` and `schema.sql`, and nothing else.
- **The London bounds.** `LONDON_BOUNDS` in `frontend/shared.js`, and the
  `check` constraints on `cameras`, `reports` and `saved_cameras`. Same reason.
- **`data/points.js` and `backend/seed.sql`** hold the same cameras in two
  forms and must agree. Both say they are written out by `build_points.py` —
  **that script is not in this repository.** Until it turns up, both files are
  edited by hand or through `index.html?edit`, and the `?edit` export must keep
  writing every field, `deployments` included.

## The rule the map's brightness answers to

**Nothing the base map draws may be brighter than the dimmest camera dot**
(perceived brightness 134, the fixed-camera red). The map is the backdrop; the
cameras are the point. Getting it backwards once turned London into a white web
with the cameras lost in it.

The `LIFT` table in `frontend/shared.js` is where that is tuned, and the
"Tuning the dark map" and "Tuning the glow" sections of `NOTES.md` explain what
each number is for. Judge changes to any of it by looking at the map, not by
reading the numbers.

## Anonymity is a feature, not a default

The site keeps a two-word username, a password hash, the reports someone sent,
and their XP. No email, no name, no IP in any table. Before adding anything
that stores or exposes more, read the "Anonymity" section of `NOTES.md` — and
note that an endpoint answering questions *about* accounts is as much of a leak
as a column. `username_available()` was dropped from the schema for exactly
that reason.

Every moderating action is gated on the server. A page hiding itself from a
non-moderator is a courtesy, never the lock.

## Checking your work

There are no tests. There is no build. So it is checked by running it:

```
python3 -m http.server 8000     # then open http://localhost:8000/
python3 tools/stamp.py          # last, before committing
```

Worth looking at after any change to the map or the picker: the console is
clean (a CSP violation shows up there and nowhere else), the camera dots
survive a Dark → Light → Satellite → Dark round trip, and the glow still has
three layers rather than six —

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
