# Zar Masası

Ücretsiz ve açık kaynak bir sanal oyun masası (VTT). D&D 5e, Pathfinder 2e, Call of Cthulhu, Year Zero ve Monster of the Week sistemleri için karakter kağıtları, zar tepsisi, sisli harita ve jetonlar, savaş sırası, canavar kartları, notlar, ses/müzik ve (isteğe bağlı) yapay zekâ destekli senaryo yardımcısı içerir.

Uygulama iki şekilde kullanılabilir:

1. **Bir sunucuya bağlanarak.** Ortak bir sunucu (örneğin topluluk sunucusu) ya da bir arkadaşın bilgisayarı.
2. **Kendi bilgisayarını host yaparak.** Masaüstü uygulamasında "Bu bilgisayarda host et" dersin, masa senin bilgisayarında çalışır ve veriler orada saklanır.

Her bölüm (karakterler, notlar, harita, savaş…) başlığındaki **Ayrı pencere** düğmesiyle kendi penceresinde açılabilir; örneğin haritayı ikinci ekrana taşıyabilirsin. Haritadaki **Savaş sırası** düğmesi inisiyatif takipçisini taşınabilir bir pencere olarak açar. D&D 5e, Pathfinder 2e ve Monster of the Week masalarında **+ Yeni karakter**, yeni oyuncuları adım adım yönlendiren bir karakter yaratma sihirbazı açar; ardından **Kağıt rehberi** kağıttaki her bölümün ne işe yaradığını yerinde gösterir. Karakter kağıdındaki **Seviye atla** sihirbazı (CoC'de gelişim aşaması, Year Zero'da TP harcama) her sistemin kendi gelişim kuralını uygular; büyü kitabı yuvaları takip eder ve büyüyü tek tıkla yapar. Her sistemin kendi görsel teması vardır (D&D 5e parşömen ve kızıl, Pathfinder 2e lacivert ve bronz, Call of Cthulhu eski arşiv, Year Zero endüstriyel, Monster of the Week gece moru; Forbidden Lands ve Vaesen için ayrı); açık ve koyu modda çalışır. Listede olmayan ırk, sınıf, geçmiş ve büyüler için **Kendi …** seçeneğiyle homebrew eklenebilir.

İçerik: D&D 5e için SRD 5.1 (CC-BY-4.0), Pathfinder 2e için Player Core / ORC lisanslı kurallar. Monster of the Week desteği (2d6 hamleler, zarar, şans, deneyim, gelişim, canavar ve gizem geri sayımı) bu uygulama için özgün Türkçe metinlerle yazılmıştır; rol hamlelerinin tam metni oyuncunun kendi kitabından girilir.

Masaya katılanların uygulamayı kurması da şart değil: sunucunun adresini tarayıcıda açan herkes aynı masaya oturabilir.

## Kurulum (oyuncular için)

[Sürümler](../../releases) sayfasından işletim sistemine uygun dosyayı indir:

- Windows: `ZarMasasi-…-win-x64.exe`
- macOS: `ZarMasasi-…-mac-….dmg`
- Linux: `ZarMasasi-…-linux-x86_64.AppImage`

### Host etmek

"Bu bilgisayarda host et" bölümünde masaya bir ad ver ve istersen bir şifre koy. Başlatınca masaya ilk sen oturursun ve masanın sahibi olursun.

- **Aynı ağdaysanız** (aynı ev, aynı modem), başlangıç ekranındaki yerel adresi (örneğin `192.168.1.20:7373`) arkadaşlarına ver.
- **İnternet üzerinden** bağlanacaklar için modeminde 7373 portunu (TCP) bilgisayarına yönlendirmen ve dış IP adresini paylaşman gerekir. Windows ilk açılışta güvenlik duvarı izni sorarsa izin ver.
- Masa uygulama açık kaldığı sürece çalışır. Veriler `%APPDATA%/zar-masasi/masa-verisi` (Windows), `~/Library/Application Support/zar-masasi/masa-verisi` (macOS) ya da `~/.config/zar-masasi/masa-verisi` (Linux) altında durur.

## Sunucu kurulumu (sunucu sahipleri için)

