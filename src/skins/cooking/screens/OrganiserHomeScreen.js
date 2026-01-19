// path: src/skins/cooking/screens/OrganiserHomeScreen.js
// Organiser home – simple hub with Home / My games tabs

import { listMyOpenGames } from "../../../engine/firestore.js";

const LOCAL_KEYS_TO_CLEAR = [
  "cq_current_game_id_v1", // current game id
  "cq_setup_v2",           // setup screen config
  "cq_hosts_v1",           // host names on organiser’s device
  "cq_host_nights_v1",     // host chosen dates/times
  "cq_host_tokens_v1",     // invite tokens cache
  "cq_intro_done",         // intro has been completed
  "cq_organiser_name"      // organiser name cache
];

function clearLocalGameState() {
  LOCAL_KEYS_TO_CLEAR.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch (_) {}
  });
}

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

function stripHostParamsFromUrl() {
  try {
    const url = new URL(window.location.href);
    ["invite", "game", "from"].forEach((k) => url.searchParams.delete(k));
    // optional: also remove state/route if you don’t rely on them
    // ["state","route"].forEach((k) => url.searchParams.delete(k));
    window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
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
    stripHostParamsFromUrl();
    clearLocalGameState();

    try {
      if (actions.patch) {
  actions.patch({ gameId: null, setup: null, hosts: null, organiserName: null });
}

    } catch (_) {}

    actions.setState("intro"); // your usual starting point
  });
}
// ---- Load "My games" from Firestore (open games only) ----
selectTab("games"); // default to My games when returning

(async () => {
  if (!gamesShell) return;

  gamesShell.innerHTML = `<p class="menu-copy">Loading your open Quests…</p>`;

  try {
    const games = await listMyOpenGames(25);

    if (!games.length) {
      gamesShell.innerHTML = `
        <p class="menu-copy">
          You don’t have any open Quests right now.
        </p>
        <div class="menu-actions" style="margin-top:10px;">
          <button class="btn btn-primary" id="gamesStartFromPane">
            Start a new Culinary Quest
          </button>
        </div>
      `;

      const paneStart = root.querySelector("#gamesStartFromPane");
      if (paneStart && actions && typeof actions.setState === "function") {
        paneStart.addEventListener("click", () => {
          stripHostParamsFromUrl();
          clearLocalGameState();
          if (actions.patch) {
            actions.patch({ gameId: null, setup: null, hosts: null, organiserName: null });
          }
          actions.setState("intro");
        });
      }
      return;
    }

    gamesShell.innerHTML = `
      <div class="menu-copy" style="text-align:left;font-size:13px;">
        ${games
          .map((g) => {
            const name =
              (g.name && String(g.name)) ||
              (g.setup && (g.setup.gameTitle || g.setup.title)) ||
              "Untitled Culinary Quest";

            const docId = g.id;                 // Firestore document id (use this for routing/storage)
            const code  = g.gameId || g.id;     // display only
            const status = (g.status && String(g.status)) || "draft";
            const hostCount = Array.isArray(g.hosts) ? g.hosts.length : 0;

            return `
              <div
                class="game-card"
                style="
                  margin:10px 0;
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
                  <strong>Hosts:</strong> ${hostCount || 0}
                </div>
                <div style="margin-bottom:10px;">
                  <strong>Status:</strong> ${esc(status)}
                </div>

                <div class="menu-actions" style="margin-top:6px;">
                  <button class="btn btn-primary open-game-btn" data-game-id="${esc(docId)}">
                    Open Quest dashboard
                  </button>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;

    // Wire up open buttons
    const openBtns = gamesShell.querySelectorAll(".open-game-btn");
    openBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-game-id");
        if (!id) return;

        // Optionally remember "last opened" (handy UX; safe)
        try {
          window.localStorage.setItem(CURRENT_GAME_KEY, id);
        } catch (_) {}

        if (actions.patch) actions.patch({ gameId: id });
        actions.setState("gameDashboard");
      });
    });
 } catch (err) {
  console.error("[OrganiserHome] Failed to load open games", err);
  gamesShell.innerHTML = `
    <p class="menu-copy">
      We hit a problem loading your open Quests.
    </p>
    <p class="muted" style="text-align:center;margin-top:6px;font-size:11px;">
      ${esc(err && err.message ? err.message : String(err))}
    </p>
  `;
}

})();
}
