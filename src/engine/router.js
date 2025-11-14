export function createRouter(root){
  let views = {};
  let lastCleanup = null;

  return {
    use(tbl){ views = tbl; },

    async route(key, model, actions, skin){
      const loader = views[key] || views.lobby;
      if (!loader) throw new Error(`No route for "${key}" and no 'lobby' fallback`);
      const render = await loader();

      // Ensure skin-scoped CSS takes effect
      try {
        if (typeof skin?.apply === "function") skin.apply(document.body || root);
      } catch {}

      // Single wrapper; screens render inside #view
      const header = typeof skin?.headerHTML === "function" ? skin.headerHTML() : "";
      root.innerHTML = `<main class="paper--menu">${header}<section id="view"></section></main>`;

      if (typeof skin?.hydrateBrand === "function") skin.hydrateBrand(root);

      if (lastCleanup) try{ lastCleanup(); } catch {}
      const container = root.querySelector("#view") || root;
      const cleanup = render(container, model, actions, skin);
      lastCleanup = typeof cleanup === "function" ? cleanup : null;
    }
  };
}
