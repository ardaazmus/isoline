# SKDM varsayılan değerleri: diğer menşe ülkeler

**Kaynak:** Komisyonun varsayılan değer dosyası (Uygulama Tüzüğü 2026/1740 ile düzeltilen 2025/2621 Ek I, Excel v2, 06.08.2026). Dosya: `../raw/DV_correcting_act_final_update_06.08.xlsx`.

Bu adımda alınan ülke sayfaları: Türkiye (karşılaştırma için), Çin, Hindistan, Ukrayna, Mısır ve "Other Countries and Territories".

**Lisans:** CC BY 4.0, © Avrupa Birliği (Karar 2011/833/AB).

## Dosyalar

- `cbam_defaults_countries.csv`: altı sayfanın her KN/TARIC satırı. Satırlarda sayfa ve satır numarası, açıklama, doğrudan, dolaylı ve toplam değer ile üretim rotası (F sütunu) aynen bulunur. Toplam 1.482 satır; Mısır sayfası 67 satır, diğerleri 283'er satır.
- Betikler `web/scripts/extract/` klasöründe:
  - `cbam-defaults-countries.mjs`: Excel'den çıkarma;
  - `cbam-country-table.mjs`: menşe ülkenin uygulanan tablosunu türetme;
  - `verify-cbam-countries-oj.mjs`: Resmî Gazete ile karşılaştırma.

## Uygulanan tablo

Ek I'deki kural: "Where a country or territory is explicitly listed but no value is provided or the relevant field shows '–', the default value for the respective good from the table 'Other countries and territories' needs to be selected."

Her ülkenin tablosu buna göre kurulur:

- Ülkenin kendi değeri varsa o kullanılır.
- Değer "–" ise ya da kod ülke sayfasında hiç yoksa "diğer ülkeler" satırı kullanılır. Bu satırlar uygulamada işaretlidir.
- İki tabloda da değeri olmayan satırlar ("see below" başlıkları) alınmaz.

Sonuç: her ülke için 260 satır.

| Ülke | Yedeğe düşen kod sayısı |
|---|---|
| Çin | 1 |
| Hindistan | 4 |
| Ukrayna | 8 |
| Mısır | 199 (sayfada yalnız 67 satır var) |

Listede olmayan bir ülke için uygulamada "Diğer ülkeler ve bölgeler" seçilir.

Kıyas rotası da menşe ülkenin tablosundan gelir (2025/2620 Ek nokta 5.1; bkz. [../cbam-bm/](../cbam-bm/README.md)).

## Doğrulama

1. **Türetme modülü:** Aynı modül Türkiye tablosunu da üretti. Sonuç, daha önce doğrulanmış `eu-cbam-defaults-tr.json` ile değerlerde ve yedek işaretlerinde birebir aynı: 260/260.
2. **Resmî Gazete karşılaştırması:**
   - Excel'den çıkarılan altı sayfanın 1.482 satırı, Resmî Gazete'deki 2026/1740 Ek I'in HTML metniyle karşılaştırıldı. Kriter: aynı KN, aynı doğrudan, dolaylı ve toplam değer, aynı rota.
   - Sonuç: 1.482/1.482, eksik ya da fark yok.
   - HTML 16 MB olduğu için depoda değil: https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202601740
   - 18.10.2026'da indirilen dosyanın SHA-256 değeri bu README'nin sonundadır.

Yeni ülke eklemek için:

1. `cbam-defaults-countries.mjs` içindeki `SHEETS` listesine sayfa adını ekleyin.
2. `web/scripts/build-factors.mjs` içindeki ülke listesini güncelleyin.
3. `factors.ts` içinde `CBAM_ORIGINS` listesine ülkeyi ekleyin.
4. Doğrulamayı tekrarlayın.

`reg_2026_1740.html` (18.10.2026, 16.413.369 bayt): SHA-256 `5fb565df63085165018b080dee96b419f9fa1578b797c71b27e14a6a635ca758`
