# Isoline yol haritası (17.10.2026 itibarıyla)

Her faz bir **kontrol noktasıyla** biter. Bir sonraki faz, kontrol noktasındaki denetim geçmeden başlamaz.

## Faz 1 — Çalışan araç seti (tamamlandı, v0.1)

- **Araçlar:** 15 ekran; kapsam testi, mevzuat takvimi, rapor akışı, karbon/çevre/sosyal hesaplayıcılar, faaliyet raporu kontrolü, 11 Word şablonu, çerçeve eşleme.
- **Dil:** JSON tabanlı, dosya bırakılarak eklenebilir; Türkçe ve İngilizce hazır.
- **Görsel dil:** mavi dünya üzerinde aile renk hiyerarşisi (karbon toprak-turuncusu, çevre su mavisi, insan yeşil, raporlama lacivert), cam bento döşemeler, gren dokulu sonuç bandı; yalnız açık tema.
- **Testler:** 40 birim, özellik tabanlı ve dil eşitliği testi.

**Kontrol noktası:** uzman paneli, DOĞRULANAMADI işaretli 8 konuyu birincil metinden teyit eder (README'deki liste). Sonuçlar `sources.ts` dosyasında `official` olarak güncellenir.

## Faz 2 — Veri doğruluğu ve faktör kütüphanesi (sürüyor)

Tamamlanan (17.10.2026): birincil kaynak doğrulaması ([DOGRULAMA_2026-10.md](DOGRULAMA_2026-10.md)), envanter için CSV toplu yükleme, kapsam testinde küçük finans kuruluşu muafiyeti ve AB dışı iki yıl ciro kuralı. Faz 4'ten öne alınanlar: yeşil iddia denetimi, SKDM operatör veri özeti.

Kod dışında yapılacak iş:
- Uzman teyitleri.
- IEA lisans görüşü.

Kodda yapılacak iş:
- **Faktör kütüphanesi:** sürümlü faktör tabloları (ETKB yıllık, DESNZ 2026, TÜİK ulusal envanter NCV'leri); yıl seçimi ve geriye dönük yeniden hesap.
- **SKDM:** varsayılan değer tablosunun KN + ülke ile içe aktarılması (2025/2621 + 2026/1740), kıyas değerleri ve rota eşlemesi (2025/2620).
- **TR ETS:** Başkanlık kıyas değerleri ve Ulusal Tahsisat Planı yayımlanınca parametre güncellemesi.
- **SBTi V2.0:** Ç4 2026'da yayımlanacak yöntemlerin eklenmesi.
- **Excel içe aktarma:** envanter ve göstergeler için şablonlu Excel yükleme.

**Kontrol noktası:** 3 gerçek, anonimleştirilmiş müşteri verisiyle hesapların bağımsız tabloyla karşılaştırılması (sapma < %0,5).

## Faz 3–6 — Denetime hazır platform

17.10.2026'da hedef yeniden tanımlandı: finans ve ESG verisini aynı omurgada birleştiren, her sayıyı kanıta bağlayan ve bağımsız denetçiye onaya hazır paket sunan platform. Ayrıntılar, veri modeli, iş akışı ve teknik seçimler: [HEDEF_MIMARI.md](HEDEF_MIMARI.md).

| Faz | Kapsam | Kontrol noktası |
|---|---|---|
| 3 — Platform çekirdeği | Kimlik doğrulama, kiracı/müşteri/rol modeli, PostgreSQL + RLS, veri noktası sicili, sürümleme, kanıt deposu (SHA-256), olay günlüğü | İki kiracıyla izolasyon testi, olay günlüğü bütünlük testi |
| 4 — Denetime hazır paket | Durum makinesi, onay ve kilit, PBC listesi, denetçi çalışma alanı (ISSA 5000 / GDS 3000 adımlarına eşli) | Bir güvence kuruluşuyla deneme denetimi |
| 5 — Boşluk analizi ve yapay zekâ | Gereklilik haritası, olgunluk puanı, kaynaklı taslak yazımı, yatırım ↔ etki uzlaştırması | Yapay zekâ önerilerinin tamamında kaynak ya da "kanıt yetersiz" ibaresi |
| 6 — Entegre rapor ve dijital çıktı | Entegre rapor şablonu, ESRS iXBRL, e-Defter (XBRL-GL) içe aktarma, KAP ön kontrolü | Pilot müşteriyle uçtan uca raporlama döngüsü |

Faz 2'ye eklenenler: uzlaştırma kuralları v1 (tarayıcıda) ve Excel'den mizan içe aktarma.

## Ticari notlar (araştırma D)

- **Konumlanma:** Türkiye'de danışmanlık firmaları için tarafsız, çok müşterili ve TSRS'yi esas alan görsel araç boşluğu var.
- **Ürün kapsamı:** faaliyet raporu ile sürdürülebilirlik raporu tek motorda üretiliyor; SKDM maliyet simülatörü AB ithalatçısına veri paketi de çıkarıyor.
- **Acil fırsat:** TR ETS pilot tesisleri için izleme planı son tarihi yaklaşık 27.10.2026.
- **Hibe:** Ticaret Bakanlığı danışmanlık hibesi (%50) hedef kullanıcıyı finanse ediyor.
