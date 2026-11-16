// Güvenlik: ortak şifrenin kalkması, şifre kuralı, hesap kilidi, oturum süresi, güvenlik başlıkları.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), os = require("os"), path = require("path");
const WebSocket = require("ws");
const { createServer } = require("../server");
const { sifreKurali } = require("../server/hesap");

function client(port) {
  const ws = new WebSocket(`ws://localhost:${port}/ws`); let n = 0; const wait = new Map();
  ws.on("message", raw => { const m = JSON.parse(raw); if (m.ev) return; const w = wait.get(m.re); wait.delete(m.re); m.error ? w.rej(Object.assign(new Error(m.error.message), m.error)) : w.res(m.result); });
  const call = (op, a) => new Promise((res, rej) => { const id = ++n; wait.set(id, { res, rej }); ws.send(JSON.stringify({ id, op, ...a })); });
  return { ws, call, opened: new Promise(r => ws.once("open", r)), closed: new Promise(r => ws.once("close", (code) => r(code))) };
}
const post = async (port, p, body, headers = {}) => { const r = await fetch(`http://127.0.0.1:${port}${p}`, { method: "POST", headers, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
async function kur(opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zm-"));
  const srv = createServer({ dataDir: dir, hesap: "zorunlu", ...opts });
  const port = await srv.listen(0, "127.0.0.1");
  return { srv, port, bitir: async () => { await srv.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}

test("şifre kuralı", () => {
  assert.ok(sifreKurali("kisa1", "ali"));
  assert.ok(sifreKurali("12345678", "ali"));
  assert.ok(sifreKurali("Password", "ali"));
  assert.ok(sifreKurali("aaaaaaab", "ali"));
  assert.ok(sifreKurali("ayşe2024!", "Ayşe"), "kullanıcı adını içeremez");
  assert.equal(sifreKurali("mavi-ejder-42", "ali"), null);
});

test("hesaplı sunucuda ortak şifre yok sayılır", async () => {
  const { port, bitir } = await kur({ password: "gizli" });
  const info = await (await fetch(`http://127.0.0.1:${port}/api/info`)).json();
  assert.equal(info.needsPassword, false);
  const k = await post(port, "/api/hesap/kayit", { kullanici: "ali", sifre: "mavi-ejder-42" });
  assert.equal(k.status, 200);
  const a = client(port); await a.opened;
  const h = await a.call("hello", { userId: k.body.userId, secret: k.body.secret });
  assert.equal(h.me.kullanici, "ali");
  a.ws.close(); await bitir();
});

test("hesapsız masada ortak şifre hâlâ çalışır", async () => {
  const { port, bitir } = await kur({ hesap: "istege-bagli", password: "gizli" });
  const a = client(port); await a.opened;
  await assert.rejects(a.call("hello", { name: "A", password: "yanlis" }), { code: "bad_password" });
  await a.call("hello", { name: "A", password: "gizli" });
  a.ws.close(); await bitir();
});

test("hesap kilidi ve uydurma X-Forwarded-For", async () => {
  const { port, bitir } = await kur();
  await post(port, "/api/hesap/kayit", { kullanici: "berk", sifre: "mavi-ejder-42" });
  // Her denemede başka bir sahte adres: adres sınırı bununla aşılamaz, hesap kilidi de devreye girer.
  for (let i = 0; i < 5; i++) assert.equal((await post(port, "/api/hesap/giris", { kullanici: "berk", sifre: "yanlis-" + i }, { "X-Forwarded-For": "10.0.0." + i })).status, 401);
  const kilit = await post(port, "/api/hesap/giris", { kullanici: "BERK", sifre: "mavi-ejder-42" });
  assert.equal(kilit.status, 429, "doğru şifre de 15 dakika beklemeli");
  await bitir();
});

test("adres sınırı: bir adresten 10 hatalı deneme", async () => {
  const { port, bitir } = await kur();
  for (let i = 0; i < 10; i++) await post(port, "/api/hesap/giris", { kullanici: "yok" + i, sifre: "x" }, { "X-Forwarded-For": "1.2.3." + i });
  assert.equal((await post(port, "/api/hesap/giris", { kullanici: "kimse", sifre: "x" })).status, 429);
  await bitir();
});

test("tüm cihazlardan çıkış ve şifre değişince öteki bağlantılar kapanır", async () => {
  const { port, bitir } = await kur();
  const k = await post(port, "/api/hesap/kayit", { kullanici: "zeyno", sifre: "mavi-ejder-42" });
  const g = await post(port, "/api/hesap/giris", { kullanici: "zeyno", sifre: "mavi-ejder-42" });
  const a = client(port), b = client(port); await a.opened; await b.opened;
  await a.call("hello", { userId: k.body.userId, secret: k.body.secret });
  await b.call("hello", { userId: g.body.userId, secret: g.body.secret });
  assert.equal((await a.call("oturumlar", {})).sayi, 2);
  assert.equal((await a.call("tumCikis", {})).kapanan, 1);
  assert.equal(await b.closed, 4001);
  const b2 = client(port); await b2.opened;
  await assert.rejects(b2.call("hello", { userId: g.body.userId, secret: g.body.secret }), { code: "login_required" });
  await assert.rejects(a.call("sifreDegistir", { eski: "mavi-ejder-42", yeni: "12345678" }), { code: "invalid_argument" });
  a.ws.close(); b2.ws.close(); await bitir();
});

test("hesaba geçince hesapsız dönemin anahtarı geçmez; süresi dolan oturum kapanır", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zm-"));
  let srv = createServer({ dataDir: dir }); let port = await srv.listen(0, "127.0.0.1");
  const e = client(port); await e.opened; const h0 = await e.call("hello", { name: "Eski" }); e.ws.close(); await srv.close();
  srv = createServer({ dataDir: dir, hesap: "zorunlu" }); port = await srv.listen(0, "127.0.0.1");
  const k = await post(port, "/api/hesap/kayit", { kullanici: "deniz", sifre: "mavi-ejder-42", userId: h0.me.id, secret: h0.secret });
  assert.equal(k.body.userId, h0.me.id);
  const a = client(port); await a.opened;
  await assert.rejects(a.call("hello", { userId: h0.me.id, secret: h0.secret }), { code: "login_required" });
  // Oturumu 31 gün önce kullanılmış gibi göster.
  const crypto = require("crypto"), yol = "_sys/oturum/" + crypto.createHash("sha256").update(k.body.secret).digest("hex");
  const o = srv.store.get(yol); srv.store.set(yol, { ...o, son: Date.now() - 31 * 24 * 3600 * 1000 });
  await assert.rejects(a.call("hello", { userId: k.body.userId, secret: k.body.secret }), { code: "login_required" });
  assert.equal(srv.store.get(yol), undefined);
  a.ws.close(); await srv.close(); fs.rmSync(dir, { recursive: true, force: true });
});

test("güvenlik başlıkları ve yüklenen dosyalar betik çalıştıramaz", async () => {
  const { port, bitir } = await kur({ hesap: "istege-bagli" });
  const r = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal(r.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.match(r.headers.get("content-security-policy"), /frame-ancestors 'self'/);
  const a = client(port); await a.opened; const h = await a.call("hello", { name: "A" });
  const up = await fetch(`http://127.0.0.1:${port}/api/assets`, { method: "POST", headers: { "Content-Type": "image/svg+xml", "X-ZM-Token": h.token }, body: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>' });
  const { url } = await up.json();
  const s = await fetch(`http://127.0.0.1:${port}${url}`);
  assert.match(s.headers.get("content-security-policy"), /sandbox/);
  assert.match(s.headers.get("content-security-policy"), /default-src 'none'/);
  const yok = await fetch(`http://127.0.0.1:${port}/yok`); assert.equal(yok.status, 404);
  a.ws.close(); await bitir();
});
