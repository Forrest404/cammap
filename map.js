/* ------------------------------------------------------------------
   cammap - map page
   Plain browser JavaScript. No build step. MapLibre GL draws the
   map; OpenFreeMap serves the vector tiles. Neither needs a key.

   The page has two modes.

     index.html      What the public sees. The points come from
                     points.js and nothing on the page can change them.

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
   markers holds the MapLibre marker for each one, keyed by that id. */
var points = [];
var markers = {};
var nextId = 1;

/* ---------------- the map ----------------

   OpenFreeMap's "dark" style. Vector tiles rather than pictures of a
   map, which is why this one is quiet: it carries place and road names
   and nothing else, no shop pins or clutter, and it is drawn dark at
   source instead of being inverted after the fact.

   MapLibre counts coordinates the other way round from the rest of
   this file - longitude first - so the two are converted here, once,
   and nowhere else. */

var MAP_STYLE = "https://tiles.openfreemap.org/styles/dark";

var MARKER_COLOUR = "#cf6a58";   /* matches --accent in style.css */

function lngLat(lat, lon) {
  return [lon, lat];
}

var map = new maplibregl.Map({
  container: "map",
  style: MAP_STYLE,
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

/* The one-way arrows are the last of the clutter, and with vector
   tiles they can simply be taken off. */
map.on("load", function () {
  var noisy = ["road_oneway", "road_oneway_opposite"];
  var i;

  for (i = 0; i < noisy.length; i++) {
    if (map.getLayer(noisy[i])) {
      map.removeLayer(noisy[i]);
    }
  }
});

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
      lon: parseFloat(entry.lon)
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

function addPoint(lat, lon, name, note) {
  var point = {
    id: nextId++,
    name: name,
    note: note,
    lat: lat,
    lon: lon
  };

  points.push(point);
  drawMarker(point);
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

  if (markers[id]) {
    markers[id].remove();
    delete markers[id];
  }

  saveDraft();
  render();
}

function drawMarker(point) {
  var popup = new maplibregl.Popup({ offset: 26, closeButton: true })
    .setDOMContent(popupFor(point));

  var marker = new maplibregl.Marker({ color: MARKER_COLOUR })
    .setLngLat(lngLat(point.lat, point.lon))
    .setPopup(popup)
    .addTo(map);

  markers[point.id] = marker;
}

/* MapLibre only offers a toggle, so opening an already-open popup
   would close it. */
function showPopup(marker) {
  var popup = marker.getPopup();

  if (popup && !popup.isOpen()) {
    marker.togglePopup();
  }
}

/* Built as elements rather than as a string of HTML, so a name or a
   note containing angle brackets is shown as typed. */
function popupFor(point) {
  var box = document.createElement("div");

  var title = document.createElement("strong");
  title.textContent = point.name;
  box.appendChild(title);

  if (point.note) {
    box.appendChild(document.createElement("br"));
    box.appendChild(document.createTextNode(point.note));
  }

  box.appendChild(document.createElement("br"));
  var coords = document.createElement("span");
  coords.textContent = point.lat.toFixed(4) + ", " + point.lon.toFixed(4);
  box.appendChild(coords);

  return box;
}

/* ------------------------------------------------------------------
   The list of points

   Everybody gets the list and can click a row to be taken there. Only
   edit mode gets the delete buttons.
   ------------------------------------------------------------------ */

function render() {
  var i;

  pointsList.innerHTML = "";

  if (points.length === 0) {
    pointsEmpty.style.display = "block";
    return;
  }
  pointsEmpty.style.display = "none";

  for (i = 0; i < points.length; i++) {
    pointsList.appendChild(rowFor(points[i]));
  }
}

function rowFor(point) {
  var row = document.createElement("li");

  /* The point itself: clicking it takes the map there. */
  var go = document.createElement("button");
  go.className = "goto";
  go.title = "Show on the map";

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
    map.flyTo({ center: lngLat(point.lat, point.lon), zoom: 15, speed: 1.6 });
    if (markers[point.id]) {
      showPopup(markers[point.id]);
    }
  };

  row.appendChild(go);

  if (EDITING) {
    var remove = document.createElement("button");
    remove.className = "remove";
    remove.textContent = "×";
    remove.title = "Remove this point";
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
      addNote.textContent = "Please give the place a name.";
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

    addPoint(lat, lon, name, note);

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
       so you can name the place yourself before it is recorded. */
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
    latInput.value = event.lngLat.lat.toFixed(6);
    lonInput.value = event.lngLat.lng.toFixed(6);
    addNote.textContent = "Coordinates taken. Now give the place a name.";
    nameInput.focus();
  });

  /* -------- Writing points.js back out -------- */

  function fileText() {
    var lines = [];
    var i;
    var point;

    lines.push("/* ------------------------------------------------------------------");
    lines.push("   cammap - the points on the published map");
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
      lines.push("    lon: " + point.lon.toFixed(6));
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
    var i;

    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch (err) {
      /* nothing to remove */
    }

    for (i in markers) {
      markers[i].remove();
    }
    markers = {};

    points = tidy(published());

    for (i = 0; i < points.length; i++) {
      drawMarker(points[i]);
    }

    render();
    map.flyTo({ center: lngLat(LONDON[0], LONDON[1]), zoom: OPENING_ZOOM, speed: 1.6 });

    exportText.style.display = "none";
    exportNote.textContent = "";
    addNote.textContent = "Back to the published points.";
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

for (var n = 0; n < points.length; n++) {
  drawMarker(points[n]);
}

render();

if (EDITING) {
  startEditing();
}
