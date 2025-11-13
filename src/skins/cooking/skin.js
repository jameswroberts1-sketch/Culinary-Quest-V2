export const skin = {
  id: "cooking",
  name: "Culinary Quest",
  title: "Culinary Quest",
  tagline: "Cook. Judge. Crown a champion.",
  classes: { paper: "paper--menu" }
};

export async function loadSkin(){
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./src/skins/cooking/skin.css";   // path from index.html
  document.head.appendChild(link);
}

export const routes = {
  lobby:   async () => (await import("./screens/IntroScreen.js")).render,
  rsvp:    async () => (await import("./screens/PickDatesScreen.js")).render,
  started: async () => (await import("./screens/GameScreen.js")).render,
  finished:async () => (await import("./screens/ResultsScreen.js")).render
};
