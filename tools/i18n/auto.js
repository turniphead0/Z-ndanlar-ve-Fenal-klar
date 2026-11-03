// Sözlüğe kendiliğinden çıkarılabilen çevirileri ekler (var olanlara dokunmaz):
// büyü adları (veri dosyalarındaki İngilizce adlar) ve "Türkçe (English)" biçimindeki adlar.
// Çalıştır: node tools/i18n/auto.js   (önce extract.js --all)
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..", "..");
const ctx = { window: {} }; vm.createContext(ctx);
for (const f of ["veri-5e", "veri-pf2e"]) vm.runInContext(fs.readFileSync(path.join(ROOT, "web/ext", f + ".js"), "utf8"), ctx);
const dictFile = path.join(ROOT, "web/i18n/en.json");
const dict = fs.existsSync(dictFile) ? JSON.parse(fs.readFileSync(dictFile, "utf8")) : {};
let n = 0; const put = (k, v) => { if (k && v && !(k in dict)) { dict[k] = v; n++; } };
for (const s of [...ctx.window.ZM5E.SPELLS, ...ctx.window.ZMPF.SPELLS]) put(s.n, s.en);
const keys = JSON.parse(fs.readFileSync(path.join(__dirname, "keys.json"), "utf8"));
for (const k of Object.keys(keys)) { const m = k.match(/^(.+?) \(([A-Z][A-Za-z' ,\-]+)\)$/); if (m && /[^\x00-\x7f]|^[A-ZÇĞİÖŞÜ]/.test(m[1])) put(k, m[2]); }
const sorted = Object.fromEntries(Object.entries(dict).sort(([a], [b]) => a.localeCompare(b, "tr")));
fs.mkdirSync(path.dirname(dictFile), { recursive: true });
fs.writeFileSync(dictFile, JSON.stringify(sorted, null, 1) + "\n");
console.log(`${n} çeviri eklendi`);
