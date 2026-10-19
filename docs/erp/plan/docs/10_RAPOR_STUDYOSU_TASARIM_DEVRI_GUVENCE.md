# 10 — Rapor stüdyosu, metin düzenleme, müşteri onayı, tasarım ve güvence hazırlığı

## 1. Ürün sınırı

ISOLINE içeriği/kanıtı/metrikleri **derler ve sürümlendirir**; son baskı tasarımı ister platform şablonuyla DOCX/PDF, ister bir tasarım ajansının Adobe InDesign/Figma vb. araçlarıyla yapılır. Amaç bir rapor editörüne her şey yazmak değil; **iki ucu izlenebilir içerik zinciri** kurmak.

## 2. Rapor modelleri

`Report` (tür, dönem, framework versions, required approvals) → `ReportOutline` (bölüm şablonu) → `ReportSectionVersion` (metin, tablo, grafik, kaynaklı fact ref) → `ReviewWorkflow` → `ReleaseManifest` (nihai çıktı + sürümler). `Report` ile `ReportingCycle` ayrı: aynı dönemden Faaliyet, TSRS, GRI, yönetici özeti, CBAM operatör paketi üretilebilir.

### Standarta göre bölüm setleri

| Rapor | Tipik bölüm örnekleri | Kontrol kapısı |
|---|---|---|
| TSRS | yönetişim, strateji, risk yönetimi, ölçümler/hedefler, finans bağlantısı | ilgili TSRS gereklilik ve durum haritası |
| GRI | organizasyon, paydaş/etki önemlilik, önemli konular, ilgili topic/sector | GRI içerik indeksi ve uygunluk kontrolü |
| CSRD/ESRS | IRO, genel açıklamalar, önemli E/S/G disclosure | ilgili ülke/yıl ve ESRS sürüm doğrulaması |
| Faaliyet | şirket/genel bilgi, yönetim, faaliyet, finansal durum, risk ve diğer zorunluluklar | TTK/şirket tipi/SPK/özel sektör kontrol listesi |
| Entegre | iş modeli, strateji, sermayeler, risk, yönetişim, performans, outlook | entegre çerçeve + ek zorunlu rapor gerekliliklerine ayrı uyum |
| CBAM operatör | tesis/ürün/rota, hesap ve faktör/metot, gömülü emisyon özetleri | ilgili ürün/yıl, hukukî taraf ve veri kanıtı |

## 3. Metin editörü tasarım kararı

- **Sol:** Outline tree; her bölüm için sahibi, statü, son tarih, gereksinim sayısı.
- **Orta:** Bölüm bazlı rich text editor; mevcut sürüm/diff; üzerinde çalışılan dil.
- **Sağ:** Bağlı gerçek metric facts, disclosure requirements, kanıt notları, yorum/review ve kaynaklar.
- **Alt:** Kaydet taslak, değişiklikleri incelemeye gönder, sözlük/terimler, karşılaştırmalı önceki yıl.
- Bloklar: paragraf, heading, paragraf referansı, figure, table, metric-token, source-note, photo/alt, page-break intent, chapter metadata.
- `MetricReference` **bir fact_version'a bağlıdır**. “2026 Scope 1 {{value}} tCO₂e” metninde kaynak değişirse uyarı; rapor yazarı rakamı düz metinle sessizce değiştiremez.
- **Ortak edit:** Başlangıçta optimistic locking + bölüm kilidi/yazar sahipliği yeterli; Google Docs düzeyi gerçek zamanlı CRDT gerekiyorsa sonraki faz. Gizli grant kapsamı yorumlara da uygulanır.
- **AI taslak:** sadece yetkili kaynak, denetlenebilir öneri, metrik/faktör uyduramaz; şirket verisini üçüncü taraf modele otomatik aktarma yok.

## 4. Çıktı stratejisi

