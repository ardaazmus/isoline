# Raporlama iş akışı ve denetim hazırlığı: doğrulanmış inceleme (Ekim 2026)

> **Bu belge ne?** `arena/6619455b-isoline` dalındaki 58c5740 commit'iyle gelen "Kapsamlı raporlama raporu"nun doğrulanmış ve sadeleştirilmiş hâlidir. İlk sürüm o dalda duruyor.
>
> **Nasıl doğrulandı?**
> - Kod iddiaları kodda denendi; doğru çıkan hatalar düzeltildi ve testlendi.
> - Mevzuat iddiaları birincil metinden okundu: Resmî Gazete, mevzuat.gov.tr, SPK, KGK, Bakanlık, EUR-Lex, IAASB, SBTi.
> - Rakip ürün iddiaları ürünlerin kendi sayfalarından kontrol edildi.
> - Tarih: 18.10.2026. Hukuki görüş değildir.

## 1. Kısa sonuç

1. **Kod.** Raporun 9 hata iddiasından 7'si doğru, 2'si kısmen doğru çıktı. Hepsi düzeltildi ve testlendi.
   - İnceleme sırasında uygulamada iki hata daha bulundu ve düzeltildi:
     - TR ETS izleme planı son tarihi 27.01.2027'ye uzatılmış, uygulama eski tarihi gösteriyordu.
     - %5 yeniden hesap eşiği GHG Protokolü'ne atfediliyordu; doğru kaynak SBTi.
   - Test sayısı 253'ten 267'ye çıktı.
2. **Mevzuat.** Raporun çerçevesi doğru, ayrıntılarda çok hata var. Yanlış ya da güncel olmayanlar:
   - ESRS düzenleme numarası;
   - "beş güvence iddiası";
   - SKDM için "XML" vaadi ve "SFA" kısaltması;
   - TR ETS izleme planı tarihi;
   - faaliyet raporunun "kamuya açık" sayılması;
   - Kapsam 3 muafiyetinin yeri;
   - yeşil tahvil rehberi.
3. **Sektör.** Rakip iddialarının hiçbiri olduğu gibi tutmuyor; dördü kısmen doğru, biri yanlış (Certivo bir SKDM ürünü değil). Raporun yerli rakip listesi de eksikti: en az 11 yerli ürün var. Ancak çalışan bir TR ETS modülü ya da faaliyet raporu kontrolü sunan yerli ürün bulunamadı. Isoline'ın açık alanı bu ikisi.
4. **İş akışı.** Rapor 8 aşama, 3 kapı, 7 durum, 6 veri sınıfı ve 10 dışa aktarma kuralı öneriyordu. Güvence kuruluşları ile ürünlerin ortak paydası çok daha sade, ve bu belge onu öneriyor (Bölüm 2):
   - 5 adım,
   - 3 rol,
   - 4 durum,
   - 3 görünürlük düzeyi.

---

## 2. Sade iş akışı

### 2.1 Beş adım

| # | Adım | Kim | Ne yapılır | Kanıt | Uygulamada bugün | Eksik |
|---|---|---|---|---|---|---|
| 1 | **Planla** | Raporlama sahibi | Hangi raporların gerektiği (kapsam testi), raporlama sınırı, faktör seti ve hesap yöntemi belirlenir. Her veri için sahip ve son tarih atanır. | Sürümlü yöntem notu, veri talep listesi | Kapsam testi, faktör yılı ve sürüm seçimi | Veri talep listesi: sahip, son tarih, durum |
| 2 | **Topla** | Veri sahibi (finans, İK, İSG, üretim; danışmanlıkta müşteri) | Veri girilir ya da dosya yüklenir, her değere kaynak belge bağlanır | Dosya + SHA-256 özeti; elle girişte belge notu | Mizan, envanter ve gösterge içe aktarma; kanıt kaydı | Elle girilen alana kaynak notu; talep takibi |
| 3 | **Hesapla ve uzlaştır** | Hazırlayan | Hesap motorları çalışır, faktör sürümü seçilir, U1–U10 uzlaştırması yapılır, farklar açıklanır | Uzlaştırma kaydı (CSV/JSON) | Güçlü: motorlar, geriye dönük yeniden hesap, doğrulama paketi | U6–U7 kuralları |
| 4 | **Onayla ve dondur** | Onaylayan (hazırlayandan farklı kişi; danışmanlıkta müşteri) | Kabul ya da ret. Onaylanan dönem kilitlenir; sonraki değişiklik gerekçeyle yeniden açılır. | Onaylayanın adı ve zaman damgası, değişiklik kaydı | Durum yalnız faaliyet raporu kontrol listesinde | Durum ve kilit bütün veride |
| 5 | **Raporla ve teslim et** | Hazırlayan, yönetim onayıyla | Raporlar kilitli veriden alıntı yapar, yeniden hesaplamaz. Paket, güvence dosyasıyla birlikte KAP'a, otoriteye ya da ithalatçıya gider. | Paket künyesi: sürüm, onay, kaynaklar | Şablonlar Word'e, SKDM özeti ve uzlaştırma CSV'ye çıkıyor | Tek paket ve künye; denetçiye salt okunur erişim (Faz 4) |

