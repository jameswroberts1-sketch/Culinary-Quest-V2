// path: src/skins/cooking/screens/IntroScreen.js
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
        <input id="hostName" class="menu-input" type="text"
               placeholder="Your name (visible to all players)" autocomplete="name"/>
      </section>

      <div class="menu-actions">
        <button class="btn btn-primary" id="begin">Begin Planning</button>
        <button class="btn btn-secondary" id="cancel">Cancel</button>
      </div>
    </section>
  `;

  const nameInput = root.querySelector("#hostName");
  if (nameInput) {
    nameInput.addEventListener("keydown", (e)=>{
      if (e.key === "Enter") {
        const btn = root.querySelector("#begin");
        if (btn) btn.click();
      }
    });
  }

  root.addEventListener("click", async (e) => {
    if (e.target && e.target.id === "begin") {
      const name = nameInput ? nameInput.value.trim() : "";
      if (!name && nameInput) { nameInput.focus(); return; }
      await actions.join(name);
      actions.setState("rsvp");
    }
    if (e.target && e.target.id === "cancel" && nameInput) {
      nameInput.value = "";
    }
  });

  return ()=>{};
}
