// Yüklenen dosyalar (kota ve "Yüklediklerim") ile profildeki oyun listesi.
//
// Kota: her dosya en çok maxDosya bayt olabilir (ZM_MAX_DOSYA, MB) ve bir kişinin bütün yüklemeleri toplam
// kota baytı geçemez (ZM_KOTA, MB). Admin bir kişiye ayrı kota verebilir: _sys/kota/<kişi> { mb, veren, t }.
//
// Her yüklemenin hangi oyuna yapıldığı _sys/assets/<dosya>.yer alanında durur (istemci x-zm-yer başlığıyla
// söyler): "games/<oyun>" (FRP masası), "boards/<masa>" (masa oyunu), "kartoyun/<oyun>" (oyun atölyesi),
// "atolye" (henüz kaydedilmemiş atölye oyunu), "profil" ya da "mesaj". Eski yüklemelerde yer yoktur.
//
// Profil: bir kişinin içinde olduğu FRP masaları (games/*: DM ya da oyuncu) ve masa oyunları (boards/*: koltukta)
// iki ayrı grup olarak döner. Bu belgeler zaten herkese açık olduğundan yeni bir şey açığa çıkmaz.
"use strict";
const { OYUNLAR } = require("../web/oyunlar/kurallar");

const MB = 1024 * 1024;
const hata = (code, message) => Object.assign(new Error(message), { code });
const KISI_ID = /^u-[0-9a-f]{8,}$/;
const YER = /^(games\/[A-Za-z0-9_-]{1,80}|boards\/b[a-z0-9]{6,24}|kartoyun\/ko-[0-9a-f]{12}|atolye|profil|mesaj)$/;
const SISTEM = { dnd5e: "D&D 5e", coc7: "Call of Cthulhu", yze: "Year Zero", pf2e: "Pathfinder 2e", motw: "Monster of the Week" };

const yerDuzelt = v => { const s = String(v || "").trim(); return YER.test(s) ? s : null; };
const mbSayi = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };

// Masa oyununun (tahta ya da kart masası) herkese gösterilen özeti.
function masaOzeti(id, b, uid) {
  const kart = b.oyun === "kart", d = b.durum || {};
  const koltuk = (kart ? d.koltuk : b.koltuk) || [];
  const oyunAd = kart ? ((b.tanim && b.tanim.ad) || "Kart oyunu") : ((OYUNLAR[b.oyun] || {}).ad || b.oyun);
  const sira = kart ? (d.basladi ? d.sira : null) : d.sira;
  const benim = koltuk.map((k, i) => (k && k.id === uid ? i : -1)).filter(i => i >= 0);
  let durum;
  if (!kart && d.bitti) durum = "bitti";
  else if (kart && !d.basladi) durum = "bekliyor";
  else if (!kart && koltuk.includes(null)) durum = "bekliyor";
  else durum = "oynaniyor";
  return {
    id, tur: kart ? "kart" : "tahta", oyun: b.oyun, oyunAd, ad: b.ad || null,
    durum, siraSende: durum !== "bitti" && sira != null && benim.includes(sira),
    kazandi: !kart && d.bitti && d.bitti.kazanan != null ? benim.includes(d.bitti.kazanan) : null,
    oyuncular: koltuk.filter(Boolean).map(k => ({ id: k.id, ad: k.name, bot: !!k.bot })),
    updated: b.updated || b.created || 0,
  };
}
const masadaMi = (b, uid) => ((b.oyun === "kart" ? (b.durum || {}).koltuk : b.koltuk) || []).some(k => k && k.id === uid);
const frpRolu = (g, uid) => (g.dms && g.dms[uid] ? "dm" : g.players && g.players[uid] ? "oyuncu" : null);

