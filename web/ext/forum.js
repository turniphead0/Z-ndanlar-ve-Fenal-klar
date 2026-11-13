/* Ana ekran (lobi): arama çubuğu, filtreler ve basit bir forum.
   - Arama ve filtreler hem masaları hem forum başlıklarını süzer.
   - Forum başlıkları forum/<id>, yanıtlar forum/<id>/yanitlar/<id> belgelerinde durur.
     Okuma db aboneliğiyle, yazma sunucu işlemleriyle (window.zmForum) yapılır; böylece
     yazar adı taklit edilemez ve kimse başkasının iletisini değiştiremez. */
(function () {
  "use strict";
  if (!window.zmForum) return; // sunucusuz (tek tarayıcı) kipte forum yok
  const ZF = window.zmForum;

  // Durum: süzgeçler oturum boyunca kalır.
  const F = { q: "", goster: "hepsi", sistem: "", katilim: "", kategori: "", konular: {}, yuklendi: false, acik: null, yanitlar: {}, yeni: false, taslak: { baslik: "", govde: "", kategori: "Genel sohbet", sistem: "" }, yanitTaslak: "", gonderiyor: false };
  let KATEGORI = ["Genel sohbet", "Oyuncu arıyorum", "Masa arıyorum", "Kurallar", "Paylaşım"];
  fetch("/api/info").then(r => r.json()).then(i => { if (Array.isArray(i.forum) && i.forum.length) KATEGORI = i.forum; }).catch(() => {});
  try { const s = JSON.parse(sessionStorage.getItem("zm-lobi-suzgec") || "{}"); for (const k of ["goster", "sistem", "katilim", "kategori"]) if (typeof s[k] === "string") F[k] = s[k]; } catch (e) {}
  const sakla = () => { try { sessionStorage.setItem("zm-lobi-suzgec", JSON.stringify({ goster: F.goster, sistem: F.sistem, katilim: F.katilim, kategori: F.kategori })); } catch (e) {} };

  // "Zından" ile "zindan" aynı sonucu versin: küçük harf ve Türkçe işaretsiz karşılaştır.
  const sade = s => String(s || "").toLocaleLowerCase("tr").replace(/[ıîİ]/g, "i").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ö/g, "o").replace(/[üû]/g, "u").replace(/â/g, "a").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const uyar = (q, ...alan) => { const w = sade(q).split(/\s+/).filter(Boolean); if (!w.length) return true; const t = sade(alan.join(" ")); return w.every(x => t.includes(x)); };
  const sysAd = k => (SYSINFO[k] || {}).short || "";

  /* ---------- Abonelikler ---------- */
  let konuAbone = null, yanitAbone = null, yanitAcik = null;
  function abone() {
    if (konuAbone || !DB || LOCAL) return;
    konuAbone = DB.collection("forum").onSnapshot(snap => {
      for (const ch of snap.docChanges()) { if (ch.type === "removed") delete F.konular[ch.doc.id]; else F.konular[ch.doc.id] = { id: ch.doc.id, ...ch.doc.data() }; }
      F.yuklendi = true;
      if (F.acik && !F.konular[F.acik]) { F.acik = null; toast("Bu başlık silindi"); }
      yenile();
    }, () => {});
  }
  function yanitlaraAbone() {
    if (yanitAcik === F.acik) return;
    if (yanitAbone) { try { yanitAbone(); } catch (e) {} yanitAbone = null; }
    yanitAcik = F.acik; F.yanitlar = {};
    if (!F.acik) return;
    const id = F.acik;
    yanitAbone = DB.collection("forum/" + id + "/yanitlar").onSnapshot(snap => {
      if (F.acik !== id) return;
      for (const ch of snap.docChanges()) { if (ch.type === "removed") delete F.yanitlar[ch.doc.id]; else F.yanitlar[ch.doc.id] = { id: ch.doc.id, ...ch.doc.data() }; }
      yenile();
    }, () => {});
  }
  // Lobi açıksa yalnızca bizim bölümleri yeniden çiz (arama kutusundaki odak kaybolmasın).
  function yenile() { if (!G.id && document.querySelector("#lobby .zf-bar")) uygula(); }

  /* ---------- Araç çubuğu ---------- */
  const secenek = (v, cur, label) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(label)}</option>`;
  function bar() {
    const seg = [["hepsi", "Hepsi"], ["masalar", "Masalar"], ["forum", "Forum"]].map(([k, l]) => `<button type="button" class="chip" data-zf-goster="${k}" aria-pressed="${F.goster === k}">${l}</button>`).join("");
    return `<div class="zf-bar" role="search">
      <label class="zf-ara"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input class="f" type="search" id="zfAra" placeholder="Masalarda ve forumda ara" aria-label="Masalarda ve forumda ara" value="${esc(F.q)}" autocomplete="off"></label>
      <div class="chips zf-seg">${seg}</div>
      <div class="zf-sel">
        <select class="f" data-zf="sistem" aria-label="Oyun sistemi">${secenek("", F.sistem, "Tüm sistemler")}${Object.entries(SYSINFO).map(([k, v]) => secenek(k, F.sistem, v.short)).join("")}</select>
        ${F.goster !== "forum" ? `<select class="f" data-zf="katilim" aria-label="Katılım">${secenek("", F.katilim, "Her katılım")}${secenek("acik", F.katilim, "Açık katılım")}${secenek("onayli", F.katilim, "Onaylı katılım")}${secenek("cevrimici", F.katilim, "Şu an masada biri var")}</select>` : ""}
        ${F.goster !== "masalar" ? `<select class="f" data-zf="kategori" aria-label="Forum kategorisi">${secenek("", F.kategori, "Tüm kategoriler")}${KATEGORI.map(k => secenek(k, F.kategori, k)).join("")}</select>` : ""}
        ${F.q || F.sistem || F.katilim || F.kategori ? `<button type="button" class="btn sm" data-zf-temizle>Süzgeçleri temizle</button>` : ""}
      </div></div>`;
  }

  /* ---------- Masaları süz ---------- */
  function masaUyar(g) {
    if (F.sistem && (g.system || "dnd5e") !== F.sistem) return false;
    if (F.katilim === "acik" && g.open === false) return false;
    if (F.katilim === "onayli" && g.open !== false) return false;
    if (F.katilim === "cevrimici" && !PEERS.some(p => (p.presence || {}).g === g.id)) return false;
    const dms = Object.entries(g.dms || {}).filter(([, v]) => v).map(([k]) => nameOf(k));
    return uyar(F.q, g.name, g.desc, sysAd(g.system || "dnd5e"), (SYSINFO[g.system || "dnd5e"] || {}).name, dms.join(" "));
  }
  function masalariSuz(root) {
    const gizle = F.goster === "forum";
    let toplam = 0, gorunen = 0;
    root.querySelectorAll(".lwrap > section:not(.zf-forum)").forEach(sec => {
      let n = 0;
      sec.querySelectorAll(".gcard[data-gid]").forEach(card => { const g = S.games[card.dataset.gid]; const ok = !!g && masaUyar(g); card.hidden = !ok; toplam++; if (ok) n++; });
      gorunen += n; sec.hidden = gizle || n === 0;
    });
    root.querySelectorAll(".lwrap > .empty").forEach(e => { e.hidden = gizle; });
    let bos = root.querySelector(".zf-masabos");
    const goster = !gizle && toplam > 0 && gorunen === 0;
    if (goster && !bos) { bos = document.createElement("div"); bos.className = "empty zf-masabos"; bos.innerHTML = "<h2>Aramana uyan masa yok</h2><p>Başka bir kelime dene ya da süzgeçleri temizle.</p>"; const f = root.querySelector(".zf-forum"); f ? f.before(bos) : root.querySelector(".lwrap").appendChild(bos); }
    if (bos) bos.hidden = !goster;
  }

  /* ---------- Forum ---------- */
  const konuUyar = t => (!F.kategori || t.kategori === F.kategori) && (!F.sistem || t.sistem === F.sistem) && uyar(F.q, t.baslik, t.govde, t.yazar && t.yazar.name, t.kategori, sysAd(t.sistem));
  const nokta = (y, cls) => `<span class="pdot sm ${cls || ""}" data-noi18n style="background:${esc((y && y.color) || "#7f8c8d")}">${esc(((y && y.name) || "?")[0].toLocaleUpperCase("tr"))}</span>`;
  const yazarAdi = y => (y && y.id === ME.id ? "Sen" : `<span data-noi18n>${esc((y && y.name) || "Bir oyuncu")}</span>`);
  const silebilir = y => !!y && (y.id === ME.id || ZF.isOwner());

  function yeniForm() {
    const d = F.taslak;
    return `<form class="panel zf-yeni" data-zf-form="konu"><h3>Yeni başlık</h3>
      <label><span class="lbl">Başlık</span><input class="f" id="zfBaslik" maxlength="120" required placeholder="Cuma akşamı CoC oyununa 2 oyuncu arıyoruz" value="${esc(d.baslik)}"></label>
      <div class="zf-iki"><label><span class="lbl">Kategori</span><select class="f" id="zfKategori">${KATEGORI.map(k => secenek(k, d.kategori, k)).join("")}</select></label>
        <label><span class="lbl">Sistem (isteğe bağlı)</span><select class="f" id="zfSistem">${secenek("", d.sistem, "Belirtilmemiş")}${Object.entries(SYSINFO).map(([k, v]) => secenek(k, d.sistem, v.short)).join("")}</select></label></div>
      <label><span class="lbl">İleti</span><textarea class="f" id="zfGovde" maxlength="4000" placeholder="Ne zaman, hangi sistem, kaç kişi, yeni başlayanlar katılabilir mi…">${esc(d.govde)}</textarea></label>
      <div class="chips"><button class="btn pri" type="submit" ${F.gonderiyor ? "disabled" : ""}>Başlığı aç</button><button class="btn" type="button" data-zf-act="vazgec">Vazgeç</button></div></form>`;
  }

  function konuSatiri(t) {
    return `<button type="button" class="zf-konu ${t.sabit ? "sabit" : ""}" data-zf-ac="${esc(t.id)}">
      ${nokta(t.yazar)}
      <span class="zf-kb"><span class="zf-kt">${t.sabit ? '<span class="zf-pin">Sabit</span>' : ""}<b data-noi18n>${esc(t.baslik)}</b></span>
        <span class="zf-km"><span class="zf-kat">${esc(t.kategori || "Genel sohbet")}</span>${t.sistem ? `<span class="rbadge sys">${esc(sysAd(t.sistem))}</span>` : ""}${yazarAdi(t.yazar)} · <span>${ago(t.created)}</span></span></span>
      <span class="zf-ks"><span><b>${t.yanit || 0}</b> yanıt</span>${t.yanit ? `<small>son: ${esc(t.sonYazan || "")} · ${ago(t.updated)}</small>` : ""}</span></button>`;
  }

  function konuDetay(t) {
    const yan = Object.values(F.yanitlar).sort((a, b) => a.created - b.created);
    const ileti = (y, govde, zaman, sil) => `<article class="zf-ileti">${nokta(y)}<div><div class="zf-ib"><b>${yazarAdi(y)}</b><small>${ago(zaman)}</small><span class="sp"></span>${sil || ""}</div><p class="zf-metin" data-noi18n>${esc(govde || "")}</p></div></article>`;
    return `<div class="zf-detay">
      <div class="zf-dh"><button type="button" class="btn sm" data-zf-act="geri">← Forum</button><span class="sp"></span>
        ${ZF.isOwner() ? `<button type="button" class="btn sm" data-zf-act="sabitle">${t.sabit ? "Sabitlemeyi kaldır" : "Başa sabitle"}</button>` : ""}
        ${silebilir(t.yazar) ? `<button type="button" class="btn sm danger" data-zf-act="konusil">Başlığı sil</button>` : ""}</div>
      <h3 class="zf-dbaslik" data-noi18n>${esc(t.baslik)}</h3>
      <p class="zf-km"><span class="zf-kat">${esc(t.kategori || "Genel sohbet")}</span>${t.sistem ? `<span class="rbadge sys">${esc(sysAd(t.sistem))}</span>` : ""}</p>
      ${ileti(t.yazar, t.govde, t.created)}
      ${yan.map(p => ileti(p.yazar, p.govde, p.created, silebilir(p.yazar) ? `<button type="button" class="btn sm danger" data-zf-act="yanitsil" data-zf-id="${esc(p.id)}">Sil</button>` : "")).join("")}
      ${S.ro ? "" : `<form class="zf-yanit" data-zf-form="yanit"><label><span class="lbl">Yanıt yaz</span><textarea class="f" id="zfYanit" maxlength="4000" placeholder="Yanıtın…">${esc(F.yanitTaslak)}</textarea></label>
        <div class="chips"><button class="btn pri" type="submit" ${F.gonderiyor ? "disabled" : ""}>Gönder</button></div></form>`}
    </div>`;
  }

  function forumHtml() {
    if (F.acik && F.konular[F.acik]) return konuDetay(F.konular[F.acik]);
    const hepsi = Object.values(F.konular);
    const liste = hepsi.filter(konuUyar).sort((a, b) => (b.sabit - a.sabit) || (b.updated || 0) - (a.updated || 0));
    let govde;
    if (!F.yuklendi) govde = `<div class="empty"><h2>Forum yükleniyor</h2></div>`;
    else if (!hepsi.length) govde = `<div class="empty"><h2>Forumda henüz başlık yok</h2><p>Oyuncu ara, kural sor, hazırladığın haritayı paylaş.</p></div>`;
    else if (!liste.length) govde = `<div class="empty zf-bos"><h2>Aramana uyan başlık yok</h2><p>Başka bir kelime dene ya da süzgeçleri temizle.</p></div>`;
    else govde = `<div class="zf-liste">${liste.map(konuSatiri).join("")}</div>`;
    return `${F.yeni ? yeniForm() : ""}${govde}`;
  }

  function forumBolumu(root) {
    let sec = root.querySelector(".zf-forum");
    if (!sec) { sec = document.createElement("section"); sec.className = "zf-forum"; root.querySelector(".lwrap").appendChild(sec); }
    sec.hidden = F.goster === "masalar";
    if (sec.hidden) return;
    // Yazı yazılan alan varsa o alanı koru (abonelikten gelen değişiklik yazıyı silmesin).
    const a = document.activeElement;
    if (a && sec.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) { bekleyen = true; return; }
    const n = Object.values(F.konular).length;
    sec.innerHTML = `<div class="zf-fh"><h2 class="lsec">Forum${n ? ` <small>${n} başlık</small>` : ""}</h2><span class="sp"></span>${S.ro || F.yeni || F.acik ? "" : `<button type="button" class="btn pri" data-zf-act="yeni">+ Yeni başlık</button>`}</div>${forumHtml()}`;
  }
  let bekleyen = false;
  document.addEventListener("focusout", () => setTimeout(() => { if (bekleyen && !G.id) { bekleyen = false; uygula(); } }, 60));

  function uygula() {
    const root = document.getElementById("lobby");
    if (!root || G.id) return;
    const wrap = root.querySelector(".lwrap"); if (!wrap) return;
    if (!root.querySelector(".zf-bar")) {
      const ref = wrap.querySelector(".robanner") || wrap.querySelector(".lhead");
      ref.insertAdjacentHTML("afterend", bar());
    }
    masalariSuz(root); forumBolumu(root); yanitlaraAbone();
  }
  function barYenile() { const b = document.querySelector("#lobby .zf-bar"); if (!b) return; const a = document.activeElement && document.activeElement.id === "zfAra"; const pos = a ? document.activeElement.selectionStart : 0; b.outerHTML = bar(); if (a) { const i = document.getElementById("zfAra"); i.focus(); try { i.setSelectionRange(pos, pos); } catch (e) {} } }

  /* ---------- Olaylar ---------- */
  const lobby = document.getElementById("lobby");
  lobby.addEventListener("input", e => {
    const t = e.target;
    if (t.id === "zfAra") { F.q = t.value; const hadClear = !!document.querySelector("[data-zf-temizle]"); uygula(); if (hadClear !== !!(F.q || F.sistem || F.katilim || F.kategori)) barYenile(); return; }
    if (t.id === "zfBaslik") F.taslak.baslik = t.value;
    if (t.id === "zfGovde") F.taslak.govde = t.value;
    if (t.id === "zfYanit") F.yanitTaslak = t.value;
  });
  lobby.addEventListener("change", e => {
    const t = e.target;
    if (t.dataset.zf) { F[t.dataset.zf] = t.value; sakla(); barYenile(); uygula(); return; }
    if (t.id === "zfKategori") F.taslak.kategori = t.value;
    if (t.id === "zfSistem") F.taslak.sistem = t.value;
  });
  lobby.addEventListener("keydown", e => { if (e.target.id === "zfAra" && e.key === "Escape" && F.q) { F.q = ""; e.target.value = ""; barYenile(); uygula(); } });
  lobby.addEventListener("click", e => {
    const g = e.target.closest("[data-zf-goster]");
    if (g) { F.goster = g.dataset.zfGoster; sakla(); barYenile(); uygula(); return; }
    if (e.target.closest("[data-zf-temizle]")) { F.q = ""; F.sistem = ""; F.katilim = ""; F.kategori = ""; sakla(); barYenile(); uygula(); return; }
    const ac = e.target.closest("[data-zf-ac]");
    if (ac) { F.acik = ac.dataset.zfAc; F.yanitTaslak = ""; uygula(); document.querySelector("#lobby .zf-forum")?.scrollIntoView({ block: "start" }); return; }
    const b = e.target.closest("[data-zf-act]"); if (!b) return;
    const act = b.dataset.zfAct, t = F.konular[F.acik];
    if (act === "yeni") { F.yeni = true; F.taslak.sistem = F.taslak.sistem || F.sistem; uygula(); setTimeout(() => document.getElementById("zfBaslik")?.focus(), 0); return; }
    if (act === "vazgec") { F.yeni = false; b.blur(); uygula(); return; }
    if (act === "geri") { F.acik = null; uygula(); return; }
    if (act === "sabitle" && t) { ZF.pin({ topic: t.id, sabit: !t.sabit }).catch(x => toast(x.message || "Olmadı")); return; }
    if (act === "konusil" && t) { armed(b, () => ZF.remove({ topic: t.id }).then(() => { F.acik = null; toast("Başlık silindi"); uygula(); }).catch(x => toast(x.message || "Silinemedi"))); return; }
    if (act === "yanitsil" && t) { armed(b, () => ZF.remove({ topic: t.id, post: b.dataset.zfId }).catch(x => toast(x.message || "Silinemedi"))); return; }
  });
  lobby.addEventListener("submit", async e => {
    const kind = e.target.dataset.zfForm; if (!kind) return;
    e.preventDefault(); if (F.gonderiyor) return;
    try {
      F.gonderiyor = true;
      if (kind === "konu") {
        const d = F.taslak; if (!d.baslik.trim()) { document.getElementById("zfBaslik")?.focus(); return; }
        const r = await ZF.topic({ title: d.baslik, body: d.govde, kategori: d.kategori, sistem: d.sistem || null });
        F.yeni = false; F.taslak = { baslik: "", govde: "", kategori: "Genel sohbet", sistem: "" }; F.acik = r.id; toast("Başlık açıldı");
      } else {
        if (!F.yanitTaslak.trim()) return;
        await ZF.reply({ topic: F.acik, body: F.yanitTaslak }); F.yanitTaslak = "";
      }
      if (document.activeElement) document.activeElement.blur();
    } catch (x) { toast(x.message || "Gönderilemedi"); }
    finally { F.gonderiyor = false; uygula(); }
  });

  /* ---------- Lobi çiziminden sonra ---------- */
  const _renderLobby = window.renderLobby;
  window.renderLobby = function () { const r = _renderLobby.apply(this, arguments); try { abone(); uygula(); } catch (e) { console.error(e); } return r; };
  // Lobi ilk çizildiğinde DB henüz hazır olmayabilir; hazır olunca abone ol.
  ZF.ready.then(() => { const t = setInterval(() => { if (DB) { clearInterval(t); abone(); } }, 200); });
})();
