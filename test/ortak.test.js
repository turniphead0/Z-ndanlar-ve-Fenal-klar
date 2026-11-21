// Ortak menü, forum sayfası, genel arama (Ctrl+K) ve profil rozetleri.
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
  const srv = createServer({ dataDir: dir, hesap: "zorunlu", smtp: null });
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

test("ortak menü dosyaları ve forum sayfası sunulur; konu adresi önizlemede başlığı taşır", async () => {
  const { port, kisi, bitir } = await kur();
  try {
    const B = `http://127.0.0.1:${port}`;
    for (const [yol, tur] of [["/ortak.js", "javascript"], ["/ortak.css", "text/css"], ["/forum", "text/html"], ["/forum/", "text/html"], ["/forum/yeni", "text/html"], ["/forum/forum.js", "javascript"], ["/forum/forum.css", "text/css"], ["/profil/rozetler.js", "javascript"]]) {
      const r = await fetch(B + yol);
      assert.equal(r.status, 200, yol); assert.match(r.headers.get("content-type"), new RegExp(tur), yol);
    }
    assert.equal((await fetch(B + "/forum/yok.js")).status, 404);
    assert.equal((await fetch(B + "/forum/../server/index.js")).status, 404);
    // Ana sayfa ortak menüyü <head>'de yükler (tema sayfa çizilmeden uygulanır).
    const ana = await (await fetch(B + "/")).text();
    assert.match(ana.slice(0, ana.indexOf("</head>")), /ortak\.js\?v=/);
    const a = await kisi("anlatici");
    const { id } = await a.call("forumTopic", { title: "Cuma <b>CoC</b> oyunu", body: "Saat 21:00, Discord.", kategori: "Oyuncu arıyorum" });
    const html = await (await fetch(B + "/forum/" + id)).text();
    assert.match(html, /<title>Cuma &lt;b&gt;CoC&lt;\/b&gt; oyunu · Forum/);
    assert.match(html, /og:description" content="Saat 21:00, Discord\."/);
    // Bilinmeyen konu: sayfa yine açılır (konu bulunamadı mesajını sayfa gösterir).
    assert.equal((await fetch(B + "/forum/tyok123")).status, 200);
    const info = await (await fetch(B + "/api/info")).json();
    assert.equal(info.sistemler.coc7, "Call of Cthulhu");
  } finally { await bitir(); }
});

test("genel arama: oyuncu, masa ve forum konusu tek kutudan, Türkçe harf farkı gözetmeden", async () => {
  const { srv, kisi, bitir } = await kur();
  try {
    const a = await kisi("zindanci"), b = await kisi("ejderha_avcisi");
    await a.call("forumTopic", { title: "Zındanlar için ışık kuralları", body: "Karanlıkta görme nasıl?", kategori: "Kurallar" });
    await bekle(1050);
    const t2 = await b.call("forumTopic", { title: "Oyuncu arıyoruz", body: "Cuma akşamı", kategori: "Oyuncu arıyorum" });
    await bekle(1050);
    await a.call("forumReply", { topic: t2.id, body: "Ben de zindan severim" });
    srv.store.set("games/gkervan", { name: "Kayıp Kervan", desc: "Vahşi doğa macerası", system: "dnd5e", open: true, dms: { [b.id]: true }, players: { [a.id]: { joined: 1 } } });
    const bid = (await a.call("bgNew", { oyun: Object.keys(require("../web/oyunlar/kurallar").OYUNLAR)[0], ad: "Zindan turnuvası" })).id;

    const r = await b.call("genelAra", { q: "ZINDAN" });
    assert.deepEqual(r.kisiler.map(k => k.kullanici), ["zindanci"]);
    assert.equal(r.kisiler[0].cevrimici, true);
    assert.ok(!("eposta" in r.kisiler[0]));
    assert.deepEqual(r.masalar.map(m => [m.tur, m.id]), [["tahta", bid]]);
    // Başlıkta geçen önce, yalnızca yanıtında geçen sonra gelir.
    assert.deepEqual(r.konular.map(t => t.baslik), ["Zındanlar için ışık kuralları", "Oyuncu arıyoruz"]);

    const k = await a.call("genelAra", { q: "kayıp kervan" });
    assert.equal(k.masalar[0].id, "gkervan"); assert.equal(k.masalar[0].rol, "oyuncu"); assert.equal(k.masalar[0].sistemAd, "D&D 5e");
    assert.deepEqual(await a.call("genelAra", { q: "   " }), { kisiler: [], masalar: [], konular: [] });
    assert.equal((await a.call("genelAra", { q: "yokboylebirsey" })).konular.length, 0);
  } finally { await bitir(); }
});

test("rozetler: forum, galibiyet ve yönetilen oturum sayılır; masa silinse de kalır", async () => {
  const { srv, kisi, bitir } = await kur();
  try {
    const dm = await kisi("anlatici"), oyuncu = await kisi("oyuncu1");
    const bul = (r, id) => r.rozetler.find(z => z.id === id);
    let r = await dm.call("rozetler", {});
    assert.equal(r.rozetler.length, 12);
    assert.ok(r.rozetler.every(z => !z.kazanildi));

    await dm.call("forumTopic", { title: "Merhaba", body: "", kategori: "Genel sohbet" });
    // Masa oyunu: oyuncu1 kazanır.
    srv.store.set("boards/bdeneme01", { oyun: "dama", koltuk: [{ id: dm.id, name: "anlatici" }, { id: oyuncu.id, name: "oyuncu1" }], durum: { sira: 0, bitti: null }, created: 1, updated: 2 });
    srv.store.set("boards/bdeneme01", { oyun: "dama", koltuk: [{ id: dm.id, name: "anlatici" }, { id: oyuncu.id, name: "oyuncu1" }], durum: { sira: 0, bitti: { kazanan: 1 } }, created: 1, updated: 3 });
    // Aynı biten oyun yeniden yazılsa da (ör. ad değişikliği) iki kez sayılmaz.
    srv.store.set("boards/bdeneme01", { oyun: "dama", ad: "Final", koltuk: [{ id: dm.id, name: "anlatici" }, { id: oyuncu.id, name: "oyuncu1" }], durum: { sira: 0, bitti: { kazanan: 1 } }, created: 1, updated: 4 });
    srv.store.delete("boards/bdeneme01");

    // FRP oturumu: DM ile oyuncu aynı masada buluşunca DM için o gün bir oturum.
    srv.store.set("games/gmasa", { name: "Masa", system: "dnd5e", dms: { [dm.id]: true }, players: { [oyuncu.id]: { joined: 1 } } });
    await dm.call("presence", { data: { g: "gmasa" } });
    r = await dm.call("rozetler", {}); assert.equal(r.sayi.oturum, 0, "oyuncu yokken oturum sayılmaz");
    await oyuncu.call("presence", { data: { g: "gmasa" } });
    await oyuncu.call("presence", { data: { g: null } }); await oyuncu.call("presence", { data: { g: "gmasa" } });

    r = await dm.call("rozetler", {});
    assert.equal(r.sayi.oturum, 1, "aynı gün ikinci kez sayılmaz");
    for (const id of ["ilk-masa", "masa-kurucu", "ilk-oturum", "forum-ilk", "ilk-oyun"]) assert.ok(bul(r, id).kazanildi, id);
    assert.equal(bul(r, "ilk-galibiyet").kazanildi, null);
    assert.deepEqual([bul(r, "oturum-10").n, bul(r, "oturum-10").hedef], [1, 10]);

    const o = await dm.call("rozetler", { kisi: oyuncu.id });
    assert.ok(bul(o, "ilk-galibiyet").kazanildi);
    assert.equal(o.sayi.galibiyet, 1);
    assert.equal(o.sayi.biten, 1);
    await assert.rejects(dm.call("rozetler", { kisi: "u-00000000ffff" }), /Böyle biri yok/);
  } finally { await bitir(); }
});

test("gizlilik: gizli profil ve engellenen kişi genel aramada çıkmaz, rozetleri görünmez", async () => {
  const { kisi, bitir } = await kur();
  try {
    const a = await kisi("gizlici"), b = await kisi("arayan"), c = await kisi("gizlikanka");
    await a.call("gizlilikAyar", { gorunum: "gizli" });
    assert.equal((await b.call("genelAra", { q: "gizli" })).kisiler.map(k => k.kullanici).join(), "gizlikanka");
    await assert.rejects(b.call("rozetler", { kisi: a.id }), /gizli/);
    assert.ok((await a.call("rozetler", {})).rozetler.length, "kendi rozetlerini görür");
    await c.call("engelle", { kisi: b.id });
    assert.equal((await b.call("genelAra", { q: "gizli" })).kisiler.length, 0);
  } finally { await bitir(); }
});
