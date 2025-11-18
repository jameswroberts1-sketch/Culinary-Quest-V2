// path: src/skins/cooking/skin.js
// Cooking skin – uses lazy loaders for every route (Intro, Setup, etc.)

/* ------------ helpers for lazy-loaded screens ------------ */

function pickRenderer(mod) {
  if (!mod) return null;
  if (typeof mod.render  === "function") return mod.render;
  if (typeof mod.default === "function") return mod.default;
  for (const k in mod) {
    if (typeof mod[k] === "function") return mod[k];
  }
  return null;
}

function stubRenderer(name) {
  return function render(root) {
    const target = root || document.getElementById("app") || document.body;
    target.innerHTML = `
      <section class="card">
        <h2>${name} (stub)</h2>
        <p>This screen isn't wired yet or failed to load. We'll keep the app running.</p>
      </section>
    `;
  };
}

function safeLoad(relPath, name) {
  try {
    return import(relPath)
      .then((m) => pickRenderer(m) || stubRenderer(name))
      .catch(() => stubRenderer(name));
  } catch (e) {
    return Promise.resolve(stubRenderer(name));
  }
}

/* ------------ skin metadata ------------ */

export const skin = {
  id: "cooking",
  name: "Culinary Quest",
  title: "Culinary Quest",
  tagline: "Cook. Judge. Crown a champion.",
  classes: { paper: "paper--menu" },

  apply(root) {
    (root || document.body).classList.add("skin-cooking");
  },

  // No global header; each screen renders its own logo.
  headerHTML: function () {
    return "";
  }
};

/* ------------ load CSS for this skin ------------ */

export function loadSkin() {
  // Slightly smarter loader: resolves when CSS loads (or fails)
  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = "./src/skins/cooking/skin.css";
    link.onload  = () => resolve();
    link.onerror = () => {
      console.error("[skin] Failed to load Cooking skin CSS");
      resolve(); // fail soft – app can still run without skin styles
    };
    document.head.appendChild(link);
  });
}

/* ------------ route table (all as loaders) ------------ */

export const routes = {
  // Intro – organiser name screen
  lobby: () => safeLoad("./screens/IntroScreen.js",  "Intro"),
  intro: () => safeLoad("./screens/IntroScreen.js",  "Intro"), // alias, just in case

  // Setup / RSVP – we reuse the original "rsvp" state for your Setup screen
  rsvp:  () => safeLoad("./screens/SetupScreen.js",  "Setup"),

  // In-game + results
  started:  () => safeLoad("../../components/GameScreen.js",    "Game"),
  finished: () => safeLoad("../../components/ResultsScreen.js", "Results"),

  // Soft reset → bounce back to lobby/intro
  reset: () =>
    Promise.resolve((root, model, actions) => {
      const target = root || document.getElementById("app") || document.body;
      target.innerHTML =
        '<section class="card"><h2>Resetting…</h2><p>Sending game back to the intro screen.</p></section>';
      actions.setState("lobby");
    })
};

