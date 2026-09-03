/* ------------------------------------------------------------------
   cammap - anonymous accounts

   Plain browser JavaScript, same rules as map.js: no build step, no
   modules, var and named functions throughout.

   This file runs on every page, because the account controls live in
   the nav bar at the top and the nav has to say the right thing
   wherever you are. What it does beyond that depends on which page
   it finds itself on:

     index.html    adds a star to each row of the camera list, once
                   someone is signed in
     account.html  the sign-in screen, and what it says afterwards
     report.html   the form for reporting a camera

   The nav shows nothing about accounts until it knows the answer, so
   it never flickers from "Account" to "Log out" in front of you.

   Everything here is optional. supabase-config.js carries the project
   URL and the public key; if that file did not load, or lib/supabase.js
   failed, or any call errors, the account controls simply do not
   appear and the rest of the site behaves as it always did. The map is
   drawn by map.js straight from points.js and never touches any of
   this.
   ------------------------------------------------------------------ */

var sb = null;            /* the Supabase client, once created */
var configured = false;   /* true once sb exists and looks usable */
var currentUser = null;   /* the signed-in user, or null */
var savedCameras = [];    /* rows from saved_cameras, kept in step with the server */

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

/* Which page we are on, by file name. Works from a file:// path and
   from a web root serving index.html for "/". */
function pageName() {
  var path = window.location.pathname;
  var last = path.substring(path.lastIndexOf("/") + 1);
  return last === "" ? "index.html" : last;
}

var PAGE = pageName();

/* ------------------------------------------------------------------
   The nav

   Signed out it offers one thing, Account. Signed in it offers the
   report form and a way out. The separators are written here too, so
   that the dots always sit between things that are actually there.
   ------------------------------------------------------------------ */

var navAccount = document.getElementById("nav-account");

function navLink(href, text, current) {
  var a = document.createElement("a");
  a.href = href;
  a.textContent = text;
  if (current) {
    a.className = "current";
  }
  return a;
}

function navSeparator() {
  var span = document.createElement("span");
  span.className = "sep";
  span.innerHTML = "&middot;";
  return span;
}

function renderNav() {
  if (!navAccount) {
    return;
  }

  navAccount.innerHTML = "";

  /* Nothing at all if there is no Supabase to talk to. An Account tab
     that cannot work is worse than no Account tab. */
  if (!configured) {
    return;
  }

  if (!currentUser) {
    navAccount.appendChild(navSeparator());
    navAccount.appendChild(navLink("account.html", "Account", PAGE === "account.html"));
    return;
  }

  navAccount.appendChild(navSeparator());
  navAccount.appendChild(navLink("report.html", "Report a camera", PAGE === "report.html"));

  navAccount.appendChild(navSeparator());

  var out = navLink("#", "Log out", false);
  out.onclick = function (event) {
    event.preventDefault();
    signOut();
  };
  navAccount.appendChild(out);
}

/* ------------------------------------------------------------------
   Signing in and out
   ------------------------------------------------------------------ */

function signIn(onDone) {
  sb.auth.signInAnonymously().then(function (result) {
    if (result.error) {
      onDone(result.error.message);
      return;
    }

    currentUser = result.data.user;
    renderNav();
    loadSaved();
    onDone(null);
  });
}

function signOut() {
  sb.auth.signOut().then(function () {
    currentUser = null;
    savedCameras = [];
    renderNav();

    /* The report page is no use signed out, and neither is the signed
       in half of the account page, so leave for the map. Everywhere
       else can stay where it is and just redraw. */
    if (PAGE === "report.html") {
      window.location.href = "index.html";
      return;
    }

    if (PAGE === "account.html") {
      showAccountPage();
      return;
    }

    if (typeof render === "function") {
      render();
    }
  });
}

function restoreSession(onDone) {
  sb.auth.getSession().then(function (result) {
    if (!result.error && result.data.session) {
      currentUser = result.data.session.user;
    }
    onDone();
  }).catch(function () {
    onDone();
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

/* Only the map page has anything to show for this, so everywhere else
   it fetches nothing and stays out of the way. */
function loadSaved() {
  if (PAGE !== "index.html" || !currentUser) {
    return;
  }

  sb.from("saved_cameras").select("*").then(function (result) {
    if (result.error) {
      return;
    }

    savedCameras = result.data || [];
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
        /* another tab saved it a moment ago */
        loadSaved();
      }
      return;
    }

    savedCameras.push(result.data[0]);
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
      return;
    }

    savedCameras = withoutId(savedCameras, saved.id);
    if (typeof render === "function") {
      render();
    }
  });
}

