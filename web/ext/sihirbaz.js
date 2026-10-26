/* Masaüstü eklentileri (2): D&D 5e karakter yaratma sihirbazı ve karakter kağıdı rehberi.
   Oyuncuyu adım adım yönlendirir, her adımda o bölümün oyunda ne işe yaradığını anlatır. */
(function () {
  "use strict";

  const { AB_HELP, RACES, CLASSES, BACKGROUNDS, ALIGN, SPELLS, slotsFor, cantripsAt } = window.ZM5E;

  const STD = [15, 14, 13, 12, 10, 8];
  const SKN = Object.fromEntries(SKILLS.map(s => [s[0], s]));
  const ALL_SK = SKILLS.map(s => s[0]);

  /* ---------------- Sihirbaz durumu ---------------- */
  const STEPS = ["Başlarken", "Irk", "Sınıf", "Yetenekler", "Geçmiş", "Beceriler", "Büyüler", "Kimlik", "Özet"];
  const SPELL_STEP = 6;
  let W = null;
  const fresh = () => ({ step: 0, race: null, cls: null, method: "std", base: { str: null, dex: null, con: null, int: null, wis: null, cha: null }, rolled: null, plus: [], bg: null, skills: [], expertise: [], spells: [], name: "", align: "Tarafsız", player: ME.name || "",
    // Kendi ırkın / sınıfın / geçmişin (homebrew)
    cr: { k: "custom", n: "", ab: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, speed: 30, t: "" },
    cc: { k: "custom", n: "", hd: 8, saves: [], pick: 2, spell: "", kind: "", f: "" },
    cb: { n: "", s: [], d: "" } });

  function customCls() {
    const c = W.cc, main = c.spell || "str";
    return { ...c, skills: "all", order: [main, ...["con", "dex", "str", "wis", "int", "cha"].filter(k => k !== main)], ac: { base: 10, dex: true, note: "Zırhsız: 10 + ÇEV (zırhın varsa kağıtta değiştir)" },
      weapon: ["Silah", main === "dex" ? "dex" : "str", "1d8", ""], cant: c.spell ? 2 : 0, code: "", d: "", inv: "", spellsAt1: c.spell && c.kind && c.kind !== "half" ? 2 : 0 };
  }
  const race = () => W.race === "custom" ? W.cr : RACES.find(r => r.k === W.race), cls = () => W.cls === "custom" ? customCls() : CLASSES.find(c => c.k === W.cls), bg = () => W.bg === "custom" ? W.cb : BACKGROUNDS.find(b => b.n === W.bg);
  // 1. seviyede seçilecek hile ve büyü sayıları.
  function spellNeed() {
    const c = cls(); if (!c || !c.spell) return null;
    const wis = mod(finalScore(c.spell) ?? 10);
    const lv1 = c.k === "custom" ? c.spellsAt1 : { bard: 4, sorcerer: 2, warlock: 2, wizard: 6, cleric: Math.max(1, wis + 1), druid: Math.max(1, wis + 1) }[c.k] || 0;
    const cant = c.k === "custom" ? c.cant : cantripsAt(c, 1);
    return cant || lv1 ? { cant, lv1, prep: !!c.prep, book: !!c.book } : null;
  }
  const hasSpellStep = () => !!spellNeed();
  const nextStep = (s, dir) => { s += dir; if (s === SPELL_STEP && !hasSpellStep()) s += dir; return s; };
  function racialBonus(k) { const r = race(); if (!r) return 0; return (r.ab[k] || 0) + (W.plus.includes(k) ? 1 : 0); }
  function finalScore(k) { const b = W.base[k]; return b == null ? null : b + racialBonus(k); }
  function pool() { return W.method === "roll" && W.rolled ? W.rolled : STD; }
  function fixedSkills() { const s = new Set([...(bg()?.s || []), ...(race()?.skills || [])]); return [...s]; }
  function classSkillList() { const c = cls(); return !c ? [] : c.skills === "all" ? ALL_SK : c.skills; }
  function pickCount() { return (cls()?.pick || 0) + (race()?.extraSkills || 0); }

  function valid(step) {
    if (step === 1) return !!W.race && (!race().choose || W.plus.length === race().choose) && (W.race !== "custom" || !!W.cr.n.trim());
    if (step === 2) return !!W.cls && (W.cls !== "custom" || (!!W.cc.n.trim() && W.cc.saves.length === 2));
    if (step === 3) { const used = Object.values(W.base); if (used.some(v => v == null)) return false; const p = [...pool()].sort().join(), u = [...used].sort().join(); return p === u; }
    if (step === 4) return !!W.bg && (W.bg !== "custom" || (!!W.cb.n.trim() && W.cb.s.length === 2));
    if (step === 5) return W.skills.length === pickCount() && (!cls()?.expertise || W.expertise.length === cls().expertise);
    if (step === SPELL_STEP) { const n = spellNeed(); if (!n) return true; const ct = W.spells.filter(x => !x.lvl).length, l1 = W.spells.filter(x => x.lvl).length; return ct <= n.cant && l1 <= n.lv1; }
    if (step === 7) return W.name.trim().length > 0;
    return true;
  }
  const why = step => ({ 1: W.race === "custom" ? "Irkına bir ad ver." : race()?.choose ? "İki yetenek seçip +1 ver." : "Bir ırk seç.", 2: W.cls === "custom" ? "Sınıfına bir ad ver ve iki kurtarma zarı seç." : "Bir sınıf seç.", 3: "Her değeri bir yeteneğe bir kez ver.", 4: W.bg === "custom" ? "Geçmişine bir ad ver ve iki beceri seç." : "Bir geçmiş seç.", 5: `${pickCount()} beceri seç${cls()?.expertise ? `, sonra ${cls().expertise} uzmanlık işaretle` : ""}.`, 6: "Seçebileceğin sayıyı aştın.", 7: "Karakterine bir ad ver." })[step] || "";

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
      features: [r.t ? `${r.n}:\n${r.t}` : "", c.f ? `${c.n}:\n${c.f}` : "", `Zırh: ${c.ac.note}`].filter(Boolean).join("\n\n"),
      inventory: c.inv, coins: { cp: 0, sp: 0, ep: 0, gp: 10, pp: 0 }, spells: "", xp: 0,
      clsKey: c.k, book: W.spells.map(s => ({ ...s, prep: !!s.lvl })), conc: "",
    });
    if (c.k === "custom") { n.clsCustom = { k: "custom", n: c.n, hd: c.hd, saves: c.saves, spell: c.spell, kind: c.kind || null, cant: c.cant, f: c.f }; delete n.clsKey; }
    if (c.spell) slotsFor(c.kind, 1).forEach((v, i) => n.slots[i] = { max: v, used: 0 });
    return n;
  }

  /* ---------------- Görünüm ---------------- */
  const card = (on, act, val, title, body, extra = "") => `<button type="button" class="zw-card" data-zw="${act}" data-v="${esc(val)}" aria-pressed="${on}"><b>${title}</b>${extra}<span>${body}</span></button>`;
  const learn = t => `<aside class="zw-learn"><b>Ne işe yarar?</b> ${t}</aside>`;
  const hbCard = (on, act, what) => `<button type="button" class="zw-card zw-hb" data-zw="${act}" data-v="custom" aria-pressed="${on}"><b>+ Kendi ${what}</b><span>Kitaptan ya da masanızdan (homebrew) bir ${what.replace(/ın$|in$|un$|ün$/, "")} ekle; içini sen doldur.</span></button>`;
  const cin = (path, lbl, ph = "", type = "text", extra = "") => { const v = path.split(".").reduce((o, k) => o?.[k], W); return `<label class="zw-field"><span class="lbl">${lbl}</span><input class="f" type="${type}" data-zw-c="${path}" value="${esc(v ?? "")}" placeholder="${esc(ph)}" ${extra}></label>`; };
  const cta = (path, lbl, ph = "") => `<label class="zw-field" style="max-width:none"><span class="lbl">${lbl}</span><textarea class="f" rows="3" data-zw-c="${path}" placeholder="${esc(ph)}">${esc(path.split(".").reduce((o, k) => o?.[k], W) || "")}</textarea></label>`;
  const spCard = s => { const on = W.spells.some(x => x.id === s.id || (s.k && x.k === s.k)); return `<button type="button" class="zw-card sm zw-spc" data-zw="spell" data-v="${esc(s.k || s.id)}" aria-pressed="${on}"><b>${esc(s.n)}${s.custom ? ' <small class="zw-tag">özel</small>' : ""}</b><small class="zw-tag">${esc([s.school, s.time, s.range].filter(Boolean).join(" · "))}${s.conc ? " · K" : ""}${s.ritual ? " · R" : ""}</small><span>${esc(s.d || "")}</span></button>`; };

  function stepHtml() {
    const s = W.step;
    if (s === 0) return `<h3>Hoş geldin, maceracı!</h3>
      <p>Karakter kağıdı, oyunda canlandıracağın kahramanın kimliğidir: ne kadar güçlü olduğunu, neleri iyi yaptığını ve ne kadar hasara dayanabileceğini gösterir. Zar attığında eklediğin sayıların hepsi buradan gelir.</p>
      <p>Bu sihirbaz seni adım adım birinci seviye bir D&D 5e karakterine götürecek:</p>
      <ol class="zw-list"><li><b>Irk:</b> karakterin hangi halktan</li><li><b>Sınıf:</b> ne iş yapıyor, nasıl savaşıyor</li><li><b>Yetenekler:</b> güç, çeviklik, zekâ gibi temel puanlar</li><li><b>Geçmiş:</b> maceradan önce kimdi</li><li><b>Beceriler:</b> nelerde eğitimli</li><li><b>Büyüler:</b> büyü yapan sınıflar için ilk büyüler</li><li><b>Kimlik:</b> adı ve kişiliği</li></ol>
      <p>Irk, sınıf, geçmiş ve büyülerde listede olmayan bir şey istiyorsan (başka bir kitaptan ya da masanızın uydurması, yani <i>homebrew</i>) <b>Kendi …</b> kartını seçip içini kendin doldurabilirsin.</p>
      ${learn("Her adımda seçtiklerinin oyunda neye dönüştüğünü anlatacağım. Sonunda sayıların hepsi otomatik hesaplanır; kağıt üzerinde istediğin zaman değiştirebilirsin.")}`;
    if (s === 1) { const r = race(); return `<h3>Irkını seç</h3><p>Irk, karakterine yetenek puanı bonusları, hız ve özel yetenekler (örneğin karanlıkta görme) verir.</p>
      <div class="zw-grid">${RACES.map(x => card(W.race === x.k, "race", x.k, x.n, x.d, `<small class="zw-tag">${Object.entries(x.ab).map(([k, v]) => ABN[k][2] + " +" + v).join(" · ")}${x.choose ? " · 2 yetenek +1" : ""} · ${x.speed} ft</small>`)).join("")}${hbCard(W.race === "custom", "race", "ırkın")}</div>
      ${W.race === "custom" ? `<div class="zw-custom"><div class="zb-fgrid">${cin("cr.n", "Irkın adı", "örn. Kertenkele Halkı")}${cin("cr.speed", "Hız (ft)", "30", "number", 'min="0" step="5"')}</div>
        <p class="zw-left">Yetenek bonusları (5e'de genellikle toplam +3: bir yeteneğe +2, birine +1):</p>
        <div class="zw-cab">${ABS.map(([k, nm]) => `<label><span class="lbl">${ABN[k][2]}</span><input class="f num" type="number" min="-2" max="3" data-zw-c="cr.ab.${k}" value="${W.cr.ab[k] || 0}" aria-label="${nm} bonusu"></label>`).join("")}</div>
        ${cta("cr.t", "Irk özellikleri", "örn. Karanlıkta görüş 60 ft\nDoğal zırh: ZS 13 + ÇEV")}</div>` : ""}
      ${r && r.choose ? `<div class="zw-sub"><b>+1 vereceğin iki yetenek:</b> <span class="chips">${ABS.filter(([k]) => !r.ab[k]).map(([k, nm]) => `<button type="button" class="chip" data-zw="plus" data-v="${k}" aria-pressed="${W.plus.includes(k)}">${nm}</button>`).join("")}</span></div>` : ""}
      ${r ? learn(`<b>Hız (${r.speed} ft):</b> bir turda yürüyebileceğin mesafe; haritada her kare 5 ft. <b>Irk özellikleri</b> kağıdındaki "Özellikler ve Yetenekler" kutusuna yazılacak.`) : ""}`; }
    if (s === 2) { const c = cls(); return `<h3>Sınıfını seç</h3><p>Sınıf, karakterinin mesleğidir: nasıl savaştığını, hangi zırhı giydiğini, büyü yapıp yapmadığını belirler. Yeni başlıyorsan Savaşçı ya da Rahip kolaydır.</p>
      <div class="zw-grid">${CLASSES.map(x => card(W.cls === x.k, "cls", x.k, x.n, x.d, `<small class="zw-tag">Can zarı d${x.hd} · ${ABN[x.order[0]][1]}${x.spell ? " · büyücü" : ""}</small>`)).join("")}${hbCard(W.cls === "custom", "cls", "sınıfın")}</div>
      ${W.cls === "custom" ? `<div class="zw-custom"><div class="zb-fgrid">${cin("cc.n", "Sınıfın adı", "örn. Kan Avcısı")}
          <label class="zw-field"><span class="lbl">Can zarı</span><select class="f" data-zw-c="cc.hd">${[6, 8, 10, 12].map(v => `<option value="${v}" ${+W.cc.hd === v ? "selected" : ""}>d${v}</option>`).join("")}</select></label>
          ${cin("cc.pick", "Seçilecek beceri sayısı", "2", "number", 'min="0" max="6"')}
          <label class="zw-field"><span class="lbl">Büyü yeteneği</span><select class="f" data-zw-c="cc.spell"><option value="">Büyü yapmaz</option>${ABS.map(([k, nm]) => `<option value="${k}" ${W.cc.spell === k ? "selected" : ""}>${nm}</option>`).join("")}</select></label>
          ${W.cc.spell ? `<label class="zw-field"><span class="lbl">Büyü yuvaları</span><select class="f" data-zw-c="cc.kind">${[["full", "Tam büyücü (Büyücü gibi)"], ["half", "Yarım (Paladin gibi, 2. seviyeden)"], ["third", "Üçte bir (3. seviyeden)"], ["pact", "Pakt (Cadı gibi)"], ["", "Yuva yok, ben yazarım"]].map(([k, n]) => `<option value="${k}" ${W.cc.kind === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>` : ""}</div>
        <div class="zw-sub"><b>Kurtarma zarları (iki tane):</b> <span class="chips">${ABS.map(([k, nm]) => `<button type="button" class="chip" data-zw="ccsave" data-v="${k}" aria-pressed="${W.cc.saves.includes(k)}">${nm}</button>`).join("")}</span></div>
        ${cta("cc.f", "1. seviye özellikleri", "örn. Kan Bağı: günde bir kez...")}</div>` : ""}
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
      <div class="zw-grid">${BACKGROUNDS.map(x => card(W.bg === x.n, "bg", x.n, x.n, x.d, `<small class="zw-tag">${x.s.map(k => SKN[k][1]).join(", ")}</small>`)).join("")}${hbCard(W.bg === "custom", "bg", "geçmişin")}</div>
      ${W.bg === "custom" ? `<div class="zw-custom"><div class="zb-fgrid">${cin("cb.n", "Geçmişin adı", "örn. Kervan Muhafızı")}</div>
        <div class="zw-sub"><b>Verdiği iki beceri:</b> <span class="chips">${SKILLS.map(([k, nm]) => `<button type="button" class="chip" data-zw="cbsk" data-v="${k}" aria-pressed="${W.cb.s.includes(k)}">${nm}</button>`).join("")}</span></div>
        ${cta("cb.d", "Kısa açıklama", "Maceradan önce ne yapıyordun?")}</div>` : ""}`;
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
    if (s === SPELL_STEP) {
      const c = cls(), n = spellNeed(), code = c.code;
      const pool = lvl => SPELLS.filter(x => x.lvl === lvl && (!code || x.cls.includes(code)));
      const custom = lvl => W.spells.filter(x => x.custom && (lvl ? x.lvl > 0 : !x.lvl));
      const ct = W.spells.filter(x => !x.lvl).length, l1 = W.spells.filter(x => x.lvl).length;
      return `<h3>Büyülerini seç</h3>
      <p>${esc(c.n.split(" (")[0])} büyü yapar. Büyülerin karakter kağıdındaki <b>Büyü Kitabı</b>na eklenecek; orada tek tıkla yapabilir, yuvalarını takip edebilirsin.</p>
      ${n.cant ? `<div class="zw-gh"><b>Hileler (cantrip)</b><span class="zw-left">${ct}/${n.cant} seçildi</span></div><p class="zw-left">Hileler sınırsızdır, yuva harcamaz. Her gün, her turda kullanabilirsin.</p>
        <div class="zw-grid">${[...pool(0), ...custom(0)].map(spCard).join("")}</div>` : ""}
      ${n.lv1 ? `<div class="zw-gh"><b>1. seviye büyüler</b><span class="zw-left">${l1}/${n.lv1} seçildi</span></div><p class="zw-left">${n.book ? `Büyücü bu büyüleri büyü kitabına yazar (${n.lv1} büyü); her gün içlerinden bazılarını hazırlar.` : n.prep ? `${esc(c.n.split(" (")[0])} listesindeki her büyüyü bilir ama günde ${n.lv1} tanesini hazırlayabilir (${ABN[c.spell][1]} bonusu + seviye). Şimdi hazırlayacaklarını seç; kağıtta istediğin zaman değiştirirsin.` : `Bu büyüleri bilirsin. Her biri bir <b>büyü yuvası</b> harcar; 1. seviyede ${slotsFor(c.kind, 1).filter(Boolean).join("") || 0} yuvan var.`}</p>
        <div class="zw-grid">${[...pool(1), ...custom(1)].map(spCard).join("")}</div>` : ""}
      <div class="zw-row"><button type="button" class="btn sm" data-zw="cspell">+ Kendi büyünü yaz</button><span class="zw-left">Listede olmayan bir büyü ya da homebrew büyü ekle.</span></div>
      ${learn("Büyü yuvaları günlük büyü hakkındır; uzun dinlenmede dolar. Hileler hariç her büyü bir yuva harcar. Kağıtta büyünün yanındaki seviye düğmesine basınca yuva kendiliğinden düşer ve zarlar atılır.")}`;
    }
    if (s === 7) return `<h3>Karakterine kimlik ver</h3>
      <label class="zw-field"><span class="lbl">Karakterin adı</span><input class="f" data-zw-in="name" value="${esc(W.name)}" placeholder="örn. Aren Gölgeyürek" maxlength="60"></label>
      <label class="zw-field"><span class="lbl">Oyuncu (senin adın)</span><input class="f" data-zw-in="player" value="${esc(W.player)}"></label>
      <p><b>Yönelim</b>, karakterinin ahlaki pusulasıdır. Kesin bir kural değil, rol yaparken yol gösterir.</p>
      <div class="zw-align">${ALIGN.map(([n, d]) => `<button type="button" class="zw-card sm" data-zw="align" data-v="${n}" aria-pressed="${W.align === n}"><b>${n}</b><span>${d}</span></button>`).join("")}</div>`;
    if (s === 8) {
      const p = preview(), c = cls(), r = race();
      return `<h3>${esc(W.name)} hazır!</h3><p>${esc(r.n)} ${esc(c.n)} · ${esc(W.bg)} · ${esc(W.align)}</p>
      <div class="zw-sum">
        <div><span class="lbl">Can puanı</span><b class="num">${p.hp}</b><small>d${c.hd} + DAY ${sgn(mod(p.sc.con))}${r.hpBonus ? " + cüce" : ""}. Sıfıra düşersen bayılırsın ve ölüm kurtarma zarları atarsın.</small></div>
        <div><span class="lbl">Zırh sınıfı</span><b class="num">${p.ac}</b><small>${esc(c.ac.note)}. Düşmanın seni vurmak için saldırı zarıyla bu sayıya ulaşması gerekir.</small></div>
        <div><span class="lbl">İnisiyatif</span><b class="num">${sgn(p.init)}</b><small>Savaş başlarken d20 + bu sayı; yüksek olan önce oynar.</small></div>
        <div><span class="lbl">Yeterlilik</span><b class="num">+2</b><small>Eğitimli olduğun her şeye eklenir; seviye atladıkça artar.</small></div>
      </div>
      <div class="zw-abil sm">${ABS.map(([k, nm]) => `<div class="zw-ab"><b>${ABN[k][2]}</b><span class="num">${p.sc[k]} (${sgn(mod(p.sc[k]))})</span></div>`).join("")}</div>
      ${W.spells.length ? `<p><b>Büyüler:</b> ${W.spells.map(x => esc(x.n)).join(", ")}</p>` : ""}
      ${learn("Oluştur'a bastıktan sonra kısa bir kağıt turu başlayacak; her bölümün ne işe yaradığını yerinde göstereceğim. Turu istediğin zaman <b>Kağıt rehberi</b> düğmesiyle yeniden açabilirsin.")}`;
    }
  }

  function draw() {
    let ov = $("#zwOv");
    if (!W) { if (ov) ov.remove(); return; }
    if (!ov) { ov = document.createElement("div"); ov.id = "zwOv"; ov.className = "joinov zw-ov"; document.body.appendChild(ov); }
    const s = W.step, last = STEPS.length - 1, ok = valid(s);
    ov.innerHTML = `<div class="zw" role="dialog" aria-modal="true" aria-label="Karakter yaratma sihirbazı">
      <header class="zw-h"><h2>Karakter yaratma</h2><ol class="zw-steps">${STEPS.map((n, i) => i === SPELL_STEP && !hasSpellStep() ? "" : `<li class="${i === s ? "on" : i < s ? "done" : ""}">${i ? `<span>${i > SPELL_STEP && !hasSpellStep() ? i - 1 : i}</span>` : ""}${n}</li>`).join("")}</ol><button class="btn sm" data-zw="close" aria-label="Kapat">×</button></header>
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
      case "next": if (valid(W.step)) { W.step = nextStep(W.step, 1); redraw(false); } return;
      case "prev": W.step = Math.max(0, nextStep(W.step, -1)); redraw(false); return;
      case "race": if (W.race !== v) { W.race = v; W.plus = []; W.skills = []; W.expertise = []; } break;
      case "plus": { const r = race(); if (W.plus.includes(v)) W.plus = W.plus.filter(x => x !== v); else if (W.plus.length < r.choose) W.plus.push(v); break; }
      case "cls": if (W.cls !== v) { W.cls = v; W.skills = []; W.expertise = []; W.spells = []; } break;
      case "ccsave": { const sv = W.cc.saves; if (sv.includes(v)) W.cc.saves = sv.filter(x => x !== v); else if (sv.length < 2) sv.push(v); break; }
      case "cbsk": { const sk = W.cb.s; if (sk.includes(v)) W.cb.s = sk.filter(x => x !== v); else if (sk.length < 2) sk.push(v); W.skills = W.skills.filter(k => !W.cb.s.includes(k)); break; }
      case "spell": {
        const ex = W.spells.find(x => x.k === v || x.id === v);
        if (ex) { W.spells = W.spells.filter(x => x !== ex); break; }
        const sp = window.ZMB.fromSrd(v); if (!sp) break;
        const n = spellNeed(), have = W.spells.filter(x => !!x.lvl === !!sp.lvl).length, lim = sp.lvl ? n.lv1 : n.cant;
        if (have >= lim) { toast(`En fazla ${lim} ${sp.lvl ? "1. seviye büyü" : "hile"} seçebilirsin`); return; }
        W.spells.push(sp); break;
      }
      case "cspell": window.ZMB.form({ lvl: spellNeed()?.lv1 ? 1 : 0 }, sp => { W.spells.push({ ...sp, id: uid("sp"), custom: true }); redraw(); }); return;
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
  // Kendi ırkın/sınıfın/geçmişin alanları: data-zw-c="cr.ab.str" gibi bir yol.
  function setC(el) {
    const keys = el.dataset.zwC.split("."), last = keys.pop(), o = keys.reduce((a, k) => a[k], W);
    o[last] = el.type === "number" || last === "hd" ? (el.value === "" ? 0 : +el.value) : el.value;
    if (last === "spell" && el.value && !W.cc.kind) W.cc.kind = "full";
    if (last === "pick") W.skills = [];
  }
  document.addEventListener("change", e => { const el = e.target; if (!W || !el.dataset.zwC || el.tagName !== "SELECT") return; setC(el); redraw(); });
  document.addEventListener("input", e => { const el = e.target; if (!W || !el.dataset.zwC || el.tagName === "SELECT") return; setC(el); const nx = $("[data-zw=next]"); if (nx) nx.disabled = !valid(W.step); const w = $(".zw-why"); if (w) w.textContent = valid(W.step) ? "" : why(W.step); });
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
    [() => $("#zgBar"), "Deneyim ve seviye", "DM'in verdiği deneyim puanını (XP) buraya yaz; çubuk sonraki seviyeye ne kadar kaldığını gösterir. Seviye atlayınca \"Seviye atla\" sihirbazı canını, yeteneklerini, özelliklerini ve büyülerini adım adım günceller."],
    [() => panel("Büyücülük"), "Büyücülük", "Büyü yapıyorsan büyü yeteneğin burada seçilir; kurtarma ZK'si ve büyü saldırısı bonusu buradan hesaplanır. Yuvalar günlük büyü hakkındır, uzun dinlenmede dolar."],
    [() => $("#zbBook"), "Büyü kitabı", "Bildiğin büyüler. Hileler için \"Yap\"a, seviyeli büyüler için hangi yuvayla yapacaksan o seviyenin düğmesine bas: yuva kendiliğinden düşer, saldırı ve hasar zarları atılır. Büyünün adına tıklarsan açıklaması açılır. \"+ Büyü ekle\" ile listeden seçer ya da kendi büyünü yazarsın."],
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
