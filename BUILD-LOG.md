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

**The live database, seen from a browser on 2026-09-06:** 187 cameras (five beyond the
seed), 117 shown by default, 95 van sites still `active`. `seed.sql` has not been re-run
since the legacy change. `QUESTIONS.md` item 9 tells the maintainer what to run; it is not
a programme item. Browser checks in every wave will show this state until it is done. The
Chrome extension is not connected in this environment; browser checks run through the
system Chrome headless over the DevTools protocol (a harness in the session scratchpad).

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
| KEEP-3 | 0 | keep3 | verified | 052c8eb | `tools/check.js`, zero deps |
| KEEP-1 | 0 | keep1 | verified | 15599a0 | `stamp.py` → checker; nav check must normalise hrefs and `current` |
| KEEP-2 | 0 | keep2 | verified | 97b2bfc | GitHub Actions; "green" only observable after a push the maintainer makes |
| REACH-4 | 1 | chrome | verified | c8d897b | root `404.html` with a same-origin `<base>`; no account.js there; 8 pages in stamp.py's set |
| REACH-3 | 1 | chrome | verified | 857c528 | six URLs: moderate is `noindex` and left out; robots allows all, reasoning in the file |
| REACH-7 | 1 | chrome | verified | 99c471a | ODbL 1.0 for the data; code not licensed, by the maintainer's decision (QUESTIONS 3); `LICENSE` and a footer line on all eight pages |
| WORD-5 | 1 | chrome | verified | a6c5ef4 | done on default: figure unknown, `TODO (WORD-5)` comment beside the footer sentence |
| REACH-2 | 1 | chrome | verified | 81f018e | SVG, .ico, 180/192/512 PNG, manifest, theme-color |
| REACH-1 | 1 | chrome | verified | da59a54 | per-page description, canonical, OG and Twitter; `img/share.png` from `tools/share-card.html` |
| DATA-5 | 1 | generator | verified | 695c661 | `tools/build_points.py` from `data/cameras.csv`; byte-identical verified by the orchestrator; `stamp.py` regenerates and compares on every run |
| DATA-3 | 1 | generator | verified | 3bd11bb | *migration 001, unapplied*; `periods` jsonb by source period, `deployments` = sum; 172 rows with periods, 10 null |
| DATA-1 (schema) | 1 | generator | verified | cbbb578 | *migration 002, unapplied*; `source_label`/`source_url` on all 182 rows, 11 distinct URLs (QUESTIONS 11 on the 34 spanning rows) |
| DATA-7 (schema) | 1 | generator | verified | 21904e7 | *migration 003, unapplied*; `approximate` boolean, 43 rows true |
| MAP-7 | 1 | stylesheet | verified | dca47c0 | one `:focus-visible` rule; ring moves inside pressed toggles; attribution bar 0.86→0.94 for contrast |
| MAP-10 | 1 | stylesheet | verified | 83e23a5 | `@media print`: list on white with coordinates, legend and filter state kept |
| MAP-3 | 2 | map | in-flight | | remove `edit-only`, add debounce and empty state |
| MAP-1 | 2 | map | in-flight | | `#zoom/lat/lon`, `#camera=<id>`, keep `#lat,lon` |
| MAP-2 | 2 | map | in-flight | | Near me, pressed never automatic |
| MAP-5 | 2 | map | in-flight | | stacked dots; Croydon pair is the test |
| REACH-5 | 2 | map | in-flight | | moved from Wave 1/3: the count line belongs with `render()` |
| MOD-1 | 2 | moderation | merged | d864979 | `loadPage()`/`makePager()`; queue, history, activity paged; Wave 4's list reuses it |
| MOD-7 | 2 | moderation | merged | e9e374a | head count on the nav link and the oldest report's age at the top of the queue |
| MOD-2 | 2 | moderation | merged | c3e4a33 | *migrations 004 + 005, unapplied*; `moderate_edit_camera`; `seed_key` untouched; server refuses vancam+active; new `moderation_log` table |
| MOD-4 | 2 | moderation | merged | 2fae7d2 | per-row `moderate_report`, per-row failures shown; no list-taking server function by design |
| MOD-5 | 2 | moderation | merged | 9a77bc4 | whole pending set fetched light, distance to nearest camera computed client-side, paged by id |
| MOD-6 | 2 | moderation | merged | 9f17ab8 | Activity tab: decisions with resolver, and camera actions from `moderation_log` |
| MOD-3 | 2 | moderation | merged | e8b24e2 | *migration 006, unapplied*; `moderate_merge_cameras` returns `{survivor, loser, moved, kept}`; nothing deleted |
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
| todo | 31 |
| in-flight | 5 |
| merged | 7 |
| verified | 15 |
| blocked | 0 |
| dropped | 0 |

