// path: src/skins/cooking/screens/LinksScreen.js
// Invite links screen – one copy button per host, no raw URLs shown

const LINKS_STORAGE_KEY = "cq_links_v1";
const MAX_HOSTS = 6;

// Basic HTML escaping
function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Generate a short token for a host if one doesn't exist yet
function makeToken(index) {
  return `h${index}-${Math.random().toString(36).slice(2, 8)}`;
}

// Build the invite URL for a host
function buildInviteUrl(index, token, model = {}) {
  const base =
    (model && model.baseUrl) ||
    (typeof window !== "undefined"
      ? window.location.origin + window.location.pathname
      : "");

  // You can tweak these query params later when we wire the join flow
  const params = new URLSearchParams();
  params.set("host", String(index));
  params.set("token", token);

  return base ? `${base}?${params.toString()}` : `?host=${index}&token=${token}`;
}

// Hydrate per-host tokens from model or localStorage
function hydrateTokens(hosts, model = {}) {
  const count = hosts.length;
  let tokens = new Array(count).fill(null);

  // 1) From shared model, if it already has something like model.links
  if (Array.isArray(model.links) && model.links.length) {
    model.links.forEach((entry, idx) => {
      if (idx < count && entry && typeof entry.token === "string") {
        tokens[idx] = entry.token;
      }
    });
  }

  // 2) Merge in from localStorage
  try {
    const raw = window.localStorage.getItem(LINKS_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved)) {
        saved.forEach((entry, idx) => {
          if (idx < count && entry && typeof entry.token === "string") {
            if (!tokens[idx]) tokens[idx] = entry.token;
          }
        });
      }
    }
  } catch (_) {}

  // 3) Ensure we have a token for each host
  tokens = tokens.map((tok, idx) => tok || makeToken(idx));

  return tokens;
}

// Persist tokens in both localStorage and the shared model (if possible)
function persistTokens(tokens, hosts, actions) {
  const payload = tokens.map((token, index) => ({
    token,
    hostIndex: index,
    name: hosts[index] && hosts[index].name ? hosts[index].name : ""
  }));

  try {
    window.localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {}

  try {
    if (actions && typeof actions.updateLinks === "function") {
      actions.updateLinks(payload);
    } else if (actions && typeof actions.setLinks === "function") {
      actions.setLinks(payload);
    } else if (actions && typeof actions.patch === "function") {
      actions.patch({ links: payload });
    }
  } catch (_) {
    // non-fatal
  }
}

export function render(root, model = {}, actions = {}) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  // Always start this screen scrolled to the top
  try {
    const scroller =
      document.scrollingElement ||
      document.documentElement ||
      document.body;
    scroller.scrollTop = 0;
  } catch (_) {}

  // Hosts from model (same structure as HostsScreen)
  let hosts = [];
  if (Array.isArray(model.hosts) && model.hosts.length) {
    hosts = model.hosts.map((h) => ({
      name: h && typeof h.name === "string" ? h.name : ""
    }));
  }

  // Fallback if somehow empty
  if (!hosts.length) {
    const organiserName =
      model.organiserName ||
      model.hostName ||
      model.name ||
      model.organiser ||
      "";
    hosts = [{ name: organiserName || "Host 1" }];
  }

  // Clamp to expected maximum
  if (hosts.length > MAX_HOSTS) {
    hosts = hosts.slice(0, MAX_HOSTS);
  }

  // Get or create per-host tokens
  const tokens = hydrateTokens(hosts, model);

  // Build row HTML
  const rows = hosts
    .map((host, index) => {
      const displayIndex = index + 1;
      const name = host.name && host.name.trim()
        ? host.name.trim()
        : `Host ${displayIndex}`;
      const safeName = esc(name);

      // We keep the URL only as a data attribute (not visibly rendered)
      const url = esc(buildInviteUrl(index, tokens[index], model));

      const roleLabel =
        index === 0 ? "Organiser (you)" : `Guest host #${displayIndex}`;

      return `
        <li class="host-row">
          <div class="host-row-label">Host ${displayIndex}</div>
          <div class="host-row-main">
            <div class="host-row-name">${safeName}</div>
            <div class="host-row-meta">${esc(roleLabel)}</div>
          </div>
          <button
            type="button"
            class="btn btn-secondary host-copy-btn"
            data-url="${url}"
            data-host-index="${index}"
          >
            Copy ${safeName}'s link
          </button>
        </li>
      `;
    })
    .join("");

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
        <h2 class="menu-h2">INVITE YOUR HOSTS</h2>
        <p class="menu-copy">
          Each host gets their own private link. Copy and share it with them however you like.
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- MAIN -->
      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">INVITE LINKS</h2>
        <p class="menu-copy">
          Tap “Copy link” next to each host. The full URL stays hidden – we’ll just pop it on your clipboard.
        </p>

        <ul class="hosts-list" id="linksList">
          ${rows}
        </ul>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <div class="menu-actions">
        <button class="btn btn-secondary" id="linksBack">Back</button>
        <button class="btn btn-primary" id="linksNext">Continue</button>
      </div>

      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
        LinksScreen – per-host invite buttons, URLs hidden
      </p>
    </section>
  `;

  // Persist tokens now that we know hosts
  persistTokens(tokens, hosts, actions);

  const listEl  = root.querySelector("#linksList");
  const backBtn = root.querySelector("#linksBack");
  const nextBtn = root.querySelector("#linksNext");

  async function copyToClipboard(text) {
    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {
      // fall through to fallback
    }

    // Fallback: temporary textarea
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch (_) {
      return false;
    }
  }

  const handleClick = async (ev) => {
    const t = ev.target;
    if (!t) return;

    // Copy host link
    if (t.classList.contains("host-copy-btn")) {
      const url = t.getAttribute("data-url");
      if (!url) return;

      const ok = await copyToClipboard(url);

      // Tiny “Copied!” feedback on the button
      const original = t.textContent;
      if (ok) {
        t.textContent = "Copied!";
        setTimeout(() => {
          t.textContent = original;
        }, 1200);
      }

      return;
    }

    // Back → return to Hosts screen
    if (t.id === "linksBack") {
      try {
        actions.setState && actions.setState("hosts");
      } catch (_) {}
      return;
    }

    // Next → organiser goes on to the “invite”/date-pick step
    if (t.id === "linksNext") {
      try {
        actions.setState && actions.setState("invite");
      } catch (_) {}
      return;
    }
  };

  root.addEventListener("click", handleClick);

  // Cleanup if router unmounts this screen
  return () => {
    root.removeEventListener("click", handleClick);
  };
}
