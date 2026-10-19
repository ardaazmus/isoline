# 08 — Sektörel raporlama paketleri, kanıt türleri ve hesaplama uyarlamaları

## 1. Sektör tasarım ilkesi

Ayrı sektörler için kopya web uygulamaları yerine `IndustryPack` veri modülü. Ortak hesaplama motoru/kanıt/raporlama tabanı değişmez. Sektörler şu alanlara **deklaratif** veri sağlar: `applicability_rules`, `metric_definitions`, `questionnaire`, `collection_frequency`, `activity_units`, `factor_requirements`, `validation`, `disclosure_links`, `narrative_guidance`, `report_template_blocks`.

Sektör **faaliyet bazında ve karma** olabilir; bir holding hem çimento hem lojistik hem enerji üretimi yapabilir. `Organization.primaryIndustry` tek başına yeterli değil; `ActivityClassification(legalEntity/facility/process, NACE/SICS/product code, period)` gerekiyor. **GRI resmî sektör standardı** yalnız ilgili yayımlanmış sektör için doğrudan uygulanır; diğer sektör paketleri ISOLINE'ın metodolojik veri toplama şablonlarıdır, “resmî GRI sektör standardı” diye satılmaz.

## 2. Paket matrisi — 19 sektör/operasyon alanı

| Kodu | Sektör | Kaynak veri granülerliği | Önemli gösterge/hesap | Kalite kapısı / tipik kanıt |
|---|---|---|---|---|
| IND-01 | Demir-çelik | Tesis × fırın/proses × ürün × ay | Yakıt/proses Scope 1, elektrik Scope 2, üretim ton başına emisyon, CBAM rota | Üretim ve enerji sayaçları, hurda/öncül, proses stoğu, KN/ürün tutarlılığı |
| IND-02 | Çimento/klinker/kireç | Tesis × fırın × klinker × ay | Kalsinasyon CO₂, yakıt/elektrik, klinker/çimento oranı, CBAM | Klinker, CaCO₃/faktör yöntemi, laboratuvar ve üretim fişi |
| IND-03 | Alüminyum | Eritme/döküm/yeni/geri dönüştürülmüş | Proses, enerji, ürün karbon, CBAM kapsam | Birincil/ikincil üretim ayrımı, ürün/öncül bilgisi |
| IND-04 | Kimya/gübre/hidrojen | Proses ve hammadde yolu | Besleme gazları, N₂O, amonyak/ürün, su, atık, CBAM ürünleri | Stok dengesi ve kimyasal proses katsayıları |
| IND-05 | Enerji elektrik/ısı | Santral × yakıt × sayaç × zaman | Enerji üretim, yakıt, şebeke, yenilenebilir, sera gazı | Brüt/net üretim, enerji sertifikası ve çift sayım kontrolü |
| IND-06 | Petrol-gaz/akaryakıt | Kuyu/istasyon/rafineri | Metan, flare/venting, yakıt, sızıntı | Ölçüm-tahmin metodu, etki konuları (GRI 11) |
| IND-07 | Kömür | Maden/saha/çıktı | Metan, iş güvenliği, rehabilitasyon | GRI 12, üretim/metan/saha tutarlılığı |
| IND-08 | Madencilik | Ruhsat/saha/atık barajı | Su, atık/tailings, arazi, biyoçeşitlilik, İSG | GRI 14, saha olay/atık envanteri |
| IND-09 | Tarım, gıda, su ürünleri | Çiftlik/ürün/tedarikçi | Arazi yönetimi, CH₄/N₂O, su/atık, izlenebilirlik | GRI 13; stok/alan/ton/yıl uyum, tarımsal metot |
| IND-10 | Tekstil, hazır giyim, ayakkabı | Üretim/tier supplier | Su, boya/kimyasal, enerji, çalışan, Scope 3 | Tedarikçi anketleri, kaynak türü, ürün süreç sınırı |
| IND-11 | İnşaat/altyapı | Proje × şantiye × iş kalemi | Beton/çelik gömülü karbon, yakıt, atık, su, İSG | BOM, EPD kapsamı, hakediş/metraj, operasyonel vs embodied |
| IND-12 | Gayrimenkul/tesis yönetimi | Bina/m²/kiracı/sayaç | Enerji yoğunluğu, su, F-gaz, renovasyon | Ortak alan–kiracı tüketim tahsisi, boş bina dönemi |
| IND-13 | Ulaştırma/lojistik | Rota × araç × ton-km/kişi-km | Yakıt, taşımacılık emisyonu, filo değişimi | Ton-km / km / yükleme faktörü, tekrar kayıt |
| IND-14 | Bankacılık | Portföy / varlık sınıfı | Finanse edilen emisyon, kredi/portföy riski | PCAF veri kalitesi, borç bakiyesi, double count açıklaması |
| IND-15 | Sigorta/sermaye piyasaları | Portföy / ürün / müşteri | Yatırım-finansman emisyonu, iklim finansal risk | İlgili PCAF/ISSB sektör rehberi, risk denetimi |
| IND-16 | Perakende/hizmet/turizm | Mağaza/otel/şube | Enerji, F-gaz, seyahat, su, işgücü, satın alma | Çok lokasyonlu tahsis, mükerrer fatura |
| IND-17 | Sağlık/ilaç | Hastane/tesis/soğuk zincir | Elektrik, tıbbi atık, soğutucu, su, çalışan | Özel atık sınıflandırma, hassas bireysel veri minimizasyonu |
| IND-18 | Teknoloji/telekom/veri merkezi | DC/IT yük/tesis | PUE*, elektrik, Scope 3 satın alma, hava soğutma | PUE tanım ve payda, abonelik/kira kapsamı |
| IND-19 | Kamu/belediye/su idaresi | Hizmet bölgesi/tesis | Enerji, arıtma, su çekimi/kayıp, atık, kamu performansı | Kamu faaliyet/rapor rejimi özel; özel şirket TTK'sı kopyalanmaz |

