// path: src/skins/cooking/screens/IntroScreen.js
// Intro screen for Culinary Quest – organiser enters their name,
// then we move to the Setup screen (scoring + categories + themes).

export function render(root, model = {}, actions = {}) {
  // Safety: if router ever calls us with no root, fall back to #app
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
          <li>🚀 Once the line-up is complete, review the schedule and hit
              <strong>Start Competition</strong> to launch your Quest.</li>
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

  const nameInput = root.querySelector("#hostName");
  const beginBtn  = root.querySelector("#begin");

  if (nameInput && beginBtn) {
    // Enter key triggers Begin
    const handleKeyDown = (e) => {
      if (e.key === "Enter") {
        beginBtn.click();
      }
    };
    nameInput.addEventListener("keydown", handleKeyDown);

    // We'll remove this listener in the cleanup below
    // by capturing it in the closure:
    render._cleanupKey = () => {
      nameInput.removeEventListener("keydown", handleKeyDown);
    };
  }

  const handleClick = async (e) => {
    const t = e.target;
    if (!t) return;

    if (t.id === "begin") {
      const name = nameInput ? nameInput.value.trim() : "";
      if (!name && nameInput) {
        nameInput.focus({ preventScroll: true });
        return; // prevent empty organiser
      }

      // Store locally so the next screens can read it if they want
      try {
        window.localStorage.setItem("cq_intro_done", "1");
        window.localStorage.setItem("cq_organiser_name", name);
      } catch (_) {}

      // If the host engine provides a join() action, call it.
      if (actions && typeof actions.join === "function") {
        await actions.join(name);
      }

      // Move to the Setup screen – we use "setup" as the logical state
      if (actions && typeof actions.setState === "function") {
        actions.setState("setup");
      }

      // Clear any ?route=… override from the URL so the router follows state
      try {
        const u = new URL(location.href);
        u.searchParams.delete("route");
        history.replaceState(null, "", u.toString());
      } catch (_) {}
    }

    if (t.id === "cancel" && nameInput) {
      nameInput.value = "";
      nameInput.focus({ preventScroll: true });
      try {
        window.localStorage.removeItem("cq_intro_done");
        window.localStorage.removeItem("cq_organiser_name");
      } catch (_) {}
    }
  };

  root.addEventListener("click", handleClick);

  // Cleanup: remove listeners when this screen is unmounted
  return () => {
    root.removeEventListener("click", handleClick);
    if (render._cleanupKey) {
      render._cleanupKey();
      render._cleanupKey = null;
    }
  };
}
