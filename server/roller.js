// Roller: admin ve test hesapları.
//
//   admin   hesap açabilir (admin ya da test hesabı), rol verip alabilir, botları yönetir ve oynatır.
//   tester  botları yönetir ve oynatır (botun yerine hamle yapar, elini görür, otomatik oynamayı açıp kapatır).
//
// Kimse kendi kendine admin olamaz. İlk admin şu yollardan biriyle olur:
//   - sunucuda ZM_ADMIN ortam değişkeni (virgülle ayrılmış kullanıcı adları; örn. ZM_ADMIN=cal), ya da
//   - sahip bağlantısıyla (?owner=…) giren kişi (masaüstünden host eden kişi kendiliğinden sahiptir).
// Sonra adminler yönetim panelinden başka hesaplara rol verir ya da yeni test hesapları açar.
//
// Veri: _sys/rol/<kişi> { rol, veren, t }   (yalnızca sunucu okur ve yazar)
"use strict";
const crypto = require("crypto");
const { anahtar, ADI, sifreKurali } = require("./hesap");

const ROLLER = ["admin", "tester"];
const hata = (code, message) => Object.assign(new Error(message), { code });
const rid = (n = 8) => crypto.randomBytes(n).toString("hex");
const scrypt = (s, salt) => crypto.scryptSync(String(s), salt, 32).toString("hex");

function kurRoller({ store, conns, adminler }) {
  const envAdmin = new Set(String(adminler || "").split(",").map(s => anahtar(s.trim())).filter(Boolean));
  const OPS = new Set(["rolListe", "rolVer", "hesapAc"]);

  function rolu(uid) {
    const u = uid && store.get("_sys/users/" + uid);
    if (!u) return null;
    if (u.username && envAdmin.has(anahtar(u.username))) return "admin";
    const r = store.get("_sys/rol/" + uid);
    return r && ROLLER.includes(r.rol) ? r.rol : null;
  }
  // Bağlantının rolü: sunucu sahibi her zaman admin sayılır.
  const rolOf = c => (c.isOwner ? "admin" : rolu(c.uid));
  const admin = c => rolOf(c) === "admin";
  const botYoneticisi = c => !!rolOf(c); // admin ya da tester
  const envAdminMi = uid => { const u = store.get("_sys/users/" + uid); return !!(u && u.username && envAdmin.has(anahtar(u.username))); };

  // Rol değişince o kişinin açık bağlantılarına bildir (arayüz düğmeleri hemen görünsün).
  function bildir(uid) {
    const rol = rolu(uid);
    for (const o of conns) if (o.uid === uid) o.send({ ev: "rol", rol: o.isOwner ? "admin" : rol });
  }

  function op(c, m) {
    if (!admin(c)) throw hata("permission_denied", "Bunu yalnızca adminler yapabilir");
    switch (m.op) {
      case "rolListe": { // hesapların listesi ve rolleri
        const out = [];
        for (const d of store.list("_sys/hesap")) {
          const h = d.data; if (!h || !h.uid) continue;
          const u = store.get("_sys/users/" + h.uid) || {};
          out.push({ id: h.uid, kullanici: h.ad, foto: u.foto || null, rol: rolu(h.uid), sabit: envAdminMi(h.uid), created: h.created || null, seen: u.seen || null });
        }
        out.sort((a, b) => (ROLLER.indexOf(a.rol) + 1 || 9) - (ROLLER.indexOf(b.rol) + 1 || 9) || String(a.kullanici).localeCompare(String(b.kullanici), "tr"));
        return out.slice(0, 2000);
      }
      case "rolVer": { // { kisi, rol: "admin" | "tester" | null }
        const uid = String(m.kisi || ""), u = /^u-[0-9a-f]{8,}$/.test(uid) && store.get("_sys/users/" + uid);
        if (!u || !u.username) throw hata("not_found", "Böyle bir hesap yok");
        const rol = m.rol ? String(m.rol) : null;
        if (rol && !ROLLER.includes(rol)) throw hata("invalid_argument", "Rol admin ya da tester olabilir");
        if (envAdminMi(uid)) throw hata("failed_precondition", "Bu hesap sunucu ayarıyla (ZM_ADMIN) admin; rolü buradan değişmez");
        if (uid === c.uid && rol !== "admin") throw hata("failed_precondition", "Kendi admin rolünü kaldıramazsın; başka bir admin kaldırmalı");
        if (rol) store.set("_sys/rol/" + uid, { rol, veren: c.uid, t: Date.now() }); else store.delete("_sys/rol/" + uid);
        bildir(uid);
        return { rol: rolu(uid) };
      }
      case "hesapAc": { // admin yeni hesap açar: { kullanici, sifre, rol: "tester" | "admin" | null }
        const ad = String(m.kullanici || "").normalize("NFC").trim(), sifre = String(m.sifre || "");
        if (!ADI.test(ad)) throw hata("invalid_argument", "Kullanıcı adı 3-20 karakter olmalı; harf, rakam, _ . - kullanılabilir");
        const zayif = sifreKurali(sifre, ad); if (zayif) throw hata("invalid_argument", zayif);
        const rol = m.rol ? String(m.rol) : null;
        if (rol && !ROLLER.includes(rol)) throw hata("invalid_argument", "Rol admin ya da tester olabilir");
        if (store.get("_sys/hesap/" + anahtar(ad))) throw hata("taken", "Bu kullanıcı adı alınmış");
        const uid = "u-" + rid(8), salt = rid(16), t = Date.now();
        store.set("_sys/hesap/" + anahtar(ad), { uid, ad, salt, hash: scrypt(sifre, salt), created: t, acan: c.uid });
        store.set("_sys/users/" + uid, { created: t, color: "#2f8f86", username: ad, name: ad });
        if (rol) store.set("_sys/rol/" + uid, { rol, veren: c.uid, t });
        return { id: uid, kullanici: ad, rol };
      }
    }
    throw hata("unknown_op", "Bilinmeyen işlem");
  }

  return { OPS, op, rolu, rolOf, admin, botYoneticisi };
}

module.exports = { kurRoller, ROLLER };
