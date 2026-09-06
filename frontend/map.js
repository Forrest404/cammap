/* ------------------------------------------------------------------
   cammap - map page
   Plain browser JavaScript. No build step. MapLibre GL draws the
   map; OpenFreeMap serves the vector tiles. Neither needs a key.

   The page has two modes.

     index.html      What the public sees. The points come from
                     points.js and nothing on the page can change them.
                     Each one is a small circle. Pull back and the
                     circles in crowded places pool into a glow, so the
                     shape of the thing is visible from above.

     index.html?edit How you add points. The form, clicking the map
                     and the delete buttons all come back, and a
                     button writes out the rows of data/cameras.csv
                     for you to paste in, build and republish. (The
                     place search used to be edit-only as well; it is
                     everyone's now - see "Finding a place" below.)

   Edit mode is a convenience, not a lock. Anyone may open ?edit on the
   live site, and it will do them no good: their changes live in their
   own browser, disappear when they clear it, and can never reach the
   published map. The only way onto this map is to commit the record -
   data/cameras.csv, and the two files tools/build_points.py writes
   from it.
   ------------------------------------------------------------------ */

var EDITING = window.location.search.indexOf("edit") !== -1;

/* Where the draft is kept while you are working. Only ever written
   in edit mode; the published points are never touched. The key
   itself is in shared.js with the other two. */
var DRAFT_KEY = STORAGE.draft;

/* ---------------- London, and nowhere else for now ----------------

   LONDON_CENTRE, LONDON_BOUNDS and inLondon() are in shared.js: the
   report form validates against the same box, and the picker opens on
   the same spot. Only the zooms below are the map's own. */

var OPENING_ZOOM = 11;
var CLOSEST_ZOOM = 19;   /* street and building level */
var WIDEST_ZOOM  = 10;   /* the whole of London at once */

/* points is the list being shown, in order. Each entry looks like:
     { id: 1, name: "...", note: "...", lat: 0, lon: 0 }

   The cameras are not markers any more. They are one GeoJSON source
   that two layers draw, so a few thousand of them cost about what a
   few dozen did. popup is the one popup on the page, moved about and
   refilled rather than made afresh each time; popupId is the camera it
   is currently showing, so that deleting that camera can close it. */
var points = [];
var popup = null;
var popupId = null;
var nextId = 1;

/* ---------------- the map ----------------

   OpenFreeMap's "dark" style. Vector tiles rather than pictures of a
   map, which is why this one is quiet: it carries place and road names
   and nothing else, no shop pins or clutter, and it is drawn dark at
   source instead of being inverted after the fact.

   MapLibre counts coordinates the other way round from the rest of
   this project - longitude first. lngLat() in shared.js is the one
   place that is converted; call it rather than writing a pair by
   hand, and a reversed pin cannot happen. */

/* MAP_STYLES is in shared.js, because the report page's picker draws
   the same base map. Two styles, and the imagery view uses the dark
   one underneath because its labels are drawn white with a dark halo,
   which is what reads over a photograph.

   The light one is Bright: blue water, green parks, warm off-white
   land. Positron was tried first and is quieter still, but it is
   colourless by design - every colour in it measures zero saturation
   - and a map of a city with no green in the parks and no blue in the
   river is a poorer thing to look at. Bright has colour without
   taking any of the hues the cameras use. */

/* "dark", "light" or "satellite". The three are one choice, not three
   switches: satellite is imagery over the dark style, so it and light
   cannot both be on. */
var view = "dark";

function baseStyleOf(v) {
  return v === "light" ? MAP_STYLES.light : MAP_STYLES.dark;
}

function isLight() {
  return view === "light";
}

/* ---------------- how a camera is drawn ----------------

   Two layers over one source.

     cammap-heat   Where cameras crowd together the glow pools, which
                   is the only reading you get of the whole city at
                   once. Full strength at the widest zoom and gone by
                   the time you are down among the streets, where the
                   circles themselves say everything there is to say.
                   It is actually several layers over the same source,
                   one in each camera colour, so a blue camera glows
                   blue and a green one green.

     cammap-dot    One small circle per camera, at every zoom. No pin,
                   no shadow, no label. The circles are part
                   transparent and lose their outline as you pull
                   back, so two on the same corner run together into
                   something darker than one.

   The glow goes underneath the map's own labels, so place names stay
   readable through it. The circles go over everything. */

var SOURCE = "cameras";
var DOT    = "cammap-dot";

/* The glow is not one heatmap but one per camera colour - a heatmap
   can only carry a single colour ramp, and the glow should match the
   point - so the heatmap layers are not separate. heatLayers records
   each one's layer id, its own source and the colour that source is
   built from. */
var HEAT = "cammap-heat";   /* base id; one layer per colour gets -0, -1, ... */
var heatLayers = [];

/* The colour table, the labels, colourOf() and NONFUNCTIONAL_COLOUR
   all live in frontend/shared.js now: the drop-downs on the report
   and moderation pages are built from the same list, so a new kind of
   camera is one edit rather than five. The legend under the map is
   built from it too, so the legend and the dots cannot disagree. */
var TYPES = CAMERA_TYPES;

/* Which dot wins when two share a spot. Croydon is both a fixed
   install and a van hotspot, and the fixed one should be on top.

   On top, not instead of: this is the tiebreak for which paints last,
   never a filter. What tells you there are two is the count beside
   the dot and the chooser a click opens - see "Stacked cameras". */
var DRAW_ORDER = { fixedcam: 5, transportcam: 4, facewatchcam: 3, vancam: 2, privatecam: 1 };

/* ---------------- stacked cameras ----------------

   Two cameras on one corner used to draw as one dot, and DRAW_ORDER
   chose which. The map then under-reported exactly where it mattered
   most: North End, Croydon is a fixed install and, at the very same
   coordinates, the van hotspot with the most deployments in the
   record, and the map showed one red dot. Nothing is estimated here,
   but a count of one where the record says two is a claim as well.

   Two things fix it, and both are needed. A count beside any dot
   that has others under it, at street zooms, so the map says "2"
   where there are two. And a chooser on click: a click that lands on
   more than one camera opens a small list of them - swatch, name,
   kind - and the one chosen opens as usual, so each is reachable from
   the map and not only from the list.

   "Stacked" is within STACK_METRES of one another. Fifteen metres
   is the width of a road: it takes the two Croydon pairs, which are
   exact, and Coventry Street and Piccadilly Circus, eleven metres
   apart, which draw as one dot at any zoom below eighteen, and it
   leaves Tooting and Tooting Broadway, twenty-four metres apart,
   which separate by zoom sixteen. Below that zoom two dots that
   close are one dot whatever the count says, and the chooser is the
   safety net there: it asks the map what is drawn within a few
   pixels of the click, at whatever zoom the click was made.

   No clustering library. The counting is a sorted sweep over the
   shown points, a few hundred distance sums, done again whenever the
   shown set changes. */
var STACK = "cammap-stack";           /* the badge layer, and its source */
var STACK_METRES = 15;

/* How far the count sits from the dot, in ems of its own size: up
   and to the right, clear of the dot at every zoom the badge shows. */
var STACK_OFFSET = [0.55, -0.55];

/* The colour a point glows with is the colour its dot is drawn with:
   a non-functional one in its own colour whatever its type, otherwise
   the type colour. Each such colour gets its own heatmap layer, built
   below, because a heatmap can only ever carry one ramp and we want
   the glow of a blue point to be blue, not the shared orange. */
function glowColourOf(point) {
  return point.status === "nonfunctional" ? NONFUNCTIONAL_COLOUR : colourOf(point.type);
}

/* How many cameras a colour needs before it is worth a layer of its
   own. Below this it cannot make a glow whatever you do: the first
   coloured stop of the ramp sits at density 0.42, so one or two
   cameras scattered across London draw nothing at all - and an empty
   heatmap still costs a source, a worker parse and a pass over every
   frame. Three is the smallest number that can pool. */
var GLOW_MINIMUM = 3;

/* Which glow colours the data actually calls for, in a fixed order so
   the layers stack the same way every time. One heatmap layer per
   colour - a heatmap can only carry a single ramp, and the glow under
   a blue camera should be blue - and each gets its own source below,
   because MapLibre will not draw two heatmaps over the same source.

   Counted over every point rather than only the shown ones, so the
   set does not change under the legacy toggle: toggling then only
   feeds the sources new data instead of building layers again. */
function glowGroups() {
  var counts = {};
  var order = [NONFUNCTIONAL_COLOUR];
  var groups = [];
  var colour;
  var i;

  for (i = 0; i < points.length; i++) {
    colour = glowColourOf(points[i]);
    counts[colour] = (counts[colour] || 0) + 1;
  }

  for (i = 0; i < TYPES.length; i++) {
    order.push(TYPES[i].colour);
  }

  for (i = 0; i < order.length; i++) {
    if ((counts[order[i]] || 0) >= GLOW_MINIMUM) {
      groups.push(order[i]);
    }
  }

  return groups;
}

/* The colours the glow layers standing right now were built for. */
function glowColoursNow() {
  var list = [];
  var i;

  for (i = 0; i < heatLayers.length; i++) {
    list.push(heatLayers[i].colour);
  }

  return list;
}

