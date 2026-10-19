# G0-07 — Güvenlik tehdit modeli ve test planı

**Varlıklar:**
- müşteri iş verisi (gözlem, olgu, rapor);
- kanıt dosyaları;
- kimlik ve oturumlar;
- dış erişim izinleri;
- denetim izi.

**Güven sınırları:**
- tarayıcı ↔ API;
- API ↔ PostgreSQL (RLS);
- API ↔ S3 deposu (SeaweedFS, imzalı URL);
- worker ↔ SMTP ve ClamAV;
- kiracı ↔ kiracı (izin).

| # | Tehdit (OWASP API / STRIDE) | Senaryo | Önlem | Otomatik test |
|---|---|---|---|---|
| T1 | API1 BOLA / Bilgi ifşası | B kiracısı, A'nın gerçek görev UUID'siyle GET, PUT ya da DELETE atar | Politika katmanı + RLS; başka kiracı kaynağına 404 | `tenancy.db.test`: çapraz okuma ve yazma 0 satır / 404 |
| T2 | API3 nesne özelliği yetkisi / Kurcalama | İstek gövdesinde `owner_tenant_id`, `approved_by` ya da `status=published` | zod şemaları bu alanları kabul etmez; servis bu alanları kendisi atar | API sözleşme testi: fazladan alan reddedilir |
| T3 | API5 fonksiyon düzeyi yetki | Katılımcı yayın ucunu çağırır | Rol-eylem matrisi, varsayılan ret | `policy.test`: her rol × eylem tablosu |
| T4 | Yetki yükseltme | Hazırlayan kendi işini onaylar | Kimlik karşılaştırması (`user_id`) + veritabanı CHECK | `reviews.db.test`: aynı kişiyle 403 |
| T5 | İptal edilmiş erişim | İzni iptal edilen danışmanın sonraki isteği | RLS aktif izin koşulu; imzalı URL 5 dakika | `grants.db.test`: iptalden sonra 0 satır |
| T6 | Süresi dolmuş davet ya da token | Kullanılmış veya süresi geçmiş davet bağlantısı | Token özeti, tek kullanım, süre | `invitations.db.test` |
| T7 | Dosya yükleme | Zip bombası, MIME sahteciliği, 1 GB dosya, EICAR | Boyut sınırı, uzantı–MIME eşleşmesi, ClamAV, karantina | `evidence.test`: EICAR karantinaya, büyük dosya 413 |
| T8 | XSS | Rapor bölümünde ya da SVG'de betik | Zengin metin beyaz listeyle temizlenir; SVG yüklemede betik ve olay öznitelikleri reddedilir | `sanitize.test` |
| T9 | CSRF | Başka siteden form gönderimi | Better Auth `SameSite=Lax` + `Origin` kontrolü; mutasyonlar JSON + özel başlık ister | API testi: Origin uyuşmazlığında 403 |
| T10 | Yarış durumu | İki gözden geçiren aynı anda onaylar | `row_version` ile iyimser kilit; ikinci istek 409 alır | `reviews.db.test` |
| T11 | Denetim izinin kaybı | Denetim yazılamazken onay | Aynı işlemde yazım; hata olursa geri alma (fail-closed) | `audit.db.test`: hatalı denetim yazımında onay yok |
| T12 | RLS'nin atlanması | Çalışma rolüyle `SET app.user_id` taklidi ya da tablo sahibi rolüyle sorgu | `isoline_app` sahip değil, NOBYPASSRLS, FORCE RLS. Bağlam yalnız sunucu kodunda ayarlanır; istemcinin SQL erişimi yok | `rls.db.test`: bağlam yokken 0 satır |
| T13 | Bağlam kirlenmesi | Havuzdan alınan bağlantıda önceki kullanıcının bağlamı | Yalnız `SET LOCAL` (işlem sonunda düşer) | `rls.db.test`: işlem dışında `current_setting` boş |
| T14 | SSRF | URL'den dosya alma | V1'de URL'den içe aktarma yok; G8 bağlayıcılarında izin listesi | — (kapsam dışı, belgelenmiş) |
| T15 | Kişisel veri | İSG olay listesi dışa aktarılır | Yalnız toplam veri; küçük grup gizlenir | `privacy.test` |

**Kalan riskler (G8'e):** sızma testi, geri yükleme tatbikatı, hız sınırlama ayarı, gizli bilgi rotasyonu.

## G1 sonrası durum (19.10.2026)

Tablodaki test adları plan aşamasındaki adlardı. G1'de karşılıkları şunlar:

| # | Gerçek test | Not |
|---|---|---|
| T1, T12, T13 | `web/src/server/tenancy/tenancy.db.test.ts`, `web/src/server/http/api.db.test.ts` | Başka kiracının kaynağına 404, RLS'de 0 satır, bağlamsız 0 satır, bağlam sızmıyor |
| T5 | `api.db.test.ts` "grants and evidence" | İzin iptalinden sonraki ilk istek 404; imzalı URL 300 sn |
| T6 | `tenancy.db.test.ts`, `api.db.test.ts` "invitations" | Tek kullanım, süre, başka e-posta, iptal |
| T7 | `evidence/filetype.test.ts`, `api.db.test.ts` | İçerik imzası kontrolü (adı .pdf olan çalıştırılabilir dosya 415), 50 MB sınırı, EICAR karantinada |
| T9 | `api.db.test.ts` "refuses foreign origins" | Yabancı Origin ile yazma 403 `bad_origin` |
| T10 | `api.db.test.ts` "settings use If-Match" | Eski sürümle yazma 409 |
| T11 | `tenancy.db.test.ts` | Denetim yazılamazsa işlem geri alınır |

**G1'de eklenen tehditler:**

| # | Tehdit | Önlem | Test |
|---|---|---|---|
| T16 | Outbox tablosunu okuyabilen biri davet token'ıyla başkasının davetini kabul eder | Token AES-256-GCM ile mühürlenir (bağlam: davet kimliği); işçi gönderdikten sonra payload'dan siler; uygulama rolü outbox'ı okuyamaz | `crypto/seal.test.ts`, `api.db.test.ts` (gönderim sonrası payload'da `sealedToken` yok) |
| T17 | Denetim zinciri saat dilimine göre farklı hesaplanır ve doğrulama yanlış alarm verir | Zaman damgası UTC ISO biçiminde özetlenir | `api.db.test.ts` zincir doğrulaması |
| T18 | Kayıt ekranında "bu e-posta zaten kayıtlı" yanıtı hesap varlığını sızdırır | Şifre sıfırlama yanıtı adresten bağımsız; kayıt ucunda Better Auth hız sınırı açık | Kalan risk: kayıt yanıtının tekdüzeleştirilmesi G8 güvenlik incelemesinde |
| T19 | Geliştirme bağımlılıklarındaki bilinen açıklar | `npm audit`: 6 yüksek bulgu yalnız `eslint-config-next` ve `kysely-codegen` zincirinde (braces/micromatch, ReDoS); çalışma zamanı paketlerinde bulgu yok | G8'de araç sürümleri yükseltilir |
