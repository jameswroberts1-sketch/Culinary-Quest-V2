// Safe, iOS-friendly skin: dynamic-load screens with fallback stubs.
// No import.meta; no top-level await.

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
  var logo = "./src/skins/cooking/assets/CQ%20Logo.png"; // path from index.html
  return (
    '<div class="brand brand--center">' +
      '<img class="brand__logo brand__logo--xl" src="'+logo+'" alt="Culinary Quest logo"/>' +
    '</div>'
  );
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
  lobby:    () => safeLoad("./screens/IntroScreen.js",   "Intro"),
  rsvp:     () => safeLoad("../../components/RSVPScreen.js", "RSVP"),
  started:  () => safeLoad("../../components/GameScreen.js",  "Game"),
  finished: () => safeLoad("../../components/ResultsScreen.js","Results")
};
