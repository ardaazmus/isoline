# G0-01 — Kod envanteri, test baz çizgisi ve koru / yeniden düzenle / emekliye ayır kararları

**Tarih:** 19.10.2026. **Kod:** `main` @ 4a856d1. Bu commit, v2 dalındaki (`local/tek-paket-kunye`) dokuz commit'i ileri sarmayla içeriyor.

## 1. Test baz çizgisi

| Komut | Sonuç |
|---|---|
| `npx vitest run` | **348/348 geçti**, 28 test dosyası |
| `npm run typecheck` (`next typegen && tsc --noEmit`) | Temiz |
| `npx eslint src scripts` | 0 hata; v2'den gelen 2 uyarı 4a856d1'de giderildi |
| `npm run validate` | 16 vaka, 127 kontrol, hepsi geçti; yayımlanmış kaynaklarda en büyük sapma %0,14 |
| `npx next build` | 75 statik sayfa, derleme temiz |

Bu sayılar G1 ve sonraki kapılarda **eşdeğerlik (parity) referansıdır**. Hesap motorlarının sonuçları değişirse fark belgelenir (bkz. G4-09).

## 2. Modüller ve kararlar

**Karar anlamları:**
- **Koru:** Olduğu gibi kalır, sunucu katmanından da çağrılır.
- **Yeniden düzenle:** İş mantığı korunur, kimlik, veritabanı ve API katmanına taşınır.
- **Emekliye ayır:** Yerine yenisi geçer; gerekçesi ADR'de.

### 2.1 Hesap motorları (`web/src/lib/calc`)

| Modül | Satır | Test | Karar | Not |
|---|---|---|---|---|
| `ghg.ts` (Kapsam 1-2-3, CH₄/N₂O, şebeke sürümleri) | 339 | `core.test.ts` içinde | **Koru** | Saf fonksiyon. G4'te `CalculationContext` ile sarılır; girdi özeti ve motor sürümü kaydedilir. |
| `cbam.ts`, `cbam-benchmarks.ts` | 365 + 124 | 22 + 16 | **Koru** | G4-06'da tesis, ürün ve ülke kural sürümüne bağlanır. |
| `ets.ts` | 130 | `core.test.ts` | **Koru** | G4-06. |
| `indicators.ts` (çevre, İSG, işgücü, taksonomi) | 141 | `core.test.ts` | **Koru** | G4-04. |
| `pathway.ts` (SBTi yolu) | 179 | `core.test.ts` | **Koru** | Hedef ekranı (DATA-18). |
| `applicability.ts` (kapsam testi) | 263 | `core.test.ts` | **Yeniden düzenle** | G2-06'da sürümlü kural paketi ve uzman kararı ile çalışır; sonucu artık kesin hüküm değil, öneri olur. |

### 2.2 İş akışı ve veri (`web/src/lib`)

