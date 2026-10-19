# ISOLINE ERP — Uygulama durumu (G0–G8)

**Kaynak plan:** [plan/](plan/README.md) (ISOLINE_ERP_2026_Master_Plan v1.0, MANIFEST özetleri doğrulandı) · **Karar kayıtları:** [adr/](adr/) · **G0 çıktıları:** [G0/](G0/)

**Durum değerleri:** `bitti` · `kısmi` · `engelli` · `başlamadı`. Plan kuralı gereği "bitti" demek için çalışan akış, kullanıcı yetkisi, kaynak kanıtı ve otomatik test birlikte gösterilmeli; karşılanmayan kısım `kısmi` olarak kalır.

**Ürün sahibi talimatı (19.10.2026):** Soru sormadan, sektördeki yerleşik çözümlerle bütün yol haritasını uygula; burada commit'le; GitHub'a gönderim en sona kalsın. Bu talimat G0 onayı olarak kayıtlıdır.

## Özet

| Kapı | Durum | Not |
|---|---|---|
| G0 | bitti | Envanter, 11 ADR, ekran haritası, göç riski, iki yolculuk, tehdit modeli |
| G1 | bitti | Kimlik, kiracı, RLS, dış erişim izni, kanıt deposu, denetim+outbox, araç seti aktarımı; 34 entegrasyon testi |
| G2 | bitti | Organizasyon ağacı ve tarihli sahiplik, beş tür raporlama sınırı, iş/teslimat, dönem, uygulanabilirlik kararı ve müşteri onayı, ekip/RACI, 13 kapılı plan ve kritik yol, portföy |
| G3 | bitti | Sürümlü metrik kataloğu, şablondan kampanya üreteci, kişi+tesis kapsamlı atama, 4 adımlı katılımcı formu, iade/yeniden gönderim, sürümlü gözlemler, kanıt bağlantıları, XLSX/CSV içe aktarma, hatırlatmalar, tedarikçi izni |
| G4 | bitti | Sürümlü faktör sicili ve lisans, idempotent hesap çalışmaları (girdi/faktör/çıktı özetleri), çok tesisli Kapsam 1/2/3, çevre/işgücü/finans/SKDM/ETS sarmalayıcıları, engelleyici/uyarı kalite kuralları, dört göz onayı, metrik sürümleri ve kaynak izi, yeniden üretim |
| G5 | bitti | Dönem içi gün ağırlıklı sınır, GHG yaklaşımları yan yana, TFRS 10 hasılat konsolidasyonu ve grup içi eliminasyon (kesin kuruş aritmetiği), U1–U10 mutabakat, kişiye bağlı inceleme kuyruğu, kapanış kontrol listesi, değişmez anlık görüntü, gerekçeli yeniden açma ve yeniden düzenleme listesi |
| G6 | bitti | Şablondan rapor ve bölümler, metrik belirteçli sürümlü metin, kapsama, tek biçimle DOCX/CSV/XLSX/SVG, teknik → müşteri → yönetim onayı (aday özetine bağlı), değişmez yayın paketi ve devir ZIP'i, tasarım ajansı yalnız yayını görür, ek yayın, raporlar arası mutabakat, yeşil iddia engeli |
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

## G2 — Şirket, organizasyon, proje, dönem

