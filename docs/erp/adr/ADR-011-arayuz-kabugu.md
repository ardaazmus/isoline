# ADR-011 — Platform arayüz kabuğu ve bağlam çubuğu

**Durum:** Kabul edildi (19.10.2026) · **İlgili:** plan 04 §1, §3, §7; 11; DESIGN.md

## Karar

**Bağlam çubuğu.** Platform ekranlarının üstünde her zaman görünür:
- çalışılan kiracı (acting tenant);
- müşteri kurum;
- proje;
- dönem;
- rapor türü;
- rol.

Başka kiracının verisiyle çalışılıyorsa (dış erişim izni) çubuk bunu açıkça yazar: "Müşteri X adına, izinle".

**Rol bazlı menüler** (plan 04 §1):

| Rol | Menü |
|---|---|
| Danışman | Portföy, Müşteriler, Projeler, Bekleyenler, Raporlar, Ekip, Ayarlar |
| Şirket | Genel bakış, Organizasyon, Projeler, Veri talepleri, Veriler ve hesaplar, Kalite ve onaylar, Rapor stüdyosu, Paylaşımlar, Ayarlar |
| Katılımcı | Görevlerim, Gönderdiklerim, Kanıtlarım |
| Dış incelemeci | İnceleme paketi, Sorular, Kaynaklar |
| Tasarım ajansı | Teslimler, Dosyalar, Prova yorumları |

**Ortak durum sözleşmesi.** Her ekranda şu durumlar ortak bileşenlerle çizilir: `loading`, `empty`, `error`, `not_authorized`, `read_only`, `stale_version`, `action_success`, `pending_review`.

**Görsel dil:** DESIGN.md'nin aydınlık, sakin dili korunur.
- Koyu tema, rozet, konfeti ve sürekli hareket yok.
- İzometrik ve akış görselleri yalnız gerçek veriyi açıklar; her birinin bir tablo karşılığı vardır.
- Hareketi azaltma tercihi (`prefers-reduced-motion`) desteklenir.

## Gerekçe

- **Plan 04 §7:** Yanlış müşteri veya yanlış dönem için veri girişini önlemek bağlamı sürekli göstermeyi gerektirir.
- **Mevcut tasarım sistemi korunur:** Aile renkleri, cam yüzeyler ve kaynak notu yakası aynen kullanılır.
