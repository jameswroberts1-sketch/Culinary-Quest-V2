// path: src/skins/cooking/screens/LinksScreen.js
// Invite links screen – per-host shareable links for the organiser

const HOSTS_STORAGE_KEY = "cq_hosts_v1";
const GAME_ID_KEY = "cq_game_id_v1";

// Basic HTML escaping for host names
function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Reuse the same host hydrate logic as HostsScreen
function hydrateHosts(model = {}) {
  let hosts = [];

  if (Array.isArray(model.hosts) && model.hosts.length) {
    hosts = model.hosts.map((h) => ({
      name: h && typeof h.name === "string" ? h.name : "",
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

  // Merge in cached host names from localStorage (non-destructive)
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

  return hosts;
}

// Generate or recover a stable game id
function getGameId(model = {}, actions = {}) {
  // 1) Prefer model.gameId if present
  if (model && typeof model.gameId === "string" && model.gameId.trim()) {
    return model.gameId;
  }

  // 2) Next, check localStorage
  try {
    const cached = window.localStorage.getItem(GAME_ID_KEY);
    if (cached && cached.trim()) return cached;
  } catch (_) {}

  // 3) Otherwise generate a new short id
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  const gameId = `CQ-${stamp}-${rand}`;

  // Persist to localStorage
  try {
    window.localStorage.setItem(GAME_ID_KEY, gameId);
  } catch (_) {}

  // And try to push into shared model
  try {
    if (actions && typeof actions.patch === "function") {
      actions.patch({ gameId });
    } else if (actions && typeof actions.setGameId === "function") {
      actions.setGameId(gameId);
    }
  } catch (_) {}

  return gameId;
}

// Build a base URL (no hash / query, no trailing slash)
function getBaseUrl() {
  try {
    let href = window.location.href;
    const hashIdx = href.indexOf("#");
    if (hashIdx !== -1) href = href.slice(0, hashIdx);
    const qIdx = href.indexOf("?");
    if (qIdx !== -1) href = href.slice(0, qIdx);
    return href.replace(/\/+$/, "");
  } catch (_) {
    return "";
  }
}

// Build per-host invite link
function buildHostLink(baseUrl, gameId, hostIndex) {
  const safeBase = baseUrl || "";
  const query = `?game=${encodeURIComponent(gameId)}&host=${hostIndex + 1}`;
  return safeBase + "/" + query.replace(/^\?/, "?");
}

export function render(root, model = {}, actions = {}) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  const hosts = hydrateHosts(model);
  const baseUrl = getBaseUrl();
  const gameId = getGameId(model, actions);

  // Pre-compute link objects
  const linkRows = hosts.map((h, idx) => {
    const name = h && h.name ? h.name : `Host ${idx + 1}`;
    const url = buildHostLink(baseUrl, gameId, idx);
    return { index: idx, name, url };
  });

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
        <h2 class="menu-h2">SHARE YOUR LINKS</h2>
        <p class="menu-copy">
          Each host gets a personal link to join your Culinary Quest and see their hosting details.
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- MAIN -->
      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">HOST INVITE LINKS</h2>
        <p class="menu-copy">
          Copy each link and send it to the right host via your favourite app (text, WhatsApp, email, etc.).
        </p>

        <ul class="links-list" id="linksList">
          ${linkRows
            .map((row, i) => {
              const displayIndex = i + 1;
              const safeName = esc(row.name);
              const safeUrl = esc(row.url);
              const isOrganiser = i === 0;

              return `
                <li class="link-row">
                  <div class="link-label">
                    Host ${displayIndex}
                  </div>
                  <div class="link-main">
                    <div class="link-name">
                      ${safeName}
                      ${
                        isOrganiser
                          ? '<span class="link-meta">(Organiser – you)</span>'
                          : ""
                      }
                    </div>
                    <input
                      type="url"
                      class="link-url"
                      value="${safeUrl}"
                      readonly
                      data-index="${i}"
                    />
                  </div>
                  <button
                    type="button"
                    class="link-copy-btn"
                    data-copy-index="${i}"
                  >
                    Copy
                  </button>
                </li>
              `;
            })
            .join("")}
        </ul>

        <p class="menu-copy links-hint">
          Tip: If copy doesn’t work on your phone, long-press the link to copy it instead.
        </p>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <!-- DESSERT -->
      <section class="menu-section">
        <div class="menu-course">DESSERT</div>
        <h2 class="menu-h2">WHAT HAPPENS NEXT?</h2>
        <p class="menu-copy">
          Once everyone has their link, they’ll add their dates and RSVP details on their own phones.
          You’ll still stay in control as the organiser.
        </p>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <div class="menu-actions">
        <button class="btn btn-secondary" id="linksBack">Back</button>
        <button class="btn btn-primary" id="linksNext">Continue</button>
      </div>

      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
        LinksScreen – per-host invite links
      </p>
    </section>
  `;

  // Always start this screen at the top (and avoid iOS oddities)
  requestAnimationFrame(() => {
    try {
      const scroller =
        document.scrollingElement ||
        document.documentElement ||
        document.body;
      scroller.scrollTop = 0;
    } catch (_) {}
  });

  const listEl = root.querySelector("#linksList");
  const backBtn = root.querySelector("#linksBack");
  const nextBtn = root.querySelector("#linksNext");

  // Copy buttons
  if (listEl) {
    listEl.addEventListener("click", async (ev) => {
      const btn = ev.target.closest(".link-copy-btn");
      if (!btn) return;
      const idx = Number(btn.dataset.copyIndex);
      if (Number.isNaN(idx)) return;

      const input = listEl.querySelector(
        '.link-url[data-index="' + idx + '"]'
      );
      if (!input) return;

      const text = input.value;

      // Try Clipboard API first
      let copied = false;
      try {
        if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          copied = true;
        }
      } catch (_) {}

      // Fallback: select text so the user can copy manually
      if (!copied) {
        try {
          input.focus();
          input.select();
        } catch (_) {}
      }

      // Tiny visual nudge
      const original = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => {
        btn.textContent = original;
      }, 1400);
    });
  }

  // Navigation
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      try {
        actions.setState && actions.setState("hosts");
      } catch (_) {}
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      // For now, send to the generic "started" stub until we wire the next screen
      try {
        actions.setState && actions.setState("started");
      } catch (_) {}
    });
  }
}
