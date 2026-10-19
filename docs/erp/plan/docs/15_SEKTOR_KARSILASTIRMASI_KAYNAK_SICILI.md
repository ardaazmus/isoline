# 15 — Sektörel saha gerçekliği, ürün benchmark ve araştırma kaynak sicili

**Araştırma dondurma tarihi:** 19 Ekim 2026. Bu dosyadaki firma/ürün özellikleri **firmaların kamuya açık kendi sayfalarından alınan beyanlardır**; müşterilerindeki bağımsız performans veya kapalı iş akışı denetimi değildir. Her atıf bağlam, hangi tasarım kararını desteklediği ve kaynak güven düzeyiyle verilmiştir.

## 1. Hizmet şirketlerinden ürün gereksinimi türetme

### 1.1 Escarus: raporlama, yönetim ve strateji bir projede

[Escarus hizmetleri](https://escarus.com/hizmetler/) resmî sayfasında **stratejik sürdürülebilirlik** (strateji, paydaş/çift önemlilik, gap analizi, iklim riski, tedarik zinciri), **operasyonel** (enerji/kaynak verimliliği, karbon/su ayak izi, yaşam döngüsü), **araştırma/raporlama** (sürdürülebilirlik, TSRS, entegre rapor, sosyal etki), **endeks/değerlendirme** (CDP/EcoVadis, BIST) ailelerini ayırır. [Yönetim sistemleri sayfası](https://escarus.com/surdurulebilirlik-yonetim-sistemleri/) kurum özelinde ESG çevresel ve sosyal yönetim altyapısının politika, eğitim, veri, raporlamayı birleştirdiğini belirtir. [Seçilmiş projeler](https://escarus.com/secilmis-projelerimiz/) sayfası gerçek raporlama projelerinin farklı hizmetleri bir araya getirebildiğini gösterir.

**ISOLINE sonucu:** tek “2026 raporu oluştur” kutusu yeterli değildir. `Engagement → deliverables`, proje içinde **gap + strategy + calculations + reporting + index** ayrı iş paketleridir. Yönetim sistemi ve prosedür dokümanları veri kanıtıyla ilişkilidir. Kapsamı ilgili sözleşme belirler. Hizmet sağlayıcının uygulamada nasıl çalıştığına dair doğrulanmamış iç süreç varsayılmaz.

### 1.2 CASEM: rapor/hesap/danışmanlık/yazılım ayrımı

[CASEM ana resmî sitesi](https://www.casem.com.tr/) GRI, TSRS, CSRD, TCFD, entegre rapor, SPK raporu; karbon, ürün karbon, su, CBAM, LCA; CDP, EcoVadis, SBTi; tedarik zinciri, biyoçeşitlilik, enerji; ayrıca sürdürülebilirlik, su, karbon ve CBAM yazılımları şeklinde kategoriler sunar. **Bu, CASEM yazılımının iç veritabanı veya kullanıcı hakları modeli hakkında kanıt değildir.**

**ISOLINE sonucu:** ürünün projesi her firmaya aynı “ESG rapor doldur” sayfası değil; modüler **engagement service catalogue**, sektörel veri talep şablonu, uzman hesap araçları, faaliyet raporu ve harici paylaşım/yayım. Tam LCA/EPD sertifikası veya dış değerlendirme puanı **resmî yöntem/yetki olmadan** sistem tarafından otomatik düzenlenmez.

### 1.3 Kullanıcıya sunduğumuz üç birleşik iş modeli

| Giriş yolu | Kurumun veri sahipliği | Danışmanın yetkisi | Raporun son onayı |
|---|---|---|---|
| Danışman firma başlatır | İlk önce provisional; şirket claim eder | Kapsamlı ama proje ve süre limitli | Şirket yetkilisi |
| Şirket kendi yürütür | Başından company tenant'ı | İstenirse hiç danışman yok | Şirket yetkilisi |
| Şirket hazır işi dış danışmana inceletir | Şirket tenant'ı | İlgili rapor/dönem/konu için review grant | Şirket yetkilisi; resmî güvence ayrıdır |

## 2. Olgun yazılım benchmark'ı — pazarlama iddiasını ürün kararıyla ayırma

| Platform | Üreticinin ilan ettiği gerçek ürün alanı | ISOLINE için alınacak tasarım ilkesi | Kopyalanmaması gereken varsayım | Kaynak |
|---|---|---|---|---|
| **Workiva** | Bağlı sayısal ve anlatı içerikleri, raporlar arası veri akışı, iş birliği/filing | Metric-to-text/figure reference, release sürümü | İsimden otomatik tam iXBRL uygunluğu çıkarma | [Workiva SEC reporting](https://www.workiva.com/solutions/sec-reporting) |
| **IBM Envizi** | Çoklu hiyerarşi, veri normalizasyonu, kaynak izi, kalite, dosya/API/web form | `ReportingBoundary` ve `Observation` için ilk sınıf varlıklar | Dünyadaki tüm ESG faktörlerinin lisanssız paylaşılabileceği | [Envizi ESG Data Management](https://www.ibm.com/products/envizi/esg-data-management) |
| **IBM Envizi Reporting** | Standart soru kütüphanesi, tekrarlanan yanıtları yeniden kullanma, çoklu ekip workflow | `FrameworkVersion→Requirement→Fact/Narrative` modeli | “1000+ soru”yu telif ve sürüm incelemeden copy-paste | [Envizi ESG Reporting](https://www.ibm.com/products/envizi/esg-reporting-frameworks) |
| **Novisto** | Intake workflows, belge ve API, rol, review/approval, quality gates | Data Campaign → Review Queue → audit log | Müşteri başarı yüzdesi iddiası | [Novisto collect](https://novisto.com/product/collect), [use cases](https://novisto.com/solutions/use-cases) |
| **Watershed** | Dosya/API kaynak alımı, karbon hesap, detaylı faktör, supplier engagement, audit trail | Source lineage + supplier request + carbon factor policy | Üretici kaynaklı “her footprint audit geçti” satış beyanını objektif ölçüm sayma | [Watershed Measure](https://watershed.com/platform/measure/carbon-accounting) |
| **Sweep** | Carbon, ESG disclosure, tedarik zinciri portali, audit/assurance hazırlığı | Kurum tesis tedarikçi arasında tek data spine | Gelişmiş ürün/finansman karbonu bütün sektörlerde hazır varsayma | [Sweep platform](https://www.sweep.net/en-us/platform), [carbon management](https://www.sweep.net/carbon-management) |
| **Sphera** | EHS/ESG, validasyon, multi-site veri toplama, ERP entegrasyonu, review/approval | Çoklu tesis endüstriyel veri operasyonu | Her ülkede bütün hukuki beyanları yapar varsayma | [Sphera Corporate Sustainability](https://sphera.com/solutions/environment-health-safety-sustainability/corporate-sustainability-software/management-and-reporting-software) |
| **Persefoni** | GHG, Scope 3, assurance hazırlığı, anomali tespiti, hedef modelleri | Carbon ledger + quality + factor transparency | Aynı karbon engine'i finansal rapor konsolidasyonu yerine geçer sanma | [Persefoni](https://www.persefoni.com/) |

### 2.1 Benchmark'ın gösterdiği minimum ürün eşiği

Dünyadaki olgun ESG yazılımlarının ilan ettiği ortak bileşenler: (1) dağınık dosyaları birleştirme; (2) hiyerarşi ve birim normalizasyonu; (3) sorumlu atama ve otomatik talep; (4) veri kalitesi/validasyon; (5) kanıt ve source lineage; (6) standart karşılığı açıklama soruları; (7) rapor metni/sayı/grafik bağlantısı; (8) dış gözden geçirme hazırlığı. **Tek başına hesap makineleri güçlü olduğu için bütün kurumsal operasyonları yönetmeye yetmez.** ISOLINE'ın rekabetçi nişi bu ortakları Türkiye-first TSRS/faaliyet/CBAM/ETS ile **iyi ve basit birleştirmek**tir; “rakiplerde bunlar yok” gibi kanıtsız bir üstünlük iddiası kullanılmaz.

### 2.2 Gerçek dünyada veri toplama neden zor?

- Çok kaynak: faturalar ERP'de, eğitim/İSG ayrı departmanda, enerji sayaçları tesiste, tedarikçi verisi üçüncü tarafta.
- Çok bağlam: Aynı enerji verisi bir şirkete, bir tesise, bir aya ve bir rapor/konsolidasyon sınırına ait.
- Çok metodoloji: Toplam gaz envanteri, ürün gömülü karbonu ve finansal konsolide gösterge farklı kurallar kullanır.
- Çok yetki: Danışman veri hazırlayabilir, müşteri kontrol eder, bağımsız güvence **ayrı** kuruluştur.
- Çok çıktı: TSRS ile GRI raporu aynı veri ailesini kullansa bile önemlilik ve açıklama şartları farklıdır.
- Çok sürüm: Mevzuat, faktör, şirket yapısı ve yayımlanan rapor yıllar içinde değişir.

**Bu yüzden önce data/identity/workflow, sonra canlı 3D.** Animasyon gerçek sorunu çözmüyorsa iş yükü ekler.

## 3. Standart ve mevzuat kaynak sicili

Kaynak düzeyleri: **P1 = resmî düzenleyici/standart kurumu**, **P2 = üreticinin kendi işlev açıklaması**, **D = ISOLINE tasarım kararı**. Linkler 19.10.2026'da kamuya açık araştırmada kontrol edilmiş olup kaynaklar değişebilir.

| Kod | Referans ve geçerli bilgi | Seviye | İlişkili karar |
|---|---|---|---|
| SRC-01 | [KGK TSRS portalı](https://kgk.gov.tr/surdurulebilirlik-standartlari) | P1 | Türkiye raporlama çerçevesi |
| SRC-02 | [KGK 16.01.2026 eşik kararı](https://www.kgk.gov.tr/Portalv2Uploads/files/Duyurular/v2/Diger/EsikDegerlerinYenidenBelirlenmesineIliskinKurulKarari.pdf), aktif 1 milyar TL, net satış 2 milyar TL, 500 çalışan, dönem başlangıcı 01.01.2025+ | P1 | Scope assessment sürümü |
| SRC-03 | [IFRS/ISSB introduction](https://www.ifrs.org/sustainability/knowledge-hub/introduction-to-issb-and-ifrs-sustainability-disclosure-standards/) | P1 | S1/S2, finansal önemlilik/dört başlık |
| SRC-04 | [IFRS SASB](https://www.ifrs.org/issued-standards/sasb-standards/) ve [industry usage](https://www.ifrs.org/issued-standards/sasb-standards/understanding-sasb-standards/) | P1 | 77 sektör, çoklu faaliyet uygunluğu |
| SRC-05 | [GRI Sector Program](https://www.globalreporting.org/standards/sector-program/) | P1 | GRI 11/12/13/14; diğerleri yayımlanmış değil |
| SRC-06 | [GRI standards development](https://www.globalreporting.org/standards/standards-development/) | P1 | GRI 101/102/103 yürürlük yılları |
| SRC-07 | [GHG Protocol standards](https://ghgprotocol.org/standards-guidance) | P1 | Kurumsal envanter, Scope 2 ve Scope 3 |
| SRC-08 | [GHG Scope3 and 15 categories](https://ghgprotocol.org/corporate-value-chain-scope-3-standard) | P1 | Tedarikçi veri/kalite |
| SRC-09 | [ISO 14064-1:2018](https://www.iso.org/standard/66453.html) | P1 | Kurum GHG yöntemi |
| SRC-10 | [ISO 14067:2018](https://www.iso.org/standard/71206.html) | P1 | Ürün karbonu farklı hesap sınırı |
| SRC-11 | [AB Direktif 2026/470](https://eur-lex.europa.eu/legal-content/en/TXT/?uri=CELEX:32026L0470) | P1 | CSRD scope/threshold, ülke/geçiş yılı |
| SRC-12 | [AB Delegated 2026/1563](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32026R1563), yayımlanma 21.09.2026, yürürlük 10.11.2026, genel uygulama 2027+ | P1 | ESRS standard version ve future-effective |
| SRC-13 | [AB Delegated 2026/1560](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32026R1560) | P1 | Gönüllü sürdürülebilirlik standardı sürümü |
| SRC-14 | [CBAM 2025/2083](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex:32025R2083) ve [consolidated 2023/956](https://eur-lex.europa.eu/eli/reg/2023/956/2025-10-20/eng) | P1 | 2026 kesin rejim, 50t kapsamlı muafiyet, ürün/ithalatçı |
| SRC-15 | [Ticaret Bakanlığı Yıllık Faaliyet Raporu Yönetmeliği dizini](https://www.ticaret.gov.tr/ic-ticaret/mevzuat/sirketler-ve-ticaret-sicili) | P1 | Faaliyet raporu türleri |
| SRC-16 | [KGK 2026 denetim standartları](https://www.kgk.gov.tr/DynamicContentDetail/12046/TDS-2026-Seti) | P1 | GDS 3000/3410 ve güvence ayrımı |
| SRC-17 | [KGK SGDS 5000 taslak duyuru](https://www.kgk.gov.tr/ContentAssignmentDetail/5112/Su%CC%88rdu%CC%88ru%CC%88lebilirlik-Gu%CC%88vence-Denetimi-Standard%C4%B1-%28SGDS%29-5000-Su%CC%88rdu%CC%88ru%CC%88lebilirlik-Gu%CC%88vence-Denetimlerine-I%CC%87lis%CC%A7kin-Genel-Hu%CC%88ku%CC%88mler-Taslak-Metni-Kamuoyu-Go%CC%88ru%CC%88s%CC%A7u%CC%88ne-Ac%CC%A7%C4%B1lm%C4%B1s%CC%A7t%C4%B1r-) | P1 (taslak) | `draft`, nihai standart otomatik çıkarılmaz |
| SRC-18 | [IFRS integrated reporting framework](https://www.ifrs.org/issued-standards/integrated-reporting/framework/) | P1 | Altı sermaye, içerik ve metin-metrik bağlantısı |
| SRC-19 | [SBTi corporate net-zero](https://sciencebasedtargets.org/corporate-net-zero) | P1 | version-dependent target planning, sertifika değil |
| SRC-20 | [OWASP API Security Top10](https://devguide.owasp.org/en/07-training-education/07-api-top-ten/) | P1 | RLS/BOLA/IDOR/ABAC negatif test |
| SRC-21 | [Escarus resmî hizmetler](https://escarus.com/hizmetler/) | P2 | danışmanlık iş katalogu |
| SRC-22 | [CASEM resmî ana sayfa](https://www.casem.com.tr/) | P2 | danışmanlık, hesaplama, raporlama ve software hizmet ayrımı |
| SRC-23 | [IBM Envizi data](https://www.ibm.com/products/envizi/esg-data-management) | P2 | hiyerarşi, normalize, audit |
| SRC-24 | [IBM Envizi frameworks](https://www.ibm.com/products/envizi/esg-reporting-frameworks) | P2 | disclosure catalogue ve workflow |
| SRC-25 | [Novisto collect](https://novisto.com/product/collect) | P2 | intake, review, approvals |
| SRC-26 | [Watershed measure](https://watershed.com/platform/measure/carbon-accounting) | P2 | emissions lineage ve data collection |
| SRC-27 | [Sweep platform](https://www.sweep.net/en-us/platform) | P2 | supplier + audit + disclosure |
| SRC-28 | [Sphera corporate sustainability](https://sphera.com/solutions/environment-health-safety-sustainability/corporate-sustainability-software/management-and-reporting-software) | P2 | multi-site EHS + review |
| SRC-29 | [Persefoni platform](https://www.persefoni.com/) | P2 | karbon muhasebesi/assurance preparation |
| SRC-30 | [Workiva SEC reporting](https://www.workiva.com/solutions/sec-reporting) | P2 | finans/rapor bağlantısı |

## 4. Ürün içerik yönetiminde kaynak doğrulama akışı

`NewSource` → `retrieve official` → `effective date/coverage` → `legal/regulatory reviewer` → `unit/edge cases` → `test fixtures` → `publish framework version` → `impact analysis` → `retire old version`. Resmî PDF/standart tekstini kaynak/metadatadan öte kopyalarken kullanım hakkı kontrol edilir. Regülasyon linki değişse bile kaydın version/hash/read date izi korunur; “en son” otomatik geriye dönük güncelleme değildir.

## 5. Kaynak değiştiğinde otomatik yapmaması gerekenler

1. Eski raporun mecburi açıklama setini düzenleme; sadece etkilenmiş projelere kontrollü update öner.
2. Hukuki scope kararı “üzgünüm şartlar değişti, tüm müşteriler ihlal” olarak bildirme; kimin etkilendiğini expert-review listesine al.
3. GRI/ISSB/ESRS disclosure eşlemelerini `identical` sayma; bazen yalnız kısmen örtüşür.
4. Carbon Scope 3, ürün LCA veya finansman karbonunu tek genel yoğunluk formülüne indirgeme.
5. Sertifika, GRI onayı, SBTi validasyonu, bağımsız güvence görüşünü simüle etme.

## 6. Araştırma ve ürün kararının ayrımı

Bu belgenin **doğrudan doğrulanmış** kısmı kaynaklardan görülen standartların kategorileri, firmaların ilan ettiği hizmet alanları ve üreticilerin kendi ürün tanımlarıdır. `Proje tipleri`, `Tenant grant`, `Ekran envanteri`, `PostgreSQL şeması`, `UAT` ve geliştirme sırası **ISOLINE için uzman ürün tasarım önerisidir**; kaynak sitelerin var olan entegrasyon/iş modeli olarak sunulmaz.

## 7. Açık doğrulama listesinin geliştiriciye devri

- KGK TSRS 2026 kapsam kararı: şirket türü, ardışık dönem, özel muafiyet ve referans yıl şartları uzman/kurul açıklamasıyla kural testi olarak kesinleştirilir.
- AB CSRD ülke bazlı aktarım ve eşik/başlangıç yıl senaryoları, varsa Türkiye grubunun AB iştiraki düzeyinde doğrulanır.
- ESRS 2026/1563 future-effective ve varsa 2026 erken seçim koşulları `as-of` ile çalışır.
- SGDS 5000 nihai Türkiye yayımlanma/statü durumu KGK resmî mevzuat portalında kontrol edilmeden `in_force` yapılamaz.
- CBAM ürün, KN, süreç sınırı ve 2026+ yıllık düzenlemeleri doğrudan konsolide AB tüzük + uygulama kararlarıyla test edilmelidir.
- GRI/SASB/EFRAG/TFRS/ISO metinlerinin lisansla ticari yazılım içine gömülmesine dair yeniden dağıtım hakları ayrıca araştırılmalı.
