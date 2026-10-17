# F. Görsel dil: tema paleti, analiz tabloları ve hareket (18.10.2026)

Amaç: grafik ve tablolarda renklerin birbirine ve mavi arayüze karışmaması; ESG ile sınırlı olmayan (faaliyet raporu, karbon fiyatlaması, finans) bir tema şablonu; tablolarda ikon ve kısa animasyonlar. Açık tema kalıcıdır (kullanıcı kararı 17.10.2026), koyu tema yoktur.

## 1. Referans: Paragon +Impact "ESG & Thematic Analysis" (Dribbble, Marli Terblanche)

Kaynak: dribbble.com/shots/16980125. Dribbble'ın görselden otomatik çıkardığı renkler (tasarımcının kendi tokenları değildir): `#F5F6F6`, `#021012`, `#CBBCB4`, `#A8ABAD`, `#D92E1A`, `#3F5459`, `#788B83`, `#1B8B47`.

Gözlenen desenler:

- **Tema yapısı:** üç sütun (Yönetişim koyu mavi-petrol, Çevre teal-yeşil, Sosyal turuncu-kırmızı) dış halkada; içte 17 SKA resmî renkleri ve beyaz piktogramlarla güneş patlaması (sunburst) grafiği.
- **Liste ve tablo:** her tema renkli zeminli bir başlık satırıyla açılır (Çevre açık yeşil, Sosyal açık somon). Her satırda küçük, dolu bir ikon karosu, numara, ad ve ok bulunur. Satırlarda bölmeli bir derece çubuğu (kırmızı → yeşil) ve harf notu çipi var.
- **Renk disiplini:** tek vurgu rengi yalnız eylem için kullanılıyor; renk hiçbir yerde tek başına anlam taşımıyor, her zaman ikon ya da metinle birlikte geliyor.

Isoline'a alınanlar: tema başlık satırı (`GroupRow`), satır başı ikon karosu (`ThemeIcon`), bölmeli puan ölçeği (`ScoreScale`), sütun ve tema halkası (`ThemeRing`). Alınmayan: kırmızıdan yeşile not çubuğu. Durum renkleri yalnız anlam için ayrıldığından puan ölçeği tema rampasıyla (açık → güçlü) çizilir.

## 2. Mevcut sistemdeki sorunun ölçümü

CIEDE2000 renk farkı (ΔE00) kullanıldı. 10'un altı grafik işaretinde karışır, 20'nin üstü açıkça farklıdır. Renk körlüğü simülasyonu Machado, Oliveira ve Fernandes (2009) modeline göre, tam şiddette yapıldı.

| Çift | Normal | Protanopi | Döteranopi | Tritanopi |
|---|---|---|---|---|
| rapor laciverti `#172a6e` ↔ kobalt arayüz | 7,6 | | | |
| hidro mavisi `#0c74b0` ↔ kobalt | 14,2 | ≈ 7,9 | ≈ 7,6 | |
| sienna `#b4531f` ↔ orman `#2e7a47` | | 8,1 | 13,4 | |
| hidro ↔ orman | | | | 8,7 |

Ayrıca sienna, hidro ve orman aynı açıklıkta (L* 45–47) olduğundan açıklık farkı ayrışmaya katkı sağlamıyordu. Veri renkleri yarı saydam cam karolar üzerinden mavi zeminle karışıyordu.

## 3. Karşılaştırılan sistemler

| Sistem | Ne alındı |
|---|---|
| IBM Carbon (kategorik palet, açık tema) | Sabit sıralı dizi, komşular arasında yüksek kontrast; durum renkleri ayrı bir set. Hareket süreleri 70/110/150/240/400 ms, "productive" eğri `cubic-bezier(0.2,0,0.38,0.9)`. |
| SAP Fiori (12 sıralı renk) | Renge hex ile değil token adıyla başvurulur; grafik başına tek palet; tahmin, gerçek ve hedef renkle değil desenle ayrılır. |
| Atlassian veri görselleştirme | Grafik başına en çok 5–6 renk, gerisi gruplanır; marka rengi yalnız tek serili grafikte; vurgulamak için diğer seriler gri yapılır. |
| Tableau 10, Okabe-Ito | Okabe-Ito renk körlüğüne güvenli, ama turuncu, gök mavisi ve sarısı beyaz üstünde 3:1 kontrastın altında. Aynı testte en kötü çifti 10,9. |
| Watershed (ürün sayfası) | Doygun marka mavisi asla grafik rengi değil; veri pastel ve yumuşak tonlarda. |

Persefoni, Sweep, Normative, Greenly, Plan A, Sphera, Workiva, Novisto, Position Green, Datamaran, Clarity AI, MSCI, Sustainalytics ve Diligent için yayımlanmış bir grafik paleti bulunamadı. Bu nedenle bunlar hakkında bir iddiada bulunulmuyor.

E/S/G sütun renkleri için sektörde bir standart bulunamadı. Yaygın eğilim Çevre için yeşil.

## 4. Karar: 10 temalı veri paleti

Seçim yöntemi:

