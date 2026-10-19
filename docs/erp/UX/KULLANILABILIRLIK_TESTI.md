# Isoline kullanılabilirlik testi — beş kişilik set

**Amaç:** UX incelemesinin (19.10.2026) hedefleri gerçek kullanıcıyla tutuyor mu?
- Kişi girişte kendi işini buluyor mu?
- "Hangi adımdayız, sıradaki iş ne?" sorusunu cevaplayabiliyor mu?
- İki ayrı uygulama hissi kalktı mı?

**Yöntem:** Yüz yüze ya da ekran paylaşımlı, sesli düşünme (think-aloud) protokolü.
- Beş katılımcı yeterli: nitel testte sorunların büyük kısmı ilk beş kişide görünür (Nielsen Norman Group, "Why You Only Need to Test with 5 Users").
- Her oturum 40–45 dakika.

**Otomatik karşılığı:** Aynı yolculukların makinece kontrolü `web/e2e/roles.spec.ts` dosyasındadır (`npm run test:e2e`). Bu belge insanın gözünden aynı soruları sorar.

---

## 1. Hazırlık

1. Demo verisini sıfırdan yükleyin:
   ```
   npm run db:seed -- --reset
   ```
2. Uygulamayı açın: `http://localhost:3210` (ya da kurum sunucusu).
3. Demo giriş bilgileri `web/.demo-users.local.json` dosyasında. Bu dosya git'e girmez ve katılımcıya gösterilmez; moderatör girişi yapıp ekranı teslim eder.
4. Ekran ve ses kaydı için katılımcıdan yazılı onay alın (KVKK aydınlatma metni).
5. Her katılımcıdan önce verileri tekrar sıfırlayın. Böylece her kişi aynı durumla başlar.

| Katılımcı | Demo hesabı | Rolü | Gerçek hayatta kim |
|---|---|---|---|
| K1 | ayse@ornek.test | Şirket sahibi | Sürdürülebilirlik müdürü ya da CFO yardımcısı |
| K2 | zeynep@ornek.test | Veri katılımcısı | Tesiste enerji ve fatura verisini giren uzman |
| K3 | selin@ornek.test | Proje lideri | Raporlama projesini yürüten kişi |
| K4 | can@ornek.test | Danışman | Birden çok müşteriyle çalışan sürdürülebilirlik danışmanı |
| K5 | elif@ornek.test | Yönetim imzacısı | Raporu imzalayan yönetici |

## 2. Moderatör metni (açılış, 3 dk)

> "Bugün bir yazılımı değil, kendimizi test ediyoruz; yanlış yapacağınız bir şey yok. Lütfen düşündüklerinizi sesli söyleyin: ne aradığınızı, ne beklediğinizi, sizi neyin şaşırttığını. Takıldığınızda size yol göstermeyeceğim, çünkü nerede takıldığınızı görmek istiyoruz. İsterseniz 'geçelim' diyebilirsiniz."

Görev sırasında moderatör yalnız şunları sorar: "Şu an ne arıyorsunuz?", "Bunu nerede görmeyi beklerdiniz?". Görev bitince tek kolaylık sorusu (SEQ, bkz. §5) sorulur.

## 3. Görevler

Her görev giriş yapılmış "Bugün" ekranından başlar.

**Başarı:** Hedefe moderatör yardımı olmadan ulaşmak. Yardımla ulaşmak "kısmi" sayılır.

**Tık sayısı:** Görevin ilk tıkından hedef ekrana kadar sayılır.

### Herkes için (K1–K5)

| No | Görev (katılımcıya okunur) | Başarı ölçütü | Hedef tık | Süre sınırı |
|---|---|---|---|---|
| G0 | "Bu ekrana ilk baktığınızda size ne söylüyor? 10 saniye bakın, sonra anlatın." (ilk izlenim, 5 saniye testi gibi) | "Benden beklenen işler" ve rolüne göre "hangi projede hangi adımdayız" bilgisini kendiliğinden söyler | — | 1 dk |
| G1 | "Şu anda sizden beklenen ilk işi açın." | Bugün'deki ilk kalemi ya da İşlerim'deki ilgili kalemi açar | 1 | 2 dk |
| G2 | "2026 raporu hangi aşamada? Sıradaki iş ne ve kimde?" | Bulunulan adımı ("Hesaplama ve onay") ve adımın sorumlusunu ya da son tarihini doğru söyler | ≤ 2 | 3 dk |

### Role özel

