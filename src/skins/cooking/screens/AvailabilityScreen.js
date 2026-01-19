// path: src/skins/cooking/screens/AvailabilityScreen.js
// Hosts' availability checking screen ("which nights I can't attend"
// plus optional ability to adjust your own hosting date/time if the
// organiser has enabled it).

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

function renderOrganiserAvailability(root, game, gameId, actions, isCancelled = () => false) {
  const hosts = Array.isArray(game.hosts) ? game.hosts : [];
  const organiserName =
    (game.organiserName && String(game.organiserName)) ||
    (hosts[0] && hosts[0].name) ||
    "the organiser";

  const schedule = buildSchedule(game);
  const availability =
    (game.availability && typeof game.availability === "object")
      ? game.availability
      : {};

  // Build a friendly map of who can't attend each hostIndex dinner
  function cannotAttendList(hostIdx) {
    const out = [];
    for (let viewerIdx = 0; viewerIdx < hosts.length; viewerIdx++) {
      if (viewerIdx === hostIdx) continue; // host is always attending their own night
      const viewerMap =
        availability[viewerIdx] || availability[String(viewerIdx)] || null;
      if (!viewerMap) continue;

      if (viewerMap[hostIdx] === true || viewerMap[String(hostIdx)] === true) {
        const nm = (hosts[viewerIdx] && hosts[viewerIdx].name) || `Host ${viewerIdx + 1}`;
        out.push(nm);
      }
    }
    return out;
  }

  // Track who hasn't submitted availability at all
  function awaitingResponses(hostIdx) {
    const out = [];
    for (let viewerIdx = 0; viewerIdx < hosts.length; viewerIdx++) {
      if (viewerIdx === hostIdx) continue;
      const viewerMap =
        availability[viewerIdx] || availability[String(viewerIdx)] || null;
      if (!viewerMap) {
        const nm = (hosts[viewerIdx] && hosts[viewerIdx].name) || `Host ${viewerIdx + 1}`;
        out.push(nm);
      }
    }
    return out;
  }

  if (!schedule.length) {
    renderError(
      root,
      "No confirmed hosting dates yet. Ask hosts to RSVP first, then confirm the schedule."
    );
    return;
  }
  
  if (isCancelled()) return;
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
        <h2 class="menu-h2">SCHEDULE &amp; AVAILABILITY</h2>
        <p class="menu-copy">
          Okay <strong>${esc(organiserName)}</strong> — here’s the full schedule, plus any clashes reported by hosts.
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">CLASHES</h2>

        <div class="menu-copy" style="text-align:left;font-size:13px;">
          ${schedule
            .map((item) => {
              const dateStr = formatShortDate(item.date);
              const timeStr = formatShortTime(item.time || "");
              const hostName = esc(item.hostName || `Host ${item.hostIndex + 1}`);

              const cant = cannotAttendList(item.hostIndex);
              const awaiting = awaitingResponses(item.hostIndex);

              let cantHtml = "";

if (cant.length) {
  cantHtml = `<div style="margin-top:6px;color:#b00020;">
                <strong>Can’t attend:</strong> ${cant.map(esc).join(", ")}
              </div>`;
} else if (awaiting.length) {
  cantHtml = `<div style="margin-top:6px;color:#6b7280;">
                <strong>Awaiting confirmation</strong>
              </div>`;
} else {
  cantHtml = `<div style="margin-top:6px;color:#1c7c33;">
                <strong>Everyone can attend</strong>
              </div>`;
}

              const awaitingHtml = awaiting.length
                ? `<div style="margin-top:4px;color:#6b7280;">
                     <strong>Awaiting:</strong> ${awaiting.map(esc).join(", ")}
                   </div>`
                : "";

              return `
                <div style="margin-bottom:10px;padding:10px;border:1px solid rgba(0,0,0,0.08);border-radius:12px;background:#fff;">
                  <div>
                    <strong>${dateStr}</strong>${timeStr ? " at " + timeStr : ""}<br>
                    Hosted by <strong>${hostName}</strong>
                  </div>
                  ${cantHtml}
                  ${awaitingHtml}
                </div>
              `;
            })
            .join("")}
        </div>

        <div class="menu-actions" style="margin-top:12px;">
          <button class="btn btn-secondary" id="orgAvailRefresh">Refresh</button>
          <button class="btn btn-primary" id="orgAvailBegin">Let the games begin</button>
        </div>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>
      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
        AvailabilityScreen – organiser summary view
      </p>
    </section>
  `;

  const refreshBtn = root.querySelector("#orgAvailRefresh");
  const beginBtn = root.querySelector("#orgAvailBegin");

  if (refreshBtn && actions && typeof actions.setState === "function") {
    refreshBtn.addEventListener("click", () => actions.setState("availability"));
  }

  if (beginBtn) {
  beginBtn.addEventListener("click", async () => {
    try {
      await updateGame(gameId, { status: "inProgress" });
      if (isCancelled()) return;

      window.alert("Your game has started.");
      if (actions && typeof actions.setState === "function") {
        actions.setState("gameDashboard");
      }
    } catch (err) {
      console.warn("[AvailabilityScreen] Start game failed", err);
      window.alert("Sorry — we couldn’t start the game just now. Please try again.");
    }
  });
}
}

export function render(root, model = {}, actions = {}) {
  let cancelled = false;
  const cleanup = () => { cancelled = true; };
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  scrollToTop();
  if (cancelled) return cleanup;

  const params = new URLSearchParams(window.location.search);
const inviteToken = params.get("invite");
const urlGameId   = params.get("game");

// If invite details are missing, assume organiser opened this from inside the app.
const isOrganiserInApp = !inviteToken || !urlGameId;

// We'll read the game using either the URL (host links) or localStorage/model (organiser)
let effectiveGameId = urlGameId;

if (isOrganiserInApp) {
  effectiveGameId =
    (model && typeof model.gameId === "string" && model.gameId.trim()) || null;

  if (!effectiveGameId) {
    try {
      const stored = window.localStorage.getItem("cq_current_game_id_v1");
      if (stored && stored.trim()) effectiveGameId = stored.trim();
    } catch (_) {}
  }

  if (!effectiveGameId) {
    renderError(root, "We couldn't find your game details. Please return to organiser home and try again.");
    return cleanup;
  }
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
      const game = await readGame(effectiveGameId);
      if (cancelled) return;
      if (!game) {
        renderError(root, "We couldn't find this Culinary Quest.");
        return;
      }
      if (isOrganiserInApp) {
  renderOrganiserAvailability(root, game, effectiveGameId, actions, () => cancelled);
  return;
}

const hosts = Array.isArray(game.hosts) ? game.hosts : [];
const HUB_STATE = "gameDashboard";

// Tokens are stored separately (hostTokens), not on hosts[i].token
const tokenList = Array.isArray(game.hostTokens)
  ? game.hostTokens
  : Array.isArray(game.tokens)
  ? game.tokens
  : [];

const needle = String(inviteToken || "").trim().toUpperCase();
const normalisedTokens = tokenList.map((t) =>
  t == null ? "" : String(t).trim().toUpperCase()
);
const viewerIndex = normalisedTokens.indexOf(needle);

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
      const allAvailability =
  (game.availability && typeof game.availability === "object") ? game.availability : {};

function getViewerMap(idx) {
  return allAvailability[idx] || allAvailability[String(idx)] || null;
}

function joinNamesSafe(names) {
  const safe = names.map(esc);
  if (safe.length <= 1) return safe[0] || "";
  if (safe.length === 2) return `${safe[0]} and ${safe[1]}`;
  return `${safe.slice(0, -1).join(", ")}, and ${safe[safe.length - 1]}`;
}

function cantAttendMyNightNames() {
  const out = [];
  for (let viewerIdx = 0; viewerIdx < hosts.length; viewerIdx++) {
    if (viewerIdx === viewerIndex) continue;
    const vm = getViewerMap(viewerIdx);
    if (!vm) continue;
    if (vm[viewerIndex] === true || vm[String(viewerIndex)] === true) {
      const nm = (hosts[viewerIdx] && hosts[viewerIdx].name) || `Host ${viewerIdx + 1}`;
      out.push(nm);
    }
  }
  return out;
}

      // Optional reschedule flags (set by organiser in tracker)
      const rescheduleMap =
        (game.reschedule && typeof game.reschedule === "object")
          ? game.reschedule
          : {};
      const canEditOwnNight = !!rescheduleMap[viewerIndex];

const cantForMine = canEditOwnNight ? cantAttendMyNightNames() : [];
const cantForMineText = cantForMine.length ? joinNamesSafe(cantForMine) : "";
const cantForMineVerb = cantForMine.length === 1 ? "is" : "are";

const takenDates = schedule
  .filter((it) => it.hostIndex !== viewerIndex)
  .map((it) => {
    const d = formatShortDate(it.date);
    const t = formatShortTime(it.time || "");
    const nm = esc(it.hostName || `Host ${it.hostIndex + 1}`);
    return `${d}${t ? " at " + t : ""} (${nm})`;
  });

const takenDatesHtml = takenDates.length
  ? `<div class="muted" style="font-size:11px;margin-top:6px;line-height:1.45;">
       <strong>Dates already chosen:</strong> ${takenDates.join(", ")}
     </div>`
  : "";

      if (!schedule.length) {
        renderError(
          root,
          "The organiser hasn't finalised any hosting dates yet. Try again once the schedule is set."
        );
        return;
      }

      // Existing availability record for this viewer (if any)
      const availabilityForViewer =
  (game.availability &&
    (game.availability[viewerIndex] || game.availability[String(viewerIndex)])) ||
  {};



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
              ${
                canEditOwnNight
                  ? `<br><br>
                     <strong>${safeOrganiser}</strong> has asked you to move your hosting
                     night – you can adjust your date and start time at the bottom of the list.`
                  : ""
              }
            </p>
          </section>

          <div class="menu-divider" aria-hidden="true"></div>

          <!-- MAIN -->
          <section class="menu-section">
            <div class="menu-course">MAIN</div>
            <h2 class="menu-h2">DINNER SCHEDULE</h2>

            <div class="menu-copy" style="text-align:left;font-size:13px;">
              ${schedule
                .map((item) => {
                  const dateStr = formatShortDate(item.date);
                  const timeStr = formatShortTime(item.time || "");
                  const hostIdx = item.hostIndex;
                  const hostName = esc(item.hostName);

                  // Your own night – either read-only or editable, depending on organiser flag
                  if (hostIdx === viewerIndex) {
                    if (!canEditOwnNight) {
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

                    // Editable version when organiser has enabled reschedule
                    return `
                      <div class="menu-row" style="margin-bottom:10px;padding:8px;border-radius:6px;background:rgba(0,0,0,0.02);">
                        <div style="margin-bottom:4px;">
                          <strong>Your hosting night</strong><br>
                          Hosted by <strong>${hostName}</strong> (that’s you)
                        </div>
                        ${
  cantForMine.length
    ? `<div style="margin-top:6px;font-size:12px;color:#b00020;line-height:1.45;">
         <strong>${safeOrganiser}</strong> has asked if you can choose an alternative hosting date,
         as ${cantForMineText} ${cantForMineVerb} unable to make your current date.
       </div>`
    : `<div style="margin-top:6px;font-size:12px;color:#6b7280;line-height:1.45;">
         <strong>${safeOrganiser}</strong> has asked if you can choose an alternative hosting date.
       </div>`
}
${takenDatesHtml}

                        <label style="display:block;font-size:12px;margin-top:4px;">
                          <strong>Hosting date</strong><br>
                          <input
                            id="ownNightDate"
                            type="date"
                            class="menu-input"
                            value="${esc(item.date)}"
                            style="margin-top:2px;"
                          />
                        </label>
                        <label style="display:block;font-size:12px;margin-top:6px;">
                          <strong>Start time</strong> <span class="muted">(optional)</span><br>
                          <input
                            id="ownNightTime"
                            type="time"
                            class="menu-input"
                            value="${item.time ? esc(item.time) : ""}"
                            style="margin-top:2px;"
                          />
                        </label>
                        <p class="muted" style="font-size:11px;margin-top:6px;">
                          Only change these if <strong>${safeOrganiser}</strong> has asked you
                          to move your night.
                        </p>
                      </div>
                    `;
                  }

                  // Other hosts – red "I can't attend" checkbox
                  const isUnavailable =
                    !!availabilityForViewer &&
                    (availabilityForViewer[hostIdx] === true ||
                     availabilityForViewer[String(hostIdx)] === true);

                  return `
                    <div class="menu-row"
                         style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
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

      const saveBtn      = root.querySelector("#availabilitySave");
      const checkboxes   = root.querySelectorAll(".availability-checkbox");
      const ownDateInput = root.querySelector("#ownNightDate");
      const ownTimeInput = root.querySelector("#ownNightTime");

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

          // Only allow changing own date/time if organiser has enabled it
          let ownDate = null;
          let ownTime = null;

          if (canEditOwnNight && ownDateInput) {
            const rawDate = ownDateInput.value ? ownDateInput.value.trim() : "";
            if (!rawDate) {
              window.alert("Please make sure your own hosting date is still set.");
              ownDateInput.focus();
              return;
            }
            ownDate = rawDate;
          }

          if (canEditOwnNight && ownTimeInput && ownTimeInput.value) {
            ownTime = ownTimeInput.value.trim();
          }

          try {
            const availabilityField = `availability.${viewerIndex}`;
            const rsvpField         = `rsvps.${viewerIndex}`;

            // Start with the existing RSVP for this host, if any
            const existingRsvp =
              (game.rsvps &&
                (game.rsvps[viewerIndex] || game.rsvps[String(viewerIndex)])) ||
              {};

            const updatedRsvp = {
              ...existingRsvp,
              hostIndex: viewerIndex,
              status: existingRsvp.status || "accepted",
              date: canEditOwnNight
                ? (ownDate || existingRsvp.date || null)
                : existingRsvp.date || null,
              time: canEditOwnNight
                ? (ownTime || existingRsvp.time || null)
                : existingRsvp.time || null
            };

            const updatePayload = {
              [availabilityField]: newAvailability
            };

            // Only write the RSVP field if we actually have an RSVP to preserve / edit
            if (Object.keys(updatedRsvp).length) {
              updatePayload[rsvpField] = updatedRsvp;
            }

            await updateGame(effectiveGameId, updatePayload);
            if (cancelled) return;

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
                    you can’t attend${
                      canEditOwnNight ? " and updated your hosting night if you changed it" : ""
                    }.
                    <br><br>
                    This information has been shared with <strong>${safeOrganiser}</strong>.
                    You can close this tab now.
                  </p>
                </section>
              </section>
            `;
          } catch (err) {
            console.warn("[AvailabilityScreen] Failed to save availability", err);
            window.alert(
              "Sorry, we couldn't save your availability just now. Please try again in a moment."
            );
          }
        });
      }
    } catch (err) {
      if (cancelled) return;
      renderError(root, "We couldn't load your schedule. Please try again later.");
    }
  })();
return cleanup; // ✅ app.js will call this when you navigate away
}
