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
