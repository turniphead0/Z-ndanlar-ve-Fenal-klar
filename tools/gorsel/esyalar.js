#!/usr/bin/env node
// Haritaya konan mobilya ve eşyaların gerçekçi ikonlarını üretir: web/ext/mobilya/<anahtar>.webp (256×256, saydam).
// Çizim tools/gorsel/esyalar-ciz.js ile web/ext/doku.js'te; bu betik onları Chromium'da (Playwright) çalıştırıp kaydeder.
// Dışarıdan resim kullanılmaz, her şey kodla çizilir (MIT). Çalıştır: node tools/gorsel/esyalar.js [anahtar ...]
"use strict";
const fs = require("fs");
const path = require("path");
const KOK = path.join(__dirname, "..", "..");
const OUT = path.join(KOK, "web", "ext", "mobilya");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { console.error("Bu araç Playwright ister: npm i -g playwright && npx playwright install chromium"); process.exit(1); }

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  p.on("pageerror", e => console.error("Sayfa hatası:", e.message));
  await p.setContent("<!doctype html><body></body>");
  await p.addScriptTag({ content: fs.readFileSync(path.join(KOK, "web", "ext", "doku.js"), "utf8") });
  await p.addScriptTag({ content: fs.readFileSync(path.join(__dirname, "esyalar-ciz.js"), "utf8") });
  const hepsi = await p.evaluate(() => window.ZM_ESYA_LISTE), secili = process.argv.slice(2).length ? process.argv.slice(2) : hepsi;
  let top = 0;
  for (const ad of secili) {
    const veri = await p.evaluate(ad => window.ZM_ESYA_CIZ(ad).toDataURL("image/webp", .9), ad);
    const buf = Buffer.from(veri.split(",")[1], "base64"); fs.writeFileSync(path.join(OUT, `${ad}.webp`), buf); top += buf.length;
  }
  console.log(`${secili.length} ikon, toplam ${(top / 1024).toFixed(0)} KB`);
  await b.close();
})();
