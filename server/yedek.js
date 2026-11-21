// Oyun yedekleri: bir oyunun her şeyini (belgeleri ve yüklenen dosyaları) tek bir .zip olarak indirme,
// sunucudan kaldırıp yükleme alanını boşaltma ve daha sonra yedeği geri yükleme.
//
// Yedek biçimi (zip, sıkıştırmasız; açınca bir klasör olur):
//   zarmasasi-yedek.json   bildirge: { bicim, surum, tur, ad, alindi, kaynak, belgeler: { <yol>: belge }, dosyalar: [...] }
//   dosyalar/<ad>          oyuna yüklenmiş resimler, sesler, PDF'ler (adları okunabilir)
//   BENIOKU.txt            ne olduğu ve nasıl geri yükleneceği
// Belgelerin yolları oyunun içine göredir:
//   FRP masası (games/<oyun>):  "oyun", "ortak/<koleksiyon>/<belge>…" (herkesin gördüğü), "ozel/<koleksiyon>/<belge>" (yedeği alanın gizli DM verisi)
//   Masa oyunu (boards/<masa>): "masa", "durum" (kart masasının tam durumu; yalnızca masada başka oyuncu yoksa)
//   Atölye oyunu (kartoyun/<oyun>): "oyun"
// Geri yükleme her zaman yeni bir oyun açar (eskisinin üzerine yazmaz), yükleyen kişi oyunun sahibi olur ve
// dosyalar onun yükleme alanına (kota) sayılır. Biçim, dosya türleri ve kota yazmadan önce denetlenir.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const ZIP = require("../web/zip");
const KM = require("../web/oyunlar/kartmasa");
const { OYUNLAR } = require("../web/oyunlar/kurallar");
const { frpRolu, masadaMi } = require("./dosyalar");

const BICIM = "zar-masasi-oyun-yedegi", SURUM = 1, BILDIRGE = "zarmasasi-yedek.json";
const MB = 1024 * 1024;
const BILDIRGE_MAX = 48 * MB; // bildirgenin (belgelerin) en büyük boyutu
const BELGE_MAX = 20000, DOSYA_SAYI_MAX = 5000;
const ASSET_ID = /^[0-9a-f]{20}\.[a-z0-9]{2,4}$/;
const ASSET_ARA = /[0-9a-f]{20}\.[a-z0-9]{2,4}/g;
const PARCA = "[A-Za-z0-9_-]{1,80}";
const YOLLAR = {
  frp: new RegExp(`^(oyun|(ortak|ozel)(/${PARCA}){2,5})$`),
  masa: /^(masa|durum)$/,
  atolye: /^oyun$/,
};
const BILET_SURESI = 10 * 60 * 1000; // indirme bağlantısı 10 dakika geçerli
const KALDIR_SURESI = 6 * 60 * 60 * 1000; // yedeği indirdikten sonra 6 saat içinde sunucudan kaldırılabilir

const hata = (code, message) => Object.assign(new Error(message), { code });
const rid = (n = 10) => crypto.randomBytes(n).toString("hex");
const nesneMi = v => !!v && typeof v === "object" && !Array.isArray(v);
const tekSatir = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
// Dosya adını her bilgisayarda açılabilecek bir ada çevir (Türkçe harfler sadeleşir).
const TR = { ı: "i", İ: "I", ş: "s", Ş: "S", ğ: "g", Ğ: "G", ü: "u", Ü: "U", ö: "o", Ö: "O", ç: "c", Ç: "C" };
const sade = (s, n) => String(s || "").replace(/[ıİşŞğĞüÜöÖçÇ]/g, h => TR[h]).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^A-Za-z0-9 ._-]+/g, "-").replace(/\s+/g, " ").replace(/-+/g, "-").replace(/^[-. ]+|[-. ]+$/g, "").slice(0, n);

