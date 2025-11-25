// path: src/skins/cooking/screens/InviteScreen.js
// Per-host invite screen – organiser inside the app, or guests via invite links.

import { readGame, updateGame } from "../../../engine/firestore.js";

const HOSTS_STORAGE_KEY  = "cq_hosts_v1";
const NIGHTS_STORAGE_KEY = "cq_host_nights_v1";

function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadNights() {
  try {
    const raw = window.localStorage.getItem(NIGHTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
}

function saveNights(nights) {
  try {
    window.localStorage.setItem(NIGHTS_STORAGE_KEY, JSON.stringify(nights));
  } catch (_) {}
}

// Hosts for the organiser’s in-app flow (no Firestore needed here)
function hydrateHostsLocal(model = {}) {
  let hosts = [];

  if (Array.isArray(model.hosts) && model.hosts.length) {
    hosts = model.hosts.map((h) => ({
      name: h && typeof h.name === "string" ? h.name : ""
    }));
  }

  try {
    const raw = window.localStorage.getItem(HOSTS_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved) && saved.length) {
        saved.forEach((entry, idx) => {
          if (!hosts[idx]) hosts[idx] = { name: "" };
          if (entry && typeof entry.name === "string" && entry.name.trim()) {
            hosts[idx].name = entry.name;
          }
        });
      }
    }
  } catch (_) {}

  if (!hosts[0]) hosts[0] = { name: "" };
  return hosts;
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

function renderError(root) {
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
          We couldn't load your invite right now.
          Please try opening the link again in a moment.
        </p>
      </section>
    </section>
  `;
}

async function saveRsvpToFirestore(
  gameId,
  hostIndex,
  status,
  date,
  time,
  theme,
  address,
  phone
) {
  if (!gameId) return;
  try {
    const nowIso = new Date().toISOString();
    const field = `rsvps.${hostIndex}`;

    await updateGame(gameId, {
      [field]: {
        hostIndex,
        status:  status  || null,
        date:    date    || null,
        time:    time    || null,
        theme:   theme   || null,
        address: address || null,
        phone:   phone   || null,
        updatedAt: nowIso
      }
    });
  } catch (err) {
    console.warn("[InviteScreen] Failed to sync RSVP to Firestore", err);
  }
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
    const time = r.time && typeof r.time === "string" && r.time.trim()
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

function pickCurrentEvent(game, nowMs) {
  const schedule = buildSchedule(game);
  if (!schedule.length) return null;

  const sixHours = 6 * 60 * 60 * 1000;
  const now = nowMs != null ? nowMs : Date.now();

  // If we're before the very first event, that first one is "upcoming"
  if (now < schedule[0].startMs) {
    const ev = schedule[0];
    return {
      currentHostIndex: ev.hostIndex,
      startMs: ev.startMs,
      endMs: ev.startMs + sixHours
    };
  }

  // Find the first event whose 6h window hasn't fully passed
  for (const ev of schedule) {
    const endMs = ev.startMs + sixHours;
    if (now <= endMs) {
      return {
        currentHostIndex: ev.hostIndex,
        startMs: ev.startMs,
        endMs
      };
    }
  }

  // Everything is finished – treat as "after last event"
  const last = schedule[schedule.length - 1];
  return {
    currentHostIndex: last.hostIndex,
    startMs: last.startMs,
    endMs: last.startMs + sixHours,
    allFinished: true
  };
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

function ordinal(n) {
  const s = ["th","st","nd","rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Host/guest pre-event view while game is in progress
function renderInProgressPreEvent(root, opts) {
  const {
    isCurrentHost,
    viewerIndex,
    viewerName,
    currentHostIndex,
    currentHostName,
    organiserName,
    rsvp,
    gameId
  } = opts;

  const safeViewer = esc(viewerName || `Host ${viewerIndex + 1}`);
  const safeHost = esc(currentHostName || `Host ${currentHostIndex + 1}`);
  const safeOrganiser = esc(organiserName || "the organiser");

  const dateStr = rsvp && rsvp.date ? formatShortDate(rsvp.date) : "";
  const timeStr = rsvp && rsvp.time ? formatShortTime(rsvp.time) : "";
  const theme   = rsvp && rsvp.theme ? rsvp.theme : "";
  const address = rsvp && rsvp.address ? rsvp.address : "";
  const phone   = rsvp && rsvp.phone ? rsvp.phone : "";

  let heading;
  let bodyCopy;

  if (isCurrentHost) {
    // Viewer IS the upcoming host
    heading = "YOUR NIGHT IS UP NEXT";
    bodyCopy = `
      Okay <strong>${safeViewer}</strong>, things are getting exciting – your dinner is next in the line-up.
      <br><br>
      Confirm your start time and where you're hosting so your guests know where to go.
      If you chose a theme earlier, we'll remind everyone about it too.
    `;
  } else {
    // Viewer is a guest; show who is hosting
    heading = "NEXT DINNER IN THE QUEST";
    bodyCopy = `
      Hi <strong>${safeViewer}</strong> – I hope you’re looking forward to enjoying
      <strong>${safeHost}</strong>’s culinary skills.
      <br><br>
      They’re hosting you on <strong>${dateStr || "a date to be confirmed"}</strong>
      ${timeStr ? " at <strong>" + timeStr + "</strong>" : ""}.
      ${address ? "<br><br><strong>Address:</strong> " + esc(address) : ""}
      ${phone   ? "<br><strong>Contact:</strong> " + esc(phone)     : ""}
      ${!timeStr ? "<br><br>If no start time is shown, please contact the host or organiser directly." : ""}
    `;
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

      <section class="menu-section">
        <div class="menu-course">ENTRÉE</div>
        <h2 class="menu-h2">${heading}</h2>
        <p class="menu-copy">
          ${bodyCopy}
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">EVENT DETAILS</h2>

        <p class="menu-copy">
          ${
            isCurrentHost
              ? "Update your start time and address. These details are only shared with your fellow guests."
              : "Here are the latest details for this dinner."
          }
        </p>

        <label class="menu-copy" for="preEventDate" style="text-align:left;margin-top:8px;">
          <strong>Hosting date</strong>
        </label>
        <input
          id="preEventDate"
          class="menu-input"
          type="date"
          value="${rsvp && rsvp.date ? esc(rsvp.date) : ""}"
          ${isCurrentHost ? "" : "disabled"}
        />

        <label class="menu-copy" for="preEventTime" style="text-align:left;margin-top:10px;">
          <strong>Start time</strong> <span class="muted">(optional)</span>
        </label>
        <input
          id="preEventTime"
          class="menu-input"
          type="time"
          value="${rsvp && rsvp.time ? esc(rsvp.time) : ""}"
          ${isCurrentHost ? "" : "disabled"}
        />

        <label class="menu-copy" for="preEventAddress" style="text-align:left;margin-top:10px;">
          <strong>Address</strong> <span class="muted">(only shared with guests)</span>
        </label>
        <textarea
          id="preEventAddress"
          class="menu-input"
          rows="2"
          ${isCurrentHost ? "" : "disabled"}
        >${address ? esc(address) : ""}</textarea>

        <label class="menu-copy" for="preEventPhone" style="text-align:left;margin-top:10px;">
          <strong>Contact phone</strong> <span class="muted">(only shared with guests)</span>
        </label>
        <input
          id="preEventPhone"
          class="menu-input"
          type="tel"
          value="${phone ? esc(phone) : ""}"
          ${isCurrentHost ? "" : "disabled"}
        />

        ${
          theme
            ? `<p class="menu-copy" style="margin-top:10px;">
                 <strong>Theme:</strong> ${esc(theme)}
               </p>`
            : ""
        }

        ${
          isCurrentHost
            ? `
        <div class="menu-actions">
          <button class="btn btn-primary" id="preEventSave">
            Save details
          </button>
        </div>
        `
            : ""
        }
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
        InviteScreen – game in progress (pre-event view)
      </p>
    </section>
  `;

  if (!isCurrentHost) {
    return; // guests just see the info
  }

  // Host can update details
  const dateEl    = root.querySelector("#preEventDate");
  const timeEl    = root.querySelector("#preEventTime");
  const addrEl    = root.querySelector("#preEventAddress");
  const phoneEl   = root.querySelector("#preEventPhone");
  const saveBtn   = root.querySelector("#preEventSave");

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const newDate  = dateEl && dateEl.value ? dateEl.value.trim() : rsvp.date || null;
      const newTime  = timeEl && timeEl.value ? timeEl.value.trim() : rsvp.time || null;
      const newAddr  = addrEl && addrEl.value ? addrEl.value.trim() : null;
      const newPhone = phoneEl && phoneEl.value ? phoneEl.value.trim() : null;

      if (!newDate) {
        window.alert("Please make sure your hosting date is set.");
        return;
      }

      await saveRsvpToFirestore(
        gameId,
        currentHostIndex,
        rsvp.status || "accepted",
        newDate,
        newTime,
        rsvp.theme || null,
        newAddr,
        newPhone
      );

      window.alert("Your event details have been saved.");
    });
  }
}
// After-event view (scoring gate)
function renderInProgressPostEvent(root, opts) {
  const {
    isCurrentHost,
    viewerName,
    currentHostName,
    organiserName
  } = opts;

  const safeViewer = esc(viewerName || "you");
  const safeHost   = esc(currentHostName || "your host");
  const safeOrganiser = esc(organiserName || "the organiser");

  if (isCurrentHost) {
    // Host: relax – no scoring for yourself
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
          <h2 class="menu-h2">SIT BACK &amp; RELAX</h2>
          <p class="menu-copy">
            You've done your best, <strong>${safeViewer}</strong>.
            As the host, you don't get to score your own dinner – now it's up to your guests.
            <br><br>
            Keep an eye out for the final leaderboard once everyone has hosted and scored.
          </p>
        </section>
      </section>
    `;
  } else {
    // Guest: scoring placeholder (we'll wire actual scoring later)
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
          <h2 class="menu-h2">TIME TO SCORE</h2>
          <p class="menu-copy">
            It's time to score <strong>${safeHost}</strong>'s dinner.
          </p>
        </section>

        <div class="menu-divider" aria-hidden="true"></div>

        <section class="menu-section">
          <div class="menu-course">MAIN</div>
          <h2 class="menu-h2">SCORING COMING SOON</h2>
          <p class="menu-copy">
            This version of the app doesn't include the scoring form yet,
            but this is where you'll rate their night out of 10
            (or by category, if your organiser chose that option).
          </p>
        </section>
      </section>
    `;
  }
}
// Shared UI renderer for both organiser + host
function renderInviteUI(root, options) {
  const {
    isOrganiser,
    hostIndex,
    hostName,
    organiserName,
    allowThemes,
    nights,
    gameId,
    actions
  } = options;

  const safeHost = esc(hostName || `Host ${hostIndex + 1}`);
  const safeOrganiser = esc(organiserName || "the organiser");

  const allNights = nights || {};
  const myNight = allNights[hostIndex] || {};

  const takenByOthers = Object.entries(allNights).filter(
    ([idx, night]) =>
      Number(idx) !== hostIndex &&
      night &&
      typeof night.date === "string" &&
      night.date
  );

  let entreeTitle;
  let entreeBodyHTML;

  if (isOrganiser) {
    entreeTitle = "YOUR NIGHT";
    if (allowThemes) {
      entreeBodyHTML = `
        Okay <strong>${safeHost}</strong>, here's where you choose which date you want to host on,
        set a start time and let everyone know what kind of themed night you're planning.
      `;
    } else {
      entreeBodyHTML = `
        Okay <strong>${safeHost}</strong>, here's where you choose which date you want to host on
        and set a start time for your dinner.
      `;
    }
  } else {
    entreeTitle = "YOUR INVITE";
    if (allowThemes) {
      entreeBodyHTML = `
        Welcome <strong>${safeHost}</strong> – <strong>${safeOrganiser}</strong> has invited you to
        take part in <em>Culinary Quest</em>, a home-dining competition where each host takes a turn
        impressing the others with their culinary skills. They’ll judge and score your efforts, and
        you’ll get to do the same when it’s their turn to host.
        <br><br>
        If you’re up for the challenge, choose the date you’d like to host, set a start time and
        let everyone know if you're setting a theme. If you can’t take part this time, simply tap
        <strong>Decline</strong> and we’ll let <strong>${safeOrganiser}</strong> know.
      `;
    } else {
      entreeBodyHTML = `
        Welcome <strong>${safeHost}</strong> – <strong>${safeOrganiser}</strong> has invited you to
        take part in <em>Culinary Quest</em>, a home-dining competition where each host takes a turn
        impressing the others with their culinary skills. They’ll judge and score your efforts, and
        you’ll get to do the same when it’s their turn to host.
        <br><br>
        If you’re up for the challenge, choose the date you’d like to host and set a start time for
        your dinner. If you can’t take part this time, simply tap <strong>Decline</strong> and we’ll
        let <strong>${safeOrganiser}</strong> know.
      `;
    }
  }

  const buttonsHTML = isOrganiser
    ? `
      <div class="menu-actions">
        <button class="btn btn-primary" id="inviteSave">
          Save &amp; view RSVPs
        </button>
      </div>
    `
    : `
      <div class="menu-actions">
        <button class="btn btn-secondary" id="inviteDecline">
          Decline
        </button>
        <button class="btn btn-primary" id="inviteAccept">
          Accept invite
        </button>
      </div>
    `;

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
        <h2 class="menu-h2">${entreeTitle}</h2>
        <p class="menu-copy">
          ${entreeBodyHTML}
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- MAIN -->
      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">YOUR NIGHT</h2>
        <p class="menu-copy">
          Choose the date for your hosting night, then continue to the RSVP tracker.
        </p>

        <label class="menu-copy" for="inviteDate" style="text-align:left;margin-top:8px;">
          <strong>Hosting date</strong>
        </label>
        <input
          id="inviteDate"
          class="menu-input"
          type="date"
          value="${myNight.date ? esc(myNight.date) : ""}"
        />

        <label class="menu-copy" for="inviteTime" style="text-align:left;margin-top:10px;">
          <strong>Start time</strong> <span class="muted">(optional)</span>
        </label>
        <input
          id="inviteTime"
          class="menu-input"
          type="time"
          value="${myNight.time ? esc(myNight.time) : ""}"
        />

        ${
          allowThemes
            ? `
        <label class="menu-copy" for="inviteTheme" style="text-align:left;margin-top:10px;">
          <strong>Theme for your night</strong> <span class="muted">(optional)</span>
        </label>
        <input
          id="inviteTheme"
          class="menu-input"
          type="text"
          maxlength="80"
          placeholder="e.g. Mexican Fiesta, Tapas &amp; Tinto"
          value="${myNight.theme ? esc(myNight.theme) : ""}"
        />
        `
            : ""
        }

        ${
          takenByOthers.length
            ? `<p class="menu-copy" style="margin-top:10px;font-size:13px;">
                 <strong>Already booked:</strong><br />
                 ${takenByOthers
                   .map(([idx, night]) => {
                     const otherIdx = Number(idx);
                     const otherName =
                       options.hosts &&
                       options.hosts[otherIdx] &&
                       options.hosts[otherIdx].name
                         ? esc(options.hosts[otherIdx].name)
                         : "Another host";
                     const niceDate = night.date;
                     return `• ${niceDate} — ${otherName}`;
                   })
                   .join("<br />")}
               </p>`
            : ""
        }

        ${buttonsHTML}
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
        InviteScreen – per-host RSVP &amp; hosting date
      </p>
    </section>
  `;

  const dateInput  = root.querySelector("#inviteDate");
  const timeInput  = root.querySelector("#inviteTime");
  const themeInput = root.querySelector("#inviteTheme");
  const saveBtn    = root.querySelector("#inviteSave");
  const acceptBtn  = root.querySelector("#inviteAccept");
  const declineBtn = root.querySelector("#inviteDecline");

  function renderDone(status) {
    const statusWord =
      status === "declined" ? "MAYBE NEXT TIME" : "YOU'RE IN!";

    let bodyHTML;
    if (isOrganiser) {
      bodyHTML = `
        Thanks, <strong>${safeHost}</strong> — we've saved your hosting night and
        added it to the line-up. You can close this tab now and continue planning
        from your organiser screen.
      `;
    } else if (status === "declined") {
      bodyHTML = `
        No problem, <strong>${safeHost}</strong>. We've noted that you can't take
        part this time and will let <strong>${safeOrganiser}</strong> know.
        You can close this tab now.
      `;
    } else {
      bodyHTML = `
        Thanks, <strong>${safeHost}</strong> — you're in!
        We'll let <strong>${safeOrganiser}</strong> know you've accepted and added
        your night to the line-up. You can close this tab now.
      `;
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

        <section class="menu-section">
          <div class="menu-course">ENTRÉE</div>
          <h2 class="menu-h2">${statusWord}</h2>
          <p class="menu-copy">
            ${bodyHTML}
          </p>
        </section>
      </section>
    `;
  }

  function enforceDateUnique(chosenDate) {
    if (!chosenDate) return null;
    const clash = Object.entries(allNights).find(([idx, night]) => {
      if (Number(idx) === hostIndex) return false;
      return night && night.date === chosenDate;
    });
    return clash || null;
  }

  if (dateInput) {
    dateInput.addEventListener("change", () => {
      const val = dateInput.value ? dateInput.value.trim() : "";
      if (!val || isOrganiser === false) return; // uniqueness only on organiser’s device

      const clash = enforceDateUnique(val);
      if (clash) {
        const [clashIdx, clashNight] = clash;
        const clashHost =
          options.hosts &&
          options.hosts[Number(clashIdx)] &&
          options.hosts[Number(clashIdx)].name
            ? options.hosts[Number(clashIdx)].name
            : "another host";

        window.alert(
          `${clashNight.date} is already booked by ${clashHost}. ` +
          "Please choose a different date so each dinner has its own night."
        );
        dateInput.value = "";
      }
    });
  }

    async function handleAccept(status) {
    const dateVal = dateInput && dateInput.value ? dateInput.value.trim() : "";
    const timeVal = timeInput && timeInput.value ? timeInput.value.trim() : "";
    const themeVal =
      themeInput && themeInput.value ? themeInput.value.trim() : "";

    if (status !== "declined" && !dateVal) {
      window.alert("Please choose a hosting date before continuing.");
      if (dateInput && typeof dateInput.focus === "function") {
        dateInput.focus();
      }
      return;
    }

    if (status !== "declined" && isOrganiser) {
      const clash = enforceDateUnique(dateVal);
      if (clash) {
        window.alert(
          "That date is already taken by another host. Please choose a different date so each dinner has its own night."
        );
        return;
      }
    }

    allNights[hostIndex] = {
      date:   status === "declined" ? null : dateVal,
      time:   status === "declined" ? null : (timeVal || null),
      theme:  status === "declined" ? null : (themeVal || null),
      status
    };
    saveNights(allNights);

    try {
      if (actions && typeof actions.patch === "function") {
        actions.patch({ hostNights: allNights });
      }
    } catch (_) {}

    await saveRsvpToFirestore(
      gameId,
      hostIndex,
      status,
      status === "declined" ? null : dateVal,
      status === "declined" ? null : (timeVal || null),
      status === "declined" ? null : (themeVal || null),
      null, // address (only set on pre-event screen)
      null  // phone   (only set on pre-event screen)
    );

    if (isOrganiser) {
      // Organiser never really "declines", so both paths go to tracker
      try {
        actions && actions.setState && actions.setState("rsvpTracker");
      } catch (_) {}
    } else {
      renderDone(status);
    }
  }

  if (saveBtn)   saveBtn.addEventListener("click", () => { handleAccept("accepted"); });
  if (acceptBtn) acceptBtn.addEventListener("click", () => { handleAccept("accepted"); });
  if (declineBtn) declineBtn.addEventListener("click", () => { handleAccept("declined"); });
}

