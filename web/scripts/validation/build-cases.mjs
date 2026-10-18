// Writes the synthetic validation cases (web/validation/cases/*.json). Inputs use official parameters, quoted
// with their source; expected results are computed here with exact rational arithmetic straight from the
// published formulas, never through the app's engines. Run: npm run validate:build
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { R, sum } from "./rat.mjs";
import { generateMizan } from "./mizan-gen.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "../../validation/cases");
fs.mkdirSync(outDir, { recursive: true });
const fx = (r, d = 12) => r.toFixed(d);
const write = (c) => fs.writeFileSync(path.join(outDir, `${c.id}.json`), JSON.stringify(c, null, 2) + "\n");

// ---------------------------------------------------------------- official parameters (copied, with source)
const P = {
  // TÜİK NID 2026, Annex 4 'NCV of Fuels' 2024 and Table 3.7 CO2 EF 2024 (docs/kaynak-veri/tuik)
  tuikGasNcvTjPerMm3: "34.54", tuikGasEf: "55.9",
  tuikLigniteNcv: "8.35", tuikLigniteEf: "105.5",
  tuikDieselEf: "72.3",
  // IPCC 2006 Vol.2 Table 1.2 NCV 43.0 TJ/Gg × assumed 0.84 kg/L, as used by the app's IPCC default set
  ipccDieselNcvPerL: "0.03612", ipccGasNcv: "0.0345", ipccGasEf: "56.1",
  // IPCC AR6 WG1 Table 7.SM.7 GWP100: R-32 771, R-125 3740; R-410A = 50/50
  gwpR32: "771", gwpR125: "3740",
  // ETKB information forms (docs/kaynak-veri/etkb), tCO2e/MWh
  etkb: { 2022: { tr: "0.445", di: "0.478", gas: "0.379" }, 2023: { tr: "0.436", di: "0.469", gas: "0.405" } },
  // DESNZ 2026 full set (docs/kaynak-veri/desnz), kg CO2e per unit
  desnzHgvKg: "0.10356", desnzHotelTrKg: "32.1",
  // CBAM: Directive 2003/87/EC Art. 10a(1a) CBAM factor; Impl. Reg. 2026/1740 Annex I mark-ups; CSCF 2026/1862
  cbamFactor: { 2026: "0.975", 2028: "0.90" }, markupSteel: { 2026: "0.10", 2028: "0.30" }, cscf: "1",
  // CBAM default values (2026/1740 Annex I): TR 7208 total 2,428; CN 7209 total 3,205
  dvTr7208: "2.428", dvCn7209: "3.205",
  // CBAM benchmarks (2025/2620 point 5.3): 7208 A 0,044, B (C) 1,370; 7209 B (C) 1,458
  bm7208A: "0.044", bm7208B: "1.370", bm7209B: "1.458",
};

