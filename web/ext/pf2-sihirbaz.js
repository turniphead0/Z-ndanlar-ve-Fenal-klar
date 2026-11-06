/* Masaüstü eklentileri (7): Pathfinder 2e karakter yaratma sihirbazı, seviye atlama, kağıt rehberi.
   Soy, geçmiş ve sınıf artışlarıyla nitelikleri hesaplar; beceri, büyü ve homebrew seçeneklerini adım adım sorar. */
(function () {
  "use strict";

  const P = window.ZMPF;
  const AN = Object.fromEntries(P.ATTR.map(a => [a[0], a]));
  const SKN = Object.fromEntries(P.SKILLS.map(s => [s[0], s]));
  const cur = () => S.chars[S.charId];
  const short = n => String(n || "").split(" (")[0];
  const learn = t => `<aside class="zw-learn"><b>Ne işe yarar?</b> ${t}</aside>`;
  const card = (on, act, val, title, body, extra = "") => `<button type="button" class="zw-card" data-pw="${act}" data-v="${esc(val)}" aria-pressed="${on}"><b>${title}</b>${extra}<span>${body}</span></button>`;
  const hbCard = (on, act, what) => `<button type="button" class="zw-card zw-hb" data-pw="${act}" data-v="custom" aria-pressed="${on}"><b>+ Kendi ${what}</b><span>Başka bir kitaptan ya da masanızdan (homebrew); içini sen doldur.</span></button>`;
  const chip = (act, v, on, txt, dis) => `<button type="button" class="chip" data-pw="${act}" data-v="${v}" aria-pressed="${on}" ${dis ? "disabled" : ""}>${txt}</button>`;
  const FOCUS1 = ["bard", "champion", "druid", "oracle", "sorcerer", "witch", "wizard"];

  /* ================= Karakter yaratma ================= */
  const STEPS = ["Başlarken", "Soy", "Geçmiş", "Sınıf", "Nitelikler", "Beceriler", "Büyüler", "Kimlik", "Özet"];
  const SPELL_STEP = 6;
  let W = null;
  const fresh = () => ({ step: 0, anc: null, heritage: "", alt: false, ancFree: [], bg: null, bgA: null, bgFree: null, cls: null, key: null, free: [], skills: [], spells: [], name: "", player: ME.name || "", deity: "",
    ca: { k: "custom", n: "", hp: 8, size: "Orta", speed: 25, b: [], free: 2, flaw: "", t: "" },
    cb: { n: "", a: [], s: "", lore: "", d: "" },
    cc: { k: "custom", n: "", hp: 8, key: [], r: [1, 1, 1, 1, 1, 1, 1], sk: [], n2: 3, spell: null, trad: "", sattr: "", stype: "prep" } });
  const anc = () => W.anc === "custom" ? W.ca : P.ANCESTRIES.find(a => a.k === W.anc);
  const bg = () => W.bg === "custom" ? W.cb : P.BACKGROUNDS.find(b => b.n === W.bg);
  function cls() {
    if (W.cls !== "custom") return P.CLASSES.find(c => c.k === W.cls);
    const c = W.cc; return { ...c, spell: c.trad && c.sattr ? { trad: c.trad, attr: c.sattr, type: c.stype, base: c.stype === "spont" ? 3 : 2 } : null };
  }
  function ancBoosts() { const a = anc(); if (!a) return { fixed: [], free: 0, flaw: "" }; return W.alt ? { fixed: [], free: 2, flaw: "" } : { fixed: a.b || [], free: +a.free || 0, flaw: a.flaw || "" }; }
  function scores() {
    const s = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, ab = ancBoosts();
    ab.fixed.forEach(k => s[k]++); W.ancFree.forEach(k => s[k]++); if (ab.flaw) s[ab.flaw]--;
    if (W.bgA) s[W.bgA]++; if (W.bgFree) s[W.bgFree]++;
    if (W.key) s[W.key]++; W.free.forEach(k => s[k]++);
    return s;
  }
  function spellNeed() { const c = cls(); if (!c?.spell) return null; const book = c.k === "wizard" || c.k === "witch"; return { cant: 5, r1: book ? 5 : 2, spont: c.spell.type === "spont", book }; }
  const nextStep = (s, d) => { s += d; if (s === SPELL_STEP && !spellNeed()) s += d; return s; };
  function trainedFixed() { const c = cls(), b = bg(); return [...new Set([...(c?.sk || []), ...(b?.s ? [b.s] : [])])]; }
  function pickCount() { const c = cls(), b = bg(); if (!c) return 0; const overlap = b?.s && (c.sk || []).includes(b.s) ? 1 : 0; return Math.max(0, (+c.n2 || 0) + Math.max(0, scores().int) + overlap); }

  function valid(s) {
    const a = anc(), c = cls(), ab = ancBoosts();
    if (s === 1) return !!a && W.ancFree.length === ab.free && (W.anc !== "custom" || !!W.ca.n.trim());
    if (s === 2) return !!bg() && !!W.bgA && !!W.bgFree && (W.bg !== "custom" || (!!W.cb.n.trim() && W.cb.a.length === 2));
    if (s === 3) return !!c && !!W.key && (W.cls !== "custom" || (!!W.cc.n.trim() && W.cc.key.length > 0));
    if (s === 4) return W.free.length === 4;
    if (s === 5) return W.skills.length === pickCount();
    if (s === SPELL_STEP) { const n = spellNeed(); if (!n) return true; return W.spells.filter(x => !x.rank).length <= n.cant && W.spells.filter(x => x.rank).length <= n.r1; }
    if (s === 7) return !!W.name.trim();
    return true;
  }
  const why = s => ({ 1: W.anc === "custom" && !W.ca.n.trim() ? "Soyuna bir ad ver." : `Serbest artış seç (${ancBoosts().free}).`, 2: W.bg === "custom" && W.cb.a.length !== 2 ? "Geçmişin için iki nitelik ve bir beceri seç." : "Geçmişinin iki artışını seç.", 3: W.cls === "custom" ? "Sınıfına ad ve anahtar nitelik ver." : "Sınıf ve anahtar nitelik seç.", 4: "Dört farklı niteliğe artış ver.", 5: `${pickCount()} beceri seç.`, 6: "Seçebileceğin sayıyı aştın.", 7: "Karakterine bir ad ver." })[s] || "";

  function boostRow(act, picked, max, exclude = []) {
    return `<span class="chips">${P.ATTR.map(([k, n]) => chip(act, k, picked.includes(k), n, exclude.includes(k) || (!picked.includes(k) && picked.length >= max))).join("")}</span>`;
  }
  const scoreLine = () => { const s = scores(); return `<div class="zw-abil sm">${P.ATTR.map(([k, , ab]) => `<div class="zw-ab"><b>${ab}</b><span class="num">${sgn(s[k])}</span></div>`).join("")}</div>`; };
  const cin = (path, lbl, ph = "", type = "text") => { const v = path.split(".").reduce((o, k) => o?.[k], W); return `<label class="zw-field"><span class="lbl">${lbl}</span><input class="f" type="${type}" data-pw-c="${path}" value="${esc(v ?? "")}" placeholder="${esc(ph)}"></label>`; };

  function stepHtml() {
    const s = W.step;
    if (s === 0) return `<h3>Pathfinder 2e'ye hoş geldin!</h3>
      <p>Pathfinder'da karakterin üç şeyden oluşur: <b>soyu</b> (hangi halktan), <b>geçmişi</b> (maceradan önce ne yapıyordu) ve <b>sınıfı</b> (şimdi ne yapıyor). Her biri sana <b>nitelik artışları</b> (+1) verir; altı niteliğin bonusları bunlarla belirlenir.</p>
      <p>Zar atarken d20 + bonus atarsın. Sonuç hedef zorluğu (ZK) geçerse başarı, 10 ya da daha fazla geçerse <b>kritik başarı</b>; 10 ya da daha fazla altında kalırsa <b>kritik başarısızlık</b>. Doğal 20 sonucu bir derece iyileştirir, doğal 1 bir derece kötüleştirir.</p>
      <ol class="zw-list"><li>Soy</li><li>Geçmiş</li><li>Sınıf</li><li>Nitelikler: dört serbest artış</li><li>Beceriler</li><li>Büyüler (büyücü sınıflar)</li><li>Kimlik</li></ol>
      <p>Listede olmayan bir soy, geçmiş, sınıf ya da büyü için <b>Kendi …</b> kartını seçip içini doldurabilirsin (homebrew).</p>
      ${learn("Turun her adımında seçtiğinin kağıtta neye dönüştüğünü anlatacağım. Hesaplar otomatik; sonradan kağıtta her şeyi değiştirebilirsin.")}`;
    if (s === 1) {
      const a = anc(), ab = ancBoosts();
      return `<h3>Soyunu seç</h3><p>Soy, karakterinin halkıdır. Başlangıç canını, boyutunu, hızını ve nitelik artışlarını belirler.</p>
      <div class="zw-grid">${P.ANCESTRIES.map(x => card(W.anc === x.k, "anc", x.k, x.n, x.d, `<small class="zw-tag">Can ${x.hp} · ${x.size} · ${x.speed} ft · ${x.b.map(k => AN[k][2] + " +1").join(", ")}${x.free ? `${x.b.length ? ", " : ""}${x.free} serbest` : ""}${x.flaw ? ` · ${AN[x.flaw][2]} −1` : ""}</small>`)).join("")}${hbCard(W.anc === "custom", "anc", "soyun")}</div>
      ${W.anc === "custom" ? `<div class="zw-custom"><div class="zb-fgrid">${cin("ca.n", "Soyun adı", "örn. Kedi Halkı")}${cin("ca.hp", "Soy canı", "8", "number")}${cin("ca.speed", "Hız (ft)", "25", "number")}${cin("ca.size", "Boyut", "Orta")}</div>
        <div class="zw-sub"><b>Sabit artışlar:</b> ${boostRow("cab", W.ca.b, 2)}</div><div class="zw-sub"><b>Kusur (isteğe bağlı):</b> ${boostRow("caflaw", W.ca.flaw ? [W.ca.flaw] : [], 1)}</div>
        <label class="zw-field" style="max-width:none"><span class="lbl">Özellikler</span><textarea class="f" rows="2" data-pw-c="ca.t" placeholder="örn. Alacakaranlık görüşü">${esc(W.ca.t)}</textarea></label></div>` : ""}
      ${a ? `<div class="zw-custom"><label class="toggle" style="margin-bottom:8px"><input type="checkbox" data-pw="alt" ${W.alt ? "checked" : ""}> Sabit artışlar ve kusur yerine iki serbest artış al (Player Core'daki alternatif kural)</label>
        <div class="zw-sub"><b>Serbest artış${ab.free > 1 ? "lar" : ""} (${W.ancFree.length}/${ab.free}):</b> ${boostRow("ancfree", W.ancFree, ab.free, ab.fixed)}</div>
        ${cin("heritage", "Miras (isteğe bağlı)", "örn. Çok Yönlü İnsan, Kayalık Cüce")}</div>
        ${learn(`<b>Soy canı (${a.hp}):</b> 1. seviyedeki canına eklenir. <b>Miras</b>, soyunun bir alt kolu; kitabından seçip adını yazabilirsin. Soy yetenekleri (feat) kağıttaki "Yetenekler" kutusuna not edilir.`)}` : ""}`;
    }
    if (s === 2) {
      const b = bg();
      return `<h3>Geçmişini seç</h3><p>Geçmiş, maceradan önceki hayatındır. İki niteliğinden birine artış, bir de serbest artış verir; bir beceride ve bir bilgi (lore) alanında eğitimli olursun.</p>
      <div class="zw-grid">${P.BACKGROUNDS.map(x => card(W.bg === x.n, "bg", x.n, x.n, x.d, `<small class="zw-tag">${x.a.map(k => AN[k][2]).join(" ya da ")} · ${SKN[x.s][1]} · ${x.lore} bilgisi</small>`)).join("")}${hbCard(W.bg === "custom", "bg", "geçmişin")}</div>
      ${W.bg === "custom" ? `<div class="zw-custom"><div class="zb-fgrid">${cin("cb.n", "Geçmişin adı", "örn. Kervan Muhafızı")}${cin("cb.lore", "Bilgi alanı", "örn. Ticaret yolları")}</div>
        <div class="zw-sub"><b>Seçenek nitelikleri (iki):</b> ${boostRow("cba", W.cb.a, 2)}</div><div class="zw-sub"><b>Eğitimli beceri:</b> <span class="chips">${P.SKILLS.map(([k, n]) => chip("cbs", k, W.cb.s === k, n)).join("")}</span></div></div>` : ""}
      ${b && (b.a || []).length === 2 ? `<div class="zw-sub"><b>Artış (birini seç):</b> <span class="chips">${b.a.map(k => chip("bga", k, W.bgA === k, AN[k][1])).join("")}</span></div>
        <div class="zw-sub"><b>Serbest artış:</b> ${boostRow("bgfree", W.bgFree ? [W.bgFree] : [], 1, W.bgA ? [W.bgA] : [])}</div>` : ""}`;
    }
    if (s === 3) {
      const c = cls();
      return `<h3>Sınıfını seç</h3><p>Sınıf, karakterinin ne yaptığını belirler: savaş tarzı, büyüleri, yeterlilikleri ve her seviyede kazandıkları. Yeni başlıyorsan Savaşçı ya da Rahip kolaydır.</p>
      <div class="zw-grid">${P.CLASSES.map(x => card(W.cls === x.k, "cls", x.k, x.n, x.d, `<small class="zw-tag">Can ${x.hp}/sv · ${x.key.map(k => AN[k][2]).join("/")}${x.spell ? " · " + P.TRAD[x.spell.trad] + " büyü" : ""}</small>`)).join("")}${hbCard(W.cls === "custom", "cls", "sınıfın")}</div>
      ${W.cls === "custom" ? `<div class="zw-custom"><div class="zb-fgrid">${cin("cc.n", "Sınıfın adı", "örn. Kan Avcısı")}${cin("cc.hp", "Seviye başına can", "8", "number")}${cin("cc.n2", "Ek beceri sayısı", "3", "number")}
          <label class="zw-field"><span class="lbl">Büyü geleneği</span><select class="f" data-pw-c="cc.trad"><option value="">Büyü yapmaz</option>${Object.entries(P.TRAD).map(([k, n]) => `<option value="${k}" ${W.cc.trad === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>
          ${W.cc.trad ? `<label class="zw-field"><span class="lbl">Büyü niteliği</span><select class="f" data-pw-c="cc.sattr"><option value="">—</option>${P.ATTR.map(([k, n]) => `<option value="${k}" ${W.cc.sattr === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>
          <label class="zw-field"><span class="lbl">Büyü türü</span><select class="f" data-pw-c="cc.stype"><option value="prep" ${W.cc.stype === "prep" ? "selected" : ""}>Hazırlanan (2 yuva/rütbe)</option><option value="spont" ${W.cc.stype === "spont" ? "selected" : ""}>Repertuar (3 yuva/rütbe)</option></select></label>` : ""}</div>
        <div class="zw-sub"><b>Anahtar nitelik seçenekleri:</b> ${boostRow("cckey", W.cc.key, 2)}</div>
        <div class="zw-sub"><b>Uzman başladığı:</b> <span class="chips">${["Algı", "Dayanıklılık", "Refleks", "İrade"].map((n, i) => chip("ccr", i, W.cc.r[i] === 2, n)).join("")}</span></div></div>` : ""}
      ${c && c.key?.length ? `<div class="zw-sub"><b>Anahtar nitelik (+1):</b> <span class="chips">${c.key.map(k => chip("key", k, W.key === k, AN[k][1])).join("")}</span></div>
        ${learn(`<b>Anahtar nitelik</b> sınıfının en önemli niteliğidir; saldırılarını, büyülerini ve <b>Sınıf ZK</b>'ni güçlendirir. <b>Can:</b> her seviyede ${c.hp} + Dayanıklılık bonusu. ${c.spell ? `<b>${P.TRAD[c.spell.trad]} büyücülük:</b> ${c.spell.type === "spont" ? "bildiğin büyüleri (repertuar) yuvalarla istediğin gibi yaparsın." : "her gün yuvalarına belirli büyüleri hazırlarsın."}` : ""}`)}` : ""}`;
    }
    if (s === 4) {
      const c = cls();
      return `<h3>Nitelikler: dört serbest artış</h3>
      <p>Pathfinder'da nitelikler doğrudan bonus olarak yazılır: 0 sıradan, +1 iyi, +4 olağanüstü. Soyundan, geçmişinden ve sınıfından gelen artışlar eklendi. Şimdi <b>dört farklı</b> niteliğe birer artış daha ver. Başlangıçta hiçbir nitelik +4'ü geçemez.</p>
      <div class="zw-sub"><b>Serbest artışlar (${W.free.length}/4):</b> ${boostRow("free", W.free, 4)}</div>
      <div class="zw-row"><button type="button" class="btn sm" data-pw="suggest">${esc(short(c.n))} için öner</button></div>
      ${scoreLine()}
      <div class="zw-abil">${P.ATTR.map(([k, n]) => `<div class="zw-ab"><b>${n}</b><small>${(window.ZM5E?.AB_HELP || {})[k] || ""}</small></div>`).join("")}</div>
      ${learn("Bu bonuslar her yere eklenir: Güç yakın dövüş saldırısına ve hasara, Çeviklik ZS'ye ve menzilli saldırıya, Dayanıklılık cana, Zekâ ek becerilere, Bilgelik algıya ve iradeye, Karizma sosyal becerilere.")}`;
    }
    if (s === 5) {
      const fixed = trainedFixed(), need = pickCount(), sc = scores(), L = 1;
      return `<h3>Becerilerini seç</h3><p>Eğitimli (T) olduğun becerilerde zara nitelik bonusuna ek olarak <b>seviye + 2</b> eklenir (1. seviyede +3). Sınıfından ve geçmişinden gelenler işaretli. Zekâ bonusun kadar ek beceri seçersin.</p>
      <p class="zw-left">Seç: <b>${W.skills.length}/${need}</b></p>
      <div class="zw-skills">${P.SKILLS.map(([k, n, a]) => { const fx = fixed.includes(k), on = fx || W.skills.includes(k); return `<button type="button" class="zw-sk" data-pw="skill" data-v="${k}" aria-pressed="${on}" ${fx ? "disabled" : ""}><span class="prof" data-v="${on ? 1 : 0}"></span>${n}<small>${AN[a][2]}${fx ? " · sınıf/geçmiş" : ""}</small><b class="num">${sgn(sc[a] + (on ? P.prof(1, L) : 0))}</b></button>`; }).join("")}</div>
      ${learn("Örneğin bir kapıyı zorlarken GM \"Atletizm, ZK 15\" der; d20 atıp sağdaki sayıyı eklersin. Kağıtta becerinin solundaki harf rütbeyi gösterir (T eğitimli).")}`;
    }
    if (s === SPELL_STEP) {
      const c = cls(), n = spellNeed(), code = P.TCODE[c.spell.trad];
      const pool = r => P.SPELLS.filter(x => x.rank === r && x.trad.includes(code));
      const ct = W.spells.filter(x => !x.rank).length, r1 = W.spells.filter(x => x.rank).length;
      const sc = x => { const on = W.spells.some(y => (x.k && y.k === x.k) || y.id === x.id); return `<button type="button" class="zw-card sm zw-spc" data-pw="spell" data-v="${esc(x.k || x.id)}" aria-pressed="${on}"><b>${esc(x.n)}${x.custom ? ' <small class="zw-tag">özel</small>' : ""}</b><small class="zw-tag">${esc([x.actions + " eylem", x.range].join(" · "))}</small><span>${esc(x.d || "")}</span></button>`; };
      return `<h3>Büyülerini seç</h3><p>${esc(short(c.n))} ${P.TRAD[c.spell.trad].toLocaleLowerCase("tr")} gelenekten büyü yapar. ${n.spont ? "Seçtiğin büyüler <b>repertuarın</b> olur; yuvaların olduğu sürece bunlardan istediğini yaparsın." : n.book ? "Seçtiklerini <b>büyü kitabına</b> yazarsın; her gün bazılarını yuvalarına hazırlarsın." : "Bunlar bugün hazırladığın büyüler; her sabah listenden yeniden seçebilirsin."}</p>
      <div class="zw-gh"><b>Hileler</b><span class="zw-left">${ct}/${n.cant}</span></div><p class="zw-left">Hileler sınırsızdır ve her zaman seviyenin yarısı (yukarı yuvarlanmış) rütbede yapılır.</p><div class="zw-grid">${[...pool(0), ...W.spells.filter(x => x.custom && !x.rank)].map(sc).join("")}</div>
      <div class="zw-gh"><b>1. rütbe büyüler</b><span class="zw-left">${r1}/${n.r1}</span></div><div class="zw-grid">${[...pool(1), ...W.spells.filter(x => x.custom && x.rank)].map(sc).join("")}</div>
      <div class="zw-row"><button type="button" class="btn sm" data-pw="cspell">+ Kendi büyünü yaz</button></div>
      ${learn("Büyü yuvaları günlük büyü hakkındır ve dinlenince dolar. Kağıttaki Büyüler bölümünde rütbe düğmesine basınca yuva düşer; saldırı büyülerinde başarı derecesine göre hasar atılır.")}`;
    }
    if (s === 7) return `<h3>Karakterine kimlik ver</h3>
      ${cin("name", "Karakterin adı", "örn. Lira Gölgeadım")}${cin("player", "Oyuncu (senin adın)")}${cin("deity", "Tanrı (isteğe bağlı)", "örn. Sarenrae")}
      ${learn("Rahip ve şampiyon için tanrı önemlidir: büyülerini ve davranış kurallarını belirler. Diğerleri için hikâye içindir.")}`;
    if (s === 8) {
      const a = anc(), c = cls(), sc = scores(), hp = (+a.hp || 0) + (+c.hp || 0) + sc.con;
      const ac = 10 + sc.dex + P.prof(c.r[4], 1);
      return `<h3>${esc(W.name)} hazır!</h3><p>${esc(a.n)} ${esc(short(c.n))} · ${esc(bg().n)}</p>
      <div class="zw-sum"><div><span class="lbl">Can</span><b class="num">${hp}</b><small>soy ${a.hp} + sınıf ${c.hp} + DAY ${sgn(sc.con)}</small></div>
        <div><span class="lbl">Zırh sınıfı</span><b class="num">${ac}</b><small>10 + ÇEV + zırh yeterliliği (zırh almadan). Zırhını kağıtta ekle.</small></div>
        <div><span class="lbl">Algı</span><b class="num">${sgn(sc.wis + P.prof(c.r[0], 1))}</b><small>İnisiyatif de bununla atılır.</small></div>
        <div><span class="lbl">Sınıf ZK</span><b class="num">${10 + sc[W.key] + P.prof(c.r[6], 1)}</b><small>Sınıf yeteneklerine karşı hedeflerin zorluğu.</small></div></div>
      ${scoreLine()}
      ${W.spells.length ? `<p><b>Büyüler:</b> ${W.spells.map(x => esc(x.n)).join(", ")}</p>` : ""}
      ${learn("Oluştur'a bastıktan sonra kısa bir kağıt turu başlayacak. Yeteneklerini (feat) kitabından seçip kağıttaki kutuya yazmayı unutma: 1. seviyede bir soy yeteneği, bir geçmiş beceri yeteneği ve çoğu sınıfta bir sınıf yeteneği.")}`;
    }
  }

  function build() {
    const a = anc(), b = bg(), c = cls(), sc = scores(), n = PF2.newChar();
    const sk = {}; [...trainedFixed(), ...W.skills].forEach(k => sk[k] = 1);
    const main = W.key === "dex" ? "dex" : "str";
    Object.assign(n, {
      name: W.name.trim(), player: W.player, deity: W.deity, ancestry: a.n, heritage: W.heritage, bg: b.n, cls: c.n, clsKey: c.k, size: a.size, speed: +a.speed || 25,
      ab: sc, keyAttr: W.key, perc: c.r[0], saves: { fort: c.r[1], ref: c.r[2], will: c.r[3] }, classRank: c.r[6], skills: sk,
      lores: b.lore ? [{ name: b.lore, rank: 1 }] : [], armor: { name: "Zırhsız", item: 0, cap: "", rank: c.r[4], shield: 2, raised: false },
      hpMax: (+a.hp || 0) + (+c.hp || 0) + sc.con, ancHp: +a.hp || 0, clsHp: +c.hp || 0,
      strikes: [{ name: main === "dex" ? "Kısa kılıç" : "Uzun kılıç", attr: main, rank: c.r[5], item: 0, dmg: main === "dex" ? "1d6" : "1d8", dmgAttr: main === "str", type: main === "dex" ? "delici" : "kesici", agile: main === "dex" }],
      feats: [a.t ? `${a.n}:\n${a.t}` : "", W.heritage ? `Miras: ${W.heritage}` : "", c.f ? `${short(c.n)}:\n${c.f}` : "", "1. seviye yetenekleri (feat): soy yeteneği, geçmiş beceri yeteneği, sınıf yeteneği"].filter(Boolean).join("\n\n"),
      hero: 1,
    });
    n.hp = n.hpMax;
    if (c.spell) {
      n.sp = { trad: c.spell.trad, attr: c.spell.attr, rank: 1, type: c.spell.type, base: c.spell.base, slots: P.slotsFor(c.spell.base, 1).map(v => ({ max: v, used: 0 })) };
      n.book = W.spells.map(x => ({ ...x }));
    }
    if (FOCUS1.includes(c.k)) n.focus = { cur: 1, max: 1 };
    if (c.k === "custom") n.clsCustom = { n: c.n, hp: +c.hp || 8 };
    return n;
  }

  function draw() {
    let ov = $("#pwOv");
    if (!W) { ov?.remove(); return; }
    if (!ov) { ov = document.createElement("div"); ov.id = "pwOv"; ov.className = "joinov zw-ov"; document.body.appendChild(ov); }
    const s = W.step, last = STEPS.length - 1, ok = valid(s), y = W.keep ? $("#pwBody")?.scrollTop || 0 : 0;
    const show = (n, i) => !(i === SPELL_STEP && !spellNeed());
    ov.innerHTML = `<div class="zw" role="dialog" aria-modal="true" aria-label="Pathfinder karakter yaratma">
      <header class="zw-h"><h2>Karakter yaratma</h2><ol class="zw-steps">${STEPS.map((n, i) => show(n, i) ? `<li class="${i === s ? "on" : i < s ? "done" : ""}">${i ? `<span>${i > SPELL_STEP && !spellNeed() ? i - 1 : i}</span>` : ""}${n}</li>` : "").join("")}</ol><button class="btn sm" data-pw="close" aria-label="Kapat">×</button></header>
      <div class="zw-b" id="pwBody">${stepHtml()}</div>
      <footer class="zw-f">${s === 0 ? `<button class="btn" data-pw="blank">Boş kağıtla başla</button>` : `<button class="btn" data-pw="prev">← Geri</button>`}<span class="zw-why">${ok ? "" : esc(why(s))}</span>
        ${s === last ? `<button class="btn pri" data-pw="finish">Karakteri oluştur</button>` : `<button class="btn pri" data-pw="next" ${ok ? "" : "disabled"}>${s === 0 ? "Başlayalım" : "İleri →"}</button>`}</footer></div>`;
    $("#pwBody").scrollTop = y; W.keep = false;
  }
  const toggle = (arr, v, max) => arr.includes(v) ? arr.filter(x => x !== v) : arr.length < max ? [...arr, v] : arr;

  document.addEventListener("click", e => {
    const nb = e.target.closest('[data-act="newchar"]');
    if (nb && !W && sysKey() === "pf2e" && !S.ro) { e.stopImmediatePropagation(); W = fresh(); draw(); return; }
    const b = e.target.closest("[data-pw]"); if (!b || !W) return;
    const a = b.dataset.pw, v = b.dataset.v;
    switch (a) {
      case "close": W = null; draw(); return;
      case "blank": { W = null; draw(); const n = PF2.newChar(); if (!isDM()) n.owner = ME.id; save("chars", n); if (!isDM()) linkMyChar(n.id); S.charId = n.id; render(); return; }
      case "next": if (valid(W.step)) { W.step = nextStep(W.step, 1); draw(); } return;
      case "prev": W.step = Math.max(0, nextStep(W.step, -1)); draw(); return;
      case "anc": if (W.anc !== v) { W.anc = v; W.ancFree = []; } break;
      case "alt": W.alt = b.checked; W.ancFree = []; break;
      case "ancfree": W.ancFree = toggle(W.ancFree, v, ancBoosts().free); break;
      // Player Core düzeni: iki sabit artış + bir serbest (çoğu soy) ya da hiç sabit yok + iki serbest (insan).
      case "cab": W.ca.b = toggle(W.ca.b, v, 2); W.ca.free = W.ca.b.length >= 2 ? 1 : 2 - W.ca.b.length; W.ancFree = []; break;
      case "caflaw": W.ca.flaw = W.ca.flaw === v ? "" : v; W.ancFree = []; break;
      case "bg": if (W.bg !== v) { W.bg = v; W.bgA = null; W.bgFree = null; W.skills = []; } break;
      case "bga": W.bgA = v; if (W.bgFree === v) W.bgFree = null; break;
      case "bgfree": W.bgFree = W.bgFree === v ? null : v; break;
      case "cba": W.cb.a = toggle(W.cb.a, v, 2); W.bgA = null; break;
      case "cbs": W.cb.s = v; W.skills = W.skills.filter(k => k !== v); break;
      case "cls": if (W.cls !== v) { W.cls = v; const c = cls(); W.key = c?.key?.length === 1 ? c.key[0] : null; W.skills = []; W.spells = []; } break;
      case "cckey": W.cc.key = toggle(W.cc.key, v, 2); W.key = W.cc.key.length === 1 ? W.cc.key[0] : W.cc.key.includes(W.key) ? W.key : null; break;
      case "ccr": W.cc.r[+v] = W.cc.r[+v] === 2 ? 1 : 2; break;
      case "key": W.key = v; break;
      case "free": W.free = toggle(W.free, v, 4); break;
      case "suggest": { const c = cls(), order = [W.key, "con", "dex", "wis", ...P.ATTR.map(x => x[0])].filter((k, i, arr) => k && arr.indexOf(k) === i); W.free = []; for (const k of order) { if (W.free.length === 4) break; W.free.push(k); } void c; break; }
      case "skill": if (W.skills.includes(v)) W.skills = W.skills.filter(k => k !== v); else if (W.skills.length < pickCount()) W.skills.push(v); else { toast(`En fazla ${pickCount()} beceri`); return; } break;
      case "spell": {
        const ex = W.spells.find(x => x.k === v || x.id === v); if (ex) { W.spells = W.spells.filter(x => x !== ex); break; }
        const sp = PF2.fromSrd(v); if (!sp) break; const n = spellNeed(), lim = sp.rank ? n.r1 : n.cant;
        if (W.spells.filter(x => !!x.rank === !!sp.rank).length >= lim) { toast(`En fazla ${lim} ${sp.rank ? "1. rütbe büyü" : "hile"}`); return; }
        W.spells.push(sp); break;
      }
      case "cspell": PF2.form({ rank: 1 }, sp => { W.spells.push(sp); W.keep = true; draw(); }); return;
      case "finish": {
        const n = build(); if (!isDM()) n.owner = ME.id; save("chars", n); if (!isDM()) linkMyChar(n.id); S.charId = n.id; S.view = "karakterler"; W = null; draw(); render();
        toast(`${n.name} oluşturuldu`); setTimeout(() => tour(0), 400); return;
      }
    }
    W.keep = true; draw();
  }, true);
  function setC(el) { const keys = el.dataset.pwC.split("."), last = keys.pop(), o = keys.reduce((a, k) => a[k], W); o[last] = el.type === "number" ? (el.value === "" ? 0 : +el.value) : el.value; }
  document.addEventListener("input", e => { const el = e.target; if (!W || !el.dataset.pwC || el.tagName === "SELECT") return; setC(el); const nx = $("[data-pw=next]"); if (nx) nx.disabled = !valid(W.step); const w = $("#pwOv .zw-why"); if (w) w.textContent = valid(W.step) ? "" : why(W.step); });
  document.addEventListener("change", e => { const el = e.target; if (!W || !el.dataset.pwC || el.tagName !== "SELECT") return; setC(el); W.keep = true; draw(); });

  /* ================= Seviye atlama ================= */
  let U = null;
  const clsOf = c => P.CLASSES.find(x => x.k === c.clsKey) || null;
  function steps() {
    const c = cur(), g = P.GAINS(lvl(c) + 1), out = ["Yeni seviye", "Can"];
    if (g.boosts) out.push("Nitelik artışları");
    if (g.skillInc) out.push("Beceri artışı");
    out.push("Yetenekler", "Yeterlilikler");
    if (c.sp?.attr) out.push("Büyüler");
    out.push("Özet"); return out;
  }
  const lvl = c => Math.max(1, Math.min(20, +c.level || 1));
  const hpGain = c => Math.max(1, (+(clsOf(c)?.hp || c.clsCustom?.hp || c.clsHp || U.hp) || 8) + (+c.ab?.con || 0) + (U.boost.includes("con") && (+c.ab?.con || 0) < 4 ? 1 : 0));
  const maxRank = N => N >= 15 ? 4 : N >= 7 ? 3 : 2;
  function luHtml() {
    const c = cur(), L = lvl(c), N = L + 1, g = P.GAINS(N), name = steps()[U.step], k = clsOf(c);
    if (name === "Yeni seviye") return `<h3>${esc(c.name)}: ${L}. seviyeden ${N}. seviyeye</h3>
      <p>Pathfinder'da her seviye için <b>1000 XP</b> gerekir; seviye atlayınca XP'nden 1000 düşülür. GM hikâyeye göre de seviye atlatabilir.</p>
      ${!k && !c.clsCustom ? `<div class="zw-custom"><p>Sınıfını bulamadım ("${esc(c.cls || "boş")}"). Seçersen can ve büyü yuvaları otomatik hesaplanır.</p><select class="f" data-pu="clsKey" style="max-width:320px"><option value="">Kendi sınıfım</option>${P.CLASSES.map(x => `<option value="${x.k}">${x.n}</option>`).join("")}</select>
        ${cin2("hp", "Seviye başına can", "number")}</div>` : ""}
      <p>Bu seviyede kazanacakların:</p><ul class="zw-list"><li><b>Can:</b> sınıf canı + Dayanıklılık</li><li><b>Tüm eğitimli bonusların +1</b> (seviye bonusa eklenir)</li>
        ${g.boosts ? "<li><b>Dört nitelik artışı</b></li>" : ""}${g.skillInc ? "<li><b>Beceri artışı:</b> bir becerinin rütbesini yükselt</li>" : ""}
        ${g.classFeat ? "<li>Sınıf yeteneği (feat)</li>" : ""}${g.skillFeat ? "<li>Beceri yeteneği</li>" : ""}${g.generalFeat ? "<li>Genel yetenek</li>" : ""}${g.ancestryFeat ? "<li>Soy yeteneği</li>" : ""}
        <li>Sınıf özellikleri ve yeterlilik artışları (kitabındaki ${N}. seviye satırı)</li>${c.sp?.attr ? "<li>Yeni büyü yuvaları ve büyüler</li>" : ""}</ul>`;
    if (name === "Can") return `<h3>Can puanı</h3><p>Pathfinder'da zar atılmaz: her seviyede sınıfının canı + Dayanıklılık bonusu kadar can kazanırsın.</p>
      <div class="zw-sum"><div><span class="lbl">Kazanılan</span><b class="num">+${hpGain(c)}</b></div><div><span class="lbl">Yeni azami</span><b class="num">${(+c.hpMax || 0) + hpGain(c)}</b></div></div>
      ${U.boost.includes("con") ? `<p class="zw-left">Dayanıklılık artışı, 1. seviyeden bu yana her seviye için de +1 can verir; bunu uygulamada ekliyorum (+${L}).</p>` : ""}`;
    if (name === "Nitelik artışları") return `<h3>Dört nitelik artışı</h3><p>Dört <b>farklı</b> niteliğe +1 ver. Bir nitelik zaten +4 ya da üstündeyse artış yarımdır: iki yarım artış +1 eder (kağıt bunu hatırlar).</p>
      <div class="zw-sub">${boostRow2(U.boost, 4)}</div>
      <div class="zw-abil sm">${P.ATTR.map(([a, , ab]) => { const v = +c.ab?.[a] || 0, on = U.boost.includes(a), full = v < 4 || c.partial?.[a]; return `<div class="zw-ab ${on ? "main" : ""}"><b>${ab}</b><span class="num">${sgn(v)}${on ? ` → ${sgn(full ? v + 1 : v)}${full ? "" : " (yarım)"}` : ""}</span></div>`; }).join("")}</div>`;
    if (name === "Beceri artışı") {
      const mr = maxRank(N), all = [...P.SKILLS.map(([s, n]) => [s, n, +c.skills?.[s] || 0]), ...(c.lores || []).map((l, i) => ["lore" + i, l.name + " bilgisi", +l.rank || 0])];
      return `<h3>Beceri artışı</h3><p>Bir beceriyi bir rütbe yükselt (eğitimsiz → eğitimli → uzman…). ${N < 7 ? "7. seviyeye kadar en çok Uzman." : N < 15 ? "15. seviyeye kadar en çok Usta." : ""}</p>
      <div class="zw-skills">${all.map(([s, n, r]) => `<button type="button" class="zw-sk" data-pua="skill" data-v="${s}" aria-pressed="${U.skill === s}" ${r >= mr ? "disabled" : ""}><span class="pf-rk r${U.skill === s ? r + 1 : r}">${P.RANKS[U.skill === s ? r + 1 : r][0]}</span>${esc(n)}<small>${P.RANKS[r][1]}</small><b></b></button>`).join("")}</div>`;
    }
    if (name === "Yetenekler") return `<h3>Yetenekler (feat) ve sınıf özellikleri</h3><p>Yetenekleri kitabından (ya da masanızın homebrew listesinden) seç ve adlarını yaz; kağıttaki kutuya eklenecek.</p>
      <div class="zb-fgrid">${g.classFeat ? cin2("classFeat", "Sınıf yeteneği") : ""}${g.skillFeat ? cin2("skillFeat", "Beceri yeteneği") : ""}${g.generalFeat ? cin2("generalFeat", "Genel yetenek") : ""}${g.ancestryFeat ? cin2("ancestryFeat", "Soy yeteneği") : ""}</div>
      <label class="zw-field" style="max-width:none"><span class="lbl">Sınıf özellikleri (${N}. seviye)</span><textarea class="f" rows="3" data-pu="features" placeholder="örn. Weapon Expertise, Evasion…">${esc(U.features)}</textarea></label>
      ${learn("Sınıf yetenekleri dövüş tarzını, beceri yetenekleri beceri kullanımını, genel yetenekler her şeyi geliştirir. Seçeneklerin çok; kitaptaki seviye şartına uyduğundan emin ol.")}`;
    if (name === "Yeterlilikler") { const rows = [["perc", "Algı"], ["saves.fort", "Dayanıklılık"], ["saves.ref", "Refleks"], ["saves.will", "İrade"], ["armor.rank", "Zırh"], ["classRank", "Sınıf ZK"], ...(c.sp?.attr ? [["sp.rank", "Büyü"]] : []), ...(c.strikes || []).map((s, i) => [`strikes.${i}.rank`, s.name])];
      return `<h3>Yeterlilik artışları</h3><p>Sınıfın bazı seviyelerde algı, kurtarma, zırh, silah ya da büyü yeterliliğini yükseltir (örneğin 5. seviyede "Weapon Expertise"). Kitabındaki ${N}. seviye satırına bak; yükselenleri burada işaretle.</p>
      <div class="pf-rkgrid">${rows.map(([p, n]) => { const v = U.ranks[p] ?? (+getPath(c, p) || 0); return `<div><span>${esc(n)}</span><span class="chips">${P.RANKS.map((r, i) => `<button type="button" class="chip" data-pua="rank" data-k="${p}" data-v="${i}" aria-pressed="${v === i}" title="${r[1]}">${r[0]}</button>`).join("")}</span></div>`; }).join("")}</div>`; }
    if (name === "Büyüler") {
      const base = c.sp.base || clsOf(c)?.spell?.base || 2, old = P.slotsFor(base, L), nw = P.slotsFor(base, N), code = P.TCODE[c.sp.trad], maxR = nw.reduce((m, v, i) => v ? i + 1 : m, 0);
      const spont = (c.sp.type || clsOf(c)?.spell?.type) === "spont", add = spont ? nw.reduce((a, v, i) => a + Math.max(0, v - old[i]), 0) : clsOf(c)?.k === "wizard" || clsOf(c)?.k === "witch" ? 2 : 0;
      U.spLimit = add || 99;
      const pool = P.SPELLS.filter(s => s.rank && s.rank <= maxR && (!code || s.trad.includes(code)) && !(c.book || []).some(b => b.k === s.k));
      return `<h3>Büyüler</h3><table class="zg-slots"><tr><th></th>${nw.map((_, i) => `<th>${i + 1}</th>`).join("")}</tr><tr><td>Önce</td>${old.map(v => `<td>${v || "–"}</td>`).join("")}</tr><tr><td><b>Sonra</b></td>${nw.map((v, i) => `<td class="${v > old[i] ? "up" : ""}">${v || "–"}</td>`).join("")}</tr></table>
      <p>${spont ? `Repertuarına <b>${add}</b> yeni büyü ekleyebilirsin (yeni yuvalar kadar).` : add ? `Büyü kitabına <b>${add}</b> yeni büyü yazarsın.` : "Listendeki her büyüyü hazırlayabilirsin; istediklerini kitaba ekle."} Hileler kendiliğinden ${P.cantripRank(N)}. rütbeye çıkar.</p>
      <div class="zw-grid">${pool.map(s => `<button type="button" class="zw-card sm zw-spc" data-pua="spell" data-v="${s.k}" aria-pressed="${U.spells.some(x => x.k === s.k)}"><b>${esc(s.n)}</b><small class="zw-tag">${s.rank}. r · ${esc(s.actions)} eylem</small><span>${esc(s.d)}</span></button>`).join("")}
        ${U.spells.filter(x => x.custom).map(s => `<button type="button" class="zw-card sm zw-spc" data-pua="spell" data-v="${s.id}" aria-pressed="true"><b>${esc(s.n)} <small class="zw-tag">özel</small></b><span>${esc(s.d || "")}</span></button>`).join("")}</div>
      <div class="zw-row"><button type="button" class="btn sm" data-pua="cspell">+ Kendi büyünü yaz</button></div>`;
    }
    if (name === "Özet") return `<h3>${esc(c.name)} ${N}. seviye oluyor</h3><ul class="zw-list"><li>Can +${hpGain(c) + (U.boost.includes("con") && (+c.ab?.con || 0) < 4 ? L : 0)}</li>
      ${U.boost.length ? `<li>Nitelik artışları: ${U.boost.map(a => AN[a][2]).join(", ")}</li>` : ""}${U.skill ? `<li>Beceri artışı: ${esc(U.skill.startsWith("lore") ? c.lores[+U.skill.slice(4)]?.name : SKN[U.skill][1])}</li>` : ""}
      ${["classFeat", "skillFeat", "generalFeat", "ancestryFeat"].filter(k => U[k]).map(k => `<li>${esc(U[k])}</li>`).join("")}${U.features.trim() ? `<li>${esc(U.features.trim())}</li>` : ""}
      ${Object.keys(U.ranks).length ? `<li>Yeterlilik: ${Object.entries(U.ranks).map(([p, v]) => `${esc(p)} → ${P.RANKS[v][1]}`).join(", ")}</li>` : ""}${U.spells.length ? `<li>Yeni büyüler: ${U.spells.map(s => esc(s.n)).join(", ")}</li>` : ""}</ul>`;
  }
  const cin2 = (k, l, type = "text") => `<label class="zw-field"><span class="lbl">${l}</span><input class="f" type="${type}" data-pu="${k}" value="${esc(U[k] ?? "")}"></label>`;
  const boostRow2 = (picked, max) => `<span class="chips">${P.ATTR.map(([k, n]) => `<button type="button" class="chip" data-pua="boost" data-v="${k}" aria-pressed="${picked.includes(k)}" ${!picked.includes(k) && picked.length >= max ? "disabled" : ""}>${n}</button>`).join("")}</span>`;
  function luValid() { const n = steps()[U.step]; if (n === "Nitelik artışları") return U.boost.length === 4; if (n === "Beceri artışı") return !!U.skill; return true; }
  function luDraw() {
    let ov = $("#puOv"); if (!U) { ov?.remove(); return; }
    if (!ov) { ov = document.createElement("div"); ov.id = "puOv"; ov.className = "joinov zw-ov"; document.body.appendChild(ov); }
    const st = steps(), s = U.step, ok = luValid(), y = U.keep ? $("#puBody")?.scrollTop || 0 : 0;
    ov.innerHTML = `<div class="zw" role="dialog" aria-modal="true" aria-label="Seviye atla"><header class="zw-h"><h2>Seviye atla</h2><ol class="zw-steps">${st.map((n, i) => `<li class="${i === s ? "on" : i < s ? "done" : ""}"><span>${i + 1}</span>${n}</li>`).join("")}</ol><button class="btn sm" data-pua="close" aria-label="Kapat">×</button></header>
      <div class="zw-b" id="puBody">${luHtml()}</div><footer class="zw-f">${s ? `<button class="btn" data-pua="prev">← Geri</button>` : `<button class="btn" data-pua="close">Vazgeç</button>`}<span class="zw-why">${ok ? "" : st[s] === "Nitelik artışları" ? "Dört nitelik seç." : "Bir beceri seç."}</span>
      ${s === st.length - 1 ? `<button class="btn pri" data-pua="apply">Uygula</button>` : `<button class="btn pri" data-pua="next" ${ok ? "" : "disabled"}>İleri →</button>`}</footer></div>`;
    $("#puBody").scrollTop = y; U.keep = false;
  }
  function luApply() {
    const c = cur(), L = lvl(c), N = L + 1, paths = ["level", "hp", "hpMax", "ab", "skills", "lores", "feats", "xp"];
    let gain = hpGain(c);
    c.partial = c.partial || {};
    const con0 = +c.ab.con || 0;
    U.boost.forEach(a => { const v = +c.ab[a] || 0; if (v < 4) c.ab[a] = v + 1; else if (c.partial[a]) { c.ab[a] = v + 1; delete c.partial[a]; } else c.partial[a] = true; });
    // Dayanıklılık arttıysa önceki her seviye için de +1 can (yeni seviyeninki hpGain içinde, yarım artıştan tamamlananı ayrıca).
    if ((+c.ab.con || 0) > con0) gain += L + (con0 >= 4 ? 1 : 0);
    c.level = N; c.hpMax = (+c.hpMax || 0) + gain; c.hp = (+c.hp || 0) + gain;
    if ((+c.xp || 0) >= P.XP_PER_LEVEL) c.xp = +c.xp - P.XP_PER_LEVEL;
    if (U.skill) { if (U.skill.startsWith("lore")) { const l = c.lores[+U.skill.slice(4)]; l.rank = (+l.rank || 0) + 1; } else { c.skills = c.skills || {}; c.skills[U.skill] = (+c.skills[U.skill] || 0) + 1; } }
    Object.entries(U.ranks).forEach(([p, v]) => { setPath(c, p, v); paths.push(p.split(".")[0]); });
    const add = [U.classFeat && `Sınıf yeteneği: ${U.classFeat}`, U.skillFeat && `Beceri yeteneği: ${U.skillFeat}`, U.generalFeat && `Genel yetenek: ${U.generalFeat}`, U.ancestryFeat && `Soy yeteneği: ${U.ancestryFeat}`, U.features.trim()].filter(Boolean);
    if (add.length) c.feats = `${c.feats ? c.feats.trimEnd() + "\n\n" : ""}${N}. seviye:\n${add.join("\n")}`;
    if (c.sp?.attr) { const base = c.sp.base || clsOf(c)?.spell?.base || 2; c.sp.slots = P.slotsFor(base, N).map((v, i) => ({ max: v, used: Math.min(+c.sp.slots?.[i]?.used || 0, v) })); U.spells.forEach(s => PF2.addToBook(c, s)); paths.push("sp", "book"); }
    if (U.clsKey && !c.clsKey) { c.clsKey = U.clsKey; paths.push("clsKey"); }
    if (!clsOf(c) && !c.clsCustom) { c.clsCustom = { n: c.cls || "Kendi sınıfım", hp: +U.hp || 8 }; paths.push("clsCustom"); }
    paths.push("partial");
    save("chars", c, [...new Set(paths)]);
    pushRoll({ id: uid("l"), t: Date.now(), label: `${c.name} seviye atladı`, expr: "", total: N, detail: `+${gain} can`, crit: null });
    U = null; luDraw(); render(); toast(`${c.name} artık ${N}. seviye!`);
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-pua]"); if (!b || !U) return;
    const a = b.dataset.pua, v = b.dataset.v;
    switch (a) {
      case "close": U = null; luDraw(); return;
      case "next": if (luValid()) U.step++; luDraw(); return;
      case "prev": U.step = Math.max(0, U.step - 1); luDraw(); return;
      case "apply": luApply(); return;
      case "boost": U.boost = toggle(U.boost, v, 4); break;
      case "skill": U.skill = U.skill === v ? null : v; break;
      case "rank": U.ranks[b.dataset.k] = +v; break;
      case "spell": { const ex = U.spells.find(x => x.k === v || x.id === v); if (ex) U.spells = U.spells.filter(x => x !== ex); else { if (U.spells.filter(x => !x.custom).length >= U.spLimit) { toast(`En fazla ${U.spLimit} büyü`); return; } U.spells.push(PF2.fromSrd(v)); } break; }
      case "cspell": PF2.form({ rank: 1 }, sp => { U.spells.push(sp); U.keep = true; luDraw(); }); return;
    }
    U.keep = true; luDraw();
  });
  document.addEventListener("input", e => { const el = e.target; if (!U || !el.dataset.pu) return; const k = el.dataset.pu; U[k] = el.value; if (k === "clsKey") { U.keep = true; luDraw(); } });
  document.addEventListener("keydown", e => { if (e.key !== "Escape") return; if ($("#pfFormOv") || $("#pfPickOv")) return; if (W) { W = null; draw(); } if (U) { U = null; luDraw(); } if (T != null) endTour(); $("#pgOv")?.remove(); });

  /* ================= Rehberler ================= */
  function guide(title, html) {
    $("#pgOv")?.remove(); const ov = document.createElement("div"); ov.id = "pgOv"; ov.className = "joinov zw-ov zb-ov";
    ov.innerHTML = `<div class="zw" role="dialog" aria-modal="true" aria-label="${esc(title)}" style="width:min(720px,100%)"><header class="zw-h"><h2>${esc(title)}</h2><span style="flex:1"></span><button class="btn sm" data-pg="close" aria-label="Kapat">×</button></header><div class="zw-b">${html}</div><footer class="zw-f"><span style="flex:1"></span><button class="btn pri" data-pg="close">Anladım</button></footer></div>`;
    document.body.appendChild(ov);
  }
  document.addEventListener("click", e => { if (e.target.closest("[data-pg=close]")) $("#pgOv")?.remove(); });
  const spellGuide = () => guide("Büyüler nasıl kullanılır?", `
    <p><b>Hileler</b> sınırsızdır ve her zaman seviyenin yarısı (yukarı yuvarlanmış) rütbede yapılır; zarları kendiliğinden büyür.</p>
    <p><b>Rütbeli büyüler</b> bir yuva harcar. Büyünün yanındaki rütbe düğmesi o rütbedeki bir yuvayla yapar; daha yüksek bir rütbe seçersen büyü <b>yükseltilir</b> (heightened) ve zarları artar. Hazırlayan büyücüler (Rahip, Druid, Büyücü, Cadı) büyüyü o rütbede hazırlamış olmalı; repertuarı olanlar (Ozan, Sihirbaz, Kâhin) yalnızca imza büyülerini serbestçe yükseltebilir.</p>
    <p><b>Büyü saldırısı</b> hedefin ZS'sine karşı atılır. Tepsiye hedefin ZS'sini yazarsan isabet ederse hasar kendiliğinden atılır; kritik başarıda iki kat. <b>Temel kurtarma</b> büyülerinde hedef zar atar: kritik başarı hasarsız, başarı yarı, başarısızlık tam, kritik başarısızlık iki kat.</p>
    <p><b>Odak büyüleri</b> yuva yerine odak puanı harcar; 10 dakika odaklanarak (Refocus) bir puan geri kazanırsın. Dinlenince yuvalar ve odak dolar.</p>
    <aside class="zw-learn"><b>Homebrew:</b> <b>+ Büyü ekle → Kendi büyünü yaz</b> ile listede olmayan büyüleri ekle. Bir büyünün adına tıklayıp <b>Düzenle</b> ile değiştirebilirsin.</aside>`);
  const growGuide = () => guide("Karakterin nasıl gelişir?", `
    <p>Her <b>1000 XP</b>'de bir seviye atlarsın; XP'ni kağıttaki kutuya yaz. Birçok masa XP saymaz, GM hikâyede seviye atlatır; o zaman doğrudan <b>Seviye atla</b>'ya bas.</p>
    <ol class="zw-list"><li>Her seviyede sınıf canı + Dayanıklılık kadar can kazanırsın; eğitimli olduğun her şey +1 artar (seviye bonusa eklenir).</li><li>Çift seviyelerde sınıf ve beceri yeteneği; 3, 7, 11, 15, 19'da genel yetenek; 5, 9, 13, 17'de soy yeteneği.</li><li>3. seviyeden itibaren tek seviyelerde beceri artışı.</li><li>5, 10, 15 ve 20. seviyede dört nitelik artışı.</li><li>Sınıfına göre yeterlilik artışları ve yeni büyü yuvaları.</li></ol>
    <aside class="zw-learn"><b>Homebrew:</b> Sihirbazdaki metin kutularına kendi yeteneklerinizi yazabilir, yeterlilik rütbelerini istediğin gibi ayarlayabilirsin.</aside>`);

  /* ================= Kağıt rehberi ================= */
  const panel = t => $$("#main .panel").find(p => rawText(p.querySelector("h3")).startsWith(t));
  const vit = t => $$("#main .vit").find(v => rawText(v.querySelector(".lbl")).startsWith(t));
  const TOUR = [
    [() => $("#main .cname")?.closest(".panel"), "Kimlik", "Soy, miras, geçmiş, sınıf ve seviye. Seviye arttıkça eğitimli olduğun her şeyin bonusu kendiliğinden artar."],
    [() => $("#pxBar"), "Deneyim ve seviye", "1000 XP'de bir seviye atlarsın. Seviye atla sihirbazı can, artışlar, yetenekler ve büyüleri adım adım günceller."],
    [() => vit("Zırh"), "Zırh sınıfı (ZS)", "Düşman saldırısının ulaşması gereken sayı: 10 + Çeviklik (zırh sınırına kadar) + zırh yeterliliği + zırh bonusu. Kalkan kaldırınca artar."],
    [() => vit("Algı"), "Algı ve inisiyatif", "Etrafını fark etme. Savaş başlarken genellikle Algı ile inisiyatif atılır; düğmeye basınca d20 + Algı."],
    [() => vit("Sınıf"), "Sınıf ZK", "Sınıf yeteneklerinde hedeflerin geçmesi gereken zorluk. Anahtar niteliğini buradan seçersin."],
    [() => vit("Kahraman"), "Kahraman puanı", "GM'in verdiği puanlar. Bir puan harcayıp son kontrolü yeniden atabilirsin (Yeniden at). Üç puanı birden harcayıp ölümden dönebilirsin."],
    [() => $("#main .abil"), "Nitelikler", "Altı niteliğin bonusu. Pathfinder'da puan değil doğrudan bonus yazılır (+3 gibi). Düğmeye basınca d20 + bonus atılır."],
    [() => panel("Kurtarmalar"), "Kurtarmalar", "Dayanıklılık, Refleks, İrade. Soldaki harf yeterlilik rütbesidir: T eğitimli, E uzman, M usta, L efsanevi. Harfe tıklayarak değiştirirsin."],
    [() => panel("Beceriler"), "Beceriler", "Eğitimli olduğun becerilerde seviye + 2 eklenir. + Bilgi ile kendi bilgi (lore) alanlarını ekle."],
    [() => panel("Can Puanı"), "Can, ölmek üzere ve yaralı", "0 cana düşünce ölmek üzere olursun; her turunda iyileşme kontrolü atarsın. Ölmek üzere 4'e ulaşırsa ölürsün. Kendine gelince yaralı olursun; bir sonraki düşüşte daha tehlikelidir."],
    [() => panel("Durumlar"), "Durumlar", "Korkmuş 2, sakar 1 gibi sayılı durumlar ve açık/kapalı durumlar. Cezalar kağıttaki tüm sayılara kendiliğinden yansır."],
    [() => panel("Saldırılar"), "Saldırılar", "Turda üç eyleme kadar saldırabilirsin; her sonraki saldırı −5 (çevik silahta −4). Üç düğme 1., 2. ve 3. saldırıdır. Tepsiye hedefin ZS'sini yazarsan isabet edince hasar da atılır."],
    [() => $("#pfSpells"), "Büyüler", "Gelenek, büyü niteliği ve yuvalar. Büyünün yanındaki rütbe düğmesi tek tıkla yuvayı düşer ve zarı atar."],
  ];
  let T = null, shownT = null;
  function tour(i) { if (S.view !== "karakterler") { S.view = "karakterler"; render(); } T = i; drawTour(); }
  function endTour() { T = null; shownT = null; $$(".zt-hl").forEach(x => x.classList.remove("zt-hl")); $("#ztCard")?.remove(); }
  function drawTour() {
    $$(".zt-hl").forEach(x => x.classList.remove("zt-hl")); if (T == null) return;
    let t = null; while (T < TOUR.length && !(t = TOUR[T][0]())) T++;
    if (T >= TOUR.length) { endTour(); toast("Rehber bitti. İyi maceralar!"); return; }
    t.classList.add("zt-hl"); if (shownT !== T) { shownT = T; t.scrollIntoView({ block: "center", behavior: "smooth" }); }
    let c = $("#ztCard"); if (!c) { c = document.createElement("div"); c.id = "ztCard"; c.className = "zt-card"; c.setAttribute("role", "dialog"); document.body.appendChild(c); }
    c.innerHTML = `<div class="zt-top"><span class="lbl">Kağıt rehberi · ${T + 1}/${TOUR.length}</span><button class="btn sm" data-pt="end" aria-label="Rehberi kapat">×</button></div><h3>${TOUR[T][1]}</h3><p>${TOUR[T][2]}</p>
      <div class="zt-nav"><button class="btn sm" data-pt="prev" ${T ? "" : "disabled"}>← Önceki</button><button class="btn sm pri" data-pt="next">${T === TOUR.length - 1 ? "Bitir" : "Sonraki →"}</button></div>`;
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-pt]"); if (!b) return; const a = b.dataset.pt;
    if (a === "start") tour(0); else if (a === "end") endTour(); else if (a === "next") { T++; drawTour(); } else if (a === "prev") { T = Math.max(0, T - 1); drawTour(); }
    else if (a === "up") { const c = cur(); if (!c) return; if (lvl(c) >= 20) { toast("Zaten 20. seviyedesin"); return; } U = { step: 0, boost: [], skill: null, ranks: {}, spells: [], features: "", classFeat: "", skillFeat: "", generalFeat: "", ancestryFeat: "", hp: 8 }; luDraw(); }
    else if (a === "grow") growGuide();
  });

  /* ================= Kağıda yerleştir ================= */
  const _render = window.render;
  window.render = function () {
    const r = _render.apply(this, arguments);
    try {
      if (G.id && S.view === "karakterler" && sysKey() === "pf2e" && $("#main .sheet.pf2")) {
        const c = cur(), h = $("#main .vhead");
        if (h && !$("[data-pt=start]", h)) { const b = document.createElement("button"); b.className = "btn sm"; b.dataset.pt = "start"; b.textContent = "Kağıt rehberi"; h.insertBefore(b, $("[data-act=newchar]", h) || null); }
        const idp = $("#main .cname")?.closest(".panel");
        if (c && idp && !$("#pxBar")) { const xp = +c.xp || 0, pct = Math.min(100, xp / P.XP_PER_LEVEL * 100), ready = xp >= P.XP_PER_LEVEL;
          idp.insertAdjacentHTML("afterend", `<div class="panel zg" id="pxBar"><span class="lbl">Deneyim</span><label class="zg-xp"><input class="f num" type="number" min="0" data-k="xp" value="${esc(c.xp ?? 0)}" aria-label="Deneyim puanı"><span>/ 1000 XP</span></label>
            <div class="zg-track"><i class="${ready ? "ok" : ""}" style="width:${pct}%"></i></div><span class="zg-next">${ready ? `<b>${lvl(c) + 1}. seviyeye hazır!</b>` : `${P.XP_PER_LEVEL - xp} XP kaldı`}</span><span class="sp"></span>
            <button type="button" class="btn sm" data-pt="grow">Nasıl gelişir?</button>${lvl(c) < 20 ? `<button type="button" class="btn sm ${ready ? "pri" : ""}" data-pt="up">Seviye atla</button>` : ""}</div>`); }
        if (T != null) drawTour();
      } else if (T != null && (S.view !== "karakterler" || sysKey() !== "pf2e")) endTour();
    } catch (err) { console.error(err); }
    return r;
  };
  window.PF2G = { spellGuide, growGuide, tour };
})();
