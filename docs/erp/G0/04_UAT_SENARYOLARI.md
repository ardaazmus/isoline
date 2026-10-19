# G0-06 — İki referans uçtan uca senaryo

G0'ın çıkış kapısı bu iki yolculuğun imzalanmasıdır. Ürün sahibi 19.10.2026 tarihli mesajında soru sormadan devam edilmesini istedi; senaryolar bu talimatla onaylanmış sayılır.

Örnek verinin tamamı **hayalidir** ve `sample` etiketi taşır. Kişiler:
- A şirketinden Ayşe (sahip), Mehmet (veri sahibi) ve Zeynep (katılımcı);
- B danışmanlık firmasından Can (hazırlayan) ve Deniz (gözden geçiren);
- Yönetim imzacısı Elif.

## Yolculuk 1 — Şirket önce başlar (README "öncelikli ilk senaryo")

| Adım | Ekran | Beklenen | UAT |
|---|---|---|---|
| 1 | `auth/signup` → e-posta doğrulama | Ayşe doğrulanmış kimlik | — |
| 2 | `app/onboarding` → "Şirket olarak başla" | `company` kiracısı; Ayşe sahip | UAT-02 |
| 3 | `app/organization` | Holding → 1 tüzel kişi → 2 tesis (Gebze, Dilovası) | UAT-02 |
| 4 | `app/projects/new` | "2026 TSRS + Faaliyet" projesi, 2026 dönemi, operasyonel kontrol sınırı | UAT-02 |
| 5 | `app/settings/members` → davet | Mehmet ve Zeynep davet edilir ve kabul eder | — |
| 6 | `app/projects/[pid]/data` → kampanya | Gereklilik → metrik → talep; 8 görev, 2 tesis | G3 kapısı |
| 7 | `app/tasks/[id]` (Zeynep) | Veri + kanıt + gönder; Gebze görevini görür, Dilovası görevini göremez | UAT-07 |
| 8 | Gözden geçirme (Mehmet) | Bir görevi gerekçeyle iade eder; Zeynep düzeltip yeniden gönderir; Mehmet kabul eder | UAT-12 |
| 9 | `app/relationships` → dış erişim izni | B danışmanlığına bu proje, 2026 dönemi, "hazırlama" rolü ve 90 gün süreyle izin verilir | UAT-04 |
| 10 | Can (B) | Yalnız bu projeyi görür. Başka kiracının görev kimliğiyle istek atarsa 404 alır | UAT-05 |
| 11 | Hesap, kontrol, kapanış | Hesap çalıştırma → olgular; kritik kalite sorunu varken kapanış engellenir | UAT-15 |
| 12 | Rapor stüdyosu | Can bölüm taslağını yazar; Mehmet teknik onay verir; Elif yönetim imzasını atar | UAT-19 |
| 13 | Yayın | DOCX + CSV + SVG + künye paketi çıkar; sonradan değişen veri eski yayını değiştirmez | UAT-17 |
| 14 | İzin iptali | Ayşe B'nin iznini iptal eder; Can'ın bir sonraki isteği reddedilir; rapor geçmişi A'da kalır | UAT-06 |

## Yolculuk 2 — Danışman önce başlar (README varyantı, Yol D)

| Adım | Ekran | Beklenen | UAT |
|---|---|---|---|
| 1 | `auth/signup` → "Danışmanlık firması" | `advisory` kiracısı; Can sahip, Deniz davetle gözden geçiren | UAT-01 |
| 2 | `app/portfolio/clients/new` | "X Kimya A.Ş." **geçici (provisional)** müşteri kiracısı; Can'ın hazırlık izni otomatik açılır | UAT-03 |
| 3 | Proje ve dönem | Can taslak proje ve dönem kurar, veri talebi hazırlar | — |
| 4 | Yayın denemesi | Müşteri sahiplenmediği için **yayın engellenir** | UAT-03 |
| 5 | Müşteri yetkilisine davet | X Kimya'dan Elif davet bağlantısıyla hesap açar ve sahipliği üstlenir; kiracı `active` olur | G1-08 |
| 6 | Sahiplenme sonrası | Can'ın erişimi artık süreli izinle sürer; Elif izni görüp daraltabilir | UAT-04 |
| 7 | Portföy | Can kendi portföyünde iki müşteri görür: biri şirketin başlattığı (Yolculuk 1), biri kendi açtığı. Birinin verisi diğerinden okunamaz | G7 kapısı |

## Otomatik karşılıkları

- **G1–G3 adımları** `web/src/server/**/*.db.test.ts` dosyalarında gerçek PostgreSQL ile sınanır.
- **Ekran akışları** G8'de Playwright ile sınanır.
- Bu senaryoların ayrıntılı test ID'leri [../DURUM.md](../DURUM.md) dosyasında izlenir.
