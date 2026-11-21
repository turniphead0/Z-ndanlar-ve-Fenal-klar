// Gizlilik ve kişisel veriler (KVKK): profil görünürlüğü, engelleme, şikâyet, "verilerimi indir" ve hesap silme.
//
// Veri:
//   _sys/users/<kişi>.gizlilik          "herkes" | "arkadaslar" | "gizli"   profilin kimlere açık olduğu
//   data/users/<kişi>/engel/<öteki>     { t }                             engellenen kişiler (yalnızca sunucu yazar)
//   _sys/sikayet/<id>                   { id, t, kimden, kime, neden, aciklama, yer, kanit, durum, ... }
//                                                                         şikâyetler (yalnızca adminler görür)
//
// Profil görünürlüğü:
//   herkes      herkes profili (hakkında, oyunlar, forum yazıları, çevrimiçi durumu) görür
//   arkadaslar  yalnızca arkadaşlar görür; başkaları adı ve fotoğrafı görür, arkadaşlık isteği gönderebilir
//   gizli       arkadaşlar dahil kimse görmez ve kişi aramada çıkmaz (arkadaşların aramasında çıkar)
// Adminler her profili görür (şikâyetleri inceleyebilsinler diye). Engellenen kişi, engelleyenin profilini görmez;
// iki taraf arasında arkadaşlık isteği, özel mesaj ve bildirim gönderilemez, arkadaşlıkları biter.
//
// Hesap silme: şifre sorulur, sonra hesaba ait her şey silinir (hesap, e-posta, oturumlar, profil, arkadaşlıklar,
// mesaj kutuları, bildirimler, yalnızca onun oynadığı masalar, oyun sohbetindeki yazdıkları, kimsenin kullanmadığı
// yüklemeleri). Başkalarıyla paylaşılan oyunlar onlar için kalır: kişi oyundan çıkar, adı "Silinmiş hesap" olur.
// Forum yazıları isteğe göre silinir ya da adı silinerek bırakılır. Kimliğin yerine adı "Silinmiş hesap" olan boş
// bir kayıt kalır ki eski sohbetlerde kimin yazdığı karışmasın; içinde kişisel veri yoktur.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ZIP = require("../web/zip");
const { anahtar } = require("./hesap");

const GORUNUM = ["herkes", "arkadaslar", "gizli"];
const KISI_ID = /^u-[0-9a-f]{8,}$/;
const SIKAYET_ID = /^s[0-9a-z]{6,30}$/;
const NEDENLER = { taciz: "Taciz ya da hakaret", spam: "İstenmeyen ileti (spam)", uygunsuz: "Uygunsuz içerik", hile: "Hile ya da oyunu bozma", taklit: "Başkasını taklit etme", diger: "Diğer" };
const SILINMIS = "Silinmiş hesap", SILINMIS_RENK = "#7f8c8d";
const GUN = 24 * 3600 * 1000;
const SIKAYET_GUNLUK = 20; // bir kişi günde en çok bu kadar şikâyet gönderir
const KANIT_ILETI = 10; // şikâyete eklenen son özel mesaj sayısı
const BILET_SURESI = 10 * 60 * 1000;
const ASSET_ARA = /[0-9a-f]{20}\.[a-z0-9]{2,4}/g;

const hata = (code, message) => Object.assign(new Error(message), { code });
const rid = (n = 6) => crypto.randomBytes(n).toString("hex");
const metin = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").replace(/\r\n?/g, "\n").trim().slice(0, n);
const iso = t => (t ? new Date(t).toISOString() : null);

