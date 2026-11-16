/* Oyun atölyesi (/oyunlar#atolye, #atolye/<oyun>): kendi kart ve taş oyununu yap.
   Desteler ve kartlar (resim yüklenebilir), taşlar, oyuncu sayaçları, masadaki alanlar, başlangıç dağıtımı,
   masa düzeni (sürükleyerek) ve kurallar. Kaydedince kartoyun/<id> olarak sunucuya yazılır, lobide görünür. */
(function () {
  "use strict";
  const KM = window.ZM_KARTMASA;
  const $ = (s, r = document) => r.querySelector(s);
  let X = null, taslak = null, taslakId = null, yukluId = undefined, kirli = false;
  const esc = s => X.esc(s);
  const BOYLAR = { kucuk: [80, 120, "Küçük (80×120)"], standart: [100, 150, "Standart (100×150)"], buyuk: [130, 186, "Büyük (130×186)"], kare: [120, 120, "Kare (120×120)"], yatay: [150, 100, "Yatay (150×100)"] };
  const SEKIL_AD = { daire: "Daire", kare: "Kare", yildiz: "Yıldız", ucgen: "Üçgen", altigen: "Altıgen", piyon: "Piyon" };
  const tost = t => { const el = $("#tost"); el.textContent = t; el.hidden = false; clearTimeout(tost.t); tost.t = setTimeout(() => (el.hidden = true), 2800); };
  const yeniKimlik = on => on + "-" + Math.random().toString(36).slice(2, 7);

  function bosOyun() {
    return { ad: "", aciklama: "", kurallar: "", oyuncu: { min: 2, max: 4 }, masa: { renk: "#2f5d50", resim: null },
      desteler: [], taslar: [], sayaclar: [], alanlar: [], kurulum: [] };
  }
  // Kurulum adımlarını destelere dağıt (düzenleme kolaylığı için), kaydederken geri topla.
  function ayristir(t) {
    for (const d of t.desteler) {
      const dg = t.kurulum.find(k => k.islem === "dagit" && k.deste === d.id), ms = t.kurulum.find(k => k.islem === "masaya" && k.deste === d.id);
      d._dagit = dg ? { adet: dg.adet, nereye: dg.nereye === "el" ? "el" : dg.acik ? "onu-acik" : "onu-kapali" } : { adet: 0, nereye: "el" };
      d._masaya = ms ? { adet: ms.adet, acik: ms.acik, konumlar: ms.konumlar } : { adet: 0, acik: true };
    }
    return t;
  }
  function topla(t) {
    const out = JSON.parse(JSON.stringify(t)); out.kurulum = [];
    for (const d of out.desteler) {
      const dg = d._dagit || {}, ms = d._masaya || {};
      if (dg.adet > 0) out.kurulum.push({ islem: "dagit", deste: d.id, adet: dg.adet, nereye: dg.nereye === "el" ? "el" : "onu", acik: dg.nereye === "onu-acik", sahibiGorur: true });
      if (ms.adet > 0) {
        let konumlar = ms.konumlar && ms.konumlar.length === ms.adet ? ms.konumlar : null;
        if (!konumlar) { const n = ms.adet, satir = Math.min(n, 8), w = d.w + 16; konumlar = Array.from({ length: n }, (_, i) => [Math.round(800 - (satir - 1) * w / 2 + (i % 8) * w), Math.round(420 + Math.floor(i / 8) * (d.h + 16)), 0]); }
        out.kurulum.push({ islem: "masaya", deste: d.id, adet: ms.adet, acik: ms.acik, konumlar });
      }
      delete d._dagit; delete d._masaya;
    }
    return out;
  }

  function yukle(id) {
    if (yukluId === id) return true;
    if (id) {
      const o = X.kartOyunlari.get(id); if (!o) return false;
      taslak = ayristir(JSON.parse(JSON.stringify(o.tanim))); taslakId = id;
    } else { taslak = bosOyun(); taslakId = null; }
    yukluId = id; kirli = false;
    return true;
  }

  function ciz(id) {
    const ana = $("#ana"); ana.classList.add("genis");
    if (!yukle(id || null)) { ana.innerHTML = `<p class="bos">Oyun yükleniyor… <a href="#">Oyunlara dön</a></p>`; return; }
    if (ana.querySelector(".at") && ana.dataset.at === String(id || "")) return; // açık formu bozma
    ana.dataset.at = String(id || "");
    const o = id && X.kartOyunlari.get(id), sahip = !id || (o && (o.sahip === X.me().id || X.isOwner()));
    ana.innerHTML = `<p class="km-ust"><a href="#" data-at="geri">← Bütün oyunlar</a><span class="sp"></span><b>Oyun atölyesi</b></p>
      <div class="at">${sahip ? "" : `<p class="hata">Bu oyunu başkası yaptı; değişikliklerini kaydedemezsin.</p>`}
        <div class="at-bolumler">${formHtml()}</div>
        <div class="at-alt"><button class="btn pri" data-at="kaydet" ${sahip ? "" : "disabled"}>Kaydet</button><button class="btn" data-at="kaydet-ac" ${sahip ? "" : "disabled"}>Kaydet ve masa aç</button>
          <span class="sp"></span>${id && sahip ? `<button class="btn tehlike" data-at="sil">Oyunu sil</button>` : ""}</div></div>`;
    duzenCiz();
  }
  function yeniden() { const ana = $("#ana"); ana.dataset.at = "-"; const y = scrollY; ciz(yukluId); scrollTo(0, y); }

  const resimAlani = (yol, url, etiket) => `<span class="at-resim">${url ? `<img src="${esc(url)}" alt="">` : ""}<button class="btn mini" data-at="yukle" data-yol="${yol}">${url ? "Değiştir" : etiket || "Resim yükle"}</button>${url ? `<button class="btn mini" data-at="resimsil" data-yol="${yol}">Kaldır</button>` : ""}</span>`;
  const boyAnahtar = d => (Object.entries(BOYLAR).find(([, b]) => b[0] === d.w && b[1] === d.h) || ["ozel"])[0];

  function formHtml() {
    const t = taslak;
    return `<section class="kutu"><h3>Genel</h3>
        <div class="at-izgara">
          <label>Oyunun adı<input data-f="ad" value="${esc(t.ad)}" maxlength="80" placeholder="Örneğin: Ejderha Avı" required></label>
          <label>Sürüm ya da alt başlık (isteğe bağlı)<input data-f="surum" value="${esc(t.surum || "")}" maxlength="40"></label>
          <label class="genis">Kısa açıklama<input data-f="aciklama" value="${esc(t.aciklama)}" maxlength="400" placeholder="Lobide görünecek bir iki cümle"></label>
          <label>En az oyuncu<input type="number" min="1" max="10" data-f="oyuncu.min" value="${t.oyuncu.min}"></label>
          <label>En çok oyuncu<input type="number" min="1" max="10" data-f="oyuncu.max" value="${t.oyuncu.max}"></label>
          <label>Masa rengi<input type="color" data-f="masa.renk" value="${esc(t.masa.renk)}"></label>
          <label>Masa resmi (tahta, harita…)${resimAlani("masa.resim", t.masa.resim)}</label>
        </div></section>

      <section class="kutu"><h3>Desteler ve kartlar</h3>
        <p class="bos">Her deste aynı arka yüzlü kartlardan oluşur. Kartlara resim yükleyebilir ya da yalnızca ad ve metin yazabilirsin; yazılı kartlar otomatik çizilir.</p>
        ${t.desteler.map((d, i) => desteHtml(d, i)).join("")}
        <button class="btn" data-at="deste-ekle">+ Deste ekle</button></section>

      <section class="kutu"><h3>Taşlar ve işaretler</h3>
        <p class="bos">Piyonlar, jetonlar, işaret taşları. “Oyuncu rengi” seçilirse her oyuncunun taşı kendi renginde olur.</p>
        <div class="at-satirlar">${t.taslar.map((s, i) => `<div class="at-satir">
          <span class="at-tas">${KMUI().tasHtml(s, { renk: s.renk === "oyuncu" ? KM.RENKLER[0] : s.renk })}</span>
          <label>Ad<input data-f="taslar.${i}.ad" value="${esc(s.ad)}" maxlength="40"></label>
          <label>Şekil<select data-f="taslar.${i}.sekil">${Object.entries(SEKIL_AD).map(([k, v]) => `<option value="${k}"${s.sekil === k ? " selected" : ""}>${v}</option>`).join("")}</select></label>
          <label>Renk<input type="color" data-f="taslar.${i}.renk" value="${s.renk === "oyuncu" ? "#c0392b" : esc(s.renk)}" ${s.renk === "oyuncu" ? "disabled" : ""}></label>
          <label class="at-onay"><input type="checkbox" data-f="taslar.${i}.oyuncuRengi" ${s.renk === "oyuncu" ? "checked" : ""}> Oyuncu rengi</label>
          <label>Boy<input type="number" min="16" max="200" data-f="taslar.${i}.boy" value="${s.boy}"></label>
          <label>Adet<input type="number" min="0" max="60" data-f="taslar.${i}.adet" value="${s.adet}"></label>
          <label class="at-onay"><input type="checkbox" data-f="taslar.${i}.herOyuncu" ${s.herOyuncu ? "checked" : ""}> Her oyuncuya ayrı</label>
          <span>${resimAlani(`taslar.${i}.resim`, s.resim, "Resim")}</span>
          <button class="btn mini tehlike" data-at="sil-oge" data-yol="taslar.${i}" aria-label="Taşı sil">Sil</button></div>`).join("")}</div>
        <button class="btn" data-at="tas-ekle">+ Taş ekle</button></section>

      <section class="kutu"><h3>Oyuncu sayaçları</h3>
        <p class="bos">Can, para, puan gibi her oyuncunun kendi sayısı. Oyuncu panelinde − ve + ile değişir.</p>
        <div class="at-satirlar">${t.sayaclar.map((s, i) => `<div class="at-satir">
          <label>Ad<input data-f="sayaclar.${i}.ad" value="${esc(s.ad)}" maxlength="30"></label>
          <label>Başlangıç<input type="number" data-f="sayaclar.${i}.baslangic" value="${s.baslangic}"></label>
          <label>En az<input type="number" data-f="sayaclar.${i}.min" value="${s.min == null ? 0 : s.min}"></label>
          <label>En çok<input type="number" data-f="sayaclar.${i}.max" value="${s.max == null ? 99 : s.max}"></label>
          <button class="btn mini tehlike" data-at="sil-oge" data-yol="sayaclar.${i}">Sil</button></div>`).join("")}</div>
        <button class="btn" data-at="sayac-ekle">+ Sayaç ekle</button></section>

      <section class="kutu"><h3>Masa düzeni</h3>
        <p class="bos">Desteleri, taşları ve alanları sürükleyerek başlangıç yerlerini ayarla. Alanlar masada çizilen bölgelerdir (örneğin “Iskarta”, “Pazar”, “Oylar”).</p>
        <div class="at-satirlar">${t.alanlar.map((a, i) => `<div class="at-satir">
          <label>Alan adı<input data-f="alanlar.${i}.ad" value="${esc(a.ad)}" maxlength="40"></label>
          <label>Renk<input type="color" data-f="alanlar.${i}.renk" value="${esc(a.renk)}"></label>
          <label>Genişlik<input type="number" min="20" max="1600" data-f="alanlar.${i}.w" value="${a.w}"></label>
          <label>Yükseklik<input type="number" min="20" max="1000" data-f="alanlar.${i}.h" value="${a.h}"></label>
          <button class="btn mini tehlike" data-at="sil-oge" data-yol="alanlar.${i}">Sil</button></div>`).join("")}</div>
        <button class="btn" data-at="alan-ekle">+ Alan ekle</button>
        <div class="at-duzen" id="atDuzen"></div></section>

      <section class="kutu"><h3>Kurallar</h3>
        <p class="bos">Biçim: <code># Başlık</code>, <code>## Alt başlık</code>, <code>- madde</code>, <code>**kalın**</code>, <code>&gt; açıklama</code>. Oyuncular masada sağdaki “Kurallar” sekmesinde okur.</p>
        <div class="at-kural"><textarea data-f="kurallar" rows="16" maxlength="20000" placeholder="# Oyunun adı&#10;## Kuruluş&#10;Her oyuncu 5 kart çeker…&#10;## Sıra&#10;- Bir kart çek&#10;- Bir kart oyna">${esc(t.kurallar)}</textarea>
          <div class="km-kurallar at-onizle" id="atKural">${KMUI().kuralHtml(t.kurallar || "Önizleme burada görünür.")}</div></div></section>`;
  }

  function desteHtml(d, i) {
    const say = d.kartlar.reduce((a, k) => a + (+k.adet || 0), 0), bk = boyAnahtar(d);
    return `<details class="at-deste" ${d._acik !== false ? "open" : ""} data-deste="${i}"><summary><b>${esc(d.ad || "Deste")}</b> <span class="bos">· ${say} kart</span></summary>
      <div class="at-izgara">
        <label>Deste adı<input data-f="desteler.${i}.ad" value="${esc(d.ad)}" maxlength="60"></label>
        <label>Kart boyu<select data-f="desteler.${i}.boy">${Object.entries(BOYLAR).map(([k, b]) => `<option value="${k}"${bk === k ? " selected" : ""}>${b[2]}</option>`).join("")}${bk === "ozel" ? `<option value="ozel" selected>Özel (${d.w}×${d.h})</option>` : ""}</select></label>
        <label>Arka yüz rengi<input type="color" data-f="desteler.${i}.arka.renk" value="${esc(d.arka.renk || "#34495e")}"></label>
        <label>Arka yüz yazısı<input data-f="desteler.${i}.arka.yazi" value="${esc(d.arka.yazi || "")}" maxlength="30" placeholder="Örneğin: GÖREV"></label>
        <label>Arka yüz resmi${resimAlani(`desteler.${i}.arka.resim`, d.arka.resim)}</label>
        <label class="at-onay"><input type="checkbox" data-f="desteler.${i}.karistir" ${d.karistir !== false ? "checked" : ""}> Başta karıştır</label>
        <label>Iskarta destesi<select data-f="desteler.${i}.iskartaTur"><option value="yok"${!d.iskarta ? " selected" : ""}>Yok</option><option value="acik"${d.iskarta && d.iskarta.acik ? " selected" : ""}>Var, açık</option><option value="kapali"${d.iskarta && !d.iskarta.acik ? " selected" : ""}>Var, kapalı</option></select></label>
      </div>
      <div class="at-kurulum"><b>Başlangıçta</b>
        <label>Her oyuncuya <input type="number" min="0" max="30" data-f="desteler.${i}._dagit.adet" value="${d._dagit.adet}"> kart</label>
        <select data-f="desteler.${i}._dagit.nereye"><option value="el"${d._dagit.nereye === "el" ? " selected" : ""}>eline</option><option value="onu-acik"${d._dagit.nereye === "onu-acik" ? " selected" : ""}>önüne açık</option><option value="onu-kapali"${d._dagit.nereye === "onu-kapali" ? " selected" : ""}>önüne kapalı (kendisi görür)</option></select>
        <label>· Masaya <input type="number" min="0" max="60" data-f="desteler.${i}._masaya.adet" value="${d._masaya.adet}"> kart</label>
        <select data-f="desteler.${i}._masaya.acik"><option value="1"${d._masaya.acik ? " selected" : ""}>açık</option><option value="0"${!d._masaya.acik ? " selected" : ""}>kapalı</option></select> dizilsin</div>
      <div class="at-kartlar">${d.kartlar.map((k, j) => `<div class="at-kart">
        <div class="at-onkart" style="width:${d.w * .7}px;height:${d.h * .7}px;--kh:${d.h * .7}px">${onKart(d, k)}</div>
        <div class="at-kart-alan">
          <label>Kart adı<input data-f="desteler.${i}.kartlar.${j}.ad" value="${esc(k.ad)}" maxlength="60"></label>
          <label>Metin<textarea rows="3" data-f="desteler.${i}.kartlar.${j}.metin" maxlength="600">${esc(k.metin || "")}</textarea></label>
          <div class="at-kart-alt"><label>Adet<input type="number" min="0" max="60" data-f="desteler.${i}.kartlar.${j}.adet" value="${k.adet}"></label>
            ${resimAlani(`desteler.${i}.kartlar.${j}.resim`, k.resim, "Kart resmi")}${resimAlani(`desteler.${i}.kartlar.${j}.simge`, k.simge, "Simge")}
            <button class="btn mini" data-at="kart-kopya" data-yol="desteler.${i}.kartlar.${j}">Kopyala</button>
            <button class="btn mini tehlike" data-at="sil-oge" data-yol="desteler.${i}.kartlar.${j}">Sil</button></div></div></div>`).join("")}</div>
      <div class="km-dug"><button class="btn" data-at="kart-ekle" data-i="${i}">+ Kart ekle</button><button class="btn" data-at="toplu" data-i="${i}">Toplu ekle</button><button class="btn" data-at="resimler" data-i="${i}">Resimlerden kart yap</button>
        <span class="sp"></span><button class="btn tehlike" data-at="sil-oge" data-yol="desteler.${i}">Desteyi sil</button></div></details>`;
  }
  function onKart(d, k) {
    const tanim = { desteler: [{ ...d, kartlar: [k] }] };
    return KMUI().yuzHtml(tanim, d.id + "/" + k.id, d.id);
  }
  const KMUI = () => window.ZM_KARTUI;

  /* ---------------- Masa düzeni önizlemesi ---------------- */
  function duzenCiz() {
    const el = $("#atDuzen"); if (!el) return;
    const t = taslak, parca = [];
    t.alanlar.forEach((a, i) => parca.push(`<div class="km-alan" data-sur="alanlar.${i}" style="left:${a.x}px;top:${a.y}px;width:${a.w}px;height:${a.h}px;--ar:${esc(a.renk)};cursor:move"><span>${esc(a.ad)}</span></div>`));
    t.desteler.forEach((d, i) => {
      parca.push(`<div class="km-deste" data-sur="desteler.${i}" style="left:${d.x - d.w / 2}px;top:${d.y - d.h / 2}px;width:${d.w}px;height:${d.h}px">${KMUI().arkaHtml({ desteler: [d] }, d.id)}<span class="km-etiket">${esc(d.ad)}</span></div>`);
      if (d.iskarta) parca.push(`<div class="km-deste bos" data-sur="desteler.${i}.iskarta" style="left:${d.iskarta.x - d.w / 2}px;top:${d.iskarta.y - d.h / 2}px;width:${d.w}px;height:${d.h}px"><span class="km-etiket">${esc(d.iskarta.ad)}</span></div>`);
      const ms = d._masaya; if (ms && ms.adet > 0) { const k = topla({ ...t, desteler: [d] }).kurulum.find(x => x.islem === "masaya"); if (k) k.konumlar.forEach(([x, y]) => parca.push(`<div class="km-kart at-hayalet" style="left:${x - d.w / 2}px;top:${y - d.h / 2}px;width:${d.w}px;height:${d.h}px"></div>`)); }
    });
    t.taslar.forEach((s, i) => parca.push(`<div class="km-tas" data-sur="taslar.${i}" style="left:${s.x - s.boy / 2}px;top:${s.y - s.boy / 2}px;width:${s.boy}px;height:${s.boy}px">${KMUI().tasHtml(s, { renk: s.renk === "oyuncu" ? KM.RENKLER[0] : s.renk })}</div>`));
    const arka = t.masa.resim ? `background-image:url('${esc(t.masa.resim)}');background-size:cover;` : "";
    el.innerHTML = `<div class="km-masa" style="background-color:${esc(t.masa.renk)};${arka}"><div class="km-ic" style="width:${KM.MASA_G}px;height:${KM.MASA_H}px">${parca.join("")}</div></div>`;
    const dis = el.firstElementChild, s = dis.clientWidth / KM.MASA_G; dis.style.height = KM.MASA_H * s + "px"; dis.firstElementChild.style.transform = `scale(${s})`; duzenCiz.s = s;
  }
  let sur = null;
  document.addEventListener("pointerdown", e => {
    const el = e.target.closest("#atDuzen [data-sur]"); if (!el) return;
    e.preventDefault(); el.setPointerCapture(e.pointerId);
    sur = { el, yol: el.dataset.sur, x0: e.clientX, y0: e.clientY };
  });
  document.addEventListener("pointermove", e => { if (!sur) return; sur.el.style.translate = `${(e.clientX - sur.x0) / duzenCiz.s}px ${(e.clientY - sur.y0) / duzenCiz.s}px`; });
  document.addEventListener("pointerup", e => {
    if (!sur) return;
    const o = al(sur.yol), dx = (e.clientX - sur.x0) / duzenCiz.s, dy = (e.clientY - sur.y0) / duzenCiz.s;
    o.x = Math.round(Math.min(KM.MASA_G, Math.max(0, o.x + dx))); o.y = Math.round(Math.min(KM.MASA_H, Math.max(0, o.y + dy)));
    sur = null; kirli = true; duzenCiz();
  });
  window.addEventListener("resize", () => { if ($("#atDuzen")) duzenCiz(); });

  /* ---------------- Değişiklikler ---------------- */
  function al(yol) { return yol.split(".").reduce((o, k) => o[k], taslak); }
  function yaz(yol, v) { const p = yol.split("."), son = p.pop(), o = p.reduce((o, k) => o[k], taslak); o[son] = v; }
  document.addEventListener("input", e => {
    const el = e.target.closest(".at [data-f]"); if (!el) return;
    const f = el.dataset.f, v = el.type === "checkbox" ? el.checked : el.type === "number" ? +el.value : el.value;
    kirli = true;
    if (/\.boy$/.test(f) && f.startsWith("desteler.") && !f.includes("taslar")) { const d = al(f.replace(/\.boy$/, "")); const b = BOYLAR[v]; if (b) { d.w = b[0]; d.h = b[1]; } return yeniden(); }
    if (/\.iskartaTur$/.test(f)) { const d = al(f.replace(/\.iskartaTur$/, "")); d.iskarta = v === "yok" ? null : { ad: (d.iskarta && d.iskarta.ad) || d.ad + " ıskartası", x: Math.min(1560, d.x + d.w + 40), y: d.y, acik: v === "acik" }; return duzenCiz(); }
    if (/\.oyuncuRengi$/.test(f)) { const s = al(f.replace(/\.oyuncuRengi$/, "")); s.renk = v ? "oyuncu" : "#d4880f"; return yeniden(); }
    if (/_masaya\.acik$/.test(f)) { yaz(f, v === "1"); return; }
    if (/_masaya\.adet$/.test(f)) { yaz(f, v); duzenCiz(); return; }
    yaz(f, v);
    if (f === "kurallar") { $("#atKural").innerHTML = KMUI().kuralHtml(v || "Önizleme burada görünür."); return; }
    if (/^desteler\.\d+\.kartlar\.\d+\.(ad|metin)$/.test(f)) { const [, i, , j] = f.split("."); const box = el.closest(".at-kart").querySelector(".at-onkart"); box.innerHTML = onKart(taslak.desteler[i], taslak.desteler[i].kartlar[j]); return; }
    if (/^desteler\.\d+\.ad$/.test(f)) { el.closest("details").querySelector("summary b").textContent = v || "Deste"; duzenCiz(); return; }
    if (/^(masa\.renk|alanlar|taslar|desteler\.\d+\.arka)/.test(f)) duzenCiz();
    if (/^taslar\.\d+\.(sekil|renk)$/.test(f)) yeniden();
  });
  document.addEventListener("toggle", e => { const d = e.target.closest && e.target.closest("details[data-deste]"); if (d && taslak && taslak.desteler[d.dataset.deste]) taslak.desteler[d.dataset.deste]._acik = d.open; }, true);
  window.addEventListener("beforeunload", e => { if (kirli && yukluId !== undefined && location.hash.startsWith("#atolye")) { e.preventDefault(); e.returnValue = ""; } });

  function dosyalarSec(coklu) {
    return new Promise(res => { const i = document.createElement("input"); i.type = "file"; i.accept = "image/png,image/jpeg,image/webp,image/gif"; i.multiple = !!coklu; i.onchange = () => res([...i.files]); i.click(); });
  }
  async function yukleDosya(f) { tost("Yükleniyor: " + f.name); const r = await X.Z.upload(f); return r.url; }
  const dosyaAdi = f => f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim().slice(0, 60);

  document.addEventListener("click", async e => {
    const b = e.target.closest(".at [data-at], .km-ust [data-at]"); if (!b) return;
    const a = b.dataset.at, t = taslak;
    try {
      if (a === "geri") { if (kirli && !confirm("Kaydedilmemiş değişiklikler silinsin mi?")) { e.preventDefault(); return; } yukluId = undefined; return; }
      if (a === "deste-ekle") {
        const n = t.desteler.length, id = yeniKimlik("deste");
        t.desteler.push({ id, ad: "Deste " + (n + 1), w: 100, h: 150, x: 1250 - (n % 2) * 0, y: 130 + n * 210 > 870 ? 130 : 130 + n * 210, karistir: true, arka: { renk: KM.RENKLER[(n + 1) % KM.RENKLER.length], yazi: "", resim: null }, iskarta: null,
          kartlar: [{ id: yeniKimlik("kart"), ad: "Yeni kart", metin: "", adet: 1, resim: null, simge: null }], _dagit: { adet: 0, nereye: "el" }, _masaya: { adet: 0, acik: true } });
      } else if (a === "kart-ekle") { const d = t.desteler[b.dataset.i]; d.kartlar.push({ id: yeniKimlik("kart"), ad: "Yeni kart", metin: "", adet: 1, resim: null, simge: null }); }
      else if (a === "kart-kopya") { const k = al(b.dataset.yol), d = al(b.dataset.yol.split(".").slice(0, 2).join(".")); d.kartlar.splice(+b.dataset.yol.split(".")[3] + 1, 0, { ...k, id: yeniKimlik("kart"), ad: k.ad + " (kopya)" }); }
      else if (a === "toplu") {
        const metin = prompt("Her satıra bir kart yaz:\nAd | metin | adet\n\nÖrnek:\nKılıç | Saldırına +2 ekle | 3\nİksir | 1 can iyileştir | 2");
        if (!metin) return;
        const d = t.desteler[b.dataset.i];
        for (const satir of metin.split("\n")) { const [ad, m, n] = satir.split("|").map(x => (x || "").trim()); if (ad) d.kartlar.push({ id: yeniKimlik("kart"), ad, metin: m || "", adet: Math.max(1, +n || 1), resim: null, simge: null }); }
      } else if (a === "resimler") {
        const d = t.desteler[b.dataset.i], fs = await dosyalarSec(true); if (!fs.length) return;
        for (const f of fs) d.kartlar.push({ id: yeniKimlik("kart"), ad: dosyaAdi(f), metin: "", adet: 1, resim: await yukleDosya(f), simge: null });
        tost(fs.length + " kart eklendi");
      } else if (a === "tas-ekle") { const n = t.taslar.length; t.taslar.push({ id: yeniKimlik("tas"), ad: "Taş " + (n + 1), sekil: "daire", renk: n ? "#d4880f" : "oyuncu", boy: 40, adet: 1, herOyuncu: n === 0, x: 100 + n * 70, y: 900, resim: null }); }
      else if (a === "sayac-ekle") t.sayaclar.push({ id: yeniKimlik("sayac"), ad: t.sayaclar.length ? "Puan" : "Can", baslangic: t.sayaclar.length ? 0 : 3, min: 0, max: 99 });
      else if (a === "alan-ekle") { const n = t.alanlar.length; t.alanlar.push({ ad: "Alan " + (n + 1), x: 40 + (n % 3) * 280, y: 40 + Math.floor(n / 3) * 300, w: 250, h: 260, renk: "#ffffff" }); }
      else if (a === "sil-oge") { const p = b.dataset.yol.split("."), i = +p.pop(), liste = p.reduce((o, k) => o[k], t); if (p[0] === "desteler" && p.length === 1 && !confirm("Deste ve bütün kartları silinsin mi?")) return; liste.splice(i, 1); }
      else if (a === "yukle") { const [f] = await dosyalarSec(false); if (!f) return; yaz(b.dataset.yol, await yukleDosya(f)); }
      else if (a === "resimsil") yaz(b.dataset.yol, null);
      else if (a === "kaydet" || a === "kaydet-ac") {
        if (!t.ad.trim()) { tost("Oyuna bir ad ver"); $('[data-f="ad"]').focus(); return; }
        b.disabled = true;
        const r = await X.call("kmTanimYaz", { kartoyun: taslakId || undefined, tanim: topla(t) });
        kirli = false;
        if (!taslakId) { taslakId = r.id; yukluId = r.id; history.replaceState(null, "", "#atolye/" + r.id); $("#ana").dataset.at = r.id; }
        tost("Kaydedildi");
        b.disabled = false;
        if (a === "kaydet-ac") { const m = await X.call("kmNew", { oyun: r.id }); yukluId = undefined; location.hash = m.id; }
        return;
      } else if (a === "sil") {
        if (!confirm("“" + t.ad + "” oyunu silinsin mi? Açık masalar kapanmaz.")) return;
        await X.call("kmTanimSil", { kartoyun: taslakId }); kirli = false; yukluId = undefined; location.hash = ""; return;
      } else return;
      kirli = true; yeniden();
    } catch (err) { b.disabled = false; tost(err.message); }
  });

  window.ZM_ATOLYE = { kur: x => (X = x), ciz: id => ciz(id || null) };
})();
