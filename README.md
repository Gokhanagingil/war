# Kale Muhafızları · Beş Emir

Türkçe, tek oyunculu ve bağımlılıksız bir tarayıcı strateji demosu. İki krallık, altı uçan kale ve herkesin gördüğü beş emir: oynadığınız güç, daha sonra rakibinizin eline geçer.

V3, önceki sürümün enerji ve yorgunluk sistemini kaldırır. Ana karar, hangi emri kullanacağınız, hangisini savunmaya ayıracağınız ve rakibe hangi gücü bırakacağınızdır. Özgün göksel arena, üç ayrı kale silueti, yeniden çizilmiş muhafız portreleri ve darbe anında çözülen animasyonlar içerir.

## Çalıştırma

Node.js testler için, Python 3 yerel sunucu için yeterlidir. Paket kurulumu ve derleme gerekmez.

```sh
cd war
npm start
# http://localhost:4173
```

Alternatif: `python3 -m http.server 4173 --directory dist`. ES modülleri nedeniyle `file://` yerine HTTP sunucusu kullanın.

```sh
npm test
node tests/balance.mjs
```

Oyun çalışma sırasında dış font, görsel, API veya sunucu istemez. Hesap, reklam, ödeme ve çok oyunculu ağ katmanı yoktur.

## Nasıl oynanır?

1. Kendi kalenize dokunarak bir muhafız seçin.
2. Elinizdeki iki açık emirden birini seçin.
3. Hedefi rakibin kalesine dokunarak gösterin. Hasar, olası savunma ve kart değişimi önizlemesini okuyun.
4. Hamleyi onaylayın. Kullandığınız emir ortaya gider, ortadaki emir elinize gelir.
5. Gelen saldırıda bir emrin savunma yüzünü veya **Basit siper** seçeneğini kullanın.

Bir emirle savunmak kartı değiştirmez. O emir yalnızca hemen sonraki saldırınızda bekler; diğer emrinizle saldırmanız gerekir. Basit siper daha zayıftır ama iki saldırı seçeneğinizi de korur. Savunmaya ayrılan kart açık ve işaretli kalır.

Kart dolaşımı: A, X emrini oynar → X ortaya geçer → B, elinde zaten bulunan Y emrini oynar → ancak bundan sonra X'i alır. Yeni gelen emir aynı savunmada kullanılamaz. Bu mekanik bir hamleyi art arda tekrarlamayı engeller; daha derin stratejinin tamamen çözüldüğü iddia edilmez.

### Beş emir

| Emir | Saldırı | Özellik | Savunma yüzü |
| --- | --- | --- | --- |
| Ok Yağmuru | 30 ok | Doğrudan baskı | Taşa karşı |
| Koçbaşı | 38 çelik | En güçlü düz vuruş | Yankıya karşı |
| Mancınık | 22 taş | Önceki kendi saldırınızla aynı hedefe +18 | Oka karşı |
| Yankı Sisi | 24 yankı | Toplam korumanın ilk 8 puanını deler | Çeliğe karşı |
| Sancak | 20 çelik | Çıktığı kaleye tek darbeye karşı +12 siper | Her türe karşı |

Savunma yüzünün türü saldırı türünden farklıdır. Yanlış türde kart 0 korur ve yine sonraki saldırıda bekler. Basit siper 8 korur. Sayısal savunma ve kale değerlerinin tek kaynağı `dist/engine.js`; tam kurallar ve ölçümler [README-engine.md](README-engine.md) içindedir.

### Kaleler ve muhafızlar

- Bir yan kale yıkıldığında o tarafın ana kalesi saldırıya açılır. Ana kaleyi yıkmak kazandırır.
- Can kalelere aittir; kahraman canı yoktur.
- Kora taş, İlda ok, Neris yankı emrinde +3 uzmanlık hasarı verir. Her aktif muhafız her emri kullanabilir.
- Uygun yerel muhafız +4 savunur. En iyi uygun savunmacı otomatik seçilir; oyuncunun kararı hangi emri harcayacağıdır.
- Yan kalesi yıkılan muhafız sıradaki saldırısını dinlenerek geçirir, ardından ana kaleden devam eder. Aynı kaleye tekrar dokunmak oradaki muhafızlar arasında geçiş yapar.
- Sancak siperi birikmez. Kaynak kaleye gelen bir sonraki saldırıda, sıfır hasar kalsa bile tüketilir.
- İlk düelloda başlangıç sırası kurayla belirlenir. Her yeni düelloda sıra değişir; sayfa yenilemek mevcut sırayı veya savaşı sıfırlamaz.

## Kontroller ve erişilebilirlik

