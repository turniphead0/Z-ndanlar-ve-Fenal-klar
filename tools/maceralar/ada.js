// "Island of Trials" (Kreig Durham, CC BY 4.0) Türkçe çevirisini web/ext/maceralar/sinav-adasi.json olarak üretir.
// Çalıştır: node tools/maceralar/ada.js
// Yaratık değerleri 5e SRD'den (OGL 1.0a / CC BY 4.0). Haritalar, hazır karakterler ve çevirmen notları bu uygulama için eklendi.
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..", "..");
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "web/ext/veri-5e.js"), "utf8"), ctx);
const D = ctx.window.ZM5E;
const P = "ada-";
const T0 = 1793000000000;

/* ---------------- Metin sayfaları ---------------- */
const pages = [
`SINAV ADASI
Gizemli bir adaya sürüklenen bir grup maceracı, bilmedikleri bir sınavla yüzleşir.

Tek oturumluk bir D&D 5e macerası
Yazan: Kreig Durham · Türkçe çeviri: Zar Masası
Özgün sürüm: https://kreigd.itch.io/island-of-trials (CC BY 4.0)

GİRİŞ
Bu macera tek oturumda oynanmak üzere yazılmış bir ara maceradır. Büyük kampanya bölümleri arasında oynanabilir; dört adet 5. seviye oyuncu karakterine göre ayarlanmıştır. Grubun boyutuna, seviyesine ya da kampanyanın havasına göre ayrıntıları değiştirebilirsin.

Kılavuz üç bölümden oluşur: maceranın genel görünümü, maceranın nasıl yönetileceği ve maceradaki yaratıkların değerleri.

HARİTALAR
Özgün metin harita içermez. Yazar, 2-Minute Tabletop'un ücretsiz "Desert Island" haritasından esinlendiğini söyler. Bu uygulamada Harita bölümüne dört savaş haritası (orman patikası, kertenkele kampı, dağ yolu, zirve) ve bir ada genel haritası hazır olarak eklendi. Hepsi oyunculardan gizli başlar.

GENEL BAKIŞ
Oyun yöneticisi olarak maceranın her şeyini istediğin gibi değiştirebilirsin. Aşağıdaki özet maceranın yazıldığı hâlidir.

Hikâyenin özü
Grup bir yolculuktadır. Yolda bindikleri gemi ya da araba bir fırtınaya yakalanır. Karakterler kendilerine geldiklerinde ıssız bir adanın kumsalındadırlar. Küçük bir tanrı grubun yaptıklarını fark etmiş ve onları sınamaya karar vermiştir.

Adadan ayrılmak için grup adanın tehlikelerine göğüs germeli ve yakındaki dağın tepesindeki taş sunağı kullanmalıdır. Başarı, büyük kampanyada kullanılacak güçlü bir lütuf getirir. Başarısızlık ise "değersiz" bulunmanın getirdiği geçici bir lanettir.

Mekân
Macera uzak bir adada geçer. Hiçbir yetenek kontrolü buranın ne olduğunu ya da nerede olduğunu ortaya çıkaramaz; çünkü ada bir tanrının sınavıdır ve maddi düzlemde hiç var olmayabilir. Adanın bir ucunda kayalık bir dağ yükselir; dağın etrafında yukarı çıkan dar bir patika ve düzlükler vardır. Dağın yamacından inen bir şelale, tuhaf renkli bir havuza dökülür. Havuzdan çıkan bir dere adayı neredeyse ikiye böler.

Adanın içi sık bir ormanla kaplıdır. Adanın ortasında, dağın eteğinde geniş bir açıklık vardır. Dağın eteğinde birkaç mağara da bulunur. Arazi çimenli ve taşlıdır. Ağaçların kalın sarmaşıkları ve çalılar yüzünden patikanın dışında ilerlemek son derece zordur.`,

`BAŞLANGIÇ
Macera, oyuncu karakterleri gizemli adanın kumsalında uyandığında başlar. Sudan kısa bir mesafe sonra her yöne uzanan sık bir orman başlar. En dikkat çekici şey, adanın öbür ucunda ormanın üzerinde yükselen dağdır. Dağın etrafında tepeye doğru sarmal bir sırt var gibi görünür; doruk oldukça düzdür.

Kumda, yüksek suyun ulaştığı çizginin hemen üstünde, fırtınadan yıpranmış bir direğe çakılmış tahta bir tabela durur. Üzerinde şöyle yazar:

    "Dağın tepesindeki sunağa ulaşın; ama yol boyunca yaptığınız seçimlere dikkat edin."

Ormana birkaç patika girer. Oyuncular adanın çevresini dolaşmayı seçerse ormanın dağa kadar uzandığını, dağın ise her yanı dik yamaçlarla çevrili olduğu için kumsaldan tırmanılamadığını görürler.

MACERAYI YÖNETMEK
Oyuncular adanın içine doğru yola çıkınca adanın kendilerine düşman olduğunu çabucak anlarlar. Orman, adayı yaratan tanrının uyandırdığı ağaçlarla doludur; içinden geçtikleri her patika bu ağaçlarla bir karşılaşmaya dönüşebilir. Dağ yolunda bir taş dev dolaşır. Adanın ortasında öfkeli bir kertenkele halkı kabilesi yaşar. Son olarak dağın tepesindeki taş sunağı bir treant korur.

Maceracıları birçok tehdit bekler, ama fırsatlar da vardır. Aşağıda oyuncuların karşılaşabileceği olaylar sıralanmıştır. Bazılarının savaş dışında çözümleri vardır, bazıları ise sözle çözülemez. Oyuncuların bu karşılaşmalara ne zaman ve nasıl geleceği masadan masaya değişir; akışa uymaya hazır ol.

ORMANDA İLERLEMEK
Oyuncular ormanda istedikleri patikayı seçebilir. Hangi yolu seçerlerse seçsinler, ilerlemelerini durdurmaya kararlı Uyanmış Ağaçlarla karşılaşırlar.

Uyanmış Ağaç Pususu
Oyuncuların büyük olasılıkla ilk karşılaşacağı şey ağaçların kendisidir. Grubu adaya getiren tanrı bu ağaçlara sınırlı bir bilinç vermiştir ve tek amaçları yollarına çıkan herkese zarar vermektir. Oyuncular orman patikalarında ilerlerken her 30 ft için 1d6 at. 1-3 gelirse 3 Uyanmış Ağaç saldırır. Değerleri Yaratıklar bölümünde (ve Savaş sekmesindeki kartlarda).

Uyanmış Ağaçlar hareket edene kadar sıradan ağaçlardan ayırt edilemez, bu yüzden Algı kontrolleri onları ortaya çıkarmaz. Ancak Pasif Algısı 15 ya da daha yüksek olan karakterler pusuda şaşırmaz. Diğer bütün karakterler Şaşırmış sayılır.

Uyanmış Ağaçlarla dövüşürken karakterler onlarla konuşup anlaşamaz. Bilinçli olsalar da hâlâ ağaçtırlar; insansı yaratıkların düşünce ve duygularını pek anlamazlar.`,

`KERTENKELE HALKI KAMPI
Ormandan geçtikten sonra oyuncular büyük olasılıkla adanın ortasındaki kertenkele halkı kampına varır. Son sarmaşıkları ve çalıları da yarıp geçtiklerinde, adanın ortasındaki açıklığa dağılmış yarım düzine derme çatma çadır görürler.

Kampta on iki kertenkele halkı üyesi yaşar. Adada ne kadar zamandır yaşadıkları belirsizdir; onlara sorulduğunda süre hakkında hiçbir ipucu vermezler. Karakterler geldiğinde kertenkele halkı hararetli bir tartışmanın ortasındadır.

Kertenkele halkı yeni gelenleri fark eder ama hemen düşmanca davranmaz. İçlerinden biri, belki de lider, oyuncu karakterlerle Ejderce konuşmaya başlar. Ejderce konuşan ya da Dilleri Anlama (Comprehend Languages) gibi bir büyü kullanan karakterler onlarla anlaşabilir. Yoksa oyuncular başka bir iletişim yolu bulmalıdır (el kol hareketleri, toprağa resim çizmek gibi).

Elbette bazı oyuncular doğrudan kertenkele halkına saldırmayı seçebilir! Bu durumda değerleri kılavuzun sonundadır.

Kertenkele halkını canlandırmak
Ejderlerle uzaktan akraba olan kertenkele halkı her yönüyle sürüngendir. Sıcakkanlı insansıların tavırları ve düşünce biçimleri onlara çok yabancı gelir. Ayrıca her şeyi harfi harfine anlarlar; mecazlı ya da sembolik konuşmalar kafalarının üstünden geçer.

Kertenkele halkı doğası gereği düşmanca değildir ama maceracıları nasıl algıladıklarına göre tepki verir. Kaba ve tehditkâr davranışlar tehdit olarak algılanıp saldırıya yol açabilir. Öte yandan gereğinden fazla tehlikeli görünmek kertenkele halkının ormana kaçmasına neden olabilir. Fazla zayıf ve beceriksiz görünmek de saldırıyı tetikleyebilir.

Kabile lideri, oyuncular sorarsa dağdaki sunak hakkında bildiklerini de anlatır. Ona göre dağın tepesine çıkan herkese canlı bir ağaç canavarı saldırır. Ayrıca dağın yamacında yaşayan bir devden söz eder. Bu yüzden kabile artık dağa çıkmaz.

Kabileye yardım etmek
Oyuncular bir şekilde anlaşabilirse kabilenin lideri karakterlere kim olduklarını ve neden orada olduklarını sorar. Oyuncular lideri neler olup bittiğini anlatmaya ikna etmek için karşılaştırmalı bir Karizma kontrolünde (İkna ya da Gözdağı gibi uygun bir beceriyle) başarılı olmalıdır.

Kamptan birçok eşya kaybolmuştur ve kertenkele halkı birbirini suçlamaktadır. Kaybolan eşyaların çoğu alettir; kertenkele halkının duygusal değeri olan pek eşyası yoktur.

İşin aslı şudur: Bir Driyad, kertenkele halkını ormana çekmek için onların eşyalarını çalmaktadır. Kabile daha iyi barınaklar yapmak için son zamanlarda ormanı kesmeye başlamıştır; Driyad da ormanı korumak için kabile üyelerini teker teker avlamayı planlamaktadır. En son Driyad kertenkele halkından birine saldırıp onu yaralamıştır; ama yaralı üye kendisine kabileden birinin saldırdığını sanmaktadır.

Hırsızı bulmak
Hırsızın ya da saldırganın izi, saldırıya uğrayan kertenkele halkı üyesiyle konuşarak bulunabilir. Yaralandığında ormanın neresinde olduğunu anlatır. Oyuncular kaybolan eşyalardan birini bulmak için Nesne Bulma (Locate Object) gibi bir büyü de kullanabilir.`,

`DRİYADLA YÜZLEŞMEK
Driyadlar ormanın koruyucularıdır. Ormana o kadar bağlıdırlar ki yaşamları, doğdukları ağacın yaşam gücüne bağlıdır. Fey oldukları için mesafeli ve gizemlidirler.

Bu Driyad, kendisini ilk bulan karakteri büyülemeye çalışır (değer kartındaki Fey Büyüsü eylemi). Maceracıların orman için bir tehdit olup olmadığını öğrenmeye çalışır. Daha önce Uyanmış Ağaçlarla dövüşüp onları öldürdülerse tehdit olmadıklarına onu inandırmaları daha zor olur. Oyuncuların Driyadla konuşup ondan kertenkele halkına saldırmayı bırakmasını isteme şansı vardır.

Oyuncular ya kertenkele halkı için Driyadı öldürmeyi ya da adayı kertenkele halkından temizlemesi için ona yardım etmeyi seçebilir.

SEÇİMLER VE SONUÇLARI
Oyuncular kertenkele halkının tarafını tutup Driyadı öldürürse kertenkele halkı onlara katılıp taş sunağa tırmanırken yanlarında olur. Driyadı öldürdükleri için kertenkele halkı oyuncu karakterleri kendilerini her şeye karşı koruyabilecek kahramanlar olarak görür. Taş Deve ve Treant'a karşı maceracılarla birlikte savaşırlar.

Driyadın tarafını tutup kertenkele halkını öldüren oyuncular Driyaddan yardım görür. Taş Deve karşı onlarla birlikte savaşmaz ama maceracılar adına Treant'la konuşup onların sunağı kullanmaya layık olduğuna onu ikna eder.

ŞİFA HAVUZU
Kertenkele halkı kampının arkasında, dağın eteğinde, şelale mavi ışıldayan bir havuzda son bulur. ZK 10 Arcana (Gizli İlimler) kontrolünde başarılı olan oyuncular havuzun yaraları iyileştirdiğini anlar. Havuza bir kez dalmak büyük bir şifa iksiri etkisi yaratır ve 4d4 + 4 can verir. Bu iyileşme her karakter için bir kez kullanılabilir.

Burası grubun dinlenmesi için de iyi bir yerdir.

DAĞ YOLUNDA İLERLEMEK
Grup kertenkele halkı kampındaki işini bitirince sonunda taş sunağın bulunduğu dağa tırmanabilir. Dağ yolu şelalenin yanından başlar ve dağın etrafında sarmal biçimde yukarı doğru dolanır.

Taş Dev
Dağ yolunun yaklaşık yarısında bir mağarada bir Taş Dev yaşar. Gündüzleri yiyecek bulmak için yolda da dolaşır. Gördüğü her yaratığa açıkça düşmandır. Taş Kamuflajı özelliği sayesinde dağın kayalarına karışır ve fark edilmesi zordur. Onu fark etmek için Pasif Algı ZK 15 gerekir. Bir oyuncu yoldayken etkin olarak Algı zarı atarsa, bu zar Taş Devin Çeviklik (Gizlilik) zarıyla karşılaştırılır.

Karakterler devi o kendilerini görmeden fark ederse ZK 25 Çeviklik (Gizlilik) kontrolüyle yanından gizlice geçmeyi deneyebilirler. Hepsi başarılı olursa dağın tepesindeki taş sunağa ilerleyebilirler. Yoksa savaş başlar. Dev onları görmeden önce devi fark etmemiş olan her karakter savaşa Şaşırmış olarak başlar. Bütün karakterler devi görüp kendileri görülmediyse savaşa dev Şaşırmış olarak başlar.

Devin konuşarak ikna edilip edilemeyeceğine sen karar verirsin; ama zorluk çok yüksek olmalıdır.`,

`TAŞ SUNAK
Sonunda maceracılar dağın zirvesine ulaşır. Dağın tepesi düzleşir; alanın kenarını küçük bir koru çevreler. Zirvedeki açıklığın ortasında, aşınmış taştan bir kürsünün üzerinde köşeli bir taş sunak durur. Sunağa birkaç basamakla çıkılır.

Grup kürsüye yaklaştığında yakındaki ağaçlardan biri ayağa kalkar ve bir Treant olduğu ortaya çıkar.

Treant'la yüzleşmek
Treant'la karşılaşma, grubun adada yaptıklarına göre birkaç farklı yöne gidebilir.

Treant'la dost olmak
Maceracılar Driyadın yardımını kazandıysa Treant ortaya çıktığında Driyad da belirir. Driyad Treant'la konuşur, grubun adayı tehdit etmediğini ve sunağı kullanmak için geçebileceklerini savunarak onu ikna eder.

İstersen şunu da uygulayabilirsin: Oyuncular hiç Uyanmış Ağaç ya da Driyad öldürmediyse, Driyadla konuşmuş olsalar da olmasalar da Treant onlara sunağı kullanabileceklerini söyler. Adanın doğal düzenine tehdit olmadıklarını gösterdikleri için onlara saldırmaz.

Treant'la savaşmak
Treant karakterlerin geçmesine izin vermezse onunla savaşmaktan başka çareleri kalmaz. Driyad öldüğü için ya da onunla hiç karşılaşmadıkları (ve Uyanmış Ağaçları öldürdükleri) için Treant karakterlerin geçmeye layık olmadığını ilan eder. Oyuncular ne olursa olsun Treant'la savaşmayı da seçebilir. Treant'la savaşı yönetirken onun kendisine yardım etmek için ağaçları canlandırabildiğini unutma.

Treant teslim olmaz. Grup onunla savaşmak zorunda kalırsa sunağa ulaşmak için onu öldürmeli ya da etkisiz hâle getirmelidir.

TAŞ SUNAĞI KULLANMAK
Sonunda maceracılar taş sunağa ulaşır. Geniş, düz bir taş levha kare bir taş kaidenin üzerinde durur. Kaidenin çevresinde ve levhanın kenarında yaprak ve sarmaşık oymaları vardır. Sunağın ortasına Ortak dilde bir yazı kazınmıştır.

Sunağı kullanmak için bütün oyuncu karakterler ellerini yüzeyine koymalı ve biri yazıyı okumalıdır:

    "Sınavla yüzleştik; tanrıların hükmünü bekliyoruz."

Göz kamaştırıcı bir ışık karakterleri sarar ve bir ses sınavın hükmünü bildirir.

LÜTUF YA DA LANET
Oyuncular Driyada yardım ettiyse ve Treant'ı öldürmediyse bir lütuf alırlar. Bunun yerine Driyadı ya da Treant'ı öldürdülerse bir lanet alırlar.

Çevirmen notu: Özgün metinde lütfün ve lanetin içeriği boş bırakılmıştır; kampanyana uygun olanı sen seç. Örnek olarak: lütuf için her karakter bir sonraki uzun dinlenmeye kadar değil, kalıcı olarak orman yaratıklarıyla konuşabilir ya da günde bir kez bir zarı yeniden atabilir; lanet için karakterler bir sonraki önemli savaşta ilk saldırı zarlarını dezavantajla atar ya da hayvanlar onlardan ürker.

Sonuç ne olursa olsun lütuf ya da lanetin büyük kampanyaya taşınması amaçlanır. Oyuncular lanet aldıysa onu karakterleri kızdıracak değil, rol yapmayı zenginleştirecek eğlenceli bir şekilde işle.

SONUÇ
Hükmü aldıktan sonra maceracılar göz kamaştırıcı ışıkla bayılır ve bu maceradan önce tam olarak bulundukları yerde uyanırlar.

Yaşananlara nasıl tepki verecekler? Lütuf ya da lanetleriyle ne yapacaklar? Yollarına devam ederken değişmiş olarak mı çıkacaklar, yoksa bu yalnızca yoldaki küçük bir tümsek mi? Doğru bir cevap yok; adada doğru bir yol da yoktu.

İyi maceralar!`,

`YARATIKLAR
Bu bölümde maceradaki yaratıkların özeti var. Tam değerler Savaş sekmesindeki canavar kartlarındadır; kartlardan saldırı ve hasar zarlarını tek tıkla atabilirsin. Terimlerin tanımları için SRD'ye ya da Oyuncunun El Kitabı'na bak.

Uyanmış Ağaç (Awakened Tree) · Kocaman bitki, yönelimsiz
ZS 13 (doğal zırh) · CP 59 (7d12+14) · Hız 20 ft · Zorluk 2 (450 TP)
Ateşe karşı savunmasız; ezici ve delici hasara dirençli. Hareketsizken sıradan bir ağaçtan ayırt edilemez.
Darbe: +6 isabet, 10 ft erişim, 14 (3d6+4) ezici.

Driyad (Dryad) · Orta fey, tarafsız
ZS 11 (ağaç kabuğuyla 16) · CP 22 (5d8) · Hız 30 ft · Zorluk 1 (200 TP)
Doğuştan büyüler (ZK 14): istediğinde druidcraft; günde 3'er kez entangle, goodberry; günde 1'er kez barkskin, pass without trace, shillelagh.
Büyü direnci; hayvanlar ve bitkilerle konuşur; ağaç adımı (bir ağaçtan diğerine geçer).
Sopa: +2 isabet (shillelagh ile +6), 1d4 ezici (shillelagh ile 1d8+4).
Fey Büyüsü: 30 ft içinde gördüğü bir insansı ya da hayvan ZK 14 Bilgelik kurtarması yapar; başarısız olursa onu güvenilir bir dost sayar.

Kertenkele Halkı (Lizardfolk) · Orta insansı, tarafsız
ZS 15 (doğal zırh, kalkan) · CP 22 (4d8+4) · Hız 30 ft, yüzme 30 ft · Zorluk 1/2 (100 TP)
Nefesini 15 dakika tutabilir. Çoklu saldırı: farklı silahlarla iki yakın dövüş saldırısı.
Isırık, ağır sopa, cirit, dikenli kalkan: her biri +4 isabet, 1d6+2.

Taş Dev (Stone Giant) · Kocaman dev, tarafsız
ZS 17 (doğal zırh) · CP 126 (11d12+55) · Hız 40 ft · Zorluk 7 (2.900 TP)
Taş Kamuflajı: kayalık arazide saklanırken Çeviklik (Gizlilik) avantajlı.
Çoklu saldırı: iki dev sopa. Dev sopa: +9 isabet, 15 ft erişim, 19 (3d8+6) ezici.
Kaya: +9 isabet, 60/240 ft, 28 (4d10+6) ezici; hedef ZK 17 Güç kurtarmasında başarısız olursa yere düşer.
Tepki, kaya yakalama: kendisine atılan bir kayayı ZK 10 Çeviklik kurtarmasıyla yakalar.

Treant · Kocaman bitki, kaotik iyi
ZS 16 (doğal zırh) · CP 138 (12d12+60) · Hız 30 ft · Zorluk 9 (5.000 TP)
Ateşe karşı savunmasız; ezici ve delici hasara dirençli. Yapılara iki kat hasar verir.
Çoklu saldırı: iki darbe. Darbe: +10 isabet, 5 ft, 16 (3d6+6) ezici. Kaya: +10 isabet, 60/180 ft, 28 (4d10+6) ezici.
Ağaçları canlandırma (günde 1): 60 ft içindeki bir ya da iki ağacı canlandırır; bunlar Treant değerlerini kullanır ama ZEK ve KAR 1'dir, konuşamaz ve yalnızca darbe vurabilirler.`,

`ATIF VE LİSANS
"Sınav Adası", Kreig Durham'ın "Island of Trials" adlı macerasının Türkçe çevirisidir. Özgün eser Creative Commons Atıf 4.0 Uluslararası (CC BY 4.0) lisansıyla yayımlanmıştır: https://creativecommons.org/licenses/by/4.0/
Özgün sürüm: https://kreigd.itch.io/island-of-trials · Yazarın iletişim adresleri: kreig@kreigd.com, https://kreig.substack.com

Değişiklikler: Metin Türkçeye çevrildi ve uygulamanın senaryo bölümüne göre düzenlendi. Savaş haritaları, dört hazır karakter, canavar kartları, el notları ve çevirmen notları bu uygulama için eklendi. Özgün PDF'teki çizimler farklı (CC BY-NC-ND 3.0) lisanslı olduğu için dahil edilmedi.

Yaratık değerleri ve kural terimleri Wizards of the Coast'un 5e Sistem Referans Belgesi'nden (SRD 5.1) gelir; SRD 5.1, Creative Commons Atıf 4.0 lisansıyla yayımlanmıştır. Özgün macera bu malzemeyi Open Game License 1.0a kapsamında kullanır.

Dungeons & Dragons ve D&D, Wizards of the Coast'un ticari markalarıdır. Bu çeviri Wizards of the Coast ile bağlantılı değildir.`
];

