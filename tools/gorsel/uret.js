#!/usr/bin/env node
// Hazır masa görsellerini üretir: RPG harita arka planları, jetonlar, kart masası arka planları ve taşlar.
// Çıktı: web/gorsel/*.svg ve web/gorsel/katalog.js. Hepsi bu betikle üretilir, telifsizdir (MIT, projeyle birlikte).
// Çalıştır: node tools/gorsel/uret.js
"use strict";
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "..", "..", "web", "gorsel");
fs.mkdirSync(OUT, { recursive: true });

// Tekrarlanabilir rastgele sayılar (her çalıştırmada aynı görseller).
function tohum(s) { return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const r1 = (rng, a, b) => a + rng() * (b - a);
const f = n => Math.round(n * 10) / 10;
const svg = (w, h, ic, defs = "") => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs ? `<defs>${defs}</defs>` : ""}${ic}</svg>\n`;
// Doku: ince gürültü katmanı (feTurbulence). Tarayıcıda ve tuvalde (canvas) çizilir.
const doku = (id, sik, oktav, opak, renk = "#000") => `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${sik}" numOctaves="${oktav}" seed="7"/><feColorMatrix values="0 0 0 0 ${hexRgb(renk)[0]} 0 0 0 0 ${hexRgb(renk)[1]} 0 0 0 0 ${hexRgb(renk)[2]} 0 0 0 ${opak} 0"/></filter>`;
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map(x => Math.round(x * 100) / 100); }
// Düzensiz kapalı şekil (kaya, göl, çalı)
function leke(rng, cx, cy, r, n = 9, sapma = 0.35) {
  const p = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, rr = r * (1 - sapma / 2 + rng() * sapma); p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  let d = `M${f((p[0][0] + p[n - 1][0]) / 2)} ${f((p[0][1] + p[n - 1][1]) / 2)}`;
  for (let i = 0; i < n; i++) { const a = p[i], b = p[(i + 1) % n]; d += `Q${f(a[0])} ${f(a[1])} ${f((a[0] + b[0]) / 2)} ${f((a[1] + b[1]) / 2)}`; }
  return d + "Z";
}
function agac(rng, x, y, r, renk = ["#2f5d2a", "#3d7334", "#4f8a40"]) {
  let s = `<ellipse cx="${f(x + r * 0.25)}" cy="${f(y + r * 0.3)}" rx="${f(r)}" ry="${f(r * 0.9)}" fill="#000" opacity=".28"/>`;
  s += `<path d="${leke(rng, x, y, r, 11, 0.3)}" fill="${renk[0]}"/>`;
  s += `<path d="${leke(rng, x - r * 0.12, y - r * 0.12, r * 0.72, 9, 0.35)}" fill="${renk[1]}"/>`;
  s += `<path d="${leke(rng, x - r * 0.25, y - r * 0.25, r * 0.38, 7, 0.4)}" fill="${renk[2]}"/>`;
  return s;
}
function cam(rng, x, y, r, kar) {
  let s = `<ellipse cx="${f(x + r * 0.3)}" cy="${f(y + r * 0.3)}" rx="${f(r)}" ry="${f(r * 0.85)}" fill="#000" opacity=".25"/>`;
  for (let k = 0; k < 3; k++) {
    const rr = r * (1 - k * 0.28), n = 8, pts = [];
    for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2 + k * 0.3, q = i % 2 ? rr * 0.55 : rr; pts.push(`${f(x + Math.cos(a) * q)},${f(y + Math.sin(a) * q)}`); }
    s += `<polygon points="${pts.join(" ")}" fill="${kar ? ["#e9f0f2", "#cfdde2", "#ffffff"][k] : ["#1f4a33", "#2a5e40", "#367250"][k]}" ${kar ? 'stroke="#5f7d72" stroke-width="2"' : ""}/>`;
  }
  return s;
}

/* ================= RPG harita arka planları (1400×1000; 28×20 kare, kare 50 px) ================= */
const W = 1400, H = 1000;
const HARITALAR = [];
function harita(id, ad, temalar, uret) { HARITALAR.push({ id, ad, temalar, uret }); }

harita("orman-acikligi", "Orman açıklığı", ["dnd5e", "pf2e", "forbidden", "genel"], rng => {
  let s = `<rect width="${W}" height="${H}" fill="#5d8a3c"/><rect width="${W}" height="${H}" filter="url(#d)"/>`;
  for (let i = 0; i < 60; i++) s += `<path d="${leke(rng, r1(rng, 0, W), r1(rng, 0, H), r1(rng, 30, 90))}" fill="${rng() < .5 ? "#6a9a45" : "#527d35"}" opacity=".5"/>`;
  s += `<path d="M-20 640 C 250 560 420 700 700 560 S 1150 420 1420 470" fill="none" stroke="#a88a5a" stroke-width="70" stroke-linecap="round"/><path d="M-20 640 C 250 560 420 700 700 560 S 1150 420 1420 470" fill="none" stroke="#b99b69" stroke-width="44" stroke-linecap="round" stroke-dasharray="2 18" opacity=".6"/>`;
  s += `<path d="${leke(rng, 980, 760, 110, 12, .25)}" fill="#3d6f8f"/><path d="${leke(rng, 970, 750, 80, 10, .2)}" fill="#4f88aa"/>`;
  for (let i = 0; i < 30; i++) s += `<circle cx="${f(r1(rng, 400, 1000))}" cy="${f(r1(rng, 250, 450))}" r="${f(r1(rng, 3, 7))}" fill="${["#e6d36a", "#e88fb0", "#ffffff"][i % 3]}" opacity=".8"/>`;
  for (let i = 0; i < 46; i++) { const kenar = rng() < 0.5, x = kenar ? (rng() < .5 ? r1(rng, -40, 260) : r1(rng, 1140, 1440)) : r1(rng, 0, W), y = kenar ? r1(rng, 0, H) : (rng() < .5 ? r1(rng, -40, 170) : r1(rng, 860, 1040)); s += agac(rng, x, y, r1(rng, 55, 95)); }
  for (let i = 0; i < 6; i++) s += `<path d="${leke(rng, r1(rng, 350, 1050), r1(rng, 180, 820), r1(rng, 18, 34), 8, .4)}" fill="#8a8a80" stroke="#5b5b55" stroke-width="3"/>`;
  return [s, doku("d", 0.9, 2, 0.18)];
});

