/* Masaüstü eklentileri: masa ekranının (lobi) üst çubuğuna "Masa oyunları" düğmesi.
   Tahta oyunları ayrı sayfada (/oyunlar) açılır, aynı sunucuyu ve aynı kimliği kullanır. */
(function () {
  "use strict";
  function ekle() {
    const bas = document.querySelector("#lobby .lhead");
    if (!bas || bas.querySelector("[data-masa-oyunlari]")) return;
    const a = document.createElement("a");
    a.className = "btn"; a.href = "/oyunlar"; a.dataset.masaOyunlari = "1"; a.style.textDecoration = "none"; a.style.color = "var(--ink)";
    a.title = "Mangala, dama, dokuz taş, Ur, Hnefatafl";
    a.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg> Masa oyunları';
    const yeni = bas.querySelector('[data-lobby="new"]');
    bas.insertBefore(a, yeni || null);
  }
  const _render = window.render;
  window.render = function () { const r = _render.apply(this, arguments); try { ekle(); } catch (e) { console.error(e); } return r; };
  ekle();
})();
