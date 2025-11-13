// src/app.js
import { createRouter }   from "./engine/router.js";
import { useGameSync }    from "./engine/sync.js";
import { computeResults } from "./engine/gameLogic.js";

// --- basic diagnostics so "blank" errors show up
const root = document.getElementById("app");
if (!root) throw new Error("#app not found");
const showErr = (m) => {
  const pre = document.createElement("pre");
  pre.style.cssText = "background:#111;color:#ff6b6b;padding:10px;border-radius:8px;white-space:pre-wrap;max-width:90vw;";
  pre.textContent = m;
  root.appendChild(pre);
};
window.addEventListener("error", e => showErr(`JS error: ${e.message}\n${e.filename}:${e.lineno}`));
window.addEventListener("unhandledrejection", e => showErr(`Promise rejection: ${e.reason}`));

// --- read URL
const params = new URL(location.href).searchParams;
const SKIN = params.get("skin") || "cooking";
const GID  = params.get("gid")  || "dev-demo";

// --- load skin (provides routes + CSS)
const { skin, loadSkin, routes } = await import(`./skins/${SKIN}/skin.js`);
await loadSkin();

// --- router + sync
const router = createRouter(root);
router.use(routes); // skin supplies its own screen loaders
const sync = useGameSync(GID);

// --- app actions passed to screens
const actions = {
  join:        (name)               => sync.join(name),
  rsvp:        (idx, iso, time)     => sync.setSchedule(idx, iso, time),
  submitScore: (hostIdx, value)     => sync.score(hostIdx, value),
  startGame:                        () => sync.setState("started"),
  setState:    (st)                 => sync.setState(st)
};

// --- render loop
function render(state) {
  const model = {
    gid:      GID,
    state:    state?.st || "lobby",
    players:  state?.p || [],
    schedule: state?.sched || [],
    scores:   state?.sc || {},
    results:  computeResults(state)
  };
  // route (e.g., "lobby", "rsvp", "started", "finished")
  router.route(model.state, model, actions, skin).catch(err => showErr(String(err)));
}

// start
sync.watch(render);

// OPTIONAL: enable service worker once paths settle
// if ('serviceWorker' in navigator) navigator.serviceWorker.register('./public/sw.js').catch(console.error);
