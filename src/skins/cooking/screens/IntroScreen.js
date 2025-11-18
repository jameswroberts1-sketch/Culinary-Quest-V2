// path: src/skins/cooking/screens/IntroScreen.js
// Intro screen for Culinary Quest – organiser enters their name,
// then we move to the RSVP/Setup phase (scoring + categories + themes).

import { render as renderSetup } from "./SetupScreen.js";

export function render(root, model, actions) {
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

      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
        IntroScreen v4 – JS loaded
      </p>
    </section>
  `;

  const nameInput = root.querySelector("#hostName");
  const beginBtn  = root.querySelector("#begin");

  // Enter submits
  if (nameInput && beginBtn) {
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") beginBtn.click();
    });
  }

  // Actions
  root.addEventListener("click", async (e) => {
    const t = e.target;
    if (!t) return;

    if (t.id === "begin") {
      const name = nameInput ? nameInput.value.trim() : "";
      if (!name && nameInput) {
        nameInput.focus({ preventScroll: true });
        return; // prevent empty organiser
      }

      // Remember on *this device* that the intro has been completed
      try {
        window.localStorage.setItem("cq_intro_done", "1");
        window.localStorage.setItem("cq_organiser_name", name);
      } catch (_) {}

      // 1) Register organiser in the synced game model
      try {
        await actions.join(name);
      } catch (err) {
        console.error("[Intro] actions.join failed", err);
        alert("Sorry, something went wrong saving your name. Please try again.");
        return;
      }

      // 2) Ask the engine to move into the RSVP/Setup phase
      try {
        await actions.setState("rsvp");
      } catch (err) {
        console.error("[Intro] setState('rsvp') failed", err);
        // Even if this fails, fallback below should still show Setup.
      }

      // 3) As a fallback, render Setup directly so you definitely see the next screen
      try {
        renderSetup(root, { ...model, state: "rsvp" }, actions);
      } catch (err) {
        console.error("[Intro] direct renderSetup fallback failed", err);
      }

      // 4) Clear any ?route=… so the router isn't stuck forcing a screen
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
  });

  return () => {};
}
