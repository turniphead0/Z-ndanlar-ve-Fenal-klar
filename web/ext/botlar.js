/* Masaüstü eklentileri: botlar ve yönetim.
   - Oyunda (RPG masası) sol rayda "Botlar": DM ya da admin/test hesabı oyuna bot oyuncu ekler, çıkarır;
     botu konuşturur ve onun adına zar atar. Bota karakter, Oyun ayarlarındaki üye listesinden atanır.
     Sohbette "@Ad" yazan herkes bota seslenir: "@Ad 1d20+3" zar attırır; yapay zekâ açıksa bot karakterine uygun yanıt verir.
   - Ana ekranda adminlere "Yönetim": hesapların rolleri (admin, tester) ve yeni (test) hesap açma.
   Sunucu tarafı: server/botlar.js ve server/roller.js. */
(function () {
  "use strict";
  if (window.ZM_POP) return;
  const Z = window.zmSunucu; if (!Z) return;
  const rol = () => { const m = Z.me() || {}; return Z.isOwner() ? "admin" : m.rol || null; };
  const yonetici = () => !!rol();
  const ROL_AD = { admin: "Admin", tester: "Tester" };
  let pano = null, acik = null; // "botlar" | "yonetim"

  const IKON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16h5"/><circle cx="12" cy="3.5" r="1"/></svg>`;
  const oyun = () => (G.id && S.games[G.id]) || null;
  const botlar = g => Object.entries((g && g.players) || {}).filter(([id, p]) => p && p.bot && id.startsWith("bot-")).map(([id, p]) => ({ id, ...p }));

  /* ---------------- Ray düğmesi ve ana ekran düğmesi ---------------- */
  function ciz() {
    const rail = document.querySelector("#app .rail"), g = oyun();
    if (rail && !window.ZM_MOBIL) {
      let b = rail.querySelector("[data-zm-bot]");
      const goster = !!g && (isDM() || yonetici());
      if (goster && !b) { b = document.createElement("button"); b.className = "navbtn zm-botnav"; b.dataset.zmBot = "botlar"; b.title = "Bot oyuncular"; b.innerHTML = IKON + "Botlar"; rail.appendChild(b); }
      if (b) b.hidden = !goster;
    }
    const bas = document.querySelector("#lobby .lhead");
    if (bas && rol() === "admin" && !bas.querySelector("[data-zm-bot]")) {
      const a = document.createElement("button"); a.className = "btn"; a.dataset.zmBot = "yonetim"; a.title = "Hesaplar, roller ve test hesapları";
      a.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg> Yönetim';
      bas.insertBefore(a, bas.querySelector('[data-lobby="new"]') || null);
    }
    if (pano && !pano.hidden && acik === "botlar") panoCiz();
  }
  const _render = window.render;
  window.render = function () { const r = _render.apply(this, arguments); try { ciz(); } catch (e) { console.error(e); } return r; };

  function ac(ne) {
    acik = ne;
    if (!pano) {
      pano = document.createElement("div"); pano.className = "zm-botpano"; pano.setAttribute("role", "dialog");
      pano.addEventListener("click", e => { if (e.target === pano) kapat(); });
      document.body.appendChild(pano);
    }
    pano.hidden = false; pano.setAttribute("aria-label", ne === "yonetim" ? "Yönetim" : "Botlar");
    if (ne === "yonetim") yonetimCiz(); else panoCiz();
  }
  function kapat() { if (pano) pano.hidden = true; acik = null; }
  document.addEventListener("keydown", e => { if (e.key === "Escape" && pano && !pano.hidden) kapat(); });

  /* ---------------- Botlar paneli (RPG) ---------------- */
  const taslak = {}; // bot -> { metin, zar } (yazılanlar yeniden çizimde kaybolmasın)
  function panoCiz() {
    const g = oyun(); if (!g) { kapat(); return; }
    const liste = botlar(g), kontrol = yonetici() || isDM();
    if (document.activeElement && pano.contains(document.activeElement) && document.activeElement.matches("input")) return; // yazarken bozma
    const chAd = id => { const c = g.players[id] && g.players[id].charId && S.chars[g.players[id].charId]; return c ? c.name : null; };
    pano.innerHTML = `<div class="zm-botic"><div class="zm-botbas"><h2>${IKON} Bot oyuncular</h2><button class="btn sm" data-zb="kapat">Kapat</button></div>
      <p class="hint">Bot, oyuna bir oyuncu gibi katılır. Ona karakter atamak için <b>Oyun ayarları</b>ndaki üye listesini kullan. Sohbette <b>@ad</b> yazan bota seslenir: <b>@ad 1d20+3</b> zar attırır; sunucuda yapay zekâ açıksa bot karakterine uygun yanıt da verir.</p>
      ${liste.length ? liste.map(b => {
        const t = taslak[b.id] || {};
        return `<div class="zm-bot"><div class="zm-botsatir"><b>${esc(nameOf(b.id))}</b><span class="hint">${chAd(b.id) ? "Karakter: " + esc(chAd(b.id)) : "karakter atanmadı"}</span><span class="sp"></span>${kontrol ? `<button class="btn sm" data-zb="cikar" data-id="${esc(b.id)}">Kaldır</button>` : ""}</div>
          ${kontrol ? `<form class="zm-botform" data-zb-konus="${esc(b.id)}"><input name="t" maxlength="1000" placeholder="Bot olarak yaz…" value="${esc(t.metin || "")}" aria-label="${esc(nameOf(b.id))} olarak yaz"><button class="btn sm pri">Söylesin</button></form>
          <form class="zm-botform" data-zb-zar="${esc(b.id)}"><input name="f" maxlength="40" placeholder="1d20+3" value="${esc(t.zar || "")}" aria-label="Zar ifadesi"><input name="e" maxlength="60" placeholder="Ne için? (isteğe bağlı)" aria-label="Zar etiketi"><button class="btn sm">🎲 Zar atsın</button></form>` : ""}</div>`;
      }).join("") : `<p class="hint">Bu oyunda henüz bot yok.</p>`}
      ${kontrol ? `<form class="zm-botform zm-botyeni" data-zb-ekle><input name="ad" maxlength="30" placeholder="Botun adı (örn. Gimli)" aria-label="Botun adı"><button class="btn pri">+ Bot ekle</button></form>` : ""}
      ${!yonetici() && isDM() ? `<p class="hint">DM olarak kendi oyunundaki botları konuşturabilirsin. Admin ve test hesapları bütün masalardaki botları kontrol eder.</p>` : ""}</div>`;
  }

  /* ---------------- Yönetim paneli (yalnızca admin) ---------------- */
  async function yonetimCiz(not) {
    pano.innerHTML = `<div class="zm-botic"><div class="zm-botbas"><h2>Yönetim</h2><button class="btn sm" data-zb="kapat">Kapat</button></div><p class="hint">Yükleniyor…</p></div>`;
    let liste = [], kota = { kisiler: {}, varsayilan: 0, maxDosya: 0 };
    try { liste = await Z.call("rolListe", {}); } catch (e) { pano.querySelector(".hint").textContent = e.message; return; }
    try { kota = await Z.call("kotaListe", {}); } catch (e) {}
    const mb = b => Math.round(b / 1048576 * 10) / 10;
    const tarih = t => (t ? new Date(t).toLocaleDateString("tr-TR") : "—");
    pano.innerHTML = `<div class="zm-botic zm-yonetim"><div class="zm-botbas"><h2>Yönetim</h2><button class="btn sm" data-zb="kapat">Kapat</button></div>
      <p class="hint"><b>Admin</b> hesap açar, rol verir ve botları kontrol eder. <b>Tester</b> bütün masalarda botları kontrol eder: otomatik oynamayı kapatıp botun yerine hamle yapar, kart masasında botun elini görüp onun adına oynar. Kimse kendini admin yapamaz; ilk admin sunucudaki <code>ZM_ADMIN</code> ayarıyla belirlenir.</p>
      ${not ? `<p class="zm-botnot" role="status">${esc(not)}</p>` : ""}
      <h3>Yeni hesap aç</h3>
      <form class="zm-botform" data-zb-hesap><input name="k" maxlength="20" placeholder="Kullanıcı adı" required autocomplete="off" aria-label="Kullanıcı adı"><input name="s" type="text" minlength="8" maxlength="200" placeholder="Şifre (en az 8)" required autocomplete="off" aria-label="Şifre">
        <select name="r" aria-label="Rol"><option value="tester">Tester</option><option value="">Rolsüz</option><option value="admin">Admin</option></select><button class="btn pri">Aç</button></form>
      <h3>Hesaplar (${liste.length})</h3>
      <p class="hint">Yükleme alanı: herkes varsayılan olarak ${mb(kota.varsayilan)} MB yükleyebilir, bir dosya en çok ${mb(kota.maxDosya)} MB olabilir (sunucuda <code>ZM_KOTA</code> ve <code>ZM_MAX_DOSYA</code>). Bir kişiye ayrı kota vermek için MB yaz; boş bırakırsan varsayılana döner.</p>
      <div class="zm-hesaplar">${liste.map(h => `<div class="zm-hesap"><b>${esc(h.kullanici)}</b>${h.rol ? `<span class="zm-rol ${h.rol}">${ROL_AD[h.rol]}</span>` : ""}<span class="hint">son giriş ${tarih(h.seen)}</span><span class="sp"></span>
        ${kota.kisiler[h.id] ? `<label class="hint zm-kota" title="Kullanılan / kota">${mb(kota.kisiler[h.id].kullanilan)} / <input type="number" min="0" step="10" data-zb-kota="${esc(h.id)}" value="${kota.kisiler[h.id].ozel ? mb(kota.kisiler[h.id].kota) : ""}" placeholder="${mb(kota.varsayilan)}" aria-label="${esc(h.kullanici)} yükleme kotası (MB)" style="width:70px"> MB</label>` : ""}
        ${h.sabit ? `<span class="hint">ZM_ADMIN ile</span>` : `<select data-zb-rol="${esc(h.id)}" aria-label="${esc(h.kullanici)} rolü"><option value=""${!h.rol ? " selected" : ""}>Rol yok</option><option value="tester"${h.rol === "tester" ? " selected" : ""}>Tester</option><option value="admin"${h.rol === "admin" ? " selected" : ""}>Admin</option></select>`}</div>`).join("")}</div></div>`;
  }

  /* ---------------- Olaylar ---------------- */
  document.addEventListener("click", async e => {
    const a = e.target.closest("[data-zm-bot]"); if (a) { ac(a.dataset.zmBot); return; }
    const b = e.target.closest(".zm-botpano [data-zb]"); if (!b) return;
    if (b.dataset.zb === "kapat") return kapat();
    if (b.dataset.zb === "cikar") {
      if (!confirm(nameOf(b.dataset.id) + " oyundan çıkarılsın mı?")) return;
      try { await Z.call("oyunBotCikar", { game: G.id, bot: b.dataset.id }); toast("Bot çıkarıldı"); } catch (err) { toast(err.message); }
    }
  });
  document.addEventListener("input", e => {
    const f = e.target.closest("[data-zb-konus],[data-zb-zar]"); if (!f) return;
    const id = f.dataset.zbKonus || f.dataset.zbZar, t = (taslak[id] = taslak[id] || {});
    if (f.dataset.zbKonus) t.metin = f.t.value; else t.zar = f.f.value;
  });
  document.addEventListener("submit", async e => {
    const f = e.target.closest(".zm-botpano form"); if (!f) return;
    e.preventDefault();
    const btn = f.querySelector("button"); btn.disabled = true;
    try {
      if (f.dataset.zbKonus !== undefined) { const id = f.dataset.zbKonus; await Z.call("oyunBotKonus", { game: G.id, bot: id, text: f.t.value }); taslak[id] = { ...(taslak[id] || {}), metin: "" }; f.t.value = ""; toast("Bot konuştu (sohbette)"); }
      else if (f.dataset.zbZar !== undefined) { const r = await Z.call("oyunBotZar", { game: G.id, bot: f.dataset.zbZar, formul: f.f.value || "1d20", etiket: f.e.value }); toast(`${nameOf(f.dataset.zbZar)}: ${r.total} (${r.detail})`); }
      else if (f.dataset.zbEkle !== undefined) { const r = await Z.call("oyunBotEkle", { game: G.id, ad: f.ad.value }); f.ad.value = ""; if (typeof resolveNames === "function") await resolveNames([r.id]); toast("Bot oyuna katıldı. Karakter atamak için Oyun ayarlarına bak."); }
      else if (f.dataset.zbHesap !== undefined) {
        const r = await Z.call("hesapAc", { kullanici: f.k.value.trim(), sifre: f.s.value, rol: f.r.value || null });
        return yonetimCiz(`${r.kullanici} hesabı açıldı${r.rol ? " (" + ROL_AD[r.rol] + ")" : ""}. Şifresini kendisine güvenli bir yoldan ilet.`);
      }
    } catch (err) { toast(err.message); }
    btn.disabled = false;
    if (document.activeElement && f.contains(document.activeElement)) document.activeElement.blur();
    if (acik === "botlar") panoCiz();
  });
  document.addEventListener("change", async e => {
    const kt = e.target.closest("[data-zb-kota]");
    if (kt) { try { const r = await Z.call("kotaAyar", { kisi: kt.dataset.zbKota, mb: kt.value ? Number(kt.value) : 0 }); toast(`Kota: ${Math.round(r.kota / 1048576)} MB`); } catch (err) { toast(err.message); } return; }
    const s = e.target.closest("[data-zb-rol]"); if (!s) return;
    try { await Z.call("rolVer", { kisi: s.dataset.zbRol, rol: s.value || null }); toast("Rol güncellendi"); } catch (err) { toast(err.message); yonetimCiz(); }
  });

  Z.ready.then(() => { try { ciz(); } catch (e) {} });
})();
