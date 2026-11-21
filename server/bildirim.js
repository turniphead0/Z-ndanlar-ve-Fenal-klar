// Bildirimler: sunucunun kendiliğinden gönderdikleri (sıra sende, oyun bitti, masana biri oturdu, arkadaşlık
// istekleri, FRP masasına katılma istekleri) ve kullanıcıların birbirine gönderdikleri (kısa not ya da oyuna davet).
//
// Veri:
//   data/users/<kişi>/bildirim/<id>   { id, t, tur, baslik, metin, hedef: { tur, id } | null, kimden, okundu }
//                                     yalnızca sunucu yazar (index.js SUNUCU_YAZAR), kişi okur ve abone olur
//   data/users/<kişi>/ayar/bildirim   { kapali: { <tur>: true } }  kişinin kendi tercihleri (kendisi yazar)
//
// Aynı masa için "sıra sende" ve "oyun bitti" bildirimleri tek belgedir (sira-<masa>, bitti-<masa>): yenisi
// eskisinin üstüne yazılır, böylece uzun bir oyunda kutu dolmaz.
"use strict";
const crypto = require("crypto");
const { OYUNLAR } = require("../web/oyunlar/kurallar");

const rid = (n = 6) => crypto.randomBytes(n).toString("hex");
const hata = (code, message) => Object.assign(new Error(message), { code });
const KISI_ID = /^u-[0-9a-f]{8,}$/, MASA_ID = /^b[a-z0-9]{6,24}$/, GAME_ID = /^[A-Za-z0-9_-]{1,80}$/;
const BILDIRIM_ID = /^[a-z0-9-]{1,40}$/;
const SAKLA = 100; // kişi başına en çok bu kadar bildirim
// Kişinin kapatabileceği bildirim türleri (ayarlar ekranı bunları gösterir).
const TURLER = {
  sira: "Sıra bende",
  bitti: "Oyun bitti",
  otur: "Masama biri oturdu",
  davet: "Oyuna davetler",
  mesaj: "Kişilerden notlar",
  arkadas: "Arkadaşlık istekleri",
  katilim: "FRP masası katılım istekleri ve onayları",
};
const TUR_GRUBU = { "arkadas-istek": "arkadas", "arkadas-kabul": "arkadas", "katilma-istek": "katilim", "katilim-onay": "katilim", "katildi": "katilim" };
const metin = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").replace(/\r\n?/g, "\n").trim().slice(0, n);
const insan = id => typeof id === "string" && !id.startsWith("bot-");

