#!/usr/bin/env node
// Bağımsız sunucu: node server/cli.js [--port 7373] [--data ./veri] [--name "Masa adı"]
// Ortam değişkenleri: ZM_PORT, ZM_DATA, ZM_NAME, ZM_HESAP, ZM_VEKIL, ZM_PASSWORD, ZM_ADMIN, ZM_KOTA, ZM_MAX_DOSYA, ANTHROPIC_API_KEY, ZM_AI_MODEL
// Yükleme sınırı: ZM_KOTA kişi başına toplam (MB, varsayılan 200), ZM_MAX_DOSYA dosya başına (MB, varsayılan 25).
// Admin: ZM_ADMIN=kullanici1,kullanici2 bu hesapları admin yapar (yönetim paneli, test hesapları, bot kontrolü).
// Hesap: bağımsız sunucuda herkes kullanıcı adı + şifreyle girer (--hesap istege-bagli ile hesapsız giriş de açılır).
// Ortak masa şifresi (--password / ZM_PASSWORD) yalnızca hesapsız modda kullanılır.
// Ters vekil (Caddy, nginx) arkasında çalışıyorsa ZM_VEKIL=1 ile gerçek ziyaretçi adresi X-Forwarded-For'dan okunur.
const os = require("os");
const { createServer } = require("./index");

const args = process.argv.slice(2);
const arg = (k, env, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : process.env[env] ?? d; };

(async () => {
  const hesap = arg("hesap", "ZM_HESAP", "zorunlu"), password = arg("password", "ZM_PASSWORD", "");
  const vekil = /^(1|true|evet|yes)$/i.test(String(arg("vekil", "ZM_VEKIL", "")));
  const srv = createServer({ dataDir: arg("data", "ZM_DATA", "./zar-masasi-veri"), password, name: arg("name", "ZM_NAME", "Zar Masası"), hesap, vekil, admin: arg("admin", "ZM_ADMIN", ""), kota: arg("kota", "ZM_KOTA", ""), maxDosya: arg("max-dosya", "ZM_MAX_DOSYA", "") });
  if (password && hesap === "zorunlu") console.log("Not: Hesaplı sunucuda ortak masa şifresi kullanılmaz (ZM_PASSWORD yok sayıldı). Herkes kendi kullanıcı adı ve şifresiyle girer.");
  const port = await srv.listen(+arg("port", "ZM_PORT", 7373));
  const ips = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === "IPv4" && !i.internal).map(i => i.address);
  console.log(`Zar Masası sunucusu çalışıyor: port ${port}`);
  for (const ip of ["localhost", ...ips]) console.log(`  http://${ip}:${port}/`);
  console.log(`Sahip bağlantısı (kimseyle paylaşma): http://localhost:${port}/?owner=${srv.ownerKey}`);
  const stop = async () => { await srv.close(); process.exit(0); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
})().catch(e => { console.error(e); process.exit(1); });
