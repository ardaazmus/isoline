# 11 — Aydınlık UI/UX sistemi, anlamlı animasyon ve izometrik görselleştirme

## 1. Tasarım tezi

Bu ürün karmaşık ve yoğun görev içeriğini **açık, sakin, mimari sadelikle** sunmalı. Göz alıcı hareket ile içeriğin güvenilirliği arasında fark var: animasyon bilgi taşır; sürekli kıpırdayan dashboard **yanıltıcı ve yorucudur**. Koyu mod **tasarlanmayacak**. Rozet, puan, konfeti, karakter, “oyun” mekanikleri **kullanılmayacak**. Görsel güzellik süreç tamamlığını, veri kaynağını ve hiyerarşiyi açıklayan hafif 2D/2.5D/izometrik diyagramlarla elde edilecek.

## 2. Design tokens (başlangıç)

| Token | Değer | Rol |
|---|---|---|
| Canvas | `#F5F6F3` | sıcak açık arka plan |
| Surface | `#FFFFFF` | form, tablo, kart |
| Text | `#1D2B34` | ana tipografi |
| Secondary | `#677782` | destek metin |
| Border | `#DFE6E8` | ince ayrım |
| Accent blue | `#245C78` | eylem / bilgi |
| Teal | `#237C78` | çevre/akış görselleştirme |
| Attention | `#A87025` | yorum gerektiren |
| Error | `#B94A44` | blocker / yetki |
| Motion time | `160–320 ms` | mikro etkileşim |
| Scene transition | `350–550 ms` | izometrik yer değişimi |
| Corner radius | `8–12 px` | kurumsal, kontrollü |

Durumlar yalnız renkle değil **etiket ve ikon/metinle** belirtilir; düşük kontrast yüzünden sorun çıkarsa renkler erişilebilirlik testinde revize edilir. Mevcut Impeccable tasarım sistemi varsa tokenlara uyumlu adaptasyon yapılır.

## 3. Görsel dil kuralları

- Aydınlık ofis/mimari kâğıt etkisi, 1px net sınırlar, ölçülü boşluk; cam/blur aşırılığı ve dekoratif parıltılar yok.
- Font skalası: sayfa 24–30 px, bölüm 18–20, body 14–16, tablo 13–14. Veri sayılarında tabular numerals.
- İkonlar: Lucide/outline, tek stil; anlamlı alan/standart sınıfı dışında ekranı ikonlarla doldurma.
- Grafikler: yoğun veride tablo alternatifli bar/line/heatmap; enerji/karbon akışında *birim tutarlı* Sankey; standard mapping **ilişki çizgisi**, miktar akışı değildir.
- Grafiğin her başlığında **metrik, dönem, tesis/sınır, birim, kaynak/sürüm**.

## 4. İzometrik modüller: yalnız gerçek iş avantajı

| UI yüzeyi | İzometrik/animasyon | Doğru semantik | Fallback |
|---|---|---|---|
| Holding hiyerarşisi | 2.5D tesis/işletme haritası; hafif bağlantı çizgisi | Tesisin veri toplama/inceleme durumu; gerçekte fiziki çevre başarısı değil | Tree/table + filtre |
| Kanıt katmanları | Veri+metot+kanıt+onay plakalarının sıralı birleşimi | Gerçek reviewer kararı gelmediyse son katman onaylı olmaz | Erişilebilir kontrol listesi |
| Veri soyağacı | Kaynak → hesap → fact → rapor bağlantı animasyonu | Fact_id ve kaynakla doğrulanır; hover only değil focus da | Açılır detay panelleri |
| Enerji/emisyon akışı | Düşük yoğunlukta 2.5D Sankey | Ton, kWh gibi uyumlu ölçü birimleri korunur | Veri tablosu/CSV |
| Report Studio | Bölüm kartları ve sade belge önizleme | Bölüm durumları, eski sürüm riskleri | Başlık ağacı |
| Senaryo | Slider ile hesaplama önizlemesi | “simülasyon, yayımlanmış sonuç değildir” etiketi | Sayısal input ve yeniden hesaplama |

**Sahte çevresel etki yasak:** fatura yüklenince bina “yeşillenip karbon azaltıldı” mesajı vermez. Veri ilerlemesi ayrı, performans sonucu ayrı görselleşir. Denetçi “onay mührü” değil **harici sorgu/bulgu** kaydeder.

