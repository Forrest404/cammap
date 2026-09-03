# cammap

A hand-kept map of facial recognition in London, plus an about page and a
blog.

No build step and no bundler: plain files, plain `<script>` tags, drop them
on any static host. Nothing is fetched from a CDN — MapLibre GL, supabase-js
and the typeface are all vendored into this repository, so the page depends
on nothing outside it. There is one key here, in `supabase-config.js`, and
it is meant to be public; see **Accounts** below.

    style.css            all the styling for all three pages
    points.js            the cameras on the map - the file you edit
    map.js               the map page's logic
    index.html           the map (the site's front page)
    about.html           the about page
    blog.html            the blog

    account.js           the account panel: sign in, save, suggest
    supabase-config.js   the project URL and public key
    schema.sql           the database, to paste into supabase
    SETUP.md             how to set the supabase side up

    lib/                 maplibre-gl and supabase-js, vendored
    fonts/               IBM Plex Mono, vendored

## How the map is drawn

Every camera is a small circle, at every zoom. There are no pins.

Underneath the circles is a heatmap that is at full strength when you are
looking at the whole city and gone by the time you are down among the
streets. It exists because 180 separate dots tell you nothing at a glance:
pull back and the places where cameras crowd together pool into a glow, so
the shape of the thing is visible from above. A camera on its own stays an
ember — the glow is there to say where cameras *gather*, not to make every
single one shout.

Both are drawn from one GeoJSON source built out of `points.js`, so a few
thousand cameras would cost about what a few dozen do.

## How the map works

The published map is **read-only for everyone, including you**. The cameras
come from `points.js`, which is part of the site. A visitor has no way to
add, change or delete a camera on the map, because there is nothing on the
server side that can put one there.

You add cameras by editing `points.js` and republishing. There is a tool to
make that pleasant:

### Adding cameras

1. Open `index.html?edit` in a browser. An "Edit mode" banner appears, along
   with the place search, the coordinate form, click-to-place and delete
   buttons.
2. Add and remove cameras until you are happy. Work in progress is kept in
   your browser, so you can close the tab and come back to it.
3. Press **Copy points.js**. The whole file appears, selected and ready.
4. Paste it over everything in `points.js`.
5. Commit and push. The map is updated once GitHub Pages rebuilds, usually
   within a minute.

**Start again** throws away the draft and returns to whatever is currently
published.

You can also just open `points.js` in a text editor and type a camera in by
hand. The format is four fields:

    {
      name: "Postman's Park",
      note: "The Watts Memorial.",
      lat: 51.516900,
      lon: -0.097700
    },

Leave `note` as `""` if there is nothing to say. Coordinates must fall
inside Greater London.

### A note on `?edit`

`?edit` is a convenience, not a lock. Anyone may add it to the live URL and
the forms will appear for them. It does not matter: their changes live in
their own browser, vanish when they clear it, and can never reach the
published map. The only way a camera gets onto this site is a commit.

There is no way to make an edit mode genuinely private on a static site —
everything sent to a browser can be read by whoever receives it. What is
genuinely secure is narrower than it used to be, and worth stating exactly:
**nothing a visitor can do changes the map.** The site now has a database
behind it for accounts, but that database cannot write to `points.js`, and
`points.js` is the only thing the map reads.

## Accounts

Optional, and nothing to do with what is published. A visitor presses one
button and gets an anonymous account — no email, no password, no name — and
can then:

- **save cameras** to a list only they can see, and
- **suggest a camera** the map does not have yet.

A suggestion goes into a moderation queue in the database and stops there.
It never appears on the map on its own. Getting onto the map is the same
manual step it always was: read the suggestion, check it, and if it stands
up, add it to `points.js` yourself and commit.

Setting the Supabase side up — creating the project, **turning anonymous
sign-in on**, running `schema.sql`, and pasting your two values into
`supabase-config.js` — is written out step by step in `SETUP.md`.

### On the key in the repository

`supabase-config.js` holds a project URL and a public key, and both are
committed. That is correct, not an oversight. A static site has no server to
hide a key behind, so the browser needs a real one, and Supabase's public
key is designed for exactly that: it identifies the project, not a person,
and it can only do what the row level security policies in `schema.sql`
allow — which is read and write a signed-in user's own rows, and nothing
else. A signed-out visitor cannot read any of the three tables at all.

The **service_role** key is a different thing entirely. It bypasses row
level security completely and must never appear in this repository. See
`SETUP.md`.

If none of this is set up, or Supabase cannot be reached, the account panel
says so and the map carries on exactly as before. The map does not depend on
any of it.

Upgrading supabase-js means replacing `lib/supabase.js` by hand, the same as
MapLibre. That is the cost of depending on nothing at run time, and it is
worth it: the site keeps working whether or not a CDN does.

## London

The map is locked to Greater London: it cannot be panned outside the
bounding box, cannot zoom out past the whole city, and goes down to street
and building level at the closest zoom. Place searches are confined to the
same box, so it will not offer you a Richmond in Yorkshire.

To change the area covered, edit these three lines near the top of `map.js`:

    var LONDON        = [51.5074, -0.1278];
    var LONDON_BOUNDS = [[51.28, -0.51], [51.70, 0.33]];
    var OPENING_ZOOM  = 11;

The same bounds are enforced a second time in the database, so a saved or
suggested camera outside London is rejected there too. If you change them
here, change the two `check` constraints in `schema.sql` to match.

## Editing the text

**About page** — open `about.html` and change what sits between:

    <!-- ==================== EDIT ABOUT TEXT BELOW ===================== -->
    <!-- ====================== END ABOUT TEXT ========================== -->

**Blog** — posts are plain HTML blocks in `blog.html`, newest at the top.
Copy the commented-out empty block near the top of the posts section, paste
it directly under that comment, and fill it in.

**Colours and type** — the palette is the block of variables at the top of
`style.css`. Change a colour there and all three pages change together.

## Place search

The search box uses Nominatim, OpenStreetMap's free geocoder. Its usage
policy asks callers to identify themselves with a `User-Agent` header, which
a browser will not allow a page to set. The page compensates by being a
light caller: it searches only when you press the button or Enter, never as
you type, holds requests at least a second apart, and asks for at most five
results, confined to London. There is a commented-out `email=` line in
`map.js` if you would rather your requests were attributable.

The search only runs in edit mode, so the public page never calls it at all.

## Publishing

Plain static files. Push to a repository, turn on GitHub Pages for the
branch, and that is the whole deployment. The account panel needs the
Supabase steps in `SETUP.md` as well; without them the site still publishes
and the map still works.
