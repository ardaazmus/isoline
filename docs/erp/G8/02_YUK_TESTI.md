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

| Kişi | Döngü (G8-07 ilk tur) | UX birleştirmesiyle eklenen (genişletilmiş profil, §7) |
|---|---|---|
| Danışman (Can, 21 proje) | portföy, portföy göstergeleri, inceleme kuyruğu, görev kutusu | Bugün sayfası (müşteri tablosu) |
| Şirket sahibi (Ayşe) | portföy, portföy göstergeleri, hesaplamalar sayfası, rapor API'si | Bugün sayfası, proje özeti (yedi adım) |
| Katkıcı (Zeynep) | görev kutusu, portföy | Bugün sayfası |
| Veri sahibi (Mehmet) | görev kutusu, inceleme kuyruğu, hesap çalışmaları API'si | İşlerim sayfası (tek gelen kutusu) |
| Proje lideri (Selin) | hesaplamalar sayfası, hesap çalışmaları API'si, rapor stüdyosu sayfası, rapor API'si | — |

İlk turda 18 adımın 3'ü sunucuda üretilen sayfaydı; genişletilmiş profilde 22 adımın 8'i. `npm run test:load` genişletilmiş profili çalıştırır.

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
2. **Eksik dizinler** (migration `0013_load_indexes`; dalda 0012'ydi, UX çalışmasının `0012_worksheets`'iyle çakışmasın diye birleştirmede yeniden numaralandı): `data_requests (cycle_id, status)`, `quality_issues (cycle_id, status, severity)`, `reports (cycle_id)` (dönem bazlı göstergeler); `tenants (steward_tenant_id)` yalnız geçici müşteriler; inceleme kuyruğu için yalnız bekleyen satırları tutan kısmi dizinler (`metric_fact_versions` incelemeye hazır, `quality_issues` açık, `entity_financials` gönderilmiş).
3. **N+1:** inceleme kuyruğu her proje için ayrı yetki denetimi (`requireProjectAction`, proje başına 2–4 sorgu) yapıyordu. **Düzeltme:** `projectsAllowing`: aynı kurallar, bütün projeler ve eylemler için en fazla dört sorgu.
4. **İstek hattı:** her API isteği ve sayfa, çalışma alanını iki ayrı işlemde (üyelik listesi + kiracının MFA kuralı) denetliyordu; sayfalarda üyelikler düzen ve `requireWorkspace` tarafından iki kez okunuyordu. **Düzeltme:** `tenantActor` tek sorgu, tek işlem; üyelikler istek başına bir kez (`getMemberships`, React `cache`).

**Kalıcılık:** `src/server/portfolio/reach.db.test.ts`: aday küme her çalışma alanı (sahip, katkıcı, başka şirket, danışman sahibi ve gözden geçireni; tasarım izni ve süresi geçmiş izin dahil) için RLS'in gösterdiğinin üst kümesi ve portföy/gösterge sonucu RLS ile birebir aynı; toplu yetki denetimi `requireProjectAction` ile **bütün eylemlerde** eşdeğer; ilgisiz müşteri eklendiğinde portföy, gösterge ve kuyruk sorgu sayısı değişmiyor; tek sorguluk çalışma alanı denetimi yabancı ya da bozuk kimliğe 404, MFA isteyen kiracıya 403 veriyor ve büyük harfle yazılmış kimliği veritabanındaki biçimiyle döndürüyor (bağımsız kod incelemesinin bulgusu). Testin hata yakaladığı, aday kümeden izin kolu çıkarılarak doğrulandı.

## 6. Açık kalanlar ve kapasite notu

