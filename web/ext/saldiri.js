/* Masaüstü eklentileri (15): hedefli saldırı.
   Savaş başladıysa saldırı düğmeleri (Vur, PF2e saldırı düğmeleri) önce hedef sorar. Seçilen hedefin ZS'sine göre
   isabet kendiliğinden belirlenir; isabette hasar zarı atılır, hedefin direnç, zayıflık ve bağışıklığı uygulanır ve
   hasar hedefin canından düşülür. D&D 5e ve Pathfinder 2e için çalışır. Hasar türleri Türkçe ya da İngilizce
   yazılabilir; "fiziksel" ezici, delici ve kesiciyi, "tümü" her türü kapsar. */
(function () {
  "use strict";

  /* ---------- hasar türleri ---------- */
  const DT = [
    ["acid", "Asit", "asit", "acid"], ["bludgeoning", "Ezici", "ezici", "bludgeoning"], ["cold", "Soğuk", "soğuk", "soguk", "cold"],
    ["fire", "Ateş", "ateş", "ates", "fire"], ["force", "Kuvvet", "kuvvet", "force"], ["lightning", "Şimşek", "şimşek", "yıldırım", "elektrik", "lightning", "electricity"],
    ["necrotic", "Nekrotik", "nekrotik", "necrotic"], ["piercing", "Delici", "delici", "piercing"], ["poison", "Zehir", "zehir", "poison"],
    ["psychic", "Psişik", "psişik", "zihinsel", "psychic", "mental"], ["radiant", "Işıltı", "ışıltı", "radiant"], ["slashing", "Kesici", "kesici", "slashing"],
    ["thunder", "Gök gürültüsü", "gök gürültüsü", "gürleme", "thunder"], ["sonic", "Ses", "ses", "sonic"], ["vitality", "Canlılık", "canlılık", "vitality", "positive"],
    ["void", "Boşluk", "boşluk", "void", "negative"], ["spirit", "Ruh", "ruh", "spirit"], ["bleed", "Kanama", "kanama", "bleed"],
  ];
  const GROUPS = { physical: ["bludgeoning", "piercing", "slashing"] };
  const GROUP_WORDS = [["physical", "fiziksel", "physical"], ["all", "tümü", "hepsi", "tüm hasar", "all"]];
  const low = s => String(s || "").toLocaleLowerCase("tr").replace(/[’']/g, "");
  // Kelime başında eşleşir ("ateşe" de ateştir); "ses", "ruh" gibi kısa adlar yalnızca tam kelime olarak.
  const hasWord = (txt, w) => new RegExp(`(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${w.length <= 3 ? "(?![\\p{L}])" : ""}`, "u").test(txt);
  // Metindeki hasar türlerinin anahtarları (ilk bulunan önce).
  function typeKeys(text) { const t = low(text), out = [];
    for (const [k, , ...syn] of DT) if (syn.some(w => hasWord(t, w))) out.push(k);
    for (const [g, ...syn] of GROUP_WORDS) if (syn.some(w => hasWord(t, w))) out.push(g);
    return out; }
  const typeName = k => DT.find(x => x[0] === k)?.[1] || k;
  // "ateş, soğuk 5; fiziksel 3" → [{keys:[fire]}, {keys:[cold], n:5}, {keys:[physical], n:3}]
  function parseList(str) { return String(str || "").split(/[,;\n]|\s+ve\s+|\s+and\s+/i).map(e => e.trim()).filter(Boolean)
    .map(e => ({ keys: typeKeys(e), n: (e.match(/(\d+)\s*$/) || e.match(/(\d+)/) || [])[1] })).filter(e => e.keys.length); }
  function matches(entry, key) { return entry.keys.some(k => k === key || k === "all" || (GROUPS[k] || []).includes(key)); }
  // Hasara savunmaları uygular: {amt, notes[]}
  function defend(sys, amt, key, def) {
    const notes = []; if (!key || !def) return { amt, notes };
    if (parseList(def.immun).some(e => matches(e, key))) return { amt: 0, notes: ["bağışık"] };
    if (sys === "pf2e") {
      const best = l => Math.max(0, ...parseList(l).filter(e => matches(e, key)).map(e => +e.n || 0));
      const w = best(def.vuln), r = best(def.res);
      if (w && amt > 0) { amt += w; notes.push(`zayıflık +${w}`); }
      if (r) { amt = Math.max(0, amt - r); notes.push(`direnç −${r}`); }
      return { amt, notes };
    }
    if (parseList(def.res).some(e => matches(e, key))) { amt = Math.floor(amt / 2); notes.push("direnç: yarı hasar"); }
    if (parseList(def.vuln).some(e => matches(e, key))) { amt *= 2; notes.push("zayıflık: iki kat"); }
    return { amt, notes };
  }

  /* ---------- eski birleşik hasar alanlarını ayır ---------- */
  const done = new Set();
  function migrate() {
    const sys = sysKey(); if (sys !== "dnd5e" && sys !== "pf2e") return;
    const fix = (doc, col) => { const key = col + doc.id + (doc.updated || ""); if (done.has(key)) return; done.add(key);
      let ch = false; (doc.attacks || []).forEach(a => { if (a.type == null && a.dmg) { const d = splitDmg(a); if (d.type) { a.dmg = d.dice; a.type = d.type; ch = true; } } });
      if (ch) save(col, doc, ["attacks"]); };
    if (S.ro) return;
    Object.values(S.chars || {}).forEach(c => c && (isDM() || c.owner === ME.id) && fix(c, "chars"));
    if (isDM()) Object.values(S.monsters || {}).forEach(mo => mo && fix(mo, "monsters"));
  }

  function syncDefs() {
    if (!isDM() || S.ro) return;
    for (const m of Object.values(S.maps || {})) { if (!m) continue; const ps = [];
      for (const t of Object.values(m.tokens || {})) { const mo = t && !t.removed && t.monsterId && S.monsters[t.monsterId]; if (!mo) continue;
        const d = { ac: mo.ac ?? "", res: mo.res || "", vuln: mo.vuln || "", immun: mo.immun || "" };
        if (JSON.stringify(d) !== JSON.stringify(t.def || null)) { t.def = d; ps.push("tokens." + t.id + ".def"); } }
      if (ps.length) save("maps", m, ps); }
  }

  /* ---------- hedef ve savunma bilgisi ---------- */
  const inCombat = () => !!S.combat?.current?.started;
  const cellsOf = t => ({ x: +t.x, y: +t.y, z: +t.size || 1 });
  function gap(a, b) { const A = cellsOf(a), B = cellsOf(b);
    const dx = Math.max(0, B.x - (A.x + A.z) + 1, A.x - (B.x + B.z) + 1), dy = Math.max(0, B.y - (A.y + A.z) + 1, A.y - (B.y + B.z) + 1);
    return Math.max(dx, dy); }   // 1 = bitişik
  function info(t) {
    const sys = sysKey();
    if (t.charId && S.chars[t.charId]) { const c = S.chars[t.charId];
      const ac = sys === "pf2e" && window.PF2 ? PF2.derive(c).ac : +c.ac;
      return { kind: "char", c, ac: isFinite(ac) && c.ac !== "" ? ac : null, def: c, name: c.name || t.label }; }
    // Oyuncular canavar kartlarını görmez; DM'nin istemcisi ZS ve savunmaları jetona kopyalar (syncDefs).
    const mo = t.monsterId && (S.monsters[t.monsterId] || t.def);
    if (mo) return { kind: "mon", mo: S.monsters[t.monsterId] || null, ac: mo.ac === "" || mo.ac == null ? null : +mo.ac, def: mo, name: t.label || mo.name };
    return { kind: "tok", ac: t.ac === "" || t.ac == null ? null : +t.ac, def: t, name: t.label };
  }
  function attackerTok(m, src) {
    if (!m) return null; const ts = toks(m);
    if (src.c) return ts.find(t => t.charId === src.c.id) || null;
    if (src.tokId) return ts.find(t => t.id === src.tokId) || null;
    const cb = S.combat?.current, e = cb?.entries?.[cb.active], at = e?.tokenId && ts.find(t => t.id === e.tokenId);
    if (at && at.monsterId === src.mo.id) return at;
    const sel = ts.find(t => t.id === S.selTok); if (sel && sel.monsterId === src.mo.id) return sel;
    return ts.find(t => t.monsterId === src.mo.id) || null;
  }
  function targets(m, me) {
    const cb = S.combat?.current, inC = new Set(Object.values(cb?.entries || {}).filter(e => e && !e.removed).map(e => e.tokenId || ("c:" + e.ref)));
    return visToks(m).filter(t => !me || t.id !== me.id).map(t => ({ t, i: info(t), d: me ? gap(me, t) : null, inc: inC.has(t.id) || (t.charId && inC.has("c:" + t.charId)) }))
      .sort((a, b) => (b.inc - a.inc) || ((a.d ?? 99) - (b.d ?? 99)) || String(a.i.name).localeCompare(String(b.i.name), "tr"));
  }
  const hpText = t => { if (t.charId && S.chars[t.charId]) { const H = charHp(S.chars[t.charId]); return `${H.hp}/${H.max}`; }
    if (t.hpMax === undefined || t.hpMax === "" || t.hpMax === null) return ""; return isDM() ? `${t.hp}/${t.hpMax}` : hpStatus(t.hp, t.hpMax); };

  /* ---------- hasarı işle ---------- */
  function hurt(m, t, i, amt) {
    if (amt <= 0) return "";
    if (i.kind === "char") { const c = i.c, paths = ["hp", "hpTemp"], was = +c.hp || 0;
      let left = amt; const tmp = +c.hpTemp || 0; if (tmp) { const u = Math.min(tmp, left); c.hpTemp = tmp - u; left -= u; }
      c.hp = Math.max(0, was - left);
      if (!c.hp && sysKey() === "pf2e" && !+c.dying) { c.dying = Math.min(4, 1 + (+c.wounded || 0)); paths.push("dying"); }
      save("chars", c, paths); return `${i.name}: ${was} → ${c.hp}${c.hp ? "" : sysKey() === "pf2e" ? " (ölmek üzere)" : " (0 CP, ölüm kurtarmaları)"}`; }
    if ((t.hpMax === undefined || t.hpMax === "" || t.hpMax === null) && i.mo && +i.mo.hpMax) { t.hpMax = +i.mo.hpMax; t.hp = +i.mo.hpMax; }
    if (t.hpMax === undefined || t.hpMax === "" || t.hpMax === null) return `${i.name} için CP yok: hasarı elle düş`;
    const was = +t.hp || 0; t.hp = Math.max(0, was - amt); save("maps", m, ["tokens." + t.id + ".hp", "tokens." + t.id + ".hpMax"]);
    if (!t.hp) toast(`${i.name} düştü`);
    return isDM() ? `${i.name}: ${was} → ${t.hp}` : `${i.name}: ${hpStatus(t.hp, t.hpMax)}`;
  }

  /* ---------- saldırıyı çöz ---------- */
  const TGT_ADV = ["Kör", "Felçli", "Taşlaşmış", "Kısıtlanmış", "Sersemlemiş", "Bilinçsiz"], AUTO_CRIT = ["Felçli", "Bilinçsiz"];
  function resolve(src, m, me, tg) {
    const sys = sysKey(), t = tg.t, i = tg.i, near = me ? gap(me, t) <= 1 : false;
    const secret = !!(isDM() && S.secret && src.mo);
    let expr, nat, total, hit, crit, why = [];
    if (sys === "pf2e") {
      expr = "1d20" + (src.bonus ? sgn(src.bonus) : "");
      const r = parseRoll(expr); total = r.total; nat = r.crit === "20" ? 20 : r.crit === "1" ? 1 : null;
      if (i.ac != null) { const g = PF2.degree(total, i.ac, nat); hit = g >= 2; crit = g === 3; why.push(PF2.DEG[g]); }
    } else {
      const up = [], dn = []; if (S.adv === 1) up.push("tepsi"); if (S.adv === -1) dn.push("tepsi");
      if (src.c) { const cr = condRoll(src.c, "atk"); up.push(...cr.adv); dn.push(...cr.dis); }
      const tc = i.kind === "char" ? i.c.conditions || [] : [];
      tc.forEach(n => { if (TGT_ADV.includes(n)) up.push("hedef " + n.toLocaleLowerCase("tr")); if (n === "Görünmez") dn.push("hedef görünmez"); if (n === "Yerde") (near ? up : dn).push("hedef yerde"); });
      const a = up.length && dn.length ? 0 : up.length ? 1 : dn.length ? -1 : 0;
      expr = (a === 1 ? "2d20kh1" : a === -1 ? "2d20kl1" : "1d20") + (src.bonus ? sgn(src.bonus) : "");
      const r = parseRoll(expr); total = r.total; nat = r.crit === "20" ? 20 : r.crit === "1" ? 1 : null;
      if (up.length || dn.length) why.push(a === 1 ? "avantaj: " + up.join(", ") : a === -1 ? "dezavantaj: " + dn.join(", ") : "avantaj ve dezavantaj birbirini götürdü");
      if (nat === 1) hit = false; else if (nat === 20) hit = true; else if (i.ac != null) hit = total >= i.ac;
      crit = nat === 20 || (hit && near && tc.some(n => AUTO_CRIT.includes(n)));
    }
    const showAc = i.ac != null && (isDM() || i.kind === "char");
    const head = `${src.label} → ${i.name}`, atkTxt = `Saldırı ${total}${showAc ? ` (ZS ${i.ac})` : ""}`;
    if (hit === undefined) { // ZS bilinmiyor: eski davranış gibi zarları göster, canı elle düş
      const d = src.dice ? rollDmg(src, sys, false) : null;
      pushRoll({ id: uid("l"), t: Date.now(), label: head, expr, total, detail: `${atkTxt} · hedefin ZS'si yok, isabeti sen belirle${d ? ` · isabette hasar ${d.total}${src.type ? " " + src.type : ""}` : ""}`, crit: nat === 20 ? "20" : nat === 1 ? "1" : null, secret });
      return; }
    if (!hit) { pushRoll({ id: uid("l"), t: Date.now(), label: head, expr, total: "Iska", detail: [atkTxt, ...why, nat === 1 ? "doğal 1" : ""].filter(Boolean).join(" · "), crit: nat === 1 ? "1" : null, secret }); return; }
    if (!src.dice) { pushRoll({ id: uid("l"), t: Date.now(), label: head, expr, total: "İsabet", detail: [atkTxt, ...why, "hasar zarı yazılmamış"].join(" · "), crit: crit ? "20" : null, secret }); return; }
    const d = rollDmg(src, sys, crit); if (!d) return;
    const key = typeKeys(src.type)[0], df = defend(sys, d.total, key, i.def);
    const res = hurt(m, t, i, df.amt);
    pushRoll({ id: uid("l"), t: Date.now(), label: head + (crit ? " · KRİTİK" : ""), expr: d.expr, total: df.amt,
      detail: [atkTxt + (crit ? " kritik isabet" : " isabet"), ...why, `hasar ${d.detail}${src.type ? " " + src.type : ""}`, ...df.notes, res].filter(Boolean).join(" · "), crit: crit ? "20" : null, secret });
    render();
  }
  function rollDmg(src, sys, crit) {
    const ex = dmgExpr(src.dice, crit && sys !== "pf2e"); if (!ex) { toast("Hasar zarı anlaşılmadı: " + src.dice); return null; }
    let r; try { r = parseRoll(ex); } catch (e) { toast("Hasar zarı anlaşılmadı: " + src.dice); return null; }
    if (crit && sys === "pf2e") return { expr: ex + " ×2", total: r.total * 2, detail: `${ex} = ${r.total} ×2 = ${r.total * 2}` };
    return { expr: ex, total: r.total, detail: `${ex} = ${r.total}` };
  }

  /* ---------- hedef seçme penceresi ---------- */
  let P = null;
  function pick(src) {
    const m = curMap(); if (!m) { toast("Hedef seçmek için bir harita gerekli"); return false; }
    const me = attackerTok(m, src), list = targets(m, me);
    if (!list.length) return false;
    P = { src, m, me, list }; draw(); return true;
  }
  function draw() {
    let ov = $("#atkOv"); if (!P) { ov?.remove(); return; }
    if (!ov) { ov = document.createElement("div"); ov.id = "atkOv"; ov.className = "joinov zw-ov"; document.body.appendChild(ov); }
    const { src, list } = P;
    ov.innerHTML = `<div class="zw atk-pick" role="dialog" aria-modal="true" aria-label="Saldırı hedefi"><header class="zw-h"><h2>${esc(src.label)}: kime?</h2><span style="flex:1"></span><button class="btn sm" data-atkp="close" aria-label="Kapat">×</button></header>
      <div class="zw-b"><p class="hint" style="margin-top:0">Saldırı ${sgn(src.bonus || 0)}${src.dice ? ` · hasar ${esc(src.dice)}${src.type ? " " + esc(src.type) : ""}` : ""}. Hedefi seç: isabet, kritik, direnç ve zayıflık hesaplanır, hasar canından düşülür.</p>
      <div class="atk-list">${list.map((x, j) => `<button class="atk-t" data-atkp="t" data-j="${j}">${tokImg(x.t) ? `<img class="dot" src="${esc(tokImg(x.t))}" alt="">` : `<span class="dot" style="background:${esc(x.t.color)}"></span>`}
        <b>${esc(x.i.name)}</b><small>${[x.d != null ? (x.d <= 1 ? "bitişik" : `${x.d * 5} ft`) : "", x.i.ac != null && (isDM() || x.i.kind === "char") ? `ZS ${x.i.ac}` : x.i.ac == null ? "ZS yok" : "", hpText(x.t), x.inc ? "savaşta" : ""].filter(Boolean).join(" · ")}</small></button>`).join("")}</div></div>
      <footer class="zw-f"><button class="btn" data-atkp="plain">Hedefsiz at</button><span style="flex:1"></span><button class="btn" data-atkp="close">Vazgeç</button></footer></div>`;
    setTimeout(() => ov.querySelector("[data-atkp=t]")?.focus(), 0);
  }
  let bypass = false;
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-atkp]"); if (!b || !P) return;
    const k = b.dataset.atkp, p = P;
    if (k === "close") { P = null; draw(); return; }
    if (k === "plain") { P = null; draw(); if (p.src.btn && document.contains(p.src.btn)) { bypass = true; p.src.btn.click(); bypass = false; } else if (p.src.plain) p.src.plain(); return; }
    if (k === "t") { P = null; draw(); resolve(p.src, p.m, p.me, p.list[+b.dataset.j]); }
  });
  document.addEventListener("keydown", e => { if (P && e.key === "Escape") { P = null; draw(); } });

  /* ---------- saldırı düğmelerini yakala ---------- */
  const mapPen = (n, agile) => n === 0 ? 0 : agile ? -4 * n : -5 * n;
  function srcFrom(b) {
    const a = b.dataset.act, sys = sysKey(), i = +b.dataset.i, n = +b.dataset.n || 0;
    const c = b.dataset.cid ? S.chars[b.dataset.cid] : S.chars[S.charId], mo = b.dataset.moid ? S.monsters[b.dataset.moid] : S.monsters[S.monId];
    if (a === "roll-atk" && sys === "dnd5e" && c) { const at = c.attacks?.[i]; if (!at) return null; const d = splitDmg(at);
      return { c, label: `${c.name || "İsimsiz"} · ${at.name || "Saldırı"}`, bonus: atkBonus(at.bonus), dice: d.dice, type: d.type }; }
    if (a === "mon-atk" && sys === "dnd5e" && mo) { const at = mo.attacks?.[i]; if (!at) return null; const d = splitDmg(at);
      return { mo, tokId: b.dataset.tid, label: `${mo.name} · ${at.name || "Saldırı"}`, bonus: atkBonus(at.bonus), dice: d.dice, type: d.type }; }
    if (a === "pf-strike" && sys === "pf2e" && c && window.PF2) { const s = c.strikes?.[i]; if (!s) return null; const st = +c.ab?.str || 0;
      return { c, label: `${c.name || "İsimsiz"} · ${s.name || "Saldırı"}${n ? ` (${n + 1}. saldırı)` : ""}`, bonus: PF2.derive(c).strike[i] + mapPen(n, s.agile), dice: `${s.dmg || "1d4"}${s.dmgAttr && st ? sgn(st) : ""}`, type: s.type || "" }; }
    if (a === "pfm-atk" && sys === "pf2e" && mo) { const at = mo.attacks?.[i]; if (!at) return null; const d = splitDmg(at);
      return { mo, tokId: b.dataset.tid, label: `${mo.name} · ${at.name || "Saldırı"}${n ? ` (${n + 1}.)` : ""}`, bonus: atkBonus(at.bonus) + mapPen(n, at.agile), dice: d.dice, type: d.type }; }
    return null;
  }
  document.addEventListener("click", e => {
    if (bypass) return;
    const b = e.target.closest('[data-act="roll-atk"],[data-act="mon-atk"],[data-act="pf-strike"],[data-act="pfm-atk"]'); if (!b) return;
    const fromTok = !!b.dataset.tsrc; if (!fromTok && !inCombat()) return;
    const src = srcFrom(b); if (!src) return;
    src.btn = fromTok ? null : b;
    if (fromTok) src.plain = () => roll("1d20" + (src.bonus ? sgn(src.bonus) : ""), src.label, !!src.mo);
    if (pick(src)) { e.preventDefault(); e.stopImmediatePropagation(); }
    else if (fromTok) { e.preventDefault(); e.stopImmediatePropagation(); toast("Haritada saldırılacak başka jeton yok"); }
  }, true);

  /* ---------- haritada seçili jetondan saldırı ---------- */
  function tokAttacks(t) {
    const sys = sysKey();
    if (t.charId && S.chars[t.charId]) { const c = S.chars[t.charId];
      if (sys === "dnd5e") return (c.attacks || []).map((a, i) => ({ n: a.name || "Saldırı", attrs: `data-act="roll-atk" data-cid="${c.id}" data-i="${i}"` }));
      if (sys === "pf2e") return (c.strikes || []).map((s, i) => ({ n: s.name || "Saldırı", map: true, attrs: `data-act="pf-strike" data-cid="${c.id}" data-i="${i}"` })); }
    const mo = t.monsterId && S.monsters[t.monsterId];
    if (mo && isDM()) {
      if (sys === "dnd5e") return (mo.attacks || []).map((a, i) => ({ n: a.name || "Saldırı", attrs: `data-act="mon-atk" data-moid="${mo.id}" data-tid="${t.id}" data-i="${i}"` }));
      if (sys === "pf2e") return (mo.attacks || []).map((a, i) => ({ n: a.name || "Saldırı", map: true, attrs: `data-act="pfm-atk" data-moid="${mo.id}" data-tid="${t.id}" data-i="${i}"` })); }
    return [];
  }

  // Hasar türü önerileri (bütün hasar türü kutuları kullanır).
  function datalist() { if ($("#dmgTypes")) return; const d = document.createElement("datalist"); d.id = "dmgTypes";
    const en = window.LANG && LANG() === "en", sys = sysKey(), keep = sys === "pf2e" ? k => !["thunder", "necrotic", "radiant"].includes(k) : k => !["sonic", "vitality", "void", "spirit", "bleed"].includes(k);
    d.innerHTML = DT.filter(x => keep(x[0])).map(x => `<option value="${esc(en ? x[0] : x[2])}">`).join("") + `<option value="${en ? "physical" : "fiziksel"}">`; document.body.appendChild(d); }

  const _render = window.render;
  window.render = function () {
    _render.apply(this, arguments);
    if (!G.id) return;
    const sys = sysKey(); if (sys !== "dnd5e" && sys !== "pf2e") return;
    $("#dmgTypes")?.dataset.sys !== sys && $("#dmgTypes")?.remove(); datalist(); $("#dmgTypes").dataset.sys = sys;
    try { migrate(); syncDefs(); } catch (e) { console.warn(e); }
    if (S.view !== "harita" || S.ro) return;
    const m = curMap(), t = m && visToks(m).find(x => x.id === S.selTok); if (!t || !(ownsTok(t) || isDM())) return;
    const list = tokAttacks(t); if (!list.length) return;
    const panel = $('#main .side [data-act="deltok"]')?.closest(".panel"); if (!panel) return;
    const box = document.createElement("div"); box.className = "atk-tok";
    box.innerHTML = `<span class="lbl">Saldır</span>${list.map(a => a.map ? `<span class="atk-tm"><span>${esc(a.n)}</span>${[0, 1, 2].map(n => `<button class="btn sm" ${a.attrs} data-n="${n}" data-tsrc="1" title="${n + 1}. saldırı">${n + 1}.</button>`).join("")}</span>`
      : `<button class="btn sm" ${a.attrs} data-tsrc="1">${esc(a.n)}</button>`).join("")}<p class="hint" style="margin:0">Hedefi seçince isabet ve hasar kendiliğinden işlenir.</p>`;
    (panel.querySelector(".fgrid") || panel).appendChild(box);
  };

  window.ATTACK = { typeKeys, parseList, defend, splitDmg: a => splitDmg(a), pick, resolve, targets };
})();
