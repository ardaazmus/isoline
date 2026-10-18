# Raporlama Sistemi — Kapsamlı İnceleme, İş Akışı ve Veri Korunumu Raporu (Ekim 2026)

> Tarih: 18.10.2026 · **Güncelleme (18.10.2026, ikinci tur):** `origin/main` birleşimi (4 commit: CBAM çoklu menşe tabloları, doğrulama paketi, yayımlanmış kaynaklı vakalar, CH₄/N₂O) tarandı → Bölüm VIII. Sektörel program karşılaştırması ve hedef iş akışı modeli → Bölümler IX–X.
> Bu belge tek dosyada toplamıştır: (a) mevcut ürünün raporlama denetimi (hatalar ve eksiklikler), (b) şirketler ve danışmanlık firmaları için anlaşılır iş akışı modeli, (c) şirket içi kontrol/onay yönetimi, (d) resmî/gayriresmî raporlarda açıklanacak ve korunacak verilerin dışa aktarımda nasıl görünmesi gerektiği, (e) rapor çeşitlerine göre tablo–hesap–cetvel ayrımları, (f) medya havuzu tasarımı, (g) yeni kodun yazılımsal/mantıksal taraması ve (h) sektörel kıyasla eksikler ve doğru iş akışı.
> Yöntem: kaynak kod incelemesi (`web/src`), test çalıştırma (216/216 geçti), typecheck, veri↔mesaj↔navigasyon çapraz referans denetimi, uç senaryo denemeleri. Hukuki görüş değildir; hukuki konularda uzman teyidi şarttır.
> İşaretler: **[HATA]** mevcut kodda kusur · **[EK]** eksik ürün/yetkinlik · **[TASARIM]** önerilen model · **[ONERİ]** geliştirme adımı.

---

## 1. Yönetici özeti

