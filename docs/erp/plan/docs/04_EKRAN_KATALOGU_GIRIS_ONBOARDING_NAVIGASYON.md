# 04 — Tam ekran kataloğu, giriş/onboarding ve bilgi mimarisi

**Amaç:** Ekranları tekil modül menülerine göre değil, gerçek işin başlangıcından yayınına kadar düzenlemek. Tasarım kuralı: kullanıcı **hangi müşteride, hangi projede, hangi rapor döneminde ve hangi izin rolünde** olduğunu her zaman görür.

## 1. Global kabuk

- **Global topbar:** Isoline, `çalışılan tenant`, `müşteri/kurum`, `proje`, `dönem`, `rapor türü`, komut/arama, bildirim, profil. Açılır menüler role göre; yanlış müşteri veri girişi önlenir.
- **Ana menü — Danışman görünümü:** Portföy, Müşteriler, Projeler, Bekleyenler, Raporlar, Kaynaklar, Ekip/Yetkiler, Ayarlar.
- **Ana menü — Şirket görünümü:** Genel Bakış, Organizasyon, Projeler, Veri Talepleri, Veriler & Hesaplar, Kalite/Onaylar, Rapor Stüdyosu, Paylaşımlar, Ayarlar.
- **Ana menü — Tesis katkıcısı:** Görevlerim, Gönderdiğim Veriler, Kanıtlarım, Mesajlar. Derin sektör ayarları görünmez.
- **Ana menü — Dış incelemeci:** İnceleme Paketi, Açık Sorular/Bulgular, Kaynaklar, Son Tarih; diğer tenant görünmez.
- **Ana menü — Tasarım ajansı:** Tasarım Teslimleri, Dosyalar, Prova Yorumları; hesap motoru yönetimi yok.
- **Global komut arama:** müşteri + proje + metrik + görev + belge + rapor bölümü; sonuçlar yalnız yetkili kayıtlardan.

## 2. Ekran kimliği ve route kataloğu

### A — Kamu, güvenlik ve hesap açılışı

| ID | Route (öneri) | Başlıca işlev ve alan | Özel durum |
|---|---|---|---|
| AUTH-01 | `/login` | E-posta/şifre veya OIDC/SSO, hatırla, MFA | Kilitlenme, SSO alan adı |
| AUTH-02 | `/signup` | Profil + şirket mi/danışman mı ilk seçimi | Mevcut davet varsa öncelik ona |
| AUTH-03 | `/verify-email` | Token doğrulama, yeniden gönder | Süresi dolmuş bağlantı |
| AUTH-04 | `/forgot-password` | E-posta başlat | Hesap var/yok bilgisini sızdırmama |
| AUTH-05 | `/reset-password` | Token + yeni şifre | Token tek kullanımlık |
| AUTH-06 | `/mfa/setup` | MFA kurulum ve recovery | Zorunlu policy |
| AUTH-07 | `/auth/sso/callback` | OIDC/OAuth dönüşü | Hata güvenli açıklama |
| AUTH-08 | `/invite/:token` | Kurum/proje/rol/grant özet, kabul | Email doğrula; token tek kullanım |
| AUTH-09 | `/choose-workspace` | Üye olduğu tüm workspace'ler | Aktif/askı/davet |
| AUTH-10 | `/session-expired` | Yeniden giriş + taslak kurtarma | Güvenli dönüş linki |
| AUTH-11 | `/privacy/terms` | Sözleşme/şart/KVKK ve sürüm | Kabul kaydı |
| AUTH-12 | `/account/security` | Session list, MFA, veri ihracı | Kritik yeniden doğrulama |

### B — Kurulum, organizasyon ve ilişkiler

