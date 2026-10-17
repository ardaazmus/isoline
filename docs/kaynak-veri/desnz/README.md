# DESNZ 2026 dönüşüm faktörleri (Kapsam 3 seçkisi)

Kaynak: Birleşik Krallık Enerji Güvenliği ve Net Sıfır Bakanlığı (DESNZ), "Greenhouse gas reporting: conversion factors 2026". https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026

- **Yayım:** 11.06.2026. 31.07.2026'da yalnız düz biçimli dosya düzeltildi; sayfaya göre tam set değişmedi.
- **Lisans:** Open Government Licence v3.0. Kaynak gösterilerek ticari kullanım dahil serbest. Örnek atıf: "Contains public sector information licensed under the Open Government Licence v3.0".

## Dosyalar

- `raw/ghg-conversion-factors-2026-full-set.xlsx`: değerlerin alındığı tam set.
- `raw/ghg-conversion-factors-2026-flat-format-revised.xlsx`: doğrulamada kullanılan düz biçimli dosya (sürüm 1.2).
- `desnz_scope3.csv`: 51 satırlık seçki. Her satırda sayfa, satır ve not sütununda değer hücresi var. Değer, "kg CO2e" toplam sütunudur.

## Seçki

| Grup | Kapsam 3 kategorisi | İçerik |
|---|---|---|
| Navlun | 4, 9 | kamyon, hafif ticari, tren, dökme yük ve konteyner gemisi, hava kargo (birim tonne.km) |
| Hava yolculuğu | 6 | iç hat, kısa, uzun ve uluslararası uçuşlar; ışınımsal zorlama (RF) dahil (birim passenger.km) |
| Kara yolculuğu | 6, 7 | ortalama araba (km), ulusal ve uluslararası tren, otobüs, taksi |
| Otel | 6 | Türkiye ve Birleşik Krallık, oda başına gece |
| Yakıtların kuyudan tanka (WTT) emisyonu | 3 | doğal gaz, motorin, benzin, LPG, fuel oil, kömür |
| Atık | 5, 12 | düzenli depolama, yakma, açık/kapalı döngü geri dönüşüm, kompost, anaerobik çürütme |
| Malzeme | 1, 2 | hurda metal, çelik ve alüminyum kutu, plastik, kâğıt-karton, beton, cam |
| Su | 1 (temin), 5 (arıtma) | m³ başına |

## Doğrulama

1. Araştırma adımı her değeri tam setin adı verilen hücresinden okudu ve etiketleri, birimleri denetledi.
2. Ardından içe aktarmadan önce bağımsız bir betikle yeniden denetlendi. Kriter: her satır, düz biçimli dosyada birebir aynı etiketlerle, aynı birimle, "kg CO2e" olarak ve aynı değerle bulunmalı.
   - Sonuç: 51/51. Ortalama araba satırı aynı değerle üç tabloda geçiyor; bunlardan biri iş seyahati tablosu.
3. Beş hücre ayrıca okundu: Freighting goods D63, Business travel- air E28, Business travel- land X53, Hotel stay D77, Waste disposal I88.

## Uygulamaya giriş

`npm run factors` betiği `web/src/data/factors/desnz-2026.json` dosyasını yazar. Uygulama kg CO₂e değerini t CO₂e'ye çevirir (÷ 1000). Her faktör uygun Kapsam 3 kategorileriyle işaretlidir; satırın kategorisine uyanlar önerilir.

Ayrıntılı İngilizce not, sapmalar (ör. 2026'da "All HGVs" satırı yok, ortalama soğutmasız kamyon kullanıldı) ve dosya özetleri: [../SOURCE_NOTES_desnz_tuik.md](../SOURCE_NOTES_desnz_tuik.md).