| ID | Durum | Kanıt |
|---|---|---|
| G2-01 | bitti | `0004_org_projects`: `organizations`, `legal_entities` (tek raporlayan ana şirket), `facilities` (işletme ve SKDM işaretli). Ekran `app/organization` (+ tüzel kişi, tesis sayfaları). `g2.db.test.ts`: holding + iki iştirak + üç tesis; katılımcı ağacı değiştiremez |
| G2-02 | bitti | `ownership_edges`: pay, kontrol türü, geçerlilik aralığı; aynı çift için çakışan dönem veritabanında yasak (`EXCLUDE USING gist`), döngü ve %100'ü aşan pay serviste reddedilir. "Şu tarih itibarıyla" görünümü. Test: Temmuz'daki %40 satış Mart görünümünü değiştirmez, yıl sonunda %60 |
| G2-03 | bitti | `reporting_boundaries` + `boundary_members`: operasyonel kontrol, finansal kontrol, hisse oranı (GHG Protokolü Bölüm 3 tablo 1), finansal raporlama (UFRS 10) ve SKDM. Öneri dönem sonundaki ağaçtan (`orgs/boundary.ts`, 9 birim + özellik testi); öneriden sapma gerekçe ister (DB CHECK); onaylanan sınır değişmez, yeni revizyon onaylanınca eskisi `superseded` |
| G2-04 | bitti | `engagements` + `deliverables`: bir iş, birden çok rapor; durum makinesi; danışman kendi adının geçtiği işi görür ama değiştiremez. Ekran `app/engagements` |
| G2-05 | bitti | `reporting_cycles`: aynı projede dönemler çakışamaz (`EXCLUDE`); proje sihirbazı (`app/projects/new`) proje + dönem + plan + proje liderini tek işlemde açar. Test: 2025 ve 2026, çakışan dönem 409 |
| G2-06 | bitti | `framework_versions` (19 resmî sürüm kaydı, yürürlük durumu ve kaynakları) + `applicability_assessments`: v1 kural motoru öneri üretir (motor sürümü + girdi özeti saklanır); karar adı geçen kişiyle ve en az 10 karakterlik gerekçeyle; danışman kararı müşteri yetkilisinin onayını bekler. Ekran `app/projects/[id]/scope` |
| G2-07 | bitti | `project_participants`: RACI rolleri; dış kişi yalnız etkin izinle ve iznin türüne uygun rolle (ör. yönetim imzası yalnız kurum içi). Ekran `app/projects/[id]/participants` |
| G2-08 | bitti | `work_packages` + `work_package_deps`: plan 05'in 13 kontrol kapısı, veri toplama dönem sonu + 30 günden önce bitmez, kritik yol (`projects/plan.ts`, özellik testi), durum makinesi, bağımlılık açıkken başlatma yasağı, döngü yasağı, If-Match. Ekran `app/projects/[id]/plan` (zaman çizelgesi + tablo karşılığı) |
| G2-09 | bitti | `app/portfolio`: yalnız yetkili projeler (kendi, geçici müşteri, izinli); dönem, sıradaki paket, geciken/kritik/engelli sayıları; puan ya da sıralama yok |

**G2 kapısı:** `g2.db.test.ts` iki yolu aynı omurgada sınar. Şirket başlatır, danışmana proje izni verir, proje, dönem ve sınırı belirler. Danışman başlatır (geçici müşteri, organizasyon, proje, sınır), müşteri sahiplenir; danışman aynı satırlara artık izinle erişir. İzin iptal edilince danışmanın görünümü kapanır, karar geçmişi müşteride kalır.

**Araç seti aktarımı G2'ye bağlandı:** her müşteri için "eşlenmemiş" organizasyon, ana tüzel kişi, v1 tesis kayıtları (pay < %100 olanlar ortaklık kenarıyla) ve raporlama yılının dönemi ve planı oluşur. Kullanıcı yapıyı doğrulayınca işaret kalkar.

## G3 — DataOps, görev kampanyası, kanıt

