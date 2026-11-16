// Botlar: her oyuna eklenebilen bilgisayar oyuncuları.
//
//   Tahta oyunları (boards/<masa>, kurallar.js)  bot koltuğa oturur, sırası gelince kendi hamlesini yapar (Kolay/Orta/Zor).
//   Kart ve taş masaları (kartmasa)              bot koltuğa oturur, sırası gelince genel bir tur oynar
//                                                (kart çeker, bir kart oynar, sırayı devreder).
//   RPG masaları (games/<oyun>)                  bot oyuncu olarak katılır; DM ona karakter atayabilir. Sohbette
//                                                adı anılınca yanıt verir (yapay zekâ açıksa karakterine uygun,
//                                                "@Bot 1d20+3" yazılırsa zar atar).
//
// Herkes (masadaki oyuncular ve masayı açan) bot ekleyip çıkarabilir. Botun aksiyonlarını kontrol etmek, yani botun
// yerine hamle yapmak, kart masasında botun elini görüp onun adına oynamak, otomatik oynamayı açıp kapatmak ve RPG'de
// bot adına konuşup zar atmak yalnızca admin ve test (tester) hesaplarına açıktır (server/roller.js).
// RPG'de oyunun DM'i de kendi oyunundaki botları konuşturabilir; NPC'leri zaten o yönetir.
//
// Bot kimlikleri "bot-<hex>" biçimindedir; profil bilgisi _sys/users/<bot> altında durur (ad, renk, bot: true).
"use strict";
const crypto = require("crypto");
const KM = require("../web/oyunlar/kartmasa");
const { OYUNLAR, yasal } = require("../web/oyunlar/kurallar");
const BOT = require("../web/oyunlar/bot");

const rid = (n = 5) => crypto.randomBytes(n).toString("hex");
const hata = (code, message) => Object.assign(new Error(message), { code });
const MASA_ID = /^b[a-z0-9]{6,24}$/, GAME_ID = /^[A-Za-z0-9_-]{1,80}$/, BOT_ID = /^bot-[0-9a-f]{10}$/;
const ZORLUKLAR = Object.keys(BOT.ZORLUK);
const BOT_RENK = ["#6c5ce7", "#00838f", "#ad1457", "#5d4037", "#2e7d32", "#ef6c00"];
const RPG_BOT_SINIRI = 8;
const KART_BOT_TUR_SINIRI = 300; // yalnızca botların oturduğu kart masası sonsuza dek dönmesin

// Basit zar ifadesi: 2d6+3, 1d20, 4d6kh3, d%, 1d8-1
function zarAt(ifade, rng = Math.random) {
  const e = String(ifade || "").toLowerCase().replace(/\s+/g, "").replace(/^d/, "1d").slice(0, 60);
  if (!e) throw hata("invalid_argument", "Zar ifadesi boş");
  const re = /([+-]?)(?:(\d*)d(\d+|%)(?:(kh|kl)(\d+))?|(\d+))/gy;
  let pos = 0, toplam = 0, parca = [], kritik = null, d20 = 0;
  while (pos < e.length) {
    re.lastIndex = pos; const m = re.exec(e);
    if (!m || m.index !== pos || !m[0]) throw hata("invalid_argument", "Zar ifadesi anlaşılmadı: " + e.slice(pos));
    pos = re.lastIndex;
    const isaret = m[1] === "-" ? -1 : 1;
    if (m[6] !== undefined) { toplam += isaret * +m[6]; parca.push((isaret < 0 ? " − " : parca.length ? " + " : "") + m[6]); continue; }
    const n = Math.min(+(m[2] || 1), 50), yuz = m[3] === "%" ? 100 : +m[3];
    if (!n || !yuz || yuz > 1000) throw hata("invalid_argument", "Geçersiz zar");
    const at = Array.from({ length: n }, () => 1 + Math.floor(rng() * yuz));
    let tut = at.map(() => true);
    if (m[4]) { const k = Math.min(+m[5], n), sec = at.map((v, i) => [v, i]).sort((a, b) => (m[4] === "kh" ? b[0] - a[0] : a[0] - b[0])).slice(0, k).map(x => x[1]); tut = at.map((_, i) => sec.includes(i)); }
    toplam += isaret * at.reduce((s, v, i) => s + (tut[i] ? v : 0), 0);
    parca.push(`${isaret < 0 ? " − " : parca.length ? " + " : ""}${n}d${yuz}[${at.map((v, i) => (tut[i] ? v : "~" + v)).join(",")}]`);
    if (yuz === 20) { d20++; const kalan = at.filter((_, i) => tut[i]); if (kalan.length === 1) kritik = kalan[0] === 20 ? "20" : kalan[0] === 1 ? "1" : null; }
  }
  if (d20 !== 1) kritik = null;
  return { toplam, detay: parca.join(""), kritik, ifade: e };
}

