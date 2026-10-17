# TÜİK ulusal envanteri: ısıl değerler ve CO₂ emisyon faktörleri (2024)

Kaynak: "Greenhouse Gas Inventory of Türkiye 1990-2024", National Inventory Document. Hazırlayan TÜİK; UNFCCC'ye sunuluş 14.04.2026.

- Resmi adres: https://unfccc.int/sites/default/files/resource/TUR_NID_2026.pdf
- Dosya: 7.731.757 bayt, MD5 `67cca463bc9ff044072f412890a8d477`, SHA-256 `f10af47855866194e8e71f745f3672c2213b9788316f9e929779f56736687946`.

## PDF neden depoda değil

- UNFCCC sitesi bot korumasının arkasında olduğu için kullanım koşulları okunamadı. Belgenin kendisinde de bir lisans ifadesi yok.
- Bu yüzden PDF yeniden dağıtılmıyor. Depoda yalnız ondan çıkarılan değerler, sayfa ve tablo konumlarıyla birlikte duruyor; bunlar kaynak gösterilen olgusal veriler.
- PDF, Climate Policy Radar aynasından indirildi. MD5 değeri, PRIMAP deposunun UNFCCC'den yaptığı indirmenin kaydıyla aynı.

## Dosyalar

- `tuik_ncv.csv`: Ek 4 "NCV of Fuels" (2024 sütunu, PDF s. 482), Tablo 3.17 (yalnız elektrik santralleri) ve amonyak üretimi için doğal gaz ısıl değeri (yalnız karşılaştırma için).
- `tuik_co2_ef.csv`: Tablo 3.7 "CO₂ emission factors of fuels" (2023 ve 2024, PDF s. 84), Ek 4 ülkeye özgü ve varsayılan faktörler, Tablo 3.18 (elektrik santralleri).

## Uygulamaya giren değerler (envanter yılı 2024)

| Yakıt (uygulama) | Isıl değer | Uygulamadaki birim | CO₂ EF (Tablo 3.7) |
|---|---|---|---|
| Doğal gaz | 34,54 TJ/10⁶ m³ | 0,03454 GJ/Sm³ | 55,9 t/TJ |
| Taş kömürü | 25,24 TJ/kt | 25,24 GJ/t | 95,6 t/TJ |
| Linyit | 8,35 TJ/kt | 8,35 GJ/t | 105,5 t/TJ |
| Fuel oil | 37,94 TJ/kt | 0,03794 GJ/kg | 77,0 t/TJ |
| LPG | 47,31 TJ/kt | 0,04731 GJ/kg | 63,1 t/TJ |
| Motorin | kütle başına; çevrilmedi | — | 72,3 t/TJ |
| Benzin | kütle başına; çevrilmedi | — | 69,3 t/TJ |

Birim çevirmeleri yalnız ölçek dönüşümüdür, `web/scripts/build-factors.mjs` içinde yazılıdır:

- TJ/10⁶ m³ → GJ/m³ için ÷ 1000;
- TJ/kt = GJ/t;
- GJ/t → GJ/kg için ÷ 1000.

Motorin ve benzin uygulamada litreyle sayılıyor. Yoğunluk varsaymamak için bu iki yakıtta yalnız emisyon faktörü alınıyor; litre başına ısıl değer yerinde kalıyor.

## Doğrulama ve açık noktalar

- Değerler PDF metninden iki kipte okundu: `pdftotext -raw` ve `-table`. Ek 4 ve Tablo 3.7 içe aktarmadan önce ayrıca elle karşılaştırıldı.
- Varsayılan `-layout` kipi bu tablolarda değerleri bir satır kaydırıyor; kullanılmamalı.
- Açık noktalar ayrıntılarıyla [../SOURCE_NOTES_desnz_tuik.md](../SOURCE_NOTES_desnz_tuik.md) dosyasında:
  - Tablo 3.7 ile Ek 4 ülkeye özgü faktörleri aynı yıl için biraz farklı. Ek 4 değerleri santral faktörleriyle aynı; uygulama tüm sektörleri kapsayan Tablo 3.7'yi kullanır.
  - Fuel oil ısıl değeri (37,94) santral ortalamasından (47,23) düşük; belgede bu şekilde yayımlanmış.
  - 2023 ısıl değerleri yalnız ortak raporlama tablolarında; bu tablolar indirilemedi.
- Yeni gönderim yayımlandığında:
  1. Değerleri ekleyin.
  2. `npm run factors` çalıştırın.
  3. Uygulamadaki envanteri "Faktör yılı ve sürümleri" bölümünden yeniden hesaplayın.