harita("zindan", "Zindan koridorları", ["dnd5e", "pf2e", "forbidden", "genel"], rng => {
  let s = `<rect width="${W}" height="${H}" fill="#1b1a1f"/>`;
  const odalar = [[100, 100, 400, 300], [650, 100, 650, 250], [100, 550, 350, 350], [600, 450, 300, 450], [1000, 500, 300, 400]];
  const koridor = [[500, 200, 150, 50], [250, 400, 50, 150], [450, 650, 150, 50], [900, 650, 100, 50], [1100, 350, 50, 150], [700, 350, 50, 100]];
  for (const [x, y, w, h] of [...odalar, ...koridor]) s += `<rect x="${x - 14}" y="${y - 14}" width="${w + 28}" height="${h + 28}" fill="#3b3842"/>`;
  for (const [x, y, w, h] of [...odalar, ...koridor]) s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#tas)"/>`;
  s += `<rect width="${W}" height="${H}" filter="url(#d)" opacity=".9"/>`;
  for (let i = 0; i < 40; i++) { const [x, y, w, h] = odalar[i % odalar.length]; s += `<path d="${leke(rng, x + r1(rng, 10, w - 10), y + r1(rng, 10, h - 10), r1(rng, 4, 10), 6, .5)}" fill="#5e5960"/>`; }
  s += `<circle cx="300" cy="250" r="34" fill="#2a2730" stroke="#77707c" stroke-width="6"/><circle cx="300" cy="250" r="18" fill="#0d0c10"/>`;
  s += `<rect x="1170" y="140" width="90" height="60" fill="#6b4a2b" stroke="#3d2914" stroke-width="5"/><rect x="1170" y="160" width="90" height="8" fill="#b08d3c"/>`;
  for (const [x, y] of [[740, 640], [820, 720], [700, 800]]) s += `<circle cx="${x}" cy="${y}" r="16" fill="#7a2b1d" opacity=".55"/>`;
  s += `<path d="M640 470h270M640 470v40" stroke="#9b8a62" stroke-width="5" stroke-dasharray="10 8" opacity=".6"/>`;
  return [s, `<pattern id="tas" width="50" height="50" patternUnits="userSpaceOnUse"><rect width="50" height="50" fill="#56525c"/><path d="M0 0H50V50" fill="none" stroke="#3a3740" stroke-width="3"/><path d="M8 12h14M30 34h10" stroke="#625e68" stroke-width="2"/></pattern>` + doku("d", 0.6, 3, 0.35)];
});

harita("meyhane", "Meyhane", ["dnd5e", "pf2e", "forbidden", "genel"], rng => {
  let s = `<rect width="${W}" height="${H}" fill="url(#tahta)"/><rect width="${W}" height="${H}" filter="url(#d)"/>`;
  s += `<rect x="0" y="0" width="${W}" height="40" fill="#3d2a1a"/><rect x="0" y="${H - 40}" width="${W}" height="40" fill="#3d2a1a"/><rect x="0" y="0" width="40" height="${H}" fill="#3d2a1a"/><rect x="${W - 40}" y="0" width="40" height="${H}" fill="#3d2a1a"/>`;
  s += `<rect x="900" y="80" width="420" height="90" rx="8" fill="#5b3a1e" stroke="#2f1d0e" stroke-width="6"/>`;
  for (let i = 0; i < 6; i++) s += `<circle cx="${960 + i * 62}" cy="125" r="16" fill="#8a5a2b" stroke="#2f1d0e" stroke-width="4"/><circle cx="${960 + i * 62}" cy="125" r="6" fill="#d9a441"/>`;
  s += `<rect x="560" y="40" width="200" height="60" fill="#6e6a64"/><rect x="600" y="40" width="120" height="44" fill="#2a1a10"/><path d="M620 84 q20 -40 40 -10 q15 -30 40 10z" fill="#f08a24"/><path d="M640 84 q15 -24 25 -4 q10 -18 20 4z" fill="#ffd36e"/>`;
  const masa = (x, y, yuvarlak) => {
    let t = yuvarlak ? `<circle cx="${x}" cy="${y}" r="70" fill="#000" opacity=".25"/><circle cx="${x - 6}" cy="${y - 6}" r="66" fill="#8a5a2b" stroke="#4a2e14" stroke-width="6"/>` : `<rect x="${x - 110}" y="${y - 45}" width="220" height="90" rx="6" fill="#8a5a2b" stroke="#4a2e14" stroke-width="6"/>`;
    const n = yuvarlak ? 5 : 6;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, X = yuvarlak ? x + Math.cos(a) * 100 : x - 85 + (i % 3) * 85, Y = yuvarlak ? y + Math.sin(a) * 100 : y + (i < 3 ? -78 : 78); t += `<rect x="${f(X - 20)}" y="${f(Y - 20)}" width="40" height="40" rx="8" fill="#6b4423" stroke="#3a2412" stroke-width="4"/>`; }
    t += `<circle cx="${x + 20}" cy="${y - 10}" r="10" fill="#c9c2a8" stroke="#6e6a5e" stroke-width="3"/><circle cx="${x - 25}" cy="${y + 12}" r="9" fill="#d9a441" stroke="#7a5a1a" stroke-width="3"/>`;
    return t;
  };
  s += masa(300, 300, true) + masa(320, 720, false) + masa(720, 520, true) + masa(1080, 420, false) + masa(1100, 780, true);
  s += `<rect x="40" y="870" width="160" height="90" fill="#2c1e12"/><path d="M60 880h120M60 900h120M60 920h120M60 940h120" stroke="#4b3420" stroke-width="6"/>`;
  s += `<rect x="640" y="${H - 40}" width="120" height="40" fill="#a37b45"/>`;
  return [s, `<pattern id="tahta" width="200" height="40" patternUnits="userSpaceOnUse"><rect width="200" height="40" fill="#9c6b3c"/><rect y="38" width="200" height="2" fill="#5c3b1d"/><rect x="120" width="2" height="40" fill="#5c3b1d"/><path d="M10 14h60M140 26h40" stroke="#8a5d33" stroke-width="2"/></pattern>` + doku("d", 0.8, 2, 0.15)];
});

harita("magara", "Mağara", ["dnd5e", "pf2e", "forbidden", "vaesen", "genel"], rng => {
  let s = `<rect width="${W}" height="${H}" fill="#141214"/>`;
  const yol = [[120, 820], [320, 640], [520, 700], [700, 520], [900, 560], [1060, 360], [1260, 220]];
  for (const [x, y] of yol) s += `<path d="${leke(rng, x, y, r1(rng, 170, 230), 13, .35)}" fill="#4a4340"/>`;
  for (const [x, y] of yol) s += `<path d="${leke(rng, x, y, r1(rng, 120, 170), 12, .35)}" fill="#6a605a"/>`;
  s += `<rect width="${W}" height="${H}" filter="url(#d)"/>`;
  s += `<path d="${leke(rng, 640, 560, 90, 11, .3)}" fill="#203a4a"/><path d="${leke(rng, 640, 560, 64, 9, .25)}" fill="#2f5a70" opacity=".9"/>`;
  for (let i = 0; i < 36; i++) { const [x, y] = yol[i % yol.length]; s += `<path d="${leke(rng, x + r1(rng, -140, 140), y + r1(rng, -140, 140), r1(rng, 10, 28), 7, .5)}" fill="#3a3432" stroke="#2a2524" stroke-width="3"/>`; }
  for (let i = 0; i < 14; i++) { const [x, y] = yol[i % yol.length]; s += `<g fill="#7fd4c4" opacity=".75"><path d="M${f(x + r1(rng, -100, 100))} ${f(y + r1(rng, -100, 100))} l8 -26 l8 26z"/></g>`; }
  return [s, doku("d", 0.5, 3, 0.4)];
});

