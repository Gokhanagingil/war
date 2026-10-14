# Kale Muhafızları v2: enerji ve hazırlık motoru

`dist/engine.js`, bağımlılıksız bir tarayıcı ES modülüdür. Durum geçişleri girişlerini değiştirmez. Saat, ağ ve `Math.random()` kullanılmaz. Aynı seed ve aynı kararlar aynı sonucu verir; bütün durum JSON ile kaydedilip herhangi bir aşamadan sürdürülebilir. v1 kayıtları v2 kurallarına taşınmamalıdır.

## Temel kullanım

```js
import {
  createGame, playerAttack, resolveAiDefense, chooseAiAttack, playerDefend,
  availableAttacks, availableDefenses, legalTargets, previewAttack, previewDefense,
} from './dist/engine.js';

let state = createGame({
  seed: 'ornek-duello',
  firstSide: 'random',
  training: { power: 2 },
  trainingEnabled: true,
});

// Önce state.phase okunur. İlk hamle rakibe ait olabilir.
if (state.phase === 'playerAttack') {
  const preview = previewAttack(state, { attackId: 'kora:quick', targetId: 'left' });
  state = playerAttack(state, { attackId: 'kora:quick', targetId: 'left' });
}
if (state.phase === 'aiDefense') state = resolveAiDefense(state);
if (state.phase === 'aiAttack') state = chooseAiAttack(state);
if (state.phase === 'playerDefense') state = playerDefend(state, { defenseId: 'brace' });
```

Her geçişten sonra aşama yeniden okunmalıdır. Hazırlanma saldırı fırsatının tamamını kullanır ve savunma aşamasını atlar. `chooseAiAttack` bu yüzden bazen doğrudan `playerAttack` döndürür. Bir ana kale yıkılırsa aşama anında `finished` olur.

## Durum ve API

- `version: 2`; `phase`: `playerAttack`, `aiDefense`, `aiAttack`, `playerDefense` veya `finished`.
- `round` 1'den başlar. Bir tur iki tarafın birer saldırı fırsatıdır; hazırlanma da bir fırsattır. `turnInRound` 0 veya 1'dir.
- `firstSide`: `player` veya `enemy`. Oluşturma seçeneği `random` ise seed üzerinden bir kere seçilir ve sonuç saklanır. Varsayılan, geriye dönük çağrı uyumluluğu için `player`.
- `energy`: `{player, enemy}`; `decisionIndex`: tarafın aldığı gerçek saldırı/savunma kararlarının sayısı; `attackCount`: tarafın başlayan saldırı fırsatları.
- `castles.player/enemy`: `left`, `main`, `right` kale dizileri. Yan kaleler 240, ana kale 420 canla başlar.
- `heroes.player/enemy`: Kora, İlda, Neris için `castleId`, `readyAt`, `charge`, `retreatRounds`, `retreatUntilRound`.
- `pendingAttack`: saldıran taraf, kahraman, eylem kimliği, tür, mod, hedef, temel hasar, hazırlık/gelişim bonusu, toplam hasar ve maliyet. Hazırlanmada veya çözülmüş saldırıdan sonra `null`.
- `lastEvent`: `attackDeclared`, `attackResolved` veya `prepared`; kahraman, saldırı modu, hedef ve sonuç. Çözümde `damage` hesaplanan darbe, `hpLost` gerçekten eksilen can, `energyDrained` ve `preparationCleared` ayrıca bulunur.
- `lastDefense`: son çözülmüş savunma ve etkisi. Yeni saldırı/hazırlanma başında temizlenir.
- `log`: son 10 Türkçe olay; `winner`: `null`, `player` veya `enemy`.
- `training.power`: oyuncunun etkin gelişim seviyesi; `trainingBySide`: her iki tarafın ayrı seviyeleri. `trainingEnabled`/`training.enabled` gelişim etkisinin açık olduğunu gösterir.