// Görünürlük kuralları: hesap.js (kisi, kisiAra, arkadaşlık, mesaj), profil.js, dosyalar.js ve bildirim.js kullanır.
// c: bağlantı ({ uid, isOwner }); adminMi(c) rolleri sonradan kurulduğu için geç çağrılır.
function gizlilikKurallari({ store, adminMi = () => false }) {
  const kisi = uid => (KISI_ID.test(String(uid || "")) && store.get("_sys/users/" + uid)) || null;
  const gorunum = uid => { const u = kisi(uid); return u && GORUNUM.includes(u.gizlilik) ? u.gizlilik : "herkes"; };
  const engelledi = (a, b) => store.has(`data/users/${a}/engel/${b}`);
  const engelVar = (a, b) => !!a && !!b && (engelledi(a, b) || engelledi(b, a));
  const arkadasMi = (a, b) => ((store.get(`data/users/${a}/arkadas/${b}`) || {}).durum) === "arkadas";
  const admin = c => { try { return !!adminMi(c); } catch (e) { return false; } };
  // Profilin ayrıntılarını (hakkında, oyunlar, forum yazıları, çevrimiçi) görebilir mi?
  function gorebilir(c, hedef) {
    if (!c || !c.uid) return false;
    if (c.uid === hedef || admin(c)) return true;
    if (engelledi(hedef, c.uid)) return false;
    const g = gorunum(hedef);
    return g === "herkes" || (g === "arkadaslar" && arkadasMi(c.uid, hedef));
  }
  // Kişi aramasında çıkar mı?
  function aranabilir(c, hedef) {
    if (admin(c)) return true;
    if (engelVar(c.uid, hedef)) return false;
    return gorunum(hedef) !== "gizli" || arkadasMi(c.uid, hedef);
  }
  return { gorunum, engelledi, engelVar, gorebilir, aranabilir, arkadasMi };
}

