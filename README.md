# Kale Muhafızları · V2

Türkçe, özgün, mobil uyumlu, tek oyunculu sıra tabanlı kale düellosu. Bu ikinci prototip, savaş alanını terk etmeden hamle kurma ve birkaç karar sonrasını düşünme üzerine tasarlanmıştır. APK, hesap, ödeme, harici oyun varlığı veya derleme gerekmez.

## Çalıştırma

```sh
cd war
python3 -m http.server 4173 --directory dist
```

Tarayıcıda `http://localhost:4173` adresini açın. `npm start` aynı komutu çalıştırır. ES modülleri nedeniyle dosyaya çift tıklayıp `file://` ile açmak yerine statik sunucu kullanın. `npm install` gerekmez.

`dist/` herhangi bir statik hostta sunulabilir. Uzak API, font, görsel, analiz veya hesap bağımlılığı yoktur. Yerel statik sunucudan internet olmadan oynanabilir. Service worker veya çevrimdışı uygulama kurulumu içermez.

## Tek ekranlık kontroller

- Kendi kalene dokunarak oradaki kahramanı seç.
- Hamle tepsisinden Hızlı, Ağır, Boz veya Hazırlan seç.
- Vuruş için rakip kaleyi savaş alanında seç ve hamleyi onayla. Hazırlan hedef istemez.
- Savunmada gelen kahraman, saldırı türü, hedef kale ve ham hasar sahada kalır. Siper seçerken kesin hasar/can/enerji sonucu tepside görünür.
- Aynı ana kalede birden fazla muhafız varsa kaleye tekrar dokunarak aralarında geçiş yap.
- Ücretsiz “Temel 18” düğmesi tepsinin sağ üstündedir; özel eylem kullanılamasa da oyun kilitlenmez.
- Tab / Shift+Tab ile gezin, Enter veya Space ile düğme kullanın. Escape açık pencereyi kapatır.

Normal düello ekranı `100dvh` içinde savaş alanı ve sabit hamle tepsisine ayrılır. Yardım, ayarlar, hikâyeler, günce ve talim ayrı kaydırılabilir pencerelerdir. Atış, kalkan ve darbe animasyonları savaş alanında gösterilir; sistemin azaltılmış hareket tercihi desteklenir. Ses varsayılan kapalıdır ve kullanıcı açarsa Web Audio ile yerel üretilir.

## Küçük kurallar, ortak maliyetler

Her tarafın iki yan kulesi 240, ana kalesi 420 candır. Ana kaleyi hedeflemek için en az bir yan kuleyi yıkmak gerekir. Can kahramanlarda değil, kalelerdedir. Kora solda taş, İlda sağda ok, Neris ana kalede ses türünü kullanır. Yan kale yıkılınca kahramanı o turun kalanı ve sonraki tam tur için ana kaleye çekilir; sonra geri döner.

### Enerji

Her tarafın kendi 6 kapasiteli enerji havuzu vardır. Saldırı ve savunma bu aynı havuzdan harcar. İlk hamleyi yapan 3, ikinci oynayan 4 enerjiyle başlar. Bu açık başlangıç telafisi ilk hamle avantajını azaltmak içindir; tam denge garantisi değildir. İlk saldırıdan sonraki her kendi saldırı başlangıcında +3 yenilenir; savunma öncesi ayrıca yenilenmez. Her iki taraf da aynı kurala uyar. İlk düelloda başlangıç sırası seed üzerinden kura ile belirlenir. Sonraki yeni düellolarda sıra dönüşümlüdür; mevcut düellonun ilk tarafı kayıtta tutulur, sayfa yenileme sırayı gizlice sıfırlamaz.

| Eylem | Enerji | Sonuç |
| --- | ---: | --- |
| Hızlı | 1 | Kahramanın temel saldırısı: Kora 50 / İlda 42 / Neris 46 |
| Ağır | 4 | Temel saldırıya +26; savunma için daha az enerji bırakır |
| Boz | 2 | Temel saldırıdan 16 az; gerçekten can azaltırsa hedef kaledeki hazırlığı siler ve rakipten en fazla 1 enerji alır |
| Hazırlan | 0 | O saldırıdan vazgeç; +2 enerji (kapasiteyi aşmaz), seçilen kahramana bir kullanımlık +18 hazırlık |
| Temel atış | 0 | 18 hasar; aktif kahraman yapar, yormaz, hazırlığı tüketmez |
| Eşleşen özel siper | 2 | Kora 34 / İlda 30 / Neris 32 engeller; kendi kalesinde +8, hazırlığı varsa ayrıca +18 |
| Evrensel siper | 0 | Her saldırı türüne karşı 12 engeller; kahraman yormaz |

Yanlış türde özel siper 0 engeller; 2 enerji ve yorgunluk yine harcanır. Bozma tamamen engellenirse enerji veya hazırlık silinmez. Savunma önizlemesi bozma yüzünden kaybolacak enerjiyi de içerir; takip eden saldırı başlangıcındaki yenilenme ayrı gerçekleşir.

