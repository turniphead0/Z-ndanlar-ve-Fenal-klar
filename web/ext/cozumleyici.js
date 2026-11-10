/* Yapay zekâsız senaryo çözümleyici.
   PDF'in yer imlerinden, başlık yazı boyutlarından ve anahtar sözcüklerden modülleri, NPC'leri,
   haritaları, el notlarını ve ipuçlarını çıkarır. Claude ile aynı biçimde sonuç döndürür, böylece
   Senaryo ekranı iki yöntemi de aynı şekilde gösterir. API anahtarı ya da internet gerektirmez.

   Girdi:  { title, pages: [ , {lines:[{t, s, b}], img}, ... ] (1'den başlar), outline: [{title, page, depth}] }
           t = satır metni, s = yazı boyutu (bilinmiyorsa 0), b = kalın mı, img = sayfada görsel var mı
   Çıktı:  { title, guide, modules, npcs, handouts, maps, clues } */
(function () {
  "use strict";
  const low = s => String(s || "").toLocaleLowerCase("tr");
  const clean = s => String(s || "").replace(/\s+/g, " ").trim();
  const cut = (s, n) => { s = clean(s); if (s.length <= n) return s; const k = s.lastIndexOf(" ", n); return s.slice(0, k > n * 0.6 ? k : n) + "…"; };
  const sentences = s => clean(s).split(/(?<=[.!?…])\s+(?=[A-ZÇĞİÖŞÜ"“(])/u).filter(x => x.length > 15);
  const firstSentences = (s, n, max) => cut(sentences(s).slice(0, n).join(" ") || s, max || 400);

  // Anahtar sözcükler (Türkçe ve İngilizce senaryolar için)
  const RX = {
    intro: /^(introduction|background|adventure background|overview|synopsis|summary|the story so far|what'?s (really )?going on|for the (gm|game ?master|keeper|dm)|keeper'?s (information|background)|giriş|arka ?plan|özet|genel bakış|senaryo özeti|hikâye|hikaye|neler oluyor|yönetici için|gerçekte ne oluyor)/i,
    hook: /(hook|getting started|involving the (players|investigators|characters)|starting the adventure|adventure start|kanca|başlangıç|başlarken|maceraya başlarken|oyuncuları (dahil|içeri))/i,
    end: /^(conclusion|ending|endings|aftermath|epilogue|wrapping up|rewards|sonuç|son|sonlar|bitiş|epilog|ödüller|kapanış)/i,
    npcSec: /^(npcs?|non-?player characters|characters|dramatis personae|cast( of characters)?|key (npcs|characters)|personalities|karakterler|kişiler|oyuncu olmayan karakterler|önemli kişiler|başlıca karakterler)\b/i,
    handout: /(player handout|handout|el notu|el notları|oyuncu notu|oyunculara verilecek)/i,
    map: /(\bmaps?\b|floor ?plan|plan of|layout of|\bharita|kat planı|krokisi|planı$)/i,
    clue: /(\bclues?\b|ipucu|ipuçları|if (the )?(players|investigators|characters|pcs|pc)\b[^.]{0,40}\b(search|examine|find|investigate|inspect|ask|look)|(eğer|şayet) (oyuncular|araştırmacılar|karakterler)[^.]{0,40}(ararsa|incelerse|bulursa|sorarsa|bakarsa|araştırırsa)|reveals? that|ortaya çıkar)/i,
    secret: /(\bsecret(ly)?\b|in (truth|reality)|actually|unknown to|unbeknownst|\bsır(rı|ları)?\b|gerçekte|aslında|kimse bilmez|bilmedikleri)/i,
    statAC: /^(armou?r class|zırh sınıfı|\bAC\b)\s*[:\s]?\s*\d+/i,
    statHP: /^(hit points|can puanı|yaşam puanı|\bHP\b|\bCP\b)\s*[:\s]?\s*\d+/i,
    statPF: /^perception\s*[+-]\d+/i,
    statCoC: /\b(STR|GÜÇ|GÜC)\s*:?\s*\d+.*\b(CON|DAY|DAYANIKLILIK)\s*:?\s*\d+/i,
    statYZE: /\b(STRENGTH|AGILITY|WITS|EMPATHY|GÜÇ|ÇEVİKLİK|ZEKÂ|EMPATİ)\s*:?\s*\d\b.*\b(AGILITY|WITS|EMPATHY|ÇEVİKLİK|ZEKÂ|EMPATİ)\s*:?\s*\d\b/i,
    numbered: /^((chapter|part|act|scene|bölüm|kısım|perde|sahne)\s+[\dIVXLC]+|[\dIVX]{1,4}[.)]\s+\S)/i,
  };

  function isHeadingText(t) {
    t = clean(t);
    if (t.length < 3 || t.length > 70) return false;
    if (/^[\d\s.,:;\-–()/]+$/.test(t)) return false;       // sadece sayı
    if (/[,;]$/.test(t)) return false;
    if (/^(page|sayfa)\s*\d+$/i.test(t)) return false;
    return /\p{L}{2}/u.test(t);
  }

  // Satırlardan başlıkları bul: gövde yazısından belirgin biçimde büyük ya da numaralı/BÜYÜK HARF kısa satırlar.
  function findHeadings(pages) {
    const sizeChars = new Map();
    for (let p = 1; p < pages.length; p++) for (const l of (pages[p] && pages[p].lines) || []) {
      if (!l.s) continue; const k = Math.round(l.s * 2) / 2; sizeChars.set(k, (sizeChars.get(k) || 0) + l.t.length);
    }
    let body = 0, best = -1; for (const [k, n] of sizeChars) if (n > best) { best = n; body = k; }
    const out = [];
    for (let p = 1; p < pages.length; p++) {
      const lines = (pages[p] && pages[p].lines) || [];
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i], t = clean(l.t); if (!isHeadingText(t)) continue;
        let size = 0;
        if (body && l.s) { if (l.s >= body * 1.18) size = Math.round(l.s * 2) / 2; else if (l.b && l.s >= body * 0.98 && t.length <= 50 && !/[.!?]$/.test(t)) size = body + 0.01; }
        else if (!body) { // yazı boyutu yok: metinden tahmin et
          const caps = t === t.toLocaleUpperCase("tr") && /\p{Lu}{3}/u.test(t);
          if (RX.numbered.test(t) && t.length <= 60 && !/[.!?]$/.test(t)) size = 3; else if (caps && t.length <= 50) size = 2;
        }
        if (size) out.push({ title: t, page: p, size, idx: i });
      }
    }
    // Bir sayfanın üstüne sığmayan uzun başlıklar iki satıra bölünmüş olabilir: art arda aynı boyuttakileri birleştir.
    const merged = [];
    for (const h of out) { const l = merged[merged.length - 1];
      if (l && l.page === h.page && l.size === h.size && h.idx === l.idxEnd + 1 && (l.title + " " + h.title).length <= 80) { l.title += " " + h.title; l.idxEnd = h.idx; }
      else merged.push({ ...h, idxEnd: h.idx }); }
    return { body, list: merged };
  }

  // Modül düzeyi: 3-15 başlık veren en büyük boyut. Hiçbiri uymuyorsa sayfaları eşit böl.
  function pickLevels(heads, pageCount) {
    const sizes = [...new Set(heads.map(h => h.size))].sort((a, b) => b - a);
    let top = null, sub = null;
    for (let i = 0; i < sizes.length; i++) {
      const n = heads.filter(h => h.size === sizes[i]).length;
      // Kapakta bir kez görünen dev başlık modül değildir.
      if (n >= 3 && n <= Math.max(15, pageCount / 3)) { top = sizes[i]; sub = sizes[i + 1] ?? null; break; }
    }
    if (top === null && sizes.length) { // En büyük boyut yalnızca 1-2 kez varsa bir alttakini dene, bu da yoksa iki düzeyi birleştir
      const cand = sizes.find(s => heads.filter(h => h.size >= s).length >= 3);
      if (cand !== undefined) { top = cand; sub = sizes[sizes.indexOf(cand) + 1] ?? null; }
    }
    return { top, sub };
  }

  function pageBody(pages, p) { return ((pages[p] && pages[p].lines) || []).map(l => l.t).join("\n"); }
  // Bir başlıktan sonraki gövde metni (en çok `maxPages` sayfa)
  // Gövde boyutu biliniyorsa ara başlıklar (daha büyük satırlar) özete karışmasın.
  let BODY = 0;
  function textAfter(pages, h, until, maxPages = 2) {
    let out = []; const end = Math.min(until || pages.length - 1, h.page + maxPages - 1);
    for (let p = h.page; p <= end; p++) {
      const lines = (pages[p] && pages[p].lines) || [];
      const from = p === h.page ? (h.idxEnd ?? h.idx ?? -1) + 1 : 0;
      for (let i = from; i < lines.length; i++) if (!(BODY && lines[i].s > BODY * 1.15)) out.push(lines[i].t);
    }
    return out.join("\n");
  }
  function joinParagraphs(text) { return clean(text.replace(/-\n(?=\p{Ll})/gu, "").replace(/\n/g, " ")); }

  function analyze(input) {
    const pages = input.pages || [];
    const pageCount = Math.max(0, pages.length - 1);
    const { body, list: heads } = findHeadings(pages); BODY = body;

    // 1) Modüller: önce PDF'in yer imleri, sonra başlık boyutları
    let modHeads = [], subHeads = [];
    const ol = (input.outline || []).filter(o => o.page >= 1 && o.page <= pageCount && clean(o.title));
    if (ol.length >= 3) {
      const depths = [...new Set(ol.map(o => o.depth))].sort((a, b) => a - b);
      let d = depths[0]; if (ol.filter(o => o.depth === d).length < 3 && depths.length > 1) d = depths[1];
      modHeads = ol.filter(o => o.depth === d).map(o => ({ title: clean(o.title), page: o.page }));
      subHeads = ol.filter(o => o.depth === d + 1).map(o => ({ title: clean(o.title), page: o.page }));
    }
    if (modHeads.length < 3) {
      const { top, sub } = pickLevels(heads, pageCount);
      if (top !== null) { modHeads = heads.filter(h => h.size === top); subHeads = sub === null ? [] : heads.filter(h => h.size === sub); }
    }
    // Aynı sayfada art arda gelen modül başlıklarını tekilleştir; çok fazlaysa en uzun bölümleri koru.
    modHeads = modHeads.sort((a, b) => a.page - b.page).filter((h, i, a) => !i || h.page !== a[i - 1].page || low(h.title) !== low(a[i - 1].title));
    // Yer iminden gelen başlığın sayfadaki satırını bul, özet başlığın kendisiyle başlamasın.
    for (const h of [...modHeads, ...subHeads]) if (h.idx === undefined) {
      const lines = (pages[h.page] && pages[h.page].lines) || []; const k = low(h.title);
      const i = lines.findIndex(l => { const t = low(clean(l.t)); return t && (t === k || k.startsWith(t) && t.length >= 4 || t.startsWith(k)); });
      if (i >= 0) { h.idx = i; h.idxEnd = i; let j = i; while (j + 1 < lines.length && k.includes(low(clean(lines[j + 1].t))) && clean(lines[j + 1].t).length >= 3) h.idxEnd = ++j; }
    }
    // Kapak sayfası tek başına bir bölüm olmasın
    if (modHeads.length >= 4 && modHeads[0].page === 1 && modHeads[1].page === 2) modHeads = modHeads.slice(1);
    if (!modHeads.length) { // Hiç başlık yok: 8'er sayfalık parçalar
      const step = Math.max(4, Math.ceil(pageCount / 8));
      for (let p = 1; p <= pageCount; p += step) modHeads.push({ title: `Sayfa ${p}–${Math.min(pageCount, p + step - 1)}`, page: p, auto: true });
    }
    if (modHeads.length > 14) { // Birbirine çok yakın başlıkları komşusuyla birleştir
      const keep = [...modHeads]; while (keep.length > 14) { let bi = 1, bs = Infinity; for (let i = 1; i < keep.length; i++) { const span = (keep[i + 1] ? keep[i + 1].page : pageCount + 1) - keep[i].page; if (span < bs) { bs = span; bi = i; } } keep.splice(bi, 1); }
      modHeads = keep;
    }
    const modules = modHeads.map((h, i) => {
      const next = modHeads[i + 1]; const endP = next ? Math.max(h.page, next.page - (next.page > h.page ? 1 : 0)) : pageCount;
      const txt = joinParagraphs(h.auto ? pageBody(pages, h.page) : textAfter(pages, h, next ? next.page : pageCount, 2));
      const scenes = subHeads.filter(s => s.page >= h.page && s.page <= endP && low(s.title) !== low(h.title)).slice(0, 12).map(s => ({ title: s.title, page: s.page, note: "" }));
      return { title: h.title, pages: [h.page, endP], summary: firstSentences(txt, 3, 420), goal: "", scenes, npcs: [], clues: [], maps: [], handouts: [] };
    });

    // 2) NPC'ler: istatistik blokları + "Karakterler" bölümündeki alt başlıklar
    const npcs = []; const seen = new Set();
    const addNpc = (name, p, extra) => { name = clean(name).replace(/[:.]$/, ""); const k = low(name);
      if (!name || name.length > 50 || seen.has(k) || !/\p{L}{2}/u.test(name) || RX.statAC.test(name) || RX.statHP.test(name)) return;
      seen.add(k); npcs.push({ name, role: "", page: p, description: "", motivation: "", secret: "", stats: "", ...extra }); };
    for (let p = 1; p <= pageCount; p++) {
      const lines = (pages[p] && pages[p].lines) || [];
      for (let i = 0; i < lines.length; i++) {
        const t = clean(lines[i].t);
        const isStat = RX.statAC.test(t) || RX.statPF.test(t) || RX.statCoC.test(t) || RX.statYZE.test(t);
        if (!isStat) continue;
        // İsim: geriye doğru en fazla 4 satırda kısa, cümle olmayan ilk satır
        let name = "", role = "";
        for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
          const c = clean(lines[j].t); if (!c || RX.statHP.test(c) || /^[-–—_]+$/.test(c)) continue;
          if (/^(tiny|small|medium|large|huge|gargantuan|minik|küçük|orta|büyük|devasa|dev)\b.*,/i.test(c) || /^(creature|yaratık)\s+-?\d+/i.test(c)) { role = c; continue; }
          if (c.length <= 45 && !/[.!?]$/.test(c) && !/\d{2,}/.test(c)) { name = c.replace(/\s+(creature|yaratık)\s+-?\d+$/i, ""); break; }
          break;
        }
        if (!name) continue;
        const stats = lines.slice(i, i + 4).map(l => clean(l.t)).join(" · ");
        addNpc(name, p, { role, stats: cut(stats, 220) });
      }
    }
    const npcSec = heads.filter(h => RX.npcSec.test(h.title));
    for (const s of npcSec) {
      const after = heads.filter(h => h.size < s.size && (h.page > s.page || (h.page === s.page && h.idx > s.idx)));
      const stop = heads.find(h => h.size >= s.size && (h.page > s.page || (h.page === s.page && h.idx > s.idx)));
      for (const h of after) { if (stop && (h.page > stop.page || (h.page === stop.page && h.idx > stop.idx))) break; if (h.title.split(" ").length > 6) continue;
        const d = joinParagraphs(textAfter(pages, h, h.page + 1, 1)); addNpc(h.title, h.page, { description: firstSentences(d, 2, 260) }); }
    }
    for (const n of npcs) if (!n.description && !n.stats) {
      const p = pages[n.page]; const lines = (p && p.lines) || []; const i = lines.findIndex(l => low(clean(l.t)).startsWith(low(n.name)));
      if (i >= 0) n.description = firstSentences(joinParagraphs(lines.slice(i + 1, i + 8).map(l => l.t).filter(t => !RX.statAC.test(clean(t)) && !RX.statHP.test(clean(t))).join("\n")), 2, 220);
      const sec = sentences(n.description).find(s => RX.secret.test(s)); if (sec) n.secret = cut(sec, 200);
    }

    // 3) El notları ve haritalar: başlık/alt yazı satırları
    const handouts = [], maps = []; const hoP = new Set(), mapP = new Set();
    for (let p = 1; p <= pageCount; p++) {
      const lines = (pages[p] && pages[p].lines) || [];
      for (let i = 0; i < lines.length; i++) {
        const t = clean(lines[i].t); if (t.length > 70 || /[.!?]$/.test(t) && t.length > 40) continue;
        if (RX.handout.test(t) && !hoP.has(p + "|" + low(t))) { hoP.add(p + "|" + low(t)); handouts.push({ title: t, page: p, description: firstSentences(joinParagraphs(lines.slice(i + 1, i + 6).map(l => l.t).join("\n")), 1, 200) }); }
        else if (RX.map.test(t) && !mapP.has(p)) { mapP.add(p); maps.push({ title: t, page: p, description: "" }); }
      }
    }
    // Neredeyse hiç yazı olmayan görsel sayfaları harita adayı yap (kapak hariç)
    for (let p = 2; p <= pageCount; p++) {
      const pg = pages[p]; if (!pg || !pg.img || mapP.has(p) || [...hoP].some(k => k.startsWith(p + "|"))) continue;
      const chars = pageBody(pages, p).replace(/\s/g, "").length;
      if (chars < 250) { mapP.add(p); maps.push({ title: `Sayfa ${p} görseli`, page: p, description: "Yazısı az, tam sayfa bir görsel. Harita ya da çizim olabilir; açıp bak." }); }
    }
    maps.sort((a, b) => a.page - b.page); handouts.sort((a, b) => a.page - b.page);

    // 4) İpuçları
    const clues = [];
    for (let p = 1; p <= pageCount && clues.length < 60; p++) {
      for (const s of sentences(joinParagraphs(pageBody(pages, p)))) if (RX.clue.test(s) && s.length < 400) { clues.push({ text: cut(s, 220), page: p, leadsTo: "" }); if (clues.length >= 60) break; }
    }

    // 5) Modüllere dağıt
    const inMod = (m, p) => p >= m.pages[0] && p <= m.pages[1];
    for (const m of modules) {
      m.npcs = npcs.filter(n => inMod(m, n.page)).map(n => n.name).slice(0, 12);
      m.maps = maps.filter(x => inMod(m, x.page)).map(x => x.title).slice(0, 8);
      m.handouts = handouts.filter(x => inMod(m, x.page)).map(x => x.title).slice(0, 8);
      m.clues = clues.filter(x => inMod(m, x.page)).map(x => x.text).slice(0, 6);
    }

    // 6) Yönetici kılavuzu: ilgili bölümlerin ilk cümleleri
    const allHeads = heads.length ? heads : modHeads;
    const secText = rx => { const h = allHeads.find(x => rx.test(x.title)); if (!h) return ""; const nx = allHeads.find(x => x.size >= (h.size || 0) && (x.page > h.page || (x.page === h.page && (x.idx || 0) > (h.idx || 0)))); return joinParagraphs(textAfter(pages, h, nx ? nx.page : h.page + 2, 3)); };
    let intro = secText(RX.intro);
    if (!intro) intro = joinParagraphs([1, 2, 3].map(p => pageBody(pages, p)).join("\n"));
    const hook = secText(RX.hook), ending = secText(RX.end);
    const secrets = []; for (let p = 1; p <= pageCount && secrets.length < 6; p++) for (const s of sentences(joinParagraphs(pageBody(pages, p)))) { if (RX.secret.test(s) && s.length < 300 && !secrets.includes(s)) { secrets.push(cut(s, 220)); if (secrets.length >= 6) break; } }
    const guide = {
      premise: firstSentences(intro, 5, 700),
      hook: hook ? firstSentences(hook, 3, 400) : "",
      structure: modules.length ? `Senaryo ${modules.length} bölümden oluşuyor: ${modules.map(m => m.title).join(" → ")}.` : "",
      secrets,
      pacing: [
        `Toplam ${pageCount} sayfa. Her oturum için bir ya da iki bölüm hedefle.`,
        ...modules.filter(m => m.pages[1] - m.pages[0] >= 6).slice(0, 3).map(m => `"${m.title}" uzun bir bölüm (s. ${m.pages[0]}–${m.pages[1]}); iki oturuma bölmeyi düşün.`),
      ],
      ifStuck: clues.length ? [`Senaryoda ${clues.length} ipucu cümlesi bulundu; takılınca Modüller sekmesindeki ipuçlarından henüz verilmemiş olanı sun.`, "Bir NPC'yi oyuncuların yanına gönder ve bildiği bir şeyi söylet."] : ["Bir NPC'yi oyuncuların yanına gönder ve bildiği bir şeyi söylet.", "Kaçırdıkları bir ipucunu başka bir yerde yeniden karşılarına çıkar."],
      ending: ending ? firstSentences(ending, 4, 500) : "",
    };
    const title = clean(input.title) || (modHeads[0] && modHeads[0].title) || "Senaryo";
    return { title, guide, modules, npcs: npcs.slice(0, 60), handouts: handouts.slice(0, 40), maps: maps.slice(0, 40), clues, bodySize: body };
  }

  // Metinden satır nesneleri (yazı boyutu bilinmiyorken)
  function linesFromText(text) { return String(text || "").split("\n").filter(t => t.trim()).map(t => ({ t, s: 0, b: false })); }

  // pdf.js sayfasından satırlar: aynı yükseklikteki parçaları birleştirir, satırın yazı boyutunu ve kalınlığını tutar.
  async function pdfPageLines(page, OPS) {
    const tc = await page.getTextContent(); const styles = tc.styles || {};
    const lines = []; let cur = null, lastY = null;
    for (const it of tc.items) { if (!("str" in it)) continue;
      const y = it.transform[5], s = Math.hypot(it.transform[2], it.transform[3]) || it.height || 0;
      const fam = String((styles[it.fontName] || {}).fontFamily || "") + " " + String(it.fontName || "");
      const bold = /bold|black|heavy|semibold|demi/i.test(fam);
      if (!cur || lastY === null || Math.abs(y - lastY) > Math.max(2, s * 0.4)) { if (cur && cur.t.trim()) lines.push(cur); cur = { t: "", s: 0, b: true, n: 0 }; }
      if (it.str.trim()) { if (cur.t && !/\s$/.test(cur.t) && !/^\s/.test(it.str)) cur.t += " "; cur.t += it.str; cur.s = Math.max(cur.s, Math.round(s * 10) / 10); cur.b = cur.b && bold; cur.n++; }
      lastY = y; if (it.hasEOL) { if (cur.t.trim()) lines.push(cur); cur = null; lastY = null; }
    }
    if (cur && cur.t.trim()) lines.push(cur);
    let img = false;
    if (OPS) { try { const ol = await page.getOperatorList(); img = ol.fnArray.some(f => f === OPS.paintImageXObject || f === OPS.paintInlineImageXObject || f === OPS.paintImageXObjectRepeat); } catch (e) {} }
    return { lines: lines.map(l => ({ t: clean(l.t), s: l.s, b: l.n > 0 && l.b })), img };
  }

  async function pdfOutline(doc) {
    const out = []; let ol = null; try { ol = await doc.getOutline(); } catch (e) {} if (!ol) return out;
    const walk = async (items, depth) => { for (const it of items || []) { let page = 0;
      try { let dest = it.dest; if (typeof dest === "string") dest = await doc.getDestination(dest); if (Array.isArray(dest) && dest[0]) page = (await doc.getPageIndex(dest[0])) + 1; } catch (e) {}
      if (page) out.push({ title: it.title, page, depth }); if (depth < 3) await walk(it.items, depth + 1); } };
    await walk(ol, 0); return out;
  }

  const api = { analyze, linesFromText, pdfPageLines, pdfOutline, _findHeadings: findHeadings };
  if (typeof window !== "undefined") window.KuralCozumleyici = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})();
