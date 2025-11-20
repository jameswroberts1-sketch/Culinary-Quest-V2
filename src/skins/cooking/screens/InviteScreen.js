// path: src/skins/cooking/screens/InviteScreen.js
// Per-host invite + RSVP
//
// • If there is NO ?invite= token → organiser view (Host #1, inside the app)
// • If there IS ?invite=abc…      → guest view (any host following their link)

const RSVP_STORAGE_KEY = "cq_rsvps_v1";

function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getQueryParam(name) {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search || "");
  return params.get(name) || "";
}

function hydrateRsvps(model = {}) {
  let rsvps = {};

  if (model.rsvps && typeof model.rsvps === "object") {
    rsvps = { ...model.rsvps };
  } else {
    try {
      const raw = window.localStorage.getItem(RSVP_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === "object") {
          rsvps = saved;
        }
      }
    } catch (_) {}
  }

  return rsvps || {};
}

function persistRsvps(rsvps, actions) {
  try {
    window.localStorage.setItem(RSVP_STORAGE_KEY, JSON.stringify(rsvps));
  } catch (_) {}

  try {
    if (actions && typeof actions.updateRsvps === "function") {
      actions.updateRsvps(rsvps);
    } else if (actions && typeof actions.setRsvps === "function") {
      actions.setRsvps(rsvps);
    } else if (actions && typeof actions.patch === "function") {
      actions.patch({ rsvps });
    }
  } catch (_) {
    // non-fatal
  }
}

