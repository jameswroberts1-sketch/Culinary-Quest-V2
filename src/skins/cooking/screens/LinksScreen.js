// path: src/skins/cooking/screens/LinksScreen.js
// Links screen – per-host invite links with opaque tokens, and game creation in Firebase RTDB

import { getUid, write, readOnce } from "../../../engine/firebase.js";

const HOSTS_STORAGE_KEY   = "cq_hosts_v1";   // same as HostsScreen
const TOKENS_STORAGE_KEY  = "cq_host_tokens_v1";
const GAME_META_KEY       = "cq_current_game_v1";
const MAX_HOSTS           = 6;

// --- helpers --------------------------------------------------

// Basic HTML escaping
function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Very lightweight slug for game titles
function slugFromTitle(title) {
  if (!title) return "";
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40); // keep it tidy
}

// Small random id for gameId suffix
function makeId(len = 6) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

// Hydrate hosts array the same way as HostsScreen
function hydrateHosts(model = {}) {
  let hosts = [];

  if (Array.isArray(model.hosts) && model.hosts.length) {
    hosts = model.hosts.map((h) => ({
      name: h && typeof h.name === "string" ? h.name : ""
    }));
  } else {
    const organiserName =
      model.organiserName ||
      model.hostName ||
      model.name ||
      model.organiser ||
      "";

    if (organiserName) {
      hosts = [{ name: organiserName }];
    }
  }

  if (hosts.length === 0) {
    hosts = [{ name: "" }];
  }

  if (hosts.length > MAX_HOSTS) {
    hosts = hosts.slice(0, MAX_HOSTS);
  }

  // Merge in any cached host names from localStorage (non-destructive)
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

// Random opaque token – prefer crypto, fall back to Math.random
function makeToken(length = 16) {
  const alphabet =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const n = alphabet.length;

  // crypto if available
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let out = "";
    for (let i = 0; i < length; i++) {
      out += alphabet[bytes[i] % n];
    }
    return out;
  }

  // fallback
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * n)];
  }
  return out;
}

// Build token array: from model, then localStorage, then fill gaps
function hydrateTokens(model = {}, hostCount) {
  let tokens = [];

  // 1) From shared model.hostTokens
  if (Array.isArray(model.hostTokens)) {
    tokens = model.hostTokens.slice();
  } else if (model.hostTokens && typeof model.hostTokens === "object") {
    // support object keyed by index as well
    tokens = [];
    Object.keys(model.hostTokens).forEach((k) => {
      const idx = Number(k);
      if (!Number.isNaN(idx)) {
        tokens[idx] = String(model.hostTokens[k] || "");
      }
    });
  }

  // 2) Merge in localStorage tokens (non-destructive)
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

  // 3) Ensure we have one opaque token per host
  const used = new Set(tokens.filter((t) => typeof t === "string" && t));

  for (let i = 0; i < hostCount; i++) {
    if (typeof tokens[i] === "string" && tokens[i].length > 0) continue;
    let t;
    do {
      t = makeToken(18); // a bit longer for safety
    } while (used.has(t));
    tokens[i] = t;
    used.add(t);
  }

  return tokens;
}

// Persist tokens locally + into the shared model
function persistTokens(tokens, actions) {
  try {
    window.localStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(tokens));
  } catch (_) {}

  try {
    if (actions && typeof actions.updateHostTokens === "function") {
      actions.updateHostTokens(tokens);
    } else if (actions && typeof actions.setHostTokens === "function") {
      actions.setHostTokens(tokens);
    } else if (actions && typeof actions.patch === "function") {
      actions.patch({ hostTokens: tokens });
    }
  } catch (_) {
    // non-fatal
  }
}

// --- gameId + RTDB game creation ------------------------------

async function getOrCreateGameId(model, setup, hosts) {
  // 1) Check model
  if (model && typeof model.gameId === "string" && model.gameId.trim()) {
    return model.gameId.trim();
  }

  // 2) Check localStorage
  try {
    const raw = window.localStorage.getItem(GAME_META_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.gameId === "string" && parsed.gameId.trim()) {
        const existingId = parsed.gameId.trim();
        if (model) model.gameId = existingId;
        return existingId;
      }
    }
  } catch (_) {}

  // 3) Generate a new id
  const titleSlug = slugFromTitle(
    setup && typeof setup.gameTitle === "string" ? setup.gameTitle : ""
  );

  const base =
    titleSlug ||
    (hosts && hosts[0] && hosts[0].name
      ? slugFromTitle(hosts[0].name + "-quest")
      : "culinary-quest");

  const gameId = `${base}-${makeId(5)}`;

  // Cache it locally and in the model
  try {
    window.localStorage.setItem(
      GAME_META_KEY,
      JSON.stringify({ gameId })
    );
  } catch (_) {}

  if (model) model.gameId = gameId;

  return gameId;
}

