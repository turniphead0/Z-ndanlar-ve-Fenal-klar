/* Gerçekçi dokular: taş duvar, ahşap, kapı, tavan, döşeme taşı, arnavut kaldırımı, çimen, toprak, kayalık, su, lav,
   kum, kar, metal, kaya, mermer, kiremit, ağaç kabuğu; üstten ağaç, çam ve kaya, yandan ağaç, çukur ve merdiven.
   Hepsi tarayıcıda gürültü (Perlin ve hücre gürültüsü) ve ışıklandırma ile üretilir; dışarıdan resim kullanılmaz, telif
   sorunu yoktur (MIT, projeyle birlikte). Karo dokular kenarlarından kesintisiz tekrar eder.
   Haritada arazi kareleri (app.html drawTerrain), birinci şahıs (birinci-sahis.js, tavan.js) ve hazır haritaları üreten
   araç (tools/gorsel/haritalar.js) kullanır.
   ZMDoku.doku(ad, renk?, boyut?)      → karo tuval (önbellekli)
   ZMDoku.desen(ctx, ad, renk, kare, kac) → tuval deseni; bir doku kac kareyi kaplar
   ZMDoku.veri(ad, renk?, boyut?)      → { w, h, data: Uint32Array } (birinci şahıs tavanı için)
   ZMDoku.sprite(ad, renk?, cesit?)    → saydam tuval (agac, cam, karliCam, kaya, agacYan, camYan, cukur, merdiven, kapiUst)
   ZMDoku.kapi(renk, duvarRengi)       → birinci şahısta kapılı duvar yüzü
   ZMDoku.bulut(w, h, tur)             → gökyüzü panoraması için bulut yoğunluğu (Float32Array, yatayda sarılır) */
