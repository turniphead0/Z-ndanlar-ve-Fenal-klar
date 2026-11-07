/* Masa oyunları: kurallar. Hem tarayıcıda (window.ZM_OYUNLAR) hem sunucuda (require) çalışır.
   Sunucu bir hamleyi kabul etmeden önce burada üretilen yasal hamleler listesinde olup olmadığına bakar,
   böylece kimse kuralları atlayamaz.

   Her oyun aynı biçimi uygular:
     yeni(rng)              → başlangıç durumu (düz JSON)
     hamleler(durum)        → sıradaki oyuncunun yasal hamleleri; her hamle bir "kare anahtarları" dizisidir
     uygula(durum, hamle, rng) → yeni durum (hamlenin yasal olduğu varsayılır)
   Ortak alanlar: durum.sira (0 ya da 1), durum.bitti (null ya da { kazanan: 0|1|null, neden }), durum.son (son hamle).
   Arayüz hamleyi tıklanan karelerden kurar: tıklananlar bir hamlenin başına uyduğu sürece devam eder,
   tam bir hamleye denk gelince gönderir. Böylece taş koyma, taş sürme, çoklu alma ve "değirmen kurunca taş al"
   hepsi aynı tıklama mantığıyla oynanır. */
(function (root) {
  "use strict";
  const kopya = v => JSON.parse(JSON.stringify(v));
  const ayni = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

  /* ------------------------------------------------------------------ Mangala
     Türk mangalası: iki sıra altışar kuyu, her kuyuda 4 taş, iki hazine.
     Kareler: 0–5 birinci oyuncunun kuyuları, 6 hazinesi; 7–12 ikinci oyuncunun kuyuları, 13 hazinesi. */
  const MANGALA = {
    ad: "Mangala",
    kisa: "Türk mangalası: taşları dağıt, hazineni doldur.",
    kurallar: [
      "Sıra sendeyse kendi tarafındaki dolu bir kuyuyu seç. Kuyudaki bütün taşları alırsın; ilk taşı aldığın kuyuya bırakıp kalanları saatin tersi yönünde birer birer dağıtırsın (kuyuda tek taş varsa doğrudan yandaki kuyuya geçer).",
      "Kendi hazinene taş bırakırsın, rakibin hazinesini atlarsın.",
      "Son taş kendi hazinene düşerse bir kez daha oynarsın.",
      "Son taş rakibin kuyusundaki taş sayısını çift yaparsa o kuyudaki bütün taşları alırsın.",
      "Son taş kendi tarafındaki boş bir kuyuya düşerse ve karşısındaki kuyu doluysa iki kuyudaki taşların hepsini alırsın.",
      "Bir oyuncunun tarafındaki kuyular boşalınca oyun biter: tarafını ilk boşaltan, rakibin tarafında kalan taşları da alır. Hazinesinde çok taş olan kazanır.",
    ],
    yeni() {
      const a = Array(14).fill(4); a[6] = 0; a[13] = 0;
      return { a, sira: 0, bitti: null, son: null, n: 0 };
    },
    hazine: p => (p === 0 ? 6 : 13),
    kuyular: p => (p === 0 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12]),
    hamleler(d) {
      if (d.bitti) return [];
      return MANGALA.kuyular(d.sira).filter(i => d.a[i] > 0).map(i => [i]);
    },
    uygula(d0, [i]) {
      const d = kopya(d0), a = d.a, p = d.sira, q = 1 - p;
      const hz = MANGALA.hazine(p), rakipHz = MANGALA.hazine(q);
      const sonraki = k => { k = (k + 1) % 14; return k === rakipHz ? (k + 1) % 14 : k; };
      let n = a[i], k = i; a[i] = 0;
      if (n === 1) { k = sonraki(k); a[k]++; }
      else { a[i] = 1; n--; while (n--) { k = sonraki(k); a[k]++; } }
      let tekrar = false;
      const kendi = MANGALA.kuyular(p), rakip = MANGALA.kuyular(q);
      if (k === hz) tekrar = true;
      else if (rakip.includes(k) && a[k] % 2 === 0) { a[hz] += a[k]; a[k] = 0; }
      else if (kendi.includes(k) && a[k] === 1 && a[12 - k] > 0) { a[hz] += a[k] + a[12 - k]; a[k] = 0; a[12 - k] = 0; }
      d.son = [i]; d.n++;
      const bos = s => MANGALA.kuyular(s).every(j => a[j] === 0);
      if (bos(p) || bos(q)) {
        // Tarafını boşaltan, öbür taraftaki taşları alır.
        const alan = bos(p) ? p : q, veren = 1 - alan;
        for (const j of MANGALA.kuyular(veren)) { a[MANGALA.hazine(alan)] += a[j]; a[j] = 0; }
        const x = a[6], y = a[13];
        d.bitti = { kazanan: x > y ? 0 : y > x ? 1 : null, neden: `${x}–${y}` };
        return d;
      }
      if (!tekrar) d.sira = q;
      return d;
    },
  };

  /* ------------------------------------------------------------------ Türk daması
     8×8, kareler 0–63 (satır*8 + sütun; 0. satır üstte). Birinci oyuncu (beyaz) altta, yukarı yürür.
     Taş değerleri: 0 boş, 1 beyaz taş, 2 beyaz dama, 3 siyah taş, 4 siyah dama. */
  const sahip = v => (v === 0 ? -1 : v <= 2 ? 0 : 1);
  const damaMi = v => v === 2 || v === 4;
  const YONLER = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const DAMA = {
    ad: "Türk daması",
    kisa: "Taşlar düz ve yana yürür, alma zorunludur.",
    kurallar: [
      "Taşlar bir kare ileri ya da yana yürür; geri gidemez, çapraz hareket yoktur.",
      "Rakip taşın hemen arkasındaki kare boşsa üstünden atlayıp alırsın. Alabiliyorsan almak zorundasın ve en çok taşı alan yolu seçmelisin. Alınan taş hemen kalkar.",
      "Taşın son sıraya ulaşırsa dama olur: dört yöne istediği kadar kare gider, uzaktaki bir taşı da üstünden atlayarak alabilir (art arda alırken geldiği yöne dönemez).",
      "Rakibinin taşı kalmazsa ya da oynayacak hamlesi kalmazsa kazanırsın. İki tek dama kalırsa berabere.",
      "Çoklu almada atlayacağın kareleri sırayla tıkla.",
    ],
    yeni() {
      const b = Array(64).fill(0);
      for (let c = 0; c < 8; c++) { b[8 + c] = 3; b[16 + c] = 3; b[40 + c] = 1; b[48 + c] = 1; }
      return { b, sira: 0, bitti: null, son: null, n: 0, sessiz: 0 };
    },
    // Bir taşın yapabileceği bütün en uzun alma yolları: [[başlangıç, iniş1, iniş2…], alınanlar]
    almalar(b, from, p) {
      const kral = damaMi(b[from]), ileri = p === 0 ? -1 : 1, out = [];
      const yonler = kral ? YONLER : YONLER.filter(([dr]) => dr !== -ileri);
      const ara = (b, pos, yol, onceki) => {
        let devam = false;
        const r = Math.floor(pos / 8), c = pos % 8;
        for (const [dr, dc] of yonler) {
          if (onceki && dr === -onceki[0] && dc === -onceki[1]) continue; // geldiği yöne dönemez
          let rr = r + dr, cc = c + dc;
          if (kral) while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === 0) { rr += dr; cc += dc; }
          if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
          const ortaK = rr * 8 + cc;
          if (sahip(b[ortaK]) !== 1 - p) continue;
          let lr = rr + dr, lc = cc + dc;
          while (lr >= 0 && lr < 8 && lc >= 0 && lc < 8 && b[lr * 8 + lc] === 0) {
            const inis = lr * 8 + lc, nb = b.slice();
            nb[inis] = nb[pos]; nb[pos] = 0; nb[ortaK] = 0;
            devam = true;
            ara(nb, inis, yol.concat(inis), [dr, dc]);
            if (!kral) break;
            lr += dr; lc += dc;
          }
        }
        if (!devam && yol.length > 1) out.push(yol);
      };
      ara(b, from, [from], null);
      return out;
    },
    hamleler(d) {
      if (d.bitti) return [];
      const b = d.b, p = d.sira, ileri = p === 0 ? -1 : 1;
      let al = [];
      for (let i = 0; i < 64; i++) if (sahip(b[i]) === p) al = al.concat(DAMA.almalar(b, i, p));
      if (al.length) { const enCok = Math.max(...al.map(y => y.length)); return al.filter(y => y.length === enCok); }
      const out = [];
      for (let i = 0; i < 64; i++) {
        if (sahip(b[i]) !== p) continue;
        const r = Math.floor(i / 8), c = i % 8, kral = damaMi(b[i]);
        for (const [dr, dc] of YONLER) {
          if (!kral && dr === -ileri) continue;
          let rr = r + dr, cc = c + dc;
          while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === 0) {
            out.push([i, rr * 8 + cc]);
            if (!kral) break;
            rr += dr; cc += dc;
          }
        }
      }
      return out;
    },
    uygula(d0, yol) {
      const d = kopya(d0), b = d.b, p = d.sira;
      let alindi = 0;
      for (let k = 1; k < yol.length; k++) {
        const a = yol[k - 1], z = yol[k];
        const dr = Math.sign(Math.floor(z / 8) - Math.floor(a / 8)), dc = Math.sign((z % 8) - (a % 8));
        let x = a + dr * 8 + dc;
        while (x !== z) { if (b[x] !== 0) { b[x] = 0; alindi++; } x += dr * 8 + dc; }
        b[z] = b[a]; b[a] = 0;
      }
      const son = yol[yol.length - 1], sonSira = p === 0 ? 0 : 7;
      if (!damaMi(b[son]) && Math.floor(son / 8) === sonSira) b[son] = p === 0 ? 2 : 4;
      d.son = yol; d.n++;
      d.sessiz = alindi ? 0 : d.sessiz + 1;
      d.sira = 1 - p;
      const taslar = s => b.filter(v => sahip(v) === s);
      const benim = taslar(p), onun = taslar(1 - p);
      if (!onun.length) d.bitti = { kazanan: p, neden: "Rakibin taşı kalmadı" };
      else if (!DAMA.hamleler(d).length) d.bitti = { kazanan: p, neden: "Rakibin hamlesi kalmadı" };
      else if (benim.length === 1 && onun.length === 1 && damaMi(benim[0]) && damaMi(onun[0])) d.bitti = { kazanan: null, neden: "İki tek dama" };
      else if (d.sessiz >= 80) d.bitti = { kazanan: null, neden: "40 tur boyunca taş alınmadı" };
      return d;
    },
  };

  /* ------------------------------------------------------------------ Dokuz taş
     Değirmen (Nine Men's Morris). 24 nokta; koordinatlar 7×7 ızgarada. */
  const DT_XY = [[0,0],[3,0],[6,0],[1,1],[3,1],[5,1],[2,2],[3,2],[4,2],[0,3],[1,3],[2,3],[4,3],[5,3],[6,3],[2,4],[3,4],[4,4],[1,5],[3,5],[5,5],[0,6],[3,6],[6,6]];
  const DT_KOMSU = [[1,9],[0,2,4],[1,14],[4,10],[1,3,5,7],[4,13],[7,11],[4,6,8],[7,12],[0,10,21],[3,9,11,18],[6,10,15],[8,13,17],[5,12,14,20],[2,13,23],[11,16],[15,17,19],[12,16],[10,19],[16,18,20,22],[13,19],[9,22],[19,21,23],[14,22]];
  const DT_DIZI = [[0,1,2],[3,4,5],[6,7,8],[9,10,11],[12,13,14],[15,16,17],[18,19,20],[21,22,23],[0,9,21],[3,10,18],[6,11,15],[1,4,7],[16,19,22],[8,12,17],[5,13,20],[2,14,23]];
  const degirmende = (b, i) => b[i] >= 0 && DT_DIZI.some(m => m.includes(i) && m.every(j => b[j] === b[i]));
  const DOKUZTAS = {
    ad: "Dokuz taş",
    kisa: "Üç taşı bir hizaya getir, rakibin taşını al.",
    xy: DT_XY, komsu: DT_KOMSU,
    kurallar: [
      "Önce sırayla dokuzar taşı boş noktalara koyarsınız. Sonra taşlar çizgi boyunca komşu boş noktaya kayar.",
      "Bir çizgi üzerinde üç taşını yan yana getirirsen (değirmen) rakibin bir taşını alırsın; önce koyacağın/süreceğin yeri, sonra alacağın taşı tıkla. Değirmendeki taşlar, başka taş yoksa alınabilir.",
      "Üç taşın kalınca uçarsın: taşını herhangi bir boş noktaya götürebilirsin.",
      "Rakibinin taşı ikiye düşerse ya da hiç hamlesi kalmazsa kazanırsın.",
    ],
    yeni() { return { b: Array(24).fill(-1), elde: [9, 9], sira: 0, bitti: null, son: null, n: 0 }; },
    hamleler(d) {
      if (d.bitti) return [];
      const b = d.b, p = d.sira, q = 1 - p, out = [];
      const alinabilir = bb => {
        const onun = bb.map((v, i) => (v === q ? i : -1)).filter(i => i >= 0);
        const serbest = onun.filter(i => !degirmende(bb, i));
        return serbest.length ? serbest : onun;
      };
      const ekle = (bb, hedef, bas) => {
        if (degirmende(bb, hedef)) for (const r of alinabilir(bb)) out.push(bas.concat(r));
        else out.push(bas);
      };
      if (d.elde[p] > 0) {
        for (let i = 0; i < 24; i++) if (b[i] < 0) { const bb = b.slice(); bb[i] = p; ekle(bb, i, [i]); }
        return out;
      }
      const ucar = b.filter(v => v === p).length === 3;
      for (let f = 0; f < 24; f++) {
        if (b[f] !== p) continue;
        const hedefler = ucar ? b.map((v, i) => (v < 0 ? i : -1)).filter(i => i >= 0) : DT_KOMSU[f].filter(i => b[i] < 0);
        for (const t of hedefler) { const bb = b.slice(); bb[f] = -1; bb[t] = p; ekle(bb, t, [f, t]); }
      }
      return out;
    },
    uygula(d0, h) {
      const d = kopya(d0), b = d.b, p = d.sira, q = 1 - p;
      const koyma = d.elde[p] > 0;
      if (koyma) { b[h[0]] = p; d.elde[p]--; if (h.length > 1) b[h[1]] = -1; }
      else { b[h[0]] = -1; b[h[1]] = p; if (h.length > 2) b[h[2]] = -1; }
      d.son = h; d.n++; d.sira = q;
      const sayi = s => b.filter(v => v === s).length + d.elde[s];
      if (sayi(q) < 3) d.bitti = { kazanan: p, neden: "Rakibin iki taşı kaldı" };
      else if (!DOKUZTAS.hamleler(d).length) d.bitti = { kazanan: p, neden: "Rakibin hamlesi kalmadı" };
      else if (d.n >= 300) d.bitti = { kazanan: null, neden: "Hamle sınırı" };
      return d;
    },
  };

  /* ------------------------------------------------------------------ Ur
     Ur Kraliyet Oyunu (Irving Finkel'in kurallarıyla). 3×8 tahta; 4 dörtyüzlü zar (her biri 0 ya da 1).
     Kare anahtarları: satır*8 + sütun; 100+oyuncu = taş havuzu, 200+oyuncu = çıkış. */
  const UR_ROZET = [4, 8, 14];
  const urKare = (p, k) => {
    const kendi = p === 0 ? 2 : 0;
    if (k <= 4) return kendi * 8 + (4 - k);
    if (k <= 12) return 8 + (k - 5);
    return kendi * 8 + (7 - (k - 13));
  };
  const UR = {
    ad: "Ur Kraliyet Oyunu",
    kisa: "4500 yıllık zar ve yarış oyunu.",
    kare: urKare, rozetler: [0, 6, 11, 16, 22], yok: [4, 5, 20, 21], // ekran için: çiçekli ve olmayan kareler
    kurallar: [
      "Her oyuncunun 7 taşı var. Sıra sana gelince dört zar atılır; çıkan sayı (0–4) kadar bir taşını ilerletirsin. 0 gelirse sıra geçer.",
      "Yol: kendi sıranın dört karesi, ortadaki ortak sıranın sekiz karesi, sonra kendi sırana dönüp iki kare ve çıkış. Çıkış için sayının tam tutması gerekir.",
      "Çiçekli kareye (rozet) gelirsen bir kez daha oynarsın. Ortadaki rozetteki taş alınamaz.",
      "Ortak sırada rakibin taşının üstüne gelirsen onu başa gönderirsin. Kendi taşının üstüne gelemezsin.",
      "Yedi taşını önce çıkaran kazanır. Oynatacak taşın yoksa sıra geçer.",
    ],
    zarAt(d, rng) {
      // Sıra kimdeyse onun için zar atar; 0 ya da hamlesizlikte sırayı geçirir.
      for (let g = 0; g < 50 && !d.bitti; g++) {
        d.zarlar = [0, 1, 2, 3].map(() => (rng() < 0.5 ? 0 : 1));
        d.zar = d.zarlar.reduce((x, y) => x + y, 0);
        if (UR.hamleler(d).length) return d;
        d.pas = (d.pas || []).concat([{ p: d.sira, zar: d.zar }]).slice(-4);
        d.sira = 1 - d.sira;
      }
      return d;
    },
    yeni(rng = Math.random) {
      return UR.zarAt({ t: [Array(7).fill(0), Array(7).fill(0)], sira: 0, bitti: null, son: null, n: 0, zar: 0, zarlar: [0, 0, 0, 0], pas: [] }, rng);
    },
    hamleler(d) {
      if (d.bitti || !d.zar) return [];
      const p = d.sira, q = 1 - p, out = [], gorulen = new Set();
      for (const k of d.t[p]) {
        if (k === 15 || gorulen.has(k)) continue;
        gorulen.add(k);
        const z = k + d.zar;
        if (z > 15) continue;
        if (z < 15 && d.t[p].includes(z)) continue;
        if (z === 8 && d.t[q].includes(8)) continue; // ortadaki rozet güvenli
        out.push([k === 0 ? 100 + p : urKare(p, k), z === 15 ? 200 + p : urKare(p, z)]);
      }
      return out;
    },
    uygula(d0, h, rng = Math.random) {
      const d = kopya(d0), p = d.sira, q = 1 - p;
      const k = h[0] >= 100 ? 0 : [...Array(15).keys()].find(x => x > 0 && urKare(p, x) === h[0]);
      const z = k + d.zar, i = d.t[p].indexOf(k);
      d.t[p][i] = z;
      if (z >= 5 && z <= 12) { const j = d.t[q].indexOf(z); if (j >= 0) d.t[q][j] = 0; }
      d.son = h; d.n++; d.pas = [];
      if (d.t[p].every(x => x === 15)) { d.bitti = { kazanan: p, neden: "Yedi taşın hepsi çıktı" }; d.zar = 0; return d; }
      if (!UR_ROZET.includes(z)) d.sira = q;
      return UR.zarAt(d, rng);
    },
  };

  const OYUNLAR = { mangala: MANGALA, dama: DAMA, dokuztas: DOKUZTAS, ur: UR };

  // Sunucu tarafı denetim: hamle yasal mı?
  function yasal(oyun, durum, hamle) {
    const g = OYUNLAR[oyun];
    return !!g && Array.isArray(hamle) && g.hamleler(durum).some(h => ayni(h, hamle));
  }

  const api = { OYUNLAR, yasal, ayni };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZM_OYUNLAR = api;
})(typeof window !== "undefined" ? window : globalThis);
