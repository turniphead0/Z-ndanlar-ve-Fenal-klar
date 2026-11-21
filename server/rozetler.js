// Profil rozetleri: "İlk galibiyet", "10 oturum yönetti" gibi.
//
// Sayılar _sys/rozet/<kişi> belgesinde birikir, böylece masa silinse de kazanılan rozet kalır:
//   galibiyet  { "<masa>:<zaman>": t }  kazanılan masa oyunları (tahta oyunları, kazananı belli olanlar)
//   biten      { "<masa>:<zaman>": t }  bitirilen masa oyunları
//   oturum     sayı                     yönettiği oturumlar: DM, masasında en az bir oyuncuyla buluştuğu her gün
//   oturumGun  { "<oyun>": "YYYY-MM-DD" } her oyunda son sayılan gün (aynı gün ikinci kez sayılmasın)
//   kazanildi  { "<rozet>": t }         rozetin ilk kazanıldığı zaman
// Geri kalanı (FRP masaları, forum, arkadaşlar, üyelik) zaten depoda duran belgelerden hesaplanır.
"use strict";

const hata = (code, message) => Object.assign(new Error(message), { code });
const KISI_ID = /^u-[0-9a-f]{8,}$/;
const GUN = 86400000;

// Rozetler: sıra profilde gösterilen sıradır.
const ROZETLER = [
  { id: "ilk-masa", ad: "İlk masa", simge: "🎲", aciklama: "Bir FRP masasına oyuncu ya da DM olarak katıldı", alan: "frp", hedef: 1 },
  { id: "masa-kurucu", ad: "Masa kurucu", simge: "🏰", aciklama: "Bir FRP masasını DM olarak yönetiyor", alan: "dm", hedef: 1 },
  { id: "ilk-oturum", ad: "İlk oturum", simge: "📜", aciklama: "DM olarak ilk oturumunu yönetti", alan: "oturum", hedef: 1 },
  { id: "oturum-10", ad: "10 oturum yönetti", simge: "🐉", aciklama: "DM olarak 10 oturum yönetti", alan: "oturum", hedef: 10 },
  { id: "oturum-50", ad: "Usta anlatıcı", simge: "👑", aciklama: "DM olarak 50 oturum yönetti", alan: "oturum", hedef: 50 },
  { id: "ilk-oyun", ad: "Masaya oturdu", simge: "♟", aciklama: "Bir masa oyununu sonuna kadar oynadı", alan: "biten", hedef: 1 },
  { id: "ilk-galibiyet", ad: "İlk galibiyet", simge: "🏆", aciklama: "Bir masa oyununu kazandı", alan: "galibiyet", hedef: 1 },
  { id: "galibiyet-10", ad: "10 galibiyet", simge: "🥇", aciklama: "Masa oyunlarında 10 kez kazandı", alan: "galibiyet", hedef: 10 },
  { id: "forum-ilk", ad: "Söz aldı", simge: "💬", aciklama: "Forumda ilk konusunu ya da yanıtını yazdı", alan: "forum", hedef: 1 },
  { id: "forum-25", ad: "Forum müdavimi", simge: "📣", aciklama: "Forumda 25 konu ya da yanıt yazdı", alan: "forum", hedef: 25 },
  { id: "arkadas-5", ad: "Sosyal", simge: "🤝", aciklama: "5 arkadaşı var", alan: "arkadas", hedef: 5 },
  { id: "kidem-1", ad: "Bir yıllık üye", simge: "🕯", aciklama: "Bir yıldır üye", alan: "gun", hedef: 365 },
];

const bugun = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

