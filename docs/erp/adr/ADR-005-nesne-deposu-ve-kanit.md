# ADR-005 — Kanıt dosyaları: MinIO (S3), sunucu tarafında özet ve tarama, kısa ömürlü imzalı URL

**Durum:** Kabul edildi (19.10.2026) · **İlgili:** plan 06 §1, §8; 12 §3–4; G1-09, G3-06; UAT-10

## Karar

**Depo:**
- MinIO, özel bucket `isoline-evidence`; herkese açık okuma ve listeleme yok.
- İstemci kütüphanesi `@aws-sdk/client-s3` 3.1146.0 ve `s3-request-presigner`.

**Yükleme sırası:**
1. Dosya API'ye akar. Sunucu boyut sınırını (varsayılan 50 MB) ve uzantı–MIME tutarlılığını kontrol eder, SHA-256 özetini hesaplar.
2. Dosya `quarantine/` önekine yazılır. Kayıt `evidence_objects`'e `scan_status = 'scanning'` ile girer.
3. Worker taramayı yapar:
   - temizse dosya `objects/{tenant}/{id}` konumuna taşınır, durum `available` olur;
   - zararlıysa `quarantined` olur, dosya kullanıcıya hiç görünmez.
   - Tarayıcı erişilemezse dosya `scanning`'de bekler; sistem kapalı kalarak güvenli tarafta durur.
4. **İndirme:** RLS'li meta veri kontrolünden sonra 5 dakikalık imzalı URL verilir. İndirme `evidence_access_log`'a yazılır.

**Tarayıcı:**
- `clamav` servisi (clamd TCP 3310) kullanılır.
- ClamAV ayakta değilse geliştirme modunda `EICAR` test imzasını tanıyan bir **asgari tarayıcı** devreye girer.
- Üretimde bu yedek **devre dışıdır**; ClamAV yoksa dosya `scanning`'de kalır.

**Mükerrer dosya:** Aynı projede aynı SHA-256 tekrar yüklenince yeni nesne oluşmaz, var olan kayda bağlanır (idempotent; UAT-09).

## Gerekçe

- **Plan:** Kanıtın aslının S3 uyumlu özel depoda, PostgreSQL'de ise yalnız işaretçi, bütünlük özeti ve sınıflama bilgisinin tutulmasını istiyor.
- **Sektör ve OWASP:** Dosya yükleme rehberi tarama, boyut sınırı, MIME doğrulaması, rastgele depolama adı ve imzalı indirme önerir.
- **Veri yeri:** MinIO kendi sunucumuzda çalışır (ADR-001); S3 API'si sayesinde buluta taşınabilir.

## Sonuçlar

- Mevcut v1 kanıt kayıtlarında (`importLog.sha256`) dosyanın kendisi yok. Bunlar `awaiting_file` durumuyla taşınır (plan 06 §9.5).
- Saklama süresi ve yasal bekletme (legal hold): `retention_rules` tablosu G1-09'da kurulur, imha servisi G8'de.
