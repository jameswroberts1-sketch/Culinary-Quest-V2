/* =========================================
   file: src/debug.js  (NEW)
   Shows environment + fetch/import checks
   ========================================= */
(function(){
  var out = document.getElementById("out");
  function line(s){ out.innerHTML += "<div>"+s+"</div>"; }

  line("UA: " + navigator.userAgent);

  // Basic capability checks
  var esm = !!document.createElement("script").noModule === false;
  line("ES Modules supported: " + esm);

  // Try fetching critical files
  var base = location.href.replace(/\/debug\.html.*/,"/");
  var urls = [
    "src/app.js",
    "src/engine/router.js",
    "src/skins/cooking/skin.js",
    "src/skins/cooking/skin.css",
    "src/skins/cooking/screens/IntroScreen.js",
    "src/skins/cooking/assets/CQ%20Logo.png"
  ];
  (async function(){
    for (var u of urls){
      try{
        var res = await fetch(base + u + "?ts=" + Date.now(), { cache:"no-store" });
        line((res.ok ? "✅" : "❌") + " fetch " + u + " → " + res.status);
      }catch(e){
        line("❌ fetch " + u + " → " + e);
      }
    }
  })();
})();
