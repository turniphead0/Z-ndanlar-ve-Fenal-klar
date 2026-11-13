// Hesaplar ve oyun dışı sosyal özellikler: kullanıcı adı + şifre ile üyelik, profil (fotoğraf, hakkında),
// arkadaşlık istekleri ve arkadaşlar arası özel mesajlar.
//
// Veri yapısı (hepsini yalnızca sunucu yazar):
//   _sys/hesap/<küçük harfli ad>        { uid, ad, salt, hash, created }   şifre özeti (scrypt), kimseye gösterilmez
//   _sys/oturum/<sha(gizli)>            { uid, t }                          girişte verilen oturum anahtarları
//   _sys/users/<kişi>                   { ..., username, foto, hakkinda }   herkese açık profil alanları
//   data/users/<kişi>/arkadas/<öteki>   { durum: "gelen" | "giden" | "arkadas", t }
//   data/users/<kişi>/konusma/<öteki>   { son, t, benden, okunmamis }      konuşma listesi
//   data/users/<kişi>/dm/<öteki>/<ileti> { id, t, by, text, resim? }        iletiler (iki tarafa da yazılır)
//   _sys/grup/<grup>                    { ad, sahip, uyeler: {kişi: zaman}, created }   sohbet grubu
//   data/users/<kişi>/grup/<grup>/<ileti> { id, t, by, text, resim?, sistem? }  grup iletileri (her üyeye yazılır)
//   data/users/<kişi>/konusma/<grup>    { grup: true, ad, son, t, benden, okunmamis, uye }  konuşma listesinde grup
const crypto = require("crypto");

const rid = (n = 12) => crypto.randomBytes(n).toString("hex");
const sha = s => crypto.createHash("sha256").update(String(s)).digest("hex");
const ADI = /^[\p{L}\p{N}_.-]{3,20}$/u;
// Büyük/küçük harf ve ı/i farkı gözetilmez: "ALİ", "Ali", "alı" aynı addır (birbirini taklit edemez).
const anahtar = ad => String(ad || "").normalize("NFC").trim().replace(/[İI]/g, "i").toLowerCase().replace(/ı/g, "i").replace(/\u0307/g, "");
const DM_KEEP = 500;
const GRUP_ID = /^gr-[0-9a-f]{12}$/, KISI_ID = /^u-[0-9a-f]{8,}$/;
const GRUP_UYE = 50;
const RESIM = /^\/assets\/[a-z0-9]+\.(gif|webp|png|jpg)$/;

