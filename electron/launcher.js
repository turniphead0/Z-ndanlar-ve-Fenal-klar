const Z = window.zmDesktop;
const $ = s => document.querySelector(s);
const showErr = (el, e) => { el.textContent = String(e && e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ""); el.hidden = false; };

async function load() {
  const c = await Z.config();
  if (c.host) { $("#hName").value = c.host.name || ""; $("#hPort").value = c.host.port || 7373; $("#hPass").value = c.host.password || ""; $("#hKey").value = c.host.apiKey || ""; }
  $("#recent").innerHTML = "";
  for (const r of c.recent || []) { const b = document.createElement("button"); b.type = "button"; b.textContent = r.replace(/^https?:\/\//, ""); b.onclick = () => { $("#addr").value = r; $("#joinForm").requestSubmit(); }; $("#recent").appendChild(b); }
  $("#running").hidden = !c.hosting;
  if (c.hosting) {
    const p = c.hosting.port;
    $("#addrs").innerHTML = "";
    for (const ip of c.ips) { const d = document.createElement("div"); d.textContent = `${ip}:${p}`; $("#addrs").appendChild(d); }
    if (!c.ips.length) $("#addrs").textContent = `localhost:${p} (ağ bağlantısı bulunamadı)`;
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
