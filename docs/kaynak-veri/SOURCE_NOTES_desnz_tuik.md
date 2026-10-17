# factors2: DESNZ 2026 Scope 3 subset + Türkiye NID 2026 NCVs / CO2 EFs

Prepared 2026-10-18. All numbers are copied from the published files with no rounding,
estimating or recalculating. Every row records where it came from.

## Files

| File | Rows (excluding header) | Content |
|---|---|---|
| `desnz_scope3.csv` | 51 | Curated subset of UK DESNZ "Greenhouse gas reporting: conversion factors 2026" (full set), kg CO2e per unit |
| `tuik_ncv.csv` | 19 | Net calorific values from Türkiye's 2026 National Inventory Document (NID) |
| `tuik_co2_ef.csv` | 53 | CO2 emission factors from the same NID |
| `raw/` | 4 files | Original downloaded files, unchanged (SHA-256 below; in the repository the DESNZ workbooks are in desnz/raw, the NID PDF is not redistributed) |

Format: semicolon-separated, UTF-8 (no BOM), decimal point. A `;` inside a text field
was replaced by `,` so that every row has the same number of fields.

Extraction scripts were kept outside the repository (research workspace); the checks they ran are described below and were repeated independently before import.
- `extract_desnz.cjs`: reads the named cells with SheetJS 0.20.3, checks the row labels, and cross-checks each value against the flat file
- `extract_tuik.cjs`: runs xpdf `pdftotext` on named PDF pages, parses the lines, and cross-checks them
- `dump_sheet.cjs`, `sha_list.cjs`, `pdfmeta.cjs`: helpers

---

## A. UK DESNZ: Greenhouse gas reporting, conversion factors 2026

- **Collection page:** https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026
- **Publisher:** Department for Energy Security and Net Zero (DESNZ)
- **Published:** 11 June 2026, 09:30 BST. Page last updated 31 July 2026.
- **The 31 July update** republished the flat file only. It corrected values that had been reported as 0 instead of left blank (WTT for certain hybrid, CNG and LPG cars, and hotel stays in some countries). The page says the full set "has not been revised".
- **Versions:** full set version 1. Flat file version 1.2, "Updated" cell = 2026-07-10. Next publication: June 2027.
- **Condensed set:** none was published for 2026. The page lists only the full set, the flat file, the methodology report and the major-changes report.
- **Licence:** the GOV.UK page footer states that all content is available under the **Open Government Licence v3.0**, except where otherwise stated. The workbook and the page give no other licence. OGL v3.0 allows copying, adaptation and commercial use, provided the source is attributed, for example: "Contains public sector information licensed under the Open Government Licence v3.0". The workbook front page also says the factors are used "at the users' own risk".

### Downloaded files

| File in `raw/` | URL |
|---|---|
| `ghg-conversion-factors-2026-full-set.xlsx` | https://assets.publishing.service.gov.uk/media/6a29392bade52dc0882218a8/ghg-conversion-factors-2026-full-set.xlsx |
| `ghg-conversion-factors-2026-flat-format-revised.xlsx` | https://assets.publishing.service.gov.uk/media/6a6c9748862aaf18d9c62ac9/ghg-conversion-factors-2026-flat-format-revised.xlsx |
| `govuk_ghg-conversion-factors-2026_collection_page.html` | snapshot of the collection page (provenance: dates, licence footer, update note) |

The methodology report and the major-changes report were not downloaded:
- https://assets.publishing.service.gov.uk/media/6a2940543b15d05a7ce3202e/2026-GHG-conversion-factors-methodology-report.pdf
- https://assets.publishing.service.gov.uk/media/6a2940653b15d05a7ce3202f/2026-GHG-conversion-factors-major-changes-report.pdf

### How `desnz_scope3.csv` was built

**Value source and column meanings**
- Values come from the **full set**. `sheet` and `row` give the Excel worksheet and its 1-based row number. The note names the exact value cell (for example `Value cell D63`).
- `kg_co2e` is the stored cell value from the column headed `kg CO2e` (the total), never the CO2/CH4/N2O split. Excel shows these cells with 5 decimals, so `0.3366` is displayed as `0.33660` and `32.1` as `32.10000`. The numbers are identical.
- `activity` and `type` are the labels in columns A and B. Merged or blank cells were filled from the nearest label above, within the same table.
- `size_or_class` holds the column group the value sits under, such as `Average laden`, `Diesel`, `With RF`, `Unknown`, a disposal method or `Primary material production`. It can also be the class or size column of the row.

