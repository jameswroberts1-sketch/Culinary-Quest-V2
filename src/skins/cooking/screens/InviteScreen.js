// path: src/skins/cooking/screens/InviteScreen.js
// Per-host invite screen – used by organiser and all other hosts

const HOSTS_STORAGE_KEY   = "cq_hosts_v1";
const NIGHTS_STORAGE_KEY  = "cq_host_nights_v1";
const SETUP_STORAGE_KEY = "cq_setup_v2";

function loadAllowThemes() {
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

// --- helpers --------------------------------------------------

function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Load hosts the same way as HostsScreen / LinksScreen
function hydrateHosts(model = {}) {
  let hosts = [];

  if (Array.isArray(model.hosts) && model.hosts.length) {
    hosts = model.hosts.map((h) => ({
      name: h && typeof h.name === "string" ? h.name : ""
    }));
  }

  // Merge in local cache from HostsScreen
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

// Map hostIndex -> { date, time, status }
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

// --- main render ----------------------------------------------

export function render(root, model = {}, actions = {}) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  // Always start at the top of the page (avoid “zoomed in” look on iOS)
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

  const hosts = hydrateHosts(model);
  const allowThemes = loadAllowThemes();

  // Which host is this invite for?
  //  - Organiser flow: LinksScreen set model.activeHostIndex = 0
  //  - Host links: app.js set model.activeHostIndex based on the invite token
  let hostIndex = 0;
  if (Number.isInteger(model.activeHostIndex)) {
    hostIndex = model.activeHostIndex;
  }
  if (hostIndex < 0 || hostIndex >= hosts.length) {
    hostIndex = 0;
  }

  // Work out whether this visit came from a copied invite link
  const params = new URLSearchParams(window.location.search);
  const hasInviteToken   = !!params.get("invite");
  const qpHostName       = params.get("h");
  const qpOrganiserName  = params.get("o");

  // Display names – prefer URL params (for external browsers),
  // then fall back to the organiser model / saved hosts.
  const organiserNameRaw =
    (qpOrganiserName && qpOrganiserName.trim()) ||
    (model.organiserName && String(model.organiserName)) ||
    (hosts[0] && hosts[0].name) ||
    "the organiser";

  const hostNameRaw =
    (qpHostName && qpHostName.trim()) ||
    (hosts[hostIndex] && hosts[hostIndex].name) ||
    `Host ${hostIndex + 1}`;

  const organiserName = organiserNameRaw.trim() || "the organiser";
  const hostName      = hostNameRaw.trim()      || `Host ${hostIndex + 1}`;

  const safeOrganiser = esc(organiserName);
  const safeHost      = esc(hostName);

  // Inside the organiser flow (no ?invite= in URL), host #1 is the organiser.
  // Any visit that arrives via an invite link is treated as a normal host,
  // even if that link belongs to Host 1.
  const isOrganiser = !hasInviteToken && hostIndex === 0;
  
  // Nights data (for date uniqueness + prefill)
  const nights   = loadNights();
  const myNight  = nights[hostIndex] || {};
  const takenByOthers = Object.entries(nights).filter(
    ([idx, night]) =>
      Number(idx) !== hostIndex &&
      night &&
      typeof night.date === "string" &&
      night.date
  );

    // Copy variants ------------------------------------------------
  let entreeTitle, entreeBodyHTML;

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

  // HTML ---------------------------------------------------------
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
  takenByOthers.length
    ? `<p class="menu-copy" style="margin-top:10px;font-size:13px;">
         <strong>Already booked:</strong><br />
         ${takenByOthers
           .map(([idx, night]) => {
             const otherIdx = Number(idx);
             const otherName =
               hosts[otherIdx] && hosts[otherIdx].name
                 ? esc(hosts[otherIdx].name)
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

  const dateInput   = root.querySelector("#inviteDate");
  const timeInput   = root.querySelector("#inviteTime");
  const saveBtn     = root.querySelector("#inviteSave");
  const acceptBtn   = root.querySelector("#inviteAccept");
  const declineBtn  = root.querySelector("#inviteDecline");

  // --- local helpers inside render ------------------------------

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
        const clashHost =
          hosts[Number(clashIdx)] && hosts[Number(clashIdx)].name
            ? hosts[Number(clashIdx)].name
            : "another host";

        window.alert(
          `${clashNight.date} is already booked by ${clashHost}. ` +
          "Please choose a different date so each dinner has its own night."
        );

        // Clear the invalid choice so they can't accidentally submit it
        dateInput.value = "";
      }
    });
  }
  
  function renderDone(status) {
    const statusWord =
      status === "declined" ? "MAYBE NEXT TIME" : "YOU'RE IN!";

    let bodyHTML;
    if (isOrganiser) {
      // In practice the organiser only “accepts” via Save, but keep branch here.
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

  function handleAccept() {
    const dateVal = dateInput && dateInput.value ? dateInput.value.trim() : "";
    const timeVal = timeInput && timeInput.value ? timeInput.value.trim() : "";

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
      status: "accepted"
    };
    saveNights(nights);

    // Let the rest of the app know (safe even if nothing listens)
    try {
      if (actions && typeof actions.patch === "function") {
        actions.patch({ hostNights: nights });
      }
    } catch (_) {}

    if (isOrganiser) {
      // Organiser goes to the RSVP tracker
      try {
        actions.setState && actions.setState("rsvpTracker");
      } catch (_) {}
    } else {
      renderDone("accepted");
    }
  }

  function handleDecline() {
    nights[hostIndex] = {
      date: null,
      time: null,
      status: "declined"
    };
    saveNights(nights);

    try {
      if (actions && typeof actions.patch === "function") {
        actions.patch({ hostNights: nights });
      }
    } catch (_) {}

    renderDone("declined");
  }

  // --- wire up buttons -----------------------------------------

  if (saveBtn)   saveBtn.addEventListener("click", handleAccept);
  if (acceptBtn) acceptBtn.addEventListener("click", handleAccept);
  if (declineBtn) declineBtn.addEventListener("click", handleDecline);
}
