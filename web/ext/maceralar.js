/* Masaüstü eklentileri (10): hazır başlangıç maceraları.
   Açık lisanslı maceraların Türkçe çevirileri web/ext/maceralar/<id>.json içinde durur. Yüklenince Senaryo bölümü
   (kılavuz, modüller, NPC'ler, el notları, haritalar, sayfalar), hazır karakterler, canavar kartları, haritalar ve
   DM notları tek tıkla masaya kurulur. Her macera yazarına ve lisansına atıfla gelir. */
(function () {
  "use strict";

  // Katalog: yalnızca sistemi ve kısa bilgiyi tutar; içerik seçilince indirilir.
  const LIST = window.MACERA_LIST = window.MACERA_LIST || [];
  LIST.push(
    { id: "sinav-adasi", sys: "dnd5e", title: "Sınav Adası", level: "Sv 5", players: "4 oyuncu", length: "Tek oturum",
      summary: "Fırtınadan sonra ıssız bir adada uyanan maceracılar, küçük bir tanrının sınavında dağın tepesindeki sunağa ulaşmalı. Uyanmış ağaçlar, kayıp eşyalarını arayan bir kertenkele halkı kabilesi, gizemli bir driyad, taş dev ve treant. Seçimler lütuf ya da lanet getirir.",
      credit: "Kreig Durham, Island of Trials", license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/", source: "https://kreigd.itch.io/island-of-trials" },
    { id: "pusudaki-korku", sys: "motw", title: "Pusudaki Korku", level: "Gizem", players: "2-5 avcı", length: "1-2 oturum",
      summary: "Black Fall Grove'da inekler parçalanıyor, bir kadın kocasının uzaylılarca kaçırıldığını söylüyor ve kasaba korku filmi festivaline hazırlanıyor. Kanalizasyonda adrenaline susamış bir şey var.",
      credit: "Qui Revient de Loin, The Fear that lurks", license: "CC BY-NC-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-nc-sa/4.0/", source: "https://qui-revient-de-loin.itch.io/the-fear-that-lurks-a-mystery-for-the-road" }
  );
  const forSys = k => LIST.filter(m => m.sys === k);

  async function load(entry) {
    const res = await fetch(`/ext/maceralar/${entry.id}.json`);
    if (!res.ok) throw new Error("macera dosyası bulunamadı");
    const d = await res.json();
    const put = col => { for (const o of Object.values(d[col] || {})) if (!S[col][o.id]) save(col, col === "maps" ? normMap(clone(o)) : clone(o)); };
    ["chars", "notes", "maps", "monsters", "dmnotes"].forEach(put);
    // Senaryo: önceki sayfaları temizle, metni 40 sayfalık parçalar halinde yaz.
    for (const k of Object.keys(S.scenario)) if (k.startsWith("pg-")) del("scenario", k);
    const pages = d.pages || [];
    for (let i = 0, idx = 0; i < pages.length; i += 40, idx++) save("scenario", { id: "pg-" + idx, from: i + 1, pages: pages.slice(i, i + 40) });
    const sc = d.scenario || {};
    save("scenario", { id: "meta", status: "analyzed", importedAt: Date.now(), analyzedAt: Date.now(), pageCount: pages.length, fileName: entry.credit,
      title: entry.title, adventure: { id: entry.id, credit: entry.credit, license: entry.license, licenseUrl: entry.licenseUrl, source: entry.source },
      guide: sc.guide || {}, modules: sc.modules || [], npcs: sc.npcs || [], handouts: sc.handouts || [], maps: sc.maps || [], clues: sc.clues || [] });
    S.scTab = "guide"; render();
    toast(`${entry.title} masaya kuruldu: kılavuz, karakterler, kartlar ve haritalar hazır`);
  }

  const card = m => `<article class="panel mc-card"><div class="gtop"><h3 class="h2" style="font-size:19px">${esc(m.title)}</h3><span class="rbadge sys">${esc(m.level || "")}</span></div>
    <p>${esc(m.summary)}</p>
    <p class="hint" style="margin:0">${esc(m.players || "")}${m.length ? " · " + esc(m.length) : ""}</p>
    <p class="hint mc-credit">${esc(m.credit)} · <a href="${esc(m.licenseUrl)}" target="_blank" rel="noopener">${esc(m.license)}</a> · <a href="${esc(m.source)}" target="_blank" rel="noopener">özgün sürüm</a></p>
    <div class="chips"><button class="btn pri" data-mc="load" data-id="${esc(m.id)}">Masaya kur</button></div></article>`;

  function panel() {
    const list = forSys(sysKey());
    if (!list.length) return `<section class="panel mc-wrap"><h3>Hazır maceralar</h3><p class="hint" style="margin:0">Bu sistem için henüz açık lisanslı hazır macera yok. Elindeki senaryonun PDF'ini yükleyebilirsin.</p></section>`;
    return `<section class="mc-wrap"><h2 class="h2">Hazır maceralar</h2><p class="hint">Açık lisanslı başlangıç maceralarının Türkçe çevirileri. Masaya kurunca kılavuz, modüller, NPC'ler, el notları, haritalar, canavar kartları ve hazır karakterler gelir; oyuncular hazır karakterleri Karakterler bölümünde sahiplenebilir.</p>${window.LANG && LANG() === "en" ? `<p class="hint" data-noi18n>These ready-made adventures are Turkish translations. To run one in English, download the original from its "original version" link and upload that PDF on this page: the assistant prepares it in English and keeps its names and terms as written.</p>` : ""}
      <div class="npcgrid">${list.map(card).join("")}</div></section>`;
  }

  const _render = window.render;
  window.render = function () {
    _render.apply(this, arguments);
    if (S.view !== "senaryo" || !isDM() || !G.id) return;
    const m = S.scenario?.meta;
    const host = $("#main"); if (!host || $("#mcPanel", host)) return;
    const el = document.createElement("div"); el.id = "mcPanel";
    if (!m) { el.innerHTML = panel(); const lead = $(".sclead", host); lead ? lead.after(el) : host.appendChild(el); return; }
    if (m.adventure) {
      // Hazır macerada PDF ve Claude düğmeleri yerine atıf ve "başka macera" seçeneği görünür.
      $$('[data-sc="analyze"], label.btn:has([data-sc="file"]), label.btn:has([data-sc="reopen"])', host).forEach(b => b.remove());
      const hint = $(".schead .hint", host);
      if (hint) hint.innerHTML = `${m.pageCount} sayfa · ${esc(m.adventure.credit)} · <a href="${esc(m.adventure.licenseUrl)}" target="_blank" rel="noopener">${esc(m.adventure.license)}</a>`;
      const pimg = $("#pimg", host); if (pimg) { pimg.remove(); $(".pgrid", host)?.classList.add("mc-one"); }
    }
    const head = $(".vhead", host);
    if (head && forSys(sysKey()).length) { const b = document.createElement("button"); b.className = "btn"; b.dataset.mc = "pick"; b.textContent = "Hazır macera"; head.appendChild(b); }
  };

  function pick() {
    $("#mcOv")?.remove(); const ov = document.createElement("div"); ov.id = "mcOv"; ov.className = "joinov zw-ov zb-ov";
    ov.innerHTML = `<div class="zw" role="dialog" aria-modal="true" aria-label="Hazır macera" style="width:min(820px,100%)"><header class="zw-h"><h2>Hazır macera</h2><span style="flex:1"></span><button class="btn sm" data-mc="close" aria-label="Kapat">×</button></header>
      <div class="zw-b"><p class="hint">Yeni bir macera kurmak şu anki senaryonun yerini alır. Karakterler, kartlar, haritalar ve notlar silinmez.</p>${panel()}</div></div>`;
    document.body.appendChild(ov);
  }

  document.addEventListener("click", async e => {
    const b = e.target.closest("[data-mc]"); if (!b) return;
    const a = b.dataset.mc;
    if (a === "pick") return pick();
    if (a === "close") return $("#mcOv")?.remove();
    if (a === "load") {
      const entry = LIST.find(x => x.id === b.dataset.id); if (!entry) return;
      b.disabled = true; b.textContent = "Kuruluyor…";
      try { await load(entry); $("#mcOv")?.remove(); S.view = "senaryo"; render(); }
      catch (err) { toast("Macera kurulamadı: " + (err.message || "hata")); b.disabled = false; b.textContent = "Masaya kur"; }
    }
  });

  // El notu: hazır macerada sayfa görüntüsü yerine maceranın kendi görseli kullanılır.
  document.addEventListener("click", e => {
    const b = e.target.closest('[data-sc="show"]'); const m = S.scenario?.meta; if (!b || !m?.adventure) return;
    e.stopImmediatePropagation(); const h = (m.handouts || []).find(x => x.id === b.dataset.id); if (!h) return;
    save("handouts", { id: h.id, title: h.title, text: h.text || h.description || "", img: h.img || "", page: null, shownAt: Date.now(), by: ME.id });
    render(); toast("El notu oyunculara gösterildi");
  }, true);

  window.MACERA = { load, list: forSys };
})();
