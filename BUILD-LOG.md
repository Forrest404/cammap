# cammap — programme ledger

The truth of the implementation programme. If the orchestrator loses its thread, this
file and `git log` on `programme/main` are what it rebuilds from; nothing here is in
anyone's memory. Updated after every merge.

Statuses: `todo` · `in-flight` · `merged` (on `programme/main`, not yet independently
checked) · `verified` (a verification agent that did not do the work has signed it off)
· `blocked` (with a reason) · `dropped` (with a reason, and a line in `QUESTIONS.md`).

**Database changes are written, not applied.** Anything marked *migration* below has a
numbered file under `backend/migrations/` and a matching `schema.sql` change, and has not
been run against the live Supabase project. The maintainer runs them.

Integration branch: `programme/main`, cut from `main` at `8bfad60` on 2026-09-06.

## Ground truth (2026-09-06, commit `8bfad60`)

| Claim in the brief | What the tree says | Holds? |
| --- | --- | --- |
| Reviewed at `c17c544`; Move and every-van-legacy uncommitted | One commit later, `8bfad60`, committed both, plus the two programme docs, a relocated `CLAUDE.md`, and a research directory the brief never saw | changed |
| `CLAUDE.md` at the repo root | Now `.claude/CLAUDE.md`. `NOTES.md` "Where things are" still says root | stale in NOTES |
| 182 cameras | 182 in `points.js`, 182 rows in `seed.sql`. 163 vancam, 9 transportcam, 7 facewatchcam, 2 fixedcam, 1 privatecam | holds |
| 17 shown by default | 17 `active` (2 fixed, 9 BTP, 6 shops). Sainsbury's East Dulwich is `legacy` (paused), so NOTES.md's "the seven shops" is off by one | holds; NOTES off by one |
| 43 van sites approximate | 43 notes say "pin marks the surrounding area" | holds |
| 7 pages | index + 6 in `pages/` | holds |
| 1 blog post, no anchors, no `<time>` | 1 real `<article>` (the second match is the commented template), `<p class="date">` | holds |
| About is one sentence | It is | holds |
| 0 tests, 0 CI, 0 share cards, no favicon/manifest/robots/sitemap/404 | None of them exist | holds |
| `build_points.py` referenced in four places, missing | Missing. Referenced in five: `points.js`, `seed.sql`, `schema.sql` header, `NOTES.md`, `.claude/CLAUDE.md` | holds (five, not four) |
| `.limit(QUEUE_PAGE)`, `QUEUE_PAGE = 30`, no `.range()` | Two calls (queue, history). No `.range()`. The two `.limit(5000)` calls are a deliberate ceiling on camera fetches, not lists — MOD-1 leaves them | holds |
| Search box is `edit-only` | `class="box edit-only"` on the Nominatim box in `index.html` | holds |
| `#lat,lon` read on load, never written | `map.js:1898`, regex `^#(-?\d+\.\d+),(-?\d+\.\d+)$`, `jumpTo` | holds |
| `flyTo` everywhere, no reduced-motion | Three `flyTo` calls, no `prefers-reduced-motion` anywhere | holds |
| `:focus` on inputs and donate only | `a.donate:focus`, `input:focus`, `textarea:focus` | holds |
| No `updateUser`, local-only sign-out | Confirmed | holds |
| `deployments` a single integer, `last` a single year | `deployments integer`, `last_seen integer` | holds |
| No `source_url` | Confirmed | holds |
| `username_available()` dropped | `drop function if exists`, with the reasoning in a comment | holds |
| `moderate_move_camera` in working tree only | Committed. `move_camera` leaves `seed_key` alone as documented | now committed |
| ~4,700 words in NOTES/CLAUDE, ~17,000 in comments | About 20,300 words of comments across the tree (rough count) | holds, undercounted |
| Nav and footer identical across pages (KEEP-1 assumes byte-identical) | Footer is byte-identical. Nav is not and cannot be: hrefs are relative (`index.html` vs `../index.html`), `class="current"` moves per page, `blog.html` has trailing whitespace on one line. KEEP-1 must normalise before comparing | needs adjusting |
| `DRAW_ORDER` listed among shared names | It lives in `map.js`, not `shared.js` | minor |
| Site URL | GitHub Pages, `https://forrest404.github.io/cammap/`, no CNAME, branch `main` path `/` | not in brief |

