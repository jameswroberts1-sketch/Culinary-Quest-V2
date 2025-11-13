// Cooking-only organiser intro (menu-style welcome)
export function render(root, model, actions) {
  // Resolves correctly on GitHub Pages (no path headaches)
  const logoURL = new URL("../assets/CQ%20Logo.png", import.meta.url).href;

  root.innerHTML = `
    <main class="paper--menu menu-card">
      <header class="menu-hero">
        <img class="menu-logo" alt="Culinary Quest logo" src="${logoURL}"/>
        <div class="menu-script">Culinary Quest</div>
      </header>

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
    </main>
  `;

  root.addEventListener("click", async (e) => {
    if (e.target.id === "begin") {
      const name = root.querySelector("#hostName").value.trim();
      if (!name) { root.querySelector("#hostName").focus(); return; }
      await actions.join(name);        // organiser joins
      actions.setState("rsvp");        // go to date-picking screen
    }
    if (e.target.id === "cancel") {
      root.querySelector("#hostName").value = "";
    }
  });

  return () => {};
}
