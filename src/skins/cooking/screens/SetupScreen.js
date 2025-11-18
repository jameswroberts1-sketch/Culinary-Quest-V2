// path: src/skins/cooking/screens/SetupScreen.js
// Setup screen – organiser chooses scoring style, categories, and whether themes are allowed.

const STORAGE_KEY = "cq_setup_v1";

// Default setup config
const DEFAULT_SETUP = {
  mode: "simple",                 // "simple" | "category"
  categories: ["Food"],           // always includes Food
  customCategories: [],           // up to 3 custom
  allowThemes: false
};

// Built-in optional categories (besides "Food")
const BUILT_INS = ["Table Setting", "Drinks", "Atmosphere", "Entertainment"];

export function render(root, model, actions) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  // ---- hydrate initial setup state ----
  let setup = { ...DEFAULT_SETUP };

  // 1) try model.setup if engine already stores it
  if (model && model.setup) {
    const m = model.setup;
    if (m.mode === "simple" || m.mode === "category") setup.mode = m.mode;
    if (Array.isArray(m.categories) && m.categories.includes("Food")) {
      setup.categories = m.categories.slice(0, 4);
    }
    if (Array.isArray(m.customCategories)) {
      setup.customCategories = m.customCategories.slice(0, 3);
    }
    if (typeof m.allowThemes === "boolean") {
      setup.allowThemes = m.allowThemes;
    }
  } else {
    // 2) fall back to localStorage (dev-friendly)
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === "object") {
          if (saved.mode === "simple" || saved.mode === "category") {
            setup.mode = saved.mode;
          }
          if (Array.isArray(saved.categories) && saved.categories.includes("Food")) {
            setup.categories = saved.categories.slice(0, 4);
          }
          if (Array.isArray(saved.customCategories)) {
            setup.customCategories = saved.customCategories.slice(0, 3);
          }
          if (typeof saved.allowThemes === "boolean") {
            setup.allowThemes = saved.allowThemes;
          }
        }
      }
    } catch (_) {}
  }

  // Ensure invariants
  if (!setup.categories.includes("Food")) {
    setup.categories = ["Food", ...setup.categories.filter(c => c !== "Food")].slice(0, 4);
  }
  if (setup.customCategories.length > 3) {
    setup.customCategories = setup.customCategories.slice(0, 3);
  }

  // ---- skeleton HTML ----
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

      <!-- ENTREE: scoring & themes intro -->
      <section class="menu-section">
        <div class="menu-course">ENTRÉE</div>
        <h2 class="menu-h2">SCORING & THEMES</h2>
        <p class="menu-copy">
          Choose how your guests will score each dinner, and whether hosts can set a dress-up theme.
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- MAIN: scoring mode + categories -->
      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">SCORING MODE</h2>
        <p class="menu-copy">
          Decide whether guests give one overall score, or score across multiple categories.
        </p>

        <div class="setup-modes" aria-label="Choose scoring mode">
          <button
            type="button"
            class="btn btn-secondary setup-mode"
            data-mode="simple"
          >
            <strong>Simple scoring</strong><br/>
            <span class="muted">One overall score (0–10) per dinner.</span>
          </button>

          <button
            type="button"
            class="btn btn-secondary setup-mode"
            data-mode="category"
          >
            <strong>Category scoring</strong><br/>
            <span class="muted">Food plus up to 3 extra categories.</span>
          </button>
        </div>

        <div
          id="setup-cats-block"
          class="setup-cats-block"
          aria-label="Category selection"
        >
          <p class="menu-copy" style="margin-top:10px;">
            <strong>Categories (max 4):</strong> Food is compulsory. Add up to 3 more,
            including up to 3 of your own.
          </p>

          <div id="setup-cats-list" class="cat-grid"></div>

          <div class="setup-custom-row">
            <input
              id="setup-custom-input"
              class="menu-input"
              type="text"
              placeholder="Add custom category (up to 3)"
              autocomplete="off"
            />
            <button
              type="button"
              class="btn btn-secondary setup-add-custom"
              id="setup-add-custom"
            >
              Add
            </button>
          </div>

          <p class="muted" id="setup-count" style="margin-top:6px;font-size:0.85rem;">
            &nbsp;
          </p>
        </div>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <!-- DESSERT: themes toggle -->
      <section class="menu-section">
        <div class="menu-course">DESSERT</div>
        <h2 class="menu-h2">THEME NIGHTS</h2>
        <p class="menu-copy">
          Allow each host to set a theme (e.g. “Mexican Fiesta”, “Feathers & Fedoras”) as a cue for guests.
        </p>

        <div class="theme-toggle-row">
          <label class="theme-toggle-label">
            <input
              id="setup-theme-toggle"
              type="checkbox"
            />
            <span>Allow hosts to set a theme for their night</span>
          </label>
        </div>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <div class="menu-actions">
        <button class="btn btn-secondary" id="setup-back">Back</button>
        <button class="btn btn-primary"   id="setup-next">Continue</button>
      </div>

      <!-- Tiny dev stamp so you can see when this screen has updated -->
      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
        SetupScreen – scoring & themes wired
      </p>
    </section>
  `;

  const modesContainer   = root.querySelector(".setup-modes");
  const catsBlock        = root.querySelector("#setup-cats-block");
  const catsList         = root.querySelector("#setup-cats-list");
  const countLabel       = root.querySelector("#setup-count");
  const customInput      = root.querySelector("#setup-custom-input");
  const themeToggleInput = root.querySelector("#setup-theme-toggle");

  // ---- helper: push setup into localStorage + engine (if supported) ----
  function persistSetup() {
    // Local storage (dev-friendly)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(setup));
    } catch (_) {}

    // If the sync layer supports a "setup" field, store it there too
    if (actions && typeof actions.updateGame === "function") {
      // Non-destructive patch: we just attach a "setup" block
      actions.updateGame({ setup });
    } else if (actions && typeof actions.patch === "function") {
      // Generic patch-style API
      actions.patch({ setup });
    }
  }

  // ---- helper: render category chips & counters ----
  function renderCategories() {
    // Show/hide category block based on mode
    if (catsBlock) {
      catsBlock.style.display = (setup.mode === "category") ? "block" : "none";
    }

    if (!catsList) return;

    const selected = new Set(setup.categories);
    const customs  = new Set(setup.customCategories);

    const parts = [];

    // Food (compulsory)
    parts.push(`
      <label class="cat-chip">
        <input type="checkbox" checked disabled data-cat="Food" />
        <span>Food <span class="lock">(compulsory)</span></span>
      </label>
    `);

    // Built-in optionals
    for (const c of BUILT_INS) {
      const on = selected.has(c);
      parts.push(`
        <label class="cat-chip">
          <input type="checkbox" data-cat="${c}" ${on ? "checked" : ""}/>
          <span>${c}</span>
        </label>
      `);
    }

    // Custom categories
    for (const c of setup.customCategories) {
      const on = selected.has(c);
      parts.push(`
        <label class="cat-chip">
          <input type="checkbox" data-cat="${c}" ${on ? "checked" : ""}/>
          <span>${c} <button type="button" class="btn-ghost setup-remove" data-remove="${c}">Remove</button></span>
        </label>
      `);
    }

    catsList.innerHTML = parts.join("");

    // Counter text
    if (countLabel) {
      const total = setup.categories.length;
      countLabel.textContent = `Enabled: ${total} / 4 categories total (including “Food”).`;
    }
  }

  // ---- helper: update mode & refresh UI ----
  function setMode(nextMode) {
    if (nextMode !== "simple" && nextMode !== "category") return;
    setup.mode = nextMode;

    // When switching back to simple, we can keep categories in setup,
    // but they won't be used until category mode is active again.
    persistSetup();
    syncModeButtons();
    renderCategories();
  }

  function syncModeButtons() {
    if (!modesContainer) return;
    const buttons = modesContainer.querySelectorAll(".setup-mode");
    buttons.forEach((btn) => {
      const mode = btn.getAttribute("data-mode");
      btn.classList.toggle("setup-mode--selected", mode === setup.mode);
    });
  }

  // ---- init visuals from current setup state ----
  if (themeToggleInput) {
    themeToggleInput.checked = !!setup.allowThemes;
  }

  syncModeButtons();
  renderCategories();

  // ---- events ----

  const handleClick = (ev) => {
    const t = ev.target;
    if (!t) return;

    // Mode buttons
    if (t.closest(".setup-mode")) {
      const btn = t.closest(".setup-mode");
      const mode = btn.getAttribute("data-mode");
      setMode(mode);
      return;
    }

    // Category toggles (delegated)
    if (t.matches("input[type='checkbox'][data-cat]")) {
      const cat = t.getAttribute("data-cat");
      if (!cat) return;

      if (cat === "Food") {
        // Food is always on and cannot be removed
        t.checked = true;
        return;
      }

      const selected = new Set(setup.categories);
      if (t.checked) {
        // adding
        if (selected.size >= 4) {
          // revert this checkbox and warn
          t.checked = false;
          window.alert("You can select up to 4 categories in total (including Food).");
          return;
        }
        selected.add(cat);
        if (
          !setup.customCategories.includes(cat) &&
          !BUILT_INS.includes(cat) &&
          cat !== "Food"
        ) {
          // re-add to customs if somehow missing
          if (setup.customCategories.length < 3) {
            setup.customCategories.push(cat);
          }
        }
      } else {
        // removing
        selected.delete(cat);
      }

      setup.categories = Array.from(selected);
      persistSetup();
      renderCategories();
      return;
    }

    // Remove custom category
    if (t.classList.contains("setup-remove") && t.hasAttribute("data-remove")) {
      const name = t.getAttribute("data-remove");
      if (!name) return;
      setup.customCategories = setup.customCategories.filter((c) => c !== name);
      setup.categories = setup.categories.filter((c) => c !== name);
      persistSetup();
      renderCategories();
      return;
    }

    // Add custom category
    if (t.id === "setup-add-custom") {
      if (!customInput) return;
      const raw = customInput.value.trim();
      if (!raw) return;

      const name = raw.replace(/\s+/g, " ").trim();
      if (!name) return;

      // check duplicates vs all categories (case-insensitive)
      const allNames = new Set(
        [...setup.categories, ...setup.customCategories, "Food", ...BUILT_INS]
          .map((c) => c.toLowerCase())
      );
      if (allNames.has(name.toLowerCase())) {
        window.alert("That category is already in your list.");
        return;
      }

      if (setup.customCategories.length >= 3) {
        window.alert("You can add up to 3 custom categories.");
        return;
      }

      if (setup.categories.length >= 4) {
        window.alert("You already have 4 categories selected (including Food).");
        return;
      }

      setup.customCategories = [...setup.customCategories, name];
      setup.categories = [...setup.categories, name];
      customInput.value = "";
      persistSetup();
      renderCategories();
      return;
    }

    // Theme toggle (label click)
    if (t.id === "setup-theme-toggle" || t.closest("#setup-theme-toggle")) {
      if (themeToggleInput) {
        setup.allowThemes = !!themeToggleInput.checked;
        persistSetup();
      }
      return;
    }

    // Back → return to intro / lobby
    if (t.id === "setup-back") {
      try {
        if (actions && typeof actions.setState === "function") {
          actions.setState("lobby"); // alias of intro in your skin.js
        }
      } catch (err) {
        console.error("[Setup] setState('lobby') failed", err);
      }
      return;
    }

    // Continue → for now, just persist and stay in the same state
    // When the Hosts screen is ready, this is where you'll switch to:
    //    actions.setState("hosts")
    if (t.id === "setup-next") {
      persistSetup();
      try {
        if (actions && typeof actions.setState === "function") {
          // TEMP: keep on 'rsvp' (mapped to Setup in skin.js) until Hosts screen exists
          actions.setState("rsvp");
        }
      } catch (err) {
        console.error("[Setup] setState('rsvp') failed", err);
      }
      return;
    }
  };

  const handleChange = (ev) => {
    const t = ev.target;
    if (!t) return;

    if (t.id === "setup-theme-toggle") {
      setup.allowThemes = !!t.checked;
      persistSetup();
    }
  };

  root.addEventListener("click", handleClick);
  root.addEventListener("change", handleChange);

  // Cleanup when this screen is replaced
  return () => {
    root.removeEventListener("click", handleClick);
    root.removeEventListener("change", handleChange);
  };
}