// ------------------------------------------------------------------

export function render(root, model = {}, actions = {}) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  scrollToTop();

  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get("invite");
  const urlGameId   = params.get("game");

  // No invite token → organiser inside the app
  if (!inviteToken) {
    const hosts = hydrateHostsLocal(model);
    const nights = loadNights();

    const hostIndex = 0; // organiser is always host 0 in this flow
    const hostName  = hosts[0] && hosts[0].name ? hosts[0].name : "Host 1";

    const organiserName =
      (model.organiserName && String(model.organiserName)) ||
      hostName ||
      "the organiser";

    const allowThemes =
      model &&
      model.setup &&
      typeof model.setup.allowThemes === "boolean"
        ? model.setup.allowThemes
        : false;

    let gameId =
      (model && typeof model.gameId === "string" && model.gameId.trim()) ||
      null;
    if (!gameId) {
      try {
        const stored = window.localStorage.getItem("cq_current_game_id_v1");
        if (stored && stored.trim()) gameId = stored.trim();
      } catch (_) {}
    }

    renderInviteUI(root, {
      isOrganiser: true,
      hostIndex,
      hostName,
      organiserName,
      allowThemes,
      nights,
      hosts,
      gameId,
      actions
    });
    return;
  }

  // Invite token present → external host link (must use Firestore)
  if (!urlGameId) {
    renderError(root);
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
        <h2 class="menu-h2">Loading your invite…</h2>
        <p class="menu-copy">
          One moment while we fetch your invite details.
        </p>
      </section>
    </section>
  `;

  (async () => {
    try {
      const game = await readGame(urlGameId);
      if (!game) {
        console.warn("[InviteScreen] No such game:", urlGameId);
        renderError(root);
        return;
      }

      const hosts = Array.isArray(game.hosts) ? game.hosts : [];
      const hostIndex = hosts.findIndex(
        (h) => h && typeof h.token === "string" && h.token === inviteToken
      );

      if (hostIndex < 0) {
        console.warn("[InviteScreen] Token not found in hosts", inviteToken);
        renderError(root);
        return;
      }

      const hostDoc = hosts[hostIndex] || {};
      const hostName = hostDoc.name || `Host ${hostIndex + 1}`;

      const organiserName =
        (game.organiserName && String(game.organiserName)) ||
        (hosts[0] && hosts[0].name) ||
        "the organiser";

      const allowThemes =
        game &&
        game.setup &&
        typeof game.setup.allowThemes === "boolean"
          ? game.setup.allowThemes
          : false;

      // Build nights map from Firestore RSVPs
      const nights = {};
      if (game.rsvps && typeof game.rsvps === "object") {
        Object.keys(game.rsvps).forEach((k) => {
          const idx = Number(k);
          if (Number.isNaN(idx)) return;
          const r = game.rsvps[k] || {};
          nights[idx] = {
            date:    r.date    || null,
            time:    r.time    || null,
            theme:   r.theme   || null,
            status:  r.status  || null,
            address: r.address || null,
            phone:   r.phone   || null
          };
        });
      }

      // Merge local nights for this browser for this hostIndex (so they can revise)
      const local = loadNights();
      if (local && local[hostIndex]) {
        const ln = local[hostIndex];
        const existing = nights[hostIndex] || {};
        nights[hostIndex] = {
          date:    ln.date    || existing.date    || null,
          time:    ln.time    || existing.time    || null,
          theme:   ln.theme   || existing.theme   || null,
          status:  ln.status  || existing.status  || null,
          address: existing.address || null,
          phone:   existing.phone   || null
        };
      }

      const gameId = game.gameId || urlGameId;
      const gameStatus = game.status || "links";
      const nowMs = Date.now();

      // Treat either 'inProgress' or 'started' as the active run phase
      const isRunning =
        gameStatus === "inProgress" || gameStatus === "started";

      if (!isRunning) {
        // Before games begin → keep existing RSVP behaviour
        renderInviteUI(root, {
          isOrganiser: false,
          hostIndex,
          hostName,
          organiserName,
          allowThemes,
          nights,
          hosts,
          gameId,
          actions: {}
        });
        return;
      }

      const timing = pickCurrentEvent(game, nowMs);
      if (!timing || timing.allFinished) {
        // All dinners finished – simple message for now
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
              <h2 class="menu-h2">THIS QUEST HAS FINISHED</h2>
              <p class="menu-copy">
                All dinners in this Culinary Quest have now taken place.
                Scoring and results will appear once your organiser has wrapped things up.
              </p>
            </section>
          </section>
        `;
        return;
      }

      const { currentHostIndex, startMs, endMs } = timing;
      const rsvp = nights[currentHostIndex] || {};
      const isCurrentHost = hostIndex === currentHostIndex;
      const currentHostDoc  = hosts[currentHostIndex] || {};
      const currentHostName = currentHostDoc.name || `Host ${currentHostIndex + 1}`;

      if (!rsvp || !rsvp.date) {
        // If somehow we have an in-progress game but no date, fall back to RSVP UI
        renderInviteUI(root, {
          isOrganiser: false,
          hostIndex,
          hostName,
          organiserName,
          allowThemes,
          nights,
          hosts,
          gameId,
          actions: {}
        });
        return;
      }

if (nowMs <= endMs) {
  // Before or during the event → pre-event view
  renderInProgressPreEvent(root, {
    isCurrentHost,
    viewerIndex: hostIndex,
    viewerName: hostName,        // whose link we're on
    currentHostIndex,
    currentHostName,             // whose dinner is next
    organiserName,
    rsvp,
    gameId
  });
} else {
  // After the 6-hour window → post-event view (host relax / guest scoring placeholder)
  renderInProgressPostEvent(root, {
    isCurrentHost,
    viewerName: hostName,
    currentHostName,
    organiserName
  });
}
    } catch (err) {
      console.error("[InviteScreen] Failed to load game", err);
      renderError(root);
    }
  })();
}
