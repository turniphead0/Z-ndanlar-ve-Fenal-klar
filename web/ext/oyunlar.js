/* Masaüstü eklentileri: sol menüye "Masa oyunları" düğmesi. Tahta oyunları ayrı sayfada (/oyunlar) açılır,
   aynı sunucuyu ve aynı kimliği kullanır. */
(function () {
  "use strict";
  const rail = document.querySelector(".rail"), yer = rail && rail.querySelector(".helpbtn");
  if (!rail) return;
  const a = document.createElement("a");
  a.className = "navbtn"; a.href = "/oyunlar"; a.style.textDecoration = "none";
  a.title = "Mangala, dama, dokuz taş, Ur";
  a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/><circle cx="6" cy="6" r="1.4" fill="currentColor"/><circle cx="18" cy="18" r="1.4" fill="currentColor"/></svg>Masa oyunları';
  rail.insertBefore(a, yer || null);
})();
