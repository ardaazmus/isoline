# 13 — Ayrıntılı, kapılı geliştirme yol haritası, backlog ve kabul ölçütleri

**Yürütme yaklaşımı:** Tek kerede yeniden yazım değil, mevcut hesaplama/rapor araçlarının etrafında kimlikli PostgreSQL işletim katmanı. Fazlar **takvim garantisi değil kapı ve bağımlılık bazlıdır**; sprint sayısı ekip kapasitesi ve repo test koşullarına göre sprint planında tahmin edilir. Geliştirme yeni ekrana geçmeden önce ilgili domain sözleşmesi, veri migration, yetki ve test tamamlanır.

## 0. Geliştirme yönetim sözleşmesi

Her Epic tamamlanmak için `ADR/architecture`, `DB schema migration`, `API input validation`, `auth/RLS policy`, `UI empty/loading/error/success`, `TR/EN messages`, `unit+integration+E2E`, `accessibility`, `audit`, `data export`, `rollback` içermeli. Teslimatı “kod yazıldı, ekran açıldı” ile sınırlamayın.

| Faz | Hedef | Ön koşul | Çıkış kapısı |
|---|---|---|---|
| **G0** | Repo ve alan analizi, karar kayıtları | GitHub main ve mevcut testler | 2 uçtan uca journey imzalı, backlog sabit |
| **G1** | Auth / Tenant / PostgreSQL / ilk migration | G0 | 2 tenant için RLS/BOLA testleri geçer |
| **G2** | Kurum ağacı / proje / dönem / kapsam | G1 | Şirket ve danışman 2 başlangıç yolu çalışır |
| **G3** | Veri kampanyaları / kanıt / katkıcı portalı | G2 | Gerçek kullanıcı görev gönderir, karşı taraf onaylar |
| **G4** | Hesap motorları server contract / faktör / veri kalite | G3 | Kaynak→hesap→metric lineage, parity |
| **G5** | Konsolidasyon / kontroller / dönem kapanışı | G4 | Kritikleri sıfırlamadan publish imkânsız |
| **G6** | Report Studio / müşteri onayı / design handoff / release | G5 | DOCX+CSV+SVG+kanıt sürümlü paket |
| **G7** | Sektör 1–3 + dış inceleme + portföy | G6 | 2 gerçek sektör/2 müşteri pilot senaryosu |
| **G8** | Derin entegrasyon, erişilebilir animasyon ve ölçek | G7 | UAT, güvenlik ve performans kabul raporu |

## G0 — Analiz, karar ve envanter (EPIC 00)

| ID | Görev | Veri/Ekran | Kabul |
|---|---|---|---|
| G0-01 | Kod envanteri ve feature parity | `src/lib/calc`, `requests`, `approval`, `reconcile`, `docx` | Her mevcut özellik + test dosyası, `keep/refactor/retire` kararı |
| G0-02 | Ürün konteyner sözleşmesi | Tenant/Organization/Engagement/Cycle | 2 aktör yolculuğu mimarisi onaylı |
| G0-03 | Standart/rule registry tasarımı | FrameworkPackVersion | Resmî/gönüllü/öneri koşullu kural ayrımı |
| G0-04 | Hedef ekran haritası ve layout prototipi | AUTH/ORG/PORT/DATA/CTRL/REP | Ekran sahibi, role, empty/error durumları |
| G0-05 | Veri göçü risk kaydı | `ClientData v9` örnekleri | Müşteri/proje/yıl/owner belirsizlikleri etiketli |
| G0-06 | Örnek UAT senaryoları | Danışman-first, company-first | 2 referans demo iş akışı; sample etiketi |
| G0-07 | Security threat model | RLS/grant/storage/export | Cross-tenant, revoked access, impersonation test planı |

## G1 — Identity, Tenant, PostgreSQL (EPIC 10)

