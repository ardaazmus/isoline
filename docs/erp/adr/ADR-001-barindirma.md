# ADR-001 — Barındırma: kendi sunucumuz, yerel ağ, Docker Compose

**Durum:** Kabul edildi (19.10.2026, ürün sahibi kararı) · **İlgili:** plan 12 §1, §6

## Bağlam

- Yol haritası "yönetilen veritabanı" öneriyor.
- Ürün sahibinin genel kuralı ise sistemlerin yerel ağda izole çalışması ve gerektiğinde Cloudflare Tunnel ile dışa açılmasıdır.
- Müşteri verisi KVKK kapsamında; veri yeri kararı bu yüzden kritik.

## Karar

**Ortamlar** kendi sunucumuzda, Docker Compose ile ayağa kalkar:

| Servis | İmaj | Görev |
|---|---|---|
| `db` | `postgres:16-alpine` | Kanonik kayıt sistemi |
| `storage` | `chrislusf/seaweedfs:4.48` | S3 uyumlu, özel bucket'lı kanıt deposu (MinIO imajları kaldırıldı; ADR-005) |
| `mail` | `axllent/mailpit` (yalnız geliştirme) | Davet, doğrulama ve hatırlatma e-postalarını yakalar |
| `web` | uygulama | Next.js sunucusu |
| `worker` | uygulama | Outbox, hatırlatma ve tarama işleri |
| `scan` | `clamav/clamav` (profil: `scan`) | Kanıt dosyası zararlı yazılım taraması |
| `tunnel` | `cloudflare/cloudflared` (profil: `public`) | İsteğe bağlı dış erişim |

**Ortam ayrımı:**
- geliştirme, test ve üretim için ayrı Compose projesi, veritabanı ve bucket;
- test veritabanı her koşuda sıfırdan kurulur.

## Gerekçe

- **Veri yeri:** Veri müşterinin ya da hizmet sağlayıcının kendi ağında kalır; veri yeri ve aktarım sorusu sözleşmede basitleşir.
- **Taşınabilirlik:** Bütün bileşenler standart protokol konuşur (PostgreSQL, S3, SMTP, OIDC). Pilot sonrası yönetilen buluta geçiş yalnız yapılandırma değişikliğidir; kod aynı kalır.
- **Sektör pratiği:** Kurum içi (on-prem) SaaS dağıtımlarında Compose ya da Kubernetes ile PostgreSQL ve S3 uyumlu bir depo yaygın bir ikilidir.

## Sonuçlar

**Bizim işimiz olanlar:** yedekleme (`pg_dump` + WAL arşivi), geri yükleme tatbikatı, sertifika ve tünel yönetimi. G8-08'de geri yükleme tatbikatı kabul ölçütüdür.

**Gizli bilgiler:** `.env` dosyasında durur, depoya girmez. Üretimde Docker secrets ya da harici sır yöneticisi kullanılır.

**Port çakışmaları:** Bu makinede 5432 ve 5433 dolu; geliştirme portları `.env` ile seçilir. v2 klasörünün `isoline` Compose projesiyle çakışmamak için proje adı `isoline-main`dir.

## Güncelleme (G8, 19.10.2026)

- Uygulama ve iş kuyruğu kapsayıcı imajı olarak dağıtılır (`web/Dockerfile`, `docker compose --profile app`): web kök olmayan kullanıcıyla ve salt okunur dosya sistemiyle çalışır, `migrate` tek seferlik iş olarak önce koşar.
- Yedekleme pg_dump özel biçimiyle alınır ve `scripts/ops/restore-drill.mjs` ile düzenli olarak geri yüklenip satır sayısıyla doğrulanır; kanıt deposu birim düzeyinde yedeklenir.
