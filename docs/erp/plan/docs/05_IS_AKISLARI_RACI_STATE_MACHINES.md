# 05 — İş akışları, durum makineleri, kontrol kapıları ve RACI

## 1. Çalışan gerçek proje: 13 kapı

| Kapı | Sorumlu (R) / nihai karar (A) | Ön koşul | Çıktı | İstisna |
|---|---|---|---|---|
| G0 Müşteri/iş devralma | Proje lideri / müşteri sahibi | Tenant/grant | Engagement + kapsam dokümanı | Dış erişim onay bekler |
| G1 Organizasyon kur | Müşteri admin / şirket sahibi | Tüzel kişi/tesis | Zamanlı organizasyon ve kullanıcı ağacı | Sahiplik verisi belirsiz |
| G2 Standart/kapsam seç | Danışman / müşteri uzmanı | Rapor yılı, kurum tipi, ülke | Uygulanabilirlik değerlendirmesi ve karar | Hukukî uzman kontrolü |
| G3 Rapor planı | Proje lideri / müşteri sahibi | G1–G2 | Rapor türleri, dönem, sınır, baz yıl, RACI | Kapsam değişikliği |
| G4 Önemlilik/IRO | Konu uzmanı / müşteri temsilcisi | Seçilen standarda göre gerekirse | Gerekçeli konu ve disclosure seti | Gereksizse atla, gerekçeyi sakla |
| G5 Veri planı | Veri lideri / proje lideri | G3–G4 | Veri talepleri, birimler, kaynak, kişiler | Owner yoksa blok |
| G6 Kampanyalar | Katkıcı / veri sahibi | Dönem/kampanya | Kaynak belge + gözlem | İade, istisna, tahmin |
| G7 Hesap | Analist / teknik reviewer | G6 doğrulama | CalculationRun + MetricFact taslağı | Birim/faktör eksik |
| G8 Kontrol | Uzlaştırma uzmanı / finans | G7 | İstisna ve kalite kararı | Açık blocker |
| G9 Konsolidasyon ve kapanış | Veri sahibi / raporlama lideri | G8 ve sınır | Frozen metric snapshot | Dönem yeniden açma |
| G10 Rapor yazımı | Editör/danışman / müşteri owner | G9 veya onaylı snapshot | Bölüm metni, kaynak ve grafik | Veri güncellendi: stale |
| G11 Güvence hazırlığı & yönetim gözden geçirme | Müşteri temsilcisi / yönetim imzacısı | G10 | Onay/inceleme manifestosu | Harici bulgu iade |
| G12 Tasarım/prova/yayın | Tasarım/rapor yöneticisi / yönetim | G11 | Final release ve teslim | Yeni revizyon gerekir |

**Kural:** G9 bitmeden G10 için *taslak* çalışılabilir; fakat nihai metin ve yayın **onaylı/güncel metric snapshot** gerektirir. Akış tek çizgili değil **paralel iş paketleri + kontrol bağımlılıkları**dır.

## 2. Proje ve iş paketleri

```
Engagement: DRAFT → ACCEPTED → ACTIVE → REVIEW → CLOSED
                             ↘ PAUSED / CANCELLED
ReportingCycle: PLANNING → COLLECTION → CALCULATION → CLOSE_REVIEW → FROZEN → RELEASED
                              ↘ REOPEN_REQUESTED → NEW_CYCLE_VERSION
WorkPackage: NOT_READY → READY → ACTIVE → REVIEW → DONE
                              ↘ BLOCKED / REWORK
```

`Task` tipi (`data_request`, `calculation_review`, `narrative`, `approval`, `correction`, `design_proof`, `assurance_query`) süreç motorunun değişkenidir. Her task için `assigneeId`, `reviewerId`, `dueAt`, `projectId`, `requiredEvidencePolicyId`, `dependencyIds`, `status`, `completedAt`, `version`. Toplu atamalar idempotent ve olay kaydıyla yapılır.

## 3. Veri talebi ve metrik

```text
DataRequest: CREATED → ASSIGNED → SENT → SUBMITTED → REVIEWING → ACCEPTED
                                    ↘ REVISION_REQUIRED → RESUBMITTED
                                    ↘ WITHDRAWN / NOT_APPLICABLE
MetricFact: DRAFT → VALIDATING → READY_FOR_REVIEW → APPROVED → LOCKED
                      ↘ INVALID      ↘ REJECTED → SUPERSEDED
```

