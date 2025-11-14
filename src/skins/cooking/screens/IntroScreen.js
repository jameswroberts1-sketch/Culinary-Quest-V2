// ---------------------------------------------
// 2) REPLACE file: src/skins/cooking/screens/IntroScreen.js
// ---------------------------------------------
export function render(root, model, actions) {
  root.innerHTML = `
    <section class="menu-card">
      <h1 class="menu-title">WELCOME TO<br/>CULINARY QUEST</h1>
      <div class="menu-divider" aria-hidden="true"></div>

      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">HOW IT WORKS</h2>
        <p class="menu-copy">
          Choose scoring, add contestants, each picks a unique hosting date.
          After the final dinner, reveal results and crown the winner.
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <section class="menu-section">
        <div class="menu-course">DESSERT</div>
        <h2 class="menu-h2">YOUR HOST NAME</h2>
        <p class="menu-copy">Shown to your guests throughout the competition.</p>
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

  // iOS focus shim: first touch explicitly focuses the input
  const focusShim = (ev) => {
    if (!nameInput) return;
    // if the tap wasn't on a control, move focus into the input
    const target = ev.target;
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLButtonElement)) {
      nameInput.focus({ preventScroll: true });
    }
  };
  root.addEventListener("touchstart", focusShim, { passive: true });
  root.addEventListener("pointerdown", focusShim, { passive: true });

  // Enter key submits
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
      if (!name && nameInput) { nameInput.focus({ preventScroll: true }); return; } // guard
      await actions.join(name);
      actions.setState("rsvp");
    }
    if (t.id === "cancel" && nameInput) {
      nameInput.value = "";
      nameInput.focus({ preventScroll: true });
    }
  });

  return () => {};
}