function sameColours(a, b) {
  var i;

  if (a.length !== b.length) {
    return false;
  }
  for (i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

/* What the map is narrowed to. All three are read back out of storage
   by loadView() below, so they have to be declared above it: `var`
   would otherwise hoist the name but run the assignment afterwards
   and quietly undo whatever was remembered.

   showLegacy   off by default, which now hides every van site: a
                van is somewhere for a shift, so the map opens on the
                cameras that are actually fixed to something and the
                van record is a thing you ask for.
   hiddenTypes  kinds switched off in the legend. Empty means all.
   sortBy       "name", "used" or - only while Near me holds a
                position - "near". See listed().
   sortBefore   the order in force when Near me was pressed, so that
                clearing it puts the list back as it was. */
var showLegacy = false;
var hiddenTypes = {};
var sortBy = "name";
var sortBefore = "name";

/* ---------------- satellite ----------------

   The tiles, the credit and the layer are in shared.js: the report
   form's picker offers the same view, because seeing the actual roof
   and pavement is the difference between a pin on the right pole and
   a pin on the right street. */

/* The style's own layers that get hidden under imagery, worked out
   once when the style loads. Symbols (labels) are never in it. */
var groundLayers = [];

/* Which toggles were on last time, so a reload keeps them. Read and
   written with the same care as the draft: storage may be refused. */
var VIEW_KEY = STORAGE.view;

function loadView() {
  try {
    var raw = window.localStorage.getItem(VIEW_KEY);
    var saved = raw ? JSON.parse(raw) : null;
    if (saved && typeof saved === "object") {
      showLegacy = saved.legacy === true;
      /* version 1 of this saved a satellite boolean; read it, so a
         visitor who left the imagery on still gets it back. */
      if (saved.view === "dark" || saved.view === "light" || saved.view === "satellite") {
        view = saved.view;
      } else if (saved.satellite === true) {
        view = "satellite";
      }
      if (saved.hidden && typeof saved.hidden === "object") {
        hiddenTypes = saved.hidden;
      }
      if (saved.sort === "used" || saved.sort === "name") {
        sortBy = saved.sort;
      }
    }
  } catch (err) {
    /* nothing saved, or storage refused - defaults stand */
  }
}

function saveView() {
  try {
    window.localStorage.setItem(VIEW_KEY, JSON.stringify({
      legacy: showLegacy,
      view: view,
      hidden: hiddenTypes,

      /* Never "near": that order exists only while Near me holds a
         position, which is never kept past the visit, so what is
         remembered is the order in force before it was pressed. */
      sort: sortBy === "near" ? sortBefore : sortBy
    }));
  } catch (err) {
    /* storage refused - the toggles still work for this visit */
  }
}

loadView();

var HEAT_FULL = 12.5;   /* at or below this the glow is at full strength */
var HEAT_GONE = 15;     /* by here it has gone entirely */

var map = new maplibregl.Map({
  container: "map",
  style: baseStyleOf(view),
  center: lngLat(LONDON_CENTRE[0], LONDON_CENTRE[1]),
  zoom: OPENING_ZOOM,
  minZoom: WIDEST_ZOOM,
  maxZoom: CLOSEST_ZOOM,
  maxBounds: [
    lngLat(LONDON_BOUNDS[0][0], LONDON_BOUNDS[0][1]),   /* south-west */
    lngLat(LONDON_BOUNDS[1][0], LONDON_BOUNDS[1][1])    /* north-east */
  ],
  attributionControl: false
});

map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");

/* The tile source carries its own attribution, so none is added here:
   passing our own as well printed it twice. */
map.addControl(new maplibregl.AttributionControl({ compact: false }));

/* ---------------- moving the map ----------------

   Every deliberate move the page makes - a list row, a search result,
   Near me, the reset in edit mode - goes through this one function,
   so that how the map moves is decided in one place. Today it flies:
   a flight across London says where you came from as well as where
   you are going, which a cut does not. When the page comes to honour
   prefers-reduced-motion, this is the line that changes, and nothing
   else has to know.

   Not for the hash on load: that is a jumpTo, on purpose - the page
   has not drawn yet, so there is nowhere to fly from.

   `below` is for a move that is about to open a popup: the point
   lands that many pixels below the middle of the map instead of on
   it, so the popup has room to stand above its dot. Without it, on a
   phone - where the map is 460 pixels tall and a popup with a note in
   it is half that - MapLibre finds no room above the dot, hangs the
   popup below it instead, and the bottom rows are cut off by the
   map's edge. popupRoom() is the number to pass. If this is ever
   made a cut rather than a flight, it must be easeTo with a duration
   of 0 and not jumpTo: jumpTo ignores `offset`, silently.

   Worth knowing before believing a flight is broken: MapLibre advances
   a flight on requestAnimationFrame, which a hidden or headless tab
   never runs, so in a harness the map appears not to move. It has;
   it is waiting for a frame. */
function moveMap(lat, lon, zoom, below) {
  map.flyTo({ center: lngLat(lat, lon), zoom: zoom, speed: 1.6, offset: [0, below || 0] });
}

/* How far below the middle a dot should sit for its popup to fit
   above it: three tenths of the map's height. On the tall desktop map
   that is a little; on the short phone map it is the difference
   between a popup you can read and one cut off at the knees. Three
   tenths and not a fifth because the popup grows when the copy box
   opens under "Copy link", and at a fifth the title of a grown popup
   went off the top of the phone map. */
function popupRoom() {
  return Math.round((map.getCanvas().clientHeight || 600) * 0.3);
}

/* The LIFT table, lift() and its cache are in frontend/shared.js.
   They moved there when the report page grew a map of its own: the
   dark style needs the same correction wherever it is drawn, and the
   rule those numbers answer to - nothing the base map draws may be
   brighter than the dimmest camera dot - is the same rule on both.

A heatmap's colour ramp, made in the glow's own colour. Density
   0 is the colour with no alpha at all - that stop being anything but
   transparent would wash the whole map - and each higher stop both
   thickens and lifts the colour toward white, so the centre of a
   crowded spot reads as a brighter version of the type colour rather
   than turning white as the old single ramp did. */
function heatRamp(hex) {
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  /* Nothing is drawn until the density is well up, so that a camera
     on its own makes no glow at all - it has a dot, and a halo round
     it would only say the same thing twice. What is left is a map of
     where cameras gather, which is the only thing a heat map is good
     for. */
  var at  = [0, 0.42, 0.62, 0.81, 1];

  /* Kept translucent on purpose. The glow sits over the streets and
     the place names, and a map you cannot read is worse than one
     with no glow on it at all: even at its hottest this lets more
     than a third of the map through. The lift is how far a colour
     is pushed toward white as cameras pile up - enough to read as
     heat, not so far that the colour is lost or the eye is drawn
     off the map. */
  var alpha = [0, 0.13, 0.30, 0.46, 0.60];

  /* How far the colour is pushed as cameras pile up - toward white on
     the dark map, toward black on the light one. Pushing toward white
     on a white map would make the busiest places the faintest, which
     is exactly backwards. */
  var lift = [0, 0, 0.06, 0.18, 0.34];
  var toward = isLight() ? 0 : 255;
  var stops = [];
  var i;
  var w;

  for (i = 0; i < at.length; i++) {
    w = lift[i];
    stops.push([at[i], "rgba(" +
      Math.round(r + (toward - r) * w) + "," +
      Math.round(g + (toward - g) * w) + "," +
      Math.round(b + (toward - b) * w) + "," +
      alpha[i] + ")"]);
  }

  /* Flattened: an interpolate expression takes its stops as a single
     run of value, colour, value, colour - not as pairs. Handed the
     pairs, MapLibre refuses the layer ("expected an even number of
     arguments") and the glow silently never draws. */
  return [].concat.apply([], stops);
}

/* Everything the map needs on top of whichever base style is loaded.
   It runs on the first load and again after every style swap, because
   setStyle throws away every source and layer that is not the
   style's own - the cameras, the glow and the imagery all have to be
   put back. */
/* setStyle does not simply throw the old style away: it works out the
   difference between the two and applies that, which leaves sources
   we added still standing while their layers are gone. Adding them
   again then throws "Source already exists". So anything of ours that
   survived is cleared out first, and the build below always starts
   from nothing. */
/* Found by name rather than from a list we kept: what survived a
   setStyle is whatever MapLibre decided to leave, and asking the style
   itself cannot miss one. It used to guess at eight glow layers, which
   was right only for as long as there were never more. */
function clearOurLayersAndSources() {
  var style = map.getStyle();
  var layers = (style && style.layers) || [];
  var sources = (style && style.sources) || {};
  var ours = [];
  var id;
  var i;

  for (i = 0; i < layers.length; i++) {
    id = layers[i].id;
    if (id === DOT || id === SATELLITE || id === STACK ||
        id.indexOf(HEAT) === 0 || id.indexOf(HERE) === 0) {
      ours.push(id);
    }
  }

  for (i = 0; i < ours.length; i++) {
    map.removeLayer(ours[i]);
  }

  for (id in sources) {
    if (sources.hasOwnProperty(id) &&
        (id === SOURCE || id === SATELLITE || id === HERE || id === STACK ||
         id.indexOf(SOURCE + "-heat-") === 0)) {
      map.removeSource(id);
    }
  }

  heatLayers = [];
}

function buildOverStyle() {
  var layers;
  var i;

  clearOurLayersAndSources();

  /* Take the style's own clutter off, and on the dark one lift what
     is left against this page. Both are in shared.js now, because the
     report page's picker draws the same base map and wants the same
     treatment - see the note there for what the numbers answer to. */
  tidyBaseStyle(map, !isLight());

  layers = map.getStyle().layers;

  /* Where to slide the glow in: above everything the map draws on the
     ground, below everything it writes on top.

     Not simply "the first symbol layer" - that is water_name, which
     comes before the roads and the buildings, so anchoring there
     buried the glow beneath both. It went unnoticed while the
     buildings were the same colour as the background and so drew
     nothing; the moment they were given a colour of their own they
     covered the glow up.

     So: find the last layer that is not a label, and take the first
     label after it. Everything below that is ground, everything above
     is lettering. */
  var firstLabel;
  var lastGround = -1;

  for (i = 0; i < layers.length; i++) {
    if (layers[i].type !== "symbol") {
      lastGround = i;
    }
  }

  for (i = lastGround + 1; i < layers.length; i++) {
    if (layers[i].type === "symbol") {
      firstLabel = layers[i].id;
      break;
    }
  }

  groundLayers = groundLayersOf(map);
  addSatellite(map);

  addCameras(firstLabel);

  /* Where you are, if Near me was pressed before the style changed:
     setStyle threw the ring away with everything else of ours. */
  drawHere();

  applyView();
}

map.on("load", buildOverStyle);

/* setStyle replaces the whole style, so everything above has to be
   built again over the new one. style.load is the event that says the
   new one is ready to take layers. */
/* style.load fires for the first style too, and "load" fires once
   after it. Building on style.load alone would leave the first build
   racing the first render, so both are used and the clear-out above
   makes the second call harmless. */
map.on("style.load", buildOverStyle);

/* Every glow layer shares these; only the ramp and the data differ. */
var HEAT_INTENSITY = ["interpolate", ["linear"], ["zoom"],
  WIDEST_ZOOM, 1.0,
  HEAT_GONE, 1.5];

/* Wide enough that neighbours down the same high street pool into one
   patch, and no wider. It was twice this for a day and the result was
   a wash of colour with the city lost underneath it. */
var HEAT_RADIUS = ["interpolate", ["linear"], ["zoom"],
  WIDEST_ZOOM, 25,
  HEAT_GONE, 38];

var HEAT_OPACITY = ["interpolate", ["linear"], ["zoom"],
  HEAT_FULL, 0.85,
  HEAT_GONE, 0];

/* The layer the glow is slid in beneath, kept from the style build so
   the glow can be made again without working it out afresh. */
var glowAnchor;

function removeGlow() {
  var i;

  for (i = 0; i < heatLayers.length; i++) {
    if (map.getLayer(heatLayers[i].id)) {
      map.removeLayer(heatLayers[i].id);
    }
    if (map.getSource(heatLayers[i].source)) {
      map.removeSource(heatLayers[i].source);
    }
  }

  heatLayers = [];
}

/* One heat layer per glow colour the data calls for, so the glow under
   a point is the point's own colour. */
function addGlow(built, beneath) {
  var colours = glowGroups();
  var colour;
  var g;

  heatLayers = [];

  for (g = 0; g < colours.length; g++) {
    colour = colours[g];

    heatLayers.push({
      id: HEAT + "-" + g,
      source: SOURCE + "-heat-" + g,
      colour: colour
    });

    /* A heatmap may only have one ramp, and MapLibre will not draw two
       heatmaps over the same source, so every colour gets its own
       source holding just its cameras. */
    map.addSource(SOURCE + "-heat-" + g, {
      type: "geojson",
      data: collection(built.byColour[colour])
    });

    map.addLayer({
      id: HEAT + "-" + g,
      type: "heatmap",
      source: SOURCE + "-heat-" + g,
      maxzoom: HEAT_GONE,
      paint: {
        /* Square-rooted, not raw. Westminster's twenty-two deployments
           against a suburb's one is a twenty-one to one range, and used
           raw that one spot would carry a sixteenth of all the heat in
           London and flatten everything near it. Rooted, the range is
           four and a half to one: still plainly the hottest place, with
           its neighbours still visible. */
        "heatmap-weight": ["sqrt", ["max", ["get", "deployments"], 1]],

        /* This is the hotspot map as well as the glow. There used to
           be a second heatmap under these, in the site accent over
           every camera at once, to do the zoomed-out job - but a
           single colour over everything only says "cameras here",
           and washed out the colours underneath it besides. One
           camera on a quiet road is still only an ember; it is where
           they gather that lights up, and now the light is the
           colour of what gathered. */
        "heatmap-intensity": HEAT_INTENSITY,
        "heatmap-radius": HEAT_RADIUS,

        /* The ramp is built from this layer's own colour, the first
           stop fully transparent or the whole map would be washed over
           rather than only the places with cameras in. */
        "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"]].concat(heatRamp(colour)),

        "heatmap-opacity": HEAT_OPACITY
      }
    }, beneath);
  }
}

/* The whole of a dot's paint, for the view as it stands.

   In one place on purpose. It used to be written out here and then
   set again by applyView() a moment later, which runs immediately
   after this on every build - so half of what was written here was
   dead before the first frame, and the two copies had already drifted
   apart. */
function dotPaint() {
  var colour = typeColourExpression();
  var legacy = ["==", ["get", "status"], "legacy"];

  /* Over imagery and over the light map every dot is ringed: the ring
     is what holds a pale dot against pale ground. On the dark map it
     is the page's own black, drawn close in so two dots on one corner
     read as two, and gone as you pull back so a crowd can become a
     mass. Legacy rings keep their outline at every zoom or they would
     vanish. MapLibre insists "zoom" be the outermost expression, so
     the status test sits inside each stop rather than around the
     interpolation. */
  var outlined = view === "satellite" || isLight();

  return {
    "circle-radius": ["interpolate", ["linear"], ["zoom"],
      WIDEST_ZOOM, 2.5,
      14, 4,
      CLOSEST_ZOOM, 7],

    "circle-color": colour,

    /* A legacy site is a ring: nearly no fill, a firm outline in its
       own colour. An active one is solid. On the light map the ring
       is filled a little more firmly, or it is a pale ring on pale
       ground. */
    "circle-opacity": ["case", legacy, isLight() ? 0.30 : 0.12, 0.85],

    "circle-stroke-color": ["case", legacy, colour, dotRingColour()],

    "circle-stroke-width": outlined
      ? ["case", legacy, 1.6, 1.5]
      : ["interpolate", ["linear"], ["zoom"],
          13, ["case", legacy, 1.2, 0],
          15, ["case", legacy, 1.2, 1]],

    "circle-stroke-opacity": outlined ? 0.95 : ["case", legacy, 0.9, 0.6]
  };
}

function addCameras(beneath) {
  var built = buildFeatures();

  glowAnchor = beneath;

  map.addSource(SOURCE, { type: "geojson", data: collection(built.all) });

  addGlow(built, beneath);

  map.addLayer({
    id: DOT,
    type: "circle",
    source: SOURCE,
    paint: dotPaint(),
    layout: {
      /* Two dots on one spot: the more permanent kind wins. */
      "circle-sort-key": ["get", "order"]
    }
  });

  /* The count beside a stacked dot, over the dots. From zoom 13,
     which is where the dots stop pooling into the glow and start to
     be read one by one; wider than that the glow is the density map
     and a "2" would be noise. The font is the one both OpenFreeMap
     styles set their own labels in, from the same glyph server: a
     symbol layer in a font the style does not serve draws nothing,
     silently. Overlap is allowed both ways, because the whole point
     is to draw where the map is crowded. */
  map.addSource(STACK, { type: "geojson", data: collection(built.stacks) });

  map.addLayer({
    id: STACK,
    type: "symbol",
    source: STACK,
    minzoom: 13,
    layout: {
      "text-field": ["to-string", ["get", "count"]],
      "text-font": ["Noto Sans Regular"],
      "text-size": 11,
      "text-offset": STACK_OFFSET,
      "text-anchor": "bottom-left",
      "text-allow-overlap": true,
      "text-ignore-placement": true
    },
    paint: stackPaint()
  });

  applyLegacyFilter();

  bindCameraHandlers();
}

