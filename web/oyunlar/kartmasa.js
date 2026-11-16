/* Kart ve taş masası: kartlı, desteli, taşlı, gizli elli masa oyunları için ortak motor.
   Hem tarayıcıda (window.ZM_KARTMASA) hem sunucuda (require) çalışır.

   Bir oyun bir "tanım"dır (düz JSON): desteler ve kartları, taşlar, oyuncu sayaçları, masadaki alanlar,
   kurallar metni ve kurulum adımları. Kurallar uygulanmaz: masadaki gibi oyuncular uygular.
   Motor yalnızca kartları dağıtır, karıştırır, taşır ve gizliliği korur:
     - eldeki kartları yalnızca sahibi görür,
     - kapalı kartları yalnızca "bakan" kişiler görür (gor listesi),
     - destelerin sırası kimseye gönderilmez.
   Sunucu tam durumu saklar; her oyuncuya gorunum(durum, kisi) ile yalnızca görebileceğini yollar. */
(function (root) {
  "use strict";

  const MASA_G = 1600, MASA_H = 1000;
  const SINIR = { deste: 24, kart: 200, toplamKart: 700, tas: 40, toplamTas: 300, sayac: 8, alan: 24, kurulum: 40, oyuncu: 10 };
  const RENKLER = ["#c0392b", "#2980b9", "#27ae60", "#d4880f", "#8e44ad", "#16a085", "#d35400", "#7f8c8d", "#2c3e50", "#e84393"];
  const SEKILLER = ["daire", "kare", "yildiz", "ucgen", "altigen", "piyon"];

  const yazi = (v, n) => String(v == null ? "" : v).replace(/\r\n?/g, "\n").slice(0, n).trim();
  const tek = (v, n) => yazi(v, n).replace(/\s+/g, " ");
  const sayi = (v, a, b, d) => { v = Math.round(Number(v)); return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };
  const kimlik = (v, d) => { const s = String(v || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32); return s || d; };
  const renk = (v, d) => (/^#[0-9a-f]{6}$/i.test(String(v || "")) ? String(v) : d);
  // Resimler: sunucuya yüklenmiş dosyalar (/assets/…) ya da uygulamayla gelen resimler (/oyunlar/…png).
  const resim = v => { const s = String(v || ""); return /^\/assets\/[a-z0-9]+\.(gif|webp|png|jpg)$/.test(s) || /^\/oyunlar\/[a-z0-9-]+\/[a-z0-9-]+\.(png|jpg|svg)$/.test(s) ? s : null; };

  /* ---------------- Tanımı denetle ve düzelt ---------------- */
  function tanimDuzelt(t) {
    t = t && typeof t === "object" ? t : {};
    const out = {
      ad: tek(t.ad, 80) || "Adsız oyun",
      surum: tek(t.surum, 40),
      aciklama: yazi(t.aciklama, 400),
      kurallar: yazi(t.kurallar, 20000),
      oyuncu: { min: 1, max: 4 },
      masa: { renk: renk(t.masa && t.masa.renk, "#2f5d50"), resim: resim(t.masa && t.masa.resim) },
      desteler: [], taslar: [], sayaclar: [], alanlar: [], kurulum: [],
    };
    const o = t.oyuncu || {};
    out.oyuncu.max = sayi(o.max, 1, SINIR.oyuncu, 4);
    out.oyuncu.min = sayi(o.min, 1, out.oyuncu.max, 1);
    const idler = new Set();
    const yeniId = (v, on) => { let id = kimlik(v, on), i = 2; while (idler.has(id)) id = kimlik(v, on) + "-" + i++; idler.add(id); return id; };
    let toplam = 0;
    for (const d of (Array.isArray(t.desteler) ? t.desteler : []).slice(0, SINIR.deste)) {
      const a = d.arka || {}, i = d.iskarta;
      const deste = {
        id: yeniId(d.id, "deste"), ad: tek(d.ad, 60) || "Deste",
        w: sayi(d.w, 40, 400, 100), h: sayi(d.h, 40, 400, 150),
        x: sayi(d.x, 0, MASA_G, 1300), y: sayi(d.y, 0, MASA_H, 120),
        karistir: d.karistir !== false,
        arka: { resim: resim(a.resim), renk: renk(a.renk, "#34495e"), yazi: tek(a.yazi, 30) },
        iskarta: i ? { ad: tek(i.ad, 60) || "Iskarta", x: sayi(i.x, 0, MASA_G, 1450), y: sayi(i.y, 0, MASA_H, 120), acik: i.acik !== false } : null,
        kartlar: [],
      };
      const kidler = new Set();
      for (const k of (Array.isArray(d.kartlar) ? d.kartlar : []).slice(0, SINIR.kart)) {
        let id = kimlik(k.id, "kart"), n = 2; while (kidler.has(id)) id = kimlik(k.id, "kart") + "-" + n++; kidler.add(id);
        const adet = sayi(k.adet, 0, 60, 1);
        if (toplam + adet > SINIR.toplamKart) break;
        toplam += adet;
        deste.kartlar.push({ id, ad: tek(k.ad, 60), metin: yazi(k.metin, 600), resim: resim(k.resim), simge: resim(k.simge), renk: renk(k.renk, null), adet, not: yazi(k.not, 300) });
      }
      out.desteler.push(deste);
    }
    let tasToplam = 0;
    for (const s of (Array.isArray(t.taslar) ? t.taslar : []).slice(0, SINIR.tas)) {
      const adet = sayi(s.adet, 0, 60, 1), her = !!s.herOyuncu;
      tasToplam += adet * (her ? out.oyuncu.max : 1); if (tasToplam > SINIR.toplamTas) break;
      out.taslar.push({ id: yeniId(s.id, "tas"), ad: tek(s.ad, 40) || "Taş", sekil: SEKILLER.includes(s.sekil) ? s.sekil : "daire",
        renk: s.renk === "oyuncu" ? "oyuncu" : renk(s.renk, "#d4880f"), resim: resim(s.resim), boy: sayi(s.boy, 16, 200, 40), adet, herOyuncu: her,
        x: sayi(s.x, 0, MASA_G, 100), y: sayi(s.y, 0, MASA_H, 900) });
    }
    for (const s of (Array.isArray(t.sayaclar) ? t.sayaclar : []).slice(0, SINIR.sayac))
      out.sayaclar.push({ id: yeniId(s.id, "sayac"), ad: tek(s.ad, 30) || "Sayaç", baslangic: sayi(s.baslangic, -999, 9999, 0), min: sayi(s.min, -999, 9999, -999), max: sayi(s.max, -999, 9999, 9999) });
    for (const a of (Array.isArray(t.alanlar) ? t.alanlar : []).slice(0, SINIR.alan))
      out.alanlar.push({ ad: tek(a.ad, 40), x: sayi(a.x, 0, MASA_G, 0), y: sayi(a.y, 0, MASA_H, 0), w: sayi(a.w, 20, MASA_G, 200), h: sayi(a.h, 20, MASA_H, 200), renk: renk(a.renk, "#ffffff") });
    const desteIdleri = new Set(out.desteler.map(d => d.id));
    for (const k of (Array.isArray(t.kurulum) ? t.kurulum : []).slice(0, SINIR.kurulum)) {
      if (!desteIdleri.has(k.deste)) continue;
      if (k.islem === "dagit") out.kurulum.push({ islem: "dagit", deste: k.deste, adet: sayi(k.adet, 1, 30, 1), nereye: k.nereye === "onu" ? "onu" : "el", acik: !!k.acik, sahibiGorur: k.sahibiGorur !== false });
      else if (k.islem === "masaya") {
        const konumlar = (Array.isArray(k.konumlar) ? k.konumlar : []).slice(0, 60).map(p => [sayi(p[0], 0, MASA_G, 0), sayi(p[1], 0, MASA_H, 0), [0, 90, 180, 270].includes(p[2]) ? p[2] : 0]);
        const adet = sayi(k.adet, 1, 60, konumlar.length || 1);
        out.kurulum.push({ islem: "masaya", deste: k.deste, adet, acik: k.acik !== false, konumlar });
      }
    }
    return out;
  }

  /* ---------------- Yardımcılar ---------------- */
  function karistir(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const kartTanimi = (tanim, k) => { const [d, id] = String(k).split("/"); const deste = tanim.desteler.find(x => x.id === d); return deste && deste.kartlar.find(x => x.id === id); };
  const desteTanimi = (tanim, d) => tanim.desteler.find(x => x.id === d);
  const hata = (code, message) => Object.assign(new Error(message), { code });

  /* ---------------- Yeni masa (kurulumdan önce: lobi) ---------------- */
  function yeni(tanim) {
    return { tanim, basladi: false, koltuk: Array(tanim.oyuncu.max).fill(null), n: 0, z: 1, sira: 0,
      kartlar: {}, desteler: {}, taslar: {}, el: {}, onu: {}, sayac: {}, log: [], zar: null };
  }

  // Kurulum: desteleri kur, karıştır, kurulum adımlarını uygula, taşları ve sayaçları koy.
  function baslat(d, rng) {
    const t = d.tanim, oyuncular = d.koltuk.filter(Boolean);
    if (oyuncular.length < t.oyuncu.min) throw hata("invalid_argument", `Bu oyun en az ${t.oyuncu.min} kişiyle oynanır`);
    Object.assign(d, { basladi: true, n: d.n + 1, z: 1, kartlar: {}, desteler: {}, taslar: {}, el: {}, onu: {}, sayac: {}, zar: null });
    let ki = 0, pi = 0, ti = 0;
    for (const o of oyuncular) { d.el[o.id] = []; d.onu[o.id] = []; d.sayac[o.id] = Object.fromEntries(t.sayaclar.map(s => [s.id, s.baslangic])); }
    for (const dt of t.desteler) {
      const pid = "p" + pi++, kartlar = [];
      for (const k of dt.kartlar) for (let i = 0; i < k.adet; i++) {
        const iid = "k" + ki++;
        d.kartlar[iid] = { k: dt.id + "/" + k.id, d: dt.id, yer: "deste", p: pid, acik: false, gor: [], r: 0 };
        kartlar.push(iid);
      }
      if (dt.karistir) karistir(kartlar, rng);
      d.desteler[pid] = { d: dt.id, ad: dt.ad, x: dt.x, y: dt.y, kart: kartlar, acik: false };
      if (dt.iskarta) d.desteler["p" + pi++] = { d: dt.id, ad: dt.iskarta.ad, x: dt.iskarta.x, y: dt.iskarta.y, kart: [], acik: dt.iskarta.acik, iskarta: true };
    }
    const ana = did => Object.keys(d.desteler).find(p => d.desteler[p].d === did && !d.desteler[p].iskarta);
    for (const adim of t.kurulum) {
      const pid = ana(adim.deste), p = d.desteler[pid]; if (!p) continue;
      if (adim.islem === "dagit") {
        for (let n = 0; n < adim.adet; n++) for (const o of oyuncular) {
          const iid = p.kart.pop(); if (!iid) break;
          const c = d.kartlar[iid];
          if (adim.nereye === "el") Object.assign(c, { yer: "el", sahip: o.id, p: undefined, acik: false, gor: [] }), d.el[o.id].push(iid);
          else Object.assign(c, { yer: "onu", sahip: o.id, p: undefined, acik: adim.acik, gor: !adim.acik && adim.sahibiGorur ? [o.id] : [] }), d.onu[o.id].push(iid);
        }
      } else if (adim.islem === "masaya") {
        for (let n = 0; n < adim.adet; n++) {
          const iid = p.kart.pop(); if (!iid) break;
          const yer = adim.konumlar[n] || [p.x + 120 + (n % 8) * 30, p.y + 180 + Math.floor(n / 8) * 30, 0];
          Object.assign(d.kartlar[iid], { yer: "masa", p: undefined, x: yer[0], y: yer[1], r: yer[2] || 0, acik: adim.acik, gor: [], z: d.z++ });
        }
      }
    }
    for (const s of t.taslar) {
      const sahipler = s.herOyuncu ? oyuncular : [null];
      sahipler.forEach((o, oi) => {
        for (let i = 0; i < s.adet; i++) {
          const kol = o ? d.koltuk.indexOf(o) : -1;
          d.taslar["t" + ti++] = { t: s.id, x: Math.min(MASA_G - 20, s.x + (s.herOyuncu ? oi * (s.boy + 12) : 0) + i * 8), y: Math.min(MASA_H - 20, s.y + i * 8),
            renk: s.renk === "oyuncu" ? (o && o.renk) || RENKLER[kol % RENKLER.length] : s.renk, r: 0, z: d.z++ };
        }
      });
    }
    d.log = [];
    return d;
  }

  /* ---------------- İşlemler ---------------- */
  // Bir kartı bulunduğu yerden çıkar.
  function cikar(d, iid) {
    const c = d.kartlar[iid];
    const sil = a => { const i = a.indexOf(iid); if (i >= 0) a.splice(i, 1); };
    if (c.yer === "el") sil(d.el[c.sahip] || []);
    else if (c.yer === "onu") sil(d.onu[c.sahip] || []);
    else if (c.yer === "deste") sil(d.desteler[c.p].kart);
    Object.assign(c, { sahip: undefined, p: undefined });
  }
  const konum = (v, b, n) => sayi(v, 0, b, n);
  // Kartı yeni yerine koy: masa, el, önü ya da deste.
  function yerlestir(d, iid, h, kisi) {
    const c = d.kartlar[iid];
    const gordu = c.acik || (c.gor || []).includes(kisi) || (c.yer === "el" && c.sahip === kisi); // koyan kişi kartı biliyor muydu
    cikar(d, iid);
    const gizli = sahip => [...new Set([sahip, gordu ? kisi : null].filter(Boolean))];
    if (h.nereye === "el") { const s = h.kime || kisi; if (!d.el[s]) throw hata("invalid_argument", "Bu kişi masada oynamıyor"); Object.assign(c, { yer: "el", sahip: s, acik: false, gor: [], r: 0 }); d.el[s].push(iid); }
    else if (h.nereye === "onu") { const s = h.kime || kisi; if (!d.onu[s]) throw hata("invalid_argument", "Bu kişi masada oynamıyor"); Object.assign(c, { yer: "onu", sahip: s, acik: !!h.acik, gor: h.acik ? [] : gizli(h.sahibiGormez ? null : s), r: 0 }); d.onu[s].push(iid); }
    else if (h.nereye === "deste") {
      const p = d.desteler[h.deste]; if (!p) throw hata("invalid_argument", "Böyle bir deste yok");
      Object.assign(c, { yer: "deste", p: h.deste, acik: false, gor: [], r: 0 });
      if (h.alta) p.kart.unshift(iid); else p.kart.push(iid);
    } else Object.assign(c, { yer: "masa", x: konum(h.x, MASA_G, 800), y: konum(h.y, MASA_H, 500), acik: !!h.acik, gor: h.acik ? [] : gizli(null), r: konum(h.r, 270, 0) - konum(h.r, 270, 0) % 90, z: d.z++ });
  }

  const isim = (d, id) => { const k = d.koltuk.find(x => x && x.id === id); return k ? k.name : "Biri"; };
  const kartAdi = (d, iid, gorunur) => { const c = d.kartlar[iid]; if (!gorunur) return "bir " + (desteTanimi(d.tanim, c.d) || {}).ad + " kartı"; const k = kartTanimi(d.tanim, c.k); return "“" + ((k && k.ad) || (desteTanimi(d.tanim, c.d) || {}).ad) + "”"; };
  const yerAdi = (d, h, kisi) => h.nereye === "el" ? (h.kime && h.kime !== kisi ? isim(d, h.kime) + " oyuncusunun eline" : "eline")
    : h.nereye === "onu" ? (h.kime && h.kime !== kisi ? isim(d, h.kime) + " oyuncusunun önüne" : "önüne") + (h.acik ? " açık" : " kapalı")
    : h.nereye === "deste" ? "“" + d.desteler[h.deste].ad + "” destesine" + (h.alta ? " (alta)" : "") : "masaya" + (h.acik ? " açık" : " kapalı");

  // Bir işlemi uygular; durum yerinde değişir. Döndürdüğü metin günlüğe yazılır (null: yazılmaz).
  function uygula(d, h, kisi, rng) {
    if (!d.basladi) throw hata("failed_precondition", "Oyun henüz başlamadı");
    if (!d.el[kisi]) throw hata("permission_denied", "Masada oturmuyorsun");
    const kart = id => { const c = d.kartlar[id]; if (!c) throw hata("not_found", "Böyle bir kart yok"); return c; };
    const ben = isim(d, kisi);
    let m = null;
    switch (h.tur) {
      case "tasi": { // masadaki kartı, taşı ya da desteyi sürükle
        const x = konum(h.x, MASA_G, 0), y = konum(h.y, MASA_H, 0);
        if (d.taslar[h.id]) Object.assign(d.taslar[h.id], { x, y, z: d.z++ });
        else if (d.desteler[h.id]) Object.assign(d.desteler[h.id], { x, y });
        else { const c = kart(h.id); if (c.yer !== "masa") throw hata("invalid_argument", "Kart masada değil"); Object.assign(c, { x, y, z: d.z++ }); }
        break;
      }
      case "cek": {
        const p = d.desteler[h.deste]; if (!p) throw hata("not_found", "Böyle bir deste yok");
        const n = sayi(h.adet, 1, 20, 1); let say = 0;
        for (let i = 0; i < n && p.kart.length; i++) { const iid = p.kart[p.kart.length - 1]; yerlestir(d, iid, { ...h, x: konum(h.x, MASA_G, p.x + 130) + i * 24, y: konum(h.y, MASA_H, p.y) + i * 6 }, kisi); say++; }
        if (!say) throw hata("failed_precondition", "Deste boş");
        m = `${ben}, “${p.ad}” destesinden ${say > 1 ? say + " kart" : "bir kart"} çekip ${yerAdi(d, h, kisi)} koydu`;
        break;
      }
      case "koy": {
        const c = kart(h.kart);
        if (c.yer === "deste") throw hata("invalid_argument", "Desteden kart almak için “Çek”i kullan");
        if (c.yer === "el" && c.sahip !== kisi) throw hata("permission_denied", "Başkasının elindeki karta dokunamazsın");
        if (h.nereye === "el" && h.kime && h.kime !== kisi && c.yer !== "el") throw hata("invalid_argument", "Başkasının eline yalnızca kendi elinden kart verebilirsin");
        const gorunurdu = c.acik || (c.yer === "el" && c.sahip === kisi);
        const gorunurOlacak = h.acik && (h.nereye === "masa" || h.nereye === "onu") || (h.nereye === "deste" && d.desteler[h.deste] && d.desteler[h.deste].acik);
        const nereden = c.yer === "el" ? "elinden" : c.yer === "onu" ? (c.sahip === kisi ? "önünden" : isim(d, c.sahip) + " oyuncusunun önünden") : "masadan";
        if (c.yer === "masa" && h.nereye === "masa") { Object.assign(c, { x: konum(h.x, MASA_G, c.x), y: konum(h.y, MASA_H, c.y), z: d.z++ }); break; }
        yerlestir(d, h.kart, h, kisi);
        m = `${ben}, ${nereden} ${kartAdi(d, h.kart, gorunurdu || gorunurOlacak)} ${yerAdi(d, h, kisi)} koydu`;
        break;
      }
      case "cevir": {
        const c = kart(h.kart);
        if (c.yer !== "masa" && c.yer !== "onu") throw hata("invalid_argument", "Yalnızca masadaki ya da önündeki kartlar çevrilir");
        c.acik = !c.acik; c.gor = c.acik ? [] : c.yer === "onu" ? [c.sahip] : [];
        m = `${ben}, ${kartAdi(d, h.kart, true)} kartını ${c.acik ? "açtı" : "kapattı"}`;
        if (!c.acik) m = `${ben} bir kartı kapattı`;
        break;
      }
      case "bak": {
        const c = kart(h.kart);
        if (c.yer === "el" || c.yer === "deste") throw hata("invalid_argument", "Bu karta bakılamaz");
        if (c.acik || c.gor.includes(kisi)) return null;
        c.gor.push(kisi);
        m = `${ben}, ${c.yer === "onu" ? (c.sahip === kisi ? "önündeki" : isim(d, c.sahip) + " oyuncusunun önündeki") : "masadaki"} kapalı bir ${(desteTanimi(d.tanim, c.d) || {}).ad} kartına gizlice baktı`;
        break;
      }
      case "ust": { // destenin üstündeki karta gizlice bak (masaya çıkarmadan)
        const p = d.desteler[h.deste]; if (!p || !p.kart.length) throw hata("failed_precondition", "Deste boş");
        const c = d.kartlar[p.kart[p.kart.length - 1]]; if (!c.gor.includes(kisi)) c.gor.push(kisi);
        m = `${ben}, “${p.ad}” destesinin üstündeki karta gizlice baktı`;
        break;
      }
      case "rastgele": { // başka bir oyuncunun elinden rastgele bir kart
        const el = d.el[h.kisi]; if (!el) throw hata("invalid_argument", "Bu kişi masada oynamıyor");
        if (!el.length) throw hata("failed_precondition", "Elinde kart yok");
        const iid = el[Math.floor(rng() * el.length)];
        yerlestir(d, iid, h, kisi);
        m = `${ben}, ${isim(d, h.kisi)} oyuncusunun elinden rastgele ${kartAdi(d, iid, d.kartlar[iid].acik || (h.nereye === "deste" && d.desteler[h.deste].acik))} seçip ${yerAdi(d, h, kisi)} koydu`;
        break;
      }
      case "karistir": {
        const p = d.desteler[h.deste]; if (!p) throw hata("not_found", "Böyle bir deste yok");
        karistir(p.kart, rng); for (const iid of p.kart) d.kartlar[iid].gor = [];
        m = `${ben}, “${p.ad}” destesini karıştırdı`;
        break;
      }
      case "birlestir": { // bir desteyi (örneğin ıskartayı) başka bir destenin altına ya da üstüne koy
        const a = d.desteler[h.deste], b = d.desteler[h.hedef]; if (!a || !b || a === b) throw hata("invalid_argument", "Deste seç");
        const tasinan = a.kart.splice(0); for (const iid of tasinan) Object.assign(d.kartlar[iid], { p: h.hedef, acik: false, gor: [] });
        b.kart = h.alta ? tasinan.concat(b.kart) : b.kart.concat(tasinan);
        if (h.karistir) karistir(b.kart, rng);
        m = `${ben}, “${a.ad}” destesindeki ${tasinan.length} kartı “${b.ad}” destesine ${h.karistir ? "ekleyip karıştırdı" : "ekledi"}`;
        break;
      }
      case "dondur": {
        const o = d.taslar[h.id] || kart(h.id);
        if (o.yer && o.yer !== "masa") throw hata("invalid_argument", "Yalnızca masadaki kartlar döner");
        o.r = ((o.r || 0) + 90) % 360; o.z = d.z++;
        break;
      }
      case "sayac": {
        const s = d.tanim.sayaclar.find(x => x.id === h.id), v = d.sayac[h.kisi];
        if (!s || !v) throw hata("invalid_argument", "Böyle bir sayaç yok");
        const eski = v[s.id]; v[s.id] = sayi(h.deger, s.min, s.max, eski);
        if (eski === v[s.id]) return null;
        m = `${ben}: ${h.kisi === kisi ? "" : isim(d, h.kisi) + " · "}${s.ad} ${eski} → ${v[s.id]}`;
        break;
      }
      case "zar": {
        const yuz = sayi(h.yuz, 2, 100, 6), adet = sayi(h.adet, 1, 10, 1), at = Array.from({ length: adet }, () => 1 + Math.floor(rng() * yuz));
        d.zar = { kisi, yuz, at, t: Date.now() };
        m = `${ben} ${adet}d${yuz} attı: ${at.join(" + ")}${adet > 1 ? " = " + at.reduce((a, b) => a + b, 0) : ""}`;
        break;
      }
      case "sira": { d.sira = sayi(h.koltuk, 0, d.koltuk.length - 1, 0); m = `Sıra ${d.koltuk[d.sira] ? d.koltuk[d.sira].name : "boş koltuk"} oyuncusunda`; break; }
      case "not": { const t = tek(h.metin, 200); if (!t) return null; m = `${ben}: ${t}`; break; }
      default: throw hata("invalid_argument", "Bilinmeyen işlem");
    }
    d.n++;
    if (m) { d.log.push({ t: Date.now(), kisi, m }); if (d.log.length > 80) d.log.splice(0, d.log.length - 80); }
    return m;
  }

  /* ---------------- Görünümler ---------------- */
  // Herkese açık görünüm: kapalı kartların yüzü (k) yok, destelerin sırası yok, eller yalnızca sayı.
  function acikGorunum(d) {
    const kartlar = {};
    for (const [iid, c] of Object.entries(d.kartlar)) {
      if (c.yer === "deste" || c.yer === "el") continue;
      kartlar[iid] = { d: c.d, yer: c.yer, sahip: c.sahip, x: c.x, y: c.y, r: c.r, z: c.z, acik: c.acik, gor: c.gor, ...(c.acik ? { k: c.k } : {}) };
    }
    const desteler = {};
    for (const [pid, p] of Object.entries(d.desteler)) {
      const ust = p.kart[p.kart.length - 1];
      desteler[pid] = { d: p.d, ad: p.ad, x: p.x, y: p.y, n: p.kart.length, acik: p.acik, iskarta: !!p.iskarta, ...(p.acik && ust ? { ust: d.kartlar[ust].k } : {}) };
    }
    return { basladi: d.basladi, koltuk: d.koltuk, n: d.n, sira: d.sira, kartlar, desteler, taslar: d.taslar,
      el: Object.fromEntries(Object.entries(d.el).map(([k, v]) => [k, v.map(iid => ({ iid, d: d.kartlar[iid].d }))])),
      onu: d.onu, sayac: d.sayac, log: d.log.slice(-40), zar: d.zar };
  }
  // Bir oyuncunun gizli görünümü: kendi eli ve baktığı kapalı kartlar.
  function gizliGorunum(d, kisi) {
    const el = (d.el[kisi] || []).map(iid => ({ iid, k: d.kartlar[iid].k }));
    const gor = {};
    for (const [iid, c] of Object.entries(d.kartlar)) if (!c.acik && c.gor.includes(kisi) && c.yer !== "el") gor[iid] = c.k;
    const ustler = {};
    for (const [pid, p] of Object.entries(d.desteler)) { const u = p.kart[p.kart.length - 1]; if (u && d.kartlar[u].gor.includes(kisi)) ustler[pid] = d.kartlar[u].k; }
    return { n: d.n, el, gor, ustler };
  }

  const api = { MASA_G, MASA_H, RENKLER, SEKILLER, tanimDuzelt, yeni, baslat, uygula, acikGorunum, gizliGorunum, kartTanimi, desteTanimi, resim };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZM_KARTMASA = api;
})(typeof window !== "undefined" ? window : globalThis);
