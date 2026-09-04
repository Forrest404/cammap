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
frontend/shared.js  what map.js and account.js must agree on
frontend/map.js     the map: layers, glow, the list, edit mode
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

## Things that must not drift apart

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

The `LIFT` table in `frontend/map.js` is where that is tuned, and the "Tuning
the dark map" and "Tuning the glow" sections of `NOTES.md` explain what each
number is for. Judge changes to any of it by looking at the map, not by reading
the numbers.

## Anonymity is a feature, not a default

The site keeps a two-word username, a password hash, the reports someone sent,
and their XP. No email, no name, no IP in any table. Before adding anything
that stores or exposes more, read the "Anonymity" section of `NOTES.md` — and
note that an endpoint answering questions *about* accounts is as much of a leak
as a column. `username_available()` was dropped from the schema for exactly
that reason.

Every moderating action is gated on the server. A page hiding itself from a
non-moderator is a courtesy, never the lock.

## The comments

This repository explains *why*, in prose, at length. That is on purpose: the
reasoning behind the colour lifts, the glow ramp and the layer ordering is not
recoverable from the code, and it was all learned the hard way.

Match it. Say why a thing is the way it is, not what the line does. Do not
strip comments to make a diff smaller.
