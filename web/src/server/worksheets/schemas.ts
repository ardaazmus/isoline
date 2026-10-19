/**
 * What each cycle worksheet holds (migration 0012). Pure zod: the server validates every save with it, and the
 * screens use the same types. Scores and limits follow the engines the toolkit already uses (lib/calc/*).
 */
import { z } from "zod";
import { AR_ITEMS } from "@/data/annual-report";
import { PILOT_SECTORS } from "@/lib/calc/ets";

export const WORKSHEET_KINDS = ["materiality", "taxonomy", "annual_report", "pathway", "ets", "cbam_cost"] as const;
export type WorksheetKind = (typeof WORKSHEET_KINDS)[number];

const id = z.string().trim().min(1).max(40);
const label = z.string().trim().min(1).max(160);
const score = z.number().int().min(1).max(5);
const money = z.number().finite().min(0).max(1e15);
const share = z.number().finite().min(-0.5).max(0.5);

export const MaterialitySheet = z
  .object({
    /** A topic is material when its impact or financial score reaches this (1–5, ESRS-style scale). */
    threshold: z.number().finite().min(1).max(5),
    topics: z
      .array(
        z.object({
          id,
          name: label,
          pillar: z.enum(["E", "S", "G"]),
          positive: z.boolean(),
          scale: score,
          scope: score,
          irremediability: score,
          impactLikelihood: score,
          magnitude: score,
          financialLikelihood: score,
          rationale: z.string().trim().max(1000).optional(),
        }),
      )
      .min(1)
      .max(60),
  })
  .refine((v) => new Set(v.topics.map((t) => t.id)).size === v.topics.length, { message: "duplicate_topic" });

export const TaxonomySheet = z
  .object({
    /** KPI denominators in TRY: turnover, CapEx and OpEx of the reporting period. */
    totals: z.object({ turnover: money, capex: money, opex: money }),
    activities: z
      .array(z.object({ id, name: label, code: z.string().trim().max(20), turnover: money, capex: money, opex: money, eligible: z.boolean(), aligned: z.boolean() }))
      .max(100)
      .refine((acts) => acts.every((a) => a.eligible || !a.aligned), { message: "aligned_not_eligible" }),
    /** Eligible activities reported as "not assessed" under the 10 % threshold (EU Del. Reg. 2026/73). */
    notAssessed: z.array(id).max(100),
  })
  .refine((v) => v.notAssessed.every((x) => v.activities.some((a) => a.id === x && a.eligible)), { message: "not_assessed_unknown" });

const AR_IDS = new Set(AR_ITEMS.map((i) => i.id));
export const AnnualReportSheet = z.object({
  profile: z.enum(["ttk", "listed", "bank"]),
  items: z.record(
    z.string().refine((k) => AR_IDS.has(k), { message: "unknown_item" }),
    z.object({ status: z.enum(["met", "na", "missing"]), note: z.string().trim().max(1000).optional(), section: z.string().trim().max(120).optional() }),
  ),
});

export const PathwaySheet = z
  .object({
    baseYear: z.number().int().min(2015).max(2050),
    /** Base-year emissions; empty = taken from the approved figures of the base-year cycle when there is one. */
    baseScope12: z.number().finite().min(0).nullable(),
    baseScope3: z.number().finite().min(0).nullable(),
    scope2Share: z.number().finite().min(0).max(1).nullable(),
    targetYear: z.number().int().min(2025).max(2050),
    bauGrowth: share,
    measures: z.array(z.object({ id, name: label, abatement: z.number().finite().min(0).max(1e9), cost: z.number().finite().min(-1e5).max(1e5), startYear: z.number().int().min(2015).max(2050), rampYears: z.number().int().min(0).max(30) })).max(60),
  })
  .refine((v) => v.targetYear > v.baseYear, { message: "target_before_base" });

export const EtsSheet = z.object({
  sector: z.enum([...PILOT_SECTORS, "other"]),
  /** Verified emissions to start from; empty = the approved ETS (else scope 1) figures of this cycle. */
  emissions: z.number().finite().min(0).nullable(),
  emissionsGrowth: share,
  activity: z.number().finite().min(0).max(1e12),
  activityGrowth: share,
  benchmark: z.number().finite().min(0).max(1e4),
  freeRate: z.number().finite().min(0).max(1),
  coefficient: z.number().finite().min(0).max(1),
  price: z.number().finite().min(0).max(1e6),
  priceGrowth: share,
});

export const CbamCostSheet = z.object({
  startPrice: z.number().finite().min(0).max(1e4),
  priceGrowth: share,
  originCarbonPrice: z.number().finite().min(0).max(1e4),
  eurTry: z.number().finite().min(0).max(1e4),
  /** Annual change in exported tonnes for every product. */
  growth: share,
});

export const SHEETS = { materiality: MaterialitySheet, taxonomy: TaxonomySheet, annual_report: AnnualReportSheet, pathway: PathwaySheet, ets: EtsSheet, cbam_cost: CbamCostSheet } as const;

export type MaterialityPayload = z.infer<typeof MaterialitySheet>;
export type TaxonomyPayload = z.infer<typeof TaxonomySheet>;
export type AnnualReportPayload = z.infer<typeof AnnualReportSheet>;
export type PathwayPayload = z.infer<typeof PathwaySheet>;
export type EtsPayload = z.infer<typeof EtsSheet>;
export type CbamCostPayload = z.infer<typeof CbamCostSheet>;
export type Payload = MaterialityPayload | TaxonomyPayload | AnnualReportPayload | PathwayPayload | EtsPayload | CbamCostPayload;

/** Analysis sheets are scenarios: saved versions are used as they are; the others need a second person's approval. */
export const ANALYSIS_KINDS: WorksheetKind[] = ["pathway", "ets", "cbam_cost"];
