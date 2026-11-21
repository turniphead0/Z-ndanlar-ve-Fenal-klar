const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");
const { createServer } = require("../server");
const { Store } = require("../server/store");

const bekle = ms => new Promise(r => setTimeout(r, ms));
function client(port) {
  const ws = new WebSocket(`ws://localhost:${port}/ws`); let n = 0; const wait = new Map(), events = [];
  ws.on("message", raw => { const m = JSON.parse(raw); if (m.ev) events.push(m); else { const w = wait.get(m.re); wait.delete(m.re); m.error ? w.rej(Object.assign(new Error(m.error.message), m.error)) : w.res(m.result); } });
  const call = (op, a) => new Promise((res, rej) => { const id = ++n; wait.set(id, { res, rej }); ws.send(JSON.stringify({ id, op, ...a })); });
  return { ws, call, events, opened: new Promise(r => ws.once("open", r)) };
}
function istek(port, yol, headers = {}) {
  return new Promise((res, rej) => http.get({ host: "127.0.0.1", port, path: yol, headers }, r => {
    const parca = []; r.on("data", c => parca.push(c)); r.on("end", () => res({ status: r.statusCode, headers: r.headers, body: Buffer.concat(parca) }));
  }).on("error", rej));
}

test("depo: kopya verir, arkada diske yazar, kapanışta eşzamanlı yazar", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zm-"));
  const f = path.join(dir, "db.json");
  const s = new Store(f);
  const gelen = [];
  s.listeners.add((type, p, data, json) => gelen.push({ type, p, data, json }));
  const d = { a: 1, b: { c: 2 } };
  s.set("x/1", d); d.a = 99;
  assert.equal(s.get("x/1").a, 1, "set çağıranın nesnesini saklamamalı");
  const g = s.get("x/1"); g.a = 5;
  assert.equal(s.get("x/1").a, 1, "get kopya vermeli");
  s.update("x/1", { b: { e: 3 } });
  assert.deepEqual(s.get("x/1"), { a: 1, b: { c: 2, e: 3 } });
  s.set("x/2", { a: 2 }); s.delete("x/2");
  assert.equal(s.count("x"), 1);
  assert.deepEqual(gelen.map(e => e.type), ["added", "modified", "added", "removed"]);
  assert.deepEqual(JSON.parse(gelen[1].json), gelen[1].data);
  assert.deepEqual(gelen[3].data, { a: 2 }, "silinen belgenin son hâli bildirilmeli");
  await bekle(1300);
  assert.deepEqual(JSON.parse(fs.readFileSync(f, "utf8")).docs, { "x/1": { a: 1, b: { c: 2, e: 3 } } });
  s.set("x/3", { "ç": "ğüşiöı" }); s.flush();
  const s2 = new Store(f);
  assert.equal(s2.get("x/3")["ç"], "ğüşiöı");
  assert.equal(s2.count("x"), 2);
  await bekle(50);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("statik dosyalar: sürümlü adres, ETag/304 ve sıkıştırma", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zm-"));
  const srv = createServer({ dataDir: dir });
  const port = await srv.listen(0, "127.0.0.1");
  const ana = await istek(port, "/");
  assert.equal(ana.status, 200);
  assert.equal(ana.headers["cache-control"], "no-cache");
  const html = ana.body.toString("utf8");
  const shim = /<script src="(\/shim\.js\?v=[A-Za-z0-9_-]+)">/.exec(html);
  assert.ok(shim, "shim.js sürümlü adresle eklenmeli");
  const r = await istek(port, shim[1], { "accept-encoding": "gzip, br" });
  assert.equal(r.status, 200);
  assert.match(r.headers["cache-control"], /immutable/);
  assert.equal(r.headers["content-encoding"], "br");
  assert.ok(r.body.length < fs.statSync(path.join(__dirname, "..", "web", "shim.js")).size / 2);
  const tekrar = await istek(port, "/", { "if-none-match": ana.headers.etag });
  assert.equal(tekrar.status, 304);
  const gz = await istek(port, "/ext/veri-5e.js", { "accept-encoding": "gzip" });
  assert.equal(gz.headers["content-encoding"], "gzip");
  assert.equal(require("zlib").gunzipSync(gz.body).toString(), fs.readFileSync(path.join(__dirname, "..", "web", "ext", "veri-5e.js"), "utf8"));
  await srv.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("imleç ve oda mesajları yalnızca aynı oyundakilere gider", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zm-"));
  const srv = createServer({ dataDir: dir });
  const port = await srv.listen(0, "127.0.0.1");
  const [a, b, c] = [client(port), client(port), client(port)];
  for (const x of [a, b, c]) await x.opened;
  const ha = await a.call("hello", { name: "A" }); await b.call("hello", { name: "B" }); await c.call("hello", { name: "C" });
  await a.call("presence", { data: { g: "g1", view: "harita" } });
  await b.call("presence", { data: { g: "g1", view: "harita" } });
  await c.call("presence", { data: { g: "g2", view: "harita" } });
  await bekle(30);
  for (const x of [a, b, c]) x.events.length = 0;
  await a.call("presence", { data: { cur: [1, 2] } });
  await a.call("emit", { topic: "drag", data: { id: "t1" } });
  await bekle(50);
  const pres = b.events.find(e => e.ev === "pres");
  assert.ok(pres && pres.by === ha.me.id && pres.presence.g === "g1" && pres.presence.cur[0] === 1);
  assert.ok(b.events.some(e => e.ev === "msg" && e.topic === "drag"));
  assert.ok(!c.events.some(e => e.ev === "pres" || e.ev === "peers" || e.ev === "msg"), "başka oyundakine gitmemeli");
  assert.ok(!b.events.some(e => e.ev === "peers"), "imleç için bütün liste gönderilmemeli");
  // Görünüm değişikliği seyrek olduğu için herkese bütün liste gider.
  await a.call("presence", { data: { view: "notlar" } });
  await bekle(50);
  assert.ok(c.events.some(e => e.ev === "peers"));
  for (const x of [a, b, c]) x.ws.close();
  await srv.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
