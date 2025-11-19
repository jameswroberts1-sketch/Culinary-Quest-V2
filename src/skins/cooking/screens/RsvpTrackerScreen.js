// path: src/skins/cooking/screens/RsvpTrackerScreen.js
// RSVP Tracker – organiser-only view of all hosts' responses.
//
// Shown after the organiser completes their own invite step
// (InviteScreen calls actions.setState("rsvpTracker")).

const RSVP_STORAGE_KEY = "cq_rsvps_v1";

function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Pull RSVP map from model or localStorage as a fallback
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

  if (!hosts.length) {
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
          <h2 class="menu-h2">Nothing to track yet</h2>
          <p class="menu-copy">
            There are no hosts defined for this game yet. Go back and add your host line-up first.
          </p>
        </section>

        <div class="menu-actions">
          <button class="btn btn-secondary" id="trackerBackEmpty">Back to hosts</button>
        </div>
      </section>
    `;

    // Scroll top
    try {
      const scroller =
        document.scrollingElement ||
        document.documentElement ||
        document.body;
      requestAnimationFrame(() => {
        scroller.scrollTo({ top: 0, left: 0, behavior: "auto" });
      });
    } catch (_) {}

    const backEmpty = root.querySelector("#trackerBackEmpty");
    if (backEmpty) {
      backEmpty.addEventListener("click", () => {
        try {
          actions.setState && actions.setState("hosts");
        } catch (_) {}
      });
    }

    return () => {};
  }

  const organiserName =
    (hosts[0] && typeof hosts[0].name === "string" && hosts[0].name.trim()) ||
    model.organiserName ||
    model.hostName ||
    "the organiser";

  const rsvps = hydrateRsvps(model);

  // Compute summary stats
  const totalHosts = hosts.length;
  let accepted = 0;
  let declined = 0;
  let pending = 0;

  const rows = hosts.map((host, index) => {
    const hName =
      (host && typeof host.name === "string" && host.name.trim()) ||
      `Host ${index + 1}`;

    const r = rsvps[index] || {};
    const status = r.status || "pending";

    if (status === "accepted") accepted++;
    else if (status === "declined") declined++;
    else pending++;

    const date = r.date || "";
    const time = r.time || "";
    const theme = r.theme || "";

    let statusLabel = "Pending";
    let statusEmoji = "⏳";
    if (status === "accepted") {
      statusLabel = "Accepted";
      statusEmoji = "✅";
    } else if (status === "declined") {
      statusLabel = "Declined";
      statusEmoji = "❌";
    }

    const bits = [];
    if (date) bits.push(date);
    if (time) bits.push(time);
    if (theme) bits.push(`Theme: ${theme}`);

    const details = bits.join(" · ");

    return {
      index,
      name: hName,
      status,
      statusEmoji,
      statusLabel,
      details
    };
  });

  const allResponded = pending === 0;
  const canStart = allResponded && accepted >= 2;

  const summaryLine = `
    Accepted: ${accepted} &nbsp;·&nbsp;
    Declined: ${declined} &nbsp;·&nbsp;
    Pending: ${pending}
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
        <h2 class="menu-h2">RSVP TRACKER</h2>
        <p class="menu-copy">
          Here's how your host line-up is looking so far. Once everyone has replied
          and at least two hosts have accepted, you can launch your Quest.
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- MAIN: list of hosts & statuses -->
      <section class="menu-section" style="text-align:left;">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">HOST RESPONSES</h2>

        <ul class="list" id="rsvpList">
          ${rows
            .map((row, i) => {
              const label =
                i === 0
                  ? `Host 1 – ${esc(row.name)} (organiser)`
                  : `Host ${i + 1} – ${esc(row.name)}`;

              return `
                <li>
                  <div><strong>${label}</strong></div>
                  <div class="muted">
                    ${row.statusEmoji} ${row.statusLabel}${
                      row.details
                        ? ` &nbsp;·&nbsp; ${esc(row.details)}`
                        : ""
                    }
                  </div>
                </li>
              `;
            })
            .join("")}
        </ul>

        <p class="menu-copy" style="margin-top:10px;">
          <span class="muted">${summaryLine}</span>
        </p>

        <p class="menu-copy" style="font-size:13px;margin-top:4px;">
          ${
            canStart
              ? "You're ready to begin – hit <strong>Let the Games Begin</strong> when you're happy with the schedule."
              : "You’ll be able to start once everyone has replied and at least two hosts have accepted."
          }
        </p>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <div class="menu-actions" style="flex-wrap:wrap;gap:8px 10px;">
        <button class="btn btn-secondary" id="trackerBack">
          Review links
        </button>
        <button class="btn btn-secondary" id="trackerCancel">
          Cancel game
        </button>
        <button
          class="btn btn-primary"
          id="trackerStart"
          ${canStart ? "" : 'disabled style="opacity:0.6;"'}
        >
          Let the Games Begin
        </button>
      </div>

      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
        RSVP Tracker – ${esc(organiserName)} · ${accepted} accepted / ${totalHosts} total
      </p>
    </section>
  `;

  // Scroll to top (and unzoom) on entry
  try {
    const scroller =
      document.scrollingElement ||
      document.documentElement ||
      document.body;
    requestAnimationFrame(() => {
      scroller.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  } catch (_) {}

  // --- event wiring --------------------------------------------------

  const startBtn = root.querySelector("#trackerStart");
  const backBtn = root.querySelector("#trackerBack");
  const cancelBtn = root.querySelector("#trackerCancel");
  const backEmptyBtn = root.querySelector("#trackerBackEmpty");

  const handleClick = (ev) => {
    const t = ev.target;
    if (!t) return;

    if (t.id === "trackerBack" || t.id === "trackerBackEmpty") {
      try {
        actions.setState && actions.setState("links");
      } catch (_) {}
      return;
    }

    if (t.id === "trackerCancel") {
      // Simple behaviour for now: mark cancelled (if possible) and return to intro.
      try {
        if (actions && typeof actions.patch === "function") {
          actions.patch({ cancelled: true });
        }
      } catch (_) {}
      try {
        actions.setState && actions.setState("intro");
      } catch (_) {}
      return;
    }

    if (t.id === "trackerStart") {
      if (!canStart) {
        // Belt-and-braces guard; button should be disabled already.
        return;
      }
      try {
        if (actions && typeof actions.patch === "function") {
          actions.patch({ startedAt: Date.now() });
        }
      } catch (_) {}
      try {
        actions.setState && actions.setState("started");
      } catch (_) {}
      return;
    }
  };

  root.addEventListener("click", handleClick);

  return () => {
    root.removeEventListener("click", handleClick);
  };
}
