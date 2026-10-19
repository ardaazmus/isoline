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

## Güncelleme (19.10.2026): yedi adımlı döngü, rol bazlı "Bugün", tek gelen kutusu

**Neden:** Bağımsız arayüz incelemesinde şu sorunlar bulundu:
- Şirket sahibi iki uygulamada 51 menü ve sekme girişi görüyordu.
- Durum üç ayrı yerde tutuluyor ve birbiriyle çelişiyordu: elle güncellenen plan kapıları, dönemin elle değiştirilen durumu ve kapanış listesi.
- Ana sayfa yapılacak işi değil, paylaşım izni sayılarını gösteriyordu.

Benzer ürünler (Microsoft Sustainability Manager, Watershed, Workiva, Greenly, Terrascope, FloQast) döngüyü sistemden hesaplanan aşamalarla, işi de tek kişisel gelen kutusuyla gösteriyor. İnceleme sayfası: https://claude.ai/artifact/AJBQ4jLSWbsYRC8ZG2UJWz

**Karar:**
- **Ana menü en çok altı kalemdir:** Bugün, Raporlama dönemleri, İşlerim, Kuruluş, Kütüphane, Ayarlar.
  - Bir bölümün alt sayfaları yalnız o bölüm açıkken görünür.
  - Menü role göre kısalır: veri giren kişi Bugün, İşlerim ve Ayarlar'ı görür.
  - Tek çalışma alanı olan kişi seçim ekranını görmez.
- **Proje ekranı yedi adımdır:** Kapsam → Veri toplama → Hesaplama ve onay → Kontrol ve konsolidasyon → Dönem kapanışı → Rapor → Güvence. Yanında "Özet" ve "Kurulum" bulunur.
  - Kurulum bölümünde dönemler ve paylaşım, takvim ve sorumlular, ekip, sektör paketleri ve veri bağlayıcıları vardır.
  - Bu yapı on iki düz sekmenin yerini alır. Adım sayfaları mevcut adreslerini korur.
- **Adımın durumu kayıtlardan hesaplanır** (`server/cycle/steps.ts`, `progress.ts`).
  - Kapanış kontrol listesi de aynı sinyallerden üretilir (`closeChecklistFrom`). Dondurma, ekran ve adım çubuğu aynı tanımı kullanır.
  - Plan iş paketlerinde elle durum değiştirilmez; tarih ve sorumlu değiştirilir. Plan sayfası her paketin bağlı olduğu adımın durumunu gösterir.
  - Portföydeki "Sıradaki" sütunu hesaplanan adımdan gelir.
  - Sıra gösterilir ama zorlanmaz. Yalnız gerçek kapılar kilitler: kapanış kontrol listesi ve dondurulmuş dönem.
- **"İşlerim" tek gelen kutusudur** (`server/inbox/service.ts`). Görevlerim, İnceleme kuyruğu ve bildirim listesinin yerini alır. İçinde şunlar vardır:
  - girilecek veriler;
  - incelenecek gönderimler;
  - hesaplama bazında onay bekleyen metrikler (tesis düzeyindekiler dahil);
  - gerekçe bekleyen uyarılar;
  - onay bekleyen hasılat ve eliminasyon tutarları;
  - incelenecek rapor bölümleri;
  - onay zinciri kararları;
  - güvence soruları.

  Kendi işi kimsenin onayına gelmez. Eski `/app/review` adresi İşlerim'e yönlenir.
- **"Bugün"** sayfasında önce "Sizden beklenen" listesi, sonra döngüleri izleyen roller için her projenin bulunduğu adım, durumu ve adımın son tarihi yer alır. Danışman aynı tabloyu müşteri bazında görür.

## Güncelleme (19.10.2026, UX Faz 3): çalışma sayfaları, Analiz ve Kütüphane

- **Çalışma sayfaları** (`core.cycle_worksheets`, migration 0012) döngünün yapılandırılmış girdileridir. Her kayıt yeni bir sürümdür.
  - Akış: taslak → onaya gönder → başka biri onaylar ya da gerekçeyle geri gönderir. Veritabanı onaylayanın girenden farklı olmasını zorunlu tutar; sürüm içeriği değiştirilemez (tetikleyici).
  - Önemlilik ve faaliyet raporu kararını şirket üyesi verir.
  - Adımlara bağlanma:
    - çift önemlilik 1. adımın alt sayfasıdır;
    - taksonomi 3. adımın alt sayfasıdır; onaylı sayfa "taxonomy" hesabıyla metrik olur ve diğer metrikler gibi onaya gider;
    - faaliyet raporu kontrol listesi 6. adımda rapor sayfasındadır; onaylı ve eksiksiz olmadan faaliyet raporu yayımlanmaz.
  - Onay bekleyen sayfalar İşlerim'e düşer.
- **Mutabakat:**
  - U6 onaylı taksonomiyle geçiş planını, U7 faaliyet raporu yatırımlarıyla önceki dönemin enerji ve kapsam 1 değişimini karşılaştırır.
  - U10 yayın anında rapor metninde çalışır ve yayını durdurur.
- **Analiz** proje çubuğunda adımların yanındadır; döngünün adımı değildir.
  - Dekarbonizasyon yolu, TR ETS ve SKDM maliyeti onaylı rakamlarla çalışır; varsayımlar senaryo olarak sürümlü saklanır.
  - Analiz bildirilen rakamı değiştirmez ve döngüyü bekletmez.
- **Kütüphane** bölümü: Hızlı hesap, faktör kütüphanesi, mevzuat takvimi, çerçeve eşleme, tema rehberi, referans veri sürümleri.
