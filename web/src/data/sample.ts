/**
 * Sample workspace: an illustrative integrated steel producer. Every value here is SAMPLE DATA for
 * demonstration; benchmarks and CBAM default values are placeholders, not official figures.
 */
import type { CbamProduct, CbamScenario } from "@/lib/calc/cbam";
import type { EtsInput } from "@/lib/calc/ets";
import type { Inventory } from "@/lib/calc/ghg";
import type { PathwayInput } from "@/lib/calc/pathway";
import type { EnvInput, MaterialityTopic, SafetyInput, TaxonomyActivity, TaxonomyTotals, WorkforceInput } from "@/lib/calc/indicators";
import type { Profile } from "@/lib/calc/applicability";
import { FUELS } from "@/lib/calc/ghg";
import type { StageStatus } from "./journey";

export type ArStatus = "todo" | "draft" | "review" | "approved" | "na";

export type ClientData = {
  id: string;
  name: string;
  sector: string;
  sample: boolean;
  profile: Profile;
  ghg: Inventory;
  cbam: { products: CbamProduct[]; scenario: CbamScenario };
  ets: EtsInput;
  pathway: PathwayInput;
  materiality: { threshold: number; topics: MaterialityTopic[] };
  indicators: { safety: SafetyInput; workforce: WorkforceInput; env: EnvInput };
  taxonomy: { totals: TaxonomyTotals; activities: TaxonomyActivity[]; notAssessed: string[] };
  annualReport: { profile: "ttk" | "listed" | "bank"; status: Record<string, ArStatus>; owners: Record<string, string> };
  /** Manual stage statuses for the report journey, keyed "<track>.<stage>". */
  journey: Record<string, StageStatus>;
};

