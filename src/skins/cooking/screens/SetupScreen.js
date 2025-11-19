// path: src/skins/cooking/screens/SetupScreen.js
// Setup screen – organiser chooses scoring mode, categories, and theme option.

const STORAGE_KEY = "cq_setup_v1";

// Default setup config
const DEFAULT_SETUP = {
  mode: "simple",           // "simple" | "category"
  categories: ["Food"],     // always includes Food
  customCategories: [],     // up to 3 custom
  allowThemes: false
};

// Built-in optional categories (besides "Food")
const BUILT_INS = ["Menu", "Table Setting", "Drinks", "Entertainment"];

export function render(root, model, actions) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  // ---------- hydrate initial setup state ----------
  let setup = { ...DEFAULT_SETUP };

  // 1) from synced model (if present)
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
    } catch (_) {
      // ignore – non-fatal
    }
  }

  // Invariants
  if (!setup.categories.includes("Food")) {
    setup.categories = ["Food", ...setup.categories.filter(c => c !== "Food")].slice(0, 4);
  }
  if (setup.customCategories.length > 3) {
    setup.customCategories = setup.customCategories.slice(0, 3);
  }

  // ---------- helpers to persist + sync ----------
  const persistAndSync = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(setup));
    } catch (_) {}

    if (actions && typeof actions.updateGame === "function") {
      actions.updateGame({ setup });
    }
  };

  const allCategories = () => ["Food", ...BUILT_INS, ...setup.customCategories];

  // ---------- render markup ----------
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

      <!-- ENTREE: heading -->
      <section class="menu-section">
        <div class="menu-course">ENTRÉE</div>
        <h2 class="menu-h2">SCORING &amp; THEMES</h2>
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
  <div
    class="setup-option-card ${setup.mode === "simple" ? "is-selected" : ""}"
    data-mode="simple"
  >
    <div class="setup-option-title">Simple scoring</div>
    <div class="setup-option-body">
      One overall score (0–10) per dinner.
    </div>
  </div>

  <div
    class="setup-option-card ${setup.mode === "category" ? "is-selected" : ""}"
    data-mode="category"
  >
    <div class="setup-option-title">Category scoring</div>
    <div class="setup-option-body">
      Food plus up to 3 extra categories.
    </div>
  </div>
