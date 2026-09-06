# cammap — phase prompts

Ten prompts. Paste one per session, in order. Each assumes `.claude/PROMPT-BRIEF.md` is
committed to the repository — that file carries the invariants, the house rules and the full
item index, so these stay short.

**Before phase 0:** commit `PROMPT-BRIEF.md` to `.claude/PROMPT-BRIEF.md` and start each
session on a clean working tree.

**Between phases:** review the diff, deploy, and look at the site. The phases are sized so
that stopping after any one of them leaves the site better and not half-built.

---

## Phase 0 — Ground truth and the safety net

> Read `.claude/PROMPT-BRIEF.md` first, in full, then `CLAUDE.md` and `NOTES.md`.
>
> This is phase 0 of ten. Nothing user-facing changes. You are doing two things: confirming
> what the repository actually contains, and building the net that every later phase falls
> into.
>
> **First, ground truth.** The brief describes the repo as a September 2026 review found it
> at commit `c17c544`. Verify it. Walk the tree and report, as a short table: the real file
> layout, the real camera count, the real page count, which of the review's claims still
> hold, and anything the review missed or got wrong. Do not fix anything yet. If a later
> phase's premise has evaporated, say which and why.
>
> **Then, three items — KEEP-3, KEEP-1, KEEP-2, in that order.**
>
> `tools/check.js` first: plain Node, zero dependencies, loading `data/points.js` and
> `frontend/shared.js` directly. Around twenty assertions covering `colourOf`, `inLondon`,
> `typeColourExpression` and `seedKeyOf` — the pure, load-bearing functions. Exit non-zero on
> failure with the failing case named.
>
> Then extend `tools/stamp.py` from a stamper into a checker. It already compares the seven
> CSP copies; add: `points.js` and `seed.sql` agree row for row; every camera is inside
> `LONDON_BOUNDS`; every vancam is legacy; every type appears in both `CAMERA_TYPES` and the
> SQL check constraint; nav and footer are byte-identical across the seven pages. Each check
> names the offending row when it fails. Prove each one works by breaking it deliberately in
> a scratch copy and showing the failure — then show the tree passing.
>
> Then one GitHub Actions workflow running both on push and pull request. Python and Node
> only, nothing installed, under a minute. This is a checker, not a compiler: the no-build
> philosophy is intact and must stay that way.
>
> Commit each item separately. End with the ground-truth table and a note on which later
> phases need resequencing, if any.

---

## Phase 1 — Make it shareable

> Read `.claude/PROMPT-BRIEF.md` first, in full.
>
> Phase 1 of ten, and the one the review ranks first: *"the cheapest fix on the list and the
> one that decides whether anything else here matters."* A campaigning site that cannot be
> posted is a filing cabinet. Nothing here touches the map, the data or the database — it is
> static files and seven `<head>` blocks.
>
> Items, in this order: **REACH-4** (404), **REACH-3** (robots + sitemap), **REACH-7**
> (licence), **WORD-5** (donate cost), **REACH-5** (last-updated line), **REACH-2** (favicon,
> touch icon, manifest), **REACH-1** (share cards). Full specs are in the brief's item index.
>
> Two things to get right rather than merely done:
>
> The **share image** is doing real campaigning work — a 1200×630 PNG of the glow over London
> with the count on it, committed to the repo, not generated at request time. Produce it from
> the site itself. Each page gets its own title and description; a single shared description
> across seven pages is the failure mode here.
>
> The **last-updated line** should compute its counts from the data rather than hard-code
> them, with the source dates as named constants in `shared.js` beside the rest. It is the
> first thing a sceptical reader checks, so it must never be able to go stale silently.
>
> For WORD-5, do not invent the hosting figure. Ask, and leave a clearly marked `TODO` in the
> footer text if no number is available.
>
> Anything in a `<head>`, the nav or the footer goes into all seven pages in the same commit —
> `stamp.py` now fails you otherwise. Run `python3 tools/stamp.py` and `node tools/check.js`
> before each commit.