| No | Kim | Görev | Başarı ölçütü | Hedef tık |
|---|---|---|---|---|
| G3 | K1 | "Dönemi kapatmanızı ne engelliyor? İlkini çözmek için nereye gidersiniz?" | Proje özetinde "Kapanışı ne engelliyor" listesini bulur ve bir maddenin bağlantısıyla doğru adıma gider | ≤ 3 |
| G4 | K2 | "Gebze tesisinin elektrik tüketimini girin ve faturayı ekleyin." *(Moderatör önce bu kişiye bir talep atar ya da bir talebi düzeltmeye iade eder.)* | Talep formunu açar, değeri girer, kanıt ekler, gönderir | ≤ 6 |
| G5 | K2 | "Bir yakıt tüketimini hızlıca hesaplayıp size atanmış talebe aktarın." | Kütüphane → Hızlı hesap → Sera gazı; "Döngüye kaydet" ile taslağı kaydeder | ≤ 6 |
| G6 | K3 | "Onayınızı bekleyen taksonomi çalışma sayfasını inceleyip onaylayın." | İşlerim'den sayfayı açar, değerleri görür, onaylar | ≤ 3 |
| G7 | K3 | "Taksonomi göstergelerini metriğe çevirin ve onaya gönderin." | Taksonomi sayfasında hesabı çalıştırır; Hesaplamalar'da yeni hesabı görür | ≤ 4 |
| G8 | K4 | "Müşterilerinizden hangisi gecikmede? Neden?" | Bugün'deki müşteri tablosunda kırmızı son tarihi ve adımı söyler | ≤ 1 |
| G9 | K4 | "Gecikmedeki müşterinin projesini açıp sıradaki işi bulun." | Müşteri projesini açar, adım çubuğundan şu anki adımı ve eksiği söyler | ≤ 3 |
| G10 | K5 | "İmzanızı bekleyen bir rapor var mı? Hangi rakamlar onaylı?" | İşlerim'de imza kalemi olmadığını ya da varsa raporu bulur. Proje özetinde onaylı metriklerin nerede olduğunu söyler | ≤ 3 |
| G11 | K1 | "Eski araç setindeki SKDM maliyet hesabını nerede yaparsınız?" | Proje → Analiz → SKDM maliyeti ya da Kütüphane → Hızlı hesap → SKDM | ≤ 3 |

## 4. Gözlem formu (her görev için bir satır)

| Katılımcı | Görev | Sonuç (başarılı / kısmi / başarısız) | Süre (sn) | Tık | Hatalı yol (ilk tıkladığı yer) | Söz ("…") | SEQ (1–7) |
|---|---|---|---|---|---|---|---|
| K1 | G1 | | | | | | |

**İlk tık** ayrıca kaydedilir. Doğru ilk tık, görevin başarıyla bitme olasılığının en güçlü göstergelerinden biridir.

## 5. Ölçekler

**SEQ (Single Ease Question), her görevden sonra:** "Bu görev ne kadar kolay ya da zordu?" 1 = çok zor, 7 = çok kolay.

**SUS (System Usability Scale), oturum sonunda:** 10 madde, 1 = kesinlikle katılmıyorum, 5 = kesinlikle katılıyorum. Bu belgedeki Türkçe uyarlama bu çalışma için çevrildi.

1. Bu sistemi sık kullanmak isteyeceğimi düşünüyorum.
2. Sistemi gereksiz yere karmaşık buldum.
3. Sistemin kullanımının kolay olduğunu düşündüm.
4. Bu sistemi kullanabilmek için teknik birinin desteğine ihtiyaç duyacağımı düşünüyorum.
5. Sistemdeki işlevlerin iyi bir bütün oluşturduğunu düşündüm.
6. Sistemde çok fazla tutarsızlık olduğunu düşündüm.
7. Çoğu kişinin bu sistemi çok çabuk öğreneceğini düşünüyorum.
8. Sistemi kullanmayı çok zahmetli buldum.
9. Sistemi kullanırken kendime güvendim.
10. Bu sistemle çalışmaya başlamadan önce çok şey öğrenmem gerekti.

**Puanlama:**
- Tek numaralı maddelerde puan − 1, çift numaralı maddelerde 5 − puan alınır.
- Bunların toplamı 2,5 ile çarpılır; sonuç 0–100 arasıdır.
- 68 civarı ortalama kabul edilir.

**Son sorular (açık uçlu):**
- "Araç seti ile platform arasında gidip geldiğinizi hissettiniz mi?"
- "Bir şeyi bulamadığınız an oldu mu, ne arıyordunuz?"

## 6. Başarı ölçütleri (UX incelemesinin hedefleri)

| Ölçü | Hedef | Kaynak |
|---|---|---|
| G2'yi ("hangi adımdayız, sıradaki iş ne?") doğru cevaplayan | 5 kişiden en az 4 | İnceleme, "başarıyı neyle ölçeceğiz" |
| G1'de girişten ilk işe tık | 1 (veri giren için de) | İnceleme: 5 → 1 |
| G1 + G2 başarı oranı | %90 ve üstü | — |
| Ortalama SEQ | 5,5 ve üstü | — |
| SUS | 68 ve üstü (ortalama), hedef 75 | — |
| "İki ayrı uygulama" hissini söyleyen | 0 | Kullanıcının ilk şikâyeti |

## 7. Analiz ve karar

1. Her sorunu bir satıra yazın: ne oldu, kaç kişide, hangi görevde, ilk tık nereydi.
2. Önem derecesi verin:
   - **kritik:** görevi bitirtmedi;
   - **ciddi:** gecikti ya da yanlış yola saptırdı;
   - **küçük:** rahatsız etti.
3. İki ya da daha fazla kişide görülen kritik ve ciddi sorunlar bir sonraki sürüme alınır. Tek kişide görülenler izlenir.
4. Düzeltmeden sonra aynı görevlerle üç kişilik kısa bir doğrulama turu yapılır.

## 8. Rapor şablonu

```
Tarih / sürüm (commit) / moderatör
Katılımcılar (rol, deneyim yılı)

Özet: G2 doğru cevap x/5 · ilk işe ortalama tık · ortalama SEQ · SUS

Bulgular (önem sırasıyla):
1. [kritik] …  — kaç kişi, görev, alıntı, ekran görüntüsü
2. …

Kararlar: hangi bulgu hangi sürümde, sorumlu
```
