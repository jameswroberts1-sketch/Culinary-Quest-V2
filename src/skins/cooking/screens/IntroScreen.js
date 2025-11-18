// path: src/skins/cooking/screens/IntroScreen.js
// Intro screen for Culinary Quest – organiser enters their name,
// then we move to the Setup screen (scoring + categories + themes).

export function render(root, model, actions) {
  // ✅ defensive: fall back to #app or <body> if router passes no root
  const container = root || document.getElementById("app") || document.body;

  container.innerHTML = `
    <section class="menu-card">
      <div class="menu-hero">
        <img
          class="menu-logo"
          src="./src/skins/cooking/assets/cq-logo.png"
          alt="Culinary Quest"
        />
      </div>

      <!-- full-width diamond divider under the logo -->
      <div class="menu-ornament" aria-hidden="true"></div>

      <!-- ENTREE + tagline as their own section -->
      <section class="menu-section">
        <div class="menu-course">ENTRÉE</div>
        <p class="menu-tagline">
          As the organiser of this event, you're hosting the grandest
          dining spectacle your friends have ever seen.
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- MAIN: how it works -->
      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">HOW IT WORKS</h2>

        <p class="menu-copy">
          The next few screens will ask you to:
        </p>

        <ol class="menu-steps">
          <li>🎯 Choose your scoring style — single score or category-by-category showdown.</li>
          <li>👥 Add your contestants and send their personalised invite links.</li>
          <li>📅 Wait for RSVPs as each player locks in a unique hosting date.</li>
          <li>🚀 Once the line-up is complete, review the schedule and hit <strong>Start Competition</strong> to launch your Quest.</li>
        </ol>

        <p class="menu-copy menu-copy--hint">
          Optional twist: invite each player to contribute equally towards a prize pot
          for your eventual Culinary Conquistador.
        </p>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <!-- DESSERT: organiser name -->
      <section class="menu-section">
        <div class="menu-course">DESSERT</div>
        <h2 class="menu-h2">YOUR HOST NAME</h2>
        <p class="menu-copy">
          Shown to your guests throughout the competition.
        </p>
        <input
          id="hostName"
          class="menu-input"
          type="text"
          placeholder="Your name (visible to all players)"
          autocomplete="name"
          autocapitalize="words"
          inputmode="text"
          enterkeyhint="go"
        />
      </section>

      <div class="menu-actions">
        <button class="btn btn-primary" id="begin">Begin Planning</button>
        <button class="btn btn-secondary" id="cancel">Cancel</button>
      </div>
    </section>
  `;

  const nameInput = container.querySelector("#hostName");
  const beginBtn  = container.querySelector("#begin");

  // Enter submits
  if (nameInput && beginBtn) {
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") beginBtn.click();
    });
  }

  // Actions
  container.addEventListener("click", async (e) => {
    const t = e.target;
    if (!t) return;

    // BEGIN → join game + move to setup
    if (t.id === "begin") {
      const name = nameInput ? nameInput.value.trim() : "";
      if (!name && nameInput) {
        nameInput.focus({ preventScroll: true });
        return; // prevent empty organiser
      }

      // Register organiser in the synced game model
      await actions.join(name);

      // Clear any ?route=… so the router stops forcing us to intro
      const u = new URL(location.href);
      u.searchParams.delete("route");
      history.replaceState(null, "", u.toString());

      // Move to the Setup screen (scoring + categories + themes)
      actions.setState("rsvp");
    }

    // CANCEL → clear & refocus
    if (t.id === "cancel" && nameInput) {
      nameInput.value = "";
      nameInput.focus({ preventScroll: true });
    }
  });

  return () => {};
}

