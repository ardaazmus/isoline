# 12 — Teknik mimari, API, entegrasyon, güvenlik, işletim

## 1. Tavsiye: Modüler monolit + PostgreSQL

**Frontend:** mevcut Next.js (App Router) / React / TypeScript; light-only bileşen sistemi. **Backend:** aynı repo içinde ayrı API/application-domain katmanları, güvenilir session auth, background worker. **DB:** PostgreSQL 16+ (öneri, kullanılan sürüm release yaşam döngüsüne göre seçilir) + migration/ORM (Prisma veya Drizzle değerlendirme). **Files:** private S3-uyumlu object storage, server-side scan/hash. **Queues:** transactional outbox + worker (Postgres job veya güvenilir queue). **Export:** Word/Excel/SVG/PDF proof ve JSON asset manifestosu. **Deploy:** yönetilen veritabanı, merkezi logs/metrics, secret manager, immutable backup.

İlk baştan 12 mikroservis kurma. `domain` modüllerini açık boundary ile ayır: Identity, Organizations, Engagements, Frameworks, Tasks, Data, Factors/Calculations, Quality, Reviews, Reports, Releases, Integrations. Erişim kararı API middleware + resource handler + DB RLS kombinasyonudur.

## 2. Ana API taslakları (REST örneği)

| İşlev | Route | Yetki/koruma |
|---|---|---|
| Kimlik ve üyelik | `GET /api/v1/me`, `/memberships`, `POST /invites` | auth + tenant membership |
| Kurum | `GET/POST /tenants/:tid/organizations`, `/entities`, `/facilities` | org admin/member scoped |
| Grant | `POST /projects/:pid/grants`, `PATCH /grants/:id/revoke` | customer data owner admin |
| Proje | `POST /projects`, `GET /projects/:pid`, `/cycles` | acting tenant + owner tenant scope |
| Kapsam | `POST /cycles/:cid/applicability/assess` | source-version + reviewer |
| Veri talebi | `POST /projects/:pid/data-requests`, `POST /requests/:id/submit` | assignee + CSRF/idempotency |
| Veri import | `POST /imports/init`, `/preview`, `/commit` | signed upload, scan, mapping |
| Gözlem | `GET/POST /observations`, `POST /observations/:id/revisions` | project/metric/site ABAC |
| Hesap | `POST /calculation-runs`, `GET /calculation-runs/:id` | inputDigest, engine/factor version |
| Review | `POST /reviews/:id/decisions` | different actor, expectedRowVersion |
| Konsolidasyon | `POST /cycles/:cid/consolidations` | boundary version + read only after close |
| Rapor | `POST /reports`, `PUT /reports/:id/sections/:sid` | section owner + optimistic concurrency |
| Yayımla | `POST /reports/:id/releases` | management signer + release hash + blockers=0 |
| Denetim | `GET /evidence/:id`, `POST /assurance/:id/questions` | scoped, time-limited grant |

**Mutasyon standardı:** `Idempotency-Key`, `If-Match: <rowVersion>`, request schema validation, actor from validated token, RBAC/ABAC, audit/outbox in same transaction. Ürün ve sistem loglarında müşteri kanıt dosyasının içeriği tutulmaz.

## 3. Auth ve gizlilik

- Gerçek kimlik doğrulama; OIDC/SSO seçeneği, MFA, oturum iptal, şifre sıfırla, risk-temelli tekrar auth.
- Tenant ve proje kapsamında API erişimi; istemci gizli role dokümanını alamaz; object storage list erişimi yok.
- Harici grant kurum yöneticisinin onayı, amaç ve süre; revocation token cache invalidation.
- Dış paylaşım linki **kayıtlı davet kabulü** veya açıkça public artifact sınıflaması ile; “uzun yaşayan bearer token” hassas belge için kullanılmaz.
- Kişisel veriler için veri minimizasyonu/erişim/retention ve saklama lokasyonu. Şirketler KVKK/GDPR rollerini sözleşmeye göre doğrular.

## 4. OWASP tehdit senaryoları

