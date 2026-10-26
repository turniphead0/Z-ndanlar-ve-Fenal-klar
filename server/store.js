// Belge deposu: "a/b/c" yollarıyla saklanan JSON belgeleri. Koleksiyon = belgenin üst yolu.
// Bellekte tutulur, değişiklikler kısa bir gecikmeyle diske yazılır (atomik: önce .tmp, sonra rename).
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

class Store {
  constructor(file) {
    this.file = file;
    this.docs = new Map(); // yol -> veri
    this.byCol = new Map(); // koleksiyon yolu -> Set(belge yolu)
    this.listeners = new Set(); // (type, path, data) => void
    this.timer = null;
    if (file && fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const [p, d] of Object.entries(raw.docs || {})) this._put(p, d);
    }
  }
  _put(p, d) {
    this.docs.set(p, d);
    const c = parentOf(p);
    if (!this.byCol.has(c)) this.byCol.set(c, new Set());
    this.byCol.get(c).add(p);
  }
  _drop(p) {
    this.docs.delete(p);
    const s = this.byCol.get(parentOf(p));
    if (s) { s.delete(p); if (!s.size) this.byCol.delete(parentOf(p)); }
  }
  get(p) { return clone(this.docs.get(p)); }
  list(col) { return [...(this.byCol.get(col) || [])].map(p => ({ id: p.split("/").pop(), path: p, data: clone(this.docs.get(p)) })); }
  set(p, d) {
    const type = this.docs.has(p) ? "modified" : "added";
    this._put(p, clone(d));
    this._emit(type, p);
  }
  update(p, patch) {
    if (!this.docs.has(p)) { const e = new Error("Belge bulunamadı"); e.code = "not_found"; throw e; }
    this._put(p, deepMerge(clone(this.docs.get(p)), clone(patch)));
    this._emit("modified", p);
  }
  delete(p) {
    if (!this.docs.has(p)) return;
    const old = this.docs.get(p);
    this._drop(p);
    this._emit("removed", p, old);
  }
  _emit(type, p, old) {
    const data = type === "removed" ? clone(old) : clone(this.docs.get(p));
    for (const fn of this.listeners) { try { fn(type, p, data); } catch (e) { console.error(e); } }
    this._schedule();
  }
  _schedule() {
    if (!this.file || this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 400);
  }
  flush() {
    if (!this.file) return;
    clearTimeout(this.timer); this.timer = null;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify({ v: 1, docs: Object.fromEntries(this.docs) }));
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { Store, deepMerge, parentOf, clone };
