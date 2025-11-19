// path: src/skins/cooking/screens/HostsScreen.js
// Screen 3 – organiser adds up to 5 more hosts (6 total incl. organiser)

const HOSTS_STORAGE_KEY = "cq_hosts_v1";

// Simple HTML escaper for safety
function esc(str) {
  if (str == null) return "";
  return String(str).replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return ch;
    }
  });
}

// Work out organiser name from model / localStorage
function getOrganiserName(model) {
  let name =
    (model && model.hostName) ||
    (model && model.organiserName) ||
    "";

  try {
    const lsName =
      window.localStorage.getItem("cq_organiser_name") ||
      window.localStorage.getItem("cq_host_name");
    if (!name && lsName) name = lsName;
  } catch (_) {}

  return name || "Host 1";
}

// Hydrate host list from model or localStorage
function hydrateHosts(model, organiserName) {
  let hosts = [];

  if (model && Array.isArray(model.hosts) && model.hosts.length) {
    hosts = model.hosts.map((h) => ({
      name: typeof h.name === "string" ? h.name : "",
      isOrganiser: !!h.isOrganiser,
    }));
  } else {
    try {
      const raw = window.localStorage.getItem(HOSTS_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved)) {
          hosts = saved.map((h) => ({
            name: typeof h.name === "string" ? h.name : "",
            isOrganiser: !!h.isOrganiser,
          }));
        }
      }
    } catch (_) {}
  }

  if (!hosts.length) {
    hosts = [{ name: organiserName, isOrganiser: true }];
  }

  // Ensure first entry is organiser and name is in sync
  hosts[0] = {
    name: organiserName,
    isOrganiser: true,
  };

  // Max 6 total (organiser + 5)
  if (hosts.length > 6) {
    hosts = hosts.slice(0, 6);
  }

  return hosts;
}

// Persist to localStorage + shared model
function persistHosts(hosts, actions) {
  const clean = hosts
    .map((h, idx) => ({
      name: (h.name || "").trim(),
      isOrganiser: idx === 0 ? true : !!h.isOrganiser,
    }))
    .filter((h) => h.name); // ignore completely empty rows

  try {
    window.localStorage.setItem(HOSTS_STORAGE_KEY, JSON.stringify(clean));
  } catch (_) {}

  try {
    if (actions && typeof actions.updateHosts === "function") {
      actions.updateHosts(clean);
    } else if (actions && typeof actions.setHosts === "function") {
      actions.setHosts(clean);
    } else if (actions && typeof actions.patch === "function") {
      actions.patch({ hosts: clean });
    }
  } catch (_) {
    // non-fatal
  }

  return clean;
}

export function render(root, model = {}, actions = {}) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  const organiserName = getOrganiserName(model);
  let hosts = hydrateHosts(model, organiserName);

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
          You're Host&nbsp;#1. Add up to five more hosts who'll each
          host a night of your Culinary Quest.
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- MAIN: host list -->
      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">HOST LINE-UP</h2>
        <p class="menu-copy">
          List everyone who will take a turn hosting. You can have between
          two and six hosts in total (including you).
        </p>

        <ul class="host-list" id="hostList"></ul>

        <div class="host-add-row">
          <button type="button" class="btn btn-secondary" id="addHost">
            Add another host
          </button>
        </div>

        <p class="menu-setup-hint" id="hostCountHint"></p>
        <p class="menu-setup-hint host-error" id="hostError" role="alert"></p>
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

  const hostListEl = root.querySelector("#hostList");
  const hostCountHint = root.querySelector("#hostCountHint");
  const hostError = root.querySelector("#hostError");
  const addBtn = root.querySelector("#addHost");

  function setError(msg) {
    if (!hostError) return;
    hostError.textContent = msg || "";
    hostError.style.display = msg ? "block" : "none";
  }

  function renderHosts() {
    if (!hostListEl) return;

    const maxTotal = 6;
    const total = hosts.length;
    const namedCount = hosts.filter((h) => (h.name || "").trim()).length;

    hostListEl.innerHTML = hosts
      .map((h, idx) => {
        if (idx === 0) {
          // organiser row – locked
          return `
            <li class="host-row host-row--organiser">
              <span class="host-number">Host 1</span>
              <span class="host-name-label">${esc(organiserName)}</span>
              <span class="host-tag">Organiser (you)</span>
            </li>
          `;
        }

        const label = `Host ${idx + 1}`;
        const value = esc(h.name || "");

        return `
          <li class="host-row">
            <span class="host-number">${label}</span>
            <input
              type="text"
              class="host-name-input"
              data-index="${idx}"
              value="${value}"
              placeholder="Host name"
              maxlength="40"
            />
            <button
              type="button"
              class="host-remove"
              data-remove-index="${idx}"
            >
              Remove
            </button>
          </li>
        `;
      })
      .join("");

    if (hostCountHint) {
      hostCountHint.textContent = `Hosts listed: ${namedCount} / ${maxTotal} (including you).`;
    }

    if (addBtn) {
      addBtn.disabled = hosts.length >= maxTotal;
    }
  }

  // initial paint
  renderHosts();
  setError("");

  // --- event handlers ---

  function handleClick(ev) {
    const t = ev.target;
    if (!t) return;

    // Add another host (max 6 total incl organiser)
    if (t.id === "addHost") {
      if (hosts.length >= 6) return;
      hosts.push({ name: "", isOrganiser: false });
      renderHosts();
      setError("");
      return;
    }

    // Remove a non-organiser host
    if (t.classList.contains("host-remove") && t.dataset.removeIndex) {
      const idx = parseInt(t.dataset.removeIndex, 10);
      if (!Number.isNaN(idx) && idx > 0 && idx < hosts.length) {
        hosts.splice(idx, 1);
        renderHosts();
        setError("");
      }
      return;
    }

    // Navigation: Back → Setup
    if (t.id === "hostsBack") {
      persistHosts(hosts, actions);
      try {
        actions.setState && actions.setState("setup");
      } catch (_) {}
      return;
    }

    // Navigation: Continue → Links
    if (t.id === "hostsNext") {
      const cleaned = persistHosts(hosts, actions);
      const count = cleaned.length;

      if (count < 2) {
        setError("Please add at least one more host to continue.");
        return;
      }

      // continue to invite-links screen
      try {
        actions.setState && actions.setState("links");
      } catch (_) {}
    }
  }

  function handleInput(ev) {
    const t = ev.target;
    if (!t) return;

    if (t.classList.contains("host-name-input") && t.dataset.index) {
      const idx = parseInt(t.dataset.index, 10);
      if (!Number.isNaN(idx) && idx > 0 && idx < hosts.length) {
        hosts[idx].name = t.value;
        setError("");
        renderHosts(); // keep counts up to date
      }
    }
  }

  root.addEventListener("click", handleClick);
  root.addEventListener("input", handleInput);

  // cleanup when router swaps screens
  return () => {
    root.removeEventListener("click", handleClick);
    root.removeEventListener("input", handleInput);
  };
}