`*` **PUE** verisi yalnız uygun veri merkezi için opsiyonel endüstri göstergesidir, tüm BT şirketlerine zorunlu değil.

## 3. Her sektör kartının teknik tanımı

```
IndustryPack:
  id, version, official_sector_standard_refs[], standard_status
  classification_codes[NACE/SICS/etc], applicable_jurisdictions
  components:
    conditional_metrics[], disclosure_candidates[], data_request_templates[]
    evidence_policy[], validation_rules[], materiality_topics[]
    default_chart_templates[], report_narrative_prompts[]
  license, source_version, last_verified_at, reviewer
```

**Kritik kural:** Endüstri paketi `mandatory` alanını **yalnız gerçek standart/mevzuat koşulu sağlanıyorsa** doldurur; uzman önerisi `recommended` etiketi taşımalıdır. `example_data` rapora aktarılmadan önce “DEMO” filigranı.

## 4. Sektöre özel veri toplama mikroakışları

### 4.1 Demir-çelik (CBAM bağlantılı örnek)

1. Ürün kategorisini ve KN/kapsam değerlendirmesini seç → 2. üretim tesisi ve proses sınırını bağla → 3. üretim tonajını/öncüllerini, enerji ve proses girdisini aylık al → 4. faktör ve yöntem seç → 5. veri kaynağını ve tedarikçiyi doğrula → 6. karbon metriğini yeniden üretilebilir hesap çalıştırmasıyla üret → 7. kalite ve operatör kontrolü → 8. AB ithalatçısına **operatör veri paketi** teslim et.

**Kontroller:** üretim tonu = tesis tonajıyla uzlaşma; SKDM kapsamlı ürün/KN kodu kontrolü; proses/sistem sınırı ve aynı enerji girdisinin iki kez sayılmaması; varsayılan veri ile gerçek verinin işaretlenmesi; onaylı ürün rota sürümü.

### 4.2 Tekstil/gıda — tedarik zinciri yoğun örnek

