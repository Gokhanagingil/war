# Kale Muhafızları: savaş motoru

Özgün, bağımlılıksız tarayıcı ES modülü: `dist/engine.js`. Saf durum geçişleri giriş nesnesini değiştirmez. Saat, ağ ve `Math.random()` kullanılmaz. Aynı seed ve aynı kararlar aynı sonucu verir. Bütün durum JSON ile kaydedilip ara aşamadan devam ettirilebilir.

## Arayüz

```js
import {
  HEROES, ATTACKS, DEFENSES, createGame, legalTargets,
  availableAttacks, availableDefenses, previewDefense,
  playerAttack, resolveAiDefense, chooseAiAttack, playerDefend,
  describeState,
} from './dist/engine.js';

let state = createGame({
  seed: 'ornek-oyun',
  training: { power: 1, defense: 1 },
  trainingEnabled: true,
});
state = playerAttack(state, { attackId: 'kora', targetId: 'left' });
state = resolveAiDefense(state);
if (!state.winner) {
  state = chooseAiAttack(state);
  // Oyuncu burada savunmasını seçer; bekleyen saldırı state.pendingAttack içindedir.
  const preview = previewDefense(state, 'brace');
  state = playerDefend(state, { defenseId: 'brace' });
}
```

- Aşamalar: `playerAttack → aiDefense → aiAttack → playerDefense → playerAttack`. Ana kale yıkılırsa doğrudan `finished`.
- Bir tur, iki tarafın birer saldırısıdır. `round` 1'den başlar, oyuncu savunmasının sonunda artar.
- `HEROES`, `ATTACKS`, `DEFENSES`: kimliğe göre anahtarlanmış, salt okunur tanımlar.
- Saldırılar: `kora` (stone), `ilda` (arrow), `neris` (sound), `rally` (temel saldırı).
- Savunmalar: `kora` (stone), `ilda` (arrow), `neris` (sound), `brace` (universal).
- `legalTargets(state, attackerSide)` kopyalanmış kale nesneleri döndürür. Taraflar `player` ve `enemy`.
- `availableAttacks` / `availableDefenses` bütün eylemleri döndürür; `available`, `reason` ve `remainingCooldown` kullanılabilirliği açıklar.
- `previewDefense` gelen hasarı, engellenen miktarı, kalan hasarı, tür eşleşmesini ve Türkçe açıklamayı döndürür. Salt okunurdur.
- Geçişler yeni durumu doğrudan döndürür. Yanlış aşama, yinelenmiş geçiş, kilitli/yıkılmış hedef veya beklemedeki yetenek hata üretir.
- `lastEvent`: `attackDeclared` veya `attackResolved`; sonuçta `damage` net darbe gücü, `hpLost` gerçekten eksilen can, `blocked`, `effective`, `castleFell`, `winner` bulunur.
- `lastDefense` son çözülmüş savunmanın tanımı ve etkisidir; yeni saldırı ilanında sıfırlanır.
- `log` kronolojik, en fazla 8 Türkçe satırdır. `pendingAttack` çözümden sonra sıfırlanır.
- `trainingEnabled` üst seviye görünüm alanıdır; `training` nesnesi `{enabled,power,defense}` içerir.

## Kurallar ve sayılar

Her tarafın ana kalesi 420, iki yan kulesi 240 candır. Ana kaleye saldırmak için o tarafın en az bir yan kulesini yıkmak gerekir. Kora solda, İlda sağda, Neris ana kalede başlar. Kule yıkıldığında kahraman elenmez: o turun kalanında ve sonraki bir tam turda ana kaleye çekilir; sonraki turun başında yeniden hazırdır. Bütün aktif kahramanlar bütün dost kaleleri savunabilir.

| Kahraman | Saldırı | Eşleşen savunma | Eşleşmeyen savunma |
| --- | ---: | ---: | ---: |
| Kora | 80 | 50 | 0 |
| İlda | 64 | 42 | 0 |
| Neris | 72 | 46 | 0 |

Saldırı ve savunma beklemeleri ayrıdır. Özel yeteneğin beklemesi kullanıldığında 2 olur, her tam turun sonunda 1 azalır; yeniden kullanmadan önce arada bir tur gerekir. Temel Atış 28 hasar ve genel kalkan 12 engelleme verir; ikisi de her zaman hazırdır. Temel Atış bir aktif kahraman tarafından yapılır (`heroId` dinamik olarak seçilir) ve kahramanın özel saldırı beklemesini tüketmez veya sıfırlamaz. Bu, kahramansız bir ordu saldırısı değildir.