**Automatic checks:** `extract_desnz.cjs` verifies, for every row:
1. the activity, type, size/class and unit labels;
2. that the metric header is exactly `kg CO2e`;
3. that the column-group header is the expected one;
4. that exactly one row in the flat file (sheet `Factors by Category`) has the same Level 1–4 / Column Text labels, the same UOM, `GHG/Unit = kg CO2e` and the identical value.

All 51 rows passed. The flat-file ID is written in each note.

### Deviations from the request

- **HGV "All HGVs":** the 2026 set has no row named `HGV (all diesel) / All HGVs`. HGVs are split into two tables, `HGV (non-refrigerated, all diesel)` and `HGV (refrigerated, all diesel)`. I used `Average non-refrigerated HGVs`, Average laden (Freighting goods row 63). The refrigerated equivalent, `Average refrigerated HGVs` (row 91), was not extracted.
- **Hotel UK:** the file's label is `UK`, not `United Kingdom` (row 22). A separate `UK (London)` row exists (row 23).
- **Material use, aluminium:** the file's label is `Metal: aluminium cans and foil (excl. forming)`.
- **Waste, recycling:** the 2026 waste table has no column called "Recycling". It has `Open-loop` and `Closed-loop`, and the extracted rows use these names. The columns that exist:
  - commercial and industrial waste: Closed-loop only, no Open-loop;
  - paper and board, mixed: Closed-loop only;
  - average plastics and scrap metal: both Open-loop and Closed-loop.

  The sheet guidance says that for combustion and recycling the factors cover transport to the facility only.
- **Waste, commercial and industrial waste:** the row also has an Anaerobic digestion value. It was not requested and was not extracted.
- **WTT natural gas:** the `Natural gas` block (rows 38–41) was used. A separate `Natural gas (100% mineral blend)` block (rows 42–45) also exists and has the same values in this edition.
- **Business travel, air (domestic):** domestic flights have only an `Average passenger` row, with no economy split.
- **Taxi:** the `km` (vehicle-km) row (row 72) was used as requested. `Regular taxi` also has a passenger.km row (row 71).

---

## B. Türkiye national GHG inventory: NID 2026 (inventory years 1990-2024)

### Submission

- **Title (cover):** GREENHOUSE GAS INVENTORY OF TÜRKİYE 1990-2024, "National Inventory Document for submission under the United Nations Framework Convention on Climate Change", April 2026.
- **Prepared by:** Turkish Statistical Institute (TurkStat/TÜİK). Contact details are on the pages after the cover.
- **Submission date:** 14 April 2026, for both the NID and the CRT. This comes from the Climate Policy Radar / Climate Change Laws of the World records of the UNFCCC documents. The PDF's internal CreationDate is `2026-04-14 12:36:09 +03:00` (Producer: iLovePDF).

  A search-engine summary of https://unfccc.int/documents/656425 gives "submission 14 Apr 2026, publication 15 Apr 2026". **I could not open unfccc.int myself** (see below).
- **Official URLs:**
  - NID PDF: https://unfccc.int/sites/default/files/resource/TUR_NID_2026.pdf
  - CRT document page: https://unfccc.int/documents/656426
  - Annex I 2026 submissions list: https://unfccc.int/ghg-inventories-annex-i-parties/2026

### How the NID was obtained

Every unfccc.int URL (pages and `/sites/default/files/...` files, all hostnames) is behind an Imperva/Incapsula bot check. curl receives a JavaScript challenge page, and a browser receives an "I'm not a robot" CAPTCHA. I did not try to get past the check.

The NID was therefore downloaded from the Climate Policy Radar CDN mirror, which is listed on climate-laws.org as a copy of the UNFCCC file:
https://cdn.climatepolicyradar.org/navigator/TUR/2026/turkiye-national-inventory-report-nir-2026_67cca463bc9ff044072f412890a8d477.pdf

It was saved as `raw/TUR_NID_2026.pdf`, with the content unchanged and only the file name changed.

