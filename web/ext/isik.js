/* Masaüstü eklentileri (14): dinamik ışık ve görüş.
   DM haritada dinamik ışığı açınca (m.light = {on, amb}) oyuncular yalnızca jetonlarının görebildiği yeri görür:
   duvarlar ve kapılar görüşü ve ışığı keser, ışık kaynakları (mobilyalar, lav, jetonun taşıdığı ışık) parlak ve loş
   alan aydınlatır, karanlıkta görme (karakter kağıdından ya da jetondan) karanlığı gri tonlarda gösterir, görüş
   mesafesi uzağı keser. Görülen yerler oturum boyunca soluk hatırlanır. DM her şeyi görür, ışığı hafif bir
   gölgeyle izler. Birinci şahıs görünümü aynı hesabı kullanır. DM jetonu da buradan eklenir. */
(function () {
  "use strict";

  // Işık kaynakları: [parlak ft, loş ft]
  const PROP_LIGHT = { mum: [5, 5], kandil: [15, 30], kamp: [20, 20], mesale: [20, 20], fener: [30, 30], kure: [5, 5], yanardag: [30, 30], iksir: [0, 5] };
  const TERR_LIGHT = { lava: [10, 10] };
  const TOK_LIGHT = [["", "Yok"], ["mum", "Mum (5/5 ft)"], ["mesale", "Meşale (20/20 ft)"], ["fener", "Fener (30/30 ft)"], ["isik", "Işık büyüsü (20/20 ft)"], ["gunes", "Güneş ışığı (30/30 ft)"]];
  const TOK_LIGHT_FT = { mum: [5, 5], mesale: [20, 20], fener: [30, 30], isik: [20, 20], gunes: [30, 30] };
  const AMB = [["dark", "Karanlık"], ["dim", "Loş"], ["bright", "Aydınlık"]];
  const AMB_LVL = { dark: 0, dim: .5, bright: 1 };

  const on = m => !!(m && m.light && m.light.on);
  const opaque = (m, x, y) => x < 0 || y < 0 || x >= m.cols || y >= m.rows || m.cells?.[x + "," + y] === "wall" || m.cells?.[x + "," + y] === "door";

  // Görüş hattı: iki kare merkezi arasındaki ara kareler opak değilse görünür.
  function los(m, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.hypot(dx, dy) * 3);
    for (let i = 1; i < n; i++) { const x = Math.floor(x0 + .5 + dx * i / n), y = Math.floor(y0 + .5 + dy * i / n);
      if ((x === x0 && y === y0) || (x === x1 && y === y1)) continue; if (opaque(m, x, y)) return false; }
    return true;
  }

  function sheetDv(t) {   // karakter kağıdında ya da canavar kartında "karanlıkta görüş 60 ft"
    const doc = t.charId ? S.chars[t.charId] : t.monsterId ? S.monsters[t.monsterId] : null; if (!doc) return 0;
    const s = JSON.stringify(doc); const mm = s.match(/karanl[ıi]kta g[öo]r[üu][şs][^0-9"]{0,12}(\d{1,3})/i) || s.match(/darkvision[^0-9"]{0,8}(\d{1,3})/i);
    return mm ? +mm[1] : /karanl[ıi]kta g[öo]r/i.test(s) ? 60 : 0;
  }
  const dvOf = t => t.dv !== undefined && t.dv !== "" ? +t.dv || 0 : sheetDv(t);
  const sightOf = t => +t.sight || 0;   // 0 = sınırsız

  function sources(m) {
    const out = [];
    for (const [k, v] of Object.entries(m.props || {})) { const l = v && (PROP_LIGHT[v] || (v.startsWith("c:") && lightOfCustom(v))); if (l) { const [x, y] = k.split(",").map(Number); out.push({ x, y, b: l[0], d: l[1] }); } }
    for (const [k, v] of Object.entries(m.cells || {})) { const l = TERR_LIGHT[v]; if (l) { const [x, y] = k.split(",").map(Number); out.push({ x, y, b: l[0], d: l[1] }); } }
    for (const t of toks(m)) { const l = TOK_LIGHT_FT[t.light]; if (l) { const sz = +t.size || 1; out.push({ x: t.x + (sz - 1) / 2, y: t.y + (sz - 1) / 2, b: l[0], d: l[1], tok: true }); } }
    return out;
  }
  function lightOfCustom(v) { const p = (S.games[G.id]?.props || {})[v.slice(2)]; return p && !p.removed && +p.light ? [+p.light, +p.light] : null; }

  // Sonuç: lit (ışık 0..1), see (gösterilen parlaklık 0..1), gray (yalnızca karanlıkta görme ile görülen), warm (kaynak ışığı)
  const cache = {}, mem = {};
  function compute(m, viewers, key) {
    const W = m.cols, H = m.rows, N = W * H, amb = AMB_LVL[m.light?.amb || "dark"] ?? 0;
    const lit = new Float32Array(N).fill(amb), warm = new Float32Array(N), see = new Float32Array(N), gray = new Uint8Array(N);
    for (const s of sources(m)) {
      const R = (s.b + s.d) / 5, sx = Math.round(s.x), sy = Math.round(s.y);
      for (let y = Math.max(0, Math.floor(sy - R)); y <= Math.min(H - 1, Math.ceil(sy + R)); y++)
        for (let x = Math.max(0, Math.floor(sx - R)); x <= Math.min(W - 1, Math.ceil(sx + R)); x++) {
          const d = Math.hypot(x - s.x, y - s.y) * 5; if (d > s.b + s.d) continue;
          const v = d <= s.b ? 1 : .5 * (1 - (d - s.b) / Math.max(1, s.d)) + .25;
          if (v <= lit[y * W + x] && v <= warm[y * W + x]) continue;
          if (!los(m, sx, sy, x, y)) continue;
          const i = y * W + x; if (v > lit[i]) lit[i] = v; if (v > warm[i]) warm[i] = v;
        }
    }
    if (!viewers) { for (let i = 0; i < N; i++) see[i] = lit[i]; return { W, H, lit, see, gray, warm, key }; }
    for (const t of viewers) {
      const sz = +t.size || 1, vx = t.x + (sz - 1) / 2, vy = t.y + (sz - 1) / 2, cx = Math.round(vx), cy = Math.round(vy), dv = dvOf(t) / 5, sr = sightOf(t) / 5;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, d = Math.hypot(x - vx, y - vy); if (sr && d > sr + .5) continue;
        const l = lit[i], inDv = dv && d <= dv + .5; if (l <= 0 && !inDv) continue;
        if (see[i] >= 1) continue;
        if (!(Math.abs(x - cx) <= sz && Math.abs(y - cy) <= sz) && !los(m, cx, cy, x, y)) continue;
        const v = inDv ? (l > 0 ? 1 : .55) : l;    // karanlıkta görme: loş ışık parlak, karanlık gri
        if (v > see[i]) { see[i] = v; gray[i] = inDv && l <= 0 ? 1 : 0; }
      }
    }
    const mm = mem[m.id] && mem[m.id].length === N ? mem[m.id] : (mem[m.id] = new Uint8Array(N));
    for (let i = 0; i < N; i++) if (see[i] > 0) mm[i] = 1;
    return { W, H, lit, see, gray, warm, key, mem: mm };
  }
  function keyOf(m, viewers) {
    return [m.id, m.cols, m.rows, JSON.stringify(m.light), JSON.stringify(m.cells), JSON.stringify(m.props || {}),
      toks(m).map(t => [t.id, t.x, t.y, t.size, t.light, t.dv, t.sight].join(",")).join(";"), viewers ? viewers.map(t => t.id).join(",") : "*",
      JSON.stringify(Object.values(S.games[G.id]?.props || {}).map(p => p && p.light))].join("§");
  }
  function view(m, viewers) {
    const key = keyOf(m, viewers), slot = m.id + "|" + (viewers ? viewers.map(t => t.id).join(",") : "*");
    if (cache[slot]?.key === key) return cache[slot];
    return cache[slot] = compute(m, viewers, key);
  }

  // 2B: oyuncunun gözleri kendi jetonları; hiç jetonu yoksa grubun bütün karakter jetonları.
  function viewers2D(m) {
    const mine = toks(m).filter(t => t.charId && S.chars[t.charId]?.owner === ME.id);
    return mine.length ? mine : toks(m).filter(t => t.charId);
  }
  const playerView = m => view(m, viewers2D(m));
  function cellSeen(m, x, y) { const v = playerView(m); return x >= 0 && y >= 0 && x < v.W && y < v.H && v.see[y * v.W + x] > 0; }
  function tokHidden(m, t) {   // oyuncu için gizli mi (DM her şeyi görür)
    if (isDM()) return false;
    if (t.gm && t.gmHidden) return true;
    if (!on(m) || (t.charId && S.chars[t.charId]?.owner === ME.id)) return false;
    const sz = +t.size || 1; for (let i = 0; i < sz; i++) for (let j = 0; j < sz; j++) if (cellSeen(m, t.x + i, t.y + j)) return false;
    return true;
  }

  const sm = document.createElement("canvas"), wm = document.createElement("canvas");
  function draw2D(ctx, m, s) {
    if (!on(m)) return; const dm = isDM(), v = dm ? view(m, null) : playerView(m), W = v.W, H = v.H;
    sm.width = wm.width = W; sm.height = wm.height = H;
    const a = sm.getContext("2d"), b = wm.getContext("2d"), da = a.createImageData(W, H), db = b.createImageData(W, H), fog = rgbOf(cssVar("--fog") || "#05070a");
    for (let i = 0; i < W * H; i++) {
      const sv = v.see[i]; let al;
      if (dm) al = (1 - v.lit[i]) * .45;
      else al = sv > 0 ? (1 - sv) * .8 + (v.gray[i] ? .1 : 0) : v.mem && v.mem[i] ? .72 : 1;
      da.data[i * 4] = fog[0]; da.data[i * 4 + 1] = fog[1]; da.data[i * 4 + 2] = v.gray[i] ? Math.min(255, fog[2] + 40) : fog[2]; da.data[i * 4 + 3] = Math.round(al * 255);
      const w = (dm || sv > 0) && !v.gray[i] ? v.warm[i] : 0;
      db.data[i * 4] = 255; db.data[i * 4 + 1] = 176; db.data[i * 4 + 2] = 80; db.data[i * 4 + 3] = Math.round(w * 40);
    }
    a.putImageData(da, 0, 0); b.putImageData(db, 0, 0);
    ctx.save(); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(wm, 0, 0, W * s, H * s); ctx.drawImage(sm, 0, 0, W * s, H * s); ctx.restore();
  }
  function rgbOf(c) { const x = document.createElement("canvas").getContext("2d"); x.fillStyle = c; const h = x.fillStyle; return h[0] === "#" ? [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) : (h.match(/\d+/g) || [5, 7, 10]).slice(0, 3).map(Number); }

  /* ---------- harita ve jeton panelleri ---------- */
  const _render = window.render;
  window.render = function () {
    _render.apply(this, arguments);
    if (S.view !== "harita" || !G.id) return;
    const m = curMap(), main = $("#main"); if (!m || !main) return;
    const panels = $$(".panel", main), h3 = p => ($("h3", p)?.textContent || "").trim();
    // Işık paneli (DM)
    const sis = panels.find(p => h3(p).startsWith("Sis"));
    if (sis && isDM() && !S.ro && !$("#lightPanel", main)) {
      const el = document.createElement("div"); el.className = "panel"; el.id = "lightPanel";
      el.innerHTML = `<h3>Işık <span class="dmtag">DM</span></h3>
        <label class="toggle"><input type="checkbox" data-lm="on" ${on(m) ? "checked" : ""}> Dinamik ışık</label>
        <label style="display:block;margin-top:8px"><span class="lbl">Ortam ışığı</span><select class="f" data-lm="amb">${AMB.map(([k, n]) => `<option value="${k}" ${(m.light?.amb || "dark") === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <p class="hint">Açıkken oyuncular yalnızca jetonlarının görebildiği yeri görür. Duvarlar ve kapılar görüşü keser. Mum, kandil, meşale, kamp ateşi, fener ve lav ışık verir; jetonlara da ışık verilebilir. Karanlıkta görme karakter kağıdından okunur.</p>`;
      sis.after(el);
    }
    // Seçili jeton: ışık, karanlıkta görme, görüş mesafesi
    const sel = panels.find(p => h3(p) === "Seçili jeton"), t = m.tokens?.[S.selTok];
    if (sel && t && !t.removed && ownsTok(t) && !S.ro && !$("#tokLight", sel)) {
      const g = $(".fgrid", sel), del = $('[data-act="deltok"]', sel), el = document.createElement("div"); el.className = "w2 fgrid"; el.id = "tokLight"; el.style.margin = "0";
      const auto = sheetDv(t);
      el.innerHTML = `<label class="w2"><span class="lbl">Taşıdığı ışık</span><select class="f" data-lt="light">${TOK_LIGHT.map(([k, n]) => `<option value="${k}" ${(t.light || "") === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <label><span class="lbl">Karanlıkta görme (ft)</span><input class="f num" type="number" min="0" step="5" data-lt="dv" value="${t.dv ?? ""}" placeholder="${auto ? auto + " (kağıttan)" : "yok"}"></label>
        <label><span class="lbl">Görüş mesafesi (ft)</span><input class="f num" type="number" min="0" step="5" data-lt="sight" value="${t.sight || ""}" placeholder="sınırsız"></label>
        ${t.gm ? `<label class="toggle w2"><input type="checkbox" data-lt="gmShow" ${t.gmHidden ? "" : "checked"}> Oyunculara görünsün</label>` : ""}`;
      if (g) del ? g.insertBefore(el, del) : g.appendChild(el);
    }
    // DM jetonu
    const add = $('[data-act="addtok"]', main);
    if (add && isDM() && !S.ro && !$('[data-lt="gmtok"]', main)) {
      const b = document.createElement("button"); b.className = "btn sm"; b.dataset.lt = "gmtok"; b.textContent = toks(m).some(x => x.gm) ? "DM jetonunu seç" : "+ DM jetonu"; add.after(b);
    }
  };

  document.addEventListener("change", e => {
    const el = e.target, m = curMap(); if (!m || !el.dataset) return;
    if (el.dataset.lm) { if (!isDM()) return; m.light = m.light || { on: false, amb: "dark" };
      if (el.dataset.lm === "on") m.light.on = el.checked; else m.light.amb = el.value;
      save("maps", m, ["light"]); render(); if (el.dataset.lm === "on") toast(el.checked ? "Dinamik ışık açık: oyuncular yalnızca gördüklerini görür" : "Dinamik ışık kapandı"); return; }
    const k = el.dataset.lt; if (!k || k === "gmtok") return; const t = m.tokens?.[S.selTok]; if (!t || !ownsTok(t)) return;
    if (k === "gmShow") { t.gmHidden = !el.checked; save("maps", m, ["tokens." + t.id + ".gmHidden"]); }
    else { t[k] = el.type === "number" ? (el.value === "" ? "" : Math.max(0, +el.value)) : el.value; save("maps", m, ["tokens." + t.id + "." + k]); }
    drawMap();
  });
  document.addEventListener("click", e => {
    const b = e.target.closest('[data-lt="gmtok"]'); if (!b || !isDM()) return; const m = curMap(); if (!m) return;
    let t = toks(m).find(x => x.gm);
    if (!t) { const p = freeCell(m); t = { id: uid("t"), label: "DM", color: "#c9a227", x: p.x, y: p.y, size: 1, gm: true, gmHidden: true, light: "", dv: 120 }; m.tokens[t.id] = t; save("maps", m, ["tokens." + t.id]);
      toast("DM jetonu eklendi. Oyunculardan gizli; birinci şahısta bu jetonla gezebilirsin."); }
    S.selTok = t.id; render();
  });

  window.LIGHT = { on, view, playerView, tokHidden, draw2D, opaque, dvOf, sightOf, PROP_LIGHT };
})();