export const SAMPLE_CLIENT: ClientData = {
  id: "sample-steel",
  name: "Anadolu Yassı Çelik A.Ş.",
  sector: "iron_steel",
  sample: true,
  profile: {
    entityType: "listed",
    watchlistMarket: false,
    bistMainMarkets: true,
    branches: 4,
    sharesListed: true,
    history: [
      { totalAssetsTry: 61_000_000_000, revenueTry: 38_500_000_000, employees: 2_350 },
      { totalAssetsTry: 68_000_000_000, revenueTry: 42_000_000_000, employees: 2_410 },
    ],
    regulatedStatus: [true, true],
    reportingYear: 2026,
    firstTsrsYear: 2024,
    euEntity: false,
    euTurnoverEur: 140_000_000,
    euTurnoverPrevEur: 126_000_000,
    euSubsidiaryTurnoverEur: 0,
    worldwideTurnoverEur: 1_010_000_000,
    employeesGroup: 2_410,
    euCsrdCustomers: true,
    cbamSectors: ["iron_steel"],
    euExportTonnes: 48_200,
    annualEmissionsTco2e: 1_920_000,
    pilotSector: "iron_steel",
    eudrCommodities: false,
    smallOrMicro: false,
    dppProducts: true,
    batteries: false,
    energyToe: 520_000,
  },
  ghg: {
    fuels: [
      { id: "f1", fuel: "coal", label: "Koklaşabilir kömür — yüksek fırın", amount: 700_000, ncv: FUELS.coal.ncv, ef: FUELS.coal.ef, mobile: false, quality: "measured" },
      { id: "f2", fuel: "natural_gas", label: "Doğal gaz — haddehane fırınları", amount: 60_000_000, ncv: FUELS.natural_gas.ncv, ef: FUELS.natural_gas.ef, mobile: false, quality: "measured" },
      { id: "f3", fuel: "diesel", label: "Motorin — saha araçları", amount: 380_000, ncv: FUELS.diesel.ncv, ef: FUELS.diesel.ef, mobile: true, quality: "calculated" },
    ],
    process: [{ id: "p1", label: "Kireçtaşı ve dolomit kalsinasyonu", tco2e: 90_000, quality: "calculated" }],
    refrigerants: [{ id: "r1", gas: "R-410A", leakedKg: 120, quality: "estimated" }],
    electricity: [
      { id: "e1", label: "Ana tesis — dağıtım bağlantısı", mwh: 300_000, connection: "distribution", certifiedMwh: 60_000, supplierFactor: null, quality: "measured" },
    ],
    scope3: [
      { id: "s1", category: 1, label: "Satın alınan demir cevheri ve pelet", amount: 1_550_000, unit: "t", factor: 0.06, factorSource: "Tedarikçi beyanı (örnek)", quality: "estimated" },
      { id: "s2", category: 3, label: "Yakıt ve enerji kaynaklı (WTT)", amount: 1, unit: "toplam", factor: 95_000, factorSource: "Hesap tablosu (örnek)", quality: "estimated" },
      { id: "s3", category: 4, label: "Hammadde deniz taşımacılığı", amount: 9_000_000_000, unit: "t·km", factor: 0.000012, factorSource: "Taşıyıcı verisi (örnek)", quality: "calculated" },
      { id: "s4", category: 10, label: "Satılan ürünlerin işlenmesi", amount: 950_000, unit: "t", factor: 0.15, factorSource: "Sektör ortalaması (örnek)", quality: "estimated" },
      { id: "s5", category: 6, label: "İş seyahatleri", amount: 1_200_000, unit: "yolcu·km", factor: 0.00015, factorSource: "Seyahat acentesi raporu (örnek)", quality: "calculated" },
    ],
    revenueMillionTry: 42_000,
    productionTonnes: 1_000_000,
  },
  cbam: {
    products: [
      { id: "c1", name: "Sıcak haddelenmiş rulo", cn: "7208", sector: "iron_steel", tonnes: 48_200, growth: 0.02, seeDirect: 1.92, seeIndirect: 0.21, defaultSee: 2.428, defaultRef: "eu_cbam_dv_tr/eu_cbam_dv_tr:7208", useDefault: false, benchmark: 1.37 },
      { id: "c2", name: "Soğuk haddelenmiş sac", cn: "7209", sector: "iron_steel", tonnes: 12_400, growth: 0.03, seeDirect: 2.04, seeIndirect: 0.26, defaultSee: 2.51, defaultRef: "eu_cbam_dv_tr/eu_cbam_dv_tr:7209", useDefault: true, benchmark: 1.37 },
    ],
    scenario: { startPrice: 77.65, priceGrowth: 0.04, originCarbonPrice: 0, eurTry: 49.5 },
  },
  ets: {
    sector: "iron_steel",
    emissions: 1_920_000,
    emissionsGrowth: -0.01,
    activity: 1_000_000,
    activityGrowth: 0.01,
    benchmark: 1.6,
    rateByYear: { 2026: 1, 2027: 1, 2028: 0.95, 2029: 0.9, 2030: 0.85 },
    coefficient: 1,
    price: 2_000,
    priceGrowth: 0.1,
  },
  pathway: {
    baseYear: 2024,
    baseScope12: 2_050_000,
    baseScope3: 1_400_000,
    targetYear: 2034,
    bauGrowth: 0.01,
    measures: [
      { id: "m1", name: "Yenilenebilir elektrik anlaşması (PPA)", abatement: 120_000, cost: -5, startYear: 2026, rampYears: 2 },
      { id: "m2", name: "Atık ısı geri kazanımı", abatement: 60_000, cost: -12, startYear: 2027, rampYears: 1 },
      { id: "m3", name: "Hurda oranının artırılması", abatement: 150_000, cost: 10, startYear: 2027, rampYears: 3 },
      { id: "m4", name: "Elektrik ark ocağı dönüşümü", abatement: 700_000, cost: 35, startYear: 2029, rampYears: 3 },
      { id: "m5", name: "Hidrojene hazır brülörler", abatement: 40_000, cost: 80, startYear: 2030, rampYears: 2 },
      { id: "m6", name: "Tedarikçi katılım programı (Kapsam 3)", abatement: 260_000, cost: 15, startYear: 2027, rampYears: 4 },
    ],
    actuals: [
      { year: 2024, value: 3_450_000, estimated: false },
      { year: 2025, value: 3_392_000, estimated: false },
      { year: 2026, value: 3_330_000, estimated: true },
    ],
  },
  materiality: {
    threshold: 3,
    topics: [
      { id: "E1", scale: 5, scope: 5, irremediability: 4, impactLikelihood: 5, magnitude: 5, financialLikelihood: 5, positive: false },
      { id: "E2", scale: 4, scope: 3, irremediability: 3, impactLikelihood: 5, magnitude: 3, financialLikelihood: 3, positive: false },
      { id: "E3", scale: 3, scope: 3, irremediability: 2, impactLikelihood: 4, magnitude: 2, financialLikelihood: 3, positive: false },
      { id: "E4", scale: 2, scope: 2, irremediability: 3, impactLikelihood: 3, magnitude: 1, financialLikelihood: 2, positive: false },
      { id: "E5", scale: 4, scope: 3, irremediability: 2, impactLikelihood: 5, magnitude: 4, financialLikelihood: 4, positive: false },
      { id: "S1", scale: 4, scope: 3, irremediability: 4, impactLikelihood: 4, magnitude: 3, financialLikelihood: 4, positive: false },
      { id: "S2", scale: 3, scope: 4, irremediability: 3, impactLikelihood: 3, magnitude: 2, financialLikelihood: 2, positive: false },
      { id: "S3", scale: 3, scope: 2, irremediability: 2, impactLikelihood: 4, magnitude: 2, financialLikelihood: 2, positive: false },
      { id: "S4", scale: 2, scope: 2, irremediability: 1, impactLikelihood: 2, magnitude: 1, financialLikelihood: 2, positive: false },
      { id: "G1", scale: 3, scope: 2, irremediability: 2, impactLikelihood: 3, magnitude: 4, financialLikelihood: 3, positive: false },
    ],
  },
  indicators: {
    safety: { hoursWorked: 4_800_000, lostTimeInjuries: 9, recordables: 22, lostDays: 310, fatalities: 0 },
    workforce: { headcountStart: 2_350, headcountEnd: 2_410, leavers: 190, trainingHours: 62_000, avgPayMen: 78_000, avgPayWomen: 71_500, women: 290, womenManagers: 18, managers: 160 },
    env: { energyGj: 21_770_000, renewableGj: 216_000, waterWithdrawalM3: 9_800_000, waterDischargeM3: 7_100_000, waterStressShare: 0.35, wasteTotalT: 410_000, wasteRecoveredT: 352_000, wasteHazardousT: 18_000, revenueMillionTry: 42_000 },
  },
  taxonomy: {
    totals: { turnover: 42_000, capex: 3_800, opex: 1_200 },
    activities: [
      { id: "t1", code: "3.9", name: "Demir ve çelik üretimi", turnover: 39_000, capex: 1_900, opex: 640, eligible: true, aligned: false },
      { id: "t2", code: "3.9", name: "Elektrik ark ocağı yatırımı", turnover: 0, capex: 600, opex: 0, eligible: true, aligned: true },
      { id: "t3", code: "4.1", name: "Çatı GES", turnover: 0, capex: 220, opex: 6, eligible: true, aligned: true },
      { id: "t4", code: "7.3", name: "Enerji verimliliği ekipmanı", turnover: 0, capex: 90, opex: 4, eligible: true, aligned: true },
      { id: "t5", code: "6.6", name: "Karayolu yük taşımacılığı (iç)", turnover: 0, capex: 30, opex: 60, eligible: true, aligned: false },
    ],
    notAssessed: ["t5"],
  },
  annualReport: {
    profile: "listed",
    status: { principles: "approved", period_identity: "approved", organisation_capital: "approved", board_staff: "review", financial_rights: "review", rnd: "draft", investments: "draft", internal_control: "draft", risk_policy: "draft", resk: "draft", spk_urf_kybf: "review" },
    owners: { financial_rights: "İK", internal_control: "İç denetim", resk: "Risk", spk_urf_kybf: "Yatırımcı ilişkileri" },
  },
  journey: { "sustainability.write": "doing", "annual.plan": "done", "annual.financials": "doing", "cbam.verify": "doing" },
};

