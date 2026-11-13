# Zar Masası Android uygulaması

Küçük bir kabuk: ilk açılışta sunucu adresini sorar, sonra sunucunun `/mobil` sayfasını açar.
Uygulamanın asıl ekranları (forum, mesajlar, arkadaşlar, profil, masalar, zar) sunucudaki
`web/mobil/` klasöründedir; sunucu güncellenince uygulama da güncellenir, yeni APK gerekmez.

APK'yı GitHub Actions derler (`.github/workflows/build.yml`, `android` işi). Elle derlemek için
Node 22, Java 21 ve Android SDK gerekir:

```
cd mobil-uygulama
npm install
npx cap add android
cd android && ./gradlew assembleDebug
```

Sunucu HTTPS değilse (yalnızca `http://` IP adresi) uygulama yine çalışır: düz bağlantıya izin verilir.
