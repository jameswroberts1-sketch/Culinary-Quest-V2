// path: src/skins/cooking/screens/SetupScreen.js
// Setup screen for Culinary Quest – organiser chooses scoring + themes.
// For now this is mostly layout; we'll wire real logic later.

export function render(root, model, actions) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  // Try to personalise with the organiser's name
  let organiserName = "Organiser";
  try {
    const stored = window.localStorage.getItem("cq_organiser_name");
    if (stored && stored.trim()) organiserName = stored.trim();
  } catch (_) {}

  root.innerHTML = `
    <section class="menu-card">
      <!-- HEADER -->
      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">SCORING & THEMES</h2>
        <p class="menu-copy">
          ${organiserName}, this is where you decide how your guests will judge
          each dinner — and whether hosts can set a dress-up theme.
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- SCORING STYLE (stub for now) -->
      <section class="menu-section">
        <div class="menu-course">SCORING</div>
        <p class="menu-copy">
          In the next iteration, you’ll choose between:
        </p>
        <ol class="menu-steps">
          <li>🎯 <strong>Simple scoring</strong> – one overall score (0–10) per guest.</li>
          <li>📊 <strong>Category scoring</strong> – Food plus up to three extra
              categories like Table Setting, Drinks, or Entertainment.</li>
        </ol>
        <p class="menu-copy menu-copy--hint">
          We’ll also let you add your own custom categories, up to a total of four.
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- THEMES (stub for now) -->
      <section class="menu-section">
        <div class="menu-course">THEMES</div>
        <p class="menu-copy">
          You can optionally allow each host to set a theme for their night –
          think “Mexican Fiesta”, “Black & Gold”, or “Feathers & Sequins”.
        </p>
        <p class="menu-copy menu-copy--hint">
          Themes are just for fun: they give guests a hint on how to dress and set
          the tone for the evening.
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- ACTIONS -->
      <div class="menu-actions">
        <button class="btn btn-secondary" id="setup-back">Back</button>
        <button class="btn btn-primary" id="setup-next" disabled>
          Next: Add Contestants
        </button>
      </div>
    </section>
  `;

  // --- Events --------------------------------------------------------

  root.addEventListener("click", (ev) => {
    const t = ev.target;
    if (!t) return;

    // Back → clear intro flag and return to lobby (router decides Intro vs Setup)
    if (t.id === "setup-back") {
      try {
        window.localStorage.removeItem("cq_intro_done");
      } catch (_) {}

      // Ask the engine to go back to the 'lobby' state.
      // Our skin's lobby route will see cq_intro_done is gone
      // and render IntroScreen again.
      actions.setState("lobby");
    }

    // Next – placeholder for later wiring
    if (t.id === "setup-next") {
      // Later this will push into the RSVP / guests flow, e.g.:
      // actions.setState("rsvp");
    }
  });

  return () => {};
}