## Wave log

*(one entry per wave: what landed, what changed shape, what is blocked, ledger totals)*

**Wave 0 → 1 handover (2026-09-06).** Wave 0 merged; verification agent running. Wave 1's
chrome and stylesheet agents were started before that report came back, because neither
touches `tools/`, which is the only place a Wave 0 fix could land. The generator agent
(DATA-5, DATA-3, DATA-1/DATA-7 schema) is held until verification returns, because it
extends `tools/stamp.py` and `tools/check.js` and would conflict with any fix there.

**Wave 0 summary (verified 2026-09-06).** Landed: `tools/check.js` (45 checks, Node only),
`tools/stamp.py` as a nine-check checker with `--check`, `.github/workflows/check.yml`.
Changed shape: nav/footer compared after normalising per-page parts; `seedKeyOf` moved to
`shared.js`; page set discovered rather than listed; an extra "own files" check. Blocked:
nothing. Verification: all three met, independent demonstration of 20 stamp.py mutations
and 14 check.js mutations, invariants intact, comments verbatim, browser clean at desktop
and phone width, offline fallback draws 17 of 182. Non-blocking observations, recorded for
later waves: (1) the nav normalisation cannot catch a link that is wrong only in its
`../`/`pages/` prefix — a link check would be its own item; (2) `check.js` reads only seed
rows whose source is `'seed'` (stamp.py covers the other case); (3) with the database
unreachable, account.js still writes the Leaderboard and Account nav links — pre-existing,
and DATA-8 is the item that decides what the page says in that state. CI live run: awaits
the maintainer's first push. Totals after Wave 0: 3 verified, 55 to go.

**Wave 1 summary (verified 2026-09-06).** Landed: `404.html`, `robots.txt`, `sitemap.xml`,
`manifest.json`, icons, `img/share.png` and per-page cards; `LICENSE` (data ODbL 1.0, code
not licensed — the maintainer's decision at `40346a6`); the focus ring and the print view;
`tools/build_points.py` with `data/cameras.csv` as the one source, byte-identical at its
first commit; `periods`, `source_label`/`source_url` and `approximate` in the record, with
migrations 001–003 written and **unapplied**. Changed shape: sitemap of six (moderate is
`noindex`); `<base>` in 404.html; TODO as a comment; periods by source period; the 34
spanning rows cite the Met's records page (QUESTIONS 11). Blocked: nothing. Verification:
all twelve met; migrations applied twice and the seed loaded twice on a throwaway
PostgreSQL 14 with every new constraint refusing by name; ten of eleven source URLs answer
200 (the Met's index page refuses scripted requests). Non-blocking observations carried
forward: the index description's "every site a public record supports" overclaims against
the survey (→ Wave 2 map agent, index.html); the build script's header said "Ten fields"
for twelve (fixed by the orchestrator); a nine-row print puts only the footer on page 2
(→ Wave 3, style.css); two theregister URLs 301 to canonical addresses and Station
Parade's "this pin is a guess" has `approximate: false` (→ Wave 5 record agent,
QUESTIONS 10); Light view logs three OpenFreeMap style warnings and the glow has one
layer per colour shown, not "three" (CLAUDE.md wording fixed). Totals after Wave 1: 15
verified, 43 to go.
