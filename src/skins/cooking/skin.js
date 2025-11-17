// Safe, iOS-friendly skin: dynamic-load screens with fallback stubs.

import { render as renderIntro } from "./screens/IntroScreen.js";
import { render as renderSetup } from "./screens/SetupScreen.js";

function pickRenderer(mod){
  if (!mod) return null;
  if (typeof mod.render  === "function") return mod.render;
  if (typeof mod.default === "function") return mod.default;
  for (const k in mod) if (typeof mod[k] === "function") return mod[k];
  return null;
}
function stubRenderer(name){
  return function render(root){
    root.innerHTML = `
      <section class="card">
        <h2>${name} (stub)</h2>
        <p>This screen isn't wired yet or failed to load. We'll keep the app running.</p>
      </section>`;
  };
}
function safeLoad(relPath, name){
  try{
    return import(relPath)
      .then(m => pickRenderer(m) || stubRenderer(name))
      .catch(() => stubRenderer(name));
  }catch(e){
    return Promise.resolve(stubRenderer(name));
  }
}

export const skin = {
  id: "cooking",
  name: "Culinary Quest",
  title: "Culinary Quest",
  tagline: "Cook. Judge. Crown a champion.",
  classes: { paper: "paper--menu" },

  apply(root){ (root || document.body).classList.add("skin-cooking"); },

  // Centered logo only (no title/tagline)
headerHTML: function(){
  // No global header in this skin – logo is handled per screen
  return "";
}
};

export function loadSkin(){
  var link = document.createElement("link");
  link.rel  = "stylesheet";
  link.href = "./src/skins/cooking/skin.css";
  document.head.appendChild(link);
  return Promise.resolve();
}

export const routes = {
  intro: renderIntro,
  setup: renderSetup,
  // rsvp: renderRsvp,
  lobby:    () => safeLoad("./screens/IntroScreen.js",   "Intro"),
  rsvp:     () => safeLoad("../../components/RSVPScreen.js", "RSVP"),
  started:  () => safeLoad("../../components/GameScreen.js",  "Game"),
  finished: () => safeLoad("../../components/ResultsScreen.js","Results"),
  reset: () => Promise.resolve((root, model, actions) => {
  root.innerHTML = '<section class="card"><h2>Resetting…</h2><p>Sending game back to the intro screen.</p></section>';
  actions.setState('lobby');   // soft reset to the intro
})

};
