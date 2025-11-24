// path: src/skins/cooking/screens/RsvpTrackerScreen.js
// Organiser view – see who has RSVPed + their chosen dates/themes.

import { readGame } from "../../../engine/firestore.js";

const CURRENT_GAME_KEY = "cq_current_game_id_v1";
const NIGHTS_STORAGE_KEY = "cq_host_nights_v1";

/* ---------------- helpers ---------------- */

function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scrollToTop() {
  try {
    const scroller =
      document.scrollingElement ||
      document.documentElement ||
      document.body;
    if (scroller && typeof scroller.scrollTo === "function") {
      scroller.scrollTo({ top: 0, left: 0, behavior: "instant" });
    } else {
      scroller.scrollTop = 0;
      scroller.scrollLeft = 0;
    }
  } catch (_) {}
}

function loadLocalNights() {
  try {
    const raw = window.localStorage.getItem(NIGHTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
}

function renderError(root, message) {
  root.innerHTML = `
    <section class="menu-card">
      <div class="menu-hero">
        <img
          class="menu-logo"
          src="./src/skins/cooking/assets/cq-logo.png"
          alt="Culinary Quest"
        />
      </div>

      <div class="menu-ornament" aria-hidden="true"></div>

      <section class="menu-section">
        <div class="menu-course">ENTRÉE</div>
        <h2 class="menu-h2">Something went wrong</h2>
        <p class="menu-copy">
          ${esc(message || "We couldn't load your RSVPs right now.")}
        </p>
      </section>
    </section>
  `;
}

/* ---------------- main render ---------------- */

export function render(root, model = {}, actions = {}) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  scrollToTop();

  // Work out which game to show
  let gameId =
    (model && typeof model.gameId === "string" && model.gameId.trim()) || null;

  if (!gameId) {
    // URL ?game param (e.g. if you ever deep-link the organiser)
    try {
      const params = new URLSearchParams(window.location.search);
      const urlGame = params.get("game");
      if (urlGame && urlGame.trim()) {
        gameId = urlGame.trim();
      }
    } catch (_) {}
  }

  if (!gameId) {
    // Last game used on this device
    try {
      const stored = window.localStorage.getItem(CURRENT_GAME_KEY);
      if (stored && stored.trim()) {
        gameId = stored.trim();
      }
    } catch (_) {}
  }

  if (!gameId) {
    renderError(root, "We couldn't find a game to track. Please create a new game and share links first.");
    return;
  }

  // Remember it in the in-memory model for other screens
  if (model) {
    model.gameId = gameId;
    try {
      if (actions && typeof actions.patch === "function") {
        actions.patch({ gameId });
      }
    } catch (_) {}
  }

  // Initial loading shell
  root.innerHTML = `
    <section class="menu-card">
      <div class="menu-hero">
        <img
          class="menu-logo"
          src="./src/skins/cooking/assets/cq-logo.png"
          alt="Culinary Quest"
        />
      </div>

      <div class="menu-ornament" aria-hidden="true"></div>

      <section class="menu-section">
        <div class="menu-course">ENTRÉE</div>
        <h2 class="menu-h2">RSVP TRACKER</h2>
        <p class="menu-copy">
          One moment while we fetch the latest RSVPs for your game.
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">HOST LINE-UP</h2>
        <p class="menu-copy">
          Loading hosts and their chosen dates…
        </p>
        <ul class="hosts-list" id="rsvpList"></ul>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <div class="menu-actions">
        <button class="btn btn-secondary" id="rsvpBack">Back to links</button>
        <button class="btn btn-primary" id="rsvpRefresh">Refresh RSVPs</button>
      </div>

      <p class="muted"
         id="rsvpStatus"
         style="text-align:center;margin-top:6px;font-size:10px;">
        Loading game <strong>${esc(gameId)}</strong>…
      </p>

      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
        RsvpTrackerScreen – organiser view of RSVPs
      </p>
    </section>
  `;

  const listEl     = root.querySelector("#rsvpList");
  const statusEl   = root.querySelector("#rsvpStatus");
  const backBtn    = root.querySelector("#rsvpBack");
  const refreshBtn = root.querySelector("#rsvpRefresh");

  if (!listEl) return;

  const localNights = loadLocalNights();

  async function loadAndRenderFromFirestore(isManualRefresh = false) {
    if (statusEl) {
      statusEl.textContent = isManualRefresh
        ? `Refreshing RSVPs for ${gameId}…`
        : `Loading RSVPs for ${gameId}…`;
    }

    try {
      const game = await readGame(gameId);
      if (!game) {
        renderError(root, "We couldn't find that game in the cloud. It may have been deleted.");
        return;
      }

      const hosts = Array.isArray(game.hosts) ? game.hosts : [];
      const rsvps = game.rsvps && typeof game.rsvps === "object" ? game.rsvps : {};
      const allowThemes =
        game &&
        game.setup &&
        typeof game.setup.allowThemes === "boolean"
          ? game.setup.allowThemes
          : false;

      let acceptedCount = 0;
      let declinedCount = 0;
      let pendingCount  = 0;

      const rows = hosts.map((hostDoc, index) => {
        const name = hostDoc && hostDoc.name ? hostDoc.name : `Host ${index + 1}`;
        const role = hostDoc && hostDoc.role === "organiser" ? "Organiser" : "Host";

        // Firestore RSVP for this host (if any)
        const rsvp = rsvps[index] || {};

        // Merge in any local cache for THIS browser (useful if organiser just changed date)
        const local = localNights[index] || {};
        const merged = {
          status: local.status || rsvp.status || null,
          date:   local.date   || rsvp.date   || null,
          time:   local.time   || rsvp.time   || null,
          theme:  local.theme  || rsvp.theme  || null
        };

        let statusLabel = "Awaiting reply";
        let statusClass = "pending";
        if (merged.status === "accepted") {
          statusLabel = "Accepted";
          statusClass = "accepted";
          acceptedCount++;
        } else if (merged.status === "declined") {
          statusLabel = "Declined";
          statusClass = "declined";
          declinedCount++;
        } else {
          pendingCount++;
        }

        const datePart = merged.date || "No date chosen";
        const timePart = merged.time ? ` at ${merged.time}` : "";
        const when = `${datePart}${timePart}`;

        const themePart =
          allowThemes && merged.theme
            ? `<div class="host-row-theme">Theme: ${esc(merged.theme)}</div>`
            : "";

        return `
          <li class="host-row host-row--rsvp">
            <div class="host-row-label">Host ${index + 1}</div>
            <div class="host-row-main">
              <div class="host-row-name">${esc(name)}</div>
              <div class="host-row-meta">${esc(role)}</div>
              <div class="host-row-when">${esc(when)}</div>
              ${themePart}
            </div>
            <div class="host-row-status host-row-status--${statusClass}">
              ${esc(statusLabel)}
            </div>
          </li>
        `;
      });

      listEl.innerHTML = rows.length
        ? rows.join("")
        : `<p class="menu-copy">No hosts found for this game.</p>`;

      if (statusEl) {
        statusEl.textContent = `RSVPs loaded for ${gameId} · ${acceptedCount} accepted · ${declinedCount} declined · ${pendingCount} pending`;
      }
    } catch (err) {
      console.error("[RsvpTrackerScreen] Failed to load game", err);
      renderError(root, "We hit a problem loading RSVPs. Please try again in a moment.");
    }
  }

  // Initial load
  loadAndRenderFromFirestore(false);

  // Buttons
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      try {
        actions && actions.setState && actions.setState("links");
      } catch (_) {}
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      loadAndRenderFromFirestore(true);
    });
  }

  // No special cleanup needed
  return () => {};
}