// ---------------------------------------------------------------- Profile 1: local producer, 2024
{
  const gas = { amount: "5000000", ncv: R(P.tuikGasNcvTjPerMm3).div(1000), ef: R(P.tuikGasEf) };
  const lig = { amount: "12000", ncv: R(P.tuikLigniteNcv), ef: R(P.tuikLigniteEf) };
  const die = { amount: "85000", ncv: R(P.ipccDieselNcvPerL), ef: R(P.tuikDieselEf) };
  const fuelT = (f) => R(f.amount).mul(f.ncv).mul(f.ef).div(1000);
  const gwp410 = R(P.gwpR32).add(P.gwpR125).div(2);
  const ref = R(25).mul(gwp410).div(1000);
  const s1 = sum([fuelT(gas), fuelT(lig), fuelT(die), ref]);
  const e = P.etkb[2023];
  const s2l = R(9500).mul(e.di).add(R(30000).mul(e.tr));
  const s2m = R(9500 - 1500).mul(e.di).add(R(30000).mul(e.tr));
  const s3 = R(1200000).mul(P.desnzHgvKg).div(1000).add(R(300).mul(P.desnzHotelTrKg).div(1000));
  const energy = sum([gas, lig, die].map((f) => R(f.amount).mul(f.ncv))).add(R(9500 + 30000).mul("3.6"));
  const p1 = {
    id: "p1-local-producer-2024",
    profile: "local",
    title: "Yerel üretici, 2024: TÜİK 2024 ve ETKB 2023 faktörleriyle Kapsam 1-2, DESNZ ile Kapsam 3",
    source: { kind: "synthetic-official-factors", cite: "TÜİK NID 2026 (Ek 4, Tablo 3.7); ETKB 2023 bilgi formu; IPCC AR6 GWP; DESNZ 2026", url: "docs/kaynak-veri" },
    engine: "ghg",
    tolerance: { relative: 1e-9 },
    input: {
      inventory: {
        year: 2024,
        fuels: [
          { id: "f1", fuel: "natural_gas", label: "Doğal gaz", amount: 5000000, ncv: gas.ncv.toNumber(), ef: 55.9, mobile: false, quality: "measured", factorRef: "tuik_nir_2024/tuik_nir_2024:natural_gas" },
          { id: "f2", fuel: "lignite", label: "Linyit", amount: 12000, ncv: 8.35, ef: 105.5, mobile: false, quality: "measured", factorRef: "tuik_nir_2024/tuik_nir_2024:lignite" },
          { id: "f3", fuel: "diesel", label: "Motorin", amount: 85000, ncv: 0.03612, ef: 72.3, mobile: true, quality: "calculated", factorRef: "tuik_nir_2024/tuik_nir_2024:diesel" },
        ],
        process: [],
        refrigerants: [{ id: "r1", gas: "R-410A", leakedKg: 25, quality: "estimated" }],
        electricity: [
          { id: "e1", label: "Dağıtım", mwh: 9500, connection: "distribution", certifiedMwh: 1500, supplierFactor: null, quality: "measured" },
          { id: "e2", label: "İletim", mwh: 30000, connection: "transmission", certifiedMwh: 0, supplierFactor: null, quality: "measured" },
        ],
        scope3: [
          { id: "s1", category: 4, label: "Kara nakliyesi", amount: 1200000, unit: "tonne.km", factor: 0.00010356, factorSource: "DESNZ 2026", quality: "estimated", factorRef: "desnz_2026/desnz_2026:freight_hgv_avg_laden" },
          { id: "s2", category: 6, label: "Otel, Türkiye", amount: 300, unit: "Room per night", factor: 0.0321, factorSource: "DESNZ 2026", quality: "estimated", factorRef: "desnz_2026/desnz_2026:hotel_turkey" },
        ],
        revenueMillionTry: 0,
        productionTonnes: 0,
      },
      // The library must hold the official values the inventory uses.
      factorChecks: [
        { ref: "tuik_nir_2024/tuik_nir_2024:natural_gas", value: "55.9", ncv: fx(gas.ncv) },
        { ref: "tuik_nir_2024/tuik_nir_2024:lignite", value: "105.5", ncv: "8.35" },
        { ref: "tuik_nir_2024/tuik_nir_2024:diesel", value: "72.3" },
        { ref: "etkb_2023/etkb_2023:distribution", value: e.di },
        { ref: "etkb_2023/etkb_2023:transmission", value: e.tr },
        { ref: "desnz_2026/desnz_2026:freight_hgv_avg_laden", value: fx(R(P.desnzHgvKg).div(1000)) },
        { ref: "desnz_2026/desnz_2026:hotel_turkey", value: fx(R(P.desnzHotelTrKg).div(1000)) },
      ],
    },
    expected: { scope1: fx(s1), scope2Location: fx(s2l), scope2Market: fx(s2m), scope3: fx(s3), energyGj: fx(energy) },
  };
  // The library's factors are part of the check: each must equal the official value the case uses.
  for (const c of p1.input.factorChecks) {
    p1.expected[`factor ${c.ref}`] = c.value;
    if (c.ncv !== undefined) p1.expected[`ncv ${c.ref}`] = c.ncv;
  }
  write(p1);
}

