# 06 — PostgreSQL veri mimarisi, RLS, taslak DDL, migrasyon

## 1. Kesin mimari

PostgreSQL **zorunlu ve kanonik kayıt sistemi**. `localStorage`/Zustand yalnız UI seçimleri, güvenli geçici önbellek ve açıkça çevrimdışı taslak için. İşletme verisi, gerçek kullanıcı onayları, kanıt meta verisi, şablon sürümü, rapor sürümü, grant ve audit PostgreSQL'de. Dosyanın *aslı* güvenli object storage'da (örn. S3 uyumlu özel bucket); PostgreSQL'de pointer, bütünlük, izin, sınıflama ve checksum bulunur. Dış servis gizli anahtarları şifreli sır yöneticisinde, iş verisi JSON'a gömülü değildir.

## 2. Modül bazlı kanonik tablo sözlüğü

| Modül | Tablolar | Not |
|---|---|---|
| Kimlik | `identities`, `tenants`, `memberships`, `invitations`, `sessions`, `external_grants`, `consent_records` | Tek kullanıcı birden çok tenant üyesi |
| Kurum | `organizations`, `legal_entities`, `org_relations`, `facilities`, `org_units`, `assets`, `meters`, `reporting_boundaries`, `boundary_members` | Zaman bağımlı mülkiyet, rapor sınırı |
| İşi yönet | `engagements`, `deliverables`, `projects`, `reporting_cycles`, `project_participants`, `work_packages`, `tasks`, `task_dependencies`, `task_events` | Bir iş çok rapor ve dönem içerir |
| Standart | `framework_packs`, `framework_versions`, `disclosure_requirements`, `applicability_assessments`, `disclosure_assignments`, `requirement_metric_links`, `industry_packs` | Kanun, tavsiye, müşteri ihtiyacı ayrı |
| Veri | `metric_definitions`, `data_requests`, `data_request_items`, `source_imports`, `source_rows`, `observations`, `observation_versions`, `data_quality_issues` | Ham veri overwrite edilmez |
| Faktör / hesap | `factor_sets`, `factor_versions`, `calculation_runs`, `run_inputs`, `metric_facts`, `metric_fact_versions`, `consolidation_runs` | Metot ve sınır sürümü |
| Belgeler | `evidence_objects`, `evidence_links`, `evidence_access_log`, `retention_rules` | Kanıt dosyası ve ilişkiler |
| Onay | `review_requests`, `review_decisions`, `exceptions`, `audit_events` | Actor ID ve karar nesnesi |
| Rapor | `reports`, `report_sections`, `section_versions`, `metric_references`, `design_handoffs`, `release_manifests`, `release_assets`, `report_amendments` | Çıktı snapshot |
| Erişim / operasyon | `notifications`, `outbox_events`, `idempotency_keys`, `integration_connections`, `sync_runs`, `service_accounts` | Üretim güvenilirliği |

**Başlıca ilişki:** `Tenant(1:N) Project`; `Project(N:1) ReportingCycle`; `Project(N:1) Organization`; `ReportingCycle(1:N) Report`; `ReportingBoundary(1:N) BoundaryMember`; `Observation(1:N) ObservationVersion`; `CalculationRun(1:N) MetricFactVersion`; `MetricFactVersion(N:M) Evidence`; `ReportSectionVersion(N:M) MetricFactVersion`; `ExternalGrant` iki tenant arasında ve her zaman belirli projeye bağlı.

## 3. Çekirdek veri kolon standardı

Tüm tenant-scope iş tablolarında: `id uuid PK`, `owner_tenant_id uuid NOT NULL`, `created_at timestamptz`, `updated_at timestamptz`, `created_by uuid`, `row_version bigint`, `deleted_at` (yalnız gerçekten soft delete ise). Dönemli kayıtlar `valid_from/valid_to`; raporlama dilimi `period_start/end`, `reporting_year`; kapsam `boundary_version_id`; birim `unit_code` ve kaynak `method_version_id`, `factor_set_version_id`.

**Metrik defteri:** `metric_fact_versions` sayısal veya kategorik `value_num numeric(38,12)` / `value_text` / `value_json`, `period_start/end`, `metric_definition_id`, `facility_id nullable`, `legal_entity_id nullable`, `boundary_version_id`, `quality`, `status`, `source_type`, `calculation_run_id`, `revision`, `supersedes_id`; doğrulama durumları kayıtta. **`numeric` kullanımı birim/faktör/yuvarlama kuralını kaldırmaz.** JS `number` hesap motorlarının yeniden üretilebilirliği için taşınan girdiler, birim ve versiyon kilitlenmeli; finansal kuru ve para birimleri ayrı muhasebe katmanında tutulmalı.

## 4. Tenant isolation tasarımı

`owner_tenant_id` bütün müşteri verisi tablolarında zorunlu. Dış danışmanın erişim kararı ya **müşteri tenant üyeliği** ya da **proje bazlı aktif external grant** ile verilir. PostgreSQL `RLS` savunmanın bir katmanı, yetki kontrolünün tamamı değildir. **Server-only policy service + Postgres RLS birlikte** kullanılmalıdır.

Önerilen trusted request akışı:
1. API OIDC/JWT'yi doğrular; actor `user_id`'sini sunucu çıkarır; istemcinin verdiği “tenantId”ye güvenmez.
2. `acting_membership` ve hedef nesnenin `owner_tenant_id/project_id` ilişkisini okur.
3. Veritabanı transaction başlatılır; yalnız yetkili servis DB rolüyle `SET LOCAL app.user_id`, `app.acting_tenant_id` ayarlanır.
4. `SECURITY DEFINER` politika fonksiyonu **sınırlı/incelemeli**, `search_path` güvenli, RLS/role escalation testli olabilir; mümkünse basit üyelik RLS ve dış grant için kontrollü SQL view/service.
5. DB connection pool transaction bitince context'i sıfırlar (`SET LOCAL` zaten transaction scoped); oturumsuz connection context kirlenmesi test edilir.
6. File storage erişimi RLS'li kanıt meta nesnesi onayından sonra kısa süreli signed URL ile açılır.

