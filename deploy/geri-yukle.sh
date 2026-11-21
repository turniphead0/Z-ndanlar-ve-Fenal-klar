#!/usr/bin/env bash
# Zar Masası'nı bir yedekten geri yükler (deploy/yedek.sh'nin aldığı şifreli yedeklerden).
#
#   bash deploy/geri-yukle.sh                     yedekleri listeler (sunucudakiler ve uzaktakiler)
#   bash deploy/geri-yukle.sh <yedek dosyası>     o yedeği geri yükler (~/zm-yedekler içindeki ad ya da tam yol)
#   bash deploy/geri-yukle.sh --uzak <ad>         yedeği önce uzaktan (B2 / Google Drive) indirir, sonra geri yükler
#
# Geri yüklemeden önce şimdiki veriler de ayrıca yedeklenir (bir şey ters giderse ona dönebilesin).
# Yeni bir sunucuya taşırken: depoyu indir, ~/zm-yedek.env dosyasını (aynı ZM_YEDEK_SIFRE ile) oluştur,
# bash deploy/kur.sh çalıştır, sonra bu komutla yedeği geri yükle.
set -euo pipefail
cd "$(dirname "$0")/.."
AYAR="${ZM_YEDEK_AYAR:-$HOME/zm-yedek.env}"
KLASOR="${ZM_YEDEK_KLASOR:-$HOME/zm-yedekler}"
BIRIM="${ZM_BIRIM:-zar-masasi-veri}"
RCLONE_IMAJ="rclone/rclone:1.68"
DOCKER="${ZM_DOCKER:-sudo docker}"

if [ ! -s "$AYAR" ]; then echo "$AYAR bulunamadı. İçine yedeklerin şifresini yaz: ZM_YEDEK_SIFRE=..."; exit 1; fi
# shellcheck disable=SC1090
set -a; . "$AYAR"; set +a
mkdir -p "$KLASOR"

GECICI="$(mktemp)"; chmod 600 "$GECICI"; ACIK="$(mktemp)"; trap 'rm -f "$GECICI" "$ACIK"' EXIT
HEDEF=""; RCLONE_EK=()
if [ -n "${B2_HESAP:-}" ] && [ -n "${B2_ANAHTAR:-}" ] && [ -n "${B2_KOVA:-}" ]; then
  printf 'RCLONE_CONFIG_ZMB2_TYPE=b2\nRCLONE_CONFIG_ZMB2_ACCOUNT=%s\nRCLONE_CONFIG_ZMB2_KEY=%s\n' "$B2_HESAP" "$B2_ANAHTAR" > "$GECICI"
  HEDEF="zmb2:$B2_KOVA/zar-masasi"
elif [ -n "${ZM_YEDEK_HEDEF:-}" ]; then
  HEDEF="$ZM_YEDEK_HEDEF"; [ -d "$HOME/.config/rclone" ] && RCLONE_EK=(-v "$HOME/.config/rclone:/config/rclone")
fi
rclone() { $DOCKER run --rm --env-file "$GECICI" "${RCLONE_EK[@]}" -v "$KLASOR":/yedek "$RCLONE_IMAJ" "$@"; }

if [ $# -eq 0 ]; then
  echo "Sunucudaki yedekler (en yeni üstte):"
  ls -1t "$KLASOR"/zar-masasi-*.tar.gz.enc 2>/dev/null | xargs -r -n1 basename || true
  if [ -n "$HEDEF" ]; then echo; echo "Uzaktaki yedekler ($HEDEF):"; rclone lsf "$HEDEF" --include "zar-masasi-*.tar.gz.enc" | sort -r || true; fi
  echo; echo "Geri yüklemek için: bash deploy/geri-yukle.sh <ad>   (uzaktaki için: --uzak <ad>)"
  exit 0
fi

if [ "$1" = "--uzak" ]; then
  [ -n "$HEDEF" ] || { echo "Uzak hedef ayarlanmamış ($AYAR)."; exit 1; }
  AD="$(basename "${2:?Yedeğin adını yaz}")"
  echo "İndiriliyor: $HEDEF/$AD"
  rclone copy "$HEDEF/$AD" /yedek/
  DOSYA="$KLASOR/$AD"
else
  DOSYA="$1"; [ -f "$DOSYA" ] || DOSYA="$KLASOR/$(basename "$1")"
fi
[ -f "$DOSYA" ] || { echo "Yedek bulunamadı: $DOSYA"; exit 1; }

echo "Yedeğin şifresi çözülüyor ve denetleniyor…"
if ! openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:ZM_YEDEK_SIFRE -in "$DOSYA" -out "$ACIK" 2>/dev/null || ! tar -tzf "$ACIK" ./db.json >/dev/null 2>&1; then
  echo "Yedek açılamadı: ZM_YEDEK_SIFRE yanlış ya da dosya bozuk."; exit 1
fi
echo "Yedek sağlam: $(basename "$DOSYA") ($(tar -tzf "$ACIK" | grep -c '^./assets/.' || true) yüklenmiş dosya)."
read -r -p "Sunucudaki şimdiki veriler bu yedekle DEĞİŞTİRİLECEK. Devam etmek için 'evet' yaz: " CEVAP
[ "$CEVAP" = "evet" ] || { echo "Vazgeçildi."; exit 1; }

echo "1/3 Şimdiki veriler ayrıca yedekleniyor…"
ONCE="$KLASOR/geri-yukleme-oncesi-$(date -u +%Y-%m-%d_%H%M).tar.gz.enc"
$DOCKER run --rm -v "$BIRIM":/data:ro alpine:3 tar -C /data -czf - . | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:ZM_YEDEK_SIFRE -out "$ONCE"
echo "    $ONCE"
echo "2/3 Sunucu durduruluyor ve yedek yazılıyor…"
$DOCKER stop zar-masasi >/dev/null 2>&1 || true
$DOCKER run --rm -i -v "$BIRIM":/data alpine:3 sh -c 'find /data -mindepth 1 -delete && tar -xzf - -C /data' < "$ACIK"
echo "3/3 Sunucu yeniden başlatılıyor…"
$DOCKER start zar-masasi >/dev/null
echo "Tamam: veriler $(basename "$DOSYA") yedeğinden geri yüklendi."
