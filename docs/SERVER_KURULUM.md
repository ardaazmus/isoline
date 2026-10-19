# Sunucu kurulumu (ERP platformu)

Platform kendi sunucumuzda Docker Compose ile çalışır ([ADR-001](erp/adr/ADR-001-barindirma.md)). Tarayıcıdaki araç seti (v1) aynı uygulamada, kendi rotalarında çalışmaya devam eder; verisi platforma **Ayarlar → Araç seti aktarımı** ekranından taşınır.

## Bileşenler

| Servis | İmaj | Görev | Yerel port |
|---|---|---|---|
| `db` | `postgres:16-alpine` | Bütün kayıtlar; satır düzeyi güvenlik (RLS) | 5545 |
| `storage` | `chrislusf/seaweedfs:4.48` | Kanıt dosyaları (S3 uyumlu, şifreli, herkese kapalı) | 8333 |
| `mail` | `axllent/mailpit:v1.31.4` | Geliştirmede giden e-postaları yakalar (arayüz 8125) | 1125 |
| `scan` | `clamav/clamav:stable` | Kötü amaçlı yazılım taraması (profil `scan`) | 3310 |
| `tunnel` | `cloudflare/cloudflared` | İsteğe bağlı dış erişim (profil `public`) | — |

Uygulama (`web`) ve arka plan işçisi (`worker`) geliştirmede `npm` ile çalışır; konteyner imajları G8'de eklenecek.

**Veritabanı rolleri** ([ADR-002](erp/adr/ADR-002-kiraci-ve-dis-erisim.md), [ADR-003](erp/adr/ADR-003-veri-erisim-ve-migrasyon.md)):

| Rol | Kullanım |
|---|---|
| `isoline_owner` | Migration'lar; şemanın sahibi |
| `isoline_app` | Uygulama; RLS zorunlu (`NOBYPASSRLS`) |
| `isoline_system` | Dar sistem yolları (kayıt sonrası ilk kiracı, davet kabulü, işçi); her çağrı bir gerekçe taşır |
| `isoline_rls` | Giriş yapamaz; yalnız `authz.*` yardımcı işlevlerinin sahibi |

## İlk kurulum (geliştirme)

```bash
node scripts/dev-env.mjs
```

Bu komut `.env`, `web/.env.local` ve `deploy/seaweedfs/s3.json` dosyalarını rastgele parolalarla bir kez yazar. Dosyalar git'e girmez ve parolalar ekrana basılmaz. Var olan dosyalar korunur; yalnız eksik bağımsız anahtarlar (`APP_ENCRYPTION_KEY`) eklenir.

```bash
docker compose up -d db storage mail
```

```bash
cd web && npm run db:bootstrap && npm run db:migrate && npm run db:seed
```

```bash
cd web && npm run dev -- --port 3210
```

```bash
cd web && npm run worker
```

