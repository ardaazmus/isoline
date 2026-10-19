# G8-07 — Yük testi (50 eşzamanlı kullanıcı)

**Tarih:** 19.10.2026. **Araç:** autocannon 8.0.0 (`web/scripts/load/run.ts`). **Sorgu profili:** `web/scripts/load/profile.ts`.

## 1. Ortam ve veri

| | |
|---|---|
| Makine | Intel Core Ultra 9 285 (24 çekirdek), 63 GB RAM, Windows 11; yük üreteci aynı makinede |
| Uygulama | Next.js 16.4.2 üretim derlemesi, standalone sunucu (konteyner imajındaki paket), **tek Node süreci**, Node 24.20; uygulama havuzu `DB_POOL_MAX=10` (varsayılan) |
| Veritabanı | PostgreSQL 16.15 (Docker, `shared_buffers` 128 MB), ayrı `isoline_e2e` veritabanı |
| Veri | Demo (iki yolculuk) + danışmanın 20 geçici müşterisi (21 proje) + **200 arka plan kiracısı** (demo kişilerinin göremediği müşteriler; her birinde proje, 13 iş paketi, iklim veri kampanyası). Toplam 223 kiracı, 222 proje, 2.886 iş paketi, 2.042 veri talebi |

Arka plan kiracıları bilinçli olarak eklendi: çok kiracılı bir sistemde bir kişinin ekranı **başka müşterilerin verisi büyüdükçe yavaşlamamalı**. Bu veri olmadan ölçülen ilk tur darboğazı göstermedi.

## 2. Senaryo

Her sanal kullanıcı kendi oturumuyla giriş yapmış bir kişidir (Better Auth oturumu + çalışma alanı çerezi), tek bağlantıda her an bir isteği uçuştadır (kapalı döngü, düşünme süresi 0): **50 kullanıcı = her an 50 eşzamanlı istek**, gerçek kullanımdan ağır bir durum. 10 sn ısınma, 60 sn ölçüm. Kişiler eşit paylaşılır (her biri 10 kullanıcı) ve günlük ekranlarını döngüyle gezer:

| Kişi | Döngü |
|---|---|
| Danışman (Can, 21 proje) | portföy, portföy göstergeleri, inceleme kuyruğu, görev kutusu |
| Şirket sahibi (Ayşe) | portföy, portföy göstergeleri, hesaplamalar sayfası, rapor API'si |
| Katkıcı (Zeynep) | görev kutusu, portföy |
| Veri sahibi (Mehmet) | görev kutusu, inceleme kuyruğu, hesap çalışmaları API'si |
| Proje lideri (Selin) | hesaplamalar sayfası, hesap çalışmaları API'si, rapor stüdyosu sayfası, rapor API'si |

## 3. Eşikler (betikte kapı; aşılırsa çıkış kodu 1)

| Ölçüt | Eşik (50 kullanıcı) |
|---|---|
| JSON API p95 | ≤ 500 ms |
| Sunucu tarafında üretilen sayfa p95 | ≤ 1 500 ms |
| Hata oranı (2xx dışı) | 0 |

## 4. Sonuçlar

**Önce / sonra (p95, ms; 50 kullanıcı):**

| Uç nokta | Demo verisi, düzeltme öncesi | +200 kiracı, düzeltme öncesi | +200 kiracı, **düzeltme sonrası** |
|---|---:|---:|---:|
| `GET /api/v1/portfolio` | 260 | **616 ✗** | **267** |
| `GET /api/v1/portfolio/kpis` | 268 | **541 ✗** | **278** |
| `GET /api/v1/review-queue` | 255 | 431 | 261 |
| `GET /api/v1/tasks` | 216 | 405 | 224 |
| `GET /api/v1/projects/:id/calculations` | 224 | 419 | 240 |
| `GET /api/v1/reports/:id` | 244 | 434 | 267 |
| Hesaplamalar sayfası | 190 | 174 | 252 |
| Rapor stüdyosu sayfası | 145 | 131 | 200 |
| **Tümü** | **250** | **565** | **259** |
| Verim (istek/sn) | 253 | 150 | **244** |
| Hata | 0 | 0 | 0 |

