// Hesaplar ve oyun dışı sosyal özellikler: kullanıcı adı + şifre ile üyelik, profil (fotoğraf, hakkında),
// arkadaşlık istekleri ve arkadaşlar arası özel mesajlar.
//
// Veri yapısı (hepsini yalnızca sunucu yazar):
//   _sys/hesap/<küçük harfli ad>        { uid, ad, salt, hash, created, eposta?, epostaT? }  şifre özeti (scrypt) ve
//                                                                         doğrulanmış e-posta, kimseye gösterilmez
//   _sys/eposta/<sha(e-posta)>          { uid, k }                          e-posta -> hesap (bir adres tek hesapta)
//   _sys/oturum/<sha(gizli)>            { uid, t, son }                     girişte verilen oturum anahtarları
//                                                                         (OTURUM_OMRU boyunca kullanılmayan oturum kapanır)
//   _sys/users/<kişi>                   { ..., username, foto, hakkinda }   herkese açık profil alanları
//   data/users/<kişi>/arkadas/<öteki>   { durum: "gelen" | "giden" | "arkadas", t }
//   data/users/<kişi>/konusma/<öteki>   { son, t, benden, okunmamis }      konuşma listesi
//   data/users/<kişi>/dm/<öteki>/<ileti> { id, t, by, text, resim? }        iletiler (iki tarafa da yazılır)
//   _sys/grup/<grup>                    { ad, sahip, uyeler: {kişi: zaman}, created }   sohbet grubu
//   data/users/<kişi>/grup/<grup>/<ileti> { id, t, by, text, resim?, sistem? }  grup iletileri (her üyeye yazılır)
//   data/users/<kişi>/konusma/<grup>    { grup: true, ad, son, t, benden, okunmamis, uye }  konuşma listesinde grup
const crypto = require("crypto");
const { kurInsanMi } = require("./insanmi");
const { epostaDuz, epostaGecerli, maskele, kodPostasi } = require("./eposta");

const rid = (n = 12) => crypto.randomBytes(n).toString("hex");
const sha = s => crypto.createHash("sha256").update(String(s)).digest("hex");
const ADI = /^[\p{L}\p{N}_.-]{3,20}$/u;
// Büyük/küçük harf ve ı/i farkı gözetilmez: "ALİ", "Ali", "alı" aynı addır (birbirini taklit edemez).
const anahtar = ad => String(ad || "").normalize("NFC").trim().replace(/[İI]/g, "i").toLowerCase().replace(/ı/g, "i").replace(/\u0307/g, "");
const DM_KEEP = 500;
const GRUP_ID = /^gr-[0-9a-f]{12}$/, KISI_ID = /^u-[0-9a-f]{8,}$/;
const GRUP_UYE = 50;
const RESIM = /^\/assets\/[a-z0-9]+\.(gif|webp|png|jpg)$/;
const GUN = 24 * 3600 * 1000;
const OTURUM_OMRU = 30 * GUN; // bu kadar süre kullanılmayan oturum kendiliğinden kapanır
// Hesap kilidi: bir hesaba 15 dakikada 5 yanlış şifre girilirse o hesaba 15 dakika giriş yapılamaz.
const KILIT_DENEME = 5, KILIT_SURE = 15 * 60 * 1000;
// Çok bilinen şifreler (yeni şifrede kabul edilmez).
const ZAYIF = new Set(["12345678", "123456789", "1234567890", "87654321", "11111111", "00000000", "12341234", "11223344",
  "password", "password1", "parola123", "sifre123", "şifre123", "qwertyui", "qwerty123", "asdfghjk", "abcd1234", "abc12345",
  "iloveyou", "football", "trabzonspor", "galatasaray", "fenerbahce", "besiktas", "dragon12", "zarmasasi", "zindanlar"]);
function sifreKurali(sifre, ad) {
  sifre = String(sifre || "");
  if (sifre.length < 8) return "Şifre en az 8 karakter olmalı";
  if (sifre.length > 200) return "Şifre en çok 200 karakter olabilir";
  const k = anahtar(sifre);
  if (ZAYIF.has(k) || new Set(k).size < 3) return "Bu şifre çok kolay tahmin edilir, başka bir şifre seç";
  if (ad && k.includes(anahtar(ad))) return "Şifre kullanıcı adını içermemeli";
  return null;
}