| ID | Durum | Kanıt |
|---|---|---|
| G3-01 | bitti | `core.metric_definitions` (kod + sürüm, yalnız eklenir): 39 veri noktası; boyut ve birimler, toplama türü (toplam / dönem sonu / ortalama), tesis ya da kurum düzeyi, kanıt zorunluluğu, kişisel veri işareti. `data/catalog.ts`, `catalog-sync.ts` (anlamı değişen tanım yeni sürüm ister), `catalog.test.ts`. Birimler `data/units.ts`: BigInt rasyonel kesin dönüşüm, Türkçe sayı biçimi, özellik testleri |
| G3-02 | bitti | Kampanya üreteci v1 şablon motorunu kullanır; onaylı uygulanabilirlik kararlarından şablon önerir. Aynı veri kalemi iki rapora gerekiyorsa tek talep, iki iz. Yeniden çalıştırmada yalnız eksik talepler eklenir. `g3.db.test.ts` |
| G3-03 | bitti | Atama: atanan ve gözden geçiren ekipte uygun rolde, birbirinden farklı (DB CHECK), katılımcının tesis kapsamı dışında atama yok. Satır düzeyi görünürlük: katılımcı yalnız kendi görevlerini görür (UAT-07 testi) |
| G3-04 | bitti | `app/tasks/[id]`: Ne isteniyor → Değer → Kanıt → Gönder. Birim boyutu, negatif değer, çok satırlı yakıt kalemleri sunucuda denetlenir |
| G3-05 | bitti | `app/projects/[id]/data/[kampanya]`: XLSX şablon indirme, dosya önce taranır, kanıt olarak saklanır, satır bazlı hata listesi (`import-parse.ts` + özellik testi), işleme tek işlemde, aynı dosya ikinci kez işlenmez, gözden geçirilmeden geri alınabilir |
| G3-06 | bitti | `core.evidence_links`: talebe dosya bağlama/çözme; kanıt isteyen kalem kanıtsız gönderilemez |
| G3-07 | bitti | `core.observation_versions`: her gönderim yeni sürüm; eski satır korunur (iade edilen `rejected`, yenisi `accepted`); karar veren ile giren aynı kişi olamaz (DB CHECK) |
| G3-08 | bitti | Outbox `notify` işleyicisi (uygulama içi bildirim + e-posta bağlantısı), günlük hatırlatma taraması (T−7, yalnız kritikte T−2, T+1 lider özeti); kural kampanya bazında düzenlenir; tekrar taramada aynı hatırlatma ikinci kez kuyruğa girmez |
| G3-09 | bitti | İade gerekçesi zorunlu (≥ 10 karakter), yazışma akışı, toplu atama/gönderim, "uygulanmaz" gerekçeli kapanış |
| G3-10 | bitti (iskelet) | `supplier` izin rolü: tedarikçi yalnız kendisine atanan talebi görür, yanıtlar ve kanıt yükler; başka talep 404. Ayrı tedarikçi portal tasarımı G8-02'de |

**G3 kapısı:** `g3.db.test.ts` — 3 kişi (Zeynep Gebze, Kemal Dilovası, Mehmet veri sahibi), 2 tesis, iki veri türü (sera gazı ve enerji/finans), bir iade ve yeniden gönderim, kaynak belge, dosyadan içe aktarma, hatırlatma ve tedarikçi yalıtımı gerçek PostgreSQL ve SeaweedFS ile.

## G4 — Hesap ve kalite katmanı

