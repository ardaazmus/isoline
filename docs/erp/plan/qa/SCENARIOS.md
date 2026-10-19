# ISOLINE — E2E ve negatif güvenlik senaryoları

## S1 Danışman-first

Danışman A kayıt ve ekip daveti yapar. Provisional müşteri X açar, 2026 TSRS/Faaliyet projesini tanımlar. X'in şirket yetkilisi claim eder. Tesisleri ve görevleri atar. Raporlar üretilir. **Geçmesi gerekenler:** danışman mülkiyet iddiası yapmaz; claim öncesi release yok; X yetkileri kontrol eder.

## S2 Company-first + sonradan danışman

Şirket Y kayıt olur ve 2026 dönemini açar. Veri toplar, 2025/2026 çoklu metrikleri hesaplar. Dış danışman B'ye yalnız rapor yazım/inceleme izni verir; B revizyon ve kaynaklı metin önerir. Y yönetim imzasıyla release yapar. **Geçmesi gerekenler:** B başka tesis/kontrat verisi göremez, rapor Y'de kalır.

## S3 Cross-tenant BOLA

Tenant A ve B kayıtları; A'ya ait gerçek `task/evidence/metric/report/release` UUID'leri ile B kullanıcısı GET/POST/PATCH/DELETE/EXPORT/SIGNED-URL çağrısı yapar. **Beklenen:** her denemede erişim reddi; etkili veri mutasyonu yok; response içinde A adı/sayı/kanıt metadatası yok.

## S4 Review, kanıt ve idempotency

Katkıcı A veri+kanıt gönderir; aynı dosya 2 kere; sistem bir duplikasyon uyarısı ve tek uygun observation oluşturur. Reviewer ret eder; katkıcı düzeltir; ikinci kişi onaylar. İlk kişinin kendi onay denemesi reddedilir. Denetim geçmişi tam.

## S5 Yıl, sınır, veri revizyonu

2025 dondurulmuş; 2026 kapsamında ortasında satın alınan tesis; GHG equity ve operational control ile finansal boundary farklı sonuç; faktör 2026 güncellemesi. 2025 raporu ve yayımlanmış 2026 ilk sürüm değişmez. Yeni `amendment` oluşturulabilir.

## S6 Rapor devri

Onaylı metric facts ve iki rapor türü; bir fact değiştirilir, bir bölüm `stale` olur. Yöneticinin yeni approval olmadan final export/release denemesi bloke. Yeniden onay ile DOCX/XLSX/SVG/manifest birbirine uyan fact IDs ile üretilir. Tasarım ajansı yalnız paylaşılmış varlıklara erişir.

## S7 Düzenleme sürümü

TSRS kuralı 2025/2026 kararına göre, AB ESRS 2026/1563 için 19.10.2026 tarihinde `published_future_effective`; 2027/ilgili erken kullanımda açıklama kararı. GRI 102/103 2027 ve GRI 11–14 sektör özel gereksinimleri ayrı koşullu. Kaynak ve sürüm görünmeden 'compliant' sonucu yok.

## S8 Erişilebilir UX

Hareketi azalt tercihiyle 3D animasyon kapanır; kullanıcı klavye/tablo aracılığıyla tesis/veri durumu görür, formu tamamlar, onayı izler. Grafiklerde tablo verisi ve birim bulunur. UI'nın başarısı 3D'nin çalışmasına bağlı olmaz.