harita("kasaba-meydani", "Kasaba meydanı", ["dnd5e", "pf2e", "forbidden", "genel"], rng => {
  let s = `<rect width="${W}" height="${H}" fill="url(#arnavut)"/><rect width="${W}" height="${H}" filter="url(#d)"/>`;
  const ev = (x, y, w, h, renk) => `<rect x="${x + 10}" y="${y + 10}" width="${w}" height="${h}" fill="#000" opacity=".3"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${renk}"/><path d="M${x} ${y} L${x + w / 2} ${y + h / 2} L${x + w} ${y} M${x} ${y + h} L${x + w / 2} ${y + h / 2} L${x + w} ${y + h}" stroke="#000" stroke-opacity=".25" stroke-width="4" fill="none"/><path d="M${x + w / 2} ${y + h / 2 - 1}h1" stroke="#000"/>`;
  s += ev(60, 60, 260, 200, "#8a3b2b") + ev(380, 40, 220, 180, "#6b4e8a") + ev(1080, 60, 260, 220, "#8a3b2b") + ev(60, 700, 240, 240, "#4e6b3b") + ev(1100, 720, 240, 220, "#8a6b2b") + ev(760, 820, 220, 160, "#6b4e8a");
  s += `<circle cx="700" cy="500" r="120" fill="#8f8a80" stroke="#5e5a54" stroke-width="10"/><circle cx="700" cy="500" r="80" fill="#3d6f8f"/><circle cx="700" cy="500" r="22" fill="#a9a59b" stroke="#5e5a54" stroke-width="6"/>`;
  for (const [x, y, c] of [[420, 420, "#c94f3d"], [980, 560, "#3d7fc9"], [520, 680, "#d9a441"]]) s += `<rect x="${x - 50}" y="${y - 35}" width="100" height="70" fill="${c}" stroke="#2c1e12" stroke-width="4"/><path d="M${x - 50} ${y - 35}l100 70M${x + 50} ${y - 35}l-100 70" stroke="#fff" stroke-opacity=".25" stroke-width="5"/>`;
  for (let i = 0; i < 8; i++) s += agac(rng, r1(rng, 360, 1040), rng() < .5 ? r1(rng, 260, 320) : r1(rng, 700, 760), r1(rng, 28, 40));
  return [s, `<pattern id="arnavut" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#7e776c"/><rect x="2" y="2" width="16" height="16" rx="5" fill="#9a9284"/><rect x="22" y="2" width="16" height="16" rx="5" fill="#8d8577"/><rect x="12" y="22" width="16" height="16" rx="5" fill="#958d7f"/><rect x="-8" y="22" width="16" height="16" rx="5" fill="#a29a8b"/><rect x="32" y="22" width="16" height="16" rx="5" fill="#a29a8b"/></pattern>` + doku("d", 0.7, 2, 0.2)];
});

harita("mezarlik", "Sisli mezarlık", ["coc7", "vaesen", "motw", "genel"], rng => {
  let s = `<rect width="${W}" height="${H}" fill="#2c3a2e"/><rect width="${W}" height="${H}" filter="url(#d)"/>`;
  for (let i = 0; i < 40; i++) s += `<path d="${leke(rng, r1(rng, 0, W), r1(rng, 0, H), r1(rng, 40, 110))}" fill="${rng() < .5 ? "#34463a" : "#253127"}" opacity=".6"/>`;
  s += `<path d="M700 1000 L700 640 M560 640 H840" stroke="#5a5446" stroke-width="80" stroke-linecap="square"/>`;
  s += `<rect x="560" y="420" width="280" height="220" fill="#4c4a50" stroke="#2a292d" stroke-width="10"/><path d="M560 420 L700 340 L840 420z" fill="#3a383d" stroke="#2a292d" stroke-width="8"/><rect x="670" y="560" width="60" height="80" fill="#1c1b1f"/>`;
  for (let y = 120; y < 920; y += 120) for (let x = 100; x < 1320; x += 110) {
    if (x > 500 && x < 900 && y > 300) continue;
    if (rng() < 0.25) continue;
    const xx = x + r1(rng, -15, 15), yy = y + r1(rng, -10, 10), egik = r1(rng, -12, 12);
    s += `<g transform="rotate(${f(egik)} ${f(xx)} ${f(yy)})"><rect x="${f(xx - 26)}" y="${f(yy + 26)}" width="52" height="70" fill="#3b2f22" opacity=".7"/><path d="M${f(xx - 24)} ${f(yy + 24)} v-30 a24 24 0 0 1 48 0 v30z" fill="#8b8a86" stroke="#4b4a47" stroke-width="4"/>${rng() < .4 ? `<path d="M${f(xx)} ${f(yy - 22)}v26M${f(xx - 9)} ${f(yy - 12)}h18" stroke="#4b4a47" stroke-width="4"/>` : ""}</g>`;
  }
  s += `<rect x="20" y="20" width="${W - 40}" height="${H - 40}" fill="none" stroke="#1a1a1a" stroke-width="10" stroke-dasharray="4 26"/>`;
  for (let i = 0; i < 6; i++) s += agac(rng, rng() < .5 ? r1(rng, 0, 120) : r1(rng, 1280, 1400), r1(rng, 0, H), r1(rng, 60, 90), ["#1d2620", "#26322a", "#2f3d33"]);
  s += `<rect width="${W}" height="${H}" fill="url(#sis)"/>`;
  return [s, doku("d", 0.8, 2, 0.25) + `<radialGradient id="sis" cx="50%" cy="55%" r="75%"><stop offset="0" stop-color="#c8d2d0" stop-opacity="0"/><stop offset=".6" stop-color="#c8d2d0" stop-opacity=".12"/><stop offset="1" stop-color="#dfe6e4" stop-opacity=".4"/></radialGradient>`];
});

harita("konak", "Eski konak", ["coc7", "vaesen", "motw", "genel"], rng => {
  let s = `<rect width="${W}" height="${H}" fill="#1c1716"/>`;
  const oda = (x, y, w, h, zemin) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${zemin}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#e8dcc4" stroke-width="12"/>`;
  s += oda(60, 60, 560, 420, "url(#parke)") + oda(620, 60, 720, 420, "url(#parke)") + oda(60, 480, 420, 460, "url(#karo)") + oda(480, 480, 460, 460, "url(#parke)") + oda(940, 480, 400, 460, "url(#parke)");
  s += `<rect width="${W}" height="${H}" filter="url(#d)"/>`;
  for (const [x, y] of [[340, 480], [620, 270], [940, 700], [480, 700]]) s += `<rect x="${x - 30}" y="${y - 30}" width="60" height="60" fill="#8a6a44"/>`;
  s += `<rect x="760" y="140" width="440" height="260" rx="10" fill="#7a2230" stroke="#c9a65a" stroke-width="8"/><rect x="800" y="180" width="360" height="180" fill="none" stroke="#c9a65a" stroke-width="3"/>`;
  s += `<rect x="870" y="230" width="220" height="80" fill="#5b3a1e" stroke="#2f1d0e" stroke-width="5"/>`;
  s += `<rect x="100" y="100" width="200" height="60" fill="#4a2f1c" stroke="#2a1a0e" stroke-width="5"/><rect x="100" y="100" width="40" height="300" fill="#4a2f1c" stroke="#2a1a0e" stroke-width="5"/>`;
  for (let i = 0; i < 7; i++) s += `<rect x="${110 + i * 26}" y="108" width="18" height="44" fill="${["#7a2230", "#2b4a7a", "#3b6b3b", "#8a6b2b"][i % 4]}"/>`;
  s += `<rect x="1010" y="560" width="260" height="160" fill="#d8d0c0" stroke="#7a7060" stroke-width="5"/><rect x="1010" y="560" width="260" height="40" fill="#b8b0a0"/>`;
  s += `<path d="${leke(rng, 700, 760, 70, 9, .5)}" fill="#5a0f12" opacity=".7"/>`;
  s += `<rect x="560" y="560" width="300" height="50" fill="#3a2a1e"/>${Array.from({ length: 8 }, (_, i) => `<rect x="${570 + i * 36}" y="620" width="28" height="200" fill="#3d2a1a" stroke="#1a120a" stroke-width="3"/>`).join("")}`;
  return [s, `<pattern id="parke" width="60" height="30" patternUnits="userSpaceOnUse"><rect width="60" height="30" fill="#6b4a2e"/><path d="M0 15h60M30 0v15M0 15v15M60 15v15" stroke="#4a311c" stroke-width="2"/></pattern><pattern id="karo" width="50" height="50" patternUnits="userSpaceOnUse"><rect width="50" height="50" fill="#d8d2c4"/><rect width="25" height="25" fill="#3a3632"/><rect x="25" y="25" width="25" height="25" fill="#3a3632"/></pattern>` + doku("d", 0.7, 3, 0.3)];
});

