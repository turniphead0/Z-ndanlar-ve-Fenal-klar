# Masa oyunları

Zar Masası'na rol yapma masasının yanında klasik tahta oyunları için bir arayüz. Aynı sunucuyu, aynı kimliği ve aynı canlı bağlantıyı (WebSocket) kullanır; ayrı bir kurulum gerekmez. Masa ekranının (oyun listesinin) üstündeki **Masa oyunları** düğmesi ya da doğrudan `http://sunucu:7373/oyunlar` adresi açar.

## Neden bu oyunlar

Oyunların kuralları telif hakkıyla korunmaz; korunan şey belirli bir kitabın metni, kutu tasarımı, çizimler ve markalardır. Aşağıdaki oyunlar yüzlerce, kimi binlerce yıllık halk oyunlarıdır; hiçbir şirketin markası değildir. Kural metinleri ve çizimler bu uygulama için baştan yazıldı.

| Oyun | Neden seçildi | Durum |
| --- | --- | --- |
| **Mangala** | Türk mangalası; tek tıkla oynanır, öğrenmesi kolay. | Demoda var |
| **Türk daması** | Türkiye'de en çok bilinen dama türü; zorunlu ve çoklu alma, dama (kral). | Demoda var |
| **Dokuz taş** (değirmen) | Koyma, sürme ve uçma aşamaları; "hamle sonrası taş alma" gibi iki aşamalı hamleleri gösterir. | Demoda var |
| **Ur Kraliyet Oyunu** | 4500 yıllık zar ve yarış oyunu (kurallar Irving Finkel'in yeniden kurgusu). Zarın sunucuda atılmasını gösterir. | Demoda var |
| Satranç | Kurallar serbest. Rok, geçerken alma, terfi, şah çekme denetimi gerekir. | Sonraki adım |
| Tavla | Kurallar serbest; "tavla" ve "backgammon" genel adlardır. Zar, kırma, kapı, toplama. | Sonraki adım |
| Go | Kurallar serbest. Ko kuralı ve puan sayımı en uğraştıran kısım. | Sonraki adım |
| **Hnefatafl** (Viking satrancı) | 11×11, Kopenhag kuralları. Eşit olmayan iki taraf: kral köşeye kaçar, saldıranlar kuşatır. | Var |
| Reversi | Kurallar serbest. "Othello" bir marka olduğu için bu ad kullanılmamalı. | İleride |

Uzak durulacaklar: Monopoly, Scrabble, Catan, Risk, Uno gibi şirketlerin oyunları ve adları. Kuralları benzer bir oyun yazılabilir, ama adı, kartları, tahta tasarımı ve metinleri kullanılamaz.

## Yapı

```
web/oyunlar/kurallar.js  Bütün oyunların kuralları. Tarayıcıda da sunucuda da aynı dosya çalışır.
web/oyunlar/oyunlar.js   Sayfa: lobi (yeni tahta, açık tahtalar), koltuklar, SVG tahtalar, tıklama.
web/oyunlar/index.html   /oyunlar sayfası.  oyunlar.css: görünüm (açık/koyu tema).
web/ext/oyunlar.js       Masa ekranının üst çubuğuna "Masa oyunları" düğmesi.
server/index.js          bgNew / bgSit / bgMove / bgReset / bgDelete işlemleri.
```

### Her oyun aynı üç işlevi sağlar

```js
yeni(rng)                 // başlangıç durumu (düz JSON)
hamleler(durum)           // sıradaki oyuncunun bütün yasal hamleleri
uygula(durum, hamle, rng) // yeni durum
```

Bir hamle, tıklanan **kare anahtarlarının** dizisidir:

- Mangala: `[kuyu]`
- Dama: `[başlangıç, iniş1, iniş2, …]` (çoklu almada her iniş ayrı)
- Dokuz taş: `[nokta]`, `[nokta, alınacak]`, `[nereden, nereye]` ya da `[nereden, nereye, alınacak]`
- Ur: `[nereden, nereye]` (100+oyuncu başlangıç alanı, 200+oyuncu çıkış)
- Hnefatafl: `[nereden, nereye]`

Arayüz hiçbir oyuna özel tıklama mantığı içermez: tıklananlar bir yasal hamlenin başına uyduğu sürece birikir, uyabilecek sonraki kareler vurgulanır, tam bir hamleye denk gelince sunucuya gönderilir. Yeni bir oyun eklemek için yalnızca kurallar ve bir çizim işlevi yazmak yeter.

### Hile yapılamaz

Tahtalar `boards/<id>` belgelerinde durur. İstemciler bunları okuyup canlı izleyebilir, ama doğrudan yazamaz. Sunucu her `bgMove` isteğinde:

1. İsteyenin sıradaki koltukta oturduğuna,
2. Hamlenin `hamleler(durum)` listesinde olduğuna bakar,
3. Durumu `uygula` ile kendisi hesaplar ve kaydeder.

Zar (Ur'da) da sunucuda atılır. Böylece oyunculardan biri tarayıcısının konsolundan oynasa bile kuralı çiğneyemez.

Koltuklar: herkes boş bir koltuğa oturabilir; aynı kişi iki koltuğa da oturabilir (tek bilgisayarda iki kişi). Koltuğu olmayanlar izleyici olarak tahtayı canlı görür.

## Basitleştirmeler

- Türk daması: taş son sıraya alma sırasında ulaşırsa hamlenin sonunda dama olur. 40 tur taş alınmazsa berabere.
- Mangala: son taş kendi boş kuyuna düştüğünde karşı kuyu boşsa bir şey alınmaz.
- Dokuz taş: 300 hamlede berabere.
- Hnefatafl: kalkan duvarı, kenar kalesi, savunanların tamamen kuşatılması ve tekrar kuralı yok; kenardaki kral alınamaz; 400 hamlede berabere.

## Sonraki adımlar

1. **Satranç ve tavla.** Aynı üç işlevle eklenir; tavlanın zarı Ur'daki gibi sunucuda atılır.
2. **Rol yapma masasına gömme.** Bir oyun içinde (ör. meyhanede kumar) DM masaya tahta açabilir: tahtayı `games/<oyun>/...` altında ilişkilendirmek ve haritada bir pencere olarak göstermek.
3. **Bilgisayara karşı oynama.** `hamleler` ve `uygula` hazır olduğundan basit bir arama (minimax) birkaç düzine satırdır.
4. **İngilizce.** Sayfa şimdilik yalnızca Türkçe; `web/i18n.js` bu sayfaya da eklenip metinler sözlüğe yazılabilir.
5. **Süre, rövanş, skor tablosu, sohbet.**
