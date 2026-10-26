#!/usr/bin/env node
// Bağımsız sunucu: node server/cli.js [--port 7373] [--data ./veri] [--password şifre] [--name "Masa adı"]
// Ortam değişkenleri: ZM_PORT, ZM_DATA, ZM_PASSWORD, ZM_NAME, ANTHROPIC_API_KEY, ZM_AI_MODEL
const os = require("os");
const { createServer } = require("./index");

const args = process.argv.slice(2);
const arg = (k, env, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : process.env[env] ?? d; };

(async () => {
  const srv = createServer({ dataDir: arg("data", "ZM_DATA", "./zar-masasi-veri"), password: arg("password", "ZM_PASSWORD", ""), name: arg("name", "ZM_NAME", "Zar Masası") });
  const port = await srv.listen(+arg("port", "ZM_PORT", 7373));
  const ips = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === "IPv4" && !i.internal).map(i => i.address);
  console.log(`Zar Masası sunucusu çalışıyor: port ${port}`);
  for (const ip of ["localhost", ...ips]) console.log(`  http://${ip}:${port}/`);
  console.log(`Sahip bağlantısı (kimseyle paylaşma): http://localhost:${port}/?owner=${srv.ownerKey}`);
  const stop = async () => { await srv.close(); process.exit(0); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
})().catch(e => { console.error(e); process.exit(1); });
