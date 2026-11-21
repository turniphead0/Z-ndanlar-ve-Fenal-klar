// Gizlilik: profil görünürlüğü, engelleme, şikâyet, verilerimi indir ve hesap silme (server/gizlilik.js).
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const WebSocket = require("ws");
const { createServer } = require("../server");
const { zipOku } = require("../server/yedek");

const SIFRE = "Zar-Kule-4471";
function client(port) {
  const ws = new WebSocket(`ws://localhost:${port}/ws`); let n = 0; const wait = new Map();
  ws.on("message", raw => { const m = JSON.parse(raw); if (m.ev) return; const w = wait.get(m.re); if (!w) return; wait.delete(m.re); m.error ? w.rej(Object.assign(new Error(m.error.message), m.error)) : w.res(m.result); });
  const call = (op, a) => new Promise((res, rej) => { const id = ++n; wait.set(id, { res, rej }); ws.send(JSON.stringify({ id, op, ...a })); });
  return { ws, call, opened: new Promise(r => ws.once("open", r)), kapandi: new Promise(r => ws.once("close", (code) => r(code))) };
}
async function kur() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zm-gz-"));
  const srv = createServer({ dataDir: dir, hesap: "zorunlu", admin: "yonetici" });
  const port = await srv.listen(0, "127.0.0.1");
  const kisiler = [];
  const api = (yol, b) => fetch(`http://127.0.0.1:${port}/api/hesap/${yol}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(r => r.json());
  async function baglan(r) {
    const c = client(port); await c.opened;
    const h = await c.call("hello", { userId: r.userId, secret: r.secret });
    c.id = h.me.id; c.token = h.token; kisiler.push(c); return c;
  }
  const kisi = async ad => baglan(await api("kayit", { kullanici: ad, sifre: SIFRE }));
  const bitir = async () => { for (const c of kisiler) c.ws.close(); await srv.close(); fs.rmSync(dir, { recursive: true, force: true }); };
  return { srv, port, dir, kisi, api, baglan, bitir };
}
async function arkadasYap(a, b) { await a.call("arkadasIstek", { kisi: b.id }); await b.call("arkadasKabul", { kisi: a.id }); }

test("profil görünürlüğü: herkes, yalnızca arkadaşlar, gizli", async () => {
  const { kisi, bitir } = await kur();
  try {
    const ali = await kisi("ali"), ayse = await kisi("ayse"), veli = await kisi("veli"), yon = await kisi("yonetici");
    await ali.call("profilYaz", { hakkinda: "Pazar akşamları oynarım" });
    await arkadasYap(ali, ayse);
    // Varsayılan: herkese açık.
    assert.equal((await veli.call("kisi", { kisi: ali.id })).hakkinda, "Pazar akşamları oynarım");
    assert.equal((await ali.call("gizlilikBilgi", {})).gorunum, "herkes");

    await ali.call("gizlilikAyar", { gorunum: "arkadaslar" });
    const yabanci = await veli.call("kisi", { kisi: ali.id });
    assert.equal(yabanci.gizli, true); assert.equal(yabanci.hakkinda, undefined); assert.equal(yabanci.kullanici, "ali");
    await assert.rejects(veli.call("profilOyunlar", { kisi: ali.id }), /gizli/);
    await assert.rejects(veli.call("profilForum", { kisi: ali.id }), /gizli/);
    assert.equal((await veli.call("profiles", { ids: [ali.id] }))[ali.id].cevrimici, false, "gizli profilin çevrimiçi durumu görünmez");
    assert.equal((await ayse.call("kisi", { kisi: ali.id })).hakkinda, "Pazar akşamları oynarım", "arkadaş görür");
    assert.equal((await ayse.call("profiles", { ids: [ali.id] }))[ali.id].cevrimici, true);
    assert.equal((await veli.call("kisiAra", { q: "ali" })).length, 1, "arkadaşlara açık profil aramada çıkar");

    await ali.call("gizlilikAyar", { gorunum: "gizli" });
    assert.equal((await ayse.call("kisi", { kisi: ali.id })).gizli, true, "gizli: arkadaş da görmez");
    assert.equal((await veli.call("kisiAra", { q: "ali" })).length, 0, "gizli profil aramada çıkmaz");
    assert.equal((await ayse.call("kisiAra", { q: "ali" })).length, 1, "arkadaşın aramasında çıkar");
    assert.equal((await yon.call("kisi", { kisi: ali.id })).hakkinda, "Pazar akşamları oynarım", "admin görür");
    const ben = await ali.call("kisi", { kisi: ali.id });
    assert.equal(ben.gorunum, "gizli"); assert.equal(ben.hakkinda, "Pazar akşamları oynarım");
    await assert.rejects(ali.call("gizlilikAyar", { gorunum: "yarim" }), /Görünürlük/);
    // Gizli profile de arkadaşlık isteği gönderilebilir.
    assert.equal(await veli.call("arkadasIstek", { kisi: ali.id }), "giden");
  } finally { await bitir(); }
});

test("engelleme: arkadaşlık biter, mesaj, istek, bildirim ve profil kapanır", async () => {
  const { kisi, bitir } = await kur();
  try {
    const ali = await kisi("ali"), veli = await kisi("veli");
    await arkadasYap(ali, veli);
    await veli.call("dmGonder", { to: ali.id, text: "selam" });
    await ali.call("engelle", { kisi: veli.id });
    assert.equal((await ali.call("kisi", { kisi: veli.id })).arkadas, null, "arkadaşlık bitti");
    assert.equal((await ali.call("kisi", { kisi: veli.id })).engelledim, true);
    await assert.rejects(veli.call("dmGonder", { to: ali.id, text: "neden?" }), /arkadaşlarına/);
    await assert.rejects(veli.call("arkadasIstek", { kisi: ali.id }), /gönderilemiyor/);
    await assert.rejects(ali.call("arkadasIstek", { kisi: veli.id }), /gönderilemiyor/);
    assert.equal((await veli.call("kisi", { kisi: ali.id })).gizli, true, "engellenen, engelleyenin profilini görmez");
    assert.equal((await veli.call("kisiAra", { q: "ali" })).length, 0);
    assert.equal((await ali.call("kisiAra", { q: "veli" })).length, 0);
    await assert.rejects(veli.call("bildirimGonder", { kime: [ali.id], metin: "hey" }), /permission|Yalnızca/);
    // İstemci engel kaydını kendisi yazamaz.
    await assert.rejects(veli.call("set", { path: `data/users/${veli.id}/engel/${ali.id}`, data: { t: 1 } }), /İzin/);
    const b = await ali.call("gizlilikBilgi", {});
    assert.deepEqual(b.engelliler.map(x => x.kullanici), ["veli"]);
    await assert.rejects(ali.call("engelle", { kisi: ali.id }), /Kendini/);
    await ali.call("engelKaldir", { kisi: veli.id });
    assert.equal((await ali.call("gizlilikBilgi", {})).engelliler.length, 0);
    assert.equal(await veli.call("arkadasIstek", { kisi: ali.id }), "giden", "engel kalkınca istek gönderilebilir");
  } finally { await bitir(); }
});

test("şikâyet: kanıtla kaydedilir, yalnızca adminler görür ve kapatır", async () => {
  const { kisi, bitir } = await kur();
  try {
    const ali = await kisi("ali"), veli = await kisi("veli"), yon = await kisi("yonetici");
    await arkadasYap(ali, veli);
    await veli.call("dmGonder", { to: ali.id, text: "kaba bir söz" });
    const r = await ali.call("sikayetEt", { kisi: veli.id, neden: "taciz", aciklama: "Mesajda hakaret etti", mesajlarEkle: true });
    assert.ok(r.id);
    // Aynı kişi için açık şikâyet yinelenmez.
    assert.equal((await ali.call("sikayetEt", { kisi: veli.id, neden: "taciz", mesajlarEkle: true })).yinelendi, true);
    await assert.rejects(ali.call("sikayetEt", { kisi: veli.id, neden: "diger" }), /kısaca yaz/);
    // Forum yazısı şikâyeti: kişi yazarın kendisi olur.
    const t = await veli.call("forumTopic", { title: "Reklam", body: "ucuz zar burada" });
    await ali.call("sikayetEt", { yer: { tur: "forum", konu: t.id }, neden: "spam" });

    await assert.rejects(ali.call("sikayetListe", {}), /adminler/);
    const l = await yon.call("sikayetListe", {});
    assert.equal(l.acik, 2); assert.equal(l.sikayetler.length, 2);
    const mesaj = l.sikayetler.find(s => s.yer.tur === "mesaj");
    assert.equal(mesaj.kimeKisi.kullanici, "veli"); assert.equal(mesaj.kimdenKisi.kullanici, "ali"); assert.equal(mesaj.kimeToplam, 2);
    assert.equal(mesaj.kanit.iletiler[0].text, "kaba bir söz"); assert.equal(mesaj.kanit.iletiler[0].kimden, "sikayet-edilen");
    const forum = l.sikayetler.find(s => s.yer.tur === "forum");
    assert.equal(forum.kime, veli.id); assert.equal(forum.kanit.metin, "ucuz zar burada");
    // Admin bildirim alır.
    const bild = await yon.call("query", { path: `data/users/${yon.id}/bildirim` });
    assert.ok(bild.some(b => b.data.tur === "sikayet"));
    await yon.call("sikayetKapat", { sikayet: mesaj.id, not: "Uyarıldı" });
    const l2 = await yon.call("sikayetListe", {});
    assert.equal(l2.acik, 1); assert.equal(l2.sikayetler.find(s => s.id === mesaj.id).kapatanAd, "yonetici");
    await assert.rejects(ali.call("sikayetKapat", { sikayet: mesaj.id }), /adminler/);
  } finally { await bitir(); }
});

test("verilerimi indir: zip içinde hesap, mesajlar, forum ve dosyalar", async () => {
  const { kisi, port, bitir } = await kur();
  try {
    const ali = await kisi("ali"), veli = await kisi("veli");
    await arkadasYap(ali, veli);
    await ali.call("dmGonder", { to: veli.id, text: "yarın oynayalım mı?" });
    await ali.call("forumTopic", { title: "Oyuncu arıyorum", body: "Cumartesi" });
    const up = await fetch(`http://127.0.0.1:${port}/api/assets`, { method: "POST", headers: { "Content-Type": "image/png", "x-zm-token": ali.token, "x-filename": "harita.png" }, body: Buffer.from("PNGVERI") }).then(r => r.json());
    const { url } = await ali.call("verilerimBileti", {});
    await assert.rejects(ali.call("verilerimBileti", {}), /bekle/);
    const r = await fetch(`http://127.0.0.1:${port}${url}`);
    assert.equal(r.status, 200); assert.match(r.headers.get("content-disposition"), /verilerim-ali/);
    const zip = zipOku(Buffer.from(await r.arrayBuffer()));
    const json = JSON.parse(zip.oku(zip.kayitlar.get("verilerim.json"), 1e8).toString("utf8"));
    assert.equal(json.hesap.kullanici, "ali");
    assert.equal(json.ozelMesajlar[veli.id].iletiler[0].text, "yarın oynayalım mı?");
    assert.equal(json.forum.konular[0].baslik, "Oyuncu arıyorum");
    assert.equal(json.arkadaslar[0].kullanici, "veli");
    assert.ok(!JSON.stringify(json).includes('"hash"') && !JSON.stringify(json).includes("salt"), "şifre özeti yok");
    const d = json.yuklenenDosyalar.find(x => x.id === up.id);
    assert.equal(zip.oku(zip.kayitlar.get(d.arsivde), 1e6).toString(), "PNGVERI");
    // Bilet tek kullanımlık.
    assert.equal((await fetch(`http://127.0.0.1:${port}${url}`)).status, 404);
  } finally { await bitir(); }
});