---

## Phase 2 — The map as a tool

> Read `.claude/PROMPT-BRIEF.md` first, in full, then `frontend/map.js` end to end before
> writing anything.
>
> Phase 2 of ten. The drawing is the strongest thing in the project. What it lacks is the
> handful of controls that turn a picture into a tool. Four items: **MAP-3** (open the place
> search), **MAP-1** (deep links), **MAP-2** (near me), **MAP-5** (stacked cameras).
>
> Start with MAP-3 — it is deleting a class name and testing the result; the plumbing and the
> CSP allowance already exist.
>
> **MAP-1 is the item the whole review turns on**: *"Here is the camera outside my station" is
> the sentence this project exists to let people say.* The map already reads `#lat,lon` on
> load and the moderation queue writes that form, so keep it working while adding the
> OpenStreetMap-convention `#zoom/lat/lon` that people already know, plus `#camera=<id>` and a
> *Copy link* row inside the popup. Throttle hash writes so panning does not flood history,
> and use `replaceState`, not `pushState`, for movement.
>
> **MAP-2**: pressed, never automatic — that is the line `NOTES.md` already draws and it is a
> privacy position, not a preference. Denial, timeout and unavailable geolocation each need a
> sane path. The accuracy circle answers to the brightness rule: nothing may be brighter than
> the dimmest camera dot.
>
> **MAP-5**: `DRAW_ORDER` currently picks a winner when dots overlap, so the map quietly
> under-reports exactly where density is highest. Croydon deliberately holds a fixed install
> and a van hotspot at nearly the same point — use it as your test case; both must be
> individually reachable when you are done.
>
> Plain browser JavaScript throughout. No clustering library, no bundler; the CSP would refuse
> it anyway.

---

## Phase 3 — Accessibility, print and legend

> Read `.claude/PROMPT-BRIEF.md` first, in full.
>
> Phase 3 of ten. `style.css`'s own header promises 4.5:1 on every colour. This phase makes
> the same promise to people not using a mouse, and to people reading the map on paper or
> through a screen reader. Six items: **MAP-7** (focus-visible), **MAP-8** (reduced motion),
> **MAP-9** (screen reader), **MAP-6** (legend solo), **WORD-6** (how to read this map),
> **MAP-10** (print stylesheet).
>
> MAP-7 is one `:focus-visible` rule covering `button, a, [tabindex]`, with a 2px accent
> outline — but verify it against every background it can land on, including the panel, the
> map canvas and the legend. Right now every button on the site tells a keyboard user nothing.
>
> MAP-8: read `prefers-reduced-motion` once, use `jumpTo` instead of `flyTo` when set, and
> re-read on change rather than only at load. `CLAUDE.md` already notes `jumpTo` is the
> reliable call; this is the same swap for a different reason.
>
> MAP-9 is mostly naming structure that already exists: the canvas is `aria-hidden`, the list
> beside it is announced as the map's text equivalent, and filter changes announce the result
> count through a live region. The good structure is there and only needs naming.
>
> WORD-6 belongs here because it is the same problem in prose: a visitor currently has to
> infer that a hollow ring means a van site. Four sentences under the legend covering the
> colours, the ring, the glow, and why van sites sit behind a toggle.
>
> Finish by tabbing through index, report and moderate with the mouse unplugged, and by doing
> one screen-reader pass over the map page. Report what you heard.

---

## Phase 4 — One source of truth

