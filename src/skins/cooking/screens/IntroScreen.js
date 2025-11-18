// path: src/skins/cooking/screens/IntroScreen.js
// Intro screen – organiser enters their name, then we move to the Setup screen.

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

      <div class="menu-divider" aria-hidden="true"></div>
      
      <!-- DESSERT: OPTIONAL TWIST -->
      <section class="menu-section">
        <div class="menu-course">DESSERT</div>
        <h2 class="menu-h2">OPTIONAL TWIST</h2>
        <p class="menu-copy menu-copy--hint">
          Invite each player to contribute equally towards a prize pot
          for your eventual Culinary Conquistador.
        </p>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <!-- Organiser name -->
      <section class="menu-section">
      /*  <div class="menu-course">DESSERT</div> */
        <h2 class="menu-h2">YOUR HOST NAME</h2>
        <p class="menu-copy">
          Tell us your name, and let's get you started!.
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
        <button class="btn btn-primary" id="begin" type="button">Begin Planning</button>
        <button class="btn btn-secondary" id="cancel" type="button">Cancel</button>
      </div>
    </section>
  `;

  const nameInput = root.querySelector("#hostName");
  const beginBtn  = root.querySelector("#begin");
  const cancelBtn = root.querySelector("#cancel");

  // --- Handlers ----------------------------------------------------

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && beginBtn) {
      e.preventDefault();
      beginBtn.click();
    }
  };

  const handleBeginClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!nameInput) return;

    // Close keyboard / blur field first (helps on iOS)
    const name = nameInput.value.trim();
    nameInput.blur();

    if (!name) {
      nameInput.focus({ preventScroll: true });
      return;
    }

    // Remember locally on this device
    try {
      window.localStorage.setItem("cq_intro_done", "1");
      window.localStorage.setItem("cq_organiser_name", name);
    } catch (_) {}

    // Let the host engine know who the organiser is (if supported)
    if (actions && typeof actions.join === "function") {
      await actions.join(name);
    }

    // Move into Setup
    if (actions && typeof actions.setState === "function") {
      actions.setState("setup");
    }

    // Clear any ?route=… override so router follows state
    try {
      const u = new URL(location.href);
      u.searchParams.delete("route");
      history.replaceState(null, "", u.toString());
    } catch (_) {}
  };

  const handleCancelClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!nameInput) return;
    nameInput.value = "";
    nameInput.focus({ preventScroll: true });

    try {
      window.localStorage.removeItem("cq_intro_done");
      window.localStorage.removeItem("cq_organiser_name");
    } catch (_) {}
  };

  // --- Wire listeners ----------------------------------------------

  if (nameInput) {
    nameInput.addEventListener("keydown", handleKeyDown);
  }
  if (beginBtn) {
    beginBtn.addEventListener("click", handleBeginClick);
  }
  if (cancelBtn) {
    cancelBtn.addEventListener("click", handleCancelClick);
  }

  // Cleanup when the screen is unmounted
  return () => {
    if (nameInput) {
      nameInput.removeEventListener("keydown", handleKeyDown);
    }
    if (beginBtn) {
      beginBtn.removeEventListener("click", handleBeginClick);
    }
    if (cancelBtn) {
      cancelBtn.removeEventListener("click", handleCancelClick);
    }
  };
}
