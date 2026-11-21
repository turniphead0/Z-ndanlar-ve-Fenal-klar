// Oyun yedekleri: tek .zip indir, sunucudan kaldır, geri yükle (server/yedek.js).
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), os = require("os"), path = require("path"), zlib = require("zlib");
const WebSocket = require("ws");
const { createServer } = require("../server");
const { zipOku } = require("../server/yedek");
const ZIP = require("../web/zip");

function client(port) {
  const ws = new WebSocket(`ws://localhost:${port}/ws`); let n = 0; const wait = new Map(), events = [];
  ws.on("message", raw => { const m = JSON.parse(raw); if (m.ev) events.push(m); else { const w = wait.get(m.re); wait.delete(m.re); m.error ? w.rej(Object.assign(new Error(m.error.message), m.error)) : w.res(m.result); } });
  const call = (op, a) => new Promise((res, rej) => { const id = ++n; wait.set(id, { res, rej }); ws.send(JSON.stringify({ id, op, ...a })); });
  return { ws, call, events, opened: new Promise(r => ws.once("open", r)) };
}

async function kur(opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zm-yedek-"));
  const srv = createServer({ dataDir: dir, hesap: "zorunlu", ...opts });
  const port = await srv.listen(0, "127.0.0.1");
  const url = p => `http://127.0.0.1:${port}${p}`;
  const acik = [];
  const kisi = async ad => {
    const r = await (await fetch(url("/api/hesap/kayit"), { method: "POST", body: JSON.stringify({ kullanici: ad, sifre: "ejderha42" }) })).json();
    const c = client(port); await c.opened; acik.push(c);
    const h = await c.call("hello", { userId: r.userId, secret: r.secret });
    return Object.assign(c, { id: h.me.id, token: h.token });
  };
  const yukle = async (c, veri, yer, ad = "harita.png", tur = "image/png") => (await fetch(url("/api/assets"), { method: "POST", headers: { "Content-Type": tur, "x-zm-token": c.token, "x-filename": encodeURIComponent(ad), "x-zm-yer": yer }, body: veri })).json();
  const indir = async (c, yer) => { const b = await c.call("yedekBileti", { yer }); const r = await fetch(url(b.url)); assert.equal(r.status, 200); return { bilet: b, r, zip: Buffer.from(await r.arrayBuffer()) }; };
  const geriYukle = async (c, zip) => { const r = await fetch(url("/api/oyun-yedek"), { method: "POST", headers: { "x-zm-token": c.token, "Content-Type": "application/zip" }, body: zip }); return { status: r.status, j: await r.json() }; };
  const bitir = async () => { for (const c of acik) c.ws.close(); await srv.close(); fs.rmSync(dir, { recursive: true, force: true }); };
  return { srv, port, url, kisi, yukle, indir, geriYukle, bitir };
}

const resim = n => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(n - 4, 7)]);

