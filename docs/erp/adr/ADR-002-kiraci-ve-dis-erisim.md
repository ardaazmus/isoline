# ADR-002 — Kiracı modeli, veri sahipliği ve dış erişim izni

**Durum:** Kabul edildi (19.10.2026) · **İlgili:** plan 03, 06 §4–5, G0-02

## Karar

1. **Tek veritabanı, tek şema, her iş tablosunda `owner_tenant_id`.** Erişim, sunucudaki politika katmanı ve PostgreSQL RLS'nin birlikte çalışmasıyla korunur. Kiracı başına ayrı şema ya da veritabanı açılmaz.
2. **Kiracı türleri:** `company`, `advisory`, `partner`. Tür yalnız başlangıç rolünü belirler; erişimi belirlemez.
   - Kiracının yaşam döngüsü: `provisional` → `active` → `suspended` / `closed`.
3. **Müşteri verisinin sahibi her zaman müşteri kiracısıdır.** Danışmanlık kiracısı müşteri verisine yalnız şu kayıtla erişir:
   - `external_grants`: proje bazlı, süreli, iptal edilebilir;
   - kapsam: `scope.cycles`, `scope.facilities`, `scope.data_classes`;
   - `purpose` ve `consent_records`.
4. **Danışman müşteriyi kendisi açabilir (Yol D).** Müşteri kiracısı `provisional` kurulur.
   - Danışman bu geçici müşteride hazırlık yapabilir.
   - Müşteri yetkilisi daveti kabul edip sahipliği üstlenene (claim) kadar **yayın engellidir**.
   - Claim, kiracıyı `active` yapar. Danışmanın erişimi bundan sonra yalnız izin (grant) ile sürer.
5. **Kimlik ile üyelik ayrı.** Bir kişi birden fazla kiracıya üye olabilir.
   - Her istek bir **acting tenant** taşır: işlemi yapanın hangi kiracı adına çalıştığı.
   - Her kayıt bir **owner tenant** taşır: verinin sahibi.
   - Denetim izi ikisini de yazar.
6. **Erişim kararı üç katmanlıdır:**
   - **(a) Sunucu politika fonksiyonu:** rol ve özniteliğe bağlı izin (RBAC + ABAC), varsayılan olarak ret.
   - **(b) PostgreSQL RLS:** Her işlemde `app.user_id` ve `app.acting_tenant_id`, `SET LOCAL` ile ayarlanır. Çalışma rolü `NOBYPASSRLS` ve tablo sahibi değildir; tablolarda `FORCE ROW LEVEL SECURITY` açıktır.
   - **(c) Bileşik yabancı anahtarlar:** `(owner_tenant_id, id)`. Bir alt kayıt, başka kiracının üst kaydına bağlanamaz.

## Gerekçe

- **Sektör pratiği:** Tek şema + kiracı sütunu + RLS, orta ölçekli B2B SaaS'ta (yüzlerce kiracı) en yaygın ve işletmesi en ucuz modeldir.
- **Güvenlik:** OWASP API güvenliğinin bir numaralı riski, nesne düzeyinde yetki ihlalidir (BOLA). Bu riske karşı veritabanı katmanında ikinci bir savunma önerilir.
- **Danışmanlık işi:**
  - Danışman veriye sahip olmadan iş yapar.
  - Müşteri izni iptal edince danışmanın erişimi bir sonraki istekte kapanır.
  - Rapor geçmişi müşteride kalır.

## Sonuçlar

**RLS politikaları:**
- Üye erişimi: aktif üyelik.
- Dış erişim: aktif, süresi dolmamış, iptal edilmemiş izin + proje eşleşmesi.
- Kapsam ayrıntısı (tesis, dönem, veri sınıfı) sunucu politika katmanında uygulanır. RLS kaba sınırı, politika katmanı ince kapsamı korur.

**Testler:** İki kiracı, üç rol; çapraz SELECT, INSERT, UPDATE ve DELETE; iptal edilmiş izin; süresi dolmuş izin. Testler düşük yetkili rolle çalışır (G1-04).
