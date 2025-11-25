// path: src/skins/cooking/screens/OrganiserHomeScreen.js
// Organiser Home – central hub for a single Culinary Quest game

import { readGame } from "../../../engine/firestore.js";

const CURRENT_GAME_KEY = "cq_current_game_id_v1";

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

function normaliseStatus(raw) {
  const s = (raw || "").toLowerCase();
  switch (s) {
    case "links":
      return {
        key: "links",
        label: "Collecting RSVPs",
        description: "Host links are live. Guests are still accepting or declining.",
        color: "#1d4ed8"
      };
    case "availability":
      return {
        key: "availability",
        label: "Checking availability",
        description: "Hosts are confirming which nights they can’t attend.",
        color: "#7c3aed"
      };
    case "inprogress":
    case "started":
      return {
        key: "inProgress",
        label: "Game in progress",
        description: "Dinners are underway. Host links show the next live event.",
        color: "#15803d"
      };
    case "finished":
      return {
        key: "finished",
        label: "Finished",
        description: "All dinners are complete. Ready to review scores and results.",
        color: "#0f172a"
      };
    case "cancelled":
      return {
        key: "cancelled",
        label: "Cancelled",
        description: "This Culinary Quest has been cancelled.",
        color: "#b91c1c"
      };
    default:
      return {
        key: "unknown",
        label: "Draft / unknown",
        description: "Status not set yet. You can still manage hosts and links.",
        color: "#6b7280"
      };
  }
}

function renderShell(root) {
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

      <!-- ENTREE -->
      <section class="menu-section">
        <div class="menu-course">ENTRÉE</div>
        <h2 class="menu-h2">ORGANISER HOME</h2>
        <p class="menu-copy" id="homeIntro">
          Loading your game details…
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- MAIN -->
      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">GAME OVERVIEW</h2>
        <div id="homeSummary">
          <p class="menu-copy">Fetching latest info from the cloud…</p>
        </div>

        <div class="menu-divider" aria-hidden="true" style="margin-top:16px;"></div>

        <h2 class="menu-h2" style="margin-top:14px;">WHAT WOULD YOU LIKE TO DO?</h2>
        <div class="menu-actions" style="flex-direction:column;gap:8px;margin-top:8px;">
          <button class="btn btn-primary" id="homeLinks">
            View / copy host links &amp; invites
          </button>
          <button class="btn btn-primary" id="homeRsvpTracker">
            Open RSVP tracker
          </button>
          <button class="btn btn-secondary" id="homeBackIntro">
            Back to intro
          </button>
        </div>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>
      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
        OrganiserHomeScreen – hub for managing your Quest
      </p>
    </section>
  `;
}

export function render(root, model = {}, actions = {}) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  scrollToTop();
  renderShell(root);

  const introEl      = root.querySelector("#homeIntro");
  const summaryEl    = root.querySelector("#homeSummary");
  const linksBtn     = root.querySelector("#homeLinks");
  const trackerBtn   = root.querySelector("#homeRsvpTracker");
  const backIntroBtn = root.querySelector("#homeBackIntro");

  // Wire buttons immediately (they don't depend on data)
  if (linksBtn) {
    linksBtn.addEventListener("click", () => {
      try {
        actions.setState && actions.setState("links");
      } catch (_) {}
    });
  }

  if (trackerBtn) {
    trackerBtn.addEventListener("click", () => {
      try {
        actions.setState && actions.setState("rsvpTracker");
      } catch (_) {}
    });
  }

  if (backIntroBtn) {
    backIntroBtn.addEventListener("click", () => {
      try {
        actions.setState && actions.setState("intro");
      } catch (_) {}
    });
  }

  // Work out which game to load
  let gameId =
    (model && typeof model.gameId === "string" && model.gameId.trim()) || null;

  if (!gameId) {
    try {
      const stored = window.localStorage.getItem(CURRENT_GAME_KEY);
      if (stored && stored.trim()) {
        gameId = stored.trim();
      }
    } catch (_) {}
  }

  if (!gameId) {
    if (introEl) {
      introEl.textContent = "We couldn’t find your current game.";
    }
    if (summaryEl) {
      summaryEl.innerHTML = `
        <p class="menu-copy">
          It looks like you don’t have an active game selected on this device.
          <br><br>
          Go back to the intro screen and start a new Culinary Quest, or load an
          existing one if you’ve added that flow later on.
        </p>
      `;
    }
    return;
  }

  // Async load game details
  (async () => {
    try {
      const game = await readGame(gameId);
      if (!game) {
        if (introEl) {
          introEl.textContent = "We couldn’t load this game from the cloud.";
        }
        if (summaryEl) {
          summaryEl.innerHTML = `
            <p class="menu-copy">
              This game may have been deleted. You might need to start a new Culinary Quest.
            </p>
          `;
        }
        return;
      }

      const statusInfo = normaliseStatus(game.status);
      const organiserName =
        (game.organiserName && String(game.organiserName)) || "you";
      const hosts = Array.isArray(game.hosts) ? game.hosts : [];
      const hostCount = hosts.length;

      if (introEl) {
        introEl.innerHTML = `
          Welcome back, <strong>${esc(organiserName)}</strong>.
          <br>
          You’re managing game <strong>${esc(game.gameId || gameId)}</strong>.
        `;
      }

      const hostNames = hosts
        .map((h, idx) => (h && h.name ? String(h.name) : `Host ${idx + 1}`))
        .slice(0, 6); // don’t explode the screen

      const extraHosts =
        hostCount > 6 ? ` + ${hostCount - 6} more` : "";

      if (summaryEl) {
        summaryEl.innerHTML = `
          <p class="menu-copy" style="margin-bottom:10px;">
            <strong>Status:</strong>
            <span style="display:inline-block;margin-left:4px;padding:2px 6px;border-radius:999px;font-size:11px;font-weight:600;color:#fff;background:${statusInfo.color};">
              ${esc(statusInfo.label)}
            </span>
            <br>
            <span class="muted" style="font-size:12px;">
              ${esc(statusInfo.description)}
            </span>
          </p>

          <p class="menu-copy" style="margin-bottom:8px;">
            <strong>Hosts:</strong>
            ${hostCount ? hostCount : "No hosts yet"}
            ${hostCount ? "<br><span style='font-size:12px;'>" +
              esc(hostNames.join(", ")) +
              extraHosts +
              "</span>" : ""}
          </p>
        `;
      }
    } catch (err) {
      console.error("[OrganiserHomeScreen] Failed to load game", err);
      if (introEl) {
        introEl.textContent = "We hit a problem loading your game details.";
      }
      if (summaryEl) {
        summaryEl.innerHTML = `
          <p class="menu-copy">
            Please check your connection and try again in a moment.
          </p>
        `;
      }
    }
  })();
}
