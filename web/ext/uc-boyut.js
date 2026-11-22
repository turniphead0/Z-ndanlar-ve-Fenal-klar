/* Masaüstü eklentileri: isteğe bağlı 3B harita görünümü.
   Harita araç çubuğunda "2B | 3B" seçimi var; 2B varsayılandır ve seçim bu cihazda hatırlanır. 3B'de aynı harita
   gerçek üç boyutlu çizilir: zemin (arka plan resmi, araziler, ızgara, etiketler, sis), taş duvarlar, kapılar, ağaçlar,
   mobilyalar ve jetonlar. Çizimi oyuncunun tarayıcısı yapar (WebGL); sunucuya yük binmez.
   Kütüphane: three.js r170 (MIT, web/ext/kutuphane/three-r170.js), yalnızca 3B ilk açıldığında yüklenir.
   Mobilyaların çoğu kodla kurulan 3B modellerdir (hazır model dosyası, telif sorunu yok). Modeli olmayan nesneler,
   DM'in kendi yüklediği nesneler ve kendi resmini verdiği mobilyalar kendi resimleriyle ayakta duran kart olur.
   Fareyle sürükle: döndür · sağ tık ya da Shift ile sürükle: kaydır · tekerlek / iki parmak: yaklaş.
   Tıklama 2B'deki gibi çalışır: jeton seç, seçili jetonu bir kareye taşı, DM boyama araçlarıyla kare boya, işaret et. */
