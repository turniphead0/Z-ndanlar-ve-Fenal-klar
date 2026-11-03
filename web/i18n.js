/* Dil seçimi ve İngilizce arayüz.
   Uygulama metinleri Türkçe yazılıdır ve veriler (durum adları, hasar türleri…) Türkçe saklanır; böylece aynı masada
   Türkçe ve İngilizce oynayanlar birlikte oynayabilir. İngilizce seçiliyse ekrandaki metinler, ipuçları ve yer tutucular
   gösterilirken web/i18n/en.json sözlüğüyle çevrilir. Sözlükte {0}, {1}… değişen parçalardır; bunlar da ayrıca çevrilir.
   Dil ?lang=en|tr ile ya da arayüzdeki seçimle değişir ve bu tarayıcıda hatırlanır. */
(function () {
  "use strict";
  const KEY = "zm-lang";
  let lang = "tr";
  try { const q = new URLSearchParams(location.search).get("lang"); if (q === "en" || q === "tr") localStorage.setItem(KEY, q); lang = localStorage.getItem(KEY) === "en" ? "en" : "tr"; } catch (e) { }
  const I = window.I18N = { lang, t: s => s, set(l) { try { localStorage.setItem(KEY, l); } catch (e) { } try { window.zmDesktop && zmDesktop.setLang && zmDesktop.setLang(l); } catch (e) { } const u = new URL(location.href); u.searchParams.delete("lang"); location.replace(u.toString()); } };
  window.LANG = () => lang;
  document.documentElement.lang = lang;
  // Dil düğmeleri: data-lang-toggle taşıyan her düğme diğer dile geçer ve o dilin adını gösterir.
  const other = () => lang === "en" ? "tr" : "en";
  I.label = () => lang === "en" ? "Türkçe" : "English";
  document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-lang-toggle]"); if (b) { e.preventDefault(); I.set(other()); } });
  document.addEventListener("DOMContentLoaded", () => document.querySelectorAll("[data-lang-toggle] .lname").forEach(x => x.textContent = I.label()));
  if (lang !== "en") return;
  // Sözlük eşzamanlı yüklenir, böylece ilk çizimden önce hazırdır.
  document.write('<script src="/i18n/en.js"><\/script>');

  let exact = null, tpls = [], cache = new Map();
  const TR = /[çğıöşüÇĞİÖŞÜ]/;
  const ws = s => s.replace(/\s+/g, " ").trim();
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function compile(D) {
    exact = new Map(); tpls = [];
    for (const [k, v] of Object.entries(D)) {
      if (v == null || v === "") continue;
      if (!/\{\d+\}/.test(k)) { exact.set(k, v); continue; }
      const parts = k.split(/(\{\d+\})/), order = [];
      // Boş da olabilir; art arda iki parçada ilki açgözlüdür (sonraki çoğu zaman isteğe bağlı bir ektir).
      const src = parts.map((p, i) => { const m = p.match(/^\{(\d+)\}$/); if (m) { order.push(+m[1]); return parts[i + 1] === "" && /^\{\d+\}$/.test(parts[i + 2] || "") ? "(.*)" : "(.*?)"; } return esc(p); }).join("");
      const statics = parts.filter(p => !/^\{\d+\}$/.test(p)).map(p => p.trim()).filter(Boolean).sort((a, b) => b.length - a.length);
      if (!statics.length) continue;
      tpls.push({ re: new RegExp("^" + src + "$", "s"), order, v, anchor: statics[0], len: k.length });
    }
    tpls.sort((a, b) => b.len - a.len);
  }
  // Bir metni çevirir; bulunamazsa olduğu gibi döner.
  function t(s, depth = 0) {
    if (!exact || s == null) return s;
    const raw = String(s), core = ws(raw); if (!core || !/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(core)) return raw;
    let out = cache.get(core);
    if (out === undefined) { out = look(core, depth); if (cache.size > 20000) cache.clear(); cache.set(core, out); }
    if (out === core) return raw;
    const lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
    return (lead ? " " : "") + out + (trail && raw.trim() ? " " : "");
  }
  function look(s, depth) {
    const e = exact.get(s); if (e != null) return e;
    if (depth > 3) return s;
    // Birden çok kalıp uyabilir ("Gizli {0}" ve "{0} at"); parçaları da çevrilebilen ilk kalıp seçilir.
    let first = null;
    for (const x of tpls) {
      if (!s.includes(x.anchor)) continue;
      const m = s.match(x.re); if (!m) continue;
      let clean = true;
      const out = x.v.replace(/\{(\d+)\}/g, (_, n) => { const i = x.order.indexOf(+n); const g = i >= 0 ? m[i + 1] : ""; if (g == null) return ""; const r = t(g, depth + 1); if (TR.test(r)) clean = false; return r; });
      if (clean) return out;
      if (first == null) first = out;
    }
    if (first != null) return first;
    // Ayırıcılarla birleşmiş metinler (zar kayıtları, alt bilgiler): her parça ayrı çevrilir.
    for (const sep of [" · ", " — ", " → ", ": ", ", "]) if (s.includes(sep)) { const ps = s.split(sep), tr = ps.map(p => t(p, depth + 1)); if (tr.some((p, i) => p !== ps[i])) return tr.join(sep); }
    // Sayıyla başlayan metin ("3 kesici", "2 kişi"): sayı kalır, gerisi çevrilir.
    const nm = s.match(/^([\dd\s+\-−×=.,\/()]*\d)\s+([^\d\s].*)$/); if (nm) { const r = t(nm[2], depth + 1); if (r !== nm[2]) return nm[1] + " " + r; }
    const pm = s.match(/^(.*?)\s*\(([^()]+)\)$/); if (pm) { const a = t(pm[1], depth + 1), b = t(pm[2], depth + 1); if (a !== pm[1] || b !== pm[2]) return `${a} (${b})`; }
    return s;
  }
  I.t = t;

  /* ---------- ekrandaki metinler ---------- */
  const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE", "NOSCRIPT"]);
  const ATTRS = ["placeholder", "title", "aria-label", "alt"];
  const skipEl = el => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { if (SKIP.has(e.tagName) || e.isContentEditable || (e.dataset && "noi18n" in e.dataset)) return true; } return false; };
  function doText(n) { const v = n.nodeValue; if (!v || !v.trim()) return; const p = n.parentElement; if (!p || skipEl(p)) return; const r = t(v); if (r !== v) n.nodeValue = r; }
  function doAttrs(el) { for (const a of ATTRS) { const v = el.getAttribute && el.getAttribute(a); if (v) { const r = t(v); if (r !== v) el.setAttribute(a, r); } }
    if (el.tagName === "INPUT" && (el.type === "button" || el.type === "submit") && el.value) { const r = t(el.value); if (r !== el.value) el.value = r; } }
  function walk(root) {
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1 || SKIP.has(root.tagName)) return;
    if (root.dataset && "noi18n" in root.dataset) return;
    doAttrs(root);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode: n => n.nodeType === 1 && (SKIP.has(n.tagName) || (n.dataset && "noi18n" in n.dataset)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    let n; while ((n = tw.nextNode())) n.nodeType === 3 ? doText(n) : doAttrs(n);
  }
  let busy = false;
  const mo = new MutationObserver(list => {
    if (!exact || busy) return; busy = true;
    try { for (const m of list) {
      if (m.type === "childList") m.addedNodes.forEach(walk);
      else if (m.type === "characterData") doText(m.target);
      else if (m.type === "attributes") doAttrs(m.target);
    } } finally { busy = false; mo.takeRecords(); }
  });
  I.ready = D => {
    compile(D || window.ZM_EN || {});
    if (document.title) document.title = t(document.title);
    walk(document.documentElement);
    mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  };
  // Tuval (harita, birinci şahıs) ve bildirimler için: window.tr("…")
  window.tr = s => t(s);
})();