| ID | Durum | Kanıt |
|---|---|---|
| G4-01 | bitti | `core.factor_sets` / `factor_values` (migration 0006): yerleşik setler (IPCC 2006, ETKB 2020–2023, AR6 GWP, TÜİK NIR 2026, DESNZ 2026, EEA, AB SKDM varsayılanları) yayıncı, lisans, yayın yılı ve içerik SHA-256 özetiyle; değişen değer yeni satır. Kurumun kendi seti CSV ile, lisanslı veri yalnız hak onayıyla (DB CHECK). Çözümleme `calc/factors.ts` `resolveFactors`: proje seçimi önce; yoksa raporlama yılının ETKB yayını, yoksa önceki son yayın + `factor_edition_fallback` bulgusu; kapsam 3 için sessiz varsayılan yok. Ekran: `app/factors` (DATA-19), proje seçimleri `projects/[id]/calculations` |
| G4-02 | bitti | `calc/service.ts` `runCalculation`: onaylı sınır + yalnız kabul edilmiş gözlem sürümleri; girdi özeti (açık talepler dahil), faktör özeti (hedefe göre sıralı), motor sürümü (`ISOLINE_BUILD_SHA` ile commit'e bağlanır); aynı özetler aynı çalışmayı döndürür (benzersiz indeks). `run_inputs`: gözlem sürümü, kanıt dosyası ve faktör değeri satırları |
| G4-03 | bitti | `calc/ghg-engine.ts`: araç setinin `computeInventory` motoru değiştirilmeden tesis başına çalışır, sınır payıyla ölçeklenir; lokasyon ve piyasa bazlı kapsam 2 ayrı, sertifikalar tüketime oranla dağıtılır, Türkiye için kalıntı karışımı yok uyarısı (Scope 2 Guidance), yurt dışı tesiste EEA ülke faktörü, soğutucularda çözümlenen GWP. Eşdeğerlik ve özellik testleri `ghg-engine.test.ts` (v1 ile 200 rastgele vaka, doğrusal ölçek, sertifika sınırı) |
| G4-04 | bitti | `calc/engines.ts`: enerji/yenilenebilir/su/atık ve yoğunluk; çalışan sayısı, eğitim, LTIFR; 5 kişiden küçük grupta kadın oranı gizlenir (KVKK md. 6). Her metrik çalışmaya, çalışma gözlem sürümüne ve kanıta bağlı |
| G4-05 | bitti | Finans: kabul edilmiş mizan dosyası (kanıt deposu, SHA-256 doğrulamalı) araç setinin TDHP okuyucusuyla okunur; net satış 600–602 eksi 610–612; yıl uyuşmazlığı ve dengesiz mizan engelleyici, beyan edilen tutarla %0,5 üstü fark uyarı. Yeniden üretim dosyanın kendisinden yapılır |
| G4-06 | bitti | SKDM: Ek I kapsam kontrolü (GTİP), doğrulanmış gerçek SEE yoksa menşe ülke tablosundan AB varsayılan değeri + yılın ek oranı (2026/1740), bulgu olarak işaretlenir. TR-ETS: tesis başına İklim Kanunu kategorisi, pay ile ölçeklenmez |
| G4-07 | bitti | Kalite kuralları (`RULE_VERSION`): engelleyici (faktör yok, kabul edilmemiş girdi, mükerrer girdi, mizan yılı/dengesi, imkânsız değerler) ve uyarı (yayın geri düşüşü, yoğunluk varsayımı, kalıntı karışımı, %20 üstü tahmini pay, yıllık %30 üstü değişim, mizan farkı). Engelleyici elle kapanmaz, girdi düzeltilip yeniden hesaplanır; uyarı başka bir kişi tarafından gerekçeyle (≥ 10 karakter) açıklanır ya da istisna kabul edilir |
| G4-08 | bitti | `core.metric_fact_versions`: her sonuç yeni revizyon; engel varken `validating`, yoksa `ready_for_review`; onay hesabı çalıştırandan başka biri tarafından ve açık bulgu yokken; onaylı revizyon yenisi onaylanana dek geçerli. Kaynak izi ekranı `app/facts/[id]` (DATA-20): çalışma → gözlem sürümleri (giren/kabul eden) → kanıt dosyaları → faktörler (yayıncı, yayın, lisans, özet) → revizyon geçmişi |
| G4-09 | bitti | 20 birim/özellik testi (`ghg-engine.test.ts`, `engines.test.ts`) ve araç setinin mevcut testleri değişmeden geçiyor; DB kapı testi `g4.db.test.ts` |

**G4 kapısı:** `g4.db.test.ts` — iki tesisli (iletim/dağıtım bağlantılı) şirket, onaylı operasyonel kontrol sınırı, kabul edilmiş yakıt/elektrik/soğutucu/sertifika verisi ve mizan dosyası. Emisyon metriği (Kapsam 2 lokasyon bazlı = 8 000 MWh × ETKB 2023 iletim + 2 000 MWh × dağıtım) ve finans metriği (net satış 1 237 500 000 TL, mizandan) `reproduceRun` ile kayıtlı gözlem sürümleri, faktör değerleri ve dosya baytlarından yeniden üretildi; köken kaydı faktörün set kodunu, yayın yılını, lisansını, yayıncısını ve içerik özetini gösteriyor. Aynı girdiyle ikinci çalışma aynı kaydı döndürüyor; proje faktör seçimi (TÜİK) yeni çalışma ve yeni revizyon açıyor, onaylı revizyon yerinde kalıyor. Tarayıcıda: Selin hesapladı, Mehmet'in toplu onayı açık bulgu varken reddedildi, üç uyarı gerekçeyle kabul edildi, 17 metrik onaylandı, yeniden üretim aynı çıktıyı verdi.

**Bu kapıda verilen ek kararlar:**
- Kurum sahibi (`owner`) rolü veri inceleme, hesaplama ve kalite inceleme yetkisi aldı (küçük şirkette işi sahibi yürütür); dört göz kuralı nesne bazında zorunlu kalır. Atamada gözden geçirenin üyelik rolü incelemeye izin vermiyorsa atama reddedilir (`reviewer_cannot_review`); G3 demosunda kabul edilemeyen görev hatası böylece kapandı.
- Tesislere şebeke bağlantı noktası (iletim/dağıtım) alanı eklendi; ETKB tüketim noktası faktörü buna göre seçilir.
- Taranmakta olan bir dosya yalnız yükleyene görünür (G1 kuralı); demo verisi bu yüzden dosyaları hesaptan önce tarar.

**Açık risk:** Sayı girişinde tek ayırıcı ondalık sayılır (v1 kuralı, "900.000" = 900). Türkçe kullanıcı binlik ayırıcı niyetiyle yazabilir; G8 form turunda belirsiz biçim (tek ayırıcı + tam üç hane) için onay uyarısı eklenecek.

## G5 — Konsolidasyon, kontroller, kapanış

| ID | Durum | Kanıt |
|---|---|---|
| G5-01 | bitti | `orgs/boundary.ts` `suggestBoundaryOverPeriod`: dönem, varlık/ortaklık/tesis geçerlilik tarihlerinde dilimlenir, her üyenin payı gün ağırlıklı ortalamadır (GHG Protocol bölüm 5; plan 09 §8 örneği testte). Değişen üye `time_weighted` olarak işaretlenir. Operasyonel kontrol, finansal kontrol ve özkaynak payı ayrı sınır ve ayrı hesap; `projects/[id]/consolidation` (CTRL-08) yan yana gösterir. G2'nin dönem sonu yaklaşımı bu kapıda düzeltildi (G2 testi güncellendi) |
| G5-02 | bitti | `close/consolidation.ts`: TFRS/IFRS 10 hasılat konsolidasyonu sera gazı kodundan ayrı; bağlı ortaklık %100, özkaynak yöntemi dışarıda, grup içi satış eliminasyonu (B86), dönemin bir kısmında kontrol uyarısı; tutarlar BigInt kuruş. Girdiler `core.entity_financials` ve `core.intercompany_eliminations` (migration 0007): giren ile onaylayan farklı (DB CHECK). Özellik testi: konsolide = Σ hasılat − Σ iç eliminasyon, kuruşu kuruşuna |
| G5-03 | bitti | `close/reconcile.ts`: araç setinin U1–U10 katalogu sunucuda, aynı önem dereceleriyle (hata = engelleyici). U1 hasılat, U2 enerji, U3 çalışan, U4 SKDM ihracat ≤ üretim, U5 ETS ≤ kapsam 1; U8/U9 her hesapta; U6/U7/U10 rapor metniyle G6'da. Veri yoksa "uygulanmadı", asla sessiz "uyumlu" değil. Ekran `projects/[id]/controls` (CTRL-05) |
| G5-04 | bitti | Bulgular `projects/[id]/controls` (CTRL-04): açık ve değerlendirilmiş bulgular ayrı; uyarıyı hesabı çalıştıran kapatamaz, gerekçe ≥ 10 karakter, denetim kaydı; dondurulmuş dönemde değerlendirme yapılamaz |
| G5-05 | bitti | `app/review` (CTRL-06): kişinin kararını bekleyen veri talepleri, onay bekleyen metrikler (önceki değerle yan yana, CTRL-07 farkı), uyarılar ve hasılat tutarları; kendi işi görünmez, rol ve izin proje bazında yeniden denetlenir |
| G5-06 | bitti | `core.cycle_snapshots` + `snapshot_facts`: dondurmada onaylı güncel metrikler içerik SHA-256 özetiyle kopyalanır, metrikler `locked` olur; kilitli metrik tetikleyiciyle değişmez; uygulama rolünün anlık görüntü satırlarını güncelleme/silme yetkisi yok. Yeniden açma gerekçeli (≥ 20 karakter), kabul edilmiş talep gerekçeyle katkı verene geri gönderilir, yeni dondurma önceki sürüme göre yeniden düzenlenen metrikleri listeler |
| G5-07 | bitti | `projects/[id]/close` (CTRL-09): talepler kapalı, GHG sınırı onaylı, metrikler var ve onaylı, açık engelleyici yok, uyarılar değerlendirilmiş, mutabakat son hesaptan sonra, çok şirketli grupta hasılat konsolide; her eksik madde nedeniyle görünür, dondurma sunucuda yeniden denetlenir. Dondurulmuş dönemde veri girişi, hesap, onay ve bulgu kararı 409 döner |

**G5 kapısı:** `g5.db.test.ts` — iki bağlı ortaklık (birinde 1 Temmuz'da %40 satış) ve iki tesis, 2025 ve 2026 dönemleri. Operasyonel kontrol ile özkaynak payı farklı ve gerekçeli sonuç veriyor (özkaynak: (100×181 + 60×184)/365); hasılat 1 700 000,25 TL olarak kesin konsolide ediliyor (eliminasyon dahil); 2025 donduruluyor, kilitli metrik veritabanı düzeyinde değişmiyor; gerekçeyle yeniden açılıp Gebze elektriği düzeltiliyor, yeniden hesaplanıp onaylanıyor, ikinci dondurma yeniden düzenlemeyi listeliyor; **birinci anlık görüntü aynı satırlar, aynı değerler ve aynı özetle duruyor.** Tarayıcıda: Ayşe'nin inceleme kuyruğu, konsolidasyon onayları ve 1 382 500 000 TL sonucu, mutabakat ve kapanış listesi doğrulandı.

**Bu kapıda verilen ek kararlar:**
- Dondurulmuş/yayımlanmış dönemde veri servisleri (taslak, gönderim, kabul, kapatma) de `cycle_frozen` döner.
- Kapanış durumları: `frozen` → (gerekçe) → `reopened` → yeni dondurma; eski anlık görüntü `superseded` olur ama içeriği değişmez.

**Ortam notu:** Bu makinede Turbopack dev sunucusu bazı sunucu modülü değişikliklerini kaçırabiliyor (eski modül → hidrasyon farkı ya da "is not a function"). Sunucu kodu değiştikten sonra tarayıcı denetiminden önce dev sunucusu yeniden başlatılır; üretim derlemesi etkilenmez.

## G6 — Rapor stüdyosu ve yayın

| ID | Durum | Kanıt |
|---|---|---|
| G6-01 | bitti | `core.reports` / `report_sections` (migration 0008): rapor türü ve bölüm ana hattı araç setinin şablon kütüphanesinden (TSRS, GRI, ESRS, faaliyet raporu, SKDM…); aynı dönemden birden çok rapor. Ekran `projects/[id]/reports` (REP-01) |
| G6-02 | bitti | `reports/body.ts`: güvenli işaretleme (başlık, paragraf, madde, kaynak notu, `[[table:ghg]]`, `[[chart:ghg_scopes]]`); rakam metne yazılmaz, `{{ghg.scope1}}` belirteci kayıtta bir metrik sürümüne bağlanır (`core.metric_references`). Bağlanamayan belirteçle gönderim yok; iyimser kilit (`baseVersion`). Stüdyo `reports/[id]` (REP-02..04): ana hat, metin, bağlı/kullanılabilir metrikler |
| G6-03 | bitti | Bölüm başına standart atıfları ve karşılandı/kısmi/bekliyor kapsaması; açıklama indeksi taslağı yayın paketinde (`disclosure-index-draft.csv`); sayfa numarası mizanpajdan sonra |
| G6-04 | bitti | `reports/render.ts`: DOCX, CSV, XLSX, SVG ve ekran aynı biçimleme işlevini kullanır (tr 1.234,5 · en 1,234.5); özellik testi grafik ve CSV'nin belgeyle aynı metni bastığını doğrular; SVG başlık/açıklama (erişilebilir) |
| G6-05 | bitti | Bölüm onayı yazardan başkası (DB CHECK); rapor zinciri teknik inceleme → müşteri incelemesi → yönetim imzası, her onay aday özetine bağlı; aday değişirse zincir baştan; müşteri ve imza yalnız sahip şirket üyesi (izin hiçbir zaman imzalamaz), imza `report.release` ister |
| G6-06 | bitti | Yayın paketi: `content.docx`, `tables/facts.csv|xlsx`, `charts/ghg_scopes.svg`, `disclosure-index-draft.csv`, `review-notes.md`, `asset-manifest.json` (anlık görüntü özeti, bölüm sürümleri, metrik kimlikleri, varlık SHA-256'ları) ve `handoff.zip` (`reports/zip.ts`, CRC-32 testli); dosyalar nesne deposunda, indirme denetim kaydıyla |
| G6-07 | bitti | `design` izni: `authz.can_read` artık bu izni saymaz, yayın tabloları `authz.can_read_release` kullanır — ajans proje verisini veritabanı düzeyinde göremez; `app/handoff` ve `app/releases/[id]` üzerinden paket ve prova (PDF, ClamAV taraması); müşteri provayı onaylar ya da gerekçeyle değişiklik ister |
| G6-08 | bitti | Yayın: dondurulmuş dönem, imzalı aday, tüm referanslar anlık görüntüde ve güncel, engelleyici yeşil iddia yok (U10: dengeleme/gelecek iddiaları engeller, genel/mutlak iddialar notlara). Yayın değişmez; düzeltme ≥ 20 karakter gerekçeli ek yayın, eskisi `superseded` ama içeriği ve özetleri aynı |
| G6-09 | bitti | `crossReportCheck`: aynı metrik iki raporda farklı sürüme bağlıysa işaretlenir; rapor listesinde görünür |

**G6 kapısı:** `g6.db.test.ts` — şirket elektrik verisini yükler ve hesaplar; iki rapor (TSRS önce iklim, GRI İngilizce); danışman (hazırlayıcı izniyle) bütün bölümleri yazar, proje lideri onaylar; teknik → müşteri → yönetim imzası; yayın paketi 8 dosya, rakam DOCX/CSV/SVG'de aynı; tasarım ajansı proje verisini göremez (404), yalnız yayını görür ve prova yükler; GRI'deki "carbon neutral" iddiası yayını durdurur; kaynak sonradan düzeltilince referans eskir, ek yayın gerekçesiz reddedilir, gerekçeyle sürüm 2 çıkar — **sürüm 1'in manifest özeti ve tüm dosya özetleri değişmez.** Tarayıcıda demo raporunun stüdyosu ve bağlı metrikleri doğrulandı.

## G7–G8

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
- **Açık / sıradaki:** G7 (20 müşterili portföy panosu, dış uzman daveti, güvence odası, sektör paketi çerçevesi, metal/çimento ve hizmet/lojistik pilot paketleri).