- **Tek web süreci ~250–260 istek/sn'de doyuyor.** CPU profili tek bir sıcak nokta göstermiyor (uygulama parçaları %17, Next.js %13, ağ yazımı ~%8; maliyet dağınık). Daha fazla eşzamanlı kullanıcı için web kopyası çoğaltılmalı (durumsuz; oturumlar veritabanında). Not: Better Auth hız sınırlayıcısı bellekte tutuluyor; birden çok kopyada ortak depoya taşınmalı.
- **Görünen satır başına RLS maliyeti.** Politika fonksiyonları kişinin gördüğü her satırda ~50–60 µs harcıyor; danışmanın 21 projesinde iş paketi sorgusu (283 satır) ~15 ms. Bu, ilgisiz müşterilerle değil danışmanın kendi portföyüyle büyür (200 müşteride tahminen ~150 ms). Çözüm yolu: politikaları, ifade başına bir kez hesaplanan kümelerle karşılaştıracak biçimde yeniden yazmak (`owner_tenant_id = any((select authz.readable_tenants()))`); güvenlik açısından kritik bir değişiklik olduğu için ADR ve tam RLS test turu ister — ayrı iş olarak önerildi.
- Veritabanı havuzu (10) bu yükte darboğaz görünmüyor (tahmin: 259 istek/sn × istek başına ~10 ms veritabanı süresi ≈ ortalama 2,6 meşgul bağlantı); havuz bekleme süresi ayrıca ölçülmedi.

## 7. UX birleştirmesinden sonra (19.10.2026 öğleden sonra)

G8-07 dalı, UX Faz 1–4 ile birlikte `main`'e birleştirildi. Yeni ekranlar her sayfada iş yapıyor: Bugün (role göre), İşlerim (tek gelen kutusu) ve her proje sayfasının üstündeki yedi adımlık çubuk. Bu yüzden profil bu ekranlarla genişletildi (§2).

**Aynı makinenin bugünkü taban çizgisi.** Dalın kendi kodu (783f0da) sabah aynı iş istasyonunda 140 istek/sn verdi. Sayfa p95 değerleri 440–501 ms'ydi ve portföy p95 529 ms ile eşiği aştı. §4'teki 244 istek/sn'lik ölçüm bundan ~1,7 kat hızlıdır. İş istasyonunda başka oturumlar ve uygulamalar çalışıyor. Bunlar ağır test koşturduğunda aynı kod 86–117 istek/sn'ye düştü; bu koşular aşağıdaki sonuçlara katılmadı. Aşağıdakiler, toplam yükün 2 çekirdeğin altında olduğu anlarda alındı.

**Birleştirmeden hemen sonra (genişletilmiş profil):**
- verim 87 istek/sn;
- API'ler eşik içinde;
- sayfa p95 değerleri 1,7–2,9 sn, altı sayfanın altısı eşiğin üstünde.

Teşhis:
- Web süreci tek çekirdeğin %99'unu kullanıyordu; veritabanı havuzunu 30'a çıkarmak sonucu değiştirmedi.
- İfade izlemesine göre bir sayfa 45–93 veritabanı gidişi yapıyordu, bir API 8–27. Her gidiş olay döngüsünde sıra bekler ve Node'a protokol ve soket işi olarak yük bindirir. Bu yüzden yük altında sayfa gecikmesi gidiş sayısıyla büyüyor.

**Düzeltmeler:**

1. **Adım sinyalleri 14 sorgudan 1'e** (`cycle/progress.ts` `signalsFor`, CTE'li tek ifade). Her proje sayfasının adım çubuğu, Bugün ve portföy bunu kullanır.
   - Doğrulama: eski ve yeni uygulama e2e veritabanının 222 döngüsünün tamamında, sistem rolüyle ve üç kişinin RLS bağlamında karşılaştırıldı. Fark sıfır.
   - `cycle/flow.db.test.ts` adım geçişlerini uçtan uca sınar.
2. **İşlem açılışı tek gidiş.** `withActor` artık `begin` ile `set_config`'i birlikte gönderir ([ADR-003 güncellemesi](../adr/ADR-003-veri-erisim-ve-migrasyon.md)). İki kimlik önce UUID biçimine karşı doğrulanır, sonra sabit olarak yazılır.
   - Yeni `db/client.db.test.ts` (5 test) şunları sınar: bağlam yalnız işlem içinde vardır; hata ya da SQL hatası durumunda geri alma yapılır ve aynı havuz bağlantısı sonraki kişiye temiz verilir; UUID olmayan kimlik reddedilir.
   - Testin hata yakaladığı, rollback geçici olarak kaldırılarak doğrulandı: iki test düştü.
