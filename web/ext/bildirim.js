/* Bildirimler: zil düğmesi, bildirim kutusu, kişilere bildirim/davet gönderme ve bildirim ayarları.
   Üç sayfada da aynı dosya çalışır: ana uygulama (oyun listesi başlığı ve oyunun sol rayı), masa oyunları
   (/oyunlar) ve mobil uygulama (/mobil). Sayfada [data-zm-bildirim-yer] olan her yere bir zil konur.
   Bildirimler data/users/<ben>/bildirim altındadır; yalnızca sunucu yazar (server/bildirim.js), burada
   canlı izlenir. Tarayıcı izin verirse sekme arka plandayken masaüstü bildirimi de gösterilir. */
(function () {
  "use strict";
  if (window.ZM_BILDIRIM) return;
  const Z = window.zmSunucu; if (!Z) return;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const LS = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const SAYFA = location.pathname.startsWith("/oyunlar") ? "oyunlar" : location.pathname.startsWith("/mobil") ? "mobil" : "uygulama";
  const GOMULU = new URLSearchParams(location.search).get("gomulu") === "1";
  if (GOMULU) return; // masaüstündeki sosyal penceresinin içinde ikinci bir zil olmasın

  const st = { liste: new Map(), yuklendi: false, acik: false, sekme: "liste", kisiler: null, secili: new Set(), hedef: "", yazi: "", ara: "", ayar: null, gonderiyor: false };
  const IKON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>`;
  const TUR_IKON = { sira: "🎲", bitti: "🏁", otur: "🪑", davet: "📨", mesaj: "💬", "arkadas-istek": "🤝", "arkadas-kabul": "🤝", "katilma-istek": "🚪", "katilim-onay": "✅", katildi: "🚪" };

  /* ---------------- Görünüm ---------------- */
  const stil = document.createElement("style");
  stil.textContent = `
  .zb-zil{position:relative;display:inline-flex;align-items:center;gap:6px}
  .zb-zil .zb-say{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--bad,#c0392b);color:#fff;font:700 11px/18px var(--f-body,system-ui);text-align:center}
  .zb-zil.ray{flex-direction:column;gap:2px;width:100%}
  .zb-pano{position:fixed;z-index:9000;top:58px;right:12px;width:min(400px,calc(100vw - 24px));max-height:min(72vh,640px);display:flex;flex-direction:column;background:var(--surface,#fff);color:var(--ink,#222);border:1px solid var(--line,#ccc);border-radius:14px;box-shadow:0 18px 48px rgba(0,0,0,.28);font-family:var(--f-body,system-ui)}
  .zb-pano[hidden]{display:none}
  .zb-bas{display:flex;align-items:center;gap:6px;padding:10px 12px;border-bottom:1px solid var(--line,#ccc)}
  .zb-bas h2{margin:0;font-size:16px;flex:1}
  .zb-sek{display:flex;gap:4px;padding:8px 12px 0}
  .zb-sek button{flex:1;border:1px solid var(--line,#ccc);background:var(--surface-2,#f3f3f3);color:var(--ink,#222);border-radius:8px;padding:6px;font:inherit;font-size:13px;cursor:pointer}
  .zb-sek button[aria-pressed=true]{background:var(--accent,#2f8f86);color:var(--accent-ink,#fff);border-color:transparent}
  .zb-govde{overflow:auto;padding:10px 12px 12px;display:flex;flex-direction:column;gap:8px}
  .zb-n{display:flex;gap:10px;align-items:flex-start;padding:9px 10px;border-radius:10px;border:1px solid var(--line,#ccc);background:var(--surface,#fff);cursor:pointer;text-align:left;font:inherit;color:inherit;width:100%}
  .zb-n.yeni{background:var(--accent-soft,#e5f3f1);border-color:var(--accent,#2f8f86)}
  .zb-n .zb-i{font-size:18px;line-height:22px}
  .zb-n .zb-m{flex:1;min-width:0}
  .zb-n b{display:block;font-size:14px}
  .zb-n p{margin:2px 0 0;font-size:13px;color:var(--muted,#666);white-space:pre-wrap;overflow-wrap:anywhere}
  .zb-n small{color:var(--muted,#666);font-size:11px;white-space:nowrap}
  .zb-n .zb-x{border:0;background:none;color:var(--muted,#666);cursor:pointer;font-size:16px;padding:0 2px}
  .zb-bos{color:var(--muted,#666);text-align:center;padding:18px 6px;font-size:14px}
  .zb-alt{display:flex;gap:6px;flex-wrap:wrap}
  .zb-alt button,.zb-form button{font:inherit;font-size:13px}
  .zb-form{display:flex;flex-direction:column;gap:8px;font-size:14px}
  .zb-form input[type=search],.zb-form textarea,.zb-form select{width:100%;box-sizing:border-box;font:inherit;padding:7px 9px;border:1px solid var(--line,#ccc);border-radius:8px;background:var(--surface,#fff);color:var(--ink,#222)}
  .zb-kisiler{max-height:180px;overflow:auto;border:1px solid var(--line,#ccc);border-radius:8px;padding:4px}
  .zb-kisiler label{display:flex;gap:8px;align-items:center;padding:4px 6px;border-radius:6px;cursor:pointer}
  .zb-kisiler label:hover{background:var(--surface-2,#f3f3f3)}
  .zb-kisiler small{color:var(--muted,#666);margin-left:auto;font-size:11px;text-align:right}
  .zb-ayar label{display:flex;gap:8px;align-items:center;padding:4px 0}
  .zb-not{font-size:12px;color:var(--muted,#666);margin:0}
  .zb-tost{position:fixed;z-index:9001;top:14px;right:14px;max-width:min(360px,calc(100vw - 28px));background:var(--surface,#fff);color:var(--ink,#222);border:1px solid var(--accent,#2f8f86);border-left-width:5px;border-radius:10px;padding:10px 12px;box-shadow:0 12px 32px rgba(0,0,0,.25);cursor:pointer;font:14px/1.35 var(--f-body,system-ui)}
  .zb-tost b{display:block}`;
  document.head.appendChild(stil);

  const okunmamis = () => [...st.liste.values()].filter(n => !n.okundu).length;
  function zaman(t) {
    const f = (Date.now() - t) / 1000;
    if (f < 60) return "şimdi"; if (f < 3600) return Math.floor(f / 60) + " dk"; if (f < 86400) return Math.floor(f / 3600) + " sa";
    return new Date(t).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  }

  // Zil düğmeleri: sayfadaki [data-zm-bildirim-yer] yerlerine ve ana uygulamada oyun listesi başlığına, oyun rayına.
  function yerlestir() {
    const yerler = [...document.querySelectorAll("[data-zm-bildirim-yer]")];
    if (SAYFA === "uygulama") {
      const bas = document.querySelector("#lobby .lhead");
      if (bas && !bas.querySelector(".zb-zil")) { const s = document.createElement("span"); s.dataset.zmBildirimYer = ""; bas.insertBefore(s, bas.querySelector('[data-lobby="new"]') || null); yerler.push(s); }
      const ray = document.querySelector("#app .rail");
      if (ray && !window.ZM_MOBIL && !ray.querySelector(".zb-zil")) { const s = document.createElement("span"); s.dataset.zmBildirimYer = "ray"; s.style.display = "contents"; ray.appendChild(s); yerler.push(s); }
    }
    for (const y of yerler) {
      let b = y.querySelector(".zb-zil");
      if (!b) {
        const ray = y.dataset.zmBildirimYer === "ray";
        b = document.createElement("button"); b.type = "button";
        b.className = ray ? "navbtn zb-zil ray" : SAYFA === "mobil" ? "ustbtn zb-zil" : "btn zb-zil";
        b.dataset.zbAc = "1"; b.setAttribute("aria-haspopup", "dialog");
        y.appendChild(b);
      }
      const n = okunmamis(), etiket = SAYFA === "mobil" ? "" : `<span>Bildirimler</span>`;
      b.innerHTML = IKON + etiket + (n ? `<b class="zb-say">${n > 99 ? "99+" : n}</b>` : "");
      b.title = n ? `${n} okunmamış bildirim` : "Bildirimler";
      b.setAttribute("aria-label", b.title);
      b.setAttribute("aria-expanded", String(st.acik));
    }
  }

  let pano = null;
  function panoCiz() {
    if (!pano) {
      pano = document.createElement("div"); pano.className = "zb-pano"; pano.setAttribute("role", "dialog"); pano.setAttribute("aria-label", "Bildirimler");
      document.body.appendChild(pano);
    }
    pano.hidden = !st.acik;
    if (!st.acik) return;
    const odak = document.activeElement && pano.contains(document.activeElement) ? document.activeElement.id : null;
    const sek = [["liste", "Bildirimler"], ["gonder", "Gönder / davet et"], ["ayar", "Ayarlar"]].map(([k, l]) => `<button type="button" data-zb-sek="${k}" aria-pressed="${st.sekme === k}">${l}</button>`).join("");
    pano.innerHTML = `<div class="zb-bas"><h2>Bildirimler</h2><button type="button" class="btn sm" data-zb-kapat aria-label="Kapat">✕</button></div><div class="zb-sek">${sek}</div>
      <div class="zb-govde">${st.sekme === "gonder" ? gonderHtml() : st.sekme === "ayar" ? ayarHtml() : listeHtml()}</div>`;
    if (odak) { const el = pano.querySelector("#" + odak); if (el) { el.focus(); if (el.setSelectionRange && el.value) el.setSelectionRange(el.value.length, el.value.length); } }
  }

  function listeHtml() {
    const l = [...st.liste.values()].sort((a, b) => b.t - a.t);
    if (!st.yuklendi) return `<p class="zb-bos">Yükleniyor…</p>`;
    if (!l.length) return `<p class="zb-bos">Henüz bildirim yok. Bir masa oyununda sıra sana gelince, biri masana oturunca ya da seni bir oyuna çağırınca burada görünür.</p>`;
    return `<div class="zb-alt">${okunmamis() ? `<button type="button" class="btn sm" data-zb-hepsi>Hepsini okundu say</button>` : ""}<button type="button" class="btn sm" data-zb-temizle>Okunanları sil</button></div>`
      + l.map(n => `<div class="zb-n${n.okundu ? "" : " yeni"}" role="button" tabindex="0" data-zb-git="${esc(n.id)}"><span class="zb-i" aria-hidden="true">${TUR_IKON[n.tur] || "🔔"}</span>
        <span class="zb-m"><b data-noi18n>${esc(n.baslik)}</b>${n.metin ? `<p data-noi18n>${esc(n.metin)}</p>` : ""}</span><small>${zaman(n.t)}</small>
        <button type="button" class="zb-x" data-zb-sil="${esc(n.id)}" aria-label="Bildirimi sil" title="Sil">×</button></div>`).join("");
  }

  function gonderHtml() {
    if (!st.kisiler) { kisileriYukle(); return `<p class="zb-bos">Yükleniyor…</p>`; }
    const { kisiler, oyunlar } = st.kisiler;
    if (!kisiler.length) return `<p class="zb-bos">Bildirim gönderebileceğin kimse yok. Arkadaş ekle ya da bir masaya otur; aynı oyunda olduğun kişilere de gönderebilirsin.</p>`;
    const q = st.ara.toLocaleLowerCase("tr");
    const gorunen = kisiler.filter(k => !q || k.ad.toLocaleLowerCase("tr").includes(q) || String(k.neden).toLocaleLowerCase("tr").includes(q));
    return `<form class="zb-form" data-zb-form>
      <label>Kime</label>
      <input type="search" id="zbAra" placeholder="Kişi ya da oyun ara" value="${esc(st.ara)}" aria-label="Kişi ara" autocomplete="off">
      <div class="zb-kisiler" role="group" aria-label="Kişiler">${gorunen.map(k => `<label><input type="checkbox" data-zb-kisi="${esc(k.id)}"${st.secili.has(k.id) ? " checked" : ""}><span data-noi18n>${esc(k.ad)}</span><small data-noi18n>${esc(k.neden)}</small></label>`).join("") || `<p class="zb-not" style="padding:6px">Aramana uyan kimse yok.</p>`}</div>
      <label for="zbHedef">Bir oyuna davet et (isteğe bağlı)</label>
      <select id="zbHedef"><option value="">Davet yok, yalnızca not</option>${oyunlar.map(o => `<option value="${esc(o.tur + ":" + o.id)}"${st.hedef === o.tur + ":" + o.id ? " selected" : ""}>${esc(o.ad)}${o.alt ? " · " + esc(o.alt) : ""}</option>`).join("")}</select>
      <label for="zbYazi">Not</label>
      <textarea id="zbYazi" maxlength="300" rows="3" placeholder="Bu akşam 21.00'de devam edelim mi?">${esc(st.yazi)}</textarea>
      <button class="btn pri" type="submit"${st.gonderiyor || !st.secili.size ? " disabled" : ""}>${st.secili.size ? `${st.secili.size} kişiye gönder` : "Önce kişi seç"}</button>
      <p class="zb-not">Arkadaşlarına ve aynı oyunda ya da masada olduğun kişilere gönderebilirsin. Bildirimi kapatmış olanlara gitmez.</p></form>`;
  }

  function ayarHtml() {
    if (!st.ayar) { ayarYukle(); return `<p class="zb-bos">Yükleniyor…</p>`; }
    const turler = (st.kisiler && st.kisiler.turler) || st.turler || {};
    const masaustu = "Notification" in window;
    return `<div class="zb-form zb-ayar"><p class="zb-not">Hangi bildirimleri almak istiyorsun?</p>
      ${Object.entries(turler).map(([k, ad]) => `<label><input type="checkbox" data-zb-tur="${esc(k)}"${st.ayar.kapali[k] ? "" : " checked"}> ${esc(ad)}</label>`).join("")}
      ${masaustu ? `<p class="zb-not" style="margin-top:8px">Bu cihazda</p><label><input type="checkbox" data-zb-masaustu${LS.get("zm-bildirim-masaustu") === "1" && Notification.permission === "granted" ? " checked" : ""}> Sekme arka plandayken masaüstü bildirimi göster</label>
        ${Notification.permission === "denied" ? `<p class="zb-not">Tarayıcı bu site için bildirimleri engellemiş; adres çubuğundaki site ayarlarından açabilirsin.</p>` : ""}` : ""}</div>`;
  }

  async function kisileriYukle() {
    if (kisileriYukle.bekliyor) return; kisileriYukle.bekliyor = true;
    try { st.kisiler = await Z.call("bildirimKisiler", {}); st.turler = st.kisiler.turler; } catch (e) { st.kisiler = { kisiler: [], oyunlar: [], turler: {} }; tost({ baslik: e.message }); }
    kisileriYukle.bekliyor = false; panoCiz();
  }
  async function ayarYukle() {
    if (ayarYukle.bekliyor) return; ayarYukle.bekliyor = true;
    if (!st.turler) { try { st.kisiler = await Z.call("bildirimKisiler", {}); st.turler = st.kisiler.turler; } catch (e) {} }
    try { const s = await Z.db().doc(`data/users/${Z.me().id}/ayar/bildirim`).get(); const d = s.exists ? s.data() : {}; st.ayar = { kapali: (d && d.kapali) || {} }; }
    catch (e) { st.ayar = { kapali: {} }; }
    ayarYukle.bekliyor = false; panoCiz();
  }

  /* ---------------- Gezinme ---------------- */
  function git(h) {
    if (!h) return;
    if (h.tur === "tahta") {
      if (SAYFA === "oyunlar") location.hash = h.id; else location.href = "/oyunlar#" + encodeURIComponent(h.id);
    } else if (h.tur === "oyun") {
      if (SAYFA === "uygulama" && typeof window.enterGame === "function") { try { if (typeof S !== "undefined" && S.games[h.id]) { window.enterGame(h.id); return; } } catch (e) {} location.href = "/#" + h.id; }
      else location.href = (SAYFA === "mobil" ? "/?mobil=1#" : "/#") + encodeURIComponent(h.id);
    } else if (h.tur === "kisi") {
      if (window.zmProfilAc) window.zmProfilAc(h.id); // ayrı profil sayfası (web/profil)
      else location.href = "/profil?kisi=" + encodeURIComponent(h.id);
    }
  }
  function ac(sekme) { st.acik = true; if (sekme) st.sekme = sekme; if (st.sekme === "gonder") st.kisiler = null; panoCiz(); yerlestir(); }
  function kapat() { st.acik = false; panoCiz(); yerlestir(); }

  /* ---------------- Anlık uyarı (sayfa içi ve masaüstü) ---------------- */
  let tostEl = null;
  function tost(n) {
    if (!tostEl) { tostEl = document.createElement("div"); tostEl.className = "zb-tost"; tostEl.setAttribute("role", "status"); document.body.appendChild(tostEl); tostEl.addEventListener("click", () => { tostEl.hidden = true; if (tostEl._n) { okundu(tostEl._n.id); git(tostEl._n.hedef); } }); }
    tostEl._n = n.id ? n : null;
    tostEl.innerHTML = `<b data-noi18n>${esc(n.baslik)}</b>${n.metin ? `<span data-noi18n>${esc(n.metin)}</span>` : ""}`;
    tostEl.hidden = false; clearTimeout(tost.t); tost.t = setTimeout(() => (tostEl.hidden = true), 5000);
  }
  // Bildirim şu an açık olan masayla ilgiliyse (oyuncu zaten orada) uyarı gösterme, okundu say.
  function burada(n) {
    if (!n.hedef) return false;
    if (n.hedef.tur === "tahta" && SAYFA === "oyunlar") return location.hash.slice(1) === n.hedef.id && !document.hidden;
    if (n.hedef.tur === "oyun" && SAYFA === "uygulama") { try { return typeof G !== "undefined" && G.id === n.hedef.id && !document.hidden; } catch (e) { return false; } }
    return false;
  }
  function yeniGeldi(n) {
    if (n.okundu) return;
    if (burada(n)) { if (n.tur === "sira") okundu(n.id); return; }
    if (!document.hidden) tost(n);
    if (LS.get("zm-bildirim-masaustu") === "1" && "Notification" in window && Notification.permission === "granted" && (document.hidden || !document.hasFocus())) {
      try { const x = new Notification(n.baslik, { body: n.metin || "", tag: n.id, icon: "/mobil/ikon-192.png" }); x.onclick = () => { window.focus(); okundu(n.id); git(n.hedef); x.close(); }; } catch (e) {}
    }
  }
  const okundu = id => Z.call("bildirimOkundu", id ? { bildirim: id } : {}).catch(() => {});

  /* ---------------- Olaylar ---------------- */
  document.addEventListener("click", async e => {
    if (e.target.closest("[data-zb-ac]")) { e.preventDefault(); st.acik ? kapat() : ac(); return; }
    const dav = e.target.closest("[data-zb-davet]");
    if (dav) { e.preventDefault(); st.hedef = dav.dataset.zbDavet; st.yazi = ""; ac("gonder"); return; }
    if (!pano || !pano.contains(e.target)) { if (st.acik && !(tostEl && tostEl.contains(e.target))) kapat(); return; }
    const b = e.target.closest("button,[data-zb-git]"); if (!b) return;
    if (b.dataset.zbKapat !== undefined) return kapat();
    if (b.dataset.zbSek) { st.sekme = b.dataset.zbSek; if (st.sekme === "gonder") st.kisiler = null; return panoCiz(); }
    if (b.dataset.zbHepsi !== undefined) return okundu();
    if (b.dataset.zbTemizle !== undefined) return Z.call("bildirimSil", {}).catch(err => tost({ baslik: err.message }));
    if (b.dataset.zbSil) { e.stopPropagation(); return Z.call("bildirimSil", { bildirim: b.dataset.zbSil }).catch(() => {}); }
    if (b.dataset.zbGit) { const n = st.liste.get(b.dataset.zbGit); if (!n) return; if (!n.okundu) okundu(n.id); kapat(); git(n.hedef); }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && st.acik) kapat();
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("[data-zb-git]")) { e.preventDefault(); e.target.click(); }
  });
  document.addEventListener("input", e => {
    if (!pano || !pano.contains(e.target)) return;
    if (e.target.id === "zbAra") { st.ara = e.target.value; panoCiz(); }
    if (e.target.id === "zbYazi") st.yazi = e.target.value;
  });
  document.addEventListener("change", async e => {
    if (!pano || !pano.contains(e.target)) return;
    const t = e.target;
    if (t.dataset.zbKisi) { t.checked ? st.secili.add(t.dataset.zbKisi) : st.secili.delete(t.dataset.zbKisi); panoCiz(); return; }
    if (t.id === "zbHedef") { st.hedef = t.value; return; }
    if (t.dataset.zbTur) {
      st.ayar.kapali[t.dataset.zbTur] = !t.checked; if (t.checked) delete st.ayar.kapali[t.dataset.zbTur];
      try { await Z.db().doc(`data/users/${Z.me().id}/ayar/bildirim`).set({ kapali: st.ayar.kapali }); } catch (err) { tost({ baslik: err.message }); }
      return;
    }
    if (t.dataset.zbMasaustu !== undefined) {
      if (t.checked) {
        const izin = Notification.permission === "granted" ? "granted" : await Notification.requestPermission().catch(() => "denied");
        LS.set("zm-bildirim-masaustu", izin === "granted" ? "1" : "0");
      } else LS.set("zm-bildirim-masaustu", "0");
      panoCiz();
    }
  });
  document.addEventListener("submit", async e => {
    if (!e.target.matches("[data-zb-form]")) return;
    e.preventDefault();
    const [tur, id] = st.hedef ? st.hedef.split(":") : [];
    st.gonderiyor = true; panoCiz();
    try {
      const r = await Z.call("bildirimGonder", { kime: [...st.secili], metin: st.yazi, hedef: tur ? { tur, id } : null });
      tost({ baslik: r.gonderilen ? `${r.gonderilen} kişiye gönderildi` : "Gönderilemedi", metin: r.kapali ? `${r.kapali} kişi bu tür bildirimleri kapatmış` : "" });
      st.secili.clear(); st.yazi = ""; st.hedef = ""; st.sekme = "liste";
    } catch (err) { tost({ baslik: err.message }); }
    st.gonderiyor = false; panoCiz(); yerlestir();
  });

  /* ---------------- Başlangıç ---------------- */
  // Ana uygulama her çizimde başlığı yeniden kurar; zil yeniden yerleşsin.
  if (SAYFA === "uygulama" && typeof window.render === "function") {
    const _render = window.render;
    window.render = function () { const r = _render.apply(this, arguments); try { yerlestir(); } catch (e) { console.error(e); } return r; };
  }
  Z.ready.then(() => {
    const me = Z.me(); if (!me || !me.id) return;
    yerlestir();
    let ilk = true;
    Z.db().collection(`data/users/${me.id}/bildirim`).onSnapshot(s => {
      for (const c of s.docChanges()) {
        if (c.type === "removed") { st.liste.delete(c.doc.id); continue; }
        const n = c.doc.data(), eski = st.liste.get(c.doc.id);
        st.liste.set(c.doc.id, n);
        // Yeni bildirim ya da üstüne yazılan (ör. yeniden sıra sende) okunmamış bildirim.
        if (!ilk && !n.okundu && (!eski || eski.t !== n.t)) yeniGeldi(n);
      }
      ilk = false; st.yuklendi = true;
      yerlestir(); if (st.acik) panoCiz();
    }, () => {});
    // Masa oyunları sayfasında açık masa değişince o masanın "sıra sende" bildirimi okundu sayılsın.
    window.addEventListener("hashchange", () => { for (const n of st.liste.values()) if (!n.okundu && burada(n) && n.tur === "sira") okundu(n.id); });
  }).catch(() => {});

  window.ZM_BILDIRIM = { ac, kapat, yerlestir, davet: (tur, id) => { st.hedef = tur + ":" + id; ac("gonder"); } };
})();