- Dokunma/fare: kale, emir ve hedef seçimi; onay ayrı düğmedir.
- Klavye: Tab ile gezinme, Enter/Space ile düğmeleri etkinleştirme, Escape ile pencereleri kapatma. Seçim yeniden çizildiğinde odak korunur.
- Mobil düzende arena ve emir tepsisi aynı akıştadır. Çok kısa ekranlarda veya yüksek yakınlaştırmada erişilemeyen kontroller yerine dikey kaydırma açılır.
- Eylem hedefleri en az 44 px olacak şekilde tasarlanmıştır. Türler yalnız renkle değil simge ve yazıyla da belirtilir.
- Hareket azaltma tercihi desteklenir. Ses başlangıçta kapalıdır ve yalnız kullanıcı açınca çalışır.
- Yardım, rakibin açık kart ayrıntıları, son hamleler, muhafız hikâyeleri ve ayarlar oyun menüsündedir. Açılan pencereler sıradaki otomatik hamleyi bekletir.

## Talim ve kayıt

Kora'nın üç atışlık zamanlama talimi en iyi +0–3 dereceyi bu tarayıcıda saklar. V3'te bu gelişim **yalnız Kora'nın taş/Mancınık saldırısına** eklenir; diğer emirleri ve savunmayı güçlendirmez. Başlangıçta kapalıdır, ayarlardan açılıp yeni düelloda uygulanır. Mevcut savaşın değerleri aniden değişmez.

Önceki sürümün talim derecesi korunur; eski enerji tabanlı savaş kaydı yeni kurallara çevrilmez. V3 kayıt anahtarı `kale-muhafizlari-v3`. Bozuk veya uyumsuz kayıt güvenli şekilde yeni düelloya döner. Ayarlardan, açık onayla, yalnız bu oyunun cihazdaki kayıtlarını temizleyebilirsiniz.

## Mimari

- `dist/engine.js`: saf, değişmez durum geçişleri; deterministik kart dağıtımı; doğrulama; önizleme; açık bilgiyle çalışan AI.
- `dist/app.js`: ekran, yerel kayıt, ses, talim ve nesil belirteçli animasyon/zamanlayıcı yönetimi.
- `dist/art.js`: özgün, kod tabanlı SVG kaleler, portreler, ikonlar ve arka plan; harici varlık yok.
- `dist/styles.css`: masaüstü/telefon düzeni ve azaltılmış hareket desteği.
- `tests/engine.test.mjs`: kurallar, değişmezlik, kayıt, önizleme, kart korunumu ve tam maç testleri.
- `tests/ui-logic.test.mjs`: sentetik DOM ile gerçek olay dinleyicileri ve yarış koşulları. Gerçek tarayıcı çizimi değildir.
- `tests/balance.mjs`: sabit tohumlu, başlangıç sırası değiştirilmiş politika karşılaştırmaları.

AI yalnız oyuncunun gördüğü kart, kale, siper ve önceki hedef bilgilerini kullanır. Aynı kurallarla saldırıp savunur. İleride ağ katmanı eklenebilmesi için motor UI'dan ayrıdır; bu sürüm çok oyunculu değildir.

## Doğrulama ve bilinen sınırlar

Son kaynakta 24 motor testi ve 25 sentetik arayüz kontrolü geçti; bunlar 500 tohumlu motor maçını ve gerçek olay dinleyicileri üzerinden 20 tam arayüz maçını içerir. Kurallar ve kesintili kullanıcı akışları otomatik testlerle kontrol edilir. SVG çizimleri rasterleştirilerek küçük boyutta gözden geçirilmiştir. Test kapsamı ve denge deneylerinin ayrıntısı `README-engine.md` içindedir. Yerel testler CI yerine geçmez; bu depoda CI iş akışı yapılandırılmamıştır.

Gerçek iOS/Android cihaz testi yapılmamıştır. Dar ekran CSS'i ve minimum dokunma boyutları, tek başına gerçek mobil kullanılabilirlik kanıtı değildir. Yerel Chromium bu ortamda IPC kısıtı nedeniyle başlatılamamıştır; bu sınır aşılmamıştır.

Denge araştırma aşamasındadır. Açılış dağılımı ve başlangıç sırası sonuçları etkileyebilir. Bazı eşleşmelerde doğru türde savunma hâlâ sık tercih edilir. Sabit politika simülasyonları insan eğlencesini, tüm stratejilere dayanıklılığı veya rekabetçi dengeyi kanıtlamaz. Gelişim kapalı ve eşit gelişimli karşılaştırmalar ayrı değerlendirilir.

Bu, ticari oyunların görsellerini veya kodunu kullanmayan özgün bir keşif demosudur. Beş açık emrin dolaşması fikri soyut strateji oyunlarından ilham alır; mekanik uygulama, karakterler, kale sistemi ve çizimler bu proje için hazırlanmıştır.
