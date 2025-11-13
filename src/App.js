import { createRouter } from "./engine/router.js";
import { useGameSync } from "./engine/sync.js";
import { computeResults } from "./engine/gameLogic.js";

const params = new URL(location.href).searchParams;
const SKIN = params.get("skin") || "cooking";
const GID  = params.get("gid")  || "dev-demo";

const root = document.getElementById("app");
// IMPORTANT: relative dynamic import
const { skin, loadSkin } = await import(`./skins/${SKIN}/skin.js`);
await loadSkin();

const router = createRouter(root);
const sync = useGameSync(GID);

const actions = {
  join: (name) => sync.join(name),
  rsvp: (idx, iso, time) => sync.setSchedule(idx, iso, time),
  submitScore: (hostIdx, val) => sync.score(hostIdx, val),
  startGame: () => sync.setState("started"),
  setState: (st) => sync.setState(st)
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

router.use({
  lobby:      async () => (await import("./components/RSVPScreen.js")).render,
  started:    async () => (await import("./components/GameScreen.js")).render,
  finished:   async () => (await import("./components/ResultsScreen.js")).render
});

sync.watch(render);

// IMPORTANT: relative SW path; bump version inside sw.js when updating
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./public/sw.js").catch(console.error);
}
