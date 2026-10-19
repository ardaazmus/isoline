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
