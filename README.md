# Isoline — sürdürülebilirlik, faaliyet raporu ve karbon fiyatlaması araç platformu

> *Every number, on the map.* — Eski çalışma adı: MİZAN (`arsiv/mizan-v1/`).

Isoline, sürdürülebilirlik raporu yazan danışmanlık firmaları ve şirketlerin kendi ekipleri için Türkiye öncelikli, AB uyumlu bir web uygulamasıdır. Kapsam testleri, hesaplayıcılar, görsel analiz araçları, rapor akış şemaları ve Word'e aktarılan rapor şablonları tek çalışma alanında toplanır. Gösterilen her eşik, faktör ve tarih resmi kaynağına ve kontrol tarihine bağlıdır.

## Çalıştırma

```bash
npm --prefix web install
```

```bash
npm --prefix web run dev -- --port 3210
```

Tarayıcıda `http://localhost:3210` → otomatik olarak `/tr` açılır. İngilizce için `/en`.

Kontroller:

```bash
npm --prefix web test
```

```bash
npm --prefix web run typecheck
```

## Araçlar (v1)

| Aile | Araç | Ne yapar |
|---|---|---|
| Pusula | Genel bakış | Müşterinin yükümlülükleri, yaklaşan tarihler ve tüm araçların mini grafikleriyle bento panosu |
| | Rapor akışı | Sürdürülebilirlik raporu, faaliyet raporu ve SKDM için interaktif, hareketli akış şeması; aşama durumu veriden hesaplanır veya elle belirlenir |
| | Kapsam testi | TSRS (KGK 2026 eşikleri), CSRD/Omnibus, CSDDD, SKDM, TR ETS, faaliyet raporu türü, taksonomi, EUDR, DPP, pil pasaportu, enerji yöneticisi |
| | Faktör kütüphanesi | Hazır açık/resmi setler (IPCC 2006, ETKB 2023, IPCC AR6 GWP) yayıncı, lisans ve tarihiyle; "kendi faktörünü getir": lisanslı ya da tedarikçi faktörleri CSV ile eklenir, kullanım hakkı onaylanmadan hesaplarda görünmez; Kapsam 1-2-3 ve SKDM ekranlarında kütüphaneden seçim |
| | Mevzuat takvimi | TR / AB / küresel kulvarlarda 40 tarihli zaman çizelgesi, resmi ve ikincil kaynak ayrımıyla |
| Karbon | Kapsam 1-2-3 envanteri | Yakıt (NCV × EF), proses, F-gaz (AR6 GWP), elektrik (ETKB 2023 konum ve piyasa bazlı), 15 Kapsam 3 kategorisi, emisyon şelalesi; Excel/CSV şablonuyla toplu yükleme |
| | SKDM maliyet projeksiyonu | 2026–2034; gerçek ve varsayılan veri, işaret payları, ücretsiz tahsis düzeltmesi (CSCF), menşe karbon fiyatı indirimi, KN kodu Ek I kontrolü, AB ithalatçısı için operatör veri özeti (CSV) |
| | TR ETS simülatörü | A/B/C kategorisi, pilot dönem, kıyas bazlı ücretsiz tahsisat, açık ve maliyet, ceza tablosu |
| | Dekarbonizasyon yolu | SBTi 1,5 °C / WB2C yolları (yükselti bantları), net sıfır, önlem etkileri, MACC eğrisi |
| Çevre | Enerji, su ve atık | TEP/MWh dönüşümü, yenilenebilir payı, su tüketimi, geri kazanım; GRI/ESRS karşılıkları |
| | Taksonomi göstergeleri | Ciro, CapEx, OpEx uyum oranları; %10 önemlilik kontrolü (AB 2026/73) |
| İnsan ve yönetişim | Çift önemlilik matrisi | ESRS konularında etki ve finansal puanlama, etkileşimli matris |
| | İSG ve çalışan göstergeleri | LTIFR, TRIR, ağırlık oranı, ücret farkı, devir, eğitim |
| Raporlama | Faaliyet raporu kontrolü | Asgari içerik yönetmeliği (RG 28395) + SPK + BDDK maddeleri, sorumlu/durum takibi, Word çıktısı |
| | Şablon kütüphanesi | 11 şablon (TSRS tam, TSRS önce iklim, GRI, ESRS 2026, gönüllü standart, SKDM operatör paketi, TR ETS izleme planı, faaliyet raporu TTK/halka açık, CDP, yeşil tahvil); hesaplanmış rakamlarla Word'e aktarım |
| | Çerçeve eşleme | 20 veri grubu: TSRS 2 ↔ GRI ↔ ESRS ↔ gönüllü standart ↔ CDP |
| | Yeşil iddia denetimi | Metinde AB 2024/825 (27.09.2026'dan beri uygulanıyor) kapsamında riskli ifadeleri işaretler: genel iddia, dengelemeye dayalı nötrlük, plansız gelecek hedefi, mutlak ifade (TR/EN) |

Her grafik tablo görünümüne geçebilir ve CSV/SVG olarak indirilebilir. Her aracın verisi JSON olarak dışa aktarılır. Çalışma alanının tamamı dosya olarak dışa ve içe aktarılabilir.

## Yapı

```
web/
  messages/            dil dosyaları (tr.json varsayılan, en.json) — yeni dil = yeni JSON
  scripts/gen-locales.mjs   messages/ klasörünü tarayıp dilleri otomatik kaydeder
  src/app/[lang]/      sayfalar (App Router)
  src/features/        araç ekranları
  src/components/      kabuk, grafikler (SVG), cam bento bileşenleri, kaynak notu
  src/lib/calc/        hesap motorları + birim ve özellik tabanlı testler (fast-check)
  src/data/            kaynak sicili, mevzuat takvimi, şablonlar, akışlar, örnek müşteri
docs/arastirma/        AB, TR, SKDM/küresel, rakip ve isim araştırma raporları (17.10.2026)
PRODUCT.md             ürün gerçekleri (Impeccable)
.impeccable/           tasarım sözleşmesi, karar kayıtları, inceleme görüntüleri
arsiv/mizan-v1/        önceki yol haritası paketi
```

## Yeni dil eklemek

1. `web/messages/tr.json` dosyasını `xx.json` olarak kopyalayın (ör. `de.json`, `ar.json`).
2. `_meta` alanını doldurun: `{ "nativeName": "Deutsch", "intl": "de-DE", "dir": "ltr" }`.
3. Metinleri çevirin. Anahtarlara ve `{yer tutuculara}` dokunmayın.
4. `npm --prefix web test` çalıştırın. Test, eksik/fazla anahtarı ve bozuk yer tutucuyu bildirir.

Kod değişikliği gerekmez; dil seçicide otomatik görünür. Eksik metinler Türkçeye düşer.

## Kaynak ve güven ilkesi

`web/src/data/sources.ts` her kaydı üç güven düzeyinden biriyle işaretler. Bu düzeyler arayüzde çizgi biçimiyle gösterilir:

| Düzey | Anlamı | Çizgi |
|---|---|---|
| `official` | Resmi metinde doğrulandı | düz |
| `secondary` | Yalnız ikincil kaynakta görüldü | kesikli |
| `unverified` | Bilgi tabanı değeri, birincil metinden yeniden doğrulanmadı | noktalı |

Yayına almadan önce teyit edilmesi gerekenler (araştırmada **DOĞRULANAMADI** olarak işaretlendi):

- SKDM menşe karbon fiyatı indirimi kuralları (taslak)
- CSCF katsayısı
- KN satırları
- TR ETS pilotuna ilişkin bazı ayrıntılar
- Yeni TSRS eşiklerinin 2023–2024 referans yıllarına uygulanışı
- BDDK faaliyet raporu içeriği
- IPCC/GWP varsayılanları

SKDM Ek II şebeke faktörleri IEA lisanslıdır ve uygulama içinde veri seti olarak dağıtılmamalıdır.

## Sınırlar

- Isoline bir uyum hazırlık aracıdır. Hukuki görüş, güvence veya akredite doğrulama yerine geçmez.
- v1'de veriler yalnız tarayıcıda (localStorage) saklanır; hesap, rol ve çok kullanıcılı veritabanı yoktur.
- Örnek müşteri (Anadolu Yassı Çelik A.Ş.) ve tüm değerleri gösterim amaçlıdır.
- "Isoline" adı için resmi marka taraması (TÜRKPATENT, EUIPO, sınıf 9/35/42) yapılmadı.

Yol haritası: [docs/YOL_HARITASI.md](docs/YOL_HARITASI.md).
