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
| MAP-3 | 2 | map | verified | 4b8d64c | search box for everyone, under the map; no search-as-you-type (Nominatim policy), empty state, bounded to London |
| MAP-1 | 2 | map | verified | 5b9b2cd | `#zoom/lat/lon`, `&camera=<db id | seed key>`, `#lat,lon` kept; throttled `replaceState`; Copy link with three fallbacks |
| MAP-2 | 2 | map | verified | 94a563d | Near me, pressed only; ring brightness 89; three failure paths in words; Nearest sort with metres |
| MAP-5 | 2 | map | verified | 33a914a | chooser on click for stacked dots plus a count badge at z16; Croydon pair reachable by mouse and keyboard |
| REACH-5 | 2 | map | verified | 5435bad | `RECORD_SOURCES` in shared.js; count computed ("182 in the record, 5 more from reports") |
| MOD-1 | 2 | moderation | verified | d864979 | `loadPage()`/`makePager()`; queue, history, activity paged; Wave 4's list reuses it |
| MOD-7 | 2 | moderation | verified | e9e374a | head count on the nav link and the oldest report's age at the top of the queue |
| MOD-2 | 2 | moderation | verified | c3e4a33 | *migrations 004 + 005, unapplied*; `moderate_edit_camera`; `seed_key` untouched; server refuses vancam+active; new `moderation_log` table |
| MOD-4 | 2 | moderation | verified | 2fae7d2 | per-row `moderate_report`, per-row failures shown; no list-taking server function by design |
| MOD-5 | 2 | moderation | verified | 9a77bc4 | whole pending set fetched light, distance to nearest camera computed client-side, paged by id |
| MOD-6 | 2 | moderation | verified | 9f17ab8 | Activity tab: decisions with resolver, and camera actions from `moderation_log` |
| MOD-3 | 2 | moderation | verified | e8b24e2 | *migration 006, unapplied*; `moderate_merge_cameras` returns `{survivor, loser, moved, kept}`; nothing deleted |
| MAP-8 | 3 | map-a11y | verified | 8c337b9 | `moveMap()` cuts with `easeTo({duration:0})` under reduced motion (jumpTo drops the offset); re-read on change |
| MAP-9 | 3 | map-a11y | verified | b846003 | canvas kept focusable as `role=application` with a label naming the list (aria-hidden on a focusable element is a violation); list region labelled; hidden `role=status` count |
| MAP-6 | 3 | map-a11y | verified | d72884d | an `[only]` button per legend key; solo derived from the hidden set; Legacy switched on for an all-legacy kind, and back |
| WORD-6 | 3 | map-a11y | verified | c846abb | `<details open>` under the legend; `STORAGE.explained`; open every visit where storage is refused |
| ACCT-5 | 3 | accounts | verified | d267d2b | `signOut({scope:"global"})` behind an in-page confirmation; bounded by JWT expiry |
| ACCT-1 | 3 | accounts | verified | 7937f93 | re-authenticate with the current password, then `updateUser` |
| ACCT-4 | 3 | accounts | verified | a741f86 | *migration 007, unapplied*; `show_on_leaderboard` in the three view definitions (RLS does not reach a materialized view); `set_leaderboard_visibility()` acts on the caller only |
| ACCT-6 | 3 | accounts | verified | f364f1f | matched by kind and position against the map's own whole-table read; no `camera_id` |
| ACCT-3 | 3 | accounts | verified | 9112dcb | client-side passphrase (47 bits, `crypto.getRandomValues`), one card, prints alone via `body.printing-card`, required tick |
| ACCT-2 | 3 | accounts | verified | 39416f2 | *migration 008, unapplied*; `delete_my_account()` deletes the caller from `auth.users` (cascade) and their proof objects; cameras from approved reports stay |
| REP-1 | 4 | reporting | verified | 3cda953 | form for everyone; draft held in memory and sessionStorage; account asked at Send, in place, with the recovery card |
| REP-6 | 4 | reporting | verified | c6c540c | right-click on the canvas only, 600 ms long-press on touch; `report.html?lat=&lon=` places the pin |
| REP-2 | 4 | reporting | verified | f2158c2 | *migration 009, unapplied*; `pending_near(lat, lon)` → `(found, days_ago)`, granted to anon; count and identity withheld |
| REP-4 | 4 | reporting | verified | 5f4cfd7 | up to three, stripped at choose time, sent one by one; partial failure retried without re-choosing |
| REP-5 | 4 | reporting | verified | 22708c6 | *migration 010, unapplied*; video refused in the form, the `mime` check and the bucket; NOT VALID if old rows exist |
| REP-3 | 4 | reporting | verified | 906b96c | Your reports, paged with `makePager()`; `#report-<id>` lights a row |
| REP-8 | 4 | reporting | verified | 542c42d | receipt with the id, copyable, kept in sessionStorage for the sitting |
| REP-7 | 4 | reporting | verified | 7b59a3e | `xp_rules` rendered on the leaderboard in words; never a typed number |
| WORD-3 | 4 | words | verified | 2a78770 | `id` per post, `<time datetime>`, a permalink; the rule in the template comment |
| WORD-4 | 4 | words | verified | 475e9f2 | Atom `feed.xml` with tag-URI ids, linked from all nine heads; W3C validation after a push |
| WORD-1 | 4 | words | verified | 09c02d5 | About in five sections drawn from NOTES and the record; no count typed; no names |
| WORD-2 | 4 | words | verified | 45d30c5 | `pages/rights.html`: 54 citations, two claims marked Not confirmed; Rights link in all nine navs; sitemap gains it |
| DATA-1 (UI) | 5 | record | verified | 33b09be | `sourceRow()` in the popup: label linked when there is a URL, text alone when not, absent when null |
| DATA-7 (UI) | 5 | record | verified | 426a776 | halo under approximate dots in the type colour dimmed to 128 (`dimTo()`); brightest added pixel 127 Dark, 122 Satellite; legend entry; labels say approximate |
| DATA-8 | 5 | record | verified | 1720616 | `liveUpdates()`: notice beside the record line after 8 s on failure or hang, cleared on a later success; postgrest-js's four retries kept |
| DATA-2 | 5 | record | verified | 0ac83d3 | `data/cameras.geojson` as the script's third output, checked by `--check`, `stamp.py` and `check.js`; footer download line on every page; QGIS for the maintainer |
| MAP-4 | 5 | record | verified | 2fcc62b | range 2020–2026 computed from the record; filter by period overlap; null-period cameras shown in every year; dots, glow, list, count and live region together |
| DATA-6 | 5 | record | verified | c5b1739 | `pages/data.html`: the view, the fourteen columns, two curl lines run against the live project (view 404 until 012; table answers) |
| REACH-6 | 5 | record | verified | 4ace501 | `pages/press.html` with computed counts (`frontend/press.js`), methodology, downloads, licence, the issues page as contact with a TODO for an email (QUESTIONS 17) |
| KEEP-6 | 6 | city | merged | 672aea4 | *migration 013, unapplied*; `CITY` object with aliases; `public.in_city()` is SQL's one copy, called by the three constraints and `pending_near` | `CITY` object; stamp.py checks the SQL constraints against it |
| DATA-4 | 6 | city | merged | ef7eec0, dc566f4 | borough looked up once from Nominatim into the record; 33 pages and an index generated from the CSV and `rights.html`, checked byte-for-byte by `stamp.py` | borough pages generated by a tool, after KEEP-6 |
| KEEP-4 | 6 | offline | merged | 61b3b67 | `sw.js` + `frontend/offline.js`; shell precached under two hashes, ~300 tiles kept, Supabase and Nominatim never; update needs one reload, offered; CSP gained `worker-src 'self'` | `sw.js`, tested update path |
| KEEP-5 | 6 | freshness | merged | a022322 | cache drawn at once whatever its age, revalidated above a 30 s floor, redrawn on a row-signature difference; map, filters, popup, scroll, focus and hash all preserved | stale-while-revalidate without losing view state |

