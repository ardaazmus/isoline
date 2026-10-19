# ADR-004 — Kimlik doğrulama: Better Auth (kendi sunucumuzda), OIDC SSO seçeneği, TOTP MFA

**Durum:** Kabul edildi (19.10.2026) · **İlgili:** plan 03 §3, §5; 12 §3; G1-02, G1-06

## Karar

**Better Auth 1.7.7.** Uygulamanın içinde çalışır; oturumları PostgreSQL'de tutar ve Kysely ile çalışır.

| Konu | Çözüm |
|---|---|
| Giriş | E-posta + şifre. Şifre özeti kütüphanenin scrypt'iyle alınır. |
| E-posta doğrulama | Zorunlu. Doğrulanmamış hesap kiracı açamaz, daveti kabul edemez. |
| Şifre sıfırlama | Tek kullanımlık, süreli bağlantı. Hesabın var olup olmadığı sızdırılmaz. |
| MFA | `twoFactor` eklentisi: TOTP ve yedek kodlar. Kiracı yöneticisi ve yönetim imzacısı rollerinde **zorunlu**. |
| Oturum | Veritabanında tutulur; httpOnly, Secure, SameSite=Lax çerez. Oturumlar listelenir, tek tek ya da toptan iptal edilir. Kritik işlemde yeniden doğrulama penceresi vardır. Güncelleme (19.10.2026, yük testi): her istekte oturum ve kullanıcısı tek JOIN ifadesiyle okunur (`advanced.database.joins`, Kysely bağdaştırıcısının yerleşik birleştirmesi); önceden iki ardışık sorguydu. Oturum her istekte veritabanından doğrulanmaya devam eder (çerez önbelleği yok), iptal anında geçerlidir. |
| SSO | `genericOAuth` ile OIDC sağlayıcısı (Keycloak, Entra ID, Google Workspace). `OIDC_ISSUER` tanımlıysa giriş ekranında görünür. |
| Davet | Kendi `invitations` tablomuzda. Token yalnız özetiyle saklanır, tek kullanımlıktır, süreli ve iptal edilebilirdir. Kabul için daveti alan e-posta ile oturumdaki e-postanın eşleşmesi gerekir. |

**Kiracı, üyelik ve izin** Better Auth'un organizasyon eklentisiyle değil, kendi tablolarımızla yönetilir (ADR-002). Better Auth yalnız **kimlik + oturum + MFA** katmanıdır.

## Gerekçe

- **Çevrimdışı önce:** Ayrı bir kimlik sunucusu (Keycloak, Zitadel) olmadan çalışır. Kurumsal müşteri kendi kimlik sağlayıcısını OIDC ile bağlayabilir.
- **Sektör:** Better Auth 2025'ten beri Next.js ekosisteminde en yaygın kendi barındırılan kimlik kütüphanesidir. Lucia geliştirilmesini bıraktı; Auth.js şifre ve MFA için önerilmiyor. Eklentileri MFA, oturum iptali ve OIDC'yi hazır karşılar.
- **Güvenlik:** Şifre, oturum ve TOTP kodu kendimiz yazmıyoruz; incelenmiş bir kütüphane kullanıyoruz.

## Sonuçlar

- **Görev ayrılığı:** "Hazırlayanın kimliği ile onaylayanın kimliği aynıysa ret" kuralı artık kullanıcı kimliğiyle karşılaştırılır; yazılan isim kabul edilmez (plan 03 §6).
- **v1'in yazılı isimli onayları** `legacy_unverified` olarak taşınır, yetki doğurmaz.
- **E-posta:** Geliştirmede Mailpit kullanılır. Üretimde SMTP bilgisi `EMAIL_*` değişkenlerinden okunur.
