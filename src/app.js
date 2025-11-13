import { createRouter }   from "./engine/router.js";
import { useGameSync }    from "./engine/sync.js";
import { computeResults } from "./engine/gameLogic.js";

const root = document.getElementById("app");
const params = new URL(location.href).searchParams;
const SKIN = params.get("skin") || "cooking";
const GID  = params.get("gid")  || "dev-demo";

// skin provides CSS + routes
const { skin, loadSkin, routes } = await import(`./skins/${SKIN}/skin.js`);
await loadSkin();

const router = createRouter(root);
router.use(routes);                 // <- skin routes here
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
    gid: GID,
    state: state?.st || "lobby",
    players: state?.p || [],
    schedule: state?.sched || [],
    scores: state?.sc || {},
    results: computeResults(state)
  };
  router.route(model.state, model, actions, skin);
}
sync.watch(render);

// Keep SW disabled while paths change; enable later if you wish
// if ('serviceWorker' in navigator) navigator.serviceWorker.register('./public/sw.js');
