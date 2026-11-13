// Masaüstü kabuğu: açılışta doğrudan Zar Masası sunucusuna (ya da en son bağlanılan sunucuya) bağlanır.
// Kullanıcı isterse başlangıç ekranından (Masa > Başlangıç ekranı) başka sunucuya bağlanır ya da
// masayı kendi bilgisayarında host eder; host seçilirse sunucu bu süreçte başlar.
const { app, BrowserWindow, ipcMain, shell, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { createServer } = require("../server");

let win = null, host = null;
// Varsayılan sunucu: package.json > zarMasasi.sunucu (ZM_SUNUCU ortam değişkeniyle değiştirilebilir).
const VARSAYILAN = process.env.ZM_SUNUCU || (require("../package.json").zarMasasi || {}).sunucu || "";
const cfgFile = () => path.join(app.getPath("userData"), "ayarlar.json");
const readCfg = () => { try { return JSON.parse(fs.readFileSync(cfgFile(), "utf8")); } catch { return {}; } };
const writeCfg = c => { fs.mkdirSync(path.dirname(cfgFile()), { recursive: true }); fs.writeFileSync(cfgFile(), JSON.stringify(c, null, 2)); };
const lang = () => readCfg().lang === "en" ? "en" : "tr";
const L = (tr, en) => lang() === "en" ? en : tr;
// Masanın adresine dil seçimini ekler; uygulama bu dili bu sunucu için de hatırlar.
const withLang = url => { const u = new URL(url); u.searchParams.set("lang", lang()); return u.toString(); };
const lanIps = () => Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === "IPv4" && !i.internal).map(i => i.address);

// Denenecek adresler. Port yazılmadıysa http için önce 80 (ör. Docker -p 80:7373), sonra 7373 denenir.
function adaylar(addr) {
  let a = String(addr || "").trim();
  if (!a) throw new Error(L("Sunucu adresi boş", "The server address is empty"));
  if (!/^https?:\/\//i.test(a)) a = "http://" + a;
  const u = new URL(a);
  if (u.port || u.protocol !== "http:") return [u.origin];
  const u2 = new URL(u.origin); u2.port = "7373";
  return [u.origin, u2.origin];
}
async function bul(addr) {
  for (const o of adaylar(addr)) {
    const r = await fetch(o + "/api/info", { signal: AbortSignal.timeout(6000) }).catch(() => null);
    if (r && r.ok) { const j = await r.json().catch(() => null); if (j && j.version) return o; }
  }
  throw new Error(L("Bu adreste Zar Masası sunucusu bulunamadı", "No Zar Masası server was found at this address"));
}

const winPrefs = { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true };

function launcher(hata) { win.loadFile(path.join(__dirname, "launcher.html"), hata ? { query: { hata } } : undefined); }
async function baglan(addr) {
  const origin = await bul(addr);
  const c = readCfg(); c.recent = [origin, ...(c.recent || []).filter(x => x !== origin)].slice(0, 6); c.son = "sunucu"; writeCfg(c);
  win.loadURL(withLang(origin + "/"));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600, title: "Zar Masası", autoHideMenuBar: true,
    webPreferences: winPrefs,
  });
  // Dış bağlantılar (YouTube vb.) varsayılan tarayıcıda açılsın.
  // Aynı masanın ayrı pencereleri (?pop=…) uygulama içinde açılır; dış bağlantılar (YouTube vb.) varsayılan tarayıcıda.
  win.webContents.setWindowOpenHandler(({ url }) => {
    let same = false; try { same = new URL(url).origin === new URL(win.webContents.getURL()).origin; } catch {}
    if (same) return { action: "allow", overrideBrowserWindowOptions: { width: 1180, height: 820, minWidth: 600, minHeight: 400, autoHideMenuBar: true, webPreferences: winPrefs } };
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  // Açılış: en son host edilmediyse doğrudan sunucuya bağlan; olmazsa başlangıç ekranı ve hata.
  const c = readCfg(), hedef = (c.recent || [])[0] || VARSAYILAN;
  if (c.son !== "host" && hedef) {
    win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(`<body style="margin:0;height:100vh;display:grid;place-items:center;font:16px system-ui;background:#111518;color:#E3E8E4">${L("Sunucuya bağlanılıyor…", "Connecting to the server…")}</body>`));
    baglan(hedef).catch(e => launcher(String(e.message || e)));
  } else launcher();
}

ipcMain.handle("cfg:get", () => ({ ...readCfg(), ips: lanIps(), hosting: host ? { port: host.port } : null, varsayilan: VARSAYILAN }));

ipcMain.handle("join", (_e, addr) => baglan(addr));

ipcMain.handle("host", async (_e, o) => {
  if (host) await host.srv.close();
  const port = Math.max(1024, Math.min(65535, +o.port || 7373));
  const srv = createServer({ dataDir: path.join(app.getPath("userData"), "masa-verisi"), password: o.password || "", name: o.name || "Zar Masası", anthropicApiKey: o.apiKey || undefined });
  try { await srv.listen(port); } catch (e) { throw new Error(e.code === "EADDRINUSE" ? L(`${port} portu kullanımda, başka bir port dene`, `Port ${port} is in use, try another port`) : String(e.message || e)); }
  host = { srv, port };
  const c = readCfg(); c.host = { name: o.name, port, password: o.password || "", apiKey: o.apiKey || "" }; c.son = "host"; writeCfg(c);
  win.loadURL(withLang(`http://localhost:${port}/?owner=${srv.ownerKey}`));
});

ipcMain.handle("openHost", () => { if (host) win.loadURL(withLang(`http://localhost:${host.port}/?owner=${host.srv.ownerKey}`)); });
ipcMain.handle("stopHost", async () => { if (host) { await host.srv.close(); host = null; } });
ipcMain.handle("back", () => launcher());
ipcMain.handle("setLang", (_e, l) => { const c = readCfg(); c.lang = l === "en" ? "en" : "tr"; writeCfg(c); menu(); });

function menu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: L("Masa", "Table"), submenu: [
      { label: L("Başlangıç ekranı", "Start screen"), accelerator: "CmdOrCtrl+L", click: () => launcher() },
      { role: "reload", label: L("Yenile", "Reload") },
      { role: "togglefullscreen", label: L("Tam ekran", "Full screen") },
      { type: "separator" },
      { role: "quit", label: L("Çıkış", "Quit") },
    ] },
    { label: L("Düzen", "Edit"), submenu: [{ role: "undo", label: L("Geri al", "Undo") }, { role: "redo", label: L("Yinele", "Redo") }, { type: "separator" }, { role: "cut", label: L("Kes", "Cut") }, { role: "copy", label: L("Kopyala", "Copy") }, { role: "paste", label: L("Yapıştır", "Paste") }, { role: "selectAll", label: L("Tümünü seç", "Select all") }] },
    { label: L("Görünüm", "View"), submenu: [{ role: "zoomIn", label: L("Yakınlaştır", "Zoom in") }, { role: "zoomOut", label: L("Uzaklaştır", "Zoom out") }, { role: "resetZoom", label: L("Gerçek boyut", "Actual size") }, { role: "toggleDevTools", label: L("Geliştirici araçları", "Developer tools") }] },
  ]));
}

app.whenReady().then(() => {
  menu();
  createWindow();
});
app.on("window-all-closed", async () => { if (host) await host.srv.close().catch(() => {}); app.quit(); });
