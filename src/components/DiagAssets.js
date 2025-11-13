// path: src/components/DiagAssets.js
export async function render(root){
  root.innerHTML = `
    <main class="paper--menu menu-card">
      <h1 class="menu-title">ASSETS SELF-TEST</h1>
      <div class="menu-divider" aria-hidden="true"></div>
      <section class="card">
        <p class="menu-copy">Checking required files with <code>fetch()</code> and dynamic <code>import()</code>. Cache disabled.</p>
        <ul id="results" class="list"></ul>
        <p class="menu-copy" id="sw"></p>
      </section>
    </main>
  `;

  const listEl = root.querySelector('#results');
  const items = [
    { name: 'app.js',                   url: new URL('../src/app.js', location.href).href },
    { name: 'router.js',                url: new URL('../src/engine/router.js', location.href).href },
    { name: 'sync.js',                  url: new URL('../src/engine/sync.js', location.href).href },
    { name: 'skin.js (cooking)',        url: new URL('../src/skins/cooking/skin.js', location.href).href },
    { name: 'skin.css (cooking)',       url: new URL('../src/skins/cooking/skin.css', location.href).href },
    { name: 'IntroScreen.js (cooking)', url: new URL('../src/skins/cooking/screens/IntroScreen.js', location.href).href },
    { name: 'CQ Logo.png',              url: new URL('../src/skins/cooking/assets/CQ%20Logo.png', location.href).href },
    { name: 'Tablecloth.png',           url: new URL('../src/skins/cooking/assets/Tablecloth.png', location.href).href }
  ];

  function li(status, text) {
    const ok = status ? '✅' : '❌';
    const li = document.createElement('li');
    li.innerHTML = `${ok} ${text}`;
    listEl.appendChild(li);
  }

  // fetch() checks
  for (const it of items) {
    try {
      const res = await fetch(it.url + `?ts=${Date.now()}`, { cache: 'no-store' });
      li(res.ok, `${it.name} — ${res.ok ? '200 OK' : res.status + ' ' + res.statusText} (${it.url})`);
    } catch (e) {
      li(false, `${it.name} — fetch failed (${e})`);
    }
  }

  // dynamic import checks for JS modules
  const mods = [
    { name: 'import skin.js',   url: new URL('../src/skins/cooking/skin.js', location.href).href },
    { name: 'import router.js', url: new URL('../src/engine/router.js', location.href).href }
  ];
  for (const m of mods) {
    try {
      await import(m.url + `?ts=${Date.now()}`);
      li(true, `${m.name} — import OK`);
    } catch (e) {
      li(false, `${m.name} — import failed: ${e.message}`);
    }
  }

  // service worker status
  const swEl = root.querySelector('#sw');
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    if (regs.length) {
      swEl.innerHTML = `SW: <strong>${regs.length}</strong> registration(s) found. If paths changed, unregister or bump the SW version.`;
    } else {
      swEl.textContent = 'SW: none registered (good for testing).';
    }
  } else {
    swEl.textContent = 'SW: not supported in this browser context.';
  }

  return ()=>{};
}
