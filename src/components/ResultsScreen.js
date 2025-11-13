export function render(root, model, actions, skin){
  root.classList.add("screen","results");
  root.innerHTML = `
    <main class="wrap ${skin.classes.paper}">
      <header class="brand">${skin.headerHTML()}</header>
      <section class="card">
        <h2>Leaderboard</h2>
        <ol class="list">
          ${model.results.map(r=>`<li><strong>${r.host}</strong> — ${r.total}</li>`).join("")}
        </ol>
        <button class="btn btn-secondary" id="finish">Reset</button>
      </section>
    </main>
  `;
  skin.hydrateBrand(root);
  root.addEventListener("click",(e)=>{ if(e.target.id==="finish") actions.setState?.("lobby"); });
  return ()=>{};
}