export function render(root, model = {}, actions = {}) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  const hosts = Array.isArray(model.hosts) ? model.hosts : [];
  const invites =
    model.invites && typeof model.invites === "object" ? model.invites : {};

  const token = getQueryParam("invite");

  // When there is no token we treat this as the organiser
  // stepping through their own invite inside the app.
  const isOrganiserView = !token;

  let hostIndex = 0;

  if (token && invites[token] && typeof invites[token].index === "number") {
    hostIndex = invites[token].index;
  }

  // Safety clamp
  if (hostIndex < 0) hostIndex = 0;
  if (hosts.length && hostIndex >= hosts.length) {
    hostIndex = hosts.length - 1;
  }

  const organiserName =
    (hosts[0] &&
      typeof hosts[0].name === "string" &&
      hosts[0].name.trim()) ||
    model.organiserName ||
    "the organiser";

  const hostName =
    (hosts[hostIndex] &&
      typeof hosts[hostIndex].name === "string" &&
      hosts[hostIndex].name.trim()) ||
    (hostIndex === 0 ? organiserName : `Host ${hostIndex + 1}`);

  const setup = model.setup || {};
  const allowThemes = !!setup.allowThemes;

  let rsvps = hydrateRsvps(model);

  let current = Object.assign(
    { date: "", time: "", theme: "" },
    rsvps[hostIndex] || {}
  );

  const entreeHeading = isOrganiserView ? "YOUR NIGHT" : "YOUR INVITE";

  const entreeBody = isOrganiserView
    ? `You're Host #1. This is your own night of the Quest. Confirm your hosting date${
        allowThemes ? " and optionally a theme" : ""
      }, then tap <strong>Continue</strong>.`
    : `You've been invited to take part in a home-dining competition hosted by <strong>${esc(
        organiserName
      )}</strong>. On one of the nights you'll be the host: <strong>${esc(
        hostName
      )}</strong>.`;

  const mainBody = isOrganiserView
    ? "Choose the date for your hosting night (and theme if enabled). Everyone else will do the same from their own invite link."
    : "Choose your preferred hosting date (and theme if enabled), then accept or decline your invite.";

  const themeFieldHtml = allowThemes
    ? `
        <label class="menu-copy" for="inviteTheme" style="display:block;margin-top:10px;text-align:left;">
          Optional theme for your night
        </label>
        <input
          id="inviteTheme"
          class="menu-input"
          type="text"
          placeholder="e.g. Mexican Fiesta, Feathers & Fedoras"
          maxlength="60"
          value="${esc(current.theme || "")}"
        />
      `
    : "";

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
        <h2 class="menu-h2">${entreeHeading}</h2>
        <p class="menu-copy">
          ${entreeBody}
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- MAIN -->
      <section class="menu-section" style="text-align:left;">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">YOUR HOSTING NIGHT</h2>
        <p class="menu-copy">
          ${mainBody}
        </p>

        <label class="menu-copy" for="inviteDate" style="display:block;margin-top:8px;text-align:left;">
          Hosting date
        </label>
        <input
          id="inviteDate"
          class="menu-input"
          type="date"
          value="${esc(current.date || "")}"
        />

        <label class="menu-copy" for="inviteTime" style="display:block;margin-top:10px;text-align:left;">
          Time (optional)
        </label>
        <input
          id="inviteTime"
          class="menu-input"
          type="time"
          value="${esc(current.time || "")}"
        />

        ${themeFieldHtml}
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <div class="menu-actions">
        ${
          isOrganiserView
            ? `
          <button class="btn btn-secondary" id="inviteBack">Back</button>
          <button class="btn btn-primary" id="inviteContinue">Continue</button>
        `
            : `
          <button class="btn btn-secondary" id="inviteDecline">Decline</button>
          <button class="btn btn-primary" id="inviteAccept">Accept</button>
        `
        }
      </div>

      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
        InviteScreen – Host ${hostIndex + 1} · ${esc(hostName)}
      </p>
    </section>
  `;

  // Always start this screen scrolled to the top (and not zoomed)
  try {
    const scroller =
      document.scrollingElement ||
      document.documentElement ||
      document.body;
    requestAnimationFrame(() => {
      scroller.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  } catch (_) {}

  // ---- wire up inputs -------------------------------------------------

  const dateInput = root.querySelector("#inviteDate");
  const timeInput = root.querySelector("#inviteTime");
  const themeInput = root.querySelector("#inviteTheme");

  if (dateInput) {
    dateInput.addEventListener("change", (ev) => {
      current.date = ev.target.value || "";
    });
  }
  if (timeInput) {
    timeInput.addEventListener("change", (ev) => {
      current.time = ev.target.value || "";
    });
  }
  if (themeInput) {
    themeInput.addEventListener("input", (ev) => {
      current.theme = ev.target.value || "";
    });
  }

  function saveStatus(status) {
    const nextRecord = {
      date: current.date || "",
      time: current.time || "",
      theme: current.theme || "",
      status
    };
    rsvps = {
      ...rsvps,
      [hostIndex]: nextRecord
    };
    persistRsvps(rsvps, actions);
  }

  function showGuestThankYou(status) {
    const card = root.querySelector(".menu-card");
    if (!card) return;

    const accepted = status === "accepted";

    card.innerHTML = `
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
        <h2 class="menu-h2">${
          accepted ? "YOU'RE IN!" : "MAYBE NEXT TIME"
        }</h2>
        <p class="menu-copy">
          ${
            accepted
              ? `Thanks, <strong>${esc(
                  hostName
                )}</strong> &mdash; you're in! We'll let <strong>${esc(
                  organiserName
                )}</strong> know you've accepted and added your night to the line-up.`
              : `Thanks for letting us know, <strong>${esc(
                  hostName
                )}</strong>. <strong>${esc(
                  organiserName
                )}</strong> will see that you've declined this time.`
          }
        </p>
        <p class="menu-copy">
          You can close this tab now.
        </p>
      </section>
    `;
  }

  // ---- buttons --------------------------------------------------------

  const backBtn = root.querySelector("#inviteBack");
  const continueBtn = root.querySelector("#inviteContinue");
  const acceptBtn = root.querySelector("#inviteAccept");
  const declineBtn = root.querySelector("#inviteDecline");

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      try {
        actions.setState && actions.setState("links");
      } catch (_) {}
    });
  }

  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      // Organiser is implicitly "accepted"
      saveStatus("accepted");
      try {
        actions.setState && actions.setState("rsvpTracker");
      } catch (_) {}
    });
  }

  if (acceptBtn) {
    acceptBtn.addEventListener("click", () => {
      saveStatus("accepted");
      showGuestThankYou("accepted");
    });
  }

  if (declineBtn) {
    declineBtn.addEventListener("click", () => {
      saveStatus("declined");
      showGuestThankYou("declined");
    });
  }
}
