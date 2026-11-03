// Zar Masası sunucusu. Artifact'ın kullandığı db / assets / user / room / sample arayüzlerinin
// karşılığını WebSocket + HTTP üzerinden sağlar ve uygulamanın kendisini (web/app.html) sunar.
// Masaüstü uygulamasında "host et" seçilince gömülü, kendi sunucunda ise `node server/cli.js` ile çalışır.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");
const { Store, parentOf } = require("./store");

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
    return withExt.replace("<body>", '<body><script src="/shim.js"></script>');
  };
  // Sıra önemli: veri dosyaları önce, onları kullanan eklentiler sonra.
  const EXT_SCRIPTS = ["veri-5e", "pencereler", "sihirbaz", "buyu", "gelisim", "gelisim-diger", "veri-pf2e", "pf2e", "pf2-sihirbaz", "motw", "maceralar", "mobilya", "katlar", "isik", "saldiri", "birinci-sahis", "tema"];
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
      if (req.method === "GET" && p === "/shim.js") return send(res, 200, fs.readFileSync(path.join(WEB, "shim.js")), "text/javascript; charset=utf-8");
      if (req.method === "GET" && (/^\/ext\/[a-z0-9-]+\.(js|css)$/.test(p) || /^\/ext\/maceralar\/[a-z0-9-]+\.(json|png|jpg|webp)$/.test(p) || /^\/ext\/mobilya\/[a-z0-9-]+\.svg$/.test(p))) {
        const f = path.join(WEB, p);
        if (!fs.existsSync(f)) return send(res, 404, { code: "not_found" });
        return send(res, 200, fs.readFileSync(f), EXT_TYPES[path.extname(f)]);
      }
      if (req.method === "GET" && p === "/api/info") return send(res, 200, { name, needsPassword: !!password, ai: !!anthropic, version: 1 });
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
          case "set": if (!canAccess(c.uid, p)) return fail("permission_denied", "İzin yok"); store.set(p, m.data); return reply(true);
          case "update": if (!canAccess(c.uid, p)) return fail("permission_denied", "İzin yok"); store.update(p, m.data); return reply(true);
          case "delete": if (!canAccess(c.uid, p)) return fail("permission_denied", "İzin yok"); store.delete(p); return reply(true);
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
      if (ctl.signal.aborted) fail("aborted", "İptal edildi"); else fail("ai_error", String(e.message || e));
    } finally { c.ai.delete(m.id); }
  }

  return {
    server, store, ownerKey,
    listen(port = 7373, host = "0.0.0.0") { return new Promise((res, rej) => { server.once("error", rej); server.listen(port, host, () => res(server.address().port)); }); },
    async close() { for (const c of conns) c.ws.terminate(); wss.close(); await new Promise(r => server.close(r)); store.flush(); },
  };
}

module.exports = { createServer, canAccess };
