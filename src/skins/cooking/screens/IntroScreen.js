// path: src/skins/cooking/screens/IntroScreen.js
// Cooking intro screen WITHOUT the "WELCOME TO CULINARY QUEST" headline.

export function render(root, model, actions) {
  root.innerHTML = `
    <section class="menu-card">
      <div class="menu-hero">
        <img
          class="menu-logo"
          src="./src/skins/cooking/assets/cq-logo.png"
          alt="Culinary Quest"
        />
        <p class="menu-tagline">
          As the organiser of this event, you're hosting the grandest
          dining spectacle your friends have ever seen.
        </p>
      </div>

      <div class="menu-divider" aria-hidden="true"></div>

      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">HOW IT WORKS</h2>
        <p class="menu-copy">
          Choose scoring, add contestants, each picks a unique hosting date.
          After the final dinner, reveal results and crown the winner.
        </p>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <section class="menu-section">
        <div class="menu-course">DESSERT</div>
        <h2 class="menu-h2">YOUR HOST NAME</h2>
        <p class="menu-copy">
          Shown to your guests throughout the competition.
        </p>
        <input id="hostName" class="menu-input"
               type="text"
               placeholder="Your name (visible to all players)"
               autocomplete="name"
               autocapitalize="words"
               inputmode="text"
               enterkeyhint="go" />
      </section>

      <div class="menu-actions">
        <button class="btn btn-primary" id="begin">Begin Planning</button>
        <button class="btn btn-secondary" id="cancel">Cancel</button>
      </div>
    </section>
  `;

  const nameInput = root.querySelector("#hostName");
  const beginBtn  = root.querySelector("#begin");

  // ⬇️ Removed the focusShim and its event listeners

  // Enter submits
  if (nameInput) {
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && beginBtn) beginBtn.click();
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

      await actions.join(name);

      const u = new URL(location.href);
      u.searchParams.delete("route");
      history.replaceState(null, "", u.toString());

      actions.setState("rsvp");
    }

    if (t.id === "cancel" && nameInput) {
      nameInput.value = "";
      nameInput.focus({ preventScroll: true });
    }
  });

  return () => {};
}
