// path: src/app.js
// Minimal app bootstrap + router for Culinary Quest (cooking skin)

import { skin, loadSkin, routes } from "./skins/cooking/skin.js";
import { stripCqSessionParamsFromUrl } from "./engine/url.js";

/* ------------ basic error display ------------ */

const appRoot = document.getElementById("app") || document.body;

function ensureShell() {
  // Don't rebuild if already present
  if (document.getElementById("cq-main")) return;

  appRoot.innerHTML = `
    <div id="cq-shell">
      <div id="cq-main"></div>
      <nav id="cq-bottom-nav" aria-label="Organiser menu"></nav>
    </div>
  `;
}

ensureShell();

function stripHostParamsFromUrl() {
  try {
    const url = new URL(window.location.href);
    ["invite", "game", "from", "state", "route"].forEach((k) => url.searchParams.delete(k));
    window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
  } catch (_) {}
}

const root = document.getElementById("cq-main") || appRoot; // screens render here

function scrollToTop() {
  try {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  } catch (_) {
    window.scrollTo(0, 0);
  }

  // Belt-and-braces for different scroll roots
  if (document.documentElement) document.documentElement.scrollTop = 0;
  if (document.body) document.body.scrollTop = 0;

  // If your app container itself scrolls
  if (root) root.scrollTop = 0;
  const app = document.getElementById("app");
  if (app) app.scrollTop = 0;
}


function showError(msg) {
  const safeMsg = String(msg || "Unknown error");
  root.innerHTML = `
    <section class="card" style="max-width:520px;margin:24px auto;">
      <h2>Something went wrong</h2>
      <pre style="white-space:pre-wrap;font-size:12px;margin-top:8px;">
${safeMsg}
      </pre>
    </section>
  `;
}

window.addEventListener("error", (e) => {
  showError(`${e.message}\n${e.filename || ""}:${e.lineno || ""}`);
});

/* ------------ simple in-memory model + actions ------------ */

const CURRENT_GAME_KEY   = "cq_current_game_id_v1";
const ORGANISER_PLAY_KEY = "cq_organiser_play_v1";
const ORGANISER_PLAY_GID = "cq_organiser_play_gid_v1";

const organiserStates = new Set([
  "organiserHome",
  "gameDashboard",
  "links",
  "hosts",
  "intro",
  "setup",
  "instructions",
  "finaliseEvent"
]);

const STRIP_HOST_PARAMS_ON = new Set([
  "organiserHome",
  "gameDashboard",
  "links",
  "hosts",
  "intro",
  "setup",
  "instructions",
  "finaliseEvent"
]);

// Guest sessions must only be able to land on guest-safe states via URL hints.
const GUEST_SAFE_STATES = new Set(["invite", "availability", "voting"]);

function isOrganiserPlayModeFromParams(params) {
  // Organiser play mode keeps the ribbon visible even though invite= is present.
  if (!params || params.get("from") !== "organiser") return false;

  const gid = params.get("game");
  if (!gid) return false;

  try {
    return (
      window.localStorage.getItem(ORGANISER_PLAY_KEY) === "1" &&
      window.localStorage.getItem(ORGANISER_PLAY_GID) === gid
    );
  } catch (_) {
    return false;
  }
}



function getInitialState() {
  const params = new URLSearchParams(window.location.search);
  const stateFromUrl = params.get("state");

  const hasInvite = !!params.get("invite");
  const isPlay = hasInvite && isOrganiserPlayModeFromParams(params);

  // IMPORTANT: If invite= is present (and this is NOT organiser play mode),
  // never allow organiser states to be selected via state=/route=.
  if (hasInvite && !isPlay) {
    if (stateFromUrl && GUEST_SAFE_STATES.has(stateFromUrl)) return stateFromUrl;
    return "invite";
  }

  // If invite= is present in organiser play mode, still default into the host experience.
  if (hasInvite && isPlay) {
    if (stateFromUrl && GUEST_SAFE_STATES.has(stateFromUrl)) return stateFromUrl;
    return "invite";
  }

  // Organiser / normal session: honour explicit state if known.
  if (
    stateFromUrl === "invite" ||
    stateFromUrl === "rsvpTracker" ||
    stateFromUrl === "availability" ||
    stateFromUrl === "organiserHome"
  ) {
    return stateFromUrl;
  }

  // If there is a stored current game, default the organiser to the home hub
  try {
    const storedGameId = window.localStorage.getItem(CURRENT_GAME_KEY);
    if (storedGameId && storedGameId.trim()) {
      return "organiserHome";
    }
  } catch (_) {}

  return "intro";
}