function kurBildirim({ store, conns, dosyalar }) {
  const OPS = new Set(["bildirimOkundu", "bildirimSil", "bildirimGonder", "bildirimKisiler"]);
  const adOf = uid => { const u = store.get("_sys/users/" + uid); return (u && (u.username || u.name)) || "Biri"; };
  const col = uid => `data/users/${uid}/bildirim`;

  function kapaliMi(uid, tur) {
    const a = store.get(`data/users/${uid}/ayar/bildirim`);
    const k = a && a.kapali; if (!k || typeof k !== "object") return false;
    return !!k[TUR_GRUBU[tur] || tur];
  }
  // Bildirim yaz. id verilirse aynı belgenin üstüne yazar (tekrar eden durumlar için).
  function gonder(uid, b, id) {
    if (!insan(uid) || !KISI_ID.test(uid) || !store.get("_sys/users/" + uid)) return null;
    if (kapaliMi(uid, b.tur)) return null;
    const t = Date.now(); id = id || "n" + t.toString(36) + rid(3);
    const doc = { id, t, tur: b.tur, baslik: metin(b.baslik, 140), metin: metin(b.metin, 400), hedef: b.hedef || null, kimden: b.kimden || null, okundu: false };
    store.set(col(uid) + "/" + id, doc);
    if (store.count(col(uid)) > SAKLA) {
      const all = store.list(col(uid)).sort((x, y) => (x.data.t || 0) - (y.data.t || 0));
      for (const d of all.slice(0, all.length - SAKLA)) store.delete(d.path);
    }
    return doc;
  }
  const sil = (uid, id) => store.delete(col(uid) + "/" + id);

  /* ---------------- Masa oyunları: sıra, bitiş, oturan ---------------- */
  const masaAdi = b => b.ad || (b.oyun === "kart" ? (b.tanim && b.tanim.ad) || "Kart masası" : (OYUNLAR[b.oyun] || {}).ad || "Masa");
  function masaBilgi(b) {
    const kart = b.oyun === "kart", d = b.durum || {}, koltuk = (kart ? d.koltuk : b.koltuk) || [];
    const bitti = !kart && !!d.bitti;
    const oynaniyor = kart ? !!d.basladi : !bitti;
    const k = oynaniyor && d.sira != null ? koltuk[d.sira] : null;
    return { sira: k && insan(k.id) ? k.id : null, n: d.n || 0, bitti, basladi: kart ? !!d.basladi : true, kisiler: [...new Set(koltuk.filter(x => x && insan(x.id)).map(x => x.id))] };
  }
  const masalar = new Map();
  for (const p of store.paths("boards")) { const b = store.get(p); if (b) masalar.set(p.slice(7), masaBilgi(b)); }

  function masaDegisti(type, bid, b) {
    const once = masalar.get(bid);
    if (type === "removed") {
      masalar.delete(bid);
      for (const u of (once || masaBilgi(b)).kisiler) sil(u, "sira-" + bid);
      return;
    }
    const simdi = masaBilgi(b); masalar.set(bid, simdi);
    if (!once) return; // yeni açılan masa: açan kişi zaten orada
    const ad = masaAdi(b), hedef = { tur: "tahta", id: bid };
    // Sıra bir başkasına geçti.
    if (simdi.sira && simdi.sira !== once.sira && (simdi.n !== once.n || (simdi.basladi && !once.basladi))) {
      const oyunAd = b.oyun === "kart" ? "" : (OYUNLAR[b.oyun] || {}).ad;
      gonder(simdi.sira, { tur: "sira", baslik: `Sıra sende: ${ad}`, metin: oyunAd && oyunAd !== ad ? `${oyunAd} · ${simdi.n}. hamle` : `${simdi.n}. hamle`, hedef }, "sira-" + bid);
    }
    if (once.sira && once.sira !== simdi.sira) { const u = once.sira; const d = store.get(col(u) + "/sira-" + bid); if (d && !d.okundu) sil(u, "sira-" + bid); }
    // Oyun bitti.
    if (simdi.bitti && !once.bitti) {
      const d = b.durum.bitti, koltuk = b.koltuk || [];
      for (const u of simdi.kisiler) {
        sil(u, "sira-" + bid);
        const benim = koltuk.map((k, i) => (k && k.id === u ? i : -1)).filter(i => i >= 0);
        const sonuc = d.kazanan == null ? "Berabere" : benim.includes(d.kazanan) && benim.length === 1 ? "Kazandın!" : benim.length === 1 ? "Kaybettin" : "Kazanan: " + ((koltuk[d.kazanan] || {}).name || "?");
        gonder(u, { tur: "bitti", baslik: `Oyun bitti: ${ad}`, metin: `${sonuc} (${d.neden || ""})`, hedef }, "bitti-" + bid);
      }
    }
    // Masana biri oturdu (masayı açan kişiye).
    const acan = b.olusturan;
    for (const u of simdi.kisiler) {
      if (once.kisiler.includes(u) || u === acan || !acan) continue;
      gonder(acan, { tur: "otur", baslik: `${adOf(u)} masana oturdu`, metin: ad, hedef, kimden: u });
    }
  }

  /* ---------------- FRP masaları: katılma istekleri ---------------- */
  const acik = o => Object.keys(o || {}).filter(k => o[k]);
  const frpBilgi = g => ({ dms: acik(g.dms), oyuncular: acik(g.players), bekleyen: acik(g.pending) });
  const frplar = new Map();
  for (const p of store.paths("games")) { const g = store.get(p); if (g) frplar.set(p.slice(6), frpBilgi(g)); }
  function frpDegisti(type, gid, g) {
    if (type === "removed") { frplar.delete(gid); return; }
    const once = frplar.get(gid), simdi = frpBilgi(g); frplar.set(gid, simdi);
    if (!once) return;
    const hedef = { tur: "oyun", id: gid }, ad = g.name || "Adsız oyun";
    for (const u of simdi.bekleyen) {
      if (once.bekleyen.includes(u) || !insan(u)) continue;
      for (const dm of simdi.dms) if (dm !== u) gonder(dm, { tur: "katilma-istek", baslik: `${adOf(u)} katılmak istiyor`, metin: `${ad} oyununa katılma isteği. Oyun ayarlarından onaylayabilirsin.`, hedef, kimden: u });
    }
    for (const u of simdi.oyuncular) {
      if (once.oyuncular.includes(u) || !insan(u)) continue;
      if (once.bekleyen.includes(u)) gonder(u, { tur: "katilim-onay", baslik: `Katılma isteğin kabul edildi`, metin: `Artık ${ad} oyunundasın.`, hedef });
      else for (const dm of simdi.dms) if (dm !== u) gonder(dm, { tur: "katildi", baslik: `${adOf(u)} oyununa katıldı`, metin: ad, hedef, kimden: u });
    }
  }

  store.listeners.add((type, p, data) => {
    const s = p.split("/");
    if (s.length !== 2 || !data) return;
    if (s[0] === "boards") masaDegisti(type, s[1], data);
    else if (s[0] === "games") frpDegisti(type, s[1], data);
  });

  /* ---------------- Arkadaşlık (server/hesap.js çağırır) ---------------- */
  function arkadas(tur, kimden, kime) {
    if (tur === "istek") gonder(kime, { tur: "arkadas-istek", baslik: `${adOf(kimden)} arkadaşlık isteği gönderdi`, metin: "Arkadaşlar sayfasından kabul edebilirsin.", hedef: { tur: "kisi", id: kimden }, kimden });
    else gonder(kime, { tur: "arkadas-kabul", baslik: `${adOf(kimden)} arkadaşlık isteğini kabul etti`, metin: "Artık birbirinize mesaj gönderebilirsiniz.", hedef: { tur: "kisi", id: kimden }, kimden });
  }

  /* ---------------- Kullanıcıdan kullanıcıya ---------------- */
  const arkadasMi = (a, b) => ((store.get(`data/users/${a}/arkadas/${b}`) || {}).durum) === "arkadas";
  // Bildirim gönderilebilecek kişiler: arkadaşlar ve aynı oyunda/masada oturanlar.
  function kisiler(uid) {
    const out = new Map();
    for (const d of store.list(`data/users/${uid}/arkadas`)) if (d.data && d.data.durum === "arkadas") out.set(d.id, { neden: "Arkadaş" });
    const { frp, masa } = dosyalar.oyunlari(uid);
    for (const g of frp) { const x = store.get("games/" + g.id) || {}; for (const u of [...acik(x.dms), ...acik(x.players)]) if (u !== uid && insan(u) && !out.has(u)) out.set(u, { neden: g.ad }); }
    for (const b of masa) for (const k of b.oyuncular) if (k.id !== uid && !k.bot && !out.has(k.id)) out.set(k.id, { neden: b.ad || b.oyunAd });
    return out;
  }
  const hizlar = new Map(); // gönderen -> zamanlar
  function op(c, m) {
    switch (m.op) {
      case "bildirimOkundu": {
        const ids = m.bildirim ? [String(m.bildirim)] : store.paths(col(c.uid)).map(p => p.split("/").pop());
        for (const id of ids) {
          if (!BILDIRIM_ID.test(id)) continue;
          const p = col(c.uid) + "/" + id, d = store.get(p);
          if (d && !d.okundu) store.set(p, { ...d, okundu: true });
        }
        return true;
      }
      case "bildirimSil": {
        if (m.bildirim) { if (BILDIRIM_ID.test(String(m.bildirim))) sil(c.uid, String(m.bildirim)); return true; }
        for (const p of store.paths(col(c.uid))) { const d = store.get(p); if (m.hepsi || (d && d.okundu)) store.delete(p); }
        return true;
      }
      case "bildirimKisiler": {
        const k = kisiler(c.uid), { frp, masa } = dosyalar.oyunlari(c.uid);
        return {
          kisiler: [...k.entries()].map(([id, x]) => ({ id, ad: adOf(id), neden: x.neden })).sort((a, b) => a.ad.localeCompare(b.ad, "tr")),
          oyunlar: [...frp.map(g => ({ tur: "oyun", id: g.id, ad: g.ad, alt: g.sistemAd })), ...masa.filter(b => b.durum !== "bitti").map(b => ({ tur: "tahta", id: b.id, ad: b.ad || b.oyunAd, alt: b.ad ? b.oyunAd : (b.tur === "kart" ? "Kart masası" : "Tahta") }))],
          turler: TURLER,
        };
      }
      case "bildirimGonder": {
        const kime = [...new Set((Array.isArray(m.kime) ? m.kime : [m.kime]).map(String))].filter(u => KISI_ID.test(u) && u !== c.uid).slice(0, 20);
        if (!kime.length) throw hata("invalid_argument", "Kime göndereceğini seç");
        const yazi = metin(m.metin, 300);
        let hedef = null, hedefAd = "";
        if (m.hedef && typeof m.hedef === "object") {
          const id = String(m.hedef.id || "");
          if (m.hedef.tur === "tahta" && MASA_ID.test(id)) { const b = store.get("boards/" + id); if (b) { hedef = { tur: "tahta", id }; hedefAd = masaAdi(b); } }
          else if (m.hedef.tur === "oyun" && GAME_ID.test(id)) {
            const g = store.get("games/" + id);
            if (g && !(g.dms && g.dms[c.uid]) && !(g.players && g.players[c.uid])) throw hata("permission_denied", "Yalnızca içinde olduğun bir oyuna davet edebilirsin");
            if (g) { hedef = { tur: "oyun", id }; hedefAd = g.name || "Adsız oyun"; }
          }
          if (!hedef) throw hata("not_found", "Davet edilen oyun bulunamadı");
        }
        if (!yazi && !hedef) throw hata("invalid_argument", "Boş bildirim");
        const izinli = kisiler(c.uid), yasak = kime.filter(u => !izinli.has(u));
        if (yasak.length) throw hata("permission_denied", "Yalnızca arkadaşlarına ve aynı oyunda olduğun kişilere bildirim gönderebilirsin");
        const now = Date.now(), h = (hizlar.get(c.uid) || []).filter(t => now - t < 60000);
        if (h.length + kime.length > 15) throw hata("rate_limited", "Biraz yavaş: bir dakikada en çok 15 bildirim gönderebilirsin");
        for (const u of kime) h.push(now);
        hizlar.set(c.uid, h);
        const ben = adOf(c.uid);
        let n = 0;
        for (const u of kime) {
          const b = hedef
            ? { tur: "davet", baslik: `${ben} seni ${hedefAd} oyununa çağırıyor`, metin: yazi, hedef, kimden: c.uid }
            : { tur: "mesaj", baslik: `${ben} sana bir not gönderdi`, metin: yazi, hedef: { tur: "kisi", id: c.uid }, kimden: c.uid };
          if (gonder(u, b)) n++;
        }
        return { gonderilen: n, kapali: kime.length - n };
      }
    }
    throw hata("unknown_op", "Bilinmeyen işlem");
  }
  const supurge = setInterval(() => { const now = Date.now(); for (const [k, a] of hizlar) if (!a.some(t => now - t < 60000)) hizlar.delete(k); }, 300000); supurge.unref();

  return { OPS, op, gonder, arkadas, TURLER, kapat: () => clearInterval(supurge) };
}

module.exports = { kurBildirim, TURLER };
