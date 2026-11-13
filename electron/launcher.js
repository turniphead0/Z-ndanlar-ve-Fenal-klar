const Z = window.zmDesktop;
const $ = s => document.querySelector(s);
const showErr = (el, e) => { el.textContent = String(e && e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ""); el.hidden = false; };

// İngilizce metinler: başlangıç ekranı Türkçe yazılıdır, İngilizce seçiliyse bu sözlükle çevrilir.
const EN = {
  "Ücretsiz, açık kaynak sanal oyun masası": "A free, open source virtual tabletop",
  "Masan açık": "Your table is open",
  "Arkadaşların uygulamada \"Sunucuya bağlan\" kısmına bu adreslerden birini yazsın. Aynı ağdaysanız (aynı modem) yerel adres yeterli. İnternetten bağlanacaklar için modeminde bu portu bilgisayarına yönlendirmen ve dış IP adresini paylaşman gerekir.": "Your friends type one of these addresses under \"Connect to a server\" in the app. On the same network (same router) the local address is enough. For people joining over the internet, forward this port to your computer on your router and share your public IP address.",
  "Masaya dön": "Back to the table", "Masayı kapat": "Close the table",
  "Sunucuya bağlan": "Connect to a server", "Zar Masası sunucusuna bağlan, hesabınla giriş yap. Uygulama her açılışta en son bağlandığın sunucuya kendiliğinden bağlanır.": "Connect to a Zar Masası server and sign in with your account. The app reconnects to the last server you used every time it opens.",
  "Zar Masası sunucusu": "Zar Masası server", "Bu bilgisayarda host et (isteğe bağlı)": "Host on this computer (optional)",
  "Sunucu adresi": "Server address", "örn. 192.168.1.20 veya masa.ornek.com:7373": "e.g. 192.168.1.20 or table.example.com:7373", "Bağlan": "Connect",
  "Bu bilgisayarda host et": "Host on this computer",
  "Masa senin bilgisayarında çalışır, veriler burada saklanır. Uygulama açık kaldığı sürece diğerleri bağlanabilir.": "The table runs on your computer and the data is stored here. Others can connect as long as the app stays open.",
  "Masa adı": "Table name", "Cuma akşamı grubu": "Friday night group", "Port": "Port", "Masa şifresi (isteğe bağlı)": "Table password (optional)",
  "Boş bırakırsan adresi bilen herkes girer": "If left empty, anyone who knows the address can join",
  "Yapay zekâ (Senaryo ve Destek bölümleri)": "AI (Scenario and Support sections)",
  "Bu bölümler Claude ile çalışır. Kullanmak istersen kendi Anthropic API anahtarını gir; ücreti anahtarın sahibine yansır. Boş bırakırsan bu bölümler kapalı kalır.": "These sections work with Claude. To use them, enter your own Anthropic API key; the key's owner pays for usage. If left empty, these sections stay off.",
  "Anthropic API anahtarı": "Anthropic API key", "Masayı başlat": "Start the table", "(ağ bağlantısı bulunamadı)": "(no network connection found)",
};
let en = false;
const T = s => en ? (EN[s] || s) : s;
function translate() {
  document.documentElement.lang = en ? "en" : "tr";
  $("#langBtn").textContent = en ? "Türkçe" : "English";
  if (!en) return;
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = tw.nextNode())) { const k = n.nodeValue.replace(/\s+/g, " ").trim(); if (EN[k]) n.nodeValue = EN[k]; }
  document.querySelectorAll("[placeholder]").forEach(x => { const v = EN[x.getAttribute("placeholder")]; if (v) x.setAttribute("placeholder", v); });
}
$("#langBtn").onclick = async () => { await Z.setLang(en ? "tr" : "en"); location.reload(); };

async function load() {
  const c = await Z.config();
  if (en !== (c.lang === "en")) { en = c.lang === "en"; translate(); } else $("#langBtn").textContent = en ? "Türkçe" : "English";
  if (c.host) { $("#hName").value = c.host.name || ""; $("#hPort").value = c.host.port || 7373; $("#hPass").value = c.host.password || ""; $("#hKey").value = c.host.apiKey || ""; }
  $("#recent").innerHTML = "";
  for (const r of c.recent || []) { const b = document.createElement("button"); b.type = "button"; b.textContent = r.replace(/^https?:\/\//, ""); b.onclick = () => { $("#addr").value = r; $("#joinForm").requestSubmit(); }; $("#recent").appendChild(b); }
  $("#addr").value = $("#addr").value || (c.recent || [])[0] || c.varsayilan || "";
  if (c.varsayilan) { $("#varsayilan").hidden = false; $("#varsayilan").onclick = () => { $("#addr").value = c.varsayilan; $("#joinForm").requestSubmit(); }; }
  if (c.son === "host" || c.hosting) $("#hostDet").open = true;
  const hata = new URLSearchParams(location.search).get("hata"); if (hata) showErr($("#joinErr"), hata);
  $("#running").hidden = !c.hosting;
  if (c.hosting) {
    const p = c.hosting.port;
    $("#addrs").innerHTML = "";
    for (const ip of c.ips) { const d = document.createElement("div"); d.textContent = `${ip}:${p}`; $("#addrs").appendChild(d); }
    if (!c.ips.length) $("#addrs").textContent = `localhost:${p} ${T("(ağ bağlantısı bulunamadı)")}`;
    $("#backToTable").onclick = () => Z.openHost();
  }
}

$("#joinForm").addEventListener("submit", async e => {
  e.preventDefault(); $("#joinErr").hidden = true;
  const b = e.submitter || $("#joinForm button.pri"); b.disabled = true;
  try { await Z.join($("#addr").value); } catch (x) { showErr($("#joinErr"), x); } finally { b.disabled = false; }
});
$("#hostForm").addEventListener("submit", async e => {
  e.preventDefault(); $("#hostErr").hidden = true;
  const b = $("#hostForm button.pri"); b.disabled = true;
  try { await Z.host({ name: $("#hName").value.trim(), port: +$("#hPort").value, password: $("#hPass").value, apiKey: $("#hKey").value.trim() }); }
  catch (x) { showErr($("#hostErr"), x); } finally { b.disabled = false; }
});
$("#stop").onclick = async () => { await Z.stopHost(); load(); };
load();
