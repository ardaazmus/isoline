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

Tamamlanan (18.10.2026): faktör kütüphanesi ve "kendi faktörünü getir" modülü; resmi SKDM varsayılan değerleri (Türkiye, 2026/1740, toplam sütunu, "diğer ülkeler" kuralıyla 260 satır); EEA ENER038 2024 şebeke yoğunlukları (27 üye ülke ve AB-27); Türkiye dışındaki tesisler için konum bazlı şebeke faktörü. Ham kaynaklar ve SHA-256 özetleri: [kaynak-veri/](kaynak-veri/README.md).

Tamamlanan (18.10.2026): uzlaştırma kuralları v1 tarayıcıda (U1–U5, U8–U10; motor `web/src/lib/reconcile.ts`, ekran "Uzlaştırma"). Kuralların kimliği, ciddiyeti, toleransı ve dayanağı var. Her sonuç değerleri ve açıklamasıyla CSV/JSON olarak dışa aktarılıyor. Yeşil iddia metni artık müşteriye kaydediliyor ve U10 aynı metni denetliyor.

Tamamlanan (18.10.2026): mizan içe aktarma (Excel xlsx/xls, OpenDocument, CSV; SheetJS 0.20.3 resmi dağıtımı, tarayıcıda). Başlık satırı kendiliğinden bulunuyor, alt hesaplar ana hesaplarda çift sayılmadan toplanıyor, borç = alacak dengesi ve kapanış durumu denetleniyor, dosyanın SHA-256 özeti kanıt olarak saklanıyor. Net satışlar U1'de referans. Açık: Tekdüzen Hesap Planı kodlarının resmi metinden uzman teyidi; CapEx için sabit kıymet hareket tablosu (Faz 5, U6–U7).

Tamamlanan (18.10.2026): envanter ve göstergeler için Excel (xlsx, xls, ods) ve CSV içe aktarma. Göstergeler tesis ve dönem bazında, satır başına bir gösterge olarak okunuyor. Akışlar toplanıyor; dönem sonu sayıları her tesisin son döneminden alınıyor; birimler çevriliyor (MWh, kWh, TEP, ML, kg, %). Her içe aktarma dosya adı, SHA-256 özeti ve satır sayısıyla müşterinin içe aktarma kaydına işleniyor.

Tamamlanan (18.10.2026): sürümlü faktör tabloları.
- ETKB 2020–2023 yıllık sürümleri; değerler PDF'lerden aktarıldı ve belgelerle makineyle karşılaştırıldı.
- DESNZ 2026 Kapsam 3 seçkisi (51 faktör, OGL v3); Kapsam 3 kategorisine göre öneriliyor.
- TÜİK ulusal envanter 2026 (2024 ısıl değerleri ve CO₂ faktörleri).
- Envanter yılına göre sürüm seçimi; yeni sürümde önce/sonra raporlu geriye dönük yeniden hesap ve GHG Protokolü %5 anlamlılık uyarısı.
- Kaynaklar ve SHA-256 özetleri: [kaynak-veri/](kaynak-veri/README.md).

Tamamlanan (18.10.2026): SKDM resmi kıyas değerleri ve rota eşlemesi.
- Uygulama Tüzüğü 2025/2620 Ek nokta 5.3 (570 KN satırı) alındı; Resmî Gazete PDF'iyle 570/570 eşleşti.
- Varsayılan değerde B sütunu, Türkiye varsayılan tablosunun rotasıyla kullanılıyor; birden fazla alaşım değeri varsa en yükseği, üretim yılına göre (1)/(2) değeri.
- Gerçek veride A sütunu ile öncül malzeme payı toplanıyor (varsayılan pay: B − A); rota seçilebiliyor.
- Örnek kıyas yer tutucuları kaldırıldı; elle kıyas girmek yalnız bilinçli tercih olarak duruyor.

Kod dışında yapılacak iş:
- Uzman teyitleri.
- IEA lisans görüşü.

Kodda yapılacak iş:
- **Faktör kütüphanesi:** TÜİK 2023 ısıl değerleri (ortak raporlama tabloları indirilebildiğinde); ETKB 2024 sürümü yayımlandığında eklenmesi.
- **SKDM:** diğer menşe ülke tabloları (Türkiye tablosu ve kıyaslar tamam).
- **TR ETS:** Başkanlık kıyas değerleri ve Ulusal Tahsisat Planı yayımlanınca parametre güncellemesi.
- **SBTi V2.0:** Ç4 2026'da yayımlanacak yöntemlerin eklenmesi.

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
