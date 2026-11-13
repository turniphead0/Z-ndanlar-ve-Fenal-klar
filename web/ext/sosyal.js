/* Oyun dışı sosyal özellikler (profil, arkadaşlar, özel mesajlar) masaüstü/web uygulamasında:
   ana ekranın başlığındaki adın yerine profil düğmesi, oyunun sol rayında "Mesajlar" düğmesi.
   İkisi de mobil uygulamanın aynı ekranlarını (/mobil?gomulu=1) bir pencerede açar. */
(function () {
  "use strict";
  if (window.ZM_POP) return;
  const Z = window.zmSunucu; if (!Z) return;
  const sayi = { mesaj: 0, istek: 0 };
  let pano = null;

  const rozet = () => { const n = sayi.mesaj + sayi.istek; return n ? `<b class="zm-srozet">${n > 99 ? "99+" : n}</b>` : ""; };
  const harf = () => { const me = Z.me() || {}; return esc(String(me.kullanici || me.name || "?").charAt(0).toLocaleUpperCase("tr")); };
  function avatar() {
    const me = Z.me() || {};
    return `<span class="zm-sav" style="background:${esc(me.color || "#2f8f86")}">${me.foto ? `<img src="${esc(me.foto)}" alt="">` : harf()}</span>`;
  }

  function ac(rota) {
    if (!Z.hesapli()) { Z.girisEkrani({ kayit: true }); return; }
    if (!pano) {
      pano = document.createElement("div"); pano.className = "zm-spano"; pano.setAttribute("role", "dialog"); pano.setAttribute("aria-label", "Profil ve mesajlar");
      pano.innerHTML = `<iframe title="Profil ve mesajlar" src="/mobil?gomulu=1#${rota || "mesajlar"}"></iframe>`;
      pano.addEventListener("click", e => { if (e.target === pano) kapat(); });
      document.body.appendChild(pano);
    } else { pano.hidden = false; pano.querySelector("iframe").contentWindow.location.hash = rota || "mesajlar"; }
  }
  function kapat() { if (pano) pano.hidden = true; }
  document.addEventListener("keydown", e => { if (e.key === "Escape" && pano && !pano.hidden) kapat(); });
  window.addEventListener("message", e => {
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.zm === "sosyal-kapat") kapat();
    if (e.data.zm === "sosyal-rozet") { sayi.mesaj = e.data.mesaj || 0; sayi.istek = e.data.istek || 0; ciz(); }
  });

  // Ana ekran: başlıktaki adın yerine profil düğmesi.
  const _renderLobby = window.renderLobby;
  if (typeof _renderLobby === "function") window.renderLobby = function () { const r = _renderLobby.apply(this, arguments); ciz(); return r; };
  function ciz() {
    const lme = document.querySelector("#lobby .lme");
    if (lme && !lme.querySelector("[data-zm-sosyal]")) {
      const me = Z.me() || {};
      lme.innerHTML = `<button class="btn zm-sbtn" data-zm-sosyal="profil" title="Profil, arkadaşlar ve mesajlar">${avatar()}<span data-noi18n>${esc(me.kullanici || me.name || "")}</span>${rozet()}</button>`;
    } else if (lme) { const b = lme.querySelector("[data-zm-sosyal]"); const r = b.querySelector(".zm-srozet"); if (r) r.remove(); b.insertAdjacentHTML("beforeend", rozet()); const a = b.querySelector(".zm-sav"); if (a) a.outerHTML = avatar(); }
    const rail = document.querySelector("#app .rail");
    if (rail && !window.ZM_MOBIL) {
      let b = rail.querySelector("[data-zm-sosyal]");
      if (!b) { b = document.createElement("button"); b.className = "navbtn zm-snav"; b.dataset.zmSosyal = "mesajlar"; b.title = "Oyun dışı mesajlar ve arkadaşlar"; rail.appendChild(b); }
      b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 6h18v12H3z"/><path d="M3 7l9 6 9-6"/></svg>Mesajlar${rozet()}`;
    }
  }
  document.addEventListener("click", e => { const b = e.target.closest("[data-zm-sosyal]"); if (b) ac(b.dataset.zmSosyal); });

  // Okunmamış mesaj ve gelen istek sayısı (pencere kapalıyken de).
  Z.ready.then(async () => {
    ciz();
    if (!Z.hesapli()) return;
    const db = Z.db(), me = Z.me().id, konusma = new Map(), ark = new Map();
    const say = () => { sayi.mesaj = [...konusma.values()].reduce((a, k) => a + (k.okunmamis || 0), 0); sayi.istek = [...ark.values()].filter(a => a.durum === "gelen").length; ciz(); };
    db.collection(`data/users/${me}/konusma`).onSnapshot(s => { for (const c of s.docChanges()) c.type === "removed" ? konusma.delete(c.doc.id) : konusma.set(c.doc.id, c.doc.data()); say(); }, () => {});
    db.collection(`data/users/${me}/arkadas`).onSnapshot(s => { for (const c of s.docChanges()) c.type === "removed" ? ark.delete(c.doc.id) : ark.set(c.doc.id, c.doc.data()); say(); }, () => {});
  });
})();