| ID | Görev | Bağımlılık | Kabul |
|---|---|---|---|
| G1-01 | PostgreSQL schema, migrations, seed | G0-02 | Fresh DB ve migrate/rollback test |
| G1-02 | Real auth OIDC+sessions | G1-01 | Verified actor; refresh/revoke/MFA policy |
| G1-03 | Tenant membership/role | G1-02 | Tek kişi 2 tenant seçebilir; API scope korur |
| G1-04 | Tenant RLS + trusted transaction context | G1-01/03 | 403/404 çapraz tenant, SQL bypass negatif test |
| G1-05 | Company vs advisory onboarding routes | G1-03 | Her iki işletim modeli kendi workspace'ini açar |
| G1-06 | Invitation acceptance/revocation | G1-02/03 | Süre, tek kullanımlık token ve revoked link |
| G1-07 | ExternalProjectGrant / consent | G1-03/04 | Kurum yalnız proje ve kapsam grant'ini açar |
| G1-08 | Organization ownership claim | G1-05 | Provisional müşteri gerçek yetkiliye devredilir |
| G1-09 | Secure object storage foundation | G1-04 | Signed URL/scan/hash/private bucket |
| G1-10 | Audit + outbox foundation | G1-01/04 | Kritik kayıtla audit aynı transaction |
| G1-11 | v9 workspace import migration | G1-01/05 | Legacy identity varsayımı yok; parity report |
| G1-12 | Security settings/member management UI | G1-05/06 | Devre dışı üyenin API erişimi sona erer |

**G1 kapısı:** Auth/tenant/proje grant; 2 tenant/3 rol izolasyon testleri; kanıt nesnesi storage güvenliği; fail-closed audit.

## G2 — Şirket, organizasyon, proje, dönem (EPIC 20)

| ID | Görev | UI | Kabul |
|---|---|---|---|
| G2-01 | Organization/LegalEntity/Facility | ORG-07..09 | Holding/iki iştirak/üç tesis kurulabilir |
| G2-02 | OwnershipEdge time validity | ORG-08 | yıl içinde mülkiyet değişikliği izlenir |
| G2-03 | ReportingBoundary ve boundary members | ORG-10 | operasyonel/equity/finans/CBAM ayrılır |
| G2-04 | Engagement/Deliverables | PORT-04..05 | Tek sözleşme, çok rapor/teslimat |
| G2-05 | Project + ReportingCycle | PORT-07..10 | 2025 ve 2026 iki dönem, çakışmaz |
| G2-06 | Applicability policy version & expert decision | PORT-10..11 | kaynak/tarih/uyum gerekçesi görünür |
| G2-07 | Team/RACI, invitations and grants | PORT-12 | herkesin görevi ve izni açık |
| G2-08 | Project plan/dependency/calendar | PORT-09 | kritik görevler zaman çizelgesinde |
| G2-09 | Company/agency portföy ana ekranı | PORT-01/08 | sadece yetkili projeler görüntülenir |

**G2 kapısı:** Müşteri başlatır → danışmana proje erişimi verir → proje/dönem/sınır belirler. Danışman başlatır → müşteri sahipliği devralır. İki yol aynı veri omurgasına bağlanır.

## G3 — DataOps, görev kampanyası, kanıt (EPIC 30)

| ID | Görev | UI | Kabul |
|---|---|---|---|
| G3-01 | Versioned DataPoint/MetricDefinition katalog | DATA-01 | tanım, birim, toplama türü, source |
| G3-02 | Campaign generator by framework/sector | DATA-02/03 | aynı kalem farklı rapora bağlı, tek talep olabilir |
| G3-03 | Real assignee/reviewer and task status | DATA-04/05 | kişi+tesis+dönem yetki ve onay ayrımı |
| G3-04 | Self-service contributor journey | DATA-05 | 4 adımdan veri+kanıt+gönderim |
| G3-05 | XLSX/CSV import preview/mapping | DATA-07/08 | yanlış birim/kolon satır bazlı yakalanır |
| G3-06 | EvidenceObject and links | DATA-10 | asıl dosya, hash, scan, yetki, retention |
| G3-07 | Observation revisions | DATA-09 | eski satır korunur, yeni sürüm |
| G3-08 | Reminder/notification service | notifications | T−7/T−2/T+1 özelleştirilebilir ve idempotent |
| G3-09 | Comments/rework and bulk task operations | DATA-03/05 | ret gerekçesi ve tekrar gönderim görünür |
| G3-10 | Supplier portal skeleton (opsiyonel) | supplier routes | başka müşteri veri sızıntısı yok |

**G3 kapısı:** 8 görev, 3 kullanıcı, 2 tesis, 2 veri türü, 1 iade/yeniden gönderme ve 1 kaynak belge açılabilir.

## G4 — Hesap ve kalite katmanı (EPIC 40)