const model = {
  state: getInitialState(),
  organiserName: null
};

const watchers = new Set();

function notifyWatchers() {
  for (const fn of watchers) {
    try {
      fn(model, actions);
    } catch (err) {
      console.error("[watcher] render failed", err);
    }
  }
}

const actions = {
  async join(name) {
    model.organiserName = name;
    // later we’ll persist this via Firestore
  },

  setState(next) {
    if (typeof next !== "string" || !next.trim()) return;
    const nextState = next.trim();

// IMPORTANT: Guests must not be able to navigate into organiser-only screens.
if (isGuestLinkSession() && organiserStates.has(nextState)) {
  console.warn(
    `[app] blocked organiser state "${nextState}" during guest session; forcing guest flow.`
  );
  model.state = "invite";
  scrollToTop();
  notifyWatchers();
  renderBottomNav();
  return;
}

    // Only strip host params when entering organiser screens,
    // and ONLY if we are not currently in a guest-link session.
    if (!isGuestLinkSession() && STRIP_HOST_PARAMS_ON.has(nextState)) {
      stripCqSessionParamsFromUrl();
    }

    model.state = nextState;
    scrollToTop();
    notifyWatchers();
    renderBottomNav(); // keep nav in sync with state
  },

  // Let screens stash extra data (setup, hosts, gameId, etc.)
  // without forcing an immediate re-render.
  patch(delta) {
    if (!delta || typeof delta !== "object") return;
    Object.assign(model, delta);
    renderBottomNav(); // keep nav in sync with gameId etc.
    // deliberately NO notifyWatchers() here
  }
};


function isOrganiserPlayMode() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("from") !== "organiser") return false;

  const gid = params.get("game");
  if (!gid) return false;

  try {
    return (
      window.localStorage.getItem(ORGANISER_PLAY_KEY) === "1" &&
      window.localStorage.getItem(ORGANISER_PLAY_GID) === gid
    );
  } catch (_) {
    return false;
  }
}

function isGuestLinkSession() {
  const params = new URLSearchParams(window.location.search);

  // Hide organiser nav for any invite-based session...
  // ...except organiser play mode.
  return !!params.get("invite") && !isOrganiserPlayMode();
}

function getCurrentGameId() {
  if (model && typeof model.gameId === "string" && model.gameId.trim()) {
    return model.gameId.trim();
  }
  try {
    const stored = window.localStorage.getItem(CURRENT_GAME_KEY);
    return stored && stored.trim() ? stored.trim() : null;
  } catch (_) {
    return null;
  }
}

function activeNavTab(stateKey) {
    const inGame = [
    "gameDashboard",
    "hosts",
    "links",
    "rsvpTracker",
    "availability",
    "invite",
    "finaliseEvent"
  ].includes(stateKey);

  if (stateKey === "instructions") return "instructions";
  if (inGame) return "dashboard";
  return "hub";
}

function setNavSpace(px) {
  try {
    document.documentElement.style.setProperty("--cq-nav-space", px);
  } catch (_) {}
}

