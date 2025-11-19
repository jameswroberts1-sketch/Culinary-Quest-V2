// path: src/skins/cooking/screens/SetupScreen.js
// Setup screen – organiser chooses scoring mode, categories & theme toggle

const STORAGE_KEY = "cq_setup_v2"; // bumped so old experiments don't bleed in

// Default setup config
const DEFAULT_SETUP = {
  mode: "simple",          // "simple" | "category"
  categories: ["Food"],    // Food is always included
  customCategories: [],    // up to 3 custom
  allowThemes: false
};

// Built-in optional categories (besides "Food")
const BUILT_INS = ["Menu", "Table Setting", "Drinks", "Entertainment"];

function hydrateSetup(model) {
  let setup = { ...DEFAULT_SETUP };

  // 1) Prefer any setup already in the shared model
  if (model && model.setup && typeof model.setup === "object") {
    const m = model.setup;
    if (m.mode === "simple" || m.mode === "category") setup.mode = m.mode;
    if (Array.isArray(m.categories)) setup.categories = m.categories.slice();
    if (Array.isArray(m.customCategories)) {
      setup.customCategories = m.customCategories.slice(0, 3);
    }
    if (typeof m.allowThemes === "boolean") {
      setup.allowThemes = m.allowThemes;
    }
  } else {
    // 2) Fall back to localStorage
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === "object") {
          if (saved.mode === "simple" || saved.mode === "category") {
            setup.mode = saved.mode;
          }
          if (Array.isArray(saved.categories)) {
            setup.categories = saved.categories.slice();
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
    setup.categories = ["Food", ...setup.categories.filter((c) => c !== "Food")];
  }
  const extras = setup.categories.filter((c) => c !== "Food");
  if (extras.length > 3) {
    setup.categories = ["Food", ...extras.slice(0, 3)];
  }
  if (setup.customCategories.length > 3) {
    setup.customCategories = setup.customCategories.slice(0, 3);
  }

  return setup;
}

function persistSetup(setup, actions) {
  // Local cache
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(setup));
  } catch (_) {}

  // Try to push into the shared model in a defensive way
  try {
    if (actions && typeof actions.updateSetup === "function") {
      actions.updateSetup(setup);
    } else if (actions && typeof actions.setSetup === "function") {
      actions.setSetup(setup);
    } else if (actions && typeof actions.patch === "function") {
      actions.patch({ setup });
    }
  } catch (_) {
    // non-fatal
  }
}

