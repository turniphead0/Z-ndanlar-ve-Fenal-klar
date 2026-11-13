/* Zar Masası mobil uygulaması: forum, özel mesajlar, arkadaşlar, profil, masalar ve zar.
   Sunucuya /shim.js üzerinden bağlanır (giriş ekranı, yeniden bağlanma, db aboneliği oradadır).
   Karakter kağıtları ve masa sohbeti için oyun, haritasız mobil görünümde açılır (/?mobil=1#<oyun>).
   ?gomulu=1 ile masaüstü uygulamasının içinde yalnızca mesajlar, gruplar, arkadaşlar ve profil gösterilir. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const LS = { get: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const GOMULU = new URLSearchParams(location.search).get("gomulu") === "1";
  const UYGULAMA = /ZarMasasiApp/.test(navigator.userAgent); // Android uygulaması
  const Z = window.zmSunucu;
  const SISTEM = { dnd5e: "D&D 5e", coc7: "CoC 7e", yze: "YZE", pf2e: "PF2e", motw: "MotW" };
  const RENKLER = ["#2f8f86", "#c0392b", "#8e44ad", "#2980b9", "#d4880f", "#27ae60", "#d35400", "#7f8c8d"];

  let DB = null, ME = null, INFO = { forum: [] };
  const st = { konusma: new Map(), arkadas: new Map(), forum: new Map(), oyunlar: new Map(), prof: {}, profBekle: new Set() };
  const ui = { forumKat: "Hepsi", forumQ: "", zarAdv: 0, zarMasa: LS.get("zm-m-zarmasa", ""), sil: null };
  let ekranKapat = []; // açık ekranın abonelikleri

  /* ---------------- Yardımcılar ---------------- */
  function tost(t) { const el = $("#tost"); el.textContent = t; el.hidden = false; clearTimeout(tost.t); tost.t = setTimeout(() => (el.hidden = true), 2600); }
  const hataGoster = e => tost((e && e.message) || "Bir şey ters gitti");
  const cagir = (op, a) => Z.call(op, a).catch(e => { hataGoster(e); throw e; });
  function zaman(t) {
    if (!t) return ""; const d = new Date(t), now = new Date(), fark = (now - d) / 1000;
    if (fark < 60) return "şimdi";
    if (fark < 3600) return Math.floor(fark / 60) + " dk";
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    const dun = new Date(now); dun.setDate(now.getDate() - 1);
    if (d.toDateString() === dun.toDateString()) return "dün";
    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
  }
  const saat = t => new Date(t).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  const gunAdi = t => { const d = new Date(t), n = new Date(); if (d.toDateString() === n.toDateString()) return "Bugün"; const y = new Date(n); y.setDate(n.getDate() - 1); if (d.toDateString() === y.toDateString()) return "Dün"; return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }); };
  const kucukHarf = s => String(s || "").toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
  const resimMi = u => /^\/assets\/[a-z0-9]+\.(gif|webp|png|jpg)$/.test(u || "");

  // Profil önbelleği: ad, renk, fotoğraf, çevrimiçi.
  function prof(id) {
    if (!id) return { ad: "?", renk: "#7f8c8d" };
    if (ME && id === ME.id) return { ad: ME.kullanici || ME.name, renk: ME.color, foto: ME.foto, kullanici: ME.kullanici, cevrimici: true };
    if (!st.prof[id]) { st.prof[id] = { ad: "…", renk: "#7f8c8d" }; st.profBekle.add(id); profYukle(); }
    return st.prof[id];
  }
  function profYukle(zorla) {
    clearTimeout(profYukle.t);
    profYukle.t = setTimeout(async () => {
      const ids = zorla ? Object.keys(st.prof) : [...st.profBekle]; st.profBekle.clear();
      if (!ids.length) return;
      try {
        const r = await Z.call("profiles", { ids });
        for (const [id, p] of Object.entries(r)) st.prof[id] = { ad: p.kullanici || p.name || "Oyuncu", renk: p.color || "#7f8c8d", foto: p.foto, kullanici: p.kullanici, cevrimici: p.cevrimici };
        yenile();
      } catch (e) {}
    }, 30);
  }
  function av(id, boy, p) {
    p = p || prof(id);
    const ilk = esc((p.ad || "?").trim().charAt(0).toLocaleUpperCase("tr"));
    return `<span class="av ${boy || ""}" style="background:${esc(p.renk || "#7f8c8d")}" aria-hidden="true">${p.foto ? `<img src="${esc(p.foto)}" alt="" loading="lazy">` : ilk}${p.cevrimici && id !== (ME && ME.id) && boy !== "b" ? '<i class="on"></i>' : ""}</span>`;
  }
  // İki dokunuşlu onay: ilk dokunuşta düğme "Emin misin?" olur.
  function onayli(btn, fn) {
    if (btn.dataset.onay === "1") { btn.dataset.onay = ""; fn(); return; }
    const eski = btn.textContent; btn.dataset.onay = "1"; btn.textContent = "Emin misin?";
    setTimeout(() => { if (btn.isConnected && btn.dataset.onay === "1") { btn.dataset.onay = ""; btn.textContent = eski; } }, 3000);
  }
  // Fotoğrafı yüklemeden önce küçült (veri ve depolama tasarrufu).
  async function kucult(file, max, kare) {
    if (!/^image\//.test(file.type)) throw new Error("Bir resim seç");
    let img;
    try { img = await createImageBitmap(file); }
    catch (e) { img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Resim açılamadı")); i.src = URL.createObjectURL(file); }); }
    let sw = img.width, sh = img.height, sx = 0, sy = 0;
    if (kare) { const k = Math.min(sw, sh); sx = (sw - k) / 2; sy = (sh - k) / 2; sw = sh = k; }
    const o = Math.min(1, max / Math.max(sw, sh)), cv = document.createElement("canvas");
    cv.width = Math.round(sw * o); cv.height = Math.round(sh * o);
    cv.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
    const blob = await new Promise(r => cv.toBlob(r, "image/jpeg", 0.85));
    return new File([blob], "foto.jpg", { type: "image/jpeg" });
  }
  function dosyaSec() {
    return new Promise(res => { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; i.onchange = () => res(i.files[0] || null); i.click(); });
  }

  /* ---------------- Yönlendirme ---------------- */
  const SEKMELER = GOMULU ? ["mesajlar", "arkadaslar"] : ["forum", "mesajlar", "arkadaslar", "masalar", "zar"];
  const ANA = GOMULU ? "mesajlar" : "forum";
  function rota() { const h = decodeURIComponent(location.hash.slice(1)); const [ad, ...rest] = h.split("/"); return { ad: ad || ANA, arg: rest.join("/") }; }
  const ALT = { "forum-konu": "forum", "forum-yeni": "forum", mesaj: "mesajlar", grup: "mesajlar", "grup-yeni": "mesajlar", "grup-bilgi": "mesajlar", kisi: null, profil: null };
  let sonRota = "";
  function git(force) {
    const r = rota(), key = r.ad + "/" + r.arg;
    if (!force && key === sonRota) return yenile();
    sonRota = key;
    for (const f of ekranKapat) try { f(); } catch (e) {}
    ekranKapat = []; ui.sil = null;
    const sek = SEKMELER.includes(r.ad) ? r.ad : ALT[r.ad];
    document.querySelectorAll("#alt [data-sek]").forEach(a => a.setAttribute("aria-current", a.dataset.sek === sek ? "page" : "false"));
    $("#geri").hidden = SEKMELER.includes(r.ad) || r.ad === ANA;
    $("#ekran").classList.toggle("sohbetekran", r.ad === "mesaj" || r.ad === "grup");
    $("#ekran").scrollTop = 0;
    (EKRAN[r.ad] || EKRAN[ANA])(r.arg, true);
  }
  function yenile() { const r = rota(); (EKRAN[r.ad] || EKRAN[ANA])(r.arg, false); rozetler(); }
  const baslik = t => { $("#baslik").textContent = t; document.title = t + " · Zar Masası"; };
  const ekran = html => { $("#ekran").innerHTML = html; };
  $("#geri").addEventListener("click", () => { if (history.length > 1 && sonRota) history.back(); else location.hash = ANA; });

  function rozetler() {
    let m = 0; for (const k of st.konusma.values()) m += k.okunmamis || 0;
    let a = 0; for (const k of st.arkadas.values()) if (k.durum === "gelen") a++;
    const rm = $("#rMesaj"), ra = $("#rArk");
    rm.hidden = !m; rm.textContent = m > 99 ? "99+" : m; ra.hidden = !a; ra.textContent = a;
    $("#benbtn").innerHTML = ME ? av(ME.id, "k") : "";
    if (GOMULU && parent !== window) parent.postMessage({ zm: "sosyal-rozet", mesaj: m, istek: a }, location.origin);
  }

  /* ---------------- Ekranlar ---------------- */
  const EKRAN = {};

  // ---- Forum ----
  EKRAN.forum = (arg, ilk) => {
    baslik("Forum");
    if (ilk) {
      ekran(`<div class="ara"><input class="f" type="search" id="fq" placeholder="Forumda ara" value="${esc(ui.forumQ)}" aria-label="Forumda ara"></div>
        <div class="cipler" id="fkat"></div>
        <a class="btn pri tam" href="#forum-yeni">+ Yeni konu aç</a>
        <ul class="liste" id="fliste" style="margin-top:12px"></ul>`);
      $("#fq").addEventListener("input", e => { ui.forumQ = e.target.value; forumListe(); });
    }
    $("#fkat").innerHTML = ["Hepsi", ...(INFO.forum || [])].map(k => `<button class="cip" data-a="fkat" data-k="${esc(k)}" aria-pressed="${ui.forumKat === k}">${esc(k)}</button>`).join("");
    forumListe();
  };
  function forumListe() {
    const el = $("#fliste"); if (!el) return;
    const q = kucukHarf(ui.forumQ.trim());
    const liste = [...st.forum.entries()].map(([id, t]) => ({ id, ...t }))
      .filter(t => ui.forumKat === "Hepsi" || t.kategori === ui.forumKat)
      .filter(t => !q || kucukHarf(t.baslik + " " + t.govde + " " + (t.yazar && t.yazar.name)).includes(q))
      .sort((a, b) => (b.sabit - a.sabit) || (b.updated || 0) - (a.updated || 0));
    el.innerHTML = liste.length ? liste.map(t => `<li><a class="konu" href="#forum-konu/${esc(t.id)}">
        <h3>${t.sabit ? "📌 " : ""}${esc(t.baslik)}</h3>${t.govde ? `<p>${esc(t.govde)}</p>` : ""}
        <div class="alt2"><span class="rozetk">${esc(t.kategori)}</span>${t.sistem && SISTEM[t.sistem] ? `<span class="rozetk altin">${esc(SISTEM[t.sistem])}</span>` : ""}<span>${esc((t.yazar && t.yazar.name) || "")}</span><span>· ${t.yanit || 0} yanıt</span><span>· ${zaman(t.updated)}</span></div></a></li>`).join("")
      : `<li class="bos"><h2>${st.forum.size ? "Sonuç yok" : "Henüz konu yok"}</h2><p>${st.forum.size ? "Başka bir kelime ya da kategori dene." : "İlk konuyu sen aç."}</p></li>`;
  }

  EKRAN["forum-yeni"] = (arg, ilk) => {
    baslik("Yeni konu");
    if (!ilk) return;
    ekran(`<form class="form" id="fyeni">
      <label><span class="lbl">Başlık</span><input class="f" name="baslik" maxlength="120" required></label>
      <label><span class="lbl">Kategori</span><select class="f" name="kategori">${(INFO.forum || []).map(k => `<option>${esc(k)}</option>`).join("")}</select></label>
      <label><span class="lbl">Oyun sistemi (isteğe bağlı)</span><select class="f" name="sistem"><option value="">Yok</option>${Object.entries(SISTEM).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select></label>
      <label><span class="lbl">Mesaj</span><textarea class="f" name="govde" maxlength="4000" rows="6"></textarea></label>
      <button class="btn pri tam">Konuyu aç</button></form>`);
    $("#fyeni").addEventListener("submit", async e => {
      e.preventDefault(); const f = e.target, b = f.querySelector("button"); b.disabled = true;
      try { const r = await cagir("forumTopic", { title: f.baslik.value, body: f.govde.value, kategori: f.kategori.value, sistem: f.sistem.value || null }); location.replace("#forum-konu/" + r.id); }
      catch (x) { b.disabled = false; }
    });
  };

  EKRAN["forum-konu"] = (tid, ilk) => {
    const t = st.forum.get(tid);
    baslik(t ? t.baslik : "Konu");
    if (ilk) {
      ekran(`<div id="konu"></div><ul class="liste" id="yanitlar" style="margin-top:10px"></ul>
        <form class="form" id="yanitf" style="margin-top:14px"><label><span class="lbl">Yanıt yaz</span><textarea class="f" name="govde" maxlength="4000" rows="3" required></textarea></label><button class="btn pri tam">Gönder</button></form>`);
      const yan = new Map();
      ekranKapat.push(DB.collection(`forum/${tid}/yanitlar`).onSnapshot(s => { for (const c of s.docChanges()) c.type === "removed" ? yan.delete(c.doc.id) : yan.set(c.doc.id, c.doc.data()); EKRAN["forum-konu"].yan = yan; yanitCiz(tid); }, () => {}));
      $("#yanitf").addEventListener("submit", async e => {
        e.preventDefault(); const f = e.target, b = f.querySelector("button"); b.disabled = true;
        try { await cagir("forumReply", { topic: tid, body: f.govde.value }); f.reset(); } catch (x) {}
        b.disabled = false;
      });
    }
    const el = $("#konu"); if (!el) return;
    if (!t) { el.innerHTML = st.forum.size ? `<div class="bos"><h2>Bu konu silinmiş</h2></div>` : ""; $("#yanitf").hidden = !!st.forum.size; return; }
    const benim = t.yazar && t.yazar.id === ME.id, yetki = benim || Z.isOwner();
    el.innerHTML = `<article class="ileti ilk"><h2>${t.sabit ? "📌 " : ""}${esc(t.baslik)}</h2>
      <div class="kim"><a href="#kisi/${esc(t.yazar.id)}">${av(t.yazar.id, "k")}</a><div><b>${esc(t.yazar.name)}</b><div class="zaman">${zaman(t.created)} · ${esc(t.kategori)}</div></div></div>
      ${t.govde ? `<div class="govde">${esc(t.govde)}</div>` : ""}
      ${yetki ? `<div class="dugmeler" style="margin-top:10px">${Z.isOwner() ? `<button class="btn sm" data-a="fsabit" data-t="${esc(tid)}">${t.sabit ? "Sabitlemeyi kaldır" : "Sabitle"}</button>` : ""}<button class="btn sm kotu" data-a="fsil" data-t="${esc(tid)}">Konuyu sil</button></div>` : ""}</article>`;
  };
  function yanitCiz(tid) {
    const el = $("#yanitlar"), yan = EKRAN["forum-konu"].yan; if (!el || !yan) return;
    const l = [...yan.entries()].map(([id, p]) => ({ id, ...p })).sort((a, b) => a.created - b.created);
    el.innerHTML = l.map(p => `<li class="ileti"><div class="kim"><a href="#kisi/${esc(p.yazar.id)}">${av(p.yazar.id, "k")}</a><div><b>${esc(p.yazar.name)}</b><div class="zaman">${zaman(p.created)}</div></div><span class="sp"></span>
      ${p.yazar.id === ME.id || Z.isOwner() ? `<button class="btn sm kotu" data-a="fysil" data-t="${esc(tid)}" data-p="${esc(p.id)}">Sil</button>` : ""}</div><div class="govde">${esc(p.govde)}</div></li>`).join("");
  }

  // ---- Mesajlar ----
  EKRAN.mesajlar = () => {
    baslik("Mesajlar");
    const l = [...st.konusma.entries()].map(([id, k]) => ({ id, ...k })).sort((a, b) => b.t - a.t);
    const ust = `<div class="dugmeler" style="margin-bottom:12px"><a class="btn pri" href="#grup-yeni">+ Yeni grup</a><a class="btn" href="#arkadaslar">Arkadaşlar</a></div>`;
    ekran(ust + (l.length ? `<ul class="liste">${l.map(k => { const g = k.grup, p = g ? null : prof(k.id); return `<li><a class="satir ${k.okunmamis ? "yeni" : ""}" href="#${g ? "grup" : "mesaj"}/${esc(k.id)}">${g ? grupAv(k.ad) : av(k.id)}<span class="ic"><b>${esc(g ? k.ad : p.ad)}</b><small>${g ? esc(k.uye || "") + " kişi · " : k.benden ? "Sen: " : ""}${esc(k.son)}</small></span><span style="display:grid;justify-items:end;gap:4px"><span class="zaman">${zaman(k.t)}</span>${k.okunmamis ? `<b class="rozet" style="position:static">${k.okunmamis}</b>` : ""}</span></a></li>`; }).join("")}</ul>
      <p class="ipucu">Yeni bir konuşma başlatmak için <a href="#arkadaslar">Arkadaşlar</a> sekmesinden birini seç ya da birkaç arkadaşınla grup kur.</p>`
      : `<div class="bos"><h2>Henüz mesaj yok</h2><p>Arkadaşlarına buradan oyun dışında yazabilir, birkaç arkadaşınla sohbet grubu kurabilirsin.</p></div>`));
  };
  function grupAv(ad, boy) {
    const ilk = esc(String(ad || "?").trim().charAt(0).toLocaleUpperCase("tr"));
    return `<span class="av grupav ${boy || ""}" aria-hidden="true">${ilk}</span>`;
  }

  // Ortak sohbet ekranı (özel mesaj ve grup): yazma kutusu, ileti akışı, fotoğraf.
  function sohbetKur(col, gonder) {
    ekran(`<a class="satir" style="min-height:0;margin-bottom:8px" id="mkisi"></a><div class="akis" id="akis"></div>
        <form class="yaz" id="yazf"><button type="button" class="yuvarlak" data-a="dmfoto" aria-label="Fotoğraf gönder"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/></svg></button>
        <textarea class="f" name="m" rows="1" maxlength="2000" placeholder="Mesaj yaz" aria-label="Mesaj"></textarea>
        <button class="yuvarlak pri" aria-label="Gönder"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12l16-8-6 16-3-6z"/></svg></button></form>`);
    const msj = new Map(); sohbetKur.msj = msj; sohbetKur.gonder = gonder; akisCiz.ilk = false;
    ekranKapat.push(DB.collection(col).onSnapshot(s => {
      for (const c of s.docChanges()) c.type === "removed" ? msj.delete(c.doc.id) : msj.set(c.doc.id, c.doc.data());
      akisCiz();
    }, () => {}));
    const f = $("#yazf"), ta = f.m;
    ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(140, ta.scrollHeight) + "px"; });
    ta.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && matchMedia("(pointer:fine)").matches) { e.preventDefault(); f.requestSubmit(); } });
    f.addEventListener("submit", async e => {
      e.preventDefault(); const text = ta.value.trim(); if (!text) return;
      ta.value = ""; ta.style.height = "auto";
      try { await gonder({ text }); } catch (x) { ta.value = text; }
    });
  }

  EKRAN.mesaj = (uid, ilk) => {
    const p = prof(uid), ark = (st.arkadas.get(uid) || {}).durum === "arkadas";
    baslik(p.ad);
    if (ilk) sohbetKur(`data/users/${ME.id}/dm/${uid}`, a => cagir("dmGonder", { to: uid, ...a }));
    const mk = $("#mkisi"); mk.href = "#kisi/" + uid;
    mk.innerHTML = `${av(uid, "k")}<span class="ic"><b>${esc(p.ad)}</b><small>${p.cevrimici ? "Çevrimiçi" : "Profili gör"}</small></span>`;
    const f = $("#yazf");
    if (f) { f.querySelectorAll("textarea,button").forEach(x => (x.disabled = !ark)); f.m.placeholder = ark ? "Mesaj yaz" : "Mesaj için arkadaş olmalısınız"; }
    okundu();
  };
  function okundu() {
    const id = rota().arg, k = st.konusma.get(id);
    if (k && k.okunmamis && !document.hidden) Z.call("dmOkundu", { kisi: id }).catch(() => {});
  }
  function akisCiz() {
    const el = $("#akis"), msj = sohbetKur.msj; if (!el || !msj) return;
    const grup = rota().ad === "grup";
    const sc = $("#ekran"), altta = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 80;
    const l = [...msj.values()].sort((a, b) => a.t - b.t); let gun = "", onceki = null;
    el.innerHTML = l.length ? l.map(m => { const g = gunAdi(m.t), ust = g !== gun ? `<div class="gun">${esc(g)}</div>` : ""; if (ust) onceki = null; gun = g;
      if (m.sistem) { onceki = null; return ust + `<div class="gun sis">${esc(m.text)}</div>`; }
      const ben = m.by === ME.id, ad = grup && !ben && onceki !== m.by ? `<b class="kimden" style="color:${esc(prof(m.by).renk)}">${esc(prof(m.by).ad)}</b>` : "";
      onceki = m.by;
      return ust + `<div class="balon ${ben ? "ben" : ""}">${ad}${resimMi(m.resim) ? `<a href="${esc(m.resim)}" target="_blank" rel="noopener"><img src="${esc(m.resim)}" alt="Fotoğraf" loading="lazy"></a>` : ""}${esc(m.text)}<small>${saat(m.t)}</small></div>`; }).join("")
      : `<div class="bos"><p>İlk mesajı sen yaz.</p></div>`;
    if (altta || !akisCiz.ilk) { sc.scrollTop = sc.scrollHeight; akisCiz.ilk = true; }
    okundu();
  }

  // ---- Sohbet grupları ----
  EKRAN.grup = (gid, ilk) => {
    const k = st.konusma.get(gid);
    baslik(k ? k.ad : "Grup");
    if (ilk) sohbetKur(`data/users/${ME.id}/grup/${gid}`, a => cagir("grupMesaj", { grup: gid, ...a }));
    const mk = $("#mkisi"); mk.href = "#grup-bilgi/" + gid;
    mk.innerHTML = `${grupAv(k && k.ad, "k")}<span class="ic"><b>${esc(k ? k.ad : "Grup")}</b><small>${k ? esc(k.uye || "") + " kişi · " : ""}Üyeler ve ayarlar</small></span>`;
    const f = $("#yazf");
    if (f && st.yuklendi) { const var_ = !!k; f.querySelectorAll("textarea,button").forEach(x => (x.disabled = !var_)); f.m.placeholder = var_ ? "Gruba yaz" : "Bu grupta değilsin"; }
    okundu();
  };

  EKRAN["grup-yeni"] = (arg, ilk) => {
    baslik("Yeni grup");
    if (!ilk) return;
    const ark = [...st.arkadas.entries()].filter(([, a]) => a.durum === "arkadas").map(([id]) => id).sort((a, b) => prof(a).ad.localeCompare(prof(b).ad, "tr"));
    if (!ark.length) return ekran(`<div class="bos"><h2>Önce arkadaş ekle</h2><p>Gruba yalnızca arkadaşlarını ekleyebilirsin.</p><a class="btn pri" href="#arkadaslar">Arkadaşlara git</a></div>`);
    ekran(`<form class="form" id="gyeni">
      <label><span class="lbl">Grubun adı</span><input class="f" name="ad" maxlength="60" required placeholder="Örneğin: Cuma masası"></label>
      <span class="lbl">Kimler olsun?</span>
      <ul class="liste">${ark.map(id => `<li><label class="satir secim">${av(id)}<span class="ic"><b>${esc(prof(id).ad)}</b></span><input type="checkbox" name="u" value="${esc(id)}"></label></li>`).join("")}</ul>
      <button class="btn pri tam">Grubu kur</button></form>`);
    $("#gyeni").addEventListener("submit", async e => {
      e.preventDefault(); const f = e.target, b = f.querySelector("button.pri");
      const uyeler = [...f.querySelectorAll("input[name=u]:checked")].map(x => x.value);
      if (!uyeler.length) return tost("En az bir arkadaşını seç");
      b.disabled = true;
      try { const r = await cagir("grupKur", { ad: f.ad.value, uyeler }); location.replace("#grup/" + r.id); } catch (x) { b.disabled = false; }
    });
  };

  EKRAN["grup-bilgi"] = async (gid, ilk) => {
    if (!ilk && document.activeElement && document.activeElement.closest("#gad")) return; // ad yazılırken bozma
    const k = st.konusma.get(gid);
    baslik(k ? k.ad : "Grup");
    if (ilk) ekran(`<div id="gbilgi"><div class="bos">Yükleniyor…</div></div>`);
    let g; try { g = await Z.call("grupBilgi", { grup: gid }); } catch (e) { if ($("#gbilgi")) $("#gbilgi").innerHTML = `<div class="bos"><h2>Bu grupta değilsin</h2><a class="btn" href="#mesajlar">Mesajlara dön</a></div>`; return; }
    const el = $("#gbilgi"); if (!el || rota().arg !== gid) return;
    for (const u of g.uyeler) st.prof[u.id] = { ...(st.prof[u.id] || {}), ad: u.kullanici || u.ad, renk: u.renk, foto: u.foto, kullanici: u.kullanici };
    const sahip = g.sahip === ME.id, uyeIds = new Set(g.uyeler.map(u => u.id));
    const eklenebilir = [...st.arkadas.entries()].filter(([id, a]) => a.durum === "arkadas" && !uyeIds.has(id)).map(([id]) => id);
    const acik = el.querySelector("details[open]") ? true : false;
    el.innerHTML = `<div class="profil">${grupAv(g.ad, "b")}<h2>${esc(g.ad)}</h2><p class="ipucu">${g.uyeler.length} kişi · ${new Date(g.created).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</p>
      <div class="dugmeler" style="justify-content:center"><a class="btn pri" href="#grup/${esc(gid)}">Sohbete dön</a></div></div>
      <form class="form" id="gad"><label><span class="lbl">Grubun adı</span><span style="display:flex;gap:8px"><input class="f" name="ad" maxlength="60" value="${esc(g.ad)}" required><button class="btn">Kaydet</button></span></label></form>
      <h2 class="bolum">Üyeler</h2>
      <ul class="liste">${g.uyeler.map(u => `<li><div class="satir"><a href="#kisi/${esc(u.id)}" style="display:contents;color:inherit;text-decoration:none">${av(u.id)}<span class="ic"><b>${esc(u.kullanici || u.ad)}${u.id === ME.id ? " (sen)" : ""}</b><small>${u.id === g.sahip ? "Grubu kuran" : ""}</small></span></a>${sahip && u.id !== ME.id ? `<button class="btn sm" data-a="gcikar" data-g="${esc(gid)}" data-k="${esc(u.id)}">Çıkar</button>` : u.arkadas && u.arkadas !== "ben" && u.arkadas !== "arkadas" ? arkDugme(u.id, u.arkadas) : ""}</div></li>`).join("")}</ul>
      <details class="ekle"${acik ? " open" : ""}><summary class="btn tam">+ Arkadaşını ekle</summary>
        ${eklenebilir.length ? `<ul class="liste" style="margin-top:8px">${eklenebilir.map(id => `<li><div class="satir">${av(id)}<span class="ic"><b>${esc(prof(id).ad)}</b></span><button class="btn sm pri" data-a="gekle" data-g="${esc(gid)}" data-k="${esc(id)}">Ekle</button></div></li>`).join("")}</ul>` : `<p class="ipucu">Eklenecek arkadaşın kalmadı.</p>`}</details>
      <div class="form" style="margin-top:18px"><button class="btn kotu tam" data-a="gcik" data-g="${esc(gid)}">Gruptan ayrıl</button></div>`;
    $("#gad").addEventListener("submit", async e => { e.preventDefault(); await cagir("grupAdi", { grup: gid, ad: e.target.ad.value }); tost("Grubun adı değişti"); EKRAN["grup-bilgi"](gid, false); });
  };

  // ---- Arkadaşlar ----
  EKRAN.arkadaslar = (arg, ilk) => {
    baslik("Arkadaşlar");
    if (ilk) {
      ekran(`<div class="ara"><input class="f" type="search" id="kq" placeholder="Kullanıcı adıyla ara" autocapitalize="none" aria-label="Kullanıcı ara"></div><ul class="liste" id="kara"></ul><div id="ark"></div>`);
      $("#kq").addEventListener("input", e => { clearTimeout(EKRAN.arkadaslar.t); const q = e.target.value.trim(); EKRAN.arkadaslar.t = setTimeout(() => kisiAra(q), 250); });
      profYukle(true); // çevrimiçi durumunu tazele
    }
    const g = { gelen: [], arkadas: [], giden: [] };
    for (const [id, a] of st.arkadas) if (g[a.durum]) g[a.durum].push(id);
    g.arkadas.sort((a, b) => (prof(b).cevrimici - prof(a).cevrimici) || prof(a).ad.localeCompare(prof(b).ad, "tr"));
    const satir = (id, sag) => `<li><div class="satir"><a href="#kisi/${esc(id)}" style="display:contents;color:inherit;text-decoration:none">${av(id)}<span class="ic"><b>${esc(prof(id).ad)}</b><small>${prof(id).cevrimici ? "Çevrimiçi" : ""}</small></span></a>${sag}</div></li>`;
    $("#ark").innerHTML = (g.gelen.length ? `<h2 class="bolum">Arkadaşlık istekleri</h2><ul class="liste">${g.gelen.map(id => satir(id, `<button class="btn sm pri" data-a="kabul" data-k="${esc(id)}">Kabul</button><button class="btn sm" data-a="reddet" data-k="${esc(id)}">Reddet</button>`)).join("")}</ul>` : "")
      + `<h2 class="bolum">Arkadaşların (${g.arkadas.length})</h2>`
      + (g.arkadas.length ? `<ul class="liste">${g.arkadas.map(id => satir(id, `<a class="btn sm" href="#mesaj/${esc(id)}">Mesaj</a>`)).join("")}</ul>` : `<p class="ipucu">Henüz arkadaşın yok. Yukarıdan kullanıcı adıyla arayıp ekleyebilirsin.</p>`)
      + (g.giden.length ? `<h2 class="bolum">Gönderdiğin istekler</h2><ul class="liste">${g.giden.map(id => satir(id, `<button class="btn sm" data-a="reddet" data-k="${esc(id)}">Geri çek</button>`)).join("")}</ul>` : "");
  };
  async function kisiAra(q) {
    const el = $("#kara"); if (!el) return;
    if (!q) { el.innerHTML = ""; return; }
    let r = []; try { r = await Z.call("kisiAra", { q }); } catch (e) { hataGoster(e); }
    for (const p of r) st.prof[p.id] = { ad: p.kullanici, renk: p.renk, foto: p.foto, kullanici: p.kullanici, cevrimici: (st.prof[p.id] || {}).cevrimici };
    if (!$("#kara") || $("#kq").value.trim() !== q) return;
    el.innerHTML = r.length ? r.map(p => `<li><div class="satir"><a href="#kisi/${esc(p.id)}" style="display:contents;color:inherit;text-decoration:none">${av(p.id)}<span class="ic"><b>${esc(p.kullanici)}</b></span></a>${arkDugme(p.id, (st.arkadas.get(p.id) || {}).durum)}</div></li>`).join("") + `<li><hr style="border:0;border-top:1px solid var(--line);margin:6px 0"></li>`
      : `<li class="ipucu">“${esc(q)}” adında kimse yok.</li>`;
  }
  function arkDugme(id, d) {
    if (d === "arkadas") return `<a class="btn sm" href="#mesaj/${esc(id)}">Mesaj</a>`;
    if (d === "giden") return `<button class="btn sm" data-a="reddet" data-k="${esc(id)}">İstek gönderildi · Geri çek</button>`;
    if (d === "gelen") return `<button class="btn sm pri" data-a="kabul" data-k="${esc(id)}">Kabul et</button>`;
    return `<button class="btn sm pri" data-a="ekle" data-k="${esc(id)}">+ Ekle</button>`;
  }

  // ---- Başkasının profili ----
  EKRAN.kisi = async (uid, ilk) => {
    if (uid === ME.id) { location.replace("#profil"); return; }
    baslik(prof(uid).ad);
    if (ilk) ekran(`<div id="kisi"><div class="bos">Yükleniyor…</div></div>`);
    let p; try { p = await Z.call("kisi", { kisi: uid }); } catch (e) { if ($("#kisi")) $("#kisi").innerHTML = `<div class="bos"><h2>Bulunamadı</h2></div>`; return; }
    st.prof[uid] = { ad: p.kullanici || p.ad, renk: p.renk, foto: p.foto, kullanici: p.kullanici, cevrimici: (st.prof[uid] || {}).cevrimici };
    const el = $("#kisi"); if (!el || rota().arg !== uid) return;
    baslik(p.kullanici || p.ad);
    const d = (st.arkadas.get(uid) || {}).durum || null;
    el.innerHTML = `<div class="profil">${av(uid, "b")}<h2>${esc(p.kullanici || p.ad)}</h2>
      ${st.prof[uid].cevrimici ? `<span class="rozetk">Çevrimiçi</span>` : ""}
      ${p.hakkinda ? `<p class="hak">${esc(p.hakkinda)}</p>` : ""}
      ${p.katildi ? `<p class="ipucu">Üyelik: ${new Date(p.katildi).toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}</p>` : ""}
      ${p.kullanici ? `<div class="dugmeler" style="justify-content:center">${d === "arkadas" ? `<a class="btn pri" href="#mesaj/${esc(uid)}">Mesaj gönder</a><button class="btn kotu" data-a="cikar" data-k="${esc(uid)}">Arkadaşlıktan çıkar</button>` : d === "gelen" ? `<button class="btn pri" data-a="kabul" data-k="${esc(uid)}">İsteği kabul et</button><button class="btn" data-a="reddet" data-k="${esc(uid)}">Reddet</button>` : d === "giden" ? `<button class="btn" data-a="reddet" data-k="${esc(uid)}">İsteği geri çek</button>` : `<button class="btn pri" data-a="ekle" data-k="${esc(uid)}">+ Arkadaş ekle</button>`}</div>` : `<p class="ipucu">Bu kişinin hesabı yok (hesapsız oynuyor).</p>`}</div>`;
  };

  // ---- Kendi profilim ----
  EKRAN.profil = (arg, ilk) => {
    baslik("Profilim");
    if (!ilk) { const a = $("#benav"); if (a) a.innerHTML = av(ME.id, "b"); return; }
    ekran(`<div class="profil"><span id="benav">${av(ME.id, "b")}</span><h2>${esc(ME.kullanici)}</h2>
        <div class="dugmeler" style="justify-content:center"><button class="btn sm" data-a="foto">Fotoğraf ${ME.foto ? "değiştir" : "ekle"}</button>${ME.foto ? `<button class="btn sm" data-a="fotosil">Kaldır</button>` : ""}</div></div>
      <h2 class="bolum">Hakkımda</h2>
      <form class="form" id="hakf"><textarea class="f" name="h" maxlength="500" rows="3" placeholder="Hangi oyunları seversin, ne zaman oynarsın?" aria-label="Hakkımda"></textarea><button class="btn">Kaydet</button></form>
      <h2 class="bolum">Rengim</h2>
      <div class="renkler">${RENKLER.map(c => `<button class="renk" data-a="renk" data-c="${c}" style="background:${c}" aria-label="Renk ${c}" aria-pressed="${c === ME.color}"></button>`).join("")}</div>
      <h2 class="bolum">Şifre değiştir</h2>
      <form class="form" id="sifref"><input class="f" type="password" name="eski" placeholder="Şu anki şifre" autocomplete="current-password" required aria-label="Şu anki şifre">
        <input class="f" type="password" name="yeni" placeholder="Yeni şifre (en az 6 karakter)" minlength="6" autocomplete="new-password" required aria-label="Yeni şifre">
        <input class="f" type="password" name="yeni2" placeholder="Yeni şifre (tekrar)" autocomplete="new-password" required aria-label="Yeni şifre tekrar"><button class="btn">Şifreyi değiştir</button></form>
      <h2 class="bolum">Hesap</h2>
      <div class="form">${GOMULU ? "" : `<a class="btn" href="/">Bilgisayar görünümünü aç</a>`}${UYGULAMA ? `<a class="btn" href="http://localhost/?degistir=1">Sunucuyu değiştir</a>` : ""}<button class="btn kotu" data-a="cikis">Çıkış yap</button></div>`);
    Z.call("kisi", { kisi: ME.id }).then(p => { const f = $("#hakf"); if (f) f.h.value = p.hakkinda || ""; }).catch(() => {});
    $("#hakf").addEventListener("submit", async e => { e.preventDefault(); try { await cagir("profilYaz", { hakkinda: e.target.h.value }); tost("Kaydedildi"); } catch (x) {} });
    $("#sifref").addEventListener("submit", async e => {
      e.preventDefault(); const f = e.target;
      if (f.yeni.value !== f.yeni2.value) return tost("Yeni şifreler aynı değil");
      try { await cagir("sifreDegistir", { eski: f.eski.value, yeni: f.yeni.value }); f.reset(); tost("Şifren değişti. Öteki cihazlarda yeniden giriş yapman gerekecek."); } catch (x) {}
    });
  };

  // ---- Masalar ----
  const rolu = g => !g || !ME ? "none" : g.dms && g.dms[ME.id] ? "dm" : g.players && g.players[ME.id] ? "player" : g.pending && g.pending[ME.id] ? "pending" : "none";
  EKRAN.masalar = () => {
    baslik("Masalar");
    const all = [...st.oyunlar.entries()].map(([id, g]) => ({ id, ...g })).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    const benim = all.filter(g => ["dm", "player", "pending"].includes(rolu(g))), diger = all.filter(g => rolu(g) === "none");
    const kart = g => { const r = rolu(g), dms = Object.keys(g.dms || {}).filter(k => g.dms[k]), oy = Object.values(g.players || {}).filter(Boolean).length;
      dms.forEach(prof);
      return `<li class="masa"><h3>${esc(g.name || "Adsız oyun")}</h3>
        <div class="dugmeler" style="margin:0"><span class="rozetk">${esc(SISTEM[g.system] || "D&D 5e")}</span>${r === "dm" ? `<span class="rozetk altin">Yönetici</span>` : r === "player" ? `<span class="rozetk">Oyuncu</span>` : r === "pending" ? `<span class="rozetk altin">İstek gönderildi</span>` : ""}</div>
        ${g.desc ? `<p>${esc(g.desc)}</p>` : ""}<p>${dms.map(id => esc(prof(id).ad)).join(", ") || "—"} · ${oy} oyuncu · ${g.open === false ? "Onaylı katılım" : "Açık katılım"}</p>
        <div class="dugmeler">${r === "dm" || r === "player" ? `<a class="btn pri" href="/?mobil=1#${esc(g.id)}">Masayı aç</a>` : r === "pending" ? `<button class="btn" data-a="mgeri" data-g="${esc(g.id)}">İsteği geri çek</button>` : g.open !== false ? `<button class="btn" data-a="mkatil" data-g="${esc(g.id)}">Katıl</button>` : `<button class="btn" data-a="mistek" data-g="${esc(g.id)}">Katılma isteği gönder</button>`}</div></li>`; };
    ekran(`<p class="ipucu" style="margin-top:0">Masayı açınca karakter kağıtların, notlar, savaş sırası, zar tepsisi ve masa sohbeti gelir. Harita ve yeni masa kurmak bilgisayardaki uygulamada.</p>
      ${benim.length ? `<h2 class="bolum">Masaların</h2><ul class="liste">${benim.map(kart).join("")}</ul>` : ""}
      ${diger.length ? `<h2 class="bolum">Diğer masalar</h2><ul class="liste">${diger.map(kart).join("")}</ul>` : ""}
      ${!all.length ? `<div class="bos"><h2>Henüz masa yok</h2><p>Bilgisayardaki uygulamadan bir masa kurulunca burada görünür.</p></div>` : ""}`);
  };
  async function masaYaz(gid, patch) { await DB.doc("games/" + gid).update({ ...patch, updated: Date.now() }); }

  // ---- Zar ----
  const ZARLAR = [4, 6, 8, 10, 12, 20, 100];
  EKRAN.zar = (arg, ilk) => {
    baslik("Zar");
    const mas = [...st.oyunlar.entries()].filter(([, g]) => ["dm", "player"].includes(rolu(g)));
    if (ilk) {
      ekran(`<div class="sonuc" id="zsonuc"><div class="top num">–</div><div class="det">Bir zara dokun ya da ifade yaz</div></div>
        <div class="avdz" style="margin:12px 0" role="group" aria-label="d20 için">${["Normal", "Avantaj", "Dezavantaj"].map((t, i) => `<button data-a="adv" data-v="${[0, 1, -1][i]}" aria-pressed="${ui.zarAdv === [0, 1, -1][i]}">${t}</button>`).join("")}</div>
        <div class="zarlar">${ZARLAR.map(s => `<button class="zar" data-a="zar" data-s="${s}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2 21 7v10l-9 5-9-5V7z"/></svg>d${s}</button>`).join("")}<button class="zar" data-a="zar" data-s="2d6"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="7" width="10" height="10" rx="2"/><rect x="11" y="3" width="10" height="10" rx="2"/></svg>2d6</button></div>
        <form id="zf" style="display:flex;gap:8px;margin-top:12px"><input class="f num" name="e" placeholder="ör. 2d6+3, 4d6kh3, 1d20-1" autocapitalize="none" spellcheck="false" aria-label="Zar ifadesi"><button class="btn pri">At</button></form>
        <label style="margin-top:12px"><span class="lbl">Atışları masaya da gönder</span><select class="f" id="zmasa"></select></label>
        <h2 class="bolum">Son atışlar</h2><ul class="liste gecmis" id="zgec"></ul>`);
      $("#zf").addEventListener("submit", e => { e.preventDefault(); const v = e.target.e.value.trim(); if (v) zarAt(v, v); });
      $("#zmasa").addEventListener("change", e => { ui.zarMasa = e.target.value; LS.set("zm-m-zarmasa", ui.zarMasa); });
      zarGecmis();
    }
    const sel = $("#zmasa");
    if (sel && document.activeElement !== sel) sel.innerHTML = `<option value="">Gönderme (yalnızca ben görürüm)</option>` + mas.map(([id, g]) => `<option value="${esc(id)}" ${ui.zarMasa === id ? "selected" : ""}>${esc(g.name || "Adsız oyun")}</option>`).join("");
  };
  // Zar ifadesi: 2d6+3, d20, 4d6kh3, 2d20kl1, d%, 1d8+1d6-2
  function zarCoz(expr) {
    const s = String(expr).toLowerCase().replace(/\s+/g, "").replace(/d%/g, "d100");
    if (!s || s.length > 60) throw new Error("Geçersiz ifade");
    const re = /([+-]?)(?:(\d*)d(\d+)(?:(kh|kl)(\d+))?|(\d+))/gy; let m, top = 0, parca = [], d20 = null, i = 0;
    while (i < s.length) {
      re.lastIndex = i; m = re.exec(s); if (!m || !m[0]) throw new Error("Anlaşılamadı: " + expr);
      i = re.lastIndex; const isa = m[1] === "-" ? -1 : 1;
      if (m[6] != null) { top += isa * +m[6]; parca.push((isa < 0 ? "−" : "+") + m[6]); continue; }
      const n = m[2] === "" ? 1 : +m[2], y = +m[3];
      if (n < 1 || n > 100 || y < 2 || y > 1000) throw new Error("Zar sayısı 1-100, yüz sayısı 2-1000 olmalı");
      const at = Array.from({ length: n }, () => 1 + Math.floor(rastgele() * y));
      let tut = at.map((v, k) => k);
      if (m[4]) { const k = Math.min(n, Math.max(1, +m[5])); tut = at.map((v, j) => [v, j]).sort((a, b) => m[4] === "kh" ? b[0] - a[0] : a[0] - b[0]).slice(0, k).map(x => x[1]); }
      const t = tut.reduce((a, j) => a + at[j], 0); top += isa * t;
      if (y === 20 && tut.length === 1) d20 = at[tut[0]];
      parca.push((isa < 0 ? "−" : parca.length ? "+" : "") + `[${at.map((v, j) => tut.includes(j) ? v : `(${v})`).join(", ")}]`);
    }
    return { top, det: parca.join(" "), crit: d20 === 20 ? "20" : d20 === 1 ? "1" : null };
  }
  function rastgele() { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; }
  function zarAt(expr, etiket) {
    let r; try { r = zarCoz(expr); } catch (e) { tost(e.message); return; }
    const el = $("#zsonuc");
    if (el) { el.className = "sonuc anim" + (r.crit === "20" ? " n20" : r.crit === "1" ? " n1" : ""); el.innerHTML = `<div class="det">${esc(etiket)}</div><div class="top num">${r.top}</div><div class="det">${esc(r.det)}</div>${r.crit === "20" ? "<b>Doğal 20!</b>" : r.crit === "1" ? "<b>Doğal 1</b>" : ""}`; void el.offsetWidth; }
    if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) {}
    const kayit = { id: "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), t: Date.now(), label: etiket, expr, total: r.top, detail: r.det, crit: r.crit, by: ME.id };
    const g = LS.get("zm-m-zar", []); g.unshift({ ...kayit, masa: ui.zarMasa ? (st.oyunlar.get(ui.zarMasa) || {}).name : "" }); LS.set("zm-m-zar", g.slice(0, 30)); zarGecmis();
    if (ui.zarMasa && st.oyunlar.has(ui.zarMasa)) DB.collection(`games/${ui.zarMasa}/rolls`).doc(kayit.id).set(kayit).catch(() => tost("Masaya gönderilemedi"));
  }
  function zarGecmis() {
    const el = $("#zgec"); if (!el) return; const g = LS.get("zm-m-zar", []);
    el.innerHTML = g.length ? g.map(x => `<li><span>${esc(x.label)}<small>${zaman(x.t)}${x.masa ? " · " + esc(x.masa) : ""} · ${esc(x.detail)}</small></span><b class="num">${esc(x.total)}</b></li>`).join("") : `<li class="ipucu">Henüz atış yok.</li>`;
  }

  /* ---------------- Dokunuşlar ---------------- */
  $("#ekran").addEventListener("click", async e => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    const a = b.dataset.a, k = b.dataset.k;
    try {
      switch (a) {
        case "fkat": ui.forumKat = b.dataset.k; EKRAN.forum("", false); return;
        case "fsil": return onayli(b, async () => { await cagir("forumDelete", { topic: b.dataset.t }); location.replace("#forum"); });
        case "fysil": return onayli(b, () => cagir("forumDelete", { topic: b.dataset.t, post: b.dataset.p }));
        case "fsabit": { const t = st.forum.get(b.dataset.t); return cagir("forumPin", { topic: b.dataset.t, sabit: !(t && t.sabit) }); }
        case "ekle": b.disabled = true; { const r = await cagir("arkadasIstek", { kisi: k }); tost(r === "arkadas" ? "Artık arkadaşsınız" : "İstek gönderildi"); } return;
        case "kabul": b.disabled = true; await cagir("arkadasKabul", { kisi: k }); tost("Artık arkadaşsınız"); return;
        case "reddet": b.disabled = true; await cagir("arkadasSil", { kisi: k }); return;
        case "cikar": return onayli(b, () => cagir("arkadasSil", { kisi: k }));
        case "gekle": b.disabled = true; await cagir("grupEkle", { grup: b.dataset.g, kisi: k }); tost(prof(k).ad + " gruba eklendi"); EKRAN["grup-bilgi"](b.dataset.g, false); return;
        case "gcikar": return onayli(b, async () => { await cagir("grupCikar", { grup: b.dataset.g, kisi: k }); EKRAN["grup-bilgi"](b.dataset.g, false); });
        case "gcik": return onayli(b, async () => { await cagir("grupCik", { grup: b.dataset.g }); tost("Gruptan ayrıldın"); location.replace("#mesajlar"); });
        case "dmfoto": {
          const f = await dosyaSec(); if (!f) return;
          tost("Fotoğraf gönderiliyor…");
          const up = await Z.upload(await kucult(f, 1280, false));
          await sohbetKur.gonder({ resim: up.url }); return;
        }
        case "foto": {
          const f = await dosyaSec(); if (!f) return;
          b.disabled = true; tost("Yükleniyor…");
          const up = await Z.upload(await kucult(f, 384, true));
          const p = await cagir("profilYaz", { foto: up.id }); ME.foto = p.foto; rozetler(); git(true); tost("Profil fotoğrafın güncellendi"); return;
        }
        case "fotosil": { await cagir("profilYaz", { foto: null }); ME.foto = null; rozetler(); git(true); return; }
        case "renk": { const p = await cagir("profilYaz", { renk: b.dataset.c }); ME.color = p.renk; try { localStorage.setItem("zm-color", p.renk); } catch (x) {} document.querySelectorAll("[data-a=renk]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); rozetler(); yenile(); return; }
        case "cikis": return onayli(b, () => Z.cikis());
        case "mkatil": { const g = st.oyunlar.get(b.dataset.g); await masaYaz(b.dataset.g, { players: { [ME.id]: { joined: Date.now(), charId: null } } }); tost((g && g.name || "Masa") + " masasına katıldın"); location.href = "/?mobil=1#" + b.dataset.g; return; }
        case "mistek": await masaYaz(b.dataset.g, { pending: { [ME.id]: Date.now() } }); tost("İstek gönderildi. Yönetici onaylayınca masayı açabilirsin."); return;
        case "mgeri": await masaYaz(b.dataset.g, { pending: { [ME.id]: null } }); return;
        case "adv": ui.zarAdv = +b.dataset.v; document.querySelectorAll("[data-a=adv]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); return;
        case "zar": { const s = b.dataset.s; if (s === "20" && ui.zarAdv) return zarAt(ui.zarAdv > 0 ? "2d20kh1" : "2d20kl1", "d20 · " + (ui.zarAdv > 0 ? "Avantaj" : "Dezavantaj")); return zarAt(/d/.test(s) ? s : "1d" + s, /d/.test(s) ? s : "d" + s); }
      }
    } catch (x) { if (x && x.message && !x.code) tost(x.message); b.disabled = false; }
  });
  $("#kapat").addEventListener("click", () => parent.postMessage({ zm: "sosyal-kapat" }, location.origin));

  /* ---------------- Başlangıç ---------------- */
  // Android uygulamasında giriş ekranının altına "Sunucuyu değiştir" bağlantısı.
  let sunucuLink = null;
  if (UYGULAMA) {
    sunucuLink = document.createElement("a"); sunucuLink.href = "http://localhost/?degistir=1"; sunucuLink.className = "sunucu";
    sunucuLink.textContent = "Sunucu: " + location.host + " · Değiştir";
    sunucuLink.style.cssText = "position:fixed;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:101;text-align:center";
    document.body.appendChild(sunucuLink);
  }

  async function basla() {
    await Z.ready;
    if (sunucuLink) sunucuLink.remove();
    ME = Object.assign({}, Z.me());
    try { INFO = await (await fetch("/api/info")).json(); } catch (e) {}
    $("#uyg").hidden = false;
    if (GOMULU) { $("#kapat").hidden = false; $("#alt").classList.add("az"); document.querySelectorAll("#alt [data-sek]").forEach(a => { if (!SEKMELER.includes(a.dataset.sek)) a.remove(); }); }
    if (!ME.kullanici) {
      // Hesapsız (masaüstünden host edilen) masa: sosyal özellikler için hesap gerekir.
      $("#alt").hidden = true;
      baslik("Hesap gerekli");
      ekran(`<div class="bos"><h2>Hesabınla gir</h2><p>Profil, arkadaşlar ve mesajlar için bir kullanıcı adı ve şifre gerekiyor. Şimdiye kadarki masaların ve karakterlerin yeni hesabına taşınır.</p><button class="btn pri" id="hesapac">Giriş yap ya da hesap oluştur</button></div>`);
      $("#hesapac").addEventListener("click", () => Z.girisEkrani({ kayit: true }));
      return;
    }
    DB = Z.db();
    DB.collection(`data/users/${ME.id}/konusma`).onSnapshot(s => { for (const c of s.docChanges()) c.type === "removed" ? st.konusma.delete(c.doc.id) : st.konusma.set(c.doc.id, c.doc.data()); st.yuklendi = true; yenile(); }, () => {});
    DB.collection(`data/users/${ME.id}/arkadas`).onSnapshot(s => { for (const c of s.docChanges()) c.type === "removed" ? st.arkadas.delete(c.doc.id) : st.arkadas.set(c.doc.id, c.doc.data()); yenile(); }, () => {});
    if (!GOMULU) {
      DB.collection("forum").onSnapshot(s => { for (const c of s.docChanges()) c.type === "removed" ? st.forum.delete(c.doc.id) : st.forum.set(c.doc.id, c.doc.data()); const r = rota().ad; if (r === "forum" || r === "forum-konu") yenile(); }, () => {});
      DB.collection("games").onSnapshot(s => { for (const c of s.docChanges()) c.type === "removed" ? st.oyunlar.delete(c.doc.id) : st.oyunlar.set(c.doc.id, c.doc.data()); const r = rota().ad; if (r === "masalar" || r === "zar") yenile(); }, () => {});
    }
    // Arkadaşların çevrimiçi durumunu ara ara tazele.
    setInterval(() => { if (!document.hidden) profYukle(true); }, 60000);
    window.addEventListener("hashchange", () => git());
    git(true); rozetler();
  }
  basla();
})();