function kurBotlar({ store, conns, roller, kartMasa, sohbeteYaz, yapayZeka, gecikme = 900 }) {
  const OPS = new Set(["botEkle", "botCikar", "botAyar", "botHamle", "botAdim", "botGorunum", "oyunBotEkle", "oyunBotCikar", "oyunBotKonus", "oyunBotZar"]);
  const yonetici = c => roller.botYoneticisi(c);
  const yoneticiGerek = c => { if (!yonetici(c)) throw hata("permission_denied", "Botları yalnızca admin ve test hesapları kontrol edebilir"); };
  const botAdi = (i, zorluk) => `🤖 Bot ${i + 1}${zorluk ? " · " + BOT.ZORLUK[zorluk] : ""}`;

  /* ---------------- Masa (tahta ve kart) ---------------- */
  function masaAl(m) {
    const bid = String(m.board || ""), b = MASA_ID.test(bid) && store.get("boards/" + bid);
    if (!b) throw hata("not_found", "Böyle bir masa yok");
    const kart = b.oyun === "kart", d = kart ? store.get("_sys/kartmasa/" + bid) : null;
    if (kart && !d) throw hata("not_found", "Böyle bir masa yok");
    return { bid, b, kart, d, koltuk: kart ? d.koltuk : b.koltuk };
  }
  // Bot ekleyip çıkarabilen: masadaki oyuncular, masayı açan, sunucu sahibi, admin ve test hesapları.
  function masaKisisi(c, x) {
    if (x.b.olusturan === c.uid || c.isOwner || yonetici(c) || x.koltuk.some(k => k && k.id === c.uid)) return;
    throw hata("permission_denied", "Bot eklemek için bu masada oturmalısın");
  }
  function botKoltuk(x, m) {
    const i = Number(m.koltuk);
    if (!(i >= 0 && i < x.koltuk.length) || !x.koltuk[i] || !x.koltuk[i].bot) throw hata("not_found", "Bu koltukta bot yok");
    return i;
  }
  function kaydet(x) {
    if (x.kart) kartMasa.kaydet(x.bid, x.d);
    else store.set("boards/" + x.bid, { ...x.b, updated: Date.now() });
  }

  // Kart masasında bir işlemi botun adına yapan kişi: admin ya da tester, ve kişi gerçekten bu masadaki bir bot olmalı.
  function kartBotKisi(c, d, botId) {
    yoneticiGerek(c);
    if (!d.koltuk.some(k => k && k.bot && k.id === botId)) throw hata("not_found", "Bu masada böyle bir bot yok");
    return String(botId);
  }

  function op(c, m) {
    if (m.op.startsWith("oyunBot")) return rpgOp(c, m);
    const x = masaAl(m);
    switch (m.op) {
      case "botEkle": {
        masaKisisi(c, x);
        if (x.kart && x.d.basladi) throw hata("failed_precondition", "Oyun başladı; botu yeniden başlatmadan önce ekle");
        let i = m.koltuk == null ? x.koltuk.indexOf(null) : Number(m.koltuk);
        if (!(i >= 0 && i < x.koltuk.length)) throw hata("failed_precondition", "Boş koltuk yok");
        if (x.koltuk[i]) throw hata("taken", "Bu koltuk dolu");
        const zorluk = ZORLUKLAR.includes(m.zorluk) ? m.zorluk : "orta";
        const id = "bot-" + rid(5), bot = { id, name: botAdi(i, x.kart ? null : zorluk), bot: true, oto: true, ...(x.kart ? { renk: KM.RENKLER[i % KM.RENKLER.length] } : { zorluk }), ekleyen: c.uid };
        x.koltuk[i] = bot;
        store.set("_sys/users/" + id, { name: bot.name, color: BOT_RENK[i % BOT_RENK.length], bot: true, created: Date.now() });
        kaydet(x);
        return { id, koltuk: i };
      }
      case "botCikar": {
        masaKisisi(c, x);
        const i = botKoltuk(x, m);
        if (x.kart && x.d.basladi) throw hata("failed_precondition", "Oyun sürerken bot çıkarılamaz; önce yeniden başlat");
        x.koltuk[i] = null; kaydet(x);
        return true;
      }
      case "botAyar": { // { koltuk, oto?, zorluk? }: otomatik oynama yalnızca yöneticilere, zorluk masadakilere açık
        const i = botKoltuk(x, m), k = x.koltuk[i];
        if (m.oto !== undefined) { yoneticiGerek(c); k.oto = !!m.oto; }
        if (m.zorluk !== undefined) { masaKisisi(c, x); if (!x.kart && ZORLUKLAR.includes(m.zorluk)) { k.zorluk = m.zorluk; k.name = botAdi(i, m.zorluk); } }
        kaydet(x);
        return true;
      }
      case "botHamle": { // tahta oyunu: botun yerine belirli bir hamle
        yoneticiGerek(c);
        if (x.kart) throw hata("invalid_argument", "Kart masasında kmIslem'i bot ile kullan");
        const i = botKoltuk(x, m), d = x.b.durum;
        if (d.bitti || d.sira !== i) throw hata("not_your_turn", "Sıra bu botta değil");
        if (!yasal(x.b.oyun, d, m.hamle)) throw hata("illegal", "Bu hamle kurallara uymuyor");
        x.b.durum = OYUNLAR[x.b.oyun].uygula(d, m.hamle, Math.random); kaydet(x);
        return true;
      }
      case "botAdim": { // botu bir kez oynat (otomatik kapalıyken adım adım ilerletmek için)
        yoneticiGerek(c);
        const i = botKoltuk(x, m);
        if (!oynat(x, i)) throw hata("failed_precondition", "Sıra bu botta değil ya da yapacak hamlesi yok");
        return true;
      }
      case "botGorunum": { // kart masası: botun eli ve baktığı kartlar; tahta: yasal hamleler ve botun önerisi
        yoneticiGerek(c);
        const i = botKoltuk(x, m), k = x.koltuk[i];
        if (x.kart) return KM.gizliGorunum(x.d, k.id);
        const d = x.b.durum;
        return { hamleler: d.sira === i && !d.bitti ? OYUNLAR[x.b.oyun].hamleler(d) : [], oneri: d.sira === i && !d.bitti ? BOT.hamleSec(x.b.oyun, d, "zor") : null };
      }
    }
    throw hata("unknown_op", "Bilinmeyen işlem");
  }

  // Sırası gelen botu bir kez oynatır. Oynadıysa true.
  function oynat(x, i) {
    const k = x.koltuk[i];
    if (!k || !k.bot) return false;
    if (x.kart) {
      const d = x.d;
      if (!d.basladi || d.sira !== i || !d.el[k.id]) return false;
      for (const h of BOT.kartTuru(d, k.id)) {
        const islem = h.oyna ? BOT.kartOyna(d, k.id) : h;
        if (!islem) continue;
        try { KM.uygula(d, islem, k.id, Math.random); } catch (e) { /* boş deste vb.: bu adımı atla */ }
      }
      d.botTur = (d.botTur || 0) + 1;
      kaydet(x);
      return true;
    }
    const d = x.b.durum;
    if (d.bitti || d.sira !== i) return false;
    const h = BOT.hamleSec(x.b.oyun, d, k.zorluk || "orta");
    if (!h) return false;
    x.b.durum = OYUNLAR[x.b.oyun].uygula(d, h, Math.random);
    kaydet(x);
    return true;
  }

  // Otomatik oynama: bir masa değişince, sıra otomatik oynayan bir bottaysa biraz bekleyip oynat.
  const zamanlayici = new Map();
  function planla(bid) {
    if (zamanlayici.has(bid)) return;
    const t = setTimeout(() => {
      zamanlayici.delete(bid);
      try {
        const b = store.get("boards/" + bid); if (!b) return;
        const x = masaAl({ board: bid });
        const sira = x.kart ? x.d.sira : x.b.durum.sira, k = x.koltuk[sira];
        if (!k || !k.bot || k.oto === false) return;
        if (x.kart) {
          if (!x.d.basladi) return;
          const insan = x.koltuk.some(y => y && !y.bot);
          if (!insan && (x.d.botTur || 0) >= KART_BOT_TUR_SINIRI) return;
        }
        oynat(x, sira);
      } catch (e) { if (e.code !== "not_found") console.error("[bot]", e); }
    }, gecikme);
    if (t.unref) t.unref();
    zamanlayici.set(bid, t);
  }
  store.listeners.add((type, p) => { if (type !== "removed" && /^boards\/b[a-z0-9]{6,24}$/.test(p)) planla(p.slice(7)); });

  /* ---------------- RPG masaları ---------------- */
  function oyunAl(m) {
    const gid = String(m.game || ""), g = GAME_ID.test(gid) && store.get("games/" + gid);
    if (!g) throw hata("not_found", "Böyle bir oyun yok");
    return [gid, g];
  }
  const dmMi = (g, uid) => !!(g.dms && g.dms[uid]);
  const oyunBotlari = g => Object.entries(g.players || {}).filter(([id, p]) => p && p.bot && BOT_ID.test(id)).map(([id]) => id);
  function oyunBotu(g, m) {
    const id = String(m.bot || "");
    if (!BOT_ID.test(id) || !(g.players && g.players[id] && g.players[id].bot)) throw hata("not_found", "Bu oyunda böyle bir bot yok");
    return id;
  }

  function rpgOp(c, m) {
    const [gid, g] = oyunAl(m);
    switch (m.op) {
      case "oyunBotEkle": {
        if (!dmMi(g, c.uid) && !yonetici(c)) throw hata("permission_denied", "Bu oyuna bot ekleyebilmek için DM olmalısın");
        if (oyunBotlari(g).length >= RPG_BOT_SINIRI) throw hata("failed_precondition", `Bir oyunda en çok ${RPG_BOT_SINIRI} bot olabilir`);
        const ad = String(m.ad || "").replace(/\s+/g, " ").trim().slice(0, 30) || "Bot " + (oyunBotlari(g).length + 1);
        const id = "bot-" + rid(5), n = oyunBotlari(g).length;
        store.set("_sys/users/" + id, { name: "🤖 " + ad, color: BOT_RENK[n % BOT_RENK.length], bot: true, oyun: gid, created: Date.now(), ekleyen: c.uid });
        store.set("games/" + gid, { ...g, players: { ...(g.players || {}), [id]: { joined: Date.now(), charId: null, bot: true } }, updated: Date.now() });
        return { id };
      }
      case "oyunBotCikar": {
        if (!dmMi(g, c.uid) && !yonetici(c)) throw hata("permission_denied", "Botu yalnızca DM çıkarabilir");
        const id = oyunBotu(g, m);
        store.set("games/" + gid, { ...g, players: { ...g.players, [id]: null }, updated: Date.now() });
        return true;
      }
      case "oyunBotKonus": case "oyunBotZar": {
        if (!yonetici(c) && !dmMi(g, c.uid)) throw hata("permission_denied", "Botları yalnızca admin ve test hesapları (ya da oyunun DM'i) konuşturabilir");
        const id = oyunBotu(g, m);
        if (m.op === "oyunBotKonus") {
          const text = String(m.text || "").replace(/\r\n?/g, "\n").trim().slice(0, 1000);
          if (!text) throw hata("invalid_argument", "Boş mesaj");
          return sohbeteYaz(gid, id, text);
        }
        return zarYaz(gid, id, m.formul, m.etiket);
      }
    }
    throw hata("unknown_op", "Bilinmeyen işlem");
  }

  function zarYaz(gid, botId, formul, etiket) {
    const r = zarAt(formul), t = Date.now();
    const entry = { id: "l" + t.toString(36) + rid(3), t, label: String(etiket || "").slice(0, 60) || r.ifade, expr: r.ifade, total: r.toplam, detail: r.detay, crit: r.kritik, by: botId, bot: true };
    store.set(`games/${gid}/rolls/${entry.id}`, entry);
    return { id: entry.id, total: r.toplam, detail: r.detay };
  }

  // Sohbette bir bot anıldıysa yanıt ver: "@Ad 1d20+2" zar atar; yapay zekâ açıksa karakterine uygun kısa bir yanıt yazar.
  const sonYanit = new Map();
  function sohbetGeldi(gid, msg) {
    if (!msg || !msg.text || msg.to || BOT_ID.test(String(msg.by))) return;
    const g = store.get("games/" + gid); if (!g) return;
    const metin = msg.text.toLocaleLowerCase("tr");
    for (const id of oyunBotlari(g)) {
      const u = store.get("_sys/users/" + id) || {}, ad = String(u.name || "").replace(/^🤖\s*/, "").toLocaleLowerCase("tr");
      if (!ad || !(metin.includes("@" + ad) || metin.includes("@" + ad.split(" ")[0]))) continue;
      const now = Date.now(); if (now - (sonYanit.get(id) || 0) < 4000) continue; sonYanit.set(id, now);
      const zar = /(?:^|\s)(\d*d(?:\d+|%)(?:k[hl]\d+)?(?:[+-]\d+)*)\b/i.exec(msg.text);
      if (zar) { try { zarYaz(gid, id, zar[1], "Bot zarı"); } catch (e) {} continue; }
      if (!yapayZeka) continue;
      const p = g.players[id] || {}, ch = p.charId && store.get(`games/${gid}/chars/${p.charId}`);
      const gecmis = store.list("chat/" + gid).map(d => d.data).filter(Boolean).sort((a, b) => a.t - b.t).slice(-12)
        .map(x => `${((store.get("_sys/users/" + x.by) || {}).name || "Biri").replace(/^🤖\s*/, "")}: ${x.text}`).join("\n");
      const karakter = ch ? JSON.stringify({ ad: ch.name, sinif: ch.cls || ch.class, irk: ch.race, seviye: ch.level, kisilik: ch.personality || ch.traits, gecmis: ch.background, notlar: String(ch.notes || "").slice(0, 600) }) : "(karakter atanmamış)";
      const istek = `Bir masaüstü rol yapma oyununda "${ad}" adlı oyuncu karakterisin (bir bot). Karakter bilgisi: ${karakter}\n\nSon sohbet:\n${gecmis}\n\nSana hitap edildi. Karakterine uygun, Türkçe, en çok 2-3 cümlelik bir yanıt yaz. Oyun yöneticisinin (DM) yerine karar verme, sonuç uydurma; yalnızca karakterinin ne söylediğini ya da ne yapmak istediğini yaz. Yalnızca yanıt metnini ver.`;
      yapayZeka(istek).then(t => { t = String(t || "").trim().slice(0, 1000); if (t && store.get("games/" + gid)) sohbeteYaz(gid, id, t); }).catch(e => console.error("[bot ai]", e.message || e));
    }
  }

  function kapat() { for (const t of zamanlayici.values()) clearTimeout(t); zamanlayici.clear(); }
  return { OPS, op, kartBotKisi, sohbetGeldi, kapat };
}

module.exports = { kurBotlar, zarAt, BOT_ID };