harita("uzay-gemisi", "Uzay gemisi güvertesi", ["alien", "genel"], rng => {
  let s = `<rect width="${W}" height="${H}" fill="#0b0f12"/>`;
  const bolme = [[80, 80, 500, 340], [680, 80, 640, 340], [80, 540, 380, 380], [560, 540, 760, 380]];
  for (const [x, y, w, h] of bolme) s += `<rect x="${x - 16}" y="${y - 16}" width="${w + 32}" height="${h + 32}" fill="#2b3338"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#plaka)"/>`;
  for (const [x, y, w, h] of [[580, 210, 100, 80], [250, 420, 80, 120], [900, 420, 80, 120]]) s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#plaka)"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="url(#serit)" stroke-width="10"/>`;
  s += `<rect width="${W}" height="${H}" filter="url(#d)"/>`;
  for (let i = 0; i < 5; i++) s += `<rect x="${700 + i * 110}" y="100" width="80" height="40" rx="4" fill="#1d2a30" stroke="#4a6470" stroke-width="3"/><rect x="${708 + i * 110}" y="108" width="40" height="10" fill="#4fd1c5" opacity=".8"/><circle cx="${764 + i * 110}" cy="128" r="5" fill="${i % 2 ? "#f6ad55" : "#68d391"}"/>`;
  s += `<rect x="620" y="620" width="300" height="220" rx="12" fill="#2a3a42" stroke="#59737f" stroke-width="5"/><rect x="660" y="660" width="220" height="140" rx="6" fill="#123" opacity=".8"/>`;
  for (let i = 0; i < 4; i++) s += `<rect x="${100 + i * 85}" y="580" width="65" height="140" rx="30" fill="#c7d2d6" stroke="#5e6d73" stroke-width="5"/><rect x="${110 + i * 85}" y="600" width="45" height="70" rx="20" fill="#7fb3c8" opacity=".6"/>`;
  for (let i = 0; i < 10; i++) s += `<rect x="${1080 + (i % 2) * 110}" y="${580 + Math.floor(i / 2) * 64}" width="90" height="50" fill="#5a4a2a" stroke="#2c2414" stroke-width="4"/>`;
  s += `<path d="M120 380 h400" stroke="#f6e05e" stroke-width="6" stroke-dasharray="30 20" opacity=".5"/>`;
  return [s, `<pattern id="plaka" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="#46525a"/><rect x="2" y="2" width="96" height="96" fill="none" stroke="#2c353b" stroke-width="3"/>${[[10, 10], [90, 10], [10, 90], [90, 90]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#2c353b"/>`).join("")}<path d="M20 50h60M50 20v60" stroke="#525f68" stroke-width="2"/></pattern><pattern id="serit" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="28" height="28" fill="#f6e05e"/><rect width="14" height="28" fill="#1a1a1a"/></pattern>` + doku("d", 0.5, 2, 0.25)];
});

harita("karli-orman", "Karlı orman ve donmuş göl", ["vaesen", "forbidden", "genel"], rng => {
  let s = `<rect width="${W}" height="${H}" fill="#e6edf0"/><rect width="${W}" height="${H}" filter="url(#d)"/>`;
  for (let i = 0; i < 30; i++) s += `<path d="${leke(rng, r1(rng, 0, W), r1(rng, 0, H), r1(rng, 50, 120))}" fill="${rng() < .5 ? "#f6f9fa" : "#d5e0e5"}" opacity=".7"/>`;
  s += `<path d="${leke(rng, 860, 480, 260, 14, .2)}" fill="#9fc2d4"/><path d="${leke(rng, 860, 480, 220, 12, .15)}" fill="#b9d6e3"/>`;
  for (let i = 0; i < 12; i++) { const x = r1(rng, 680, 1040), y = r1(rng, 330, 630); s += `<path d="M${f(x)} ${f(y)} l${f(r1(rng, -60, 60))} ${f(r1(rng, -40, 40))}" stroke="#e8f3f8" stroke-width="2"/>`; }
  s += `<path d="M-20 300 C 200 360 300 260 520 340 S 640 700 600 1020" fill="none" stroke="#c9b9a0" stroke-width="40" opacity=".5"/>`;
  for (let i = 0; i < 55; i++) { const x = r1(rng, -40, W + 40), y = r1(rng, -40, H + 40); if (Math.hypot(x - 860, y - 480) < 300 || (x > 350 && x < 600 && y > 250 && y < 900)) continue; s += cam(rng, x, y, r1(rng, 40, 70), true); }
  s += `<rect x="180" y="560" width="160" height="120" fill="#5b3a1e"/><path d="M170 560 L260 490 L350 560z" fill="#f2f6f8" stroke="#8a9aa2" stroke-width="4"/><circle cx="420" cy="640" r="26" fill="#3a2a1a"/><path d="M410 650 q10 -30 20 0" fill="#f08a24"/>`;
  return [s, doku("d", 0.9, 2, 0.08, "#4a6070")];
});

harita("sehir-sokagi", "Şehir sokağı (gece)", ["motw", "coc7", "genel"], rng => {
  let s = `<rect width="${W}" height="${H}" fill="#2a2d33"/><rect width="${W}" height="${H}" filter="url(#d)"/>`;
  s += `<rect x="0" y="340" width="${W}" height="320" fill="#33363d"/><rect x="0" y="260" width="${W}" height="80" fill="#6d6a66"/><rect x="0" y="660" width="${W}" height="80" fill="#6d6a66"/>`;
  s += `<path d="M0 500 H${W}" stroke="#e8c547" stroke-width="8" stroke-dasharray="60 40"/>`;
  for (let x = 0; x < W; x += 50) s += `<path d="M${x} 260v80M${x} 660v80" stroke="#55524e" stroke-width="2"/>`;
  s += `<rect x="560" y="340" width="100" height="320" fill="url(#zebra)"/>`;
  const bina = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" stroke="#15161a" stroke-width="6"/><rect x="${x + 16}" y="${y + 16}" width="${w - 32}" height="${h - 32}" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="3"/>`;
  s += bina(20, 20, 300, 220, "#4a3f3a") + bina(340, 20, 360, 220, "#3d4a55") + bina(720, 20, 300, 220, "#55443a") + bina(1040, 20, 340, 220, "#3a3d48") + bina(20, 760, 420, 220, "#3d4a55") + bina(460, 760, 300, 220, "#4a3f3a") + bina(780, 760, 600, 220, "#3a3d48");
  const araba = (x, y, c, yon) => `<g transform="translate(${x} ${y}) rotate(${yon})"><rect x="-55" y="-26" width="110" height="52" rx="12" fill="${c}" stroke="#111" stroke-width="4"/><rect x="-20" y="-20" width="45" height="40" rx="6" fill="#1d2a33"/><rect x="48" y="-20" width="6" height="12" fill="#ffe9a8"/><rect x="48" y="8" width="6" height="12" fill="#ffe9a8"/></g>`;
  s += araba(220, 400, "#8a2b2b", 0) + araba(980, 600, "#2b4a8a", 180) + araba(1240, 410, "#c9c2a8", 0);
  for (const x of [120, 520, 920, 1320]) s += `<circle cx="${x}" cy="290" r="12" fill="#c9c2a8"/><circle cx="${x}" cy="300" r="120" fill="url(#isik)"/>`;
  for (const x of [320, 720, 1120]) s += `<circle cx="${x}" cy="710" r="12" fill="#c9c2a8"/><circle cx="${x}" cy="700" r="120" fill="url(#isik)"/>`;
  s += `<rect x="1180" y="680" width="70" height="50" fill="#2f6b3a" stroke="#123" stroke-width="3"/>`;
  return [s, `<pattern id="zebra" width="100" height="40" patternUnits="userSpaceOnUse"><rect width="100" height="20" fill="#e8e6e0"/></pattern><radialGradient id="isik"><stop offset="0" stop-color="#ffe9a8" stop-opacity=".35"/><stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/></radialGradient>` + doku("d", 0.9, 2, 0.25)];
});