test("hesap silme: şifre ister, verileri siler, paylaşılan oyunlar kalır", async () => {
  const { kisi, api, baglan, port, srv, dir, bitir } = await kur();
  try {
    const ali = await kisi("ali"), veli = await kisi("veli");
    await arkadasYap(ali, veli);
    await ali.call("dmGonder", { to: veli.id, text: "merhaba" });
    // Ali'nin tek başına olduğu oyun ve Veli'yle paylaştığı oyun.
    await ali.call("set", { path: "games/yalniz", data: { name: "Yalnız", dms: { [ali.id]: true }, players: {}, createdBy: ali.id } });
    await ali.call("set", { path: "games/ortak", data: { name: "Ortak", dms: { [ali.id]: true }, players: { [veli.id]: { joined: 1 } }, createdBy: ali.id } });
    await ali.call("set", { path: "games/yalniz/chars/c1", data: { name: "Kahraman" } });
    await ali.call("chatSend", { game: "ortak", text: "zarlar hazır" });
    const t1 = await ali.call("forumTopic", { title: "Benim konum", body: "x" });
    const t2 = await veli.call("forumTopic", { title: "Veli'nin konusu", body: "y" });
    await new Promise(r => setTimeout(r, 1100)); // forumda art arda gönderim sınırı
    await ali.call("forumReply", { topic: t2.id, body: "aliden yanıt" });
    const yukle = async ad => fetch(`http://127.0.0.1:${port}/api/assets`, { method: "POST", headers: { "Content-Type": "image/png", "x-zm-token": ali.token, "x-filename": ad }, body: Buffer.from(ad) }).then(r => r.json());
    const foto = await yukle("foto.png"), jeton = await yukle("jeton.png");
    await ali.call("profilYaz", { foto: foto.id });
    await ali.call("update", { path: "games/ortak", data: { harita: "/assets/" + jeton.id } });

    await assert.rejects(ali.call("hesapSil", { sifre: "yanlis-sifre-1" }), /Şifre yanlış/);
    const kapandi = ali.kapandi;
    const r = await ali.call("hesapSil", { sifre: SIFRE });
    assert.equal(r.silindi, true); assert.equal(r.oyun, 1);
    assert.equal(await kapandi, 4001, "bağlantı kapanır");

    const s = srv.store;
    assert.equal(s.get("games/yalniz"), undefined); assert.equal(s.get("games/yalniz/chars/c1"), undefined);
    const ortak = s.get("games/ortak");
    assert.ok(ortak.dms[veli.id], "Veli DM oldu"); assert.ok(!ortak.dms[ali.id]); assert.equal(ortak.createdBy, veli.id);
    assert.equal(s.list("chat/ortak").length, 0, "oyun sohbetindeki yazıları silindi");
    assert.equal(s.get("forum/" + t1.id), undefined, "kendi konusu silindi");
    assert.equal(s.get("forum/" + t2.id).yanit, 0, "yanıtı silindi");
    assert.equal(s.get(`data/users/${veli.id}/arkadas/${ali.id}`), undefined);
    assert.equal(s.list(`data/users/${veli.id}/dm/${ali.id}`).length, 1, "Veli'nin kendi mesaj kopyası kalır");
    assert.equal(s.paths(`data/users/${ali.id}/dm/${veli.id}`).length, 0);
    assert.equal(s.get("_sys/hesap/ali"), undefined);
    assert.ok(!s.list("_sys/oturum").some(d => d.data.uid === ali.id));
    const iz = s.get("_sys/users/" + ali.id);
    assert.equal(iz.name, "Silinmiş hesap"); assert.equal(iz.username, undefined); assert.equal(iz.foto, undefined);
    assert.equal(s.get("_sys/assets/" + foto.id), undefined, "profil fotoğrafı silindi");
    assert.ok(!fs.existsSync(path.join(dir, "assets", foto.id)));
    assert.ok(s.get("_sys/assets/" + jeton.id), "paylaşılan oyunda kullanılan dosya kalır");
    // Giriş yapılamaz, ad yeniden alınabilir, profil bulunamaz.
    assert.equal((await api("giris", { kullanici: "ali", sifre: SIFRE })).code, "bad_login");
    await assert.rejects(veli.call("kisi", { kisi: ali.id }), /Böyle biri yok/);
    const yeni = await api("kayit", { kullanici: "ali", sifre: SIFRE });
    assert.ok(yeni.userId && yeni.userId !== ali.id);
    await baglan(yeni);
  } finally { await bitir(); }
});

