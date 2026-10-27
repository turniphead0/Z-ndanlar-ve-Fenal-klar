/* Masaüstü eklentileri (8): oyunun sistemine göre görsel tema. Renkler ve yazı tipleri temalar.css'te.
   Oyundayken <html data-sys> sistemi, Year Zero'da data-yzp oyunun şablonunu taşır; lobide kalkar. */
(function () {
  "use strict";
  const root = document.documentElement;
  root.lang = root.lang || "tr"; // büyük harf dönüşümünde i → İ
  function apply() {
    const sys = G.id ? sysKey() : "", yzp = sys === "yze" ? S.games[G.id]?.yzePreset || "alien" : "";
    if ((root.dataset.sys || "") !== sys) { if (sys) root.dataset.sys = sys; else delete root.dataset.sys; }
    if ((root.dataset.yzp || "") !== yzp) { if (yzp) root.dataset.yzp = yzp; else delete root.dataset.yzp; }
  }
  const _render = window.render;
  window.render = function () { try { apply(); } catch (err) { console.error(err); } return _render.apply(this, arguments); };
})();
