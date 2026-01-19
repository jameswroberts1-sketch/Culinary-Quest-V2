// path: src/skins/cooking/screens/GameDashboardScreen.js
// Game dashboard – organiser hub for a single Culinary Quest

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

function buildBaseUrl() {
  const { origin, pathname } = window.location;
  return origin + pathname;
}

function normaliseGameStatus(raw) {
  const s = (raw || "").toLowerCase();

  switch (s) {
    case "planning":
    case "setup":
      return {
        key: "planning",
        label: "Planning",
        color: "#555",
        next: "Add your hosts and generate invite links."
      };
    case "links":
      return {
        key: "links",
        label: "Invites sent",
        color: "#1c7c33",
        next: "Collect RSVPs and check everyone has chosen a night."
      };
    case "availability":
      return {
        key: "availability",
        label: "Availability check",
        color: "#e67e22",
        next: "Review who can’t attend each night and adjust the schedule if needed."
      };
    case "inprogress":
    case "started":
      return {
        key: "inProgress",
        label: "In progress",
        color: "#1c7c33",
        next: "Keep an eye on tonight’s host and get ready for scoring."
      };
    case "finished":
      return {
        key: "finished",
        label: "Finished",
        color: "#34495e",
        next: "Review the final leaderboard and share the results."
      };
    case "cancelled":
      return {
        key: "cancelled",
        label: "Cancelled",
        color: "#c0392b",
        next: "This Quest has been cancelled."
      };
    default:
      return {
        key: "unknown",
        label: "Draft",
        color: "#777",
        next: "Finish setting up your hosts and links to get started."
      };
  }
}

