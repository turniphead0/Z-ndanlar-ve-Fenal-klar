// Yapay zekâsız senaryo çözümleyici: başlıklardan bölümler, istatistik bloklarından NPC'ler.
const { test } = require("node:test");
const assert = require("node:assert");
const KC = require("../web/ext/cozumleyici");

const B = 10, H = 18, H2 = 13;
const L = (t, s = B, b = false) => ({ t, s, b });
const para = n => L(`Bu sayfada sıradan bir anlatım cümlesi var ve köylüler sisten korkuyor ${n}. Kimse geceleri dışarı çıkmıyor.`);

function sample() {
  const pages = [];
  pages[1] = { lines: [L("Sisli Köy", 28), para(1)] };
  pages[2] = { lines: [L("Giriş", H), L("Köyde çocuklar kayboluyor. Gerçekte değirmenci Varkas onları mağaraya götürüyor. Oyuncular yolda bir mektup bulur."), para(2)] };
  pages[3] = { lines: [L("Bölüm 1: Köye Varış", H), L("Han", H2), para(3), L("Eğer oyuncular hanı ararsa yırtık bir harita bulurlar.")] };
  pages[4] = { lines: [L("El Notu 1: Yırtık Mektup", B, true), L("Annemin mektubu, değirmene gitme diyor.")] };
  pages[5] = { lines: [L("Bölüm 2: Değirmen", H), L("Değirmen", H2), para(5), L("Varkas", B, true), L("Medium humanoid, neutral evil"), L("Armor Class 12"), L("Hit Points 27 (5d8+5)"), L("Speed 30 ft.")] };
  pages[6] = { lines: [L("Harita 2: Değirmenin Bodrumu", B, true)], img: true };
  pages[7] = { lines: [L("Bölüm 3: Mağara", H), para(7)] };
  pages[8] = { lines: [], img: true };
  pages[9] = { lines: [L("Sonuç", H), L("Çocuklar kurtarılırsa köy oyunculara minnettar kalır. Kurtarılmazsa sis köyü yutar.")] };
  return pages;
}

test("başlık boyutlarından bölümler, NPC, harita, el notu ve kılavuz", () => {
  const r = KC.analyze({ title: "Sisli Köy", pages: sample() });
  assert.deepStrictEqual(r.modules.map(m => m.title), ["Giriş", "Bölüm 1: Köye Varış", "Bölüm 2: Değirmen", "Bölüm 3: Mağara", "Sonuç"]);
  const m2 = r.modules[2];
  assert.deepStrictEqual(m2.pages, [5, 6]);
  assert.ok(m2.scenes.some(s => s.title === "Değirmen"));
  const v = r.npcs.find(n => n.name === "Varkas");
  assert.ok(v, "Varkas bulunmalı"); assert.strictEqual(v.page, 5); assert.match(v.stats, /Armor Class 12/); assert.match(v.role, /humanoid/);
  assert.ok(r.handouts.some(h => h.page === 4 && /Mektup/.test(h.title)));
  assert.ok(r.maps.some(x => x.page === 6), "başlıklı harita");
  assert.ok(r.maps.some(x => x.page === 8), "yazısız görsel sayfa harita adayı");
  assert.match(r.guide.premise, /çocuklar kayboluyor/);
  assert.match(r.guide.ending, /minnettar/);
  assert.ok(r.guide.secrets.some(s => /Gerçekte/.test(s)));
  assert.ok(r.clues.some(c => c.page === 3));
  assert.ok(m2.npcs.includes("Varkas"));
});

test("yer imleri varsa bölümler onlardan gelir", () => {
  const outline = [{ title: "Bir", page: 2, depth: 0 }, { title: "İki", page: 5, depth: 0 }, { title: "Alt", page: 6, depth: 1 }, { title: "Üç", page: 7, depth: 0 }];
  const r = KC.analyze({ title: "x", pages: sample(), outline });
  assert.deepStrictEqual(r.modules.map(m => [m.title, ...m.pages]), [["Bir", 2, 4], ["İki", 5, 6], ["Üç", 7, 9]]);
  assert.deepStrictEqual(r.modules[1].scenes.map(s => s.title), ["Alt"]);
});

test("yazı boyutu yoksa düz metinden numaralı/BÜYÜK HARF başlıklar", () => {
  const txt = ["GİRİŞ\nKöyde çocuklar kayboluyor ve kimse nedenini bilmiyor.", "BÖLÜM 1: HAN\nOyuncular hana gelir ve yemek ısmarlar.", "BÖLÜM 2: DEĞİRMEN\nDeğirmen karanlık.", "BÖLÜM 3: MAĞARA\nMağara nemli."];
  const pages = []; txt.forEach((t, i) => pages[i + 1] = { lines: KC.linesFromText(t) });
  const r = KC.analyze({ title: "x", pages });
  // Numaralı başlıklar bölüm, BÜYÜK HARF tek başlık ise alt düzey sayılır.
  assert.deepStrictEqual(r.modules.map(m => m.title), ["BÖLÜM 1: HAN", "BÖLÜM 2: DEĞİRMEN", "BÖLÜM 3: MAĞARA"]);
});

test("hiç başlık yoksa sayfa aralıklarına böler, boş PDF'te çökmez", () => {
  const pages = []; for (let i = 1; i <= 20; i++) pages[i] = { lines: [para(i)] };
  const r = KC.analyze({ title: "x", pages });
  assert.ok(r.modules.length >= 3 && r.modules.length <= 8);
  assert.strictEqual(r.modules[r.modules.length - 1].pages[1], 20);
  const e = KC.analyze({ title: "", pages: [] });
  assert.deepStrictEqual(e.modules, []); assert.strictEqual(e.title, "Senaryo");
});
