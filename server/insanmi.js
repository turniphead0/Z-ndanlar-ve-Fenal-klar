// "İnsan mısın?" sınaması: sunucunun kendisinin çizdiği, harfleri eğilmiş ve gürültülü küçük bir PNG resim.
// Dışarıdan hiçbir hizmet (reCAPTCHA vb.) kullanılmaz, ücretsizdir ve kimsenin verisi başka yere gitmez.
// Harfler resmin piksellerinde durur (SVG/HTML metni değil), yani sayfayı okuyan basit bir bot cevabı bulamaz.
const crypto = require("crypto");
const zlib = require("zlib");

// Birbirine benzeyen harfler (0/O, 1/I/L, 2/Z, 5/S, 8/B, G/6, F/P, K/R) yok.
const HARF = {
  A: "01110 10001 10001 11111 10001 10001 10001", C: "01111 10000 10000 10000 10000 10000 01111",
  D: "11110 10001 10001 10001 10001 10001 11110", E: "11111 10000 10000 11110 10000 10000 11111",
  H: "10001 10001 10001 11111 10001 10001 10001",
  J: "00111 00010 00010 00010 00010 10010 01100",
  M: "10001 11011 10101 10101 10001 10001 10001", N: "10001 11001 10101 10011 10001 10001 10001",
  P: "11110 10001 10001 11110 10000 10000 10000", R: "11110 10001 10001 11110 10100 10010 10001",
  T: "11111 00100 00100 00100 00100 00100 00100", U: "10001 10001 10001 10001 10001 10001 01110",
  V: "10001 10001 10001 10001 10001 01010 00100", W: "10001 10001 10001 10101 10101 10101 01010",
  X: "10001 10001 01010 00100 01010 10001 10001", Y: "10001 10001 01010 00100 00100 00100 00100",
  3: "11110 00001 00001 01110 00001 00001 11110", 4: "00010 00110 01010 10010 11111 00010 00010",
  7: "11111 00001 00010 00100 01000 01000 01000", 9: "01110 10001 10001 01111 00001 00001 01110",
};
const KARAKTER = Object.keys(HARF);
const IZGARA = Object.fromEntries(KARAKTER.map(k => [k, HARF[k].split(" ").map(r => [...r].map(Number))]));

const rnd = (a, b) => a + Math.random() * (b - a);
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(buf) { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function parca(tur, veri) {
  const b = Buffer.alloc(12 + veri.length), t = Buffer.from(tur, "ascii");
  b.writeUInt32BE(veri.length, 0); t.copy(b, 4); veri.copy(b, 8);
  b.writeUInt32BE(crc32(Buffer.concat([t, veri])), 8 + veri.length);
  return b;
}
function png(w, h, rgb) {
  const ham = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { ham[y * (w * 3 + 1)] = 0; rgb.copy(ham, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), parca("IHDR", ihdr), parca("IDAT", zlib.deflateSync(ham)), parca("IEND", Buffer.alloc(0))]);
}

const hucre = (g, x, y) => x >= 0 && x < 5 && y >= 0 && y < 7 && g[y][x] === 1;
const dolu = (g, u, v) => { const K = 0.22; for (const du of [-K, 0, K]) for (const dv of [-K, 0, K]) if (hucre(g, Math.floor(u + du), Math.floor(v + dv))) return true; return false; };