test("FRP masası: yedek indir, sunucudan kaldır (kota boşalır), geri yükle", async () => {
  const { srv, url, kisi, yukle, indir, geriYukle, bitir } = await kur();
  const a = await kisi("ayse"), b = await kisi("burak"), z = await kisi("zeki");
  await a.call("set", { path: "games/g-ejder", data: { id: "g-ejder", name: "Ejderin İni", system: "dnd5e", createdBy: a.id, dms: { [a.id]: true }, players: { [b.id]: { joined: 1, charId: "c1" } }, pending: {} } });
  const h1 = await yukle(a, resim(3000), "games/g-ejder", "İn haritası.png");
  const h2 = await yukle(b, resim(1500), "games/g-ejder", "thalia.png"); // başkasının yüklediği jeton resmi
  await a.call("set", { path: "games/g-ejder/maps/m1", data: { name: "İn", bg: h1.url, tokens: { t1: { img: h2.url } } } });
  await a.call("set", { path: "games/g-ejder/chars/c1", data: { name: "Thalia", hp: { cur: 7, max: 20 } } });
  await a.call("set", { path: `data/users/${a.id}/g-g-ejder/monsters/m1`, data: { name: "Kızıl ejder", game: "g-ejder" } });
  await a.call("set", { path: `data/users/${b.id}/g-g-ejder/dmnotes/n1`, data: { body: "Burak'ın gizlisi" } }).catch(() => {});
  await b.call("set", { path: `data/users/${b.id}/g-g-ejder/dmnotes/n1`, data: { body: "Burak'ın gizlisi" } });

  // Üye olmayan yedek alamaz; oyuncu alabilir ama kaldıramaz.
  await assert.rejects(z.call("yedekBileti", { yer: "games/g-ejder" }), { code: "permission_denied" });
  await assert.rejects(a.call("yedekBileti", { yer: "_sys/users/x" }), { code: "invalid_argument" });
  const dl = await a.call("dosyalarim", {});
  assert.deepEqual([dl.yerler["games/g-ejder"].yedek, dl.yerler["games/g-ejder"].kaldir], [true, true]);
  assert.deepEqual([(await b.call("dosyalarim", {})).yerler["games/g-ejder"].kaldir], [false]);
  // Önce yedek indirilmeden kaldırılamaz.
  await assert.rejects(a.call("oyunKaldir", { yer: "games/g-ejder" }), { code: "failed_precondition" });

  const { r, zip } = await indir(a, "games/g-ejder");
  assert.match(r.headers.get("content-disposition"), /attachment; filename="Ejderin Ini - zar masasi yedegi\.zip"/);
  const ic = zipOku(zip), adlar = [...ic.kayitlar.keys()];
  assert.ok(adlar.includes("BENIOKU.txt") && adlar.includes("zarmasasi-yedek.json"));
  assert.ok(adlar.includes("dosyalar/In haritasi.png") && adlar.includes("dosyalar/thalia.png"), adlar.join());
  const bildirge = JSON.parse(ic.oku(ic.kayitlar.get("zarmasasi-yedek.json"), 1e8));
  assert.equal(bildirge.tur, "frp"); assert.equal(bildirge.dosyalar.length, 2);
  assert.ok(bildirge.belgeler["ortak/maps/m1"] && bildirge.belgeler["ozel/monsters/m1"]);
  assert.ok(!JSON.stringify(bildirge).includes("Burak'ın gizlisi"), "başkasının gizli DM verisi yedeğe girmez");
  // Sistem unzip'i de açabilsin (gerçek zip biçimi).
  assert.deepEqual(ic.oku(ic.kayitlar.get("dosyalar/thalia.png"), 1e8), resim(1500));

  const once = (await a.call("dosyalarim", {})).kullanilan;
  const k = await a.call("oyunKaldir", { yer: "games/g-ejder" });
  assert.equal(k.dosya, 1); assert.equal(k.bosalan, 3000);
  assert.equal((await a.call("dosyalarim", {})).kullanilan, once - 3000);
  assert.ok(!srv.store.get("games/g-ejder") && !srv.store.get("games/g-ejder/maps/m1"));
  assert.ok(!srv.store.get(`data/users/${b.id}/g-g-ejder/dmnotes/n1`), "oyunla birlikte bütün gizli veriler silinir");
  assert.equal((await fetch(url(h1.url))).status, 404);
  assert.equal((await fetch(url(h2.url))).status, 200, "Burak'ın dosyası onun kotasında, silinmez");

  // Geri yükle: yeni bir oyun açılır, dosyalar Ayşe'nin kotasına sayılır, adresler yenilenir.
  const g = await geriYukle(a, zip);
  assert.equal(g.status, 200, JSON.stringify(g.j));
  assert.equal(g.j.tur, "frp"); assert.equal(g.j.dosya, 2); assert.equal(g.j.ad, "Ejderin İni");
  const oyun = srv.store.get(g.j.yer);
  assert.equal(oyun.id, g.j.id); assert.equal(oyun.createdBy, a.id); assert.ok(oyun.dms[a.id]); assert.ok(oyun.players[b.id], "aynı sunucudaki oyuncular kalır");
  const harita = srv.store.get(`${g.j.yer}/maps/m1`);
  assert.notEqual(harita.bg, h1.url); assert.equal((await fetch(url(harita.bg))).status, 200);
  assert.deepEqual(Buffer.from(await (await fetch(url(harita.tokens.t1.img))).arrayBuffer()), resim(1500));
  assert.equal(srv.store.get(`${g.j.yer}/chars/c1`).hp.cur, 7);
  assert.equal(srv.store.get(`data/users/${a.id}/g-${g.j.id}/monsters/m1`).game, g.j.id, "eski oyun kimliği yenisiyle değişir");
  const sonra = await a.call("dosyalarim", {});
  assert.equal(sonra.kullanilan, once - 3000 + 4500);
  assert.equal(sonra.dosyalar.filter(d => d.yer === g.j.yer).length, 2);
  await bitir();
});

