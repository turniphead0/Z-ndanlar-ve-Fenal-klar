/* Masaüstü eklentileri (3): D&D 5e büyü kitabı.
   Karakter kağıdına büyü sayfası ekler: büyüler seviyeye göre listelenir, hangi yuvayla yapılacağı seçilir,
   tek tıkla yuva harcanır, saldırı/hasar/iyileştirme zarları atılır, konsantrasyon izlenir.
   Kendi büyünü (homebrew) yazabilir ya da SRD listesinden ekleyebilirsin. */
(function () {
  "use strict";

  const D = window.ZM5E;
  const CODE = { B: "Ozan", C: "Rahip", D: "Druid", P: "Paladin", R: "Korucu", S: "Sihirbaz", K: "Cadı", W: "Büyücü" };
  const KIND = { atk: "Büyü saldırısı", save: "Kurtarma zarı", heal: "İyileştirme", auto: "Kendiliğinden isabet", roll: "Yalnızca zar", util: "Zarsız etki" };
  const lvlName = l => l ? `${l}. seviye` : "Hile";
  const open = new Set();

  /* ---------------- Yardımcılar ---------------- */
  function clsOf(c) {
    if (!c) return null;
    if (c.clsKey) { const k = D.CLASSES.find(x => x.k === c.clsKey); if (k) return k; }
    if (c.clsCustom) return c.clsCustom;
    const t = (c.cls || "").toLocaleLowerCase("tr");
    return D.CLASSES.find(x => { const [tr, en] = x.n.toLocaleLowerCase("tr").split(" ("); return t.startsWith(tr) || (en && t.includes(en.replace(")", ""))); }) || null;
  }
  const tier = L => 1 + (L >= 5) + (L >= 11) + (L >= 17);
  // "2d6+3" içindeki zar sayılarını (ve istenirse sabitleri) k ile çarpar.
  const mulDice = (expr, k, flat = true) => String(expr).replace(/(\d*)d(\d+)|(\d+)/g, (m, n, s, f) => s ? `${(+n || 1) * k}d${s}` : flat ? String(+f * k) : f);
  function upCount(s, slot) { const extra = Math.max(0, slot - s.lvl); const every = /\/(\d+)$/.exec(s.up || ""); return every ? Math.floor(extra / +every[1]) : extra; }
  // Büyünün bu yuva seviyesinde ve karakter seviyesinde atılacak zarı.
  function diceFor(s, c, slot) {
    if (!s.dice) return "";
    let e = s.dice;
    if (!s.lvl && !s.beams) e = mulDice(e, tier(+c.level || 1), false);
    const n = s.up ? upCount(s, slot) : 0;
    if (n) e += "+" + mulDice(s.up.replace(/\/\d+$/, ""), n);
    return e;
  }
  // Kavurucu Işın gibi büyüler üst seviyede zar yerine ışın ekler (up boşsa).
  const rays = (s, c, slot) => s.beams ? tier(+c.level || 1) : s.rays > 1 ? s.rays + (s.up ? 0 : Math.max(0, slot - s.lvl)) : 1;
  const isPrepCls = c => !!clsOf(c)?.prep;
  function prepMax(c) {
    const k = clsOf(c), d = derive(c), m = c.spellAb ? d.m[c.spellAb] : 0, L = +c.level || 1;
    if (!k?.prep) return null;
    return Math.max(1, m + (k.prep === "H" ? Math.floor(L / 2) : L));
  }
  const ready = (c, s) => !s.lvl || !isPrepCls(c) || s.prep;
  function fxText(s, c, slot) {
    const d = derive(c), dice = diceFor(s, c, slot || s.lvl), m = c.spellAb ? d.m[c.spellAb] : 0, n = rays(s, c, slot || s.lvl);
    const dmg = dice ? `${n > 1 ? n + " × " : ""}${dice}${s.mod && m ? sgn(m) : ""}${s.type ? " " + s.type : ""}` : "";
    if (s.kind === "atk") return `Saldırı ${d.satk == null ? "?" : sgn(d.satk)}${dmg ? " · " + dmg : ""}`;
    if (s.kind === "save") return `${ABN[s.save]?.[2] || "?"} ZK ${d.sdc ?? "?"}${dmg ? " · " + dmg : ""}`;
    if (s.kind === "heal") return `${dmg} can`;
    return dmg;
  }

  /* ---------------- Büyü yapma ---------------- */
  function push(label, expr, extra) {
    let r; try { r = parseRoll(expr); } catch (e) { toast("Zar anlaşılmadı: " + expr); return null; }
    const entry = { id: uid("l"), t: Date.now(), label, expr, total: r.total, detail: r.detail, crit: r.crit, ...(extra || {}) };
    pushRoll(entry); return r;
  }
  function info(label, total, detail) { pushRoll({ id: uid("l"), t: Date.now(), label, expr: "", total, detail, crit: null }); }

  function cast(c, s, slot, ritual) {
    const nm = c.name || "İsimsiz", d = derive(c), m = c.spellAb ? d.m[c.spellAb] : 0;
    const paths = [];
    let note = "";
    if (s.lvl && !ritual) {
      const sl = c.slots?.[slot - 1];
      if (!sl || (+sl.used || 0) >= (+sl.max || 0)) { toast(`${slot}. seviye yuvan kalmadı`); return; }
      sl.used = (+sl.used || 0) + 1; paths.push("slots");
      note = `${slot}. seviye yuva · ${(+sl.max) - sl.used} kaldı`;
    } else if (ritual) note = "Ritüel olarak (10 dakika daha uzun, yuva harcanmadı)";
    if (s.conc) {
      if (c.conc && c.conc !== s.n) toast(`${c.conc} sona erdi: aynı anda tek konsantrasyon büyüsü olur`);
      c.conc = s.n; paths.push("conc");
    }
    const at = slot && slot !== s.lvl ? ` (${slot}. sv)` : "";
    const label = `${nm} · ${s.n}${at}`;
    const dice = diceFor(s, c, slot || s.lvl), plus = s.mod && m ? sgn(m) : "";
    if (s.kind === "atk") {
      if (d.satk == null) toast("Büyü yeteneğini seçmediğin için saldırı bonusu yok");
      const n = rays(s, c, slot || s.lvl);
      for (let i = 0; i < n; i++) {
        const tag = n > 1 ? ` ${i + 1}/${n}` : "";
        const a = push(`${label}${tag} · saldırı${condNote(c, "atk")}`, d20expr(d.satk || 0, c, "atk"));
        if (a && dice) push(`${label}${tag} · ${a.crit === "20" ? "KRİTİK " : ""}hasar${s.type ? " (" + s.type + ")" : ""}`, (a.crit === "20" ? mulDice(dice, 2, false) : dice) + plus);
      }
    } else if (s.kind === "save") {
      const sv = `${ABN[s.save]?.[1] || ""} kurtarması, ZK ${d.sdc ?? "?"}`;
      if (dice) push(`${label} · hasar${s.type ? " (" + s.type + ")" : ""} · ${sv}`, dice + plus);
      else info(`${label} · ${sv}`, d.sdc ?? "?", "Hedef d20 atar; ZK'ye ulaşamazsa etkiden etkilenir");
    } else if (s.kind === "heal") push(`${label} · iyileştirme`, (dice || "0") + plus);
    else if (dice) push(`${label}${s.type ? " · " + s.type : ""}`, dice + plus);
    else info(label, "✓", s.d || "Büyü yapıldı");
    if (paths.length) save("chars", c, paths);
    toast(`${s.n} yapıldı${note ? " · " + note : ""}`);
    render();
  }

  /* ---------------- Büyü kitabı paneli ---------------- */
  const tags = s => [lvlName(s.lvl), s.school, s.time, s.range, s.dur].filter(Boolean).map(esc).join(" · ") + (s.conc ? ' <b class="zb-k" title="Konsantrasyon">K</b>' : "") + (s.ritual ? ' <b class="zb-k" title="Ritüel">R</b>' : "") + (s.custom ? ' <b class="zb-k hb" title="Kendi yazdığın büyü">Özel</b>' : "");

  function castBtns(c, s) {
    if (!s.lvl) return `<button type="button" class="btn sm pri" data-zb="cast" data-id="${s.id}" data-l="0">Yap</button>`;
    const ok = ready(c, s);
    const lv = (c.slots || []).map((sl, i) => [i + 1, +sl.max || 0, (+sl.max || 0) - (+sl.used || 0)]).filter(([l, mx]) => l >= s.lvl && mx > 0);
    return (lv.length ? lv.map(([l, , left]) => `<button type="button" class="chip zb-lv" data-zb="cast" data-id="${s.id}" data-l="${l}" ${left > 0 && ok ? "" : "disabled"} title="${l}. seviye yuvayla yap (${left} kaldı)">${l}. sv <small>${left}</small></button>`).join("") : `<span class="zb-none">${s.lvl}. seviye ya da üstü yuvan yok</span>`)
      + (s.ritual ? `<button type="button" class="chip" data-zb="cast" data-id="${s.id}" data-l="${s.lvl}" data-rit="1" title="Yuva harcamadan, 10 dakika daha uzun sürede yap">Ritüel</button>` : "");
  }

  function bookHtml(c) {
    const book = c.book || [], d = derive(c), k = clsOf(c), pm = prepMax(c);
    const prepN = book.filter(s => s.lvl && s.prep).length;
    const groups = {}; book.forEach(s => (groups[s.lvl] = groups[s.lvl] || []).push(s));
    const pact = k?.kind === "pact";
    return `<div class="panel zb" id="zbBook"><h3>Büyü Kitabı <span class="sp"></span>
      ${pact ? `<button type="button" class="btn sm" data-zb="short" title="Cadının pakt yuvaları kısa dinlenmede dolar">Kısa dinlenme</button>` : ""}
      <button type="button" class="btn sm" data-zb="guide">Nasıl kullanılır?</button><button type="button" class="btn sm pri" data-zb="add">+ Büyü ekle</button></h3>
      ${c.conc ? `<div class="zb-conc"><b>Konsantrasyon:</b> ${esc(c.conc)} <small>Hasar alınca DAY kurtarması (ZK 10 ya da hasarın yarısı, hangisi yüksekse).</small><button type="button" class="btn sm" data-zb="endconc">Bitir</button></div>` : ""}
      ${!c.spellAb ? `<p class="zb-warn">Büyü yeteneği seçilmemiş. Yukarıdaki <b>Büyücülük</b> bölümünden seç; saldırı bonusu ve kurtarma ZK'si buradan hesaplanır.</p>` : ""}
      ${pm != null ? `<p class="zb-prep">Hazırlanmış büyü: <b class="num">${prepN}/${pm}</b> <small>${esc(k.n.split(" (")[0])} her uzun dinlenmeden sonra listesinden ${pm} büyü hazırlar. Hileler sayılmaz. Hazırlamak için büyünün yanındaki kutuyu işaretle.</small></p>` : ""}
      ${book.length ? Object.keys(groups).sort((a, b) => a - b).map(l => {
        const sl = +l ? c.slots?.[l - 1] : null;
        return `<div class="zb-g"><div class="zb-gh"><b>${lvlName(+l)}</b>${sl && +sl.max ? `<span class="zb-pips">${Array.from({ length: +sl.max }, (_, j) => `<i class="${j < (+sl.used || 0) ? "used" : ""}"></i>`).join("")}</span>` : ""}</div>
          ${groups[l].map(s => `<div class="zb-sp ${ready(c, s) ? "" : "off"}">
            ${s.lvl && isPrepCls(c) ? `<input type="checkbox" data-zb="prep" data-id="${s.id}" ${s.prep ? "checked" : ""} title="Hazırlanmış" aria-label="${esc(s.n)} hazırlanmış">` : `<span></span>`}
            <button type="button" class="zb-nm" data-zb="info" data-id="${s.id}" aria-expanded="${open.has(s.id)}"><b>${esc(s.n)}</b>${s.en && s.en !== s.n ? `<small>${esc(s.en)}</small>` : ""}</button>
            <span class="zb-fx">${esc(fxText(s, c)) || `<span class="zb-none">${KIND[s.kind] || ""}</span>`}</span>
            <span class="zb-cast">${castBtns(c, s)}</span>
            ${open.has(s.id) ? `<div class="zb-det"><div class="zb-tags">${tags(s)}</div><p>${esc(s.d || "")}</p>${s.up ? `<p class="zb-none">Üst seviyede: her ${/\/2$/.test(s.up) ? "iki " : ""}seviye için +${esc(s.up.replace(/\/\d+$/, ""))}</p>` : ""}${!s.lvl && s.dice && !s.beams ? `<p class="zb-none">Hile hasarı 5., 11. ve 17. seviyede artar.</p>` : ""}
              <div class="zb-ed"><button type="button" class="btn sm" data-zb="edit" data-id="${s.id}">Düzenle</button><button type="button" class="btn sm danger" data-zb="del" data-id="${s.id}">Kitaptan çıkar</button></div></div>` : ""}
          </div>`).join("")}</div>`;
      }).join("") : `<p class="zb-none">Henüz büyü yok. <b>+ Büyü ekle</b> ile ${k?.code ? esc(k.n.split(" (")[0]) + " listesinden seç" : "SRD listesinden seç"} ya da kendi büyünü yaz.</p>`}
    </div>`;
  }

  /* ---------------- Büyü seçici ---------------- */
  let P = null; // { charId, q, lvl, code, onPick, picked(k) }
  function pickerHtml() {
    const q = P.q.trim().toLocaleLowerCase("tr");
    const list = D.SPELLS.filter(s => (P.lvl === "" || s.lvl === +P.lvl) && (!P.code || s.cls.includes(P.code)) && (P.maxLvl == null || s.lvl <= P.maxLvl) && (!q || (s.n + " " + s.en + " " + s.school).toLocaleLowerCase("tr").includes(q)));
    const lvls = [...new Set(D.SPELLS.map(s => s.lvl))].filter(l => P.maxLvl == null || l <= P.maxLvl);
    return `<div class="zw zb-pick" role="dialog" aria-modal="true" aria-label="Büyü ekle">
      <header class="zw-h"><h2>${esc(P.title || "Büyü ekle")}</h2><span class="sp" style="flex:1"></span><button class="btn sm" data-zbp="close" aria-label="Kapat">×</button></header>
      <div class="zb-filt"><input class="f" data-zbp-q placeholder="Ara: ateş, fireball, iyileştir…" value="${esc(P.q)}" aria-label="Büyü ara">
        <select class="f" data-zbp-code aria-label="Sınıf listesi"><option value="">Tüm sınıflar</option>${Object.entries(CODE).map(([k, n]) => `<option value="${k}" ${P.code === k ? "selected" : ""}>${n}</option>`).join("")}</select>
        <span class="chips"><button type="button" class="chip" data-zbp="lvl" data-v="" aria-pressed="${P.lvl === ""}">Hepsi</button>${lvls.map(l => `<button type="button" class="chip" data-zbp="lvl" data-v="${l}" aria-pressed="${P.lvl === String(l)}">${l ? l + ". sv" : "Hile"}</button>`).join("")}</span></div>
      <div class="zw-b zb-list">${list.length ? list.map(s => { const got = P.picked(s.k); return `<div class="zb-row"><div><b>${esc(s.n)}</b> <small>${esc(s.en)}</small><div class="zb-tags">${tags(s)} · ${s.cls.split("").map(x => CODE[x]).join(", ")}</div><p>${esc(s.d)}</p></div>
        <button type="button" class="btn sm ${got ? "" : "pri"}" data-zbp="pick" data-k="${s.k}">${got ? "Eklendi ✓" : "Ekle"}</button></div>`; }).join("") : `<p class="zb-none">Bu filtrede büyü yok. Aradığın büyü listede yoksa kendin yazabilirsin.</p>`}</div>
      <footer class="zw-f"><span class="zw-why" style="text-align:left">Listede SRD (açık lisanslı) büyüler var. Kitaplardaki diğer büyüleri ya da kendi uydurduğun büyüleri <b>Kendi büyünü yaz</b> ile ekleyebilirsin.</span><button class="btn" data-zbp="custom">Kendi büyünü yaz</button><button class="btn pri" data-zbp="close">Tamam</button></footer></div>`;
  }
  function drawPicker() {
    let ov = $("#zbPickOv");
    if (!P) { ov?.remove(); return; }
    if (!ov) { ov = document.createElement("div"); ov.id = "zbPickOv"; ov.className = "joinov zw-ov zb-ov"; document.body.appendChild(ov); }
    const y = $(".zb-list", ov)?.scrollTop || 0, focusQ = document.activeElement?.hasAttribute?.("data-zbp-q");
    const pos = focusQ ? document.activeElement.selectionStart : null;
    ov.innerHTML = pickerHtml();
    $(".zb-list", ov).scrollTop = y;
    if (focusQ) { const i = $("[data-zbp-q]", ov); i.focus(); i.setSelectionRange(pos, pos); }
  }
  // Dışarıdan da kullanılır (sihirbaz, seviye atlama).
  function picker(o) { P = { q: "", lvl: "", code: "", ...o }; drawPicker(); }
  const fromSrd = k => { const s = D.SPELLS.find(x => x.k === k); return s ? { ...s, id: uid("sp"), prep: false } : null; };

  /* ---------------- Kendi büyün (homebrew) ---------------- */
  let F = null; // { sp, onSave }
  const blank = () => ({ n: "", en: "", lvl: 1, school: "", time: "1 eylem", range: "", dur: "Anlık", conc: false, ritual: false, kind: "save", save: "dex", dice: "", type: "", up: "", mod: false, rays: 1, d: "" });
  function formHtml() {
    const s = F.sp, inp = (k, lbl, ph = "", type = "text") => `<label class="zw-field"><span class="lbl">${lbl}</span><input class="f" type="${type}" data-zbf="${k}" value="${esc(s[k] ?? "")}" placeholder="${esc(ph)}"></label>`;
    return `<div class="zw zb-form" role="dialog" aria-modal="true" aria-label="Büyü yaz">
      <header class="zw-h"><h2>${F.edit ? "Büyüyü düzenle" : "Kendi büyünü yaz"}</h2><span style="flex:1"></span><button class="btn sm" data-zbf-act="close" aria-label="Kapat">×</button></header>
      <div class="zw-b"><p>Kitaptan bir büyüyü ya da masanda uydurduğunuz bir büyüyü ekle. Doldurduğun alanlara göre büyü kitabındaki düğme doğru zarı atar.</p>
        <div class="zb-fgrid">${inp("n", "Büyünün adı", "örn. Gölge Oku")}${inp("en", "Orijinal adı (isteğe bağlı)", "örn. Shadow Bolt")}
          <label class="zw-field"><span class="lbl">Seviye</span><select class="f" data-zbf="lvl">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => `<option value="${l}" ${+s.lvl === l ? "selected" : ""}>${lvlName(l)}</option>`).join("")}</select></label>
          ${inp("school", "Okul", "Yıkım")}${inp("time", "Yapılış süresi", "1 eylem")}${inp("range", "Menzil", "60 ft")}${inp("dur", "Süre", "Anlık")}</div>
        <div class="chips" style="margin:4px 0 12px"><label class="toggle"><input type="checkbox" data-zbf="conc" ${s.conc ? "checked" : ""}> Konsantrasyon</label><label class="toggle"><input type="checkbox" data-zbf="ritual" ${s.ritual ? "checked" : ""}> Ritüel</label></div>
        <p><b>Etkisi nasıl çözülür?</b></p>
        <div class="zw-align zb-kinds">${Object.entries(KIND).map(([k, n]) => `<button type="button" class="zw-card sm" data-zbf-act="kind" data-v="${k}" aria-pressed="${s.kind === k}"><b>${n}</b><span>${{ atk: "d20 + büyü saldırısı bonusu, sonra hasar zarı", save: "Hedef kurtarma zarı atar; sen hasarı atarsın", heal: "Zar kadar can verir", auto: "Saldırı zarı yok, hasar doğrudan atılır", roll: "Bir zar atılır (örn. Kutsama 1d4)", util: "Zar atılmaz, yalnızca yuva harcanır" }[k]}</span></button>`).join("")}</div>
        <div class="zb-fgrid">
          ${s.kind === "save" ? `<label class="zw-field"><span class="lbl">Kurtarma yeteneği</span><select class="f" data-zbf="save">${ABS.map(([k, n]) => `<option value="${k}" ${s.save === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>` : ""}
          ${s.kind !== "util" ? inp("dice", "Zar", "örn. 3d6 ya da 2d8+4") + inp("type", s.kind === "heal" ? "Not (isteğe bağlı)" : "Hasar türü", s.kind === "heal" ? "" : "ateş") + inp("up", "Her üst seviyede eklenen zar", "örn. 1d6") : ""}
          ${s.kind === "atk" ? inp("rays", "Işın sayısı (her biri ayrı saldırı)", "1", "number") : ""}</div>
        ${s.kind !== "util" ? `<label class="toggle" style="margin-bottom:10px"><input type="checkbox" data-zbf="mod" ${s.mod ? "checked" : ""}> Zara büyü yeteneği bonusunu ekle (örn. Yaraları İyileştir)</label>` : ""}
        <label class="zw-field" style="max-width:none"><span class="lbl">Açıklama</span><textarea class="f" data-zbf="d" rows="3" placeholder="Büyü ne yapıyor?">${esc(s.d || "")}</textarea></label>
      </div>
      <footer class="zw-f"><span class="zw-why" id="zbfWhy"></span><button class="btn" data-zbf-act="close">Vazgeç</button><button class="btn pri" data-zbf-act="save">${F.edit ? "Kaydet" : "Büyüyü ekle"}</button></footer></div>`;
  }
  function drawForm() {
    let ov = $("#zbFormOv");
    if (!F) { ov?.remove(); return; }
    if (!ov) { ov = document.createElement("div"); ov.id = "zbFormOv"; ov.className = "joinov zw-ov zb-ov2"; document.body.appendChild(ov); }
    ov.innerHTML = formHtml();
  }
  function form(sp, onSave, edit) { F = { sp: { ...blank(), ...(sp || {}) }, onSave, edit: !!edit }; drawForm(); setTimeout(() => $("[data-zbf=n]")?.focus(), 0); }
  function formSave() {
    const s = F.sp; s.n = (s.n || "").trim();
    if (!s.n) { $("#zbfWhy").textContent = "Büyüye bir ad ver."; return; }
    for (const k of ["dice", "up"]) if (s[k]) { try { parseRoll(s[k].replace(/\/\d+$/, "")); } catch (e) { $("#zbfWhy").textContent = `"${s[k]}" zar olarak anlaşılmadı. Örnek: 2d6+3`; return; } }
    s.lvl = +s.lvl || 0; s.rays = Math.max(1, +s.rays || 1);
    const done = F.onSave; const sp = { ...s, custom: s.custom ?? !s.k }; F = null; drawForm(); done(sp);
  }

  /* ---------------- Rehber ---------------- */
  function guide() {
    let ov = $("#zbGuideOv"); if (ov) { ov.remove(); return; }
    ov = document.createElement("div"); ov.id = "zbGuideOv"; ov.className = "joinov zw-ov zb-ov";
    ov.innerHTML = `<div class="zw" role="dialog" aria-modal="true" aria-label="Büyü kitabı rehberi" style="width:min(720px,100%)"><header class="zw-h"><h2>Büyü kitabı nasıl kullanılır?</h2><span style="flex:1"></span><button class="btn sm" data-zbg="close" aria-label="Kapat">×</button></header>
      <div class="zw-b">
        <p><b>Hileler (cantrip)</b> sınırsızdır: <b>Yap</b> düğmesi yuva harcamadan zarı atar. Hasarları 5., 11. ve 17. seviyede kendiliğinden büyür.</p>
        <p><b>Seviyeli büyüler</b> bir <b>büyü yuvası</b> harcar. Her büyünün yanında, yapabileceğin yuva seviyeleri ve kaç yuvan kaldığı görünür. Daha yüksek bir yuva seçersen büyü güçlenir (örneğin Ateş Topu her üst seviyede +1d6). Düğmeye bir kez basmak yuvayı düşer ve zarları atar.</p>
        <p><b>Saldırı büyüleri</b> önce d20 + büyü saldırısı bonusunu atar; 20 gelirse hasar zarları iki kat atılır. <b>Kurtarma büyülerinde</b> hedef zar atar, sana Kurtarma ZK'si gösterilir; sen hasarı atarsın. İyileştirme büyüleri iyileşen can miktarını atar.</p>
        <p><b>K</b> konsantrasyon demektir: aynı anda yalnızca bir tanesi sürer. Yeni bir konsantrasyon büyüsü öncekini bitirir; hasar alınca DAY kurtarması yaparsın. <b>R</b> ritüel demektir: 10 dakika daha uzun sürer ama yuva harcamaz.</p>
        <p><b>Hazırlayan sınıflar</b> (Rahip, Druid, Paladin, Büyücü) bildikleri listeden her gün bir kısmını hazırlar; yalnızca hazırlanmış büyüleri yapabilirler. İşaret kutusuyla hazırla.</p>
        <p>Yuvalar <b>Uzun dinlenme</b> ile dolar. Cadının pakt yuvaları <b>Kısa dinlenme</b> ile dolar.</p>
        ${'<aside class="zw-learn"><b>Homebrew:</b> Listede olmayan bir büyü için <b>+ Büyü ekle → Kendi büyünü yaz</b>. Zarını, hasar türünü ve üst seviye artışını yazarsan düğme onu da doğru atar. Herhangi bir büyüyü açıp <b>Düzenle</b> ile değiştirebilirsin.</aside>'}
      </div><footer class="zw-f"><span style="flex:1"></span><button class="btn pri" data-zbg="close">Anladım</button></footer></div>`;
    document.body.appendChild(ov);
  }

  /* ---------------- Olaylar ---------------- */
  const cur = () => S.chars[S.charId];
  const findSp = (c, id) => (c.book || []).find(s => s.id === id);
  function addToBook(c, sp) {
    c.book = c.book || [];
    if (sp.k && c.book.some(s => s.k === sp.k)) return false;
    if (isPrepCls(c) && sp.lvl) { const pm = prepMax(c); sp.prep = c.book.filter(s => s.lvl && s.prep).length < pm; }
    c.book.push(sp); c.book.sort((a, b) => a.lvl - b.lvl || a.n.localeCompare(b.n, "tr"));
    save("chars", c, ["book"]); return true;
  }

  document.addEventListener("click", e => {
    const g = e.target.closest("[data-zbg]"); if (g) { $("#zbGuideOv")?.remove(); return; }
    const fb = e.target.closest("[data-zbf-act]");
    if (fb && F) { const a = fb.dataset.zbfAct; if (a === "close") { F = null; drawForm(); } else if (a === "save") formSave(); else if (a === "kind") { F.sp.kind = fb.dataset.v; drawForm(); } return; }
    const pb = e.target.closest("[data-zbp]");
    if (pb && P) {
      const a = pb.dataset.zbp;
      if (a === "close") { const done = P.onClose; P = null; drawPicker(); done?.(); }
      else if (a === "lvl") { P.lvl = pb.dataset.v; drawPicker(); }
      else if (a === "pick") { P.onPick(pb.dataset.k); drawPicker(); }
      else if (a === "custom") { const p = P; form(null, sp => { p.onCustom(sp); drawPicker(); }); }
      return;
    }
    const b = e.target.closest("[data-zb]"); if (!b) return;
    const c = cur(); if (!c) return;
    const a = b.dataset.zb, s = b.dataset.id && findSp(c, b.dataset.id);
    switch (a) {
      case "cast": if (s) cast(c, s, +b.dataset.l, !!b.dataset.rit); return;
      case "info": if (open.has(b.dataset.id)) open.delete(b.dataset.id); else open.add(b.dataset.id); render(); return;
      case "guide": guide(); return;
      case "endconc": c.conc = ""; save("chars", c, ["conc"]); render(); return;
      case "short": (c.slots || []).forEach(sl => sl.used = 0); save("chars", c, ["slots"]); toast("Pakt yuvaları doldu"); render(); return;
      case "del": if (s) { c.book = c.book.filter(x => x !== s); open.delete(s.id); save("chars", c, ["book"]); render(); } return;
      case "edit": if (s) form(s, sp => { Object.assign(s, sp); save("chars", c, ["book"]); render(); }, true); return;
      case "add": {
        const k = clsOf(c), id = c.id;
        picker({
          code: k?.code || "", title: `${c.name || "Karakter"} · büyü ekle`,
          picked: kk => !!(S.chars[id]?.book || []).some(x => x.k === kk),
          onPick: kk => { const ch = S.chars[id]; if (!ch) return; const ex = (ch.book || []).find(x => x.k === kk); if (ex) { ch.book = ch.book.filter(x => x !== ex); save("chars", ch, ["book"]); } else addToBook(ch, fromSrd(kk)); render(); },
          onCustom: sp => { const ch = S.chars[id]; if (ch) { addToBook(ch, { ...sp, id: uid("sp") }); render(); } },
        });
        return;
      }
    }
  }, true);
  document.addEventListener("change", e => {
    const el = e.target;
    if (el.dataset?.zb === "prep") { const c = cur(), s = c && findSp(c, el.dataset.id); if (!s) return; s.prep = el.checked; save("chars", c, ["book"]); const pm = prepMax(c), n = c.book.filter(x => x.lvl && x.prep).length; if (pm != null && n > pm) toast(`Hazırlayabileceğin büyü sayısını (${pm}) aştın`); render(); return; }
    if (F && el.dataset?.zbf) { const k = el.dataset.zbf; F.sp[k] = el.type === "checkbox" ? el.checked : el.value; if (k === "lvl") F.sp.lvl = +el.value; return; }
    if (P && el.hasAttribute?.("data-zbp-code")) { P.code = el.value; drawPicker(); }
  });
  document.addEventListener("input", e => {
    const el = e.target;
    if (F && el.dataset?.zbf && el.type !== "checkbox") F.sp[el.dataset.zbf] = el.value;
    if (P && el.hasAttribute?.("data-zbp-q")) { P.q = el.value; drawPicker(); }
  });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (F) { F = null; drawForm(); e.stopImmediatePropagation(); } else if (P) { const done = P.onClose; P = null; drawPicker(); done?.(); e.stopImmediatePropagation(); } else if ($("#zbGuideOv")) $("#zbGuideOv").remove();
  }, true);

  // Konsantrasyon hatırlatması ve uzun dinlenme.
  document.addEventListener("click", e => {
    const b = e.target.closest('#main [data-act="dmg"], #main [data-act="longrest"]'); if (!b || sysKey() !== "dnd5e") return;
    const c = cur(); if (!c || !c.conc) return;
    if (b.dataset.act === "longrest") { c.conc = ""; save("chars", c, ["conc"]); return; }
    const amt = +($("#hpAmt")?.value || 0);
    if (amt > 0) setTimeout(() => toast(`${c.conc} için konsantrasyon: DAY kurtarması, ZK ${Math.max(10, Math.floor(amt / 2))}`), 50);
  }, true);

  /* ---------------- Kağıda yerleştir ---------------- */
  const _render = window.render;
  window.render = function () {
    const r = _render.apply(this, arguments);
    try {
      if (G.id && S.view === "karakterler" && sysKey() === "dnd5e" && $("#main .sheet")) {
        const c = cur(), sp = $$("#main .panel").find(p => (p.querySelector("h3")?.textContent || "").startsWith("Büyücülük"));
        if (c && sp && !$("#zbBook")) sp.insertAdjacentHTML("afterend", bookHtml(c));
        const notes = $$("#main .panel h3").find(h => h.textContent === "Büyü Listesi"); if (notes) notes.textContent = "Büyü Notları";
      }
    } catch (err) { console.error(err); }
    return r;
  };

  window.ZMB = { picker, form, fromSrd, addToBook, clsOf, prepMax, diceFor };
})();
