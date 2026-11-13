// Zar Masası sunucusu. Artifact'ın kullandığı db / assets / user / room / sample arayüzlerinin
// karşılığını WebSocket + HTTP üzerinden sağlar ve uygulamanın kendisini (web/app.html) sunar.
// Masaüstü uygulamasında "host et" seçilince gömülü, kendi sunucunda ise `node server/cli.js` ile çalışır.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");
const { Store, parentOf } = require("./store");
const { OYUNLAR, yasal } = require("../web/oyunlar/kurallar");

const WEB = path.join(__dirname, "..", "web");
const MAX_ASSET = 25 * 1024 * 1024;
const ASSET_TYPES = /^(image\/|audio\/|video\/|application\/pdf$)/;
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg", "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/wav": "wav", "video/mp4": "mp4", "video/webm": "webm", "application/pdf": "pdf" };

const rid = (n = 12) => crypto.randomBytes(n).toString("hex");
const sha = s => crypto.createHash("sha256").update(String(s)).digest("hex");
const same = (a, b) => { const x = Buffer.from(sha(a)), y = Buffer.from(sha(b)); return crypto.timingSafeEqual(x, y); };

// Gizli yollar: _sys/* hiçbir istemciye açık değil; data/users/<kişi>/* yalnızca o kişiye açık.
function canAccess(uid, p) {
  const s = String(p || "").split("/");
  if (!s[0] || s.some(x => !x || x === "." || x === "..")) return false;
  if (s[0] === "_sys") return false;
  if (s[0] === "data" && s[1] === "users") return s[2] === uid;
  return true;
}
// Masa oyunu belgeleri (boards/*), sohbet mesajları (chat/*, data/users/<kişi>/chat/*) ve forum (forum/*)
// yalnızca sunucu tarafından yazılır: tahtada kurallara uygun hamleler, sohbette ve forumda gönderen damgalı iletiler.
function canWrite(uid, p) {
  const s = String(p).split("/");
  return canAccess(uid, p) && s[0] !== "boards" && s[0] !== "chat" && s[0] !== "forum" && !(s[0] === "data" && s[1] === "users" && s[3] === "chat");
}

