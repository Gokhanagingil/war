# Kale Muhafızları

Türkçe, özgün, tek oyunculu ve mobil uyumlu sıra tabanlı kale düellosu. APK, hesap, ödeme, derleme veya üçüncü taraf paket gerektirmez. SVG kahramanlar, kaleler ve çevre çizimleri bu demo için hazırlanmıştır. Başka oyunlara ait görsel veya ses varlığı kullanılmaz.

## Çalıştırma

Python 3 varsa:

```sh
cd war
python3 -m http.server 4173 --directory dist
```

Tarayıcıda `http://localhost:4173` adresini açın. Alternatif olarak `npm start` aynı komutu çalıştırır. ES modülleri nedeniyle dosyaya çift tıklayarak `file://` açmak yerine bir statik sunucu kullanın. Kurulum veya `npm install` gerekmez.

`dist/` içindeki beş dosya herhangi bir statik hostta doğrudan sunulabilir. Çalışma sırasında uzak API, font, görsel veya analiz servisi çağrısı yapılmaz. Yerel statik sunucudan internet bağlantısı olmadan oynanabilir. Bu sürüm çevrimdışı web uygulaması kurulumu veya service worker içermez.

## Oynanış ve kontroller

- Fare/touch: Bir kahraman ve rakip kale seçin, büyük hamle düğmesine basın.
- Klavye: Tab / Shift+Tab ile gezin, Enter veya Space ile düğmeleri kullanın. Escape, açık bilgi/ayar/talim penceresini kapatır.
- Rakibin bir yan kulesi yıkılınca ana kale açılır. Rakibin ana kalesini yıkınca kazanırsınız; kendi ana kaleniz yıkılınca kaybedersiniz.
- Her tarafın iki yan kulesi 240, ana kalesi 420 candır. Can, kahramanlara değil kalelere aittir.
- Kora taş, İlda ok, Neris ses türündedir. Her kahraman istediğiniz dost kaleyi savunabilir. Tür eşleşmesi güçlü koruma sağlar; eşleşmeyen özel savunma başarısız olur, 0 hasar engeller ve yine beklemeye girer. Yalnızca evrensel kalkan her saldırı türüne karşı 12 hasar engeller.
- Sıra: oyuncu saldırır, rakip savunur, rakip saldırır, oyuncu savunur. Bir tam tur her iki saldırıyı içerir.
- Özel saldırı ve savunma ayrı bekler; aynı özel yeteneği yeniden kullanmadan önce bir tur geçmelidir. Temel Atış (28 hasar) ve genel kalkan (12 engelleme) her zaman kullanılabilir. Temel Atış aktif bir kahraman tarafından gerçekleştirilir ve özel saldırı süresini sıfırlamaz.
- Yan kalesi yıkılan kahraman, o turun kalanı ve sonraki tam tur için ana kaleye çekilir, sonra geri döner.
- “Rakibi incele” rakip kahramanların açık bekleme sürelerini ve konumlarını gösterir. AI yalnızca açık durumu kullanır; gizli oyuncu kararını okumaz.

## Talim, kayıt ve ayarlar

Kora’nın talim alanında hareketli işaretçiyi altın bölgenin ortasında üç kez durdurun. Merkezden uzaklığa göre 0–3 yıldız kazanılır. En iyi derece saklanır; her yıldız Kora’ya +3 saldırı ve +3 eşleşen savunma, en fazla +9/+9 verir. Eğitim bonusu yalnızca yeni düelloda uygulanır. Ayarlardan bonusu açıp kapatın ve yeni düello başlatarak taban değerlerle karşılaştırın. Demo para veya hesap kullanmaz.

Tek `localStorage` anahtarı `kale-muhafizlari-v1`, düelloyu, talim derecesini ve ses ayarını tutar. Yenileme, AI ara aşamaları dahil aynı seri durumdan devam eder. Geçersiz/eski kayıt yeni düelloya döner. Kayıt alanı kullanılamazsa oyun açık sekmede çalışır ve uyarı gösterir. Ayarlardaki “ilerlemeyi temizle” yalnızca bu oyunun kaydını sıfırlar; açık bir onay ekranı vardır.

