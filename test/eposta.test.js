// E-posta doğrulamalı kayıt, eski hesaplara e-posta ekleme, şifre sıfırlama ve "insan mısın?" sınaması.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), os = require("os"), path = require("path");
const WebSocket = require("ws");
const { createServer } = require("../server");
const { kurInsanMi, ciz } = require("../server/insanmi");
const { epostaGecerli, maskele } = require("../server/eposta");

function client(port) {
  const ws = new WebSocket(`ws://localhost:${port}/ws`); let n = 0; const wait = new Map();
  ws.on("message", raw => { const m = JSON.parse(raw); if (m.ev) return; const w = wait.get(m.re); wait.delete(m.re); m.error ? w.rej(Object.assign(new Error(m.error.message), m.error)) : w.res(m.result); });
  const call = (op, a) => new Promise((res, rej) => { const id = ++n; wait.set(id, { res, rej }); ws.send(JSON.stringify({ id, op, ...a })); });
  return { ws, call, opened: new Promise(r => ws.once("open", r)) };
}
// Her test kendi IP'sinden geliyormuş gibi davranır (ZM_VEKIL açık, X-Forwarded-For ile).
const post = async (port, p, body, ip = "10.0.0.1") => {
  const r = await fetch(`http://127.0.0.1:${port}${p}`, { method: "POST", headers: { "x-forwarded-for": ip }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
};
const kodu = postalar => (postalar[postalar.length - 1].metin.match(/\b(\d{6})\b/) || [])[1];

async function sunucu(ek = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zm-"));
  const postalar = [];
  const opts = { dataDir: dir, hesap: "zorunlu", vekil: true, epostaGonder: async p => { postalar.push(p); }, ...ek };
  const srv = createServer(opts);
  const port = await srv.listen(0, "127.0.0.1");
  return { srv, port, postalar, dir, opts, kapat: async () => { await srv.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}

test("insan mısın: PNG resim, tek kullanımlık, büyük/küçük harf fark etmez", () => {
  const png = ciz("ACD34");
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const im = kurInsanMi();
  const s = im.yeni();
  assert.match(s.resim, /^data:image\/png;base64,/);
  assert.ok(!im.dogrula(s.id, "yanlis"));
  assert.ok(!im.dogrula(s.id, s.cevap), "bir kez denendikten sonra geçersiz");
  const s2 = im.yeni();
  assert.ok(im.dogrula(s2.id, " " + s2.cevap.toLowerCase() + " "));
  assert.ok(!im.dogrula("yok", "x"));
});

test("e-posta yardımcıları", () => {
  assert.ok(epostaGecerli("ayse@ornek.com"));
  for (const e of ["ayse", "a@b", "a b@c.com", "a@b..com", "<a>@b.com"]) assert.ok(!epostaGecerli(e), e);
  assert.equal(maskele("ayse.yilmaz@gmail.com"), "ay***@gmail.com");
});

test("SMTP yoksa e-posta istenmez, kayıt eskisi gibi tek adım", async () => {
  const s = await sunucu({ epostaGonder: null, smtp: null });
  const info = await (await fetch(`http://127.0.0.1:${s.port}/api/info`)).json();
  assert.equal(info.eposta, false);
  const k = await post(s.port, "/api/hesap/kayit", { kullanici: "Tekin", sifre: "ejder123x" });
  assert.equal(k.status, 200); assert.ok(k.body.secret);
  const a = client(s.port); await a.opened;
  await a.call("hello", { userId: k.body.userId, secret: k.body.secret });
  a.ws.close(); await s.kapat();
});

test("iki adımlı kayıt: kod e-postaya gider, doğru kodla hesap açılır", async () => {
  const s = await sunucu();
  const info = await (await fetch(`http://127.0.0.1:${s.port}/api/info`)).json();
  assert.equal(info.eposta, true);
  assert.equal((await post(s.port, "/api/hesap/kayit", { kullanici: "Ayşe", sifre: "ejder123x" })).status, 400, "e-posta zorunlu");
  const k = await post(s.port, "/api/hesap/kayit", { kullanici: "Ayşe", sifre: "ejder123x", eposta: "Ayse@Ornek.com" });
  assert.equal(k.status, 200); assert.equal(k.body.dogrulama, true); assert.ok(!k.body.secret, "kod girilmeden oturum yok");
  assert.equal(k.body.eposta, "ay***@ornek.com");
  assert.equal(s.postalar.length, 1); assert.equal(s.postalar[0].kime, "ayse@ornek.com");
  const kod = kodu(s.postalar);
  // Henüz hesap yok: giriş olmaz.
  assert.equal((await post(s.port, "/api/hesap/giris", { kullanici: "Ayşe", sifre: "ejder123x" })).status, 401);
  // Hemen yeniden kod istemek: 60 sn beklemeli.
  assert.equal((await post(s.port, "/api/hesap/kayitKod", { bekleyen: k.body.bekleyen })).status, 429);
  const yanlis = String((+kod + 1) % 1000000).padStart(6, "0");
  assert.equal((await post(s.port, "/api/hesap/kayitDogrula", { bekleyen: k.body.bekleyen, kod: yanlis })).body.code, "kod_yanlis");
  const d = await post(s.port, "/api/hesap/kayitDogrula", { bekleyen: k.body.bekleyen, kod });
  assert.equal(d.status, 200); assert.ok(d.body.secret);
  // Aynı bekleyen kayıt ikinci kez kullanılamaz.
  assert.equal((await post(s.port, "/api/hesap/kayitDogrula", { bekleyen: k.body.bekleyen, kod })).status, 404);
  // Aynı e-postayla ikinci hesap açılamaz (başka bir adresten de).
  assert.equal((await post(s.port, "/api/hesap/kayit", { kullanici: "Başka", sifre: "ejder123x", eposta: "ayse@ornek.com" }, "10.0.0.2")).status, 409);
  // E-postayla da giriş yapılır.
  const g = await post(s.port, "/api/hesap/giris", { kullanici: "AYSE@ornek.com", sifre: "ejder123x" });
  assert.equal(g.status, 200); assert.equal(g.body.kullanici, "Ayşe");
  const a = client(s.port); await a.opened;
  await a.call("hello", { userId: g.body.userId, secret: g.body.secret });
  const bilgi = await a.call("hesapBilgi", {});
  assert.equal(bilgi.eposta, "ay***@ornek.com");
  a.ws.close(); await s.kapat();
});

test("5 yanlış kodda kod geçersiz olur", async () => {
  const s = await sunucu();
  const k = await post(s.port, "/api/hesap/kayit", { kullanici: "Deneme", sifre: "ejder123x", eposta: "d@ornek.com" });
  const kod = kodu(s.postalar), yanlis = String((+kod + 1) % 1000000).padStart(6, "0");
  for (let i = 0; i < 5; i++) await post(s.port, "/api/hesap/kayitDogrula", { bekleyen: k.body.bekleyen, kod: yanlis });
  const d = await post(s.port, "/api/hesap/kayitDogrula", { bekleyen: k.body.bekleyen, kod });
  assert.equal(d.body.code, "kod_yanlis", "doğru kod da artık geçmez");
  await s.kapat();
});

test("aynı adresten art arda kayıt: insan mısın sorulur, cevapla geçilir", async () => {
  // Sınamaların cevabını test görebilsin diye kendi "insan mısın?" örneğimizi veririz.
  const insanMi = kurInsanMi(), yeni = insanMi.yeni; let cevap = null;
  insanMi.yeni = () => { const x = yeni(); cevap = x.cevap; return x; };
  const s = await sunucu({ epostaGonder: null, smtp: null, insanMi }); // kayıt tek adımda biter
  const ip = "10.9.9.9";
  const k1 = await post(s.port, "/api/hesap/kayit", { kullanici: "Bir", sifre: "ejder123x" }, ip);
  assert.equal(k1.status, 200);
  // İlk hesap açıldı: ikinci kayıt resim ister.
  const k2 = await post(s.port, "/api/hesap/kayit", { kullanici: "Iki", sifre: "ejder123x" }, ip);
  assert.equal(k2.body.code, "insan_gerekli");
  // Başka bir adres etkilenmez.
  assert.equal((await post(s.port, "/api/hesap/kayit", { kullanici: "Ucuncu", sifre: "ejder123x" }, "10.1.1.1")).status, 200);
  // Resmi al; yanlış cevap reddedilir, resim de yanar.
  const r1 = await (await fetch(`http://127.0.0.1:${s.port}/api/hesap/insan`, { headers: { "x-forwarded-for": ip } })).json();
  assert.match(r1.resim, /^data:image\/png;base64,/); assert.ok(!("cevap" in r1), "cevap istemciye gitmez");
  assert.equal((await post(s.port, "/api/hesap/kayit", { kullanici: "Iki", sifre: "ejder123x", insan: { id: r1.id, cevap: "XXXXX" } }, ip)).body.code, "insan_yanlis");
  const r2 = await (await fetch(`http://127.0.0.1:${s.port}/api/hesap/insan`, { headers: { "x-forwarded-for": ip } })).json();
  const k3 = await post(s.port, "/api/hesap/kayit", { kullanici: "Iki", sifre: "ejder123x", insan: { id: r2.id, cevap } }, ip);
  assert.equal(k3.status, 200, JSON.stringify(k3.body));
  await s.kapat();
});

test("eski hesap: e-posta eklemeden masaya giremez, ekleyince girer", async () => {
  // Önce e-posta kapalıyken hesap açılır (eski kullanıcı), sonra sunucu e-postayı açar.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zm-"));
  let srv = createServer({ dataDir: dir, hesap: "zorunlu", smtp: null });
  let port = await srv.listen(0, "127.0.0.1");
  const k = await post(port, "/api/hesap/kayit", { kullanici: "Eski", sifre: "ejder123x" });
  await srv.close();
  const postalar = [];
  srv = createServer({ dataDir: dir, hesap: "zorunlu", vekil: true, epostaGonder: async p => { postalar.push(p); } });
  port = await srv.listen(0, "127.0.0.1");
  const a = client(port); await a.opened;
  await assert.rejects(a.call("hello", { userId: k.body.userId, secret: k.body.secret }), { code: "eposta_gerekli" });
  assert.equal((await post(port, "/api/hesap/epostaEkle", { userId: k.body.userId, secret: "yanlis", eposta: "eski@ornek.com" })).status, 401);
  const e = await post(port, "/api/hesap/epostaEkle", { userId: k.body.userId, secret: k.body.secret, eposta: "eski@ornek.com" });
  assert.equal(e.status, 200); assert.equal(postalar.length, 1);
  const d = await post(port, "/api/hesap/epostaDogrula", { userId: k.body.userId, secret: k.body.secret, kod: kodu(postalar) });
  assert.equal(d.status, 200);
  const b = client(port); await b.opened;
  const h = await b.call("hello", { userId: k.body.userId, secret: k.body.secret });
  assert.equal(h.me.kullanici, "Eski");
  // ZM_EPOSTA=kapali ile zorunluluk kalkar.
  for (const c of [a, b]) c.ws.close();
  await srv.close();
  srv = createServer({ dataDir: dir, hesap: "zorunlu", epostaGonder: async () => {}, eposta: "kapali" });
  port = await srv.listen(0, "127.0.0.1");
  const info = await (await fetch(`http://127.0.0.1:${port}/api/info`)).json();
  assert.equal(info.eposta, false);
  await srv.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("şifremi unuttum: kod e-postaya gider, yeni şifreyle eski oturumlar kapanır", async () => {
  const s = await sunucu();
  const k = await post(s.port, "/api/hesap/kayit", { kullanici: "Unutkan", sifre: "ejder123x", eposta: "u@ornek.com" });
  const d = await post(s.port, "/api/hesap/kayitDogrula", { bekleyen: k.body.bekleyen, kod: kodu(s.postalar) });
  // Kayıtlı olmayan adres de aynı yanıtı alır ama posta gitmez.
  const n = s.postalar.length;
  const yok = await post(s.port, "/api/hesap/sifirla", { eposta: "yok@ornek.com" }, "10.0.0.5");
  assert.equal(yok.status, 200); assert.equal(s.postalar.length, n);
  const r = await post(s.port, "/api/hesap/sifirla", { eposta: "U@ornek.com" }, "10.0.0.5");
  assert.equal(r.status, 200); await new Promise(x => setTimeout(x, 50)); assert.equal(s.postalar.length, n + 1); assert.match(s.postalar[n].konu, /kodun/);
  assert.equal((await post(s.port, "/api/hesap/sifirlaTamam", { eposta: "u@ornek.com", kod: kodu(s.postalar), sifre: "123" }, "10.0.0.5")).status, 400, "zayıf şifre");
  const t = await post(s.port, "/api/hesap/sifirlaTamam", { eposta: "u@ornek.com", kod: kodu(s.postalar), sifre: "yepyeni99" }, "10.0.0.5");
  assert.equal(t.status, 200); assert.ok(t.body.secret);
  const a = client(s.port); await a.opened;
  await assert.rejects(a.call("hello", { userId: d.body.userId, secret: d.body.secret }), { code: "login_required" });
  assert.equal((await post(s.port, "/api/hesap/giris", { kullanici: "Unutkan", sifre: "yepyeni99" })).status, 200);
  a.ws.close(); await s.kapat();
});
