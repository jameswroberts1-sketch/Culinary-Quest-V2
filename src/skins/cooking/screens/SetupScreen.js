// path: src/skins/cooking/screens/SetupScreen.js
// Setup screen – organiser chooses scoring style, categories, and theme option.

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

export function render(root, model = {}, actions) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  /* ---------- hydrate setup state ---------- */

  let setup = { ...DEFAULT_SETUP };

  // 1) merge from synced model if present
  if (model && model.setup && typeof model.setup === "object") {
    setup = { ...setup, ...model.setup };
  } else {
    // 2) fall back to localStorage (dev-friendly)
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === "object") {
          setup = { ...setup, ...saved };
        }
      }
    } catch (_) {}
  }

  // ---- enforce invariants ----
  if (!Array.isArray(setup.categories)) setup.categories = ["Food"];
  setup.categories = setup.categories.filter(Boolean);

  if (!setup.categories.includes("Food")) {
    setup.categories = ["Food", ...setup.categories.filter(c => c !== "Food")];
  }
  setup.categories = setup.categories.slice(0, 4); // Food + up to 3 more

  if (!Array.isArray(setup.customCategories)) setup.customCategories = [];
  setup.customCategories = setup.customCategories.slice(0, 3);

  setup.allowThemes = !!setup.allowThemes;
  if (setup.mode !== "simple" && setup.mode !== "category") {
    setup.mode = "simple";
  }

  const { mode, categories, customCategories, allowThemes } = setup;

  /* ---------- template ---------- */

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

      <!-- ENTREE: overview -->
      <section class="menu-section">
        <div class="menu-course">ENTRÉE</div>
        <h2 class="menu-h2">SCORING & THEMES</h2>
        <p class="menu-copy">
          Choose how your guests will score each dinner, and whether hosts can set a
          dress-up theme.
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

        <!-- scoring mode choices -->
        <div class="setup-choice-group" role="radiogroup" aria-label="Scoring mode">
          <button
            type="button"
            class="setup-choice ${mode === "simple" ? "setup-choice--active" : ""}"
            data-mode="simple"
            aria-pressed="${mode === "simple"}"
          >
            <span class="setup-choice__radio" aria-hidden="true"></span>
            <span class="setup-choice__text">
              <span class="setup-choice__label">Simple scoring</span>
              <span class="setup-choice__hint">
                One overall score (0–10) per dinner.
              </span>
            </span>
          </button>

          <button
            type="button"
            class="setup-choice ${mode === "category" ? "setup-choice--active" : ""}"
            data-mode="category"
            aria-pressed="${mode === "category"}"
          >
            <span class="setup-choice__radio" aria-hidden="true"></span>
            <span class="setup-choice__text">
              <span class="setup-choice__label">Category scoring</span>
              <span class="setup-choice__hint">
                Food plus up to 3 extra categories.
              </span>
            </span>
          </button>
        </div>

        ${
          mode === "category"
            ? `
        <div class="setup-cats">
          <p class="menu-copy">
            <strong>Food</strong> is compulsory. Choose up to 3 extra categories.
          </p>

          <div class="setup-cat-list" aria-label="Scoring categories">
            ${["Food", ...BUILT_INS]
              .map((cat) => {
                const selected = categories.includes(cat);
                const locked = cat === "Food";
                return `
                  <button
                    type="button"
                    class="setup-cat
                      ${selected ? "setup-cat--active" : ""}
                      ${locked ? "setup-cat--locked" : ""}"
                    data-cat="${cat}"
                    ${locked ? 'aria-disabled="true"' : ""}
                  >
                    <span class="setup-cat__box" aria-hidden="true"></span>
                    <span class="setup-cat__label">${cat}</span>
                    ${
                      locked
                        ? '<span class="setup-cat__hint">Compulsory</span>'
                        : ""
                    }
                  </button>
                `;
              })
              .join("")}

            ${customCategories
              .map((cat) => {
                const selected = categories.includes(cat);
                return `
                  <button
                    type="button"
                    class="setup-cat ${
                      selected ? "setup-cat--active" : ""
                    }"
                    data-cat="${cat}"
                  >
                    <span class="setup-cat__box" aria-hidden="true"></span>
                    <span class="setup-cat__label">${cat}</span>
                    <span class="setup-cat__hint">Custom</span>
                  </button>
                `;
              })
              .join("")}
          </div>

          <div class="setup-cat-add">
            <input
              id="setup-custom-input"
              type="text"
              class="menu-input"
              placeholder="Add custom category (max 3)"
              inputmode="text"
              autocomplete="off"
            />
            <button
              type="button"
              class="btn btn-secondary btn-small"
              id="setup-add-custom"
            >
              Add
            </button>
          </div>

          <p class="menu-copy menu-copy--hint">
            Maximum of 4 categories in total (Food + 3 extras).
          </p>
        </div>`
            : ""
        }
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
        <p class="menu-copy">
          Allow hosts to set a theme for their night.
        </p>

        <button
          type="button"
          id="setup-toggle-themes"
          class="setup-toggle ${allowThemes ? "setup-toggle--on" : ""}"
          aria-pressed="${allowThemes}"
        >
          <span class="setup-toggle__switch" aria-hidden="true"></span>
          <span class="setup-toggle__label">
            ${allowThemes ? "Themes enabled" : "Themes disabled"}
          </span>
        </button>
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

  /* ---------- helpers ---------- */

  function persist() {
    // localStorage for dev
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(setup));
    } catch (_) {}

    // push into synced model if available
    if (actions && typeof actions.update === "function") {
      actions.update({ setup });
    }
  }

  const handleClick = (ev) => {
    const btn = ev.target.closest("button");
    if (!btn) return;

    // 1) scoring mode buttons
    const modeVal = btn.dataset.mode;
    if (modeVal === "simple" || modeVal === "category") {
      if (setup.mode !== modeVal) {
        setup.mode = modeVal;
        // reset categories if we go back to simple
        if (modeVal === "simple") {
          setup.categories = ["Food"];
        }
        persist();
      }
      return;
    }

    // 2) category pill clicks
    if (btn.classList.contains("setup-cat")) {
      const cat = btn.dataset.cat;
      if (!cat) return;
      if (cat === "Food") return; // locked

      const isSelected = setup.categories.includes(cat);

      if (isSelected) {
        setup.categories = setup.categories.filter((c) => c !== cat);
      } else {
        if (setup.categories.length >= 4) {
          // already Food + 3, do nothing
          return;
        }
        setup.categories = [...setup.categories, cat];
      }
      persist();
      return;
    }

    // 3) add custom category
    if (btn.id === "setup-add-custom") {
      const input = root.querySelector("#setup-custom-input");
      if (!input) return;

      const value = input.value.trim();
      if (!value) return;

      const allNames = [
        ...setup.categories,
        ...setup.customCategories,
        "Food",
        ...BUILT_INS
      ].map((c) => c.toLowerCase());

      if (allNames.includes(value.toLowerCase())) {
        return; // already exists
      }

      if (setup.customCategories.length >= 3) return;
      if (setup.categories.length >= 4) return;

      setup.customCategories = [...setup.customCategories, value];
      setup.categories = [...setup.categories, value].slice(0, 4);
      input.value = "";
      persist();
      return;
    }

    // 4) theme toggle
    if (btn.id === "setup-toggle-themes") {
      setup.allowThemes = !setup.allowThemes;
      persist();
      return;
    }

    // 5) navigation
    if (btn.id === "setup-back") {
      if (actions && typeof actions.setState === "function") {
        actions.setState("intro");
      }
      return;
    }

    if (btn.id === "setup-next") {
      // Make sure setup is persisted, then move on to host setup
      persist();
      if (actions && typeof actions.setState === "function") {
        actions.setState("hosts");
      }
      return;
    }
  };

  root.addEventListener("click", handleClick);

  return () => {
    root.removeEventListener("click", handleClick);
  };
}