test("hesap silme: forum yazıları istenirse yalnızca adı silinerek kalır; masa oyunu koltuğu boşalır", async () => {
  const { kisi, srv, bitir } = await kur();
  try {
    const ali = await kisi("ali"), veli = await kisi("veli");
    const t = await ali.call("forumTopic", { title: "Kalsın", body: "faydalı bilgi" });
    const b = await ali.call("bgNew", { oyun: Object.keys(require("../web/oyunlar/kurallar").OYUNLAR)[0] });
    await ali.call("bgSit", { board: b.id, koltuk: 0 }); await veli.call("bgSit", { board: b.id, koltuk: 1 });
    const solo = await ali.call("bgNew", { oyun: Object.keys(require("../web/oyunlar/kurallar").OYUNLAR)[0] });
    await ali.call("bgSit", { board: solo.id, koltuk: 0 });
    await ali.call("hesapSil", { sifre: SIFRE, forumSil: false });
    const k = srv.store.get("forum/" + t.id);
    assert.equal(k.govde, "faydalı bilgi"); assert.equal(k.yazar.name, "Silinmiş hesap");
    const masa = srv.store.get("boards/" + b.id);
    assert.equal(masa.koltuk[0], null); assert.equal(masa.koltuk[1].id, veli.id);
    assert.equal(srv.store.get("boards/" + solo.id), undefined, "yalnız oynadığı masa silindi");
  } finally { await bitir(); }
});

test("ZM_ADMIN hesabı silinemez", async () => {
  const { kisi, bitir } = await kur();
  try {
    const yon = await kisi("yonetici");
    await assert.rejects(yon.call("hesapSil", { sifre: SIFRE }), /ZM_ADMIN/);
  } finally { await bitir(); }
});
