const { contextBridge, ipcRenderer } = require("electron");

// Her sayfada: masadan başlangıç ekranına dönüş ve dil seçimi.
const api = { backToLauncher: () => ipcRenderer.invoke("back"), setLang: l => ipcRenderer.invoke("setLang", l) };
// Yalnızca yerel başlangıç ekranında: ayarlar, bağlanma ve host etme.
if (location.protocol === "file:") Object.assign(api, {
  config: () => ipcRenderer.invoke("cfg:get"),
  join: addr => ipcRenderer.invoke("join", addr),
  host: o => ipcRenderer.invoke("host", o),
  openHost: () => ipcRenderer.invoke("openHost"),
  stopHost: () => ipcRenderer.invoke("stopHost"),
});
contextBridge.exposeInMainWorld("zmDesktop", api);
