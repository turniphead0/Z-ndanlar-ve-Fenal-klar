/* Masaüstü eklentileri (1): sekmeleri ayrı pencerede açma ve haritadaki açılır savaş takipçisi.
   app.html'deki küresel işlevleri (render, stepTurn, ...) sarmalar; uygulamanın kendi koduna dokunmaz. */
(function () {
  "use strict";
  const LS = { get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const POP = window.ZM_POP;

  /* ---------------- Ayrı pencere ---------------- */
  if (POP) {
    document.documentElement.classList.add("zm-pop");
    document.title = (VIEWN[POP] || "Zar Masası") + " · Zar Masası";
    // Ayrı pencereler ses çalmaz; müzik ve efektler ana pencereden gelir, iki kez duyulmasın.
    const quiet = name => { const f = window[name]; if (typeof f === "function") window[name] = function () { if (POP) return; return f.apply(this, arguments); }; };
    ["applyAudioState", "playSfxLocal", "diceSound"].forEach(quiet);
  }

  function popOut(view) {
    const u = new URL(location.href);
    u.search = "?pop=" + encodeURIComponent(view);
    u.hash = G.id || "";
    const w = window.open(u.toString(), "zm-" + view, "width=1180,height=820");
    if (!w) toast("Pencere açılamadı. Tarayıcın açılır pencereleri engelliyor olabilir.");
  }

  /* ---------------- Haritada savaş takipçisi ---------------- */
  const st = Object.assign({ open: false, x: null, y: 90, w: 380, h: 460 }, LS.get("zm-combatpop") || {});
  const keep = () => LS.set("zm-combatpop", st);

  function combatPop() {
    const main = $("#main"); let el = $("#zmCombat");
    const want = G.id && S.view === "harita" && st.open && S.loaded.combat;
    if (!want) { if (el) el.remove(); return; }
    if (!el || el.parentNode !== main) {
      el = document.createElement("section"); el.id = "zmCombat"; el.className = "zm-float"; el.setAttribute("aria-label", "Savaş takipçisi");
      main.appendChild(el);
    }
    const x = st.x == null ? Math.max(16, innerWidth - st.w - 360) : st.x;
    Object.assign(el.style, { left: Math.min(x, innerWidth - 120) + "px", top: Math.min(st.y, innerHeight - 60) + "px", width: st.w + "px", height: st.h + "px" });
    const cb = combat();
    el.innerHTML = `<header class="zm-float-h" data-zm-drag><b>Savaş</b>${cb.started ? `<span class="zm-float-sub">Tur ${esc(cb.round)}</span>` : ""}<span class="sp"></span><button class="btn sm" data-zm="closecombat" aria-label="Kapat">×</button></header>
      <div class="zm-float-b"><div class="zm-float-ctl">${combatControls()}</div>${combatTracker()}</div>`;
  }

  function mapToolButton() {
    if (S.view !== "harita") return;
    const bar = $("#main .tools[role=toolbar]"); if (!bar || $("[data-zm=togglecombat]", bar)) return;
    const cb = S.combat && S.combat.current;
    const b = document.createElement("button");
    b.className = "tool"; b.dataset.zm = "togglecombat"; b.setAttribute("aria-pressed", String(st.open));
    b.textContent = cb && cb.started ? `Savaş · Tur ${cb.round}` : "Savaş sırası";
    b.title = "İnisiyatif sırasını haritanın üstünde aç";
    bar.insertBefore(b, bar.firstChild);
  }

  function popButton() {
    if (POP || !G.id) return;
    const h = $("#main .vhead"); if (!h || $("[data-zm=pop]", h)) return;
    const b = document.createElement("button");
    b.className = "btn sm zm-popbtn"; b.dataset.zm = "pop"; b.title = "Bu bölümü ayrı bir pencerede aç";
    b.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></svg> Ayrı pencere`;
    h.appendChild(b);
  }

  function after() { popButton(); mapToolButton(); combatPop(); }
  const _render = window.render;
  window.render = function () { const r = _render.apply(this, arguments); try { after(); } catch (e) { console.error(e); } return r; };
  const _step = window.stepTurn;
  window.stepTurn = function () { const r = _step.apply(this, arguments); try { combatPop(); } catch (e) {} return r; };

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-zm]"); if (!b) return;
    const a = b.dataset.zm;
    if (a === "pop") popOut(S.view);
    else if (a === "togglecombat") { st.open = !st.open; keep(); render(); }
    else if (a === "closecombat") { st.open = false; keep(); render(); }
  });

  // Sürükleme: başlıktan tut, bırakınca konumu ve boyutu hatırla.
  let drag = null;
  document.addEventListener("pointerdown", e => {
    const h = e.target.closest("[data-zm-drag]"); if (!h || e.target.closest("button")) return;
    const el = h.parentNode, r = el.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, el }; h.setPointerCapture(e.pointerId); e.preventDefault();
  });
  document.addEventListener("pointermove", e => {
    if (!drag) return;
    st.x = Math.max(0, Math.min(innerWidth - 80, e.clientX - drag.dx)); st.y = Math.max(0, Math.min(innerHeight - 40, e.clientY - drag.dy));
    drag.el.style.left = st.x + "px"; drag.el.style.top = st.y + "px";
  });
  document.addEventListener("pointerup", () => { if (drag) { drag = null; keep(); } });
  // Köşeden yeniden boyutlandırma (CSS resize) bitince boyutu kaydet.
  let sizeT = 0;
  const resizeWatch = new ResizeObserver(es => { for (const en of es) { const r = en.target.getBoundingClientRect(); if (r.width > 200 && en.target.isConnected) { st.w = Math.round(r.width); st.h = Math.round(r.height); clearTimeout(sizeT); sizeT = setTimeout(keep, 300); } } });
  new MutationObserver(() => { const el = $("#zmCombat"); if (el && !el._zmWatched) { el._zmWatched = true; resizeWatch.observe(el); } }).observe(document.body, { childList: true, subtree: true });
})();
