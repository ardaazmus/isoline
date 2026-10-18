# Doğrulama paketi

Faz 2'nin kapanış kontrolü şu: hesapların bağımsız bir tabloyla karşılaştırılması ve sapmanın %0,5'in altında kalması. Bu paket o karşılaştırmayı tekrarlanabilir hâle getirir. Her vaka bir dosyadır ve şunları taşır:

- girdi,
- beklenen sonuç,
- kaynak,
- tolerans.

Test çalıştırıcısı her vakayı uygulamanın gerçek hesap motorlarında çalıştırır ve sonucu beklenenle karşılaştırır.

```
npm run validate         # vakaları çalıştırır, validation/RESULTS.md dosyasını yazar
npm run validate:build   # sentetik vakaları yeniden üretir (scripts/validation/build-cases.mjs)
npm test                 # vakalar normal test takımının da parçasıdır
```

## Beklenen sonuç nereden gelir

Beklenen değer hiçbir zaman uygulamanın hesap koduyla üretilmez.

- **Sentetik vakalar:** `scripts/validation/rat.mjs` kullanılır. Bu, BigInt tabanlı tam kesir aritmetiğidir; kayan nokta hatası yoktur. Formüller yayımlanmış metinden doğrudan yazılır. Resmi parametreler (TÜİK, ETKB, DESNZ, SKDM faktörü, işaretleme payı, kıyas) üreticide kaynaklarıyla birlikte sabit olarak durur.
- **Resmi çözümlü örnekler ve şirket raporları:** Beklenen değer belgede yayımlanan sayıdır; belge, sayfa ve tablo belirtilir.

## Vakalar

| Vaka | Profil | Ne sınanıyor |
|---|---|---|
| `p1-local-producer-2024` | Yerel üretici | Kapsam 1: TÜİK 2024 ısıl değer ve CO₂ faktörü, IPCC AR6 GWP. Kapsam 2: ETKB 2023, konum ve piyasa bazlı. Kapsam 3: DESNZ 2026. Kütüphanenin bu resmi değerleri taşıdığı da kontrol edilir. |
| `p2-cbam-exporter` | SKDM ihracatçısı | Varsayılan değerli iki ürün (Türkiye ve Çin menşeli) ve öncül paylı gerçek veri; 2026 ve 2028. İşaretleme payı, SKDM faktörü, CSCF, kıyas, ücretsiz tahsis düzeltmesi, sertifika ve maliyet. |
| `p3-revision-2023` | Geriye dönük revizyon | ETKB 2022 ile hesaplanmış 2023 envanterinin ETKB 2023'e taşınması: önce/sonra toplamlar, değişen kalemler, yıla göre sürüm seçimi. |
| `p3-threshold-exact-5pct`, `p3-threshold-below-5pct` | Revizyon | Kapsam 1+2 değişimi tam %5'te anlamlı, %4,9975'te değil. |
| `s1-stress-mizan-10k` | Stres | 10.238 satırlık sentetik mizan; alt hesaplar, gizli ana hesaplar, Türkçe sayı biçimi. Kuruşu kuruşuna net satış ve borç/alacak dengesi, süre sınırı. |
| `s2-reconcile-edges` | Stres | Uzlaştırma eşiklerinin tam sınırı: U1 ±%0,5, U8 ±%20, U9 eşiği. |

Gerçek kaynaklı vakalar (resmi çözümlü örnekler, şirket raporları, EPA GHGRP) eklendikçe bu tabloya girer.

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

- **AB ETS veritabanı:** Tesislerin yalnız doğrudan emisyonlarını içerir; elektrik tüketimi ve şebeke faktörü yoktur. Kapsam 2 doğrulamasında kullanılamaz, Kapsam 1 toplamlarını karşılaştırmada kullanılabilir.
- **OpenLCA ile kullanılan ecoinvent:** Lisanslı olduğu için kullanılmadı.
- **Kaggle veri setleri:** Kaynağı izlenemeyenler kullanılmadı.
