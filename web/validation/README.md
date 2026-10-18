# Doğrulama paketi

Faz 2'nin kapanış kontrolü şu: hesapların bağımsız bir tabloyla karşılaştırılması ve sapmanın %0,5'in altında kalması. Bu paket o karşılaştırmayı tekrarlanabilir hâle getirir. Her vaka bir dosyadır ve şunları taşır:

- girdi,
- beklenen sonuç,
- kaynak,
- tolerans.

Test çalıştırıcısı her vakayı uygulamanın gerçek hesap motorlarında çalıştırır ve sonucu beklenenle karşılaştırır.

```
npm run validate         # vakaları çalıştırır, validation/RESULTS.md dosyasını yazar
npm run validate:build   # vakaları yeniden yazar (build-cases.mjs sentetik, real-cases.mjs yayımlanmış kaynaklı)
npm test                 # vakalar normal test takımının da parçasıdır
```

## Beklenen sonuç nereden gelir

Beklenen değer hiçbir zaman uygulamanın hesap koduyla üretilmez.

- **Sentetik vakalar:** `scripts/validation/rat.mjs` kullanılır. Bu, BigInt tabanlı tam kesir aritmetiğidir; kayan nokta hatası yoktur. Formüller yayımlanmış metinden doğrudan yazılır. Resmi parametreler (TÜİK, ETKB, DESNZ, SKDM faktörü, işaretleme payı, kıyas) üreticide kaynaklarıyla birlikte sabit olarak durur.
- **Yayımlanmış kaynaklı vakalar (`r-*`):** Beklenen değer belgede basılı sayıdır; belge, sayfa ve tablo belirtilir. Girdiler de belgeden alınır. `scripts/validation/real-cases.mjs` girdilerde yalnız tam birim dönüşümü yapar (1 lb = 0,45359237 kg; 1 mmBtu = 1,05505585262 GJ). Orijinal belgeler ve SHA-256 özetleri [docs/kaynak-veri/dogrulama/](../../docs/kaynak-veri/dogrulama/README.md) klasöründedir.

## Vakalar

| Vaka | Profil | Ne sınanıyor |
|---|---|---|
| `p1-local-producer-2024` | Yerel üretici | Kapsam 1: TÜİK 2024 ısıl değer ve CO₂ faktörü, IPCC AR6 GWP. Kapsam 2: ETKB 2023, konum ve piyasa bazlı. Kapsam 3: DESNZ 2026. Kütüphanenin bu resmi değerleri taşıdığı da kontrol edilir. |
| `p2-cbam-exporter` | SKDM ihracatçısı | Varsayılan değerli iki ürün (Türkiye ve Çin menşeli) ve öncül paylı gerçek veri; 2026 ve 2028. İşaretleme payı, SKDM faktörü, CSCF, kıyas, ücretsiz tahsis düzeltmesi, sertifika ve maliyet. |
| `p3-revision-2023` | Geriye dönük revizyon | ETKB 2022 ile hesaplanmış 2023 envanterinin ETKB 2023'e taşınması: önce/sonra toplamlar, değişen kalemler, yıla göre sürüm seçimi. |
| `p3-threshold-exact-5pct`, `p3-threshold-below-5pct` | Revizyon | Kapsam 1+2 değişimi tam %5'te anlamlı, %4,9975'te değil. |
| `r-epa-ghgrp-steel-dynamics-2023` | Yerel üretici | US EPA GHGRP tesis kaydı (tesis 1004616, 2023): 4.011.026.965 scf doğal gaz, 40 CFR 98 Tablo C-1 faktörleri. Raporlanan değer 218.358,5 t CO₂. |
| `r-epa-cccl-boiler` | Yerel üretici | EPA'nın çözümlü kazan örneği: 6.000.000 scf = 6.150 mmBtu, 326,3 t CO₂. Enerji ve emisyon. |
| `r-ghgp-scope2-location` | Yerel üretici | GHG Protokolü Kapsam 2 Tablo 6.4: dört tesis, her biri kendi şebeke faktörüyle (eGRID lb/MWh dönüşümü dahil). 3.091,908 t CO₂. |
| `r-ghgp-scope2-market` | Yerel üretici | GHG Protokolü Tablo 6.5: sertifikalı MWh, tedarikçi faktörü, kalan karışım. 2.250 t CO₂e. |
| `r-cbam-cement-5a` | SKDM ihracatçısı | AB Rehberi 5a: çimentoda dolaylı emisyon sayılır; A sütunu 0 + klinker öncülü; 2026 FAA ve 26 sertifika. |
| `r-cbam-steel-rails-5d` | SKDM ihracatçısı | AB Rehberi 5d Örnek 1: ray için A sütunu 0,057 + ham çelik öncülü; 2027 faktörü; FAA 11.980. Çelikte yalnız doğrudan emisyon sayılır (bkz. "Bulgular"). |
| `r-cbam-hydrogen-5b` | SKDM ihracatçısı | AB Rehberi 5b: hidrojen kıyası 5,089, 2028 faktörü, 381,6 sertifika. |
| `r-cbam-default-lookup-4` | SKDM ihracatçısı | AB Rehberi 4, Tablo 2-3 ve 2-4: varsayılan değere %10, %20 ve %30 işaretleme payı. KN 7318 15 için rota (C) kıyası 1,364; dönem kıyası 1,154 ve 1,116. |
| `r-cbam-factor-table-4` | SKDM ihracatçısı | AB Rehberi 4, Tablo 2-1: 2026–2034 SKDM faktörü × CSCF. |
| `s1-stress-mizan-10k` | Stres | 10.238 satırlık sentetik mizan; alt hesaplar, gizli ana hesaplar, Türkçe sayı biçimi. Kuruşu kuruşuna net satış ve borç/alacak dengesi, süre sınırı. |
| `s2-reconcile-edges` | Stres | Uzlaştırma eşiklerinin tam sınırı: U1 ±%0,5, U8 ±%20, U9 eşiği. |

