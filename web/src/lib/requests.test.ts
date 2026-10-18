import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { emptyClient, SAMPLE_CLIENT, SAMPLE_TB_SHA256 } from "@/data/sample";
import { CROSSWALK } from "@/data/crosswalk";
import { TEMPLATES } from "@/data/templates";
import { evaluate, type Status } from "./calc/applicability";
import { SECTION_IDS, type Approvals } from "./approval";
import { toCsv } from "./export";
import type { ImportRecord } from "./imports";
import { parseCsv } from "./inventory-csv";
import { xlsxWorkbook } from "./spreadsheet";
import {
  applyRequestRows,
  asRequests,
  assignByRole,
  DATA_POINTS,
  emptyRequests,
  FILE_TEXT,
  generateRequests,
  importRequestsFile,
  isOverdue,
  markRequested,
  parseDue,
  parseRequestRows,
  REQUEST_STATUSES,
  requestsLockedBy,
  requestTable,
  ROLES,
  sectionNeeds,
  sectionProgress,
  setTrack,
  suggestTemplates,
  trackOf,
  type FileLang,
  type RequestItem,
  type Requests,
  type RequestStatus,
} from "./requests";

const ALL = TEMPLATES.map((t) => t.id);
const CW = new Map(CROSSWALK.map((r) => [r.id, r]));
const AT = "2026-10-18T10:00:00.000Z";
const approved = (section: string): Approvals => ({ [section]: { status: "approved", preparedBy: "A", approvedBy: "B", approvedAt: AT, log: [] } });
const get = (obj: unknown, path: string) => path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | null | undefined)?.[k], obj);
const ids = (items: RequestItem[]) => items.map((i) => i.id);
const text = (i: RequestItem) => ({ section: i.section, item: `item ${i.id}`, role: i.role, document: `doc ${i.id}`, unit: i.unit });
const four = (r: Requests, id: string) => {
  const t = trackOf(r, id);
  return { owner: t.owner, due: t.due, status: t.status, note: t.note };
};