harita("col-harabeleri", "Çöl harabeleri", ["dnd5e", "pf2e", "genel"], rng => {
  let s = `<rect width="${W}" height="${H}" fill="#d9b77a"/><rect width="${W}" height="${H}" filter="url(#d)"/>`;
  for (let i = 0; i < 9; i++) { const y = r1(rng, 0, H); s += `<path d="M-20 ${f(y)} C 300 ${f(y - 60)} 600 ${f(y + 60)} 1420 ${f(y - 20)}" fill="none" stroke="#c9a463" stroke-width="${f(r1(rng, 10, 26))}" opacity=".6"/>`; }
  s += `<rect x="420" y="260" width="560" height="480" fill="#b9a07a"/><rect x="420" y="260" width="560" height="480" fill="url(#karo2)" opacity=".8"/>`;
  const duvar = (d) => `<path d="${d}" fill="none" stroke="#8a7350" stroke-width="30" stroke-linecap="square"/><path d="${d}" fill="none" stroke="#a88c62" stroke-width="18" stroke-linecap="square"/>`;
  s += duvar("M420 420 V260 H640") + duvar("M760 260 H980 V480") + duvar("M980 600 V740 H780") + duvar("M600 740 H420 V560");
  for (const [x, y] of [[520, 360], [880, 360], [520, 640], [880, 640]]) s += `<circle cx="${x + 8}" cy="${y + 8}" r="34" fill="#000" opacity=".25"/><circle cx="${x}" cy="${y}" r="34" fill="#c2a87e" stroke="#7a6444" stroke-width="6"/>`;
  s += `<rect x="640" y="440" width="120" height="120" fill="#8a7350" stroke="#5e4c32" stroke-width="6"/><circle cx="700" cy="500" r="30" fill="#5e4c32"/>`;
  for (let i = 0; i < 26; i++) s += `<path d="${leke(rng, r1(rng, 0, W), r1(rng, 0, H), r1(rng, 8, 26), 6, .5)}" fill="#a88c62" stroke="#7a6444" stroke-width="3"/>`;
  for (const [x, y] of [[180, 180], [1220, 820], [1240, 160]]) s += `<g fill="#3f7a3a"><path d="${leke(rng, x, y, 40, 8, .4)}"/></g><path d="M${x} ${y}l40 -60M${x} ${y}l-50 -40M${x} ${y}l10 -70" stroke="#2f5d2a" stroke-width="8"/>`;
  return [s, `<pattern id="karo2" width="60" height="60" patternUnits="userSpaceOnUse"><rect width="60" height="60" fill="none" stroke="#8a7350" stroke-width="2"/></pattern>` + doku("d", 0.6, 3, 0.18, "#5a3a10")];
});

