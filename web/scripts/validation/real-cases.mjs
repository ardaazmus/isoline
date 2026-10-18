// Writes the validation cases taken from published sources (web/validation/cases/r-*.json): official worked
// examples and a regulator's facility record. Inputs and expected results are copied from the documents with
// page references. The only arithmetic done here is exact unit conversion (lb → t, Btu → J) on inputs, one
// precursor input formed from two printed figures (Mᵢ × SEFA), and one subtraction of two printed figures where
// the document contradicts the regulation (see r-cbam-steel-rails-5d).
// Source documents, SHA-256 hashes and reuse terms: docs/kaynak-veri/dogrulama/README.md. Run: npm run validate:build
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { R } from "./rat.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "../../validation/cases");
fs.mkdirSync(outDir, { recursive: true });
const write = (c) => fs.writeFileSync(path.join(outDir, `${c.id}.json`), JSON.stringify(c, null, 2) + "\n");
const num = (r) => Number(r.toFixed(15));

// Exact definitions: international avoirdupois pound (1959) and International Table Btu.
const T_PER_LB = R("0.00045359237");
const GJ_PER_MMBTU = R("1.05505585262");

const inventory = (year, parts) => ({
  year,
  fuels: [],
  process: [],
  refrigerants: [],
  electricity: [],
  scope3: [],
  revenueMillionTry: 0,
  productionTonnes: 0,
  ...parts,
});

/** A fuel line whose factors are given per mmBtu (HHV, US practice), expressed in the app's GJ and t/TJ units. */
const hhvFuel = (id, label, amount, mmbtuPerUnit, kgCo2PerMmbtu) => ({
  id,
  fuel: "natural_gas",
  label,
  amount,
  ncv: num(R(mmbtuPerUnit).mul(GJ_PER_MMBTU)),
  ef: num(R(kgCo2PerMmbtu).div(GJ_PER_MMBTU)),
  mobile: false,
  quality: "measured",
});

const elec = (id, label, mwh, extra) => ({ id, label, mwh, connection: "distribution", certifiedMwh: 0, supplierFactor: null, quality: "measured", ...extra });

// ---------------------------------------------------------------- Stationary combustion, US EPA

write({
  id: "r-epa-ghgrp-steel-dynamics-2023",
  profile: "local",
  title: "EPA GHGRP tesis kaydı: Steel Dynamics Columbus 2023, doğal gaz, Tier 1 (Denklem C-1)",
  source: {
    kind: "regulator-facility-record",
    cite: "US EPA GHGRP, tesis 1004616, raporlama yılı 2023, C_FUEL_LEVEL_INFORMATION (birim GP-1); 40 CFR 98 Tablo C-1",
    url: "https://data.epa.gov/efservice/C_FUEL_LEVEL_INFORMATION/FACILITY_ID/=/1004616/REPORTING_YEAR/=/2023/JSON",
    page: "tek satır: tier1_fuel_quantity 4011026965 scf, tier1_co2_combustion_emissions 218358.5",
  },
  engine: "ghg",
  input: {
    inventory: inventory(2023, {
      fuels: [hhvFuel("f1", "Doğal gaz (ABD ağırlıklı ortalama)", 4_011_026_965, "0.001026", "53.06")],
    }),
  },
  expected: { scope1: "218358.5" },
  notes:
    "Tablo C-1: üst ısıl değer 1,026 × 10⁻³ mmBtu/scf, 53,06 kg CO₂/mmBtu. Uygulamaya GJ ve t/TJ olarak girildi (1 mmBtu = 1,05505585262 GJ); çarpım birim dönüşümünden bağımsızdır. Kayıt CH₄ 4,12 t (102,9 t CO₂e) ve N₂O 0,412 t (122,6 t CO₂e) da raporluyor; uygulamanın yakıt satırları yalnız CO₂ hesapladığı için karşılaştırma CO₂ ile yapılır. CO₂e toplamına göre fark %0,10'dur.",
});

write({
  id: "r-epa-cccl-boiler",
  profile: "local",
  title: "EPA Kurumsal İklim Liderliği Merkezi çözümlü örneği: doğal gaz kazanı, 12 aylık fatura",
  source: {
    kind: "official-worked-example",
    cite: "US EPA Center for Corporate Climate Leadership, Direct Emissions from Stationary Combustion Sources (Aralık 2023), Example Emissions Calculation, Tablo 1",
    url: "https://www.epa.gov/sites/default/files/2020-12/documents/stationaryemissions.pdf",
    page: "basılı s. 6-7 (PDF s. 9-10)",
  },
  engine: "ghg",
  input: {
    inventory: inventory(2023, {
      fuels: [hhvFuel("f1", "Doğal gaz kazanı", 6_000_000, "0.001025", "53.06")],
    }),
  },
  expected: {
    scope1: "326.3",
    energyGj: R(6150).mul(GJ_PER_MMBTU).toFixed(6),
  },
  notes:
    "6.000.000 scf × 1.025 Btu/scf = 61.500 therm = 6.150 mmBtu; × 53,06 kg CO₂/mmBtu = 326,3 t CO₂ (belgede basılı). Enerji beklentisi, basılı 6.150 mmBtu'nun tam birim dönüşümüdür. Belgenin CO₂e toplamı 326,7 t (CH₄ ve N₂O dahil); uygulama yakıt satırında yalnız CO₂ hesapladığı için fark %0,12'dir.",
});

