// path: src/skins/cooking/screens/LinksScreen.js
// Links screen – organiser view of per-host invite URLs

import { readGame, updateGame } from "../../../engine/firestore.js";

const CURRENT_GAME_KEY = "cq_current_game_id_v1";
const TOKENS_STORAGE_KEY = "cq_host_tokens_v1";

// Basic HTML escaping
function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Simple random token generator (URL-safe)
function generateToken() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

// Build a base URL for invite links (works on GitHub Pages too)
function getBaseUrl() {
  const { origin, pathname } = window.location;
  // strip index.html if present
  const cleanPath = pathname.replace(/index\.html?$/i, "");
  return origin + cleanPath;
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
        <div id="linksListContainer">
          <p class="menu-copy">Loading…</p>
        </div>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <div class="menu-actions">
        <button class="btn btn-secondary" id="linksBack">Back to setup</button>
        <button class="btn btn-primary" id="linksRsvp">View RSVP tracker</button>
      </div>

      <p class="muted" id="linksSummary"
         style="text-align:center;margin-top:8px;font-size:11px;">
      </p>

      <p class="muted" style="text-align:center;margin-top:4px;font-size:11px;">
        LinksScreen – organiser view of host invite URLs
      </p>
    </section>
  `;
}

export function render(root, model = {}, actions = {}) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  // Scroll to top (iOS nicety)
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

  renderShell(root);

  const introEl   = root.querySelector("#linksIntro");
  const listWrap  = root.querySelector("#linksListContainer");
  const summaryEl = root.querySelector("#linksSummary");
  const refreshBtn = root.querySelector("#linksRefresh");
  const backBtn   = root.querySelector("#linksBack");
  const rsvpBtn   = root.querySelector("#linksRsvp");

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
      introEl.textContent = "We couldn’t find your game details.";
    }
    if (listWrap) {
      listWrap.innerHTML = `
        <p class="menu-copy">
          Please go back to the setup screens, create a new Quest and then return here.
        </p>
      `;
    }
    return;
  }

  async function loadAndRender() {
    if (introEl) {
      introEl.textContent = "Loading host links…";
    }
    if (listWrap) {
      listWrap.innerHTML = `<p class="menu-copy">Loading…</p>`;
    }

    try {
      const game = await readGame(gameId);
      if (!game) {
        if (introEl) introEl.textContent = "We couldn’t load this game.";
        if (listWrap) {
          listWrap.innerHTML = `
            <p class="menu-copy">
              This game no longer exists in the cloud. You may need to start a new one.
            </p>
          `;
        }
        return;
      }

      const hosts = Array.isArray(game.hosts) ? game.hosts : [];
      if (!hosts.length) {
        if (listWrap) {
          listWrap.innerHTML = `
            <p class="menu-copy">
              No hosts found for this game yet. Go back and make sure you’ve added everyone.
            </p>
          `;
        }
        return;
      }

      // Load any existing tokens from Firestore
      let tokens =
        Array.isArray(game.hostTokens) ? game.hostTokens.slice() :
        Array.isArray(game.tokens) ? game.tokens.slice() :
        [];

      // Ensure the array is at least as long as the hosts list
      if (tokens.length < hosts.length) {
        tokens.length = hosts.length;
      }

      let changed = false;

      // We never show a token / link for the organiser at index 0
      if (tokens[0]) {
        tokens[0] = null;
        changed = true;
      }

      // Ensure every *non-organiser* host has a token
      for (let i = 1; i < hosts.length; i++) {
        const t = tokens[i];
        if (!t || typeof t !== "string" || !t.trim()) {
          tokens[i] = generateToken();
          changed = true;
        } else {
          tokens[i] = t.trim();
        }
      }

      // Always persist the tokens we actually use for links
      try {
        await updateGame(gameId, {
          hostTokens: tokens,
          tokens: tokens
        });
      } catch (err) {
        console.warn("[LinksScreen] Failed to update host tokens in Firestore", err);
      }

      const baseUrl = getBaseUrl();

    const rowsHtml = hosts
        .slice(1) // skip organiser (Host 1)
        .map((host, index) => {
          const realIndex = index + 1; // because slice(1) shifts indexes down
          const hostName =
            host && host.name ? String(host.name) : `Host ${realIndex + 1}`;

          const token = tokens[realIndex] || "";
          if (!token) {
            return `
              <div class="link-row" style="margin:10px 0;">
                <div style="font-weight:600;margin-bottom:4px;">
                  ${esc(hostName)}
                </div>
                <div class="menu-copy" style="font-size:13px;">
                  No invite token yet – please refresh after saving hosts.
                </div>
              </div>
            `;
          }

// Always use the Firestore document ID for lookups
const gid = gameId;
const url =
  `${baseUrl}?game=${encodeURIComponent(gid)}` +
  `&invite=${encodeURIComponent(token)}`;
          // ✅ pill text: "<Host>'s link", allow wrapping
          const label = `${hostName}’s link`;

          return `
            <div class="link-row" style="margin:10px 0;">
              <button
                type="button"
                class="btn btn-primary host-link-pill"
                data-link="${esc(url)}"
                style="
                  width:100%;
                  max-width:100%;
                  white-space:normal;
                  line-height:1.3;
                ">
                ${esc(label)}
              </button>
            </div>
          `;
        });
      
      if (listWrap) {
        listWrap.innerHTML = `
          <div class="links-list">
            ${rowsHtml.join("")}
          </div>
        `;
      }

      if (introEl) {
        introEl.textContent = "Here are the personalised invite links for each host.";
      }

      if (summaryEl) {
  const linkedHosts = Math.max(hosts.length - 1, 0); // exclude organiser
  summaryEl.textContent =
    `Links loaded for ${game.gameId || gameId} · ` +
    `${linkedHosts} host${linkedHosts === 1 ? "" : "s"}`;
}
    } catch (err) {
      console.error("[LinksScreen] Failed to load links", err);
      if (introEl) {
        introEl.textContent = "We hit a problem loading your host links.";
      }
      if (listWrap) {
        listWrap.innerHTML = `
          <p class="menu-copy">
            Please check your connection and tap <strong>Refresh host list</strong> to try again.
          </p>
        `;
      }
    }
  }

  // Initial load
  loadAndRender();

  // Handle "Copy invite link" pill clicks (wired once)
  if (listWrap) {
    listWrap.addEventListener("click", async (ev) => {
      const btn = ev.target.closest(".host-link-pill");
      if (!btn) return;

      const link = btn.dataset.link;
      if (!link) return;

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(link);
          const original = btn.textContent;
          btn.textContent = "Copied!";
          setTimeout(() => {
            btn.textContent = original;
          }, 1500);
        } else {
          window.prompt("Copy this invite link:", link);
        }
      } catch (err) {
        console.warn("[LinksScreen] clipboard copy failed", err);
        window.prompt("Copy this invite link:", link);
      }
    });
  }

  // Buttons
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      loadAndRender();
    });
  }

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      try {
        actions.setState && actions.setState("hosts");
      } catch (_) {}
    });
  }

  if (rsvpBtn) {
    rsvpBtn.addEventListener("click", () => {
      try {
        actions.setState && actions.setState("rsvpTracker");
      } catch (_) {}
    });
  }
}
