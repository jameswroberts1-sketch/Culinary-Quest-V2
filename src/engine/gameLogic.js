// Pure functions only
export function totalForHost(scoresObj){
  if (!scoresObj) return 0;
  return Object.values(scoresObj).reduce((a,b)=>a+(Number.isFinite(b)?b:0),0);
}
export function computeResults(state){
  if (!state || !state.p) return [];
  const hosts = state.p.length;
  const rows = Array.from({length:hosts},(_,i)=>({
    hostIdx:i,
    host: state.p[i],
    total: totalForHost(state.sc?.[i])
  }));
  rows.sort((a,b)=> b.total - a.total || a.host.localeCompare(b.host));
  return rows;
}
export function canScore({st}, hostIdx, meIdx){
  if (st !== "started") return false;
  return hostIdx !== meIdx;
}
