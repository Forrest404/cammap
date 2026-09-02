# cammap

A hand-kept map of London, plus an about page and a blog.

No build step, no server, no accounts, no API keys. Leaflet is the only
outside dependency and it comes from a CDN. Open the files in a browser
or drop them on any static host.

    style.css     all the styling for all three pages
    points.js     the points on the map - the file you edit
    map.js        the map page's logic
    map.html      the map
    about.html    the about page
    blog.html     the blog

## How the map works

The published map is **read-only for everyone, including you**. The points
come from `points.js`, which is part of the site. A visitor has no way to
add, change or delete anything, because there is no server for them to
change anything on.

You add points by editing `points.js` and republishing. There is a tool to
make that pleasant:

### Adding points

1. Open `map.html?edit` in a browser. An "Edit mode" banner appears, along
   with the place search, the coordinate form, click-to-place and delete
   buttons.
2. Add and remove points until you are happy. Work in progress is kept in
   your browser, so you can close the tab and come back to it.
3. Press **Copy points.js**. The whole file appears, selected and ready.
4. Paste it over everything in `points.js`.
5. Commit and push. The map is updated once GitHub Pages rebuilds, usually
   within a minute.

**Start again** throws away the draft and returns to whatever is currently
published.

You can also just open `points.js` in a text editor and type a point in by
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
published map. The only way a point gets onto this site is a commit.

There is no way to make an edit mode genuinely private on a static site —
everything sent to a browser can be read by whoever receives it. What is
genuinely secure here is that the site has no write path at all.

## London

The map is locked to Greater London: it cannot be panned outside the
bounding box, cannot zoom out past the whole city, and goes down to street
and building level at the closest zoom. Place searches are confined to the
same box, so it will not offer you a Richmond in Yorkshire.

To change the area covered, edit these three lines near the top of `map.js`:

    var LONDON        = [51.5074, -0.1278];
    var LONDON_BOUNDS = [[51.28, -0.51], [51.70, 0.33]];
    var OPENING_ZOOM  = 11;

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
branch, and that is the whole deployment.
