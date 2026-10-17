# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS + Zustand + shadcn/ui primitives — the user's standing default stack (global instructions). Offline-first: the first release runs fully in the browser with local persistence; no server dependency for the tools.

## Users

Two primary audiences, confirmed as equal weight (2026-10-17):

- **Reporting consultancies** — firms that write sustainability reports, annual (activity) reports and CBAM packages for many client companies. They run several client workspaces in parallel, use the tools on the client's behalf and hand outputs (tables, charts, Word/Excel files, roadmaps) to the client and to the design agency.
- **In-house company teams** — sustainability, finance, investor-relations and operations staff of one company who enter their own data, run the calculators and prepare their own report or feed their consultant.

## Product Purpose

A working toolset for corporate reporting in Turkey and the EU: applicability tests, calculators, visual analysis tools, roadmap planners and ready report templates covering

- sustainability reporting (TSRS 1/2 / ISSB, GRI, ESRS after Omnibus, VSME, CDP-style questionnaires),
- annual activity reports (TTK minimum content, SPK II-14.1 for listed companies, sector and public-sector variants),
- carbon pricing exposure (EU CBAM / SKDM, Turkish ETS under the Climate Law).

Success: a consultant can open a client, find which frameworks apply, calculate the numbers, see them as presentation-grade visuals, and export a structured, source-linked package faster than with spreadsheets.

## Positioning

Turkey-first and EU-ready on one data spine: the same verified company data feeds the activity report, the sustainability report and the CBAM/ETS calculations, with every rule, threshold and emission factor carrying its official source, version and effective date. Consultancy-native (many clients, one workspace) rather than a single-company carbon tool.

## Operating Context

- Annual reporting cycle: data collection, calculation, review, writing, design hand-off, publication (KAP, general assembly, CBAM annual declaration).
- Inputs arrive as Excel files, PDFs and e-mails; outputs go to Word/Excel and to a design agency that produces the final printed/PDF report.
- Regulations change often (Omnibus, KGK scope decisions, CBAM secondary legislation); users need to see the status and date of each rule.

## Capabilities and Constraints

- First release: calculators, visuals, planners and templates work client-side; data stays in the browser (local persistence) and can be exported/imported as files. Accounts, multi-tenant database, roles and approval flows are a later phase.
- Internationalisation is mandatory and extensible: all UI copy lives in per-language JSON message files; Turkish is the default, English ships with v1, and further languages must be addable by dropping in a JSON file without code changes.
- The product is a compliance-readiness tool. It never claims legal opinion, assurance, accredited CBAM verification or "fully compliant" status. Uncertain rules are shown as needing expert review.
- Every regulatory fact, threshold and factor shown in the UI must cite an official source and an as-of date.
- Product name: **Isoline** (chosen by the user 2026-10-17; web-signal collision check only, formal trademark search in classes 9/35/42 still pending). Tagline idea: "Every number, on the map." Pronunciation to fix in brand guide (TR may read "i-zo-lin").

## Brand Commitments

- The user requires the design language of Impeccable (impeccable.style) for this product.
- Tone: corporate, elegant, calm, trustworthy; sophisticated visual language for maps, charts and roadmaps.

## Evidence on Hand

- Original research/roadmap package: `arsiv/mizan-v1/` (strategy, regulatory research plan, architecture, backlog, source register).
- No customers, testimonials, pricing, benchmarks or case studies exist. Never fabricate them. Demonstration company data must be labelled as sample data.

## Product Principles

1. Source before statement: no number, threshold or obligation without its official source and date.
2. One data spine, many reports: enter once, reuse across activity, sustainability and carbon-pricing outputs, with differences in boundary or period made visible.
3. Readiness, not certification: guide and check; humans approve.
4. Presentation-grade by default: every calculation result is immediately a chart or table worthy of a published report.
5. Language-neutral core: copy, templates and labels are data, not code.

## Accessibility & Inclusion

Target WCAG 2.2 AA (inferred from B2B/corporate procurement context; not yet confirmed by the user). Charts must not rely on colour alone and must expose their numbers as tables.
