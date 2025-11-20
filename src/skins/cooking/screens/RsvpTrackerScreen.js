// path: src/skins/cooking/screens/RsvpTrackerScreen.js
// Overview of all hosts & their replies

const HOSTS_STORAGE_KEY  = "cq_hosts_v1";
const NIGHTS_STORAGE_KEY = "cq_host_nights_v1";

// --- helpers --------------------------------------------------

function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Same host loader as HostsScreen / LinksScreen / InviteScreen
function hydrateHosts(model = {}) {
  let hosts = [];

  if (Array.isArray(model.hosts) && model.hosts.length) {
    hosts = model.hosts.map((h) => ({
      name: h && typeof h.name === "string" ? h.name : ""
    }));
  }

  // Merge from localStorage (non-destructive)
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

// hostIndex -> { date, time, status }
function loadNights(model = {}) {
  // Prefer any nights already on the model
  if (model.hostNights && typeof model.hostNights === "object") {
    return model.hostNights;
  }

  try {
    const raw = window.localStorage.getItem(NIGHTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
}

// --- main render ----------------------------------------------

export function render(root, model = {}, actions = {}) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  // Always start scrolled to the top
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

  const hosts  = hydrateHosts(model);
  const nights = loadNights(model);

  const organiserNameRaw =
    (model.organiserName && String(model.organiserName)) ||
    (hosts[0] && hosts[0].name) ||
    "the organiser";

  const organiserName = organiserNameRaw.trim() || "the organiser";
  const safeOrganiser = esc(organiserName);

  const totalHosts = hosts.length;
  const totalAccepted = Object.values(nights).filter(
    (n) => n && n.status === "accepted"
  ).length;
  const totalResponded = Object.values(nights).filter(
    (n) => n && (n.status === "accepted" || n.status === "declined")
  ).length;

  const allHaveResponded = totalResponded >= totalHosts;
  const allAccepted = allHaveResponded &&
    totalAccepted === totalHosts;

  // If only organiser is known, show the “add more hosts” message
  const hasAtLeastTwoHosts = totalHosts >= 2;

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
        <p class="menu-copy">
          Here's where you can keep an eye on who has accepted, declined, or not yet responded.
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- MAIN -->
      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">HOST LINE-UP</h2>
        <p class="menu-copy">
          Here's the current status for each host. Dates are final once a host has accepted.
        </p>

        ${
          hasAtLeastTwoHosts
            ? `<ul class="hosts-list" id="trackerList"></ul>`
            : `<p class="menu-copy">
                 So far only <strong>${safeOrganiser}</strong> is listed as a host.
                 Go back and add at least one more host to get the full RSVP picture.
               </p>`
        }

        <p class="menu-copy" style="margin-top:10px;font-size:13px;">
          Responses: <strong>${totalResponded}</strong> of <strong>${totalHosts}</strong>
          received${allHaveResponded ? " — everyone has replied." : "."}
        </p>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <div class="menu-actions">
        <button class="btn btn-secondary" id="trackerCancel">Cancel</button>
        <button
          class="btn btn-primary"
          id="trackerStart"
          ${allAccepted ? "" : "disabled style='opacity:0.6;cursor:not-allowed;'"}
        >
          Let the games begin
        </button>
      </div>

      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
        RsvpTrackerScreen – overview of all hosts &amp; their replies
      </p>
    </section>
  `;

  const listEl      = root.querySelector("#trackerList");
  const cancelBtn   = root.querySelector("#trackerCancel");
  const startBtn    = root.querySelector("#trackerStart");

  if (listEl && hasAtLeastTwoHosts) {
    const rows = hosts.map((host, index) => {
      const name = (host && host.name && host.name.trim())
        ? esc(host.name)
        : `Host ${index + 1}`;

      const night = nights[index] || {};
      let statusLabel = "No response yet";
      if (night.status === "accepted") statusLabel = "Accepted";
      else if (night.status === "declined") statusLabel = "Declined";

      const dateLabel = night.date ? esc(night.date) : "TBC";
      const timeLabel = night.time ? esc(night.time) : null;

      return `
        <li class="host-row">
          <div class="host-row-label">Host ${index + 1}</div>
          <div class="host-row-main">
            <div class="host-row-name">${name}</div>
            <div class="host-row-meta">
              ${statusLabel}<br />
              Date: <strong>${dateLabel}</strong>
              ${timeLabel ? `<br />Start: <strong>${timeLabel}</strong>` : ""}
            </div>
          </div>
        </li>
      `;
    });

    listEl.innerHTML = rows.join("");
  }

  // --- navigation buttons --------------------------------------

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      // Back to links for now
      try {
        actions.setState && actions.setState("links");
      } catch (_) {}
    });
  }

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      if (!allAccepted) {
        window.alert(
          "You can only start the game once every host has accepted and chosen a date."
        );
        return;
      }
      try {
        actions.setState && actions.setState("started");
      } catch (_) {}
    });
  }
}