3. **Proje yetki denetimi tek sorgu.** `requireProjectAction` projeyi ve kişinin çalışma alanındaki rolünü birlikte okur. Kurallar ve hata sırası aynıdır; `portfolio/reach.db.test.ts` bütün eylemlerde eşdeğerliği sınar.
4. **Paylaşılan `Intl` biçimlendiricileri** (`lib/intl.ts`). CPU profilinde hesaplamalar sayfasının en pahalı iki uygulama fonksiyonu, her değer için yeni bir `Intl.NumberFormat` kuruyordu: `factValue` ve ton biçimi, birlikte %6,4. Değer başına süre 13,2 µs'den 0,7 µs'ye indi; çıktı birebir aynı (özellik tabanlı test).
5. **Menü rozeti sayfayı bekletmiyor.** "İşlerim" sayısı sayfa çizildikten sonra `/api/v1/inbox/count` ucundan gelir; kişi başına 30 sn önbellek.
   - Proje sayfalarında dönem ve adım okumaları istek başına bir kez yapılır (`platform/cached.ts`, React `cache`).
   - Migration `0014_cycle_indexes` döngü bazlı sorgulara dizin ekler.
6. **Betik.** Kendi başlattığı sunucuyu alt süreçleriyle birlikte kapatıyor. Windows'ta kalan süreç, sonraki koşunun yeni derleme yerine eski sunucuyu ölçmesine yol açıyordu.

**Sayfa başına veritabanı gidişi** (BEGIN/COMMIT dahil, ısınmış, tek istek):

| Ekran | Birleştirme sonrası | Son |
|---|---:|---:|
| Hesaplamalar sayfası | 93 | **59** |
| Proje özeti (yedi adım) | 86 | **59** |
| Bugün, danışman (21 müşteri) | 78 | **56** |
| Bugün, şirket sahibi | 68 | **47** |
| Rapor stüdyosu sayfası | 60 | **37** |
| Bugün, katkıcı | 45 | **38** |
| İşlerim, gözden geçiren | 45 | **37** |
| `GET /api/v1/portfolio` | 27 | **13** |

**Sonuçlar (50 kullanıcı, sakin makine):**

| | G8-07 profili (`--profile g8-07`) | Genişletilmiş profil (varsayılan), iki koşu |
|---|---:|---:|
| Verim (istek/sn) | 179 | 131–134 |
| Tüm istekler p95 | 366 ms | 1 346–1 378 ms |
| API p95 (en yüksek) | 407 ms (portföy) | 210–218 ms (portföy) |
| Hesaplamalar sayfası p95 | 352 ms | **1 725–1 796 ms ✗** |
| Rapor stüdyosu sayfası p95 | 314 ms | 1 452–1 478 ms |
| Proje özeti p95 | — | 1 414–1 897 ms (bir koşuda ✗) |
| Bugün / Bugün (müşteriler) / İşlerim p95 | — | 1 134–1 266 ms |
| Hata | 0 | 0 |

- **G8-07 kapısı birleştirilmiş kodda geçiyor**, bu sabahki dal ölçümünden de iyi.
- **Genişletilmiş profilde hesaplamalar sayfası eşiği ~%15–20 aşıyor** (p50 ~1,45 sn); proje özeti eşiğin sınırında. `npm run test:load` bu yüzden 1 ile çıkıyordu. Eşik ve profil, sonucu geçirmek için değiştirilmedi. Akşam giderildi: §7.1.
- Neden: web süreci tek çekirdekte doygun ve genişletilmiş profilde isteklerin ~%31'i sunucuda üretilen sayfa (G8-07 profilinde ~%16). Doygun bir süreçte gecikme, isteğin işlemci payıyla orantılı büyür. Hesaplamalar sayfasının CPU profilinde kalan maliyet dağınık: Next.js/React işleme ~%27, uygulama kodu ~%25, soket yazımı ~%14.

### 7.1 Genişletilmiş profilin kapısı (19.10.2026 akşam)

Hedef: eşik ve profil değişmeden `npm run test:load` (varsayılan profil) geçsin. Turun başında aynı iş istasyonu daha yüklüydü: 120 istek/sn, hesaplamalar p95 1 987 ms, proje özeti 1 757 ms, rapor stüdyosu 1 941 ms (üç sayfa eşiğin üstünde).