/* The count's colour, by view. It answers to the brightness rule
   like everything drawn here: #7f7f7f is 127 against the rule's 134,
   and 4.9:1 against the page black it sits on through its halo. On
   the light map it is the dark ring colour the dots there wear, with
   the map's own pale ground for a halo, as that style's labels do. */
function stackPaint() {
  return {
    "text-color": isLight() ? "#3a3632" : "#7f7f7f",
    "text-halo-color": isLight() ? "#f8f4f0" : "#0d0d0d",
    "text-halo-width": 1.2
  };
}

/* Bound once and only once. addCameras runs again after every style
   swap, but these listeners live on the map rather than on the layer,
   so binding them there too would leave two of each after one swap
   and four after three - and a click would open the popup four times.
   MapLibre is content for a delegated listener to name a layer that
   does not exist yet; it simply matches nothing until it does. */
var cameraHandlersBound = false;

function bindCameraHandlers() {
  if (cameraHandlersBound) {
    return;
  }
  cameraHandlersBound = true;

  /* A click on a dot asks what is drawn within a few pixels of it,
     not only what was hit: two dots on one corner are one hit, and
     the one underneath would otherwise never open from the map. One
     camera opens as it always has; more than one opens the chooser.
     The same feature can come back more than once from a query that
     spans a tile boundary, so the ids are collected, not the hits. */
  map.on("click", DOT, function (event) {
    var box = [[event.point.x - 6, event.point.y - 6], [event.point.x + 6, event.point.y + 6]];
    var hits = map.queryRenderedFeatures(box, { layers: [DOT] });
    var seen = {};
    var found = [];
    var point;
    var i;

    for (i = 0; i < hits.length; i++) {
      if (!seen[hits[i].properties.id]) {
        seen[hits[i].properties.id] = true;
        point = pointById(hits[i].properties.id);
        if (point) {
          found.push(point);
        }
      }
    }

    if (found.length > 1) {
      openChooser(found, event.lngLat);
    } else {
      openPopup(event.features[0].properties.id);
    }
  });

  map.on("mouseenter", DOT, function () {
    map.getCanvas().style.cursor = "pointer";
  });

  map.on("mouseleave", DOT, function () {
    map.getCanvas().style.cursor = "";
  });
}

/* ---------------- the page's elements ---------------- */

var latInput      = document.getElementById("lat");
var lonInput      = document.getElementById("lon");
var nameInput     = document.getElementById("name");
var memoInput     = document.getElementById("memo");
var addButton     = document.getElementById("add-button");
var addNote       = document.getElementById("add-note");

var searchBox     = document.getElementById("place-search");
var searchText    = document.getElementById("search-text");
var searchButton  = document.getElementById("search-button");
var searchNote    = document.getElementById("search-note");
var searchResults = document.getElementById("search-results");

var pointsList    = document.getElementById("points-list");
var pointsEmpty   = document.getElementById("points-empty");
var pointsSearch  = document.getElementById("points-search");
var pointsCount   = document.getElementById("points-count");
var sortButtons   = document.querySelectorAll("#points-sort button");

var legacyToggle  = document.getElementById("legacy-toggle");
var viewButtons = document.querySelectorAll("#view-buttons button");
var legend        = document.getElementById("legend");
var typeInput     = document.getElementById("type");

var copyButton    = document.getElementById("copy-button");
var resetButton   = document.getElementById("reset-button");
var exportText    = document.getElementById("export-text");
var exportNote    = document.getElementById("export-note");

/* ------------------------------------------------------------------
   Where the points come from

   Read-only: straight out of points.js, and that is the end of it.
   Editing:   a draft in this browser, started from points.js the first
              time so you always begin from what is actually published.
   ------------------------------------------------------------------ */

function tidy(list) {
  /* Give every point an id and make sure the numbers are numbers,
     whether they came from points.js or from a saved draft. */
  var clean = [];
  var i;
  var entry;
  var kind;

  for (i = 0; i < list.length; i++) {
    entry = list[i];

    if (!entry || typeof entry.name !== "string") {
      continue;
    }

    kind = typeof entry.type === "string" ? entry.type : "vancam";

    clean.push({
      id: nextId++,

      /* The entry's identity in the published record, fixed here
         before anything can move it: name, position and type as
         points.js gives them, which is what seed.sql wrote into the
         row's seed_key. Two things read it. The database overlay
         matches rows by it, and has to keep matching after a
         moderator's Move has changed the point's position - so it
         cannot be worked out from the point later. And a link to a
         camera that the database has not given an id carries it, so
         that "here is the camera outside my station" is a link that
         works for anyone, whether or not the database answers. */
      seedKey: seedKeyOf({
        name: entry.name,
        lat: parseFloat(entry.lat),
        lon: parseFloat(entry.lon),
        type: kind
      }),

      name: entry.name,
      note: typeof entry.note === "string" ? entry.note : "",
      lat: parseFloat(entry.lat),
      lon: parseFloat(entry.lon),

      /* A hand-typed entry may leave these out. A van site with no
         status given is legacy, not active - every van site in
         points.js is, and a default that quietly contradicted the
         file would put a lone hand-typed van on the opening map
         beside the fixed cameras. See the header of data/points.js
         for why none of them claims to be active. */
      type: kind,
      status: typeof entry.status === "string" ? entry.status
        : (kind === "vancam" ? "legacy" : "active"),
      last: typeof entry.last === "number" ? entry.last : null,

      /* How many times a source records this spot being used. The glow
         is weighed by it, so a place a van was sent to twenty times
         reads hotter than one it visited once. Anything without a
         count - a shop, a fixed camera, a hand-typed entry - is one. */
      deployments: typeof entry.deployments === "number" && entry.deployments > 0
        ? entry.deployments : 1,

      /* The four fields the record grew after the eight above, carried
         through as they are so that nothing between the file and the
         page loses them: the ?edit export writes them back out, and
         the popup will read them once it draws provenance. None of
         them is drawn yet. A draft saved before the fields existed, or
         a hand-typed entry, has none, and gets the same defaults the
         build script gives a blank cell - null, null, null, false -
         never a plausible value.

         periods       the deployments counted by the period the source
                       gives them in - {"2023-24": 1} - or null where
                       it names none. Kept as the object it came as.
         source_label  the record or report the entry rests on, named,
         source_url    and where it is; null where none is known, and
                       null is what the page should show as nothing.
         approximate   true where the pin marks the surrounding area
                       rather than a spot. A field, so the map never
                       has to search the note for the phrase. */
      periods: entry.periods && typeof entry.periods === "object" ? entry.periods : null,
      source_label: typeof entry.source_label === "string" ? entry.source_label : null,
      source_url: typeof entry.source_url === "string" ? entry.source_url : null,
      approximate: entry.approximate === true
    });
  }

  return clean;
}

function published() {
  /* POINTS comes from points.js. If that file is missing or broken we
     show an empty map rather than a broken page. */
  if (typeof POINTS === "undefined" || !POINTS.length) {
    return [];
  }
  return POINTS;
}

function loadDraft() {
  try {
    var raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) {
      return null;
    }
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch (err) {
    return null;
  }
}

function saveDraft() {
  if (!EDITING) {
    return;
  }
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(points));
  } catch (err) {
    addNote.textContent = "Could not save the draft to this browser.";
  }
}

/* ------------------------------------------------------------------
   Adding and removing points

   All three ways of adding a point end up here, so there is only one
   place where a point is actually created.
   ------------------------------------------------------------------ */

function addPoint(lat, lon, name, note, type) {
  var point = {
    id: nextId++,
    seedKey: seedKeyOf({ name: name, lat: lat, lon: lon, type: type || "vancam" }),
    name: name,
    note: note,
    lat: lat,
    lon: lon,
    type: type || "vancam",
    status: "active",
    last: null,

    /* One, the same default tidy() gives a hand-typed entry: a spot
       nobody has counted deployments at has been used once. */
    deployments: 1,

    /* And the same blanks tidy() gives it: this form has no boxes for
       a period, a source or an approximate pin, and the CSV is where
       those are filled in. */
    periods: null,
    source_label: null,
    source_url: null,
    approximate: false
  };

  points.push(point);
  refreshCameras();
  saveDraft();
  render();

  return point;
}

function removePoint(id) {
  var kept = [];
  var i;

  for (i = 0; i < points.length; i++) {
    if (points[i].id === id) {
      continue;
    }
    kept.push(points[i]);
  }
  points = kept;

  if (popupId === id) {
    closePopup();
  }

  refreshCameras();
  saveDraft();
  render();
}

/* ---------------- what is shown ----------------

   Three things narrow the map: the legacy toggle, the kinds of camera
   picked out in the legend, and the search box beside the list.

   The first two hold the map and the list to the same answer, so the
   glow can never hint at a camera the list does not admit to. The
   search box is deliberately not one of them: it narrows the list
   only. Dots disappearing letter by letter as you type is a poor way
   to read a map, and leaving the map alone means a search costs
   nothing but a redraw of the list. */

/* hiddenTypes and sortBy are declared up with showLegacy, above
   loadView(), so a remembered setting is not overwritten on the way
   past. The search term is not remembered: it is a question you are
   asking now, not a setting. */
var searchTerm = "";

function typeShown(type) {
  return !hiddenTypes[type];
}

/* The rule the map obeys. The search term is not in here on purpose -
   see above. */
function isShown(point) {
  return (showLegacy || point.status !== "legacy") && typeShown(point.type);
}

/* And the rule the list obeys: the same, and then the search. */
function isListed(point) {
  var term;

  if (!isShown(point)) {
    return false;
  }
  if (searchTerm === "") {
    return true;
  }

  term = searchTerm;

  return point.name.toLowerCase().indexOf(term) !== -1 ||
         (point.note || "").toLowerCase().indexOf(term) !== -1;
}

/* The same rule again, as something MapLibre can evaluate per dot. */
function applyLegacyFilter() {
  var filter = ["all"];
  var type;

  if (!showLegacy) {
    filter.push(["!=", ["get", "status"], "legacy"]);
  }

  for (type in hiddenTypes) {
    if (hiddenTypes.hasOwnProperty(type) && hiddenTypes[type]) {
      filter.push(["!=", ["get", "type"], type]);
    }
  }

  if (map.getLayer(DOT)) {
    map.setFilter(DOT, filter.length > 1 ? filter : null);
  }
}

/* Anything that changes which cameras count ends here: the dot filter,
   the glow sources and the list are all brought back into step. */
function applyFilters() {
  applyLegacyFilter();
  refreshCameras();
  render();
}

function setLegacy(on) {
  showLegacy = on;
  applyFilters();
  saveView();
  markLegacy();
}

function markLegacy() {
  if (legacyToggle) {
    legacyToggle.className = showLegacy ? "toggle on" : "toggle";
    legacyToggle.setAttribute("aria-pressed", showLegacy ? "true" : "false");
  }
}

/* Clicking a kind in the legend takes it off the map and out of the
   list. Clicking it again puts it back. */
function toggleType(type) {
  hiddenTypes[type] = !hiddenTypes[type];
  applyFilters();
  saveView();
  drawLegend();
}

/* Imagery on: show the raster, hide the ground, ring every dot in the
   page background so it holds up against grass and rooftops. Imagery
   off: put it all back exactly as it was. */
/* The ring drawn round every dot. On the dark map it is the page's own
   black, which separates two dots that sit on the same corner. Over
   imagery and over the light map it does more than that: it is what
   holds a pale dot against a pale ground, so it is always drawn and a
   little thicker. */
function dotRingColour() {
  return isLight() ? "#3a3632" : "#0d0d0d";
}

/* The four dot properties that answer to which view is on. The rest
   of the paint never changes, so it is set once when the layer is
   made and left alone. */
var VIEW_PAINT = ["circle-opacity", "circle-stroke-color",
                  "circle-stroke-width", "circle-stroke-opacity"];

function applyView() {
  var imagery = view === "satellite";
  var paint;
  var i;

  showSatellite(map, imagery, groundLayers);

  if (map.getLayer(DOT)) {
    paint = dotPaint();
    for (i = 0; i < VIEW_PAINT.length; i++) {
      map.setPaintProperty(DOT, VIEW_PAINT[i], paint[VIEW_PAINT[i]]);
    }
  }

  /* Where you are wears a dark casing over imagery and none
     elsewhere - see drawHere(), under "Near me". */
  applyHereView();

  /* And the count beside a stacked dot changes colour with the
     ground it sits on. */
  if (map.getLayer(STACK)) {
    paint = stackPaint();
    map.setPaintProperty(STACK, "text-color", paint["text-color"]);
    map.setPaintProperty(STACK, "text-halo-color", paint["text-halo-color"]);
  }

  markView();
}