> Read `.claude/PROMPT-BRIEF.md` first, in full, then `data/points.js`, `backend/seed.sql`,
> `backend/schema.sql`, `tools/stamp.py`, and every mention of `build_points.py` in
> `NOTES.md` and `CLAUDE.md`.
>
> Phase 4 of ten, and the riskiest. Two items: **DATA-5** and **DATA-3**.
>
> `tools/build_points.py` is named in `points.js`, `seed.sql`, `NOTES.md` and `CLAUDE.md`,
> and does not exist. Two files that must agree row for row are kept in step by hand. The
> review calls this *the largest standing risk in the repository: the invariant is documented
> in four places and enforced in none.* Everything in phase 5 depends on this existing.
>
> Write it. One source table in, `points.js` and `seed.sql` out, both generated, neither
> hand-edited again. **The acceptance test is byte-identical output:** regenerating from the
> current data must reproduce exactly what is committed today, comments and formatting
> included. If it cannot, stop and explain the discrepancy before changing any committed file —
> a difference is either a bug in your generator or a hand-edit someone made that nobody
> recorded, and you need to know which.
>
> Then wire it into `stamp.py` (phase 0) so drift fails the build, and update the four places
> that describe the script so they describe what it now actually does.
>
> Then **DATA-3**: replace the single `deployments` integer with a per-year JSON column,
> `{"2023":1,"2024":3,"2025":4}`. Additive and backward-compatible — the old total must be
> derivable, existing rows must keep working, and the check constraint should validate the
> shape. This is what makes phase 5's time slider exact rather than approximate.
>
> Nothing user-facing changes in this phase. Surfacing happens next.

---

## Phase 5 — Provenance, downloads and the record

> Read `.claude/PROMPT-BRIEF.md` first, in full. Phase 4 must be done: this phase assumes
> `build_points.py` exists and regenerates both data files.
>
> Phase 5 of ten. *"Nothing here is estimated"* is the project's whole argument. It is
> honoured in the data and not yet demonstrated to a visitor, who has to take it on trust.
> This phase makes the record legible.
>
> Seven items: **DATA-1** (cite the source on every camera), **DATA-7** (say what is *not*
> known), **DATA-8** (be honest when the database is unreachable), **DATA-2** (CSV and
> GeoJSON downloads), **MAP-4** (time slider), **DATA-6** (document the read API),
> **REACH-6** (press page).
>
> **DATA-1 is the highest-value change on the whole list**: adding `source_url` and
> `source_label` and showing "Source: Met FOI 01.FOI.24.036239" in the popup *converts the map
> from a claim into evidence*. Where a source is unknown, the popup says nothing — it never
> says something vague. Do not invent a citation to fill a null.
>
> **DATA-7**: 43 van sites already carry "pin marks the surrounding area, not an exact spot"
> buried in note prose and are drawn identically to a precise one. Derive the distinction from
> a data field, not from parsing the note text, draw it as a wider softer dot or a radius ring
> that obeys the brightness rule, and give it a legend entry. *Showing uncertainty is more
> persuasive than hiding it, and this project has already argued that in its own notes.*
>
> **DATA-2**: generate `cameras.csv` and `cameras.geojson` from `build_points.py` — never by
> hand — and add a *Download the data* line to the footer of all seven pages. GeoJSON drops
> straight into QGIS, Datawrapper and every newsroom's map tooling; check that it does.
>
> **MAP-4**: a year scrubber under the map, 2020–2026, driven by the per-year column from
> phase 4. It must be keyboard-operable and must update the dots, the list and the count line
> together. *Watching the glow spread across London year by year is the most persuasive thing
> this dataset can do* — but it filters the record, it never predicts.
>
> **REACH-6** goes last, because it links the downloads and the API note this phase creates:
> counts, methodology in three paragraphs, download links, a named reuse licence, one contact
> address.

---

## Phase 6 — The reporting loop

