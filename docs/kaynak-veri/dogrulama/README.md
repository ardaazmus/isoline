# Doğrulama paketinin kaynak belgeleri

Bu klasördeki belgeler, `web/validation/cases/r-*.json` vakalarının beklenen değerlerini aldığı orijinallerdir. Hepsi 2026-10-18'de indirildi. Hash'ler `../SHA256SUMS` dosyasındadır (`sha256sum -c SHA256SUMS`).

| Dosya | Yayımcı | Kullanan vaka | Adres |
|---|---|---|---|
| `CBAM_Guidance_No1_Introduction.pdf` | AB Komisyonu DG TAXUD, 14.08.2026 | `r-cbam-steel-rails-5d`: PDF s. 10'da "yalnız doğrudan emisyon" ifadesi | https://taxation-customs.ec.europa.eu/document/download/031abf60-21a9-4822-b258-ac8b111d8358_en?filename=Guidance%20No.%201%20-%20Introduction%20to%20CBAM%20concepts.pdf |
| `CBAM_Guidance_No4_FreeAllocationAdjustment.pdf` | AB Komisyonu DG TAXUD, 14.08.2026 | `r-cbam-default-lookup-4` (Tablo 2-3 ve 2-4), `r-cbam-factor-table-4` (Tablo 2-1) | https://taxation-customs.ec.europa.eu/document/download/3aa2c730-4f1b-4524-8f71-d9cfe4880ac7_en |
| `CBAM_Guidance_No5a_Cement.pdf` | AB Komisyonu DG TAXUD, 14.08.2026 | `r-cbam-cement-5a` (s. 28-29) | https://taxation-customs.ec.europa.eu/document/download/f87a2022-9dcb-45cb-a415-4c460e5ad672_en |
| `CBAM_Guidance_No5b_Hydrogen.pdf` | AB Komisyonu DG TAXUD, 14.08.2026 | `r-cbam-hydrogen-5b` (s. 18-19) | https://taxation-customs.ec.europa.eu/document/download/04ceca3b-466e-4ed9-a1a5-a47c2e5e5be0_en |
| `CBAM_Guidance_No5d_IronSteel.pdf` | AB Komisyonu DG TAXUD, 14.08.2026 | `r-cbam-steel-rails-5d` (s. 43-44) | https://taxation-customs.ec.europa.eu/document/download/3eb64513-8255-4c71-875a-bd0a8c7ff772_en |
| `EPA_CCCL_Stationary_Combustion_Guidance_Dec2023.pdf` | US EPA, Aralık 2023 | `r-epa-cccl-boiler` (basılı s. 6-7) | https://www.epa.gov/sites/default/files/2020-12/documents/stationaryemissions.pdf |
| `EPA_GHGRP_C_FUEL_LEVEL_INFORMATION_1004616_2023.json` | US EPA Envirofacts | `r-epa-ghgrp-steel-dynamics-2023` (yakıt miktarı ve raporlanan CO₂) | https://data.epa.gov/efservice/C_FUEL_LEVEL_INFORMATION/FACILITY_ID/=/1004616/REPORTING_YEAR/=/2023/JSON |
| `EPA_GHGRP_C_SUBPART_LEVEL_INFORMATION_1004616_2023.json` | US EPA Envirofacts | aynı vaka (tesis toplamı) | https://data.epa.gov/efservice/C_SUBPART_LEVEL_INFORMATION/FACILITY_ID/=/1004616/REPORTING_YEAR/=/2023/JSON |
| `EPA_GHGRP_PUB_DIM_FACILITY_1004616_2023.json` | US EPA Envirofacts | aynı vaka (tesis kimliği) | https://data.epa.gov/efservice/PUB_DIM_FACILITY/FACILITY_ID/=/1004616/YEAR/=/2023/JSON |
| `eCFR_40CFR98_SubpartC.xml` | eCFR, 2026-10-01 sürümü | aynı vaka (Tablo C-1: 1,026 × 10⁻³ mmBtu/scf, 53,06 kg CO₂/mmBtu) | https://www.ecfr.gov/api/versioner/v1/full/2026-10-01/title-40.xml?part=98&subpart=C |

## Klasöre alınmayan kaynaklar

- **GHG Protocol Scope 2 Guidance (2015):** CC BY-NC-ND 3.0 lisanslı. Ticari bir ürünün deposunda dağıtılmadı. Kullanılan sayılar Tablo 6.4 ve 6.5'ten alındı (basılı s. 50-51). Belgenin SHA-256 değeri `b4f17030e5d723d5b9b65ed85592c5449dafe4f798eb845ed9db0465893c894a`, adresi https://ghgprotocol.org/sites/default/files/2023-03/Scope%202%20Guidance.pdf.
- **Türk şirket raporları:** Akçansa 2024, Çimsa 2024 ve Erdemir/İsdemir 2025 entegre raporları (KAP). Telif korumalı oldukları için klasöre alınmadılar. Raporlar emisyon faktörü ve ısıl değer açıklamıyor, bu yüzden kesin vaka olarak da kullanılmadılar (bkz. `web/validation/README.md`).

## Yeniden kullanım

- **AB Komisyonu belgeleri:** Komisyon'un yeniden kullanım politikası (Karar 2011/833/AB) kapsamında, kaynak gösterilerek yeniden kullanılabilir. Rehberler bağlayıcı değildir; bağlayıcı olan Resmî Gazete'deki tüzük metnidir.
- **US EPA ve eCFR:** ABD federal hükümet eseridir ve ABD'de genel olarak kamu malıdır.
