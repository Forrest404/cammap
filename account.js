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

   An account is a generated username - two words with a dot between,
   like copper.heron - and a password the user chooses. Nothing else.
   No email is asked for. Supabase wants an email string to hang a
   password on, so one is made up from the username and never shown,
   never mailed, and never treated as an address.

   The nav shows nothing about accounts until it knows the answer, so
   it never flickers from "Account" to "Log out" in front of you.

   Everything here is optional. supabase-config.js carries the project
   URL and the public key; if that file did not load, or lib/supabase.js
   failed, or any call errors, the account controls simply do not
   appear and the rest of the site behaves as it always did. The map is
   drawn by map.js straight from points.js and never touches any of
   this.
   ------------------------------------------------------------------ */

/* The hidden half of a login. The user's username goes in front of
   this to make the email string Supabase requires. It is not a real
   mailbox and nothing is ever sent to it. Supabase rejects reserved
   names like .invalid and .example, so it has to look real. If this
   ever changes, existing accounts stop matching - so it should not. */
var ACCOUNT_DOMAIN = "users.cammap.app";

/* A password must be at least this long and mix all four classes.
   The same rule is set in the Supabase dashboard, which is what
   actually enforces it; this copy is so the message is ours. */
var PASSWORD_MIN = 10;

/* Two plain words with a dot between, e.g. copper.heron. Chosen for
   the user, not by them: nothing identifying can be typed in, and
   nothing rude can come out. About 22,000 pairs; a collision is
   caught by the database and the client rerolls once. */
var WORDS_A = ["amber","ash","birch","bold","brass","brief","bright","broad",
  "calm","cedar","chalk","cinder","civil","clear","cloud","coal","cobalt",
  "cold","copper","coral","cream","crisp","damp","dark","dawn","deep","dry",
  "dusk","dusty","early","east","ember","even","fair","faint","fern","flat",
  "flint","fog","frost","gentle","glass","gold","grand","grey","hazel","heavy",
  "high","hollow","humble","idle","iron","ivory","jade","keen","kind","late",
  "lead","light","lime","linen","little","local","long","loud","low","lunar",
  "marble","mellow","mild","misty","moss","narrow","near","neat","north",
  "oak","olive","onyx","open","pale","paper","pearl","pine","plain","plum",
  "polar","proud","quick","quiet","rapid","raw","red","rich","ripe","river",
  "rose","rough","round","royal","ruby","rusty","sage","salt","sand","sharp",
  "silent","silver","slate","slow","small","smoke","snow","soft","solid",
  "south","spare","steel","still","stone","stormy","stout","swift","tall",
  "tidal","tidy","tin","torn","true","umber","upper","urban","vast","velvet",
  "vivid","warm","wax","west","wide","wild","wool","young","zinc"];

var WORDS_B = ["anchor","arch","arrow","badger","barge","basin","beacon",
  "bell","bench","birch","bloom","bridge","brook","bucket","cairn","canal",
  "candle","canyon","castle","cellar","chapel","cliff","clock","comet",
  "corner","crane","creek","crow","current","dock","drum","eagle","engine",
  "falcon","feather","ferry","field","finch","flame","fleet","forge","fox",
  "garden","gate","glade","glen","grove","harbour","hare","harp","hawk",
  "heron","hill","hound","island","jetty","kettle","kiln","kite","ladder",
  "lamp","lantern","lark","ledge","lens","lock","loom","magpie","mallet",
  "marsh","meadow","mill","mist","moor","moth","needle","nest","oar","orchard",
  "otter","owl","paddle","path","pebble","pillar","plough","pond","quarry",
  "quill","rail","raven","reed","ridge","robin","rook","rope","rudder",
  "saddle","sail","shed","shore","signal","sparrow","spire","spring","spruce",
  "stair","steeple","stream","summit","swan","thicket","thistle","tide",
  "timber","tower","trail","trout","tunnel","valley","vault","vine","wagon",
  "walnut","warren","weasel","wharf","wheel","willow","window","wren","yard"];

function pickFrom(list) {
  var n;

  /* crypto if the browser has it, so names are not guessable from a
     clock; Math.random otherwise, which is fine for a name. */
  if (window.crypto && window.crypto.getRandomValues) {
    n = new Uint32Array(1);
    window.crypto.getRandomValues(n);
    return list[n[0] % list.length];
  }
  return list[Math.floor(Math.random() * list.length)];
}

function generateUsername() {
  return pickFrom(WORDS_A) + "." + pickFrom(WORDS_B);
}

var USERNAME_SHAPE = /^[a-z]{3,12}\.[a-z]{3,12}$/;

/* The login email for a username. Lower-cased on the way in so that
   Copper.Heron and copper.heron are the same account. */
function emailFor(username) {
  return username.trim().toLowerCase() + "@" + ACCOUNT_DOMAIN;
}

/* Empty string means fine; otherwise the reason, in plain words. */
function passwordProblem(pw) {
  if (pw.length < PASSWORD_MIN) {
    return "At least " + PASSWORD_MIN + " characters.";
  }
  if (!/[a-z]/.test(pw)) { return "Add a lower-case letter."; }
  if (!/[A-Z]/.test(pw)) { return "Add a capital letter."; }
  if (!/[0-9]/.test(pw)) { return "Add a number."; }
  if (!/[^A-Za-z0-9]/.test(pw)) { return "Add a symbol."; }
  return "";
}

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

