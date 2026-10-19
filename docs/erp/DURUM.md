# ISOLINE ERP — Uygulama durumu (G0–G8)

**Kaynak plan:** [plan/](plan/README.md) (ISOLINE_ERP_2026_Master_Plan v1.0, MANIFEST özetleri doğrulandı) · **Karar kayıtları:** [adr/](adr/) · **G0 çıktıları:** [G0/](G0/)

**Durum değerleri:** `bitti` · `kısmi` · `engelli` · `başlamadı`. Plan kuralı gereği "bitti" demek için çalışan akış, kullanıcı yetkisi, kaynak kanıtı ve otomatik test birlikte gösterilmeli; karşılanmayan kısım `kısmi` olarak kalır.

**Ürün sahibi talimatı (19.10.2026):** Soru sormadan, sektördeki yerleşik çözümlerle bütün yol haritasını uygula; burada commit'le; GitHub'a gönderim en sona kalsın. Bu talimat G0 onayı olarak kayıtlıdır.

## Özet

| Kapı | Durum | Not |
|---|---|---|
| G0 | bitti | Envanter, 11 ADR, ekran haritası, göç riski, iki yolculuk, tehdit modeli |
| G1 | bitti | Kimlik, kiracı, RLS, dış erişim izni, kanıt deposu, denetim+outbox, araç seti aktarımı; 34 entegrasyon testi |
| G2 | başlamadı | |
| G3 | başlamadı | |
| G4 | başlamadı | |
| G5 | başlamadı | |
| G6 | başlamadı | |
| G7 | başlamadı | |
| G8 | başlamadı | |

## G0 — Analiz, karar, envanter

| ID | Durum | Kanıt |
|---|---|---|
| G0-01 | bitti | [01_KOD_ENVANTERI.md](G0/01_KOD_ENVANTERI.md): 348 test, typecheck, lint, validate ve build baz çizgisi |
| G0-02 | bitti | [ADR-002](adr/ADR-002-kiraci-ve-dis-erisim.md), [04_UAT_SENARYOLARI.md](G0/04_UAT_SENARYOLARI.md) |
| G0-03 | bitti | [ADR-010](adr/ADR-010-standart-ve-kural-sicili.md) |
| G0-04 | bitti | [02_EKRAN_HARITASI.md](G0/02_EKRAN_HARITASI.md), [ADR-011](adr/ADR-011-arayuz-kabugu.md) |
| G0-05 | bitti | [03_GOC_RISK_KAYDI.md](G0/03_GOC_RISK_KAYDI.md) |
| G0-06 | bitti | [04_UAT_SENARYOLARI.md](G0/04_UAT_SENARYOLARI.md) |
| G0-07 | bitti | [05_TEHDIT_MODELI.md](G0/05_TEHDIT_MODELI.md) |

## G1 — Kimlik, kiracı, PostgreSQL

