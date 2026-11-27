// Roller (admin, tester) ve botlar: tahta, kart masası ve RPG.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), os = require("os"), path = require("path");
const WebSocket = require("ws");
const { createServer } = require("../server");
const { OYUNLAR } = require("../web/oyunlar/kurallar");
const BOT = require("../web/oyunlar/bot");
const { zarAt } = require("../server/botlar");

function client(port) {
  const ws = new WebSocket(`ws://localhost:${port}/ws`); let n = 0; const wait = new Map(), events = [];
  ws.on("message", raw => { const m = JSON.parse(raw); if (m.ev) return events.push(m); const w = wait.get(m.re); wait.delete(m.re); m.error ? w.rej(Object.assign(new Error(m.error.message), m.error)) : w.res(m.result); });
  const call = (op, a) => new Promise((res, rej) => { const id = ++n; wait.set(id, { res, rej }); ws.send(JSON.stringify({ id, op, ...a })); });
  return { ws, call, events, opened: new Promise(r => ws.once("open", r)) };
}
const post = async (port, p, body) => (await fetch(`http://127.0.0.1:${port}${p}`, { method: "POST", body: JSON.stringify(body) })).json();
const bekle = (f, ms = 3000) => new Promise((res, rej) => { const t0 = Date.now(); const i = setInterval(() => { let v; try { v = f(); } catch (e) {} if (v) { clearInterval(i); res(v); } else if (Date.now() - t0 > ms) { clearInterval(i); rej(new Error("zaman aşımı")); } }, 10); });

async function kur(opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zm-"));
  const srv = createServer({ dataDir: dir, hesap: "zorunlu", admin: "Kral", botGecikme: 5, ...opts });
  const port = await srv.listen(0, "127.0.0.1");
  const acik = [];
  const baglan = async (userId, secret) => { const c = client(port); await c.opened; acik.push(c); c.me = (await c.call("hello", { userId, secret })).me; return c; };
  const gir = async ad => { const r = await post(port, "/api/hesap/kayit", { kullanici: ad, sifre: "ejderha42x" }); return baglan(r.userId, r.secret); };
  const bitir = async () => { for (const c of acik) c.ws.close(); await srv.close(); fs.rmSync(dir, { recursive: true, force: true }); };
  return { srv, port, gir, baglan, bitir };
}

test("bot yapay zekâsı her tahta oyununda yasal hamle seçer ve rastgele oyuncuyu yener", () => {
  // "Orta" bot kusursuz değildir: tek bir rastgele oyunda arada bir (mangala ve damada ~%3) kaybedebilir.
  // Bu yüzden test tohumlu rastgelelikle (her çalıştırmada aynı oyunlar) birkaç oyun oynar ve çoğunu kazanmasını ister.
  const tohum = n => () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (const [oyun, g] of Object.entries(OYUNLAR)) {
    let kazandi = 0, kaybetti = 0;
    for (let oyunNo = 1; oyunNo <= 5; oyunNo++) {
      const rng = tohum(oyunNo * 7919);
      let d = g.yeni(rng), adim = 0;
      while (!d.bitti && adim++ < 600) {
        const hs = g.hamleler(d); if (!hs.length) break;
        const h = d.sira === 0 ? BOT.hamleSec(oyun, d, "orta", rng) : hs[Math.floor(rng() * hs.length)];
        assert.ok(hs.some(x => JSON.stringify(x) === JSON.stringify(h)), oyun + " yasal olmayan hamle");
        d = g.uygula(d, h, rng);
      }
      assert.ok(d.bitti, oyun + " bitmedi");
      if (d.bitti.kazanan === 0) kazandi++; else if (d.bitti.kazanan === 1) kaybetti++;
    }
    if (oyun !== "ur") assert.ok(kazandi >= 4, `${oyun}: bot rastgele oyuncuyu 5 oyunun yalnızca ${kazandi} tanesinde yendi (${kaybetti} kayıp)`); // Ur zara bağlı
  }
});

test("zar ifadesi", () => {
  const r = zarAt("4d6kh3+2", () => 0.5);
  assert.equal(r.toplam, 4 * 3 + 2); assert.match(r.detay, /4d6\[4,4,4,~4\]/);
  assert.equal(zarAt("1d20", () => 0.99).kritik, "20");
  assert.throws(() => zarAt("rm -rf"), { code: "invalid_argument" });
});

