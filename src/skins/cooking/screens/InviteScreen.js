// path: src/skins/cooking/screens/InviteScreen.js
// Per-host invite screen – organiser inside the app, or guests via invite links.

import { readGame, updateGame } from "../../../engine/firestore.js";

const HOSTS_STORAGE_KEY  = "cq_hosts_v1";
const NIGHTS_STORAGE_KEY = "cq_host_nights_v1";

// --------------------------------------------------
// Small helpers
// --------------------------------------------------

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
    window.localStorage.setItem(NIGHTS_STORAGE_KEY, JSON.stringify(nights || {}));
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

// Save RSVP (and optional menu) into Firestore
async function saveRsvpToFirestore(
  gameId,
  hostIndex,
  status,
  date,
  time,
  theme,
  address,
  phone,
  extra = {}
) {
  if (!gameId) return;
  try {
    const nowIso = new Date().toISOString();
    const field = `rsvps.${hostIndex}`;

    const payload = {
      hostIndex,
      status:  status  || null,
      date:    date    || null,
      time:    time    || null,
      theme:   theme   || null,
      address: address || null,
      phone:   phone   || null,
      updatedAt: nowIso
    };

    if (extra.menu) {
      payload.menu = extra.menu;
    }

    await updateGame(gameId, { [field]: payload });
  } catch (err) {
    console.warn("[InviteScreen] Failed to sync RSVP to Firestore", err);
  }
}

// --------------------------------------------------
// Schedule helpers – used when game is in progress
// --------------------------------------------------

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

  out.sort((a, b) => a.startMs - b.startMs); // earliest first
  return out;
}

function pickCurrentEvent(game, nowMs) {
  const schedule = buildSchedule(game);
  if (!schedule.length) return null;

  const sixHours = 6 * 60 * 60 * 1000;
  const now = nowMs != null ? nowMs : Date.now();

  // Before first event → that first one is "upcoming"
  if (now < schedule[0].startMs) {
    const ev = schedule[0];
    return {
      currentHostIndex: ev.hostIndex,
      startMs: ev.startMs,
      endMs: ev.startMs + sixHours
    };
  }

  // Find first event whose 6h window hasn't passed yet
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

  // Everything finished
  const last = schedule[schedule.length - 1];
  return {
    currentHostIndex: last.hostIndex,
    startMs: last.startMs,
    endMs: last.startMs + sixHours,
    allFinished: true
  };
}

function formatShortDate(dateStr) {
  // Expect "YYYY-MM-DD"
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
  // Expect "HH:MM"
  if (!timeStr || typeof timeStr !== "string") return "";
  const [hStr, mStr] = timeStr.split(":");
  const h = Number(hStr);
  if (Number.isNaN(h)) return timeStr;
  return `${hStr.padStart(2, "0")}:${(mStr || "00").padStart(2, "0")}`;
}