describe("data point catalogue", () => {
  it("has unique ids, known sections, roles and crosswalk rows of the same tool", () => {
    expect(new Set(ids(DATA_POINTS as RequestItem[])).size).toBe(DATA_POINTS.length);
    for (const d of DATA_POINTS) {
      expect(SECTION_IDS, d.id).toContain(d.section);
      for (const f of d.feeds ?? []) expect(SECTION_IDS, d.id).toContain(f);
      expect(ROLES, d.id).toContain(d.role);
      if (d.cw) {
        const row = CW.get(d.cw);
        expect(row, d.id).toBeDefined();
        if (row?.tool) expect([d.section, ...(d.feeds ?? [])], d.id).toContain(row.tool);
      }
    }
  });
  it("names an input that exists in the client data", () => {
    for (const d of DATA_POINTS) expect(get(SAMPLE_CLIENT, d.input), d.id).not.toBeUndefined();
  });
  it("is listed in section order", () => {
    const order = DATA_POINTS.map((d) => SECTION_IDS.indexOf(d.section));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
  it("template narrowing names real crosswalk rows that the framework covers", () => {
    for (const tp of TEMPLATES)
      for (const s of tp.sections)
        for (const p of s.points ?? []) {
          expect(CW.get(p), `${tp.id}.${s.id}.${p}`).toBeDefined();
          if (tp.crosswalk) expect(CW.get(p)![tp.crosswalk], `${tp.id}.${s.id}.${p}`).not.toBe("—");
        }
  });
  it("file status words match the screen's messages", () => {
    for (const lang of ["tr", "en"] as FileLang[]) {
      const m = JSON.parse(readFileSync(join(__dirname, "..", "..", "messages", `${lang}.json`), "utf8"));
      expect(m.req.status).toEqual(FILE_TEXT[lang].statuses);
    }
  });
});

describe("generateRequests", () => {
  const clients = fc.constantFrom(SAMPLE_CLIENT, emptyClient("x", "Yeni"));
  const subset = fc.subarray(ALL);

  it("property: deterministic and independent of the order the templates are given in", () => {
    fc.assert(
      fc.property(clients, subset, fc.integer(), (c, chosen, seed) => {
        const shuffled = [...chosen].sort((a, b) => ((a.length * 31 + seed) % 7) - ((b.length * 31 + seed) % 7) || b.localeCompare(a));
        expect(generateRequests(c, chosen)).toEqual(generateRequests(c, shuffled));
        expect(generateRequests(c, chosen)).toEqual(generateRequests(c, [...chosen]));
      }),
    );
  });

  it("property: every item maps to an existing section and traces to a template section that needs it", () => {
    fc.assert(
      fc.property(clients, subset, (c, chosen) => {
        for (const i of generateRequests(c, chosen)) {
          expect(SECTION_IDS).toContain(i.section);
          expect(i.traces.length).toBeGreaterThan(0);
          for (const tr of i.traces) {
            expect(chosen).toContain(tr.template);
            const tp = TEMPLATES.find((x) => x.id === tr.template)!;
            const sec = tp.sections.find((x) => x.id === tr.section)!;
            expect(sec).toBeDefined();
            expect(tr.refs).toEqual(sec.refs);
            expect(sectionNeeds(tp, sec, i)).toBe(true);
          }
        }
      }),
    );
  });

  it("property: more templates never ask for less", () => {
    fc.assert(
      fc.property(clients, subset, subset, (c, a, b) => {
        const small = ids(generateRequests(c, a));
        const big = ids(generateRequests(c, [...new Set([...a, ...b])]));
        for (const id of small) expect(big).toContain(id);
      }),
    );
  });

  it("asks for nothing without a report, and for every data point when every template is chosen", () => {
    expect(generateRequests(SAMPLE_CLIENT, [])).toEqual([]);
    expect(ids(generateRequests(SAMPLE_CLIENT, ALL))).toEqual(DATA_POINTS.map((d) => d.id));
  });

  it("narrows to the data points a section names", () => {
    const s12 = ids(generateRequests(SAMPLE_CLIENT, ["tsrs_climate_first"]));
    expect(s12).toContain("ghg_electricity");
    expect(s12).not.toContain("ghg_travel");
    expect(s12).not.toContain("ghg_production");
    const ets = ids(generateRequests(SAMPLE_CLIENT, ["tr_ets_mp"]));
    expect(ets).toEqual(expect.arrayContaining(["ghg_stationary", "ets_emissions", "ets_activity"]));
    expect(ets).not.toContain("ghg_electricity");
    const cbam = ids(generateRequests(SAMPLE_CLIENT, ["cbam_operator_pack"]));
    expect(cbam).toEqual(expect.arrayContaining(["ghg_electricity", "cbam_goods", "cbam_see", "ets_emissions"]));
    expect(cbam).not.toContain("ghg_purchases");
  });

  it("drops data points the framework's crosswalk column has no counterpart for", () => {
    // VSME B3 has no Scope 3; TSRS has no taxonomy row
    expect(ids(generateRequests(SAMPLE_CLIENT, ["vss"]))).not.toContain("ghg_purchases");
    const tsrs = ids(generateRequests(SAMPLE_CLIENT, ["tsrs_full"]));
    expect(tsrs).not.toContain("tax_totals");
    expect(tsrs).toEqual(expect.arrayContaining(["ghg_travel", "rec_prior", "net_sales", "cbam_goods"]));
  });

  it("asks for the trial balance for the annual report's financial section", () => {
    const ar = generateRequests(SAMPLE_CLIENT, ["ar_ttk"]);
    const tb = ar.find((i) => i.id === "tb_export")!;
    expect(tb.traces).toEqual([{ template: "ar_ttk", section: "ar_financial", refs: ["Yön. md. 12"] }]);
  });

  it("dates each item from the client's years", () => {
    const by = Object.fromEntries(generateRequests(SAMPLE_CLIENT, ALL).map((i) => [i.id, i.period]));
    expect(by.ghg_stationary).toBe("2026");
    expect(by.rec_prior).toBe("2025");
    expect(by.pathway_base).toBe("2024");
    expect(by.pathway_actuals).toBe("2024–2026");
    expect(by.pathway_measures).toBe("2026–2034");
  });
});

describe("suggestTemplates", () => {
  it("follows the applicability result of the sample and of an empty client", () => {
    const s = suggestTemplates(evaluate(SAMPLE_CLIENT.profile), SAMPLE_CLIENT.profile);
    expect(s.map((x) => x.template)).toEqual(["tsrs_full", "vss", "cbam_operator_pack", "tr_ets_mp", "ar_listed"]);
    const e = emptyClient("x", "x");
    expect(suggestTemplates(evaluate(e.profile), e.profile)).toEqual([{ template: "ar_ttk", finding: "annual_report" }]);
  });
  it("property: suggests only known templates, once each, for findings that bite", () => {
    const statuses = fc.constantFrom<Status>("required", "voluntary", "not_applicable", "review", "indirect");
    const finding = fc.record({ id: fc.constantFrom("annual_report", "tsrs", "tr_ets", "cbam", "csrd", "csddd", "eudr"), status: statuses });
    fc.assert(
      fc.property(fc.array(finding), fc.constantFrom<"listed" | "unlisted_company" | "bank">("listed", "unlisted_company", "bank"), (fs, entityType) => {
        const out = suggestTemplates(
          fs.map((f) => ({ ...f, dates: [], notes: [], sources: [] })),
          { entityType },
        );
        expect(new Set(out.map((x) => x.template)).size).toBe(out.length);
        for (const x of out) {
          expect(ALL).toContain(x.template);
          expect(fs.some((f) => f.id === x.finding && (f.status === "required" || f.status === "indirect"))).toBe(true);
        }
      }),
    );
  });
});

describe("tracking", () => {
  const ghgLog: ImportRecord[] = [
    { tool: "ghg", fileName: "envanter.xlsx", sha256: "a".repeat(64), importedAt: "2026-10-01T08:00:00.000Z", rows: 10, applied: 9 },
    { tool: "ghg", fileName: "eski.csv", sha256: "b".repeat(64), importedAt: "2026-09-01T08:00:00.000Z", rows: 3, applied: 3 },
  ];
  const elec = DATA_POINTS.find((d) => d.id === "ghg_electricity")!;
  const base = DATA_POINTS.find((d) => d.id === "pathway_base")!;

  it("accepting links the latest import of the item's tool; leaving acceptance drops the link", () => {
    let r = setTrack(emptyRequests(), elec, { status: "accepted" }, ghgLog, AT);
    expect(r.items.ghg_electricity.evidence).toEqual({ fileName: "envanter.xlsx", sha256: "a".repeat(64), importedAt: "2026-10-01T08:00:00.000Z" });
    expect(r.items.ghg_electricity.acceptedAt).toBe(AT);
    // a later edit keeps the acceptance it was based on
    r = setTrack(r, elec, { note: "ok" }, [], "2026-12-01T00:00:00.000Z");
    expect(r.items.ghg_electricity.acceptedAt).toBe(AT);
    expect(r.items.ghg_electricity.evidence?.fileName).toBe("envanter.xlsx");
    r = setTrack(r, elec, { status: "received" }, ghgLog, AT);
    expect(r.items.ghg_electricity.evidence).toBeUndefined();
    expect(r.items.ghg_electricity.acceptedAt).toBeUndefined();
  });
  it("accepts without a link when the tool has no file import", () => {
    const r = setTrack(emptyRequests(), base, { status: "accepted" }, ghgLog, AT);
    expect(r.items.pathway_base).toEqual({ owner: "", due: "", status: "accepted", note: "", acceptedAt: AT });
  });
  it("cleans text, refuses impossible dates and forgets untouched items", () => {
    let r = setTrack(emptyRequests(), base, { owner: "  Ayşe \n Yılmaz ", due: "2026-02-30", note: "\t" }, [], AT);
    expect(r.items.pathway_base).toEqual({ owner: "Ayşe Yılmaz", due: "", status: "todo", note: "" });
    r = setTrack(r, base, { owner: "" }, [], AT);
    expect(r.items).toEqual({});
  });
  it("property: evidence only on accepted items, text always one clean line", () => {
    const patch = fc.record({ owner: fc.option(fc.string(), { nil: undefined }), note: fc.option(fc.string(), { nil: undefined }), status: fc.option(fc.constantFrom(...REQUEST_STATUSES), { nil: undefined }) });
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.constantFrom(...DATA_POINTS), patch), { maxLength: 30 }), (steps) => {
        let r = emptyRequests();
        for (const [d, p] of steps) r = setTrack(r, d, p, ghgLog, AT);
        for (const t of Object.values(r.items)) {
          if (t.status !== "accepted") expect(t.evidence ?? t.acceptedAt).toBeUndefined();
          for (const s of [t.owner, t.note]) expect(s).toBe(s.replace(/\s+/g, " ").trim());
        }
      }),
    );
  });

  it("a locked section freezes its items, and only its items", () => {
    const c = { approvals: approved("ghg"), requests: emptyRequests() };
    expect(requestsLockedBy(c, setTrack(c.requests, elec, { owner: "X" }, [], AT))).toBe("ghg");
    expect(requestsLockedBy(c, setTrack(c.requests, base, { owner: "X" }, [], AT))).toBeNull();
    expect(requestsLockedBy(c, { ...c.requests, templates: ["gri"] })).toBeNull();
  });

  it("assigns owners by role and a due date only where empty, skipping locked sections", () => {
    const items = generateRequests(SAMPLE_CLIENT, ["gri"]);
    let r = setTrack(emptyRequests(), items.find((i) => i.id === "work_training")!, { owner: "Mevcut" }, [], AT);
    const out = assignByRole(r, items, { hr: "İK", production: "Tesis" }, "2026-12-15", approved("environment"), [], AT);
    r = out.next;
    expect(trackOf(r, "work_training").owner).toBe("Mevcut");
    expect(trackOf(r, "work_training").due).toBe("2026-12-15");
    expect(trackOf(r, "work_headcount").owner).toBe("İK");
    expect(trackOf(r, "ghg_stationary").owner).toBe("Tesis");
    expect(trackOf(r, "env_energy")).toEqual({ owner: "", due: "", status: "todo", note: "" });
    expect(out.changed).toBe(items.filter((i) => i.section !== "environment").length);
  });

  it("marks only items not yet sent as requested", () => {
    const items = generateRequests(SAMPLE_CLIENT, ["vss"]);
    const r0 = setTrack(emptyRequests(), items[0], { status: "received" }, [], AT);
    const { next, changed } = markRequested(r0, items, undefined, [], AT);
    expect(changed).toBe(items.length - 1);
    expect(trackOf(next, items[0].id).status).toBe("received");
    expect(items.slice(1).every((i) => trackOf(next, i.id).status === "requested")).toBe(true);
  });

  it("counts progress per section, overdue only while not delivered", () => {
    const items = generateRequests(SAMPLE_CLIENT, ALL);
    const p = sectionProgress(items, SAMPLE_CLIENT.requests, SAMPLE_CLIENT.approvals, "2026-10-18");
    expect(p.reduce((s, x) => s + x.total, 0)).toBe(items.length);
    for (const x of p) expect(Object.values(x.counts).reduce((a, b) => a + b, 0)).toBe(x.total);
    const work = p.find((x) => x.section === "workforce")!;
    expect(work.overdue).toBe(2);
    expect(isOverdue({ owner: "", due: "2026-10-01", status: "received", note: "" }, "2026-10-18")).toBe(false);
    expect(isOverdue({ owner: "", due: "2026-10-18", status: "requested", note: "" }, "2026-10-18")).toBe(false);
    expect(isOverdue({ owner: "", due: "2026-10-17", status: "todo", note: "" }, null)).toBe(false);
  });
});

