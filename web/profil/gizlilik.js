/* Profil sayfasında gizlilik (server/gizlilik.js):
   - başkasının profilinde: Engelle / Engeli kaldır ve Şikâyet et (… menüsünde), gizli profil görünümü;
   - kendi Ayarlar sekmesinde: profil görünürlüğü, engellenenler, "Verilerimi indir" ve hesap silme.
   web/profil/profil.js bu dosyadaki window.zmGizlilik'i çağırır. */
(function () {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const Z = () => window.zmSunucu;
  const NEDENLER = { taciz: "Taciz ya da hakaret", spam: "İstenmeyen ileti (spam)", uygunsuz: "Uygunsuz içerik", hile: "Hile ya da oyunu bozma", taklit: "Başkasını taklit etme", diger: "Diğer" };
  const GORUNUM = [
    ["herkes", "Herkese açık", "Bütün oyuncular profilini (hakkında yazını, oyunlarını, forum yazılarını, çevrimiçi olduğunu) görür ve seni aramada bulur."],
    ["arkadaslar", "Yalnızca arkadaşlarım", "Başkaları yalnızca adını ve fotoğrafını görür. Seni aramada bulup arkadaşlık isteği gönderebilirler."],
    ["gizli", "Gizli", "Profilin kimseye görünmez ve kişi aramasında çıkmazsın. Arkadaşların seni bulup mesajlaşmaya devam eder."],
  ];

  /* ---------------- Başkasının profili ---------------- */
  function dugmeler(p) {
    if (!p.kullanici) return "";
    const engel = p.engelledim
      ? `<button class="btn" type="button" data-a="gz-engelkaldir">Engeli kaldır</button>`
      : `<button class="btn kotu" type="button" data-a="gz-engelle">Engelle</button>`;
    const sikayet = `<button class="btn" type="button" data-a="gz-sikayet">Şikâyet et</button>`;
    if (p.engelledim) return `<span class="rozet">Engelledin</span>${engel}${sikayet}`;
    return `<details class="gz-menu"><summary class="btn" aria-label="Diğer işlemler" title="Diğer işlemler">⋯</summary><div class="gz-menu-ic">${engel}${sikayet}</div></details>`;
  }
  function gizliPanel(p) {
    if (p.engelledim) return `<div class="bos"><h2>Bu kişiyi engelledin</h2><p>Sana mesaj, arkadaşlık isteği ya da bildirim gönderemez. İstersen yukarıdan engeli kaldırabilirsin.</p></div>`;
    return `<div class="bos"><h2>Bu profil gizli</h2><p>${esc(p.kullanici || p.ad)} profilini ${p.arkadas === "arkadas" ? "kimseye açmıyor" : "yalnızca arkadaşlarına açıyor olabilir"}. ${p.arkadas === "arkadas" ? "" : "Arkadaş olursanız daha fazlasını görebilirsin."}</p></div>`;
  }

  // Şikâyet penceresi.
  function sikayetAc(ctx) {
    const p = ctx.st.p, d = document.createElement("dialog");
    d.className = "gz-pencere"; d.setAttribute("aria-label", "Şikâyet et");
    d.innerHTML = `<form method="dialog" class="form" id="gz-sikf">
      <h2>${esc(p.kullanici || p.ad)} kişisini şikâyet et</h2>
      <p class="ipucu">Şikâyetini yalnızca sunucunun yöneticileri görür. Şikâyet edilen kişiye kimin şikâyet ettiği söylenmez.</p>
      <label class="gz-etiket">Neden?<select class="f" name="neden" required>${Object.entries(NEDENLER).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select></label>
      <label class="gz-etiket">Ne oldu? <span class="ipucu">(isteğe bağlı, "Diğer" seçtiysen gerekli)</span><textarea class="f" name="aciklama" maxlength="1000" rows="4" placeholder="Kısaca anlat: nerede, ne zaman, ne yazdı?"></textarea></label>
      <label class="gz-kutucuk"><input type="checkbox" name="mesaj"> <span>Aramızdaki son 10 özel mesajı da ekle (yöneticiler görebilsin)</span></label>
      <div class="dugmeler"><button class="btn pri" value="gonder">Şikâyeti gönder</button><button class="btn" value="iptal" formnovalidate>Vazgeç</button></div></form>`;
    document.body.appendChild(d);
    const f = d.querySelector("form");
    f.addEventListener("submit", async e => {
      if (e.submitter && e.submitter.value === "iptal") return;
      e.preventDefault();
      const btn = f.querySelector("button.pri"); btn.disabled = true;
      try {
        const r = await Z().call("sikayetEt", { kisi: p.id, neden: f.neden.value, aciklama: f.aciklama.value, mesajlarEkle: f.mesaj.checked });
        d.close(); ctx.tost(r.yinelendi ? "Açık şikâyetin güncellendi" : "Şikâyetin yöneticilere iletildi. Teşekkürler.");
      } catch (x) { ctx.tost(x.message); btn.disabled = false; }
    });
    d.addEventListener("close", () => d.remove());
    if (d.showModal) d.showModal(); else d.setAttribute("open", "");
    f.neden.focus();
  }

  /* ---------------- Kendi Ayarlar sekmesi ---------------- */
  function ayarlarHtml() {
    return `<section class="kutu" id="gz-gizlilik"><h2>Gizlilik</h2>
        <p class="ipucu">Profilin kimlere açık olsun?</p>
        <div class="gz-secenekler" role="radiogroup" aria-label="Profil görünürlüğü">${GORUNUM.map(([k, ad, alt]) => `<label class="gz-secenek"><input type="radio" name="gz-gorunum" value="${k}" disabled> <span><b>${ad}</b><small>${alt}</small></span></label>`).join("")}</div>
        <h3 class="gz-alt">Engellediklerim</h3>
        <div id="gz-engel"><p class="ipucu">Yükleniyor…</p></div>
        <p class="ipucu">Engellediğin kişi sana mesaj, arkadaşlık isteği ya da bildirim gönderemez ve profilini göremez. Engellendiği ona söylenmez. Birini engellemek için onun profilindeki ⋯ düğmesini kullan.</p></section>
      <section class="kutu"><h2>Verilerin</h2>
        <p class="ipucu">Sunucunun senin hakkında sakladığı her şeyi (hesap bilgilerin, profilin, arkadaşların, mesajların, bildirimlerin, forum yazıların, oyun sohbetinde yazdıkların ve yüklediğin dosyalar) tek bir .zip dosyası olarak indirebilirsin. Şifren yalnızca geri çevrilemez bir özet olarak saklandığı için içinde yoktur.</p>
        <div class="dugmeler"><button class="btn" type="button" data-a="gz-indir">⬇ Verilerimi indir</button></div></section>
      <section class="kutu gz-tehlike"><h2>Hesabı sil</h2>
        <p class="ipucu">Hesabın, e-posta adresin, profilin, arkadaşlıkların, mesaj kutun, bildirimlerin, yalnızca senin oynadığın masalar, oyun sohbetinde yazdıkların ve başka yerde kullanılmayan yüklemelerin <b>kalıcı olarak silinir</b>. Başkalarıyla oynadığın masalar onlar için kalır; orada adın "Silinmiş hesap" görünür (DM'i kalmayan FRP masasında ilk oyuncu DM olur). Arkadaşlarının kendi kutularındaki mesajlar onlarda kalır. Kullanıcı adın serbest kalır. Bu geri alınamaz; önce verilerini indirmek isteyebilirsin.</p>
        <form class="form" id="gz-silf">
          <input class="f" type="password" name="sifre" placeholder="Şifren" autocomplete="current-password" required aria-label="Şifren">
          <label class="gz-kutucuk"><input type="checkbox" name="forum" checked> <span>Forumdaki konularımı ve yanıtlarımı da sil <span class="ipucu">(işaretlemezsen yazıların adın silinerek kalır)</span></span></label>
          <label class="gz-kutucuk"><input type="checkbox" name="onay" required> <span>Hesabımın ve verilerimin kalıcı olarak silineceğini anlıyorum</span></label>
          <div class="dugmeler"><button class="btn kotu gz-sil">Hesabımı kalıcı olarak sil</button></div></form></section>`;
  }
  function engelListe(l) {
    const el = document.getElementById("gz-engel"); if (!el) return;
    el.innerHTML = l.length ? `<ul class="gz-engelliler">${l.map(k => `<li><a href="/profil?kisi=${encodeURIComponent(k.id)}">${esc(k.kullanici || k.ad)}</a><span class="ipucu">${new Date(k.t).toLocaleDateString("tr-TR")}</span><button class="btn" type="button" data-a="gz-engelkaldir" data-kisi="${esc(k.id)}">Engeli kaldır</button></li>`).join("")}</ul>` : `<p class="ipucu">Kimseyi engellemedin.</p>`;
  }
  async function bagla(ctx) {
    const kok = document.getElementById("gz-gizlilik"); if (!kok) return;
    kok.addEventListener("change", async e => {
      const r = e.target.closest("input[name=gz-gorunum]"); if (!r) return;
      try { await Z().call("gizlilikAyar", { gorunum: r.value }); ctx.tost("Gizlilik ayarın kaydedildi"); }
      catch (x) { ctx.tost(x.message); }
    });
    const f = document.getElementById("gz-silf");
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const btn = f.querySelector(".gz-sil");
      if (btn.dataset.onay !== "1") { btn.dataset.onay = "1"; btn.textContent = "Son kez: emin misin? Tekrar bas"; setTimeout(() => { if (btn.isConnected) { btn.dataset.onay = ""; btn.textContent = "Hesabımı kalıcı olarak sil"; } }, 5000); return; }
      btn.disabled = true;
      try {
        await Z().call("hesapSil", { sifre: f.sifre.value, forumSil: f.forum.checked });
        for (const k of ["zm-uid", "zm-secret", "zm-name"]) try { localStorage.removeItem(k); } catch (x) {}
        document.getElementById("ana").innerHTML = `<div class="bos buyuk"><h2>Hesabın silindi</h2><p>Hesabın ve kişisel verilerin sunucudan silindi. Bizimle oynadığın için teşekkürler.</p><a class="btn pri" href="/">Ana sayfaya dön</a></div>`;
      } catch (x) { ctx.tost(x.message); btn.disabled = false; btn.dataset.onay = ""; btn.textContent = "Hesabımı kalıcı olarak sil"; }
    });
    try {
      const b = await Z().call("gizlilikBilgi", {});
      for (const r of kok.querySelectorAll("input[name=gz-gorunum]")) { r.checked = r.value === b.gorunum; r.disabled = false; }
      engelListe(b.engelliler);
    } catch (x) { engelListe([]); }
  }

  /* ---------------- Düğmeler ---------------- */
  async function tikla(a, b, ctx) {
    const st = ctx.st;
    try {
      switch (a) {
        case "gz-engelle":
          return ctx.onayli(b, async () => { await Z().call("engelle", { kisi: st.uid }); ctx.tost("Engellendi. Artık sana mesaj ya da istek gönderemez."); ctx.profilTazele(); });
        case "gz-engelkaldir": {
          const kisi = b.dataset.kisi || st.uid;
          b.disabled = true; await Z().call("engelKaldir", { kisi }); ctx.tost("Engel kaldırıldı");
          if (b.dataset.kisi) { const r = await Z().call("gizlilikBilgi", {}); engelListe(r.engelliler); } else ctx.profilTazele();
          return;
        }
        case "gz-sikayet": { const m = b.closest("details"); if (m) m.open = false; return sikayetAc(ctx); }
        case "gz-indir": {
          b.disabled = true;
          const r = await Z().call("verilerimBileti", {});
          location.href = r.url;
          ctx.tost("İndirme başlıyor…");
          setTimeout(() => { b.disabled = false; }, 30000);
          return;
        }
      }
    } catch (x) { b.disabled = false; ctx.tost(x.message); }
  }

  window.zmGizlilik = { dugmeler, gizliPanel, ayarlarHtml, bagla, tikla };
})();