// optional helper (handy later for results)
function ordinal(n) {
  const s = ["th","st","nd","rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getScoringModelFromGame(game) {
  const setup =
    game && game.setup && typeof game.setup === "object" ? game.setup : {};

  const scoring =
    setup.scoring && typeof setup.scoring === "object" ? setup.scoring : {};

  // Try a few likely category fields (use whichever your SetupScreen writes)
  const rawCats =
    scoring.selectedCategories ||
    scoring.scoringCategories ||
    scoring.categories ||
    setup.scoringCategories ||
    setup.voteCategories ||
    setup.categories ||
    [];

  const categories = Array.isArray(rawCats)
    ? rawCats.map((c) => (c == null ? "" : String(c).trim())).filter(Boolean)
    : [];

  // Try a few likely mode fields
  const rawMode =
    scoring.mode ||
    scoring.style ||
    setup.mode ||          // <-- add this line
    setup.scoringMode ||
    setup.scoringStyle ||
    setup.voteMode ||
    setup.scoringType ||
    "";

  const mode = String(rawMode || "").toLowerCase();

// Decide byCategory ONLY from an explicit flag/mode.
// (Do NOT infer from categories.length because Food may always exist.)
let byCategory = false;

if (typeof scoring.byCategory === "boolean") {
  byCategory = scoring.byCategory;
} else if (typeof setup.byCategory === "boolean") {
  byCategory = setup.byCategory;
} else if (mode.includes("categor")) {
  byCategory = true;
} else if (mode.includes("single") || mode.includes("overall") || mode.includes("total")) {
  byCategory = false;
} else {
  byCategory = false; // safe default
}

return {
  byCategory,
  categories: byCategory ? categories : [] // IMPORTANT: hide categories in single-score mode
};
}

function getPrepPepTalk(order, total) {
  const o = Number(order) || 1;
  const t = Number(total) || 1;

  if (o === 1) {
    return {
      heading: "You’re up first.",
      body:
        "You set the bar everyone else will be measured against — so go hard.\n" +
        "Make it memorable… but don’t overthink it.\n\n" +
        "Best cheat-code: stay relaxed. If you’re enjoying yourself, your guests will too."
    };
  }

  if (o === t) {
    return {
      heading: "Final host. Big finish.",
      body:
        "You’re closing the Quest — it’s your job to leave everyone talking.\n" +
        "A strong finale can swing the whole scoreboard.\n\n" +
        "Keep it simple, hit your timing, and focus on atmosphere."
    };
  }

  return {
    heading: `You’re the ${ordinal(o)} host of ${t}.`,
    body:
      "The table already has a benchmark — now you get to raise it.\n" +
      "A small twist (theme, presentation, or one standout dish) goes a long way.\n\n" +
      "Don’t chase perfection, your quest is to deliver a great event!"
  };
}

function getScoringConfig(setup) {
  const s = setup && typeof setup === "object" ? setup : {};

  // Try a few likely category fields (use whichever your SetupScreen writes)
  const rawCats =
    (Array.isArray(s.scoringCategories) && s.scoringCategories) ||
    (Array.isArray(s.scoreCategories) && s.scoreCategories) ||
    (Array.isArray(s.categories) && s.categories) ||
    (Array.isArray(s.voteCategories) && s.voteCategories) ||
    [];

  const categories = rawCats
    .map((c) => (c == null ? "" : String(c).trim()))
    .filter(Boolean);

  // If there are categories, assume category voting; otherwise single score.
  const mode = categories.length ? "categories" : "single";

  return { mode, categories };
}


// --------------------------------------------------
// Game in progress: pre-event view
// --------------------------------------------------

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
    gameId,
    orderInSchedule,
    totalEvents,
    scoringModel,
    hosts = [],
    nights = {}
  } = opts;

  const safeViewer = esc(viewerName || `Host ${viewerIndex + 1}`);
  const safeHost = esc(currentHostName || `Host ${currentHostIndex + 1}`);
  const safeOrganiser = esc(organiserName || "the organiser");
  const dateStr = rsvp && rsvp.date ? formatShortDate(rsvp.date) : "";
  const timeStr = rsvp && rsvp.time ? formatShortTime(rsvp.time) : "";
  const theme = rsvp && rsvp.theme ? rsvp.theme : "";
  const themeLabel = String(theme || "").trim() ? theme : "Come as you like";
  const address = rsvp && rsvp.address ? rsvp.address : "";
  const phone = rsvp && rsvp.phone ? rsvp.phone : "";
  const menu = rsvp && rsvp.menu ? rsvp.menu : {};
  const entreeName = menu.entreeName || "";
  const entreeDesc = menu.entreeDesc || "";
  const mainName = menu.mainName || "";
  const mainDesc = menu.mainDesc || "";
  const dessertName = menu.dessertName || "";
  const dessertDesc = menu.dessertDesc || "";
  const invitedNames = (Array.isArray(hosts) ? hosts : [])
  .map((h, idx) => {
    if (idx === viewerIndex) return null; // don't include the host themselves
    const name = h && h.name ? String(h.name).trim() : `Host ${idx + 1}`;
    return name || `Host ${idx + 1}`;
  })
  .filter(Boolean);

const acceptedNames = (Array.isArray(hosts) ? hosts : [])
  .map((h, idx) => {
    if (idx === viewerIndex) return null;
    const r = nights && nights[idx] ? nights[idx] : {};
    const st = String(r.status || "").toLowerCase();
    if (st !== "accepted") return null;
    const name = h && h.name ? String(h.name).trim() : `Host ${idx + 1}`;
    return name || `Host ${idx + 1}`;
  })
  .filter(Boolean);

