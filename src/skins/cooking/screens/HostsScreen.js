// path: src/skins/cooking/screens/HostsScreen.js
// Hosts screen – organiser + up to 5 additional hosts

const HOSTS_STORAGE_KEY = "cq_hosts_v1";
const MAX_HOSTS = 6; // organiser + up to 5 more
const MIN_HOSTS = 2;

// Basic HTML escaping for host names
function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Build hosts array from model or localStorage
function hydrateHosts(model = {}) {
  let hosts = [];

  // Prefer any existing hosts in the shared model
  if (Array.isArray(model.hosts) && model.hosts.length) {
    hosts = model.hosts.map((h) => ({
      name: h && typeof h.name === "string" ? h.name : "",
    }));
  } else {
    // Fall back to organiser name fields we might have stored earlier
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

  // If still empty, give a generic Host 1
  if (hosts.length === 0) {
    hosts = [{ name: "" }];
  }

  // Clamp length
  if (hosts.length > MAX_HOSTS) {
    hosts = hosts.slice(0, MAX_HOSTS);
  }

  // Merge in cached names from localStorage (non-destructive)
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

  // Always at least Host 1
  if (!hosts[0]) {
    hosts[0] = { name: "" };
  }

  return hosts;
}

function persistHosts(hosts, actions) {
  try {
    window.localStorage.setItem(HOSTS_STORAGE_KEY, JSON.stringify(hosts));
  } catch (_) {}

  try {
    if (actions && typeof actions.updateHosts === "function") {
      actions.updateHosts(hosts);
    } else if (actions && typeof actions.setHosts === "function") {
      actions.setHosts(hosts);
    } else if (actions && typeof actions.patch === "function") {
      actions.patch({ hosts });
    }
  } catch (_) {
    // non-fatal
  }
}

export function render(root, model = {}, actions = {}) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  // Always start this screen scrolled to the very top
  try {
    // Hard reset the window scroll (covers iOS Safari quirks)
    window.scrollTo(0, 0);
  } catch (_) {}

  try {
    const scroller =
      document.scrollingElement ||
      document.documentElement ||
      document.body;
    scroller.scrollTop = 0;
  } catch (_) {}

  let hosts = hydrateHosts(model);

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
        <h2 class="menu-h2">ADD YOUR HOSTS</h2>
        <p class="menu-copy">
          You're Host #1. Add up to five more hosts who'll each host a night of your Culinary Quest.
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- MAIN -->
      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">HOST LINE-UP</h2>
        <p class="menu-copy">
          List everyone who will take a turn hosting. You can have between two and six hosts in total (including you).
        </p>

        <ul class="hosts-list" id="hostsList"></ul>

        <button type="button" class="btn btn-secondary hosts-add-btn" id="hostsAdd">
          Add another host
        </button>

        <p class="menu-copy hosts-summary">
          Hosts listed: <span id="hostsCount"></span> / ${MAX_HOSTS} (including you).
        </p>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <div class="menu-actions">
        <button class="btn btn-secondary" id="hostsBack">Back</button>
        <button class="btn btn-primary" id="hostsNext">Continue</button>
      </div>

      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
        HostsScreen – organiser + up to 5 additional hosts
      </p>
    </section>
  `;

// Scroll to top when Hosts screen loads
  try {
    const scroller =
      document.scrollingElement ||
      document.documentElement ||
      document.body;
    scroller.scrollTop = 0;
  } catch (_) {}
  
  const listEl = root.querySelector("#hostsList");
  const addBtn = root.querySelector("#hostsAdd");
  const backBtn = root.querySelector("#hostsBack");
  const nextBtn = root.querySelector("#hostsNext");
  const countEl = root.querySelector("#hostsCount");

  if (!listEl) return;

  function countNonEmpty() {
    return hosts.filter((h) => h.name && h.name.trim()).length;
  }

  function updateSummaryAndButton() {
    const totalNamed = countNonEmpty();
    if (countEl) {
      countEl.textContent = String(totalNamed);
    }
    if (nextBtn) {
      nextBtn.disabled = totalNamed < MIN_HOSTS;
      nextBtn.style.opacity = totalNamed < MIN_HOSTS ? "0.6" : "1";
    }
  }

  function renderList() {
    const rows = hosts.map((host, index) => {
      if (index === 0) {
        // organiser row (read-only)
        const name = esc(host.name || "");
        return `
          <li class="host-row host-row--organiser">
            <div class="host-row-label">Host 1</div>
            <div class="host-row-main">
              <div class="host-row-name">${name || "Host 1"}</div>
              <div class="host-row-meta">Organiser (you)</div>
            </div>
          </li>
        `;
      }

      const displayIndex = index + 1;
      const value = esc(host.name || "");

      return `
        <li class="host-row">
          <div class="host-row-label">Host ${displayIndex}</div>
          <div class="host-row-main">
            <input
              type="text"
              class="host-name-input"
              data-index="${index}"
              placeholder="Host ${displayIndex} name"
              value="${value}"
              autocomplete="name"
              autocapitalize="words"
            />
          </div>
          <button
            type="button"
            class="host-remove-btn"
            data-remove-index="${index}"
          >
            Remove
          </button>
        </li>
      `;
    });

    listEl.innerHTML = rows.join("");
    updateSummaryAndButton();
  }

  // Initial paint
  renderList();

  // INPUT: update host name & summary only (no re-render → keeps focus)
  listEl.addEventListener("input", (ev) => {
    const t = ev.target;
    if (!t || !t.classList.contains("host-name-input")) return;
    const idx = Number(t.dataset.index);
    if (Number.isNaN(idx) || !hosts[idx]) return;
    hosts[idx].name = t.value;
    updateSummaryAndButton();
    persistHosts(hosts, actions);
  });

  // CLICK: remove buttons (these do re-render)
  listEl.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".host-remove-btn");
    if (!btn) return;
    const idx = Number(btn.dataset.removeIndex);
    if (!Number.isInteger(idx) || idx <= 0 || idx >= hosts.length) return;

    hosts.splice(idx, 1);
    renderList();
    persistHosts(hosts, actions);
  });

  // Add another host
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      if (hosts.length >= MAX_HOSTS) return;
      hosts.push({ name: "" });
      renderList();
      persistHosts(hosts, actions);

      // Focus the new input on next frame
      requestAnimationFrame(() => {
        const newInput = root.querySelector(
          '.host-name-input[data-index="' + (hosts.length - 1) + '"]'
        );
        if (newInput && typeof newInput.focus === "function") {
          newInput.focus();
        }
      });
    });
  }

  // Navigation
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      persistHosts(hosts, actions);
      try {
        actions.setState && actions.setState("setup");
      } catch (_) {}
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      const totalNamed = countNonEmpty();
      if (totalNamed < MIN_HOSTS) {
        // Belt-and-braces guard; button should be disabled anyway
        return;
      }
      persistHosts(hosts, actions);
      try {
        actions.setState && actions.setState("links"); // next: per-host invite links
      } catch (_) {}
    });
  }
}