## Totals

| Status | Count |
| --- | --- |
| todo | 0 |
| in-flight | 0 |
| merged | 4 |
| verified | 56 |
| blocked | 0 |
| dropped | 0 |

## Privacy pass (2026-09-07, after Wave 4, at `321b409`)

An agent whose only brief was to find what leaks, over everything since `8bfad60`. Eight
findings, ranked; the fix round below runs before Wave 5. Findings marked *pre-existing*
were in `8bfad60`; the programme is fixing the ones it can and putting the rest to the
maintainer.

| # | Finding | Origin | Action |
| --- | --- | --- | --- |
| L1 | `pending_near` answers on a sharp 100 m circle; 112 anon calls recover a pending report's position to six decimals, contradicting its own comment | programme (REP-2) | **fixed** `724d4d5`, *migration 011, unapplied*: per cell and its eight neighbours; the bisection now stops at the cell centre |
| L2 | Sign-up is `username_available()` under another name: `user_already_exists` and the trigger's "is taken" | pre-existing | QUESTIONS 13; NOTES states it |
| L3 | Daily board × `cameras.approved_at` links a username to a camera and a time | pre-existing structure | **fixed** `8bd7d1c`, *migration 012, unapplied*: `cameras_public` view; table revoked from anon, column grant for authenticated; cadence and default → QUESTIONS 14 |
| L4 | `report.html?lat=&lon=` puts a person's position in the page request and same-origin `Referer`; no referrer policy | programme (REP-6) | **fixed** `74a9b15` (writer, nine heads `strict-origin-when-cross-origin`) and `b4fa94c` (the reader takes `#<lat>/<lon>` only) |
| L5 | Deletion keeps the reporter's words as the camera's name and note; the delete box said otherwise | programme copy; copy-on-approve pre-existing | **fixed** `7757ed2`: the form says what the words become, the delete box says what stays; blanking → QUESTIONS 15 |
| L6 | `cameras.approved_by`/`approved_at`/`updated_at` readable by anon: moderator uuids and working hours | pre-existing | **fixed** with L3 (`8bd7d1c`); the map's read `20b567e`, account.js's two non-moderator reads `8bd7d1c`, all with a fallback until 012 |
| L7 | Near me writes the person's position to the hash; a Copy link from a dot-click popup carries it | programme (MAP-1/2) | **fixed** `31f4a7d`: `writeHash()` skips while a fix is held, bar blanked to `#`, `linkTo()` uses the camera's coordinates |
| L8 | The signed-out report draft in `sessionStorage` survives Log out | programme (REP-1) | **fixed** `4367e73`: `forgetSession()` clears both keys |