test("roller: ZM_ADMIN admin olur, kendi kendine admin olunmaz, admin test hesabı açar", async () => {
  const t = await kur();
  try {
    const kral = await t.gir("Kral"), ali = await t.gir("ali");
    assert.equal(kral.me.rol, "admin"); assert.equal(ali.me.rol, null);
    await assert.rejects(ali.call("rolVer", { kisi: ali.me.id, rol: "admin" }), { code: "permission_denied" });
    await assert.rejects(ali.call("hesapAc", { kullanici: "sahte", sifre: "ejderha42x", rol: "admin" }), { code: "permission_denied" });
    await assert.rejects(ali.call("rolListe", {}), { code: "permission_denied" });

    // Admin test hesabı açar; o hesapla giriş yapılır ve rolü tester'dır.
    const yeni = await kral.call("hesapAc", { kullanici: "deneme1", sifre: "testci-sifre9", rol: "tester" });
    assert.equal(yeni.rol, "tester");
    await assert.rejects(kral.call("hesapAc", { kullanici: "deneme2", sifre: "123" }), { code: "invalid_argument" });
    const g = await post(t.port, "/api/hesap/giris", { kullanici: "deneme1", sifre: "testci-sifre9" });
    const tester = await t.baglan(g.userId, g.secret);
    assert.equal(tester.me.rol, "tester");
    await assert.rejects(tester.call("rolVer", { kisi: ali.me.id, rol: "tester" }), { code: "permission_denied" });

    // Rol verme ve geri alma; açık bağlantıya bildirim gider.
    await kral.call("rolVer", { kisi: ali.me.id, rol: "tester" });
    await bekle(() => ali.events.some(e => e.ev === "rol" && e.rol === "tester"));
    const liste = await kral.call("rolListe", {});
    assert.equal(liste.find(x => x.kullanici === "ali").rol, "tester");
    assert.equal(liste.find(x => x.kullanici === "Kral").sabit, true);
    await assert.rejects(kral.call("rolVer", { kisi: kral.me.id, rol: null }), { code: "failed_precondition" });
    await kral.call("rolVer", { kisi: ali.me.id, rol: null });
    assert.equal((await kral.call("rolListe", {})).find(x => x.kullanici === "ali").rol, null);
    const p = await ali.call("profiles", { ids: [kral.me.id] });
    assert.equal(p[kral.me.id].rol, "admin");
  } finally { await t.bitir(); }
});

test("tahta oyunu: herkes bot ekler, bot kendi oynar; yalnızca yönetici botu yönetir", async () => {
  const t = await kur();
  try {
    const ali = await t.gir("ali"), veli = await t.gir("veli"), kral = await t.gir("Kral");
    const { id } = await ali.call("bgNew", { oyun: "mangala" });
    await ali.call("bgSit", { board: id, koltuk: 0 });
    await assert.rejects(veli.call("botEkle", { board: id, koltuk: 1 }), { code: "permission_denied" }); // masada değil
    const bot = await ali.call("botEkle", { board: id, koltuk: 1, zorluk: "zor" });
    assert.match(bot.id, /^bot-[0-9a-f]{10}$/);
    const b0 = t.srv.store.get("boards/" + id);
    assert.equal(b0.koltuk[1].bot, true); assert.equal(b0.koltuk[1].zorluk, "zor");
    // Ali oynayınca sıra bota geçer, bot kendiliğinden oynar.
    const d = b0.durum, h = OYUNLAR.mangala.hamleler(d).find(x => x[0] !== 5) || OYUNLAR.mangala.hamleler(d)[0];
    await ali.call("bgMove", { board: id, hamle: h });
    await bekle(() => { const b = t.srv.store.get("boards/" + id); return b.durum.sira === 0 && b.durum.n >= 2; });
    // Botu otomatikten çıkarmak ve onun yerine oynamak yöneticiye özel.
    await assert.rejects(ali.call("botAyar", { board: id, koltuk: 1, oto: false }), { code: "permission_denied" });
    await kral.call("botAyar", { board: id, koltuk: 1, oto: false });
    let b = t.srv.store.get("boards/" + id);
    await ali.call("bgMove", { board: id, hamle: OYUNLAR.mangala.hamleler(b.durum)[0] });
    b = t.srv.store.get("boards/" + id);
    if (b.durum.sira === 1) {
      await new Promise(r => setTimeout(r, 40));
      assert.equal(t.srv.store.get("boards/" + id).durum.sira, 1, "otomatik kapalıyken bot oynamamalı");
      const g = await kral.call("botGorunum", { board: id, koltuk: 1 });
      assert.ok(g.hamleler.length && g.oneri);
      await assert.rejects(ali.call("botHamle", { board: id, koltuk: 1, hamle: g.hamleler[0] }), { code: "permission_denied" });
      await assert.rejects(kral.call("botHamle", { board: id, koltuk: 1, hamle: [0] }), { code: "illegal" });
      await kral.call("botHamle", { board: id, koltuk: 1, hamle: g.hamleler[0] });
    }
    await ali.call("botCikar", { board: id, koltuk: 1 });
    assert.equal(t.srv.store.get("boards/" + id).koltuk[1], null);
  } finally { await t.bitir(); }
});

test("bot bota karşı tahta oyunu sonuna kadar oynanır", async () => {
  const t = await kur({ botGecikme: 0 });
  try {
    const ali = await t.gir("ali");
    const { id } = await ali.call("bgNew", { oyun: "ur" });
    await ali.call("botEkle", { board: id, koltuk: 0, zorluk: "kolay" });
    await ali.call("botEkle", { board: id, koltuk: 1, zorluk: "zor" });
    const b = await bekle(() => { const b = t.srv.store.get("boards/" + id); return b.durum.bitti && b; }, 20000);
    assert.ok(b.durum.bitti.neden);
  } finally { await t.bitir(); }
});

