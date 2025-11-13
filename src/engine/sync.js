// Engine-facing sync with fallback demo mode (no Firebase yet).
import { watch, patch, readOnce, write, uid } from "./firebase.js";

const DEMO = false; // set true to use localStorage demo

export function useGameSync(gid){
  const path = `games/${gid}`;
  if (DEMO && !localStorage.getItem(path)){
    localStorage.setItem(path, JSON.stringify({ st:"lobby", p:[], sched:[], sc:{} }));
  }

  function _read(){ return JSON.parse(localStorage.getItem(path) || "{}"); }
  function _write(obj){ localStorage.setItem(path, JSON.stringify(obj)); }

  function getMeIdx(state){
    const me = uid() || "local";
    const idMap = state?.participants || {};
    if (idMap[me]?.idx != null) return idMap[me].idx;
    return -1;
  }

  return {
    watch(cb){
      if (DEMO){
        cb(_read());
        const iv = setInterval(()=>cb(_read()), 800);
        return ()=>clearInterval(iv);
      }
      return watch(path, cb);
    },
    async join(name){
      if (DEMO){
        const s = _read();
        const idx = s.p.length;
        s.p.push(name||`Guest ${idx+1}`);
        s.sched.push({ iso:"", time:"" });
        _write(s);
        return;
      }
      const s = (await readOnce(path)) || {};
      const me = uid();
      if (!s.participants) s.participants = {};
      if (!s.p) s.p = [];
      if (s.participants[me]) return;
      const idx = s.p.length;
      s.p[idx] = name||`Guest ${idx+1}`;
      if (!s.sched) s.sched = [];
      s.sched[idx] = { iso:"", time:"" };
      await write(path, s);
    },
    async setSchedule(idx, iso, time){
      if (DEMO){
        const s=_read(); s.sched[idx]={iso,time}; _write(s); return;
      }
      const delta = {}; delta[`${path}/sched/${idx}`] = { iso, time };
      await patch("/", delta);
    },
    async score(hostIdx, value){
      const me = uid() || "local";
      if (DEMO){
        const s=_read(); if(!s.sc) s.sc={}; if(!s.sc[hostIdx]) s.sc[hostIdx]={};
        s.sc[hostIdx][me]=Number(value||0); _write(s); return;
      }
      const delta = {}; delta[`${path}/sc/${hostIdx}/${me}`] = Number(value||0);
      await patch("/", delta);
    },
    async setState(st){
      if (DEMO){ const s=_read(); s.st=st; _write(s); return; }
      const delta = {}; delta[`${path}/st`] = st; await patch("/", delta);
    }
  };
}
