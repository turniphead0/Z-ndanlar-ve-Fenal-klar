/* Masaüstü eklentileri (6): Pathfinder 2. edisyon sistemi.
   Karakter kağıdı (nitelik bonusları, yeterlilik rütbeleri, değerli durumlar, ölmek üzere/yaralı),
   dört başarı derecesi ve çoklu saldırı cezasıyla zar atma, büyü kitabı, canavar kartı ve zar tepsisi. */
(function () {
  "use strict";

  const P = window.ZMPF;
  const AN = Object.fromEntries(P.ATTR.map(a => [a[0], a]));
  const RL = r => P.RANKS[+r || 0][0];
  const DEG = ["Kritik başarısızlık", "Başarısızlık", "Başarı", "Kritik başarı"];
  const cur = () => S.chars[S.charId];
  const lvl = c => Math.max(1, Math.min(20, +c.level || 1));

  /* ---------------- Model ---------------- */
  function newChar() {
    return { id: uid("c"), name: "Yeni Kahraman", ancestry: "", heritage: "", bg: "", cls: "", level: 1, player: "", deity: "", size: "Orta", speed: 25, xp: 0,
      ab: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, keyAttr: "str", perc: 1, saves: { fort: 1, ref: 1, will: 1 }, classRank: 1, skills: {}, lores: [],
      armor: { name: "Zırhsız", item: 0, cap: "", rank: 1, shield: 2, raised: false }, hp: 10, hpMax: 10, hpTemp: 0, dying: 0, wounded: 0, doomed: 0, hero: 1, focus: { cur: 0, max: 0 },
      conds: {}, strikes: [{ name: "Yumruk", attr: "str", rank: 1, item: 0, dmg: "1d4", dmgAttr: true, type: "ezici", agile: true }],
      sp: { trad: "", attr: "", rank: 0, slots: Array.from({ length: 10 }, () => ({ max: 0, used: 0 })) }, book: [],
      feats: "", features: "", inventory: "", coins: { cp: 0, sp: 0, gp: 15, pp: 0 }, notes: "" };
  }
  // Durum cezaları birbirine eklenmez, en büyüğü geçerlidir. what: ac, save, perc; key: ref gibi.
  function pen(c, attr, what, key) {
    const k = c.conds || {}, n = x => +k[x] || 0;
    const a = attr === "dex" ? n("clumsy") : attr === "str" ? n("enfeebled") : attr === "con" ? n("drained") : ["int", "wis", "cha"].includes(attr) ? n("stupefied") : 0;
    const st = [n("frightened"), n("sickened"), a];
    if (k.fatigued && (what === "ac" || what === "save")) st.push(1);
    if (k.unconscious && (what === "ac" || what === "perc" || key === "ref")) st.push(4);
    if (k.blinded && what === "perc") st.push(4);
    return Math.max(...st);
  }
  const offGuard = c => { const k = c.conds || {}; return k.offguard || k.prone || k.grabbed || k.restrained || k.paralyzed || k.unconscious; };
  function derive(c) {
    const L = lvl(c), m = k => +c.ab?.[k] || 0, pr = r => P.prof(+r || 0, L), ar = c.armor || {};
    const offg = offGuard(c) ? 2 : 0;
    const dexAc = ar.cap === "" || ar.cap == null ? m("dex") : Math.min(m("dex"), +ar.cap);
    const d = {
      L, perc: m("wis") + pr(c.perc) - pen(c, "wis", "perc"),
      ac: 10 + dexAc + pr(ar.rank) + (+ar.item || 0) + (ar.raised ? +ar.shield || 0 : 0) - pen(c, "dex", "ac") - offg,
      classDC: 10 + m(c.keyAttr || "str") + pr(c.classRank) - pen(c, c.keyAttr || "str"),
      save: {}, skill: {}, lore: [], strike: [], sAtk: null, sDC: null,
    };
    P.SAVES.forEach(([k, , a]) => d.save[k] = m(a) + pr(c.saves?.[k]) - pen(c, a, "save", k));
    P.SKILLS.forEach(([k, , a]) => d.skill[k] = m(a) + pr(c.skills?.[k]) - pen(c, a));
    (c.lores || []).forEach((l, i) => d.lore[i] = m("int") + pr(l.rank) - pen(c, "int"));
    (c.strikes || []).forEach((s, i) => d.strike[i] = m(s.attr || "str") + pr(s.rank) + (+s.item || 0) - pen(c, s.attr || "str") - (c.conds?.prone ? 2 : 0));
    if (c.sp?.attr) { const v = m(c.sp.attr) + pr(c.sp.rank) - pen(c, c.sp.attr); d.sAtk = v; d.sDC = 10 + v; }
    return d;
  }
  const strikeDmg = (c, s) => { const b = s.dmgAttr ? +c.ab?.str || 0 : 0; return `${s.dmg || "1d4"}${b ? sgn(b) : ""}`; };
  const mapPen = (n, agile) => n === 0 ? 0 : agile ? -4 * n : -5 * n;

  /* ---------------- Zar ---------------- */
  function degree(total, dc, nat) {
    let g = total >= dc + 10 ? 3 : total >= dc ? 2 : total <= dc - 10 ? 0 : 1;
    if (nat === 20) g++; else if (nat === 1) g--;
    return Math.max(0, Math.min(3, g));
  }
  // d20 + bonus; tepsideki hedef ZK doluysa başarı derecesi hesaplanır.
  function check(bonus, label, dcOverride) {
    const expr = d20expr(bonus); let r; try { r = parseRoll(expr); } catch (e) { return null; }
    const nat = r.crit === "20" ? 20 : r.crit === "1" ? 1 : null;
    const dc = dcOverride ?? (S.pf2dc === "" || S.pf2dc == null ? null : +S.pf2dc);
    const g = dc == null ? null : degree(r.total, dc, nat);
    pushRoll({ id: uid("l"), t: Date.now(), label, expr, total: r.total, detail: r.detail + (g == null ? "" : ` · ZK ${dc}: ${DEG[g]}`), crit: g == null ? r.crit : g === 3 ? "20" : g === 0 ? "1" : null });
    S.pf2last = { bonus, label, dc: dcOverride };
    return { total: r.total, g, nat };
  }
  function dmg(expr, label, double) {
    let r; try { r = parseRoll(expr); } catch (e) { toast("Hasar zarı anlaşılmadı: " + expr); return; }
    pushRoll({ id: uid("l"), t: Date.now(), label: label + (double ? " (KRİTİK ×2)" : ""), expr: expr + (double ? " ×2" : ""), total: double ? r.total * 2 : r.total, detail: r.detail + (double ? ` = ${r.total} ×2` : ""), crit: null });
  }
  function info(label, total, detail) { pushRoll({ id: uid("l"), t: Date.now(), label, expr: "", total, detail, crit: null }); }

  /* ---------------- Kağıt ---------------- */
  const I = (c, k, ph = "", cls = "f", type = "text") => `<input class="${cls}" type="${type}" data-k="${k}" value="${esc(getPath(c, k) ?? "")}" placeholder="${esc(ph)}">`;
  const RK = (c, k, label) => { const v = +getPath(c, k) || 0; return `<button type="button" class="pf-rk r${v}" data-act="pf-rank" data-k="${k}" title="${esc(label || "")} yeterliliği: ${P.RANKS[v][1]} (tıkla: artır, Shift: azalt)" aria-label="${esc(label || "")} yeterliliği ${P.RANKS[v][1]}">${RL(v)}</button>`; };
  const D = (k, v) => `<span data-d="pf.${k}">${v}</span>`;

  // Etkin durumlar ve ne yaptıkları.
  function activeConds(c) {
    const k = c.conds || {}, on = [...P.VCONDS.filter(([x]) => +k[x]).map(([x, n]) => [x, `${n} ${k[x]}`]), ...P.TCONDS.filter(([x]) => k[x]).map(([x, n]) => [x, n])];
    return on.length ? `<ul class="zc-eff">${on.map(([x, n]) => `<li><b>${esc(n)}:</b> ${esc((P.COND_HELP[x] || "").replace(/−X/g, "−" + (+k[x] || "X")))}</li>`).join("")}</ul>` : "";
  }
  function sheet(c) {
    const d = derive(c), L = d.L, sp = c.sp || {};
    const hpPct = Math.max(0, Math.min(100, (+c.hp || 0) / Math.max(1, +c.hpMax || 1) * 100));
    const pips = (n, max, act) => Array.from({ length: max }, (_, j) => `<button type="button" class="pip ${j < n ? "" : "used"}" data-act="${act}" data-j="${j}" aria-label="${j + 1}"></button>`).join("");
    return `<div class="sheet pf2">
  <div class="panel"><input class="cname" data-k="name" value="${esc(c.name)}" aria-label="Karakter adı">
    <div class="idrow pf-id"><label><span class="lbl">Soy</span>${I(c, "ancestry", "İnsan")}</label><label><span class="lbl">Miras</span>${I(c, "heritage", "Çok yönlü")}</label><label><span class="lbl">Geçmiş</span>${I(c, "bg", "Bilgin")}</label>
      <label><span class="lbl">Sınıf</span>${I(c, "cls", "Savaşçı")}</label><label><span class="lbl">Seviye</span>${I(c, "level", "1", "f num", "number")}</label><label><span class="lbl">Tanrı</span>${I(c, "deity", "")}</label><label><span class="lbl">Oyuncu</span>${I(c, "player", "")}</label></div></div>
  <div class="vitals">
    <div class="vit"><span class="lbl">Zırh Sınıfı</span><span class="big num">${D("ac", d.ac)}</span></div>
    <div class="vit"><span class="lbl">Algı · inisiyatif</span><button class="big" data-act="pf-perc">${D("perc", sgn(d.perc))}</button><span class="pf-rkrow">${RK(c, "perc", "Algı")}</span></div>
    <div class="vit"><span class="lbl">Sınıf ZK</span><span class="big num">${D("classDC", d.classDC)}</span><span class="pf-rkrow"><select class="f pf-mini" data-k="keyAttr" aria-label="Anahtar nitelik">${P.ATTR.map(([k, , ab]) => `<option value="${k}" ${c.keyAttr === k ? "selected" : ""}>${ab}</option>`).join("")}</select>${RK(c, "classRank", "Sınıf ZK")}</span></div>
    <div class="vit"><span class="lbl">Hız</span><span class="vrow"><input class="big" type="number" data-k="speed" value="${esc(c.speed)}" aria-label="Hız" style="width:70px"><small>ft</small></span></div>
    <div class="vit"><span class="lbl">Kahraman puanı</span><div class="pips pf-hero">${pips(+c.hero || 0, 3, "pf-hero")}</div><button class="btn sm" data-act="pf-reroll" title="1 kahraman puanı harcayıp son kontrolü yeniden at">Yeniden at</button></div>
    <div class="vit"><span class="lbl">Odak puanı</span><div class="pips">${pips(+c.focus?.cur || 0, Math.min(3, +c.focus?.max || 0), "pf-focus")}</div><span class="vrow"><small>azami</small><input class="f num" type="number" min="0" max="3" data-k="focus.max" value="${esc(c.focus?.max ?? 0)}" style="width:48px" aria-label="Azami odak"></span></div>
  </div>
  <div class="cols">
    <div class="abil">${P.ATTR.map(([k, n]) => `<div class="ab"><button class="modb" data-act="pf-ab" data-ab="${k}" title="${n} kontrolü">${D("ab." + k, sgn(+c.ab?.[k] || 0))}</button><div class="meta"><div class="nm">${n}<input class="f score" type="number" min="-5" max="10" data-k="ab.${k}" value="${esc(c.ab?.[k] ?? 0)}" aria-label="${n} bonusu"></div></div></div>`).join("")}
      <div class="panel pf-saves"><h3>Kurtarmalar</h3>${P.SAVES.map(([k, n]) => `<div class="rl">${RK(c, "saves." + k, n)}<span>${n}</span><button class="rollb" data-act="pf-save" data-s="${k}">${D("save." + k, sgn(d.save[k]))}</button></div>`).join("")}</div></div>
    <div class="panel"><h3>Beceriler <button class="btn sm" data-act="pf-addlore">+ Bilgi</button></h3><div class="rowlist">${P.SKILLS.map(([k, n, a]) => `<div class="rl">${RK(c, "skills." + k, n)}<span>${n}</span><span class="abk">${AN[a][2]}</span><button class="rollb" data-act="pf-skill" data-s="${k}">${D("skill." + k, sgn(d.skill[k]))}</button></div>`).join("")}
      ${(c.lores || []).map((l, i) => `<div class="rl">${RK(c, `lores.${i}.rank`, l.name)}<input class="f pf-lore" data-k="lores.${i}.name" value="${esc(l.name)}" aria-label="Bilgi adı"><span class="abk">ZEK <button class="pf-x" data-act="pf-dellore" data-i="${i}" aria-label="Sil">×</button></span><button class="rollb" data-act="pf-lore" data-i="${i}">${D("lore." + i, sgn(d.lore[i]))}</button></div>`).join("")}</div>
      <p class="hint">Harf yeterlilik rütbesidir (kitaptaki gibi): U eğitimsiz, T eğitimli, E uzman, M usta, L efsanevi. Eğitimliysen seviye + 2 eklenir; her üst rütbe +2 daha. Değiştirmek için harfe tıkla.</p></div>
    <div class="c3" style="display:grid;gap:14px;min-width:0">
      <div class="panel"><h3>Can Puanı</h3>
        <div class="hpgrid"><label><span class="lbl">Mevcut</span><input class="f" type="number" data-k="hp" value="${esc(c.hp)}"></label><label><span class="lbl">Azami</span><input class="f" type="number" data-k="hpMax" value="${esc(c.hpMax)}"></label><label><span class="lbl">Geçici</span><input class="f" type="number" data-k="hpTemp" value="${esc(c.hpTemp)}"></label></div>
        <div class="hpbar"><i class="${hpPct <= 25 ? "low" : hpPct <= 50 ? "mid" : ""}" style="width:${hpPct}%"></i></div>
        <div class="hpact"><input class="f num" type="number" id="hpAmt" min="0" placeholder="Miktar" aria-label="Hasar veya iyileştirme"><button class="btn danger" data-act="pf-hurt">Hasar</button><button class="btn" data-act="pf-heal">İyileştir</button><button class="btn" data-act="pf-rest" title="8 saat dinlenme: DAY × seviye can, yuvalar ve odak dolar">Dinlen</button></div>
        <div class="pf-dying">${[["dying", "Ölmek üzere", 4], ["wounded", "Yaralı", 3], ["doomed", "Lanetli", 3]].map(([k, n, mx]) => `<span class="pf-cv"><span class="lbl">${n}</span><button class="btn sm" data-act="pf-cv" data-c="${k}" data-d="-1" aria-label="${n} azalt">−</button><b class="num">${+c[k] || 0}</b><button class="btn sm" data-act="pf-cv" data-c="${k}" data-d="1" aria-label="${n} artır">+</button></span>`).join("")}
          ${+c.dying ? `<button class="btn sm pri" data-act="pf-recover">İyileşme kontrolü (ZK ${10 + (+c.dying || 0)})</button>` : ""}</div>
        ${+c.dying ? `<p class="hint">Ölmek üzere ${4 - (+c.doomed || 0)} olursan ölürsün. Her turunun başında iyileşme kontrolü at.</p>` : ""}</div>
      <div class="panel"><h3>Durumlar</h3>
        <div class="pf-vc">${P.VCONDS.map(([k, n]) => `<span class="pf-cv ${+c.conds?.[k] ? "on" : ""}" title="${esc(P.COND_HELP[k] || "")}"><span>${n}</span><button class="btn sm" data-act="pf-cond" data-c="${k}" data-d="-1" aria-label="${n} azalt">−</button><b class="num">${+c.conds?.[k] || 0}</b><button class="btn sm" data-act="pf-cond" data-c="${k}" data-d="1" aria-label="${n} artır">+</button></span>`).join("")}</div>
        <div class="cond">${P.TCONDS.map(([k, n]) => `<button class="chip" data-act="pf-tcond" data-c="${k}" aria-pressed="${!!c.conds?.[k]}" title="${esc(P.COND_HELP[k] || "")}">${n}</button>`).join("")}</div>
        ${activeConds(c)}<p class="hint">Durum cezaları kağıttaki tüm sayılara ve zarlara kendiliğinden yansır. Aynı türden cezalar toplanmaz, en büyüğü geçerlidir.</p></div>
    </div>
  </div>
  <div class="panel"><h3>Zırh ve kalkan</h3><div class="pf-armor">
    <label><span class="lbl">Zırh</span>${I(c, "armor.name", "Deri zırh")}</label><label><span class="lbl">Eşya bonusu</span>${I(c, "armor.item", "1", "f num", "number")}</label><label><span class="lbl">ÇEV sınırı</span>${I(c, "armor.cap", "yok", "f num", "number")}</label>
    <label><span class="lbl">Zırh yeterliliği</span>${RK(c, "armor.rank", "Zırh")}</label><label><span class="lbl">Kalkan bonusu</span>${I(c, "armor.shield", "2", "f num", "number")}</label>
    <label class="toggle" style="align-self:end"><input type="checkbox" data-k="armor.raised" ${c.armor?.raised ? "checked" : ""}> Kalkan kaldırıldı</label></div></div>
  <div class="panel"><h3>Saldırılar <button class="btn sm" data-act="pf-addstrike">+ Ekle</button></h3>
    <div class="pf-st pf-sth"><span class="lbl">Silah</span><span class="lbl">Nitelik</span><span class="lbl">Rütbe</span><span class="lbl">Eşya</span><span class="lbl">Hasar</span><span class="lbl">Çevik</span><span class="lbl">1. · 2. · 3. saldırı</span><span class="lbl">Hasar</span></div>
    ${(c.strikes || []).map((s, i) => { const a = d.strike[i]; return `<div class="pf-st"><input class="f" data-k="strikes.${i}.name" value="${esc(s.name)}" aria-label="Silah adı">
      <select class="f" data-k="strikes.${i}.attr" aria-label="Saldırı niteliği"><option value="str" ${s.attr === "str" ? "selected" : ""}>GÜÇ</option><option value="dex" ${s.attr === "dex" ? "selected" : ""}>ÇEV</option></select>${RK(c, `strikes.${i}.rank`, s.name)}
      <input class="f num" type="number" data-k="strikes.${i}.item" value="${esc(s.item ?? 0)}" aria-label="Eşya bonusu">
      <span class="pf-dm"><input class="f" data-k="strikes.${i}.dmg" value="${esc(s.dmg)}" placeholder="1d8" aria-label="Hasar zarı"><label class="toggle" title="Hasara Güç ekle"><input type="checkbox" data-k="strikes.${i}.dmgAttr" ${s.dmgAttr ? "checked" : ""}>+GÜÇ</label><input class="f" data-k="strikes.${i}.type" value="${esc(s.type || "")}" placeholder="kesici" aria-label="Hasar türü"></span>
      <input type="checkbox" data-k="strikes.${i}.agile" ${s.agile ? "checked" : ""} aria-label="Çevik">
      <span class="pf-map">${[0, 1, 2].map(n => `<button class="btn sm" data-act="pf-strike" data-i="${i}" data-n="${n}" title="${n + 1}. saldırı">${D(`strike.${i}.${n}`, sgn(a + mapPen(n, s.agile)))}</button>`).join("")}</span>
      <span style="display:flex;gap:4px"><button class="btn sm" data-act="pf-sdmg" data-i="${i}">Hasar</button><button class="btn sm" data-act="pf-sdmg" data-i="${i}" data-crit="1" title="Kritik: toplam hasar iki kat">×2</button><button class="btn sm danger" data-act="pf-delstrike" data-i="${i}" aria-label="Sil">×</button></span></div>`; }).join("")}
    <p class="hint">Turda ikinci saldırı −5, üçüncü −10 (çevik silahta −4/−8). Tepsiye hedefin ZS'sini yazarsan sonuç başarı derecesini gösterir; kritik başarıda hasar iki kat.</p></div>
  ${spellPanel(c, d)}
  <div class="two">
    <div class="panel"><h3>Yetenekler (feat) ve sınıf özellikleri</h3><textarea class="f" data-k="feats">${esc(c.feats)}</textarea></div>
    <div class="panel"><h3>Envanter</h3><textarea class="f" data-k="inventory">${esc(c.inventory)}</textarea>
      <div class="coins" style="grid-template-columns:repeat(4,1fr)">${[["cp", "Bakır"], ["sp", "Gümüş"], ["gp", "Altın"], ["pp", "Platin"]].map(([k, n]) => `<label><span class="lbl">${n}</span><input class="f" type="number" data-k="coins.${k}" value="${esc(c.coins?.[k] ?? 0)}"></label>`).join("")}</div></div>
    <div class="panel"><h3>Notlar</h3><textarea class="f" data-k="notes">${esc(c.notes)}</textarea></div>
  </div></div>`;
  }

  /* ---------------- Büyüler ---------------- */
  const open = new Set();
  const rankName = r => r ? `${r}. rütbe` : "Hile";
  function spellDice(s, castRank) {
    if (!s.dice) return "";
    const base = Math.max(1, s.rank || 1), n = s.up ? Math.floor(Math.max(0, castRank - base) / (+s.every || 1)) : 0;
    return n ? `${s.dice}+${String(s.up).replace(/(\d*)d(\d+)|(\d+)/g, (m, a, b, f) => b ? `${(+a || 1) * n}d${b}` : String(+f * n))}` : s.dice;
  }
  const SAVEN = { fort: "Dayanıklılık", ref: "Refleks", will: "İrade", ac: "ZS" };
  function fx(s, c, d, rk) {
    const dice = spellDice(s, rk), t = dice ? `${dice}${s.type ? " " + s.type : ""}` : "";
    if (s.def === "ac") return `Saldırı ${d.sAtk == null ? "?" : sgn(d.sAtk)}${t ? " · " + t : ""}`;
    if (s.def) return `${s.basic ? "temel " : ""}${SAVEN[s.def]} ZK ${d.sDC ?? "?"}${t ? " · " + t : ""}`;
    if (s.kind === "heal") return `${dice} can`;
    return t;
  }
  function spellPanel(c, d) {
    const sp = c.sp || {}, L = lvl(c), cr = P.cantripRank(L), book = c.book || [];
    const groups = {}; book.forEach(s => (groups[s.focus ? "f" : s.rank] = groups[s.focus ? "f" : s.rank] || []).push(s));
    const order = Object.keys(groups).sort((a, b) => (a === "f" ? -0.5 : +a) - (b === "f" ? -0.5 : +b));
    const chips = s => {
      if (s.focus) return `<button class="btn sm pri" data-act="pf-cast" data-id="${s.id}" data-r="${cr}" ${(+c.focus?.cur || 0) > 0 ? "" : "disabled"}>Odakla yap (${cr}. r)</button>`;
      if (!s.rank) return `<button class="btn sm pri" data-act="pf-cast" data-id="${s.id}" data-r="${cr}">Yap (${cr}. r)</button>`;
      const lv = (sp.slots || []).map((x, i) => [i + 1, +x.max || 0, (+x.max || 0) - (+x.used || 0)]).filter(([r, mx]) => r >= s.rank && mx > 0);
      return lv.length ? lv.map(([r, , left]) => `<button class="chip zb-lv" data-act="pf-cast" data-id="${s.id}" data-r="${r}" ${left > 0 ? "" : "disabled"} title="${r}. rütbe yuvayla yap (${left} kaldı)">${r}. r <small>${left}</small></button>`).join("") : `<span class="zb-none">${s.rank}. rütbe ya da üstü yuva yok</span>`;
    };
    return `<div class="panel zb" id="pfSpells"><h3>Büyüler <span class="sp"></span><button type="button" class="btn sm" data-act="pf-spellguide">Nasıl kullanılır?</button><button type="button" class="btn sm pri" data-act="pf-addspell">+ Büyü ekle</button></h3>
    <div class="spellstat"><label class="toggle">Gelenek <select class="f" style="width:auto" data-k="sp.trad"><option value="">—</option>${Object.entries(P.TRAD).map(([k, n]) => `<option value="${k}" ${sp.trad === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <label class="toggle">Nitelik <select class="f" style="width:auto" data-k="sp.attr"><option value="">—</option>${P.ATTR.map(([k, n]) => `<option value="${k}" ${sp.attr === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <span class="toggle">Yeterlilik ${RK(c, "sp.rank", "Büyü")}</span><span>Büyü ZK <b data-d="pf.sDC">${d.sDC ?? "—"}</b></span><span>Büyü saldırısı <button class="rollb" style="padding:0 8px" data-act="pf-satk">${D("sAtk", d.sAtk == null ? "—" : sgn(d.sAtk))}</button></span><span class="hint" style="margin:0">Hileler ${cr}. rütbeye yükselir</span></div>
    <div class="slots">${(sp.slots || []).map((s, i) => `<div class="slot"><div class="top"><span class="lbl">${i + 1}. r</span><input class="f" type="number" min="0" max="9" data-k="sp.slots.${i}.max" value="${esc(s.max)}" aria-label="${i + 1}. rütbe yuva sayısı"></div><div class="pips">${Array.from({ length: +s.max || 0 }, (_, j) => `<button class="pip ${j < (+s.used || 0) ? "used" : ""}" data-act="pf-slot" data-i="${i}" data-j="${j}" aria-label="Yuva ${j + 1}"></button>`).join("")}</div></div>`).join("")}</div>
    ${book.length ? order.map(g => `<div class="zb-g"><div class="zb-gh"><b>${g === "f" ? "Odak büyüleri" : rankName(+g)}</b></div>
      ${groups[g].map(s => `<div class="zb-sp"><span></span><button type="button" class="zb-nm" data-act="pf-spinfo" data-id="${s.id}"><b>${esc(s.n)}</b>${s.en && s.en !== s.n ? `<small>${esc(s.en)}</small>` : ""}</button>
        <span class="zb-fx">${esc(fx(s, c, d, s.rank ? s.rank : cr)) || `<span class="zb-none">${esc(s.actions || "")} eylem</span>`}</span><span class="zb-cast">${chips(s)}</span>
        ${open.has(s.id) ? `<div class="zb-det"><div class="zb-tags">${esc([rankName(s.rank), s.actions ? s.actions + " eylem" : "", s.range, (s.trad || "").split("").map(x => ({ A: "Arkana", D: "İlahi", O: "Okült", P: "İlkel" })[x]).filter(Boolean).join(", ")].filter(Boolean).join(" · "))}${s.custom ? ' <b class="zb-k hb">Özel</b>' : ""}</div><p>${esc(s.d || "")}</p>${s.up ? `<p class="zb-none">Yükseltme: her ${+s.every > 1 ? s.every + " " : ""}rütbede +${esc(s.up)}</p>` : ""}
          <div class="zb-ed"><label class="toggle"><input type="checkbox" data-act="pf-spfocus" data-id="${s.id}" ${s.focus ? "checked" : ""}> Odak büyüsü</label><button class="btn sm" data-act="pf-spedit" data-id="${s.id}">Düzenle</button><button class="btn sm danger" data-act="pf-spdel" data-id="${s.id}">Çıkar</button></div></div>` : ""}</div>`).join("")}</div>`).join("")
      : `<p class="zb-none">Büyü yok. Büyü yapan bir sınıfsan <b>+ Büyü ekle</b> ile listeden seç ya da kendi büyünü yaz.</p>`}</div>`;
  }
  function cast(c, s, rk) {
    const d = derive(c), nm = c.name || "İsimsiz", paths = [];
    if (s.focus) { if ((+c.focus?.cur || 0) < 1) { toast("Odak puanın yok"); return; } c.focus.cur--; paths.push("focus"); }
    else if (s.rank) { const sl = c.sp?.slots?.[rk - 1]; if (!sl || (+sl.used || 0) >= (+sl.max || 0)) { toast(`${rk}. rütbe yuvan kalmadı`); return; } sl.used = (+sl.used || 0) + 1; paths.push("sp"); }
    const label = `${nm} · ${s.n} (${rk}. r)`, dice = spellDice(s, rk);
    if (s.def === "ac") {
      if (d.sAtk == null) toast("Büyü niteliğini seçmediğin için saldırı bonusu yok");
      const r = check(d.sAtk || 0, label + " · büyü saldırısı");
      if (dice && r && r.g !== 0 && r.g !== 1) dmg(dice, `${label} · hasar${s.type ? " (" + s.type + ")" : ""}`, r.g === 3);
      else if (dice && r && r.g == null) dmg(dice, `${label} · hasar${s.type ? " (" + s.type + ")" : ""} (isabet ederse; kritikte ×2)`, false);
    } else if (s.def) {
      const sv = `${s.basic ? "temel " : ""}${SAVEN[s.def]} kurtarması ZK ${d.sDC ?? "?"}`;
      if (dice) dmg(dice, `${label} · ${sv}${s.basic ? " (başarı yarı, kritik başarısızlık ×2)" : ""}`);
      else info(`${label} · ${sv}`, d.sDC ?? "?", "Hedef d20 atar; sonuç derecesine göre etki");
    } else if (s.kind === "heal") dmg(dice || "0", `${label} · iyileştirme`);
    else if (dice) dmg(dice, `${label}${s.type ? " · " + s.type : ""}`);
    else info(label, "✓", s.d || "Büyü yapıldı");
    if (paths.length) save("chars", c, paths);
    toast(`${s.n} yapıldı`); render();
  }

  // Büyü seçici ve kendi büyün: 5e'nin seçici/formunu PF2 alanlarıyla kullanır.
  function picker(c, o = {}) {
    const id = c.id, code = P.TCODE[c.sp?.trad] || "";
    let F = { q: "", rank: "", code };
    const ov = document.createElement("div"); ov.id = "pfPickOv"; ov.className = "joinov zw-ov zb-ov"; document.body.appendChild(ov);
    const has = k => (S.chars[id]?.book || []).some(x => x.k === k);
    const draw = () => {
      const q = F.q.trim().toLocaleLowerCase("tr");
      const list = P.SPELLS.filter(s => (F.rank === "" || s.rank === +F.rank) && (!F.code || s.trad.includes(F.code)) && (o.maxRank == null || s.rank <= o.maxRank) && (!q || (s.n + " " + s.en).toLocaleLowerCase("tr").includes(q)));
      const y = $(".zb-list", ov)?.scrollTop || 0, fq = document.activeElement?.dataset?.pfq != null, pos = fq ? document.activeElement.selectionStart : 0;
      ov.innerHTML = `<div class="zw zb-pick" role="dialog" aria-modal="true" aria-label="Büyü ekle"><header class="zw-h"><h2>${esc(o.title || "Büyü ekle")}</h2><span style="flex:1"></span><button class="btn sm" data-pfp="close" aria-label="Kapat">×</button></header>
        <div class="zb-filt"><input class="f" data-pfq="1" placeholder="Ara: ateş, heal…" value="${esc(F.q)}" aria-label="Büyü ara"><select class="f" data-pfcode="1" aria-label="Gelenek"><option value="">Tüm gelenekler</option>${Object.entries(P.TCODE).map(([t, k]) => `<option value="${k}" ${F.code === k ? "selected" : ""}>${P.TRAD[t]}</option>`).join("")}</select>
          <span class="chips"><button class="chip" data-pfp="rank" data-v="" aria-pressed="${F.rank === ""}">Hepsi</button>${[...new Set(P.SPELLS.map(s => s.rank))].filter(r => o.maxRank == null || r <= o.maxRank).map(r => `<button class="chip" data-pfp="rank" data-v="${r}" aria-pressed="${F.rank === String(r)}">${r ? r + ". r" : "Hile"}</button>`).join("")}</span></div>
        <div class="zw-b zb-list">${list.map(s => `<div class="zb-row"><div><b>${esc(s.n)}</b> <small>${esc(s.en)}</small><div class="zb-tags">${esc([rankName(s.rank), s.actions + " eylem", s.range].join(" · "))}</div><p>${esc(s.d)}</p></div><button class="btn sm ${has(s.k) ? "" : "pri"}" data-pfp="pick" data-k="${s.k}">${has(s.k) ? "Eklendi ✓" : "Ekle"}</button></div>`).join("") || `<p class="zb-none">Bu filtrede büyü yok.</p>`}</div>
        <footer class="zw-f"><span class="zw-why" style="text-align:left">Listede Player Core'dan (ORC lisanslı) seçilmiş büyüler var. Diğerlerini <b>Kendi büyünü yaz</b> ile ekle.</span><button class="btn" data-pfp="custom">Kendi büyünü yaz</button><button class="btn pri" data-pfp="close">Tamam</button></footer></div>`;
      $(".zb-list", ov).scrollTop = y; if (fq) { const i = $("[data-pfq]", ov); i.focus(); i.setSelectionRange(pos, pos); }
    };
    ov.addEventListener("click", e => {
      const b = e.target.closest("[data-pfp]"); if (!b) return; const a = b.dataset.pfp;
      if (a === "close") { ov.remove(); render(); }
      else if (a === "rank") { F.rank = b.dataset.v; draw(); }
      else if (a === "pick") { const ch = S.chars[id]; const ex = (ch.book || []).find(x => x.k === b.dataset.k); if (ex) ch.book = ch.book.filter(x => x !== ex); else addToBook(ch, fromSrd(b.dataset.k)); save("chars", ch, ["book"]); draw(); }
      else if (a === "custom") form(null, sp => { const ch = S.chars[id]; addToBook(ch, sp); save("chars", ch, ["book"]); draw(); });
    });
    ov.addEventListener("input", e => { if (e.target.dataset.pfq) { F.q = e.target.value; draw(); } });
    ov.addEventListener("change", e => { if (e.target.dataset.pfcode) { F.code = e.target.value; draw(); } });
    draw();
  }
  const fromSrd = k => { const s = P.SPELLS.find(x => x.k === k); return s ? { ...s, id: uid("sp") } : null; };
  function addToBook(c, sp) { c.book = c.book || []; if (sp.k && c.book.some(x => x.k === sp.k)) return; c.book.push(sp); c.book.sort((a, b) => a.rank - b.rank || a.n.localeCompare(b.n, "tr")); }

  // Kendi büyün formu (PF2 alanları).
  function form(sp, onSave, edit) {
    const s = { n: "", en: "", rank: 1, actions: "2", range: "30 ft", def: "", basic: false, kind: "util", dice: "", type: "", up: "", every: 1, d: "", trad: "", focus: false, ...(sp || {}) };
    const ov = document.createElement("div"); ov.id = "pfFormOv"; ov.className = "joinov zw-ov zb-ov2"; document.body.appendChild(ov);
    const inp = (k, l, ph = "", type = "text") => `<label class="zw-field"><span class="lbl">${l}</span><input class="f" type="${type}" data-pff="${k}" value="${esc(s[k] ?? "")}" placeholder="${esc(ph)}"></label>`;
    const draw = () => {
      ov.innerHTML = `<div class="zw zb-form" role="dialog" aria-modal="true" aria-label="Büyü yaz"><header class="zw-h"><h2>${edit ? "Büyüyü düzenle" : "Kendi büyünü yaz"}</h2><span style="flex:1"></span><button class="btn sm" data-pffa="close" aria-label="Kapat">×</button></header>
      <div class="zw-b"><p>Kitaptan ya da masanızdan (homebrew) bir büyü ekle. Doldurduğun alanlara göre düğme doğru zarı atar.</p>
        <div class="zb-fgrid">${inp("n", "Büyünün adı", "örn. Gölge Oku")}${inp("en", "Orijinal adı (isteğe bağlı)", "Shadow Bolt")}
          <label class="zw-field"><span class="lbl">Rütbe</span><select class="f" data-pff="rank">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(r => `<option value="${r}" ${+s.rank === r ? "selected" : ""}>${rankName(r)}</option>`).join("")}</select></label>
          ${inp("actions", "Eylem", "2")}${inp("range", "Menzil / alan", "30 ft")}</div>
        <label class="toggle" style="margin:0 0 10px"><input type="checkbox" data-pff="focus" ${s.focus ? "checked" : ""}> Odak büyüsü (yuva yerine odak puanı harcar)</label>
        <div class="zb-fgrid"><label class="zw-field"><span class="lbl">Hedefin savunması</span><select class="f" data-pff="def"><option value="">Yok</option><option value="ac" ${s.def === "ac" ? "selected" : ""}>Büyü saldırısı (ZS)</option><option value="fort" ${s.def === "fort" ? "selected" : ""}>Dayanıklılık kurtarması</option><option value="ref" ${s.def === "ref" ? "selected" : ""}>Refleks kurtarması</option><option value="will" ${s.def === "will" ? "selected" : ""}>İrade kurtarması</option></select></label>
          <label class="zw-field"><span class="lbl">Etki</span><select class="f" data-pff="kind">${[["util", "Zarsız"], ["heal", "İyileştirme"], ["roll", "Hasar / zar"]].map(([k, n]) => `<option value="${k}" ${s.kind === k || (k === "roll" && ["atk", "save", "auto"].includes(s.kind)) ? "selected" : ""}>${n}</option>`).join("")}</select></label>
          ${inp("dice", "Zar", "2d6")}${inp("type", "Hasar türü", "ateş")}${inp("up", "Yükseltmede eklenen zar", "1d6")}${inp("every", "Her kaç rütbede", "1", "number")}</div>
        <label class="toggle" style="margin:0 0 10px"><input type="checkbox" data-pff="basic" ${s.basic ? "checked" : ""}> Temel kurtarma (başarıda yarı, kritik başarısızlıkta iki kat)</label>
        <label class="zw-field" style="max-width:none"><span class="lbl">Açıklama</span><textarea class="f" rows="3" data-pff="d">${esc(s.d || "")}</textarea></label></div>
      <footer class="zw-f"><span class="zw-why" id="pffWhy"></span><button class="btn" data-pffa="close">Vazgeç</button><button class="btn pri" data-pffa="save">${edit ? "Kaydet" : "Büyüyü ekle"}</button></footer></div>`;
    };
    ov.addEventListener("input", e => { const el = e.target, k = el.dataset.pff; if (!k) return; s[k] = el.type === "checkbox" ? el.checked : el.value; });
    ov.addEventListener("change", e => { const el = e.target, k = el.dataset.pff; if (!k) return; s[k] = el.type === "checkbox" ? el.checked : el.value; });
    ov.addEventListener("click", e => {
      const b = e.target.closest("[data-pffa]"); if (!b) return;
      if (b.dataset.pffa === "close") { ov.remove(); return; }
      s.n = (s.n || "").trim(); if (!s.n) { $("#pffWhy").textContent = "Büyüye bir ad ver."; return; }
      for (const k of ["dice", "up"]) if (s[k]) { try { parseRoll(s[k]); } catch (err) { $("#pffWhy").textContent = `"${s[k]}" zar olarak anlaşılmadı`; return; } }
      s.rank = +s.rank || 0; s.every = Math.max(1, +s.every || 1); if (s.kind === "roll" && !s.def) s.kind = "roll";
      ov.remove(); onSave({ ...s, id: s.id || uid("sp"), custom: s.custom ?? !s.k });
    });
    draw(); setTimeout(() => $("[data-pff=n]", ov)?.focus(), 0);
  }

  /* ---------------- Canavar kartı ---------------- */
  function newMonster() {
    return { id: uid("mo"), name: "Yeni yaratık", meta: "Orta · İnsansı", level: 1, perc: 6, senses: "", languages: "Ortak", skills: "Atletizm +7", ab: { str: 3, dex: 2, con: 2, int: 0, wis: 1, cha: 0 },
      ac: 16, fort: 7, ref: 5, will: 4, hpMax: 20, immun: "", speed: "25 ft", attacks: [{ name: "Kılıç", bonus: "+8", dmg: "1d8+4 kesici", agile: false }], traits: "", notes: "", size: 1 };
  }
  function statBlock(mo) {
    const M = (k, ph, cls = "f", type = "text") => `<input class="${cls}" type="${type}" data-mo="${k}" value="${esc(getPath(mo, k) ?? "")}" placeholder="${esc(ph)}" aria-label="${esc(ph)}">`;
    return `<article class="stat">
    <input class="stname" data-mo="name" value="${esc(mo.name)}" aria-label="Ad"><input class="stmeta" data-mo="meta" value="${esc(mo.meta)}" placeholder="Boyut · özellikler" aria-label="Özellikler"><hr>
    <div class="strow"><b>Seviye</b>${M("level", "1", "f num n", "number")}<b style="min-width:auto">Algı</b>${M("perc", "6", "f num n", "number")}<button class="btn sm" data-act="pfm-check" data-k="perc">At</button>${M("senses", "Karanlıkta görüş")}</div>
    <div class="strow"><b>Diller</b>${M("languages", "Ortak")}</div>
    <div class="strow"><b>Beceriler</b>${M("skills", "Atletizm +7, Gizlilik +5")}</div>
    <div class="stab">${P.ATTR.map(([k, , ab]) => `<div><span class="lbl">${ab}</span>${M("ab." + k, "0", "f num", "number")}<button class="rollb" data-act="pfm-ab" data-ab="${k}">At</button></div>`).join("")}</div><hr>
    <div class="strow"><b>ZS</b>${M("ac", "16", "f num n", "number")}<b style="min-width:auto">Fort</b>${M("fort", "7", "f num n", "number")}<button class="btn sm" data-act="pfm-check" data-k="fort">At</button></div>
    <div class="strow"><b>Ref</b>${M("ref", "5", "f num n", "number")}<button class="btn sm" data-act="pfm-check" data-k="ref">At</button><b style="min-width:auto">İrade</b>${M("will", "4", "f num n", "number")}<button class="btn sm" data-act="pfm-check" data-k="will">At</button></div>
    <div class="strow"><b>Can</b>${M("hpMax", "20", "f num n", "number")}${M("immun", "Bağışıklık, direnç, zayıflık")}</div>
    <div class="strow"><b>Hız</b>${M("speed", "25 ft")}</div>
    <h4>Saldırılar <button class="btn sm" data-act="mon-addatk">+ Ekle</button></h4>
    ${(mo.attacks || []).map((a, i) => `<div class="atk pfm-atk"><input class="f" data-mo="attacks.${i}.name" value="${esc(a.name)}" aria-label="Saldırı"><input class="f num" data-mo="attacks.${i}.bonus" value="${esc(a.bonus)}" placeholder="+8" aria-label="Bonus"><input class="f dmgf" data-mo="attacks.${i}.dmg" value="${esc(a.dmg)}" placeholder="1d8+4 kesici" aria-label="Hasar">
      <span style="display:flex;gap:4px;flex-wrap:wrap"><label class="toggle" title="Çevik: −4/−8"><input type="checkbox" data-mo="attacks.${i}.agile" ${a.agile ? "checked" : ""}>Çevik</label>${[0, 1, 2].map(n => `<button class="btn sm" data-act="pfm-atk" data-i="${i}" data-n="${n}">${sgn(atkBonus(a.bonus) + mapPen(n, a.agile))}</button>`).join("")}<button class="btn sm" data-act="pfm-dmg" data-i="${i}">Hasar</button><button class="btn sm" data-act="pfm-dmg" data-i="${i}" data-crit="1">×2</button><button class="btn sm danger" data-act="mon-delatk" data-i="${i}" aria-label="Sil">×</button></span></div>`).join("")}
    <h4>Yetenekler ve eylemler</h4><textarea class="f" data-mo="traits" placeholder="Saldırı Fırsatı ↺ …">${esc(mo.traits)}</textarea>
    <h4>GM notları</h4><textarea class="f" data-mo="notes">${esc(mo.notes)}</textarea>
    <div class="stfoot"><span style="flex:1"></span><button class="btn pri" data-act="mon-place">Haritaya ekle</button><button class="btn" data-act="mon-dup">Kopyala</button><button class="btn danger" data-act="mon-del">Sil</button></div></article>`;
  }
  const initChar = ch => { const d = derive(ch), r = rnd(20); return { init: r + d.perc, dex: +ch.ab?.dex || 0, txt: `${ch.name} ${r + d.perc} (${r}${sgn(d.perc)})` }; };
  const initMon = mo => { const p = +mo?.perc || 0; return { init: rnd(20) + p, dex: +mo?.ab?.dex || 0 }; };

  /* ---------------- Eylemler ---------------- */
  function action(a, b, e, c, mo) {
    if (!a || !a.startsWith("pf")) return false;
    const nm = c ? c.name || "İsimsiz" : "", d = c ? derive(c) : null;
    switch (a) {
      case "pf-rank": { const k = b.dataset.k, v = (+getPath(c, k) || 0) + (e.shiftKey ? -1 : 1); setPath(c, k, (v + 5) % 5); save("chars", c, [k.split(".")[0]]); render(); return true; }
      case "pf-ab": check(+c.ab?.[b.dataset.ab] || 0, `${nm} · ${AN[b.dataset.ab][1]}`); return true;
      case "pf-perc": check(d.perc, `${nm} · Algı`); return true;
      case "pf-save": check(d.save[b.dataset.s], `${nm} · ${P.SAVES.find(x => x[0] === b.dataset.s)[1]} kurtarması`); return true;
      case "pf-skill": check(d.skill[b.dataset.s], `${nm} · ${P.SKILLS.find(x => x[0] === b.dataset.s)[1]}`); return true;
      case "pf-lore": check(d.lore[+b.dataset.i], `${nm} · ${c.lores[+b.dataset.i]?.name || "Bilgi"} bilgisi`); return true;
      case "pf-satk": if (d.sAtk == null) toast("Önce büyü niteliğini seç"); else check(d.sAtk, `${nm} · Büyü saldırısı`); return true;
      case "pf-strike": { const s = c.strikes[+b.dataset.i], n = +b.dataset.n; const r = check(d.strike[+b.dataset.i] + mapPen(n, s.agile), `${nm} · ${s.name || "Saldırı"} (${n + 1}. saldırı)`); if (r && r.g != null && r.g >= 2) dmg(strikeDmg(c, s), `${nm} · ${s.name} hasarı${s.type ? " (" + s.type + ")" : ""}`, r.g === 3); return true; }
      case "pf-sdmg": { const s = c.strikes[+b.dataset.i]; dmg(strikeDmg(c, s), `${nm} · ${s.name} hasarı${s.type ? " (" + s.type + ")" : ""}`, !!b.dataset.crit); return true; }
      case "pf-addstrike": (c.strikes = c.strikes || []).push({ name: "Yeni silah", attr: "str", rank: 1, item: 0, dmg: "1d6", dmgAttr: true, type: "", agile: false }); save("chars", c, ["strikes"]); render(); return true;
      case "pf-delstrike": c.strikes.splice(+b.dataset.i, 1); save("chars", c, ["strikes"]); render(); return true;
      case "pf-addlore": (c.lores = c.lores || []).push({ name: "Yeni bilgi", rank: 1 }); save("chars", c, ["lores"]); render(); return true;
      case "pf-dellore": c.lores.splice(+b.dataset.i, 1); save("chars", c, ["lores"]); render(); return true;
      case "pf-cond": { const k = b.dataset.c; c.conds = c.conds || {}; c.conds[k] = Math.max(0, (+c.conds[k] || 0) + +b.dataset.d); if (!c.conds[k]) delete c.conds[k]; save("chars", c, ["conds"]); render(); return true; }
      case "pf-tcond": { const k = b.dataset.c; c.conds = c.conds || {}; if (c.conds[k]) delete c.conds[k]; else c.conds[k] = true; save("chars", c, ["conds"]); render(); return true; }
      case "pf-cv": { const k = b.dataset.c; c[k] = Math.max(0, Math.min(4, (+c[k] || 0) + +b.dataset.d)); save("chars", c, [k]); render(); return true; }
      case "pf-hero": { const j = +b.dataset.j; c.hero = j < (+c.hero || 0) ? j : j + 1; save("chars", c, ["hero"]); render(); return true; }
      case "pf-focus": { const j = +b.dataset.j; c.focus = c.focus || { cur: 0, max: 0 }; c.focus.cur = j < (+c.focus.cur || 0) ? j : j + 1; save("chars", c, ["focus"]); render(); return true; }
      case "pf-reroll": { const L = S.pf2last; if (!L) { toast("Yeniden atılacak bir kontrol yok"); return true; } if ((+c.hero || 0) < 1) { toast("Kahraman puanın yok"); return true; } c.hero--; save("chars", c, ["hero"]); check(L.bonus, L.label + " (kahraman puanı)", L.dc); render(); return true; }
      case "pf-hurt": case "pf-heal": {
        const amt = +($("#hpAmt")?.value || 0); if (!amt) { toast("Önce miktarı yaz"); return true; }
        const paths = ["hp", "hpTemp"];
        if (a === "pf-hurt") { let left = amt; const t = +c.hpTemp || 0; if (t) { const u = Math.min(t, left); c.hpTemp = t - u; left -= u; } c.hp = Math.max(0, (+c.hp || 0) - left);
          if (!c.hp && !+c.dying) { c.dying = Math.min(4, 1 + (+c.wounded || 0)); paths.push("dying"); toast(`${nm} 0 cana düştü: ölmek üzere ${c.dying}. Kritik vuruşsa bir artır.`); } }
        else { const was = +c.hp || 0; c.hp = Math.min(+c.hpMax || 0, was + amt); if (+c.dying && c.hp > 0) { c.dying = 0; c.wounded = Math.min(3, (+c.wounded || 0) + 1); paths.push("dying", "wounded"); toast(`${nm} kendine geldi; yaralı ${c.wounded}`); } }
        save("chars", c, paths); render(); return true;
      }
      case "pf-recover": {
        const dc = 10 + (+c.dying || 0), r = rnd(20), g = degree(r, dc, r === 20 ? 20 : r === 1 ? 1 : null);
        c.dying = Math.max(0, (+c.dying || 0) + [2, 1, -1, -2][g]);
        pushRoll({ id: uid("l"), t: Date.now(), label: `${nm} · İyileşme kontrolü`, expr: `1d20 düz, ZK ${dc}`, total: r, detail: `${DEG[g]} · ölmek üzere ${c.dying}${c.dying >= 4 - (+c.doomed || 0) ? " · ÖLDÜ" : !c.dying ? " · dengede (yaralı +1)" : ""}`, crit: g === 3 ? "20" : g === 0 ? "1" : null });
        if (!c.dying) c.wounded = Math.min(3, (+c.wounded || 0) + 1);
        save("chars", c, ["dying", "wounded"]); render(); return true;
      }
      case "pf-rest": { const L = lvl(c), gain = Math.max(1, +c.ab?.con || 0) * L; c.hp = Math.min(+c.hpMax || 0, (+c.hp || 0) + gain); (c.sp?.slots || []).forEach(s => s.used = 0); if (c.focus) c.focus.cur = +c.focus.max || 0;
        if (c.conds?.fatigued) delete c.conds.fatigued; if (+c.doomed) c.doomed = +c.doomed - 1; save("chars", c, ["hp", "sp", "focus", "conds", "doomed"]); render(); toast(`Dinlendin: +${gain} can, yuvalar ve odak doldu`); return true; }
      case "pf-slot": { const s = c.sp.slots[+b.dataset.i], j = +b.dataset.j; s.used = j < s.used ? j : j + 1; save("chars", c, ["sp"]); render(); return true; }
      case "pf-cast": { const s = (c.book || []).find(x => x.id === b.dataset.id); if (s) cast(c, s, +b.dataset.r); return true; }
      case "pf-spinfo": { const id = b.dataset.id; if (open.has(id)) open.delete(id); else open.add(id); render(); return true; }
      case "pf-spdel": c.book = (c.book || []).filter(x => x.id !== b.dataset.id); save("chars", c, ["book"]); render(); return true;
      case "pf-spedit": { const s = c.book.find(x => x.id === b.dataset.id); if (s) form(s, sp => { Object.assign(s, sp); save("chars", c, ["book"]); render(); }, true); return true; }
      case "pf-spfocus": { const s = c.book.find(x => x.id === b.dataset.id); if (s) { s.focus = b.checked; save("chars", c, ["book"]); render(); } return true; }
      case "pf-addspell": picker(c, { title: `${c.name} · büyü ekle` }); return true;
      case "pf-spellguide": window.PF2G?.spellGuide(); return true;
      case "pfm-check": { const k = b.dataset.k, v = +mo[k] || 0; check(v, monRollLabel(mo, { perc: "Algı", fort: "Dayanıklılık", ref: "Refleks", will: "İrade" }[k])); return true; }
      case "pfm-ab": check(+mo.ab?.[b.dataset.ab] || 0, monRollLabel(mo, AN[b.dataset.ab][1])); return true;
      case "pfm-atk": { const at = mo.attacks[+b.dataset.i], n = +b.dataset.n; const r = check(atkBonus(at.bonus) + mapPen(n, at.agile), monRollLabel(mo, `${at.name || "Saldırı"} (${n + 1}.)`)); const ex = dmgExpr(at.dmg); if (r && r.g != null && r.g >= 2 && ex) dmg(ex, monRollLabel(mo, (at.name || "Saldırı") + " hasarı"), r.g === 3); return true; }
      case "pfm-dmg": { const at = mo.attacks[+b.dataset.i], ex = dmgExpr(at.dmg); if (!ex) { toast("Hasar alanına zar yaz: 1d8+4"); return true; } dmg(ex, monRollLabel(mo, (at.name || "Saldırı") + " hasarı"), !!b.dataset.crit); return true; }
    }
    return false;
  }

  /* ---------------- Canlı güncelleme ---------------- */
  function updateDerived(c) {
    const d = derive(c), main = $("#main"); if (!main) return;
    const val = k => {
      if (k === "ac" || k === "classDC") return d[k]; if (k === "perc") return sgn(d.perc); if (k === "sAtk") return d.sAtk == null ? "—" : sgn(d.sAtk); if (k === "sDC") return d.sDC ?? "—";
      const [g, x, n] = k.split(".");
      if (g === "ab") return sgn(+c.ab?.[x] || 0); if (g === "save") return sgn(d.save[x]); if (g === "skill") return sgn(d.skill[x]); if (g === "lore") return sgn(d.lore[+x]);
      if (g === "strike") { const s = c.strikes[+x]; return s ? sgn(d.strike[+x] + mapPen(+n, s.agile)) : ""; }
      return null;
    };
    $$("[data-d^='pf.']", main).forEach(el => { const v = val(el.dataset.d.slice(3)); if (v != null) el.textContent = v; });
    if (c.level && !c.focus) c.focus = { cur: 0, max: 0 };
  }

  /* ---------------- Zar tepsisi ---------------- */
  let advLabels = null;
  function tray(on) {
    const host = $("#trayDnd"); if (!host) return;
    if (!advLabels) advLabels = $$("[data-adv]", host).map(b => b.textContent);
    $$("[data-adv]", host).forEach((b, i) => b.textContent = on ? ["Talihsizlik", "Normal", "Talih"][i] : advLabels[i]);
    let el = $("#pfTray");
    if (!on) { el?.remove(); return; }
    if (!el) { el = document.createElement("div"); el.id = "pfTray"; el.className = "pf-tray"; host.insertBefore(el, $("#dice", host)); }
    el.innerHTML = `<label class="toggle"><span class="lbl">Hedef ZK / ZS</span><input class="f num" type="number" id="pfDc" value="${esc(S.pf2dc ?? "")}" placeholder="—" aria-label="Hedef zorluk sınıfı"></label><span class="hint" style="margin:0">Doluysa her d20 kontrolü başarı derecesini gösterir.</span>`;
  }
  document.addEventListener("input", e => { if (e.target.id === "pfDc") S.pf2dc = e.target.value; });
  // Yuva sayısı değişince kağıttaki yuva düğmeleri yeniden çizilsin.
  document.addEventListener("change", e => { if (sysKey() === "pf2e" && /^(sp\.slots\.\d+\.max|focus\.max|strikes\.\d+\.agile|armor\.raised)$/.test(e.target.dataset?.k || "")) setTimeout(render, 0); });

  window.PF2 = { newChar, sheet, derive, updateDerived, action, check, tray, statBlock, newMonster, initChar, initMon, picker, form, addToBook, fromSrd, degree, DEG };
  window.ZSYS = window.ZSYS || {};
  window.ZSYS.pf2e = { ...window.PF2, levels: true, initLabel: "1d20+Algı", d20: () => check(0, "d20"), monChip: m => `<small>Sv ${esc(m.level)}</small>` };
})();