// Sohbet: masadaki ortak mesajlar chat/<oyun>/<mesaj>, fısıltılar iki tarafın da
// data/users/<kişi>/chat/<oyun>/<mesaj> yolunda (sunucu başkasına göstermez).
const CHAT_KEEP = 200;
const GAME_ID = /^[A-Za-z0-9_-]{1,80}$/;
// GIF: https adresi ya da bu sunucuya yüklenmiş bir resim.
function chatGif(u) {
  u = String(u || "").trim();
  if (!u) return "";
  if (/^\/assets\/[a-z0-9]+\.(gif|webp|png|jpg)$/.test(u)) return u;
  if (u.length <= 600 && /^https:\/\/[^\s"'<>]+$/.test(u)) { try { new URL(u); return u; } catch (e) {} }
  return null;
}
const FORUM_KATEGORI = ["Genel sohbet", "Oyuncu arıyorum", "Masa arıyorum", "Kurallar", "Paylaşım"];
const metin = (v, n) => String(v == null ? "" : v).replace(/\r\n/g, "\n").trim().slice(0, n);

function createServer(opts = {}) {
  const dataDir = opts.dataDir || path.join(process.cwd(), "zar-masasi-veri");
  const assetDir = path.join(dataDir, "assets");
  fs.mkdirSync(assetDir, { recursive: true });
  const store = new Store(path.join(dataDir, "db.json"));
  const password = opts.password || "";
  const name = opts.name || "Zar Masası";

  // Sahip anahtarı: masanın sahibi bu anahtarla bağlanır (host eden kişi otomatik olarak).
  let ownerKey = opts.ownerKey || (store.get("_sys/config/owner") || {}).key;
  if (!ownerKey) { ownerKey = rid(16); store.set("_sys/config/owner", { key: ownerKey }); }

  let anthropic = null, aiModel = opts.aiModel || process.env.ZM_AI_MODEL || "claude-opus-5-5";
  const apiKey = opts.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  if (apiKey) { const Anthropic = require("@anthropic-ai/sdk"); anthropic = new Anthropic({ apiKey }); }

  const tokens = new Map(); // oturum anahtarı -> kişi kimliği (HTTP dosya yüklemeleri için)
  const conns = new Set();

  /* ---------------- HTTP ---------------- */
  const appHtml = () => {
    const html = fs.readFileSync(path.join(WEB, "app.html"), "utf8");
    // Köprü uygulamadan önce, eklentiler (web/ext) uygulamadan sonra yüklenir.
    const ext = '<link rel="stylesheet" href="/ext/ext.css"><link rel="stylesheet" href="/ext/temalar.css">' + EXT_SCRIPTS.map(n => `<script src="/ext/${n}.js"></script>`).join("");
    const i = html.lastIndexOf("</body>");
    const withExt = i >= 0 ? html.slice(0, i) + ext + html.slice(i) : html + ext;
    return withExt.replace("<body>", '<body><script src="/i18n.js"></script><script src="/shim.js"></script>');
  };
  // Sıra önemli: veri dosyaları önce, onları kullanan eklentiler sonra.
  const EXT_SCRIPTS = ["veri-5e", "pencereler", "sihirbaz", "buyu", "gelisim", "gelisim-diger", "veri-pf2e", "pf2e", "pf2-sihirbaz", "motw", "maceralar", "cozumleyici", "mobilya", "katlar", "isik", "saldiri", "tavan", "birinci-sahis", "tema", "oyunlar", "sohbet", "forum"];
  const EXT_TYPES = { ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" };
  function send(res, code, body, type = "application/json; charset=utf-8", extra = {}) {
    res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store", ...extra });
    res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  }
  function authed(req) { return tokens.get(req.headers["x-zm-token"] || ""); }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    const p = url.pathname;
    try {
      if (req.method === "GET" && (p === "/" || p === "/index.html")) return send(res, 200, appHtml(), "text/html; charset=utf-8");
      if (req.method === "GET" && p === "/i18n.js") return send(res, 200, fs.readFileSync(path.join(WEB, "i18n.js")), "text/javascript; charset=utf-8");
      // Dil sözlüğü: web/i18n/<dil>.json, sayfaya eşzamanlı yüklenen bir betik olarak.
      if (req.method === "GET" && /^\/i18n\/[a-z]{2}\.js$/.test(p)) {
        const f = path.join(WEB, "i18n", path.basename(p, ".js") + ".json");
        const body = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "{}";
        return send(res, 200, `window.ZM_EN=${body};window.I18N&&I18N.ready(window.ZM_EN);`, "text/javascript; charset=utf-8");
      }
      if (req.method === "GET" && p === "/shim.js") return send(res, 200, fs.readFileSync(path.join(WEB, "shim.js")), "text/javascript; charset=utf-8");
      if (req.method === "GET" && (/^\/ext\/[a-z0-9-]+\.(js|css)$/.test(p) || /^\/ext\/maceralar\/[a-z0-9-]+\.(json|png|jpg|webp)$/.test(p) || /^\/ext\/mobilya\/[a-z0-9-]+\.svg$/.test(p))) {
        const f = path.join(WEB, p);
        if (!fs.existsSync(f)) return send(res, 404, { code: "not_found" });
        return send(res, 200, fs.readFileSync(f), EXT_TYPES[path.extname(f)]);
      }
      // Masa oyunları sayfası
      if (req.method === "GET" && (p === "/oyunlar" || p === "/oyunlar/")) return send(res, 200, fs.readFileSync(path.join(WEB, "oyunlar", "index.html")), "text/html; charset=utf-8");
      if (req.method === "GET" && /^\/oyunlar\/[a-z0-9-]+\.(js|css)$/.test(p)) {
        const f = path.join(WEB, p);
        if (!fs.existsSync(f)) return send(res, 404, { code: "not_found" });
        return send(res, 200, fs.readFileSync(f), EXT_TYPES[path.extname(f)]);
      }
      if (req.method === "GET" && p === "/api/info") return send(res, 200, { name, needsPassword: !!password, ai: !!anthropic, version: 1, forum: FORUM_KATEGORI });
      if (req.method === "GET" && p.startsWith("/assets/")) return serveAsset(req, res, p.slice(8));
      if (req.method === "POST" && p === "/api/assets") return uploadAsset(req, res);
      if (req.method === "DELETE" && p.startsWith("/api/assets/")) {
        const uid = authed(req); if (!uid) return send(res, 401, { code: "unauthorized" });
        const id = p.slice(12), meta = store.get("_sys/assets/" + id);
        if (!meta) return send(res, 404, { code: "not_found" });
        if (meta.owner !== uid) return send(res, 403, { code: "permission_denied" });
        fs.rmSync(path.join(assetDir, id), { force: true }); store.delete("_sys/assets/" + id);
        return send(res, 200, { ok: true });
      }
      send(res, 404, { code: "not_found" });
    } catch (e) { console.error(e); send(res, 500, { code: "internal", message: String(e.message || e) }); }
  });

  function uploadAsset(req, res) {
    const uid = authed(req); if (!uid) return send(res, 401, { code: "unauthorized" });
    const type = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
    if (!ASSET_TYPES.test(type)) return send(res, 415, { code: "unsupported_type", message: "Bu dosya türü yüklenemiyor" });
    const chunks = []; let size = 0, aborted = false;
    req.on("data", c => { size += c.length; if (size > MAX_ASSET) { aborted = true; send(res, 413, { code: "too_large", message: "Dosya 25 MB'tan büyük" }); req.destroy(); } else chunks.push(c); });
    req.on("end", () => {
      if (aborted) return;
      const id = rid(10) + "." + (EXT[type] || "bin");
      fs.writeFileSync(path.join(assetDir, id), Buffer.concat(chunks));
      store.set("_sys/assets/" + id, { owner: uid, type, size, name: decodeURIComponent(String(req.headers["x-filename"] || "")).slice(0, 200), created: Date.now() });
      send(res, 200, { id, url: "/assets/" + id, type, size });
    });
  }

  function serveAsset(req, res, id) {
    const meta = store.get("_sys/assets/" + id); const f = path.join(assetDir, path.basename(id));
    if (!meta || !fs.existsSync(f)) return send(res, 404, { code: "not_found" });
    const size = fs.statSync(f).size; const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
    const head = { "Content-Type": meta.type, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=31536000, immutable" };
    if (range) {
      const start = range[1] ? +range[1] : size - +range[2], end = range[1] && range[2] ? Math.min(+range[2], size - 1) : size - 1;
      if (start < 0 || start > end) { res.writeHead(416, { "Content-Range": `bytes */${size}` }); return res.end(); }
      res.writeHead(206, { ...head, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
      return fs.createReadStream(f, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...head, "Content-Length": size });
    fs.createReadStream(f).pipe(res);
  }

  /* ---------------- WebSocket ---------------- */
  const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 16 * 1024 * 1024 });
  const peerList = () => [...conns].filter(c => c.uid).map(c => ({ peer: c.peer, by: c.uid, kind: "user", presence: c.presence }));
  const broadcastPeers = (joined, left) => {
    const peers = peerList();
    for (const c of conns) if (c.uid) c.send({ ev: "peers", peers, joined, left });
  };

  // Her yazımda ilgili abonelere değişikliği gönder.
  store.listeners.add((type, p, data) => {
    const col = parentOf(p), id = p.split("/").pop();
    for (const c of conns) {
      if (!c.uid || !canAccess(c.uid, p)) continue;
      for (const [sid, s] of c.subs) {
        if (s.kind === "col" && s.path === col) c.send({ ev: "snap", sid, changes: [{ type, id, data: type === "removed" ? null : data }] });
        else if (s.kind === "doc" && s.path === p) c.send({ ev: "snap", sid, doc: { id, exists: type !== "removed", data: type === "removed" ? null : data } });
      }
    }
  });

  wss.on("connection", ws => {
    const c = { ws, uid: null, peer: rid(6), presence: {}, subs: new Map(), ai: new Map(), send: m => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); } };
    conns.add(c);
    ws.on("message", async raw => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      const reply = (result) => c.send({ re: m.id, result });
      const fail = (code, message) => c.send({ re: m.id, error: { code, message } });
      try {
        if (m.op === "hello") return hello(c, m, reply, fail);
        if (!c.uid) return fail("unauthorized", "Önce bağlanmalısın");
        const p = m.path;
        switch (m.op) {
          case "get": if (!canAccess(c.uid, p)) return fail("permission_denied", "İzin yok"); { const d = store.get(p); return reply({ exists: d !== undefined, data: d ?? null }); }
          case "set": if (!canWrite(c.uid, p)) return fail("permission_denied", "İzin yok"); store.set(p, m.data); return reply(true);
          case "update": if (!canWrite(c.uid, p)) return fail("permission_denied", "İzin yok"); store.update(p, m.data); return reply(true);
          case "delete": if (!canWrite(c.uid, p)) return fail("permission_denied", "İzin yok"); store.delete(p); return reply(true);
          case "query": {
            if (!canAccess(c.uid, p + "/x")) return fail("permission_denied", "İzin yok");
            let docs = store.list(p).map(d => ({ id: d.id, data: d.data }));
            if (m.orderBy) { const k = m.orderBy, dir = m.dir === "desc" ? -1 : 1; docs.sort((a, b) => { const u = a.data?.[k], v = b.data?.[k]; return (u > v ? 1 : u < v ? -1 : 0) * dir; }); }
            if (m.limit) docs = docs.slice(0, m.limit);
            return reply(docs);
          }
          case "sub": {
            const kind = m.kind === "doc" ? "doc" : "col";
            if (!canAccess(c.uid, kind === "col" ? p + "/x" : p)) return fail("permission_denied", "İzin yok");
            c.subs.set(m.sid, { kind, path: p });
            if (kind === "col") c.send({ ev: "snap", sid: m.sid, initial: true, changes: store.list(p).map(d => ({ type: "added", id: d.id, data: d.data })) });
            else { const d = store.get(p); c.send({ ev: "snap", sid: m.sid, initial: true, doc: { id: p.split("/").pop(), exists: d !== undefined, data: d ?? null } }); }
            return reply(true);
          }
          case "unsub": c.subs.delete(m.sid); return reply(true);
          case "profiles": {
            const out = {};
            for (const id of (m.ids || []).slice(0, 200)) { const u = store.get("_sys/users/" + id); if (u) out[id] = { name: u.name, color: u.color }; }
            return reply(out);
          }
          case "presence": c.presence = { ...c.presence, ...(m.data || {}) }; broadcastPeers([], []); return reply(true);
          case "emit": {
            const msg = { ev: "msg", topic: String(m.topic), data: m.data, peer: c.peer, by: c.uid };
            for (const o of conns) if (o !== c && o.uid) o.send(msg);
            return reply(true);
          }
          case "profile": { // ad / renk değişikliği
            const u = store.get("_sys/users/" + c.uid) || {};
            store.set("_sys/users/" + c.uid, { ...u, name: String(m.name || u.name).slice(0, 40), color: String(m.color || u.color).slice(0, 20) });
            return reply(true);
          }
          case "chatSend": case "chatClear": return chatOp(c, m, reply, fail);
          case "bgNew": case "bgSit": case "bgMove": case "bgReset": case "bgDelete": return boardOp(c, m, reply, fail);
          case "forumTopic": case "forumReply": case "forumDelete": case "forumPin": return forumOp(c, m, reply, fail);
          case "ai": return runAi(c, m, reply, fail);
          case "aiAbort": { const ctl = c.ai.get(m.target); if (ctl) ctl.abort(); return reply(true); }
          default: return fail("unknown_op", "Bilinmeyen işlem: " + m.op);
        }
      } catch (e) { fail(e.code || "internal", String(e.message || e)); }
    });
    ws.on("close", () => {
      conns.delete(c);
      for (const ctl of c.ai.values()) ctl.abort();
      if (c.uid) broadcastPeers([], [{ peer: c.peer, by: c.uid }]);
    });
  });

  function hello(c, m, reply, fail) {
    const isOwner = !!m.ownerKey && same(m.ownerKey, ownerKey);
    if (password && !isOwner && !(m.password && same(m.password, password))) return fail("bad_password", "Masa şifresi yanlış");
    const nm = String(m.name || "").trim().slice(0, 40) || "Oyuncu", color = String(m.color || "#2f8f86").slice(0, 20);
    let uid = m.userId, secret = m.secret;
    const known = uid && /^u-[0-9a-f]{8,}$/.test(uid) ? store.get("_sys/users/" + uid) : null;
    if (!known || !secret || sha(secret) !== known.secretHash) { uid = "u-" + rid(8); secret = rid(16); }
    const prev = store.get("_sys/users/" + uid) || { created: Date.now() };
    store.set("_sys/users/" + uid, { ...prev, name: nm, color, secretHash: sha(secret), owner: prev.owner || isOwner, seen: Date.now() });
    c.uid = uid; c.isOwner = isOwner || !!prev.owner;
    const token = rid(16); tokens.set(token, uid); c.token = token;
    c.ws.once("close", () => tokens.delete(token));
    reply({ me: { id: uid, name: nm, color }, secret, token, isOwner: c.isOwner, ai: !!anthropic, peer: c.peer, peers: peerList() });
    broadcastPeers([{ peer: c.peer, by: uid }], []);
  }

  function chatOp(c, m, reply, fail) {
    const gid = String(m.game || "");
    const g = GAME_ID.test(gid) && store.get("games/" + gid);
    if (!g) return fail("not_found", "Böyle bir oyun yok");
    const isMember = id => !!((g.dms && g.dms[id]) || (g.players && g.players[id]));
    if (!isMember(c.uid)) return fail("permission_denied", "Bu oyunun üyesi değilsin");
    const trim = col => { const all = store.list(col); if (all.length <= CHAT_KEEP) return; all.sort((a, b) => (a.data?.t || 0) - (b.data?.t || 0)); for (const d of all.slice(0, all.length - CHAT_KEEP)) store.delete(col + "/" + d.id); };
    if (m.op === "chatClear") {
      if (!(g.dms && g.dms[c.uid])) return fail("permission_denied", "Sohbeti yalnızca DM temizleyebilir");
      for (const d of store.list("chat/" + gid)) store.delete("chat/" + gid + "/" + d.id);
      return reply(true);
    }
    // Basit sel koruması: 5 saniyede en çok 8 mesaj.
    const now = Date.now(); c.chatT = (c.chatT || []).filter(t => now - t < 5000);
    if (c.chatT.length >= 8) return fail("rate_limited", "Biraz yavaş: çok hızlı yazıyorsun");
    const text = String(m.text || "").replace(/\r\n?/g, "\n").trim().slice(0, 1000), gif = chatGif(m.gif);
    if (gif === null) return fail("invalid_argument", "GIF adresi https:// ile başlamalı");
    if (!text && !gif) return fail("invalid_argument", "Boş mesaj");
    const to = m.to ? String(m.to) : null;
    if (to && (to === c.uid || !isMember(to))) return fail("invalid_argument", "Fısıldanacak kişi bu oyunda değil");
    c.chatT.push(now);
    const id = "m" + now.toString(36) + rid(3);
    const msg = { id, t: now, by: c.uid, text, ...(gif ? { gif } : {}), ...(to ? { to } : {}) };
    if (to) for (const u of [c.uid, to]) { const col = `data/users/${u}/chat/${gid}`; store.set(col + "/" + id, msg); trim(col); }
    else { store.set(`chat/${gid}/${id}`, msg); trim("chat/" + gid); }
    return reply({ id, t: now });
  }

  // Masa oyunları: tahta durumu boards/<id> belgesinde. İstemciler okur ve abone olur,
  // ama yazmayı yalnızca buradan yapar; her hamle kurallar.js ile denetlenir.
  function boardOp(c, m, reply, fail) {
    const me = { id: c.uid, name: (store.get("_sys/users/" + c.uid) || {}).name || "Oyuncu" };
    if (m.op === "bgNew") {
      const g = OYUNLAR[m.oyun]; if (!g) return fail("invalid_argument", "Bilinmeyen oyun");
      const id = "b" + Date.now().toString(36) + rid(3);
      store.set("boards/" + id, { oyun: m.oyun, durum: g.yeni(Math.random), koltuk: [null, null], olusturan: me.id, created: Date.now(), updated: Date.now() });
      return reply({ id });
    }
    const p = "boards/" + String(m.board || ""), b = canAccess(c.uid, p) && store.get(p);
    if (!b) return fail("not_found", "Böyle bir tahta yok");
    const g = OYUNLAR[b.oyun];
    if (m.op === "bgSit") {
      const k = m.koltuk === 1 ? 1 : 0, cur = b.koltuk[k];
      if (m.kalk) { if (cur && cur.id === me.id) b.koltuk[k] = null; else return fail("permission_denied", "Bu koltuk senin değil"); }
      else if (cur && cur.id !== me.id) return fail("taken", "Bu koltuk dolu");
      else b.koltuk[k] = me; // aynı kişi iki koltuğa da oturabilir (tek bilgisayarda iki kişi)
      store.set(p, { ...b, updated: Date.now() }); return reply(true);
    }
    if (m.op === "bgMove") {
      const d = b.durum, k = b.koltuk[d.sira];
      if (!k || k.id !== me.id) return fail("not_your_turn", "Sıra sende değil");
      if (!yasal(b.oyun, d, m.hamle)) return fail("illegal", "Bu hamle kurallara uymuyor");
      store.set(p, { ...b, durum: g.uygula(d, m.hamle, Math.random), updated: Date.now() }); return reply(true);
    }
    const yetkili = b.olusturan === me.id || c.isOwner || b.koltuk.some(x => x && x.id === me.id);
    if (!yetkili) return fail("permission_denied", "Yalnızca oyuncular ya da tahtayı açan yapabilir");
    if (m.op === "bgReset") { store.set(p, { ...b, durum: g.yeni(Math.random), updated: Date.now() }); return reply(true); }
    if (m.op === "bgDelete") { store.delete(p); return reply(true); }
  }

  // Forum: başlıklar forum/<id>, yanıtlar forum/<id>/yanitlar/<id>. Herkes okur; yazmayı yalnızca sunucu yapar.
  const sonForum = new Map(); // kişi -> son ileti zamanı (art arda gönderimi yavaşlatmak için)
  function forumOp(c, m, reply, fail) {
    const u = store.get("_sys/users/" + c.uid) || {};
    const yazar = { id: c.uid, name: u.name || "Oyuncu", color: u.color || "#2f8f86" };
    if (m.op === "forumTopic" || m.op === "forumReply") {
      const now = Date.now();
      if (now - (sonForum.get(c.uid) || 0) < 1000) return fail("too_fast", "Biraz bekle, sonra tekrar gönder");
      const govde = metin(m.body, 4000);
      if (m.op === "forumTopic") {
        const baslik = metin(m.title, 120).replace(/\s+/g, " ");
        if (!baslik) return fail("invalid_argument", "Başlık boş olamaz");
        const kategori = FORUM_KATEGORI.includes(m.kategori) ? m.kategori : "Genel sohbet";
        const sistem = /^[a-z0-9]{1,20}$/.test(m.sistem || "") ? m.sistem : null;
        const id = "t" + now.toString(36) + rid(3);
        store.set("forum/" + id, { baslik, govde, kategori, sistem, yazar, created: now, updated: now, yanit: 0, sonYazan: null, sabit: false });
        sonForum.set(c.uid, now); return reply({ id });
      }
      const tp = "forum/" + metin(m.topic, 40), t = /^forum\/t[0-9a-z]+$/.test(tp) && store.get(tp);
      if (!t) return fail("not_found", "Böyle bir başlık yok");
      if (!govde) return fail("invalid_argument", "Yanıt boş olamaz");
      const id = "p" + now.toString(36) + rid(3);
      store.set(tp + "/yanitlar/" + id, { govde, yazar, created: now });
      store.set(tp, { ...t, yanit: (t.yanit || 0) + 1, updated: now, sonYazan: yazar.name });
      sonForum.set(c.uid, now); return reply({ id });
    }
    const tp = "forum/" + metin(m.topic, 40), t = /^forum\/t[0-9a-z]+$/.test(tp) && store.get(tp);
    if (!t) return fail("not_found", "Böyle bir başlık yok");
    if (m.op === "forumPin") {
      if (!c.isOwner) return fail("permission_denied", "Yalnızca sunucu sahibi sabitleyebilir");
      store.set(tp, { ...t, sabit: !!m.sabit }); return reply(true);
    }
    // forumDelete: yanıt (m.post) ya da bütün başlık. Yazarı ya da sunucu sahibi silebilir.
    if (m.post) {
      const pp = tp + "/yanitlar/" + metin(m.post, 40), p = /^p[0-9a-z]+$/.test(String(m.post)) && store.get(pp);
      if (!p) return fail("not_found", "Böyle bir yanıt yok");
      if (p.yazar.id !== c.uid && !c.isOwner) return fail("permission_denied", "Yalnızca yazarı silebilir");
      store.delete(pp); store.set(tp, { ...t, yanit: Math.max(0, (t.yanit || 1) - 1) }); return reply(true);
    }
    if (t.yazar.id !== c.uid && !c.isOwner) return fail("permission_denied", "Yalnızca yazarı silebilir");
    for (const d of store.list(tp + "/yanitlar")) store.delete(d.path);
    store.delete(tp); return reply(true);
  }

  // Claude: istemci metin ya da [{role,content}] gönderir; yanıt akış hâlinde iletilir.
  async function runAi(c, m, reply, fail) {
    if (!anthropic) return fail("unavailable", "Bu sunucuda yapay zekâ kapalı (ANTHROPIC_API_KEY yok)");
    let messages = typeof m.input === "string" ? [{ role: "user", content: m.input }] : (m.input || []).map(t => ({ role: t.role === "assistant" ? "assistant" : "user", content: String(t.content || "") }));
    // Ardışık aynı roldeki mesajları birleştir.
    messages = messages.reduce((a, t) => { const l = a[a.length - 1]; if (l && l.role === t.role) l.content += "\n\n" + t.content; else a.push({ ...t }); return a; }, []);
    if (!messages.length || messages[0].role !== "user") return fail("invalid_argument", "Geçersiz istek");
    const ctl = new AbortController(); c.ai.set(m.id, ctl);
    try {
      const stream = anthropic.messages.stream({
        model: aiModel, max_tokens: 32000,
        output_config: { effort: "medium" },
        ...(m.json ? { system: "Yanıtı yalnızca tek bir geçerli JSON değeri olarak ver; öncesinde ya da sonrasında açıklama, kod bloğu işareti ekleme." } : {}),
        messages,
      }, { signal: ctl.signal });
      let text = "", last = 0;
      stream.on("text", d => { text += d; const n = Date.now(); if (!m.json && n - last > 80) { last = n; c.send({ ev: "aiText", re: m.id, text }); } });
      const fin = await stream.finalMessage();
      if (fin.stop_reason === "refusal") return fail("refused", "Claude bu isteği yanıtlamadı");
      text = fin.content.filter(b => b.type === "text").map(b => b.text).join("");
      reply({ text });
    } catch (e) {
      if (ctl.signal.aborted) fail("aborted", "İptal edildi"); else { console.error("[ai]", e.status || "", String(e.message || e)); fail("ai_error", String(e.message || e)); }
    } finally { c.ai.delete(m.id); }
  }

  return {
    server, store, ownerKey,
    listen(port = 7373, host = "0.0.0.0") { return new Promise((res, rej) => { server.once("error", rej); server.listen(port, host, () => res(server.address().port)); }); },
    async close() { for (const c of conns) c.ws.terminate(); wss.close(); await new Promise(r => server.close(r)); store.flush(); },
  };
}

module.exports = { createServer, canAccess, canWrite, FORUM_KATEGORI };
