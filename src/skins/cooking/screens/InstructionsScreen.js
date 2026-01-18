export function render(root, model = {}, actions = {}) {
  const target = root || document.getElementById("cq-main") || document.getElementById("app") || document.body;

  target.innerHTML = `
    <section class="menu-card">
      <section class="menu-section">
        <div class="menu-course">INFO</div>
        <h2 class="menu-h2">INSTRUCTIONS</h2>
        <p class="menu-copy">
          Placeholder for the organiser instructions.
          <br><br>
          We’ll write this once beta testing is complete.
        </p>
      </section>
    </section>
  `;
}
