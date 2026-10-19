# ISOLINE — Geliştiriciye iş emri ve uygulama protokolü

Bu klasör ISOLINE'ın ürün ve teknik gelişim sözleşmesidir. **Soru üreten araştırma belgesi gibi kullanmayın**; iş emri, mimari sınırlar, işlevsel ekran sözleşmeleri, iş akışları ve kabul testleri bütünüdür. Belgelerde genel alan eksikliği gördüğünüzde ilk işiniz kod ve ilgili standart kaynaklarını doğrulayıp gerekçeli ADR oluşturmak; rastgele yeni akış icat etmemektir.

## Başlama talimatı

1. `README.md` ve `docs/01–15` dosyalarını **sırasıyla** okuyun; `docs/13` backlog ve `docs/14` UAT kabul standartlarını uygulama sırası olarak kullanın.
2. `https://github.com/ardaazmus/isoline` `main` ile **gerçek kod envanteri çıkarın**; `web/src/lib/calc/*`, `approval`, `requests`, `reconcile`, `docx`, `workspace.ts` için test baz çizgisini kaydedin. Hiçbir mevcut modülü neden/kanıt olmadan silmeyin.
3. Mimariyi **PostgreSQL veri omurgası** üzerinde inşa edin; dosyalar özel object storage, auth gerçek kimlik, tenant RLS ve granular `ExternalProjectGrant` gerektirir.
4. İlk iş **G0** karar/kabul kanıtlarını tamamlamak. G0 onayı olmadan geniş çaplı refactor, yeni 3D sahne veya sektör sayfası eklemeyin.
5. Sonra `G1 → G2 → G3 → G4 → G5 → G6` esas bağımlılık zinciri; her kapı test ve kabul kayıtlarıyla tamamlanır.
6. `G7/G8` ileri sektör, dış uzman, API ve isometrik görseller; kritik iş omurgasına bağlıdır.

## Kesin sınırlar

- **Veri şirketindir**; danışmanlık firma tenant'ı müşteri projesine kısıtlı, iptal edilebilir erişim alır. Danışman ilk müşteri kaydını açsa bile şirket owner/grant politikası değişmez.
- **Güncel kaynak/sürüm olmadan yasal zorunluluk iddiası yok**; TSRS, GRI, ESRS, faaliyet, CBAM aynı metodoloji değildir.
- **Onay, gerçek kullanıcıyla**; ad yazarak imza atılmış sayılmaz. Bağımsız güvence kuruluşunun kendi görüşünü verme yetkisini taklit etmeyin.
- **Finansal konsolidasyon ve GHG** ayrı politikalar. Ürün karbonu da bağımsız ürün yaşam döngüsü hesabıdır.
- **Rapor çıktısı** onaylı snapshot'tır; yayımlanmış değer arka planda kendiliğinden değişmez. Değişiklik yeni revision ve restatement.
- **Yalnız aydınlık, sakin, erişilebilir UI**; izometrik/akış animasyonları sadece gerçek veriyi açıklasın. Koyu tema, rozet, konfeti yok.
- Mevcut onay, veri talebi ve uzlaştırma kodunu “sıfırdan yok” kabul etmeyin; identity/API/DB ile üretim seviyesine taşıyın.

## Her sprint kapanış formatı

```
Sprint / Commit / PR / Etkilenen modüller
Gereksinim ve kabul ID'leri
DB migration ve rollback sonucunun kaydı
Test komutları ve gerçek PASS/FAIL sayıları
RLS/ABAC tenant negatif testleri
Data/calculation parity ve release impact sonucu
Ekran durumları ve erişilebilirlik kanıtı
Açık blocker/risks ve karar tarihleri
Sonraki kapıya geçiş için koşul
```

**Kural:** İş “tamamlandı” denmeden önce kodda çalışan akış, kullanıcı yetkisi, kaynak kanıtı ve otomatik test birlikte gösterilir. Karşılanmayan kısım `blocked/partial/not verified` olarak kalır.