Son ölçüm (`npm run test:load`, son kodla, 14 701 istek): p50 203 ms, p95 259 ms, p99 284 ms, en yüksek 347 ms. Düzeltme sonrası beş koşuda tüm istekler için p95 246–315 ms ve 212–259 istek/sn ölçüldü; en yavaş koşu, aynı iş istasyonunda başka işler (kod incelemesi, diğer oturumlar) çalışırken alındı. Eşiklerin altında kalan pay her koşuda en az %30. Bu yükte web süreci tek çekirdeğin %110'unu (olay döngüsü doygun), PostgreSQL 3,3 çekirdek kullanıyor. Gecikmenin büyük kısmı Node olay döngüsünde bekleme: 50 eşzamanlı istek / 259 istek/sn ≈ 193 ms (Little yasası). Düzeltmeden önceki 200 kiracılı turda sayfaların API'lerden hızlı görünmesi bundandır: yavaşlayan API'ler sırada beklerken sayfalar daha çok işlemci payı alıyordu.

**Tek istek sorgu profili** (`profile.ts`, ısınmış önbellek, BEGIN/COMMIT hariç SQL ifadesi sayısı / veritabanı süresi):

| Uç nokta | Önce | Sonra |
|---|---:|---:|
| İstek hattı (oturum + çalışma alanı denetimi) | 6 / 3,5 ms | **4** / 2,9 ms |
| Portföy, danışman (21 proje) | 5 / 88,6 ms | 6 / **27,9 ms** |
| Portföy göstergeleri, danışman | 6 / 48,7 ms | 7 / **28,3 ms** |
| Portföy, şirket (1 proje) | 5 / 63,8 ms | 6 / **4,6 ms** |
| Portföy göstergeleri, şirket | 6 / 36,0 ms | 7 / **9,9 ms** |
| İnceleme kuyruğu, danışman | 13 / 15,1 ms | **10** / 16,9 ms |
| İnceleme kuyruğu, veri sahibi | 7 / 7,6 ms | 8 / 7,6 ms |
| Görev kutusu, hesap çalışmaları, rapor stüdyosu | 2 / 4 / 11 ifade | değişmedi |

**Bilgi amaçlı, 100 kullanıcı:** verim ~248 istek/sn'de sabit, p95 508 ms, hata 0. Tek süreç doygun olduğu için gecikme kullanıcı sayısıyla doğrusal artıyor; eşikler 50 kullanıcı için tanımlıdır.

## 5. Bulunan darboğazlar ve düzeltmeler

1. **RLS, başka müşterilerin satırlarında çalışıyordu (gizli N+1).** Portföy `projects ⋈ tenants` sorgusunu, göstergeler de dönem listesini hiçbir WHERE koşulu olmadan çalıştırıyordu; satır güvenliği politikası (`authz.can_read` → `is_member`, `is_steward`, `grant_role`; SECURITY DEFINER, satır içine açılamayan fonksiyonlar) veritabanındaki **her** proje ve kiracı için çağrılıyordu. Şirket sahibinin tek projelik portföyü 200 kiracıyla 64 ms'ye çıktı. **Düzeltme:** `reachableProjectIds` (`tenancy/service.ts`): çalışma alanının kendi projeleri, yönettiği geçici müşterilerinkiler ve kendisine izin verilenler dizinden bulunur; bu küme RLS'in gösterdiğinin üst kümesidir. Listeler önce bu kümeyle daraltılır; sızdırmaz eşitlikler PostgreSQL'de politika fonksiyonlarından önce değerlendirilir; RLS yine her satırda son karardır. Portföy, göstergeler ve inceleme kuyruğu bu yolu kullanır; dönemlerin "en yenisi" ilişkili alt sorgu yerine `DISTINCT ON` ile seçilir.
2. **Eksik dizinler** (migration `0012_load_indexes`): `data_requests (cycle_id, status)`, `quality_issues (cycle_id, status, severity)`, `reports (cycle_id)` (dönem bazlı göstergeler); `tenants (steward_tenant_id)` yalnız geçici müşteriler; inceleme kuyruğu için yalnız bekleyen satırları tutan kısmi dizinler (`metric_fact_versions` incelemeye hazır, `quality_issues` açık, `entity_financials` gönderilmiş).
3. **N+1:** inceleme kuyruğu her proje için ayrı yetki denetimi (`requireProjectAction`, proje başına 2–4 sorgu) yapıyordu. **Düzeltme:** `projectsAllowing`: aynı kurallar, bütün projeler ve eylemler için en fazla dört sorgu.
4. **İstek hattı:** her API isteği ve sayfa, çalışma alanını iki ayrı işlemde (üyelik listesi + kiracının MFA kuralı) denetliyordu; sayfalarda üyelikler düzen ve `requireWorkspace` tarafından iki kez okunuyordu. **Düzeltme:** `tenantActor` tek sorgu, tek işlem; üyelikler istek başına bir kez (`getMemberships`, React `cache`).

