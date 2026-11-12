/* Zar Masası köprüsü: artifact'ın kullandığı window.claude.use("db" | "assets" | "user" | "room" | "sample")
   arayüzlerini bu sunucuya WebSocket ile bağlanarak sağlar. Uygulama kodu (app.html) değişmeden çalışır. */
(function () {
  "use strict";
  const LS = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const COLORS = ["#2f8f86", "#c0392b", "#8e44ad", "#2980b9", "#d4880f", "#27ae60", "#d35400", "#7f8c8d"];
  const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)));
  const err = (code, message) => Object.assign(new Error(message || code), { code });

  // ?pop=harita gibi: bu pencere tek bir bölümü gösteren ayrı penceredir.
  try { const v = new URL(location.href).searchParams.get("pop"); if (/^[a-z]+$/.test(v || "")) window.ZM_POP = v; } catch (e) {}

  // ?owner=ANAHTAR ile gelindiyse sahip anahtarını sakla ve adresten sil.
  try {
    const u = new URL(location.href), k = u.searchParams.get("owner");
    if (k) { LS.set("zm-owner", k); u.searchParams.delete("owner"); history.replaceState(null, "", u.pathname + u.search + u.hash); }
  } catch (e) {}

  /* ---------------- Bağlantı ---------------- */
  let ws = null, open = false, seq = 0, ME = null, TOKEN = null, IS_OWNER = false, AI = false, MY_PEER = null;
  const waiting = new Map(); // istek no -> {res, rej, onText}
  const outbox = [];
  const subs = new Map(); // sid -> {msg, apply(m)}
  let peers = [];
  const peerFns = new Set(), topicFns = new Map();
  let readyRes; const ready = new Promise(r => (readyRes = r));
  let banner = null;

  function wsUrl() { return (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws"; }
  function rawSend(m) { if (open) ws.send(JSON.stringify(m)); else outbox.push(m); }
  function call(op, args, extra) {
    const id = ++seq;
    return new Promise((res, rej) => { waiting.set(id, { res, rej, ...(extra || {}) }); rawSend({ id, op, ...args }); });
  }
  function helloMsg(form) {
    return { op: "hello", userId: LS.get("zm-uid"), secret: LS.get("zm-secret"), name: form.name, color: form.color, password: form.password || LS.get("zm-pass") || "", ownerKey: LS.get("zm-owner") || "" };
  }

  function connect(form, onFirst) {
    ws = new WebSocket(wsUrl());
    ws.onopen = () => {
      const id = ++seq;
      waiting.set(id, {
        res: r => {
          ME = r.me; TOKEN = r.token; IS_OWNER = r.isOwner; AI = r.ai; MY_PEER = r.peer; peers = r.peers || [];
          LS.set("zm-uid", r.me.id); LS.set("zm-secret", r.secret); LS.set("zm-name", r.me.name); LS.set("zm-color", r.me.color);
          if (form.password) LS.set("zm-pass", form.password);
          open = true; setBanner(null);
          for (const s of subs.values()) ws.send(JSON.stringify(s.msg)); // yeniden bağlanınca abonelikleri tazele
          while (outbox.length) ws.send(JSON.stringify(outbox.shift()));
          emitPeers([], []);
          if (onFirst) { const f = onFirst; onFirst = null; f(null); }
        },
        rej: e => { if (onFirst) { const f = onFirst; onFirst = null; f(e); } ws.onclose = null; ws.close(); },
      });
      ws.send(JSON.stringify({ id, ...helloMsg(form) }));
    };
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.re != null && !m.ev) { const w = waiting.get(m.re); if (!w) return; waiting.delete(m.re); m.error ? w.rej(err(m.error.code, m.error.message)) : w.res(m.result); return; }
      if (m.ev === "aiText") { const w = waiting.get(m.re); if (w && w.onText) w.onText({ text: m.text }); return; }
      if (m.ev === "snap") { const s = subs.get(m.sid); if (s) s.apply(m); return; }
      if (m.ev === "peers") { peers = m.peers; emitPeers(m.joined || [], m.left || []); return; }
      if (m.ev === "msg") { const fs = topicFns.get(m.topic); if (fs) for (const f of fs) try { f({ data: m.data, peer: m.peer, by: m.by, isMe: false, topic: m.topic }); } catch (e) { console.error(e); } }
    };
    ws.onclose = () => {
      const was = open; open = false;
      if (onFirst) { const f = onFirst; onFirst = null; f(err("network", "Sunucuya bağlanılamadı")); return; }
      for (const [id, w] of waiting) if (!w.keep) { waiting.delete(id); w.rej(err("network", "Bağlantı kesildi")); }
      if (was) setBanner("Sunucu bağlantısı koptu, yeniden bağlanılıyor…");
      setTimeout(() => connect({ name: LS.get("zm-name"), color: LS.get("zm-color") }), 1500);
    };
  }

  function setBanner(text) {
    if (!text) { if (banner) { banner.remove(); banner = null; } return; }
    if (!banner) { banner = document.createElement("div"); banner.setAttribute("role", "status");
      banner.style.cssText = "position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:200;background:var(--bad);color:var(--surface);padding:8px 14px;border-radius:6px;font-size:14px;box-shadow:0 6px 20px rgba(0,0,0,.25)"; document.body.appendChild(banner); }
    banner.textContent = text;
  }

  /* ---------------- Katılım ekranı ---------------- */
  async function start() {
    let info = { name: "Zar Masası", needsPassword: false };
    try { info = await (await fetch("/api/info")).json(); } catch (e) {}
    const saved = { name: LS.get("zm-name"), color: LS.get("zm-color") };
    if (saved.name && (!info.needsPassword || LS.get("zm-pass") || LS.get("zm-owner"))) {
      const e = await new Promise(r => connect(saved, r));
      if (!e) return readyRes();
      if (e.code === "bad_password") LS.set("zm-pass", "");
    }
    showJoin(info);
  }

  function showJoin(info, errorText) {
    const desk = window.zmDesktop;
    const ov = document.createElement("div"); ov.className = "joinov";
    let color = LS.get("zm-color") || COLORS[Math.floor(Math.random() * COLORS.length)];
    ov.innerHTML = `<form class="joincard"><h2></h2><p>Masaya katılmak için adını ve rengini seç.</p>
      <label><span class="lbl">Adın</span><input class="f" name="name" maxlength="40" required autocomplete="nickname"></label>
      <div><span class="lbl">Rengin</span><div class="jcolors">${COLORS.map(c => `<button type="button" class="jc" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join("")}</div></div>
      ${info.needsPassword && !LS.get("zm-owner") ? `<label><span class="lbl">Masa şifresi</span><input class="f" name="password" type="password" required></label>` : ""}
      <p class="jerr" hidden></p>
      <div style="display:flex;gap:8px;justify-content:flex-end">${desk ? `<button type="button" class="btn" data-back>Başka sunucu</button>` : ""}<button class="btn pri">Masaya otur</button></div></form>`;
    ov.querySelector("h2").textContent = info.name || "Zar Masası";
    const f = ov.querySelector("form"), er = ov.querySelector(".jerr");
    f.name.value = LS.get("zm-name") || "";
    const paint = () => ov.querySelectorAll(".jc").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.c === color)));
    paint();
    ov.addEventListener("click", e => { const b = e.target.closest(".jc"); if (b) { color = b.dataset.c; paint(); } if (e.target.closest("[data-back]")) desk.backToLauncher(); });
    if (errorText) { er.textContent = errorText; er.hidden = false; }
    f.addEventListener("submit", async e => {
      e.preventDefault(); er.hidden = true;
      const btn = f.querySelector(".btn.pri"); btn.disabled = true;
      const form = { name: f.name.value.trim(), color, password: f.password ? f.password.value : "" };
      const x = await new Promise(r => connect(form, r));
      btn.disabled = false;
      if (x) { er.textContent = x.message || "Bağlanılamadı"; er.hidden = false; return; }
      ov.remove(); readyRes();
    });
    const mount = () => { document.body.appendChild(ov); f.name.focus(); };
    document.body ? mount() : document.addEventListener("DOMContentLoaded", mount);
  }

  /* ---------------- db ---------------- */
  let sidN = 0;
  const meta = { fromCache: false, hasPendingWrites: false };
  const dobj = (id, data) => ({ id, exists: data != null, data: () => data, metadata: meta });
  const sortDocs = (docs, f, dir, n) => {
    if (f) { const m = dir === "desc" ? -1 : 1; docs.sort((x, y) => { const u = x.data()?.[f], v = y.data()?.[f]; return (u > v ? 1 : u < v ? -1 : 0) * m; }); }
    return n ? docs.slice(0, n) : docs;
  };
  const snapOf = (docs, changes) => ({ docs, size: docs.length, empty: !docs.length, docChanges: () => changes, forEach: fn => docs.forEach(fn), metadata: meta });
  const newId = () => "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  function docRef(path) {
    return {
      id: path.split("/").pop(), path,
      get: async () => { const r = await call("get", { path }); return dobj(path.split("/").pop(), r.exists ? r.data : undefined); },
      set: d => call("set", { path, data: clone(d) }),
      update: d => call("update", { path, data: clone(d) }),
      delete: () => call("delete", { path }),
      collection: c => query(path + "/" + c),
      onSnapshot(fn, onErr) {
        const sid = "s" + ++sidN, msg = { id: 0, op: "sub", kind: "doc", path, sid };
        subs.set(sid, { msg, apply: m => { try { fn(dobj(m.doc.id, m.doc.exists ? m.doc.data : undefined)); } catch (e) { console.error(e); } } });
        call("sub", { kind: "doc", path, sid }).catch(e => onErr && onErr(e));
        return () => { subs.delete(sid); if (open) call("unsub", { sid }).catch(() => {}); };
      },
    };
  }

  function query(path, f, dir, n) {
    return {
      path,
      orderBy: (f2, d2 = "asc") => query(path, f2, d2, n),
      limit: n2 => query(path, f, dir, n2),
      doc: id => docRef(path + "/" + (id || newId())),
      add: async d => { const r = docRef(path + "/" + newId()); await r.set(d); return r; },
      get: async () => { const rows = await call("query", { path, orderBy: f, dir, limit: n }); const docs = rows.map(r => dobj(r.id, r.data)); return snapOf(docs, docs.map(d => ({ type: "added", doc: d }))); },
      onSnapshot(fn, onErr) {
        const sid = "s" + ++sidN, cache = new Map(), msg = { id: 0, op: "sub", kind: "col", path, sid };
        const apply = m => {
          let ch = [];
          if (m.initial && cache.size) { // yeniden bağlanma: önbellekle karşılaştır
            const now = new Map(m.changes.map(c => [c.id, c.data]));
            for (const [id, d] of cache) if (!now.has(id)) ch.push({ type: "removed", id, data: d });
            for (const [id, d] of now) if (!cache.has(id)) ch.push({ type: "added", id, data: d }); else if (JSON.stringify(cache.get(id)) !== JSON.stringify(d)) ch.push({ type: "modified", id, data: d });
          } else ch = m.changes;
          for (const c of ch) c.type === "removed" ? cache.delete(c.id) : cache.set(c.id, c.data);
          if (!ch.length && !m.initial) return;
          const docs = sortDocs([...cache].map(([id, d]) => dobj(id, d)), f, dir, n);
          try { fn(snapOf(docs, ch.map(c => ({ type: c.type, doc: dobj(c.id, c.data) })))); } catch (e) { console.error(e); }
        };
        subs.set(sid, { msg, apply });
        call("sub", { kind: "col", path, sid }).catch(e => onErr && onErr(e));
        return () => { subs.delete(sid); if (open) call("unsub", { sid }).catch(() => {}); };
      },
    };
  }
  const db = { collection: c => query(c), doc: docRef };

  /* ---------------- assets ---------------- */
  const assets = {
    async upload(file, o) {
      const type = (o && o.type) || file.type || "application/octet-stream";
      const r = await fetch("/api/assets", { method: "POST", headers: { "Content-Type": type, "x-zm-token": TOKEN, "x-filename": encodeURIComponent(file.name || "") }, body: file });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw err(j.code || "upload_failed", j.message || "Dosya yüklenemedi");
      return { id: j.id, url: j.url, type: j.type, size: j.size };
    },
    async delete(id) { const r = await fetch("/api/assets/" + encodeURIComponent(id), { method: "DELETE", headers: { "x-zm-token": TOKEN } }); if (!r.ok) throw err("delete_failed", "Dosya silinemedi"); },
  };

  /* ---------------- user ---------------- */
  const user = {
    me: async () => ({ ...ME }),
    id: async () => ME.id,
    isOwner: async () => IS_OWNER,
    can: async () => true,
    profiles: ids => call("profiles", { ids }),
  };

  /* ---------------- room ---------------- */
  const withMe = () => peers.map(p => ({ ...p, isMe: p.peer === MY_PEER }));
  function emitPeers(joined, left) { const ps = withMe(); for (const f of peerFns) try { f({ peers: ps, joined, left }); } catch (e) { console.error(e); } }
  const room = {
    peers: () => withMe(),
    onPeers(fn) { peerFns.add(fn); return () => peerFns.delete(fn); },
    on(topic, fn) { if (!topicFns.has(topic)) topicFns.set(topic, new Set()); topicFns.get(topic).add(fn); return () => topicFns.get(topic).delete(fn); },
    emit: (topic, data) => call("emit", { topic, data }),
    presence: p => call("presence", { data: p }),
  };

  /* ---------------- chat (masa sohbeti) ---------------- */
  const chat = {
    send: (game, d) => call("chatSend", { game, text: d.text || "", gif: d.gif || "", to: d.to || null }),
    clear: game => call("chatClear", { game }),
  };

  /* ---------------- sample (Claude) ---------------- */
  function ai(input, o, json) {
    o = o || {};
    const id = ++seq;
    return new Promise((res, rej) => {
      const sig = o.signal;
      if (sig && sig.aborted) return rej(Object.assign(new Error("İptal edildi"), { name: "AbortError" }));
      const onAbort = () => { if (!waiting.has(id)) return; waiting.delete(id); rawSend({ id: ++seq, op: "aiAbort", target: id }); rej(Object.assign(new Error("İptal edildi"), { name: "AbortError" })); };
      if (sig) sig.addEventListener("abort", onAbort, { once: true });
      waiting.set(id, { res: r => { if (sig) sig.removeEventListener("abort", onAbort); res(r); }, rej, onText: o.onText });
      rawSend({ id, op: "ai", input, json: !!json });
    });
  }
  function parseJson(text) {
    const t = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    try { return JSON.parse(t); } catch (e) {}
    const a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
    throw err("bad_json", "Claude geçerli JSON döndürmedi");
  }
  const sample = Object.assign((input, o) => ai(input, o, false), { json: async (input, o) => parseJson((await ai(input, o, true)).text) });

  /* ---------------- window.claude ---------------- */
  window.claude = {
    async use(name) {
      await ready;
      switch (name) {
        case "db": return db;
        case "assets": return assets;
        case "user": return user;
        case "room": return room;
        case "chat": return chat;
        case "sample": if (!AI) throw err("unavailable", "Yapay zekâ bu sunucuda kapalı"); return sample;
        default: throw err("unknown_capability", name);
      }
    },
  };
  start();
})();