Kaynakların ortak noktaları:
- yöntemin baştan yazılması;
- her değerin arkasında kanıt;
- hazırlayan ile onaylayanın ayrılması;
- dönemin dondurulması;
- güvence sağlayıcıya iz bırakılması.

Örnek kaynaklar: KPMG, PwC ve Deloitte güvence hazırlık notları; Persefoni, Sweep, Watershed ve Workiva ürün sayfaları (Bölüm 6).

### 2.2 Üç rol

| Rol | Yapar | Yapamaz |
|---|---|---|
| **Veri sahibi** | Kendi alanının verisini girer, belgeyi ekler | Hesaplayamaz, onaylayamaz |
| **Hazırlayan** | Hesaplar, uzlaştırır, metni yazar, paketi üretir | Kendi işini onaylayamaz (görev ayrılığı) |
| **Onaylayan** | Kabul eder ya da geri gönderir, dönemi kilitler | Veriyi değiştiremez; yalnız geri gönderir |

Dış denetçi ya da doğrulayıcının salt okunur erişimi ve yorum hakkı Faz 3–4'te gelir. Bugün denetçiye uzlaştırma kaydı ve kanıt listesi dosya olarak verilir.

### 2.3 Dört durum

```
Taslak → Kontrolde → Onaylandı (kilitli) → Yayımlandı
   ↑_________ geri gönder (gerekçe zorunlu) _________|
```

Raporun yedi durumu (Taslak, Girildi, Hesaplandı, Kontrolde, Onaylandı, Kilitli, Yayında) dörde iniyor. Gerekçesi:
- **"Girildi" ve "Hesaplandı"** kullanıcının verdiği bir karar değil; hesap motoru bunları kendiliğinden yapıyor.
- **"Kilitli"** onayın sonucu, ayrı bir adım değil.

Bu dört durum, [HEDEF_MIMARI.md §5.3](HEDEF_MIMARI.md)'teki platform durum makinesinin tek kullanıcılı çekirdeğidir. Eşleme:
- Taslak = Taslak;
- Kontrolde = Gönderildi + Gözden geçirildi;
- Onaylandı = Onaylandı + Kilitli.

Denetçi sorgusu (Sorgu → Düzeltme → yeniden onay) çok kullanıcılı platformla, Faz 4'te eklenir.

### 2.4 Üç görünürlük düzeyi

| Düzey | Kime | Örnek |
|---|---|---|
| **Kamuya açık** | Herkes | Borsa şirketinin KAP'taki faaliyet raporu ve TSRS raporu |
| **Yetkili** | Otorite, AB ithalatçısı, doğrulayıcı, denetçi, pay sahipleri | SKDM operatör verisi, TR ETS izleme planı, güvence dosyası, TTK faaliyet raporu |
| **İç** | Şirket ve danışmanı | Yönetim raporu, uzlaştırma açıklamaları, yeşil iddia bulguları |

Her çıktının ilk satırında düzeyi yazar. Bu üç düzey, raporun altı veri sınıfını (C0–C5), üç profilini ve on kuralını (R1–R10) karşılıyor.

İki kural düzeyden bağımsız ve kodda zorunlu olmalı:
- **Kişisel veri** yalnız toplulaştırılarak gösterilir, küçük gruplar gizlenir. KVKK'ya göre veri ancak gerçekten anonimse kişisel veri sayılmaz; birkaç kişilik bir grubun ortalaması hâlâ kişisel veridir.
- **İSG kaydı** sağlık verisidir, yani özel nitelikli kişisel veridir (KVKK md. 6).

**Düzeltme:** Faaliyet raporu her şirket için "kamuya açık" değildir.
- TTK şirketlerinde rapor, genel kuruldan 15 gün önce pay sahiplerinin incelemesine açılır (TTK 437/1).
- İnternet sitesi yönetmeliği raporun yayımını yalnız birleşmede ister (Md. 6/3-a).
- Borsa şirketlerinde KAP'ta yayım zorunludur (SPK II-14.1 md. 12/5).

### 2.5 Şirket içi ekip ile danışmanlık farkı

Beş adım aynı. Fark iki yerde:
- **2. adım:** Danışman her müşteri için talep listesi gönderir; veri sahibi müşteridir.
- **4. adım:** Onaylayan müşteri yöneticisidir; danışman hazırlayandır.

Bu rol ayrımı kaynaklarda açıkça yazmıyor; ürünlerin danışman modlarından çıkarılmış bir tasarım kararıdır.

### 2.6 Yıllık takvim (takvim yılıyla raporlayan Türk şirketi)