`HEROES`, `ATTACKS`, `DEFENSES`, `RULES` değiştirilemez tanımlardır. `legalTargets(state, side)` kopya kale nesneleri döndürür. `availableAttacks` ve `availableDefenses` bütün eylemleri `available`, `reason`, maliyet ve bonus ayrıntılarıyla sunar. Bir eylem ancak `available` olduğunda kullanılabilir. `remainingCooldown`, hazır olma karar indeksine kalan farktır; tur sayısı değildir. Bekleyen sonraki kararda dinlenme, `readyAt > decisionIndex[side]` ile anlaşılır.

Saldırı kimlikleri `kora:quick`, `kora:heavy`, `kora:disrupt`, `kora:prepare`; diğer kahramanlar için aynı son ekler; ücretsiz temel saldırı `rally`. Savunmalar `kora`, `ilda`, `neris`, `brace`.

`previewAttack(state, {attackId, targetId, side?})` temel hasar, hazırlık ve gelişim katkısı, toplam hasar, enerji sonrası, yorgunluk ve olası savunmaları verir. Savunmaların hazır oluşu gelecek gerçek savunma kararı için hesaplanır. Hazırlanma hedef gerektirmez. `previewDefense(state, defenseId)` tür eşleşmesini, engellenen hasarı, net hasarı, yerel bonusu, enerji sonrası ve tüketilecek hazırlığı gösterir. `energyAfter`, bozucu darbenin varsa enerji kaybını da içerir; sonraki saldırı aşamasının yenilenmesini içermez. `energyDrained` (`energyDrain` takma adıyla da), `preparationCleared` ve `hpLost` gerçek çözüm sırasıyla hesaplanır. Önizlemeler kaynak tüketmez. Kullanılamayan savunmanın teorik engelleme miktarı gösterilebilir; arayüz bunu etkin seçenek gibi sunmamalıdır.

`applyAttack(state, side, payload)` ve `applyDefense(state, side, payload)` aynı kuralları iki tarafa da uygulayan saf genel geçişlerdir. Oyuncu sarmalayıcıları aynı işlevleri kullanır. `selectAttack`/`selectDefense` aynı görünür durumdan salt okunur AI kararı üretir. `chooseAiAttack` saklanan RNG'yi ilerletip kararı uygular. Yanlış aşama, bilinmeyen eylem, yetersiz enerji, yorgun/çekilen kahraman veya kilitli/yıkılmış hedef hata verir. Hata giriş durumunu değiştirmez.

## Savaş kuralları

### Ortak enerji ve hazır olma

Görünür açılış telafisi olarak ilk saldıran 3/6, ikinci saldıran 4/6 enerjiyle başlar. Bu kural oyuncu veya AI kimliğine değil, ilk hamle sırasına bağlıdır. Kendi ilk saldırısı dışında her saldırı aşaması başladığında +3 enerji alır; üst sınır 6'dır. Savunmadan önce enerji yenilenmez. Saldırı ve savunma aynı havuzu kullanır.

Her gerçek karar, o tarafın `decisionIndex` değerini bir artırır. Bir özel saldırı veya tür savunması kahramanın `readyAt` değerini o kararın indeksi +2 yapar. Böylece saldıran kahraman hemen sonraki kendi savunmasında, savunan kahraman da hemen sonraki kendi saldırısında özel yetenek kullanamaz. Aradaki bir kendi kararı geçince yeniden hazır olur. Ayrı saldırı/savunma beklemeleri veya sabit kahraman rotasyonu yoktur. Hazırlanmada atlanan savunma için hayali karar sayılmaz.

### Saldırılar

| Kahraman | Tür | Hızlı / 1 enerji | Ağır / 4 enerji | Bozucu / 2 enerji |
| --- | --- | ---: | ---: | ---: |
| Kora | Taş | 50 | 76 | 34 |
| İlda | Ok | 42 | 68 | 26 |
| Neris | Ses | 46 | 72 | 30 |

Üç mod da kahramanı yorar. Hazırlık varsa +18 eklenir ve saldırı ilanında tüketilir. Kora'nın açık gelişim bonusu ayrıca eklenir.

Bozucu darbe gerçekten pozitif kale canı kaybettirirse, hedef kalede konuşlanmış bütün kahramanların hazırlığını siler ve savunan tarafın enerjisinden en fazla 1 eksiltir. Önce savunma maliyeti, sonra bu kayıp uygulanır; enerji negatif olmaz. Tam engellenmiş darbe hazırlık veya enerji silemez.

