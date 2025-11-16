/* =====================================
   file: src/app.js  (FULL REPLACEMENT)
   ===================================== */
// --- SAFE BOOTSTRAP (never blank) ---
const rootEl = document.getElementById("app") || document.body;

function show(msg){
  try {
    rootEl.innerHTML =
      `<pre style="color:#f66;background:#111;padding:8px;border-radius:8px;white-space:pre-wrap">${msg}</pre>`;
  } catch(e) {}
}

// Put something on screen immediately
try { rootEl.innerHTML = '<div style="font:16px system-ui;padding:12px">Booting…</div>'; } catch(e){}

// Surface all uncaught errors on page
window.addEventListener("error",  e => show(`${e.message}\n${e.filename}:${e.lineno}`));
window.addEventListener("unhandledrejection", e => show(String(e.reason)));
import { createRouter }   from "./engine/router.js";
import { useGameSync }    from "./engine/sync.js";
import { computeResults } from "./engine/gameLogic.js";

// Always show something immediately
const root = document.getElementById("app");
root.innerHTML = '<div style="font:16px system-ui;padding:12px">Booting…</div>';

// Never go blank on errors
window.addEventListener("error", e => {
  root.innerHTML = `<pre style="color:#f66;background:#111;padding:8px;border-radius:8px;white-space:pre-wrap">${e.message}\n${e.filename}:${e.lineno}</pre>`;
});
window.addEventListener("unhandledrejection", e => {
  root.innerHTML = `<pre style="color:#f66;background:#111;padding:8px;border-radius:8px;white-space:pre-wrap">${e.reason}</pre>`;
});

// Lock to cooking skin (maximum compatibility on iOS)
import { skin, loadSkin, routes } from "./skins/cooking/skin.js";

(function bootstrap(){
  const params = new URL(location.href).searchParams;
  const GID    = params.get("gid")   || "dev-demo";
  const ROUTE_OVERRIDE = params.get("route") || "";

  (async function init(){
    await loadSkin();

    const router = createRouter(root);
    router.use(routes);

    const sync = useGameSync(GID);

    // Guard: avoid re-render while typing (prevents iOS input blur)
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

      // TEMP: for development, always show the intro (lobby) screen
      const key = "lobby";
      const hash = stableHash({ st:model.state, p:model.players, sched:model.schedule, sc:model.scores });

      if (key === lastKey && hash === lastHash) return; // preserve focus on iOS
      lastKey  = key;
      lastHash = hash;

      router.route(key, model, actions, skin);
    }

    sync.watch(render);
  })().catch(function(err){
    root.innerHTML = `<pre style="color:#f66;background:#111;padding:8px;border-radius:8px;white-space:pre-wrap">${String(err)}</pre>`;
  });
})();