Docker ile:

```sh
docker build -t zar-masasi .
docker run -d --name zar-masasi -p 7373:7373 -v zar-masasi-veri:/data \
  -e ZM_NAME="Topluluk masası" -e ZM_PASSWORD="isteğe-bağlı" \
  zar-masasi
```

Ya da doğrudan Node.js 22 ile:

```sh
npm ci --omit=dev --ignore-scripts
node server/cli.js --port 7373 --data ./veri --name "Topluluk masası"
```

Açılışta konsolda bir **sahip bağlantısı** (`/?owner=…`) yazılır. Bunu yalnızca kendin bir kez aç; o tarayıcı masanın sahibi olarak tanınır. Kimseyle paylaşma.

| Ayar | Komut satırı | Ortam değişkeni | Varsayılan |
| --- | --- | --- | --- |
| Port | `--port` | `ZM_PORT` | `7373` |
| Veri klasörü | `--data` | `ZM_DATA` | `./zar-masasi-veri` |
| Masa şifresi | `--password` | `ZM_PASSWORD` | yok |
| Masa adı | `--name` | `ZM_NAME` | `Zar Masası` |
| Claude API anahtarı | | `ANTHROPIC_API_KEY` | yok (yapay zekâ kapalı) |
| Claude modeli | | `ZM_AI_MODEL` | `claude-opus-5-5` |

İnternete açık bir sunucuda HTTPS için önüne bir ters vekil (Caddy, nginx) koyman önerilir. WebSocket yolu `/ws`'dir. Kullanıcılar uygulamada `https://masa.ornek.com` gibi tam adresi yazabilir.

### Yapay zekâ

Senaryo (PDF'ten modül çıkarma, DM asistanı) ve Destek bölümleri Claude ile çalışır. Bunun için sunucuda bir Anthropic API anahtarı tanımlanmalıdır; ücreti anahtarın sahibine yansır. Anahtar yoksa bu bölümler kapalı görünür, geri kalan her şey çalışır.

## Geliştirme

```sh
npm install
npm start        # masaüstü uygulaması
npm run server   # yalnızca sunucu
npm test
npm run dist     # bu işletim sistemi için paket
```

`v` ile başlayan bir etiket gönderildiğinde (`git tag v0.1.0 && git push --tags`) GitHub Actions Windows, macOS ve Linux paketlerini derleyip Sürümler sayfasına ekler.

### Yapı

```
web/app.html      Uygulamanın kendisi (Claude ile yapılan Zar Masası artifact'ı, değiştirilmeden)
web/shim.js       Köprü: uygulamanın kullandığı window.claude.use(...) arayüzlerini sunucuya bağlar
web/ext/          Eklentiler: ayrı pencereler, haritada açılır savaş takipçisi, karakter sihirbazı, kağıt rehberi, büyü kitabı ve seviye atlama (5e verisi SRD 5.1, CC-BY-4.0)
server/           Sunucu: belge deposu, canlı oda (jeton sürükleme, ping, ses efekti), dosya yükleme, Claude vekili
electron/         Masaüstü kabuğu: bağlan / host et ekranı
```

Uygulama, Claude artifact'larının çalışma ortamındaki beş arayüzü kullanır. `shim.js` bunların her birini bu sunucuyla karşılar:

| Arayüz | Ne işe yarar | Sunucudaki karşılığı |
| --- | --- | --- |
| `db` | Oyunlar, karakterler, haritalar, notlar, zar geçmişi | `db.json` belge deposu, canlı abonelikler |
| `room` | Masadakiler, jeton sürükleme, işaretler, ses efektleri | WebSocket yayını |
| `user` | Ad, renk, kimlik | Cihazda saklanan kimlik + gizli anahtar |
| `assets` | Harita görselleri, el notları, müzik | `assets/` klasörü |
| `sample` | Claude çağrıları | Anthropic API (isteğe bağlı) |

Her DM'in gizli verisi (`data/users/<kişi>/…`: canavarlar, DM notları, senaryo çözümlemesi) sunucu tarafından yalnızca o kişiye gösterilir.

## Lisans

MIT
