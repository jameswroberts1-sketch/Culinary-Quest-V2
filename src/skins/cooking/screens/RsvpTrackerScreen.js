// path: src/skins/cooking/screens/RsvpTrackerScreen.js
// RSVP tracker – shows each host and their accept / decline + date/time/theme

const RSVP_STORAGE_KEY = "cq_rsvps_v1";

function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

export function render(root, model = {}, actions = {}) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  const hosts = Array.isArray(model.hosts) ? model.hosts : [];
  const rsvps = hydrateRsvps(model);

  const organiserName =
    (hosts[0] &&
      typeof hosts[0].name === "string" &&
      hosts[0].name.trim()) ||
    model.organiserName ||
    "the organiser";

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
      <section class="menu-section" style="text-align:left;">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">HOST LINE-UP</h2>
        <p class="menu-copy">
          ${
            hosts.length <= 1
              ? `So far only <strong>${esc(
                  organiserName
                )}</strong> is listed as a host.
                 Go back and add at least one more host to get the full RSVP picture.`
              : `Each host gets their own invite link. As they accept or decline, their status will update here.`
          }
        </p>

        <ul class="rsvp-list">
          ${hosts
            .map((host, index) => {
              const name =
                (host && typeof host.name === "string" && host.name.trim()) ||
                `Host ${index + 1}`;

              const r = rsvps[index] || {};
              const status = r.status || "pending";
              const statusLabel =
                status === "accepted"
                  ? "Accepted"
                  : status === "declined"
                  ? "Declined"
                  : "Awaiting reply";

              const statusClass =
                status === "accepted"
                  ? "rsvp-pill rsvp-pill--ok"
                  : status === "declined"
                  ? "rsvp-pill rsvp-pill--no"
                  : "rsvp-pill rsvp-pill--pending";

              const dateBits = [];
              if (r.date) dateBits.push(r.date);
              if (r.time) dateBits.push(r.time);
              const dt = dateBits.join(" · ");

              const themeTxt =
                r.theme && r.theme.trim()
                  ? `Theme: ${esc(r.theme.trim())}`
                  : "";

              const metaLines = [];
              if (dt) metaLines.push(dt);
              if (themeTxt) metaLines.push(themeTxt);

              const meta = metaLines.join(" • ");

              return `
                <li class="rsvp-row">
                  <div class="rsvp-row-main">
                    <div class="rsvp-row-name">
                      ${index === 0 ? `${esc(name)} <span class="rsvp-organiser-tag">(Organiser)</span>` : esc(name)}
                    </div>
                    <div class="rsvp-row-meta">
                      ${meta || "&nbsp;"}
                    </div>
                  </div>
                  <div class="${statusClass}">
                    ${statusLabel}
                  </div>
                </li>
              `;
            })
            .join("")}
        </ul>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <div class="menu-actions">
        <button class="btn btn-secondary" id="rsvpBack">Back</button>
        <button class="btn btn-primary" id="rsvpStart">Begin planning</button>
      </div>

      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
        RsvpTrackerScreen – overview of all hosts &amp; their replies
      </p>
    </section>
  `;

  // Scroll to top / avoid strange zoom
  try {
    const scroller =
      document.scrollingElement ||
      document.documentElement ||
      document.body;
    requestAnimationFrame(() => {
      scroller.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  } catch (_) {}

  const backBtn = root.querySelector("#rsvpBack");
  const startBtn = root.querySelector("#rsvpStart");

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      try {
        actions.setState && actions.setState("links");
      } catch (_) {}
    });
  }

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      // For now, just jump into the generic "started" state stub
      try {
        actions.setState && actions.setState("started");
      } catch (_) {}
    });
  }
}
