// path: src/skins/cooking/screens/SetupScreen.js
// Setup screen – organiser chooses scoring style + theme options (layout stub for now)

export function render(root, model, actions) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

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

      <!-- ENTREE: section label -->
      <section class="menu-section">
        <div class="menu-course">ENTRÉE</div>
        <h2 class="menu-h2">SCORING & THEMES</h2>
        <p class="menu-copy">
          Choose how guests will score each dinner and whether hosts can set a dress-up theme.
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- MAIN: placeholder content – we'll wire the real logic next -->
      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">COMING NEXT</h2>
        <p class="menu-copy">
          This is where you'll pick:
        </p>
        <ol class="menu-steps">
          <li>⚖️ Simple vs category-by-category scoring.</li>
          <li>🍽️ Which scoring categories to include (Food, Table, etc.).</li>
          <li>🎭 Whether each host can set a theme for their night.</li>
        </ol>
        <p class="menu-copy menu-copy--hint">
          For now, use the buttons below to move between the intro and setup screens
          while we refine this step.
        </p>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <div class="menu-actions">
        <button class="btn btn-secondary" id="setup-back">Back</button>
        <button class="btn btn-primary" id="setup-next">Continue</button>
      </div>

      <!-- Tiny dev stamp so you can see when this screen has updated -->
      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
        SetupScreen v4 – JS loaded
      </p>
    </section>
  `;

  // Click handling (delegated on the root)
  root.addEventListener("click", (ev) => {
    const t = ev.target;
    if (!t) return;

    if (t.id === "setup-back") {
      // Go back to the Intro / lobby state
      try {
        actions.setState("lobby");
      } catch (err) {
        console.error("[Setup] setState('lobby') failed", err);
      }
    }

    if (t.id === "setup-next") {
      // For now, keep it simple: this will later become the RSVP / next step.
      try {
        actions.setState("started"); // or "rsvp" once we wire the real flow
      } catch (err) {
        console.error("[Setup] setState('started') failed", err);
      }
    }
  });

  return () => {};
}
