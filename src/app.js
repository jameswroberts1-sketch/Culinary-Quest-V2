import { createRouter } from "./engine/router.js";
import { useGameSync } from "./engine/sync.js";
import { computeResults } from "./engine/gameLogic.js";

// ---- diagnostics: show JS errors on the page (otherwise Pages looks "blank")
const root = document.getElementById("app");
const showErr = (msg) => {
  const pre = document.createElement("pre");
  pre.style.cssText = "background:#111;color:#ff6b6b;padding:12px;border-radius:8px;white-space:pre-wrap;max-width:90vw;";
  pre.textContent = msg;
  root.appendChild(pre);
};
window.addEventListener("error", (e) => showErr(`JS error: ${e.message}\n${e.filename}:${e.lineno}`));
window.addEventListener("unhandledrejection", (e) => showErr(`Promise rejection: ${e.reason}`));

const params = new URL(location.href).searchParams;
const SKIN = params.get("skin") || "cooking";
const GID  = params.get("gid")  || "dev-demo";

// ---- load skin first; if this fails you'll see it
let skin, loadSkin;
try {
  ({ skin, loadSkin } = await import(`./skins/${SKIN}/skin.js`));   // RELATIVE + correct case
  await loadSkin();                                                  // injects ./src/skins/<skin>/skin.css
} catch (err) {
  showErr(`Failed to load skin "${SKIN}":\n${err}`);
  throw err;
}

// quick visible proof the shell is alive (replace once routing works)
root.innerHTML = `
  <main class="paper--menu">
    ${skin.headerHTML()}
    <section class="card"><p>Boot OK — loading engine… gid=<strong>${GID}</strong></p></section>
  </main>
`;
skin.hydrateBrand(root);

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
  router.route(model.state, model, actions, skin).catch(err => {
    showErr(`Route load failed for "${model.state}":\n${err}`);
  });
}

// ---- wrap each dynamic import so a missing file shows up on-screen
router.use({
  lobby:   async () => (await import("./components/RSVPScreen.js")).render,
  started: async () => (await import("./components/GameScreen.js")).render,
  finished:async () => (await import("./components/ResultsScreen.js")).render
});

sync.watch(render);

// TIP while debugging: nuke stale SW cache or bump version in sw.js
// if ("serviceWorker" in navigator) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));

