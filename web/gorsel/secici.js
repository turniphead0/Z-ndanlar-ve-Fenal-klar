/* Hazır görsel seçici: katalogdaki (window.ZM_GORSEL) harita, jeton, masa ya da taş resimlerinden birini seçtiren
   küçük pencere. Hem masa ekranında (RPG) hem masa oyunları sayfasında (atölye) kullanılır.
   ZM_GORSEL_SEC({ baslik, gruplar: [{ ad, liste }], tema }) → Promise<öğe | null> */
(function () {
  "use strict";
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const TEMA_AD = { genel: "Hepsi", dnd5e: "D&D 5e", pf2e: "Pathfinder 2e", coc7: "Call of Cthulhu", alien: "Bilimkurgu", vaesen: "Vaesen", forbidden: "Forbidden Lands", motw: "Monster of the Week" };
  let stil = false;
  function stilEkle() {
    if (stil) return; stil = true;
    const s = document.createElement("style");
    s.textContent = `.zg-ov{position:fixed;inset:0;z-index:200;background:rgba(8,10,12,.55);display:flex;align-items:center;justify-content:center;padding:16px}
.zg-pen{background:var(--surface,#fff);color:var(--ink,#222);border:1px solid var(--line,#ccc);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.35);width:min(860px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;overflow:hidden}
.zg-bas{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line,#ddd);flex-wrap:wrap}.zg-bas h3{margin:0;font-size:18px;flex:1}
.zg-bas select{font:inherit;padding:4px 8px;border-radius:6px;border:1px solid var(--line,#ccc);background:var(--surface-2,#f6f6f6);color:inherit}
.zg-ic{overflow:auto;padding:12px 16px 18px}.zg-ic h4{margin:12px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted,#777)}
.zg-izgara{display:grid;grid-template-columns:repeat(auto-fill,minmax(var(--zg-w,150px),1fr));gap:10px}
.zg-oge{display:flex;flex-direction:column;gap:4px;align-items:center;padding:6px;border:1px solid var(--line,#ddd);border-radius:8px;background:var(--surface-2,#f7f7f7);cursor:pointer;font:inherit;color:inherit;font-size:13px}
.zg-oge:hover,.zg-oge:focus-visible{border-color:var(--accent,#2f8f86);outline:2px solid var(--accent,#2f8f86);outline-offset:1px}
.zg-oge img{width:100%;aspect-ratio:var(--zg-oran,1.4);object-fit:cover;border-radius:4px;background:#0002}
.zg-kapat{font:inherit;border:1px solid var(--line,#ccc);background:transparent;color:inherit;border-radius:6px;padding:4px 10px;cursor:pointer}`;
    document.head.appendChild(s);
  }

  window.ZM_GORSEL_SEC = function ({ baslik, gruplar, tema, kare }) {
    stilEkle();
    return new Promise(res => {
      const ov = document.createElement("div"); ov.className = "zg-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", baslik || "Hazır görseller");
      const temalar = [...new Set(gruplar.flatMap(g => g.liste.flatMap(x => x.temalar || [])))];
      let secTema = tema && temalar.includes(tema) ? tema : "genel";
      const ciz = () => {
        const ic = gruplar.map((g, gi) => {
          const liste = g.liste.filter(x => !x.temalar || secTema === "genel" || x.temalar.includes(secTema));
          if (!liste.length) return "";
          return `${g.ad ? `<h4>${esc(g.ad)}</h4>` : ""}<div class="zg-izgara" style="${kare ? "--zg-w:96px;--zg-oran:1" : ""}">${liste.map(x => `<button class="zg-oge" data-g="${gi}" data-id="${esc(x.id)}"><img src="${esc(x.url)}" alt="" loading="lazy">${esc(x.ad)}</button>`).join("")}</div>`;
        }).join("");
        ov.innerHTML = `<div class="zg-pen"><div class="zg-bas"><h3>${esc(baslik || "Hazır görseller")}</h3>
          ${temalar.length > 1 ? `<label>Oyun <select data-zg-tema>${["genel", ...temalar.filter(t => t !== "genel")].map(t => `<option value="${t}"${t === secTema ? " selected" : ""}>${esc(TEMA_AD[t] || t)}</option>`).join("")}</select></label>` : ""}
          <button class="zg-kapat" data-zg-kapat>Kapat</button></div><div class="zg-ic">${ic || "<p>Bu oyun için hazır görsel yok.</p>"}</div></div>`;
      };
      const bitir = v => { ov.remove(); document.removeEventListener("keydown", tus, true); res(v); };
      const tus = e => { if (e.key === "Escape") { e.stopPropagation(); bitir(null); } };
      ov.addEventListener("click", e => {
        if (e.target === ov || e.target.closest("[data-zg-kapat]")) return bitir(null);
        const b = e.target.closest(".zg-oge"); if (!b) return;
        bitir(gruplar[+b.dataset.g].liste.find(x => x.id === b.dataset.id) || null);
      });
      ov.addEventListener("change", e => { if (e.target.matches("[data-zg-tema]")) { secTema = e.target.value; ciz(); } });
      document.addEventListener("keydown", tus, true);
      ciz(); document.body.appendChild(ov);
      const ilk = ov.querySelector(".zg-oge"); if (ilk) ilk.focus();
    });
  };
})();
