// Masaüstü kabuğu: açılışta "bağlan / host et" ekranı; host seçilirse sunucuyu bu süreçte başlatır.
const { app, BrowserWindow, ipcMain, shell, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { createServer } = require("../server");

let win = null, host = null;
const cfgFile = () => path.join(app.getPath("userData"), "ayarlar.json");
const readCfg = () => { try { return JSON.parse(fs.readFileSync(cfgFile(), "utf8")); } catch { return {}; } };
const writeCfg = c => { fs.mkdirSync(path.dirname(cfgFile()), { recursive: true }); fs.writeFileSync(cfgFile(), JSON.stringify(c, null, 2)); };
const lanIps = () => Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === "IPv4" && !i.internal).map(i => i.address);

function normalize(addr) {
  let a = String(addr || "").trim();
  if (!a) throw new Error("Sunucu adresi boş");
  if (!/^https?:\/\//i.test(a)) a = "http://" + a;
  const u = new URL(a);
  // Port yazılmadıysa: http için varsayılan sunucu portu, https için (ters vekil arkasında) 443.
  if (!u.port && u.protocol === "http:") u.port = "7373";
  return u.origin;
}

const winPrefs = { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true };

function launcher() { win.loadFile(path.join(__dirname, "launcher.html")); }

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
  launcher();
}

ipcMain.handle("cfg:get", () => ({ ...readCfg(), ips: lanIps(), hosting: host ? { port: host.port } : null }));

ipcMain.handle("join", async (_e, addr) => {
  const origin = normalize(addr);
  const r = await fetch(origin + "/api/info").catch(() => null);
  if (!r || !r.ok) throw new Error("Bu adreste Zar Masası sunucusu bulunamadı");
  const c = readCfg(); c.recent = [origin, ...(c.recent || []).filter(x => x !== origin)].slice(0, 6); writeCfg(c);
  win.loadURL(origin + "/");
});

ipcMain.handle("host", async (_e, o) => {
  if (host) await host.srv.close();
  const port = Math.max(1024, Math.min(65535, +o.port || 7373));
  const srv = createServer({ dataDir: path.join(app.getPath("userData"), "masa-verisi"), password: o.password || "", name: o.name || "Zar Masası", anthropicApiKey: o.apiKey || undefined });
  try { await srv.listen(port); } catch (e) { throw new Error(e.code === "EADDRINUSE" ? `${port} portu kullanımda, başka bir port dene` : String(e.message || e)); }
  host = { srv, port };
  const c = readCfg(); c.host = { name: o.name, port, password: o.password || "", apiKey: o.apiKey || "" }; writeCfg(c);
  win.loadURL(`http://localhost:${port}/?owner=${srv.ownerKey}`);
});

ipcMain.handle("openHost", () => { if (host) win.loadURL(`http://localhost:${host.port}/?owner=${host.srv.ownerKey}`); });
ipcMain.handle("stopHost", async () => { if (host) { await host.srv.close(); host = null; } });
ipcMain.handle("back", () => launcher());

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: "Masa", submenu: [
      { label: "Başlangıç ekranı", accelerator: "CmdOrCtrl+L", click: () => launcher() },
      { role: "reload", label: "Yenile" },
      { role: "togglefullscreen", label: "Tam ekran" },
      { type: "separator" },
      { role: "quit", label: "Çıkış" },
    ] },
    { label: "Düzen", submenu: [{ role: "undo", label: "Geri al" }, { role: "redo", label: "Yinele" }, { type: "separator" }, { role: "cut", label: "Kes" }, { role: "copy", label: "Kopyala" }, { role: "paste", label: "Yapıştır" }, { role: "selectAll", label: "Tümünü seç" }] },
    { label: "Görünüm", submenu: [{ role: "zoomIn", label: "Yakınlaştır" }, { role: "zoomOut", label: "Uzaklaştır" }, { role: "resetZoom", label: "Gerçek boyut" }, { role: "toggleDevTools", label: "Geliştirici araçları" }] },
  ]));
  createWindow();
});
app.on("window-all-closed", async () => { if (host) await host.srv.close().catch(() => {}); app.quit(); });