| Ne zaman | Ne | Dayanak |
|---|---|---|
| Ocak–Şubat | Veri toplama (mizan, göstergeler, faturalar) | Sektör pratiği, standart değil |
| Şubat sonu | TTK faaliyet raporu hazır | Yönetmelik 28395 md. 16: dönem sonundan itibaren 2 ay |
| 1 Mart / 11 Mart | Borsa şirketlerinde yıllık finansal rapor KAP'ta | SPK II-14.1 md. 10: 60 gün, konsolide tablo varsa 70 gün |
| Aynı gün | TSRS raporu | TSRS 1 ¶ 64: finansal tablolarla aynı anda. İlk yıl için Kapsam Kararı geçici md. 2 esneklik verir. |
| 31 Mart | Olağan genel kurul | TTK 409/1: 3 ay |
| 30 Nisan | TR ETS yıllık emisyon raporu | TR ETS Yönetmeliği md. 29 (1 ay uzatılabilir) |
| 30 Eylül | SKDM yıllık beyanı ve sertifika teslimi (ilk: 30.09.2027) | Tüzük 2023/956 md. 6, 2025/2083 ile değişik |
| Kasım son iş günü | TR ETS tahsisat teslimi | TR ETS Yönetmeliği md. 16 |
| **27.01.2027** | TR ETS pilot tesisleri ilk izleme metodolojisi planı | Geçici md. 3 (ilk süre 27.10.2026), Olur 13.10.2026/18814 ile uzatıldı |

Raporun "Ocak toplama → Haziran yayım" takvimi bir sektör pratiği, standart değil. Borsa şirketleri için de geç kalır: TSRS raporu finansal tablolarla, yani Mart başında yayımlanır.

---

## 3. Doğrulama sonuçları

### 3.1 Kod iddiaları

