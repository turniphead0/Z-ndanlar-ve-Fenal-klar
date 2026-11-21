/* Masa oyunları sayfası (/oyunlar). Zar Masası'nın sunucusuna aynı kimlikle bağlanır (localStorage zm-uid / zm-secret),
   boards/* belgelerini canlı izler ve hamleleri sunucuya gönderir. Kuralları kurallar.js'ten alır. */
(function () {
  "use strict";
  const { OYUNLAR, ayni } = window.ZM_OYUNLAR;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const kisiA = k => (window.zmKisi ? window.zmKisi(k.id, k.name) : esc(k.name)); // ada tıklanınca profil açılır (bot ise düz ad)
  const LS = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

  /* ---------------- Bağlantı ---------------- */
  // Sunucuya /shim.js ile bağlanılır: giriş/kayıt ekranı, yeniden bağlanma ve abonelikler orada.
  const Z = window.zmSunucu;
  let ME = null, IS_OWNER = false;
  const call = (op, a) => Z.call(op, a);
  // Koleksiyon aboneliği: fn({ initial, changes: [{ type, id, data }] })
  function abone(kind, path, fn) {
    let ilk = true;
    Z.db().collection(path).onSnapshot(s => { fn({ initial: ilk, changes: s.docChanges().map(c => ({ type: c.type, id: c.doc.id, data: c.doc.data() })) }); ilk = false; }, () => {});
  }

  async function basla() {
    await Z.ready;
    ME = Z.me(); IS_OWNER = Z.isOwner();
    if ($("#ben")) $("#ben").textContent = ME.kullanici || ME.name; // ortak üst menü (web/ortak.js) varsa başlık onun
    const baglam = { call, Z, esc, me: () => ME, isOwner: () => IS_OWNER, tahtalar, kartOyunlari, ciz, odaAdiSor, odaBaslik };
    if (window.ZM_KARTUI) ZM_KARTUI.kur(baglam);
    if (window.ZM_ATOLYE) ZM_ATOLYE.kur(baglam);
    abone("col", "boards", m => {
      if (m.initial) tahtalar.clear();
      for (const ch of m.changes) ch.type === "removed" ? tahtalar.delete(ch.id) : tahtalar.set(ch.id, ch.data);
      ciz();
    });
    abone("col", "kartoyun", m => {
      if (m.initial) kartOyunlari.clear();
      for (const ch of m.changes) ch.type === "removed" ? kartOyunlari.delete(ch.id) : kartOyunlari.set(ch.id, ch.data);
      if (!acikId() || acikId().startsWith("atolye")) ciz();
    });
  }

  /* ---------------- Durum ---------------- */
  const tahtalar = new Map(), kartOyunlari = new Map();
  let secim = [], hataMetni = "", sonId = null, oneri = null;
  const acikId = () => (location.hash.match(/^#(b[a-z0-9]+|atolye(?:\/[a-z0-9-]+)?)$/) || [])[1];
  // Lobi iki sayfa: açık oyunlar (#acik, varsayılan) ve oyun seçenekleri (#secenekler).
  const lobiSayfasi = () => (location.hash === "#secenekler" ? "secenekler" : "acik");
  window.addEventListener("hashchange", () => { secim = []; hataMetni = ""; oneri = null; ciz(); });
  // Yüklenen dosya hangi oyuna ait (Yüklediklerim sayfası için): açık masa ya da atölyedeki oyun.
  window.ZM_YUKLEME_YERI = () => { const id = acikId(); if (!id) return null; if (id.startsWith("atolye")) { const k = id.slice(7); return k ? "kartoyun/" + k : "atolye"; } return "boards/" + id; };

  const RENK_GENEL = ["Açık taşlar", "Koyu taşlar"];
  const koltukAdi = (b, k) => (b.koltuk[k] ? b.koltuk[k].name : "boş");
  const benimKoltuklarim = b => (b.oyun === "kart" ? [] : [0, 1]).filter(k => b.koltuk[k] && ME && b.koltuk[k].id === ME.id);
  // Admin ve test hesapları botları yönetir: otomatik oynamayı kapatınca botun yerine tahtaya tıklayarak oynarlar.
  const yonetici = () => !!(ME && (ME.rol === "admin" || ME.rol === "tester")) || IS_OWNER;
  const elimdekiBotlar = b => (b.oyun === "kart" || !yonetici() ? [] : [0, 1]).filter(k => b.koltuk[k] && b.koltuk[k].bot && b.koltuk[k].oto === false);
  const oynadigimKoltuklar = b => benimKoltuklarim(b).concat(elimdekiBotlar(b));
  const masadayim = b => !!ME && (b.olusturan === ME.id || IS_OWNER || yonetici() || b.koltuk.some(k => k && k.id === ME.id));
  const ZORLUK = (window.ZM_BOT && ZM_BOT.ZORLUK) || { kolay: "Kolay", orta: "Orta", zor: "Zor" };

  function ciz() {
    const id = acikId();
    if (!ME) return;
    if (id && id.startsWith("atolye")) return window.ZM_ATOLYE ? ZM_ATOLYE.ciz(id.slice(7)) : null;
    if (id && tahtalar.has(id) && tahtalar.get(id).oyun === "kart") return ZM_KARTUI.ciz(id, tahtalar.get(id));
    if (window.ZM_KARTUI) ZM_KARTUI.kapat();
    if (id && tahtalar.has(id)) return cizTahta(id, tahtalar.get(id));
    if (id && !tahtalar.has(id)) { $("#ana").innerHTML = `<p class="bos">Bu tahta kapatılmış. <a href="#">Oyunlara dön</a></p>`; return; }
    cizLobi();
  }

  /* ---------------- Lobi: açık oyunlar ve oyun seçenekleri ---------------- */
  // Süzgeçler oturum boyunca kalır (ana ekrandaki RPG masa listesi gibi).
  const F = { q: "", tur: "", oyun: "", durum: "", benim: false, q2: "", tur2: "", oyuncu: "", benim2: false };
  try { Object.assign(F, JSON.parse(sessionStorage.getItem("zm-oyun-suzgec") || "{}")); } catch (e) {}
  const sakla = () => { try { sessionStorage.setItem("zm-oyun-suzgec", JSON.stringify(F)); } catch (e) {} };
  // "Dokuz taş" ile "dokuz tas" aynı sonucu versin: küçük harf, Türkçe işaretsiz.
  const sade = s => String(s || "").toLocaleLowerCase("tr").replace(/[ıîİ]/g, "i").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ö/g, "o").replace(/[üû]/g, "u").replace(/â/g, "a").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const uyar = (q, ...alan) => { const w = sade(q).split(/\s+/).filter(Boolean); if (!w.length) return true; const t = sade(alan.join(" ")); return w.every(x => t.includes(x)); };
  const HAZIR = () => (window.ZM_HAZIR && ZM_HAZIR.HAZIR) || {};

  // Açık bir odanın (tahta ya da kart masası) listede kullanılan özeti.
  function oda(id, b) {
    const kart = b.oyun === "kart", d = b.durum || {}, koltuk = (kart ? d.koltuk : b.koltuk) || [];
    const oyunAd = kart ? (b.tanim && b.tanim.ad) || "Kart oyunu" : (OYUNLAR[b.oyun] || {}).ad || b.oyun;
    const oyunAnahtar = kart ? (b.hazir ? "hazir:" + b.hazir : b.kartoyun ? "kartoyun:" + b.kartoyun : "kart:" + oyunAd) : "tahta:" + b.oyun;
    const benim = !!ME && koltuk.some(k => k && k.id === ME.id), acan = !!ME && b.olusturan === ME.id;
    const bos = koltuk.includes(null);
    const durum = !kart && d.bitti ? "bitti" : kart ? (d.basladi ? "oynaniyor" : "bekliyor") : bos ? "bekliyor" : "oynaniyor";
    const siradaki = durum !== "bitti" && (!kart || d.basladi) ? koltuk[d.sira] : null;
    return { id, b, kart, oyunAd, oyunAnahtar, ad: b.ad || oyunAd, ozelAd: !!b.ad, koltuk, benim, acan, bos, durum, siraSende: !!(siraSende(b)), siradaki, updated: b.updated || 0 };
  }
  function siraSende(b) {
    if (!ME) return false;
    if (b.oyun === "kart") { const d = b.durum || {}; return !!(d.basladi && d.koltuk[d.sira] && d.koltuk[d.sira].id === ME.id); }
    return !b.durum.bitti && oynadigimKoltuklar(b).includes(b.durum.sira);
  }
  // Seçenekler sayfasındaki oyunlar: tahta oyunları, hazır kart oyunları ve atölyede yapılanlar.
  function secenekler() {
    const out = Object.entries(OYUNLAR).map(([k, g]) => ({ anahtar: "tahta:" + k, tur: "tahta", ad: g.ad, aciklama: g.kisa, min: 2, max: 2, dugme: `<button class="btn pri" data-yeni="${k}">Oda aç</button>` }));
    for (const [k, t] of Object.entries(HAZIR())) out.push({ anahtar: "hazir:" + k, tur: "kart", ad: t.ad + (t.surum ? " · " + t.surum : ""), aciklama: t.aciklama || "", min: t.oyuncu.min, max: t.oyuncu.max, dugme: `<button class="btn pri" data-km-yeni="${esc(k)}">Oda aç</button>` });
    for (const [id, o] of [...kartOyunlari.entries()].sort((a, b) => b[1].updated - a[1].updated)) {
      const t = o.tanim || {}, oy = t.oyuncu || { min: 1, max: 8 }, kendi = !!ME && o.sahip === ME.id;
      out.push({ anahtar: "kartoyun:" + id, tur: "atolye", ad: t.ad || "Adsız oyun", aciklama: t.aciklama || "", min: oy.min, max: oy.max, yapan: o.sahipAd, kendi,
        dugme: `<button class="btn pri" data-km-oyun="${esc(id)}">Oda aç</button>${kendi || IS_OWNER ? `<a class="btn" href="#atolye/${esc(id)}">Düzenle</a>` : ""}` });
    }
    return out;
  }
  const odalar = () => [...tahtalar.entries()].filter(([, b]) => b.oyun === "kart" ? b.tanim && b.durum && b.durum.koltuk : OYUNLAR[b.oyun]).map(([id, b]) => oda(id, b));
  const DURUM_AD = { bekliyor: "Oyuncu bekliyor", oynaniyor: "Oynanıyor", bitti: "Bitti" };
  const TUR_AD = { tahta: "Tahta", kart: "Kart", atolye: "Atölye" };

  function odaUyar(o) {
    if (F.tur && (o.kart ? "kart" : "tahta") !== F.tur) return false;
    if (F.oyun && o.oyunAnahtar !== F.oyun) return false;
    if (F.durum === "sirada" ? !o.siraSende : F.durum && o.durum !== F.durum) return false;
    if (F.benim && !o.benim && !o.acan) return false;
    return uyar(F.q, o.ad, o.oyunAd, o.koltuk.filter(Boolean).map(k => k.name).join(" "), DURUM_AD[o.durum]);
  }
  const secenekUyar = s => (!F.tur2 || s.tur === F.tur2) && (!F.benim2 || s.kendi)
    && (!F.oyuncu || (F.oyuncu === "2" ? s.min <= 2 && s.max >= 2 : F.oyuncu === "34" ? s.max >= 3 && s.min <= 4 : s.max >= 5))
    && uyar(F.q2, s.ad, s.aciklama, s.yapan, TUR_AD[s.tur]);

  const secenek = (v, cur, l) => `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(l)}</option>`;
  function aracHtml(sayfa) {
    if (sayfa === "acik") {
      const oyunlar = new Map(); for (const o of odalar()) oyunlar.set(o.oyunAnahtar, o.oyunAd);
      for (const s of secenekler()) if (!oyunlar.has(s.anahtar)) oyunlar.set(s.anahtar, s.ad);
      const dolu = F.q || F.tur || F.oyun || F.durum || F.benim;
      return `<div class="arac" role="search"><label class="ara"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input type="search" id="oAra" placeholder="Oda adı, oyun ya da oyuncu ara" aria-label="Açık oyunlarda ara" value="${esc(F.q)}" autocomplete="off"></label>
        <select data-f="tur" aria-label="Oyun türü">${secenek("", F.tur, "Bütün türler")}${secenek("tahta", F.tur, "Tahta oyunları")}${secenek("kart", F.tur, "Kart ve taş oyunları")}</select>
        <select data-f="oyun" aria-label="Oyun">${secenek("", F.oyun, "Bütün oyunlar")}${[...oyunlar].sort((a, b) => a[1].localeCompare(b[1], "tr")).map(([k, ad]) => secenek(k, F.oyun, ad)).join("")}</select>
        <select data-f="durum" aria-label="Durum">${secenek("", F.durum, "Her durum")}${secenek("bekliyor", F.durum, "Oyuncu bekliyor")}${secenek("oynaniyor", F.durum, "Oynanıyor")}${secenek("sirada", F.durum, "Sıra bende")}${secenek("bitti", F.durum, "Bitti")}</select>
        <button type="button" class="cip" data-f-benim aria-pressed="${!!F.benim}">Yalnızca benim odalarım</button>
        ${dolu ? `<button type="button" class="btn" data-f-temizle>Süzgeçleri temizle</button>` : ""}</div>`;
    }
    const dolu = F.q2 || F.tur2 || F.oyuncu || F.benim2;
    return `<div class="arac" role="search"><label class="ara"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input type="search" id="oAra2" placeholder="Oyun adı ya da açıklama ara" aria-label="Oyun seçeneklerinde ara" value="${esc(F.q2)}" autocomplete="off"></label>
      <select data-f="tur2" aria-label="Oyun türü">${secenek("", F.tur2, "Bütün türler")}${secenek("tahta", F.tur2, "Tahta oyunları")}${secenek("kart", F.tur2, "Hazır kart oyunları")}${secenek("atolye", F.tur2, "Atölyede yapılanlar")}</select>
      <select data-f="oyuncu" aria-label="Oyuncu sayısı">${secenek("", F.oyuncu, "Her oyuncu sayısı")}${secenek("2", F.oyuncu, "2 kişilik")}${secenek("34", F.oyuncu, "3–4 kişilik")}${secenek("5", F.oyuncu, "5 ve üstü")}</select>
      <button type="button" class="cip" data-f-benim2 aria-pressed="${!!F.benim2}">Benim yaptıklarım</button>
      ${dolu ? `<button type="button" class="btn" data-f-temizle2>Süzgeçleri temizle</button>` : ""}</div>`;
  }

  function acikSonucHtml() {
    const tum = odalar();
    if (!tum.length) return `<div class="bos-kutu"><h2>Şu an açık oda yok</h2><p>Bir oyun seç, kendi odanı aç ve adını sen koy. Arkadaşların bu listeden katılır ya da onlara bildirimle davet gönderirsin.</p><a class="btn pri" href="#secenekler">Oyun seçeneklerine git</a></div>`;
    const l = tum.filter(odaUyar).sort((a, b) => (b.siraSende - a.siraSende) || ((b.benim || b.acan) - (a.benim || a.acan)) || ((a.durum === "bitti") - (b.durum === "bitti")) || b.updated - a.updated);
    if (!l.length) return `<div class="bos-kutu"><h2>Aramana uyan oda yok</h2><p>Başka bir kelime dene ya da süzgeçleri temizle.</p><button class="btn" data-f-temizle>Süzgeçleri temizle</button></div>`;
    return `<p class="sayac">${l.length === tum.length ? `${tum.length} oda` : `${tum.length} odadan ${l.length} tanesi`}</p><div class="liste">${l.map(o => {
      const oyuncular = o.koltuk.map(k => (k ? kisiA(k) : "<i>boş</i>")).join(", ");
      const dug = o.benim || (!o.kart && benimKoltuklarim(o.b).length) ? "Devam et" : o.bos && o.durum !== "bitti" ? "Katıl" : "İzle";
      return `<div class="satir oda${o.siraSende ? " sirada" : ""}"><span class="tur-rozet ${o.kart ? "kart" : "tahta"}">${o.kart ? "Kart" : "Tahta"}</span>
        <span class="oda-ad"><span class="ad" data-noi18n>${esc(o.ad)}</span>${o.ozelAd ? `<small>${esc(o.oyunAd)}</small>` : ""}</span>
        <span class="bilgi" data-noi18n>${oyuncular || "kimse oturmadı"}</span>
        <span class="durum-rozet ${o.durum}">${o.siraSende ? "Sıra sende" : DURUM_AD[o.durum]}</span><span class="sp"></span>
        <a class="btn${o.siraSende ? " pri" : ""}" href="#${o.id}">${dug}</a></div>`;
    }).join("")}</div>`;
  }

  function seceneklerSonucHtml() {
    const tum = secenekler(), l = tum.filter(secenekUyar), sayi = new Map();
    for (const o of odalar()) if (o.durum !== "bitti") sayi.set(o.oyunAnahtar, (sayi.get(o.oyunAnahtar) || 0) + 1);
    const atolye = !F.tur2 || F.tur2 === "atolye";
    const kartlar = l.map(s => `<div class="kart"><span class="tur-rozet ${s.tur}">${TUR_AD[s.tur]}</span><b>${esc(s.ad)}</b><p>${esc(s.aciklama)}</p>
      <p class="km-oy">${s.min === s.max ? s.max : s.min + "–" + s.max} oyuncu${s.yapan ? ` · ${esc(s.yapan)} yaptı` : ""}</p>
      <div class="km-dug">${s.dugme}${sayi.get(s.anahtar) ? `<button class="btn" data-acik-oyun="${esc(s.anahtar)}">${sayi.get(s.anahtar)} açık oda</button>` : ""}</div></div>`).join("");
    if (!l.length && !atolye) return `<div class="bos-kutu"><h2>Aramana uyan oyun yok</h2><p>Başka bir kelime dene ya da süzgeçleri temizle.</p><button class="btn" data-f-temizle2>Süzgeçleri temizle</button></div>`;
    return `<p class="sayac">${l.length === tum.length ? `${tum.length} oyun` : `${tum.length} oyundan ${l.length} tanesi`}</p><div class="kartlar">${kartlar}
      ${atolye ? `<a class="kart km-atolye" href="#atolye"><b>+ Kendi oyununu yap</b><p>Oyun atölyesi: kartlar ve desteler, taşlar, sayaçlar, masa alanları ve kurallar. Kart resimlerini yükleyebilirsin.</p></a>` : ""}</div>`;
  }

  function cizLobi() {
    const sayfa = lobiSayfasi(), ana = $("#ana");
    const acikSayi = odalar().filter(o => o.durum !== "bitti").length, sirada = odalar().filter(o => o.siraSende).length;
    const sek = `<nav class="lsek" aria-label="Masa oyunları bölümleri"><a href="#acik" aria-current="${sayfa === "acik" ? "page" : "false"}">Açık oyunlar <b>${acikSayi}</b>${sirada ? `<i class="sira-sayi" title="Sıra sende">${sirada}</i>` : ""}</a><a href="#secenekler" aria-current="${sayfa === "secenekler" ? "page" : "false"}">Oyun seçenekleri</a></nav>`;
    // Arama kutusunda yazarken odak kaybolmasın: sayfa aynıysa yalnızca sekmeleri ve sonuçları yenile.
    if (ana.dataset.lobi === sayfa && $("#lsonuc")) {
      $(".lsek").outerHTML = sek;
      $("#lsonuc").innerHTML = sayfa === "acik" ? acikSonucHtml() : seceneklerSonucHtml();
      return;
    }
    ana.dataset.lobi = sayfa;
    ana.innerHTML = sek + aracHtml(sayfa) + `<div id="lsonuc">${sayfa === "acik" ? acikSonucHtml() : seceneklerSonucHtml()}</div>`;
  }
  function lobiYenile(tam) {
    const ana = $("#ana");
    if (tam) { const odak = document.activeElement && document.activeElement.id, poz = odak && document.activeElement.selectionStart; ana.dataset.lobi = ""; cizLobi(); if (odak && $("#" + odak)) { const el = $("#" + odak); el.focus(); try { el.setSelectionRange(poz, poz); } catch (e) {} } }
    else cizLobi();
  }
  document.addEventListener("input", e => {
    if (e.target.id === "oAra") { F.q = e.target.value; sakla(); lobiYenile(!!F.q !== !!$("[data-f-temizle]")); }
    if (e.target.id === "oAra2") { F.q2 = e.target.value; sakla(); lobiYenile(!!F.q2 !== !!$("[data-f-temizle2]")); }
  });
  document.addEventListener("change", e => { const f = e.target.closest && e.target.closest("[data-f]"); if (!f) return; F[f.dataset.f] = f.value; sakla(); lobiYenile(true); });

  /* ---------------- Oda adı ---------------- */
  // Küçük bir pencere: oda adını sorar. Boş bırakılırsa oyunun adı kullanılır. Vazgeçilirse null.
  function odaAdiSor(oyunAd, mevcut, baslik) {
    return new Promise(res => {
      const p = document.createElement("div"); p.className = "pencere";
      p.innerHTML = `<form class="pencere-ic" role="dialog" aria-modal="true" aria-labelledby="odaBaslik"><h2 id="odaBaslik">${esc(baslik || "Odanı aç")}</h2>
        <label for="odaAdi">Odanın adı</label><input id="odaAdi" maxlength="60" placeholder="ör. Cuma akşamı ${esc(oyunAd)}" value="${esc(mevcut || "")}" autocomplete="off">
        <p class="bos" style="margin:0;font-size:13px">Listede bu adla görünür; boş bırakırsan “${esc(oyunAd)}” yazar. Sonra da değiştirebilirsin.</p>
        <div class="pencere-dug"><button type="button" class="btn" data-vazgec>Vazgeç</button><button class="btn pri">${mevcut != null ? "Kaydet" : "Odayı aç"}</button></div></form>`;
      const bitir = v => { p.remove(); document.removeEventListener("keydown", esc_); res(v); };
      const esc_ = e => { if (e.key === "Escape") bitir(null); };
      p.addEventListener("click", e => { if (e.target === p || e.target.closest("[data-vazgec]")) bitir(null); });
      p.querySelector("form").addEventListener("submit", e => { e.preventDefault(); bitir(p.querySelector("#odaAdi").value.trim()); });
      document.addEventListener("keydown", esc_);
      document.body.appendChild(p); p.querySelector("#odaAdi").focus();
    });
  }
  // Masa ekranlarının başlığı: oda adı, oyunun adı, ad değiştirme ve davet düğmeleri.
  function odaBaslik(id, b) {
    const kart = b.oyun === "kart", oyunAd = kart ? (b.tanim && b.tanim.ad) || "Kart oyunu" : (OYUNLAR[b.oyun] || {}).ad;
    const koltuk = (kart ? (b.durum || {}).koltuk : b.koltuk) || [];
    const yetkili = !!ME && (b.olusturan === ME.id || IS_OWNER || koltuk.some(k => k && k.id === ME.id));
    return `<div class="oda-bas"><a href="#acik">← Açık oyunlar</a><span class="oda-baslik"><b data-noi18n>${esc(b.ad || oyunAd)}</b>${b.ad ? `<small>${esc(oyunAd)}</small>` : ""}</span><span class="sp"></span>
      ${yetkili ? `<button class="btn" data-oda-ad="${esc(id)}" title="Odanın adını değiştir">✎ Adını değiştir</button>` : ""}
      ${window.ZM_BILDIRIM ? `<button class="btn" data-zb-davet="tahta:${esc(id)}" title="Arkadaşlarına bu oda için davet gönder">📨 Davet et</button>` : ""}</div>`;
  }

  function cizTahta(id, b) {
    if (sonId !== id) { secim = []; sonId = id; }
    const g = OYUNLAR[b.oyun], d = b.durum, benim = oynadigimKoltuklar(b);
    const RENK = g.taraflar || RENK_GENEL, renk = k => (g.renk ? g.renk[k] : k);
    const oynayabilir = !d.bitti && benim.includes(d.sira);
    const yasal = oynayabilir ? g.hamleler(d) : [];
    const uyan = yasal.filter(h => ayni(h.slice(0, secim.length), secim));
    if (oneri && !uyan.some(h => ayni(h, oneri))) oneri = null;
    const ipucu = new Set(oneri ? [oneri[secim.length]] : uyan.map(h => h[secim.length]));
    const cevir = benimKoltuklarim(b).length === 1 && benimKoltuklarim(b)[0] === 1; // yalnızca ikinci koltuktaysan tahtayı kendi tarafından gör
    const siradaki = b.koltuk[d.sira];
    const durumMetni = d.bitti
      ? (d.bitti.kazanan == null ? `Berabere (${d.bitti.neden})` : `Kazanan: ${koltukAdi(b, d.bitti.kazanan)} · ${RENK[d.bitti.kazanan]} (${d.bitti.neden})`)
      : !b.koltuk[d.sira] ? `Sıra ${RENK[d.sira].toLowerCase()}da, ama koltuk boş`
      : oynayabilir && siradaki.bot ? `Sıra ${siradaki.name} botunda: tahtaya tıklayarak onun yerine oynuyorsun`
      : oynayabilir ? `Sıra sende (${RENK[d.sira].toLowerCase()})`
      : siradaki.bot ? `Sıra ${siradaki.name} botunda${siradaki.oto === false ? " (otomatik kapalı, bir yöneticinin oynatmasını bekliyor)" : ", düşünüyor…"}`
      : `Sıra ${koltukAdi(b, d.sira)} oyuncusunda`;
    const koltukHtml = k => {
      const x = b.koltuk[k], mine = x && ME && x.id === ME.id;
      const botDug = !x && masadayim(b) ? `<button class="btn" data-bot-ekle="${k}" title="Bu koltuğa bilgisayar oyuncusu oturt">🤖 Bot</button>` : "";
      const botAyar = x && x.bot ? `<div class="bot-ayar">${masadayim(b) ? `<label>Zorluk <select data-bot-zorluk="${k}">${Object.entries(ZORLUK).map(([z, ad]) => `<option value="${z}"${x.zorluk === z ? " selected" : ""}>${esc(ad)}</option>`).join("")}</select></label><button class="btn" data-bot-cikar="${k}">Botu kaldır</button>` : ""}
        ${yonetici() ? `<label class="bot-oto" title="Kapatınca bot kendiliğinden oynamaz; sırası gelince sen onun yerine oynarsın"><input type="checkbox" data-bot-oto="${k}"${x.oto !== false ? " checked" : ""}> Otomatik oynasın</label>${x.oto === false && !d.bitti && d.sira === k ? `<button class="btn" data-bot-adim="${k}" title="Botun kendi seçtiği hamleyi yaptır">Bot hamlesini yap</button>` : ""}` : ""}</div>` : "";
      return `<div class="koltuk${x && x.bot ? " bot" : ""}" data-sira="${!d.bitti && d.sira === k ? 1 : 0}"><span class="tas k${renk(k)}"></span><span>${esc(RENK[k])}: ${x ? kisiA(x) : "<i>boş</i>"}</span><span class="sp"></span>
        ${mine ? `<button class="btn" data-kalk="${k}">Kalk</button>` : x ? "" : `<button class="btn pri" data-otur="${k}">Otur</button>${botDug}`}</div>${botAyar}`;
    };
    $("#ana").dataset.lobi = "";
    $("#ana").innerHTML = odaBaslik(id, b) + `
      <div class="oyun" data-oyun="${esc(b.oyun)}"><div class="tahta">${CIZICI[b.oyun](d, { ipucu, secim, cevir }).replace(/^<svg([^>]*)>/, "<svg$1>" + TAS_DEFS)}</div>
      <div class="yan">
        <div class="kutu"><h3>${esc(g.ad)}</h3>${koltukHtml(0)}${koltukHtml(1)}
          <div class="durum${d.bitti ? " bitti" : ""}">${esc(durumMetni)}</div>
          ${b.oyun === "ur" ? urZarHtml(b) : ""}
          <div class="hata" role="alert">${esc(hataMetni)}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-sifirla>Yeniden başlat</button><button class="btn tehlike" data-sil>Tahtayı kapat</button></div></div>
        ${rehberHtml(b, oynayabilir)}
        <div class="kutu"><h3>Kurallar</h3><ul class="kurallar">${g.kurallar.map(k => `<li>${esc(k)}</li>`).join("")}</ul>
          <p class="bos" style="margin:0;font-size:13px">Tek bilgisayarda iki kişi oynayacaksanız iki koltuğa da oturabilirsin. Rakip yoksa boş koltuğa bir bot oturt.</p></div>
      </div></div>`;
  }

  // Sıra sende: yapman gerekenler, öne çıkan hamleler ve ipuçları (web/oyunlar/rehber.js).
  const rehberKapali = () => LS.get("zm-rehber") === "0";
  function rehberHtml(b, oynayabilir) {
    if (!window.ZM_REHBER) return "";
    const d = b.durum;
    if (rehberKapali()) return `<div class="kutu rehber kapali"><button class="btn" data-rehber-ac>💡 Sıra rehberini göster</button></div>`;
    if (d.bitti) return "";
    if (!oynayabilir) {
      const k = b.koltuk[d.sira];
      return `<div class="kutu rehber"><div class="rehber-bas"><h3>💡 Sıra rehberi</h3><button class="btn ince" data-rehber-kapat title="Rehberi gizle">Gizle</button></div>
        <p class="bos" style="margin:0">${k ? `Sıra ${esc(k.name)} oyuncusunda.` : "Sıradaki koltuk boş."} Sıra sana gelince burada yapman gerekenler, öne çıkan hamleler ve ipuçları görünür.</p></div>`;
    }
    const a = ZM_REHBER.analiz(b.oyun, d, { cevir: benimKoltuklarim(b).length === 1 && benimKoltuklarim(b)[0] === 1 }); if (!a) return "";
    rehberSecenekleri = a.secenekler;
    return `<div class="kutu rehber sende"><div class="rehber-bas"><h3>💡 Sıra sende${a.baslik ? ": " + esc(a.baslik) : ""}</h3><button class="btn ince" data-rehber-kapat title="Rehberi gizle">Gizle</button></div>
      ${a.yapmalisin.length ? `<div class="rehber-bolum"><b>Yapman gereken</b><ul>${a.yapmalisin.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
      ${a.uyarilar.length ? `<div class="rehber-uyari" role="alert">${a.uyarilar.map(esc).join("<br>")}</div>` : ""}
      ${a.secenekler.length ? `<div class="rehber-bolum"><b>Yapabileceklerin</b> <small>${a.toplam} yasal hamle</small><ul class="rehber-hamleler">${a.secenekler.map((s, i) => `<li><span>${esc(s.aciklama)}</span>
        <span class="etiketler">${s.etiketler.map(e => `<i class="et ${e.tur}">${esc(e.metin)}</i>`).join("")}</span><button class="btn ince" data-rehber-goster="${i}"${oneri && ayni(oneri, s.hamle) ? ' aria-pressed="true"' : ""}>Göster</button></li>`).join("")}</ul></div>` : ""}
      ${a.ipuclari.length ? `<div class="rehber-bolum"><b>İpuçları</b><ul class="ipuclari">${a.ipuclari.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}</div>`;
  }
  let rehberSecenekleri = [];

  function urZarHtml(b) {
    const d = b.durum; if (d.bitti) return "";
    const pas = (d.pas || []).map(x => `${koltukAdi(b, x.p)} ${x.zar} attı, sıra geçti`).join(" · ");
    return `<div class="zarlar"><span>Zar:</span>${(d.zarlar || []).map(z => `<i class="${z ? "bir" : ""}">${z}</i>`).join("")}<b class="num">= ${d.zar}</b></div>${pas ? `<div class="bos" style="font-size:13px">${esc(pas)}</div>` : ""}`;
  }

  /* ---------------- Tıklama ---------------- */
  document.addEventListener("click", async e => {
    const id = acikId(), b = id && tahtalar.get(id);
    const yeni = e.target.closest("[data-yeni]");
    try {
      if (yeni) {
        const ad = await odaAdiSor(OYUNLAR[yeni.dataset.yeni].ad); if (ad == null) return;
        const r = await call("bgNew", { oyun: yeni.dataset.yeni, ad }); await call("bgSit", { board: r.id, koltuk: 0 }); location.hash = r.id; return;
      }
      const adDeg = e.target.closest("[data-oda-ad]");
      if (adDeg) {
        const bb = tahtalar.get(adDeg.dataset.odaAd); if (!bb) return;
        const oyunAd = bb.oyun === "kart" ? (bb.tanim || {}).ad : OYUNLAR[bb.oyun].ad;
        const ad = await odaAdiSor(oyunAd, bb.ad || "", "Odanın adı"); if (ad == null) return;
        await call("bgAd", { board: adDeg.dataset.odaAd, ad }); return;
      }
      if (e.target.closest("[data-f-benim]")) { F.benim = !F.benim; sakla(); return lobiYenile(true); }
      if (e.target.closest("[data-f-benim2]")) { F.benim2 = !F.benim2; sakla(); return lobiYenile(true); }
      if (e.target.closest("[data-f-temizle]")) { Object.assign(F, { q: "", tur: "", oyun: "", durum: "", benim: false }); sakla(); return lobiYenile(true); }
      if (e.target.closest("[data-f-temizle2]")) { Object.assign(F, { q2: "", tur2: "", oyuncu: "", benim2: false }); sakla(); return lobiYenile(true); }
      const acikOyun = e.target.closest("[data-acik-oyun]");
      if (acikOyun) { Object.assign(F, { q: "", tur: "", durum: "", benim: false, oyun: acikOyun.dataset.acikOyun }); sakla(); location.hash = "acik"; return; }
      if (e.target.closest("[data-rehber-kapat]")) { LS.set("zm-rehber", "0"); oneri = null; return ciz(); }
      if (e.target.closest("[data-rehber-ac]")) { LS.set("zm-rehber", "1"); return ciz(); }
      const goster = e.target.closest("[data-rehber-goster]");
      if (goster) { const s = rehberSecenekleri[+goster.dataset.rehberGoster]; if (s) { oneri = oneri && ayni(oneri, s.hamle) ? null : s.hamle; secim = oneri ? oneri.slice(0, -1) : []; } return ciz(); }
      if (!b || b.oyun === "kart") return;
      const o = e.target.closest("[data-otur]"), k = e.target.closest("[data-kalk]");
      if (o) return await call("bgSit", { board: id, koltuk: +o.dataset.otur });
      if (k) return await call("bgSit", { board: id, koltuk: +k.dataset.kalk, kalk: true });
      const bot = e.target.closest("[data-bot-ekle],[data-bot-cikar],[data-bot-adim]");
      if (bot) {
        if (bot.dataset.botEkle) return await call("botEkle", { board: id, koltuk: +bot.dataset.botEkle, zorluk: "orta" });
        if (bot.dataset.botCikar) return await call("botCikar", { board: id, koltuk: +bot.dataset.botCikar });
        return await call("botAdim", { board: id, koltuk: +bot.dataset.botAdim });
      }
      if (e.target.closest("[data-sifirla]")) { if (confirm("Oyun baştan başlasın mı?")) await call("bgReset", { board: id }); return; }
      if (e.target.closest("[data-sil]")) { if (confirm("Tahta herkes için kapansın mı?")) { await call("bgDelete", { board: id }); location.hash = ""; } return; }
      const kare = e.target.closest("[data-k]");
      if (kare) return kareTik(id, b, +kare.dataset.k);
    } catch (err) { hataMetni = err.message; secim = []; ciz(); }
  });

  async function kareTik(id, b, k) {
    const g = OYUNLAR[b.oyun], d = b.durum;
    if (d.bitti || !oynadigimKoltuklar(b).includes(d.sira)) return;
    const yasal = g.hamleler(d), yeni = secim.concat(k);
    let uyan = yasal.filter(h => ayni(h.slice(0, yeni.length), yeni));
    oneri = null;
    if (!uyan.length) { secim = yasal.some(h => h[0] === k) ? [k] : []; hataMetni = ""; return ciz(); }
    secim = yeni; hataMetni = "";
    const tam = uyan.find(h => h.length === secim.length);
    if (tam && uyan.length === 1) {
      secim = []; ciz();
      const botun = b.koltuk[d.sira] && b.koltuk[d.sira].bot; // yönetici botun yerine oynuyor
      await call(botun ? "botHamle" : "bgMove", botun ? { board: id, koltuk: d.sira, hamle: tam } : { board: id, hamle: tam });
      return;
    }
    ciz();
  }

  document.addEventListener("change", async e => {
    const id = acikId(), b = id && tahtalar.get(id); if (!b || b.oyun === "kart") return;
    const z = e.target.closest("[data-bot-zorluk]"), o = e.target.closest("[data-bot-oto]");
    try {
      if (z) await call("botAyar", { board: id, koltuk: +z.dataset.botZorluk, zorluk: z.value });
      if (o) await call("botAyar", { board: id, koltuk: +o.dataset.botOto, oto: o.checked });
    } catch (err) { hataMetni = err.message; ciz(); }
  });

  /* ---------------- Tahta çizimleri (SVG) ---------------- */
  // Taşlar: ışık alan, hafif gölgeli; her oyunun taş renkleri oyunlar.css'te (data-oyun).
  const TAS_DEFS = `<defs>${[0, 1].map(p => `<radialGradient id="tg${p}" cx="38%" cy="32%" r="70%"><stop offset="0" style="stop-color:var(--p${p}-isik,var(--p${p}))"/><stop offset=".7" style="stop-color:var(--p${p})"/><stop offset="1" style="stop-color:var(--p${p}-line)"/></radialGradient>`).join("")}
    <filter id="tgolge" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="1.5" dy="2.5" stdDeviation="1.6" flood-opacity=".45"/></filter></defs>`;
  const tas = (x, y, r, p, ek = "") => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#tg${p})" stroke="var(--p${p}-line)" stroke-width="2" filter="url(#tgolge)" ${ek}/><circle cx="${x}" cy="${y}" r="${r * 0.62}" fill="none" stroke="var(--p${p}-line)" stroke-opacity=".35" stroke-width="1.5"/>`;
  // Izgaralı tahtaların kenarında harf (alt sıra) ve rakam (sol sütun): rehberdeki "c3 → c4" gibi adlar bunlarla okunur.
  const SUTUN = "abcdefghijk";
  const koordinat = (x, y, S, n) => (y / S === n - 1 ? `<text class="koord" x="${x + S - 4}" y="${y + S - 4}" text-anchor="end">${SUTUN[x / S]}</text>` : "") + (x === 0 ? `<text class="koord" x="${x + 3}" y="${y + 12}">${n - y / S}</text>` : "");
  const ipucuDaire = (x, y, r) => `<circle class="ipucu" cx="${x}" cy="${y}" r="${r}" opacity=".55"/>`;

  const CIZICI = {
    mangala(d, { ipucu, cevir }) {
      // Saatin tersi: alt sıra (0–5) soldan sağa, sağda 6, üst sıra (7–12) sağdan sola, solda 13.
      const W = 860, H = 320, out = [`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Mangala tahtası"><rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="40" fill="var(--wood)" stroke="var(--wood-2)" stroke-width="6"/>`];
      const yer = i => {
        const k = cevir ? (i + 7) % 14 : i, alt = k <= 5, j = alt ? k : 12 - k;
        return { x: 150 + j * 112, y: alt ? 222 : 98 };
      };
      const hz = p => ({ x: (p === 0) !== cevir ? W - 62 : 62, y: H / 2 });
      const taslar = (cx, cy, n, r) => { let s = ""; for (let t = 0; t < Math.min(n, 18); t++) { const a = t * 2.4, rr = 6 + 3.2 * Math.sqrt(t); s += `<circle cx="${cx + Math.cos(a) * rr * (r / 40)}" cy="${cy + Math.sin(a) * rr * (r / 40) * 1.6}" r="6" fill="var(--p${t % 2})" stroke="var(--wood-ink)" stroke-width="1" opacity=".9"/>`; } return s; };
      for (const p of [0, 1]) {
        const { x, y } = hz(p), i = p === 0 ? 6 : 13;
        out.push(`<rect x="${x - 40}" y="${y - 110}" width="80" height="220" rx="38" fill="var(--wood-2)"/>${taslar(x, y, d.a[i], 40)}<text x="${x}" y="${y + 135}" text-anchor="middle" font-size="18" font-weight="700" fill="var(--wood-ink)" class="num">${d.a[i]}</text>`);
      }
      for (let i = 0; i < 13; i++) {
        if (i === 6) continue;
        const { x, y } = yer(i), son = d.son && d.son[0] === i;
        out.push(`<g class="k" data-k="${i}"><circle cx="${x}" cy="${y}" r="46" fill="var(--wood-2)" ${son ? 'stroke="var(--gold)" stroke-width="4"' : ""}/>${taslar(x, y, d.a[i], 46)}
          <text x="${x}" y="${y + (y > H / 2 ? 72 : -56)}" text-anchor="middle" font-size="18" font-weight="700" fill="var(--wood-ink)">${d.a[i]}</text>
          ${ipucu.has(i) ? `<circle class="secili" cx="${x}" cy="${y}" r="48"/>` : ""}</g>`);
      }
      return out.join("") + "</svg>";
    },

    dama(d, { ipucu, secim, cevir }) {
      const S = 60, out = [`<svg viewBox="0 0 ${S * 8} ${S * 8}" role="img" aria-label="Dama tahtası">`];
      const xy = i => { let r = Math.floor(i / 8), c = i % 8; if (cevir) { r = 7 - r; c = 7 - c; } return [c * S, r * S]; };
      const sonlar = new Set(d.son || []);
      for (let i = 0; i < 64; i++) {
        const [x, y] = xy(i), v = d.b[i];
        out.push(`<g class="k" data-k="${i}"><rect x="${x}" y="${y}" width="${S}" height="${S}" fill="${(Math.floor(i / 8) + i) % 2 ? "var(--wood-2)" : "var(--wood)"}"/>`);
        if (sonlar.has(i)) out.push(`<rect class="son" x="${x + 2}" y="${y + 2}" width="${S - 4}" height="${S - 4}"/>`);
        if (v) {
          const p = v <= 2 ? 0 : 1;
          out.push(tas(x + S / 2, y + S / 2, S * 0.38, p));
          if (v === 2 || v === 4) out.push(`<circle cx="${x + S / 2}" cy="${y + S / 2}" r="${S * 0.2}" fill="none" stroke="var(--gold)" stroke-width="4"/>`);
        }
        if (secim.includes(i)) out.push(`<rect class="secili" x="${x + 2}" y="${y + 2}" width="${S - 4}" height="${S - 4}"/>`);
        if (ipucu.has(i)) out.push(v && secim.length === 0 ? `<circle class="secili" cx="${x + S / 2}" cy="${y + S / 2}" r="${S * 0.43}" opacity=".6"/>` : ipucuDaire(x + S / 2, y + S / 2, S * 0.16));
        out.push(koordinat(x, y, S, 8), "</g>");
      }
      return out.join("") + "</svg>";
    },

    dokuztas(d, { ipucu, secim }) {
      const G = 70, M = 40, P = i => [M + OYUNLAR.dokuztas.xy[i][0] * G, M + OYUNLAR.dokuztas.xy[i][1] * G], W = M * 2 + 6 * G;
      const out = [`<svg viewBox="0 0 ${W} ${W + 60}" role="img" aria-label="Dokuz taş tahtası"><rect x="0" y="0" width="${W}" height="${W}" rx="14" fill="var(--wood)"/>`];
      const cizgiler = new Set();
      OYUNLAR.dokuztas.komsu.forEach((ks, a) => ks.forEach(b => { if (a < b) cizgiler.add(a + "-" + b); }));
      for (const c of cizgiler) { const [a, b] = c.split("-").map(Number), [x1, y1] = P(a), [x2, y2] = P(b); out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--wood-ink)" stroke-width="4"/>`); }
      const sonlar = new Set(d.son || []);
      for (let i = 0; i < 24; i++) {
        const [x, y] = P(i), v = d.b[i];
        out.push(`<g class="k" data-k="${i}"><circle cx="${x}" cy="${y}" r="26" fill="transparent"/><circle cx="${x}" cy="${y}" r="7" fill="var(--wood-ink)"/>`);
        if (sonlar.has(i)) out.push(`<circle class="son" cx="${x}" cy="${y}" r="26"/>`);
        if (v >= 0) out.push(tas(x, y, 22, v));
        if (secim.includes(i)) out.push(`<circle class="secili" cx="${x}" cy="${y}" r="26"/>`);
        if (ipucu.has(i)) out.push(v >= 0 ? `<circle class="secili" cx="${x}" cy="${y}" r="26" opacity=".6"/>` : ipucuDaire(x, y, 12));
        out.push(`<text class="koord" x="${x + 11}" y="${y - 10}">${i + 1}</text></g>`);
      }
      // Eldeki taşlar
      for (const p of [0, 1]) for (let t = 0; t < d.elde[p]; t++) out.push(tas(p === 0 ? 24 + t * 24 : W - 24 - t * 24, W + 30, 10, p));
      return out.join("") + "</svg>";
    },

    hnefatafl(d, { ipucu, secim, cevir }) {
      const H = OYUNLAR.hnefatafl, N = H.tahta, S = 50, out = [`<svg viewBox="0 0 ${S * N} ${S * N}" role="img" aria-label="Hnefatafl tahtası">`];
      const xy = i => { let r = Math.floor(i / N), c = i % N; if (cevir) { r = N - 1 - r; c = N - 1 - c; } return [c * S, r * S]; };
      const sonlar = new Set(d.son || []);
      for (let i = 0; i < N * N; i++) {
        const [x, y] = xy(i), v = d.b[i], ozel = i === H.taht || H.koseler.includes(i);
        out.push(`<g class="k" data-k="${i}"><rect x="${x}" y="${y}" width="${S}" height="${S}" fill="${ozel ? "var(--wood-2)" : "var(--wood)"}" stroke="var(--wood-2)" stroke-width="1.5"/>`);
        if (ozel) out.push(`<path d="M${x + 10} ${y + 10}L${x + S - 10} ${y + S - 10}M${x + S - 10} ${y + 10}L${x + 10} ${y + S - 10}" stroke="var(--wood-ink)" stroke-width="2" opacity=".5"/>`);
        if (sonlar.has(i)) out.push(`<rect class="son" x="${x + 2}" y="${y + 2}" width="${S - 4}" height="${S - 4}"/>`);
        if (v === 1) out.push(tas(x + S / 2, y + S / 2, S * 0.36, 1));
        if (v === 2) out.push(tas(x + S / 2, y + S / 2, S * 0.36, 0));
        if (v === 3) out.push(tas(x + S / 2, y + S / 2, S * 0.42, 0) + `<path d="M${x + S / 2 - 11} ${y + S / 2 + 7}l-3-14 8 6 6-10 6 10 8-6-3 14z" fill="var(--gold)" stroke="var(--wood-ink)" stroke-width="1.2"/>`);
        if (secim.includes(i)) out.push(`<rect class="secili" x="${x + 2}" y="${y + 2}" width="${S - 4}" height="${S - 4}"/>`);
        if (ipucu.has(i)) out.push(v && secim.length === 0 ? `<circle class="secili" cx="${x + S / 2}" cy="${y + S / 2}" r="${S * 0.42}" opacity=".6"/>` : ipucuDaire(x + S / 2, y + S / 2, S * 0.14));
        out.push(koordinat(x, y, S, N), "</g>");
      }
      return out.join("") + "</svg>";
    },

    ur(d, { ipucu, secim }) {
      const S = 70, Y0 = 70, U = OYUNLAR.ur, out = [`<svg viewBox="0 0 ${S * 8} ${Y0 * 2 + S * 3}" role="img" aria-label="Ur tahtası">`];
      const hucre = new Map(); // kare -> [oyuncu]
      for (const p of [0, 1]) for (const k of d.t[p]) if (k > 0 && k < 15) hucre.set(U.kare(p, k), p);
      const sonlar = new Set(d.son || []);
      for (let i = 0; i < 24; i++) {
        if (U.yok.includes(i)) continue;
        const x = (i % 8) * S, y = Y0 + Math.floor(i / 8) * S;
        out.push(`<g class="k" data-k="${i}"><rect x="${x + 2}" y="${y + 2}" width="${S - 4}" height="${S - 4}" rx="6" fill="var(--wood)" stroke="var(--wood-2)" stroke-width="3"/>`);
        if (U.rozetler.includes(i)) out.push(`<g transform="translate(${x + S / 2} ${y + S / 2})" fill="var(--wood-2)">${[0, 45, 90, 135].map(a => `<ellipse rx="26" ry="8" transform="rotate(${a})"/>`).join("")}<circle r="7" fill="var(--gold)"/></g>`);
        if (sonlar.has(i)) out.push(`<rect class="son" x="${x + 4}" y="${y + 4}" width="${S - 8}" height="${S - 8}"/>`);
        if (hucre.has(i)) out.push(tas(x + S / 2, y + S / 2, 22, hucre.get(i)));
        if (secim.includes(i)) out.push(`<rect class="secili" x="${x + 4}" y="${y + 4}" width="${S - 8}" height="${S - 8}"/>`);
        if (ipucu.has(i)) out.push(hucre.has(i) && secim.length === 0 ? `<circle class="secili" cx="${x + S / 2}" cy="${y + S / 2}" r="26" opacity=".6"/>` : ipucuDaire(x + S / 2, y + S / 2, 12));
        out.push("</g>");
      }
      // Havuz ve çıkış alanları: ikinci oyuncu üstte, birinci altta.
      for (const p of [0, 1]) {
        const y = p === 0 ? Y0 + S * 3 + 6 : 4, havuz = d.t[p].filter(k => k === 0).length, cikan = d.t[p].filter(k => k === 15).length;
        const alan = (key, x, w, n, etiket) => `<g class="k" data-k="${key}"><rect x="${x}" y="${y}" width="${w}" height="${Y0 - 10}" rx="8" fill="var(--surface-2)" stroke="var(--line)"/>
          ${Array.from({ length: n }, (_, t) => tas(x + 22 + t * 26, y + (Y0 - 10) / 2, 10, p)).join("")}<text x="${x + w - 8}" y="${y + 18}" text-anchor="end" font-size="13" fill="var(--muted)">${etiket}</text>
          ${ipucu.has(key) ? `<rect class="secili" x="${x}" y="${y}" width="${w}" height="${Y0 - 10}" rx="8"/>` : ""}${secim.includes(key) ? `<rect class="secili" x="${x}" y="${y}" width="${w}" height="${Y0 - 10}" rx="8"/>` : ""}</g>`;
        out.push(alan(100 + p, 0, S * 4 - 6, havuz, "Başlangıç"), alan(200 + p, S * 4 + 6, S * 4 - 6, cikan, "Çıkış"));
      }
      return out.join("") + "</svg>";
    },
  };

  basla();
})();