(function (root) {
  "use strict";
  const cache = {};
  const PI2 = Math.PI * 2;

  function rnd(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
  let parseCtx = null;
  function rgb(c) {
    if (Array.isArray(c)) return c.slice(0, 3);
    let h = String(c || "").trim();
    if (!h) return [128, 128, 128];
    if (h[0] !== "#" && !/^rgb/.test(h) && typeof document !== "undefined") { parseCtx = parseCtx || document.createElement("canvas").getContext("2d"); parseCtx.fillStyle = "#808080"; parseCtx.fillStyle = h; h = parseCtx.fillStyle; }
    if (/^rgb/.test(h)) { const m = h.match(/[\d.]+/g) || [128, 128, 128]; return [+m[0], +m[1], +m[2]]; }
    h = h.slice(1); if (h.length === 3) h = h.replace(/./g, "$&$&");
    const n = parseInt(h.slice(0, 6), 16); return isNaN(n) ? [128, 128, 128] : [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const mulC = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

  /* ---------- gürültü ---------- */
  // Periyodik gradyan (Perlin) gürültüsü: n(x, y, px, py) px ve py tam sayı periyotlarla sarılır.
  const noiseCache = {};
  function gurultu(seed) {
    if (noiseCache[seed]) return noiseCache[seed];
    const r = rnd(seed * 7919 + 13), p = new Uint8Array(512), gx = new Float32Array(256), gy = new Float32Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0, t = p[i]; p[i] = p[j]; p[j] = t; }
    for (let i = 0; i < 256; i++) { p[i + 256] = p[i]; const a = r() * PI2; gx[i] = Math.cos(a); gy[i] = Math.sin(a); }
    return noiseCache[seed] = (x, y, px, py) => {
      const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
      const x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py, x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
      const h00 = p[p[x0 & 255] + (y0 & 255)], h10 = p[p[x1 & 255] + (y0 & 255)], h01 = p[p[x0 & 255] + (y1 & 255)], h11 = p[p[x1 & 255] + (y1 & 255)];
      const a = gx[h00] * fx + gy[h00] * fy, b = gx[h10] * (fx - 1) + gy[h10] * fy, c = gx[h01] * fx + gy[h01] * (fy - 1), d = gx[h11] * (fx - 1) + gy[h11] * (fy - 1);
      const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
      return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 1.41;
    };
  }
  // Fraktal gürültü; u, v 0..1, fx, fy tam sayı (karo kesintisiz). Sonuç yaklaşık -0.7..0.7
  function fbm(n, u, v, fx, fy, oct, gain = .5) {
    let s = 0, a = 1, t = 0;
    for (let o = 0; o < oct; o++) { s += a * n(u * fx, v * fy, fx, fy); t += a; a *= gain; fx *= 2; fy *= 2; }
    return s / t;
  }
  // Periyodik hücre (Worley) gürültüsü: en yakın iki noktanın uzaklığı ve hücre kimliği.
  function hucre(seed, n, jit = 1) {
    const r = rnd(seed * 31 + 5), px = new Float32Array(n * n), py = new Float32Array(n * n), id = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) { px[i] = .5 + (r() - .5) * jit; py[i] = .5 + (r() - .5) * jit; id[i] = r(); }
    const o = { d1: 0, d2: 0, id: 0, k: 0, dx: 0, dy: 0 };
    return (u, v) => {
      const x = u * n, y = v * n, xi = Math.floor(x), yi = Math.floor(y); let d1 = 9, d2 = 9, k1 = 0, ex = 0, ey = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const cx = xi + i, cy = yi + j, w = (((cx % n) + n) % n) + (((cy % n) + n) % n) * n;
        const dx = cx + px[w] - x, dy = cy + py[w] - y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < d1) { d2 = d1; d1 = d; k1 = w; ex = dx; ey = dy; } else if (d < d2) d2 = d;
      }
      o.d1 = d1; o.d2 = d2; o.id = id[k1]; o.k = k1; o.dx = ex; o.dy = ey; return o;
    };
  }

  /* ---------- üretim: yükseklik + renk → ışıklandırılmış tuval ---------- */
  const L = (() => { const v = [-.55, -.62, .56], l = Math.hypot(...v); return v.map(x => x / l); })();
  function tuval(w, h) {
    if (typeof document !== "undefined") { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
    return new OffscreenCanvas(w, h);
  }
  // fn(u, v, o, x, y): o.h yükseklik, o.r/g/b renk (0..255), o.a saydamlık, o.e* ışık saçan renk; o.p parlaklık (0..1)
  function yap(w, h, fn, opt = {}) {
    const n = w * h, H = new Float32Array(n), C = new Float32Array(n * 3), A = new Float32Array(n), E = new Float32Array(n * 3), P = new Float32Array(n);
    const o = { h: 0, r: 0, g: 0, b: 0, a: 1, er: 0, eg: 0, eb: 0, p: 0 };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      o.h = 0; o.r = o.g = o.b = 128; o.a = 1; o.er = o.eg = o.eb = 0; o.p = 0;
      fn((x + .5) / w, (y + .5) / h, o, x, y);
      const i = y * w + x; H[i] = o.h; C[i * 3] = o.r; C[i * 3 + 1] = o.g; C[i * 3 + 2] = o.b; A[i] = o.a; E[i * 3] = o.er; E[i * 3 + 1] = o.eg; E[i * 3 + 2] = o.eb; P[i] = o.p;
    }
    const c = tuval(w, h), x = c.getContext("2d"), img = x.createImageData(w, h), d = img.data, k = opt.kabart == null ? 3 : opt.kabart, karo = opt.karo !== false, amb = opt.ortam == null ? .38 : opt.ortam;
    const at = (xx, yy) => { if (karo) { xx = (xx + w) % w; yy = (yy + h) % h; } else { xx = xx < 0 ? 0 : xx >= w ? w - 1 : xx; yy = yy < 0 ? 0 : yy >= h ? h - 1 : yy; } return H[yy * w + xx]; };
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
      const i = y * w + xx, dx = (at(xx + 1, y) - at(xx - 1, y)) * k, dy = (at(xx, y + 1) - at(xx, y - 1)) * k, ln = Math.hypot(dx, dy, 1);
      const nx = -dx / ln, ny = -dy / ln, nz = 1 / ln, lam = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      const s = amb + (1 - amb) * lam / L[2];
      let sp = 0; if (P[i] > 0) { const rz = 2 * lam * nz - L[2]; sp = P[i] * Math.pow(Math.max(0, rz), 18) * 255; }
      d[i * 4] = clamp(C[i * 3] * s + sp + E[i * 3], 0, 255); d[i * 4 + 1] = clamp(C[i * 3 + 1] * s + sp + E[i * 3 + 1], 0, 255); d[i * 4 + 2] = clamp(C[i * 3 + 2] * s + sp + E[i * 3 + 2], 0, 255);
      d[i * 4 + 3] = clamp(A[i] * 255, 0, 255);
    }
    x.putImageData(img, 0, 0);
    return c;
  }
  const set = (o, c, k = 1) => { o.r = c[0] * k; o.g = c[1] * k; o.b = c[2] * k; };

  /* ---------- karo dokular ---------- */
  const VARS = {
    tas: "#7a756c", tahta: "#8a5a32", tavan: "#6b4a2e", kaldirim: "#8a8478", arnavut: "#80796e", cimen: "#5a7d38", toprak: "#7a5f43",
    kayalik: "#8c7b60", su: "#2f6f8f", lav: "#ff6a1a", kum: "#d4b27a", kar: "#eef3f6", metal: "#5d686f", kaya: "#6a625b", mermer: "#dcd6c8",
    kiremit: "#9c4a2e", kabuk: "#5a4130", parke: "#7a5030", hali: "#7a2230", cakil: "#8a8276"
  };
  const MAT = {};

  // Taş blok duvar: 4 sıra, sıralarda 2–3 blok, harç, yontulmuş kenarlar, lekeler.
  MAT.tas = (N, t, seed) => {
    const n = gurultu(seed), r = rnd(seed + 1), rows = 4, br = [];
    for (let i = 0; i < rows; i++) { const k = 2 + (r() < .5 ? 1 : 0), off = r(), b = []; for (let j = 0; j < k; j++) b.push(((j + (r() - .5) * .4) / k + off) % 1); b.sort((a, c) => a - c); br.push(b); }
    const M = N / rows;
    return yap(N, N, (u, v, o) => {
      const ri = Math.min(rows - 1, Math.floor(v * rows)), vy = v * rows - ri, b = br[ri];
      let j = b.length - 1; for (let q = 0; q < b.length; q++) if (b[q] <= u) j = q;
      const a0 = b[j], a1 = b[(j + 1) % b.length], dl = ((u - a0) + 1) % 1, dr = ((a1 - u) + 1) % 1;
      const ex = Math.min(dl, dr) * N, ey = Math.min(vy, 1 - vy) * M, id = hash(ri * 17 + j, seed);
      const fine = fbm(n, u, v, 16, 16, 4), big = fbm(n, u, v, 3, 3, 3), e = Math.min(ex, ey) + fbm(n, u, v, 12, 12, 3) * 9;
      const bev = smooth(2.2, 9, e);
      if (e < 2.2) { const m = .5 + fine * .3; o.h = .05 + fine * .05; set(o, mixC(t, [120, 115, 105], .45), m * (.85 + big * .4)); return; }
      o.h = bev * (.7 + (fine + .5) * .35) + hash(j, ri) * .1;
      const k = (.74 + id * .34) * (.84 + fine * .45) * (.9 + big * .35);
      set(o, [t[0] * (1 + (hash(id * 99, 3) - .5) * .12), t[1], t[2] * (1 + (hash(id * 77, 5) - .5) * .12)], k);
    }, { kabart: 3.2 });
  };

  // Tahta: uzun tahtalar, ek yerleri, damarlar, budaklar ve çiviler. dikey: tahtalar yukarıdan aşağı.
  function tahta(N, t, seed, dikey, rows = 5, kalin) {
    const n = gurultu(seed), r = rnd(seed + 2), joints = [];
    for (let i = 0; i < rows; i++) joints.push([r(), r() < .6 ? (r() * .5 + .25) : -1, r()]);
    const M = N / rows, knots = []; for (let i = 0; i < 4; i++) knots.push([r(), r(), 4 + r() * 6]);
    return yap(N, N, (u0, v0, o) => {
      const u = dikey ? v0 : u0, v = dikey ? u0 : v0;
      const ri = Math.min(rows - 1, Math.floor(v * rows)), vy = v * rows - ri, J = joints[ri];
      const p1 = J[0], p2 = J[1] >= 0 ? (J[0] + J[1]) % 1 : -1;
      const d1 = Math.min(Math.abs(u - p1), 1 - Math.abs(u - p1)), d2 = p2 < 0 ? 9 : Math.min(Math.abs(u - p2), 1 - Math.abs(u - p2));
      const seg = p2 < 0 ? 0 : ((u - p1 + 1) % 1) < ((p2 - p1 + 1) % 1) ? 1 : 2, sid = hash(ri * 7 + seg, seed);
      const ex = Math.min(d1, d2) * N, ey = Math.min(vy, 1 - vy) * M, gap = smooth(.6, 2.6, Math.min(ex, ey));
      const warp = fbm(n, u, v, 2, 4, 3) * 2.2;
      let ring = Math.sin((v * rows * 5 + warp + sid * 10 + u * 1.3) * Math.PI * 2);
      for (const [kx, ky, kr] of knots) { const dx = (Math.min(Math.abs(u - kx), 1 - Math.abs(u - kx))) * N, dy = (v - ky) * N, dd = Math.hypot(dx * .6, dy); if (dd < kr * 3) ring = Math.sin((dd / kr) * 3 + warp) * (1 - dd / (kr * 3)) + ring * dd / (kr * 3); }
      const grain = fbm(n, u + sid, v, 2, rows * 10, 3), line = smooth(.82, .98, ring) * .2;
      o.h = gap * (.55 + grain * .25 + (kalin ? .2 * Math.sin(vy * Math.PI) : 0));
      const k = (.7 + sid * .22 + grain * .32) * (1 - line) * (.35 + .65 * gap);
      set(o, [t[0] * (1 + (sid - .5) * .1), t[1], t[2] * (1 - (sid - .5) * .1)], k);
      // çiviler
      if (Math.min(d1, d2) * N < 9 && Math.min(d1, d2) * N > 3) { for (const yy of [.3, .7]) { const dy = (vy - yy) * M, dx = (Math.min(d1, d2) * N - 6); if (dx * dx + dy * dy < 2.4) { o.h = .9; set(o, [70, 66, 60]); } } }
      o.p = .05;
    }, { kabart: 2.4 });
  }
  MAT.tahta = (N, t, seed) => tahta(N, t, seed, false, 5);
  MAT.parke = (N, t, seed) => tahta(N, t, seed + 5, false, 8);
  MAT.tahtaDikey = (N, t, seed) => tahta(N, t, seed, true, 5, true);
  // Ahşap tavan: tahtalar ve karenin kenarında kalın bir kiriş.
  MAT.tavan = (N, t, seed) => {
    const plank = tahta(N, mulC(t, .9), seed, true, 4), x = plank.getContext("2d");
    const beam = tahta(N, mulC(t, .72), seed + 9, true, 1, true);
    const bw = N * .16; x.drawImage(beam, 0, 0, bw * 1.0, N, 0, 0, bw, N);
    const g = x.createLinearGradient(bw, 0, bw + N * .1, 0); g.addColorStop(0, "rgba(0,0,0,.55)"); g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g; x.fillRect(bw, 0, N * .1, N);
    x.fillStyle = "rgba(255,235,200,.10)"; x.fillRect(2, 0, 3, N);
    return plank;
  };

  // Döşeme taşı: düzensiz büyük taşlar, aralarda harç, çatlaklar.
  MAT.kaldirim = (N, t, seed) => {
    const n = gurultu(seed), c = hucre(seed, 4, .75);
    return yap(N, N, (u, v, o) => {
      const w = c(u + fbm(n, u, v, 4, 4, 2) * .03, v + fbm(n, v, u, 4, 4, 2) * .03), e = (w.d2 - w.d1) * N / 4, id = w.id;
      const fine = fbm(n, u, v, 20, 20, 4), big = fbm(n, u, v, 3, 3, 3), gr = smooth(1.2, 5, e + fine * 3);
      const crack = id > .55 && Math.abs(fbm(n, u + id, v, 5, 5, 4)) < .014 ? .55 : 1;
      o.h = gr * (.6 + (fine + .5) * .35);
      set(o, gr < .2 ? mixC(t, [70, 62, 50], .5) : t, (gr < .2 ? .5 : (.74 + id * .32) * (.86 + fine * .4) * (.92 + big * .3)) * crack);
    }, { kabart: 2.8 });
  };
  // Arnavut kaldırımı: yuvarlak taşlar, aralarda toprak.
  MAT.arnavut = (N, t, seed) => {
    const n = gurultu(seed), c = hucre(seed + 3, 9, .7);
    return yap(N, N, (u, v, o) => {
      const w = c(u, v), e = (w.d2 - w.d1) * N / 9, fine = fbm(n, u, v, 24, 24, 3), dome = Math.sqrt(smooth(0, 10, e + fine * 3));
      o.h = dome * (.85 + w.id * .3);
      if (e < 1.4) { set(o, [80, 70, 56], .8 + fine * .5); return; }
      set(o, [t[0] * (1 + (w.id - .5) * .18), t[1] * (1 + (hash(w.k, 3) - .5) * .1), t[2]], (.76 + w.id * .3) * (.88 + fine * .35));
      o.p = .08;
    }, { kabart: 3.4 });
  };
  // Çimen: renk lekeleri, yer yer toprak, sonra binlerce ot çizgisi.
  MAT.cimen = (N, t, seed) => {
    const n = gurultu(seed), dirt = [104, 84, 58], kuru = [t[0] * 1.35 + 30, t[1] * 1.15 + 10, t[2] * .7];
    const c = yap(N, N, (u, v, o) => {
      const big = fbm(n, u, v, 3, 3, 4), mid = fbm(n, u, v, 12, 12, 3), fine = fbm(n, u, v, 48, 48, 2);
      const bare = smooth(.22, .34, big + mid * .3);
      o.h = fine * .5 + mid * .4;
      const g = mixC(t, kuru, clamp(.35 + mid * 1.4));
      set(o, mixC(g, dirt, bare * .85), .78 + fine * .5 + big * .2);
    }, { kabart: 1.6 });
    const x = c.getContext("2d"), r = rnd(seed + 7);
    for (let i = 0; i < N * N / 22; i++) {
      const px = r() * N, py = r() * N, len = 2 + r() * 5, a = -Math.PI / 2 + (r() - .5) * 1.6, k = .65 + r() * .75;
      x.strokeStyle = `rgba(${t[0] * k | 0},${t[1] * k * 1.05 | 0},${t[2] * k | 0},${(.45 + r() * .4).toFixed(2)})`; x.lineWidth = .7 + r() * .6;
      for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { if (px + ox < -8 || px + ox > N + 8 || py + oy < -8 || py + oy > N + 8) continue; x.beginPath(); x.moveTo(px + ox, py + oy); x.lineTo(px + ox + Math.cos(a) * len, py + oy + Math.sin(a) * len); x.stroke(); }
    }
    return c;
  };
  // Toprak: kahverengi tonlar ve küçük çakıllar.
  MAT.toprak = (N, t, seed) => {
    const n = gurultu(seed), c = hucre(seed + 4, 14, 1);
    return yap(N, N, (u, v, o) => {
      const big = fbm(n, u, v, 4, 4, 4), fine = fbm(n, u, v, 40, 40, 3), w = c(u, v), peb = w.id > .55 ? smooth(.32, .18, w.d1) : 0;
      o.h = big * .4 + fine * .3 + peb * .8;
      set(o, mixC(t, [150, 140, 125], peb * .7), (.8 + big * .45 + fine * .3) * (1 + peb * .15));
    }, { kabart: 2 });
  };
  MAT.cakil = (N, t, seed) => {
    const n = gurultu(seed), c = hucre(seed + 8, 16, .9);
    return yap(N, N, (u, v, o) => {
      const w = c(u, v), e = (w.d2 - w.d1) * N / 16, fine = fbm(n, u, v, 32, 32, 2), d = Math.sqrt(smooth(0, 4, e));
      o.h = d; set(o, e < .8 ? [70, 62, 52] : [t[0] * (1 + (w.id - .5) * .3), t[1] * (1 + (w.id - .5) * .25), t[2] * (1 + (w.id - .5) * .2)], .8 + fine * .4);
    }, { kabart: 2.6 });
  };
  // Zorlu arazi: toprak üstünde irili ufaklı taşlar.
  MAT.kayalik = (N, t, seed) => {
    const n = gurultu(seed), big = hucre(seed + 5, 5, .9), sm = hucre(seed + 6, 15, 1), rock = [126, 120, 110];
    return yap(N, N, (u, v, o) => {
      const f = fbm(n, u, v, 6, 6, 4), fine = fbm(n, u, v, 36, 36, 2), a = big(u, v), ra = .34 + f * .12, inA = a.d1 < ra && a.id > .25;
      const b = sm(u, v), inB = !inA && b.d1 < .3 && b.id > .4;
      if (inA) { const d = 1 - a.d1 / ra; o.h = Math.sqrt(d) * 1.6 + fine * .2; set(o, mixC(rock, t, .35), (.7 + a.id * .35) * (.86 + fine * .35)); o.p = .06; return; }
      if (inB) { const d = 1 - b.d1 / .3; o.h = Math.sqrt(d) * .7; set(o, mixC(rock, t, .5), .8 + b.id * .3); return; }
      o.h = f * .3 + fine * .2; set(o, t, .72 + f * .5 + fine * .3);
    }, { kabart: 3 });
  };
  // Su: derinlik tonları, ışık kırılması desenleri ve dalga parıltısı.
  MAT.su = (N, t, seed) => {
    const n = gurultu(seed), c = hucre(seed + 7, 6, 1), deep = mulC(t, .55), light = mixC(t, [210, 240, 245], .45);
    return yap(N, N, (u, v, o) => {
      const w1 = fbm(n, u, v, 3, 3, 4), wu = u + fbm(n, u, v, 4, 4, 2) * .06, wv = v + fbm(n, v, u, 4, 4, 2) * .06, w = c(wu, wv);
      const ca = 1 - smooth(0, .09, w.d2 - w.d1);
      o.h = fbm(n, u, v, 8, 8, 3) * .6;
      set(o, mixC(mixC(deep, t, clamp(.5 + w1 * 1.2)), light, ca * .5), 1);
      o.p = .55;
    }, { kabart: 1.3, ortam: .6 });
  };
  // Lav: kararmış kabuk plakaları ve aralarından parlayan erimiş kaya.
  MAT.lav = (N, t, seed) => {
    const n = gurultu(seed), c = hucre(seed + 9, 5, .9), hot = [255, 222, 120], crust = [44, 34, 30];
    return yap(N, N, (u, v, o) => {
      const f = fbm(n, u, v, 6, 6, 4), w = c(u + f * .05, v - f * .05), e = w.d2 - w.d1 + f * .05, cr = 1 - smooth(.015, .1, e), core = 1 - smooth(0, .035, e);
      const fine = fbm(n, u, v, 32, 32, 3);
      o.h = smooth(0, .2, e) * (.6 + fine * .4);
      set(o, mixC(crust, [90, 40, 25], cr * .8), .75 + fine * .6 + f * .3);
      const glow = mixC(t, hot, core); o.er = glow[0] * cr; o.eg = glow[1] * cr * .9; o.eb = glow[2] * cr * .6;
    }, { kabart: 2.4 });
  };
  // Kum: rüzgâr dalgacıkları ve ince taneler.
  MAT.kum = (N, t, seed) => {
    const n = gurultu(seed);
    return yap(N, N, (u, v, o) => {
      const warp = fbm(n, u, v, 3, 3, 3), rip = Math.sin((v * 12 + u * 2 + warp * 1.6) * PI2), grain = fbm(n, u, v, 64, 64, 2), big = fbm(n, u, v, 2, 2, 3);
      o.h = rip * .35 + grain * .15;
      set(o, t, .9 + grain * .25 + big * .25 + rip * .03);
    }, { kabart: 1.8, ortam: .5 });
  };
  // Kar: yumuşak tümsekler, mavimsi gölgeler, parıltılar.
  MAT.kar = (N, t, seed) => {
    const n = gurultu(seed), shadow = [170, 190, 215];
    return yap(N, N, (u, v, o) => {
      const big = fbm(n, u, v, 3, 3, 5), fine = fbm(n, u, v, 48, 48, 2);
      o.h = big * 1.2 + fine * .1;
      set(o, mixC(t, shadow, clamp(.2 - big)), .96 + fine * .08);
      if (hash((u * 997) | 0, (v * 991) | 0) > .995) { o.er = o.eg = o.eb = 40; }
      o.p = .15;
    }, { kabart: 2.2, ortam: .55 });
  };
  // Metal plakalar: 2×2 plaka, perçinler, fırçalanmış yüzey, lekeler.
  MAT.metal = (N, t, seed) => {
    const n = gurultu(seed), P = N / 2;
    return yap(N, N, (u, v, o) => {
      const x = u * N, y = v * N, px = x % P, py = y % P, pid = hash(Math.floor(x / P), Math.floor(y / P) + seed), e = Math.min(px, py, P - px, P - py);
      const brush = n(u * 3, v * 160, 3, 160) * .5 + n(u * 6, v * 320, 6, 320) * .3, stain = fbm(n, u, v, 4, 4, 4);
      let h = smooth(1, 4, e) * .8; let k = (.82 + pid * .16 + brush * .12) * (.9 + stain * .3);
      for (const [rx, ry] of [[9, 9], [P - 9, 9], [9, P - 9], [P - 9, P - 9]]) { const d = Math.hypot(px - rx, py - ry); if (d < 3.2) { h = .8 + Math.sqrt(1 - d * d / 10.24) * .7; k *= 1.08; } }
      if (e < 1) k *= .45;
      o.h = h; set(o, t, k); o.p = .45;
    }, { kabart: 2.6 });
  };
  // Kaya yüzeyi: mağara zemini ve duvarı için sırtlı, damarlı taş.
  MAT.kaya = (N, t, seed) => {
    const n = gurultu(seed);
    return yap(N, N, (u, v, o) => {
      const f = fbm(n, u, v, 4, 4, 5), rid = 1 - Math.abs(fbm(n, u + .3, v, 6, 6, 4)) * 2.2, fine = fbm(n, u, v, 40, 40, 2);
      o.h = f * .8 + rid * .5 + fine * .15;
      set(o, [t[0] * (1 + f * .2), t[1], t[2] * (1 - f * .15)], .72 + f * .45 + rid * .18 + fine * .25);
    }, { kabart: 3 });
  };
  // Mermer karolar: açık ve koyu karolar damalı, damarlı.
  MAT.mermer = (N, t, seed) => {
    const n = gurultu(seed), k = 4, M = N / k, dark = mulC(t, .28);
    return yap(N, N, (u, v, o) => {
      const tx = Math.floor(u * k), ty = Math.floor(v * k), px = u * N % M, py = v * N % M, e = Math.min(px, py, M - px, M - py);
      const vein = Math.abs(Math.sin((u * 3 + v * 2 + fbm(n, u, v, 4, 4, 5) * 2.4) * Math.PI)), vl = 1 - smooth(0, .06, vein), clouds = fbm(n, u, v, 6, 6, 4);
      const base = (tx + ty) % 2 ? dark : t;
      o.h = smooth(.5, 2, e) * .6; set(o, mixC(base, (tx + ty) % 2 ? [150, 145, 140] : [120, 115, 110], vl * .45), (e < .8 ? .5 : 1) * (.92 + clouds * .2)); o.p = .5;
    }, { kabart: 2 });
  };
  // Kiremit çatı (üstten): sıra sıra, her sıra bir üsttekinin altından çıkar.
  MAT.kiremit = (N, t, seed) => {
    const n = gurultu(seed), rows = 8, cols = 8;
    return yap(N, N, (u, v, o) => {
      const ri = Math.floor(v * rows), vy = v * rows - ri, uu = u * cols + (ri % 2) * .5, ci = Math.floor(uu), ux = uu - ci, id = hash(ci % cols, ri);
      const fine = fbm(n, u, v, 24, 24, 3), curve = Math.cos((ux - .5) * Math.PI);
      o.h = (1 - vy) * .6 + curve * .5 + fine * .1;
      set(o, [t[0] * (1 + (id - .5) * .2), t[1] * (1 + (id - .5) * .15), t[2]], (.72 + id * .3) * (.55 + .45 * smooth(0, .25, 1 - vy)) * (.9 + fine * .3) * (ux < .04 || ux > .96 ? .6 : 1));
    }, { kabart: 2.6 });
  };
  // Ağaç kabuğu: dikey yarıklar.
  MAT.kabuk = (N, t, seed) => {
    const n = gurultu(seed);
    return yap(N, N, (u, v, o) => {
      const rid = 1 - Math.abs(fbm(n, u, v, 10, 2, 4)) * 2.6, fine = fbm(n, u, v, 30, 8, 2);
      o.h = clamp(rid) * .9 + fine * .2; set(o, t, .5 + clamp(rid) * .55 + fine * .25);
    }, { kabart: 3.4 });
  };
  // Halı: kenarı süslü, yumuşak dokulu.
  MAT.hali = (N, t, seed) => {
    const n = gurultu(seed), gold = [201, 166, 90], navy = [40, 52, 86];
    return yap(N, N, (u, v, o) => {
      const fine = fbm(n, u, v, 64, 64, 2), x = Math.abs(u - .5), y = Math.abs(v - .5), dm = x + y;
      let c = t; if (Math.abs(dm - .3) < .025 || Math.abs(dm - .12) < .02) c = gold; else if (dm < .1) c = navy; else if (Math.max(x, y) > .46) c = navy; else if (Math.max(x, y) > .43) c = gold;
      o.h = fine * .3; set(o, c, .85 + fine * .3);
    }, { kabart: 1.2, ortam: .6 });
  };

  function doku(ad, renk, boyut = 256) {
    if (!MAT[ad]) ad = "tas";
    const t = rgb(renk || VARS[ad] || VARS[ad.replace(/Dikey$/, "")] || "#808080"), key = ad + "|" + t.map(x => x | 0).join(",") + "|" + boyut;
    return cache[key] || (cache[key] = MAT[ad](boyut, t, (ad.length * 131 + 7) % 997));
  }
  const desenler = new WeakMap();
  function desen(ctx, ad, renk, kare, kac = 2) {
    let m = desenler.get(ctx); if (!m) desenler.set(ctx, m = {});
    const key = ad + "|" + renk + "|" + kare + "|" + kac; if (m[key]) return m[key];
    const c = doku(ad, renk), p = ctx.createPattern(c, "repeat");
    if (p.setTransform && typeof DOMMatrix !== "undefined") p.setTransform(new DOMMatrix().scale(kare * kac / c.width));
    return m[key] = p;
  }
  function veri(ad, renk, boyut = 128) {
    const c = doku(ad, renk, boyut), x = c.getContext("2d");
    return { w: c.width, h: c.height, data: new Uint32Array(x.getImageData(0, 0, c.width, c.height).data.buffer.slice(0)) };
  }

  /* ---------- tekil görseller (saydam) ---------- */
  const SPR = {};
  // Üstten yapraklı ağaç: kenarı yapraklı tepe, yaprak kümeleri, üstten ışık.
  SPR.agac = (t, seed, N = 192) => {
    const n = gurultu(seed), c = hucre(seed + 11, 7, 1), dark = mulC(t, .5), light = mixC(t, [200, 220, 120], .3);
    return yap(N, N, (u, v, o) => {
      const dx = (u - .5) * 2, dy = (v - .5) * 2, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const R = .8 + fbm(n, .5 + Math.cos(a) * .3, .5 + Math.sin(a) * .3, 3, 3, 3) * .35, leaf = fbm(n, u, v, 40, 40, 2);
      const w = c(u, v), cl = 1 - smooth(0, .6, w.d1), edge = r + leaf * .1 - R;
      o.a = smooth(.02, -.04, edge) * (edge > -.12 ? clamp(.6 + leaf * 3 + cl * .4) : 1);
      const dome = Math.sqrt(Math.max(0, 1 - Math.min(1, r / R) ** 2));
      o.h = dome * .9 + cl * .45 + leaf * .35;
      set(o, mixC(mixC(dark, t, clamp(cl * 1.2)), light, clamp(cl - .5 + leaf)), .8 + leaf * .4 - r * .15);
    }, { kabart: 5, karo: false, ortam: .3 });
  };
  // Üstten çam: yıldız gibi dallar; karlı: üstü beyaz.
  function cam(t, seed, karli, N = 192) {
    const n = gurultu(seed), dark = mulC(t, .5), arms = 9 + (seed % 3);
    return yap(N, N, (u, v, o) => {
      const dx = (u - .5) * 2, dy = (v - .5) * 2, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx), wob = fbm(n, u, v, 6, 6, 2);
      const arm = Math.pow(Math.abs(Math.cos((a * arms + wob * 2.5 + r * 3) / 2)), .6), R = .62 + arm * .34, needle = fbm(n, u, v, 48, 48, 2);
      const edge = r + needle * .12 - R;
      o.a = smooth(.02, -.05, edge);
      o.h = (1 - Math.min(1, r)) * 1.2 + arm * .3 + needle * .3;
      let col = mixC(dark, t, clamp(arm * .8 + needle));
      if (karli) { const s = clamp((arm - .35) * 2 + needle * 2 - r * .5); col = mixC(col, [236, 242, 246], s * .85); }
      set(o, col, .85 + needle * .3);
    }, { kabart: 5, karo: false, ortam: .3 });
  }
  SPR.cam = (t, seed) => cam(t, seed, false);
  SPR.karliCam = (t, seed) => cam(t, seed, true);
  // Üstten kaya.
  SPR.kaya = (t, seed, N = 128) => {
    const n = gurultu(seed);
    return yap(N, N, (u, v, o) => {
      const dx = (u - .5) * 2, dy = (v - .5) * 2, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const R = .78 + fbm(n, .5 + Math.cos(a) * .3, .5 + Math.sin(a) * .3, 3, 3, 3) * .45, f = fbm(n, u, v, 6, 6, 4), rid = 1 - Math.abs(fbm(n, u, v, 8, 8, 3)) * 2;
      o.a = smooth(.01, -.03, r - R); const dome = Math.sqrt(Math.max(0, 1 - Math.min(1, r / R) ** 2));
      o.h = dome * 1.3 + f * .3 + rid * .2; set(o, t, .72 + f * .4 + rid * .15); o.p = .08;
    }, { kabart: 5, karo: false, ortam: .3 });
  };
  // Yandan ağaç (birinci şahıs): kabuklu gövde, kökler, kümeli yapraklar.
  SPR.agacYan = (t, seed, W = 192, H = 288) => {
    const n = gurultu(seed), c = hucre(seed + 12, 6, 1), bark = [92, 68, 48], dark = mulC(t, .45), light = mixC(t, [210, 230, 130], .3);
    return yap(W, H, (u, v, o) => {
      const fine = fbm(n, u, v, 40, 60, 2);
      // yapraklar: merkezi (0.5, 0.36) elips
      const dx = (u - .5) / .47, dy = (v - .37) / .36, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const R = .82 + fbm(n, .5 + Math.cos(a) * .3, .5 + Math.sin(a) * .3, 3, 3, 3) * .4, w = c(u, v * 1.5 % 1), cl = 1 - smooth(0, .6, w.d1);
      const edge = r + fine * .12 - R, inLeaf = smooth(.02, -.05, edge);
      // gövde
      const tw = .055 + Math.max(0, v - .5) * .05 + Math.pow(Math.max(0, v - .9) * 10, 2) * .05, tx = (u - .5 - fbm(n, 0, v, 1, 3, 2) * .03) / tw;
      const inTrunk = v > .42 && v < .985 && Math.abs(tx) < 1 ? 1 : 0;
      if (inLeaf > .01) {
        const dome = Math.sqrt(Math.max(0, 1 - Math.min(1, r / R) ** 2));
        o.h = dome * .8 + cl * .5 + fine * .35; o.a = inLeaf * (edge > -.1 ? clamp(.6 + fine * 3 + cl * .4) : 1);
        set(o, mixC(mixC(dark, t, clamp(cl * 1.2)), light, clamp(cl - .5 + fine)), (.85 + fine * .4) * (1 - smooth(.1, .9, dy) * .35));
        if (o.a < .5 && inTrunk) { o.a = 1; o.h = Math.sqrt(1 - tx * tx); set(o, bark, .35); }
        return;
      }
      if (inTrunk) { const rid = 1 - Math.abs(fbm(n, u * 3, v, 10, 3, 3)) * 2.5; o.h = Math.sqrt(1 - tx * tx) * 1.2 + clamp(rid) * .25; set(o, bark, .55 + clamp(rid) * .45 + fine * .2); return; }
      o.a = 0;
    }, { kabart: 4, karo: false, ortam: .32 });
  };
  // Yandan çam (birinci şahıs, karlı haritalar için de kullanılabilir).
  SPR.camYan = (t, seed, W = 160, H = 288) => {
    const n = gurultu(seed), dark = mulC(t, .45), bark = [86, 62, 44];
    return yap(W, H, (u, v, o) => {
      const fine = fbm(n, u, v, 30, 50, 2), lv = (v - .04) / .82, tiers = 6, ti = lv * tiers, tf = ti - Math.floor(ti);
      const half = lv > 0 && lv < 1 ? (.08 + lv * .38) * (.55 + tf * .45) + fine * .05 : 0, dx = Math.abs(u - .5);
      if (dx < half) { o.h = (1 - dx / half) * .8 + tf * .4 + fine * .3; set(o, mixC(dark, t, clamp(tf + fine)), .8 + fine * .3); return; }
      if (v > .8 && v < .985 && dx < .045) { o.h = 1 - dx / .045; set(o, bark, .6 + fine * .3); return; }
      o.a = 0;
    }, { kabart: 4, karo: false, ortam: .32 });
  };
  // Çukur (üstten bir kare): kaya kenarı ve karanlık derinlik.
  SPR.cukur = (t, seed, N = 128) => {
    const n = gurultu(seed), c = hucre(seed + 13, 8, 1), rock = rgb(VARS.kaya);
    return yap(N, N, (u, v, o) => {
      const dx = (u - .5) * 2, dy = (v - .5) * 2, r = Math.max(Math.abs(dx), Math.abs(dy)) * .6 + Math.hypot(dx, dy) * .4, f = fbm(n, u, v, 4, 4, 3), R = .7 + f * .18;
      if (r < R) { const d = 1 - r / R; o.h = -d; set(o, mixC(t, [0, 0, 0], .5), Math.max(.03, .5 - d * .9)); return; }
      const w = c(u, v), e = (w.d2 - w.d1) * 8 * N / 128;
      o.h = Math.sqrt(smooth(0, 5, e)) * .8 + f * .2; set(o, rock, e < .8 ? .45 : (.75 + w.id * .3));
    }, { kabart: 3, karo: false });
  };
  // Merdiven (üstten bir kare): beş basamak, yukarı doğru yükselir.
  SPR.merdiven = (t, seed, N = 128) => {
    const n = gurultu(seed), steps = 5;
    return yap(N, N, (u, v, o) => {
      const si = Math.floor(v * steps), f = v * steps - si, fine = fbm(n, u, v, 16, 16, 3), side = u < .08 || u > .92;
      if (side) { o.h = 3; set(o, mulC(t, .6), .8 + fine * .3); return; }
      o.h = (steps - si) * .5 - f * .05; set(o, t, (.75 + fine * .35) * (f > .82 ? .55 : 1) * (1 - si * .05));
    }, { kabart: 2.2, karo: false });
  };
  // Kapı (üstten bir kare): taş eşik ve tahta kanat.
  SPR.kapiUst = (t, seed, N = 128) => {
    const plank = doku("tahtaDikey", t, 128), c = tuval(N, N), x = c.getContext("2d");
    x.fillStyle = "#57524b"; x.fillRect(0, 0, N, N);
    x.drawImage(doku("tas", "#7a756c", 128), 0, 0, N, N);
    x.fillStyle = "rgba(0,0,0,.5)"; x.fillRect(N * .14, N * .3, N * .72, N * .4);
    x.drawImage(plank, 0, 0, 128, 128, N * .16, N * .33, N * .68, N * .34);
    x.fillStyle = "rgba(30,28,26,.85)"; x.fillRect(N * .16, N * .41, N * .68, 4); x.fillRect(N * .16, N * .58, N * .68, 4);
    x.fillStyle = "#c8a24a"; x.beginPath(); x.arc(N * .74, N * .5, 3.2, 0, PI2); x.fill();
    return c;
  };

  function sprite(ad, renk, cesit = 0) {
    const f = SPR[ad] || SPR.kaya, def = { agac: "#4d7a34", cam: "#2f5a3a", karliCam: "#2f5a3a", kaya: "#7d776f", agacYan: "#4d7a34", camYan: "#2f5a3a", cukur: "#3a3430", merdiven: "#8f8576", kapiUst: "#7a5030" }[ad] || "#808080";
    const t = rgb(renk || def), key = "s|" + ad + "|" + t.map(x => x | 0).join(",") + "|" + cesit;
    return cache[key] || (cache[key] = f(t, 101 + cesit * 37 + ad.length * 13));
  }

  // Birinci şahıs kapı yüzü: taş duvar içinde kemerli, demir kuşaklı ahşap kapı.
  function kapi(renk, duvar, N = 256) {
    const key = "kapi|" + renk + "|" + duvar; if (cache[key]) return cache[key];
    const c = tuval(N, N), x = c.getContext("2d");
    x.drawImage(doku("tas", duvar, N), 0, 0);
    const L0 = N * .2, R0 = N * .8, T0 = N * .34, rad = (R0 - L0) / 2;
    const arch = (g) => { x.beginPath(); x.moveTo(L0 - g, N); x.lineTo(L0 - g, T0); x.arc(N / 2, T0, rad + g, Math.PI, 0); x.lineTo(R0 + g, N); x.closePath(); };
    // çerçeve taşları
    x.save(); arch(N * .055); x.clip(); x.drawImage(doku("kaldirim", mixC(rgb(duvar), [200, 190, 170], .35), N), 0, 0); x.fillStyle = "rgba(255,240,210,.08)"; x.fillRect(0, 0, N, N); x.restore();
    x.save(); arch(N * .055); x.lineWidth = 3; x.strokeStyle = "rgba(0,0,0,.45)"; x.stroke(); x.restore();
    // kanat
    x.save(); arch(0); x.clip(); x.drawImage(doku("tahtaDikey", renk, N), 0, 0);
    const sh = x.createLinearGradient(0, T0 - rad, 0, N); sh.addColorStop(0, "rgba(0,0,0,.35)"); sh.addColorStop(.4, "rgba(0,0,0,.05)"); sh.addColorStop(1, "rgba(0,0,0,.2)"); x.fillStyle = sh; x.fillRect(0, 0, N, N);
    for (const yy of [.46, .84]) { const y = N * yy; x.fillStyle = "#2b2a28"; x.fillRect(L0, y, R0 - L0, N * .04); x.fillStyle = "rgba(255,255,255,.12)"; x.fillRect(L0, y, R0 - L0, 1.5);
      for (let k = 0; k < 6; k++) { const px = L0 + (k + .5) * (R0 - L0) / 6; x.fillStyle = "#4a4642"; x.beginPath(); x.arc(px, y + N * .02, 2.4, 0, PI2); x.fill(); x.fillStyle = "rgba(255,255,255,.35)"; x.beginPath(); x.arc(px - .7, y + N * .02 - .7, .9, 0, PI2); x.fill(); } }
    x.restore();
    x.save(); arch(0); x.lineWidth = 4; x.strokeStyle = "rgba(0,0,0,.6)"; x.stroke(); x.restore();
    // halka kulp
    x.strokeStyle = "#2a2826"; x.lineWidth = 3.2; x.beginPath(); x.arc(N * .68, N * .64, N * .035, 0, PI2); x.stroke();
    x.strokeStyle = "rgba(220,200,160,.5)"; x.lineWidth = 1; x.beginPath(); x.arc(N * .68, N * .64, N * .035, Math.PI * 1.1, Math.PI * 1.6); x.stroke();
    x.fillStyle = "#2a2826"; x.beginPath(); x.arc(N * .68, N * .6, 3, 0, PI2); x.fill();
    return cache[key] = c;
  }

  // Bulut yoğunluğu (0..1); yatayda w ile sarılır.
  function bulut(w, h, tur) {
    const n = gurultu(tur === "dusk" ? 71 : 53), out = new Float32Array(w * h), fx = 12, fy = 2;
    for (let y = 0; y < h; y++) { const v = y / h; for (let x = 0; x < w; x++) { const u = x / w;
      const d = fbm(n, u, v * .999, fx, fy, 6, .55) + fbm(n, u + .37, v, 3, 1, 2) * .5;
      out[y * w + x] = smooth(.02, .45, d) * (.55 + .45 * smooth(.95, .3, v)); } }
    return out;
  }

  // İki rengi karıştırır (tema rengini gerçekçi malzeme rengine yaklaştırmak için): "rgb(r,g,b)"
  const karis = (a, b, t) => { const c = mixC(rgb(a), rgb(b), t); return `rgb(${c.map(v => Math.round(v)).join(",")})`; };
  const api = { doku, desen, veri, sprite, kapi, bulut, rgb, karis, VARS, gurultu, fbm, hucre };
  root.ZMDoku = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
