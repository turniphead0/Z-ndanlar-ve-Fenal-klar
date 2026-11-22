/* Haritaya konan mobilya ve eşyaların gerçekçi ikonlarını çizer (256×256, saydam, önden üç çeyrek görünüm, ışık sol üstten).
   Tarayıcıda çalışır; tools/gorsel/esyalar.js bu dosyayı Chromium'da açar ve her ikonu web/ext/esya/<anahtar>.webp olarak kaydeder.
   Dokular web/ext/doku.js'ten gelir. Her şey bu kodla üretilir; dışarıdan resim yoktur (MIT). */
(function () {
  "use strict";
  const D = window.ZMDoku, S = 256, PI2 = Math.PI * 2;
  const K = c => D.karis(c, "#000", 0), koyu = (c, t) => D.karis(c, "#000", t), acik = (c, t) => D.karis(c, "#fff", t);
  let x; // geçerli tuval bağlamı
  const pat = (ad, renk, olcek = .35, aci = 0) => { const p = x.createPattern(D.doku(ad, renk, 256), "repeat"); p.setTransform(new DOMMatrix().rotate(aci).scale(olcek)); return p; };
  function yol(f) { x.beginPath(); f(); }
  function dol(stil, f) { yol(f); x.fillStyle = stil; x.fill(); }
  function cz(stil, w, f) { yol(f); x.strokeStyle = stil; x.lineWidth = w; x.lineCap = x.lineJoin = "round"; x.stroke(); }
  // Yatay gölgelendirme: sol aydınlık, sağ karanlık (silindir ve yuvarlak yüzeyler için)
  function yanIsik(x0, x1, a = .35, b = .45) { const g = x.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, `rgba(255,255,255,${a * .5})`); g.addColorStop(.3, "rgba(255,255,255,0)"); g.addColorStop(.7, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${b})`); return g; }
  const dikIsik = (y0, y1, a = .25, b = .35) => { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(.4, "rgba(255,255,255,0)"); g.addColorStop(1, `rgba(0,0,0,${b})`); return g; };
  function golge(cx = 128, w = 90, y = 234, a = .45) { x.save(); x.filter = "blur(6px)"; dol(`rgba(0,0,0,${a})`, () => x.ellipse(cx + 6, y, w, w * .16, 0, 0, PI2)); x.restore(); }
  function kenar(f, w = 2.5, a = .55) { x.save(); cz(`rgba(20,12,6,${a})`, w, f); x.restore(); }
  // Önden kutu: üst yüz (d yüksekliğinde, açık), ön yüz (koyu), dokulu
  function kutu(x0, y0, w, h, d, ad, renk, olcek = .3, aci = 0) {
    const ust = () => { x.moveTo(x0 + d * .5, y0); x.lineTo(x0 + w + d * .5, y0); x.lineTo(x0 + w, y0 + d); x.lineTo(x0, y0 + d); x.closePath(); };
    const yan = () => { x.moveTo(x0 + w, y0 + d); x.lineTo(x0 + w + d * .5, y0); x.lineTo(x0 + w + d * .5, y0 + h); x.lineTo(x0 + w, y0 + d + h); x.closePath(); };
    const on = () => x.rect(x0, y0 + d, w, h);
    dol(pat(ad, renk, olcek, aci), on); dol(dikIsik(y0 + d, y0 + d + h, .1, .3), on);
    dol(pat(ad, acik(renk, .12), olcek, aci), ust); dol("rgba(255,250,235,.18)", ust);
    dol(pat(ad, koyu(renk, .35), olcek, aci), yan); dol("rgba(0,0,0,.25)", yan);
    kenar(on); kenar(ust); kenar(yan);
  }
  function silindir(cx, ust, rx, ry, h, stil, kapak) {
    const govde = () => { x.moveTo(cx - rx, ust); x.lineTo(cx - rx, ust + h); x.ellipse(cx, ust + h, rx, ry, 0, Math.PI, 0, true); x.lineTo(cx + rx, ust); x.closePath(); };
    dol(stil, govde); dol(yanIsik(cx - rx, cx + rx), govde); kenar(govde);
    dol(kapak || stil, () => x.ellipse(cx, ust, rx, ry, 0, 0, PI2)); dol("rgba(255,255,255,.12)", () => x.ellipse(cx, ust, rx, ry, 0, 0, PI2)); kenar(() => x.ellipse(cx, ust, rx, ry, 0, 0, PI2));
  }
  function kure(cx, cy, r, renk, parlak = .7) {
    const g = x.createRadialGradient(cx - r * .35, cy - r * .4, r * .05, cx, cy, r); g.addColorStop(0, acik(renk, .6)); g.addColorStop(.45, renk); g.addColorStop(1, koyu(renk, .55));
    dol(g, () => x.arc(cx, cy, r, 0, PI2));
    const h = x.createRadialGradient(cx - r * .4, cy - r * .45, 0, cx - r * .4, cy - r * .45, r * .35); h.addColorStop(0, `rgba(255,255,255,${parlak})`); h.addColorStop(1, "rgba(255,255,255,0)"); dol(h, () => x.arc(cx, cy, r, 0, PI2));
  }
  function metal(x0, x1, renk = "#9aa3a8") { const g = x.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, koyu(renk, .3)); g.addColorStop(.25, acik(renk, .55)); g.addColorStop(.5, renk); g.addColorStop(.8, koyu(renk, .45)); g.addColorStop(1, koyu(renk, .2)); return g; }
  function metalY(y0, y1, renk = "#9aa3a8") { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, acik(renk, .5)); g.addColorStop(.45, renk); g.addColorStop(1, koyu(renk, .5)); return g; }
  function alev(cx, taban, h, w) {
    x.save(); x.globalCompositeOperation = "lighter"; const ig = x.createRadialGradient(cx, taban - h * .4, 0, cx, taban - h * .4, h * 1.1); ig.addColorStop(0, "rgba(255,170,60,.55)"); ig.addColorStop(1, "rgba(255,120,20,0)"); dol(ig, () => x.arc(cx, taban - h * .4, h * 1.1, 0, PI2)); x.restore();
    const f = (k, c) => dol(c, () => { x.moveTo(cx - w * k, taban); x.bezierCurveTo(cx - w * k * 1.1, taban - h * k * .5, cx - w * k * .2, taban - h * k * .7, cx, taban - h * k); x.bezierCurveTo(cx + w * k * .3, taban - h * k * .6, cx + w * k * 1.1, taban - h * k * .45, cx + w * k, taban); x.closePath(); });
    const g1 = x.createLinearGradient(0, taban - h, 0, taban); g1.addColorStop(0, "#ff5a1a"); g1.addColorStop(1, "#ffb02e"); f(1, g1);
    const g2 = x.createLinearGradient(0, taban - h * .7, 0, taban); g2.addColorStop(0, "#ffd24a"); g2.addColorStop(1, "#fff6c8"); f(.6, g2);
  }
  function kumas(path, renk, aci = 0, olcek = .6) { dol(pat("hali", renk, olcek, aci), path); }
  const yRect = (x0, y0, w, h, r) => () => x.roundRect(x0, y0, w, h, r);
  function ip(xs, ys, renk = "#c9b38a", w = 3) { cz(renk, w, () => { x.moveTo(xs[0], ys[0]); for (let i = 1; i < xs.length; i++) x.lineTo(xs[i], ys[i]); }); }
  const resim = (img, x0, y0, w, h) => x.drawImage(img, x0, y0, w, h);
  function tasDoku(path, renk = "#8d8a84", olcek = .4) { dol(pat("kaya", renk, olcek), path); }
  const AHSAP = "#8a5a32", KOYU_AHSAP = "#5a3a20", DEMIR = "#6f767b", ALTIN = "#d9a93a", GUMUS = "#c8cdd0";

  const C = {};
  /* ---------------- Ev ---------------- */
  C.yatak = () => { golge(128, 105);
    kutu(26, 120, 196, 70, 30, "tahta", KOYU_AHSAP, .3); // gövde
    kutu(20, 60, 22, 150, 8, "tahta", KOYU_AHSAP, .3); // başlık
    dol(pat("hali", "#e9e3d6", 1.4), yRect(46, 112, 172, 44, 10)); dol(dikIsik(112, 156, .2, .3), yRect(46, 112, 172, 44, 10)); kenar(yRect(46, 112, 172, 44, 10), 2, .35);
    dol(pat("hali", "#7a2d3a", 2), yRect(96, 106, 126, 54, 8)); dol(dikIsik(106, 160, .2, .35), yRect(96, 106, 126, 54, 8)); kenar(yRect(96, 106, 126, 54, 8), 2, .4);
    dol("#f5f1e8", yRect(50, 98, 44, 26, 12)); dol(dikIsik(98, 124, .3, .25), yRect(50, 98, 44, 26, 12)); kenar(yRect(50, 98, 44, 26, 12), 2, .3); };
  C.kanepe = () => { golge(128, 100); const k = "#6b3a2f";
    kutu(30, 70, 196, 70, 10, "hali", k, 2.2); kutu(30, 130, 196, 60, 24, "hali", acik(k, .1), 2.2);
    kutu(18, 104, 30, 90, 16, "hali", koyu(k, .1), 2.2); kutu(208, 104, 30, 90, 16, "hali", koyu(k, .1), 2.2);
    for (const cx of [72, 128, 184]) dol("rgba(0,0,0,.25)", () => x.rect(cx + 26, 134, 2, 22)); for (const lx of [36, 220]) dol(KOYU_AHSAP, () => x.rect(lx, 194, 10, 22)); };
  C.sandalye = () => { golge(128, 60);
    kutu(76, 40, 104, 100, 10, "tahta", AHSAP, .25, 90); for (const y of [64, 92]) dol("rgba(0,0,0,.35)", () => x.rect(90, y, 76, 6));
    kutu(70, 140, 116, 20, 26, "tahta", AHSAP, .25);
    for (const [lx, h] of [[74, 60], [170, 60], [86, 44], [158, 44]]) kutu(lx, 166 + (h < 50 ? 0 : 0), 12, h, 0, "tahta", koyu(AHSAP, .15), .25, 90); };
  C.sofra = () => { golge(128, 110);
    for (const lx of [40, 200]) kutu(lx, 130, 16, 92, 0, "tahta", koyu(AHSAP, .2), .25, 90);
    kutu(18, 96, 220, 18, 40, "tahta", AHSAP, .3);
    // tabak, kadeh, ekmek
    dol("#e8e4dc", () => x.ellipse(90, 114, 30, 9, 0, 0, PI2)); dol("#c9c2b4", () => x.ellipse(90, 114, 20, 6, 0, 0, PI2)); dol("#8a4a1f", () => x.ellipse(90, 111, 14, 6, 0, 0, PI2));
    dol(metal(150, 166, "#c9a24a"), () => x.rect(152, 84, 12, 24)); dol(metal(146, 170, "#c9a24a"), () => x.ellipse(158, 84, 12, 5, 0, 0, PI2)); dol("#7a1424", () => x.ellipse(158, 86, 9, 3, 0, 0, PI2)); };
  C.dolap = () => { golge(128, 80);
    kutu(56, 24, 140, 196, 18, "tahtaDikey", AHSAP, .3); dol("rgba(0,0,0,.45)", () => x.rect(125, 44, 3, 194));
    for (const [px, py] of [[70, 58], [134, 58], [70, 150], [134, 150]]) { dol("rgba(0,0,0,.18)", yRect(px, py, 50, 78, 4)); kenar(yRect(px, py, 50, 78, 4), 2, .35); }
    for (const kx of [116, 136]) kure(kx, 140, 5, ALTIN, .9); };
  C.kitaplik = () => { golge(128, 90);
    kutu(36, 22, 180, 200, 14, "tahta", KOYU_AHSAP, .3);
    const renk = ["#7a2230", "#2b4a7a", "#3b6b3b", "#8a6b2b", "#5a2a5a", "#6a4a2a"]; let r = 7;
    for (const raf of [44, 104, 164]) { dol("rgba(0,0,0,.55)", () => x.rect(46, raf, 160, 52)); let bx = 50;
      while (bx < 198) { r = (r * 9301 + 49297) % 233280; const w = 8 + r % 9, h = 36 + r % 14, c = renk[r % 6]; if (bx + w > 202) break;
        dol(c, () => x.rect(bx, raf + 52 - h, w, h)); dol(yanIsik(bx, bx + w, .5, .5), () => x.rect(bx, raf + 52 - h, w, h)); dol("rgba(255,215,120,.6)", () => x.rect(bx, raf + 52 - h + 6, w, 2)); bx += w + 1; }
      kutu(42, raf + 52, 168, 6, 0, "tahta", AHSAP, .3); } };
  C.kutu = () => { golge(128, 80); kutu(50, 92, 150, 110, 40, "tahta", "#a07a4a", .25);
    for (const yy of [140, 190]) dol("rgba(40,25,10,.35)", () => x.rect(50, yy, 150, 4)); dol("#c9b38a", () => x.rect(115, 92, 20, 150)); dol("rgba(0,0,0,.15)", () => x.rect(115, 92, 20, 150)); };
  C.kuvet = () => { golge(128, 110);
    const g = () => { x.moveTo(24, 110); x.lineTo(232, 110); x.bezierCurveTo(232, 190, 200, 210, 128, 210); x.bezierCurveTo(56, 210, 24, 190, 24, 110); x.closePath(); };
    dol(metalY(110, 210, "#f2efe9"), g); kenar(g, 2.5, .4);
    dol(metalY(96, 124, "#f6f4ef"), () => x.ellipse(128, 110, 104, 18, 0, 0, PI2)); dol(pat("su", "#6fa9c4", .4), () => x.ellipse(128, 112, 92, 12, 0, 0, PI2));
    for (const fx of [52, 204]) dol(metal(fx - 8, fx + 8, ALTIN), () => x.rect(fx - 6, 206, 12, 18));
    dol(metal(208, 222, GUMUS), () => x.rect(210, 70, 8, 40)); dol(metal(190, 222, GUMUS), () => x.rect(194, 66, 26, 8)); };
  C.tuvalet = () => { golge(128, 70);
    dol(metalY(30, 104, "#f4f1ec"), yRect(80, 34, 96, 62, 8)); kenar(yRect(80, 34, 96, 62, 8), 2, .3);
    dol(metalY(100, 190, "#f4f1ec"), () => { x.moveTo(84, 104); x.lineTo(172, 104); x.bezierCurveTo(172, 170, 150, 190, 128, 190); x.bezierCurveTo(106, 190, 84, 170, 84, 104); x.closePath(); });
    dol(metalY(90, 120, "#fbfaf7"), () => x.ellipse(128, 104, 50, 16, 0, 0, PI2)); dol("#c9d6dc", () => x.ellipse(128, 106, 34, 9, 0, 0, PI2));
    dol(metalY(184, 226, "#ece8e1"), () => x.rect(108, 184, 40, 40)); kenar(() => x.ellipse(128, 104, 50, 16, 0, 0, PI2), 2, .3); kure(166, 44, 5, GUMUS); };
  C.ickapi = () => { golge(128, 70);
    kutu(62, 14, 132, 210, 10, "tas", "#8e8a82", .25);
    const ic = yRect(74, 30, 108, 194, 6); dol(pat("tahtaDikey", "#8a5a32", .35), ic); dol(dikIsik(30, 224, .1, .3), ic); kenar(ic);
    for (const yy of [70, 170]) { dol("#2b2a28", () => x.rect(74, yy, 108, 9)); for (let i = 0; i < 4; i++) kure(86 + i * 28, yy + 4.5, 3, "#5a5652", .5); }
    cz("#2a2826", 4, () => x.arc(164, 128, 10, 0, PI2)); kure(164, 118, 4, "#3a3634"); };
  C.pencere = () => { golge(128, 70, 236, .3);
    kutu(42, 30, 172, 172, 12, "tas", "#9a958c", .25);
    const cam = yRect(58, 50, 140, 144, 4); const g = x.createLinearGradient(58, 50, 198, 194); g.addColorStop(0, "#bfe1f2"); g.addColorStop(.5, "#7fb3d3"); g.addColorStop(1, "#3d6f8f"); dol(g, cam);
    dol("rgba(255,255,255,.35)", () => { x.moveTo(70, 60); x.lineTo(110, 60); x.lineTo(70, 120); x.closePath(); });
    for (const r of [[124, 50, 8, 144], [58, 118, 140, 8]]) kutu(r[0], r[1], r[2], r[3], 0, "tahta", "#e6dccb", .2);
    kenar(cam); kutu(36, 196, 184, 12, 10, "tas", "#b0aaa0", .25); };
  C.ayna = () => { golge(128, 55);
    const cer = () => x.ellipse(128, 104, 66, 92, 0, 0, PI2); dol(metal(62, 194, ALTIN), cer); kenar(cer);
    const g = x.createLinearGradient(70, 20, 190, 190); g.addColorStop(0, "#e9f2f6"); g.addColorStop(.45, "#a8c2cf"); g.addColorStop(1, "#4e6a78"); dol(g, () => x.ellipse(128, 104, 52, 78, 0, 0, PI2));
    dol("rgba(255,255,255,.5)", () => { x.moveTo(96, 50); x.lineTo(116, 40); x.lineTo(92, 120); x.lineTo(84, 110); x.closePath(); });
    dol(metal(110, 146, ALTIN), () => x.rect(116, 192, 24, 30)); dol(metal(88, 168, ALTIN), () => x.ellipse(128, 224, 40, 8, 0, 0, PI2)); };
  C.tablo = () => { golge(128, 80, 234, .3);
    kutu(30, 40, 196, 160, 10, "tahta", "#b08a3a", .2); dol(metal(30, 226, ALTIN), () => x.rect(30, 50, 196, 160)); kenar(() => x.rect(30, 50, 196, 160));
    const ic = () => x.rect(48, 66, 160, 128); const g = x.createLinearGradient(0, 66, 0, 194); g.addColorStop(0, "#8fb6d8"); g.addColorStop(.55, "#e9d9a8"); g.addColorStop(.56, "#5d7f3e"); g.addColorStop(1, "#3a5a2a"); dol(g, ic);
    dol("#4a5a6a", () => { x.moveTo(48, 140); x.lineTo(96, 96); x.lineTo(130, 128); x.lineTo(160, 104); x.lineTo(208, 140); x.closePath(); }); dol("#f2f2f2", () => { x.moveTo(86, 105); x.lineTo(96, 96); x.lineTo(106, 105); x.closePath(); });
    kure(178, 86, 10, "#fff1b0", .3); dol(pat("cimen", "#5d7f3e", .25), () => x.rect(48, 150, 160, 44)); kenar(ic, 3, .6); };
  C.saat = () => { golge(128, 50);
    kutu(84, 20, 88, 204, 12, "tahtaDikey", KOYU_AHSAP, .3);
    dol(metal(92, 164, ALTIN), () => x.arc(128, 74, 34, 0, PI2)); dol("#f4efe1", () => x.arc(128, 74, 28, 0, PI2)); kenar(() => x.arc(128, 74, 28, 0, PI2), 2, .5);
    for (let i = 0; i < 12; i++) { const a = i / 12 * PI2; dol("#2a2622", () => x.arc(128 + Math.cos(a) * 23, 74 + Math.sin(a) * 23, 1.6, 0, PI2)); }
    cz("#1a1612", 3, () => { x.moveTo(128, 74); x.lineTo(128, 56); x.moveTo(128, 74); x.lineTo(141, 80); });
    dol("rgba(20,12,6,.6)", yRect(100, 120, 56, 90, 6)); cz(metal(126, 130, ALTIN), 2.5, () => { x.moveTo(128, 120); x.lineTo(128, 178); }); kure(128, 186, 12, ALTIN); };
  C.piyano = () => { golge(128, 110); const k = "#1c1714";
    kutu(22, 30, 212, 120, 16, "tahta", k, .3); dol("rgba(255,255,255,.08)", () => x.rect(22, 46, 212, 120));
    kutu(22, 130, 212, 18, 22, "tahta", k, .3);
    for (let i = 0; i < 26; i++) { dol("#f6f2e8", () => x.rect(26 + i * 8, 134, 7, 16)); } for (let i = 0; i < 26; i++) if ([0, 1, 3, 4, 5].includes(i % 7)) dol("#111", () => x.rect(31 + i * 8, 134, 4, 10));
    for (const lx of [32, 214]) kutu(lx, 172, 14, 50, 0, "tahta", k, .3); kure(80, 60, 4, ALTIN); kure(176, 60, 4, ALTIN); };
  C.saksi = () => { golge(128, 55);
    silindir(128, 150, 44, 12, 70, pat("toprak", "#b5643a", .25), "#5a3a24"); resim(D.sprite("agac", "#4d7a34", 1), 60, 46, 136, 120); };
  C.kandil = () => { golge(128, 60);
    dol(metalY(150, 210, ALTIN), () => { x.moveTo(60, 170); x.bezierCurveTo(70, 210, 170, 214, 200, 180); x.lineTo(214, 162); x.bezierCurveTo(180, 170, 110, 150, 60, 170); x.closePath(); });
    cz(metal(40, 70, ALTIN), 7, () => { x.moveTo(64, 176); x.bezierCurveTo(34, 172, 34, 146, 58, 150); });
    dol(metalY(150, 180, ALTIN), () => x.ellipse(126, 166, 52, 12, 0, 0, PI2)); alev(204, 160, 56, 14); };
  C.caydanlik = () => { golge(128, 70);
    const g = () => { x.moveTo(70, 110); x.bezierCurveTo(56, 210, 200, 210, 186, 110); x.closePath(); }; dol(metal(60, 196, "#b9472a"), g); kenar(g);
    cz(metal(180, 230, "#b9472a"), 10, () => { x.moveTo(182, 150); x.lineTo(226, 104); }); cz(koyu("#b9472a", .4), 8, () => x.arc(128, 96, 44, Math.PI * 1.05, Math.PI * 1.95));
    dol(metalY(96, 116, "#c9583a"), () => x.ellipse(128, 110, 58, 12, 0, 0, PI2)); kure(128, 92, 9, "#2a2624"); };
  C.sepet = () => { golge(128, 80);
    const g = () => { x.moveTo(42, 110); x.lineTo(214, 110); x.lineTo(196, 214); x.lineTo(60, 214); x.closePath(); }; dol(pat("tahtaDikey", "#b48a52", .18, 90), g);
    x.save(); x.clip(new Path2D("M42 110 L214 110 L196 214 L60 214 Z")); for (let yy = 116; yy < 214; yy += 12) for (let xx = 40; xx < 220; xx += 16) dol(((yy + xx) / 4) % 2 ? "rgba(0,0,0,.18)" : "rgba(255,240,200,.12)", () => x.rect(xx + ((yy / 12) % 2) * 8, yy, 14, 10)); dol(yanIsik(42, 214), g); x.restore(); kenar(g);
    cz("#8a6234", 8, () => x.ellipse(128, 110, 86, 64, 0, Math.PI, 0)); dol("#a07a46", () => x.ellipse(128, 110, 86, 12, 0, 0, PI2));
    for (const [ax, ay, r] of [[100, 100, 16], [138, 96, 18], [168, 104, 14]]) kure(ax, ay, r, ["#c0392b", "#d4a017", "#5a8f2a"][(ax / 10) % 3 | 0]); };
  C.supurge = () => { golge(128, 70);
    cz(metal(118, 138, "#a07a46"), 12, () => { x.moveTo(170, 20); x.lineTo(110, 160); });
    const f = () => { x.moveTo(94, 150); x.lineTo(126, 162); x.lineTo(118, 226); x.lineTo(48, 214); x.closePath(); }; dol(pat("tahtaDikey", "#d9b56a", .15, -20), f);
    for (let i = 0; i < 18; i++) cz("rgba(90,60,20,.45)", 1.5, () => { x.moveTo(100 + i * .8, 158); x.lineTo(54 + i * 3.8, 216); }); kenar(f); dol("#7a3b20", () => x.rect(96, 150, 34, 10)); };
  C.oyuncak = () => { golge(128, 70); const k = "#9a6a3a", f = pat("hali", k, 3);
    for (const [cx, cy, r] of [[128, 160, 56], [76, 110, 20], [180, 110, 20], [128, 86, 44], [86, 52, 18], [170, 52, 18], [84, 206, 22], [172, 206, 22]]) { dol(f, () => x.arc(cx, cy, r, 0, PI2)); dol(x.createRadialGradient(cx - r * .3, cy - r * .3, 0, cx, cy, r), () => x.arc(cx, cy, r, 0, PI2)); }
    for (const [cx, cy, r] of [[128, 160, 56], [128, 86, 44]]) { const g = x.createRadialGradient(cx - r * .3, cy - r * .4, 0, cx, cy, r); g.addColorStop(0, "rgba(255,255,255,.2)"); g.addColorStop(1, "rgba(0,0,0,.35)"); dol(g, () => x.arc(cx, cy, r, 0, PI2)); }
    dol("#e2c79a", () => x.ellipse(128, 100, 20, 15, 0, 0, PI2)); kure(112, 80, 5, "#111", .8); kure(144, 80, 5, "#111", .8); kure(128, 96, 6, "#2a1a10", .6); dol("#b3263a", () => { x.moveTo(108, 128); x.lineTo(148, 128); x.lineTo(128, 140); x.closePath(); }); };

  /* ---------------- Zindan ---------------- */
  C.tabut = () => { golge(128, 90);
    const p = new Path2D("M128 14 L176 52 L164 226 L92 226 L80 52 Z"), u = new Path2D("M128 14 L176 52 L168 64 L128 30 L88 64 L80 52 Z");
    x.fillStyle = pat("tahtaDikey", "#4a2e1c", .3); x.fill(p); x.fillStyle = dikIsik(14, 226, .1, .35); x.fill(p); x.fillStyle = yanIsik(80, 176, .2, .35); x.fill(p);
    x.lineWidth = 3; x.strokeStyle = "rgba(15,8,4,.7)"; x.stroke(p); x.fillStyle = "rgba(255,240,220,.12)"; x.fill(u);
    cz(metal(118, 138, "#b9b2a0"), 6, () => { x.moveTo(128, 70); x.lineTo(128, 150); x.moveTo(104, 96); x.lineTo(152, 96); }); };
  C.sandik = () => { golge(128, 90);
    kutu(40, 110, 176, 100, 26, "tahta", "#7a4e2a", .3);
    dol(pat("tahta", "#7a4e2a", .3), () => { x.moveTo(40, 136); x.bezierCurveTo(40, 70, 216, 70, 216, 136); x.closePath(); }); dol(dikIsik(80, 136, .25, .1), () => { x.moveTo(40, 136); x.bezierCurveTo(40, 70, 216, 70, 216, 136); x.closePath(); }); kenar(() => { x.moveTo(40, 136); x.bezierCurveTo(40, 70, 216, 70, 216, 136); x.closePath(); });
    for (const bx of [58, 188]) { dol(metal(bx, bx + 12, DEMIR), () => x.rect(bx, 86, 12, 150)); for (const yy of [120, 170, 214]) kure(bx + 6, yy, 3, "#8a9196"); }
    dol(metalY(130, 172, ALTIN), yRect(116, 130, 26, 34, 4)); dol("#1a1612", () => x.rect(126, 146, 6, 10)); kenar(yRect(116, 130, 26, 34, 4), 2, .5); };
  C.varil = () => { golge(128, 70); silindir(128, 34, 64, 14, 180, metal(64, 192, "#3d6a8a")); for (const yy of [80, 150]) { dol("rgba(0,0,0,.25)", () => x.rect(64, yy, 128, 6)); dol("rgba(255,255,255,.15)", () => x.rect(64, yy + 6, 128, 2)); }
    dol("#f0c22a", () => { x.moveTo(108, 104); x.lineTo(148, 104); x.lineTo(128, 134); x.closePath(); }); dol("#111", () => x.arc(128, 116, 4, 0, PI2)); kure(150, 30, 6, "#2a2a2a"); };
  C.kul = () => { golge(128, 55);
    const g = () => { x.moveTo(98, 56); x.bezierCurveTo(40, 90, 50, 200, 104, 214); x.lineTo(152, 214); x.bezierCurveTo(206, 200, 216, 90, 158, 56); x.closePath(); };
    dol(pat("kaya", "#5a7480", .5), g); dol(yanIsik(52, 204, .35, .5), g); kenar(g);
    dol(metal(96, 160, ALTIN), () => x.rect(96, 46, 64, 14)); dol(metal(108, 148, ALTIN), () => x.ellipse(128, 40, 26, 10, 0, 0, PI2)); kure(128, 30, 8, ALTIN); dol(metal(96, 160, ALTIN), () => x.rect(100, 210, 56, 14)); };
  C.mesale = () => { golge(128, 40);
    cz(metal(118, 138, "#6b4423"), 14, () => { x.moveTo(128, 228); x.lineTo(128, 96); }); dol(metal(110, 146, DEMIR), () => x.rect(110, 86, 36, 22)); cz("#3a3634", 3, () => { x.moveTo(110, 98); x.lineTo(146, 98); });
    dol(pat("toprak", "#3a2a1a", .2), () => x.ellipse(128, 86, 22, 8, 0, 0, PI2)); alev(128, 90, 80, 26); };
  C.tugla = () => { golge(128, 105);
    for (const [bx, by, w, h, a] of [[40, 160, 70, 40, -.1], [110, 170, 80, 36, .08], [70, 120, 74, 38, .2], [150, 128, 64, 36, -.25], [26, 196, 60, 30, .3], [176, 190, 58, 32, -.1], [104, 86, 56, 32, -.05]]) {
      x.save(); x.translate(bx + w / 2, by + h / 2); x.rotate(a); kutu(-w / 2, -h / 2, w, h * .7, h * .3, "tas", "#8a5a42", .25); x.restore(); }
    for (let i = 0; i < 30; i++) dol("rgba(120,90,70,.8)", () => x.arc(30 + (i * 53) % 200, 214 + (i * 7) % 16, 2 + i % 3, 0, PI2)); };
  C.kaya = () => { golge(128, 100); resim(D.sprite("kaya", "#7d776f", 1), 20, 40, 216, 190); };
  C.zincir = () => { for (let i = 0; i < 7; i++) { const cy = 24 + i * 30, yat = i % 2;
      x.save(); x.translate(128 + Math.sin(i * .6) * 8, cy); cz(metal(-14, 14, DEMIR), 7, () => x.ellipse(0, 0, yat ? 6 : 16, 20, 0, 0, PI2)); cz("rgba(255,255,255,.35)", 1.5, () => x.ellipse(-2, -2, yat ? 3 : 12, 16, 0, Math.PI, Math.PI * 1.6)); x.restore(); }
    dol(metal(100, 156, DEMIR), () => x.rect(100, 6, 56, 14)); golge(128, 30, 238, .3); };
  C.orumcekagi = () => { x.save(); x.strokeStyle = "rgba(235,235,235,.9)"; x.lineWidth = 1.6; const cx = 40, cy = 40;
    for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * 230, cy + Math.sin(a) * 230); x.stroke(); }
    for (let r = 30; r < 230; r += 26) { x.beginPath(); for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2, rr = r - (i % 2) * 6, px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr; i ? x.quadraticCurveTo(cx + Math.cos(a - .1) * (rr - 8), cy + Math.sin(a - .1) * (rr - 8), px, py) : x.moveTo(px, py); } x.stroke(); }
    x.restore(); x.save(); x.globalAlpha = .4; x.strokeStyle = "#000"; x.lineWidth = 1; x.translate(3, 3); x.restore(); };
  C.kurukafa = () => { golge(128, 70);
    const k = () => { x.moveTo(128, 36); x.bezierCurveTo(206, 36, 214, 120, 188, 150); x.lineTo(180, 186); x.lineTo(76, 186); x.lineTo(68, 150); x.bezierCurveTo(42, 120, 50, 36, 128, 36); x.closePath(); };
    const g = x.createRadialGradient(100, 70, 10, 128, 120, 120); g.addColorStop(0, "#f6f0e0"); g.addColorStop(.6, "#d9cfb6"); g.addColorStop(1, "#8a7f66"); dol(g, k); kenar(k);
    for (const ex of [96, 160]) { const e = x.createRadialGradient(ex, 118, 2, ex, 118, 24); e.addColorStop(0, "#050302"); e.addColorStop(1, "#3a2f22"); dol(e, () => x.ellipse(ex, 118, 22, 20, 0, 0, PI2)); }
    dol("#2a2218", () => { x.moveTo(128, 136); x.lineTo(116, 160); x.lineTo(140, 160); x.closePath(); });
    dol("#e9e0c8", () => x.rect(84, 180, 88, 30)); for (let i = 0; i < 8; i++) dol("rgba(40,30,20,.6)", () => x.rect(86 + i * 11, 182, 1.5, 26)); kenar(() => x.rect(84, 180, 88, 30), 2, .5); };
  C.kemik = () => { golge(128, 100);
    const kem = (x0, y0, x1, y1) => { cz("#7a6f5a", 18, () => { x.moveTo(x0, y0); x.lineTo(x1, y1); }); cz("#ece4cf", 14, () => { x.moveTo(x0, y0); x.lineTo(x1, y1); });
      for (const [px, py] of [[x0, y0], [x1, y1]]) for (const d of [-1, 1]) { const a = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2; kure(px + Math.cos(a) * 8 * d, py + Math.sin(a) * 8 * d, 11, "#e6dcc2", .5); } };
    kem(40, 200, 200, 150); kem(60, 130, 210, 210); kem(90, 90, 170, 120); };
  C.fare = () => { golge(128, 80);
    cz("#c99a8a", 4, () => { x.moveTo(200, 180); x.bezierCurveTo(240, 190, 240, 230, 200, 226); });
    const g = () => x.ellipse(140, 170, 62, 36, 0, 0, PI2); dol(pat("kaya", "#7a706a", .3), g); dol(x.createRadialGradient(120, 150, 5, 140, 170, 70), g); dol(dikIsik(134, 206, .2, .4), g);
    dol(pat("kaya", "#7a706a", .3), () => { x.moveTo(90, 150); x.lineTo(40, 176); x.lineTo(92, 196); x.closePath(); }); dol("#e8a8a0", () => x.arc(40, 176, 5, 0, PI2));
    for (const ex of [88, 108]) { dol("#8a7a72", () => x.arc(ex, 140, 13, 0, PI2)); dol("#d99a94", () => x.arc(ex, 140, 8, 0, PI2)); } kure(66, 168, 4, "#111", .9); };
  C.orumcek = () => { golge(128, 90);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const a = (-.7 + i * .45) * s; cz("#1a1614", 6, () => { x.moveTo(128, 130); const kx = 128 + s * (60 + i * 6), ky = 92 + i * 22; x.quadraticCurveTo(128 + s * 50, 60 + i * 26, kx, ky); x.lineTo(kx + s * 26, ky + 70); }); }
    kure(128, 150, 44, "#2a2220", .4); for (let i = 0; i < 3; i++) dol("#b3261e", () => x.arc(128, 136 + i * 14, 5 - i, 0, PI2)); kure(128, 104, 24, "#241e1c", .4); for (const ex of [118, 138]) kure(ex, 96, 4, "#e23a2a", .9); };
  C.mum = () => { golge(128, 50);
    dol(metalY(196, 224, ALTIN), () => x.ellipse(128, 210, 56, 14, 0, 0, PI2)); silindir(128, 90, 22, 7, 112, metal(106, 150, "#f2ead6"), "#f8f3e6");
    cz("#3a2a1a", 2, () => { x.moveTo(128, 90); x.lineTo(128, 78); }); dol("rgba(240,230,200,.9)", () => { x.moveTo(110, 90); x.quadraticCurveTo(104, 120, 112, 122); x.lineTo(112, 92); }); alev(128, 80, 46, 11); };
  C.anahtar = () => { golge(128, 80);
    x.save(); x.translate(128, 130); x.rotate(-.5); const m = metal(-20, 20, ALTIN);
    cz(m, 12, () => x.arc(-62, 0, 30, 0, PI2)); cz(m, 14, () => { x.moveTo(-32, 0); x.lineTo(92, 0); }); dol(m, () => { x.rect(62, 0, 10, 30); x.rect(80, 0, 10, 22); }); cz("rgba(255,255,255,.5)", 2, () => { x.moveTo(-30, -4); x.lineTo(90, -4); }); x.restore(); };
  C.hancer = () => { golge(128, 90);
    x.save(); x.translate(128, 128); x.rotate(-.75);
    dol(metalY(-14, 14, GUMUS), () => { x.moveTo(-10, -12); x.lineTo(110, 0); x.lineTo(-10, 12); x.closePath(); }); cz("rgba(255,255,255,.6)", 1.5, () => { x.moveTo(-8, -2); x.lineTo(104, 0); });
    dol(metal(-20, -12, ALTIN), () => x.rect(-20, -26, 10, 52)); dol(pat("hali", "#4a2a1a", 1), () => x.rect(-72, -9, 52, 18)); for (let i = 0; i < 5; i++) dol("rgba(0,0,0,.35)", () => x.rect(-68 + i * 10, -9, 3, 18)); kure(-80, 0, 11, "#b3261e"); x.restore(); };
  C.kapan = () => { golge(128, 100);
    dol(metalY(150, 210, DEMIR), () => x.ellipse(128, 180, 100, 30, 0, 0, PI2)); dol("rgba(0,0,0,.45)", () => x.ellipse(128, 180, 70, 18, 0, 0, PI2)); cz(metalY(130, 200, "#8a9196"), 6, () => x.ellipse(128, 176, 92, 26, 0, 0, PI2));
    for (let i = 0; i < 12; i++) { const a = Math.PI + i / 11 * Math.PI, px = 128 + Math.cos(a) * 88, py = 170 + Math.sin(a) * 50; dol(metal(px - 6, px + 6, "#b8bec2"), () => { x.moveTo(px - 7, py + 18); x.lineTo(px, py - 14); x.lineTo(px + 7, py + 18); x.closePath(); }); }
    kure(128, 184, 12, "#7a8186"); };
  C.mucevher = () => { golge(128, 70);
    const kenarlar = [[128, 40], [196, 90], [128, 214], [60, 90]], ic = [[100, 90], [156, 90]];
    const yuz = (pts, c) => dol(c, () => { x.moveTo(...pts[0]); for (const p of pts.slice(1)) x.lineTo(...p); x.closePath(); });
    yuz([[128, 40], [196, 90], [156, 90]], "#7fd4f6"); yuz([[128, 40], [156, 90], [100, 90]], "#c6f0ff"); yuz([[128, 40], [100, 90], [60, 90]], "#5ab8e6");
    yuz([[60, 90], [100, 90], [128, 214]], "#2a7fb8"); yuz([[100, 90], [156, 90], [128, 214]], "#4aa6d8"); yuz([[156, 90], [196, 90], [128, 214]], "#1a5a8a");
    kenar(() => { x.moveTo(...kenarlar[0]); for (const p of kenarlar.slice(1)) x.lineTo(...p); x.closePath(); }, 2, .4);
    x.save(); x.globalCompositeOperation = "lighter"; const g = x.createRadialGradient(112, 70, 0, 112, 70, 30); g.addColorStop(0, "rgba(255,255,255,.9)"); g.addColorStop(1, "rgba(255,255,255,0)"); dol(g, () => x.arc(112, 70, 30, 0, PI2)); x.restore(); };
  C.altin = () => { golge(128, 90);
    const k = () => { x.moveTo(96, 80); x.bezierCurveTo(30, 110, 30, 214, 128, 216); x.bezierCurveTo(226, 214, 226, 110, 160, 80); x.closePath(); };
    dol(pat("hali", "#8a6a3a", 3), k); dol(yanIsik(40, 216, .3, .45), k); kenar(k);
    dol(pat("hali", "#7a5a2a", 3), () => { x.moveTo(96, 80); x.lineTo(84, 46); x.lineTo(172, 46); x.lineTo(160, 80); x.closePath(); }); cz("#c9a24a", 6, () => { x.moveTo(92, 82); x.lineTo(164, 82); });
    for (const [cx, cy] of [[64, 214], [196, 212], [182, 224], [80, 226]]) { dol(metalY(cy - 8, cy + 8, ALTIN), () => x.ellipse(cx, cy, 16, 7, 0, 0, PI2)); kenar(() => x.ellipse(cx, cy, 16, 7, 0, 0, PI2), 1.5, .5); }
    for (const [cx, cy] of [[118, 74], [140, 70], [130, 62]]) { dol(metalY(cy - 6, cy + 6, ALTIN), () => x.ellipse(cx, cy, 14, 5, 0, 0, PI2)); kenar(() => x.ellipse(cx, cy, 14, 5, 0, 0, PI2), 1.2, .5); } };
  C.mantar = () => { golge(128, 80);
    for (const [cx, by, s] of [[150, 220, 1], [80, 222, .6]]) { x.save(); x.translate(cx, by); x.scale(s, s);
      dol(metal(-18, 18, "#efe6d2"), () => { x.moveTo(-16, 0); x.lineTo(-12, -80); x.lineTo(12, -80); x.lineTo(16, 0); x.closePath(); });
      const sap = () => { x.moveTo(-74, -80); x.bezierCurveTo(-70, -170, 70, -170, 74, -80); x.closePath(); }; const g = x.createRadialGradient(-20, -140, 4, 0, -100, 90); g.addColorStop(0, "#ff6a5a"); g.addColorStop(.6, "#c0281e"); g.addColorStop(1, "#6a0f0a"); dol(g, sap); kenar(sap);
      for (const [px, py, r] of [[-30, -120, 9], [10, -136, 11], [40, -104, 8], [-50, -96, 6], [12, -100, 7]]) dol("#f6f0e2", () => x.ellipse(px, py, r, r * .7, 0, 0, PI2)); x.restore(); } };

  /* ---------------- Kale ---------------- */
  C.taht = () => { golge(128, 100); const k = "#7a1e2a";
    kutu(60, 20, 136, 150, 12, "tahta", "#5a2a14", .3); dol(pat("hali", k, 2.4), yRect(74, 40, 108, 120, 10)); dol(dikIsik(40, 160, .2, .35), yRect(74, 40, 108, 120, 10)); kenar(yRect(74, 40, 108, 120, 10));
    for (const tx of [66, 190]) kure(tx, 22, 10, ALTIN); kure(128, 14, 12, ALTIN);
    kutu(40, 150, 176, 30, 26, "tahta", "#5a2a14", .3); dol(pat("hali", k, 2.4), () => x.rect(56, 150, 144, 18));
    for (const ax of [36, 196]) kutu(ax, 110, 24, 70, 10, "tahta", "#6a341a", .3);
    for (const lx of [48, 196]) kutu(lx, 206, 14, 24, 0, "tahta", "#3a1a0a", .3);
    dol(metal(46, 210, ALTIN), () => x.rect(40, 176, 176, 6)); };
  C.silahlik = () => { golge(128, 100);
    kutu(26, 40, 204, 16, 10, "tahta", KOYU_AHSAP, .3); kutu(26, 196, 204, 20, 12, "tahta", KOYU_AHSAP, .3); for (const px of [30, 214]) kutu(px, 50, 12, 150, 0, "tahta", KOYU_AHSAP, .3);
    // kılıç, mızrak, balta
    dol(metalY(30, 200, GUMUS), () => { x.moveTo(76, 40); x.lineTo(84, 30); x.lineTo(92, 40); x.lineTo(90, 170); x.lineTo(78, 170); x.closePath(); }); dol(metal(60, 108, ALTIN), () => x.rect(62, 168, 44, 8)); dol("#4a2a1a", () => x.rect(80, 176, 8, 26));
    cz(metal(124, 134, "#7a5030"), 7, () => { x.moveTo(128, 30); x.lineTo(128, 204); }); dol(metalY(10, 50, GUMUS), () => { x.moveTo(128, 6); x.lineTo(140, 36); x.lineTo(128, 46); x.lineTo(116, 36); x.closePath(); });
    cz(metal(168, 176, "#7a5030"), 7, () => { x.moveTo(172, 46); x.lineTo(172, 204); }); dol(metalY(50, 100, GUMUS), () => { x.moveTo(172, 56); x.quadraticCurveTo(214, 50, 210, 96); x.quadraticCurveTo(196, 80, 172, 86); x.closePath(); }); };
  C.kalkan = () => { golge(128, 70);
    const k = () => { x.moveTo(128, 18); x.lineTo(214, 46); x.bezierCurveTo(214, 150, 170, 200, 128, 226); x.bezierCurveTo(86, 200, 42, 150, 42, 46); x.closePath(); };
    dol(pat("tahtaDikey", "#2b4a8a", .3), k); dol(x.createRadialGradient(100, 70, 10, 128, 110, 140), k); dol(yanIsik(42, 214, .4, .45), k);
    cz(metal(42, 214, GUMUS), 10, k); dol(metal(110, 146, ALTIN), () => { x.rect(118, 34, 20, 176); x.rect(62, 88, 132, 20); }); kure(128, 98, 18, "#c9a24a"); };
  C.sancak = () => { golge(128, 50);
    cz(metal(84, 94, "#6a4423"), 8, () => { x.moveTo(88, 226); x.lineTo(88, 14); }); kure(88, 12, 9, ALTIN);
    const b = () => { x.moveTo(92, 26); x.bezierCurveTo(140, 16, 180, 40, 224, 28); x.lineTo(214, 96); x.lineTo(224, 158); x.bezierCurveTo(180, 168, 140, 146, 92, 156); x.closePath(); };
    dol(pat("hali", "#a01e24", 2.5), b); const g = x.createLinearGradient(92, 0, 224, 0); for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, i % 2 ? "rgba(0,0,0,.25)" : "rgba(255,255,255,.12)"); dol(g, b); kenar(b);
    dol(ALTIN, () => { x.moveTo(150, 60); x.lineTo(160, 86); x.lineTo(188, 86); x.lineTo(166, 102); x.lineTo(174, 128); x.lineTo(150, 112); x.lineTo(126, 128); x.lineTo(134, 102); x.lineTo(112, 86); x.lineTo(140, 86); x.closePath(); }); };
  C.heykel = () => { golge(128, 70);
    kutu(70, 190, 116, 22, 12, "tas", "#8a867e", .25);
    const g = () => { x.moveTo(98, 196); x.lineTo(86, 70); x.bezierCurveTo(84, 20, 172, 20, 170, 70); x.lineTo(158, 196); x.closePath(); }; tasDoku(g, "#8d8a84", .5); dol(yanIsik(86, 170, .35, .5), g); kenar(g);
    dol("rgba(0,0,0,.45)", () => { x.rect(96, 84, 26, 10); x.rect(134, 84, 26, 10); }); dol("rgba(0,0,0,.25)", () => { x.moveTo(128, 90); x.lineTo(118, 140); x.lineTo(138, 140); x.closePath(); }); dol("rgba(0,0,0,.4)", () => x.rect(108, 156, 40, 6)); };
  C.cesme = () => { golge(128, 110);
    const h = () => x.ellipse(128, 176, 108, 30, 0, 0, PI2); silindir(128, 170, 108, 30, 36, pat("tas", "#9a958c", .25)); dol(pat("su", "#3a7f98", .4), () => x.ellipse(128, 170, 94, 24, 0, 0, PI2));
    silindir(128, 110, 14, 5, 64, pat("tas", "#a39d92", .25)); silindir(128, 104, 50, 13, 10, pat("tas", "#a39d92", .25)); dol(pat("su", "#4a8fa8", .3), () => x.ellipse(128, 104, 42, 10, 0, 0, PI2));
    for (const s of [-1, 1]) cz("rgba(200,235,250,.8)", 3, () => { x.moveTo(128, 70); x.quadraticCurveTo(128 + s * 40, 54, 128 + s * 62, 168); });
    cz("rgba(220,245,255,.9)", 4, () => { x.moveTo(128, 104); x.lineTo(128, 64); }); kure(128, 62, 6, "#dff3fb"); };
  C.can = () => { golge(128, 70);
    const g = () => { x.moveTo(100, 40); x.bezierCurveTo(70, 50, 74, 150, 40, 190); x.lineTo(216, 190); x.bezierCurveTo(182, 150, 186, 50, 156, 40); x.closePath(); };
    dol(metal(40, 216, "#c9932a"), g); kenar(g); dol(metalY(180, 204, "#b8842a"), () => x.ellipse(128, 190, 88, 14, 0, 0, PI2)); dol("rgba(0,0,0,.6)", () => x.ellipse(128, 192, 72, 9, 0, 0, PI2));
    kure(128, 206, 12, "#6a4a1a"); cz(metal(110, 146, "#c9932a"), 10, () => x.arc(128, 34, 16, Math.PI, 0)); for (const yy of [80, 150]) dol("rgba(0,0,0,.2)", () => x.rect(70, yy, 116, 4)); };
  C.amfora = () => { golge(128, 60);
    const g = () => { x.moveTo(110, 40); x.lineTo(104, 70); x.bezierCurveTo(40, 100, 50, 190, 116, 222); x.lineTo(140, 222); x.bezierCurveTo(206, 190, 216, 100, 152, 70); x.lineTo(146, 40); x.closePath(); };
    dol(pat("toprak", "#b5643a", .35), g); dol(yanIsik(50, 206, .3, .5), g); kenar(g);
    for (const s of [-1, 1]) cz(koyu("#b5643a", .2), 9, () => { x.moveTo(128 + s * 18, 50); x.quadraticCurveTo(128 + s * 64, 50, 128 + s * 46, 100); });
    dol("rgba(20,10,5,.75)", () => { x.rect(60, 120, 136, 8); x.rect(66, 150, 124, 5); }); dol(metalY(30, 46, "#c9784a"), () => x.ellipse(128, 40, 22, 6, 0, 0, PI2)); };
  C.at = () => { golge(128, 110);
    const k = "#6a3e22", f = pat("kaya", k, .4), govde = () => { x.ellipse(118, 128, 76, 40, 0, 0, PI2); };
    for (const [lx, ly] of [[62, 150], [86, 156], [150, 152], [172, 148]]) { dol(f, () => x.rect(lx, ly, 14, 70)); dol(yanIsik(lx, lx + 14, .2, .5), () => x.rect(lx, ly, 14, 70)); dol("#1a120c", () => x.rect(lx - 1, ly + 64, 16, 10)); }
    dol(f, govde); dol(x.createRadialGradient(96, 104, 10, 118, 128, 90), govde); dol(dikIsik(88, 168, .2, .45), govde);
    const boyun = () => { x.moveTo(170, 110); x.lineTo(200, 40); x.lineTo(236, 58); x.lineTo(230, 78); x.lineTo(210, 76); x.lineTo(190, 136); x.closePath(); }; dol(f, boyun); dol(yanIsik(170, 236, .3, .4), boyun);
    cz("#1a120c", 10, () => { x.moveTo(176, 104); x.lineTo(200, 46); }); cz("#1a120c", 12, () => { x.moveTo(44, 120); x.quadraticCurveTo(20, 150, 30, 196); }); kure(214, 56, 3.5, "#000", .9); dol(pat("hali", "#7a2230", 1.5), () => x.rect(94, 92, 52, 40)); };
  C.fener = () => { golge(128, 50);
    cz(metal(118, 138, DEMIR), 5, () => x.arc(128, 36, 18, Math.PI, 0)); dol(metalY(40, 70, DEMIR), () => { x.moveTo(90, 70); x.lineTo(128, 40); x.lineTo(166, 70); x.closePath(); });
    const cam = () => x.rect(94, 70, 68, 116); const g = x.createRadialGradient(128, 130, 4, 128, 130, 70); g.addColorStop(0, "#fff6c8"); g.addColorStop(.5, "#ffb84a"); g.addColorStop(1, "#c46a1a"); dol(g, cam);
    for (const px of [94, 126, 158]) dol(metal(px, px + 6, DEMIR), () => x.rect(px - 1, 70, 6, 116)); dol(metalY(180, 200, DEMIR), () => x.rect(86, 184, 84, 16)); kenar(cam);
    x.save(); x.globalCompositeOperation = "lighter"; const ig = x.createRadialGradient(128, 130, 0, 128, 130, 120); ig.addColorStop(0, "rgba(255,180,80,.45)"); ig.addColorStop(1, "rgba(255,150,40,0)"); dol(ig, () => x.arc(128, 130, 120, 0, PI2)); x.restore(); };
  C.yay = () => { golge(128, 80);
    cz(metal(40, 70, "#6a4423"), 12, () => { x.moveTo(70, 24); x.bezierCurveTo(210, 60, 210, 196, 70, 232); }); cz("#e9e0c8", 2, () => { x.moveTo(70, 24); x.lineTo(70, 232); });
    dol("#4a2a1a", () => x.rect(170, 112, 22, 34)); cz(metal(40, 230, "#9a7a4a"), 4, () => { x.moveTo(30, 128); x.lineTo(226, 128); }); dol(metalY(120, 136, GUMUS), () => { x.moveTo(226, 128); x.lineTo(206, 118); x.lineTo(206, 138); x.closePath(); });
    for (const d of [-1, 1]) dol("#c0392b", () => { x.moveTo(34, 128); x.lineTo(54, 128 + d * 12); x.lineTo(64, 128 + d * 12); x.lineTo(46, 128); x.closePath(); }); };
  C.balta = () => { golge(128, 70);
    x.save(); x.translate(128, 128); x.rotate(.35); cz(metal(-6, 6, "#7a5030"), 13, () => { x.moveTo(0, -100); x.lineTo(0, 110); }); dol("#3a2416", () => x.rect(-7, 70, 14, 40));
    const b = () => { x.moveTo(4, -96); x.bezierCurveTo(60, -110, 96, -80, 96, -30); x.bezierCurveTo(70, -48, 40, -44, 4, -44); x.closePath(); }; dol(metalY(-110, -30, GUMUS), b); kenar(b);
    cz("rgba(255,255,255,.7)", 2, () => { x.moveTo(94, -76); x.quadraticCurveTo(100, -50, 94, -32); }); x.restore(); };
  C.parsomen = () => { golge(128, 90);
    const p = () => x.rect(50, 60, 156, 126); dol(pat("kum", "#e6d3a6", .5), p); dol(dikIsik(60, 186, .2, .25), p);
    for (let i = 0; i < 7; i++) cz("rgba(60,40,20,.55)", 2, () => { x.moveTo(66, 82 + i * 14); x.lineTo(186 - (i % 3) * 18, 82 + i * 14); });
    for (const yy of [60, 186]) { silindir(128, yy - 8, 86, 0.01, 16, pat("kum", "#d9c08a", .5)); dol(metal(36, 50, "#6a4423"), () => x.ellipse(40, yy, 6, 10, 0, 0, PI2)); dol(metal(206, 220, "#6a4423"), () => x.ellipse(216, yy, 6, 10, 0, 0, PI2)); }
    kure(150, 186, 13, "#a01e24", .4); };
  C.kupa = () => { golge(128, 60);
    const g = () => { x.moveTo(70, 36); x.lineTo(186, 36); x.bezierCurveTo(186, 110, 160, 130, 140, 136); x.lineTo(140, 170); x.lineTo(116, 170); x.lineTo(116, 136); x.bezierCurveTo(96, 130, 70, 110, 70, 36); x.closePath(); };
    for (const s of [-1, 1]) cz(metal(30, 226, ALTIN), 9, () => { x.moveTo(128 + s * 56, 50); x.bezierCurveTo(128 + s * 100, 50, 128 + s * 96, 110, 128 + s * 36, 116); });
    dol(metal(70, 186, ALTIN), g); kenar(g); dol(metalY(30, 44, "#f0c95a"), () => x.ellipse(128, 36, 58, 10, 0, 0, PI2)); dol("rgba(80,50,10,.6)", () => x.ellipse(128, 37, 50, 7, 0, 0, PI2));
    kutu(88, 170, 80, 40, 12, "tahta", "#3a2420", .25); dol(metal(100, 156, ALTIN), () => x.rect(100, 192, 56, 10)); };
  C.sarap = () => { golge(128, 60);
    const s = () => { x.moveTo(84, 220); x.lineTo(84, 110); x.bezierCurveTo(84, 80, 110, 74, 112, 56); x.lineTo(112, 18); x.lineTo(132, 18); x.lineTo(132, 56); x.bezierCurveTo(134, 74, 160, 80, 160, 110); x.lineTo(160, 220); x.closePath(); };
    const g = x.createLinearGradient(84, 0, 160, 0); g.addColorStop(0, "#1a3a1a"); g.addColorStop(.3, "#3a6a3a"); g.addColorStop(1, "#0a1a0a"); dol(g, s); kenar(s);
    dol(pat("kum", "#efe2c2", .3), () => x.rect(92, 136, 60, 50)); dol("#7a1424", () => x.rect(100, 150, 44, 6)); dol("#7a1424", () => x.rect(112, 18, 20, 18));
    dol("rgba(255,255,255,.35)", () => x.rect(92, 96, 5, 110));
    const k = () => { x.moveTo(178, 150); x.quadraticCurveTo(176, 186, 196, 190); x.quadraticCurveTo(216, 186, 214, 150); x.closePath(); }; dol("rgba(220,235,240,.55)", k); dol("#7a1424", () => { x.moveTo(180, 166); x.quadraticCurveTo(184, 186, 196, 188); x.quadraticCurveTo(208, 186, 212, 166); x.closePath(); }); kenar(k, 1.5, .4);
    cz("rgba(220,235,240,.8)", 3, () => { x.moveTo(196, 190); x.lineTo(196, 222); }); dol("rgba(220,235,240,.8)", () => x.ellipse(196, 224, 14, 4, 0, 0, PI2)); };
  C.bira = () => { golge(128, 70);
    const b = () => x.rect(70, 70, 100, 150); dol(pat("tahtaDikey", "#8a5a32", .25), b); dol(yanIsik(70, 170, .35, .5), b); kenar(b);
    for (const yy of [92, 196]) dol(metal(68, 172, DEMIR), () => x.rect(68, yy, 104, 10));
    cz(metal(170, 214, "#6a4423"), 13, () => { x.moveTo(170, 100); x.bezierCurveTo(222, 100, 222, 190, 170, 186); });
    for (const [cx, cy, r] of [[86, 66, 22], [116, 56, 26], [148, 62, 24], [166, 74, 14], [100, 76, 16]]) kure(cx, cy, r, "#fbf6ea", .4); dol("rgba(240,200,90,.8)", () => x.rect(80, 210, 0, 0)); };
  C.ekmek = () => { golge(128, 100);
    const e = () => x.ellipse(128, 150, 104, 56, -.06, 0, PI2); const g = x.createRadialGradient(110, 120, 10, 128, 150, 110); g.addColorStop(0, "#e9b36a"); g.addColorStop(.6, "#b8742e"); g.addColorStop(1, "#6a3a12"); dol(g, e);
    dol(pat("kum", "#c98a42", .4), e); dol(x.createRadialGradient(110, 120, 10, 128, 150, 110), e); x.save(); x.globalAlpha = .6; dol(g, e); x.restore(); kenar(e, 2, .4);
    for (let i = 0; i < 4; i++) { cz("rgba(80,40,10,.6)", 6, () => { x.moveTo(60 + i * 40, 130); x.quadraticCurveTo(80 + i * 40, 150, 76 + i * 40, 178); }); cz("rgba(250,220,170,.8)", 3, () => { x.moveTo(62 + i * 40, 130); x.quadraticCurveTo(82 + i * 40, 150, 78 + i * 40, 176); }); } };
  C.et = () => { golge(128, 90);
    cz("#e9e0c8", 18, () => { x.moveTo(170, 90); x.lineTo(222, 40); }); kure(222, 30, 13, "#ece4cf", .5); kure(234, 44, 12, "#ece4cf", .5);
    const e = () => { x.moveTo(176, 84); x.bezierCurveTo(200, 140, 160, 220, 90, 214); x.bezierCurveTo(20, 206, 30, 120, 80, 90); x.bezierCurveTo(110, 70, 150, 64, 176, 84); x.closePath(); };
    const g = x.createRadialGradient(100, 120, 10, 110, 150, 110); g.addColorStop(0, "#d9683a"); g.addColorStop(.5, "#9a3a1a"); g.addColorStop(1, "#4a1a0a"); dol(g, e); dol(pat("kaya", "#8a3a1a", .4), e); x.save(); x.globalAlpha = .55; dol(g, e); x.restore(); kenar(e);
    dol("rgba(255,230,200,.35)", () => x.ellipse(92, 120, 26, 12, -.5, 0, PI2)); };

  /* ---------------- Doğa ---------------- */
  C.cam = () => { golge(128, 70); resim(D.sprite("camYan", "#2f5a3a", 0), 48, 6, 160, 288 * .79); };
  C.agac = () => { golge(128, 80); resim(D.sprite("agacYan", "#4d7a34", 0), 40, 0, 176, 236); };
  C.palmiye = () => { golge(128, 70);
    cz(pat("kabuk", "#8a6a42", .3), 16, () => { x.moveTo(110, 230); x.quadraticCurveTo(100, 140, 140, 70); }); for (let i = 0; i < 9; i++) cz("rgba(60,40,20,.5)", 2, () => { const t = i / 9, px = 110 + (140 - 110) * t * t - 10 * Math.sin(t * 3), py = 230 - 160 * t; x.moveTo(px - 8, py); x.lineTo(px + 8, py - 4); });
    for (let i = 0; i < 7; i++) { const a = -Math.PI + i * Math.PI / 6 + .1, l = 90; x.save(); x.translate(140, 70); x.rotate(a);
      const g = x.createLinearGradient(0, 0, l, 0); g.addColorStop(0, "#2f5a1e"); g.addColorStop(1, "#6aa03a"); dol(g, () => { x.moveTo(0, 0); x.quadraticCurveTo(l * .5, -24, l, 10 + (i % 2) * 8); x.quadraticCurveTo(l * .5, 8, 0, 0); });
      for (let k = 1; k < 9; k++) cz("rgba(20,40,10,.45)", 1.5, () => { x.moveTo(k * l / 10, -k * .8); x.lineTo(k * l / 10 + 6, 10); }); x.restore(); }
    for (const [cx, cy] of [[134, 82], [148, 80], [140, 92]]) kure(cx, cy, 9, "#6a4a22"); };
  C.kaktus = () => { golge(128, 60); const g = (x0, x1) => { const q = x.createLinearGradient(x0, 0, x1, 0); q.addColorStop(0, "#5aa04a"); q.addColorStop(.5, "#3a7a32"); q.addColorStop(1, "#1f4a1e"); return q; };
    const kol = (x0, y0, x1, y1, w) => { cz(g(x0 - w, x0 + w), w * 2, () => { x.moveTo(x0, y0); x.lineTo(x1, y1); }); };
    kol(128, 220, 128, 50, 26); kol(86, 150, 86, 90, 16); kol(170, 130, 170, 80, 16); cz(g(80, 130), 32, () => { x.moveTo(86, 150); x.quadraticCurveTo(90, 170, 110, 170); }); cz(g(130, 176), 32, () => { x.moveTo(170, 130); x.quadraticCurveTo(166, 150, 146, 150); });
    for (let i = 0; i < 40; i++) dol("rgba(250,240,200,.85)", () => x.arc(110 + (i * 37) % 36, 60 + (i * 53) % 160, 1.2, 0, PI2)); kure(128, 34, 10, "#e85a8a"); };
  C.kutuk = () => { golge(128, 100); silindir(128, 120, 92, 26, 90, pat("kabuk", "#5a4130", .35), "#c9a06a");
    for (let r = 8; r < 84; r += 10) cz("rgba(120,80,40,.5)", 1.5, () => x.ellipse(128, 120, r, r * .28, 0, 0, PI2)); dol("rgba(255,240,200,.15)", () => x.ellipse(128, 120, 92, 26, 0, 0, PI2)); kenar(() => x.ellipse(128, 120, 92, 26, 0, 0, PI2), 2.5, .6);
    resim(D.sprite("agac", "#5a7a34", 2), 170, 180, 50, 50); };
  C.cadir = () => { golge(128, 115);
    const sol = () => { x.moveTo(128, 30); x.lineTo(20, 210); x.lineTo(128, 210); x.closePath(); }, sag = () => { x.moveTo(128, 30); x.lineTo(236, 210); x.lineTo(128, 210); x.closePath(); };
    dol(pat("hali", "#c9b07a", 3), sol); dol("rgba(255,255,255,.1)", sol); dol(pat("hali", "#a89060", 3), sag); dol("rgba(0,0,0,.25)", sag);
    dol("#1a120a", () => { x.moveTo(128, 70); x.lineTo(96, 210); x.lineTo(160, 210); x.closePath(); }); dol(pat("hali", "#b8a06a", 3), () => { x.moveTo(128, 70); x.lineTo(96, 210); x.lineTo(110, 210); x.closePath(); });
    kenar(sol); kenar(sag); cz("#5a3a20", 5, () => { x.moveTo(128, 30); x.lineTo(128, 12); }); dol("#a01e24", () => { x.moveTo(128, 12); x.lineTo(152, 18); x.lineTo(128, 26); x.closePath(); });
    for (const [a, b] of [[20, 210], [236, 210]]) cz("#c9b38a", 2, () => { x.moveTo(128, 30); x.lineTo(a + (a < 128 ? -12 : 12), b + 14); }); };
  C.dag = () => { golge(128, 120, 236, .3);
    const d = () => { x.moveTo(4, 226); x.lineTo(96, 40); x.lineTo(130, 90); x.lineTo(160, 60); x.lineTo(252, 226); x.closePath(); }; dol(pat("kaya", "#6a6560", .5), d);
    const sag = () => { x.moveTo(96, 40); x.lineTo(118, 226); x.lineTo(252, 226); x.lineTo(160, 60); x.lineTo(130, 90); x.closePath(); }; dol("rgba(0,0,0,.3)", sag);
    dol(pat("kar", "#f4f8fa", .5), () => { x.moveTo(96, 40); x.lineTo(74, 84); x.lineTo(92, 78); x.lineTo(104, 94); x.lineTo(118, 74); x.lineTo(130, 90); x.closePath(); }); dol(pat("kar", "#e4ecf0", .5), () => { x.moveTo(160, 60); x.lineTo(146, 82); x.lineTo(166, 86); x.lineTo(176, 92); x.closePath(); }); kenar(d, 2, .5); };
  C.yanardag = () => { golge(128, 120, 236, .3);
    const d = () => { x.moveTo(4, 226); x.lineTo(98, 66); x.lineTo(158, 66); x.lineTo(252, 226); x.closePath(); }; dol(pat("kaya", "#4a403a", .5), d); dol(yanIsik(4, 252, .25, .4), d);
    for (const [a, b] of [[118, 66], [140, 66]]) cz("#ff6a1a", 8, () => { x.moveTo(a, b); x.quadraticCurveTo(a + (a < 128 ? -20 : 24), 140, a + (a < 128 ? -40 : 50), 222); });
    dol(pat("lav", "#ff6a1a", .4), () => x.ellipse(128, 66, 30, 8, 0, 0, PI2)); kenar(d, 2, .5);
    for (const [cx, cy, r] of [[120, 46, 20], [146, 30, 24], [112, 18, 16], [160, 12, 15]]) { dol(`rgba(70,60,60,.85)`, () => x.arc(cx, cy, r, 0, PI2)); dol("rgba(255,255,255,.08)", () => x.arc(cx - 5, cy - 5, r * .6, 0, PI2)); }
    x.save(); x.globalCompositeOperation = "lighter"; const ig = x.createRadialGradient(128, 66, 0, 128, 66, 80); ig.addColorStop(0, "rgba(255,120,30,.6)"); ig.addColorStop(1, "rgba(255,80,0,0)"); dol(ig, () => x.arc(128, 66, 80, 0, PI2)); x.restore(); };
  C.kamp = () => { golge(128, 90);
    for (let i = 0; i < 9; i++) { const a = Math.PI * .05 + i / 8 * Math.PI * .9, px = 128 + Math.cos(a) * 86, py = 196 + Math.sin(a) * 22; resim(D.sprite("kaya", "#7a756e", i % 4), px - 22, py - 20, 44, 40); }
    for (let i = 0; i < 4; i++) { x.save(); x.translate(128, 196); x.rotate(-.5 + i * .35); kutu(-56, -8, 112, 12, 6, "kabuk", "#5a3a22", .3, 90); x.restore(); }
    alev(128, 196, 140, 44); };
  C.cali = () => { golge(128, 100); resim(D.sprite("agac", "#4a7030", 0), 18, 60, 120, 150); resim(D.sprite("agac", "#557a34", 1), 100, 50, 140, 170); resim(D.sprite("agac", "#40662c", 2), 60, 96, 130, 136); };
  C.cicek = () => { golge(128, 70);
    for (const [cx, top, renk] of [[86, 80, "#e8506a"], [128, 52, "#f2c230"], [172, 86, "#9a5ae0"], [110, 110, "#ffffff"], [154, 120, "#e8506a"]]) {
      cz("#3a6a2a", 5, () => { x.moveTo(128 + (cx - 128) * .3, 226); x.quadraticCurveTo(cx, 180, cx, top); }); dol("#4a8a34", () => x.ellipse(cx - 14, top + 50, 14, 6, -.6, 0, PI2));
      for (let i = 0; i < 6; i++) { const a = i / 6 * PI2; dol(renk, () => x.ellipse(cx + Math.cos(a) * 12, top + Math.sin(a) * 12, 11, 7, a, 0, PI2)); } dol(yanIsik(cx - 22, cx + 22, .3, .3), () => x.arc(cx, top, 22, 0, PI2)); kure(cx, top, 7, "#e0a020", .5); } };
  C.yaprak = () => { golge(128, 100, 236, .3);
    for (let i = 0; i < 9; i++) { x.save(); x.translate(50 + (i * 61) % 160, 120 + (i * 37) % 100); x.rotate(i * 1.7); const c = ["#c9682a", "#d9a030", "#a0402a", "#8a6a2a"][i % 4];
      const y = () => { x.moveTo(-34, 0); x.quadraticCurveTo(0, -24, 34, 0); x.quadraticCurveTo(0, 24, -34, 0); }; dol(c, y); dol(yanIsik(-34, 34, .3, .3), y); cz("rgba(60,30,10,.6)", 1.5, () => { x.moveTo(-34, 0); x.lineTo(34, 0); }); x.restore(); } };
  C.dalga = () => { golge(128, 110, 236, .25);
    const d = () => { x.moveTo(10, 220); x.bezierCurveTo(10, 120, 90, 50, 170, 60); x.bezierCurveTo(230, 66, 240, 120, 200, 130); x.bezierCurveTo(180, 100, 150, 110, 160, 140); x.bezierCurveTo(180, 180, 230, 190, 246, 220); x.closePath(); };
    dol(pat("su", "#2a6a8a", .5), d); dol(yanIsik(10, 246, .3, .4), d); dol(pat("kar", "#f4fbff", .4), () => { x.moveTo(170, 60); x.bezierCurveTo(230, 66, 240, 120, 200, 130); x.bezierCurveTo(196, 110, 186, 100, 170, 100); x.bezierCurveTo(200, 96, 210, 72, 170, 60); }); kenar(d, 2, .3); };

  /* ---------------- Büyü ---------------- */
  C.kure = () => { golge(128, 60);
    kutu(76, 180, 104, 34, 12, "tahta", "#3a1a2a", .25); dol(metal(76, 180, ALTIN), () => x.rect(76, 188, 104, 6));
    const g = x.createRadialGradient(110, 90, 6, 128, 112, 76); g.addColorStop(0, "#f0d8ff"); g.addColorStop(.4, "#8a5ad8"); g.addColorStop(1, "#2a0a4a"); dol(g, () => x.arc(128, 112, 74, 0, PI2));
    x.save(); x.globalCompositeOperation = "lighter"; for (const [a, r] of [[0, 40], [2, 30], [4, 24]]) cz(`rgba(200,160,255,.35)`, 4, () => x.arc(128, 112, r, a, a + 2.4)); x.restore();
    const h = x.createRadialGradient(100, 80, 0, 100, 80, 30); h.addColorStop(0, "rgba(255,255,255,.85)"); h.addColorStop(1, "rgba(255,255,255,0)"); dol(h, () => x.arc(100, 80, 30, 0, PI2)); kenar(() => x.arc(128, 112, 74, 0, PI2), 2, .35); };
  C.imbik = () => { golge(128, 90);
    const g = () => { x.moveTo(96, 60); x.lineTo(96, 110); x.bezierCurveTo(40, 130, 46, 214, 116, 216); x.lineTo(140, 216); x.bezierCurveTo(210, 214, 216, 130, 160, 110); x.lineTo(160, 60); x.closePath(); };
    dol("rgba(200,230,240,.35)", g); dol("#3aa86a", () => { x.moveTo(56, 160); x.bezierCurveTo(50, 210, 116, 216, 128, 216); x.bezierCurveTo(140, 216, 206, 210, 200, 160); x.closePath(); }); dol(yanIsik(46, 210, .5, .3), g); kenar(g, 2, .35);
    cz("rgba(200,230,240,.8)", 8, () => { x.moveTo(160, 70); x.quadraticCurveTo(220, 40, 236, 120); }); dol("#6a4423", () => x.rect(92, 44, 72, 18));
    for (const [cx, cy, r] of [[110, 176, 6], [140, 186, 4], [126, 150, 5]]) dol("rgba(230,255,240,.7)", () => x.arc(cx, cy, r, 0, PI2)); };
  C.iksir = () => { golge(128, 70);
    const g = () => { x.moveTo(112, 70); x.lineTo(112, 104); x.bezierCurveTo(56, 120, 56, 220, 128, 222); x.bezierCurveTo(200, 220, 200, 120, 144, 104); x.lineTo(144, 70); x.closePath(); };
    dol("rgba(210,230,240,.35)", g); const s = x.createRadialGradient(110, 160, 4, 128, 170, 70); s.addColorStop(0, "#ff7aa0"); s.addColorStop(1, "#8a0a3a"); dol(s, () => { x.moveTo(72, 150); x.bezierCurveTo(66, 216, 120, 220, 128, 220); x.bezierCurveTo(136, 220, 190, 216, 184, 150); x.closePath(); });
    dol(yanIsik(60, 196, .55, .3), g); kenar(g, 2, .4); dol(pat("tahta", "#a07a4a", .2), () => x.rect(106, 48, 44, 26)); kenar(() => x.rect(106, 48, 44, 26), 2, .5);
    x.save(); x.globalCompositeOperation = "lighter"; const ig = x.createRadialGradient(128, 180, 0, 128, 180, 90); ig.addColorStop(0, "rgba(255,80,140,.35)"); ig.addColorStop(1, "rgba(255,80,140,0)"); dol(ig, () => x.arc(128, 180, 90, 0, PI2)); x.restore(); };
  C.asa = () => { golge(128, 50);
    cz(pat("kabuk", "#6a4a2a", .3), 12, () => { x.moveTo(100, 232); x.quadraticCurveTo(120, 140, 128, 70); }); cz("rgba(0,0,0,.25)", 4, () => { x.moveTo(106, 232); x.quadraticCurveTo(126, 140, 134, 70); });
    cz("#5a3a1a", 7, () => { x.moveTo(128, 76); x.quadraticCurveTo(100, 50, 112, 28); x.moveTo(128, 76); x.quadraticCurveTo(160, 50, 146, 26); });
    x.save(); x.globalCompositeOperation = "lighter"; const ig = x.createRadialGradient(128, 46, 0, 128, 46, 70); ig.addColorStop(0, "rgba(120,200,255,.7)"); ig.addColorStop(1, "rgba(80,160,255,0)"); dol(ig, () => x.arc(128, 46, 70, 0, PI2)); x.restore(); kure(128, 46, 16, "#5ac8ff", .9); };
  C.buyukitabi = () => { golge(128, 100);
    kutu(30, 120, 196, 26, 40, "hali", "#4a1a2a", 2.4); dol("#efe4c8", () => x.rect(36, 160, 186, 8));
    dol(pat("hali", "#5a2234", 2.4), () => { x.moveTo(40, 120); x.lineTo(216, 120); x.lineTo(226, 160); x.lineTo(30, 160); x.closePath(); }); dol("rgba(255,255,255,.08)", () => { x.moveTo(40, 120); x.lineTo(216, 120); x.lineTo(226, 160); x.lineTo(30, 160); x.closePath(); });
    for (const [cx, cy] of [[48, 128], [208, 128]]) dol(metal(cx - 8, cx + 8, ALTIN), () => x.rect(cx - 8, cy - 4, 16, 12));
    cz(ALTIN, 3, () => { x.moveTo(128, 124); x.lineTo(140, 140); x.lineTo(128, 156); x.lineTo(116, 140); x.closePath(); }); kure(128, 140, 6, "#5ac8ff", .9); };
  C.tespih = () => { golge(128, 90, 236, .3);
    for (let i = 0; i < 33; i++) { const a = i / 33 * PI2, cx = 128 + Math.cos(a) * 80, cy = 120 + Math.sin(a) * 70; kure(cx, cy, 9, "#7a2a1a", .6); }
    cz("#c9a24a", 4, () => { x.moveTo(128, 190); x.lineTo(128, 226); }); kure(128, 196, 12, "#7a2a1a", .6); dol("#c9a24a", () => { x.moveTo(118, 226); x.lineTo(138, 226); x.lineTo(128, 246); x.closePath(); }); };
  C.nazar = () => { golge(128, 80, 236, .3); kure(128, 120, 96, "#1a4ab8", .5); dol("#f6f4ee", () => x.arc(128, 120, 62, 0, PI2)); kure(128, 120, 40, "#5ab8f0", .3); kure(128, 120, 20, "#0a0a14", .6); dol("rgba(255,255,255,.4)", () => x.ellipse(96, 72, 30, 14, -.6, 0, PI2)); };
  C.yuzuk = () => { golge(128, 70);
    cz(metal(48, 208, ALTIN), 18, () => x.ellipse(128, 150, 70, 46, 0, 0, PI2)); cz("rgba(255,255,255,.55)", 3, () => x.ellipse(128, 146, 62, 38, 0, Math.PI * 1.05, Math.PI * 1.6));
    dol(metal(104, 152, ALTIN), () => { x.moveTo(100, 108); x.lineTo(156, 108); x.lineTo(146, 92); x.lineTo(110, 92); x.closePath(); });
    const g = [[128, 50], [156, 80], [128, 106], [100, 80]]; dol("#c01a3a", () => { x.moveTo(...g[0]); for (const p of g.slice(1)) x.lineTo(...p); x.closePath(); }); dol("#ff6a8a", () => { x.moveTo(128, 50); x.lineTo(156, 80); x.lineTo(128, 80); x.closePath(); }); dol("#7a0a20", () => { x.moveTo(100, 80); x.lineTo(128, 106); x.lineTo(128, 80); x.closePath(); }); };

  const ADLAR = Object.keys(C);
  window.ZM_ESYA_CIZ = function (ad) {
    const c = document.createElement("canvas"); c.width = c.height = S; x = c.getContext("2d");
    if (!C[ad]) throw new Error("eşya yok: " + ad); C[ad](); return c;
  };
  window.ZM_ESYA_LISTE = ADLAR;
})();
