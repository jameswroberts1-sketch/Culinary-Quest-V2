// path: src/skins/cooking/screens/AvailabilityScreen.js
// Hosts confirm which dinners they CAN'T attend; organiser sees a consolidated view.

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

function renderError(root, message) {
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
          ${esc(message || "We couldn't load this schedule right now. Please try again in a moment.")}
        </p>
      </section>
    </section>
  `;
}

// Build a sorted schedule of accepted hosts with dates + times
function buildSchedule(game) {
  const out = [];
  if (!game || !game.rsvps || typeof game.rsvps !== "object") return out;

  Object.keys(game.rsvps).forEach((k) => {
    const idx = Number(k);
    if (Number.isNaN(idx)) return;
    const r = game.rsvps[k];
    if (!r || r.status !== "accepted" || !r.date) return;

    const date = r.date;
    const time =
      r.time && typeof r.time === "string" && r.time.trim()
        ? r.time.trim()
        : "19:00"; // sensible default

    const start = new Date(`${date}T${time}:00`);
    if (isNaN(start.getTime())) return;

    out.push({
      hostIndex: idx,
      date,
      time,
      startMs: start.getTime()
    });
  });

  // Oldest first
  out.sort((a, b) => a.startMs - b.startMs);
  return out;
}

function formatShortDate(dateStr) {
  // Expecting "YYYY-MM-DD"
  if (!dateStr || typeof dateStr !== "string") return dateStr || "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
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

  // keep in 24h for now; easier to read than nothing
  return `${hStr.padStart(2, "0")}:${(mStr || "00").padStart(2, "0")}`;
}

/* ----------------------------------------------------------
   Host view – tick nights you CAN'T attend
---------------------------------------------------------- */

function renderHostAvailability(root, opts) {
  const {
    viewerIndex,
    viewerName,
    organiserName,
    hosts,
    schedule,
    gameId,
    existingAvailabilityForHost
  } = opts;

  const safeViewer = esc(viewerName || `Host ${viewerIndex + 1}`);
  const safeOrganiser = esc(organiserName || "the organiser");

  if (!schedule.length) {
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
          <h2 class="menu-h2">NO DATES SET YET</h2>
          <p class="menu-copy">
            Hi <strong>${safeViewer}</strong> – your organiser hasn't finalised the hosting dates yet.
            Once the schedule is ready, they'll send you another link to confirm which nights you can attend.
          </p>
        </section>
      </section>
    `;
    return;
  }

  // existingAvailabilityForHost is an object keyed by eventHostIndex → boolean canAttend
  const availMap = existingAvailabilityForHost && typeof existingAvailabilityForHost === "object"
    ? existingAvailabilityForHost
    : {};

  const rowsHtml = schedule
    .map((ev, idx) => {
      const hostIdx = ev.hostIndex;
      const hostDoc = hosts[hostIdx] || {};
      const hostName = hostDoc.name || `Host ${hostIdx + 1}`;
      const safeHost = esc(hostName);

      const dateStr = formatShortDate(ev.date);
      const timeStr = formatShortTime(ev.time);

      if (hostIdx === viewerIndex) {
        // Their own night – no checkbox, just a note
        return `
          <div class="menu-row" style="margin-bottom:10px;">
            <p class="menu-copy" style="margin-bottom:4px;">
              <strong>Night ${idx + 1} – Your hosting night</strong><br>
              ${dateStr} at ${timeStr}
            </p>
            <p class="muted" style="font-size:12px;">
              You're assumed to be attending your own night, so there's nothing to tick here.
            </p>
          </div>
        `;
      }

      // Default assumption: if no entry, they CAN attend (checkbox unchecked).
      const canAttend = Object.prototype.hasOwnProperty.call(availMap, hostIdx)
        ? !!availMap[hostIdx]
        : true;
      const cantAttend = !canAttend;

      return `
        <div class="menu-row" style="margin-bottom:10px;">
          <p class="menu-copy" style="margin-bottom:4px;">
            <strong>Night ${idx + 1} – ${safeHost}</strong><br>
            ${dateStr} at ${timeStr}
          </p>
          <label class="menu-copy" style="font-size:13px;display:flex;align-items:center;gap:6px;">
            <input
              type="checkbox"
              class="avail-checkbox"
              data-event-host="${hostIdx}"
              ${cantAttend ? "checked" : ""}
            />
            <span>
              <strong>❌ I can't attend this dinner</strong>
            </span>
          </label>
        </div>
      `;
    })
    .join("");

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
          Hi <strong>${safeViewer}</strong> – <strong>${safeOrganiser}</strong> has put together the
          schedule for your <em>Culinary Quest</em>.
          <br><br>
          Please review the dates below and tick any dinners you <strong>can’t attend</strong>.
          We’ll share this with the organiser so they can decide whether to adjust dates or proceed.
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- MAIN -->
      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">YOUR SCHEDULE</h2>

        <div>
          ${rowsHtml}
        </div>

        <div class="menu-actions" style="margin-top:16px;">
          <button class="btn btn-primary" id="availabilitySave">
            Save my availability
          </button>
        </div>

        <p class="muted" style="font-size:11px;margin-top:8px;">
          You can come back to this link later if your plans change.
        </p>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>
      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
        Availability – host view
      </p>
    </section>
  `;

  const saveBtn = root.querySelector("#availabilitySave");
  if (!saveBtn) return;

  saveBtn.addEventListener("click", async () => {
    try {
      const checkboxes = Array.from(
        root.querySelectorAll(".avail-checkbox")
      );

      const newMap = { ...availMap };

      checkboxes.forEach((cb) => {
        const hostIdxStr = cb.getAttribute("data-event-host");
        if (!hostIdxStr) return;
        const hostIdx = Number(hostIdxStr);
        if (Number.isNaN(hostIdx)) return;

        const cantAttend = cb.checked;
        // Store explicit boolean "can attend" for that event host index
        newMap[hostIdx] = !cantAttend;
      });

      await updateGame(opts.gameId, {
        [`availability.${viewerIndex}`]: newMap
      });

      window.alert("Thanks – your availability has been saved.");
    } catch (err) {
      console.error("[AvailabilityScreen] save failed", err);
      window.alert("Sorry, we couldn't save your availability. Please try again in a moment.");
    }
  });
}

/* ----------------------------------------------------------
   Organiser view – consolidated schedule + counts
---------------------------------------------------------- */

function renderOrganiserAvailability(root, opts) {
  const { organiserName, hosts, schedule, availability } = opts;

  const safeOrganiser = esc(organiserName || "the organiser");

  if (!schedule.length) {
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
          <h2 class="menu-h2">NO DATES TO CHECK YET</h2>
          <p class="menu-copy">
            Hi <strong>${safeOrganiser}</strong> – there aren't any confirmed hosting dates yet.
            Once your hosts have all accepted and chosen their nights, you can come back here to
            review who can attend which dinners.
          </p>
        </section>
      </section>
    `;
    return;
  }

  // availability is an object: availability[viewerIndex][eventHostIndex] = boolean canAttend
  const availRoot =
    availability && typeof availability === "object" ? availability : {};

  const rowsHtml = schedule
    .map((ev, idx) => {
      const hostIdx = ev.hostIndex;
      const hostDoc = hosts[hostIdx] || {};
      const hostName = hostDoc.name || `Host ${hostIdx + 1}`;
      const safeHost = esc(hostName);

      const dateStr = formatShortDate(ev.date);
      const timeStr = formatShortTime(ev.time);

      let cantAttendCount = 0;
      let totalHosts = 0;

      // Loop over each participant's availability
      Object.keys(availRoot).forEach((viewerIdxStr) => {
        const viewerIdx = Number(viewerIdxStr);
        if (Number.isNaN(viewerIdx)) return;

        // Each viewer's map: { [eventHostIdx]: canAttendBool }
        const perViewer = availRoot[viewerIdxStr] || {};
        if (typeof perViewer !== "object") return;

        // Ignore the active host themselves for this count? Up to you;
        // for now we include everyone, but you could skip viewerIdx === hostIdx.
        const val = perViewer[hostIdx];
        totalHosts += 1;
        if (val === false) {
          cantAttendCount += 1;
        }
      });

      const summary =
        totalHosts === 0
          ? "No responses yet."
          : cantAttendCount === 0
          ? "All responding hosts can attend."
          : `${cantAttendCount} host${cantAttendCount === 1 ? "" : "s"} can't attend.`;

      return `
        <div class="menu-row" style="margin-bottom:10px;">
          <p class="menu-copy" style="margin-bottom:4px;">
            <strong>Night ${idx + 1} – ${safeHost}</strong><br>
            ${dateStr} at ${timeStr}
          </p>
          <p class="muted" style="font-size:13px;">
            ${summary}
          </p>
        </div>
      `;
    })
    .join("");

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
        <h2 class="menu-h2">AVAILABILITY OVERVIEW</h2>
        <p class="menu-copy">
          Hi <strong>${safeOrganiser}</strong> – here's a snapshot of who can make each dinner, based on
          the availability your hosts have submitted.
          <br><br>
          If one night has lots of clashes, you might want to ask that host to pick a new date, or
          you can proceed knowing that not everyone will be able to attend every round.
          Any back-and-forth about changes can happen outside the app.
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- MAIN -->
      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">SCHEDULE &amp; CLASHES</h2>

        <div>
          ${rowsHtml}
        </div>

        <p class="muted" style="font-size:11px;margin-top:12px;">
          This screen is just for planning. The actual voting eligibility will be confirmed by you
          at the end of each dinner before scores are entered.
        </p>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>
      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
        Availability – organiser overview
      </p>
    </section>
  `;
}

/* ----------------------------------------------------------
   Main export
---------------------------------------------------------- */

export function render(root, model = {}, actions = {}) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  scrollToTop();

  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get("invite");
  const urlGameId   = params.get("game");

  if (!urlGameId) {
    renderError(root, "This availability link is missing the game ID.");
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
        <h2 class="menu-h2">Loading schedule…</h2>
        <p class="menu-copy">
          One moment while we fetch the latest hosting dates.
        </p>
      </section>
    </section>
  `;

  (async () => {
    try {
      const game = await readGame(urlGameId);
      if (!game) {
        renderError(root, "We couldn't find this game. Please double-check the link.");
        return;
      }

      const hosts = Array.isArray(game.hosts) ? game.hosts : [];
      const organiserName =
        (game.organiserName && String(game.organiserName)) ||
        (hosts[0] && hosts[0].name) ||
        "the organiser";

      const schedule = buildSchedule(game);
      const availability =
        game.availability && typeof game.availability === "object"
          ? game.availability
          : {};

      if (!inviteToken) {
        // Organiser view: no invite token → consolidated availability
        renderOrganiserAvailability(root, {
          organiserName,
          hosts,
          schedule,
          availability
        });
        return;
      }

      // Host view: find which host this token belongs to
      const hostIndex = hosts.findIndex(
        (h) => h && typeof h.token === "string" && h.token === inviteToken
      );
      if (hostIndex < 0) {
        renderError(root, "We couldn't match this link to a host in the game.");
        return;
      }

      const hostDoc = hosts[hostIndex] || {};
      const hostName = hostDoc.name || `Host ${hostIndex + 1}`;

      const existingForHost = availability && availability[hostIndex];

      renderHostAvailability(root, {
        viewerIndex: hostIndex,
        viewerName: hostName,
        organiserName,
        hosts,
        schedule,
        gameId: urlGameId,
        existingAvailabilityForHost: existingForHost || null
      });
    } catch (err) {
      console.error("[AvailabilityScreen] Failed to load game", err);
      renderError(root, "We couldn't load the schedule just now. Please try again in a moment.");
    }
  })();
}