Antrenman yalnızca oyuncunun Kora'sını etkiler. Güç ve savunma seviyeleri ayrı ayrı 0–3 tamsayı aralığına sıkıştırılır. Her seviye +3 saldırı veya +3 eşleşen savunma verir; en yüksek saldırı farkı 89/80, yani %11,25'tir. Eşleşmeyen özel savunma başarısız olur: 0 hasar engeller, bonus almaz ve kullanıldığında yine beklemeye girer. Zayıf evrensel savunma yalnızca genel kalkandır (12 engelleme). `trainingEnabled:false` bütün antrenman bonuslarını kaldırır ve taban değerleri iki taraf için aynıdır.

Rakip aynı can, hedef kilidi, kahraman, geri çekilme ve bekleme kurallarına uyar. Yalnızca görünür kale canlarını ve savunma hazırlığını kullanır. Güçlü tür eşleşmesi yoksa sonraki tur için kahramanı saklayarak genel kalkanı seçer. Saldırırken açık savunma türleri, zayıflamış kule, ana kale önceliği ve öldürücü vuruşu değerlendirir. Son ayarda hasarlı hedefe odak puanı 160, açılmış ana kale önceliği 500’dür; bunlar yalnız açık durumu kullanan karar puanlarıdır, hasar/can avantajı değildir. Seed'li küçük puan çeşitliliği farklı ama yararlı kararlar üretir; gizli oyuncu kararını okumaz.

## Doğrulama

```sh
node --test tests/engine.test.mjs
node tests/balance.mjs 1000
```

17 otomatik test geçti. Testler başlangıç simetrisi, hedef kilidi, bütün aşamalar, değişmezlik, yanlış/yinelenmiş çağrılar, ayrı beklemeler, tür eşleşmesi, her kaleye savunma, iki tarafın geri çekilip dönmesi, zorunlu temel eylemler, bonus sınırları, iki tarafın zaferi, seed tekrarı, JSON ara-aşama devamı ve 200 tam maçın durum sınırlarını kapsar.

İlk 200 seed için en yüksek anlık engellemeyi seçen basit taktik betiği: 145 oyuncu / 55 rakip galibiyeti, ortalama 24,7 tur. Bu bir insan kazanma oranı değildir. Daha geniş, tekrarlanabilir 1000 seed örnekleri:

| Oyuncu betiği | Güç / savunma | Oyuncu galibiyeti | Ortalama tur |
| --- | --- | ---: | ---: |
| Anlık engellemeyi en yükseğe çıkar | 0 / 0 | 734 / 1000 | 24,734 |
| Anlık engellemeyi en yükseğe çıkar | 1 / 1 | 1000 / 1000 | 24 |
| Anlık engellemeyi en yükseğe çıkar | 3 / 3 | 1000 / 1000 | 20 |
| Eşleşmeyen yeteneği sakla, genel kalkanı kullan | 0 / 0 | 734 / 1000 | 24,734 |
| Daima genel kalkan | 0 / 0 | 0 / 1000 | 11,204 |

Bu sonuçlar, yanlış özel savunmanın 0 engellediği düzeltilmiş kurala aittir. Anlık en yüksek engellemeyi seçen betik artık eşleşme yoksa doğru olarak genel kalkanı seçer. İyi oynayan bu betik için demo ve eğitim bonusu belirgin biçimde oyuncu lehinedir: test edilen eğitimli politikalar 1000 seed’in tamamını kazandı. Bilinen sınırlama: eğitim bonusuyla bu basit tekrar eden iyi taktik baskındır; ezberlenebilir strateji sorunu çözülmüş sayılmaz. Bu, bütün oyuncu kararlarının kazanacağı veya kapsamlı oyun dengesinin tamamlandığı anlamına gelmez; salt genel kalkan politikası bütün örneklerde kaybetti. Denge geçicidir; bu prototip temel oynanışın eğlencesini değerlendirmek içindir. Bütün örnek maçlar 150 tur sınırına ulaşmadan bitti. Bunlar insan oyun testi veya kapsamlı oyun dengesi araştırması yerine geçmez.

## Sınırlar

Motor yerel tek oyunculu demodur; sunucu, hesap, çevrimiçi eşleştirme, kriptografik rastgelelik veya hile önleme içermez. JSON kaydı uygulamanın kendi güvenilir yerel durumudur; kullanıcı tarafından değiştirilmiş/veri yapısı bozulmuş kayıtlar için arayüz sürüm/biçim kontrolü yapmalı veya yeni oyun başlatmalıdır. Motorun testleri görsel erişilebilirlik veya tarayıcı animasyonlarını kapsamaz.