test("kart masası: bot oturur, sırası gelince oynar; tester botun elini görür ve onun adına oynar", async () => {
  const t = await kur();
  try {
    const ali = await t.gir("ali"), kral = await t.gir("Kral");
    await kral.call("hesapAc", { kullanici: "deneyen", sifre: "gizli-anahtar7", rol: "tester" });
    const g = await post(t.port, "/api/hesap/giris", { kullanici: "deneyen", sifre: "gizli-anahtar7" });
    const tester = await t.baglan(g.userId, g.secret);

    const { id } = await ali.call("kmNew", { hazir: "kazan-katlet-claude" });
    const b1 = await ali.call("botEkle", { board: id, koltuk: 1 }), b2 = await ali.call("botEkle", { board: id, koltuk: 2 });
    await ali.call("botAyar", { board: id, koltuk: 1, zorluk: "zor" }); // kart masasında zorluk yok sayılır
    await tester.call("botAyar", { board: id, koltuk: 2, oto: false });
    await ali.call("kmStart", { board: id });
    // Botun eli kimseye açık değil
    await assert.rejects(ali.call("get", { path: `data/users/${b1.id}/kartmasa/${id}` }), { code: "permission_denied" });
    await assert.rejects(ali.call("botGorunum", { board: id, koltuk: 1 }), { code: "permission_denied" });
    const v = await tester.call("botGorunum", { board: id, koltuk: 1 });
    assert.ok(Array.isArray(v.el) && v.el.length > 0);
    // Ali sırayı bota verir; bot bir tur oynayıp sırayı ötekine (otomatik kapalı bot) geçirir.
    await ali.call("kmIslem", { board: id, islem: { tur: "sira", koltuk: 1 } });
    await bekle(() => t.srv.store.get("_sys/kartmasa/" + id).sira === 2);
    const d = t.srv.store.get("_sys/kartmasa/" + id);
    assert.ok(d.log.some(l => l.kisi === b1.id));
    // Botun yerine oynamak: yalnızca tester/admin, yalnızca masadaki bir bot için.
    const el2 = (await tester.call("botGorunum", { board: id, koltuk: 2 })).el;
    await assert.rejects(ali.call("kmIslem", { board: id, bot: b2.id, islem: { tur: "koy", kart: el2[0].iid, nereye: "masa", acik: true, x: 800, y: 500 } }), { code: "permission_denied" });
    await assert.rejects(tester.call("kmIslem", { board: id, bot: ali.me.id, islem: { tur: "zar", yuz: 6 } }), { code: "not_found" });
    await tester.call("kmIslem", { board: id, bot: b2.id, islem: { tur: "koy", kart: el2[0].iid, nereye: "masa", acik: true, x: 800, y: 500 } });
    assert.equal(t.srv.store.get("_sys/kartmasa/" + id).kartlar[el2[0].iid].yer, "masa");
    await tester.call("botAdim", { board: id, koltuk: 2 });
    assert.equal(t.srv.store.get("_sys/kartmasa/" + id).sira, 0);
    await assert.rejects(ali.call("botCikar", { board: id, koltuk: 1 }), { code: "failed_precondition" }); // oyun sürüyor
  } finally { await t.bitir(); }
});

test("RPG: DM bot ekler, bot zar atar ve konuşur; anılınca zar atar", async () => {
  const t = await kur();
  try {
    const dm = await t.gir("dm1"), oy = await t.gir("oyuncu1"), kral = await t.gir("Kral");
    await dm.call("set", { path: "games/g1", data: { name: "Masa", dms: { [dm.me.id]: true }, players: { [oy.me.id]: { joined: 1, charId: null } } } });
    await assert.rejects(oy.call("oyunBotEkle", { game: "g1", ad: "Gimli" }), { code: "permission_denied" });
    const { id } = await dm.call("oyunBotEkle", { game: "g1", ad: "Gimli" });
    assert.equal(t.srv.store.get("games/g1").players[id].bot, true);
    const p = await oy.call("profiles", { ids: [id] });
    assert.equal(p[id].name, "🤖 Gimli"); assert.equal(p[id].bot, true);
    await assert.rejects(oy.call("oyunBotKonus", { game: "g1", bot: id, text: "selam" }), { code: "permission_denied" });
    await kral.call("oyunBotKonus", { game: "g1", bot: id, text: "Baltam hazır!" });
    assert.ok(t.srv.store.list("chat/g1").some(x => x.data.by === id && x.data.text === "Baltam hazır!"));
    const z = await dm.call("oyunBotZar", { game: "g1", bot: id, formul: "1d20+5", etiket: "Saldırı" });
    assert.ok(z.total >= 6 && z.total <= 25);
    // Sohbette anılınca zar atar.
    await oy.call("chatSend", { game: "g1", text: "@Gimli 2d6+1 at bakalım" });
    await bekle(() => t.srv.store.list("games/g1/rolls").filter(x => x.data.by === id).length === 2);
    await dm.call("oyunBotCikar", { game: "g1", bot: id });
    assert.equal(t.srv.store.get("games/g1").players[id], null);
  } finally { await t.bitir(); }
});
