// path: src/skins/cooking/screens/AvailabilityScreen.js
// Hosts' availability checking screen ("which nights I can't attend")

import { readGame, updateGame } from "../../../engine/firestore.js";

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

function formatShortDate(dateStr) {
  // Expecting "YYYY-MM-DD"
  if (!dateStr || typeof dateStr !== "string") return dateStr || "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const months = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec"
  ];
  const mi = Number(m) - 1;
  const yy = y.slice(-2);
  const mm = months[mi] || m;
  return `${d}-${mm}-${yy}`;
}

function formatShortTime(timeStr) {
  // Expect "HH:MM" → leave as-is if malformed
  if (!timeStr || typeof timeStr !== "string") return "";
  const [hStr, mStr] = timeStr.split(":");
  const h = Number(hStr);
  if (Number.isNaN(h)) return timeStr;
  return `${hStr.padStart(2, "0")}:${(mStr || "00").padStart(2, "0")}`;
}

function renderError(root, msg) {
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
          ${esc(msg || "We couldn't load your availability screen right now.")}
        </p>
      </section>
    </section>
  `;
}

// Build schedule from RSVPs (accepted + dated)
function buildSchedule(game) {
  const out = [];
  if (!game || !game.rsvps || typeof game.rsvps !== "object") return out;

  const hosts = Array.isArray(game.hosts) ? game.hosts : [];

  Object.keys(game.rsvps).forEach((k) => {
    const idx = Number(k);
    if (Number.isNaN(idx)) return;
    const r = game.rsvps[k];
    if (!r || r.status !== "accepted" || !r.date) return;

    const hostDoc = hosts[idx] || {};
    const hostName = hostDoc.name || `Host ${idx + 1}`;

    out.push({
      hostIndex: idx,
      hostName,
      date: r.date,
      time: r.time || ""
    });
  });

  out.sort((a, b) => {
    const aKey = `${a.date}T${a.time || "00:00"}`;
    const bKey = `${b.date}T${b.time || "00:00"}`;
    return aKey.localeCompare(bKey);
  });

  return out;
}

export function render(root, model = {}, actions = {}) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  scrollToTop();

  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get("invite");
  const urlGameId   = params.get("game");

  if (!inviteToken || !urlGameId) {
    renderError(root, "Missing invite details in the link.");
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
        <h2 class="menu-h2">Loading your schedule…</h2>
        <p class="menu-copy">
          One moment while we fetch the full line-up.
        </p>
      </section>
    </section>
  `;

  (async () => {
    try {
      const game = await readGame(urlGameId);
      if (!game) {
        renderError(root, "We couldn't find this Culinary Quest.");
        return;
      }

      const hosts = Array.isArray(game.hosts) ? game.hosts : [];
      const viewerIndex = hosts.findIndex(
        (h) => h && typeof h.token === "string" && h.token === inviteToken
      );

      if (viewerIndex < 0) {
        renderError(root, "This invite link doesn't match any host in the game.");
        return;
      }

      const viewerHost = hosts[viewerIndex] || {};
      const viewerName = viewerHost.name || `Host ${viewerIndex + 1}`;

      const organiserName =
        (game.organiserName && String(game.organiserName)) ||
        (hosts[0] && hosts[0].name) ||
        "the organiser";

      const schedule = buildSchedule(game);

      if (!schedule.length) {
        renderError(
          root,
          "The organiser hasn't finalised any hosting dates yet. Try again once the schedule is set."
        );
        return;
      }

      // Existing availability record for this viewer (if any)
      const availability = (game.availability && game.availability[viewerIndex]) || {};
      // availability[viewerIndex][hostIndex] === true → "I CAN'T attend this one"

      const safeViewer = esc(viewerName);
      const safeOrganiser = esc(organiserName);

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
            <h2 class="menu-h2">CHECK YOUR AVAILABILITY</h2>
            <p class="menu-copy">
              Hi <strong>${safeViewer}</strong> – here’s the line-up for this
              <em>Culinary Quest</em>.
              <br><br>
              For each dinner, tick the ones you <strong>can’t</strong> attend.
              Your answers help <strong>${safeOrganiser}</strong> decide whether to
              adjust the schedule before the games begin.
            </p>
          </section>

          <div class="menu-divider" aria-hidden="true"></div>

          <!-- MAIN -->
          <section class="menu-section">
            <div class="menu-course">MAIN</div>
            <h2 class="menu-h2">DINNER SCHEDULE</h2>
            <p class="menu-copy" style="margin-bottom:12px;">
              Your own night is listed too, but we assume you’re available for it.
            </p>

            <div class="menu-copy" style="text-align:left;font-size:13px;">
              ${schedule
                .map((item) => {
                  const dateStr = formatShortDate(item.date);
                  const timeStr = formatShortTime(item.time || "");
                  const hostIdx = item.hostIndex;
                  const hostName = esc(item.hostName);

                  if (hostIdx === viewerIndex) {
                    // Their own night – show but no toggle
                    return `
                      <div class="menu-row" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                        <div>
                          <strong>${dateStr}</strong>
                          ${timeStr ? " at " + timeStr : ""}<br>
                          Hosted by <strong>${hostName}</strong> (that's you)
                        </div>
                        <span class="muted" style="font-size:11px;">
                          Always attending
                        </span>
                      </div>
                    `;
                  }

                  const isUnavailable =
                    availability && availability[hostIdx] === true;

                  return `
                    <div class="menu-row" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                      <div>
                        <strong>${dateStr}</strong>
                        ${timeStr ? " at " + timeStr : ""}<br>
                        Hosted by <strong>${hostName}</strong>
                      </div>
                      <label style="font-size:12px;display:flex;align-items:center;gap:4px;">
                        <input
                          type="checkbox"
                          class="availability-checkbox"
                          data-host-index="${hostIdx}"
                          ${isUnavailable ? "checked" : ""}
                        />
                        <span style="color:#b00020;">I can’t attend</span>
                      </label>
                    </div>
                  `;
                })
                .join("")}
            </div>

            <div class="menu-actions" style="margin-top:14px;">
              <button class="btn btn-primary" id="availabilitySave">
                Save my availability
              </button>
            </div>
          </section>

          <div class="menu-ornament" aria-hidden="true"></div>
          <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
            AvailabilityScreen – pre-game attendance check
          </p>
        </section>
      `;

      const saveBtn = root.querySelector("#availabilitySave");
      const checkboxes = root.querySelectorAll(".availability-checkbox");

      if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
          const newAvailability = {};

          checkboxes.forEach((cb) => {
            const hostIdx = Number(cb.getAttribute("data-host-index"));
            if (Number.isNaN(hostIdx)) return;
            if (cb.checked) {
              // TRUE means "I CAN'T attend this one"
              newAvailability[hostIdx] = true;
            }
          });

          try {
            await updateGame(urlGameId, {
              [`availability.${viewerIndex}`]: newAvailability
            });

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
                  <h2 class="menu-h2">THANK YOU</h2>
                  <p class="menu-copy">
                    Thanks, <strong>${safeViewer}</strong> – we’ve saved which nights
                    you can’t attend and shared this with <strong>${safeOrganiser}</strong>.
                    <br><br>
                    You can close this tab now.
                  </p>
                </section>
              </section>
            `;
          } catch (err) {
            console.warn("[AvailabilityScreen] Failed to save availability", err);
            window.alert("Sorry, we couldn't save your availability just now. Please try again in a moment.");
          }
        });
      }
    } catch (err) {
      console.error("[AvailabilityScreen] Failed to load game", err);
      renderError(root, "We couldn't load your schedule. Please try again later.");
    }
  })();
}
