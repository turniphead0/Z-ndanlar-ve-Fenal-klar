/* Masa oyunu botları: tahta oyunları (kurallar.js) için hamle seçici ve kart masaları için genel bir tur oynatıcı.
   Hem tarayıcıda (window.ZM_BOT) hem sunucuda (require) çalışır. Botu sunucu oynatır; tarayıcı yalnızca
   zorluk adlarını ve "bot ne yapardı" ipucunu kullanır.

   Zorluklar:
     kolay  çoğunlukla rastgele, arada iyi bir hamle
     orta   en umut verici birkaç hamle için rakibin en iyi yanıtına bakar
     zor    daha çok hamleyi rakibin en iyi yanıtıyla birlikte tartar (iki adım) */
(function (root) {
  "use strict";
  const K = typeof module === "object" && module.exports ? require("./kurallar") : root.ZM_OYUNLAR;
  const ZORLUK = { kolay: "Kolay", orta: "Orta", zor: "Zor" };

  // Değerlendirme: p oyuncusu için ne kadar iyi (büyük = iyi). Oyun bittiyse kazanana çok büyük puan.
  const say = (a, f) => a.reduce((n, v, i) => n + (f(v, i) ? 1 : 0), 0);
  const DEGER = {
    mangala(d, p) {
      const hz = s => (s === 0 ? 6 : 13), kuyu = s => (s === 0 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12]);
      const top = s => kuyu(s).reduce((n, i) => n + d.a[i], 0);
      return (d.a[hz(p)] - d.a[hz(1 - p)]) * 10 + (top(p) - top(1 - p)) + (d.sira === p ? 3 : 0);
    },
    dama(d, p) {
      let s = 0;
      d.b.forEach((v, i) => {
        if (!v) return;
        const sahip = v <= 2 ? 0 : 1, dama = v === 2 || v === 4, r = Math.floor(i / 8);
        const ilerleme = sahip === 0 ? 7 - r : r; // dama olmaya ne kadar yakın
        const deger = dama ? 34 : 10 + ilerleme * 0.5;
        s += sahip === p ? deger : -deger;
      });
      return s;
    },
    dokuztas(d, p) {
      const q = 1 - p, tas = s => say(d.b, v => v === s) + d.elde[s];
      const hareket = s => (d.elde[s] > 0 ? 0 : say(d.b, (v, i) => v === s && K.OYUNLAR.dokuztas.komsu[i].some(j => d.b[j] < 0)));
      return (tas(p) - tas(q)) * 20 + (hareket(p) - hareket(q));
    },
    ur(d, p) {
      const q = 1 - p, yol = s => d.t[s].reduce((n, k) => n + (k === 15 ? 22 : k), 0);
      const guvenli = s => say(d.t[s], k => k === 4 || k === 8 || k === 14 || k < 5 || k > 12);
      return (yol(p) - yol(q)) * 2 + (guvenli(p) - guvenli(q)) + (d.sira === p ? 4 : 0);
    },
    hnefatafl(d, p) {
      const N = 11, b = d.b, kral = b.indexOf(3), kr = Math.floor(kral / N), kc = kral % N;
      const kose = Math.min(kr + kc, kr + (N - 1 - kc), N - 1 - kr + kc, 2 * (N - 1) - kr - kc);
      const yanlar = [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([a, c]) => [kr + a, kc + c]).filter(([r, c]) => r >= 0 && c >= 0 && r < N && c < N);
      const kusatma = yanlar.filter(([r, c]) => b[r * N + c] === 1).length;
      // Kralın köşeye açık yolu var mı (aynı satır ya da sütunda engelsiz kenar)
      let kacis = 0;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        let r = kr + dr, c = kc + dc, acik = true;
        while (r >= 0 && c >= 0 && r < N && c < N) { if (b[r * N + c]) { acik = false; break; } r += dr; c += dc; }
        if (acik) kacis++;
      }
      const savunan = say(b, v => v === 2 || v === 3), saldiran = say(b, v => v === 1);
      const s = (savunan * 3 - saldiran * 1.5) - kose * 2 + kacis * 8 - kusatma * 6; // savunanlara göre
      return p === 1 ? s : -s;
    },
  };

  function puan(oyun, d, p) {
    if (d.bitti) return d.bitti.kazanan == null ? 0 : d.bitti.kazanan === p ? 1e6 - d.n : -1e6 + d.n;
    const f = DEGER[oyun];
    return f ? f(d, p) : 0;
  }

  // Tekrarlanabilir rastgelelik (Ur'daki zar gibi uygula içindeki rastgele adımlar için).
  function tohum(n) { let s = n >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }

  // Tahta oyununda hamle seç. Hamle yoksa null.
  function hamleSec(oyun, d, zorluk, rng) {
    rng = rng || Math.random;
    const g = K.OYUNLAR[oyun]; if (!g) return null;
    const hs = g.hamleler(d); if (!hs.length) return null;
    if (hs.length === 1) return hs[0];
    const p = d.sira, ted = tohum(d.n * 7919 + 17);
    if (zorluk === "kolay" && rng() < 0.65) return hs[Math.floor(rng() * hs.length)];
    const sonra = h => g.uygula(d, h, ted);
    const bir = hs.map(h => { const d2 = sonra(h); return { h, d2, s: puan(oyun, d2, p) }; });
    if (zorluk !== "kolay") {
      bir.sort((a, b) => b.s - a.s);
      const aday = bir.slice(0, zorluk === "orta" ? 5 : oyun === "hnefatafl" ? 10 : 16);
      for (const a of aday) {
        if (a.d2.bitti) continue;
        const yan = g.hamleler(a.d2).slice(0, oyun === "hnefatafl" ? 60 : 200);
        if (!yan.length) continue;
        const ss = yan.map(h => puan(oyun, g.uygula(a.d2, h, ted), p));
        // Sıra yine bendeyse (Mangala'da son taş hazineye, Ur'da rozet) en iyisini, değilse rakibin en iyisini (bana en kötüsünü) say.
        a.s = a.d2.sira === p ? Math.max(...ss) : Math.min(...ss);
      }
      bir.length = 0; bir.push(...aday);
    }
    const enIyi = Math.max(...bir.map(x => x.s));
    const iyiler = bir.filter(x => x.s >= enIyi - (zorluk === "kolay" ? 8 : 0.001));
    return iyiler[Math.floor(rng() * iyiler.length)].h;
  }

  /* ---------------- Kart masası: genel tur ----------------
     Kart masasında kurallar uygulanmaz, bu yüzden bot genel bir tur oynar: ana destelerden birinden bir kart çeker,
     elinden bir kartı oynar (oyunun ıskartasına ya da masaya açık), sonra sırayı sıradaki oyuncuya verir.
     Admin ve test hesapları botun yerine kendileri de oynayabilir (botun elini görüp her işlemi yaparak). */
  function kartTuru(d, botId, rng) {
    rng = rng || Math.random;
    const islemler = [];
    const anaDesteler = Object.entries(d.desteler).filter(([, p]) => !p.iskarta && p.kart.length);
    const el = d.el[botId] || [];
    if (anaDesteler.length && (el.length < 7 || rng() < 0.3)) {
      // Elindeki kartların destesinden çekmeyi yeğle (oyunun "el destesi"), yoksa rastgele bir deste.
      const elDeste = new Set(el.map(iid => d.kartlar[iid].d));
      const tercih = anaDesteler.filter(([, p]) => elDeste.has(p.d));
      const [pid] = (tercih.length ? tercih : anaDesteler)[Math.floor(rng() * (tercih.length || anaDesteler.length))];
      islemler.push({ tur: "cek", deste: pid, nereye: "el" });
    }
    islemler.push({ oyna: true });
    // Sıra: bir sonraki dolu koltuk.
    const n = d.koltuk.length; let s = d.sira;
    for (let i = 1; i <= n; i++) { const j = (d.sira + i) % n; if (d.koltuk[j]) { s = j; break; } }
    islemler.push({ tur: "sira", koltuk: s });
    return islemler;
  }
  // Çekilen kartlar belli olduktan sonra oynanacak kartı seç.
  function kartOyna(d, botId, rng) {
    rng = rng || Math.random;
    const el = d.el[botId] || [];
    if (!el.length) return null;
    const iid = el[Math.floor(rng() * el.length)], c = d.kartlar[iid];
    const iskarta = Object.entries(d.desteler).find(([, p]) => p.iskarta && p.d === c.d);
    if (iskarta) return { tur: "koy", kart: iid, nereye: "deste", deste: iskarta[0] };
    return { tur: "koy", kart: iid, nereye: "masa", acik: true, x: 640 + Math.floor(rng() * 320), y: 430 + Math.floor(rng() * 140) };
  }

  const api = { ZORLUK, hamleSec, puan, kartTuru, kartOyna };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZM_BOT = api;
})(typeof window !== "undefined" ? window : globalThis);
