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

## Faz 3 — Çok müşterili platform

- **Altyapı:** kimlik doğrulama, danışmanlık kiracısı ve müşteri çalışma alanları, roller (danışman, müşteri veri sahibi, onaylayıcı, denetçi), PostgreSQL ile satır düzeyi izolasyon. Çevrim dışı öncelik korunur; yerel ağda çalışır, gerektiğinde Cloudflare Tunnel ile açılır.
- **İş akışı:** veri talebi, kanıt dosyası yükleme, onay akışı ve değiştirilemez denetim izi.
- **Beyaz etiket:** danışmanlık firmasının logo ve rengi.

**Kontrol noktası:** iki kiracı ve üç müşteriyle izolasyon testi (sıfır sızıntı), rol izin matrisi testi.

## Faz 4 — Çıktı ve entegrasyon

- **Rapor çıktısı:** tasarım ajansı paketi (Word + grafik veri setleri + SVG), iki dilli içerik eşleme.
- **XBRL ve SKDM:** ESRS XBRL (EFRAG nihai taksonomisi 2026 sonu) önizleme ve dışa aktarım; SKDM operatör emisyon raporunun Komisyon şablonuna göre Excel çıktısı.
- **KAP ve CDP:** KAP TSRS bildirimi için ön kontrol; CDP yanıt yardımcısı.
- **Yeşil iddia tarayıcısı:** ECGT kapsamındaki yasak iddiaların rapor metninde işaretlenmesi.

**Kontrol noktası:** bir pilot danışmanlık firmasıyla uçtan uca bir raporlama döngüsü.

## Faz 5 — Kaynaklı yapay zekâ asistanı

- **Kaynaklı yanıt:** belgeden kanıt bulma, tablo çıkarma, çelişki tespiti, kaynaklı metin taslağı. Kaynak yoksa "kanıt yetersiz" yanıtı verir.
- **Kural:** sayısal hesap ve uyum kararı yalnız kural motoru ve insan onayıyla verilir.

## Ticari notlar (araştırma D)

- **Konumlanma:** Türkiye'de danışmanlık firmaları için tarafsız, çok müşterili ve TSRS'yi esas alan görsel araç boşluğu var.
- **Ürün kapsamı:** faaliyet raporu ile sürdürülebilirlik raporu tek motorda üretiliyor; SKDM maliyet simülatörü AB ithalatçısına veri paketi de çıkarıyor.
- **Acil fırsat:** TR ETS pilot tesisleri için izleme planı son tarihi yaklaşık 27.10.2026.
- **Hibe:** Ticaret Bakanlığı danışmanlık hibesi (%50) hedef kullanıcıyı finanse ediyor.
