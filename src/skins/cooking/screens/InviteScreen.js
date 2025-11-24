// path: src/skins/cooking/screens/InviteScreen.js
// Per-host invite screen – organiser AND guests, with Firestore-backed names & RSVPs

import { readGame, updateGame } from "../../../engine/firestore.js";

const HOSTS_STORAGE_KEY   = "cq_hosts_v1";
const NIGHTS_STORAGE_KEY  = "cq_host_nights_v1";
const SETUP_STORAGE_KEY   = "cq_setup_v2";
const CURRENT_GAME_KEY    = "cq_current_game_id_v1";

// ---------- small helpers ----------

function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Local cache of host names (from HostsScreen)
function hydrateHostsFromLocal(model = {}) {
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

// hostIndex -> { date, time, theme, status }
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

function loadAllowThemesFallback() {
  try {
    const raw = window.localStorage.getItem(SETUP_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.allowThemes === "boolean") {
      return parsed.allowThemes;
    }
  } catch (_) {}
  return false;
}

// ---------- shared form renderer ----------

function renderInviteForm(root, model, actions, opts) {
  const {
    hostIndex,
    hostName,
    organiserName,
    allowThemes,
    gameId,
    isOrganiser,
    hostsForDates
  } = opts;

  const safeHost       = esc(hostName || `Host ${hostIndex + 1}`);
  const safeOrganiser  = esc(organiserName || "the organiser");
  const hostsArr       = Array.isArray(hostsForDates) ? hostsForDates : [];
  const nights         = loadNights();
  const myNight        = nights[hostIndex] || {};

  // Who else has already picked a date on THIS device?
  const takenByOthers = Object.entries(nights).filter(
    ([idx, night]) =>
      Number(idx) !== hostIndex &&
      night &&
      typeof night.date === "string" &&
      night.date
  );

  // Copy variants
  let entreeTitle = isOrganiser ? "YOUR NIGHT" : "YOUR INVITE";
  let entreeBodyHTML;

  if (isOrganiser) {
    // Organiser – always “save & view RSVPs”
    if (allowThemes) {
      entreeBodyHTML = `
        Okay <strong>${safeHost}</strong>, here's where you choose which date you
        want to host on, set a start time and let everyone know what kind of
        themed night you're planning.
      `;
    } else {
      entreeBodyHTML = `
        Okay <strong>${safeHost}</strong>, here's where you choose which date you
        want to host on and set a start time for your dinner.
      `;
    }
  } else {
    // Guest via invite link
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

  // Main screen HTML
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
          placeholder="e.g. Mexican Fiesta, Tapas & Tinto"
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
                     const i = Number(idx);
                     const otherHost =
                       hostsArr[i] && hostsArr[i].name
                         ? esc(hostsArr[i].name)
                         : "Another host";
                     return `• ${night.date} — ${otherHost}`;
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

  const dateInput   = root.querySelector("#inviteDate");
  const timeInput   = root.querySelector("#inviteTime");
  const themeInput  = root.querySelector("#inviteTheme");
  const saveBtn     = root.querySelector("#inviteSave");
  const acceptBtn   = root.querySelector("#inviteAccept");
  const declineBtn  = root.querySelector("#inviteDecline");

  // --- helpers inside the form ---

  function enforceDateUnique(chosenDate) {
    if (!chosenDate) return null;
    const clash = Object.entries(nights).find(([idx, night]) => {
      if (Number(idx) === hostIndex) return false;
      return night && night.date === chosenDate;
    });
    return clash || null;
  }

  if (dateInput) {
    dateInput.addEventListener("change", () => {
      const val = dateInput.value ? dateInput.value.trim() : "";
      if (!val) return;

      const clash = enforceDateUnique(val);
      if (clash) {
        const [clashIdx, clashNight] = clash;
        const other =
          hostsArr[Number(clashIdx)] && hostsArr[Number(clashIdx)].name
            ? hostsArr[Number(clashIdx)].name
            : "another host";

        window.alert(
          `${clashNight.date} is already booked by ${other}. ` +
            "Please choose a different date so each dinner has its own night."
        );

        dateInput.value = "";
      }
    });
  }

  async function syncRsvpToFirestore(status, date, time, theme) {
    if (!gameId) return; // organiser didn’t manage to create a cloud game yet

    try {
      const nowIso = new Date().toISOString();
      await updateGame(gameId, {
        [`rsvps.${hostIndex}`]: {
          hostIndex,
          status,
          date: date || null,
          time: time || null,
          theme: theme || null,
          updatedAt: nowIso
        }
      });
    } catch (err) {
      console.warn("[InviteScreen] Failed to sync RSVP to Firestore", err);
    }
  }

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

  async function handleAccept() {
    const dateVal = dateInput && dateInput.value ? dateInput.value.trim() : "";
    const timeVal = timeInput && timeInput.value ? timeInput.value.trim() : "";
    const themeVal =
      themeInput && themeInput.value ? themeInput.value.trim() : "";

    if (!dateVal) {
      window.alert("Please choose a hosting date before continuing.");
      if (dateInput && typeof dateInput.focus === "function") {
        dateInput.focus();
      }
      return;
    }

    const clash = enforceDateUnique(dateVal);
    if (clash) {
      window.alert(
        "That date is already taken by another host. Please choose a different date so each dinner has its own night."
      );
      return;
    }

    nights[hostIndex] = {
      date: dateVal,
      time: timeVal || null,
      theme: themeVal || null,
      status: "accepted"
    };
    saveNights(nights);

    try {
      if (actions && typeof actions.patch === "function") {
        actions.patch({ hostNights: nights });
      }
    } catch (_) {}

    // Fire-and-forget cloud sync
    syncRsvpToFirestore("accepted", dateVal, timeVal || null, themeVal || null);

    if (isOrganiser) {
      try {
        actions.setState && actions.setState("rsvpTracker");
      } catch (_) {}
    } else {
      renderDone("accepted");
    }
  }

  async function handleDecline() {
    nights[hostIndex] = {
      date: null,
      time: null,
      theme: null,
      status: "declined"
    };
    saveNights(nights);

    try {
      if (actions && typeof actions.patch === "function") {
        actions.patch({ hostNights: nights });
      }
    } catch (_) {}

    syncRsvpToFirestore("declined", null, null, null);
    renderDone("declined");
  }

  if (saveBtn)    saveBtn.addEventListener("click", handleAccept);
  if (acceptBtn)  acceptBtn.addEventListener("click", handleAccept);
  if (declineBtn) declineBtn.addEventListener("click", handleDecline);
}

// ---------- entry point ----------

export function render(root, model = {}, actions = {}) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  // Always start top-of-page
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

  const params      = new URLSearchParams(window.location.search);
  const inviteToken = params.get("invite");
  const urlGameId   = params.get("game");

  let gameId =
    (urlGameId && urlGameId.trim()) ||
    (model && typeof model.gameId === "string" && model.gameId.trim()) ||
    null;

  if (!gameId) {
    try {
      const stored = window.localStorage.getItem(CURRENT_GAME_KEY);
      if (stored && stored.trim()) {
        gameId = stored.trim();
      }
    } catch (_) {}
  }

  // GUEST FLOW – opened via invite link: ?state=invite&invite=XXX&game=YYY
  if (inviteToken && gameId) {
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
            Just a moment while we fetch your details.
          </p>
        </section>
      </section>
    `;

    (async () => {
      try {
        const game = await readGame(gameId);
        if (!game || !Array.isArray(game.hosts)) {
          throw new Error("No such game");
        }

        const hosts = game.hosts;
        const host = hosts.find((h) => h && h.token === inviteToken);
        if (!host) {
          throw new Error("Invite token not found");
        }

        const hostIndex =
          typeof host.index === "number"
            ? host.index
            : hosts.indexOf(host);

        const organiserName =
          (game.organiserName && String(game.organiserName).trim()) ||
          (hosts[0] && hosts[0].name) ||
          "the organiser";

        const hostName =
          (host.name && String(host.name).trim()) ||
          `Host ${hostIndex + 1}`;

        const allowThemes =
          !!(game.setup && typeof game.setup.allowThemes === "boolean"
            ? game.setup.allowThemes
            : loadAllowThemesFallback());

        renderInviteForm(root, model, actions, {
          hostIndex,
          hostName,
          organiserName,
          allowThemes,
          gameId,
          isOrganiser: false,
          hostsForDates: hosts
        });
      } catch (err) {
        console.error("[InviteScreen] Failed to load invite from Firestore", err);
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
                We couldn't load your invite right now. Please try opening the link again
                in a moment.
              </p>
            </section>
          </section>
        `;
      }
    })();

    return;
  }

  // ORGANISER FLOW – inside the app (no invite token)
  const localHosts = hydrateHostsFromLocal(model);

  let hostIndex = 0;
  if (Number.isInteger(model.activeHostIndex)) {
    hostIndex = model.activeHostIndex;
  }
  if (hostIndex < 0 || hostIndex >= localHosts.length) {
    hostIndex = 0;
  }

  const organiserName =
    (model.organiserName && String(model.organiserName).trim()) ||
    (localHosts[0] && localHosts[0].name) ||
    "the organiser";

  const hostName =
    (localHosts[hostIndex] && localHosts[hostIndex].name) ||
    (hostIndex === 0 ? organiserName : `Host ${hostIndex + 1}`);

  const allowThemes =
    !!(model &&
      model.setup &&
      typeof model.setup.allowThemes === "boolean"
      ? model.setup.allowThemes
      : loadAllowThemesFallback());

  renderInviteForm(root, model, actions, {
    hostIndex,
    hostName,
    organiserName,
    allowThemes,
    gameId,
    isOrganiser: true,
    hostsForDates: localHosts
  });
}
