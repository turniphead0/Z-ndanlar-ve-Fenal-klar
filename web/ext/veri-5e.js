/* Masaüstü eklentileri: D&D 5e verisi (SRD 5.1, CC-BY-4.0). Irklar, sınıflar, geçmişler,
   büyü yuvası tabloları, seviye özellikleri ve büyü listesi. Sihirbaz, büyü kitabı ve gelişim bunu kullanır. */
(function () {
  "use strict";

  const AB_HELP = {
    str: "Kas gücü. Ağır silahlarla vurmak, tırmanmak, itmek ve kaldırmak için.",
    dex: "Çeviklik ve refleks. Yay ve hafif silahlar, zırh sınıfı, inisiyatif ve gizlilik için.",
    con: "Dayanıklılık. Can puanını artırır; zehre, yorgunluğa ve büyü konsantrasyonunu korumaya yarar.",
    int: "Akıl ve bilgi. Büyücülerin büyü gücü; tarih, arkana ve araştırma için.",
    wis: "Sezgi ve farkındalık. Rahip, druid ve korucuların büyü gücü; algı ve sezgi için.",
    cha: "Kişilik gücü. Ozan, paladin, sihirbaz ve cadıların büyü gücü; ikna ve aldatma için.",
  };

  const RACES = [
    { k: "human", n: "İnsan", ab: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, speed: 30, d: "Her işe uyum sağlayan, hırslı ve çeşitli bir halk. Tüm yetenek puanlarına +1 alır; hangi sınıfı seçersen seç iyi bir başlangıçtır.", t: "Ek dil: istediğin bir dil." },
    { k: "elf", n: "Elf (Yüksek Elf)", ab: { dex: 2, int: 1 }, speed: 30, d: "Uzun ömürlü, zarif ve büyüye yatkın. Okçular ve büyücüler için uygun.", t: "Karanlık görüş (60 ft)\nKeskin Duyular: Algı yeterliliği\nPeri Soyu: büyülenmeye karşı avantaj, büyüyle uyutulamaz\nTrans: 4 saat meditasyon uzun dinlenme sayılır\nBir büyücü hilesi (cantrip)", skills: ["perception"] },
    { k: "dwarf", n: "Cüce (Tepe Cücesi)", ab: { con: 2, wis: 1 }, speed: 25, d: "Sağlam, inatçı ve dayanıklı. Ağır zırhla yavaşlamaz. Savaşçı ve rahipler için çok iyi.", t: "Karanlık görüş (60 ft)\nCüce Direnci: zehre karşı avantaj ve direnç\nTaş Bilgisi\nCüce Sağlamlığı: her seviyede +1 can puanı", hpBonus: 1 },
    { k: "halfling", n: "Buçukluk (Hafifayak)", ab: { dex: 2, cha: 1 }, speed: 25, d: "Küçük, neşeli ve şanslı. Haydut ve ozanlar için ideal.", t: "Şanslı: d20'de 1 gelirse yeniden at\nCesur: korkutulmaya karşı avantaj\nBuçukluk Çevikliği: daha büyük yaratıkların arasından geçebilir\nDoğal Gizlilik" },
    { k: "dragonborn", n: "Ejderdoğan", ab: { str: 2, cha: 1 }, speed: 30, d: "Ejder soyundan gelen gururlu savaşçılar. Nefes silahları vardır.", t: "Ejder Soyu: bir renk seç (hasar türünü belirler)\nNefes Silahı: 2d6 hasar, kısa dinlenmede yenilenir\nSoyunun hasar türüne direnç" },
    { k: "gnome", n: "Gnom (Kaya Gnomu)", ab: { int: 2, con: 1 }, speed: 25, d: "Meraklı mucitler ve kurnaz zihinler. Büyücüler için uygun.", t: "Karanlık görüş (60 ft)\nGnom Kurnazlığı: Zekâ, Bilgelik ve Karizma kurtarmalarında büyüye karşı avantaj\nMucit: küçük mekanik aletler yapabilir" },
    { k: "halfelf", n: "Yarı-Elf", ab: { cha: 2 }, choose: 2, speed: 30, d: "İki dünya arasında kalmış, sosyal ve çok yönlü. Karizma +2, ayrıca istediğin iki yeteneğe +1.", t: "Karanlık görüş (60 ft)\nPeri Soyu: büyülenmeye karşı avantaj\nÇok Yönlülük: iki beceride yeterlilik (beceri adımında seçersin)", extraSkills: 2 },
    { k: "halforc", n: "Yarı-Ork", ab: { str: 2, con: 1 }, speed: 30, d: "Güçlü ve yılmaz. Barbar ve savaşçılar için çok uygun.", t: "Karanlık görüş (60 ft)\nTehditkâr: Gözdağı yeterliliği\nAmansız Dayanıklılık: 0 CP'ye düşünce bir kez 1 CP ile kalırsın\nVahşi Saldırılar: kritik vuruşta bir hasar zarı daha", skills: ["intimidation"] },
    { k: "tiefling", n: "Tiefling", ab: { cha: 2, int: 1 }, speed: 30, d: "Cehennemî bir soydan gelen, yanlış anlaşılan bir halk. Cadı ve sihirbazlar için iyi.", t: "Karanlık görüş (60 ft)\nCehennem Direnci: ateş hasarına direnç\nCehennem Mirası: Thaumaturgy hilesi" },
  ];

  // ac: zırh hesabı. weapon: [ad, yetenek, zar, tür]. order: önerilen yetenek sıralaması (en yüksekten).
  const CLASSES = [
    { k: "barbarian", n: "Barbar (Barbarian)", hd: 12, saves: ["str", "con"], pick: 2, skills: ["animal", "athletics", "intimidation", "nature", "perception", "survival"], order: ["str", "con", "dex", "wis", "cha", "int"], ac: { base: 10, dex: true, plus: "con", note: "Zırhsız Savunma: 10 + ÇEV + DAY" }, weapon: ["Büyük balta", "str", "1d12", "kesici"], d: "Öfkesiyle savaşan, en çok canı olan yakın dövüşçü. Basit oynanır, çok dayanıklıdır.", f: "Öfke (günde 2): bonus aksiyonla öfkelen; güç kontrollerinde avantaj, +2 hasar, fiziksel hasara direnç\nZırhsız Savunma", inv: "Büyük balta\n2 el baltası\nKaşif çantası\n4 cirit" },
    { k: "bard", n: "Ozan (Bard)", hd: 8, saves: ["dex", "cha"], pick: 3, skills: "all", order: ["cha", "dex", "con", "wis", "int", "str"], ac: { base: 11, dex: true, note: "Deri zırh: 11 + ÇEV" }, weapon: ["Meç", "dex", "1d8", "delici"], spell: "cha", slots: 2, d: "Müzikle ve sözle büyü yapan, takımı destekleyen çok yönlü bir karakter.", f: "Büyücülük (Karizma)\nOzan İlhamı (d6): bir müttefikine zar ekleyecek bir ilham ver", inv: "Meç\nDeri zırh, hançer\nBir müzik aleti\nEğlendirici çantası" },
    { k: "cleric", n: "Rahip (Cleric)", hd: 8, saves: ["wis", "cha"], pick: 2, skills: ["history", "insight", "medicine", "persuasion", "religion"], order: ["wis", "con", "str", "cha", "dex", "int"], ac: { base: 14, dex: 2, shield: true, note: "Pullu zırh: 14 + ÇEV (en çok +2), kalkan +2" }, weapon: ["Gürz", "str", "1d6", "ezici"], spell: "wis", slots: 2, d: "Tanrısının gücünü taşıyan şifacı ve koruyucu. Takımın can simidi.", f: "Büyücülük (Bilgelik)\nİlahi Alan: bir alan seç (örn. Yaşam)", inv: "Gürz\nPullu zırh, kalkan\nKutsal sembol\nRahip çantası" },
    { k: "druid", n: "Druid", hd: 8, saves: ["int", "wis"], pick: 2, skills: ["arcana", "animal", "insight", "medicine", "nature", "perception", "religion", "survival"], order: ["wis", "con", "dex", "int", "cha", "str"], ac: { base: 11, dex: true, shield: true, note: "Deri zırh: 11 + ÇEV, tahta kalkan +2" }, weapon: ["Pala", "dex", "1d6", "kesici"], spell: "wis", slots: 2, d: "Doğanın gücünü kullanan büyücü. İleride hayvan biçimine girebilir.", f: "Büyücülük (Bilgelik)\nDruidce: druidlerin gizli dili", inv: "Pala\nDeri zırh, tahta kalkan\nDruid odağı\nKaşif çantası" },
    { k: "fighter", n: "Savaşçı (Fighter)", hd: 10, saves: ["str", "con"], pick: 2, skills: ["acrobatics", "animal", "athletics", "history", "insight", "intimidation", "perception", "survival"], order: ["str", "con", "dex", "wis", "cha", "int"], ac: { base: 16, note: "Zincir zırh: 16" }, weapon: ["Uzun kılıç", "str", "1d8", "kesici"], d: "Her silahı ve zırhı kullanan usta dövüşçü. Yeni başlayanlar için en kolay sınıf.", f: "Savaş Stili: örn. Savunma (+1 ZS) ya da Düello (+2 hasar)\nİkinci Soluk: bonus aksiyonla 1d10 + seviye can kazan (kısa dinlenmede yenilenir)", inv: "Uzun kılıç, kalkan\nZincir zırh\nHafif arbalet ve 20 cıvata\nZindan çantası" },
    { k: "monk", n: "Keşiş (Monk)", hd: 8, saves: ["str", "dex"], pick: 2, skills: ["acrobatics", "athletics", "history", "insight", "religion", "stealth"], order: ["dex", "wis", "con", "str", "int", "cha"], ac: { base: 10, dex: true, plus: "wis", note: "Zırhsız Savunma: 10 + ÇEV + BİL" }, weapon: ["Kısa kılıç", "dex", "1d6", "delici"], d: "Bedenini silah olarak kullanan hızlı dövüş ustası.", f: "Zırhsız Savunma\nDövüş Sanatları: silahsız vuruşların 1d4; saldırıdan sonra bonus aksiyonla bir vuruş daha", inv: "Kısa kılıç\n10 dart\nKaşif çantası" },
    { k: "paladin", n: "Paladin", hd: 10, saves: ["wis", "cha"], pick: 2, skills: ["athletics", "insight", "intimidation", "medicine", "persuasion", "religion"], order: ["str", "cha", "con", "wis", "dex", "int"], ac: { base: 16, shield: true, note: "Zincir zırh: 16, kalkan +2" }, weapon: ["Uzun kılıç", "str", "1d8", "kesici"], d: "Yeminine bağlı kutsal savaşçı. Hem dövüşür hem iyileştirir.", f: "İlahi Sezgi: yakındaki kutsal ve kötü varlıkları sezersin\nEl Koyarak İyileştirme: günde 5 × seviye can puanı dağıtabilirsin", inv: "Uzun kılıç, kalkan\nZincir zırh\n5 cirit\nRahip çantası, kutsal sembol" },
    { k: "ranger", n: "Korucu (Ranger)", hd: 10, saves: ["str", "dex"], pick: 3, skills: ["animal", "athletics", "insight", "investigation", "nature", "perception", "stealth", "survival"], order: ["dex", "wis", "con", "str", "int", "cha"], ac: { base: 14, dex: 2, note: "Pullu zırh: 14 + ÇEV (en çok +2)" }, weapon: ["Uzun yay", "dex", "1d8", "delici"], d: "Vahşi doğada iz süren okçu ve avcı.", f: "Favori Düşman: bir düşman türü seç\nDoğal Kaşif: bir arazi türü seç", inv: "Uzun yay ve 20 ok\n2 kısa kılıç\nPullu zırh\nKaşif çantası" },
    { k: "rogue", n: "Haydut (Rogue)", hd: 8, saves: ["dex", "int"], pick: 4, skills: ["acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception", "performance", "persuasion", "sleight", "stealth"], order: ["dex", "con", "wis", "int", "cha", "str"], ac: { base: 11, dex: true, note: "Deri zırh: 11 + ÇEV" }, weapon: ["Kısa kılıç", "dex", "1d6", "delici"], expertise: 2, d: "Gizlilik, kilit açma ve sinsi saldırı uzmanı. En çok beceriye sahip sınıf.", f: "Sinsi Saldırı (1d6): avantajla vurduğunda ya da hedefin yanında müttefik varken ek hasar\nUzmanlık: iki beceride yeterlilik bonusu iki katı\nHırsız Argosu", inv: "Kısa kılıç, kısa yay ve 20 ok\nDeri zırh, 2 hançer\nHırsız aletleri\nHırsız çantası" },
    { k: "sorcerer", n: "Sihirbaz (Sorcerer)", hd: 6, saves: ["con", "cha"], pick: 2, skills: ["arcana", "deception", "insight", "intimidation", "persuasion", "religion"], order: ["cha", "con", "dex", "wis", "int", "str"], ac: { base: 10, dex: true, note: "Zırhsız: 10 + ÇEV" }, weapon: ["Hafif arbalet", "dex", "1d8", "delici"], spell: "cha", slots: 2, d: "Büyü kanında olan, doğuştan büyücü. Az ama güçlü büyüleri vardır.", f: "Büyücülük (Karizma)\nBüyüsel Köken: örn. Ejder Soyu", inv: "Hafif arbalet ve 20 cıvata\nBüyü odağı\n2 hançer\nKaşif çantası" },
    { k: "warlock", n: "Cadı (Warlock)", hd: 8, saves: ["wis", "cha"], pick: 2, skills: ["arcana", "deception", "history", "intimidation", "investigation", "nature", "religion"], order: ["cha", "con", "dex", "wis", "int", "str"], ac: { base: 11, dex: true, note: "Deri zırh: 11 + ÇEV" }, weapon: ["Hafif arbalet", "dex", "1d8", "delici"], spell: "cha", slots: 1, d: "Güçlü bir varlıkla pakt yapmış büyücü. Büyü yuvaları kısa dinlenmede yenilenir.", f: "Ötedünya Hamisi: pakt yaptığın varlık\nPaktın Büyüsü (Karizma): yuvalar kısa dinlenmede dolar", inv: "Hafif arbalet ve 20 cıvata\nDeri zırh, 2 hançer\nBüyü odağı\nAlim çantası" },
    { k: "wizard", n: "Büyücü (Wizard)", hd: 6, saves: ["int", "wis"], pick: 2, skills: ["arcana", "history", "insight", "investigation", "medicine", "religion"], order: ["int", "con", "dex", "wis", "cha", "str"], ac: { base: 10, dex: true, note: "Zırhsız: 10 + ÇEV" }, weapon: ["Asa", "str", "1d6", "ezici"], spell: "int", slots: 2, d: "Büyüyü kitaplardan öğrenen bilgin. En geniş büyü listesine sahip ama kırılgan.", f: "Büyücülük (Zekâ): büyü kitabı\nGizemli Toparlanma: kısa dinlenmede bazı yuvaları geri kazan", inv: "Asa\nBüyü kitabı\nBüyü odağı\nAlim çantası" },
  ];

  const BACKGROUNDS = [
    { n: "Asker", s: ["athletics", "intimidation"], d: "Bir orduda hizmet ettin; disiplin ve rütbe bilirsin." },
    { n: "Bilge", s: ["arcana", "history"], d: "Yıllarını kitaplar arasında geçirdin." },
    { n: "Halk Kahramanı", s: ["animal", "survival"], d: "Sıradan bir köylüyken halkını korudun." },
    { n: "Mürit", s: ["insight", "religion"], d: "Bir tapınakta tanrına hizmet ettin." },
    { n: "Soylu", s: ["history", "persuasion"], d: "Varlıklı ve nüfuzlu bir ailede doğdun." },
    { n: "Suçlu", s: ["deception", "stealth"], d: "Yasanın öteki tarafında yaşadın." },
    { n: "Şarlatan", s: ["deception", "sleight"], d: "Dilinle ve hilelerinle insanları kandırdın." },
    { n: "Eğlendirici", s: ["acrobatics", "performance"], d: "Kalabalıkları eğlendirerek geçimini sağladın." },
    { n: "Denizci", s: ["athletics", "perception"], d: "Yıllarca gemilerde çalıştın." },
    { n: "Yabani", s: ["athletics", "survival"], d: "Medeniyetten uzakta, vahşi doğada büyüdün." },
    { n: "Zanaatkâr", s: ["insight", "persuasion"], d: "Bir loncanın üyesi olarak zanaatını öğrendin." },
    { n: "Münzevi", s: ["medicine", "religion"], d: "Dünyadan uzak, yalnız bir hayat sürdün." },
  ];

  const ALIGN = [
    ["Yasal İyi", "Kurallara uyar, doğru olanı yapar."], ["Tarafsız İyi", "Kurallara takılmadan iyilik yapar."], ["Kaotik İyi", "Vicdanını dinler, kuralları umursamaz."],
    ["Yasal Tarafsız", "Düzene ve geleneğe bağlıdır."], ["Tarafsız", "Taraf tutmaz, dengeyi gözetir."], ["Kaotik Tarafsız", "Özgürlüğüne düşkündür, keyfine göre davranır."],
    ["Yasal Kötü", "Düzeni kendi çıkarına kullanır."], ["Tarafsız Kötü", "Ne gerekiyorsa yapar, vicdansızdır."], ["Kaotik Kötü", "Yıkıcı ve öfkelidir."],
  ];

  /* ---------------- Gelişim ---------------- */
  // Seviye N için gereken toplam XP (XP[N-1]).
  const XP = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
  const FULL = [[2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]];
  // Büyü yuvaları (9 seviye). kind: full (tam büyücü), half (paladin, korucu), third, pact (cadı).
  function slotsFor(kind, L) {
    L = Math.max(1, Math.min(20, +L || 1));
    const out = Array(9).fill(0);
    if (kind === "full") FULL[L - 1].forEach((v, i) => out[i] = v);
    else if (kind === "half" && L >= 2) FULL[Math.ceil(L / 2) - 1].forEach((v, i) => out[i] = v);
    else if (kind === "third" && L >= 3) FULL[Math.ceil(L / 3) - 1].forEach((v, i) => out[i] = v);
    else if (kind === "pact") out[Math.min(5, Math.ceil(L / 2)) - 1] = L === 1 ? 1 : L < 11 ? 2 : L < 17 ? 3 : 4;
    return out;
  }
  const KNOWN = {
    bard: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
    sorcerer: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
    warlock: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
    ranger: [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
  };
  // Sınıfların büyü ve gelişim bilgisi. code: büyü listelerindeki harf. cant: 1. seviyedeki hile sayısı (+1 sv 4'te, +1 sv 10'da).
  // prep: hazırlayan büyücü ("L" = yetenek bonusu + seviye, "H" = yetenek bonusu + seviye/2). sub: alt sınıfın seçildiği seviye.
  const EXTRA = {
    barbarian: { kind: null, sub: 3, subN: "İlkel Yol", subEx: "Çılgın Yolu (Berserker)" },
    bard: { kind: "full", code: "B", cant: 2, sub: 3, subN: "Ozan Okulu", subEx: "Bilgi Okulu (Lore)" },
    cleric: { kind: "full", code: "C", cant: 3, prep: "L", sub: 1, subN: "İlahi Alan", subEx: "Yaşam Alanı (Life)" },
    druid: { kind: "full", code: "D", cant: 2, prep: "L", sub: 2, subN: "Druid Çemberi", subEx: "Toprak Çemberi (Land)" },
    fighter: { kind: null, sub: 3, subN: "Dövüş Arketipi", subEx: "Şampiyon (Champion)", asi: [4, 6, 8, 12, 14, 16, 19] },
    monk: { kind: null, sub: 3, subN: "Manastır Geleneği", subEx: "Açık El Yolu (Open Hand)" },
    paladin: { kind: "half", code: "P", cant: 0, prep: "H", sub: 3, subN: "Kutsal Yemin", subEx: "Bağlılık Yemini (Devotion)" },
    ranger: { kind: "half", code: "R", cant: 0, sub: 3, subN: "Korucu Arketipi", subEx: "Avcı (Hunter)" },
    rogue: { kind: null, sub: 3, subN: "Haydut Arketipi", subEx: "Hırsız (Thief)", asi: [4, 8, 10, 12, 16, 19] },
    sorcerer: { kind: "full", code: "S", cant: 4, sub: 1, subN: "Büyüsel Köken", subEx: "Ejder Soyu (Draconic)" },
    warlock: { kind: "pact", code: "K", cant: 2, sub: 1, subN: "Ötedünya Hamisi", subEx: "İblis (Fiend)" },
    wizard: { kind: "full", code: "W", cant: 3, prep: "L", book: true, sub: 2, subN: "Büyü Okulu", subEx: "Yıkım Okulu (Evocation)" },
  };
  const ASI = [4, 8, 12, 16, 19];
  // Seviye özellikleri (SRD 5.1, kısaltılmış).
  const FEAT = {
    barbarian: { 2: "Pervasız Saldırı; Tehlike Sezgisi", 3: "İlkel Yol; Öfke 3/gün", 5: "Ek Saldırı; Hızlı Hareket (+10 ft)", 6: "Yol özelliği; Öfke 4/gün", 7: "Vahşi İçgüdü (inisiyatifte avantaj)", 9: "Acımasız Kritik (1 zar); Öfke hasarı +3", 10: "Yol özelliği", 11: "Amansız Öfke", 12: "Öfke 5/gün", 13: "Acımasız Kritik (2 zar)", 14: "Yol özelliği", 15: "Dinmeyen Öfke", 16: "Öfke hasarı +4", 17: "Acımasız Kritik (3 zar); Öfke 6/gün", 18: "Yılmaz Güç", 20: "İlkel Şampiyon: GÜÇ ve DAY +4 (en çok 24); sınırsız öfke" },
    bard: { 2: "Her İşin Ustası; Dinlendirici Şarkı (d6)", 3: "Ozan Okulu; Uzmanlık (2 beceri)", 5: "Ozan İlhamı d8; İlham Kaynağı (kısa dinlenmede dolar)", 6: "Karşı Şarkı; Okul özelliği", 9: "Dinlendirici Şarkı (d8)", 10: "Ozan İlhamı d10; Uzmanlık (2 beceri); Büyüsel Sırlar", 13: "Dinlendirici Şarkı (d10)", 14: "Büyüsel Sırlar; Okul özelliği", 15: "Ozan İlhamı d12", 17: "Dinlendirici Şarkı (d12)", 18: "Büyüsel Sırlar", 20: "Üstün İlham" },
    cleric: { 2: "Kutsal Kanal (1/dinlenme): Ölümsüzleri Kovma; alan kanalı", 5: "Ölümsüzleri Yok Etme (ZD 1/2)", 6: "Kutsal Kanal (2/dinlenme); Alan özelliği", 8: "Ölümsüzleri Yok Etme (ZD 1); Alan özelliği", 10: "İlahi Müdahale", 11: "Ölümsüzleri Yok Etme (ZD 2)", 14: "Ölümsüzleri Yok Etme (ZD 3)", 17: "Ölümsüzleri Yok Etme (ZD 4); Alan özelliği", 18: "Kutsal Kanal (3/dinlenme)", 20: "İlahi Müdahale kendiliğinden başarılı" },
    druid: { 2: "Vahşi Biçim (en çok ZD 1/4, yüzme ve uçma yok); Druid Çemberi", 4: "Vahşi Biçim (ZD 1/2, uçma yok)", 6: "Çember özelliği", 8: "Vahşi Biçim (ZD 1)", 10: "Çember özelliği", 14: "Çember özelliği", 18: "Zamansız Beden; Hayvan Büyüleri", 20: "Baş Druid" },
    fighter: { 2: "Eylem Atılımı (1)", 3: "Dövüş Arketipi", 5: "Ek Saldırı", 7: "Arketip özelliği", 9: "Yılmaz (1)", 10: "Arketip özelliği", 11: "Ek Saldırı (2)", 13: "Yılmaz (2)", 15: "Arketip özelliği", 17: "Eylem Atılımı (2); Yılmaz (3)", 18: "Arketip özelliği", 20: "Ek Saldırı (3)" },
    monk: { 2: "Ki (seviye kadar puan): Darbe Yağmuru, Sabırlı Savunma, Rüzgâr Adımı; Zırhsız Hareket (+10 ft)", 3: "Manastır Geleneği; Okları Saptırma", 4: "Yavaş Düşüş", 5: "Ek Saldırı; Sersemletici Vuruş; Dövüş Sanatları d6", 6: "Ki Güçlü Vuruşlar; Gelenek özelliği", 7: "Kaçınma; Zihin Dinginliği", 10: "Bedenin Saflığı", 11: "Gelenek özelliği; Dövüş Sanatları d8", 13: "Güneş ve Ayın Dili", 14: "Elmas Ruh", 15: "Zamansız Beden", 17: "Gelenek özelliği; Dövüş Sanatları d10", 18: "Boş Beden", 20: "Kusursuz Benlik" },
    paladin: { 2: "Savaş Stili; Büyücülük; İlahi Vuruş", 3: "İlahi Sağlık; Kutsal Yemin", 5: "Ek Saldırı", 6: "Koruma Aurası", 7: "Yemin özelliği", 10: "Cesaret Aurası", 11: "Geliştirilmiş İlahi Vuruş (+1d8 ışıltı)", 14: "Arındırıcı Dokunuş", 15: "Yemin özelliği", 18: "Aura geliştirmesi (30 ft)", 20: "Yemin özelliği" },
    ranger: { 2: "Savaş Stili; Büyücülük", 3: "Korucu Arketipi; İlkel Farkındalık", 5: "Ek Saldırı", 6: "Favori Düşman ve Doğal Kaşif geliştirmesi", 7: "Arketip özelliği", 8: "Toprakta Adım", 10: "Doğal Kaşif geliştirmesi; Göz Önünde Saklanma", 11: "Arketip özelliği", 14: "Favori Düşman geliştirmesi; Kaybolma", 15: "Arketip özelliği", 18: "Vahşi Duyular", 20: "Düşman Avcısı" },
    rogue: { 2: "Kurnaz Eylem", 3: "Haydut Arketipi; Sinsi Saldırı 2d6", 5: "Esrarengiz Kaçış; Sinsi Saldırı 3d6", 6: "Uzmanlık (2 beceri)", 7: "Kaçınma; Sinsi Saldırı 4d6", 9: "Arketip özelliği; Sinsi Saldırı 5d6", 11: "Güvenilir Yetenek; Sinsi Saldırı 6d6", 13: "Arketip özelliği; Sinsi Saldırı 7d6", 14: "Kör Hissi", 15: "Kaygan Zihin; Sinsi Saldırı 8d6", 17: "Arketip özelliği; Sinsi Saldırı 9d6", 18: "Yakalanmaz", 19: "Sinsi Saldırı 10d6", 20: "Şans Darbesi" },
    sorcerer: { 2: "Büyü Kaynağı (seviye kadar büyücülük puanı)", 3: "Metabüyü (2 seçenek)", 6: "Köken özelliği", 10: "Metabüyü (1 seçenek daha)", 14: "Köken özelliği", 17: "Metabüyü (1 seçenek daha)", 18: "Köken özelliği", 20: "Büyüsel Yenilenme" },
    warlock: { 2: "Ötedünya Çağrıları (2)", 3: "Pakt Armağanı (Zincir, Kılıç ya da Tomar)", 5: "Çağrı (3)", 6: "Hami özelliği", 7: "Çağrı (4)", 9: "Çağrı (5)", 10: "Hami özelliği", 11: "Gizemli Arkanum (6. seviye büyü, günde 1)", 12: "Çağrı (6)", 13: "Gizemli Arkanum (7. seviye)", 14: "Hami özelliği", 15: "Gizemli Arkanum (8. seviye); Çağrı (7)", 17: "Gizemli Arkanum (9. seviye)", 18: "Çağrı (8)", 20: "Ötedünya Ustası" },
    wizard: { 2: "Büyü Okulu", 6: "Okul özelliği", 10: "Okul özelliği", 14: "Okul özelliği", 18: "Büyü Ustalığı", 20: "İmza Büyüler" },
  };
  CLASSES.forEach(c => Object.assign(c, EXTRA[c.k] || {}));

  /* ---------------- Büyüler ---------------- */
  // [anahtar, İngilizce ad, Türkçe ad, seviye, okul, sınıflar, süre, menzil, etki süresi, bayraklar, tür, kurtarma, zar, hasar türü, seviye başına zar, özet]
  // bayraklar: c konsantrasyon, r ritüel, m büyü bonusu eklenir, b hile her kademede bir ışın daha (ayrı saldırılar).
  // tür: atk (büyü saldırısı), save (kurtarma), heal (iyileştirme), auto (kendiliğinden isabet), roll (yalnızca zar), util (zar yok).
  const A = "1 eylem", BA = "1 bonus eylem", RE = "1 reaksiyon", IN = "Anlık", TO = "Dokunma", SE = "Kendisi";
  const RAW = [
    ["acid-splash", "Acid Splash", "Asit Sıçraması", 0, "Çağırma", "SW", A, "60 ft", IN, "", "save", "dex", "1d6", "asit", "", "Bir ya da yan yana duran iki yaratık ÇEV kurtarması yapar; başarısız olan asit hasarı alır."],
    ["chill-touch", "Chill Touch", "Soğuk Dokunuş", 0, "Ölübilim", "SKW", A, "120 ft", "1 tur", "", "atk", "", "1d8", "nekrotik", "", "Hayalet bir el hedefe vurur; hedef bir sonraki turuna kadar can kazanamaz."],
    ["dancing-lights", "Dancing Lights", "Dans Eden Işıklar", 0, "Yıkım", "BSW", A, "120 ft", "1 dakika", "c", "util", "", "", "", "", "Havada süzülen dört meşale ışığı yaratırsın ve onları yönetirsin."],
    ["druidcraft", "Druidcraft", "Druid Hüneri", 0, "Dönüşüm", "D", A, "30 ft", IN, "", "util", "", "", "", "", "Küçük doğa etkileri: hava tahmini, çiçek açtırma, küçük duyusal etkiler."],
    ["eldritch-blast", "Eldritch Blast", "Ötedünya Patlaması", 0, "Yıkım", "K", A, "120 ft", IN, "b", "atk", "", "1d10", "güç", "", "Bir çatırtılı enerji ışını. 5., 11. ve 17. seviyede birer ışın daha; her ışın ayrı saldırıdır."],
    ["fire-bolt", "Fire Bolt", "Ateş Oku", 0, "Yıkım", "SW", A, "120 ft", IN, "", "atk", "", "1d10", "ateş", "", "Bir ateş zerresi fırlatırsın; giyilmeyen yanıcı eşyaları tutuşturur."],
    ["guidance", "Guidance", "Rehberlik", 0, "Kehanet", "CD", A, TO, "1 dakika", "c", "roll", "", "1d4", "", "", "Hedef, büyü bitmeden yapacağı bir yetenek kontrolüne 1d4 ekler."],
    ["light", "Light", "Işık", 0, "Yıkım", "BCSW", A, TO, "1 saat", "", "util", "", "", "", "", "Dokunduğun nesne 20 ft parlak, 20 ft loş ışık saçar."],
    ["mage-hand", "Mage Hand", "Büyülü El", 0, "Çağırma", "BSKW", A, "30 ft", "1 dakika", "", "util", "", "", "", "", "Hayalet bir el en fazla 10 pound taşır, kapı açar, nesneyi alır."],
    ["mending", "Mending", "Onarma", 0, "Dönüşüm", "BCDSW", "1 dakika", TO, IN, "", "util", "", "", "", "", "Kırık bir zinciri, yırtık bir pelerini ya da benzeri tek bir hasarı onarır."],
    ["message", "Message", "Mesaj", 0, "Dönüşüm", "BSW", A, "120 ft", "1 tur", "", "util", "", "", "", "", "Bir yaratığa fısıltıyla mesaj gönderirsin; o da fısıltıyla cevap verebilir."],
    ["minor-illusion", "Minor Illusion", "Küçük Yanılsama", 0, "Yanılsama", "BSKW", A, "30 ft", "1 dakika", "", "util", "", "", "", "", "Bir ses ya da 5 ft küplük hareketsiz bir görüntü yaratırsın."],
    ["poison-spray", "Poison Spray", "Zehir Püskürtme", 0, "Çağırma", "DSKW", A, "10 ft", IN, "", "save", "con", "1d12", "zehir", "", "Avucundan zehirli bir buhar püskürür; hedef DAY kurtarması yapar."],
    ["prestidigitation", "Prestidigitation", "Küçük Hüner", 0, "Dönüşüm", "BSKW", A, "10 ft", "1 saat", "", "util", "", "", "", "", "Küçük büyü numaraları: temizleme, ısıtma, kıvılcım, küçük işaretler."],
    ["produce-flame", "Produce Flame", "Alev Çıkar", 0, "Çağırma", "D", A, SE, "10 dakika", "", "atk", "", "1d8", "ateş", "", "Avucunda bir alev belirir; ışık verir ya da 30 ft'e fırlatıp saldırırsın."],
    ["ray-of-frost", "Ray of Frost", "Buz Işını", 0, "Yıkım", "SW", A, "60 ft", IN, "", "atk", "", "1d8", "soğuk", "", "Buz mavisi bir ışın; isabet ederse hedefin hızı bir tur 10 ft azalır."],
    ["resistance", "Resistance", "Direnç", 0, "Koruma", "CD", A, TO, "1 dakika", "c", "roll", "", "1d4", "", "", "Hedef, büyü bitmeden yapacağı bir kurtarma zarına 1d4 ekler."],
    ["sacred-flame", "Sacred Flame", "Kutsal Alev", 0, "Yıkım", "C", A, "60 ft", IN, "", "save", "dex", "1d8", "ışıltı", "", "Hedefin üzerine ışıltılı alev iner; siperden bu kurtarmada fayda sağlanmaz."],
    ["shillelagh", "Shillelagh", "Şillelağ", 0, "Dönüşüm", "D", BA, TO, "1 dakika", "", "util", "", "", "", "", "Sopa ya da asan büyülenir: saldırı ve hasarda büyü yeteneğini kullanırsın, hasar zarı d8 olur."],
    ["shocking-grasp", "Shocking Grasp", "Şok Edici Kavrayış", 0, "Yıkım", "SW", A, TO, IN, "", "atk", "", "1d8", "şimşek", "", "Metal zırhlı hedefe avantajla saldırırsın; isabet ederse hedef reaksiyon alamaz."],
    ["spare-the-dying", "Spare the Dying", "Ölmekte Olanı Kurtar", 0, "Ölübilim", "C", A, TO, IN, "", "util", "", "", "", "", "0 CP'deki bir yaratığı dengeye getirirsin; ölüm kurtarması atmayı bırakır."],
    ["thaumaturgy", "Thaumaturgy", "Mucize", 0, "Dönüşüm", "C", A, "30 ft", "1 dakika", "", "util", "", "", "", "", "Sesini gürleştirir, alevleri titretir, yeri sarsar: küçük ilahi işaretler."],
    ["true-strike", "True Strike", "Kesin Vuruş", 0, "Kehanet", "BSKW", A, "30 ft", "1 tur", "c", "util", "", "", "", "", "Bir sonraki turunda bu hedefe yaptığın ilk saldırı avantajlı olur."],
    ["vicious-mockery", "Vicious Mockery", "Acımasız Alay", 0, "Büyüleme", "B", A, "60 ft", IN, "", "save", "wis", "1d4", "psişik", "", "Büyülü hakaretler; başarısız olan hedef bir sonraki saldırısını dezavantajla yapar."],

    ["bless", "Bless", "Kutsama", 1, "Büyüleme", "CP", A, "30 ft", "1 dakika", "c", "roll", "", "1d4", "", "", "En çok üç yaratık saldırı ve kurtarma zarlarına 1d4 ekler. Her üst seviyede bir hedef daha."],
    ["burning-hands", "Burning Hands", "Yakıcı Eller", 1, "Yıkım", "SW", A, "Kendisi (15 ft koni)", IN, "", "save", "dex", "3d6", "ateş", "1d6", "Parmaklarından alev yelpazesi çıkar; başarılı kurtarmada yarı hasar."],
    ["charm-person", "Charm Person", "Kişi Büyüleme", 1, "Büyüleme", "BDSKW", A, "30 ft", "1 saat", "", "save", "wis", "", "", "", "İnsansı bir hedef seni dost sanar. Her üst seviyede bir hedef daha."],
    ["color-spray", "Color Spray", "Renk Spreyi", 1, "Yanılsama", "SW", A, "Kendisi (15 ft koni)", "1 tur", "", "roll", "", "6d10", "", "2d10", "Zar kadar can puanındaki yaratıklar, en düşük canlıdan başlayarak kör olur."],
    ["command", "Command", "Emir", 1, "Büyüleme", "CP", A, "60 ft", "1 tur", "", "save", "wis", "", "", "", "Tek kelimelik bir emir verirsin (Kaç, Yere, Dur...). Her üst seviyede bir hedef daha."],
    ["comprehend-languages", "Comprehend Languages", "Dilleri Anlama", 1, "Kehanet", "BKSW", A, SE, "1 saat", "r", "util", "", "", "", "", "Duyduğun her dili anlar, okuduğun her yazıyı çözersin."],
    ["cure-wounds", "Cure Wounds", "Yaraları İyileştir", 1, "Yıkım", "BCDPR", A, TO, IN, "m", "heal", "", "1d8", "", "1d8", "Dokunduğun yaratık zar + büyü bonusu kadar can kazanır."],
    ["detect-magic", "Detect Magic", "Büyü Algıla", 1, "Kehanet", "BCDPRSW", A, SE, "10 dakika", "cr", "util", "", "", "", "", "30 ft içindeki büyünün varlığını ve okulunu algılarsın."],
    ["disguise-self", "Disguise Self", "Kılık Değiştirme", 1, "Yanılsama", "BSW", A, SE, "1 saat", "", "util", "", "", "", "", "Görünüşünü, giysilerini ve teçhizatını değiştirirsin."],
    ["divine-favor", "Divine Favor", "İlahi Lütuf", 1, "Yıkım", "P", BA, SE, "1 dakika", "c", "roll", "", "1d4", "ışıltı", "", "Silah saldırıların isabet edince 1d4 ışıltı hasarı ekler."],
    ["entangle", "Entangle", "Dolaştırma", 1, "Çağırma", "D", A, "90 ft", "1 dakika", "c", "save", "str", "", "", "", "20 ft karede otlar ve sarmaşıklar çıkar; başarısız olanlar kısıtlanır."],
    ["expeditious-retreat", "Expeditious Retreat", "Hızlı Geri Çekilme", 1, "Dönüşüm", "SKW", BA, SE, "10 dakika", "c", "util", "", "", "", "", "Her turunda bonus eylemle Atılma yapabilirsin."],
    ["faerie-fire", "Faerie Fire", "Peri Ateşi", 1, "Yıkım", "BD", A, "60 ft", "1 dakika", "c", "save", "dex", "", "", "", "20 ft küp içindekiler parlar; onlara yapılan saldırılar avantajlı, görünmez kalamazlar."],
    ["false-life", "False Life", "Sahte Yaşam", 1, "Ölübilim", "SW", A, SE, "1 saat", "", "roll", "", "1d4+4", "geçici can", "5", "Zar kadar geçici can kazanırsın."],
    ["feather-fall", "Feather Fall", "Tüy Düşüşü", 1, "Dönüşüm", "BSW", RE, "60 ft", "1 dakika", "", "util", "", "", "", "", "Düşen en çok beş yaratık yavaşça süzülür ve hasar almaz."],
    ["fog-cloud", "Fog Cloud", "Sis Bulutu", 1, "Çağırma", "DRSW", A, "120 ft", "1 saat", "c", "util", "", "", "", "", "20 ft yarıçaplı yoğun sis; alan tamamen görüşü engeller. Her üst seviyede yarıçap +20 ft."],
    ["goodberry", "Goodberry", "İyi Çilek", 1, "Dönüşüm", "DR", A, TO, IN, "", "util", "", "", "", "", "10 çilek yaratırsın; her biri 1 can verir ve bir günlük besindir."],
    ["guiding-bolt", "Guiding Bolt", "Yol Gösteren Şimşek", 1, "Yıkım", "C", A, "120 ft", "1 tur", "", "atk", "", "4d6", "ışıltı", "1d6", "Işık oku; isabet ederse hedefe yapılan bir sonraki saldırı avantajlı."],
    ["healing-word", "Healing Word", "Şifa Sözü", 1, "Yıkım", "BCD", BA, "60 ft", IN, "m", "heal", "", "1d4", "", "1d4", "Gördüğün bir yaratık zar + büyü bonusu kadar can kazanır."],
    ["hellish-rebuke", "Hellish Rebuke", "Cehennemî Karşılık", 1, "Yıkım", "K", RE, "60 ft", IN, "", "save", "dex", "2d10", "ateş", "1d10", "Sana hasar veren yaratık alevler içinde kalır; başarılı kurtarmada yarı hasar."],
    ["heroism", "Heroism", "Kahramanlık", 1, "Büyüleme", "BP", A, TO, "1 dakika", "c", "util", "", "", "", "", "Hedef korkutulamaz; her turunun başında büyü bonusu kadar geçici can alır."],
    ["hunters-mark", "Hunter's Mark", "Avcının İşareti", 1, "Kehanet", "R", BA, "90 ft", "1 saat", "c", "roll", "", "1d6", "", "", "İşaretlediğin hedefe her silah isabetinde +1d6 hasar; onu izlemede avantaj."],
    ["identify", "Identify", "Tanımla", 1, "Kehanet", "BW", "1 dakika", TO, IN, "r", "util", "", "", "", "", "Bir eşyanın büyülü özelliklerini ve nasıl kullanıldığını öğrenirsin."],
    ["inflict-wounds", "Inflict Wounds", "Yara Aç", 1, "Ölübilim", "C", A, TO, IN, "", "atk", "", "3d10", "nekrotik", "1d10", "Dokunduğun yaratığa yakın dövüş büyü saldırısı."],
    ["longstrider", "Longstrider", "Uzun Adım", 1, "Dönüşüm", "BDRW", A, TO, "1 saat", "", "util", "", "", "", "", "Hedefin hızı 10 ft artar. Her üst seviyede bir hedef daha."],
    ["mage-armor", "Mage Armor", "Büyü Zırhı", 1, "Koruma", "SW", A, TO, "8 saat", "", "util", "", "", "", "", "Zırh giymeyen hedefin ZS'si 13 + ÇEV olur."],
    ["magic-missile", "Magic Missile", "Büyülü Füze", 1, "Yıkım", "SW", A, "120 ft", IN, "", "auto", "", "3d4+3", "güç", "1d4+1", "Üç parlak füze, her biri kendiliğinden isabet eder (1d4+1). Her üst seviyede bir füze daha."],
    ["protection-from-evil-and-good", "Protection from Evil and Good", "Kötüye ve İyiye Karşı Koruma", 1, "Koruma", "CKPW", A, TO, "10 dakika", "c", "util", "", "", "", "", "Sapkın varlıklar (iblis, ölümsüz, peri...) hedefe dezavantajla saldırır."],
    ["sanctuary", "Sanctuary", "Sığınak", 1, "Koruma", "C", BA, "30 ft", "1 dakika", "", "save", "wis", "", "", "", "Hedefe saldırmak isteyen önce BİL kurtarması yapar."],
    ["shield", "Shield", "Kalkan", 1, "Koruma", "SW", RE, SE, "1 tur", "", "util", "", "", "", "", "Bir sonraki turuna kadar ZS'n +5; Büyülü Füze sana zarar vermez."],
    ["shield-of-faith", "Shield of Faith", "İnanç Kalkanı", 1, "Koruma", "CP", BA, "60 ft", "10 dakika", "c", "util", "", "", "", "", "Hedefin ZS'si +2."],
    ["sleep", "Sleep", "Uyku", 1, "Büyüleme", "BSW", A, "90 ft", "1 dakika", "", "roll", "", "5d8", "", "2d8", "Zar kadar can puanındaki yaratıklar, en düşük canlıdan başlayarak uykuya dalar."],
    ["thunderwave", "Thunderwave", "Gök Gürültüsü Dalgası", 1, "Yıkım", "BDSW", A, "Kendisi (15 ft küp)", IN, "", "save", "con", "2d8", "gök gürültüsü", "1d8", "Bir şok dalgası; başarısız olanlar 10 ft itilir, başarılı olan yarı hasar alır."],

    ["aid", "Aid", "Yardım", 2, "Koruma", "CP", A, "30 ft", "8 saat", "", "util", "", "", "", "", "Üç yaratığın azami ve mevcut canı 5 artar. Her üst seviyede +5 daha."],
    ["blur", "Blur", "Bulanıklık", 2, "Yanılsama", "SW", A, SE, "1 dakika", "c", "util", "", "", "", "", "Bedenin bulanıklaşır; sana yapılan saldırılar dezavantajlı."],
    ["darkness", "Darkness", "Karanlık", 2, "Yıkım", "SKW", A, "60 ft", "10 dakika", "c", "util", "", "", "", "", "15 ft yarıçaplı büyülü karanlık; karanlıkta görüş bile delemez."],
    ["darkvision", "Darkvision", "Karanlıkta Görüş", 2, "Dönüşüm", "DRSW", A, TO, "8 saat", "", "util", "", "", "", "", "Hedef 60 ft karanlıkta görür."],
    ["enhance-ability", "Enhance Ability", "Yeteneği Güçlendir", 2, "Dönüşüm", "BCDS", A, TO, "1 saat", "c", "util", "", "", "", "", "Seçtiğin bir yetenekte kontrollere avantaj (ve bir yan etki)."],
    ["flaming-sphere", "Flaming Sphere", "Alevli Küre", 2, "Çağırma", "DW", A, "60 ft", "1 dakika", "c", "save", "dex", "2d6", "ateş", "1d6", "5 ft'lik bir ateş küresi; bonus eylemle yuvarlarsın."],
    ["heat-metal", "Heat Metal", "Metal Isıtma", 2, "Dönüşüm", "BD", A, "60 ft", "1 dakika", "c", "auto", "", "2d8", "ateş", "1d8", "Metal bir eşya kızgınlaşır; tutan ya da giyen hasar alır."],
    ["hold-person", "Hold Person", "Kişiyi Durdur", 2, "Büyüleme", "BCDSKW", A, "60 ft", "1 dakika", "c", "save", "wis", "", "", "", "İnsansı hedef felç olur; her turunun sonunda yeniden kurtarma atar."],
    ["invisibility", "Invisibility", "Görünmezlik", 2, "Yanılsama", "BSKW", A, TO, "1 saat", "c", "util", "", "", "", "", "Hedef görünmez olur; saldırı ya da büyü yapınca biter."],
    ["lesser-restoration", "Lesser Restoration", "Küçük Onarım", 2, "Koruma", "BCDPR", A, TO, IN, "", "util", "", "", "", "", "Bir hastalığı ya da kör, sağır, felçli veya zehirlenmiş durumunu sonlandırır."],
    ["misty-step", "Misty Step", "Sisli Adım", 2, "Çağırma", "SKW", BA, SE, IN, "", "util", "", "", "", "", "Gördüğün 30 ft içindeki bir yere ışınlanırsın."],
    ["moonbeam", "Moonbeam", "Ay Işını", 2, "Yıkım", "D", A, "120 ft", "1 dakika", "c", "save", "con", "2d10", "ışıltı", "1d10", "5 ft yarıçaplı gümüş ışık sütunu; içine giren DAY kurtarması yapar."],
    ["pass-without-trace", "Pass without Trace", "İz Bırakmadan Geç", 2, "Koruma", "DR", A, SE, "1 saat", "c", "util", "", "", "", "", "30 ft içindeki müttefiklerin Gizlilik kontrollerine +10."],
    ["prayer-of-healing", "Prayer of Healing", "İyileştirme Duası", 2, "Yıkım", "C", "10 dakika", "30 ft", IN, "m", "heal", "", "2d8", "", "1d8", "En çok altı yaratık zar + büyü bonusu kadar can kazanır."],
    ["scorching-ray", "Scorching Ray", "Kavurucu Işın", 2, "Yıkım", "SW", A, "120 ft", IN, "", "atk", "", "2d6", "ateş", "", "Üç ateş ışını, her biri ayrı saldırı. Her üst seviyede bir ışın daha.", 3],
    ["shatter", "Shatter", "Parçalama", 2, "Yıkım", "BSKW", A, "60 ft", IN, "", "save", "con", "3d8", "gök gürültüsü", "1d8", "10 ft yarıçaplı patlayan bir çınlama; başarılı kurtarmada yarı hasar."],
    ["silence", "Silence", "Sessizlik", 2, "Yanılsama", "BCR", A, "120 ft", "10 dakika", "cr", "util", "", "", "", "", "20 ft yarıçapta hiçbir ses çıkmaz; sözlü büyüler yapılamaz."],
    ["spike-growth", "Spike Growth", "Diken Büyütme", 2, "Dönüşüm", "DR", A, "150 ft", "10 dakika", "c", "roll", "", "2d4", "delici", "", "20 ft yarıçap zorlu arazi olur; her 5 ft harekette 2d4 delici hasar."],
    ["spiritual-weapon", "Spiritual Weapon", "Ruhani Silah", 2, "Yıkım", "C", BA, "60 ft", "1 dakika", "m", "atk", "", "1d8", "güç", "1d8/2", "Süzülen bir hayalet silah; bonus eylemle hareket ettirip saldırırsın. Her iki üst seviyede +1d8."],
    ["suggestion", "Suggestion", "Telkin", 2, "Büyüleme", "BSKW", A, "30 ft", "8 saat", "c", "save", "wis", "", "", "", "Makul görünen bir eylem önerirsin; başarısız olan hedef uyar."],
    ["web", "Web", "Ağ", 2, "Çağırma", "SW", A, "60 ft", "1 saat", "c", "save", "dex", "", "", "", "20 ft küp yapışkan ağ; başarısız olanlar kısıtlanır."],

    ["call-lightning", "Call Lightning", "Yıldırım Çağır", 3, "Çağırma", "D", A, "120 ft", "10 dakika", "c", "save", "dex", "3d10", "şimşek", "1d10", "Bir fırtına bulutu çağırırsın; her turunda bir yıldırım indirebilirsin."],
    ["counterspell", "Counterspell", "Karşı Büyü", 3, "Koruma", "SKW", RE, "60 ft", IN, "", "util", "", "", "", "", "Yapılan bir büyüyü bozarsın; 4. seviye ve üstü için yetenek kontrolü gerekir."],
    ["daylight", "Daylight", "Gün Işığı", 3, "Yıkım", "CDPRS", A, "60 ft", "1 saat", "", "util", "", "", "", "", "60 ft yarıçap parlak ışık; 3. seviye ve altı büyülü karanlığı dağıtır."],
    ["dispel-magic", "Dispel Magic", "Büyü Bozma", 3, "Koruma", "BCDPSKW", A, "120 ft", IN, "", "util", "", "", "", "", "Bir hedefteki 3. seviye ve altı büyüler sona erer; üstü için kontrol gerekir."],
    ["fear", "Fear", "Korku", 3, "Yanılsama", "BSKW", A, "Kendisi (30 ft koni)", "1 dakika", "c", "save", "wis", "", "", "", "Başarısız olanlar elindekini düşürür, korkar ve senden kaçar."],
    ["fireball", "Fireball", "Ateş Topu", 3, "Yıkım", "SW", A, "150 ft", IN, "", "save", "dex", "8d6", "ateş", "1d6", "20 ft yarıçaplı patlama; başarılı kurtarmada yarı hasar."],
    ["fly", "Fly", "Uçma", 3, "Dönüşüm", "SKW", A, TO, "10 dakika", "c", "util", "", "", "", "", "Hedef 60 ft uçma hızı kazanır. Her üst seviyede bir hedef daha."],
    ["haste", "Haste", "Hızlandırma", 3, "Dönüşüm", "SW", A, "30 ft", "1 dakika", "c", "util", "", "", "", "", "Hedefin hızı iki katı, ZS +2, ÇEV kurtarmalarında avantaj ve ek bir eylem."],
    ["hypnotic-pattern", "Hypnotic Pattern", "Hipnotik Desen", 3, "Yanılsama", "BSKW", A, "120 ft", "1 dakika", "c", "save", "wis", "", "", "", "30 ft küpteki yaratıklar büyülenir ve aciz kalır."],
    ["lightning-bolt", "Lightning Bolt", "Şimşek", 3, "Yıkım", "SW", A, "Kendisi (100 ft çizgi)", IN, "", "save", "dex", "8d6", "şimşek", "1d6", "100 ft uzunluğunda bir şimşek; başarılı kurtarmada yarı hasar."],
    ["mass-healing-word", "Mass Healing Word", "Toplu Şifa Sözü", 3, "Yıkım", "C", BA, "60 ft", IN, "m", "heal", "", "1d4", "", "1d4", "En çok altı yaratık zar + büyü bonusu kadar can kazanır."],
    ["remove-curse", "Remove Curse", "Laneti Kaldır", 3, "Koruma", "CPKW", A, TO, IN, "", "util", "", "", "", "", "Bir yaratık ya da eşya üzerindeki lanetler kalkar."],
    ["revivify", "Revivify", "Diriltme", 3, "Ölübilim", "CP", A, TO, IN, "", "util", "", "", "", "", "Son bir dakika içinde ölen yaratık 1 canla dirilir (300 ap elmas gerekir)."],
    ["sleet-storm", "Sleet Storm", "Sulu Sepken", 3, "Çağırma", "DSW", A, "150 ft", "1 dakika", "c", "save", "dex", "", "", "", "40 ft yarıçapta buzlu fırtına; zemin kaygan olur, başarısız olan düşer."],
    ["slow", "Slow", "Yavaşlatma", 3, "Dönüşüm", "SW", A, "120 ft", "1 dakika", "c", "save", "wis", "", "", "", "En çok altı yaratık yavaşlar: hız yarıya, ZS −2, tek eylem."],
    ["spirit-guardians", "Spirit Guardians", "Ruh Muhafızları", 3, "Çağırma", "C", A, "Kendisi (15 ft)", "10 dakika", "c", "save", "wis", "3d8", "ışıltı", "1d8", "Etrafında dönen ruhlar; düşmanlar yavaşlar ve hasar alır (başarıda yarı)."],
    ["stinking-cloud", "Stinking Cloud", "Pis Kokulu Bulut", 3, "Çağırma", "BSW", A, "90 ft", "1 dakika", "c", "save", "con", "", "", "", "20 ft yarıçaplı mide bulandırıcı gaz; başarısız olan turunu öğürerek geçirir."],
    ["vampiric-touch", "Vampiric Touch", "Vampir Dokunuşu", 3, "Ölübilim", "KW", A, SE, "1 dakika", "c", "atk", "", "3d6", "nekrotik", "1d6", "Yakın dövüş büyü saldırısı; verdiğin hasarın yarısı kadar can kazanırsın."],

    ["banishment", "Banishment", "Sürgün", 4, "Koruma", "CPSKW", A, "60 ft", "1 dakika", "c", "save", "cha", "", "", "", "Hedef başka bir düzleme gönderilir. Her üst seviyede bir hedef daha."],
    ["death-ward", "Death Ward", "Ölüm Koruması", 4, "Koruma", "CP", A, TO, "8 saat", "", "util", "", "", "", "", "Hedef ilk kez 0 cana düştüğünde 1 canla kalır."],
    ["dimension-door", "Dimension Door", "Boyut Kapısı", 4, "Çağırma", "BSKW", A, "500 ft", IN, "", "util", "", "", "", "", "Kendini (ve bir yanındakini) 500 ft içinde bir yere ışınlarsın."],
    ["freedom-of-movement", "Freedom of Movement", "Hareket Özgürlüğü", 4, "Koruma", "BCDR", A, TO, "1 saat", "", "util", "", "", "", "", "Hedefin hareketi büyüyle yavaşlatılamaz, felç ya da kısıtlanamaz."],
    ["greater-invisibility", "Greater Invisibility", "Büyük Görünmezlik", 4, "Yanılsama", "BSW", A, TO, "1 dakika", "c", "util", "", "", "", "", "Hedef saldırsa ya da büyü yapsa bile görünmez kalır."],
    ["guardian-of-faith", "Guardian of Faith", "İnanç Muhafızı", 4, "Çağırma", "C", A, "30 ft", "8 saat", "", "save", "dex", "20", "ışıltı", "", "Spektral bir muhafız; yaklaşan düşmanlara hasar verir (toplam 60)."],
    ["ice-storm", "Ice Storm", "Buz Fırtınası", 4, "Yıkım", "DSW", A, "300 ft", IN, "", "save", "dex", "2d8+4d6", "ezici ve soğuk", "1d8", "20 ft yarıçapa dolu yağar; alan zorlu arazi olur. Başarıda yarı hasar."],
    ["polymorph", "Polymorph", "Biçim Değiştirme", 4, "Dönüşüm", "BDSW", A, "60 ft", "1 saat", "c", "save", "wis", "", "", "", "Hedefi bir hayvana dönüştürürsün."],
    ["stoneskin", "Stoneskin", "Taş Deri", 4, "Koruma", "DRSW", A, TO, "1 saat", "c", "util", "", "", "", "", "Hedef büyüsüz fiziksel hasara direnç kazanır."],
    ["wall-of-fire", "Wall of Fire", "Ateş Duvarı", 4, "Yıkım", "DSW", A, "120 ft", "1 dakika", "c", "save", "dex", "5d8", "ateş", "1d8", "60 ft uzunluğunda bir ateş duvarı; bir tarafı yakıcıdır."],

    ["cone-of-cold", "Cone of Cold", "Soğuk Konisi", 5, "Yıkım", "SW", A, "Kendisi (60 ft koni)", IN, "", "save", "con", "8d8", "soğuk", "1d8", "Dondurucu bir hava patlaması; başarılı kurtarmada yarı hasar."],
    ["flame-strike", "Flame Strike", "Alev Darbesi", 5, "Yıkım", "C", A, "60 ft", IN, "", "save", "dex", "8d6", "ateş ve ışıltı", "1d6", "Gökten inen ilahi ateş sütunu; başarılı kurtarmada yarı hasar."],
    ["greater-restoration", "Greater Restoration", "Büyük Onarım", 5, "Koruma", "BCD", A, TO, IN, "", "util", "", "", "", "", "Bir bitkinlik seviyesini, büyülenme, taşlaşma, lanet ya da yetenek azalmasını giderir."],
    ["hold-monster", "Hold Monster", "Canavarı Durdur", 5, "Büyüleme", "BSKW", A, "90 ft", "1 dakika", "c", "save", "wis", "", "", "", "Herhangi bir yaratık felç olur. Her üst seviyede bir hedef daha."],
    ["mass-cure-wounds", "Mass Cure Wounds", "Toplu Yara İyileştirme", 5, "Yıkım", "BCD", A, "60 ft", IN, "m", "heal", "", "3d8", "", "1d8", "En çok altı yaratık zar + büyü bonusu kadar can kazanır."],
    ["raise-dead", "Raise Dead", "Ölüyü Dirilt", 5, "Ölübilim", "BCP", "1 saat", TO, IN, "", "util", "", "", "", "", "En çok 10 gün önce ölmüş bir yaratığı diriltirsin (500 ap elmas)."],
    ["telekinesis", "Telekinesis", "Telekinezi", 5, "Dönüşüm", "SW", A, "60 ft", "10 dakika", "c", "util", "", "", "", "", "Zihninle yaratıkları ya da 1000 pound'a kadar nesneleri hareket ettirirsin."],
    ["wall-of-stone", "Wall of Stone", "Taş Duvar", 5, "Yıkım", "DSW", A, "120 ft", "10 dakika", "c", "util", "", "", "", "", "Taştan bir duvar yaratırsın; 10 dakika sürerse kalıcı olur."],

    ["chain-lightning", "Chain Lightning", "Zincirleme Şimşek", 6, "Yıkım", "SW", A, "150 ft", IN, "", "save", "dex", "10d8", "şimşek", "", "Bir hedefe ve ondan sekip üç hedefe daha şimşek. Her üst seviyede bir sekme daha."],
    ["disintegrate", "Disintegrate", "Parçalayıp Yok Et", 6, "Dönüşüm", "SW", A, "60 ft", IN, "", "save", "dex", "10d6+40", "güç", "3d6", "Yeşil bir ışın; 0 cana düşen hedef toza dönüşür."],
    ["harm", "Harm", "Zarar", 6, "Ölübilim", "C", A, "60 ft", IN, "", "save", "con", "14d6", "nekrotik", "", "Hedef virüslü bir hastalıkla sarsılır; başarıda yarı hasar."],
    ["heal", "Heal", "Şifa", 6, "Yıkım", "CD", A, "60 ft", IN, "", "heal", "", "70", "", "10", "Hedef 70 can kazanır; körlük, sağırlık ve hastalıkları sona erer."],
    ["true-seeing", "True Seeing", "Gerçek Görüş", 6, "Kehanet", "BCSKW", A, TO, "1 saat", "", "util", "", "", "", "", "Hedef 120 ft içinde görünmezleri, yanılsamaları ve gerçek biçimleri görür."],

    ["finger-of-death", "Finger of Death", "Ölüm Parmağı", 7, "Ölübilim", "SKW", A, "60 ft", IN, "", "save", "con", "7d8+30", "nekrotik", "", "Hedefi negatif enerjiyle doldurursun; başarıda yarı hasar."],
    ["fire-storm", "Fire Storm", "Ateş Fırtınası", 7, "Yıkım", "CDS", A, "150 ft", IN, "", "save", "dex", "7d10", "ateş", "", "On adet 10 ft küplük alev; başarıda yarı hasar."],
    ["regenerate", "Regenerate", "Yenilenme", 7, "Dönüşüm", "BCD", "1 dakika", TO, "1 saat", "", "heal", "", "4d8+15", "", "", "Hedef hemen can kazanır, her tur 1 can daha ve kopan uzuvları yeniden büyür."],
    ["teleport", "Teleport", "Işınlanma", 7, "Çağırma", "BSW", A, "10 ft", IN, "", "util", "", "", "", "", "Kendini ve en çok sekiz yaratığı bildiğin bir yere ışınlarsın."],

    ["dominate-monster", "Dominate Monster", "Canavarı Yönet", 8, "Büyüleme", "BSKW", A, "60 ft", "1 saat", "c", "save", "wis", "", "", "", "Hedef senin emirlerine uyar."],
    ["power-word-stun", "Power Word Stun", "Güç Sözü: Sersemlet", 8, "Büyüleme", "BSKW", A, "60 ft", IN, "", "util", "", "", "", "", "150 ya da daha az canı olan hedef sersemler."],
    ["sunburst", "Sunburst", "Güneş Patlaması", 8, "Yıkım", "DSW", A, "150 ft", IN, "", "save", "con", "12d6", "ışıltı", "", "60 ft yarıçaplı güneş ışığı; başarısız olanlar kör olur, başarıda yarı hasar."],

    ["meteor-swarm", "Meteor Swarm", "Meteor Yağmuru", 9, "Yıkım", "SW", A, "1 mil", IN, "", "save", "dex", "40d6", "ateş ve ezici", "", "Dört alev küresi düşer; başarıda yarı hasar."],
    ["power-word-kill", "Power Word Kill", "Güç Sözü: Öldür", 9, "Büyüleme", "BSKW", A, "60 ft", IN, "", "util", "", "", "", "", "100 ya da daha az canı olan hedef ölür."],
    ["time-stop", "Time Stop", "Zamanı Durdur", 9, "Dönüşüm", "SW", A, SE, IN, "", "roll", "", "1d4+1", "", "", "Zaman durur; zar kadar tur art arda hareket edersin."],
    ["wish", "Wish", "Dilek", 9, "Çağırma", "SW", A, SE, IN, "", "util", "", "", "", "", "Ölümlülerin yapabileceği en güçlü büyü: başka bir büyüyü taklit et ya da DM'den bir dilekte bulun."],
  ];
  const SPELLS = RAW.map(r => ({ k: r[0], en: r[1], n: r[2], lvl: r[3], school: r[4], cls: r[5], time: r[6], range: r[7], dur: r[8], conc: r[9].includes("c"), ritual: r[9].includes("r"), mod: r[9].includes("m"), beams: r[9].includes("b"), kind: r[10], save: r[11], dice: r[12], type: r[13], up: r[14], d: r[15], rays: r[16] || 0 }));

  // Bir sınıfta seviye L'de bilinen hile sayısı.
  const cantripsAt = (c, L) => c && c.cant ? c.cant + (L >= 4 ? 1 : 0) + (L >= 10 ? 1 : 0) : 0;
  const asiAt = (c, L) => ((c && c.asi) || ASI).includes(L);

  window.ZM5E = { AB_HELP, RACES, CLASSES, BACKGROUNDS, ALIGN, XP, ASI, FEAT, KNOWN, SPELLS, slotsFor, cantripsAt, asiAt };
})();
