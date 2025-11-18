// path: app.js
// Main bootstrap for Culinary Quest – wires sync to the Cooking skin routes.

import { skin, loadSkin, routes } from "./src/skins/cooking/skin.js";
import { useGameSync } from "./src/useGameSync.js"; // <-- adjust path/name if needed

// Root element + simple error renderer
const root = document.getElementById("app") || document.body;

function showError(msg) {
  const target = root || document.body;
  target.innerHTML = `
    <section class="card">
      <h2>Something went wrong</h2>
      <pre style="white-space:pre-wrap;font-size:0.85rem;">${msg}</pre>
    </section>
  `;
}

// Global error hooks
window.addEventListener("error", (e) => {
  showError(`${e.message}\n${e.filename}:${e.lineno}`);
});

window.addEventListener("unhandledrejection", (e) => {
  const reason = e.reason && e.reason.message ? e.reason.message : String(e.reason || "Unknown promise error");
  showError(`Unhandled promise rejection:\n${reason}`);
});

// --- App bootstrap ---

(async function bootstrap() {
  try {
    // 1) Load skin CSS and apply skin class
    await loadSkin();
    skin.apply(root);

    // 2) Initialise sync (Firebase / game state)
    const sync = useGameSync();

    // 3) Wire render loop
    sync.watch(async (model, actions) => {
      try {
        const stateKey = model && model.state ? model.state : "lobby";
        const loader   = routes[stateKey] || routes.lobby;

        // Every route is a loader that returns a renderer
        const renderer = await loader();
        if (typeof renderer === "function") {
          renderer(root, model, actions);
        } else {
          // Fallback stub if something odd comes back
          showError(`Route "${stateKey}" did not return a renderer function.`);
        }
      } catch (err) {
        console.error("[app] render cycle failed", err);
        showError(`Render failed: ${err && err.message ? err.message : String(err)}`);
      }
    });

    // 4) Start sync (starts listening to Firebase or your backend)
    sync.start();
  } catch (err) {
    console.error("[app] bootstrap failed", err);
    showError(`App failed to start:\n${err && err.message ? err.message : String(err)}`);
  }
})();