Hazırlanma 0 maliyetlidir; bütün saldırı fırsatından vazgeçerek +2 enerji ve seçilen hazır, çekilmeyen kahramana tek +18 yük verir. Yük birikmez. Kahramanı yormaz. Yük, o kahramanın sonraki özel saldırısında veya doğru tür savunmasında kullanılır; süresiz durabilir ve bozucu darbeyle silinebilir.

Temel Atış (`rally`) aktif bir kahraman tarafından 18 hasarla yapılır. Yorgunken ve sıfır enerjiyle kullanılabilir; yük tüketmez veya yorgunluk yaratmaz. Güçlü özel saldırının yerine geçmeyen, kilitlenmeyi önleyen zayıf seçenektir.

### Savunmalar

Kora 34, İlda 30, Neris 32 korur; maliyet 2 enerjidir. Yalnızca gelen tür eşleşirse koruma sağlarlar. Kahraman hedef kalede konuşlanmışsa +8; hazırlığı varsa +18 eklenir. Toplam engelleme gelen hasarı aşmaz. Bütün aktif, hazır kahramanlar bütün dost kaleleri savunabilir.

Yanlış tür seçmek 0 koruma verir; yine 2 enerji harcar ve kahramanı yorar, fakat hazırlık yükünü tüketmez. Arayüz bu maliyeti açıkça gösterir. Ücretsiz `brace` her türe karşı 12 engeller, kahraman kullanmaz ve her zaman seçilebilir.

### Kaleler, çekilme ve zafer

Kora solda, İlda sağda, Neris ana kalede başlar. Rakibin ana kalesine erişmek için o tarafın en az bir yan kalesini yıkmak gerekir. Kahraman kendi kalesiyle sınırlı değildir.

Yan kale yıkıldığında kahramanı ana kaleye taşınır; o turun kalanı ve sonraki tam tur boyunca kullanılamaz. `retreatUntilRound = düşüş turu + 2`; bu tur başladığında geri döner. Hazır olma ve varsa hazırlık yükü korunur. Ana kale yıkılınca diğer yan kalenin durumundan bağımsız zafer belirlenir.

### Gelişim

Antrenman, Kora'nın özel saldırılarına kalıcı +0–3 ekler; her seviye +1'dir. Savunmayı, temel saldırıyı veya hazırlanmayı güçlendirmez. Eski her vuruşta +9 etkisi kaldırılmıştır. `trainingEnabled:false` iki tarafın bonusunu da kapatır. Olağan oyun `training:{power:seviye}` ile yalnız oyuncuya gelişim uygular. Karşılaştırmalı testlerde `trainingBySide:{player:3,enemy:3}` simetrik gelişimi sağlar; açık taraf değerleri eski oyuncu seçeneğinin önüne geçer. Seviyeler 0–3 tamsayıya sıkıştırılır.

## AI ve denge araştırması

AI, oyuncuyla aynı geçişleri, canı, enerjiyi, türleri, hazırlığı, yorgunluğu ve çekilmeyi kullanır. Gizli kaynak, hasar, direnç veya oyuncunun gelecek kararını okuma yoktur.

Savunmada anlamsız yanlış türleri eler; ücretsiz siperle eşleşen kahramanı karşılaştırır, sonraki saldırıda kaybedilen kahramanı ve kalan enerjiyi hesaba katar. Saldırıda görünür duruma göre ilk beş adayı seçer, rakibin karşı saldırısını ve iki savunmayı değerlendirir. Enerji ve hazırlık için sınırlı değer, kale ilerlemesi ve zafer için daha yüksek değer kullanır. Birbirine çok yakın seçenekleri saklanan seed ile çeşitlendirir. Bu sınırlı arama kusursuz oyun veya insan eğlencesinin ölçümü değildir.

```sh
npm test
node tests/balance.mjs 30                      # Son açılış: ilk 3 / ikinci 4
node tests/balance.mjs 30 --opening=4v4        # Belgelenen 1.800 maçlık referansı yeniden üret
```

