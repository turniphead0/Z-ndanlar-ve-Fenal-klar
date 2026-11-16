/* Kart ve taş masası ekranı (/oyunlar#<masa>). Durum sunucudan gelir:
   boards/<masa> herkese açık görünüm, data/users/<ben>/kartmasa/<masa> benim elim ve baktığım kapalı kartlar.
   Kartlar, taşlar ve desteler sürüklenir; bir şeye dokununca yapılabilecekler menüsü açılır. */
(function () {
  "use strict";
  const KM = window.ZM_KARTMASA, { HAZIR } = window.ZM_HAZIR;
  const $ = (s, r = document) => r.querySelector(s);
  let X = null; // oyunlar.js bağlamı: call, Z, esc, me, isOwner, tahtalar, kartOyunlari, ciz
  const esc = s => X.esc(s);
  const st = { id: null, b: null, gizli: null, gizliKapat: null, surukle: null, bekleyen: false, menu: null, sekme: "kurallar" };

  function tost(t) { const el = $("#tost"); if (!el) return; el.textContent = t; el.hidden = false; clearTimeout(tost.t); tost.t = setTimeout(() => (el.hidden = true), 2800); }
  const islem = h => X.call("kmIslem", { board: st.id, islem: h }).catch(e => tost(e.message));

  /* ---------------- Kart ve taş çizimi ---------------- */
  const kartTanim = (t, k) => k && KM.kartTanimi(t, k);
  const desteTanim = (t, d) => KM.desteTanimi(t, d) || { w: 100, h: 150, arka: {} };
  function yuzHtml(t, k, d) {
    const kt = kartTanim(t, k), dt = desteTanim(t, d);
    if (!kt) return arkaHtml(t, d);
    if (kt.resim) return `<img class="km-res" src="${esc(kt.resim)}" alt="${esc(kt.ad)}" draggable="false">`;
    const metin = esc(kt.metin).replace(/^(Destekle|Ölüm):/gm, "<b>$1:</b>");
    return `<div class="km-yuz" style="--kh:${dt.h}px${kt.renk ? `;--kr:${esc(kt.renk)}` : ""}"><b class="km-ad">${esc(kt.ad)}</b>${kt.simge ? `<img src="${esc(kt.simge)}" alt="" draggable="false">` : ""}<span class="km-metin">${metin}</span></div>`;
  }
  function arkaHtml(t, d) {
    const a = desteTanim(t, d).arka || {};
    if (a.resim) return `<img class="km-res" src="${esc(a.resim)}" alt="Kapalı kart" draggable="false">`;
    return `<div class="km-arka" style="background:${esc(a.renk || "#34495e")}"><span>${esc(a.yazi || desteTanim(t, d).ad || "")}</span></div>`;
  }
  const SEKIL = {
    daire: '<circle cx="50" cy="50" r="44"/>',
    kare: '<rect x="8" y="8" width="84" height="84" rx="10"/>',
    yildiz: '<path d="M50 4l13 30 32 3-24 21 7 32-28-17-28 17 7-32L5 37l32-3z"/>',
    ucgen: '<path d="M50 6l44 84H6z"/>',
    altigen: '<path d="M27 8h46l23 42-23 42H27L4 50z"/>',
    piyon: '<path d="M50 6a16 16 0 0 1 9 29c8 5 12 14 12 24H29c0-10 4-19 12-24a16 16 0 0 1 9-29zM22 66h56l8 26H14z"/>',
  };
  function tasHtml(st_, tas) {
    if (st_ && st_.resim) return `<img src="${esc(st_.resim)}" alt="${esc(st_.ad)}" draggable="false">`;
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="${esc(tas.renk)}" stroke="rgba(0,0,0,.55)" stroke-width="5">${SEKIL[(st_ && st_.sekil) || "daire"]}</g></svg>`;
  }

  /* ---------------- Lobi bölümü ---------------- */
  function lobiHtml() {
    const me = X.me(), benimOyun = [...X.kartOyunlari.entries()].sort((a, b) => b[1].updated - a[1].updated);
    const kart = (anahtar, t, ek) => `<div class="kart"><b>${esc(t.ad)}${t.surum ? ` <small class="km-surum">${esc(t.surum)}</small>` : ""}</b><p>${esc(t.aciklama || "")}</p>
      <p class="km-oy">${t.oyuncu.min === t.oyuncu.max ? t.oyuncu.max : t.oyuncu.min + "–" + t.oyuncu.max} oyuncu</p><div class="km-dug">${ek}</div></div>`;
    const masalar = [...X.tahtalar.entries()].filter(([, b]) => b.oyun === "kart").sort((a, b) => b[1].updated - a[1].updated);
    return `<h2>Kart ve taş oyunları</h2>
      <div class="kartlar">${Object.entries(HAZIR).map(([k, t]) => kart(k, t, `<button class="btn pri" data-km-yeni="${k}">Masa aç</button>`)).join("")}
        ${benimOyun.map(([id, o]) => kart(id, o.tanim, `<button class="btn pri" data-km-oyun="${esc(id)}">Masa aç</button>${o.sahip === me.id || X.isOwner() ? `<a class="btn" href="#atolye/${esc(id)}">Düzenle</a>` : ""}<span class="km-yapan">${esc(o.sahipAd || "")} yaptı</span>`)).join("")}
        <a class="kart km-atolye" href="#atolye"><b>+ Kendi oyununu yap</b><p>Oyun atölyesi: kartlar ve desteler, taşlar, sayaçlar, masa alanları ve kurallar. Kart resimlerini yükleyebilirsin.</p></a></div>
      ${masalar.length ? `<h2>Açık kart masaları</h2><div class="liste">${masalar.map(([id, b]) => {
        const d = b.durum, otur = d.koltuk.filter(Boolean), benim = otur.some(k => k.id === me.id);
        return `<div class="satir"><span class="ad">${esc(b.tanim.ad)}${b.tanim.surum ? " · " + esc(b.tanim.surum) : ""}</span><span class="bilgi">${otur.map(k => esc(k.name)).join(", ") || "kimse oturmadı"} · ${d.basladi ? "oynanıyor" : "oyuncu bekliyor"}</span><span class="sp"></span>
          <a class="btn" href="#${id}">${benim ? "Devam et" : !d.basladi && d.koltuk.includes(null) ? "Katıl" : "İzle"}</a></div>`;
      }).join("")}</div>` : ""}`;
  }

  /* ---------------- Masa ekranı ---------------- */
  function ciz(id, b) {
    if (st.id !== id) {
      kapat(); st.id = id; st.gizli = null;
      const me = X.me();
      st.gizliKapat = X.Z.db().collection(`data/users/${me.id}/kartmasa`).doc(id).onSnapshot(s => { st.gizli = s.exists ? s.data() : null; ciz(st.id, X.tahtalar.get(st.id)); }, () => {});
    }
    st.b = b;
    if (st.surukle) { st.bekleyen = true; return; }
    const ana = $("#ana"); ana.classList.add("genis");
    const t = b.tanim, d = b.durum, me = X.me(), benKoltuk = d.koltuk.findIndex(k => k && k.id === me.id);
    const kaydir = { masa: ($(".km-yan") || {}).scrollTop };
    ana.innerHTML = `<p class="km-ust"><a href="#">← Bütün oyunlar</a><span class="sp"></span><b>${esc(t.ad)}</b>${t.surum ? `<span class="km-surum">${esc(t.surum)}</span>` : ""}</p>
      <div class="km-oyun">
        <div class="km-sol">${d.basladi ? masaHtml(t, d) + elHtml(t, d, benKoltuk >= 0) : lobiMasaHtml(t, d, benKoltuk)}</div>
        <aside class="km-yan">${yanHtml(t, b, d, benKoltuk)}</aside>
      </div>`;
    if (kaydir.masa) $(".km-yan").scrollTop = kaydir.masa;
    olcekle();
  }
  function kapat() {
    if (st.gizliKapat) st.gizliKapat();
    st.gizliKapat = null; st.id = null; st.gizli = null; menuKapat();
    const ana = $("#ana"); if (ana) ana.classList.remove("genis");
  }
  function olcekle() {
    const dis = $(".km-masa"); if (!dis) return;
    const s = dis.clientWidth / KM.MASA_G; dis.style.height = KM.MASA_H * s + "px"; dis.firstElementChild.style.transform = `scale(${s})`; st.olcek = s;
  }
  window.addEventListener("resize", olcekle);

  function lobiMasaHtml(t, d, benKoltuk) {
    const dolu = d.koltuk.filter(Boolean).length;
    return `<div class="kutu km-bekle"><h3>Oyuncular bekleniyor</h3><p class="bos">${t.oyuncu.min === t.oyuncu.max ? t.oyuncu.max : t.oyuncu.min + "–" + t.oyuncu.max} kişiyle oynanır. Herkes bir koltuğa otursun, sonra biri oyunu başlatsın: kartlar karıştırılıp dağıtılır.</p>
      <div class="km-koltuklar">${d.koltuk.map((k, i) => `<div class="km-koltuk"><i style="background:${KM.RENKLER[i % KM.RENKLER.length]}"></i><span>${k ? esc(k.name) : "<i>boş koltuk</i>"}</span><span class="sp"></span>
        ${k && k.id === X.me().id ? `<button class="btn" data-km="kalk">Kalk</button>` : k ? "" : `<button class="btn pri" data-km="otur" data-i="${i}">Otur</button>`}</div>`).join("")}</div>
      <button class="btn pri" data-km="basla" ${dolu < t.oyuncu.min || benKoltuk < 0 ? "disabled" : ""}>Oyunu başlat (${dolu} kişi)</button></div>`;
  }

  function masaHtml(t, d) {
    const g = st.gizli || { gor: {}, ustler: {} }, me = X.me();
    const out = [];
    for (const a of t.alanlar) out.push(`<div class="km-alan" style="left:${a.x}px;top:${a.y}px;width:${a.w}px;height:${a.h}px;--ar:${esc(a.renk)}"><span>${esc(a.ad)}</span></div>`);
    for (const [pid, p] of Object.entries(d.desteler)) {
      const dt = desteTanim(t, p.d), ust = p.acik && p.ust ? yuzHtml(t, p.ust, p.d) : g.ustler && g.ustler[pid] ? yuzHtml(t, g.ustler[pid], p.d) : p.n ? arkaHtml(t, p.d) : "";
      out.push(`<div class="km-deste${p.n ? "" : " bos"}${g.ustler && g.ustler[pid] ? " baktim" : ""}" data-tur="deste" data-id="${pid}" style="left:${p.x - dt.w / 2}px;top:${p.y - dt.h / 2}px;width:${dt.w}px;height:${dt.h}px">
        ${p.n > 1 ? `<i class="km-kalin"></i>` : ""}${ust}<b class="km-say">${p.n}</b><span class="km-etiket">${esc(p.ad)}</span></div>`);
    }
    const kartlar = Object.entries(d.kartlar).filter(([, c]) => c.yer === "masa").sort((a, b) => (a[1].z || 0) - (b[1].z || 0));
    for (const [iid, c] of kartlar) {
      const dt = desteTanim(t, c.d), k = c.acik ? c.k : g.gor[iid], baktim = !c.acik && g.gor[iid];
      out.push(`<div class="km-kart${baktim ? " baktim" : ""}" data-tur="kart" data-id="${iid}" style="left:${c.x - dt.w / 2}px;top:${c.y - dt.h / 2}px;width:${dt.w}px;height:${dt.h}px;transform:rotate(${c.r || 0}deg);z-index:${10 + (c.z || 0)}">${k ? yuzHtml(t, k, c.d) : arkaHtml(t, c.d)}${goranlar(d, c)}</div>`);
    }
    for (const [tid, x] of Object.entries(d.taslar)) {
      const s = t.taslar.find(y => y.id === x.t) || { boy: 40 };
      out.push(`<div class="km-tas" data-tur="tas" data-id="${tid}" title="${esc(s.ad)}" style="left:${x.x - s.boy / 2}px;top:${x.y - s.boy / 2}px;width:${s.boy}px;height:${s.boy}px;transform:rotate(${x.r || 0}deg);z-index:${2000 + (x.z || 0)}">${tasHtml(s, x)}</div>`);
    }
    const arka = t.masa.resim ? `background-image:url('${esc(t.masa.resim)}');background-size:cover;` : "";
    return `<div class="km-masa" style="background-color:${esc(t.masa.renk)};${arka}"><div class="km-ic" style="width:${KM.MASA_G}px;height:${KM.MASA_H}px">${out.join("")}</div></div>`;
  }
  // Kapalı karta kimlerin baktığı (kartın köşesinde renkli noktalar).
  function goranlar(d, c) {
    const gor = (c.gor || []).filter(id => id !== c.sahip); // sahibi kendi kartını zaten bilir
    if (c.acik || !gor.length) return "";
    return `<span class="km-goren">${gor.map(id => { const i = d.koltuk.findIndex(k => k && k.id === id); return i < 0 ? "" : `<i style="background:${esc(d.koltuk[i].renk)}" title="${esc(d.koltuk[i].name)} baktı"></i>`; }).join("")}</span>`;
  }

  function elHtml(t, d, oturuyor) {
    if (!oturuyor) return `<p class="bos km-izle">Bu masayı izliyorsun.</p>`;
    const el = (st.gizli && st.gizli.el) || [];
    return `<div class="km-el" aria-label="Elin"><span class="km-el-bas">Elin (${el.length}) · yalnızca sen görürsün</span><div class="km-el-kartlar">${el.map(c => {
      const dt = desteTanim(t, c.k.split("/")[0]), w = Math.round(dt.w * 1.1), h = Math.round(dt.h * 1.1);
      return `<div class="km-kart el" data-tur="el" data-id="${c.iid}" style="width:${w}px;height:${h}px">${yuzHtml(t, c.k, c.k.split("/")[0])}</div>`;
    }).join("") || `<span class="bos">Elin boş.</span>`}</div></div>`;
  }

  function yanHtml(t, b, d, benKoltuk) {
    const me = X.me(), g = st.gizli || { gor: {} };
    const oyuncular = d.koltuk.map((k, i) => {
      if (!k) return "";
      const onu = (d.onu[k.id] || []).map(iid => {
        const c = d.kartlar[iid], dt = desteTanim(t, c.d), kk = c.acik ? c.k : g.gor[iid], w = 54, h = Math.round(54 * dt.h / dt.w);
        return `<div class="km-kart mini${!c.acik && g.gor[iid] ? " baktim" : ""}" data-tur="onu" data-id="${iid}" style="width:${w}px;height:${h}px">${kk ? yuzHtml(t, kk, c.d) : arkaHtml(t, c.d)}${goranlar(d, c)}</div>`;
      }).join("");
      const sayac = t.sayaclar.map(s => { const v = (d.sayac[k.id] || {})[s.id]; return `<span class="km-sayac">${esc(s.ad)} <button class="btn mini" data-km="sayac" data-k="${esc(k.id)}" data-s="${esc(s.id)}" data-v="${v - 1}" aria-label="${esc(s.ad)} azalt">−</button><b class="num">${v}</b><button class="btn mini" data-km="sayac" data-k="${esc(k.id)}" data-s="${esc(s.id)}" data-v="${v + 1}" aria-label="${esc(s.ad)} artır">+</button></span>`; }).join("");
      const elSay = (d.el[k.id] || []).length;
      return `<div class="km-oyuncu${d.sira === i ? " sirada" : ""}" style="--or:${esc(k.renk)}"><div class="km-oy-bas"><i></i><b>${esc(k.name)}${k.id === me.id ? " (sen)" : ""}</b><span class="sp"></span><span class="km-elsay" title="Elindeki kart sayısı">🂠 ${elSay}</span>
        ${k.id !== me.id && benKoltuk >= 0 && elSay ? `<button class="btn mini" data-km="rastgele" data-k="${esc(k.id)}" title="Elinden rastgele bir kart seç">Rastgele kart</button>` : ""}
        <button class="btn mini" data-km="sira" data-i="${i}" title="Sırayı bu oyuncuya ver">Sıra</button></div>
        ${sayac ? `<div class="km-sayaclar">${sayac}</div>` : ""}<div class="km-onu">${onu || `<span class="bos">Önünde kart yok</span>`}</div></div>`;
    }).join("");
    const log = (d.log || []).slice().reverse().map(l => { const k = d.koltuk.find(x => x && x.id === l.kisi); return `<li><i style="background:${esc(k ? k.renk : "#999")}"></i>${esc(l.m)}</li>`; }).join("");
    const sekme = st.sekme;
    return `${d.basladi ? `<div class="kutu"><h3>Oyuncular</h3>${oyuncular}
        <div class="km-zar"><button class="btn" data-km="zar" data-y="6">🎲 d6 at</button><button class="btn" data-km="zar" data-y="20">d20</button>${d.zar ? `<span>${esc((d.koltuk.find(k => k && k.id === d.zar.kisi) || {}).name || "")}: <b class="num">${d.zar.at.join(" + ")}</b></span>` : ""}</div></div>` : ""}
      <div class="kutu"><div class="km-sekmeler" role="tablist"><button role="tab" aria-selected="${sekme === "kurallar"}" data-km="sekme" data-s="kurallar">Kurallar</button>${d.basladi ? `<button role="tab" aria-selected="${sekme === "gunluk"}" data-km="sekme" data-s="gunluk">Günlük</button>` : ""}</div>
        ${sekme === "gunluk" && d.basladi ? `<ol class="km-log">${log || `<li class="bos">Henüz bir şey olmadı.</li>`}</ol>` : `<div class="km-kurallar">${kuralHtml(t.kurallar || "Bu oyun için kural yazılmamış.")}</div>`}</div>
      <div class="kutu km-yonet">${d.basladi ? `<button class="btn" data-km="sifirla">Yeniden başlat</button>` : ""}<button class="btn tehlike" data-km="sil">Masayı kapat</button>
        ${b.kartoyun && (X.kartOyunlari.get(b.kartoyun) || {}).sahip === me.id && d.basladi ? `<button class="btn" data-km="duzen" title="Destelerin ve taşların şu anki yerleri oyunun başlangıç düzeni olsun">Bu düzeni kaydet</button>` : ""}</div>`;
  }

  // Kural metni: # başlık, ## alt başlık, - madde, > açıklama, **kalın**, ✱ değişiklik işareti.
  function kuralHtml(m) {
    const satir = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/✱/g, '<span class="km-yildiz">✱</span>');
    let html = "", liste = false;
    for (const l of String(m).split("\n")) {
      const s = l.trim();
      if (!s.startsWith("- ") && liste) { html += "</ul>"; liste = false; }
      if (!s) continue;
      if (s.startsWith("### ")) html += `<h5>${satir(s.slice(4))}</h5>`;
      else if (s.startsWith("## ")) html += `<h4>${satir(s.slice(3))}</h4>`;
      else if (s.startsWith("# ")) html += `<h3>${satir(s.slice(2))}</h3>`;
      else if (s.startsWith("- ")) { if (!liste) { html += "<ul>"; liste = true; } html += `<li>${satir(s.slice(2))}</li>`; }
      else if (s.startsWith("> ")) html += `<p class="km-neden">${satir(s.slice(2))}</p>`;
      else html += `<p${s.includes("✱") ? ' class="km-degisti"' : ""}>${satir(s)}</p>`;
    }
    return html + (liste ? "</ul>" : "");
  }

  /* ---------------- Menüler ---------------- */
  function menuKapat() { if (st.menu) st.menu.remove(); st.menu = null; }
  function menuAc(x, y, baslik, secenekler) {
    menuKapat();
    const m = document.createElement("div"); m.className = "km-menu"; m.setAttribute("role", "menu");
    m.innerHTML = (baslik ? `<div class="km-menu-bas">${baslik}</div>` : "") + secenekler.filter(Boolean).map((s, i) => s === "-" ? "<hr>" : `<button role="menuitem" data-i="${i}"${s.alt ? ' class="alt"' : ""}>${esc(s.ad)}</button>`).join("");
    document.body.appendChild(m);
    const r = m.getBoundingClientRect();
    m.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + "px";
    m.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + "px";
    const liste = secenekler.filter(Boolean);
    m.addEventListener("click", e => { const b = e.target.closest("button[data-i]"); if (!b) return; const s = liste[+b.dataset.i]; if (s.alt) return menuAc(x, y, esc(s.ad), s.alt); menuKapat(); s.fn(); });
    st.menu = m;
  }
  document.addEventListener("pointerdown", e => { if (st.menu && !st.menu.contains(e.target)) menuKapat(); }, true);
  document.addEventListener("keydown", e => { if (e.key === "Escape") { menuKapat(); const z = $(".km-buyuk"); if (z) z.remove(); } });

  const desteler = (d, filtre) => Object.entries(d.desteler).filter(([, p]) => !filtre || filtre(p));
  const desteAlt = (d, f) => desteler(d).map(([pid, p]) => ({ ad: p.ad + (p.acik ? " (açık)" : ""), fn: () => islem({ ...f, nereye: "deste", deste: pid }) }));
  const oyuncuAlt = (d, f) => d.koltuk.filter(k => k && k.id !== X.me().id).map(k => ({ ad: k.name, fn: () => islem({ ...f, kime: k.id }) }));
  const yakin = (d, n) => ({ x: 800 + ((d.n * 37 + (n || 0) * 26) % 260) - 130, y: 880 - ((d.n * 13) % 60) });

  function buyut(t, k, d) {
    const kt = kartTanim(t, k), dt = desteTanim(t, d);
    const z = document.createElement("div"); z.className = "km-buyuk";
    z.innerHTML = `<div class="km-buyuk-ic"><div class="km-kart buyuk" style="width:${dt.w * 2.6}px;height:${dt.h * 2.6}px;--kh:${dt.h}px">${k ? yuzHtml(t, k, d) : arkaHtml(t, d)}</div>
      ${kt && (kt.metin || kt.not) ? `<div class="km-buyuk-metin"><b>${esc(kt.ad)}</b>${kt.metin ? `<p>${esc(kt.metin).replace(/\n/g, "<br>")}</p>` : ""}${kt.not ? `<p class="km-neden">${esc(kt.not)}</p>` : ""}</div>` : ""}</div>`;
    z.addEventListener("click", () => z.remove());
    document.body.appendChild(z);
  }

  function nesneMenu(el, x, y) {
    const b = st.b, t = b.tanim, d = b.durum, me = X.me(), g = st.gizli || { gor: {}, el: [] }, tur = el.dataset.tur, id = el.dataset.id;
    const oturuyor = !!d.el[me.id];
    if (tur === "deste") {
      const p = d.desteler[id];
      if (!oturuyor) return;
      return menuAc(x, y, `${esc(p.ad)} · ${p.n} kart`, [
        p.n && { ad: "Kart çek (eline)", fn: () => islem({ tur: "cek", deste: id, nereye: "el" }) },
        p.n && { ad: "Masaya açık çek", fn: () => islem({ tur: "cek", deste: id, nereye: "masa", acik: true }) },
        p.n && { ad: "Masaya kapalı çek", fn: () => islem({ tur: "cek", deste: id, nereye: "masa", acik: false }) },
        p.n && { ad: "Önüne kapalı çek (sen görürsün)", fn: () => islem({ tur: "cek", deste: id, nereye: "onu", acik: false }) },
        p.n && { ad: "Önüne açık çek", fn: () => islem({ tur: "cek", deste: id, nereye: "onu", acik: true }) },
        p.n && { ad: "Üstteki karta gizlice bak", fn: () => islem({ tur: "ust", deste: id }) },
        p.n && g.ustler && g.ustler[id] && { ad: "Baktığın kartı büyüt", fn: () => buyut(t, g.ustler[id], p.d) },
        p.acik && p.ust && { ad: "Üstteki kartı büyüt", fn: () => buyut(t, p.ust, p.d) },
        "-",
        p.n > 1 && { ad: "Karıştır", fn: () => islem({ tur: "karistir", deste: id }) },
        p.n && desteler(d, q => q !== p).length && { ad: "Bütün kartları başka desteye aktar ▸", alt: desteler(d, q => q !== p).flatMap(([pid, q]) => [
          { ad: q.ad + " (karıştır)", fn: () => islem({ tur: "birlestir", deste: id, hedef: pid, karistir: true }) },
          { ad: q.ad + " (altına)", fn: () => islem({ tur: "birlestir", deste: id, hedef: pid, alta: true }) }]) },
      ]);
    }
    if (tur === "tas") return oturuyor && menuAc(x, y, esc((t.taslar.find(s => s.id === d.taslar[id].t) || {}).ad || "Taş"), [{ ad: "Döndür", fn: () => islem({ tur: "dondur", id }) }]);
    if (tur === "el") {
      const c = g.el.find(c => c.iid === id); if (!c) return;
      const kt = kartTanim(t, c.k) || {};
      return menuAc(x, y, esc(kt.ad || "Kart"), [
        { ad: "Büyüt", fn: () => buyut(t, c.k, c.k.split("/")[0]) },
        { ad: "Masaya açık koy", fn: () => islem({ tur: "koy", kart: id, nereye: "masa", acik: true, ...yakin(d) }) },
        { ad: "Masaya kapalı koy", fn: () => islem({ tur: "koy", kart: id, nereye: "masa", acik: false, ...yakin(d) }) },
        { ad: "Önüne açık koy", fn: () => islem({ tur: "koy", kart: id, nereye: "onu", acik: true }) },
        { ad: "Önüne kapalı koy", fn: () => islem({ tur: "koy", kart: id, nereye: "onu", acik: false }) },
        { ad: "Desteye koy ▸", alt: desteAlt(d, { tur: "koy", kart: id }) },
        oyuncuAlt(d, {}).length && { ad: "Bir oyuncuya ver ▸", alt: oyuncuAlt(d, { tur: "koy", kart: id, nereye: "el" }) },
      ]);
    }
    const c = d.kartlar[id]; if (!c) return;
    const k = c.acik ? c.k : g.gor[id], kt = kartTanim(t, k);
    const benimOnum = c.yer === "onu" && c.sahip === me.id;
    const baslik = kt ? esc(kt.ad) + (c.acik ? "" : " · kapalı") : "Kapalı " + esc(desteTanim(t, c.d).ad) + " kartı" + (c.yer === "onu" && !benimOnum ? " · " + esc((d.koltuk.find(x => x && x.id === c.sahip) || {}).name || "") : "");
    if (!oturuyor) return k && buyut(t, k, c.d);
    menuAc(x, y, baslik, [
      k && { ad: "Büyüt", fn: () => buyut(t, k, c.d) },
      !k && { ad: "Gizlice bak", fn: () => islem({ tur: "bak", kart: id }) },
      (c.yer === "masa" || benimOnum || c.acik === false && c.yer === "onu") && { ad: c.acik ? "Kapat (yüzü aşağı)" : "Aç (herkes görsün)", fn: () => islem({ tur: "cevir", kart: id }) },
      c.yer === "masa" && { ad: "Döndür", fn: () => islem({ tur: "dondur", id }) },
      { ad: "Eline al", fn: () => islem({ tur: "koy", kart: id, nereye: "el" }) },
      c.yer !== "masa" && { ad: "Masaya koy (" + (c.acik ? "açık" : "kapalı") + ")", fn: () => islem({ tur: "koy", kart: id, nereye: "masa", acik: c.acik, ...yakin(d) }) },
      c.yer === "masa" && { ad: "Önüne koy (" + (c.acik ? "açık" : "kapalı") + ")", fn: () => islem({ tur: "koy", kart: id, nereye: "onu", acik: c.acik }) },
      { ad: "Desteye koy ▸", alt: desteAlt(d, { tur: "koy", kart: id }) },
      oyuncuAlt(d, {}).length && { ad: "Bir oyuncunun önüne koy ▸", alt: oyuncuAlt(d, { tur: "koy", kart: id, nereye: "onu", acik: c.acik }) },
    ]);
  }

  /* ---------------- Sürükleme ---------------- */
  document.addEventListener("pointerdown", e => {
    if (!st.id || e.button > 0) return;
    const el = e.target.closest(".km-ic [data-tur], .km-el [data-tur], .km-onu [data-tur]"); if (!el) return;
    e.preventDefault();
    st.surukle = { el, x0: e.clientX, y0: e.clientY, oynadi: false, tur: el.dataset.tur, izle: !st.b.durum.el[X.me().id] }; // izleyiciler sürükleyemez
    el.setPointerCapture(e.pointerId);
  });
  document.addEventListener("pointermove", e => {
    const s = st.surukle; if (!s) return;
    const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
    if (s.izle || (!s.oynadi && Math.hypot(dx, dy) < 6)) return;
    if (!s.oynadi) { s.oynadi = true; menuKapat(); s.el.classList.add("suruk"); if (s.tur === "el" || s.tur === "onu") { const r = s.el.getBoundingClientRect(); s.hayal = s.el.cloneNode(true); s.hayal.className += " hayal"; Object.assign(s.hayal.style, { position: "fixed", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", zIndex: 9999, pointerEvents: "none" }); document.body.appendChild(s.hayal); s.r0 = r; } }
    if (s.hayal) { s.hayal.style.left = s.r0.left + dx + "px"; s.hayal.style.top = s.r0.top + dy + "px"; }
    else s.el.style.translate = `${dx / st.olcek}px ${dy / st.olcek}px`;
  });
  document.addEventListener("pointerup", e => {
    const s = st.surukle; if (!s) return;
    st.surukle = null;
    if (s.hayal) s.hayal.remove();
    if (!s.oynadi) { if (st.bekleyen) { st.bekleyen = false; ciz(st.id, st.b); } return nesneMenu(document.querySelector(`[data-tur="${s.tur}"][data-id="${s.el.dataset.id}"]`) || s.el, e.clientX, e.clientY); }
    const masa = $(".km-masa"), r = masa && masa.getBoundingClientRect();
    const ic = r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    const x = r ? (e.clientX - r.left) / st.olcek : 0, y = r ? (e.clientY - r.top) / st.olcek : 0;
    const id = s.el.dataset.id, d = st.b.durum, t = st.b.tanim;
    // Bir destenin üstüne bırakıldıysa kart o desteye girer.
    const hedefDeste = ic && (s.tur === "kart" || s.tur === "el" || s.tur === "onu") && Object.entries(d.desteler).find(([pid, p]) => { const dt = desteTanim(t, p.d); return Math.abs(p.x - x) < dt.w / 2 && Math.abs(p.y - y) < dt.h / 2; });
    const elAlani = document.querySelector(".km-el"), er = elAlani && elAlani.getBoundingClientRect();
    const eleBirakti = er && e.clientY >= er.top && e.clientY <= er.bottom && e.clientX >= er.left && e.clientX <= er.right;
    let h = null;
    if (hedefDeste) h = { tur: "koy", kart: id, nereye: "deste", deste: hedefDeste[0] };
    else if (eleBirakti && (s.tur === "kart" || s.tur === "onu")) h = { tur: "koy", kart: id, nereye: "el" };
    else if (ic && s.tur === "el") h = { tur: "koy", kart: id, nereye: "masa", acik: true, x, y };
    else if (ic && s.tur === "onu") { const c = d.kartlar[id]; h = { tur: "koy", kart: id, nereye: "masa", acik: c.acik, x, y }; }
    else if (ic && (s.tur === "kart" || s.tur === "tas" || s.tur === "deste")) {
      const cur = s.tur === "kart" ? d.kartlar[id] : s.tur === "tas" ? d.taslar[id] : d.desteler[id];
      h = { tur: "tasi", id, x: cur.x + (e.clientX - s.x0) / st.olcek, y: cur.y + (e.clientY - s.y0) / st.olcek };
    }
    if (h) islem(h).finally(() => { st.bekleyen = false; ciz(st.id, st.b); });
    else { st.bekleyen = false; ciz(st.id, st.b); }
  });
  document.addEventListener("dblclick", e => {
    const el = e.target.closest(".km-kart[data-id]"); if (!el || !st.b) return;
    const d = st.b.durum, g = st.gizli || { gor: {}, el: [] }, id = el.dataset.id;
    if (el.dataset.tur === "el") { const c = g.el.find(c => c.iid === id); if (c) { menuKapat(); buyut(st.b.tanim, c.k, c.k.split("/")[0]); } return; }
    const c = d.kartlar[id], k = c && (c.acik ? c.k : g.gor[id]); if (k) { menuKapat(); buyut(st.b.tanim, k, c.d); }
  });

  /* ---------------- Düğmeler ---------------- */
  document.addEventListener("click", async e => {
    const yeni = e.target.closest("[data-km-yeni],[data-km-oyun]");
    if (yeni) {
      try { const r = await X.call("kmNew", yeni.dataset.kmYeni ? { hazir: yeni.dataset.kmYeni } : { oyun: yeni.dataset.kmOyun }); location.hash = r.id; } catch (err) { tost(err.message); }
      return;
    }
    const b = e.target.closest("[data-km]"); if (!b || !st.id) return;
    const a = b.dataset.km, board = st.id;
    try {
      if (a === "otur") await X.call("kmSit", { board, koltuk: +b.dataset.i });
      else if (a === "kalk") await X.call("kmSit", { board, kalk: true });
      else if (a === "basla") await X.call("kmStart", { board });
      else if (a === "sifirla") { if (confirm("Oyun baştan başlasın mı? Kartlar toplanır, herkes koltuğunda kalır.")) await X.call("kmReset", { board }); }
      else if (a === "sil") { if (confirm("Masa herkes için kapansın mı?")) { await X.call("kmDelete", { board }); location.hash = ""; } }
      else if (a === "duzen") { await X.call("kmDuzen", { board }); tost("Destelerin ve taşların yerleri oyunun başlangıç düzeni olarak kaydedildi"); }
      else if (a === "sayac") await islem({ tur: "sayac", kisi: b.dataset.k, id: b.dataset.s, deger: +b.dataset.v });
      else if (a === "zar") await islem({ tur: "zar", yuz: +b.dataset.y, adet: 1 });
      else if (a === "sira") await islem({ tur: "sira", koltuk: +b.dataset.i });
      else if (a === "sekme") { st.sekme = b.dataset.s; ciz(st.id, st.b); }
      else if (a === "rastgele") {
        const k = b.dataset.k, d = st.b.durum, r = b.getBoundingClientRect();
        menuAc(r.left, r.bottom + 4, "Rastgele seçilen kart nereye?", [
          ...desteler(d).map(([pid, p]) => ({ ad: p.ad + " destesine", fn: () => islem({ tur: "rastgele", kisi: k, nereye: "deste", deste: pid }) })),
          { ad: "Benim elime", fn: () => islem({ tur: "rastgele", kisi: k, nereye: "el" }) },
          { ad: "Masaya açık", fn: () => islem({ tur: "rastgele", kisi: k, nereye: "masa", acik: true, ...yakin(d) }) },
        ]);
      }
    } catch (err) { tost(err.message); }
  });

  window.ZM_KARTUI = { kur: x => (X = x), lobiHtml, ciz, kapat, yuzHtml, arkaHtml, tasHtml, kuralHtml, olcekle };
})();
