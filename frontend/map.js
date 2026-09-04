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

/* South-west corner, then north-east: Heathrow across to Upminster,
   Coulsdon up to Enfield. All 32 boroughs and the City. */
var LONDON_BOUNDS = [[51.28, -0.51], [51.70, 0.33]];

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
var MAP_STYLES = {
  dark:  "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/bright"
};

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

/* One colour per kind of camera, matching --t-* in style.css. Colour
   always means what a thing IS. Whether it works now is said by the
   fill instead: an active camera is a solid dot, a legacy one is a
   hollow ring in the same colour, and a non-functional one is filled
   in a colour of its own regardless of type. The legend under the map
   is built from this table, so the two cannot drift apart. */
var TYPES = [
  { type: "fixedcam",     colour: "#cf6a58", label: "Fixed LFR camera" },
  { type: "vancam",       colour: "#e0a458", label: "LFR van site" },
  { type: "transportcam", colour: "#6aa8d8", label: "Transport police" },
  { type: "facewatchcam", colour: "#7bbf7b", label: "Shop (Facewatch)" },
  { type: "privatecam",   colour: "#8a8a8a", label: "Private" }
];

var NONFUNCTIONAL_COLOUR = "#b58bd6";

/* Which dot wins when two share a spot. Croydon is both a fixed
   install and a van hotspot, and the fixed one should be on top. */
var DRAW_ORDER = { fixedcam: 5, transportcam: 4, facewatchcam: 3, vancam: 2, privatecam: 1 };

function colourOf(type) {
  var i;
  for (i = 0; i < TYPES.length; i++) {
    if (TYPES[i].type === type) {
      return TYPES[i].colour;
    }
  }
  return TYPES[1].colour;   /* an unknown type draws as a van site */
}

/* The colour a point glows with is the colour its dot is drawn with:
   a non-functional one in its own colour whatever its type, otherwise
   the type colour. Each such colour gets its own heatmap layer, built
   below, because a heatmap can only ever carry one ramp and we want
   the glow of a blue point to be blue, not the shared orange. */
function glowColourOf(point) {
  return point.status === "nonfunctional" ? NONFUNCTIONAL_COLOUR : colourOf(point.type);
}

/* One heatmap layer per possible glow colour - non-functional's own
   colour first, then one per type - so a camera glows in the exact
   colour its dot is drawn in. Each gets its own source below, because
   MapLibre will not draw two heatmaps over the same source. */
function glowGroups() {
  var groups = [{ colour: NONFUNCTIONAL_COLOUR }];
  var i;

  for (i = 0; i < TYPES.length; i++) {
    groups.push({ colour: TYPES[i].colour });
  }
  return groups;
}

/* Off by default: the map shows what is in use now. */
var showLegacy = false;

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
    }
  } catch (err) {
    /* nothing saved, or storage refused - defaults stand */
  }
}

function saveView() {
  try {
    window.localStorage.setItem(VIEW_KEY, JSON.stringify({
      legacy: showLegacy,
      view: view
    }));
  } catch (err) {
    /* storage refused - the toggles still work for this visit */
  }
}

loadView();

var HEAT_FULL = 12.5;   /* at or below this the glow is at full strength */
var HEAT_GONE = 15;     /* by here it has gone entirely */

function lngLat(lat, lon) {
  return [lon, lat];
}

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

/* How much to lift each kind of colour. The style is drawn for a pure
   black page and against this one the roads all but vanish, so the
   palette is raised once, here, rather than by filtering the canvas on
   every frame. Halos go the other way - darker - so labels keep their
   edge against the brighter roads underneath. */
var LIFT = {
  line: 2.6,
  fill: 1.9,
  background: 1.6,
  text: 1.75,
  halo: 0.55
};

/* An off-screen scrap of the page, used to let the browser turn
   whatever notation the style happens to use - #abc, rgb(), hsl() -
   into numbers that can be scaled. */
var swatch = document.createElement("div");
swatch.style.cssText = "position:fixed;left:-9999px;top:0;";

function lift(colour, factor) {
  var parts;
  var scale = function (v) {
    return Math.min(255, Math.round(v * factor));
  };

  swatch.style.color = "";
  swatch.style.color = colour;
  parts = window.getComputedStyle(swatch).color.match(/[\d.]+/g);

  if (!parts) {
    return null;
  }

  return "rgba(" + scale(parts[0]) + "," + scale(parts[1]) + "," +
         scale(parts[2]) + "," + (parts[3] === undefined ? 1 : parts[3]) + ")";
}

