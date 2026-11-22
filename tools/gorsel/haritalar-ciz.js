/* Hazır RPG haritalarını gerçekçi dokularla (web/ext/doku.js) tuvale çizer. Tarayıcıda çalışır;
   tools/gorsel/haritalar.js bu dosyayı Chromium'da açar ve her haritayı web/gorsel/harita-<id>.webp olarak kaydeder.
   Haritalar 1400×1000 piksel, 28×20 kare (kare 50 piksel). Her şey bu kodla üretilir; dışarıdan resim yoktur. */
(function () {
  "use strict";
  const D = window.ZMDoku, W = 1400, H = 1000, PI2 = Math.PI * 2;
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const r1 = (R, a, b) => a + R() * (b - a);
  function tv(w = W, h = H) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  function desen(ctx, ad, renk, olcek = .4, aci = 0) {
    const p = ctx.createPattern(D.doku(ad, renk, 256), "repeat"); p.setTransform(new DOMMatrix().rotate(aci).scale(olcek)); return p;
  }
  function leke(R, cx, cy, r, n = 10, sapma = .35, ry) {
    const p = [], k = (ry || r) / r;
    for (let i = 0; i < n; i++) { const a = i / n * PI2, rr = r * (1 - sapma / 2 + R() * sapma); p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * k]); }
    const path = new Path2D(); path.moveTo((p[0][0] + p[n - 1][0]) / 2, (p[0][1] + p[n - 1][1]) / 2);
    for (let i = 0; i < n; i++) { const a = p[i], b = p[(i + 1) % n]; path.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    path.closePath(); return path;
  }
  const rect = (x, y, w, h) => { const p = new Path2D(); p.rect(x, y, w, h); return p; };
  const daire = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, PI2); return p; };
  const yol = (pts) => { const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; p.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); } p.lineTo(...pts[pts.length - 1]); return p; };
  function doldur(ctx, path, ad, renk, olcek, aci) { ctx.fillStyle = desen(ctx, ad, renk, olcek, aci); ctx.fill(path); }
  // Yumuşak kenarlı doku: maskeyi beyazla çiz, bulanıklaştır, dokuyu maskenin içine dök.
  function yumusak(ctx, ciz, ad, renk, olcek, blur = 8, alfa = 1) {
    const m = tv(), x = m.getContext("2d"); x.filter = `blur(${blur}px)`; x.fillStyle = x.strokeStyle = "#fff"; x.lineCap = x.lineJoin = "round"; ciz(x);
    x.filter = "none"; x.globalCompositeOperation = "source-in"; x.fillStyle = desen(x, ad, renk, olcek); x.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = alfa; ctx.drawImage(m, 0, 0); ctx.restore();
  }
  function golgeli(ctx, fn, o = {}) { ctx.save(); ctx.shadowColor = `rgba(0,0,0,${o.alfa ?? .55})`; ctx.shadowBlur = o.blur ?? 12; ctx.shadowOffsetX = o.dx ?? 9; ctx.shadowOffsetY = o.dy ?? 12; fn(); ctx.restore(); }
  function icGolge(ctx, path, g = 30, alfa = .6) { ctx.save(); ctx.clip(path); ctx.filter = `blur(${g / 2}px)`; ctx.lineWidth = g; ctx.strokeStyle = `rgba(0,0,0,${alfa})`; ctx.stroke(path); ctx.restore(); }
  function makro(ctx, R, n = 40, alfa = .2, rmin = 80, rmax = 260) {
    ctx.save(); ctx.globalCompositeOperation = "soft-light";
    for (let i = 0; i < n; i++) { const x = r1(R, 0, W), y = r1(R, 0, H), r = r1(R, rmin, rmax), c = R() < .5 ? "0,0,0" : "255,255,255", g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${c},${alfa * 2})`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
    ctx.restore();
  }
  function isik(ctx, x, y, r, renk = "255,180,100", a = .5, mod = "lighter") {
    ctx.save(); ctx.globalCompositeOperation = mod; const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${renk},${a})`); g.addColorStop(.4, `rgba(${renk},${a * .45})`); g.addColorStop(1, `rgba(${renk},0)`); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
  }
  function vinyet(ctx, a = .45) { const g = ctx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, W * .72); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  // Saydam görseli gölgesiyle çizer (gölge: siyah siluet, bulanık, sağ alta kaymış).
  function resim(ctx, img, x, y, w, h, aci = 0, golge = .45, kay = .14) {
    if (golge) { ctx.save(); ctx.globalAlpha = golge; ctx.filter = `blur(${Math.max(2, w * .05)}px) brightness(0)`; ctx.translate(x + w * kay, y + h * kay * 1.3); ctx.rotate(aci); ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore(); }
    ctx.save(); ctx.translate(x, y); ctx.rotate(aci); ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
  }
  const sprite = (ctx, ad, renk, cesit, x, y, boy, aci = 0, golge = .45) => resim(ctx, D.sprite(ad, renk, cesit), x, y, boy, boy, aci, golge);
  // Kalın duvar: taş dokulu çizgi, iki yanında gölge.
  function duvar(ctx, path, kal = 26, renk = "#77736b", olcek = .3) {
    golgeli(ctx, () => { ctx.lineWidth = kal; ctx.lineCap = "square"; ctx.lineJoin = "miter"; ctx.strokeStyle = desen(ctx, "tas", renk, olcek); ctx.stroke(path); }, { blur: 14, dx: 6, dy: 9, alfa: .6 });
  }
  // Kırma çatı (üstten): kiremit dokusu ve dört yüzeye göre ışık.
  function cati(ctx, x, y, w, h, renk = "#9c4a2e", ad = "kiremit") {
    golgeli(ctx, () => { ctx.fillStyle = desen(ctx, ad, renk, .35); ctx.fillRect(x, y, w, h); }, { blur: 16, dx: 14, dy: 18, alfa: .6 });
    const m = Math.min(w, h) / 2, cx1 = x + m, cx2 = x + w - m, cy = y + h / 2, yuz = (pts, c) => { ctx.beginPath(); ctx.moveTo(...pts[0]); for (const p of pts.slice(1)) ctx.lineTo(...p); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); };
    if (w >= h) { yuz([[x, y], [x + w, y], [cx2, cy], [cx1, cy]], "rgba(255,240,220,.12)"); yuz([[x, y + h], [x + w, y + h], [cx2, cy], [cx1, cy]], "rgba(0,0,0,.28)"); yuz([[x, y], [cx1, cy], [x, y + h]], "rgba(0,0,0,.05)"); yuz([[x + w, y], [cx2, cy], [x + w, y + h]], "rgba(0,0,0,.18)"); }
    else { const cy1 = y + w / 2, cy2 = y + h - w / 2, cx = x + w / 2; yuz([[x, y], [x + w, y], [cx, cy1]], "rgba(255,240,220,.12)"); yuz([[x, y + h], [x + w, y + h], [cx, cy2]], "rgba(0,0,0,.28)"); yuz([[x, y], [cx, cy1], [cx, cy2], [x, y + h]], "rgba(0,0,0,.05)"); yuz([[x + w, y], [cx, cy1], [cx, cy2], [x + w, y + h]], "rgba(0,0,0,.18)"); }
    ctx.strokeStyle = "rgba(30,15,10,.55)"; ctx.lineWidth = 3; ctx.beginPath();
    if (w >= h) { ctx.moveTo(x, y); ctx.lineTo(cx1, cy); ctx.lineTo(x, y + h); ctx.moveTo(x + w, y); ctx.lineTo(cx2, cy); ctx.lineTo(x + w, y + h); ctx.moveTo(cx1, cy); ctx.lineTo(cx2, cy); }
    else { const cy1 = y + w / 2, cy2 = y + h - w / 2, cx = x + w / 2; ctx.moveTo(x, y); ctx.lineTo(cx, cy1); ctx.lineTo(x + w, y); ctx.moveTo(x, y + h); ctx.lineTo(cx, cy2); ctx.lineTo(x + w, y + h); ctx.moveTo(cx, cy1); ctx.lineTo(cx, cy2); }
    ctx.stroke(); ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  }
  // Ahşap nesne (masa, tezgâh, sandık): dokulu, kenarı koyu, gölgeli.
  function ahsap(ctx, path, renk = "#8a5a32", olcek = .3, aci = 0) {
    golgeli(ctx, () => { ctx.fillStyle = desen(ctx, "tahta", renk, olcek, aci); ctx.fill(path); }, { blur: 10, dx: 7, dy: 10, alfa: .55 });
    ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = "rgba(25,14,6,.7)"; ctx.stroke(path); ctx.clip(path); ctx.lineWidth = 6; ctx.strokeStyle = "rgba(255,225,180,.12)"; ctx.translate(2, 2); ctx.stroke(path); ctx.restore();
  }
  function hali(ctx, x, y, w, h, renk) { golgeli(ctx, () => ctx.drawImage(D.doku("hali", renk, 256), x, y, w, h), { blur: 4, dx: 2, dy: 3, alfa: .4 }); }
  function fici(ctx, x, y, r) {
    golgeli(ctx, () => { ctx.fillStyle = desen(ctx, "tahta", "#7a4e2a", .25, 90); ctx.beginPath(); ctx.arc(x, y, r, 0, PI2); ctx.fill(); }, { blur: 8, dx: 5, dy: 7 });
    ctx.lineWidth = 3.5; ctx.strokeStyle = "#2b2622"; for (const k of [1, .72]) { ctx.beginPath(); ctx.arc(x, y, r * k - 2, 0, PI2); ctx.stroke(); }
    const g = ctx.createRadialGradient(x - r * .3, y - r * .3, 1, x, y, r); g.addColorStop(0, "rgba(255,230,190,.18)"); g.addColorStop(1, "rgba(0,0,0,.3)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, PI2); ctx.fill();
  }
  function sandalye(ctx, x, y, a, renk = "#6b4423") { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ahsap(ctx, rect(-17, -17, 34, 34), renk, .18); ahsap(ctx, rect(-17, -21, 34, 8), D.karis(renk, "#000", .25), .18); ctx.restore(); }
  function ates(ctx, x, y, r) {
    for (let i = 0; i < 9; i++) { const a = i / 9 * PI2; sprite(ctx, "kaya", "#6f6a64", i % 4, x + Math.cos(a) * r * 1.25, y + Math.sin(a) * r * 1.25, r * .7, a, .4); }
    ctx.save(); ctx.fillStyle = "#1c1410"; ctx.beginPath(); ctx.arc(x, y, r, 0, PI2); ctx.fill();
    for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(x, y); ctx.rotate(i * 1.3); ctx.fillStyle = "#3a2416"; ctx.fillRect(-r * .8, -3, r * 1.6, 6); ctx.restore(); }
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, "rgba(255,240,170,1)"); g.addColorStop(.35, "rgba(255,150,40,.95)"); g.addColorStop(1, "rgba(160,30,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, PI2); ctx.fill(); ctx.restore();
    isik(ctx, x, y, r * 7, "255,150,60", .45);
  }
  function mesale(ctx, x, y) { ctx.fillStyle = "#3a2a1a"; ctx.fillRect(x - 3, y - 3, 6, 6); const g = ctx.createRadialGradient(x, y, 0, x, y, 9); g.addColorStop(0, "#fff3c0"); g.addColorStop(.5, "#ff9a30"); g.addColorStop(1, "rgba(255,90,0,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 9, 0, PI2); ctx.fill(); isik(ctx, x, y, 170, "255,160,80", .4); }
  function kan(ctx, R, x, y, r) { ctx.save(); ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = "rgba(120,10,10,.75)"; ctx.fill(leke(R, x, y, r, 9, .6)); for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x + r1(R, -r * 2, r * 2), y + r1(R, -r * 2, r * 2), r1(R, 2, r * .25), 0, PI2); ctx.fill(); } ctx.restore(); }
  function kumas(ctx, x, y, w, h, renk, serit) { // pazar tezgâhı tentesi
    golgeli(ctx, () => { ctx.fillStyle = renk; ctx.fillRect(x, y, w, h); }, { blur: 12, dx: 10, dy: 14 });
    if (serit) { ctx.fillStyle = serit; for (let i = 0; i < w; i += 24) ctx.fillRect(x + i, y, 12, h); }
    const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, "rgba(255,255,255,.25)"); g.addColorStop(.5, "rgba(0,0,0,0)"); g.addColorStop(.52, "rgba(0,0,0,.18)"); g.addColorStop(1, "rgba(0,0,0,.35)"); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  }
  function mezarTasi(ctx, R, x, y, a) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.save(); ctx.globalAlpha = .8; ctx.filter = "blur(2px)"; ctx.fillStyle = desen(ctx, "toprak", "#6a5640", .2); ctx.fill(leke(R, 0, 40, 24, 9, .2, 34)); ctx.restore();
    const p = new Path2D(); p.moveTo(-24, 8); p.lineTo(-24, -4); p.arc(0, -4, 24, Math.PI, 0); p.lineTo(24, 8); p.closePath();
    golgeli(ctx, () => { ctx.fillStyle = desen(ctx, "kaya", "#8d8b86", .25); ctx.fill(p); }, { blur: 6, dx: 8, dy: 10 });
    ctx.lineWidth = 2; ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.stroke(p); ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(-22, -6, 44, 5);
    if (R() < .4) { ctx.strokeStyle = "rgba(40,38,36,.7)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, 2); ctx.moveTo(-7, -11); ctx.lineTo(7, -11); ctx.stroke(); }
    ctx.restore();
  }
  function olutAgac(ctx, R, x, y, s) {
    ctx.save(); ctx.lineCap = "round"; ctx.strokeStyle = "#2a2420";
    const dal = (x0, y0, a, l, w, d) => { if (d > 5 || l < 6) return; const x1 = x0 + Math.cos(a) * l, y1 = y0 + Math.sin(a) * l; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      const k = 2 + (R() < .4 ? 1 : 0); for (let i = 0; i < k; i++) dal(x1, y1, a + r1(R, -.8, .8), l * r1(R, .55, .75), w * .65, d + 1); };
    golgeli(ctx, () => { for (let i = 0; i < 6; i++) dal(x, y, i / 6 * PI2 + R(), s * r1(R, .35, .5), s * .08, 0); }, { blur: 5, dx: 10, dy: 12, alfa: .6 });
    ctx.fillStyle = "#2e2622"; ctx.beginPath(); ctx.arc(x, y, s * .1, 0, PI2); ctx.fill(); ctx.restore();
  }
  function araba(ctx, x, y, renk, aci) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(aci);
    const b = new Path2D(); b.roundRect(-58, -27, 116, 54, 14);
    golgeli(ctx, () => { const g = ctx.createLinearGradient(0, -27, 0, 27); g.addColorStop(0, D.karis(renk, "#fff", .35)); g.addColorStop(.5, renk); g.addColorStop(1, D.karis(renk, "#000", .45)); ctx.fillStyle = g; ctx.fill(b); }, { blur: 10, dx: 6, dy: 9, alfa: .7 });
    ctx.lineWidth = 2; ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.stroke(b);
    const cam = (x0, w, k) => { const g = ctx.createLinearGradient(x0, 0, x0 + w, 0); g.addColorStop(0, `rgba(20,30,40,${k})`); g.addColorStop(1, `rgba(90,120,140,${k})`); ctx.fillStyle = g; const p = new Path2D(); p.roundRect(x0, -21, w, 42, 7); ctx.fill(p); };
    cam(-34, 18, .95); cam(16, 16, .95); const g = ctx.createLinearGradient(0, -20, 0, 20); g.addColorStop(0, D.karis(renk, "#fff", .2)); g.addColorStop(1, D.karis(renk, "#000", .3)); ctx.fillStyle = g; ctx.fillRect(-14, -20, 28, 40);
    ctx.fillStyle = "#fff4cc"; ctx.fillRect(54, -20, 4, 10); ctx.fillRect(54, 10, 4, 10); ctx.fillStyle = "#b3172c"; ctx.fillRect(-58, -20, 3, 9); ctx.fillRect(-58, 11, 3, 9);
    ctx.restore();
  }

  const HARITALAR = {};

  HARITALAR["orman-acikligi"] = (ctx, R) => {
    ctx.fillStyle = desen(ctx, "cimen", "#587c35", .6); ctx.fillRect(0, 0, W, H); makro(ctx, R, 50, .22);
    const p = yol([[-40, 650], [250, 570], [420, 690], [700, 560], [950, 470], [1150, 430], [1440, 470]]);
    yumusak(ctx, x => { x.lineWidth = 78; x.stroke(p); }, "toprak", "#7d6446", .45, 10);
    yumusak(ctx, x => { x.lineWidth = 40; x.stroke(p); }, "cakil", "#8a7a62", .35, 10, .35);
    // gölet
    const g1 = leke(R, 990, 770, 125, 12, .25), g2 = leke(R, 985, 765, 98, 12, .2);
    yumusak(ctx, x => x.fill(g1), "toprak", "#5d4a36", .4, 8);
    ctx.save(); ctx.fillStyle = desen(ctx, "su", "#2c6a7e", .5); ctx.fill(g2); icGolge(ctx, g2, 40, .55); ctx.restore();
    for (let i = 0; i < 7; i++) { const a = r1(R, 0, PI2), d = r1(R, 30, 80); ctx.fillStyle = "#3f7a35"; ctx.beginPath(); ctx.arc(985 + Math.cos(a) * d, 765 + Math.sin(a) * d * .8, r1(R, 7, 12), a, a + 5.6); ctx.lineTo(985 + Math.cos(a) * d, 765 + Math.sin(a) * d * .8); ctx.fill(); }
    for (let i = 0; i < 40; i++) { ctx.fillStyle = ["#f1dd6a", "#e889b0", "#ffffff", "#b39ae8"][i % 4]; ctx.globalAlpha = .9; ctx.beginPath(); ctx.arc(r1(R, 380, 1000), r1(R, 230, 460), r1(R, 2, 4), 0, PI2); ctx.fill(); } ctx.globalAlpha = 1;
    for (let i = 0; i < 9; i++) sprite(ctx, "kaya", "#86827a", i % 4, r1(R, 330, 1080), r1(R, 170, 860), r1(R, 34, 70), R() * 6);
    const ag = []; for (let i = 0; i < 48; i++) { const kenar = R() < .5, x = kenar ? (R() < .5 ? r1(R, -40, 250) : r1(R, 1150, 1440)) : r1(R, 0, W), y = kenar ? r1(R, 0, H) : (R() < .5 ? r1(R, -40, 160) : r1(R, 880, 1040)); ag.push([x, y, r1(R, 110, 190), i % 3]); }
    for (let i = 0; i < 14; i++) ag.push([r1(R, 0, W), R() < .5 ? r1(R, 120, 220) : r1(R, 790, 900), r1(R, 40, 70), 2]);
    ag.sort((a, b) => a[2] - b[2]).forEach(([x, y, s, c]) => sprite(ctx, "agac", s < 80 ? "#3f6a2c" : ["#4d7a34", "#557f30", "#3f6f37"][c], c, x, y, s, R() * 6, .5));
    vinyet(ctx, .35);
  };

  HARITALAR.zindan = (ctx, R) => {
    ctx.fillStyle = desen(ctx, "kaya", "#3b3632", .45); ctx.fillRect(0, 0, W, H); ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.fillRect(0, 0, W, H);
    const alan = [[100, 100, 400, 300], [650, 100, 650, 250], [100, 550, 350, 350], [600, 450, 300, 450], [1000, 500, 300, 400], [500, 200, 150, 50], [250, 400, 50, 150], [450, 650, 150, 50], [900, 650, 100, 50], [1100, 350, 50, 150], [700, 350, 50, 100]];
    const zemin = new Path2D(); for (const [x, y, w, h] of alan) zemin.rect(x, y, w, h);
    const kenar = new Path2D(); for (const [x, y, w, h] of alan) kenar.rect(x - 14, y - 14, w + 28, h + 28);
    golgeli(ctx, () => { ctx.fillStyle = desen(ctx, "tas", "#6a655e", .28); ctx.fill(kenar); }, { blur: 18, dx: 0, dy: 0, alfa: .9 });
    ctx.fillStyle = desen(ctx, "kaldirim", "#7a746a", .38); ctx.fill(zemin);
    ctx.save(); ctx.clip(zemin); makro(ctx, R, 40, .22, 60, 160); ctx.restore();
    icGolge(ctx, zemin, 46, .75);
    for (let i = 0; i < 30; i++) { const [x, y, w, h] = alan[i % 5]; sprite(ctx, "kaya", "#6d6862", i % 4, x + r1(R, 15, w - 15), y + r1(R, 15, h - 15), r1(R, 10, 22), R() * 6, .5); }
    // kuyu
    golgeli(ctx, () => { ctx.fillStyle = desen(ctx, "tas", "#7b766e", .2); ctx.beginPath(); ctx.arc(300, 250, 42, 0, PI2); ctx.fill(); });
    const kuyu = daire(300, 250, 24); ctx.fillStyle = "#06080a"; ctx.fill(kuyu); ctx.save(); ctx.globalAlpha = .5; ctx.fillStyle = desen(ctx, "su", "#163038", .3); ctx.fill(daire(300, 250, 16)); ctx.restore(); icGolge(ctx, kuyu, 16, .8);
    // sandık
    ahsap(ctx, rect(1170, 140, 90, 60), "#6b4627", .25); ctx.fillStyle = "#2c2a27"; ctx.fillRect(1190, 140, 8, 60); ctx.fillRect(1232, 140, 8, 60); ctx.fillStyle = "#c9a24a"; ctx.fillRect(1211, 164, 8, 12);
    kan(ctx, R, 740, 640, 18); kan(ctx, R, 820, 720, 12); kan(ctx, R, 700, 805, 14);
    for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(r1(R, 640, 860), r1(R, 500, 860)); ctx.rotate(R() * 6); ctx.fillStyle = "#d8d0bc"; ctx.fillRect(-12, -2, 24, 4); ctx.beginPath(); ctx.arc(-12, 0, 4, 0, PI2); ctx.arc(12, 0, 4, 0, PI2); ctx.fill(); ctx.restore(); }
    for (const [x, y] of [[112, 130], [488, 130], [662, 115], [1288, 115], [112, 870], [612, 870], [1288, 880], [1012, 520]]) mesale(ctx, x, y);
    vinyet(ctx, .55);
  };

  HARITALAR.meyhane = (ctx, R) => {
    ctx.fillStyle = desen(ctx, "parke", "#8a5a32", .5); ctx.fillRect(0, 0, W, H); makro(ctx, R, 40, .18);
    const ic = rect(40, 40, W - 80, H - 80); icGolge(ctx, ic, 50, .55);
    const d = new Path2D(); d.rect(20, 20, W - 40, H - 40); ctx.lineWidth = 40; ctx.strokeStyle = desen(ctx, "tas", "#6e675e", .28); ctx.stroke(d);
    // halı
    hali(ctx, 560, 380, 320, 280, "#7a2230");
    // tezgâh
    ahsap(ctx, (() => { const p = new Path2D(); p.roundRect(880, 70, 460, 90, 10); return p; })(), "#5d3a1e", .3);
    for (let i = 0; i < 6; i++) { const x = 940 + i * 66; ahsap(ctx, daire(x, 196, 17), "#6b4423", .15); }
    for (let i = 0; i < 4; i++) fici(ctx, 1230 + (i % 2) * 64, 230 + Math.floor(i / 2) * 64, 28);
    for (let i = 0; i < 5; i++) { ctx.fillStyle = "#c9c2a8"; ctx.beginPath(); ctx.arc(920 + i * 80, 100, 8, 0, PI2); ctx.fill(); ctx.fillStyle = "#e9d28a"; ctx.beginPath(); ctx.arc(920 + i * 80, 100, 5, 0, PI2); ctx.fill(); }
    // ocak
    golgeli(ctx, () => { ctx.fillStyle = desen(ctx, "tas", "#7a746c", .22); ctx.fillRect(540, 40, 240, 70); });
    ctx.fillStyle = "#1b120c"; ctx.fillRect(590, 40, 140, 48); ates(ctx, 660, 66, 20);
    const masa = (x, y, yuvarlak) => {
      if (yuvarlak) { const n = 5; for (let i = 0; i < n; i++) { const a = i / n * PI2 + .3; sandalye(ctx, x + Math.cos(a) * 98, y + Math.sin(a) * 98, a + Math.PI / 2); } ahsap(ctx, daire(x, y, 66), "#8a5a2b", .3); }
      else { for (let i = 0; i < 6; i++) sandalye(ctx, x - 80 + (i % 3) * 80, y + (i < 3 ? -78 : 78), i < 3 ? 0 : Math.PI); ahsap(ctx, (() => { const p = new Path2D(); p.roundRect(x - 120, y - 46, 240, 92, 8); return p; })(), "#8a5a2b", .3); }
      ctx.fillStyle = "#cfc8b0"; ctx.beginPath(); ctx.arc(x + 22, y - 10, 11, 0, PI2); ctx.fill(); ctx.fillStyle = "#7a5a1a"; ctx.beginPath(); ctx.arc(x - 28, y + 12, 9, 0, PI2); ctx.fill(); ctx.fillStyle = "#e8d08a"; ctx.beginPath(); ctx.arc(x - 28, y + 12, 6, 0, PI2); ctx.fill();
      ctx.fillStyle = "#f3ecd8"; ctx.beginPath(); ctx.arc(x, y + 4, 4, 0, PI2); ctx.fill(); isik(ctx, x, y + 4, 110, "255,190,110", .28);
    };
    masa(300, 300, true); masa(330, 730, false); masa(720, 520, true); masa(1080, 450, false); masa(1110, 800, true);
    for (const [x, y] of [[90, 900], [150, 900], [90, 840]]) fici(ctx, x, y, 28);
    ahsap(ctx, rect(640, H - 42, 120, 24), "#7a5030", .25);
    isik(ctx, 660, 80, 420, "255,140,60", .35);
    vinyet(ctx, .45);
  };

  HARITALAR.magara = (ctx, R) => {
    ctx.fillStyle = "#0d0c0d"; ctx.fillRect(0, 0, W, H);
    const yolu = [[120, 820], [320, 640], [520, 700], [700, 520], [900, 560], [1060, 360], [1260, 220]];
    const dis = new Path2D(), zemin = new Path2D();
    for (const [x, y] of yolu) dis.addPath(leke(R, x, y, r1(R, 175, 235), 14, .35));
    for (const [x, y] of yolu) zemin.addPath(leke(R, x, y, r1(R, 130, 175), 13, .35));
    golgeli(ctx, () => { ctx.fillStyle = desen(ctx, "kaya", "#4a4440", .4); ctx.fill(dis); }, { blur: 30, dx: 0, dy: 0, alfa: 1 });
    ctx.fillStyle = desen(ctx, "kaya", "#6e655c", .5); ctx.fill(zemin); ctx.save(); ctx.clip(zemin); makro(ctx, R, 40, .25, 60, 160); ctx.restore();
    icGolge(ctx, zemin, 70, .75); icGolge(ctx, dis, 40, .6);
    const gol = leke(R, 640, 560, 92, 11, .3); ctx.fillStyle = desen(ctx, "su", "#1c4a5c", .4); ctx.fill(gol); icGolge(ctx, gol, 30, .7); isik(ctx, 640, 560, 160, "80,200,220", .18);
    for (let i = 0; i < 40; i++) { const [x, y] = yolu[i % yolu.length]; sprite(ctx, "kaya", "#5f5852", i % 4, x + r1(R, -140, 140), y + r1(R, -140, 140), r1(R, 18, 56), R() * 6, .6); }
    for (let i = 0; i < 16; i++) { const [x0, y0] = yolu[i % yolu.length], x = x0 + r1(R, -110, 110), y = y0 + r1(R, -110, 110);
      for (let k = 0; k < 3; k++) { ctx.save(); ctx.translate(x + k * 7 - 7, y); ctx.rotate(r1(R, -.5, .5)); const g = ctx.createLinearGradient(-5, 0, 5, 0); g.addColorStop(0, "#3fb8a8"); g.addColorStop(.5, "#c9fff4"); g.addColorStop(1, "#1f7f74"); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(0, -r1(R, 14, 26)); ctx.lineTo(5, 0); ctx.closePath(); ctx.fill(); ctx.restore(); }
      isik(ctx, x, y - 8, 60, "90,230,210", .3); }
    vinyet(ctx, .6);
  };

  HARITALAR["kasaba-meydani"] = (ctx, R) => {
    ctx.fillStyle = desen(ctx, "arnavut", "#837b70", .42); ctx.fillRect(0, 0, W, H); makro(ctx, R, 50, .2);
    const ev = (x, y, w, h, renk) => cati(ctx, x, y, w, h, renk);
    ev(60, 60, 260, 200, "#9c4a2e"); ev(380, 40, 220, 180, "#7d4a3a"); ev(1080, 60, 260, 220, "#a35532"); ev(60, 700, 240, 240, "#8a4430"); ev(1100, 720, 240, 220, "#7a5a40"); ev(760, 820, 220, 160, "#96503a");
    for (const [x, y] of [[250, 120], [520, 90], [1280, 140], [120, 760]]) { golgeli(ctx, () => { ctx.fillStyle = desen(ctx, "tas", "#6e6a64", .15); ctx.fillRect(x, y, 26, 26); }, { blur: 6, dx: 8, dy: 10 }); ctx.fillStyle = "#151210"; ctx.fillRect(x + 6, y + 6, 14, 14); }
    // çeşme
    golgeli(ctx, () => { ctx.fillStyle = desen(ctx, "kaldirim", "#a39d92", .25); ctx.beginPath(); ctx.arc(700, 500, 126, 0, PI2); ctx.fill(); }, { blur: 14, dx: 8, dy: 10 });
    const havuz = daire(700, 500, 96); ctx.fillStyle = desen(ctx, "su", "#3a7f98", .45); ctx.fill(havuz); icGolge(ctx, havuz, 30, .55);
    golgeli(ctx, () => { ctx.fillStyle = desen(ctx, "kaldirim", "#b3ada2", .15); ctx.beginPath(); ctx.arc(700, 500, 26, 0, PI2); ctx.fill(); });
    ctx.strokeStyle = "rgba(230,250,255,.22)"; ctx.lineWidth = 1.5; for (const r of [40, 62]) { ctx.beginPath(); ctx.arc(700, 500, r, 0, PI2); ctx.stroke(); }
    // pazar tezgâhları
    for (const [x, y, c, s] of [[370, 385, "#b8452f", "#e9dcc0"], [930, 520, "#2f5fa8", "#e9dcc0"], [470, 645, "#c9952e", "#8a3b1f"]]) { kumas(ctx, x, y, 110, 74, c, s);
      for (let i = 0; i < 3; i++) ahsap(ctx, rect(x + 8 + i * 34, y + 82, 28, 22), "#7a5030", .15); }
    for (let i = 0; i < 6; i++) fici(ctx, r1(R, 330, 1060), R() < .5 ? r1(R, 300, 340) : r1(R, 700, 760), 18);
    for (let i = 0; i < 8; i++) { const x = 380 + i * 90, y = i % 2 ? 290 : 740; golgeli(ctx, () => { ctx.fillStyle = desen(ctx, "toprak", "#5d4a36", .2); ctx.beginPath(); ctx.arc(x, y, 30, 0, PI2); ctx.fill(); }, { blur: 4, dx: 3, dy: 4 }); sprite(ctx, "agac", "#4f7f36", i % 3, x, y, r1(R, 80, 105), R() * 6, .45); }
    vinyet(ctx, .35);
  };

  HARITALAR.mezarlik = (ctx, R) => {
    ctx.fillStyle = desen(ctx, "cimen", "#3f5a36", .55); ctx.fillRect(0, 0, W, H); makro(ctx, R, 60, .28);
    ctx.fillStyle = "rgba(10,20,25,.25)"; ctx.fillRect(0, 0, W, H);
    yumusak(ctx, x => { x.fillRect(640, 640, 120, 400); x.fillRect(520, 600, 360, 80); }, "cakil", "#6e6a60", .35, 6);
    // mozole
    cati(ctx, 560, 400, 280, 220, "#57555a", "kaldirim");
    ahsap(ctx, rect(670, 606, 60, 18), "#4a3a2a", .2);
    for (let y = 120; y < 920; y += 120) for (let x = 100; x < 1320; x += 110) { if (x > 480 && x < 920 && y > 300) continue; if (R() < .25) continue; mezarTasi(ctx, R, x + r1(R, -15, 15), y + r1(R, -10, 10), r1(R, -.2, .2)); }
    // demir çit
    ctx.save(); ctx.strokeStyle = "#141414"; ctx.lineWidth = 4; ctx.shadowColor = "rgba(0,0,0,.7)"; ctx.shadowBlur = 4; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 5; ctx.strokeRect(24, 24, W - 48, H - 48);
    ctx.fillStyle = "#1a1a1a"; for (let x = 24; x <= W - 24; x += 30) { ctx.fillRect(x - 3, 21, 6, 6); ctx.fillRect(x - 3, H - 27, 6, 6); } for (let y = 24; y <= H - 24; y += 30) { ctx.fillRect(21, y - 3, 6, 6); ctx.fillRect(W - 27, y - 3, 6, 6); } ctx.restore();
    for (let i = 0; i < 5; i++) olutAgac(ctx, R, R() < .5 ? r1(R, 50, 140) : r1(R, 1260, 1360), r1(R, 80, 920), r1(R, 130, 190));
    for (let i = 0; i < 6; i++) sprite(ctx, "agac", "#2e3f2e", i % 3, R() < .5 ? r1(R, -20, 90) : r1(R, 1310, 1420), r1(R, 0, H), r1(R, 130, 190), R() * 6, .55);
    for (let i = 0; i < 14; i++) isik(ctx, r1(R, 0, W), r1(R, 0, H), r1(R, 160, 320), "200,215,220", .12, "screen");
    vinyet(ctx, .55);
  };

  HARITALAR.konak = (ctx, R) => {
    ctx.fillStyle = "#16110f"; ctx.fillRect(0, 0, W, H);
    const odalar = [[60, 60, 560, 420, "parke", "#6b4a2e"], [620, 60, 720, 420, "parke", "#7a5232"], [60, 480, 420, 460, "mermer", "#dcd6c8"], [480, 480, 460, 460, "parke", "#5e3e26"], [940, 480, 400, 460, "parke", "#6e4a2c"]];
    for (const [x, y, w, h, ad, renk] of odalar) { const p = rect(x, y, w, h); ctx.fillStyle = desen(ctx, ad, renk, ad === "mermer" ? .4 : .42); ctx.fill(p); ctx.save(); ctx.clip(p); makro(ctx, R, 12, .18, 60, 160); ctx.restore(); icGolge(ctx, p, 40, .55); }
    const duv = new Path2D(); for (const [x, y, w, h] of odalar) duv.rect(x, y, w, h);
    golgeli(ctx, () => { ctx.lineWidth = 14; ctx.strokeStyle = desen(ctx, "kum", "#e3d8c2", .2); ctx.stroke(duv); }, { blur: 10, dx: 4, dy: 6, alfa: .6 });
    ctx.fillStyle = desen(ctx, "parke", "#6b4a2e", .42); for (const [x, y] of [[340, 480], [620, 270], [940, 700], [480, 700]]) ctx.fillRect(x - 30, y - 30, 60, 60);
    hali(ctx, 760, 140, 440, 260, "#7a2230");
    ahsap(ctx, rect(870, 230, 220, 80), "#4f301a", .3); for (let i = 0; i < 6; i++) sandalye(ctx, 900 + (i % 3) * 80, i < 3 ? 205 : 335, i < 3 ? 0 : Math.PI, "#5a3820");
    for (const [x, y] of [[940, 270], [1020, 270]]) { ctx.fillStyle = "#f3ecd8"; ctx.beginPath(); ctx.arc(x, y, 4, 0, PI2); ctx.fill(); isik(ctx, x, y, 120, "255,190,110", .3); }
    // kitaplık
    ahsap(ctx, rect(100, 96, 220, 60), "#4a2f1c", .25); ahsap(ctx, rect(96, 96, 44, 300), "#4a2f1c", .25);
    for (let i = 0; i < 8; i++) { ctx.fillStyle = ["#7a2230", "#2b4a7a", "#3b6b3b", "#8a6b2b"][i % 4]; ctx.fillRect(146 + i * 21, 104, 16, 44); ctx.fillStyle = "rgba(255,255,255,.15)"; ctx.fillRect(146 + i * 21, 104, 3, 44); }
    for (let i = 0; i < 10; i++) { ctx.fillStyle = ["#5a2a30", "#2b3a5a", "#3b5b3b", "#6a5b2b"][i % 4]; ctx.fillRect(104, 162 + i * 22, 28, 16); }
    hali(ctx, 200, 220, 240, 170, "#264a6a");
    ahsap(ctx, daire(330, 300, 40), "#5a3820", .2); for (const [x, y] of [[260, 250], [400, 360]]) ahsap(ctx, (() => { const p = new Path2D(); p.roundRect(x - 26, y - 24, 52, 48, 12); return p; })(), "#6a2a30", .2);
    // yatak odası
    golgeli(ctx, () => { const p = new Path2D(); p.roundRect(1010, 560, 260, 160, 6); ctx.fillStyle = "#e4ddd0"; ctx.fill(p); });
    ctx.drawImage(D.doku("hali", "#5a2a50", 256), 1010, 620, 260, 100); ctx.fillStyle = "#f2eee6"; for (const y of [580, 640]) { const p = new Path2D(); p.roundRect(1022, y - 12, 60, 44, 10); ctx.fill(p); }
    ahsap(ctx, rect(1000, 552, 16, 176), "#3a2414", .2);
    // mutfak (mermer oda): masa, ocak, kan
    ahsap(ctx, rect(150, 700, 180, 90), "#7a5a3a", .3); fici(ctx, 110, 880, 26); fici(ctx, 170, 880, 26);
    golgeli(ctx, () => { ctx.fillStyle = desen(ctx, "tas", "#5e5a55", .2); ctx.fillRect(330, 500, 130, 60); }); ctx.fillStyle = "#140d08"; ctx.fillRect(360, 500, 70, 40); ates(ctx, 395, 522, 14);
    kan(ctx, R, 700, 760, 40);
    // merdiven (orta oda)
    golgeli(ctx, () => { ctx.drawImage(D.sprite("merdiven", "#6a4a30"), 570, 600, 300, 230); });
    vinyet(ctx, .5);
  };

  HARITALAR["uzay-gemisi"] = (ctx, R) => {
    ctx.fillStyle = "#07090b"; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) { ctx.fillStyle = `rgba(255,255,255,${r1(R, .2, .8).toFixed(2)})`; ctx.fillRect(r1(R, 0, W), r1(R, 0, H), 1.5, 1.5); }
    const alan = [[80, 80, 500, 340], [680, 80, 640, 340], [80, 540, 380, 380], [560, 540, 760, 380], [580, 210, 100, 80], [250, 420, 80, 120], [900, 420, 80, 120]];
    const zemin = new Path2D(), dis = new Path2D(); for (const [x, y, w, h] of alan) { zemin.rect(x, y, w, h); dis.rect(x - 18, y - 18, w + 36, h + 36); }
    golgeli(ctx, () => { ctx.fillStyle = desen(ctx, "metal", "#3b454b", .3); ctx.fill(dis); }, { blur: 30, dx: 0, dy: 0, alfa: .9 });
    ctx.fillStyle = desen(ctx, "metal", "#5d686f", .4); ctx.fill(zemin); ctx.save(); ctx.clip(zemin); makro(ctx, R, 30, .15, 60, 160); ctx.restore(); icGolge(ctx, zemin, 36, .6);
    // geçitlerde sarı-siyah uyarı şeridi
    for (const [x, y, w, h] of alan.slice(4)) { const p = ctx.createPattern((() => { const c = tv(24, 24), x2 = c.getContext("2d"); x2.fillStyle = "#1a1a1a"; x2.fillRect(0, 0, 24, 24); x2.strokeStyle = "#d8b432"; x2.lineWidth = 8; x2.beginPath(); x2.moveTo(-6, 30); x2.lineTo(30, -6); x2.moveTo(-18, 18); x2.lineTo(18, -18); x2.moveTo(6, 42); x2.lineTo(42, 6); x2.stroke(); return c; })(), "repeat");
      ctx.save(); ctx.strokeStyle = p; ctx.lineWidth = 8; ctx.globalAlpha = .85; ctx.strokeRect(x + 4, y + 4, w - 8, h - 8); ctx.restore(); }
    for (let i = 0; i < 5; i++) { const x = 700 + i * 112, y = 100; golgeli(ctx, () => { ctx.fillStyle = desen(ctx, "metal", "#2b3a42", .15); ctx.fillRect(x, y, 84, 44); }, { blur: 8, dx: 4, dy: 6 });
      ctx.fillStyle = "#0b1a20"; ctx.fillRect(x + 8, y + 8, 46, 18); ctx.fillStyle = "#4fd1c5"; ctx.globalAlpha = .9; for (let k = 0; k < 4; k++) ctx.fillRect(x + 11, y + 11 + k * 4, r1(R, 10, 40), 2); ctx.globalAlpha = 1;
      ctx.fillStyle = i % 2 ? "#f6ad55" : "#68d391"; ctx.beginPath(); ctx.arc(x + 68, y + 30, 5, 0, PI2); ctx.fill(); isik(ctx, x + 30, y + 18, 70, "79,209,197", .3); }
    golgeli(ctx, () => { const p = new Path2D(); p.roundRect(620, 620, 300, 220, 14); ctx.fillStyle = desen(ctx, "metal", "#34444c", .3); ctx.fill(p); });
    const ek = new Path2D(); ek.roundRect(660, 660, 220, 140, 8); ctx.fillStyle = "#0a1620"; ctx.fill(ek); ctx.save(); ctx.clip(ek); ctx.strokeStyle = "rgba(80,220,200,.5)"; ctx.lineWidth = 1; for (let x = 660; x < 880; x += 20) { ctx.beginPath(); ctx.moveTo(x, 660); ctx.lineTo(x, 800); ctx.stroke(); } for (let y = 660; y < 800; y += 20) { ctx.beginPath(); ctx.moveTo(660, y); ctx.lineTo(880, y); ctx.stroke(); }
    ctx.fillStyle = "#68f0d8"; ctx.beginPath(); ctx.arc(760, 720, 6, 0, PI2); ctx.fill(); ctx.restore(); isik(ctx, 770, 730, 200, "79,209,197", .25);
    for (let i = 0; i < 4; i++) { const x = 100 + i * 85; const p = new Path2D(); p.roundRect(x, 580, 65, 140, 30); golgeli(ctx, () => { const g = ctx.createLinearGradient(x, 0, x + 65, 0); g.addColorStop(0, "#9aa7ad"); g.addColorStop(.4, "#e3ecef"); g.addColorStop(1, "#6d7a80"); ctx.fillStyle = g; ctx.fill(p); });
      const c = new Path2D(); c.roundRect(x + 10, 598, 45, 74, 20); const g = ctx.createLinearGradient(x, 598, x + 45, 672); g.addColorStop(0, "rgba(160,230,255,.85)"); g.addColorStop(1, "rgba(40,110,140,.85)"); ctx.fillStyle = g; ctx.fill(c); isik(ctx, x + 32, 635, 70, "120,210,255", .25); }
    for (let i = 0; i < 10; i++) { const x = 1080 + (i % 2) * 110, y = 580 + Math.floor(i / 2) * 64; golgeli(ctx, () => { ctx.fillStyle = desen(ctx, "metal", "#6a5a3a", .12); ctx.fillRect(x, y, 90, 50); }, { blur: 8, dx: 5, dy: 7 }); ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 2; ctx.strokeRect(x, y, 90, 50); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 90, y + 50); ctx.stroke(); }
    ctx.save(); ctx.strokeStyle = "rgba(246,224,94,.6)"; ctx.lineWidth = 6; ctx.setLineDash([30, 20]); ctx.beginPath(); ctx.moveTo(120, 380); ctx.lineTo(520, 380); ctx.stroke(); ctx.restore();
    for (const [x, y, w] of [[80, 84, 500], [680, 84, 640], [80, 544, 380], [560, 544, 760]]) { ctx.fillStyle = "rgba(160,240,255,.8)"; ctx.fillRect(x + 20, y, w - 40, 3); isik(ctx, x + w / 2, y + 4, w * .45, "130,220,255", .12); }
    vinyet(ctx, .5);
  };

  HARITALAR["karli-orman"] = (ctx, R) => {
    ctx.fillStyle = desen(ctx, "kar", "#eef3f6", .6); ctx.fillRect(0, 0, W, H); makro(ctx, R, 40, .16);
    const p = yol([[-40, 300], [200, 360], [380, 290], [520, 340], [600, 600], [590, 1040]]);
    yumusak(ctx, x => { x.lineWidth = 46; x.stroke(p); }, "kar", "#c9cfd4", .3, 8, .9);
    yumusak(ctx, x => { x.lineWidth = 18; x.setLineDash([8, 30]); x.stroke(p); }, "toprak", "#6a5a48", .3, 4, .35);
    const g1 = leke(R, 860, 480, 262, 14, .2), g2 = leke(R, 860, 480, 222, 13, .16);
    yumusak(ctx, x => x.fill(g1), "kar", "#dfe8ee", .5, 10);
    ctx.fillStyle = desen(ctx, "su", "#8fb9cc", .6); ctx.fill(g2); ctx.save(); ctx.clip(g2); ctx.fillStyle = "rgba(230,245,255,.35)"; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 1.4; for (let i = 0; i < 16; i++) { let x = r1(R, 680, 1040), y = r1(R, 320, 640); ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 4; k++) { x += r1(R, -40, 40); y += r1(R, -30, 30); ctx.lineTo(x, y); } ctx.stroke(); }
    yumusak(ctx, x => { for (let i = 0; i < 8; i++) x.fill(leke(R, r1(R, 700, 1020), r1(R, 340, 620), r1(R, 20, 50), 8, .5)); }, "kar", "#f4f8fa", .4, 10, .8);
    ctx.restore(); icGolge(ctx, g2, 26, .25);
    // kulübe ve ateş
    cati(ctx, 170, 540, 180, 140, "#f2f6f8", "kar"); golgeli(ctx, () => { ctx.fillStyle = desen(ctx, "tas", "#6a655e", .15); ctx.fillRect(300, 560, 22, 22); }); ctx.fillStyle = "#16110d"; ctx.fillRect(305, 565, 12, 12);
    ahsap(ctx, rect(150, 700, 70, 34), "#5a3820", .2); ates(ctx, 430, 650, 18);
    const cams = []; for (let i = 0; i < 62; i++) { const x = r1(R, -40, W + 40), y = r1(R, -40, H + 40); if (Math.hypot(x - 860, y - 480) < 300 || (x > 340 && x < 640 && y > 250 && y < 1000) || (x > 120 && x < 480 && y > 500 && y < 760)) continue; cams.push([x, y, r1(R, 90, 150), i % 3]); }
    cams.sort((a, b) => a[2] - b[2]).forEach(([x, y, s, c]) => sprite(ctx, "karliCam", "#2f5a3a", c, x, y, s, R() * 6, .4));
    ctx.fillStyle = "rgba(220,235,245,.08)"; ctx.fillRect(0, 0, W, H);
    vinyet(ctx, .25);
  };

  HARITALAR["sehir-sokagi"] = (ctx, R) => {
    ctx.fillStyle = desen(ctx, "cakil", "#45464b", .14); ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = desen(ctx, "kaya", "#3a3b40", .5); ctx.fillRect(0, 340, W, 320); makro(ctx, R, 40, .18);
    for (const y of [260, 660]) { golgeli(ctx, () => { ctx.fillStyle = desen(ctx, "kaldirim", "#8a8780", .32); ctx.fillRect(0, y, W, 80); }, { blur: 6, dx: 0, dy: y === 260 ? 5 : -5, alfa: .6 }); ctx.fillStyle = "#9a978f"; ctx.fillRect(0, y === 260 ? 336 : 660, W, 4); }
    ctx.save(); ctx.strokeStyle = "rgba(232,197,71,.85)"; ctx.lineWidth = 7; ctx.setLineDash([60, 40]); ctx.beginPath(); ctx.moveTo(0, 500); ctx.lineTo(W, 500); ctx.stroke(); ctx.restore();
    for (let i = 0; i < 8; i++) { ctx.fillStyle = "rgba(235,232,224,.82)"; ctx.fillRect(560, 350 + i * 40, 100, 20); }
    ctx.save(); ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = desen(ctx, "kaya", "#9a9a9a", .5); ctx.fillRect(560, 340, 100, 320); ctx.restore();
    const bina = (x, y, w, h, renk) => { golgeli(ctx, () => { ctx.fillStyle = desen(ctx, "cakil", renk, .16); ctx.fillRect(x, y, w, h); }, { blur: 16, dx: 10, dy: 14, alfa: .7 });
      ctx.lineWidth = 12; ctx.strokeStyle = desen(ctx, "tas", D.karis(renk, "#000", .2), .15); ctx.strokeRect(x + 6, y + 6, w - 12, h - 12); icGolge(ctx, rect(x + 12, y + 12, w - 24, h - 24), 14, .5);
      for (let i = 0; i < 2; i++) { const ax = x + 30 + R() * (w - 110), ay = y + 30 + R() * (h - 100); golgeli(ctx, () => { ctx.fillStyle = desen(ctx, "metal", "#8a9296", .1); ctx.fillRect(ax, ay, 52, 40); }, { blur: 6, dx: 5, dy: 7 }); ctx.strokeStyle = "#333"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ax + 26, ay + 20, 14, 0, PI2); ctx.stroke(); } };
    bina(20, 20, 300, 220, "#6a5d55"); bina(340, 20, 360, 220, "#58636c"); bina(720, 20, 300, 220, "#6e5d50"); bina(1040, 20, 340, 220, "#555863"); bina(20, 760, 420, 220, "#58636c"); bina(460, 760, 300, 220, "#6a5d55"); bina(780, 760, 600, 220, "#555863");
    araba(ctx, 220, 400, "#8a2b2b", 0); araba(ctx, 980, 600, "#2b4a8a", Math.PI); araba(ctx, 1240, 410, "#c9c2a8", 0);
    golgeli(ctx, () => { ctx.fillStyle = desen(ctx, "metal", "#2f6b3a", .1); ctx.fillRect(1180, 680, 70, 50); }); ctx.strokeStyle = "#111"; ctx.strokeRect(1180, 680, 70, 50);
    // gece: karart, sonra ışık havuzları
    ctx.save(); ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = "#7682a8"; ctx.fillRect(0, 0, W, H); ctx.restore();
    for (const x of [120, 520, 920, 1320]) { ctx.fillStyle = "#c9c2a8"; ctx.beginPath(); ctx.arc(x, 290, 9, 0, PI2); ctx.fill(); isik(ctx, x, 300, 170, "255,214,150", .5); }
    for (const x of [320, 720, 1120]) { ctx.fillStyle = "#c9c2a8"; ctx.beginPath(); ctx.arc(x, 710, 9, 0, PI2); ctx.fill(); isik(ctx, x, 700, 170, "255,214,150", .5); }
    isik(ctx, 290, 400, 90, "255,240,200", .35); isik(ctx, 1310, 410, 90, "255,240,200", .35); isik(ctx, 910, 600, 90, "255,240,200", .35);
    for (let i = 0; i < 30; i++) { ctx.fillStyle = R() < .5 ? "rgba(255,220,140,.75)" : "rgba(150,200,255,.5)"; const [bx, by] = [[20, 20], [340, 20], [720, 20], [1040, 20], [20, 760], [460, 760], [780, 760]][i % 7]; ctx.fillRect(bx + r1(R, 30, 260), by + r1(R, 30, 180), 10, 6); }
    vinyet(ctx, .5);
  };

  HARITALAR["col-harabeleri"] = (ctx, R) => {
    ctx.fillStyle = desen(ctx, "kum", "#d6b47a", .7, 12); ctx.fillRect(0, 0, W, H); makro(ctx, R, 50, .25, 120, 320);
    const zemin = rect(420, 260, 560, 480); ctx.fillStyle = desen(ctx, "kaldirim", "#b59b74", .4); ctx.fill(zemin);
    yumusak(ctx, x => { for (let i = 0; i < 9; i++) x.fill(leke(R, r1(R, 420, 980), r1(R, 260, 740), r1(R, 40, 110), 9, .5)); }, "kum", "#d6b47a", .7, 16, .9);
    const duv = d => duvar(ctx, new Path2D(d), 30, "#a68a62", .3);
    duv("M420 420 V260 H640"); duv("M760 260 H980 V480"); duv("M980 600 V740 H780"); duv("M600 740 H420 V560");
    for (const [x, y, k] of [[520, 360], [880, 360], [520, 640], [880, 640, 1]]) { if (k) { ctx.save(); ctx.translate(x + 60, y + 10); ctx.rotate(.5); golgeli(ctx, () => { const g = ctx.createLinearGradient(0, -30, 0, 30); g.addColorStop(0, "#e3cfa6"); g.addColorStop(.5, "#c2a87e"); g.addColorStop(1, "#7a6444"); ctx.fillStyle = g; ctx.fillRect(-90, -30, 180, 60); }); ctx.restore(); }
      golgeli(ctx, () => { const g = ctx.createRadialGradient(x - 10, y - 10, 2, x, y, 36); g.addColorStop(0, "#ead6ad"); g.addColorStop(1, "#8f7651"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 34, 0, PI2); ctx.fill(); }, { blur: 10, dx: 14, dy: 18 });
      ctx.strokeStyle = "rgba(90,70,40,.5)"; ctx.lineWidth = 2; for (const r of [20, 28]) { ctx.beginPath(); ctx.arc(x, y, r, 0, PI2); ctx.stroke(); } }
    golgeli(ctx, () => { ctx.fillStyle = desen(ctx, "tas", "#8e7a58", .2); ctx.fillRect(640, 440, 120, 120); }, { blur: 12, dx: 10, dy: 14 }); ctx.fillStyle = "#3e3020"; ctx.beginPath(); ctx.arc(700, 500, 30, 0, PI2); ctx.fill(); icGolge(ctx, daire(700, 500, 30), 14, .8);
    for (let i = 0; i < 30; i++) sprite(ctx, "kaya", "#a88c62", i % 4, r1(R, 0, W), r1(R, 0, H), r1(R, 16, 46), R() * 6, .45);
    for (const [x, y] of [[180, 180], [1220, 820], [1240, 160], [140, 860]]) sprite(ctx, "agac", "#5d7a35", (x / 10) % 3, x, y, r1(R, 80, 120), R() * 6, .5);
    vinyet(ctx, .3);
  };

  window.ZM_HARITA_CIZ = function (id, seed) {
    const c = tv(), ctx = c.getContext("2d"), f = HARITALAR[id]; if (!f) throw new Error("harita yok: " + id);
    f(ctx, rng(seed)); return c;
  };
  window.ZM_HARITA_LISTE = Object.keys(HARITALAR);
})();