function kurDosyalar({ store, roller, conns, maxDosya, kota, kurallar = null }) {
  const MAX = Math.round(mbSayi(maxDosya, 25) * MB);
  const KOTA = Math.round(mbSayi(kota, 200) * MB);
  const OPS = new Set(["dosyalarim", "profilOyunlar", "kotaListe", "kotaAyar"]);

  // Kişi başına kullanılan alan (bayt). Açılışta bir kez hesaplanır, sonra yüklemeler ve silmelerle güncellenir.
  const kullanim = new Map();
  for (const p of store.paths("_sys/assets")) { const a = store.get(p); if (a && a.owner) kullanim.set(a.owner, (kullanim.get(a.owner) || 0) + (a.size || 0)); }
  store.listeners.add((type, p, data) => {
    if (!p.startsWith("_sys/assets/") || !data || !data.owner) return;
    if (type === "added") kullanim.set(data.owner, (kullanim.get(data.owner) || 0) + (data.size || 0));
    else if (type === "removed") kullanim.set(data.owner, Math.max(0, (kullanim.get(data.owner) || 0) - (data.size || 0)));
  });
  const kotaOf = uid => { const k = store.get("_sys/kota/" + uid); return k && k.mb > 0 ? Math.round(k.mb * MB) : KOTA; };
  const kullanilan = uid => kullanim.get(uid) || 0;
  // Bu kişi şimdi en çok kaç baytlık bir dosya yükleyebilir.
  const yuklenebilir = uid => Math.max(0, Math.min(MAX, kotaOf(uid) - kullanilan(uid)));
  const mbYaz = b => (b >= 10 * MB ? Math.round(b / MB) : Math.round(b / MB * 10) / 10) + " MB";
  // Yükleme reddedilirse kullanıcıya gösterilecek metin (null: sorun yok).
  function sinirAsildi(uid, boyut) {
    if (boyut > MAX) return `Bir dosya en çok ${mbYaz(MAX)} olabilir`;
    const kalan = kotaOf(uid) - kullanilan(uid);
    if (boyut > kalan) return `Yükleme alanın doldu: ${mbYaz(kullanilan(uid))} / ${mbYaz(kotaOf(uid))} kullanılıyor. Yüklediklerim sayfasından eski dosyaları silebilirsin.`;
    return null;
  }

  // Yerin okunabilir adı: FRP masası, masa oyunu ya da atölye oyunu.
  function yerBilgisi(yer) {
    if (!yer) return { tur: "diger", ad: "Eski yüklemeler" };
    if (yer === "profil") return { tur: "profil", ad: "Profil fotoğrafı" };
    if (yer === "mesaj") return { tur: "mesaj", ad: "Mesajlar" };
    if (yer === "atolye") return { tur: "atolye", ad: "Oyun atölyesi" };
    const [kok, id] = yer.split("/");
    if (kok === "games") { const g = store.get(yer); return { tur: "frp", id, ad: g ? g.name || "Adsız oyun" : "Silinmiş oyun", sistem: g ? SISTEM[g.system || "dnd5e"] || null : null, var: !!g }; }
    if (kok === "boards") { const b = store.get(yer); return { tur: "masa", id, ad: b ? b.ad || (b.oyun === "kart" ? (b.tanim || {}).ad : (OYUNLAR[b.oyun] || {}).ad) || "Masa" : "Kapanmış masa", var: !!b }; }
    if (kok === "kartoyun") { const o = store.get(yer); return { tur: "atolye", id, ad: o ? (o.tanim || {}).ad || "Atölye oyunu" : "Silinmiş atölye oyunu", var: !!o }; }
    return { tur: "diger", ad: "Diğer" };
  }

  // Kişinin içinde olduğu oyunlar: FRP masaları ve masa oyunları ayrı.
  function oyunlari(uid) {
    const frp = [], masa = [];
    const cevrimici = new Map(); for (const o of conns) if (o.uid && o.presence && o.presence.g) cevrimici.set(o.presence.g, (cevrimici.get(o.presence.g) || 0) + 1);
    for (const p of store.paths("games")) {
      const g = store.get(p), rol = g && frpRolu(g, uid); if (!rol) continue;
      const id = p.slice(6);
      frp.push({ id, ad: g.name || "Adsız oyun", sistem: g.system || "dnd5e", sistemAd: SISTEM[g.system || "dnd5e"] || g.system, rol,
        oyuncu: Object.values(g.players || {}).filter(Boolean).length, acik: g.open !== false, masada: cevrimici.get(id) || 0, updated: g.updated || g.created || 0 });
    }
    for (const p of store.paths("boards")) {
      const b = store.get(p); if (!b || !masadaMi(b, uid)) continue;
      masa.push(masaOzeti(p.slice(7), b, uid));
    }
    frp.sort((a, b) => b.updated - a.updated); masa.sort((a, b) => (b.siraSende - a.siraSende) || b.updated - a.updated);
    return { frp, masa };
  }

  function op(c, m) {
    switch (m.op) {
      case "dosyalarim": {
        const dosyalar = [];
        for (const p of store.paths("_sys/assets")) {
          const a = store.get(p); if (!a || a.owner !== c.uid) continue;
          const id = p.slice(12);
          dosyalar.push({ id, url: "/assets/" + id, type: a.type, size: a.size || 0, name: a.name || "", created: a.created || 0, yer: a.yer || null });
        }
        dosyalar.sort((a, b) => b.created - a.created);
        // Yerlerin adları bir kez çözülür; kişinin içinde olduğu bütün oyunlar da (dosya yüklemediği olsa bile) listelenir.
        const yerler = {};
        for (const d of dosyalar) if (!(String(d.yer) in yerler)) yerler[String(d.yer)] = yerBilgisi(d.yer);
        const { frp, masa } = oyunlari(c.uid);
        for (const g of frp) if (!yerler["games/" + g.id]) yerler["games/" + g.id] = { tur: "frp", id: g.id, ad: g.ad, sistem: g.sistemAd, var: true };
        for (const b of masa) if (!yerler["boards/" + b.id]) yerler["boards/" + b.id] = { tur: "masa", id: b.id, ad: b.ad || b.oyunAd, var: true };
        for (const p of store.paths("kartoyun")) { const o = store.get(p); if (o && o.sahip === c.uid && !yerler[p]) yerler[p] = { tur: "atolye", id: p.slice(9), ad: (o.tanim || {}).ad || "Atölye oyunu", var: true }; }
        // Yedek alınabilir mi, sunucudan kaldırılabilir mi (server/yedek.js doldurur).
        if (api.yerSusle) for (const [k, y] of Object.entries(yerler)) if (y.var) api.yerSusle(c.uid, k, y);
        return { dosyalar, yerler, kullanilan: kullanilan(c.uid), kota: kotaOf(c.uid), maxDosya: MAX };
      }
      case "profilOyunlar": {
        const uid = m.kisi ? String(m.kisi) : c.uid;
        if (!KISI_ID.test(uid) && uid !== c.uid) throw hata("invalid_argument", "Geçersiz kişi");
        if (!store.get("_sys/users/" + uid)) throw hata("not_found", "Böyle biri yok");
        if (kurallar && !kurallar.gorebilir(c, uid)) throw hata("permission_denied", "Bu profil gizli");
        return oyunlari(uid);
      }
      case "kotaListe": { // admin: her hesabın kullandığı alan ve kotası
        if (!roller.admin(c)) throw hata("permission_denied", "Bunu yalnızca adminler yapabilir");
        const out = {};
        for (const d of store.list("_sys/hesap")) if (d.data && d.data.uid) { const u = d.data.uid, k = store.get("_sys/kota/" + u); out[u] = { kullanilan: kullanilan(u), kota: kotaOf(u), ozel: !!(k && k.mb > 0) }; }
        return { varsayilan: KOTA, maxDosya: MAX, kisiler: out };
      }
      case "kotaAyar": { // admin: { kisi, mb } (mb boş ya da 0: varsayılan kota)
        if (!roller.admin(c)) throw hata("permission_denied", "Bunu yalnızca adminler yapabilir");
        const uid = String(m.kisi || "");
        if (!KISI_ID.test(uid) || !store.get("_sys/users/" + uid)) throw hata("not_found", "Böyle bir hesap yok");
        const mb = Number(m.mb);
        if (!m.mb || !(mb > 0)) { store.delete("_sys/kota/" + uid); return { kota: kotaOf(uid) }; }
        if (mb > 100000) throw hata("invalid_argument", "Kota en çok 100000 MB olabilir");
        store.set("_sys/kota/" + uid, { mb: Math.round(mb * 1000) / 1000, veren: c.uid, t: Date.now() });
        return { kota: kotaOf(uid) };
      }
    }
    throw hata("unknown_op", "Bilinmeyen işlem");
  }

  const api = { OPS, op, MAX, KOTA, sinirAsildi, yuklenebilir, kullanilan, kotaOf, yerDuzelt, oyunlari, masaOzeti, yerSusle: null };
  return api;
}

module.exports = { kurDosyalar, masaOzeti, masadaMi, frpRolu, yerDuzelt };