/* ================= Jetonlar (256×256) ================= */
// Her simge 100×100 kutuda çizilir; jeton çerçevesi tarafa göre renk alır.
const JETONLAR = [];
const TARAF = { kahraman: ["#1f5f8b", "#7fc3ec"], dusman: ["#8b1f1f", "#ec7f7f"], notr: ["#5b5b5b", "#cfcfcf"], canavar: ["#5b2a7a", "#c99aec"] };
function jeton(id, ad, taraf, temalar, simge, zemin) { JETONLAR.push({ id, ad, taraf, temalar, simge, zemin }); }
const S = { // simge yolları (beyazımsı dolgu, koyu kontur)
  savasci: `<path d="M50 10 l6 6 v40 h-12 v-40z" /><path d="M36 56 h28 v6 h-28z"/><path d="M47 62 h6 v14 h-6z"/><circle cx="50" cy="80" r="5"/><path d="M18 40 q0 -10 14 -12 v34 q-14 -4 -14 -22z" opacity=".85"/>`,
  buyucu: `<path d="M50 6 L70 52 H30z"/><path d="M22 56 h56 q-4 8 -28 8 q-24 0 -28 -8z"/><path d="M38 64 q12 30 24 0" /><path d="M74 66 l4 -10 l4 10 l10 2 l-8 6 l2 10 l-8 -6 l-8 6 l2 -10 l-8 -6z" opacity=".9"/>`,
  okcu: `<path d="M24 12 q46 38 0 76" fill="none" stroke-width="6"/><path d="M24 12 L24 88" stroke-width="2" fill="none"/><path d="M20 50 H86" stroke-width="4" fill="none"/><path d="M86 50 l-12 -7 v14z"/><path d="M28 50 l-8 -6 M28 50 l-8 6" stroke-width="3" fill="none"/>`,
  sifaci: `<path d="M42 16 h16 v26 h26 v16 h-26 v26 h-16 v-26 h-26 v-16 h26z"/>`,
  hirsiz: `<path d="M50 8 q30 4 30 40 q-6 34 -30 44 q-24 -10 -30 -44 q0 -36 30 -40z" opacity=".35"/><path d="M34 46 q16 10 32 0 q-4 12 -16 12 q-12 0 -16 -12z"/><path d="M62 60 l22 26 l-4 4 l-24 -24z"/><path d="M58 62 l8 -6" stroke-width="5" fill="none"/>`,
  ozan: `<ellipse cx="42" cy="64" rx="22" ry="20"/><circle cx="42" cy="64" r="6" fill="#222" stroke="none"/><path d="M56 50 L84 18 l6 6 L62 56z"/><path d="M34 54 L74 22" stroke-width="2" fill="none"/>`,
  goblin: `<path d="M26 44 L4 30 L22 58z"/><path d="M74 44 L96 30 L78 58z"/><ellipse cx="50" cy="54" rx="28" ry="30"/><circle cx="40" cy="48" r="5" fill="#222" stroke="none"/><circle cx="60" cy="48" r="5" fill="#222" stroke="none"/><path d="M38 70 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6" fill="none" stroke="#222" stroke-width="3"/>`,
  iskelet: `<path d="M50 10 q30 0 30 30 q0 16 -12 22 v12 h-36 v-12 q-12 -6 -12 -22 q0 -30 30 -30z"/><circle cx="38" cy="40" r="8" fill="#222" stroke="none"/><circle cx="62" cy="40" r="8" fill="#222" stroke="none"/><path d="M50 50 l-5 8 h10z" fill="#222" stroke="none"/><path d="M40 74 v10 M50 74 v10 M60 74 v10" stroke="#222" stroke-width="4"/>`,
  kurt: `<path d="M20 20 L36 40 L50 34 L64 40 L80 20 L78 52 Q74 72 50 90 Q26 72 22 52z"/><path d="M36 54 l8 4 M64 54 l-8 4" stroke="#222" stroke-width="5"/><path d="M44 76 h12 l-6 6z" fill="#222" stroke="none"/>`,
  ejderha: `<path d="M50 30 q-30 -24 -44 -6 q16 0 22 14 q-14 6 -14 22 q14 -8 22 0 q4 14 14 30 q10 -16 14 -30 q8 -8 22 0 q0 -16 -14 -22 q6 -14 22 -14 q-14 -18 -44 6z"/><path d="M44 30 l-6 -20 l10 14 M56 30 l6 -20 l-10 14" />`,
  orumcek: `<ellipse cx="50" cy="56" rx="16" ry="20"/><circle cx="50" cy="32" r="10"/><path d="M36 48 L10 30 M36 56 L6 56 M36 64 L10 84 M38 70 L22 94 M64 48 L90 30 M64 56 L94 56 M64 64 L90 84 M62 70 L78 94" fill="none" stroke-width="5"/>`,
  zombi: `<path d="M30 20 h40 q8 0 8 10 v34 q0 20 -28 26 q-28 -6 -28 -26 v-34 q0 -10 8 -10z"/><path d="M34 40 h10 M56 38 l10 6" stroke="#222" stroke-width="5"/><path d="M38 68 q12 -8 24 2" fill="none" stroke="#222" stroke-width="4"/><path d="M60 20 l4 -10 l4 10" />`,
  hayalet: `<path d="M50 10 q30 0 30 34 v46 l-10 -8 l-10 8 l-10 -8 l-10 8 l-10 -8 l-10 8 v-46 q0 -34 30 -34z"/><ellipse cx="40" cy="42" rx="6" ry="9" fill="#222" stroke="none"/><ellipse cx="60" cy="42" rx="6" ry="9" fill="#222" stroke="none"/><ellipse cx="50" cy="62" rx="6" ry="8" fill="#222" stroke="none"/>`,
  tarikatci: `<path d="M50 6 q26 18 26 50 l8 36 H16 l8 -36 q0 -32 26 -50z"/><path d="M38 44 q12 -14 24 0 v18 q-12 6 -24 0z" fill="#222" stroke="none"/><circle cx="44" cy="52" r="2.5" fill="#e33" stroke="none"/><circle cx="56" cy="52" r="2.5" fill="#e33" stroke="none"/><path d="M50 70 v14 M43 76 h14" stroke="#222" stroke-width="3"/>`,
  dokunacli: `<circle cx="50" cy="34" r="22"/><circle cx="42" cy="30" r="5" fill="#222" stroke="none"/><circle cx="58" cy="30" r="5" fill="#222" stroke="none"/><path d="M34 50 q-20 20 -6 40 M44 54 q-8 20 2 36 M56 54 q8 20 -2 36 M66 50 q20 20 6 40" fill="none" stroke-width="7" stroke-linecap="round"/>`,
  yaratik: `<path d="M18 52 q0 -36 46 -40 q26 0 26 16 q0 14 -20 18 q-6 26 -26 34 q-26 -6 -26 -28z"/><path d="M30 64 l6 10 l6 -10 l6 10 l6 -10" fill="none" stroke="#222" stroke-width="3"/><path d="M60 30 q14 -4 22 2" stroke="#222" stroke-width="3" fill="none"/>`,
  android: `<rect x="24" y="16" width="52" height="54" rx="12"/><rect x="32" y="34" width="36" height="12" rx="6" fill="#222" stroke="none"/><circle cx="42" cy="40" r="3" fill="#4fd1c5" stroke="none"/><circle cx="58" cy="40" r="3" fill="#4fd1c5" stroke="none"/><path d="M50 16 v-10 M44 6 h12" stroke-width="4"/><rect x="30" y="72" width="40" height="18" rx="4"/>`,
  asker: `<path d="M16 50 q0 -36 34 -36 q34 0 34 36 h-6 v8 h-56 v-8z"/><rect x="26" y="52" width="48" height="10" rx="3" fill="#4fd1c5" stroke="none" opacity=".8"/><path d="M28 66 q22 28 44 0" /><path d="M60 22 h14 v10" fill="none" stroke-width="3"/>`,
  avci: `<path d="M10 44 q40 -12 80 0 l-8 6 H18z"/><path d="M28 44 q0 -24 22 -26 q22 2 22 26z"/><path d="M30 52 q20 40 40 0" /><path d="M36 60 h10 M54 60 h10" stroke="#222" stroke-width="4"/>`,
  vampir: `<path d="M10 30 l20 10 q20 -24 40 0 l20 -10 l-10 40 q-20 26 -40 0z"/><path d="M38 52 l6 4 M62 52 l-6 4" stroke="#e33" stroke-width="5"/><path d="M42 66 l3 10 l3 -10 M52 66 l3 10 l3 -10" />`,
  trol: `<ellipse cx="50" cy="56" rx="34" ry="32"/><path d="M28 30 q-10 -16 -18 -14 q8 6 8 20z M72 30 q10 -16 18 -14 q-8 6 -8 20z"/><circle cx="40" cy="48" r="5" fill="#222" stroke="none"/><circle cx="60" cy="48" r="5" fill="#222" stroke="none"/><path d="M44 58 q6 12 12 0" /><path d="M34 74 l6 -8 M66 74 l-6 -8" stroke="#222" stroke-width="5"/>`,
  peri: `<ellipse cx="34" cy="40" rx="20" ry="28" transform="rotate(-25 34 40)" opacity=".6"/><ellipse cx="66" cy="40" rx="20" ry="28" transform="rotate(25 66 40)" opacity=".6"/><circle cx="50" cy="34" r="10"/><path d="M42 46 h16 l6 36 h-28z"/>`,
  koylu: `<circle cx="50" cy="32" r="16"/><path d="M22 90 q0 -38 28 -40 q28 2 28 40z"/><path d="M30 20 h40 l-4 -8 h-32z" />`,
  sovalye: `<path d="M24 20 h52 v44 q0 22 -26 30 q-26 -8 -26 -30z"/><rect x="32" y="40" width="36" height="6" fill="#222" stroke="none"/><path d="M50 50 v30" stroke="#222" stroke-width="4"/><path d="M50 20 q10 -14 22 -12 q-6 6 -6 12" />`,
};
const dJ = (sinif) => sinif;
jeton("savasci", "Savaşçı", "kahraman", ["dnd5e", "pf2e", "forbidden", "genel"], S.savasci);
jeton("buyucu", "Büyücü", "kahraman", ["dnd5e", "pf2e", "forbidden", "genel"], S.buyucu);
jeton("okcu", "Okçu", "kahraman", ["dnd5e", "pf2e", "forbidden", "genel"], S.okcu);
jeton("sifaci", "Şifacı", "kahraman", ["dnd5e", "pf2e", "forbidden", "genel"], S.sifaci);
jeton("hirsiz", "Hırsız", "kahraman", ["dnd5e", "pf2e", "forbidden", "genel"], S.hirsiz);
jeton("ozan", "Ozan", "kahraman", ["dnd5e", "pf2e", "genel"], S.ozan);
jeton("sovalye", "Şövalye", "kahraman", ["dnd5e", "pf2e", "genel"], S.sovalye);
jeton("avci", "Avcı", "kahraman", ["motw", "coc7", "vaesen", "genel"], S.avci);
jeton("asker", "Asker", "kahraman", ["alien", "genel"], S.asker);
jeton("android", "Android", "notr", ["alien", "genel"], S.android);
jeton("koylu", "Köylü", "notr", ["dnd5e", "pf2e", "forbidden", "vaesen", "coc7", "genel"], S.koylu);
jeton("goblin", "Goblin", "dusman", ["dnd5e", "pf2e", "forbidden", "genel"], S.goblin);
jeton("iskelet", "İskelet", "dusman", ["dnd5e", "pf2e", "forbidden", "genel"], S.iskelet);
jeton("kurt", "Kurt", "dusman", ["dnd5e", "pf2e", "forbidden", "vaesen", "motw", "genel"], S.kurt);
jeton("orumcek", "Dev örümcek", "dusman", ["dnd5e", "pf2e", "forbidden", "genel"], S.orumcek);
jeton("zombi", "Zombi", "dusman", ["dnd5e", "pf2e", "motw", "coc7", "genel"], S.zombi);
jeton("ejderha", "Ejderha", "canavar", ["dnd5e", "pf2e", "forbidden", "genel"], S.ejderha);
jeton("hayalet", "Hayalet", "canavar", ["coc7", "vaesen", "motw", "dnd5e", "genel"], S.hayalet);
jeton("tarikatci", "Tarikatçı", "dusman", ["coc7", "motw", "genel"], S.tarikatci);
jeton("dokunacli", "Dokunaçlı yaratık", "canavar", ["coc7", "motw", "genel"], S.dokunacli);
jeton("yaratik", "Uzaylı yaratık", "canavar", ["alien", "genel"], S.yaratik);
jeton("vampir", "Vampir", "canavar", ["motw", "coc7", "dnd5e", "genel"], S.vampir);
jeton("trol", "Trol", "canavar", ["vaesen", "forbidden", "dnd5e", "genel"], S.trol);
jeton("peri", "Orman perisi", "notr", ["vaesen", "dnd5e", "pf2e", "genel"], S.peri);
void dJ;

