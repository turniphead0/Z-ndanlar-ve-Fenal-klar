// Masa oyunları: kurallar ve sunucu denetimi.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), os = require("os"), path = require("path");
const WebSocket = require("ws");
const { OYUNLAR, yasal } = require("../web/oyunlar/kurallar");
const { createServer, canWrite } = require("../server");

// Tekrarlanabilir rastgelelik
const rngOf = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

test("mangala: hazinede biterse tekrar oynar, çift yapınca alır, karşı boşsa alır", () => {
  const M = OYUNLAR.mangala;
  let d = M.yeni();
  assert.equal(M.hamleler(d).length, 6);
  d = M.uygula(d, [2]); // 4 taş: 2,3,4,5 → son taş 5'te; hazineye değil
  assert.deepEqual(d.a.slice(0, 7), [4, 4, 1, 5, 5, 5, 0]); assert.equal(d.sira, 1);
  d = M.yeni(); d = M.uygula(d, [3]); // 3,4,5,6 → hazinede biter
  assert.equal(d.a[6], 1); assert.equal(d.sira, 0);
  d = M.yeni(); d.a[5] = 3; d.a[7] = 3; d = M.uygula(d, [5]); // 5,6,7 → 7'de 4 olur (çift) → alır
  assert.equal(d.a[7], 0); assert.equal(d.a[6], 5);
  d = M.yeni(); d.a[0] = 1; d.a[1] = 0; d = M.uygula(d, [0]); // tek taş boş kuyuya; karşısı 11'de 4 taş
  assert.equal(d.a[6], 5); assert.equal(d.a[11], 0); assert.equal(d.a[1], 0);
  d = M.yeni(); d.a = [0, 0, 0, 0, 0, 1, 20, 1, 1, 1, 1, 1, 1, 10]; d = M.uygula(d, [5]); // tarafını boşaltan rakibinkileri alır
  assert.ok(d.bitti); assert.equal(d.a[6], 27); assert.equal(d.bitti.kazanan, 0);
});

test("dama: alma zorunlu, en çok alan yol seçilir, dama olur", () => {
  const D = OYUNLAR.dama;
  let d = D.yeni();
  assert.ok(D.hamleler(d).every(h => h.length === 2));
  d.b = Array(64).fill(0); d.b[44] = 1; d.b[36] = 3; d.b[20] = 3; d.b[43] = 3; d.b[0] = 3;
  // 44'ten: yukarı 36'yı alıp 28'e, sonra 20'yi alıp 12'ye (2 taş) ya da sola 43'ü alıp 42'ye (1 taş)
  const h = D.hamleler(d);
  assert.deepEqual(h, [[44, 28, 12]]);
  d = D.uygula(d, [44, 28, 12]);
  assert.equal(d.b[36] + d.b[20], 0); assert.equal(d.b[12], 1);
  d.sira = 0; d.b[0] = 0; d.b[63] = 3; d = D.uygula(d, [12, 4]);
  assert.equal(d.b[4], 2, "son sırada dama olur");
  assert.ok(!yasal("dama", D.yeni(), [48, 56]), "taş geri gidemez");
});

test("dama: dama uzaktan alır, geldiği yöne dönemez", () => {
  const D = OYUNLAR.dama, d = D.yeni();
  d.b = Array(64).fill(0); d.b[56] = 2; d.b[24] = 3; d.b[63] = 3;
  const h = D.hamleler(d);
  assert.deepEqual(h.map(x => x.join()).sort(), ["56,16", "56,8", "56,0"].sort());
});