</div>

        <!-- Category selection (only visible in category mode) -->
        <div id="categoryBlock" class="setup-cats-block" style="${
          setup.mode === "category" ? "" : "display:none"
        }">
          <p class="menu-copy">
            <strong>Food</strong> is compulsory. Choose up to <strong>3</strong> extra categories.
          </p>

          <div class="cat-grid" id="catGrid"></div>

          <div class="setup-custom-row">
            <input
              id="customCat"
              class="menu-input"
              type="text"
              placeholder="Add custom category (max 3)"
              maxlength="30"
            />
            <button type="button" class="btn btn-secondary" id="addCustom">Add</button>
          </div>

          <p class="menu-setup-hint">
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
          Allow each host to set a theme (e.g. “Mexican Fiesta”, “Feathers &amp; Fedoras”)
          as a cue for guests.
        </p>

        <div class="theme-toggle-row">
          <label class="theme-toggle-label">
            <input
              id="themeToggle"
              type="checkbox"
              ${setup.allowThemes ? "checked" : ""}
            />
            <span>Allow hosts to set a theme for their night</span>
          </label>
        </div>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <div class="menu-actions">
        <button class="btn btn-secondary" id="setup-back">Back</button>
        <button class="btn btn-primary" id="setup-next">Continue</button>
      </div>

      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
        SetupScreen – scoring, categories &amp; themes wired
      </p>
    </section>
  `;

  // ---------- DOM references ----------
  const catGrid    = root.querySelector("#catGrid");
  const catCountEl = root.querySelector("#catCount");
  const categoryBlock = root.querySelector("#categoryBlock");
  const customInput   = root.querySelector("#customCat");
  const addCustomBtn  = root.querySelector("#addCustom");
  const themeToggle   = root.querySelector("#themeToggle");
  const modesContainer = root.querySelector("#setupModes");

  // ---------- render helpers ----------
  const updateModeUI = () => {
    // highlight selected mode
    modesContainer.querySelectorAll(".setup-mode").forEach(btn => {
      const m = btn.getAttribute("data-mode");
      if (m === setup.mode) {
        btn.classList.add("setup-mode--selected");
      } else {
        btn.classList.remove("setup-mode--selected");
      }
    });

    // toggle category block
    if (setup.mode === "category") {
      categoryBlock.style.display = "";
    } else {
      categoryBlock.style.display = "none";
    }
  };

  const updateCategoryCount = () => {
    if (catCountEl) {
      catCountEl.textContent = String(setup.categories.length);
    }
  };

  const renderCategories = () => {
    if (!catGrid) return;
    const html = allCategories()
      .map(name => {
        const isFood   = name === "Food";
        const isCustom = setup.customCategories.includes(name);
        const checked  = setup.categories.includes(name);

        return `
          <label class="cat-chip ${isFood ? "cat-chip--locked" : ""}">
            <input
              type="checkbox"
              data-cat="${name}"
              ${checked ? "checked" : ""}
              ${isFood ? "disabled" : ""}
            />
            <span>
              ${isFood ? "<strong>Food</strong> <span class=\"lock\">(compulsory)</span>" :
                isCustom ? `${name} <span class="lock">(custom)</span>` :
                name}
            </span>
            ${
              isCustom
                ? `<button type="button" class="btn-ghost" data-remove="${name}">Remove</button>`
                : ""
            }
          </label>
        `;
      })
      .join("");

    catGrid.innerHTML = html;
    updateCategoryCount();
  };

  // initial render of categories
  renderCategories();
  updateModeUI();

  // ---------- event handlers ----------

  const handleModesClick = (ev) => {
    const btn = ev.target.closest(".setup-mode");
    if (!btn) return;
    const mode = btn.getAttribute("data-mode");
    if (mode !== "simple" && mode !== "category") return;
    if (setup.mode === mode) return;

    setup.mode = mode;

    // If switching to simple, collapse categories back to just Food
    if (mode === "simple") {
      setup.categories = ["Food"];
    } else {
      // ensure Food still there
      if (!setup.categories.includes("Food")) {
        setup.categories.unshift("Food");
      }
      setup.categories = setup.categories.slice(0, 4);
    }

    renderCategories();
    updateModeUI();
    persistAndSync();
  };

  const handleCatChange = (ev) => {
    const cb = ev.target;
    if (!(cb instanceof HTMLInputElement)) return;
    if (cb.type !== "checkbox") return;

    const cat = cb.getAttribute("data-cat");
    if (!cat || cat === "Food") {
      // Food is locked via disabled anyway
      cb.checked = true;
      return;
    }

    const currentlySelected = setup.categories.includes(cat);

    if (cb.checked && !currentlySelected) {
      if (setup.categories.length >= 4) {
        // Max reached – revert the checkbox
        cb.checked = false;
        alert("You can only have Food plus up to 3 extra categories.");
        return;
      }
      setup.categories.push(cat);
    } else if (!cb.checked && currentlySelected) {
      setup.categories = setup.categories.filter(c => c !== cat);
    }

    updateCategoryCount();
    persistAndSync();
  };

  const handleCatClick = (ev) => {
    const btn = ev.target.closest("button[data-remove]");
    if (!btn) return;

    const cat = btn.getAttribute("data-remove");
    if (!cat) return;

    // Remove from customs + selected categories
    setup.customCategories = setup.customCategories.filter(c => c !== cat);
    setup.categories       = setup.categories.filter(c => c !== cat);

    renderCategories();
    persistAndSync();
  };

  const handleAddCustom = () => {
    if (!customInput) return;
    const raw = customInput.value.trim();
    if (!raw) return;

    if (setup.customCategories.length >= 3) {
      alert("You can only add up to 3 custom categories.");
      return;
    }

    const existing = new Set(
      ["Food", ...BUILT_INS, ...setup.customCategories].map(c => c.toLowerCase())
    );
    if (existing.has(raw.toLowerCase())) {
      alert("That category already exists.");
      return;
    }

    setup.customCategories.push(raw);

    // If we still have room under the 4-category cap, auto-select it
    if (setup.categories.length < 4) {
      setup.categories.push(raw);
    }

    customInput.value = "";
    renderCategories();
    persistAndSync();
  };

  const handleThemeChange = () => {
    setup.allowThemes = !!themeToggle.checked;
    persistAndSync();
  };

  const handleClick = (ev) => {
    const t = ev.target;
    if (!(t instanceof HTMLElement)) return;

    if (t.id === "setup-back") {
      if (actions && typeof actions.setState === "function") {
        actions.setState("intro");
      }
    }

    if (t.id === "setup-next") {
      // Persist once more then move to next step (hosts list)
      persistAndSync();
      if (actions && typeof actions.setState === "function") {
        actions.setState("hosts");
      }
    }
  };

  // Attach listeners
  if (modesContainer) modesContainer.addEventListener("click", handleModesClick);
  if (catGrid) {
    catGrid.addEventListener("change", handleCatChange);
    catGrid.addEventListener("click", handleCatClick);
  }
  if (addCustomBtn) addCustomBtn.addEventListener("click", handleAddCustom);
  if (themeToggle)  themeToggle.addEventListener("change", handleThemeChange);
  root.addEventListener("click", handleClick);

  // Cleanup when screen is swapped out
  return () => {
    if (modesContainer) modesContainer.removeEventListener("click", handleModesClick);
    if (catGrid) {
      catGrid.removeEventListener("change", handleCatChange);
      catGrid.removeEventListener("click", handleCatClick);
    }
    if (addCustomBtn) addCustomBtn.removeEventListener("click", handleAddCustom);
    if (themeToggle)  themeToggle.removeEventListener("change", handleThemeChange);
    root.removeEventListener("click", handleClick);
  };
}