/* Which of the three buttons is lit. */
function markView() {
  var i;
  var b;

  for (i = 0; i < viewButtons.length; i++) {
    b = viewButtons[i];
    b.className = b.getAttribute("data-view") === view ? "toggle on" : "toggle";
    b.setAttribute("aria-pressed", b.getAttribute("data-view") === view ? "true" : "false");
  }
}

function setView(next) {
  var wasStyle = baseStyleOf(view);
  var nowStyle = baseStyleOf(next);

  view = next;
  saveView();
  markView();

  if (wasStyle === nowStyle) {
    applyView();     /* same base map, only the imagery on top changes */
    return;
  }

  /* A different base style: MapLibre throws everything else away, and
     style.load puts it all back. The glow ramps are rebuilt there too,
     since they lift toward white on the dark map and toward black on
     the light one. */
  map.setStyle(nowStyle);
}

/* A plain legend row: a swatch and a name, and nothing to press. Used
   for the two entries that are states rather than kinds. */
function legendNote(colour, text, hollow) {
  var item = document.createElement("li");
  var swatch = document.createElement("span");

  swatch.className = hollow ? "swatch hollow" : "swatch";
  if (hollow) {
    swatch.style.borderColor = colour;
  } else {
    swatch.style.background = colour;
  }

  item.appendChild(swatch);
  item.appendChild(document.createTextNode(text));

  return item;
}

/* The legend is drawn from TYPES so it always matches the paint - and
   each kind is a button, because the key to a map is also the natural
   place to say "just these". A kind that is switched off dims here and
   goes from both the map and the list. */
function drawLegend() {
  var item;
  var button;
  var swatch;
  var i;

  if (!legend) {
    return;
  }

  legend.innerHTML = "";

  for (i = 0; i < TYPES.length; i++) {
    item = document.createElement("li");

    button = document.createElement("button");
    button.className = typeShown(TYPES[i].type) ? "legend-key" : "legend-key off";
    button.setAttribute("aria-pressed", typeShown(TYPES[i].type) ? "true" : "false");
    button.title = typeShown(TYPES[i].type)
      ? "Hide these"
      : "Show these again";

    swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = TYPES[i].colour;
    button.appendChild(swatch);
    button.appendChild(document.createTextNode(TYPES[i].label));

    button.onclick = (function (type) {
      return function () {
        toggleType(type);
      };
    })(TYPES[i].type);

    item.appendChild(button);
    legend.appendChild(item);
  }

  /* Not kinds but states, and both are said by the fill rather than
     the colour, so there is nothing here to switch off. */
  legend.appendChild(legendNote(NONFUNCTIONAL_COLOUR, "Non-functional", false));
  legend.appendChild(legendNote(TYPES[1].colour, "Legacy (no longer in use)", true));
}

/* Everything the layers need, worked out in one walk of the list.

   There are seven collections to fill - the dots, and one per glow
   colour - and this used to be seven walks, each building its own
   copy of every feature it kept. Now each point is turned into a
   feature once and that one object is filed into every collection it
   belongs to; MapLibre serialises features on their way to the
   worker, so sharing them is safe.

   Only shown points reach the glow, so the glow can never hint at a
   camera the list does not admit to. */
function buildFeatures() {
  var all = [];
  var byColour = {};
  var shown = [];
  var point;
  var feature;
  var colour;
  var i;

  for (i = 0; i < points.length; i++) {
    point = points[i];

    feature = {
      type: "Feature",
      properties: {
        id: point.id,
        type: point.type,
        status: point.status,
        deployments: point.deployments || 1,
        order: DRAW_ORDER[point.type] || 0
      },
      geometry: {
        type: "Point",
        coordinates: lngLat(point.lat, point.lon)
      }
    };

    all.push(feature);

    if (isShown(point)) {
      colour = glowColourOf(point);
      if (!byColour[colour]) {
        byColour[colour] = [];
      }
      byColour[colour].push(feature);
      shown.push(point);
    }
  }

  return { all: all, byColour: byColour, stacks: stackFeatures(shown) };
}

/* One feature per place where two or more shown cameras sit within
   STACK_METRES of one another, carrying the count, placed at their
   mean position - which for the Croydon pairs is the point itself.

   A sweep, not a grid and not a library: the points are sorted by
   latitude, and each is compared only with those that follow it
   within STACK_METRES of latitude, which is a handful. A point that
   is already in a group is left in it; a chain of three that only
   touch pairwise would need a merge this does not do, and the record
   holds no such chain, so the simpler thing is the right thing until
   it does. */
function stackFeatures(shown) {
  var order = shown.slice();
  var group = [];
  var groups = [];
  var features = [];
  var span = STACK_METRES / 111320;   /* metres of latitude, in degrees */
  var i;
  var j;
  var g;
  var lat;
  var lon;

  order.sort(function (a, b) {
    return a.lat - b.lat;
  });

  for (i = 0; i < order.length; i++) {
    group.push(-1);
  }

  for (i = 0; i < order.length; i++) {
    if (group[i] === -1) {
      group[i] = groups.length;
      groups.push([order[i]]);
    }
    for (j = i + 1; j < order.length && order[j].lat - order[i].lat <= span; j++) {
      if (group[j] === -1 &&
          metresBetween(order[i].lat, order[i].lon, order[j].lat, order[j].lon) <= STACK_METRES) {
        group[j] = group[i];
        groups[group[i]].push(order[j]);
      }
    }
  }

  for (g = 0; g < groups.length; g++) {
    if (groups[g].length < 2) {
      continue;
    }
    lat = 0;
    lon = 0;
    for (i = 0; i < groups[g].length; i++) {
      lat += groups[g][i].lat;
      lon += groups[g][i].lon;
    }
    features.push({
      type: "Feature",
      properties: { count: groups[g].length },
      geometry: {
        type: "Point",
        coordinates: lngLat(lat / groups[g].length, lon / groups[g].length)
      }
    });
  }

  return features;
}

function collection(features) {
  return { type: "FeatureCollection", features: features || [] };
}

/* Every change to the list ends here: the dot source takes the whole
   list, and each glow source takes only the cameras that glow in its
   colour. Before the style has loaded there is nothing to write to,
   and the load handler fills the sources it makes from the list as it
   stands, so there is nothing to do. */
function refreshCameras() {
  var source = map.getSource(SOURCE);
  var built;
  var glowSource;
  var i;

  if (!source) {
    return;
  }

  built = buildFeatures();
  source.setData(collection(built.all));

  if (map.getSource(STACK)) {
    map.getSource(STACK).setData(collection(built.stacks));
  }

  /* The database overlay can bring in a kind of camera the seed had
     too few of to be worth a layer. Rather than leave those cameras
     with no glow, the set is built again - which only happens when
     the colours actually changed, not on every refresh. */
  if (!sameColours(glowGroups(), glowColoursNow())) {
    removeGlow();
    addGlow(built, glowAnchor);
    return;
  }

  for (i = 0; i < heatLayers.length; i++) {
    glowSource = map.getSource(heatLayers[i].source);
    if (glowSource) {
      glowSource.setData(collection(built.byColour[heatLayers[i].colour]));
    }
  }
}

function pointById(id) {
  var i;

  for (i = 0; i < points.length; i++) {
    if (points[i].id === Number(id)) {
      return points[i];
    }
  }

  return null;
}

/* One popup, moved from camera to camera. Circles are not elements, so
   there is nothing for a popup to hang off; it is placed by coordinate
   instead, and the previous one is taken down first. */
function openPopup(id) {
  var point = pointById(id);

  if (!point) {
    return;
  }

  closePopup();

  popup = new maplibregl.Popup({ offset: 10, closeButton: true })
    .setLngLat(lngLat(point.lat, point.lon))
    .setDOMContent(popupFor(point))
    .addTo(map);

  popupId = point.id;

  /* The address bar says which camera is open, so it is written the
     moment one opens and again when it closes - the close button is
     MapLibre's, so the closing is heard rather than done here. Only
     this popup's own closing counts: the one being replaced closes
     too, a line above, and must not clear what is about to be set. */
  (function (own) {
    own.on("close", function () {
      if (popup === own) {
        popup = null;
        popupId = null;
        writeHash();
      }
    });
  })(popup);

  writeHash();
}

function closePopup() {
  if (popup) {
    popup.remove();
  }
  popup = null;
  popupId = null;
}

/* The chooser: what a click opens when it lands on more than one
   camera. The same one popup, at the spot that was clicked, holding a
   button per camera in the order the dots are painted - DRAW_ORDER,
   the one on top first - each a swatch, the name and the kind, the
   way the list writes a row. Choosing one opens its popup in the
   ordinary way. popupId stays null while the chooser is up: it is
   not a camera, so the address bar does not name one.

   Reachable by keyboard: the buttons are buttons, the first takes
   focus when the chooser opens, and Escape closes it and hands focus
   back to the map. The keyboard's own way to any camera is still the
   list, where a stacked pair is two rows. */
function openChooser(list, at) {
  var box = document.createElement("div");
  var title = document.createElement("strong");
  var rows = document.createElement("ul");
  var sorted = list.slice();
  var i;

  closePopup();

  sorted.sort(function (a, b) {
    return (DRAW_ORDER[b.type] || 0) - (DRAW_ORDER[a.type] || 0);
  });

  title.textContent = sorted.length + " cameras here";
  box.appendChild(title);

  rows.className = "stack";
  for (i = 0; i < sorted.length; i++) {
    rows.appendChild(chooserRow(sorted[i]));
  }
  box.appendChild(rows);

  box.onkeydown = function (event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closePopup();
      map.getCanvas().focus();
    }
  };

  popup = new maplibregl.Popup({ offset: 10, closeButton: true })
    .setLngLat(at)
    .setDOMContent(box)
    .addTo(map);

  popupId = null;

  (function (own) {
    own.on("close", function () {
      if (popup === own) {
        popup = null;
      }
    });
  })(popup);

  rows.firstChild.firstChild.focus();
}

function chooserRow(point) {
  var item = document.createElement("li");
  var pick = document.createElement("button");
  var swatch = document.createElement("span");
  var name = document.createElement("span");
  var kind = document.createElement("span");

  pick.className = "pick-camera";
  pick.type = "button";

  swatch.className = point.status === "legacy" ? "swatch hollow" : "swatch";
  if (point.status === "legacy") {
    swatch.style.borderColor = colourOf(point.type);
  } else {
    swatch.style.background = point.status === "nonfunctional" ? NONFUNCTIONAL_COLOUR : colourOf(point.type);
  }
  pick.appendChild(swatch);

  name.className = "name";
  name.textContent = point.name;
  pick.appendChild(name);

  kind.className = "kind";
  kind.textContent = labelOf(point);
  pick.appendChild(kind);

  pick.onclick = function () {
    openPopup(point.id);
  };

  item.appendChild(pick);
  return item;
}

/* "LFR van site · legacy · last seen 2024" and the like. */
function labelOf(point) {
  var label = typeLabel(point.type) || "Camera";

  if (point.status === "legacy") {
    label += " · legacy";
    if (point.last) {
      label += " · last seen " + point.last;
    }
  } else if (point.status === "nonfunctional") {
    label += " · non-functional";
  }

  return label;
}

/* Built as elements rather than as a string of HTML, so a name or a
   note containing angle brackets is shown as typed. */
function popupFor(point) {
  var box = document.createElement("div");

  var title = document.createElement("strong");
  title.textContent = point.name;
  box.appendChild(title);

  box.appendChild(document.createElement("br"));
  var kind = document.createElement("span");
  kind.className = "kind";
  kind.textContent = labelOf(point);
  box.appendChild(kind);

  if (point.note) {
    box.appendChild(document.createElement("br"));
    box.appendChild(document.createTextNode(point.note));
  }

  box.appendChild(document.createElement("br"));
  var coords = document.createElement("span");
  coords.textContent = point.lat.toFixed(4) + ", " + point.lon.toFixed(4);
  box.appendChild(coords);

  box.appendChild(document.createElement("br"));
  box.appendChild(copyLinkRow(point));

  /* Only a camera that lives in the database can have its state
     reported on; a seed-only entry has nothing to attach a report to
     until the seed has been loaded. */
  if (point.cameraId) {
    box.appendChild(document.createElement("br"));
    var report = document.createElement("a");
    report.className = "report-link";
    /* map.js only runs on the map, which is the page at the root, so
       the report page is one folder down from here. */
    report.href = "pages/report.html?camera=" + encodeURIComponent(point.cameraId);
    report.textContent = "Report its state \u2192";
    box.appendChild(report);

    /* A moderator can take a camera off the map from right here. The
       server checks the role again; this only decides whether to
       offer the link. */
    if (typeof isModerator === "function" && isModerator()) {
      box.appendChild(document.createElement("br"));
      var remove = document.createElement("a");
      remove.className = "report-link";
      remove.href = "#";
      remove.textContent = "Remove from map \u2192";
      remove.onclick = function (event) {
        event.preventDefault();
        var why = window.prompt("Why is this camera coming off the map?", "");
        if (why === null) { return; }
        remove.textContent = "\u2026";
        sb.rpc("moderate_undo", { target: point.cameraId, action: "hide_camera", note: why })
          .then(function (result) {
            if (result.error) {
              remove.textContent = result.error.message || "That did not go through.";
              return;
            }
            forgetCameraCache();
            closePopup();
            points = points.filter(function (p) { return p.cameraId !== point.cameraId; });
            refreshCameras();
            render();
          });
      };
      box.appendChild(remove);
    }
  }

  return box;
}

