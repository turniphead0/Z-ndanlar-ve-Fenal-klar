#!/usr/bin/env node
// Hazır RPG haritalarını gerçekçi resim olarak üretir: web/gorsel/harita-<id>.webp (1400×1000, 28×20 kare).
// Çizim tools/gorsel/haritalar-ciz.js ile web/ext/doku.js'te; bu betik onları Chromium'da (Playwright) çalıştırıp kaydeder.
// Her çalıştırmada aynı resimler çıkar. Çalıştır: node tools/gorsel/haritalar.js [id ...]
"use strict";
const fs = require("fs");
const path = require("path");
const KOK = path.join(__dirname, "..", "..");
const OUT = path.join(KOK, "web", "gorsel");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { console.error("Bu araç Playwright ister: npm i -g playwright && npx playwright install chromium"); process.exit(1); }

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  p.on("pageerror", e => console.error("Sayfa hatası:", e.message));
  await p.setContent("<!doctype html><body></body>");
  await p.addScriptTag({ content: fs.readFileSync(path.join(KOK, "web", "ext", "doku.js"), "utf8") });
  await p.addScriptTag({ content: fs.readFileSync(path.join(__dirname, "haritalar-ciz.js"), "utf8") });
  const hepsi = await p.evaluate(() => window.ZM_HARITA_LISTE), secili = process.argv.slice(2).length ? process.argv.slice(2) : hepsi;
  for (const id of secili) {
    const t0 = Date.now();
    const veri = await p.evaluate(([id, s]) => window.ZM_HARITA_CIZ(id, s).toDataURL("image/webp", .86), [id, [...id].reduce((a, c) => a * 31 + c.charCodeAt(0) >>> 0, 7)]);
    const buf = Buffer.from(veri.split(",")[1], "base64"); fs.writeFileSync(path.join(OUT, `harita-${id}.webp`), buf);
    console.log(`harita-${id}.webp  ${(buf.length / 1024).toFixed(0)} KB  ${Date.now() - t0} ms`);
  }
  await b.close();
})();