const invitedLine = invitedNames.length ? invitedNames.map(esc).join(", ") : "No guests listed yet.";
const acceptedLine = acceptedNames.length ? acceptedNames.map(esc).join(", ") : "No-one yet.";

  function menuLinesHTML() {
    const lines = [];
    if (entreeName) {
      lines.push(
        `<strong>Entrée:</strong> ${esc(entreeName)}${
          entreeDesc ? " – " + esc(entreeDesc) : ""
        }`
      );
    }
    if (mainName) {
      lines.push(
        `<strong>Main:</strong> ${esc(mainName)}${
          mainDesc ? " – " + esc(mainDesc) : ""
        }`
      );
    }
    if (dessertName) {
      lines.push(
        `<strong>Dessert:</strong> ${esc(dessertName)}${
          dessertDesc ? " – " + esc(dessertDesc) : ""
        }`
      );
    }
    return lines.join("<br><br>");
  }

  const pep = getPrepPepTalk(orderInSchedule, totalEvents);

  const votingHTML = (() => {
  const byCat = !!(scoringModel && scoringModel.byCategory);
  const cats =
    scoringModel && Array.isArray(scoringModel.categories)
      ? scoringModel.categories
      : [];

  const commentLine =
    "Add comments if you like — they’ll be shared with everyone once the final scoreboard is revealed.";

  if (byCat) {
    const list = cats.length
      ? cats.map((c) => `• ${esc(c)}`).join("<br>")
      : "• (categories not set in setup)";

    return `
      You’ll score <strong>${safeHost}</strong> out of 10 for each category.
      Each category is out of 10 — we’ll total it for the event.
      <br><br>
      ${list}
      <br><br>
      ${commentLine}
    `;
  }

  return `
    You’ll give <strong>${safeHost}</strong> one overall score out of 10 for their event —
    think of it as an <em>overall experience</em> score.
    <br><br>
    Try to score comparatively across all events, not in isolation.
    <br><br>
    ${commentLine}
  `;
})();

  // ---------------------------
  // GUEST VIEW (not the upcoming host)
  // ---------------------------
  if (!isCurrentHost) {
    const hasTime = !!timeStr;
    const hasAddress = !!address;
    const hasPhone = !!phone;

    const detailsBlock = `
  <div
    style="
      margin-top:10px;
      text-align:left;
      padding-left:34px;
    "
  >
    <div style="margin:4px 0;"><strong>Date:</strong> ${esc(dateStr || "To be confirmed")}</div>
    ${hasTime ? `<div style="margin:4px 0;"><strong>Time:</strong> ${esc(timeStr)}</div>` : ""}
    ${
      hasAddress
        ? `<div style="margin:4px 0;"><strong>Address:</strong> ${esc(address)}</div>`
        : `<div style="margin:4px 0;"><strong>Address:</strong> Not shared yet</div>`
    }
    ${
      hasPhone
        ? `<div style="margin:4px 0;"><strong>Contact:</strong> ${esc(phone)}</div>`
        : `<div style="margin:4px 0;"><strong>Contact:</strong> Not shared yet</div>`
    }
    <div style="margin:4px 0;"><strong>Theme:</strong> ${esc(themeLabel)}</div>
  </div>
`;




    const menuBlock = menuLinesHTML()
      ? menuLinesHTML()
      : `${safeHost} hasn’t shared a menu yet. (Either they love surprises… or they’re still deciding.)`;

    root.innerHTML = `
      <section class="menu-card">
        <div class="menu-hero">
          <img class="menu-logo" src="./src/skins/cooking/assets/cq-logo.png" alt="Culinary Quest" />
        </div>

        <div class="menu-ornament" aria-hidden="true"></div>

        <section class="menu-section">
          <div class="menu-course">ENTRÉE</div>
          <h2 class="menu-h2">GET READY</h2>
          <p class="menu-copy">
            Hi <strong>${safeViewer}</strong> — the next dinner in this Quest is hosted by
            <strong>${safeHost}</strong>.
            ${detailsBlock}
            <br><br>
            If anything critical is missing, message <strong>${safeOrganiser}</strong>.
          </p>
        </section>

        <div class="menu-divider" aria-hidden="true"></div>

        <section class="menu-section">
          <div class="menu-course">MAIN</div>
          <h2 class="menu-h2">ON THE MENU</h2>
          <p class="menu-copy">
            ${menuBlock}
          </p>
        </section>

        <div class="menu-divider" aria-hidden="true"></div>

        <section class="menu-section">
          <div class="menu-course">DESSERT</div>
          <h2 class="menu-h2">HOW VOTING WORKS</h2>
          <p class="menu-copy">
            Voting will open <strong>after the dinner</strong>, once <strong>${safeOrganiser}</strong> closes <strong>${safeHost}'s</strong> event.
            <br><br>
            ${votingHTML}
          </p>
        </section>

        <div class="menu-ornament" aria-hidden="true"></div>
        <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
          Preparation view – guest
        </p>
      </section>
    `;
    return;
  }

  // ---------------------------
  // UPCOMING HOST VIEW
  // ---------------------------
  const fixedDate = rsvp && rsvp.date ? rsvp.date : null;

  const allowThemes = !!(opts && opts.setup && opts.setup.allowThemes);