**ASSIGNED** olmadan `SENT` yok; `ACCEPTED` için gerekli belge ve gerçek reviewer kararı; `NOT_APPLICABLE` yalnız gerekçeli ve standart gerekliliği gerçekten koşullu/isteğe bağlıysa. `LOCKED` satıra düzeltme değil yeni `MetricFactVersion` gerekir.

## 4. Kanıt ve kalite

```text
Evidence: UPLOADED → SCANNING → AVAILABLE → LINKED → RETAINED
                          ↘ QUARANTINED
QualityIssue: OPEN → TRIAGED → ACTION_REQUIRED → FIXED → VERIFIED → CLOSED
                                    ↘ ACCEPTED_EXCEPTION (yalnız uyarıda)
```

Bir **kritik ERROR** “açıklama yazarak geçilmiş” sayılmaz. `ACCEPTED_EXCEPTION` sadece uyarı/uygulanamazlık gibi politika izinli sınıflardadır; karar sahibi, gerekçe, dayanak ve süre limiti tutulur.

## 5. Rapor bölümü, müşteri onayı ve yayın

```text
ReportSection: OUTLINE → DRAFT → TECH_REVIEW → CUSTOMER_REVIEW → SIGNED_OFF
                                            ↘ CHANGES_REQUESTED → DRAFT
ReportRelease: WORKING → VALIDATING → MANAGEMENT_APPROVAL → LOCKED_FOR_DESIGN
                 → PROOF_REVIEW → APPROVED_TO_PUBLISH → RELEASED → ARCHIVED
                                                               ↘ AMENDMENT
```

**Release ön koşulları:** doğru tenant/proje/dönem/sınır; tüm zorunlu açıklamalara yanıt/uygun gerekçe; kritik kalite açığı sıfır; stale metrik yok; onaylı yönetim imzası; nihai dosyaların SHA-256 ve versiyon kaydı; varsa güvence görüşü dokümanı ayrı kaydedilmiş.

## 6. Dış danışmanlık talebi

`ServiceRequest: REQUESTED → PROPOSED → GRANTED → WORKING → REVIEW_DELIVERED → ACCEPTED/CLOSED`, ret/iptal dalları. İzin verildiğinde proje mantıksal olarak sahip değiştirmez. Danışman öneri yapar → müşteri onaylar/reddeder → gerekiyorsa şirket veri sahibi düzeltir. Dış kalite inceleme ile bağımsız güvence hizmeti için farklı `RequestType` kullanılır.

## 7. RACI temel matrisi

R=uygulayan, A=kararı üstlenen, C=danışılan, I=bilgilendirilen. Atamaya göre özelleşir ama **aynı yetkili olmayan kişi müşteri son imzası veremez**.

| İş kalemi | Müşteri sahibi | Veri sahibi | Danışman | Teknik gözden geçiren | Yönetim imzacısı | Harici güvence |
|---|---|---|---|---|---|---|
| Rapor kapsamı | A | C | R | C | I | — |
| Saha kaynağı | I | R/A | C | C | — | — |
| Ölçüm/faktör/metot | C | C | R | A | I | — |
| Konsolidasyon | A | C | R | R | I | C |
| Metin içeriği | A | C | R | C | I | — |
| Yönetim onayı | R | I | C | C | A | — |
| Güvence sorgusu | A | C | C | C | I | R (kendi yetkisi) |
| Yayın | R | I | R | C | A | — |

## 8. Otomatik hatırlatma ve eskalasyon

- T–7: katkıcıya son tarih yaklaşıyor, sistem e-postası; proje lideri CC politikasına göre.
- T–2: kritik görevse ikinci hatırlatma; otomatik gereksiz sıklaşma yok.
- T+1: gecikti → proje yöneticisine özet; kullanıcıya suçlayıcı/oyunlaştırılmış bildirim yok.
- `REJECTED`: katkıcıya açıklama/çelişen satır/önerilen eylem bildirilir; bildirim linki ilgili tenant bağlamında yetki kontrolünden geçer.
- `APPROVAL_REQUEST`: belirtilen farklı reviewer; son onay tarihinde mümkünse yönetim iş takvimi.
- Bildirim outbox/idempotency: e-posta gönderimi başarısız olunca veri talep statüsü dönmez.

## 9. Geliştirici için geçiş doğrulaması

Her action `allowedTransitions` + authenticated actor + resource scope + version precondition + justification policy + audit event olarak sunucuda doğrulanır. İstemci button disabled tutması yeterli değildir. Yarış testi: iki reviewer aynı draft'ı onaylarsa ikinci `409 version_conflict` alır. Görev idempotency anahtarı tekrarlı form gönderiminde iki kayıt yaratmaz.