/* ---------------- Senaryo yapısı ---------------- */
const scenario = {
  guide: {
    premise: "Grubun gemisi ya da arabası bir fırtınaya yakalanır, karakterler ıssız bir adada uyanır. Ada, grubu fark eden küçük bir tanrının sınavıdır. Ormanı tanrının uyandırdığı ağaçlar korur. Adanın ortasındaki kertenkele halkı kabilesi ormanı kesmeye başladığı için bir Driyad onları teker teker avlamakta ve eşyalarını çalarak ormana çekmektedir. Dağın yolunda bir taş dev, zirvedeki sunağın yanında bir Treant vardır.",
    hook: "Karakterler kumsalda uyanır. Bir direğe çakılı tabela der ki: \"Dağın tepesindeki sunağa ulaşın; ama yol boyunca yaptığınız seçimlere dikkat edin.\"",
    structure: "Kumsal → orman patikaları (Uyanmış Ağaç pususu) → kertenkele halkı kampı ve kayıp eşyalar gizemi → Driyad'la yüzleşme ve taraf seçme → Şifa Havuzu'nda dinlenme → dağ yolu ve Taş Dev → zirvede Treant ve taş sunak → lütuf ya da lanet.",
    secrets: ["Ada maddi düzlemde olmayabilir; hiçbir kontrol nerede olduğunu çözemez.", "Eşyaları çalan ve kabile üyesini yaralayan Driyad'dır; kabile birbirini suçluyor.", "Uyanmış Ağaç ya da Driyad öldüren grup Treant'ın gözünde tehdittir.", "Driyad'a yardım edip Treant'ı öldürmeyen grup lütuf alır; Driyad'ı ya da Treant'ı öldüren lanet alır."],
    pacing: ["4 adet 5. seviye karakter için yazıldı. Hazır karakterler Karakterler bölümünde.", "Ormanda her 30 ft için 1d6 at; 1-3'te 3 Uyanmış Ağaç saldırır. Oturum uzarsa pusuyu bir kez ile sınırla.", "Pasif Algısı 15 ve üstü olanlar pusuda şaşırmaz.", "Haritalar oyunculardan gizli başlar; sahne gelince Harita bölümünden göster."],
    ifStuck: ["Ejderce konuşan yoksa kertenkele halkıyla toprağa resim çizerek anlaşmalarını öner.", "Hırsızın izini sürmek için yaralı kertenkele halkı üyesi saldırıya uğradığı yeri gösterir.", "Grup Taş Dev'e karşı zorlanırsa Şifa Havuzu'na geri dönüp dinlenebilir.", "Treant'la savaş çok ağır gelirse Driyad son anda araya girip konuşabilir."],
    ending: "Sunağa dokunup yazıyı okuyan grup göz kamaştırıcı bir ışıkla bayılır ve maceradan önceki yerinde uyanır. Driyad'a yardım edip Treant'ı öldürmediyse bir lütuf, Driyad'ı ya da Treant'ı öldürdüyse bir lanetle döner. İçerik özgün metinde boş, Sayfalar sekmesinde 5. sayfada örnekler var."
  },
  modules: [
    { title: "Kumsalda uyanış", pages: [1, 2], summary: "Fırtınadan sonra karakterler ıssız bir adanın kumsalında uyanır. Tabela onları dağdaki sunağa yönlendirir.", goal: "Durumu anlamak ve ormana girmek.",
      scenes: [{ title: "Kumsal ve tabela", page: 2, note: "Tabelayı el notu olarak göster." }, { title: "Adanın çevresi", page: 2, note: "Kıyıdan dağa çıkılamaz; patikalar ormana girer." }], npcs: [], clues: ["Dağın etrafında sarmal bir sırt var.", "Ormana birkaç patika giriyor."], maps: ["Sınav Adası (genel)"], handouts: ["Kumsaldaki tabela"] },
    { title: "Orman patikaları", pages: [2, 2], summary: "Tanrının uyandırdığı ağaçlar patikada ilerleyen grubu pusuya düşürür. Ağaçlarla konuşulmaz.", goal: "Ormandan geçip adanın ortasına ulaşmak.",
      scenes: [{ title: "Uyanmış Ağaç pususu", page: 2, note: "Her 30 ft'te 1d6; 1-3'te 3 ağaç. Pasif Algı 15+ şaşırmaz." }], npcs: ["Uyanmış Ağaç"], clues: ["Öldürülen her ağaç Driyad ve Treant'ın gözünde grubun aleyhine sayılır."], maps: ["Orman patikası"], handouts: [] },
    { title: "Kertenkele halkı kampı", pages: [3, 3], summary: "Adanın ortasında on iki kertenkele halkı tartışmaktadır: eşyaları kayboluyor ve birbirlerini suçluyorlar. Lider Ejderce konuşur.", goal: "Kabileyle anlaşmak ve kayıp eşyaların gizemini öğrenmek.",
      scenes: [{ title: "Hararetli tartışma", page: 3, note: "Ne fazla tehditkâr ne fazla zayıf görünmeliler." }, { title: "Liderin anlattıkları", page: 3, note: "Karşılaştırmalı Karizma kontrolü; dağdaki dev ve ağaç canavarı." }, { title: "Hırsızın izi", page: 3, note: "Yaralı üye saldırının yerini gösterir; Nesne Bulma da işe yarar." }],
      npcs: ["Kabile lideri", "Yaralı kertenkele halkı üyesi"], clues: ["Kaybolanlar çoğunlukla alet.", "Yaralı üye kendisine kabileden birinin saldırdığını sanıyor.", "Kabile son zamanlarda ormanı kesiyor."], maps: ["Kertenkele halkı kampı"], handouts: [] },
    { title: "Driyad ve seçim", pages: [4, 4], summary: "Ormanı koruyan Driyad ilk gelen karakteri büyülemeye çalışır. Grup ya kabile için Driyad'ı öldürür ya da Driyad'a yardım eder.", goal: "Taraf seçmek.",
      scenes: [{ title: "Fey Büyüsü", page: 4, note: "ZK 14 Bilgelik kurtarması." }, { title: "Pazarlık", page: 4, note: "Ağaç öldürdülerse ikna etmek zor." }], npcs: ["Driyad"], clues: ["Kabileyle olursa: kabile Taş Dev ve Treant'a karşı savaşır.", "Driyad'la olursa: Driyad Treant'ı ikna eder."], maps: ["Orman patikası"], handouts: [] },
    { title: "Şifa Havuzu", pages: [4, 4], summary: "Kampın arkasındaki mavi ışıldayan havuz her karaktere bir kez 4d4+4 can verir. Dinlenmek için iyi bir yer.", goal: "Toparlanmak.", scenes: [{ title: "Havuz", page: 4, note: "ZK 10 Arcana ile anlaşılır." }], npcs: [], clues: [], maps: ["Kertenkele halkı kampı"], handouts: [] },
    { title: "Dağ yolu ve Taş Dev", pages: [4, 4], summary: "Sarmal dağ yolunun ortasındaki mağarada yaşayan Taş Dev kayalara karışır ve gördüğüne saldırır.", goal: "Devi atlatmak ya da yenmek.",
      scenes: [{ title: "Kayaların arasında", page: 4, note: "Pasif Algı ZK 15; etkin Algı devin Gizliliğine karşı." }, { title: "Gizlice geçmek", page: 4, note: "Herkes ZK 25 Çeviklik (Gizlilik)." }], npcs: ["Taş Dev"], clues: [], maps: ["Dağ yolu"], handouts: [] },
    { title: "Zirve: Treant ve taş sunak", pages: [5, 5], summary: "Zirvedeki koruda bir ağaç kalkar: Treant. Grubun adadaki seçimlerine göre dost olur ya da savaşır. Sunak yazısı okununca hüküm verilir.", goal: "Sunağa ulaşmak ve hükmü almak.",
      scenes: [{ title: "Treant uyanır", page: 5, note: "Driyad yardımdaysa araya girer." }, { title: "Sunak", page: 5, note: "Herkes elini koyar, biri yazıyı okur." }, { title: "Lütuf ya da lanet", page: 5, note: "İçeriği sen seç; örnekler sayfa 5'te." }], npcs: ["Treant", "Driyad"], clues: [], maps: ["Zirve ve taş sunak"], handouts: ["Sunaktaki yazı"] }
  ],
  npcs: [
    { name: "Kabile lideri", role: "Kertenkele halkı lideri", page: 3, description: "Ejderce konuşur, her şeyi harfi harfine anlar.", motivation: "Kabileyi korumak, hırsızı bulmak.", secret: "Dağın tepesine kimse çıkmıyor; dev ve ağaç canavarından korkuyorlar.", card: "lizard" },
    { name: "Yaralı kertenkele halkı üyesi", role: "Kabile üyesi", page: 3, description: "Ormanda yaralandı.", motivation: "Saldırganı bulmak.", secret: "Ona Driyad saldırdı ama kabileden birini suçluyor.", card: "lizard" },
    { name: "Driyad", role: "Ormanın koruyucusu", page: 4, description: "Mesafeli, gizemli bir fey. Yaşamı bir ağaca bağlı.", motivation: "Ormanı kertenkele halkının baltalarından korumak.", secret: "Eşyaları çalan ve kabile üyesini yaralayan o.", card: "dryad" },
    { name: "Taş Dev", role: "Dağ yolunun sakini", page: 4, description: "Kayalara karışan, gördüğüne saldıran bir dev.", motivation: "Yiyecek bulmak, mağarasını korumak.", secret: "", card: "giant" },
    { name: "Treant", role: "Sunağın bekçisi", page: 5, description: "Zirvedeki korunun içinde bekleyen dev bir ağaç varlık.", motivation: "Adanın doğal düzenini korumak.", secret: "Ağaç ya da Driyad öldürmeyen gruba yol verir.", card: "treant" }
  ],
  handouts: [
    { title: "Kumsaldaki tabela", page: 2, description: "Fırtınadan yıpranmış direkteki tahta tabela.", text: "Dağın tepesindeki sunağa ulaşın; ama yol boyunca yaptığınız seçimlere dikkat edin." },
    { title: "Sunaktaki yazı", page: 5, description: "Sunağın ortasına Ortak dilde kazınmış yazı.", text: "Sınavla yüzleştik; tanrıların hükmünü bekliyoruz." }
  ],
  maps: [
    { title: "Sınav Adası (genel)", page: 1, description: "Kumsal, orman, kamp, havuz, dağ yolu ve zirve. Her kare yaklaşık 50 ft.", key: "ada" },
    { title: "Orman patikası", page: 2, description: "Uyanmış Ağaç pususu ve Driyad karşılaşması için.", key: "orman" },
    { title: "Kertenkele halkı kampı", page: 3, description: "Çadırlar, kesilmiş ağaçlar, şelale ve Şifa Havuzu.", key: "kamp" },
    { title: "Dağ yolu", page: 4, description: "Dar sarmal patika, uçurum kenarı ve devin mağarası.", key: "dag" },
    { title: "Zirve ve taş sunak", page: 5, description: "Koru, taş kürsü ve sunak.", key: "zirve" }
  ],
  clues: []
};