> Read `.claude/PROMPT-BRIEF.md` first, in full, then `pages/report.html` and
> `frontend/account.js`.
>
> Phase 6 of ten. The picker with its crosshair, the context dots and the EXIF-stripping
> upload are all well judged. The problem is what surrounds them: *a wall in front and a void
> behind.* Eight items: **REP-1** (the account wall), **REP-6** (report from the map),
> **REP-2** (duplicate warning), **REP-4** (three photos), **REP-5** (video metadata),
> **REP-3** (Your reports), **REP-8** (a receipt), **REP-7** (publish the XP rules).
>
> **REP-1 first.** `#report-locked` currently hides the form, the map and the crosshair from
> anyone signed out. Show all of it to everyone and ask for an account at the moment of
> submitting, carrying the filled-in report — pin, text and photo — through sign-up intact.
> *Most people who see a van will never make an account first, and the current order loses
> them before they know what is being asked.*
>
> **REP-5 needs a decision, not just an implementation.** The hint currently says photos are
> re-saved to strip location but "videos are sent as they are, so check what yours contains" —
> on a site whose central promise is anonymity. Either refuse video outright, or warn far more
> loudly at the point of choosing the file rather than in a paragraph below it. Make the call,
> implement it, and record the reasoning in `NOTES.md`. *A person filming a van is exactly the
> person who cannot afford to leak a location.*
>
> REP-2 must not leak who reported: check the cell, offer "someone reported this corner two
> days ago — add to it?", and respect RLS.
>
> REP-3 and REP-8 close the loop that REP-1 opens — a list with state, date and the
> moderator's resolution note, and a copyable report id linking into it. *People who send
> evidence somewhere want a receipt.* The `reports: read own or moderator` policy, the columns
> and the data are all already in place; this is the cheapest retention work available.
>
> Paginate the *Your reports* list from the start — phase 7 is about exactly the bug that
> comes from not doing that.

---

## Phase 7 — Moderation at scale

> Read `.claude/PROMPT-BRIEF.md` first, in full, then `frontend/account.js`,
> `pages/moderate.html` and the `security definer` functions in `backend/schema.sql` —
> especially `moderate_move_camera` and `approve_report`.
>
> Phase 7 of ten. The server-side gating here is genuinely well built: every action is a
> `security definer` function that re-checks the role, and nothing is ever deleted. Keep both
> properties. The interface on top of it is where this fails under load. Seven items:
> **MOD-1** (pagination), **MOD-7** (backlog count), **MOD-2** (edit a camera), **MOD-4**
> (bulk actions), **MOD-5** (sort and filter), **MOD-6** (activity log), **MOD-3** (merge).
>
> **MOD-1 first — it is closer to a bug than an improvement.** Queue and history both call
> `.limit(QUEUE_PAGE)` with `QUEUE_PAGE = 30`, and there is no `.range()` anywhere in
> `account.js`. Report 31 onwards is simply unreachable from the interface, *and it bites
> precisely when the project succeeds.* Add `.range()` and *Load more* to every list in that
> file that can grow, not only the queue.
>
> **MOD-4 and MOD-3 are the two that can go wrong quietly.** Bulk approve must call the same
> `security definer` functions the single path calls — *a page hiding itself is a courtesy,
> never the lock* — and must report per-row failures rather than swallowing them. Merge
> repoints the loser's reports at the survivor before hiding it; nothing is deleted, and the
> result states which row survived.
>
> **MOD-2** is the obvious sibling of Move: `moderate_edit_camera`, same gate, same row, same
> panel, reusing the pattern `moderate_move_camera` just established. A typo in a camera name
> is currently permanent.
>
> **MOD-6**: `resolved_by`, `resolved_at` and `resolution_note` are all recorded and none is
> shown. *On a project that publishes accusations about surveillance, being able to audit its
> own moderators is not optional.*
>
> Moderation is volunteer time and the scarcest resource the project has. Optimise the
> interface for the number of decisions per minute, not for the number of features.

---

## Phase 8 — Accounts and anonymity