test("dokuz taş: değirmen kurunca taş alınır, ikiye düşen kaybeder", () => {
  const T = OYUNLAR.dokuztas;
  let d = T.yeni();
  assert.equal(T.hamleler(d).length, 24);
  for (const [a, b] of [[0, 9], [1, 10]]) { d = T.uygula(d, [a]); d = T.uygula(d, [b]); }
  const h = T.hamleler(d).filter(x => x[0] === 2);
  assert.deepEqual(h.map(x => x[1]).sort((a, b) => a - b), [9, 10]);
  d = T.uygula(d, [2, 9]); assert.equal(d.b[9], -1);
  // Taşıma aşaması: komşu boş noktaya
  d = T.yeni(); d.elde = [0, 0]; d.b = Array(24).fill(-1); d.b[0] = 0; d.b[1] = 0; d.b[14] = 0; d.b[21] = 1; d.b[22] = 1; d.b[23] = 1; d.b[5] = 1;
  assert.ok(yasal("dokuztas", d, [14, 2, 5]));
  d = T.uygula(d, [14, 2, 5]);
  assert.ok(d.b[2] === 0 && d.b[5] === -1);
});

test("ur: zar, rozette tekrar, rakibi başa gönderme, ortadaki rozet güvenli", () => {
  const U = OYUNLAR.ur, rng = rngOf(7);
  let d = U.yeni(rng);
  assert.ok(d.zar > 0 && U.hamleler(d).length === 1);
  d = U.yeni(rng); d.sira = 0; d.zar = 4;
  d = U.uygula(d, [100, U.kare(0, 4)], rng);
  assert.equal(d.sira, 0, "rozette tekrar oynar"); assert.deepEqual(d.t[0].filter(k => k).sort(), [4]);
  d.t = [[6, 0, 0, 0, 0, 0, 0], [6, 0, 0, 0, 0, 0, 0]]; d.sira = 0; d.zar = 0;
  // 6 ortak karede; rakip de 6'da olamaz aslında aynı kare → test için 1. oyuncu 5'te
  d.t[1][0] = 5; d.t[0][0] = 3; d.zar = 2;
  d = U.uygula(d, [U.kare(0, 3), U.kare(0, 5)], rng);
  assert.equal(d.t[1][0], 0, "rakip başa döndü");
  d.t = [[6, 0, 0, 0, 0, 0, 0], [8, 0, 0, 0, 0, 0, 0]]; d.sira = 0; d.zar = 2; d.bitti = null;
  assert.ok(!U.hamleler(d).some(h => h[0] === U.kare(0, 6)), "ortadaki rozetteki taş alınamaz");
});

test("hnefatafl: sıkıştırma, köşe ve taht kuralları, kralın kaçışı ve kuşatılması", () => {
  const H = OYUNLAR.hnefatafl, k = (r, c) => r * 11 + c;
  let d = H.yeni();
  assert.equal(d.b.filter(v => v === 1).length, 24); assert.equal(d.b.filter(v => v === 2).length, 12);
  assert.ok(H.hamleler(d).every(([a]) => d.b[a] === 1), "saldıranlar başlar");
  // Sıkıştırıp alma
  d.b = Array(121).fill(0); d.b[60] = 3; d.b[k(2, 2)] = 2; d.b[k(2, 4)] = 1; d.b[k(4, 3)] = 1; d.sira = 0;
  d = H.uygula(d, [k(4, 3), k(2, 3)]);
  assert.equal(d.b[k(2, 2)], 2, "arada iki taş yok: alınmaz");
  d.b = Array(121).fill(0); d.b[60] = 3; d.b[k(2, 2)] = 1; d.b[k(2, 3)] = 2; d.b[k(4, 4)] = 1; d.sira = 0;
  d = H.uygula(d, [k(4, 4), k(2, 4)]);
  assert.equal(d.b[k(2, 3)], 0, "savunan sıkıştırıldı");
  // Köşe düşman sayılır; köşeye yalnız kral girer
  d.b = Array(121).fill(0); d.b[60] = 3; d.b[k(0, 1)] = 1; d.b[k(3, 2)] = 2; d.b[k(5, 9)] = 1; d.sira = 1;
  assert.ok(!H.hamleler(d).some(([, z]) => z === 0), "köşeye yalnız kral");
  d = H.uygula(d, [k(3, 2), k(0, 2)]);
  assert.equal(d.b[k(0, 1)], 0, "köşeyle sıkıştırma");
  // Kral köşeye kaçar
  d.b = Array(121).fill(0); d.b[k(0, 5)] = 3; d.b[k(9, 9)] = 1; d.sira = 1;
  d = H.uygula(d, [k(0, 5), 0]);
  assert.deepEqual(d.bitti, { kazanan: 1, neden: "Kral köşeye kaçtı" });
  // Kral dört yandan kuşatılır
  d = H.yeni(); d.b = Array(121).fill(0); d.b[k(3, 3)] = 3; d.b[k(2, 3)] = 1; d.b[k(4, 3)] = 1; d.b[k(3, 2)] = 1; d.b[k(3, 6)] = 1; d.b[k(8, 8)] = 2; d.sira = 0;
  d = H.uygula(d, [k(3, 6), k(3, 4)]);
  assert.equal(d.bitti.kazanan, 0);
  // Boş tahtın üstünden geçilir ama tahtta durulmaz
  d = H.yeni(); d.b = Array(121).fill(0); d.b[k(0, 5)] = 3; d.b[k(5, 2)] = 1; d.b[k(9, 9)] = 2; d.sira = 0;
  const h = H.hamleler(d).filter(([a]) => a === k(5, 2)).map(x => x[1]);
  assert.ok(!h.includes(60) && h.includes(k(5, 8)));
});

