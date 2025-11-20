// path: src/skins/cooking/screens/InviteScreen.js
// Per-host invite screen (organiser & guests)

const HOSTS_STORAGE_KEY  = "cq_hosts_v1";
const TOKENS_STORAGE_KEY = "cq_host_tokens_v1";
const SETUP_STORAGE_KEY  = "cq_setup_v2";
const RSVP_STORAGE_KEY   = "cq_rsvps_v1";

// --- helpers ---------------------------------------------------------

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

// Re-use the same host hydration pattern as HostsScreen / LinksScreen
function hydrateHosts(model = {}) {
  let hosts = [];

  if (Array.isArray(model.hosts) && model.hosts.length) {
    hosts = model.hosts.map((h) => ({
      name: h && typeof h.name === "string" ? h.name : ""
    }));
  }

  // Merge in cached hosts from localStorage (non-destructive)
  try {
    const raw = window.localStorage.getItem(HOSTS_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved)) {
        saved.forEach((entry, idx) => {
          if (!hosts[idx]) hosts[idx] = { name: "" };
          if (entry && typeof entry.name === "string" && entry.name.trim()) {
            hosts[idx].name = entry.name;
          }
        });
      }
    }
  } catch (_) {}

  // Fall back to organiserName if we still have nothing
  if (!hosts[0]) {
    const organiserName =
      model.organiserName ||
      model.hostName ||
      model.name ||
      model.organiser ||
      "";
    hosts[0] = { name: organiserName || "" };
  }

  return hosts;
}

// Tokens – same logic as LinksScreen
function hydrateTokens(model = {}, hostCount) {
  let tokens = [];

  if (Array.isArray(model.hostTokens)) {
    tokens = model.hostTokens.slice();
  } else if (model.hostTokens && typeof model.hostTokens === "object") {
    tokens = [];
    Object.keys(model.hostTokens).forEach((k) => {
      const idx = Number(k);
      if (!Number.isNaN(idx)) tokens[idx] = String(model.hostTokens[k] || "");
    });
  }

  try {
    const raw = window.localStorage.getItem(TOKENS_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved)) {
        saved.forEach((val, idx) => {
          if (!tokens[idx] && typeof val === "string" && val.trim()) {
            tokens[idx] = val;
          }
        });
      }
    }
  } catch (_) {}

  // Ensure at least hostCount slots
  for (let i = 0; i < hostCount; i++) {
    if (typeof tokens[i] !== "string") tokens[i] = "";
  }

  return tokens;
}

// Setup – we only care whether themes are enabled
function hydrateSetup(model = {}) {
  let setup = model.setup && typeof model.setup === "object"
    ? { ...model.setup }
    : {};

  try {
    const raw = window.localStorage.getItem(SETUP_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && typeof saved === "object") {
        setup = { ...saved, ...setup };
      }
    }
  } catch (_) {}

  return {
    allowThemes: !!setup.allowThemes
  };
}

// RSVPs persisted per host index
function hydrateRsvps(model = {}) {
  let rsvps = {};
  if (model.rsvps && typeof model.rsvps === "object") {
    rsvps = { ...model.rsvps };
  }
  try {
    const raw = window.localStorage.getItem(RSVP_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && typeof saved === "object") {
        rsvps = { ...saved, ...rsvps };
      }
    }
  } catch (_) {}
  return rsvps;
}

function persistRsvps(rsvps, actions) {
  try {
    window.localStorage.setItem(RSVP_STORAGE_KEY, JSON.stringify(rsvps));
  } catch (_) {}

  try {
    if (actions && typeof actions.patch === "function") {
      actions.patch({ rsvps });
    }
  } catch (_) {}
}

// Map invite token → host index, or fall back to organiser (0)
function resolveHostIndex(model, hosts, tokens) {
  // 1) Explicit index the app might have set (organiser flowing from LinksScreen)
  if (
    typeof model.currentHostIndex === "number" &&
    model.currentHostIndex >= 0 &&
    model.currentHostIndex < hosts.length
  ) {
    return model.currentHostIndex;
  }

  // 2) Token from URL
  let tokenFromUrl = null;
  try {
    const params = new URLSearchParams(window.location.search);
    tokenFromUrl = params.get("invite");
  } catch (_) {}

  if (tokenFromUrl && Array.isArray(tokens)) {
    const idx = tokens.indexOf(tokenFromUrl);
    if (idx >= 0 && idx < hosts.length) {
      return idx;
    }
  }

  // 3) Fallback: organiser
  return 0;
}

// --- main render ----------------------------------------------------

