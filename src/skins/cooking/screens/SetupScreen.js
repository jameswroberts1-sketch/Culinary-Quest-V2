// path: src/skins/cooking/screens/SetupScreen.js
// Setup screen – organiser chooses scoring mode, categories & themes

const STORAGE_KEY = "cq_setup_v1";

// Default setup config
const DEFAULT_SETUP = {
  mode: "simple",            // "simple" | "category"
  categories: ["Food"],      // always includes Food
  customCategories: [],      // up to 3 custom
  allowThemes: false
};

// Built-in optional categories (besides "Food")
const BUILT_INS = ["Menu", "Table Setting", "Drinks", "Entertainment"];

export function render(root, model = {}, actions = {}) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  // ---- hydrate initial setup state ----
  let setup = { ...DEFAULT_SETUP };

  // 1) from model (if engine already stores it)
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
    // 2) fallback to localStorage – handy during dev
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

  // Invariants
  if (!setup.categories.includes("Food")) {
    setup.categories = ["Food", ...setup.categories.filter(c => c !== "Food")].slice(0, 4);
  }
  if (setup.customCategories.length > 3) {
    setup.customCategories = setup.customCategories.slice(0, 3);
  }

  const MAX_TOTAL = 4; // Food + 3 extras

  // ---- helpers ----
  const persistSetup = () => {
    // localStorage for this device
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(setup));
    } catch (_) {}

    // Optional: let the engine know, if it has a hook
    if (typeof actions.updateSetup === "function") {
      actions.updateSetup(setup);
    } else if (typeof actions.patchGame === "function") {
      actions.patchGame({ setup });
    }
  };

  const countExtras = () => setup.categories.filter(c => c !== "Food").length;

  const isCategorySelected = (cat) => setup.categories.includes(cat);

  const canSelectMore = () => countExtras() < (MAX_TOTAL - 1); // minus Food

  // ---- static shell; dynamic bits get filled by updateUI() ----
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

      <!-- ENTREE: title / description -->
      <section class="menu-section">
        <div class="menu-course">ENTRÉE</div>
        <h2 class="menu-h2">SCORING & THEMES</h2>
        <p class="menu-copy">
          Choose how your guests will score each dinner, and whether hosts can set a
          dress-up theme.
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- MAIN: scoring mode -->
      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">SCORING MODE</h2>
        <p class="menu-copy">
          Decide whether guests give one overall score, or score across multiple categories.
        </p>

        <div id="setup-mode" class="setup-option-group"></div>

        <div id="setup-categories" class="setup-categories-block"></div>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <!-- DESSERT: theme nights -->
      <section class="menu-section">
        <div class="menu-course">DESSERT</div>
        <h2 class="menu-h2">THEME NIGHTS</h2>
        <p class="menu-copy">
          Allow each host to set a theme (e.g. “Mexican Fiesta”, “Feathers & Fedoras”)
          as a cue for guests.
        </p>

        <label class="setup-toggle">
          <input
            id="setup-themes"
            type="checkbox"
            ${setup.allowThemes ? "checked" : ""}
          />
          <span>Allow hosts to set a theme for their night</span>
        </label>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <div class="menu-actions">
        <button class="btn btn-secondary" id="setup-back">Back</button>
        <button class="btn btn-primary" id="setup-next">Continue</button>
      </div>

      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
        SetupScreen – scoring & themes wired
      </p>
    </section>
  `;

  const modeEl = root.querySelector("#setup-mode");
  const catsEl = root.querySelector("#setup-categories");
  const themeInput = root.querySelector("#setup-themes");

  const renderModeCards = () => {
    const isSimple   = setup.mode === "simple";
    const isCategory = setup.mode === "category";

    modeEl.innerHTML = `
      <button
        type="button"
        class="setup-option-card ${isSimple ? "is-selected" : ""}"
        data-mode="simple"
      >
        <div class="setup-option-title">Simple scoring</div>
        <div class="setup-option-body">
          One overall score (0–10) per dinner.
        </div>
      </button>

      <button
        type="button"
        class="setup-option-card ${isCategory ? "is-selected" : ""}"
        data-mode="category"
      >
        <div class="setup-option-title">Category scoring</div>
        <div class="setup-option-body">
          Food plus up to 3 extra categories.
        </div>
      </button>
    `;
  };

  const renderCategories = () => {
    if (setup.mode === "simple") {
      catsEl.innerHTML = `
        <p class="menu-copy menu-copy--hint">
          Guests will give one overall score per dinner. Categories are disabled in this mode.
        </p>
      `;
      return;
    }

    const extrasUsed = countExtras();
    const atMax = extrasUsed >= (MAX_TOTAL - 1);

    const builtInRows = BUILT_INS.map((cat) => {
      const selected = isCategorySelected(cat);
      const disabled = !selected && atMax;
      return `
        <li class="setup-category-row">
          <label>
            <input
              type="checkbox"
              class="setup-category-checkbox"
              data-category="${cat}"
              ${selected ? "checked" : ""}
              ${disabled ? "disabled" : ""}
            />
            <span class="setup-category-name">${cat}</span>
          </label>
        </li>
      `;
    }).join("");

    const customRows = setup.customCategories.map((cat) => {
      const selected = isCategorySelected(cat);
      const disabled = !selected && atMax;
      return `
        <li class="setup-category-row">
          <label>
            <input
              type="checkbox"
              class="setup-category-checkbox"
              data-category="${cat}"
              ${selected ? "checked" : ""}
              ${disabled ? "disabled" : ""}
            />
            <span class="setup-category-name">
              ${cat}
              <span class="setup-category-note">(custom)</span>
            </span>
          </label>
        </li>
      `;
    }).join("");

    const canAddCustom = setup.customCategories.length < 3;

    catsEl.innerHTML = `
      <p class="menu-copy" style="margin-top:10px;">
        <strong>Food</strong> is compulsory. Choose up to
        <strong>${MAX_TOTAL - 1}</strong> extra categories.
      </p>

      <ul class="setup-category-list">
        <li class="setup-category-row setup-category-row--locked">
          <label>
            <input type="checkbox" checked disabled />
            <span class="setup-category-name">
              Food <span class="setup-category-note">(compulsory)</span>
            </span>
          </label>
        </li>

        ${builtInRows}
        ${customRows}
      </ul>

      <div class="setup-custom-row">
        <input
          id="setup-custom-input"
          class="setup-custom-input"
          type="text"
          placeholder="${canAddCustom ? "Add custom category (max 3)" : "Custom category limit reached"}"
          ${canAddCustom ? "" : "disabled"}
        />
        <button
          type="button"
          id="setup-custom-add"
          class="btn btn-secondary setup-custom-add"
          ${canAddCustom ? "" : "disabled"}
        >
          Add
        </button>
      </div>

      <p class="menu-copy menu-copy--hint" style="margin-top:6px;">
        Maximum of ${MAX_TOTAL} categories in total (Food + ${MAX_TOTAL - 1} extras).
      </p>
    `;
  };

  const updateUI = () => {
    renderModeCards();
    renderCategories();
    if (themeInput) {
      themeInput.checked = !!setup.allowThemes;
    }
  };

  updateUI();

  // ---- events ----
  const handleClick = (ev) => {
    const t = ev.target;
    if (!t) return;

    // Mode cards
    const optionCard = t.closest(".setup-option-card");
    if (optionCard && modeEl.contains(optionCard)) {
      const mode = optionCard.getAttribute("data-mode");
      if (mode === "simple" || mode === "category") {
        setup.mode = mode;
        if (mode === "simple") {
          setup.categories = ["Food"];
        } else if (!setup.categories.includes("Food")) {
          setup.categories = ["Food", ...setup.categories.filter(c => c !== "Food")].slice(0, 4);
        }
        persistSetup();
        updateUI();
      }
      return;
    }

    // Add custom category
    if (t.id === "setup-custom-add") {
      const input = root.querySelector("#setup-custom-input");
      if (!input) return;
      const val = (input.value || "").trim();
      if (!val) return;

      if (setup.customCategories.length >= 3) {
        return;
      }

      const exists =
        setup.customCategories.some(c => c.toLowerCase() === val.toLowerCase()) ||
        setup.categories.some(c => c.toLowerCase() === val.toLowerCase()) ||
        BUILT_INS.some(c => c.toLowerCase() === val.toLowerCase());

      if (exists) {
        // silently ignore duplicates – we could toast later
        input.value = "";
        return;
      }

      setup.customCategories.push(val);
      if (canSelectMore()) {
        setup.categories.push(val);
      }
      input.value = "";
      persistSetup();
      updateUI();
      return;
    }

    // Back / Continue
    if (t.id === "setup-back") {
      if (typeof actions.setState === "function") {
        actions.setState("intro");
      }
      return;
    }

    if (t.id === "setup-next") {
      persistSetup();
      if (typeof actions.setState === "function") {
        // Next state will eventually be your "hosts" screen
        actions.setState("hosts");
      }
      return;
    }
  };

  const handleChange = (ev) => {
    const t = ev.target;
    if (!t) return;

    // Category checkbox toggles
    if (t.classList.contains("setup-category-checkbox")) {
      const cat = t.getAttribute("data-category");
      if (!cat) return;

      if (cat === "Food") {
        t.checked = true;
        return;
      }

      if (t.checked) {
        if (!isCategorySelected(cat)) {
          if (!canSelectMore()) {
            t.checked = false;
            return;
          }
          setup.categories.push(cat);
        }
      } else {
        setup.categories = setup.categories.filter(c => c !== cat);
      }

      persistSetup();
      updateUI();
      return;
    }

    // Theme toggle
    if (t.id === "setup-themes") {
      setup.allowThemes = !!t.checked;
      persistSetup();
    }
  };

  root.addEventListener("click", handleClick);
  root.addEventListener("change", handleChange);

  // Cleanup for when router swaps screens
  return () => {
    root.removeEventListener("click", handleClick);
    root.removeEventListener("change", handleChange);
  };
}