86 otomatik test geçti. Başlangıç simetrisi, iki ilk hamle sırası, saldırı başına enerji, saldırı/savunma arasında ortak yorgunluk, hazırlık ve yük tüketimi, bozucu darbe ve savunma sonrası enerji, yerel koruma, yanlış türün bedeli, her iki tarafın çekilmesi ve dönüşü, zafer, gelişim seviyeleri, yanlış/yinelenmiş çağrılar, değişmezlik, seed, her aşamadan JSON devamı ve 200 tamamlanmış maç kapsanır. Eşlenmiş basit politikalarla 200 maçın 100'ünü her taraf kazandı; ortalama 18,2 tur. Bu son sayı AI gücünü ölçmez; kural simetrisi ve tamamlanma kontrolüdür.

Denge betiği en yüksek ham hasar (`strongest`), anlık net hasar (`immediate`), kaynak saklayan (`reserve`), hazırlık/bozmayı da değerleyen (`tactical`) ve gerçek motor AI'sını karşılaştırır. 1–30 seed, her iki ilk hamle sırası ve taban/yalnız oyuncu gelişimli/eşit gelişimli koşullar ayrı raporlanır. Maliyetleri değiştiren denemeler içinde ağır saldırıyı 3 yerine 4 enerjiye çıkarmak, her tur aynı ağır saldırıyı yeniden satın alma döngüsünü kırdı. Tam matrisin sonuçları aşağıda özetlenir.

## Ölçülen sonuçlar ve açık denge sınırı

Aşağıdaki **4/4 başlangıç enerjili referans** matrisi, her hücrede 30 seed × iki ilk hamle sırası olmak üzere 60 maç içerir. Hücreler ilk yazılan politikanın galibiyet sayısı / 60'tır. Üç gelişim koşulunda toplam 1.800 maçın tamamı bitti; 200 tur sınırına ulaşan veya aynı konumun dört kez tekrarlandığı maç yoktu. Maçlar 13–50 tur, genel ortalama 15,68 tur sürdü.

| Politika karşılaşması | Taban 0/0 | Oyuncu gelişimi 3/0 | Eşit gelişim 3/3 |
| --- | ---: | ---: | ---: |
| En yüksek ham hasar / Kaynak saklayan | 14 | 30 | 30 |
| Anlık net hasar / Kaynak saklayan | 0 | 0 | 0 |
| En yüksek ham hasar / Hazırlık-bozma odaklı | 15 | 20 | 19 |
| Anlık net hasar / Hazırlık-bozma odaklı | 0 | 1 | 0 |
| Kaynak saklayan / Hazırlık-bozma odaklı | 35 | 36 | 30 |
| En yüksek ham hasar / Motor AI | 13 | 15 | 17 |
| Anlık net hasar / Motor AI | 0 | 0 | 0 |
| Kaynak saklayan / Motor AI | 29 | 37 | 19 |
| Hazırlık-bozma odaklı / Motor AI | 17 | 37 | 29 |
| Motor AI / Motor AI | 33 | 43 | 29 |

Bu örneklerde sürekli en yüksek hasarı seçmek baskın değildi. Taban AI aynalarında toplam 1.211 ağır, 997 hızlı, 743 hazırlanma, 27 bozucu ve 25 temel saldırı kullanıldı. Bozucu darbe duruma bağlı olarak işe yarıyor ama seyrek seçiliyor; henüz eşit sıklıkta kullanılacağı veya bütün modların eşdeğer olduğu iddia edilmiyor. Taban motor AI karşısında hazırlık-bozma politikası saldırıdan sonra ortalama 2,27 enerji sakladı; en yüksek hasar politikası 1,06 sakladı.

**İlk hamle avantajı sürüyor.** 4/4 referans AI aynalarında ilk hareket eden taraf tabanda 53/60, eşit gelişim 3/3'te 59/60 kazandı. Oyuncu tek taraflı geliştirilince AI aynalarında oyuncu 43/60 kazandı; bu, eşit koşullu denge ölçüsü değildir. Başlangıcı seed ile rastgele seçmek hangi tarafın avantajı aldığına simetri getirir; avantajı ortadan kaldırmaz.