/* ---------------- Canavar kartları (SRD 5.1) ---------------- */
const MON = {
  tree: { name: "Uyanmış Ağaç", meta: "Kocaman bitki, yönelimsiz", ac: 13, acNote: "(doğal zırh)", hpMax: 59, hpDice: "7d12+14", speed: "20 ft", cr: "2", size: 3,
    ab: { str: 19, dex: 6, con: 15, int: 10, wis: 10, cha: 7 }, saves: "", skills: "", senses: "Pasif Algı 10", languages: "Yaratıcısının bildiği bir dil",
    traits: "Hasar savunmasızlığı: ateş\nHasar direnci: ezici, delici\nSahte Görünüm: Hareketsizken sıradan bir ağaçtan ayırt edilemez.",
    attacks: [{ name: "Darbe (10 ft)", bonus: "+6", dmg: "3d6+4 ezici" }], notes: "Ormanda her 30 ft için 1d6: 1-3'te üç tane saldırır. Pasif Algı 15+ olanlar şaşırmaz. Konuşarak durdurulamazlar." },
  dryad: { name: "Driyad", meta: "Orta fey, tarafsız", ac: 11, acNote: "(ağaç kabuğuyla 16)", hpMax: 22, hpDice: "5d8", speed: "30 ft", cr: "1", size: 1,
    ab: { str: 10, dex: 12, con: 11, int: 14, wis: 15, cha: 18 }, saves: "", skills: "Algı +4, Gizlilik +5", senses: "Karanlıkta görüş 60 ft, Pasif Algı 14", languages: "Elfçe, Sylvan",
    traits: "Doğuştan Büyü (KAR, ZK 14): istediğinde druidcraft · günde 3'er: entangle, goodberry · günde 1'er: barkskin, pass without trace, shillelagh\nBüyü Direnci: büyülere karşı kurtarmalarda avantaj.\nHayvan ve Bitkilerle Konuşma.\nAğaç Adımı: hareketinin 5 ft'ini harcayıp bir ağaçtan girer, 60 ft içindeki başka bir ağaçtan çıkar.\nFey Büyüsü: 30 ft içinde gördüğü bir insansı ya da hayvan ZK 14 BİL kurtarması yapar; başarısızsa büyülenir ve driyadı güvenilir dost sayar (24 saat; zarar görünce yeniden kurtarma).",
    attacks: [{ name: "Sopa", bonus: "+2", dmg: "1d4 ezici" }, { name: "Sopa (shillelagh)", bonus: "+6", dmg: "1d8+4 ezici" }],
    notes: "Kabilenin eşyalarını o çalıyor ve bir üyeyi o yaraladı; ormanı korumak istiyor. Grup ağaç öldürdüyse ikna etmek zor." },
  lizard: { name: "Kertenkele Halkı", meta: "Orta insansı (kertenkele halkı), tarafsız", ac: 15, acNote: "(doğal zırh, kalkan)", hpMax: 22, hpDice: "4d8+4", speed: "30 ft, yüzme 30 ft", cr: "1/2", size: 1,
    ab: { str: 15, dex: 10, con: 13, int: 7, wis: 12, cha: 7 }, saves: "", skills: "Algı +3, Gizlilik +4, Hayatta Kalma +5", senses: "Pasif Algı 13", languages: "Ejderce",
    traits: "Nefes Tutma: 15 dakika.\nÇoklu Saldırı: her biri farklı silahla iki yakın dövüş saldırısı.",
    attacks: [{ name: "Isırık", bonus: "+4", dmg: "1d6+2 delici" }, { name: "Ağır sopa", bonus: "+4", dmg: "1d6+2 ezici" }, { name: "Cirit (30/120 ft)", bonus: "+4", dmg: "1d6+2 delici" }, { name: "Dikenli kalkan", bonus: "+4", dmg: "1d6+2 delici" }],
    notes: "Kampta 12 kişiler. Her şeyi harfi harfine anlarlar. Kaba ya da çok zayıf görünen gruba saldırır, çok güçlü görünenden kaçarlar." },
  giant: { name: "Taş Dev", meta: "Kocaman dev, tarafsız", ac: 17, acNote: "(doğal zırh)", hpMax: 126, hpDice: "11d12+55", speed: "40 ft", cr: "7", size: 3,
    ab: { str: 23, dex: 15, con: 20, int: 10, wis: 12, cha: 9 }, saves: "ÇEV +5, DAY +8, BİL +4", skills: "Atletizm +12, Algı +4", senses: "Karanlıkta görüş 60 ft, Pasif Algı 14", languages: "Devce",
    traits: "Taş Kamuflajı: kayalık arazide saklanırken Çeviklik (Gizlilik) avantajlı.\nÇoklu Saldırı: iki dev sopa saldırısı.\nTepki, Kaya Yakalama: kendisine atılan kayayı ZK 10 ÇEV kurtarmasıyla yakalar, hasar almaz.",
    attacks: [{ name: "Dev sopa (15 ft)", bonus: "+9", dmg: "3d8+6 ezici" }, { name: "Kaya (60/240 ft, ZK 17 GÜÇ yoksa yere düşer)", bonus: "+9", dmg: "4d10+6 ezici" }],
    notes: "Onu görmek için Pasif Algı 15. Yanından gizlice geçmek: herkes ZK 25 ÇEV (Gizlilik)." },
  treant: { name: "Treant", meta: "Kocaman bitki, kaotik iyi", ac: 16, acNote: "(doğal zırh)", hpMax: 138, hpDice: "12d12+60", speed: "30 ft", cr: "9", size: 3,
    ab: { str: 23, dex: 8, con: 21, int: 12, wis: 16, cha: 12 }, saves: "", skills: "", senses: "Pasif Algı 13", languages: "Ortak, Druidçe, Elfçe, Sylvan",
    traits: "Hasar savunmasızlığı: ateş\nHasar direnci: ezici, delici\nSahte Görünüm: hareketsizken sıradan bir ağaçtan ayırt edilemez.\nKuşatma Canavarı: nesne ve yapılara iki kat hasar.\nÇoklu Saldırı: iki darbe.\nAğaçları Canlandırma (günde 1): 60 ft içindeki bir ya da iki ağacı canlandırır (Canlandırılmış Ağaç kartı). 1 gün ya da treant ölene/120 ft'ten uzaklaşana kadar sürer.",
    attacks: [{ name: "Darbe", bonus: "+10", dmg: "3d6+6 ezici" }, { name: "Kaya (60/180 ft)", bonus: "+10", dmg: "4d10+6 ezici" }],
    notes: "Teslim olmaz. Ağaç ya da Driyad öldürmeyen gruba yol verebilir; Driyad yardımdaysa araya girer." },
  animtree: { name: "Canlandırılmış Ağaç", meta: "Kocaman bitki (Treant'ın canlandırdığı)", ac: 16, acNote: "(doğal zırh)", hpMax: 138, hpDice: "12d12+60", speed: "30 ft", cr: "—", size: 3,
    ab: { str: 23, dex: 8, con: 21, int: 1, wis: 16, cha: 1 }, saves: "", skills: "", senses: "Pasif Algı 13", languages: "—",
    traits: "Hasar savunmasızlığı: ateş\nHasar direnci: ezici, delici\nSahte Görünüm. Kuşatma Canavarı.\nKonuşamaz; yalnızca darbe vurur.",
    attacks: [{ name: "Darbe", bonus: "+10", dmg: "3d6+6 ezici" }], notes: "Treant'ın Ağaçları Canlandırma eylemiyle gelir." }
};
const monsters = {};
for (const [k, m] of Object.entries(MON)) monsters[P + "mo-" + k] = { id: P + "mo-" + k, ...m, updated: T0 };
scenario.npcs = scenario.npcs.map((n, i) => { const { card, ...rest } = n; return { id: P + "np" + i, ...rest, cardId: P + "mo-" + card }; });