/* ------------------------------------------------------------------
   The account page
   ------------------------------------------------------------------ */

function showAccountPage() {
  var outMsg = document.getElementById("account-signedout");
  var inMsg  = document.getElementById("account-signedin");

  if (!outMsg || !inMsg) {
    return;
  }

  if (!configured) {
    outMsg.style.display = "none";
    inMsg.style.display = "none";
    document.getElementById("account-unavailable").style.display = "block";
    return;
  }

  outMsg.style.display = currentUser ? "none" : "block";
  inMsg.style.display  = currentUser ? "block" : "none";
}

function setUpAccountPage() {
  var button = document.getElementById("signin-button");
  var note   = document.getElementById("account-note");

  showAccountPage();

  if (!button) {
    return;
  }

  button.onclick = function () {
    button.disabled = true;
    note.textContent = "Signing in…";

    signIn(function (error) {
      button.disabled = false;

      if (error) {
        note.textContent = "Could not sign in (" + error + "). " +
          "If you run this site, check that anonymous sign-in is turned on " +
          "in the Supabase dashboard.";
        return;
      }

      note.textContent = "";
      showAccountPage();
    });
  };
}

/* ------------------------------------------------------------------
   The report page
   ------------------------------------------------------------------ */

function setUpReportPage() {
  var form   = document.getElementById("report-form");
  var locked = document.getElementById("report-locked");
  var button = document.getElementById("submit-button");
  var note   = document.getElementById("submit-note");

  if (!form || !locked) {
    return;
  }

  /* Signed out there is nothing useful to show, and the database
     would refuse the insert anyway. */
  form.style.display   = currentUser ? "block" : "none";
  locked.style.display = currentUser ? "none" : "block";

  if (!currentUser || !button) {
    return;
  }

  button.onclick = function () {
    var lat  = parseFloat(document.getElementById("s-lat").value);
    var lon  = parseFloat(document.getElementById("s-lon").value);
    var name = document.getElementById("s-name").value.trim();
    var memo = document.getElementById("s-note").value.trim();

    note.textContent = "";

    if (name === "") {
      note.textContent = "Please give the camera a name.";
      return;
    }

    if (isNaN(lat) || isNaN(lon)) {
      note.textContent = "Both coordinates need to be numbers.";
      return;
    }

    /* Same box as map.js, repeated here because this page has no map
       on it to borrow inLondon() from. The database checks it a third
       time, so a bad pair cannot get in whatever happens up here. */
    if (lat < 51.28 || lat > 51.70 || lon < -0.51 || lon > 0.33) {
      note.textContent = "That is outside London. This map covers Greater London only.";
      return;
    }

    button.disabled = true;
    note.textContent = "Sending…";

    sb.from("submissions").insert({
      user_id: currentUser.id,
      name: name,
      note: memo,
      lat: lat,
      lon: lon
    }).then(function (result) {
      button.disabled = false;

      if (result.error) {
        if (result.error.code === "23514") {
          note.textContent = "That is outside London. This map covers Greater London only.";
        } else {
          note.textContent = "Could not send that in. Try again in a moment.";
        }
        return;
      }

      document.getElementById("s-lat").value = "";
      document.getElementById("s-lon").value = "";
      document.getElementById("s-name").value = "";
      document.getElementById("s-note").value = "";
      note.textContent = "Sent for review. It will not appear on the map automatically.";
    });
  };
}

/* ------------------------------------------------------------------
   Start up

   Nothing is drawn until the session has been looked up, so the nav
   does not change under the reader a moment after the page settles.
   ------------------------------------------------------------------ */

function start() {
  renderNav();

  if (PAGE === "account.html") {
    setUpAccountPage();
  } else if (PAGE === "report.html") {
    setUpReportPage();
  } else {
    loadSaved();
  }
}

if (configured) {
  restoreSession(start);
} else {
  start();
}
