export function render(root, model, actions){
  root.innerHTML = `
    <h2>Score host</h2>
    <label>Host # <input id="host" type="number" min="0" max="${model.players.length-1}" value="0"></label>
    <label>Score (0–10) <input id="score" type="number" min="0" max="10" value="7"></label>
    <div style="margin-top:8px">
      <button class="btn btn-primary" id="submit">Submit</button>
      <button class="btn btn-secondary" id="finish">Finish</button>
    </div>
  `;
  root.addEventListener("click", e=>{
    if (e.target.id==="submit"){
      actions.submitScore(+root.querySelector("#host").value, +root.querySelector("#score").value);
      alert("Score submitted");
    }
    if (e.target.id==="finish") actions.setState("finished");
  });
  return ()=>{};
}
