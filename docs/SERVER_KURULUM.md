# Sunucu Kurulumu (Faz 3–4 iskeleti)

## Soruya cevap: veriler şu an nerede?

Ne Docker'da ne sunucuda — **tamamen tarayıcı `localStorage`'ında** (`web/src/store/workspace.ts`,
zustand `persist`). Bu yüzden iki bilgisayardan aynı veriye erişilemez, kullanıcı/rol yoktur,
denetçi ayrımı istemci tarafındadır. Aşağıdaki iskelet bunu sunucuya taşımak için kurulabilir yapıdır;
tarayıcı uygulaması aynen çalışmaya devam eder.

## Mimari

- `docker-compose.yml` — `db` (Postgres 16) + `web` (Next.js) servisleri.
- `web/prisma/schema.prisma` — 6 katman (Workspace > Organization > LegalEntity > Facility >
  CostCenter > MetricTask) + 6 rol + dönem/görev/kanıt/faktör kasası/denetim günlüğü.
- `web/src/server/` — saf sunucu mantığı (DB'siz, testli): `rbac.ts` (yetki matrisi),
  `hierarchy.ts` (konsolidasyon + YoY ±%30 + kanıt kapısı).
- `web/src/app/api/v1/` — `health` (canlılık) + `hierarchy` (sözleşme ucu).

## Çalıştırma

```bash
cp .env.example .env        # .env commit'lenmez
docker compose up -d --build
docker compose logs -f web
```

- Uygulama: http://localhost:3000
- Sağlık: http://localhost:3000/api/v1/health
- Sözleşme: http://localhost:3000/api/v1/hierarchy

## Veritabanını aktifleştirme (sıradaki adım)

```bash
cd web
npm i -D prisma && npm i @prisma/client pg
npx prisma migrate dev --schema prisma/schema.prisma
```

Sonra `web/src/server/db.ts` (Prisma istemcisi) yazılır, API uçları in-memory sözleşmeden
gerçek CRUD'a geçirilir. RLS politikaları Faz 4 migration'ıyla eklenir
(`organizationId` + rol bazlı satır politikaları).

## KVKK / üretim notları

- `AUTH_SECRET` üretimde `openssl rand -base64 48` ile üretilir, compose dosyasına yazılmaz.
- Kişisel/sağlık verilerinde toplam-only ilkesi korunur (`sensitive` veri noktaları).
- Müşteri verisinin ülke/içeride-barındırma kararı verilmeden prod verisi yüklenmez.