### Kahramanın da bir kaynaktır

Özel saldırı yapan kahraman hemen sonraki kendi savunma kararında dinlenir. Özel siper kullanan kahraman hemen sonraki kendi saldırı kararında dinlenir. Enerji yeterli olsa da aynı kahramanı arka arkaya iki rolde kullanamazsın. Diğer hazır kahramanlar her dost kaleyi koruyabilir; yerel savunma +8 daha güçlüdür.

Hazırlık birikmez: kahramanda en fazla bir +18 yük vardır. Sonraki özel saldırıda veya eşleşen siperde tüketilir. Hazırlan saldırı fırsatını feda eder, kahramanı yormaz. Rakip bozucu darbe ile hazırlığı silebilir. Bunlar kalıcı eğitimden ayrıdır.

## Talim ve kalıcı gelişim

Kora’nın talim alanında hareketli işaretçiyi altın merkeze yakın durdurarak üç atış yapın. En iyi 0–3 yıldız derecesi saklanır. Her derece Kora’nın özel saldırılarına kalıcı +1, en fazla+3 verir; hızlı vuruş 50→53 olur. Özel savunma veya enerji bonusu vermez. Yeni düelloda uygulanır ve ayarlardan kapatılabilir. V1’den gelen talim derecesi korunur, ancak daha küçük V2 sayıları açıkça gösterilir.

## Kaydetme ve sıfırlama

`kale-muhafizlari-v2` localStorage anahtarı düelloyu, talim derecesini ve ses tercihini tutar. Yenileme ara AI aşamaları dahil aynı seri durumdan devam eder. Geçersiz kayıt yeni düelloya döner. V1 savaşları yeni kurallarla uyumsuz olduğundan yeni savaş açılır; talim derecesi taşınır. İlerlemeyi temizleme yalnız bu oyunun V1/V2 anahtarlarını siler ve ayrı onay ister. Kayıt alanı engellenirse oyun açık sekmede sürer, uyarı gösterilir.

## Kaynak ve testler

- `dist/engine.js`: Değişmez, seed ile deterministik, DOM/ağ/saat bağımsız savaş motoru.
- `dist/app.js`: Ekran, adım adım seçim, iptal edilebilir animasyonlar, kayıt, talim, ses.
- `dist/art.js`: Bu demo için hazırlanmış özgün inline SVG çizimler.
- `dist/styles.css`: Tek ekranlık masaüstü/telefon düzeni.
- `tests/engine.test.mjs`: Kurallar, geçersiz hamleler, iki ilk-hamle yönü, kayıt ve simülasyon testleri.
- `tests/ui-logic.test.mjs`: Sentetik DOM ile 22 arayüz mantık kontrolü; gerçek görsel/touch testi değildir.
- `tests/balance.mjs`: Tekrarlanabilir politika karşılaştırmaları.
- `README-engine.md`: Motor API’si, tam test kapsamı ve güncel denge ölçümleri.

```sh
npm test
node tests/balance.mjs
```

Yerel HTTP ve JS sözdizimi kontrolleri yapılabilir. Bu çalışma ortamında Chromium, IPC socket kısıtı nedeniyle başlatılamadı; gerçek görsel tarayıcı kontrolü canlı yayın üzerinden yapılmalıdır. Gerçek iOS/Android cihaz doğrulaması ayrıca gerekir.

## Denge durumu

Denge geçicidir ve amaç temel oynanışın eğlencesini değerlendirmektir. V1’deki sürekli en güçlü saldırı döngüsü için V2’de enerji ve kahraman yorgunluğu birlikte harcanır; Ağır maliyeti 4 olduğu için tur başı +3 gelirle kesintisiz sürdürülemez. Önceki eşit 4/4 enerji başlangıcındaki 60 maçlık (30 seed × iki ilk-hamle yönü) karşılaştırmada en güçlü saldırı betiği rezerv gözeten betiğe 14, hazırlık/bozma kullanan betiğe 15, gerçek AI’a 13 maç kazanabildi. Bunlar insan kazanma oranı veya stratejinin tümüyle çözüldüğü iddiası değildir. Son 3/4 başlangıç telafisinin küçük eşleşmiş örneğinde (10 seed × iki yön = 20 maç), ilk başlayan taban ve eşit eğitimli grupların her birinde 15/20 kazandı; belirgin avantaj hâlâ vardır. Bu nedenle rövanşlar başlangıç sırasını değiştirir. Son eğitimli/eşit eğitimli ve politika karşılaştırmaları `README-engine.md` içindedir.

AI yalnız açık kale canı, enerji, hazırlık ve kahraman durumunu kullanır; aynı saf kurallarla hamle yapar. Saldırının ardından savunmayı ve rakibin dönüş saldırısını sınırlı derinlikte değerlendirir. Gizli hasar, ek enerji veya gelecek kullanıcı girdisini görme avantajı yoktur. Çevrimiçi eşleştirme, sunucu otoritesi ve hile koruması bu prototipte yoktur.
