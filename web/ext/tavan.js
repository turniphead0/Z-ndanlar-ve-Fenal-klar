/* Masaüstü eklentileri (15): birinci şahısta tavan ve gökyüzü.
   Her karenin üstü ya tavanlı ya da açıktır. Kendiliğinden (m.roofMode "auto"): haritanın kenarından duvar ve kapı
   aşmadan varılamayan kareler, yani duvarla çevrili odalar tavanlıdır; gerisi gökyüzüne açıktır. DM haritanın
   tamamını "hep tavan" ya da "hep gök" yapabilir ve harita editöründeki "Tavan / gök" fırçasıyla tek tek alanları
   değiştirebilir (m.roof["x,y"] = "ceil" | "sky"). Gökyüzü gündüz, alacakaranlık ya da gece olabilir (m.sky);
   kendiliğinden seçilirse dinamik ışığın ortam ışığına uyar. */
(function () {
  "use strict";

  const MODES = [["auto", "Kendiliğinden"], ["ceil", "Her yer tavanlı"], ["sky", "Her yer açık"]];
  const SKIES = [["auto", "Işığa göre"], ["day", "Gündüz"], ["dusk", "Alacakaranlık"], ["night", "Gece"]];
  const KINDS = [["ceil", "Tavan"], ["sky", "Gökyüzü"], ["", "Kendiliğinden"]];
  const CLOSE = v => v === "wall" || v === "door";

  /* ---------- hangi karenin üstü kapalı ---------- */
  const gridCache = {};
  // 1 = tavan, 0 = gökyüzü; boyut cols*rows.
  function grid(m) {
    const W = m.cols, H = m.rows, mode = m.roofMode || "auto";
    const key = [W, H, mode, JSON.stringify(m.roof || {}), mode === "auto" ? JSON.stringify(m.cells || {}) : ""].join("§");
    if (gridCache[m.id]?.key === key) return gridCache[m.id].g;
    const g = new Uint8Array(W * H);
    if (mode === "ceil") g.fill(1);
    else if (mode === "auto") {
      // Kenardan duvar/kapı aşmadan yayıl: varılan yerler açık, varılamayanlar kapalı.
      const out = new Uint8Array(W * H), st = [], wall = i => CLOSE(m.cells?.[(i % W) + "," + ((i / W) | 0)]);
      const push = i => { if (!out[i] && !wall(i)) { out[i] = 1; st.push(i); } };
      for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
      for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
      while (st.length) { const i = st.pop(), x = i % W, y = (i / W) | 0;
        if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (y > 0) push(i - W); if (y < H - 1) push(i + W); }
      for (let i = 0; i < W * H; i++) if (!out[i] && !wall(i)) g[i] = 1;
      // Duvarlar ve kapılar: yanında kapalı bir kare varsa onlar da tavanın altında sayılır.
      for (let i = 0; i < W * H; i++) if (wall(i)) { const x = i % W, y = (i / W) | 0;
        if ((x > 0 && g[i - 1] && !wall(i - 1)) || (x < W - 1 && g[i + 1] && !wall(i + 1)) || (y > 0 && g[i - W] && !wall(i - W)) || (y < H - 1 && g[i + W] && !wall(i + W))) g[i] = 1; }
    }
    for (const [k, v] of Object.entries(m.roof || {})) { if (!v) continue; const [x, y] = k.split(",").map(Number);
      if (x >= 0 && y >= 0 && x < W && y < H) g[y * W + x] = v === "ceil" ? 1 : 0; }
    gridCache[m.id] = { key, g }; return g;
  }

  function skyKind(m) {
    const s = m.sky || "auto"; if (s !== "auto") return s;
    if (m.light && m.light.on) return { dark: "night", dim: "dusk" }[m.light.amb || "dark"] || "day";
    return "day";
  }

  /* ---------- dokular ---------- */
  function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const SKY_W = 2048, SKY_H = 192, skyCache = {};
  const PAL = {
    day: [[0, "#2f6fc9"], [.6, "#78afe6"], [1, "#d6ebf7"]],
    dusk: [[0, "#1f2252"], [.45, "#6b3f78"], [.8, "#d0697a"], [1, "#f6b066"]],
    night: [[0, "#03050f"], [.7, "#0b1530"], [1, "#1e2c4c"]]
  };
  // Yatayda sarılan gökyüzü panoraması: üst satır tepe, alt satır ufuk.
  function skyTex(kind) {
    if (skyCache[kind]) return skyCache[kind];
    const c = document.createElement("canvas"); c.width = SKY_W; c.height = SKY_H; const x = c.getContext("2d"), r = rnd(kind.length * 7919 + 17);
    const g = x.createLinearGradient(0, 0, 0, SKY_H); for (const [o, col] of PAL[kind] || PAL.day) g.addColorStop(o, col);
    x.fillStyle = g; x.fillRect(0, 0, SKY_W, SKY_H);
    const wrap = f => { for (const dx of [-SKY_W, 0, SKY_W]) { x.save(); x.translate(dx, 0); f(); x.restore(); } };
    if (kind === "night") {
      for (let i = 0; i < 900; i++) { const sx = r() * SKY_W, sy = Math.pow(r(), 1.4) * SKY_H * .85, a = .35 + r() * .65, z = r() < .08 ? 2 : 1;
        x.fillStyle = `rgba(255,255,${200 + (r() * 55 | 0)},${a.toFixed(2)})`; x.fillRect(sx, sy, z, z); }
      const mx = SKY_W * .3, my = SKY_H * .3; wrap(() => { const h = x.createRadialGradient(mx, my, 6, mx, my, 40); h.addColorStop(0, "rgba(220,230,255,.35)"); h.addColorStop(1, "rgba(220,230,255,0)");
        x.fillStyle = h; x.fillRect(mx - 40, my - 40, 80, 80); x.fillStyle = "#eef1f8"; x.beginPath(); x.arc(mx, my, 11, 0, 7); x.fill();
        x.fillStyle = "rgba(160,170,190,.35)"; x.beginPath(); x.arc(mx - 3, my - 2, 3, 0, 7); x.arc(mx + 4, my + 3, 2, 0, 7); x.fill(); });
    } else {
      if (kind === "day") { const sx = SKY_W * .72, sy = SKY_H * .22; wrap(() => { const h = x.createRadialGradient(sx, sy, 4, sx, sy, 60); h.addColorStop(0, "rgba(255,250,220,.95)"); h.addColorStop(.25, "rgba(255,245,200,.45)"); h.addColorStop(1, "rgba(255,245,200,0)"); x.fillStyle = h; x.fillRect(sx - 60, sy - 60, 120, 120); }); }
      if (kind === "dusk") { const sx = SKY_W * .55, sy = SKY_H * .93; wrap(() => { const h = x.createRadialGradient(sx, sy, 4, sx, sy, 90); h.addColorStop(0, "rgba(255,220,150,.95)"); h.addColorStop(.3, "rgba(255,170,90,.4)"); h.addColorStop(1, "rgba(255,160,90,0)"); x.fillStyle = h; x.fillRect(sx - 90, sy - 90, 180, 180); }); }
      const cloud = kind === "dusk" ? [70, 50, 90] : [255, 255, 255];
      for (let i = 0; i < 48; i++) { const cx = r() * SKY_W, cy = SKY_H * (.15 + r() * .65), w = 40 + r() * 90, a = (kind === "dusk" ? .35 : .55) * (.5 + r() * .5);
        wrap(() => { for (let k = 0; k < 7; k++) { const px = cx + (r() - .5) * w, py = cy + (r() - .5) * w * .18, rr = w * (.15 + r() * .2);
          const h = x.createRadialGradient(px, py, 1, px, py, rr); h.addColorStop(0, `rgba(${cloud},${a.toFixed(2)})`); h.addColorStop(1, `rgba(${cloud},0)`);
          x.fillStyle = h; x.beginPath(); x.ellipse(px, py, rr, rr * .45, 0, 0, 7); x.fill(); } }); }
    }
    return skyCache[kind] = { w: SKY_W, h: SKY_H, data: new Uint32Array(x.getImageData(0, 0, SKY_W, SKY_H).data.buffer.slice(0)) };
  }

  const ceilCache = {};
  // Ahşap tavan: tahtalar ve her karenin kenarında bir kiriş. 64×64, karo karo tekrar eder.
  function ceilTex(base) {
    if (ceilCache[base]) return ceilCache[base];
    const T = 64, c = document.createElement("canvas"); c.width = c.height = T; const x = c.getContext("2d"), r = rnd(4242);
    x.fillStyle = base; x.fillRect(0, 0, T, T);
    for (let i = 0; i < 4; i++) { x.fillStyle = `rgba(${r() < .5 ? "255,240,220" : "0,0,0"},${(.04 + r() * .08).toFixed(3)})`; x.fillRect(0, i * 16, T, 16);
      x.fillStyle = "rgba(0,0,0,.4)"; x.fillRect(0, i * 16, T, 1.5); }
    for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(0,0,0,${(r() * .12).toFixed(3)})`; x.fillRect(r() * T, r() * T, 6 + r() * 14, 1); }
    x.fillStyle = "rgba(0,0,0,.45)"; x.fillRect(0, 0, 7, T); x.fillStyle = "rgba(255,230,200,.12)"; x.fillRect(1, 0, 2, T); x.fillStyle = "rgba(0,0,0,.35)"; x.fillRect(7, 0, 1, T);
    return ceilCache[base] = { w: T, h: T, data: new Uint32Array(x.getImageData(0, 0, T, T).data.buffer.slice(0)) };
  }

  /* ---------- harita editörü ---------- */
  if (S.roofKind === undefined) S.roofKind = "ceil";
  function bar(m) {
    const dm = isDM() && !S.ro; if (!dm) return "";
    const sel = (k, list, cur) => `<select class="f tv-sel" data-${k}>${list.map(([v, n]) => `<option value="${v}" ${cur === v ? "selected" : ""}>${n}</option>`).join("")}</select>`;
    return `<div class="tools sub mb-bar tv-bar"><span class="lbl">Fırça</span>${KINDS.map(([k, n]) => `<button class="tool" data-roofk="${k}" aria-pressed="${S.roofKind === k}"><i class="tv-${k || "auto"}"></i>${n}</button>`).join("")}
      <span class="tsep"></span><label class="tv-lab"><span class="lbl">Harita</span>${sel("roofmode", MODES, m.roofMode || "auto")}</label>
      <label class="tv-lab"><span class="lbl">Gökyüzü</span>${sel("roofsky", SKIES, m.sky || "auto")}</label>
      <button class="tool" data-roofclear="1" title="Fırçayla boyanan bütün tavan ve gök alanlarını sil">Boyananları sil</button></div>`;
  }
  // Editörde tavanlı kareler kahverengi taralı, açık kareler mavi görünür; elle boyananlar daha koyu.
  function overlay(ctx, m, s) {
    const g = grid(m), W = m.cols, H = m.rows, own = m.roof || {};
    ctx.save();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = g[y * W + x], hand = !!own[x + "," + y];
      ctx.fillStyle = v ? `rgba(120,80,40,${hand ? .45 : .28})` : `rgba(90,170,240,${hand ? .4 : .18})`; ctx.fillRect(x * s, y * s, s, s);
      if (v) { ctx.strokeStyle = `rgba(70,45,20,${hand ? .6 : .35})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x * s, y * s + s); ctx.lineTo(x * s + s, y * s); ctx.stroke(); }
      if (hand) { ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.beginPath(); ctx.arc(x * s + s * .82, y * s + s * .18, Math.max(1.5, s * .07), 0, 7); ctx.fill(); } }
    ctx.restore();
  }

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-roofk],[data-roofclear]"); if (!b) return;
    if (b.dataset.roofk !== undefined) { S.roofKind = b.dataset.roofk; return render(); }
    const m = curMap(); if (!m || !isDM() || S.ro) return;
    if (!Object.values(m.roof || {}).some(Boolean)) return toast("Fırçayla boyanmış alan yok");
    if (typeof bulkOp === "function") bulkOp(m, "roof", () => ""); else { m.roof = {}; save("maps", m, ["roof"]); }
    render(); toast("Boyanan tavan ve gök alanları silindi");
  });
  document.addEventListener("change", e => {
    const el = e.target; if (!el.matches || !el.matches("[data-roofmode],[data-roofsky]")) return;
    const m = curMap(); if (!m || !isDM() || S.ro) return;
    if (el.matches("[data-roofmode]")) { m.roofMode = el.value; save("maps", m, ["roofMode"]); } else { m.sky = el.value; save("maps", m, ["sky"]); }
    render();
  });

  window.ROOF = { grid, skyKind, skyTex, ceilTex, bar, overlay, MODES, SKIES };
})();