async function ensureGameExists(model, setup, hosts, tokens) {
  try {
    const gameId = await getOrCreateGameId(model, setup, hosts);
    const path   = `games/${gameId}`;

    // If it already exists, don't overwrite
    const existing = await readOnce(path);
    if (existing) {
      return gameId;
    }

    const organiserName =
      (model.organiserName && String(model.organiserName).trim()) ||
      (hosts[0] && hosts[0].name) ||
      "Organiser";

    const uid = await getUid();
    const now = Date.now();

    const payload = {
      meta: {
        gameId,
        title:
          (setup && typeof setup.gameTitle === "string" && setup.gameTitle.trim()) ||
          `${organiserName}'s Culinary Quest`,
        organiserName,
        organiserUid: uid || null,
        createdAt: now,
        status: "setup" // we'll bump this as they progress
      },
      setup: {
        mode: setup && setup.mode === "category" ? "category" : "simple",
        categories: Array.isArray(setup && setup.categories)
          ? setup.categories
          : ["Food"],
        customCategories: Array.isArray(setup && setup.customCategories)
          ? setup.customCategories
          : [],
        allowThemes: !!(setup && setup.allowThemes),
        comments: {
          mode:
            setup && setup.mode === "category"
              ? "perCategory"
              : "overall",
          maxChars: 200
        }
      },
      hosts: hosts.map((h, idx) => ({
        name: h && h.name ? h.name : `Host ${idx + 1}`,
        index: idx
      })),
      tokens,
      // these parts will be filled in later
      rsvps: {},      // hostIndex -> { status, date, time, theme }
      schedule: {},   // normalised schedule if you need one
      scores: {}      // scoring data will live here later
    };

    await write(path, payload);
    return gameId;
  } catch (err) {
    console.error("[LinksScreen] ensureGameExists failed", err);
    return null;
  }
}

// Build the invite URL for a given token
function buildInviteUrl(token) {
  const loc = window.location;
  const base = `${loc.origin}${loc.pathname}`; // ignore any existing ?...

  const params = new URLSearchParams();
  params.set("state", "invite");  // <- tell the app which screen to open
  params.set("invite", token);    // <- the opaque token for that host

  return `${base}?${params.toString()}`;
}

// --- main render --------------------------------------------------

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

  const setup  = model && typeof model.setup === "object" ? model.setup : {};
  const hosts  = hydrateHosts(model);
  const tokens = hydrateTokens(model, hosts.length);

  // Push tokens into model / localStorage right away so they’re stable
  persistTokens(tokens, actions);

  // Fire-and-forget: create the game in RTDB if it doesn't exist yet
  (async () => {
    await ensureGameExists(model, setup, hosts, tokens);
  })();

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
        <h2 class="menu-h2">SHARE YOUR INVITES</h2>
        <p class="menu-copy">
          Each host gets a private link to choose their date, RSVP and (optionally) set a theme.
          Tap <strong>Copy</strong> to share each link via your favourite messaging app.
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- MAIN -->
      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">HOST LINKS</h2>
        <p class="menu-copy">
          These links are unique and hard to guess. Please keep them private to each host.
        </p>

        <ul class="hosts-list" id="linksList"></ul>

        <p class="menu-copy hosts-summary">
          Links generated for <strong>${hosts.length}</strong> host${hosts.length === 1 ? "" : "s"}.
        </p>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <div class="menu-actions">
        <button class="btn btn-secondary" id="linksBack">Back</button>
        <button class="btn btn-primary" id="linksNext">Continue</button>
      </div>

      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
        LinksScreen – per-host opaque invite links
      </p>
    </section>
  `;

  const listEl   = root.querySelector("#linksList");
  const backBtn  = root.querySelector("#linksBack");
  const nextBtn  = root.querySelector("#linksNext");

  if (!listEl) return;

  // Render one row per host (organiser + all other hosts)
  const rows = hosts.map((host, index) => {
    const name   = (host && host.name && host.name.trim()) || `Host ${index + 1}`;
    const label  = index === 0 ? "Organiser link (you)" : "Host link";
    const safe   = esc(name);

    return `
      <li class="host-row host-row--links">
        <div class="host-row-label">Host ${index + 1}</div>
        <div class="host-row-main">
          <div class="host-row-name">${safe}</div>
          <div class="host-row-meta">${label}</div>
        </div>
        <button
          type="button"
          class="btn btn-secondary host-link-copy"
          data-host-index="${index}"
        >
          Copy ${safe}'s link
        </button>
      </li>
    `;
  });

  listEl.innerHTML = rows.join("");

  // Copy handling – one event handler for all buttons
  listEl.addEventListener("click", async (ev) => {
    const btn = ev.target.closest(".host-link-copy");
    if (!btn) return;

    const idx = Number(btn.dataset.hostIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= tokens.length) return;

    const token = tokens[idx];
    if (!token) return;

    const url = buildInviteUrl(token);
    const originalText = btn.textContent;

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback – prompt with the link so it can be copied manually
        window.prompt("Copy this invite link", url);
      }

      btn.textContent = "Copied!";
      btn.disabled = true;
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 1500);
    } catch (err) {
      // As a last resort, show the link in a prompt
      window.prompt("Copy this invite link", url);
    }
  });

  // Navigation – same pattern as other screens
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      try {
        actions.setState && actions.setState("hosts");
      } catch (_) {}
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      // Organiser is acting as Host #1 inside the app
      if (model) {
        model.activeHostIndex = 0;
      }
      try {
        actions.setState && actions.setState("invite");
      } catch (_) {}
    });
  }
}
