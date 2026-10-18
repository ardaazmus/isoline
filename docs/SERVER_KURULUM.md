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
# NOT: Bu makinede 5432 dolu olduğu için .env'de POSTGRES_PORT=5544 kullanılır.
docker compose up -d db
cd web && npx prisma migrate dev && npm run db:seed
```

Seed sonucu (hayali kiracı, gerçek Postgres satırları): 1 workspace, 1 holding,
2 iştirak, 3 tesis, 2 maliyet merkezi, 2 görev, 6 kullanıcı (6 rol), 1 kanıt,
1 bulgu, 1 dönem. 20 kişiye gerek yok — akış `demo-workflow.test.ts` ile kanıtlı.

- Uygulama: http://localhost:3000
- Sağlık: http://localhost:3000/api/v1/health
- Sözleşme: http://localhost:3000/api/v1/hierarchy

## Durum (18.10.2026)

- [x] `prisma` + `@prisma/client` + `pg` kurulu; şema doğrulandı, istemci üretildi.
- [x] Postgres Docker'da ayakta; ilk migrate uygulandı (`prisma/migrations/`).
- [x] Hayali seed DB'de (`web/prisma/seed.mjs`, `npm run db:seed`).
- [ ] `web/src/server/db.ts` (Prisma istemcisi) + API uçlarının gerçek CRUD'a geçişi.
- [ ] RLS politikaları (Faz 4 migration: `organizationId` + rol bazlı satır politikaları).
- [ ] Faktör kasası taşıma (§5.1): FUELS/GWP/GRID_FACTORS hâlâ kodda
  (`web/src/lib/calc/ghg.ts`) — değerler resmî tablo ve testlerde CSV çapraz
  kontrollü, keyfî hardcode yok; taşınma yalnızca sürümleme/denetim içindir.

## KVKK / üretim notları

- `AUTH_SECRET` üretimde `openssl rand -base64 48` ile üretilir, compose dosyasına yazılmaz.
- Kişisel/sağlık verilerinde toplam-only ilkesi korunur (`sensitive` veri noktaları).
- Müşteri verisinin ülke/içeride-barındırma kararı verilmeden prod verisi yüklenmez.