| ID | Route | Amaç |
|---|---|---|
| ORG-01 | `/onboarding/welcome` | Şirket / danışman / davetle giriş dallanması |
| ORG-02 | `/onboarding/tenant` | Kurum oluşturma veya var olanına katılma |
| ORG-03 | `/onboarding/company-profile` | Şirket türü, ülke, sınıflandırma, mali yıl, veri yöneticisi |
| ORG-04 | `/onboarding/agency-profile` | Danışmanlık firma ekip ve hizmet alanları |
| ORG-05 | `/onboarding/organization-tree` | Tüzel kişi, grup, tesis ve departman ilk import |
| ORG-06 | `/onboarding/invitations` | Yetkili veri sahiplerini ve danışman ekibini davet etme |
| ORG-07 | `/organization` | Kurum hiyerarşisi + geçerlilik tarihli ilişkiler |
| ORG-08 | `/organization/entities/:id` | Tüzel kişilik profili, sahiplik/kontrol zaman çizgisi |
| ORG-09 | `/organization/facilities/:id` | Tesis, lokasyon, sayaç/asset, sorumlu, veri kalite özeti |
| ORG-10 | `/organization/boundaries/:id` | Rapor sınırı tasarla, dahil/dışla/gerekçe |
| ORG-11 | `/relationships` | İş ortağı/danışman/grant listesi; iptal & izin gözden geçirme |
| ORG-12 | `/settings/members` | Kullanıcılar, roller, davet/askıya alma |
| ORG-13 | `/settings/audit` | Erişim, karar ve veri dışa aktarım olayları |

### C — Portföy, müşteri, proje ve teslimat

| ID | Route | Amaç |
|---|---|---|
| PORT-01 | `/portfolio` | Danışman çok müşterili proje durum panosu |
| PORT-02 | `/portfolio/clients` | Müşteri listesi; açık işler / kısıtlı erişim |
| PORT-03 | `/portfolio/clients/new` | Müşteri daveti veya provisional şirket |
| PORT-04 | `/engagements/new` | İş/sözleşme başlat; modül/hizmet seçimi |
| PORT-05 | `/engagements/:id` | İş özeti, milestones, deliverables, ekip/grant |
| PORT-06 | `/projects` | Kurum proje listesi; yıl/tür filtre |
| PORT-07 | `/projects/new` | Rapor proje sihirbazı |
| PORT-08 | `/projects/:id/overview` | Öncelikli işleri, veri kalitesi, son tarih, özet maket |
| PORT-09 | `/projects/:id/plan` | Aşama, RACI, iş paketleri, bağımlılık, takvim |
| PORT-10 | `/projects/:id/scope` | Kapsam testi + uzman kararı + rapor sınırı |
| PORT-11 | `/projects/:id/frameworks` | Standart sürümleri, gerekçe, açıklama seti |
| PORT-12 | `/projects/:id/participants` | Üye ve dış grant kapsamı |
| PORT-13 | `/projects/:id/activity` | Proje zaman çizgisi ve değişiklikler |

### D — Veri operasyonu ve hesap modülleri

| ID | Route | Amaç |
|---|---|---|
| DATA-01 | `/projects/:id/data-plan` | Gerekli veri noktası kataloğu, kaynak, owner, dönem |
| DATA-02 | `/projects/:id/campaigns` | Toplama kampanyaları ve reminder kuralları |
| DATA-03 | `/projects/:id/campaigns/:cid` | Bölüm/tesis/sorumlu bazlı ilerleme ve gecikme |
| DATA-04 | `/tasks/my` | Kişisel veri/görev gelen kutusu |
| DATA-05 | `/tasks/:id` | Sade adımlı form + kanıt + yöntem + gönder/geri al |
| DATA-06 | `/data/inbox` | İçe aktarımlar, duplikasyon/kalite uyarıları |
| DATA-07 | `/data/import/new` | CSV/XLSX/OCR'sız PDF belge ve kontrollü dosya alımı |
| DATA-08 | `/data/import/:id/mapping` | Kolon/eşleme/birim/tesis/dönem önizleme |
| DATA-09 | `/data/observations/:id` | Ham gözlem, kanıt, değişiklik, faktör/hesap etkisi |
| DATA-10 | `/data/evidence` | Kayıtlı belge, izin, bağlı metrik, saklama |
| DATA-11 | `/calculations` | Mevcut araç kataloğu, dönem/tesis bağlamına göre |
| DATA-12 | `/calculations/ghg` | Scope 1/2/3 envanter ve faktör yönetimi |
| DATA-13 | `/calculations/environment` | Enerji-su-atık, tesis ve tarihsel ölçüm |
| DATA-14 | `/calculations/workforce` | İşgücü/İSG toplulaştırılmış göstergeler |
| DATA-15 | `/calculations/finance` | Mizan/finans ölçüleri, tablolar/uyarlama |
| DATA-16 | `/calculations/cbam` | Ürün/tesis/rotaya bağlı emisyon ve beyan paketi |
| DATA-17 | `/calculations/ets` | Tesis izleme verisi ve projeksiyon |
| DATA-18 | `/calculations/targets` | Hedef ve dekarbonizasyon senaryoları |
| DATA-19 | `/factors` | Faktör/lisans/sürüm/müşteri faktörünün doğrulanması |
| DATA-20 | `/metric/:factId/lineage` | Kaynak→hesap→onay→rapor soy ağacı |