export function render(root, model = {}, actions = {}) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  scrollToTop();

  const hosts  = hydrateHosts(model);
  const tokens = hydrateTokens(model, hosts.length);
  const setup  = hydrateSetup(model);
  const rsvps  = hydrateRsvps(model);

  const hostIndex = resolveHostIndex(model, hosts, tokens);
  const isOrganiser = hostIndex === 0;

  const hostName       = (hosts[hostIndex] && hosts[hostIndex].name) || "you";
  const organiserName  = (hosts[0] && hosts[0].name) || "the organiser";

  // Is this visit coming from an external invite link?
  let viaInviteToken = false;
  try {
    const params = new URLSearchParams(window.location.search);
    viaInviteToken = !!params.get("invite");
  } catch (_) {}

  // Save the resolved host index back into the model for later screens
  try {
    if (actions && typeof actions.patch === "function") {
      actions.patch({ currentHostIndex: hostIndex });
    }
  } catch (_) {}

  const existing = rsvps[hostIndex] || {};
  const existingDate = existing.date || "";
  const existingTime = existing.time || "";
  const existingTheme = existing.theme || "";

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
        <h2 class="menu-h2">YOUR INVITE</h2>
        <p class="menu-copy">
          You've been invited to take part in a home-dining competition
          hosted by <strong>${esc(organiserName || "your friend")}</strong>.
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- MAIN -->
      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">YOUR NIGHT</h2>
        <p class="menu-copy">
          ${isOrganiser
            ? "Choose the date for your hosting night, then continue to the RSVP tracker."
            : `Choose the date for <strong>${esc(
                hostName
              )}</strong>'s night, then accept or decline this invite.`}
        </p>

        <form id="inviteForm" class="invite-form">
          <label class="menu-copy" style="text-align:left;margin-top:8px;">
            Hosting date
            <input
              id="inviteDate"
              type="date"
              required
              value="${esc(existingDate)}"
              class="menu-input"
              style="margin-top:4px;"
            />
          </label>

          <label class="menu-copy" style="text-align:left;margin-top:10px;">
            Start time <span class="muted">(optional)</span>
            <input
              id="inviteTime"
              type="time"
              value="${esc(existingTime)}"
              class="menu-input"
              style="margin-top:4px;"
            />
          </label>

          ${
            setup.allowThemes
              ? `
          <label class="menu-copy" style="text-align:left;margin-top:10px;">
            Theme for your night <span class="muted">(optional)</span>
            <input
              id="inviteTheme"
              type="text"
              maxlength="60"
              placeholder="e.g. Mexican Fiesta, Feathers & Fedoras"
              value="${esc(existingTheme)}"
              class="menu-input"
              style="margin-top:4px;"
            />
          </label>
          `
              : ""
          }

          <div class="menu-actions" style="margin-top:16px;">
            <button type="submit" class="btn btn-primary" id="inviteAccept">
              ${isOrganiser ? "Save & view RSVPs" : "Accept invite"}
            </button>
            ${
              isOrganiser
                ? ""
                : `<button type="button" class="btn btn-secondary" id="inviteDecline">
                     Decline
                   </button>`
            }
          </div>
        </form>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      ${
        viaInviteToken && !isOrganiser
          ? `
        <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
          This invite link is private to ${esc(hostName)}. Please don't share it.
        </p>
      `
          : `
        <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
          InviteScreen – per-host RSVP & date selection
        </p>
      `
      }
    </section>
  `;

  const form       = root.querySelector("#inviteForm");
  const dateInput  = root.querySelector("#inviteDate");
  const timeInput  = root.querySelector("#inviteTime");
  const themeInput = root.querySelector("#inviteTheme");
  const declineBtn = root.querySelector("#inviteDecline");

  if (!form || !dateInput) return;

  function loadLatestRsvps() {
    // Always re-read to avoid stale copies
    return hydrateRsvps(actions && actions.model ? actions.model : model);
  }

  function handleAccepted(ev) {
    ev.preventDefault();

    const dateVal = dateInput.value;
    const timeVal = timeInput ? timeInput.value : "";
    const themeVal = themeInput ? themeInput.value.trim() : "";

    if (!dateVal) {
      window.alert("Please choose a hosting date.");
      return;
    }

    // Check for clashes on the same calendar day
    const allRsvps = loadLatestRsvps();

    const dateOnly = dateVal; // yyyy-mm-dd from <input type="date">

    for (const [idxStr, info] of Object.entries(allRsvps)) {
      const idx = Number(idxStr);
      if (!Number.isInteger(idx) || idx === hostIndex) continue;
      if (!info || typeof info !== "object") continue;
      if (info.date === dateOnly && info.status === "accepted") {
        const otherName =
          (hosts[idx] && hosts[idx].name) || `Host ${idx + 1}`;
        window.alert(
          `That date is already taken by ${otherName}. Please choose a different day.`
        );
        return;
      }
    }

    const updated = {
      ...allRsvps,
      [hostIndex]: {
        status: "accepted",
        date: dateOnly,
        time: timeVal || "",
        theme: themeVal || ""
      }
    };

    persistRsvps(updated, actions);

    if (isOrganiser && !viaInviteToken) {
      // In-app organiser flow → jump to tracker
      try {
        actions.setState && actions.setState("rsvpTracker");
      } catch (_) {}
      return;
    }

    // External (or non-organiser) flow → show confirmation message
    const msgName = esc(hostName);
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
          <h2 class="menu-h2">YOU'RE IN!</h2>
          <p class="menu-copy">
            Thanks, <strong>${msgName}</strong> — you're in!
            We'll let <strong>${esc(
              organiserName || "the organiser"
            )}</strong> know you've accepted and added your night to the line-up.
          </p>
          <p class="menu-copy">
            You can close this tab now.
          </p>
        </section>
      </section>
    `;
  }

  function handleDeclined() {
    const allRsvps = loadLatestRsvps();
    const updated = {
      ...allRsvps,
      [hostIndex]: {
        status: "declined",
        date: "",
        time: "",
        theme: ""
      }
    };
    persistRsvps(updated, actions);

    const msgName = esc(hostName);
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
          <h2 class="menu-h2">MAYBE NEXT TIME</h2>
          <p class="menu-copy">
            No worries, <strong>${msgName}</strong> – we've let
            <strong>${esc(
              organiserName || "the organiser"
            )}</strong> know you've declined this time.
          </p>
          <p class="menu-copy">
            You can close this tab now.
          </p>
        </section>
      </section>
    `;
  }

  form.addEventListener("submit", handleAccepted);
  if (declineBtn) {
    declineBtn.addEventListener("click", handleDeclined);
  }
}
