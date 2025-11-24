// path: src/skins/cooking/screens/LinksScreen.js
// Links screen – per-host invite links with opaque tokens, backed by Firestore

import { createGame, getUid } from "../../../engine/firestore.js";

const HOSTS_STORAGE_KEY  = "cq_hosts_v1";           // same as HostsScreen
const TOKENS_STORAGE_KEY = "cq_host_tokens_v1";
const CURRENT_GAME_KEY   = "cq_current_game_id_v1";
const MAX_HOSTS          = 6;

/* ---------------- basic helpers ---------------- */

function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Human-ish game id: a few initials + random suffix, e.g. "SUF-3F9X"
function makeGameId(gameTitle, organiserName) {
  const source =
    (gameTitle && gameTitle.trim()) ||
    (organiserName && organiserName.trim()) ||
    "Culinary Quest";

  const initials = source
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w[0])
    .join("");

  const prefix = initials || "CQ";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${suffix}`;
}

/* ---------------- hosts + tokens ---------------- */

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

  // Merge cached host names from localStorage
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
function makeToken(length = 18) {
  const alphabet =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const n = alphabet.length;

  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let out = "";
    for (let i = 0; i < length; i++) {
      out += alphabet[bytes[i] % n];
    }
    return out;
  }

  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * n)];
  }
  return out;
}

function hydrateTokens(model = {}, hostCount) {
  let tokens = [];

  // 1) From shared model.hostTokens
  if (Array.isArray(model.hostTokens)) {
    tokens = model.hostTokens.slice();
  } else if (model.hostTokens && typeof model.hostTokens === "object") {
    tokens = [];
    Object.keys(model.hostTokens).forEach((k) => {
      const idx = Number(k);
      if (!Number.isNaN(idx)) {
        tokens[idx] = String(model.hostTokens[k] || "");
      }
    });
  }

  // 2) Merge localStorage tokens (non-destructive)
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

  // 3) Ensure one opaque token per host
  const used = new Set(tokens.filter((t) => typeof t === "string" && t));

  for (let i = 0; i < hostCount; i++) {
    if (typeof tokens[i] === "string" && tokens[i].length > 0) continue;
    let t;
    do {
      t = makeToken(18);
    } while (used.has(t));
    tokens[i] = t;
    used.add(t);
  }

  return tokens;
}

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
  } catch (_) {}
}

/* ---------------- Firestore game creation ---------------- */

async function ensureFirestoreGame(model, setup, hosts, tokens) {
  try {
    // Make sure we're signed-in anonymously
    const uid = await getUid();

    // Try reuse existing gameId
    let gameId =
      (model && typeof model.gameId === "string" && model.gameId.trim()) ||
      (() => {
        try {
          const stored = window.localStorage.getItem(CURRENT_GAME_KEY);
          return stored && stored.trim() ? stored.trim() : null;
        } catch (_) {
          return null;
        }
      })();

    const organiserName =
      (model.organiserName && String(model.organiserName).trim()) ||
      (hosts[0] && hosts[0].name) ||
      "the organiser";

    const gameTitle =
      (setup &&
        typeof setup.gameTitle === "string" &&
        setup.gameTitle.trim()) ||
      `${organiserName}'s Culinary Quest`;

    if (!gameId) {
      gameId = makeGameId(gameTitle, organiserName);
    }

    const hostDocs = hosts.map((h, index) => ({
      index,
      name: h && h.name ? h.name : `Host ${index + 1}`,
      role: index === 0 ? "organiser" : "host",
      token: tokens[index] || null
    }));

    const nowIso = new Date().toISOString();

    await createGame(gameId, {
      gameId,
      organiserUid: uid || null,
      organiserName,
      gameTitle,
      createdAt: nowIso,
      status: "links", // organiser is on the invite-links step
      setup: {
        scoringMode:
          setup && (setup.mode === "category" ? "category" : "simple"),
        allowThemes: !!(setup && setup.allowThemes),
        categories: Array.isArray(setup && setup.categories)
          ? setup.categories
          : ["Food"],
        customCategories: Array.isArray(setup && setup.customCategories)
          ? setup.customCategories
          : [],
        comments: {
          mode:
            setup && setup.mode === "category"
              ? "perCategory"
              : "overall",
          maxChars: 200
        }
      },
      hosts: hostDocs
    });

    try {
      window.localStorage.setItem(CURRENT_GAME_KEY, gameId);
    } catch (_) {}

    if (model) model.gameId = gameId;
    return gameId;
  } catch (err) {
    console.error("[LinksScreen] ensureFirestoreGame failed", err);
    throw err;
  }
}

