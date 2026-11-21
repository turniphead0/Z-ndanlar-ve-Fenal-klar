// Genel arama (Ctrl+K): oyuncular, masalar (FRP masaları ve masa oyunu odaları) ve forum konuları tek kutudan.
//
// Aranan her şey zaten herkese açık belgelerde duruyor (kullanıcı adları, games/*, boards/*, forum/*); bu işlem
// yalnızca hepsini tek seferde, büyük-küçük harf ve Türkçe işaret farkı gözetmeden tarar.
"use strict";

const hata = (code, message) => Object.assign(new Error(message), { code });
const SISTEM = { dnd5e: "D&D 5e", coc7: "Call of Cthulhu", yze: "Year Zero", pf2e: "Pathfinder 2e", motw: "Monster of the Week" };
const EN_COK = { kisiler: 8, masalar: 8, konular: 8 };

// "Zından" ile "zindan" aynı sonucu versin.
const sade = s => String(s || "").toLocaleLowerCase("tr").replace(/[ıîİ]/g, "i").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g")
  .replace(/ö/g, "o").replace(/[üû]/g, "u").replace(/â/g, "a").normalize("NFD").replace(/[̀-ͯ]/g, "");

// Puan: 0 uymuyor; başlıkta/adda kelime başında geçmesi en yüksek. Bütün kelimeler bir yerde geçmeli.
function puanla(kelimeler, ad, ...diger) {
  const a = sade(ad), hepsi = a + " " + sade(diger.join(" "));
  if (!kelimeler.every(k => hepsi.includes(k))) return 0;
  let p = 1;
  for (const k of kelimeler) {
    if (a.startsWith(k)) p += 6;
    else if (a.includes(" " + k) || a.includes("-" + k) || a.includes("_" + k)) p += 4;
    else if (a.includes(k)) p += 2;
  }
  return p;
}
const ozet = (s, n = 120) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

function kurArama({ store, conns, hesap, masaOzeti, kurallar = null }) {
  const OPS = new Set(["genelAra"]);

  function ara(c, q) {
    const kelimeler = sade(q).split(/\s+/).filter(Boolean).slice(0, 8);
    if (!kelimeler.length) return { kisiler: [], masalar: [], konular: [] };
    const cevrimici = new Set(), masada = new Map();
    for (const o of conns) if (o.uid) { cevrimici.add(o.uid); if (o.presence && o.presence.g) masada.set(o.presence.g, (masada.get(o.presence.g) || 0) + 1); }
    const sirala = (l, n) => l.sort((a, b) => (b.p - a.p) || (b.t - a.t)).slice(0, n).map(({ p, t, ...x }) => x);

    // Oyuncular: hesabı olanlar (botlar ve hesapsız adlar aranmaz).
    const kisiler = [];
    for (const p of store.paths("_sys/users")) {
      const u = store.get(p); if (!u || u.bot || !u.username || u.silindi) continue;
      const pu = puanla(kelimeler, u.username, u.name || ""); if (!pu) continue;
      const id = p.slice(11);
      // Gizli profiller ve engellenen/engelleyen kişiler aramada çıkmaz (kişi aramasıyla aynı kural, server/gizlilik.js).
      if (kurallar && id !== c.uid && !kurallar.aranabilir(c, id)) continue;
      const gorur = !kurallar || kurallar.gorebilir(c, id);
      kisiler.push({ ...hesap.herkeseAcik(id, u), cevrimici: gorur && cevrimici.has(id), ben: id === c.uid, p: pu + (gorur && cevrimici.has(id) ? 1 : 0), t: u.created || 0 });
    }

    // Masalar: FRP masaları (games/*) ve masa oyunu odaları (boards/*).
    const masalar = [];
    for (const p of store.paths("games")) {
      const g = store.get(p); if (!g) continue;
      const sistem = g.system || "dnd5e";
      const pu = puanla(kelimeler, g.name || "", g.desc || "", SISTEM[sistem] || sistem); if (!pu) continue;
      const id = p.slice(6);
      masalar.push({ tur: "frp", id, ad: g.name || "Adsız oyun", aciklama: ozet(g.desc, 100), sistemAd: SISTEM[sistem] || sistem, acik: g.open !== false,
        oyuncu: Object.values(g.players || {}).filter(Boolean).length, masada: masada.get(id) || 0,
        rol: g.dms && g.dms[c.uid] ? "dm" : g.players && g.players[c.uid] ? "oyuncu" : null, p: pu, t: g.updated || g.created || 0 });
    }
    for (const p of store.paths("boards")) {
      const b = store.get(p); if (!b) continue;
      const m = masaOzeti(p.slice(7), b, c.uid);
      const pu = puanla(kelimeler, m.ad || m.oyunAd, m.oyunAd, m.oyuncular.map(o => o.ad).join(" ")); if (!pu) continue;
      masalar.push({ tur: m.tur === "kart" ? "kart" : "tahta", id: m.id, ad: m.ad || m.oyunAd, oyunAd: m.oyunAd, durum: m.durum,
        oyuncular: m.oyuncular.map(o => o.ad).slice(0, 6), p: pu - (m.durum === "bitti" ? 1 : 0), t: m.updated });
    }

    // Forum konuları (yanıtların içinde de aranır).
    const konular = [];
    for (const p of store.paths("forum")) {
      const t = store.get(p); if (!t) continue;
      let pu = puanla(kelimeler, t.baslik, t.govde, t.kategori, (t.yazar && t.yazar.name) || "");
      if (!pu && t.yanit) {
        for (const yp of store.paths(p + "/yanitlar")) { const y = store.get(yp); if (y && puanla(kelimeler, "", y.govde)) { pu = 1; break; } }
      }
      if (!pu) continue;
      konular.push({ id: p.slice(6), baslik: t.baslik, kategori: t.kategori || "Genel sohbet", yanit: t.yanit || 0, yazar: (t.yazar && t.yazar.name) || "",
        ozet: ozet(t.govde), sabit: !!t.sabit, updated: t.updated || t.created || 0, p: pu + (t.sabit ? 1 : 0), t: t.updated || t.created || 0 });
    }
    return { kisiler: sirala(kisiler, EN_COK.kisiler), masalar: sirala(masalar, EN_COK.masalar), konular: sirala(konular, EN_COK.konular) };
  }

  function op(c, m) {
    switch (m.op) {
      case "genelAra": {
        const q = String(m.q || "").slice(0, 80);
        // Art arda çok hızlı aramayı yavaşlat (kutuya yazdıkça arama yapılır; istemci zaten bekletir).
        const now = Date.now(); c.araT = (c.araT || []).filter(t => now - t < 2000);
        if (c.araT.length >= 12) throw hata("rate_limited", "Biraz yavaş: çok hızlı arıyorsun");
        c.araT.push(now);
        return ara(c, q);
      }
    }
    throw hata("unknown_op", "Bilinmeyen işlem");
  }
  return { OPS, op, ara, sade };
}

module.exports = { kurArama, sade };