function jetonSvg(j) {
  const [koyu, acik] = TARAF[j.taraf];
  return svg(256, 256, `<circle cx="128" cy="128" r="124" fill="${koyu}"/><circle cx="128" cy="128" r="112" fill="url(#z)"/><circle cx="128" cy="128" r="112" fill="none" stroke="${acik}" stroke-width="6"/>
<g transform="translate(43 43) scale(1.7)" fill="#f4efe6" stroke="#1d1d1d" stroke-width="2.4" stroke-linejoin="round">${j.simge}</g>`,
  `<radialGradient id="z" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="${acik}" stop-opacity=".9"/><stop offset="1" stop-color="${koyu}"/></radialGradient>`);
}

/* ================= Kart masası arka planları (1600×1000) ve taşlar ================= */
const MASALAR = [];
function masa(id, ad, uret) { MASALAR.push({ id, ad, uret }); }
masa("masa-yesil-cuha", "Yeşil çuha", () => [`<rect width="1600" height="1000" fill="#1f5a3c"/><rect width="1600" height="1000" filter="url(#d)"/><rect width="1600" height="1000" fill="url(#v)"/><rect x="14" y="14" width="1572" height="972" rx="40" fill="none" stroke="#c9a65a" stroke-width="4" opacity=".6"/>`, doku("d", 1.4, 2, 0.18) + `<radialGradient id="v" cx="50%" cy="50%" r="70%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>`]);
masa("masa-ahsap", "Ahşap masa", () => [`<rect width="1600" height="1000" fill="url(#t)"/><rect width="1600" height="1000" filter="url(#d)"/><rect width="1600" height="1000" fill="url(#v)"/>`, `<pattern id="t" width="1600" height="125" patternUnits="userSpaceOnUse"><rect width="1600" height="125" fill="#8a5a33"/><rect y="122" width="1600" height="3" fill="#4a2e16"/><path d="M0 40 C 400 20 800 70 1600 30 M0 80 C 500 100 1100 60 1600 95" stroke="#7a4d2a" stroke-width="3" fill="none"/><rect x="520" width="3" height="125" fill="#4a2e16"/></pattern>` + doku("d", 0.02 + ' 0.6', 3, 0.22) + `<radialGradient id="v" cx="50%" cy="50%" r="72%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient>`]);
masa("masa-laboratuvar", "Gizli laboratuvar (Kazan ya da Katlet)", rng => {
  let s = `<rect width="1600" height="1000" fill="#0f1a20"/><rect width="1600" height="1000" fill="url(#izgara)"/><rect width="1600" height="1000" filter="url(#d)"/>`;
  s += `<circle cx="700" cy="470" r="380" fill="url(#halka)"/><circle cx="700" cy="470" r="330" fill="none" stroke="#2fd3b5" stroke-opacity=".35" stroke-width="3" stroke-dasharray="14 10"/><circle cx="700" cy="470" r="200" fill="none" stroke="#2fd3b5" stroke-opacity=".2" stroke-width="2"/>`;
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; s += `<path d="M${f(700 + Math.cos(a) * 340)} ${f(470 + Math.sin(a) * 340)} L${f(700 + Math.cos(a) * 375)} ${f(470 + Math.sin(a) * 375)}" stroke="#2fd3b5" stroke-opacity=".5" stroke-width="4"/>`; }
  s += `<rect x="1180" y="40" width="390" height="920" rx="18" fill="#132630" stroke="#2fd3b5" stroke-opacity=".3" stroke-width="3"/>`;
  s += `<path d="M30 40 h200 l20 20 v120" fill="none" stroke="#f6c945" stroke-opacity=".35" stroke-width="3"/><path d="M30 960 h260 l20 -20 v-90" fill="none" stroke="#f6c945" stroke-opacity=".35" stroke-width="3"/>`;
  for (let i = 0; i < 18; i++) s += `<circle cx="${f(r1(rng, 40, 1150))}" cy="${f(r1(rng, 30, 970))}" r="${f(r1(rng, 1, 3))}" fill="#7ff7e0" opacity=".5"/>`;
  return [s, `<pattern id="izgara" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="#1d3a46" stroke-width="1.5"/></pattern><radialGradient id="halka"><stop offset="0" stop-color="#1c4a52" stop-opacity=".8"/><stop offset="1" stop-color="#0f1a20" stop-opacity="0"/></radialGradient>` + doku("d", 0.8, 2, 0.2)];
});
masa("masa-tas", "Taş zemin", () => [`<rect width="1600" height="1000" fill="url(#k)"/><rect width="1600" height="1000" filter="url(#d)"/>`, `<pattern id="k" width="200" height="100" patternUnits="userSpaceOnUse"><rect width="200" height="100" fill="#6b6660"/><path d="M0 0h200M0 50h200M0 100h200M50 0v50M150 0v50M0 50v50M100 50v50M200 50v50" stroke="#45413c" stroke-width="4"/></pattern>` + doku("d", 0.5, 3, 0.3)]);
masa("masa-kilim", "Kilim", () => {
  let s = `<rect width="1600" height="1000" fill="#7a1f24"/>`;
  s += `<rect x="40" y="40" width="1520" height="920" fill="none" stroke="#e9c46a" stroke-width="14"/><rect x="80" y="80" width="1440" height="840" fill="url(#mot)"/><rect x="80" y="80" width="1440" height="840" fill="none" stroke="#1d3557" stroke-width="12"/>`;
  s += `<rect width="1600" height="1000" filter="url(#d)"/>`;
  return [s, `<pattern id="mot" width="160" height="160" patternUnits="userSpaceOnUse"><rect width="160" height="160" fill="#8c2a2f"/><path d="M80 10 L150 80 L80 150 L10 80z" fill="#1d3557"/><path d="M80 40 L120 80 L80 120 L40 80z" fill="#e9c46a"/><path d="M80 62 L98 80 L80 98 L62 80z" fill="#7a1f24"/><path d="M0 0l20 20M160 0l-20 20M0 160l20 -20M160 160l-20 -20" stroke="#f1faee" stroke-width="6"/></pattern>` + doku("d", 1.2, 2, 0.2)];
});
masa("masa-uzay", "Yıldızlı uzay", rng => {
  let s = `<rect width="1600" height="1000" fill="url(#g)"/>`;
  for (let i = 0; i < 220; i++) s += `<circle cx="${f(r1(rng, 0, 1600))}" cy="${f(r1(rng, 0, 1000))}" r="${f(r1(rng, .5, 2.2))}" fill="#fff" opacity="${f(r1(rng, .3, 1))}"/>`;
  s += `<circle cx="1300" cy="220" r="110" fill="url(#gz)"/>`;
  return [s, `<radialGradient id="g" cx="30%" cy="60%" r="90%"><stop offset="0" stop-color="#2a2150"/><stop offset=".6" stop-color="#0d0d24"/><stop offset="1" stop-color="#05050f"/></radialGradient><radialGradient id="gz" cx="35%" cy="35%"><stop offset="0" stop-color="#f4a261"/><stop offset="1" stop-color="#7a3b1d"/></radialGradient>`];
});

