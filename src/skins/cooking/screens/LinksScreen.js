// path: src/skins/cooking/screens/LinksScreen.js
// LinksScreen – organiser view of host invite URLs

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

export function render(root, model = {}, actions = {}) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  // Scroll to the top – avoids iOS zoom weirdness
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

  // Basic shell – host list will be filled in after we load
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
        <h2 class="menu-h2">Host invite links</h2>
        <p class="menu-copy" id="linksIntro">
          Here are the personalised invite links for each host.
        </p>

        <div class="menu-actions" style="margin-top:12px;">
          <button class="btn btn-primary" id="linksRefresh">
            Refresh host list
          </button>
        </div>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- MAIN -->
      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">Links for your hosts</h2>
        <div id="linksHostList">
          <p class="menu-copy">
            Loading host links…
          </p>
        </div>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <div class="menu-actions">
        <button class="btn btn-secondary" id="linksBack">
          Back to setup
        </button>
        <button class="btn btn-primary" id="linksTracker">
          View RSVP tracker
        </button>
      </div>

      <p class="muted" style="text-align:center;margin-top:8px;font-size:11px;">
        LinksScreen – organiser view of host invite URLs
      </p>
    </section>
  `;

  const introEl   = root.querySelector("#linksIntro");
  const listWrap  = root.querySelector("#linksHostList");
  const backBtn   = root.querySelector("#linksBack");
  const trackerBtn= root.querySelector("#linksTracker");
  const refreshBtn= root.querySelector("#linksRefresh");

  // --- navigation buttons: always wired, even in error state ---

  if (backBtn && actions && typeof actions.setState === "function") {
    backBtn.addEventListener("click", () => {
      actions.setState("hosts" /* or "setup" if you prefer */);
    });
  }

  if (trackerBtn && actions && typeof actions.setState === "function") {
    trackerBtn.addEventListener("click", () => {
      actions.setState("rsvpTracker");
    });
  }

  // Work out which game id to use
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

  async function loadHostLinks() {
    if (!introEl || !listWrap) return;

    if (!gameId) {
      introEl.textContent = "We couldn’t find your game details.";
      listWrap.innerHTML = `
        <p class="menu-copy">
          Please go back to the setup screens, create a new Quest and then return here.
        </p>
      `;
      return;
    }

    // Keep the current game id in localStorage for other screens
    try {
      window.localStorage.setItem(CURRENT_GAME_KEY, gameId);
    } catch (_) {}

    introEl.textContent = "Here are the personalised invite links for each host.";
    listWrap.innerHTML = `
      <p class="menu-copy">Loading host links…</p>
    `;

    try {
      const game = await readGame(gameId);
      if (!game) {
        introEl.textContent = "We couldn’t find your game details.";
        listWrap.innerHTML = `
          <p class="menu-copy">
            This Quest no longer exists in the cloud. You may need to start a new one.
          </p>
        `;
        return;
      }

      const hosts = Array.isArray(game.hosts) ? game.hosts : [];
      if (!hosts.length) {
        listWrap.innerHTML = `
          <p class="menu-copy">
            No hosts found yet. Go back and add your fellow hosts first.
          </p>
        `;
        return;
      }

      const baseUrl = `${window.location.origin}${window.location.pathname}`;
      const rowsHtml = hosts
        .map((host, index) => {
          const name = host && host.name ? String(host.name) : `Host ${index + 1}`;
          const token =
            host && typeof host.token === "string" ? host.token : null;

          if (!token) {
            return `
              <div class="menu-copy" style="margin:8px 0;">
                <strong>${esc(name)}</strong><br>
                <span class="muted">No invite token yet – please refresh after saving hosts.</span>
              </div>
            `;
          }

          const url =
            `${baseUrl}?invite=${encodeURIComponent(token)}` +
            `&game=${encodeURIComponent(game.gameId || gameId)}`;

          return `
            <div
              class="link-row"
              data-url="${esc(url)}"
              style="
                padding:8px 10px;
                margin:6px 0;
                border-radius:12px;
                background:#ffffff;
                box-shadow:0 1px 2px rgba(0,0,0,0.06);
                font-size:13px;
                text-align:left;
              "
            >
              <div style="font-weight:600;margin-bottom:2px;">
                ${esc(name)}
              </div>
              <div class="muted" style="font-size:11px;margin-bottom:4px;">
                Tap to copy invite link
              </div>
              <div
                class="muted"
                style="
                  word-break:break-all;
                  font-size:10px;
                  line-height:1.4;
                "
              >
                ${esc(url)}
              </div>
            </div>
          `;
        })
        .join("");

      listWrap.innerHTML = `
        <div class="links-list">
          ${rowsHtml}
        </div>
      `;

      // Simple “tap to copy” behaviour
      const linkRows = root.querySelectorAll(".link-row");
      linkRows.forEach((row) => {
        row.addEventListener("click", () => {
          const url = row.getAttribute("data-url");
          if (!url) return;

          const statusEl = row.querySelector(".muted");

          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard
              .writeText(url)
              .then(() => {
                if (statusEl) {
                  statusEl.textContent = "Link copied to clipboard";
                }
              })
              .catch(() => {
                window.prompt("Copy this invite link:", url);
              });
          } else {
            window.prompt("Copy this invite link:", url);
          }
        });
      });
    } catch (err) {
      console.error("[LinksScreen] Failed to load host links", err);
      introEl.textContent = "We hit a problem loading your host links.";
      listWrap.innerHTML = `
        <p class="menu-copy">
          Please check your connection and tap <strong>Refresh host list</strong> to try again.
        </p>
      `;
    }
  }

  // Initial load
  loadHostLinks();

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      loadHostLinks();
    });
  }
}