Found clean: every RLS policy as anon and as a plain user; every `moderate_*` gate; both
account functions; the deletion cascade; proof paths and EXIF stripping; no cookies, beacons
or sockets; the feed, cards, licence, About, rights page and the record name no private
person. Honest limits to state in NOTES (the fix round adds them): sign-up answers the
existence question at the auth rate limit; the search box sends its text to Nominatim; the
report number is a running count; approved words stay on the map; the session sits in local
storage until Log out; Near me shows on the map and in the tiles fetched for it, never in
the address bar. **All seven added to NOTES "Anonymity" at `96bc188`.** The Wave 4 verifier's
stale-comment defect fixed at `c2ab0ef`.

**Fix round verified (2026-09-09).** L1, L3, L4, L5, L6, L7, L8 closed and each reproduced
by a verifier that did not do the work: the privacy agent's own bisection run unchanged
against the new `pending_near` recovers a whole cell and no more; the four refused queries
refused as anon, as a plain user and, for `select *` and the four columns, as a moderator;
the right-click link followed to a placed pin with no fragment in any `Referer`; both
storage keys gone on every way out; the old schema plus 011–012 dumped identical to fresh.
L2 open by decision (QUESTIONS 13). No regressions. Three stale sentences in NOTES.md, left
by the two halves written in parallel, corrected by the orchestrator at this commit.

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

**Wave 2 summary (verified 2026-09-06).** Landed: the place search for everyone; deep links
in the OSM form plus `&camera=<id>` and a Copy link row with three fallbacks; Near me,
pressed only, with an accuracy ring at brightness 91 and nothing stored or sent; a chooser
and a count badge for stacked dots (the Croydon pair reachable by mouse and keyboard); the
record line computed from the data. On the moderation page: paging everywhere, the backlog
count and the oldest report's age, edit and merge as `security definer` functions with a
`moderation_log` (migrations 004–006, **unapplied**), bulk decisions through the per-row
function, sort and filter over the whole pending set, and an Activity tab. Changed shape:
`?edit` exports CSV rows; `#camera=` is a database id or a seed key; no search-as-you-type;
a log table; `move_camera` gained `actor`; merge returns jsonb. Blocked: nothing.
Verification: all twelve met; every gate refused a plain user with 42501 on a throwaway
PostgreSQL and the old schema plus 004–006 dumped identical to the fresh schema; the fake
client was audited and rebuilt. Observations carried forward: `hide_camera` re-attributes
`resolved_by` on a kept approved status report when merge hides the loser (→ Wave 4
reporting agent, which owns schema.sql then); an out-of-London hash is ignored silently
(→ Wave 3 map-a11y); the Light view logs seven missing-icon warnings at street zoom
(CLAUDE.md known noise, done); with the database unreachable the cameras fetch is retried
four times (→ Wave 5 record agent, DATA-8); the dark base map's label anti-aliasing has
isolated pixels up to 150, pre-existing and untouched. Totals after Wave 2: 27 verified,
31 to go.

