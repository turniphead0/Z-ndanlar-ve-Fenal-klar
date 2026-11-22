// Zar Masası sunucusu. Artifact'ın kullandığı db / assets / user / room / sample arayüzlerinin
// karşılığını WebSocket + HTTP üzerinden sağlar ve uygulamanın kendisini (web/app.html) sunar.
// Masaüstü uygulamasında "host et" seçilince gömülü, kendi sunucunda ise `node server/cli.js` ile çalışır.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const { WebSocketServer } = require("ws");
const { Store, parentOf } = require("./store");
const { OYUNLAR, yasal } = require("../web/oyunlar/kurallar");
const { kurHesap } = require("./hesap");
const { smtpAyari, smtpGonderici } = require("./eposta");
const { kurKartMasa } = require("./kartmasa");
const { kurRoller } = require("./roller");
const { kurBotlar } = require("./botlar");
const { kurDosyalar } = require("./dosyalar");
const { kurBildirim } = require("./bildirim");
const { kurYedek } = require("./yedek");
const { kurProfil } = require("./profil");
const { kurRozetler } = require("./rozetler");
const { kurArama } = require("./arama");
const { kurGizlilik, gizlilikKurallari } = require("./gizlilik");

const WEB = path.join(__dirname, "..", "web");
const ASSET_TYPES = /^(image\/|audio\/|video\/|application\/pdf$)/;
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg", "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/wav": "wav", "video/mp4": "mp4", "video/webm": "webm", "application/pdf": "pdf" };

const rid = (n = 12) => crypto.randomBytes(n).toString("hex");
const sha = s => crypto.createHash("sha256").update(String(s)).digest("hex");
const same = (a, b) => { const x = Buffer.from(sha(a)), y = Buffer.from(sha(b)); return crypto.timingSafeEqual(x, y); };

// Her yanıta eklenen güvenlik başlıkları: başka sitelerin sayfayı çerçeveye almasını, tarayıcının dosya türünü
// tahmin etmesini ve adres bilgisinin dışarı sızmasını engeller.
const GUVENLIK = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "same-origin",
  "Content-Security-Policy": "frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Resource-Policy": "same-site",
};
// Yüklenen dosyalar (SVG içinde betik olabilir) kendi başına açılınca hiçbir şey çalıştıramasın.
const DOSYA_CSP = "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox";
const BAGLANTI_SINIRI = 40; // bir adresten aynı anda en çok bu kadar WebSocket bağlantısı

// Gizli yollar: _sys/* hiçbir istemciye açık değil; data/users/<kişi>/* yalnızca o kişiye açık.
function canAccess(uid, p) {
  const s = String(p || "").split("/");
  if (!s[0] || s.some(x => !x || x === "." || x === "..")) return false;
  if (s[0] === "_sys") return false;
  if (s[0] === "data" && s[1] === "users") return s[2] === uid;
  return true;
}
// Masa oyunu belgeleri (boards/*), sohbet mesajları (chat/*, data/users/<kişi>/chat/*), forum (forum/*),
// arkadaşlıklar ve özel mesajlar (data/users/<kişi>/{arkadas,konusma,dm}/*) yalnızca sunucu tarafından yazılır:
// tahtada kurallara uygun hamleler, sohbette, forumda ve mesajlarda gönderen damgalı iletiler.
const SUNUCU_YAZAR = new Set(["chat", "arkadas", "konusma", "dm", "grup", "kartmasa", "bildirim", "engel"]);
function canWrite(uid, p) {
  const s = String(p).split("/");
  return canAccess(uid, p) && s[0] !== "boards" && s[0] !== "chat" && s[0] !== "forum" && s[0] !== "kartoyun" && !(s[0] === "data" && s[1] === "users" && SUNUCU_YAZAR.has(s[3]));
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
const SISTEM_AD = { dnd5e: "D&D 5e", coc7: "Call of Cthulhu", yze: "Year Zero", pf2e: "Pathfinder 2e", motw: "Monster of the Week" };
const escAttr = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const FORUM_KATEGORI = ["Genel sohbet", "Oyuncu arıyorum", "Masa arıyorum", "Kurallar", "Paylaşım"];
const metin = (v, n) => String(v == null ? "" : v).replace(/\r\n/g, "\n").trim().slice(0, n);
// Masa oyunu odasının adı: kişinin verdiği ad (tek satır, en çok 60 karakter).
const odaAdi = v => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);

// Statik dosyalar (uygulama, eklentiler, görseller) bellekte tutulur ve sıkıştırılmış hâlleri bir kez
// hazırlanır. Tarayıcı ETag ile "değişti mi?" diye sorar; değişmediyse 304 ile boş yanıt döner. Sayfadaki
// betik adreslerine ?v=<sürüm> eklendiği için tarayıcı onları bir yıl önbellekte tutar ve dosya değişince
// adres de değiştiği için yenisini indirir. Eskiden her sayfa açılışında ~1,5 MB yeniden okunup gönderiliyordu.
const SIKISTIR = /^(text\/|application\/(json|javascript|manifest\+json)|image\/svg)/;
function kayit(buf) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
  return { buf, etag: '"' + crypto.createHash("sha1").update(buf).digest("base64url").slice(0, 20) + '"', br: null, gz: null };
}
const statik = new Map(); // dosya yolu -> { mtime, size, kayit }
function dosyaKaydi(f) {
  const st = fs.statSync(f);
  const e = statik.get(f);
  if (e && e.mtime === st.mtimeMs && e.size === st.size) return e.kayit;
  const k = kayit(fs.readFileSync(f));
  statik.set(f, { mtime: st.mtimeMs, size: st.size, kayit: k });
  return k;
}
function surumu(f) { try { return dosyaKaydi(f).etag.slice(1, 11); } catch (e) { return "0"; } }

