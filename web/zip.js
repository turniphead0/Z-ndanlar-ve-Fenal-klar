/* Küçük zip yazıcısı: oyun yedekleri (server/yedek.js) ve tarayıcıda seçilen yedek klasörünü tek dosyaya
   çevirmek (web/mobil/mobil.js) için. Sıkıştırmaz ("stored"): yedekteki resim, ses ve PDF'ler zaten sıkıştırılmıştır.
   Hem tarayıcıda (window.ZM_ZIP) hem sunucuda (require) çalışır. Zip64 yok: toplam 4 GB'tan küçük olmalı. */
(function (root) {
  "use strict";
  const TABLO = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(veri, onceki) {
    let c = onceki === undefined ? 0xffffffff : (onceki ^ 0xffffffff) >>> 0;
    for (let i = 0; i < veri.length; i++) c = TABLO[(c ^ veri[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  const utf8 = s => (typeof TextEncoder !== "undefined" ? new TextEncoder().encode(s) : Buffer.from(s, "utf8"));
  // MS-DOS tarih/saat (zip başlıklarındaki biçim).
  function dosZamani(t) {
    const d = new Date(t || Date.now());
    return { saat: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), gun: (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() };
  }
  // Bir kayıt için yerel başlık (dosya verisinden hemen önce yazılır).
  function yerelBaslik(ad, crc, boyut, zaman) {
    const a = utf8(ad), z = dosZamani(zaman), b = new Uint8Array(30 + a.length), v = new DataView(b.buffer);
    v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true); v.setUint16(8, 0, true);
    v.setUint16(10, z.saat, true); v.setUint16(12, z.gun, true); v.setUint32(14, crc, true); v.setUint32(18, boyut, true); v.setUint32(22, boyut, true);
    v.setUint16(26, a.length, true); v.setUint16(28, 0, true); b.set(a, 30);
    return b;
  }
  // Sona yazılan içindekiler bölümü: kayıtlar [{ ad, crc, boyut, konum, zaman }].
  function sonBolum(kayitlar, merkezKonum) {
    const parcalar = []; let uzunluk = 0;
    for (const k of kayitlar) {
      const a = utf8(k.ad), z = dosZamani(k.zaman), b = new Uint8Array(46 + a.length), v = new DataView(b.buffer);
      v.setUint32(0, 0x02014b50, true); v.setUint16(4, 20, true); v.setUint16(6, 20, true); v.setUint16(8, 0x0800, true); v.setUint16(10, 0, true);
      v.setUint16(12, z.saat, true); v.setUint16(14, z.gun, true); v.setUint32(16, k.crc, true); v.setUint32(20, k.boyut, true); v.setUint32(24, k.boyut, true);
      v.setUint16(28, a.length, true); v.setUint16(30, 0, true); v.setUint16(32, 0, true); v.setUint16(34, 0, true); v.setUint16(36, 0, true);
      v.setUint32(38, 0, true); v.setUint32(42, k.konum, true); b.set(a, 46);
      parcalar.push(b); uzunluk += b.length;
    }
    const e = new Uint8Array(22), v = new DataView(e.buffer);
    v.setUint32(0, 0x06054b50, true); v.setUint16(8, kayitlar.length, true); v.setUint16(10, kayitlar.length, true);
    v.setUint32(12, uzunluk, true); v.setUint32(16, merkezKonum, true);
    parcalar.push(e);
    return parcalar;
  }
  // Bellekteki dosyalardan zip parçaları: [{ ad, veri: Uint8Array }] → Uint8Array[] (new Blob(parcalar) ile birleşir).
  function olustur(dosyalar) {
    const parcalar = [], kayitlar = []; let konum = 0;
    for (const d of dosyalar) {
      const crc = crc32(d.veri), h = yerelBaslik(d.ad, crc, d.veri.length, d.zaman);
      kayitlar.push({ ad: d.ad, crc, boyut: d.veri.length, konum, zaman: d.zaman });
      parcalar.push(h, d.veri); konum += h.length + d.veri.length;
    }
    if (konum > 0xfffffff0) throw new Error("Yedek 4 GB'tan büyük olamaz");
    return parcalar.concat(sonBolum(kayitlar, konum));
  }

  const api = { crc32, yerelBaslik, sonBolum, olustur };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZM_ZIP = api;
})(typeof window !== "undefined" ? window : this);
