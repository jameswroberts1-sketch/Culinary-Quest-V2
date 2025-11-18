// path: src/skins/cooking/screens/SetupScreen.js
// Setup screen – scoring options & themes (layout stub for now)

export function render(root, model, actions) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  const organiserName =
    (typeof window !== "undefined" &&
      window.localStorage &&
      window.localStorage.getItem("cq_organiser_name")) ||
    "Organiser";

  root.innerHTML = `
    <section class="menu-card">
      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">SCORING & THEMES</h2>
        <p class="menu-copy">
          Great, <strong>${organiserName}</strong> – now choose how your Quest will run.
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <section class="menu-section">
        <div class="menu-course">SCORING</div>
        <p class="menu-copy">
          In the final version, this screen will let you choose:
        </p>
        <ol class="menu-steps">
          <li>Simple overall scoring vs. category scoring</li>
          <li>Which categories to include (Food, Menu, Table Setting, Drinks, etc.)</li>
          <li>Up to <strong>3</strong> custom categories of your own</li>
        </ol>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <section class="menu-section">
        <div class="menu-course">THEMES</div>
        <p class="menu-copy">
          You’ll also be able to decide whether hosts can set an optional theme
          for their night (for example: “Mexican Fiesta”, “Feathers & Sparkles”…).
        </p>
      </section>

      <div class="menu-actions">
        <button class="btn btn-secondary" id="backToIntro">Back</button>
        <button class="btn btn-primary" id="continueSetup">Continue</button>
      </div>
    </section>
  `;

  root.addEventListener("click", (e) => {
    const t = e.target;
    if (!t) return;

    if (t.id === "backToIntro") {
      try {
        window.localStorage.removeItem("cq_intro_done");
      } catch (_) {}
      // Ask the backend to stay in 'lobby'; router will now show the intro again
      actions.setState("lobby");
    }

    if (t.id === "continueSetup") {
      // Placeholder – later this will go to the invite/RSVP flow
      // For now we just keep the screen as-is.
      console.log("[CQ] Continue from Setup clicked (stub).");
    }
  });

  return () => {};
}
