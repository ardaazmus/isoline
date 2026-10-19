# 02 — Danışmanlık, raporlama ve hizmet işletim modeli

## 1. Hizmet platformu ve aktörler

Bu platformda satılan asıl değer tekil hesaplayıcı değil; **müşterinin bir raporlama işini koordine etmek, kanıtlı veriye dönüştürmek, çıktıyı hazırlamak ve onaylatmak**. Kullanıcılar `service_provider` (danışmanlık/rapor yazarı), `reporting_company` (müşteri), `assurance_provider` (bağımsız hizmet), `design_partner` ve `data_provider` (tedarikçi) ilişkileriyle temsil edilir. Aynı gerçek kurum hem kendi projesini yürütüp hem ayrı bir başka kurumun danışmanı olabilir; “tenant type” kalıcı tek rol değildir.

### Danışmanlık hizmet grupları

| Hizmet paketi | Tipik kapsam | Temel teslimatlar | Veri ihtiyacı |
|---|---|---|---|
| Kurumsal ESG mevcut durum/boşluk | Mevzuat ve uygulama tarama, iş planı | Gap matrisi, sorumluluk ve iyileştirme planı | Politika, yönetim, operasyon |
| TSRS/ISSB raporlama | İklim ve diğer finansal önemli sürdürülebilirlik riskleri/fırsatlar | TSRS raporu, risk matrisi, iklim finans bağlantısı | Finans, risk, enerji/emisyon, strateji |
| GRI sürdürülebilirlik raporu | Etki önemlilik, kurumun toplumsal/çevresel etkileri | GRI açıklama haritası, veri tabloları, sürdürülebilirlik raporu | Paydaş, insan, çevre, yönetişim |
| ESRS/CSRD | AB sınırı, çift önemlilik, IRO, ilgili veri noktaları | ESRS sustainability statement içerik paketi | Grup/ değer zinciri, mali etki ve yönetim |
| Faaliyet raporu | TTK/SPK/özel düzenleyici koşullar | Yönetim/faaliyet/finans anlatısı, yönetim onayı | Finansal tablolar, yönetişim, faaliyet |
| Entegre rapor | İş modeli, değer yaratma, finans/ESG bağlantıları | Entegre rapor metni + görseller | Strateji, finans, sermayeler, ESG |
| Kurumsal karbon envanteri | Scope 1, 2, 3 ve baz yıl | Envanter, yöntem, faktör/kanıt dizini | Yakıt, sayaç, lojistik, satın alma |
| Su/atık/enerji performansı | Tesis veri toplama, hesap, politika | Gösterge seti, kaynak haritası, trend | Saha ve tedarikçi verisi |
| CBAM/ETS | Mevzuata bağlı ürün/tesis ve maliyet projeksiyonu | Operatör veri paketi, izleme kaydı, projeksiyon | Ürün, üretim, gaz ve menşe |
| SBTi/dekarbonizasyon | Senaryo ve yatırım yol haritası | Baz yıl, hedef ve önlem portföyü | Temel envanter, CapEx, öngörü |
| CDP/EcoVadis/anket | Kurum dışı talep yanıtları | Versiyonlu yanıt dosyası + kanıt | Mevcut veri ve politika |
| Tedarikçi ESG | Soru/anket ve veri toplama | Supplier request, risk görüşü, kanıt | Tedarikçi kaynakları |
| Ürün karbon/LCA/EPD desteği | Ürün sistem sınırı ve envanter | Veri paketi/hesap taslağı; sertifika değil | BOM, enerji, malzeme, proses |

**Gerçek hizmet sinyalleri:** Escarus resmî hizmet listesi strateji, çift önemlilik, iklim riski, karbon/su ayak izi, TSRS/entegre raporlama ve CDP/EcoVadis gibi hizmetleri ayırır: https://escarus.com/hizmetler/ . CASEM hizmetleri GRI, TSRS, CSRD, SPK, karbon/su/LCA, CBAM, ürün karbon ve ayrı yazılım başlıklarını açıkça listeler: https://www.casem.com.tr/ . Bu sayfalar **iş kapsamı göstergesidir**, şirketlerin kapalı iç süreçlerine dair iddia üretmeyin.

## 2. Sözleşmeden teslimata “engagement” yaşam döngüsü

```text
LEAD/DISCOVERY (opsiyonel CRM)
  → SCOPE_PROPOSED → CONTRACTED → KICKOFF
  → EXECUTION → CLIENT_REVIEW → SIGNOFF
  → DELIVERY → ARCHIVED
            ↘ CHANGE_REQUEST → REPLANNED
            ↘ ON_HOLD / TERMINATED
```