/* What a Supabase auth error should say to a person. The raw messages
   talk about emails, which the user never entered. */
function authProblem(error) {
  var code = error && (error.code || "");
  var msg = error && error.message ? error.message : "";

  if (code === "invalid_credentials" || /invalid login/i.test(msg)) {
    return "Wrong username or password.";
  }
  if (code === "weak_password" || /password/i.test(msg)) {
    return "That password is not strong enough.";
  }
  if (code === "over_request_rate_limit" || /rate limit/i.test(msg)) {
    return "Too many tries. Wait a minute and try again.";
  }
  if (code === "user_already_exists" || /already registered/i.test(msg)) {
    return "That username is taken.";
  }
  return "Something went wrong. Try again in a moment.";
}

function finishSignIn(user) {
  currentUser = user;
  renderNav();
  loadSaved();
}

function signIn(username, password, onDone) {
  if (!USERNAME_SHAPE.test(username.trim().toLowerCase())) {
    onDone("Wrong username or password.");
    return;
  }

  sb.auth.signInWithPassword({ email: emailFor(username), password: password })
    .then(function (result) {
      if (result.error) {
        onDone(authProblem(result.error));
        return;
      }
      finishSignIn(result.data.user);
      onDone(null);
    });
}

/* The username is only claimed here, on submit. If it was taken in
   the moment between being shown and being sent, a fresh one is
   tried once before giving up. */
function signUp(username, password, onDone, retried) {
  sb.auth.signUp({
    email: emailFor(username),
    password: password,
    options: { data: { username: username } }
  }).then(function (result) {
    var taken;

    if (result.error) {
      taken = result.error.code === "user_already_exists" ||
              /already registered/i.test(result.error.message || "");
      if (taken && !retried) {
        signUp(generateUsername(), password, onDone, true);
        return;
      }
      onDone(authProblem(result.error), username);
      return;
    }

    /* With email confirmation off, sign-up returns a session at
       once. If it did not, confirmation is on and the site cannot
       work - say so plainly rather than leave a spinner. */
    if (!result.data.session) {
      onDone("Sign-up needs email confirmation to be switched off in the " +
             "Supabase dashboard, and it is on.", username);
      return;
    }

    finishSignIn(result.data.user);
    onDone(null, username);
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
    var user = !result.error && result.data.session ? result.data.session.user : null;

    /* Accounts used to be one-press anonymous ones. Those are not
       carried over - they cannot be signed back into and have no
       name for a leaderboard - so one found here is signed out, and
       the next page load starts clean. */
    if (user && user.is_anonymous) {
      sb.auth.signOut().then(onDone, onDone);
      return;
    }

    currentUser = user;
    onDone();
  }).catch(function () {
    onDone();
  });
}

/* The signed-in user's username, from the metadata set at sign-up. */
function usernameOf(user) {
  return user && user.user_metadata && user.user_metadata.username
    ? user.user_metadata.username
    : "";
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
  var who    = document.getElementById("account-username");

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

  if (currentUser && who) {
    who.textContent = usernameOf(currentUser);
  }
}

function setUpAccountPage() {
  var shown      = document.getElementById("new-username");
  var reroll     = document.getElementById("reroll-button");
  var newPw      = document.getElementById("new-password");
  var newPw2     = document.getElementById("new-password-again");
  var signupBtn  = document.getElementById("signup-button");
  var signupNote = document.getElementById("signup-note");

  var inName     = document.getElementById("signin-username");
  var inPw       = document.getElementById("signin-password");
  var signinBtn  = document.getElementById("signin-button");
  var signinNote = document.getElementById("signin-note");

  showAccountPage();

  if (!signupBtn || !signinBtn) {
    return;
  }

  /* -------- making an account -------- */

  shown.textContent = generateUsername();

  reroll.onclick = function () {
    shown.textContent = generateUsername();
    signupNote.textContent = "";
  };

  signupBtn.onclick = function () {
    var username = shown.textContent;
    var problem = passwordProblem(newPw.value);

    signupNote.textContent = "";

    if (problem) {
      signupNote.textContent = problem;
      newPw.focus();
      return;
    }

    if (newPw.value !== newPw2.value) {
      signupNote.textContent = "The two passwords do not match.";
      newPw2.focus();
      return;
    }

    signupBtn.disabled = true;
    reroll.disabled = true;
    signupNote.textContent = "Making the account…";

    signUp(username, newPw.value, function (error, finalName) {
      signupBtn.disabled = false;
      reroll.disabled = false;

      if (error) {
        signupNote.textContent = error;
        return;
      }

      /* If the shown name was taken and a fresh one used instead,
         the person must see the one they actually got. */
      shown.textContent = finalName;
      newPw.value = "";
      newPw2.value = "";
      signupNote.textContent = "";
      showAccountPage();
    });
  };

  /* -------- signing back in -------- */

  signinBtn.onclick = function () {
    signinNote.textContent = "";

    if (inName.value.trim() === "" || inPw.value === "") {
      signinNote.textContent = "Both boxes are needed.";
      return;
    }

    signinBtn.disabled = true;
    signinNote.textContent = "Signing in…";

    signIn(inName.value, inPw.value, function (error) {
      signinBtn.disabled = false;

      if (error) {
        signinNote.textContent = error;
        return;
      }

      inName.value = "";
      inPw.value = "";
      signinNote.textContent = "";
      showAccountPage();
    });
  };

  inPw.onkeydown = function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      signinBtn.onclick();
    }
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
