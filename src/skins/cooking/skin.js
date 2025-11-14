export const skin = {
  id: "cooking",
  name: "Culinary Quest",
  title: "Culinary Quest",
  tagline: "Cook. Judge. Crown a champion.",
  classes: { paper: "paper--menu" },

  // Ensures .skin-cooking rules apply
  apply(root){
    (root || document.body).classList.add("skin-cooking");
  },

  // Header used by the router wrapper
  headerHTML(){
    const logo = new URL("./assets/CQ%20Logo.png", import.meta.url).href;
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
  // Path is relative to index.html
  link.href = "./src/skins/cooking/skin.css";
  document.head.appendChild(link);
}

// Skin-owned routes
export const routes = {
  lobby:    async () => (await import("./screens/IntroScreen.js")).render,
  rsvp:     async () => (await import("../../components/RSVPScreen.js")).render,
  started:  async () => (await import("../../components/GameScreen.js")).render,
  finished: async () => (await import("../../components/ResultsScreen.js")).render
}
