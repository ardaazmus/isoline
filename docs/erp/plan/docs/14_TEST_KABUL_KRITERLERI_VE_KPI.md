# 14 — Test/QA stratejisi, UAT, güvenlik, non-functional ve KPI

## 1. Kabul tanımı

“Ekran açılıyor” yeterli değil. En az: **veri/model doğru**, **tenant/role doğru**, **iş akışı doğru**, **kaynak/faktör/sürüm doğru**, **onay/release doğru**, **UI anlaşılır ve erişilebilir**, **log/backups var**. Kritik regülasyon/hesap yöntemleri hukukî veya sektörel uzman tarafından ayrık kontrol edilir.

## 2. Test katmanları

| Katman | Araç/teknik | İçerik |
|---|---|---|
| Unit | Vitest/Node test | pure calc, format, unit, rounding, state transitions |
| Property-based | fast-check benzeri | birim dönüşümü, invariants, monotonicity uygun olduğunda |
| DB integration | Test PostgreSQL, transactional migrations | FK, CHECK, RLS, indexes, grant revocation |
| API contract | OpenAPI + schema assertions | input validation, concurrency, idempotency |
| E2E | Playwright | kayıt→proje→data→review→report→release |
| UX/accessibility | axe + keyboard + manual WCAG | login, görev formu, hiyerarşi, 3D fallback |
| Security | OWASP BOLA, upload, session, secret | tenant erişim, file link, endpoint permission |
| Performance | load test, EXPLAIN | 500k observation/large task queue, RLS/joins |
| Regression | previous app workspace export/import parity | mevcut hesap motoru sonuçları değişmez veya fark belgeli |

## 3. Doğrulanacak ana senaryolar (UAT-01..20)

| ID | Uygulama | Beklenen |
|---|---|---|
| UAT-01 | Danışman firma kayıt → tenant → ekip davet | kullanıcı doğrulanmış, advisory workspace aktif |
| UAT-02 | Şirket kayıt → iki tesis → TSRS dönemi | company tenant, cycle ve boundary ayrı |
| UAT-03 | Danışman X adına provisional müşteri oluşturur | müşteri sahipliği claim edilmeden son yayın bloke |
| UAT-04 | Şirket danışmanlık firması B'yi davet eder | yalnız proje/dönem/izinli belgeler |
| UAT-05 | B farklı müşteri ID'sini ister | API 403/404, hiçbir bilgi sızmaz |
| UAT-06 | B'nin grant'ı iptal edilir | yeni erişim ve file URL'leri sona erer |
| UAT-07 | Çalışan tesis A görevi alır, tesis B verisini açamaz | ABAC doğru |
| UAT-08 | Elektrik yükleme/import, kWh/MWh | preview, birim dönüşümü, kaynak file hash |
| UAT-09 | Aynı dosya yeniden import | duplikasyon/idempotency, yeni veri yok |
| UAT-10 | Kanıt zarar taraması başarısız | dosya görünmez, metric ready olmaz |
| UAT-11 | Reviewer hazırlayan kişi | 403/invalid transition |
| UAT-12 | Reviewer ret gerekçesi verir | draft ve yeni sürüm, yorum saklı |
| UAT-13 | 2025/2026 faktör farkı | doğru dönem ve recalculation trace |
| UAT-14 | Firma iki bağlı ortaklık ve sahiplik değişimi | GHG boundary ve finansal konsolidasyon ayrılır |
| UAT-15 | Açık kritik kalite issue | release blocker |
| UAT-16 | TSRS & GRI same fact references | kapsam ve dönem şartıyla reusable |
| UAT-17 | Fact approved sonrası değişir | stale section → reapproval, eski release değişmez |
| UAT-18 | Dış reviewer belge talebi açar | salt okunur, data edit yetkisi yok |
| UAT-19 | Müşteri yönetimi final imzalar | release hash ve yetkili kimliği |
| UAT-20 | Tasarım ajansı DOCX+SVG+XLSX devir | yalnız final varlık, versiyon ve kaynak match |

## 4. Güvenlik red-team senaryoları

- API çağrısında `owner_tenant_id` veya `approved_by` body değiştirme.
- UUID tahmini değil **gerçek A tenant nesne UUID'sini B ile isteyerek** BOLA testi.
- Kötü niyetli HTML içeren rapor bölümü ve SVG asset'inde XSS temizliği.
- ZIP bomb/çok büyük PDF/uzantı uyuşmazlığı ve zararlı dosya scanner.
- Token expired, member revoked, grant revoked, MFA reset, eski link/refresh token testi.
- Storage presigned URL izin iptalinden sonra edge cache davranışı; süre az ve log.
- Bilinmeyen hukukî kural statüsü `unverified` olduğunda rapora otomatik zorunlu compliance iddiası eklenmez.
- Audit/outbox veritabanı işlemi başarısızken approve/publish **fail-closed**.

## 5. Veri ve hesap doğruluk testleri

| Konu | Zorunlu karşılaştırma |
|---|---|
| Scope 1 | Yakıt/NCV/EF/metot/diğer gaz ve tCO₂e kontrolü |
| Scope 2 | location/market ayrımı, contract ve yıl faktörü |
| Scope 3 | 15 kategori/tedarikçi data quality, kuruluş sınırı |
| Çevre | su çekimi ve tüketimi ayrı; atık türü ve payda |
| İnsan kaynağı | belirlenen sayım/payda, dönem sonu vs ortalama |
| Finans | mizan net satış, kur, muhasebe türü, grup eliminasyonu |
| CBAM | üretim/proses/ülke ve KN, gerçek–varsayılan, mevzuat yılı |
| Unit/locale | TR ondalık virgül ve EN nokta, hesap saklama değişmez |
| Revision | eski hesap digest'i ve source hash korunur |
| Export | aynı fact-version sayısı DOCX/CSV/SVG'de aynıdır |

## 6. Operasyonel KPI tanımları

1. `required_data_completion` = zorunlu veri taleplerinden kabul edilmiş/uygun gerekçeli tamamlananların payı (hem adet hem bölüm ağırlıkları).
2. `evidenced_fact_rate` = aktif raporda kullanılan faktların kaynak/kanıt politikası tamamlanmış olanlarının payı.
3. `review_cycle_time` = kişi ve belge bazlı gönderim→karar süre dağılımı.
4. `rework_rate` = geri gönderilen veri talepleri / gönderilen talepler.
5. `blocking_rule_count` = kapanışa engel açık kalite ve açıklama kuralı.
6. `stale_content_count` = değişmiş fact'e referans eden yeniden onaylanmamış rapor bölümü sayısı.
7. `publication_ready` = **tüm gerekli kapılar geçti** (binary); herhangi bir çizimle tahmin edilmiş compliance yüzdesi değil.
8. `tenant_access_denials` = reddedilen yetkisiz çapraz erişim (güvenlik alarmı, çalışanı puanlama yok).
9. `time_to_handoff` = kickoff'tan tasarım manifestine kadar iş günü, zaman ve kaynak sözleşmesiyle.
10. `source_coverage` = belgelendirilmiş birincil kaynaklı metrik oranı, tahmin payını ayrı raporla.

## 7. Pilot kabul raporu şablonu

`project_id, tester, software_commit, schema_version, framework_pack_versions, dataset_hash, executed_at, scenario_id, expected, actual, screenshots/logs, pass/fail, severity, owner, fixed_commit, retest_date`. Ürün sahibi ve mevzuat uzmanı ilgili alanların kabulünü ayrı işaretler; demo vaka sonuçlarının gerçek müşteri uygunluğu olduğu iddia edilmez.
