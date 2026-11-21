// E-posta gönderimi (doğrulama ve şifre sıfırlama kodları). Ücretsiz bir SMTP hesabıyla çalışır:
// Brevo (günde 300), Gmail uygulama şifresi (günde ~500), ya da kendi alan adının e-posta hizmeti.
//
// Ortam değişkenleri:
//   ZM_SMTP_HOST   örn. smtp-relay.brevo.com ya da smtp.gmail.com
//   ZM_SMTP_PORT   587 (STARTTLS, varsayılan) ya da 465 (doğrudan TLS)
//   ZM_SMTP_USER   SMTP kullanıcı adı
//   ZM_SMTP_PASS   SMTP şifresi / anahtarı (gizli tut, depoya yazma)
//   ZM_SMTP_FROM   gönderen, örn. "Zar Masası <noreply@zarmasasi.space>" (boşsa ZM_SMTP_USER)
//   ZM_EPOSTA      "zorunlu" (SMTP ayarlıysa varsayılan) ya da "kapali" (e-posta istenmez)
// Not: AWS Lightsail 25 numaralı portu kapalı tutar; 587 ya da 465 kullan.

function smtpAyari(env = process.env) {
  if (!env.ZM_SMTP_HOST) return null;
  const port = +env.ZM_SMTP_PORT || 587;
  return {
    host: env.ZM_SMTP_HOST, port, secure: port === 465,
    auth: env.ZM_SMTP_USER ? { user: env.ZM_SMTP_USER, pass: env.ZM_SMTP_PASS || "" } : undefined,
    from: env.ZM_SMTP_FROM || env.ZM_SMTP_USER || "Zar Masası <noreply@localhost>",
  };
}

// Bir gönderici döndürür: gonder({ kime, konu, metin, html }) -> Promise. Ayar yoksa null.
function smtpGonderici(ayar, log = console) {
  if (!ayar) return null;
  const nodemailer = require("nodemailer");
  const t = nodemailer.createTransport({ host: ayar.host, port: ayar.port, secure: ayar.secure, auth: ayar.auth, requireTLS: !ayar.secure,
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000 });
  // Açılışta bir kez dene; yanlış ayar varsa günlükte hemen görünsün.
  t.verify().then(() => log.log(`E-posta: ${ayar.host}:${ayar.port} hazır.`), e => log.error(`E-posta ayarı çalışmıyor (${ayar.host}:${ayar.port}): ${e.message}`));
  return ({ kime, konu, metin, html }) => t.sendMail({ from: ayar.from, to: kime, subject: konu, text: metin, html });
}

const EPOSTA = /^[^\s@<>()"',;:]{1,64}@[^\s@<>()"',;:]+\.[^\s@<>()"',;:]{2,}$/;
const epostaDuz = e => String(e || "").trim().toLowerCase();
const epostaGecerli = e => e.length <= 254 && EPOSTA.test(e) && !e.includes("..");
// "ayse.yilmaz@gmail.com" -> "ay***@gmail.com" (ekranda kime gönderildiği belli olsun, tamamı görünmesin)
function maskele(e) {
  const [a, b] = String(e).split("@");
  return (a.length <= 2 ? a[0] + "*" : a.slice(0, 2) + "***") + "@" + b;
}

function kodPostasi(kod, amac, sunucuAdi) {
  const ne = amac === "sifre" ? "şifreni yenilemek" : "e-posta adresini doğrulamak";
  const konu = `${sunucuAdi} kodun: ${kod}`;
  const metin = `Merhaba,\n\n${sunucuAdi} için ${ne} üzere kodun:\n\n    ${kod}\n\nKod 15 dakika geçerli. Bu isteği sen yapmadıysan bu iletiyi silebilirsin; hesabında hiçbir şey değişmez.\n`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:auto;padding:20px;color:#222">
<h2 style="margin:0 0 12px">${sunucuAdi.replace(/[<>&"]/g, "")}</h2>
<p>${ne.charAt(0).toUpperCase() + ne.slice(1)} için kodun:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:6px;background:#f3f0e8;border-radius:8px;padding:12px;text-align:center">${kod}</p>
<p style="color:#666;font-size:13px">Kod 15 dakika geçerli. Bu isteği sen yapmadıysan bu iletiyi silebilirsin; hesabında hiçbir şey değişmez.</p></div>`;
  return { konu, metin, html };
}

module.exports = { smtpAyari, smtpGonderici, epostaDuz, epostaGecerli, maskele, kodPostasi };