export function render(root, model = {}, actions = {}) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  scrollToTop();

  // Work out which game to show
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
    // No current game – gentle nudge back to organiser home
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
          <h2 class="menu-h2">NO ACTIVE GAME</h2>
          <p class="menu-copy">
            We couldn’t find a current Culinary Quest to show here.
            Go back to your organiser home screen and either start a new game
            or pick one from <strong>My games</strong>.
          </p>

          <div class="menu-actions" style="margin-top:12px;">
            <button class="btn btn-primary" id="dashBackHome">
              Back to organiser home
            </button>
          </div>
        </section>
      </section>
    `;

    const backBtn = root.querySelector("#dashBackHome");
    if (backBtn && actions && typeof actions.setState === "function") {
      backBtn.addEventListener("click", () => {
        actions.setState("organiserHome");
      });
    }
    return;
  }

  // Lightweight loading state
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
        <h2 class="menu-h2">LOADING YOUR QUEST…</h2>
        <p class="menu-copy">
          One moment while we fetch your organiser dashboard.
        </p>
      </section>
    </section>
  `;

  (async () => {
    try {
      const game = await readGame(gameId);
      if (!game) {
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
              <h2 class="menu-h2">GAME NOT FOUND</h2>
              <p class="menu-copy">
                We couldn’t find this Culinary Quest in the cloud.
                It may have been deleted or you may have switched devices.
                You can go back and start a new game from your organiser home.
              </p>

              <div class="menu-actions" style="margin-top:12px;">
                <button class="btn btn-primary" id="dashBackHome">
                  Back to organiser home
                </button>
              </div>
            </section>
          </section>
        `;
        const backBtn = root.querySelector("#dashBackHome");
        if (backBtn && actions && typeof actions.setState === "function") {
          backBtn.addEventListener("click", () => {
            actions.setState("organiserHome");
          });
        }
        return;
      }

      const gameName =
        (game.name && String(game.name)) ||
        (game.setup && game.setup.title) ||
        "Untitled Culinary Quest";

      const code = game.gameId || gameId;
      const statusInfo = normaliseGameStatus(game.status);
      const organiserName =
        (game.organiserName && String(game.organiserName)) ||
        "Organiser";

      // Rough “tonight’s host” hint when in progress
      let tonightLine = "";
      if (
        statusInfo.key === "inProgress" &&
        Array.isArray(game.hosts) &&
        game.rsvps
      ) {
        // Find earliest upcoming accepted night
        const rsvps = game.rsvps;
        const events = [];

        Object.keys(rsvps).forEach((k) => {
          const idx = Number(k);
          const r = rsvps[k];
          if (!r || r.status !== "accepted" || !r.date) return;
          const time = r.time || "19:00";
          const dt = new Date(`${r.date}T${time}:00`);
          if (Number.isNaN(dt.getTime())) return;
          events.push({ idx, when: dt.getTime(), rsvp: r });
        });

        events.sort((a, b) => a.when - b.when);
        const now = Date.now();
        const upcoming = events.find((e) => e.when >= now) || events[events.length - 1];

        if (upcoming) {
          const hostDoc = game.hosts[upcoming.idx] || {};
          const hostName = hostDoc.name || `Host ${upcoming.idx + 1}`;
          tonightLine = `
            <p class="menu-copy" style="margin-top:6px;font-size:13px;">
              Tonight’s host: <strong>${esc(hostName)}</strong>
            </p>
          `;
        }
      }

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

          <!-- ENTREE: header & next step -->
          <section class="menu-section">
            <div class="menu-course">ENTRÉE</div>
            <h2 class="menu-h2">${esc(gameName)}</h2>

            <p class="menu-copy" style="margin-bottom:6px;">
              Game code: <strong>${esc(code)}</strong><br />
              Organiser: <strong>${esc(organiserName)}</strong>
            </p>

            <p class="menu-copy" style="font-size:13px;">
              Status:
              <span
                style="
                  display:inline-block;
                  padding:2px 8px;
                  border-radius:999px;
                  background:${statusInfo.color};
                  color:#fff;
                  font-size:11px;
                  text-transform:uppercase;
                  letter-spacing:0.06em;
                "
              >
                ${esc(statusInfo.label)}
              </span>
            </p>

            <p class="menu-copy" style="margin-top:8px;">
              Next step:<br />
              <strong>${esc(statusInfo.next)}</strong>
            </p>
            ${tonightLine}
          </section>

          <div class="menu-divider" aria-hidden="true"></div>

          <!-- MAIN: dashboard tiles -->
          <section class="menu-section">
            <div class="menu-course">MAIN</div>
            <h2 class="menu-h2">GAME DASHBOARD</h2>

            <div
              class="dashboard-grid"
              style="
                display:grid;
                grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
                gap:12px;
                margin-top:10px;
              "
            >
              <!-- Hosts & links -->
              <button
                class="dashboard-tile"
                data-nav="links"
                style="
                  border:none;
                  text-align:left;
                  padding:12px 14px;
                  border-radius:16px;
                  background:#ffffff;
                  box-shadow:0 1px 3px rgba(0,0,0,0.08);
                  font-size:13px;
                "
              >
                <div style="font-weight:600;margin-bottom:4px;">Hosts &amp; links</div>
                <div class="muted" style="font-size:11px;">
                  View hosts and copy their invite links.
                </div>
              </button>

              <!-- RSVP tracker -->
              <button
                class="dashboard-tile"
                data-nav="rsvpTracker"
                style="
                  border:none;
                  text-align:left;
                  padding:12px 14px;
                  border-radius:16px;
                  background:#ffffff;
                  box-shadow:0 1px 3px rgba(0,0,0,0.08);
                  font-size:13px;
                "
              >
                <div style="font-weight:600;margin-bottom:4px;">RSVP tracker</div>
                <div class="muted" style="font-size:11px;">
                  See who has accepted, declined or not replied.
                </div>
              </button>

              <!-- Schedule & availability -->
              <button
                class="dashboard-tile"
                data-nav="availability"
                style="
                  border:none;
                  text-align:left;
                  padding:12px 14px;
                  border-radius:16px;
                  background:#ffffff;
                  box-shadow:0 1px 3px rgba(0,0,0,0.08);
                  font-size:13px;
                "
              >
                <div style="font-weight:600;margin-bottom:4px;">Schedule &amp; availability</div>
                <div class="muted" style="font-size:11px;">
                  Review the full schedule and who can’t attend each night.
                </div>
              </button>

              ${
  (statusInfo.key !== "finished" && statusInfo.key !== "cancelled")
    ? `
  <!-- Live event -->
  <button
    class="dashboard-tile"
    data-nav="liveEvent"
    style="
      border:none;
      text-align:left;
      padding:12px 14px;
      border-radius:16px;
      background:#ffffff;
      box-shadow:0 1px 3px rgba(0,0,0,0.08);
      font-size:13px;
    "
  >
    <div style="font-weight:600;margin-bottom:4px;">Live event</div>
    <div class="muted" style="font-size:11px;">
      ${
        statusInfo.key === "inProgress"
          ? "Jump to the current host’s view during the game."
          : "Open your host view (as your guests see it)."
      }
    </div>
  </button>
  `
    : ""
}

              ${
                statusInfo.key === "finished"
                  ? `
              <!-- Results -->
              <button
                class="dashboard-tile"
                data-nav="results"
                style="
                  border:none;
                  text-align:left;
                  padding:12px 14px;
                  border-radius:16px;
                  background:#ffffff;
                  box-shadow:0 1px 3px rgba(0,0,0,0.08);
                  font-size:13px;
                "
              >
                <div style="font-weight:600;margin-bottom:4px;">Results</div>
                <div class="muted" style="font-size:11px;">
                  View the final leaderboard and placements.
                </div>
              </button>
              `
                  : ""
              }
            </div>
          </section>

          <div class="menu-ornament" aria-hidden="true"></div>

          <div class="menu-actions" style="margin-top:8px;">
            <button class="btn btn-secondary" id="dashBackGames">
              Back to My games
            </button>
          </div>

          <p class="muted" style="text-align:center;margin-top:6px;font-size:11px;">
            GameDashboardScreen – organiser hub for a single Quest
          </p>
        </section>
      `;

      // Wire tile navigation
      const tiles = root.querySelectorAll(".dashboard-tile");
      tiles.forEach((tile) => {
        tile.addEventListener("click", () => {
          const nav = tile.getAttribute("data-nav");
          if (!actions || typeof actions.setState !== "function") return;

          if (nav === "links") {
            actions.setState("links");
          } else if (nav === "rsvpTracker") {
            actions.setState("rsvpTracker");
          } else if (nav === "availability") {
            actions.setState("availability");
          } else if (nav === "liveEvent") {
  (async () => {
    try {
      const g = await readGame(gameId);
      if (!g) {
        window.alert("Sorry — we couldn’t load this game right now.");
        return;
      }

      const tokens = Array.isArray(g.hostTokens)
        ? g.hostTokens
        : Array.isArray(g.tokens)
        ? g.tokens
        : [];

      const organiserToken = tokens[0];
      if (!organiserToken) {
        window.alert(
          "Host invite tokens aren’t set up for this game yet. Open ‘Hosts & links’ once to generate them."
        );
        actions.setState("links");
        return;
      }

      const baseUrl = buildBaseUrl();
      const gid = gameId; // ALWAYS the Firestore doc id

      const url =
        `${baseUrl}?game=${encodeURIComponent(gid)}` +
        `&invite=${encodeURIComponent(organiserToken)}` +
        `&from=organiser`;

       // Tell app.js this is organiser play-mode (so keep the ribbon visible)
      try {
        window.localStorage.setItem("cq_organiser_play_v1", "1");
        window.localStorage.setItem(CURRENT_GAME_KEY, gameId); // belt & braces
      } catch (_) {}

      // Same tab (simple on iPhone). Use window.open(url, "_blank") if you prefer.
      window.location.assign(url);
    } catch (err) {
      console.warn("[GameDashboardScreen] Live event open failed", err);
      window.alert("Sorry — we couldn’t open the live event view just now.");
    }
  })();
} else if (nav === "results") {
            // For now, this can go to the existing "finished" stub
            actions.setState("finished");
          }
        });
      });

      const backGamesBtn = root.querySelector("#dashBackGames");
      if (backGamesBtn && actions && typeof actions.setState === "function") {
        backGamesBtn.addEventListener("click", () => {
          actions.setState("organiserHome");
        });
      }
    } catch (err) {
      console.error("[GameDashboardScreen] Failed to load game", err);
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
            <h2 class="menu-h2">SOMETHING WENT WRONG</h2>
            <p class="menu-copy">
              We hit a problem loading this Quest’s dashboard.
              Please check your connection and try again from your organiser home screen.
            </p>

            <div class="menu-actions" style="margin-top:12px;">
              <button class="btn btn-primary" id="dashBackHome">
                Back to organiser home
              </button>
            </div>
          </section>
        </section>
      `;
      const backBtn = root.querySelector("#dashBackHome");
      if (backBtn && actions && typeof actions.setState === "function") {
        backBtn.addEventListener("click", () => {
          actions.setState("organiserHome");
        });
      }
    }
  })();
}