> Read `.claude/PROMPT-BRIEF.md` first, in full, and read the sections of `NOTES.md` about
> anonymity before you write a line.
>
> Phase 8 of ten. The generated two-word username, the absent email, and the deliberate
> refusal to build `username_available()` are the most principled part of this project. The
> gaps are the ordinary account operations that principle did not cover. Six items:
> **ACCT-5** (sign out everywhere), **ACCT-1** (change password), **ACCT-4** (leaderboard
> opt-out), **ACCT-6** (saved camera status), **ACCT-3** (recovery sheet), **ACCT-2** (delete
> account).
>
> **The test every item here must pass:** *an endpoint that answers questions about accounts
> leaks as surely as a column does.* That is why `username_available()` was dropped. Before
> you add any new call, ask what an attacker learns by calling it repeatedly with guesses. If
> the answer is "whether a username exists", you have rebuilt the thing that was deliberately
> removed.
>
> **ACCT-3** is design work, not plumbing. Sign-up currently shows the username and warns, in
> a hint, that it is the only way back in and nothing can be reset. *Lockout is the
> predictable cost of the anonymity choice and should be designed for, not just disclosed.*
> Produce a printable card — username plus a client-side generated passphrase, one side of
> paper — behind an "I have saved this" tick.
>
> **ACCT-2** must say plainly, before the confirmation, what happens to reports already on
> the map. A site built on collecting nothing should let you take back the little it holds,
> and should be honest about what it cannot take back.
>
> **ACCT-6** is a privacy puzzle worth getting right: `saved_cameras` deliberately holds no
> `camera_id`, so keep the copy and match on position client-side when the list is drawn.
> *The user gets the update without the database gaining a link between a person and a
> camera.*
>
> **ACCT-4**: enforce the opt-out in RLS, not in the query. The generated names carry nothing
> personal, but the pattern of what someone reported is itself information.

---

## Phase 9 — The words, the feed and the long tail

> Read `.claude/PROMPT-BRIEF.md` first, in full, then `NOTES.md` end to end — this phase is
> mostly the job of moving what is already written there onto the public site.
>
> Phase 9 of ten, the last. *The repository contains tens of thousands of words of careful
> reasoning and the public site contains about four hundred. The argument is all in the
> comments, where no visitor will ever read it.* Eight items: **WORD-3** (blog anchors),
> **WORD-4** (feed), **KEEP-5** (stale-while-revalidate), **WORD-1** (About), **WORD-2** (know
> your rights), **KEEP-6** (CITY object), **KEEP-4** (service worker), **DATA-4** (borough
> pages).
>
> **WORD-1**: About is currently one sentence inside an editing marker that invites more.
> Draw the replacement out of `NOTES.md` rather than composing fresh — what LFR is and how it
> differs from CCTV, where every figure comes from, what the map does not claim, who runs this
> and how it is funded. It is already written better there than a first draft would be. Claim
> nothing the data does not support.
>
> **WORD-2 is likely the most useful page the site could add**: what to do when you are
> standing in front of a van, which is the moment someone is most likely to be reading this on
> a phone. Whether you must show your face, what covering it means, what to do if stopped, who
> to complain to, how to make a subject access request. Every legal claim carries a citation.
> Flag clearly anything you are not confident is current law rather than stating it.
>
> **KEEP-6** before **DATA-4**: move the bounds, the centre and the name into one `CITY`
> object that the schema reads from too. *Doing it while there is one city is an afternoon;
> doing it with two is a migration* — and the borough pages are the first thing that will
> harden the assumption.
>
> **KEEP-4**: *this site is meant to be opened on a street with bad signal*, and it can be
> made to work there in plain JavaScript with no build step. Precache the shell, the fonts,
> MapLibre and the last tiles seen — and have a tested update path so an old client is never
> stranded on a stale shell.
>
> **KEEP-5**: draw from cache immediately, revalidate in the background, redraw if it differs —
> without throwing away the user's pan, zoom, filters or open popup.
>
> **DATA-4** last and largest: thirty-three borough pages generated from the same data, each
> with its count, its sites, its busiest spot and a share card, each carrying the identical
> nav, footer and CSP, all of them in the sitemap. Generated by a tool, never hand-maintained.
>
> Finish the phase — and the programme — by walking all fifty-eight items in the brief's index
> and reporting the state of each: done, changed shape, or deliberately not done and why.
