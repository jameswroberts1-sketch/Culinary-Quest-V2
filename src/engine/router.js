export function createRouter(root){
  let views = {};
  let lastCleanup = null;
  return {
    use(tbl){ views = tbl; },
    async route(key, model, actions, skin){
      const load = views[key] || views.lobby;
      const render = await load();
      if (lastCleanup) try{ lastCleanup(); }catch{}
      root.innerHTML = ""; skin.apply(root);
      lastCleanup = render(root, model, actions, skin);
    }
  };
}
