# G8-07 — Erişilebilirlik denetimi (WCAG 2.2 AA)

**Tarih:** 19.10.2026. **Araçlar:** axe-core 4.14.0 (`@axe-core/playwright`), Playwright 1.64.1, Chrome 155. **Ortam:** üretim derlemesi (`next build`, standalone sunucu), ayrı `isoline_e2e` veritabanı, demo verisi + 20 geçici müşteri + 200 arka plan kiracısı.

## 1. Ne denetlendi, nasıl

Her ekran, orada çalışan kişinin oturumuyla açılır ve üç geçişten geçer; herhangi bir bulgu (etki düzeyi ne olursa olsun) testi düşürür:

1. **axe, WCAG 2.0 / 2.1 / 2.2 A ve AA kuralları**, ekran olduğu gibi (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`).
2. **Kontrast, zeminin en koyu ve en açık noktasında.** Sayfa zemini sabit (`background-attachment: fixed`) bir gradyan; içerik kaydıkça her metin zeminin her noktasının üstünden geçebilir. axe gradyan üstündeki yarı saydam cam paneli hesaplayamıyor ("bgGradient": ilk denemede 1.691 metin düğümü ölçülemedi). Bu yüzden içerik gizlenip zeminin boyanmış hâlinin ekran görüntüsü alınıyor, en koyu ve en açık piksel bulunuyor (1280×720'de rgb(159,181,253) ve rgb(214,224,250)) ve kontrast bu iki rengin düz zemin olduğu durumda yeniden ölçülüyor. Bir yürütmede iki geçişte toplam **3.320 düğüm** ölçülüyor.
3. **SVG metin kontrastı, piksel üzerinden.** axe grafik içindeki metni atlıyor ("imgNode"). İzometrik tesis haritası ve Sankey etiketleri gizlenip sayfa yakalanıyor; her etiketin kutusundaki arka plan piksellerine karşı kontrast hesaplanıyor; en kötü %10'luk dilim 4,5:1'e (büyük metinde 3:1'e) ulaşmalı.

`body::before` doku katmanı (opaklık 0,14, içeriğin altında) kontrast hesabında yok sayılıyor (`ignorePseudo`); kısa metinler (KPI sayıları gibi) de ölçülüyor (`ignoreLength`).

**Ekranlar (12 + giriş + görev formunun 4 adımı = 18 tarama):** giriş (boş ve hata), çalışma alanı seçimi, ana sayfa, portföy, proje genel bakışı (izometrik tesis haritası), veri kampanyası, görev kutusu, görev formu (Ne isteniyor → Değer → Kanıt → Gönder), hesaplamalar (Sankey), hesap çalışması, köken (`facts/[id]`), rapor stüdyosu, dönem kapanışı, inceleme kuyruğu.

**Sonuç:** 18 taramanın hepsinde **0 bulgu** (kritik, ciddi, orta ve küçük dahil). Ekran başına 23–33 axe kuralı geçti. "İnceleme gerekli" kalan tek kural: gradyan zemindeki ilk geçişin kontrastı (2. geçişte ölçülüyor). Düz zemin geçişlerinde kalan birkaç düğüm, kaydırma kabında kırpılmış menü bağlantıları ve rapor stüdyosundaki belirteç çipleridir; ikisi de aynı renklerle başka yerde ölçülen bileşenler.

## 2. Bulunan ve düzeltilen ihlaller

| # | Bulgu (WCAG) | Etki | Kök neden | Düzeltme |
|---|---|---|---|---|
| 1 | Bağlantı-düğmeler ve etkin proje sekmesi mavi zeminde koyu metin, 2,64:1 (1.4.3) | ciddi | `a { color: inherit }` katmansız yazılmıştı; Tailwind v4'te katmansız kural `@layer utilities` içindeki `text-white`'ı eziyordu | Kural `@layer base` içine alındı; uygulama genelinde bağlantı renk sınıfları yeniden çalışıyor |
| 2 | Dil seçeneklerinin erişilebilir adı ("Türkçe") görünen metni ("TR") içermiyor (2.5.3) | ciddi | `aria-label={nativeName}` | Ad "TR – Türkçe" biçiminde, `lang` özniteliğiyle |
| 3 | Cam paneldeki ikincil ve durum metni (`ink-3`, `ok`, `warn`, `crit`) zeminin koyu noktasında 4,08–4,31:1 (1.4.3) | ciddi | Cam %58 beyaz; altındaki gradyanın en koyu yeri metni 4,5'in altına çekiyordu | Cam %78 beyaz (`--glass`); analitik en kötü zeminde bile ≥ 4,5:1. `DESIGN.md` güncellendi |
| 4 | Doğrudan zemine yazılan sayfa alt başlığı (`ink-2`, 4,30:1) ve yanındaki bağlantılar (`b-700`, 4,21:1) (1.4.3) | ciddi | Metin panele değil gradyana yazılıyor | `.on-ground` kapsamı: `ink-2`/`ink-3`/`b-700` derin karşılıklarına (`--ink-ground` #32406a, `b-800`) eşleniyor; sayfa başlığı bloğu ve zemindeki bağlantılar bu kapsamda |
| 5 | Rozet ve "örnek veri" etiketi zemine düşünce 2,73:1 (1.4.3) | ciddi | Rozetin kendi zemini yoktu | Rozetler beyaz kâğıt zeminiyle çiziliyor |
| 6 | Görev adım numarası: beyaz/%20 üstünde beyaz, 4,22:1 (1.4.3) | ciddi | Yarı saydam daire | Etkin adımda beyaz daire + kobalt rakam, diğerlerinde açık mavi daire |
| 7 | Bağlam çubuğunda rolsüz öğede `aria-label` (4.1.2) | — | `div` adlandırılamaz | `role="group"` |
| 8 | `role="img"` olan tesis haritasının içinde odaklanabilen, rolsüz bloklar (4.1.2, 2.4.3) | — | `<g tabIndex=0 aria-label>` | Sekme durakları kaldırıldı; aynı sayılar haritanın altındaki tabloda (klavye ve ekran okuyucu yolu) |
| 9 | Görev formunda adım değişince odak `body`'ye düşüyor (2.4.3) | — | Odaktaki düğme DOM'dan kalkıyordu | Odak açılan adıma taşınıyor (adlandırılmış grup, ör. "2. Değer") |
| 10 | Gönderim/kabul sonrası form kayboluyor, hiçbir şey duyurulmuyor (4.1.3) | — | Durum değişimi sessizdi | Talep durumu `role="status"` canlı bölge; işlemden sonra odak oraya alınıyor ("Gönderim bekliyor", "Kabul edildi") |
| 11 | Görev başlığındaki proje bağlantısı çevresindeki metinden yalnız renkle ayrılıyor (1.4.1) | — | `.on-ground` ile renkler yakınlaştı | Altı çizili |

Belirteç testi (`src/lib/visual/contrast.test.ts`) 28'den 41 teste çıktı: metin belirteçleri artık **cam + en koyu zemin** bileşiminde ve **doğrudan zeminde** (`.on-ground`) de sınanıyor; `.on-ground`'un tam olarak zeminde başarısız olan belirteçleri yeniden eşlediği de denetleniyor. Gradyan ya da cam opaklığı değişirse bu test tarayıcı açmadan düşer.

## 3. Klavye akışı (yalnız Tab, yazma ve Enter)

`e2e/keyboard.spec.ts` iki kişiyle uçtan uca koşar; fare yok, girişten sonra adres çubuğu yok. Her adımda odak halkasının görünür olduğu (2.4.7) ve hedefin Tab sırasıyla erişilebilir olduğu (2.1.1, 2.4.3) denetlenir. Sayılar son yürütmeden:

**Katkıcı (Zeynep): giriş → görev → değer → kanıt → gönderim**

| Adım | Tuşlar | Sonuç |
|---|---|---|
| Giriş sayfası | 3×Tab → e-posta, yaz; Tab → şifre, yaz; Enter | Çalışma alanı seçimi |
| Çalışma alanı | 5×Tab → "Anadolu Gıda Holding"; Enter | Ana sayfa |
| Menü | 13×Tab → "Görevlerim"; Enter | Görev kutusu |
| Görev | 5×Tab → görev bağlantısı; Enter | Görev formu, adım 1 |
| Adım 1 → 2 | 6×Tab → "Sonraki adım"; Enter | Odak "2. Değer" grubunda |
| Değer | 1×Tab → "Değer", yaz; 5×Tab → "Taslağı kaydet"; Enter | Taslak kaydedilir, odak "3. Kanıt" grubunda |
| Kanıt | 3×Tab → "Projedeki bir dosyayı bağla", dosya adını yaz (seçim kutusunda yazarak seçim); 1×Tab → "Bağla"; Enter | Dosya talebe bağlanır |
| Adım 3 → 4 | 1×Tab → "Sonraki adım"; Enter | Odak "4. Gönder" grubunda |
| Gönderim | 2×Tab → "Gönder"; Enter | Form kapanır; odak talep durumunda, "Gönderim bekliyor" duyurulur |

**Gözden geçiren (Mehmet): giriş → inceleme kuyruğu → kabul**

| Adım | Tuşlar | Sonuç |
|---|---|---|
| Giriş ve çalışma alanı | yukarıdaki gibi (3×Tab, 5×Tab) | Ana sayfa |
| Menü | 14×Tab → "İnceleme kuyruğu"; Enter | Kuyruk |
| Talep | 4×Tab → talep bağlantısı; Enter | Görev sayfası, inceleme paneli |
| Kabul | 2×Tab → "Kabul et"; Enter | Odak talep durumunda, "Kabul edildi" duyurulur |

Her sayfanın başında "Ana içeriğe atla" bağlantısı vardır (2.4.1); yukarıdaki sayılar onu kullanmadan, en uzun yoldan ölçülmüştür.

## 4. Çalıştırma (yerel ve CI)

```bash
npm run build
npm run test:e2e
```

`test:e2e` önce `e2e:prepare` ile `isoline_e2e` veritabanını sıfırdan kurar (göç, referans veri, demo, iki açık görev, ölçek ve arka plan kiracıları), sonra Playwright 3211 portunda kendi üretim sunucusunu başlatır. Geliştirme veritabanına ve 3210'daki geliştirme sunucusuna dokunmaz. Gereken ortam değişkenleri `web/.env.local`'dakilerle aynıdır (CI'da iş ortamından gelir). Tarayıcı: CI'da `npx playwright install --with-deps chromium`; indirme yapılmayacak bir iş istasyonunda `PW_CHANNEL=chrome` (ya da `msedge`). CI'da (`CI=1`) bir yeniden deneme, iki işçi ve `playwright-report/` HTML raporu açılır; her ekranın axe sonucu rapora JSON olarak eklenir.

## 5. Kapsam dışı kalanlar (açık)

- **Gerçek ekran okuyucuyla elle deneme** (NVDA/JAWS, VoiceOver) yapılmadı. Otomatik denetim adları, rolleri, odak sırasını ve canlı bölgeleri doğrular; okuma sırasının ve duyuruların doğal olup olmadığını kullanıcıyla sınamak ayrı bir iştir.
- **Mobil görünüm, %200 yakınlaştırma ve yeniden akış (1.4.4, 1.4.10)** bu turda otomatik sınanmadı; testler 1280×720 masaüstü görünümünde koşar.
- Yukarıdaki 12 ekran dışındaki ekranlar taranmadı; aynı bileşenleri kullandıkları için düzeltmelerden (bağlantı katmanı, cam, rozet, `.on-ground`) yararlanırlar ama ölçülmediler.