/* ---------------- Haritalar ---------------- */
// Satırlarla çizilen ızgara: . boş, # duvar, D kapı, ~ su, , zorlu arazi, T ağaç, O çukur, = merdiven, ^ tuzak
const KEY = { "#": "wall", "D": "door", "~": "water", ",": "rough", "T": "tree", "O": "pit", "=": "stairs", "^": "trap" };
function grid(rows) { const cells = {}; rows.forEach((r, y) => [...r].forEach((ch, x) => { if (KEY[ch]) cells[`${x},${y}`] = KEY[ch]; })); return { cols: Math.max(...rows.map(r => r.length)), rows: rows.length, cells }; }
let tokN = 0;
const tok = (label, x, y, mon, color = "#b3402e", size) => { const id = "t" + (++tokN); const m = MON[mon]; return [id, { id, label, color, x, y, size: size || m.size, hp: m.hpMax, hpMax: m.hpMax, monsterId: P + "mo-" + mon }]; };
const lab = (text, x, y) => { const id = "lb" + (++tokN); return [id, { id, x, y, text, removed: false }]; };
function map(key, name, rows, tokens = [], labels = []) {
  const g = grid(rows);
  return { id: P + "map-" + key, name, ...g, bg: "", tokens: Object.fromEntries(tokens), labels: Object.fromEntries(labels), fog: {}, fogOn: false, hidden: true, updated: T0 };
}
const maps = {};
const add = m => maps[m.id] = m;
add(map("ada", "Sınav Adası (genel)", [
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~,,,,,,,,,~~~~~~~~~~",
  "~~~~~~,,,,#####,,,,,~~~~~~~~",
  "~~~~,,,,,##=..##,,,,,,~~~~~~",
  "~~~,,,,,##=.##.##,,,,,,~~~~~",
  "~~,,TTTT#=.##..=#TTTT,,,~~~~",
  "~~,TTTTT#.##~~.##TTTTT,,~~~~",
  "~,TTTTTTT##..~##TTTTTTT,,~~~",
  "~,TTT.TTTTT..~TTTTT.TTTT,~~~",
  "~,TT..TTTT....~.TTT..TTT,~~~",
  "~,TT.TTTT.......~TTT.TTT,~~~",
  "~,TT.TTT........~~TTT.TT,~~~",
  "~,TTT.TTTT.....TT~~TT.TT,~~~",
  "~~,TTT.TTTTTTTTTT~~~T.T,~~~~",
  "~~,,TTT..TTTTTTTTT~~..,,~~~~",
  "~~~,,,TTT...TTT..TT~~,,~~~~~",
  "~~~~,,,,,,...,,,,,,,~~~~~~~~",
  "~~~~~~,,,,,,,,,,,,~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
], [], [lab("Zirve ve sunak", 11, 3), lab("Dağ yolu", 15, 5), lab("Şelale", 13, 7), lab("Kertenkele kampı", 9, 10), lab("Şifa Havuzu", 16, 10), lab("Kumsal (başlangıç)", 11, 16), lab("Tabela", 11, 15)]));
add(map("orman", "Orman patikası", [
  "TTTTTTTTTTTTTTTTTTTTTTTT",
  "TTT,,TTTTTTTT,,TTTTTTTTT",
  "TT,,,,TTTTT,,,,,TTTT,TTT",
  "T,,.....,,,,..,,,,,,,,TT",
  "T,......................",
  "........................",
  "........................",
  "T,,.......,,,......,,,,T",
  "TT,,,,T..,,TTT,,..,,TTTT",
  "TTTTTTTT,,TTTTTTT,,TTTTT",
  "TTTTT,,TTTTTTTTTTTTTTTTT",
  "TTTTTTTTTTTTTTTTTTTTTTTT"
], [tok("Uyanmış Ağaç 1", 7, 2, "tree", "#2e6b3a"), tok("Uyanmış Ağaç 2", 13, 7, "tree", "#2e6b3a"), tok("Uyanmış Ağaç 3", 18, 2, "tree", "#2e6b3a")], [lab("Patika", 2, 5), lab("Adanın ortasına", 19, 5)]));
add(map("kamp", "Kertenkele halkı kampı", [
  "########~~~~~~###########",
  "#######~~~~~~~~##########",
  "TT####,,~~~~~~~,,####TTTT",
  "TT,,,,,,,~~~~~,,,,,,,,TTT",
  "T,,........~.........,,TT",
  "T,..###......###.......TT",
  "T,..#.D......#.D...,...TT",
  "T...###......###...,....T",
  "T.......................T",
  "T..###....###.....###...T",
  "T..#.D....#.D.....#.D...T",
  "T..###....###.....###...T",
  "T.....,,.......,,.......T",
  "TT,,,TTT,.....,TTT,,,,TTT",
  "TTTTTTTTT.....TTTTTTTTTTT",
  "TTTTTTTTT.....TTTTTTTTTTT"
], [tok("Kabile lideri", 11, 8, "lizard", "#4a7a3a"), tok("Kertenkele 2", 8, 7, "lizard", "#4a7a3a"), tok("Kertenkele 3", 14, 8, "lizard", "#4a7a3a"), tok("Yaralı kertenkele", 6, 10, "lizard", "#4a7a3a"),
  tok("Kertenkele 5", 17, 6, "lizard", "#4a7a3a"), tok("Kertenkele 6", 20, 8, "lizard", "#4a7a3a")], [lab("Şifa Havuzu", 10, 2), lab("Şelale", 10, 0), lab("Dağ yolu başlangıcı", 16, 3), lab("Kesilmiş ağaçlar", 19, 7), lab("Ormana", 10, 14)]));