| Modül | Satır | Test | Karar | Not |
|---|---|---|---|---|
| `approval.ts` (bölüm onayı, kilit) | 128 | 10 | **Yeniden düzenle** | Kural mantığı (geçişler, görev ayrılığı, geçmiş) sunucuda kimlikli onaya taşınır. Yazılan isimle onay, platformda **geçersiz**; v1'den gelenler `legacy_unverified` olarak aktarılır (G1-11). |
| `requests.ts` (veri talep listesi) | 547 | 35 | **Yeniden düzenle** | Kalem üretici (çerçeve ve şablon referansına bağlı) G3-02 kampanya üreticisinin çekirdeğidir. Sahip adları `legacy-owner-label` olur. |
| `reconcile.ts` (U1–U10) | 441 | 29 | **Koru** | G5-03'te açıklama ve engel politikasıyla sunucuda da çalışır. |
| `recalc.ts` (faktör sürümü, %5 eşiği) | 185 | 13 | **Koru** | G4-01 faktör sicilinin sürüm seçimi bunu kullanır. |
| `factors.ts` (faktör kütüphanesi, lisans) | 507 | 32 | **Yeniden düzenle** | Hazır setler kodda kalır (kaynaklı ve testli). Kiracıya özel setler PostgreSQL'e taşınır (G4-01). |
| `trial-balance.ts`, `spreadsheet.ts`, `imports.ts` | 280 + 89 + 70 | 24 + 0 + 0 | **Koru** | İçe aktarma ayrıştırıcıları G3-05'in önizleme ve eşleme adımında aynen kullanılır. |
| `inventory-csv.ts`, `indicators-import.ts` | 281 + 207 | 13 + 14 | **Koru** | Aynı gerekçe. |
| `docx.ts`, `report-package.ts`, `export.ts`, `summary.ts` | 113 + 149 + 77 + 88 | 3 + 2 + 4 + 0 | **Yeniden düzenle** | G6-06 paket ve künye üretimi bunlardan doğar. Kaynak artık onaylı anlık görüntü (snapshot). |
| `auditor.ts`, `evidence-vault.ts` (v2) | 170 + 102 | 4 + 3 | **Yeniden düzenle** | Denetçi alanı ve kanıt kasası, G7-03 salt okunur inceleme odası ile G1-09 nesne deposuna taşınır. Tarayıcıdaki SHA-256 özeti korunur. |
| `sites.ts` (v2 tesis sicili) | 100 | 5 | **Yeniden düzenle** | G2-01 tesis ve G5-01 konsolidasyon modeli. |
| `claims.ts`, `content-index.ts`, `color.ts`, `countup.ts`, `dates.ts` | — | 9 + 2 + 10 + 4 + 5 | **Koru** | Yardımcılar. |

### 2.3 Sunucu iskeleti (v2)

| Modül | Karar | Gerekçe |
|---|---|---|
| `web/prisma/*` (13 model, ilk migration, seed) | **Emekliye ayır** ([ADR-003](../adr/ADR-003-veri-erisim-ve-migrasyon.md)) | Model yeni kiracı ve izin mimarisine uymuyor: kiracı ayrımı, dış erişim izni ve RLS yok. Migration geri alınamıyor. Henüz hiçbir ortamda gerçek veri yok. |
| `web/src/server/rbac.ts` | **Yeniden düzenle** | Rol-eylem matrisi fikri `policy` modülüne taşınır; roller yol haritasının 03 §6 tablosuna göre yeniden tanımlanır. |
| `web/src/server/hierarchy.ts` (konsolidasyon, YoY gerekçesi, kanıt kapısı) | **Koru ve taşı** | Kurallar doğru ve testli. G5-01 konsolidasyon ve G3 gönderim kapısı bunları kullanır. |
| `web/src/app/api/v1/health`, `hierarchy` | **Yeniden düzenle** | `health` kalır, veritabanı ve depo kontrolü eklenir. `hierarchy` yeni org API'siyle değişir. |

### 2.4 Ekranlar (`web/src/features`, `web/src/app/[lang]`)

Mevcut 25 rota **v1 araç seti** olarak çalışmaya devam eder ([ADR-008](../adr/ADR-008-v1-arac-seti-ile-birlikte-yasam.md)):
- veriler tarayıcıda kalır;
- üstte "çevrimdışı çalışma alanı" bandı görünür;
- içe aktarma yoluyla platform projesine taşınabilir.

Yeni platform ekranları `/[lang]/app/...` altında açılır; `/[lang]/auth/...` kimlik ekranlarıdır.

## 3. Veri biçimi

Tarayıcı çalışma alanı **v11**: `ClientData` ve onaylar, veri talepleri, kaynak notları, denetçi durumu, tesis sicili. Yol haritası "v9" diyor; v10 ve v11 sonradan eklendi. G1-11 içe aktarıcı v2 ile v11 arasındaki tüm biçimleri kabul eder; eski göç fonksiyonları (`migrateClients`) yeniden kullanılır.
