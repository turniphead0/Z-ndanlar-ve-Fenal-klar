/* Bütün sayfalarda ortak parçalar (/, /oyunlar, /forum, /profil; /mobil yalnızca görünüm ayarlarını alır):
   - Üst menü: Masalar, Masa oyunları, Forum, Mesajlar, Profil + arama ve bildirim zili. Oyun masasında gizlenir.
   - Genel arama (Ctrl+K): oyuncular, masalar ve forum konuları tek kutudan (sunucuda: server/arama.js).
   - Kişi kartı: bir kullanıcı adının üstüne gelince fotoğraf, çevrimiçi durumu ve "Mesaj gönder".
   - Görünüm: açık/koyu tema ve yazı boyutu. Bu cihazda saklanır (localStorage), bütün sekmelere hemen yansır.
   Bu betik <head>'de yüklenir: tema sayfa çizilmeden uygulanır. Geri kalanı sayfa yüklenince kurulur. */
(function () {
  "use strict";
  if (window.zmOrtak) return;
  const LS = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const root = document.documentElement;

  /* ================= Görünüm: tema ve yazı boyutu ================= */
  const TEMALAR = [["sistem", "Sistem", "◐"], ["acik", "Açık", "☀"], ["koyu", "Koyu", "☾"]];
  const YAZILAR = [["kucuk", "Küçük", "A−"], ["normal", "Normal", "A"], ["buyuk", "Büyük", "A+"], ["cokbuyuk", "Çok büyük", "A++"]];
  const tema = () => (TEMALAR.some(t => t[0] === LS.get("zm-tema")) ? LS.get("zm-tema") : "sistem");
  const yazi = () => (YAZILAR.some(t => t[0] === LS.get("zm-yazi")) ? LS.get("zm-yazi") : "normal");
  function gorunumUygula() {
    const t = tema(), y = yazi();
    if (t === "acik") root.dataset.theme = "light"; else if (t === "koyu") root.dataset.theme = "dark"; else delete root.dataset.theme;
    if (y === "normal") delete root.dataset.yazi; else root.dataset.yazi = y;
    for (const el of document.querySelectorAll("[data-zo-gorunum-seg]")) segBoya(el);
  }
  function ayarla(k, v) { LS.set(k === "tema" ? "zm-tema" : "zm-yazi", v); gorunumUygula(); }
  gorunumUygula();
  // Başka sekmede (ya da mesajlar penceresinde) değişirse burada da uygula.
  window.addEventListener("storage", e => { if (e.key === "zm-tema" || e.key === "zm-yazi") gorunumUygula(); });

  const segHtml = tur => {
    const l = tur === "tema" ? TEMALAR : YAZILAR, cur = tur === "tema" ? tema() : yazi();
    return `<div class="zo-seg" role="group" aria-label="${tur === "tema" ? "Tema" : "Yazı boyutu"}" data-zo-gorunum-seg="${tur}">${l.map(([k, ad, s]) =>
      `<button type="button" data-zo-set="${tur}" data-v="${k}" aria-pressed="${k === cur}" title="${ad}"><span aria-hidden="true">${s}</span>${tur === "tema" ? ` ${ad}` : `<span class="zo-gizli" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">${ad}</span>`}</button>`).join("")}</div>`;
  };
  function segBoya(el) { const cur = el.dataset.zoGorunumSeg === "tema" ? tema() : yazi(); for (const b of el.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.v === cur)); }
  document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-zo-set]"); if (b) { e.preventDefault(); ayarla(b.dataset.zoSet, b.dataset.v); } });
  // Profil > Ayarlar'daki "Görünüm" bölümü (web/profil/profil.js bir yer açar, buradan doldurulur).
  const gorunumBolumu = () => `<div class="zo-gorunum"><div><p class="zo-lbl" style="margin:0 0 6px;font-weight:700">Tema</p>${segHtml("tema")}</div>
    <div><p class="zo-lbl" style="margin:0 0 6px;font-weight:700">Yazı boyutu</p>${segHtml("yazi")}</div>
    <p class="zo-onizle">"Sistem" seçiliyse bilgisayarının ya da telefonunun açık/koyu ayarına uyar. Bu ayarlar bu cihazda saklanır ve hemen uygulanır.</p></div>`;

  /* ================= Yardımcılar ================= */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const harf = s => esc(String(s || "?").trim().charAt(0).toLocaleUpperCase("tr"));
  const av = (renk, foto, ad) => `<span class="zo-av" style="--av:${esc(renk || "#2f8f86")}" aria-hidden="true">${foto ? `<img src="${esc(foto)}" alt="" loading="lazy">` : harf(ad)}</span>`;
  const sade = s => String(s || "").toLocaleLowerCase("tr").replace(/[ıîİ]/g, "i").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ö/g, "o").replace(/[üû]/g, "u").replace(/â/g, "a").normalize("NFD").replace(/[̀-ͯ]/g, "");
  // Aranan kelimeleri <mark> ile vurgula (Türkçe işaretler ve büyük-küçük harf fark etmez).
  function vurgu(metin, q) {
    metin = String(metin || ""); const w = sade(q).split(/\s+/).filter(Boolean); if (!w.length) return esc(metin);
    const s = sade(metin); if (s.length !== metin.length) return esc(metin);
    const isaret = new Array(metin.length).fill(false);
    for (const k of w) { let i = s.indexOf(k); while (i >= 0) { for (let j = i; j < i + k.length; j++) isaret[j] = true; i = s.indexOf(k, i + k.length); } }
    let out = "", acik = false;
    for (let i = 0; i < metin.length; i++) { if (isaret[i] !== acik) { out += isaret[i] ? "<mark>" : "</mark>"; acik = isaret[i]; } out += esc(metin[i]); }
    return out + (acik ? "</mark>" : "");
  }
  const TELEFON = /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent);
  const IMLEC = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;
  const q = new URLSearchParams(location.search);
  const SAYFA = location.pathname === "/" || location.pathname === "/index.html" ? "uygulama"
    : location.pathname.startsWith("/oyunlar") ? "oyunlar" : location.pathname.startsWith("/forum") ? "forum"
    : location.pathname.startsWith("/profil") ? "profil" : location.pathname.startsWith("/mobil") ? "mobil" : "diger";
  if (SAYFA === "uygulama") root.classList.add("zo-uygulama"); else if (SAYFA === "mobil") root.classList.add("zo-mobil");
  // Ayrı pencere (?pop=…), mesajlar penceresinin içi (?gomulu=1) ve mobil uygulama kendi düzenini kullanır.
  const MENULU = !q.has("pop") && !q.has("gomulu") && SAYFA !== "mobil" && SAYFA !== "diger";

  const IKON = {
    zar: `<svg width="24" height="24" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M16 2 29 9.5v13L16 30 3 22.5v-13z"/><path d="M16 2 9 13h14zM9 13 3 22.5M23 13l6 9.5M9 13l7 17 7-17M3 9.5 9 13M29 9.5 23 13"/></svg>`,
    masalar: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 2 21 7v10l-9 5-9-5V7z"/><path d="M12 2v20M3 7l9 5 9-5"/></svg>`,
    oyunlar: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>`,
    forum: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 5h16v10H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg>`,
    mesajlar: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 6h18v12H3z"/><path d="M3 7l9 6 9-6"/></svg>`,
    ara: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`,
  };
  const MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const KISAYOL = MAC ? "⌘ K" : "Ctrl K";

  /* ================= Mesajlar penceresi ================= */
  let pano = null;
  function mesajAc(rota) {
    const Z = window.zmSunucu;
    if (Z && !Z.hesapli()) { Z.girisEkrani({ kayit: true }); return; }
    rota = rota || "mesajlar";
    if (TELEFON || SAYFA === "mobil") { location.href = "/mobil#" + rota; return; }
    // Ana uygulamanın kendi penceresi varsa (web/ext/sosyal.js) onu kullan, iki ayrı pencere açılmasın.
    if (typeof window.ZM_SOSYAL_AC === "function") return window.ZM_SOSYAL_AC(rota);
    if (!pano) {
      pano = document.createElement("div"); pano.className = "zo-pano"; pano.setAttribute("role", "dialog"); pano.setAttribute("aria-label", "Mesajlar");
      pano.innerHTML = `<iframe title="Mesajlar" src="/mobil?gomulu=1#${esc(rota)}"></iframe>`;
      pano.addEventListener("click", e => { if (e.target === pano) pano.hidden = true; });
      document.body.appendChild(pano);
    } else { pano.hidden = false; pano.querySelector("iframe").contentWindow.location.hash = rota; }
  }
  window.addEventListener("message", e => {
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.zm === "sosyal-kapat" && pano) pano.hidden = true;
  });

  /* ================= Üst menü ================= */
  let ust = null, sayi = { mesaj: 0, istek: 0 };
  const aktif = () => (SAYFA === "uygulama" ? "masalar" : SAYFA);
  function menuHtml() {
    const Z = window.zmSunucu, me = (Z && Z.me()) || {}, hesapli = !!(Z && Z.hesapli());
    const ad = me.kullanici || me.name || "Profil", a = aktif();
    const bag = (k, href, ad, ikon) => `<a href="${href}" data-zo="${k}"${a === k ? ' aria-current="page"' : ""}>${ikon}<span>${ad}</span></a>`;
    return `<a class="zo-marka" href="/" aria-label="Zar Masası ana sayfa">${IKON.zar}<span>Zar Masası</span></a>
      <nav class="zo-nav" aria-label="Ana menü">
        ${bag("masalar", "/", "Masalar", IKON.masalar)}${bag("oyunlar", "/oyunlar", "Masa oyunları", IKON.oyunlar)}${bag("forum", "/forum", "Forum", IKON.forum)}
        <button type="button" data-zo-mesaj title="Özel mesajlar ve sohbet grupları">${IKON.mesajlar}<span>Mesajlar</span><i class="zo-rozet" data-zo-sayi>${sayiMetni()}</i></button>
      </nav>
      <span class="zo-sp"></span>
      <button type="button" class="zo-ara" data-zo-ara aria-label="Ara (${KISAYOL})" title="Oyuncu, masa ve forum konusu ara (${KISAYOL})">${IKON.ara}<span>Ara…</span><kbd>${KISAYOL}</kbd></button>
      <span data-zm-bildirim-yer></span>
      <div class="zo-ben"><button type="button" class="zo-benbtn" data-zo-ben aria-haspopup="menu" aria-expanded="false" title="Profil ve ayarlar"${a === "profil" ? ' aria-current="page"' : ""}>${av(me.color, me.foto, ad)}<span class="zo-ad" data-noi18n>${esc(hesapli ? ad : "Profil")}</span></button>
        <div class="zo-acilir" role="menu" hidden>
          ${hesapli ? `<a role="menuitem" href="/profil">👤 Profilim</a><button type="button" role="menuitem" class="zo-oge" data-zo-rota="arkadaslar">🤝 Arkadaşlar</button><a role="menuitem" href="/mobil#dosyalar">📁 Yüklediklerim</a><a role="menuitem" href="/profil#ayarlar">⚙ Hesap ayarları</a>`
            : `<button type="button" role="menuitem" class="zo-oge" data-zo-giris>🔑 Giriş yap ya da hesap oluştur</button>`}
          <hr><div class="zo-gor"><span class="zo-lbl">Tema</span>${segHtml("tema")}<span class="zo-lbl">Yazı boyutu</span>${segHtml("yazi")}</div>
          ${hesapli ? `<hr><button type="button" role="menuitem" class="zo-oge zo-kotu" data-zo-cikis>Çıkış yap</button>` : ""}
        </div></div>`;
  }
  const sayiMetni = () => { const n = sayi.mesaj + sayi.istek; return n ? (n > 99 ? "99+" : String(n)) : ""; };
  function menuKur() {
    if (!MENULU || ust) return;
    ust = document.createElement("header"); ust.className = "zo-ust"; ust.setAttribute("role", "banner");
    ust.innerHTML = menuHtml();
    // Sayfaların eski başlık çubukları (profil, masa oyunları) yerine bu menü geçer.
    const eski = document.querySelector("body > header.ust");
    // Bildirim zili (web/ext/bildirim.js) daha önce eski başlığa ya da lobi başlığına konduysa menüye taşınır.
    const zil = document.querySelector(".zb-zil:not(.ray)");
    if (zil) { const yer = zil.closest("[data-zm-bildirim-yer]"); ust.querySelector("[data-zm-bildirim-yer]").appendChild(zil); if (yer && !eski?.contains(yer)) yer.remove(); }
    if (eski) eski.replaceWith(ust); else document.body.insertBefore(ust, document.body.firstChild);
    root.classList.add("zo-menulu");
    if (SAYFA === "uygulama") { oyundaMi(); new MutationObserver(oyundaMi).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["hidden"] }); }
    ust.addEventListener("click", menuTik);
    ust.addEventListener("keydown", e => { if (e.key === "Escape") acilirKapat(true); });
    document.addEventListener("click", e => { if (ust && !ust.querySelector(".zo-ben").contains(e.target)) acilirKapat(); });
  }
  // Ana uygulamada oyun masası açıkken menü gizlenir (masanın kendi rayı var).
  function oyundaMi() {
    const lobi = document.getElementById("lobby"), app = document.getElementById("app");
    root.classList.toggle("zo-oyunda", !!(app && !app.hidden) || !!(lobi && lobi.hidden && app && !app.hidden));
  }
  function menuYenile() {
    if (!ust) return;
    const acik = !ust.querySelector(".zo-acilir").hidden, zil = ust.querySelector("[data-zm-bildirim-yer]");
    const tmp = document.createElement("div"); tmp.innerHTML = menuHtml();
    // Bildirim zili bildirim.js'in; yerinde kalsın.
    tmp.querySelector("[data-zm-bildirim-yer]").replaceWith(zil);
    ust.replaceChildren(...tmp.childNodes);
    if (acik) acilirAc();
  }
  function acilirAc() { const m = ust.querySelector(".zo-acilir"); m.hidden = false; ust.querySelector("[data-zo-ben]").setAttribute("aria-expanded", "true"); }
  function acilirKapat(odak) {
    if (!ust) return; const m = ust.querySelector(".zo-acilir"); if (m.hidden) return;
    m.hidden = true; const b = ust.querySelector("[data-zo-ben]"); b.setAttribute("aria-expanded", "false"); if (odak) b.focus();
  }
  function menuTik(e) {
    const Z = window.zmSunucu;
    if (e.target.closest("[data-zo-ben]")) { const m = ust.querySelector(".zo-acilir"); if (m.hidden) { acilirAc(); const i = m.querySelector("a,button"); if (i && e.detail === 0) i.focus(); } else acilirKapat(); return; }
    if (e.target.closest("[data-zo-mesaj]")) { mesajAc("mesajlar"); return; }
    if (e.target.closest("[data-zo-ara]")) { aramaAc(); return; }
    const r = e.target.closest("[data-zo-rota]"); if (r) { acilirKapat(); mesajAc(r.dataset.zoRota); return; }
    if (e.target.closest("[data-zo-giris]")) { acilirKapat(); if (Z) Z.girisEkrani({ kayit: true }); return; }
    if (e.target.closest("[data-zo-cikis]")) { const b = e.target.closest("[data-zo-cikis]"); if (b.dataset.onay) { if (Z) Z.cikis(); return; } b.dataset.onay = "1"; b.textContent = "Emin misin? Çıkış yap"; return; }
  }
  // Okunmamış mesaj ve gelen arkadaşlık isteği sayısı.
  function sayilariIzle() {
    const Z = window.zmSunucu; if (!Z || !Z.hesapli()) return;
    const db = Z.db(), me = Z.me().id, konusma = new Map(), ark = new Map();
    const say = () => {
      sayi.mesaj = [...konusma.values()].reduce((a, k) => a + (k.okunmamis || 0), 0); sayi.istek = [...ark.values()].filter(a => a.durum === "gelen").length;
      const el = ust && ust.querySelector("[data-zo-sayi]"); if (el) el.textContent = sayiMetni();
    };
    db.collection(`data/users/${me}/konusma`).onSnapshot(s => { for (const c of s.docChanges()) c.type === "removed" ? konusma.delete(c.doc.id) : konusma.set(c.doc.id, c.doc.data()); say(); }, () => {});
    db.collection(`data/users/${me}/arkadas`).onSnapshot(s => { for (const c of s.docChanges()) c.type === "removed" ? ark.delete(c.doc.id) : ark.set(c.doc.id, c.doc.data()); say(); }, () => {});
  }

  /* ================= Genel arama (Ctrl+K) ================= */
  let perde = null, aramaNo = 0, secili = 0, sonQ = "";
  const KISA = [
    ["/", "🎲", "Masalar", "FRP masaları"], ["/oyunlar", "♟", "Masa oyunları", "Mangala, dama, kart oyunları"], ["/forum", "💬", "Forum", "Bütün konular"],
    ["/forum/yeni", "✏", "Yeni forum konusu aç", "Oyuncu ara, kural sor, paylaş"], ["#mesajlar", "✉", "Mesajlar", "Özel mesajlar ve gruplar"], ["/profil", "👤", "Profilim", "Oyunların, rozetlerin, ayarların"],
  ];
  function aramaAc(ilk) {
    if (SAYFA === "mobil") return;
    acilirKapat();
    if (!perde) {
      perde = document.createElement("div"); perde.className = "zo-perde"; perde.hidden = true;
      perde.innerHTML = `<div class="zo-modal" role="dialog" aria-modal="true" aria-label="Genel arama">
        <label class="zo-kutu">${IKON.ara}<input type="search" placeholder="Oyuncu, masa ya da forum konusu ara" aria-label="Ara" aria-controls="zoSonuc" aria-autocomplete="list" autocomplete="off" spellcheck="false" enterkeyhint="go"><kbd>Esc</kbd></label>
        <div class="zo-sonuc" id="zoSonuc" role="listbox" aria-label="Sonuçlar"></div>
        <div class="zo-alt"><span><kbd>↑</kbd> <kbd>↓</kbd> seç</span><span><kbd>Enter</kbd> aç</span><span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> yeni sekmede</span><span><kbd>Esc</kbd> kapat</span></div></div>`;
      document.body.appendChild(perde);
      const inp = perde.querySelector("input");
      perde.addEventListener("mousedown", e => { if (e.target === perde) aramaKapat(); });
      let t = null;
      inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => aramaYap(inp.value), 160); });
      inp.addEventListener("keydown", e => {
        const l = [...perde.querySelectorAll(".zo-satir")];
        if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!l.length) return; secili = (secili + (e.key === "ArrowDown" ? 1 : l.length - 1)) % l.length; seciliBoya(true); }
        else if (e.key === "Enter") { e.preventDefault(); const s = l[secili]; if (s) git(s, e.ctrlKey || e.metaKey); }
        else if (e.key === "Escape") { e.preventDefault(); if (inp.value) { inp.value = ""; aramaYap(""); } else aramaKapat(); }
      });
      perde.querySelector(".zo-sonuc").addEventListener("click", e => { const s = e.target.closest(".zo-satir"); if (!s) return; e.preventDefault(); git(s, e.ctrlKey || e.metaKey); });
      perde.querySelector(".zo-sonuc").addEventListener("mousemove", e => { const s = e.target.closest(".zo-satir"); if (!s) return; const l = [...perde.querySelectorAll(".zo-satir")], i = l.indexOf(s); if (i !== secili) { secili = i; seciliBoya(); } });
    }
    aramaOnce = document.activeElement;
    perde.hidden = false;
    const inp = perde.querySelector("input");
    if (typeof ilk === "string") inp.value = ilk;
    aramaYap(inp.value); inp.focus(); inp.select();
  }
  let aramaOnce = null;
  function aramaKapat() { if (!perde || perde.hidden) return; perde.hidden = true; if (aramaOnce && aramaOnce.focus) try { aramaOnce.focus(); } catch (e) {} }
  function seciliBoya(kaydir) {
    const l = [...perde.querySelectorAll(".zo-satir")];
    l.forEach((s, i) => s.setAttribute("aria-selected", String(i === secili)));
    const s = l[secili]; if (s) { perde.querySelector("input").setAttribute("aria-activedescendant", s.id); if (kaydir) s.scrollIntoView({ block: "nearest" }); }
  }
  function git(s, yeni) {
    const href = s.getAttribute("href");
    if (href === "#mesajlar") { aramaKapat(); mesajAc("mesajlar"); return; }
    if (yeni) { window.open(href, "_blank", "noopener"); return; }
    aramaKapat();
    // Aynı sayfada bir masaya gidiliyorsa (#oyun) adres çubuğu yetmez, sayfa hash değişikliğini dinler.
    location.href = href;
  }
  const satir = (n, href, simge, baslik, alt, etiket) => `<a class="zo-satir" id="zoS${n}" role="option" aria-selected="false" href="${esc(href)}">${simge}<span class="zo-ic"><b data-noi18n>${baslik}</b>${alt ? `<small data-noi18n>${alt}</small>` : ""}</span>${etiket || ""}</a>`;
  const DURUM = { bekliyor: "Oyuncu bekliyor", oynaniyor: "Oynanıyor", bitti: "Bitti" };
  async function aramaYap(qq) {
    const kutu = perde.querySelector(".zo-sonuc"), no = ++aramaNo; sonQ = qq = String(qq || "").trim(); secili = 0;
    if (!qq) {
      kutu.innerHTML = `<div class="zo-grup">Hızlı geçiş</div>` + KISA.map(([h, s, b, a], i) => satir(i, h, `<span class="zo-simge" aria-hidden="true">${s}</span>`, esc(b), esc(a))).join("");
      return seciliBoya();
    }
    const Z = window.zmSunucu;
    if (!Z) { kutu.innerHTML = `<div class="zo-bos">Arama için sunucuya bağlı olmalısın.</div>`; return; }
    let r;
    try { r = await Z.call("genelAra", { q: qq }); } catch (e) { if (no === aramaNo) kutu.innerHTML = `<div class="zo-bos">${esc(e.message || "Aranamadı")}</div>`; return; }
    if (no !== aramaNo) return;
    let n = 0, html = "";
    if (r.kisiler.length) html += `<div class="zo-grup">Oyuncular</div>` + r.kisiler.map(k => satir(n++, "/profil?kisi=" + encodeURIComponent(k.id), av(k.renk, k.foto, k.kullanici), vurgu(k.kullanici || k.ad, qq) + (k.ben ? " <small>(sen)</small>" : ""), "", `<span class="zo-etiket${k.cevrimici ? " on" : ""}">${k.cevrimici ? "Çevrimiçi" : "Çevrimdışı"}</span>`)).join("");
    if (r.masalar.length) html += `<div class="zo-grup">Masalar</div>` + r.masalar.map(m => m.tur === "frp"
      ? satir(n++, (TELEFON ? "/?mobil=1#" : "/#") + encodeURIComponent(m.id), `<span class="zo-simge" aria-hidden="true">🎲</span>`, vurgu(m.ad, qq), esc(`${m.sistemAd} · ${m.oyuncu} oyuncu · ${m.acik ? "açık katılım" : "onaylı katılım"}${m.masada ? ` · şu an masada ${m.masada} kişi` : ""}`), m.rol ? `<span class="zo-etiket">${m.rol === "dm" ? "DM" : "Oyuncu"}</span>` : "")
      : satir(n++, "/oyunlar#" + encodeURIComponent(m.id), `<span class="zo-simge" aria-hidden="true">${m.tur === "kart" ? "🃏" : "♟"}</span>`, vurgu(m.ad, qq), esc((m.ad !== m.oyunAd ? m.oyunAd + " · " : "") + (m.oyuncular.length ? m.oyuncular.join(", ") : "kimse yok")), `<span class="zo-etiket">${DURUM[m.durum] || ""}</span>`)).join("");
    if (r.konular.length) html += `<div class="zo-grup">Forum konuları</div>` + r.konular.map(t => satir(n++, "/forum/" + encodeURIComponent(t.id), `<span class="zo-simge" aria-hidden="true">💬</span>`, vurgu(t.baslik, qq), esc(`${t.kategori} · ${t.yazar} · ${t.yanit} yanıt`) + (t.ozet ? " · " + vurgu(t.ozet, qq) : ""), t.sabit ? `<span class="zo-etiket">Sabit</span>` : "")).join("");
    kutu.innerHTML = html || `<div class="zo-bos">"${esc(qq)}" için bir şey bulunamadı.<br><small>Kullanıcı adının bir kısmını, masanın ya da konunun adından bir kelime yaz.</small></div>`;
    seciliBoya();
  }
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === "k" || e.key === "K")) {
      if (SAYFA === "mobil" || q.has("gomulu")) return;
      e.preventDefault(); if (perde && !perde.hidden) aramaKapat(); else aramaAc();
    } else if (e.key === "Escape" && perde && !perde.hidden) { e.preventDefault(); aramaKapat(); }
    else if (e.key === "Escape" && pano && !pano.hidden) pano.hidden = true;
  }, true);

  /* ================= Kişi kartı ================= */
  // Bir kullanıcı adının (web/shim.js: zmKisi, data-zm-kisi) üstüne fareyle gelince kısa bir kart açılır.
  const kartOnbellek = new Map(); // kişi -> { t, p, cevrimici }
  let kart = null, kartKisi = null, kartAcT = null, kartKapaT = null, kartHedef = null;
  async function kisiAl(id) {
    const e = kartOnbellek.get(id); if (e && Date.now() - e.t < 30000) return e;
    const Z = window.zmSunucu; if (!Z) throw new Error("Bağlantı yok");
    const [p, pr] = await Promise.all([Z.call("kisi", { kisi: id }).catch(() => null), Z.call("profiles", { ids: [id] }).catch(() => ({}))]);
    const o = pr[id] || {};
    const k = { t: Date.now(), p: p || { id, kullanici: o.kullanici, ad: o.name, renk: o.color, foto: o.foto }, cevrimici: !!o.cevrimici, bot: !!o.bot, yok: !p && !o.name };
    kartOnbellek.set(id, k); return k;
  }
  function kartCiz(id, k, not) {
    const Z = window.zmSunucu, me = (Z && Z.me()) || {}, p = k.p, ad = p.kullanici || p.ad || "Oyuncu", ben = id === me.id;
    const ark = p.arkadas;
    kart.style.setProperty("--kr", p.renk || "#2f8f86");
    kart.innerHTML = `<div class="zo-kserit" aria-hidden="true"></div><div class="zo-kic">
      <div class="zo-kust"><span class="zo-kav">${av(p.renk, p.foto, ad)}<i class="zo-nokta${k.cevrimici ? " on" : ""}" aria-hidden="true"></i></span>
        <div style="min-width:0"><div class="zo-kad" data-noi18n>${esc(ad)}${ben ? " <small>(sen)</small>" : ""}</div><div class="zo-kdurum${k.cevrimici ? " on" : ""}">${k.bot ? "Bot" : k.cevrimici ? "Çevrimiçi" : "Çevrimdışı"}${ark === "arkadas" ? " · Arkadaşın" : ""}</div></div></div>
      ${p.hakkinda ? `<p class="zo-khak" data-noi18n>${esc(p.hakkinda)}</p>` : p.gizli && !ben ? `<p class="zo-knot">Bu oyuncu profilini gizli tutuyor.</p>` : ""}
      ${not ? `<p class="zo-knot" role="status">${not}</p>` : ""}
      <div class="zo-kbtn">${ben ? `<a class="zo-dug pri" href="/profil">Profilim</a>`
        : `${p.kullanici ? `<button type="button" class="zo-dug pri" data-zo-k="mesaj">Mesaj gönder</button>` : ""}${not && ark !== "arkadas" && ark !== "giden" && p.kullanici ? `<button type="button" class="zo-dug" data-zo-k="ekle">${ark === "gelen" ? "İsteği kabul et" : "+ Arkadaş ekle"}</button>` : ""}<a class="zo-dug" href="/profil?kisi=${encodeURIComponent(id)}">Profili aç</a>`}</div></div>`;
  }
  // Yazı boyutu büyütülmüşse (zoom) kartın konumu da o oranda bölünür.
  function kartYerlestir(el) {
    const z = (root.dataset.yazi && SAYFA !== "mobil" && parseFloat(getComputedStyle(root).getPropertyValue("--zo-zoom"))) || 1;
    const r = el.getBoundingClientRect(), w = kart.offsetWidth * z, h = kart.offsetHeight * z;
    let x = Math.min(Math.max(8, r.left), innerWidth - w - 8), y = r.bottom + 6;
    if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 6);
    kart.style.left = x / z + "px"; kart.style.top = y / z + "px";
  }
  async function kartAc(el) {
    const id = el.dataset.zmKisi; if (!id) return;
    if (!kart) {
      kart = document.createElement("div"); kart.className = "zo-kart"; kart.setAttribute("role", "dialog"); kart.hidden = true;
      kart.addEventListener("mouseenter", () => clearTimeout(kartKapaT));
      kart.addEventListener("mouseleave", () => kartKapatBekle());
      kart.addEventListener("click", kartTik);
      document.body.appendChild(kart);
    }
    kartKisi = id; kartHedef = el;
    kart.setAttribute("aria-label", (el.textContent || "Kişi") + " kartı");
    const e = kartOnbellek.get(id);
    if (e) kartCiz(id, e); else { kart.innerHTML = `<div class="zo-kic" style="padding-top:14px"><span class="zo-kdurum">${esc(el.textContent || "")} · yükleniyor…</span></div>`; kart.style.removeProperty("--kr"); }
    kart.hidden = false; kartYerlestir(el);
    try { const k = await kisiAl(id); if (kartKisi !== id || kart.hidden) return; kartCiz(id, k); kartYerlestir(el); } catch (x) {}
  }
  function kartKapat() { clearTimeout(kartAcT); clearTimeout(kartKapaT); if (kart) kart.hidden = true; kartKisi = null; }
  function kartKapatBekle() { clearTimeout(kartAcT); clearTimeout(kartKapaT); kartKapaT = setTimeout(kartKapat, 220); }
  async function kartTik(e) {
    const b = e.target.closest("[data-zo-k]"); if (!b) return;
    const id = kartKisi, k = kartOnbellek.get(id), Z = window.zmSunucu; if (!k || !Z) return;
    if (b.dataset.zoK === "mesaj") {
      if (k.p.arkadas === "arkadas") { kartKapat(); mesajAc("mesaj/" + encodeURIComponent(id)); return; }
      const not = k.p.arkadas === "giden" ? "Arkadaşlık isteğin bekliyor. Kabul edilince mesaj gönderebilirsin." : "Mesaj göndermek için önce arkadaş olmalısınız.";
      kartCiz(id, k, not); kartYerlestir(kartHedef); return;
    }
    if (b.dataset.zoK === "ekle") {
      b.disabled = true;
      try {
        const r = k.p.arkadas === "gelen" ? (await Z.call("arkadasKabul", { kisi: id }), "arkadas") : await Z.call("arkadasIstek", { kisi: id });
        k.p.arkadas = r === "arkadas" ? "arkadas" : "giden";
        kartCiz(id, k, r === "arkadas" ? "Artık arkadaşsınız. Mesaj gönderebilirsin." : "Arkadaşlık isteği gönderildi.");
      } catch (x) { kartCiz(id, k, esc(x.message || "Olmadı")); }
      kartYerlestir(kartHedef);
    }
  }
  if (IMLEC) {
    document.addEventListener("mouseover", e => {
      const el = e.target.closest && e.target.closest("[data-zm-kisi]");
      if (!el) return;
      clearTimeout(kartKapaT);
      if (kartKisi === el.dataset.zmKisi && kart && !kart.hidden) return;
      clearTimeout(kartAcT); kartAcT = setTimeout(() => kartAc(el), 380);
    });
    document.addEventListener("mouseout", e => {
      const el = e.target.closest && e.target.closest("[data-zm-kisi]");
      if (!el || (e.relatedTarget && el.contains(e.relatedTarget))) return;
      kartKapatBekle();
    });
    document.addEventListener("scroll", () => { if (kart && !kart.hidden) kartKapat(); }, true);
    document.addEventListener("click", e => { if (kart && !kart.hidden && !kart.contains(e.target)) kartKapat(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && kart && !kart.hidden) kartKapat(); });
  }

  /* ================= Kurulum ================= */
  window.zmOrtak = { mesajAc, aramaAc, aramaKapat, ayarla, tema, yazi, gorunumBolumu, menuYenile };
  function kur() {
    menuKur();
    const Z = window.zmSunucu;
    if (Z && Z.ready) Z.ready.then(() => { menuYenile(); if (ust) sayilariIzle(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", kur); else kur();
})();
