// path: src/skins/cooking/screens/RsvpTrackerScreen.js
// RSVP tracker – organiser view of all hosts + their chosen dates (Firestore-backed)

import { readGame, updateGame } from "../../../engine/firestore.js";

const CURRENT_GAME_KEY = "cq_current_game_id_v1";

function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Format 2025-11-29 -> 29-Nov-25
function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return esc(dateStr);

  const day = String(d.getDate()).padStart(2, "0");
  const months = ["Jan","Feb","Mar","Apr","May","Jun",
                  "Jul","Aug","Sep","Oct","Nov","Dec"];
  const mon = months[d.getMonth()] || "???";
  const year = String(d.getFullYear()).slice(-2);

  return `${day}-${mon}-${year}`;
}

function normaliseStatus(rawStatus) {
  const s = (rawStatus || "").toLowerCase();
  if (s === "accepted") {
    return { key: "accepted", label: "Accepted", color: "#1c7c33" };
  }
  if (s === "declined") {
    return { key: "declined", label: "Declined", color: "#c0392b" };
  }
  return { key: "pending", label: "Outstanding", color: "#e67e22" };
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
        <h2 class="menu-h2">RSVP TRACKER</h2>
        <p class="menu-copy" id="rsvpIntro">
          Here’s your current line-up of hosts and dates.
        </p>

        <div class="menu-actions" style="margin-top:12px;">
          <button class="btn btn-primary" id="rsvpRefresh">
            Refresh RSVPs
          </button>
        </div>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- MAIN -->
      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">HOST LINE-UP</h2>
        <div id="rsvpListContainer">
          <p class="menu-copy">Loading…</p>
        </div>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <!-- Row 1 buttons -->
      <div class="menu-actions">
        <button class="btn btn-secondary" id="rsvpBack">Back to links</button>
      </div>

      <!-- Row 2 buttons -->
      <div class="menu-actions" style="margin-top:6px;">
        <button class="btn btn-secondary" id="rsvpCancel">Cancel event</button>
        <button class="btn btn-primary" id="rsvpConfirm">Confirm schedule with hosts</button>
        <button class="btn btn-primary" id="rsvpBegin">Let the games begin</button>
      </div>

      <p class="muted" id="rsvpSummary"
         style="text-align:center;margin-top:8px;font-size:11px;">
      </p>

      <p class="muted" style="text-align:center;margin-top:4px;font-size:11px;">
        RsvpTrackerScreen – organiser view of hosts &amp; dates
      </p>
    </section>
  `;
}
export function render(root, model = {}, actions = {}) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  // Scroll to top (avoid “zoomed in” look on iOS)
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

  const introEl     = root.querySelector("#rsvpIntro");
  const listWrap    = root.querySelector("#rsvpListContainer");
  const summaryEl   = root.querySelector("#rsvpSummary");
  const backBtn     = root.querySelector("#rsvpBack");
  const refreshBtn  = root.querySelector("#rsvpRefresh");
  const cancelBtn   = root.querySelector("#rsvpCancel");
  const confirmBtn = root.querySelector("#rsvpConfirm");
  const beginBtn    = root.querySelector("#rsvpBegin");

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
          Please go back to the host links, create a new set of invites and then return here.
        </p>
      `;
    }
    return;
  }

  async function loadAndRender() {
    if (introEl) {
      introEl.textContent = "Loading hosts and their chosen dates…";
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
      const rsvps = game.rsvps && typeof game.rsvps === "object" ? game.rsvps : {};

      if (introEl) {
        introEl.textContent = "Here’s your current line-up of hosts and dates.";
      }

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

      let acceptedCount = 0;
      let declinedCount = 0;
      let pendingCount  = 0;

      const rowsHtml = hosts.map((host, index) => {
        const hostName = host && host.name ? String(host.name) : `Host ${index + 1}`;
        const rsvp = rsvps.hasOwnProperty(index)
          ? rsvps[index]
          : rsvps[String(index)] || {};

        const normalised = normaliseStatus(rsvp.status);
        if (normalised.key === "accepted") acceptedCount++;
        else if (normalised.key === "declined") declinedCount++;
        else pendingCount++;

        let dateText;
        if (rsvp.date) {
          const niceDate = formatDate(rsvp.date);
          if (rsvp.time) {
            dateText = `${niceDate} at ${esc(rsvp.time)}`;
          } else {
            dateText = niceDate;
          }
        } else {
          dateText = "No date chosen";
        }

        return `
          <div
            class="rsvp-row"
            style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:10px 0;"
          >
            <div
              class="rsvp-row-status"
              style="
                min-width:110px;
                font-size:12px;
                font-weight:600;
                text-transform:uppercase;
                color:${normalised.color};
              "
            >
              ${normalised.label}
            </div>
            <div class="rsvp-row-main" style="flex:1;">
              <div
                class="rsvp-row-name"
                style="font-weight:600;margin-bottom:2px;"
              >
                ${esc(hostName)}
              </div>
              <div
                class="rsvp-row-date"
                style="font-size:13px;color:#555;"
              >
                ${esc(dateText)}
              </div>
            </div>
          </div>
        `;
      });

      if (listWrap) {
        listWrap.innerHTML = `
          <div class="rsvp-list">
            ${rowsHtml.join("")}
          </div>
        `;
      }

      if (summaryEl) {
        summaryEl.textContent =
          `RSVPs loaded for ${game.gameId || gameId} · ` +
          `${acceptedCount} accepted · ` +
          `${declinedCount} declined · ` +
          `${pendingCount} outstanding`;
      }
    } catch (err) {
      console.error("[RsvpTrackerScreen] Failed to load RSVPs", err);
      if (introEl) {
        introEl.textContent = "We hit a problem loading your RSVPs.";
      }
      if (listWrap) {
        listWrap.innerHTML = `
          <p class="menu-copy">
            Please check your connection and tap <strong>Refresh RSVPs</strong> to try again.
          </p>
        `;
      }
    }
  }

  // ---- button handlers ----

  // Initial load (option A – manual refresh button)
  loadAndRender();

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      try {
        actions.setState && actions.setState("links");
      } catch (_) {}
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      loadAndRender();
    });
  }

