export function totalForHost(scoresObj){
  if (!scoresObj) return 0;
  return Object.values(scoresObj).reduce((a,b)=> a + (Number.isFinite(b)?b:0), 0);
}
export function computeResults(state){
  if (!state || !state.p) return [];
  const rows = state.p.map((name, i)=> ({ hostIdx:i, host:name, total: totalForHost(state.sc?.[i]) }));
  rows.sort((a,b)=> b.total - a.total || a.host.localeCompare(b.host));
  return rows;
}
