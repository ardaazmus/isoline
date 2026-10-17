# Isoline reference factors

Fetched on 2026-10-17 by the research step. This file is the original English source note; the Turkish summary is in README.md. Every value in the two CSV files was copied by a script from the official
file named in its row. No value was typed by hand, estimated or recalculated. The original source
files are kept in `raw/` together with their SHA-256 checksums, listed below.

## 1. `cbam_defaults_TR.csv`: EU CBAM default values for the definitive period, Türkiye

### Source
- File: `DV correcting act_final update_06.08.xlsx` (saved as `raw/DV_correcting_act_final_update_06.08.xlsx`)
- URL: https://taxation-customs.ec.europa.eu/document/download/1c05d211-80cb-4aaa-8ef0-e08005a95d7e_en?filename=DV%20correcting%20act_final%20update_06.08.xlsx
- Linked from: https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/cbam-legislation-and-guidance_en ("Default values definitive period")
- The file's "Version History" sheet lists two versions:
  - v1, 2026-02-04: based on Annex I to Regulation (EU) 2025/2621. This is the "4 February 2026 version" that Guidance No. 3 mentions.
  - v2, 2026-08-06: based on Implementing Regulation (EU) 2026/1740.

  We used v2. v1 is superseded and was not downloaded.
- The "Overview" sheet has a disclaimer. The Excel file is for information only. The legally valid values are those in Implementing Regulation (EU) 2026/1740, which corrects 2025/2621.

### Check against the legal text
- We downloaded the Official Journal HTML of Regulation (EU) 2026/1740 from https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202601740. EUR-Lex did not block the request.
- Article 1(1) of that Regulation replaces Annex I of 2025/2621 in full. Article 2 makes it apply from 1 January 2026.
- We compared the "Türkiye" and "Other Countries and Territories" tables in the OJ Annex I against the Excel sheets, row by row. We compared the CN code, the direct, indirect and total values, and the production route. All 288 data rows in each table are identical (0 differences), ignoring whitespace in CN codes.
- We also compared the Türkiye table with the original 2025/2621 Annex I. None of the Türkiye numbers changed. The only differences are formatting ("3" became "3,000") and the indirect column of the "see below" heading rows. The "Other countries" table did change: for example, 2523 10 00 10, 2523 90 00 10, 7226 20 00 and 7306 30 18 / 50 21 / 50 29 / 50 80 have new values.

### Rows (293)
- **283 rows** from sheet `Türkiye`, which corresponds to the table "Türkiye" in Annex I to Regulation 2026/1740. These are all the CN/TARIC rows in the sheet. The five sector heading rows (Cement, Fertilisers, Aluminium, Hydrogen, Iron and steel) are left out. Of the 283 rows:
  - 250 rows have numeric values.
  - 23 rows are HS group headings whose values read "see below", exactly as published.
  - 10 rows show "-".
- **10 fallback rows** from sheet `_Other Countries and Territorie` (table "Other Countries and Territories"). There is one for each CN code where Türkiye shows "-": 2507 00 80 80, 2523 10 00 10, 2523 10 00 90, 2523 21 00, 2523 29 00, 2523 90 00 10, 2523 90 00 90, 7202 19, 7202 49 and 7203. These rows are marked `FALLBACK ...` in `sheet_or_annex`. Annex I states the rule: "Where a country or territory is explicitly listed but no value is provided or the relevant field shows '–', the default value for the respective good from the table 'Other countries and territories' needs to be selected."
- `row_ref` is the 1-based row number in the Excel sheet.
- Values are copied exactly as published:
  - They use a decimal comma ("1,820"), which is why the file is separated by semicolons.
  - "N/A" means the indirect value is not applicable. For aluminium, hydrogen and most iron and steel codes, indirect emissions are outside the scope.
  - "-" means no value is given.
- Unit: tCO2eq/tonne of good. This is the column header unit, which Regulation 2026/1740 added.
- The source has a sixth column, "Underlying production route determining CBAM BM" ((A)–(L)), used for the free-allocation benchmark. It is not in the requested schema and so is not in the CSV. It can be read from the raw Excel file.

### Mark-up (copied from the opening paragraphs of Annex I to Regulation 2026/1740)
> For the calculation of the number of CBAM certificates, the default values of the column 'total emissions' shall be selected and increased as follows: For goods in the cement, iron and steel, aluminium and hydrogen sectors, the mark-up shall be 10 % for the year 2026, 20 % for the year 2027 and 30 % for the year 2028 and onwards. For goods in the fertiliser sector, the mark-up shall be 1 % for the year 2026 and onwards.

Recital 10 of 2026/1740 adds three points:
- The pre-calculated "including mark-up" columns for 2026, 2027 and 2028 that 2025/2621 contained have been deleted.
- The final values with mark-up are calculated in the CBAM Registry from the **total** column.
- The direct and indirect values are "only provided for information".

The Excel file does not state the mark-up.

### Licence and reuse
- The Excel file is published on a European Commission website. The Commission's legal notice (https://commission.europa.eu/legal-notice_en) says that its reuse policy is implemented by Commission Decision of 12 December 2011 on the reuse of Commission documents (Decision 2011/833/EU, CELEX 32011D0833). Unless otherwise indicated, EU-owned content is licensed under CC BY 4.0. Reuse is allowed with appropriate credit and an indication of any changes.
- The Official Journal text (Regulation 2026/1740) is an official EU document, also covered by Decision 2011/833/EU.
- Suggested credit: "Source: European Commission, CBAM default values (Implementing Regulation (EU) 2026/1740 correcting (EU) 2025/2621), © European Union".

