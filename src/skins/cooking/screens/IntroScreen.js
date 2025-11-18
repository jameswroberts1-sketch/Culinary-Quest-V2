// path: src/skins/cooking/screens/IntroScreen.js
// Intro screen for Culinary Quest – organiser enters their name,
// then we move into the RSVP / setup phase.

export function render(root, model, actions) {
  // Safety: fall back to #app / body if router passes nothing
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

      <!-- Tiny dev stamp so you can see when this screen has updated -->
      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
        IntroScreen v3 – JS loaded
      </p>
    </section>
  `;

  const nameInput = root.querySelector("#hostName");
  const beginBtn  = root.querySelector("#begin");

  // --- Handlers with proper cleanup ---

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && beginBtn) {
      e.preventDefault();
      beginBtn.click();
    }
  };

  const handleClick = async (e) => {
    const t = e.target;
    if (!t) return;

    // BEGIN → join game + move to RSVP / setup phase
    if (t.id === "begin") {
      const name = nameInput ? nameInput.value.trim() : "";
      if (!name && nameInput) {
        nameInput.focus({ preventScroll: true });
        return; // prevent empty organiser
      }

      try {
        // Remember on *this device* that the intro has been completed
        try {
          window.localStorage.setItem("cq_intro_done", "1");
          window.localStorage.setItem("cq_organiser_name", name);
        } catch (_) {
          // storage is best-effort only
        }

        // 1) Register organiser in the synced game model
        await actions.join(name);

        // 2) Move into the RSVP / setup phase.
        //    Important: we use "rsvp" because that's the state
        //    the engine already understands for the setup/RSVP step.
        await actions.setState("rsvp");

        // 3) Clear any ?route=… so the router isn't stuck forcing a screen
        const u = new URL(location.href);
        u.searchParams.delete("route");
        history.replaceState(null, "", u.toString());
      } catch (err) {
        console.error("[Intro] begin failed", err);
        // Minimal user feedback – you can polish this later
        alert("Sorry, something went wrong starting your game. Please try again.");
      }
    }

    // CANCEL → clear & refocus
    if (t.id === "cancel" && nameInput) {
      nameInput.value = "";
      nameInput.focus({ preventScroll: true });
      try {
        window.localStorage.removeItem("cq_intro_done");
        window.localStorage.removeItem("cq_organiser_name");
      } catch (_) {}
    }
  };

  if (nameInput) {
    nameInput.addEventListener("keydown", handleKeyDown);
  }
  root.addEventListener("click", handleClick);

  // Expose cleanup so the router can unmount cleanly
  return () => {
    if (nameInput) {
      nameInput.removeEventListener("keydown", handleKeyDown);
    }
    root.removeEventListener("click", handleClick);
  };
}

