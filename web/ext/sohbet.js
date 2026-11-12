/* Masa sohbeti: oyundaki herkesin yazıştığı kutu. Zar atışları da akışa düşer (istenirse kapatılır),
   oyuncular birbirine fısıldayabilir, emoji ve GIF gönderilebilir.
   Mesajları sunucu yazar ve gönderenini damgalar (server/index.js, chatSend):
     chat/<oyun>/<mesaj>                    herkesin gördüğü mesajlar
     data/users/<kişi>/chat/<oyun>/<mesaj>  fısıltılar; yalnızca gönderen ve alan görür
   GIF için ücretli ya da anahtarlı bir servis yok: GIF adresi yapıştırılır ya da bilgisayardan yüklenir. */
(function () {
  "use strict";
  if (window.ZM_POP) return; // ayrı pencerelerde sohbet yok, ana pencerede

  const LS = { get: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const pref = Object.assign({ open: false, dice: true }, LS.get("zm-sohbet", {}));
  const keepPref = () => LS.set("zm-sohbet", pref);
  let recentGifs = LS.get("zm-sohbet-gif", []);

  const st = { gid: null, me: null, pub: new Map(), priv: new Map(), unsubs: [], since: 0, unread: 0, to: "", pop: null, busy: false };
  let CHAT = null;
  if (window.claude && typeof window.claude.use === "function") window.claude.use("chat").then(c => { CHAT = c; sync(); }).catch(() => {});

  const EMOJI = [
    ["Yüzler", "😀 😂 🤣 😊 😍 😎 🤔 😏 😅 😬 😱 😭 😡 🥶 🤢 😴 🤯 🥳 😇 🙄 😈 🤡"],
    ["Eller", "👍 👎 👏 🙌 🙏 🤝 ✌️ 🤞 👊 💪 👋 🫡 ✋ 👀"],
    ["Macera", "🎲 ⚔️ 🗡️ 🛡️ 🏹 🪓 🔥 ❄️ ⚡ 💀 ☠️ 👑 💎 🪙 💰 🧪 📜 🗝️ 🕯️ 🔮 🪄 🍺 🍖 🏰 🌲 🌙 ⭐"],
    ["Yaratıklar", "🐉 🧙 🧝 🧛 🧟 🧞 🧜 👻 👹 👺 🕷️ 🐺 🦇 🐍 🦉 🐀"],
    ["Diğer", "❤️ 💔 💯 ✅ ❌ ❓ ❗ 💤 💥 ✨ 🎉 🍀 ⏳ 🎵"],
  ];

  /* ---------------- Yardımcılar ---------------- */
  const game = () => (G.id && S.games[G.id]) || null;
  const nm = id => (id === ME.id ? (ME.name || "Sen") : nameOf(id));
  const col = id => (id === ME.id ? (ME.color || "var(--accent)") : peerColor(id));
  const time = t => new Date(t).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  const others = () => { const g = game(); return g ? members(g).filter(id => id !== ME.id) : []; };
  const safeGif = u => (/^\/assets\/[a-z0-9]+\.(gif|webp|png|jpg)$/.test(u) || /^https:\/\/[^\s"'<>]+$/.test(u) ? u : "");
  // Yapıştırılan adresten gösterilebilir bir resim adresi çıkar (Giphy sayfa adresi de olur).
  function gifFrom(u) {
    u = String(u || "").trim();
    if (!/^https:\/\/\S+$/.test(u)) return "";
    const gp = /^https:\/\/(?:www\.)?giphy\.com\/(?:gifs|stickers)\/(?:[^/?#]*-)?([A-Za-z0-9]+)(?:[/?#]|$)/.exec(u);
    if (gp) return `https://media.giphy.com/media/${gp[1]}/giphy.gif`;
    if (/^https:\/\/(?:media\d*|i)\.giphy\.com\//.test(u) || /^https:\/\/media\d*\.tenor\.com\//.test(u)) return u;
    if (/\.(gif|webp|png|jpe?g)(\?\S*)?$/i.test(u)) return u;
    return "";
  }

  /* ---------------- Abonelik ---------------- */
  function resub() {
    st.unsubs.forEach(f => { try { f(); } catch (e) {} });
    st.unsubs = []; st.pub.clear(); st.priv.clear(); st.unread = 0; st.to = "";
    st.gid = G.id; st.me = ME.id; st.since = Date.now();
    if (!st.gid || !CHAT || !DB || !ME.id) return;
    const gid = st.gid;
    const on = (path, map) => st.unsubs.push(DB.collection(path).onSnapshot(snap => {
      if (st.gid !== gid) return;
      for (const ch of snap.docChanges()) {
        if (ch.type === "removed") { map.delete(ch.doc.id); continue; }
        const d = ch.doc.data(); map.set(ch.doc.id, d);
        if (ch.type === "added" && d.by !== ME.id && d.t > st.since) arrived(d);
      }
      resolveNames([...map.values()].flatMap(m => [m.by, m.to]).filter(Boolean));
      badge(); draw();
    }, () => {}));
    on(`chat/${gid}`, st.pub);
    on(`data/users/${ME.id}/chat/${gid}`, st.priv);
    resolveNames(others());
  }
  function arrived(d) {
    if (!pref.open) { st.unread++; if (d.to) toast(`${nm(d.by)} sana fısıldadı`); }
    try { if (d.to || !pref.open) blip(); } catch (e) {}
  }
  let ac = null;
  function blip() {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.frequency.value = 880; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.3);
  }

  /* ---------------- Çizim ---------------- */
  let root = null;
  function build() {
    root = document.createElement("div"); root.id = "zmChat";
    root.innerHTML = `<button class="btn zc-fab" data-zc="toggle" aria-expanded="false"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg> Sohbet <span class="zc-badge" hidden></span></button>
      <section class="zc-panel" aria-label="Masa sohbeti" hidden>
        <header class="zc-h"><b>Sohbet</b><label class="zc-dice" title="Zar atışlarını sohbette göster"><input type="checkbox" data-zc="dice"> Zarlar</label><span class="sp"></span><button class="btn sm danger" data-zc="clear" hidden>Temizle</button><button class="btn sm" data-zc="toggle" aria-label="Sohbeti kapat">×</button></header>
        <div class="zc-feed" role="log" aria-live="polite"></div>
        <div class="zc-pop" hidden></div>
        <form class="zc-form">
          <label class="zc-tolab"><span class="lbl">Kime</span><select class="f zc-to" aria-label="Kime"></select></label>
          <div class="zc-row"><button type="button" class="btn sm zc-ic" data-zc="emoji" title="Emoji" aria-label="Emoji">😀</button><button type="button" class="btn sm zc-ic" data-zc="gif" title="GIF gönder">GIF</button>
            <textarea class="f zc-in" rows="1" maxlength="1000" placeholder="Mesaj yaz… (/r 1d20 zar atar)" aria-label="Mesaj"></textarea><button class="btn pri sm" type="submit">Gönder</button></div>
        </form>
        <input type="file" class="zc-file" accept="image/gif,image/webp,image/png,image/jpeg" hidden>
      </section>`;
    document.body.appendChild(root);
    root.querySelector(".zc-feed").addEventListener("error", e => { if (e.target.tagName === "IMG") { const s = document.createElement("small"); s.className = "zc-bad"; s.textContent = "GIF yüklenemedi"; e.target.replaceWith(s); } }, true);
  }

  function sync() {
    if (!root) build();
    if (G.id !== st.gid || ME.id !== st.me || (CHAT && G.id && !st.unsubs.length)) resub();
    const show = !!(G.id && CHAT);
    root.hidden = !show;
    if (!show) return;
    root.querySelector(".zc-panel").hidden = !pref.open;
    root.classList.toggle("open", pref.open);
    const fab = root.querySelector(".zc-fab"); fab.setAttribute("aria-expanded", String(pref.open)); fab.hidden = pref.open;
    badge();
    root.querySelector("[data-zc=dice]").checked = !!pref.dice;
    root.querySelector("[data-zc=clear]").hidden = !isDM();
    drawTo();
    if (pref.open) draw();
  }

  function badge() {
    if (!root) return;
    const b = root.querySelector(".zc-badge"); b.hidden = !st.unread; b.textContent = st.unread > 99 ? "99+" : String(st.unread);
  }

  function drawTo() {
    const sel = root.querySelector(".zc-to"), ids = others();
    if (st.to && !ids.includes(st.to)) st.to = "";
    const html = `<option value="">Herkese</option>` + ids.map(id => `<option value="${esc(id)}">Fısılda: ${esc(nm(id))}</option>`).join("");
    if (sel._h !== html) { sel.innerHTML = html; sel._h = html; }
    sel.value = st.to;
    root.querySelector(".zc-form").classList.toggle("zc-whisper", !!st.to);
  }

  function items() {
    const L = [...st.pub.values(), ...st.priv.values()].map(m => ({ k: "m", t: m.t, m }));
    if (pref.dice) for (const r of allLog()) L.push({ k: "r", t: r.t, r });
    return L.sort((a, b) => a.t - b.t).slice(-200);
  }

  function msgHtml(m) {
    const w = !!m.to, mine = m.by === ME.id;
    const head = w ? (mine ? `<b style="color:${esc(col(m.by))}">Sen</b> <span class="zc-arrow">fısıldadın →</span> <b style="color:${esc(col(m.to))}">${esc(nm(m.to))}</b>` : `<b style="color:${esc(col(m.by))}">${esc(nm(m.by))}</b> <span class="zc-arrow">sana fısıldadı</span>`)
      : `<b style="color:${esc(col(m.by))}">${esc(mine ? "Sen" : nm(m.by))}</b>`;
    const reply = !mine && others().includes(m.by) ? `<button class="zc-reply" data-zc="whisper" data-id="${esc(m.by)}" title="Fısıldayarak yanıtla">Fısılda</button>` : "";
    const gif = m.gif && safeGif(m.gif) ? `<img class="zc-gif" src="${esc(m.gif)}" alt="GIF" loading="lazy" referrerpolicy="no-referrer">` : "";
    return `<div class="zc-m${w ? " zc-w" : ""}${mine ? " zc-me" : ""}"><div class="zc-by">${head}<time>${time(m.t)}</time>${reply}</div>${m.text ? `<div class="zc-t" data-noi18n>${esc(m.text)}</div>` : ""}${gif}</div>`;
  }
  function rollHtml(r) {
    const c = r.crit === "20" ? " n20" : r.crit === "1" ? " n1" : "";
    return `<div class="zc-r${r.secret ? " zc-sec" : ""}"><div class="zc-by">${r.secret ? '<i class="sec">Gizli</i> ' : ""}<b style="color:${esc(col(r.by))}">${esc(r.by ? (r.by === ME.id ? "Sen" : nm(r.by)) : "")}</b> <span>${esc(r.label)}</span><time>${time(r.t)}</time></div>
      <div class="zc-rr"><span class="zc-tot num${c}">${esc(r.total)}</span><small>${esc(r.expr ? r.expr + " → " : "")}${esc(r.detail)}</small></div></div>`;
  }

  function draw() {
    if (!root || !pref.open) return;
    const feed = root.querySelector(".zc-feed");
    const L = items();
    const html = L.length ? L.map(x => (x.k === "m" ? msgHtml(x.m) : rollHtml(x.r))).join("") : `<p class="zc-empty">Henüz mesaj yok. Herkese yaz ya da birine fısılda.</p>`;
    if (feed._h === html) return;
    const atEnd = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 60;
    feed.innerHTML = html; feed._h = html;
    if (atEnd || !feed._seen) { feed.scrollTop = feed.scrollHeight; feed._seen = true; }
    // GIF'ler yüklenince en alta kaydır
    feed.querySelectorAll("img.zc-gif").forEach(img => { if (!img.complete) img.addEventListener("load", () => { if (atEnd) feed.scrollTop = feed.scrollHeight; }, { once: true }); });
  }

  function drawPop() {
    const pop = root.querySelector(".zc-pop");
    root.querySelectorAll("[data-zc=emoji],[data-zc=gif]").forEach(b => b.setAttribute("aria-pressed", String(st.pop === b.dataset.zc)));
    if (!st.pop) { pop.hidden = true; pop.innerHTML = ""; return; }
    pop.hidden = false;
    if (st.pop === "emoji") {
      pop.innerHTML = EMOJI.map(([n, list]) => `<div class="zc-ecat"><span class="lbl">${n}</span><div class="zc-egrid">${list.split(" ").map(e => `<button type="button" data-emoji="${e}" aria-label="${e}">${e}</button>`).join("")}</div></div>`).join("");
      return;
    }
    pop.innerHTML = `<form class="zc-gifform"><input class="f" name="u" placeholder="GIF adresini yapıştır (https://…)" aria-label="GIF adresi" autocomplete="off"><button class="btn pri sm">Gönder</button></form>
      <p class="zc-hint">Bir GIF sitesinde (ör. <a href="https://giphy.com" target="_blank" rel="noopener noreferrer">Giphy</a>, <a href="https://tenor.com" target="_blank" rel="noopener noreferrer">Tenor</a>) GIF'e sağ tıkla, <b>Resim adresini kopyala</b> de ve buraya yapıştır. Giphy sayfa adresi de olur.</p>
      <div class="zc-gifrow"><button type="button" class="btn sm" data-zc="upload">Bilgisayardan GIF yükle</button></div>
      ${recentGifs.length ? `<span class="lbl">Son kullanılanlar</span><div class="zc-recent">${recentGifs.map(u => `<button type="button" data-gif="${esc(u)}" aria-label="Bu GIF'i gönder"><img src="${esc(u)}" alt="" loading="lazy" referrerpolicy="no-referrer"></button>`).join("")}</div>` : ""}`;
    pop.querySelector("input").focus();
  }

  /* ---------------- Gönderme ---------------- */
  async function send(text, gif) {
    if (!CHAT || !G.id || st.busy) return false;
    text = String(text || "").trim();
    // Tek başına bir GIF adresi yazıldıysa resim olarak gönder.
    if (text && !gif && /^https:\/\/\S+$/.test(text)) { const g = gifFrom(text); if (g) { gif = g; text = ""; } }
    if (!text && !gif) return false;
    st.busy = true;
    try {
      await CHAT.send(G.id, { text, gif: gif || "", to: st.to || null });
      if (gif) { recentGifs = [gif, ...recentGifs.filter(u => u !== gif)].slice(0, 12); LS.set("zm-sohbet-gif", recentGifs); }
      return true;
    } catch (e) { toast(e.message || "Mesaj gönderilemedi"); return false; }
    finally { st.busy = false; }
  }

  // /r ifade → zar at; /w Ad mesaj → o kişiye fısılda
  function command(v) {
    const r = /^\/(?:r|roll|zar)\s+(.+)$/i.exec(v);
    if (r) { roll(r[1].trim(), r[1].trim()); return true; }
    const w = /^\/(?:w|f|fısılda)\s+(.+)$/i.exec(v);
    if (w) {
      const rest = w[1], low = rest.toLocaleLowerCase("tr");
      const hit = others().map(id => [id, nm(id).toLocaleLowerCase("tr")]).filter(([, n]) => n && (low === n || low.startsWith(n + " "))).sort((a, b) => b[1].length - a[1].length)[0];
      if (!hit) { toast("Bu adda bir oyuncu bulunamadı"); return true; }
      const prev = st.to; st.to = hit[0];
      send(rest.slice(hit[1].length)).then(() => { st.to = prev; drawTo(); });
      return true;
    }
    return false;
  }

  async function submit() {
    const ta = root.querySelector(".zc-in"), v = ta.value.trim();
    if (!v) return;
    if (v.startsWith("/") && command(v)) { ta.value = ""; grow(ta); return; }
    if (await send(v)) { ta.value = ""; grow(ta); }
    ta.focus();
  }
  const grow = ta => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; };

  function insert(s) {
    const ta = root.querySelector(".zc-in"), a = ta.selectionStart ?? ta.value.length, b = ta.selectionEnd ?? ta.value.length;
    ta.value = ta.value.slice(0, a) + s + ta.value.slice(b); ta.focus(); ta.selectionStart = ta.selectionEnd = a + s.length; grow(ta);
  }

  async function upload(file) {
    if (!file) return;
    if (!/^image\/(gif|webp|png|jpeg)$/.test(file.type)) { toast("Yalnızca GIF, WebP, PNG ya da JPG"); return; }
    if (file.size > 8 * 1024 * 1024) { toast("GIF 8 MB'tan küçük olmalı"); return; }
    if (!ASSETS) { toast("Dosya yüklenemiyor"); return; }
    toast("GIF yükleniyor…");
    try { const r = await ASSETS.upload(file); if (await send("", r.url)) { st.pop = null; drawPop(); toast("GIF gönderildi"); } }
    catch (e) { toast(e.message || "GIF yüklenemedi"); }
  }

  /* ---------------- Olaylar ---------------- */
  function setOpen(v) {
    pref.open = v; keepPref(); if (v) st.unread = 0; st.pop = null;
    sync(); drawPop();
    if (v) { const f = root.querySelector(".zc-feed"); f.scrollTop = f.scrollHeight; root.querySelector(".zc-in").focus(); }
  }

  document.addEventListener("click", e => {
    if (!root || !root.contains(e.target)) { if (st.pop && root && !root.contains(e.target)) { st.pop = null; drawPop(); } return; }
    const em = e.target.closest("[data-emoji]"); if (em) { insert(em.dataset.emoji); return; }
    const gf = e.target.closest("[data-gif]"); if (gf) { send("", gf.dataset.gif).then(ok => { if (ok) { st.pop = null; drawPop(); } }); return; }
    const b = e.target.closest("[data-zc]"); if (!b) return;
    const a = b.dataset.zc;
    if (a === "toggle") setOpen(!pref.open);
    else if (a === "emoji" || a === "gif") { st.pop = st.pop === a ? null : a; drawPop(); }
    else if (a === "upload") root.querySelector(".zc-file").click();
    else if (a === "whisper") { st.to = b.dataset.id; drawTo(); root.querySelector(".zc-in").focus(); }
    else if (a === "clear") { if (b.dataset.armed) { delete b.dataset.armed; b.textContent = "Temizle"; CHAT.clear(G.id).catch(err => toast(err.message || "Temizlenemedi")); } else { b.dataset.armed = "1"; b.textContent = "Emin misin?"; setTimeout(() => { if (b.dataset.armed) { delete b.dataset.armed; b.textContent = "Temizle"; } }, 3000); } }
  });
  document.addEventListener("change", e => {
    if (!root || !root.contains(e.target)) return;
    if (e.target.matches("[data-zc=dice]")) { pref.dice = e.target.checked; keepPref(); draw(); }
    if (e.target.matches(".zc-to")) { st.to = e.target.value; drawTo(); }
    if (e.target.matches(".zc-file")) { upload(e.target.files[0]); e.target.value = ""; }
  });
  document.addEventListener("input", e => { if (root && e.target.matches?.(".zc-in")) grow(e.target); });
  document.addEventListener("submit", e => {
    if (!root || !root.contains(e.target)) return;
    e.preventDefault();
    if (e.target.matches(".zc-form")) submit();
    if (e.target.matches(".zc-gifform")) {
      const v = e.target.u.value.trim(), g = gifFrom(v);
      if (!g) { toast("Bu bir GIF adresi gibi görünmüyor. Resim adresini kopyala (https://…gif)"); return; }
      send("", g).then(ok => { if (ok) { st.pop = null; drawPop(); } });
    }
  });
  // Sohbette yazarken klavye kısayolları (birinci şahıs gezinme, ses pedleri…) tetiklenmesin.
  window.addEventListener("keydown", e => {
    if (!root || !root.contains(e.target)) return;
    if (e.key === "Escape") { if (st.pop) { st.pop = null; drawPop(); root.querySelector(".zc-in").focus(); } else setOpen(false); e.preventDefault(); }
    else if (e.key === "Enter" && !e.shiftKey && e.target.matches(".zc-in")) { e.preventDefault(); submit(); }
    e.stopPropagation();
  }, true);

  /* ---------------- Uygulamaya bağlan ---------------- */
  const wrap = (name, after) => { const f = window[name]; if (typeof f !== "function") return; window[name] = function () { const r = f.apply(this, arguments); try { after(); } catch (e) { console.error(e); } return r; }; };
  wrap("render", sync);
  wrap("renderLog", () => { if (pref.dice) draw(); });
  wrap("renderPeers", () => { if (root && !root.hidden) { drawTo(); draw(); } });
  const boot = () => { try { sync(); } catch (e) { console.error(e); } };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", boot) : boot();
})();