Tedarikçiyi tanımla → veri talebi sürümü ve veri kullanım amacı → tedarikçi dar portal linki → kWh/su/kumaş veya hammadde miktarı → kanıt uygunluğu → emisyon faktörü güvenilirlik sırası (gerçek birincil veri / sektör ortalaması / harcama tabanlı tahmin) → kapsam 3 veri kalitesi → önemli fark değerlendirmesi. Ham tedarikçi fiyat/sözleşme gerekmedikçe saklanmaz.

### 4.3 Banka — finansman emisyonları

Portföy varlık sınıfı ve hesap yöntemi (PCAF uygun sürümü) → müşteri varlık veri kapsamı → doğru atıf oranı ve bilgi kalitesi → hesap/çift sayım kontrolü → sektör/risk raporu → açıklamada belirsizlik. Genel Scope 3 satın alma formülü otomatik “finanse edilen emisyon” yerine geçmez. Kaynak/standard lisansı ayrı yönetilir.

### 4.4 Tesis su/atıksu

Kaynak türü (şebeke, yeraltı, yüzey vb.) → çekim/ tüketim/ deşarj/geri kazanım ayrımı → su stresi/lokasyon → sayaç/dönem → kaynak/tesis uzlaştırma → GRI/ESRS ilişkili açıklama → yanlış “su tüketimi = su çekimi” dönüşümü engelle.

### 4.5 İnşaat ve gayrimenkul

`project/site` hiyerarşisi ayrı önemli: üretim tesisi olmayan geçici şantiye dönemli kaydedilmeli; malzeme EPD veya uygun ürün emisyon faktörü, m³ beton/ton çelik; operasyonel Scope 1/2 ile gömülü karbon ayrı rapor akışlarında; stok/tedarikçi belgeyle izlenmeli.

## 5. Modül faz öncelikleri

**P1 ortak:** üretim/hizmet sektörü için Scope 1/2, enerji-su-atık, çalışan ve finans. **P2 pilot sektör:** demir-çelik/çimento + lojistik/tekstil (gerçek ilk müşteri ihtiyacına göre kesinleştir). **P3:** proses detayları, ürün/tedarikçi portalı, inşaat/finansman karbonu. **P4:** tam LCA/EPD, çok özel sektör veri setleri; bunlarda lisanslı araç ve akredite süreç partner entegrasyonunu öncelikle değerlendir.

## 6. Doğruluk ve veri kaynağı dereceleri

- **RESMÎ STANDART:** GRI Sector Program yalnız GRI 11/12/13/14 için (2026). https://www.globalreporting.org/standards/sector-program/ ; IFRS SASB 77 sektör rehberi https://www.ifrs.org/issued-standards/sasb-standards/ ; IFRS/SASB birden fazla endüstriye uygunluk https://www.ifrs.org/issued-standards/sasb-standards/understanding-sasb-standards/ .
- **SEKTÖREL HESAPLAMA REHBERİ:** GHG Protocol Scope 3 ve 15 kategori: https://ghgprotocol.org/corporate-value-chain-scope-3-standard ; kurumsal/proje sınır ayrımı https://ghgprotocol.org/standards-guidance .
- **ÜRÜN TASARIM ÖNERİSİ:** Sektör kartlarının kullanıcı deneyimi, varsayılan form sırası ve kalite kontrolleri ISOLINE tarafından geliştirilir; hukuken zorunlu diye etiketlenmez.

## 7. Sektörel paket QA zorunlulukları

- Aynı metrik sektör değişti diye sessizce farklı birime çevrilmez.
- Holding faaliyetleri iki sektöre düşüyorsa proje tek sektör seçimine zorlanmaz.
- GRI finansal hizmetler veya tekstil sektör standardı için paket durumu `under_development`, resmî yayımlanmış gibi değil.
- Ürün karbon/LCA'da şirket toplam emisyonu ürüne bölüp tek başına ISO 14067 uyumlu sonuç verilmez.
- Sektör şablonuna özel veri kanıtı okunabilir, eksikse gerekçeli tahmin, yanlışsa ret; gizli veriye sektöre özel kısıt.
- CBAM etiketli paket yalnız hukuken ilgili ürünler ve dönemlerde aktif; diğerleri `not_applicable`.
