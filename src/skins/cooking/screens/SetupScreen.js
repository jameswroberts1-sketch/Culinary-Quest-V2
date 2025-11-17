// path: src/skins/cooking/screens/SetupScreen.js
// Setup screen: scoring style + categories + theme option

export function render(root, model, actions) {
  // --- 1. Load or initialise local setup state ---------------------------
  const existing = window.__CQ_SETUP__ || {};

  // Always ensure Food is present in categories
  let existingCats = Array.isArray(existing.categories) && existing.categories.length
    ? existing.categories.slice()
    : ["Food"];

  if (!existingCats.includes("Food")) {
    existingCats = ["Food", ...existingCats];
  }

  const setup = {
    scoringMode:
      existing.scoringMode === "categories" ? "categories" : "single",
    categories: existingCats,
    customCategories: Array.isArray(existing.customCategories)
      ? existing.customCategories.slice()
      : [],
    allowTheme:
      typeof existing.allowTheme === "boolean" ? existing.allowTheme : true,
  };

  const builtInCategories = [
    "Food",
    "Menu",
    "Table Setting",
    "Drinks",
    "Entertainment",
  ];

  const maxTotalCategories = 4;
  const maxCustomCategories = 3;

  const isCategoryActive = (cat) => setup.categories.includes(cat);

  const enabledCount = setup.categories.length;

  // helper to render one chip
  function renderCategoryChip(cat, { locked = false, isCustom = false } = {}) {
    const checkedAttr = isCategoryActive(cat) ? "checked" : "";
    const disabledAttr = locked ? "disabled" : "";
    const lockLabel = locked ? '<span class="lock">(compulsory)</span>' : "";
    const removeButton = isCustom
      ? `<button class="btn-ghost menu-chip-remove" type="button" data-remove-cat="${cat}">Remove</button>`
      : "";

    return `
      <label class="cat-chip">
        <input
          type="checkbox"
          class="cat-toggle"
          data-cat="${cat}"
          ${checkedAttr}
          ${disabledAttr}
        />
        <span>${cat} ${lockLabel}</span>
        ${removeButton}
      </label>
    `;
  }

  // --- 2. Build HTML -----------------------------------------------------
  const showCategories = setup.scoringMode === "categories";

  const html = `
    <section class="menu-card">
      <div class="menu-hero">
        <img
          class="menu-logo"
          src="./src/skins/cooking/assets/cq-logo.png"
          alt="Culinary Quest"
        />
      </div>

      <div class="menu-ornament" aria-hidden="true"></div>

      <!-- ENTREE: framing -->
      <section class="menu-section">
        <div class="menu-course">ENTRÉE</div>
        <p class="menu-tagline">
          Before your guests arrive, let’s decide how they’ll be judged –
          and whether your hosts can set a dress-up cue.
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- MAIN: scoring style -->
      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">Scoring Style</h2>

        <p class="menu-copy">
          How do you want your guests to score each host’s night?
        </p>

        <div class="menu-choice-group">
          <label class="menu-choice">
            <input
              type="radio"
              name="scoringMode"
              value="single"
              ${setup.scoringMode === "single" ? "checked" : ""}
            />
            <span>
              <strong>Single overall score</strong><br />
              One score per host — simple, fast and easy to explain.
            </span>
          </label>

          <label class="menu-choice">
            <input
              type="radio"
              name="scoringMode"
              value="categories"
              ${setup.scoringMode === "categories" ? "checked" : ""}
            />
            <span>
              <strong>Category-by-category</strong><br />
              Food plus up to three more categories (preset or custom).
            </span>
          </label>
        </div>
      </section>

      <!-- Categories block: only shown in category mode -->
      <section class="menu-section" style="display: ${
        showCategories ? "block" : "none"
      }">
        <h2 class="menu-h2">Scoring Categories</h2>
        <p class="menu-copy">
          Food is compulsory. Choose up to <strong>4</strong> total categories,
          with up to <strong>3</strong> custom ones.
        </p>

        <div class="cat-grid" id="catGrid">
          ${renderCategoryChip("Food", { locked: true })}

          ${builtInCategories
            .filter((c) => c !== "Food")
            .map((c) => renderCategoryChip(c))
            .join("")}

          ${setup.customCategories
            .map((c) =>
              renderCategoryChip(c, { isCustom: true, locked: false })
            )
            .join("")}
        </div>

        <div class="row" style="margin-top:10px">
          <input
            id="customCat"
            type="text"
            placeholder="${
              setup.customCategories.length >= maxCustomCategories
                ? "Custom category limit reached"
                : "Add custom category"
            }"
            ${setup.customCategories.length >= maxCustomCategories ? "disabled" : ""}
          />
          <button
            id="addCustom"
            class="btn btn-ghost"
            type="button"
            ${setup.customCategories.length >= maxCustomCategories ? "disabled" : ""}
          >
            Add
          </button>
        </div>

        <p class="menu-setup-hint">
          Enabled: <b id="enabledCount">${enabledCount}</b> / ${maxTotalCategories} total
        </p>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <!-- DESSERT: theme option -->
      <section class="menu-section">
        <div class="menu-course">DESSERT</div>
        <h2 class="menu-h2">Host Themes</h2>

        <p class="menu-copy">
          Would you like to let each host choose a theme for their night?
          Think “Mexican Fiesta”, “Black & Gold”, “Feathers” – anything fun
          that gives guests a cue on how to dress.
        </p>

        <label class="menu-choice menu-choice--inline">
          <input
            type="checkbox"
            id="allowTheme"
            ${setup.allowTheme ? "checked" : ""}
          />
          <span>Allow hosts to set a theme for their event</span>
        </label>

        <p class="menu-copy menu-copy--hint">
          Themes are optional for hosts — they can leave it blank or go all in.
        </p>
      </section>

      <div class="menu-actions">
        <button class="btn btn-secondary" id="back">Back</button>
        <button class="btn btn-primary" id="continue">Continue</button>
      </div>
    </section>
  `;

  root.innerHTML = html;

  // --- 3. Wire up behaviour ----------------------------------------------

  // keep global state in sync
  function persist() {
    window.__CQ_SETUP__ = {
      scoringMode: setup.scoringMode,
      categories: setup.categories.slice(),
      customCategories: setup.customCategories.slice(),
      allowTheme: !!setup.allowTheme,
    };
  }

  // scoring mode radios
  const scoringRadios = root.querySelectorAll('input[name="scoringMode"]');
  scoringRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      const val = radio.value === "categories" ? "categories" : "single";
      setup.scoringMode = val;

      if (val === "single") {
        // simple mode: just Food
        setup.categories = ["Food"];
      } else {
        // category mode: ensure Food is included
        if (!setup.categories.includes("Food")) {
          setup.categories.unshift("Food");
        }
      }
      persist();
      // re-render to show/hide the categories block cleanly
      render(root, model, actions);
    });
  });

  // categories grid (toggle built-in + custom)
  const catGrid = root.querySelector("#catGrid");
  if (catGrid) {
    catGrid.addEventListener("change", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.type !== "checkbox" || !target.classList.contains("cat-toggle"))
        return;

      const cat = target.getAttribute("data-cat");
      if (!cat) return;

      if (cat === "Food") {
        // always keep Food on
        target.checked = true;
        return;
      }

      const currentlyOn = setup.categories.includes(cat);

      if (currentlyOn) {
        // turn off
        setup.categories = setup.categories.filter((c) => c !== cat);
      } else {
        // turn on – enforce total limit
        if (setup.categories.length >= maxTotalCategories) {
          // revert checkbox state and bail
          target.checked = false;
          return;
        }
        setup.categories.push(cat);
      }

      const countEl = root.querySelector("#enabledCount");
      if (countEl) countEl.textContent = String(setup.categories.length);

      persist();
    });

    // handle "Remove" button for custom categories
    catGrid.addEventListener("click", (e) => {
      const btn = e.target;
      if (!(btn instanceof HTMLButtonElement)) return;
      if (!btn.classList.contains("menu-chip-remove")) return;

      const cat = btn.getAttribute("data-remove-cat");
      if (!cat) return;

      setup.customCategories = setup.customCategories.filter((c) => c !== cat);
      setup.categories = setup.categories.filter((c) => c !== cat);

      persist();
      // full re-render to rebuild chips properly
      render(root, model, actions);
    });
  }

  // add custom category
  const customInput = root.querySelector("#customCat");
  const addCustomBtn = root.querySelector("#addCustom");

  if (addCustomBtn && customInput) {
    addCustomBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const raw = customInput.value || "";
      const name = raw.trim();
      if (!name) return;

      if (setup.customCategories.length >= maxCustomCategories) {
        return; // silently ignore for now
      }

      const existingAll = new Set(
        [...builtInCategories, ...setup.customCategories, ...setup.categories].map(
          (c) => c.toLowerCase()
        )
      );
      if (existingAll.has(name.toLowerCase())) {
        return; // already exists (built-in or custom)
      }

      setup.customCategories.push(name);

      if (setup.categories.length < maxTotalCategories) {
        setup.categories.push(name);
      }

      customInput.value = "";
      persist();
      render(root, model, actions);
    });
  }

  // allowTheme checkbox
  const allowThemeEl = root.querySelector("#allowTheme");
  if (allowThemeEl instanceof HTMLInputElement) {
    allowThemeEl.addEventListener("change", () => {
      setup.allowTheme = !!allowThemeEl.checked;
      persist();
    });
  }

  // navigation
  const backBtn = root.querySelector("#back");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      // assume "intro" is your IntroScreen state key
      actions.setState("intro");
    });
  }

  const continueBtn = root.querySelector("#continue");
  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      persist();
      // TODO: later you can push setup into your synced game model here
      // e.g. actions.configure(window.__CQ_SETUP__);
      actions.setState("rsvp");
    });
  }

  return () => {};
}
