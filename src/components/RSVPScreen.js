export function render(root, model, actions){
  root.innerHTML = `
    <h2>Players</h2>
    <ul class="list" id="players"></ul>
    <button class="btn btn-primary" id="join">Join</button>
    <hr style="opacity:.2;margin:12px 0">
    <h2>Schedule</h2>
    <div id="sched"></div>
    <button class="btn btn-secondary" id="start" style="margin-top:8px">Let the games begin</button>
  `;
  const players = root.querySelector("#players");
  const sched = root.querySelector("#sched");
  const draw = ()=>{
    players.innerHTML = model.players.map((n,i)=>`<li>#${i+1} ${n||"—"}</li>`).join("");
    sched.innerHTML = model.schedule.map((s,i)=>`
      <div class="row">
        <span>#${i+1} ${model.players[i]||"—"}</span>
        <input data-i="${i}" type="date" value="${s.iso||""}">
        <input data-i="${i}" type="time" value="${s.time||""}">
      </div>`).join("");
  };
  draw();

  root.addEventListener("click", (e)=>{
    if (e.target.id==="join"){
      const name = prompt("Display name?")?.trim() || "";
      actions.join(name);
    }
    if (e.target.id==="start") actions.setState("started");
  });
  root.addEventListener("change", (e)=>{
    if (e.target.type==="date" || e.target.type==="time"){
      const i = +e.target.dataset.i;
      const row = e.target.closest(".row");
      const iso = row.querySelector('input[type="date"]').value;
      const tim = row.querySelector('input[type="time"]').value || "";
      actions.rsvp(i, iso, tim);
    }
  });

  return ()=>{};
}
