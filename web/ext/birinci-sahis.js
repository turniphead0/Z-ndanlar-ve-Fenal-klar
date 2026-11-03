/* Masaüstü eklentileri (11): haritada birinci şahıs görünümü.
   Oyuncu kendi jetonunun gözünden bakar: duvarlar ve kapılar üç boyutlu bloklar, jetonlar ve ağaçlar karton figürler
   olarak görünür. Ok tuşlarıyla kare kare yürür ve 90 derece döner; her adım jetonu haritada da taşır.
   Sisli kareler oyuncuya karanlık görünür ve içine girilemez. DM "Oyuncular için aç" ile haritayı herkese bu
   görünümde açtırabilir. */
(function () {
  "use strict";

  const FOV = 66 * Math.PI / 180, PLANE = Math.tan(FOV / 2), P = 16, TEX = 64, STEP_MS = 170, TURN_MS = 150;
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // 0 kuzey, 1 doğu, 2 güney, 3 batı
  const BLOCK = ["wall", "tree", "pit", "lava"];
  const FP = { open: false };
  const dismissed = {};                            // harita kimliği -> kapatılan zorunlu açılışın zamanı

  const rgb = c => { const x = document.createElement("canvas").getContext("2d"); x.fillStyle = c || "#000"; const h = x.fillStyle;
    if (h[0] === "#") return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const m = h.match(/[\d.]+/g) || [0, 0, 0]; return m.slice(0, 3).map(Number); };
  const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const ease = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  const angOf = d => Math.atan2(DIRS[d][1], DIRS[d][0]);

  /* ---------- dokular ---------- */
  function wallTex(base) {
    const c = canvas(TEX, TEX), x = c.getContext("2d"); x.fillStyle = base; x.fillRect(0, 0, TEX, TEX);
    x.strokeStyle = "rgba(0,0,0,.35)"; x.lineWidth = 2;
    for (let r = 0; r < 4; r++) { const y = r * 16; x.beginPath(); x.moveTo(0, y + 1); x.lineTo(TEX, y + 1); x.stroke();
      for (let k = (r % 2) * 16; k < TEX + 1; k += 32) { x.beginPath(); x.moveTo(k + .5, y); x.lineTo(k + .5, y + 16); x.stroke(); } }
    for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? "255,255,255" : "0,0,0"},${(Math.random() * .08).toFixed(3)})`; x.fillRect(Math.random() * TEX, Math.random() * TEX, 3, 3); }
    return c;
  }
  function doorTex(base, wall) {
    const c = wallTex(wall), x = c.getContext("2d"); x.fillStyle = base; x.fillRect(12, 8, 40, 56);
    x.strokeStyle = "rgba(0,0,0,.4)"; x.lineWidth = 2; for (const k of [22, 32, 42]) { x.beginPath(); x.moveTo(k, 9); x.lineTo(k, 64); x.stroke(); }
    x.strokeRect(12, 8, 40, 56); x.fillStyle = "#e8c66a"; x.beginPath(); x.arc(46, 38, 2.5, 0, 7); x.fill();
    return c;
  }

  // Karton figür: beyaz kesim kenarlı kart, üstte resim ya da baş harfler, altta ad ve ahşap ayak.
  const standCache = {};
  function standee(t) {
    const img = getImg(tokImg(t)), key = [t.label, t.color, tokImg(t), !!img].join("|");
    if (standCache[t.id]?.key === key) return standCache[t.id].c;
    const W = 128, H = 200, c = canvas(W, H), x = c.getContext("2d");
    x.fillStyle = "#6b4a2b"; x.beginPath(); x.moveTo(20, H - 2); x.lineTo(108, H - 2); x.lineTo(98, H - 22); x.lineTo(30, H - 22); x.closePath(); x.fill();
    x.fillStyle = "rgba(0,0,0,.25)"; x.fillRect(30, H - 22, 68, 4);
    const card = (inset, fill) => { x.fillStyle = fill; x.beginPath(); x.roundRect(8 + inset, 4 + inset, W - 16 - inset * 2, H - 26 - inset * 2, 12 - inset); x.fill(); };
    card(0, "#c9b38a"); card(3, "#fbf8f1");
    x.fillStyle = t.color || "#555"; x.fillRect(11, 12, W - 22, 8);
    const cx = W / 2, cy = 78, r = 46;
    x.save(); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fillStyle = t.color || "#555"; x.fill(); x.clip();
    if (img) { const w = img.naturalWidth, h = img.naturalHeight, s = Math.min(w, h); x.drawImage(img, (w - s) / 2, (h - s) / 2, s, s, cx - r, cy - r, r * 2, r * 2); }
    else { const lab = t.label || "?", ini = /\d$/.test(lab) ? lab[0] + lab.match(/\d+$/)[0] : lab.split(/\s+/).map(w => w[0]).join("").slice(0, 2);
      x.fillStyle = "#fff"; x.font = `700 40px ${cssVar("--f-body") || "sans-serif"}`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(ini.toLocaleUpperCase("tr"), cx, cy + 2); }
    x.restore(); x.lineWidth = 4; x.strokeStyle = t.color || "#555"; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke();
    x.fillStyle = "#1d2226"; x.textAlign = "center"; x.textBaseline = "middle"; let fs = 20; const lab = t.label || "";
    do { x.font = `700 ${fs}px ${cssVar("--f-display") || "serif"}`; fs--; } while (x.measureText(lab).width > W - 28 && fs > 10);
    x.fillText(lab, cx, 146);
    standCache[t.id] = { key, c }; return c;
  }
  let treeC = null;
  function treeStandee(col) {
    if (treeC?.col === col) return treeC.c;
    const W = 128, H = 200, c = canvas(W, H), x = c.getContext("2d");
    const shape = () => { x.beginPath(); x.rect(54, 120, 20, 62); for (const [a, b, r] of [[64, 62, 44], [36, 92, 32], [92, 92, 32], [64, 38, 30]]) { x.moveTo(a + r, b); x.arc(a, b, r, 0, 7); } };
    x.lineJoin = "round"; x.lineWidth = 10; x.strokeStyle = "#fbf8f1"; shape(); x.stroke();
    x.fillStyle = "#6b4a2b"; x.fillRect(54, 120, 20, 62);
    x.fillStyle = col; for (const [a, b, r] of [[64, 62, 44], [36, 92, 32], [92, 92, 32], [64, 38, 30]]) { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }
    x.fillStyle = "rgba(255,255,255,.15)"; x.beginPath(); x.arc(50, 44, 14, 0, 7); x.fill();
    x.fillStyle = "#6b4a2b"; x.beginPath(); x.moveTo(30, H - 2); x.lineTo(98, H - 2); x.lineTo(90, H - 18); x.lineTo(38, H - 18); x.closePath(); x.fill();
    treeC = { col, c }; return c;
  }

  /* ---------- zemin dokusu (harita resmi, araziler, ızgara, sis) ---------- */
  function sig(m) { return [m.id, JSON.stringify((S.games[G.id] || {}).skins || {}), JSON.stringify(m.props || {}), window.PROPS ? Object.values(m.props || {}).filter(v => v && getImg(PROPS.get(v)?.img)).length : 0, m.bg, m.fogOn, m.cols, m.rows, JSON.stringify(m.cells), m.fogOn ? JSON.stringify(m.fog) : "", isDM(), document.documentElement.dataset.sys || "", !!getImg(m.bg)].join("§"); }
  function buildFloor(m) {
    const dm = isDM(), w = m.cols * P, h = m.rows * P, col = { floor: cssVar("--map-floor"), ink: cssVar("--ink") };
    TERRAIN.forEach(t => col[t[0]] = cssVar(t[2]));
    const fc = canvas(w, h), x = fc.getContext("2d"); x.fillStyle = col.floor; x.fillRect(0, 0, w, h);
    const im = getImg(m.bg); if (im) x.drawImage(im, 0, 0, w, h);
    for (const [k, v] of Object.entries(m.cells || {})) { if (!v || v === "wall" || v === "tree" || (v === "trap" && !dm)) continue;
      const [cx, cy] = k.split(",").map(Number); if (cx < m.cols && cy < m.rows) drawTerrain(x, v === "door" ? "rough" : v, cx * P, cy * P, P, col, im); }
    x.globalAlpha = 1; x.strokeStyle = cssVar("--grid"); x.lineWidth = 1; x.beginPath();
    for (let i = 0; i <= m.cols; i++) { x.moveTo(i * P + .5, 0); x.lineTo(i * P + .5, h); } for (let j = 0; j <= m.rows; j++) { x.moveTo(0, j * P + .5); x.lineTo(w, j * P + .5); } x.stroke();
    if (m.fogOn) { x.fillStyle = cssVar("--fog"); x.globalAlpha = dm ? .45 : 1; for (let j = 0; j < m.rows; j++) for (let i = 0; i < m.cols; i++) if (fogged(m, i, j)) x.fillRect(i * P, j * P, P, P); x.globalAlpha = 1; }
    // Kuşbakışı küçük harita: zemin + duvarlar + ağaçlar
    const mc = canvas(w, h), y = mc.getContext("2d"); y.drawImage(fc, 0, 0);
    for (const [k, v] of Object.entries(m.cells || {})) { if (v !== "wall" && v !== "tree") continue; const [cx, cy] = k.split(",").map(Number);
      if (!dm && fogged(m, cx, cy)) continue; drawTerrain(y, v, cx * P, cy * P, P, col, null); }
    y.globalAlpha = 1;
    if (window.PROPS) for (const [k, v] of Object.entries(m.props || {})) { const [cx, cy] = k.split(",").map(Number); if (v && (dm || !fogged(m, cx, cy))) PROPS.draw(y, v, cx * P, cy * P, P); }
    let data = null; try { data = new Uint32Array(x.getImageData(0, 0, w, h).data.buffer); } catch (e) { data = null; }
    FP.floor = { w, h, data, mini: mc };
    const own = k => { const im = window.PROPS && getImg(PROPS.skin(k)); if (!im) return null; const c = canvas(TEX, TEX); c.getContext("2d").drawImage(im, 0, 0, TEX, TEX); return c; };
    FP.tex = { wall: own("wall") || wallTex(col.wall), door: own("door") || doorTex(col.door, col.wall) };
    FP.treeCol = col.tree; FP.fogRGB = rgb(cssVar("--fog")); FP.ceilRGB = rgb(cssVar("--t-wall")).map(v => v * .45);
  }

  /* ---------- kamera ve hareket ---------- */
  const myToks = m => toks(m).filter(t => t.charId && S.chars[t.charId]?.owner === ME.id);
  function pickToken(m) {
    const sel = m.tokens?.[S.selTok];
    if (sel && !sel.removed && ownsTok(sel)) return sel;
    return myToks(m)[0] || (isDM() ? toks(m).find(t => t.gm) : null) || null;
  }
  const solidAt = (m, x, y) => x < 0 || y < 0 || x >= m.cols || y >= m.rows || m.cells?.[x + "," + y] === "wall" || (m.cells?.[x + "," + y] === "door" ? "door" : false);
  const darkAt = (m, x, y) => !isDM() && fogged(m, x, y);
  function blocked(m, t, nx, ny) {
    const sz = t ? +t.size || 1 : 1;
    for (let i = 0; i < sz; i++) for (let j = 0; j < sz; j++) { const x = nx + i, y = ny + j;
      if (x < 0 || y < 0 || x >= m.cols || y >= m.rows) return "Haritanın kenarı";
      const v = m.cells?.[x + "," + y]; if (BLOCK.includes(v)) return { wall: "Önünde duvar var", tree: "Önünde ağaç var", pit: "Önünde çukur var", lava: "Önünde lav var" }[v];
      if (darkAt(m, x, y)) return "Orası karanlık, DM henüz açmadı";
      const pk = m.props?.[x + "," + y]; if (window.PROPS && PROPS.solid(pk)) return `Önünde ${PROPS.get(pk).name.toLocaleLowerCase("tr")} var`; }
    if (t) for (const o of toks(m)) { if (o.id === t.id) continue; const z = +o.size || 1;
      if (nx < o.x + z && nx + sz > o.x && ny < o.y + z && ny + sz > o.y && (isDM() || (!tokFogged(m, o) && !(o.gm && o.gmHidden)))) return `${o.label || "Biri"} yolu kapatıyor`; }
    return null;
  }
  function camFrom(t) { const sz = +t.size || 1; return { x: t.x + sz / 2, y: t.y + sz / 2 }; }

  function move(fwd, side) {
    const m = curMap(); if (!m || FP.anim) { FP.queue = [fwd, side]; return; }
    const d = (FP.dir + (side ? (side > 0 ? 1 : 3) : (fwd > 0 ? 0 : 2))) % 4, [dx, dy] = DIRS[d];
    const t = FP.tokId ? m.tokens?.[FP.tokId] : null;
    const bx = t ? t.x : Math.floor(FP.cx), by = t ? t.y : Math.floor(FP.cy), nx = bx + dx, ny = by + dy;
    const why = blocked(m, t, nx, ny);
    if (why) { hud(why); FP.bump = { t: performance.now(), dx, dy }; return; }
    if (S.ro && t) { hud("Bu masada yalnızca görüntüleme iznin var"); return; }
    const from = { x: FP.cx, y: FP.cy }, to = { x: FP.cx + dx, y: FP.cy + dy };
    FP.anim = { kind: "step", t0: performance.now(), from, to };
    if (t) { t.x = nx; t.y = ny; t.dir = FP.dir; save("maps", m, ["tokens." + t.id + ".x", "tokens." + t.id + ".y", "tokens." + t.id + ".dir"]); }
    const v = m.cells?.[nx + "," + ny]; if (v === "door") hud("Kapıdan geçiyorsun"); else if (v === "water") hud("Suya girdin"); else if (v === "stairs") hud(stairsMsg(m)); else if (v === "rough") hud("Zorlu arazi");
    else if (v === "trap" && isDM()) hud("Tuzak karesi");
  }
  function turn(k) {
    if (FP.anim) { FP.queue = ["turn", k]; return; }
    const a0 = FP.ang; FP.dir = (FP.dir + k + 4) % 4;
    FP.anim = { kind: "turn", t0: performance.now(), a0, a1: a0 + k * Math.PI / 2 };
    const m = curMap(), t = FP.tokId && m?.tokens?.[FP.tokId]; if (t && !S.ro) { t.dir = FP.dir; save("maps", m, ["tokens." + t.id + ".dir"]); }
  }

  /* ---------- merdivenler ve katlar ---------- */
  const mapTitle = m => window.FLOORS && FLOORS.floors(m).length > 1 ? `${m.name || "Harita"} · ${FLOORS.lvlName(FLOORS.lvlOf(m))}` : m.name || "Harita";
  function here(m) { const t = FP.tokId && m.tokens?.[FP.tokId]; return t ? { x: t.x, y: t.y, t } : { x: Math.floor(FP.cx), y: Math.floor(FP.cy), t: null }; }
  function exits(m) {
    if (!window.FLOORS) return { up: null, down: null }; const h = here(m), on = m.cells?.[h.x + "," + h.y] === "stairs";
    const l = FLOORS.lvlOf(m), ok = x => x && (isDM() || !x.hidden) ? x : null;
    return on ? { up: ok(FLOORS.floorAt(m, l + 1)), down: ok(FLOORS.floorAt(m, l - 1)) } : { up: null, down: null, off: true };
  }
  function stairsMsg(m) { const e = exits(m); return e.up && e.down ? "Merdiven: yukarı çıkabilir ya da aşağı inebilirsin" : e.up ? "Merdiven: Boşluk ile yukarı çık" : e.down ? "Merdiven: Boşluk ile aşağı in" : "Merdivendesin ama bu binada başka kat yok"; }
  function stairsPanel(m) {
    const p = $("#fpStairs"); if (!p) return; const e = exits(m);
    p.hidden = !(e.up || e.down); $("[data-fp=up]", p).hidden = !e.up; $("[data-fp=down]", p).hidden = !e.down;
  }
  function stairs(dir) {
    const m = curMap(); if (!m || FP.anim) return; const e = exits(m);
    if (e.off) return hud("Kat değiştirmek için merdivene çık");
    if (!dir) dir = e.up ? 1 : e.down ? -1 : 0;
    if (!dir || !(dir > 0 ? e.up : e.down)) return hud(dir > 0 ? "Yukarıda kat yok" : dir < 0 ? "Aşağıda kat yok" : "Bu binada başka kat yok");
    if (S.ro && FP.tokId) return hud("Bu masada yalnızca görüntüleme iznin var");
    let to;
    if (FP.tokId) { const r = FLOORS.climb(m, m.tokens[FP.tokId], dir); if (r.err) return hud(r.err); to = r.map; const c = camFrom(r.tok); FP.cx = c.x; FP.cy = c.y; }
    else { to = dir > 0 ? e.up : e.down; S.mapId = to.id; }
    FP.sig = null; for (const k of Object.keys(spr)) delete spr[k];
    FP.fade = performance.now(); const n = $("#fpName"); if (n) n.textContent = mapTitle(to);
    hud(`${FLOORS.lvlName(FLOORS.lvlOf(to))}: ${dir > 0 ? "yukarı çıktın" : "aşağı indin"}`); render();
  }

  let blobC = null;
  function blob() {
    if (blobC) return blobC; const c = canvas(128, 200), x = c.getContext("2d");
    const g = x.createRadialGradient(64, 120, 6, 64, 120, 70); g.addColorStop(0, "rgba(6,8,12,.9)"); g.addColorStop(.6, "rgba(6,8,12,.55)"); g.addColorStop(1, "rgba(6,8,12,0)");
    x.save(); x.translate(64, 120); x.scale(.75, 1.15); x.translate(-64, -120); x.fillStyle = g; x.fillRect(0, 0, 128, 200); x.restore();
    return blobC = c;
  }
  let stairC = null;
  function stairStandee() {
    const own = window.PROPS && dieCut(PROPS.skin("stairs")); if (own) return own;
    const col = cssVar("--t-stairs") || "#a39780"; if (stairC?.col === col) return stairC.c;
    const W = 128, c = canvas(W, W), x = c.getContext("2d"), step = (W - 16) / 5;
    x.lineJoin = "round"; x.lineWidth = 8; x.strokeStyle = "#fbf8f1";
    const path = () => { x.beginPath(); x.moveTo(8, W - 4); for (let i = 0; i < 5; i++) { const y = W - 4 - (i + 1) * step * .9; x.lineTo(8 + i * step, y); x.lineTo(8 + (i + 1) * step, y); } x.lineTo(W - 8, W - 4); x.closePath(); };
    path(); x.stroke(); x.fillStyle = col; path(); x.fill();
    x.strokeStyle = "rgba(0,0,0,.3)"; x.lineWidth = 2; for (let i = 1; i < 5; i++) { x.beginPath(); x.moveTo(8 + i * step, W - 4); x.lineTo(8 + i * step, W - 4 - i * step * .9); x.stroke(); }
    stairC = { col, c }; return c;
  }

  // Resmi beyaz kesim kenarlı, ayaklı karton figüre çevirir (mobilyalar, kendi resimlerin).
  const cutCache = {};
  function dieCut(url) {
    if (!url) return null; if (cutCache[url]) return cutCache[url]; const im = getImg(url); if (!im) return null;
    const W = 128, B = 16, pad = 8, w = im.naturalWidth || W, h = im.naturalHeight || W, k = (W - pad * 2) / Math.max(w, h), dw = w * k, dh = h * k, ox = (W - dw) / 2, oy = W - pad / 2 - dh;
    const sil = canvas(W, W), sx = sil.getContext("2d"); sx.drawImage(im, ox, oy, dw, dh); sx.globalCompositeOperation = "source-in"; sx.fillStyle = "#fbf8f1"; sx.fillRect(0, 0, W, W);
    const c = canvas(W, W + B), x = c.getContext("2d");
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; x.drawImage(sil, Math.cos(a) * 4, Math.sin(a) * 4); }
    x.drawImage(im, ox, oy, dw, dh);
    x.fillStyle = "#6b4a2b"; x.beginPath(); x.moveTo(W * .22, W + B - 1); x.lineTo(W * .78, W + B - 1); x.lineTo(W * .7, W - 2); x.lineTo(W * .3, W - 2); x.closePath(); x.fill();
    return cutCache[url] = c;
  }

  /* ---------- çizim ---------- */
  const spr = {};   // diğer jetonların yumuşak kayan konumları
  function frame(now) {
    if (!FP.open) return;
    FP.raf = requestAnimationFrame(frame);
    const m = curMap(); if (!m) return close();
    if (FP.tokId) { const t = m.tokens?.[FP.tokId]; if (!t || t.removed) { toast("Jeton haritadan kalktı"); return close(); }
      if (!FP.anim) { const c = camFrom(t); FP.cx = c.x; FP.cy = c.y; if (t.dir != null && t.dir !== FP.dir) { FP.dir = t.dir; FP.ang = angOf(FP.dir); } } }
    // canlandırma
    let bob = 0;
    if (FP.anim) { const a = FP.anim, k = Math.min(1, (now - a.t0) / (a.kind === "step" ? STEP_MS : TURN_MS)), e = ease(k);
      if (a.kind === "step") { FP.cx = a.from.x + (a.to.x - a.from.x) * e; FP.cy = a.from.y + (a.to.y - a.from.y) * e; bob = Math.sin(k * Math.PI) * .035; }
      else FP.ang = a.a0 + (a.a1 - a.a0) * e;
      if (k >= 1) { if (a.kind === "turn") FP.ang = angOf(FP.dir); FP.anim = null; const q = FP.queue; FP.queue = null; if (q) q[0] === "turn" ? turn(q[1]) : move(q[0], q[1]); } }
    let ox = 0, oy = 0; if (FP.bump) { const k = (now - FP.bump.t) / 220; if (k >= 1) FP.bump = null; else { const s = Math.sin(k * Math.PI) * .08; ox = FP.bump.dx * s; oy = FP.bump.dy * s; } }
    const s = sig(m); if (s !== FP.sig) { FP.sig = s; buildFloor(m); }
    draw(m, FP.cx + ox, FP.cy + oy, FP.ang, .5 + bob, now);
    if (FP.fade) { const k = (now - FP.fade) / 450; if (k >= 1) FP.fade = 0; else { FP.ctx.fillStyle = `rgba(0,0,0,${(1 - k).toFixed(3)})`; FP.ctx.fillRect(0, 0, FP.cv.width, FP.cv.height); } }
    if (now - (FP.miniT || 0) > 80) { FP.miniT = now; drawMini(m); stairsPanel(m); }
    if (FP.msgT && now > FP.msgT) { FP.msgT = 0; const h = $("#fpMsg"); if (h) h.classList.remove("on"); }
  }

  function draw(m, px, py, ang, camZ, now) {
    const cv = FP.cv, ctx = FP.ctx, W = cv.width, H = cv.height, dm = isDM();
    const dx = Math.cos(ang), dy = Math.sin(ang), plx = -dy * PLANE, ply = dx * PLANE, proj = (W / 2) / PLANE, hor = H / 2;
    const maxD = 14, FOG = FP.fogRGB, CEIL = FP.ceilRGB;
    // dinamik ışık: jetonun gözünden görülen parlaklık (DM serbest kamerada biraz ışık kalır)
    const me = FP.tokId && m.tokens?.[FP.tokId], LV = window.LIGHT && LIGHT.on(m) ? LIGHT.view(m, me ? [me] : null) : null, minL = LV && !me ? .3 : 0;
    const lightAt = (x, y) => !LV ? 1 : x < 0 || y < 0 || x >= LV.W || y >= LV.H ? 0 : Math.max(minL, LV.see[y * LV.W + x]);
    const grayAt = (x, y) => !!LV && x >= 0 && y >= 0 && x < LV.W && y < LV.H && LV.gray[y * LV.W + x] === 1;
    FP.LV = LV;
    // zemin ve tavan (satır satır)
    const img = FP.buf && FP.buf.width === W && FP.buf.height === H ? FP.buf : (FP.buf = ctx.createImageData(W, H));
    const out = new Uint32Array(img.data.buffer), F = FP.floor, fd = F.data;
    const r0x = dx - plx, r0y = dy - ply, r1x = dx + plx, r1y = dy + ply;
    for (let y = 0; y < H; y++) {
      const floor = y > hor, p = floor ? y - hor : hor - y; if (p < 1) { out.fill(0xff000000 | FOG[2] << 16 | FOG[1] << 8 | FOG[0], y * W, y * W + W); continue; }
      const rd = (floor ? camZ : 1 - camZ) * proj / p, sh = Math.max(0, 1 - rd / maxD), sh2 = sh * sh;
      if (!floor && !LV) { const r = CEIL[0] * sh2 + FOG[0] * (1 - sh2), g = CEIL[1] * sh2 + FOG[1] * (1 - sh2), b = CEIL[2] * sh2 + FOG[2] * (1 - sh2);
        out.fill(0xff000000 | (b | 0) << 16 | (g | 0) << 8 | (r | 0), y * W, y * W + W); continue; }
      let fx = px + rd * r0x, fy = py + rd * r0y; const sx = rd * (r1x - r0x) / W, sy = rd * (r1y - r0y) / W;
      const ceilC = 0xff000000 | (CEIL[2] | 0) << 16 | (CEIL[1] | 0) << 8 | (CEIL[0] | 0);
      for (let x = 0, o = y * W; x < W; x++, o++, fx += sx, fy += sy) {
        const tx = (fx * P) | 0, ty = (fy * P) | 0; let c;
        if (!floor) c = ceilC; else if (fd && fx >= 0 && fy >= 0 && tx < F.w && ty < F.h) c = fd[ty * F.w + tx]; else c = 0xff000000 | FOG[2] << 16 | FOG[1] << 8 | FOG[0];
        let k = sh2, r = c & 255, g = c >> 8 & 255, b = c >> 16 & 255;
        if (LV) { const cx = Math.floor(fx), cy = Math.floor(fy); k *= lightAt(cx, cy); if (grayAt(cx, cy)) { const l = r * .3 + g * .59 + b * .11; r = g = l * .9; b = l; } }
        out[o] = 0xff000000 | ((b * k + FOG[2] * (1 - k)) | 0) << 16 | ((g * k + FOG[1] * (1 - k)) | 0) << 8 | ((r * k + FOG[0] * (1 - k)) | 0);
      }
    }
    ctx.putImageData(img, 0, 0);
    // duvarlar (DDA ışın izleme)
    const Z = FP.z && FP.z.length === W ? FP.z : (FP.z = new Float32Array(W)), fogCss = `rgb(${FOG.join(",")})`;
    for (let x = 0; x < W; x++) {
      const cam = 2 * x / W - 1, rx = dx + plx * cam, ry = dy + ply * cam;
      let mx = Math.floor(px), my = Math.floor(py); const ddx = Math.abs(1 / rx), ddy = Math.abs(1 / ry);
      const stx = rx < 0 ? -1 : 1, sty = ry < 0 ? -1 : 1;
      let sdx = (rx < 0 ? px - mx : mx + 1 - px) * ddx, sdy = (ry < 0 ? py - my : my + 1 - py) * ddy, side = 0, hit = null;
      let pmx = mx, pmy = my;
      for (let i = 0; i < 64 && !hit; i++) {
        pmx = mx; pmy = my;
        if (sdx < sdy) { sdx += ddx; mx += stx; side = 0; } else { sdy += ddy; my += sty; side = 1; }
        const s = solidAt(m, mx, my);
        if (mx < 0 || my < 0 || mx >= m.cols || my >= m.rows) hit = "edge";
        else if (darkAt(m, mx, my)) hit = "dark";
        else if (s) hit = s === "door" ? "door" : "wall";
      }
      const perp = hit ? (side === 0 ? sdx - ddx : sdy - ddy) : 64; Z[x] = perp;
      if (!hit) continue;
      const lh = proj / Math.max(perp, .01), top = hor - lh * (1 - camZ);
      if (hit === "dark" || hit === "edge") continue;   // karanlık: ötesi çizilmez, zemin sisle kararır
      let wx = side === 0 ? py + perp * ry : px + perp * rx; wx -= Math.floor(wx);
      let tx = (wx * TEX) | 0; if ((side === 0 && rx > 0) || (side === 1 && ry < 0)) tx = TEX - tx - 1;
      ctx.drawImage(FP.tex[hit], tx, 0, 1, TEX, x, top, 1, lh);
      const a0 = Math.min(.92, (1 - Math.pow(Math.max(0, 1 - perp / maxD), 2)) + (side ? .18 : 0)), a = LV ? 1 - (1 - a0) * lightAt(pmx, pmy) : a0;
      if (a > .01) { ctx.globalAlpha = a; ctx.fillStyle = fogCss; ctx.fillRect(x, top, 1, lh); ctx.globalAlpha = 1; }
    }
    // karton figürler: jetonlar ve ağaçlar
    const list = [], act = activeTokenIds();
    for (const t of toks(m)) { if (t.id === FP.tokId || (!dm && (tokFogged(m, t) || (t.gm && t.gmHidden)))) continue;
      const sz = +t.size || 1, rd = remoteDrag[t.id] && remoteDrag[t.id].m === m.id ? remoteDrag[t.id] : null;
      const tx = (rd ? rd.x : t.x) + sz / 2, ty = (rd ? rd.y : t.y) + sz / 2, p = spr[t.id] || (spr[t.id] = { x: tx, y: ty });
      p.x += (tx - p.x) * .25; p.y += (ty - p.y) * .25;
      list.push({ x: p.x, y: p.y, c: standee(t), h: .82 * Math.min(sz, 2.4), ring: act.has(t.id) }); }
    for (const [k, v] of Object.entries(m.cells || {})) { if (v !== "tree") continue; const [cx, cy] = k.split(",").map(Number);
      if (!dm && fogged(m, cx, cy)) continue; if (Math.abs(cx + .5 - px) > maxD || Math.abs(cy + .5 - py) > maxD) continue;
      list.push({ x: cx + .5, y: cy + .5, c: (window.PROPS && dieCut(PROPS.skin("tree"))) || treeStandee(FP.treeCol), h: 1.35 }); }
    for (const [k, v] of Object.entries(m.cells || {})) { if (v !== "stairs") continue; const [cx, cy] = k.split(",").map(Number);
      if ((cx === Math.floor(px) && cy === Math.floor(py)) || (!dm && fogged(m, cx, cy))) continue; list.push({ x: cx + .5, y: cy + .5, c: stairStandee(), h: .55 }); }
    if (window.PROPS) for (const [k, v] of Object.entries(m.props || {})) { const it = v && PROPS.get(v); if (!it) continue; const [cx, cy] = k.split(",").map(Number);
      if ((!dm && fogged(m, cx, cy)) || Math.abs(cx + .5 - px) > maxD || Math.abs(cy + .5 - py) > maxD) continue;
      const c = dieCut(it.img); if (c) list.push({ x: cx + .5, y: cy + .5, c, h: it.h || .6 }); }
    const inv = 1 / (plx * dy - dx * ply);
    for (const s of list) { const rx = s.x - px, ry = s.y - py; s.tx = inv * (dy * rx - dx * ry); s.d = inv * (-ply * rx + plx * ry); }
    for (const s of list) { const cx = Math.floor(s.x), cy = Math.floor(s.y); s.L = lightAt(cx, cy);
      if (LV && cx >= 0 && cy >= 0 && cx < LV.W && cy < LV.H && LV.sil[cy * LV.W + cx]) { s.c = blob(); s.ring = false; s.L = Math.max(s.L, .5); } }   // ışıksız yakın görüş: şekilsiz gölge
    list.filter(s => s.d > .15 && s.d < maxD + 2 && s.L > 0).sort((a, b) => b.d - a.d).forEach(s => {
      const sx = (W / 2) * (1 + s.tx / s.d), hgt = proj * s.h / s.d, wid = hgt * s.c.width / s.c.height, bot = hor + camZ * proj / s.d, top = bot - hgt;
      const x0 = Math.max(0, Math.floor(sx - wid / 2)), x1 = Math.min(W, Math.ceil(sx + wid / 2)); if (x0 >= x1) return;
      // gölge ve sıra halkası
      const cx = Math.min(W - 1, Math.max(0, sx | 0));
      if (Z[cx] > s.d) { ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(sx, bot, wid * .42, wid * .09, 0, 0, 7); ctx.fill();
        if (s.ring) { ctx.strokeStyle = cssVar("--gold") || "#d4a73a"; ctx.lineWidth = Math.max(1, wid * .03); ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.ellipse(sx, bot, wid * .55, wid * .13, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]); } }
      // uzaklıkla kararan kopya
      const sh = FP.shade || (FP.shade = canvas(128, 200)), sx2 = sh.getContext("2d"); sh.width = s.c.width; sh.height = s.c.height;
      sx2.drawImage(s.c, 0, 0); const a = 1 - (1 - Math.min(.9, 1 - Math.pow(Math.max(0, 1 - s.d / maxD), 2))) * s.L;
      if (a > .01) { sx2.globalCompositeOperation = "source-atop"; sx2.globalAlpha = a; sx2.fillStyle = fogCss; sx2.fillRect(0, 0, sh.width, sh.height); sx2.globalAlpha = 1; sx2.globalCompositeOperation = "source-over"; }
      const k = s.c.width / wid;
      for (let x = x0; x < x1; x++) { if (Z[x] <= s.d) continue; let run = x; while (run + 1 < x1 && Z[run + 1] > s.d) run++;
        const u0 = (x - (sx - wid / 2)) * k, u1 = (run + 1 - (sx - wid / 2)) * k;
        ctx.drawImage(sh, Math.max(0, u0), 0, Math.max(.01, Math.min(sh.width, u1) - Math.max(0, u0)), sh.height, x, top, run + 1 - x, hgt); x = run; }
    });
    // pusula
    ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.fillRect(W / 2 - 26, 6, 52, 18); ctx.fillStyle = "#fff"; ctx.font = `700 12px ${cssVar("--f-num") || "monospace"}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText((window.LANG && LANG() === "en" ? ["N", "E", "S", "W"] : ["K", "D", "G", "B"])[FP.dir], W / 2, 15);
  }

  function drawMini(m) {
    const c = $("#fpMini"); if (!c || !FP.floor) return; const x = c.getContext("2d"), N = 11, cw = c.width / N;
    x.fillStyle = `rgb(${FP.fogRGB.join(",")})`; x.fillRect(0, 0, c.width, c.height);
    const ox = FP.cx - N / 2, oy = FP.cy - N / 2;
    x.imageSmoothingEnabled = false; x.drawImage(FP.floor.mini, ox * P, oy * P, N * P, N * P, 0, 0, c.width, c.height);
    const LV = FP.LV, seen = (cx, cy) => !LV || isDM() || (cx >= 0 && cy >= 0 && cx < LV.W && cy < LV.H && (LV.see[cy * LV.W + cx] > 0 || (LV.mem && LV.mem[cy * LV.W + cx])));
    if (LV && !isDM()) { x.fillStyle = `rgb(${FP.fogRGB.join(",")})`; for (let j = Math.floor(oy); j < oy + N + 1; j++) for (let i = Math.floor(ox); i < ox + N + 1; i++) if (!seen(i, j)) x.fillRect((i - ox) * cw, (j - oy) * cw, cw + .5, cw + .5); }
    for (const t of toks(m)) { if (t.id === FP.tokId || (!isDM() && (tokFogged(m, t) || (t.gm && t.gmHidden) || (LV && (!(LV.see[t.y * LV.W + t.x] > 0) || LV.sil[t.y * LV.W + t.x]))))) continue; const sz = +t.size || 1;
      x.fillStyle = t.color || "#555"; x.beginPath(); x.arc((t.x + sz / 2 - ox) * cw, (t.y + sz / 2 - oy) * cw, cw * .32 * sz, 0, 7); x.fill(); }
    x.save(); x.translate(c.width / 2, c.height / 2); x.rotate(FP.ang); x.fillStyle = cssVar("--gold") || "#d4a73a"; x.strokeStyle = "#000"; x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(cw * .45, 0); x.lineTo(-cw * .32, cw * .3); x.lineTo(-cw * .16, 0); x.lineTo(-cw * .32, -cw * .3); x.closePath(); x.fill(); x.stroke(); x.restore();
  }

  function hud(msg) { const h = $("#fpMsg"); if (!h) return; h.textContent = msg; h.classList.add("on"); FP.msgT = performance.now() + 1600; }

  function resize() {
    if (!FP.cv) return; const r = FP.cv.getBoundingClientRect(); const W = Math.max(240, Math.min(720, Math.round(r.width / 1.6)));
    const H = Math.max(140, Math.round(W * r.height / Math.max(1, r.width))); if (FP.cv.width !== W || FP.cv.height !== H) { FP.cv.width = W; FP.cv.height = H; }
  }

  /* ---------- aç / kapat ---------- */
  function open() {
    const m = curMap(); if (!m) return toast("Önce bir harita aç");
    let t = pickToken(m);
    if (!t && !isDM()) return toast("Bu haritada sana ait bir jeton yok. Önce \"+ Karakterimi ekle\" ile jetonunu haritaya koy.");
    close(true);
    FP.open = true; FP.tokId = t ? t.id : null; FP.sig = null; FP.anim = null; FP.queue = null;
    FP.dir = t && t.dir != null ? +t.dir : 0; FP.ang = angOf(FP.dir);
    if (t) { const c = camFrom(t); FP.cx = c.x; FP.cy = c.y; }
    else { const p = freeCell(m); FP.cx = p.x + .5; FP.cy = p.y + .5; }
    const ov = document.createElement("div"); ov.id = "fpOv"; ov.className = "fp-ov"; ov.tabIndex = -1;
    ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Birinci şahıs görünümü");
    ov.innerHTML = `<canvas id="fpCv" class="fp-cv" aria-label="${esc(m.name || "Harita")}: birinci şahıs görünümü"></canvas>
      <header class="fp-top"><b id="fpName">${esc(mapTitle(m))}</b><span>${t ? esc(t.label || "Jeton") + " gözünden" : "Serbest kamera (DM)"}</span><span style="flex:1"></span><button class="btn sm" data-fp="close">2B haritaya dön</button></header>
      <canvas id="fpMini" class="fp-mini" width="154" height="154" aria-hidden="true"></canvas>
      <div id="fpMsg" class="fp-msg" role="status" aria-live="polite"></div>
      <div class="fp-pad" aria-label="Yürüme düğmeleri">
        <button class="btn" data-fp="turn" data-k="-1" aria-label="Sola dön">⟲</button><button class="btn" data-fp="step" data-f="1" aria-label="İleri">↑</button><button class="btn" data-fp="turn" data-k="1" aria-label="Sağa dön">⟳</button>
        <button class="btn" data-fp="side" data-s="-1" aria-label="Sola adım">←</button><button class="btn" data-fp="step" data-f="-1" aria-label="Geri">↓</button><button class="btn" data-fp="side" data-s="1" aria-label="Sağa adım">→</button></div>
      <div id="fpStairs" class="fp-stairs" hidden><button class="btn" data-fp="up">▲ Yukarı çık</button><button class="btn" data-fp="down">▼ Aşağı in</button></div>
      <p class="fp-help">↑ ↓ ileri / geri · ← → dön · A D yana adım · Boşluk merdiven · Esc çık</p>`;
    document.body.appendChild(ov);
    FP.cv = $("#fpCv"); FP.ctx = FP.cv.getContext("2d"); resize(); ov.focus();
    FP.raf = requestAnimationFrame(frame);
  }
  function close(silent) {
    if (!FP.open && !$("#fpOv")) return;
    FP.open = false; cancelAnimationFrame(FP.raf); $("#fpOv")?.remove(); FP.cv = null;
    const m = curMap(); if (m?.fpMode && !isDM()) dismissed[m.id] = m.fpAt || 1;
    if (!silent && S.view === "harita") drawMap();
  }
  window.FPV = { open, close, state: FP };

  /* ---------- harita araç çubuğu ---------- */
  const _render = window.render;
  window.render = function () {
    _render.apply(this, arguments);
    if (S.view !== "harita" || !G.id) { if (FP.open) close(true); return; }
    const m = curMap(); if (!m) return;
    const bar = $('#main .tools[role="toolbar"]'); if (bar && !$("[data-fp=open]", bar)) {
      const sp = [...bar.children].find(e => e.tagName === "SPAN" && e.style.flexGrow === "1");
      const frag = document.createElement("span"); frag.className = "fp-tools";
      frag.innerHTML = `<span class="tsep"></span><button class="tool" data-fp="open" title="Jetonunun gözünden bak, ok tuşlarıyla yürü">Birinci şahıs</button>` +
        (isDM() && !S.ro ? `<button class="tool" data-fp="force" aria-pressed="${!!m.fpMode}" title="Açıkken oyuncular bu haritayı birinci şahıstan görür">Oyuncular için aç</button>` : "");
      sp ? bar.insertBefore(frag, sp) : bar.appendChild(frag);
    }
    if (!isDM() && m.fpMode && !FP.open && dismissed[m.id] !== (m.fpAt || 1) && pickToken(m)) setTimeout(() => { if (!FP.open && S.view === "harita") open(); }, 0);
  };

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-fp]"); if (!b) return; const a = b.dataset.fp;
    if (a === "open") return open();
    if (a === "close") return close();
    if (a === "force") { const m = curMap(); if (!m || !isDM()) return; m.fpMode = !m.fpMode; m.fpAt = Date.now(); save("maps", m, ["fpMode", "fpAt"]);
      toast(m.fpMode ? "Oyuncular bu haritayı birinci şahıstan görecek" : "Oyuncular yeniden kuşbakışı haritayı görecek"); render(); return; }
    if (a === "step") return move(+b.dataset.f, 0);
    if (a === "side") return move(0, +b.dataset.s);
    if (a === "turn") return turn(+b.dataset.k);
    if (a === "up") return stairs(1);
    if (a === "down") return stairs(-1);
  });

  document.addEventListener("keydown", e => {
    if (!FP.open || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const act = { ArrowUp: () => move(1, 0), w: () => move(1, 0), ArrowDown: () => move(-1, 0), s: () => move(-1, 0),
      ArrowLeft: () => turn(-1), q: () => turn(-1), ArrowRight: () => turn(1), e: () => turn(1),
      a: () => move(0, -1), d: () => move(0, 1), Escape: () => close(), " ": () => stairs(0), PageUp: () => stairs(1), PageDown: () => stairs(-1) }[k];
    if (!act) return; e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat || k !== "Escape") act();
  }, true);
  window.addEventListener("resize", resize);
})();