/** A fresh, empty client built from the same shape; numbers start at zero. */
export function emptyClient(id: string, name: string): ClientData {
  const s = structuredClone(SAMPLE_CLIENT);
  return {
    ...s,
    id,
    name,
    sample: false,
    sector: "other",
    profile: {
      ...s.profile,
      entityType: "unlisted_company",
      bistMainMarkets: false,
      history: [
        { totalAssetsTry: 0, revenueTry: 0, employees: 0 },
        { totalAssetsTry: 0, revenueTry: 0, employees: 0 },
      ],
      regulatedStatus: [false, false],
      firstTsrsYear: null,
      euTurnoverEur: 0,
      euTurnoverPrevEur: 0,
      sharesListed: false,
      worldwideTurnoverEur: 0,
      employeesGroup: 0,
      euCsrdCustomers: false,
      cbamSectors: [],
      euExportTonnes: 0,
      annualEmissionsTco2e: 0,
      pilotSector: "other",
      dppProducts: false,
      energyToe: 0,
    },
    ghg: { fuels: [], process: [], refrigerants: [], electricity: [], scope3: [], revenueMillionTry: 0, productionTonnes: 0 },
    cbam: { products: [], scenario: s.cbam.scenario },
    ets: { ...s.ets, sector: "other", emissions: 0, activity: 0, benchmark: 0 },
    pathway: { ...s.pathway, baseYear: 2025, baseScope12: 0, baseScope3: 0, targetYear: 2035, measures: [], actuals: [] },
    materiality: { threshold: 3, topics: s.materiality.topics.map((t) => ({ ...t, scale: 1, scope: 1, irremediability: 1, impactLikelihood: 1, magnitude: 1, financialLikelihood: 1 })) },
    indicators: {
      safety: { hoursWorked: 0, lostTimeInjuries: 0, recordables: 0, lostDays: 0, fatalities: 0 },
      workforce: { headcountStart: 0, headcountEnd: 0, leavers: 0, trainingHours: 0, avgPayMen: 0, avgPayWomen: 0, women: 0, womenManagers: 0, managers: 0 },
      env: { energyGj: 0, renewableGj: 0, waterWithdrawalM3: 0, waterDischargeM3: 0, waterStressShare: 0, wasteTotalT: 0, wasteRecoveredT: 0, wasteHazardousT: 0, revenueMillionTry: 0 },
    },
    taxonomy: { totals: { turnover: 0, capex: 0, opex: 0 }, activities: [], notAssessed: [] },
    annualReport: { profile: "ttk", status: {}, owners: {} },
    journey: {},
  };
}
