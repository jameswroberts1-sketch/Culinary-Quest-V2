// Robust skin that works with different export styles (render/default/any fn)
import * as IntroMod   from "./screens/IntroScreen.js";
import * as RSVPMod    from "../../components/RSVPScreen.js";
import * as GameMod    from "../../components/GameScreen.js";
import * as ResultsMod from "../../components/ResultsScreen.js";

function pickRenderer(mod){
  if (!mod) return null;
  if (typeof mod.render  === "function") return mod.render;
  if (typeof mod.default === "function") return mod.default;
  for (const k of Object.keys(mod)){
    if (typeof mod[k] === "function") return mod[k]; // last-ditch: first exported fn
  }
  return null;
}

const IntroScreen   = pickRenderer(IntroMod);
const RSVPScreen    = pickRenderer(RSVPMod);
const GameScreen    = pickRenderer(GameMod);
const ResultsScreen = pickRenderer(ResultsMod);

export const skin = {
  id: "cooking",
  name: "Culinary Quest",
  title: "Culinary Quest",
  tagline: "Cook. Judge. Crown a champion.",
  classes: { paper: "paper--menu" },

  apply: function(root){
    (root || document.body).classList.add("skin-cooking");
  },

  // Plain path (iOS-safe)
  headerHTML: function(){
    var logo = "./src/skins/cooking/assets/CQ%20Logo.png"; // relative to index.html
    return (
      '<div class="brand">' +
        '<img class="brand__logo" src="'+logo+'" alt="Culinary Quest logo"/>' +
        '<h1 class="brand__title">Culinary Quest</h1>' +
        '<p class="brand__tag">Cook. Judge. Crown a champion.</p>' +
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

// Routes return whichever renderer we successfully picked
export const routes = {
  lobby:    function(){ return Promise.resolve(IntroScreen);   },
  rsvp:     function(){ return Promise.resolve(RSVPScreen);    },
  started:  function(){ return Promise.resolve(GameScreen);    },
  finished: function(){ return Promise.resolve(ResultsScreen); }
};