add(map("dag", "Dağ yolu", [
  "#######################",
  "#######################",
  "####=......,....,...###",
  "####....,........,..###",
  "OOOO..,.....###.......#",
  "OOOOO.......#.#....,..#",
  "OOOOOO.....##D##......#",
  "OOOOOOO..,...........=#",
  "OOOOOOOO..........,..##",
  "OOOOOOOOOO.....,....###",
  "OOOOOOOOOOOO=.......###",
  "OOOOOOOOOOOOOOO#######"
], [tok("Taş Dev", 13, 4, "giant", "#6b6258")], [lab("Devin mağarası", 13, 5), lab("Uçurum", 2, 8), lab("Zirveye", 4, 2), lab("Şelaleden", 12, 10)]));
add(map("zirve", "Zirve ve taş sunak", [
  "OOOOOOOOOOOOOOOOOOOO",
  "OOTTTTTTTTTTTTTTTTOO",
  "OTT..............TTO",
  "OT................TO",
  "OT......####......TO",
  "OT.....#....#.....TO",
  "OT.....#.##.#.....TO",
  "OT.....#.##.#.....TO",
  "OT.....#....#.....TO",
  "OT......#==#......TO",
  "OT................TO",
  "OTT..............TTO",
  "OOTTTTTTT..TTTTTTTOO",
  "OOOOOOOO=..=OOOOOOOO"
], [tok("Treant", 16, 5, "treant", "#3f6b2e")], [lab("Taş sunak", 9, 6), lab("Basamaklar", 9, 9), lab("Dağ yolundan", 9, 13)]));
// Haritaları senaryo listesine bağla
const mapIdByKey = Object.fromEntries(Object.keys(maps).map(id => [id.replace(P + "map-", ""), id]));
scenario.maps = scenario.maps.map((m, i) => { const { key, ...rest } = m; return { id: P + "mp" + i, ...rest, mapId: mapIdByKey[key] }; });
scenario.modules = scenario.modules.map((m, i) => ({ id: P + "md" + i, ...m }));
scenario.handouts = scenario.handouts.map((h, i) => ({ id: P + "ho" + i, ...h }));