| ID | Görev | Modül | Kabul |
|---|---|---|---|
| G4-01 | Versioned factor registry + license | factor manager | rapor dönemi için doğru faktör seçilir |
| G4-02 | `CalculationContext` wrapper | existing `src/lib/calc` | input digest, boundary, engine SHA |
| G4-03 | GHG Scope1/2/3 multi-facility | greenhouse | location/market ayrımı, site ids |
| G4-04 | Environment and workforce data wrappers | environment/workforce | source/evidence/period/fact linkage |
| G4-05 | Finance/trial balance integration | mizan | reconciliation anchor ve year |
| G4-06 | CBAM/ETS calculators binding | cbam/ets | tesis/ürün/ülke rule version |
| G4-07 | Validations/anomaly/error policy | quality | blocker vs warning, reason and reviewer |
| G4-08 | MetricFactVersion + lineage explorer | DATA-20 | kanıttan rapor referansına iz |
| G4-09 | Property-based & parity tests | calc tests | eski v1 bilinen test vakaları eşdeğer |

**G4 kapısı:** 1 emisyon metriği ve 1 finans metriği tüm girdileriyle yeniden hesaplanabilir; exact factor version ve kaynak kontrolü.

## G5 — Konsolidasyon ve kapanış (EPIC 50)

| ID | Görev | UI | Kabul |
|---|---|---|---|
| G5-01 | GHG consolidation rule sets | CTRL-08 | op control/equity ayrı, tarihli |
| G5-02 | Financial consolidation inputs + eliminations | CTRL-08 | IFRS/TFRS mantığı GHG kodundan ayrı |
| G5-03 | Existing U1..U10 rule integration | CTRL-05 | açıklama ve blocker politikası doğru |
| G5-04 | Reviewed quality issue resolution | CTRL-04 | audit ve ayrı reviewer |
| G5-05 | Identity-bound reviewer queue | CTRL-06/07 | own work approval denied |
| G5-06 | Snapshot and reopen/restate version | CTRL-09 | yeni fact eski yayına etkisiz |
| G5-07 | Close checklist and blockers | CTRL-09 | yayın engellerinin nedeni görünür |

**G5 kapısı:** 2 bağlı ortaklık + 2 tesis / 2 dönemli konsolidasyon; testte closed snapshot değişmez.

## G6 — Rapor / yayın (EPIC 60)

| ID | Görev | UI | Kabul |
|---|---|---|---|
| G6-01 | Report types + section outlines | REP-01..03 | TSRS/GRI/Faaliyet şablonları ayrık |
| G6-02 | Document editor and metric tokens | REP-04 | source/version fact ref |
| G6-03 | Standard applicability and disclosure coverage | CTRL-03 | requirement met/pending/partial ayrımı |
| G6-04 | Charts with data tables/export parity | REP-05 | same source CSV/SVG/DOCX |
| G6-05 | Technical/client/management approvals | REP-06 | gerçek yetki ve row version |
| G6-06 | Word/Excel/assets packages | REP-08 | trace manifest + locale + source |
| G6-07 | Design partner and proof roundtrip | REP-09/10 | harici ajans yalnız release asset'leri |
| G6-08 | Release freeze / amendment | REP-11/12 | final imza ve previous version digest |
| G6-09 | Cross-report reconciliation | REP-07 | aynı fact farklı raporda bağlam kontrollü |

**G6 kapısı:** Bir şirket veri yükler, 2 rapor üretir, dış danışman metin önerir, yönetim onaylar, DOCX/grafik/asset manifest paket çıkar, sonradan kaynak değişiminde eski yayın sabit.

## G7 — Danışmanlık ölçeği, sektör ve dış inceleme (EPIC 70)

| ID | Görev | UI | Kabul |
|---|---|---|---|
| G7-01 | Multi-client portfolio | PORT-01 | 20 müşteri/iş için deadline, blocked, review panosu |
| G7-02 | External expert/consultancy invitation | ORG-11, PORT-12 | şirket grant scope + süre + iptal |
| G7-03 | Assurance/read-only room | CTRL-10/11 | soru/kanıt, veri değişmez |
| G7-04 | Industry pack framework | industry pack manager | çoğul faaliyet sınıfları, versioned |
| G7-05 | Pilot metal/cement pack | domain pack 1 | proses/ürün/CBAM veri kalemleri |
| G7-06 | Pilot services/logistics pack | domain pack 2 | çok şube/rota/yakıt ve metot |
| G7-07 | Textile/agri supplier pack (ihtiyaca göre) | domain pack 3 | vendor data quality ve scope3 |
| G7-08 | Consultancy operational KPIs | portfolio | acceptance, lateness, evidence rate, no fake ESG grade |
| G7-09 | Internal vs external review separation | workflow | data/customer/assurance farklı yetki |

