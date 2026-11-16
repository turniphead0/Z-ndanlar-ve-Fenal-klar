// Kart ve taş masası: gizlilik, işlemler, oyun atölyesi.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), os = require("os"), path = require("path");
const WebSocket = require("ws");
const { createServer, canWrite } = require("../server");
const KM = require("../web/oyunlar/kartmasa");
const { HAZIR } = require("../web/oyunlar/hazir");

function client(port) {
  const ws = new WebSocket(`ws://localhost:${port}/ws`); let n = 0; const wait = new Map();
  ws.on("message", raw => { const m = JSON.parse(raw); if (m.ev) return; const w = wait.get(m.re); wait.delete(m.re); m.error ? w.rej(Object.assign(new Error(m.error.message), m.error)) : w.res(m.result); });
  const call = (op, a) => new Promise((res, rej) => { const id = ++n; wait.set(id, { res, rej }); ws.send(JSON.stringify({ id, op, ...a })); });
  return { ws, call, opened: new Promise(r => ws.once("open", r)) };
}
const post = async (port, p, body) => (await fetch(`http://127.0.0.1:${port}${p}`, { method: "POST", body: JSON.stringify(body) })).json();

test("hazır oyunlar: Kazan ya da Katlet iki sürüm", () => {
  const o = KM.tanimDuzelt(HAZIR["kazan-katlet"]), c = KM.tanimDuzelt(HAZIR["kazan-katlet-claude"]);
  const say = (t, d) => t.desteler.find(x => x.id === d).kartlar.reduce((a, k) => a + k.adet, 0);
  for (const t of [o, c]) { assert.equal(say(t, "huy"), 25); assert.equal(say(t, "esya"), 19); assert.equal(say(t, "canavar"), 9); assert.equal(say(t, "karakter"), 6); }
  assert.equal(o.desteler.find(x => x.id === "esya").kartlar.find(k => k.id === "plastik-mermi").adet, 3);
  assert.equal(c.desteler.find(x => x.id === "esya").kartlar.find(k => k.id === "plastik-mermi").adet, 2);
  assert.equal(o.surum, "Orijinal"); assert.equal(c.surum, "Claude Versiyonu");
  for (const d of o.desteler) for (const k of d.kartlar) assert.ok(k.resim && fs.existsSync(path.join(__dirname, "..", "web", k.resim)), k.resim);
});

test("tanım denetimi zararlı değerleri atar", () => {
  const t = KM.tanimDuzelt({ ad: "<b>x</b>", oyuncu: { min: 9, max: 3 }, masa: { resim: "javascript:alert(1)" },
    desteler: [{ id: "a", ad: "A", kartlar: [{ ad: "k", resim: "http://kotu.example/x.png", adet: 1000 }] }], kurulum: [{ islem: "dagit", deste: "yok" }] });
  assert.equal(t.masa.resim, null); assert.equal(t.desteler[0].kartlar[0].resim, null);
  assert.equal(t.oyuncu.max, 3); assert.equal(t.oyuncu.min, 3); assert.equal(t.desteler[0].kartlar[0].adet, 60); assert.equal(t.kurulum.length, 0);
});

