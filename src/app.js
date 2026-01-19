// path: src/app.js
// Minimal app bootstrap + router for Culinary Quest (cooking skin)

import { skin, loadSkin, routes } from "./skins/cooking/skin.js";

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
const TOKENS_STORAGE_KEY = "cq_host_tokens_v1";
const ORGANISER_PLAY_KEY = "cq_organiser_play_v1";
const ORGANISER_PLAY_GID = "cq_organiser_play_gid_v1";

const organiserStates = new Set([
  "organiserHome",
  "gameDashboard",
  "links",
  "rsvpTracker",
  "availability",
  "intro",
  "setup",
  "instructions"
]);

function getInitialState() {
  const params = new URLSearchParams(window.location.search);
  const stateFromUrl = params.get("state");

  // If URL explicitly asks for a known state, honour it
  if (
    stateFromUrl === "invite" ||
    stateFromUrl === "rsvpTracker" ||
    stateFromUrl === "availability" ||
    stateFromUrl === "organiserHome"
  ) {
    return stateFromUrl;
  }

  // Backwards-compatible: old links with just ?invite= still go to Invite
  if (params.get("invite")) {
    return "invite";
  }

  // If there is a stored current game, default the organiser to the home hub
  try {
    const storedGameId = window.localStorage.getItem(CURRENT_GAME_KEY);
    if (storedGameId && storedGameId.trim()) {
      return "organiserHome";
    }
  } catch (_) {
    // ignore and fall back to intro
  }

  // Normal organiser flow – first-time users
  return "intro";
}

const model = {
  state: getInitialState(),
  organiserName: null
};

// Match ?invite=TOKEN in the URL to a host index
(function detectInviteFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite");
    if (!token) return;

    const raw = window.localStorage.getItem(TOKENS_STORAGE_KEY);
    if (!raw) return;

    const tokens = JSON.parse(raw);
    if (!Array.isArray(tokens)) return;

    const hostIndex = tokens.indexOf(token);
    if (hostIndex === -1) return;

    // Always remember who this visitor is (by host index)
    model.activeHostIndex = hostIndex;

    const stateParam = params.get("state");

    // If no explicit state was requested in the URL, default invite links to the Invite screen
    if (!stateParam) {
      model.state = "invite";
    }
    // If there *is* a state param (e.g. availability, invite, future states),
    // we leave model.state alone so getInitialState() wins.
  } catch (_) {
    // fail quietly – fall back to normal intro flow
  }
})();

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
    if (typeof next === "string" && next.trim()) {
      const nextState = next.trim();

      // If we're moving into an organiser screen, strip any host/invite params
      // so organiser navigation doesn't accidentally stay in "host link" mode.
      if (organiserStates && organiserStates.has(nextState)) {
        stripHostParamsFromUrl();
      }

      model.state = nextState;
      scrollToTop();
      notifyWatchers();
      renderBottomNav(); // ✅ keep nav in sync with state
    }
  },

  // Let screens stash extra data (setup, hosts, gameId, etc.)
  // without forcing an immediate re-render.
  patch(delta) {
    if (!delta || typeof delta !== "object") return;
    Object.assign(model, delta);
    renderBottomNav(); // ✅ keep nav in sync with gameId etc.
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
    "invite"
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
  // Highest priority: explicit ?route=… override, if it matches a route
  if (ROUTE_OVERRIDE && routes[ROUTE_OVERRIDE]) {
    return ROUTE_OVERRIDE;
  }

  // Next: model.state, if recognised
  if (model.state && routes[model.state]) {
    return model.state;
  }

  // Fallbacks: known safe states
  if (routes.intro) return "intro";
  if (routes.lobby) return "lobby";

  // As a last resort, pick any available route
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
