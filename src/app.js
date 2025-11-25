// path: src/app.js
// Minimal app bootstrap + router for Culinary Quest (cooking skin)

import { skin, loadSkin, routes } from "./skins/cooking/skin.js";

/* ------------ basic error display ------------ */

const root = document.getElementById("app") || document.body;

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

const CURRENT_GAME_KEY = "cq_current_game_id_v1"; // add this near TOKENS_STORAGE_KEY

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
  // Normal organiser flow
  return "intro";
}
const TOKENS_STORAGE_KEY = "cq_host_tokens_v1";

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
      model.state = next.trim();
      notifyWatchers();
    }
  },

  // Let screens stash extra data (setup, hosts, gameId, etc.)
  // without forcing an immediate re-render.
  patch(delta) {
    if (!delta || typeof delta !== "object") return;
    Object.assign(model, delta);
    // deliberately NO notifyWatchers() here
  }
};

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
    const maybeCleanup = renderer(root, model, actions);
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
  try {
    await loadSkin();
    skin.apply(root);
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
