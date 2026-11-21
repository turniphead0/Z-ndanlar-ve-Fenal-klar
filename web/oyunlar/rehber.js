/* Masa oyunları: sıradaki oyuncuya rehber. Sıra kimdeyse onun yapması gerekenleri (zorunlu hamleler, oyunun
   aşaması), yapabileceği öne çıkan hamleleri (kazandıran, taş alan, bir kez daha oynatan, güvenli) ve ipuçlarını
   kurallar.js'in hamleler/uygula işlevleriyle hesaplar. Tarayıcıda window.ZM_REHBER, Node'da require ile kullanılır.

   analiz(oyun, durum) → {
     baslik,            // "Alma zorunlu", "Koyma aşaması" gibi kısa durum
     yapmalisin: [...], // zorunlu olanlar ya da sıradaki adım
     secenekler: [{ hamle, etiketler: [{ tur, metin }], puan, aciklama }], // en çok 6, en iyiden
     uyarilar: [...],   // rakibin tehditleri
     ipuclari: [...],   // oyuna ve aşamaya göre genel ipuçları
     toplam             // yasal hamle sayısı
   } */
(function (root) {
  "use strict";
  const K = (typeof module === "object" && module.exports) ? require("./kurallar") : root.ZM_OYUNLAR;
  const { OYUNLAR } = K;
  const sabitZar = () => 0.99; // analizde zar atılmasın diye (Ur'da uygula sonrası zar sonucu değerlendirilmez)

  // Bir taraftaki taş sayısı (taş alma ölçüsü).
  const TAS = {
    mangala: (d, p) => d.a[p === 0 ? 6 : 13],               // hazinedeki taş
    dama: (d, p) => d.b.filter(v => v && (v <= 2 ? 0 : 1) === p).length,
    dokuztas: (d, p) => d.b.filter(v => v === p).length + d.elde[p],
    ur: (d, p) => d.t[p].filter(k => k > 0 && k < 15).length, // yoldaki taş (alınan taş başa döner)
    hnefatafl: (d, p) => d.b.filter(v => v && (v === 1 ? 0 : 1) === p).length,
  };
  // Kare anahtarını okunur yapan adlar.
  const SUTUN = "abcdefghijk";
  // Izgaralı tahtalarda ad, oyuncunun gördüğü yönden verilir (tahta ikinci koltuktakine ters çevrilir);
  // tahtanın kenarındaki harf ve rakamlarla aynıdır (oyunlar.js).
  const izgara = (k, n, cevir) => { let r = Math.floor(k / n), c = k % n; if (cevir) { r = n - 1 - r; c = n - 1 - c; } return SUTUN[c] + (n - r); };
  const KARE = {
    mangala: k => `soldan ${(k % 7) + 1}. kuyu`,
    dama: (k, cevir) => izgara(k, 8, cevir),
    dokuztas: k => `${k + 1}.`,
    ur: k => (k >= 200 ? "çıkış" : k >= 100 ? "başlangıç" : String(k)),
    hnefatafl: (k, cevir) => izgara(k, 11, cevir),
  };
  const kareAdi = (oyun, k, cevir) => (KARE[oyun] || (x => String(x)))(k, cevir);
  function hamleMetni(oyun, h, d, cevir) {
    const a = k => kareAdi(oyun, k, cevir);
    if (oyun === "mangala") return `${a(h[0])} (${d.a[h[0]]} taş)`;
    if (oyun === "dokuztas") {
      const koyma = d.elde[d.sira] > 0;
      if (koyma) return h.length > 1 ? `${a(h[0])} noktaya koy, ${a(h[1])} noktadaki taşı al` : `${a(h[0])} noktaya koy`;
      return h.length > 2 ? `${a(h[0])} noktadan ${a(h[1])} noktaya, ${a(h[2])} noktadaki taşı al` : `${a(h[0])} noktadan ${a(h[1])} noktaya`;
    }
    if (oyun === "ur") {
      const z = urHedef(d, h), k = z - d.zar;
      return `${k === 0 ? "Yeni taş" : k + ". karedeki taş"} → ${z === 15 ? "çıkış" : z + ". kare"}`;
    }
    return h.map(a).join(" → ");
  }

  // Rakibin bu durumda en çok kaç taş alabileceği (sıra ona geçmiş gibi).
  function rakipTehdidi(oyun, d, q) {
    const g = OYUNLAR[oyun];
    if (d.bitti) return { en: 0, kazanir: false };
    const dd = Object.assign({}, d, { sira: q });
    if (oyun === "ur") return { en: 0, kazanir: false }; // rakibin zarı belli değil
    let en = 0, kazanir = false, sinir = 0;
    for (const h of g.hamleler(dd)) {
      if (++sinir > 160) break;
      const s = g.uygula(dd, h, sabitZar);
      if (s.bitti && s.bitti.kazanan === q) kazanir = true;
      en = Math.max(en, TAS[oyun](dd, 1 - q) - TAS[oyun](s, 1 - q));
    }
    return { en, kazanir };
  }

  function analiz(oyun, d, secenek) {
    const cevir = !!(secenek && secenek.cevir);
    const g = OYUNLAR[oyun];
    if (!g || !d) return null;
    const p = d.sira, q = 1 - p;
    const out = { baslik: "", yapmalisin: [], secenekler: [], uyarilar: [], ipuclari: [], toplam: 0 };
    if (d.bitti) { out.baslik = "Oyun bitti"; out.ipuclari.push("Yeniden başlat ile aynı masada bir el daha oynayabilirsiniz."); return out; }
    const yasal = g.hamleler(d);
    out.toplam = yasal.length;
    if (!yasal.length) { out.baslik = "Hamle yok"; out.yapmalisin.push("Oynayabileceğin hamle yok; sıra kendiliğinden geçer."); return out; }

    // Her hamleyi dene: kazanıyor mu, taş alıyor mu, sıra yine bende mi, sonra rakip ne alabilir?
    const tehditSinir = yasal.length > 60 ? 0 : yasal.length; // çok hamle varsa (Hnefatafl) tehdidi yalnızca öne çıkanlarda hesapla
    const sonuc = yasal.map(h => {
      const s = g.uygula(d, h, sabitZar);
      const alinan = Math.max(0, TAS[oyun](d, q) - TAS[oyun](s, q)) + (oyun === "mangala" ? Math.max(0, TAS.mangala(s, p) - TAS.mangala(d, p)) : 0);
      const tekrar = !s.bitti && (oyun === "ur" ? [4, 8, 14].includes(urHedef(d, h)) : s.sira === p);
      return { h, s, kazanir: !!(s.bitti && s.bitti.kazanan === p), berabere: !!(s.bitti && s.bitti.kazanan == null), alinan, tekrar };
    });
    let hesaplanan = 0;
    for (const r of sonuc) {
      if (hesaplanan >= tehditSinir && !(r.alinan || r.kazanir || r.tekrar)) continue;
      if (hesaplanan >= 40) break;
      hesaplanan++;
      r.tehdit = r.tekrar ? { en: 0, kazanir: false } : rakipTehdidi(oyun, r.s, q);
    }

    // Oyuna özel durum ve zorunluluklar.
    const ozel = OZEL[oyun] ? OZEL[oyun](d, yasal, sonuc) : null;
    if (ozel) { out.baslik = ozel.baslik || ""; out.yapmalisin.push(...(ozel.yapmalisin || [])); out.ipuclari.push(...(ozel.ipuclari || [])); }

    // Öne çıkan hamleler: puanla, en iyileri göster.
    for (const r of sonuc) {
      const et = [];
      let puan = 0;
      if (r.kazanir) { et.push({ tur: "kazan", metin: "Kazandırır" }); puan += 1000; }
      if (r.alinan) { et.push({ tur: "al", metin: oyun === "mangala" ? `Hazineye +${r.alinan}` : `${r.alinan} taş alır` }); puan += r.alinan * 10; }
      if (r.tekrar) { et.push({ tur: "tekrar", metin: "Bir kez daha oynarsın" }); puan += 15; }
      if (r.berabere) { et.push({ tur: "berabere", metin: "Berabere biter" }); puan -= 5; }
      if (oyun === "ur") { const z = urHedef(d, r.h); if (z === 15) { et.push({ tur: "cik", metin: "Taşı çıkarır" }); puan += 12; } if (z === 8) { et.push({ tur: "guvenli", metin: "Ortadaki güvenli rozet" }); puan += 8; } }
      if (oyun === "hnefatafl" && d.b[r.h[0]] === 3) { puan += 2; if (HN_KOSE.includes(r.h[1])) puan += 500; }
      if (r.tehdit) {
        if (r.tehdit.kazanir) { et.push({ tur: "tehlike", metin: "Rakibe kazanma şansı verir" }); puan -= 800; }
        else if (r.tehdit.en > 0) { et.push({ tur: "tehlike", metin: oyun === "mangala" ? `Rakip sonra ${r.tehdit.en} taş kazanabilir` : `Rakip sonra ${r.tehdit.en} taş alabilir` }); puan -= r.tehdit.en * 7; }
        else if (et.length || yasal.length <= 12) { et.push({ tur: "guvenli", metin: "Güvenli" }); puan += 3; }
      }
      if (et.length) out.secenekler.push({ hamle: r.h, etiketler: et, puan, aciklama: hamleMetni(oyun, r.h, d, cevir) });
    }
    out.secenekler.sort((a, b) => b.puan - a.puan);
    out.secenekler = out.secenekler.slice(0, 6);

    // Şu anki tehdit: sıra rakipte olsaydı ne alırdı?
    const simdi = rakipTehdidi(oyun, d, q);
    if (simdi.kazanir) out.uyarilar.push("Dikkat: rakibin bir sonraki hamlede kazanabilir. Önce onu engelle.");
    else if (simdi.en > 0 && oyun !== "mangala") out.uyarilar.push(`Rakibin şu an ${simdi.en} taşını alabilecek durumda; taşını kaçırmayı ya da korumayı düşün.`);
    if (!out.secenekler.length && yasal.length) out.ipuclari.push("Öne çıkan bir hamle yok: taşlarını birbirine yakın tut, rakibe açık kapı bırakma.");
    return out;
  }

  function urHedef(d, h) {
    const p = d.sira, U = OYUNLAR.ur;
    const k = h[0] >= 100 ? 0 : [...Array(15).keys()].find(x => x > 0 && U.kare(p, x) === h[0]);
    return k + d.zar;
  }
  const HN_KOSE = [0, 10, 110, 120];

  // Oyuna göre "yapmalısın" ve ipuçları.
  const OZEL = {
    mangala(d, yasal, sonuc) {
      const tekrar = sonuc.filter(r => r.tekrar).length;
      return {
        baslik: "Bir kuyu seç",
        yapmalisin: [`Kendi tarafındaki dolu kuyulardan birini seç (${yasal.length} seçenek). Taşlar saatin tersi yönünde dağıtılır.`],
        ipuclari: [
          tekrar ? `${tekrar} kuyudan başlarsan son taş hazinene düşer ve bir kez daha oynarsın; önce bunları değerlendir.` : "Son taşın hazinene düşeceği kuyuyu bulursan bir kez daha oynarsın: taş sayısı ile hazineye uzaklık eşit olmalı.",
          "Rakibin kuyusunu çift yapan son taş o kuyudaki taşları sana kazandırır.",
          "Kendi tarafında boş kuyu bırakmak, karşısı doluyken iyi bir alma fırsatı olabilir.",
        ],
      };
    },
    dama(d, yasal) {
      const almaVar = yasal.some(h => DAMA_ALMA(d, h));
      if (almaVar) {
        const enCok = yasal[0].length - 1;
        return {
          baslik: "Alma zorunlu",
          yapmalisin: [`Rakip taşı almak zorundasın${enCok > 1 ? ` ve en çok taşı alan yolu (${enCok} atlama) seçmelisin` : ""}. Önce taşını, sonra her inişi sırayla tıkla.`],
          ipuclari: ["Almadan sonra taşın açıkta kalıyor mu bak: rakip de almak zorunda, bu bir tuzak olabilir."],
        };
      }
      return {
        baslik: "Bir taşını sür",
        yapmalisin: ["Taşını bir kare ileri ya da yana sür (dama dört yöne istediği kadar gider)."],
        ipuclari: ["Taşlarını yan yana ve arka arkaya tut; tek kalan taş kolay alınır.", "Son sıraya ulaşan taş dama olur; yolu açık olan taşı ilerletmeyi düşün.", "Rakibi almaya zorlayarak onu istediğin yere çekebilirsin."],
      };
    },
    dokuztas(d, yasal) {
      const p = d.sira, koyma = d.elde[p] > 0, ucar = !koyma && d.b.filter(v => v === p).length === 3;
      const degirmen = yasal.some(h => h.length > (koyma ? 1 : 2));
      const y = [];
      if (koyma) y.push(`Koyma aşaması: elinde ${d.elde[p]} taş var. Boş bir noktaya bir taş koy.`);
      else if (ucar) y.push("Uçma aşaması: üç taşın kaldı, taşını herhangi bir boş noktaya götürebilirsin.");
      else y.push("Sürme aşaması: bir taşını çizgi boyunca komşu boş noktaya kaydır.");
      if (degirmen) y.push("Değirmen kurabilirsin: üçüncü taşı koyduktan/sürdükten sonra alacağın rakip taşı tıkla.");
      return {
        baslik: koyma ? "Koyma aşaması" : ucar ? "Uçma aşaması" : "Sürme aşaması",
        yapmalisin: y,
        ipuclari: koyma
          ? ["Köşelere değil, kesişim noktalarına (dört komşulu) koymak sana daha çok hareket alanı verir.", "Rakibin iki taşı bir hizadaysa üçüncü noktayı kapat."]
          : ["Açıp kapatabileceğin bir değirmen (taşı çıkarıp geri sokmak) her iki hamlede bir taş aldırır.", "Rakibin taşlarını sıkıştır: hamlesi kalmayan kaybeder."],
      };
    },
    ur(d, yasal, sonuc) {
      const rozet = sonuc.filter(r => r.tekrar).length;
      return {
        baslik: `Zar: ${d.zar}`,
        yapmalisin: [`Bir taşını ${d.zar} kare ilerlet (${yasal.length} seçenek). Önce taşı ya da başlangıç alanını, sonra gideceği kareyi tıkla.`],
        ipuclari: [
          rozet ? "Çiçekli kareye (rozet) gelen taş sana bir zar daha kazandırır." : "Çiçekli karelere (rozet) gelirsen bir kez daha oynarsın.",
          "Ortadaki rozet (yolun 8. karesi) güvenlidir; orada duran taş alınamaz.",
          "Rakibin taşının 1–4 kare önünde durmak risklidir; en sık gelen zar 2'dir.",
        ],
      };
    },
    hnefatafl(d, yasal, sonuc) {
      const p = d.sira, kral = d.b.indexOf(3);
      const kacis = sonuc.filter(r => d.b[r.h[0]] === 3 && HN_KOSE.includes(r.h[1])).length;
      if (p === 0) return {
        baslik: "Saldıranlar",
        yapmalisin: ["Bir taşını kale gibi düz sür. Amacın kralı dört yandan çevirmek."],
        ipuclari: ["Önce köşelerin çevresini kapat: kral köşeye ulaşırsa kaybedersin.", "Bir rakip taşını iki taşının arasına sıkıştırırsan alırsın; köşeler de senin tarafında sayılır."],
      };
      return {
        baslik: kacis ? "Kral kaçabilir!" : "Savunanlar",
        yapmalisin: [kacis ? "Kral bu hamlede bir köşeye ulaşabilir: kralı köşeye götür ve kazan." : "Bir taşını düz sür. Amacın kralı dört köşeden birine kaçırmak."],
        ipuclari: [
          "Kralın aynı anda iki köşeye yolu açılırsa rakip ikisini birden kapatamaz.",
          kral >= 0 && [0, 10].includes(Math.floor(kral / 11)) ? "Kral kenarda alınamaz; kenar boyunca köşeye kaymayı dene." : "Kral da almaya katılır; saldıranları sıkıştırmak için kullan.",
        ],
      };
    },
  };
  // Dama: hamle bir alma mı? (yol boyunca rakip taş var mı)
  function DAMA_ALMA(d, yol) {
    const b = d.b;
    for (let k = 1; k < yol.length; k++) {
      const a = yol[k - 1], z = yol[k];
      const dr = Math.sign(Math.floor(z / 8) - Math.floor(a / 8)), dc = Math.sign((z % 8) - (a % 8));
      let x = a + dr * 8 + dc;
      while (x !== z) { if (b[x] !== 0) return true; x += dr * 8 + dc; }
    }
    return false;
  }

  const api = { analiz, hamleMetni, kareAdi };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZM_REHBER = api;
})(typeof window !== "undefined" ? window : globalThis);