/* ---------------- Hazır karakterler (5. seviye) ---------------- */
const sp = keys => keys.map(k => { const s = D.SPELLS.find(x => x.k === k); if (!s) throw new Error("büyü yok: " + k); return { ...s, id: P + "sp-" + k, prep: !!s.lvl }; });
const slots = arr => Array.from({ length: 9 }, (_, i) => ({ max: arr[i] || 0, used: 0 }));
const base = { hpTemp: 0, ds: { s: 0, f: 0 }, insp: false, exhaustion: 0, conditions: [], xp: 6500, conc: "", align: "", player: "Hazır karakter", updated: T0 };
const chars = {};
const pc = c => chars[P + "c-" + c.key] = (({ key, ...r }) => ({ id: P + "c-" + key, ...base, slots: slots([]), book: [], spellAb: "", spells: "", ...r }))(c);
pc({ key: "savasci", name: "Doruk Demirkol", cls: "Savaşçı (Fighter)", clsKey: "fighter", level: 5, race: "İnsan", bg: "Asker (Soldier)", align: "Yasal İyi",
  ab: { str: 18, dex: 14, con: 15, int: 11, wis: 13, cha: 9 }, saves: { str: true, con: true }, skills: { athletics: 1, perception: 1, intimidation: 1, survival: 1 },
  ac: 18, initBonus: 0, speed: "30 ft", hpMax: 44, hp: 44, hitDice: "5d10",
  attacks: [{ name: "Uzun kılıç (tek el, Düello)", bonus: "+7", dmg: "1d8+6 kesici" }, { name: "Cirit (30/120 ft)", bonus: "+7", dmg: "1d6+4 delici" }],
  features: "Savaş Stili: Düello (tek elde yakın dövüş silahıyla +2 hasar)\nİkinci Soluk (kısa dinlenmede 1): bonus eylemle 1d10+5 can\nEylem Atağı (kısa dinlenmede 1): bir ek eylem\nŞampiyon: 19-20'de kritik vuruş\nEk Saldırı: Saldırı eyleminde iki saldırı\nYetenek artışı (4. seviye): GÜÇ +2",
  inventory: "Uzun kılıç, kalkan\nZincir zırh\n4 cirit\nKaşif çantası\nRütbe nişanı", coins: { cp: 0, sp: 5, ep: 0, gp: 25, pp: 0 } });