// Verilen metni çizer ve PNG döndürür. Her harf ayrı döner, büyür/küçülür; bütün resim dalgalanır.
function ciz(metin, w = 240, h = 80) {
  const rgb = Buffer.alloc(w * h * 3);
  const zemin = [rnd(228, 248), rnd(228, 248), rnd(222, 244)];
  for (let i = 0; i < w * h; i++) { const g = rnd(-5, 5); rgb[i * 3] = zemin[0] + g; rgb[i * 3 + 1] = zemin[1] + g; rgb[i * 3 + 2] = zemin[2] + g; }
  const nokta = (x, y, r) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= w || y >= h) return; const i = (y * w + x) * 3; rgb[i] = r[0]; rgb[i + 1] = r[1]; rgb[i + 2] = r[2]; };
  const koyu = () => [rnd(10, 110), rnd(10, 110), rnd(10, 110)];
  // Arka planda harflerle aynı renkte birkaç eğri çizgi (harfleri ayırmayı zorlaştırır).
  const egri = renk => {
    const a = rnd(10, h - 10), b = rnd(10, h - 10), f = rnd(0.02, 0.06), kal = rnd(1, 2);
    for (let x = 0; x < w; x++) { const y = a + (b - a) * x / w + Math.sin(x * f) * 8; for (let t = 0; t < kal; t++) nokta(x, y + t, renk); }
  };
  for (let i = 0; i < 2; i++) egri(koyu());
  const n = metin.length, adim = (w - 24) / n;
  const dalgaA = rnd(2, 4), dalgaF = rnd(0.05, 0.1), dalgaF2 = rnd(0.06, 0.12);
  for (let k = 0; k < n; k++) {
    const g = IZGARA[metin[k]], renk = koyu();
    const cx = 12 + adim * (k + 0.5) + rnd(-3, 3), cy = h / 2 + rnd(-5, 5);
    const aci = rnd(-0.4, 0.4), olc = rnd(6.4, 7.8), egim = rnd(-0.25, 0.25);
    const cos = Math.cos(aci), sin = Math.sin(aci);
    const yar = 36;
    for (let y = Math.max(0, cy - yar | 0); y < Math.min(h, cy + yar); y++) for (let x = Math.max(0, cx - yar | 0); x < Math.min(w, cx + yar); x++) {
      // Dalgalanmayı ters uygula, sonra harfin kendi dönüşünü geri al.
      const dx = x + Math.sin(y * dalgaF) * dalgaA - cx, dy = y + Math.sin(x * dalgaF2) * dalgaA - cy;
      let u = (dx * cos + dy * sin) / olc, v = (-dx * sin + dy * cos) / olc;
      u += v * egim;
      // Çizgiler hücreden biraz kalın çizilir (dönünce kopmasın, okunaklı kalsın).
      if (dolu(g, u + 2.5, v + 3.5)) nokta(x, y, renk);
    }
  }
  egri(koyu());
  for (let i = 0; i < w * h * 0.02; i++) nokta(rnd(0, w), rnd(0, h), Math.random() < 0.5 ? koyu() : zemin.map(c => c - 60));
  return png(w, h, rgb);
}

// Sınamalar bellekte durur; her biri bir kez kullanılır ve 10 dakika geçerlidir.
function kurInsanMi({ omur = 10 * 60 * 1000, uzunluk = 5, enCok = 5000 } = {}) {
  const sinamalar = new Map(); // id -> { cevap, son }
  function yeni() {
    const now = Date.now();
    for (const [id, s] of sinamalar) if (s.son < now) sinamalar.delete(id);
    while (sinamalar.size >= enCok) sinamalar.delete(sinamalar.keys().next().value);
    let cevap = ""; for (let i = 0; i < uzunluk; i++) cevap += KARAKTER[crypto.randomInt(KARAKTER.length)];
    const id = crypto.randomBytes(12).toString("hex");
    sinamalar.set(id, { cevap, son: now + omur });
    return { id, resim: "data:image/png;base64," + ciz(cevap).toString("base64"), cevap };
  }
  // Doğruysa true. Doğru da yanlış da olsa sınama silinir (aynı resim ikinci kez denenemez).
  function dogrula(id, cevap) {
    const s = sinamalar.get(String(id || ""));
    if (!s) return false;
    sinamalar.delete(String(id));
    if (s.son < Date.now()) return false;
    const c = String(cevap || "").toUpperCase().replace(/\s+/g, "").replace(/0/g, "O");
    const a = Buffer.from(c), b = Buffer.from(s.cevap);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  return { yeni, dogrula, boyut: () => sinamalar.size };
}

module.exports = { kurInsanMi, ciz };