**Wave 3 summary (verified 2026-09-07).** Landed: reduced motion through the one movement
helper (a cut is `easeTo({duration:0})` so the popup offset survives); the camera list named
to a screen reader as the map's text equivalent with a live count, the canvas kept focusable
as `role=application`; an `[only]` control per legend key with the solo state announced;
"How to read this map" under the legend, open on first visit only; the out-of-London hash
now says so. On the account page: sign out everywhere, change password by re-authenticating,
the leaderboard opt-out in the three view definitions (migration 007), saved-camera state
matched client-side by kind and position, a printable recovery card with a 47-bit passphrase
made in the browser, and account deletion (migration 008; cameras from approved reports
stay). Migrations 007–008 **unapplied**. Changed shape: canvas not `aria-hidden`; solo as a
button; opt-out in views not RLS; reports cascade away on deletion. Blocked: nothing.
Verification: all ten met — AX tree dumped, reduced motion re-read on change, both new
functions refuse anon and act on the caller only, deletion counted before and after, old
schema plus 007–008 dumped identical to fresh. Observations carried forward: the saved-camera
line "Since marked no longer in use" cannot know the shop was already legacy when starred
(→ Wave 4 reporting agent, account.js); a stray leading space in `printCard()`'s className.
Totals after Wave 3: 37 verified, 21 to go.

**Wave 4 merge note (2026-09-07).** The words and reporting branches shared five files by
design; git merged them without conflict and the orchestrator checked each by hand: on
`report.html`, `account.html` and `leaderboard.html` the nav equals the words branch's, the
body equals the reporting branch's, and the head is the reporting branch's plus the feed
link; `style.css` carries both blocks; `NOTES.md` both sections. The two `sessionStorage`
keys the reporting agent left as constants were moved into `STORAGE` at the merge. Two
things for later waves: `pending_near()` carries a fourth copy of the London box (a cost
guard, not a lock) that `stamp.py`'s bounds check does not read — the Wave 6 city agent
folds it into KEEP-6; and the nav now shows "Report a camera" to a signed-out visitor
(`renderNav()`), a one-line revert if unwanted.

**Wave 4 summary (verified 2026-09-07).** Landed: the report form open to everyone with
the draft carried through an in-place sign-up; report-from-the-map by right-click or a
600 ms long-press; a duplicate notice through `pending_near` (migration 009); up to three
photos stripped at choose time with a recoverable partial failure; video refused in the
form, the check and the bucket (migration 010, `NOT VALID` where old rows exist); a paged
Your reports list; a copyable receipt; the XP table in words. And the words: post anchors
with `<time>`, an Atom feed from nine heads, About in five sections from the notes, and
`pages/rights.html` with 54 citations to 35 documents and two claims marked Not confirmed.
Migrations 009–010 **unapplied**. Changed shape: fragment/comment placement of the feed
link; `(found, days_ago)`; the nav shows Report a camera signed out. Blocked: nothing.
Verification: all twelve met; three databases (fresh, upgraded with a video row, upgraded
without) and the dump diff identical; every rights-page citation fetched (33 × 200, two
sites refuse scripts); the three shared heads confirmed as the reporting head plus the
feed link and its comment. One defect, the orchestrator's: comments in `account.js` and
NOTES still say the report keys await a move into `STORAGE` that had already happened —
routed to the privacy-server fix agent, which owns those files now. Observation: About
says LFR "comes in four forms" while the legend has five kinds (the one `privatecam` is a
closed private estate) — routed to the Wave 5 record agent, one sentence in `about.html`.
**The privacy pass then ran** (table above) and its fix round is in flight; Wave 5 waits
for it. Totals after Wave 4: 49 verified, 9 to go.

**Wave 5 summary (verified 2026-09-10).** Landed: the source row in every popup that has
one and nothing where the record has none; the approximate halo, redesigned by the
brightness measurement (a translucent ring measured 155 over the glow; the type colour
dimmed to 128 measures 131 at worst); the published-record notice after eight seconds,
cleared on a later success; `data/cameras.geojson` as the build script's third output with
the download line on every page; the year scrubber filtering by period overlap with
null-period cameras shown; `pages/data.html` documenting `cameras_public` with curl lines
run live (404 until 012; the table line answers); `pages/press.html` with computed counts
and the issues page as contact (QUESTIONS 17). Changed shape: halo dimmed not translucent;
null periods shown; the scrubber not persisted; the two pages out of the nav; a new
`frontend/press.js`. Blocked: nothing. Verification: all seven met; 77 checks in
`check.js`; four defects — the timeout written as ten seconds where the code says eight
(docs corrected here), CLAUDE.md's "nine pages" (corrected here; the set is found, not
counted), `pages/press.html` with no inbound link from About or the data page, and a wrong
tab-order comment in `sourceRow()` (both → the Wave 6 freshness agent as named extras).
Totals after Wave 5: 56 verified, 2 to go, with KEEP-4 already in flight.
