/* Masaüstü eklentileri (13): çok katlı haritalar.
   Bir binanın her katı ayrı bir harita belgesidir: m.bld zemin katın kimliği, m.lvl kat numarası (0 zemin, eksi
   bodrum). Harita listesinde bina tek düğme olarak görünür, katlar haritanın üstündeki kat çubuğundan seçilir.
   Yeni kat altındaki katın boyutunu, duvarlarını ve merdivenlerini alır; böylece merdivenler üst üste gelir.
   Birinci şahıs görünümünde merdivendeki jeton FLOORS.climb ile bir üst ya da alt kata geçer. */
(function () {
  "use strict";

  const bldOf = m => m.bld && S.maps[m.bld] ? m.bld : m.id;
  const lvlOf = m => m.bld && S.maps[m.bld] ? +m.lvl || 0 : 0;
  const seen = m => isDM() || !m.hidden;
  function floors(m) { const b = bldOf(m); return Object.values(S.maps).filter(x => x && bldOf(x) === b && seen(x)).sort((a, c) => lvlOf(a) - lvlOf(c)); }
  function lvlName(l) { return l === 0 ? "Zemin kat" : l < 0 ? (l === -1 ? "Bodrum" : `${-l}. bodrum`) : `${l}. kat`; }
  function floorAt(m, l) { return floors(m).find(x => lvlOf(x) === l) || null; }

  function addFloor(base, dir) {
    const fl = floors(base), edge = dir > 0 ? fl[fl.length - 1] : fl[0], l = lvlOf(edge) + dir;
    const n = newMap(); Object.assign(n, { name: S.maps[bldOf(base)].name, bld: bldOf(base), lvl: l, cols: edge.cols, rows: edge.rows, hidden: !!edge.hidden, fogOn: !!edge.fogOn });
    for (const [k, v] of Object.entries(edge.cells || {})) if (v === "wall" || v === "stairs") n.cells[k] = v;   // dış duvarlar ve merdiven boşluğu
    save("maps", n); S.mapId = n.id; S.selTok = null; S.selLab = null; render();
    toast(`${lvlName(l)} eklendi. Duvarlar ve merdivenler alttaki kattan kopyalandı.`);
  }

  // Jetonu merdivenden bir üst/alt kata taşır; varılan kat haritasını döndürür.
  function climb(m, t, dir) {
    const to = floorAt(m, lvlOf(m) + dir);
    if (!to) return { err: dir > 0 ? "Yukarıda kat yok" : "Aşağıda kat yok" };
    if (!isDM() && to.hidden) return { err: "Bu kat henüz açılmadı" };
    const sz = +t.size || 1, ok = (x, y) => { for (let i = 0; i < sz; i++) for (let j = 0; j < sz; j++) { const cx = x + i, cy = y + j;
      if (cx < 0 || cy < 0 || cx >= to.cols || cy >= to.rows) return false; const v = to.cells?.[cx + "," + cy];
      if (["wall", "tree", "pit", "lava"].includes(v) || (window.PROPS && PROPS.solid(to.props?.[cx + "," + cy]))) return false;
      if (toks(to).some(o => o.id !== t.id && cx >= o.x && cx < o.x + (+o.size || 1) && cy >= o.y && cy < o.y + (+o.size || 1))) return false; } return true; };
    let p = null;
    for (let r = 0; r < 6 && !p; r++) for (let dy = -r; dy <= r && !p; dy++) for (let dx = -r; dx <= r && !p; dx++)
      if (Math.max(Math.abs(dx), Math.abs(dy)) === r && ok(t.x + dx, t.y + dy)) p = { x: t.x + dx, y: t.y + dy };
    if (!p) return { err: "Varış katında boş yer yok" };
    const nt = { ...clone(t), x: p.x, y: p.y, removed: false };
    t.removed = true; save("maps", m, ["tokens." + t.id + ".removed"]);
    to.tokens = to.tokens || {}; to.tokens[t.id] = nt; save("maps", to, ["tokens." + t.id]);
    S.mapId = to.id; S.selTok = t.id;
    return { map: to, tok: nt };
  }

  /* ---------- harita listesi ve kat çubuğu ---------- */
  const _render = window.render;
  window.render = function () {
    _render.apply(this, arguments);
    if (S.view !== "harita" || !G.id) return;
    const m = curMap(), main = $("#main"); if (!m || !main) return;
    // Liste: üst/alt katlar ayrı düğme olarak görünmez, binanın düğmesi seçili kalır.
    $$('[data-act="selmap"]', main).forEach(b => { const x = S.maps[b.dataset.id]; if (!x) return;
      if (x.bld && S.maps[x.bld] && x.bld !== x.id) b.remove(); else if (bldOf(m) === x.id) b.setAttribute("aria-pressed", "true"); });
    const fl = floors(m), dm = isDM() && !S.ro;
    if (fl.length < 2 && !dm) return;
    const bar = document.createElement("div"); bar.className = "tools sub kat-bar"; bar.setAttribute("role", "toolbar"); bar.setAttribute("aria-label", "Katlar");
    bar.innerHTML = `<span class="lbl">Kat</span>` + [...fl].reverse().map(x => `<button class="tool" data-kat="${esc(x.id)}" aria-pressed="${x.id === m.id}">${esc(lvlName(lvlOf(x)))}${x.hidden && isDM() ? " (gizli)" : ""}</button>`).join("") +
      (dm ? `<span class="tsep"></span><button class="tool" data-katadd="1">+ Üst kat</button><button class="tool" data-katadd="-1">+ Bodrum</button>` : "") +
      (fl.length > 1 ? `<span class="hint kat-hint">Katlar arasında merdivenden geçilir (birinci şahısta Boşluk tuşu).</span>` : "");
    const tools = $('.tools[role="toolbar"]', main); tools ? tools.before(bar) : null;
  };

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-kat],[data-katadd]"); if (!b) return;
    if (b.dataset.kat) { S.mapId = b.dataset.kat; S.selTok = null; S.selLab = null; return render(); }
    const m = curMap(); if (!m || !isDM() || S.ro) return; addFloor(m, +b.dataset.katadd);
  });

  window.FLOORS = { floors, lvlOf, lvlName, floorAt, climb, bldOf };
})();
