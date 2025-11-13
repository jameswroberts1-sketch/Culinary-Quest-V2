// path: src/skins/cooking/skin.js  (add diag route)
export const skin = {
  id: "cooking",
  name: "Culinary Quest",
  title: "Culinary Quest",
  tagline: "Cook. Judge. Crown a champion.",
  classes: { paper: "paper--menu" },
  headerHTML(){
    const logo = new URL("./assets/CQ%20Logo.png", import.meta.url).href;
    return `
      <div class="brand">
        <img class="brand__logo" src="${logo}" alt="Culinary Quest logo"/>
        <h1 class="brand__title">Culinary Quest</h1>
        <p class="brand__tag">Cook. Judge. Crown a champion.</p>
      </div>`;
  }
};

export async function loadSkin(){
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./src/skins/cooking/skin.css";
  document.head.appendChild(link);
}

export const routes = {
  lobby:    async () => (await import("./screens/IntroScreen.js")).render,
  rsvp:     async () => (await import("../../components/RSVPScreen.js")).render,
  started:  async () => (await import("../../components/GameScreen.js")).render,
  finished: async () => (await import("../../components/ResultsScreen.js")).render,
  diag:     async () => (await import("../../components/DiagAssets.js")).render   // NEW
};
