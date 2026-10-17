# ETKB elektrik emisyon faktörleri (2020–2023)

Kaynak: T.C. Enerji ve Tabii Kaynaklar Bakanlığı, Enerji Verimliliği ve Çevre Dairesi Başkanlığı (EVÇED). Belge: "Türkiye Elektrik Üretimi ve Elektrik Tüketim Noktası Emisyon Faktörleri Bilgi Formu" (ETKB-EVÇED-FRM-042 Rev.01). Sayfa: https://enerji.gov.tr/evced-cevre-ve-iklim-elektrik-uretim-tuketim-emisyon-faktorleri (18.10.2026'da indirildi).

| Hesaplama yılı | Yayım tarihi | Revizyon | Dosya (`raw/`) |
|---|---|---|---|
| 2020 | 18.03.2024 | 01 | `2020_Uretim_Tuketim_EF.pdf` |
| 2021 | 18.03.2024 | 00 | `2021_TEUVETN_Emisyon_Faktorleri_Bilgi_Formu.pdf` (sitede `TEUVETN_Emisyon_Faktörleri_Bilgi_Formu.pdf` adıyla) |
| 2022 | 06.12.2024 | 00 | `2022_Uretim_Tuketim_EF.pdf` |
| 2023 | 26.12.2025 | 00 | `2023_Turkiye_Elektrik_UretimiveElektrik_Tuketim_Noktasi_Emisyon_Faktorleri.pdf` |

## Aktarım ve doğrulama

PDF'ler metin katmanlı. `etkb_grid.csv` her yıl için şu değerleri tCO₂/MWh ve tCO₂-eşd./MWh olarak içerir:

- Türkiye geneli üretim (sayfa 1);
- iletim ve dağıtım hattından bağlı tüketim noktası (sayfa 2);
- yakıt türüne göre santral faktörleri: linyit, taş kömürü, asfaltit, ithal kömür, doğal gaz, fuel oil, motorin (sayfa 2).

Değerler belgeden ondalık virgülüyle aynen aktarıldı. Aktarım makineyle denetlendi. Her satır için ilgili yılın belgesi `pdftotext -enc UTF-8 -raw` ile metne çevrildi ve iki şey arandı:

- başlıktaki "dönem, yayım tarihi, revizyon" dizisi;
- değer çiftinin doğru etiketin hemen ardından gelişi.

Sonuç: 40 satırın 40'ı eşleşti, 0 fark.

Uygulama tCO₂-eşd. değerini kullanır. Tüketim noktası faktörleri konum bazlı Kapsam 2'nin varsayılanıdır. Santral faktörleri kütüphaneden seçilebilir (ör. belirli bir santral türünden ikili anlaşmayla alınan elektrik).

Belgedeki yasal bilgilendirmeye göre EVÇED bilgileri önceden bildirmeksizin değiştirebilir. Yeni bir hesaplama yılı ya da revizyon yayımlandığında:

1. Yeni PDF'yi `raw/` klasörüne koyun.
2. CSV'ye satırları ekleyin.
3. `npm run factors` çalıştırın.
4. Doğrulamayı tekrarlayın.

Ardından uygulamadaki envanteri "Faktör yılı ve sürümleri" bölümünden yeniden hesaplayın.
