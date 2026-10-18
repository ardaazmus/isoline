# Isoline yol haritası (17.10.2026 itibarıyla)

Her faz bir **kontrol noktasıyla** biter. Bir sonraki faz, kontrol noktasındaki denetim geçmeden başlamaz.

## Faz 1 — Çalışan araç seti (tamamlandı, v0.1)

- **Araçlar:** 15 ekran; kapsam testi, mevzuat takvimi, rapor akışı, karbon/çevre/sosyal hesaplayıcılar, faaliyet raporu kontrolü, 11 Word şablonu, çerçeve eşleme.
- **Dil:** JSON tabanlı, dosya bırakılarak eklenebilir; Türkçe ve İngilizce hazır.
- **Görsel dil:** mavi dünya üzerinde aile renk hiyerarşisi (karbon toprak-turuncusu, çevre su mavisi, insan yeşil, raporlama lacivert), cam bento döşemeler, gren dokulu sonuç bandı; yalnız açık tema.
- **Testler:** 40 birim, özellik tabanlı ve dil eşitliği testi.

**Kontrol noktası:** uzman paneli, DOĞRULANAMADI işaretli 8 konuyu birincil metinden teyit eder (README'deki liste). Sonuçlar `sources.ts` dosyasında `official` olarak güncellenir.

## Faz 2 — Veri doğruluğu ve faktör kütüphanesi (sürüyor)

Tamamlanan (17.10.2026): birincil kaynak doğrulaması ([DOGRULAMA_2026-10.md](DOGRULAMA_2026-10.md)), envanter için CSV toplu yükleme, kapsam testinde küçük finans kuruluşu muafiyeti ve AB dışı iki yıl ciro kuralı. Faz 4'ten öne alınanlar: yeşil iddia denetimi, SKDM operatör veri özeti.

Tamamlanan (18.10.2026): faktör kütüphanesi ve "kendi faktörünü getir" modülü; resmi SKDM varsayılan değerleri (Türkiye, 2026/1740, toplam sütunu, "diğer ülkeler" kuralıyla 260 satır); EEA ENER038 2024 şebeke yoğunlukları (27 üye ülke ve AB-27); Türkiye dışındaki tesisler için konum bazlı şebeke faktörü. Ham kaynaklar ve SHA-256 özetleri: [kaynak-veri/](kaynak-veri/README.md).

Tamamlanan (18.10.2026): uzlaştırma kuralları v1 tarayıcıda (U1–U5, U8–U10; motor `web/src/lib/reconcile.ts`, ekran "Uzlaştırma"). Kuralların kimliği, ciddiyeti, toleransı ve dayanağı var. Her sonuç değerleri ve açıklamasıyla CSV/JSON olarak dışa aktarılıyor. Yeşil iddia metni artık müşteriye kaydediliyor ve U10 aynı metni denetliyor.

Tamamlanan (18.10.2026): mizan içe aktarma (Excel xlsx/xls, OpenDocument, CSV; SheetJS 0.20.3 resmi dağıtımı, tarayıcıda). Başlık satırı kendiliğinden bulunuyor, alt hesaplar ana hesaplarda çift sayılmadan toplanıyor, borç = alacak dengesi ve kapanış durumu denetleniyor, dosyanın SHA-256 özeti kanıt olarak saklanıyor. Net satışlar U1'de referans. Açık: Tekdüzen Hesap Planı kodlarının resmi metinden uzman teyidi; CapEx için sabit kıymet hareket tablosu (Faz 5, U6–U7).

Tamamlanan (18.10.2026): envanter ve göstergeler için Excel (xlsx, xls, ods) ve CSV içe aktarma. Göstergeler tesis ve dönem bazında, satır başına bir gösterge olarak okunuyor. Akışlar toplanıyor; dönem sonu sayıları her tesisin son döneminden alınıyor; birimler çevriliyor (MWh, kWh, TEP, ML, kg, %). Her içe aktarma dosya adı, SHA-256 özeti ve satır sayısıyla müşterinin içe aktarma kaydına işleniyor.

Tamamlanan (18.10.2026): sürümlü faktör tabloları.
- ETKB 2020–2023 yıllık sürümleri; değerler PDF'lerden aktarıldı ve belgelerle makineyle karşılaştırıldı.
- DESNZ 2026 Kapsam 3 seçkisi (51 faktör, OGL v3); Kapsam 3 kategorisine göre öneriliyor.
- TÜİK ulusal envanter 2026 (2024 ısıl değerleri ve CO₂ faktörleri).
- Envanter yılına göre sürüm seçimi; yeni sürümde önce/sonra raporlu geriye dönük yeniden hesap ve %5 anlamlılık uyarısı (SBTi kriteri C27; GHG Protokolü eşiği şirkete bırakır).
- Kaynaklar ve SHA-256 özetleri: [kaynak-veri/](kaynak-veri/README.md).

Tamamlanan (18.10.2026): SKDM resmi kıyas değerleri ve rota eşlemesi.
- Uygulama Tüzüğü 2025/2620 Ek nokta 5.3 (570 KN satırı) alındı; Resmî Gazete PDF'iyle 570/570 eşleşti.
- Varsayılan değerde B sütunu, Türkiye varsayılan tablosunun rotasıyla kullanılıyor; birden fazla alaşım değeri varsa en yükseği, üretim yılına göre (1)/(2) değeri.
- Gerçek veride A sütunu ile öncül malzeme payı toplanıyor (varsayılan pay: B − A); rota seçilebiliyor.
- Örnek kıyas yer tutucuları kaldırıldı; elle kıyas girmek yalnız bilinçli tercih olarak duruyor.

Tamamlanan (18.10.2026): SKDM menşe ülke seçimi.
- Çin, Hindistan, Ukrayna, Mısır ve "diğer ülkeler" varsayılan değer tabloları eklendi; "diğer ülkeler" yedeği uygulanıyor. Resmî Gazete ile karşılaştırıldı: 1.482/1.482.
- Ürüne menşe ülke seçimi geldi: varsayılan değer tablosu, kıyas rotası ve operatör özeti menşeye göre. Ülke değişince kütüphaneden seçilmiş değer aynı KN satırına geçiyor.

Tamamlanan (18.10.2026): doğrulama paketi ([web/validation/](../web/validation/README.md)).
- 16 vaka ve 127 kontrol; hepsi uygulamanın gerçek hesap motorlarında çalışıyor (`npm run validate`).
- 9 vaka yayımlanmış kaynaktan alındı: AB SKDM rehberlerinin çözümlü örnekleri (çimento, ray, hidrojen, varsayılan değer ve kıyas, SKDM faktörü tablosu), US EPA'nın çözümlü örneği ve bir GHGRP tesis kaydı, GHG Protokolü Kapsam 2 tabloları. En büyük sapma %0,14.
- 7 vaka sentetik; beklenen değerleri tam kesir aritmetiğiyle hesaplandı: üç test profili, %5 eşiği, 10.238 satırlık mizan, uzlaştırma eşikleri.
- Bulgu: AB'nin çelik rehberi (5d) sertifika hesabına dolaylı emisyonu da katıyor. Tüzük Ek II ve Rehber No. 1 buna aykırı. Uygulama tüzüğü izliyor; fark vaka notunda belgelendi.

Tamamlanan (18.10.2026): yakmada CH₄ ve N₂O ([kaynak-veri/ipcc/](kaynak-veri/ipcc/README.md)).
- Her yakıt satırı CO₂, CH₄ ve N₂O'yu ayrı hesaplıyor; CO₂e için AR6 GWP kullanılıyor (fosil CH₄ 29,8; N₂O 273).
- Varsayılanlar IPCC 2006'dan, Türkiye ulusal envanterinin uyguladığı gibi: sabit yakmada Tablo 2.3; araçlarda Tablo 3.2.2; gemide Tablo 3.5.3; demiryolunda Tablo 3.4.1. Değerler satırda değiştirilebiliyor.
- Sonuç ekranında Kapsam 1 gaz dökümü var: kütle, GWP ve tCO₂e.
- Envanter şablonu ve özel faktör CSV'si `ch4` ve `n2o` sütunlarını okuyor. Kayıtlı çalışma alanları v7 göçüyle değerleri açıkça satıra yazıyor.
- Etki: Örnek müşteride Kapsam 1 %0,7 arttı. Araç ağırlıklı envanterlerde artış %1,5–4 olabilir; SBTi'nin %5 yeniden hesap eşiğinin altında kalsa da baz yıl karşılaştırmasında açıklanmalı.

Tamamlanan (18.10.2026): raporlama incelemesinin doğrulanması ([DENETIM_RAPORLAMA_2026-10.md](DENETIM_RAPORLAMA_2026-10.md)).
- Dış ajanın raporundaki 9 kod hatasından 7'si doğru, 2'si kısmen doğru çıktı; hepsi düzeltildi ve testlendi:
  - gerçek "bugün" tarihi;
  - Türkçe yeşil iddia ekleri;
  - CSV formül kaçışı;
  - faaliyet raporu Word çıktısı;
  - görünür dışa aktarma hataları;
  - içe aktarma doğrulaması;
  - kaynaklı takvim tarihleri;
  - SKDM menşe değişimi;
  - `xlsx` paketinin depoya alınması;
  - `next typegen`.
- İnceleme sırasında iki hata daha bulundu ve düzeltildi:
  - TR ETS izleme planı süresi 27.01.2027'ye uzatılmış (Olur 13.10.2026/18814);
  - %5 yeniden hesap eşiği GHG Protokolü'ne değil SBTi'ye (C27) ait.
- Raporun iş akışı sadeleştirildi: 5 adım, 3 rol, 4 durum, 3 görünürlük düzeyi.

Tamamlanan (18.10.2026): onay durumu ve dönem kilidi (iş akışı 4. adım; Faz 4'ten öne alındı).
- 11 araç bölümü (envanter, SKDM, TR ETS, yol, önemlilik, çevre, çalışan, taksonomi, mizan, uzlaştırma, yeşil iddia) Taslak → Kontrolde → Onaylandı (kilitli) → Yayımlandı akışında ilerliyor.
- Hazırlayan kendi işini onaylayamıyor. Geri gönderme ve yeniden açma gerekçe istiyor. Her geçiş silinmeyen bir geçmişe yazılıyor.
- Onaylanan bölümün girdileri ekranda pasif. Depo da kilitli bölüme yazmayı reddediyor; "örneğe dön" ve araç içinden dosya içe aktarma da bu kurala takılıyor. Ortak `indicators` verisinde çevre ve çalışan bölümleri ayrı kilitleniyor.
- Word çıktıları "Hazırlayan / Onaylayan / tarih / durum" bloğunu basıyor. Onaylanmamış veri kullanılıyorsa belge "TASLAK" uyarısı taşıyor.
- Genel bakışta bütün bölümlerin onay tablosu var.
- Kayıtlı çalışma alanları v8 göçüyle onay kaydı alıyor.
- v1'de hesap yok: kişiler yazılan adlarla kaydediliyor. Kimlik doğrulama Faz 3'te gelecek.

Tamamlanan (18.10.2026): veri talep listesi (iş akışı 1–2. adım; Faz 4'teki PBC listesinin tarayıcıdaki ilk sürümü).
- "Veri talepleri" ekranı raporlama grubunda. Liste, hazırlanacak raporlardan çıkıyor: kapsam testi şablonları öneriyor, kullanıcı ekleyip çıkarabiliyor.
- 39 veri kalemi araç girdilerinden türetildi. Her kalemde onay bölümü, sorumlu birim (finans, İK, İSG, üretim, sürdürülebilirlik), kaynak belge, birim ve dönem var.
- Yeni gereklilik eklenmiyor: kalem ancak seçilen bir şablon bölümü onun aracını kullanıyorsa listeye giriyor. Dayanak olarak o bölümün atıfları gösteriliyor.
  - Bölümün adıyla sınırladığı veri noktaları dışarıda kalıyor. Örnek: TSRS iklim-önce yalnız Kapsam 1–2 istiyor.
  - Çapraz tabloda karşılığı "—" olan veri noktaları da dışarıda. Örnek: VSME'de Kapsam 3 yok.
  - Mizan, faaliyet raporunun finansal durum bölümüne (Yön. md. 12) bağlandı; uzlaştırma, TSRS hazırlama esaslarına (finansal tablolarla bağlantı).
- Her kalem için sorumlu kişi, son tarih, durum (gönderilmedi, talep edildi, teslim alındı, kabul edildi) ve not tutuluyor. Son tarihi geçen ve teslim alınmayan kalem gecikmiş sayılıyor.
- Kabul edilen kalem, aracının son dosya içe aktarma kaydına bağlanıyor: dosya, tarih, SHA-256.
- Onaylanan bölümün kalemleri ekranda ve depoda kilitli.
- Liste, süzgeçle birlikte CSV ya da Excel olarak birime veya müşteriye gönderiliyor. Doldurulmuş hâli geri yükleniyor; önizleme değişiklikleri ve sorunlu satırları gösteriyor.
- Birim başına ad ve ortak son tarihle toplu atama yapılabiliyor. Gönderilen kalemler tek düğmeyle "talep edildi" yapılabiliyor.
- Kayıtlı çalışma alanları v9 göçüyle talep listesi alıyor. CSV formül kaçışı artık kendi çıktısını her durumda birebir geri okuyor.

Tamamlanan (18.10.2026): elle girişte kaynak notu (iş akışı 2. adım, "her değerin arkasında kanıt").
- Dokuz araç ekranının giriş panelinde "Kaynak belgeler" grubu var: envanter, SKDM, TR ETS, yol, önemlilik, çevre, çalışan, taksonomi, uzlaştırma. Her veri kalemi için belge adı ya da numarası ve belge tarihi giriliyor.
- Not, veri talep listesindeki kayıtla aynı yerde tutuluyor. Talep listesinde görünüyor ve düzenlenebiliyor; CSV ve Excel dosyasında "Teslim edilen belge" ve "Belge tarihi" sütunlarıyla gidip geliyor.
- Kanıt: dosya içe aktarma kaydı (SHA-256) ya da belge adı. İlerleme tablosu bölüm başına belgeli kalem sayısını gösteriyor. Kanıtsız kabul edilen kalemde uyarı var.
- Onaylı bölümün notları ekranda ve depoda kilitli. Ek göç gerekmedi: not, mevcut v9 kaydına isteğe bağlı alan olarak eklendi.

Kod dışında yapılacak iş:
- Uzman teyitleri.
- IEA lisans görüşü.

Kodda yapılacak iş:
- **Faktör kütüphanesi:** TÜİK 2023 ısıl değerleri (ortak raporlama tabloları indirilebildiğinde); ETKB 2024 sürümü yayımlandığında eklenmesi.
- **SKDM:** gerektikçe başka menşe ülke tabloları (Türkiye, Çin, Hindistan, Ukrayna, Mısır ve diğer ülkeler tamam).
- **TR ETS:** Başkanlık kıyas değerleri ve Ulusal Tahsisat Planı yayımlanınca parametre güncellemesi.
- **SBTi V2.0:** Ç4 2026'da yayımlanacak yöntemlerin eklenmesi.

**Kontrol noktası:** 3 gerçek, anonimleştirilmiş müşteri verisiyle hesapların bağımsız tabloyla karşılaştırılması (sapma < %0,5). Paket hazır; müşteri verisi geldiğinde her biri bir vaka dosyası olarak eklenir. Kontrol noktası, bu üç vaka geçince kapanır.

## Faz 3–6 — Denetime hazır platform

17.10.2026'da hedef yeniden tanımlandı: finans ve ESG verisini aynı omurgada birleştiren, her sayıyı kanıta bağlayan ve bağımsız denetçiye onaya hazır paket sunan platform. Ayrıntılar, veri modeli, iş akışı ve teknik seçimler: [HEDEF_MIMARI.md](HEDEF_MIMARI.md). Raporlama iş akışının sade hâli ve açık işlerin sırası: [DENETIM_RAPORLAMA_2026-10.md](DENETIM_RAPORLAMA_2026-10.md) §2 ve §4.

| Faz | Kapsam | Kontrol noktası |
|---|---|---|
| 3 — Platform çekirdeği | Kimlik doğrulama, kiracı/müşteri/rol modeli, PostgreSQL + RLS, veri noktası sicili, sürümleme, kanıt deposu (SHA-256), olay günlüğü | İki kiracıyla izolasyon testi, olay günlüğü bütünlük testi |
| 4 — Denetime hazır paket | Durum makinesi, onay ve kilit, PBC listesi, denetçi çalışma alanı (ISSA 5000 / GDS 3000 adımlarına eşli) | Bir güvence kuruluşuyla deneme denetimi |
| 5 — Boşluk analizi ve yapay zekâ | Gereklilik haritası, olgunluk puanı, kaynaklı taslak yazımı, yatırım ↔ etki uzlaştırması | Yapay zekâ önerilerinin tamamında kaynak ya da "kanıt yetersiz" ibaresi |
| 6 — Entegre rapor ve dijital çıktı | Entegre rapor şablonu, ESRS iXBRL, e-Defter (XBRL-GL) içe aktarma, KAP ön kontrolü | Pilot müşteriyle uçtan uca raporlama döngüsü |

Faz 2'ye eklenenler: uzlaştırma kuralları v1 (tarayıcıda) ve Excel'den mizan içe aktarma.

## Ticari notlar (araştırma D)

- **Konumlanma:** Türkiye'de danışmanlık firmaları için tarafsız, çok müşterili ve TSRS'yi esas alan görsel araç boşluğu var.
- **Ürün kapsamı:** faaliyet raporu ile sürdürülebilirlik raporu tek motorda üretiliyor; SKDM maliyet simülatörü AB ithalatçısına veri paketi de çıkarıyor.
- **Acil fırsat:** TR ETS pilot tesisleri için izleme planı son tarihi 27.01.2027 (ilk süre 27.10.2026 idi; Olur 18814 ile uzatıldı).
- **Hibe:** Ticaret Bakanlığı danışmanlık hibesi (%50) hedef kullanıcıyı finanse ediyor.
