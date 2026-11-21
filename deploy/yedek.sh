#!/usr/bin/env bash
# Zar Masası verilerinin otomatik yedeği (Ubuntu + Docker). deploy/kur.sh bunu her gece çalışacak şekilde kurar;
# elle de çalıştırılabilir:  bash deploy/yedek.sh
#
# Ne yapar:
#   1. zar-masasi-veri biriminin tamamını (veritabanı db.json + yüklenen dosyalar) tek bir arşive koyar,
#   2. arşivi ~/zm-yedek.env içindeki ZM_YEDEK_SIFRE ile şifreler (AES-256; şifre olmadan açılamaz),
#   3. ~/zm-yedekler/ klasörüne yazar ve en yeni ZM_YEDEK_GUN (varsayılan 14) yedeği tutar,
#   4. ayarlandıysa sunucunun dışına kopyalar (rclone ile; ücretsiz Backblaze B2 ya da Google Drive),
#      uzaktaki ZM_YEDEK_UZAK_GUN (varsayılan 30) günden eski yedekleri siler,
#   5. sonucu birimdeki yedek-durum.json dosyasına yazar: adminler Yönetim panelinde görür.
#
# Ayarlar (~/zm-yedek.env, ilk çalıştırmada oluşturulur):
#   ZM_YEDEK_SIFRE=...       yedeklerin şifresi (KAYBETME: bu olmadan yedek açılamaz)
#   B2_HESAP / B2_ANAHTAR / B2_KOVA    Backblaze B2 "keyID", "applicationKey" ve kova (bucket) adı
#   ZM_YEDEK_HEDEF=ad:klasor           ya da başka bir rclone hedefi (~/.config/rclone/rclone.conf içinde tanımlı)
# Geri yüklemek için: bash deploy/geri-yukle.sh
set -uo pipefail

AYAR="${ZM_YEDEK_AYAR:-$HOME/zm-yedek.env}"
KLASOR="${ZM_YEDEK_KLASOR:-$HOME/zm-yedekler}"
BIRIM="${ZM_BIRIM:-zar-masasi-veri}"
RCLONE_IMAJ="rclone/rclone:1.68"
DOCKER="${ZM_DOCKER:-sudo docker}"

mkdir -p "$KLASOR" && chmod 700 "$KLASOR"
if [ ! -s "$AYAR" ]; then
  umask 077
  cat > "$AYAR" <<EOF
# Zar Masası otomatik yedek ayarları (deploy/yedek.sh). Bu dosyayı kimseyle paylaşma.
# Yedeklerin şifresi: bunu bilgisayarına ya da şifre yöneticine de kaydet. Sunucu kaybolursa yedekleri
# yalnızca bu şifreyle açabilirsin.
ZM_YEDEK_SIFRE=$(openssl rand -base64 30 | tr -d '/+=\n' | cut -c1-32)
# Sunucuda kaç yedek tutulsun (her gece bir tane):
ZM_YEDEK_GUN=14
# Uzakta kaç günlük yedek tutulsun:
ZM_YEDEK_UZAK_GUN=30
# Ücretsiz Backblaze B2 (10 GB) hesabının bilgileri (kurulum: otomatik-yedek/kurulum.md):
B2_HESAP=
B2_ANAHTAR=
B2_KOVA=
# Ya da başka bir rclone hedefi, örneğin Google Drive: ZM_YEDEK_HEDEF=gdrive:ZarMasasiYedek
ZM_YEDEK_HEDEF=
EOF
  echo "Yedek ayar dosyası oluşturuldu: $AYAR"
fi
# shellcheck disable=SC1090
set -a; . "$AYAR"; set +a
GUN="${ZM_YEDEK_GUN:-14}"; UZAK_GUN="${ZM_YEDEK_UZAK_GUN:-30}"
if [ -z "${ZM_YEDEK_SIFRE:-}" ]; then echo "$(date -Is) HATA: $AYAR içinde ZM_YEDEK_SIFRE yok."; exit 1; fi

ZAMAN="$(date -u +%Y-%m-%d_%H%M%S)"
AD="zar-masasi-$ZAMAN.tar.gz.enc"
DOSYA="$KLASOR/$AD"
GECICI="$(mktemp)"; chmod 600 "$GECICI"; trap 'rm -f "$GECICI" "$DOSYA.yarim"' EXIT
echo "$(date -Is) Yedek alınıyor: $AD"