function scrypt(sifre, salt) { return crypto.scryptSync(String(sifre), salt, 32).toString("hex"); }
function sifreDogru(h, sifre) {
  const a = Buffer.from(scrypt(sifre, h.salt), "hex"), b = Buffer.from(h.hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const hata = (code, message) => Object.assign(new Error(message), { code });

// Kayıt koruması (adres başına): bir saatte 3. kayıt denemesinden ya da bir günde 1 hesap açıldıktan sonra
// "insan mısın?" resmi sorulur; bir adresten günde en çok KAYIT_GUNLUK hesap açılır. Bütün sunucuya 10 dakikada
// 20'den fazla kayıt gelirse (toplu saldırı) herkese resim sorulur.
const SAAT = 3600 * 1000;
const KAYIT_SAATLIK = 3, KAYIT_GUNLUK = 10, TOPLU_KAYIT = 20;
// Kodlar: 6 hane, 15 dakika geçerli, 5 yanlış denemede geçersiz olur; en erken 60 saniyede bir yeniden gönderilir.
const KOD_OMRU = 15 * 60 * 1000, KOD_DENEME = 5, KOD_ARALIK = 60 * 1000, KOD_GONDERIM = 5;

function kurHesap({ store, conns, arkadasBildir = () => {}, epostaGonder = null, epostaModu = "", sunucuAdi = "Zar Masası", log = console, insanMi = kurInsanMi() }) {
  // E-posta zorunluluğu: yalnızca bir gönderici (SMTP) varsa açılır; yoksa kimse kilitli kalmasın diye kapalıdır.
  const epostaAcik = !!epostaGonder && epostaModu !== "kapali";
  const hesapOf = ad => store.get("_sys/hesap/" + anahtar(ad));
  const kisi = uid => (/^u-[0-9a-f]{8,}$/.test(String(uid || "")) && store.get("_sys/users/" + uid)) || null;
  const herkeseAcik = (uid, u) => ({ id: uid, kullanici: u.username || null, ad: u.name || u.username || "Oyuncu", renk: u.color || "#2f8f86", foto: u.foto || null });

  // Kimlik doğrulama: hesapsız kimliğin gizli anahtarı ya da girişte verilmiş oturum anahtarı.
  // Hesabı olan biri yalnızca oturum anahtarıyla girer; hesapsızken kullandığı eski anahtar artık geçmez.
  function gecerli(uid, secret) {
    const u = kisi(uid); if (!u || !secret) return false;
    if (!u.username && u.secretHash && sha(secret) === u.secretHash) return true;
    const yol = "_sys/oturum/" + sha(secret), o = store.get(yol);
    if (!o || o.uid !== uid) return false;
    const now = Date.now();
    if (now - (o.son || o.t || 0) > OTURUM_OMRU) { store.delete(yol); return false; }
    if (now - (o.son || o.t || 0) > 3600000) store.set(yol, { ...o, son: now }); // kullanıldıkça süre uzar
    return true;
  }
  function oturumAc(uid) {
    const secret = rid(16), t = Date.now();
    store.set("_sys/oturum/" + sha(secret), { uid, t, son: t });
    return secret;
  }
  // Süresi dolmuş oturumları temizle (açılışta ve günde bir).
  function oturumTemizle() {
    const now = Date.now();
    for (const d of store.list("_sys/oturum")) if (!d.data || now - (d.data.son || d.data.t || 0) > OTURUM_OMRU) store.delete(d.path);
  }
  oturumTemizle();
  const temizlik = setInterval(oturumTemizle, GUN); temizlik.unref();

  // Art arda yanlış şifre denemelerini yavaşlat: bir adresten 10 dakikada en çok 10 hatalı deneme.
  const denemeler = new Map();
  function sinir(ip) {
    const now = Date.now(), a = (denemeler.get(ip) || []).filter(t => now - t < 600000);
    if (a.length) denemeler.set(ip, a); else denemeler.delete(ip);
    if (a.length >= 10) throw hata("rate_limited", "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene.");
    return () => { a.push(now); denemeler.set(ip, a); };
  }
  // Hesap başına kilit: farklı adreslerden aynı hesaba şifre denenmesini de durdurur.
  const hesapDeneme = new Map(); // anahtar(ad) -> { n, ilk, kilit }
  function kilitli(k) {
    const d = hesapDeneme.get(k), now = Date.now();
    if (!d) return false;
    if (d.kilit && now < d.kilit) return true;
    if (d.kilit || now - d.ilk > KILIT_SURE) hesapDeneme.delete(k);
    return false;
  }
  function hesapYanlis(k) {
    const now = Date.now(); let d = hesapDeneme.get(k);
    if (!d || now - d.ilk > KILIT_SURE) d = { n: 0, ilk: now, kilit: 0 };
    d.n++; if (d.n >= KILIT_DENEME) d.kilit = now + KILIT_SURE;
    hesapDeneme.set(k, d);
  }
  // Bellekte birikmesin diye eski kayıtları ara ara sil.
  const supurge = setInterval(() => {
    const now = Date.now();
    for (const [ip, a] of denemeler) if (!a.some(t => now - t < 600000)) denemeler.delete(ip);
    for (const [k, d] of hesapDeneme) if (now - d.ilk > KILIT_SURE && !(d.kilit > now)) hesapDeneme.delete(k);
  }, 600000); supurge.unref();
  const SAHTE = { salt: rid(16), hash: "00".repeat(32) }; // olmayan hesapta da aynı süre harcansın

  /* ---------------- Kayıt koruması: adres başına sayaçlar ve "insan mısın?" ---------------- */
  const olaylar = new Map(); // ip -> { kayit: [t], acilan: [t], posta: [t], sifirla: [t], insan: [t] }
  const tumKayit = []; // bütün sunucuda son kayıt denemeleri (toplu saldırıyı fark etmek için)
  function say(ip, tur, sure) {
    const o = olaylar.get(ip), now = Date.now();
    if (!o || !o[tur]) return 0;
    o[tur] = o[tur].filter(t => now - t < sure);
    return o[tur].length;
  }
  function ekle(ip, tur) { const o = olaylar.get(ip) || {}; (o[tur] = o[tur] || []).push(Date.now()); olaylar.set(ip, o); }
  // Aynı makineden gelen istekler (sunucuyu kendi bilgisayarında açan kişi) sınırlanmaz.
  const yerel = ip => /^(127\.|::1$|::ffff:127\.)/.test(String(ip));
  function insanGerekli(ip, tur) {
    if (yerel(ip)) return false;
    const now = Date.now();
    while (tumKayit.length && now - tumKayit[0] > 600000) tumKayit.shift();
    if (tumKayit.length >= TOPLU_KAYIT) return true;
    if (tur === "sifirla") return say(ip, "sifirla", SAAT) >= 3;
    return say(ip, "kayit", SAAT) >= KAYIT_SAATLIK - 1 || say(ip, "acilan", 24 * SAAT) >= 1;
  }
  // Gerekiyorsa resmin cevabını ister; yanlışsa yeni resim istenir.
  function insanKontrol(ip, b, tur) {
    if (!insanGerekli(ip, tur)) return;
    const x = b.insan || {};
    if (!x.id) throw hata("insan_gerekli", "Devam etmeden önce resimdeki harfleri yaz");
    if (!insanMi.dogrula(x.id, x.cevap)) throw hata("insan_yanlis", "Resimdeki harfler doğru yazılmadı. Yeni resimle tekrar dene.");
  }
  function insanResmi(ip) {
    if (say(ip, "insan", 600000) >= 40) throw hata("rate_limited", "Çok fazla istek. Birkaç dakika sonra tekrar dene.");
    ekle(ip, "insan");
    const { id, resim } = insanMi.yeni();
    return { id, resim };
  }

  /* ---------------- E-posta kodları ---------------- */
  const epostaYol = e => "_sys/eposta/" + sha(epostaDuz(e));
  const epostaSahibi = e => { const x = store.get(epostaYol(e)); return x && kisi(x.uid) ? x : null; };
  const hesapOfUid = uid => { const u = kisi(uid); return u && u.username ? hesapOf(u.username) : null; };
  const epostaGerekli = uid => { if (!epostaAcik) return false; const h = hesapOfUid(uid); return !!h && !h.eposta; };
  const adresGonderim = new Map(); // e-posta -> [t]: bir adrese saatte en çok 6 kod (başkasını rahatsız etmek için kullanılmasın)
  const kodUret = () => String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  function epostaAl(v) {
    const e = epostaDuz(v);
    if (!epostaGecerli(e)) throw hata("invalid_argument", "Geçerli bir e-posta adresi yaz");
    return e;
  }
  // Kayda (r) yeni bir kod üretir ve gönderir. r: { eposta, kod, deneme, gonderim: [t] }
  // gercek=false: her şey aynı işler ama posta gitmez (kayıtlı olmayan adres, "Şifremi unuttum" bunu belli etmesin).
  async function kodGonder(r, amac, ip, ilk, gercek = true) {
    const now = Date.now();
    r.gonderim = r.gonderim || [];
    const sonGonderim = r.gonderim[r.gonderim.length - 1] || 0;
    if (!ilk && now - sonGonderim < KOD_ARALIK) throw hata("rate_limited", `Yeni kod için ${Math.ceil((KOD_ARALIK - (now - sonGonderim)) / 1000)} saniye bekle`);
    if (r.gonderim.length >= KOD_GONDERIM) throw hata("rate_limited", "Bu işlem için çok fazla kod gönderildi. Baştan başla.");
    const a = (adresGonderim.get(r.eposta) || []).filter(t => now - t < SAAT);
    if (a.length >= 6 || say(ip, "posta", SAAT) >= 15) throw hata("rate_limited", "Çok fazla kod gönderildi. Bir saat sonra tekrar dene.");
    const kod = kodUret();
    const gonder = () => epostaGonder({ kime: r.eposta, ...kodPostasi(kod, amac, sunucuAdi) });
    if (amac === "sifre") { if (gercek) gonder().catch(e => log.error("E-posta gönderilemedi:", e.message)); } // yanıt süresi de bir şey ele vermesin
    else {
      try { await gonder(); }
      catch (e) { log.error("E-posta gönderilemedi:", e.message); throw hata("eposta_gonderilemedi", "Kod e-postası gönderilemedi. Adresi kontrol et ya da biraz sonra tekrar dene."); }
    }
    a.push(now); adresGonderim.set(r.eposta, a); ekle(ip, "posta");
    Object.assign(r, { kod: sha(kod), deneme: 0, son: now + KOD_OMRU }); r.gonderim.push(now);
  }
  function kodDogru(r, kod) {
    if (!r || !r.kod || Date.now() > r.son) throw hata("kod_yanlis", "Kodun süresi doldu. Yeni kod iste.");
    if (r.deneme >= KOD_DENEME) throw hata("kod_yanlis", "Çok fazla yanlış kod girildi. Yeni kod iste.");
    const k = String(kod || "").replace(/\D/g, "");
    if (k.length !== 6 || sha(k) !== r.kod) { r.deneme++; throw hata("kod_yanlis", r.deneme >= KOD_DENEME ? "Çok fazla yanlış kod girildi. Yeni kod iste." : "Kod yanlış"); }
  }
  function epostaBagla(uid, k, e) {
    const h = store.get("_sys/hesap/" + k);
    if (h.eposta && epostaDuz(h.eposta) !== e) store.delete(epostaYol(h.eposta));
    store.set("_sys/hesap/" + k, { ...h, eposta: e, epostaT: Date.now() });
    store.set(epostaYol(e), { uid, k });
  }

  /* ---------------- Kayıt ---------------- */
  // Kayıt iki adımlıdır (e-posta açıksa): 1) ad, e-posta, şifre (gerekirse "insan mısın?") -> koda gönderilir;
  // 2) kod girilince hesap açılır. E-posta kapalıysa hesap ilk adımda açılır.
  const bekleyen = new Map(); // anahtar -> { ad, k, salt, hash, eposta, bagla, kod, deneme, son, gonderim, ip, bitis }
  function hesapAc({ ad, salt, hash, bagla, eposta }, ip) {
    const k = anahtar(ad);
    if (hesapOf(ad)) throw hata("taken", "Bu kullanıcı adı alınmış");
    if (eposta && epostaSahibi(eposta)) throw hata("taken", "Bu e-posta adresiyle açılmış bir hesap var. Giriş yap ya da şifreni sıfırla.");
    // Bu cihazda daha önce hesapsız oynandıysa o kimlik hesaba bağlanır (masalar, karakterler kaybolmaz).
    let uid = bagla && kisi(bagla) && !kisi(bagla).username ? bagla : null;
    if (!uid) uid = "u-" + rid(8);
    store.set("_sys/hesap/" + k, { uid, ad, salt, hash, created: Date.now() });
    if (eposta) epostaBagla(uid, k, eposta);
    const prev = kisi(uid) || { created: Date.now(), color: "#2f8f86" };
    delete prev.secretHash; // hesapsız dönemin anahtarı artık geçmez, giriş yalnızca oturumla
    store.set("_sys/users/" + uid, { ...prev, username: ad, name: ad });
    ekle(ip, "acilan");
    return { userId: uid, secret: oturumAc(uid), kullanici: ad };
  }

  async function kayit(b, ip) {
    const yanlis = sinir(ip);
    const ad = String(b.kullanici || "").normalize("NFC").trim(), sifre = String(b.sifre || "");
    if (!ADI.test(ad)) throw hata("invalid_argument", "Kullanıcı adı 3-20 karakter olmalı; harf, rakam, _ . - kullanılabilir");
    const zayif = sifreKurali(sifre, ad); if (zayif) throw hata("invalid_argument", zayif);
    const eposta = epostaAcik ? epostaAl(b.eposta) : null;
    if (!yerel(ip) && say(ip, "acilan", 24 * SAAT) >= KAYIT_GUNLUK) throw hata("rate_limited", "Bu bağlantıdan bugün çok fazla hesap açıldı. Yarın tekrar dene.");
    insanKontrol(ip, b, "kayit");
    ekle(ip, "kayit"); tumKayit.push(Date.now());
    if (hesapOf(ad)) { yanlis(); throw hata("taken", "Bu kullanıcı adı alınmış"); }
    if (eposta && epostaSahibi(eposta)) throw hata("taken", "Bu e-posta adresiyle açılmış bir hesap var. Giriş yap ya da şifreni sıfırla.");
    const bagla = b.userId && gecerli(b.userId, b.secret) && !kisi(b.userId).username ? b.userId : null;
    const salt = rid(16), r = { ad, salt, hash: scrypt(sifre, salt), bagla, eposta, ip, bitis: Date.now() + KOD_OMRU * 2 };
    if (!epostaAcik) return hesapAc(r, ip);
    await kodGonder(r, "kayit", ip, true);
    const id = rid(16);
    bekleyen.set(id, r);
    return { dogrulama: true, bekleyen: id, eposta: maskele(eposta) };
  }
  function kayitDogrula(b, ip) {
    sinir(ip);
    const r = bekleyen.get(String(b.bekleyen || ""));
    if (!r || Date.now() > r.bitis) throw hata("not_found", "Kayıt süresi doldu. Baştan başla.");
    kodDogru(r, b.kod);
    bekleyen.delete(String(b.bekleyen));
    return hesapAc(r, ip);
  }
  async function kayitKod(b, ip) {
    const r = bekleyen.get(String(b.bekleyen || ""));
    if (!r || Date.now() > r.bitis) throw hata("not_found", "Kayıt süresi doldu. Baştan başla.");
    await kodGonder(r, "kayit", ip);
    return { eposta: maskele(r.eposta) };
  }

  /* ---------------- Var olan hesaba e-posta ekleme ---------------- */
  const ekleme = new Map(); // uid -> { eposta, kod, deneme, son, gonderim }
  function oturumdan(b) {
    const uid = String(b.userId || "");
    if (!gecerli(uid, b.secret) || !hesapOfUid(uid)) throw hata("login_required", "Önce giriş yap");
    return uid;
  }
  async function epostaEkle(b, ip) {
    if (!epostaAcik) throw hata("failed_precondition", "Bu sunucuda e-posta gönderimi kapalı");
    const uid = oturumdan(b), e = epostaAl(b.eposta);
    const sahip = epostaSahibi(e);
    if (sahip && sahip.uid !== uid) throw hata("taken", "Bu e-posta adresi başka bir hesapta kullanılıyor");
    let r = ekleme.get(uid);
    if (!r || r.eposta !== e || Date.now() > r.son) { r = { eposta: e, gonderim: (r && r.eposta === e) ? r.gonderim : [] }; ekleme.set(uid, r); }
    await kodGonder(r, "eposta", ip, !r.gonderim.length);
    return { eposta: maskele(e) };
  }
  function epostaDogrula(b, ip) {
    sinir(ip);
    const uid = oturumdan(b), r = ekleme.get(uid);
    if (!r) throw hata("not_found", "Önce e-posta adresini yaz");
    kodDogru(r, b.kod);
    const sahip = epostaSahibi(r.eposta);
    if (sahip && sahip.uid !== uid) throw hata("taken", "Bu e-posta adresi başka bir hesapta kullanılıyor");
    ekleme.delete(uid);
    epostaBagla(uid, anahtar(kisi(uid).username), r.eposta);
    return { eposta: maskele(r.eposta) };
  }

  /* ---------------- Şifremi unuttum ---------------- */
  // Adres kayıtlı olmasa da aynı yanıt verilir (kimin üye olduğu bu yoldan öğrenilemesin).
  const sifirlama = new Map(); // e-posta -> { uid, eposta, kod, deneme, son, gonderim }
  async function sifirla(b, ip) {
    if (!epostaAcik) throw hata("failed_precondition", "Bu sunucuda e-posta gönderimi kapalı");
    const e = epostaAl(b.eposta);
    insanKontrol(ip, b, "sifirla");
    ekle(ip, "sifirla");
    const sahip = epostaSahibi(e);
    let r = sifirlama.get(e);
    if (!r || Date.now() > r.son + KOD_OMRU) { r = { uid: sahip ? sahip.uid : null, eposta: e, gonderim: [] }; sifirlama.set(e, r); }
    await kodGonder(r, "sifre", ip, !r.gonderim.length, !!r.uid);
    return { eposta: maskele(e) };
  }
  function sifirlaTamam(b, ip) {
    const yanlis = sinir(ip);
    const e = epostaDuz(b.eposta), r = sifirlama.get(e);
    if (!r || !r.uid) { yanlis(); if (r) r.deneme = (r.deneme || 0) + 1; throw hata("kod_yanlis", "Kod yanlış"); }
    const u = kisi(r.uid), h = u && hesapOf(u.username);
    if (!h) throw hata("not_found", "Hesap bulunamadı");
    const zayif = sifreKurali(b.sifre, h.ad); if (zayif) throw hata("invalid_argument", zayif);
    try { kodDogru(r, b.kod); } catch (x) { yanlis(); throw x; }
    sifirlama.delete(e);
    const salt = rid(16);
    store.set("_sys/hesap/" + anahtar(h.ad), { ...h, salt, hash: scrypt(String(b.sifre), salt) });
    // Bütün eski oturumlar kapanır (şifreyi bilen biri girmişse dışarıda kalır).
    for (const d of store.list("_sys/oturum")) if (d.data && d.data.uid === r.uid) store.delete(d.path);
    for (const o of conns) if (o.uid === r.uid) o.ws.close(4001, "oturum kapandı");
    hesapDeneme.delete(anahtar(h.ad));
    return { userId: r.uid, secret: oturumAc(r.uid), kullanici: h.ad };
  }

  const bellekSupurge = setInterval(() => {
    const now = Date.now();
    for (const [k, r] of bekleyen) if (now > r.bitis) bekleyen.delete(k);
    for (const [k, r] of ekleme) if (now > (r.son || 0) + KOD_OMRU) ekleme.delete(k);
    for (const [k, r] of sifirlama) if (now > (r.son || 0) + KOD_OMRU) sifirlama.delete(k);
    for (const [k, a] of adresGonderim) if (!a.some(t => now - t < SAAT)) adresGonderim.delete(k);
    for (const [ip, o] of olaylar) if (!Object.values(o).some(a => a.some(t => now - t < 24 * SAAT))) olaylar.delete(ip);
  }, 600000); bellekSupurge.unref();

  function giris(b, ip) {
    const yanlis = sinir(ip);
    // Kullanıcı adı yerine doğrulanmış e-posta adresiyle de girilebilir.
    let ad = String(b.kullanici || "");
    if (ad.includes("@")) { const x = epostaSahibi(epostaDuz(ad).slice(0, 254)); const u = x && kisi(x.uid); ad = u && u.username ? u.username : ad; }
    const k = anahtar(ad).slice(0, 40);
    if (kilitli(k)) throw hata("rate_limited", "Bu hesaba çok fazla yanlış şifre girildi. 15 dakika sonra tekrar dene.");
    const h = hesapOf(ad);
    const dogru = sifreDogru(h || SAHTE, String(b.sifre || "").slice(0, 200));
    if (!h || !dogru) { yanlis(); if (h) hesapYanlis(k); throw hata("bad_login", "Kullanıcı adı ya da şifre yanlış"); }
    hesapDeneme.delete(k);
    return { userId: h.uid, secret: oturumAc(h.uid), kullanici: h.ad };
  }

  /* ---------------- HTTP: /api/hesap/... ---------------- */
  const YOLLAR = { kayit, giris, kayitDogrula, kayitKod, epostaEkle, epostaDogrula, sifirla, sifirlaTamam };
  const DURUM = { rate_limited: 429, taken: 409, invalid_argument: 400, insan_gerekli: 400, insan_yanlis: 400, not_found: 404, failed_precondition: 400, eposta_gonderilemedi: 502, internal: 500 };
  function http(req, res, p, send, ipOf) {
    if (req.method === "GET" && p === "/api/hesap/insan") {
      try { send(res, 200, insanResmi(ipOf(req))); } catch (e) { send(res, 429, { code: e.code, message: e.message }); }
      return true;
    }
    const m = /^\/api\/hesap\/([A-Za-z]+)$/.exec(p), fn = m && Object.hasOwn(YOLLAR, m[1]) && YOLLAR[m[1]];
    if (req.method !== "POST" || !fn) return false;
    const chunks = []; let size = 0;
    req.on("data", c => { size += c.length; if (size > 8192) req.destroy(); else chunks.push(c); });
    req.on("end", async () => {
      let b; try { b = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch (e) { return send(res, 400, { code: "invalid_argument", message: "Geçersiz istek" }); }
      if (!b || typeof b !== "object") return send(res, 400, { code: "invalid_argument", message: "Geçersiz istek" });
      try { send(res, 200, await fn(b, ipOf(req))); }
      catch (e) { if (!e.code) log.error(e); send(res, DURUM[e.code] || (e.code ? 401 : 500), { code: e.code || "internal", message: e.code ? e.message : "Sunucu hatası" }); }
    });
    return true;
  }

  /* ---------------- WebSocket işlemleri ---------------- */
  const OPS = new Set(["hesapBilgi", "cikis", "tumCikis", "oturumlar", "sifreDegistir", "kisiAra", "kisi", "profilYaz", "arkadasIstek", "arkadasKabul", "arkadasSil", "dmGonder", "dmOkundu", "dmSil",
    "grupKur", "grupBilgi", "grupMesaj", "grupEkle", "grupCikar", "grupCik", "grupAdi"]);
  const arkadasYol = (a, b) => `data/users/${a}/arkadas/${b}`;
  const durum = (a, b) => (store.get(arkadasYol(a, b)) || {}).durum || null;

  /* ---- Sohbet grupları ---- */
  const adOf = uid => { const u = kisi(uid); return (u && (u.username || u.name)) || "Biri"; };
  function grupAl(c, gid) {
    gid = String(gid || "");
    const g = GRUP_ID.test(gid) && store.get("_sys/grup/" + gid);
    if (!g || !g.uyeler[c.uid]) throw hata("not_found", "Böyle bir grup yok ya da üyesi değilsin");
    return [gid, g];
  }
  function trimCol(col) {
    const all = store.list(col); if (all.length <= DM_KEEP) return;
    all.sort((x, y) => (x.data.t || 0) - (y.data.t || 0)); for (const d of all.slice(0, all.length - DM_KEEP)) store.delete(d.path);
  }
  // İletiyi her üyenin kutusuna yaz, konuşma listelerini güncelle.
  function grupYaz(gid, g, msg) {
    const son = (msg.sistem ? "" : adOf(msg.by) + ": ") + (msg.text ? msg.text.slice(0, 120) : "📷 Fotoğraf");
    const uye = Object.keys(g.uyeler).length;
    for (const u of Object.keys(g.uyeler)) {
      const col = `data/users/${u}/grup/${gid}`;
      store.set(col + "/" + msg.id, msg); trimCol(col);
      const k = store.get(`data/users/${u}/konusma/${gid}`) || {};
      const ben = u === msg.by;
      store.set(`data/users/${u}/konusma/${gid}`, { grup: true, ad: g.ad, son, t: msg.t, benden: ben, okunmamis: ben || msg.sistem ? (k.okunmamis || 0) : (k.okunmamis || 0) + 1, uye });
    }
  }
  const yeniIleti = (by, text, ek) => { const t = Date.now(); return { id: "m" + t.toString(36) + rid(3), t, by, text, ...(ek || {}) }; };
  const sistem = (gid, g, text) => grupYaz(gid, g, yeniIleti(null, text, { sistem: true }));
  function grupBirak(gid, g, uid) { // üyeyi çıkar, kutusunu boşalt
    delete g.uyeler[uid];
    for (const d of store.list(`data/users/${uid}/grup/${gid}`)) store.delete(d.path);
    store.delete(`data/users/${uid}/konusma/${gid}`);
    if (!Object.keys(g.uyeler).length) { store.delete("_sys/grup/" + gid); return; }
    if (g.sahip === uid) g.sahip = Object.keys(g.uyeler).sort((a, b) => g.uyeler[a] - g.uyeler[b])[0];
    store.set("_sys/grup/" + gid, g);
  }
  const grupAdi = v => String(v || "").replace(/\s+/g, " ").trim().slice(0, 60);
  function sinirla(c) {
    const now = Date.now(); c.dmT = (c.dmT || []).filter(t => now - t < 5000);
    if (c.dmT.length >= 8) throw hata("rate_limited", "Biraz yavaş: çok hızlı yazıyorsun");
    c.dmT.push(now);
  }

  function op(c, m) {
    const me = kisi(c.uid);
    if (!me || !me.username) throw hata("hesap_gerekli", "Bunun için bir hesapla giriş yapmalısın");
    switch (m.op) {
      case "hesapBilgi": { // kendi hesabının gizli bilgileri (yalnızca sahibine): e-posta adresi
        const h = hesapOf(me.username) || {};
        return { kullanici: me.username, eposta: h.eposta ? maskele(h.eposta) : null, epostaAcik };
      }
      case "cikis": if (c.secret) store.delete("_sys/oturum/" + sha(c.secret)); c.secret = null; return true;
      case "tumCikis": { // öteki bütün cihazlardaki oturumları kapat; bu cihaz açık kalır
        const bu = c.secret ? sha(c.secret) : null; let n = 0;
        for (const d of store.list("_sys/oturum")) if (d.data && d.data.uid === c.uid && d.id !== bu) { store.delete(d.path); n++; }
        for (const o of conns) if (o !== c && o.uid === c.uid && !gecerli(o.uid, o.secret)) o.ws.close(4001, "oturum kapandı");
        return { kapanan: n };
      }
      case "oturumlar": { // kaç cihazda açık oturum var
        let n = 0; for (const d of store.list("_sys/oturum")) if (d.data && d.data.uid === c.uid) n++;
        return { sayi: n };
      }
      case "sifreDegistir": {
        const k = anahtar(me.username);
        if (kilitli(k)) throw hata("rate_limited", "Çok fazla yanlış şifre girildi. 15 dakika sonra tekrar dene.");
        const h = hesapOf(me.username);
        if (!h || !sifreDogru(h, String(m.eski || "").slice(0, 200))) { hesapYanlis(k); throw hata("bad_login", "Şu anki şifre yanlış"); }
        const yeni = String(m.yeni || "");
        const zayif = sifreKurali(yeni, me.username); if (zayif) throw hata("invalid_argument", "Yeni şifre: " + zayif.charAt(0).toLowerCase() + zayif.slice(1));
        const salt = rid(16);
        store.set("_sys/hesap/" + anahtar(me.username), { ...h, salt, hash: scrypt(yeni, salt) });
        // Öteki cihazlardaki oturumlar kapanır; bu cihaz açık kalır.
        const bu = c.secret ? sha(c.secret) : null;
        for (const d of store.list("_sys/oturum")) if (d.data && d.data.uid === c.uid && d.id !== bu) store.delete(d.path);
        for (const o of conns) if (o !== c && o.uid === c.uid && !gecerli(o.uid, o.secret)) o.ws.close(4001, "oturum kapandı");
        return true;
      }
      case "kisiAra": {
        const q = anahtar(m.q).slice(0, 20); if (!q) return [];
        const out = [];
        for (const d of store.list("_sys/hesap")) {
          if (!d.id.includes(q) || d.data.uid === c.uid) continue;
          const u = kisi(d.data.uid); if (u) out.push({ ...herkeseAcik(d.data.uid, u), bas: d.id.startsWith(q) });
        }
        out.sort((a, b) => (b.bas - a.bas) || a.kullanici.localeCompare(b.kullanici, "tr"));
        return out.slice(0, 20).map(({ bas, ...x }) => ({ ...x, arkadas: durum(c.uid, x.id) }));
      }
      case "kisi": {
        let uid = m.kisi;
        if (!uid && m.kullanici) { const h = hesapOf(m.kullanici); uid = h && h.uid; }
        const u = kisi(uid); if (!u) throw hata("not_found", "Böyle biri yok");
        return { ...herkeseAcik(uid, u), hakkinda: u.hakkinda || "", katildi: u.created || null, arkadas: uid === c.uid ? "ben" : durum(c.uid, uid) };
      }
      case "profilYaz": {
        const yeni = { ...me };
        if (m.hakkinda !== undefined) yeni.hakkinda = String(m.hakkinda || "").replace(/\r\n?/g, "\n").trim().slice(0, 500);
        if (m.renk !== undefined && /^#[0-9a-fA-F]{6}$/.test(m.renk)) yeni.color = m.renk;
        if (m.foto !== undefined) {
          if (!m.foto) yeni.foto = null;
          else {
            const id = String(m.foto).replace(/^\/assets\//, ""), a = /^[a-z0-9]+\.(png|jpg|webp|gif)$/.test(id) && store.get("_sys/assets/" + id);
            if (!a || a.owner !== c.uid || !/^image\//.test(a.type)) throw hata("invalid_argument", "Önce fotoğrafı yükle");
            yeni.foto = "/assets/" + id;
          }
        }
        store.set("_sys/users/" + c.uid, yeni);
        return herkeseAcik(c.uid, yeni);
      }
      case "arkadasIstek": {
        let uid = m.kisi;
        if (!uid && m.kullanici) { const h = hesapOf(m.kullanici); uid = h && h.uid; }
        const u = kisi(uid);
        if (!u || !u.username) throw hata("not_found", "Böyle bir kullanıcı yok");
        if (uid === c.uid) throw hata("invalid_argument", "Kendini arkadaş ekleyemezsin");
        const d = durum(c.uid, uid), t = Date.now();
        if (d === "arkadas") return "arkadas";
        if (d === "gelen") { store.set(arkadasYol(c.uid, uid), { durum: "arkadas", t }); store.set(arkadasYol(uid, c.uid), { durum: "arkadas", t }); arkadasBildir("kabul", c.uid, uid); return "arkadas"; }
        store.set(arkadasYol(c.uid, uid), { durum: "giden", t }); store.set(arkadasYol(uid, c.uid), { durum: "gelen", t });
        if (d !== "giden") arkadasBildir("istek", c.uid, uid);
        return "giden";
      }
      case "arkadasKabul": {
        const uid = String(m.kisi || "");
        if (durum(c.uid, uid) !== "gelen") throw hata("not_found", "Böyle bir istek yok");
        const t = Date.now();
        store.set(arkadasYol(c.uid, uid), { durum: "arkadas", t }); store.set(arkadasYol(uid, c.uid), { durum: "arkadas", t });
        arkadasBildir("kabul", c.uid, uid);
        return "arkadas";
      }
      case "arkadasSil": { // isteği reddet, geri çek ya da arkadaşlıktan çıkar
        const uid = String(m.kisi || "");
        if (!/^u-[0-9a-f]{8,}$/.test(uid)) throw hata("invalid_argument", "Geçersiz kişi");
        store.delete(arkadasYol(c.uid, uid)); store.delete(arkadasYol(uid, c.uid));
        return true;
      }
      case "dmGonder": {
        const to = String(m.to || "");
        if (durum(c.uid, to) !== "arkadas") throw hata("permission_denied", "Yalnızca arkadaşlarına mesaj gönderebilirsin");
        const now = Date.now(); c.dmT = (c.dmT || []).filter(t => now - t < 5000);
        if (c.dmT.length >= 8) throw hata("rate_limited", "Biraz yavaş: çok hızlı yazıyorsun");
        const text = String(m.text || "").replace(/\r\n?/g, "\n").trim().slice(0, 2000);
        const resim = m.resim && RESIM.test(String(m.resim)) ? String(m.resim) : null;
        if (!text && !resim) throw hata("invalid_argument", "Boş mesaj");
        c.dmT.push(now);
        const id = "m" + now.toString(36) + rid(3), msg = { id, t: now, by: c.uid, text, ...(resim ? { resim } : {}) };
        const son = text ? text.slice(0, 120) : "📷 Fotoğraf";
        for (const [a, b] of [[c.uid, to], [to, c.uid]]) {
          const col = `data/users/${a}/dm/${b}`;
          store.set(col + "/" + id, msg);
          const all = store.list(col);
          if (all.length > DM_KEEP) { all.sort((x, y) => (x.data.t || 0) - (y.data.t || 0)); for (const d of all.slice(0, all.length - DM_KEEP)) store.delete(d.path); }
          const k = store.get(`data/users/${a}/konusma/${b}`) || {};
          store.set(`data/users/${a}/konusma/${b}`, { son, t: now, benden: a === c.uid, okunmamis: a === c.uid ? 0 : (k.okunmamis || 0) + 1 });
        }
        return { id, t: now };
      }
      case "dmOkundu": {
        const p = `data/users/${c.uid}/konusma/${String(m.kisi || "")}`, k = (KISI_ID.test(String(m.kisi || "")) || GRUP_ID.test(String(m.kisi || ""))) && store.get(p);
        if (k && k.okunmamis) store.set(p, { ...k, okunmamis: 0 });
        return true;
      }
      case "dmSil": { // konuşmayı yalnızca kendi tarafından sil
        const uid = String(m.kisi || "");
        if (!/^u-[0-9a-f]{8,}$/.test(uid)) throw hata("invalid_argument", "Geçersiz kişi");
        for (const d of store.list(`data/users/${c.uid}/dm/${uid}`)) store.delete(d.path);
        store.delete(`data/users/${c.uid}/konusma/${uid}`);
        return true;
      }
      case "grupKur": {
        const ad = grupAdi(m.ad); if (!ad) throw hata("invalid_argument", "Gruba bir ad ver");
        const uyeler = [...new Set((Array.isArray(m.uyeler) ? m.uyeler : []).map(String))].filter(u => u !== c.uid && durum(c.uid, u) === "arkadas").slice(0, GRUP_UYE - 1);
        if (!uyeler.length) throw hata("invalid_argument", "Gruba en az bir arkadaşını ekle");
        const gid = "gr-" + rid(6), t = Date.now();
        const g = { ad, sahip: c.uid, uyeler: { [c.uid]: t, ...Object.fromEntries(uyeler.map(u => [u, t])) }, created: t };
        store.set("_sys/grup/" + gid, g);
        sistem(gid, g, `${adOf(c.uid)} "${ad}" grubunu kurdu`);
        return { id: gid };
      }
      case "grupBilgi": {
        const [gid, g] = grupAl(c, m.grup);
        const uyeler = Object.keys(g.uyeler).sort((a, b) => g.uyeler[a] - g.uyeler[b]).map(u => { const k = kisi(u); return k ? { ...herkeseAcik(u, k), arkadas: u === c.uid ? "ben" : durum(c.uid, u) } : null; }).filter(Boolean);
        return { id: gid, ad: g.ad, sahip: g.sahip, created: g.created, uyeler };
      }
      case "grupMesaj": {
        const [gid, g] = grupAl(c, m.grup);
        const text = String(m.text || "").replace(/\r\n?/g, "\n").trim().slice(0, 2000);
        const resim = m.resim && RESIM.test(String(m.resim)) ? String(m.resim) : null;
        if (!text && !resim) throw hata("invalid_argument", "Boş mesaj");
        sinirla(c);
        const msg = yeniIleti(c.uid, text, resim ? { resim } : null);
        grupYaz(gid, g, msg);
        return { id: msg.id, t: msg.t };
      }
      case "grupEkle": {
        const [gid, g] = grupAl(c, m.grup), u = String(m.kisi || "");
        if (g.uyeler[u]) return true;
        if (durum(c.uid, u) !== "arkadas") throw hata("permission_denied", "Gruba yalnızca arkadaşlarını ekleyebilirsin");
        if (Object.keys(g.uyeler).length >= GRUP_UYE) throw hata("invalid_argument", `Bir grupta en çok ${GRUP_UYE} kişi olabilir`);
        g.uyeler[u] = Date.now(); store.set("_sys/grup/" + gid, g);
        sistem(gid, g, `${adOf(c.uid)}, ${adOf(u)} kişisini gruba ekledi`);
        return true;
      }
      case "grupCikar": {
        const [gid, g] = grupAl(c, m.grup), u = String(m.kisi || "");
        if (g.sahip !== c.uid) throw hata("permission_denied", "Yalnızca grubu kuran kişi üye çıkarabilir");
        if (!g.uyeler[u] || u === c.uid) throw hata("invalid_argument", "Bu kişi grupta değil");
        grupBirak(gid, g, u);
        sistem(gid, g, `${adOf(u)} gruptan çıkarıldı`);
        return true;
      }
      case "grupCik": {
        const [gid, g] = grupAl(c, m.grup);
        grupBirak(gid, g, c.uid);
        if (Object.keys(g.uyeler).length) sistem(gid, g, `${adOf(c.uid)} gruptan ayrıldı`);
        return true;
      }
      case "grupAdi": {
        const [gid, g] = grupAl(c, m.grup), ad = grupAdi(m.ad);
        if (!ad) throw hata("invalid_argument", "Gruba bir ad ver");
        g.ad = ad; store.set("_sys/grup/" + gid, g);
        sistem(gid, g, `${adOf(c.uid)} grubun adını "${ad}" yaptı`);
        return true;
      }
    }
  }

  const kapat = () => { clearInterval(temizlik); clearInterval(supurge); clearInterval(bellekSupurge); };
  return { OPS, op, http, gecerli, kisi, herkeseAcik, kapat, epostaAcik, epostaGerekli };
}

module.exports = { kurHesap, anahtar, ADI, sifreKurali };
