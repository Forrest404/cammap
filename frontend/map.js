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

     index.html?edit How you add points. The form, the place search,
                     clicking the map and the delete buttons all come
                     back, and a button writes out a new points.js for
                     you to paste in and republish.

   Edit mode is a convenience, not a lock. Anyone may open ?edit on the
   live site, and it will do them no good: their changes live in their
   own browser, disappear when they clear it, and can never reach the
   published map. The only way onto this map is to commit points.js.
   ------------------------------------------------------------------ */

var EDITING = window.location.search.indexOf("edit") !== -1;

/* Where the draft is kept while you are working. Only ever written
   in edit mode. The published points are never touched. */
var DRAFT_KEY = "cammap.draft";

/* ---------------- London, and nowhere else for now ---------------- */

var LONDON = [51.5074, -0.1278];

/* LONDON_BOUNDS and inLondon() are in frontend/shared.js, because
   account.js needs the same box for the report form. */

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
   this file - longitude first - so the two are converted here, once,
   and nowhere else. */

/* Two base styles, and the imagery view uses the dark one underneath
   because its labels are drawn white with a dark halo, which is what
   reads over a photograph.

   The light one is Bright: blue water, green parks, warm off-white
   land. Positron was tried first and is quieter still, but it is
   colourless by design - every colour in it measures zero saturation
   - and a map of a city with no green in the parks and no blue in the
   river is a poorer thing to look at. Bright has colour without
   taking any of the hues the cameras use. */
/* MAP_STYLES is in frontend/shared.js: the coordinate picker on the
   report page draws the same base map. */

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
   install and a van hotspot, and the fixed one should be on top. */
var DRAW_ORDER = { fixedcam: 5, transportcam: 4, facewatchcam: 3, vancam: 2, privatecam: 1 };

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

   showLegacy   off by default: the map shows what is in use now.
   hiddenTypes  kinds switched off in the legend. Empty means all.
   sortBy       "name" or "used" - see listed(). */
var showLegacy = false;
var hiddenTypes = {};
var sortBy = "name";

/* ---------------- satellite ----------------

   Esri's World Imagery, as raster tiles slid in under the vector
   map's labels. No key: the open tile endpoint is free for
   non-commercial use with attribution, which this is. When it is on,
   the dark map's fills and roads are hidden so the imagery shows
   through, and the labels stay on top so places can still be read.
   Everything about it lives here, so if the endpoint ever changes or
   goes away, this block is the whole of what needs touching. */

var SATELLITE = "satellite";
var SATELLITE_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
var SATELLITE_CREDIT = "Imagery &copy; Esri, Maxar, Earthstar Geographics";


/* The style's own layers that get hidden under imagery, worked out
   once when the style loads. Symbols (labels) are never in it. */
var groundLayers = [];

/* Which toggles were on last time, so a reload keeps them. Read and
   written with the same care as the draft: storage may be refused. */