// ---------------------------------------------------------------- Scope 2, GHG Protocol worked examples

write({
  id: "r-ghgp-scope2-location",
  profile: "local",
  title: "GHG Protokolü Kapsam 2 Rehberi Tablo 6.4: konum bazlı, dört tesis",
  source: {
    kind: "official-worked-example",
    cite: "GHG Protocol Scope 2 Guidance (2015), Tablo 6.4 (eGRID 2010 ve IEA 2011 faktörleri)",
    url: "https://ghgprotocol.org/sites/default/files/2023-03/Scope%202%20Guidance.pdf",
    page: "basılı s. 50 (PDF s. 52)",
  },
  engine: "ghg",
  input: {
    inventory: inventory(2013, {
      electricity: [
        elec("e1", "ABD NYUP (eGRID)", 2500, { gridFactor: num(R("545.79").mul(T_PER_LB)) }),
        elec("e2", "ABD RFCE (eGRID)", 2500, { gridFactor: num(R("1001.72").mul(T_PER_LB)) }),
        elec("e3", "Danimarka (IEA)", 3000, { gridFactor: 0.3152 }),
        elec("e4", "Belçika (IEA)", 2000, { gridFactor: 0.1957 }),
      ],
    }),
  },
  expected: { scope2Location: "3091.908" },
  notes:
    "eGRID faktörleri lb CO₂/MWh olarak basılı; 1 lb = 0,45359237 kg ile t/MWh'e çevrildi. Karşılaştırma basılı CO₂ toplamıyla (3.091,908 t) yapılır. Basılı CO₂e toplamı 3.100,876 t, ABD tesislerinin CH₄ ve N₂O payını da içerir. Bu iki gaz yalnız ABD tesislerinde var ve uygulamanın şebeke faktörü tek bir CO₂e değeri olarak girildiği için ayrı tutulmadı.",
});

write({
  id: "r-ghgp-scope2-market",
  profile: "local",
  title: "GHG Protokolü Kapsam 2 Rehberi Tablo 6.5: piyasa bazlı; sertifika, tedarikçi ve kalan karışım",
  source: {
    kind: "official-worked-example",
    cite: "GHG Protocol Scope 2 Guidance (2015), Tablo 6.5",
    url: "https://ghgprotocol.org/sites/default/files/2023-03/Scope%202%20Guidance.pdf",
    page: "basılı s. 51 (PDF s. 53)",
  },
  engine: "ghg",
  input: {
    inventory: inventory(2013, {
      electricity: [
        // 1.000 MWh PPA + REC, 2.000 MWh paket REC, 1.000 MWh ayrı REC: 0; kalan 1.000 MWh şebeke ortalaması 0,5
        elec("e1", "ABD operasyonları", 5000, { certifiedMwh: 4000, gridFactor: 0.5 }),
        elec("e2", "AB: tedarikçi programı", 3000, { supplierFactor: 0.25 }),
        elec("e3", "AB: kalan karışım (RE-DISS Belçika 2013)", 2000, { supplierFactor: 0.5 }),
      ],
    }),
  },
  expected: { scope2Market: "2250" },
  notes: "Satır sonuçları basılı: 0 + 0 + 0 + 500 + 750 + 1.000 = 2.250 t CO₂e. Konum bazlı değer bu tabloda yayımlanmadığı için karşılaştırılmaz.",
});

// ---------------------------------------------------------------- EU CBAM, DG TAXUD guidance of 14.08.2026

const scenario = { startPrice: 75.36, priceGrowth: 0, originCarbonPrice: 0, eurTry: 0 };
const product = (p) => ({ name: p.id, growth: 0, seeDirect: 0, seeIndirect: 0, defaultSee: 0, useDefault: false, benchmark: 0, ...p });