### Not obtained
- Annex II (indirect-emission default values per country, used for electricity) and Annex III (electricity as a CBAM good) of 2025/2621 are not included. The Excel file does not contain them, as its disclaimer says. They were not part of the request.
- Annex IV (highest default values for precursors) is in the Excel file as sheet "Annex IV" but was not extracted.

## 2. `eea_grid_intensity.csv`: EEA greenhouse gas emission intensity of electricity generation

### Source
- Indicator: "Greenhouse gas emission intensity of electricity generation in Europe", ENER038.
  - Page: https://www.eea.europa.eu/en/analysis/indicators/greenhouse-gas-emission-intensity-of-1
  - Published 2026-07-10. Temporal coverage 1990–2024. Unit gCO2e/kWh. Updated once a year.
- Country values come from Figure 2, "Greenhouse gas emission intensity of electricity generation, country level":
  - Page: https://www.eea.europa.eu/en/analysis/indicators/greenhouse-gas-emission-intensity-of-1/greenhouse-gas-emission-intensity-of-electricity-generation
  - We read the figure's data from the EEA Plone REST API (`https://www.eea.europa.eu/++api++/en/analysis/indicators/greenhouse-gas-emission-intensity-of-1/greenhouse-gas-emission-intensity-of-electricity-generation`, field `visualization.dataSources`). The figure was modified 2026-07-10T08:23:07Z.
  - The data is saved as `raw/eea_fig2_country_level_api.json`.
- The EU27 row comes from Figure 1, "EU level", field "Greenhouse gas (GHG) emission intensity (gCO2e/kWh)", year 2024:
  - Page: https://www.eea.europa.eu/en/analysis/indicators/greenhouse-gas-emission-intensity-of-1/greenhouse-gas-emission-intensity-1
  - Saved as `raw/eea_fig1_eu_level_api.json`.
- Latest year: **2024** for all 27 member states. The figure note says "EEA early estimate for 2024". We found no 2025 value on the EEA site.
- Method, as the EEA defines it: CO2e emissions from public electricity production divided by gross electricity production. This is a generation intensity. It does not account for imports or exports, so it is not a consumption grid-mix factor.
- Underlying data sources:
  - EEA national GHG inventories (UNFCCC / EU Governance): https://sdi.eea.europa.eu/catalogue/srv/eng/catalog.search#/metadata/3b7fe76c-524a-439a-bfd2-a6e4046302a2
  - Eurostat nrg_bal_c

### Rows (28)
- 27 member states, each with its 2024 value. Values are integers, as the figure publishes them.
- 1 extra row, `EU27`, with the EU-level value from Figure 1. It is marked as not a member state.
- `country_code` is ISO 3166-1 alpha-2, which uses GR for Greece where the EU convention is EL. We added this mapping; it is not in the source.

### Data-quality notes (important)
1. **The attached CSV is out of date.** The figure has an attached file, `FIG2-291456-ENER038.csv`, at `.../greenhouse-gas-emission-intensity-of-electricity-generation/fig2-291456-ener038/@@download/file`, saved as `raw/eea_FIG2-291456-ENER038_attached.csv (not kept in the repo: out of date, see note 1)`. It is byte-identical to the file attached to the previous, archived version of the indicator (`...greenhouse-gas-emission-intensity-of-1-1783671782/...`). Its 2024 values differ from the current chart data for 26 of 27 countries; for example, Lithuania is 29 in the CSV and 61 in the chart, and Estonia is 585 and 384. Its EU-27 2024 value is 187, which matches the previous version's EU figure of 187.08. The current EU figure is 183.44.

   The current indicator text says that Poland, Cyprus, Estonia and Czechia are the highest in 2024 and that Sweden, Finland and Luxembourg are the lowest. Only the current chart data matches this. We therefore used the current chart data (the July 2026 release). Do not use the attached CSV.
2. In the current Figure 2 data, the 28th entry has the label `#N/A`. Its value is 183 for 2024 and 206 for 2023. This matches the EU-level series (183.44 and 205.65), so it is very probably the EU-27 aggregate with a broken label. We left it out and used the explicitly labelled Figure 1 value for the EU27 row instead.

### Licence
EEA legal notice (https://www.eea.europa.eu/en/legal-notice): "EEA materials are published under the CC-BY license" (CC BY 4.0). They may be reused free of charge, for commercial or non-commercial purposes, provided that the EEA is acknowledged as the original source and the meaning is not distorted. Third-party content is excluded. Neither the indicator page nor the figure has its own `rights` field (it is empty).

Suggested credit: "Source: European Environment Agency (EEA), indicator ENER038, CC BY 4.0".

## Checksums (SHA-256)
```
900583811c7e1194799eb9bdbad2d6d7e1100f5a7d80a664c1584a8fce6f9f35  raw/DV_correcting_act_final_update_06.08.xlsx
811439cb2aed22f8d9d7fb225dca098f832b013a8990b7340606193eaf58bd1a  raw/eea_fig2_country_level_api.json
610cc34bbd9dece3e2c621cf4bdc345e961d7083d75dd577d6e05da9e406abd7  raw/eea_fig1_eu_level_api.json
8b33f632253590a91047ca7841f0938566e4e2eb3c61d49b4012a0219a9cba63  raw/eea_FIG2-291456-ENER038_attached.csv (not kept in the repo: out of date, see note 1)
```