- Uygulama: http://localhost:3210/tr/auth/login
- Sağlık: http://localhost:3210/api/v1/health
- Giden e-postalar: http://localhost:8125
- Örnek kişilerin giriş bilgisi: `web/.demo-users.local.json` (yalnız yerel; git'e girmez)

`npm run db:seed -- --reset` örnek veriyi baştan kurar. Örnek kiracılar `sample` işaretlidir ve ekranda "Örnek veri" etiketiyle görünür.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run db:bootstrap` | Rolleri ve `isoline` veritabanını kurar (yönetici bağlantısıyla) |
| `npm run db:migrate` / `db:rollback` / `db:status` | Geri alınabilir migration'lar |
| `npm run db:types` | Kysely tiplerini veritabanından üretir |
| `npm run db:seed [-- --reset]` | İki referans yolculuğun örnek verisi |
| `npm run worker` | Outbox: e-posta, kanıt taraması; yeniden deneme ve ölü mektup |
| `npm test` | Birim ve özellik tabanlı testler |
| `npm run test:db` | Gerçek PostgreSQL, Mailpit, SeaweedFS ve ClamAV ile entegrasyon testleri (`isoline_test` her koşuda sıfırdan kurulur; dosyalar yol sırasıyla çalışır, kiracılar arası sızıntı denetimi en sonda) |

## Kapsayıcılarla çalıştırma (G8)

Uygulama ve iş kuyruğu imajları `web/Dockerfile` ile derlenir (Next.js standalone sunucusu kök olmayan kullanıcıyla, salt okunur dosya sistemiyle çalışır; worker aynı derlemeden `tsx` ile).

1. `node scripts/dev-env.mjs` (bir kez) → `web/.env.local` gizli değerleri.
2. `node scripts/server-env.mjs --base-url https://isoline.kurum.local` → `deploy/app.env` (aynı gizli değerler, compose servis adlarıyla; git'e girmez).
3. `docker compose --profile app --profile scan up -d --build` → `migrate` (migration + katalog + faktör + referans sürüm kaydı) bittikten sonra `web` ve `worker` başlar. Web `127.0.0.1:${APP_PORT:-3230}` üzerinde; dışa açmak için `--profile public` (Cloudflare Tunnel) ya da kurumun ters vekil sunucusu.
4. Sağlık: `GET /api/v1/health` (veritabanı erişimi dahil). 19.10.2026'da bu adımlar yerelde çalıştırıldı: migrate "güncel", web sağlıklı, giriş sayfası 200, worker başladı.

## Yedekleme ve geri yükleme tatbikatı

- `node scripts/ops/restore-drill.mjs --backup` → `backups/isoline-<zaman>.dump` (pg_dump özel biçim, kapsayıcı içinde tutarlı anlık görüntü).
- `node scripts/ops/restore-drill.mjs` → yedeği alır, `isoline_restore_drill` veritabanına geri yükler, `core` şemasındaki her tablonun satır sayısını kaynakla karşılaştırır, denetim zincirinin özet sütunlarını kontrol eder, geçici veritabanını siler; uyuşmazlıkta hata koduyla biter.
- 19.10.2026 tatbikatı: 61 tablo, 2 110 satır, uyuşmazlık yok, 11 migration, 86 sn.
- Kanıt deposu (SeaweedFS) birim düzeyinde yedeklenir (`s3data` birimi); PITR için PostgreSQL WAL arşivi üretim sunucusunda ayrıca açılır.

## Kaynak bağlayıcıları ve SSO

- **Bağlayıcı:** proje sahibi şirketin üyesi kurar; yalnız tanımlanan sunucuya (HTTP/HTTPS) bağlanılır, yönlendirme izlenmez, 15 sn zaman aşımı ve 15 MB sınırı vardır; erişim anahtarı AES-256-GCM ile mühürlenir. Çekilen veri dosya içe aktarmasıyla aynı yoldan (tarama, doğrulama, gözden geçirene gönderim) geçer; aynı veri ikinci kez "değişmedi" olarak kaydedilir; hata outbox'ta yeniden denenir, sonunda ölü mektup olur.
- **OIDC/SSO:** `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` verilirse kurumsal kimlik sağlayıcısı (Keycloak, Entra ID, Google Workspace…) keşif belgesiyle eklenir; yetkilendirme kodu + PKCE, nonce bağlı ve JWKS ile doğrulanmış kimlik jetonu (`oidc.db.test.ts`). Geri dönüş adresi: `<BETTER_AUTH_URL>/api/auth/callback/oidc`.

## Güvenlik notları

- **Gizli değerler:** `BETTER_AUTH_SECRET`, `APP_ENCRYPTION_KEY` ve veritabanı parolaları üretimde sunucunun gizli değer deposundan gelir; compose dosyasına yazılmaz.
- **Kanıt taraması:** Üretimde `SCANNER=clamav` ve `docker compose --profile scan up -d` zorunludur. `SCANNER=dev` yalnız EICAR test dosyasını tanır ve üretimde reddedilir.
- **E-posta:** Üretimde `EMAIL_SMTP_*` kurumun SMTP sunucusuna yönlenir; Mailpit yalnız geliştirme içindir.
- **Kişisel veri:** İSG ve işgücü verisi yalnız toplam olarak taşınır (G0 risk kaydı R8).
- **Barındırma:** Müşteri verisinin yurt içinde barındırılması kararı verilmeden üretim verisi yüklenmez.

## Doğrulama durumu

Güncel kapı durumu ve kanıtlar: [erp/DURUM.md](erp/DURUM.md).