export function render(root, model = {}, actions = {}) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  let setup = hydrateSetup(model);

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
        <h2 class="menu-h2">SCORING & THEMES</h2>
        <p class="menu-copy">
          Choose how your guests will score each dinner, and whether hosts can set a dress-up theme.
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

        <div class="setup-option-group" id="setupModes">
          <button
            type="button"
            class="setup-option-card ${setup.mode === "simple" ? "is-selected" : ""}"
            data-mode="simple"
          >
            <div class="setup-option-title">Simple scoring</div>
            <div class="setup-option-body">
              One overall score (0–10) per dinner.
            </div>
          </button>

          <button
            type="button"
            class="setup-option-card ${setup.mode === "category" ? "is-selected" : ""}"
            data-mode="category"
          >
            <div class="setup-option-title">Category scoring</div>
            <div class="setup-option-body">
              Food plus up to 3 extra categories.
            </div>
          </button>
        </div>

        <!-- Category selection (only visible for category mode) -->
        <div id="categoryBlock"
             class="setup-categories-block"
             style="${setup.mode === "category" ? "" : "display:none"}">
          <p class="menu-copy">
            <strong>Food</strong> is compulsory. Choose up to <strong>3</strong> extra categories.
          </p>

          <ul class="setup-category-list" id="catList"></ul>

          <div class="setup-custom-row">
            <input
              id="customCat"
              class="setup-custom-input"
              type="text"
              placeholder="Add custom category (max 3)"
              maxlength="30"
            />
            <button type="button" class="btn btn-secondary setup-custom-add" id="addCustom">
              Add
            </button>
          </div>

          <p class="menu-copy menu-setup-hint">
            Selected: <span id="catCount"></span> / 4 total (Food + up to 3 extras).
          </p>
        </div>
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

        <div class="setup-toggle">
          <input
            id="themeToggle"
            type="checkbox"
            ${setup.allowThemes ? "checked" : ""}
          />
          <span>Allow hosts to set a theme for their night</span>
        </div>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <div class="menu-actions">
        <button class="btn btn-secondary" id="setupBack">Back</button>
        <button class="btn btn-primary" id="setupNext">Continue</button>
      </div>

      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
        SetupScreen – scoring, categories & themes wired
      </p>
    </section>
  `;

  const modesEl      = root.querySelector("#setupModes");
  const categoryBlk  = root.querySelector("#categoryBlock");
  const catListEl    = root.querySelector("#catList");
  const catCountEl   = root.querySelector("#catCount");
  const customInput  = root.querySelector("#customCat");

  function ensureInvariants() {
    if (!setup.categories.includes("Food")) {
      setup.categories = ["Food", ...setup.categories.filter((c) => c !== "Food")];
    }
    const extras = setup.categories.filter((c) => c !== "Food");
    if (extras.length > 3) {
      setup.categories = ["Food", ...extras.slice(0, 3)];
    }
    if (setup.customCategories.length > 3) {
      setup.customCategories = setup.customCategories.slice(0, 3);
    }
  }

  function updateModeUI() {
    if (!modesEl) return;
    const cards = modesEl.querySelectorAll(".setup-option-card");
    cards.forEach((card) => {
      if (card.dataset.mode === setup.mode) {
        card.classList.add("is-selected");
      } else {
        card.classList.remove("is-selected");
      }
    });

    if (categoryBlk) {
      categoryBlk.style.display = setup.mode === "category" ? "" : "none";
    }
  }

  function updateCategoryCount() {
    const totalEnabled = setup.categories.length; // includes Food
    if (catCountEl) {
      catCountEl.textContent = `${totalEnabled} / 4`;
    }
  }

  function renderCategories() {
    if (!catListEl) return;

    ensureInvariants();
    const enabledSet = new Set(setup.categories);

    const lines = [];

    // Food – always present, always enabled, visually locked
    lines.push({
      name: "Food",
      compulsory: true,
      custom: false,
      enabled: true
    });

    // Built-ins
    BUILT_INS.forEach((name) => {
      lines.push({
        name,
        compulsory: false,
        custom: false,
        enabled: enabledSet.has(name)
      });
    });

    // Custom categories
    setup.customCategories.forEach((name) => {
      lines.push({
        name,
        compulsory: false,
        custom: true,
        enabled: enabledSet.has(name)
      });
    });

    catListEl.innerHTML = lines
      .map((line) => {
        const { name, compulsory, custom, enabled } = line;
        const disabledAttr = compulsory ? "disabled" : "";
        const checkedAttr  = enabled ? "checked" : "";

        let note = "";
        if (compulsory) {
          note = '<span class="setup-category-note">(compulsory)</span>';
        } else if (custom) {
          note = '<span class="setup-category-note">(custom)</span>';
        }

        const removeBtn = custom
          ? `<button type="button"
                     class="btn setup-custom-remove"
                     data-remove-custom="${name}">
               Remove
             </button>`
          : "";

        return `
          <li class="setup-category-row${compulsory ? " setup-category-row--locked" : ""}">
            <label>
              <input
                type="checkbox"
                class="setup-category-checkbox"
                data-name="${name}"
                ${checkedAttr}
                ${disabledAttr}
              />
              <span class="setup-category-name">
                ${name}
                ${note}
              </span>
            </label>
            ${removeBtn}
          </li>
        `;
      })
      .join("");

    updateCategoryCount();
  }

  // Initial paint
  renderCategories();
  updateModeUI();

  // --- scoring mode clicks (simple vs category) ---

  function setMode(mode) {
    if (mode !== "simple" && mode !== "category") return;
    setup.mode = mode;
    updateModeUI();
    persistSetup(setup, actions);
  }

  const handleModesClick = (ev) => {
    const card = ev.target.closest(".setup-option-card");
    if (!card || !card.dataset.mode) return;
    setMode(card.dataset.mode);
  };

  if (modesEl) {
    modesEl.addEventListener("click", handleModesClick);
  }

  // --- other click handlers ---

  const handleClick = (ev) => {
    const t = ev.target;
    if (!t) return;

    // Add custom category
    if (t.id === "addCustom") {
      if (!customInput) return;
      const raw = customInput.value.trim();
      if (!raw) return;

      const name = raw.replace(/\s+/g, " ").slice(0, 30);
      if (!name) return;

      if (
        name === "Food" ||
        BUILT_INS.includes(name) ||
        setup.customCategories.includes(name)
      ) {
        customInput.value = "";
        return;
      }

      if (setup.customCategories.length >= 3) {
        customInput.value = "";
        return;
      }

      setup.customCategories = [...setup.customCategories, name];

      const extras = setup.categories.filter((c) => c !== "Food");
      if (extras.length < 3) {
        setup.categories = [...setup.categories, name];
      }

      customInput.value = "";
      renderCategories();
      persistSetup(setup, actions);
      return;
    }

    // Remove custom category
    if (t.matches(".setup-custom-remove") && t.dataset.removeCustom) {
      const name = t.dataset.removeCustom;
      setup.customCategories = setup.customCategories.filter((c) => c !== name);
      setup.categories = setup.categories.filter((c) => c !== name);
      renderCategories();
      persistSetup(setup, actions);
      return;
    }

    // Navigation
    if (t.id === "setupBack") {
      try {
        actions.setState && actions.setState("lobby");
      } catch (_) {}
      return;
    }

    if (t.id === "setupNext") {
      ensureInvariants();
      persistSetup(setup, actions);
      try {
        actions.setState && actions.setState("hosts"); // next step: add other hosts
      } catch (_) {}
      return;
    }
  };

  const handleChange = (ev) => {
    const t = ev.target;
    if (!t) return;

    // Theme toggle
    if (t.id === "themeToggle") {
      setup.allowThemes = !!t.checked;
      persistSetup(setup, actions);
      return;
    }

    // Category checkbox toggles
    if (t.classList && t.classList.contains("setup-category-checkbox")) {
      const name = t.dataset.name;
      if (!name || name === "Food") {
        // Food is always on (and usually disabled), so ignore.
        return;
      }

      const checked = !!t.checked;

      if (checked) {
        // Enforce max of 3 extras (Food is implicit)
        const extras = setup.categories.filter((c) => c !== "Food");
        if (extras.length >= 3 && !setup.categories.includes(name)) {
          // Too many – revert the checkbox and bail
          t.checked = false;
          return;
        }
        if (!setup.categories.includes(name)) {
          setup.categories = [...setup.categories, name];
        }
      } else {
        setup.categories = setup.categories.filter((c) => c !== name);
      }

      ensureInvariants();
      updateCategoryCount();
      persistSetup(setup, actions);
    }
  };

  root.addEventListener("click", handleClick);
  root.addEventListener("change", handleChange);

  // Cleanup when router switches screens
  return () => {
    if (modesEl) {
      modesEl.removeEventListener("click", handleModesClick);
    }
    root.removeEventListener("click", handleClick);
    root.removeEventListener("change", handleChange);
  };
}