write({
  id: "r-cbam-cement-5a",
  profile: "cbam",
  title: "AB SKDM Rehberi 5a: 100 t Portland çimentosu, 2026, gerçek veri ve klinker öncülü",
  source: {
    kind: "official-worked-example",
    cite: "AB Komisyonu DG TAXUD, Guidance Document No. 5a (çimento), 14.08.2026, bölüm 4.3",
    url: "https://taxation-customs.ec.europa.eu/document/download/f87a2022-9dcb-45cb-a415-4c460e5ad672_en?filename=Guidance%20No.%205a%20-%20Sector-specific%20guidance%20document%20on%20cement.pdf",
    page: "s. 28-29",
  },
  engine: "cbam",
  input: {
    years: [2026],
    scenario,
    products: [
      // Kolon A çimento = 0 (tablodan); öncül: gri klinker 0,666 × Mᵢ 0,95 = 0,6327 (belgede basılı)
      product({ id: "cement", cn: "25232900", origin: "OTHER", sector: "cement", tonnes: 100, seeDirect: 0.7852, seeIndirect: 0.0919, precursorBm: 0.6327 }),
    ],
  },
  expected: {
    "cement.2026.see": "0.8771",
    "cement.2026.gross": "87.71",
    "cement.2026.benchmark": "0.6327",
    "cement.2026.faa": "61.7",
    "cement.2026.certificates": "26",
  },
  notes:
    "Çimentoda dolaylı emisyon sayılır (Ek II'de değil). Basılı: 78,52 + 9,19 = 87,71 t; FAA 100 × 0,6327 × 0,975 × 1,00 = 61,7; 87,7 − 61,7 = 26 sertifika. Örnek tesis Lübnan'da; kütüphanede Lübnan tablosu yok ve gerçek veride menşe yalnız rota seçimini etkiler (çimentoda rota yok).",
});

write({
  id: "r-cbam-steel-rails-5d",
  profile: "cbam",
  title: "AB SKDM Rehberi 5d Örnek 1: 10.000 t ray, 2027, yüksek fırın rotası (kabarcık yaklaşımı)",
  source: {
    kind: "official-worked-example",
    cite: "AB Komisyonu DG TAXUD, Guidance Document No. 5d (demir-çelik), 14.08.2026, Örnek 1, Tablo 4-6 ve ithalat hesabı",
    url: "https://taxation-customs.ec.europa.eu/document/download/3eb64513-8255-4c71-875a-bd0a8c7ff772_en?filename=Guidance%20No.%205d%20-%20Sector-specific%20guidance%20document%20on%20iron%20and%20steel.pdf",
    page: "s. 43-44",
  },
  engine: "cbam",
  input: {
    years: [2027],
    scenario,
    products: [
      // Kolon A ray = 0,057 (tablodan); öncül: ham çelik SEFA 1,156 × Mᵢ 1,042 (ikisi de Tablo 4-6'da basılı)
      product({ id: "rails", cn: "730210", origin: "OTHER", sector: "iron_steel", tonnes: 10000, seeDirect: 1.539, seeIndirect: 0.028, bmRoute: "C", precursorBm: num(R("1.156").mul("1.042")) }),
    ],
  },
  expected: {
    "rails.2027.see": "1.539",
    "rails.2027.gross": "15390",
    "rails.2027.benchmark": "1.261",
    "rails.2027.faa": "11980",
    // Tüzük 2023/956 Ek II: demir-çelikte yalnız doğrudan emisyon. Basılı doğrudan (15.390) − basılı FAA (11.980).
    "rails.2027.certificates": R(15390).sub(11980).toFixed(0),
  },
  notes:
    "Rehber sertifikayı 15.670 − 11.980 = 3.690 olarak basıyor; 15.670 dolaylı emisyonu (280 t) da içeriyor. Oysa Tüzük 2023/956 Ek II ve aynı tarihli Rehber No. 1 (PDF s. 10: 'For other CBAM goods, only direct emissions are covered') demir-çelikte yalnız doğrudan emisyonu sayar. Uygulama tüzüğü izler; beklenen sertifika sayısı basılı doğrudan emisyon ile basılı FAA'nın farkıdır (3.410). SEFA ray 1,261 = 0,057 + 1,042 × 1,156; uygulama 1,2616 bulur (%0,04).",
});

write({
  id: "r-cbam-hydrogen-5b",
  profile: "cbam",
  title: "AB SKDM Rehberi 5b: 100 t hidrojen, 2028, buhar reformu ve ısı ihracı",
  source: {
    kind: "official-worked-example",
    cite: "AB Komisyonu DG TAXUD, Guidance Document No. 5b (hidrojen), 14.08.2026, bölüm 4",
    url: "https://taxation-customs.ec.europa.eu/document/download/04ceca3b-466e-4ed9-a1a5-a47c2e5e5be0_en?filename=Guidance%20No.%205b%20-%20Sector-specific%20guidance%20document%20on%20hydrogen.pdf",
    page: "s. 18-19",
  },
  engine: "cbam",
  input: {
    years: [2028],
    scenario,
    products: [product({ id: "h2", cn: "28041000", origin: "OTHER", sector: "hydrogen", tonnes: 100, seeDirect: 8.396 })],
  },
  expected: {
    "h2.2028.see": "8.396",
    "h2.2028.gross": "839.6",
    "h2.2028.benchmark": "5.089",
    "h2.2028.faa": "458.0",
    "h2.2028.certificates": "381.6",
  },
  notes: "Kıyas 5,089 t CO₂/t H₂ (2025/2620, öncülsüz). SEFA = 5,089 × 0,90 × 1,00 = 4,580; 839,6 − 458,0 = 381,6 sertifika (basılı).",
});

