// Bildirimler, oda adları, yükleme kotası, Yüklediklerim, profildeki oyunlar ve sıra rehberi.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const WebSocket = require("ws");
const { createServer } = require("../server");
const { OYUNLAR } = require("../web/oyunlar/kurallar");
const REHBER = require("../web/oyunlar/rehber");

function client(port) {
  const ws = new WebSocket(`ws://localhost:${port}/ws`); let n = 0; const wait = new Map(), events = [];
  ws.on("message", raw => { const m = JSON.parse(raw); if (m.ev) events.push(m); else { const w = wait.get(m.re); wait.delete(m.re); m.error ? w.rej(Object.assign(new Error(m.error.message), m.error)) : w.res(m.result); } });
  const call = (op, a) => new Promise((res, rej) => { const id = ++n; wait.set(id, { res, rej }); ws.send(JSON.stringify({ id, op, ...a })); });
  return { ws, call, events, opened: new Promise(r => ws.once("open", r)) };
}
async function kur(opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zm-"));
  const srv = createServer({ dataDir: dir, hesap: "zorunlu", ...opts });
  const port = await srv.listen(0, "127.0.0.1");
  const kisiler = [];
  async function kisi(ad) {
    const r = await fetch(`http://127.0.0.1:${port}/api/hesap/kayit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kullanici: ad, sifre: "Zar-Kule-4471" }) }).then(r => r.json());
    const c = client(port); await c.opened;
    const h = await c.call("hello", { userId: r.userId, secret: r.secret });
    c.id = h.me.id; c.token = h.token; kisiler.push(c);
    return c;
  }
  const bitir = async () => { for (const c of kisiler) c.ws.close(); await srv.close(); fs.rmSync(dir, { recursive: true, force: true }); };
  return { srv, port, kisi, bitir };
}
const bildirimler = (srv, uid) => srv.store.list(`data/users/${uid}/bildirim`).map(d => d.data);
const bekle = ms => new Promise(r => setTimeout(r, ms));

test("oda adı: tahta açarken verilir, değiştirilebilir, yetkisiz değiştiremez", async () => {
  const { srv, kisi, bitir } = await kur();
  const a = await kisi("ayse"), b = await kisi("burak");
  const { id } = await a.call("bgNew", { oyun: "mangala", ad: "  Cuma\n akşamı   mangalası  " });
  assert.equal(srv.store.get("boards/" + id).ad, "Cuma akşamı mangalası");
  await assert.rejects(b.call("bgAd", { board: id, ad: "Benim odam" }), { code: "permission_denied" });
  await a.call("bgAd", { board: id, ad: "x".repeat(100) });
  assert.equal(srv.store.get("boards/" + id).ad.length, 60);
  await a.call("bgAd", { board: id, ad: "" });
  assert.equal(srv.store.get("boards/" + id).ad, undefined);
  // Kart masasında da ad verilir ve oyun durumu değişse de kalır.
  const k = await a.call("kmNew", { hazir: Object.keys(require("../web/oyunlar/hazir").HAZIR)[0], ad: "Kart gecesi" });
  await a.call("kmSit", { board: k.id, koltuk: 1 });
  assert.equal(srv.store.get("boards/" + k.id).ad, "Kart gecesi");
  // İstemci boards/* belgesine doğrudan yazamaz.
  await assert.rejects(a.call("update", { path: "boards/" + id, data: { ad: "hile" } }), { code: "permission_denied" });
  await bitir();
});

test("bildirim: sıra sende, masana oturdu, oyun bitti ve okundu/sil", async () => {
  const { srv, kisi, bitir } = await kur();
  const a = await kisi("ayse"), b = await kisi("burak");
  const { id } = await a.call("bgNew", { oyun: "mangala", ad: "Deneme" });
  await a.call("bgSit", { board: id, koltuk: 0 });
  await b.call("bgSit", { board: id, koltuk: 1 });
  let na = bildirimler(srv, a.id);
  assert.ok(na.some(n => n.tur === "otur" && n.kimden === b.id), "masayı açana oturan bildirilir");
  // Ayşe oynar; sıra Burak'a geçer (son taş hazineye düşmeyen bir kuyu seç).
  const d = srv.store.get("boards/" + id).durum, g = OYUNLAR.mangala;
  const h = g.hamleler(d).find(x => g.uygula(d, x).sira === 1);
  await a.call("bgMove", { board: id, hamle: h });
  let nb = bildirimler(srv, b.id);
  const sira = nb.find(n => n.id === "sira-" + id);
  assert.ok(sira && sira.tur === "sira" && !sira.okundu && sira.hedef.id === id && /Deneme/.test(sira.baslik));
  // İstemci bildirim yazamaz ama okuyabilir.
  await assert.rejects(b.call("set", { path: `data/users/${b.id}/bildirim/x`, data: {} }), { code: "permission_denied" });
  await assert.rejects(a.call("get", { path: `data/users/${b.id}/bildirim/sira-${id}` }), { code: "permission_denied" });
  assert.equal((await b.call("get", { path: `data/users/${b.id}/bildirim/sira-${id}` })).exists, true);
  await b.call("bildirimOkundu", {});
  assert.deepEqual(bildirimler(srv, b.id).filter(n => !n.okundu), []);
  await b.call("bildirimSil", {});
  assert.equal(bildirimler(srv, b.id).length, 0);
  // Oyun bitince iki oyuncuya da sonuç gider (bitişi kurallarla zorla).
  const b0 = srv.store.get("boards/" + id), a2 = Array(14).fill(0); a2[5] = 1; a2[12] = 1; a2[6] = 30; a2[13] = 10;
  srv.store.set("boards/" + id, { ...b0, durum: { ...b0.durum, a: a2, sira: 1 } });
  await b.call("bgMove", { board: id, hamle: [12] });
  assert.ok(srv.store.get("boards/" + id).durum.bitti);
  assert.ok(bildirimler(srv, a.id).some(n => n.tur === "bitti" && /Kazandın/.test(n.metin)));
  assert.ok(bildirimler(srv, b.id).some(n => n.tur === "bitti" && /Kaybettin/.test(n.metin)));
  await bitir();
});

test("bildirim: arkadaşlık, FRP katılma isteği, kullanıcıdan kullanıcıya ve tercihler", async () => {
  const { srv, kisi, bitir } = await kur();
  const a = await kisi("ayse"), b = await kisi("burak"), c = await kisi("cem");
  await a.call("arkadasIstek", { kisi: b.id });
  assert.ok(bildirimler(srv, b.id).some(n => n.tur === "arkadas-istek" && n.kimden === a.id));
  await b.call("arkadasKabul", { kisi: a.id });
  assert.ok(bildirimler(srv, a.id).some(n => n.tur === "arkadas-kabul"));
  // FRP: Cem katılma isteği gönderir, DM Ayşe'ye bildirim gider; onaylanınca Cem'e gider.
  await a.call("set", { path: "games/g-kervan", data: { name: "Kayıp Kervan", system: "dnd5e", open: false, dms: { [a.id]: true }, players: {}, pending: {} } });
  await c.call("update", { path: "games/g-kervan", data: { pending: { [c.id]: Date.now() } } });
  assert.ok(bildirimler(srv, a.id).some(n => n.tur === "katilma-istek" && n.hedef.id === "g-kervan"));
  await a.call("update", { path: "games/g-kervan", data: { pending: { [c.id]: null }, players: { [c.id]: { joined: 1, charId: null } } } });
  assert.ok(bildirimler(srv, c.id).some(n => n.tur === "katilim-onay"));
  // Kişiden kişiye: arkadaşa ya da aynı oyundakine gider, yabancıya gitmez.
  const r = await a.call("bildirimGonder", { kime: [b.id, c.id], metin: "Bu akşam oynayalım mı?", hedef: { tur: "oyun", id: "g-kervan" } });
  assert.equal(r.gonderilen, 2);
  assert.ok(bildirimler(srv, c.id).some(n => n.tur === "davet" && n.metin === "Bu akşam oynayalım mı?" && n.hedef.id === "g-kervan"));
  const d = await kisi("deniz");
  await assert.rejects(a.call("bildirimGonder", { kime: [d.id], metin: "selam" }), { code: "permission_denied" });
  await assert.rejects(d.call("bildirimGonder", { kime: [c.id], metin: "x", hedef: { tur: "oyun", id: "g-kervan" } }), { code: "permission_denied" });
  const liste = await a.call("bildirimKisiler", {});
  assert.deepEqual(liste.kisiler.map(k => k.id).sort(), [b.id, c.id].sort());
  assert.ok(liste.oyunlar.some(o => o.id === "g-kervan"));
  // Tercih: notları kapatan kişiye not gitmez.
  await b.call("set", { path: `data/users/${b.id}/ayar/bildirim`, data: { kapali: { mesaj: true } } });
  const r2 = await a.call("bildirimGonder", { kime: [b.id], metin: "not" });
  assert.deepEqual(r2, { gonderilen: 0, kapali: 1 });
  // Sel koruması.
  await assert.rejects((async () => { for (let i = 0; i < 20; i++) await a.call("bildirimGonder", { kime: [c.id], metin: "x" + i }); })(), { code: "rate_limited" });
  await bitir();
});

test("yükleme: dosya ve kişi kotası, yer bilgisi, Yüklediklerim ve admin kotası", async () => {
  const { srv, port, kisi, bitir } = await kur({ maxDosya: 0.01, kota: 0.025, admin: "ayse" }); // ~10 KB dosya, ~25 KB toplam
  const a = await kisi("ayse"), b = await kisi("burak");
  const yukle = (c, n, yer) => fetch(`http://127.0.0.1:${port}/api/assets`, { method: "POST", headers: { "Content-Type": "image/png", "x-zm-token": c.token, "x-filename": "harita.png", ...(yer ? { "x-zm-yer": yer } : {}) }, body: Buffer.alloc(n, 1) });
  await a.call("set", { path: "games/g-k", data: { name: "Kervan", system: "pf2e", dms: { [a.id]: true }, players: {} } });
  const r1 = await yukle(a, 8000, "games/g-k"); assert.equal(r1.status, 200);
  const r2 = await yukle(a, 12000); assert.equal(r2.status, 413);
  assert.match((await r2.json()).message, /en çok/);
  assert.equal((await yukle(a, 8000, "../_sys")).status, 200); // geçersiz yer yok sayılır
  assert.equal((await yukle(a, 8000, "profil")).status, 200);
  const r3 = await yukle(a, 8000); assert.equal(r3.status, 413);
  assert.match((await r3.json()).message, /alanın doldu/);
  const v = await a.call("dosyalarim", {});
  assert.equal(v.dosyalar.length, 3);
  assert.equal(v.kullanilan, 24000);
  assert.ok(v.dosyalar.some(d => d.yer === "games/g-k") && v.dosyalar.some(d => d.yer === null) && v.dosyalar.some(d => d.yer === "profil"));
  assert.equal(v.yerler["games/g-k"].ad, "Kervan");
  assert.equal(v.yerler["games/g-k"].tur, "frp");
  // Başkasının dosyaları listede görünmez.
  assert.equal((await b.call("dosyalarim", {})).dosyalar.length, 0);
  // Silince yer açılır.
  const sil = await fetch(`http://127.0.0.1:${port}/api/assets/${v.dosyalar[0].id}`, { method: "DELETE", headers: { "x-zm-token": a.token } });
  assert.equal(sil.status, 200);
  assert.equal((await a.call("dosyalarim", {})).kullanilan, 16000);
  // Admin kişiye özel kota verir; admin olmayan veremez.
  await assert.rejects(b.call("kotaAyar", { kisi: a.id, mb: 1 }), { code: "permission_denied" });
  await a.call("kotaAyar", { kisi: b.id, mb: 0.005 });
  assert.equal((await yukle(b, 8000)).status, 413);
  const kl = await a.call("kotaListe", {});
  assert.equal(kl.kisiler[b.id].ozel, true);
  await a.call("kotaAyar", { kisi: b.id, mb: 0 });
  assert.equal((await yukle(b, 8000)).status, 200);
  assert.ok(srv.store.get("_sys/kota/" + b.id) === undefined);
  await bitir();
});

test("profil: içinde olunan oyunlar masa oyunları ve FRP'ler olarak ayrı gelir", async () => {
  const { kisi, bitir } = await kur();
  const a = await kisi("ayse"), b = await kisi("burak");
  await a.call("set", { path: "games/g-1", data: { name: "Kayıp Kervan", system: "coc7", dms: { [a.id]: true }, players: { [b.id]: { joined: 1 } } } });
  await a.call("set", { path: "games/g-2", data: { name: "Başka", dms: { "u-00000000": true }, players: {} } });
  const { id } = await a.call("bgNew", { oyun: "dama", ad: "Dama kapışması" });
  await a.call("bgSit", { board: id, koltuk: 0 }); await b.call("bgSit", { board: id, koltuk: 1 });
  const pa = await a.call("profilOyunlar", {});
  assert.deepEqual(pa.frp.map(g => [g.id, g.rol, g.sistemAd]), [["g-1", "dm", "Call of Cthulhu"]]);
  assert.equal(pa.masa.length, 1);
  assert.equal(pa.masa[0].ad, "Dama kapışması");
  assert.equal(pa.masa[0].oyunAd, "Türk daması");
  assert.equal(pa.masa[0].siraSende, true);
  const pb = await a.call("profilOyunlar", { kisi: b.id });
  assert.equal(pb.frp[0].rol, "oyuncu");
  assert.equal(pb.masa[0].siraSende, false);
  await assert.rejects(a.call("profilOyunlar", { kisi: "u-ffffffffff" }), { code: "not_found" });
  await bitir();
});

test("sıra rehberi: zorunlu alma, değirmen, ekstra tur ve kazandıran hamle", () => {
  // Dama: alma zorunlu.
  const dama = OYUNLAR.dama.yeni(); dama.b.fill(0); dama.b[36] = 1; dama.b[28] = 3; dama.b[0] = 3;
  const ad = REHBER.analiz("dama", dama);
  assert.equal(ad.baslik, "Alma zorunlu");
  assert.ok(ad.secenekler[0].etiketler.some(e => e.tur === "al"));
  // Mangala: başlangıçta 4. kuyu (4 taş) son taşı hazineye düşürür.
  const mg = REHBER.analiz("mangala", OYUNLAR.mangala.yeni());
  assert.ok(mg.secenekler.some(s => s.hamle[0] === 3 && s.etiketler.some(e => e.tur === "tekrar")));
  // Dokuz taş: koyma aşamasında değirmen kurulabiliyorsa söylenir.
  const dt = OYUNLAR.dokuztas.yeni(); dt.b[0] = 0; dt.b[1] = 0; dt.b[21] = 1; dt.elde = [7, 8];
  const da = REHBER.analiz("dokuztas", dt);
  assert.equal(da.baslik, "Koyma aşaması");
  assert.ok(da.yapmalisin.some(y => /Değirmen/.test(y)));
  // Hnefatafl: kral köşeye gidebiliyorsa kazandıran hamle en üstte.
  const hn = OYUNLAR.hnefatafl.yeni(); hn.b.fill(0); hn.b[5] = 3; hn.b[60] = 0; hn.b[50] = 1; hn.b[70] = 1; hn.sira = 1;
  const ha = REHBER.analiz("hnefatafl", hn);
  assert.equal(ha.baslik, "Kral kaçabilir!");
  assert.ok(ha.secenekler[0].etiketler.some(e => e.tur === "kazan"));
  // Bitmiş oyunda öneri yok.
  assert.equal(REHBER.analiz("mangala", { ...OYUNLAR.mangala.yeni(), bitti: { kazanan: 0 } }).secenekler.length, 0);
});

test("sayfalar: rehber, bildirim betiği ve yeni lobi sunulur", async () => {
  const { port, bitir } = await kur();
  for (const p of ["/oyunlar/rehber.js", "/ext/bildirim.js", "/oyunlar", "/mobil"]) assert.equal((await fetch(`http://127.0.0.1:${port}${p}`)).status, 200, p);
  const html = await (await fetch(`http://127.0.0.1:${port}/oyunlar`)).text();
  assert.match(html, /rehber\.js/); assert.match(html, /bildirim\.js/); assert.match(html, /data-zm-bildirim-yer/);
  await bekle(10);
  await bitir();
});