**Teşhis:**
- **Ardışık gidiş.** pg istemcisine sunucu açılışında takılan bir izleme kancasıyla (repoda değil) sunucu boştayken tek istek izlendi. Hesaplamalar sayfasının 59 gidişinin 36'sı birbirini bekliyordu: oturum 2 → üyelikler 3 → çalışma alanı denetimi 3 → proje 5 → dönemler 4 → altı liste 6 → akış verisi 5 → başlıktaki adım çubuğu 6. Yük altında her ardışık gidiş olay döngüsünde sıra bekler.
- **Gidiş başına CPU.** Yük altındaki CPU profilinde sürenin ~%13'ü PostgreSQL'e sorgu mesajı yazımı: Windows'ta her gidiş bir soket yazma çağrısı (~45–70 µs). İstemciye yanıt yazımı ~%1. Yani her gidiş doğrudan CPU maliyetidir.
- **Bugün sayfaları veritabanını bekliyordu.** Tek uç doygunluk ölçümünde hesaplamalar ~12 ms CPU/istek ile süreci doyururken, Bugün sayfaları süreci yarım çekirdekte bırakıyordu. Neden: `listProjects` erişilebilir proje süzgeci olmadan RLS politika fonksiyonlarını veritabanındaki 222 projenin hepsinde çalıştırıyordu (çağrı başına ~63 ms). Karışık yükte bu sayfalar havuz bağlantılarını uzun tutuyordu.

**Düzeltmeler:**
1. **Hesaplamalar sayfası tek ifade** (`calc/view.ts`). Bir yetki denetiminden sonra olgular, açık bulgular, çalıştırmalar, faktör seçimleri, onaylı sınır türleri ve etkin faktör setleri tek SQL ifadesinde okunur (`json_agg … order by`, [ADR-003 notu](../adr/ADR-003-veri-erisim-ve-migrasyon.md)). Liste sorguları servislerle paylaşılan kuruculardan gelir (`factsQuery`, `runsQuery`, `choicesQuery`). Sankey verisi aynı olgu listesinden hesaplanır (`ghgFlowInput`), ayrı sorgu yok. Sayfanın yedi işlemi bire indi.
   - `calc/g4.db.test.ts`: üç rolde çıktı eski servislerle birebir; başka kiracı ve projeye ait olmayan döngü 404. Sıralama geçici olarak bozulunca test düştü.
   - `lib/visual/layout.test.ts`: `ghgFlowInput` eski SQL kuralına karşı özellik tabanlı test.
2. **Ortak proje sayfası yolu.**
   - `loadProject` dönemleri ve adım çubuğunu projeyle paralel başlatır (`?cycle=` dahil).
   - Proje, kişinin rolü ve paylaşımlar tek ifade. Erişim kuralları `requireProjectAction` ile ortak (`projectAccess`).
   - Adım çubuğunda döngü ve erişim tek ifade; iş paketleri sinyal ifadesinin içinde. e2e veritabanının 222 döngüsünde ve 1 554 adımında eski okumayla fark sıfır.
3. **Her sayfa.**
   - Çalışma alanı denetimi, istekte zaten okunan üyelik listesinden kurulur (`actorOf`). Kural ve MFA kuralı `tenantActor` ile aynıdır (`portfolio/reach.db.test.ts`).
   - Üyelikler ve menüdeki okunmamış bildirim sayısı tek ifade (`personContext`).
   - Oturum ve kullanıcı tek JOIN ile okunur (Better Auth `advanced.database.joins`, [ADR-004 notu](../adr/ADR-004-kimlik-dogrulama.md)).
4. **Bugün.** `listProjects` erişilebilir projelerle daraltıldı; RLS kararı aynı (tenancy testleri). Çağrı ~63 ms'den ~5 ms'ye indi.
5. **İşlerim.** Dört okuma paralel; karar okuması diğer üçünü beklemiyor.

**Sayfa başına veritabanı gidişi** (BEGIN/COMMIT dahil, ısınmış, tek istek) **ve kritik yol** (birbirini beklemek zorunda olan gidiş zinciri):

