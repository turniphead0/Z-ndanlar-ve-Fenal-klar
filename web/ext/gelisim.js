/* Masaüstü eklentileri (4): D&D 5e karakter gelişimi.
   Kağıda deneyim (XP) çubuğu ve "Seviye atla" düğmesi ekler. Seviye atlama sihirbazı can puanını,
   yetenek artışını, yeni özellikleri, alt sınıfı, büyü yuvalarını ve yeni büyüleri adım adım günceller. */
(function () {
  "use strict";

  const D = window.ZM5E;
  let U = null;
  const cur = () => S.chars[S.charId];
  const short = n => String(n || "").split(" (")[0];

  /* ---------------- Hesaplar ---------------- */
  const clsOf = c => window.ZMB.clsOf(c);
  function info(c) {
    const k = U?.cls || clsOf(c);
    const L = Math.max(1, Math.min(20, +c.level || 1)), N = Math.min(20, L + 1);
    const hd = +(k?.hd || U?.hd || 8), con = mod(c.ab?.con);
    const dwarf = /tepe cücesi|hill dwarf/i.test(c.race || "") ? 1 : 0;
    const kind = k?.kind || null;
    const oldS = kind ? D.slotsFor(kind, L) : null, newS = kind ? D.slotsFor(kind, N) : null;
    const maxLvl = newS ? newS.reduce((m, v, i) => v ? i + 1 : m, 0) : 0;
    const ck = k && D.CLASSES.includes(k) ? k : null;
    const known = ck && D.KNOWN[ck.k] ? D.KNOWN[ck.k][N - 1] - D.KNOWN[ck.k][L - 1] : ck?.book ? 2 : 0;
    const cant = ck ? D.cantripsAt(ck, N) - D.cantripsAt(ck, L) : 0;
    return { k, ck, L, N, hd, con, dwarf, kind, oldS, newS, maxLvl, known, cant, avg: Math.floor(hd / 2) + 1,
      asi: D.asiAt(ck, N), sub: ck && ck.sub === N, feat: ck ? D.FEAT[ck.k][N] || "" : "", pb: profB(N) - profB(L) };
  }
  const nextXp = L => L >= 20 ? null : D.XP[L];

  /* ---------------- Gelişim çubuğu ---------------- */
  function barHtml(c) {
    const L = +c.level || 1, xp = +c.xp || 0, nx = nextXp(L), prev = D.XP[L - 1] || 0;
    const pct = nx ? Math.max(0, Math.min(100, (xp - prev) / (nx - prev) * 100)) : 100;
    const ready = nx != null && xp >= nx;
    return `<div class="panel zg" id="zgBar"><span class="lbl">Deneyim</span>
      <label class="zg-xp"><input class="f num" type="number" min="0" data-k="xp" value="${esc(c.xp ?? 0)}" aria-label="Deneyim puanı"><span>XP</span></label>
      <div class="zg-track" title="${nx ? `${L + 1}. seviye için ${nx} XP` : "En yüksek seviye"}"><i class="${ready ? "ok" : ""}" style="width:${pct}%"></i></div>
      <span class="zg-next" data-zg-next>${nx ? ready ? `<b>${L + 1}. seviyeye hazır!</b>` : `${L + 1}. seviye: <b class="num">${nx}</b> XP (${nx - xp} kaldı)` : "20. seviye"}</span>
      <span class="sp"></span>
      <button type="button" class="btn sm" data-zg="guide">Nasıl gelişir?</button>
      ${L < 20 ? `<button type="button" class="btn sm ${ready ? "pri" : ""}" data-zg="up">Seviye atla</button>` : ""}</div>`;
  }

  /* ---------------- Seviye atlama sihirbazı ---------------- */
  function steps() {
    const c = cur(), i = info(c), out = ["Yeni seviye", "Can puanı"];
    if (i.asi) out.push("Yetenek artışı");
    out.push("Özellikler");
    if (i.kind || i.cant || i.known) out.push("Büyüler");
    out.push("Özet");
    return out;
  }
  const learn = t => `<aside class="zw-learn"><b>Ne işe yarar?</b> ${t}</aside>`;
  const abTotal = () => Object.values(U.asiPick).reduce((a, v) => a + v, 0);
  const gain = i => Math.max(1, (U.hpMode === "roll" && U.hpRoll != null ? U.hpRoll : i.avg) + i.con + i.dwarf);

  function stepHtml() {
    const c = cur(), i = info(c), name = steps()[U.step];
    if (name === "Yeni seviye") {
      const needCls = !i.k;
      return `<h3>${esc(c.name)}: ${i.L}. seviyeden ${i.N}. seviyeye</h3>
      <p>Seviye atlamak, karakterinin maceralarda öğrendiklerini kağıda yansıtmaktır. DM'in ya <b>deneyim puanı (XP)</b> verir ya da önemli bir hikâye anında "seviye atladınız" der (<i>milestone</i>). İkisinde de bu sihirbaz aynı adımları izler.</p>
      ${needCls ? `<div class="zw-custom"><p><b>Sınıfını bulamadım.</b> Kağıttaki sınıf: "${esc(c.cls || "boş")}". Hangisi olduğunu seç; kendi sınıfınsa can zarını yaz.</p>
        <div class="zb-fgrid"><label class="zw-field"><span class="lbl">Sınıf</span><select class="f" data-zgu="clsKey"><option value="">Kendi sınıfım (homebrew)</option>${D.CLASSES.map(x => `<option value="${x.k}">${x.n}</option>`).join("")}</select></label>
        <label class="zw-field"><span class="lbl">Can zarı</span><select class="f" data-zgu="hd">${[6, 8, 10, 12].map(v => `<option value="${v}" ${+U.hd === v ? "selected" : ""}>d${v}</option>`).join("")}</select></label></div></div>` : ""}
      <p>Bu seviyede kazanacakların:</p>
      <ul class="zw-list">
        <li><b>Can puanı:</b> d${i.hd} zar ya da ortalama ${i.avg}, artı Dayanıklılık bonusu ${sgn(i.con)}${i.dwarf ? " ve cüce sağlamlığı +1" : ""}</li>
        ${i.pb ? `<li><b>Yeterlilik bonusu</b> ${sgn(profB(i.L))} → <b>${sgn(profB(i.N))}</b>: eğitimli olduğun her şey güçlenir</li>` : ""}
        ${i.asi ? `<li><b>Yetenek puanı artışı:</b> bir yeteneğe +2 ya da ikisine +1, veya bir özellik (feat)</li>` : ""}
        ${i.sub ? `<li><b>${esc(i.ck.subN)}:</b> alt sınıfını seçersin</li>` : ""}
        ${i.feat ? `<li><b>Sınıf özellikleri:</b> ${esc(i.feat)}</li>` : ""}
        ${i.kind ? `<li><b>Büyü yuvaları</b> güncellenir${i.maxLvl ? `; artık ${i.maxLvl}. seviyeye kadar büyü yapabilirsin` : ""}</li>` : ""}
        ${i.cant ? `<li><b>+${i.cant} hile</b> öğrenirsin</li>` : ""}${i.known ? `<li><b>+${i.known} büyü</b> öğrenirsin</li>` : ""}
      </ul>
      ${learn(`Seviye atladıktan sonra XP sıfırlanmaz; toplamı tutarsın. ${i.N < 20 ? `${i.N + 1}. seviye için toplam ${D.XP[i.N]} XP gerekir.` : ""}`)}`;
    }
    if (name === "Can puanı") return `<h3>Can puanını artır</h3>
      <p>Her seviyede can zarını (d${i.hd}) atarsın ya da güvenli seçenek olan ortalamayı (${i.avg}) alırsın. Üstüne Dayanıklılık bonusunu (${sgn(i.con)}) eklersin. En az 1 can kazanırsın.</p>
      <div class="zw-row"><span class="chips"><button type="button" class="chip" data-zgu-act="hp" data-v="avg" aria-pressed="${U.hpMode === "avg"}">Ortalama al (${i.avg})</button><button type="button" class="chip" data-zgu-act="hp" data-v="roll" aria-pressed="${U.hpMode === "roll"}">Zar at (d${i.hd})</button></span>
        ${U.hpMode === "roll" ? `<button type="button" class="btn sm pri" data-zgu-act="hproll" ${U.hpRoll != null ? "disabled" : ""}>${U.hpRoll != null ? `Atıldı: ${U.hpRoll}` : `d${i.hd} at`}</button>` : ""}</div>
      ${U.hpMode === "roll" && U.hpRoll == null ? "" : `<div class="zw-sum"><div><span class="lbl">Kazanılan can</span><b class="num">+${gain(i)}</b><small>${U.hpMode === "roll" ? U.hpRoll : i.avg} ${sgn(i.con)} DAY${i.dwarf ? " +1 cüce" : ""}</small></div><div><span class="lbl">Yeni azami can</span><b class="num">${(+c.hpMax || 0) + gain(i)}</b><small>Şu an ${c.hpMax}. Mevcut canın da aynı miktarda artar.</small></div></div>`}
      ${learn("Can zarlarını kısa dinlenmede iyileşmek için de harcarsın; her seviye bir can zarı daha demektir.")}`;
    if (name === "Yetenek artışı") return `<h3>Yetenek puanı artışı</h3>
      <p>Bu seviyede ya yeteneklerini artırırsın ya da bir <b>özellik (feat)</b> alırsın. Bir yetenek 20'yi geçemez.</p>
      <div class="zw-row"><span class="chips"><button type="button" class="chip" data-zgu-act="asi" data-v="ab" aria-pressed="${U.asi === "ab"}">Yetenek artışı (+2 dağıt)</button><button type="button" class="chip" data-zgu-act="asi" data-v="feat" aria-pressed="${U.asi === "feat"}">Özellik (feat) al</button></span></div>
      ${U.asi === "ab" ? `<p class="zw-left">Dağıtılacak: <b>${2 - abTotal()}</b></p><div class="zw-abil">${ABS.map(([k, nm]) => { const v = +c.ab?.[k] || 10, add = U.asiPick[k] || 0; return `<div class="zw-ab ${add ? "main" : ""}"><div class="zw-abh"><b>${nm}</b><span class="num">${v}${add ? ` → <b>${v + add}</b> (${sgn(mod(v + add))})` : ` (${sgn(mod(v))})`}</span></div>
        <span class="chips"><button type="button" class="btn sm" data-zgu-act="ab-" data-v="${k}" ${add ? "" : "disabled"} aria-label="${nm} azalt">−</button><button type="button" class="btn sm" data-zgu-act="ab+" data-v="${k}" ${abTotal() < 2 && v + add < 20 ? "" : "disabled"} aria-label="${nm} artır">+</button></span></div>`; }).join("")}</div>`
      : `<label class="zw-field" style="max-width:none"><span class="lbl">Özellik (feat)</span><input class="f" data-zgu="feat" value="${esc(U.feat)}" placeholder="örn. Grappler (SRD) ya da masanızın kendi özelliği"></label>
        <label class="zw-field" style="max-width:none"><span class="lbl">Ne yapıyor?</span><textarea class="f" rows="3" data-zgu="featD" placeholder="Özelliğin kuralını kısaca yaz">${esc(U.featD)}</textarea></label>`}
      ${learn("Ana yeteneğini (savaşçı için Güç ya da Çeviklik, büyücüler için büyü yeteneği) artırmak saldırı, hasar ve büyü ZK'ni yükseltir. Çift sayıya ulaştırmak bonusu bir artırır.")}`;
    if (name === "Özellikler") return `<h3>Yeni özellikler</h3>
      ${i.sub ? `<label class="zw-field" style="max-width:none"><span class="lbl">${esc(i.ck.subN)} (alt sınıf)</span><input class="f" data-zgu="sub" value="${esc(U.sub)}" placeholder="örn. ${esc(i.ck.subEx)}"></label><p class="zw-left">Alt sınıf, sınıfının hangi yolda uzmanlaşacağını belirler. SRD'de: ${esc(i.ck.subEx)}. Başka bir kitaptan ya da kendi uydurduğun bir alt sınıfı da yazabilirsin.</p>` : ""}
      <p>Aşağıdaki metin kağıdındaki <b>Özellikler ve Yetenekler</b> kutusuna eklenecek. ${i.ck ? "SRD'deki özellik adlarını yazdım; kitabındaki ayrıntıları ya da homebrew özelliklerini ekleyebilirsin." : "Bu seviyede kazandığın özellikleri yaz."}</p>
      <label class="zw-field" style="max-width:none"><span class="lbl">${i.N}. seviye özellikleri</span><textarea class="f" rows="4" data-zgu="text">${esc(U.text)}</textarea></label>
      ${i.pb ? `<label class="toggle" style="margin:6px 0"><input type="checkbox" data-zgu="atkUp" ${U.atkUp ? "checked" : ""}> Saldırılardaki bonusları yeni yeterlilik bonusuna göre ${sgn(i.pb)} güncelle</label>` : ""}
      ${learn("Özellikler, sınıfının sana verdiği yeni yeteneklerdir. Ne zaman kullanabildiklerini (günde kaç kez, hangi dinlenmede dolduğunu) kutuya not etmek oyunda işini kolaylaştırır.")}`;
    if (name === "Büyüler") {
      const code = i.ck?.code;
      const pool = D.SPELLS.filter(s => (!code || s.cls.includes(code)) && (s.lvl === 0 ? i.cant > 0 : s.lvl <= i.maxLvl && (i.known > 0 || i.ck?.prep)) && !(c.book || []).some(b => b.k === s.k));
      const pick = U.spells, nc = pick.filter(s => !s.lvl).length, nl = pick.filter(s => s.lvl).length;
      return `<h3>Büyüler</h3>
      ${i.kind ? `<p>Büyü yuvaların ${i.kind === "pact" ? "(pakt yuvaları, kısa dinlenmede dolar)" : ""}:</p><table class="zg-slots"><tr><th></th>${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => `<th>${l}</th>`).join("")}</tr>
        <tr><td>Önce</td>${i.oldS.map(v => `<td>${v || "–"}</td>`).join("")}</tr><tr><td><b>Sonra</b></td>${i.newS.map((v, j) => `<td class="${v > i.oldS[j] ? "up" : ""}">${v || "–"}</td>`).join("")}</tr></table>` : ""}
      <p>${i.cant ? `<b>${i.cant} yeni hile</b> ` : ""}${i.known ? `<b>${i.known} yeni büyü</b> ${i.ck?.book ? "(büyü kitabına yazarsın) " : ""}` : ""}${i.cant || i.known ? "seçebilirsin." : ""}
        ${i.ck?.prep && !i.ck.book ? `${esc(short(i.ck.n))} listesindeki her büyüyü bilir; artık <b>${i.maxLvl}. seviyeye kadar</b> büyü hazırlayabilirsin. İstediğin büyüleri kitaba ekle, kağıtta hazırla.` : ""}
        ${!i.ck ? "Kendi sınıfının yeni büyülerini ekleyebilirsin." : ""}</p>
      ${i.known && D.KNOWN[i.ck?.k] ? `<p class="zw-left">Bilinen büyülerinden birini de yenisiyle değiştirebilirsin: kağıttaki Büyü Kitabı'nda eskisini çıkarıp yenisini eklemen yeterli.</p>` : ""}
      <p class="zw-left">Seçilen: ${nc ? nc + " hile" : ""}${nc && nl ? ", " : ""}${nl ? nl + " büyü" : ""}${!nc && !nl ? "henüz yok" : ""}</p>
      <div class="zw-grid">${pool.map(s => `<button type="button" class="zw-card sm zw-spc" data-zgu-act="spell" data-v="${s.k}" aria-pressed="${pick.some(p => p.k === s.k)}"><b>${esc(s.n)}</b><small class="zw-tag">${s.lvl ? s.lvl + ". sv" : "Hile"} · ${esc(s.school)}${s.conc ? " · K" : ""}</small><span>${esc(s.d)}</span></button>`).join("")}
        ${pick.filter(s => s.custom).map(s => `<button type="button" class="zw-card sm zw-spc" data-zgu-act="spell" data-v="${s.id}" aria-pressed="true"><b>${esc(s.n)} <small class="zw-tag">özel</small></b><span>${esc(s.d || "")}</span></button>`).join("")}</div>
      <div class="zw-row"><button type="button" class="btn sm" data-zgu-act="cspell">+ Kendi büyünü yaz</button></div>`;
    }
    if (name === "Özet") {
      const g = gain(i);
      return `<h3>${esc(c.name)} ${i.N}. seviye oluyor</h3>
      <div class="zw-sum"><div><span class="lbl">Can puanı</span><b class="num">${(+c.hpMax || 0) + g}</b><small>+${g}</small></div><div><span class="lbl">Yeterlilik</span><b class="num">${sgn(profB(i.N))}</b><small>${i.pb ? "arttı" : "aynı"}</small></div><div><span class="lbl">Can zarları</span><b class="num">${i.N}d${i.hd}</b></div></div>
      <ul class="zw-list">${i.asi ? `<li>${U.asi === "ab" ? Object.entries(U.asiPick).filter(([, v]) => v).map(([k, v]) => `${ABN[k][1]} +${v}`).join(", ") || "Yetenek artışı seçilmedi" : `Özellik: ${esc(U.feat || "—")}`}</li>` : ""}
        ${U.sub ? `<li>${esc(i.ck?.subN || "Alt sınıf")}: ${esc(U.sub)}</li>` : ""}${U.text.trim() ? `<li>${esc(U.text.trim())}</li>` : ""}
        ${i.kind ? `<li>Büyü yuvaları: ${i.newS.map((v, j) => v ? `${j + 1}. sv ×${v}` : "").filter(Boolean).join(", ")}</li>` : ""}${U.spells.length ? `<li>Yeni büyüler: ${U.spells.map(s => esc(s.n)).join(", ")}</li>` : ""}</ul>
      ${learn("Uygula'ya basınca hepsi kağıda yazılır. Bir şey yanlış olursa kağıtta elle düzeltebilirsin.")}`;
    }
  }
  function valid() {
    const name = steps()[U.step];
    if (name === "Yetenek artışı") return U.asi === "ab" ? abTotal() === 2 : !!U.feat.trim();
    if (name === "Can puanı") return U.hpMode === "avg" || U.hpRoll != null;
    return true;
  }
  const why = () => ({ "Yetenek artışı": U.asi === "ab" ? "2 puanı dağıt." : "Özelliğin adını yaz.", "Can puanı": "Zarı at." })[steps()[U.step]] || "";

  function draw() {
    let ov = $("#zgOv");
    if (!U) { ov?.remove(); return; }
    if (!ov) { ov = document.createElement("div"); ov.id = "zgOv"; ov.className = "joinov zw-ov"; document.body.appendChild(ov); }
    const st = steps(), s = U.step, last = st.length - 1, ok = valid(), y = $("#zgBody")?.scrollTop || 0;
    ov.innerHTML = `<div class="zw" role="dialog" aria-modal="true" aria-label="Seviye atlama">
      <header class="zw-h"><h2>Seviye atla</h2><ol class="zw-steps">${st.map((n, i) => `<li class="${i === s ? "on" : i < s ? "done" : ""}"><span>${i + 1}</span>${n}</li>`).join("")}</ol><button class="btn sm" data-zgu-act="close" aria-label="Kapat">×</button></header>
      <div class="zw-b" id="zgBody">${stepHtml()}</div>
      <footer class="zw-f">${s ? `<button class="btn" data-zgu-act="prev">← Geri</button>` : `<button class="btn" data-zgu-act="close">Vazgeç</button>`}<span class="zw-why">${ok ? "" : esc(why())}</span>
        ${s === last ? `<button class="btn pri" data-zgu-act="apply">Uygula</button>` : `<button class="btn pri" data-zgu-act="next" ${ok ? "" : "disabled"}>İleri →</button>`}</footer></div>`;
    if (U.keepY) $("#zgBody").scrollTop = y;
    U.keepY = false;
  }
  function start() {
    const c = cur(); if (!c) return;
    if ((+c.level || 1) >= 20) { toast("Zaten 20. seviyedesin"); return; }
    U = { charId: c.id, step: 0, hpMode: "avg", hpRoll: null, asi: "ab", asiPick: {}, feat: "", featD: "", sub: "", spells: [], atkUp: true, text: "", hd: 8, cls: null };
    U.text = info(c).feat;
    draw();
  }

  function apply() {
    const c = cur(), i = info(c), paths = ["level", "hpMax", "hp", "hitDice", "features"];
    const g = gain(i);
    c.level = i.N; c.hpMax = (+c.hpMax || 0) + g; c.hp = (+c.hp || 0) + g;
    c.hitDice = `${i.N}d${i.hd}`;
    if (i.asi && U.asi === "ab") { Object.entries(U.asiPick).forEach(([k, v]) => { c.ab[k] = Math.min(20, (+c.ab[k] || 10) + v); }); paths.push("ab"); }
    const add = [];
    if (U.sub.trim()) { add.push(`${i.ck?.subN || "Alt sınıf"}: ${U.sub.trim()}`); c.sub = U.sub.trim(); paths.push("sub"); if (!(c.cls || "").includes(c.sub)) { c.cls = `${c.cls || short(i.ck?.n)} — ${c.sub}`; paths.push("cls"); } }
    if (U.text.trim()) add.push(U.text.trim());
    if (i.asi && U.asi === "feat") add.push(`Özellik (feat): ${U.feat.trim()}${U.featD.trim() ? " · " + U.featD.trim() : ""}`);
    if (i.asi && U.asi === "ab") add.push("Yetenek artışı: " + Object.entries(U.asiPick).filter(([, v]) => v).map(([k, v]) => `${ABN[k][2]} +${v}`).join(", "));
    if (add.length) c.features = `${c.features ? c.features.trimEnd() + "\n\n" : ""}${i.N}. seviye:\n${add.join("\n")}`;
    if (i.kind) { c.slots = i.newS.map((v, j) => ({ max: v, used: Math.min(+c.slots?.[j]?.used || 0, v) })); paths.push("slots"); }
    if (U.spells.length) { U.spells.forEach(s => window.ZMB.addToBook(c, { ...s, id: s.id || uid("sp") })); paths.push("book"); }
    if (U.atkUp && i.pb) { (c.attacks || []).forEach(a => { const m = /^\s*([+-]?\d+)\s*$/.exec(a.bonus || ""); if (m) a.bonus = sgn(+m[1] + i.pb); }); paths.push("attacks"); }
    if (i.ck && !c.clsKey) { c.clsKey = i.ck.k; paths.push("clsKey"); }
    if (!i.ck && !c.clsCustom) { c.clsCustom = { k: "custom", n: c.cls || "Kendi sınıfım", hd: i.hd, kind: null }; paths.push("clsCustom"); }
    save("chars", c, paths);
    pushRoll({ id: uid("l"), t: Date.now(), label: `${c.name} seviye atladı`, expr: "", total: i.N, detail: `+${g} can${i.asi && U.asi === "ab" ? " · yetenek artışı" : ""}${U.spells.length ? " · " + U.spells.length + " yeni büyü" : ""}`, crit: null });
    U = null; draw(); render(); toast(`${c.name} artık ${i.N}. seviye!`);
  }

  function guide() {
    let ov = $("#zgGuideOv"); if (ov) { ov.remove(); return; }
    ov = document.createElement("div"); ov.id = "zgGuideOv"; ov.className = "joinov zw-ov zb-ov";
    ov.innerHTML = `<div class="zw" role="dialog" aria-modal="true" aria-label="Gelişim rehberi" style="width:min(720px,100%)"><header class="zw-h"><h2>Karakterin nasıl gelişir?</h2><span style="flex:1"></span><button class="btn sm" data-zgg="close" aria-label="Kapat">×</button></header>
      <div class="zw-b">
        <p><b>Deneyim puanı (XP):</b> Canavar yendikçe, görev bitirdikçe DM sana XP verir. Toplamını <b>Deneyim</b> kutusuna yaz; çubuk bir sonraki seviyeye ne kadar kaldığını gösterir. Eşik geçilince <b>Seviye atla</b> düğmesi parlar.</p>
        <p><b>Kilometre taşı (milestone):</b> Birçok masa XP saymaz; DM hikâyede önemli bir an gelince "seviye atladınız" der. O zaman XP'ye bakmadan <b>Seviye atla</b>'ya basabilirsin.</p>
        <p><b>Seviye atlarken:</b></p>
        <ol class="zw-list"><li>Can zarını atar ya da ortalamayı alırsın; Dayanıklılık bonusunu eklersin.</li><li>4., 8., 12., 16. ve 19. seviyelerde (Savaşçı ve Haydut'ta birkaç kez daha) yetenek puanlarına +2 dağıtır ya da bir özellik (feat) alırsın.</li><li>Sınıfının o seviyedeki özelliklerini öğrenirsin; çoğu sınıf 3. seviyede alt sınıfını seçer.</li><li>Büyücülerin yuvaları artar, yeni büyüler öğrenirler.</li><li>Yeterlilik bonusu 5., 9., 13. ve 17. seviyede bir artar.</li></ol>
        <aside class="zw-learn"><b>Homebrew:</b> Masanızın kendi kuralları varsa sihirbazdaki metin kutularını değiştir; yetenek artışı yerine kendi özelliğinizi yazabilirsin.</aside>
      </div><footer class="zw-f"><span style="flex:1"></span><button class="btn pri" data-zgg="close">Anladım</button></footer></div>`;
    document.body.appendChild(ov);
  }

  /* ---------------- Olaylar ---------------- */
  document.addEventListener("click", e => {
    if (e.target.closest("[data-zgg]")) { $("#zgGuideOv")?.remove(); return; }
    const z = e.target.closest("[data-zg]");
    if (z) { if (z.dataset.zg === "up") start(); else if (z.dataset.zg === "guide") guide(); return; }
    const b = e.target.closest("[data-zgu-act]"); if (!b || !U) return;
    const a = b.dataset.zguAct, v = b.dataset.v, c = cur(), i = info(c);
    switch (a) {
      case "close": U = null; draw(); return;
      case "next": if (valid()) U.step++; break;
      case "prev": U.step = Math.max(0, U.step - 1); break;
      case "apply": apply(); return;
      case "hp": U.hpMode = v; break;
      case "hproll": { const r = parseRoll("1d" + i.hd); U.hpRoll = r.total; pushRoll({ id: uid("l"), t: Date.now(), label: `${c.name} · can zarı (seviye ${i.N})`, expr: "1d" + i.hd, total: r.total, detail: r.detail, crit: null }); break; }
      case "asi": U.asi = v; break;
      case "ab+": if (abTotal() < 2) U.asiPick[v] = (U.asiPick[v] || 0) + 1; break;
      case "ab-": U.asiPick[v] = Math.max(0, (U.asiPick[v] || 0) - 1); break;
      case "spell": {
        const ex = U.spells.find(s => s.k === v || s.id === v);
        if (ex) U.spells = U.spells.filter(s => s !== ex);
        else { const sp = window.ZMB.fromSrd(v); const lim = sp.lvl ? (i.known || (i.ck?.prep ? 99 : 0)) : i.cant; if (U.spells.filter(s => !!s.lvl === !!sp.lvl && !s.custom).length >= lim) { toast(`En fazla ${lim} ${sp.lvl ? "büyü" : "hile"} seçebilirsin`); return; } U.spells.push(sp); }
        break;
      }
      case "cspell": window.ZMB.form({ lvl: Math.max(1, i.maxLvl) }, sp => { U.spells.push({ ...sp, id: uid("sp"), custom: true }); U.keepY = true; draw(); }); return;
    }
    U.keepY = a !== "next" && a !== "prev"; draw();
  });
  document.addEventListener("input", e => {
    const el = e.target;
    if (el.dataset?.k === "xp" && el.closest("#zgBar")) {
      const c = cur(); if (!c) return; const L = +c.level || 1, nx = nextXp(L), xp = +el.value || 0, prev = D.XP[L - 1] || 0;
      const t = $("#zgBar .zg-track i"), n = $("[data-zg-next]"), up = $("#zgBar [data-zg=up]");
      if (t && nx) { t.style.width = Math.max(0, Math.min(100, (xp - prev) / (nx - prev) * 100)) + "%"; t.classList.toggle("ok", xp >= nx); }
      if (n && nx) n.innerHTML = xp >= nx ? `<b>${L + 1}. seviyeye hazır!</b>` : `${L + 1}. seviye: <b class="num">${nx}</b> XP (${nx - xp} kaldı)`;
      if (up && nx) up.classList.toggle("pri", xp >= nx);
      return;
    }
    if (!U || !el.dataset?.zgu) return;
    const k = el.dataset.zgu;
    if (k === "clsKey") { U.cls = D.CLASSES.find(x => x.k === el.value) || null; U.text = info(cur()).feat; U.keepY = true; draw(); return; }
    if (k === "hd") { U.hd = +el.value; U.keepY = true; draw(); return; }
    U[k] = el.type === "checkbox" ? el.checked : el.value;
    const nx = $("[data-zgu-act=next]"); if (nx) nx.disabled = !valid(); const w = $("#zgOv .zw-why"); if (w) w.textContent = valid() ? "" : why();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && U && !$("#zbFormOv")) { U = null; draw(); } if (e.key === "Escape") $("#zgGuideOv")?.remove(); });

  /* ---------------- Kağıda yerleştir ---------------- */
  const _render = window.render;
  window.render = function () {
    const r = _render.apply(this, arguments);
    try {
      if (G.id && S.view === "karakterler" && sysKey() === "dnd5e" && $("#main .sheet")) {
        const c = cur(), idp = $("#main .cname")?.closest(".panel");
        if (c && idp && !$("#zgBar")) idp.insertAdjacentHTML("afterend", barHtml(c));
      }
    } catch (err) { console.error(err); }
    return r;
  };
})();
