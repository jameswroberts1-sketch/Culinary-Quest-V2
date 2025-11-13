export const skin = {
  id: "cooking",
  name: "Culinary Quest",
  title: "Culinary Quest",
  tagline: "Cook. Judge. Crown a champion.",
  classes: { paper: "paper--menu" },
  apply(root) { root.classList.add("skin-cooking"); },
  hydrateBrand(root) {
    const img = root.querySelector(".brand__logo");
    // IMPORTANT: path relative to THIS file’s folder
    if (img) img.src = "./assets/logo.jpg";
  },
  headerHTML() {
    return `
      <div class="brand">
        <img class="brand__logo" alt="Culinary Quest logo"/>
        <h1 class="brand__title">Culinary Quest</h1>
        <p class="brand__tag">Cook. Judge. Crown a champion.</p>
      </div>
    `;
  }
};

export async function loadSkin() {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  // IMPORTANT: relative to index.html
  link.href = "./src/skins/cooking/skin.css";
  document.head.appendChild(link);
}