/* A heatmap's colour ramp, made in the glow's own colour. Density
   0 is the colour with no alpha at all - that stop being anything but
   transparent would wash the whole map - and each higher stop both
   thickens and lifts the colour toward white, so the centre of a
   crowded spot reads as a brighter version of the type colour rather
   than turning white as the old single ramp did. */
function heatRamp(hex) {
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  var at  = [0, 0.20, 0.45, 0.75, 1];

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

/* Which paint property carries the colour, for each kind of layer. */
var COLOUR_OF = {
  line: ["line-color", "line"],
  fill: ["fill-color", "fill"],
  background: ["background-color", "background"]
};

function repaint(layer) {
  var pair = COLOUR_OF[layer.type];
  var paint = layer.paint || {};
  var lifted;

  if (pair && typeof paint[pair[0]] === "string") {
    lifted = lift(paint[pair[0]], LIFT[pair[1]]);
    if (lifted) {
      map.setPaintProperty(layer.id, pair[0], lifted);
    }
  }

  if (layer.type !== "symbol") {
    return;
  }

  if (typeof paint["text-color"] === "string") {
    lifted = lift(paint["text-color"], LIFT.text);
    if (lifted) {
      map.setPaintProperty(layer.id, "text-color", lifted);
    }
  }

  if (typeof paint["text-halo-color"] === "string") {
    lifted = lift(paint["text-halo-color"], LIFT.halo);
    if (lifted) {
      map.setPaintProperty(layer.id, "text-halo-color", lifted);
    }
  }
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
function clearOurLayersAndSources() {
  var ours = [SATELLITE, DOT, HEAT].concat(heatLayers.map(function (g) { return g.id; }));
  var sources = [SOURCE, SATELLITE];
  var i;

  for (i = 0; i < 8; i++) {
    ours.push(HEAT + "-" + i);
    sources.push(SOURCE + "-heat-" + i);
  }

  for (i = 0; i < ours.length; i++) {
    if (map.getLayer(ours[i])) {
      map.removeLayer(ours[i]);
    }
  }
  for (i = 0; i < sources.length; i++) {
    if (map.getSource(sources[i])) {
      map.removeSource(sources[i]);
    }
  }
  heatLayers = [];
}

function buildOverStyle() {
  var layers;
  var i;

  clearOurLayersAndSources();

  /* The one-way arrows are the last of the clutter, and with vector
     tiles they can simply be taken off. */
  var noisy = ["road_oneway", "road_oneway_opposite"];

  for (i = 0; i < noisy.length; i++) {
    if (map.getLayer(noisy[i])) {
      map.removeLayer(noisy[i]);
    }
  }

  /* The lift below is a correction for the dark style, which is drawn
     for a pure black page and all but disappears against this one. The
     light style needs no such help - brightening it would only wash it
     out - so it is left as its authors drew it. */
  layers = map.getStyle().layers;

  if (!isLight()) {
    document.body.appendChild(swatch);
    for (i = 0; i < layers.length; i++) {
      repaint(layers[i]);
    }
    swatch.remove();
  }

  /* The first symbol layer is the bottom of the map's own labelling.
     The glow is slid in underneath it. */
  var firstLabel;

  for (i = 0; i < layers.length; i++) {
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

function addCameras(beneath) {
  map.addSource(SOURCE, { type: "geojson", data: cameraFeatures() });

  /* One heat layer per glow colour, so the glow under a point is the
     point's own colour. They share every property but the ramp and the
     filter. */
  var groups = glowGroups();
  var g;
  var intensity = ["interpolate", ["linear"], ["zoom"],
    WIDEST_ZOOM, 1.0,
    HEAT_GONE, 1.5];
  /* Wide enough that neighbours down the same high street pool into
     one patch, and no wider. It was twice this for a day and the
     result was a wash of colour with the city lost underneath it. */
  var radius = ["interpolate", ["linear"], ["zoom"],
    WIDEST_ZOOM, 25,
    HEAT_GONE, 38];
  var opacity = ["interpolate", ["linear"], ["zoom"],
    HEAT_FULL, 0.85,
    HEAT_GONE, 0];

  heatLayers = [];

  for (g = 0; g < groups.length; g++) {
    heatLayers.push({
      id: HEAT + "-" + g,
      source: SOURCE + "-heat-" + g,
      colour: groups[g].colour
    });

    /* A heatmap may only have one ramp, and MapLibre will not draw two
       heatmaps over the same source, so every colour gets its own
       source holding just its cameras. */
    map.addSource(SOURCE + "-heat-" + g, {
      type: "geojson",
      data: cameraFeatures(function (point) {
        return isShown(point) && glowColourOf(point) === groups[g].colour;
      })
    });

    map.addLayer({
      id: HEAT + "-" + g,
      type: "heatmap",
      source: SOURCE + "-heat-" + g,
      maxzoom: HEAT_GONE,
      paint: {
        "heatmap-weight": 1,

        /* This is the hotspot map as well as the glow. There used to
           be a second heatmap under these, in the site accent over
           every camera at once, to do the zoomed-out job - but a
           single colour over everything only says "cameras here",
           and washed out the colours underneath it besides. One
           camera on a quiet road is still only an ember; it is where
           they gather that lights up, and now the light is the
           colour of what gathered. */
        "heatmap-intensity": intensity,
        "heatmap-radius": radius,

        /* The ramp is built from this layer's own colour, the first
           stop fully transparent or the whole map would be washed over
           rather than only the places with cameras in. */
        "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"]].concat(heatRamp(groups[g].colour)),

        "heatmap-opacity": opacity
      }
    }, beneath);
  }

  map.addLayer({
    id: DOT,
    type: "circle",
    source: SOURCE,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"],
        WIDEST_ZOOM, 2.5,
        14, 4,
        CLOSEST_ZOOM, 7],

      "circle-color": typeColourExpression(),

      /* A legacy site is a ring: nearly no fill, a firm outline in its
         own colour. An active one is solid. */
      "circle-opacity": ["case", ["==", ["get", "status"], "legacy"], 0.12, 0.85],

      "circle-stroke-color": ["case",
        ["==", ["get", "status"], "legacy"], typeColourExpression(),
        "#0d0d0d"],

      /* Active dots get a hairline of the page background so two
         neighbours read as two once you are close; zoomed out it goes
         so a crowd can become a mass. Legacy rings keep their outline
         at every zoom, or they would vanish. MapLibre insists "zoom"
         be the outermost expression, so the status test sits inside
         each stop rather than around the interpolation. */
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"],
        13, ["case", ["==", ["get", "status"], "legacy"], 1.2, 0],
        15, ["case", ["==", ["get", "status"], "legacy"], 1.2, 1]],
      "circle-stroke-opacity": ["case", ["==", ["get", "status"], "legacy"], 0.9, 0.6]
    },
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

function inLondon(lat, lon) {
  return lat >= LONDON_BOUNDS[0][0] && lat <= LONDON_BOUNDS[1][0] &&
         lon >= LONDON_BOUNDS[0][1] && lon <= LONDON_BOUNDS[1][1];
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
      last: typeof entry.last === "number" ? entry.last : null
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
    last: null
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

/* The paint expression for "what colour is this dot": non-functional
   overrides everything, otherwise the type decides. */
function typeColourExpression() {
  var match = ["match", ["get", "type"]];
  var i;

  for (i = 0; i < TYPES.length; i++) {
    match.push(TYPES[i].type, TYPES[i].colour);
  }
  match.push(TYPES[1].colour);   /* fallback: the van colour */

  return ["case", ["==", ["get", "status"], "nonfunctional"], NONFUNCTIONAL_COLOUR, match];
}

/* Both layers and the list obey the same rule, so the glow can never
   hint at a camera the list does not admit to. */
function isShown(point) {
  return showLegacy || point.status !== "legacy";
}

function applyLegacyFilter() {
  var filter = showLegacy ? null : ["!=", ["get", "status"], "legacy"];

  if (map.getLayer(DOT)) {
    map.setFilter(DOT, filter);
  }
}

function setLegacy(on) {
  showLegacy = on;
  applyLegacyFilter();

  /* The dots hide legacy cameras with a filter above; the glow sources
     are picked by hand, so toggling here rebuilds them too. */
  refreshCameras();
  render();
  saveView();

  if (legacyToggle) {
    legacyToggle.className = on ? "toggle on" : "toggle";
    legacyToggle.setAttribute("aria-pressed", on ? "true" : "false");
  }
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

function applyView() {
  var i;
  var imagery = view === "satellite";
  var outlined = imagery || isLight();

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
    map.setPaintProperty(DOT, "circle-stroke-color", dotRingColour());
    map.setPaintProperty(DOT, "circle-stroke-width", outlined
      ? ["case", ["==", ["get", "status"], "legacy"], 1.6, 1.5]
      : ["interpolate", ["linear"], ["zoom"],
          13, ["case", ["==", ["get", "status"], "legacy"], 1.2, 0],
          15, ["case", ["==", ["get", "status"], "legacy"], 1.2, 1]]);
    map.setPaintProperty(DOT, "circle-stroke-opacity", outlined
      ? 0.95
      : ["case", ["==", ["get", "status"], "legacy"], 0.9, 0.6]);

    /* A legacy ring is the type colour with almost no fill. On the
       light map that is a pale ring on pale ground, so it is filled
       a little more firmly. */
    map.setPaintProperty(DOT, "circle-opacity",
      ["case", ["==", ["get", "status"], "legacy"], isLight() ? 0.30 : 0.12, 0.85]);
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

/* The legend is drawn from TYPES so it always matches the paint. */
function drawLegend() {
  var i;
  var item;
  var swatch;

  if (!legend) {
    return;
  }

  legend.innerHTML = "";

  for (i = 0; i < TYPES.length; i++) {
    item = document.createElement("li");
    swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = TYPES[i].colour;
    item.appendChild(swatch);
    item.appendChild(document.createTextNode(TYPES[i].label));
    legend.appendChild(item);
  }

  item = document.createElement("li");
  swatch = document.createElement("span");
  swatch.className = "swatch";
  swatch.style.background = NONFUNCTIONAL_COLOUR;
  item.appendChild(swatch);
  item.appendChild(document.createTextNode("Non-functional"));
  legend.appendChild(item);

  item = document.createElement("li");
  swatch = document.createElement("span");
  swatch.className = "swatch hollow";
  swatch.style.borderColor = TYPES[1].colour;
  item.appendChild(swatch);
  item.appendChild(document.createTextNode("Legacy (no longer in use)"));
  legend.appendChild(item);
}

/* Build one feature per point. keep decides whether the point is in
   this particular collection, so the same list can be split up any
   way (all of it, or just one glow colour). */
function cameraFeatures(keep) {
  var features = [];
  var i;

  for (i = 0; i < points.length; i++) {
    if (keep && !keep(points[i])) {
      continue;
    }
    features.push({
      type: "Feature",
      properties: {
        id: points[i].id,
        type: points[i].type,
        status: points[i].status,
        order: DRAW_ORDER[points[i].type] || 0
      },
      geometry: {
        type: "Point",
        coordinates: lngLat(points[i].lat, points[i].lon)
      }
    });
  }

  return { type: "FeatureCollection", features: features };
}

/* Every change to the list ends here: the dot source takes the whole
   list, and each glow source takes only the cameras that glow in its
   colour. Before the style has loaded there is nothing to write to,
   and the load handler fills the sources it makes from the list as it
   stands, so there is nothing to do. */
function refreshCameras() {
  var source = map.getSource(SOURCE);
  var i;
  var glow;
  var glowSource;

  if (source) {
    source.setData(cameraFeatures());
  }

  for (i = 0; i < heatLayers.length; i++) {
    glow = heatLayers[i];
    glowSource = map.getSource(glow.source);
    if (glowSource) {
      glowSource.setData(cameraFeatures(function (point) {
        return isShown(point) && glowColourOf(point) === glow.colour;
      }));
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
  var i;
  var label = "Camera";

  for (i = 0; i < TYPES.length; i++) {
    if (TYPES[i].type === point.type) {
      label = TYPES[i].label;
    }
  }

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

function render() {
  var i;

  var shown = 0;

  pointsList.innerHTML = "";

  for (i = 0; i < points.length; i++) {
    if (isShown(points[i])) {
      pointsList.appendChild(rowFor(points[i]));
      shown++;
    }
  }

  pointsEmpty.style.display = shown === 0 ? "block" : "none";
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
      lines.push("    last: " + (point.last === null ? "null" : String(point.last)));
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
      last: typeof row.last_seen === "number" ? row.last_seen : null
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
    .select("id,name,note,lat,lon,type,status,last_seen,seed_key")
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
loadCamerasFromDatabase();

/* A remembered legacy setting has to show on the button straight away;
   the map side of it is applied when the layers are built. */
if (legacyToggle) {
  legacyToggle.className = showLegacy ? "toggle on" : "toggle";
  legacyToggle.setAttribute("aria-pressed", showLegacy ? "true" : "false");
  legacyToggle.onclick = function () {
    setLegacy(!showLegacy);
  };
}

markView();

for (var v = 0; v < viewButtons.length; v++) {
  viewButtons[v].onclick = (function (button) {
    return function () {
      setView(button.getAttribute("data-view"));
    };
  })(viewButtons[v]);
}

if (EDITING) {
  startEditing();
}
