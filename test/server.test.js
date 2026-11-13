const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const WebSocket = require("ws");
const { createServer, canAccess } = require("../server");

function client(port) {
  const ws = new WebSocket(`ws://localhost:${port}/ws`); let n = 0; const wait = new Map(), events = [];
  ws.on("message", raw => { const m = JSON.parse(raw); if (m.ev) events.push(m); else { const w = wait.get(m.re); wait.delete(m.re); m.error ? w.rej(Object.assign(new Error(m.error.message), m.error)) : w.res(m.result); } });
  const call = (op, a) => new Promise((res, rej) => { const id = ++n; wait.set(id, { res, rej }); ws.send(JSON.stringify({ id, op, ...a })); });
  return { ws, call, events, opened: new Promise(r => ws.once("open", r)) };
}

test("izinler", () => {
  assert.ok(canAccess("u-1", "games/g1/chars/c1"));
  assert.ok(canAccess("u-1", "data/users/u-1/g-g1/monsters/m"));
  assert.ok(!canAccess("u-1", "data/users/u-2/g-g1/monsters/m"));
  assert.ok(!canAccess("u-1", "_sys/users/u-1"));
  assert.ok(!canAccess("u-1", "games/../_sys/x"));
});

test("şifre, belge senkronu, oda mesajları ve kalıcılık", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zm-"));
  const srv = createServer({ dataDir: dir, password: "ejder" });
  const port = await srv.listen(0, "127.0.0.1");
  const a = client(port), b = client(port); await a.opened; await b.opened;
  await assert.rejects(a.call("hello", { name: "A", password: "x" }), { code: "bad_password" });
  const ha = await a.call("hello", { name: "A", password: "ejder" });
  const hb = await b.call("hello", { name: "B", ownerKey: srv.ownerKey });
  assert.equal(hb.isOwner, true); assert.equal(ha.isOwner, false);

  await b.call("sub", { kind: "col", path: "games/g1/chars", sid: "s1" });
  await a.call("set", { path: "games/g1/chars/c1", data: { name: "Thalia", hp: { cur: 10, max: 20 } } });
  await a.call("update", { path: "games/g1/chars/c1", data: { hp: { cur: 7 } } });
  await new Promise(r => setTimeout(r, 50));
  const snaps = b.events.filter(e => e.sid === "s1").flatMap(e => e.changes);
  assert.deepEqual(snaps.map(c => c.type), ["added", "modified"]);
  assert.deepEqual(snaps[1].data.hp, { cur: 7, max: 20 });

  await assert.rejects(a.call("get", { path: `data/users/${hb.me.id}/g-g1/monsters/m1` }), { code: "permission_denied" });
  await a.call("emit", { topic: "ping", data: { x: 1 } });
  await new Promise(r => setTimeout(r, 50));
  assert.ok(b.events.some(e => e.ev === "msg" && e.topic === "ping" && e.by === ha.me.id));

  // aynı kimlikle yeniden bağlanma
  const a2 = client(port); await a2.opened;
  const again = await a2.call("hello", { name: "A", password: "ejder", userId: ha.me.id, secret: ha.secret });
  assert.equal(again.me.id, ha.me.id);
  const forged = await a2.call("hello", { name: "A", password: "ejder", userId: ha.me.id, secret: "yanlis" });
  assert.notEqual(forged.me.id, ha.me.id);

  for (const c of [a, b, a2]) c.ws.close();
  await srv.close();
  const srv2 = createServer({ dataDir: dir });
  assert.equal(srv2.store.get("games/g1/chars/c1").hp.cur, 7);
  assert.equal(srv2.ownerKey, srv.ownerKey);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("eklentiler sayfaya eklenir ve sunulur", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zm-"));
  const srv = createServer({ dataDir: dir });
  const port = await srv.listen(0, "127.0.0.1");
  const html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
  const scripts = [...html.matchAll(/<script src="\/ext\/([a-z0-9-]+)\.js"><\/script>/g)].map(m => m[1]);
  assert.ok(scripts.indexOf("veri-5e") < scripts.indexOf("sihirbaz"), "veri dosyası önce yüklenmeli");
  for (const n of scripts) assert.equal((await fetch(`http://127.0.0.1:${port}/ext/${n}.js`)).status, 200, n);
  await srv.close();
});

test("5e verisi: büyü yuvaları ve büyüler", () => {
  global.window = {};
  require("../web/ext/veri-5e.js");
  const z = window.ZM5E;
  assert.deepEqual(z.slotsFor("full", 5).slice(0, 4), [4, 3, 2, 0]);
  assert.deepEqual(z.slotsFor("half", 1), Array(9).fill(0));
  assert.deepEqual(z.slotsFor("half", 5).slice(0, 3), [4, 2, 0]);
  assert.equal(z.slotsFor("pact", 11)[4], 3);
  assert.equal(z.XP.length, 20);
  const keys = new Set();
  for (const s of z.SPELLS) { assert.ok(!keys.has(s.k), "çift büyü " + s.k); keys.add(s.k); assert.ok(s.lvl >= 0 && s.lvl <= 9); assert.ok(/^[BCDPRSKW]+$/.test(s.cls), s.k); }
  delete global.window;
});