pc({ key: "rahip", name: "Bora Taşyürek", cls: "Rahip (Cleric) — Yaşam", clsKey: "cleric", level: 5, race: "Cüce (Tepe Cücesi)", bg: "Yardımcı (Acolyte)", align: "Tarafsız İyi",
  ab: { str: 13, dex: 10, con: 16, int: 8, wis: 18, cha: 12 }, saves: { wis: true, cha: true }, skills: { insight: 1, medicine: 1, religion: 1, history: 1 },
  ac: 18, initBonus: 0, speed: "25 ft", hpMax: 48, hp: 48, hitDice: "5d8",
  attacks: [{ name: "Gürz", bonus: "+4", dmg: "1d6+1 ezici" }, { name: "Hafif arbalet (80/320 ft)", bonus: "+3", dmg: "1d8 delici" }],
  spellAb: "wis", slots: slots([4, 3, 2]),
  book: sp(["guidance", "light", "sacred-flame", "spare-the-dying", "bless", "cure-wounds", "healing-word", "guiding-bolt", "shield-of-faith", "lesser-restoration", "spiritual-weapon", "aid", "revivify", "spirit-guardians", "mass-healing-word"]),
  features: "Yaşam Alanı: Bless, Cure Wounds, Lesser Restoration, Spiritual Weapon, Beacon of Hope, Revivify hep hazır sayılır\nİyileştirme Müridi: iyileştirme büyüsü 2 + büyü seviyesi kadar fazla iyileştirir\nKutsal Kanal (kısa dinlenmede 1): Ölümsüzleri Kovma ya da Yaşamı Koru (30 ft içinde toplam 25 can dağıt)\nÖlümsüz Yok Etme (ZD 1/2)\nCüce: karanlıkta görüş 60 ft, zehre direnç, her seviyede +1 can\nYetenek artışı (4. seviye): BİL +2",
  inventory: "Gürz, kalkan\nZincir zırh\nHafif arbalet ve 20 cıvata\nKutsal sembol\nRahip çantası", coins: { cp: 0, sp: 10, ep: 0, gp: 15, pp: 0 } });
