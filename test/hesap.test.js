// Hesaplar, profil, arkadaşlık ve özel mesajlar.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), os = require("os"), path = require("path");
const WebSocket = require("ws");
const { createServer, canWrite } = require("../server");

function client(port) {
  const ws = new WebSocket(`ws://localhost:${port}/ws`); let n = 0; const wait = new Map(), events = [];
  ws.on("message", raw => { const m = JSON.parse(raw); if (m.ev) events.push(m); else { const w = wait.get(m.re); wait.delete(m.re); m.error ? w.rej(Object.assign(new Error(m.error.message), m.error)) : w.res(m.result); } });
  const call = (op, a) => new Promise((res, rej) => { const id = ++n; wait.set(id, { res, rej }); ws.send(JSON.stringify({ id, op, ...a })); });
  return { ws, call, events, opened: new Promise(r => ws.once("open", r)) };
}
const post = async (port, p, body) => { const r = await fetch(`http://127.0.0.1:${port}${p}`, { method: "POST", body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
const wait = ms => new Promise(r => setTimeout(r, ms));

test("sosyal yollar istemciye kapalı", () => {
  for (const k of ["arkadas", "konusma", "dm", "chat", "grup"]) assert.ok(!canWrite("u-1", `data/users/u-1/${k}/u-2`), k);
  assert.ok(canWrite("u-1", "data/users/u-1/g-g1/monsters/m"));
});

test("zorunlu hesap: kayıt, giriş, eski kimliği bağlama, şifre", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zm-"));
  // Önce hesapsız oynanmış bir kimlik (istege-bagli sunucu), sonra aynı veriyle zorunlu hesaplı sunucu.
  let srv = createServer({ dataDir: dir });
  let port = await srv.listen(0, "127.0.0.1");
  const eski = client(port); await eski.opened;
  const h0 = await eski.call("hello", { name: "Eski" });
  eski.ws.close(); await srv.close();

  srv = createServer({ dataDir: dir, hesap: "zorunlu" });
  port = await srv.listen(0, "127.0.0.1");
  const info = await (await fetch(`http://127.0.0.1:${port}/api/info`)).json();
  assert.equal(info.hesap, "zorunlu");
  const a = client(port); await a.opened;
  await assert.rejects(a.call("hello", { name: "X", userId: h0.me.id, secret: h0.secret }), { code: "login_required" });

  assert.equal((await post(port, "/api/hesap/kayit", { kullanici: "ab", sifre: "123456" })).status, 400);
  assert.equal((await post(port, "/api/hesap/kayit", { kullanici: "Ayşe", sifre: "123" })).status, 400);
  const k = await post(port, "/api/hesap/kayit", { kullanici: "Ayşe", sifre: "ejder123", userId: h0.me.id, secret: h0.secret });
  assert.equal(k.status, 200); assert.equal(k.body.userId, h0.me.id, "eski kimlik hesaba bağlanır");
  assert.equal((await post(port, "/api/hesap/kayit", { kullanici: "AYŞE", sifre: "baska123" })).status, 409);
  assert.equal((await post(port, "/api/hesap/giris", { kullanici: "ayşe", sifre: "yanlis1" })).status, 401);
  const g = await post(port, "/api/hesap/giris", { kullanici: "ayşe", sifre: "ejder123" });
  assert.equal(g.status, 200); assert.equal(g.body.userId, h0.me.id);

  const ha = await a.call("hello", { name: "Başka ad", userId: g.body.userId, secret: g.body.secret });
  assert.equal(ha.me.id, h0.me.id); assert.equal(ha.me.name, "Ayşe"); assert.equal(ha.me.kullanici, "Ayşe");
  // İkinci cihazdaki oturum da geçerli; şifre değişince o kapanır, bu açık kalır.
  const b = client(port); await b.opened;
  await b.call("hello", { userId: k.body.userId, secret: k.body.secret });
  await assert.rejects(a.call("sifreDegistir", { eski: "yanlis", yeni: "yeni1234" }), { code: "bad_login" });
  await a.call("sifreDegistir", { eski: "ejder123", yeni: "yeni1234" });
  const b2 = client(port); await b2.opened;
  await assert.rejects(b2.call("hello", { userId: k.body.userId, secret: k.body.secret }), { code: "login_required" });
  assert.equal((await post(port, "/api/hesap/giris", { kullanici: "Ayşe", sifre: "yeni1234" })).status, 200);
  for (const c of [a, b, b2]) c.ws.close();
  await srv.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("profil, arkadaşlık ve özel mesaj", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zm-"));
  const srv = createServer({ dataDir: dir, hesap: "zorunlu" });
  const port = await srv.listen(0, "127.0.0.1");
  const gir = async ad => { const r = await post(port, "/api/hesap/kayit", { kullanici: ad, sifre: "sifre123" }); const c = client(port); await c.opened; c.me = (await c.call("hello", { userId: r.body.userId, secret: r.body.secret })).me; c.token = null; return c; };
  const a = await gir("ali"), b = await gir("berk"), z = await gir("zeyno");

  // Profil fotoğrafı: önce yüklenir, sonra profile yazılır. Başkasının dosyası kullanılamaz.
  const hb = await b.call("hello", {}).catch(e => e); assert.ok(hb); // ikinci hello zararsız
  await assert.rejects(a.call("profilYaz", { foto: "/assets/yok.png" }), { code: "invalid_argument" });
  const p = await a.call("profilYaz", { hakkinda: "Zindan ustası", renk: "#c0392b" });
  assert.equal(p.renk, "#c0392b");
  const pa = await b.call("kisi", { kullanici: "ALI" });
  assert.equal(pa.hakkinda, "Zindan ustası"); assert.equal(pa.arkadas, null);

  const ara = await a.call("kisiAra", { q: "er" });
  assert.deepEqual(ara.map(x => x.kullanici), ["berk"]);

  await assert.rejects(a.call("dmGonder", { to: b.me.id, text: "selam" }), { code: "permission_denied" });
  assert.equal(await a.call("arkadasIstek", { kullanici: "berk" }), "giden");
  await assert.rejects(a.call("set", { path: `data/users/${a.me.id}/arkadas/${z.me.id}`, data: { durum: "arkadas" } }), { code: "permission_denied" });
  assert.equal((await b.call("kisi", { kisi: a.me.id })).arkadas, "gelen");
  assert.equal(await b.call("arkadasKabul", { kisi: a.me.id }), "arkadas");

  await b.call("sub", { kind: "col", path: `data/users/${b.me.id}/konusma`, sid: "k" });
  const r = await a.call("dmGonder", { to: b.me.id, text: "Bu akşam oyun var mı?" });
  await a.call("dmGonder", { to: b.me.id, text: "Saat 9?" });
  await wait(50);
  const kb = srv.store.get(`data/users/${b.me.id}/konusma/${a.me.id}`);
  assert.equal(kb.okunmamis, 2); assert.equal(kb.son, "Saat 9?");
  assert.ok(b.events.some(e => e.sid === "k"));
  assert.equal(srv.store.get(`data/users/${a.me.id}/konusma/${b.me.id}`).okunmamis, 0);
  assert.equal(srv.store.list(`data/users/${b.me.id}/dm/${a.me.id}`).length, 2);
  assert.ok(srv.store.get(`data/users/${a.me.id}/dm/${b.me.id}/${r.id}`));
  // Başkası okuyamaz.
  await assert.rejects(z.call("query", { path: `data/users/${b.me.id}/dm/${a.me.id}` }), { code: "permission_denied" });
  await b.call("dmOkundu", { kisi: a.me.id });
  assert.equal(srv.store.get(`data/users/${b.me.id}/konusma/${a.me.id}`).okunmamis, 0);

  // Karşılıklı istek: ikinci istek arkadaşlığı başlatır. Silme iki taraftan da kaldırır.
  await z.call("arkadasIstek", { kisi: a.me.id });
  assert.equal(await a.call("arkadasIstek", { kisi: z.me.id }), "arkadas");
  await z.call("arkadasSil", { kisi: a.me.id });
  assert.equal(srv.store.get(`data/users/${a.me.id}/arkadas/${z.me.id}`), undefined);

  const pr = await a.call("profiles", { ids: [b.me.id] });
  assert.equal(pr[b.me.id].kullanici, "berk"); assert.equal(pr[b.me.id].cevrimici, true);
  for (const c of [a, b, z]) c.ws.close();
  await srv.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("sohbet grupları", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zm-"));
  const srv = createServer({ dataDir: dir, hesap: "zorunlu" });
  const port = await srv.listen(0, "127.0.0.1");
  const gir = async ad => { const r = await post(port, "/api/hesap/kayit", { kullanici: ad, sifre: "sifre123" }); const c = client(port); await c.opened; c.me = (await c.call("hello", { userId: r.body.userId, secret: r.body.secret })).me; return c; };
  const a = await gir("ali"), b = await gir("berk"), z = await gir("zeyno"), y = await gir("yabanci");
  const dost = async (x, w) => { await x.call("arkadasIstek", { kisi: w.me.id }); await w.call("arkadasKabul", { kisi: x.me.id }); };
  await dost(a, b); await dost(a, z); await dost(b, y);

  await assert.rejects(a.call("grupKur", { ad: "Masa", uyeler: [y.me.id] }), { code: "invalid_argument" }, "arkadaş olmayan eklenmez");
  const { id: gid } = await a.call("grupKur", { ad: "  Cuma   Masası ", uyeler: [b.me.id, y.me.id] });
  assert.match(gid, /^gr-/);
  let bilgi = await b.call("grupBilgi", { grup: gid });
  assert.equal(bilgi.ad, "Cuma Masası"); assert.equal(bilgi.sahip, a.me.id);
  assert.deepEqual(bilgi.uyeler.map(u => u.kullanici), ["ali", "berk"]);
  await assert.rejects(z.call("grupBilgi", { grup: gid }), { code: "not_found" });
  await assert.rejects(z.call("query", { path: `data/users/${b.me.id}/grup/${gid}` }), { code: "permission_denied" });

  await b.call("grupMesaj", { grup: gid, text: "Selam grup" });
  const ka = srv.store.get(`data/users/${a.me.id}/konusma/${gid}`);
  assert.equal(ka.grup, true); assert.equal(ka.son, "berk: Selam grup"); assert.equal(ka.okunmamis, 1);
  assert.equal(srv.store.get(`data/users/${b.me.id}/konusma/${gid}`).okunmamis, 0);
  // Üye kendi arkadaşını ekleyebilir; yeni üye eski iletileri görmez, katıldığı andan sonrasını görür.
  await b.call("grupEkle", { grup: gid, kisi: y.me.id });
  await y.call("grupMesaj", { grup: gid, text: "Ben de geldim" });
  assert.equal(srv.store.list(`data/users/${a.me.id}/grup/${gid}`).filter(d => !d.data.sistem).length, 2);
  assert.equal(srv.store.list(`data/users/${y.me.id}/grup/${gid}`).filter(d => !d.data.sistem).length, 1);
  await assert.rejects(b.call("grupCikar", { grup: gid, kisi: y.me.id }), { code: "permission_denied" });
  await a.call("grupAdi", { grup: gid, ad: "Pazar Masası" });
  assert.equal(srv.store.get(`data/users/${y.me.id}/konusma/${gid}`).ad, "Pazar Masası");
  await a.call("dmOkundu", { kisi: gid });
  assert.equal(srv.store.get(`data/users/${a.me.id}/konusma/${gid}`).okunmamis, 0);

  // Kuran ayrılınca grup en eski üyeye geçer; çıkan kişinin kutusu temizlenir.
  await a.call("grupCik", { grup: gid });
  assert.equal(srv.store.get(`data/users/${a.me.id}/konusma/${gid}`), undefined);
  assert.equal(srv.store.list(`data/users/${a.me.id}/grup/${gid}`).length, 0);
  bilgi = await b.call("grupBilgi", { grup: gid });
  assert.equal(bilgi.sahip, b.me.id); assert.equal(bilgi.uyeler.length, 2);
  await b.call("grupCikar", { grup: gid, kisi: y.me.id });
  await assert.rejects(y.call("grupMesaj", { grup: gid, text: "?" }), { code: "not_found" });
  await b.call("grupCik", { grup: gid });
  assert.equal(srv.store.get("_sys/grup/" + gid), undefined, "son üye ayrılınca grup silinir");
  for (const c of [a, b, z, y]) c.ws.close();
  await srv.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("hesapsız sunucuda sosyal işlemler hesap ister", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zm-"));
  const srv = createServer({ dataDir: dir });
  const port = await srv.listen(0, "127.0.0.1");
  const a = client(port); await a.opened;
  await a.call("hello", { name: "Misafir" });
  await assert.rejects(a.call("kisiAra", { q: "x" }), { code: "hesap_gerekli" });
  a.ws.close(); await srv.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
