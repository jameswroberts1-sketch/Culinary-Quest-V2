// path: src/skins/cooking/screens/InviteScreen.js
// Invite screen – what each host sees from their unique link (placeholder for now)

export function render(root, model = {}, actions = {}) {
  if (!root) {
    root = document.getElementById("app") || document.body;
  }

  // Always start this screen scrolled to the top
  try {
    const scroller =
      document.scrollingElement ||
      document.documentElement ||
      document.body;
    scroller.scrollTop = 0;
  } catch (_) {}

  const organiserName =
    model.organiserName ||
    model.hostName ||
    model.name ||
    "your organiser";

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
        <h2 class="menu-h2">YOUR INVITE</h2>
        <p class="menu-copy">
          You've been invited to take part in a home-dining competition hosted by
          <strong>${organiserName}</strong>.
        </p>
      </section>

      <div class="menu-divider" aria-hidden="true"></div>

      <!-- MAIN -->
      <section class="menu-section">
        <div class="menu-course">MAIN</div>
        <h2 class="menu-h2">WHAT HAPPENS NEXT?</h2>
        <p class="menu-copy">
          This is where you'll soon be able to choose your hosting date and, if enabled,
          set a theme for your night before accepting or declining your invite.
        </p>
        <p class="menu-copy">
          For now, this screen is just a placeholder while we wire up the full RSVP flow.
        </p>
      </section>

      <div class="menu-ornament" aria-hidden="true"></div>

      <div class="menu-actions">
        <button class="btn btn-secondary" id="inviteBack">Back</button>
        <button class="btn btn-primary" id="inviteDone">Done</button>
      </div>

      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px;">
        InviteScreen placeholder – per-host RSVP flow coming next
      </p>
    </section>
  `;

  const handleClick = (ev) => {
    const t = ev.target;
    if (!t) return;

    if (t.id === "inviteBack") {
      // organiser likely came from links; guests might just close the tab
      try {
        actions.setState && actions.setState("links");
      } catch (_) {}
      return;
    }

    if (t.id === "inviteDone") {
      // For now, send organiser back to intro/lobby; guests would typically just leave
      try {
        actions.setState && actions.setState("intro");
      } catch (_) {}
      return;
    }
  };

  root.addEventListener("click", handleClick);

  // Cleanup when router unmounts this screen
  return () => {
    root.removeEventListener("click", handleClick);
  };
}
