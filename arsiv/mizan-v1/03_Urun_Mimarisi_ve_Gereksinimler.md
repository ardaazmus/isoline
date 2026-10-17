# 3. Ürün Mimarisi ve Gereksinimler

## 3.1 Çekirdek deneyim
MİZAN'ın kullanıcı deneyimi şu akışı izler:

```text
Kapsamı belirle
→ Rapor blueprint/index oluştur
→ Veri ve kanıt taleplerini ata
→ Hesapla ve doğrula
→ Tutarsızlıkları çöz
→ Kaynaklı metin taslağını oluştur
→ İnsan onayı al
→ Word rapor paketi üret
→ Seçilmiş KPI'ları interaktif sun
```

## 3.2 Ana modüller

### 1. Reporting Profile & Applicability Engine
Şirket; ülke, hukuki yapı, halka açıklık, sektör, çalışan/ciro/aktif, grup yapısı, tesisler, raporlama dönemi ve hedef pazarlara göre profillenir. Sistem ilgili standart paketlerini önerir; öneri her zaman danışman onayı gerektirir.

### 2. Corporate Master Profile
Kurumsal tanıtım, tarihçe, faaliyet alanları, tesisler, ürünler, iş modeli, değer zinciri, yönetim, grup yapısı, politikalar ve onaylı şirket anlatısı bir kez tutulur. Yıllık değişiklik görevi oluşturulur.

### 3. Report Blueprint / Index Composer
Her rapor için zorunlu, koşullu ve editoryal bölümlerden oluşan indeks oluşturur. Her bölüm; içerik sahibi, gerekli veri, kanıt, dil, onaylayan, Word stili ve tasarım notuna bağlanır.

### 4. Data & Evidence Room
Excel/API/form/PDF ile veri girişi; dönem, birim, kapsam, tesis, ürün, kaynak belge, veri sahibi, metodoloji ve onay kaydıyla yapılır.

### 5. Calculation Library & Rules Engine
Tüm tekrar edilebilir hesaplar kural tabanlı kodla çalışır. Formül sürümü, kaynak standardı, girdi alanları, birim dönüşümü, yuvarlama, raporlama sınırı ve test senaryosu saklanır.

### 6. Consistency & Quality Engine
- Toplam/alt toplam, yüzde, birim ve dönem kontrolü
- Önceki yıl sapma analizi
- Raporlar arası ortak veri kontrolü
- Tesis/ürün/organizasyon sınırı kontrolü
- Kaynak/kanıt eksikliği
- Metrik tanımı veya metodoloji değişikliği uyarısı
- TR/EN içerik ve KPI eşleme kontrolü

### 7. CBAM Evidence & Consistency Module
Ürün → tesis → üretim → enerji/yakıt → emisyon faktörü → tahsis → kanıt → uzman notu zincirini tutar. Sistem akredite doğrulamanın yerine geçmez; doğrulama öncesi kalite kontrol ve kanıt hazırlığı sağlar.

### 8. AI Evidence Assistant
Claude varsayılan sağlayıcı olabilir; mimari çok sağlayıcılı LLM Gateway ile kurulmalıdır. AI yalnızca izinli tenant/workspace içeriğine ve sürümlü standart paketlerine erişir.

AI görevleri:
- belge içinden kanıt bulma,
- tablodan yapılandırılmış veri çıkarma,
- eksik/çelişkili bilgi tespiti,
- kaynaklı soru taslağı,
- kaynaklı anlatı taslağı,
- raporlar arası fark analizi,
- Türkçe–İngilizce anlam/tutarlılık kontrolü.

**Kural:** Kaynak yoksa model `kanıt yetersiz` demelidir. Sayısal hesap, uyumluluk kararı ve zorunluluk tespiti yalnızca onaylı kural motoru + insan incelemesi ile tamamlanır.

### 9. Word Report Compiler
.docx şablonları; heading stilleri, tablolar, içerik blokları, evidence ID/dipnot, grafik veri ekleri, açık risk listesi ve TR/EN içerik ile üretilir. Word çıktı sistemin veri kaynağı değildir; sistemdeki onaylı içerikten derlenir.

### 10. Interactive KPI Studio
PDF'in yerine geçmeyen, seçilmiş doğrulanmış verileri daha canlı göstermek için kullanılır:
- trend çizgileri,
- hedef ilerleme halkaları,
- tesis/ürün karşılaştırması,
- emisyon/enerji/su/atık akışları,
- yıl karşılaştırma animasyonları,
- tooltip içinde birim, dönem, kapsam ve evidence linki.

İnteraktif görsel sadece onaylı ölçümden beslenir. Kullanıcıya veri tanımı ve kaynak gösterilir.

## 3.3 Multi-tenant yetkilendirme modeli

```text
Platform owner
└── Consultancy tenant
    ├── Client organisation
    │   ├── Reporting cycle
    │   │   ├── Entity / site / product
    │   │   ├── Report project
    │   │   └── Evidence / data / approvals
    │   └── Next reporting cycle
    └── Other client organisation
```

Temel roller: platform admin, tenant admin, project lead, technical expert, client data owner, client approver, reviewer/auditor, agency delivery user, read-only user.

Gereksinimler: satır düzeyi tenant izolasyonu, workspace düzeyi belge yetkisi, değiştirilemez audit trail, sürümleme, veri saklama politikası, silme/retention politikası ve model çağrısı logları.

## 3.4 Görsel dil — Quiet Assurance
- Sıcak kırık beyaz, taş grisi, yumuşak adaçayı, soluk petrol, koyu orman mürekkebi.
- Risklerde parlak alarm kırmızısı yerine erişilebilir amber/kiremit tonları.
- Bol boşluk, sakin editoryal tipografi, ince gridler, düşük yoğunluklu mikro animasyonlar.
- ESG klişesi olan yaprak/dünya küresi yerine kanıt çizgileri, dönem katmanları ve veri akışları.
- "Report Relationship Map" ekranı: faaliyet raporu, sürdürülebilirlik raporu ve CBAM paketinin ortak veri/kaynak ilişkisini görsel olarak gösterir.

## 3.5 Veri güvenliği ve AI güvenlik kuralları
- Belgeler tenant sınırının dışına çıkarılamaz.
- Varsayılan olarak müşteri verisi model eğitimi için kullanılmaz; sağlayıcı/sözleşme koşulları tenant'a açıkça gösterilir.
- Her AI sonucu kaynak, model, sürüm, prompt şablonu ve insan onay durumuyla loglanır.
- Yüklenen belgeler güvenilmeyen içeriktir; prompt injection'a karşı belge talimatları sistem talimatı olarak çalıştırılmaz.
- Hassas kişisel veri, ticari sır ve finansal içerik için sınıflandırma/maskeleme politikası uygulanır.