test("rastgele oyunlar kurallardan çıkmadan biter", () => {
  for (const [ad, g] of Object.entries(OYUNLAR)) {
    for (let t = 0; t < 20; t++) {
      const rng = rngOf(t + 3); let d = g.yeni(rng), n = 0;
      while (!d.bitti && n++ < 2000) { const h = g.hamleler(d); assert.ok(h.length, ad + " hamlesiz kaldı"); d = g.uygula(d, h[Math.floor(rng() * h.length)], rng); }
      assert.ok(d.bitti, ad + " bitmedi");
    }
  }
});

function client(port) {
  const ws = new WebSocket(`ws://localhost:${port}/ws`); let n = 0; const wait = new Map();
  ws.on("message", raw => { const m = JSON.parse(raw); if (m.ev) return; const w = wait.get(m.re); wait.delete(m.re); m.error ? w.rej(Object.assign(new Error(m.error.message), m.error)) : w.res(m.result); });
  const call = (op, a) => new Promise((res, rej) => { const id = ++n; wait.set(id, { res, rej }); ws.send(JSON.stringify({ id, op, ...a })); });
  return { ws, call, opened: new Promise(r => ws.once("open", r)) };
}

test("sunucu: koltuk, sıra ve yasa dışı hamle denetimi", async () => {
  assert.ok(!canWrite("u-1", "boards/b1")); assert.ok(canWrite("u-1", "games/g1/chars/c1"));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zm-")), srv = createServer({ dataDir: dir });
  const port = await srv.listen(0, "127.0.0.1");
  const a = client(port), b = client(port); await a.opened; await b.opened;
  await a.call("hello", { name: "A" }); await b.call("hello", { name: "B" });
  const { id } = await a.call("bgNew", { oyun: "mangala" });
  await a.call("bgSit", { board: id, koltuk: 0 });
  await assert.rejects(b.call("bgSit", { board: id, koltuk: 0 }), { code: "taken" });
  await b.call("bgSit", { board: id, koltuk: 1 });
  await assert.rejects(b.call("bgMove", { board: id, hamle: [7] }), { code: "not_your_turn" });
  await assert.rejects(a.call("bgMove", { board: id, hamle: [8] }), { code: "illegal" });
  await assert.rejects(a.call("set", { path: "boards/" + id, data: {} }), { code: "permission_denied" });
  await a.call("bgMove", { board: id, hamle: [2] });
  const r = await b.call("get", { path: "boards/" + id });
  assert.equal(r.data.durum.sira, 1); assert.equal(r.data.durum.a[2], 1);
  await b.call("bgMove", { board: id, hamle: [7] });
  await b.call("bgDelete", { board: id });
  assert.equal((await a.call("get", { path: "boards/" + id })).exists, false);
  a.ws.close(); b.ws.close(); await srv.close();
});
