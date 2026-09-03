/* ------------------------------------------------------------------
   cammap - anonymous accounts

   Plain browser JavaScript, same rules as map.js: no build step, no
   modules, var and named functions throughout.

   What this gives a visitor, once signed in anonymously:
     - a private list of saved cameras (saved_cameras table)
     - a way to suggest a camera the map does not have yet
       (submissions table, a moderation queue - nothing sent from
       here ever appears on the published map by itself)

   Everything here is optional. supabase-config.js carries the project
   URL and the public anon key; if that file did not load, or the
   Supabase script tag in index.html failed, or any call to Supabase
   errors, the account box says it is unavailable and stops there.
   The map itself does not depend on any of this - it is drawn by
   map.js straight from points.js, and nothing below ever touches
   that.

   map.js loads after this file (see index.html) so that by the time
   it builds the camera list, accountStarButton already exists for it
   to check for. Nothing in map.js otherwise changes.
   ------------------------------------------------------------------ */

var sb = null;            /* the Supabase client, once created */
var configured = false;   /* true once sb exists and looks usable */
var currentUser = null;   /* the signed-in user, or null */
var savedCameras = [];    /* rows from saved_cameras, kept in step with the server */

/* ---------------- the page's elements ---------------- */

var accountHint   = document.getElementById("account-hint");
var accountNote   = document.getElementById("account-note");
var signinButton  = document.getElementById("signin-button");
var signoutButton = document.getElementById("signout-button");

var savedSection  = document.getElementById("saved-section");
var savedList     = document.getElementById("saved-list");
var savedEmpty    = document.getElementById("saved-empty");

var suggestBox    = document.getElementById("suggest-box");
var sLat          = document.getElementById("s-lat");
var sLon          = document.getElementById("s-lon");
var sName         = document.getElementById("s-name");
var sNote         = document.getElementById("s-note");
var submitButton  = document.getElementById("submit-button");
var submitNote    = document.getElementById("submit-note");

/* ------------------------------------------------------------------
   Setting up the client

   Wrapped in its own try/catch because a malformed URL or key throws
   rather than failing quietly. SUPABASE_URL and SUPABASE_ANON_KEY come
   from supabase-config.js; if that file never loaded they are simply
   undefined here, which the checks below catch without an exception.
   ------------------------------------------------------------------ */

try {
  if (typeof supabase !== "undefined" &&
      typeof SUPABASE_URL === "string" && SUPABASE_URL.indexOf("https://") === 0 &&
      typeof SUPABASE_ANON_KEY === "string" && SUPABASE_ANON_KEY.length > 20) {
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    configured = true;
  }
} catch (err) {
  sb = null;
  configured = false;
}

/* ------------------------------------------------------------------
   The four states the account box can be in
   ------------------------------------------------------------------ */

function showUnavailable() {
  accountHint.textContent = "Accounts are not available on this copy of the site.";
  signinButton.style.display = "none";
  signoutButton.style.display = "none";
  savedSection.style.display = "none";
  suggestBox.style.display = "none";
}

function showSignedOut() {
  accountHint.textContent = "Sign in anonymously to save cameras and suggest new ones. " +
    "Nothing here needs a name or an email address.";
  accountNote.textContent = "";
  signinButton.style.display = "";
  signinButton.disabled = false;
  signoutButton.style.display = "none";
  savedSection.style.display = "none";
  suggestBox.style.display = "none";
}

function showSignedIn() {
  accountHint.textContent = "Signed in anonymously.";
  accountNote.textContent = "";
  signinButton.style.display = "none";
  signoutButton.style.display = "";
  signoutButton.disabled = false;
  savedSection.style.display = "block";
  suggestBox.style.display = "block";
}

/* ------------------------------------------------------------------
   Signing in and out
   ------------------------------------------------------------------ */

