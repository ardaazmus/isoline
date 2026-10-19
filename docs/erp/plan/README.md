# ISOLINE — Kurumsal Raporlama Operasyon Platformu / Master Geliştirme Paketi

**Sürüm:** 1.0 · **Araştırma/kapsam tarihi:** 19 Ekim 2026 · **Dil:** Türkçe · **Veritabanı:** **PostgreSQL zorunlu**

## Ürün hedefi

ISOLINE; sürdürülebilirlik danışmanlığı firmalarının, rapor hazırlama ajanslarının ve kendi raporlarını hazırlayan şirketlerin **aynı veri omurgasında ama ayrı ve güvenli çalışma alanlarında** TSRS, GRI, ESRS, faaliyet/entegre rapor ve ilişkili karbon, su, atık, sosyal/finansal hesaplamaları yürüttükleri **çok kiracılı raporlama operasyon platformudur**.

Bir müşteri, kendi veri toplama/hesaplama sürecini yürütüp başka bir danışmanlık kuruluşunu **belirli proje, dönem, belge veya inceleme paketi** için davet edebilmelidir. Danışmanlık kuruluşu da müşteri portföyündeki işleri yönetebilmeli fakat **müşterinin ana verisi danışmana ait olmamalıdır**. Dış güvence ayrı yasal hizmettir; platform denetçi yetkisi yaratmaz veya güvence görüşü vermez.

## Paket içeriği ve okuma sırası

**Geliştirme ortamına ilk verilecek dosya:** [Geliştiriciye devir talimatı](00_GELISTIRICIYE_DEVIR_TALIMATI.md).

| Sıra | Dosya | Ne için? |
|---|---|---|
| 01 | [Ürün stratejisi / PRD](docs/01_URUN_STRATEJISI_VE_PRD.md) | Ürün konumu, kullanıcılar, sınırlar, başarı koşulları |
| 02 | [Sektörel danışmanlık işletim modeli](docs/02_DANISMANLIK_IS_MODELİ_VE_SERVIS_KATALOGU.md) | Proje türleri, hizmet şablonları, iş teslimi |
| 03 | [Tenant, kurum, erişim, devretme](docs/03_TENANT_KURUM_VE_YETKI_MIMARISI.md) | Kesin çok kiracılı mimari ve güvenlik kararı |
| 04 | [Ekran envanteri ve bilgi mimarisi](docs/04_EKRAN_KATALOGU_GIRIS_ONBOARDING_NAVIGASYON.md) | Giriş/kayıt/davet, tüm ana sayfalar ve ekran durumları |
| 05 | [Uçtan uca iş akışları](docs/05_IS_AKISLARI_RACI_STATE_MACHINES.md) | Danışman-şirket-güvence akışı, görev/onay kapıları |
| 06 | [PostgreSQL tasarımı](docs/06_POSTGRESQL_VERI_MODELI_RLS_VE_MIGRASYON.md) | Kanonik model, RLS, migration, veri güvenliği |
| 07 | [Standartlar ve mevzuat](docs/07_RAPORLAMA_STANDARTLARI_MEVZUAT_MOTORU.md) | TSRS/ISSB, GRI, ESRS/CSRD, faaliyet, CBAM, standart sürümleri |
| 08 | [Sektörel çözüm paketleri](docs/08_SEKTOREL_MODULLER_VE_VERI_KATALOGU.md) | 17+ sektör/grup, sektör veri kalemleri ve kontrol kuralları |
| 09 | [Hesaplama, veri, kanıt ve kalite](docs/09_HESAPLAMA_KANIT_KONSOLIDASYON_DOGRULAMA.md) | Hesap motorlarıyla entegrasyon, lineage, konsolidasyon |
| 10 | [Rapor stüdyosu ve yayın](docs/10_RAPOR_STUDYOSU_TASARIM_DEVRI_GUVENCE.md) | Rapor metni, sürüm, Word/Excel, tasarım teslimi, bağımsız inceleme |
| 11 | [UI/UX ve hareket sistemi](docs/11_UI_UX_AYDINLIK_ANIMASYON_IZOMETRIK.md) | Aydınlık ciddi tasarım, grafikleri nerede kullanmalı |
| 12 | [Servis mimarisi, API ve güvenlik](docs/12_TEKNOLOJI_API_ENTEGRASYON_GUVENLIK.md) | Next.js/TS, PostgreSQL, auth, object storage, entegrasyon |
| 13 | [Uygulama yol haritası](docs/13_AYRINTILI_YOL_HARITASI_BACKLOG.md) | G0-G8 kapılı fazlar; backlog ve acceptance |
| 14 | [QA / kabul / senaryolar](docs/14_TEST_KABUL_KRITERLERI_VE_KPI.md) | Tenant izolasyonu, onay, muhasebe, rapor, NFR |
| 15 | [Doğrulanmış araştırma ve kaynak sicili](docs/15_SEKTOR_KARSILASTIRMASI_KAYNAK_SICILI.md) | Üretici ve resmî kurumsal kaynaklar, tarih ve statü |
| SQL | [PostgreSQL başlangıç DDL](sql/001_core_schema_proposal.sql) | Taslak şema / geliştirmeye başlangıç (çalışma ve güvenlik incelemesi gerekir) |
| Template | [Geliştirme görev şablonu](templates/ISSUE_SABLONU.md) | Agent veya mühendis için verifiable görev |
| QA | [Uçtan uca senaryolar](qa/SCENARIOS.md) | Smoke/UAT güvenlik ve veri senaryoları |