| ID | Durum | Kanıt |
|---|---|---|
| G1-01 | bitti | Migration'lar `web/src/server/db/migrations/0001_auth`, `0002_core`, `0003_legacy_import`; dört veritabanı rolü (`bootstrap.ts`); `migrations.db.test.ts` boş veritabanında ileri → tamamen geri → ileri; örnek veri `npm run db:seed` |
| G1-02 | bitti (OIDC alt maddesi kısmi) | Better Auth 1.7.7: e-posta doğrulaması zorunlu, 12+ karakter şifre, sıfırlamada oturumların kapanması, 7 gün oturum, TOTP + yedek kodlar, oturum listesi ve iptali. `auth.db.test.ts` (TOTP kaydı → sonraki girişte ikinci adım → MFA zorunlu alana giriş), `api.db.test.ts` (doğrulanmamış hesap giremez, çıkıştan sonra 401). Kimlik şeması Better Auth'un beklediğiyle birebir (`getMigrations` boş). OIDC (Keycloak, Entra ID…) `OIDC_ISSUER` ile açılır; gerçek bir kimlik sağlayıcıyla sınaması G8 güvenlik incelemesinde |
| G1-03 | bitti | Üyelik ve rol (`core.memberships`), `x-isoline-tenant` başlığı ya da çerezle seçim, her istekte canlı üyelik kontrolü. `api.db.test.ts`: bir kişi iki çalışma alanı, yabancı alan 404 |
| G1-04 | bitti | FORCE RLS + `SET LOCAL` bağlam; `tenancy.db.test.ts` ve `api.db.test.ts`: çapraz okuma 0 satır, çapraz yazma RLS hatası, bağlamsız 0 satır, bağlam sızmıyor, başka kiracının nesnesine 404 |
| G1-05 | bitti | `app/onboarding` iki yol (şirket / danışmanlık), `POST /api/v1/tenants`; seçim ekranı `app/choose` |
| G1-06 | bitti | 7 gün, tek kullanımlık, özet saklanan davet; iptal; başka e-postayla kabul reddi; maskeli önizleme. `tenancy.db.test.ts`, `api.db.test.ts` (Mailpit'e düşen gerçek davet e-postasıyla) |
| G1-07 | bitti | `core.external_grants` + `core.consent_records`: proje, rol, amaç, süre, indirme izni; iptal anında etkili. `api.db.test.ts`: danışman yalnız izinli projeyi görür, iptalden sonraki istek 404 |
| G1-08 | bitti | Geçici müşteri (`app/portfolio/clients/new`), sahiplik daveti, sahiplenince 90 günlük devam izni. `tenancy.db.test.ts` |
| G1-09 | bitti | SeaweedFS (S3, şifreli, herkese kapalı): içerik imzasıyla tür kontrolü, 50 MB, SHA-256, karantina → tarama → yayın, 5 dakikalık imzalı indirme, erişim günlüğü. `filetype.test.ts`, `api.db.test.ts` (EICAR karantinada kalır, kılık değiştirmiş çalıştırılabilir dosya 415), `scanner.db.test.ts` (gerçek ClamAV clamd: temiz dosya geçer, EICAR yakalanır, 64 KB'den büyük akış) |
| G1-10 | bitti | Denetim olayı işlemle aynı transaction'da, kiracı başına özet zinciri ve doğrulaması (`verifyChain`), outbox + işçi (yeniden deneme, ölü mektup, mühürlü token). `tenancy.db.test.ts` (fail-closed), `api.db.test.ts` (zincir doğrulanır) |
| G1-11 | bitti | `app/settings/import`: araç seti dosyası (v2–v11) önizleme → uygulama → geri alma. G0 risk kaydı R1–R10 uygulandı: yazılı isimli onay yalnız denetim olayı, kanıt özeti `awaiting_file` yer tutucu (aynı dosya yüklenince bağlanır), aynı dosya iki kez aktarılamaz, kaynak arşivlenir, v1 motor toplamları eşdeğerlik raporunda. `legacy/import.db.test.ts` (5 test) |
| G1-12 | bitti | `app/settings/members` (davet, iptal, üyelik sonlandırma), `app/settings/security` (MFA zorunluluğu, If-Match), `app/settings/audit`, `app/account/security`. Üyeliği biten kişinin bir sonraki API isteği 404 (`api.db.test.ts`) |

**G1 kapısı:** iki kiracı ve üç rolle izolasyon testleri, proje bazlı izin, kanıt deposu güvenliği ve fail-closed denetim gerçek PostgreSQL, Mailpit ve SeaweedFS ile geçti. Komutlar: `npm test` (birim + özellik), `npm run test:db` (entegrasyon), `npm run typecheck`, `npx eslint src scripts`, `npx next build`.

**Bilinçli olarak sonraya kalanlar:** `web` ve `worker` konteyner imajları (G8), OIDC'nin gerçek kimlik sağlayıcıyla sınanması (G8), kayıt ucunun hesap varlığını sızdırmaması (tehdit T18, G8).

## G2–G8

Kapı başladıkça buraya ayrıntılı tablo eklenir. Görev listeleri plan 13'te.

## Oturum kontrol noktası (bağlam sıkıştırmasına karşı)

- **Oturum amacı:** ERP yol haritasını G0'dan G8'e uygulamak, her kapıda burada commit'lemek, GitHub'a en sonda göndermek.
- **Dokunulan alanlar:** `docs/erp/**`, `docker-compose.yml`, `scripts/dev-env.mjs`, `web/src/server/**` (modüller), `web/src/app/api/**`, `web/src/app/[lang]/{app,auth}/**`, `web/src/platform/**`, `web/messages/*.json` (`pf.*`).
- **Kararlar:**
  - barındırma kendi sunucumuz (ADR-001);
  - veri katmanı Kysely + SQL migration (ADR-003);
  - kimlik Better Auth (ADR-004);
  - depo SeaweedFS (ADR-005; MinIO imajları kaldırıldığı için);
  - modüler monolit (ADR-007);
  - v1 araç seti `(toolkit)` rota grubunda korunuyor (ADR-008).
- **Açık / sıradaki:** G2 (organizasyon ağacı, sahiplik kenarları, raporlama sınırı, sözleşme/teslimat, dönemler, uygulanabilirlik kararı, ekip, plan, portföy).