/* The address a link to this page starts with: what is in the bar,
   less any query and any hash. The query goes because ?edit is not
   something to send anyone. */
function pageAddress() {
  return window.location.href.split("#")[0].split("?")[0];
}

/* A link to a camera: the view as it stands, and the camera - the
   same thing the address bar holds while its popup is open, so the
   two can never disagree about what a link to a camera is. Worked
   out when the link is asked for, not when the popup was built,
   because the view may have moved since. */
function linkTo(point) {
  var centre = map.getCenter();
  var zoom = Math.round(map.getZoom() * 100) / 100;

  return pageAddress() + "#" + zoom + "/" + centre.lat.toFixed(5) + "/" +
         centre.lng.toFixed(5) + "&camera=" + cameraLinkId(point);
}

/* "Copy link" in the popup. An <a> and not a <button>, because it is
   the link: its href is the address, so a right-click and "copy link
   address" works before any script does, and so does dragging it to
   an address bar. A left click copies it instead of following it.

   Three ways to copy, tried in turn, because none is everywhere. The
   clipboard API is refused on a page opened off the disk and on a
   plain http address, and a browser may refuse it for a page that is
   not focused; execCommand is deprecated but is what works on
   file://; and where both fail the address is put in a box, selected,
   so that one keystroke finishes the job the page could not. */
function copyLinkRow(point) {
  var link = document.createElement("a");
  var box = null;
  var said = null;
  var resetTimer = null;

  link.className = "report-link copy-link";
  link.href = linkTo(point);
  link.textContent = "Copy link →";
  link.title = "A link to this camera, to send or keep";

  function say(text) {
    link.textContent = text;
    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(function () {
      link.textContent = "Copy link →";
    }, 2500);
  }

  function showBox(url) {
    if (!box) {
      box = document.createElement("input");
      box.type = "text";
      box.readOnly = true;
      box.className = "copy-box";
      box.setAttribute("aria-label", "Link to this camera");
      said = document.createElement("span");
      said.className = "kind";
      link.parentNode.insertBefore(box, link.nextSibling);
      box.parentNode.insertBefore(said, box.nextSibling);
    }
    box.value = url;
    box.focus();
    box.select();
  }

  function byCommand(url) {
    var copied = false;

    showBox(url);
    try {
      copied = document.execCommand("copy");
    } catch (err) {
      copied = false;
    }

    if (copied) {
      said.textContent = "Copied.";
      say("Copied ✓");
    } else {
      said.textContent = "Selected — press Ctrl-C, or Cmd-C on a Mac, to copy.";
    }
  }

  link.onclick = function (event) {
    var url = linkTo(point);

    event.preventDefault();
    link.href = url;

    if (window.navigator.clipboard && window.navigator.clipboard.writeText) {
      window.navigator.clipboard.writeText(url).then(function () {
        say("Copied ✓");
      }, function () {
        byCommand(url);
      });
      return;
    }

    byCommand(url);
  };

  return link;
}

/* ------------------------------------------------------------------
   The list of points

   Everybody gets the list and can click a row to be taken there. Only
   edit mode gets the delete buttons.
   ------------------------------------------------------------------ */

/* "Most used" orders by how many times a source records the spot
   being used - the same number the glow is weighed by. It is the
   honest version of the question people actually ask of this map:
   not "where will a van be next", which nothing here can know, but
   "where have they been again and again", which the record says
   plainly. */
function listed() {
  var out = [];
  var i;

  for (i = 0; i < points.length; i++) {
    if (isListed(points[i])) {
      out.push(points[i]);
    }
  }

  if (sortBy === "used") {
    /* Busiest first, and ties fall back to the order they came in,
       which is the seed's own alphabetical order. */
    out.sort(function (a, b) {
      return (b.deployments || 1) - (a.deployments || 1);
    });
  } else if (sortBy === "near" && here) {
    /* Closest first, from where Near me found you. */
    out.sort(function (a, b) {
      return distanceFromHere(a) - distanceFromHere(b);
    });
  }

  return out;
}

function render() {
  var rows = listed();
  var i;

  pointsList.innerHTML = "";

  for (i = 0; i < rows.length; i++) {
    pointsList.appendChild(rowFor(rows[i]));
  }

  pointsEmpty.style.display = rows.length === 0 ? "block" : "none";

  if (pointsCount) {
    pointsCount.textContent = rows.length === points.length
      ? String(points.length) + " cameras"
      : String(rows.length) + " of " + String(points.length);
  }
}

function rowFor(point) {
  var row = document.createElement("li");

  /* The point itself: clicking it takes the map there. */
  var go = document.createElement("button");
  go.className = "goto";
  go.title = "Show on the map";

  var swatch = document.createElement("span");
  swatch.className = point.status === "legacy" ? "swatch hollow" : "swatch";
  if (point.status === "legacy") {
    swatch.style.borderColor = colourOf(point.type);
  } else {
    swatch.style.background = point.status === "nonfunctional" ? NONFUNCTIONAL_COLOUR : colourOf(point.type);
  }
  swatch.title = labelOf(point);
  go.appendChild(swatch);

  var name = document.createElement("span");
  name.className = "name";
  name.textContent = point.name;
  go.appendChild(name);

  if (point.note) {
    var memo = document.createElement("span");
    memo.className = "memo";
    memo.textContent = point.note;
    go.appendChild(memo);
  }

  var coords = document.createElement("span");
  coords.className = "coords";
  coords.textContent = point.lat.toFixed(4) + ", " + point.lon.toFixed(4);

  /* Only while the list is ordered by it. The seed's own notes already
     say "3 deployments 2023-2025" in the line above, so repeating the
     number on every row the rest of the time is just noise. */
  if (sortBy === "used") {
    coords.textContent = (point.deployments || 1) +
      ((point.deployments || 1) === 1 ? " use · " : " uses · ") +
      coords.textContent;
  }

  /* How far it is from you, whatever the order, for as long as Near
     me holds a position: "is there one near my station" is answered
     by the number, and the number is as useful on an A-Z list as on
     the one sorted by it. */
  if (here) {
    coords.textContent = distanceText(distanceFromHere(point)) + " · " + coords.textContent;
  }

  go.appendChild(coords);

  go.onclick = function () {
    moveMap(point.lat, point.lon, 17, popupRoom());
    openPopup(point.id);
  };

  row.appendChild(go);

  /* account.js adds a star button here once someone is signed in, so
     that saving a camera does not need a second UI of its own. Left
     alone entirely if account.js never loaded or nobody is signed in
     - this row works exactly as before either way. */
  if (typeof accountStarButton === "function") {
    var star = accountStarButton(point);
    if (star) {
      row.appendChild(star);
    }
  }

  if (EDITING) {
    var remove = document.createElement("button");
    remove.className = "remove";
    remove.textContent = "×";
    remove.title = "Remove this camera";
    remove.onclick = function () {
      removePoint(point.id);
    };
    row.appendChild(remove);
  }

  return row;
}

/* ------------------------------------------------------------------
   Finding a place

   "Is there one near my station" is the question this map exists to
   answer, and until now the only way to ask it was to know where the
   station is on a dark map of London. The box under the map takes a
   place name or a postcode and moves the map there. It moves the map
   and nothing else - the cameras are not filtered by it - and it is
   everyone's: it was edit-only for a long time for no better reason
   than that it was built for adding cameras, while the policy that
   lets the browser talk to the geocoder allowed it on every page.

   The geocoder is Nominatim, OpenStreetMap's free one. Its usage
   policy asks for no more than one request a second, an identifying
   header, and no autocomplete. A browser will not let a page set the
   header, but it does send the site's own address as the referer,
   which identifies the caller as well. The rest is honoured by being
   a light caller: a search happens when you press the button or hit
   Enter, never as you type - which is why there is no search-as-you-
   type here and must not be; requests are held at least a second
   apart, with a press inside that second queued rather than dropped;
   the same words asked twice are answered from the last reply; and no
   more than five results are asked for. The search is confined to the
   London bounding box, so it will not offer you a Richmond in
   Yorkshire, and what comes back is checked against inLondon() too,
   because a promise the site makes should not rest on a parameter
   another service honours.

   If you would like the requests to be attributable to you rather
   than to the site, uncomment the email line in search() and put your
   own address in it.
   ------------------------------------------------------------------ */

var SEARCH_URL = "https://nominatim.openstreetmap.org/search";
var MINIMUM_GAP = 1000;   /* milliseconds between requests */
var lastSearchAt = 0;

/* The last words sent and what came back, so that pressing Search
   again on the same words - the commonest second press - costs the
   geocoder nothing. */
var lastQuery = null;
var lastFound = null;

function search() {
  var query = searchText.value.trim();
  var waited = Date.now() - lastSearchAt;
  var viewbox;
  var url;

  searchResults.innerHTML = "";

  if (query === "") {
    searchNote.textContent = "Type a place name or a postcode first.";
    return;
  }

  if (query === lastQuery && lastFound) {
    showResults(lastFound, query);
    return;
  }

  if (waited < MINIMUM_GAP) {
    searchNote.textContent = "One moment — searching again shortly.";
    searchButton.disabled = true;
    window.setTimeout(function () {
      searchButton.disabled = false;
      search();
    }, MINIMUM_GAP - waited);
    return;
  }

  lastSearchAt = Date.now();
  searchNote.textContent = "Searching…";
  searchButton.disabled = true;

  /* viewbox is west,north,east,south. bounded=1 makes it a hard
     restriction rather than a preference. */
  viewbox = LONDON_BOUNDS[0][1] + "," + LONDON_BOUNDS[1][0] + "," +
            LONDON_BOUNDS[1][1] + "," + LONDON_BOUNDS[0][0];

  url = SEARCH_URL +
        "?format=json" +
        "&limit=5" +
        "&bounded=1" +
        "&viewbox=" + encodeURIComponent(viewbox) +
        "&q=" + encodeURIComponent(query);
  /* url = url + "&email=you@example.com"; */

  window.fetch(url)
    .then(function (response) {
      if (!response.ok) {
        throw new Error("The search service answered with " + response.status);
      }
      return response.json();
    })
    .then(function (found) {
      var kept = [];
      var i;

      for (i = 0; i < (found || []).length; i++) {
        if (inLondon(parseFloat(found[i].lat), parseFloat(found[i].lon))) {
          kept.push(found[i]);
        }
      }

      lastQuery = query;
      lastFound = kept;
      searchButton.disabled = false;
      showResults(kept, query);
    })
    .catch(function (err) {
      searchButton.disabled = false;
      searchNote.textContent = "The search could not be completed. Check the connection and try again.";
    });
}

function showResults(found, query) {
  var i;

  if (!found || found.length === 0) {
    searchNote.textContent = "Nothing found in London for “" + query + "”. Try the name of the road, or the postcode.";
    return;
  }

  searchNote.textContent = found.length === 1
    ? "One place found. Choose it to go there."
    : "Choose one to go there.";

  for (i = 0; i < found.length; i++) {
    searchResults.appendChild(resultRow(found[i]));
  }
}

/* How close to look at what was found. Nominatim gives every result a
   bounding box - a few metres for an address, a few miles for a
   borough - and the zoom is the closest one that fits it on the map,
   so "Croydon" shows Croydon and "Croydon Road" shows the road. Not
   fitBounds(), which is a second kind of movement: this way the move
   is still moveMap(), and the one place that decides how the map
   moves stays one place. The sums are the web-mercator ones - 512
   pixels across the world at zoom 0, doubling with each level, and a
   degree of latitude stretched by the secant of the latitude. */
function zoomToFit(box) {
  var canvas = map.getCanvas();
  var width = canvas.clientWidth || 800;
  var height = canvas.clientHeight || 600;
  var south;
  var north;
  var west;
  var east;
  var spanLon;
  var spanLat;
  var zoom;

  if (!box || box.length !== 4) {
    return 15;
  }

  south = parseFloat(box[0]);
  north = parseFloat(box[1]);
  west = parseFloat(box[2]);
  east = parseFloat(box[3]);

  spanLon = Math.max(east - west, 0.0005);
  spanLat = Math.max(north - south, 0.0005) / Math.cos((north + south) / 2 * Math.PI / 180);

  zoom = Math.min(
    Math.log(width * 360 / (512 * spanLon)) / Math.LN2,
    Math.log(height * 360 / (512 * spanLat)) / Math.LN2
  ) - 0.3;   /* a little room round the edges */

  return Math.max(WIDEST_ZOOM, Math.min(17, Math.floor(zoom * 2) / 2));
}

