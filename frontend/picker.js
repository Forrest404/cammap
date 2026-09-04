/* ------------------------------------------------------------------
   cammap - the coordinate picker on the report page

   Plain browser JavaScript, same rules as the rest. Loaded only on
   report.html, because it is the only page that needs MapLibre
   besides the map itself.

   Why it exists: the report form used to ask for a latitude and a
   longitude in two number boxes. Almost nobody can look at
   51.5169, -0.0977 and know whether that is the right corner, or
   notice that they have typed a digit wrong and put the camera in the
   Thames. So the form now shows the same map the site is built on,
   with a pin you drag. The boxes are still there and still work -
   typing in them moves the pin, dragging the pin fills them in - so a
   person who has exact coordinates from somewhere else is not made to
   fish for them on a map.

   It also draws the cameras already on the map, dimmed and not
   clickable. That is not decoration: the commonest wasted report is
   one for a camera somebody else already sent in, and the database
   will refuse a second pending report in the same cell anyway. Seeing
   a dot already sitting on your corner answers that before you type
   anything.

   The base map, its styles and the correction the dark one needs are
   all in shared.js, so the picker and the map cannot come to disagree
   about what London looks like.
   ------------------------------------------------------------------ */

/* Close in enough that a street corner is a street corner. The map
   page opens at 11 to show the whole city; here you are placing one
   pin, so it opens on a single neighbourhood. */
var PICK_ZOOM = 16;
var PICK_WIDE = 11;

var PICK_SOURCE = "pick-cameras";
var PICK_DOTS = "pick-camera-dots";

/* Makes the picker. Returns a handle with setPoint() and cameras(),
   or null if the page has no container for it - which is how the form
   goes on working if MapLibre failed to load.

   options:
     container   the element id to draw into
     lat, lon    where the pin starts, or null for the London view
     draggable   false for the read-only map on a status report
     onMove      called with (lat, lon) whenever the pin moves
*/
function makePicker(options) {
  var holder = document.getElementById(options.container);
  var draggable = options.draggable !== false;
  var placed = typeof options.lat === "number" && typeof options.lon === "number";
  var map;
  var marker;
  var pin;

  if (!holder || typeof maplibregl === "undefined") {
    return null;
  }

  map = new maplibregl.Map({
    container: options.container,
    style: MAP_STYLES.dark,
    center: placed ? lngLat(options.lat, options.lon) : lngLat(LONDON_CENTRE[0], LONDON_CENTRE[1]),
    zoom: placed ? PICK_ZOOM : PICK_WIDE,
    minZoom: PICK_WIDE,
    maxZoom: 19,

    /* The same box the form validates against and the same box the
       database enforces, so the map cannot offer a place the report
       would then be refused for. */
    maxBounds: [
      lngLat(LONDON_BOUNDS[0][0], LONDON_BOUNDS[0][1]),
      lngLat(LONDON_BOUNDS[1][0], LONDON_BOUNDS[1][1])
    ],
    attributionControl: false
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");

  /* Compact, because this map is a third the size of the real one and
     the credit line would otherwise wrap across the bottom of it.
     Folding it further - starting it collapsed by taking MapLibre's
     own class off - was tried and taken out again: the credit for
     OpenFreeMap and OpenStreetMap is a condition of using their
     tiles, and it is not worth holding a library's own markup at arm's
     length to save a line of a form. MapLibre's compact mode is the
     supported way to make it small, so that is all this asks for. */
  map.addControl(new maplibregl.AttributionControl({ compact: true }));

  /* A crosshair, not a pin. A teardrop marker points at a spot from
     above it and leaves you guessing which pixel it means; crossed
     hairs are the spot. Built here rather than left as MapLibre's own
     blue SVG, which belongs to a different website. */
  pin = document.createElement("div");
  pin.className = draggable ? "pick-pin" : "pick-pin fixed";
  pin.innerHTML =
    '<span class="pick-h"></span><span class="pick-v"></span><span class="pick-ring"></span>';

  marker = new maplibregl.Marker({
    element: pin,
    draggable: draggable,
    anchor: "center"
  })
    .setLngLat(placed ? lngLat(options.lat, options.lon) : lngLat(LONDON_CENTRE[0], LONDON_CENTRE[1]))
    .addTo(map);

  /* Hidden until there is something to point at, so an untouched form
     does not look as though it has already chosen somewhere. */
  if (!placed) {
    pin.style.display = "none";
  }

  function report() {
    var at = marker.getLngLat();
    if (options.onMove) {
      options.onMove(at.lat, at.lng);
    }
  }

  if (draggable) {
    /* Live while dragging, so the numbers in the boxes run under your
       finger rather than jumping when you let go. */
    marker.on("drag", report);
    marker.on("dragend", report);

    map.on("click", function (event) {
      pin.style.display = "";
      marker.setLngLat(event.lngLat);
      report();
    });

    map.getCanvas().style.cursor = "crosshair";
  }

  map.on("style.load", function () {
    tidyBaseStyle(map, true);
    addContextCameras();
  });

  /* The cameras already on the map, as quiet dots. Not clickable and
     under the pin: they are there to be recognised, not used. */
  var pending = null;

  function addContextCameras() {
    if (!map.getSource(PICK_SOURCE)) {
      map.addSource(PICK_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] }
      });
      map.addLayer({
        id: PICK_DOTS,
        type: "circle",
        source: PICK_SOURCE,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 3, 19, 7],
          "circle-color": typeColourExpression(),
          "circle-opacity": 0.55,
          "circle-stroke-color": "#0d0d0d",
          "circle-stroke-width": 1,
          "circle-stroke-opacity": 0.7
        }
      });
    }
    if (pending) {
      map.getSource(PICK_SOURCE).setData(pending);
    }
  }

  return {
    /* Move the pin from outside - the number boxes, or the locate
       button. Does not call onMove: the caller already knows. */
    setPoint: function (lat, lon, fly) {
      if (typeof lat !== "number" || typeof lon !== "number" ||
          isNaN(lat) || isNaN(lon)) {
        return;
      }
      pin.style.display = "";
      marker.setLngLat(lngLat(lat, lon));
      if (fly) {
        map.flyTo({ center: lngLat(lat, lon), zoom: Math.max(map.getZoom(), PICK_ZOOM), speed: 1.6 });
      }
    },

    /* Hand it the cameras to draw behind the pin. Rows are whatever
       the cameras table returns; only position, type and status are
       read. Safe to call before the style has loaded - it is kept and
       drawn when there is something to draw on. */
    cameras: function (rows) {
      var features = [];
      var i;

      for (i = 0; i < rows.length; i++) {
        features.push({
          type: "Feature",
          properties: { type: rows[i].type, status: rows[i].status },
          geometry: {
            type: "Point",
            coordinates: lngLat(Number(rows[i].lat), Number(rows[i].lon))
          }
        });
      }

      pending = { type: "FeatureCollection", features: features };
      if (map.getSource(PICK_SOURCE)) {
        map.getSource(PICK_SOURCE).setData(pending);
      }
    }

  };
}
