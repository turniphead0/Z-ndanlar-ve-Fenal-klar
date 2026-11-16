/* Uygulamayla gelen kart/taş oyunları (kartmasa.js tanımları). Tarayıcıda window.ZM_HAZIR, sunucuda require.
   Kazan ya da Katlet: Cal'in tasarladığı oyun. Kart resimleri web/oyunlar/kk/ klasöründe.
   İki sürüm var: "Orijinal" belgedeki kurallar ve kartlarla birebir; "Claude Versiyonu" eksikleri tamamlanmış,
   dengesi ayarlanmış sürüm (değişiklikler kurallar metninde ✱ ile işaretli). */
(function (root) {
  "use strict";
  const R = ad => `/oyunlar/kk/${ad}.png`;

  const KARAKTERLER = [
    ["envanter-sorumlusu", "Envanter Sorumlusu", "Eğer elinde eşya kartı kalmazsa; tur sonunda bir eşya kartı çek."],
    ["genetikci", "Genetikçi", "Desteklediğin canavarın gizli huy kartına bakarken; ek bir kart çek ve istediğini tut, diğerini ıskartaya kapalı olarak at."],
    ["guvenlik-gorevlisi", "Güvenlik Görevlisi", "Herkesten 1 fazla can puanına sahip."],
    ["proje-yoneticisi", "Proje Yöneticisi", "KAZAN ya da KATLET belirlendikten sonra 2 farklı canavarı hedefle."],
    ["teknik-uzman", "Teknik Uzman", "Tur başında, 1 eşya kartı çek ve 1 eşya kartını ıskartaya at."],
    ["veribilimci", "Veribilimci", "Tur başında, gizli huy destesinin en üstündeki karta bak ve o kartı kapalı olarak bir müsait bir canavar kartının yanına yerleştir."],
  ];
  const ESYALAR = [
    ["enerji-zirhi", "Enerji Zırhı", "Desteklediğin canavar, KATLET için hedeflenemez.", 1],
    ["genetik-tarayici", "Genetik Tarayıcı", "Hedeflediğin canavarın, gizli huy kartını bak.", 1],
    ["bio-veri-modulu", "Bio-Veri Modülü", "Desteklediğin canavar yerine, başka bir canavarın Destekle aksiyonunu kullan.", 1],
    ["dna-modifikasyon-cipi", "DNA Modifikasyon Çipi", "Desteklediğin canavarın, gizli huy kartını kapalı olarak ıskartaya çıkar ve yeni bir kart çek.", 1],
    ["sinir-yatistirici-gaz", "Sinir Yatıştırıcı Gaz", "Oy birliğiyle alınan KAZAN ya da KATLET kararını değiştir.", 1],
    ["tam-otomatik-hedefleyici", "Tam Otomatik Hedefleyici", "Tüm hedeflenemez; etkilerini herkes için, bu tur sonuna kadar yoksay.", 1],
    ["sok-tabancasi", "Şok Tabancası", "Şuanda bir amaç doğrultusunda hedef gösteren oyuncuyu hedefle, bu oyuncu başarısız oldu. Eşya kartını ıskartaya çıkar.", 1],
    ["tesvik-modulu", "Teşvik Modülü", "Hedeflediğin canavar, KAZAN aksiyonu iki katı etkilidir.", 1],
    ["kimyasal-karisim", "Kimyasal Karışım", "Bir oyuncuyu hedefle, sahip olduğu eşya kartlarından birini rastgele seç ve ıskartaya at.", 1],
    ["guclendirilmis-kafes", "Güçlendirilmiş Kafes", "Bir canavarı hedefle, hedeflediğin canavarın ölüm etkisini engelle.", 1],
    ["holo-projeksiyon-cihazi", "Holo-Projeksiyon Cihazı", "Bir oyuncunun seçtiği canavar kartını, başka bir canavarla değiştir.", 1],
    ["plastik-mermi", "Plastik Mermi", "Bir oyuncuyu hedefle, hedeflediğin oyuncu 1 can kaybeder.", 3],
    ["psiko-dinamik-tarayici", "Psiko Dinamik Tarayıcı", "Bir oyuncuyu hedefle, oyuncunun gizli huy kartlarından birini seç ve o karta gizlice bak.", 1],
    ["reaktor-pilleri", "Reaktör Pilleri", "Eşya ıskarta destesinden, bir kart seç ve eline ekle.", 1],
    ["lazer-tetikleyici", "Lazer Tetikleyici", "Hedeflediğin canavar, KATLET aksiyonu iki katı etkilidir.", 1],
    ["manipulasyon-kodlayici", "Manipülasyon Kodlayıcı", "Bir oyuncunun gizli huy kartını seç ve bakmadan ıskartaya çıkar. 2 adet gizli huy kartı çek. Kapalı olarak 1'ni ıskartaya at, diğerini oyuncuya ver.", 1],
    ["nano-tedavi-botu", "Nano Tedavi Botu", "Hedeflediğin bir oyuncu, eksik canlarından 1'ini iyileştir.", 1],
  ];
  const CANAVARLAR = [
    ["aloroz", "Aloroz", "Destekle: Kendin hariç bir canavarı koru, o canavar bu tur hedef alınamaz.\nÖlüm: Gizli huy destesinden 3 kart çekin. Melek kartlarını oyundan çıkarın, şeytan kartlarını desteye ekleyin ve karıştırın."],
    ["glingard", "Glingard", "Destekle: Pasif olarak üzerine oynanan ilk eşya kartını etkinleşmeden ıskartaya çıkar.\nÖlüm: Tüm oyuncular elindeki 1 eşya kartını ıskartaya çıkartsın."],
    ["inkabuz", "İnkabuz", "Destekle: Bir gizli huy kartını hedef al ve o karta bak. İstersen onu kendininkiyle değiştir.\nÖlüm: Oyuncular son turda sahip olduğu gizli huy kartını kapalı olarak ıskartaya çıkartır ve yenisini çeker."],
    ["yeraskun", "Yeraskun", "Destekle: İki farklı birimi KATLET aksiyonu için hedef göster.\nÖlüm: Kalıcı olarak, tüm canavarlar KATLET aksiyonu için 1 kez hedef gösterilir."],
    ["farkus", "Farkus", "Destekle: Bir eşya kartı çek.\nÖlüm: Kalıcı olarak, tüm oyuncular tur başında bir eşya kartı çeker."],
    ["loopup-loop", "Loopup Loop", "Destekle: Açık şekilde gizli huy kartı çek ve ıskartaya at. Şeytan ise bir oyuncuyu hedefle, 1 hasar ver.\nÖlüm: Açık şekilde gizli huy kartı çek ve ıskartaya at. Melek ise tüm oyuncuları hedefle, 1 hasar iyileştir."],
    ["sekoranikor", "Şekoranikor", "Destekle: Pasif, ben hedef alınamam.\nÖlüm: Tüm oyuncular 1 can kaybeder."],
    ["alexandra-zeitsev", "Alexandra Zeitsev", "Destekle: Bir canavarı hedef al, gizli huy kartını kapalı olarak destenin en üstündeki kartla değiştir.\nÖlüm: Öldükten sonraki tur; oyuncular desteklediği canavarın gizli karakter kartını, herkesin görmesi için açar."],
    ["markov-nikov", "Markov Nikov", "Destekle: Bir canavarı hedef al ve onun gizli huy kartına gizlice bak.\nÖlüm: Öldükten sonraki tur, oyuncular desteklediği canavarın gizli karakter kartına bakamaz."],
  ];

  // Masa düzeni (1600×1000, konumlar kartın ortası). Canavarlar ortada halka, desteler sağda.
  const HALKA = [[700, 215, 0], [985, 345, 0], [985, 595, 0], [700, 725, 0], [415, 595, 0], [415, 345, 0], [700, 470, 90]];

  function kazanKatlet(claude) {
    const kart = ([id, ad, metin, adet], on, ek) => ({ id, ad, metin, resim: R(on + "-" + id), adet: adet || 1, ...(ek || {}) });
    const ozel = { // Claude Versiyonu'nda metni değişen kartlar resimsiz (yazıyla) çizilir.
      "guvenlik-gorevlisi": { metin: "Herkesten 1 fazla can puanına sahip. Vardiyada bir kez, başka bir oyuncunun alacağı 1 hasarı onun yerine sen alabilirsin.", resim: null, not: "Claude: koruma yeteneği eklendi." },
      sekoranikor: { metin: "Destekle: Pasif, KAZAN için hedef alınamam ve düşük öncelikli ilan edilemem.\nÖlüm: Tüm oyuncular 1 can kaybeder.", resim: null, simge: R("simge-canavar"), not: "Claude: “hiç hedef alınamam” ölüm etkisini imkânsız kılıyordu." },
      "alexandra-zeitsev": { metin: "Destekle: Bir canavarı hedef al, gizli huy kartını kapalı olarak destenin en üstündeki kartla değiştir.\nÖlüm: Öldükten sonraki tur; oyuncular desteklediği canavarın gizli huy kartını, herkesin görmesi için açar.", not: "Claude: “gizli karakter kartı” → “gizli huy kartı”." },
      "markov-nikov": { metin: "Destekle: Bir canavarı hedef al ve onun gizli huy kartına gizlice bak.\nÖlüm: Öldükten sonraki tur, oyuncular desteklediği canavarın gizli huy kartına bakamaz.", not: "Claude: “gizli karakter kartı” → “gizli huy kartı”." },
    };
    const adetler = claude ? { "plastik-mermi": 2, "nano-tedavi-botu": 2 } : {};
    const uyarla = (k, on) => { const c = kart(k, on); if (claude && ozel[k[0]]) Object.assign(c, ozel[k[0]]); if (claude && adetler[k[0]]) c.adet = adetler[k[0]]; return c; };
    return {
      ad: "Kazan ya da Katlet", surum: claude ? "Claude Versiyonu" : "Orijinal",
      aciklama: claude
        ? "Cal'in oyununun eksikleri tamamlanmış, dengesi ayarlanmış sürümü: 3–5 oyuncu, herkese bir karakter, oyuncu ölümü ve yedek canavar kuralları, daha dengeli eşya destesi."
        : "Cal'in tasarladığı gizli rollü kart oyunu, belgedeki kurallar ve kartlarla birebir. Canavarları besle ya da katlet; melek misin şeytan mı, kimse bilmesin.",
      oyuncu: claude ? { min: 3, max: 5 } : { min: 3, max: 5 },
      masa: { renk: "#3d4a52" },
      desteler: [
        { id: "canavar", ad: "Canavarlar", w: 130, h: 186, x: 1250, y: 560, arka: { resim: R("canavar-arka") }, iskarta: { ad: claude ? "Katledilen canavarlar" : "Canavar ıskartası", x: 1440, y: 560, acik: true }, kartlar: CANAVARLAR.map(k => uyarla(k, "canavar")) },
        { id: "huy", ad: "Gizli huy", w: 84, h: 126, x: 1250, y: 130, arka: { resim: R("huy-arka") }, iskarta: { ad: "Huy ıskartası (kapalı)", x: 1440, y: 130, acik: false },
          kartlar: [{ id: "seytan", ad: "Şeytan", resim: R("huy-seytan"), adet: 13 }, { id: "melek", ad: "Melek", resim: R("huy-melek"), adet: 12 }] },
        { id: "esya", ad: "Eşyalar", w: 100, h: 143, x: 1250, y: 340, arka: { resim: R("esya-arka") }, iskarta: { ad: "Eşya ıskartası", x: 1440, y: 340, acik: true }, kartlar: ESYALAR.map(k => uyarla(k, "esya")) },
        { id: "karakter", ad: "Karakterler", w: 100, h: 150, x: 1250, y: 790, arka: { resim: R("karakter-arka") }, kartlar: KARAKTERLER.map(k => uyarla(k, "karakter")) },
        { id: "kazan", ad: "Karar: Kazan", w: 80, h: 120, x: 1420, y: 790, karistir: false, arka: { resim: R("karar-arka") }, kartlar: [{ id: "kazan", ad: "Kazan", resim: R("karar-kazan"), adet: 5 }] },
        { id: "katlet", ad: "Karar: Katlet", w: 80, h: 120, x: 1530, y: 790, karistir: false, arka: { resim: R("karar-arka") }, kartlar: [{ id: "katlet", ad: "Katlet", resim: R("karar-katlet"), adet: 5 }] },
      ],
      taslar: [
        { id: "amir", ad: "Vardiya Amiri", sekil: "yildiz", renk: "#e3b23c", boy: 54, adet: 1, x: 80, y: 900 },
        { id: "dusuk", ad: "Düşük öncelik", sekil: "kare", renk: "#7f8c8d", boy: 40, adet: 1, x: 160, y: 900 },
        { id: "hedef", ad: "Hedef işareti", sekil: "daire", renk: "oyuncu", boy: 30, adet: 3, herOyuncu: true, x: 240, y: 890 },
      ],
      sayaclar: [{ id: "can", ad: "Can", baslangic: 3, min: 0, max: 9 }],
      alanlar: [
        { ad: "Silinen huy bölgesi", x: 30, y: 40, w: 250, h: 330, renk: "#c0392b" },
        { ad: "Karar kartları (kapalı)", x: 30, y: 400, w: 250, h: 240, renk: "#e3b23c" },
        { ad: "Hedef işaretleri ve taşlar", x: 30, y: 840, w: 520, h: 130, renk: "#ffffff" },
      ],
      kurulum: [
        claude ? { islem: "dagit", deste: "karakter", adet: 1, nereye: "onu", acik: true } : { islem: "dagit", deste: "karakter", adet: 2, nereye: "el" },
        { islem: "masaya", deste: "canavar", adet: 7, acik: true, konumlar: HALKA },
        { islem: "dagit", deste: "huy", adet: 1, nereye: "onu", acik: false, sahibiGorur: true },
        { islem: "dagit", deste: "esya", adet: 4, nereye: "el" },
        { islem: "dagit", deste: "kazan", adet: 1, nereye: "el" },
        { islem: "dagit", deste: "katlet", adet: 1, nereye: "el" },
      ],
      kurallar: claude ? KURALLAR_CLAUDE : KURALLAR_ORIJINAL,
    };
  }

  const MASADA = `## Bu masada nasıl oynanır
- Kartı sürükleyerek masada taşı. Bir karta dokununca ne yapabileceğin çıkar: çevir, gizlice bak, eline al, önüne koy, desteye koy, döndür.
- Elindeki kartları yalnızca sen görürsün. Önündeki kapalı kartları sen ve baktığı kayda geçen kişiler görür.
- Desteye dokununca kart çekebilir, karıştırabilir ya da üstteki karta gizlice bakabilirsin.
- Can sayacını oyuncu panelindeki − ve + ile değiştir. Hedef işaretlerini canavarların üstüne sürükle.
- Her hareket sağdaki günlüğe yazılır; kimse fark edilmeden kart değiştiremez.`;

  const KURALLAR_ORIJINAL = `# KAZAN ya da KATLET
Hikaye:

## Oyun Kuruluş
Tüm karakter kartlarını karıştırın ve tüm oyunculara rastgele 2 kart verin. Oyuncular oynamak istediği karakteri açık olarak önüne yerleştirip; diğer kartı can sayacı olarak kullanmak için kapalı olarak karakter kartının alt kısmına, 3 kutu (can) görülecek şekilde yerleştirsin.
Tüm canavar kartlarını karıştırın ve 6 tanesini kabaca bir halka oluşturacak şekilde dik olarak yerleştirin. 1 tanesini, 6 kartın ortasına yatay olarak yerleştirin.
Gizli huy kartlarını karıştırın ve desteyi masa üstüne yerleştirin. Gizli huy kartları her zaman kapalı olarak ıskartaya atılır. Destedeki kart tükendiğinde, ıskarta destesi karıştırılarak yeni bir deste oluşturulur.
Eşya kartlarını karıştırın ve desteyi masa üstüne yerleştirin. Eşya kartları her zaman açık olarak ıskartaya atılır. Destedeki kart tükendiğinde, ıskarta destesi karıştırılmaz.
Oyuncular kapalı olarak 1 gizli huy kartı çeksin, kartlarına baktıktan sonra karakter kağıdının sağ tarafına kapalı olarak yerleştirsin.
Oyuncunun önünde bulunan gizli huy kartları oyunucunun karakterini belirler. Oyuncu 1 kart ile oyuna başlar ve her tur ilerledikçe yeni bir kart elde edebilir. En fazla 3 adet gizli huy kartına sahip olabilir. Eğer 4. Kartı elde ederse, 1. Elde ettiği kartı ıskartaya atar. Eğer gizli huy kartlarında Melek kartları çoğunluktaysa Melek oyuncu, Şeytan kartları çoğunlukta ya da eşitse Şeytan oyuncu olarak adlandırılır.
Oyuncular kapalı olarak 4 adet eşya kart çeksin. 1 kartı ıskartaya atıp, 3 ünü elinde tutsun.
Oyunculara KARAR kartlarından birer adet KAZAN ve KATLET kartı verin.
Oyuna ilk başlayacak Vardiya Amirini belirleyin.

## Kazanma Koşulu
Oyuncular oyunu iki şekilde tamamlayabilir.
Silinen Huy bölgesinde eğer 3 adet şeytan kartı varsa oyun dayanışma sonu ile tamamlanır. Tüm yaşayan melek oyuncular zafere ortak olur, şeytan oyuncular kaybeder.
Silinen Huy bölgesinde eğer 3 adet melek kartı varsa oyun kargaşa sonu ile devam eder. Oyunu sadece 1 kişi kazanabilir. Tüm oyuncular gizli huy kartlarını açarlar. Eğer tek şeytan varsa oyun biter. Melekler kaybeder. Eğer birden fazla şeytan oyuncu varsa, tüm oyuncular gizli huy kartlarını kapatır oyun devam eder. Tek bir oyuncu hayatta kaldığında, eğer o oyuncu şeytansa oyunu kazanır. Aksi durumda tüm oyuncular kaybeder.
Oyun kargaşa sonu ile devam ederken, 4 adet şeytan kartı Silinen huy bölgesinde bulunursa oyun dayanışma sonu ile tamamlanır.

## Oynanış
### 1. Vardiya Devri
Bir önceki turun, vardiya amiri, vardiyayı solundaki oyuncuya devreder.
Devir esnasında şunları cevaplar.
- Bir önceki vardiyada KAZAN ya da KATLET aksiyonundan hangisi seçildi?
- Hangi canavarlar hedef alındı?
- Hedefleme başarılımı mı?
- Aksiyon sonucunda hangi huy silinenler havuzuna taşındı?
- Katledilen canavarın ölüm etkisi ne?
Yeni vardiya amiri, yanında gizli huy kartı bulunmayan canavarların yanına kapalı olarak gizli huy kartı çeker ve koyar.

### 2. Görev Dağılımı
Canavar sayısı, personel sayısından fazlaysa; vardiya amiri bir canavarı seçer ve onu düşük öncelikli ilan eder. Düşük öncelikli canavar görev dağılımında seçilemez.
Sonrasında oyuncular ilgilenecekleri canavarı seçerler. İlk tercihi vardiya amiri yapar, sonrasında saat yönünde herkes bir tercih yapar.
Canavar sayısı, personel sayısından az ise, tüm oyuncuların ilgilenebilecekleri kadar canavar yok demektir. Canavar ile ilgilenemeyen oyuncular bir eşya kartı çekerler ve bir hasar alırlar.
Canavarlarla ilgilenebilen tüm oyuncular, seçtikleri canavarın gizli huy kartına gizlice bakarlar.

### 3. Destekle
Vardiya amirinden başlayarak oyuncular canavarların destekle aksiyonunu yaparlar.

### 4. Kazan ya da Katlet
Tüm personeller Kazan ya da Katlet oylamasına katılmadan önce vardiya amiri sembolik olarak bu vardiyada ne yapılması gerektiği hakkında sözlü olarak görüş bildirir. Sonrasında ise oylama yapılır.
Eğer tüm personelin sayısı tek sayı ise tüm herkes kapalı olarak KARAR kartlarından Kazan ya da Katlet oyunu kullanır. Sonucuna göre Vardiya amirinden başlayarak herkes 1 hedefi hedefler.
Eğer tüm personelin sayısı çift sayı ise vardiya amiri hariç herkes kapalı olarak KARAR kartlarından Kazan ya da Katlet oyunu kullanır. Sonucuna göre Vardiya amirinden başlayarak herkes 1 hedefi, vardiya amiri aynı hedefi 2 kez hedefler.
Katlet; bir canavar toplam oyuncu sayısı kadar hedeflenirse o hedef katledilir. Gizli huy kartı açılır ve silinen huy bölgesine açık bir şekilde taşınır.
Kazan; bir canavar toplam oyuncu sayısından 1 az kadar hedeflenirse, o canavarın gizli huy kartı kapalı olarak ıskartaya atılır. Vardiye amiri iki gizli huy kartı çeker. Seçtiği birini kapalı olarak canavarın yanına yerleştirir. Diğerini kapalı olarak ıskartaya atar.
Eğer kazan hamlesinde bir canavar oyuncu sayısı kadar hedeflenirse. Vardiya canavar özelindeki hamleyi yaptıktan sonra, tüm canavarların gizli huy kartlarını açar. Eğer Melek kartı çoğunluktaysa, silinen huy bölgesine bir şeytan kartı atılır. Aksi durumda melek kartı atılır. Ardından tüm kartlar kapalı olarak ıskartaya atılır. Eğer açılan kartların tamamı aynı ise gizli huy destesinden uygun olan kart gelene kadar açık şekilde kart çekilir.

${MASADA}
- Bu sürümde can, oyuncu panelindeki “Can” sayacıyla tutulur (kapalı karakter kartının yerine). Güvenlik Görevlisi'ni seçen canını 4 yapsın.`;

  const KURALLAR_CLAUDE = `# KAZAN ya da KATLET · Claude Versiyonu
Kurallar orijinaliyle aynıdır; ✱ ile işaretli yerler Claude'un tamamladığı ya da değiştirdiği kısımlardır. Neden değiştiği her maddenin altında yazıyor.

## Oyuncu sayısı
✱ 3–5 oyuncu.
> Destede 5 takım KARAR kartı ve 6 karakter kartı var; orijinal kurulum herkese 2 karakter verdiği için 3 kişiden fazlasına yetmiyordu.

## Oyun Kuruluş
✱ Karakter kartlarını karıştırın, her oyuncuya 1 karakter açık olarak verin. Can, oyuncu panelindeki sayaçla tutulur: herkes 3 canla başlar, Güvenlik Görevlisi 4 canla.
> Can sayacı olarak ikinci bir karakter kartı kullanmak oyuncu sayısını 3'e sınırlıyordu.

Canavar kartlarını karıştırın; 6 tanesini halka şeklinde dik, 1 tanesini ortaya yatay yerleştirin.
✱ Ortadaki yatay canavar “sıradaki canavar”dır: görev dağılımında seçilemez, hedeflenemez, desteklenmez. Halkadaki bir canavar katledilince sıradaki canavar onun yerine geçer (yanına yeni gizli huy kartı vardiya devrinde konur) ve desteden yeni bir sıradaki canavar açılır. Canavar destesi bitince ortası boş kalır.
> Orijinalde ortadaki kartın ne işe yaradığı ve katledilen canavarın yerine ne geleceği yazmıyordu.

Gizli huy kartlarını karıştırıp desteyi koyun. Gizli huy kartları her zaman kapalı olarak ıskartaya atılır. Deste bitince ıskarta karıştırılıp yeni deste olur.
Eşya kartlarını karıştırıp desteyi koyun. Eşya kartları her zaman açık olarak ıskartaya atılır. Deste bitince ıskarta karıştırılmaz.
Her oyuncu kapalı olarak 1 gizli huy kartı çeker, bakar ve önüne kapalı koyar. Gizli huy kartları oyuncunun tarafını belirler: Melek kartı çoğunluktaysa Melek, Şeytan çoğunluktaysa ya da eşitse Şeytan oyuncudur. En fazla 3 gizli huy kartı tutulur; 4. kart gelirse ilk kart ıskartaya atılır.
Her oyuncu 4 eşya kartı çeker, 1'ini ıskartaya atar, 3'ünü elinde tutar.
Her oyuncuya birer KAZAN ve KATLET kartı verilir. İlk vardiya amiri belirlenir ve Vardiya Amiri taşını alır.

## Kazanma Koşulu
Silinen huy bölgesinde 3 Şeytan kartı olursa oyun **dayanışma sonu** ile biter: yaşayan bütün Melek oyuncular kazanır, Şeytan oyuncular kaybeder.
Silinen huy bölgesinde 3 Melek kartı olursa oyun **kargaşa sonu** ile devam eder ve oyunu yalnızca 1 kişi kazanabilir. Herkes gizli huy kartlarını açar. Tek Şeytan varsa oyun biter, o kazanır. Birden fazla Şeytan varsa herkes kartlarını kapatır, oyun devam eder; tek bir oyuncu hayatta kaldığında o Şeytansa kazanır, değilse herkes kaybeder. Kargaşa sonu sürerken silinen huy bölgesinde 4 Şeytan kartı olursa oyun dayanışma sonu ile biter.
✱ **Oyun tıkanırsa:** Halkada hedeflenebilecek canavar kalmazsa oyun biter. Silinen huy bölgesinde Şeytan kartı Melek kartından fazlaysa ya da eşitse dayanışma sonu, değilse kargaşa sonu kuralları uygulanır.
> Orijinalde canavarlar bitince ne olacağı yazmıyordu.

## Oyuncu ölümü
✱ Canı 0'a düşen oyuncu ölür: gizli huy kartlarını açar ve önünde açık bırakır, eşya kartlarını ıskartaya atar, KARAR kartlarını geri verir. Ölü oyuncu görev almaz, oylamaya ve hedeflemeye katılmaz.
✱ Bütün sayımlar **yaşayan** personele göre yapılır: oylamada tek/çift, KATLET için gereken hedef sayısı (yaşayan oyuncu sayısı) ve KAZAN için gereken hedef sayısı (yaşayan oyuncu sayısının 1 eksiği).
> Orijinalde hasar vardı ama can bitince ne olacağı yazmıyordu; kargaşa sonundaki “tek oyuncu hayatta kalınca” kuralı da buna dayanıyor.

## Oynanış
### 1. Vardiya Devri
Vardiya amiri, vardiyayı solundaki yaşayan oyuncuya devreder ve şu soruları cevaplar: Önceki vardiyada KAZAN mı KATLET mi seçildi? Hangi canavarlar hedeflendi? Hedefleme başarılı mıydı? Silinen huy bölgesine hangi huy gitti? Katledilen canavarın ölüm etkisi neydi?
Yeni vardiya amiri, yanında gizli huy kartı olmayan halka canavarlarının yanına kapalı birer gizli huy kartı koyar.
✱ Sonra yeni vardiya amiri kendisi için 1 gizli huy kartı çeker ve önüne kapalı koyar (en fazla 3 kuralı geçerli).
> Orijinalde “her tur ilerledikçe yeni bir kart elde edebilir” deniyordu ama nasıl elde edileceği yazmıyordu. Amirlik sırayla döndüğü için herkes eşit sayıda kart alır, taraflar oyun boyunca değişebilir.

### 2. Görev Dağılımı
Canavar sayısı personel sayısından fazlaysa vardiya amiri bir canavarı düşük öncelikli ilan eder (Düşük öncelik taşını üstüne koyar); o canavar seçilemez. Sonra vardiya amirinden başlayarak saat yönünde herkes ilgileneceği bir canavar seçer.
Canavar sayısı personel sayısından azsa canavar seçemeyen oyuncular 1 eşya kartı çeker ve 1 hasar alır.
Canavar seçen herkes o canavarın gizli huy kartına gizlice bakar (karta dokun → Gizlice bak).

### 3. Destekle
Vardiya amirinden başlayarak herkes seçtiği canavarın Destekle aksiyonunu yapar.
✱ **Eşya kullanımı:** Her oyuncu vardiya başına en fazla 1 eşya kartı oynar. Eşyalar kendi Destekle sıranda oynanır; KAZAN/KATLET kararını ya da hedeflemeyi etkileyen eşyalar (Sinir Yatıştırıcı Gaz, Teşvik Modülü, Lazer Tetikleyici, Enerji Zırhı, Tam Otomatik Hedefleyici, Şok Tabancası, Güçlendirilmiş Kafes) 4. aşamada, oylama açıldıktan sonra da oynanabilir.
> Orijinalde eşyaların ne zaman ve kaç tane oynanabileceği yazmıyordu.

### 4. Kazan ya da Katlet
Vardiya amiri ne yapılması gerektiğini sözlü olarak söyler. Sonra oylama yapılır:
Yaşayan personel sayısı tekse herkes, çiftse vardiya amiri hariç herkes elindeki KAZAN ya da KATLET kartlarından birini kapalı olarak Karar alanına koyar; hepsi birlikte açılır, çoğunluk kazanır. Kartlar sahiplerine döner.
Sonra vardiya amirinden başlayarak herkes hedef işaretini 1 canavara koyar; personel sayısı çiftse vardiya amiri aynı canavara 2 işaret koyar.
**Katlet:** Bir canavar yaşayan oyuncu sayısı kadar hedeflenirse katledilir. Gizli huy kartı açılır ve silinen huy bölgesine konur. Canavarın ölüm etkisi uygulanır.
**Kazan:** Bir canavar yaşayan oyuncu sayısının 1 eksiği kadar hedeflenirse gizli huy kartı kapalı olarak ıskartaya atılır; vardiya amiri 2 gizli huy kartı çeker, birini kapalı olarak canavarın yanına koyar, diğerini kapalı olarak ıskartaya atar.
**Kazan'da tam hedef:** Kazan seçildiyse ve bir canavar yaşayan oyuncu sayısı kadar hedeflendiyse önce o canavar için Kazan uygulanır, sonra bütün canavarların gizli huy kartları açılır. Melek çoğunluktaysa silinen huy bölgesine 1 Şeytan, değilse 1 Melek kartı konur (gizli huy destesinden uygun kart gelene kadar açık çekilir). Açılan kartlar kapalı olarak ıskartaya atılır ve canavarlara vardiya devrinde yenileri konur.
Hedef işaretleri sahiplerine döner, vardiya biter.

## Kart değişiklikleri
✱ **Plastik Mermi** 3 → 2 kart, **Nano Tedavi Botu** 1 → 2 kart (eşya destesi yine 19 kart).
> Hasar veren çok şey var (Plastik Mermi, Loopup Loop, Şekoranikor, canavarsız kalmak) ama iyileştiren tek kart vardı; ölüm kuralıyla birlikte oyuncular çok erken ölüyordu.
✱ **Güvenlik Görevlisi:** “Herkesten 1 fazla can” + “Vardiyada bir kez başka bir oyuncunun alacağı 1 hasarı onun yerine alabilirsin.”
> Diğer karakterlerin her turda kullanılan yetenekleri var; yalnızca +1 can bu kartı en zayıf seçenek yapıyordu.
✱ **Şekoranikor:** “Pasif, ben hedef alınamam” → “Pasif, KAZAN için hedef alınamam ve düşük öncelikli ilan edilemem.”
> Hiç hedef alınamayan bir canavar hiç ölemez; bu yüzden ölüm etkisi (“Tüm oyuncular 1 can kaybeder”) hiç çalışmıyordu ve yanındaki huy kartı oyun boyunca kilitli kalıyordu.
✱ **Alexandra Zeitsev** ve **Markov Nikov:** ölüm metnindeki “gizli karakter kartı” → “gizli huy kartı” (yazım düzeltmesi).

${MASADA}`;

  const HAZIR = { "kazan-katlet": kazanKatlet(false), "kazan-katlet-claude": kazanKatlet(true) };
  const api = { HAZIR };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZM_HAZIR = api;
})(typeof window !== "undefined" ? window : globalThis);