function resultRow(result) {
  var row = document.createElement("li");
  var pick = document.createElement("button");

  pick.className = "pick";
  pick.textContent = result.display_name;

  pick.onclick = function () {
    var lat = parseFloat(result.lat);
    var lon = parseFloat(result.lon);
    var shortName = result.display_name.split(",")[0];

    moveMap(lat, lon, zoomToFit(result.boundingbox));

    searchResults.innerHTML = "";
    searchNote.textContent = "Showing " + shortName + ".";

    /* In edit mode a result also fills the coordinate boxes, rather
       than saving straight away, so you can name the camera yourself
       before it is recorded. */
    if (EDITING) {
      latInput.value = lat.toFixed(6);
      lonInput.value = lon.toFixed(6);
      if (nameInput.value.trim() === "") {
        nameInput.value = shortName;
      }
      nameInput.focus();
    }
  };

  row.appendChild(pick);
  return row;
}

/* The box is hidden in the markup until this runs, so a page without
   JavaScript - or one where map.js never got this far - shows no
   search box that does nothing. */
function setUpPlaceSearch() {
  if (!searchText || !searchButton || !searchNote || !searchResults) {
    return;
  }

  if (searchBox) {
    searchBox.hidden = false;
  }

  searchButton.onclick = search;

  searchText.onkeydown = function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      search();
    }
  };
}

setUpPlaceSearch();

/* ------------------------------------------------------------------
   Everything below here only runs in edit mode.
   ------------------------------------------------------------------ */