1. **Hesap katmanı sağlam, raporlama katmanı zayıf.** Motorlar (GHG, SKDM, ETS, yol, göstergeler) ve uzlaştırma kuralları iyi; ancak kullanıcı bugün son raporu *elle derliyor*: Word çıktısı hesaplanan veri zenginliğini taşımıyor, rapor türleri kendi cetvelleriyle ayrışmıyor, onay/kontrol akışı yalnız faaliyet raporu listesinde var.
2. **"Bir kez hesapla, çok raporda kullan" ilkesi doğru ve kısmen çalışıyor.** Sizin örneğiniz doğrudur: faaliyet raporundaki karbon verisi GHG aracında önceden hesaplanır, faaliyet raporu onu çeker, yeniden hesaplamaz. Bunun kanıtı kodda var (`ar_ttk` şablonu → `ar_sustainability_summary` → `toolSummary("ghg")`). Eksik olan, aradaki **sınır/dönem farklarının görünür** kılınması ve rakamın **kaynak şeridiyle** gelmesidir.
3. **Gizlilik/açıklama yönetimi yok denecek kadar az.** Oysa faaliyet raporu (kamuya açık), SKDM veri paketi (yetkili/ithalatçıya), TR ETS izleme planı (Başkanlığa) ve iç denetim dosyası (gayriresmî) **farklı açıklama rejimlerine** tabidir. Tek bir veri omurgasından farklı görünürlük profilleriyle (tam / otoritî / kamuya açık) çıktı üretebilmek ürünün merkezî yetkinliği olmalıdır.
4. **Medya havuzu yok.** Grafikler anlık indiriliyor; tasarım ajansı teslimi, logo/fotoğraf hakları, "bu grafik şu hesaptan üretildi" izi yönetilmiyor. Raporlama firmalarının günlük işinde bu, dosya paylaşımı e-postalarıyla çözülmeye çalışılan gerçek bir boşluk.
5. **Kritik hatalar:** donmuş "bugün" tarihi (19.10.2026'dan itibaren takvim ekranları bozulur), Türkçe yeşil iddia kalıplarındaki boşluklar, Word kontrol listesinde onaylı maddelerin hâlâ `☐` olması ve rakam eksikliği, CSV formül enjeksiyonu, temiz checkout'ta kırılan `typecheck` ve `cdn.sheetjs.com` bağımlılığı.
6. **Yeni gelen iş güçlü (Bölüm VIII).** Doğrulama paketi (16 vaka, 127 kontrol; beklenen değerler uygulama kodundan bağımsız BigInt aritmetiğiyle veya basılı kaynaklardan) sektörel iyi uygulamanın birebir kendisi ve kendi içinde gerçek hataları da bulmuş. CH₄/N₂O eklentisi doğru. Tek yeni mantık hatası: SKDM menşe değişiminde `defaultSee` değeri bayatlayabiliyor (N1).
7. **Sektörel konum (Bölümler IX–X):** rakiplerin (Watershed, Persefoni, Workiva, Sweep, CarbonChain, TR'de Karbonet) güçlü olduğu yer **veri toplama iş akışı, kanıt/onay mimarisi ve entegrasyonlar**; Isoline'ın güçlü olduğu yer **Türkiye mevzuat derinliği, kaynak-izli hesap ve doğrulama paketi**. Doğru hedef iş akışı 8 aşamalı bir operasyon modeli (Planla → Tanımla → Topla → Hesapla → Kontrol et → Derle → Güvence → Onayla/Yayımla); ürün yol haritası bu modele göre kurgulanmalı.

---

# BÖLÜM I — Mevcut durum denetimi

## I-A. Hatalar ve kusurlar

### A1. Arayüz "bugün" tarihi 2026-10-17'de dondurulmuş — **[HATA] yüksek**
- `web/src/features/common.tsx:54` (`KeyDates`), `web/src/features/overview.tsx:23`, `web/src/features/regulations.tsx:13` sabit `"2026-10-17"` kullanıyor.
- Etki: tarih geçtikçe "yaklaşan tarih" listeleri, üstü çizili geçmiş tarihler ve mevzuat zaman çizelgesindeki "bugün" çizgisi yanlışlaşır. Raportakvimi ekranları her gün biraz daha bozulur.
- `web/src/lib/dates.ts` içinde `localDay()` hazır. `sources.ts:19` ve `factors.ts:76`'daki `AS_OF` ise **kasıtlı ve doğru** (verinin kontrol tarihi) — ikisi karıştırılmamalı.
- Düzeltme: üç kullanım gerçek güne bağlanmalı; "kaynak kontrol tarihi" yalnız `AS_OF` alanında kalmalı.

### A2. Faaliyet raporu Word çıktısı eksik — **[HATA] yüksek**
- `web/src/features/annual-report.tsx:53`: her madde dışa aktarımda `☐` ile çiziliyor; `approved` maddeler `☑`, `na` maddeler `—` olmalı.
- `annual-report.tsx:56`: `figures: []` — kontrol listesi Word paketi **hiçbir hesaplanmış sayı içermiyor**. Oysa `ar_ttk`/`ar_listed` şablonları aynı yönetmeliğin maddeleriyle besleniyor. Kullanıcı ya kontrol listesini (sayısız) ya da şablonu (durumsuz) alabiliyor.
- `annual-report.tsx:59`: dosya adı her dilde Türkçe (`-faaliyet-raporu-kontrol.docx`).
- `annual-report.tsx:47-48`: kaynak listesi yalnız `cite` metni; şablon çıktısında URL var — tutarsız.

### A3. Türkçe yeşil iddia kalıplarında boşluklar — **[HATA] yüksek**
`web/src/lib/claims.ts` TR listeleriyle yapılan deneme sonuçları:

| İfade | Yakalandı mı? | Olması gereken |
|---|---|---|
| "Ürünümüz iklim pozitiftir." | ❌ | offset (EN'de `climate positive` var, TR'de `iklim pozitif` yok) |
| "Karbon negatif çelik üretiyoruz." | ❌ | offset |
| "Emisyonlarımızı karbon kredileriyle telafi ediyoruz." | ❌ | offset |
| "Tamamen sürdürülebilir bir tedarik zincirimiz var." | ❌ | absolute |
| "…zararsızdır." | ❌ | absolute (ekli hâl kelime sınırına takılıyor) |

- Kök neden: Türkçe **eklemli** dil; `zararsızdır`, `çevre dostudur`, `karbon nötrdür` gibi türetilmiş hâller `(?<!W)…(?!W)` sınırlarını aşamıyor. EN/TR listeleri asimetrik.
- Öneri: eksik TR kalıplarını ekle; sonek toleransı uygula; `claims.test.ts`'e bu örneklerle regresyon testi koy.

### A4. CSV formül enjeksiyonu — **[HATA] orta (güvenlik)**
- `web/src/lib/export.ts:15-18`: `=`, `+`, `-`, `@` ile başlayan hücreler nötralize edilmiyor. Uzlaştırma "denetçi dosyası" CSV'si kullanıcı açıklamalarını (`note`, `items`) taşıyor → Excel'de formül çalıştırılabilir (OWASP CSV injection).
- Öneri: `csvCell`'de öne tırnak kaçışı + test.

### A5. `npm run typecheck` temiz checkout'ta kırılıyor — **[HATA] orta**
- `templates/[id]/page.tsx:10` (`PageProps`) ve `layout.tsx:26` (`LayoutProps`) Next 16'nın **üretilen** `.next/types` tiplerine bağlı; `next typegen`/dev/build sonrası temizleniyor. CI'da kırılır.
- Öneri: `"typecheck": "next typegen && tsc --noEmit"`.

### A6. `xlsx` bağımlılığı registry dışı CDN'de — **[HATA] orta**
- `web/package.json:30`: `https://cdn.sheetjs.com/...`. Erişilemeyen ağlarda `npm install` tamamen kırılıyor (bu analizde birebir gözlendi). README'de not yok.
- Öneri: tarball'ı vendorlamak / iç mirror; en kötü ihtimalle README notu. Tek CDN'e sabitlenme tedarik zinciri riski olarak yazılmalı.

### A7. `toolSummary` non-null iddiaları — **[HATA] düşük (kronik)**
- `web/src/lib/summary.ts:27` `find(r => r.year === 2030)!`, `:36` `find(r => r.priced)!`. Yıl aralığı değiştiğinde Word dışa aktarımı sessizce başarısız olur (`exportDocx` hata yutuyor).
- Öneri: `?.` + varsayılan; kullanıcıya görünür hata.

### A8. `importWorkspace` doğrulaması sığ — **[HATA] düşük**
- Yalnız `id/name/profile/ghg/cbam` varlığı kontrol ediliyor. Bozuk JSON, `journey.ts:27`'deki `history[1].totalAssetsTry` gibi tuple-varsayımlı kodlarda çökme üretebilir (`reconcile.ts` savunmacı, `journey.ts` değil).

### A9. Journey deadline sabitleri kodda gömülü — **[HATA] düşük (ilke ihlali)**
- `web/src/data/journey.ts:68` (`"2026-10-27"`, TR ETS izleme planı) ve `:73` (`"2027-09-30"`, ilk SKDM beyanı). Değerler **doğru** (SKDM Md. 6, Omnibus Reg. 2025/2083 ile 31.05→30.09; TR ETS Geçici md. 3 → 27.10.2026) ama kaynak bağları yok; "her tarih kaynağına bağlı" prensibi tutmuyor.

## I-B. Raporlama tarafında mevcut ürün eksiklikleri

| # | Eksik | Not |
|---|---|---|
| B1 | **Rapor derleyici yok** (HEDEF_MIMARI §4.4) | Şablon Word'ü, kontrol listesi Word'ü, uzlaştırma CSV/JSON, araç JSON'ları, grafik SVG'leri ayrı ayrı iniyor; tek "rapor paketi" (manifest + her şey) üretilmiyor. |
| B2 | **Word çıktısı sunum kalitesinin altında** | Kapak, içindekiler, sayfa numarası, TASLAK filigranı, grafik gömme, figür başına kaynak/dönem/birim/kalite yok. |
| B3 | **Faaliyet raporu ↔ şablon ↔ çerçeve eşleme kopuk** | Aynı yönetmelik maddeleri iki yerde ayrı tutuluyor; kontrol listesinde "şablondaki karşılığı" yok, eşleme tablosunda "bu veri girdi mi?" doluluk göstergesi yok. |
| B4 | **Onay/sürüm/geri alma yok** | AR checklist'te 5 durum var (iyi); diğer çıktılar için sürüm geçmişi, kilit, geri alma, "geçen ayki paket" saklama yok. |
| B5 | **Rapor metni çalışma alanı zayıf** | Claims tek `textarea`; bölüm bazlı metin, metin↔sayı tutarlılık uyarısı yok; journey'de `write`/`assurance`/`publish` aşamaları otomatik ilerlemiyor. |
| B6 | **U6–U7 kuralları ve dönem kopyası yok** | Yatırım↔etki çelişkisi yakalanmıyor; U8 prior-year verisi elle giriliyor; "yılı kilitle/kopyala" iş akışı yok. |
| B7 | Küçük tutarlılıklar | Journey `financials` aşamasının araç listesi boş (mizan bağlanabilir); ekranda figürler `.slice(0,2)`; claims CSV çıktısı yok; `ar_listed`'de `ar_chair_ceo` refs'i `"—"`. |

## I-C. Denetimde doğrulananlar (olumlu)

- 216/216 test geçiyor; typecheck (A5 notuyla) temiz; TR/EN 1679/1679 anahtar eşitliği korunuyor.
- Veri↔mesaj↔navigasyon çapraz referansları tutarlı (şablon bölümleri, AR maddeleri, journey aşamaları, crosswalk satırları için eksik referans yok).
- Uzlaştırma motoru (kural başına kayıt, açıklama ile kapanan uyarı / düzeltmeden kapanmayan hata, CSV/JSON denetçi kaydı) iyi tasarlanmış ve test edilmiş.
- SKDM 30.09.2027 ve TR ETS 27.10.2026 tarihleri doğru (yalnız kaynak bağları eksik — A9).

---

# BÖLÜM II — İş akışı modeli: şirketler ve danışmanlık firmaları için anlaşılır akış

## II-A. İki kullanım şekli ve günlük akış

**PRODUCT.md iki eşit kullanıcı tanıyor:** şirket içi ekipler ve çok müşterili danışmanlık firmaları. İş akışı modeli ikisini de taşımalı; fark *kim veri girer, kim onaylar, kim teslim alır*dır.

### Şirket içi ekip — yıllık raporlama döngüsü

| Adım | Kim | Ne yapar | App'teki karşılığı (bugün) |
|---|---|---|---|
| 1. Veri toplama | Finans, İK, İSG, üretim | Mizan, göstergeler, tonaj dosyalarını hazırlar | Dosya içe aktarma (mizan xlsx/csv; envanter CSV/Excel; gösterge CSV/Excel) + SHA-256 kanıt kaydı |
| 2. Hesaplama | Sürdürülebilirlik uzmanı | K1-2-3 envanteri, SKDM/ETS projeksiyonu, yoğunluk | GHG / SKDM / ETS / yol araçları; faktör sürümü seçimi (envanter yılına göre) |
| 3. Çapraz kontrol | Uzman + finans | Araçlar arası tutarlılık; farklara açıklama yazılır | Uzlaştırma U1–U5, U8–U10; açıklama kaydı |
| 4. Metin ve iddialar | İletişim / uzman | Rapor metni; yeşil iddialar gözden geçirilir | Yeşil iddia denetimi (U10 aynı metni tarar) |
| 5. Kontroller | Bölüm sorumluları | Kendi kalemlerini "gözden geçirme"ye çeker | Faaliyet raporu kontrol listesi (sorumlu + durum) |
| 6. Onay | Yönetim / genel müdür | Yayına onay | **[EK]** bugün yalnız AR'de "approved" durumu; kurumsal onay akışı yok |
| 7. Teslim | Yatırımcı ilişkileri | KAP / genel kurul / yayımla | Word paketi + ekler (elle derleniyor) |

### Danışmanlık firması — çok müşterili akış

| Adım | Kim | Ne yapar | App'teki karşılığı (bugün) |
|---|---|---|---|
| 1. Müşteri açılışı | Danışman | Yeni çalışma alanı, kapsam testi | Müşteri yönetimi + Kapsam testi (hangi yükümlülükler) |
| 2. Veri talebi (PBC) | Danışman → müşteri | "Şu cetveller şu dosyalardan" listesi | **[EK]** elle e-posta; app'te PBC listesi üretimi yok |
| 3. Veri kabulü | Danışman | Dosyalar yüklenir, kanıt kaydı tutulur | İçe aktarma + `importLog` (iyi) |
| 4. Hesap + kontrol | Danışman | Motorlar + uzlaştırma | Aynı |
| 5. Ön izleme | Müşteri | Taslağı görür, düzeltme ister | **[EK]** yalnız JSON/Word; "müşteri görünümlü" paket yok |
| 6. Onay + kilitleme | Müşteri (yazılı) | "Yayınlanabilir" onayı | **[EK]** app'te kilit/sürüm yok; dış onay kaydı tutulmalı |
| 7. Son teslim | Danışman | Word/Excel + medya (tasarım ajansına) | Word + CSV + SVG (ayrı ayrı) |

**[TASARIM]** Her iki akış da aynı üç kapıdan geçmelidir: **(G1) Veri kapısı** (uzleştirme `fail=0`), **(G2) Metin kapısı** (yeşil iddia yüksek risk = 0 veya açıklanmış), **(G3) Onay kapısı** (AR checklist `todo=0` + onaylayan kaydı). Kapılar zorlamaz; ancak geçilmemişse çıktı paketine **durum sayfası** ve filigran ("TASLAK") basılır. Danışman için G3 = müşteri onayı; şirket için G3 = yönetim onayı.

## II-B. Veri giriş katmanları (nereye ne giriyor)

| Katman | Bugünkü karşılığı | Giriş birimi | Kanıt/iz | Öneri |
|---|---|---|---|---|
| **1. İn-app form alanları** | Her araçta `NumberField`, `SelectField`, `textarea` (ör. GHG yakıt satırı: tür, miktar, NCV, EF, kalite; profil: eşik sayıları; matris: puanlar) | Alan → veri noktası | Yok (elle giriş) | Her alana `quality` (measured/calculated/estimated) + `sourceNote` + **sorumlu/durum** alanları (II-C) |
| **2. Dosyadan içe aktarma** | Mizan (xlsx/xls/ods/csv), envanter CSV/Excel, gösterge CSV/Excel; başlık satırı kendiliğinden bulunuyor; birim dönüşümleri | Satır → veri noktası | `importLog`: dosya adı, SHA-256, zaman, satır sayısı (iyi) | Kanıt kaydını çıktılara "Ek: Kanıt Listesi" olarak taşı (II-B notu) |
| **3. Faktör kütüphanesi** | Resmî setler (IPCC, ETKB, TÜİK, DESNZ, SKDM varsayılanları, EEA) + "kendi faktörünü getir" (kullanım hakkı onayı) | Faktör → hesap | Kaynak sicili + AS_OF | Sürüm damgası figür şeridine taşınmalı (B2) |
| **4. Metin girişi** | Yeşil iddia `textarea`sı; AR ipuçları | Metin | U10 tarama kaydı | Bölüm bazlı metin alanları (her rapor bölümüne) — B5 |
| **5. Medya havuzu** | **YOK** | Görsel/varlık | — | Bölüm VI'da tasarım |

## II-C. Şirket içi kontrol ve onay yönetimi

### Durum makinesi (tüm veri noktaları ve rapor bölümleri için ortak)

```
Taslak → Girildi → Hesaplandı → Kontrolde → Onaylandı → Kilitli → Yayında
                ↘ Revizyon istendi (her aşamadan geri)
```

- Bugünkü durum: yalnız faaliyet raporu maddelerinde `todo/draft/review/approved/na` + `owners` var (iyi bir başlangıç); journey'de elle aşama durumu var; başka yerde yok.
- **[TASARIM]** Aynı 5+2 durumu **her rapor bölümüne** ve her cetvele uygula. `owner` (sorumlu), `reviewer` (kontrol eden), `approver` (onaylayan) üçlüsü; `approvedAt`, `lockedAt` zaman damgaları; kilit, veri değişimini engellemez ama "paket yeniden üretilmeli" uyarısı üretir.

### Roller

| Rol | Yetki | Kime karşılık gelir |
|---|---|---|
| Veri girişi | Alan/dosya girişi; hesap yok | Üretim, İK, İSG, finans personeli |
| Hazırlayan | Hesap, metin, dışa aktarma | Sürdürülebilirlik uzmanı / danışman |
| Kontrol eden | Bölüme "onay" veremez; revizyon isteyebilir | Finans müdürü (finansal cetveller), İSG uzmanı (LTIFR), İKYK sekreteri (yönetişim) |
| Onaylayan | Bölümü ve paketi onaylar; kilidi açar | Genel müdür / raporlama komitesi / müşteri (danışmanda) |
| Denetçi (dış) | Salt okunur + yorum + kanıt talebi | Bağımsız denetçi, güvence kuruluşu (Faz 3–4 hedefi) |

### v1 ölçüsünde hemen yapılabilecekler (sunucu gerekmez)

1. `owners` alanını AR dışına çıkar: her cetvel/figür grubuna sorumlu + durum (localStorage).
2. Word çıktısına **imza bloğu**: "Hazırlayan / Kontrol eden / Onaylayan — ad, tarih, durum".
3. Paket manifest'ine **onay kaydı** (kim, ne zaman, hangi sürüm).
4. Uzlaştırma + AR + claims sonuçlarını tek **"Onay öncesi kontrol sayfası"**nda topla (kapılar G1–G3).

### Faz 3 (platform) ile birleşecekler
Rol/tenant modeli, olay günlüğü (hash zinciri), kanıt deposu, denetçi çalışma alanı, PBC listesi — HEDEF_MIMARI §5 ile birebir örtüşür. Yukarıdaki durum makinesi, Faz 3'ün "durum: taslak→…→kilitlendi→denetçi kabul" alan şemasına doğrudan taşınabilir.

---

# BÖLÜM III — Rapor çeşitleri ve kendi tablo/hesap/cetvel dünyaları

## III-A. Temel ilke: bir kez hesapla, birçok raporda kullan

**Sizin örneğiniz doğrudur:** *"Faaliyet raporunda karbon verisi zaten önceden hesaplanmış olmalı."* Ürün prensibi 2 ("One data spine, many reports") budur ve kodda bugün de böyledir:

- Karbon K1/K2/K3 cetveli **yalnız** Kapsam 1-2-3 Envanteri aracında hesaplanır.
- Faaliyet raporu şablonu (`ar_ttk` → `ar_sustainability_summary`) bu hesabı **çeker**: `tools: ["ghg", "workforce", "environment"]` → `toolSummary(...)`.
- Aynı şekilde TSRS 2 ¶29a cetveli, CDP M7, GRI 305-5, yeşil tahvil fon raporlaması aynı hesabı farklı **sunum dilinde** gösterir.

**Ama üç fark disiplini şarttır** (aksi halde aynı şirket aynı yılı iki farklı rakamla açıklar):

1. **Sınır farkı:** envanter operasyonel kontrol sınırında, faaliyet raporu konsolide olabilir → fark *görünür* olmalı (U3/U5 tipi kontroller ve "sınır" etiketi).
2. **Dönem farkı:** envanter yılı ≠ raporlama dönemi (ör. 30.09 kapanış) → figür şeridinde "dönem" yazmalı.
3. **Sürüm farkı:** faktör sürümü değiştiyse (ETKB 2022→2023) geriye dönük yeniden hesap + %5 anlamlılık uyarısı zaten var (`recalc.ts`); rapor paketi "bu rakam X sürümüyle hesaplandı" damgası taşımalı.

**[TASARIM] Çekme kuralı:** rapor şablonu bir veriyi asla yeniden hesaplamaz; yalnız *alıntılar*. Alıntı her zaman şu şeritle gelir: `Kaynak: Kapsam 1-2-3 Envanteri · ETKB 2023 · hesap 12.10.2026 · kalite: measured · sorumlu: A.B.`. Uygulamada rakamın üzerine tıklanınca kaynak araca inilir (bugün `templates.tsx`'te figür bağlantıları var — doğru yön).

## III-B. Rapor türü kataloğu

Her rapor türü: **kendi cetvelleri** (hesaplanmış tablolar), **kendi metin bölümleri**, **kendi açıklama rejimi** ile ayrı bir "dünya"dır. Uygulamada bu, tür seçildiğinde **yalnız o türün cetvellerinin görünmesi** demektir (menüde değil, *rapor düzenleyicide*).

| Rapor türü | Statü / hedef kitle | Dayanak | Besleyen veri (giriş) | Kendi hesap/cetvelleri | Bugün çıktısı | Gizlilik profili |
|---|---|---|---|---|---|---|
| **Faaliyet raporu (TTK)** | Resmî / genel kurul, kamuya açık | Asgari içerik Yön. (RG 28395), TTK 514 | Mizan, profil, duran varlıklar, personel | Net satış cetveli (600-602−610-612), oranlar, yatırım cetveli, personel tablosu, **sürdürülebilirlik özeti (önceden hesaplanmış karbon/enerji/İK)** | Kontrol listesi Word (rakamsız — A2) + `ar_ttk` şablonu | Kamuya açık |
| **Faaliyet raporu (SPK, halka açık)** | Resmî / KAP | SPK II-14.1, II-17.1, sürdürülebilirlik ilkeleri | Yukarıya ek: yönetim kurulu, uyum çerçevesi | Özet finansal bilgiler, risk yönetimi cetveli, uyum tablosu | `ar_listed` şablonu | Kamuya açık |
| **TSRS 2 (tam)** | Resmî / KGK, kamuya açık | TSRS 1-2, KGK kapsam kararı | GHG, yol, matris, taksonomi, SKDM/ETS | **K1/K2(lok-piyasa)/K3(15 kategori) cetveli**, yoğunluk, geçiş planı (MACC), finansal etki tablosu, hedef cetveli | `tsrs_full` şablonu (figürlü) | Kamuya açık |
| **TSRS (iklim-önce, geçiş)** | Resmî | TSRS 1 Ek E, Kapsam Kararı geçici maddeler | GHG, yol | K1+K2 cetveli, hedef | `tsrs_climate_first` | Kamuya açık |
| **GRI** | İhtiyarî / paydaş | GRI 1-3, 302/303/305/306, 401-405 | GHG, çevre, İSG/İK, matris | 305-1..5, 302-1, 303-3/5, 306-3/4, 403-9, 404-1, 405-2 | `gri` şablonu | Kamuya açık |
| **ESRS 2026** | Resmî (AB) / Omnibus | ESRS (2026), Del. Reg. 2026/73 | Tümü + taksonomi | E1-4..9, S1-13/14/16, taksonomi eki | `esrs_2026` (durum: review) | Kamuya açık |
| **VSME (VSS)** | İhtiyarî / KOBİ tedarik | VSS 2026 | GHG, çevre, İK | B3, B6-B10 modül tabloları | `vss` | Kamuya açık/müşteri |
| **CDP** | İhtiyarî / CDP + yatırımcı | CDP 2026 | GHG, matris, yol | M1-M13 modül cetvelleri | `cdp_climate` | Kuruma açık |
| **SKDM operatör paketi** | Resmî / AB ithalatçı + yetkili | Reg. 2023/956, 2025/2620, Guidance 3 | Ürünler, SEE, öncül payı, kıyaslar | **Ürün bazlı SEE cetveli (A/B sütunu), öncül malzeme cetveli, kıyas düzeltmesi (FAA/SFA), karbon fiyatı indirimi, Ek I KN kontrolü** | `cbam_operator_pack` + ithalatçı CSV | **Yetkili/ithalatçıya; proses detayı ticari sır** |
| **SKDM beyan paketi (yıllık)** | Resmî / CBAM kaydı | Md. 6 (30.09) | Yukarı + doğrulama | Beyan cetvelleri, sertifika hesabı | (Faz 4–6) | Otoriteye |
| **TR ETS izleme planı** | Resmî / Başkanlık | TR ETS Yön. (RG 33353), KPK/2026/1 | GHG kaynakları, tier, tahsisat | **Kaynak listesi, veri seviyesi (tier) cetveli, ücretsiz tahsisat formülü (kıyas×oran×katsayı×faaliyet), ceza tablosu** | `tr_ets_mp` | Otoriteye (kamuya kapalı olabilir) |
| **TR ETS yıllık raporlama/teslim** | Resmî | Yön. md. 16 (Kasım son iş günü) | ETS girdileri | Teslim/deficit cetveli, maliyet projeksiyonu | ETS aracı + `tr_ets_mp` | Otoriteye |
| **Yeşil tahvil** | Resmî (SPK) / yatırımcı | SPK yeşil tahvil rehberi, ICMA GBP | Taksonomi, GHG, çevre | **Fon kullanımı cetveli (uyumlu CapEx/OpEx %), etki raporlaması, bağımsız görüş kalemleri** | `green_bond` | Kamuya açık |
| **Entegre rapor** | Resmî / Faz 6 | IFRS + TTK + SPK | Tümü | Tüm cetvellerin tek düzende sentezi | Yok | Kamuya açık |
| **İç yönetim raporu** | **Gayriresmî** / yönetim | — | Tümü | Maliyet-fayda, MACC, risk panosu | (Araçlar + JSON) | **Yalnız iç kullanım** |
| **Denetim hazırlık (PBC) dosyası** | **Gayriresmî** / denetçi | ISSA 5000 / GDS 3000 | Tümü + kanıtlar | Uzlaştırma kaydı, kanıt listesi, tahmini veri payı (U9) | Uzlaştırma CSV/JSON + importLog | **Denetçiye; NDA kapsamı** |

## III-C. Konu ↔ cetvel ↔ rapor yerleşim matrisi

Bir konunun cetveli **kendi konu başlığında** yaşar; raporlar o başlıktan **alıntı yapar**. ("Tablolar kendi konularında gözükür" ilkesi.)

| Konu | Hesap/cetvel (kendi yerinde) | Kullanıcı arayüzündeki evi | Hangi raporun hangi bölümü çeker |
|---|---|---|---|
| Karbon | K1/K2 lok-piyasa/K3 cetveli, emisyon şelalesi, yoğunluk | Karbon → Kapsam 1-2-3 | TSRS ¶29a · faaliyet raporu "sürdürülebilirlik özeti" · GRI 305 · ESRS E1-6 · CDP M7 · SKDM "attributed/see" · yeşil tahvil GB-4 |
| SKDM maliyeti | Ürün SEE + kıyas + sertifika projeksiyonu (2026-2034) | Karbon → SKDM | SKDM operatör paketi · TSRS finansal etki · faaliyet raporu risk |
| TR ETS | Tahsisat/deficit/ceza cetveli | Karbon → TR ETS | İzleme planı · TSRS finansal etki · faaliyet raporu |
| Enerji | TEP/MWh, yenilenebilir payı, kaynak bazlı tüketim | Çevre → Enerji | GRI 302-1 · ESRS E1-5 · faaliyet raporu · TR ETS ekleri |
| Su & atık | Su dengesi (çekim-deşarj), atık geri kazanım cetveli | Çevre | GRI 303/306 · ESRS E3/E5 · faaliyet raporu |
| İSG & İK | LTIFR/TRIR, ücret farkı, devir, eğitim cetveli | İnsan | GRI 401-405 · ESRS S1 · faaliyet raporu md. 8/11 · VSS B8-B10 |
| Finans | Net satış, oranlar, duran varlıklar, yatırım cetveli | Mizan + Faaliyet raporu | AR md. 12 · U1 çapası · yeşil tahvil fon kullanımı |
| Taksonomi | Ciro/CapEx/OpEx uyum cetveli + %10 önemlilik | Çevre → Taksonomi | ESRS eki · yeşil tahvil · AR (halka açık) |
| Yönetişim | Çift önemlilik matrisi, risk cetveli | İnsan → Matris | TSRS ¶28-31 · GRI 2/3 · ESRS 2 · AR md. 13 |
| Metin/iddialar | Yeşil iddia bulgu listesi | Raporlama → İddialar | Her raporun metni (özellikle kamuya açık ve reklam içerikli) |

**[TASARIM] Rapor düzenleyici kuralı:** kullanıcı bir rapor türü seçtiğinde ekran, o türün **bölüm ağacını** gösterir; her bölümde (i) metin alanı, (ii) o bölüme ait cetvel *alıntıları* (değiştirilemez, "kaynak araç" bağlantılı), (iii) gerekliyse ek tablo görünür. Örnek: faaliyet raporu → "Sürdürülebilirlik özeti" bölümü açıldığında karbon cetveli **zaten hesaplanmış** hâlde, kaynak şeridiyle gelir; sorumlu "onayla" der, metin alanı boşsa kapı uyarısı verir.

## III-D. Yayılım kuralı: bir sayı değişince ne olur

1. Kaynak veri değişir → motor yeniden hesaplar → **o veriyi çeken tüm rapor bölümleri** "güncellendi" damgası alır (Faz 3'e kadar basit: manifest'te hesap zamanı; paket karşılaştırılabilir).
2. Kilitli bölüm etkilenirse kilit çözülmez; "paket yeniden üretilmeli" uyarısı + onay geçmişi korunur (onay silinmez, üstüne yeni sürüm).
3. Faktör sürümü değişirse `recalc.ts` akışı devreye girer: önce/sonra tablosu + %5 anlamlılık → bu tablo rapor ekine (SASB/GRI "recalculation" açıklaması olarak) girebilir.

---

# BÖLÜM IV — Açıklanma ve korunum: resmî / gayriresmî raporlarda veri davranışı

## IV-A. Veri sınıflandırma (her veri noktası bir sınıf taşır)

| Sınıf | Tanım | Örnekler | Dışa aktarımda davranış |
|---|---|---|---|
| **C1 — Kamuya açık** | Resmî raporda yayımlanması zorunlu veya gönüllü kabul edilmiş | TTK md. 12 finansal analiz, K1-K3 toplamları, GRI 305-1..3, taksonomi oranları | Olduğu gibi; kaynak şeridiyle |
| **C2 — Otoriteye** | Yalnız düzenleyici otorite/ithalatçıya verilir | SKDM ürün bazlı SEE, TR ETS izleme planı tier detayları, doğrulama raporları | Otorite profilinde tam; kamuya açık profilde **özetlenerek** |
| **C3 — Ticari sır** | Rakip üstünlüğü; açıklanması işletmeye zarar verir | Proses parametreleri, hurda oranı, tedarikçi fiyatları, tesis bazlı enerji, ürün reçeteleri | Kamuya açıkta **bant/aralık** ya da "kaynak talep üzerine"; asla ham satır |
| **C4 — Kişisel veri** | KVKK kapsamı | Bireysel ücret, İSG olay kayıtları, devir nedenleri | **Yalnız toplulaştırılmış** (ortalama, fark %, sayı); bireysel satır hiçbir dışa aktarımda |
| **C5 — Denetim izi** | Kanıt meta verisi | Dosya adı, SHA-256, içe aktarma zamanı, olay kaydı | Taşınır (gerekli); ama örneğin "müşteri ön izleme" paketinde dosya adları kısaltılabilir |
| **C0 — Örnek veri** | Demo | Anadolu Yassı Çelik değerleri | Mevcut `SampleFlag` tüm çıktılarda kalmalı (iyi pratik — korunmalı) |

## IV-B. Açıklanması gereken / korunması gereken — tür bazlı örnek matris

| Veri | Faaliyet raporu (kamuya açık) | TSRS/GRI (kamuya açık) | SKDM paketi (yetkili/ithalatçı) | TR ETS (Başkanlık) | İç yönetim / PBC (gayriresmî) |
|---|---|---|---|---|---|
| Net satış, oranlar | **Açıklanır** (md. 12 zorunlu) | Yoğunluk paydası olarak | — | — | Tam |
| K1/K2/K3 toplamları | Özet olarak (SSÖ) | **Açıklanır** | Atıf emisyonları olarak | Kapsam 1 tesis | Tam + satır detayı |
| Ürün bazlı SEE | — | — | **Açıklanır** (zorunlu) | — | Tam |
| Tesis bazlı enerji/emisyon satırları | Özet | Sektör metrikleri (özet) | Ürün bazında gerekli kadar | **Açıklanır** (izleme planı) | Tam |
| Proses reçetesi / hurda oranı | Açıklanmaz (C3) | Açıklanmaz | Kıyas düzeltmesi için gerekliyse minimum | Gerekliyse minimum | Tam |
| Bireysel ücret/İK kaydı | Açıklanmaz (C4) | Açıklanmaz | — | — | Yalnız toplulaştırılmış |
| LTIFR/TRIR, ücret farkı % | Açıklanır (SSÖ) | **Açıklanır** (403/405) | — | — | Tam |
| Tedarikçi faktör beyanı | "Tedarikçi beyanı" etiketiyle | Etiketle | Doğrulama ekine | — | Tam + dosya kanıtı |
| Uzlaştırma açıklamaları | — | — | — | — | **Denetçi paketinde tam**; kamuya açıkta yok |
| Yeşil iddia bulguları | Metin düzeltilir; bulgu listesi yayımlanmaz | — | — | — | Tam (danışman çalışma kâğıdı) |

## IV-C. Dışa aktarımda nasıl görünmeli — kurallar seti

**R1. Görünürlük etiketi.** Her çıktı (docx, CSV, JSON, SVG) ilk sayfada/ilk satırda etiket taşır: `TASLAK — YALNIZ İÇ KULLANIM` / `YETKİLİ SUNUMU` / `KAMUYA AÇIK`. Üretim tarihi + sürüm + müşteri adıyla birlikte.

**R2. Redaksiyon profili.** Dışa aktarma anında üç profilden biri seçilir:
- **Tam görünüm** (iç/denetçi): her şey, C4 toplulaştırılmış hâliyle bile.
- **Otorite görünümü**: C1+C2 tam, C3 minimum, C4 toplulaştırılmış.
- **Kamuya açık görünüm**: yalnız C1; C2/C3 hücreleri `‹kaynak talep üzerine›` veya bant ("1–5 mn TL", "≥X tCO₂e") ile **maskelenir — asla boş bırakılmaz** (boş hücre "veri yok" ile karışır; maskelenenin *bilerek* gizlendiği görünür olmalıdır).

**R3. Özetleme yerine maskeleme.** Hassas cetvel satırlarında: toplam satırı kalır, alt satırlar birleşir (ör. tesis bazlı enerji → "3 tesis toplamı"). SKDM'de yasal zorunluluk olan alanlar maskelenemez; bu durum çıktıda not edilir ("bu paket C3 içerir, dağıtım listesine dikkat").

**R4. Kişisel veri (KVKK) her profilde toplulaştırılır.** İSG olayları "olay sayısı + kayıp gün", ücret "fark yüzdesi" olarak. Bireysel satır hiçbir dışa aktarıma girmez — bu, bir *kod kuralı* olmalı, kullanıcı tercihi değil.

**R5. Kanıt meta verisi korunumdan bağımsız taşınır.** SHA-256 + dosya adı + zaman (C5) her profilde kalır; denetim izi silinmez. Ancak "müşteri ön izleme" paketinde iç dosya yolları kısaltılabilir.

**R6. Manifest (paket künyesi).** Her paket `manifest.json`/kapak sayfası taşır: hangi veri sürümü, hangi motor/faktör sürümü, hangi redaksiyon profili, hangi alanlar maskelendi (maskelenen alanın **adı** yazılır, değeri değil), uzlaştırma özeti (fail/warn/adreslenmiş), onay kaydı (hazırlayan/kontrol/onaylayan + tarih). Bu, denetçinin "bu paket bu hâliyle mi verildi?" sorusunun cevabıdır.

**R7. Örnek veri bayrağı.** `sample: true` veride "örnek veridir" filigranı tüm çıktıda (bugün Word'te `tpl.sampleFigures` var — CSV/SVG'ye de gelmeli).

**R8. Filigran.** Taslak/kilitli olmayan her Word/PDF: diyagonal `TASLAK — Yayımlanamaz`. Onaylı pakette filigransız + manifest'te onay kaydı.

**R9. JSON dışa aktarımlarında gizli alan denetimi.** `reconciliation.notes` (serbest metin), `claims.text`, iç yorumlar "kamuya açık görünüm" JSON'unda yer almamalı; redaksiyon profili JSON'a da uygulanmalı (bugün ToolActions her şeyi döküyor).

**R10. Güvenli CSV.** A4 formül enjeksiyonu kaçışı tüm CSV'lerde; dosya adları slug'lanmış; `;` ayraç + BOM (mevcut, iyi).

## IV-D. Resmî vs gayriresmî rapor ayrımı

| | Resmî rapor | Gayriresmî rapor (iç/danışman/denetim hazırlık) |
|---|---|---|
| Dağıtım | Kamu/KAP/otorite/genel kurul | Dağıtım listesi dar (ad-ad yazılır) |
| Metin dili | Hukukî dil, standart atıfları zorunlu | Serbest; standart atıfları isteğe bağlı |
| Kaynak şeridi | Zorunlu (ilke 1) | Zorunlu (denetim izi için) |
| Redaksiyon | Kamuya açık görünüm varsayılan | Tam görünüm varsayılan |
| Damga | Onaylı + manifest | `YALNIZ İÇ KULLANIM` |
| Değişiklik | Yeni sürüm + revizyon açıklaması (önceki rakam→yeni rakam→neden) | Serbest düzenleme |
| Saklama | Kanunî süre + kanıt paketi | Proje süresi + NDA süresi |

**[TASARIM]** Uygulamada bu ayrım bir `reportKind: "official" | "internal"` bayrağıyla rapor düzenleyicide başlar; bayrağa göre varsayılan redaksiyon profili, damga, kapak şablonu ve manifest alanları otomatik değişir.

---

# BÖLÜM V — Medya havuzu

## V-A. Ne?

Raporlara giren **yayın varlıklarının** tek deposu:

1. **Grafik çıktılar** — her şemadan "havuza kaydet" (SVG + PNG + veri tablosu CSV + kaynak notu birlikte paketlenir).
2. **Fotoğraflar** — tesis, ürün, ekip görselleri (faaliyet raporunun görsel dili için).
3. **Logolar** — şirket, sertifika (ISO, CDP), ortak program rozetleri.
4. **Şablon parçaları** — imza blokları, yasal uyarılar, standart tablo başlıkları.
5. **Belge ekleri** — doğrulama raporu kapakları, YEK-G belgesi taramaları (kanıt olarak; C5).

Bugün app'te yalnız anlık SVG/CSV indirme var; saklı kütüphane, hak yönetimi ve rapor entegrasyonu yok. **[EK]**

## V-B. Meta veri (her varlık için zorunlu)

| Alan | Amaç |
|---|---|
| Varlık tipi | grafik / foto / logo / ek |
| **Kullanım hakkı** | şirket içi / müşteri / kamuya açık; lisans (ör. tedarikçi görseli NDA, stok görsel lisansı) |
| **Lisans bitişi** | dolarak uyarı ("bu görsel 2026 sonunda kamuya açıkta kullanılamaz") |
| Gizlilik sınıfı | C1–C5 (IV-A) — foto: plakalı/kimlikli görsel C4 |
| Kaynak bağlantısı | "Bu grafik: Kapsam 1-2-3 envanteri, sürüm X, tarih Y" |
| Çekim/yararlanma tarihi, çeken/üreten | KVKK ve telif izi |
| İzin verilen rapor türleri | "yeşil tahvil: evet · CDP: hayır" |

## V-C. Akış

```
Hesap/şekil → "Havuza kaydet" → varlık kartı (hak alanı zorunlu) →
rapor bölümünde "havuzdan ekle" → Word/PDF'e gömülür →
manifest: varlık adı + hash + hak notu → paket teslimi
```

- Grafik verisi değişmişse ("bu grafik şu hesaptan üretildi") havuzdaki kopya **bayatlar**: bölümde "grafik güncel değil" uyarısı + yeniden üret.
- Tasarım ajansı teslimi: "medya paketi" dışa aktarımı (tüm grafikler + CSV verileri + hak listesi) — raporlama firmalarının en sık gönderdiği paket.

## V-D. Korunumla bağı

- Havuzdan pakete giren her varlık, redaksiyon profiline uyar: kamuya açık pakette C3/C4 görsel kullanılamaz (uyarı + yer tutucu "görsel: şirket içi").
- Fotoğrafta görünür kişiler için KVKK notu ("foto izni alındı — belge no …") manifest'te.

---

# BÖLÜM VI — Yazılım geliştirme önerileri

1. **Dışa aktarma katmanı:** A4 CSV kaçışı; `buildDocx`'e `generatedAt/workspaceVersion/reconcileSummary/evidence/redaction` (IV-C R1–R10); A7 hata yönetimi; grafik gömme (B2).
2. **Rapor düzenleyici (B1 + III-C):** tür → bölüm ağacı → metin + cetvel alıntıları + onay durumu; tek tuş "rapor paketi" (Word + CSV + grafikler + manifest).
3. **Durum/onay modeli (II-C):** her veri noktası ve bölüme `status/owner/reviewer/approver`; Word imza bloğu; kapı sayfası (G1–G3).
4. **Redaksiyon profilleri (IV):** `applyDisclosure(profile)` dönüşümü; JSON/CSV/docx/SVG ortak; alan bazlı `visibility` etiketleri (`ClientData` şemasına).
5. **Medya havuzu (V):** `media/` varlık deposu (localStorage + workspace JSON'ında taşınabilir; Faz 3'te kanıt deposu).
6. **Altyapı:** A1 gerçek "bugün"; A5 `next typegen`; A6 `xlsx` tedariki; CI (test+typecheck+build); çapraz referans testlerinin vitest'e taşınması; A8/A9 sağlamlık.
7. **Test boşlukları:** `docx.ts`, `summary.ts`, `journey.ts`, `export.ts`, redaksiyon dönüşümü, claims Türkçe ek regresyonları, medya hak kuralı ("C3 görsel kamuya açık pakete giremez").

# BÖLÜM VII — İş akışı geliştirme önerileri

1. **PBC listesi üretimi:** seçilen rapor türünün cetvellerinden "hangi veri hangi dosyadan gelir" kontrol listesi (müşteriye e-posta olarak değil, CSV olarak).
2. **Kapılar (G1–G3):** paket "denetime hazır" damgasını yalnız kapılar geçilince önersin; geçilmemişse durum sayfası + TASLAK filigranı.
3. **Onay kaydı:** danışmanda müşteri onayı (ad/tarih/sürüm), şirkette komite onayı — manifest'te.
4. **Yıl kilidi:** raporlama yılı kapanınca "kilitle/kopyala"; bir sonraki yıl U8 karşılaştırmaları ve recalc girdisi.
5. **Takvim tek merkezden:** tüm deadline'lar `regulations.ts`/`sources.ts`'ten (A9); "bu hafta ne yaklaşıyor" ekranı danışman için ana ekran.
6. **Medya teslim ritmi:** tasarım ajansına dönemsel "medya paketi"; hak bitiş takvimi.
7. **CI + veri dosyası PR kontrolü:** templates/annual-report/crosswalk/journey veri dosyalarına dokunan PR'lar için kaynak doğrulama sorumluluğu (DOĞRULAMA_2026-10.md ritmi yazılıma bağlanmalı).

---

# BÖLÜM VIII — Yeni kodun taraması (origin/main birleşimi, 18.10.2026)

Birleştirilen 4 commit: **(1)** CBAM varsayılan değerlerinin Çin/Hindistan/Ukrayna/Mısır/"Diğer ülkeler" tabloları + ürün başına menşe; **(2)** Faz 2 kapanış kontrolü doğrulama paketi; **(3)** yayımlanmış kaynaklı vakalar (AB SKDM rehberleri, US EPA, GHG Protokolü); **(4)** yakıt yanmasında CH₄ ve N₂O + gaz bazlı Kapsam 1. Testler: **253/253 geçti** (16 doğrulama vakası dâhil); typecheck temiz (A5 notu geçerli).

## VIII-A. Olumlu bulgular (övgü ve süreklilik notu)

1. **Doğrulama paketi metodolojik olarak doğru kurulmuş.** Beklenen değerler asla uygulamanın hesap koduyla üretilmiyor: `web/scripts/validation/rat.mjs` BigInt tam kesir aritmetiğiyle yayımlanmış formüllerden, `r-*` vakaları ise basılı belgedeki sayılardan geliyor (belge + sayfa + SHA-256 kayıtlı). Bu, döngüsel doğrulama tuzağına düşmeyen, Faz 2 kontrol noktasını ("sapma < %0,5") yazılıma bağlayan iyi pratik.
2. **Paket kendi içinde de bulgu üretmiş:** AB çelik rehberi 5d'nin tüzükle çelişen 280 t dolaylı emisyon basması, Rehber 5d Örnek 2'deki FeCr yazım hatası (2,280 → 2,820), GHG Protokolü eğitim seti toplam hatası. Bu "araştırma bulgusu → vaka notu → uzman teyidi listesi" akışı HEDEF_MIMARI §4.3'teki kural motoru/boşluk analizi yaklaşımının öncüsüdür.
3. **CH₄/N₂O hesabı doğru.** `fuelGases`: `tj = miktar×NCV/1000`; CO₂ `tj×ef`; CH₄/N₂O `tj×(kg/TJ)/1000`; CO₂e = CO₂ + CH₄×29,8 + N₂O×273 (fosil CH₄ — gerekçeli seçim). IPCC 2006 Tablo 2.3 (sabit), 3.2.2 (karayolu), 3.5.3 (gemi), 3.4.1 (demiryolu) varsayılanları sayfa referanslarıyla `docs/kaynak-veri/ipcc` altında ve kodla test edilmiş. EPA çözümlü örnekle (doğalgaz CH₄ ≈ 0,95 kg/TJ, N₂O ≈ 0,095 kg/TJ) birebir uyumlu. EPA vakalarının gaz–gaz kütleyle karşılaştırılması (CO₂e değil) GWP seçiminden bağımsızlık sağlamış — doğru yaklaşım.
4. **Menşe bazlı SKDM tabloları iyi tasarlanmış.** `origin` alanı geri uyumlu (`?? "TR"`), FactorPicker menşeye göre filtreliyor, tabloda olmayan kodlar "Diğer ülkeler"e düşüyor, operatör CSV'sine `country_of_origin` sütunu eklendi (AB ithalatçısı için gerekli). Workspace v7 migrasyonu tek `migrateClients` altında toplanmış; içe aktarılan dosyalara da uygulanıyor.

## VIII-B. Yeni bulgular

### N1. Menşe değişiminde `defaultSee` bayatlaması — **[HATA/mantık] orta**
`web/src/features/cbam.tsx:48-56` (`changeOrigin`):
- Kütüphane bağlantısı varsa ve yeni menşe tablosunda aynı CN satırı varsa değer+bağlantı birlikte taşınıyor (doğru).
- **Ama** (a) bağlantı yoksa (elle girilmiş `defaultSee`) ya da (b) yeni tabloda satır bulunamazsa `defaultRef` silinirken **`defaultSee` değeri eski tablodan kalıyor**. `useDefault` maliyet projeksiyonu bu değeri kullanmaya devam ederken `resolveBenchmark` rotayı **yeni** menşeye göre seçiyor → değer/rota/menşe üçgeni tutarsızlaşıyor. Üstelik `cbam-benchmark.tsx:68`'deki açıklama metni "{country} varsayılan değer tablosu" diyor — yani arayüz tabloda olmayan bir değeri o tabloya atfediyor.
- Öneri: satır bulunamazsa `defaultSee` de sıfırlansın/kullanıcıya sorulsun; elle girilen değerde açıklama "elle girildi" etiketi göstersin; varsayılan değer alanı `useDefault` açıkken menşe ile tutarlılık kontrolüne (Bölüm II kapıları gibi küçük bir uyarıyla) bağlansın.

### N2. v7 migrasyonunun varsayılanları dondurması — **[TASARIM notu] düşük**
`addV7Fields` CH₄/N₂O IPCC varsayılanlarını satıra **yazıyor** ("depolanan değer kullanılan değerdir" — bilinçli seçim). Sonuç: (1) IPCC varsayılanı ileride düzeltilirse migrasyon görmüş satırlar sessizce eski değerde kalır (yalnız `factorRef`'li satırlar recalc ile taşınır); (2) satırın "varsayılan mı elle mi" kullandığı ekranda var (`nonCo2Reset` mantığı) ama dışa aktarım/raporda görünmüyor. Öneri: figür/kaynak şeridine "CH₄/N₂O: IPCC 2006 varsayılanı" bilgisi; düzeltilen varsayılan için recalc'a CH₄/N₂O satırı.

### N3. `usageNote` anahtarının TR'ye bağlanması — **[Bilgi] düşük**
`cbamCountrySet` tüm ülkeler için `factors.notes.eu_cbam_dv_tr` anahtarını kullanıyor. Metin bugün ülke-nötr ("toplam sütunu… mark-up…") olduğu için yanlış sonuç doğurmuyor; ancak ileride TR'ye özel not yazılınca diğer tablolar yanlış notu gösterir. Ülke-nötr yeni bir anahtar (ör. `factors.notes.eu_cbam_dv`) önerilir.

### N4. `setsForYear` iddia riski — **[Bilgi] düşük**
`recalc.ts` kırılımı `family:country`'ye taşımış (doğru). `pickEdition(...)!` iddiası yalnız `year`'lı aile setlerinde güvenli; bugün özel setler `family` almadığı için risk yok, ileride aileli/yılsız özel set açılırsa çöker (A7 sınıfı — aynı öneriler).

## VIII-C. Önceki bulguların durumu

Yeni iş A1–A9 ve B1–B7'ye **dokunmadı**: donmuş "bugün" (A1, hâlâ `common.tsx:54`, `overview.tsx:23`, `regulations.tsx:13`), TR iddia kalıpları (A3), CSV enjeksiyonu (A4), typegen (A5), `xlsx` CDN (A6 — bu oturumda yine kurulumu kırdı), Word ☐/rakam eksikliği (A2) hepsi açık. Öncelikli kısa kazanımlar güncelliğini koruyor.

# BÖLÜM IX — Sektörel karşılaştırma (Ekim 2026)

## IX-A. Platform manzarası

| Kategori | Platformlar | İş akışı güçleri | Not |
|---|---|---|---|
| Karbon-öncelikli defter | **Persefoni**, Watershed, Normative | Finans disiplininde "carbon ledger"; veri noktası başına kanıt/iz; 500.000+ güncellenen faktör (Watershed); AI destekli kapsam 3 sınıflandırma ve tedarikçi verisi | Fiyat: $50–500k+/yıl |
| Disclosure + finans | **Workiva**, Diligent, Novisto | Anlatı toplama, sürüm/onay/imza akışları, XBRL/iXBRL, finansal dosyalamayla ortak kontrol ortamı; CSRD/SEC | CBAM kapsamı zayıf (sektör incelemeleri); pahalı, kurulum ağır |
| Tam-yığın ESG | **Sweep**, Greenly, Plan A, IBM Envizi, Position Green, ESG:ONE | Çok-çerçeve tek veri modeli; tedarikçi anketleri/portalı; azaltım senaryoları, MACC (Plan A, CO2 AI); TÜV sertifikalı metodoloji (Plan A) | Sweep ~$250/ay giriş; hepsi SaaS |
| CBAM uzmanları | **CarbonChain**, CBAMBOO, kolum, cbamtrack, Certivo | Tedarikçi outreach'i, güvence iş akışı (doğrulayıcı erişimi, sürüm geçmişi), gümrük verisiyle mutabakat, **CBAM kayıt sistemi uyumlu XML** | İlk beyan 30.09.2027; asıl yükün tedarikçi verisi toplama olduğu vurgusu ortak |
| Türkiye | **Karbonet** (CBAM modülü), muhasebe/ESG danışmanlık araçları | TR ihracatçı + AB alıcısına ortak sayı seti | Doğrudan pazar komşusu; TSRS/TR ETS derinliği belirsiz |

Sektörde ortak kabul gören 2026 takvimi (AB/CSRD): **Ocak** toplama → **Şubat** doğrulama → **Mart** taslak → **Nisan** güvence saha çalışması + veri dondurma → **Mayıs** üretim/bildirim → **Haziran** yayınlama; Temmuz–Aralık paydaş/tema bakımı.

## IX-B. Sektörel kıyasla Isoline'da olmayanlar (eksikler)

1. **Veri toplama iş akışı (en büyük boşluk).** Rakiplerin pazarladığı asıl değer "istek gönder → takip et → hatırlat → onayla" döngüsü (site sahibi, tedarikçi, İK anketleri). Isoline'da veri ya elle girilir ya dosya yüklenir; **kimden isteneceği, isteğin durumunun ne olduğu** izlenmiyor. (CBAM'de de sektör "asıl yük tedarikçi verisi" diyor.)
2. **Veri noktası başına kanıt/onay mimarisi (ledger).** Sektör standardı: her metrik için kaynak belge, toplama süreci, doğrulama kuralı, onay akışı, saklama; beş güvence iddiası (bütünlük, doğruluk, varlık, dönem kesiti, sınıflandırma). Isoline'da kanıt yalnız dosya içe aktarmasında (SHA-256); elle girilen alanda kanıt/onay yok.
3. **Entegrasyonlar:** ERP/muhasebe/API; rakiplerde yüzlerce konektör, Isoline'da yalnız xlsx/csv.
4. **Tedarikçi/portal katmanı** (Kapsam 3 ve SKDM tedarikçi verisi için).
5. **Rapor üretici derinliği:** anlatı editörü + çerçeve-özel üretici + iXBRL (Faz 6'da planlı); rakiplerde hazır.
6. **Rol/onay/çok kullanıcılık** (Faz 3–4; bkz. Bölüm II-C bunun v1 karşılığı).
7. **Organizasyon ağacı:** tesis→şirket→grup hiyerarşisi (gösterge içe aktarmada tesis var, konsolidasyon şeması yok); konsolide sınır farkları (Bölüm III-A) için gerekli.
8. **Kıyaslama/hedef yönetimi:** peer benchmark, SBTi doğrulama durumu, çeyreklik trend alarmı.
9. **AI taslak yazımı** (Faz 5; rakiplerde "kaynaklı taslak" standartlaşıyor).

## IX-C. Isoline'ın farklılaştığı yerler (korunacaklar)

1. **Türkiye mevzuat derinliği:** TSRS 1-2, KGK eşikleri, TR ETS (KPK dâhil), SPK/BDDK faaliyet raporu, ETKB/TÜİK/ETKB sürüm yönetimi — global platformlarda yok; Karbonet'te bile şüpheli.
2. **Kaynak-izli hesap + doğrulama paketi:** her faktörün sicili, AS_OF, yayımlanmış kaynaklı vakalar — "source before statement" rakiplerin çoğundan ileride; güvence hazırlığı için güçlü farklılaştırıcı.
3. **Tek omurga, çok rapor:** faaliyet raporu + SKDM + TR ETS + sürdürülebilirlik aynı veriye bağlı (rakipler genelde iklim+ESG'de kalıyor, faaliyet raporu yok).
4. **Yerel çalışır/veri tarayıcıda kalır + erişilebilir fiyat** — danışman segmenti (çok müşteri) için önemli.
5. **Faktör sürümü + geriye dönük yeniden hesap** (recalc + %5 anlamlılık) — birçok global üründe yok/yarım.

# BÖLÜM X — Sektörel doğru iş akışı (hedef operasyon modeli)

Sektör literatürü (PwC, Protiviti, OneStopESG, CouncilFire, güvence rehberleri) + CBAM oyun kitapları + HEDEF_MIMARI birleştirildiğinde doğru akış **8 aşamalı** ve her aşamada "sahip, kanıt, onay" taşır:

| # | Aşama | Ne yapılır | Bugünkü karşılığı | Eklenmeli |
|---|---|---|---|---|
| 0 | **Planla** | Kapsam testi, RACI (her metrik için sorumlu/hesaplayan/onaylayan), yıllık takvim, güvence kapsamı | Kapsam testi + journey (kısıtlı) | RACI şablonu; takvimin regulations'tan türetilmesi (A9) |
| 1 | **Tanımla** | KPI tanım dokümanı: sınır, yöntem, birim, tahmin politikası, güvence seviyesi | Çerçeve eşleme (20 satır) | Metrik tanım kartı (crosswalk satırı = veri noktası tanımı, HEDEF_MIMARI §4.1) |
| 2 | **Topla** | Veri istekleri, dosya içe aktarma, tedarikçi anketleri; her satırda kaynak belge | Dosya içe aktarma + importLog (iyi); elle giriş | **İstek/görev takibi (PBC üretimi)**; elle girişte kanıt alanı; tedarikçi anketi (Faz 3 portal) |
| 3 | **Hesapla** | Motorlar + sürüm seçimi + yeniden hesap; uzlaştırma U1–U10; tahmini veri payı | **Güçlü** (motorlar, recalc, U1–U10) | U6–U7; metrik-bazlı kontrol genişlemesi |
| 4 | **Kontrol et** | Bölüm sorumlusu onayı; finans/İK/İSG ikinci bakışı; görev ayrımı; "red-team" (tutarsızlık avı) | AR durum/owners; uzlaştırma açıklamaları | Durum makinesi (II-C) tüm verilere; red-team otomasyonu = uzlaştırma + iddia taraması + gelecek yıl "aynı rakam iki yerde" raporu |
| 5 | **Derle** | Şablon bölüm ağacı; alıntılar; iddia taraması; çapraz-çerçeve | Şablonlar + claims (B1/B5 eksik) | Rapor düzenleyici (III-C), Word iyileştirmeleri (B2) |
| 6 | **Güvence hazırlığı** | PBC listesi, mock-audit (10–15 veri noktasını geriye izleme), 5 iddianın testi, düzeltme kaydı | Uzlaştırma CSV/JSON + kanıt listesi (yok) | **Mock-audit modülü**: seçilen rakam → kaynak zinciri raporu; PBC üretimi; denetçi görünümü (Faz 4) |
| 7 | **Onayla & dondur** | Yönetim/komite onayı; veri dondurma (data freeze); sürüm damgası | AR "approved" (yalnız orada) | Kilitleme + manifest (IV-C R6); yıl kopyası (B6) |
| 8 | **Yayımla & arşivle** | KAP/otorite/güvence paketi; dağıtım listesi; arşiv; sonraki yıl baz yılı ve recalc girdisi | Elle derleme | Tek paket (B1); medya havuzu teslimi (V); yıl kilidi |

**SKDM özel akışı** (sektör oyun kitabı, Isoline'a eşlenecek): gümrük/kargo katmanı (KN, menşe, miktar) → **tesis katmanı** (operatör, tesis, rota) → **emisyon katmanı** (doğrudan/dolaylı/öncül, ürün başına SEE) → **doğrulama katmanı** (akredite doğrulayıcı, rapor referansı, geçerlilik). Çeyreklik veri hazırlığı → yıllık beyan (30.09). Isoline'ın eksikleri: gümrük mutabakatı (ithalat kaydı ↔ ürün satırı), doğrulama raporu takibi, tedarikçi istek akışı. Var olanlar: SEE/kıyas/FAA hesabı, operatör CSV'si, menşe tabloları (yeni).

**TR ETS özel akışı:** tesis envanteri → izleme planı (tier cetveli) → yıllık raporlama (30 Nisan) → ücretsiz tahsisat → teslim (Kasım son iş günü) → ceza/açık yönetimi. Isoline bunun çoğunu modellemiş; eksik: izleme planı **belgesi** üretimi (şablon var, Word çıktısı cetvel tam değil) ve Başkanlık bildirim akışı takvimi.

**Yıllık takvim önerisi (TR gerçekliğiyle):** Ocak–Şubat veri toplama (mizan + göstergeler) → Mart hesap + uzlaştırma → Nisan taslak + iddia taraması + iç kontrol → Mayıs güvence hazırlığı (mock-audit) → haziran-temmuz faaliyet raporu/yayın takvimi (dönem sonu + 2 ay/60 gün) → 30.09 SKDM beyanı → 30 Nisan TR ETS → Kasım TR ETS teslimi. Journey'deki `when` alanları bu takvimle kalibre edilmeli (bugün -9…+9 ay kabaca doğru; kapılarla birleşince tam bir operasyon takvimi olur).



# Önceliklendirme

> Bölümler VIII–X (yeni kod taraması + sektörel kıyas) sonrası güncellenmiştir.

| # | Konu | Tür | Efor | Etki |
|---|---|---|---|---|
| 1 | "Bugün" tarihinin gerçek tarih yapılması (A1) | hata | çok küçük | yüksek |
| 2 | TR iddia kalıpları + regresyon testi (A3) | hata | küçük | yüksek |
| 3 | CSV enjeksiyon kaçışı (A4) + `typecheck`/CI (A5) | hata/iş akışı | küçük | yüksek |
| 4 | `changeOrigin` bayat `defaultSee` tutarsızlığı (N1) | hata/mantık | küçük | orta |
| 5 | Word: ☑/☐ işareti, figür + kaynak şeridi, imza bloğu (A2, II-C) | hata/eksik | orta | yüksek |
| 6 | Redaksiyon profilleri + görünürlük etiketleri (IV-C) | tasarım | orta | **çok yüksek** |
| 7 | Veri toplama istekleri + PBC üretimi (IX-B.1, VII-1) — sektörel en büyük boşluk | ürün/iş akışı | orta | **çok yüksek** |
| 8 | Veri noktası kanıt/onay alanları + durum makinesi (II-C, IX-B.2) | tasarım | orta-orta | yüksek |
| 9 | Rapor düzenleyici: tür → bölüm ağacı → cetvel alıntıları (III-C) | ürün | büyük | **çok yüksek** |
| 10 | Mock-audit modülü (Bölüm X, aşama 6) | ürün | orta | yüksek |
| 11 | Medya havuzu v1 (grafik kaydetme + hak alanı) (V) | ürün | orta | yüksek |
| 12 | Grafiklerin Word'e gömülmesi (B2) | ürün | orta | yüksek |
| 13 | Dönem kopyası + U6–U7 (B6) | ürün | büyük | yüksek |
| 14 | Organizasyon/tesis hiyerarşisi + konsolide sınır (IX-B.7) | ürün | büyük | orta |
| 15 | Çok kullanıcılı roller/denetçi alanı (Faz 3–4) | platform | büyük | yüksek |

---

# Ek A — Uçtan uca örnek: "Faaliyet raporunda karbon verisi"

Sizin verdiğiniz örnek üzerinden akışın doğrulanmış hâli (madde 1-4 bugün çalışır; 5-7 tasarım):

1. **Giriş:** Üretim/enerji sorumlusu envanter şablonunu (CSV/Excel) yükler *veya* GHG formunda yakıt/elektrik satırlarını girer. Dosya ise SHA-256 ile `importLog`'a yazılır.
2. **Hesap (tek kez):** Kapsam 1-2-3 aracında NCV×EF ile emisyonlar; envanter yılına göre ETKB sürümü; K3 kategorileri. Sonuç: K1/K2(lok+piyasa)/K3 cetveli + yoğunluk.
3. **Kontrol:** Uzlaştırma U2 (enerji ≥ yakıt+elektrik), U5 (ETS tesis ≤ K1), U8 (yıllık değişim), U9 (tahmini pay) çalışır; farklara açıklama yazılır.
4. **Çekme:** Faaliyet raporu şablonu "Sürdürülebilirlik özeti"nde bu cetveli **yeniden hesaplamadan** alıntılar; yanında `Kaynak: Kapsam 1-2-3 Envanteri · ETKB 2023 · …` şeridi (tasarımda) durur. TSRS 2 ¶29a, GRI 305 ve CDP M7 **aynı** rakamı kendi dillerinde gösterir.
5. **Fark görünürlüğü:** Faaliyet raporu konsolide, envanter operasyonel kontrol sınırındaysa bölümde "sınır farkı" uyarısı (U3/U5 mantığı) + açıklama alanı.
6. **Onay:** Karbon bölümünün sorumlusu "kontrol etti", finans müdüründen yoğunluk paydası (net satış, U1) teyidi, onaylayan "onayladı" → bölüm kilitlenir.
7. **Dışa aktarım:** Kamuya açık görünüm seçilir → tesis bazlı satırlar birleştirilir (C3), grafik havuzdan pakete girer, manifest onay + sürüm + maske kaydını yazar.

# Ek B — Kavram sözlüğü

| Kavram | Anlamı |
|---|---|
| Veri noktası | Her sayı: değer + dönem + sınır + birim + kaynak + kalite + durum + sürüm (HEDEF_MIMARI §4.1) |
| Cetvel | Bir konunun standart hesap tablosu (ör. K1-K2-K3 cetveli); kendi konu ekranında yaşar, raporlar alıntı yapar |
| Alıntı | Rapordaki cetvel görüntüsü; yeniden hesaplanmaz, kaynak şeridi taşır |
| Redaksiyon profili | Dışa aktarımda hangi veri sınıfının nasıl görüneceği (tam/otoritî/kamuya açık) |
| Kapı (gate) | Onay öncesi zorunlu kontrol noktası (G1 veri, G2 metin, G3 onay); engellemez, damgalar |
| Medya havuzu | Grafik/foto/logo/ek varlıklarının haklarıyla birlikte tutulduğu depo |
| Manifest | Paket künyesi: sürüm, onay, redaksiyon, maskelenen alanlar, kanıt listesi |
| PBC | Denetçinin/müşterinin sağlayacağı veri listesi ("provided by client") |
