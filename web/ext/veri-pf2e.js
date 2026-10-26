/* Masaüstü eklentileri: Pathfinder 2. edisyon verisi (Player Core 1–2, ORC lisansı).
   Soylar, geçmişler, sınıflar, beceriler, durumlar, büyü yuvası tabloları ve büyü listesi. */
(function () {
  "use strict";

  const ATTR = [["str", "Güç", "GÜÇ"], ["dex", "Çeviklik", "ÇEV"], ["con", "Dayanıklılık", "DAY"], ["int", "Zekâ", "ZEK"], ["wis", "Bilgelik", "BİL"], ["cha", "Karizma", "KAR"]];
  const RANKS = [["U", "Eğitimsiz"], ["T", "Eğitimli"], ["E", "Uzman"], ["M", "Usta"], ["L", "Efsanevi"]];
  // Yeterlilik bonusu: eğitimsiz 0, diğerleri seviye + 2 × rütbe.
  const prof = (rank, level) => rank ? (+level || 1) + 2 * rank : 0;

  const SKILLS = [["acrobatics", "Akrobasi", "dex"], ["arcana", "Arkana", "int"], ["athletics", "Atletizm", "str"], ["crafting", "Zanaat", "int"], ["deception", "Aldatma", "cha"], ["diplomacy", "Diplomasi", "cha"], ["intimidation", "Gözdağı", "cha"], ["medicine", "Tıp", "wis"],
    ["nature", "Doğa", "wis"], ["occultism", "Okültizm", "int"], ["performance", "Performans", "cha"], ["religion", "Din", "wis"], ["society", "Toplum", "int"], ["stealth", "Gizlilik", "dex"], ["survival", "Hayatta Kalma", "wis"], ["thievery", "Hırsızlık", "dex"]];
  const SAVES = [["fort", "Dayanıklılık (Fort)", "con"], ["ref", "Refleks", "dex"], ["will", "İrade", "wis"]];

  // Değerli durumlar (sayıyla) ve açık/kapalı durumlar.
  const VCONDS = [["frightened", "Korkmuş"], ["sickened", "Midesi bulanmış"], ["clumsy", "Sakar"], ["enfeebled", "Güçsüz"], ["drained", "Tükenmiş"], ["stupefied", "Sersem"], ["slowed", "Yavaşlamış"], ["stunned", "Afallamış"]];
  const TCONDS = [["offguard", "Savunmasız"], ["prone", "Yerde"], ["grabbed", "Tutulmuş"], ["restrained", "Kısıtlanmış"], ["blinded", "Kör"], ["dazzled", "Gözü kamaşmış"], ["deafened", "Sağır"], ["concealed", "Örtülü"], ["hidden", "Saklı"], ["invisible", "Görünmez"],
    ["fatigued", "Yorgun"], ["immobilized", "Hareketsiz"], ["paralyzed", "Felçli"], ["unconscious", "Bilinçsiz"], ["quickened", "Hızlanmış"], ["fleeing", "Kaçıyor"], ["confused", "Şaşkın"], ["fascinated", "Büyülenmiş"]];
  const COND_HELP = {
    frightened: "Tüm kontrollerine ve ZK'lerine −X durum cezası; her turunun sonunda 1 azalır.", sickened: "Tüm kontrollerine ve ZK'lerine −X; yiyip içemezsin. Eylem harcayıp Dayanıklılık kurtarmasıyla azaltabilirsin.",
    clumsy: "Çeviklik tabanlı kontrol ve ZK'lere (ZS, Refleks dahil) −X.", enfeebled: "Güç tabanlı kontrol ve ZK'lere (yakın saldırı, Atletizm) −X.", drained: "Dayanıklılık tabanlı kontrollere (Fort) −X; azami canın seviye × X azalır.",
    stupefied: "Zekâ, Bilgelik ve Karizma tabanlı kontrol ve ZK'lere (İrade, Algı, büyüler) −X; büyü yaparken DC 5+X düz kontrol.", slowed: "Her turun başında X eylem eksik alırsın.", stunned: "X eylem kaybedersin; o zamana kadar tepki veremezsin.",
    offguard: "ZS'ne −2 durum dışı (circumstance) ceza.", prone: "Savunmasızsın, saldırı zarlarına −2; kalkmak bir eylem.",
  };

  // Soylar. b: sabit artışlar, free: serbest artış sayısı, flaw: kusur.
  const ANCESTRIES = [
    { k: "dwarf", n: "Cüce (Dwarf)", hp: 10, size: "Orta", speed: 20, b: ["con", "wis"], free: 1, flaw: "cha", d: "Dağların altında yaşayan inatçı ve dayanıklı halk.", t: "Karanlıkta görüş\nAilenin emanet silahı (Clan Dagger)" },
    { k: "elf", n: "Elf", hp: 6, size: "Orta", speed: 30, b: ["dex", "int"], free: 1, flaw: "con", d: "Uzun ömürlü, zarif ve büyüye yatkın; hızlıdırlar.", t: "Alacakaranlık görüşü" },
    { k: "gnome", n: "Gnom (Gnome)", hp: 8, size: "Küçük", speed: 25, b: ["con", "cha"], free: 1, flaw: "str", d: "Peri diyarından gelen, meraklı ve renkli küçük halk.", t: "Alacakaranlık görüşü" },
    { k: "goblin", n: "Goblin", hp: 6, size: "Küçük", speed: 25, b: ["dex", "cha"], free: 1, flaw: "wis", d: "Ateşe ve şarkıya düşkün, kıvrak ve dayanıklı küçük halk.", t: "Karanlıkta görüş" },
    { k: "halfling", n: "Buçukluk (Halfling)", hp: 6, size: "Küçük", speed: 25, b: ["dex", "wis"], free: 1, flaw: "str", d: "İyimser, şanslı ve sessiz adımlı.", t: "Keskin gözler: gizlenen ve saklanan yaratıkları bulmak kolaydır" },
    { k: "human", n: "İnsan (Human)", hp: 8, size: "Orta", speed: 25, b: [], free: 2, d: "Hırslı ve çok yönlü; her sınıfa uyar. İki serbest artış alır.", t: "Ek bir soy yeteneği ya da genel beceri" },
    { k: "leshy", n: "Leşi (Leshy)", hp: 8, size: "Küçük", speed: 25, b: ["con", "wis"], free: 1, flaw: "int", d: "Doğa ruhlarının bitki bedenlere bürünmüş hali.", t: "Alacakaranlık görüşü\nBitki doğası" },
    { k: "orc", n: "Ork (Orc)", hp: 10, size: "Orta", speed: 25, b: [], free: 2, d: "Güçlü, yılmaz ve topluluğuna bağlı. İki serbest artış alır.", t: "Karanlıkta görüş" },
  ];
  // Geçmişler: iki nitelikten birine artış + bir serbest artış; bir beceri ve bir bilgi (lore).
  const BACKGROUNDS = [
    { n: "Akolit (Acolyte)", a: ["int", "wis"], s: "religion", lore: "Yazıcılık", d: "Bir tapınakta yetiştin." },
    { n: "Akrobat (Acrobat)", a: ["str", "dex"], s: "acrobatics", lore: "Sirk", d: "Sirkte ya da sokakta gösteri yaptın." },
    { n: "Zanaatkâr (Artisan)", a: ["str", "int"], s: "crafting", lore: "Lonca", d: "Bir ustanın yanında zanaat öğrendin." },
    { n: "Suçlu (Criminal)", a: ["dex", "int"], s: "stealth", lore: "Yeraltı Dünyası", d: "Yasanın öteki yüzünde yaşadın." },
    { n: "Eğlendirici (Entertainer)", a: ["dex", "cha"], s: "performance", lore: "Tiyatro", d: "Sahnede kalabalıkları eğlendirdin." },
    { n: "Çiftçi (Farmhand)", a: ["con", "wis"], s: "athletics", lore: "Tarım", d: "Tarlada çalışarak büyüdün." },
    { n: "Muhafız (Guard)", a: ["str", "cha"], s: "intimidation", lore: "Hukuk", d: "Şehir ya da kervan muhafızlığı yaptın." },
    { n: "Şifacı (Herbalist)", a: ["con", "wis"], s: "medicine", lore: "Bitki Bilgisi", d: "Otlarla insanları iyileştirdin." },
    { n: "Avcı (Hunter)", a: ["dex", "wis"], s: "survival", lore: "Dericilik", d: "Ormanda avlanarak geçindin." },
    { n: "İşçi (Laborer)", a: ["str", "con"], s: "athletics", lore: "Ağır İş", d: "Bedeninle çalışarak geçindin." },
    { n: "Tüccar (Merchant)", a: ["int", "cha"], s: "diplomacy", lore: "Ticaret", d: "Alıp sattın, pazarlık ettin." },
    { n: "Denizci (Sailor)", a: ["str", "dex"], s: "athletics", lore: "Denizcilik", d: "Gemilerde çalıştın." },
    { n: "Bilgin (Scholar)", a: ["int", "wis"], s: "arcana", lore: "Akademi", d: "Kitaplar arasında yıllar geçirdin." },
    { n: "Savaşçı (Warrior)", a: ["str", "con"], s: "intimidation", lore: "Savaş", d: "Bir paralı asker ya da milis olarak dövüştün." },
    { n: "Göçebe (Nomad)", a: ["con", "wis"], s: "survival", lore: "Çöl", d: "Bir yerden bir yere göçerek yaşadın." },
  ];
  // Sınıflar. key: anahtar nitelik seçenekleri. r: başlangıç rütbeleri [algı, fort, ref, irade, zırh, silah, sınıf ZK].
  // sk: sabit eğitimli beceriler, n: + (Zekâ bonusu) kadar ek beceri. spell: büyü yapıyorsa gelenek, nitelik, tür (prep / spont), taban yuva (2 ya da 3).
  const CLASSES = [
    { k: "alchemist", n: "Simyacı (Alchemist)", hp: 8, key: ["int"], r: [1, 2, 2, 1, 1, 1, 1], sk: ["crafting"], n2: 3, d: "İksir, bomba ve karışımlar hazırlayan mucit.", f: "Simya (çok yönlü karışımlar)\nAraştırma alanı\nFormül kitabı" },
    { k: "barbarian", n: "Barbar (Barbarian)", hp: 12, key: ["str"], r: [2, 2, 1, 2, 1, 1, 1], sk: ["athletics"], n2: 3, d: "Öfkesiyle savaşan, çok dayanıklı yakın dövüşçü.", f: "Öfke: +2 hasar, geçici can, ZS −1\nİçgüdü" },
    { k: "bard", n: "Ozan (Bard)", hp: 8, key: ["cha"], r: [2, 1, 1, 2, 1, 1, 1], sk: ["occultism", "performance"], n2: 4, spell: { trad: "occult", attr: "cha", type: "spont", base: 2 }, d: "Müzikle büyü yapan, takımı güçlendiren destekçi.", f: "Okült büyücülük (repertuar)\nKompozisyon büyüleri (Courageous Anthem)\nİlham kaynağı (Muse)" },
    { k: "champion", n: "Şampiyon (Champion)", hp: 10, key: ["str", "dex"], r: [1, 2, 1, 2, 1, 1, 1], sk: ["religion"], n2: 2, d: "Tanrısına bağlı, ağır zırhlı koruyucu.", f: "Ahit ve tepki (örn. Retributive Strike)\nKutsama büyüsü (Lay on Hands)\nTanrı ve kutsallık" },
    { k: "cleric", n: "Rahip (Cleric)", hp: 8, key: ["wis"], r: [1, 1, 1, 2, 1, 1, 1], sk: ["religion"], n2: 2, spell: { trad: "divine", attr: "wis", type: "prep", base: 2 }, d: "Tanrısının gücüyle iyileştiren ve koruyan büyücü.", f: "İlahi büyücülük (hazırlanan)\nİlahi Kaynak: ek Heal ya da Harm yuvaları\nTarikat: Savaşçı Rahip ya da Din Adamı" },
    { k: "druid", n: "Druid", hp: 8, key: ["wis"], r: [1, 1, 1, 2, 1, 1, 1], sk: ["nature"], n2: 2, spell: { trad: "primal", attr: "wis", type: "prep", base: 2 }, d: "Doğanın gücünü kullanan, biçim değiştirebilen büyücü.", f: "İlkel büyücülük (hazırlanan)\nDruidçe\nDruid düzeni (örn. Fırtına, Hayvan)" },
    { k: "fighter", n: "Savaşçı (Fighter)", hp: 10, key: ["str", "dex"], r: [2, 2, 2, 1, 1, 2, 1], sk: ["athletics"], n2: 3, d: "Silah ustası; en isabetli saldırılar. Yeni başlayanlar için kolay.", f: "Saldırı Fırsatı (Reactive Strike)\nKalkan bloklama\nSilah uzmanlığı" },
    { k: "investigator", n: "Dedektif (Investigator)", hp: 8, key: ["int"], r: [2, 1, 2, 2, 1, 1, 1], sk: ["society"], n2: 4, d: "İpuçlarını birleştiren, saldırısını önceden kurgulayan araştırmacı.", f: "Durumu İncele (Devise a Stratagem)\nYöntem (Methodology)\nİpucu peşinde" },
    { k: "monk", n: "Keşiş (Monk)", hp: 10, key: ["str", "dex"], r: [1, 2, 2, 2, 2, 1, 1], sk: [], n2: 4, d: "Bedenini silah olarak kullanan hızlı dövüşçü.", f: "Silahsız saldırılar (1d6)\nAkış (Flurry of Blows)\nZırhsız savunmada uzman" },
    { k: "oracle", n: "Kâhin (Oracle)", hp: 8, key: ["cha"], r: [1, 1, 1, 2, 1, 1, 1], sk: ["religion"], n2: 3, spell: { trad: "divine", attr: "cha", type: "spont", base: 3 }, d: "Bir gizemin lanetini ve gücünü taşıyan ilahi büyücü.", f: "İlahi büyücülük (repertuar)\nGizem ve lanet\nVahiy büyüleri (odak)" },
    { k: "ranger", n: "Korucu (Ranger)", hp: 10, key: ["str", "dex"], r: [2, 2, 2, 1, 1, 1, 1], sk: ["nature", "survival"], n2: 4, d: "Avını işaretleyip izleyen okçu ya da çift silahlı avcı.", f: "Avı İşaretle (Hunt Prey)\nAvcı uzmanlığı (Hunter's Edge)" },
    { k: "rogue", n: "Haydut (Rogue)", hp: 8, key: ["dex"], r: [2, 1, 2, 2, 1, 1, 1], sk: ["stealth"], n2: 7, d: "Sinsi saldırı ve en çok beceri; her işi çözer.", f: "Sinsi Saldırı (1d6, savunmasız hedefe)\nHaydut tarzı (Racket)\nSürpriz saldırı" },
    { k: "sorcerer", n: "Sihirbaz (Sorcerer)", hp: 6, key: ["cha"], r: [1, 1, 1, 2, 1, 1, 1], sk: [], n2: 2, spell: { trad: "arcane", attr: "cha", type: "spont", base: 3 }, d: "Büyü kanında olan doğuştan büyücü; geleneği soyuna bağlı.", f: "Büyücülük (repertuar; gelenek soy hattına göre)\nSoy hattı ve soy büyüleri" },
    { k: "swashbuckler", n: "Kılıç Cambazı (Swashbuckler)", hp: 10, key: ["dex"], r: [2, 1, 2, 2, 1, 1, 1], sk: ["acrobatics"], n2: 4, d: "Gösterişli hareketlerle coşku (panache) kazanan düellocu.", f: "Coşku (Panache)\nBitiriş hareketleri (Confident Finisher)\nTarz" },
    { k: "witch", n: "Cadı (Witch)", hp: 6, key: ["int"], r: [1, 1, 1, 2, 1, 1, 1], sk: [], n2: 3, spell: { trad: "occult", attr: "int", type: "prep", base: 2 }, d: "Gizemli bir hamiden büyü öğrenen, bir yardımcı hayvanla gezen büyücü.", f: "Büyücülük (hamiye göre gelenek)\nYardımcı hayvan (familiar)\nLanet büyüleri (hex)" },
    { k: "wizard", n: "Büyücü (Wizard)", hp: 6, key: ["int"], r: [1, 1, 1, 2, 1, 1, 1], sk: ["arcana"], n2: 2, spell: { trad: "arcane", attr: "int", type: "prep", base: 2 }, d: "Büyüyü kitaplardan öğrenen bilgin; en geniş büyü seçimi.", f: "Arkana büyücülüğü (hazırlanan, büyü kitabı)\nBüyü okulu (müfredat)\nArkana tezi" },
  ];
  const TRAD = { arcane: "Arkana", divine: "İlahi", occult: "Okült", primal: "İlkel" };
  const TCODE = { arcane: "A", divine: "D", occult: "O", primal: "P" };

  // Büyü yuvaları: taban 2 (hazırlayanlar, ozan) ya da 3 (sihirbaz, kâhin). Rütbe r, 2r−1. seviyede açılır.
  function slotsFor(base, L) {
    L = Math.max(1, Math.min(20, +L || 1));
    const out = Array(10).fill(0);
    if (!base) return out;
    for (let r = 1; r <= 9; r++) { const at = 2 * r - 1; if (L >= at) out[r - 1] = L === at ? base : base + 1; }
    if (L >= 19) out[9] = 1;
    return out;
  }
  const cantripRank = L => Math.max(1, Math.ceil((+L || 1) / 2));
  // Seviye atlarken kazanılanlar (Player Core temel ilerlemesi).
  const GAINS = L => ({
    classFeat: L % 2 === 0, skillFeat: L % 2 === 0, generalFeat: [3, 7, 11, 15, 19].includes(L), ancestryFeat: [5, 9, 13, 17].includes(L),
    skillInc: L >= 3 && L % 2 === 1, boosts: [5, 10, 15, 20].includes(L),
  });
  const XP_PER_LEVEL = 1000;

  /* ---------------- Büyüler ---------------- */
  // [anahtar, İngilizce, Türkçe, rütbe (0 = hile), gelenekler, eylem, menzil/alan, savunma, tür, zar, hasar türü, yükseltme zarı, her kaç rütbede, özet]
  // savunma: ac (büyü saldırısı) ya da fort/ref/will; "b" ile biterse temel kurtarma (basic save).
  const RAW = [
    ["electric-arc", "Electric Arc", "Elektrik Arkı", 0, "AP", "2", "30 ft, 1–2 hedef", "refb", "save", "2d4", "elektrik", "1d4", 1, "Bir ya da iki hedefe sıçrayan elektrik."],
    ["ignition", "Ignition", "Tutuşturma", 0, "AP", "2", "30 ft (ya da dokunma)", "ac", "atk", "2d4", "ateş", "1d4", 1, "Bir alev parçacığı fırlatırsın; dokunarak yaparsan zar d6 olur. Kritikte 1d4 süreğen ateş."],
    ["frostbite", "Frostbite", "Ayaz Isırığı", 0, "AP", "2", "60 ft", "fortb", "save", "2d4", "soğuk", "1d4", 1, "Hedefi buz tutar; kritik başarısızlıkta zayıflar."],
    ["telekinetic-projectile", "Telekinetic Projectile", "Telekinetik Mermi", 0, "AO", "2", "30 ft", "ac", "atk", "2d6", "ezici/delici/kesici", "1d6", 1, "Yakındaki bir nesneyi zihninle fırlatırsın."],
    ["divine-lance", "Divine Lance", "İlahi Mızrak", 0, "D", "2", "30 ft", "ac", "atk", "2d4", "ruh", "1d4", 1, "Tanrının gücünden bir ışık mızrağı."],
    ["void-warp", "Void Warp", "Boşluk Bükülmesi", 0, "ADO", "2", "30 ft", "fortb", "save", "2d4", "boşluk", "1d4", 1, "Hedefin yaşam gücünü emersin; kritik başarısızlıkta güçsüz 1."],
    ["vitality-lash", "Vitality Lash", "Yaşam Kırbacı", 0, "DP", "2", "30 ft", "fortb", "save", "2d6", "canlılık", "1d6", 1, "Ölümsüz ya da boşluk varlıklarını yakan yaşam enerjisi."],
    ["gouging-claw", "Gouging Claw", "Oyan Pençe", 0, "AP", "2", "dokunma", "ac", "atk", "2d6", "kesici", "1d6", 1, "Elin pençeye dönüşür; kritikte süreğen kanama."],
    ["daze", "Daze", "Sersemletme", 0, "AO", "2", "60 ft", "willb", "save", "1d6", "zihinsel", "1d6", 2, "Hedefin zihnini bulandırırsın; kritik başarısızlıkta afallar."],
    ["light", "Light", "Işık", 0, "ADOP", "2", "120 ft", "", "util", "", "", "", 1, "Havada süzülen bir ışık küresi yaratırsın."],
    ["detect-magic", "Detect Magic", "Büyü Algıla", 0, "ADOP", "2", "30 ft yayılım", "", "util", "", "", "", 1, "Yakındaki büyülü etkileri algılarsın."],
    ["shield", "Shield", "Kalkan", 0, "ADO", "1", "kendisi", "", "util", "", "", "", 1, "+1 durum dışı ZS bonusu; Kalkanla Engelle tepkisini kullanabilirsin (bir kez, 10 dakika)."],
    ["prestidigitation", "Prestidigitation", "Küçük Hüner", 0, "ADOP", "2", "10 ft", "", "util", "", "", "", 1, "Küçük büyü numaraları: temizlemek, ısıtmak, süslemek."],
    ["message", "Message", "Mesaj", 0, "ADO", "1", "120 ft", "", "util", "", "", "", 1, "Bir yaratığa fısıltıyla mesaj iletirsin."],
    ["guidance", "Guidance", "Rehberlik", 0, "DOP", "1", "30 ft", "", "util", "", "", "", 1, "Bir müttefik bir sonraki kontrolüne +1 durum bonusu alır."],
    ["stabilize", "Stabilize", "Dengele", 0, "DP", "2", "30 ft", "", "util", "", "", "", 1, "Ölmek üzere olan yaratık 0 canla dengeye gelir."],
    ["figment", "Figment", "Hayal", 0, "AO", "2", "30 ft", "", "util", "", "", "", 1, "Basit bir ses ya da görüntü yanılsaması."],

    ["force-barrage", "Force Barrage", "Güç Yağmuru", 1, "AO", "1–3", "120 ft", "", "auto", "2d4+2", "güç", "2d4+2", 2, "Her eylem için bir parlak mermi (1d4+1), kendiliğinden isabet. Zar 2 eylemlik hali; her 2 rütbede eylem başına bir mermi daha."],
    ["breathe-fire", "Breathe Fire", "Ateş Püskür", 1, "AP", "2", "15 ft koni", "refb", "save", "2d6", "ateş", "2d6", 1, "Ağzından alev püskürür."],
    ["heal", "Heal", "Şifa", 1, "DP", "1–3", "dokunma / 30 ft", "", "heal", "1d8+8", "", "1d8+8", 1, "1 eylem: dokunma 1d8. 2 eylem: 30 ft, 1d8+8 (zar bu hali). 3 eylem: 30 ft yayılım. Ölümsüze karşı hasar verir."],
    ["harm", "Harm", "Zarar", 1, "D", "1–3", "dokunma / 30 ft", "fortb", "save", "1d8+8", "boşluk", "1d8+8", 1, "Şifa'nın tersi: canlılara boşluk hasarı verir, ölümsüzleri iyileştirir."],
    ["soothe", "Soothe", "Yatıştır", 1, "O", "2", "30 ft", "", "heal", "1d10+4", "", "1d10+4", 1, "Zihinsel bir dokunuşla iyileştirirsin; zihinsel etkilere +2 durum bonusu."],
    ["thunderstrike", "Thunderstrike", "Gök Gürlemesi", 1, "AP", "2", "120 ft", "refb", "save", "1d12+1d4", "elektrik ve ses", "1d12+1d4", 1, "Hedefin üzerine bir yıldırım iner."],
    ["phantom-pain", "Phantom Pain", "Hayalet Acı", 1, "O", "2", "30 ft", "will", "save", "2d4", "zihinsel (+1d4 süreğen)", "2d4", 1, "Hedef hayali bir acı duyar; başarısızlıkta midesi bulanır."],
    ["pummeling-rubble", "Pummeling Rubble", "Taş Yağmuru", 1, "AP", "2", "15 ft koni", "refb", "save", "2d4", "ezici", "2d4", 1, "Bir taş ve toprak dalgası."],
    ["fear", "Fear", "Korku", 1, "ADOP", "2", "30 ft", "will", "save", "", "", "", 1, "Hedef korkmuş olur (başarısızlıkta 2, kritik başarısızlıkta kaçar)."],
    ["sleep", "Sleep", "Uyku", 1, "AO", "2", "30 ft, 5 ft yayılım", "will", "save", "", "", "", 1, "Alandaki yaratıklar uyuşur ya da uykuya dalar."],
    ["command", "Command", "Emir", 1, "ADO", "2", "30 ft", "will", "save", "", "", "", 1, "Tek kelimelik bir emir; başarısız olan hedef uyar."],
    ["bless", "Bless", "Kutsama", 1, "DO", "2", "15 ft aura", "", "util", "", "", "", 1, "Aurandaki müttefikler saldırı zarlarına +1 durum bonusu alır."],
    ["runic-weapon", "Runic Weapon", "Rünlü Silah", 1, "AO", "2", "dokunma", "", "util", "", "", "", 1, "Bir silah +1 isabet ve ek hasar zarı kazanır (1 dakika)."],
    ["mystic-armor", "Mystic Armor", "Mistik Zırh", 1, "ADOP", "2", "dokunma", "", "util", "", "", "", 1, "Zırhsız hedef +1 eşya ZS bonusu alır."],
    ["grease", "Grease", "Yağ", 1, "AP", "2", "30 ft", "ref", "save", "", "", "", 1, "Bir alanı ya da nesneyi kayganlaştırırsın; düşebilirler."],
    ["enfeeble", "Enfeeble", "Zayıflat", 1, "ADO", "2", "30 ft", "fort", "save", "", "", "", 1, "Hedef güçsüz 1 (ya da daha fazla) olur."],
    ["sanctuary", "Sanctuary", "Sığınak", 1, "DO", "2", "dokunma", "will", "save", "", "", "", 1, "Hedefe saldırmak isteyenler önce İrade kurtarması yapar."],
    ["jump", "Jump", "Sıçrama", 1, "AP", "1", "kendisi", "", "util", "", "", "", 1, "30 ft içinde bir yere sıçrarsın."],
    ["illusory-disguise", "Illusory Disguise", "Yanılsama Kılık", 1, "AO", "2", "kendisi", "", "util", "", "", "", 1, "Görünüşünü değiştirirsin."],
    ["summon-animal", "Summon Animal", "Hayvan Çağır", 1, "P", "3", "30 ft", "", "util", "", "", "", 1, "Bir hayvan çağırır, konsantre olarak yönetirsin."],

    ["invisibility", "Invisibility", "Görünmezlik", 2, "AO", "2", "dokunma", "", "util", "", "", "", 1, "Hedef görünmez olur; saldırınca biter."],
    ["see-the-unseen", "See the Unseen", "Görünmezi Gör", 2, "ADO", "2", "kendisi", "", "util", "", "", "", 1, "Görünmez yaratıkları ve ruhları görürsün."],
    ["resist-energy", "Resist Energy", "Enerjiye Direnç", 2, "ADOP", "2", "dokunma", "", "util", "", "", "", 1, "Seçtiğin enerji türüne direnç 5."],
    ["dispel-magic", "Dispel Magic", "Büyü Boz", 2, "ADOP", "2", "120 ft", "", "util", "", "", "", 1, "Bir büyüyü sonlandırmak için karşı koyma kontrolü yaparsın."],
    ["calm", "Calm", "Sakinleştir", 2, "DO", "2", "30 ft, 10 ft yayılım", "will", "save", "", "", "", 1, "Alandakiler öfke ve korkudan arınır, saldıramaz."],
    ["laughing-fit", "Laughing Fit", "Gülme Krizi", 2, "AO", "2", "30 ft", "will", "save", "", "", "", 1, "Hedef kahkahalara boğulur; yavaşlar, tepki veremez."],
    ["mirror-image", "Mirror Image", "Ayna Görüntüsü", 2, "AO", "2", "kendisi", "", "util", "", "", "", 1, "Üç sahte görüntü; saldırılar onlara isabet edebilir."],
    ["noise-blast", "Noise Blast", "Gürültü Patlaması", 2, "AOP", "2", "30 ft, 10 ft patlama", "fortb", "save", "2d10", "ses", "1d10", 1, "Kulak sağır eden bir patlama."],
    ["spiritual-armament", "Spiritual Armament", "Ruhani Silahlar", 2, "D", "2", "120 ft", "ac", "atk", "2d8", "ruh", "1d8", 2, "Tanrının silahının hayaleti hedefe saldırır; sürdürerek yeniden saldırtırsın."],
    ["web", "Web", "Ağ", 2, "AP", "2", "30 ft", "ref", "save", "", "", "", 1, "Yapışkan ağlar; içindekiler hareket edemez."],

    ["fireball", "Fireball", "Ateş Topu", 3, "AP", "2", "500 ft, 20 ft patlama", "refb", "save", "6d6", "ateş", "2d6", 1, "Klasik patlayan ateş topu."],
    ["lightning-bolt", "Lightning Bolt", "Şimşek", 3, "AP", "2", "120 ft çizgi", "refb", "save", "4d12", "elektrik", "1d12", 1, "Düz bir çizgide şimşek."],
    ["heroism", "Heroism", "Kahramanlık", 3, "DO", "2", "dokunma", "", "util", "", "", "", 3, "Hedef saldırı, algı, kurtarma ve beceri kontrollerine +1 durum bonusu alır."],
    ["slow", "Slow", "Yavaşlat", 3, "AO", "2", "30 ft", "fort", "save", "", "", "", 1, "Hedef yavaşlamış 1 (kritik başarısızlıkta 2) olur."],
    ["haste", "Haste", "Hızlandır", 3, "AO", "2", "30 ft", "", "util", "", "", "", 1, "Hedef hızlanmış olur: Saldırı ya da Adım için ek eylem."],
    ["paralyze", "Paralyze", "Felç", 3, "AO", "2", "30 ft", "will", "save", "", "", "", 1, "Hedef afallar ya da felç olur."],

    ["fly", "Fly", "Uçma", 4, "AP", "2", "dokunma", "", "util", "", "", "", 1, "Hedef yürüme hızına eşit uçma hızı kazanır."],
    ["translocate", "Translocate", "Yer Değiştir", 4, "AO", "2", "kendisi", "", "util", "", "", "", 1, "120 ft içinde gördüğün bir yere ışınlanırsın."],
    ["wall-of-fire", "Wall of Fire", "Ateş Duvarı", 4, "AP", "3", "120 ft", "", "roll", "4d6", "ateş", "1d6", 1, "Geçenlere ve yanında tur bitirenlere ateş hasarı veren duvar."],

    ["cone-of-cold", "Cone of Cold", "Soğuk Konisi", 5, "AP", "2", "60 ft koni", "refb", "save", "12d6", "soğuk", "2d6", 1, "Dondurucu bir hava dalgası."],
    ["breath-of-life", "Breath of Life", "Yaşam Nefesi", 5, "D", "tepki", "60 ft", "", "heal", "4d8+36", "", "", 1, "Ölmek üzere olan bir müttefiği anında kurtarırsın."],

    ["chain-lightning", "Chain Lightning", "Zincirleme Şimşek", 6, "AP", "2", "500 ft", "refb", "save", "8d12", "elektrik", "1d12", 1, "Hedeften hedefe sıçrayan şimşek."],
    ["disintegrate", "Disintegrate", "Parçalayıp Yok Et", 6, "AP", "2", "120 ft", "ac", "atk", "12d10", "güç (temel Fort)", "2d10", 1, "Önce büyü saldırısı, sonra temel Dayanıklılık kurtarması; 0 cana düşen toz olur."],
  ];
  const SPELLS = RAW.map(r => ({ k: r[0], en: r[1], n: r[2], rank: r[3], trad: r[4], actions: r[5], range: r[6], def: r[7].replace(/b$/, ""), basic: /b$/.test(r[7]), kind: r[8], dice: r[9], type: r[10], up: r[11], every: r[12], d: r[13] }));

  window.ZMPF = { ATTR, RANKS, prof, SKILLS, SAVES, VCONDS, TCONDS, COND_HELP, ANCESTRIES, BACKGROUNDS, CLASSES, TRAD, TCODE, SPELLS, slotsFor, cantripRank, GAINS, XP_PER_LEVEL };
})();
