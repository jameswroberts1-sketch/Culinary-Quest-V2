// path: src/engine/router.js
export function createRouter(root){
  let views = {};
  let lastCleanup = null;

  return {
    use(tbl){ views = tbl; },

    async route(key, model, actions, skin){
      const loader = views[key] || views.lobby;
      if (!loader) throw new Error(`No route for "${key}" and no 'lobby' fallback`);
      const render = await loader();

      try {
        if (skin && typeof skin.apply === "function") skin.apply(document.body || root);
      } catch (e) {}

      const header = (skin && typeof skin.headerHTML === "function") ? skin.headerHTML() : "";
      root.innerHTML = `<main class="paper--menu">${header}<section id="view"></section></main>`;

      if (skin && typeof skin.hydrateBrand === "function") skin.hydrateBrand(root);

      if (lastCleanup) { try { lastCleanup(); } catch (e) {} }
      const container = root.querySelector("#view") || root;
      const cleanup = render(container, model, actions, skin);
      lastCleanup = (typeof cleanup === "function") ? cleanup : null;
    }
  };
}