test("PF2e verisi: yuvalar, yeterlilik ve büyüler", () => {
  global.window = {};
  require("../web/ext/veri-pf2e.js");
  const p = window.ZMPF;
  assert.deepEqual(p.slotsFor(2, 1).slice(0, 2), [2, 0]);
  assert.deepEqual(p.slotsFor(3, 3).slice(0, 3), [4, 3, 0]);
  assert.equal(p.slotsFor(2, 19)[9], 1);
  assert.equal(p.prof(0, 5), 0); assert.equal(p.prof(1, 1), 3); assert.equal(p.prof(4, 20), 28);
  assert.equal(p.cantripRank(5), 3);
  assert.ok(p.GAINS(5).boosts && p.GAINS(3).skillInc && !p.GAINS(2).skillInc);
  const keys = new Set();
  for (const s of p.SPELLS) { assert.ok(!keys.has(s.k), "çift büyü " + s.k); keys.add(s.k); assert.ok(s.rank >= 0 && s.rank <= 10); assert.ok(/^[ADOP]+$/.test(s.trad), s.k); }
  for (const c of p.CLASSES) assert.equal(c.r.length, 7, c.k);
  delete global.window;
});

test("hazır maceralar: katalogdaki her macera dosyası geçerli ve tutarlı", () => {
  global.window = {}; global.document = { addEventListener() {} };
  require("../web/ext/maceralar.js");
  const list = window.MACERA_LIST;
  assert.ok(list.length >= 2);
  for (const m of list) {
    assert.ok(m.credit && m.license && m.licenseUrl && m.source, m.id + " atıf eksik");
    const d = JSON.parse(fs.readFileSync(path.join(__dirname, "../web/ext/maceralar", m.id + ".json"), "utf8"));
    assert.ok(d.pages.length > 0 && d.scenario.guide.premise, m.id);
    assert.ok(/LİSANS/.test(d.pages[d.pages.length - 1]), m.id + " son sayfa atıf olmalı");
    for (const col of ["chars", "monsters", "maps", "notes", "dmnotes"]) for (const [id, o] of Object.entries(d[col] || {})) assert.equal(id, o.id, `${m.id} ${col} ${id}`);
    for (const n of d.scenario.npcs) if (n.cardId) assert.ok(d.monsters[n.cardId], `${m.id} kart yok: ${n.cardId}`);
    for (const x of d.scenario.maps) assert.ok(d.maps[x.mapId], `${m.id} harita yok: ${x.mapId}`);
    for (const h of d.scenario.handouts) if (h.img) assert.ok(fs.existsSync(path.join(__dirname, "../web", h.img)), h.img);
    for (const mp of Object.values(d.maps)) for (const t of Object.values(mp.tokens)) if (t.monsterId) assert.ok(d.monsters[t.monsterId], t.monsterId);
  }
  delete global.window; delete global.document;
});

test("mobilya simgeleri: katalogdaki her simge sunulur", async () => {
  const src = fs.readFileSync(path.join(__dirname, "../web/ext/mobilya.js"), "utf8");
  const codes = [...src.matchAll(/:([0-9a-f]{4,5}):[01]:/g)].map(m => m[1]);
  assert.ok(codes.length > 50, "katalog okunamadı");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zm-"));
  const srv = createServer({ dataDir: dir });
  const port = await srv.listen(0, "127.0.0.1");
  for (const c of new Set(codes)) {
    const r = await fetch(`http://127.0.0.1:${port}/ext/mobilya/${c}.svg`);
    assert.equal(r.status, 200, c); assert.equal(r.headers.get("content-type"), "image/svg+xml", c);
  }
  assert.equal((await fetch(`http://127.0.0.1:${port}/ext/mobilya/..%2fmobilya.js`)).status, 404);
  await srv.close();
});

