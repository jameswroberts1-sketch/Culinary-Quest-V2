// path: src/app.js
import { createRouter }   from "./engine/router.js";
import { useGameSync }    from "./engine/sync.js";
import { computeResults } from "./engine/gameLogic.js";

// Surface errors on-screen so it's never blank
const root = document.getElementById("app");
window.addEventListener("error", e => {
  root.innerHTML = `<pre style="color:#f66;background:#111;padding:8px;border-radius:8px;white-space:pre-wrap">${e.message}\n${e.filename}:${e.lineno}</pre>`;
});
window.addEventListener("unhandledrejection", e => {
  root.innerHTML = `<pre style="color:#f66;background:#111;padding:8px;border-radius:8px;white-space:pre-wrap">${e.reason}</pre>`;
});

(function bootstrap(){
  const params = new URL(location.href).searchParams;
  const SKIN   = params.get("skin")  || "cooking";
  const GID    = params.get("gid")   || "dev-demo";
  const ROUTE_OVERRIDE = params.get("route") || "";

  // no top-level await: wrap in async IIFE
  (async () => {
    const mod = await import(`./skins/${SKIN}/skin.js`);
    const skin   = mod.skin;
    const routes = mod.routes;
    await mod.loadSkin();

    const router = createRouter(root);
    router.use(routes);
    const sync = useGameSync(GID);

    const actions = {
      join:        (name)               => sync.join(name),
      rsvp:        (idx, iso, time)     => sync.setSchedule(idx, iso, time),
      submitScore: (hostIdx, value)     => sync.score(hostIdx, value),
      startGame:                        () => sync.setState("started"),
      setState:    (st)                 => sync.setState(st)
    };

    function render(state){
      const model = {
        gid:      GID,
        state:    (state && state.st) || "lobby",
        players:  (state && state.p) || [],
        schedule: (state && state.sched) || [],
        scores:   (state && state.sc) || {},
        results:  computeResults(state)
      };
      const key = (ROUTE_OVERRIDE && routes[ROUTE_OVERRIDE]) ? ROUTE_OVERRIDE : model.state;
      router.route(key, model, actions, skin);
    }

    sync.watch(render);
  })().catch(err => {
    root.innerHTML = `<pre style="color:#f66;background:#111;padding:8px;border-radius:8px;white-space:pre-wrap">${String(err)}</pre>`;
  });
})();
