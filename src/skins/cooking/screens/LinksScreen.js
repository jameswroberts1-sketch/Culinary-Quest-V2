// path: src/skins/cooking/screens/LinksScreen.js
// Host links – organiser view of per-host invite URLs (Firestore-backed)

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
          Share these links with your <strong>other hosts</strong> so they can
          accept their invite and choose a hosting date.
          <br><br>
          As the organiser, you don’t need a link yourself – you can always
          get back to your <strong>Organiser home</strong> and Quest dashboard
          from your app shortcut.
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

      <!-- FOOTER BUTTONS -->
      <div class="menu-actions">
        <button class="btn btn-secondary" id="linksBack">
          Back to setup
        </button>
        <button class="btn btn-primary" id="linksRsvp">
          View RSVP tracker
        </button>
      </div>

      <p class="muted" id="linksSummary"
         style="text-align:center;margin-top:8px;font-size:11px;">
      </p>

      <p class="muted" style="text-align:center;margin-top:4px;font-size:11px;">
        LinksScreen – organiser view of host invite URLs
      </p>
    </section>
  `;

  const introEl    = root.querySelector("#linksIntro");
  const listWrap   = root.querySelector("#linksListContainer");
  const summaryEl  = root.querySelector("#linksSummary");
  const backBtn    = root.querySelector("#linksBack");
  const rsvpBtn    = root.querySelector("#linksRsvp");
  const refreshBtn = root.querySelector("#linksRefresh");

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
    if (listWrap) {
      listWrap.innerHTML = `<p class="menu-copy">Loading…</p>`;
    }

    try {
      const game = await readGame(gameId);
      if (!game) {
        if (listWrap) {
          listWrap.innerHTML = `
            <p class="menu-copy">
              We couldn’t load this Quest from the cloud. It may have been deleted
              or created on another device.
            </p>
          `;
        }
        if (summaryEl) {
          summaryEl.textContent = "";
        }
        return;
      }

      const hosts = Array.isArray(game.hosts) ? game.hosts : [];

      if (!hosts.length) {
        if (listWrap) {
          listWrap.innerHTML = `
            <p class="menu-copy">
              No hosts found for this Quest yet. Go back and make sure you’ve added everyone.
            </p>
          `;
        }
        if (summaryEl) {
          summaryEl.textContent = "";
        }
        return;
      }

      const origin = window.location.origin;
      const path   = window.location.pathname.replace(/index\.html$/i, "");
      const base   = `${origin}${path}`;

      let visibleHostCount = 0;

      const rowsHtml = hosts
        .map((host, index) => {
          // ⬇️ Skip the organiser (host 0) – they use the app, not a link
          if (index === 0) return "";

          const name =
            host && host.name ? String(host.name) : `Host ${index + 1}`;
          const token =
            host && typeof host.token === "string" && host.token.trim()
              ? host.token.trim()
              : null;

          if (!token) {
            return `
              <div class="link-row" style="margin:10px 0;">
                <div class="menu-copy" style="font-size:13px;">
                  <strong>${esc(name)}</strong><br>
                  <span class="muted" style="font-size:11px;">
                    No invite token generated for this host yet.
                    Try going back to the host list and saving again.
                  </span>
                </div>
              </div>
            `;
          }

          visibleHostCount++;

          const link = `${base}?invite=${encodeURIComponent(
            token
          )}&game=${encodeURIComponent(gameId)}`;

          return `
            <div
              class="link-row"
              style="
                display:flex;
                align-items:flex-start;
                justify-content:space-between;
                gap:12px;
                margin:10px 0;
              "
            >
              <div class="menu-copy" style="font-size:13px;flex:1;">
                <strong>${esc(name)}</strong><br>
                <span style="word-break:break-all;font-size:11px;">
                  ${esc(link)}
                </span>
              </div>
              <div style="display:flex;align-items:center;">
                <button
                  class="btn btn-secondary copy-btn"
                  data-link="${esc(link)}"
                  style="font-size:11px;padding:6px 8px;"
                >
                  Copy
                </button>
              </div>
            </div>
          `;
        })
        .join("");

      if (listWrap) {
        listWrap.innerHTML =
          rowsHtml && rowsHtml.trim()
            ? `<div class="links-list">${rowsHtml}</div>`
            : `
              <p class="menu-copy">
                You currently only have yourself set up as a host.
                Add more hosts before sharing any links.
              </p>
            `;
      }

      if (summaryEl) {
        summaryEl.textContent =
          `Links ready for ${visibleHostCount} host` +
          (visibleHostCount === 1 ? "" : "s") +
          ` · Game ID: ${game.gameId || gameId}`;
      }

      // Wire up copy buttons
      const copyButtons = root.querySelectorAll(".copy-btn");
      copyButtons.forEach((btn) => {
        btn.addEventListener("click", async () => {
          const link = btn.getAttribute("data-link");
          if (!link) return;

          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(link);
            } else {
              // Fallback for older browsers
              const tmp = document.createElement("textarea");
              tmp.value = link;
              tmp.style.position = "fixed";
              tmp.style.opacity = "0";
              document.body.appendChild(tmp);
              tmp.select();
              document.execCommand("copy");
              document.body.removeChild(tmp);
            }
            window.alert("Link copied. Paste it into a message to your host.");
          } catch (err) {
            console.warn("[LinksScreen] Failed to copy link", err);
            window.alert("Sorry, we couldn’t copy that link. You can tap and hold it to copy manually.");
          }
        });
      });
    } catch (err) {
      console.error("[LinksScreen] Failed to load links", err);
      if (listWrap) {
        listWrap.innerHTML = `
          <p class="menu-copy">
            We hit a problem loading your host links.
            Please check your connection and tap <strong>Refresh host list</strong> to try again.
          </p>
        `;
      }
      if (summaryEl) {
        summaryEl.textContent = "";
      }
    }
  }

  // ---- initial load + button handlers ----

  loadAndRender();

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      loadAndRender();
    });
  }

  if (backBtn && actions && typeof actions.setState === "function") {
    backBtn.addEventListener("click", () => {
      actions.setState("hosts"); // back to host list/setup
    });
  }

  if (rsvpBtn && actions && typeof actions.setState === "function") {
    rsvpBtn.addEventListener("click", () => {
      actions.setState("rsvpTracker");
    });
  }
}