# 1-2) Arşivle ve şifrele. db.json atomik yazıldığı için (önce .tmp, sonra yeniden adlandırma) okunan dosya hep bütündür.
$DOCKER run --rm -v "$BIRIM":/data:ro alpine:3 tar -C /data -czf - . \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:ZM_YEDEK_SIFRE -out "$DOSYA.yarim"
SONUC=("${PIPESTATUS[@]}")
if [ "${SONUC[0]}" -ne 0 ] || [ "${SONUC[1]}" -ne 0 ] || [ ! -s "$DOSYA.yarim" ]; then
  rm -f "$DOSYA.yarim"; echo "$(date -Is) HATA: arşiv oluşturulamadı."; exit 1
fi
mv "$DOSYA.yarim" "$DOSYA"; chmod 600 "$DOSYA"
BOYUT="$(stat -c %s "$DOSYA")"

# 3) Eski yerel yedekleri sil (en yeni GUN tane kalır).
ls -1t "$KLASOR"/zar-masasi-*.tar.gz.enc 2>/dev/null | tail -n +"$((GUN + 1))" | xargs -r rm -f
YEREL_SAYI="$(ls -1 "$KLASOR"/zar-masasi-*.tar.gz.enc 2>/dev/null | wc -l)"

# 4) Uzak kopya.
UZAK="kapali"; HEDEF=""; HATA=""
RCLONE_EK=()
if [ -n "${B2_HESAP:-}" ] && [ -n "${B2_ANAHTAR:-}" ] && [ -n "${B2_KOVA:-}" ]; then
  printf 'RCLONE_CONFIG_ZMB2_TYPE=b2\nRCLONE_CONFIG_ZMB2_ACCOUNT=%s\nRCLONE_CONFIG_ZMB2_KEY=%s\nRCLONE_CONFIG_ZMB2_HARD_DELETE=true\n' "$B2_HESAP" "$B2_ANAHTAR" > "$GECICI"
  HEDEF="zmb2:$B2_KOVA/zar-masasi"
elif [ -n "${ZM_YEDEK_HEDEF:-}" ]; then
  HEDEF="$ZM_YEDEK_HEDEF"
  if [ -d "$HOME/.config/rclone" ]; then RCLONE_EK=(-v "$HOME/.config/rclone:/config/rclone"); fi
fi
rclone() { $DOCKER run --rm --env-file "$GECICI" "${RCLONE_EK[@]}" -v "$KLASOR":/yedek:ro "$RCLONE_IMAJ" "$@"; }
if [ -n "$HEDEF" ]; then
  if CIKTI="$(rclone copy "/yedek/$AD" "$HEDEF" --retries 3 2>&1)"; then
    UZAK="tamam"; echo "$(date -Is) Uzağa kopyalandı: $HEDEF/$AD"
    rclone delete "$HEDEF" --min-age "${UZAK_GUN}d" --include "zar-masasi-*.tar.gz.enc" >/dev/null 2>&1 || true
  else
    UZAK="hata"; HATA="$(echo "$CIKTI" | grep -iE 'error|failed|denied|unauthorized' | tail -1 | cut -c1-200)"
    echo "$(date -Is) HATA: uzağa kopyalanamadı: $CIKTI"
  fi
fi

# 5) Durumu birime yaz (Yönetim panelinde görünür).
json() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
DURUM="{\"t\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"dosya\":\"$AD\",\"boyut\":$BOYUT,\"yerelSayi\":$YEREL_SAYI,\"uzak\":\"$UZAK\",\"uzakHedef\":\"$(json "${HEDEF%%:*}")\",\"hata\":\"$(json "$HATA")\"}"
printf '%s\n' "$DURUM" | $DOCKER run --rm -i -v "$BIRIM":/data alpine:3 sh -c 'cat > /data/yedek-durum.json' || true

# Günlük dosyası çok büyümesin.
LOG="$KLASOR/yedek.log"
if [ -f "$LOG" ] && [ "$(stat -c %s "$LOG")" -gt 1000000 ]; then tail -n 2000 "$LOG" > "$LOG.k" && mv "$LOG.k" "$LOG"; fi
echo "$(date -Is) Tamam: $AD ($((BOYUT / 1024)) KB), sunucuda $YEREL_SAYI yedek, uzak kopya: $UZAK"
[ "$UZAK" != "hata" ]