## 5. Mikroetkileşim listesi

1. Veri kaydedildi: alandaki birim etiketinin ve özet değerin `150 ms` yumuşak güncellemesi; ekran titremesi yok.
2. Form tamamlandı: tablo satırı `draft→submitted` konumuna taşınır; hareket tamamlanınca kullanıcıya metinsel durum.
3. Kanıt yüklendi: dosya iconu ve “tarama sürüyor / kabul edildi / reddedildi” durum sırası; başarılı dosyayı onaylı belgeyle karıştırma.
4. Review: kabul/ret sonrası `diff card` üzerinde karar ve actor görülür; göz yormayan kenar geçişi.
5. Hesap: eski/yeni sonuç farkı yumuşak sayı geçişi, unit/precision sabit; animasyon bitince statik değer.
6. Tesis: seçili node 2D/3D haritada `focus`, diğerleri soluklaşabilir; aktif node ve açıklama ekran okuyucuda.
7. Rapor: bölüm açıldığında ilgili metrik/görselin veri kartına ince çizgi; “stale” durumunda uyarı aktif kalır.
8. Büyük import: gerçek progress + satır kabul/ret; sahte time progress bar yok.

## 6. UX akışlarından örnek

### Danışman ekranı

Giriş → Portföy → “Bu hafta teslimi yaklaşan raporlar” → şirket X → proje 2026 → “4 tesis verisi bekleniyor” → kampanya → toplu reminder / belirli görev → müşteri katkıcısına geri dönüş. Hesap motoru tam sayfa navigasyon olarak burada gereksiz yere açılmaz.

### Katkıcı ekranı

Giriş → “3 görevin var” → “Ağustos elektrik tüketimi” → tesis/ay/kWh sabit → fatura/ölçüm → sistem kontrolü → gönder → inceleme statüsü. Katkıcının önüne 20 modüllü uzman menüsü açılmaz.

### Yönetim ekranı

Bildirim → `Release Approval` → “Onaylanacak rapor, rapor dönemi, kritik açıklama listesi, finansal göstergelerin kaynağı” → review notu/özet → onay ya da gerekçeli geri gönder. Yönetim ekranına 3D model varsayılan değil.

## 7. Erişilebilirlik / performans kontratı

- `prefers-reduced-motion`, animasyonsuz menü/scene; klavye aktivasyonu, ARIA status, chart data table.
- WebGL/3D sahne düşük cihazda ve aşırı kompleks holding ağacında **2D SVG/fallback** ile çalışır.
- Başlangıç rotaları 3D bundle yüklemez; sahne kullanıcı ekranına gelirse dinamik load edilir.
- Rive/Lottie/React Three Fiber gibi eklentiler **ancak ihtiyaç doğrulandığında** eklenir; production ekranlarında “görünüş için ağır canvas” yok.
- Ekran kontrastı WCAG 2.2 AA ve TR/EN responsive testinden geçer; modaller odak tuzağı ve toast sesli durumunu destekler.

## 8. React bileşen kataloğu

`AppShell`, `ContextSwitcher`, `RoleNav`, `PageHeader`, `StatusLabel`, `MetricCard`, `ActionQueue`, `DataRequestCard`, `EvidenceDropzone`, `DiffReview`, `AuditTimeline`, `BoundarySelector`, `SiteTree`, `SiteIsometricView`, `LineageExplorer`, `FlowSankey`, `ReconciliationTable`, `ReportOutline`, `MetricReferencePill`, `ReportPreview`, `ReleaseChecklist`, `InviteGrantDialog`, `EmptyState`, `ErrorState`, `ProtectedAction`.

**Her component:** props/data contract, permission visibility, empty/loading/error, keyboard, reduced motion, RTL ihtimali, ekran boyutu, unit test/story/visual regression.

## 9. İhtiyatlı sunum önceliği

P0: Auth/onboarding/tenant, ana formlar ve tablo. P1: task/review/lineage grafik. P2: hiyerarşik isometrik ve 2.5D Sankey. P3: bölüm kitabı/what-if çevre simülasyonları. **Animasyon teslimatın kabul kapısı değil, ölçülebilir kullanılabilirlik kalitesinin parçasıdır.**
