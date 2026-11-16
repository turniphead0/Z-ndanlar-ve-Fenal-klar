/* Masaüstü eklentileri: hazır harita arka planları ve jeton resimleri (web/gorsel, tools/gorsel/uret.js üretir).
   Harita panelinde "Hazır arka plan", seçili jetonda "Hazır jeton" düğmesi ve haritalar başlığında
   "+ Hazır haritadan" düğmesi ekler. Seçici oyunun sistemine uygun olanları önce gösterir
   (D&D, Pathfinder, Call of Cthulhu, Alien, Vaesen, Forbidden Lands, Monster of the Week). */
(function () {
  "use strict";
  if (!window.ZM_GORSEL || !window.ZM_GORSEL_SEC) return;
  const K = window.ZM_GORSEL;
  const tema = () => { try { const s = sysKey(); return s === "yze" ? (S.games[G.id] && S.games[G.id].yzePreset) || "alien" : s; } catch (e) { return "genel"; } };
  const hazirHarita = () => window.ZM_GORSEL_SEC({ baslik: "Hazır harita arka planı", tema: tema(), gruplar: [{ ad: "", liste: K.harita }] });

  function ekle() {
    if (!G.id || S.view !== "harita" || S.ro) return;
    const bg = document.querySelector('[data-act="bg"]');
    if (bg && !bg.parentElement.querySelector("[data-zg-bg]")) bg.insertAdjacentHTML("afterend", `<button class="btn sm" data-zg-bg title="Uygulamayla gelen haritalardan seç">Hazır arka plan</button>`);
    const ti = document.querySelector('[data-act="tokimg"]');
    if (ti && !ti.parentElement.querySelector("[data-zg-jeton]")) ti.insertAdjacentHTML("afterend", ` <button class="btn sm" data-zg-jeton title="Uygulamayla gelen jetonlardan seç">Hazır jeton</button>`);
    const yeni = document.querySelector('.vhead [data-act="newmap"], .empty [data-act="newmap"]');
    if (yeni && isDM() && !yeni.parentElement.querySelector("[data-zg-yeni]")) yeni.insertAdjacentHTML("beforebegin", `<button class="btn" data-zg-yeni title="Hazır bir haritayla yeni harita aç">+ Hazır haritadan</button>`);
  }
  const _render = window.render;
  window.render = function () { const r = _render.apply(this, arguments); try { ekle(); } catch (e) { console.error(e); } return r; };

  document.addEventListener("click", async e => {
    const b = e.target.closest("[data-zg-bg],[data-zg-jeton],[data-zg-yeni]"); if (!b) return;
    e.preventDefault();
    if (b.dataset.zgJeton !== undefined) {
      const m = curMap(), t = m && m.tokens[S.selTok]; if (!t) return;
      const s = await window.ZM_GORSEL_SEC({ baslik: "Hazır jeton resmi", tema: tema(), kare: true, gruplar: [
        { ad: "Kahramanlar", liste: K.jeton.filter(j => j.taraf === "kahraman") }, { ad: "Düşmanlar", liste: K.jeton.filter(j => j.taraf === "dusman") },
        { ad: "Canavarlar", liste: K.jeton.filter(j => j.taraf === "canavar") }, { ad: "Diğerleri", liste: K.jeton.filter(j => j.taraf === "notr") }] });
      if (s && curMap() === m && m.tokens[t.id]) setTokImg(m, m.tokens[t.id], s.url);
      return;
    }
    if (!isDM()) return;
    const s = await hazirHarita(); if (!s) return;
    if (b.dataset.zgYeni !== undefined) {
      const m = newMap(); Object.assign(m, { name: s.ad, cols: s.sutun, rows: Math.round(s.sutun * s.h / s.w), bg: s.url, bgW: s.w, bgH: s.h });
      save("maps", m); S.mapId = m.id; S.selTok = null; S.view = "harita"; render();
      toast(`${s.ad} haritası hazır: ${m.cols}×${m.rows} kare`);
      return;
    }
    const m = curMap(); if (!m) return;
    m.bg = s.url; m.bgW = s.w; m.bgH = s.h; save("maps", m, ["bg", "bgW", "bgH"]); render();
    toast(`Arka plan: ${s.ad}. Kareler resme uymazsa Sütun'u ${s.sutun} yap.`);
  });
})();
