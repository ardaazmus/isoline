# ADR-003 — Veri erişim katmanı ve migration: Kysely + SQL öncelikli, geri alınabilir migration

**Durum:** Kabul edildi (19.10.2026) · **Yerine geçtiği:** v2'deki Prisma iskeleti (1deccdb) · **İlgili:** plan 06, 12 §1, G1-01

## Bağlam

- v2 iskeleti Prisma 6 ile 13 tabloluk bir şema kurdu.
- Yol haritası şunları istiyor:
  - "migrate/rollback test";
  - bileşik yabancı anahtarlarla kiracı tutarlılığı;
  - her işlemde `SET LOCAL` ile RLS bağlamı;
  - `numeric(38,12)`;
  - CHECK kısıtları;
  - SQL politika fonksiyonları.

## Karar

| Konu | Seçim |
|---|---|
| Sürücü | `pg` 8.23.1 |
| Sorgu katmanı | **Kysely** 0.29.6: tip güvenli SQL sorgu oluşturucu, ORM değil |
| Migration | Kysely `Migrator`: her migration'da `up` ve `down` |
| Tipler | `kysely-codegen` ile canlı şemadan üretilir, üretilen dosya depoya girer |
| Roller | `isoline_owner` migration'ları uygular. `isoline_app` çalışma rolüdür: `NOBYPASSRLS`, tablo sahibi değil, yalnız gereken yetkiler |
| İşlem bağlamı | `withActor(ctx, fn)`: bir işlem açar, `set_config('app.user_id', …, true)` ve `app.acting_tenant_id` ayarlar, işlem bitince bağlam düşer |

**Emekliye ayrılanlar:**
- v2'deki `prisma/` klasörü ile `@prisma/client` ve `prisma` bağımlılıkları kaldırılır.
- v2'nin kural mantığı (`hierarchy.ts`) korunur, rol matrisi yeni politika modülüne taşınır.

## Gerekçe

- **Geri alınabilirlik:** Prisma migrate yalnız ileri gider; geri alma dosyası elle yazılıp ayrı uygulanmalıdır. Kysely Migrator `down` fonksiyonunu doğal olarak çalıştırır. Plan "migrate/rollback test" istiyor.
- **RLS ve SQL denetimi:**
  - Politikalar, `SECURITY DEFINER` olmayan yardımcı fonksiyonlar ve bileşik yabancı anahtarlar düz SQL'dir.
  - SQL öncelikli migration, güvenlik incelemesinde okunan şeyin çalışan şey olmasını sağlar.
  - Kysely bu SQL'i soyutlamadan taşır.
- **Çalışma zamanı:** Ayrı bir sorgu motoru ikili dosyası yoktur; Node `pg` havuzu yeterlidir. Windows'ta da test ortamında da sorunsuz çalışır.
- **Sektör:** Kysely, TypeScript ekosisteminde SQL öncelikli projelerde yaygındır. Kimlik kütüphanesi Better Auth'un da varsayılan veritabanı katmanıdır (ADR-004), yani tek sorgu katmanı yeter.

## Sonuçlar

- Her migration için bir **ileri–geri–ileri** testi çalışır; ilk sürümden itibaren `db.test` paketinin parçasıdır.
- Sayısal değerler `numeric` olarak saklanır. Hesap motorları JS `number` ile çalışır; girdi ve çıktı özetleri (SHA-256) bu iki temsil arasındaki dönüşümü kayıt altına alır (G4-02).
