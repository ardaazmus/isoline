# ADR-008 — v1 araç seti ile birlikte yaşam (strangler) ve çalışma alanı içe aktarma

**Durum:** Kabul edildi (19.10.2026) · **İlgili:** plan 06 §9, 13 G1-11, README direktif 8

## Karar

1. **v1 rotaları silinmez.** Mevcut 25 araç ekranı tarayıcı verisiyle çalışmaya devam eder.
   - Üstlerinde bir bant görünür: "Bu çalışma alanı bu tarayıcıda; platform projesine aktarabilirsiniz."
   - Hesap motorları her iki tarafta da aynı modüldür.
2. **Platform ekranları ayrı yerde açılır:**
   - `/[lang]/app/...` platform ekranları;
   - `/[lang]/auth/...` kimlik ekranları.
   - Oturum yoksa platform ekranları giriş ekranına yönlendirir.
3. **İçe aktarma (G1-11)**, v2–v11 arasındaki her `isoline` çalışma alanı dosyası için şunları yapar:
   - Dosya sürüm zincirinden (`migrateClients`) geçirilir.
   - Her `ClientData` için bir **organizasyon** ve **ilk raporlama dönemi** önerilir.
   - Kişi ve tüzel bilgi çıkarılamıyorsa kayıt `UNMAPPED` etiketi alır.
   - Onaylar `legacy_unverified_approval` denetim olayı olur; onay yetkisi doğurmaz.
   - Talep sahipleri `legacy-owner-label` olur.
   - Kanıt özetleri `awaiting_file` durumuyla taşınır.
   - Bir **eşdeğerlik raporu** üretilir: hesap motoru çıktıları v1 ve platform tarafında karşılaştırılır.
   - Kullanıcı onaylamadan yazılmaz; yazıldıktan sonra kaynak dosya salt okunur arşivlenir.

## Gerekçe

- **Plan:** "Büyük kapsamlı yeniden yazım yerine strangler/adaptör göçü".
- **Mevcut kullanıcılar:** Tarayıcıdaki verileri kaybolmaz.
- **Parity testi:** Aynı motor iki tarafta çalıştığı için eşdeğerlik ölçülebilir.

## Güncelleme (19.10.2026): ön kapı platform

- Kök adres (`/`) artık platforma açılır: `/tr/app`. Oturum yoksa giriş ekranı, varsa çalışma alanı ana sayfası gelir.
- Araç seti rotaları aynen kalır (`/tr`, `/tr/journey`, `/tr/tools/...`).
- Karar 1'deki bant uygulandı: araç setinin her sayfasında "Platforma geç" ve "Bu çalışma alanını platforma aktar" bağlantıları var; üst çubukta da "Platform" bağlantısı bulunur.
- Gerekçe: kök adres hâlâ araç setine açıldığı için kullanıcı yeni iş akışını göremedi. Ekip, onay, kapanış ve yayın gibi yeni iş akışları yalnız platformda.

## Güncelleme (19.10.2026, UX Faz 3): araç seti ayrı uygulama olarak kapandı

Bu güncelleme yukarıdaki "v1 rotaları silinmez" kararının yerini alır. Ürün sahibi Plan A'yı onayladı.

- **Ayrı uygulama kalmadı.** Araç setinin kendi kabuğu (üst çubuk, menü, platform bandı) ve iş akışı ekranları kaldırıldı: genel bakış, rapor akışı, uzlaştırma, mizan, veri talepleri, denetçi alanı, faaliyet raporu kontrolü, şablonlar, tesisler, müşteriler, araç seti faktör sayfası.
  - Bu işlerin hepsinin platformda karşılığı var: yedi adım, İşlerim, Kuruluş.
  - Hesap motorları (`lib/calc/*`, `lib/reconcile`, `lib/requests` …) değişmedi ve sunucu tarafında kullanılmaya devam ediyor.
- **Hesaplayıcılar Kütüphane → Hızlı hesap'ta** (`/app/quick/*`) platform kabuğunda çalışır. Bu bir tarayıcı içi deneme alanıdır:
  - tarayıcıda ayrı bir "Hızlı hesap" çalışma alanı kullanılır;
  - yazılan isimle onay bandı ve belge notu paneli gizlidir, çünkü platformda onay gerçek kimlikle verilir;
  - "Örnek değerlerle doldur" düğmesi vardır.
  - Hızlı hesaplananlar: sera gazı, çevre, işgücü, taksonomi, önemlilik, SKDM, TR ETS, dekarbonizasyon, kapsam testi, yeşil iddia.
  - Kütüphane'de ayrıca mevzuat takvimi, çerçeve eşleme ve tema rehberi var.
- **"Döngüye kaydet"** (sera gazı ve çevre) yalnız girdileri aktarır, hesaplanan sonucu aktarmaz (`lib/quick-drafts.ts`).
  - Girdiler kişiye atanmış açık veri taleplerine taslak olarak yazılır (`server/quick/service.ts`, `saveDraft` kuralları).
  - Kişi kanıt ekleyip gönderir; kabul başka birindedir.
- **Eski adresler yönlenir** (`next.config.ts`):
  - `/tr/tools/*` → `/tr/app/quick/*`;
  - mevzuat, çerçeve eşleme ve tema → Kütüphane;
  - akış ekranları → Raporlama dönemleri;
  - `/tr` → `/tr/app`.
- **Tarayıcıdaki eski çalışma alanları** Ayarlar → Araç seti aktarımı ile taşınmaya devam eder.
