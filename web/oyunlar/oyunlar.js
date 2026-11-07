/* Masa oyunları sayfası (/oyunlar). Zar Masası'nın sunucusuna aynı kimlikle bağlanır (localStorage zm-uid / zm-secret),
   boards/* belgelerini canlı izler ve hamleleri sunucuya gönderir. Kuralları kurallar.js'ten alır. */
(function () {
  "use strict";
  const { OYUNLAR, ayni } = window.ZM_OYUNLAR;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const LS = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

  /* ---------------- Bağlantı ---------------- */
  let ws, seq = 0, ME = null, IS_OWNER = false;
  const bekleyen = new Map(), abonelik = new Map();
  const call = (op, a) => new Promise((res, rej) => { const id = ++seq; bekleyen.set(id, { res, rej }); ws.send(JSON.stringify({ id, op, ...a })); });

  function baglan(form) {
    return new Promise(done => {
      ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws");
      ws.onopen = async () => {
        try {
          const r = await call("hello", { userId: LS.get("zm-uid"), secret: LS.get("zm-secret"), name: form.name, color: form.color || LS.get("zm-color"), password: form.password || LS.get("zm-pass") || "", ownerKey: LS.get("zm-owner") || "" });
          ME = r.me; IS_OWNER = r.isOwner;
          LS.set("zm-uid", r.me.id); LS.set("zm-secret", r.secret); LS.set("zm-name", r.me.name); if (form.password) LS.set("zm-pass", form.password);
          $("#ben").textContent = ME.name;
          for (const [sid, s] of abonelik) ws.send(JSON.stringify({ id: ++seq, op: "sub", sid, kind: s.kind, path: s.path }));
          done(null);
        } catch (e) { done(e); }
      };
      ws.onmessage = ev => {
        const m = JSON.parse(ev.data);
        if (m.re != null && !m.ev) { const w = bekleyen.get(m.re); if (w) { bekleyen.delete(m.re); m.error ? w.rej(Object.assign(new Error(m.error.message), m.error)) : w.res(m.result); } return; }
        if (m.ev === "snap") { const s = abonelik.get(m.sid); if (s) s.fn(m); }
      };
      ws.onclose = () => { if (ME) setTimeout(() => baglan({ name: ME.name }), 1500); else done(Object.assign(new Error("Sunucuya bağlanılamadı"), { code: "network" })); };
    });
  }
  function abone(kind, path, fn) { const sid = "o" + (++seq); abonelik.set(sid, { kind, path, fn }); call("sub", { sid, kind, path }); }

  function girisFormu(ihtiyacSifre, hata) {
    return new Promise(done => {
      const ov = document.createElement("div"); ov.className = "giris";
      ov.innerHTML = `<form><h2 style="margin:0">Masa oyunlarına katıl</h2>
        <label>Adın<br><input name="ad" maxlength="40" required></label>
        ${ihtiyacSifre ? `<label>Masa şifresi<br><input name="sifre" type="password" required></label>` : ""}
        <p class="hata">${esc(hata || "")}</p><button class="btn pri">Katıl</button></form>`;
      document.body.appendChild(ov);
      const f = ov.querySelector("form"); f.ad.value = LS.get("zm-name") || ""; f.ad.focus();
      f.onsubmit = e => { e.preventDefault(); ov.remove(); done({ name: f.ad.value.trim(), password: f.sifre ? f.sifre.value : "" }); };
    });
  }

  async function basla() {
    let info = {}; try { info = await (await fetch("/api/info")).json(); } catch (e) {}
    let form = { name: LS.get("zm-name") }, hata = "";
    for (;;) {
      if (!form.name || hata) form = await girisFormu(info.needsPassword && !LS.get("zm-owner"), hata);
      const e = await baglan(form);
      if (!e) break;
      hata = e.message || "Bağlanılamadı";
      if (e.code === "bad_password") LS.set("zm-pass", "");
    }
    abone("col", "boards", m => {
      if (m.initial) tahtalar.clear();
      for (const ch of m.changes) ch.type === "removed" ? tahtalar.delete(ch.id) : tahtalar.set(ch.id, ch.data);
      ciz();
    });
  }

  /* ---------------- Durum ---------------- */
  const tahtalar = new Map();
  let secim = [], hataMetni = "", sonId = null;
  const acikId = () => (location.hash.match(/^#(b[a-z0-9]+)$/) || [])[1];
  window.addEventListener("hashchange", () => { secim = []; hataMetni = ""; ciz(); });

  const RENK = ["Açık taşlar", "Koyu taşlar"];
  const koltukAdi = (b, k) => (b.koltuk[k] ? b.koltuk[k].name : "boş");
  const benimKoltuklarim = b => [0, 1].filter(k => b.koltuk[k] && ME && b.koltuk[k].id === ME.id);

  function ciz() {
    const id = acikId();
    if (id && tahtalar.has(id)) return cizTahta(id, tahtalar.get(id));
    if (id && !tahtalar.has(id)) { $("#ana").innerHTML = `<p class="bos">Bu tahta kapatılmış. <a href="#">Oyunlara dön</a></p>`; return; }
    cizLobi();
  }

  function cizLobi() {
    const liste = [...tahtalar.entries()].sort((a, b) => b[1].updated - a[1].updated);
    $("#ana").innerHTML = `
      <h2>Yeni oyun aç</h2>
      <div class="kartlar">${Object.entries(OYUNLAR).map(([k, g]) => `<div class="kart"><b>${esc(g.ad)}</b><p>${esc(g.kisa)}</p><div><button class="btn pri" data-yeni="${k}">Tahta aç</button></div></div>`).join("")}</div>
      <h2>Açık tahtalar</h2>
      <div class="liste">${liste.length ? liste.map(([id, b]) => `<div class="satir"><span class="ad">${esc(OYUNLAR[b.oyun]?.ad || b.oyun)}</span>
        <span class="bilgi">${esc(koltukAdi(b, 0))} – ${esc(koltukAdi(b, 1))} · ${b.durum.bitti ? "bitti" : b.durum.n + ". hamle"}</span><span class="sp"></span>
        <a class="btn" href="#${id}">${benimKoltuklarim(b).length ? "Devam et" : b.koltuk.includes(null) ? "Katıl" : "İzle"}</a></div>`).join("") : `<p class="bos">Henüz açık tahta yok. Yukarıdan bir oyun seç; tahtayı açınca bağlantıyı masadaki arkadaşlarına söyle ya da onlar bu listeden katılsın.</p>`}</div>`;
  }

  function cizTahta(id, b) {
    if (sonId !== id) { secim = []; sonId = id; }
    const g = OYUNLAR[b.oyun], d = b.durum, benim = benimKoltuklarim(b);
    const oynayabilir = !d.bitti && benim.includes(d.sira);
    const yasal = oynayabilir ? g.hamleler(d) : [];
    const uyan = yasal.filter(h => ayni(h.slice(0, secim.length), secim));
    const ipucu = new Set(uyan.map(h => h[secim.length]));
    const cevir = benim.length === 1 && benim[0] === 1; // yalnızca ikinci koltuktaysan tahtayı kendi tarafından gör
    const durumMetni = d.bitti
      ? (d.bitti.kazanan == null ? `Berabere (${d.bitti.neden})` : `Kazanan: ${koltukAdi(b, d.bitti.kazanan)} · ${RENK[d.bitti.kazanan]} (${d.bitti.neden})`)
      : !b.koltuk[d.sira] ? `Sıra ${RENK[d.sira].toLowerCase()}da, ama koltuk boş`
      : oynayabilir ? `Sıra sende (${RENK[d.sira].toLowerCase()})` : `Sıra ${koltukAdi(b, d.sira)} oyuncusunda`;
    const koltukHtml = k => {
      const x = b.koltuk[k], mine = x && ME && x.id === ME.id;
      return `<div class="koltuk" data-sira="${!d.bitti && d.sira === k ? 1 : 0}"><span class="tas k${k}"></span><span>${esc(RENK[k])}: ${x ? esc(x.name) : "<i>boş</i>"}</span><span class="sp"></span>
        ${mine ? `<button class="btn" data-kalk="${k}">Kalk</button>` : x ? "" : `<button class="btn pri" data-otur="${k}">Otur</button>`}</div>`;
    };
    $("#ana").innerHTML = `<p><a href="#">← Bütün oyunlar</a></p>
      <div class="oyun"><div class="tahta">${CIZICI[b.oyun](d, { ipucu, secim, cevir })}</div>
      <div class="yan">
        <div class="kutu"><h3>${esc(g.ad)}</h3>${koltukHtml(0)}${koltukHtml(1)}
          <div class="durum${d.bitti ? " bitti" : ""}">${esc(durumMetni)}</div>
          ${b.oyun === "ur" ? urZarHtml(b) : ""}
          <div class="hata" role="alert">${esc(hataMetni)}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-sifirla>Yeniden başlat</button><button class="btn tehlike" data-sil>Tahtayı kapat</button></div></div>
        <div class="kutu"><h3>Kurallar</h3><ul class="kurallar">${g.kurallar.map(k => `<li>${esc(k)}</li>`).join("")}</ul>
          <p class="bos" style="margin:0;font-size:13px">Tek bilgisayarda iki kişi oynayacaksanız iki koltuğa da oturabilirsin.</p></div>
      </div></div>`;
  }

  function urZarHtml(b) {
    const d = b.durum; if (d.bitti) return "";
    const pas = (d.pas || []).map(x => `${koltukAdi(b, x.p)} ${x.zar} attı, sıra geçti`).join(" · ");
    return `<div class="zarlar"><span>Zar:</span>${(d.zarlar || []).map(z => `<i class="${z ? "bir" : ""}">${z}</i>`).join("")}<b class="num">= ${d.zar}</b></div>${pas ? `<div class="bos" style="font-size:13px">${esc(pas)}</div>` : ""}`;
  }

  /* ---------------- Tıklama ---------------- */
  document.addEventListener("click", async e => {
    const id = acikId(), b = id && tahtalar.get(id);
    const yeni = e.target.closest("[data-yeni]");
    try {
      if (yeni) { const r = await call("bgNew", { oyun: yeni.dataset.yeni }); await call("bgSit", { board: r.id, koltuk: 0 }); location.hash = r.id; return; }
      if (!b) return;
      const o = e.target.closest("[data-otur]"), k = e.target.closest("[data-kalk]");
      if (o) return await call("bgSit", { board: id, koltuk: +o.dataset.otur });
      if (k) return await call("bgSit", { board: id, koltuk: +k.dataset.kalk, kalk: true });
      if (e.target.closest("[data-sifirla]")) { if (confirm("Oyun baştan başlasın mı?")) await call("bgReset", { board: id }); return; }
      if (e.target.closest("[data-sil]")) { if (confirm("Tahta herkes için kapansın mı?")) { await call("bgDelete", { board: id }); location.hash = ""; } return; }
      const kare = e.target.closest("[data-k]");
      if (kare) return kareTik(id, b, +kare.dataset.k);
    } catch (err) { hataMetni = err.message; secim = []; ciz(); }
  });

  async function kareTik(id, b, k) {
    const g = OYUNLAR[b.oyun], d = b.durum;
    if (d.bitti || !benimKoltuklarim(b).includes(d.sira)) return;
    const yasal = g.hamleler(d), yeni = secim.concat(k);
    let uyan = yasal.filter(h => ayni(h.slice(0, yeni.length), yeni));
    if (!uyan.length) { secim = yasal.some(h => h[0] === k) ? [k] : []; hataMetni = ""; return ciz(); }
    secim = yeni; hataMetni = "";
    const tam = uyan.find(h => h.length === secim.length);
    if (tam && uyan.length === 1) { secim = []; ciz(); await call("bgMove", { board: id, hamle: tam }); return; }
    ciz();
  }

  /* ---------------- Tahta çizimleri (SVG) ---------------- */
  const tas = (x, y, r, p, ek = "") => `<circle cx="${x}" cy="${y}" r="${r}" fill="var(--p${p})" stroke="var(--p${p}-line)" stroke-width="2" ${ek}/>`;
  const ipucuDaire = (x, y, r) => `<circle class="ipucu" cx="${x}" cy="${y}" r="${r}" opacity=".55"/>`;

  const CIZICI = {
    mangala(d, { ipucu, cevir }) {
      // Saatin tersi: alt sıra (0–5) soldan sağa, sağda 6, üst sıra (7–12) sağdan sola, solda 13.
      const W = 860, H = 320, out = [`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Mangala tahtası"><rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="40" fill="var(--wood)" stroke="var(--wood-2)" stroke-width="6"/>`];
      const yer = i => {
        const k = cevir ? (i + 7) % 14 : i, alt = k <= 5, j = alt ? k : 12 - k;
        return { x: 150 + j * 112, y: alt ? 222 : 98 };
      };
      const hz = p => ({ x: (p === 0) !== cevir ? W - 62 : 62, y: H / 2 });
      const taslar = (cx, cy, n, r) => { let s = ""; for (let t = 0; t < Math.min(n, 18); t++) { const a = t * 2.4, rr = 6 + 3.2 * Math.sqrt(t); s += `<circle cx="${cx + Math.cos(a) * rr * (r / 40)}" cy="${cy + Math.sin(a) * rr * (r / 40) * 1.6}" r="6" fill="var(--p${t % 2})" stroke="var(--wood-ink)" stroke-width="1" opacity=".9"/>`; } return s; };
      for (const p of [0, 1]) {
        const { x, y } = hz(p), i = p === 0 ? 6 : 13;
        out.push(`<rect x="${x - 40}" y="${y - 110}" width="80" height="220" rx="38" fill="var(--wood-2)"/>${taslar(x, y, d.a[i], 40)}<text x="${x}" y="${y + 135}" text-anchor="middle" font-size="18" font-weight="700" fill="var(--wood-ink)" class="num">${d.a[i]}</text>`);
      }
      for (let i = 0; i < 13; i++) {
        if (i === 6) continue;
        const { x, y } = yer(i), son = d.son && d.son[0] === i;
        out.push(`<g class="k" data-k="${i}"><circle cx="${x}" cy="${y}" r="46" fill="var(--wood-2)" ${son ? 'stroke="var(--gold)" stroke-width="4"' : ""}/>${taslar(x, y, d.a[i], 46)}
          <text x="${x}" y="${y + (y > H / 2 ? 72 : -56)}" text-anchor="middle" font-size="18" font-weight="700" fill="var(--wood-ink)">${d.a[i]}</text>
          ${ipucu.has(i) ? `<circle class="secili" cx="${x}" cy="${y}" r="48"/>` : ""}</g>`);
      }
      return out.join("") + "</svg>";
    },

    dama(d, { ipucu, secim, cevir }) {
      const S = 60, out = [`<svg viewBox="0 0 ${S * 8} ${S * 8}" role="img" aria-label="Dama tahtası">`];
      const xy = i => { let r = Math.floor(i / 8), c = i % 8; if (cevir) { r = 7 - r; c = 7 - c; } return [c * S, r * S]; };
      const sonlar = new Set(d.son || []);
      for (let i = 0; i < 64; i++) {
        const [x, y] = xy(i), v = d.b[i];
        out.push(`<g class="k" data-k="${i}"><rect x="${x}" y="${y}" width="${S}" height="${S}" fill="${(Math.floor(i / 8) + i) % 2 ? "var(--wood-2)" : "var(--wood)"}"/>`);
        if (sonlar.has(i)) out.push(`<rect class="son" x="${x + 2}" y="${y + 2}" width="${S - 4}" height="${S - 4}"/>`);
        if (v) {
          const p = v <= 2 ? 0 : 1;
          out.push(tas(x + S / 2, y + S / 2, S * 0.38, p));
          if (v === 2 || v === 4) out.push(`<circle cx="${x + S / 2}" cy="${y + S / 2}" r="${S * 0.2}" fill="none" stroke="var(--gold)" stroke-width="4"/>`);
        }
        if (secim.includes(i)) out.push(`<rect class="secili" x="${x + 2}" y="${y + 2}" width="${S - 4}" height="${S - 4}"/>`);
        if (ipucu.has(i)) out.push(v && secim.length === 0 ? `<circle class="secili" cx="${x + S / 2}" cy="${y + S / 2}" r="${S * 0.43}" opacity=".6"/>` : ipucuDaire(x + S / 2, y + S / 2, S * 0.16));
        out.push("</g>");
      }
      return out.join("") + "</svg>";
    },

    dokuztas(d, { ipucu, secim }) {
      const G = 70, M = 40, P = i => [M + OYUNLAR.dokuztas.xy[i][0] * G, M + OYUNLAR.dokuztas.xy[i][1] * G], W = M * 2 + 6 * G;
      const out = [`<svg viewBox="0 0 ${W} ${W + 60}" role="img" aria-label="Dokuz taş tahtası"><rect x="0" y="0" width="${W}" height="${W}" rx="14" fill="var(--wood)"/>`];
      const cizgiler = new Set();
      OYUNLAR.dokuztas.komsu.forEach((ks, a) => ks.forEach(b => { if (a < b) cizgiler.add(a + "-" + b); }));
      for (const c of cizgiler) { const [a, b] = c.split("-").map(Number), [x1, y1] = P(a), [x2, y2] = P(b); out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--wood-ink)" stroke-width="4"/>`); }
      const sonlar = new Set(d.son || []);
      for (let i = 0; i < 24; i++) {
        const [x, y] = P(i), v = d.b[i];
        out.push(`<g class="k" data-k="${i}"><circle cx="${x}" cy="${y}" r="26" fill="transparent"/><circle cx="${x}" cy="${y}" r="7" fill="var(--wood-ink)"/>`);
        if (sonlar.has(i)) out.push(`<circle class="son" cx="${x}" cy="${y}" r="26"/>`);
        if (v >= 0) out.push(tas(x, y, 22, v));
        if (secim.includes(i)) out.push(`<circle class="secili" cx="${x}" cy="${y}" r="26"/>`);
        if (ipucu.has(i)) out.push(v >= 0 ? `<circle class="secili" cx="${x}" cy="${y}" r="26" opacity=".6"/>` : ipucuDaire(x, y, 12));
        out.push("</g>");
      }
      // Eldeki taşlar
      for (const p of [0, 1]) for (let t = 0; t < d.elde[p]; t++) out.push(tas(p === 0 ? 24 + t * 24 : W - 24 - t * 24, W + 30, 10, p));
      return out.join("") + "</svg>";
    },

    ur(d, { ipucu, secim }) {
      const S = 70, Y0 = 70, U = OYUNLAR.ur, out = [`<svg viewBox="0 0 ${S * 8} ${Y0 * 2 + S * 3}" role="img" aria-label="Ur tahtası">`];
      const hucre = new Map(); // kare -> [oyuncu]
      for (const p of [0, 1]) for (const k of d.t[p]) if (k > 0 && k < 15) hucre.set(U.kare(p, k), p);
      const sonlar = new Set(d.son || []);
      for (let i = 0; i < 24; i++) {
        if (U.yok.includes(i)) continue;
        const x = (i % 8) * S, y = Y0 + Math.floor(i / 8) * S;
        out.push(`<g class="k" data-k="${i}"><rect x="${x + 2}" y="${y + 2}" width="${S - 4}" height="${S - 4}" rx="6" fill="var(--wood)" stroke="var(--wood-2)" stroke-width="3"/>`);
        if (U.rozetler.includes(i)) out.push(`<g transform="translate(${x + S / 2} ${y + S / 2})" fill="var(--wood-2)">${[0, 45, 90, 135].map(a => `<ellipse rx="26" ry="8" transform="rotate(${a})"/>`).join("")}<circle r="7" fill="var(--gold)"/></g>`);
        if (sonlar.has(i)) out.push(`<rect class="son" x="${x + 4}" y="${y + 4}" width="${S - 8}" height="${S - 8}"/>`);
        if (hucre.has(i)) out.push(tas(x + S / 2, y + S / 2, 22, hucre.get(i)));
        if (secim.includes(i)) out.push(`<rect class="secili" x="${x + 4}" y="${y + 4}" width="${S - 8}" height="${S - 8}"/>`);
        if (ipucu.has(i)) out.push(hucre.has(i) && secim.length === 0 ? `<circle class="secili" cx="${x + S / 2}" cy="${y + S / 2}" r="26" opacity=".6"/>` : ipucuDaire(x + S / 2, y + S / 2, 12));
        out.push("</g>");
      }
      // Havuz ve çıkış alanları: ikinci oyuncu üstte, birinci altta.
      for (const p of [0, 1]) {
        const y = p === 0 ? Y0 + S * 3 + 6 : 4, havuz = d.t[p].filter(k => k === 0).length, cikan = d.t[p].filter(k => k === 15).length;
        const alan = (key, x, w, n, etiket) => `<g class="k" data-k="${key}"><rect x="${x}" y="${y}" width="${w}" height="${Y0 - 10}" rx="8" fill="var(--surface-2)" stroke="var(--line)"/>
          ${Array.from({ length: n }, (_, t) => tas(x + 22 + t * 26, y + (Y0 - 10) / 2, 10, p)).join("")}<text x="${x + w - 8}" y="${y + 18}" text-anchor="end" font-size="13" fill="var(--muted)">${etiket}</text>
          ${ipucu.has(key) ? `<rect class="secili" x="${x}" y="${y}" width="${w}" height="${Y0 - 10}" rx="8"/>` : ""}${secim.includes(key) ? `<rect class="secili" x="${x}" y="${y}" width="${w}" height="${Y0 - 10}" rx="8"/>` : ""}</g>`;
        out.push(alan(100 + p, 0, S * 4 - 6, havuz, "Başlangıç"), alan(200 + p, S * 4 + 6, S * 4 - 6, cikan, "Çıkış"));
      }
      return out.join("") + "</svg>";
    },
  };

  basla();
})();