- **Arama uzayı:** OKLCH uzayında her tema için anlamsal bir ton aralığı tanımlandı (iklim tuğla-turuncu, enerji amber, su gök mavisi vb.).
- **Optimizasyon hedefi:** dört görüş tipinin (normal, protanopi, döteranopi, tritanopi) tamamında en yakın çiftin ΔE00 değerini en büyütmek.
- **Kısıtlar:** beyaz üstünde en az 3:1 kontrast ve kobalt arayüz renklerinden uzaklık.
- **Arama biçimi:** rastgele başlangıç ve tepe tırmanma.
- **Bağımsız kontrol:** araştırma ajanı aynı yöntemi ayrı bir betikle uyguladı ve benzer sonuca vardı.

| Tema | Güçlü | İkon | Sütun |
|---|---|---|---|
| İklim ve karbon | `#9b3a0c` | Thermometer | E |
| Enerji | `#bb8b3f` | Zap | E |
| Su | `#2e9cbf` | Droplets | E |
| Doğa ve biyoçeşitlilik | `#1f5a3a` | Trees | E |
| Döngüsellik ve atık | `#637942` | Recycle | E |
| Kirlilik | `#988778` | CloudFog | E |
| İnsan ve toplum | `#c06092` | Users | S |
| Değer zinciri | `#36786e` | Truck | S |
| Yönetişim | `#704488` | Landmark | G |
| Ekonomi ve finans | `#293a45` | Coins | Ekonomi |

Sonuç (en yakın çiftin ΔE00 değeri; testin asgari eşiği): normal ≥ 13,5; protanopi, döteranopi ve tritanopi ≥ 10. Eski sistemde en kötü değer 7,6 idi. Okabe-Ito aynı testte 10,9 alıyor.

Her güçlü ton:

- kobalt, vurgu mürekkebi, lacivert, periwinkle ve soluk mürekkepten ≥ 15 ΔE uzakta;
- beyaz üstünde ≥ 3:1 kontrastlı.

Mürekkep tonu kendi yıkama zemininde ≥ 4,5:1 kontrastlıdır. Kesin değerler uygulamadaki "Tema ve renk rehberi" sayfasında canlı olarak hesaplanır.

Bilinen ödünler:

- Enerji amberi uyarı durum rengine yakın. Bu nedenle durum renkleri asla tek başına kullanılmaz; her zaman ok, ikon ya da çizgi biçimiyle gelir.
- Doğa yeşili "olumlu" durum yeşiline yakın; aynı kural geçerli.
- Kirlilik, renk yerine sıcak gri tonla ayrışır.

## 5. Uygulama kuralları

- **Katmanlar:** mavi arayüzdür, tema renkleri veridir, kırmızı-amber-yeşil yalnız durumdur.
- **Analiz yüzeyi:** grafik ve tablolar %94 opak kâğıt üzerindedir (`.glass.sheet`); zemin rengi veriye karışmaz.
- **Renk sayısı:** grafik başına en çok altı renk. Tema olmayan kategoriler sıralı `CATEGORICAL` dizisini kullanır.
- **Değişim okları:** renk yönü değil iyi ya da kötüyü anlatır; emisyon düşüşü yeşildir.
- **Hareket:** yalnız ilk yüklemede oynar; veri yenilendiğinde tekrarlanmaz.
  - Süreler: çubuklar 520 ms (en çok 12 × 32 ms kademe), çizgi 900 ms, satırlar 240 ms (24 ms kademe), sayaç 700 ms.
  - Tema ikonlarının her biri, üzerine gelindiğinde kendine özgü kısa bir hareket yapar.
  - `prefers-reduced-motion` açıksa tüm hareketler durur.
- **İkonlar:** zaten kurulu olan Lucide seti, 1,8 çizgi kalınlığında, duotone karo (yıkama zemini ve mürekkep ikon). Ek bağımlılık (lucide-animated/Motion, Lordicon/Lottie) eklenmedi; mikro hareketler yalnız CSS ile yapıldı.

## 6. Doğrulama

- `web/src/lib/color.test.ts` şunları denetler:
  - ayrışma, arayüz uzaklığı ve kontrast sınırları;
  - rampaların koyudan açığa sıralanması;
  - CSS tokenlarının TS kaynağıyla birebir eşleşmesi;
  - özellik tabanlı testlerle ΔE ve kontrast fonksiyonlarının matematiksel özellikleri.
- `web/src/lib/countup.test.ts` sayacın biçimlendirilmiş metni tr ve en yerel ayarlarında aynen geri ürettiğini denetler.

Kaynaklar:

- dribbble.com/shots/16980125
- carbondesignsystem.com/data-visualization/color-palettes
- carbondesignsystem.com/elements/motion/overview
- sap.com/design-system/fiori-design-web (chart color palettes)
- atlassian.design/foundations/color/data-visualization-color
- github.com/d3/d3-scale-chromatic (Tableau10)
- Machado, Oliveira, Fernandes (2009), "A Physiologically-based Model for Simulation of Color Vision Deficiency"
- Sharma, Wu, Dalal (2005), CIEDE2000