Küçük, görünür açılış telafisi araştırması: aynı 1–10 seed, iki başlangıç sırası, eşit gelişim ve aynı AI politikaları kullanıldı. Her hücre ilk hareket edenin galibiyeti / 20'dir. Sadece başlangıç enerjisi değiştirildi; diğer bütün kurallar aynı kaldı.

| Açılış enerjisi | Taban 0/0 | Eşit gelişim 3/3 |
| --- | ---: | ---: |
| İlk 4 / ikinci 4 | 17 | 19 |
| İlk 4 / ikinci 5 | 18 | 15 |
| İlk 3 / ikinci 4 | 15 | 15 |

**Son uygulama ilk saldıranı 3, ikinciyi 4 enerjiyle başlatır.** Bu küçük iki örnekte avantajı azaltan daha tutarlı aday seçilmiştir; kalan %75 ilk-hamle kazanma oranı hâlâ önemli bir sınırdır. Bu araştırma küçük ve politika bağımlıdır; rekabetçi dengeyi kanıtlamaz. Canı değiştirmeden, görünmez bonus vermeden veya AI'ya ayrı kurallar tanımadan test edildi.

4/4 açılışlı kaynak üzerinde ayrıca 36 AI/AI ve en yüksek hasar/AI duman maçı tamamlandı; tekrarlı küçük seed koşuları birebir aynı çıktıyı verdi. Bu 36 maçlık kontrol sırasında yalnız önizleme, olay alanları ve okunabilir günlük ayrıntıları değişmişti; savaş çözümü ve AI puanlaması aynıydı. Sonrasında yukarıda açıkça ayrılan 3/4 açılış telafisi seçildi; 1.800 maçlık tablonun 3/4 için yeniden koşulduğu iddia edilmez. Saf durum testleri kapsamı ile denge araştırmasının kapsamı ayrıdır; hiçbiri insan oyun testinin yerine geçmez.

### Son 3/4 kaynak üzerinde kısa doğrulama

Son açılış kuralıyla 1–5 seed, iki ilk hamle sırası ve üç gelişim koşulunda 60 ek maç oynatıldı; hepsi tamamlandı ve tekrar döngüsü uyarısı yoktu. Aşağıdaki hücreler oyuncu galibiyeti / 10'dur; her hücrede oyuncu beş, rakip beş kez ilk hareket etti.

| Karşılaşma | Taban 0/0 | Oyuncu gelişimi 3/0 | Eşit gelişim 3/3 |
| --- | ---: | ---: | ---: |
| En yüksek ham hasar / Motor AI | 2 | 0 | 1 |
| Motor AI / Motor AI | 3 | 9 | 6 |

AI aynalarında ilk hareket eden sırasıyla 6/10, 6/10 ve 7/10 kazandı. Taban aynaların ortalama uzunluğu 30,0; oyuncu gelişimli aynaların 27,9; eşit gelişimli aynaların 20,0 turdu. Bu yalnız küçük bir son-kaynak kontrolüdür; 20 maçlık açılış araştırmasının veya 1.800 maçlık farklı açılışlı referansın yerine geçmez. Tek taraflı gelişim sonuçları özellikle hassastır; oyuncu 3/0 ayna örneğindeki 9/10, insan kazanma oranı veya genel garanti değildir.

## Sınırlar

Bu yerel tek oyunculu prototipte hesap, sunucu, çok oyunculu eşleştirme, hile önleme veya kriptografik RNG yoktur. JSON kayıtları uygulamanın güvenilir yerel durumudur; bozuk veya elle değiştirilmiş kayıtlar için arayüz sürüm/biçim kontrolü yapmalı ve gerektiğinde yeni oyun başlatmalıdır. Motor testleri tarayıcı görselleri veya animasyonları doğrulamaz. Kaynak ve AI politikaları açık olduğu için sonuçlar yeniden üretilebilir; küçük bir simülasyon örneği oyunun dengeli veya eğlenceli olduğunu kanıtlamaz.