function kurRozetler({ store, conns, dosyalar, forumu }) {
  const OPS = new Set(["rozetler"]);
  const yol = uid => "_sys/rozet/" + uid;
  const al = uid => store.get(yol(uid)) || {};
  const insan = uid => { const u = store.get("_sys/users/" + uid); return !!u && !u.bot; };

  /* ---- Masa oyunları: biten oyunlar ve kazananlar ---- */
  // Biten her oyun bir kez sayılır: anahtar "<masa>:<oyunun bittiği andaki updated>". Sunucu yeniden açılınca
  // aynı anahtar çıkar, iki kez sayılmaz.
  const bitmis = new Set();
  function masaBak(bid, b) {
    const d = (b && b.durum) || {};
    if (!b || b.oyun === "kart" || !d.bitti) { bitmis.delete(bid); return; }
    if (bitmis.has(bid)) return;
    bitmis.add(bid);
    const anahtar = bid + ":" + (b.updated || b.created || 0), t = b.updated || Date.now();
    (b.koltuk || []).forEach((k, i) => {
      if (!k || !k.id || !insan(k.id)) return;
      const r = al(k.id), biten = { ...(r.biten || {}) }, galibiyet = { ...(r.galibiyet || {}) };
      let degisti = false;
      if (!biten[anahtar]) { biten[anahtar] = t; degisti = true; }
      if (d.bitti.kazanan === i && !galibiyet[anahtar]) { galibiyet[anahtar] = t; degisti = true; }
      if (degisti) store.set(yol(k.id), { ...r, biten, galibiyet });
    });
  }
  for (const p of store.paths("boards")) masaBak(p.slice(7), store.get(p));
  store.listeners.add((type, p, data) => {
    if (!/^boards\/b[a-z0-9]{6,24}$/.test(p)) return;
    if (type === "removed") bitmis.delete(p.slice(7)); else masaBak(p.slice(7), data);
  });

  /* ---- Yönetilen oturumlar ---- */
  // Bir FRP masasında DM ve en az bir oyuncu aynı anda masadaysa o gün DM için bir oturum sayılır
  // (oyun başına günde bir). index.js her "presence" değişikliğinde (masaya girince) çağırır.
  function masayaGirdi(gid) {
    if (!gid || typeof gid !== "string") return;
    const g = store.get("games/" + gid); if (!g || !g.dms) return;
    const masada = new Set(); for (const o of conns) if (o.uid && o.presence && o.presence.g === gid) masada.add(o.uid);
    const dmler = [...masada].filter(u => g.dms[u]), oyuncular = [...masada].filter(u => !g.dms[u] && g.players && g.players[u] && insan(u));
    if (!dmler.length || !oyuncular.length) return;
    const gun = bugun();
    for (const dm of dmler) {
      const r = al(dm), oturumGun = { ...(r.oturumGun || {}) };
      if (oturumGun[gid] === gun) continue;
      oturumGun[gid] = gun;
      store.set(yol(dm), { ...r, oturum: (r.oturum || 0) + 1, oturumGun });
    }
  }

  /* ---- Rozetleri hesapla ---- */
  function rozetleri(uid) {
    const r = al(uid), u = store.get("_sys/users/" + uid) || {};
    const o = dosyalar.oyunlari(uid);
    let arkadas = 0; for (const d of store.list(`data/users/${uid}/arkadas`)) if (d.data && d.data.durum === "arkadas") arkadas++;
    const f = forumu(uid);
    const sayi = {
      frp: o.frp.length, dm: o.frp.filter(g => g.rol === "dm").length, oturum: r.oturum || 0,
      biten: Object.keys(r.biten || {}).length, galibiyet: Object.keys(r.galibiyet || {}).length,
      forum: f.sayi.konu + f.sayi.yanit, arkadas, gun: u.created ? Math.floor((Date.now() - u.created) / GUN) : 0,
    };
    const kazanildi = { ...(r.kazanildi || {}) }; let yeni = false;
    const liste = ROZETLER.map(z => {
      const n = sayi[z.alan] || 0, tamam = n >= z.hedef;
      if (tamam && !kazanildi[z.id]) { kazanildi[z.id] = Date.now(); yeni = true; }
      return { id: z.id, ad: z.ad, simge: z.simge, aciklama: z.aciklama, hedef: z.hedef, n: Math.min(n, z.hedef), kazanildi: tamam ? kazanildi[z.id] : null };
    });
    if (yeni && !u.bot) store.set(yol(uid), { ...al(uid), kazanildi });
    return { rozetler: liste, sayi };
  }

  function op(c, m) {
    switch (m.op) {
      case "rozetler": {
        const uid = m.kisi ? String(m.kisi) : c.uid;
        if (!KISI_ID.test(uid) && uid !== c.uid) throw hata("invalid_argument", "Geçersiz kişi");
        if (!store.get("_sys/users/" + uid)) throw hata("not_found", "Böyle biri yok");
        return rozetleri(uid);
      }
    }
    throw hata("unknown_op", "Bilinmeyen işlem");
  }
  return { OPS, op, masayaGirdi, rozetleri, ROZETLER };
}

module.exports = { kurRozetler, ROZETLER };