function kurGizlilik({ store, conns, roller, hesap, kurallar, dosyalar, bildirim, assetDir, dataDir, guvenlik, surum, log = console }) {
  const OPS = new Set(["gizlilikBilgi", "gizlilikAyar", "engelle", "engelKaldir", "sikayetEt", "sikayetListe", "sikayetKapat", "verilerimBileti", "hesapSil", "sunucuYedekDurum"]);
  const kisi = uid => (KISI_ID.test(String(uid || "")) && store.get("_sys/users/" + uid)) || null;
  const adOf = uid => { const u = kisi(uid); return u ? u.username || u.name || "Oyuncu" : null; };
  const ozetKisi = uid => { const u = kisi(uid) || {}; return { id: uid, kullanici: u.username || null, ad: u.username || u.name || SILINMIS, foto: u.foto || null, renk: u.color || SILINMIS_RENK, silindi: !!u.silindi }; };
  const hesapOf = uid => { const u = kisi(uid); return u && u.username ? store.get("_sys/hesap/" + anahtar(u.username)) : null; };
  const altYollar = onek => { const out = []; for (const p of store.json.keys()) if (p.startsWith(onek)) out.push(p); return out; };
  const hesapli = c => { const u = kisi(c.uid); if (!u || !u.username) throw hata("hesap_gerekli", "Bunun için bir hesapla giriş yapmalısın"); return u; };

  /* ---------------- Engelleme ---------------- */
  function engelle(c, m) {
    const uid = String(m.kisi || ""), u = kisi(uid);
    if (!u || u.silindi) throw hata("not_found", "Böyle biri yok");
    if (uid === c.uid) throw hata("invalid_argument", "Kendini engelleyemezsin");
    if (u.bot) throw hata("invalid_argument", "Botlar engellenemez");
    store.set(`data/users/${c.uid}/engel/${uid}`, { t: Date.now() });
    // Arkadaşlık ve bekleyen istekler biter (iki taraftan da).
    store.delete(`data/users/${c.uid}/arkadas/${uid}`); store.delete(`data/users/${uid}/arkadas/${c.uid}`);
    return true;
  }

  /* ---------------- Şikâyet ---------------- */
  function kanitTopla(c, m, kime) {
    const yer = m.yer && typeof m.yer === "object" ? m.yer : null;
    if (yer && yer.tur === "forum") {
      const konu = String(yer.konu || ""), tp = "forum/" + konu, t = /^t[0-9a-z]+$/.test(konu) && store.get(tp);
      if (!t) throw hata("not_found", "Bu forum konusu artık yok");
      if (yer.yanit) {
        const yid = String(yer.yanit), y = /^p[0-9a-z]+$/.test(yid) && store.get(tp + "/yanitlar/" + yid);
        if (!y) throw hata("not_found", "Bu yanıt artık yok");
        return { kime: (y.yazar || {}).id, yer: { tur: "forum", konu, yanit: yid }, kanit: { baslik: t.baslik, metin: metin(y.govde, 2000), t: y.created || null } };
      }
      return { kime: (t.yazar || {}).id, yer: { tur: "forum", konu }, kanit: { baslik: t.baslik, metin: metin(t.govde, 2000), t: t.created || null } };
    }
    if (!kime) throw hata("invalid_argument", "Kimi şikâyet ettiğini seç");
    if (m.mesajlarEkle) {
      const iletiler = store.list(`data/users/${c.uid}/dm/${kime}`).map(d => d.data).filter(Boolean).sort((a, b) => (a.t || 0) - (b.t || 0)).slice(-KANIT_ILETI)
        .map(x => ({ t: x.t, kimden: x.by === c.uid ? "sikayet-eden" : "sikayet-edilen", text: metin(x.text, 2000), ...(x.resim ? { resim: x.resim } : {}) }));
      return { kime, yer: { tur: "mesaj" }, kanit: { iletiler } };
    }
    return { kime, yer: { tur: "profil" }, kanit: null };
  }
  function sikayetEt(c, m) {
    const x = kanitTopla(c, m, m.kisi ? String(m.kisi) : null);
    const u = kisi(x.kime);
    if (!u || u.silindi || u.bot) throw hata("not_found", "Böyle biri yok");
    if (x.kime === c.uid) throw hata("invalid_argument", "Kendini şikâyet edemezsin");
    const neden = Object.hasOwn(NEDENLER, m.neden) ? m.neden : "diger";
    const aciklama = metin(m.aciklama, 1000);
    if (neden === "diger" && !aciklama) throw hata("invalid_argument", "Ne olduğunu kısaca yaz");
    const now = Date.now(), benim = store.list("_sys/sikayet").map(d => d.data).filter(s => s && s.kimden === c.uid);
    if (benim.filter(s => now - s.t < GUN).length >= SIKAYET_GUNLUK) throw hata("rate_limited", "Bugün çok fazla şikâyet gönderdin. Yarın tekrar dene.");
    // Aynı kişi ve aynı yer için açık bir şikâyet varsa yenisi açılmaz, o güncellenir.
    const ayni = benim.find(s => s.durum === "acik" && s.kime === x.kime && JSON.stringify(s.yer) === JSON.stringify(x.yer));
    if (ayni) {
      store.set("_sys/sikayet/" + ayni.id, { ...ayni, neden, aciklama: aciklama || ayni.aciklama, kanit: x.kanit || ayni.kanit, guncellendi: now });
      return { id: ayni.id, yinelendi: true };
    }
    const id = "s" + now.toString(36) + rid(3);
    store.set("_sys/sikayet/" + id, { id, t: now, kimden: c.uid, kime: x.kime, neden, aciklama, yer: x.yer, kanit: x.kanit, durum: "acik" });
    // Adminlere bildirim (bildirim kutusunda; tıklanınca şikâyet edilen kişinin profili açılır).
    if (bildirim) for (const d of store.list("_sys/hesap")) {
      const a = d.data && d.data.uid; if (!a || a === c.uid || roller.rolu(a) !== "admin") continue;
      bildirim.gonder(a, { tur: "sikayet", baslik: `Yeni şikâyet: ${adOf(x.kime)}`, metin: `${NEDENLER[neden]}. Yönetim panelindeki Şikâyetler bölümünden inceleyebilirsin.`, hedef: { tur: "kisi", id: x.kime } });
    }
    return { id };
  }
  function sikayetListe() {
    const hepsi = store.list("_sys/sikayet").map(d => d.data).filter(Boolean);
    const say = new Map(); for (const s of hepsi) say.set(s.kime, (say.get(s.kime) || 0) + 1);
    hepsi.sort((a, b) => ((a.durum === "acik" ? 0 : 1) - (b.durum === "acik" ? 0 : 1)) || b.t - a.t);
    return {
      nedenler: NEDENLER,
      acik: hepsi.filter(s => s.durum === "acik").length,
      sikayetler: hepsi.slice(0, 300).map(s => ({ ...s, kimdenKisi: s.kimden ? ozetKisi(s.kimden) : null, kimeKisi: ozetKisi(s.kime), kimeToplam: say.get(s.kime) || 0, kapatanAd: s.kapatan ? adOf(s.kapatan) : null })),
    };
  }

  /* ---------------- Verilerimi indir ---------------- */
  function veriTopla(uid) {
    const u = kisi(uid) || {}, h = hesapOf(uid) || {};
    const kok = `data/users/${uid}/`, koku = p => p.slice(kok.length);
    const sirala = a => a.sort((x, y) => (x.t || 0) - (y.t || 0));
    const mesajlar = {}, gruplar = {}, ham = {};
    for (const p of altYollar(kok)) {
      const s = koku(p).split("/"), d = store.get(p);
      if (s[0] === "dm" && s.length === 3) (mesajlar[s[1]] = mesajlar[s[1]] || { kisi: adOf(s[1]), iletiler: [] }).iletiler.push(d);
      else if (s[0] === "grup" && s.length === 3) { const g = store.get("_sys/grup/" + s[1]); (gruplar[s[1]] = gruplar[s[1]] || { ad: g ? g.ad : null, iletiler: [] }).iletiler.push(d); }
      else ham[koku(p)] = d;
    }
    for (const v of Object.values(mesajlar)) sirala(v.iletiler);
    for (const v of Object.values(gruplar)) sirala(v.iletiler);
    const konular = [], yanitlar = [];
    for (const tp of store.paths("forum")) {
      const t = store.get(tp); if (!t) continue;
      if (t.yazar && t.yazar.id === uid) konular.push({ id: tp.slice(6), baslik: t.baslik, govde: t.govde, kategori: t.kategori, t: iso(t.created) });
      for (const yp of store.paths(tp + "/yanitlar")) { const y = store.get(yp); if (y && y.yazar && y.yazar.id === uid) yanitlar.push({ konu: tp.slice(6), baslik: t.baslik, govde: y.govde, t: iso(y.created) }); }
    }
    const sohbet = [];
    for (const p of store.json.keys()) {
      if (!p.startsWith("chat/")) continue;
      const d = store.get(p); if (d && d.by === uid) sohbet.push({ oyun: p.split("/")[1], t: iso(d.t), text: d.text, ...(d.gif ? { gif: d.gif } : {}) });
    }
    const yuklenen = [];
    for (const p of store.paths("_sys/assets")) {
      const a = store.get(p); if (!a || a.owner !== uid) continue;
      const id = p.slice(12), f = path.join(assetDir, id);
      if (fs.existsSync(f)) yuklenen.push({ id, ad: a.name || id, tur: a.type, boyut: a.size || 0, yer: a.yer || null, t: a.created || null, f });
    }
    let oturum = 0; for (const d of store.list("_sys/oturum")) if (d.data && d.data.uid === uid) oturum++;
    const json = {
      bicim: "zar-masasi-kisisel-veriler", surum: 1, uygulama: "Zar Masası " + surum, alindi: new Date().toISOString(),
      aciklama: "Zar Masası sunucusunun senin hakkında sakladığı bilgiler. Şifren yalnızca geri çevrilemez bir özet olarak saklandığı için burada yok.",
      hesap: { kimlik: uid, kullanici: h.ad || u.username || null, eposta: h.eposta || null, epostaDogrulandi: iso(h.epostaT), olusturuldu: iso(h.created || u.created), sonGiris: iso(u.seen), rol: roller.rolu(uid), acikOturum: oturum },
      profil: { ad: u.name, renk: u.color, foto: u.foto || null, hakkinda: u.hakkinda || "", gizlilik: kurallar.gorunum(uid) },
      arkadaslar: store.list(kok + "arkadas").map(d => ({ kimlik: d.id, kullanici: adOf(d.id), durum: d.data.durum, t: iso(d.data.t) })),
      engellediklerim: store.list(kok + "engel").map(d => ({ kimlik: d.id, kullanici: adOf(d.id), t: iso(d.data.t) })),
      ozelMesajlar: mesajlar, grupMesajlari: gruplar,
      forum: { konular, yanitlar },
      oyunSohbeti: sohbet,
      oyunlar: dosyalar.oyunlari(uid),
      sikayetlerim: store.list("_sys/sikayet").map(d => d.data).filter(s => s && s.kimden === uid).map(s => ({ t: iso(s.t), kime: adOf(s.kime), neden: NEDENLER[s.neden] || s.neden, aciklama: s.aciklama, durum: s.durum })),
      yuklenenDosyalar: yuklenen.map(({ f, ...d }) => ({ ...d, t: iso(d.t) })),
      digerKayitlar: ham,
    };
    return { json, yuklenen, ad: json.hesap.kullanici || "oyuncu" };
  }
  async function zipYaz(res, v) {
    const yaz = b => new Promise((ok, red) => { if (res.destroyed) return red(new Error("bağlantı kapandı")); res.write(b) ? ok() : res.once("drain", ok); });
    const kayitlar = []; let konum = 0;
    const ekle = async (ad, veri) => {
      const crc = ZIP.crc32(veri), h = ZIP.yerelBaslik(ad, crc, veri.length);
      kayitlar.push({ ad, crc, boyut: veri.length, konum });
      await yaz(Buffer.from(h)); await yaz(veri); konum += h.length + veri.length;
      if (konum > 0xfffffff0) throw new Error("Arşiv 4 GB'tan büyük olamaz");
    };
    const benioku = [
      "Zar Masası: kişisel verilerin",
      `Alındığı zaman: ${new Date().toLocaleString("tr-TR")}`,
      "",
      "verilerim.json    hesabın, profilin, arkadaşların, mesajların, bildirimlerin, forum yazıların,",
      "                  oyun sohbetinde yazdıkların ve yüklediğin dosyaların listesi (JSON biçiminde)",
      "dosyalar/         yüklediğin resimler, sesler ve PDF'ler",
      "",
      "Bir FRP masasının ya da masa oyununun bütün içeriğini (haritalar, karakterler, notlar) ayrıca",
      "Yüklediklerim sayfasındaki \"Yedek al\" düğmesiyle indirebilirsin.",
      "",
    ].join("\r\n");
    await ekle("BENIOKU.txt", Buffer.from(benioku, "utf8"));
    const kullanildi = new Set();
    for (const d of v.yuklenen) {
      let veri; try { veri = fs.readFileSync(d.f); } catch (e) { continue; }
      const uz = d.id.split(".").pop(), kok = String(d.ad).replace(/\.[A-Za-z0-9]{1,5}$/, "").replace(/[^\p{L}\p{N} ._-]+/gu, "-").slice(0, 60).trim() || "dosya";
      let ad = `dosyalar/${kok}.${uz}`;
      for (let i = 2; kullanildi.has(ad.toLowerCase()); i++) ad = `dosyalar/${kok}-${i}.${uz}`;
      kullanildi.add(ad.toLowerCase());
      const kayit = v.json.yuklenenDosyalar.find(x => x.id === d.id); if (kayit) kayit.arsivde = ad;
      await ekle(ad, veri);
    }
    await ekle("verilerim.json", Buffer.from(JSON.stringify(v.json, null, 1), "utf8"));
    for (const b of ZIP.sonBolum(kayitlar, konum)) await yaz(Buffer.from(b));
    res.end();
  }
  const biletler = new Map(); // bilet -> { uid, son }
  const sonBilet = new Map(); // kişi -> son bilet zamanı

  /* ---------------- Hesap silme ---------------- */
  // Bir nesnenin içindeki { id: uid, name } kayıtlarında adı sil (masa koltukları, forum yazarı).
  function adiSil(o, uid) {
    if (!o || typeof o !== "object") return false;
    let d = false;
    if (o.id === uid && typeof o.name === "string" && o.name !== SILINMIS) { o.name = SILINMIS; d = true; }
    for (const v of Object.values(o)) if (v && typeof v === "object" && adiSil(v, uid)) d = true;
    return d;
  }
  function oyunuSil(gid) {
    const ozel = new RegExp(`^data/users/[^/]+/(g-|chat/)${gid.replace(/[-]/g, "\\-")}/`);
    for (const p of [...store.json.keys()]) if (p.startsWith(`games/${gid}/`) || p.startsWith(`chat/${gid}/`) || ozel.test(p)) store.delete(p);
    store.delete("games/" + gid);
  }
  function masayiSil(bid) {
    const tam = store.get("_sys/kartmasa/" + bid);
    if (tam) for (const k of tam.koltuk || []) if (k && k.id) store.delete(`data/users/${k.id}/kartmasa/${bid}`);
    store.delete("_sys/kartmasa/" + bid); store.delete("boards/" + bid);
  }
  const insanMi = k => k && k.id && !k.bot && !String(k.id).startsWith("bot-");

  function hesabiSil(uid, { forumSil }) {
    const u = kisi(uid) || {}, ad = u.username || u.name || "";
    const ozet = { oyun: 0, masa: 0, forum: 0, dosya: 0 };
    // 1) FRP masaları: kişi çıkar; kimse kalmazsa oyun silinir, DM kalmazsa ilk oyuncu DM olur.
    for (const p of store.paths("games")) {
      const g = store.get(p); if (!g) continue;
      const ic = o => !!(o && o[uid]);
      if (!ic(g.dms) && !ic(g.players) && !ic(g.pending) && g.createdBy !== uid) continue;
      const gid = p.slice(6), y = { ...g };
      for (const k of ["dms", "players", "pending"]) if (y[k]) { y[k] = { ...y[k] }; delete y[k][uid]; }
      const dmler = Object.keys(y.dms || {}).filter(k => y.dms[k]);
      const oyuncular = Object.keys(y.players || {}).filter(k => y.players[k] && !k.startsWith("bot-"));
      if (!dmler.length && !oyuncular.length) { oyunuSil(gid); ozet.oyun++; continue; }
      if (!dmler.length) { y.dms = { ...(y.dms || {}), [oyuncular[0]]: true }; delete y.players[oyuncular[0]]; dmler.push(oyuncular[0]); }
      if (y.createdBy === uid) y.createdBy = dmler[0];
      store.set(p, y);
      for (const q of altYollar(`data/users/${uid}/g-${gid}/`)) store.delete(q);
    }
    // 2) Masa oyunları: başka insan oyuncu yoksa masa silinir; varsa tahtada koltuk boşalır, kart masasında adı silinir.
    for (const p of store.paths("boards")) {
      const b = store.get(p); if (!b) continue;
      const kart = b.oyun === "kart", koltuk = (kart ? (b.durum || {}).koltuk : b.koltuk) || [];
      if (!koltuk.some(k => k && k.id === uid) && b.olusturan !== uid) continue;
      const bid = p.slice(7);
      if (!koltuk.some(k => insanMi(k) && k.id !== uid)) { masayiSil(bid); ozet.masa++; continue; }
      if (!kart) b.koltuk = b.koltuk.map(k => (k && k.id === uid ? null : k));
      adiSil(b, uid);
      store.set(p, b);
      const tam = store.get("_sys/kartmasa/" + bid);
      if (tam && adiSil(tam, uid)) store.set("_sys/kartmasa/" + bid, tam);
    }
    // 3) Oyun atölyesinde yaptığı oyunlar (masalar kendi kopyasını taşır, onlar etkilenmez).
    for (const p of store.paths("kartoyun")) { const o = store.get(p); if (o && o.sahip === uid) { for (const q of altYollar(p + "/")) store.delete(q); store.delete(p); } }
    // 4) Forum: silinir ya da adı silinir.
    for (const tp of store.paths("forum")) {
      const t = store.get(tp); if (!t) continue;
      if (forumSil && t.yazar && t.yazar.id === uid) { for (const yp of store.paths(tp + "/yanitlar")) store.delete(yp); store.delete(tp); ozet.forum++; continue; }
      let silinen = 0;
      for (const yp of store.paths(tp + "/yanitlar")) {
        const y = store.get(yp); if (!y || !y.yazar || y.yazar.id !== uid) continue;
        if (forumSil) { store.delete(yp); silinen++; ozet.forum++; } else store.set(yp, { ...y, yazar: { ...y.yazar, name: SILINMIS, color: SILINMIS_RENK } });
      }
      const yeni = { ...t }; let degisti = false;
      if (silinen) { yeni.yanit = Math.max(0, (t.yanit || 0) - silinen); degisti = true; }
      if (t.yazar && t.yazar.id === uid) { yeni.yazar = { ...t.yazar, name: SILINMIS, color: SILINMIS_RENK }; degisti = true; }
      if (ad && t.sonYazan === ad) { yeni.sonYazan = SILINMIS; degisti = true; }
      if (degisti) store.set(tp, yeni);
    }
    // 5) Oyun sohbetinde yazdıkları ve başkalarının kutusundaki arkadaşlık / engel kayıtları.
    const iz = new RegExp(`^data/users/[^/]+/(arkadas|engel)/${uid}$`);
    for (const p of [...store.json.keys()]) {
      if (iz.test(p)) store.delete(p);
      else if (p.startsWith("chat/")) { const d = store.get(p); if (d && d.by === uid) store.delete(p); }
    }
    // 6) Sohbet grupları: gruptan çıkar; grup boşalırsa silinir.
    for (const p of store.paths("_sys/grup")) {
      const g = store.get(p); if (!g || !g.uyeler || !g.uyeler[uid]) continue;
      delete g.uyeler[uid];
      if (!Object.keys(g.uyeler).length) { store.delete(p); continue; }
      if (g.sahip === uid) g.sahip = Object.keys(g.uyeler).sort((a, b) => g.uyeler[a] - g.uyeler[b])[0];
      store.set(p, g);
    }
    // 7) Kendi kutusu (mesajlar, bildirimler, ayarlar, gizli DM verisi) ve sistem kayıtları.
    for (const p of altYollar(`data/users/${uid}/`)) store.delete(p);
    if (u.username) store.delete("_sys/hesap/" + anahtar(u.username));
    for (const d of store.list("_sys/eposta")) if (d.data && d.data.uid === uid) store.delete(d.path);
    for (const d of store.list("_sys/oturum")) if (d.data && d.data.uid === uid) store.delete(d.path);
    store.delete("_sys/rol/" + uid); store.delete("_sys/kota/" + uid);
    for (const d of store.list("_sys/sikayet")) if (d.data && d.data.kimden === uid) store.set(d.path, { ...d.data, kimden: null, kanit: null });
    // 8) Kimlik: kişisel veri içermeyen boş bir kayıt kalır (eski sohbetlerde ad "Silinmiş hesap" görünür).
    store.set("_sys/users/" + uid, { name: SILINMIS, color: SILINMIS_RENK, created: u.created || null, silindi: Date.now() });
    // 9) Yüklemeleri: başka bir yerde (paylaşılan oyunlarda) kullanılmayanlar silinir.
    const kullanilan = new Set();
    for (const [p, j] of store.json) { if (p.startsWith("_sys/assets/")) continue; const m = j.match(ASSET_ARA); if (m) for (const x of m) kullanilan.add(x); }
    for (const p of store.paths("_sys/assets")) {
      const a = store.get(p), id = p.slice(12);
      if (!a || a.owner !== uid || kullanilan.has(id)) continue;
      fs.rmSync(path.join(assetDir, path.basename(id)), { force: true }); store.delete(p); ozet.dosya++;
    }
    return ozet;
  }

  /* ---------------- İşlemler ---------------- */
  function op(c, m) {
    switch (m.op) {
      case "gizlilikBilgi": {
        hesapli(c);
        const engelliler = store.list(`data/users/${c.uid}/engel`).map(d => ({ ...ozetKisi(d.id), t: d.data.t })).sort((a, b) => b.t - a.t);
        return { gorunum: kurallar.gorunum(c.uid), engelliler, nedenler: NEDENLER };
      }
      case "gizlilikAyar": {
        const u = hesapli(c), g = String(m.gorunum || "");
        if (!GORUNUM.includes(g)) throw hata("invalid_argument", "Görünürlük herkes, arkadaslar ya da gizli olabilir");
        store.set("_sys/users/" + c.uid, { ...u, gizlilik: g });
        return { gorunum: g };
      }
      case "engelle": hesapli(c); return engelle(c, m);
      case "engelKaldir": { hesapli(c); const uid = String(m.kisi || ""); if (!KISI_ID.test(uid)) throw hata("invalid_argument", "Geçersiz kişi"); store.delete(`data/users/${c.uid}/engel/${uid}`); return true; }
      case "sikayetEt": hesapli(c); return sikayetEt(c, m);
      case "sikayetListe": if (!roller.admin(c)) throw hata("permission_denied", "Bunu yalnızca adminler yapabilir"); return sikayetListe();
      case "sikayetKapat": {
        if (!roller.admin(c)) throw hata("permission_denied", "Bunu yalnızca adminler yapabilir");
        const id = String(m.sikayet || ""), s = SIKAYET_ID.test(id) && store.get("_sys/sikayet/" + id);
        if (!s) throw hata("not_found", "Böyle bir şikâyet yok");
        if (m.ac) store.set("_sys/sikayet/" + id, { ...s, durum: "acik", kapatan: null, kapandi: null });
        else store.set("_sys/sikayet/" + id, { ...s, durum: "kapali", kapatan: c.uid, kapandi: Date.now(), not: metin(m.not, 500) });
        return true;
      }
      case "verilerimBileti": {
        hesapli(c);
        const now = Date.now();
        if (now - (sonBilet.get(c.uid) || 0) < 30000) throw hata("rate_limited", "Biraz bekle, sonra tekrar dene");
        sonBilet.set(c.uid, now);
        for (const [k, v] of biletler) if (v.son < now) biletler.delete(k);
        const bilet = rid(16);
        biletler.set(bilet, { uid: c.uid, son: now + BILET_SURESI });
        return { url: "/api/verilerim/" + bilet };
      }
      case "hesapSil": {
        const u = hesapli(c);
        if (roller.envAdminMi && roller.envAdminMi(c.uid)) throw hata("failed_precondition", "Bu hesap sunucu ayarıyla (ZM_ADMIN) admin. Silmeden önce sunucudaki ZM_ADMIN ayarından çıkar.");
        hesap.sifreKontrol(c.uid, m.sifre);
        const ozet = hesabiSil(c.uid, { forumSil: m.forumSil !== false });
        log.log(`[gizlilik] hesap silindi: ${c.uid}`);
        // Yanıt gittikten sonra bu kişinin bütün bağlantıları kapanır.
        setTimeout(() => { for (const o of conns) if (o.uid === c.uid) o.ws.close(4001, "hesap silindi"); }, 100);
        return { silindi: true, kullanici: u.username, ...ozet };
      }
      case "sunucuYedekDurum": {
        if (!roller.admin(c)) throw hata("permission_denied", "Bunu yalnızca adminler yapabilir");
        try { return JSON.parse(fs.readFileSync(path.join(dataDir, "yedek-durum.json"), "utf8")); } catch (e) { return null; }
      }
    }
    throw hata("unknown_op", "Bilinmeyen işlem");
  }

  // HTTP: GET /api/verilerim/<bilet> (tek seferlik, 10 dakika geçerli).
  function http(req, res, p, send) {
    if (req.method !== "GET" || !p.startsWith("/api/verilerim/")) return false;
    const k = p.slice(15), b = biletler.get(k);
    biletler.delete(k);
    if (!b || b.son < Date.now() || !kisi(b.uid) || kisi(b.uid).silindi) { send(res, 404, "Bu indirme bağlantısının süresi doldu. Profil > Ayarlar'dan yeniden iste.", "text/plain; charset=utf-8"); return true; }
    const v = veriTopla(b.uid);
    const tarih = new Date().toISOString().slice(0, 10);
    const dosyaAdi = `zar-masasi-verilerim-${String(v.ad).replace(/[^A-Za-z0-9_.-]/g, "_")}-${tarih}.zip`;
    res.writeHead(200, { ...guvenlik, "Content-Type": "application/zip", "Cache-Control": "no-store", "Content-Disposition": `attachment; filename="${dosyaAdi}"` });
    zipYaz(res, v).catch(e => { log.error("[verilerim]", e.message); res.destroy(); });
    return true;
  }

  return { OPS, op, http, hesabiSil, veriTopla, NEDENLER };
}

module.exports = { kurGizlilik, gizlilikKurallari, GORUNUM, NEDENLER, SILINMIS };