describe("file exchange", () => {
  const items = generateRequests(SAMPLE_CLIENT, ALL);
  const day = fc.date({ min: new Date("2000-01-01T00:00:00Z"), max: new Date("2099-12-31T00:00:00Z"), noInvalidDate: true }).map((d) => d.toISOString().slice(0, 10));
  const nasty = fc.oneof(fc.string(), fc.constantFrom("=1+1", "'=x", "-5", "@SUM(A1)", 'a "quoted"; b', "satır\nikinci", "1.000", "  boş  "));
  const track = fc.record({ owner: nasty, due: fc.oneof(fc.constant(""), day), status: fc.constantFrom(...REQUEST_STATUSES), note: nasty });
  const state = fc.array(fc.tuple(fc.constantFrom(...items), track), { maxLength: 25 }).map((steps) => steps.reduce((r, [i, p]) => setTrack(r, i, p, SAMPLE_CLIENT.importLog, AT), emptyRequests()));
  const back = (r: Requests, parsed: ReturnType<typeof parseRequestRows>) => {
    expect(parsed.issues).toEqual([]);
    const out = applyRequestRows(emptyRequests(), items, parsed.rows, undefined, SAMPLE_CLIENT.importLog, AT);
    expect(out.issues).toEqual([]);
    for (const i of items) expect(four(out.next, i.id), i.id).toEqual(four(r, i.id));
  };

  it("property: a CSV export reads back to the same tracking, in both languages", () => {
    fc.assert(
      fc.property(state, fc.constantFrom<FileLang>("tr", "en"), (r, lang) => {
        const rows = requestTable(items, r, lang, text);
        back(r, parseRequestRows(parseCsv(toCsv(rows[0], rows.slice(1))), { csv: true }));
      }),
    );
  });

  it("property: an Excel export reads back to the same tracking", async () => {
    await fc.assert(
      fc.asyncProperty(state, fc.constantFrom<FileLang>("tr", "en"), async (r, lang) => {
        const buf = await xlsxWorkbook([{ name: "Talepler", rows: requestTable(items, r, lang, text), text: [0, 6, 7, 10] }]);
        const read = await importRequestsFile(buf, "talepler.xlsx");
        expect(read.ok).toBe(true);
        if (read.ok) back(r, read.result);
      }),
      { numRuns: 25 },
    );
  });

  it("reads a CSV file with its byte-order mark", async () => {
    const r = setTrack(emptyRequests(), items[0], { owner: "Şükrü Öztürk", status: "requested", due: "2026-11-30" }, [], AT);
    const rows = requestTable(items, r, "tr", text);
    const read = await importRequestsFile(new TextEncoder().encode(toCsv(rows[0], rows.slice(1))).buffer as ArrayBuffer, "talepler.csv");
    expect(read.ok && four(applyRequestRows(emptyRequests(), items, read.result.rows, undefined, [], AT).next, items[0].id)).toEqual(four(r, items[0].id));
  });

  it("reads due dates as people type them", () => {
    expect(parseDue("")).toBe("");
    expect(parseDue("2026-11-30")).toBe("2026-11-30");
    expect(parseDue("2026-11-30 00:00:00")).toBe("2026-11-30");
    expect(parseDue("30.11.2026")).toBe("2026-11-30");
    expect(parseDue("1/2/2027")).toBe("2027-02-01");
    expect(parseDue("45658")).toBe("2025-01-01");
    expect(parseDue("31.02.2026")).toBeNull();
    expect(parseDue("2026")).toBeNull();
    expect(parseDue("yarın")).toBeNull();
  });

  it("finds the header below title rows in any language, and reports what it cannot use", () => {
    const grid = [
      ["Isoline veri talepleri"],
      ["ID", "Owner", "DURUM", "Son tarih"],
      ["ghg_stationary", "Tesis", "TESLIM ALINDI", "15.12.2026"],
      ["ghg_mobile", "", "belki", "dün"],
      ["", "x"],
      ["ghg_stationary", "Tekrar", "", ""],
      ["no_such_item", "X", "", ""],
      ["ghg_electricity", "Y", "accepted", ""],
    ];
    const p = parseRequestRows(grid);
    expect(p.read).toBe(6);
    expect(p.rows[0]).toEqual({ row: 3, id: "ghg_stationary", owner: "Tesis", status: "received", due: "2026-12-15" });
    expect(p.rows[1]).toEqual({ row: 4, id: "ghg_mobile", owner: "" });
    expect(p.issues.map((i) => [i.row, i.key])).toEqual([
      [4, "badDate"],
      [4, "badStatus"],
      [5, "missingId"],
      [6, "duplicate"],
    ]);
    const out = applyRequestRows(emptyRequests(), items, p.rows, approved("ghg"), [], AT);
    // every ghg row would change a locked section; the unknown code is reported too
    expect(out.changed).toBe(0);
    expect(out.issues.map((i) => i.key)).toEqual(["locked", "unknownId", "locked"]);
    expect(parseRequestRows([["Sorumlu", "Durum"]]).issues[0].key).toBe("missingColumns");
    expect(parseRequestRows([]).issues[0].key).toBe("empty");
  });

  it("a row that changes nothing is not counted, even in a locked section", () => {
    const r = setTrack(emptyRequests(), items[0], { owner: "A" }, [], AT);
    const rows = requestTable(items, r, "en", text);
    const out = applyRequestRows(r, items, parseRequestRows(rows).rows, approved(items[0].section), [], AT);
    expect(out).toEqual({ next: r, changed: 0, issues: [] });
  });
});