// Build the invite URL for a given game + token
function buildInviteUrl(token, gameId) {
  const loc = window.location;
  const base = `${loc.origin}${loc.pathname}`;

  const params = new URLSearchParams();
  params.set("state", "invite");
  params.set("invite", token);

  // Include the Firestore gameId so InviteScreen can load names + settings
  if (gameId && typeof gameId === "string" && gameId.trim()) {
    params.set("game", gameId.trim());
  }

  return `${base}?${params.toString()}`;
}

/* ---------------- main render ---------------- */

export function render(root, model = {}, actions = {}) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  // Always start at the top
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

  // Keep tokens stable locally + in model
  persistTokens(tokens, actions);

  // ---- HTML skeleton ------------------------------------------------

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

      <!-- tiny Firestore debug line -->
      <p id="fsStatus"
         class="muted"
         style="text-align:center;margin-top:4px;font-size:10px;">
      </p>

      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
        LinksScreen – per-host opaque invite links
      </p>
    </section>
  `;

  const listEl   = root.querySelector("#linksList");
  const backBtn  = root.querySelector("#linksBack");
  const nextBtn  = root.querySelector("#linksNext");
  const statusEl = root.querySelector("#fsStatus");

  if (!listEl) return;

  // --- Firestore game creation & status line --------------------

  let currentGameId =
    (model && typeof model.gameId === "string" && model.gameId.trim()) ||
    null;

  if (!currentGameId) {
    try {
      const stored = window.localStorage.getItem(CURRENT_GAME_KEY);
      if (stored && stored.trim()) {
        currentGameId = stored.trim();
        if (statusEl) {
          statusEl.textContent = `Cloud game ready: ${currentGameId}`;
        }
      }
    } catch (_) {}
  }

  if (statusEl && !currentGameId) {
    statusEl.textContent = "Preparing cloud game…";
  }

  const gamePromise = ensureFirestoreGame(model, setup, hosts, tokens)
    .then((gameId) => {
      if (gameId) {
        currentGameId = gameId;
        if (statusEl) statusEl.textContent = `Cloud game ready: ${gameId}`;
      } else if (statusEl) {
        statusEl.textContent = "Cloud game not created.";
      }
      if (gameId && actions && typeof actions.patch === "function") {
        actions.patch({ gameId });
      }
      return gameId;
    })
    .catch((err) => {
      console.error("[LinksScreen] ensureFirestoreGame error", err);
      if (statusEl) {
        statusEl.textContent =
          "Cloud error: " + (err && err.message ? err.message : String(err));
      }
      return null;
    });

  // --- List rows ------------------------------------------------

  const rows = hosts.map((host, index) => {
    const name  = (host && host.name && host.name.trim()) || `Host ${index + 1}`;
    const label = index === 0 ? "Organiser link (you)" : "Host link";
    const safe  = esc(name);

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

  // --- Copy buttons ---------------------------------------------

  listEl.addEventListener("click", async (ev) => {
    const btn = ev.target.closest(".host-link-copy");
    if (!btn) return;

    const idx = Number(btn.dataset.hostIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= tokens.length) return;

    const token = tokens[idx];
    if (!token) return;

    // Make sure we have a gameId: use in-memory, localStorage or wait
    let gameId = currentGameId;

    if (!gameId) {
      try {
        const stored = window.localStorage.getItem(CURRENT_GAME_KEY);
        if (stored && stored.trim()) {
          gameId = stored.trim();
        }
      } catch (_) {}
    }

    if (!gameId && gamePromise) {
      gameId = await gamePromise;
    }

    const url = buildInviteUrl(token, gameId);
    const originalText = btn.textContent;

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(url);
      } else {
        window.prompt("Copy this invite link", url);
      }

      btn.textContent = "Copied!";
      btn.disabled = true;
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 1500);
    } catch (err) {
      // Fallback – old-school copy box
      window.prompt("Copy this invite link", url);
    }
  });

  // --- Navigation -----------------------------------------------

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      try {
        actions.setState && actions.setState("hosts");
      } catch (_) {}
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (model) {
        model.activeHostIndex = 0; // organiser inside the app
      }
      try {
        actions.setState && actions.setState("invite");
      } catch (_) {}
    });
  }
}