Son çalıştırmanın sonuçları [RESULTS.md](RESULTS.md) dosyasında. Yayımlanmış kaynaklı vakalarda en büyük sapma %0,14 (ray vakası). Sebebi, rehberin SEFA'yı yuvarlanmış ara değerlerle basması.

## Bulgular

- **AB çelik rehberi tüzükle çelişiyor.**
  - Rehber 5d (s. 44), 10.000 t ray için sertifika sayısını 15.670 − 11.980 = 3.690 olarak basıyor. 15.670'in içinde 280 t dolaylı emisyon var.
  - Tüzük 2023/956 Ek II ise demir-çeliği yalnız doğrudan emisyonun sayıldığı mallar arasında listeliyor. Aynı tarihli Rehber No. 1 de bunu tekrarlıyor (PDF s. 10).
  - Uygulama tüzüğü izliyor ve 3.410 buluyor. Vaka bu değeri bekliyor; rehberin basılı sayısı vaka notunda duruyor. Konu, kök README'deki uzman teyidi listesine eklendi.
- **Yakıt satırlarında CH₄ ve N₂O yok.** Uygulama EPA vakalarının CO₂e toplamından %0,10 ve %0,12 sapıyor; sabit yakmada bu, %0,5 hedefinin altında. Araçlarda fark büyüyor. Yol haritasında açık iş olarak duruyor.
- **Araştırmanın bulduğu yayın hataları** (bu örnekler vaka olarak kullanılmadı):
  - Rehber 5d Örnek 2'de FeCr varsayılan değeri 2,280 basılmış. Doğrusu 2,820: hem Uyg. Tüz. 2025/2621 Ek I'deki değer bu, hem tablonun kendi çarpımı bununla tutuyor.
  - Aynı örnekteki boru SEE'si (1,783), basılı girdilerle yeniden üretilemiyor; hesap yaklaşık 1,803 veriyor.
  - GHG Protokolü eğitim setindeki Örnek 3b'nin toplamı, satırlarının toplamıyla tutmuyor.

## Gerçek bir vaka nasıl eklenir

`cases/<id>.json` dosyası oluşturun. Alanlar:

- `id`, `profile`, `title`;
- `source`: `kind`, `cite`, `url`, `page`;
- `engine`: `ghg`, `cbam`, `recalc`, `mizan` ya da `reconcile`;
- `input`: motorun girdisi;
- `expected`: yayımlanan sonuçlar;
- `tolerance.relative`: varsayılan 0,005, yani %0,5.

Şirket raporlarında sapma yorumlanırken dikkat: Rapor kendi ısıl değer ve faktörlerini açıklamıyorsa %0,5'i aşan fark çoğu zaman yöntem farkıdır, hesap hatası değil. Bu yüzden şirketin açıkladığı faktörler girdiye "kendi faktör setin" olarak konur.

## Değerlendirilip kullanılmayan kaynaklar

- **Türk borsa şirketlerinin raporları:**
  - İncelenenler: Akçansa 2024, Çimsa 2024, Erdemir ve İsdemir 2025.
  - Hiçbiri emisyon faktörü ya da ısıl değer açıklamıyor. Yakıt miktarını da sınırın tamamı için fiziksel birimde vermiyor.
  - Bu yüzden kesin vaka olamazlar; yalnız makullük kontrolünde işe yararlar.
  - İsdemir 2024 ile 2025 arasında yöntem değiştirdi (Türkiye MRV'den GHG Protokolü'ne). Bu, iki yılı karşılaştırmayı da zayıflatıyor.
- **SEE'yi tesis düzeyinde hesaplayan AB örnekleri** (Rehber 5d Örnek 2 ve 3; alüminyum, gübre ve elektrik rehberleri): Uygulama SEE'yi tesisin kütle dengesinden hesaplamıyor, kullanıcıdan alıyor. Bu örnekler, SKDM operatör modülü geldiğinde vakaya dönüşecek.
- **IPCC 2006 Cilt 2 ve GHG Protokolü sabit yakma aracı:** Sayısal çözümlü örnek içermiyorlar.

- **AB ETS veritabanı:** Tesislerin yalnız doğrudan emisyonlarını içerir; elektrik tüketimi ve şebeke faktörü yoktur. Kapsam 2 doğrulamasında kullanılamaz, Kapsam 1 toplamlarını karşılaştırmada kullanılabilir.
- **OpenLCA ile kullanılan ecoinvent:** Lisanslı olduğu için kullanılmadı.
- **Kaggle veri setleri:** Kaynağı izlenemeyenler kullanılmadı.