const hesapModuOf = opts => (opts.hesap === "zorunlu" ? "zorunlu" : "istege-bagli");

function createServer(opts = {}) {
  const dataDir = opts.dataDir || path.join(process.cwd(), "zar-masasi-veri");
  const assetDir = path.join(dataDir, "assets");
  fs.mkdirSync(assetDir, { recursive: true });
  const store = new Store(path.join(dataDir, "db.json"));
  const name = opts.name || "Zar Masası";
  // Hesap: "zorunlu" ise herkes kullanıcı adı + şifreyle girer; "istege-bagli" ise hesapsız da oynanabilir
  // (masaüstünden host edilen masalar). Profil, arkadaşlar ve özel mesajlar hesap ister.
  const hesapModu = hesapModuOf(opts);
  // Ortak masa şifresi yalnızca hesapsız girilebilen masalarda kullanılır. Hesaplı sunucuda herkes kendi
  // kullanıcı adı ve şifresiyle girdiği için ortak şifre yok sayılır.
  const password = hesapModu === "zorunlu" ? "" : (opts.password || "");
  // Ters vekil (Caddy, nginx) arkasındaysa gerçek adres X-Forwarded-For başlığından okunur; değilse bu başlık
  // herkes tarafından uydurulabileceği için yok sayılır.
  const vekil = !!opts.vekil;
  const ipOf = req => String((vekil && String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()) || req.socket.remoteAddress || "");

  // Sahip anahtarı: masanın sahibi bu anahtarla bağlanır (host eden kişi otomatik olarak).
  let ownerKey = opts.ownerKey || (store.get("_sys/config/owner") || {}).key;
  if (!ownerKey) { ownerKey = rid(16); store.set("_sys/config/owner", { key: ownerKey }); }

  let anthropic = null, aiModel = opts.aiModel || process.env.ZM_AI_MODEL || "claude-opus-5-5";
  const apiKey = opts.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  if (apiKey) { const Anthropic = require("@anthropic-ai/sdk"); anthropic = new Anthropic({ apiKey }); }

  const tokens = new Map(); // oturum anahtarı -> kişi kimliği (HTTP dosya yüklemeleri için)
  const conns = new Set();
  let bildirim = null;
  // E-posta: SMTP ayarı (opts.smtp ya da ZM_SMTP_*) varsa doğrulama kodları gönderilir ve e-posta zorunlu olur.
  // Testler opts.epostaGonder ile kendi göndericisini verir.
  const epostaGonder = opts.epostaGonder || smtpGonderici(opts.smtp !== undefined ? opts.smtp : (hesapModuOf(opts) === "zorunlu" ? smtpAyari() : null));
  // Gizlilik kuralları (profil görünürlüğü, engelleme): hesap, profil, dosyalar ve bildirimler kullanır (server/gizlilik.js).
  let roller = null;
  const kurallar = gizlilikKurallari({ store, adminMi: c => roller.admin(c) });
  const hesap = kurHesap({ kurallar,  store, conns, arkadasBildir: (tur, kimden, kime) => bildirim && bildirim.arkadas(tur, kimden, kime), epostaGonder, epostaModu: opts.eposta || process.env.ZM_EPOSTA || "", sunucuAdi: name, ...(opts.insanMi ? { insanMi: opts.insanMi } : {}) });
  // Roller (admin, tester): ilk admin ZM_ADMIN ile ya da sahip bağlantısıyla belirlenir (server/roller.js).
  roller = kurRoller({ store, conns, adminler: opts.admin || "" });
  // Yükleme sınırları (dosya başına ve kişi başına toplam), "Yüklediklerim" ve profildeki oyunlar (server/dosyalar.js).
  const dosyalar = kurDosyalar({ store, roller, conns, kurallar, maxDosya: opts.maxDosya || process.env.ZM_MAX_DOSYA, kota: opts.kota || process.env.ZM_KOTA });
  // Bildirimler: sıra sende, oyun bitti, katılma istekleri, arkadaşlık ve kişiden kişiye (server/bildirim.js).
  bildirim = kurBildirim({ store, conns, dosyalar, kurallar });
  // Profil sayfası: kişinin forumda yazdıkları (server/profil.js).
  const profil = kurProfil({ store, kurallar });
  // Profil rozetleri ("İlk galibiyet", "10 oturum yönetti") ve genel arama (Ctrl+K).
  const rozetler = kurRozetler({ store, conns, dosyalar, forumu: profil.forumu, kurallar });
  const arama = kurArama({ store, conns, hesap, masaOzeti: dosyalar.masaOzeti, kurallar });
  let botlar = null;
  const kartMasa = kurKartMasa({ store, botKisi: (c, d, id) => botlar.kartBotKisi(c, d, id) });
  // Sohbette anılan bot için kısa yanıt (yalnızca yapay zekâ açıksa).
  const yapayZeka = anthropic ? async istek => {
    const r = await anthropic.messages.create({ model: aiModel, max_tokens: 600, messages: [{ role: "user", content: istek }] });
    return r.content.filter(b => b.type === "text").map(b => b.text).join("");
  } : null;
  // Oyun yedekleri: tek .zip olarak indir, sunucudan kaldır, geri yükle (server/yedek.js).
  const yedek = kurYedek({ store, dosyalar, kartMasa, assetDir, ASSET_TYPES, EXT, guvenlik: GUVENLIK, surum: require("../package.json").version });
  dosyalar.yerSusle = (uid, yer, y) => Object.assign(y, yedek.izin(uid, yer));
  // Gizlilik, engelleme, şikâyet, verilerimi indir, hesap silme (server/gizlilik.js).
  const gizlilik = kurGizlilik({ store, conns, roller, hesap, kurallar, dosyalar, bildirim, assetDir, dataDir, guvenlik: GUVENLIK, surum: require("../package.json").version });
  botlar = kurBotlar({ store, conns, roller, kartMasa, sohbeteYaz: (gid, by, text) => sohbeteYaz(gid, by, text), yapayZeka, gecikme: opts.botGecikme });

  /* ---------------- HTTP ---------------- */
  // Uygulama sayfası: app.html + köprü + eklentiler. Her betiğin adresine içeriğinden çıkan bir sürüm eklenir
  // (?v=…); sayfa bir kez üretilir, dosyalardan biri değişince yeniden üretilir.
  const v = rel => `/${rel}?v=${surumu(path.join(WEB, rel))}`;
  let appOnbellek = { anahtar: "", kayit: null };
  const appHtml = () => {
    const dosyalar = ["app.html", "i18n.js", "shim.js", "ortak.js", "ortak.css", "ext/ext.css", "ext/temalar.css", "gorsel/katalog.js", "gorsel/secici.js", ...EXT_SCRIPTS.map(n => `ext/${n}.js`)];
    const anahtar = dosyalar.map(surumu).join(",");
    if (appOnbellek.anahtar === anahtar) return appOnbellek.kayit;
    const html = fs.readFileSync(path.join(WEB, "app.html"), "utf8");
    // Köprü uygulamadan önce, eklentiler (web/ext) uygulamadan sonra yüklenir.
    const ext = `<link rel="stylesheet" href="${v("ext/ext.css")}"><link rel="stylesheet" href="${v("ext/temalar.css")}"><script src="${v("gorsel/katalog.js")}"></script><script src="${v("gorsel/secici.js")}"></script>` + EXT_SCRIPTS.map(n => `<script src="${v(`ext/${n}.js`)}"></script>`).join("");
    const i = html.lastIndexOf("</body>");
    const withExt = i >= 0 ? html.slice(0, i) + ext + html.slice(i) : html + ext;
    // Ortak üst menü, tema ve yazı boyutu (web/ortak.js) <head>'de: tema sayfa çizilmeden uygulanır.
    const son = withExt.replace("</head>", `<link rel="stylesheet" href="${v("ortak.css")}"><script src="${v("ortak.js")}"></script></head>`)
      .replace("<body>", `<body><script src="${v("i18n.js")}"></script><script src="${v("shim.js")}"></script>`);
    appOnbellek = { anahtar, kayit: kayit(son) };
    return appOnbellek.kayit;
  };
  // Forum sayfası: bir konunun bağlantısı paylaşılınca (WhatsApp, Discord) önizlemede konunun başlığı görünsün.
  const forumHtml = konu => {
    const t = /^t[0-9a-z]{1,40}$/.test(konu) && store.get("forum/" + konu);
    const html = dosyaKaydi(path.join(WEB, "forum", "index.html")).buf.toString("utf8");
    if (!t) return kayit(html);
    const ac = String(t.govde || "").replace(/\s+/g, " ").trim().slice(0, 200);
    const meta = `<meta property="og:title" content="${escAttr(t.baslik)}"><meta property="og:description" content="${escAttr(ac)}"><meta property="og:site_name" content="${escAttr(name)}">`;
    return kayit(html.replace(/<title>[^<]*<\/title>/, `<title>${escAttr(t.baslik)} · Forum · ${escAttr(name)}</title>${meta}`));
  };
  // Dil sözlüğü betiği (web/i18n/<dil>.json'dan üretilir), dosya değişene kadar bellekte.
  const dilOnbellek = new Map();
  const dilBetigi = dil => {
    const f = path.join(WEB, "i18n", dil + ".json");
    const ham = fs.existsSync(f) ? dosyaKaydi(f) : null, anahtar = ham ? ham.etag : "-";
    const e = dilOnbellek.get(dil);
    if (e && e.anahtar === anahtar) return e.kayit;
    const body = ham ? ham.buf.toString("utf8") : "{}";
    const k = kayit(`window.ZM_EN=${body};window.I18N&&I18N.ready(window.ZM_EN);`);
    dilOnbellek.set(dil, { anahtar, kayit: k });
    return k;
  };
  // Statik yanıt: ETag/304, sıkıştırma (brotli ya da gzip, bir kez hazırlanır) ve önbellek başlıkları.
  function sunKayit(req, res, k, type, cache) {
    const url = req.url || "";
    const cc = cache || (/[?&]v=/.test(url) ? "public, max-age=31536000, immutable" : "no-cache");
    const head = { ...GUVENLIK, "Content-Type": type, "Cache-Control": cc, ETag: k.etag, Vary: "Accept-Encoding" };
    if (req.headers["if-none-match"] === k.etag) { res.writeHead(304, head); return res.end(); }
    let body = k.buf;
    if (k.buf.length > 1024 && SIKISTIR.test(type)) {
      const ae = String(req.headers["accept-encoding"] || "");
      if (/\bbr\b/.test(ae)) { k.br = k.br || zlib.brotliCompressSync(k.buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: k.buf.length } }); body = k.br; head["Content-Encoding"] = "br"; }
      else if (/\bgzip\b/.test(ae)) { k.gz = k.gz || zlib.gzipSync(k.buf, { level: 9 }); body = k.gz; head["Content-Encoding"] = "gzip"; }
    }
    head["Content-Length"] = body.length;
    res.writeHead(200, head);
    res.end(req.method === "HEAD" ? undefined : body);
  }
  const sunDosya = (req, res, f, type, cache) => sunKayit(req, res, dosyaKaydi(f), type, cache);
  // Sıra önemli: veri dosyaları önce, onları kullanan eklentiler sonra.
  const EXT_SCRIPTS = ["doku", "veri-5e", "pencereler", "sihirbaz", "buyu", "gelisim", "gelisim-diger", "veri-pf2e", "pf2e", "pf2-sihirbaz", "motw", "maceralar", "cozumleyici", "mobilya", "katlar", "isik", "saldiri", "tavan", "birinci-sahis", "uc-boyut", "tema", "oyunlar", "bildirim", "sohbet", "forum", "sosyal", "galeri", "botlar", "mobil-mod"];
  const EXT_TYPES = { ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" };
  const MOBIL_TYPES = { ".webmanifest": "application/manifest+json; charset=utf-8", ".json": "application/manifest+json; charset=utf-8" };
  function send(res, code, body, type = "application/json; charset=utf-8", extra = {}) {
    res.writeHead(code, { ...GUVENLIK, "Content-Type": type, "Cache-Control": "no-store", ...extra });
    res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  }
  function authed(req) { return tokens.get(req.headers["x-zm-token"] || ""); }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    const p = url.pathname;
    try {
      if (req.method === "GET" && (p === "/" || p === "/index.html")) return sunKayit(req, res, appHtml(), "text/html; charset=utf-8");
      if (req.method === "GET" && p === "/i18n.js") return sunDosya(req, res, path.join(WEB, "i18n.js"), "text/javascript; charset=utf-8");
      // Dil sözlüğü: web/i18n/<dil>.json, sayfaya eşzamanlı yüklenen bir betik olarak.
      if (req.method === "GET" && /^\/i18n\/[a-z]{2}\.js$/.test(p)) {
        return sunKayit(req, res, dilBetigi(path.basename(p, ".js")), "text/javascript; charset=utf-8");
      }
      if (req.method === "GET" && p === "/zip.js") return sunDosya(req, res, path.join(WEB, "zip.js"), "text/javascript; charset=utf-8");
      if (req.method === "GET" && p === "/shim.js") return sunDosya(req, res, path.join(WEB, "shim.js"), "text/javascript; charset=utf-8");
      // Bütün sayfalarda aynı üst menü, genel arama (Ctrl+K), profil kartı, tema ve yazı boyutu.
      if (req.method === "GET" && p === "/ortak.js") return sunDosya(req, res, path.join(WEB, "ortak.js"), "text/javascript; charset=utf-8");
      if (req.method === "GET" && p === "/ortak.css") return sunDosya(req, res, path.join(WEB, "ortak.css"), "text/css; charset=utf-8");
      // Forum sayfası: /forum (konular), /forum/yeni (yeni konu), /forum/<konu> (paylaşılabilir konu bağlantısı).
      if (req.method === "GET" && (p === "/forum" || p === "/forum/" || p === "/forum/yeni" || /^\/forum\/t[0-9a-z]{1,40}$/.test(p))) return sunKayit(req, res, forumHtml(p.slice(7)), "text/html; charset=utf-8");
      if (req.method === "GET" && /^\/forum\/[a-z0-9-]+\.(js|css)$/.test(p)) {
        const f = path.join(WEB, p);
        if (!fs.existsSync(f)) return send(res, 404, { code: "not_found" });
        return sunDosya(req, res, f, EXT_TYPES[path.extname(f)]);
      }
      if (req.method === "GET" && (/^\/ext\/[a-z0-9-]+\.(js|css)$/.test(p) || /^\/ext\/maceralar\/[a-z0-9-]+\.(json|png|jpg|webp)$/.test(p) || /^\/ext\/mobilya\/[a-z0-9-]+\.webp$/.test(p) || /^\/ext\/kutuphane\/[a-z0-9-]+\.js$/.test(p))) {
        const f = path.join(WEB, p);
        if (!fs.existsSync(f)) return send(res, 404, { code: "not_found" });
        return sunDosya(req, res, f, EXT_TYPES[path.extname(f)]);
      }
      // Hazır masa arka planları ve jetonlar (web/gorsel): RPG haritaları, kart ve tahta oyunları kullanır.
      // Hazır haritalar eskiden SVG idi, artık gerçekçi WebP resimler: eski adresler yenisine yönlenir (kayıtlı haritalar bozulmasın).
      if (req.method === "GET" && /^\/gorsel\/harita-[a-z0-9-]+\.svg$/.test(p) && !fs.existsSync(path.join(WEB, "gorsel", path.basename(p))) && fs.existsSync(path.join(WEB, "gorsel", path.basename(p, ".svg") + ".webp"))) {
        res.writeHead(301, { Location: p.replace(/\.svg$/, ".webp"), "Cache-Control": "public, max-age=86400" }); return res.end();
      }
      if (req.method === "GET" && /^\/gorsel\/[a-z0-9-]+\.(svg|webp)$/.test(p)) {
        const f = path.join(WEB, "gorsel", path.basename(p));
        if (!fs.existsSync(f)) return send(res, 404, { code: "not_found" });
        return sunDosya(req, res, f, p.endsWith(".webp") ? "image/webp" : "image/svg+xml", /[?&]v=/.test(req.url) ? null : "public, max-age=86400");
      }
      if (req.method === "GET" && (p === "/gorsel/katalog.js" || p === "/gorsel/secici.js")) return sunDosya(req, res, path.join(WEB, "gorsel", path.basename(p)), "text/javascript; charset=utf-8");
      // Masa oyunları sayfası
      if (req.method === "GET" && (p === "/oyunlar" || p === "/oyunlar/")) return sunDosya(req, res, path.join(WEB, "oyunlar", "index.html"), "text/html; charset=utf-8");
      if (req.method === "GET" && /^\/oyunlar\/kk\/[a-z0-9-]+\.png$/.test(p) && fs.existsSync(path.join(WEB, "oyunlar", "kk", path.basename(p)))) return sunDosya(req, res, path.join(WEB, "oyunlar", "kk", path.basename(p)), "image/png");
      if (req.method === "GET" && /^\/oyunlar\/[a-z0-9-]+\.(js|css)$/.test(p)) {
        const f = path.join(WEB, p);
        if (!fs.existsSync(f)) return send(res, 404, { code: "not_found" });
        return sunDosya(req, res, f, EXT_TYPES[path.extname(f)]);
      }
      if (req.method === "GET" && p === "/api/info") return send(res, 200, { name, sistemler: SISTEM_AD, needsPassword: !!password, ai: !!anthropic, version: 1, forum: FORUM_KATEGORI, hesap: hesapModu, eposta: hesap.epostaAcik, maxDosya: dosyalar.MAX });
      if (hesap.http(req, res, p, send, ipOf)) return;
      // Profil sayfası: /profil (kendi profilin), /profil?kisi=<kimlik> ya da /profil?ad=<kullanıcı adı>
      if (req.method === "GET" && (p === "/profil" || p === "/profil/")) return sunDosya(req, res, path.join(WEB, "profil", "index.html"), "text/html; charset=utf-8");
      if (req.method === "GET" && /^\/profil\/[a-z0-9-]+\.(js|css)$/.test(p)) {
        const f = path.join(WEB, p);
        if (!fs.existsSync(f)) return send(res, 404, { code: "not_found" });
        return sunDosya(req, res, f, EXT_TYPES[path.extname(f)]);
      }
      // Mobil uygulama (telefon tarayıcısı ya da Android uygulaması): /mobil
      if (req.method === "GET" && (p === "/mobil" || p === "/mobil/")) return sunDosya(req, res, path.join(WEB, "mobil", "index.html"), "text/html; charset=utf-8");
      if (req.method === "GET" && /^\/mobil\/[a-z0-9-]+\.(js|css|json|svg|png|webmanifest)$/.test(p)) {
        const f = path.join(WEB, p);
        if (!fs.existsSync(f)) return send(res, 404, { code: "not_found" });
        return sunDosya(req, res, f, MOBIL_TYPES[path.extname(f)] || EXT_TYPES[path.extname(f)]);
      }
      if (req.method === "GET" && p.startsWith("/assets/")) return serveAsset(req, res, p.slice(8));
      if (yedek.http(req, res, p, send, authed)) return;
      if (gizlilik.http(req, res, p, send)) return;
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
    } catch (e) { console.error(e); send(res, 500, { code: "internal", message: "Sunucuda bir hata oldu" }); }
  });

  function uploadAsset(req, res) {
    const uid = authed(req); if (!uid) return send(res, 401, { code: "unauthorized" });
    const type = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
    if (!ASSET_TYPES.test(type)) return send(res, 415, { code: "unsupported_type", message: "Bu dosya türü yüklenemiyor" });
    // Boyut sınırı: dosya başına en çok dosyalar.MAX, kişinin toplam kotasında kalan alan kadar.
    const bildirilen = Number(req.headers["content-length"]);
    const ilk = bildirilen > 0 ? dosyalar.sinirAsildi(uid, bildirilen) : null;
    if (ilk) { res.setHeader("Connection", "close"); send(res, 413, { code: "too_large", message: ilk }); req.resume(); return; }
    const sinir = dosyalar.yuklenebilir(uid);
    const chunks = []; let size = 0, aborted = false;
    req.on("data", c => { if (aborted) return; size += c.length; if (size > sinir) { aborted = true; res.setHeader("Connection", "close"); send(res, 413, { code: "too_large", message: dosyalar.sinirAsildi(uid, size) || "Dosya çok büyük" }); req.destroy(); } else chunks.push(c); });
    req.on("end", () => {
      if (aborted) return;
      const id = rid(10) + "." + (EXT[type] || "bin");
      fs.writeFileSync(path.join(assetDir, id), Buffer.concat(chunks));
      let ad = ""; try { ad = decodeURIComponent(String(req.headers["x-filename"] || "")); } catch (e) {}
      const yer = dosyalar.yerDuzelt(req.headers["x-zm-yer"]);
      store.set("_sys/assets/" + id, { owner: uid, type, size, name: ad.slice(0, 200), created: Date.now(), ...(yer ? { yer } : {}) });
      send(res, 200, { id, url: "/assets/" + id, type, size });
    });
  }

  function serveAsset(req, res, id) {
    const meta = store.get("_sys/assets/" + id); const f = path.join(assetDir, path.basename(id));
    if (!meta || !fs.existsSync(f)) return send(res, 404, { code: "not_found" });
    const size = fs.statSync(f).size; const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
    const head = { ...GUVENLIK, "Content-Type": meta.type, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=31536000, immutable" };
    if (meta.type !== "application/pdf") head["Content-Security-Policy"] = DOSYA_CSP;
    if (range) {
      const start = range[1] ? +range[1] : size - +range[2], end = range[1] && range[2] ? Math.min(+range[2], size - 1) : size - 1;
      if (!(start >= 0) || start > end) { res.writeHead(416, { ...GUVENLIK, "Content-Range": `bytes */${size}` }); return res.end(); }
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

  // Her yazımda ilgili abonelere değişikliği gönder. Belgenin JSON metni depodan hazır gelir ve mesajın
  // gövdesi bir kez kurulur; abone başına yalnızca küçük bir önek eklenir (eskiden her abone için baştan
  // JSON'a çevriliyordu).
  store.listeners.add((type, p, data, json) => {
    const col = parentOf(p), id = p.split("/").pop();
    let colGovde = null, docGovde = null;
    for (const c of conns) {
      if (!c.uid || !c.subs.size || !canAccess(c.uid, p)) continue;
      for (const [sid, s] of c.subs) {
        if (s.kind === "col" && s.path === col) {
          colGovde = colGovde || `,"changes":[{"type":"${type}","id":${JSON.stringify(id)},"data":${type === "removed" ? "null" : json}}]}`;
          c.sendRaw(`{"ev":"snap","sid":${JSON.stringify(sid)}${colGovde}`);
        } else if (s.kind === "doc" && s.path === p) {
          docGovde = docGovde || `,"doc":{"id":${JSON.stringify(id)},"exists":${type !== "removed"},"data":${type === "removed" ? "null" : json}}}`;
          c.sendRaw(`{"ev":"snap","sid":${JSON.stringify(sid)}${docGovde}`);
        }
      }
    }
  });

  const ipSayac = new Map(); // adres -> açık bağlantı sayısı
  wss.on("connection", (ws, req) => {
    const ip = ipOf(req), n = (ipSayac.get(ip) || 0) + 1;
    if (n > BAGLANTI_SINIRI) return ws.close(1008, "Bu adresten çok fazla bağlantı var");
    ipSayac.set(ip, n);
    ws.once("close", () => { const k = (ipSayac.get(ip) || 1) - 1; if (k > 0) ipSayac.set(ip, k); else ipSayac.delete(ip); });
    const c = { ws, uid: null, peer: rid(6), presence: {}, subs: new Map(), ai: new Map(), send: m => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); }, sendRaw: t => { if (ws.readyState === 1) ws.send(t); } };
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
            const on = new Set([...conns].map(x => x.uid));
            for (const id of (m.ids || []).slice(0, 200)) { const u = store.get("_sys/users/" + id); if (u) out[id] = { name: u.name, color: u.color, foto: u.foto || null, kullanici: u.username || null, cevrimici: (on.has(id) && kurallar.gorebilir(c, id)) || !!u.bot, ...(u.bot ? { bot: true } : {}), ...(roller.rolu(id) ? { rol: roller.rolu(id) } : {}) }; }
            return reply(out);
          }
          case "presence": {
            const d = m.data && typeof m.data === "object" ? m.data : {};
            const oncekiMasa = c.presence.g;
            c.presence = { ...c.presence, ...d };
            if (d.g && d.g !== oncekiMasa) rozetler.masayaGirdi(d.g); // DM ile oyuncu buluştuysa oturum sayılır
            // Fare imleci saniyede ~8 kez gelir. Eskiden her seferinde herkesin listesi sunucudaki herkese
            // gönderiliyordu (kişi sayısının karesiyle büyür). Artık yalnızca bu kişinin değişikliği ve
            // yalnızca aynı oyundakilere gider; görünüm/oyun değişikliği gibi seyrek olanlar herkese.
            const keys = Object.keys(d);
            if (keys.length && keys.every(k => k === "cur")) {
              const g = c.presence.g, msg = JSON.stringify({ ev: "pres", peer: c.peer, by: c.uid, presence: c.presence });
              for (const o of conns) if (o.uid && (o === c || (g && o.presence.g === g))) o.sendRaw(msg);
            } else broadcastPeers([], []);
            return reply(true);
          }
          case "emit": {
            // Oda mesajları (sürüklenen jeton, işaret, ses efekti) yalnızca aynı oyundakilere gider.
            const g = c.presence.g, msg = JSON.stringify({ ev: "msg", topic: String(m.topic), data: m.data, peer: c.peer, by: c.uid });
            for (const o of conns) if (o !== c && o.uid && (!g || o.presence.g === g)) o.sendRaw(msg);
            return reply(true);
          }
          case "profile": { // ad / renk değişikliği (hesabı olanın adı kullanıcı adıdır)
            const u = store.get("_sys/users/" + c.uid) || {};
            store.set("_sys/users/" + c.uid, { ...u, name: u.username || String(m.name || u.name).slice(0, 40), color: String(m.color || u.color).slice(0, 20) });
            return reply(true);
          }
          case "chatSend": case "chatClear": return chatOp(c, m, reply, fail);
          case "bgNew": case "bgSit": case "bgMove": case "bgReset": case "bgDelete": return boardOp(c, m, reply, fail);
          case "bgAd": return odaAdiDegistir(c, m, reply, fail);
          case "forumTopic": case "forumReply": case "forumDelete": case "forumPin": return forumOp(c, m, reply, fail);
          case "ai": return runAi(c, m, reply, fail);
          case "aiAbort": { const ctl = c.ai.get(m.target); if (ctl) ctl.abort(); return reply(true); }
          default:
            if (kartMasa.OPS.has(m.op)) return reply(kartMasa.op(c, m)); // kart ve taş masaları, oyun atölyesi (server/kartmasa.js)
            if (hesap.OPS.has(m.op)) return reply(hesap.op(c, m)); // hesap, arkadaşlar, mesajlar, gruplar (server/hesap.js)
            if (botlar.OPS.has(m.op)) return reply(botlar.op(c, m)); // botlar (server/botlar.js)
            if (roller.OPS.has(m.op)) return reply(roller.op(c, m)); // yönetim: roller ve hesap açma (server/roller.js)
            if (dosyalar.OPS.has(m.op)) return reply(dosyalar.op(c, m)); // yüklediklerim, kota, profildeki oyunlar (server/dosyalar.js)
            if (bildirim.OPS.has(m.op)) return reply(bildirim.op(c, m)); // bildirimler (server/bildirim.js)
            if (yedek.OPS.has(m.op)) return reply(yedek.op(c, m)); // oyun yedekleri (server/yedek.js)
            if (profil.OPS.has(m.op)) return reply(profil.op(c, m)); // profil sayfası (server/profil.js)
            if (rozetler.OPS.has(m.op)) return reply(rozetler.op(c, m)); // profil rozetleri (server/rozetler.js)
            if (arama.OPS.has(m.op)) return reply(arama.op(c, m)); // genel arama, Ctrl+K (server/arama.js)
            if (gizlilik.OPS.has(m.op)) return reply(gizlilik.op(c, m)); // gizlilik, engel, şikâyet, KVKK (server/gizlilik.js)
            return fail("unknown_op", "Bilinmeyen işlem: " + m.op);
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
    let uid = m.userId, secret = m.secret;
    const valid = hesap.gecerli(uid, secret), known = valid ? store.get("_sys/users/" + uid) : null;
    const hesapli = !!(known && known.username);
    // Hesabıyla giren kişi sunucu şifresini kayıt olurken zaten vermiştir.
    if (password && !isOwner && !hesapli && !(m.password && same(String(m.password), password))) return fail("bad_password", "Masa şifresi yanlış");
    if (hesapModu === "zorunlu" && !hesapli) return fail("login_required", "Kullanıcı adın ve şifrenle giriş yap");
    // E-posta zorunluysa, adresini henüz doğrulamamış eski hesaplar önce e-posta ekler (sahip bağlantısı hariç).
    if (hesapli && !isOwner && hesap.epostaGerekli(uid)) return fail("eposta_gerekli", "Devam etmek için hesabına bir e-posta adresi ekle");
    if (!valid) { uid = "u-" + rid(8); secret = rid(16); }
    const prev = store.get("_sys/users/" + uid) || { created: Date.now() };
    const nm = prev.username || String(m.name || "").trim().slice(0, 40) || "Oyuncu", color = String(m.color || prev.color || "#2f8f86").slice(0, 20);
    store.set("_sys/users/" + uid, { ...prev, name: nm, color, secretHash: valid ? prev.secretHash : sha(secret), owner: prev.owner || isOwner, seen: Date.now() });
    c.uid = uid; c.secret = secret; c.isOwner = isOwner || !!prev.owner;
    const token = rid(16); tokens.set(token, uid); c.token = token;
    c.ws.once("close", () => tokens.delete(token));
    reply({ me: { id: uid, name: nm, color, kullanici: prev.username || null, foto: prev.foto || null, rol: roller.rolOf(c) }, secret, token, isOwner: c.isOwner, ai: !!anthropic, peer: c.peer, peers: peerList(), hesap: hesapModu });
    broadcastPeers([{ peer: c.peer, by: uid }], []);
  }

  function chatOp(c, m, reply, fail) {
    const gid = String(m.game || "");
    const g = GAME_ID.test(gid) && store.get("games/" + gid);
    if (!g) return fail("not_found", "Böyle bir oyun yok");
    const isMember = id => !!((g.dms && g.dms[id]) || (g.players && g.players[id]));
    if (!isMember(c.uid)) return fail("permission_denied", "Bu oyunun üyesi değilsin");
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
    const msg = sohbeteYaz(gid, c.uid, text, gif, to);
    if (!to) botlar.sohbetGeldi(gid, msg); // anılan bot yanıt versin
    return reply({ id: msg.id, t: msg.t });
  }
  // Sohbete ileti yaz (fısıltıysa iki tarafın kutusuna). Botlar da bunu kullanır.
  function sohbeteYaz(gid, by, text, gif, to) {
    const now = Date.now(), id = "m" + now.toString(36) + rid(3);
    // Belgeleri kopyalamadan önce say: sınırın altındaysa (çoğu zaman) hiçbir şey yapma.
    const trim = col => { if (store.count(col) <= CHAT_KEEP) return; const all = store.list(col); all.sort((a, b) => (a.data?.t || 0) - (b.data?.t || 0)); for (const d of all.slice(0, all.length - CHAT_KEEP)) store.delete(col + "/" + d.id); };
    const msg = { id, t: now, by, text, ...(gif ? { gif } : {}), ...(to ? { to } : {}) };
    if (to) for (const u of [by, to]) { const col = `data/users/${u}/chat/${gid}`; store.set(col + "/" + id, msg); trim(col); }
    else { store.set(`chat/${gid}/${id}`, msg); trim("chat/" + gid); }
    return msg;
  }

  // Masa oyunları: tahta durumu boards/<id> belgesinde. İstemciler okur ve abone olur,
  // ama yazmayı yalnızca buradan yapar; her hamle kurallar.js ile denetlenir.
  function boardOp(c, m, reply, fail) {
    const me = { id: c.uid, name: (store.get("_sys/users/" + c.uid) || {}).name || "Oyuncu" };
    if (m.op === "bgNew") {
      const g = OYUNLAR[m.oyun]; if (!g) return fail("invalid_argument", "Bilinmeyen oyun");
      const id = "b" + Date.now().toString(36) + rid(3);
      const ad = odaAdi(m.ad);
      store.set("boards/" + id, { oyun: m.oyun, ...(ad ? { ad } : {}), durum: g.yeni(Math.random), koltuk: [null, null], olusturan: me.id, created: Date.now(), updated: Date.now() });
      return reply({ id });
    }
    const p = "boards/" + String(m.board || ""), b = canAccess(c.uid, p) && store.get(p);
    if (!b) return fail("not_found", "Böyle bir tahta yok");
    const g = OYUNLAR[b.oyun];
    if (!g) return fail("invalid_argument", "Bu bir kart masası");
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

  // Oda adı: tahtayı/masayı açan, oturan biri ya da sunucu sahibi değiştirebilir (kart masaları da boards/* altında).
  function odaAdiDegistir(c, m, reply, fail) {
    const bid = String(m.board || ""), p = "boards/" + bid, b = /^b[a-z0-9]{6,24}$/.test(bid) && store.get(p);
    if (!b) return fail("not_found", "Böyle bir masa yok");
    const koltuk = (b.oyun === "kart" ? (b.durum || {}).koltuk : b.koltuk) || [];
    if (b.olusturan !== c.uid && !c.isOwner && !koltuk.some(k => k && k.id === c.uid)) return fail("permission_denied", "Adı yalnızca masayı açan ya da oturanlar değiştirebilir");
    const ad = odaAdi(m.ad), yeni = { ...b };
    if (ad) yeni.ad = ad; else delete yeni.ad;
    store.set(p, yeni);
    return reply({ ad: ad || null });
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
    async close() { hesap.kapat(); botlar.kapat(); bildirim.kapat(); for (const c of conns) c.ws.terminate(); wss.close(); await new Promise(r => server.close(r)); store.flush(); },
  };
}

module.exports = { createServer, canAccess, canWrite, FORUM_KATEGORI };
