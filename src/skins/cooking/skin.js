// path: src/skins/cooking/skin.js  (FULL FILE REPLACEMENT)
import { render as IntroScreen }   from "./screens/IntroScreen.js";
import { render as RSVPScreen }    from "../../components/RSVPScreen.js";
import { render as GameScreen }    from "../../components/GameScreen.js";
import { render as ResultsScreen } from "../../components/ResultsScreen.js";

export const skin = {
  id: "cooking",
  name: "Culinary Quest",
  title: "Culinary Quest",
  tagline: "Cook. Judge. Crown a champion.",
  classes: { paper: "paper--menu" },

  // Ensure skin-scoped CSS applies
  apply: function(root){
    (root || document.body).classList.add("skin-cooking");
  },

  // iOS-safe: avoid import.meta.url; use a plain path relative to index.html
  headerHTML: function(){
    var logo = "./src/skins/cooking/assets/CQ%20Logo.png";
    return (
      '<div class="brand">' +
        '<img class="brand__logo" src="'+logo+'" alt="Culinary Quest logo"/>' +
        '<h1 class="brand__title">Culinary Quest</h1>' +
        '<p class="brand__tag">Cook. Judge. Crown a champion.</p>' +
      '</div>'
    );
  }
};

// Inject skin CSS (path relative to index.html)
export function loadSkin(){
  var link = document.createElement("link");
  link.rel  = "stylesheet";
  link.href = "./src/skins/cooking/skin.css";
  document.head.appendChild(link);
  return Promise.resolve();
}

// Routes: return already-imported renderers
export const routes = {
  lobby:    function(){ return Promise.resolve(IntroScreen);   },
  rsvp:     function(){ return Promise.resolve(RSVPScreen);    },
  started:  function(){ return Promise.resolve(GameScreen);    },
  finished: function(){ return Promise.resolve(ResultsScreen); }
};