Ses varsayılan olarak kapalıdır. Kullanıcı açtığında Web Audio ile kısa, yerel sesler üretilir. Sistem `prefers-reduced-motion` tercihi hareketleri azaltır. Hareketli talim göstergesi, zamanlama mini oyununun gerekli görsel girdisidir.

## Kaynak yapısı

- `dist/engine.js`: Saf, değişmez, seed ile deterministik oyun kuralları. DOM, ağ ve saat bağımlılığı yoktur.
- `dist/app.js`: Arayüz, hamle sırası, iptal edilebilir animasyon zamanlayıcıları, talim, ses ve yerel kayıt.
- `dist/art.js`: Özgün inline SVG resimler ve simgeler.
- `dist/styles.css`: Duyarlı masaüstü/telefon düzeni ve azaltılmış hareket tercihi.
- `dist/index.html`: Türkçe, semantik uygulama girişi.
- `tests/`: Motor testleri ve tekrarlanabilir denge araştırma betiği.
- `README-engine.md`: API, sayısal kurallar, seed tekrarları, test kapsamı ve denge sonuçları.

Motorun arayüzden ayrılması, daha sonra sunucu-otoriter çok oyunculu protokol kurmayı kolaylaştırır. Bu demo çevrimiçi eşleştirme, hesap, sunucu otoritesi veya hile koruması içermez.

## Testler

```sh
node --test tests/engine.test.mjs
node tests/balance.mjs 1000
# veya: npm test
```

17 motor testi geçmektedir: simetri, hedef kilidi, aşamalar, değişmezlik, geçersiz/yinelenen hamleler, ayrı bekleme süreleri, savunma eşleşmesi, her kaleye savunma, iki tarafın geri çekilmesi, temel eylemler, bonus sınırları, iki tarafın kazanması, seed/JSON yeniden oynatma ve 200 tam maçın durum sınırları. 5.000 seed/politika denge koşusu tur sınırına takılmadan tamamlanmıştır. Bağımsız kural testleri de yanlış tür savunmasının 0 engellemesini doğrulamıştır. Bunlar insan kazanma oranı veya cihaz üzerindeki görsel testin yerine geçmez.

Yerel HTTP yanıtı ve bütün JS dosyalarının sözdizimi doğrulandı. Canlı yayın ortamındaki tarayıcıda tam bir saldırı/savunma turu, üç atışlık talimden +3 bonus kazanılması, bonusla yeni düelloda Kora saldırısının 83 olması ve 393 CSS piksel genişlikte yatay taşma bulunmaması kontrol edildi. Gerçek iOS cihaz testi yapılmadı. Ayrıca 13 arayüz-çalışma zamanı testi yinelenen tıklamaları, yeniden başlatma/iptal zamanlayıcılarını, talim sonucu yarışını, ayarları ve kayıt yenilemesini doğrular; bunlar görsel tarayıcı testinin yerine geçmez.

## Denge özeti

Kora 80, İlda 64, Neris 72 hasar; eşleşen savunmaları sırasıyla 50, 42, 46 engellemedir. Taban değerler simetriktir. 200 sabit tohumda en yüksek hasarı ve anlık en iyi engellemeyi seçen basit betik 145 oyuncu / 55 AI galibiyeti ve ortalama 24,7 tur üretti. Eşleşmeyen özel savunmayı boşa harcamamak anlamlı bir stratejidir. Maksimum talim Kora’nın saldırısını %11,25 artırır. 1.000 seed’li iyi hamle seçen betik, bonus kapalıyken 734, +3/+9 bonusla 1.000 maç kazanmıştır. Demo bu politikada oyuncu lehinedir; salt genel kalkan betiği ise 1.000 maçın tamamını kaybetmiştir. Bilinen sınırlama: eğitim bonusuyla basit tekrar eden iyi taktik hâlâ baskındır; ezberlenebilir strateji sorunu çözülmüş değildir. Denge geçicidir ve bu prototip temel oynanışın eğlencesini değerlendirmek içindir. Bu sonuçlar insan kazanma oranı değildir. Ayrıntılı ve tekrar üretilebilir sonuçlar `README-engine.md` içindedir.