function signIn() {
  signinButton.disabled = true;
  accountNote.textContent = "Signing in…";

  sb.auth.signInAnonymously().then(function (result) {
    signinButton.disabled = false;

    if (result.error) {
      accountNote.textContent = "Could not sign in (" + result.error.message + "). " +
        "If you run this site, check that anonymous sign-in is turned on in the Supabase dashboard.";
      return;
    }

    currentUser = result.data.user;
    showSignedIn();
    loadSaved();
  });
}

function signOut() {
  signoutButton.disabled = true;

  sb.auth.signOut().then(function () {
    signoutButton.disabled = false;
    currentUser = null;
    savedCameras = [];
    renderSaved();
    showSignedOut();
    if (typeof render === "function") {
      render();
    }
  });
}

function restoreSession() {
  sb.auth.getSession().then(function (result) {
    if (result.error || !result.data.session) {
      showSignedOut();
      return;
    }

    currentUser = result.data.session.user;
    showSignedIn();
    loadSaved();
  }).catch(function () {
    showSignedOut();
  });
}

/* ------------------------------------------------------------------
   Saved cameras

   Matched by name and coordinates rather than by id: the points a
   visitor sees come straight from points.js and are given a fresh id
   every time the page loads (see nextId in map.js), so id is never
   something worth storing. Name and coordinates are what points.js
   itself is keyed on.
   ------------------------------------------------------------------ */

function samePlace(row, point) {
  return row.camera_name === point.name &&
         Number(row.lat).toFixed(6) === point.lat.toFixed(6) &&
         Number(row.lon).toFixed(6) === point.lon.toFixed(6);
}

function savedRowFor(point) {
  var i;

  for (i = 0; i < savedCameras.length; i++) {
    if (samePlace(savedCameras[i], point)) {
      return savedCameras[i];
    }
  }

  return null;
}

function withoutId(list, id) {
  var kept = [];
  var i;

  for (i = 0; i < list.length; i++) {
    if (list[i].id !== id) {
      kept.push(list[i]);
    }
  }

  return kept;
}

function loadSaved() {
  sb.from("saved_cameras").select("*").then(function (result) {
    if (result.error) {
      accountNote.textContent = "Could not load your saved cameras.";
      return;
    }

    savedCameras = result.data || [];
    renderSaved();
    if (typeof render === "function") {
      render();
    }
  });
}

/* Called by map.js's rowFor(), once per camera in the list. Returns
   nothing - not even an empty button - unless someone is actually
   signed in, so the row looks exactly as it always has otherwise. */
function accountStarButton(point) {
  var existing;
  var button;

  if (!configured || !currentUser) {
    return null;
  }

  existing = savedRowFor(point);

  button = document.createElement("button");
  button.className = existing ? "star saved" : "star";
  button.title = existing ? "Remove from saved" : "Save this camera";
  button.textContent = existing ? "★" : "☆";

  button.onclick = function () {
    toggleSaved(point, button);
  };

  return button;
}

function toggleSaved(point, button) {
  var existing = savedRowFor(point);

  button.disabled = true;

  if (existing) {
    removeSaved(existing, function () {
      button.disabled = false;
    });
    return;
  }

  sb.from("saved_cameras").insert({
    user_id: currentUser.id,
    camera_name: point.name,
    lat: point.lat,
    lon: point.lon,
    note: point.note || ""
  }).select().then(function (result) {
    button.disabled = false;

    if (result.error) {
      if (result.error.code === "23505") {
        /* someone else, or another tab, saved it a moment ago - the
           star should end up lit either way, so just re-fetch rather
           than treating this as a failure */
        accountNote.textContent = "Already saved.";
        loadSaved();
      } else if (result.error.code === "23514") {
        /* points.js is meant to be Greater London only, so this
           should not happen in practice, but the table has the same
           bounds check as inLondon() below and the message should
           match it if it ever fires */
        accountNote.textContent = "That camera falls outside the area this map covers, so it can't be saved.";
      } else {
        accountNote.textContent = "Could not save that camera.";
      }
      return;
    }

    savedCameras.push(result.data[0]);
    renderSaved();
    if (typeof render === "function") {
      render();
    }
  });
}

