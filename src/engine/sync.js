const TICK = 400; // ms
function path(gid){ return `cq/games/${gid}`; }
function initState(){ return { st: "lobby", p: [], sched: [], sc: {} }; }
function read(gid){ return JSON.parse(localStorage.getItem(path(gid)) || "null") || initState(); }
function write(gid, s){ localStorage.setItem(path(gid), JSON.stringify(s)); }

export function useGameSync(gid){
  if (!localStorage.getItem(path(gid))) write(gid, initState());

  return {
    watch(cb){
      cb(read(gid));
      const iv = setInterval(()=> cb(read(gid)), TICK);
      return ()=> clearInterval(iv);
    },
    join(name){
      const s = read(gid);
      s.p.push(name || `Guest ${s.p.length+1}`);
      s.sched.push({ iso:"", time:"" });
      write(gid, s);
    },
    setSchedule(i, iso, time){
      const s = read(gid);
      s.sched[i] = { iso: iso||"", time: time||"" };
      write(gid, s);
    },
    score(hostIdx, val){
      const s = read(gid);
      if (!s.sc[hostIdx]) s.sc[hostIdx] = {};
      const me = "local-" + (s.p.length || 0); // simple local id
      s.sc[hostIdx][me] = Number(val||0);
      write(gid, s);
    },
    setState(st){
      const s = read(gid);
      s.st = st;
      write(gid, s);
    }
  };
}