// ---------------------------------------------------------------- Profile 2: CBAM exporter, 2026 and 2028
{
  const price = R(80);
  const products = [
    { id: "a", cn: "7208", origin: "TR", tonnes: "10000", useDefault: true, defaultSee: P.dvTr7208, seeDirect: "0", bm: { 2026: R(P.bm7208B), 2028: R(P.bm7208B) } },
    { id: "b", cn: "7209", origin: "CN", tonnes: "2000", useDefault: true, defaultSee: P.dvCn7209, seeDirect: "0", bm: { 2026: R(P.bm7209B), 2028: R(P.bm7209B) } },
    { id: "c", cn: "7208", origin: "TR", tonnes: "5000", useDefault: false, defaultSee: P.dvTr7208, seeDirect: "1.85", precursorBm: "1.10", bm: { 2026: R(P.bm7208A).add("1.10"), 2028: R(P.bm7208A).add("1.10") } },
  ];
  const expected = {};
  for (const y of [2026, 2028]) {
    for (const p of products) {
      const see = p.useDefault ? R(p.defaultSee).mul(R(1).add(P.markupSteel[y])) : R(p.seeDirect); // steel: indirect not counted
      const gross = R(p.tonnes).mul(see);
      const faa = gross.min(R(p.tonnes).mul(P.cbamFactor[y]).mul(P.cscf).mul(p.bm[y]));
      const certs = gross.sub(faa).max(0);
      Object.assign(expected, {
        [`${p.id}.${y}.see`]: fx(see),
        [`${p.id}.${y}.benchmark`]: fx(p.bm[y]),
        [`${p.id}.${y}.gross`]: fx(gross),
        [`${p.id}.${y}.faa`]: fx(faa),
        [`${p.id}.${y}.certificates`]: fx(certs),
        [`${p.id}.${y}.cost`]: fx(certs.mul(price)),
      });
    }
  }
  write({
    id: "p2-cbam-exporter",
    profile: "cbam",
    title: "SKDM ihracatçısı: Türkiye ve Çin menşeli varsayılan değer, öncül paylı gerçek veri; 2026 ve 2028",
    source: { kind: "synthetic-official-parameters", cite: "Direktif 2003/87/AT Md. 10a(1a); Uyg. Tüzüğü 2026/1740 Ek I; 2025/2620 Ek nokta 5; Karar 2026/1862", url: "docs/kaynak-veri" },
    engine: "cbam",
    tolerance: { relative: 1e-9 },
    input: {
      years: [2026, 2028],
      scenario: { startPrice: 80, priceGrowth: 0, originCarbonPrice: 0, eurTry: 0 },
      products: products.map((p) => ({
        id: p.id, name: p.id, cn: p.cn, origin: p.origin, sector: "iron_steel", tonnes: Number(p.tonnes), growth: 0,
        seeDirect: Number(p.seeDirect), seeIndirect: 0, defaultSee: Number(p.defaultSee), useDefault: p.useDefault, benchmark: 0,
        ...(p.precursorBm ? { precursorBm: Number(p.precursorBm) } : {}),
      })),
    },
    expected,
  });
}

// ---------------------------------------------------------------- Profile 3: retroactive revision, 2023
{
  const before = P.etkb[2022];
  const after = P.etkb[2023];
  const gas = R(2400000).mul(P.ipccGasNcv).mul(P.ipccGasEf).div(1000);
  const loc = (e) => sum([R(18000).mul(e.tr), R(42000).mul(e.di), R(5000).mul(e.gas)]);
  const mkt = (e) => sum([R(18000).mul(e.tr), R(42000 - 6000).mul(e.di), R(5000).mul(e.gas)]);
  const b12 = gas.add(loc(before));
  const a12 = gas.add(loc(after));
  write({
    id: "p3-revision-2023",
    profile: "revision",
    title: "Geriye dönük revizyon: 2023 envanteri ETKB 2022 ile hesaplanmış, ETKB 2023 yayımlanınca yeniden hesap",
    source: { kind: "synthetic-official-factors", cite: "ETKB 2022 ve 2023 bilgi formları; IPCC 2006 varsayılan doğal gaz", url: "docs/kaynak-veri/etkb" },
    engine: "recalc",
    tolerance: { relative: 1e-9 },
    input: {
      year: 2023,
      editionYears: [2019, 2023, 2024, 2026],
      inventory: {
        year: 2023,
        grid: { edition: "etkb_2022", transmission: Number(before.tr), distribution: Number(before.di) },
        fuels: [{ id: "f1", fuel: "natural_gas", label: "Doğal gaz", amount: 2400000, ncv: 0.0345, ef: 56.1, mobile: false, quality: "measured" }],
        process: [],
        refrigerants: [],
        electricity: [
          { id: "e1", label: "İletim", mwh: 18000, connection: "transmission", certifiedMwh: 0, supplierFactor: null, quality: "measured" },
          { id: "e2", label: "Dağıtım", mwh: 42000, connection: "distribution", certifiedMwh: 6000, supplierFactor: null, quality: "measured" },
          { id: "e3", label: "Doğal gaz santrali ikili anlaşma", mwh: 5000, connection: "distribution", certifiedMwh: 0, supplierFactor: null, gridFactor: Number(before.gas), factorRef: "etkb_2022/etkb_2022:plant-natural-gas", quality: "measured" },
        ],
        scope3: [],
        revenueMillionTry: 0,
        productionTonnes: 0,
      },
    },
    expected: {
      "before.scope2Location": fx(loc(before)),
      "after.scope2Location": fx(loc(after)),
      "before.scope2Market": fx(mkt(before)),
      "after.scope2Market": fx(mkt(after)),
      "after.scope1": fx(gas),
      scope12Change: fx(a12.sub(b12).div(b12), 15),
      significant: false,
      changes: 3,
      gridTo: "etkb_2023",
      "edition.2019": "etkb_2020",
      "edition.2023": "etkb_2023",
      "edition.2024": "etkb_2023",
      "edition.2026": "etkb_2023",
    },
  });
}

