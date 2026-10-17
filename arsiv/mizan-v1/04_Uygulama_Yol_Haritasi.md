# 4. Kapsamlı Uygulama Yol Haritası
## Önerilen süre: 12 ay | Önce araştırma ve tasarım partneri, sonra ürünleşme

## Faz 0 — Vizyon, pilot ve güvenlik sınırları
**Süre:** 2 hafta

### Hedef
Ürünü "rapor yazan AI" değil, danışmanlık iş akışını güvence altına alan raporlama platformu olarak sabitlemek.

### Yapılacaklar
- 5–8 danışmanlık/raporlama lideriyle görüşme.
- Son 2 yıl içinden en az 3 faaliyet raporu, 3 sürdürülebilirlik raporu ve 1 CBAM veri setinin süreç haritasını çıkarma.
- En maliyetli üç problemi ölçme: veri toplama, hesap kontrolü, tasarım sonrası revizyon.
- İlk pilot segmentini seçme: ör. Türkiye'de TSRS/GRI raporu hazırlayan üretim şirketleri ve danışmanları.
- Hukuki/denetim sınırlarını ürün sözleşmesi ve UI dili için belirleme.

### Çıkış kriteri
Tek sayfalık problem tanımı, 2 tasarım partneri niyeti ve ilk MVP başarı ölçütleri.

---

## Faz 1 — AB ve Türkiye düzenleyici araştırma programı
**Süre:** 6 hafta; Faz 0 ile kısmen paralel

### Hedef
Sürüm, yürürlük, uygulanabilirlik ve kaynak bakımından denetlenebilir ilk Standart Kütüphanesini oluşturmak.

### Yapılacaklar
- AB faaliyet raporu / management report / ESEF haritası.
- AB CSRD/ESRS/Omnibus/VSME/Taxonomy değişiklik günlüğü.
- Türkiye faaliyet raporu: TTK, yıllık faaliyet raporu yönetmeliği, SPK II-14.1 ve ilk pilot sektör paketi.
- Türkiye sürdürülebilirlik raporu: TSRS 1–2, kapsam kararı, geçiş hükümleri, GRI eşleme notu.
- CBAM definitive-period kanıt ve tutarlılık matrisi.
- Her kaynak için `in-force / draft / proposed / superseded` durumu.
- Uzman doğrulama toplantıları ve açık konu listesi.

### Teslimatlar
1. 100–150 satırlık ilk standart/disclosure kayıt defteri.
2. Uygulanabilirlik karar ağacı.
3. TR faaliyet raporu + TSRS + GRI başlangıç indeksleri.
4. CBAM test senaryoları ve veri sözlüğü.

### Çıkış kriteri
Her otomatik önerinin hangi resmi kaynağa dayandığı gösterilebilir olmalı.

---

## Faz 2 — Bilgi mimarisi ve deneyim tasarımı
**Süre:** 4 hafta

### Hedef
Standart–veri–kanıt–kontrol–rapor bölümü ilişkisini ürün veri modeline dönüştürmek.

### Yapılacaklar
- Corporate Master Profile bilgi mimarisi.
- Report Blueprint / Index Composer wireframe'leri.
- Veri talep, onay ve revizyon akışları.
- Evidence Graph ve Report Relationship Map prototipleri.
- Quiet Assurance tasarım sistemi: renk, tipografi, hata/uyarı durumları, erişilebilirlik.
- Word çıktı şablon sözleşmesi: heading, tablo, dipnot, chart data, TR/EN blokları.

### Çıkış kriteri
İki danışmanlık kullanıcısı, kliklenebilir prototip üzerinde baştan sona bir rapor akışını anlayabilmeli.

---

## Faz 3 — Platform omurgası ve multi-tenant çekirdek
**Süre:** 8 hafta

### Hedef
Güvenli, çok müşterili ve izlenebilir raporlama workspace'ini kurmak.

### Yapılacaklar
- Tenant, organisation, project, reporting cycle, entity/site/product veri modeli.
- Rol tabanlı erişim ve tenant izolasyonu.
- Audit log, sürümleme, belge depolama, retention politikası.
- Rapor projesi açma, şirket profili, rapor türü ve standart paketi seçimi.
- Index Composer'ın ilk sürümü.
- Excel şablonu ve manuel veri girişi.

### Çıkış kriteri
Bir danışmanlık tenant'ı iki müşteri için ayrı workspace açabilmeli; kullanıcı/rol, proje, indeks ve veri talebi oluşturabilmeli.

---

## Faz 4 — TR raporlama MVP'si: faaliyet raporu + TSRS/GRI
**Süre:** 8 hafta

### Hedef
İlk gerçek müşteri iş akışını tasarıma hazır Word taslağına kadar uçtan uca tamamlamak.

### Yapılacaklar
- Türkiye faaliyet raporu asgari içerik paketinin ilk sürümü.
- TSRS 1/2 başlangıç paketi.
- GRI Universal 1/2/3 ve seçilmiş konu standardı eşlemesi.
- Veri / belge talep ekranları, owner ve deadline akışı.
- Kural motoru v1: birim, dönem, toplam, yüzde, kaynak, sürüm kontrolleri.
- Bölüm bazlı durum ve onay akışı.
- Word Report Compiler v1.

### Pilot başarı kriterleri
- En az bir gerçek veya anonimleştirilmiş 2026 raporu platformda üretilir.
- En az 50 veri noktası, 20 kaynak belge, 15 rapor bölümü ve 30 kontrol kuralı işlenir.
- Tasarım ekibine Word paketi + chart-data eki verilir.
- Tasarım sonrası veri revizyonu gelen 5 örnek değişiklik takip edilir.