const themeText = allowThemes ? (theme ? theme : "Come as you like") : "";
const showTime = !!timeStr;

// These only show after save if values exist
const showAddress = !!address;
const showPhone = !!phone;
const menuHtml = menuLinesHTML();
const showMenu = !!menuHtml;

root.innerHTML = `
  <section class="menu-card">
    <div class="menu-hero">
      <img class="menu-logo" src="./src/skins/cooking/assets/cq-logo.png" alt="Culinary Quest" />
    </div>

    <div class="menu-ornament" aria-hidden="true"></div>

    <section class="menu-section">
      <div class="menu-course">ENTRÉE</div>
      <h2 class="menu-h2">YOUR PREP SCREEN</h2>

      <p class="menu-copy">
        Okay <strong>${safeViewer}</strong> — your hosting event is next.
      </p>

      <p class="menu-copy" style="margin-top:10px;">
        <strong>This is what you’ve shared with your guests:</strong>
      </p>

      <div class="menu-copy" style="text-align:left;padding-left:56px;margin-top:6px;">
        <div style="margin:4px 0;"><strong>Date:</strong> <span id="sumDate">${esc(dateStr || "To be confirmed")}</span></div>

        <div id="sumTimeRow" style="margin:4px 0;${showTime ? "" : "display:none;"}">
          <strong>Time:</strong> <span id="sumTime">${esc(timeStr || "")}</span>
        </div>

        ${
          allowThemes
            ? `<div style="margin:4px 0;"><strong>Theme:</strong> <span id="sumTheme">${esc(themeText)}</span></div>`
            : ""
        }

        <div id="sumAddressRow" style="margin:4px 0;${showAddress ? "" : "display:none;"}">
          <strong>Address:</strong> <span id="sumAddress">${showAddress ? esc(address) : ""}</span>
        </div>

        <div id="sumPhoneRow" style="margin:4px 0;${showPhone ? "" : "display:none;"}">
          <strong>Contact:</strong> <span id="sumPhone">${showPhone ? esc(phone) : ""}</span>
        </div>

        <div id="sumMenuRow" style="margin:8px 0 0;${showMenu ? "" : "display:none;"}">
          <strong>Menu:</strong><br>
          <span id="sumMenu">${showMenu ? menuHtml : ""}</span>
        </div>
      </div>

      <div class="menu-copy" style="text-align:left;padding-left:56px;margin-top:12px;">
        <div style="margin:4px 0;"><strong>Guests invited:</strong> ${invitedLine}</div>
        <div style="margin:4px 0;"><strong>Guests who have accepted your invitation are:</strong> ${acceptedLine}</div>
      </div>

      <p class="menu-copy" style="margin-top:14px;">
        Now let’s give your guests a little more detail:
      </p>

      <div class="menu-actions" style="margin-top:10px;">
        <button class="btn btn-secondary" id="prepToggleDetails">Details</button>
      </div>

      <p class="menu-copy" style="margin-top:14px;">
        <strong>${esc(pep.heading)}</strong><br>
        ${esc(pep.body).replace(/\n/g, "<br>")}
      </p>
    </section>

    <div id="prepDetailsBlock" style="display:none;">

      <div class="menu-divider" aria-hidden="true"></div>

      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">DETAILS YOUR GUESTS WILL SEE</h2>

        <p class="menu-copy">
          Add the practical bits (address, optional contact and timing), plus what you’re serving.
        </p>

        <label class="menu-copy" for="prepTime" style="text-align:left;margin-top:10px;">
          <strong>Start time</strong> <span class="muted">(optional)</span>
        </label>
        <input
          id="prepTime"
          class="menu-input"
          type="time"
          value="${rsvp && rsvp.time ? esc(rsvp.time) : ""}"
        />

        <label class="menu-copy" for="prepAddress" style="text-align:left;margin-top:10px;">
          <strong>Address</strong> <span class="muted">(only shared with guests)</span>
        </label>
        <textarea
          id="prepAddress"
          class="menu-input"
          rows="2"
        >${address ? esc(address) : ""}</textarea>

        <label class="menu-copy" for="prepPhone" style="text-align:left;margin-top:10px;">
          <strong>Contact phone</strong> <span class="muted">(optional)</span>
        </label>
        <input
          id="prepPhone"
          class="menu-input"
          type="tel"
          value="${phone ? esc(phone) : ""}"
        />

        <div class="menu-divider" aria-hidden="true"></div>

        <h2 class="menu-h2" style="margin-top:16px;">MENU</h2>

        <label class="menu-copy" for="prepEntreeName" style="text-align:left;margin-top:8px;">
          <strong>Entrée</strong>
        </label>
        <input
          id="prepEntreeName"
          class="menu-input"
          type="text"
          maxlength="80"
          placeholder="e.g. Prawn cocktail"
          value="${entreeName ? esc(entreeName) : ""}"
        />
        <textarea
          id="prepEntreeDesc"
          class="menu-input"
          rows="2"
          placeholder="Short description of your entrée"
        >${entreeDesc ? esc(entreeDesc) : ""}</textarea>

        <label class="menu-copy" for="prepMainName" style="text-align:left;margin-top:10px;">
          <strong>Main</strong>
        </label>
        <input
          id="prepMainName"
          class="menu-input"
          type="text"
          maxlength="80"
          placeholder="e.g. Slow-cooked lamb with roast veg"
          value="${mainName ? esc(mainName) : ""}"
        />
        <textarea
          id="prepMainDesc"
          class="menu-input"
          rows="2"
          placeholder="Short description of your main"
        >${mainDesc ? esc(mainDesc) : ""}</textarea>

        <label class="menu-copy" for="prepDessertName" style="text-align:left;margin-top:10px;">
          <strong>Dessert</strong>
        </label>
        <input
          id="prepDessertName"
          class="menu-input"
          type="text"
          maxlength="80"
          placeholder="e.g. Chocolate fondant"
          value="${dessertName ? esc(dessertName) : ""}"
        />
        <textarea
          id="prepDessertDesc"
          class="menu-input"
          rows="2"
          placeholder="Short description of your dessert"
        >${dessertDesc ? esc(dessertDesc) : ""}</textarea>

        <div class="menu-actions" style="margin-top:16px;">
          <button class="btn btn-primary" id="prepSave">
            Save details
          </button>
        </div>

        <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
          Tip: save as soon as you know the address — you can update the menu later.
        </p>
            </section>

    </div>

    <div class="menu-ornament" aria-hidden="true"></div>
    <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
      Preparation view – upcoming host
    </p>
  </section>
`;


  const timeEl = root.querySelector("#prepTime");
  const addrEl = root.querySelector("#prepAddress");
  const phoneEl = root.querySelector("#prepPhone");
  const entreeNameEl = root.querySelector("#prepEntreeName");
  const entreeDescEl = root.querySelector("#prepEntreeDesc");
  const mainNameEl = root.querySelector("#prepMainName");
  const mainDescEl = root.querySelector("#prepMainDesc");
  const dessertNameEl = root.querySelector("#prepDessertName");
  const dessertDescEl = root.querySelector("#prepDessertDesc");
  const saveBtn = root.querySelector("#prepSave");
  const toggleBtn = root.querySelector("#prepToggleDetails");
  const detailsBlock = root.querySelector("#prepDetailsBlock");