| Format | Amaç | Zorunlu özellik |
|---|---|---|
| DOCX | Raportör ve tasarım devri | başlık/hiyerarşi, tablolar, kaynak notları, bölüm sürümü |
| XLSX/CSV | Kanıta bağlı sayısal tablo | birim, dönem, kapsam, fact ID, kaynak |
| SVG/PNG | Yüksek kaliteli grafik asset'i | alt metin, ölçü/sürüm, izlenebilir metrik |
| JSON manifest | Entegrasyon ve DTP paketi | locked `release_id`, `fact_version_ids`, hashes |
| PDF proof | Prova/görsel kontrol | bölüm ve son sayfa eşlemesi, yorum/sürüm |
| iXBRL/XBRL | Sadece gereksinim/ülke/taksonomi resmi doğrulama sonrası | taxonomy, validation/test suite ve uzman kontrolü |

**InDesign devri:** `/handoff/<release-id>/content.docx`, `/tables/*.xlsx`, `/charts/*.svg`, `/images/*`, `asset-manifest.json`, `disclosure-index-draft.csv`, `review-notes.md`. **Son sayfa numarası PDF mizanpajı yapılınca** açıklama/GRI indeksine yansır; öncesi “tahmini sayfa” değildir.

## 5. Dış inceleme / güvence odası

`EvidenceRoom` yerleşimi: sol açıklama/metric listesi; orta onaylı fact; sağ kaynak/kalkülasyon/kanıt bağlantısı; üstte auditor/reviewer grant ve süresi. Kullanıcı `Question/InformationRequest` oluşturur, kurum cevap ve yeni kanıt sağlar; onaylı fact doğrudan denetçi tarafından değişmez. `AssuranceStatus` **hazırlık** aşamalarını tutabilir; resmî güvence sonuç dosyası insan/kurum tarafından eklenir ve bağımsız hizmet olarak gösterilir.

## 6. Müşteri onay akışı

Metin `TECH_REVIEW` → danışman/kaynak özeti → `CUSTOMER_REVIEW` → müşteri yönetim/finans/kurumsal iletişim yorumları → `MANAGEMENT_SIGNOFF` (yetkili gerçek kimlik) → `PRE_RELEASE`. Danışmanın proje sahibi olması yayın imzası yerine geçmez. Onayın kanıtı `approved_user_id + tenant/project context + release_digest + approved_at`.

## 7. Tasarım ajansı ve prova

- Kullanıcı `design_partner` davetiyle **yayına hazırlanmış** içerik paketini indirir; ham çalışan bilgilerini göremez.
- Tasarımcı prova PDF'si yükler, müşteri sayfa/tipografi/kapak değişikliği ister, editör `new design proof version` üretir.
- Grafik/pasta değerleri Word/CSV arasında farklıysa export kuralı hata verir. Kaynak etiketinin son sayfa numarası DTP sonrası güncellenir.
- Uzun rapor için her bölümde `content_reviewed`, `numerical_checked`, `design_approved`, `accessible_checked` dört bağımsız durum olabilir.
- DTP'nin font/lisans görselleri, telif ve şirket marka kılavuzu yükleme akışı ayrıca yönetilir.

## 8. Yayın ve revizyon

`ReleaseManifest`: `reportId`, `version`, `period`, `scopeVersion`, `frameworkVersionIds`, `metricSnapshotDigest`, `sectionVersionIds`, `evidenceManifestDigest`, `managementSignoff`, `outputAssets`, `publicationUrl`, `publishedAt`, `amendmentOf`. Her yayın kararında `stale-reference` ve açık blocker kontrolü yapılır. İlan edilmiş rapor düzeltilecekse eski sürüm değişmez, **amended release** üretilir.

## 9. Kabul senaryoları

- 10 rapor bölümü birbirinden farklı kişilere atanır, onaylı bir `MetricFactVersion` iki raporda kullanılır.
- Kaynak faktör değişince ilgili tablo ve metinde **stale** görünür; otomatik yayımlanmaz.
- Sadece tasarım için davet edilmiş harici kullanıcı kanıt kasasının çalışan verisi bölümüne erişemez.
- Onaylı DOCX sayısı ile bağlı fact/CSV/SVG aynı değerde; locale TR ve EN sayı biçimi doğru.
- Yöneticinin yayım yetkisi ve onayı olmadan `release` mümkün değil; sonradan değişiklik yeni sürüm.
