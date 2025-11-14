/*****************************************************************
 * file: src/app.js  (FULL REPLACEMENT)
 *****************************************************************/
import { createRouter }   from "./engine/router.js";
import { useGameSync }    from "./engine/sync.js";
import { computeResults } from "./engine/gameLogic.js";

// Always show errors instead of a white screen
const root = document.getElementById("app");
window.addEventListener("error", e => {
  root.innerHTML = `<pre style="color:#f66;background:#111;padding:8px;border-radius:8px;white-space:pre-wrap">${e.message}\n${e.filename}:${e.lineno}</pre>`;
});
window.addEventListener("unhandledrejection", e => {
  root.innerHTML = `<pre style="color:#f66;background:#111;padding:8px;border-radius:8px;white-space:pre-wrap">${e.reason}</pre>`;
});

// Static fallback (safe everywhere)
import * as CookingSkin from "./skins/cooking/skin.js";

// Conservative feature-detect for dynamic import
function supportsDynamicImport(){
  try {
    // Parse-time probe isolated from main scope
    // If unsupported, this throws and we fall back.
    new Function('return import("data:text/javascript,export default 1")');
    return true;
  } catch { return false; }
}

(function bootstrap(){
  const params = new URL(location.href).searchParams;
  const GID    = params.get("gid")   || "dev-demo";
  const SKIN   = params.get("skin")  || "cooking";
  const ROUTE_OVERRIDE = params.get("route") || "";

  (async function init(){
    // Decide which skin module to use
    let mod = CookingSkin; // default fallback
    if (SKIN === "cooking") {
      // Still try dynamic import if supported (helps future cache-busting),
      // but fall back silently to the static module.
      if (supportsDynamicImport()) {
        try { mod = await import("./skins/cooking/skin.js"); } catch { mod = CookingSkin; }
      }
    } else if (supportsDynamicImport()) {
      try { mod = await import(`./skins/${SKIN}/skin.js`); } catch { mod = CookingSkin; }
    } // else: unsupported → cooking fallback

    const skin   = mod.skin;
    const routes = mod.routes;
    await mod.loadSkin();

    const router = createRouter(root);
    router.use(routes);
    const sync = useGameSync(GID);

    // Prevent re-render while typing (keeps iOS keyboard/focus)
    let lastKey = "";
    let lastHash = "";

    const actions = {
      join:        function(name){ return sync.join(name); },
      rsvp:        function(idx, iso, time){ return sync.setSchedule(idx, iso, time); },
      submitScore: function(hostIdx, value){ return sync.score(hostIdx, value); },
      startGame:   function(){ return sync.setState("started"); },
      setState:    function(st){ return sync.setState(st); }
    };

    function stableHash(obj){
      try { return JSON.stringify(obj); } catch (e) { return String(Date.now()); }
    }

    function render(state){
      const model = {
        gid:      GID,
        state:    (state && state.st) || "lobby",
        players:  (state && state.p) || [],
        schedule: (state && state.sched) || [],
        scores:   (state && state.sc) || {},
        results:  computeResults(state)
      };

      const key  = (ROUTE_OVERRIDE && routes[ROUTE_OVERRIDE]) ? ROUTE_OVERRIDE : model.state;
      const hash = stableHash({ st:model.state, p:model.players, sched:model.schedule, sc:model.scores });

      if (key === lastKey && hash === lastHash) return; // preserve focus
      lastKey  = key;
      lastHash = hash;

      router.route(key, model, actions, skin);
    }

    sync.watch(render);
  })().catch(function(err){
    root.innerHTML = `<pre style="color:#f66;background:#111;padding:8px;border-radius:8px;white-space:pre-wrap">${String(err)}</pre>`;
  });
})();
