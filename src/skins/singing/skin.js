export const skin = {
  id: "singing",
  name: "Harmony Quest",
  title: "Harmony Quest",
  tagline: "Sing. Judge. Crown a star.",
  classes: { paper:"paper--stage" },
  apply(root){ root.classList.add("skin-singing"); },
  hydrateBrand(root){
    const img = root.querySelector(".brand__logo");
    if (img) img.src = "/src/skins/singing/assets/logo.jpg";
  },
  headerHTML(){
    return `
      <div class="brand">
        <img class="brand__logo" alt="Harmony Quest logo"/>
        <h1 class="brand__title">Harmony Quest</h1>
        <p class="brand__tag">Sing. Judge. Crown a star.</p>
      </div>
    `;
  }
};
export async function loadSkin(){
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/src/skins/singing/skin.css";
  document.head.appendChild(link);
}