// ---------------------------------------------------------------- Profile 3b: the 5 % threshold, exactly
{
  const fam = (y, v) => ({
    id: `testgrid_${y}`, name: `Test grid ${y}`, publisher: "test", licence: "user_licensed", licenceNote: "", url: "", asOf: `${y}-01-01`,
    origin: "custom", rightsConfirmed: true, family: "testgrid", year: y,
    factors: [{ id: `testgrid_${y}:x`, kind: "grid", key: "X", label: "X", value: v }],
  });
  for (const [id, after, sig] of [["p3-threshold-exact-5pct", 0.42, true], ["p3-threshold-below-5pct", 0.41999, false]]) {
    const change = R(String(after)).sub("0.4").div("0.4");
    write({
      id,
      profile: "revision",
      title: `Anlamlılık eşiği: Kapsam 1+2 değişimi %${change.mul(100).toFixed(4)}`,
      source: { kind: "synthetic", cite: "GHG Protokolü Kurumsal Standart bölüm 5 (anlamlılık eşiği uygulamada %5)", url: "" },
      engine: "recalc",
      tolerance: { relative: 1e-12 },
      input: {
        year: 2023,
        customSets: [fam(2022, 0.4), fam(2023, after)],
        inventory: {
          year: 2022,
          grid: { edition: "etkb_2023", transmission: 0.436, distribution: 0.469 },
          fuels: [], process: [], refrigerants: [], scope3: [], revenueMillionTry: 0, productionTonnes: 0,
          electricity: [{ id: "e1", label: "Hat", mwh: 1000, connection: "distribution", certifiedMwh: 0, supplierFactor: null, gridFactor: 0.4, factorRef: "testgrid_2022/testgrid_2022:x", quality: "measured" }],
        },
      },
      expected: { scope12Change: fx(change, 15), significant: sig, "after.scope2Location": fx(R(1000).mul(String(after))) },
    });
  }
}

// ---------------------------------------------------------------- Stress: 10,000-row trial balance
{
  const g = generateMizan(20261018, 17000);
  write({
    id: "s1-stress-mizan-10k",
    profile: "stress",
    title: `Sentetik mizan, ${g.detailRows} satır (alt hesaplar, gizli ana hesaplar, Türkçe sayı biçimi)`,
    source: { kind: "synthetic", cite: "scripts/validation/mizan-gen.mjs, tohum 20261018", url: "" },
    engine: "mizan",
    tolerance: { relative: 1e-12 },
    limits: { ms: 3000 },
    input: { seed: 20261018, rows: 17000 },
    expected: { ...g.expected, movementsBalanced: true },
  });
}

// ---------------------------------------------------------------- Reconciliation thresholds, exactly at the edge
write({
  id: "s2-reconcile-edges",
  profile: "stress",
  title: "Uzlaştırma eşik sınırları: U1 ±%0,5, U8 ±%20, U9 %20",
  source: { kind: "synthetic", cite: "Uzlaştırma kuralları v1 varsayılan toleransları", url: "" },
  engine: "reconcile",
  input: {
    cases: [
      { name: "u1-at-edge", set: { "ghg.revenueMillionTry": 42210 }, check: "U1.ghgRevenue" },
      { name: "u1-over-edge", set: { "ghg.revenueMillionTry": 42210.01 }, check: "U1.ghgRevenue" },
      { name: "u8-at-edge", set: { "indicators.env.waterWithdrawalM3": 9600000, "reconciliation.prior.water": 8000000, "reconciliation.notes": {} }, check: "U8.water" },
      { name: "u8-over-edge", set: { "indicators.env.waterWithdrawalM3": 9600000, "reconciliation.prior.water": 7999999, "reconciliation.notes": {} }, check: "U8.water" },
      { name: "u9-above", set: { "reconciliation.tolerances.estimated": 0.76 }, check: "U9.estimated3" },
      { name: "u9-below", set: { "reconciliation.tolerances.estimated": 0.75 }, check: "U9.estimated3" },
    ],
  },
  expected: { "u1-at-edge": "pass", "u1-over-edge": "fail", "u8-at-edge": "pass", "u8-over-edge": "warn", "u9-above": "pass", "u9-below": "warn" },
  notes: "U1: mizan 42 000 × 1,005 = 42 210 tam sınırda (geçer), 42 210,01 sınırın üstünde (hata). U8: 9 600 000 / 8 000 000 = tam +%20 (geçer), 9 600 000 / 7 999 999 sınırın üstünde (uyarı). U9: örnek Kapsam 3 tahmini payı ≈ %75,3; eşik %76 geçer, %75 uyarı.",
});

console.log("cases written to", outDir, fs.readdirSync(outDir).length);
