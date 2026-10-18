# IPCC: yakmada CH₄ ve N₂O faktörleri, AR6 GWP

Uygulama yakıt satırlarında CO₂'nin yanında CH₄ ve N₂O'yu da hesaplar. Bu klasör, kullanılan varsayılan değerlerin kaynağını tutar. `web/src/lib/calc/core.test.ts` bu dosyaları okur ve koddaki değerlerle birebir karşılaştırır.

## Dosyalar

- `ipcc_ch4_n2o.csv`: yakıt ve kullanım (sabit, hareketli) başına CH₄ ve N₂O, kg/TJ (net ısıl değer bazında). Her satırda tablo, basılı sayfa ve IPCC satır adı var.
- `ar6_gwp_combustion.csv`: fosil kaynaklı CH₄ için 29,8, N₂O için 273 (GWP100).

## Kaynak belgeler

PDF'ler depoda tutulmuyor. IPCC belgelerinde açık bir yeniden dağıtım lisansı yok; depoda yalnız değerler, sayfa konumları ve dosya özetleri duruyor. Hepsi 2026-10-18'de indirildi.

| Belge | Kullanılan tablo | Adres | SHA-256 |
|---|---|---|---|
| IPCC 2006 Guidelines, Cilt 2, Bölüm 2 (Stationary Combustion) | Tablo 2.3, s. 2.18 (PDF s. 18) | https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/2_Volume2/V2_2_Ch2_Stationary_Combustion.pdf | `a25d9f96d7672df391b328de79d4cfd812c07fe79d5cf4a30d23d82d8f02985b` |
| IPCC 2006 Guidelines, Cilt 2, Bölüm 3 (Mobile Combustion) | Tablo 3.2.2, s. 3.21; Tablo 3.4.1, s. 3.43; Tablo 3.5.3, s. 3.50 | https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/2_Volume2/V2_3_Ch3_Mobile_Combustion.pdf | `b0b7d96d5ac90ecf359cdb74e932448cfba041c6cec0e1dc24f2def444508c30` |
| IPCC AR6 WG1, Bölüm 7 | Tablo 7.15, s. 1017 (PDF s. 95) | https://www.ipcc.ch/report/ar6/wg1/downloads/report/IPCC_AR6_WGI_Chapter07.pdf | `470d2662fdd212421617a32c684e8106a4221a7235bdfff40a278eff02febfa9` |

Değerler PDF metninden `pdftotext -raw` ile okundu ve tablo satırlarıyla elle karşılaştırıldı.

## Seçimler

- **Türkiye'nin uygulamasıyla aynı yol.** TÜİK ulusal envanteri (NID 2026) hem sabit yakmada (bölüm 3.1, basılı s. 44) hem karayolunda (bölüm 3.2.6.2, basılı s. 104) CH₄ ve N₂O için IPCC 2006 varsayılanlarını kullanıyor. Uygulama da aynısını yapar.
- **Sabit yakma için sanayi tablosu.** Varsayılan değerler Tablo 2.3'ten (imalat sanayi ve inşaat) alınır. Ticari ve kamu binalarındaki kazanlar için Tablo 2.4 (s. 2.20) CH₄'ü daha yüksek verir: doğal gaz ve LPG'de 5 kg/TJ (sanayide 1), sıvı yakıtlarda 10 kg/TJ (sanayide 3). CO₂e'ye etkisi en çok yaklaşık %0,3'tür (benzin). Gerektiğinde değer satıra elle girilir.
- **Benzinli araçlar için katalizörlü sınıf.** Tablo 3.2.2'de benzin için üç satır var. Uygulama "1995 ve sonrası hafif araç" satırını kullanır (3,8 ve 5,7 kg/TJ), çünkü bugünkü filonun büyük kısmı katalizörlüdür. Diğer iki satırın değerleri: katalizörsüz 33 ve 3,2 kg/TJ; oksidasyon katalizörlü 25 ve 8,0 kg/TJ.
- **Karayolu dışındaki hareketli yakıtlar.**
  - Fuel oil: Tablo 3.5.3, okyanus gemileri.
  - Taş kömürü: Tablo 3.4.1, demiryolunda alt bitümlü kömür.
  - Linyit: hareketli varsayılanı yok, sabit değer kullanılır.
- **GWP.** AR6 Tablo 7.15'teki fosil kaynaklı CH₄ değeri (29,8) alınır; uygulamadaki tüm yakıtlar fosil kaynaklıdır. Fosil olmayan CH₄ değeri (27,0) kullanılmaz.

## Uygulamada

- Yeni yakıt satırı varsayılanla başlar. Yakıt türü ya da kullanım değişince değerler varsayılana döner. Kullanıcı satırda değiştirebilir.
- Özel faktör setinin CSV'sinde ve envanter içe aktarma şablonunda isteğe bağlı `ch4` ve `n2o` sütunları var. Boş bırakılırsa varsayılan kullanılır.
- Kayıtlı çalışma alanları v7 göçüyle bu değerleri açıkça satıra yazar.
