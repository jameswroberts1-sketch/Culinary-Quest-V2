export function render(root, model, actions, skin){
  root.classList.add("screen","game");
  root.innerHTML = `
    <main class="wrap ${skin.classes.paper}">
      <header class="brand">${skin.headerHTML()}</header>
      <section class="card">
        <h2>Score current host</h2>
        <label>Host # <input id="hostIdx" type="number" min="0" max="${model.players.length-1}" value="0"/></label>
        <label>Score (0–10) <input id="scoreVal" type="number" min="0" max="10" value="7"/></label>
        <button class="btn btn-primary" id="submit">Submit</button>
      </section>
    </main>
  `;
  skin.hydrateBrand(root);
  const hostIdx = root.querySelector("#hostIdx");
  const scoreVal = root.querySelector("#scoreVal");
  const submit = root.querySelector("#submit");
  root.addEventListener("click", async (e)=>{
    if (e.target===submit){
      const hi = Number(hostIdx.value); const sv = Number(scoreVal.value);
      await actions.submitScore(hi, sv);
      alert("Score submitted");
    }
  });
  return ()=>{};
}