function setDetailsOpen(open) {
  if (!detailsBlock || !toggleBtn) return;
  detailsBlock.style.display = open ? "block" : "none";
  toggleBtn.textContent = open ? "Hide" : "Details";
}

if (toggleBtn && detailsBlock) {
  toggleBtn.addEventListener("click", () => {
    const isOpen = detailsBlock.style.display === "block";
    setDetailsOpen(!isOpen);
  });
}


  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      if (!fixedDate) {
        window.alert("Your hosting date isn’t set yet. Please contact the organiser.");
        return;
      }

      const newTime = timeEl && timeEl.value ? timeEl.value.trim() : (rsvp.time || null);
      const newAddr = addrEl && addrEl.value ? addrEl.value.trim() : null;
      const newPhone = phoneEl && phoneEl.value ? phoneEl.value.trim() : null;

      const menuObj = {
        entreeName: entreeNameEl && entreeNameEl.value ? entreeNameEl.value.trim() : "",
        entreeDesc: entreeDescEl && entreeDescEl.value ? entreeDescEl.value.trim() : "",
        mainName: mainNameEl && mainNameEl.value ? mainNameEl.value.trim() : "",
        mainDesc: mainDescEl && mainDescEl.value ? mainDescEl.value.trim() : "",
        dessertName: dessertNameEl && dessertNameEl.value ? dessertNameEl.value.trim() : "",
        dessertDesc: dessertDescEl && dessertDescEl.value ? dessertDescEl.value.trim() : ""
      };

      await saveRsvpToFirestore(
        gameId,
        currentHostIndex,
        rsvp.status || "accepted",
        fixedDate,
        newTime,
        rsvp.theme || null,
        newAddr,
        newPhone,
        { menu: menuObj }
      );

      // Update the summary UI