test("geri yükleme: biçim, kota, dosya türü ve klasörden yeniden zip'leme", async () => {
  const { srv, kisi, yukle, indir, geriYukle, bitir } = await kur({ maxDosya: 0.01, kota: 0.02 }); // ~10 KB dosya, ~20 KB toplam
  const a = await kisi("ayse");
  await a.call("set", { path: "games/g-k", data: { id: "g-k", name: "Kervan", createdBy: a.id, dms: { [a.id]: true }, players: {} } });
  const h = await yukle(a, resim(9000), "games/g-k");
  await a.call("set", { path: "games/g-k/maps/m1", data: { bg: h.url } });
  const { zip } = await indir(a, "games/g-k");

  // Bozuk dosya içeriği (CRC tutmuyor).
  const bozuk = Buffer.from(zip); const i = bozuk.indexOf(resim(9000).subarray(0, 8)); bozuk[i + 100] ^= 0xff;
  assert.match((await geriYukle(a, bozuk)).j.message, /bozuk/);
  // Yükleme alanı yetmiyor (9 KB kullanılıyor, 20 KB kota, iki kopya sığmaz).
  await geriYukle(a, zip).then(r => assert.equal(r.status, 200));
  const dolu = await geriYukle(a, zip);
  assert.equal(dolu.status, 413); assert.match(dolu.j.message, /Yükleme alanın yetmiyor/);
  assert.equal(srv.store.list("games").length, 2, "kota yetmeyince hiçbir şey yazılmaz");

  // Zip değil / yedek değil / bozuk / tanınmayan bölüm.
  assert.match((await geriYukle(a, Buffer.from("merhaba"))).j.message, /zip dosyası değil/);
  const yap = (dosyalar) => Buffer.concat(ZIP.olustur(dosyalar.map(([ad, v]) => ({ ad, veri: Buffer.from(typeof v === "string" ? v : JSON.stringify(v)) }))));
  assert.match((await geriYukle(a, yap([["foto.png", "x"]]))).j.message, /oyun yedeği değil/);
  assert.match((await geriYukle(a, yap([["zarmasasi-yedek.json", "{bozuk"]]))).j.message, /okunamadı/);
  assert.match((await geriYukle(a, yap([["zarmasasi-yedek.json", { bicim: "zar-masasi-oyun-yedegi", surum: 9, tur: "frp", belgeler: {} }]]))).j.message, /daha yeni bir sürüm/);
  assert.match((await geriYukle(a, yap([["zarmasasi-yedek.json", { bicim: "zar-masasi-oyun-yedegi", surum: 1, tur: "frp", belgeler: { oyun: {}, "../_sys/x": {} } }]]))).j.message, /tanınmayan bir bölüm/);
  assert.match((await geriYukle(a, yap([["zarmasasi-yedek.json", { bicim: "zar-masasi-oyun-yedegi", surum: 1, tur: "masa", belgeler: { masa: { oyun: "yok" } } }]]))).j.message, /bu sunucuda yok/);

  // Kullanıcı yedeği açıp klasörü başka bir programla (sıkıştırarak, üst klasörle, başka dosya adlarıyla) zip'lerse de olur.
  const ic = zipOku(zip), dosyalar = [];
  for (const [ad, k] of ic.kayitlar) dosyalar.push({ ad: "Kervan yedeği/" + ad.replace("dosyalar/", "dosyalar/yeni-ad-"), veri: ic.oku(k, 1e8) });
  const parcalar = [], merkez = []; let konum = 0;
  for (const d of dosyalar) { // deflate ile elle zip
    const sik = zlib.deflateRawSync(d.veri), adB = Buffer.from(d.ad), h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x800, 6); h.writeUInt16LE(8, 8); h.writeUInt32LE(ZIP.crc32(d.veri), 14); h.writeUInt32LE(sik.length, 18); h.writeUInt32LE(d.veri.length, 22); h.writeUInt16LE(adB.length, 26);
    const m = Buffer.alloc(46); m.writeUInt32LE(0x02014b50, 0); m.writeUInt16LE(0x800, 8); m.writeUInt16LE(8, 10); m.writeUInt32LE(ZIP.crc32(d.veri), 16); m.writeUInt32LE(sik.length, 20); m.writeUInt32LE(d.veri.length, 24); m.writeUInt16LE(adB.length, 28); m.writeUInt32LE(konum, 42);
    parcalar.push(h, adB, sik); merkez.push(m, adB); konum += 30 + adB.length + sik.length;
  }
  const mb = Buffer.concat(merkez), son = Buffer.alloc(22); son.writeUInt32LE(0x06054b50, 0); son.writeUInt16LE(dosyalar.length, 8); son.writeUInt16LE(dosyalar.length, 10); son.writeUInt32LE(mb.length, 12); son.writeUInt32LE(konum, 16);
  const yeniden = Buffer.concat([...parcalar, mb, son]);
  for (const g of srv.store.list("games")) if (g.data.geriYuklendi) await (async () => { const yer = "games/" + g.id; await indir(a, yer); await a.call("oyunKaldir", { yer }); })();
  const r = await geriYukle(a, yeniden);
  assert.equal(r.status, 200, JSON.stringify(r.j)); assert.equal(r.j.dosya, 1); assert.deepEqual(r.j.uyarilar, []);
  await bitir();
});

