/* Masaüstü eklentileri (9): Monster of the Week sistemi.
   Avcı kağıdı (beş değer, temel hamleler, zarar, şans, deneyim, rol ve ekipman), 2d6 + değer ile hamle zarı,
   gelişim, Keeper için canavar ve gizem kartı, zar tepsisi, karakter yaratma sihirbazı ve rehberler.
   Kural metinleri bu uygulama için özgün olarak yazılmıştır; rol hamlelerinin tam metni oyuncunun kitabından gelir. */
(function () {
  "use strict";

  /* ---------------- Veri ---------------- */
  const RATINGS = [["charm", "Cazibe", "İkna etmek, insanlarla konuşmak"], ["cool", "Soğukkanlılık", "Baskı altında sakin kalmak, yardım etmek"],
    ["sharp", "Keskinlik", "Araştırmak, durumu okumak"], ["tough", "Sertlik", "Dövüşmek, birini korumak"], ["weird", "Tuhaflık", "Büyü ve doğaüstü"]];
  const RN = Object.fromEntries(RATINGS.map(r => [r[0], r[1]]));
  const ASK_INV = ["Burada ne yaşandı?", "Bu ne tür bir varlık?", "Neler yapabiliyor?", "Ona ne zarar verir?", "Şimdi nerede?", "Ne peşinde?", "Bu olay gizemin neresine oturuyor?"];
  const ASK_READ = ["Buradan en iyi nasıl kaçarım?", "En büyük tehlike ne?", "En büyük tehdit kim ya da ne?", "Neye dikkat etmeliyim?", "Avantajımı nasıl kullanırım?", "Burada kim neyi kontrol ediyor?"];
  const MOVES = [
    ["fight", "Dövüş", "tough", "Bir şeyle göğüs göğüse çarpıştığında. 10+: karşılıklı zarar verirsiniz ve bir ek etki seçersin (fazladan zarar, daha az zarar al, onu istediğin yere it). 7-9: karşılıklı zarar verirsiniz. 6-: Keeper bir hamle yapar."],
    ["pressure", "Baskı altında davran", "cool", "Tehlikeye rağmen bir şey yaptığında. 10+: başarırsın. 7-9: Keeper sana bir bedel, zor bir seçim ya da daha kötü bir sonuç sunar."],
    ["help", "Yardım et", "cool", "Bir avcıya yardım ettiğinde. 10+: onun zarına +1. 7-9: yine +1, ama sen de tehlikeye ya da bedele girersin."],
    ["investigate", "Gizemi araştır", "sharp", "İpucu aradığında. 10+: iki soru sor. 7-9: bir soru sor. Sorular: " + ASK_INV.join(" · ")],
    ["manipulate", "Birini ikna et", "charm", "Birinden bir şey istediğinde ve ona bir sebep verdiğinde. 10+: kabul eder. 7-9: karşılığında bir şey ister. Avcılar üzerinde: kabul ederse deneyim işaretler, etmezse bir sonraki zarına −1."],
    ["protect", "Birini koru", "tough", "Birini zarardan korumaya çalıştığında. 10+: zararı sen alırsın ve bir ek seçersin (daha az zarar al, saldırgana karşı +1 ileri, onu güvene al). 7-9: zararı sen alırsın."],
    ["read", "Durumu oku", "sharp", "Gergin bir anda etrafına baktığında. 10+: üç soru, 7-9: bir soru; cevaplara göre davranınca +1 ileri. Sorular: " + ASK_READ.join(" · ")],
    ["magic", "Büyü kullan", "weird", "Büyüyle bir etki yarattığında (zarar ver, büyü boz, bilgi edin, kapı aç, uzaktan gör…). 10+: etki gerçekleşir. 7-9: gerçekleşir ama Keeper bir aksilik seçer (zarar alırsın, etki zayıf ya da kısa sürer, dikkat çekersin, bedeli olur)."],
  ];
  const BIG_MAGIC = "Büyük büyü (zar yok): çok güçlü bir etki istediğinde Keeper koşulları söyler: zaman, malzeme, yardım, bir bedel ya da tehlikeli bir ritüel. Koşullar yerine gelince büyü olur.";
  const PLAYBOOKS = [
    ["chosen", "Seçilmiş", "The Chosen", "Bir kehanet seni bu savaşa çağırdı; kaderin seni karanlıkla yüzleşmeye zorluyor.", "tough", "cool"],
    ["crooked", "Kanun Kaçağı", "The Crooked", "Suç dünyasından geliyorsun; numaraların, bağlantıların ve geçmişinden borçların var.", "cool", "charm"],
    ["divine", "İlahi", "The Divine", "Yüce bir gücün gönderdiği savaşçısın; görevin kötülüğü yok etmek.", "tough", "weird"],
    ["expert", "Uzman", "The Expert", "Canavarlar hakkında bilinebilecek her şeyi bilen bilgin; kitaplarla dolu bir sığınağın var.", "sharp", "weird"],
    ["flake", "Komplocu", "The Flake", "Herkesin kaçırdığı bağlantıları görürsün; herkes seni deli sanır ama genellikle haklısın.", "sharp", "cool"],
    ["initiate", "Tarikat Üyesi", "The Initiate", "Yüzyıllardır canavar avlayan gizli bir tarikatın üyesisin.", "weird", "sharp"],
    ["monstrous", "Canavarımsı", "The Monstrous", "Sen de bir canavarsın ama insanların tarafını seçtin; içindeki açlıkla savaşırsın.", "weird", "tough"],
    ["mundane", "Sıradan", "The Mundane", "Hiçbir özel gücün yok; ama sıradan bir insanın cesareti ve şansı seninle.", "charm", "cool"],
    ["professional", "Profesyonel", "The Professional", "Canavarlarla gizlice uğraşan bir kurumda çalışıyorsun; kaynakların ve amirlerin var.", "cool", "sharp"],
    ["spellslinger", "Büyü Ustası", "The Spell-Slinger", "Savaş büyüsünde ustasın; ama her büyünün bir bedeli var.", "weird", "sharp"],
    ["spooky", "Ürkütücü", "The Spooky", "Karanlık güçlerin var; onları kullandıkça bir şey seni kendine çekiyor.", "weird", "charm"],
    ["wronged", "İntikamcı", "The Wronged", "Canavarlar sevdiklerini aldı; artık tek amacın intikam.", "tough", "sharp"],
  ];
  const PB = Object.fromEntries(PLAYBOOKS.map(p => [p[0], p]));
  const GEAR = [["Tabanca", 2, "yakın, gürültülü"], ["Pompalı tüfek", 3, "yakın, dağınık, gürültülü"], ["Av tüfeği", 2, "uzak, gürültülü"], ["Bıçak", 1, "el"],
    ["Gümüş hançer", 1, "el, gümüş"], ["Beyzbol sopası", 1, "el, ağır"], ["Balta", 2, "el, dağınık"], ["Kutsal su", 1, "el, kutsal"], ["Tahta kazık", 1, "el, ahşap"],
    ["Pala", 2, "el, dağınık"], ["Arbalet", 2, "uzak, sessiz"], ["Tuz ve demir tozu", 0, "el, saf, büyüye karşı"]];
  const IMPROVE = [["+cool", "Soğukkanlılık +1 (en çok +3)"], ["+charm", "Cazibe +1 (en çok +3)"], ["+sharp", "Keskinlik +1 (en çok +3)"], ["+tough", "Sertlik +1 (en çok +3)"], ["+weird", "Tuhaflık +1 (en çok +3)"],
    ["move", "Rolünden yeni bir hamle al"], ["move2", "Rolünden bir hamle daha al"], ["other", "Başka bir rolden hamle al"], ["gear", "Yeni ekipman, bir dost ya da sığınak"], ["luck", "Bir şans kutusunu sil"]];
  const ADV = [["adv2", "İki temel hamleyi geliştir (12+ sonuçları)"], ["adv2b", "İki temel hamleyi daha geliştir"], ["+any", "Herhangi bir değere +1 (en çok +3)"], ["newpb", "Yeni bir role geç"], ["retire", "Karakteri güvenle emekliye ayır"], ["second", "İkinci bir avcı yarat"]];
  const COUNT = ["Gün", "Gölgeler", "Alacakaranlık", "Gün batımı", "Akşam karanlığı", "Gece yarısı"];
  const cur = () => S.chars[S.charId];
  const pbName = c => c.pbKey && PB[c.pbKey] ? `${PB[c.pbKey][1]} (${PB[c.pbKey][2]})` : c.playbook || "Rol seçilmedi";

  /* ---------------- Model ---------------- */
  function newChar() {
    return { id: uid("c"), name: "Yeni Avcı", player: "", pbKey: "", playbook: "", look: "", ratings: { charm: 0, cool: 0, sharp: 0, tough: 0, weird: 0 },
      harm: 0, hp: 7, hpMax: 7, luck: 0, xp: 0, forward: 0, ongoing: 0, adv: {}, armor: 0, gear: [{ name: "Bıçak", harm: 1, tags: "el" }],
      pbMoves: "", history: "", improvements: "", impCount: 0, notes: "" };
  }
  const syncHp = c => { c.hpMax = 7; c.hp = 7 - Math.min(7, +c.harm || 0); };

  /* ---------------- Zar ---------------- */
  // 2d6 + değer + ileri + sürekli. 10+ tam, 7-9 kısmi, 6- başarısız (deneyim işaretlenir).
  function move(c, key, label, extra = 0, harmNote = "") {
    const v = key ? +c?.ratings?.[key] || 0 : 0, fw = +c?.forward || 0, on = +c?.ongoing || 0, tray = +S.motwFw || 0;
    const a = rnd(6), b = rnd(6), mod = v + fw + on + tray + extra, t = a + b + mod;
    const band = t >= 10 ? "Tam başarı" : t >= 7 ? "Kısmi başarı (bedelli)" : "Başarısızlık · Keeper hamle yapar";
    const adv = key && c?.adv?.[label] && t >= 12 ? " · 12+: gelişmiş sonuç" : "";
    const parts = [key ? `${RN[key]} ${sgn(v)}` : "", fw ? `ileri ${sgn(fw)}` : "", on ? `sürekli ${sgn(on)}` : "", tray ? `tepsi ${sgn(tray)}` : "", extra ? sgn(extra) : ""].filter(Boolean);
    pushRoll({ id: uid("l"), t: Date.now(), label: `${c?.name ? c.name + " · " : ""}${label}`, expr: `2d6${mod ? sgn(mod) : ""}`, total: t,
      detail: `2d6[${a},${b}]${parts.length ? " " + parts.join(", ") : ""} → ${band}${adv}${harmNote ? " · " + harmNote : ""}`, crit: null });
    S.motwLast = c ? { charId: c.id, label, t, mod } : null;
    if (c && canEditChar(c)) {
      const paths = [];
      if (fw) { c.forward = 0; paths.push("forward"); }
      if (t <= 6 && (+c.xp || 0) < 5) { c.xp = (+c.xp || 0) + 1; paths.push("xp"); toast(`Başarısızlık: ${c.name} deneyim işaretledi (${c.xp}/5)`); }
      if (paths.length) { save("chars", c, paths); render(); }
    }
    if (tray) { S.motwFw = 0; tray_(true); }
    return t;
  }

  /* ---------------- Kağıt ---------------- */
  const I = (c, k, ph = "", cls = "f", type = "text") => `<input class="${cls}" type="${type}" data-k="${k}" value="${esc(getPath(c, k) ?? "")}" placeholder="${esc(ph)}">`;
  const boxes = (n, max, act, cls = "", lab = "") => Array.from({ length: max }, (_, j) => `<button type="button" class="mw-box ${cls} ${j < n ? "on" : ""}" data-act="${act}" data-j="${j}" aria-label="${lab} ${j + 1}"></button>`).join("");
  function sheet(c) {
    const h = +c.harm || 0, unstable = h >= 4;
    return `<div class="sheet motw">
  <div class="panel"><input class="cname" data-k="name" value="${esc(c.name)}" aria-label="Avcının adı">
    <div class="idrow mw-id"><label><span class="lbl">Rol</span><select class="f" data-k="pbKey"><option value="">Kendi rolüm</option>${PLAYBOOKS.map(p => `<option value="${p[0]}" ${c.pbKey === p[0] ? "selected" : ""}>${p[1]} (${p[2]})</option>`).join("")}</select></label>
      ${c.pbKey ? "" : `<label><span class="lbl">Rolün adı</span>${I(c, "playbook", "örn. Avcı Rahibe")}</label>`}<label><span class="lbl">Görünüş</span>${I(c, "look", "örn. Eski deri ceket, yorgun gözler")}</label><label><span class="lbl">Oyuncu</span>${I(c, "player", "")}</label></div>
    ${c.pbKey ? `<p class="hint" style="margin:6px 0 0">${esc(PB[c.pbKey][3])}</p>` : ""}</div>
  <div class="mw-rat">${RATINGS.map(([k, n, d]) => `<div class="mw-r"><button class="mw-rb" data-act="mw-rating" data-r="${k}" title="2d6 + ${n}">${sgn(+c.ratings?.[k] || 0)}</button><div><b>${n}</b><small>${d}</small></div>
    <input class="f score" type="number" min="-3" max="3" data-k="ratings.${k}" value="${esc(c.ratings?.[k] ?? 0)}" aria-label="${n}"></div>`).join("")}</div>
  <div class="cols mw-cols">
    <div class="panel"><h3>Temel hamleler <span class="sp"></span><button class="btn sm" data-act="mw-guide">Nasıl oynanır?</button></h3>
      <div class="mw-moves">${MOVES.map(([k, n, r, d]) => `<div class="mw-mv"><button class="btn pri sm" data-act="mw-move" data-m="${k}">${n} <b class="num">${sgn(+c.ratings?.[r] || 0)}</b></button><small class="mw-rk">${RN[r]}</small>
        <label class="toggle mw-adv" title="Gelişmiş hamle: 12+ sonucunda daha iyi etki"><input type="checkbox" data-k="adv.${n}" ${c.adv?.[n] ? "checked" : ""}>12+</label><p>${esc(d)}</p></div>`).join("")}
        <div class="mw-mv"><span class="btn sm" aria-disabled="true">Büyük büyü</span><p>${esc(BIG_MAGIC)}</p></div></div></div>
    <div style="display:grid;gap:14px;min-width:0;align-content:start">
      <div class="panel"><h3>Zarar</h3><div class="mw-track">${boxes(h, 7, "mw-harm", "harm", "Zarar")}<span class="mw-skull" title="8 zarar: ölüm">✝</span></div>
        <p class="hint">${h ? `${h} zarar${unstable ? " · <b class=\"mw-bad\">dengesiz: tedavi edilmezse kötüleşir</b>" : ""}` : "Yara yok."} 4 ve üstü dengesiz sayılır; 8'de avcı ölür. Kutuya tıklayarak işaretle.</p>
        <div class="hpact"><label class="mw-arm"><span class="lbl">Zırh</span>${I(c, "armor", "0", "f num", "number")}</label><input class="f num" type="number" id="mwAmt" min="0" placeholder="0" aria-label="Alınan zarar"><button class="btn danger" data-act="mw-hurt">Zarar al</button><button class="btn" data-act="mw-heal">İyileş</button></div></div>
      <div class="panel"><h3>Şans</h3><div class="mw-track">${boxes(+c.luck || 0, 7, "mw-luck", "luck", "Şans")}</div>
        <p class="hint">Şans harcayınca bir zarı 12 yaparsın ya da aldığın zararı sıfırlarsın. Yedi kutu dolunca şansın biter.</p>
        <div class="chips"><button class="btn sm" data-act="mw-luck12" ${S.motwLast?.charId === c.id && S.motwLast.t < 12 ? "" : "disabled"}>Son zarı 12 yap</button><button class="btn sm" data-act="mw-luck0">Bu zararı sıfırla</button></div></div>
      <div class="panel"><h3>Deneyim <span class="sp"></span>${(+c.xp || 0) >= 5 ? `<button class="btn sm pri" data-act="mw-improve">Gelişim seç</button>` : ""}</h3><div class="mw-track">${boxes(+c.xp || 0, 5, "mw-xp", "xp", "Deneyim")}</div>
        <p class="hint">Her başarısız zarda (6-) deneyim kendiliğinden işaretlenir. Beş olunca bir gelişim seçersin.${+c.impCount ? ` Şimdiye kadar ${c.impCount} gelişim.` : ""}</p></div>
      <div class="panel"><h3>İleri ve sürekli</h3><div class="mw-fw"><label><span class="lbl">İleri (sonraki zar)</span>${I(c, "forward", "0", "f num", "number")}</label><label><span class="lbl">Sürekli</span>${I(c, "ongoing", "0", "f num", "number")}</label></div>
        <p class="hint">İleri yalnızca bir sonraki zara eklenir ve sonra sıfırlanır; sürekli silinene kadar her zara eklenir.</p></div>
    </div>
  </div>
  <div class="panel"><h3>Ekipman <button class="btn sm" data-act="mw-addgear">+ Ekle</button></h3>
    ${(c.gear || []).map((g, i) => `<div class="mw-gear"><input class="f" data-k="gear.${i}.name" value="${esc(g.name)}" aria-label="Ekipman"><label class="mw-gh"><input class="f num" type="number" min="0" data-k="gear.${i}.harm" value="${esc(g.harm ?? 0)}" aria-label="Zarar"><small>zarar</small></label>
      <input class="f" data-k="gear.${i}.tags" value="${esc(g.tags || "")}" placeholder="el, yakın, uzak, gürültülü, gümüş…" aria-label="Etiketler"><button class="btn sm" data-act="mw-attack" data-i="${i}">Dövüş</button><button class="btn sm danger" data-act="mw-delgear" data-i="${i}" aria-label="Sil">×</button></div>`).join("")}
    <p class="hint">Etiketler mesafeyi ve özelliği anlatır: el (temas), yakın (birkaç adım), uzak; gürültülü, dağınık; gümüş, kutsal gibi zayıflık etiketleri. Dövüş düğmesi Sertlik ile atar ve silahın zararını kayda yazar.</p></div>
  <div class="two">
    <div class="panel"><h3>Rol hamleleri</h3><textarea class="f" data-k="pbMoves" placeholder="Rolünün kitabındaki hamleleri buraya yaz.">${esc(c.pbMoves)}</textarea></div>
    <div class="panel"><h3>Geçmiş ve bağlar</h3><textarea class="f" data-k="history" placeholder="Diğer avcıları nereden tanıyorsun?">${esc(c.history)}</textarea></div>
  </div>
  <div class="two">
    <div class="panel"><h3>Gelişimler</h3><textarea class="f" data-k="improvements">${esc(c.improvements)}</textarea></div>
    <div class="panel"><h3>Notlar</h3><textarea class="f" data-k="notes">${esc(c.notes)}</textarea></div>
  </div></div>`;
  }
  function updateDerived(c) { const old = c.hp; syncHp(c); if (old !== c.hp && canEditChar(c)) save("chars", c, ["hp", "hpMax"]); }

  /* ---------------- Gelişim ---------------- */
  function improve(c) {
    $("#mwImpOv")?.remove();
    const adv = (+c.impCount || 0) >= 5, list = [...IMPROVE, ...(adv ? ADV : [])];
    const ov = document.createElement("div"); ov.id = "mwImpOv"; ov.className = "joinov zw-ov zb-ov";
    ov.innerHTML = `<div class="zw" role="dialog" aria-modal="true" aria-label="Gelişim" style="width:min(640px,100%)"><header class="zw-h"><h2>Gelişim seç</h2><span style="flex:1"></span><button class="btn sm" data-mwi="close" aria-label="Kapat">×</button></header>
      <div class="zw-b"><p>Beş deneyim topladın. Bir gelişim seç; deneyimin sıfırlanır.${adv ? " Beş gelişimi geçtiğin için <b>gelişmiş seçenekler</b> de açıldı." : ""}</p>
        <div class="zw-grid">${list.map(([k, n]) => { const r = k[0] === "+" && k !== "+any" ? k.slice(1) : null, max = r && (+c.ratings?.[r] || 0) >= 3; return `<button type="button" class="zw-card sm" data-mwi="pick" data-v="${k}" ${max ? "disabled" : ""}><b>${esc(n)}</b>${r ? `<span>Şu an ${sgn(+c.ratings?.[r] || 0)}</span>` : ""}</button>`; }).join("")}</div>
        ${adv ? `<label class="zw-field"><span class="lbl">Herhangi bir değere +1 için değer</span><select class="f" id="mwAny">${RATINGS.map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select></label>` : ""}</div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", e => {
      const b = e.target.closest("[data-mwi]"); if (!b) return;
      if (b.dataset.mwi === "close") { ov.remove(); return; }
      let k = b.dataset.v, txt = list.find(x => x[0] === k)[1];
      if (k === "+any") { k = "+" + $("#mwAny").value; txt = `${RN[k.slice(1)]} +1 (gelişmiş)`; }
      if (k[0] === "+") { const r = k.slice(1); c.ratings[r] = Math.min(3, (+c.ratings[r] || 0) + 1); }
      if (k === "luck" && +c.luck > 0) c.luck = +c.luck - 1;
      c.xp = 0; c.impCount = (+c.impCount || 0) + 1;
      c.improvements = `${c.improvements ? c.improvements.trimEnd() + "\n" : ""}${c.impCount}. ${txt}`;
      save("chars", c, ["ratings", "luck", "xp", "impCount", "improvements"]); ov.remove(); render(); toast(`Gelişim: ${txt}`);
    });
  }

  /* ---------------- Canavar ve gizem kartı ---------------- */
  function newMonster() {
    return { id: uid("mo"), name: "Yeni canavar", meta: "Yaratık · motivasyon: …", powers: "", attacks: [{ name: "Pençe", harm: "2", tags: "el, dağınık" }], armor: 1, hpMax: 8, harm: 0,
      weakness: "", minions: "", mystery: "", count: COUNT.map(() => ""), countAt: 0, notes: "", size: 1 };
  }
  function statBlock(mo) {
    const M = (k, ph, cls = "f", type = "text") => `<input class="${cls}" type="${type}" data-mo="${k}" value="${esc(getPath(mo, k) ?? "")}" placeholder="${esc(ph)}" aria-label="${esc(ph)}">`;
    const T = (k, ph) => `<textarea class="f" data-mo="${k}" placeholder="${esc(ph)}">${esc(getPath(mo, k) || "")}</textarea>`;
    const cap = Math.max(1, Math.min(20, +mo.hpMax || 8)), h = Math.min(cap, +mo.harm || 0);
    return `<article class="stat mw-stat">
    <input class="stname" data-mo="name" value="${esc(mo.name)}" aria-label="Ad"><input class="stmeta" data-mo="meta" value="${esc(mo.meta)}" placeholder="Tür · motivasyon" aria-label="Tür ve motivasyon"><hr>
    <div class="strow"><b>Zırh</b>${M("armor", "1", "f num n", "number")}<b style="min-width:auto">Zarar kapasitesi</b>${M("hpMax", "8", "f num n", "number")}</div>
    <div class="strow"><b>Aldığı zarar</b><span class="mw-track">${Array.from({ length: cap }, (_, j) => `<button type="button" class="mw-box harm ${j < h ? "on" : ""}" data-act="mwm-harm" data-j="${j}" aria-label="Zarar ${j + 1}"></button>`).join("")}</span></div>
    <div class="strow"><b>Zayıflık</b>${M("weakness", "örn. gümüş, ateş, adını söylemek")}</div>
    <h4>Güçler</h4>${T("powers", "Neler yapabilir?")}
    <h4>Saldırılar <button class="btn sm" data-act="mon-addatk">+ Ekle</button></h4>
    ${(mo.attacks || []).map((a, i) => `<div class="atk mw-atk"><input class="f" data-mo="attacks.${i}.name" value="${esc(a.name)}" aria-label="Saldırı"><input class="f num" data-mo="attacks.${i}.harm" value="${esc(a.harm ?? "")}" placeholder="2" aria-label="Zarar">
      <input class="f" data-mo="attacks.${i}.tags" value="${esc(a.tags || "")}" placeholder="el, yakın…" aria-label="Etiketler"><span style="display:flex;gap:4px"><button class="btn sm" data-act="mwm-atk" data-i="${i}">Saldır</button><button class="btn sm danger" data-act="mon-delatk" data-i="${i}" aria-label="Sil">×</button></span></div>`).join("")}
    <h4>Yardakçılar ve diğer tehditler</h4>${T("minions", "Kölesi olan insanlar, küçük yaratıklar, tehlikeli yerler…")}
    <h4>Gizem geri sayımı</h4>
    <div class="mw-count">${COUNT.map((n, i) => `<label class="${i < (+mo.countAt || 0) ? "done" : ""}"><button type="button" class="mw-box ${i < (+mo.countAt || 0) ? "on" : ""}" data-act="mwm-count" data-j="${i}" aria-label="${n} gerçekleşti"></button><span>${n}</span>${M(`count.${i}`, "Avcılar engellemezse ne olur?")}</label>`).join("")}</div>
    <h4>Gizemin özeti</h4>${T("mystery", "Kanca: avcılar olayı nasıl duyuyor? Kimler kurban? Canavar ne istiyor?")}
    <h4>Keeper notları</h4>${T("notes", "")}
    <div class="stfoot"><span style="flex:1"></span><button class="btn pri" data-act="mon-place">Haritaya ekle</button><button class="btn" data-act="mon-dup">Kopyala</button><button class="btn danger" data-act="mon-del">Sil</button></div></article>`;
  }

  /* ---------------- Eylemler ---------------- */
  function action(a, b, e, c, mo) {
    if (!a || !(a.startsWith("mw-") || a.startsWith("mwm-"))) return false;
    switch (a) {
      case "mw-rating": move(c, b.dataset.r, RN[b.dataset.r]); return true;
      case "mw-move": { const m = MOVES.find(x => x[0] === b.dataset.m); move(c, m[2], m[1]); return true; }
      case "mw-attack": { const g = c.gear[+b.dataset.i]; move(c, "tough", `Dövüş: ${g.name || "silah"}`, 0, `${+g.harm || 0}-zarar${g.tags ? " (" + g.tags + ")" : ""}`); return true; }
      case "mw-harm": { const j = +b.dataset.j; c.harm = j < (+c.harm || 0) ? j : j + 1; syncHp(c); save("chars", c, ["harm", "hp", "hpMax"]); render(); return true; }
      case "mw-luck": { const j = +b.dataset.j; c.luck = j < (+c.luck || 0) ? j : j + 1; save("chars", c, ["luck"]); render(); return true; }
      case "mw-xp": { const j = +b.dataset.j; c.xp = j < (+c.xp || 0) ? j : j + 1; save("chars", c, ["xp"]); render(); return true; }
      case "mw-hurt": { const n = Math.max(0, (+$("#mwAmt")?.value || 0) - (+c.armor || 0)); c.harm = Math.min(8, (+c.harm || 0) + n); syncHp(c); save("chars", c, ["harm", "hp", "hpMax"]); render();
        toast(c.harm >= 8 ? `${c.name} öldü… ya da şans harcamalı!` : `${c.name} ${n} zarar aldı (zırh ${+c.armor || 0})${c.harm >= 4 ? " · dengesiz" : ""}`); return true; }
      case "mw-heal": { const n = +$("#mwAmt")?.value || 1; c.harm = Math.max(0, (+c.harm || 0) - n); syncHp(c); save("chars", c, ["harm", "hp", "hpMax"]); render(); return true; }
      case "mw-luck12": { const L = S.motwLast; if ((+c.luck || 0) >= 7) { toast("Şansın kalmadı"); return true; } c.luck = (+c.luck || 0) + 1; save("chars", c, ["luck"]);
        pushRoll({ id: uid("l"), t: Date.now(), label: `${c.name} · ${L.label} (şans harcandı)`, expr: "", total: 12, detail: `Sonuç 12 sayılır → Tam başarı · şans ${c.luck}/7`, crit: null }); S.motwLast = null; render(); return true; }
      case "mw-luck0": { if ((+c.luck || 0) >= 7) { toast("Şansın kalmadı"); return true; } c.luck = (+c.luck || 0) + 1; save("chars", c, ["luck"]); render(); toast(`Şans harcandı: bu zararı yok say (${c.luck}/7). Zararı işaretlediysen kutudan geri al.`); return true; }
      case "mw-improve": improve(c); return true;
      case "mw-addgear": (c.gear = c.gear || []).push({ name: "", harm: 1, tags: "el" }); save("chars", c, ["gear"]); render(); return true;
      case "mw-delgear": c.gear.splice(+b.dataset.i, 1); save("chars", c, ["gear"]); render(); return true;
      case "mw-guide": guide(); return true;
      case "mwm-harm": { const j = +b.dataset.j; mo.harm = j < (+mo.harm || 0) ? j : j + 1; save("monsters", mo, ["harm"]); render(); return true; }
      case "mwm-count": { const j = +b.dataset.j; mo.countAt = j < (+mo.countAt || 0) ? j : j + 1; save("monsters", mo, ["countAt"]); render(); return true; }
      case "mwm-atk": { const at = mo.attacks[+b.dataset.i]; pushRoll({ id: uid("l"), t: Date.now(), label: monRollLabel(mo, at.name || "Saldırı"), expr: "", total: `${at.harm || 0}`, detail: `${at.harm || 0}-zarar${at.tags ? " · " + at.tags : ""}. Avcı Dövüş ya da Birini koru ile karşılık verebilir.`, crit: null, secret: isDM() }); return true; }
    }
    return false;
  }

  /* ---------------- Zar tepsisi ---------------- */
  let advLabels = null;
  function tray_(on) {
    const host = $("#trayDnd"); if (!host) return;
    const seg = $(".seg", host); if (seg) seg.hidden = on;
    let el = $("#mwTray");
    if (!on) { el?.remove(); return; }
    if (!el) { el = document.createElement("div"); el.id = "mwTray"; el.className = "mw-tray"; host.insertBefore(el, $("#dice", host)); }
    const fw = +S.motwFw || 0;
    el.innerHTML = `<div class="seg seg5" role="group" aria-label="Değiştirici">${[-2, -1, 0, 1, 2].map(v => `<button data-mwfw="${v}" aria-pressed="${fw === v}">${v ? sgn(v) : "±0"}</button>`).join("")}</div>
      <div class="exprrow"><button class="btn pri" data-mwroll="1" style="flex:1">2d6${fw ? " " + sgn(fw) : ""} at</button></div>
      <p class="hint" style="margin:-4px 0 10px">10+ tam başarı · 7-9 bedelli başarı · 6- Keeper hamle yapar. Kağıttaki hamle düğmeleri değeri kendiliğinden ekler; buradaki değiştirici bir sonraki zara eklenir.</p>`;
    void advLabels;
  }
  document.addEventListener("click", e => {
    const f = e.target.closest("[data-mwfw]"); if (f) { S.motwFw = +f.dataset.mwfw; tray_(true); return; }
    if (e.target.closest("[data-mwroll]")) move(null, null, "2d6");
  });
  // Rol ya da değer değişince kağıt yeniden çizilsin.
  document.addEventListener("change", e => { if (sysKey() === "motw" && /^(pbKey|ratings\.\w+|adv\..+)$/.test(e.target.dataset?.k || "")) setTimeout(render, 0); });

  /* ---------------- Rehber ---------------- */
  function guide() {
    $("#mwGuide")?.remove(); const ov = document.createElement("div"); ov.id = "mwGuide"; ov.className = "joinov zw-ov zb-ov";
    ov.innerHTML = `<div class="zw" role="dialog" aria-modal="true" aria-label="Nasıl oynanır" style="width:min(720px,100%)"><header class="zw-h"><h2>Monster of the Week nasıl oynanır?</h2><span style="flex:1"></span><button class="btn sm" data-mwg="1" aria-label="Kapat">×</button></header><div class="zw-b">
      <p>Avcılar bir kasabayı tehdit eden canavarın izini sürer, ne olduğunu çözer, zayıflığını bulur ve onu durdurur. Keeper (oyun yöneticisi) gizemi ve canavarı oynar.</p>
      <p><b>Hamle:</b> Bir avcı riskli bir şey yaptığında ilgili hamle tetiklenir ve <b>2d6 + değer</b> atılır. <b>10+</b> tam başarı, <b>7-9</b> başarı ama bir bedel ya da zor seçim, <b>6-</b> başarısızlık: Keeper bir hamle yapar ve sen deneyim işaretlersin.</p>
      <p><b>Değerler:</b> Cazibe, Soğukkanlılık, Keskinlik, Sertlik, Tuhaflık; −1 ile +3 arası.</p>
      <p><b>Zarar:</b> Silahların zarar değeri vardır; zırh bunu azaltır. 4 ve üstünde dengesizsin, 8'de ölürsün. <b>Şans</b> harcayarak bir zarı 12 yapabilir ya da bir zararı yok sayabilirsin; yedi şansın var ve geri gelmez.</p>
      <p><b>Gizem:</b> Keeper'ın canavar kartında bir geri sayım vardır; avcılar engellemezse olaylar Gün'den Gece yarısı'na doğru kötüleşir.</p>
      <aside class="zw-learn"><b>Homebrew:</b> Rol listesinde <b>Kendi rolüm</b>'ü seçip rolüne ad verebilir, hamlelerini "Rol hamleleri" kutusuna yazabilirsin.</aside></div>
      <footer class="zw-f"><span style="flex:1"></span><button class="btn pri" data-mwg="1">Anladım</button></footer></div>`;
    document.body.appendChild(ov); ov.addEventListener("click", e => { if (e.target.closest("[data-mwg]")) ov.remove(); });
  }

  /* ---------------- Karakter yaratma sihirbazı ---------------- */
  const STEPS = ["Başlarken", "Rol", "Değerler", "Ekipman", "Kimlik", "Özet"];
  let W = null;
  function arrays(pb) {
    const main = PB[pb]?.[4] || "tough", sec = PB[pb]?.[5] || "cool", rest = RATINGS.map(r => r[0]).filter(k => k !== main && k !== sec);
    return [[2, 1, 1, 0, -1], [2, 1, 0, 0, 0], [3, 0, 1, 0, -1], [2, 2, 0, 0, -1]].map(v => ({ [main]: v[0], [sec]: v[1], [rest[0]]: v[2], [rest[1]]: v[3], [rest[2]]: v[4] }));
  }
  function wHtml() {
    const s = W.step;
    if (s === 0) return `<h3>Avcı olmaya hazır mısın?</h3><p>Monster of the Week'te sıradan dünyanın gölgesinde saklanan canavarları avlarsın. Karakterini dört adımda kuracağız: <b>rol</b>, <b>değerler</b>, <b>ekipman</b> ve <b>kimlik</b>.</p>
      <p>Zar basit: bir şey riskli olduğunda <b>2d6 + değerin</b>. 10 ve üstü tam başarı, 7-9 bedelli başarı, 6 ve altı işler kötüye gider ama deneyim kazanırsın.</p>
      <aside class="zw-learn"><b>Rol hamleleri:</b> Her rolün kendine özel hamleleri vardır. Kitabından seçip kağıttaki kutuya yazarsın; listede olmayan bir rol için <b>Kendi rolüm</b>'ü seç.</aside>`;
    if (s === 1) return `<h3>Rolünü seç</h3><p>Rol, avcının kim olduğunu ve canavarlarla neden uğraştığını belirler.</p>
      <div class="zw-grid">${PLAYBOOKS.map(p => `<button type="button" class="zw-card" data-mww="pb" data-v="${p[0]}" aria-pressed="${W.pb === p[0]}"><b>${p[1]}</b><small class="zw-tag">${p[2]} · ${RN[p[4]]}, ${RN[p[5]]}</small><span>${esc(p[3])}</span></button>`).join("")}
        <button type="button" class="zw-card zw-hb" data-mww="pb" data-v="custom" aria-pressed="${W.pb === "custom"}"><b>+ Kendi rolüm</b><span>Başka bir kitaptan ya da masanızdan (homebrew); adını ve öne çıkan değerini sen seç.</span></button></div>
      ${W.pb === "custom" ? `<div class="zw-custom"><label class="zw-field"><span class="lbl">Rolün adı</span><input class="f" data-mwc="pbName" value="${esc(W.pbName)}" placeholder="örn. Avcı Rahibe"></label>
        <div class="zw-sub"><b>Öne çıkan değer:</b> <span class="chips">${RATINGS.map(([k, n]) => `<button type="button" class="chip" data-mww="main" data-v="${k}" aria-pressed="${W.main === k}">${n}</button>`).join("")}</span></div></div>` : ""}`;
    if (s === 2) { const arr = arrays(W.pb === "custom" ? null : W.pb).map(a => W.pb === "custom" ? Object.fromEntries(Object.entries(a).map(([k, v], i, all) => [k, v])) : a);
      const opts = W.pb === "custom" ? arrays(null).map(a => { const m = W.main || "tough", t = { ...a }; const top = Object.keys(a).find(k => a[k] === Math.max(...Object.values(a))); [t[m], t[top]] = [a[top], a[m]]; return t; }) : arr;
      return `<h3>Değerlerini seç</h3><p>Değerlerin −1 ile +3 arasında. Bir dağılım seç; rolünün öne çıkan değerleri yüksek tutuldu.</p>
      <div class="zw-grid">${opts.map((a, i) => `<button type="button" class="zw-card sm" data-mww="arr" data-v="${i}" aria-pressed="${W.arr === i}"><b>Dağılım ${i + 1}</b><span>${RATINGS.map(([k, n]) => `${n} ${sgn(a[k])}`).join(" · ")}</span></button>`).join("")}</div>
      ${learn("Sertlik dövüşmek ve korumak, Keskinlik araştırmak ve durumu okumak, Cazibe ikna etmek, Soğukkanlılık baskı altında davranmak ve yardım etmek, Tuhaflık büyü için kullanılır.")}`; }
    if (s === 3) return `<h3>Ekipmanını seç</h3><p>Üç parça seç. Silahın zarar değeri ve etiketleri mesafeyi ve özelliği anlatır; canavarların zayıflığına uyan etiket (gümüş, kutsal, ahşap…) çok işe yarar.</p>
      <div class="zw-grid">${GEAR.map((g, i) => `<button type="button" class="zw-card sm" data-mww="gear" data-v="${i}" aria-pressed="${W.gear.includes(i)}"><b>${g[0]}</b><span>${g[1]}-zarar · ${g[2]}</span></button>`).join("")}</div>
      <p class="zw-left">Seçilen: ${W.gear.length}/3. Rolünün kitabında özel ekipman varsa kağıtta ekleyebilirsin.</p>`;
    if (s === 4) return `<h3>Kimliğin</h3><label class="zw-field"><span class="lbl">Avcının adı</span><input class="f" data-mwc="name" value="${esc(W.name)}" placeholder="örn. Deniz Karaca"></label>
      <label class="zw-field"><span class="lbl">Görünüş</span><input class="f" data-mwc="look" value="${esc(W.look)}" placeholder="örn. Yağmurluk, yorgun gözler, gümüş kolye"></label>
      <label class="zw-field" style="max-width:none"><span class="lbl">Diğer avcılarla bağın</span><textarea class="f" rows="3" data-mwc="history" placeholder="örn. Ece'yi kardeşimin cenazesinde tanıdım; o da aynı yaratığı arıyordu.">${esc(W.history)}</textarea></label>`;
    if (s === 5) { const a = curArr(); return `<h3>${esc(W.name)} hazır!</h3><p>${esc(W.pb === "custom" ? W.pbName : PB[W.pb][1])}</p>
      <div class="zw-abil sm">${RATINGS.map(([k, n]) => `<div class="zw-ab"><b>${n}</b><span class="num">${sgn(a[k])}</span></div>`).join("")}</div>
      <p><b>Ekipman:</b> ${W.gear.map(i => GEAR[i][0]).join(", ") || "yok"}</p>
      ${learn("Oluştur'a bastıktan sonra kitabından rol hamlelerini seçip kağıttaki kutuya yaz. Zarar, şans ve deneyim kutuları kağıtta.")}`; }
  }
  const learn = t => `<aside class="zw-learn"><b>Ne işe yarar?</b> ${t}</aside>`;
  function curArr() { if (W.pb !== "custom") return arrays(W.pb)[W.arr ?? 0]; const a = arrays(null)[W.arr ?? 0], m = W.main || "tough", t = { ...a }, top = Object.keys(a).find(k => a[k] === Math.max(...Object.values(a))); [t[m], t[top]] = [a[top], a[m]]; return t; }
  const valid = s => s === 1 ? !!W.pb && (W.pb !== "custom" || (!!W.pbName.trim() && !!W.main)) : s === 2 ? W.arr != null : s === 3 ? W.gear.length > 0 : s === 4 ? !!W.name.trim() : true;
  function draw() {
    let ov = $("#mwOv"); if (!W) { ov?.remove(); return; }
    if (!ov) { ov = document.createElement("div"); ov.id = "mwOv"; ov.className = "joinov zw-ov"; document.body.appendChild(ov); }
    const s = W.step, ok = valid(s), y = W.keep ? $("#mwBody")?.scrollTop || 0 : 0;
    ov.innerHTML = `<div class="zw" role="dialog" aria-modal="true" aria-label="Avcı yaratma"><header class="zw-h"><h2>Avcı yaratma</h2><ol class="zw-steps">${STEPS.map((n, i) => `<li class="${i === s ? "on" : i < s ? "done" : ""}">${i ? `<span>${i}</span>` : ""}${n}</li>`).join("")}</ol><button class="btn sm" data-mww="close" aria-label="Kapat">×</button></header>
      <div class="zw-b" id="mwBody">${wHtml()}</div><footer class="zw-f">${s ? `<button class="btn" data-mww="prev">← Geri</button>` : `<button class="btn" data-mww="blank">Boş kağıtla başla</button>`}<span class="zw-why"></span>
      ${s === STEPS.length - 1 ? `<button class="btn pri" data-mww="finish">Avcıyı oluştur</button>` : `<button class="btn pri" data-mww="next" ${ok ? "" : "disabled"}>${s ? "İleri →" : "Başlayalım"}</button>`}</footer></div>`;
    $("#mwBody").scrollTop = y; W.keep = false;
  }
  function finish() {
    const n = newChar(), a = curArr();
    Object.assign(n, { name: W.name.trim(), look: W.look, history: W.history, ratings: a, pbKey: W.pb === "custom" ? "" : W.pb, playbook: W.pb === "custom" ? W.pbName.trim() : "",
      gear: W.gear.map(i => ({ name: GEAR[i][0], harm: GEAR[i][1], tags: GEAR[i][2] })) });
    if (!isDM()) n.owner = ME.id; save("chars", n); if (!isDM()) linkMyChar(n.id); S.charId = n.id; S.view = "karakterler"; W = null; draw(); render(); toast(`${n.name} oluşturuldu`);
  }
  document.addEventListener("click", e => {
    const nb = e.target.closest('[data-act="newchar"]');
    if (nb && !W && sysKey() === "motw" && !S.ro) { e.stopImmediatePropagation(); W = { step: 0, pb: null, pbName: "", main: null, arr: null, gear: [], name: "", look: "", history: "" }; draw(); return; }
    const b = e.target.closest("[data-mww]"); if (!b || !W) return;
    const a = b.dataset.mww, v = b.dataset.v;
    switch (a) {
      case "close": W = null; draw(); return;
      case "blank": { W = null; draw(); const n = newChar(); if (!isDM()) n.owner = ME.id; save("chars", n); if (!isDM()) linkMyChar(n.id); S.charId = n.id; render(); return; }
      case "next": if (valid(W.step)) W.step++; draw(); return;
      case "prev": W.step = Math.max(0, W.step - 1); draw(); return;
      case "finish": finish(); return;
      case "pb": if (W.pb !== v) { W.pb = v; W.arr = null; } break;
      case "main": W.main = v; W.arr = null; break;
      case "arr": W.arr = +v; break;
      case "gear": { const i = +v; W.gear = W.gear.includes(i) ? W.gear.filter(x => x !== i) : W.gear.length < 3 ? [...W.gear, i] : W.gear; break; }
    }
    W.keep = true; draw();
  }, true);
  document.addEventListener("input", e => { const el = e.target; if (!W || !el.dataset.mwc) return; W[el.dataset.mwc] = el.value; const nx = $("[data-mww=next]"); if (nx) nx.disabled = !valid(W.step); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && W) { W = null; draw(); } });

  /* ---------------- Kayıt ---------------- */
  const initChar = ch => ({ init: 0, dex: 0, txt: `${ch.name}` });
  const initMon = () => ({ init: 0, dex: 0 });
  window.MOTW = { RATINGS, MOVES, PLAYBOOKS, GEAR, COUNT, newChar, newMonster, move };
  window.ZSYS = window.ZSYS || {};
  window.ZSYS.motw = { newChar, sheet, updateDerived, statBlock, newMonster, action, tray: tray_, initChar, initMon, initLabel: "sıra yok", monChip: m => `<small>${+m.harm || 0}/${+m.hpMax || 0}</small>` };
})();