**Tek dosya alternatif:** [Tüm bölümler bir arada](ISOLINE_ERP_TUM_PLAN_TEK_DOSYA.md).

## Geliştirme ekiplerine kesin direktifler

1. **PostgreSQL esas veri kaynağıdır**. `localStorage`, bir kurumun gerçek rapor verisi/onayı için yetkili veri kaynağı olamaz; yalnız tercihler ve çevrim dışı geçici taslak olabilir.
2. Kurum ve danışmanlık organizasyonlarını **ayrı tenant** kabul et; müşteri verisinin sahibi kurumsal tenant; danışman erişimi projeye bağlı, süreli, iptal edilebilir haktır.
3. Mevcut Next.js/TypeScript hesaplama motorlarını mümkün oldukça koru; girdi/birim/faktör/sürüm/sınır/kanıt bağlamıyla `CalculationRun` ürettir.
4. TSRS/GRI/ESRS/CBAM/Türk faaliyet mevzuatını **tarih ve sürüm bağlamından bağımsız** çalıştırma. “Tam uyumlu” veya “bağımsız denetim tamamlandı” gibi kesin otomatik hükümler yasaktır.
5. İş akışlarını önce **ekran ve API düzeyinde kimlikli** hale getir. Danışman kabulü, müşteri yönetiminin yayımlama onayı ve dış güvence kararı **ayrı durum makineleridir**.
6. Açık, profesyonel, aydınlık arayüz. Hareket ve izometrik 3D yalnız anlamlı hiyerarşi, veri-akış, hesaplamanın etkisi veya kanıt katmanları için; oyunlaştırma/rozet/konfeti ve sürekli hareket yasak.
7. Yeni modül, veri sahibi, ekran, durum, geçiş, izin, doğrulama, kanıt ve test olmadan “bitti” sayılmaz.
8. Depodaki mevcut işlevler korunur; büyük-kapsamlı rewrite yerine strangler/adaptor göçü uygulanır.

## Çalışmanın güvenirlik sınırı

Araştırma; resmi standart oluşturucu/kamu kaynakları, ilgili hizmet firmalarının kendi yayınları, ürün üreticilerinin belgeleri ve Isoline kod deposundaki statik incelemenin üzerine kuruludur. Ürün reklamı, rakip işlevinin bağımsız doğrulaması **değildir**. Gelecekte yürürlüğe girecek kurallar güncel gün ve yer için ayrıca kontrol edilir. SQL dosyası **başlangıç taslağıdır**, gerçek deployment migrasyonu değildir.

## Öncelikli ilk uygulama senaryosu

Kurum A bir hesap açar → şirket ve iki tesisi tanımlar → 2026 TSRS+Faaliyet raporu başlatır → kurum içi veri sorumluları aylık/yıllık veriyi gönderir → veri hesaplanır ve kalite kontrolünden geçer → kurum, danışmanlık şirketi B'ye **sınırlı proje inceleme/yazım erişimi** verir → danışman öneri/rapor bölümü oluşturur → müşteri yönetim onayını verir → sürüm ve kaynak manifestosuyla tasarım ajansına devreder → yayın sürümü kapatılır. **Aynı senaryonun danışmanın müşteri adına ilk proje oluşturduğu varyantı** da kabul testine girmelidir.