test("masa oyunları ve atölye: yedek, gizli kartlar ve geri yükleme", async () => {
  const { srv, kisi, yukle, indir, geriYukle, bitir } = await kur();
  const a = await kisi("ayse"), b = await kisi("burak");
  // Atölye oyunu, yüklenmiş kart resmiyle.
  const kr = await yukle(a, resim(2000), "atolye", "ejder kartı.png");
  const { id: ko } = await a.call("kmTanimYaz", { tanim: { ad: "Ejder Kartları", desteler: [{ id: "d", ad: "Deste", kartlar: [{ ad: "Ejder", resim: kr.url, adet: 3 }] }] } });
  await assert.rejects(b.call("yedekBileti", { yer: "kartoyun/" + ko }), { code: "permission_denied" });
  const at = await indir(a, "kartoyun/" + ko);
  const g1 = await geriYukle(b, at.zip);
  assert.equal(g1.status, 200, JSON.stringify(g1.j)); assert.equal(g1.j.tur, "atolye");
  const o = srv.store.get(g1.j.yer);
  assert.equal(o.sahip, b.id); assert.match(o.tanim.desteler[0].kartlar[0].resim, /^\/assets\/[0-9a-f]{20}\.png$/); assert.notEqual(o.tanim.desteler[0].kartlar[0].resim, kr.url);

  // Kart masası: başka oyuncu varken gizli durum yedeğe girmez.
  const { id: bid } = await a.call("kmNew", { hazir: "kazan-katlet-claude", ad: "Cuma masası" });
  await b.call("kmSit", { board: bid, koltuk: 1 });
  const m1 = await indir(a, "boards/" + bid);
  assert.equal(m1.bilet.uyarilar.length, 1);
  const b1 = JSON.parse(zipOku(m1.zip).oku(zipOku(m1.zip).kayitlar.get("zarmasasi-yedek.json"), 1e8));
  assert.ok(!b1.belgeler.durum);
  const g2 = await geriYukle(a, m1.zip);
  assert.equal(g2.status, 200, JSON.stringify(g2.j)); assert.equal(g2.j.ad, "Cuma masası");
  const yeni = srv.store.get(g2.j.yer), tam = srv.store.get("_sys/kartmasa/" + g2.j.id);
  assert.equal(yeni.oyun, "kart"); assert.equal(yeni.olusturan, a.id); assert.equal(tam.koltuk[0].id, a.id); assert.ok(!tam.basladi);
  assert.ok(srv.store.get(`data/users/${a.id}/kartmasa/${g2.j.id}`));
  // Yalnız oynanan masa tam durumuyla geri gelir.
  await b.call("kmSit", { board: bid, kalk: true });
  const m2 = await indir(a, "boards/" + bid);
  const g3 = await geriYukle(a, m2.zip);
  assert.deepEqual(g3.j.uyarilar, []);
  assert.deepEqual(srv.store.get("_sys/kartmasa/" + g3.j.id).desteler, srv.store.get("_sys/kartmasa/" + bid).desteler);

  // Tahta oyunu: hamleler korunur.
  const { id: tid } = await a.call("bgNew", { oyun: "mangala", ad: "Akşam" });
  await a.call("bgSit", { board: tid, koltuk: 0 }); await b.call("bgSit", { board: tid, koltuk: 1 });
  await a.call("bgMove", { board: tid, hamle: [2] });
  const t = await indir(b, "boards/" + tid);
  await b.call("oyunKaldir", { yer: "boards/" + tid });
  assert.ok(!srv.store.get("boards/" + tid));
  const g4 = await geriYukle(b, t.zip);
  const tahta = srv.store.get(g4.j.yer);
  assert.equal(tahta.oyun, "mangala"); assert.equal(tahta.durum.sira, 1); assert.deepEqual(tahta.koltuk.map(k => k.id), [a.id, b.id]);
  await b.call("bgMove", { board: g4.j.id, hamle: [7] });
  await bitir();
});
