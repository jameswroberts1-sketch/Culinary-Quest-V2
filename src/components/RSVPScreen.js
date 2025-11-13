export function render(root, model, actions, skin){
  root.classList.add("screen","rsvp");
  root.innerHTML = `
    <main class="wrap ${skin.classes.paper}">
      <header class="brand">
        <img class="brand__logo" alt="${skin.name} logo" />
        <h1 class="brand__title">${skin.title}</h1>
        <p class="brand__tag">${skin.tagline}</p>
      </header>
      <section class="card">
        <h2>Players</h2>
        <ul class="list" id="players"></ul>
        <button class="btn btn-primary" id="join">Join</button>
      </section>
      <section class="card">
        <h2>Schedule</h2>
        <div id="sched"></div>
        <button class="btn btn-secondary" id="start">Let the games begin</button>
      </section>
    </main>
  `;
  skin.hydrateBrand(root);
  const ul = root.querySelector("#players");
  const sc = root.querySelector("#sched");
  const joinBtn = root.querySelector("#join");
  const startBtn = root.querySelector("#start");

  function draw(){
    ul.innerHTML = model.players.map((n,i)=>`<li>#${i+1} ${n||"—"}</li>`).join("");
    sc.innerHTML = model.schedule.map((s,i)=>`
      <div class="row">
        <span>#${i+1} ${model.players[i]||"—"}</span>
        <input data-i="${i}" type="date" value="${s.iso||""}"/>
        <input data-i="${i}" type="time" value="${s.time||""}"/>
      </div>
    `).join("");
  }
  draw();

  root.addEventListener("change", (e)=>{
    if (e.target.type === "date" || e.target.type === "time"){
      const i = Number(e.target.dataset.i);
      const wrap = e.target.closest(".row");
      const iso = wrap.querySelector('input[type="date"]').value;
      const tim = wrap.querySelector('input[type="time"]').value || "";
      actions.rsvp(i, iso, tim);
    }
  });
  root.addEventListener("click",(e)=>{
    if (e.target===joinBtn){
      const name = prompt("Display name?")?.trim() || "";
      actions.join(name);
    }
    if (e.target===startBtn) actions.startGame();
  });

  return ()=>{}; // cleanup
}