test("kart masası: gizli el, kapalı kartlar ve izinler", async () => {
  assert.ok(!canWrite("u-1", "kartoyun/ko-1")); assert.ok(!canWrite("u-1", "data/users/u-1/kartmasa/b1"));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zm-"));
  const srv = createServer({ dataDir: dir, hesap: "zorunlu" });
  const port = await srv.listen(0, "127.0.0.1");
  const gir = async ad => { const r = await post(port, "/api/hesap/kayit", { kullanici: ad, sifre: "ejderha42" }); const c = client(port); await c.opened; c.me = (await c.call("hello", { userId: r.userId, secret: r.secret })).me; return c; };
  const a = await gir("ayse"), b = await gir("berk"), z = await gir("zeyno");
  const { id } = await a.call("kmNew", { hazir: "kazan-katlet-claude" });
  await assert.rejects(a.call("kmStart", { board: id }), { code: "invalid_argument" }, "en az 3 kişi");
  await b.call("kmSit", { board: id, koltuk: 1 }); await z.call("kmSit", { board: id, koltuk: 2 });
  await a.call("kmStart", { board: id });
  const pub = srv.store.get("boards/" + id), d = srv.store.get("_sys/kartmasa/" + id);
  // Herkese açık görünümde kapalı kartların yüzü ve ellerin içeriği yok.
  for (const c of Object.values(pub.durum.kartlar)) if (!c.acik) assert.equal(c.k, undefined);
  for (const el of Object.values(pub.durum.el)) for (const c of el) assert.equal(c.k, undefined);
  assert.ok(!JSON.stringify(pub.durum.desteler).includes("/seytan"));
  const gA = srv.store.get(`data/users/${a.me.id}/kartmasa/${id}`);
  assert.equal(gA.el.length, 6); assert.equal(Object.keys(gA.gor).length, 1, "kendi gizli huy kartını görür");
  await assert.rejects(b.call("get", { path: `data/users/${a.me.id}/kartmasa/${id}` }), { code: "permission_denied" });
  await assert.rejects(b.call("get", { path: "_sys/kartmasa/" + id }), { code: "permission_denied" });
  // Başkasının elindeki karta dokunulamaz; kendi kartını masaya açık koyunca herkes görür.
  const benimKart = gA.el[0].iid;
  await assert.rejects(b.call("kmIslem", { board: id, islem: { tur: "koy", kart: benimKart, nereye: "masa", acik: true, x: 10, y: 10 } }), { code: "permission_denied" });
  await a.call("kmIslem", { board: id, islem: { tur: "koy", kart: benimKart, nereye: "masa", acik: true, x: 500, y: 500 } });
  assert.equal(srv.store.get("boards/" + id).durum.kartlar[benimKart].k, d.kartlar[benimKart].k);
  // Berk, Ayşe'nin önündeki kapalı huy kartına gizlice bakar: günlüğe yazılır, yalnızca Berk görür.
  const huy = srv.store.get("boards/" + id).durum.onu[a.me.id].find(i => !srv.store.get("boards/" + id).durum.kartlar[i].acik);
  await b.call("kmIslem", { board: id, islem: { tur: "bak", kart: huy } });
  assert.ok(srv.store.get(`data/users/${b.me.id}/kartmasa/${id}`).gor[huy]);
  assert.equal(srv.store.get(`data/users/${z.me.id}/kartmasa/${id}`).gor[huy], undefined);
  assert.match(srv.store.get("boards/" + id).durum.log.at(-1).m, /gizlice baktı/);
  // Desteden çek, sayaç, rastgele kart.
  const esyaDeste = Object.entries(srv.store.get("boards/" + id).durum.desteler).find(([, p]) => p.d === "esya" && !p.iskarta)[0];
  await z.call("kmIslem", { board: id, islem: { tur: "cek", deste: esyaDeste, nereye: "el" } });
  assert.equal(srv.store.get(`data/users/${z.me.id}/kartmasa/${id}`).el.length, 7);
  await b.call("kmIslem", { board: id, islem: { tur: "sayac", kisi: a.me.id, id: "can", deger: 2 } });
  assert.equal(srv.store.get("boards/" + id).durum.sayac[a.me.id].can, 2);
  await b.call("kmIslem", { board: id, islem: { tur: "rastgele", kisi: z.me.id, nereye: "el" } });
  assert.equal(srv.store.get(`data/users/${b.me.id}/kartmasa/${id}`).el.length, 7);
  // Toplam kart sayısı değişmez.
  const dd = srv.store.get("_sys/kartmasa/" + id);
  assert.equal(Object.keys(dd.kartlar).length, 9 + 25 + 19 + 6 + 10);
  const yer = Object.values(dd.desteler).reduce((s, p) => s + p.kart.length, 0) + Object.values(dd.el).reduce((s, e) => s + e.length, 0) + Object.values(dd.onu).reduce((s, e) => s + e.length, 0) + Object.values(dd.kartlar).filter(c => c.yer === "masa").length;
  assert.equal(yer, Object.keys(dd.kartlar).length);
  await a.call("kmDelete", { board: id });
  assert.equal(srv.store.get(`data/users/${a.me.id}/kartmasa/${id}`), undefined);
  for (const c of [a, b, z]) c.ws.close();
  await srv.close(); fs.rmSync(dir, { recursive: true, force: true });
});

test("oyun atölyesi: kaydet, yalnızca sahibi değiştirir, masa aç", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zm-"));
  const srv = createServer({ dataDir: dir, hesap: "zorunlu" });
  const port = await srv.listen(0, "127.0.0.1");
  const gir = async ad => { const r = await post(port, "/api/hesap/kayit", { kullanici: ad, sifre: "ejderha42" }); const c = client(port); await c.opened; c.me = (await c.call("hello", { userId: r.userId, secret: r.secret })).me; return c; };
  const a = await gir("ayse"), b = await gir("berk");
  const tanim = { ad: "Ejderha Avı", oyuncu: { min: 1, max: 2 }, desteler: [{ id: "macera", ad: "Macera", kartlar: [{ id: "ejder", ad: "Ejder", metin: "3 hasar", adet: 4 }, { id: "iksir", ad: "İksir", adet: 6 }] }],
    taslar: [{ id: "piyon", ad: "Piyon", sekil: "piyon", renk: "oyuncu", adet: 1, herOyuncu: true }], sayaclar: [{ id: "can", ad: "Can", baslangic: 10 }],
    kurulum: [{ islem: "dagit", deste: "macera", adet: 3, nereye: "el" }, { islem: "masaya", deste: "macera", adet: 2, acik: true, konumlar: [[400, 400, 0], [600, 400, 0]] }] };
  const { id } = await a.call("kmTanimYaz", { tanim });
  assert.equal(srv.store.get("kartoyun/" + id).sahipAd, "ayse");
  await assert.rejects(b.call("kmTanimYaz", { kartoyun: id, tanim }), { code: "permission_denied" });
  await assert.rejects(b.call("set", { path: "kartoyun/" + id, data: { tanim } }), { code: "permission_denied" });
  await a.call("kmTanimYaz", { kartoyun: id, tanim: { ...tanim, ad: "Ejderha Avı 2" } });
  const m = await b.call("kmNew", { oyun: id });
  await b.call("kmStart", { board: m.id });
  const d = srv.store.get("_sys/kartmasa/" + m.id);
  assert.equal(d.el[b.me.id].length, 3); assert.equal(Object.values(d.kartlar).filter(c => c.yer === "masa" && c.acik).length, 2);
  assert.equal(d.sayac[b.me.id].can, 10); assert.equal(Object.keys(d.taslar).length, 1);
  await assert.rejects(b.call("kmTanimSil", { kartoyun: id }), { code: "permission_denied" });
  await a.call("kmTanimSil", { kartoyun: id });
  assert.equal(srv.store.get("kartoyun/" + id), undefined);
  for (const c of [a, b]) c.ws.close();
  await srv.close(); fs.rmSync(dir, { recursive: true, force: true });
});