function startEditing() {

  document.body.className = "editing";

  /* -------- Way 1: the coordinates form -------- */

  addButton.onclick = function () {
    var lat = parseFloat(latInput.value);
    var lon = parseFloat(lonInput.value);
    var name = nameInput.value.trim();
    var note = memoInput.value.trim();

    addNote.textContent = "";

    if (name === "") {
      addNote.textContent = "Please give the camera a name.";
      nameInput.focus();
      return;
    }

    if (isNaN(lat) || isNaN(lon)) {
      addNote.textContent = "Both coordinates need to be numbers.";
      latInput.focus();
      return;
    }

    if (!inLondon(lat, lon)) {
      addNote.textContent = "That is outside London. This map covers Greater London only.";
      latInput.focus();
      return;
    }

    addPoint(lat, lon, name, note, typeInput ? typeInput.value : "vancam");

    latInput.value = "";
    lonInput.value = "";
    nameInput.value = "";
    memoInput.value = "";
    exportText.style.display = "none";
    exportNote.textContent = "";
  };

  /* -------- Way 2: searching by place name

     The search box is everyone's now and is set up further down, in
     "Finding a place". In edit mode a picked result fills the
     coordinate boxes as well as moving the map; that branch is in
     resultRow(), guarded on EDITING.
     -------- */

  /* -------- Way 3: clicking the map

     A click fills in the coordinates and waits for a name, rather than
     quietly dropping an unnamed point.
     -------- */

  map.on("click", function (event) {
    /* A click that landed on a camera has already been dealt with by
       the circle layer's own handler, which opened its popup. Taking
       the coordinates as well would be reading it as two things. */
    if (map.getLayer(DOT) &&
        map.queryRenderedFeatures(event.point, { layers: [DOT] }).length) {
      return;
    }

    latInput.value = event.lngLat.lat.toFixed(6);
    lonInput.value = event.lngLat.lng.toFixed(6);
    addNote.textContent = "Coordinates taken. Now give the camera a name.";
    nameInput.focus();
  });

  /* -------- Writing the record back out --------

     This used to write a points.js to paste over the committed one.
     It cannot any more, and should not: points.js is written by
     tools/build_points.py from data/cameras.csv, and a points.js the
     CSV did not produce fails stamp.py by design (NOTES.md, "The
     build script and the record"). So what comes out of here now is
     the CSV itself - one header, one camera per line, in the column
     order the script documents - to paste over data/cameras.csv. Then
     run the script and commit the CSV with the two files it writes.

     Every field is written, the four this page never edits included.
     The glow is weighed by deployments and the popup will cite
     source_label, so an export that dropped either would quietly
     flatten the map or strip its citations the moment anyone
     published from here. And the round trip is exact: export the
     published record untouched, paste it over the CSV, run the
     script, and git reports nothing changed - which is the check
     that this writes what the script reads.
     -------- */

  /* The columns of data/cameras.csv, in the order build_points.py
     writes them and checks the header against. The prose is last
     because it is the long one. */
  var CSV_COLUMNS = ["name", "type", "status", "lat", "lon", "approximate", "last",
                     "periods", "deployments", "source_label", "source_url", "note"];

  /* RFC 4180, the way Python's csv module writes it, because that is
     what reads the file back: a field is quoted only if it holds a
     comma, a quote or a line break, and a quote inside is doubled. A
     field quoted when it need not be would still read, but the CSV
     would then differ from what the script itself writes, and the
     round trip above is the point. */
  function csvField(value) {
    var text = value === null || value === undefined ? "" : String(value);

    if (/[",\r\n]/.test(text)) {
      return "\"" + text.replace(/"/g, "\"\"") + "\"";
    }

    return text;
  }

  /* {"2023-24": 1, "2025": 3} as the CSV writes it: 2023-24:1;2025:3,
     earliest period first. Not Object.keys() as it comes: JavaScript
     puts a key that looks like a whole number - "2025" - ahead of
     every other key whatever order it was written in, so the object
     iterates 2025 before 2023-24. The script sorts by the year a
     period starts and then by the key, and this does the same. */
  function periodsText(periods) {
    var keys;
    var items = [];
    var i;

    if (!periods) {
      return "";
    }

    keys = Object.keys(periods).sort(function (a, b) {
      var ya = parseInt(a.slice(0, 4), 10);
      var yb = parseInt(b.slice(0, 4), 10);

      if (ya !== yb) {
        return ya - yb;
      }
      return a < b ? -1 : (a > b ? 1 : 0);
    });

    for (i = 0; i < keys.length; i++) {
      items.push(keys[i] + ":" + String(periods[keys[i]]));
    }

    return items.join(";");
  }

  function csvText() {
    var lines = [CSV_COLUMNS.join(",")];
    var i;
    var point;

    for (i = 0; i < points.length; i++) {
      point = points[i];

      lines.push([
        csvField(point.name),
        csvField(point.type),
        csvField(point.status),
        csvField(point.lat.toFixed(6)),
        csvField(point.lon.toFixed(6)),
        csvField(point.approximate ? "true" : "false"),
        csvField(point.last === null ? "" : String(point.last)),
        csvField(periodsText(point.periods)),
        csvField(String(point.deployments || 1)),
        csvField(point.source_label),
        csvField(point.source_url),
        csvField(point.note)
      ].join(","));
    }

    /* A newline after the last row: the script writes one, and a diff
       that ends "no newline at end of file" is a change. */
    return lines.join("\n") + "\n";
  }

  copyButton.onclick = function () {
    exportText.value = csvText();
    exportText.style.display = "block";
    exportText.focus();
    exportText.select();

    /* execCommand is old and deprecated, but it is the one that works
       when the page has been opened straight off the disk, which is
       where you will be doing this. The modern clipboard API refuses
       to run on file:// addresses. */
    var copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (err) {
      copied = false;
    }

    if (copied) {
      exportNote.textContent = "Copied. Paste it over everything in data/cameras.csv, then run python3 tools/build_points.py.";
    } else {
      exportNote.textContent = "Selected below — press Cmd-C, paste over data/cameras.csv, then run python3 tools/build_points.py.";
    }
  };

  resetButton.onclick = function () {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch (err) {
      /* nothing to remove */
    }

    closePopup();
    points = tidy(published());
    refreshCameras();

    render();
    moveMap(LONDON_CENTRE[0], LONDON_CENTRE[1], OPENING_ZOOM);

    exportText.style.display = "none";
    exportNote.textContent = "";
    addNote.textContent = "Back to the published cameras.";
  };
}

/* ------------------------------------------------------------------
   Start up
   ------------------------------------------------------------------ */

if (EDITING) {
  var draft = loadDraft();
  points = tidy(draft === null ? published() : draft);
} else {
  points = tidy(published());
}

/* The layers are made when the style finishes loading, and take the
   list as it stands then, so there is nothing to draw here. */
drawLegend();
render();

/* ------------------------------------------------------------------
   The database, on top of the seed

   points.js is drawn first and at once, so the map is never blank
   waiting on a network. Then, if there is a Supabase project behind
   the site, the cameras table is fetched and laid over it: a row
   that came from the seed replaces its seed entry (so a camera the
   moderators have since marked non-functional shows as such), and a
   row that came from a report is added. If the fetch fails for any
   reason the seed simply stands.

   The result is kept in the browser for a few minutes. A busy day is
   many people opening the map, not many changes to it, so most of
   those visits should be answered from storage rather than the
   database. Edit mode never overlays: it is for the file, not the
   table.
   ------------------------------------------------------------------ */

var CAMERAS_KEY = STORAGE.cameras;
var CAMERAS_TTL = 5 * 60 * 1000;   /* five minutes */

/* A row's deployment count, or the fallback if it has none. A camera
   that came from a report has never been counted, so it stands at one
   like any hand-typed entry - and the glow is weighed by this, so a
   missing value has to become a number here rather than reaching the
   heatmap as null. */
function deploymentsOf(row, fallback) {
  return typeof row.deployments === "number" && row.deployments > 0
    ? row.deployments : fallback;
}

function overlayCameras(rows) {
  var bySeed = {};
  var i;
  var key;
  var row;
  var point;
  var merged = [];

  for (i = 0; i < rows.length; i++) {
    if (rows[i].seed_key) {
      bySeed[rows[i].seed_key] = rows[i];
    }
  }

  /* Seed entries, each replaced by its database row if there is one.

     The key is the one tidy() fixed on the point when it was read from
     points.js, not one worked out here: it is built from the entry's
     own name, position and type, and the position is about to be
     overwritten by the row's - and may already have been, if this is
     a second overlay. Asking the moved point for its key would be
     asking a different question, and a moved camera would then come
     up as two. */
  for (i = 0; i < points.length; i++) {
    point = points[i];
    key = point.seedKey || seedKeyOf(point);
    row = bySeed[key];
    if (row) {
      point.name = row.name;
      point.note = row.note || "";
      point.status = row.status;

      /* Where the database says it is, not where points.js does. A
         moderator can correct a pin - a van site the published record
         gives as a borough rather than a street - and the row is then
         the truth about where it stands. The seed row keeps its
         seed_key through a move, which is how it is still matched
         here, and how a re-run of seed.sql leaves the correction
         alone. */
      point.lat = Number(row.lat);
      point.lon = Number(row.lon);

      point.last = typeof row.last_seen === "number" ? row.last_seen : point.last;
      point.deployments = deploymentsOf(row, point.deployments);
      takeRecordFields(point, row);
      point.cameraId = row.id;
      delete bySeed[key];
    }
    merged.push(point);
  }

  /* Then everything that only exists in the database. A row that has
     already been laid over the list once (a second overlay from the
     cache, say) is known by its camera id and is not added twice. */
  var haveId = {};
  for (i = 0; i < merged.length; i++) {
    if (merged[i].cameraId) {
      haveId[merged[i].cameraId] = true;
    }
  }

  for (i = 0; i < rows.length; i++) {
    row = rows[i];
    if (haveId[row.id]) {
      continue;   /* matched a seed entry above, or already present */
    }
    if (row.seed_key && !bySeed[row.seed_key]) {
      continue;   /* a seed row that found its entry */
    }
    merged.push(takeRecordFields({
      id: nextId++,
      cameraId: row.id,

      /* A seed row the record no longer lists under that key - an
         entry since renamed or moved in the CSV - still carries the
         key it was written with, and a link made from the old record
         should still find it. */
      seedKey: typeof row.seed_key === "string" ? row.seed_key : null,
      name: row.name,
      note: row.note || "",
      lat: Number(row.lat),
      lon: Number(row.lon),
      type: row.type,
      status: row.status,
      last: typeof row.last_seen === "number" ? row.last_seen : null,
      deployments: deploymentsOf(row, 1),
      periods: null,
      source_label: null,
      source_url: null,
      approximate: false
    }, row));
  }

  points = merged;
  refreshCameras();
  render();

  /* A popup that was open before the database answered - a link
     opened it - is made again: its camera may now stand where the
     row says rather than where the seed did, and has an id to hang
     "Report its state" on. */
  if (popupId !== null) {
    openPopup(popupId);
  }

  /* A link to a camera by its database id could not be answered until
     now - see "Deep links" below. */
  cameraLinkSettled();
}

/* The four newer record fields, from a database row onto a point -
   but only when the row actually carries them. The columns arrived in
   migrations 001 to 003, which are written and not yet applied, and
   the fetch below does not ask for them yet either: PostgREST refuses
   the whole query if one named column is missing, and the map would
   rather draw the seed's values than nothing. So a row without the
   columns leaves the point's own values standing, whether those came
   from points.js or from the defaults above; a row with them wins,
   the way the row wins on name, note and state. periods is the tell:
   it is the first of the three migrations, so a row that has it has
   been through all of them. */
function takeRecordFields(point, row) {
  if (row.periods === undefined) {
    return point;
  }

  point.periods = row.periods && typeof row.periods === "object" ? row.periods : null;
  point.source_label = typeof row.source_label === "string" ? row.source_label : null;
  point.source_url = typeof row.source_url === "string" ? row.source_url : null;
  point.approximate = row.approximate === true;

  return point;
}

function readCachedCameras() {
  try {
    var raw = window.localStorage.getItem(CAMERAS_KEY);
    var saved = raw ? JSON.parse(raw) : null;
    if (saved && saved.at && Date.now() - saved.at < CAMERAS_TTL && Array.isArray(saved.rows)) {
      return saved.rows;
    }
  } catch (err) {
    /* nothing usable in storage */
  }
  return null;
}

function cacheCameras(rows) {
  try {
    window.localStorage.setItem(CAMERAS_KEY, JSON.stringify({ at: Date.now(), rows: rows }));
  } catch (err) {
    /* storage refused or full - the fetch still worked */
  }
}

function loadCamerasFromDatabase() {
  var cached;

  if (EDITING || typeof configured === "undefined" || !configured || !sb) {
    /* No database on this page, so no camera will ever get an id: a
       link that names one can be answered now. */
    cameraLinkSettled();
    return;
  }

  cached = readCachedCameras();
  if (cached) {
    overlayCameras(cached);
    return;
  }

  /* Only the columns the map needs, only visible rows, and a hard
     ceiling on how many. The ceiling is well above what one city
     will hold; it is there so a runaway table cannot ship megabytes
     to every visitor.

     periods, source_label, source_url and approximate are not asked
     for yet, on purpose: they arrive with migrations 001 to 003, which
     the maintainer has not run, and PostgREST refuses a whole query
     for one column it does not know. Naming them here before the
     columns exist would blank the overlay for every visitor. When the
     popup comes to draw them, the select grows and takeRecordFields()
     above already knows what to do with the answer. */
  sb.from("cameras")
    .select("id,name,note,lat,lon,type,status,last_seen,deployments,seed_key")
    .eq("visible", true)
    .limit(5000)
    .then(function (result) {
      if (result.error || !Array.isArray(result.data)) {
        /* The seed stands, and so a camera link by database id has
           no answer here; say so rather than wait for one. */
        cameraLinkSettled();
        return;
      }
      cacheCameras(result.data);
      overlayCameras(result.data);
    }, function () {
      cameraLinkSettled();
    });
}

/* ------------------------------------------------------------------
   Deep links

   "Here is the camera outside my station" is the sentence this map
   exists to let people say, and a sentence needs a link. The address
   bar carries the view, and the popup carries a link to itself.

   What the hash can say, and in what order it is read:

     #camera=<id>            open that camera's popup, and centre on it
                             close in unless a view is given as well.
     #14/51.5169/-0.0977     zoom, latitude, longitude - the form
                             OpenStreetMap uses, which people already
                             know how to read and edit by hand. The
                             zoom may be fractional.
     #51.51234,-0.12345      the old form, kept exactly as it was: a
                             spot, close in. The moderation queue
                             writes it - cameraMapHref() in account.js
                             - so a report can be checked against the
                             map without leaving the queue.

   The page writes the second form as the map moves, and adds the
   first after it - #14/51.5169/-0.0977&camera=42 - while a popup is
   open, so that copying the address bar and opening it elsewhere
   gives back the view and the popup both. It writes with
   replaceState, never pushState: every pan as a history entry would
   turn the back button into a tour of everywhere you have been, and
   a throttle holds the writes to one every quarter of a second so a
   drag does not flood the browser's own bookkeeping either. The
   hash is written only once the map has moved; a page that was
   opened plain keeps a plain address.

   Which id a camera carries. A row from the database has an id that
   is the same for everyone and survives a rename, so a camera that
   came from the database links by that. A camera the database has
   not given an id - the seed, when the database is unreachable or
   not configured - links by its seed_key, URL-encoded, which is its
   identity in the published record and is what the row carries too.
   Either resolves on load: a number against cameraId, anything else
   against seedKey. A numeric id cannot be answered until the database
   has, so it waits for the overlay and is answered then - or, if the
   database does not answer, says so under the map.

   A link is allowed to change what the map is showing - a legacy van
   site while Legacy is off, a kind switched off in the legend - because
   a link to a camera that then does not appear is a broken link. It
   switches the filter for this visit and does not save it: the link
   asked, the visitor did not.
   ------------------------------------------------------------------ */

var HASH_VIEW   = /^(\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/;
var HASH_CAMERA = /^camera=(.+)$/;
var HASH_SPOT   = /^(-?\d+\.\d+),(-?\d+\.\d+)$/;

var HASH_GAP = 250;   /* milliseconds between writes, at most one */
var hashTimer = null;
var lastWrittenHash = null;

/* A camera link the page could not answer yet, and whether answering
   it should also centre the map. */
var pendingCameraLink = null;
var pendingCameraCentre = false;

var mapNote = document.getElementById("map-note");

/* The one line under the map for what the map has to say: a link it
   could not follow, and later what Near me found or did not. Empty is
   hidden by the stylesheet, so it costs no room until it speaks. */
function sayUnderMap(text) {
  if (mapNote) {
    mapNote.textContent = text || "";
  }
}

/* What the link to a camera calls it: the database id if it has one,
   the seed key otherwise. */
function cameraLinkId(point) {
  if (point.cameraId) {
    return String(point.cameraId);
  }
  return encodeURIComponent(point.seedKey || seedKeyOf(point));
}

function pointByLinkId(value) {
  var wanted;
  var i;

  if (/^\d+$/.test(value)) {
    wanted = Number(value);
    for (i = 0; i < points.length; i++) {
      if (points[i].cameraId === wanted) {
        return points[i];
      }
    }
    return null;
  }

  try {
    wanted = decodeURIComponent(value);
  } catch (err) {
    return null;   /* not a seed key, and not a number either */
  }

  for (i = 0; i < points.length; i++) {
    if (points[i].seedKey === wanted) {
      return points[i];
    }
  }

  return null;
}

/* The hash as the map stands: the view, and the open camera if one is
   open. Five decimals is about a metre; the zoom to two places so a
   fractional zoom survives the trip and a whole one reads whole. */
function currentHash() {
  var centre = map.getCenter();
  var zoom = Math.round(map.getZoom() * 100) / 100;
  var open = popupId !== null ? pointById(popupId) : null;
  var hash = "#" + zoom + "/" + centre.lat.toFixed(5) + "/" + centre.lng.toFixed(5);

  if (open) {
    hash += "&camera=" + cameraLinkId(open);
  }

  return hash;
}

function writeHash() {
  var hash = currentHash();

  if (hash === lastWrittenHash) {
    return;
  }
  lastWrittenHash = hash;

  try {
    window.history.replaceState(null, "", hash);
  } catch (err) {
    /* A browser that refuses replaceState here - some do on file://
       - still takes a fragment through location.replace, which does
       not reload or add a history entry either. It does fire
       hashchange, which the listener below knows to ignore. */
    try {
      window.location.replace(hash);
    } catch (err2) {
      /* then the address bar simply does not follow the map */
    }
  }
}

/* One write per quarter second at most, taken at the end of the
   interval so a drag that is still going writes where it got to, not
   where it started. */
function scheduleHashWrite() {
  if (hashTimer !== null) {
    return;
  }
  hashTimer = window.setTimeout(function () {
    hashTimer = null;
    writeHash();
  }, HASH_GAP);
}

/* What the hash asks for: a view, a camera, or both. */
function readHash() {
  var raw = window.location.hash.replace(/^#/, "");
  var parts = raw.split("&");
  var wanted = { view: null, camera: null };
  var m;
  var i;

  for (i = 0; i < parts.length; i++) {
    if ((m = HASH_VIEW.exec(parts[i]))) {
      wanted.view = { zoom: parseFloat(m[1]), lat: parseFloat(m[2]), lon: parseFloat(m[3]) };
    } else if ((m = HASH_CAMERA.exec(parts[i]))) {
      wanted.camera = m[1];
    } else if ((m = HASH_SPOT.exec(parts[i]))) {
      wanted.view = { zoom: 17, lat: parseFloat(m[1]), lon: parseFloat(m[2]) };
    }
  }

  return wanted;
}

/* Bring a camera into view for a link: the filter that hides it is
   switched off for this visit, unsaved, and its popup opens. `centre`
   says whether to go there as well - not when the link gave a view of
   its own, which is the visitor's to keep. */
function showCameraLink(point, centre) {
  var changed = false;

  if (point.status === "legacy" && !showLegacy) {
    showLegacy = true;
    markLegacy();
    changed = true;
  }
  if (hiddenTypes[point.type]) {
    hiddenTypes[point.type] = false;
    drawLegend();
    changed = true;
  }
  if (changed) {
    applyFilters();
  }

  if (centre) {
    /* easeTo with no duration, not jumpTo: it is the same cut, but
       jumpTo ignores `offset`, and the popup needs its room. */
    map.easeTo({ center: lngLat(point.lat, point.lon), zoom: 17, offset: [0, popupRoom()], duration: 0 });
  }

  openPopup(point.id);
}

function followCameraLink(value, centre) {
  var point = pointByLinkId(value);

  if (!point) {
    pendingCameraLink = value;
    pendingCameraCentre = centre;
    return;
  }

  pendingCameraLink = null;
  sayUnderMap("");
  showCameraLink(point, centre);
}

/* Called once the database has answered, or once it is known that it
   will not: the moment a camera link by database id can be resolved,
   or given up on. */
function cameraLinkSettled() {
  var point;

  if (!pendingCameraLink) {
    return;
  }

  point = pointByLinkId(pendingCameraLink);
  if (point) {
    pendingCameraLink = null;
    showCameraLink(point, pendingCameraCentre);
    return;
  }

  pendingCameraLink = null;
  sayUnderMap("The camera this link points to is not on the map: it may have been taken off, or the database could not be reached.");
}

function applyHash() {
  var wanted = readHash();

  if (wanted.view && inLondon(wanted.view.lat, wanted.view.lon)) {
    /* jumpTo, not moveMap(): on load there is nothing to fly from,
       and a change to the hash by hand is a request for a place, not
       a journey. */
    map.jumpTo({
      center: lngLat(wanted.view.lat, wanted.view.lon),
      zoom: Math.max(WIDEST_ZOOM, Math.min(CLOSEST_ZOOM, wanted.view.zoom))
    });
  }

  if (wanted.camera) {
    followCameraLink(wanted.camera, !wanted.view);
  }
}

applyHash();

map.on("moveend", scheduleHashWrite);

/* A hash changed by hand, or by a link within the page, is followed
   like one the page opened with. The page's own writes do not fire
   this in most browsers, and are known by their text where they do. */
window.addEventListener("hashchange", function () {
  if (window.location.hash !== lastWrittenHash) {
    applyHash();
  }
});

/* After the hash, not before: a camera link by database id is left
   pending by applyHash() and answered the moment the database has
   spoken - which, from the cache, is inside this call. */
loadCamerasFromDatabase();

/* ------------------------------------------------------------------
   Near me

   Pressed, never automatic. NOTES.md drew the line before this was
   built: asking every visitor for their location, to centre a map,
   is a real cost to a site whose whole argument is that it collects
   nothing, and a refusal has to work as well as a yes. So the browser
   is asked only when the button is pressed, the answer lives in one
   variable for this visit, and it is written nowhere - not to
   storage, not to the database, not to the hash on its own account.
   (The hash follows the map, and after Near me the map is looking at
   where you are, as it would be after you panned there; copying the
   address then is copying a view of your street. The site does not
   do that for you.)

   What a press does: centres the map on the fix, close in or less so
   according to how good the fix is; draws where you are as a small
   ring with a dot in it and the browser's stated accuracy as a larger
   ring round that; and sorts the list by distance, with the distance
   on every row. A second press clears all of it and puts the list
   back in the order it was in.

   The rings answer to the brightness rule like everything else drawn
   on the map: nothing may be brighter than the dimmest camera dot,
   which is the fixed-camera red at 134. They are drawn in #5c5c5c,
   the dark map's own brightest grey, at 92 - the same grey on all
   three views, because it reads as a quiet outline on the dark map,
   a plain one on the light, and a neutral one over imagery, and a
   colour that changed with the view would be a fourth thing to keep
   in step. The fill is all but transparent: the ring says how far the
   browser might be wrong, and a filled disc would say "here" with a
   confidence the browser did not offer.

   What can go wrong, and what the page says: the browser has no
   geolocation, or the page is not on https, and the button is shown
   disabled with the reason in its title and label; the person says
   no, and the map says it works without; the fix does not come in
   ten seconds, or cannot be made at all, and the map says which.
   Every path leaves the map exactly as usable as before. A fix
   outside London is said to be, and the distances are shown all the
   same - "the nearest is 40 km away" is an answer.
   ------------------------------------------------------------------ */

var HERE = "cammap-here";   /* the source, and the prefix of its layers */
var HERE_COLOUR = "#5c5c5c";   /* perceived brightness 92; the rule is 134 */

/* Where Near me found you, or null. Never written anywhere else. */
var here = null;

var nearButton = document.getElementById("near-me");
var nearSort = document.querySelector('#points-sort button[data-sort="near"]');

/* Metres between two points on the ground - the haversine formula,
   on a sphere of the Earth's mean radius. Across London the error
   against the real ellipsoid is under a metre, which is less than any
   phone knows where it is to. */
function metresBetween(lat1, lon1, lat2, lon2) {
  var toRad = Math.PI / 180;
  var dLat = (lat2 - lat1) * toRad;
  var dLon = (lon2 - lon1) * toRad;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceFromHere(point) {
  return here ? metresBetween(here.lat, here.lon, point.lat, point.lon) : 0;
}

/* "120 m", "1.4 km", "12 km". Rounded to what a phone can actually
   know: the nearest ten metres close in, a tenth of a kilometre
   further out, a whole kilometre beyond ten. */
function distanceText(metres) {
  if (metres < 1000) {
    return String(Math.max(10, Math.round(metres / 10) * 10)) + " m";
  }
  if (metres < 10000) {
    return (metres / 1000).toFixed(1) + " km";
  }
  return String(Math.round(metres / 1000)) + " km";
}

/* A circle of so many metres round a point, as a polygon: 64 sides,
   which at any zoom the map allows is a circle to the eye. Degrees of
   latitude are a fixed length; degrees of longitude shrink with the
   cosine of the latitude. */
function circleAround(lat, lon, metres) {
  var ring = [];
  var dLat = metres / 111320;
  var dLon = metres / (111320 * Math.cos(lat * Math.PI / 180));
  var i;
  var angle;

  for (i = 0; i <= 64; i++) {
    angle = (i % 64) * 2 * Math.PI / 64;
    ring.push([lon + dLon * Math.cos(angle), lat + dLat * Math.sin(angle)]);
  }

  return { type: "Polygon", coordinates: [ring] };
}

function hereFeatures() {
  if (!here) {
    return collection([]);
  }

  return collection([
    {
      type: "Feature",
      properties: { kind: "accuracy" },
      geometry: circleAround(here.lat, here.lon, Math.max(here.accuracy || 0, 10))
    },
    {
      type: "Feature",
      properties: { kind: "you" },
      geometry: { type: "Point", coordinates: lngLat(here.lat, here.lon) }
    }
  ]);
}

/* Draw, or redraw, where you are. Under the camera dots and over the
   glow: the cameras are the point, and a ring round you must never
   cover one. Safe before the style has loaded - there is no layer to
   put it under, and buildOverStyle() calls this again when there is. */
function drawHere() {
  var beneath = DOT;

  /* Nothing to draw until Near me has been pressed, and nothing to
     draw it under until the cameras are there. */
  if (!here || !map.getLayer(DOT)) {
    return;
  }

  if (!map.getSource(HERE)) {
    map.addSource(HERE, { type: "geojson", data: hereFeatures() });
  } else {
    map.getSource(HERE).setData(hereFeatures());
  }

  if (map.getLayer(HERE + "-fill")) {
    return;   /* layers standing; the source above carries the change */
  }

  /* The accuracy: a faint disc and a thin ring. */
  map.addLayer({
    id: HERE + "-fill",
    type: "fill",
    source: HERE,
    filter: ["==", ["get", "kind"], "accuracy"],
    paint: { "fill-color": HERE_COLOUR, "fill-opacity": 0.08 }
  }, beneath);

  /* A dark casing under the ring, for the satellite view only: over
     a photograph a thin mid-grey line is lost, and the rule allows
     nothing brighter, so the answer is darker - the page's own black
     round the grey, the way the style's own labels wear a dark halo
     over imagery. Its opacity is set by applyView(): on the dark map
     it would be black on black, and on the light map it would turn a
     quiet grey ring into a heavy dark one. */
  map.addLayer({
    id: HERE + "-ring-casing",
    type: "line",
    source: HERE,
    filter: ["==", ["get", "kind"], "accuracy"],
    paint: { "line-color": "#0d0d0d", "line-width": 3.5, "line-opacity": hereCasingOpacity() }
  }, beneath);

  map.addLayer({
    id: HERE + "-ring",
    type: "line",
    source: HERE,
    filter: ["==", ["get", "kind"], "accuracy"],
    paint: { "line-color": HERE_COLOUR, "line-width": 1.2, "line-opacity": 0.9 }
  }, beneath);

  /* You: a small ring with a dot in it. Not a plain dot, because a
     plain grey dot is what a private camera looks like, and a hollow
     ring is what a legacy site looks like; a ring with a dot in it is
     neither. The same casing under it as under the accuracy ring. */
  map.addLayer({
    id: HERE + "-you-casing",
    type: "circle",
    source: HERE,
    filter: ["==", ["get", "kind"], "you"],
    paint: {
      "circle-radius": 7,
      "circle-opacity": 0,
      "circle-stroke-color": "#0d0d0d",
      "circle-stroke-width": 3.5,
      "circle-stroke-opacity": hereCasingOpacity()
    }
  }, beneath);

  map.addLayer({
    id: HERE + "-you-ring",
    type: "circle",
    source: HERE,
    filter: ["==", ["get", "kind"], "you"],
    paint: {
      "circle-radius": 7,
      "circle-opacity": 0,
      "circle-stroke-color": HERE_COLOUR,
      "circle-stroke-width": 1.5,
      "circle-stroke-opacity": 0.95
    }
  }, beneath);

  map.addLayer({
    id: HERE + "-you-dot",
    type: "circle",
    source: HERE,
    filter: ["==", ["get", "kind"], "you"],
    paint: { "circle-radius": 2, "circle-color": HERE_COLOUR, "circle-opacity": 0.95 }
  }, beneath);
}

/* The casing is for imagery only; see drawHere(). */
function hereCasingOpacity() {
  return view === "satellite" ? 0.85 : 0;
}

/* Called from applyView(), which runs on every change of view and
   again after every style build, so the casing follows the view. */
function applyHereView() {
  if (map.getLayer(HERE + "-ring-casing")) {
    map.setPaintProperty(HERE + "-ring-casing", "line-opacity", hereCasingOpacity());
  }
  if (map.getLayer(HERE + "-you-casing")) {
    map.setPaintProperty(HERE + "-you-casing", "circle-stroke-opacity", hereCasingOpacity());
  }
}

function removeHere() {
  var ids = [HERE + "-fill", HERE + "-ring-casing", HERE + "-ring",
             HERE + "-you-casing", HERE + "-you-ring", HERE + "-you-dot"];
  var i;

  for (i = 0; i < ids.length; i++) {
    if (map.getLayer(ids[i])) {
      map.removeLayer(ids[i]);
    }
  }
  if (map.getSource(HERE)) {
    map.removeSource(HERE);
  }
}

/* How close to look, from how sure the browser is: a fix good to
   fifty metres earns a street, one good to two kilometres earns a
   district. The zoom is chosen so the accuracy ring is a ring on the
   map and not the whole of it. */
function zoomForAccuracy(metres) {
  if (metres <= 60) { return 16; }
  if (metres <= 250) { return 15; }
  if (metres <= 800) { return 14; }
  if (metres <= 2500) { return 13; }
  return 12;
}

function markNear() {
  if (nearButton) {
    nearButton.className = here ? "toggle on" : "toggle";
    nearButton.setAttribute("aria-pressed", here ? "true" : "false");
  }
  if (nearSort) {
    nearSort.hidden = !here;
  }
}

function gotHere(lat, lon, accuracy) {
  var inside = inLondon(lat, lon);

  here = { lat: lat, lon: lon, accuracy: accuracy };

  drawHere();

  if (inside) {
    moveMap(lat, lon, zoomForAccuracy(accuracy));
  }

  /* The list: distance first, and the order it was in remembered for
     when this is cleared. */
  if (sortBy !== "near") {
    sortBefore = sortBy;
  }
  sortBy = "near";
  markNear();
  markSort();
  render();

  sayUnderMap(inside
    ? "Centred on where you are, to within about " + distanceText(accuracy) +
      ". Nothing is stored or sent. Press Near me again to clear it."
    : "You are outside London, which is all this map covers, so there is nothing to centre on; " +
      "the list is in order of distance from you all the same. Press Near me again to clear it.");
}

function clearHere() {
  here = null;
  removeHere();

  if (sortBy === "near") {
    sortBy = sortBefore;
  }
  markNear();
  markSort();
  render();
  sayUnderMap("");
}

/* Whether a request is out. The button is not disabled while it is -
   disabling a focused button drops the keyboard's focus on the floor,
   and a person who pressed Enter would find themselves nowhere - so a
   second press while waiting is simply ignored. */
var askingHere = false;

function askForHere() {
  if (askingHere) {
    return;
  }
  askingHere = true;
  nearButton.setAttribute("aria-busy", "true");
  sayUnderMap("Asking your browser where you are…");

  window.navigator.geolocation.getCurrentPosition(function (position) {
    askingHere = false;
    nearButton.removeAttribute("aria-busy");
    gotHere(position.coords.latitude, position.coords.longitude, position.coords.accuracy || 0);
  }, function (err) {
    askingHere = false;
    nearButton.removeAttribute("aria-busy");

    /* 1 is refused, 2 is could not be worked out, 3 is took too
       long; anything else is a browser being inventive. */
    if (err && err.code === 1) {
      sayUnderMap("Location refused - that is fine. The map works without it: search for a place instead, or pan to it.");
    } else if (err && err.code === 3) {
      sayUnderMap("No fix after ten seconds. Try again in a moment, or search for a place instead.");
    } else {
      sayUnderMap("Your browser could not work out where you are. The map works without it: search for a place instead.");
    }
  }, {
    /* A rough fix is enough to say which street, arrives sooner, and
       costs a phone less; ten seconds is as long as anyone waits; and
       a fix a few minutes old is the same street. */
    enableHighAccuracy: false,
    timeout: 10000,
    maximumAge: 180000
  });
}

/* The button is hidden in the markup until this has looked. Without
   geolocation, or off https - browsers refuse to ask for a location
   on a plain http page - it is shown disabled, with the reason where
   a pointer and a screen reader will each find it. */
function setUpNearMe() {
  var reason = null;

  if (!nearButton) {
    return;
  }

  if (!window.navigator.geolocation) {
    reason = "this browser will not share a location";
  } else if (window.isSecureContext === false) {
    reason = "a location can only be asked for over https";
  }

  nearButton.hidden = false;

  if (reason) {
    nearButton.disabled = true;
    nearButton.title = "Near me is not available: " + reason + ".";
    nearButton.setAttribute("aria-label", "Near me, not available: " + reason);
    return;
  }

  nearButton.onclick = function () {
    if (here) {
      clearHere();
    } else {
      askForHere();
    }
  };
}

setUpNearMe();

/* A remembered legacy setting has to show on the button straight away;
   the map side of it is applied when the layers are built. */
markLegacy();

if (legacyToggle) {
  legacyToggle.onclick = function () {
    setLegacy(!showLegacy);
  };
}

/* ---------------- finding one in the list ----------------

   The list only, on purpose - see the note above isShown(). No
   debounce: matching 182 names is nothing, and a delay between typing
   and the list answering would be felt where the work is not. */
if (pointsSearch) {
  pointsSearch.oninput = function () {
    searchTerm = pointsSearch.value.trim().toLowerCase();
    render();
  };
}

function markSort() {
  var i;
  var b;

  for (i = 0; i < sortButtons.length; i++) {
    b = sortButtons[i];
    b.className = b.getAttribute("data-sort") === sortBy ? "toggle on" : "toggle";
    b.setAttribute("aria-pressed", b.getAttribute("data-sort") === sortBy ? "true" : "false");
  }
}

for (var s = 0; s < sortButtons.length; s++) {
  sortButtons[s].onclick = (function (button) {
    return function () {
      sortBy = button.getAttribute("data-sort");
      markSort();
      saveView();
      render();
    };
  })(sortButtons[s]);
}

markSort();
markView();

for (var v = 0; v < viewButtons.length; v++) {
  viewButtons[v].onclick = (function (button) {
    return function () {
      setView(button.getAttribute("data-view"));
    };
  })(viewButtons[v]);
}

/* The kinds on offer come from CAMERA_TYPES like everything else, so
   adding a kind of camera does not mean remembering this form. A van
   site is what most entries are, so it is what the form opens on. */
fillTypeSelect(typeInput, "vancam");

if (EDITING) {
  startEditing();
}