**Sözleşme/proje ile raporu ayırın:** 1 danışmanlık sözleşmesi 2026 TSRS + Faaliyet + CDP anketi ve 2027 izleme hizmetini kapsayabilir. Bu yüzden `Engagement` altında 1..n `Deliverable`; her deliverable ilişkili `ReportingCycle` ve `FrameworkPackVersion` ile bağlı. Danışmanlık proje takip ekranı teslim tarihlerini/metrikleri gösterir, gerçek CRM fatura/ödeme sistemi MVP şartı değildir.

## 3. İş grubu / çalışma paketi şablonu

| Adım | Danışman sorumluluğu | Müşteri sorumluluğu | Beklenen karar |
|---|---|---|---|
| Scope & kickoff | Mevzuat analizi, projenin deliverable ağacı | Kurum sınırı, işletme/tesis listesi | Kapsam onayı |
| Önceki rapor / baseline | Geçmiş yıl analizi, tespit | Eski rapor/finansal tablo | Baz yıl ve düzeltme onayı |
| Önemlilik (gerekli olduğunda) | Metodoloji, paydaş/ IRO süreci | Yönetim ve paydaş verisi | Gerekçeli önemli konu seti |
| Veri kampanyası | Form, açıklama ve son tarih | Birimlere sahip atama | Data owner atanmış iş |
| Teknik hesap | Faktör/method seçimi ve hesap | Ham veri, tedarikçi bilgi teyidi | Teknik kalite onayı |
| Tutarlılık ve konsolidasyon | İstisna raporu | Finans/yöneticiler | Close kararı |
| Yazım ve grafik | Editoryal metin/sunum grafiği | Sorumlu birim yorumları | Bölüm onayı |
| Yönetim gözden geçirme | Son kontrol paketi | Yönetim kurulunun/şirket yetkilisinin imzası | Yayın izni |
| Güvence hazırlığı | Kanıt manifestosu ve talepler | Yetkili dış güvenceyi koordine | Görüş ayrı kayıt |
| Tasarım/devre | Kaynaklı Word, tablo, grafikleri paketle | Sayfa kontrolü, son prova | Yayın manifestosu |

## 4. Proje türü sihirbazı (pratik)

`Projeye Başla` → `Şirketi seç/oluştur` → `Kim yürütüyor? Şirket içi / danışman` → `Hizmet paketleri seç` → `Rapor yılı, ülke, şirket tipi` → `Standart uygunluk ön değerlendirmesi` → `Birimler ve tesis sınırı` → `Data owner / reviewer / lead` → `Plan ve şablon` → `Başlat`.

Her adım tek ekran/az alan; gerekli olmayan finansal konsolidasyon veya çift önemlilik formu **herkese açılmaz**. Önce kapsam kararı, sonra veri soruları.

## 5. Birden fazla danışman ilişkisi

- Şirket raporu **kendisi** oluşturup “Raporumu gözden geçir” diyerek danışman firmayı davet eder; aynı belgeyi kopyalamak yerine yorum/bulgu süreci yürür.
- Bir hazırlayan danışman ve ayrı kalite danışmanı için eşzamanlı iki grant olabilir; ancak rol ve dosya kapsamı çakışması açıkça yönetilir.
- Danışman müşteri adına başlattığında **provisional customer workspace** açılır; gerçek müşteri temsilcisine claim-invite gönderilir. Claim tamamlanmadan hassas veri yükleme/sınırsız paylaşım politika gereği bloklanabilir.
- Danışman değişiminde `EngagementAccess` iptal edilir; müşteri veri/mühürlü release/kanıt sahipliği korunur. Eski danışmanın kendi operasyonel notları, sözleşme hukukuna göre ayrı saklanır; müşteri veri kopyası yeni erişim izni olmaksızın taşınmaz.

## 6. Ticari paketlemeye dönüşüm (mimari hazırlık)

Fiyat kararı ürün geliştirme bağımlılığı değildir ancak `Subscription`, `Entitlement`, `SeatLimit`, `ProjectLimit`, `UsageMeter` için esnek yer tasarlanmalıdır. Değişik müşteri tipleri için “Danışmanlık Portföyü”, “Şirket Raporlama”, “Holding” ve “Dış İnceleme” paketleri düşünülebilir. Fiyat ve kullanıcı sayısı bu belgede uydurulmaz. **Müşterinin verisini dışarı aktarabilmesi ve grant iptali ticari paketle engellenmemelidir.**
