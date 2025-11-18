// path: src/skins/cooking/skin.js
// Cooking skin – routes wired directly for Intro + Setup,
// lazy-loaded only for the shared Game/Results components.

import { render as renderIntro } from "./screens/IntroScreen.js";
import { render as renderSetup } from "./screens/SetupScreen.js";

/* ------------ helpers for lazy-loaded shared components ------------ */

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

  // No global header; each screen renders its own logo/card.
  headerHTML() {
    return "";
  }
};

/* ------------ load CSS for this skin ------------ */

export function loadSkin() {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./src/skins/cooking/skin.css";
  document.head.appendChild(link);
  return Promise.resolve();
}

/* ------------ route table ------------ */

export const routes = {
  // Engine "lobby" / "intro" → your Intro screen
  lobby: renderIntro,
  intro: renderIntro,

  // Engine "rsvp" state → your Setup screen
  rsvp:  renderSetup,

  // In-game + results still use the shared components
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