**Kalıcılık:** `src/server/portfolio/reach.db.test.ts`: aday küme her çalışma alanı (sahip, katkıcı, başka şirket, danışman sahibi ve gözden geçireni; tasarım izni ve süresi geçmiş izin dahil) için RLS'in gösterdiğinin üst kümesi ve portföy/gösterge sonucu RLS ile birebir aynı; toplu yetki denetimi `requireProjectAction` ile **bütün eylemlerde** eşdeğer; ilgisiz müşteri eklendiğinde portföy, gösterge ve kuyruk sorgu sayısı değişmiyor; tek sorguluk çalışma alanı denetimi yabancı ya da bozuk kimliğe 404, MFA isteyen kiracıya 403 veriyor ve büyük harfle yazılmış kimliği veritabanındaki biçimiyle döndürüyor (bağımsız kod incelemesinin bulgusu). Testin hata yakaladığı, aday kümeden izin kolu çıkarılarak doğrulandı.

## 6. Açık kalanlar ve kapasite notu

- **Tek web süreci ~250–260 istek/sn'de doyuyor.** CPU profili tek bir sıcak nokta göstermiyor (uygulama parçaları %17, Next.js %13, ağ yazımı ~%8; maliyet dağınık). Daha fazla eşzamanlı kullanıcı için web kopyası çoğaltılmalı (durumsuz; oturumlar veritabanında). Not: Better Auth hız sınırlayıcısı bellekte tutuluyor; birden çok kopyada ortak depoya taşınmalı.
- **Görünen satır başına RLS maliyeti.** Politika fonksiyonları kişinin gördüğü her satırda ~50–60 µs harcıyor; danışmanın 21 projesinde iş paketi sorgusu (283 satır) ~15 ms. Bu, ilgisiz müşterilerle değil danışmanın kendi portföyüyle büyür (200 müşteride tahminen ~150 ms). Çözüm yolu: politikaları, ifade başına bir kez hesaplanan kümelerle karşılaştıracak biçimde yeniden yazmak (`owner_tenant_id = any((select authz.readable_tenants()))`); güvenlik açısından kritik bir değişiklik olduğu için ADR ve tam RLS test turu ister — ayrı iş olarak önerildi.
- Veritabanı havuzu (10) bu yükte darboğaz görünmüyor (tahmin: 259 istek/sn × istek başına ~10 ms veritabanı süresi ≈ ortalama 2,6 meşgul bağlantı); havuz bekleme süresi ayrıca ölçülmedi.

## 7. Çalıştırma

```bash
npm run e2e:prepare
npm run build
npm run test:load
```

Varsayılan 50 kullanıcı, 10 sn ısınma, 60 sn ölçüm; `npm run test:load -- --users 100 --duration 45` ile değiştirilir. Betik 3211'de sunucu yoksa kendisi başlatır, uç nokta başına p50/p95/p99 tablosunu yazar, ham sonuçları `scripts/load/results/` altına (git dışı) kaydeder ve eşik aşılırsa 1 ile çıkar. Sorgu profili: sunucu açıkken (`npm run e2e:server`) `npm run load:profile -- --explain`.
