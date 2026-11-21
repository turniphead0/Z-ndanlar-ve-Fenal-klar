// Profil sayfası: /profil sunulur, profilForum kişinin konularını ve yanıtlarını toplar.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const WebSocket = require("ws");
const { createServer } = require("../server");

function client(port) {
  const ws = new WebSocket(`ws://localhost:${port}/ws`); let n = 0; const wait = new Map();
  ws.on("message", raw => { const m = JSON.parse(raw); if (m.ev) return; const w = wait.get(m.re); if (!w) return; wait.delete(m.re); m.error ? w.rej(Object.assign(new Error(m.error.message), m.error)) : w.res(m.result); });
  const call = (op, a) => new Promise((res, rej) => { const id = ++n; wait.set(id, { res, rej }); ws.send(JSON.stringify({ id, op, ...a })); });
  return { ws, call, opened: new Promise(r => ws.once("open", r)) };
}
async function kur() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zm-"));
  const srv = createServer({ dataDir: dir, hesap: "zorunlu" });
  const port = await srv.listen(0, "127.0.0.1");
  const kisiler = [];
  async function kisi(ad) {
    const r = await fetch(`http://127.0.0.1:${port}/api/hesap/kayit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kullanici: ad, sifre: "Zar-Kule-4471" }) }).then(r => r.json());
    const c = client(port); await c.opened;
    const h = await c.call("hello", { userId: r.userId, secret: r.secret });
    c.id = h.me.id; kisiler.push(c); return c;
  }
  const bitir = async () => { for (const c of kisiler) c.ws.close(); await srv.close(); fs.rmSync(dir, { recursive: true, force: true }); };
  return { srv, port, kisi, bitir };
}
const bekle = ms => new Promise(r => setTimeout(r, ms));

test("profil sayfası ve dosyaları sunulur", async () => {
  const { port, bitir } = await kur();
  try {
    for (const [yol, tur] of [["/profil", "text/html"], ["/profil/profil.js", "javascript"], ["/profil/profil.css", "text/css"]]) {
      const r = await fetch(`http://127.0.0.1:${port}${yol}`);
      assert.equal(r.status, 200, yol); assert.match(r.headers.get("content-type"), new RegExp(tur));
    }
    assert.equal((await fetch(`http://127.0.0.1:${port}/profil/yok.js`)).status, 404);
    assert.equal((await fetch(`http://127.0.0.1:${port}/profil/../server/index.js`)).status, 404);
  } finally { await bitir(); }
});

test("profilForum: kişinin açtığı konular ve yazdığı yanıtlar, en yeni önce", async () => {
  const { kisi, bitir } = await kur();
  try {
    const a = await kisi("ayse"), b = await kisi("burak");
    const t1 = await a.call("forumTopic", { title: "Cuma CoC", body: "İki oyuncu arıyoruz", kategori: "Oyuncu arıyorum" });
    await bekle(1100);
    const t2 = await b.call("forumTopic", { title: "Kural sorusu", body: "Avantaj nasıl işler?" });
    await bekle(1100);
    await a.call("forumReply", { topic: t2.id, body: "İki zar at, büyüğü al." });
    await bekle(1100);
    await b.call("forumReply", { topic: t1.id, body: "Ben varım" });

    const fa = await b.call("profilForum", { kisi: a.id });
    assert.deepEqual(fa.sayi, { konu: 1, yanit: 1 });
    assert.equal(fa.konular[0].id, t1.id); assert.equal(fa.konular[0].baslik, "Cuma CoC"); assert.equal(fa.konular[0].yanit, 1);
    assert.equal(fa.konular[0].kategori, "Oyuncu arıyorum");
    assert.equal(fa.yanitlar[0].konu, t2.id); assert.equal(fa.yanitlar[0].baslik, "Kural sorusu"); assert.match(fa.yanitlar[0].ozet, /İki zar/);

    const kendi = await b.call("profilForum", {});
    assert.deepEqual(kendi.sayi, { konu: 1, yanit: 1 });
    // Silinen konu profilden de düşer.
    await a.call("forumDelete", { topic: t1.id });
    assert.deepEqual((await a.call("profilForum", { kisi: b.id })).sayi, { konu: 1, yanit: 0 });

    await assert.rejects(a.call("profilForum", { kisi: "u-00000000" }), { code: "not_found" });
    await assert.rejects(a.call("profilForum", { kisi: "../_sys" }), { code: "invalid_argument" });
  } finally { await bitir(); }
});

test("kisi işlemi kullanıcı adıyla da bulur (/profil?ad=…)", async () => {
  const { kisi, bitir } = await kur();
  try {
    const a = await kisi("Ayşe_1"), b = await kisi("burak");
    const p = await b.call("kisi", { kullanici: "ayşe_1" });
    assert.equal(p.id, a.id); assert.equal(p.kullanici, "Ayşe_1"); assert.equal(p.arkadas, null);
  } finally { await bitir(); }
});
