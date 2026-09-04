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
    CLAUDE.md           the house rules, for anyone (or anything) picking
                        the project up cold.
    supabase-config.js  the two public values you paste after making a
                        Supabase project.

    pages/              every other page - about, blog, account, report,
                        moderate, leaderboard.
    frontend/           the code that runs in a browser: shared.js, map.js,
                        picker.js, account.js, style.css.
    data/               points.js, the camera list you edit by hand.
    backend/            schema.sql and seed.sql - the database.
    lib/ fonts/         vendored, pinned by version, not ours to edit.
    tools/              stamp.py, run before every commit (see below).

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

`frontend/picker.js` is the map on the report form - drop a pin, drag it, and
the two coordinate boxes follow. It draws the same base map through the same
shared code, so the picker and the map cannot come to disagree about what
London looks like. It is the only other page that loads MapLibre.

It carries the same two toggles the map page has. **Satellite** is the one that
earns its place on a form: a street diagram tells you which road, a photograph
tells you which pole. **Legacy** filters the context dots, which are active
cameras by default - a retired camera on your corner does not make your
sighting a duplicate, and may be the reason you are reporting it.

**The build script is missing.** `points.js`, `seed.sql` and the TODO below all
name `build_points.py`, but `tools/` holds only `stamp.py`. Until it turns up
the two data files are maintained by hand, or through `index.html?edit`, and
they must be kept in step with each other.

## TODO

- [x] Make it *active* facial recognition cameras, and add a legacy toggle to show ones previously in use. (Done: a van site is active if the newest Met record we hold - 2025 - lists a deployment there. The 2026 record is behind bot protection; when it is obtained, bump `LATEST_MET_YEAR` in the build script and the split updates itself.)
- [x] ~~Use AI to predict where the next LFR deployments will be.~~ **Dropped, deliberately.** 182 sites drawn from annual FOI records cannot support a credible forecast, and this map's own data note says "Nothing here is estimated" - a confident guess printed beside a public record invites people to read it as one. On a civil liberties map that is a liability, not a feature.

  What was built instead answers the question people actually have, out of data already held: **Most used**, the sort beside the camera list, orders by `deployments` - how many times a source records a spot being used. Same number the glow is weighed by. It says where they have gone again and again, which the record does support.
- [x] Make the fixed LFR cameras (not vans) a different color to the vans. (Done: one colour per kind, legend under the map, built from the same table the map paints from.)
- [x] Add satellite, etc views. (Done: three base views under the map - Dark, Light and Satellite. Light is OpenFreeMap's Bright - blue water, green parks, warm off-white land; Positron was tried first but is colourless by design; Satellite is Esri World Imagery under the dark style's labels. Which one you chose is remembered.)
- [x] Accounts should be completely anonymous - a user makes an account under a username and has to assign a strong password. (Done: the site generates the username - two words, `copper.heron` - and the person sets a password. No email, no name. See "Anonymity" below for what "completely" honestly means.)
- [ ] Make it so that when reporting the state of a camera, you have to upload an image
- [ ] Get the Met's 2026 deployment record (met.police.uk blocks scripted downloads; it needs a real browser) and re-run the build.
- [ ] Other cities. The type identifiers and the schema carry over; the London bounds are now `LONDON_BOUNDS` in `frontend/shared.js` (one place, shared by the map and the report form), the opening centre `LONDON` in `frontend/map.js`, and three `check` constraints in `backend/schema.sql` - on `cameras`, `reports` and `saved_cameras`. Wherever the user is located, thats where the map displays by default.

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

### Roles

Moderators and admins are set here, not on the site:

    update profiles set role = 'moderator' where username = 'copper.heron';
    update profiles set role = 'admin'     where username = 'copper.heron';

`admin` and `moderator` are the same on the site today; the two exist so they can differ later.

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
-   