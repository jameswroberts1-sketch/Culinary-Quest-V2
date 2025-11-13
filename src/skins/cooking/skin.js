export const skin = {
  id: "cooking",
  name: "Culinary Quest",
  title: "Culinary Quest",
  tagline: "Cook. Judge. Crown a champion.",
  classes: { paper: "paper--menu" },

  // ensure router can safely render a header
  headerHTML(){
    const logo = new URL("./assets/CQ%20Logo.png", import.meta.url).href; // resolves on GitHub Pages
    return `
      <div class="brand">
        <img class="brand__logo" src="${logo}" alt="Culinary Quest logo"/>
        <h1 class="brand__title">Culinary Quest</h1>
        <p class="brand__tag">Cook. Judge. Crown a champion.</p>
      </div>
    `;
  }
};

export async function loadSkin(){
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./src/skins/cooking/skin.css"; // path from index.html
  document.head.appendChild(link);
}

// cooking routes (unchanged)
export const routes = {
  lobby:    async () => (await import("./screens/IntroScreen.js")).render,
  rsvp:     async () => (await import("../../components/RSVPScreen.js")).render,
  started:  async () => (await import("../../components/GameScreen.js")).render,
  finished: async () => (await import("../../components/ResultsScreen.js")).render
};
