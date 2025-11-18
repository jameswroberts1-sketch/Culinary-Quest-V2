// path: src/skins/cooking/skin.js
// Safe, iOS-friendly skin + router glue for the Cooking theme.

import { render as renderIntro } from "./screens/IntroScreen.js";
import { render as renderSetup } from "./screens/SetupScreen.js";

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
    if (!root) root = document.getElementById("app") || document.body;
    root.innerHTML = `
      <section class="card">
        <h2>${name} (stub)</h2>
        <p>This screen isn't wired yet or failed to load. We'll keep the app running.</p>
      </section>`;
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

export const skin = {
  id: "cooking",
  name: "Culinary Quest",
  title: "Culinary Quest",
  tagline: "Cook. Judge. Crown a champion.",
  classes: { paper: "paper--menu" },

  apply(root) {
    (root || document.body).classList.add("skin-cooking");
  },

  // No global header – each screen draws its own logo
  headerHTML: function () {
    return "";
  }
};

export function loadSkin() {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./src/skins/cooking/skin.css";
  document.head.appendChild(link);
  return Promise.resolve();
}

export const routes = {
  // Single logical state 'lobby':
  //   - before intro completed → IntroScreen
  //   - after intro completed  → SetupScreen
  lobby: function (root, model, actions) {
    if (!root) root = document.getElementById("app") || document.body;

    let introDone = false;
    try {
      introDone =
        window.localStorage.getItem("cq_intro_done") === "1";
    } catch (_) {}

    if (introDone) {
      renderSetup(root, model, actions);
    } else {
      renderIntro(root, model, actions);
    }
  },

  // Game in progress – keep using the existing lazy-loaded screens
  started: () => safeLoad("../../components/GameScreen.js", "Game"),
  finished: () => safeLoad("../../components/ResultsScreen.js", "Results"),

  // Soft reset helper – clears local intro flag and sends state back to lobby
  reset: () =>
    Promise.resolve((root, model, actions) => {
      if (!root) root = document.getElementById("app") || document.body;
      root.innerHTML = `
        <section class="card">
          <h2>Resetting…</h2>
          <p>Sending game back to the intro screen.</p>
        </section>`;

      try {
        window.localStorage.removeItem("cq_intro_done");
        window.localStorage.removeItem("cq_organiser_name");
      } catch (_) {}

      actions.setState("lobby");
    })
};
