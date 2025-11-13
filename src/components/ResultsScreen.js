export function render(root, model, actions){
  root.innerHTML = `
    <h2>Leaderboard</h2>
    <ol class="list">
      ${model.results.map(r=>`<li><strong>${r.host}</strong> — ${r.total}</li>`).join("")}
    </ol>
    <button class="btn btn-secondary" id="reset">Back to lobby</button>
  `;
  root.addEventListener("click", e=>{ if (e.target.id==="reset") actions.setState("lobby"); });
  return ()=>{};
}}