1. **BOLA/IDOR:** user A başka tenant `task_id`, `file_id`, `report_id` ile GET/PUT/DELETE yapar → 403/404.
2. **Object property authorization:** yetkisiz kullanıcı `owner_tenant_id`, `approved_by`, `status=published` alanını PATCH ile değiştirir → reddet.
3. **Broken function-level authorization:** contributor `/release` endpoint'ini çağırır → 403.
4. **Upload:** zararlı içerik, zip bomb, MIME sahtekârlığı, dosya yolu, 1 GB yükleme → scanning/limit.
5. **SSRF:** dosya URL importu whitelisting/egress kısıtlı.
6. **CSRF/XSS:** upload metadata, narrative rich text, HTML/script, DOM sanitization.
7. **Service account:** tenant-scoped token, rotate, IP/capability, rate limits.
8. **Race condition:** eşzamanlı onay ve iptal → transaction/row version.
9. **Privilege mismatch:** project owner = invoice tenant owner sanma; tüm yetkiler gerçek membership/grant ile.
10. **Audit tamlığı:** kritik işlem failed event görünür, hash chain tek başına değişmezlik güvencesi olarak sunulmaz.

Kaynak: [OWASP API Security Top 10](https://devguide.owasp.org/en/07-training-education/07-api-top-ten/), [OWASP REST Assessment](https://cheatsheetseries.owasp.org/cheatsheets/REST_Assessment_Cheat_Sheet.html).

## 5. Entegrasyon sözleşmeleri

**V1:** CSV/XLSX/ODS import/export + mizan + Word + object storage. **V2:** müşteri API, e-posta hatırlatma, HRIS ve ERP bağlantıları (SAP, Logo, Mikro vb. gerçek müşterinin teknolojisine göre; pazarlama iddiası değil). **V3:** enerji sayaçları, tedarikçi portali, endüstri veri sistemleri, tasarım devri. `connector` her koşuda `connector_id, resource, cursor, source_tenant, scope, pulled_at, checksum, errors, rows`, yeniden deneme ve hangi verinin üretim raporuna etkisi olduğunu kaydeder.

**Tek yönlü değil:** Müşteri kaynak ERP'sinde fatura revize edilince ISOLINE `SourceRowVersion` üretir, yayımlanmış raporu sessizce değiştirmez. Bir kaynağın lisansı izin vermiyorsa faktörün harici kullanıcılara yeniden dağıtımı engellenir.

## 6. Deployment ve tenant izolasyonu

- Development/staging/production çevreleri ayrı tenant namespace, seeding için demo veri açıkça etiketli.
- RLS runtime rolü en az yetkili; migration rolü ayrı ve üretim sorgularında kullanılmaz.
- CI: typecheck, lint, unit, property tests, RLS/BOLA test, DB migration dry run, export parity, Playwright E2E, bundle/perf.
- Her sürüm için `schema migration backward/forward` desteği ve rollback stratejisi. Çalışan kaynak motoru sürümü `engine_commit` olarak hesap kaydına girer.
- Backup/PITR, restore tatbikatı, malware scan, object storage lifecycle, retention ve legal hold. Müşteri veri silme politikası ile audit saklama yükümlülükleri dengelenir.

## 7. Ortam değişkenleri ve konfigürasyon

`DATABASE_URL`, `READ_REPLICA_URL(optional)`, `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OBJECT_STORAGE_*`, `EMAIL_PROVIDER_*`, `LOG_ENDPOINT`, `APP_BASE_URL`, `DATA_REGION`, `KEY_MANAGEMENT_REF`. Hiçbiri source code veya demo `ClientData` içine hardcoded yazılmaz. Tenant bazlı encryption key/namespace ihtiyacı düzenleyici/pazarlama seçimine göre planlanabilir.

## 8. Observability / incident yönetimi

`request_id`, `trace_id`, `actor_id`, `acting_tenant_id`, `owner_tenant_id`, `project_id`, `release_id`, `calc_run_id`; yüksek hacimli ölçü değerlerini veya kişisel içeriği loglama. Metrikler: auth reject, cross-tenant deny, import failure, queue lag, API latency, database locks, release blocking issues, audit write failures, storage scan backlog. Audit yazma başarısızsa kritik onay/yayın işlemi **fail-closed**.

## 9. Performans ve UI

Ağır 3D sahneler lazy-load; UI asıl modülleri sade server list/table ve client forms. Grafikler ilk yüzde 100 etkili olmalı ama 60 FPS oyun motoru hedefi ürün güvenilirliğinden önemli değil. Milyon gözlem / 20 tenant / 200 eşzamanlı kullanıcı senaryosu kapasite testiyle ölçülür; tahmini SLA uydurma.
