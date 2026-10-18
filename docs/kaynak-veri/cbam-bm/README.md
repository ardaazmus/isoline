# SKDM kıyas değerleri ve üretim rotaları

## Kaynaklar

- **Kıyas değerleri:** Komisyon Uygulama Tüzüğü (AB) 2025/2620 (16.12.2025, Resmî Gazete L, 22.12.2025), Ek, nokta 5.3 "CBAM benchmark values".
  - HTML: https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32025R2620
  - PDF: https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=OJ:L_202502620
  - Her ikisi `raw/` klasöründe; 18.10.2026'da indirildi.
- **Üretim rotaları:** Komisyonun varsayılan değer dosyası (Uygulama Tüzüğü 2026/1740 ile düzeltilen 2025/2621 Ek I). F sütunu: "Underlying production route determining CBAM BM".
  - Türkiye sayfası kullanılır. Türkiye'de "–" olan kodlarda "Other Countries and Territories" sayfası geçerlidir (`../raw/DV_correcting_act_final_update_06.08.xlsx`).
- **Lisans:** © Avrupa Birliği; EUR-Lex içeriğinin yeniden kullanımına Komisyon Kararı 2011/833/AB ile izin verilir.

## Dosyalar

- `cbam_benchmarks.csv`: 570 satır. Sütunlar: KN kodu, açıklama, A sütunu (BMg*, süreç kıyası) ve B sütunu (BMg, varsayılan kıyas). Değerler göstergeleriyle olduğu gibi yazıldı, örneğin `1,370 (C) | 0,481 (D) | 0,072 (E)`.
- `cbam_routes.csv`: varsayılan değer dosyasının Türkiye ve diğer ülkeler sayfalarındaki her KN satırının rota sütunu ve toplam değeri.
- Çıkarma betikleri `web/scripts/extract/` klasöründe:
  - `cbam-benchmarks.mjs`: HTML tablosundan;
  - `cbam-routes.mjs`: Excel'den;
  - `verify-cbam-benchmarks-pdf.mjs`: PDF ile karşılaştırma.

## Göstergeler (nokta 5.3)

- (1) 2026–27, (2) 2028–30 üretim yılları.
- (A) gri, (B) beyaz klinker/çimento.
- (C) karbon çeliği BF/BOF, (D) DRI/EAF, (E) hurda/EAF.
- (F), (G), (H) düşük alaşımlı çelik aynı rotalar; (J) yüksek alaşımlı çelik (EAF).
- (K) birincil, (L) ikincil alüminyum.

## Uygulamadaki kurallar

- **Varsayılan değer kullanılan ürün:** B sütunu, varsayılan değer tablosunun rotasıyla (nokta 5.1). Birden fazla çelik alaşım değeri varsa üretim yılının en yüksek değeri alınır.
- **Gerçek veri kullanılan ürün:**
  - A sütunu artı öncül malzemelerin payı (Denklem 2–4).
  - Öncül payı tedarikçiden gelir. Gelmezse B − A farkı varsayılır; bu, varsayılan rotadaki öncül payının karşılığıdır.
  - Rota kullanıcı tarafından seçilebilir.
- **Elektrik (KN 2716):** ücretsiz tahsis düzeltmesi sıfırdır (Madde 1/2).
- **Kod düzeyi:** Türkiye varsayılan tablosunun 260 kodunun 252'si çözümlenir. Kalan 8'i, alt kodlarının kıyasları farklı olan başlıklar; uygulama bunlarda 8 haneli KN kodu ister: 7205, 7227, 7228 30, 7228 50, 7229, 7304 59, 7318 15, 7318 16.

## Doğrulama

1. HTML'den çıkarılan 570 satırın her biri, Resmî Gazete PDF'inin metniyle karşılaştırıldı.
   - Yöntem: `pdftotext -raw` ile metin çıkarıldı. Her KN kodunun satırından sonraki değer dizisi, A sütunu ve ardından B sütunuyla aynı olmalı.
   - Sonuç: 570/570, fark yok.
   - Açıklamalardaki "0,021 mm" ve "0,0008 %" gibi birimli sayılar değer sayılmadı.
2. Rota sütunu, Excel'deki satır numarasıyla birlikte aynen aktarıldı. Türkiye tablosundaki 260 değerli satırın her biri için bir rota kaydı var.