### E — Risk, standart, inceleme ve kapanış

| ID | Route | Amaç |
|---|---|---|
| CTRL-01 | `/projects/:id/materiality` | Standart tipine göre etki/finans/çift önemlilik |
| CTRL-02 | `/projects/:id/risks` | İklim/ESG IRO, finans bağlantısı, eylem |
| CTRL-03 | `/projects/:id/disclosures` | Gerekli/koşullu/önerilen açıklama panosu |
| CTRL-04 | `/projects/:id/quality` | Veri kalitesi, muafiyetler, açıklama gerektiren farklar |
| CTRL-05 | `/projects/:id/reconciliation` | Finans–ESG, tesis–grup, geçmiş yıl kontrolleri |
| CTRL-06 | `/review/queue` | Veri sahibi / kalite kontrol / danışman onay kutusu |
| CTRL-07 | `/review/:id` | Eski/yeni diff, belge, yorum, karar, gerekçe |
| CTRL-08 | `/projects/:id/consolidation` | Raporlama sınırı, GHG ve finans ayrı yöntem |
| CTRL-09 | `/projects/:id/close` | Kritik kontroller, dönemi dondur / gerekçeli aç |
| CTRL-10 | `/projects/:id/assurance` | Dış inceleme grant'leri, sorgular, cevaplar |
| CTRL-11 | `/projects/:id/assurance/findings/:fid` | Bulgu, müşteri açıklaması, kanıt ve çözüm |

### F — Rapor, tasarım, yayın

| ID | Route | Amaç |
|---|---|---|
| REP-01 | `/projects/:id/reports` | Rapora göre deliverables, yazım ve yayın durumu |
| REP-02 | `/reports/new` | TSRS/GRI/ESRS/Faaliyet/Entegre/CBAM vb. şablon |
| REP-03 | `/reports/:id/outline` | Standart açılış soruları, bölüm, sahiplik, sıra |
| REP-04 | `/reports/:id/write/:section` | Kaynağa bağlı metin editörü, yorum, açıklama |
| REP-05 | `/reports/:id/figures` | Grafik/tablo, birim, veri sürümü, SVG/CSV |
| REP-06 | `/reports/:id/review` | Bölüm teknik/finans/müşteri/yönetim onayları |
| REP-07 | `/reports/:id/preview` | İçerik görünümü, güncel olmayan atıf göstergesi |
| REP-08 | `/reports/:id/exports` | DOCX, XLSX, JSON, SVG, kanıt paketi; sürüm |
| REP-09 | `/reports/:id/design-handoff` | Tasarım ajansına sürümlü asset manifestosu |
| REP-10 | `/reports/:id/proofs` | PDF prova, mizanpaj yorumları ve sayfa indeksi |
| REP-11 | `/reports/:id/release` | Yönetim imzası, final dosyalar, yayın kanıtı |
| REP-12 | `/reports/:id/amend` | Revizyon / yeniden açıklama, fark raporu |

### G — İdare, platform operasyonu, yardım

