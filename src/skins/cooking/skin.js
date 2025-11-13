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
  // path is from index.html (project site → keep it relative)
  link.href = "./src/skins/cooking/skin.css";
  document.head.appendChild(link);
}

// The cooking skin supplies the route -> screen mapping
export const routes = {
  lobby:    async () => (await import("./screens/IntroScreen.js")).render,
  rsvp:     async () => (await import("../../components/RSVPScreen.js")).render,
  started:  async () => (await import("../../components/GameScreen.js")).render,
  finished: async () => (await import("../../components/ResultsScreen.js")).render
};
