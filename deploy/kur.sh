#!/usr/bin/env bash
# Zar Masası'nı HTTPS ile kurar ya da günceller (Ubuntu + Docker). Önünde Caddy durur ve Let's Encrypt
# sertifikasını kendisi alıp yeniler. Veriler (zar-masasi-veri birimi) ve ~/zm.env ayarları korunur.
#
# Kullanım (depo klasöründe, sudo OLMADAN):
#   bash deploy/kur.sh                    alan adı yoksa sunucunun IP'sinden ücretsiz bir sslip.io adresi kullanılır
#   bash deploy/kur.sh masa.ornek.com     kendi alan adın (DNS kaydı bu sunucunun IP'sini göstermeli)
# Seçilen alan adı ~/zm-alan-adi dosyasına yazılır; sonraki güncellemelerde yine o kullanılır.
set -euo pipefail
cd "$(dirname "$0")/.."
KOK="$PWD"
AYAR="$HOME/zm-alan-adi"

ALAN="${1:-${ZM_ALAN_ADI:-}}"
if [ -z "$ALAN" ] && [ -s "$AYAR" ]; then ALAN="$(cat "$AYAR")"; fi
if [ -z "$ALAN" ]; then
  IP="$(curl -fsS --max-time 10 https://checkip.amazonaws.com | tr -d '[:space:]')"
  if ! [[ "$IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then echo "Sunucunun dış IP adresi bulunamadı."; exit 1; fi
  ALAN="${IP//./-}.sslip.io"
fi
ALAN="${ALAN#http://}"; ALAN="${ALAN#https://}"; ALAN="${ALAN%%/*}"; ALAN="${ALAN,,}"
if ! [[ "$ALAN" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ && "$ALAN" == *.* ]]; then echo "Alan adı anlaşılamadı: $ALAN"; exit 1; fi
echo "$ALAN" > "$AYAR"
touch "$HOME/zm.env"

# Küçük sunucularda (Lightsail 512 MB - 1 GB) bellek dolunca her şey çok yavaşlar ya da süreç ölür.
# Takas alanı (swap) yoksa bir kez 1 GB'lık bir takas dosyası açılır; derleme ve yoğun anlar rahatlar.
if [ "$(awk '/MemTotal/ {print $2}' /proc/meminfo)" -lt 2000000 ] && [ "$(awk '/SwapTotal/ {print $2}' /proc/meminfo)" -eq 0 ] && [ ! -e /swapfile ]; then
  echo "Bellek az ve takas alanı yok: 1 GB takas dosyası açılıyor (bir kerelik)…"
  sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile >/dev/null && sudo swapon /swapfile \
    && (grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null) \
    || echo "Takas dosyası açılamadı, devam ediliyor."
fi

echo "1/4 Zar Masası derleniyor…"
sudo docker build -q -t zar-masasi "$KOK" >/dev/null
echo "2/4 Ağ hazırlanıyor…"
sudo docker network inspect zm-ag >/dev/null 2>&1 || sudo docker network create zm-ag >/dev/null
echo "3/4 Sunucu ve Caddy yeniden başlatılıyor (veriler korunur)…"
sudo docker rm -f zar-masasi caddy >/dev/null 2>&1 || true
# Node sunucusu artık dışarıya port açmaz; yalnızca Caddy ona ulaşır. ZM_VEKIL=1: gerçek ziyaretçi adresi
# Caddy'nin eklediği X-Forwarded-For başlığından okunur (deneme sınırları için).
sudo docker run -d --name zar-masasi --restart unless-stopped --network zm-ag --log-opt max-size=10m --log-opt max-file=3 \
  -v zar-masasi-veri:/data --env-file "$HOME/zm.env" -e ZM_VEKIL=1 zar-masasi >/dev/null
sudo docker run -d --name caddy --restart unless-stopped --network zm-ag --log-opt max-size=10m --log-opt max-file=3 \
  -p 80:80 -p 443:443 -e ZM_ALAN_ADI="$ALAN" \
  -v "$KOK/deploy/Caddyfile:/etc/caddy/Caddyfile:ro" -v caddy-veri:/data -v caddy-ayar:/config \
  caddy:2 >/dev/null
sudo docker image prune -f >/dev/null 2>&1 || true # eski derlemeler diski doldurmasın

# Otomatik yedek: her gece sunucu saatiyle 01:17'de (Türkiye saatiyle 04:17) deploy/yedek.sh çalışır. Yedekler
# şifreli olarak ~/zm-yedekler/ klasörüne yazılır ve ~/zm-yedek.env'de ayarlandıysa sunucunun dışına kopyalanır.
YENI_AYAR=0; [ -s "$HOME/zm-yedek.env" ] || YENI_AYAR=1
mkdir -p "$HOME/zm-yedekler"
printf '# Zar Masası otomatik yedek (deploy/kur.sh yazdı; değiştirmek için kur.sh yeniden çalıştırılır)\nSHELL=/bin/bash\nPATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\n17 1 * * * %s bash %s/deploy/yedek.sh >> %s/zm-yedekler/yedek.log 2>&1\n' \
  "$(id -un)" "$KOK" "$HOME" | sudo tee /etc/cron.d/zar-masasi-yedek >/dev/null
sudo chmod 644 /etc/cron.d/zar-masasi-yedek
if ! ls "$HOME"/zm-yedekler/zar-masasi-*.tar.gz.enc >/dev/null 2>&1; then
  echo "    İlk yedek alınıyor…"
  bash "$KOK/deploy/yedek.sh" >> "$HOME/zm-yedekler/yedek.log" 2>&1 && echo "    İlk yedek hazır: ~/zm-yedekler/" || echo "    İlk yedek alınamadı; ayrıntı: tail ~/zm-yedekler/yedek.log"
fi
if [ "$YENI_AYAR" = 1 ]; then
  echo
  echo "ÖNEMLİ: Yedekler şifreli. Şifreyi bilgisayarına kaydet (sunucu kaybolursa yedeği yalnızca bununla açabilirsin):"
  grep '^ZM_YEDEK_SIFRE=' "$HOME/zm-yedek.env"
  echo "Yedekleri ücretsiz olarak sunucunun dışına da kopyalamak için: ~/zm-yedek.env (otomatik-yedek/kurulum.md)"
  echo
fi

echo "4/4 Sertifika alınıyor ve deneniyor (en fazla 2 dakika)…"
for _ in $(seq 1 24); do
  if curl -fsS --max-time 5 "https://$ALAN/api/info" >/dev/null 2>&1; then
    echo
    echo "Hazır: https://$ALAN/"
    echo "Oyuncular bu adresi kullanır. Eski http://IP adresi de otomatik olarak buraya yönlenir."
    exit 0
  fi
  sleep 5
done
echo
echo "HTTPS henüz çalışmıyor. En sık sebep: Lightsail güvenlik duvarında 443 (HTTPS) portu kapalı."
echo "Portu açtıktan sonra bu komutu yeniden çalıştır. Ayrıntı için: sudo docker logs caddy --tail 30"
exit 1