// Kart ve taş oyunları için taş resimleri (128×128)
const TASLAR = [];
function tas(id, ad, ic, defs = "") { TASLAR.push({ id, ad, svg: svg(128, 128, ic, defs) }); }
tas("tas-can", "Can (kalp)", `<path d="M64 112 C 20 80 8 56 14 36 C 20 14 50 10 64 32 C 78 10 108 14 114 36 C 120 56 108 80 64 112z" fill="url(#g)" stroke="#5a0d14" stroke-width="5"/><path d="M34 34 q8 -10 20 -4" stroke="#fff" stroke-opacity=".6" stroke-width="6" fill="none" stroke-linecap="round"/>`, `<radialGradient id="g" cx="40%" cy="35%"><stop offset="0" stop-color="#ff6b7a"/><stop offset="1" stop-color="#b3172c"/></radialGradient>`);
tas("tas-jeton-altin", "Altın jeton", `<circle cx="64" cy="64" r="58" fill="url(#g)" stroke="#7a5a10" stroke-width="5"/><circle cx="64" cy="64" r="42" fill="none" stroke="#7a5a10" stroke-width="3" stroke-dasharray="5 5"/><path d="M64 36 l8 18 h20 l-16 12 l6 20 l-18 -12 l-18 12 l6 -20 l-16 -12 h20z" fill="#fff3c4" stroke="#7a5a10" stroke-width="2"/>`, `<radialGradient id="g" cx="40%" cy="35%"><stop offset="0" stop-color="#ffe9a0"/><stop offset="1" stop-color="#c9932a"/></radialGradient>`);
tas("tas-enerji", "Enerji hücresi", `<rect x="34" y="16" width="60" height="100" rx="12" fill="#14303a" stroke="#2fd3b5" stroke-width="5"/><rect x="50" y="6" width="28" height="12" rx="3" fill="#2fd3b5"/><path d="M70 30 L48 70 h16 l-6 32 l26 -44 h-16z" fill="#7ff7e0"/>`);
tas("tas-hedef", "Hedef işareti", `<circle cx="64" cy="64" r="56" fill="#fff" stroke="#b3172c" stroke-width="6"/><circle cx="64" cy="64" r="38" fill="#b3172c"/><circle cx="64" cy="64" r="20" fill="#fff"/><circle cx="64" cy="64" r="8" fill="#b3172c"/>`);
tas("tas-kalkan", "Kalkan", `<path d="M64 8 L112 24 V60 C112 92 88 112 64 122 C40 112 16 92 16 60 V24z" fill="url(#g)" stroke="#1d3557" stroke-width="5"/><path d="M64 26 V104 M34 54 H94" stroke="#e9c46a" stroke-width="8"/>`, `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5a8bd6"/><stop offset="1" stop-color="#1d3557"/></linearGradient>`);
tas("tas-kafatasi", "Kafatası", `<path d="M64 10 q46 0 46 46 q0 22 -16 32 v18 h-60 v-18 q-16 -10 -16 -32 q0 -46 46 -46z" fill="#efe9dc" stroke="#3a3632" stroke-width="5"/><circle cx="46" cy="58" r="12" fill="#3a3632"/><circle cx="82" cy="58" r="12" fill="#3a3632"/><path d="M64 72 l-7 12 h14z" fill="#3a3632"/>`);

/* ================= Yaz ================= */
const katalog = { harita: [], jeton: [], masa: [], tas: [] };
for (const h of HARITALAR) { const [ic, defs] = h.uret(tohum(h.id.length * 977 + 13)); fs.writeFileSync(path.join(OUT, "harita-" + h.id + ".svg"), svg(W, H, ic, defs)); katalog.harita.push({ id: h.id, ad: h.ad, url: `/gorsel/harita-${h.id}.svg`, w: W, h: H, sutun: 28, temalar: h.temalar }); }
for (const j of JETONLAR) { fs.writeFileSync(path.join(OUT, "jeton-" + j.id + ".svg"), jetonSvg(j)); katalog.jeton.push({ id: j.id, ad: j.ad, taraf: j.taraf, url: `/gorsel/jeton-${j.id}.svg`, temalar: j.temalar }); }
for (const m of MASALAR) { const [ic, defs] = m.uret(tohum(m.id.length * 131 + 7)); fs.writeFileSync(path.join(OUT, m.id + ".svg"), svg(1600, 1000, ic, defs)); katalog.masa.push({ id: m.id, ad: m.ad, url: `/gorsel/${m.id}.svg` }); }
for (const t of TASLAR) { fs.writeFileSync(path.join(OUT, t.id + ".svg"), t.svg); katalog.tas.push({ id: t.id, ad: t.ad, url: `/gorsel/${t.id}.svg` }); }
fs.writeFileSync(path.join(OUT, "katalog.js"), `/* Hazır masa görselleri kataloğu. tools/gorsel/uret.js üretir; elle düzenleme. */
(function (root) {
  const K = ${JSON.stringify(katalog, null, 1)};
  if (typeof module === "object" && module.exports) module.exports = K; else root.ZM_GORSEL = K;
})(typeof window !== "undefined" ? window : globalThis);
`);
console.log(`${katalog.harita.length} harita, ${katalog.jeton.length} jeton, ${katalog.masa.length} masa, ${katalog.tas.length} taş → ${OUT}`);