describe("asRequests", () => {
  it("repairs stored tracking field by field", () => {
    expect(asRequests(undefined)).toEqual(emptyRequests());
    expect(asRequests({ items: [] })).toEqual(emptyRequests());
    const r = asRequests({
      templates: ["gri", 3],
      items: {
        a: { owner: "X", due: "2026-13-01", status: "requested", note: 5 },
        b: { status: "lost" },
        c: { owner: "Y", due: "2026-11-30", status: "received", note: "", evidence: { fileName: "f", sha256: "s", importedAt: "t" } },
        d: { owner: "", due: "", status: "accepted", note: "", acceptedAt: AT, evidence: { sha256: "s" } },
      },
    });
    expect(r.templates).toEqual(["gri"]);
    expect(r.items).toEqual({
      a: { owner: "X", due: "", status: "requested", note: "" },
      c: { owner: "Y", due: "2026-11-30", status: "received", note: "" },
      d: { owner: "", due: "", status: "accepted", note: "", acceptedAt: AT },
    });
  });
  it("keeps the sample's tracking, its accepted trial balance linked to the sample import", () => {
    expect(asRequests(SAMPLE_CLIENT.requests)).toEqual(SAMPLE_CLIENT.requests);
    expect(SAMPLE_CLIENT.requests.items.tb_export.evidence?.sha256).toBe(SAMPLE_TB_SHA256);
    const statuses = Object.values(SAMPLE_CLIENT.requests.items).map((t) => t.status);
    expect(statuses.every((s: RequestStatus) => REQUEST_STATUSES.includes(s))).toBe(true);
  });
});
