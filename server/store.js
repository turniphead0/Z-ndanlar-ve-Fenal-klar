// Belge deposu: "a/b/c" yollarıyla saklanan JSON belgeleri. Koleksiyon = belgenin üst yolu.
// Bellekte tutulur, değişiklikler kısa bir gecikmeyle diske yazılır (atomik: önce .tmp, sonra rename).
//
// Performans: her belge bellekte JSON metni olarak da saklanır (this.json). Böylece
//  - diske yazarken yalnızca değişen belgeler yeniden JSON'a çevrilir, gerisi hazır metinden birleştirilir;
//  - get/list kopyayı tek bir JSON.parse ile üretir (eskiden stringify + parse);
//  - abonelere giden değişiklik mesajları hazır metni doğrudan kullanabilir (jsonOf).
// Diske yazma arka planda (asenkron) yapılır, böylece büyük bir veritabanı yazılırken sunucu donmaz.
const fs = require("fs");
const path = require("path");

const parentOf = p => p.split("/").slice(0, -1).join("/");
const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

function deepMerge(a, b) {
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" && !Array.isArray(a[k])) deepMerge(a[k], v);
    else a[k] = v;
  }
  return a;
}

const YAZMA_GECIKMESI = 1000; // son değişiklikten sonra bu kadar bekle…
const EN_GEC = 5000; // …ama sürekli değişiklik olsa da en geç bu kadar sürede bir diske yaz

class Store {
  constructor(file) {
    this.file = file;
    this.json = new Map(); // yol -> verinin JSON metni (nesne olarak tutulmaz; bellek iki kat harcanmasın)
    this.byCol = new Map(); // koleksiyon yolu -> Set(belge yolu)
    this.listeners = new Set(); // (type, path, data) => void
    this.timer = null;
    this.ilkBekleyen = 0; // yazılmayı bekleyen ilk değişikliğin zamanı
    this.yaziyor = false; // asenkron yazma sürüyor mu
    this.yineYaz = false; // yazma sürerken yeni değişiklik geldi mi
    this.surum = 0; // her değişiklikte artar
    if (file && fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const [p, d] of Object.entries(raw.docs || {})) this._put(p, d);
    }
  }
  _put(p, d, j) {
    this.json.set(p, j === undefined ? JSON.stringify(d) : j);
    const c = parentOf(p);
    if (!this.byCol.has(c)) this.byCol.set(c, new Set());
    this.byCol.get(c).add(p);
  }
  _drop(p) {
    this.json.delete(p);
    const s = this.byCol.get(parentOf(p));
    if (s) { s.delete(p); if (!s.size) this.byCol.delete(parentOf(p)); }
  }
  _kopya(p) { const j = this.json.get(p); return j === undefined ? undefined : JSON.parse(j); }
  has(p) { return this.json.has(p); }
  get(p) { return this._kopya(p); }
  // Belgenin JSON metni (abonelere mesaj hazırlarken kopyalamadan kullanmak için).
  jsonOf(p) { return this.json.get(p); }
  // Koleksiyondaki belge sayısı (belgeleri kopyalamadan).
  count(col) { const s = this.byCol.get(col); return s ? s.size : 0; }
  // Koleksiyondaki belge yolları (belgeleri kopyalamadan).
  paths(col) { return [...(this.byCol.get(col) || [])]; }
  list(col) { return this.paths(col).map(p => ({ id: p.split("/").pop(), path: p, data: this._kopya(p) })); }
  set(p, d) {
    const type = this.json.has(p) ? "modified" : "added";
    const j = JSON.stringify(d);
    if (j === undefined) { const e = new Error("Geçersiz belge"); e.code = "invalid_argument"; throw e; }
    this._put(p, null, j);
    this._emit(type, p);
  }
  update(p, patch) {
    if (!this.json.has(p)) { const e = new Error("Belge bulunamadı"); e.code = "not_found"; throw e; }
    const d = deepMerge(this._kopya(p), clone(patch));
    this._put(p, d);
    this._emit("modified", p);
  }
  delete(p) {
    if (!this.json.has(p)) return;
    const old = this.json.get(p);
    this._drop(p);
    this._emit("removed", p, old);
  }
  _emit(type, p, oldJson) {
    this.surum++;
    if (this.listeners.size) {
      const j = type === "removed" ? oldJson : this.json.get(p);
      const data = JSON.parse(j);
      for (const fn of this.listeners) { try { fn(type, p, data, j); } catch (e) { console.error(e); } }
    }
    this._schedule();
  }
  _schedule() {
    if (!this.file) return;
    const now = Date.now();
    if (!this.ilkBekleyen) this.ilkBekleyen = now;
    if (this.yaziyor) { this.yineYaz = true; return; }
    clearTimeout(this.timer);
    const bekle = Math.max(0, Math.min(YAZMA_GECIKMESI, this.ilkBekleyen + EN_GEC - now));
    this.timer = setTimeout(() => { this.timer = null; this._yazArkada(); }, bekle);
    if (this.timer.unref) this.timer.unref();
  }
  _metin() {
    // Hazır JSON metinlerinden birleştir: yalnızca değişen belgeler yeniden çevrildi.
    const parca = [];
    for (const [p, j] of this.json) parca.push(JSON.stringify(p) + ":" + j);
    return '{"v":1,"docs":{' + parca.join(",") + "}}";
  }
  _yazArkada() {
    if (!this.file) return;
    this.yaziyor = true; this.yineYaz = false; this.ilkBekleyen = 0;
    const surum = this.surum, tmp = this.file + ".tmp", metin = this._metin();
    fs.promises.mkdir(path.dirname(this.file), { recursive: true })
      .then(() => fs.promises.writeFile(tmp, metin))
      .then(() => { if (this.yaziyor) return fs.promises.rename(tmp, this.file); })
      .catch(e => { console.error("[veri] diske yazılamadı:", e.message); this.yineYaz = true; })
      .finally(() => {
        if (!this.yaziyor) return; // bu arada flush() zaten eşzamanlı yazdı
        this.yaziyor = false;
        if (this.yineYaz || this.surum !== surum) { this.yineYaz = false; this.ilkBekleyen = 0; this._schedule(); }
      });
  }
  // Hemen ve eşzamanlı yaz (kapanırken).
  flush() {
    if (!this.file) return;
    clearTimeout(this.timer); this.timer = null;
    this.yaziyor = false; this.yineYaz = false; this.ilkBekleyen = 0;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + ".tmp-kapanis"; // arkadaki yazmayla aynı geçici dosyayı kullanmasın
    fs.writeFileSync(tmp, this._metin());
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { Store, deepMerge, parentOf, clone };
