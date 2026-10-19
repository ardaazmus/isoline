# ADR-006 — Denetim izi, outbox, iş kuyruğu ve bildirimler

**Durum:** Kabul edildi (19.10.2026) · **İlgili:** plan 05 §8; 06 §8; 12 §8; G1-10, G3-08

## Karar

**1. Denetim olayı (`audit_events`):**
- Kritik her yazma işlemiyle **aynı veritabanı işleminde** yazılır.
- İçeriği: işlemi yapan, acting tenant, owner tenant, proje, eylem, nesne, önce/sonra özeti, istek kimliği.
- Denetim yazılamazsa işlem geri alınır (fail-closed).
- Tablo yalnız eklemeye açıktır: çalışma rolünün UPDATE ve DELETE yetkisi yok.
- Kayıtlar ayrıca bir önceki kaydın özetini taşır (hash zinciri). Plan gereği bu zincir tek başına "değişmezlik garantisi" olarak sunulmaz; yalnız değişiklik tespitine yardım eder.

**2. Outbox (`outbox_events`):**
- E-posta, hatırlatma, tarama ve hesap tetikleri aynı işlemde outbox'a yazılır.
- Ayrı **worker** süreci (`npm run worker`) olayları `FOR UPDATE SKIP LOCKED` ile alır.
- Yeniden deneme üstel geri çekilmeyle yapılır; tükenen olaylar `dead` durumuna geçer.

**3. Kalıcı tekrar koruması (`idempotency_keys`):**
- Mutasyon uçları `Idempotency-Key` başlığını kabul eder.
- Aynı anahtar aynı yanıtı döndürür ve 24 saat saklanır.

**4. Hatırlatmalar:**
- Zamanlama T−7, T−2 (yalnız kritik görevde) ve T+1'dir (proje yöneticisine özet).
- Benzersiz anahtar: `(task_id, kind, due_date)`; aynı hatırlatma iki kez gitmez.
- E-posta gönderilemezse görevin durumu değişmez (plan 05 §8).

**5. E-posta:**
- `nodemailer` 10.0.14 ile SMTP.
- Geliştirmede Mailpit; üretimde kuruma ait SMTP.

## Gerekçe

- **Sektör:** Transactional outbox, mesaj ile veritabanı yazımının tutarlılığı için yerleşik bir kalıptır.
- **Ek altyapı yok:** PostgreSQL tabanlı kuyruk, ayrı bir mesaj aracısı (Redis, RabbitMQ) gerektirmez; planın modüler monolit önerisiyle uyumludur.

## Güncelleme (19.10.2026, G1)

- **Mühürlü sırlar:** Davet token'ı outbox'a düz yazılmaz; `APP_ENCRYPTION_KEY` ile AES-256-GCM mühürlenir ve işçi e-postayı gönderdikten sonra payload'dan siler (`web/src/server/crypto/seal.ts`, `web/src/server/jobs/worker.ts`).
- **Kuyruğa yazma:** Uygulama rolü outbox'a doğrudan yazamaz; `authz.enqueue` (SECURITY DEFINER) tek giriş kapısıdır, `dedupe_key` çakışmasında sessizce tek kayıt kalır.
- **İşçi:** `FOR UPDATE SKIP LOCKED` ile birden çok işçi çalışabilir; 8 denemeden sonra olay `dead` olur; 15 dakikadan uzun `processing` kalan olay kuyruğa döner.
- **Denetim zinciri:** Özet `prev_hash | action | object | actor | after_digest | payload | occurred_at(UTC ISO)` üzerinden hesaplanır; `verifyChain` aynı formülle zinciri yeniden kurar.
- **Idempotency:** Anahtar ilk istekte "işleniyor" kaydıyla alınır; eşzamanlı ikinci istek 409, farklı gövdeyle tekrar 422 alır; hata olursa anahtar silinir ve istemci yeniden deneyebilir.
