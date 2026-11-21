// Profil sayfası (/profil): bir kişinin forumda açtığı konular ve yazdığı yanıtlar.
//
// Forum belgeleri (forum/<konu>, forum/<konu>/yanitlar/<yanıt>) zaten herkese açık olduğundan burada
// yeni bir şey açığa çıkmaz; bu işlem yalnızca bir kişinin yazdıklarını tek seferde toplar.
// Profilin geri kalanı mevcut işlemlerden gelir: kisi (hesap), profilOyunlar (dosyalar), profiles (çevrimiçi).
"use strict";

const hata = (code, message) => Object.assign(new Error(message), { code });
const KISI_ID = /^u-[0-9a-f]{8,}$/;
const EN_COK = 200; // listelerin en çok kaç öğe döneceği (en yeniler)

function kurProfil({ store, kurallar = null }) {
  const OPS = new Set(["profilForum"]);
  const ozet = s => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > 160 ? s.slice(0, 157) + "…" : s; };

  function forumu(uid) {
    const konular = [], yanitlar = [];
    for (const p of store.paths("forum")) {
      const t = store.get(p); if (!t) continue;
      const id = p.slice(6);
      if (t.yazar && t.yazar.id === uid) {
        konular.push({ id, baslik: t.baslik, kategori: t.kategori || "Genel sohbet", sistem: t.sistem || null, ozet: ozet(t.govde),
          created: t.created || 0, updated: t.updated || t.created || 0, yanit: t.yanit || 0, sabit: !!t.sabit });
      }
      if (!t.yanit) continue;
      for (const yp of store.paths(p + "/yanitlar")) {
        const y = store.get(yp);
        if (y && y.yazar && y.yazar.id === uid) yanitlar.push({ id: yp.split("/").pop(), konu: id, baslik: t.baslik, kategori: t.kategori || "Genel sohbet", ozet: ozet(y.govde), created: y.created || 0 });
      }
    }
    konular.sort((a, b) => b.created - a.created); yanitlar.sort((a, b) => b.created - a.created);
    return { konular: konular.slice(0, EN_COK), yanitlar: yanitlar.slice(0, EN_COK), sayi: { konu: konular.length, yanit: yanitlar.length } };
  }

  function op(c, m) {
    switch (m.op) {
      case "profilForum": {
        const uid = m.kisi ? String(m.kisi) : c.uid;
        if (!KISI_ID.test(uid) && uid !== c.uid) throw hata("invalid_argument", "Geçersiz kişi");
        if (!store.get("_sys/users/" + uid)) throw hata("not_found", "Böyle biri yok");
        if (kurallar && !kurallar.gorebilir(c, uid)) throw hata("permission_denied", "Bu profil gizli");
        return forumu(uid);
      }
    }
    throw hata("unknown_op", "Bilinmeyen işlem");
  }
  return { OPS, op, forumu };
}

module.exports = { kurProfil };
