# Kaynak veri: uygulamadaki resmi faktör setleri

Bu klasör, Isoline'ın hazır faktör kütüphanesindeki iki resmi setin ham kaynağını, ayıklanmış tablolarını ve
SHA-256 özetlerini tutar. Uygulamadaki her değer buradaki dosyalardan betikle kopyalanır. Elle yazılmış,
tahmin edilmiş ya da yeniden hesaplanmış değer yoktur. Ayrıntılı İngilizce kaynak notu: [SOURCE_NOTES.md](SOURCE_NOTES.md).

| Set (uygulamada) | Kaynak | Sürüm | Lisans |
|---|---|---|---|
| `eu_cbam_dv_tr`: SKDM varsayılan değerleri, Türkiye | Avrupa Komisyonu, Uygulama Tüzüğü (AB) 2026/1740 Ek I (2025/2621'i düzeltir) | Excel v2, 6 Ağustos 2026 | CC BY 4.0, © Avrupa Birliği (Karar 2011/833/AB) |
| `eea_ener038`: elektrik üretiminin sera gazı yoğunluğu | Avrupa Çevre Ajansı (EEA), gösterge ENER038, şekil 2 (ülke) ve şekil 1 (AB-27) | 10 Temmuz 2026; 2024 erken tahmini | CC BY 4.0, kaynak: EEA |

## Dosyalar

- `raw/DV_correcting_act_final_update_06.08.xlsx`: Komisyon'un varsayılan değer dosyası (v2).
- `raw/eea_fig2_country_level_api.json`, `raw/eea_fig1_eu_level_api.json`: EEA şekil verileri (Plone REST API).
- `cbam_defaults_TR.csv`: Türkiye tablosunun 283 satırı ve Türkiye'de "–" olan 10 kod için "Diğer ülkeler ve bölgeler" satırı. Ondalık virgül, noktalı virgülle ayrılmış.
- `eea_grid_intensity.csv`: 27 üye ülke ve AB-27 için 2024 değerleri, gCO₂e/kWh.
- `SHA256SUMS`: ham dosyaların, ayıklanmış tabloların ve uygulamaya giren JSON'ların özetleri. Denetim: `sha256sum -c SHA256SUMS` (bu klasörde).

## Uygulamaya nasıl girer

`web/` klasöründe `npm run factors` komutu `web/scripts/build-factors.mjs` betiğini çalıştırır. Betik CSV'leri okur ve `web/src/data/factors/*.json` dosyalarını yazar. `web/src/lib/factors.ts` bu JSON'ları hazır set olarak kaydeder. Kurallar:

- **SKDM:** Değer olarak tüzüğün uyguladığı **toplam** sütunu alınır. Doğrudan ve dolaylı kısımlar yalnız bilgi olarak saklanır (2026/1740 gerekçe 10). Değeri olmayan satırlar alınmaz: "see below" başlıkları ve iki tabloda da "–" olanlar. Türkiye'de "–" olan kodlarda Ek I'deki kural uygulanır ve "Diğer ülkeler" değeri kullanılır; bu satırlar uygulamada işaretlidir. İşaretleme (mark-up) faktöre eklenmez, hesap motoru yıla göre ekler: çimento, demir-çelik, alüminyum ve hidrojende 2026'da %10, 2027'de %20, 2028'den itibaren %30; gübrede %1.
- **EEA:** gCO₂e/kWh değerleri tCO₂e/MWh'e çevrilir (÷ 1000). Bu bir **üretim** yoğunluğudur: ithalat ve ihracat dahil değildir, tüketim karışımı faktörü değildir. Uygulamada AB'deki tesisler için konum bazlı yaklaşık değer olarak sunulur ve bu not seçim alanında gösterilir.
- EEA'nın şekle eklediği CSV dosyası (`FIG2-291456-ENER038.csv`) **güncel değildir** ve kullanılmaz (bkz. SOURCE_NOTES.md, not 1). Bu yüzden depoya da alınmadı.

## Doğrulama

- Ham Excel'den beş satır elle kontrol edildi ve tablo ile birebir eşleşti. Örnekler: 3102 10 19 → 1,440 / 0,080 / 1,510; 7208 → 2,428 / N/A / 2,428; 7220 12 00 → 5,470; 7307 21 00 → 3,710. Bu satırlar `web/src/lib/factors.test.ts` içinde test olarak duruyor.
- Araştırma adımı, Excel'in Türkiye ve "Diğer ülkeler" tablolarını Resmî Gazete'deki 2026/1740 Ek I ile satır satır karşılaştırdı: 0 fark.
- Testler her satırda iki kuralı denetler: doğrudan + dolaylı, yuvarlama payı içinde toplama eşittir; dolaylı değer "N/A" ise toplam doğrudan değere eşittir.

## Güncelleme

Komisyon yeni bir varsayılan değer sürümü ya da EEA yeni bir yıl yayımladığında:

1. Ham dosyayı `raw/` klasörüne koyun.
2. CSV'yi yeniden ayıklayın.
3. `npm run factors` çalıştırın.
4. `SHA256SUMS` dosyasını yenileyin.
5. `factors.ts` içindeki `asOf` tarihini ve testlerdeki örnek satırları güncelleyin.
