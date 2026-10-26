/* Masaüstü eklentileri (2): D&D 5e karakter yaratma sihirbazı ve karakter kağıdı rehberi.
   Oyuncuyu adım adım yönlendirir, her adımda o bölümün oyunda ne işe yaradığını anlatır. */
(function () {
  "use strict";

  /* ---------------- Veri (5e SRD, seviye 1) ---------------- */
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

  const STD = [15, 14, 13, 12, 10, 8];
  const SKN = Object.fromEntries(SKILLS.map(s => [s[0], s]));
  const ALL_SK = SKILLS.map(s => s[0]);

  /* ---------------- Sihirbaz durumu ---------------- */
  const STEPS = ["Başlarken", "Irk", "Sınıf", "Yetenekler", "Geçmiş", "Beceriler", "Kimlik", "Özet"];
  let W = null;
  const fresh = () => ({ step: 0, race: null, cls: null, method: "std", base: { str: null, dex: null, con: null, int: null, wis: null, cha: null }, rolled: null, plus: [], bg: null, skills: [], expertise: [], name: "", align: "Tarafsız", player: ME.name || "" });

  const race = () => RACES.find(r => r.k === W.race), cls = () => CLASSES.find(c => c.k === W.cls), bg = () => BACKGROUNDS.find(b => b.n === W.bg);
  function racialBonus(k) { const r = race(); if (!r) return 0; return (r.ab[k] || 0) + (W.plus.includes(k) ? 1 : 0); }
  function finalScore(k) { const b = W.base[k]; return b == null ? null : b + racialBonus(k); }
  function pool() { return W.method === "roll" && W.rolled ? W.rolled : STD; }
  function fixedSkills() { const s = new Set([...(bg()?.s || []), ...(race()?.skills || [])]); return [...s]; }
  function classSkillList() { const c = cls(); return !c ? [] : c.skills === "all" ? ALL_SK : c.skills; }
  function pickCount() { return (cls()?.pick || 0) + (race()?.extraSkills || 0); }

  function valid(step) {
    if (step === 1) return !!W.race && (!race().choose || W.plus.length === race().choose);
    if (step === 2) return !!W.cls;
    if (step === 3) { const used = Object.values(W.base); if (used.some(v => v == null)) return false; const p = [...pool()].sort().join(), u = [...used].sort().join(); return p === u; }
    if (step === 4) return !!W.bg;
    if (step === 5) return W.skills.length === pickCount() && (!cls()?.expertise || W.expertise.length === cls().expertise);
    if (step === 6) return W.name.trim().length > 0;
    return true;
  }
  const why = step => ({ 1: race()?.choose ? "İki yetenek seçip +1 ver." : "Bir ırk seç.", 2: "Bir sınıf seç.", 3: "Her değeri bir yeteneğe bir kez ver.", 4: "Bir geçmiş seç.", 5: `${pickCount()} beceri seç${cls()?.expertise ? `, sonra ${cls().expertise} uzmanlık işaretle` : ""}.`, 6: "Karakterine bir ad ver." })[step] || "";

  /* ---------------- Hesaplar ---------------- */
  function computeAC(c, scores) {
    const a = c.ac, dm = mod(scores.dex);
    let v = a.base + (a.dex === true ? dm : typeof a.dex === "number" ? Math.min(dm, a.dex) : 0);
    if (a.plus) v += mod(scores[a.plus]);
    if (a.shield) v += 2;
    return v;
  }
  function preview() {
    const c = cls(), r = race(); if (!c || !r) return null;
    const sc = {}; ABS.forEach(([k]) => sc[k] = finalScore(k) ?? 10);
    const hp = c.hd + mod(sc.con) + (r.hpBonus || 0);
    return { sc, hp, ac: computeAC(c, sc), init: mod(sc.dex), pb: 2 };
  }

  function buildChar() {
    const c = cls(), r = race(), b = bg(), p = preview();
    const n = newChar();
    const atkAb = c.weapon[1];
    const bonus = 2 + mod(p.sc[atkAb]), dmgMod = mod(p.sc[atkAb]);
    Object.assign(n, {
      name: W.name.trim(), cls: c.n, level: 1, race: r.n, bg: b.n, align: W.align, player: W.player,
      ab: { ...p.sc }, saves: Object.fromEntries(c.saves.map(k => [k, true])),
      skills: Object.fromEntries([...fixedSkills(), ...W.skills].map(k => [k, W.expertise.includes(k) ? 2 : 1])),
      ac: p.ac, speed: r.speed + " ft", hpMax: p.hp, hp: p.hp, hitDice: "1d" + c.hd,
      attacks: [{ name: c.weapon[0], bonus: sgn(bonus), dmg: `${c.weapon[2]}${dmgMod ? sgn(dmgMod) : ""} ${c.weapon[3]}` }],
      spellAb: c.spell || "",
      features: `${r.n}:\n${r.t}\n\n${c.n}:\n${c.f}\n\nZırh: ${c.ac.note}`,
      inventory: c.inv, coins: { cp: 0, sp: 0, ep: 0, gp: 10, pp: 0 },
      spells: c.spell ? "Hileler (cantrip) ve 1. seviye büyülerini buraya yaz. Hangi büyüleri bilebileceğini DM'ine sorabilirsin." : "",
    });
    if (c.slots) n.slots[0] = { max: c.slots, used: 0 };
    return n;
  }

  /* ---------------- Görünüm ---------------- */
  const card = (on, act, val, title, body, extra = "") => `<button type="button" class="zw-card" data-zw="${act}" data-v="${esc(val)}" aria-pressed="${on}"><b>${title}</b>${extra}<span>${body}</span></button>`;
  const learn = t => `<aside class="zw-learn"><b>Ne işe yarar?</b> ${t}</aside>`;

  function stepHtml() {
    const s = W.step;
    if (s === 0) return `<h3>Hoş geldin, maceracı!</h3>
      <p>Karakter kağıdı, oyunda canlandıracağın kahramanın kimliğidir: ne kadar güçlü olduğunu, neleri iyi yaptığını ve ne kadar hasara dayanabileceğini gösterir. Zar attığında eklediğin sayıların hepsi buradan gelir.</p>
      <p>Bu sihirbaz seni 6 adımda birinci seviye bir D&D 5e karakterine götürecek:</p>
      <ol class="zw-list"><li><b>Irk:</b> karakterin hangi halktan</li><li><b>Sınıf:</b> ne iş yapıyor, nasıl savaşıyor</li><li><b>Yetenekler:</b> güç, çeviklik, zekâ gibi temel puanlar</li><li><b>Geçmiş:</b> maceradan önce kimdi</li><li><b>Beceriler:</b> nelerde eğitimli</li><li><b>Kimlik:</b> adı ve kişiliği</li></ol>
      ${learn("Her adımda seçtiklerinin oyunda neye dönüştüğünü anlatacağım. Sonunda sayıların hepsi otomatik hesaplanır; kağıt üzerinde istediğin zaman değiştirebilirsin.")}`;
    if (s === 1) { const r = race(); return `<h3>Irkını seç</h3><p>Irk, karakterine yetenek puanı bonusları, hız ve özel yetenekler (örneğin karanlıkta görme) verir.</p>
      <div class="zw-grid">${RACES.map(x => card(W.race === x.k, "race", x.k, x.n, x.d, `<small class="zw-tag">${Object.entries(x.ab).map(([k, v]) => ABN[k][2] + " +" + v).join(" · ")}${x.choose ? " · 2 yetenek +1" : ""} · ${x.speed} ft</small>`)).join("")}</div>
      ${r && r.choose ? `<div class="zw-sub"><b>+1 vereceğin iki yetenek:</b> <span class="chips">${ABS.filter(([k]) => !r.ab[k]).map(([k, nm]) => `<button type="button" class="chip" data-zw="plus" data-v="${k}" aria-pressed="${W.plus.includes(k)}">${nm}</button>`).join("")}</span></div>` : ""}
      ${r ? learn(`<b>Hız (${r.speed} ft):</b> bir turda yürüyebileceğin mesafe; haritada her kare 5 ft. <b>Irk özellikleri</b> kağıdındaki "Özellikler ve Yetenekler" kutusuna yazılacak.`) : ""}`; }
    if (s === 2) { const c = cls(); return `<h3>Sınıfını seç</h3><p>Sınıf, karakterinin mesleğidir: nasıl savaştığını, hangi zırhı giydiğini, büyü yapıp yapmadığını belirler. Yeni başlıyorsan Savaşçı ya da Rahip kolaydır.</p>
      <div class="zw-grid">${CLASSES.map(x => card(W.cls === x.k, "cls", x.k, x.n, x.d, `<small class="zw-tag">Can zarı d${x.hd} · ${ABN[x.order[0]][1]}${x.spell ? " · büyücü" : ""}</small>`)).join("")}</div>
      ${c ? learn(`<b>Can zarı (d${c.hd}):</b> 1. seviyede canın ${c.hd} + Dayanıklılık bonusun olur; her seviyede bu zar kadar artar. <b>Kurtarma zarları (${c.saves.map(k => ABN[k][1]).join(", ")}):</b> tehlikeden kaçınmak için attığın zarlar; bu sınıf bu ikisinde eğitimli, yani yeterlilik bonusu eklenir.${c.spell ? ` <b>Büyü yeteneği:</b> ${ABN[c.spell][1]}.` : ""}`) : ""}`; }
    if (s === 3) {
      const c = cls(), p = pool();
      const used = Object.values(W.base).filter(v => v != null);
      const left = [...p]; used.forEach(v => { const i = left.indexOf(v); if (i >= 0) left.splice(i, 1); });
      return `<h3>Yetenek puanlarını dağıt</h3>
      <p>Altı yetenek karakterinin temel gücünü gösterir. Puan 10 ortalama bir insandır. Zar attığında puanın kendisini değil, <b>bonusunu</b> eklersin: <span class="num">(puan − 10) ÷ 2</span>, aşağı yuvarlanır. Yani 14 → +2, 8 → −1.</p>
      <div class="zw-row"><span class="chips"><button type="button" class="chip" data-zw="method" data-v="std" aria-pressed="${W.method === "std"}">Standart dizi (15, 14, 13, 12, 10, 8)</button><button type="button" class="chip" data-zw="method" data-v="roll" aria-pressed="${W.method === "roll"}">Zarla belirle (4d6, en düşüğü at)</button></span>
        ${W.method === "roll" ? `<button type="button" class="btn sm" data-zw="roll">${W.rolled ? "Yeniden at" : "Zarları at"}</button>` : ""}
        <button type="button" class="btn sm" data-zw="suggest" ${W.method === "roll" && !W.rolled ? "disabled" : ""}>${esc(c.n.split(" (")[0])} için öner</button></div>
      ${W.method === "roll" && !W.rolled ? "" : `<p class="zw-left">Dağıtılacak: ${left.length ? left.map(v => `<b class="num">${v}</b>`).join(" ") : "hepsi dağıtıldı ✓"}</p>
      <div class="zw-abil">${ABS.map(([k, nm]) => { const b = W.base[k], f = finalScore(k), rb = racialBonus(k), main = c.order[0] === k || c.order[1] === k;
        return `<div class="zw-ab ${main ? "main" : ""}"><div class="zw-abh"><b>${nm}</b>${main ? `<small class="zw-tag">${esc(c.n.split(" (")[0])} için önemli</small>` : ""}</div>
          <select class="f" data-zw-ab="${k}" aria-label="${nm} puanı"><option value="">—</option>${[...new Set(p)].map(v => `<option ${b === v ? "selected" : ""}>${v}</option>`).join("")}</select>
          <span class="zw-calc">${b == null ? "" : `${b}${rb ? ` + ${rb} ırk` : ""} = <b>${f}</b> → bonus <b class="num">${sgn(mod(f))}</b>`}</span>
          <small>${AB_HELP[k]}</small></div>`; }).join("")}</div>`}
      ${learn("Bu bonuslar her yerde kullanılır: saldırı zarına, hasara, becerilere ve kurtarma zarlarına eklenir. Kağıtta yeteneğin yanındaki büyük düğmeye basınca d20 + bonus atılır.")}`;
    }
    if (s === 4) return `<h3>Geçmişini seç</h3><p>Geçmiş, karakterinin maceraya atılmadan önceki hayatıdır. Sana iki becerinin yeterliliğini verir ve rol yaparken ilham olur.</p>
      <div class="zw-grid">${BACKGROUNDS.map(x => card(W.bg === x.n, "bg", x.n, x.n, x.d, `<small class="zw-tag">${x.s.map(k => SKN[k][1]).join(", ")}</small>`)).join("")}</div>`;
    if (s === 5) {
      const fixed = fixedSkills(), list = classSkillList(), need = pickCount(), c = cls();
      return `<h3>Becerilerini seç</h3>
      <p>Beceriler, belirli işlerde ne kadar iyi olduğunu gösterir. Eğitimli (yeterli) olduğun becerilerde zara yetenek bonusuna ek olarak <b>yeterlilik bonusunu (+2)</b> eklersin. Geçmişinden ve ırkından gelenler zaten işaretli.</p>
      <p class="zw-left">${esc(c.n.split(" (")[0])} listesinden <b>${need}</b> beceri seç: ${W.skills.length}/${need}</p>
      <div class="zw-skills">${SKILLS.map(([k, nm, ab]) => { const fx = fixed.includes(k), ok = list.includes(k) || (race()?.extraSkills && !fx), on = fx || W.skills.includes(k);
        const total = mod(finalScore(ab) ?? 10) + (on ? 2 : 0);
        return `<button type="button" class="zw-sk" data-zw="skill" data-v="${k}" aria-pressed="${on}" ${fx || !ok ? "disabled" : ""}><span class="prof" data-v="${on ? (W.expertise.includes(k) ? 2 : 1) : 0}"></span>${nm}<small>${ABN[ab][2]}${fx ? " · geçmiş/ırk" : ""}</small><b class="num">${sgn(total)}</b></button>`; }).join("")}</div>
      ${c.expertise ? `<div class="zw-sub"><b>Uzmanlık:</b> eğitimli olduğun ${c.expertise} beceride bonus iki katına çıkar (+4). <span class="chips">${[...fixed, ...W.skills].map(k => `<button type="button" class="chip" data-zw="exp" data-v="${k}" aria-pressed="${W.expertise.includes(k)}">${SKN[k][1]}</button>`).join("")}</span></div>` : ""}
      ${learn("Örneğin bir duvara tırmanırken DM \"Atletizm at\" der; d20 atar, Atletizm'in yanındaki sayıyı eklersin. Kağıtta becerinin solundaki yuvarlak, yeterli olup olmadığını gösterir.")}`;
    }
    if (s === 6) return `<h3>Karakterine kimlik ver</h3>
      <label class="zw-field"><span class="lbl">Karakterin adı</span><input class="f" data-zw-in="name" value="${esc(W.name)}" placeholder="örn. Aren Gölgeyürek" maxlength="60"></label>
      <label class="zw-field"><span class="lbl">Oyuncu (senin adın)</span><input class="f" data-zw-in="player" value="${esc(W.player)}"></label>
      <p><b>Yönelim</b>, karakterinin ahlaki pusulasıdır. Kesin bir kural değil, rol yaparken yol gösterir.</p>
      <div class="zw-align">${ALIGN.map(([n, d]) => `<button type="button" class="zw-card sm" data-zw="align" data-v="${n}" aria-pressed="${W.align === n}"><b>${n}</b><span>${d}</span></button>`).join("")}</div>`;
    if (s === 7) {
      const p = preview(), c = cls(), r = race();
      return `<h3>${esc(W.name)} hazır!</h3><p>${esc(r.n)} ${esc(c.n)} · ${esc(W.bg)} · ${esc(W.align)}</p>
      <div class="zw-sum">
        <div><span class="lbl">Can puanı</span><b class="num">${p.hp}</b><small>d${c.hd} + DAY ${sgn(mod(p.sc.con))}${r.hpBonus ? " + cüce" : ""}. Sıfıra düşersen bayılırsın ve ölüm kurtarma zarları atarsın.</small></div>
        <div><span class="lbl">Zırh sınıfı</span><b class="num">${p.ac}</b><small>${esc(c.ac.note)}. Düşmanın seni vurmak için saldırı zarıyla bu sayıya ulaşması gerekir.</small></div>
        <div><span class="lbl">İnisiyatif</span><b class="num">${sgn(p.init)}</b><small>Savaş başlarken d20 + bu sayı; yüksek olan önce oynar.</small></div>
        <div><span class="lbl">Yeterlilik</span><b class="num">+2</b><small>Eğitimli olduğun her şeye eklenir; seviye atladıkça artar.</small></div>
      </div>
      <div class="zw-abil sm">${ABS.map(([k, nm]) => `<div class="zw-ab"><b>${ABN[k][2]}</b><span class="num">${p.sc[k]} (${sgn(mod(p.sc[k]))})</span></div>`).join("")}</div>
      ${learn("Oluştur'a bastıktan sonra kısa bir kağıt turu başlayacak; her bölümün ne işe yaradığını yerinde göstereceğim. Turu istediğin zaman <b>Kağıt rehberi</b> düğmesiyle yeniden açabilirsin.")}`;
    }
  }

  function draw() {
    let ov = $("#zwOv");
    if (!W) { if (ov) ov.remove(); return; }
    if (!ov) { ov = document.createElement("div"); ov.id = "zwOv"; ov.className = "joinov zw-ov"; document.body.appendChild(ov); }
    const s = W.step, last = STEPS.length - 1, ok = valid(s);
    ov.innerHTML = `<div class="zw" role="dialog" aria-modal="true" aria-label="Karakter yaratma sihirbazı">
      <header class="zw-h"><h2>Karakter yaratma</h2><ol class="zw-steps">${STEPS.map((n, i) => `<li class="${i === s ? "on" : i < s ? "done" : ""}">${i ? `<span>${i}</span>` : ""}${n}</li>`).join("")}</ol><button class="btn sm" data-zw="close" aria-label="Kapat">×</button></header>
      <div class="zw-b" id="zwBody">${stepHtml()}</div>
      <footer class="zw-f">${s === 0 ? `<button class="btn" data-zw="blank">Boş kağıtla başla</button>` : `<button class="btn" data-zw="prev">← Geri</button>`}
        <span class="zw-why">${ok ? "" : esc(why(s))}</span>
        ${s === last ? `<button class="btn pri" data-zw="finish">Karakteri oluştur</button>` : `<button class="btn pri" data-zw="next" ${ok ? "" : "disabled"}>${s === 0 ? "Başlayalım" : "İleri →"}</button>`}</footer></div>`;
  }
  const redraw = (keepScroll = true) => { const y = $("#zwBody")?.scrollTop || 0; draw(); if (keepScroll && $("#zwBody")) $("#zwBody").scrollTop = y; };

  function open() { W = fresh(); draw(); }
  function close() { W = null; draw(); }

  function suggest() {
    const order = cls().order, vals = [...pool()].sort((a, b) => b - a);
    order.forEach((k, i) => W.base[k] = vals[i]);
  }
  function roll4d6() { const r = () => { const d = [1, 2, 3, 4].map(() => 1 + Math.floor(Math.random() * 6)).sort((a, b) => a - b); return d[1] + d[2] + d[3]; }; return Array.from({ length: 6 }, r).sort((a, b) => b - a); }

  document.addEventListener("click", e => {
    // "+ Yeni karakter" D&D 5e masasında sihirbazı açar.
    const nb = e.target.closest('[data-act="newchar"]');
    if (nb && !W && sysKey() === "dnd5e" && !S.ro) { e.stopImmediatePropagation(); open(); return; }
    const b = e.target.closest("[data-zw]"); if (!b || !W && b.dataset.zw !== "tour") return;
    const a = b.dataset.zw, v = b.dataset.v;
    switch (a) {
      case "close": close(); return;
      case "blank": { close(); const n = newChar(); if (!isDM()) n.owner = ME.id; save("chars", n); if (!isDM()) linkMyChar(n.id); S.charId = n.id; render(); return; }
      case "next": if (valid(W.step)) { W.step++; redraw(false); } return;
      case "prev": W.step = Math.max(0, W.step - 1); redraw(false); return;
      case "race": if (W.race !== v) { W.race = v; W.plus = []; W.skills = []; W.expertise = []; } break;
      case "plus": { const r = race(); if (W.plus.includes(v)) W.plus = W.plus.filter(x => x !== v); else if (W.plus.length < r.choose) W.plus.push(v); break; }
      case "cls": if (W.cls !== v) { W.cls = v; W.skills = []; W.expertise = []; } break;
      case "method": W.method = v; W.base = { str: null, dex: null, con: null, int: null, wis: null, cha: null }; if (v === "std") W.rolled = null; break;
      case "roll": W.rolled = roll4d6(); W.base = { str: null, dex: null, con: null, int: null, wis: null, cha: null }; break;
      case "suggest": suggest(); break;
      case "bg": if (W.bg !== v) { W.bg = v; const fx = fixedSkills(); W.skills = W.skills.filter(k => !fx.includes(k)); W.expertise = []; } break;
      case "skill": if (W.skills.includes(v)) { W.skills = W.skills.filter(k => k !== v); W.expertise = W.expertise.filter(k => k !== v); } else if (W.skills.length < pickCount()) W.skills.push(v); else toast(`En fazla ${pickCount()} beceri seçebilirsin`); break;
      case "exp": if (W.expertise.includes(v)) W.expertise = W.expertise.filter(k => k !== v); else if (W.expertise.length < cls().expertise) W.expertise.push(v); break;
      case "align": W.align = v; break;
      case "finish": {
        const n = buildChar(); if (!isDM()) n.owner = ME.id;
        save("chars", n); if (!isDM()) linkMyChar(n.id); S.charId = n.id; S.view = "karakterler"; close(); render();
        toast(`${n.name} oluşturuldu`); setTimeout(() => tour(0), 400); return;
      }
    }
    redraw();
  }, true);

  document.addEventListener("change", e => {
    const el = e.target; if (!W || !el.dataset.zwAb) return;
    const k = el.dataset.zwAb, v = el.value === "" ? null : +el.value;
    // Aynı değer başka bir yetenekte kullanılmışsa ve havuzda yeterince yoksa, oradakini boşalt.
    if (v != null) { const count = pool().filter(x => x === v).length; const others = ABS.map(a => a[0]).filter(x => x !== k && W.base[x] === v); if (others.length >= count) W.base[others[0]] = null; }
    W.base[k] = v; redraw();
  });
  document.addEventListener("input", e => { const el = e.target; if (!W || !el.dataset.zwIn) return; W[el.dataset.zwIn] = el.value; const nx = $("[data-zw=next]"); if (nx) nx.disabled = !valid(W.step); const w = $(".zw-why"); if (w) w.textContent = valid(W.step) ? "" : why(W.step); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && W) close(); if (e.key === "Escape" && T != null) endTour(); });

  /* ---------------- Kağıt rehberi ---------------- */
  const panel = t => $$("#main .panel").find(p => (p.querySelector("h3")?.textContent || "").startsWith(t));
  const vit = t => $$("#main .vit").find(v => (v.querySelector(".lbl")?.textContent || "").startsWith(t));
  const TOUR = [
    [() => $("#main .cname")?.closest(".panel"), "Kimlik", "Karakterinin adı, sınıfı, seviyesi, ırkı ve geçmişi. Seviye arttıkça yeterlilik bonusun da otomatik artar."],
    [() => $("#main .abil"), "Yetenek puanları", "Altı temel yetenek. Sağdaki kutu puanın kendisi, soldaki büyük düğme bonusu. Düğmeye basınca d20 + bonus atılır; DM \"Güç kontrolü yap\" derse buna basarsın."],
    [() => $("#main .saverow"), "Kurtarma zarları", "Bir tuzaktan sıçramak ya da zehre direnmek gibi tehlikelerden kaçmak için atılır. İşaretli olanlarda eğitimlisin, yeterlilik bonusu eklenir."],
    [() => panel("Beceriler"), "Beceriler", "Belirli işlerdeki ustalığın. Soldaki yuvarlak dolu ise eğitimlisin (tıklayarak değiştirebilirsin; elmas işareti uzmanlık). Sağdaki düğme zarı atar."],
    [() => vit("Zırh"), "Zırh sınıfı (ZS)", "Ne kadar zor vurulduğun. Bir düşman sana saldırınca zarının bu sayıya ulaşması gerekir."],
    [() => vit("İnisiyatif"), "İnisiyatif", "Savaşta sıranı belirler. Savaş başlarken buna basarsın; sonuç savaş sırasına eklenir."],
    [() => vit("Yeterlilik"), "Yeterlilik bonusu", "Eğitimli olduğun beceri, kurtarma, silah ve büyülere eklenen sayı. Seviye 1'de +2."],
    [() => vit("Pasif"), "Pasif algı", "Sen zar atmadan DM'in fark edip etmediğini kontrol ettiği değer: 10 + Algı bonusu."],
    [() => panel("Can Puanı"), "Can puanı", "Hasar alınca \"Miktar\"a yazıp Hasar'a, iyileşince İyileştir'e bas. Geçici can önce gider. Uzun dinlenme canı ve büyü yuvalarını doldurur."],
    [() => $$("#main .panel .ds")[1], "Ölüm kurtarma", "Canın 0'a düşerse her turunda \"At\"a basarsın: 10 ve üstü başarı, altı başarısızlık. 3 başarıda kendine gelirsin, 3 başarısızlıkta ölürsün."],
    [() => panel("Durumlar"), "Durumlar", "Kör, yerde, zehirlenmiş gibi durumlar. Başına bir şey gelince işaretle, DM ve diğer oyuncular da görür."],
    [() => panel("Saldırılar"), "Saldırılar", "\"Vur\" d20 + saldırı bonusunu atar; sonuç düşmanın ZS'sine ulaşırsa \"Hasar\"a basarsın. Kritikte (20) Shift ile tıklayınca hasar zarları iki kat atılır."],
    [() => panel("Büyücülük"), "Büyücülük", "Büyü yapıyorsan büyü yeteneğini seç. Yuvalar günlük büyü hakkındır: büyü yaptıkça bir yuvaya tıkla, uzun dinlenmede dolar."],
    [() => panel("Envanter"), "Envanter", "Eşyaların ve paran. Sihirbaz başlangıç teçhizatını yazdı; macerada buldukların buraya."],
  ];
  let T = null, shownT = null;
  function tour(i) {
    if (S.view !== "karakterler") { S.view = "karakterler"; render(); }
    T = i; drawTour();
  }
  function endTour() { T = null; shownT = null; $$(".zt-hl").forEach(x => x.classList.remove("zt-hl")); $("#ztCard")?.remove(); }
  function drawTour() {
    $$(".zt-hl").forEach(x => x.classList.remove("zt-hl"));
    if (T == null) return;
    let target = null;
    while (T < TOUR.length && !(target = TOUR[T][0]())) T++;
    if (T >= TOUR.length) { endTour(); toast("Rehber bitti. İyi maceralar!"); return; }
    target.classList.add("zt-hl");
    if (shownT !== T) { shownT = T; target.scrollIntoView({ block: "center", behavior: "smooth" }); }
    let c = $("#ztCard"); if (!c) { c = document.createElement("div"); c.id = "ztCard"; c.className = "zt-card"; c.setAttribute("role", "dialog"); document.body.appendChild(c); }
    const [, title, text] = TOUR[T];
    c.innerHTML = `<div class="zt-top"><span class="lbl">Kağıt rehberi · ${T + 1}/${TOUR.length}</span><button class="btn sm" data-zt="end" aria-label="Rehberi kapat">×</button></div><h3>${title}</h3><p>${text}</p>
      <div class="zt-nav"><button class="btn sm" data-zt="prev" ${T ? "" : "disabled"}>← Önceki</button><button class="btn sm pri" data-zt="next">${T === TOUR.length - 1 ? "Bitir" : "Sonraki →"}</button></div>`;
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-zt]"); if (!b) return; const a = b.dataset.zt;
    if (a === "start") tour(0);
    else if (a === "end") endTour();
    else if (a === "next") { T++; if (T >= TOUR.length) { endTour(); toast("Rehber bitti. İyi maceralar!"); } else drawTour(); }
    else if (a === "prev") { T = Math.max(0, T - 1); drawTour(); }
  });

  // Karakterler sayfasına "Kağıt rehberi" düğmesi; yeniden çizimden sonra vurguyu koru.
  const _render = window.render;
  window.render = function () {
    const r = _render.apply(this, arguments);
    try {
      if (G.id && S.view === "karakterler" && sysKey() === "dnd5e" && $("#main .sheet")) {
        const h = $("#main .vhead"); if (h && !$("[data-zt=start]", h)) { const b = document.createElement("button"); b.className = "btn sm"; b.dataset.zt = "start"; b.textContent = "Kağıt rehberi"; b.title = "Karakter kağıdının bölümlerini adım adım tanıt"; h.insertBefore(b, $("[data-act=newchar]", h) || null); }
        if (T != null) drawTour();
      } else if (T != null && S.view !== "karakterler") endTour();
    } catch (e) { console.error(e); }
    return r;
  };
})();
