/* Masaüstü eklentileri (5): Call of Cthulhu ve Year Zero için karakter gelişimi.
   CoC 7e: oturum sonunda işaretli becerilerin gelişim aşaması (d100 > değer ise +1d10) ve isteğe bağlı şans iyileşmesi.
   Year Zero: oturum sonu tecrübe puanı (TP) soruları ve TP harcayarak beceri/yetenek alma. */
(function () {
  "use strict";

  const cur = () => S.chars[S.charId];
  const learn = t => `<aside class="zw-learn"><b>Ne işe yarar?</b> ${t}</aside>`;
  const NO_IMP = ["Cthulhu Mitosu", "Kredi Notu"];
  let X = null; // açık sihirbazın durumu

  function overlay(id, title, body, foot) {
    let ov = $("#" + id);
    if (!ov) { ov = document.createElement("div"); ov.id = id; ov.className = "joinov zw-ov"; document.body.appendChild(ov); }
    const y = $(".zw-b", ov)?.scrollTop || 0;
    ov.innerHTML = `<div class="zw" role="dialog" aria-modal="true" aria-label="${esc(title)}" style="width:min(820px,100%)"><header class="zw-h"><h2>${esc(title)}</h2><span style="flex:1"></span><button class="btn sm" data-zx="close" aria-label="Kapat">×</button></header>
      <div class="zw-b">${body}</div><footer class="zw-f">${foot}</footer></div>`;
    $(".zw-b", ov).scrollTop = y;
  }
  const close = () => { X = null; $$("#zxOv,#zxGuide").forEach(e => e.remove()); };
  function info(label, total, detail) { pushRoll({ id: uid("l"), t: Date.now(), label, expr: "", total, detail, crit: null }); }
  function roll(expr, label) { const r = parseRoll(expr); pushRoll({ id: uid("l"), t: Date.now(), label, expr, total: r.total, detail: r.detail, crit: null }); return r.total; }

  /* ================= Call of Cthulhu ================= */
  function cocStart() {
    const c = cur(); if (!c) return;
    const list = (c.skills || []).map((s, i) => ({ i, n: s.n, val: +s.val || 0, tick: !!s.tick })).filter(s => s.tick && !NO_IMP.includes(s.n));
    X = { sys: "coc", list, luck: false, luckRes: null, done: false };
    cocDraw();
  }
  function cocDraw() {
    const c = cur(), L = X.list;
    const rows = L.map((s, k) => `<div class="zx-row"><b>${esc(s.n)}</b><span class="num">${s.val}%</span>
      <span>${s.roll == null ? `<button type="button" class="btn sm" data-zx="coc1" data-v="${k}">d100 at</button>` : `<span class="num">${s.roll}</span> ${s.gain ? `<b class="zx-ok">> ${s.val}: +${s.gain} → ${Math.min(99, s.val + s.gain)}%</b>` : `<span class="zx-no">≤ ${s.val}: gelişmedi</span>`}`}</span></div>`).join("");
    const all = L.every(s => s.roll != null) && (!X.luck || X.luckRes);
    overlay("zxOv", "Gelişim aşaması",
      `<p>Bir senaryonun ya da önemli bir bölümün sonunda yapılır. Oyun sırasında <b>başarıyla kullandığın</b> becerilerin yanına bir işaret konur (kağıttaki kutu). Şimdi her işaretli beceri için d100 atarsın: sonuç becerinin değerinden <b>büyükse</b> (ya da 95'ten büyükse) beceri <b>1d10</b> gelişir. Zaten iyi olduğun şeyde gelişmek zordur.</p>
      ${L.length ? `<div class="zx-list">${rows}</div>` : `<p class="zb-none">İşaretli beceri yok. Oyun sırasında başarılı olduğun becerilerin kutusunu işaretle (kağıtta "At" ile başarılı olunca kendiliğinden işaretlenir). Cthulhu Mitosu ve Kredi Notu bu yolla gelişmez.</p>`}
      <label class="toggle" style="margin:10px 0"><input type="checkbox" data-zx="luck" ${X.luck ? "checked" : ""}> Şans iyileşmesi (isteğe bağlı kural): d100 > Şans (${+c.luck || 0}) ise +1d10 Şans</label>
      ${X.luckRes ? `<p>Şans: <span class="num">${X.luckRes.roll}</span> ${X.luckRes.gain ? `<b class="zx-ok">+${X.luckRes.gain}</b>` : `<span class="zx-no">artmadı</span>`}</p>` : ""}
      ${learn("Bir beceri 90'a ya da üstüne çıkarsa araştırmacı ustalığından güç alır: 2d6 akıl sağlığı kazanır (bunu da otomatik ekliyorum). Uygula'ya basınca değerler güncellenir ve işaretler temizlenir.")}`,
      `<button class="btn" data-zx="close">Vazgeç</button><span class="zw-why"></span>${L.some(s => s.roll == null) || (X.luck && !X.luckRes) ? `<button class="btn" data-zx="cocall">Hepsini at</button>` : ""}<button class="btn pri" data-zx="cocapply" ${all ? "" : "disabled"}>Uygula</button>`);
  }
  function coc1(k) {
    const c = cur(), s = X.list[k]; if (s.roll != null) return;
    s.roll = roll("1d100", `${c.name} · ${s.n} gelişim (${s.val}%)`);
    s.gain = s.roll > s.val || s.roll > 95 ? roll("1d10", `${c.name} · ${s.n} +1d10`) : 0;
  }
  function cocLuck() { const c = cur(); if (!X.luck || X.luckRes) return; const r = roll("1d100", `${c.name} · Şans iyileşmesi (${+c.luck || 0})`); X.luckRes = { roll: r, gain: r > (+c.luck || 0) ? roll("1d10", `${c.name} · Şans +1d10`) : 0 }; }
  function cocApply() {
    const c = cur(), paths = ["skills"], up = [];
    let san = 0;
    X.list.forEach(s => { const sk = c.skills[s.i]; if (!sk) return; if (s.gain) { const was = +sk.val || 0; sk.val = Math.min(99, was + s.gain); up.push(`${sk.n} ${was}→${sk.val}`); if (was < 90 && sk.val >= 90) san += roll("2d6", `${c.name} · ${sk.n} ustalığı: akıl sağlığı`); } });
    (c.skills || []).forEach(sk => sk.tick = false);
    if (X.luckRes?.gain) { c.luck = Math.min(99, (+c.luck || 0) + X.luckRes.gain); paths.push("luck"); }
    if (san) { c.san = (+c.san || 0) + san; paths.push("san"); }
    save("chars", c, paths);
    info(`${c.name} · gelişim aşaması`, up.length, up.join(", ") || "Bu kez gelişen beceri yok");
    close(); render(); toast(up.length ? `${up.length} beceri gelişti` : "Gelişen beceri yok; işaretler temizlendi");
  }

  /* ================= Year Zero ================= */
  // Varsayılan maliyetler (şablona göre). mul: maliyet × yeni seviye.
  const YZ_COST = { alien: { skill: 5, talent: 5 }, mutant: { skill: 5, talent: 5 }, vaesen: { skill: 5, talent: 5 }, forbidden: { skill: 5, talent: 3, mul: true } };
  const YZ_Q = ["Oturuma katıldın", "Bir tehlikeyle ya da düşmanla yüzleştin", "Yeni bir yer, sır ya da bilgi keşfettin", "Bir başkası için kendini riske attın", "Kişisel hedefine, ilişkilerine ya da gündemine göre davrandın", "Büyük bir şey başardın ya da bir bedel ödedin"];
  const cost = c => ({ ...(YZ_COST[c.preset] || YZ_COST.alien), ...(c.xpCost || {}) });
  const skCost = (c, s) => { const k = cost(c); return k.mul ? k.skill * ((+s.val || 0) + 1) : k.skill; };
  const talCost = c => { const k = cost(c); return k.mul ? k.talent : k.talent; };

  function yzeSession() { X = { sys: "yzeq", q: [] }; yzeQDraw(); }
  function yzeQDraw() {
    overlay("zxOv", "Oturum sonu: tecrübe puanı",
      `<p>Her oturumun sonunda grup birlikte bu sorulara bakar. Her "evet" için <b>1 tecrübe puanı (TP)</b> kazanırsın. Oyununun kitabında farklı sorular varsa onları kullan; bu liste genel bir rehberdir.</p>
      <div class="zx-q">${YZ_Q.map((q, i) => `<label class="toggle"><input type="checkbox" data-zx="q" data-v="${i}" ${X.q.includes(i) ? "checked" : ""}> ${q}</label>`).join("")}</div>
      ${learn("TP biriktirirsin ve istediğin zaman (genellikle oturumlar arasında) yeni beceri seviyeleri ya da yetenekler almak için harcarsın.")}`,
      `<button class="btn" data-zx="close">Vazgeç</button><span class="zw-why"></span><button class="btn pri" data-zx="qapply">+${X.q.length} TP ekle</button>`);
  }
  function yzeSpend() { X = { sys: "yze", talent: "", note: "" }; yzeDraw(); }
  function yzeDraw() {
    const c = cur(), xp = +c.xp || 0, k = cost(c), attrs = c.attrs || [];
    overlay("zxOv", "TP harca",
      `<p>Elinde <b class="num">${xp} TP</b> var. Bir beceriyi bir seviye artırmak ${k.mul ? `<b>${k.skill} × yeni seviye</b>` : `<b>${k.skill} TP</b>`}, yeni bir yetenek ${k.mul ? `ya da yetenek rütbesi <b>${k.talent} × yeni rütbe</b>` : `<b>${k.talent} TP</b>`} tutar. Beceriler en çok 5 olur.</p>
      <div class="zx-list">${(c.skills || []).map((s, i) => { const cs = skCost(c, s), v = +s.val || 0; return `<div class="zx-row"><b>${esc(s.name)}</b><small class="zb-none">${esc(ab3(attrs[+s.attr]?.name || ""))}</small><span class="num">${v}${v < 5 ? ` → ${v + 1}` : ""}</span>
        <button type="button" class="btn sm" data-zx="buysk" data-v="${i}" ${v >= 5 || xp < cs ? "disabled" : ""}>${v >= 5 ? "En yüksek" : `${cs} TP`}</button></div>`; }).join("")}</div>
      <div class="zw-gh"><b>Yeni yetenek</b></div>
      <div class="zb-fgrid"><label class="zw-field"><span class="lbl">Yetenek adı</span><input class="f" data-zx-in="talent" value="${esc(X.talent)}" placeholder="örn. Soğukkanlı ya da Yay Ustası 2"></label>
        <label class="zw-field"><span class="lbl">Ne yapıyor? (isteğe bağlı)</span><input class="f" data-zx-in="note" value="${esc(X.note)}" placeholder="kısa kural"></label></div>
      <button type="button" class="btn sm" data-zx="buytal" ${xp < talCost(c) ? "disabled" : ""}>Yeteneği al (${talCost(c)} TP${k.mul ? " × rütbe" : ""})</button>
      <details class="zx-cost"><summary>Maliyetleri değiştir (homebrew ya da farklı bir YZE oyunu)</summary>
        <div class="zb-fgrid"><label class="zw-field"><span class="lbl">Beceri +1</span><input class="f num" type="number" min="0" data-zx-cost="skill" value="${k.skill}"></label><label class="zw-field"><span class="lbl">Yetenek</span><input class="f num" type="number" min="0" data-zx-cost="talent" value="${k.talent}"></label>
        <label class="toggle"><input type="checkbox" data-zx-cost="mul" ${k.mul ? "checked" : ""}> Maliyet × yeni seviye (Forbidden Lands gibi)</label></div></details>`,
      `<span class="zw-why"></span><button class="btn pri" data-zx="close">Bitti</button>`);
  }
  function buySkill(i) {
    const c = cur(), s = c.skills[i], cs = skCost(c, s); if (!s || (+s.val || 0) >= 5 || (+c.xp || 0) < cs) return;
    s.val = (+s.val || 0) + 1; c.xp = (+c.xp || 0) - cs; save("chars", c, ["skills", "xp"]);
    info(`${c.name} · ${s.name} ${s.val}`, -cs, `${cs} TP harcandı · kalan ${c.xp}`); render(); yzeDraw();
  }
  function buyTalent() {
    const c = cur(), n = X.talent.trim(); if (!n) { toast("Yeteneğin adını yaz"); return; }
    const rank = +((/(\d+)\s*$/.exec(n) || [])[1] || 1), k = cost(c), cs = k.mul ? k.talent * rank : k.talent;
    if ((+c.xp || 0) < cs) { toast(`${cs} TP gerekiyor`); return; }
    c.xp = (+c.xp || 0) - cs; c.talents = `${c.talents ? c.talents.trimEnd() + "\n" : ""}• ${n}${X.note.trim() ? ": " + X.note.trim() : ""}`;
    save("chars", c, ["talents", "xp"]); info(`${c.name} · yetenek: ${n}`, -cs, `${cs} TP harcandı · kalan ${c.xp}`);
    X.talent = ""; X.note = ""; render(); yzeDraw();
  }

  /* ================= Rehber ================= */
  function guide() {
    const coc = sysKey() === "coc7";
    let ov = $("#zxGuide"); if (ov) { ov.remove(); return; }
    ov = document.createElement("div"); ov.id = "zxGuide"; ov.className = "joinov zw-ov zb-ov";
    ov.innerHTML = `<div class="zw" role="dialog" aria-modal="true" aria-label="Gelişim rehberi" style="width:min(720px,100%)"><header class="zw-h"><h2>Karakterin nasıl gelişir?</h2><span style="flex:1"></span><button class="btn sm" data-zx="gclose" aria-label="Kapat">×</button></header><div class="zw-b">
      ${coc ? `<p>Call of Cthulhu'da seviye yoktur; araştırmacın <b>kullandığı becerilerde</b> gelişir.</p>
        <ol class="zw-list"><li>Oyun sırasında bir beceride başarılı olunca yanındaki kutu işaretlenir (kağıttaki "At" düğmesi bunu kendiliğinden yapar).</li><li>Senaryonun sonunda Gardiyan "gelişim aşaması" der. <b>Gelişim aşaması</b> düğmesine bas.</li><li>Her işaretli beceri için d100 atılır. Sonuç beceriden büyükse (ya da 95'ten büyükse) beceri 1d10 artar.</li><li>90'a ulaşan beceri için 2d6 akıl sağlığı kazanırsın. Sonunda işaretler temizlenir.</li></ol>
        <p>Cthulhu Mitosu ve Kredi Notu bu yolla gelişmez. Bazı masalar oturum sonunda şansı da iyileştirir; bunu sihirbazda isteğe bağlı açabilirsin.</p>`
      : `<p>Year Zero oyunlarında seviye yoktur; <b>tecrübe puanı (TP)</b> biriktirip harcarsın.</p>
        <ol class="zw-list"><li>Her oturumun sonunda <b>Oturum sonu TP</b> düğmesine bas; grup soruları birlikte cevaplar, her "evet" 1 TP.</li><li>TP'lerini <b>TP harca</b> ile beceri seviyesi (en çok 5) ya da yeni yetenek almak için kullan.</li><li>Maliyet oyuna göre değişir: Alien, Mutant ve Vaesen'de genellikle 5 TP; Forbidden Lands'te beceri için 5 × yeni seviye, yetenek için 3 × yeni rütbe. Masanızın kuralı farklıysa "Maliyetleri değiştir" ile ayarla.</li></ol>`}
      </div><footer class="zw-f"><span style="flex:1"></span><button class="btn pri" data-zx="gclose">Anladım</button></footer></div>`;
    document.body.appendChild(ov);
  }

  /* ================= Olaylar ================= */
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-zx]"); if (!b) return;
    const a = b.dataset.zx, v = b.dataset.v;
    switch (a) {
      case "close": close(); return;
      case "gclose": $("#zxGuide")?.remove(); return;
      case "guide": guide(); return;
      case "cocstart": cocStart(); return;
      case "coc1": coc1(+v); cocDraw(); return;
      case "cocall": X.list.forEach((_, k) => coc1(k)); cocLuck(); cocDraw(); return;
      case "cocapply": cocApply(); return;
      case "yzeq": yzeSession(); return;
      case "yzespend": yzeSpend(); return;
      case "qapply": { const c = cur(); c.xp = (+c.xp || 0) + X.q.length; save("chars", c, ["xp"]); info(`${c.name} · oturum sonu`, "+" + X.q.length, `${X.q.length} TP · toplam ${c.xp}`); close(); render(); return; }
      case "buysk": buySkill(+v); return;
      case "buytal": buyTalent(); return;
    }
  });
  document.addEventListener("change", e => {
    const el = e.target; if (!X) return;
    if (el.dataset.zx === "luck") { X.luck = el.checked; if (!X.luck) X.luckRes = null; cocDraw(); }
    else if (el.dataset.zx === "q") { const i = +el.dataset.v; X.q = el.checked ? [...X.q, i] : X.q.filter(x => x !== i); yzeQDraw(); }
    else if (el.dataset.zxCost) { const c = cur(), k = el.dataset.zxCost; c.xpCost = { ...(c.xpCost || {}), [k]: el.type === "checkbox" ? el.checked : Math.max(0, +el.value || 0) }; save("chars", c, ["xpCost"]); yzeDraw(); }
  });
  document.addEventListener("input", e => { const el = e.target; if (X && el.dataset.zxIn) X[el.dataset.zxIn] = el.value; });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && (X || $("#zxGuide"))) close(); });

  /* ================= Kağıda yerleştir ================= */
  const _render = window.render;
  window.render = function () {
    const r = _render.apply(this, arguments);
    try {
      const k = sysKey(), c = cur();
      if (G.id && S.view === "karakterler" && c && $("#main .sheet") && !$("#zxBar")) {
        if (k === "coc7") {
          const sk = $$("#main .panel").find(p => (p.querySelector("h3")?.textContent || "").startsWith("Beceriler"));
          const n = (c.skills || []).filter(s => s.tick && !NO_IMP.includes(s.n)).length;
          sk?.insertAdjacentHTML("beforebegin", `<div class="panel zg" id="zxBar"><span class="lbl">Gelişim</span><span class="zg-next">İşaretli beceri: <b class="num">${n}</b></span><span class="sp"></span><button type="button" class="btn sm" data-zx="guide">Nasıl gelişir?</button><button type="button" class="btn sm ${n ? "pri" : ""}" data-zx="cocstart">Gelişim aşaması</button></div>`);
        } else if (k === "yze") {
          const id = $("#main .cname")?.closest(".panel");
          id?.insertAdjacentHTML("afterend", `<div class="panel zg" id="zxBar"><span class="lbl">Tecrübe</span><span class="zg-next"><b class="num">${+c.xp || 0}</b> TP</span><span class="sp"></span><button type="button" class="btn sm" data-zx="guide">Nasıl gelişir?</button><button type="button" class="btn sm" data-zx="yzeq">Oturum sonu TP</button><button type="button" class="btn sm pri" data-zx="yzespend">TP harca</button></div>`);
        }
      }
    } catch (err) { console.error(err); }
    return r;
  };
})();