**G7 kapısı:** danışman 2 ayrı müşteri yönetir, biri raporu kendi başlatmış, diğerini danışman başlatmış; grant iptali rapora müdahale etmez.

## G8 — Ölçek, entegre kaynaklar, grafik/3D (EPIC 80)

| ID | Görev | Kriter |
|---|---|---|
| G8-01 | Controlled ERP/HRIS connectors | idempotency, tenant-scope, failure queue |
| G8-02 | Supplier questionnaire portal | external least privilege, source revisions |
| G8-03 | Versioned regulation packs updater | official source change audit, tests |
| G8-04 | Light isometric site hierarchy | source-backed status, table fallback |
| G8-05 | Flow Sankey + lineage motion | quantities conserved, reduced-motion |
| G8-06 | Reporting narrative AI assist (optional) | source-grounded suggestion only, tenant data privacy |
| G8-07 | Stress/perf/accessibility | verified WCAG2.2 AA and load/latency |
| G8-08 | Security review, penetration test, restore drill | no cross-tenant leak, backup tested |

## 1. En yüksek değerli bağımlılık zinciri

`G1 PostgreSQL/auth/RLS` → `G2 company/proj/cycle/boundary` → `G3 task+evidence` → `G4 calc result and lineage` → `G5 review+close` → `G6 report+release`. **Bunun dışında grafikleri erken tasarlamak serbest, ancak üretim iş akışını atlayıp tamamlandı demek yasak.**

## 2. İlk geliştirme backlog sıralaması (ilk 20 iş)

1. Repo test baseline+source map. 2. ADR tenant owner vs consultancy grant. 3. Postgres schema/migration/roles. 4. Session auth/MFA. 5. Tenant membership/selector. 6. RLS / BOLA tests. 7. Company onboarding. 8. Agency onboarding. 9. Invitation and grant. 10. Provisional customer claim. 11. Organization/legal-entity/facility. 12. Project/period/report-kind. 13. ReportingBoundary. 14. Standard applicability pack. 15. First data catalog. 16. Data request generation. 17. Contributor UI. 18. Evidence object storage. 19. Approval identity. 20. Source import parity.

**Her iş için issue:** `User story, Business rule, Role permissions, DB migration, API contract, UI states, Evidence/Source, Automated tests, Definition of Done, Regression Risk` (şablon: `../templates/ISSUE_SABLONU.md`).

## 3. Zaman, ekip ve bütçe yaklaşımı

Bu paket bir teknik plan, kesin iş gücü tahmini değil. Sprint planı G0'da kod envanteri ve mevcut otomatik testler koşulduktan sonra yapılır. Temel roller: 1 ürün/alan uzmanı, 1 teknik lider, 2–3 fullstack/DB mühendisi, 1 QA otomasyonu, paylaşımlı UI/UX, dış danışman mevzuat/finans kontrolü. Daha küçük ekiple yürür ama bağımlılık sırası ve kabul kapıları kaldırılmaz. İlk pilot, özel müşteri verisi olmadan örnek setle yürütülür; gerçek müşteri pilotundan önce güvenlik, saklama, sözleşme ve veri aktarım kararı tamamlanır.

## 4. Release / kalite kapıları

- **Alpha:** iki başlangıç akışı ve gerçek PostgreSQL kayıt, tenant isolation, örnek müşteri.
- **Private beta:** müşteri verisi/kanıt yüklenebilen gerçek kullanıcı süreci, müşteri onayı, 1 rapor taslağı.
- **Pilot:** en az 2 müşteri, 2 rapor türü, 2 farklı sektör; restore/revoke/revision testleri ve uzman mevzuat review.
- **General availability:** güvenlik incelemesi, SLA/on-call, backup restore, hesap doğrulama suite, dokümante veri sahipliği/çıktı sözleşmesi, support runbooks ve ihtiyaç halinde fiyatlandırma.

## 5. Bilinçli sonraya bırakılanlar

- Multi-tenant mikroservis ayrıştırma; gerçek kapasite gerektirmedikçe.
- Derin iXBRL tagging; taksonomi/kanuni kullanım netleşmeden.
- Tüm sektörlere aynı anda gelişmiş ürün karbon ve LCA.
- 3D animasyon engine kurma; ölçümlenmiş UX gereği oluşmadan.
- Otomatik hukukî uygunluk/denetim/akreditasyon iddiaları — her zaman kapsam dışı.
