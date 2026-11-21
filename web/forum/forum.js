/* Forum sayfası (/forum): her konunun paylaşılabilir kendi adresi var.
   /forum                 konular (arama: ?q=, kategori: ?kategori=)
   /forum/yeni            yeni konu aç
   /forum/<konu>          konu ve yanıtları; /forum/<konu>#<yanıt> bir yanıta gider
   Veri: forum/<konu> ve forum/<konu>/yanitlar/<yanıt> (db aboneliği). Yazma sunucu işlemleriyle (window.zmForum),
   böylece yazar adı taklit edilemez. Yazar fotoğrafları profiles işleminden gelir. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const Z = window.zmSunucu, ZF = window.zmForum;
  if (!Z || !ZF) return;

  let KATEGORI = ["Genel sohbet", "Oyuncu arıyorum", "Masa arıyorum", "Kurallar", "Paylaşım"];
  let SISTEM = { dnd5e: "D&D 5e", coc7: "Call of Cthulhu", yze: "Year Zero", pf2e: "Pathfinder 2e", motw: "Monster of the Week" };
  const st = {
    konular: new Map(), yuklendi: false, yanitlar: new Map(), yanitKonu: null, yanitYuklendi: false, kisiler: {},
    q: "", kategori: "", sistem: "", sira: "etkinlik",
    taslak: { baslik: "", govde: "", kategori: "Genel sohbet", sistem: "" }, yanitTaslak: "", gonderiyor: false, kaydir: null, sikayet: null,
  };
  let ME = {};

  /* ---------------- Yardımcılar ---------------- */
  function tost(t) { const el = $("#tost"); el.textContent = t; el.hidden = false; clearTimeout(tost.t); tost.t = setTimeout(() => (el.hidden = true), 2800); }
  function zaman(t) {
    if (!t) return ""; const d = new Date(t), now = new Date(), fark = (now - d) / 1000;
    if (fark < 60) return "şimdi";
    if (fark < 3600) return Math.floor(fark / 60) + " dk önce";
    if (fark < 86400 && d.getDate() === now.getDate()) return "bugün " + d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    const gun = Math.floor(fark / 86400);
    if (gun < 1) return "dün";
    if (gun < 7) return gun + " gün önce";
    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
  }
  const tamZaman = t => new Date(t).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" });
  const sade = s => String(s || "").toLocaleLowerCase("tr").replace(/[ıîİ]/g, "i").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ö/g, "o").replace(/[üû]/g, "u").replace(/â/g, "a").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const uyar = (q, ...alan) => { const w = sade(q).split(/\s+/).filter(Boolean); if (!w.length) return true; const t = sade(alan.join(" ")); return w.every(x => t.includes(x)); };
  const harf = s => esc(String(s || "?").trim().charAt(0).toLocaleUpperCase("tr"));
  function av(y, cls) {
    const p = (y && st.kisiler[y.id]) || {};
    const renk = p.color || (y && y.color) || "#7f8c8d", ad = p.kullanici || (y && y.name);
    return `<span class="av ${cls || ""}" style="--av:${esc(renk)}" aria-hidden="true">${p.foto ? `<img src="${esc(p.foto)}" alt="" loading="lazy">` : harf(ad)}</span>`;
  }
  const kisiA = y => (y ? (window.zmKisi ? window.zmKisi(y.id, (st.kisiler[y.id] || {}).kullanici || y.name || "Bir oyuncu") : esc(y.name)) : "Bir oyuncu");
  const silebilir = y => !!y && (y.id === ME.id || Z.isOwner());
  function onayli(btn, fn) {
    if (btn.dataset.onay === "1") { btn.dataset.onay = ""; fn(); return; }
    const eski = btn.textContent; btn.dataset.onay = "1"; btn.textContent = "Emin misin?";
    setTimeout(() => { if (btn.isConnected && btn.dataset.onay === "1") { btn.dataset.onay = ""; btn.textContent = eski; } }, 3000);
  }
  async function kopyala(url, mesaj) {
    try { await navigator.clipboard.writeText(url); tost(mesaj); } catch (e) { prompt("Bağlantı:", url); }
  }
  // Yazarların fotoğrafları ve güncel kullanıcı adları (bir kez sorulur).
  const sorulan = new Set();
  function kisileriGetir(ids) {
    const yeni = [...new Set(ids)].filter(id => id && !sorulan.has(id)); if (!yeni.length) return;
    yeni.forEach(id => sorulan.add(id));
    Z.call("profiles", { ids: yeni.slice(0, 200) }).then(r => { Object.assign(st.kisiler, r); ciz(); }).catch(() => {});
  }

  /* ---------------- Adres ---------------- */
  function rota() {
    const p = location.pathname.replace(/\/+$/, "");
    if (p === "/forum/yeni") return { ad: "yeni" };
    const m = /^\/forum\/(t[0-9a-z]{1,40})$/.exec(p);
    if (m) return { ad: "konu", id: m[1] };
    return { ad: "liste" };
  }
  function git(url, degistir) {
    if (degistir) history.replaceState(null, "", url); else history.pushState(null, "", url);
    adrestenOku(); ciz(); window.scrollTo(0, 0);
  }
  function adrestenOku() {
    const q = new URLSearchParams(location.search);
    st.q = q.get("q") || ""; st.kategori = KATEGORI.includes(q.get("kategori")) ? q.get("kategori") : ""; st.sistem = q.get("sistem") || "";
    st.sira = ["etkinlik", "yeni", "yanit"].includes(q.get("sira")) ? q.get("sira") : "etkinlik";
    const r = rota();
    if (r.ad === "konu" && location.hash.length > 1) st.kaydir = location.hash.slice(1);
    yanitlaraAbone(r.ad === "konu" ? r.id : null);
  }
  // Liste süzgeçleri adreste durur (paylaşılabilir, geri tuşu çalışır).
  function listeAdresi() {
    const q = new URLSearchParams();
    if (st.q) q.set("q", st.q); if (st.kategori) q.set("kategori", st.kategori); if (st.sistem) q.set("sistem", st.sistem); if (st.sira !== "etkinlik") q.set("sira", st.sira);
    const s = q.toString(); return "/forum" + (s ? "?" + s : "");
  }
  window.addEventListener("popstate", () => { adrestenOku(); ciz(); });

  /* ---------------- Abonelikler ---------------- */
  let yanitAbone = null;
  function yanitlaraAbone(id) {
    if (st.yanitKonu === id) return;
    if (yanitAbone) { try { yanitAbone(); } catch (e) {} yanitAbone = null; }
    st.yanitKonu = id; st.yanitlar = new Map(); st.yanitYuklendi = false; st.yanitTaslak = "";
    if (!id || !Z.db) return;
    Z.ready.then(() => {
      if (st.yanitKonu !== id) return;
      yanitAbone = Z.db().collection("forum/" + id + "/yanitlar").onSnapshot(s => {
        if (st.yanitKonu !== id) return;
        for (const c of s.docChanges()) c.type === "removed" ? st.yanitlar.delete(c.doc.id) : st.yanitlar.set(c.doc.id, { id: c.doc.id, ...c.doc.data() });
        st.yanitYuklendi = true; kisileriGetir([...st.yanitlar.values()].map(y => y.yazar && y.yazar.id)); ciz();
      }, () => {});
    });
  }

  /* ---------------- Liste ---------------- */
  const sistemAd = k => SISTEM[k] || k || "";
  function listeHtml() {
    const hepsi = [...st.konular.values()];
    const suz = t => (!st.kategori || (t.kategori || "Genel sohbet") === st.kategori) && (!st.sistem || t.sistem === st.sistem) && uyar(st.q, t.baslik, t.govde, t.yazar && t.yazar.name, t.kategori, sistemAd(t.sistem));
    const sirala = { etkinlik: (a, b) => (b.sabit - a.sabit) || (b.updated || 0) - (a.updated || 0), yeni: (a, b) => (b.created || 0) - (a.created || 0), yanit: (a, b) => (b.yanit || 0) - (a.yanit || 0) || (b.updated || 0) - (a.updated || 0) }[st.sira];
    const liste = hepsi.filter(suz).sort(sirala);
    const katSay = k => hepsi.filter(t => (t.kategori || "Genel sohbet") === k).length;
    const cip = (k, ad, n) => `<button type="button" class="cip" data-a="kat" data-k="${esc(k)}" aria-pressed="${st.kategori === k}">${esc(ad)} <span class="num">${n}</span></button>`;
    const sec = (v, cur, ad) => `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(ad)}</option>`;
    let govde;
    if (!st.yuklendi) govde = `<div class="bos">Konular yükleniyor…</div>`;
    else if (!hepsi.length) govde = `<div class="bos"><h2>Forumda henüz konu yok</h2><p>Oyuncu ara, kural sor, hazırladığın haritayı paylaş. İlk konuyu sen aç.</p><a class="btn pri" href="/forum/yeni" data-git>+ Yeni konu aç</a></div>`;
    else if (!liste.length) govde = `<div class="bos"><h2>Aramana uyan konu yok</h2><p>Başka bir kelime dene ya da süzgeçleri temizle.</p><button class="btn" type="button" data-a="temizle">Süzgeçleri temizle</button></div>`;
    else govde = `<ul class="liste">${liste.map(t => `<li class="konu${t.sabit ? " sabit" : ""}">${av(t.yazar)}
        <div class="konu-b"><a href="/forum/${esc(t.id)}" data-git data-noi18n>${t.sabit ? '<span class="pin">Sabit</span>' : ""}${esc(t.baslik)}</a>
          <p class="meta"><span class="kat">${esc(t.kategori || "Genel sohbet")}</span>${t.sistem ? `<span class="sis">${esc(sistemAd(t.sistem))}</span>` : ""}<span>${kisiA(t.yazar)}</span><span title="${esc(tamZaman(t.created))}">${zaman(t.created)}</span></p></div>
        <div class="konu-s"><span><b class="num">${t.yanit || 0}</b> yanıt</span>${t.yanit ? `<small>son: ${esc(t.sonYazan || "")} · ${zaman(t.updated)}</small>` : ""}</div></li>`).join("")}</ul>`;
    return `<div class="fbas"><div><h1>Forum</h1><p>Oyuncu ara, kural sor, paylaş.${hepsi.length ? ` ${hepsi.length} konu.` : ""}</p></div><span class="sp"></span><a class="btn pri" href="/forum/yeni" data-git>+ Yeni konu</a></div>
      <div class="arac" role="search">
        <div class="arac-ust"><label class="ara"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input class="f" type="search" id="fAra" placeholder="Konularda ara" aria-label="Konularda ara" value="${esc(st.q)}" autocomplete="off"></label>
          <select class="f" data-s="sistem" aria-label="Oyun sistemi">${sec("", st.sistem, "Tüm sistemler")}${Object.entries(SISTEM).map(([k, v]) => sec(k, st.sistem, v)).join("")}</select>
          <select class="f" data-s="sira" aria-label="Sıralama">${sec("etkinlik", st.sira, "Son etkinlik")}${sec("yeni", st.sira, "En yeni konular")}${sec("yanit", st.sira, "En çok yanıt")}</select></div>
        <div class="cipler" role="group" aria-label="Kategori">${cip("", "Hepsi", hepsi.length)}${KATEGORI.map(k => cip(k, k, katSay(k))).join("")}</div>
      </div>${govde}`;
  }

  /* ---------------- Konu ---------------- */
  function konuHtml(id) {
    const t = st.konular.get(id);
    if (!t) return st.yuklendi
      ? `<div class="bos"><h2>Bu konu bulunamadı</h2><p>Silinmiş olabilir ya da bağlantı yanlış.</p><a class="btn" href="/forum" data-git>← Bütün konular</a></div>`
      : `<div class="bos">Konu yükleniyor…</div>`;
    const yan = [...st.yanitlar.values()].sort((a, b) => a.created - b.created);
    const yazarId = t.yazar && t.yazar.id;
    const ileti = (y, govde, tz, pid, ilk) => `<li class="ileti" id="${pid || "ilk"}">${av(y)}<div style="min-width:0">
        <div class="ileti-ust"><span class="ad">${kisiA(y)}</span>${!ilk && y && y.id === yazarId ? `<span class="etk">Konuyu açan</span>` : ""}<a class="zaman" href="#${pid || "ilk"}" title="${esc(tamZaman(tz))}">${zaman(tz)}</a></div>
        <p class="metin" data-noi18n>${esc(govde || "")}</p>
        <div class="ileti-dug">${pid ? `<button class="btn" type="button" data-a="ykopya" data-id="${esc(pid)}">Bağlantı</button>` : ""}${!ilk ? `<button class="btn" type="button" data-a="alinti" data-id="${esc(pid)}">Alıntıla</button>` : ""}${pid && silebilir(y) ? `<button class="btn kotu" type="button" data-a="ysil" data-id="${esc(pid)}">Sil</button>` : ""}${y && y.id !== ME.id && st.sikayet !== (pid || "ilk") ? `<button class="btn" type="button" data-a="sikayet" data-id="${esc(pid || "ilk")}">Şikâyet et</button>` : ""}</div>
        ${st.sikayet === (pid || "ilk") ? sikayetForm(pid || "ilk") : ""}</div></li>`;
    document.title = t.baslik + " · Forum · Zar Masası";
    return `<nav class="iz" aria-label="Konum"><a href="/forum" data-git>Forum</a><span aria-hidden="true">›</span><a href="/forum?kategori=${encodeURIComponent(t.kategori || "Genel sohbet")}" data-git>${esc(t.kategori || "Genel sohbet")}</a></nav>
      <header class="konu-bas"><h1 data-noi18n>${t.sabit ? '<span class="pin">Sabit</span>' : ""}${esc(t.baslik)}</h1>
        <p class="meta"><span class="kat">${esc(t.kategori || "Genel sohbet")}</span>${t.sistem ? `<span class="sis">${esc(sistemAd(t.sistem))}</span>` : ""}<span>${kisiA(t.yazar)} açtı · ${zaman(t.created)}</span><span><b class="num">${t.yanit || 0}</b> yanıt</span></p>
        <div class="konu-dug"><button class="btn sm" type="button" data-a="kopya">🔗 Bağlantıyı kopyala</button>${navigator.share ? `<button class="btn sm" type="button" data-a="paylas">Paylaş</button>` : ""}
          ${Z.isOwner() ? `<button class="btn sm" type="button" data-a="sabitle">${t.sabit ? "Sabitlemeyi kaldır" : "Başa sabitle"}</button>` : ""}${silebilir(t.yazar) ? `<button class="btn sm kotu" type="button" data-a="ksil">Konuyu sil</button>` : ""}</div></header>
      <ol class="iletiler">${ileti(t.yazar, t.govde, t.created, null, true)}${yan.map(y => ileti(y.yazar, y.govde, y.created, y.id)).join("")}${!st.yanitYuklendi && t.yanit ? `<li class="ileti"><span></span><span class="ipucu">Yanıtlar yükleniyor…</span></li>` : ""}</ol>
      <form class="yanitla" id="yanitf"><h2>Yanıt yaz</h2><label class="lbl" for="fYanit" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Yanıtın</label>
        <textarea class="f" id="fYanit" maxlength="4000" placeholder="Yanıtın…">${esc(st.yanitTaslak)}</textarea>
        <div class="dugmeler"><button class="btn pri" type="submit"${st.gonderiyor ? " disabled" : ""}>Gönder</button><span class="ipucu" id="ysay"></span></div></form>`;
  }

  // Şikâyet: yönetime iletilir (sikayetEt işlemi; şikâyet edilen kişiyi sunucu yazıdan kendisi bulur).
  const NEDEN = [["spam", "Spam ya da reklam"], ["taciz", "Taciz ya da hakaret"], ["uygunsuz", "Uygunsuz içerik"], ["hile", "Hile ya da dolandırıcılık"], ["taklit", "Başkasını taklit"], ["diger", "Başka bir neden"]];
  const sikayetForm = id => `<form class="sikayet" data-sikayet="${esc(id)}" style="display:grid;gap:6px;margin-top:8px;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2)">
      <label class="lbl" for="sNeden">Neden şikâyet ediyorsun?</label><select class="f" id="sNeden">${NEDEN.map(([k, ad]) => `<option value="${k}">${ad}</option>`).join("")}</select>
      <textarea class="f" id="sAciklama" maxlength="500" rows="2" style="min-height:60px" placeholder="İstersen kısaca açıkla (isteğe bağlı)" aria-label="Açıklama"></textarea>
      <div class="dugmeler"><button class="btn kotu" type="submit">Şikâyeti gönder</button><button class="btn" type="button" data-a="sikayetvazgec">Vazgeç</button><span class="ipucu">Şikâyetini yalnızca yönetim görür.</span></div></form>`;

  /* ---------------- Yeni konu ---------------- */
  function yeniHtml() {
    const d = st.taslak, sec = (v, cur, ad) => `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(ad)}</option>`;
    document.title = "Yeni konu · Forum · Zar Masası";
    return `<nav class="iz" aria-label="Konum"><a href="/forum" data-git>Forum</a><span aria-hidden="true">›</span><span>Yeni konu</span></nav>
      <form class="yeni" id="yenif"><h2>Yeni konu aç</h2>
        <label><span class="lbl">Başlık</span><input class="f" id="fBaslik" maxlength="120" required placeholder="Cuma akşamı CoC oyununa 2 oyuncu arıyoruz" value="${esc(d.baslik)}"></label>
        <div class="iki"><label><span class="lbl">Kategori</span><select class="f" id="fKategori">${KATEGORI.map(k => sec(k, d.kategori, k)).join("")}</select></label>
          <label><span class="lbl">Sistem (isteğe bağlı)</span><select class="f" id="fSistem">${sec("", d.sistem, "Belirtilmemiş")}${Object.entries(SISTEM).map(([k, v]) => sec(k, d.sistem, v)).join("")}</select></label></div>
        <label><span class="lbl">İleti</span><textarea class="f" id="fGovde" maxlength="4000" rows="8" placeholder="Ne zaman, hangi sistem, kaç kişi, yeni başlayanlar katılabilir mi…">${esc(d.govde)}</textarea></label>
        <div class="dugmeler"><button class="btn pri" type="submit"${st.gonderiyor ? " disabled" : ""}>Konuyu aç</button><a class="btn" href="/forum" data-git>Vazgeç</a></div></form>`;
  }

  /* ---------------- Çizim ---------------- */
  function ciz() {
    const ana = $("#ana"), r = rota();
    // Yazı yazılan bir alan varsa (yanıt, yeni konu) ya da arama kutusu odaktaysa yazılanlar silinmesin.
    const a = document.activeElement;
    if (a && ana.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.id !== "fAra") { bekleyen = true; return; }
    const odakAra = a && a.id === "fAra", pos = odakAra ? a.selectionStart : 0;
    if (r.ad !== "konu") document.title = r.ad === "yeni" ? "Yeni konu · Forum · Zar Masası" : (st.q || st.kategori ? `${st.q || st.kategori} · ` : "") + "Forum · Zar Masası";
    ana.innerHTML = r.ad === "konu" ? konuHtml(r.id) : r.ad === "yeni" ? yeniHtml() : listeHtml();
    if (odakAra) { const i = $("#fAra"); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (e) {} } }
    const ys = $("#ysay"), ya = $("#fYanit"); if (ys && ya) ys.textContent = ya.value.length ? `${ya.value.length} / 4000` : "";
    if (r.ad === "konu" && st.kaydir && st.konular.has(r.id)) {
      const el = document.getElementById(st.kaydir);
      if (el) { st.kaydir = null; el.classList.add("vurgu"); el.scrollIntoView({ block: "center" }); }
      else if (st.yanitYuklendi || !(st.konular.get(r.id) || {}).yanit) st.kaydir = null;
    }
  }
  let bekleyen = false;
  document.addEventListener("focusout", () => setTimeout(() => { if (bekleyen && !($("#ana").contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) { bekleyen = false; ciz(); } }, 80));

  /* ---------------- Olaylar ---------------- */
  const ana = $("#ana");
  // Sayfa içi bağlantılar sayfayı yeniden yüklemeden açılır.
  ana.addEventListener("click", e => {
    const l = e.target.closest("a[data-git]");
    if (l && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) { e.preventDefault(); bekleyen = false; if (document.activeElement) document.activeElement.blur(); git(l.getAttribute("href")); return; }
    const b = e.target.closest("[data-a]"); if (!b) return;
    const r = rota(), t = r.ad === "konu" && st.konular.get(r.id), url = location.origin + "/forum/" + (r.id || "");
    switch (b.dataset.a) {
      case "kat": st.kategori = b.dataset.k; return git(listeAdresi(), true);
      case "temizle": st.q = ""; st.kategori = ""; st.sistem = ""; return git(listeAdresi(), true);
      case "kopya": return kopyala(url, "Konunun bağlantısı kopyalandı");
      case "paylas": navigator.share({ title: t ? t.baslik : "Forum", url }).catch(() => {}); return;
      case "ykopya": return kopyala(url + "#" + b.dataset.id, "Yanıtın bağlantısı kopyalandı");
      case "alinti": {
        const y = st.yanitlar.get(b.dataset.id); if (!y) return;
        const ad = (st.kisiler[y.yazar.id] || {}).kullanici || y.yazar.name;
        const alinti = String(y.govde || "").split("\n").slice(0, 6).map(s => "> " + s).join("\n");
        st.yanitTaslak = (st.yanitTaslak ? st.yanitTaslak + "\n\n" : "") + `${ad} yazdı:\n${alinti}\n\n`;
        const ta = $("#fYanit"); if (ta) { ta.value = st.yanitTaslak; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
        return;
      }
      case "sikayet": st.sikayet = b.dataset.id; ciz(); setTimeout(() => { const x = $("#sNeden"); if (x) x.focus(); }, 0); return;
      case "sikayetvazgec": st.sikayet = null; if (document.activeElement) document.activeElement.blur(); bekleyen = false; ciz(); return;
      case "sabitle": if (t) ZF.pin({ topic: t.id, sabit: !t.sabit }).catch(x => tost(x.message || "Olmadı")); return;
      case "ksil": if (t) onayli(b, () => ZF.remove({ topic: t.id }).then(() => { tost("Konu silindi"); git("/forum"); }).catch(x => tost(x.message || "Silinemedi"))); return;
      case "ysil": if (t) onayli(b, () => ZF.remove({ topic: t.id, post: b.dataset.id }).then(() => tost("Yanıt silindi")).catch(x => tost(x.message || "Silinemedi"))); return;
    }
  });
  ana.addEventListener("input", e => {
    const t = e.target;
    if (t.id === "fAra") { st.q = t.value; history.replaceState(null, "", listeAdresi()); ciz(); return; }
    if (t.id === "fBaslik") st.taslak.baslik = t.value;
    if (t.id === "fGovde") st.taslak.govde = t.value;
    if (t.id === "fYanit") { st.yanitTaslak = t.value; const s = $("#ysay"); if (s) s.textContent = t.value.length ? `${t.value.length} / 4000` : ""; }
  });
  ana.addEventListener("change", e => {
    const t = e.target;
    if (t.dataset.s) { st[t.dataset.s] = t.value; t.blur(); return git(listeAdresi(), true); }
    if (t.id === "fKategori") st.taslak.kategori = t.value;
    if (t.id === "fSistem") st.taslak.sistem = t.value;
  });
  ana.addEventListener("keydown", e => {
    if (e.target.id === "fAra" && e.key === "Escape" && st.q) { st.q = ""; e.target.value = ""; history.replaceState(null, "", listeAdresi()); ciz(); }
    if (e.target.id === "fYanit" && e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $("#yanitf").requestSubmit(); }
  });
  ana.addEventListener("submit", async e => {
    e.preventDefault(); if (st.gonderiyor) return;
    const f = e.target;
    try {
      st.gonderiyor = true;
      if (f.id === "yenif") {
        const d = st.taslak; if (!d.baslik.trim()) { $("#fBaslik").focus(); return; }
        const r = await ZF.topic({ title: d.baslik, body: d.govde, kategori: d.kategori, sistem: d.sistem || null });
        st.taslak = { baslik: "", govde: "", kategori: "Genel sohbet", sistem: "" };
        if (document.activeElement) document.activeElement.blur(); bekleyen = false;
        tost("Konu açıldı. Bağlantısını paylaşabilirsin."); git("/forum/" + r.id);
      } else if (f.dataset.sikayet) {
        const id = f.dataset.sikayet;
        await Z.call("sikayetEt", { yer: { tur: "forum", konu: rota().id, ...(id !== "ilk" ? { yanit: id } : {}) }, neden: $("#sNeden").value, aciklama: $("#sAciklama").value.trim() })
          .catch(x => { throw x.code === "unknown_op" ? new Error("Bu sunucuda şikâyet henüz açık değil") : x; });
        st.sikayet = null; if (document.activeElement) document.activeElement.blur(); bekleyen = false;
        tost("Şikâyetin yönetime iletildi. Teşekkürler.");
      } else if (f.id === "yanitf") {
        if (!st.yanitTaslak.trim()) { $("#fYanit").focus(); return; }
        const r = await ZF.reply({ topic: rota().id, body: st.yanitTaslak });
        st.yanitTaslak = ""; if (document.activeElement) document.activeElement.blur(); bekleyen = false;
        st.kaydir = r && r.id; history.replaceState(null, "", location.pathname + (r && r.id ? "#" + r.id : ""));
      }
    } catch (x) { tost(x.message || "Gönderilemedi"); }
    finally { st.gonderiyor = false; ciz(); }
  });
  window.addEventListener("hashchange", () => { if (rota().ad === "konu" && location.hash.length > 1) { st.kaydir = location.hash.slice(1); ciz(); } });

  /* ---------------- Başlangıç ---------------- */
  fetch("/api/info").then(r => r.json()).then(i => {
    if (Array.isArray(i.forum) && i.forum.length) KATEGORI = i.forum;
    if (i.sistemler && typeof i.sistemler === "object") SISTEM = i.sistemler;
    adrestenOku(); ciz();
  }).catch(() => {});
  adrestenOku(); ciz();
  Z.ready.then(() => {
    ME = Z.me() || {};
    Z.db().collection("forum").onSnapshot(s => {
      for (const c of s.docChanges()) c.type === "removed" ? st.konular.delete(c.doc.id) : st.konular.set(c.doc.id, { id: c.doc.id, ...c.doc.data() });
      st.yuklendi = true; kisileriGetir([...st.konular.values()].map(t => t.yazar && t.yazar.id)); ciz();
    }, () => {});
  });
})();
