// path: src/skins/cooking/screens/OrganiserHomeScreen.js
// Simple dashboard for the organiser after setup / RSVPs

const HOSTS_STORAGE_KEY  = "cq_hosts_v1";
const NIGHTS_STORAGE_KEY = "cq_host_nights_v1";

function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadHosts() {
  try {
    const raw = window.localStorage.getItem(HOSTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((h) => ({
      name: h && typeof h.name === "string" ? h.name : ""
    }));
  } catch (_) {
    return [];
  }
}

function loadNights() {
  try {
    const raw = window.localStorage.getItem(NIGHTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
}

export function render(root, model = {}, actions = {}) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  // Always start scrolled to the top
  try {
    const scroller =
      document.scrollingElement ||
      document.documentElement ||
      document.body;
    if (scroller && typeof scroller.scrollTo === "function") {
      scroller.scrollTo({ top: 0, left: 0, behavior: "instant" });
    } else {
      scroller.scrollTop = 0;
      scroller.scrollLeft = 0;
    }
  } catch (_) {}

  const hosts  = loadHosts();
  const nights = loadNights();

  const organiserName =
    (model.organiserName && String(model.organiserName).trim()) ||
    (hosts[0] && hosts[0].name) ||
    "the organiser";

  const totalHosts = hosts.length || 1;

  let accepted = 0;
  let declined = 0;
  let pending  = 0;

  for (let i = 0; i < totalHosts; i++) {
    const n = nights[i];
    if (!n || !n.status) {
      pending++;
      continue;
    }
    if (n.status === "accepted") accepted++;
    else if (n.status === "declined") declined++;
    else pending++;
  }

  const responses = accepted + declined;
  const allResponded = responses === totalHosts;
  const canStartGame = accepted >= 2 && allResponded;

  root.innerHTML = `
    <section class="menu-card">
      <div class="menu-hero">
        <img
          class="menu-logo"
          src="./src/skins/cooking/assets/cq-logo.png"
          alt="Culinary Quest"
        />
      </div>

      <div class="menu-ornament" aria-hidden="true"></div>

      <!-- ENTREE -->
      <section class="menu-section">
        <div class="menu-course">ENTRÉE</div>
        <h2 class="menu-h2">WELCOME, ${esc(organiserName)}</h2>
        <p class="menu-copy">
          This is your organiser dashboard for your current
          <em>Culinary Quest</em>. From here you can check RSVPs,
          edit your host line-up and resend invite links.
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- MAIN -->
      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">GAME SNAPSHOT</h2>
        <p class="menu-copy">
          Hosts in this game: <strong>${totalHosts}</strong><br/>
          Responses received: <strong>${responses}</strong> of ${totalHosts}<br/>
          Accepted: <strong>${accepted}</strong>,
          Declined: <strong>${declined}</strong>,
          Waiting: <strong>${pending}</strong>
        </p>

        <div class="organiser-actions">
          <button class="btn btn-secondary organiser-nav" data-target="rsvpTracker">
            View RSVP tracker
          </button>
          <button class="btn btn-secondary organiser-nav" data-target="hosts">
            Edit hosts
          </button>
          <button class="btn btn-secondary organiser-nav" data-target="links">
            Copy invite links
          </button>
        </div>

        <p class="menu-copy" style="margin-top:16px;">
          When everyone has responded and you're ready to go,
          start the competition.
        </p>

        <button
          class="btn btn-primary organiser-start"
          id="organiserStart"
          ${canStartGame ? "" : "disabled"}
          style="opacity:${canStartGame ? "1" : ".6"};width:100%;margin-top:6px;"
        >
          Let the games begin
        </button>

        ${
          !canStartGame
            ? `<p class="muted" style="margin-top:6px;font-size:12px;">
                 You’ll need at least two accepted hosts and for everyone to respond
                 before you can start.
               </p>`
            : ""
        }
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <div class="menu-actions">
        <button class="btn btn-secondary" id="organiserBack">
          Back to intro
        </button>
      </div>

      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
        OrganiserHomeScreen – dashboard for your current game
      </p>
    </section>
  `;

  const navButtons  = root.querySelectorAll(".organiser-nav");
  const startBtn    = root.querySelector("#organiserStart");
  const backBtn     = root.querySelector("#organiserBack");

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-target");
      if (!target) return;
      try {
        actions.setState && actions.setState(target);
      } catch (_) {}
    });
  });

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      if (!canStartGame) return;
      try {
        actions.setState && actions.setState("started");
      } catch (_) {}
    });
  }

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      // Soft “exit” – in future we might add a proper multi-game home.
      try {
        actions.setState && actions.setState("intro");
      } catch (_) {}
    });
  }
}
