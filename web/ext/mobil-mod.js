/* Mobil uygulamadan açılan oyun görünümü (/?mobil=1#<oyun>): harita ve harita düzenleyici gizlenir,
   karakter kağıtları, notlar, savaş, ses, senaryo, zar tepsisi ve masa sohbeti olduğu gibi kalır.
   "← Oyunlar" mobil uygulamanın Masalar sekmesine döner. */
(function () {
  "use strict";
  let on = false;
  try {
    const u = new URL(location.href);
    if (u.searchParams.get("mobil") === "1") sessionStorage.setItem("zm-mobil", "1");
    on = sessionStorage.getItem("zm-mobil") === "1";
  } catch (e) {}
  if (!on || window.ZM_POP) return;
  window.ZM_MOBIL = true;
  document.documentElement.classList.add("zm-mobil");

  const geri = () => { location.href = "/mobil#masalar"; };
  const _toLobby = window.toLobby;
  if (typeof _toLobby === "function") window.toLobby = function () { geri(); };

  const _enter = window.enterGame;
  if (typeof _enter === "function") window.enterGame = function () {
    const r = _enter.apply(this, arguments);
    if (typeof S !== "undefined" && S.view === "harita") { S.view = "karakterler"; window.render(); }
    return r;
  };
  // Eklentiler yüklenirken oyun çoktan açılmış olabilir.
  if (typeof G !== "undefined" && G.id && S.view === "harita") { S.view = "karakterler"; window.render(); }
  // Harita sekmesi yok: DM'ler de karakterlerle başlar, haritaya giden düğmeler karakterlere döner.
  const _render = window.render;
  if (typeof _render === "function") window.render = function () {
    if (typeof S !== "undefined" && S.view === "harita") S.view = "karakterler";
    // Oyun açık değilse (lobi) mobil uygulamaya dön; yalnızca ilk yüklemede masalar gelene dek bekle.
    const r = _render.apply(this, arguments);
    if (typeof G !== "undefined" && !G.id && S.gamesLoaded && !(pendingHash && S.games[pendingHash])) geri();
    return r;
  };
})();