(function () {
  "use strict";

  const PREF = "zm-harita-gorunum", PREF_SH = "zm-3b-golge", PREF_LOW = "zm-3b-alcak";
  const WALL_H = 1.5, LOW_H = .32;
  const U = { on: false, T: null, loading: null, ready: false, dirty: true, sig: "", tsig: "", mapId: null, raf: 0, need: true,
    orbit: { az: -.5, pol: .85, dist: 14, tx: 0, tz: 0 }, toks: new Map(), flick: [], disp: [] };
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  U.on = ls(PREF) === "3b";
  U.shadows = ls(PREF_SH) !== "0";
  U.low = ls(PREF_LOW) === "1";

  function webgl() { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; } }
  function loadThree() {
    if (!U.loading) U.loading = import("/ext/kutuphane/three-r170.js").then(T => { U.T = T; init(); return T; })
      .catch(e => { console.error(e); U.loading = null; U.on = false; ls(PREF, "2b"); toast("3B görünüm yüklenemedi, 2B haritaya dönüldü"); render(); });
    return U.loading;
  }

  /* ---------- malzemeler ve dokular ---------- */
  let M = null;
  function texFrom(canvas, rep = 1) {
    const T = U.T, t = new T.CanvasTexture(canvas); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep, rep);
    t.anisotropy = Math.min(8, U.renderer.capabilities.getMaxAnisotropy()); return t;
  }
  function dokuTex(ad, renk, rep = 1) {
    const D = window.ZMDoku; if (!D) return null;
    try { return texFrom(D.doku(ad, renk || D.VARS[ad], 256), rep); } catch (e) { return null; }
  }
  function mats() {
    if (M) return M; const T = U.T;
    const std = (o) => new T.MeshStandardMaterial(Object.assign({ roughness: .8 }, o));
    M = {
      wood: std({ color: 0xffffff, map: dokuTex("tahta", "#8a5a32") || null, roughness: .75 }),
      woodDark: std({ color: 0x8a7766, map: dokuTex("tahta", "#5a3a22") || null }),
      woodLight: std({ color: 0xffffff, map: dokuTex("parke", "#a57a4e") || null, roughness: .7 }),
      stone: std({ color: 0xffffff, map: dokuTex("kaya") || null, roughness: .95, flatShading: true }),
      marble: std({ color: 0xffffff, map: dokuTex("mermer") || null, roughness: .5 }),
      iron: std({ color: 0x55595e, metalness: .85, roughness: .45 }),
      brass: std({ color: 0xb08a3c, metalness: .9, roughness: .35 }),
      cloth: std({ color: 0x8c2f2a, roughness: 1 }),
      blue: std({ color: 0x2f4f6b, roughness: 1 }),
      linen: std({ color: 0xd9d2bf, roughness: 1 }),
      canvas: std({ color: 0xc8b48a, roughness: 1, side: T.DoubleSide }),
      bone: std({ color: 0xd8cfb4, roughness: .7 }),
      wax: std({ color: 0xefe6cf, roughness: .6 }),
      clay: std({ color: 0xa8603a, roughness: .9 }),
      water: std({ color: 0x2f6f8f, roughness: .15, metalness: .1 }),
      leaf: std({ color: 0x4f7a34, roughness: .9, flatShading: true }),
      leafDark: std({ color: 0x2f5a2c, roughness: .9, flatShading: true }),
      bark: std({ color: 0xffffff, map: dokuTex("kabuk") || null, roughness: 1 }),
      flame: new T.MeshBasicMaterial({ color: 0xffa233 }),
      flameCore: new T.MeshBasicMaterial({ color: 0xfff0a0 }),
      glow: new T.MeshBasicMaterial({ color: 0x9fd8ff }),
      dark: std({ color: 0x1e1e1e, roughness: .5 }),
      book: [0x7a2e2a, 0x2f4f6b, 0x3e5e3a, 0x6b5a2a, 0x4a3060, 0x8a6a40].map(c => std({ color: c })),
    };
    return M;
  }

  /* ---------- küçük yardımcılar ---------- */
  const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new U.T.Mesh(new U.T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };
  const cyl = (rt, rb, h, m, x = 0, y = 0, z = 0, seg = 14) => { const o = new U.T.Mesh(new U.T.CylinderGeometry(rt, rb, h, seg), m); o.position.set(x, y, z); return o; };
  const ball = (r, m, x = 0, y = 0, z = 0, d = 1) => { const o = new U.T.Mesh(new U.T.IcosahedronGeometry(r, d), m); o.position.set(x, y, z); return o; };
  const lathe = (pts, m, seg = 20) => new U.T.Mesh(new U.T.LatheGeometry(pts.map(([a, b]) => new U.T.Vector2(a, b)), seg), m);
  const grp = (...k) => { const g = new U.T.Group(); k.forEach(o => g.add(o)); return g; };
  let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  function flame(g, x, y, z, s = 1, light) {
    const f1 = new U.T.Mesh(new U.T.ConeGeometry(.05 * s, .18 * s, 8), M.flame); f1.position.set(x, y + .09 * s, z);
    const f2 = new U.T.Mesh(new U.T.ConeGeometry(.026 * s, .1 * s, 8), M.flameCore); f2.position.set(x, y + .06 * s, z);
    f1.userData.anim = f2.userData.anim = 1; g.add(f1, f2); if (light) g.userData.light = { x, y: y + .2 * s, z, ...light };
  }

  /* ---------- mobilyalar: her biri bir kareye sığar, önü +z yönüne bakar ---------- */
  const B = {
    yatak() { const g = grp(box(.8, .2, .94, M.wood, 0, .2, 0), box(.82, .55, .06, M.woodDark, 0, .35, -.46), box(.74, .12, .86, M.linen, 0, .36, .02), box(.78, .05, .55, M.cloth, 0, .43, .18));
      const p = ball(.16, M.linen, 0, .45, -.3, 2); p.scale.set(1.9, .45, .8); g.add(p); return g; },
    kanepe() { return grp(box(.9, .22, .6, M.cloth, 0, .2, .05), box(.9, .42, .14, M.cloth, 0, .4, -.25), box(.12, .32, .6, M.cloth, -.42, .32, .05), box(.12, .32, .6, M.cloth, .42, .32, .05), box(.86, .08, .7, M.woodDark, 0, .05, 0)); },
    sandalye() { const g = grp(box(.42, .05, .42, M.wood, 0, .46, 0)); for (const a of [-1, 1]) for (const b of [-1, 1]) g.add(box(.045, .46, .045, M.woodDark, a * .18, .23, b * .18));
      for (const a of [-1, 1]) g.add(box(.045, .5, .045, M.woodDark, a * .18, .72, -.18)); for (const h of [.66, .82]) g.add(box(.38, .06, .03, M.wood, 0, h, -.18)); return g; },
    sofra() { const g = grp(box(.9, .06, .9, M.wood, 0, .72, 0)); for (const a of [-1, 1]) for (const b of [-1, 1]) g.add(box(.07, .7, .07, M.woodDark, a * .37, .35, b * .37));
      g.add(cyl(.11, .09, .03, M.linen, -.15, .765, .1, 16), cyl(.04, .03, .1, M.brass, .18, .8, -.15)); return g; },
    dolap() { return grp(box(.9, 1.35, .5, M.wood, 0, .675, -.2), box(.42, 1.2, .02, M.woodDark, -.22, .7, .06), box(.42, 1.2, .02, M.woodDark, .22, .7, .06), box(.03, .12, .03, M.brass, -.04, .7, .08), box(.03, .12, .03, M.brass, .04, .7, .08)); },
    kitaplik() { const W = .9, D = .3, H = 1.3, g = grp(box(.04, H, D, M.woodDark, -W / 2, H / 2, -.3), box(.04, H, D, M.woodDark, W / 2, H / 2, -.3), box(W, .03, D, M.woodDark, 0, H, -.3), box(W, H, .02, M.woodDark, 0, H / 2, -.44));
      for (let s = 0; s < 4; s++) { const y = .04 + s * .32; g.add(box(W, .03, D, M.woodDark, 0, y, -.3)); let x = -W / 2 + .04;
        while (x < W / 2 - .09) { const w = .035 + rnd() * .035, h = .19 + rnd() * .08; g.add(box(w, h, .22, M.book[rnd() * 6 | 0], x + w / 2, y + .015 + h / 2, -.29)); x += w + .005; } }
      return g; },
    kutu() { const g = grp(box(.6, .5, .6, M.woodLight, 0, .25, 0)); for (const z of [-1, 1]) g.add(box(.62, .05, .02, M.woodDark, 0, .25, z * .3)); return g; },
    sandik() { const lid = new U.T.CylinderGeometry(.24, .24, .78, 18, 1, false, 0, Math.PI); lid.rotateZ(Math.PI / 2);
      const g = grp(box(.78, .4, .48, M.wood, 0, .2, 0), Object.assign(new U.T.Mesh(lid, M.wood), {}), box(.1, .12, .04, M.brass, 0, .4, .25));
      g.children[1].position.y = .4; for (const x of [-.3, .3]) g.add(box(.04, .41, .5, M.iron, x, .2, 0)); return g; },
    varil() { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([.25 + .05 * Math.sin(Math.PI * t), t * .82]); }
      const g = grp(lathe(pts, M.woodDark, 18), cyl(.25, .25, .01, M.wood, 0, .815, 0, 18));
      for (const [y, r] of [[.1, .272], [.41, .302], [.72, .272]]) { const t = new U.T.Mesh(new U.T.TorusGeometry(r, .013, 5, 24), M.iron); t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t); } return g; },
    tabut() { const sh = new U.T.Shape([[-.17, -.45], [-.25, -.1], [-.17, .45], [.17, .45], [.25, -.1], [.17, -.45]].map(([a, b]) => new U.T.Vector2(a, b)));
      const geo = new U.T.ExtrudeGeometry(sh, { depth: .32, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
      const g = grp(new U.T.Mesh(geo, M.woodDark), box(.04, .01, .4, M.brass, 0, .325, -.05), box(.24, .01, .04, M.brass, 0, .325, -.12)); return g; },
    mesale() { const g = grp(box(.1, .14, .04, M.iron, 0, 1.0, -.47)); const st = cyl(.025, .02, .34, M.woodDark, 0, 1.08, -.39, 8); st.rotation.x = .45; g.add(st, cyl(.05, .03, .07, M.iron, 0, 1.24, -.32, 10));
      flame(g, 0, 1.27, -.32, 1.1, { c: 0xff9a40, i: 5, d: 6 }); return g; },
    kandil() { const g = grp(cyl(.03, .1, .5, M.iron, 0, .25, 0, 10), lathe([[.0, 0], [.11, .02], [.08, .07], [.02, .09]], M.brass, 14)); g.children[1].position.y = .5; flame(g, .08, .56, 0, .6, { c: 0xffb060, i: 2.5, d: 5 }); return g; },
    mum() { const g = grp(cyl(.08, .1, .03, M.brass, 0, .015, 0), cyl(.035, .035, .22, M.wax, 0, .14, 0, 10)); flame(g, 0, .25, 0, .45, { c: 0xffc070, i: 1.2, d: 3 }); return g; },
    kaya() { const r = ball(.32, M.stone, 0, .22, 0, 1); r.scale.set(1.2, .8, 1); const r2 = ball(.18, M.stone, .22, .12, .18, 0); return grp(r, r2); },
    tugla() { const g = grp(); for (let i = 0; i < 9; i++) { const b = box(.22, .1, .12, M.stone, (rnd() - .5) * .6, .05 + (i % 3) * .08, (rnd() - .5) * .6); b.rotation.y = rnd() * 3; g.add(b); } return g; },
    kurukafa() { const s = ball(.11, M.bone, 0, .11, 0, 2); s.scale.set(1, .95, 1.1); return grp(s, box(.12, .06, .1, M.bone, 0, .035, .06)); },
    kemik() { const g = grp(); for (let i = 0; i < 4; i++) { const c = cyl(.018, .018, .32, M.bone, (rnd() - .5) * .4, .02, (rnd() - .5) * .4, 6); c.rotation.set(Math.PI / 2, rnd() * 3, 0); g.add(c); } return g; },
    taht() { return grp(box(.8, .14, .7, M.stone, 0, .07, 0), box(.6, .4, .5, M.woodDark, 0, .34, 0), box(.62, .06, .52, M.cloth, 0, .56, 0), box(.64, .9, .1, M.woodDark, 0, .95, -.22),
      box(.08, .26, .5, M.woodDark, -.3, .68, 0), box(.08, .26, .5, M.woodDark, .3, .68, 0), ball(.05, M.brass, -.3, 1.43, -.22, 1), ball(.05, M.brass, .3, 1.43, -.22, 1)); },
    heykel() { const g = grp(box(.6, .3, .6, M.marble, 0, .15, 0), lathe([[.16, 0], [.15, .3], [.1, .65], [.13, .75], [0, .8]], M.marble, 16)); g.children[1].position.y = .3;
      g.add(ball(.1, M.marble, 0, 1.18, 0, 2), cyl(.035, .03, .4, M.marble, .17, .85, 0, 8)); g.children.at(-1).rotation.z = .5; return g; },
    amfora() { const g = lathe([[.06, 0], [.17, .12], [.2, .3], [.14, .5], [.06, .58], [.07, .68], [.09, .7]], M.clay, 18); return grp(g); },
    sancak() { const g = grp(cyl(.15, .18, .08, M.stone, 0, .04, 0), cyl(.02, .02, 1.7, M.woodDark, 0, .85, 0, 8));
      const f = new U.T.Mesh(new U.T.PlaneGeometry(.55, .38, 6, 1), new U.T.MeshStandardMaterial({ color: 0x8c2f2a, side: U.T.DoubleSide, roughness: 1 }));
      const p = f.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 9) * .03); f.geometry.computeVertexNormals(); f.position.set(.29, 1.45, 0); g.add(f); return g; },
    cesme() { const g = grp(lathe([[.42, 0], [.44, .3], [.38, .32], [.38, .12], [0, .12]], M.marble, 24), cyl(.37, .37, .02, M.water, 0, .26, 0, 24), cyl(.06, .08, .6, M.marble, 0, .5, 0, 12), lathe([[.0, 0], [.2, .05], [.2, .08], [0, .1]], M.marble, 16));
      g.children[3].position.y = .8; g.add(cyl(.18, .18, .01, M.water, 0, .88, 0, 16)); return g; },
    agac() { return grp(cyl(.07, .1, .6, M.bark, 0, .3, 0, 8), ball(.36, M.leaf, 0, .85, 0, 1), ball(.26, M.leafDark, .18, .7, .1, 1), ball(.24, M.leaf, -.15, 1.05, -.05, 1)); },
    cam() { const g = grp(cyl(.06, .08, .3, M.bark, 0, .15, 0, 8)); for (const [y, r] of [[.5, .42], [.82, .32], [1.1, .22]]) { const c = new U.T.Mesh(new U.T.ConeGeometry(r, .5, 9), M.leafDark); c.position.y = y; g.add(c); } return g; },
    palmiye() { const g = grp(); for (let i = 0; i < 6; i++) { const c = cyl(.06, .07, .22, M.bark, i * .025, .11 + i * .2, 0, 7); c.rotation.z = -i * .03; g.add(c); }
      for (let i = 0; i < 6; i++) { const l = box(.55, .02, .14, M.leaf, 0, 0, 0); l.geometry.translate(.27, 0, 0); l.position.set(.14, 1.25, 0); l.rotation.set(0, i * Math.PI / 3, -.45); g.add(l); } return g; },
    kaktus() { const g = grp(cyl(.09, .1, .8, M.leaf, 0, .4, 0, 10), cyl(.06, .06, .3, M.leaf, .17, .45, 0, 8), cyl(.06, .06, .25, M.leaf, -.16, .55, 0, 8));
      g.children[1].rotation.z = -.2; g.children[2].rotation.z = .2; return g; },
    kutuk() { const c = cyl(.17, .17, .8, M.bark, 0, .17, 0, 12); c.rotation.z = Math.PI / 2; return grp(c); },
    kamp() { const g = grp(); for (let i = 0; i < 4; i++) { const c = cyl(.04, .04, .5, M.bark, 0, .06, 0, 6); c.rotation.set(Math.PI / 2 - .3, i * Math.PI / 2, 0); c.position.set(Math.sin(i * Math.PI / 2) * .08, .1, Math.cos(i * Math.PI / 2) * .08); g.add(c); }
      for (let i = 0; i < 7; i++) g.add(ball(.07, M.stone, Math.cos(i) * .3, .04, Math.sin(i) * .3, 0)); flame(g, 0, .1, 0, 1.6, { c: 0xff8a30, i: 6, d: 7 }); return g; },
    cadir() { const c = new U.T.Mesh(new U.T.ConeGeometry(.55, 1.1, 4, 1, true), M.canvas); c.position.y = .55; c.rotation.y = Math.PI / 4; return grp(c, cyl(.02, .02, 1.25, M.woodDark, 0, .62, 0, 6)); },
    kure() { const g = grp(lathe([[.14, 0], [.06, .2], [.1, .3], [.12, .32]], M.woodDark, 14), ball(.15, M.glow, 0, .45, 0, 3)); g.userData.light = { x: 0, y: .45, z: 0, c: 0x9fd8ff, i: 1.5, d: 3 }; return g; },
    fener() { const g = grp(box(.2, .03, .2, M.iron, 0, .015, 0), box(.2, .03, .2, M.iron, 0, .4, 0), box(.14, .34, .14, M.glow, 0, .2, 0), cyl(.0, .1, .1, M.iron, 0, .47, 0, 4));
      g.children[2].material = M.flameCore; g.userData.light = { x: 0, y: .25, z: 0, c: 0xffc070, i: 3, d: 7 }; return g; },
    saksi() { return grp(cyl(.16, .12, .26, M.clay, 0, .13, 0, 14), ball(.2, M.leaf, 0, .38, 0, 1), ball(.14, M.leafDark, .1, .5, .05, 1)); },
    kuvet() { return grp(lathe([[.0, .02], [.34, .02], [.4, .4], [.36, .4], [.3, .08], [0, .08]], M.marble, 24), cyl(.33, .33, .01, M.water, 0, .3, 0, 20)); },
    piyano() { return grp(box(.9, .75, .35, M.dark, 0, .55, -.25), box(.9, .05, .25, M.linen, 0, .56, .02), box(.9, .18, .3, M.dark, 0, .48, .02), box(.06, .5, .06, M.dark, -.4, .25, .05), box(.06, .5, .06, M.dark, .4, .25, .05)); },
    can() { return grp(box(.06, 1.2, .06, M.woodDark, -.35, .6, 0), box(.06, 1.2, .06, M.woodDark, .35, .6, 0), box(.8, .06, .08, M.woodDark, 0, 1.18, 0), lathe([[.0, 0], [.2, 0], [.16, .1], [.11, .3], [0, .34]], M.brass, 16)); },
  };
  B.can = (f => () => { const g = f(); g.children[3].position.y = .8; return g; })(B.can);
  B.tablo = () => grp(box(.7, .5, .04, M.brass, 0, 1.0, -.46), box(.6, .4, .01, M.blue, 0, 1.0, -.44));
  B.ayna = () => grp(box(.5, .8, .04, M.woodDark, 0, .9, -.46), box(.42, .72, .01, M.glow, 0, .9, -.44));
  B.pencere = () => grp(box(.7, .7, .06, M.woodDark, 0, .95, -.47), box(.62, .62, .01, M.glow, 0, .95, -.44), box(.04, .62, .02, M.woodDark, 0, .95, -.43), box(.62, .04, .02, M.woodDark, 0, .95, -.43));
  B.dag = () => { const c = new U.T.Mesh(new U.T.ConeGeometry(.5, 1.2, 6), M.stone); c.position.y = .6; const s = new U.T.Mesh(new U.T.ConeGeometry(.17, .4, 6), M.linen); s.position.y = 1.0; return grp(c, s); };
  B.yanardag = () => { const g = B.dag(); g.children[1].material = M.flame; g.userData.light = { x: 0, y: 1.2, z: 0, c: 0xff5a20, i: 4, d: 8 }; return g; };
  const WALLED = new Set(["kitaplik", "dolap", "mesale", "tablo", "ayna", "pencere", "piyano"]);

  /* ---------- geometri birleştirme: aynı malzemeli parçalar tek çizim çağrısı olur ---------- */
  function mergeByMaterial(roots) {
    const T = U.T, buckets = new Map(), out = [];
    for (const r of roots) { r.updateMatrixWorld(true); r.traverse(o => {
      if (!o.isMesh || o.userData.anim) return;
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
      if (!g.attributes.uv) g.setAttribute("uv", new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      (buckets.get(o.material) || buckets.set(o.material, []).get(o.material)).push(g); o.geometry.dispose(); }); }
    for (const [mat, gs] of buckets) {
      const n = gs.reduce((a, g) => a + g.attributes.position.count, 0), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
      let k = 0; for (const g of gs) { pos.set(g.attributes.position.array, k * 3); nor.set(g.attributes.normal.array, k * 3); uv.set(g.attributes.uv.array, k * 2); k += g.attributes.position.count; g.dispose(); }
      const geo = new T.BufferGeometry(); geo.setAttribute("position", new T.BufferAttribute(pos, 3)); geo.setAttribute("normal", new T.BufferAttribute(nor, 3)); geo.setAttribute("uv", new T.BufferAttribute(uv, 2));
      geo.computeBoundingSphere(); const mesh = new T.Mesh(geo, mat); mesh.castShadow = mesh.receiveShadow = true; out.push(mesh);
    }
    return out;
  }

  /* ---------- sahne ---------- */
  function init() {
    const T = U.T;
    U.cv = document.createElement("canvas"); U.cv.className = "u3-cv"; U.cv.tabIndex = 0; U.cv.setAttribute("aria-label", "3B harita");
    U.renderer = new T.WebGLRenderer({ canvas: U.cv, antialias: true });
    U.renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); U.renderer.shadowMap.enabled = U.shadows; U.renderer.shadowMap.type = T.PCFSoftShadowMap;
    U.renderer.toneMapping = T.ACESFilmicToneMapping; U.renderer.outputColorSpace = T.SRGBColorSpace;
    U.scene = new T.Scene(); U.scene.background = new T.Color(0x0e1114);
    U.camera = new T.PerspectiveCamera(45, 1, .05, 400);
    U.hemi = new T.HemisphereLight(0xc9d6e6, 0x3a3026, .7); U.sun = new T.DirectionalLight(0xfff1dd, 1.1);
    U.sun.castShadow = true; U.sun.shadow.mapSize.set(2048, 2048); U.sun.shadow.bias = -.0006; U.sun.shadow.normalBias = .02;
    U.scene.add(U.hemi, U.sun, U.sun.target);
    U.world = new T.Group(); U.tokG = new T.Group(); U.scene.add(U.world, U.tokG);
    U.box = document.createElement("div"); U.box.className = "u3-box";
    U.box.innerHTML = `<div class="u3-ctl" role="group" aria-label="3B görünüm ayarları">
        <button class="btn sm" data-u3a="egik" title="Haritaya eğik açıyla bak">Eğik</button><button class="btn sm" data-u3a="ust" title="Haritaya tam yukarıdan bak">Yukarıdan</button>
        <button class="btn sm" data-u3a="alcak" aria-pressed="${U.low}" title="Duvarları alçalt, arkası görünsün">Alçak duvar</button>
        <button class="btn sm" data-u3a="golge" aria-pressed="${U.shadows}" title="Gölgeler (eski cihazlarda kapatmak hızlandırır)">Gölge</button></div>
      <p class="u3-help">Sürükle: döndür · Sağ tık ya da Shift + sürükle: kaydır · Tekerlek: yaklaş · Tıkla: seç ve taşı</p>`;
    U.box.prepend(U.cv);
    new ResizeObserver(resize).observe(U.box);
    bindInput(); U.ready = true; U.dirty = true;
  }
  function resize() {
    if (!U.ready) return; const w = U.box.clientWidth, h = U.box.clientHeight; if (!w || !h) return;
    U.renderer.setSize(w, h, false); U.camera.aspect = w / h; U.camera.updateProjectionMatrix(); U.need = true;
  }
  function disposeWorld() {
    U.world.traverse(o => { if (o.isMesh || o.isInstancedMesh) o.geometry?.dispose(); if (o.isSprite) o.material.dispose(); });
    for (const d of U.disp) d.dispose(); U.disp = [];
    U.world.clear(); U.flick = [];
  }

  function cols() { const c = { floor: cssVar("--map-floor") || "#c9c0ae", ink: cssVar("--ink") || "#222" }; TERRAIN.forEach(t => c[t[0]] = cssVar(t[2])); return c; }
  function staticSig(m) {
    const g = (S.games[G.id] || {}), D = window.ZMDoku;
    return [m.id, m.cols, m.rows, JSON.stringify(m.cells || {}), JSON.stringify(m.props || {}), m.bg, !!getImg(m.bg), m.fogOn, m.fogOn ? JSON.stringify(m.fog || {}) : "", isDM(), m.gridOff,
      JSON.stringify(labs(m)), JSON.stringify(g.skins || {}), JSON.stringify(g.props || {}), JSON.stringify(m.light || {}), U.low, !!D, document.documentElement.dataset.sys || "", cssVar("--map-floor"),
      window.PROPS ? Object.values(m.props || {}).filter(v => v && getImg(PROPS.get(v)?.img)).length : 0].join("§");
  }

  function floorTexture(m, col) {
    const dm = isDM(), P = Math.max(8, Math.min(48, Math.floor(4096 / Math.max(m.cols, m.rows)), Math.floor(Math.sqrt(8e6 / Math.max(1, m.cols * m.rows)))));
    const c = document.createElement("canvas"); c.width = m.cols * P; c.height = m.rows * P; const x = c.getContext("2d");
    x.fillStyle = col.floor; x.fillRect(0, 0, c.width, c.height);
    const D = window.ZMDoku; if (D && !m.bg) { try { x.globalAlpha = .55; x.fillStyle = D.desen(x, "kaldirim", D.karis(col.floor, D.VARS.kaldirim, .5), P, 2); x.fillRect(0, 0, c.width, c.height); x.globalAlpha = 1; } catch (e) {} }
    const im = getImg(m.bg); if (im) x.drawImage(im, 0, 0, c.width, c.height);
    for (const [k, v] of Object.entries(m.cells || {})) { if (!v || v === "wall" || v === "door" || v === "tree") continue; const [cx, cy] = k.split(",").map(Number);
      if (cx >= m.cols || cy >= m.rows || (v === "trap" && !dm) || (!dm && fogged(m, cx, cy))) continue; try { drawTerrain(x, v, cx * P, cy * P, P, col, im); } catch (e) {} }
    if (!m.gridOff) { x.strokeStyle = "rgba(0,0,0,.28)"; x.lineWidth = Math.max(1, P / 32); x.beginPath();
      for (let i = 0; i <= m.cols; i++) { x.moveTo(i * P, 0); x.lineTo(i * P, c.height); } for (let j = 0; j <= m.rows; j++) { x.moveTo(0, j * P); x.lineTo(c.width, j * P); } x.stroke(); }
    x.textAlign = "center"; x.textBaseline = "middle";
    for (const l of visLabs(m)) { x.font = `700 ${Math.max(10, Math.round(P * .42))}px ${cssVar("--f-display") || "serif"}`; x.lineWidth = Math.max(3, P / 8); x.strokeStyle = col.floor; x.strokeText(l.text || "", (l.x + .5) * P, (l.y + .5) * P); x.fillStyle = col.ink; x.fillText(l.text || "", (l.x + .5) * P, (l.y + .5) * P); }
    if (m.fogOn) { x.fillStyle = dm ? (cssVar("--fog") || "#000") : "#07090b"; x.globalAlpha = dm ? .45 : 1;
      for (let j = 0; j < m.rows; j++) for (let i = 0; i < m.cols; i++) if (fogged(m, i, j)) x.fillRect(i * P, j * P, P + .5, P + .5); x.globalAlpha = 1; }
    const t = texFrom(c); t.wrapS = t.wrapT = U.T.ClampToEdgeWrapping; U.disp.push(t); return t;
  }

  function cellAt(m, x, y) { return x < 0 || y < 0 || x >= m.cols || y >= m.rows ? "wall" : (m.cells || {})[x + "," + y] || ""; }
  const hidden = (m, x, y) => !isDM() && fogged(m, x, y);

  function build(m) {
    const T = U.T; mats(); disposeWorld(); seed = 1;
    const col = cols(), H = U.low ? LOW_H : WALL_H, W = m.cols, R = m.rows, D = window.ZMDoku;
    // zemin
    const fl = new T.Mesh(new T.PlaneGeometry(W, R), new T.MeshStandardMaterial({ map: floorTexture(m, col), roughness: .95 }));
    fl.rotation.x = -Math.PI / 2; fl.position.set(W / 2, 0, R / 2); fl.receiveShadow = true; fl.userData.floor = 1; U.world.add(fl); U.disp.push(fl.material);
    const under = new T.Mesh(new T.BoxGeometry(W + .6, .3, R + .6), new T.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 1 })); under.position.set(W / 2, -.151, R / 2); U.world.add(under); U.disp.push(under.material);
    // duvarlar (tek çizimde, örnekli)
    const walls = [], doors = [], trees = [];
    for (const [k, v] of Object.entries(m.cells || {})) { const [x, y] = k.split(",").map(Number); if (x >= W || y >= R || hidden(m, x, y)) continue;
      if (v === "wall") walls.push([x, y]); else if (v === "door") doors.push([x, y]); else if (v === "tree") trees.push([x, y]); }
    const wallCol = D ? D.karis(col.wall || "#555", D.VARS.tas, .55) : (col.wall || "#666");
    const wTex = dokuTex("tas", wallCol, 1); if (wTex) { wTex.repeat.set(1, H); U.disp.push(wTex); }
    const wSide = new T.MeshStandardMaterial({ color: wTex ? 0xffffff : wallCol, map: wTex, roughness: .95 }), wTop = new T.MeshStandardMaterial({ color: 0x2b2926, roughness: 1 });
    U.disp.push(wSide, wTop);
    if (walls.length) { const im = new T.InstancedMesh(new T.BoxGeometry(1, H, 1), [wSide, wSide, wTop, wSide, wSide, wSide], walls.length), o = new T.Object3D();
      walls.forEach(([x, y], i) => { o.position.set(x + .5, H / 2, y + .5); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); im.castShadow = im.receiveShadow = true; U.world.add(im); }
    // ağaçlar (örnekli gövde ve iki yaprak kümesi)
    if (trees.length) {
      const trunk = new T.InstancedMesh(new T.CylinderGeometry(.08, .12, .7, 7), M.bark, trees.length), l1 = new T.InstancedMesh(new T.IcosahedronGeometry(.45, 1), M.leaf, trees.length), l2 = new T.InstancedMesh(new T.IcosahedronGeometry(.32, 1), M.leafDark, trees.length);
      const o = new T.Object3D(); trees.forEach(([x, y], i) => { const h = ((x * 73856093) ^ (y * 19349663)) >>> 0, s = .85 + (h % 100) / 300, dx = ((h >> 8) % 20 - 10) / 100, dz = ((h >> 16) % 20 - 10) / 100;
        o.rotation.set(0, h % 6, 0); o.scale.setScalar(s); o.position.set(x + .5 + dx, .35 * s, y + .5 + dz); o.updateMatrix(); trunk.setMatrixAt(i, o.matrix);
        o.position.set(x + .5 + dx, .95 * s, y + .5 + dz); o.updateMatrix(); l1.setMatrixAt(i, o.matrix); o.position.set(x + .5 + dx + .18 * s, 1.25 * s, y + .5 + dz - .1 * s); o.updateMatrix(); l2.setMatrixAt(i, o.matrix); });
      for (const im of [trunk, l1, l2]) { im.castShadow = im.receiveShadow = true; U.world.add(im); }
    }
    // kapılar ve mobilyalar: kurulur, sonra malzemeye göre birleştirilir
    const statics = [], solidMat = (c) => { const mm = new T.MeshStandardMaterial({ color: c, roughness: .8 }); U.disp.push(mm); return mm; };
    const doorMat = D ? (() => { const t = dokuTex("tahta", col.door || "#8a5a32"); if (t) U.disp.push(t); const mm = new T.MeshStandardMaterial({ map: t, roughness: .75 }); U.disp.push(mm); return mm; })() : solidMat(col.door || "#8a5a32");
    for (const [x, y] of doors) {
      const ew = cellAt(m, x - 1, y) === "wall" || cellAt(m, x + 1, y) === "wall", g = new T.Group();
      g.add(box(1, Math.max(.06, H - 1.2), 1, wSide, 0, H - Math.max(.06, H - 1.2) / 2, 0)); if (!U.low) { g.add(box(.9, 1.18, .1, doorMat, 0, .59, 0), box(.06, .06, .06, M.brass, .3, .6, .07)); }
      else g.add(box(.9, LOW_H, .1, doorMat, 0, LOW_H / 2, 0));
      if (!ew) g.rotation.y = Math.PI / 2; g.position.set(x + .5, 0, y + .5); statics.push(g);
    }
    const lights = [], sprites = [];
    for (const [k, v] of Object.entries(m.props || {})) {
      if (!v || !window.PROPS) continue; const [x, y] = k.split(",").map(Number); if (x >= W || y >= R || hidden(m, x, y)) continue;
      const it = PROPS.get(v); if (!it) continue; const key = it.custom ? "" : it.key;
      if (B[key] && !it.own) {
        const g = B[key](); g.position.set(x + .5, 0, y + .5); g.rotation.y = facing(m, x, y, key);
        if (g.userData.light) { const l = g.userData.light; g.updateMatrixWorld(true); const p = new T.Vector3(l.x, l.y, l.z).applyMatrix4(g.matrixWorld); lights.push({ p, c: l.c, i: l.i, d: l.d }); }
        g.updateMatrixWorld(true); g.traverse(o => { if (o.userData.anim) { const c = o.clone(); o.matrixWorld.decompose(c.position, c.quaternion, c.scale); c.userData.anim = 1; U.world.add(c); U.flick.push({ o: c, ph: rnd() * 9 }); } });
        statics.push(g);
      } else sprites.push([x, y, it]);
      if (it.custom && +it.light > 0) lights.push({ p: new T.Vector3(x + .5, .8, y + .5), c: 0xffc080, i: 2.5, d: Math.max(2, +it.light / 5 * 1.2) });
    }
    for (const mesh of mergeByMaterial(statics)) U.world.add(mesh);
    // modeli olmayan ya da kendi resmi olan nesneler: ayakta duran resim
    for (const [x, y, it] of sprites) {
      const im = getImg(it.img); if (!im) continue; const t = new T.Texture(im); t.colorSpace = T.SRGBColorSpace; t.needsUpdate = true; U.disp.push(t);
      const h = Math.max(.35, Math.min(1.6, (+it.h || .6) * 1.1)), sp = new T.Sprite(new T.SpriteMaterial({ map: t, alphaTest: .4 }));
      sp.center.set(.5, 0); sp.scale.set(h * im.naturalWidth / Math.max(1, im.naturalHeight), h, 1); sp.position.set(x + .5, .02, y + .5); U.world.add(sp);
      const sh = new T.Mesh(new T.CircleGeometry(.3, 16), new T.MeshBasicMaterial({ color: 0, transparent: true, opacity: .25, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.set(x + .5, .01, y + .5); U.world.add(sh); U.disp.push(sh.material);
    }
    // ışık: harita ışığı açıksa ortam karanlığına göre, ışık veren mobilyalar ve jetonlar
    const L = m.light?.on ? (m.light.amb || "dark") : "bright", amb = { dark: [.12, 0], dim: [.32, .25], bright: [.75, 1.1] }[L] || [.75, 1.1];
    U.hemi.intensity = amb[0]; U.sun.intensity = amb[1]; U.scene.background.set(L === "bright" ? 0x1a2026 : 0x07090b);
    for (const l of lights.slice(0, 14)) { const pl = new T.PointLight(l.c, l.i * (L === "bright" ? .6 : 1.6), l.d * 1.6, 1.4); pl.position.copy(l.p); U.world.add(pl); U.flick.push({ l: pl, base: pl.intensity, ph: rnd() * 9 }); }
    const S2 = Math.max(W, R) / 2 + 2; U.sun.position.set(W / 2 - S2 * .5, S2 * 1.6, R / 2 + S2 * .8); U.sun.target.position.set(W / 2, 0, R / 2);
    Object.assign(U.sun.shadow.camera, { left: -S2 * 1.1, right: S2 * 1.1, top: S2 * 1.1, bottom: -S2 * 1.1, near: 1, far: S2 * 5 }); U.sun.shadow.camera.updateProjectionMatrix();
    U.sun.castShadow = U.shadows && W * R <= 12000;
    U.mapW = W; U.mapR = R;
  }
  // Duvar dibindeki eşyalar sırtını duvara verir; sandalye en yakın sofraya döner.
  function facing(m, x, y, key) {
    const D4 = [[0, -1, 0], [1, 0, -Math.PI / 2], [0, 1, Math.PI], [-1, 0, Math.PI / 2]];
    if (key === "sandalye") for (const [dx, dy] of D4) if ((m.props || {})[(x + dx) + "," + (y + dy)] === "sofra") return Math.atan2(dx, dy);
    if (WALLED.has(key) || key === "yatak" || key === "kanepe" || key === "taht") for (const [dx, dy, a] of D4) if (cellAt(m, x + dx, y + dy) === "wall") return a;
    return 0;
  }

  /* ---------- jetonlar: renkli taban üstünde jeton resmi (ya da baş harfler) ---------- */
  function tokCard(t, sil) {
    const c = document.createElement("canvas"); c.width = 256; c.height = 320; const x = c.getContext("2d"), col = t.color || "#555";
    x.fillStyle = sil ? "#111" : "#fbf8f1"; x.beginPath(); x.roundRect(0, 0, 256, 320, 26); x.fill(); if (sil) return c;
    x.fillStyle = col; x.beginPath(); x.roundRect(9, 9, 238, 302, 20); x.fill();
    const im = getImg(tokImg(t));
    if (im) { const w = im.naturalWidth, h = im.naturalHeight, s = Math.min(w / 220, h / 236); const sw = 220 * s, sh = 236 * s;
      x.save(); x.beginPath(); x.roundRect(18, 18, 220, 236, 14); x.clip(); x.drawImage(im, (w - sw) / 2, (h - sh) / 2, sw, sh, 18, 18, 220, 236); x.restore(); }
    else { const lab = t.label || "?", ini = /\d$/.test(lab) ? lab[0] + lab.match(/\d+$/)[0] : lab.split(/\s+/).map(w => w[0]).join("").slice(0, 2);
      x.fillStyle = "rgba(255,255,255,.15)"; x.beginPath(); x.arc(128, 132, 92, 0, 7); x.fill();
      x.fillStyle = "#fff"; x.font = `700 92px ${cssVar("--f-body") || "sans-serif"}`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(ini.toLocaleUpperCase("tr"), 128, 136); }
    x.fillStyle = "rgba(10,12,14,.78)"; x.fillRect(9, 262, 238, 49); x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle";
    let fs = 30; const lab = t.label || ""; do { x.font = `700 ${fs}px ${cssVar("--f-body") || "sans-serif"}`; fs--; } while (x.measureText(lab).width > 220 && fs > 12);
    x.fillText(lab, 128, 287); return c;
  }
  function tokVis(m) {
    const dm = isDM(), act = typeof activeTokenIds === "function" ? activeTokenIds() : new Set(), out = [];
    for (const t of toks(m)) { const hid = tokFogged(m, t) || (window.LIGHT && LIGHT.tokHidden(m, t)); if (hid && !dm) continue;
      const sil = !dm && window.LIGHT && LIGHT.tokSil(m, t); out.push({ t, sil, hid, act: act.has(t.id), sel: t.id === S.selTok }); }
    return out;
  }
  function syncTokens(m) {
    const T = U.T, seen = new Set();
    for (const v of tokVis(m)) {
      const t = v.t, sz = +t.size || 1, key = [t.color, t.label, tokImg(t), !!getImg(tokImg(t)), v.sil, sz].join("|"); seen.add(t.id);
      let e = U.toks.get(t.id);
      if (!e || e.key !== key) { if (e) dropTok(e);
        const g = new T.Group(), c = tokCard(t, v.sil), tex = texFrom(c); tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping;
        const base = cyl(.4, .42, .07, M.dark, 0, .035, 0, 32), ring = new T.Mesh(new T.TorusGeometry(.41, .025, 8, 48), new T.MeshStandardMaterial({ color: t.color || "#555", emissive: t.color || "#555", emissiveIntensity: .3 }));
        ring.rotation.x = Math.PI / 2; ring.position.y = .07;
        const geo = new T.PlaneGeometry(.62, .775); geo.translate(0, .3875, 0); const card = new T.Mesh(geo, new T.MeshStandardMaterial({ map: tex, side: T.DoubleSide, roughness: .6, transparent: true, alphaTest: .5 }));
        card.position.y = .07; card.castShadow = true; base.castShadow = base.receiveShadow = true;
        const halo = new T.Mesh(new T.TorusGeometry(.5, .03, 6, 48), new T.MeshBasicMaterial({ color: 0xf0c050 })); halo.rotation.x = Math.PI / 2; halo.position.y = .03;
        g.add(base, ring, card, halo); g.scale.setScalar(sz); g.userData.tok = t.id;
        e = { key, g, card, halo, ring, tex, x: t.x + sz / 2, z: t.y + sz / 2 }; g.position.set(e.x, 0, e.z); U.tokG.add(g); U.toks.set(t.id, e);
        if (t.light && !v.sil) { const pl = new T.PointLight(0xffc070, 2.4, 9, 1.4); pl.position.y = 1.2; g.add(pl); }
      }
      e.tx = t.x + sz / 2; e.tz = t.y + sz / 2; e.halo.visible = v.sel || v.act; e.halo.material.color.set(v.sel ? 0xf0c050 : 0xffe08a); e.act = v.act;
      e.card.material.opacity = v.hid ? .55 : 1;
    }
    for (const [id, e] of U.toks) if (!seen.has(id)) dropTok(e);
    U.need = true;
  }
  function dropTok(e) { U.tokG.remove(e.g); e.g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (o.material !== M.dark) o.material.dispose(); } }); e.tex.dispose(); U.toks.delete(e.g.userData.tok); }

  /* ---------- kamera ---------- */
  function view(kind) {
    const W = U.mapW || 20, R = U.mapR || 14, fit = Math.max(W, R * U.camera.aspect) / U.camera.aspect;
    Object.assign(U.orbit, { tx: W / 2, tz: R / 2 });
    if (kind === "ust") Object.assign(U.orbit, { az: 0, pol: .001, dist: Math.max(6, fit * 1.25) });
    else Object.assign(U.orbit, { az: -.45, pol: .85, dist: Math.max(6, Math.min(fit * 1.25, 60)) });
    U.need = true;
  }
  function place() {
    const o = U.orbit, p = Math.max(.001, o.pol);
    U.camera.position.set(o.tx + o.dist * Math.sin(p) * Math.sin(o.az), o.dist * Math.cos(p), o.tz + o.dist * Math.sin(p) * Math.cos(o.az));
    U.camera.lookAt(o.tx, 0, o.tz);
  }

  /* ---------- fare ve dokunma ---------- */
  function bindInput() {
    const cv = U.cv, ptr = new Map(); let pinch = 0, moved = 0, pan = false, last = null;
    cv.addEventListener("contextmenu", e => e.preventDefault());
    cv.addEventListener("pointerdown", e => { cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; pan = e.button === 2 || e.shiftKey; last = e;
      if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
    cv.addEventListener("pointermove", e => {
      if (!ptr.has(e.pointerId)) return; const [ox, oy] = ptr.get(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]); const dx = e.clientX - ox, dy = e.clientY - oy; moved += Math.abs(dx) + Math.abs(dy);
      const o = U.orbit;
      if (ptr.size === 2) { const [a, b] = [...ptr.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) o.dist = clampD(o.dist * pinch / Math.max(1, d)); pinch = d; panBy(dx / 2, dy / 2); U.need = true; return; }
      if (pan) panBy(dx, dy); else { o.az -= dx * .006; o.pol = Math.max(.001, Math.min(1.4, o.pol - dy * .005)); }
      U.need = true;
    });
    const up = e => { if (!ptr.has(e.pointerId)) return; ptr.delete(e.pointerId); if (ptr.size < 2) pinch = 0; if (e.type === "pointerup" && moved < 6 && !pan && e.button === 0) click(e); };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    cv.addEventListener("wheel", e => { e.preventDefault(); U.orbit.dist = clampD(U.orbit.dist * (1 + Math.sign(e.deltaY) * .1)); U.need = true; }, { passive: false });
  }
  const clampD = d => Math.max(2.5, Math.min(Math.max(30, Math.max(U.mapW || 0, U.mapR || 0) * 2.2), d));
  function panBy(dx, dy) {
    const o = U.orbit, k = o.dist / Math.max(200, U.cv.clientHeight) * 1.2, ca = Math.cos(o.az), sa = Math.sin(o.az);
    o.tx = Math.max(0, Math.min(U.mapW || 0, o.tx - (dx * ca + dy * sa) * k)); o.tz = Math.max(0, Math.min(U.mapR || 0, o.tz - (-dx * sa + dy * ca) * k));
  }
  function click(e) {
    const m = curMap(); if (!m) return; const T = U.T, r = U.cv.getBoundingClientRect();
    const ray = new T.Raycaster(); ray.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), U.camera);
    const hit = ray.intersectObjects(U.tokG.children, true)[0];
    let id = null; for (let o = hit?.object; o; o = o.parent) if (o.userData.tok) { id = o.userData.tok; break; }
    const tool = S.tool || "move";
    if (id && (tool === "move" || tool === "pan" || tool === "measure")) { S.selTok = id; S.selLab = null; render(); return; }
    const p = new T.Vector3(); if (!ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), 0), p)) return;
    const cx = Math.floor(p.x), cy = Math.floor(p.z); if (cx < 0 || cy < 0 || cx >= m.cols || cy >= m.rows) return;
    if (tool === "ping") { pings.push({ x: cx, y: cy, t: performance.now(), color: ME.color || cssVar("--gold") }); animPings(); pingMark(cx, cy, ME.color); if (ROOM) ROOM.emit("ping", { m: m.id, x: cx, y: cy }).catch(() => toast("İşaret gönderilemedi")); return; }
    if (["paint", "props", "roof", "erase", "fogshow", "foghide"].includes(tool) && isDM() && !S.ro) {
      if ((tool === "fogshow" || tool === "foghide") && !m.fogOn) { m.fogOn = true; save("maps", m, ["fogOn"]); }
      MV.op = {}; applyCell(m, cx, cy); commitOp(m); render(); return;
    }
    const t = S.selTok && m.tokens?.[S.selTok];
    if (t && !t.removed && ownsTok(t) && !S.ro) { const sz = +t.size || 1, nx = Math.max(0, Math.min(m.cols - sz, cx)), ny = Math.max(0, Math.min(m.rows - sz, cy));
      if (cellAt(m, nx, ny) === "wall" && !isDM()) { toast("Oraya duvar var"); return; }
      if (nx !== t.x || ny !== t.y) { t.x = nx; t.y = ny; save("maps", m, ["tokens." + t.id + ".x", "tokens." + t.id + ".y"]); render(); } return; }
    if (S.selTok || S.selLab) { S.selTok = null; S.selLab = null; render(); }
  }
  function pingMark(x, y, color) {
    const T = U.T, r = new T.Mesh(new T.TorusGeometry(.4, .04, 6, 40), new T.MeshBasicMaterial({ color: color || "#f0c050", transparent: true }));
    r.rotation.x = Math.PI / 2; r.position.set(x + .5, .05, y + .5); r.userData.t0 = performance.now(); U.scene.add(r); (U.pings = U.pings || []).push(r); U.need = true;
  }

  /* ---------- çizim döngüsü ---------- */
  function frame(now) {
    U.raf = 0; if (!U.on || !U.ready || !U.box.isConnected) return;
    const m = curMap(); if (!m) return;
    if (U.dirty) { U.dirty = false; const sg = staticSig(m); if (sg !== U.sig) { const first = U.mapId !== m.id; U.sig = sg; build(m); U.mapId = m.id; if (first) { U.toks.forEach(dropTok); view("egik"); } } syncTokens(m); }
    let anim = U.flick.length > 0;
    for (const f of U.flick) { const n = Math.sin(now * .011 + f.ph) * .5 + Math.sin(now * .027 + f.ph * 2) * .3 + Math.sin(now * .053 + f.ph) * .2;
      if (f.l) f.l.intensity = f.base * (1 + n * .12); if (f.o) f.o.scale.set(1 + n * .08, 1 + n * .2, 1 + n * .08); }
    for (const e of U.toks.values()) { const dx = e.tx - e.x, dz = e.tz - e.z; if (Math.abs(dx) + Math.abs(dz) > .002) { e.x += dx * .25; e.z += dz * .25; anim = true; } else { e.x = e.tx; e.z = e.tz; }
      e.g.position.set(e.x, 0, e.z); if (e.act) { e.halo.scale.setScalar(1 + Math.sin(now * .006) * .06); anim = true; } }
    if (U.pings) for (const r of [...U.pings]) { const k = (now - r.userData.t0) / 1600; if (k > 1) { U.scene.remove(r); r.geometry.dispose(); r.material.dispose(); U.pings.splice(U.pings.indexOf(r), 1); continue; }
      r.scale.setScalar(1 + k * 2.5); r.material.opacity = 1 - k; anim = true; }
    if (anim || U.need) {
      place(); const q = U.camera.quaternion;
      for (const e of U.toks.values()) { e.card.quaternion.copy(e.g.quaternion).invert().multiply(q); const eu = new U.T.Euler().setFromQuaternion(e.card.quaternion, "YXZ"); e.card.rotation.set(Math.max(-1.45, Math.min(0, eu.x)), eu.y, 0, "YXZ"); }
      U.renderer.render(U.scene, U.camera); U.need = false;
    }
    U.raf = requestAnimationFrame(frame);
  }
  function kick() { U.need = true; if (!U.raf && U.on && U.ready) U.raf = requestAnimationFrame(frame); }

  /* ---------- sayfaya yerleştir ---------- */
  function attach() {
    const wrap = document.getElementById("mapwrap"), cv2 = document.getElementById("mapc");
    if (!U.on || S.view !== "harita" || !wrap || !curMap()) { if (U.box?.isConnected) U.box.remove(); if (wrap) { wrap.classList.remove("u3"); wrap.querySelector(".u3-wait")?.remove(); } if (cv2) cv2.style.display = ""; return; }
    wrap.classList.add("u3"); if (cv2) cv2.style.display = "none";
    if (!U.ready) { if (!wrap.querySelector(".u3-wait")) wrap.insertAdjacentHTML("beforeend", `<p class="u3-wait">3B görünüm hazırlanıyor…</p>`); if (!U.loading) loadThree().then(() => U.ready && render()); return; }
    wrap.querySelector(".u3-wait")?.remove();
    if (U.box.parentNode !== wrap) wrap.appendChild(U.box);
    U.box.querySelector('[data-u3a="alcak"]').setAttribute("aria-pressed", String(U.low)); U.box.querySelector('[data-u3a="golge"]').setAttribute("aria-pressed", String(U.shadows));
    resize(); U.dirty = true; kick();
  }
  function setOn(on) {
    if (on && !webgl()) { toast("Bu cihaz 3B çizimi (WebGL) desteklemiyor; harita 2B kalıyor"); on = false; }
    U.on = on; ls(PREF, on ? "3b" : "2b"); if (!on) { cancelAnimationFrame(U.raf); U.raf = 0; U.box?.remove(); }
    render();
  }

  const _render = window.render;
  window.render = function () {
    const r = _render.apply(this, arguments);
    try {
      if (S.view === "harita" && G.id) {
        const bar = document.querySelector('#main .tools[role="toolbar"]');
        if (bar && !bar.querySelector("[data-u3]")) {
          const sp = [...bar.children].find(e => e.tagName === "SPAN" && e.style.flexGrow === "1"), f = document.createElement("span"); f.className = "u3-tools";
          f.innerHTML = `<span class="tsep"></span><span class="u3-seg" role="group" aria-label="Harita görünümü"><button class="tool" data-u3="2" aria-pressed="${!U.on}" title="Düz, kuşbakışı harita">2B</button><button class="tool" data-u3="3" aria-pressed="${U.on}" title="Üç boyutlu harita: duvarlar, mobilyalar ve jetonlar 3B">3B</button></span>`;
          sp ? bar.insertBefore(f, sp) : bar.appendChild(f);
        }
      }
      attach();
    } catch (e) { console.error(e); }
    return r;
  };
  const _drawMap = window.drawMap;
  window.drawMap = function () { const r = _drawMap.apply(this, arguments); if (U.on && U.ready) { U.dirty = true; kick(); } return r; };

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-u3],[data-u3a]"); if (!b) return;
    if (b.dataset.u3) return setOn(b.dataset.u3 === "3");
    const a = b.dataset.u3a;
    if (a === "egik" || a === "ust") view(a);
    if (a === "alcak") { U.low = !U.low; ls(PREF_LOW, U.low ? "1" : "0"); b.setAttribute("aria-pressed", String(U.low)); U.dirty = true; }
    if (a === "golge") { U.shadows = !U.shadows; ls(PREF_SH, U.shadows ? "1" : "0"); b.setAttribute("aria-pressed", String(U.shadows)); U.renderer.shadowMap.enabled = U.shadows;
      U.sun.castShadow = U.shadows && (U.mapW * U.mapR) <= 12000; U.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(mm => mm.needsUpdate = true); }); }
    kick();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });
  window.UC_BOYUT = { state: U, set: setOn, view, builders: B };
})();
