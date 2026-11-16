// Kart ve taş masaları (web/oyunlar/kartmasa.js motoru) ve oyun atölyesi.
//
// Veri yolları:
//   _sys/kartmasa/<masa>                  tam durum (deste sıraları, ellerdeki ve kapalı kartlar): yalnızca sunucu okur
//   boards/<masa>                         { oyun: "kart", tanim, durum: açık görünüm, ... }   herkes okur
//   data/users/<kişi>/kartmasa/<masa>     o oyuncunun eli ve baktığı kapalı kartlar               yalnızca o kişi okur
//   kartoyun/<oyun>                       atölyede yapılan oyun tanımları { tanim, sahip, sahipAd, ... }  herkes okur
// Hepsini yalnızca sunucu yazar (index.js canWrite).
"use strict";
const crypto = require("crypto");
const KM = require("../web/oyunlar/kartmasa");
const { HAZIR } = require("../web/oyunlar/hazir");

const rid = (n = 6) => crypto.randomBytes(n).toString("hex");
const hata = (code, message) => Object.assign(new Error(message), { code });
const MASA_ID = /^b[a-z0-9]{6,24}$/, OYUN_ID = /^ko-[0-9a-f]{12}$/;

function kurKartMasa({ store, botKisi }) {
  const OPS = new Set(["kmNew", "kmSit", "kmStart", "kmIslem", "kmReset", "kmDelete", "kmTanimYaz", "kmTanimSil", "kmDuzen"]);
  const ben = c => { const u = store.get("_sys/users/" + c.uid) || {}; return { id: c.uid, name: u.username || u.name || "Oyuncu" }; };

  function yayinla(bid, d, ek) {
    const eski = store.get("boards/" + bid) || {};
    store.set("boards/" + bid, { ...eski, ...(ek || {}), oyun: "kart", durum: KM.acikGorunum(d), updated: Date.now() });
    for (const k of d.koltuk) if (k && !k.bot) store.set(`data/users/${k.id}/kartmasa/${bid}`, KM.gizliGorunum(d, k.id));
  }
  const kaydet = (bid, d) => { store.set("_sys/kartmasa/" + bid, d); yayinla(bid, d); };
  function al(m) {
    const bid = String(m.board || ""), d = MASA_ID.test(bid) && store.get("_sys/kartmasa/" + bid);
    if (!d) throw hata("not_found", "Böyle bir masa yok");
    return [bid, d];
  }
  const gizliSil = (bid, uid) => store.delete(`data/users/${uid}/kartmasa/${bid}`);

  function op(c, m) {
    switch (m.op) {
      case "kmNew": {
        let t, kaynak;
        if (m.hazir) { t = HAZIR[String(m.hazir)]; kaynak = { hazir: String(m.hazir) }; }
        else if (m.oyun) { const o = OYUN_ID.test(String(m.oyun)) && store.get("kartoyun/" + m.oyun); t = o && o.tanim; kaynak = { kartoyun: String(m.oyun) }; }
        if (!t) throw hata("not_found", "Böyle bir oyun yok");
        const tanim = KM.tanimDuzelt(t), d = KM.yeni(tanim), bid = "b" + Date.now().toString(36) + rid(3);
        const k = ben(c); d.koltuk[0] = { ...k, renk: KM.RENKLER[0] };
        store.set("_sys/kartmasa/" + bid, d);
        yayinla(bid, d, { tanim, ...kaynak, olusturan: c.uid, created: Date.now() });
        return { id: bid };
      }
      case "kmSit": {
        const [bid, d] = al(m), k = ben(c), i = Number(m.koltuk);
        if (d.basladi) throw hata("failed_precondition", "Oyun başladı; yeniden başlatınca koltuk değiştirebilirsin");
        if (m.kalk) { const j = d.koltuk.findIndex(x => x && x.id === c.uid); if (j >= 0) d.koltuk[j] = null; gizliSil(bid, c.uid); }
        else {
          if (!(i >= 0 && i < d.koltuk.length)) throw hata("invalid_argument", "Böyle bir koltuk yok");
          if (d.koltuk[i] && d.koltuk[i].id !== c.uid) throw hata("taken", "Bu koltuk dolu");
          const j = d.koltuk.findIndex(x => x && x.id === c.uid); if (j >= 0) d.koltuk[j] = null;
          d.koltuk[i] = { ...k, renk: KM.RENKLER[i % KM.RENKLER.length] };
        }
        store.set("_sys/kartmasa/" + bid, d); yayinla(bid, d);
        return true;
      }
      case "kmStart": case "kmReset": {
        const [bid, d] = al(m), b = store.get("boards/" + bid) || {};
        if (!d.koltuk.some(x => x && x.id === c.uid) && b.olusturan !== c.uid && !c.isOwner) throw hata("permission_denied", "Yalnızca oyuncular ya da masayı açan yapabilir");
        d.botTur = 0;
        if (m.op === "kmStart") KM.baslat(d, Math.random);
        else { for (const k of d.koltuk) if (k) gizliSil(bid, k.id); Object.assign(d, KM.yeni(d.tanim), { koltuk: d.koltuk }); }
        store.set("_sys/kartmasa/" + bid, d); yayinla(bid, d);
        return true;
      }
      case "kmIslem": {
        const [bid, d] = al(m);
        const h = m.islem && typeof m.islem === "object" ? m.islem : {};
        // Admin ve test hesapları masadaki bir botun yerine oynayabilir (server/botlar.js).
        const kisi = m.bot ? botKisi(c, d, String(m.bot)) : c.uid;
        KM.uygula(d, h, kisi, Math.random);
        store.set("_sys/kartmasa/" + bid, d); yayinla(bid, d);
        return true;
      }
      case "kmDelete": {
        const [bid, d] = al(m), b = store.get("boards/" + bid) || {};
        if (b.olusturan !== c.uid && !c.isOwner && !d.koltuk.some(x => x && x.id === c.uid)) throw hata("permission_denied", "Yalnızca oyuncular ya da masayı açan kapatabilir");
        for (const k of d.koltuk) if (k) gizliSil(bid, k.id);
        store.delete("_sys/kartmasa/" + bid); store.delete("boards/" + bid);
        return true;
      }
      // Atölyedeki oyunun başlangıç düzenini bu masadaki yerleşimden al (yalnızca oyunun sahibi).
      case "kmDuzen": {
        const [, d] = al(m), b = store.get("boards/" + String(m.board)) || {}, o = b.kartoyun && store.get("kartoyun/" + b.kartoyun);
        if (!o || (o.sahip !== c.uid && !c.isOwner)) throw hata("permission_denied", "Yalnızca oyunun sahibi düzeni kaydedebilir");
        const t = o.tanim, piller = Object.values(d.desteler);
        for (const dt of t.desteler || []) {
          const ana = piller.find(p => p.d === dt.id && !p.iskarta), isk = piller.find(p => p.d === dt.id && p.iskarta);
          if (ana) Object.assign(dt, { x: ana.x, y: ana.y });
          if (isk && dt.iskarta) Object.assign(dt.iskarta, { x: isk.x, y: isk.y });
        }
        for (const st of t.taslar || []) { const ilk = Object.values(d.taslar).find(x => x.t === st.id); if (ilk) Object.assign(st, { x: ilk.x, y: ilk.y }); }
        store.set("kartoyun/" + b.kartoyun, { ...o, tanim: KM.tanimDuzelt(t), updated: Date.now() });
        return true;
      }
      case "kmTanimYaz": {
        const tanim = KM.tanimDuzelt(m.tanim), k = ben(c);
        if (!tanim.desteler.length && !tanim.taslar.length) throw hata("invalid_argument", "Oyuna en az bir deste ya da taş ekle");
        if (JSON.stringify(tanim).length > 400000) throw hata("invalid_argument", "Oyun çok büyük");
        let id = String(m.kartoyun || "");
        if (id) {
          const o = OYUN_ID.test(id) && store.get("kartoyun/" + id);
          if (!o) throw hata("not_found", "Böyle bir oyun yok");
          if (o.sahip !== c.uid && !c.isOwner) throw hata("permission_denied", "Bu oyunu yalnızca yapan kişi değiştirebilir");
          store.set("kartoyun/" + id, { ...o, tanim, updated: Date.now() });
        } else {
          const benim = store.list("kartoyun").filter(x => x.data.sahip === c.uid).length;
          if (benim >= 50) throw hata("invalid_argument", "En fazla 50 oyun yapabilirsin");
          id = "ko-" + rid(6);
          store.set("kartoyun/" + id, { tanim, sahip: c.uid, sahipAd: k.name, created: Date.now(), updated: Date.now() });
        }
        return { id };
      }
      case "kmTanimSil": {
        const id = String(m.kartoyun || ""), o = OYUN_ID.test(id) && store.get("kartoyun/" + id);
        if (!o) throw hata("not_found", "Böyle bir oyun yok");
        if (o.sahip !== c.uid && !c.isOwner) throw hata("permission_denied", "Bu oyunu yalnızca yapan kişi silebilir");
        store.delete("kartoyun/" + id);
        return true;
      }
    }
    throw hata("unknown_op", "Bilinmeyen işlem");
  }
  return { OPS, op, kaydet };
}

module.exports = { kurKartMasa };