test("sohbet: ortak mesaj, fısıltı ve izinler", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zm-"));
  const srv = createServer({ dataDir: dir });
  const port = await srv.listen(0, "127.0.0.1");
  const a = client(port), b = client(port), c = client(port); await a.opened; await b.opened; await c.opened;
  const ha = await a.call("hello", { name: "DM" }), hb = await b.call("hello", { name: "Oyuncu" }), hc = await c.call("hello", { name: "Yabancı" });
  await a.call("set", { path: "games/g-1", data: { name: "Oyun", dms: { [ha.me.id]: true }, players: { [hb.me.id]: { joined: 1 } } } });

  await b.call("sub", { kind: "col", path: "chat/g-1", sid: "pub" });
  await a.call("chatSend", { game: "g-1", text: "Merhaba 🎲", gif: "https://media.giphy.com/media/x/giphy.gif" });
  await assert.rejects(c.call("chatSend", { game: "g-1", text: "selam" }), { code: "permission_denied" });
  await assert.rejects(a.call("chatSend", { game: "g-1", text: "", gif: "javascript:alert(1)" }), { code: "invalid_argument" });
  await assert.rejects(a.call("chatSend", { game: "g-1", text: "x", to: hc.me.id }), { code: "invalid_argument" });
  // istemci sohbet belgelerini kendisi yazamaz (gönderen sahte olmasın)
  await assert.rejects(b.call("set", { path: "chat/g-1/m1", data: { by: ha.me.id, text: "sahte" } }), { code: "permission_denied" });
  await assert.rejects(b.call("set", { path: `data/users/${hb.me.id}/chat/g-1/m1`, data: { by: ha.me.id, text: "sahte" } }), { code: "permission_denied" });

  await b.call("chatSend", { game: "g-1", text: "psst", to: ha.me.id });
  await new Promise(r => setTimeout(r, 50));
  const pub = b.events.filter(e => e.sid === "pub").flatMap(e => e.changes).map(x => x.data);
  assert.deepEqual(pub.map(x => [x.by, x.text]), [[ha.me.id, "Merhaba 🎲"]]);
  const forA = await a.call("query", { path: `data/users/${ha.me.id}/chat/g-1` });
  assert.equal(forA[0].data.text, "psst"); assert.equal(forA[0].data.by, hb.me.id); assert.equal(forA[0].data.to, ha.me.id);
  assert.equal((await b.call("query", { path: `data/users/${hb.me.id}/chat/g-1` })).length, 1);
  await assert.rejects(c.call("query", { path: `data/users/${ha.me.id}/chat/g-1` }), { code: "permission_denied" });

  await assert.rejects(b.call("chatClear", { game: "g-1" }), { code: "permission_denied" });
  await a.call("chatClear", { game: "g-1" });
  assert.equal((await a.call("query", { path: "chat/g-1" })).length, 0);

  for (const x of [a, b, c]) x.ws.close();
  await srv.close(); fs.rmSync(dir, { recursive: true, force: true });
});

test("forum: başlık, yanıt, silme ve izinler", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zm-"));
  const srv = createServer({ dataDir: dir });
  const port = await srv.listen(0, "127.0.0.1");
  const a = client(port), b = client(port), o = client(port); await a.opened; await b.opened; await o.opened;
  const ha = await a.call("hello", { name: "Ayşe", color: "#c0392b" });
  const hb = await b.call("hello", { name: "Bora" });
  await o.call("hello", { name: "Sahip", ownerKey: srv.ownerKey });

  // istemci forum belgelerini doğrudan yazamaz
  await assert.rejects(a.call("set", { path: "forum/tsahte", data: { baslik: "x", yazar: { id: hb.me.id, name: "Bora" } } }), { code: "permission_denied" });
  await assert.rejects(a.call("forumTopic", { title: "   " }), { code: "invalid_argument" });

  const { id } = await a.call("forumTopic", { title: "  Cuma   CoC oyunu ", body: "2 oyuncu arıyoruz", kategori: "Oyuncu arıyorum", sistem: "coc7", yazar: { id: hb.me.id } });
  let t = srv.store.get("forum/" + id);
  assert.equal(t.baslik, "Cuma CoC oyunu");
  assert.equal(t.kategori, "Oyuncu arıyorum");
  assert.equal(t.sistem, "coc7");
  assert.equal(t.yazar.id, ha.me.id); // yazar kimlikten gelir, istemcinin gönderdiğinden değil
  assert.equal(t.yazar.name, "Ayşe");

  // çok hızlı ikinci ileti reddedilir
  await assert.rejects(a.call("forumReply", { topic: id, body: "hemen" }), { code: "too_fast" });
  const r = await b.call("forumReply", { topic: id, body: "Ben varım" });
  t = srv.store.get("forum/" + id);
  assert.equal(t.yanit, 1); assert.equal(t.sonYazan, "Bora");
  assert.equal(srv.store.list("forum/" + id + "/yanitlar").length, 1);

  // başkasının iletisi silinemez, sabitlemeyi yalnızca sahip yapar
  await assert.rejects(a.call("forumDelete", { topic: id, post: r.id }), { code: "permission_denied" });
  await assert.rejects(b.call("forumDelete", { topic: id }), { code: "permission_denied" });
  await assert.rejects(a.call("forumPin", { topic: id, sabit: true }), { code: "permission_denied" });
  await o.call("forumPin", { topic: id, sabit: true });
  assert.equal(srv.store.get("forum/" + id).sabit, true);

  await b.call("forumDelete", { topic: id, post: r.id });
  assert.equal(srv.store.get("forum/" + id).yanit, 0);
  await a.call("forumDelete", { topic: id });
  assert.equal(srv.store.get("forum/" + id), undefined);
  await assert.rejects(o.call("forumReply", { topic: "../_sys/x", body: "x" }), { code: "not_found" });

  for (const c of [a, b, o]) c.ws.close();
  await srv.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