| ID | Route | Amaç |
|---|---|---|
| SET-01 | `/settings/profile` | Kişi/yerel ayarlar |
| SET-02 | `/settings/organization` | Kurum profili, veri bölgesi, sahip |
| SET-03 | `/settings/workflows` | Form/onarım/approval şablonları |
| SET-04 | `/settings/notifications` | Son tarih / e-posta kuralları |
| SET-05 | `/settings/integrations` | ERP/HRIS/API bağlantıları, secrets yönetimi |
| SET-06 | `/settings/data-policy` | retention, log, delete/export, legal hold |
| SET-07 | `/settings/billing` | Paket ve kullanım (gerekirse) |
| SET-08 | `/settings/api-keys` | Scoped service account ve token yenileme |
| SET-09 | `/support/guide` | Görev/rol bazlı ürün yardımı |
| SET-10 | `/system/admin` | Kurumsal operasyon; müşteri içeriğine varsayılan erişim yok |

## 3. Ekranların ortak durum sözleşmesi

Her ekranda `loading`, `empty`, `error`, `not_authorized`, `read_only`, `stale_version`, `offline`, `action_success`, `pending_review` tasarımları tanımlanır. Belge yükleme için `uploading/virus_scanning/processing/ready/rejected`; form için `draft/unsaved/validation_warning/submitted` ayrıca gerekir.

**Form düzeni:** solda ana veri alanı; sağda yalnız bağlama göre açılan yardım/kaynak/kanıt paneli; altta sabit `Kaydet`/`Gönder`; üstte işletme-dönem-ölçü birimi. Sayısal metrik sonuçlarında *bulgular* ve *hesap yöntemi* ayrı sekmeler; uzun form ekranını kullanıcıya varsayılan olarak yükleme.

## 4. Danışman ana sayfası ayrıntısı

Üstte portföy filtresi; KPI olarak `bu hafta son tarihi dolan`, `müşteriden veri bekleyen`, `inceleme için hazır`, `tasarıma devredilen`; altında projeler tablo/kart arasında geçiş; sağda kişi bazlı görevler; en altta ileriye dönük zaman çizgisi. KPI sadece **operasyon durumu** ölçer, “regülasyona uyum %85” gibi uydurma skor göstermez.

## 5. Müşteri/holding ana sayfası ayrıntısı

Üst satır mevcut dönem, rapor türleri, kapanış engelleri. Orta alanda isteğe bağlı isometrik şirket/tesis haritası; yanında “Bugün ne yapmam gerek?” 3–5 maddelik görev özeti. Alt alanda tesis bazlı kanıt/kalite, emisyon/enerji/su trendleri ve canlı rapor bölüm ilerleme göstergesi. 3D kapalıyken **aynı işlev tablo/ağaç üzerinden %100 erişilebilir**.

## 6. Katkıcı görevi — dört küçük adım

1. **Ne isteniyor?** veri tanımı, tesis, dönem, örnek, beklenen birim, sorumlu.
2. **Veriyi gir:** kontrollü sayı/tablo/Excel; yanlış birim önizlemesi, ay aralığı kontrolü.
3. **Kanıt/yorum:** fatura, sayaç, tutanak veya hesap açıklaması; risk düzeyine göre uygun kanıt.
4. **Kontrol et ve gönder:** özet, varsa uyarı, son tarih, sonraki reviewer. Sonrasında durumu/geri dönüş notunu kişisel görev listesinde izler.

## 7. İlk sürüm navigasyonunda kaçınılacak hatalar

- Ana sol menüye **tüm sektör ve standartları** serpiştirmeyin: proje kapsamında etkin modüller sunulsun.
- `Kurum`, `müşteri`, `danışman`, `bağlı ortaklık`, `tesis`, `proje`, `raporlama dönemi` birbirine karıştırılmasın.
- E-posta linkini tıklayan kullanıcı başka tenant üzerinde oturum açmışsa erişim vermeden önce doğru bağlamı doğrulasın.
- Harici danışman aynı gerçek raporu görür; başka müşteriye ait faktör/kanıtın seçilmesi audit ve izin kontrolüne tabi.
- Rapor “yayınlandı” kararı ile “bölüm kapandı” kararı aynı buton olmasın.