function removeSaved(saved, done) {
  sb.from("saved_cameras").delete().eq("id", saved.id).then(function (result) {
    if (done) {
      done();
    }

    if (result.error) {
      accountNote.textContent = "Could not remove that saved camera.";
      return;
    }

    savedCameras = withoutId(savedCameras, saved.id);
    renderSaved();
    if (typeof render === "function") {
      render();
    }
  });
}

function renderSaved() {
  var i;

  savedList.innerHTML = "";

  if (savedCameras.length === 0) {
    savedEmpty.style.display = "block";
    return;
  }
  savedEmpty.style.display = "none";

  for (i = 0; i < savedCameras.length; i++) {
    savedList.appendChild(savedRow(savedCameras[i]));
  }
}

function savedRow(saved) {
  var row = document.createElement("li");

  var go = document.createElement("button");
  go.className = "goto";

  var name = document.createElement("span");
  name.className = "name";
  name.textContent = saved.camera_name;
  go.appendChild(name);

  var coords = document.createElement("span");
  coords.className = "coords";
  coords.textContent = Number(saved.lat).toFixed(4) + ", " + Number(saved.lon).toFixed(4);
  go.appendChild(coords);

  go.onclick = function () {
    if (typeof map !== "undefined" && typeof lngLat === "function") {
      map.flyTo({ center: lngLat(Number(saved.lat), Number(saved.lon)), zoom: 17, speed: 1.6 });
    }
  };

  row.appendChild(go);

  var remove = document.createElement("button");
  remove.className = "remove";
  remove.textContent = "×";
  remove.title = "Remove from saved";
  remove.onclick = function () {
    removeSaved(saved);
  };
  row.appendChild(remove);

  return row;
}

/* ------------------------------------------------------------------
   Suggesting a camera
   ------------------------------------------------------------------ */

function submitSighting() {
  var lat = parseFloat(sLat.value);
  var lon = parseFloat(sLon.value);
  var name = sName.value.trim();
  var note = sNote.value.trim();

  submitNote.textContent = "";

  if (!currentUser) {
    submitNote.textContent = "Sign in first.";
    return;
  }

  if (name === "") {
    submitNote.textContent = "Please give the camera a name.";
    sName.focus();
    return;
  }

  if (isNaN(lat) || isNaN(lon)) {
    submitNote.textContent = "Both coordinates need to be numbers.";
    sLat.focus();
    return;
  }

  if (typeof inLondon === "function" && !inLondon(lat, lon)) {
    submitNote.textContent = "That is outside London. This map covers Greater London only.";
    sLat.focus();
    return;
  }

  submitButton.disabled = true;
  submitNote.textContent = "Sending…";

  sb.from("submissions").insert({
    user_id: currentUser.id,
    name: name,
    note: note,
    lat: lat,
    lon: lon
  }).then(function (result) {
    submitButton.disabled = false;

    if (result.error) {
      if (result.error.code === "23514") {
        /* the same bounds check as inLondon() above, on the table
           itself - this is a backstop, not the first line of
           defense, but the message should read the same either way */
        submitNote.textContent = "That is outside London. This map covers Greater London only.";
      } else {
        submitNote.textContent = "Could not send that in. Try again in a moment.";
      }
      return;
    }

    sLat.value = "";
    sLon.value = "";
    sName.value = "";
    sNote.value = "";
    submitNote.textContent = "Sent for review. It will not appear on the map automatically.";
  });
}

/* ------------------------------------------------------------------
   Start up
   ------------------------------------------------------------------ */

if (configured) {
  signinButton.onclick = signIn;
  signoutButton.onclick = signOut;
  submitButton.onclick = submitSighting;

  accountHint.textContent = "Checking your account…";
  restoreSession();
} else {
  showUnavailable();
}
