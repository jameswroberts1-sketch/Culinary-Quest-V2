// path: src/skins/cooking/skin.js
// Cooking skin – lazy-load screens, simple route map, no game-sync imports.

/* ------------ helpers for lazy-loaded screens ------------ */

function pickRenderer(mod) {
  if (!mod) return null;
  if (typeof mod.render === "function") return mod.render;
  if (typeof mod.default === "function") return mod.default;
  for (const k in mod) {
    if (typeof mod[k] === "function") return mod[k];
  }
  return null;
}

function stubRenderer(name) {
  return function render(root) {
    const target = root || document.getElementById("app") || document.body;
    target.innerHTML = `
      <section class="card">
        <h2>${name} (stub)</h2>
        <p>This screen isn't wired yet or failed to load. We'll keep the app running.</p>
      </section>
    `;
  };
}

function safeLoad(relPath, name) {
  try {
    return import(relPath)
      .then((m) => pickRenderer(m) || stubRenderer(name))
      .catch(() => stubRenderer(name));
  } catch (_) {
    return Promise.resolve(stubRenderer(name));
  }
}

/* ------------ skin metadata ------------ */

export const skin = {
  id: "cooking",
  name: "Culinary Quest",
  title: "Culinary Quest",
  tagline: "Cook. Judge. Crown a champion.",
  classes: { paper: "paper--menu" },

  apply(root) {
    (root || document.body).classList.add("skin-cooking");
  },

  // No global header; each screen renders its own logo.
  headerHTML() {
    return "";
  }
};

/* ------------ load CSS for this skin ------------ */

export function loadSkin() {
  // Simple: just append the stylesheet and resolve immediately.
  // (If you want to wait for onload, we can upgrade this later.)
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./src/skins/cooking/skin.css";
  document.head.appendChild(link);
  return Promise.resolve();
}

/* ------------ route table (all as loaders) ------------ */
export const routes = {
  intro: () => safeLoad("./screens/IntroScreen.js", "Intro"),
  lobby: () => safeLoad("./screens/IntroScreen.js", "Intro"),

  setup: () => safeLoad("./screens/SetupScreen.js", "Setup"),
  rsvp:  () => safeLoad("./screens/SetupScreen.js", "Setup"),

  hosts: () => safeLoad("./screens/HostsScreen.js", "Hosts"),
  links: () => safeLoad("./screens/LinksScreen.js", "Links"),

  invite: () => safeLoad("./screens/InviteScreen.js", "Invite"),
  organiserHome: () => safeLoad("./screens/OrganiserHomeScreen.js", "Organiser home"),
  
  // ⬇️ NEW: real tracker screen instead of stub
  rsvpTracker: () => safeLoad("./screens/RsvpTrackerScreen.js", "RSVP tracker"),

  // ⬇️ NEW: host availability checklist
  availability: () => safeLoad("./screens/AvailabilityScreen.js", "Availability"),

  started:  () => Promise.resolve(stubRenderer("Game")),
  finished: () => Promise.resolve(stubRenderer("Results")),

  reset: () =>
    Promise.resolve((root, model, actions) => {
      const target = root || document.getElementById("app") || document.body;
      target.innerHTML =
        '<section class="card"><h2>Resetting…</h2><p>Sending game back to the intro screen.</p></section>';
      if (actions && typeof actions.setState === "function") {
        actions.setState("intro");
      }
    })
};