var VIEW_KEY = "cammap.view";

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
      sort: sortBy
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
  center: lngLat(LONDON[0], LONDON[1]),
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
    if (id === DOT || id === SATELLITE || id.indexOf(HEAT) === 0) {
      ours.push(id);
    }
  }

  for (i = 0; i < ours.length; i++) {
    map.removeLayer(ours[i]);
  }

  for (id in sources) {
    if (sources.hasOwnProperty(id) &&
        (id === SOURCE || id === SATELLITE || id.indexOf(SOURCE + "-heat-") === 0)) {
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

  /* Everything that is not a label is ground: it goes under imagery. */
  groundLayers = [];
  for (i = 0; i < layers.length; i++) {
    if (layers[i].type !== "symbol") {
      groundLayers.push(layers[i].id);
    }
  }

  /* The imagery sits directly above the style's background layer, so
     it is under every road and label but over the plain colour. */
  map.addSource(SATELLITE, {
    type: "raster",
    tiles: [SATELLITE_TILES],
    tileSize: 256,
    maxzoom: 19,
    attribution: SATELLITE_CREDIT
  });

  map.addLayer({
    id: SATELLITE,
    type: "raster",
    source: SATELLITE,
    layout: { visibility: "none" },
    paint: { "raster-opacity": 1 }
  }, layers.length > 1 ? layers[1].id : undefined);

  addCameras(firstLabel);
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

  applyLegacyFilter();

  bindCameraHandlers();
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

  map.on("click", DOT, function (event) {
    openPopup(event.features[0].properties.id);
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

  for (i = 0; i < list.length; i++) {
    entry = list[i];

    if (!entry || typeof entry.name !== "string") {
      continue;
    }

    clean.push({
      id: nextId++,
      name: entry.name,
      note: typeof entry.note === "string" ? entry.note : "",
      lat: parseFloat(entry.lat),
      lon: parseFloat(entry.lon),

      /* A hand-typed entry may leave these out. */
      type: typeof entry.type === "string" ? entry.type : "vancam",
      status: typeof entry.status === "string" ? entry.status : "active",
      last: typeof entry.last === "number" ? entry.last : null,

      /* How many times a source records this spot being used. The glow
         is weighed by it, so a place a van was sent to twenty times
         reads hotter than one it visited once. Anything without a
         count - a shop, a fixed camera, a hand-typed entry - is one. */
      deployments: typeof entry.deployments === "number" && entry.deployments > 0
        ? entry.deployments : 1
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
    name: name,
    note: note,
    lat: lat,
    lon: lon,
    type: type || "vancam",
    status: "active",
    last: null,

    /* One, the same default tidy() gives a hand-typed entry: a spot
       nobody has counted deployments at has been used once. */
    deployments: 1
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

  if (map.getLayer(SATELLITE)) {
    map.setLayoutProperty(SATELLITE, "visibility", imagery ? "visible" : "none");
  }

  /* Under imagery the style's own ground is hidden and only its labels
     are kept, so it reads as a photograph with names on it. */
  for (i = 0; i < groundLayers.length; i++) {
    if (map.getLayer(groundLayers[i])) {
      map.setLayoutProperty(groundLayers[i], "visibility", imagery ? "none" : "visible");
    }
  }

  if (map.getLayer(DOT)) {
    paint = dotPaint();
    for (i = 0; i < VIEW_PAINT.length; i++) {
      map.setPaintProperty(DOT, VIEW_PAINT[i], paint[VIEW_PAINT[i]]);
    }
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
    }
  }

  return { all: all, byColour: byColour };
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
}

function closePopup() {
  if (popup) {
    popup.remove();
  }
  popup = null;
  popupId = null;
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
            try { window.localStorage.removeItem("cammap.cameras"); } catch (e) {}
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

  go.appendChild(coords);

  go.onclick = function () {
    map.flyTo({ center: lngLat(point.lat, point.lon), zoom: 17, speed: 1.6 });
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

     This uses Nominatim, OpenStreetMap's free geocoder. Its usage
     policy asks callers for an identifying User-Agent header, but a
     browser will not let a page set that header, so it cannot be
     honoured literally from a static file. Instead the page is a light
     caller: a search only ever happens when you press the button or hit
     Enter, never as you type; requests are held at least a second
     apart; and no more than five results are asked for. The search is
     also confined to the London bounding box, so it will not offer you
     a Richmond in Yorkshire.

     If you would like your requests to be attributable, uncomment the
     email line below and put your own address in it.
     -------- */

  var SEARCH_URL = "https://nominatim.openstreetmap.org/search";
  var MINIMUM_GAP = 1000;   /* milliseconds between requests */
  var lastSearchAt = 0;

  function search() {
    var query = searchText.value.trim();
    var waited = Date.now() - lastSearchAt;

    searchResults.innerHTML = "";

    if (query === "") {
      searchNote.textContent = "Type a place name first.";
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
    var viewbox = LONDON_BOUNDS[0][1] + "," + LONDON_BOUNDS[1][0] + "," +
                  LONDON_BOUNDS[1][1] + "," + LONDON_BOUNDS[0][0];

    var url = SEARCH_URL +
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
        searchButton.disabled = false;
        showResults(found, query);
      })
      .catch(function (err) {
        searchButton.disabled = false;
        searchNote.textContent = "The search could not be completed.";
      });
  }

  function showResults(found, query) {
    var i;

    if (!found || found.length === 0) {
      searchNote.textContent = "Nothing found in London for “" + query + "”.";
      return;
    }

    searchNote.textContent = "Choose one to fill in the form below.";

    for (i = 0; i < found.length; i++) {
      searchResults.appendChild(resultRow(found[i]));
    }
  }

  function resultRow(result) {
    var row = document.createElement("li");
    var pick = document.createElement("button");

    pick.className = "pick";
    pick.textContent = result.display_name;

    /* Picking a result fills the form rather than saving straight away,
       so you can name the camera yourself before it is recorded. */
    pick.onclick = function () {
      var shortName = result.display_name.split(",")[0];

      latInput.value = parseFloat(result.lat).toFixed(6);
      lonInput.value = parseFloat(result.lon).toFixed(6);
      if (nameInput.value.trim() === "") {
        nameInput.value = shortName;
      }

      map.flyTo({
      center: lngLat(parseFloat(result.lat), parseFloat(result.lon)),
      zoom: 15,
      speed: 1.6
    });

      searchResults.innerHTML = "";
      searchNote.textContent = "";
      nameInput.focus();
    };

    row.appendChild(pick);
    return row;
  }

  searchButton.onclick = search;

  searchText.onkeydown = function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      search();
    }
  };

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

  /* -------- Writing points.js back out -------- */

  function fileText() {
    var lines = [];
    var i;
    var point;

    lines.push("/* ------------------------------------------------------------------");
    lines.push("   cammap - the cameras on the published map");
    lines.push("");
    lines.push("   Written out by index.html?edit. Paste this over everything in");
    lines.push("   points.js, then commit and push to publish it.");
    lines.push("   ------------------------------------------------------------------ */");
    lines.push("");
    lines.push("var POINTS = [");

    for (i = 0; i < points.length; i++) {
      point = points[i];

      lines.push("");
      lines.push("  {");
      lines.push("    name: " + JSON.stringify(point.name) + ",");
      lines.push("    note: " + JSON.stringify(point.note) + ",");
      lines.push("    lat: " + point.lat.toFixed(6) + ",");
      lines.push("    lon: " + point.lon.toFixed(6) + ",");
      lines.push("    type: " + JSON.stringify(point.type) + ",");
      lines.push("    status: " + JSON.stringify(point.status) + ",");
      lines.push("    last: " + (point.last === null ? "null" : String(point.last)) + ",");

      /* Written out even though nothing on this page edits it. The glow
         is weighed by it, so leaving it off here would quietly flatten
         the map the moment anyone published from ?edit. */
      lines.push("    deployments: " + String(point.deployments || 1));
      lines.push(i === points.length - 1 ? "  }" : "  },");
    }

    lines.push("");
    lines.push("];");
    lines.push("");

    return lines.join("\n");
  }

  copyButton.onclick = function () {
    exportText.value = fileText();
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
      exportNote.textContent = "Copied. Paste it over everything in points.js.";
    } else {
      exportNote.textContent = "Selected below — press Cmd-C, then paste over points.js.";
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
    map.flyTo({ center: lngLat(LONDON[0], LONDON[1]), zoom: OPENING_ZOOM, speed: 1.6 });

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

var CAMERAS_KEY = "cammap.cameras";
var CAMERAS_TTL = 5 * 60 * 1000;   /* five minutes */

/* seed_key is how a database row says which seed entry it is. It is
   built the same way here as in the build script, so they agree. */
function seedKeyOf(point) {
  return point.name + "|" + point.lat.toFixed(6) + "|" + point.lon.toFixed(6) + "|" + point.type;
}

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
  var row;
  var point;
  var merged = [];

  for (i = 0; i < rows.length; i++) {
    if (rows[i].seed_key) {
      bySeed[rows[i].seed_key] = rows[i];
    }
  }

  /* Seed entries, each replaced by its database row if there is one. */
  for (i = 0; i < points.length; i++) {
    point = points[i];
    row = bySeed[seedKeyOf(point)];
    if (row) {
      point.name = row.name;
      point.note = row.note || "";
      point.status = row.status;
      point.last = typeof row.last_seen === "number" ? row.last_seen : point.last;
      point.deployments = deploymentsOf(row, point.deployments);
      point.cameraId = row.id;
      delete bySeed[seedKeyOf(point)];
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
    merged.push({
      id: nextId++,
      cameraId: row.id,
      name: row.name,
      note: row.note || "",
      lat: Number(row.lat),
      lon: Number(row.lon),
      type: row.type,
      status: row.status,
      last: typeof row.last_seen === "number" ? row.last_seen : null,
      deployments: deploymentsOf(row, 1)
    });
  }

  points = merged;
  refreshCameras();
  render();
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
     to every visitor. */
  sb.from("cameras")
    .select("id,name,note,lat,lon,type,status,last_seen,deployments,seed_key")
    .eq("visible", true)
    .limit(5000)
    .then(function (result) {
      if (result.error || !Array.isArray(result.data)) {
        return;
      }
      cacheCameras(result.data);
      overlayCameras(result.data);
    });
}

loadCamerasFromDatabase();

/* index.html#51.51234,-0.12345 opens on that spot, close in. The
   moderation queue links here so a report can be checked against
   the map without leaving the queue. */
(function () {
  var m = /^#(-?\d+\.\d+),(-?\d+\.\d+)$/.exec(window.location.hash);
  var lat;
  var lon;

  if (!m) {
    return;
  }

  lat = parseFloat(m[1]);
  lon = parseFloat(m[2]);

  if (inLondon(lat, lon)) {
    map.jumpTo({ center: lngLat(lat, lon), zoom: 17 });
  }
})();

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