| Ekran | Birleştirme sonrası | Öğle | Son | Kritik yol, önce → son |
|---|---:|---:|---:|---:|
| Hesaplamalar sayfası | 93 | 59 | **19** | 36 → **13** |
| Proje özeti (yedi adım) | 86 | 59 | **48** | 36 → **19** |
| Bugün, danışman (21 müşteri) | 78 | 56 | **49** | 37 → **22** |
| Bugün, şirket sahibi | 68 | 47 | **40** | 29 → **15** |
| Rapor stüdyosu sayfası | 60 | 37 | **26** | 34 → **18** |
| Bugün, katkıcı | 45 | 38 | **31** | 27 → **16** |
| İşlerim, gözden geçiren | 45 | 37 | **30** | 24 → **15** |

İstek hattı (oturum + çalışma alanı denetimi) 3 ifadeden 2'ye indi (`npm run load:profile`).

**Sonuçlar** (50 kullanıcı, sakin makine, son derleme, taze `e2e:prepare`):

| | G8-07 profili (`--profile g8-07`) | Genişletilmiş profil (varsayılan), iki ardışık koşu |
|---|---:|---:|
| Verim (istek/sn) | 212 (öğlen 179) | 164–167 (öğlen 131–134) |
| Tüm istekler p95 | 337 ms | 980–999 ms |
| API p95 (en yüksek) | 378 ms (portföy) | 186–189 ms (portföy) |
| Hesaplamalar sayfası p95 | 143 ms | **1 087–1 096 ms ✓** |
| Rapor stüdyosu sayfası p95 | 167 ms | 1 114–1 126 ms ✓ |
| Proje özeti p95 | — | 1 119–1 136 ms ✓ |
| Bugün / Bugün (müşteriler) / İşlerim p95 | — | 754–851 ms ✓ |
| Hata | 0 | 0 |

- **Genişletilmiş profil iki ardışık koşuda geçti** (`npm run test:load` 0 ile çıktı). Eşik ve profil değişmedi. En yakın sayfa (proje özeti) eşiğin ~%24 altında.
- G8-07 profili de geçiyor; öğlenki ölçümden daha hızlı.
- İkinci web süreci gerekmedi; ADR yazılmadı ve dağıtım değişmedi.

**Gözlemler ve açık işler:**
- Soket yazımının pahalı olması Windows'a özgü; Linux konteynerinde gidiş başına CPU daha düşük olmalı (ölçülmedi).
- Kalan en uzun tek ifade adım sinyalleri: tek döngüde ~10–14 ms, 21 döngüde ~40 ms veritabanı süresi. Planda maliyet RLS politika fonksiyonlarının satır başına çalışması (ör. 42 veri talebinde 14 ms). G8-07'de önerilen RLS yeniden yazımı bunu düşürür.
- API isteğinde çalışma alanı denetimi hâlâ ayrı bir işlem (3 gidiş). Sayfa yolundaki gibi tek ifadeye indirilebilir. G8-07 profilinde API'ler sayfalardan yavaş (p50 230–290 ms).
- Better Auth kendi havuzunu kullanır (5 bağlantı); bu turda darboğaz olarak ölçülmedi.

## 8. Çalıştırma

```bash
npm run e2e:prepare
npm run build
npm run test:load
```

Varsayılan 50 kullanıcı, 10 sn ısınma, 60 sn ölçüm, genişletilmiş profil. Bunlar `npm run test:load -- --users 100 --duration 45` ile değiştirilir; G8-07'nin ilk turunu yinelemek için `-- --profile g8-07` verilir.

Betik:
- 3211'de sunucu yoksa kendisi başlatır ve sonunda alt süreçleriyle birlikte kapatır;
- açık bir sunucu bulursa onu kullanır ve bunu yazar (yeni bir derlemeyi ölçmek için önce o sunucuyu durdurun);
- uç nokta başına p50/p95/p99 tablosunu yazar, ham sonuçları profil adıyla `scripts/load/results/` altına (git dışı) kaydeder;
- eşik aşılırsa 1 ile çıkar.

Ölçümü iş istasyonu sakinken alın: başka bir oturumun test koşusu verimi %10–35 düşürebiliyor (§7).

Sorgu profili: sunucu açıkken (`npm run e2e:server`) `npm run load:profile -- --explain`. Profil artık adım çubuğunu, Bugün'ü, İşlerim'i, her sayfanın kişi bağlamını, proje okumasını ve hesaplamalar sayfasının tek ifadesini de kapsar.