const sumTimeRow = root.querySelector("#sumTimeRow");
const sumTime = root.querySelector("#sumTime");
const sumAddressRow = root.querySelector("#sumAddressRow");
const sumAddress = root.querySelector("#sumAddress");
const sumPhoneRow = root.querySelector("#sumPhoneRow");
const sumPhone = root.querySelector("#sumPhone");
const sumMenuRow = root.querySelector("#sumMenuRow");
const sumMenu = root.querySelector("#sumMenu");

if (newTime) {
  if (sumTime) sumTime.textContent = newTime;
  if (sumTimeRow) sumTimeRow.style.display = "block";
}

if (newAddr) {
  if (sumAddress) sumAddress.textContent = newAddr;
  if (sumAddressRow) sumAddressRow.style.display = "block";
}

if (newPhone) {
  if (sumPhone) sumPhone.textContent = newPhone;
  if (sumPhoneRow) sumPhoneRow.style.display = "block";
}

const newMenuHtml = (() => {
  const lines = [];
  if (menuObj.entreeName) lines.push(`<strong>Entrée:</strong> ${esc(menuObj.entreeName)}`);
  if (menuObj.mainName) lines.push(`<strong>Main:</strong> ${esc(menuObj.mainName)}`);
  if (menuObj.dessertName) lines.push(`<strong>Dessert:</strong> ${esc(menuObj.dessertName)}`);
  return lines.join("<br>");
})();

if (newMenuHtml) {
  if (sumMenu) sumMenu.innerHTML = newMenuHtml;
  if (sumMenuRow) sumMenuRow.style.display = "block";
}

// Collapse form
setDetailsOpen(false);


      window.alert("Saved. Your guests will see the updated details when they open their link.");
    });
  }
}

// --------------------------------------------------
// Game in progress: post-event view
// --------------------------------------------------

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
            but this is where you'll rate their event out of 10
            (or by category, if your organiser chose that option).
          </p>
        </section>
      </section>
    `;
  }
}

// --------------------------------------------------
// Standard invite / RSVP UI (before game starts)
// --------------------------------------------------

function renderInviteUI(root, options) {
  const {
    isOrganiser,
    hostIndex,
    hostName,
    organiserName,
    allowThemes,
    nights,
    gameId,
    actions,
    hasGameId = false
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

const organiserCtaText = hasGameId
  ? "Save & view RSVPs"
  : "Save & add competitors";

const organiserNextHint = hasGameId
  ? "Choose the date for your hosting event, then continue to the RSVP tracker."
  : "Choose the date for your hosting event, then add your competitors.";

  let entreeTitle;
  let entreeBodyHTML;

  if (isOrganiser) {
    entreeTitle = "YOUR EVENT";
    if (allowThemes) {
      entreeBodyHTML = `
        Okay <strong>${safeOrganiser}</strong>, here's where you choose which date you want to host on,
        set a start time and let everyone know what kind of themed event you're planning.
      `;
    } else {
      entreeBodyHTML = `
        Okay <strong>${safeOrganiser}</strong>, here's where you choose which date you want to host on
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
          ${esc(organiserCtaText)}
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
        <h2 class="menu-h2">YOUR EVENT</h2>
        <p class="menu-copy">
          ${isOrganiser ? organiserNextHint : "Choose the date for your hosting event, then continue below."}
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
          <strong>Theme for your event</strong> <span class="muted">(optional)</span>
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
        Thanks, <strong>${safeHost}</strong> — we've saved your hosting event and
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
        your event to the line-up. You can close this tab now.
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
          "Please choose a different date so that no two meals are on the same day."
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
          "That date is already taken by another host. Please choose a different date so that no two dinners are on the same day."
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
      // If there's no game yet, we're still in the pre-setup flow:
      // go on to add hosts. Otherwise, behave as before.
      const nextState = hasGameId ? "rsvpTracker" : "hosts";
      try {
        actions && actions.setState && actions.setState(nextState);
      } catch (_) {}
    } else {
      renderDone(status);
    }
  }

  if (saveBtn)   saveBtn.addEventListener("click", () => { handleAccept("accepted"); });
  if (acceptBtn) acceptBtn.addEventListener("click", () => { handleAccept("accepted"); });
  if (declineBtn) declineBtn.addEventListener("click", () => { handleAccept("declined"); });
}