**UYARI:** İstemci `app.user_id` set edebildiği genel SQL bağlantısı açılmamalıdır; böyle bir erişim JWT doğrulamayı bozar. RLS testinde DB table owner/BYPASSRLS rolü kullanılmaz. `FORCE ROW LEVEL SECURITY` ve düşük yetkili runtime rolü gerekir.

## 5. RLS politikasının farklı işlemlere yansıması

- `SELECT`: üye veya aktif dış grant üzerinden projeye daraltılmış erişim; kanıt sınıfı için ek filtre.
- `INSERT`: actor'ın `owner_tenant_id` içinde CREATE izni veya proje üzerinde gönderim grant'i gerekir; FK ile project.owner_tenant doğrulanır.
- `UPDATE`: satır durumu/metric lock/read version politikası; harici reviewer mutasyon yapamaz.
- `DELETE`: kanıt ve audit normal DELETE görmez, retention/imha hizmeti kontrol eder.
- `REPORT RELEASE`: sadece proje sahibi şirketin yetkili yönetim temsilcisi imzalar; danışman role bakarak kendisini release sahibi sayamaz.

## 6. Veri bütünlüğü

- Her FK'nin tenant consistency kontrolü: `project_id` başka tenant'a aitse insert başarısız.
- Sürümlü `reporting_boundary`: değişince yeni revision; eski calculation results eski boundary_id'ye bağlanır.
- `source_imports(source_file_sha256, upload_session_id, project_id)` ile duplikasyon kontrolü; aynı dosya farklı veri türünde yeniden kullanılıyorsa açık izin.
- `calculation_runs(input_digest, engine_commit, factor_version, boundary_version)` idempotent.
- `approval_decisions` onaylanan `metric_fact_version_id`/`report_section_version_id` referansları ile; geri açma eski kararı silmez.
- Sayısal saklama `NUMERIC` ve açık birim, zorunlu status CHECK, `valid_from <= valid_to` constraint, JSONB için schema validation application + PG CHECK.

## 7. Multi-tenant performans ve ölçek

İndeks standardı `(owner_tenant_id, project_id, status, updated_at DESC)`, `(owner_tenant_id, metric_definition_id, period_start, facility_id)` ve `(reporting_cycle_id, section_id)`. Büyük `observations/audit_events` için zaman veya tenant hash/period partition değerlendirilir; başlangıçta gereksiz bölümleme yapılmaz. Ciddi filtrelemeler cursor pagination; 10–100 bin ölçüm import işlemleri async job + progress ile yapılır. DBA `EXPLAIN ANALYZE`, bloat/vacuum, pg_stat_statements, indeks maliyeti izler.

## 8. Kanıt ve audit saklama

Object storage server-side encryption, private bucket, bütünlük özeti, malware scan, security classification, retention/legal hold, erişim logları. Şahsi çalışan dokümanı yerine agregat veri tercih edilir. Audit olayları transaction'la birlikte outbox'a yazılır, salt okunur ve ayrı yetkilendirilmiş hedefe replike edilir; sadece SHA-256 “değişmezlik garantisi” değildir.

## 9. Depodan geçiş (v9 Zustand / localStorage)

1. İstemci `workspace export` + kaynak hash ve snapshot. Eski veri **migrasyon gelene kadar okunabilir** kalır.
2. `ClientData` → Organization + ilk ReportingCycle; gerçek tüzel kişinin mevcut bilgilerle çıkarılamadığı durumda `UNMAPPED` geçici kayıt.
3. Mevcut `requests` → veri kampanyası / tracking; sahibinin sadece isim metni varsa `legacy-owner-label`, gerçek kullanıcı olarak otomatik doğrulanmaz.
4. Eski `approvals` → `legacy_unverified_approval` audit kaydı; kanonik onay verme yetkisi yaratmaz.
5. `importLog.sha256` var ama dosyanın kendisi olmayabilir; kanıt “dosya bekleniyor” statüsüyle taşınır.
6. `factorSets` setleri tenant-lisans politikası doğrulanarak taşınır; önceden hesaplanan çıktılar `legacy_engine_version` etiketi alır.
7. Bir kez migration → satır sayısı/value parity/checksum raporu → kullanıcı onayı → eski sürüm **read-only** → cutover → rollback aracı.

## 10. SQL taslağı

`../sql/001_core_schema_proposal.sql` yalnız çekirdek nesnelerin ilişkilerini ve temel constraints/RLS örneklerini içerir; tam migrations, grant ABAC, row-level policy, RLS-rol güvenliği, IAM ve iş tetikleyicileri ayrıca mühendislik gerektirir. Üretime doğrudan uygulanmaz.

## 11. Kabul testleri

- 2 tenant, 3 proje, 6 kullanıcıyla çapraz INSERT/SELECT/UPDATE/DELETE/redirection/filtre/signed-url veri sızıntı testi.
- 2026 dönemine sonradan tesis ekleyince 2025 dondurulmuş sonuç aynı kalır.
- Bir fact'e bağlı kanıt/dönem/faktör/metod/actor eksikse release blocker oluşur.
- Aynı import 2 kez gönderilince idempotent; paralel reviewer `row_version` çatışma sonucu alır.
- 500 bin observation veri testi RLS, pagination ve index planı ile kabul edilir (kesin performans SLA pilotta belirlenir).
