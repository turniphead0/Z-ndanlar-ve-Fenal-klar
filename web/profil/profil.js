/* Profil sayfası (/profil): bir oyuncunun ayrı, paylaşılabilir sayfası.
   /profil               kendi profilin (Ayarlar sekmesiyle)
   /profil?kisi=<kimlik>  başkasının profili (her yerde kişi adına tıklanınca buraya gelinir, web/shim.js: zmKisi)
   /profil?ad=<kullanıcı> kullanıcı adıyla
   Sekmeler adresin sonunda durur (#oyunlar, #konular, #yanitlar, #ayarlar) ki bağlantı paylaşılabilsin.
   Veri: kisi (server/hesap.js), profilOyunlar (server/dosyalar.js), profilForum (server/profil.js), profiles (çevrimiçi). */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const Z = window.zmSunucu;
  const RENKLER = ["#2f8f86", "#c0392b", "#8e44ad", "#2980b9", "#d4880f", "#27ae60", "#d35400", "#7f8c8d"];
  const TELEFON = /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent);
  const UYGULAMA = /ZarMasasiApp/.test(navigator.userAgent); // Android uygulaması
  const q = new URLSearchParams(location.search);

  const st = { uid: null, ben: false, p: null, cevrimici: false, oyun: null, forum: null, sekme: "oyunlar", oyunSuz: "hepsi", oyunHata: null, forumHata: null };
  let ME = null;

  /* ---------------- Yardımcılar ---------------- */
  function tost(t) { const el = $("#tost"); el.textContent = t; el.hidden = false; clearTimeout(tost.t); tost.t = setTimeout(() => (el.hidden = true), 2800); }
  const cagir = (op, a) => Z.call(op, a).catch(e => { tost((e && e.message) || "Bir şey ters gitti"); throw e; });
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
  const tarih = t => new Date(t).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const harf = s => esc(String(s || "?").trim().charAt(0).toLocaleUpperCase("tr"));
  function av(p, boy) {
    return `<span class="av ${boy || ""}" style="--av:${esc(p.renk || "#7f8c8d")}" aria-hidden="true">${p.foto ? `<img src="${esc(p.foto)}" alt="" loading="lazy">` : harf(p.kullanici || p.ad)}</span>`;
  }
  const kisiA = (id, ad) => (Z.kisiHtml ? Z.kisiHtml(id, ad) : esc(ad));
  // İki dokunuşlu onay: ilk dokunuşta düğme "Emin misin?" olur.
  function onayli(btn, fn) {
    if (btn.dataset.onay === "1") { btn.dataset.onay = ""; fn(); return; }
    const eski = btn.textContent; btn.dataset.onay = "1"; btn.textContent = "Emin misin?";
    setTimeout(() => { if (btn.isConnected && btn.dataset.onay === "1") { btn.dataset.onay = ""; btn.textContent = eski; } }, 3000);
  }
  // Forum başlığının adresi: bilgisayarda ana ekrandaki forum, telefonda mobil forum.
  const konuAdresi = id => (TELEFON ? "/mobil#forum-konu/" : "/?forum=") + encodeURIComponent(id);
  const masaAdresi = id => "/oyunlar#" + encodeURIComponent(id);
  const frpAdresi = id => (TELEFON ? "/?mobil=1#" : "/#") + encodeURIComponent(id);

  /* ---------------- Geri ---------------- */
  $("#geri").addEventListener("click", () => {
    let ayni = false; try { ayni = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) {}
    if (ayni && history.length > 1) history.back(); else location.href = TELEFON ? "/mobil" : "/";
  });
  if (TELEFON) { $("#ana-link").href = "/mobil"; $("#nav-masalar").href = "/mobil#masalar"; }

  /* ---------------- Sekmeler ---------------- */
  function sekmeler() {
    const o = st.oyun, f = st.forum;
    const say = n => (n == null ? "" : `<b class="say num">${n}</b>`);
    const l = [
      ["oyunlar", "Oyunlar", o ? o.masa.length + o.frp.length : null],
      ["konular", "Forum konuları", f ? f.sayi.konu : null],
      ["yanitlar", "Forum yanıtları", f ? f.sayi.yanit : null],
    ];
    if (st.ben) l.push(["ayarlar", "Ayarlar", null]);
    return `<div class="sekmeler" role="tablist" aria-label="Profil bölümleri">${l.map(([k, ad, n]) => `<a role="tab" href="#${k}" id="sek-${k}" aria-controls="panel" aria-selected="${st.sekme === k}" tabindex="${st.sekme === k ? 0 : -1}">${ad}${say(n)}</a>`).join("")}</div>`;
  }
  function sekmeOku() {
    const h = location.hash.slice(1);
    st.sekme = ["oyunlar", "konular", "yanitlar"].includes(h) || (h === "ayarlar" && st.ben) ? h : "oyunlar";
  }
  window.addEventListener("hashchange", () => { sekmeOku(); ciz(); });

  /* ---------------- Üst kısım (kapak, ad, düğmeler, sayılar) ---------------- */
  function dugmeler() {
    const p = st.p;
    if (st.ben) return `<a class="btn" href="#ayarlar">Profili düzenle</a><button class="btn" data-a="paylas" type="button">Bağlantıyı kopyala</button>`;
    if (!p.kullanici) return "";
    const d = p.arkadas;
    const mesaj = `<button class="btn pri" data-a="mesaj" type="button">Mesaj gönder</button>`;
    const ark = d === "arkadas" ? `${mesaj}<button class="btn kotu" data-a="cikar" type="button">Arkadaşlıktan çıkar</button>`
      : d === "gelen" ? `<button class="btn pri" data-a="kabul" type="button">İsteği kabul et</button><button class="btn" data-a="reddet" type="button">Reddet</button>`
      : d === "giden" ? `<button class="btn" data-a="gerical" type="button">İstek gönderildi · geri çek</button>`
      : `<button class="btn pri" data-a="ekle" type="button">+ Arkadaş ekle</button>`;
    return ark + `<button class="btn" data-a="paylas" type="button">Bağlantıyı kopyala</button>`;
  }
  function sayilar() {
    const o = st.oyun, f = st.forum, n = v => (v == null ? "…" : v);
    const galibiyet = o ? o.masa.filter(b => b.kazandi === true).length : null;
    const l = [
      ["oyunlar", n(o && o.frp.length), "FRP masası"],
      ["oyunlar", n(o && o.masa.length), "masa oyunu"],
      ["oyunlar", n(galibiyet), "galibiyet"],
      ["konular", n(f && f.sayi.konu), "forum konusu"],
      ["yanitlar", n(f && f.sayi.yanit), "yanıt"],
    ];
    return `<ul class="sayilar">${l.map(([s, v, ad]) => `<li><a href="#${s}"><b class="num">${v}</b><span>${ad}</span></a></li>`).join("")}</ul>`;
  }
  function kapak() {
    const p = st.p, ad = p.kullanici || p.ad;
    return `<section class="kapak" style="--kr:${esc(p.renk || "#2f8f86")}">
      <div class="kapak-serit" aria-hidden="true"></div>
      <div class="kapak-ic">
        <div class="kapak-av">${av(p, "b")}${st.cevrimici ? `<i class="on" title="Çevrimiçi"></i>` : ""}</div>
        <div class="kimlik">
          <h1 data-noi18n>${esc(ad)}${st.ben ? ` <small>(sen)</small>` : ""}</h1>
          <p class="alt">${st.cevrimici ? `<span class="durum on">Çevrimiçi</span>` : `<span class="durum">Çevrimdışı</span>`}${p.katildi ? `<span>Üyelik: ${new Date(p.katildi).toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}</span>` : ""}${!p.kullanici ? `<span>Hesapsız oyuncu</span>` : ""}</p>
          ${p.hakkinda ? `<p class="hakkinda" data-noi18n>${esc(p.hakkinda)}</p>` : st.ben ? `<p class="hakkinda bos">Kendinden biraz bahset: hangi oyunları seversin, ne zaman oynarsın? <a href="#ayarlar">Hakkımda yaz</a></p>` : ""}
        </div>
        <div class="dugmeler">${dugmeler()}</div>
      </div>
      ${sayilar()}
    </section>`;
  }

  /* ---------------- Oyunlar sekmesi ---------------- */
  const DURUM_AD = { bekliyor: "Oyuncu bekliyor", oynaniyor: "Oynanıyor", bitti: "Bitti" };
  function oyunlarPanel() {
    const v = st.oyun;
    if (st.oyunHata && !v) return `<div class="bos"><h2>Oyunlar yüklenemedi</h2><p>${esc(st.oyunHata)}</p></div>`;
    if (!v) return `<div class="bos">Oyunlar yükleniyor…</div>`;
    const ben = st.ben, sende = v.masa.filter(b => b.siraSende).length;
    const suz = st.oyunSuz;
    const cip = (k, ad, n) => `<button class="cip" type="button" data-a="osuz" data-k="${k}" aria-pressed="${suz === k}">${ad} <span class="num">${n}</span></button>`;
    const masa = v.masa.map(b => {
      const kisiler = b.oyuncular.filter(o => !ben || o.id !== ME.id).map(o => o.bot ? `${esc(o.ad)} <small>(bot)</small>` : kisiA(o.id, o.ad)).join(", ");
      const rozet = b.siraSende && ben ? `<span class="rozet vurgu">Sıra sende</span>` : b.durum === "bitti" ? `<span class="rozet ${b.kazandi ? "altin" : ""}">${b.kazandi === true ? "Kazandı" : b.kazandi === false ? "Kaybetti" : "Bitti"}</span>` : `<span class="rozet">${DURUM_AD[b.durum]}</span>`;
      return `<li class="okart"><span class="osimge ${b.tur}" aria-hidden="true">${b.tur === "kart" ? "🃏" : "♟"}</span>
        <div class="oic"><a class="obaslik" href="${masaAdresi(b.id)}" data-noi18n>${esc(b.ad || b.oyunAd)}</a>
          <small>${b.ad ? esc(b.oyunAd) + " · " : ""}${kisiler ? (ben ? "Rakip: " : "Masada: ") + kisiler : "kimse yok"} · ${zaman(b.updated)}</small></div>${rozet}</li>`;
    }).join("");
    const frp = v.frp.map(g => `<li class="okart"><span class="osimge frp" aria-hidden="true">🎲</span>
        <div class="oic"><a class="obaslik" href="${frpAdresi(g.id)}" data-noi18n>${esc(g.ad)}</a>
          <small>${esc(g.sistemAd || "")} · ${g.oyuncu} oyuncu · ${g.acik ? "Açık katılım" : "Onaylı katılım"}${g.masada ? ` · <b class="onl">şu an masada ${g.masada} kişi</b>` : ""} · ${zaman(g.updated)}</small></div>
        <span class="rozet${g.rol === "dm" ? " altin" : ""}">${g.rol === "dm" ? "Yönetici (DM)" : "Oyuncu"}</span></li>`).join("");
    const bolum = (ad, n, html, bosMetin) => `<h2 class="bolum">${ad} <small>(${n})</small></h2>${html ? `<ul class="oliste">${html}</ul>` : `<p class="ipucu">${bosMetin}</p>`}`;
    return `<div class="cipler">${cip("hepsi", "Hepsi", v.masa.length + v.frp.length)}${cip("masa", "Masa oyunları", v.masa.length)}${cip("frp", "FRP'ler", v.frp.length)}${ben && sende ? `<span class="rozet vurgu">${sende} oyunda sıra sende</span>` : ""}</div>
      ${suz !== "frp" ? bolum("Masa oyunları", v.masa.length, masa, ben ? `Henüz bir masa oyununda değilsin. <a href="/oyunlar">Masa oyunları</a> sayfasından bir oda açabilir ya da açık bir odaya katılabilirsin.` : "Şu an bir masa oyununda değil.") : ""}
      ${suz !== "masa" ? bolum("FRP masaları", v.frp.length, frp, ben ? `Henüz bir FRP masasında değilsin. <a href="${TELEFON ? "/mobil#masalar" : "/"}">Masalar</a> sayfasından katılabilirsin.` : "Şu an bir FRP masasında değil.") : ""}`;
  }

  /* ---------------- Forum sekmeleri ---------------- */
  function konularPanel() {
    const f = st.forum;
    if (st.forumHata && !f) return `<div class="bos"><h2>Forum yüklenemedi</h2><p>${esc(st.forumHata)}</p></div>`;
    if (!f) return `<div class="bos">Yükleniyor…</div>`;
    if (!f.konular.length) return `<div class="bos"><h2>Henüz konu açmamış</h2><p>${st.ben ? `Oyuncu aramak, kural sormak ya da hazırladığın bir haritayı paylaşmak için <a href="${TELEFON ? "/mobil#forum-yeni" : "/"}">forumda bir konu aç</a>.` : "Bu oyuncu forumda henüz konu açmadı."}</p></div>`;
    return `${f.sayi.konu > f.konular.length ? `<p class="ipucu">En yeni ${f.konular.length} konu gösteriliyor.</p>` : ""}<ul class="fliste">${f.konular.map(t => `<li class="fkart">
      <a class="fbaslik" href="${konuAdresi(t.id)}" data-noi18n>${t.sabit ? `<span class="rozet altin">Sabit</span> ` : ""}${esc(t.baslik)}</a>
      ${t.ozet ? `<p class="fozet" data-noi18n>${esc(t.ozet)}</p>` : ""}
      <p class="fmeta"><span class="rozet">${esc(t.kategori)}</span><span>${zaman(t.created)}</span><span><b class="num">${t.yanit}</b> yanıt</span>${t.updated > t.created + 60000 && t.yanit ? `<span>son yanıt ${zaman(t.updated)}</span>` : ""}</p></li>`).join("")}</ul>`;
  }
  function yanitlarPanel() {
    const f = st.forum;
    if (st.forumHata && !f) return `<div class="bos"><h2>Forum yüklenemedi</h2><p>${esc(st.forumHata)}</p></div>`;
    if (!f) return `<div class="bos">Yükleniyor…</div>`;
    if (!f.yanitlar.length) return `<div class="bos"><h2>Henüz yanıt yazmamış</h2><p>${st.ben ? "Forumdaki konulara yazdığın yanıtlar burada toplanır." : "Bu oyuncu forumda henüz yanıt yazmadı."}</p></div>`;
    return `${f.sayi.yanit > f.yanitlar.length ? `<p class="ipucu">En yeni ${f.yanitlar.length} yanıt gösteriliyor.</p>` : ""}<ul class="fliste">${f.yanitlar.map(y => `<li class="fkart">
      <p class="fust"><span class="ipucu">Yanıt:</span> <a class="fbaslik k" href="${konuAdresi(y.konu)}" data-noi18n>${esc(y.baslik)}</a></p>
      <p class="fozet alinti" data-noi18n>${esc(y.ozet)}</p>
      <p class="fmeta"><span class="rozet">${esc(y.kategori)}</span><span>${zaman(y.created)}</span></p></li>`).join("")}</ul>`;
  }

  /* ---------------- Ayarlar (yalnızca kendi profilin) ---------------- */
  function ayarlarPanel() {
    return `<div class="ayarlar">
      <section class="kutu"><h2>Fotoğraf</h2>
        <div class="satir">${av(st.p, "o")}<div class="dugmeler"><button class="btn" type="button" data-a="foto">Fotoğraf ${st.p.foto ? "değiştir" : "ekle"}</button>${st.p.foto ? `<button class="btn" type="button" data-a="fotosil">Kaldır</button>` : ""}</div></div>
        <p class="ipucu">Kare olarak kırpılır ve küçültülür. Fotoğraf yoksa adının ilk harfi rengin üstünde görünür.</p></section>
      <section class="kutu"><h2>Hakkımda</h2>
        <form id="hakf" class="form"><textarea class="f" name="h" maxlength="500" rows="4" placeholder="Hangi oyunları seversin, ne zaman oynarsın?" aria-label="Hakkımda">${esc(st.p.hakkinda || "")}</textarea>
        <div class="dugmeler"><button class="btn pri">Kaydet</button><span class="ipucu" id="haksay"></span></div></form></section>
      <section class="kutu"><h2>Rengim</h2><p class="ipucu">Masada imlecin, zar sonuçların ve profil kapağın bu renkte görünür.</p>
        <div class="renkler">${RENKLER.map(c => `<button class="renk" type="button" data-a="renk" data-c="${c}" style="background:${c}" aria-label="Renk ${c}" aria-pressed="${c.toLowerCase() === String(st.p.renk || "").toLowerCase()}"></button>`).join("")}</div></section>
      <section class="kutu"><h2>Şifre değiştir</h2>
        <form class="form" id="sifref"><input class="f" type="password" name="eski" placeholder="Şu anki şifre" autocomplete="current-password" required aria-label="Şu anki şifre">
          <input class="f" type="password" name="yeni" placeholder="Yeni şifre (en az 8 karakter)" minlength="8" autocomplete="new-password" required aria-label="Yeni şifre">
          <input class="f" type="password" name="yeni2" placeholder="Yeni şifre (tekrar)" autocomplete="new-password" required aria-label="Yeni şifre tekrar">
          <div class="dugmeler"><button class="btn">Şifreyi değiştir</button></div></form></section>
      <section class="kutu"><h2>Dosyalar ve hesap</h2>
        <div class="dugmeler"><a class="btn" href="/mobil#dosyalar">📁 Yüklediklerim ve oyun yedekleri</a>
          ${TELEFON ? `<a class="btn" href="/?masaustu=1">Bilgisayar görünümünü aç</a>` : ""}${UYGULAMA ? `<a class="btn" href="http://localhost/?degistir=1">Sunucuyu değiştir</a>` : ""}</div>
        <p class="ipucu" id="oturumsay"></p>
        <div class="dugmeler"><button class="btn" type="button" data-a="tumcikis">Öteki cihazlardan çıkış yap</button><button class="btn kotu" type="button" data-a="cikis">Çıkış yap</button></div></section>
    </div>`;
  }
  function ayarlarBagla() {
    const f = $("#hakf"); if (!f) return;
    const say = () => { $("#haksay").textContent = `${f.h.value.length} / 500`; };
    f.h.addEventListener("input", say); say();
    f.addEventListener("submit", async e => { e.preventDefault(); try { await cagir("profilYaz", { hakkinda: f.h.value }); st.p.hakkinda = f.h.value.trim(); tost("Kaydedildi"); ciz(); } catch (x) {} });
    $("#sifref").addEventListener("submit", async e => {
      e.preventDefault(); const s = e.target;
      if (s.yeni.value !== s.yeni2.value) return tost("Yeni şifreler aynı değil");
      try { await cagir("sifreDegistir", { eski: s.eski.value, yeni: s.yeni.value }); s.reset(); tost("Şifren değişti. Öteki cihazlarda yeniden giriş yapman gerekecek."); } catch (x) {}
    });
    Z.call("oturumlar", {}).then(r => { const p = $("#oturumsay"); if (p) p.textContent = r.sayi > 1 ? `Hesabın ${r.sayi} cihazda açık. 30 gün kullanılmayan cihazlarda oturum kendiliğinden kapanır.` : "Hesabın yalnızca bu cihazda açık."; }).catch(() => {});
  }

  /* ---------------- Çizim ---------------- */
  function ciz() {
    const ana = $("#ana");
    if (!st.p) return;
    const ad = st.p.kullanici || st.p.ad;
    document.title = (st.ben ? "Profilim" : ad) + " · Zar Masası";
    // Yazı yazılan bir alan varsa (Ayarlar) yalnızca üst kısmı yenile, yazılanlar silinmesin.
    const a = document.activeElement;
    if (st.sekme === "ayarlar" && a && ana.contains(a) && /INPUT|TEXTAREA/.test(a.tagName) && $("#panel")) {
      $(".kapak").outerHTML = kapak(); $(".sekmeler").outerHTML = sekmeler(); return;
    }
    const panel = st.sekme === "konular" ? konularPanel() : st.sekme === "yanitlar" ? yanitlarPanel() : st.sekme === "ayarlar" ? ayarlarPanel() : oyunlarPanel();
    ana.innerHTML = kapak() + sekmeler() + `<section class="panel" id="panel" role="tabpanel" aria-labelledby="sek-${st.sekme}">${panel}</section>`;
    if (st.sekme === "ayarlar") ayarlarBagla();
  }
  function benAvatar() {
    const me = Z.me() || {};
    $("#ben").innerHTML = me.kullanici ? av({ renk: me.color, foto: me.foto, kullanici: me.kullanici }, "k") : "";
    $("#ben").hidden = !me.kullanici;
  }

  /* ---------------- Veri ---------------- */
  async function profilYukle() {
    const p = await Z.call("kisi", st.uid ? { kisi: st.uid } : { kullanici: q.get("ad") });
    st.p = p; st.uid = p.id; st.ben = p.id === ME.id;
    if (st.ben && (q.has("kisi") || q.has("ad"))) history.replaceState(null, "", "/profil" + location.hash); // kendi profilin: kısa adres
    try { const r = await Z.call("profiles", { ids: [p.id] }); st.cevrimici = st.ben || !!(r[p.id] && r[p.id].cevrimici); } catch (e) {}
  }
  async function oyunYukle() {
    try { st.oyun = await Z.call("profilOyunlar", { kisi: st.uid }); st.oyunHata = null; } catch (e) { st.oyunHata = e.message; }
  }
  async function forumYukle() {
    try { st.forum = await Z.call("profilForum", { kisi: st.uid }); st.forumHata = null; } catch (e) { st.forumHata = e.message; }
  }

  /* ---------------- Olaylar ---------------- */
  // Sekmelerde ok tuşlarıyla gezinme.
  document.addEventListener("keydown", e => {
    const t = e.target.closest && e.target.closest("[role=tab]"); if (!t || !/^Arrow(Left|Right)$/.test(e.key)) return;
    const l = [...document.querySelectorAll("[role=tab]")], i = l.indexOf(t), n = l[(i + (e.key === "ArrowRight" ? 1 : l.length - 1)) % l.length];
    e.preventDefault(); location.hash = n.getAttribute("href").slice(1); setTimeout(() => { const y = document.getElementById(n.id); if (y) y.focus(); }, 0);
  });

  // Mesaj penceresi: bilgisayarda bu sayfanın üstünde açılır, telefonda mobil mesajlara gidilir.
  let pano = null;
  function mesajAc(uid) {
    if (TELEFON) { location.href = "/mobil#mesaj/" + encodeURIComponent(uid); return; }
    if (!pano) {
      pano = document.createElement("div"); pano.className = "spano"; pano.setAttribute("role", "dialog"); pano.setAttribute("aria-label", "Mesajlar");
      pano.innerHTML = `<iframe title="Mesajlar" src="/mobil?gomulu=1#mesaj/${encodeURIComponent(uid)}"></iframe>`;
      pano.addEventListener("click", e => { if (e.target === pano) pano.hidden = true; });
      document.body.appendChild(pano);
    } else { pano.hidden = false; pano.querySelector("iframe").contentWindow.location.hash = "mesaj/" + uid; }
  }
  window.addEventListener("message", e => { if (e.origin === location.origin && e.data && e.data.zm === "sosyal-kapat" && pano) pano.hidden = true; });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && pano && !pano.hidden) pano.hidden = true; });

  async function kucult(file) {
    if (!/^image\//.test(file.type)) throw new Error("Bir resim seç");
    let img;
    try { img = await createImageBitmap(file); }
    catch (e) { img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Resim açılamadı")); i.src = URL.createObjectURL(file); }); }
    const k = Math.min(img.width, img.height), o = Math.min(1, 384 / k), cv = document.createElement("canvas");
    cv.width = cv.height = Math.round(k * o);
    cv.getContext("2d").drawImage(img, (img.width - k) / 2, (img.height - k) / 2, k, k, 0, 0, cv.width, cv.height);
    const blob = await new Promise(r => cv.toBlob(r, "image/jpeg", 0.85));
    return new File([blob], "foto.jpg", { type: "image/jpeg" });
  }
  const dosyaSec = () => new Promise(res => { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; i.onchange = () => res(i.files[0] || null); i.click(); });
  async function arkadasYenile() { try { const p = await Z.call("kisi", { kisi: st.uid }); st.p.arkadas = p.arkadas; } catch (e) {} ciz(); }

  $("#ana").addEventListener("click", async e => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    const a = b.dataset.a, uid = st.uid;
    try {
      switch (a) {
        case "osuz": st.oyunSuz = b.dataset.k; ciz(); return;
        case "mesaj": return mesajAc(uid);
        case "paylas": {
          const url = location.origin + "/profil?kisi=" + encodeURIComponent(uid);
          try { await navigator.clipboard.writeText(url); tost("Profil bağlantısı kopyalandı"); } catch (x) { prompt("Profil bağlantısı:", url); }
          return;
        }
        case "ekle": b.disabled = true; { const r = await cagir("arkadasIstek", { kisi: uid }); tost(r === "arkadas" ? "Artık arkadaşsınız" : "Arkadaşlık isteği gönderildi"); } return arkadasYenile();
        case "kabul": b.disabled = true; await cagir("arkadasKabul", { kisi: uid }); tost("Artık arkadaşsınız"); return arkadasYenile();
        case "reddet": case "gerical": b.disabled = true; await cagir("arkadasSil", { kisi: uid }); return arkadasYenile();
        case "cikar": return onayli(b, async () => { await cagir("arkadasSil", { kisi: uid }); arkadasYenile(); });
        case "foto": {
          const f = await dosyaSec(); if (!f) return;
          b.disabled = true; tost("Yükleniyor…");
          const up = await Z.upload(await kucult(f), { yer: "profil" });
          const p = await cagir("profilYaz", { foto: up.id }); st.p.foto = p.foto; Z.me().foto = p.foto; benAvatar(); ciz(); tost("Profil fotoğrafın güncellendi"); return;
        }
        case "fotosil": { await cagir("profilYaz", { foto: null }); st.p.foto = null; Z.me().foto = null; benAvatar(); ciz(); return; }
        case "renk": {
          const p = await cagir("profilYaz", { renk: b.dataset.c }); st.p.renk = p.renk; Z.me().color = p.renk;
          try { localStorage.setItem("zm-color", p.renk); } catch (x) {}
          benAvatar(); ciz(); return;
        }
        case "cikis": return onayli(b, () => Z.cikis());
        case "tumcikis": return onayli(b, async () => { const r = await cagir("tumCikis", {}); tost(r.kapanan ? `${r.kapanan} cihazda oturum kapatıldı` : "Başka cihazda açık oturum yoktu"); ciz(); });
      }
    } catch (x) { b.disabled = false; if (x && x.message && !x.code) tost(x.message); }
  });

  /* ---------------- Başlangıç ---------------- */
  async function basla() {
    await Z.ready;
    ME = Z.me() || {};
    benAvatar();
    if (!Z.hesapli()) {
      $("#ana").innerHTML = `<div class="bos buyuk"><h2>Profiller için giriş yap</h2><p>Oyuncuların profillerini görmek ve kendi profilini düzenlemek için bir kullanıcı adı ve şifre gerekiyor. Şimdiye kadarki masaların ve karakterlerin yeni hesabına taşınır.</p><button class="btn pri" id="hesapac" type="button">Giriş yap ya da hesap oluştur</button></div>`;
      $("#hesapac").addEventListener("click", () => Z.girisEkrani({ kayit: true }));
      return;
    }
    const k = q.get("kisi");
    st.uid = k && /^u-[0-9a-f]{8,}$/.test(k) ? k : !q.get("ad") ? ME.id : null;
    try { await profilYukle(); }
    catch (e) {
      document.title = "Bulunamadı · Zar Masası";
      $("#ana").innerHTML = `<div class="bos buyuk"><h2>Böyle bir oyuncu bulunamadı</h2><p>Bağlantı yanlış olabilir ya da hesap silinmiş olabilir.</p><a class="btn" href="${TELEFON ? "/mobil" : "/"}">Ana ekrana dön</a></div>`;
      return;
    }
    sekmeOku(); ciz();
    await Promise.all([oyunYukle(), forumYukle()]); ciz();
    // Açıkken oyunlar ve çevrimiçi durumu ara ara tazelenir.
    setInterval(async () => {
      if (document.hidden) return;
      const once = JSON.stringify([st.oyun, st.cevrimici]);
      await oyunYukle();
      try { const r = await Z.call("profiles", { ids: [st.uid] }); st.cevrimici = st.ben || !!(r[st.uid] && r[st.uid].cevrimici); } catch (e) {}
      if (JSON.stringify([st.oyun, st.cevrimici]) !== once) ciz();
    }, 20000);
  }
  basla();
})();