---

## Faz 5 — Claude destekli kanıt ve kalite asistanı
**Süre:** 6 hafta

### Hedef
AI'ı kontrollü, kaynaklı ve insan onaylı biçimde gerçek iş akışına katmak.

### Yapılacaklar
- LLM Gateway ve sağlayıcı soyutlama katmanı.
- Doküman retrieval ve kaynak atıf sistemi.
- "Eksik kanıt" / "çelişkili değer" / "açıklama gerektirir" önerileri.
- Kaynaklı metin taslağı ve soru taslağı.
- TR/EN metin-kPI tutarlılık incelemesi.
- Prompt injection, model loglama, insan onayı ve red-team testleri.

### Çıkış kriteri
AI'ın her önerisi ya kaynakla bağlı olmalı ya da belirsizliği açıkça belirtmelidir. Kaynak dışı serbest rapor metni üretimi kapalı olmalıdır.

---

## Faz 6 — CBAM Evidence & Consistency MVP
**Süre:** 8 hafta

### Hedef
CBAM için tek bir ürün ailesi/sector üzerinde güçlü, uzman kontrollü pre-verification workspace oluşturmak.

### Yapılacaklar
- İlk sektör seçimi: erişimi olan demir-çelik, alüminyum, çimento veya benzeri bir alan.
- Ürün–tesis–üretim–enerji–emisyon–kanıt veri modelinin kurulması.
- Kural motoru: birim, dönem, ürün miktarı, tesis sınırı, tahsis ve anomali kontrolleri.
- Evidence Graph.
- Danışman sorun listesi ve CBAM kanıt paketi.
- Akredite doğrulayıcı / CBAM uzmanı ile en az iki test senaryosu incelemesi.

### Çıkış kriteri
Sistem, birden çok kaynaktan gelen CBAM girdilerindeki önceden tasarlanmış tutarsızlıkların en az %90'ını yakalayabilmelidir.

---

## Faz 7 — İnteraktif KPI Studio ve report relationship map
**Süre:** 5 hafta

### Hedef
Sıkıcı kurumsal raporlama verisini güvenilirliği bozmadan daha anlaşılır ve daha etkileyici hale getirmek.

### Yapılacaklar
- Onaylı veri setinden grafik şeması üretimi.
- Trend, hedef, yoğunluk, tesis/ürün karşılaştırması ve akış görselleri.
- Tooltips: tanım, birim, dönem, metodoloji ve evidence linki.
- PDF yerine geçmeyen, embed edilebilir mikro-site / dashboard bileşenleri.
- Report Relationship Map: farklı raporlardaki ortak metrik ve kaynakları görsel ağ olarak gösterme.

### Başarı kriteri
Bir kullanıcı, grafikteki her KPI'ın dönemini, kapsamını ve veri kaynağını iki tıklamadan az sürede görebilmelidir.

---

## Faz 8 — Pilot, güvence hazırlığı ve ürünleşme
**Süre:** 8 hafta

### Hedef
2–3 tasarım partneriyle canlı kullanım, güvenlik doğrulaması, tekrar kullanılabilir standart paketleri ve ticari hazırlık.

### Yapılacaklar
- 2 danışmanlık tenant'ı ve 3 müşteri workspace'i ile pilot.
- Kullanılabilirlik testi, rol/izin testi, veri izolasyon testi.
- Regülasyon güncelleme SLA'sı ve uzman paneli.
- Pilot sonrası backlog önceliklendirme.
- Beyaz etiket ve danışmanlık lisans paketi taslağı.
- Ücretsiz Reporting Readiness Check landing experience.

### Çıkış kriteri
- Rapor hazırlık süresinde hedeflenen ölçülebilir iyileşme.
- Kritik veri/rol izolasyonu açığı olmaması.
- En az iki pilot kullanıcının bir sonraki dönem için devam niyeti.

---

## Faz 9 — AB paketi ve ölçekleme
**Süre:** Ay 10–12 ve devamı

### Hedef
Türkiye çekirdeğini koruyarak seçilmiş AB pazarları için ESRS/management report kapsamını genişletmek.

### Yapılacaklar
- Önce tek bir AB ülkesini, ardından ikinci ülkeyi seçmek.
- ESRS/CSRD/VSME/Taxonomy paketlerini resmi değişiklik günlüğü ile yönetmek.
- ESEF/KAP/Registry doğrudan gönderim yerine önce export ve pre-flight kontrolü.
- Sektör paketleri: üretim, finans, enerji vb.
- Danışmanlık firmaları için white-label, SSO ve API.

## 12 aylık başarı metrikleri

| Alan | Hedef |
|---|---|
| Pilot | 2 danışmanlık + 3 kurumsal müşteri workspace'i |
| Veri kalitesi | Kural motorunda kritik test vakalarının ≥ %90'ını yakalama |
| Kaynaklı AI | AI önerilerinin %100'ünde kaynak veya "belirsiz" işareti |
| Operasyon | Veri toplama / takip süresinde ≥ %25 azalma hedefi |
| Tasarım handoff | Onay sonrası tasarım veri revizyonlarında ≥ %30 azalma hedefi |
| Güvenlik | Tenant izolasyonu ve kritik rol testlerinde 0 yüksek risk bulgu |
| Regülasyon | Kritik resmi değişiklikler için 5 iş günü triage hedefi |
