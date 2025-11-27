// path: src/skins/cooking/screens/OrganiserHomeScreen.js
// Organiser home – simple hub with Home / My games tabs

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

export function render(root, model = {}, actions = {}) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  scrollToTop();

  // Basic shell with two panes + bottom nav
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

      <!-- HOME PANE -->
      <section class="menu-section" id="homePane">
        <div class="menu-course">ENTRÉE</div>
        <h2 class="menu-h2">Organiser home</h2>
        <p class="menu-copy">
          Welcome back to <em>Culinary Quest</em>. From here you can start a new
          competition or jump into a Quest you’ve already created.
        </p>

        <div class="menu-actions" style="margin-top:14px;">
          <button class="btn btn-primary" id="homeStartNew">
            Start a new Culinary Quest
          </button>
        </div>

        <p class="muted" style="margin-top:10px;font-size:11px;">
          You can still come back here at any time without disturbing a Quest
          that’s already under way.
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- MY GAMES PANE -->
      <section class="menu-section" id="gamesPane" style="display:none;">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">My games</h2>

        <div id="gamesPaneContent">
          <p class="menu-copy">
            Looking for your current Quest…
          </p>
        </div>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <!-- BOTTOM NAV (Home / My games) -->
      <nav
        class="bottom-nav"
        style="
          margin-top:8px;
          padding:8px 12px 4px;
          border-top:1px solid rgba(0,0,0,0.06);
          display:flex;
          justify-content:space-around;
          gap:12px;
        "
      >
        <button
          class="bottom-nav-item bottom-nav-item--active"
          data-tab="home"
          style="
            flex:1;
            border:none;
            background:none;
            font-size:12px;
            padding:6px 0;
          "
        >
          <div style="font-weight:600;">Home</div>
        </button>

        <button
          class="bottom-nav-item"
          data-tab="games"
          style="
            flex:1;
            border:none;
            background:none;
            font-size:12px;
            padding:6px 0;
          "
        >
          <div style="font-weight:600;">My games</div>
        </button>
      </nav>

      <p class="muted" style="text-align:center;margin-top:4px;font-size:11px;">
        OrganiserHomeScreen – Home / My games hub
      </p>
    </section>
  `;

  const homePane   = root.querySelector("#homePane");
  const gamesPane  = root.querySelector("#gamesPane");
  const homeTab    = root.querySelector('[data-tab="home"]');
  const gamesTab   = root.querySelector('[data-tab="games"]');
  const startBtn   = root.querySelector("#homeStartNew");
  const gamesShell = root.querySelector("#gamesPaneContent");

  function selectTab(tab) {
    if (!homePane || !gamesPane || !homeTab || !gamesTab) return;

    if (tab === "games") {
      homePane.style.display = "none";
      gamesPane.style.display = "block";
      homeTab.classList.remove("bottom-nav-item--active");
      gamesTab.classList.add("bottom-nav-item--active");
    } else {
      homePane.style.display = "block";
      gamesPane.style.display = "none";
      homeTab.classList.add("bottom-nav-item--active");
      gamesTab.classList.remove("bottom-nav-item--active");
    }
  }

  if (homeTab) {
    homeTab.addEventListener("click", () => selectTab("home"));
  }
  if (gamesTab) {
    gamesTab.addEventListener("click", () => {
      selectTab("games");
    });
  }

// Start new Quest → clear current game + local host data and go back into setup flow
if (startBtn && actions && typeof actions.setState === "function") {
  startBtn.addEventListener("click", () => {
    try {
      // Clear all local “current game” data
      window.localStorage.removeItem(CURRENT_GAME_KEY);
      window.localStorage.removeItem("cq_hosts_v1");
      window.localStorage.removeItem("cq_host_nights_v1");
      window.localStorage.removeItem("cq_host_tokens_v1");
    } catch (_) {
      // ignore storage errors
    }

    try {
      // Reset in-memory model bits
      if (typeof actions.patch === "function") {
        actions.patch({
          gameId: null,
          hosts: [],
          hostNights: {},
          setup: null
        });
      }
    } catch (_) {
      // ignore
    }

    // Back into the usual setup flow
    actions.setState("intro");
  });
}
  // ---- Load current game summary for "My games" pane ----
  selectTab("games");  // default to My games when returning, feels natural

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
    if (gamesShell) {
      gamesShell.innerHTML = `
        <p class="menu-copy">
          You don’t have an active Quest yet.
        </p>
        <div class="menu-actions" style="margin-top:10px;">
          <button class="btn btn-primary" id="gamesStartFromPane">
            Start your first Culinary Quest
          </button>
        </div>
      `;
      const paneStart = root.querySelector("#gamesStartFromPane");
      if (paneStart && actions && typeof actions.setState === "function") {
        paneStart.addEventListener("click", () => {
          try {
            window.localStorage.removeItem(CURRENT_GAME_KEY);
          } catch (_) {}
          if (actions.patch) {
            actions.patch({ gameId: null });
          }
          actions.setState("intro");
        });
      }
    }
    return;
  }

  // We have a gameId – fetch summary and show an "Open dashboard" button
  (async () => {
    if (!gamesShell) return;

    gamesShell.innerHTML = `
      <p class="menu-copy">Loading your current Quest…</p>
    `;

    try {
      const game = await readGame(gameId);

      if (!game) {
        gamesShell.innerHTML = `
          <p class="menu-copy">
            We couldn’t find this Quest in the cloud. It may have been deleted
            or created on another device.
          </p>
          <div class="menu-actions" style="margin-top:10px;">
            <button class="btn btn-primary" id="gamesStartFresh">
              Start a new Culinary Quest
            </button>
          </div>
        `;
        const freshBtn = root.querySelector("#gamesStartFresh");
        if (freshBtn && actions && typeof actions.setState === "function") {
          freshBtn.addEventListener("click", () => {
            try {
              window.localStorage.removeItem(CURRENT_GAME_KEY);
            } catch (_) {}
            if (actions.patch) {
              actions.patch({ gameId: null });
            }
            actions.setState("intro");
          });
        }
        return;
      }

      const name =
        (game.name && String(game.name)) ||
        (game.setup && game.setup.title) ||
        "Untitled Culinary Quest";

      const code   = game.gameId || gameId;
      const status = (game.status && String(game.status)) || "draft";
      const hosts  = Array.isArray(game.hosts) ? game.hosts.length : 0;

      gamesShell.innerHTML = `
        <div
          class="menu-copy"
          style="
            text-align:left;
            font-size:13px;
            padding:10px 12px;
            border-radius:16px;
            background:#ffffff;
            box-shadow:0 1px 3px rgba(0,0,0,0.08);
          "
        >
          <div style="font-weight:600;margin-bottom:4px;">
            ${esc(name)}
          </div>
          <div style="margin-bottom:2px;">
            <strong>Game code:</strong> ${esc(code)}
          </div>
          <div style="margin-bottom:2px;">
            <strong>Hosts:</strong> ${hosts || 0}
          </div>
          <div>
            <strong>Status:</strong> ${esc(status)}
          </div>
        </div>

        <div class="menu-actions" style="margin-top:12px;">
          <button class="btn btn-primary" id="gamesOpenDashboard">
            Open Quest dashboard
          </button>
        </div>
      `;

      const openBtn = root.querySelector("#gamesOpenDashboard");
      if (openBtn && actions && typeof actions.setState === "function") {
        openBtn.addEventListener("click", () => {
          // Remember this as the current game in the model and localStorage
          try {
            window.localStorage.setItem(CURRENT_GAME_KEY, code);
          } catch (_) {}
          if (actions.patch) {
            actions.patch({ gameId: code });
          }
          actions.setState("gameDashboard");
        });
      }
    } catch (err) {
      console.error("[OrganiserHome] Failed to load game summary", err);
      gamesShell.innerHTML = `
        <p class="menu-copy">
          We hit a problem loading your current Quest.
          Please check your connection and try again in a moment.
        </p>
      `;
    }
  })();
}
