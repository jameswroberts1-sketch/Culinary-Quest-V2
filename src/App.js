// TL;DR: picks a skin, mounts engine + components with that skin.
import { createRouter } from "./engine/router.js";
import { useGameSync } from "./engine/sync.js";
import { computeResults } from "./engine/gameLogic.js";

const params = new URL(location.href).searchParams;
const SKIN = params.get("skin") || "cooking";
const GID  = params.get("gid")  || "dev-demo";

const root = document.getElementById("app");
const { skin, loadSkin } = await import(`./skins/${SKIN}/skin.js`);
await loadSkin(); // why: inject CSS/assets per skin

const router = createRouter(root);
const sync = useGameSync(GID);

const actions = {
  join: (name) => sync.join(name),
  rsvp: (idx, iso, time) => sync.setSchedule(idx, iso, time),
  submitScore: (hostIdx, val) => sync.score(hostIdx, val),
  startGame: () => sync.setState("started"),
  endGame: () => sync.setState("finished")
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