// --------------------------------------------------
// Main exported render
// --------------------------------------------------

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

  const organiserName =
    (model.organiserName && String(model.organiserName)) ||
    (hosts[0] && hosts[0].name) ||
    "the organiser";

  // Use organiserName as the “host” label on this screen
  const hostName = organiserName;

    const allowThemes =
      model &&
      model.setup &&
      typeof model.setup.allowThemes === "boolean"
        ? model.setup.allowThemes
        : false;

      let gameId =
        (model && typeof model.gameId === "string" && model.gameId.trim()) || null;

      // If we are setting up a NEW game (we have setup, but no gameId yet),
      // do NOT reuse an old gameId from localStorage.
      const inNewGameWizard = !!(model && model.setup && !gameId);

      if (!gameId && !inNewGameWizard) {
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
      actions,
      hasGameId: !!gameId
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

// Normalise the invite token from the URL
const inviteRaw = inviteToken || "";
const needle = inviteRaw.trim().toUpperCase();

// First, try the new-style token arrays on the game doc
let hostIndex = -1;
let tokens = [];

if (Array.isArray(game.hostTokens)) {
  tokens = game.hostTokens;
} else if (Array.isArray(game.tokens)) {
  // backwards-compat / older docs
  tokens = game.tokens;
}

if (tokens && tokens.length) {
  const normalisedTokens = tokens.map((t) =>
    t == null ? null : String(t).trim().toUpperCase()
  );
  hostIndex = normalisedTokens.findIndex((t) => t === needle);
}

// Fallback for docs where the token is stamped onto the host object
if (hostIndex < 0 && hosts.length) {
  hostIndex = hosts.findIndex((h) => {
    if (!h || typeof h.token !== "string") return false;
    return h.token.trim().toUpperCase() === needle;
  });
}
      if (hostIndex < 0) {
        console.warn(
          "[InviteScreen] Token not found for game",
          urlGameId,
          "token:",
          inviteToken
        );
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

      // Build nights map from Firestore RSVPs (includes menu)
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
            phone:   r.phone   || null,
            menu:    r.menu    || null
          };
        });
      }

      // Merge local nights for this browser for this hostIndex (so they can revise
      // before things are written to Firestore)
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
          phone:   existing.phone   || null,
          menu:    existing.menu    || null
        };
      }

      const gameId = urlGameId;            // Firestore doc ID
      const gameStatus = game.status || "links";
      
      // availability phase redirect
      if (
        gameStatus === "availability" &&
        actions &&
        typeof actions.setState === "function"
      ) {
        actions.setState("availability");
        return;
      }

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
          actions: {},
          hasGameId: true
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
      const schedule = buildSchedule(game);
      const orderInSchedule = Math.max(
        1,
        schedule.findIndex((ev) => ev.hostIndex === currentHostIndex) + 1
      );
      const totalEvents = schedule.length || (Array.isArray(hosts) ? hosts.length : 0);
      const scoringModel = getScoringModelFromGame(game);
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
          actions: {},
          hasGameId: true
        });
        return;
      }

      if (nowMs <= endMs) {
        // Before or during the event → pre-event view
        renderInProgressPreEvent(root, {
          isCurrentHost,
          viewerIndex: hostIndex,
          viewerName: hostName,
          currentHostIndex,
          currentHostName,
          organiserName,
          rsvp,
          gameId,
          orderInSchedule,
          totalEvents,
          scoringModel,
          setup: game.setup,
          hosts,
          nights
        });
      } else {
        // After the 6-hour window → post-event view
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