**Not in the brief at all:** `london-lfr-cameras/` — a 14-unit research survey dated
2026-09-06 with `master_cameras.csv` (43 sites, every row with a `source_url`, 10 with
coordinates) and `REPORT.md`. It is a research output, not the record: it disagrees with
`points.js` in places (BTP has 10 stations there, 9 here; it lists casinos and a wine bar the
map does not carry). It is the obvious quarry for DATA-1's `source_url` on the fixed sites
and for the citations WORD-1, WORD-2 and REACH-6 need. It must not be merged into the record
wholesale — "Do not invent data" — and the byte-identical test for DATA-5 is against
`points.js`/`seed.sql`, not against it.

**Premise that has partly evaporated — DATA-3.** The brief's per-year column
`{"2023":1,"2024":3,"2025":4}` assumes per-calendar-year counts. The repository does not
hold them. The record's own vocabulary, read off the notes, is: `2023-24` (65 sites),
`2025` (62), `2023-2025` (31), `2020-2025` (2), `2020-24` (1), `2020-22` (1), "2026 station
trial" (9), plus undated fixed and shop entries. A site with "3 deployments 2023-2025"
cannot be split by year without estimating. DATA-3 therefore stores counts **by the period
the source gives**, and MAP-4 filters by period overlap. Recorded in `QUESTIONS.md`.

## Items

