// path: src/engine/url.js
// Small URL helpers to keep session/routing logic consistent across screens.

export function stripCqSessionParamsFromUrl() {
  try {
    const url = new URL(window.location.href);
    ["invite", "game", "from", "state", "route"].forEach((k) => url.searchParams.delete(k));
    window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
  } catch (_) {}
}
