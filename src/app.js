// path: src/app.js  (allow ?route=diag override)
import { createRouter }   from "./engine/router.js";
import { useGameSync }    from "./engine/sync.js";
import { computeResults } from "./engine/gameLogic.js";

const root = document.getElementById("app");
const params = new URL(location.href).searchParams;
const SKIN   = params.get("skin")  || "cooking";
const GID    = params.get("gid")   || "dev-demo";
const ROUTE_OVERRIDE = params.get("route") || "";  // NEW

const { skin, loadSkin, routes } = await import(`./skins/${SKIN}/skin.js`);
await loadSkin();

const router = createRouter(root);
router.use(routes);
const sync = useGameSync(GID);

const actions = {
  join:        (name)           => sync.join(name),
  rsvp:        (idx, iso, time) => sync.setSchedule(idx, iso, time),
  submitScore: (hostIdx, value) => sync.score(hostIdx, value),
  startGame:                    () => sync.setState("started"),
  setState:    (st)             => sync.setState(st)
};

function render(state){
  const model = {
    gid: GID,
    state: state?.st || "lobby",
    players: state?.p || [],
    schedule: state?.sched || [],
    scores: state?.sc || {},
    results: computeResults(state)
  };
  const key = ROUTE_OVERRIDE && routes[ROUTE_OVERRIDE] ? ROUTE_OVERRIDE : model.state; // NEW
  router.route(key, model, actions, skin);
}

sync.watch(render);

// Keep SW off while iterating paths
// if ('serviceWorker' in navigator) navigator.serviceWorker.register('./public/sw.js');
