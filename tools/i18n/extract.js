// Arayüzdeki Türkçe metinleri toplar ve çeviri sözlüğünde eksik olanları listeler.
// Çalıştır: node tools/i18n/extract.js           → eksikleri yazar (tools/i18n/missing.json)
//           node tools/i18n/extract.js --all     → bütün anahtarları yazar (tools/i18n/keys.json)
// Sözlük: web/i18n/en.json. Anahtar Türkçe metindir; ${…} ile üretilen parçalar {0}, {1}… olur.
const fs = require("fs"), path = require("path");
const acorn = require("acorn"), walk = require("acorn-walk");
const ROOT = path.join(__dirname, "..", "..");
const TRCH = /[çğıöşüÇĞİÖŞÜâîû]/;
const LETTER = /[A-Za-zÇĞİÖŞÜçğıöşü]/;
const M0 = "\u0001", M1 = "\u0002";            // yer tutucu işaretleri: \u0001<n>\u0002
const TEXT_ATTRS = new Set(["placeholder", "title", "aria-label", "alt", "label", "data-tip"]);

const keys = new Map();                          // anahtar → ilk görüldüğü yer
const add = (k, where) => { k = norm(k); if (!k || !LETTER.test(k.replace(/\{\d+\}/g, ""))) return; if (!keys.has(k)) keys.set(k, where); };
function norm(s) {
  s = s.replace(/\s+/g, " ").trim();
  // baştaki ve sondaki yalnız yer tutucuları ve noktalama dışında bırakma; numaraları sıfırdan yeniden ver
  let n = 0; const map = {};
  s = s.replace(new RegExp(M0 + "(\\d+)" + M1, "g"), (_, i) => { if (!(i in map)) map[i] = n++; return "{" + map[i] + "}"; });
  return s;
}
// Yer tutuculu şablon metnini HTML olarak tarar: etiket dışı metinler ve metin özellikleri.
function scanHtml(s, where, literal) {
  const hasTag = /<\/?[a-zA-Z][^>]*>/.test(s.replace(new RegExp(M0 + "\\d+" + M1, "g"), "x"));
  if (!hasTag) { if (literal && !looksText(s)) return; pieces(s, where); return; }
  let i = 0, text = "";
  while (i < s.length) {
    if (s[i] === "<" && /[a-zA-Z\/!]/.test(s[i + 1] || "")) {
      pieces(text, where); text = "";
      let j = i + 1; // etiketin sonunu bul (tırnaklara dikkat)
      let q = null; for (; j < s.length; j++) { const ch = s[j]; if (q) { if (ch === q) q = null; } else if (ch === '"' || ch === "'") q = ch; else if (ch === ">") break; }
      const tag = s.slice(i, j + 1);
      const re = /([a-zA-Z-:]+)\s*=\s*("([^"]*)"|'([^']*)')/g; let m;
      while ((m = re.exec(tag))) if (TEXT_ATTRS.has(m[1].toLowerCase())) pieces(m[3] ?? m[4], where);
      i = j + 1; continue;
    }
    text += s[i++];
  }
  pieces(text, where);
}
// Bir metin parçasını ve yer tutuculara göre bölünmüş alt parçalarını anahtar yapar.
function pieces(t, where) {
  t = t.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
  if (!LETTER.test(t.replace(new RegExp(M0 + "\\d+" + M1, "g"), ""))) return;
  add(t, where);
  const parts = t.split(new RegExp(M0 + "\\d+" + M1));
  if (parts.length > 1) for (const p of parts) add(p, where);
}
// HTML içermeyen düz bir dizgi arayüz metni mi? (sınıf adı, anahtar, CSS değil)
function looksText(s) {
  const t = s.replace(new RegExp(M0 + "\\d+" + M1, "g"), "").trim();
  if (!LETTER.test(t)) return false;
  if (TRCH.test(t)) return true;
  if (/^[a-z0-9_.\-:#\[\]=*>+~()"' ,]+$/.test(t) && !/^[a-z]+( [a-z]+){2,}$/.test(t)) return false;   // anahtar, seçici, sınıf listesi
  if (/^[^A-Za-z]{0,3}[A-Z][a-zçğıöşü]+/.test(t) || / [a-zçğıöşü]{3,} /.test(" " + t + " ")) return true;
  return false;
}

function scanJs(code, file, base = 0) {
  let ast; try { ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "script", locations: true, allowHashBang: true }); }
  catch (e) { console.error("ayrıştırılamadı:", file, e.message); return; }
  walk.full(ast, node => {
    const where = `${file}:${(node.loc?.start.line || 0) + base}`;
    if (node.type === "Literal" && typeof node.value === "string") scanHtml(node.value, where, true);
    else if (node.type === "TemplateLiteral") {
      let s = ""; node.quasis.forEach((q, i) => { s += q.value.cooked ?? q.value.raw; if (i < node.expressions.length) s += M0 + i + M1; });
      scanHtml(s, where, !/[<>]/.test(s));
    }
  });
}

const html = fs.readFileSync(path.join(ROOT, "web/app.html"), "utf8");
const sStart = html.indexOf("<script>"), sEnd = html.lastIndexOf("</script>");
scanHtml(html.slice(0, sStart).replace(/<style>[\s\S]*?<\/style>/g, ""), "web/app.html:body", false);
scanJs(html.slice(sStart + 8, sEnd), "web/app.html", html.slice(0, sStart + 8).split("\n").length - 1);
const extDir = path.join(ROOT, "web/ext");
for (const f of fs.readdirSync(extDir).filter(f => f.endsWith(".js") && f !== "dil-en.js")) scanJs(fs.readFileSync(path.join(extDir, f), "utf8"), "web/ext/" + f);

const dictFile = path.join(ROOT, "web/i18n/en.json");
const dict = fs.existsSync(dictFile) ? JSON.parse(fs.readFileSync(dictFile, "utf8")) : {};
const all = [...keys.keys()];
const missing = all.filter(k => !(k in dict));
if (process.argv.includes("--all")) fs.writeFileSync(path.join(__dirname, "keys.json"), JSON.stringify(Object.fromEntries([...keys]), null, 1));
fs.writeFileSync(path.join(__dirname, "missing.json"), JSON.stringify(Object.fromEntries(missing.map(k => [k, keys.get(k)])), null, 1));
console.log(`${all.length} anahtar, sözlükte ${all.length - missing.length}, eksik ${missing.length} (tools/i18n/missing.json)`);