| # | İddia | Hüküm | Yapılan |
|---|---|---|---|
| A1 | "Bugün" tarihi 17.10.2026'da donmuş | **Doğru** | Gerçek tarih kullanılıyor (`useToday`). Statik sayfada derleme günü HTML'e gömülmüyor, tarih tarayıcıda okunuyor. 90 günlük pencere de bugünden hesaplanıyor. |
| A2 | Faaliyet raporu Word çıktısında hep ☐, sayı yok, dosya adı hep Türkçe | **Doğru** | Durum işaretleri ☑ / ☐ / — oldu. Her bölümde onay sayısı var; finansal bölümde mizandan net satışlar. Dosya adı dile göre, kaynaklar bağlantılı. |
| A3 | Türkçe yeşil iddia kalıplarında boşluk | **Doğru**, rapordan da geniş | Ekli hâller hiç yakalanmıyordu ("çevre dostudur", "karbon nötrdür", "zararsızdır"). Ek toleransı ve eksik ifadeler eklendi; "karbonsuzlaştırma" ve "zararsızlaştırma" yanlış alarm vermiyor. İngilizce listeye de eşdeğerleri eklendi. |
| A4 | CSV formül enjeksiyonu | **Doğru** | `=`, `+`, `-`, `@` ile başlayan metin hücreleri kaçışlanıyor; sayılar sayı kalıyor. Faktör seti CSV'si de kapsandı. |
| A5 | Temiz checkout'ta tip denetimi kırılıyor | **Doğru** | Betik `next typegen && tsc --noEmit` oldu. Next 16 belgesine göre bu tipler dev, build ya da typegen sırasında üretiliyor. |
| A6 | `xlsx` CDN'e bağlı, kurulum ağsız kırılıyor | **Kısmen doğru** | CDN, SheetJS'in resmi dağıtımı (npm'deki sürüm eski). Ama kurulumun ağa bağlı olması gerçek bir risk. Paket `web/vendor/` altına alındı; SHA-512 özeti aynı. |
| A7 | `!` iddiaları yüzünden Word çıktısı sessizce çöker | **Kısmen doğru** | Bugünkü sabitlerle `!` çökmez. Asıl sorun, dışa aktarma hatasının kullanıcıya gösterilmemesiydi. Hata artık ekranda; `!` kaldırıldı. |
| A8 | Çalışma alanı içe aktarma doğrulaması sığ | **Doğru** | Ekranların dayandığı alanlar denetleniyor; bozuk dosya baştan reddediliyor. Yolculuk ekranı kısa geçmişte çökmüyor. |
| A9 | Yolculuktaki tarihler kaynaksız gömülü | **Doğru** | Tarihler artık kaynaklı takvim verisinden okunuyor. Tarihlerden biri zaten eskimişti (bkz. 3.4). |
| B1–B7 | Raporlama katmanı eksikleri | **Doğru tespit** | Ürün işi; Bölüm 4'te sıraya konuldu. |
| N1 | SKDM menşe değişince eski ülkenin değeri kalıyor | **Doğru**; yan iddia yanlış | Kütüphaneden seçilmiş değer yeni tabloda aynı ya da kapsayan KN satırına taşınıyor. Satır yoksa bağlantı kalkıyor ve alan "elle girilmiş" uyarısı gösteriyor. Raporun "değeri sıfırla" önerisi uygulanmadı: sıfır, maliyeti sessizce düşük gösterir. Ekrandaki "{ülke} varsayılan tablosu" cümlesi değeri değil rotayı anlatıyor ve doğru. |
| N2 | v7 göçü CH₄/N₂O varsayılanlarını satıra yazıyor | **Doğru gözlem**, bilinçli tasarım | Açık iş: dışa aktarımda "IPCC varsayılanı" etiketi (Bölüm 4). |
| N3 | Ülke tabloları Türkiye not anahtarını kullanıyor | **Doğru** | Ülkeden bağımsız `factors.notes.eu_cbam_dv` anahtarı. |
| N4 | Yılsız aile setinde `!` çökmesi | **Doğru** (bugün teorik) | Yılsız grup olduğu gibi sunuluyor; yeniden hesap çökmüyor. |

### 3.2 Mevzuat iddiaları: Türkiye

| İddia | Hüküm | Doğrusu | Kaynak |
|---|---|---|---|
| Faaliyet raporu: Yön. RG 28395, TTK 514; finansal md. 12, personel md. 8/11, risk md. 13 | **Kısmen doğru** | Yönetmeliğin adı: Şirketlerin Yıllık Faaliyet Raporunun Asgari İçeriğinin Belirlenmesi Hakkında Yönetmelik (RG 28.08.2012/28395). Finansal md. 12 ve risk md. 13 doğru. Personel md. 8/1-d'de; md. 11 faaliyetler ve iç kontrol. TTK 514 hazırlama, 516 içerik, 518 grup. | RG 20120828-2; TTK |
| SPK II-14.1 ve II-17.1, sürdürülebilirlik ilkeleri | **Doğru** | II-14.1 md. 8 içeriği Yönetmelik 28395'e bağlar. II-17.1 md. 8 (2020 değişikliği) uy-ya-da-açıkla esaslı. 2022'de KAP şablonu geldi. TSRS raporlayanlar için değişiklik bulunamadı. | SPK mevzuat portalı |
| "Dönem sonu + 2 ay / 60 gün" | **Kısmen doğru** | TTK: rapor 2 ayda hazırlanır, genel kurul 3 ayda. SPK: 60 gün, konsolide tablo varsa 70 gün. TSRS'nin ayrı bir günü yok; finansal tablolarla aynı anda. | Yön. 28395 md. 16; TTK 409; II-14.1 md. 10; TSRS 1 ¶ 64 |
| TSRS 1 Ek E: iklim-önce ve Kapsam 3 geçişi | **Kısmen doğru** | Ek E: E3 karşılaştırma, E4 yayım zamanı, E5 iklim-önce. **Kapsam 3 muafiyeti Ek E'de değil:** TSRS 2 C4'te (1 yıl) ve Kapsam Kararı geçici md. 3'te (2 yıl). Eşikler: 1 mlr TL aktif, 2 mlr TL net satış, 500 çalışan; 01.01.2025 ve sonrası dönemler (RG 16.01.2026). | RG 20231229M1-10; 20241218-6; 20260116-3 |
| Güvence: ISSA 5000 / GDS 3000 | **Kısmen doğru** | Güvence ilk yıldan itibaren zorunlu (RG 05.09.2024/32653). Bugün GDS 3000 ve GDS 3410 uygulanıyor. ISSA 5000'in Türkçesi SGDS 5000 adıyla 22.10.2025'te taslak yayımlandı; nihai kabulü doğrulanamadı. Denetimi yalnız KGK yetkili kuruluşlar ve sürdürülebilirlik denetçileri yapar (RG 17.01.2025). Güvence düzeyinin "sınırlı" olduğu yalnız ikincil kaynakla teyit edildi. | RG 20240905-3; 20250117-19; KGK duyuruları (05.12.2023 ve sonrası) |
| TR ETS: izleme planı 27.10.2026 (Geçici md. 3); 30 Nisan (md. 29); Kasım son iş günü (md. 16); KPK/2026/1 | **Kısmen doğru, tarih eskimiş** | İzleme planı süresi, 13.10.2026 tarihli ve 18814 sayılı Olur ile **27.01.2027**'ye uzatıldı (Bakanlık duyurusu, 14.10.2026). Diğerleri doğru; md. 29 için 1 ay uzatma mümkün. **Uygulamada düzeltildi.** | iklim.gov.tr duyuru 1046; RG 20260827-7 |
| SPK yeşil tahvil rehberi, ICMA GBP | **Güncel değil** | 2022 rehberinin yerini 13.08.2026'da yeni rehberler aldı (i-SPK 128.29). İkinci taraf görüşü, yıllık fon kullanım raporu, nihai rapor doğrulaması ve etki raporu zorunlu. ICMA GBP'nin güncel sürümü Haziran 2025. Uygulama zaten 2026 rehberlerini kaynak gösteriyor. | SPK İlke Kararı 376; ICMA |
| KVKK: kişisel veri dışa aktarımda toplulaştırılır | **Kısmen doğru** | Toplulaştırma yetmez, verinin anonim olması gerekir (md. 3/1-b, 28/1-b). Küçük grupların toplamı kişisel veri olabilir. İSG kaydı özel nitelikli sağlık verisidir (md. 6); işlenmesi md. 6/3-f ile mümkün. | KVKK |
| Faaliyet raporu "kamuya açık" | **TTK için yanlış, borsa için doğru** | Bkz. 2.4. | TTK 437, 1524; RG 20130531-15 |

### 3.3 Mevzuat iddiaları: AB ve uluslararası

| İddia | Hüküm | Doğrusu | Kaynak |
|---|---|---|---|
| SKDM beyanı 30.09; ilki 30.09.2027 | **Doğru** | 2025/2083 süreyi 31 Mayıs'tan 30 Eylül'e çekti; sertifika teslimi de aynı gün. | Tüzük 2025/2083 |
| "ESRS 2026, Del. Reg. 2026/73" | **Yanlış** | Sadeleştirilmiş ESRS'nin numarası 2026/1563: OJ'de 21.09.2026'da yayımlandı, 01.01.2027 ve sonrası başlayan mali yıllara uygulanır. 2026/73 Taksonomi sadeleştirmesidir. Uygulama ikisini de doğru kaynak gösteriyor. | Del. Reg. 2026/1563; 2026/73 |
| "VSME (VSS 2026)", B3/B6–B10 | **Kısmen doğru** | Gönüllü standart Del. Reg. 2026/1560 (Omnibus Direktifi 2026/470 md. 29ca). Temel modül B1–B11, kapsamlı modül C1–C9. Komisyon Tavsiyesi 2025/1710. B3 enerji ve sera gazı, B6 su, B7 kaynak ve atık, B8 işgücü, B9 İSG, B10 ücret, toplu sözleşme ve eğitim. "VSS" resmî kısaltma değil. | Del. Reg. 2026/1560; Rec. 2025/1710 |
| CDP 2026 M1–M13 | **Doğru** | 13 modül; emisyonlar Modül 7'de. (2026 Modül 7 belgesi doğrudan okunamadı, 2025 rehberi ve 2026 genel bakışıyla teyit edildi.) | CDP |
| ISSA 5000 ve "beş güvence iddiası (tamlık, doğruluk, varlık, dönemsellik, sınıflandırma)" | **Kısmen doğru** | ISSA 5000, 15.12.2026 ve sonrası başlayan dönemlere uygulanır. Standart **yedi örnek** iddia sayar ve listeyi bağlayıcı tutmaz (A415R). Sınırlı güvencede iddia bazlı değerlendirme zorunlu değildir (A416L). Beşli liste finansal denetimdeki ISA 315'e benziyor. "Her veri noktası için sektör standardı" ifadesi abartı. | ISSA 5000 |
| "%5 anlamlılık" (GHG Protokolü) | **Yanlış atıf** | GHG Protokolü Kurumsal Standardı, neyin anlamlı olduğuna dair özel bir öneri yapmaz; eşiği şirkete bırakır. %5, SBTi Near-Term Criteria V5.3.1 (Nisan 2026) C27'nin zorunlu eşiğidir. **Uygulamadaki aynı atıf da düzeltildi.** | GHGP Bölüm 5; SBTi Kriter C27 |
| "SKDM kayıt sistemi uyumlu XML" | **Doğrulanamadı** | XML yükleme geçiş dönemindeki üç aylık raporlara özgüydü. Kesin dönem yıllık beyanı için yayımlanmış bir XML şeması ya da beyan sahibine açık sistemden sisteme arayüz bulunamadı. Bu yüzden ürün XML vaat etmemeli. | Uyg. Tüz. 2024/3210, 2025/2550; Komisyon kayıt sayfası |
| AB/CSRD "Ocak → Haziran" takvimi | **Standart değil** | Sektör pratiği. Borsa şirketlerinde yıllık rapor 4 ay içinde (Şeffaflık Direktifi); "Haziran yayım" geç kalır. | Dir. 2004/109; 2013/34 |
| SKDM operatör paketi, "FAA/SFA", akredite doğrulayıcı | **Kısmen doğru** | Kısaltma "SFA" değil, "SEFA"dır (FAA = SEFA × kütle). A/B sütunları emisyon değil, 2025/2620'deki kıyas sütunlarıdır. Fiili değerde akredite doğrulayıcı zorunlu (md. 8(1); doğrulama 2025/2546, akreditasyon 2025/2551). Operatörün verdiği verinin şablonu 2025/2547 md. 10 ve Ek IV. Md. 9 karbon fiyatı indirimi uygulama tüzüğü Mayıs 2026'da taslaktı. | Uyg. Tüz. 2025/2547, 2025/2620 |

### 3.4 Sektör iddiaları

| İddia | Hüküm | Doğrusu |
|---|---|---|
| Persefoni, Watershed, Normative: "500.000+ faktör", 50–500 bin $/yıl | **Kısmen doğru** | Watershed kendi sitesinde "2,3 milyon emisyon faktörü, kıyas ve metodoloji" diyor. Normative 349 bin+ faktör. 50–500 bin $ aralığı doğrulanamadı: Persefoni'nin ücretsiz katmanı var, Watershed'in Vendr medyanı yaklaşık 70 bin $/yıl. Greenly, Normative'i satın aldı (Eylül 2026). |
| Workiva, Diligent, Novisto: onay akışı, XBRL/iXBRL, SEC; SKDM zayıf | **Kısmen doğru** | Workiva'da sürüm kontrolü, denetim izi, ESRS/ESEF XBRL ve güvence merkezi var. Diğer ikisinde XBRL doğrulanamadı. SKDM modülü üçünde de yok. SEC iklim kuralı savunması Mart 2025'te bırakıldı; artık satın alma gerekçesi değil. |
| Sweep, Greenly, Plan A, Envizi, Position Green, ESG:ONE; "Sweep ~250 $/ay"; "Plan A TÜV" | **Kısmen doğru** | Çok çerçeveli tek veri modeli ve tedarikçi anketi doğru. Plan A'nın TÜV belgesi yalnız kurumsal karbon ayak izi yöntemini kapsıyor (2021). Sweep fiyatı yalnız Şubat 2024 tarihli bir üçüncü taraf sayfasında var, Sweep'in sitesinde değil. |
| SKDM uzmanları: CarbonChain, CBAMBOO, kolum, cbamtrack, **Certivo** | **Kısmen doğru; Certivo yanlış** | CarbonChain'de tedarikçiye ulaşma, denetim izi ve XML var. CBAMBOO'da doğrulayıcı erişimi henüz "yakında". Gümrük mutabakatını hiçbir satıcı belgelemiyor. **Certivo bir ürün uyum (PFAS, RoHS, REACH) platformu; sitesinde SKDM yok.** |
| Türkiye: "Karbonet (CBAM modülü)" | **Kısmen doğru**, liste eksik | Karbonet'in SKDM modülü var, ama işletmecisi ABD'deki ZincirX Inc. (Delaware); TSRS ve TR ETS yok. Yerli ürünler aşağıda. |

**Doğrulanan yerli ürünler**, kendi sayfalarına göre:

| Ürün | Firma, şehir | Kapsam |
|---|---|---|
| CarbonEmit | Marsala Yazılım, İzmir | ISO 14064, TSRS, SKDM beyanı; danışman paneli |
| CO2Soft | UYA Teknoloji | ISO 14064, TSRS+GRI raporu, SKDM |
| Carbon Gate | İstanbul | ISO 14064, TSRS, SKDM |
| CimpactPro | İstanbul | ISO 14064, TSRS, SKDM |
| U2 AI Carbon | Ankara | ISO 14064, TSRS 2, SKDM; doğrulayıcıya bağlantıyla erişim |
| Carbonium | Yugen Consulting | ISO 14064; TSRS ve SKDM "yakında"; rapor kilitleme, danışman modu |
| Carbonet | LNASOFT, İzmir | ISO 14064, SKDM, çok müşterili danışman |
| Omnimatic | Omnicon | ISO 14064, SKDM, ESG |
| Sustaines | — | TSRS, GRI, TCFD, SKDM hesabı |
| Carbonlogy | Carbon Türkiye Holding | GHG, ISO 14064 |
| Carbonance | — | Finans kurumları için PCAF, TSRS |

**Isoline'ın ayrıştığı yerler:**
- TR ETS (tahsisat, açık, ceza, takvim);
- TTK, SPK ve BDDK faaliyet raporu kontrolü;
- finansal veriyle (mizan) uzlaştırma;
- kaynak-izli faktör sürümleri ve geriye dönük yeniden hesap;
- yayımlanmış örneklerle doğrulama paketi.

**Isoline'ın geride olduğu yerler:**
- veri talep ve takip akışı;
- veri başına onay ve kilit;
- tedarikçi portalı;
- doğrulayıcıya erişim.

---

## 4. Açık işler, sırayla

| # | İş | Neden | Büyüklük |
|---|---|---|---|
| 1 | **Durum + kilit** (Taslak → Kontrolde → Onaylandı → Yayımlandı) bütün araçlara; onaylayan adı ve zaman damgası. **Yapıldı (18.10.2026):** 11 bölüm, görev ayrılığı, gerekçeli geri gönderme ve yeniden açma, silinmeyen geçmiş, ekranda ve depoda kilit, Word'de onay bloğu ve "TASLAK" uyarısı, genel bakışta durum tablosu. | Güvence kuruluşlarının ilk istediği: görev ayrılığı ve dondurulmuş dönem | Orta |
| 2 | **Veri talep listesi**: seçilen raporların ihtiyaç duyduğu verilerden sahip, son tarih ve durum listesi; CSV olarak müşteriye. **Yapıldı (18.10.2026):** "Veri talepleri" ekranı. Liste kapsam testinin önerdiği ya da kullanıcının seçtiği şablonlardan çıkıyor. Her kalem onu isteyen şablon bölümüne ve atfına bağlı; yeni gereklilik eklenmiyor. Kalem başına sorumlu birim, kaynak belge, birim, dönem, sorumlu kişi, son tarih, durum ve not var. Bölüm bazında ilerleme ve gecikme izleniyor. Kabul edilen kalem dosya içe aktarma kaydına (SHA-256) bağlanıyor. Onaylı bölümün kalemleri kilitli. CSV ve Excel olarak gönderilip doldurulmuş hâli geri yükleniyor. | Rakiplerin en güçlü olduğu, Isoline'ın en zayıf olduğu yer | Orta |
| 3 | **Elle girişte kaynak notu** (belge adı, tarih). **Yapıldı (18.10.2026):** her araç ekranında "Kaynak belgeler" grubu var; veri kalemi başına belge adı ya da numarası ve belge tarihi giriliyor. Not, veri talep listesinde de görünüyor ve düzenleniyor; CSV ve Excel dosyasında "Teslim edilen belge" ve "Belge tarihi" sütunları olarak gidip geri geliyor. Kanıt sayılan iki şey var: dosya içe aktarma kaydı (SHA-256) ya da belge adı. Bölüm bazında "belgeli" kalem sayısı izleniyor. Kanıtsız kabul edilen kalem uyarı taşıyor. Onaylı bölümün notları kilitli. | Her değerin arkasında kanıt | Küçük |
| 4 | **Tek rapor paketi + künye**: Word'ler, CSV'ler, uzlaştırma kaydı, kanıt listesi ve görünürlük düzeyi; ilk satırda düzey etiketi | Teslim ve denetim izi | Orta |
| 5 | **Rapor bölümü = kilitli veriden alıntı**: kaynak şeridi (araç, faktör sürümü, hesap tarihi, kalite); sınır ve dönem farkı uyarısı | "Bir kez hesapla, çok raporda kullan" ilkesinin görünür hâli | Büyük |
| 6 | U6–U7 kuralları ve yıl kopyası. **Yapıldı (19.10.2026, tarayıcıda):** U6 uyumlu CapEx kalemlerini yol önlemleriyle ad eşleşmesiyle karşılaştırıyor (önemlilik: toplam CapEx'in %5'i); U7 faaliyet raporundaki yatırım kalemini enerji/emisyon hareketiyle karşılaştırıyor. Yıl kopyası açık: yeni yılda önceki yıl değerlerinin devri. | Yatırım ↔ etki çelişkisi; önceki yıl verisi elle girilmesin | Orta |
| 7 | Dışa aktarımda "IPCC varsayılanı / elle girilmiş" etiketleri (N2) | Varsayılanın görünmesi | Küçük |
| 8 | Medya havuzu (grafik + hak bilgisi) | Tasarım ajansı teslimi; tek başına iş değeri düşük, 4. maddeden sonra | Orta |
| 9 | Denetçi salt okunur alanı, çok kullanıcı, tesis hiyerarşisi | Faz 3–4 platform işi | Büyük |

Raporun önerip burada **bırakılanlar** ve gerekçeleri:
- **Üç kapı (G1–G3):** 4 durum ve kilit aynı işi daha az kavramla görüyor.
- **Altı veri sınıfı ve on dışa aktarma kuralı:** 3 görünürlük düzeyi ile iki zorunlu kişisel veri kuralı yeterli.
- **"Mock-audit modülü":** 1. ve 4. maddeler kurulunca denetçi izi kendiliğinden oluşuyor; ayrı modül gerekmiyor.
- **SKDM XML çıktısı:** Komisyon kesin dönem için şema yayımlamadı; şema gelene kadar CSV/Excel.

---

## 5. Bu inceleme sırasında kodda değişenler

Kısa liste; ayrıntı için commit'e bakın.

- **Tarihler:**
  - `lib/dates.ts`: gerçek "bugün" (`useToday`, `todayLocal`, `addDays`).
  - Takvim, genel bakış ve önemli tarihler ekranları bu fonksiyonları kullanıyor.
  - Zaman çizelgesinde "bugün" çizgisi isteğe bağlı oldu.
  - `regulations.ts`: `eventDate`. Yolculuk ekranı, TR ETS ekranı ve kapsam testi tarihleri buradan okuyor. TR ETS izleme planı 27.01.2027, Bakanlık duyurusu kaynak sicilinde.
- **Yeşil iddia:** `lib/claims.ts` Türkçe ek toleransı, yeni ifadeler, -laş/-leş istisnası; regresyon testleri.
- **CSV:** `lib/export.ts` formül kaçışı (`csvSafe`, `csvUnsafe`); faktör CSV'si de kapsandı.
- **Word:**
  - Faaliyet raporu çıktısında işaretler, onay sayıları ve net satışlar; dile göre dosya adı.
  - İki Word çıktısında da dışa aktarma hatası ekranda gösteriliyor.
  - `summary.ts` içindeki `!` kaldırıldı.
- **İçe aktarma:** `isClientShape` ile çalışma alanı dosyası doğrulanıyor; yolculuk ekranı kısa geçmişe dayanıklı.
- **SKDM:** `cbamDefaultRow` ile menşe değişimi; "elle girilmiş değer" uyarısı; ülkeden bağımsız not anahtarı.
- **Yeniden hesap:**
  - Yılsız aile setleri artık çöktürmüyor.
  - %5 eşiği SBTi C27'ye atfediliyor. Ekran metni, kod yorumu, doğrulama vakaları, README ve yol haritası düzeltildi.
- **Kurulum:**
  - `typecheck` betiği `next typegen && tsc --noEmit` oldu.
  - `xlsx` paketi depoda (`web/vendor/`); bütünlük özeti aynı.

## 6. Kaynaklar

**Türkiye**
- Faaliyet raporu yönetmeliği: https://www.resmigazete.gov.tr/eskiler/2012/08/20120828-2.htm
- TTK: https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6102.pdf
- İnternet sitesi yönetmeliği: https://www.resmigazete.gov.tr/eskiler/2013/05/20130531-15.htm
- SPK II-14.1: https://mevzuat.spk.gov.tr/api/Mevzuat/File/77
- SPK II-17.1: https://mevzuat.spk.gov.tr/api/Mevzuat/File/86
- SPK 2022 ilke kararı (34/977): https://mevzuat.spk.gov.tr/api/IlkeKarari/File/219
- SPK yeşil ve sürdürülebilir araç rehberleri (2026): https://mevzuat.spk.gov.tr/api/IlkeKarari/File/376
- TSRS ve Kapsam Kararı:
  - https://www.resmigazete.gov.tr/eskiler/2023/12/20231229M1-9.pdf
  - https://www.resmigazete.gov.tr/eskiler/2023/12/20231229M1-10.pdf
  - https://www.resmigazete.gov.tr/eskiler/2024/12/20241218-6.pdf
  - https://www.resmigazete.gov.tr/eskiler/2026/01/20260116-3.pdf
- Güvence denetimi:
  - https://www.resmigazete.gov.tr/eskiler/2024/09/20240905-3.pdf
  - https://www.resmigazete.gov.tr/eskiler/2025/01/20250117-19.htm
  - https://www.kgk.gov.tr/Portalv2Uploads/files/Duyurular/v2/Diger/duyuru-05_12_2023.pdf
- TR ETS Yönetmeliği: https://www.resmigazete.gov.tr/eskiler/2026/08/20260827-7.htm
- TR ETS süre uzatımı: https://iklim.gov.tr/tr-ets-pilot-uygulama-donemi-izleme-metodolojisi-planlarinin-sunulma-suresinin-uzatilmasi-hakkinda-duyuru-1046
- KVKK: https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6698.pdf

**AB ve uluslararası**
- SKDM:
  - https://eur-lex.europa.eu/eli/reg/2025/2083/oj/eng
  - https://eur-lex.europa.eu/eli/reg_impl/2025/2547/oj/eng
  - https://eur-lex.europa.eu/eli/reg_impl/2025/2620/oj/eng
  - https://eur-lex.europa.eu/eli/reg_impl/2025/2546/oj/eng
  - https://eur-lex.europa.eu/eli/reg_del/2025/2551/oj/eng
  - https://eur-lex.europa.eu/eli/reg_impl/2025/2550/oj/eng
  - https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/cbam-registry-and-reporting_en
- ESRS ve gönüllü standart:
  - https://eur-lex.europa.eu/eli/reg_del/2026/1563/oj/eng
  - https://eur-lex.europa.eu/eli/reg_del/2026/1560/oj/eng
  - https://eur-lex.europa.eu/eli/reco/2025/1710/oj/eng
  - https://eur-lex.europa.eu/eli/reg_del/2026/73/oj/eng
- ISSA 5000: https://ifacweb.blob.core.windows.net/publicfiles/2025-01/IAASB-International-Standard-on-Sustainability-Assurance-ISSA-5000.pdf
- GHG Protokolü Kurumsal Standardı: https://ghgprotocol.org/sites/default/files/standards/ghg-protocol-revised.pdf
- SBTi kriterleri: https://files.sciencebasedtargets.org/production/files/SBTi-criteria.pdf
- AB direktifleri:
  - https://eur-lex.europa.eu/eli/dir/2004/109/oj/eng
  - https://eur-lex.europa.eu/eli/dir/2013/34/oj/eng
- CDP: https://cdn.cdp.net/cdp-production/cms/guidance_docs/pdfs/000/005/685/original/CDP_Full_Corporate_Questionnaire_Overview_2025.pdf

**Sektör ve güvence hazırlığı**
- Watershed: https://watershed.com/
- Certivo: https://www.certivo.com/
- Persefoni fiyatlandırma: https://www.persefoni.com/pricing
- SEC iklim kuralı açıklaması 2025-58: https://www.sec.gov/newsroom/press-releases/2025-58
- Karbonet: https://karbonet.com/
- CarbonEmit: https://carbonemit.com/en
- Diğer yerli ürünler:
  - https://co2soft.com/en
  - https://carbongate.io/en
  - https://cimpactpro.com/en
  - https://u2aicarbon.com
  - https://carbonium.app
  - https://carbonet.com.tr
  - https://omnimatic.com.tr
  - https://sustaines.com
  - https://carbonturkiye.com/en
  - https://carbonaccountingfinancials.com
- Güvence hazırlık notları:
  - https://kpmg.com/uk/en/home/insights/2023/10/are-you-ready-for-esg-assurance.html
  - https://www.pwc.com/gx/en/industries/tmt/publications/greenhouse-gas-emissions-review.html
  - https://www.deloitte.com/mt/en/services/audit-assurance/perspectives/ESG_audit_readiness.html
- Ürün iş akışı sayfaları:
  - https://www.persefoni.com/blog/preparing-for-ghg-assurance
  - https://www.sweep.net/en-us/csrd
  - https://watershed.com/solutions/csrd
  - https://www.workiva.com/solutions/csrd-reporting

Araştırma notlarının ayrıntısı, alıntılarıyla birlikte, oturumun çalışma klasöründe tutuldu. Bu belgedeki her hüküm yukarıdaki kaynaklara dayanıyor.
