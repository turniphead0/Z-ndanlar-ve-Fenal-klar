/* Ana ekran (lobi): masalarda arama çubuğu ve süzgeçler, altında forumdan son konular.
   - Arama ve süzgeçler masaları süzer; aynı arama forumun son konularına da uygulanır.
   - Forumun kendi sayfası var (/forum, web/forum): her konunun paylaşılabilir bir adresi olur (/forum/<konu>).
     Lobide yalnızca en son konular görünür ve her biri o sayfaya gider.
   - Forum belgeleri forum/<id> (başlıklar) ve forum/<id>/yanitlar/<id>; okuma db aboneliğiyle yapılır. */
(function () {
  "use strict";
  if (!window.zmForum) return; // sunucusuz (tek tarayıcı) kipte forum yok
  const SON = 6; // lobide gösterilen konu sayısı

  // Durum: süzgeçler oturum boyunca kalır.
  const F = { q: "", sistem: "", katilim: "", konular: {}, yuklendi: false };
  try { const s = JSON.parse(sessionStorage.getItem("zm-lobi-suzgec") || "{}"); for (const k of ["sistem", "katilim"]) if (typeof s[k] === "string") F[k] = s[k]; } catch (e) {}
  const sakla = () => { try { sessionStorage.setItem("zm-lobi-suzgec", JSON.stringify({ sistem: F.sistem, katilim: F.katilim })); } catch (e) {} };

  // "Zından" ile "zindan" aynı sonucu versin: küçük harf ve Türkçe işaretsiz karşılaştır.
  const sade = s => String(s || "").toLocaleLowerCase("tr").replace(/[ıîİ]/g, "i").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ö/g, "o").replace(/[üû]/g, "u").replace(/â/g, "a").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const uyar = (q, ...alan) => { const w = sade(q).split(/\s+/).filter(Boolean); if (!w.length) return true; const t = sade(alan.join(" ")); return w.every(x => t.includes(x)); };
  const sysAd = k => (SYSINFO[k] || {}).short || "";

  /* ---------- Abonelik ---------- */
  let konuAbone = null;
  function abone() {
    if (konuAbone || !DB || LOCAL) return;
    konuAbone = DB.collection("forum").onSnapshot(snap => {
      for (const ch of snap.docChanges()) { if (ch.type === "removed") delete F.konular[ch.doc.id]; else F.konular[ch.doc.id] = { id: ch.doc.id, ...ch.doc.data() }; }
      F.yuklendi = true; yenile();
    }, () => {});
  }
  // Lobi açıksa yalnızca bizim bölümleri yeniden çiz (arama kutusundaki odak kaybolmasın).
  function yenile() { if (!G.id && document.querySelector("#lobby .zf-bar")) uygula(); }

  /* ---------- Araç çubuğu ---------- */
  const secenek = (v, cur, label) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(label)}</option>`;
  function bar() {
    return `<div class="zf-bar" role="search">
      <label class="zf-ara"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input class="f" type="search" id="zfAra" placeholder="Masalarda ara" aria-label="Masalarda ara" value="${esc(F.q)}" autocomplete="off"></label>
      <div class="zf-sel">
        <select class="f" data-zf="sistem" aria-label="Oyun sistemi">${secenek("", F.sistem, "Tüm sistemler")}${Object.entries(SYSINFO).map(([k, v]) => secenek(k, F.sistem, v.short)).join("")}</select>
        <select class="f" data-zf="katilim" aria-label="Katılım">${secenek("", F.katilim, "Her katılım")}${secenek("acik", F.katilim, "Açık katılım")}${secenek("onayli", F.katilim, "Onaylı katılım")}${secenek("cevrimici", F.katilim, "Şu an masada biri var")}</select>
        ${F.q || F.sistem || F.katilim ? `<button type="button" class="btn sm" data-zf-temizle>Süzgeçleri temizle</button>` : ""}
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
    let toplam = 0, gorunen = 0;
    root.querySelectorAll(".lwrap > section:not(.zf-forum)").forEach(sec => {
      let n = 0;
      sec.querySelectorAll(".gcard[data-gid]").forEach(card => { const g = S.games[card.dataset.gid]; const ok = !!g && masaUyar(g); card.hidden = !ok; toplam++; if (ok) n++; });
      gorunen += n; sec.hidden = n === 0;
    });
    let bos = root.querySelector(".zf-masabos");
    const goster = toplam > 0 && gorunen === 0;
    if (goster && !bos) { bos = document.createElement("div"); bos.className = "empty zf-masabos"; bos.innerHTML = "<h2>Aramana uyan masa yok</h2><p>Başka bir kelime dene ya da süzgeçleri temizle.</p>"; const f = root.querySelector(".zf-forum"); f ? f.before(bos) : root.querySelector(".lwrap").appendChild(bos); }
    if (bos) bos.hidden = !goster;
  }

  /* ---------- Forumdan son konular ---------- */
  const nokta = y => `<span class="pdot sm" data-noi18n style="background:${esc((y && y.color) || "#7f8c8d")}">${esc(((y && y.name) || "?")[0].toLocaleUpperCase("tr"))}</span>`;
  const yazarAdi = y => (y && y.id === ME.id ? "Sen" : window.zmKisi && y ? window.zmKisi(y.id, y.name || "Bir oyuncu", { ic: true }) : `<span data-noi18n>${esc((y && y.name) || "Bir oyuncu")}</span>`);
  const konuUyar = t => (!F.sistem || t.sistem === F.sistem) && uyar(F.q, t.baslik, t.govde, t.yazar && t.yazar.name, t.kategori, sysAd(t.sistem));
  const konuSatiri = t => `<a class="zf-konu ${t.sabit ? "sabit" : ""}" href="/forum/${esc(t.id)}">
      ${nokta(t.yazar)}
      <span class="zf-kb"><span class="zf-kt">${t.sabit ? '<span class="zf-pin">Sabit</span>' : ""}<b data-noi18n>${esc(t.baslik)}</b></span>
        <span class="zf-km"><span class="zf-kat">${esc(t.kategori || "Genel sohbet")}</span>${t.sistem ? `<span class="rbadge sys">${esc(sysAd(t.sistem))}</span>` : ""}${yazarAdi(t.yazar)} · <span>${ago(t.created)}</span></span></span>
      <span class="zf-ks"><span><b>${t.yanit || 0}</b> yanıt</span>${t.yanit ? `<small>son: ${esc(t.sonYazan || "")} · ${ago(t.updated)}</small>` : ""}</span></a>`;
  function forumBolumu(root) {
    let sec = root.querySelector(".zf-forum");
    if (!sec) { sec = document.createElement("section"); sec.className = "zf-forum"; root.querySelector(".lwrap").appendChild(sec); }
    const hepsi = Object.values(F.konular), aranan = !!(F.q || F.sistem);
    const liste = hepsi.filter(konuUyar).sort((a, b) => aranan ? (b.updated || 0) - (a.updated || 0) : (b.sabit - a.sabit) || (b.updated || 0) - (a.updated || 0));
    let govde;
    if (!F.yuklendi) govde = `<div class="empty"><h2>Forum yükleniyor</h2></div>`;
    else if (!hepsi.length) govde = `<div class="empty"><h2>Forumda henüz başlık yok</h2><p>Oyuncu ara, kural sor, hazırladığın haritayı paylaş.</p></div>`;
    else if (!liste.length) govde = `<p class="hint">Aramana uyan forum konusu yok.</p>`;
    else govde = `<div class="zf-liste">${liste.slice(0, SON).map(konuSatiri).join("")}</div>`;
    const tumu = F.q ? `/forum?q=${encodeURIComponent(F.q)}` : "/forum";
    sec.innerHTML = `<div class="zf-fh"><h2 class="lsec">${aranan ? "Forumda" : "Forumdan son konular"}${hepsi.length ? ` <small>${aranan ? liste.length + " konu" : hepsi.length + " başlık"}</small>` : ""}</h2><span class="sp"></span>
      ${S.ro ? "" : `<a class="btn" href="/forum/yeni">+ Yeni konu</a>`}<a class="btn pri" href="${tumu}">Foruma git →</a></div>${govde}`;
  }

  function uygula() {
    const root = document.getElementById("lobby");
    if (!root || G.id) return;
    const wrap = root.querySelector(".lwrap"); if (!wrap) return;
    if (!root.querySelector(".zf-bar")) {
      const ref = wrap.querySelector(".robanner") || wrap.querySelector(".lhead");
      ref.insertAdjacentHTML("afterend", bar());
    }
    masalariSuz(root); forumBolumu(root);
  }
  function barYenile() { const b = document.querySelector("#lobby .zf-bar"); if (!b) return; const a = document.activeElement && document.activeElement.id === "zfAra"; const pos = a ? document.activeElement.selectionStart : 0; b.outerHTML = bar(); if (a) { const i = document.getElementById("zfAra"); i.focus(); try { i.setSelectionRange(pos, pos); } catch (e) {} } }

  /* ---------- Olaylar ---------- */
  const lobby = document.getElementById("lobby");
  lobby.addEventListener("input", e => {
    if (e.target.id !== "zfAra") return;
    F.q = e.target.value; const hadClear = !!document.querySelector("[data-zf-temizle]"); uygula(); if (hadClear !== !!(F.q || F.sistem || F.katilim)) barYenile();
  });
  lobby.addEventListener("change", e => { const t = e.target; if (t.dataset.zf) { F[t.dataset.zf] = t.value; sakla(); barYenile(); uygula(); } });
  lobby.addEventListener("keydown", e => { if (e.target.id === "zfAra" && e.key === "Escape" && F.q) { F.q = ""; e.target.value = ""; barYenile(); uygula(); } });
  lobby.addEventListener("click", e => {
    if (e.target.closest("[data-zf-temizle]")) { F.q = ""; F.sistem = ""; F.katilim = ""; sakla(); barYenile(); uygula(); }
  });

  /* ---------- Lobi çiziminden sonra ---------- */
  const _renderLobby = window.renderLobby;
  window.renderLobby = function () { const r = _renderLobby.apply(this, arguments); try { abone(); uygula(); } catch (e) { console.error(e); } return r; };
  // Lobi bu betik yüklenmeden çizilmiş olabilir (betikler indirilirken bağlantı kurulursa) ve DB henüz hazır
  // olmayabilir; hazır olunca abone ol ve bölümleri ekle.
  window.zmForum.ready.then(() => { const t = setInterval(() => { if (DB) { clearInterval(t); abone(); try { uygula(); } catch (e) {} } }, 200); });
})();