if (confirmBtn) {
  confirmBtn.addEventListener("click", async () => {
    if (!gameId) return;
    try {
      await updateGame(gameId, { status: "availability" });

      window.alert(
        "Schedule shared with hosts.\n\n" +
        "Ask everyone to open their usual invite link to confirm which nights they can’t attend."
      );
      // Organiser stays on this screen – they can keep reviewing the line-up.
    } catch (err) {
      console.warn("[RsvpTracker] failed to enter availability phase", err);
      window.alert("Sorry, we couldn’t share the schedule just now. Please try again.");
    }
  });
}

  if (cancelBtn) {
    cancelBtn.addEventListener("click", async () => {
      if (!gameId) return;
      const ok = window.confirm(
        "Are you sure you want to cancel this Culinary Quest? " +
        "Guests will no longer be able to use their links."
      );
      if (!ok) return;

      try {
        const nowIso = new Date().toISOString();
        await updateGame(gameId, { status: "cancelled", cancelledAt: nowIso });
        window.alert("Event cancelled. You can close this tab or start a new game from the intro screen.");
        // optional: take them back to intro
        try {
          actions.setState && actions.setState("intro");
        } catch (_) {}
      } catch (err) {
        console.warn("[RsvpTrackerScreen] Cancel event failed", err);
        window.alert("Sorry, we couldn’t cancel the event just now. Please try again.");
      }
    });
  }

  if (beginBtn) {
  beginBtn.addEventListener("click", async () => {
    if (!gameId) return;
    try {
      await updateGame(gameId, { status: "inProgress" });

      window.alert(
        "Your game has started.\n\n" +
        "From now on, host links will show the live event view for each dinner."
      );

      if (actions && typeof actions.setState === "function") {
        actions.setState("organiserHome");
      }
    } catch (err) {
      console.warn("[RsvpTracker] failed to start game", err);
      window.alert("Sorry, we couldn’t start the game just now. Please try again.");
    }
  });
}
}
