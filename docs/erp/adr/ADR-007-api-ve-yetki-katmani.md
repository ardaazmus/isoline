# ADR-007 — API ve yetki katmanı: modüler monolit, REST `/api/v1`, politika servisi

**Durum:** Kabul edildi (19.10.2026) · **İlgili:** plan 05 §9, 12 §1–2, 03 §6

## Karar

**Klasör yapısı:** `web/src/server/<modül>/`. Modüller:
- `identity`, `tenancy`, `orgs`, `engagements`, `frameworks`, `tasks`, `data`, `evidence`;
- `calc`, `quality`, `reviews`, `reports`, `releases`, `integrations`, `audit`, `jobs`.

Her modülde `service.ts` (iş kuralı), `repo.ts` (Kysely) ve `*.test.ts` bulunur.

**İki giriş kapısı:**
- **REST** route handler'ları (`web/src/app/api/v1/**/route.ts`) dış istemciler, katılımcı formları ve testler içindir.
- **Sunucu bileşenleri** aynı servisleri doğrudan çağırır; arada HTTP yoktur.

**Her mutasyon için standart:**
1. Oturumdan **gerçek kişi** çıkarılır; istemcinin gönderdiği `tenantId` güvenilmez.
2. Acting tenant, `x-isoline-tenant` başlığı ya da çerez seçimiyle belirlenir **ve üyelikle doğrulanır**.
3. Girdi `zod` şemasıyla doğrulanır.
4. `policy.can(actor, action, resource)` çalışır: rol (RBAC) + kapsam (ABAC: kiracı, proje, tesis, dönem, durum). Varsayılan ret.
5. Eşzamanlılık: `If-Match: <row_version>`. Uyuşmazsa `409 version_conflict` döner.
6. `Idempotency-Key` desteklenir.
7. Servis, `withActor` işlemi içinde çalışır (RLS bağlamı). Denetim olayı ve outbox aynı işlemde yazılır.

**Durum makineleri:**
- Kod içinde `allowedTransitions` tablosu olarak tanımlanır.
- İstemci düğmeyi pasif göstermekle yetinmez; sunucu her geçişi tekrar doğrular (plan 05 §9).

**Hata gövdesi:** `{ error: { code, message, details? } }`. Başka kiracının kaynağı için **404** döner; varlık sızdırılmaz.

## Gerekçe

- **Sektör:** Modüler monolit, 2–5 kişilik ekipte mikroservisten daha ucuz işler. Plan da 12 mikroservisi açıkça reddediyor.
- **OWASP API Top 10:** API1 (BOLA), API3 (nesne özelliği yetkisi) ve API5 (fonksiyon düzeyi yetki) için her uçta aynı kontrol zinciri gerekir.
