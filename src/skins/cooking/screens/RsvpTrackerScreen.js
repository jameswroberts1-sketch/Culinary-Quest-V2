// path: src/skins/cooking/screens/RsvpTrackerScreen.js
// Overview of all hosts & their RSVP status

const HOSTS_STORAGE_KEY = "cq_hosts_v1";
const RSVP_STORAGE_KEY  = "cq_rsvps_v1";

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

function hydrateHosts(model = {}) {
  let hosts = [];

  if (Array.isArray(model.hosts) && model.hosts.length) {
    hosts = model.hosts.map((h) => ({
      name: h && typeof h.name === "string" ? h.name : ""
    }));
  }

  // Merge in cached names from localStorage (non-destructive)
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

  // Ensure at least organiser entry
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

// --- main render -----------------------------------------------------

export function render(root, model = {}, actions = {}) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  scrollToTop();

  const hosts = hydrateHosts(model);
  const rsvps = hydrateRsvps(model);

  const organiserName = (hosts[0] && hosts[0].name) || "the organiser";
  const totalHosts = hosts.length;

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
        ${
          totalHosts < 2
            ? `
          <p class="menu-copy">
            So far only <strong>${esc(
              organiserName
            )}</strong> is listed as a host. Go back and add at least one more
            host to get the full RSVP picture.
          </p>
        `
            : `
          <p class="menu-copy">
            Here's the current status for each host. Dates are final once a host has accepted.
          </p>

          <ul class="hosts-list" id="rsvpList"></ul>
        `
        }
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <div class="menu-actions">
        <button class="btn btn-secondary" id="rsvpBack">Back</button>
        <button class="btn btn-primary" id="rsvpStart">Begin planning</button>
      </div>

      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
        RsvpTrackerScreen – overview of all hosts & their replies
      </p>
    </section>
  `;

  const listEl  = root.querySelector("#rsvpList");
  const backBtn = root.querySelector("#rsvpBack");
  const startBtn = root.querySelector("#rsvpStart");

  if (listEl && totalHosts >= 2) {
    const rows = hosts.map((host, index) => {
      const info = rsvps[index] || {};
      let status = "No response yet";
      let statusClass = "rsvp-status--pending";
      if (info.status === "accepted") {
        status = "Accepted";
        statusClass = "rsvp-status--accepted";
      } else if (info.status === "declined") {
        status = "Declined";
        statusClass = "rsvp-status--declined";
      }

      const dateText = info.date ? info.date : "TBC";
      const timeText = info.time ? info.time : "";
      const themeText = info.theme ? info.theme : "";

      return `
        <li class="host-row host-row--tracker">
          <div class="host-row-label">Host ${index + 1}</div>
          <div class="host-row-main">
            <div class="host-row-name">${esc(host.name || `Host ${index + 1}`)}</div>
            <div class="host-row-meta ${statusClass}">${esc(status)}</div>
            <div class="host-row-meta">
              Date: <strong>${esc(dateText)}</strong>
              ${timeText ? ` &middot; Time: <strong>${esc(timeText)}</strong>` : ""}
              ${themeText ? `<br/>Theme: <em>${esc(themeText)}</em>` : ""}
            </div>
          </div>
        </li>
      `;
    });

    listEl.innerHTML = rows.join("");
  }

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      try {
        actions.setState && actions.setState("links");
      } catch (_) {}
    });
  }

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      // Later this will go to the actual planning / scheduling screen
      try {
        actions.setState && actions.setState("started");
      } catch (_) {}
    });
  }
}