/* ---------------- Zip okuma ---------------- */
function zipOku(buf) {
  let e = -1;
  for (let i = buf.length - 22, alt = Math.max(0, buf.length - 65557); i >= alt; i--) if (buf.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw hata("bad_archive", "Bu bir zip dosyası değil. Zar Masası'ndan indirdiğin yedeği (.zip) ya da onu açtığın klasörü seç.");
  const n = buf.readUInt16LE(e + 10), merkez = buf.readUInt32LE(e + 16);
  if (n === 0xffff || merkez === 0xffffffff) throw hata("bad_archive", "Bu zip çok büyük (zip64 desteklenmiyor)");
  if (n > DOSYA_SAYI_MAX + 50) throw hata("bad_archive", "Yedekte çok fazla dosya var");
  const kayitlar = new Map();
  let p = merkez;
  for (let i = 0; i < n; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw hata("bad_archive", "Zip dosyası bozuk");
    const bayrak = buf.readUInt16LE(p + 8), yontem = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16);
    const sBoyut = buf.readUInt32LE(p + 20), boyut = buf.readUInt32LE(p + 24), adU = buf.readUInt16LE(p + 28);
    const ekU = buf.readUInt16LE(p + 30), notU = buf.readUInt16LE(p + 32), konum = buf.readUInt32LE(p + 42);
    const ad = buf.toString(bayrak & 0x800 ? "utf8" : "latin1", p + 46, p + 46 + adU).replace(/\\/g, "/");
    p += 46 + adU + ekU + notU;
    if (ad.endsWith("/") || /(^|\/)__MACOSX\//.test(ad)) continue;
    kayitlar.set(ad, { ad, bayrak, yontem, crc, sBoyut, boyut, konum });
  }
  // Bir kaydın içeriği (sınır: en çok bu kadar bayt açılır; zip bombasına karşı).
  function oku(k, sinir) {
    if (k.bayrak & 1) throw hata("bad_archive", "Şifreli zip dosyaları açılamıyor");
    if (k.boyut > sinir) throw hata("too_large", `${k.ad} çok büyük`);
    const p = k.konum;
    if (p + 30 > buf.length || buf.readUInt32LE(p) !== 0x04034b50) throw hata("bad_archive", "Zip dosyası bozuk");
    const bas = p + 30 + buf.readUInt16LE(p + 26) + buf.readUInt16LE(p + 28);
    if (bas + k.sBoyut > buf.length) throw hata("bad_archive", "Zip dosyası yarım kalmış");
    const ham = buf.subarray(bas, bas + k.sBoyut);
    let veri;
    if (k.yontem === 0) veri = ham;
    else if (k.yontem === 8) {
      try { veri = zlib.inflateRawSync(ham, { maxOutputLength: Math.max(1, k.boyut) }); }
      catch (e) { throw hata("bad_archive", `${k.ad} açılamadı`); }
    } else throw hata("bad_archive", "Bu zip sıkıştırma yöntemi desteklenmiyor; dosyayı yeniden zip'le ya da klasörü seç");
    if (veri.length !== k.boyut || ZIP.crc32(veri) !== k.crc) throw hata("bad_archive", `${k.ad} bozuk`);
    return veri;
  }
  return { kayitlar, oku };
}

function kurYedek({ store, dosyalar, kartMasa, assetDir, ASSET_TYPES, EXT, guvenlik, surum }) {
  const OPS = new Set(["yedekBileti", "oyunKaldir"]);
  const biletler = new Map(); // bilet -> { uid, yer, son }
  const indirilen = new Map(); // "kişi|yer" -> yedeğin indirildiği zaman

  const kisiAdi = uid => { const u = store.get("_sys/users/" + uid) || {}; return u.username || u.name || "Oyuncu"; };
  const varMi = uid => typeof uid === "string" && store.has("_sys/users/" + uid);
  // Bir önekin altındaki bütün belge yolları (her derinlikte).
  const altYollar = onek => { const out = []; for (const p of store.json.keys()) if (p.startsWith(onek)) out.push(p); return out; };

  function yerCoz(yer) {
    const s = String(yer || "");
    let m;
    if ((m = /^games\/([A-Za-z0-9_-]{1,80})$/.exec(s))) return { tur: "frp", id: m[1], yer: s };
    if ((m = /^boards\/(b[a-z0-9]{6,24})$/.exec(s))) return { tur: "masa", id: m[1], yer: s };
    if ((m = /^kartoyun\/(ko-[0-9a-f]{12})$/.exec(s))) return { tur: "atolye", id: m[1], yer: s };
    throw hata("invalid_argument", "Bu oyunun yedeği alınamaz");
  }

  // Kişi bu oyunun yedeğini alabilir mi, sunucudan kaldırabilir mi?
  function izin(uid, yer) {
    let y; try { y = yerCoz(yer); } catch (e) { return { yedek: false, kaldir: false }; }
    const d = store.get(y.yer);
    if (!d) return { yedek: false, kaldir: false };
    if (y.tur === "frp") return { yedek: !!frpRolu(d, uid), kaldir: d.createdBy === uid };
    if (y.tur === "masa") { const ic = masadaMi(d, uid) || d.olusturan === uid; return { yedek: ic, kaldir: ic }; }
    return { yedek: d.sahip === uid, kaldir: d.sahip === uid };
  }

  // Oyunun belgeleri ve dosyaları (yedeğe girecek her şey).
  function topla(uid, yer) {
    const y = yerCoz(yer), d = store.get(y.yer);
    if (!d) throw hata("not_found", "Bu oyun artık sunucuda yok");
    if (!izin(uid, y.yer).yedek) throw hata("permission_denied", y.tur === "frp" ? "Yalnızca bu oyunun DM'leri ve oyuncuları yedek alabilir" : y.tur === "masa" ? "Yalnızca masadaki oyuncular ya da masayı açan yedek alabilir" : "Atölye oyununun yedeğini yalnızca yapan kişi alabilir");
    const belgeler = {}, uyarilar = [];
    let ad;
    if (y.tur === "frp") {
      ad = d.name || "Adsız oyun";
      belgeler.oyun = d;
      for (const p of altYollar(y.yer + "/")) belgeler["ortak/" + p.slice(y.yer.length + 1)] = store.get(p);
      const ozel = `data/users/${uid}/g-${y.id}/`;
      for (const p of altYollar(ozel)) belgeler["ozel/" + p.slice(ozel.length)] = store.get(p);
    } else if (y.tur === "masa") {
      const kart = d.oyun === "kart";
      ad = d.ad || (kart ? (d.tanim || {}).ad : (OYUNLAR[d.oyun] || {}).ad) || "Masa";
      belgeler.masa = d;
      if (kart) {
        const tam = store.get("_sys/kartmasa/" + y.id);
        // Tam durumda destelerin sırası ve herkesin eli vardır: masada başka bir oyuncu varsa yedeğe girmez.
        if (tam && !(tam.koltuk || []).some(k => k && !k.bot && k.id !== uid)) belgeler.durum = tam;
        else if (tam) uyarilar.push("Masada başka oyuncular olduğu için ellerdeki ve destelerdeki gizli kartlar yedeğe alınmadı. Geri yükleyince masa oyunun başından açılır.");
      }
    } else {
      ad = (d.tanim || {}).ad || "Atölye oyunu";
      belgeler.oyun = d;
    }
    // Dosyalar: bu oyuna yüklediklerin ve belgelerde kullanılan bütün dosyalar (başkasının yüklediği harita da olsa).
    const ids = new Set();
    for (const p of store.paths("_sys/assets")) { const a = store.get(p); if (a && a.owner === uid && a.yer === y.yer) ids.add(p.slice(12)); }
    for (const m of JSON.stringify(belgeler).matchAll(/\/assets\/([0-9a-f]{20}\.[a-z0-9]{2,4})/g)) ids.add(m[1]);
    const dosyaList = [];
    let eksik = 0;
    for (const id of ids) {
      const a = store.get("_sys/assets/" + id), f = path.join(assetDir, id);
      if (!a || !fs.existsSync(f)) { eksik++; continue; }
      dosyaList.push({ id, f, ad: a.name || id, tur: a.type, boyut: fs.statSync(f).size, created: a.created || 0 });
    }
    if (eksik) uyarilar.push(`${eksik} dosya sunucuda bulunamadı (daha önce silinmiş); yedekte yok.`);
    dosyaList.sort((a, b) => a.created - b.created);
    return { ...y, ad, belgeler, dosyalar: dosyaList, uyarilar };
  }

  /* ---------------- Dışa aktarma (indirme) ---------------- */
  async function zipYaz(res, t) {
    const yaz = b => new Promise((ok, red) => { if (res.destroyed) return red(new Error("bağlantı kapandı")); res.write(b) ? ok() : res.once("drain", ok); });
    const kayitlar = []; let konum = 0;
    const ekle = async (ad, veri, zaman) => {
      const crc = ZIP.crc32(veri), h = ZIP.yerelBaslik(ad, crc, veri.length, zaman);
      kayitlar.push({ ad, crc, boyut: veri.length, konum, zaman });
      await yaz(Buffer.from(h)); await yaz(veri); konum += h.length + veri.length;
      if (konum > 0xfffffff0) throw new Error("Yedek 4 GB'tan büyük olamaz");
    };
    // Dosyalara okunabilir ve benzersiz adlar ver; bildirgede hangi dosyanın nerede olduğu yazar.
    const kullanildi = new Set(), dosyaBilgi = [];
    for (const d of t.dosyalar) {
      const uz = EXT[d.tur] || d.id.split(".").pop();
      let kok = sade(String(d.ad).replace(/\.[A-Za-z0-9]{1,5}$/, ""), 60) || "dosya", ad = `dosyalar/${kok}.${uz}`;
      for (let i = 2; kullanildi.has(ad.toLowerCase()); i++) ad = `dosyalar/${kok}-${i}.${uz}`;
      kullanildi.add(ad.toLowerCase());
      const veri = fs.readFileSync(d.f);
      dosyaBilgi.push({ id: d.id, yol: ad, ad: d.ad, tur: d.tur, boyut: veri.length, crc32: ZIP.crc32(veri) });
    }
    const bildirge = {
      bicim: BICIM, surum: SURUM, uygulama: "Zar Masası " + surum, tur: t.tur, ad: t.ad, alindi: new Date().toISOString(),
      kaynak: { yer: t.yer }, belgeler: t.belgeler, dosyalar: dosyaBilgi,
    };
    const toplam = dosyaBilgi.reduce((a, d) => a + d.boyut, 0);
    const benioku = [
      `Zar Masası oyun yedeği: ${t.ad}`,
      `Alındığı zaman: ${new Date().toLocaleString("tr-TR")}`,
      `Tür: ${{ frp: "FRP masası", masa: "Masa oyunu", atolye: "Oyun atölyesi oyunu" }[t.tur]}`,
      `${dosyaBilgi.length} dosya, ${(toplam / MB).toFixed(1)} MB`,
      "",
      "Bu yedeği geri yüklemek için: Zar Masası > Yüklediklerim > \"Yedekten geri yükle\".",
      "Bu .zip dosyasını ya da açtığın klasörü seçebilirsin. Geri yükleme yeni bir oyun açar;",
      "dosyalar senin yükleme alanına sayılır.",
      "",
      "zarmasasi-yedek.json dosyasını değiştirme ve silme: oyunun bütün bilgileri (karakterler, haritalar,",
      "notlar, jetonlar, kartlar) onun içinde. dosyalar/ klasöründeki resimleri, sesleri ve PDF'leri açıp",
      "kullanabilirsin.",
      "",
    ].join("\r\n");
    await ekle("BENIOKU.txt", Buffer.from(benioku, "utf8"));
    await ekle(BILDIRGE, Buffer.from(JSON.stringify(bildirge, null, 1), "utf8"));
    for (let i = 0; i < t.dosyalar.length; i++) await ekle(dosyaBilgi[i].yol, fs.readFileSync(t.dosyalar[i].f), t.dosyalar[i].created);
    for (const p of ZIP.sonBolum(kayitlar, konum)) await yaz(Buffer.from(p));
    res.end();
  }

  /* ---------------- İçe aktarma (geri yükleme) ---------------- */
  function bildirgeBul(zip) {
    let k = null;
    for (const [ad, x] of zip.kayitlar) if (ad.split("/").pop() === BILDIRGE && (!k || ad.length < k.ad.length)) k = x;
    if (!k) throw hata("bad_archive", `Bu bir Zar Masası oyun yedeği değil (${BILDIRGE} bulunamadı)`);
    let b;
    try { b = JSON.parse(zip.oku(k, BILDIRGE_MAX).toString("utf8")); } catch (e) { if (e.code) throw e; throw hata("bad_archive", `${BILDIRGE} okunamadı: dosya değiştirilmiş ya da bozuk`); }
    return { b, onek: k.ad.slice(0, k.ad.length - BILDIRGE.length) };
  }

  function bildirgeDenetle(b) {
    if (!nesneMi(b) || b.bicim !== BICIM) throw hata("bad_archive", "Bu bir Zar Masası oyun yedeği değil");
    if (!Number.isInteger(b.surum) || b.surum < 1) throw hata("bad_archive", "Yedeğin sürümü okunamadı");
    if (b.surum > SURUM) throw hata("bad_archive", "Bu yedek Zar Masası'nın daha yeni bir sürümüyle alınmış. Önce sunucuyu güncelle.");
    if (!YOLLAR[b.tur]) throw hata("bad_archive", "Yedeğin türü tanınmadı");
    if (!nesneMi(b.belgeler)) throw hata("bad_archive", "Yedekte oyun bilgileri yok");
    const yollar = Object.keys(b.belgeler);
    if (yollar.length > BELGE_MAX) throw hata("bad_archive", "Yedekte çok fazla belge var");
    for (const y of yollar) {
      if (!YOLLAR[b.tur].test(y)) throw hata("bad_archive", `Yedekte tanınmayan bir bölüm var: ${y.slice(0, 80)}`);
      if (!nesneMi(b.belgeler[y])) throw hata("bad_archive", `Yedekteki ${y.slice(0, 80)} bozuk`);
    }
    const ana = b.tur === "masa" ? "masa" : "oyun";
    if (!b.belgeler[ana]) throw hata("bad_archive", "Yedekte oyunun kendisi yok");
    if (!Array.isArray(b.dosyalar || [])) throw hata("bad_archive", "Yedekteki dosya listesi bozuk");
    if ((b.dosyalar || []).length > DOSYA_SAYI_MAX) throw hata("bad_archive", "Yedekte çok fazla dosya var");
    const gor = new Set();
    for (const d of b.dosyalar || []) {
      if (!nesneMi(d) || !ASSET_ID.test(String(d.id)) || gor.has(d.id)) throw hata("bad_archive", "Yedekteki dosya listesi bozuk");
      gor.add(d.id);
      if (typeof d.yol !== "string" || !d.yol || d.yol.length > 400) throw hata("bad_archive", "Yedekteki dosya listesi bozuk");
    }
  }

  // Kart masasının tam durumu tutarlı mı (geri yüklenen masa sunucuyu bozmasın)?
  function kartDurumu(d) {
    if (!nesneMi(d) || !nesneMi(d.tanim) || !Array.isArray(d.koltuk) || !nesneMi(d.kartlar) || !nesneMi(d.desteler) || !nesneMi(d.el) || !nesneMi(d.taslar) || !Array.isArray(d.log)) return null;
    if (JSON.stringify(KM.tanimDuzelt(d.tanim)) !== JSON.stringify(d.tanim)) return null;
    if (d.koltuk.length !== d.tanim.oyuncu.max) return null;
    for (const k of d.koltuk) if (k && (!nesneMi(k) || !varMi(k.id))) return null;
    try { KM.acikGorunum(d); for (const k of d.koltuk) if (k) KM.gizliGorunum(d, k.id); } catch (e) { return null; }
    return d;
  }

  function iceAktar(uid, buf) {
    const zip = zipOku(buf);
    const { b, onek } = bildirgeBul(zip);
    bildirgeDenetle(b);
    const uyarilar = [];

    // Dosyaları bul ve oku. Ad değişmişse (ör. klasör başka bir programla yeniden zip'lendiyse) boyut ve
    // sağlama toplamından bulunur.
    const MAX = dosyalar.MAX, kalan = Math.max(0, dosyalar.kotaOf(uid) - dosyalar.kullanilan(uid));
    const gelen = [], kullanilan = new Set();
    let toplam = 0, eksik = 0, desteksiz = 0;
    for (const d of b.dosyalar || []) {
      if (!ASSET_TYPES.test(String(d.tur)) || !EXT[d.tur]) { desteksiz++; continue; }
      let k = zip.kayitlar.get(onek + d.yol);
      if (!k || kullanilan.has(k)) k = [...zip.kayitlar.values()].find(x => !kullanilan.has(x) && x.boyut === d.boyut && x.crc === d.crc32) || null;
      if (!k) { eksik++; continue; }
      kullanilan.add(k);
      if (k.boyut > MAX) throw hata("too_large", `${tekSatir(d.ad || d.yol, 80)} çok büyük: bir dosya en çok ${Math.round(MAX / MB)} MB olabilir`);
      toplam += k.boyut;
      gelen.push({ d, k });
    }
    if (toplam > kalan) {
      const mb = v => (v / MB).toFixed(1) + " MB";
      throw hata("too_large", `Yükleme alanın yetmiyor: yedekteki dosyalar ${mb(toplam)}, boş alanın ${mb(kalan)}. Yüklediklerim sayfasından başka oyunların yedeğini alıp sunucudan kaldırarak yer açabilirsin.`);
    }
    if (eksik) uyarilar.push(`${eksik} dosya yedek klasöründe bulunamadı; o resimler ve sesler görünmeyecek.`);
    if (desteksiz) uyarilar.push(`${desteksiz} dosyanın türü bu sunucuda yüklenemiyor; atlandı.`);

    // Yeni kimlikler: dosyalar ve oyun. Belgelerdeki eski dosya adresleri yenileriyle değiştirilir.
    const esle = new Map();
    for (const g of gelen) esle.set(g.d.id, rid(10) + "." + EXT[g.d.tur]);
    const yenile = v => JSON.parse(JSON.stringify(v).replace(ASSET_ARA, m => esle.get(m) || m));
    const belgeler = yenile(b.belgeler);
    const simdi = Date.now(), benAd = kisiAdi(uid);
    const yazilacak = []; // [yol, belge]
    let yer, id, ad, tur = b.tur;

    if (tur === "frp") {
      const o = belgeler.oyun, eskiId = typeof o.id === "string" ? o.id : null;
      id = "g-" + simdi.toString(36) + rid(3); yer = "games/" + id;
      ad = tekSatir(o.name, 80) || "Adsız oyun";
      // Eski oyunun kimliği belgelerin içinde geçiyorsa yenisiyle değiştir.
      const kimlikYenile = eskiId && eskiId !== id && /^[A-Za-z0-9_-]{3,80}$/.test(eskiId)
        ? v => JSON.parse(JSON.stringify(v).split(JSON.stringify(eskiId)).join(JSON.stringify(id))) : v => v;
      const dms = { [uid]: true }, players = {};
      for (const [k, v] of Object.entries(nesneMi(o.dms) ? o.dms : {})) if (v && k !== uid && varMi(k)) dms[k] = true;
      for (const [k, v] of Object.entries(nesneMi(o.players) ? o.players : {})) if (v && !dms[k] && varMi(k)) players[k] = nesneMi(v) ? v : { joined: simdi, charId: null };
      yazilacak.push([yer, { ...kimlikYenile(o), id, name: ad, createdBy: uid, dms, players, pending: {}, created: simdi, updated: simdi, geriYuklendi: simdi }]);
      for (const [y, v] of Object.entries(belgeler)) {
        if (y.startsWith("ortak/")) yazilacak.push([`games/${id}/${y.slice(6)}`, kimlikYenile(v)]);
        else if (y.startsWith("ozel/")) yazilacak.push([`data/users/${uid}/g-${id}/${y.slice(5)}`, kimlikYenile(v)]);
      }
    } else if (tur === "masa") {
      const m = belgeler.masa;
      id = "b" + simdi.toString(36) + rid(3); yer = "boards/" + id;
      const odaAd = tekSatir(m.ad, 60);
      if (m.oyun === "kart") {
        let d = belgeler.durum ? kartDurumu(belgeler.durum) : null;
        if (belgeler.durum && !d) uyarilar.push("Masanın kaydedilmiş durumu bu sunucuda kullanılamadı; masa oyunun başından açıldı.");
        const tanim = d ? d.tanim : KM.tanimDuzelt(m.tanim);
        if (!d) { d = KM.yeni(tanim); d.koltuk[0] = { id: uid, name: benAd, renk: KM.RENKLER[0] }; }
        if (JSON.stringify(tanim).length > 400000) throw hata("bad_archive", "Yedekteki oyun çok büyük");
        ad = odaAd || tanim.ad;
        const kaynak = typeof m.hazir === "string" && /^[a-z0-9-]{1,40}$/.test(m.hazir) ? { hazir: m.hazir } : {};
        yazilacak.push([yer, { oyun: "kart", tanim, ...kaynak, ...(odaAd ? { ad: odaAd } : {}), olusturan: uid, created: simdi, updated: simdi, geriYuklendi: simdi }]);
        yazilacak.push(["_kart", d]);
      } else {
        const g = OYUNLAR[m.oyun];
        if (!g) throw hata("bad_archive", "Bu masa oyunu bu sunucuda yok");
        let durum = m.durum;
        try { if (!nesneMi(durum)) throw 0; if (!durum.bitti) g.hamleler(durum); } catch (e) { durum = g.yeni(Math.random); uyarilar.push("Tahtanın kaydedilmiş durumu okunamadı; oyun baştan başladı."); }
        const koltuk = [0, 1].map(i => { const k = (Array.isArray(m.koltuk) ? m.koltuk : [])[i]; return k && nesneMi(k) && varMi(k.id) ? { id: k.id, name: tekSatir(k.name, 40) || kisiAdi(k.id), ...(k.bot ? { bot: true } : {}) } : null; });
        if (!koltuk.some(k => k && k.id === uid) && !koltuk[0]) koltuk[0] = { id: uid, name: benAd };
        ad = odaAd || g.ad;
        yazilacak.push([yer, { oyun: m.oyun, ...(odaAd ? { ad: odaAd } : {}), durum, koltuk, olusturan: uid, created: simdi, updated: simdi, geriYuklendi: simdi }]);
      }
    } else {
      const o = belgeler.oyun;
      if (store.list("kartoyun").filter(x => x.data.sahip === uid).length >= 50) throw hata("invalid_argument", "En fazla 50 atölye oyunun olabilir; önce birini sil");
      const tanim = KM.tanimDuzelt(o.tanim);
      if (!tanim.desteler.length && !tanim.taslar.length) throw hata("bad_archive", "Yedekteki oyunda deste ya da taş yok");
      if (JSON.stringify(tanim).length > 400000) throw hata("bad_archive", "Yedekteki oyun çok büyük");
      id = "ko-" + rid(6); yer = "kartoyun/" + id; ad = tanim.ad;
      yazilacak.push([yer, { tanim, sahip: uid, sahipAd: benAd, created: simdi, updated: simdi, geriYuklendi: simdi }]);
    }
    for (const [y, v] of yazilacak) if (y !== "_kart" && JSON.stringify(v).length > 15 * MB) throw hata("too_large", "Yedekteki bir belge çok büyük");

    // Her şey denetlendi: önce dosyalar, sonra belgeler. Bir sorun çıkarsa yazılan dosyalar geri alınır.
    const yazilan = [];
    try {
      for (const g of gelen) {
        const yeni = esle.get(g.d.id), veri = zip.oku(g.k, MAX);
        fs.writeFileSync(path.join(assetDir, yeni), veri); yazilan.push(yeni);
      }
    } catch (e) { for (const f of yazilan) fs.rmSync(path.join(assetDir, f), { force: true }); throw e; }
    for (const g of gelen) {
      const yeni = esle.get(g.d.id);
      store.set("_sys/assets/" + yeni, { owner: uid, type: g.d.tur, size: g.k.boyut, name: tekSatir(g.d.ad, 200), created: simdi, yer });
    }
    for (const [y, v] of yazilacak) {
      if (y === "_kart") kartMasa.kaydet(id, v); else store.set(y, v);
    }
    return { tur, yer, id, ad, dosya: gelen.length, boyut: toplam, uyarilar };
  }

  /* ---------------- Sunucudan kaldırma ---------------- */
  function kaldir(uid, yer) {
    const y = yerCoz(yer), d = store.get(y.yer);
    if (!d) throw hata("not_found", "Bu oyun zaten sunucuda yok");
    if (!izin(uid, y.yer).kaldir) throw hata("permission_denied", y.tur === "frp" ? "Oyunu yalnızca kurucusu sunucudan kaldırabilir" : y.tur === "masa" ? "Masayı yalnızca oyuncular ya da açan kaldırabilir" : "Atölye oyununu yalnızca yapan kişi kaldırabilir");
    const t = indirilen.get(uid + "|" + y.yer);
    if (!t || Date.now() - t > KALDIR_SURESI) throw hata("failed_precondition", "Önce bu oyunun yedeğini indir; yedek bilgisayarına inince sunucudan kaldırabilirsin");
    // Kişinin bu oyuna yüklediği dosyalar (ve oyunda kullandığı, yeri bilinmeyen eski yüklemeleri).
    const belgeMetni = JSON.stringify(topla(uid, y.yer).belgeler);
    const silinecek = [];
    for (const p of store.paths("_sys/assets")) {
      const a = store.get(p), aid = p.slice(12);
      if (a && a.owner === uid && (a.yer === y.yer || (!a.yer && belgeMetni.includes("/assets/" + aid)))) silinecek.push([aid, a.size || 0]);
    }
    let belge = 0;
    const sil = p => { if (store.has(p)) { store.delete(p); belge++; } };
    if (y.tur === "frp") {
      const ozel = new RegExp(`^data/users/[^/]+/(g-|chat/)${y.id.replace(/[-]/g, "\\-")}/`);
      for (const p of [...store.json.keys()]) if (p.startsWith(y.yer + "/") || p.startsWith(`chat/${y.id}/`) || ozel.test(p)) sil(p);
      sil(y.yer);
    } else if (y.tur === "masa") {
      const tam = store.get("_sys/kartmasa/" + y.id);
      if (tam) for (const k of tam.koltuk || []) if (k) sil(`data/users/${k.id}/kartmasa/${y.id}`);
      sil("_sys/kartmasa/" + y.id); sil(y.yer);
    } else sil(y.yer);
    let bosalan = 0;
    for (const [aid, boyut] of silinecek) { fs.rmSync(path.join(assetDir, aid), { force: true }); store.delete("_sys/assets/" + aid); bosalan += boyut; }
    indirilen.delete(uid + "|" + y.yer);
    return { belge, dosya: silinecek.length, bosalan };
  }

  function op(c, m) {
    switch (m.op) {
      case "yedekBileti": { // indirme bağlantısı: tarayıcı başlık ekleyemediği için kısa ömürlü bir bilet
        const y = yerCoz(m.yer);
        const t = topla(c.uid, y.yer); // izin ve varlık burada denetlenir
        for (const [k, v] of biletler) if (v.son < Date.now()) biletler.delete(k);
        const bilet = rid(16);
        biletler.set(bilet, { uid: c.uid, yer: y.yer, son: Date.now() + BILET_SURESI });
        return { url: "/api/oyun-yedek/" + bilet, ad: t.ad, dosya: t.dosyalar.length, boyut: t.dosyalar.reduce((a, d) => a + d.boyut, 0), uyarilar: t.uyarilar };
      }
      case "oyunKaldir": return kaldir(c.uid, m.yer);
    }
    throw hata("unknown_op", "Bilinmeyen işlem");
  }

  // HTTP: GET /api/oyun-yedek/<bilet> (indir), POST /api/oyun-yedek (geri yükle). İşlendiyse true döner.
  function http(req, res, p, send, authed) {
    if (req.method === "GET" && p.startsWith("/api/oyun-yedek/")) {
      const b = biletler.get(p.slice(16));
      if (!b || b.son < Date.now()) { send(res, 404, "Bu indirme bağlantısının süresi doldu. Yüklediklerim sayfasından yeniden yedek al.", "text/plain; charset=utf-8"); return true; }
      let t;
      try { t = topla(b.uid, b.yer); } catch (e) { send(res, e.code === "not_found" ? 404 : 403, e.message, "text/plain; charset=utf-8"); return true; }
      const dosyaAdi = (sade(t.ad, 60) || "oyun") + " - zar masasi yedegi.zip";
      const okunur = tekSatir(t.ad, 60).replace(/[\\/:*?"<>|]/g, "-") + " - Zar Masası yedeği.zip";
      res.writeHead(200, { ...guvenlik, "Content-Type": "application/zip", "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${dosyaAdi}"; filename*=UTF-8''${encodeURIComponent(okunur)}` });
      zipYaz(res, t).then(() => indirilen.set(b.uid + "|" + b.yer, Date.now()))
        .catch(e => { console.error("[yedek]", e.message); res.destroy(); });
      return true;
    }
    if (req.method === "POST" && p === "/api/oyun-yedek") {
      const uid = authed(req); if (!uid) { send(res, 401, { code: "unauthorized", message: "Önce giriş yap" }); return true; }
      // Gövde sınırı: boş yükleme alanı kadar dosya + belgeler için pay.
      const sinir = Math.max(0, dosyalar.kotaOf(uid) - dosyalar.kullanilan(uid)) + BILDIRGE_MAX + MB;
      const reddet = () => { res.setHeader("Connection", "close"); send(res, 413, { code: "too_large", message: "Yedek, boş yükleme alanından büyük. Yüklediklerim sayfasından yer açabilirsin." }); };
      if (Number(req.headers["content-length"]) > sinir) { reddet(); req.resume(); return true; }
      const parcalar = []; let boyut = 0, kesildi = false;
      req.on("data", ch => { if (kesildi) return; boyut += ch.length; if (boyut > sinir) { kesildi = true; reddet(); req.destroy(); } else parcalar.push(ch); });
      req.on("end", () => {
        if (kesildi) return;
        try { send(res, 200, iceAktar(uid, Buffer.concat(parcalar))); }
        catch (e) {
          if (!e.code) console.error("[yedek]", e);
          send(res, e.code === "too_large" ? 413 : e.code ? 400 : 500, { code: e.code || "internal", message: e.code ? e.message : "Yedek yüklenirken sunucuda bir hata oldu" });
        }
      });
      return true;
    }
    return false;
  }

  return { OPS, op, http, izin, iceAktar, kaldir, topla };
}

module.exports = { kurYedek, zipOku, BICIM, SURUM, BILDIRGE };
