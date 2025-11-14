import { createRouter }   from "./engine/router.js";
import { useGameSync }    from "./engine/sync.js";
import { computeResults } from "./engine/gameLogic.js";

// Surface errors on-screen (no more blank page)
const root = document.getElementById("app");
window.addEventListener("error", e => {
  root.innerHTML = `<pre style="color:#f66;background:#111;padding:8px;border-radius:8px;white-space:pre-wrap">${e.message}\n${e.filename}:${e.lineno}</pre>`;
});
window.addEventListener("unhandledrejection", e => {
  root.innerHTML = `<pre style="color:#f66;background:#111;padding:8px;border-radius:8px;white-space:pre-wrap">${e.reason}</pre>`;
});

const params = new URL(location.href).searchParams;
const SKIN   = params.get("skin")  || "cooking";
const GID    = params.get("gid")   || "dev-demo";
const ROUTE_OVERRIDE = params.get("route") || "";  // e.g., &route=rsvp

const { skin, loadSkin, routes } = await import(`./skins/${SKIN}/skin.js`);
await loadSkin();

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
    state:    state?.st || "lobby",
    players:  state?.p || [],
    schedule: state?.sched || [],
    scores:   state?.sc || {},
    results:  computeResults(state)
  };
  const key = (ROUTE_OVERRIDE && routes[ROUTE_OVERRIDE]) ? ROUTE_OVERRIDE : model.state;
  router.route(key, model, actions, skin);
}

sync.watch(render);
