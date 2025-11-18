// path: src/skins/cooking/skin.js
// Safe, iOS-friendly skin + router wiring for Intro + Setup etc.

import { render as renderIntro } from "./screens/IntroScreen.js";
import { render as renderSetup } from "./screens/SetupScreen.js";

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
  var link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./src/skins/cooking/skin.css";
  document.head.appendChild(link);
  return Promise.resolve();
}

/* ------------ route table ------------ */

export const routes = {
  // New explicit states
  intro: renderIntro,
  setup: renderSetup,

  // Backwards-compatible alias: any old "lobby" state shows Intro
  lobby: renderIntro,

  // Existing screens – still lazy-loaded from components
  rsvp:     () => safeLoad("../../components/RSVPScreen.js",   "RSVP"),
  started:  () => safeLoad("../../components/GameScreen.js",   "Game"),
  finished: () => safeLoad("../../components/ResultsScreen.js","Results"),

  // Soft reset → bounce back to Intro
  reset: () =>
    Promise.resolve((root, model, actions) => {
      const target = root || document.getElementById("app") || document.body;
      target.innerHTML =
        '<section class="card"><h2>Resetting…</h2><p>Sending game back to the intro screen.</p></section>';
      actions.setState("intro");
    })
};
