/**
 * Validation package: every case in web/validation/cases runs through the app's real engines and is compared
 * with expected results that were computed elsewhere (exact arithmetic from the published formulas, an official
 * worked example or a disclosed report). With VALIDATION_REPORT=1 the run also writes validation/RESULTS.md.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SAMPLE_CLIENT, type ClientData } from "@/data/sample";
import { computeInventory, type Inventory } from "@/lib/calc/ghg";
import { projectProduct, type CbamProduct, type CbamScenario } from "@/lib/calc/cbam";
import { resolveBenchmark } from "@/lib/calc/cbam-benchmarks";
import { BUILTIN_SETS, resolveRef, usableSets, type FactorSet } from "@/lib/factors";
import { gridEdition, isSignificant, pickEdition, planRecalc } from "@/lib/recalc";
import { reconcile } from "@/lib/reconcile";
import { importTrialBalance } from "@/lib/spreadsheet";
import { netSales, tbTotals } from "@/lib/trial-balance";
import { generateMizan } from "../../scripts/validation/mizan-gen.mjs";

type Expected = Record<string, string | number | boolean>;
type Case = {
  id: string;
  profile: string;
  title: string;
  source: { kind: string; cite: string; url?: string; page?: string };
  engine: "ghg" | "cbam" | "recalc" | "mizan" | "reconcile";
  tolerance?: { relative?: number };
  limits?: { ms?: number };
  input: Record<string, unknown>;
  expected: Expected;
  notes?: string;
};
type Outputs = Record<string, string | number | boolean>;

const dir = path.resolve(process.cwd(), "validation/cases");
const cases: Case[] = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));

function setPath(obj: Record<string, unknown>, p: string, value: unknown) {
  const keys = p.split(".");
  let cur = obj;
  for (const k of keys.slice(0, -1)) cur = (cur[k] ??= {}) as Record<string, unknown>;
  cur[keys.at(-1)!] = value;
}

async function run(c: Case): Promise<{ out: Outputs; ms: number }> {
  const t0 = performance.now();
  const out: Outputs = {};
  const input = c.input as Record<string, never>;
  switch (c.engine) {
    case "ghg": {
      const r = computeInventory(input.inventory as Inventory);
      Object.assign(out, { scope1: r.scope1, scope2Location: r.scope2Location, scope2Market: r.scope2Market, scope3: r.scope3, energyGj: r.energyGj });
      Object.assign(out, { "gas.co2": r.combustionGases.co2, "gas.ch4": r.combustionGases.ch4, "gas.n2o": r.combustionGases.n2o });
      for (const fc of (input.factorChecks ?? []) as { ref: string; value: string; ncv?: string }[]) {
        const o = resolveRef(BUILTIN_SETS, fc.ref);
        out[`factor ${fc.ref}`] = o?.factor.value ?? NaN;
        if (fc.ncv !== undefined) out[`ncv ${fc.ref}`] = o?.factor.ncv ?? NaN;
      }
      break;
    }
    case "cbam": {
      const s = input.scenario as CbamScenario;
      for (const y of input.years as number[]) {
        for (const p of input.products as CbamProduct[]) {
          const r = projectProduct(p, s, undefined, y, y)[0];
          Object.assign(out, {
            [`${p.id}.${y}.see`]: r.see,
            [`${p.id}.${y}.benchmark`]: resolveBenchmark(p, y, p.useDefault ? "default" : "actual").value,
            [`${p.id}.${y}.gross`]: r.gross,
            [`${p.id}.${y}.faa`]: r.faa,
            [`${p.id}.${y}.certificates`]: r.certificates,
            [`${p.id}.${y}.cost`]: r.cost,
          });
        }
      }
      break;
    }
    case "recalc": {
      const sets = usableSets((input.customSets ?? []) as FactorSet[]);
      const plan = planRecalc(input.inventory as Inventory, sets, input.year as number);
      for (const k of ["scope1", "scope2Location", "scope2Market", "scope3"] as const) {
        out[`before.${k}`] = plan.before[k];
        out[`after.${k}`] = plan.after[k];
      }
      Object.assign(out, { scope12Change: plan.scope12Change, significant: isSignificant(plan), changes: plan.changes.length, gridTo: plan.grid?.to ?? gridEdition(plan.next) });
      for (const y of (input.editionYears ?? []) as number[]) out[`edition.${y}`] = pickEdition(BUILTIN_SETS, "etkb", y)!.set.id;
      break;
    }
    case "mizan": {
      const g = generateMizan(input.seed as number, input.rows as number);
      const { tb } = await importTrialBalance(new TextEncoder().encode(g.csv).buffer as ArrayBuffer, "stress.csv");
      const ns = netSales(tb!)!;
      const tot = tbTotals(tb!);
      Object.assign(out, { grossSales: ns.gross, deductions: ns.deductions, netSales: ns.net, totalDebit: tot.debit, totalCredit: tot.credit, mainAccounts: tb!.accounts.length, movementsBalanced: tot.movementsBalanced });
      break;
    }
    case "reconcile": {
      for (const k of input.cases as { name: string; set: Record<string, unknown>; check: string }[]) {
        const client = structuredClone(SAMPLE_CLIENT) as unknown as Record<string, unknown>;
        for (const [p, v] of Object.entries(k.set)) setPath(client, p, v);
        const check = reconcile(client as unknown as ClientData).rules.flatMap((r) => r.checks).find((x) => x.id === k.check);
        out[k.name] = check?.status ?? "missing";
      }
      break;
    }
  }
  return { out, ms: performance.now() - t0 };
}

const numeric = (v: unknown) => typeof v === "number" || (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v));
const deviation = (got: number, want: number) => (want === 0 ? Math.abs(got) : Math.abs(got - want) / Math.abs(want));

type Result = { c: Case; checks: number; failed: string[]; maxDev: number; ms: number };
const results: Result[] = [];

describe("validation package", () => {
  for (const c of cases) {
    it(`${c.id}: ${c.title}`, async () => {
      const { out, ms } = await run(c);
      const tol = c.tolerance?.relative ?? 0.005;
      const failed: string[] = [];
      let maxDev = 0;
      for (const [k, want] of Object.entries(c.expected)) {
        const got = out[k];
        if (numeric(want) && typeof got === "number") {
          const d = deviation(got, Number(want));
          maxDev = Math.max(maxDev, d);
          if (!(d <= tol)) failed.push(`${k}: ${got} ≠ ${want} (sapma ${d})`);
        } else if (got !== want) failed.push(`${k}: ${String(got)} ≠ ${String(want)}`);
      }
      if (c.limits?.ms && ms > c.limits.ms) failed.push(`süre ${Math.round(ms)} ms > ${c.limits.ms} ms`);
      results.push({ c, checks: Object.keys(c.expected).length, failed, maxDev, ms });
      expect(failed).toEqual([]);
    });
  }

  it("writes validation/RESULTS.md when asked", () => {
    if (!process.env.VALIDATION_REPORT) return;
    const pct = (d: number) => (d === 0 ? "0" : d < 1e-9 ? "< 1e-9" : `${(d * 100).toPrecision(2)} %`);
    const lines = [
      "# Doğrulama sonuçları",
      "",
      `Çalıştırma: ${new Date().toISOString().slice(0, 10)} · ${results.length} vaka · ${results.reduce((n, r) => n + r.checks, 0)} kontrol · ${results.filter((r) => !r.failed.length).length} vaka geçti`,
      "",
      "| Vaka | Profil | Kaynak türü | Kontrol | Sonuç | En büyük göreli sapma | Süre |",
      "|---|---|---|---|---|---|---|",
      ...results.map((r) => `| ${r.c.id} | ${r.c.profile} | ${r.c.source.kind} | ${r.checks} | ${r.failed.length ? `**${r.failed.length} hata**` : "geçti"} | ${pct(r.maxDev)} | ${Math.round(r.ms)} ms |`),
      "",
      "Hedef: kapanış kontrolünde sapma < %0,5. Sentetik vakaların toleransı 1e-9 (tam aritmetikle hesaplanmış beklenen değerler).",
      "",
    ];
    fs.writeFileSync(path.resolve(process.cwd(), "validation/RESULTS.md"), lines.join("\n"));
  });
});
