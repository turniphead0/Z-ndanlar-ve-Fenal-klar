/* Masaüstü eklentileri (12): harita fırçasına mobilya ve kendi resimlerin.
   Mobilyalar haritanın props katmanında durur (m.props["x,y"] = tür). Hazır mobilyalar ev, zindan, kale, doğa ve
   büyü kategorilerinde; simgeler Twemoji'den (CC BY 4.0). DM her mobilyaya ve araziye kendi resmini verebilir
   (oyun belgesinde skins), ya da yeni bir nesne yükleyebilir (oyun belgesinde props). Birinci şahıs görünümü
   mobilyaları karton figür olarak çizer; "geçilmez" olanlar yolu keser. */
(function () {
  "use strict";

  const CATS = [["ev", "Ev"], ["zindan", "Zindan"], ["kale", "Kale"], ["doga", "Doğa"], ["buyu", "Büyü ve tapınak"], ["benim", "Benim nesnelerim"]];
  // anahtar:ad:twemoji:geçilmez:birinci şahısta yükseklik
  const RAW = {
    ev: "yatak:Yatak:1f6cf:1:.55|kanepe:Kanepe:1f6cb:1:.55|sandalye:Sandalye:1fa91:1:.55|sofra:Sofra:1f37d:1:.5|dolap:Dolap:1f5c4:1:.75|kitaplik:Kitaplık:1f4da:1:.7|kutu:Kutu:1f4e6:1:.45|kuvet:Küvet:1f6c1:1:.5|tuvalet:Tuvalet:1f6bd:1:.5|ickapi:İç kapı:1f6aa:0:.95|pencere:Pencere:1fa9f:1:.75|ayna:Ayna:1fa9e:1:.8|tablo:Tablo:1f5bc:1:.7|saat:Saat:1f570:1:.6|piyano:Piyano:1f3b9:1:.55|saksi:Saksı:1fab4:1:.55|kandil:Kandil:1fa94:0:.3|caydanlik:Çaydanlık:1fad6:0:.3|sepet:Sepet:1f9fa:0:.35|supurge:Süpürge:1f9f9:0:.7|oyuncak:Oyuncak ayı:1f9f8:0:.35",
    zindan: "tabut:Tabut:26b0:1:.5|sandik:Sandık:1f9f0:1:.45|varil:Varil:1f6e2:1:.55|kul:Kül vazosu:26b1:1:.45|mesale:Meşale:1f525:0:.6|tugla:Moloz:1f9f1:1:.45|kaya:Kaya:1faa8:1:.5|zincir:Zincir:26d3:0:.6|orumcekagi:Örümcek ağı:1f578:0:.8|kurukafa:Kurukafa:1f480:0:.3|kemik:Kemikler:1f9b4:0:.25|fare:Fare:1f400:0:.25|orumcek:Örümcek:1f577:0:.3|mum:Mum:1f56f:0:.35|anahtar:Anahtar:1f5dd:0:.25|hancer:Hançer:1f5e1:0:.3|kapan:Kapan:1faa4:0:.25|mucevher:Mücevher:1f48e:0:.25|altin:Altın kesesi:1f4b0:0:.3|mantar:Mantar:1f344:0:.3",
    kale: "taht:Taht:1f451:1:.7|silahlik:Silah rafı:2694:1:.7|kalkan:Kalkan:1f6e1:1:.6|sancak:Sancak:1f6a9:1:.95|heykel:Heykel:1f5ff:1:.95|cesme:Çeşme:26f2:1:.85|can:Çan:1f514:1:.6|amfora:Amfora:1f3fa:1:.5|at:At:1f40e:1:.85|fener:Fener:1f3ee:0:.5|yay:Yay:1f3f9:0:.5|balta:Balta:1fa93:0:.5|parsomen:Parşömen:1f4dc:0:.3|kupa:Kupa:1f3c6:0:.4|sarap:Şarap:1f377:0:.3|bira:Bira:1f37a:0:.3|ekmek:Ekmek:1f35e:0:.25|et:Et:1f356:0:.25",
    doga: "cam:Çam:1f332:1:1.35|agac:Ağaç:1f333:1:1.35|palmiye:Palmiye:1f334:1:1.35|kaktus:Kaktüs:1f335:1:.8|kutuk:Kütük:1fab5:1:.4|cadir:Çadır:26fa:1:.9|dag:Dağ:26f0:1:1.4|yanardag:Yanardağ:1f30b:1:1.4|kamp:Kamp ateşi:1f525:0:.45|cali:Çalı:1f33f:0:.4|cicek:Çiçek:1f33c:0:.3|yaprak:Yapraklar:1f342:0:.2|dalga:Dalga:1f30a:0:.4",
    buyu: "kure:Kristal küre:1f52e:1:.5|imbik:İmbik:2697:1:.5|iksir:İksir:1f9ea:0:.3|asa:Asa:1fa84:0:.5|buyukitabi:Büyü kitabı:1f4d6:0:.3|tespih:Tespih:1f4ff:0:.25|nazar:Nazar:1f9ff:0:.25|yuzuk:Yüzük:1f48d:0:.2"
  };
  const ITEMS = {};
  for (const [cat, s] of Object.entries(RAW)) for (const row of s.split("|")) { const [key, name, code, solid, h] = row.split(":");
    ITEMS[key] = { key, name, cat, img: `/ext/mobilya/${code}.svg`, solid: solid === "1", h: +h }; }
  const TERR_NAMES = Object.fromEntries(TERRAIN.map(t => [t[0], t[1]]));

  const game = () => (G.id && S.games[G.id]) || {};
  const customs = () => Object.values(game().props || {}).filter(p => p && !p.removed);
  const skin = k => (game().skins || {})[k] || "";
  function get(kind) {
    if (!kind) return null;
    if (kind.startsWith("c:")) { const p = (game().props || {})[kind.slice(2)]; return p && !p.removed ? { key: kind, name: p.name || "Nesne", img: p.img, solid: !!p.solid, h: +p.h || .8, custom: true } : null; }
    const it = ITEMS[kind]; return it ? { ...it, img: skin(kind) || it.img, own: !!skin(kind) } : null;
  }

  function draw(ctx, kind, X, Y, s) {
    const it = get(kind); if (!it) return; const im = getImg(it.img);
    if (im) { const w = im.naturalWidth, h = im.naturalHeight, k = s * .86 / Math.max(w, h); ctx.drawImage(im, X + (s - w * k) / 2, Y + (s - h * k) / 2, w * k, h * k); return; }
    ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(X + s * .2, Y + s * .2, s * .6, s * .6);
  }

  /* ---------- fırça çubuğu ---------- */
  if (!S.propCat) S.propCat = "ev";
  if (S.prop === undefined) S.prop = "yatak";
  const ibtn = (kind, it) => `<button class="tool mb-it" data-prop="${esc(kind)}" aria-pressed="${S.prop === kind}" title="${esc(it.name)}${it.solid ? " (geçilmez)" : ""}"><img src="${esc(it.img)}" alt="">${esc(it.name)}</button>`;
  function bar() {
    const cat = S.propCat, cats = CATS.map(([k, n]) => `<button class="tool" data-pcat="${k}" aria-pressed="${cat === k}">${n}</button>`).join("");
    let items = "";
    if (cat === "benim") items = customs().map(p => ibtn("c:" + p.id, get("c:" + p.id))).join("") + `<button class="tool" data-pnew="1">+ Kendi nesneni yükle</button>`;
    else items = Object.values(ITEMS).filter(x => x.cat === cat).map(x => ibtn(x.key, get(x.key))).join("");
    const sel = get(S.prop);
    let panel = "";
    if (sel?.custom) { const p = game().props[S.prop.slice(2)];
      panel = `<span class="lbl">Seçili</span><input class="mb-name" data-pname="${esc(p.id)}" value="${esc(p.name || "")}" aria-label="Nesnenin adı" maxlength="40">
        <label class="mb-chk"><input type="checkbox" data-psolid="${esc(p.id)}"${p.solid ? " checked" : ""}> Geçilmez</label>
        <label class="mb-chk">Işık <input class="mb-name mb-num" type="number" min="0" step="5" data-plight="${esc(p.id)}" value="${esc(p.light || "")}" placeholder="0" aria-label="Verdiği ışık (ft)"> ft</label>
        <button class="tool" data-pskin="${esc(S.prop)}">Resmi değiştir</button><button class="tool" data-pdel="${esc(p.id)}">Nesneyi sil</button>`; }
    else if (sel) panel = `<span class="lbl">${esc(sel.name)}</span><button class="tool" data-pskin="${esc(sel.key)}">${sel.own ? "Resmi değiştir" : "Kendi resmini kullan"}</button>${sel.own ? `<button class="tool" data-pskinreset="${esc(sel.key)}">Varsayılan resim</button>` : ""}`;
    return `<div class="tools sub mb-bar"><span class="lbl">Mobilya</span>${cats}</div>
      <div class="tools sub mb-bar">${items}<button class="tool" data-prop="" aria-pressed="${!S.prop}">Kaldır</button></div>
      ${panel ? `<div class="tools sub mb-bar">${panel}</div>` : ""}`;
  }
  function skinBtn(v) {
    if (!isDM() || S.ro || !TERR_NAMES[v]) return "";
    return `<span class="tsep"></span><button class="tool" data-pskin="${esc(v)}" title="${esc(TERR_NAMES[v])} için kendi resmini yükle">${skin(v) ? "Resmi değiştir" : "Kendi resmini kullan"}</button>${skin(v) ? `<button class="tool" data-pskinreset="${esc(v)}">Varsayılan</button>` : ""}`;
  }

  /* ---------- resim yükleme ---------- */
  const file = document.createElement("input"); file.type = "file"; file.accept = "image/*"; file.hidden = true; file.id = "propFile"; document.body.appendChild(file);
  let pending = null;
  async function fitImage(f, size = 256) {   // oranı korur, saydam kare içine ortalar
    const url = URL.createObjectURL(f);
    try { const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      const w = im.naturalWidth || size, h = im.naturalHeight || size, k = Math.min(1, size / Math.max(w, h)), c = document.createElement("canvas");
      c.width = c.height = Math.round(Math.max(w, h) * k); c.getContext("2d").drawImage(im, (c.width - w * k) / 2, (c.height - h * k) / 2, w * k, h * k);
      const blob = await new Promise(ok => c.toBlob(ok, "image/webp", .9));
      return blob && blob.type === "image/webp" ? new File([blob], "nesne.webp", { type: "image/webp" }) : await new Promise(ok => c.toBlob(b => ok(new File([b], "nesne.png", { type: "image/png" })), "image/png"));
    } finally { URL.revokeObjectURL(url); }
  }
  file.addEventListener("change", async e => {
    const f = e.target.files[0]; e.target.value = ""; const job = pending; pending = null; if (!f || !job) return;
    const g = game(); if (!g.id) return;
    let up = f; try { up = TERR_NAMES[job.key] ? await squareImage(f, 256) : await fitImage(f); } catch (err) { /* özgün dosya */ }
    let url; try { toast("Resim yükleniyor…"); url = ASSETS ? (await ASSETS.upload(up)).url : URL.createObjectURL(up); }
    catch (err) { return toast("Resim yüklenemedi: " + (err.message || err.code || "hata")); }
    if (job.kind === "new") {
      const id = uid("p"); g.props = g.props || {}; g.props[id] = { id, name: (f.name || "Nesne").replace(/\.[^.]+$/, "").slice(0, 40), img: url, solid: true, h: .8 };
      saveGame(g, ["props." + id]); S.propCat = "benim"; S.prop = "c:" + id; toast("Nesne eklendi. Adını ve geçilip geçilmediğini aşağıdan ayarlayabilirsin.");
    } else if (job.key.startsWith("c:")) { const p = g.props[job.key.slice(2)]; if (p) { p.img = url; saveGame(g, ["props." + p.id + ".img"]); } toast("Resim değişti"); }
    else { g.skins = g.skins || {}; g.skins[job.key] = url; saveGame(g, ["skins." + job.key]); toast("Kendi resmin kullanılıyor"); }
    render();
  });

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-pcat],[data-prop],[data-pnew],[data-pskin],[data-pskinreset],[data-pdel]"); if (!b) return;
    const d = b.dataset, g = game();
    if (d.pcat) { S.propCat = d.pcat; if (d.pcat === "benim") S.prop = customs()[0] ? "c:" + customs()[0].id : S.prop; else if (!ITEMS[S.prop] || ITEMS[S.prop].cat !== d.pcat) S.prop = Object.values(ITEMS).find(x => x.cat === d.pcat).key; return render(); }
    if (d.prop !== undefined) { S.prop = d.prop; return render(); }
    if (S.ro || !isDM()) return toast("Bunu yalnızca DM yapabilir");
    if (d.pnew) { pending = { kind: "new" }; return file.click(); }
    if (d.pskin) { pending = { kind: "skin", key: d.pskin }; return file.click(); }
    if (d.pskinreset) { g.skins = g.skins || {}; g.skins[d.pskinreset] = ""; saveGame(g, ["skins." + d.pskinreset]); render(); return toast("Varsayılan resme dönüldü"); }
    if (d.pdel) { const p = g.props?.[d.pdel]; if (!p) return; armed(b, () => { p.removed = true; saveGame(g, ["props." + p.id + ".removed"]); S.prop = ""; render(); toast("Nesne silindi; haritadaki kopyaları da kalktı"); }); }
  });
  document.addEventListener("change", e => {
    const t = e.target, g = game();
    if (t.dataset.pname && g.props?.[t.dataset.pname]) { g.props[t.dataset.pname].name = t.value.trim().slice(0, 40) || "Nesne"; saveGame(g, ["props." + t.dataset.pname + ".name"]); render(); }
    if (t.dataset.plight && g.props?.[t.dataset.plight]) { g.props[t.dataset.plight].light = Math.max(0, +t.value || 0); saveGame(g, ["props." + t.dataset.plight + ".light"]); drawMap(); }
    if (t.dataset.psolid && g.props?.[t.dataset.psolid]) { g.props[t.dataset.psolid].solid = t.checked; saveGame(g, ["props." + t.dataset.psolid + ".solid"]); }
  });

  window.PROPS = { CATS, ITEMS, get, draw, bar, skinBtn, skin, solid: k => !!get(k)?.solid };
})();
