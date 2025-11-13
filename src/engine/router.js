export function createRouter(root){
  let views = {};
  let lastCleanup = null;
  return {
    use(tbl){ views = tbl; },
    async route(key, model, actions, skin){
      const loader = views[key] || views.lobby;
      const render = await loader(); // returns a render(root, model, actions, skin)
      if (lastCleanup) try{ lastCleanup(); } catch {}
      root.innerHTML = `<main class="paper--menu">${skin.headerHTML()}<section class="card" id="view"></section></main>`;
      skin.hydrateBrand(root);
      const viewRoot = root.querySelector("#view");
      lastCleanup = render(viewRoot, model, actions, skin) || (()=>{});
    }
  };
}