| Item | Wave | Agent | Status | Commit | Note |
| --- | --- | --- | --- | --- | --- |
| KEEP-3 | 0 | keep3 | merged | 052c8eb | `tools/check.js`, zero deps |
| KEEP-1 | 0 | keep1 | merged | 15599a0 | `stamp.py` → checker; nav check must normalise hrefs and `current` |
| KEEP-2 | 0 | keep2 | in-flight | | GitHub Actions; "green" only observable after a push the maintainer makes |
| REACH-4 | 1 | chrome | todo | | root `404.html`, must carry the CSP and join stamp.py's page set |
| REACH-3 | 1 | chrome | todo | | `robots.txt`, `sitemap.xml` at `https://forrest404.github.io/cammap/` |
| REACH-7 | 1 | chrome | todo | | licence: proceeds on QUESTIONS default until the maintainer decides |
| WORD-5 | 1 | chrome | todo | | hosting figure: `TODO` in footer until answered |
| REACH-2 | 1 | chrome | todo | | favicon SVG, 180px PNG, manifest |
| REACH-1 | 1 | chrome | todo | | per-page title/description, 1200×630 PNG in `img/` |
| DATA-5 | 1 | generator | todo | | byte-identical regeneration is the gate; orchestrator verifies by hand |
| DATA-3 | 1 | generator | todo | | *migration*; by source period, not calendar year — see ground truth |
| DATA-1 (schema) | 1 | generator | todo | | *migration*; `source_url`, `source_label` nullable; UI is Wave 5 |
| DATA-7 (schema) | 1 | generator | todo | | *migration*; `approximate` boolean derived once at generation, never at runtime |
| MAP-7 | 1 | stylesheet | todo | | one `:focus-visible` rule |
| MAP-10 | 1 | stylesheet | todo | | print stylesheet; list rows already carry coordinates |
| MAP-3 | 2 | map | todo | | remove `edit-only`, add debounce and empty state |
| MAP-1 | 2 | map | todo | | `#zoom/lat/lon`, `#camera=<id>`, keep `#lat,lon` |
| MAP-2 | 2 | map | todo | | Near me, pressed never automatic |
| MAP-5 | 2 | map | todo | | stacked dots; Croydon pair is the test |
| REACH-5 | 2 | map | todo | | moved from Wave 1/3: the count line belongs with `render()` |
| MOD-1 | 2 | moderation | todo | | `.range()` + Load more on queue and history |
| MOD-7 | 2 | moderation | todo | | head count on nav link |
| MOD-2 | 2 | moderation | todo | | *migration*; `moderate_edit_camera` |
| MOD-4 | 2 | moderation | todo | | bulk via the same `security definer` functions |
| MOD-5 | 2 | moderation | todo | | sort/filter where the whole queue is visible |
| MOD-6 | 2 | moderation | todo | | activity view, paginated |
| MOD-3 | 2 | moderation | todo | | *migration*; `moderate_merge_cameras`, non-destructive |
| MAP-8 | 3 | map-a11y | todo | | reduced motion, re-read on change |
| MAP-9 | 3 | map-a11y | todo | | `aria-hidden` canvas, live region |
| MAP-6 | 3 | map-a11y | todo | | legend solo, keyboard reachable |
| WORD-6 | 3 | map-a11y | todo | | how to read this map, open on first visit only |
| ACCT-5 | 3 | accounts | todo | | sign out everywhere |
| ACCT-1 | 3 | accounts | todo | | change password, current password required |
| ACCT-4 | 3 | accounts | todo | | *migration*; leaderboards are materialized views, so the opt-out is enforced in their definition, not RLS — see QUESTIONS |
| ACCT-6 | 3 | accounts | todo | | match on position client-side |
| ACCT-3 | 3 | accounts | todo | | printable recovery card |
| ACCT-2 | 3 | accounts | todo | | *migration*; delete account |
| REP-1 | 4 | reporting | todo | | form for everyone, account at submit |
| REP-6 | 4 | reporting | todo | | long-press / right-click on the map → report with pin |
| REP-2 | 4 | reporting | todo | | *migration* likely; cell check without leaking who |
| REP-4 | 4 | reporting | todo | | up to three photos |
| REP-5 | 4 | reporting | todo | | decision recorded in NOTES; QUESTIONS default is refuse video |
| REP-3 | 4 | reporting | todo | | Your reports, paginated |
| REP-8 | 4 | reporting | todo | | receipt id |
| REP-7 | 4 | reporting | todo | | publish `xp_rules` on leaderboard |
| WORD-3 | 4 | words | todo | | post ids, `<time datetime>` |
| WORD-4 | 4 | words | todo | | `feed.xml`, head link on every page |
| WORD-1 | 4 | words | todo | | About from NOTES.md; "who runs this" is a QUESTIONS item |
| WORD-2 | 4 | words | todo | | `pages/rights.html`, every claim cited, nav link on every page |
| DATA-1 (UI) | 5 | record | todo | | popup source line; null says nothing |
| DATA-7 (UI) | 5 | record | todo | | approximate drawn differently, legend entry, brightness rule |
| DATA-8 | 5 | record | todo | | published-record notice on failure/timeout |
| DATA-2 | 5 | record | todo | | `cameras.csv`, `cameras.geojson` from the generator |
| MAP-4 | 5 | record | todo | | period scrubber 2020–2026, filters, never predicts |
| DATA-6 | 5 | record | todo | | read API page with a working `curl` |
| REACH-6 | 5 | record | todo | | `pages/press.html` |
| KEEP-6 | 6 | city | todo | | `CITY` object; stamp.py checks the SQL constraints against it |
| DATA-4 | 6 | city | todo | | borough pages generated by a tool, after KEEP-6 |
| KEEP-4 | 6 | offline | todo | | `sw.js`, tested update path |
| KEEP-5 | 6 | freshness | todo | | stale-while-revalidate without losing view state |

## Totals

| Status | Count |
| --- | --- |
| todo | 55 |
| in-flight | 1 |
| merged | 2 |
| verified | 0 |
| blocked | 0 |
| dropped | 0 |

## Wave log

*(one entry per wave: what landed, what changed shape, what is blocked, ledger totals)*