function renderBottomNav() {
  const nav = document.getElementById("cq-bottom-nav");
  if (!nav) return;

  if (isGuestLinkSession()) {
  nav.innerHTML = "";
  nav.style.display = "none";
  setNavSpace("0px");
  return;
}

nav.style.display = "block";
setNavSpace("64px"); // must match the ribbon height


  const currentGameId = getCurrentGameId();
  const tab = activeNavTab(model.state);
  const dashboardDisabled = !currentGameId;

  const btnClass = (isActive, isDisabled) => {
    const base = "cq-nav-btn";
    const active = isActive ? " cq-nav-btn--active" : "";
    const disabled = isDisabled ? " cq-nav-btn--disabled" : "";
    return base + active + disabled;
  };

  nav.innerHTML = `
    <div class="cq-nav-inner">
      <button type="button" class="${btnClass(tab === "hub", false)}" data-nav="hub">
        Home
      </button>

      <button type="button"
              class="${btnClass(tab === "dashboard", dashboardDisabled)}"
              data-nav="dashboard"
              ${dashboardDisabled ? "disabled" : ""}>
        Dashboard
      </button>

      <button type="button" class="${btnClass(tab === "instructions", false)}" data-nav="instructions">
        Instructions
      </button>
    </div>
  `;

  const hubBtn = nav.querySelector('[data-nav="hub"]');
  const dashBtn = nav.querySelector('[data-nav="dashboard"]');
  const instBtn = nav.querySelector('[data-nav="instructions"]');

  if (hubBtn) hubBtn.addEventListener("click", () => actions.setState("organiserHome"));

  if (dashBtn) {
    dashBtn.addEventListener("click", () => {
      const gid = getCurrentGameId();
      if (gid) actions.patch({ gameId: gid });
      actions.setState("gameDashboard");
    });
  }

  if (instBtn) instBtn.addEventListener("click", () => actions.setState("instructions"));
}

/* ------------ route resolution ------------ */

const qs = new URLSearchParams(location.search);
const ROUTE_OVERRIDE = qs.get("route") || null;

// Keep track of current cleanup from the active screen
let currentCleanup = null;

async function resolveRenderer(key) {
  const loader = routes[key];
  if (!loader) return null;

  const modOrFn = await loader();
  if (typeof modOrFn === "function") return modOrFn;
  if (modOrFn && typeof modOrFn.render === "function") return modOrFn.render;
  return null;
}

function pickRouteKey() {
  const qs = new URLSearchParams(location.search);
  const routeOverride = qs.get("route");
  const stateHint = qs.get("state");

  // IMPORTANT: If this is a guest-link session, ignore organiser overrides.
  if (isGuestLinkSession()) {
    const hinted = (routeOverride && GUEST_SAFE_STATES.has(routeOverride))
      ? routeOverride
      : (stateHint && GUEST_SAFE_STATES.has(stateHint))
        ? stateHint
        : null;

   if (hinted && routes[hinted]) return hinted;

// Allow in-app navigation within guest-safe states (e.g. InviteScreen -> VotingScreen)
if (model.state && GUEST_SAFE_STATES.has(model.state) && routes[model.state]) {
  return model.state;
}

if (routes.invite) return "invite";
if (routes.availability) return "availability";
  }

  if (model.state && routes[model.state]) {
    return model.state;
  }

  if (routes.intro) return "intro";
  if (routes.lobby) return "lobby";

  const keys = Object.keys(routes);
  return keys[0];
}


async function renderOnce() {
  const key = pickRouteKey();

  try {
    const renderer = await resolveRenderer(key);
    if (!renderer) {
      showError(`No renderer available for state "${key}".`);
      return;
    }

    // Run previous screen's cleanup, if any
    if (typeof currentCleanup === "function") {
      try {
        currentCleanup();
      } catch (err) {
        console.warn("[cleanup] failed", err);
      }
      currentCleanup = null;
    }

    // Call the new screen renderer; if it returns a cleanup function, keep it
    scrollToTop();
    const maybeCleanup = renderer(root, model, actions);
    renderBottomNav();
    if (typeof maybeCleanup === "function") {
      currentCleanup = maybeCleanup;
    }
  } catch (err) {
    console.error("[renderOnce] failed", err);
    showError(`Render failed for state "${key}": ${err.message || err}`);
  }
}

/* ------------ main bootstrap ------------ */

async function main() {
   // Prevent the browser from restoring the previous scroll position
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  try {
    await loadSkin();
    skin.apply(appRoot);
    renderBottomNav();
  } catch (err) {
    console.error("[main] skin init failed", err);
    showError(`Failed to load skin: ${err.message || err}`);
    return;
  }

  // Initial render
  await renderOnce();

  // Watch for model changes (state transitions)
  watchers.add(() => {
    renderOnce();
  });
}

// Kick things off
main();