pc({ key: "haydut", name: "Minik Çalıkuşu", cls: "Haydut (Rogue)", clsKey: "rogue", level: 5, race: "Buçukluk (Hafifayak)", bg: "Suçlu (Criminal)", align: "Kaotik İyi",
  ab: { str: 8, dex: 18, con: 15, int: 12, wis: 13, cha: 11 }, saves: { dex: true, int: true }, skills: { stealth: 2, perception: 2, acrobatics: 1, sleight: 1, deception: 1, investigation: 1 },
  ac: 15, initBonus: 0, speed: "25 ft", hpMax: 38, hp: 38, hitDice: "5d8",
  attacks: [{ name: "Kısa kılıç", bonus: "+7", dmg: "1d6+4 delici" }, { name: "Kısa yay (80/320 ft)", bonus: "+7", dmg: "1d6+4 delici" }, { name: "Sinsi saldırı (turda 1)", bonus: "", dmg: "3d6" }],
  features: "Sinsi Saldırı 3d6: avantajlıyken ya da hedefin 5 ft yanında bir müttefik varken\nUzmanlık: Gizlilik, Algı, hırsız aletleri\nKurnaz Eylem: bonus eylemle Atıl, Geri Çekil ya da Saklan\nHırsız: Hızlı Eller, Tırmanma ustalığı\nTekinsiz Kaçınma: tepkiyle gelen saldırının hasarını yarıya indir\nBuçukluk: Şanslı (1'i yeniden at), Cesur, çevik\nYetenek artışı (4. seviye): ÇEV +1, DAY +1",
  inventory: "Kısa kılıç\nKısa yay ve 20 ok\nKabarık deri zırh\nHırsız aletleri\nHırsız çantası\nKanca ve ip", coins: { cp: 0, sp: 0, ep: 0, gp: 40, pp: 0 } });
pc({ key: "buyucu", name: "Ilgın Aysuyu", cls: "Büyücü (Wizard)", clsKey: "wizard", level: 5, race: "Elf (Yüksek Elf)", bg: "Bilgin (Sage)", align: "Tarafsız",
  ab: { str: 8, dex: 16, con: 13, int: 18, wis: 12, cha: 10 }, saves: { int: true, wis: true }, skills: { arcana: 1, history: 1, investigation: 1, perception: 1 },
  ac: 13, initBonus: 0, speed: "30 ft", hpMax: 27, hp: 27, hitDice: "5d6",
  attacks: [{ name: "Hançer", bonus: "+6", dmg: "1d4+3 delici" }],
  spellAb: "int", slots: slots([4, 3, 2]),
  book: sp(["fire-bolt", "mage-hand", "light", "ray-of-frost", "magic-missile", "shield", "mage-armor", "sleep", "detect-magic", "thunderwave", "misty-step", "scorching-ray", "web", "fireball", "counterspell"]),
  features: "Büyücülük (Zekâ): büyü ZK 15, büyü saldırısı +7\nGizli İlimlerde Toparlanma: kısa dinlenmede toplam 3 seviyelik yuva geri al\nGiriş Okulu: Çağırma (Evocation), Büyüleri Şekillendirme: alan büyülerinden müttefikleri koru\nElf: karanlıkta görüş 60 ft, Fey Soyu, Trans\nYetenek artışı (4. seviye): ZEK +2\nMage Armor yapınca ZS 16 olur.",
  inventory: "Hançer\nBüyü kitabı\nBüyü odağı (asa)\nBilgin çantası\nMürekkep ve tüy kalem", coins: { cp: 0, sp: 0, ep: 0, gp: 10, pp: 0 } });

/* ---------------- DM notları ---------------- */
const dmnotes = {
  [P + "dn-hazirlik"]: { id: P + "dn-hazirlik", title: "Sınav Adası: oturum hazırlığı", pinned: true, updated: T0,
    body: "1. Kılavuz sekmesini ve Sayfalar sekmesini bir kez baştan sona oku.\n2. Oyunculara Karakterler bölümünden hazır karakterlerden birini sahiplenmelerini söyle (ya da kendi 5. seviye karakterlerini getirsinler).\n3. Kumsaldaki tabelayı Senaryo > El notları'ndan göster.\n4. Haritalar oyunculardan gizli; sahnesi gelince Harita bölümünde aç.\n5. Uyanmış Ağaç pususu için her 30 ft'te 1d6 at (1-3 pusu).\n6. Kimin Driyad'ı, kimin ağacı öldürdüğünü not al: Treant ve hüküm buna göre değişir.\n7. Lütuf ve lanetin içeriğini önceden seç (Sayfalar sekmesi, 5. sayfa)." },
  [P + "dn-secim"]: { id: P + "dn-secim", title: "Sınav Adası: seçimlerin takibi", pinned: false, updated: T0,
    body: "Öldürülen Uyanmış Ağaç: 0\nDriyad: yaşıyor / öldü\nKabile: dost / düşman / öldü\nTaş Dev: atlatıldı / yenildi\nTreant: dost / savaş / öldü\n\nHüküm:\n• Driyad'a yardım + Treant yaşıyor → LÜTUF\n• Driyad ya da Treant öldü → LANET" }
};
const notes = {
  [P + "n-ada"]: { id: P + "n-ada", title: "Gizemli ada", cat: "Mekan", pinned: true, updated: T0,
    body: "Fırtınadan sonra kendimizi bir adanın kumsalında bulduk. Bir tabela dağın tepesindeki sunağa gitmemizi söylüyor:\n\"Dağın tepesindeki sunağa ulaşın; ama yol boyunca yaptığınız seçimlere dikkat edin.\"" }
};

const out = { pages, scenario, chars, monsters, maps, dmnotes, notes };
fs.writeFileSync(path.join(ROOT, "web/ext/maceralar/sinav-adasi.json"), JSON.stringify(out));
console.log("sinav-adasi.json", Object.keys(chars).length, "karakter,", Object.keys(monsters).length, "kart,", Object.keys(maps).length, "harita,", pages.length, "sayfa");