function scrypt(sifre, salt) { return crypto.scryptSync(String(sifre), salt, 32).toString("hex"); }
function sifreDogru(h, sifre) {
  const a = Buffer.from(scrypt(sifre, h.salt), "hex"), b = Buffer.from(h.hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const hata = (code, message) => Object.assign(new Error(message), { code });

function kurHesap({ store, conns, password, same }) {
  const hesapOf = ad => store.get("_sys/hesap/" + anahtar(ad));
  const kisi = uid => (/^u-[0-9a-f]{8,}$/.test(String(uid || "")) && store.get("_sys/users/" + uid)) || null;
  const herkeseAcik = (uid, u) => ({ id: uid, kullanici: u.username || null, ad: u.name || u.username || "Oyuncu", renk: u.color || "#2f8f86", foto: u.foto || null });

  // Kimlik doğrulama: eski (hesapsız) gizli anahtar ya da girişte verilmiş oturum anahtarı.
  function gecerli(uid, secret) {
    const u = kisi(uid); if (!u || !secret) return false;
    if (u.secretHash && sha(secret) === u.secretHash) return true;
    const o = store.get("_sys/oturum/" + sha(secret));
    return !!(o && o.uid === uid);
  }
  function oturumAc(uid) {
    const secret = rid(16);
    store.set("_sys/oturum/" + sha(secret), { uid, t: Date.now() });
    return secret;
  }

  // Art arda yanlış şifre denemelerini yavaşlat: bir adresten 10 dakikada en çok 10 hatalı deneme.
  const denemeler = new Map();
  function sinir(ip) {
    const now = Date.now(), a = (denemeler.get(ip) || []).filter(t => now - t < 600000);
    denemeler.set(ip, a);
    if (a.length >= 10) throw hata("rate_limited", "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene.");
    return () => { a.push(now); denemeler.set(ip, a); };
  }

  function kayit(b, ip) {
    const yanlis = sinir(ip);
    const ad = String(b.kullanici || "").normalize("NFC").trim(), sifre = String(b.sifre || "");
    if (!ADI.test(ad)) throw hata("invalid_argument", "Kullanıcı adı 3-20 karakter olmalı; harf, rakam, _ . - kullanılabilir");
    if (sifre.length < 6 || sifre.length > 200) throw hata("invalid_argument", "Şifre en az 6 karakter olmalı");
    if (password && !(b.masaSifresi && same(b.masaSifresi, password))) { yanlis(); throw hata("bad_password", "Sunucu şifresi yanlış"); }
    if (hesapOf(ad)) throw hata("taken", "Bu kullanıcı adı alınmış");
    // Bu cihazda daha önce hesapsız oynandıysa o kimlik hesaba bağlanır (masalar, karakterler kaybolmaz).
    let uid = null;
    if (b.userId && gecerli(b.userId, b.secret) && !kisi(b.userId).username) uid = b.userId;
    if (!uid) uid = "u-" + rid(8);
    const salt = rid(16);
    store.set("_sys/hesap/" + anahtar(ad), { uid, ad, salt, hash: scrypt(sifre, salt), created: Date.now() });
    const prev = kisi(uid) || { created: Date.now(), color: "#2f8f86" };
    store.set("_sys/users/" + uid, { ...prev, username: ad, name: ad });
    return { userId: uid, secret: oturumAc(uid), kullanici: ad };
  }

  function giris(b, ip) {
    const yanlis = sinir(ip);
    const h = hesapOf(b.kullanici);
    if (!h || !sifreDogru(h, b.sifre || "")) { yanlis(); throw hata("bad_login", "Kullanıcı adı ya da şifre yanlış"); }
    return { userId: h.uid, secret: oturumAc(h.uid), kullanici: h.ad };
  }

  /* ---------------- HTTP: /api/hesap/kayit ve /api/hesap/giris ---------------- */
  function http(req, res, p, send) {
    if (req.method !== "POST" || (p !== "/api/hesap/kayit" && p !== "/api/hesap/giris")) return false;
    const chunks = []; let size = 0;
    req.on("data", c => { size += c.length; if (size > 8192) req.destroy(); else chunks.push(c); });
    req.on("end", () => {
      let b; try { b = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch (e) { return send(res, 400, { code: "invalid_argument", message: "Geçersiz istek" }); }
      const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
      try { send(res, 200, p.endsWith("kayit") ? kayit(b, ip) : giris(b, ip)); }
      catch (e) { send(res, e.code === "rate_limited" ? 429 : e.code === "taken" ? 409 : e.code === "invalid_argument" ? 400 : e.code ? 401 : 500, { code: e.code || "internal", message: e.message }); }
    });
    return true;
  }

  /* ---------------- WebSocket işlemleri ---------------- */
  const OPS = new Set(["cikis", "sifreDegistir", "kisiAra", "kisi", "profilYaz", "arkadasIstek", "arkadasKabul", "arkadasSil", "dmGonder", "dmOkundu", "dmSil",
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
      case "cikis": if (c.secret) store.delete("_sys/oturum/" + sha(c.secret)); return true;
      case "sifreDegistir": {
        const h = hesapOf(me.username);
        if (!h || !sifreDogru(h, m.eski || "")) throw hata("bad_login", "Şu anki şifre yanlış");
        const yeni = String(m.yeni || "");
        if (yeni.length < 6 || yeni.length > 200) throw hata("invalid_argument", "Yeni şifre en az 6 karakter olmalı");
        const salt = rid(16);
        store.set("_sys/hesap/" + anahtar(me.username), { ...h, salt, hash: scrypt(yeni, salt) });
        // Öteki cihazlardaki oturumlar kapanır; bu cihaz açık kalır.
        const bu = c.secret ? sha(c.secret) : null;
        for (const d of store.list("_sys/oturum")) if (d.data && d.data.uid === c.uid && d.id !== bu) store.delete(d.path);
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
        if (d === "gelen") { store.set(arkadasYol(c.uid, uid), { durum: "arkadas", t }); store.set(arkadasYol(uid, c.uid), { durum: "arkadas", t }); return "arkadas"; }
        store.set(arkadasYol(c.uid, uid), { durum: "giden", t }); store.set(arkadasYol(uid, c.uid), { durum: "gelen", t });
        return "giden";
      }
      case "arkadasKabul": {
        const uid = String(m.kisi || "");
        if (durum(c.uid, uid) !== "gelen") throw hata("not_found", "Böyle bir istek yok");
        const t = Date.now();
        store.set(arkadasYol(c.uid, uid), { durum: "arkadas", t }); store.set(arkadasYol(uid, c.uid), { durum: "arkadas", t });
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

  return { OPS, op, http, gecerli, kisi, herkeseAcik };
}

module.exports = { kurHesap, anahtar, ADI };