write({
  id: "r-cbam-default-lookup-4",
  profile: "cbam",
  title: "AB SKDM Rehberi 4: varsayılan değer işaretleme payı ve varsayılan kıyas, CN 7318 15, 2026-2028",
  source: {
    kind: "official-worked-example",
    cite: "AB Komisyonu DG TAXUD, Guidance Document No. 4 (ücretsiz tahsis düzeltmesi), 14.08.2026, Tablo 2-3 ve 2-4",
    url: "https://taxation-customs.ec.europa.eu/document/download/3aa2c730-4f1b-4524-8f71-d9cfe4880ac7_en?filename=Guidance%20No.%204%20-%20CBAM%20calculation%20of%20the%20free%20allocation%20adjustment%20to%20the%20number%20of%20CBAM%20certificates%20to%20be%20surrendered.pdf",
    page: "Tablo 2-3 s. 19; Tablo 2-4 s. 21",
  },
  engine: "cbam",
  input: {
    years: [2026, 2027, 2028],
    scenario,
    products: [
      // Cezayir varsayılan değeri 3,000 (Uyg. Tüz. 2025/2621 Ek I), elle girildi; rota tablosu (C)
      product({ id: "bolts", cn: "73181520", origin: "OTHER", sector: "iron_steel", tonnes: 100, defaultSee: 3, useDefault: true }),
      product({ id: "stainless", cn: "73181535", origin: "OTHER", sector: "iron_steel", tonnes: 100, defaultSee: 3, useDefault: true }),
    ],
  },
  expected: {
    "bolts.2026.see": "3.300",
    "bolts.2027.see": "3.600",
    "bolts.2028.see": "3.900",
    "bolts.2026.benchmark": "1.364",
    "bolts.2028.benchmark": "1.364",
    "stainless.2026.benchmark": "1.154",
    "stainless.2027.benchmark": "1.154",
    "stainless.2028.benchmark": "1.116",
  },
  notes:
    "Rehberin örneği Cezayir; kütüphanede Cezayir tablosu yok, kullanıcı 'Diğer ülkeler'i seçip Cezayir değerini elle girer. 'Diğer ülkeler' tablosunun 7318 15 rotası da (C) olduğu için varsayılan kıyas rehberle aynı satırdan seçilir. 7318 15 35 (paslanmaz) için kıyas rotaya değil döneme bağlıdır: 2026-27 1,154, 2028-30 1,116.",
});

write({
  id: "r-cbam-factor-table-4",
  profile: "cbam",
  title: "AB SKDM Rehberi 4 Tablo 2-1: SKDM faktörü ve CSCF, 2026-2034",
  source: {
    kind: "official-parameter-table",
    cite: "AB Komisyonu DG TAXUD, Guidance Document No. 4, 14.08.2026, Tablo 2-1; Uygulama Kararı (AB) 2026/1862 Md. 1",
    url: "https://taxation-customs.ec.europa.eu/document/download/3aa2c730-4f1b-4524-8f71-d9cfe4880ac7_en?filename=Guidance%20No.%204%20-%20CBAM%20calculation%20of%20the%20free%20allocation%20adjustment%20to%20the%20number%20of%20CBAM%20certificates%20to%20be%20surrendered.pdf",
    page: "s. 13",
  },
  engine: "cbam",
  input: {
    years: [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034],
    scenario,
    products: [product({ id: "unit", cn: "28041000", origin: "OTHER", sector: "hydrogen", tonnes: 1, seeDirect: 2, bmMode: "manual", benchmark: 1 })],
  },
  expected: Object.fromEntries(
    Object.entries({ 2026: "0.975", 2027: "0.95", 2028: "0.90", 2029: "0.775", 2030: "0.515", 2031: "0.39", 2032: "0.265", 2033: "0.14", 2034: "0" }).map(([y, f]) => [
      `unit.${y}.faa`,
      f,
    ]),
  ),
  notes:
    "Kıyas 1 t CO₂/t olan 1 t ürün için FAA = SKDM faktörü × CSCF. CSCF 2026-2030 için 1,00 (Karar 2026/1862); 2031 sonrası tabloda ön değer 1,0.",
});

console.log("published-source cases written to", outDir);
