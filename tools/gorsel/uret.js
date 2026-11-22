#!/usr/bin/env node
// Hazır masa görsellerini üretir: jetonlar, kart masası arka planları ve taşlar (SVG) ve hepsinin kataloğu.
// Çıktı: web/gorsel/*.svg ve web/gorsel/katalog.js. RPG haritalarının resimlerini tools/gorsel/haritalar.js üretir. Hepsi bu betikle üretilir, telifsizdir (MIT, projeyle birlikte).
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
/* ================= RPG harita arka planları =================
   Haritalar artık gerçekçi resimlerdir (web/gorsel/harita-<id>.webp, 1400×1000, 28×20 kare). Resimleri
   tools/gorsel/haritalar.js üretir (çizim: tools/gorsel/haritalar-ciz.js, dokular: web/ext/doku.js); burada yalnızca katalog bilgisi var. */
const W = 1400, H = 1000;
const HARITALAR = [
  ["orman-acikligi", "Orman açıklığı", ["dnd5e", "pf2e", "forbidden", "genel"]],
  ["zindan", "Zindan koridorları", ["dnd5e", "pf2e", "forbidden", "genel"]],
  ["meyhane", "Meyhane", ["dnd5e", "pf2e", "forbidden", "genel"]],
  ["magara", "Mağara", ["dnd5e", "pf2e", "forbidden", "vaesen", "genel"]],
  ["kasaba-meydani", "Kasaba meydanı", ["dnd5e", "pf2e", "forbidden", "genel"]],
  ["mezarlik", "Sisli mezarlık", ["coc7", "vaesen", "motw", "genel"]],
  ["konak", "Eski konak", ["coc7", "vaesen", "motw", "genel"]],
  ["uzay-gemisi", "Uzay gemisi güvertesi", ["alien", "genel"]],
  ["karli-orman", "Karlı orman ve donmuş göl", ["vaesen", "forbidden", "genel"]],
  ["sehir-sokagi", "Şehir sokağı (gece)", ["motw", "coc7", "genel"]],
  ["col-harabeleri", "Çöl harabeleri", ["dnd5e", "pf2e", "genel"]]
].map(([id, ad, temalar]) => ({ id, ad, temalar }));

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
for (const h of HARITALAR) katalog.harita.push({ id: h.id, ad: h.ad, url: `/gorsel/harita-${h.id}.webp`, w: W, h: H, sutun: 28, temalar: h.temalar });
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