**Integrity check:** the file is 7,731,757 bytes and its MD5 is `67cca463bc9ff044072f412890a8d477`. The independent PRIMAP/UNFCCC data repository records the same values for its download of `TUR_NID_2026.pdf` from UNFCCC (git-annex key `MD5E-s7731757--67cca463bc9ff044072f412890a8d477`; repository https://github.com/JGuetschow/UNFCCC_non-AnnexI_data, path `downloaded_data/UNFCCC/Türkiye/NID2026/`). The mirror copy is therefore byte-identical to the file UNFCCC served.

### CRT (Common Reporting Tables): NOT obtained

- The CRT exists. The PRIMAP repository lists `TUR-CRT-2026-V1.0.zip` and `TUR-CRT-2026-V1.0-1990.xlsx` … `TUR-CRT-2026-V1.0-2024.xlsx`.
- I could not download it:
  - unfccc.int shows the CAPTCHA;
  - the Climate Policy Radar "CRT" entry is only an "Access denied" placeholder PDF that they generated;
  - the PRIMAP data store (gin.hemio.de) failed the TLS handshake;
  - web.archive.org returned HTTP 429 for every request.
- If you download the files manually, you can check them against the PRIMAP git-annex keys:
  - `TUR-CRT-2026-V1.0-2024.xlsx`: 3,522,309 bytes, MD5 `f620aaa1fb627a0e0d3704032ae8cbb9`
  - `TUR-CRT-2026-V1.0-2023.xlsx`: 3,514,895 bytes, MD5 `af9bd5b128f75f8661e98c0edbdc36c4`
- **Consequence:** no CRT Table 1.A(b) values are included, there is no CRT/NID cross-check, and there are no 2023 NCVs. The NID publishes NCVs for 2024 only.
- **Caution for later CRT use:** NID section 3.2.1 (PDF p.88–90, printed pp.51–53) says the reference approach uses energy-balance data in ktoe. It also says the reference approach "multiplies the apparent fuel consumption by a single conversion factor". So the CRT 1.A(b) "conversion factor" column may not hold fuel-specific NCVs. This is unverified.

### How the PDF values were extracted

xpdf `pdftotext` 4.06 was used, from Git for Windows. No other PDF tool was available, and the pages could not be rendered to images.

- **Default `-layout` mode does not work for these tables.** On the NCV page it shifts the values one row against the labels, so it was not used.
- Each value was taken from **`-raw` mode** (content-stream order, where label, value and unit sit on one line). It was then confirmed in **`-table` mode** (position-based): the same label and value, or the identical row, must appear on one line. All rows passed both checks.
- **Page numbers:** "PDF page" is the 1-based page index in the file. "Printed page" is the page number printed on the page; PDF page = printed page + 37.

### `tuik_ncv.csv`

- **Main source: 11 rows.** These come from NID Annex 4, "Emission Factors used in the Energy Sector", table "NCV of Fuels", column `2024` (PDF page 482, printed page 445).
- **Units:** as published, `TJ/kton`. For natural gas the unit is `TJ/10^6m³`. The table footnote gives `(TJ/kt) = (1000 TOE)/(kt) * 41.868`.
- **Fuel name mapping**, based on NID Table 3.9 (fuel allocation, PDF p.88):

  | Requested fuel | Row label in the NID |
  |---|---|
  | residual fuel oil | `Fuel oil` |
  | gas/diesel oil | `Diesel oil` |
  | motor gasoline | `Gasoline` |

- **Six more rows** come from Table 3.17, "Average NCVs of fuels used in category 1.A.1.a", `Weighted average` column (PDF p.101, printed p.64). These are averages over public electricity/heat plants only, and **the table states no year**. The table's IPCC "Default" column is quoted in the note.
- **Two more rows** give the natural gas NCV used for IPPU ammonia production: 8443.87 kcal/sm³ and 0.035353 GJ/sm³, source BOTAŞ (Annex 4 IPPU table, PDF p.486, printed p.449). These are a cross-reference only, not an energy-sector table.

### `tuik_co2_ef.csv`

The rows come from four NID tables:

| Table | Location | Coverage |
|---|---|---|
| Table 3.7 "CO₂ emission factors of fuels" | PDF p.84, printed p.47 | 2024 and 2023 for the 11 requested fuels it lists |
| Annex 4 "Country Specific CO₂ Emission Factors (t/TJ)" | PDF p.483, printed p.446 | Hard Coal, Lignite, Coke, Natural Gas; 2024 and 2023 |
| Annex 4 "Default CO₂ Emission Factors" | PDF p.484, printed p.447 | one value labelled `1990-2024` |
| Table 3.18 "CO₂ emission factors used for source category 1.A.1.a" | PDF p.102, printed p.65 | 2024 and 2023; power-plant category only |

**Whether each EF is country-specific or default:** the note states what the NID itself says.
- Table 3.5 (PDF p.83) lists country-specific carbon contents for: Hard coal, Lignite, Coke, Petrocoke, Fuel oil, Diesel, Naphtha and Natural gas.
- The text on PDF p.82 (printed p.45) says country-specific carbon content is used for diesel oil and residual fuel oil, and 2006 IPCC default EFs for gasoline and LPG.

### Ambiguities and gaps (Türkiye)

1. **Coking coal:** there is no NCV or EF row for it in the NID. Table 3.9 allocates the national `Hard coal` to CRT `Coking coal` in the reference approach. No separate figure was extracted.
2. **Hard coal, imported vs domestic:** the NID gives one `Hard coal` NCV and EF, with no split.
3. **Natural gas NCV:** it is published per volume in Annex 4 (`TJ/10^6m³`) but per mass in Table 3.17 (`TJ/kt`, 1.A.1.a only). The two are not comparable without a density assumption, and none was applied.
4. **Table 3.7 and the Annex 4 "Country Specific" table disagree for the same year:**

   | Fuel | 2024: Table 3.7 | 2024: Annex 4 | 2023: Table 3.7 | 2023: Annex 4 |
   |---|---|---|---|---|
   | Hard coal | 95.6 | 96.65 | 95.80 | 96.64 |
   | Lignite | 105.5 | 106.24 | 105.5 | 105.83 |
   | Coke | 113.7 | 113.11 | 111.3 | 110.34 |
   | Natural gas | 55.9 | 55.89 | 56.0 | 55.75 |

   The Annex 4 Hard Coal and Lignite values equal Table 3.18 (1.A.1.a) `Sub-Bituminous Coal` and `Turkish Lignite` for 2023 and 2024. Both versions are kept, each labelled with its table. This was not resolved.
5. **Default vs country-specific labels conflict:** Annex 4 lists Petroleum Coke, Fuel Oil, Diesel Oil and Naphtha under "Default CO₂ Emission Factors". Table 3.5 lists country-specific carbon contents for those same fuels. This was not resolved.
6. **Wrong annex reference in the NID:** the text on PDF p.83 says "NCVs can be found Annex 3". Annex 3 is the energy balance in ktoe, and the NCV table is actually in Annex 4.
7. **Fuel oil NCV:** Annex 4 gives 37.94 TJ/kton for 2024. The 1.A.1.a weighted average for `Residual Fuel Oil` in Table 3.17 is 47.23 TJ/kt. Both values are copied as published. A visual check of PDF page 482 is recommended, because the page could not be rendered.
8. **Not extracted:**
   - previous-year (2023) NCVs: the NID has only the 2024 column;
   - all CRT values (see above).

### Reuse terms (Türkiye / UNFCCC)

- **The NID itself** has no licence or reuse statement. Its "DISCLAIMER" page (PDF p.9, printed p.i) is a political statement about the Paris Agreement.
- **UNFCCC's Terms of Use page** (https://unfccc.int/this-site/disclaimer) is behind the same CAPTCHA, so **I could not read it**. A search-engine summary says that reproducing content from the main site beyond viewing and printing requires prior written authorisation from the secretariat (webmaster@unfccc.int). That summary is unverified.
- **In practice:** national inventory submissions are public documents, published so that they can be reviewed. The numbers themselves are factual data. Before republishing the PDF, or large verbatim extracts of it, check the UNFCCC terms.
- **The Climate Policy Radar mirror:** their generated pages say "For non-commercial use only". The NID file itself is the original TÜİK/UNFCCC file (MD5 match above), not a Climate Policy Radar product.

---

## SHA-256 of files in `raw/` (computed with Node.js crypto)

```
f10af47855866194e8e71f745f3672c2213b9788316f9e929779f56736687946  7731757  TUR_NID_2026.pdf
a9a455ab396dae226d510c7be6233748416d490c41a5d20f3dc7a0c45feecd5e  515426   ghg-conversion-factors-2026-flat-format-revised.xlsx
b5c4f2f86cdc74707337b2fb013b44ded189a1b528f5e29ea99856ba65ae0205  2109334  ghg-conversion-factors-2026-full-set.xlsx
6fa316ae259b378fb54490f114fac61e64e2ea1b054f77a5202d593207b25128  87241    govuk_ghg-conversion-factors-2026_collection_page.html
```
