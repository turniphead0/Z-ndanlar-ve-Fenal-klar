/* Profil rozetleri: kapağın altında kazanılan rozetler. Kendi profilinde henüz kazanılmamış olanlar da
   ilerlemesiyle (ör. 3 / 10) soluk görünür. Veri: rozetler işlemi (server/rozetler.js). */
(function () {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tarih = t => new Date(t).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const st = document.createElement("style");
  st.textContent = `.rozetler{margin:14px 0 4px;background:var(--surface);border:1px solid var(--line);border-radius:var(--r,10px);padding:12px 14px}
.rozetler-bas{display:flex;align-items:baseline;gap:8px;margin:0 0 10px}
.rozetler-bas h2{font-family:var(--f-display);font-weight:500;font-size:19px;margin:0}
.rozetler-bas small{color:var(--muted)}
.rozet-liste{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(178px,1fr));gap:8px}
.rozet-k{display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:var(--surface-2)}
.rozet-k .rs{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;font-size:20px;flex:none;background:var(--gold-soft);box-shadow:inset 0 0 0 2px var(--gold)}
.rozet-k b{display:block;font-size:14px;line-height:1.2}
.rozet-k small{display:block;color:var(--muted);font-size:12px;line-height:1.25}
.rozet-k.kilitli{opacity:.62;background:none;border-style:dashed}
.rozet-k.kilitli .rs{background:var(--surface-2);box-shadow:inset 0 0 0 2px var(--line);filter:grayscale(1)}
.rozet-k .cubuk{height:4px;border-radius:2px;background:var(--line);margin-top:4px;overflow:hidden}
.rozet-k .cubuk i{display:block;height:100%;background:var(--accent)}`;
  document.head.appendChild(st);

  function html(r, ben) {
    if (!r || !r.rozetler) return "";
    const kazanilan = r.rozetler.filter(z => z.kazanildi), kalan = r.rozetler.filter(z => !z.kazanildi);
    if (!kazanilan.length && !ben) return "";
    const kart = z => z.kazanildi
      ? `<li class="rozet-k" title="${esc(z.aciklama)} · ${tarih(z.kazanildi)}"><span class="rs" aria-hidden="true">${z.simge}</span><span><b>${esc(z.ad)}</b><small>${esc(z.aciklama)}</small></span></li>`
      : `<li class="rozet-k kilitli" title="${esc(z.aciklama)}"><span class="rs" aria-hidden="true">${z.simge}</span><span style="flex:1;min-width:0"><b>${esc(z.ad)}</b><small>${esc(z.aciklama)}</small>${z.hedef > 1 ? `<span class="cubuk" role="progressbar" aria-valuemin="0" aria-valuemax="${z.hedef}" aria-valuenow="${z.n}" aria-label="${esc(z.ad)} ilerlemesi"><i style="width:${Math.round(100 * z.n / z.hedef)}%"></i></span><small>${z.n} / ${z.hedef}</small>` : ""}</span></li>`;
    return `<section class="rozetler" aria-label="Rozetler"><div class="rozetler-bas"><h2>Rozetler</h2><small>${kazanilan.length} / ${r.rozetler.length}</small></div>
      <ul class="rozet-liste">${kazanilan.map(kart).join("")}${ben ? kalan.map(kart).join("") : ""}</ul></section>`;
  }
  window.zmRozetler = { html };
})();
