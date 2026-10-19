"use client";

/** PORT-07..13: project tabs, new-project wizard, extra reporting cycle. */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/components/ui";
import { api } from "../client";
import { Check, ErrorNote, Input, OkNote, Select, SubmitButton, useSubmit } from "../ui";

export function ProjectTabs({ base }: { base: string }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const tabs = [
    { href: base, id: "overview" },
    { href: `${base}/plan`, id: "plan" },
    { href: `${base}/scope`, id: "scope" },
    { href: `${base}/data`, id: "data" },
    { href: `${base}/calculations`, id: "calc" },
    { href: `${base}/consolidation`, id: "consolidation" },
    { href: `${base}/controls`, id: "controls" },
    { href: `${base}/close`, id: "close" },
    { href: `${base}/reports`, id: "reports" },
    { href: `${base}/industry`, id: "industry" },
    { href: `${base}/assurance`, id: "assurance" },
    { href: `${base}/participants`, id: "participants" },
  ];
  return (
    <nav aria-label={t("pf.project.tabs")} className="mb-5 flex flex-wrap gap-1.5">
      {tabs.map((x) => {
        const on = x.href === base ? pathname === base : pathname.startsWith(x.href);
        return (
          <Link
            key={x.id}
            href={x.href}
            aria-current={on ? "page" : undefined}
            className={cn("rounded-[11px] px-3.5 py-1.5 text-[13.5px] font-medium no-underline transition-colors", on ? "bg-[var(--b-600)] text-white" : "glass text-[var(--ink-2)] hover:text-[var(--ink)]")}
          >
            {t(`pf.project.tab.${x.id}`)}
          </Link>
        );
      })}
    </nav>
  );
}

type Opt = { id: string; name: string };

export function ProjectWizard({ lang, organizations, engagements, clients, defaultYear }: { lang: string; organizations: (Opt & { owner: string })[]; engagements: (Opt & { owner: string })[]; clients: Opt[]; defaultYear: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const [owner, setOwner] = useState("");
  const [f, setF] = useState({ name: "", description: "", organizationId: "", engagementId: "", year: defaultYear, custom: false, start: "", end: "", publishDue: `${defaultYear + 1}-05-31`, baseYear: false });
  const ownOrgs = organizations.filter((o) => (owner ? o.owner === owner : !clients.some((c) => c.id === o.owner)));
  const ownEng = engagements.filter((e) => (owner ? e.owner === owner : !clients.some((c) => c.id === e.owner)));
  const s = useSubmit(
    () =>
      api<{ projectId: string; lateBy: number }>("POST", "/api/v1/projects/wizard", {
        name: f.name,
        description: f.description.trim() || null,
        ...(owner ? { ownerTenantId: owner } : {}),
        organizationId: f.organizationId || null,
        engagementId: f.engagementId || null,
        cycle: { reportingYear: f.year, ...(f.custom ? { periodStart: f.start, periodEnd: f.end } : {}), publishDue: f.publishDue || null, isBaseYear: f.baseYear },
      }),
    (d) => router.push(`/${lang}/app/projects/${d.projectId}/plan${d.lateBy > 0 ? `?late=${d.lateBy}` : ""}`),
  );
  return (
    <form onSubmit={s.submit} className="flex flex-col gap-5">
      <fieldset className="grid gap-3 md:grid-cols-2">
        <legend className="mb-2 text-[14px] font-semibold">{t("pf.wizard.step1")}</legend>
        <Input label={t("pf.projects.name")} name="w-name" required maxLength={200} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} hint={t("pf.wizard.nameHint")} />
        {clients.length > 0 && (
          <Select label={t("pf.projects.owner")} name="w-owner" value={owner} onChange={(e) => { setOwner(e.target.value); setF({ ...f, organizationId: "", engagementId: "" }); }} options={[{ value: "", label: t("pf.projects.ownOwner") }, ...clients.map((c) => ({ value: c.id, label: c.name }))]} />
        )}
        <Select label={t("pf.wizard.organization")} name="w-org" value={f.organizationId} onChange={(e) => setF({ ...f, organizationId: e.target.value })} options={[{ value: "", label: t("pf.wizard.noOrganization") }, ...ownOrgs.map((o) => ({ value: o.id, label: o.name }))]} hint={t("pf.wizard.organizationHint")} />
        <Select label={t("pf.wizard.engagement")} name="w-eng" value={f.engagementId} onChange={(e) => setF({ ...f, engagementId: e.target.value })} options={[{ value: "", label: t("pf.wizard.noEngagement") }, ...ownEng.map((o) => ({ value: o.id, label: o.name }))]} />
        <div className="md:col-span-2">
          <Input label={t("pf.wizard.description")} name="w-desc" maxLength={2000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </div>
      </fieldset>
      <fieldset className="grid gap-3 md:grid-cols-3">
        <legend className="mb-2 text-[14px] font-semibold">{t("pf.wizard.step2")}</legend>
        <Input label={t("pf.wizard.year")} name="w-year" type="number" min={2000} max={2100} required value={f.year} onChange={(e) => setF({ ...f, year: Number(e.target.value), publishDue: `${Number(e.target.value) + 1}-05-31` })} />
        <Input label={t("pf.wizard.publishDue")} name="w-due" type="date" value={f.publishDue} onChange={(e) => setF({ ...f, publishDue: e.target.value })} hint={t("pf.wizard.publishDueHint")} />
        <div className="flex flex-col justify-end gap-2">
          <Check id="w-custom" checked={f.custom} onChange={(v) => setF({ ...f, custom: v })} label={t("pf.wizard.customPeriod")} />
          <Check id="w-base" checked={f.baseYear} onChange={(v) => setF({ ...f, baseYear: v })} label={t("pf.wizard.baseYear")} />
        </div>
        {f.custom && (
          <>
            <Input label={t("pf.wizard.periodStart")} name="w-start" type="date" required value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
            <Input label={t("pf.wizard.periodEnd")} name="w-end" type="date" required value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />
          </>
        )}
      </fieldset>
      <p className="rounded-[12px] bg-[var(--b-50)] px-3 py-2 text-[12.5px] leading-relaxed text-[var(--b-800)]">{t("pf.wizard.planNote")}</p>
      <ErrorNote code={s.error} />
      <div>
        <SubmitButton busy={s.busy} disabled={!f.name.trim() || (f.custom && (!f.start || !f.end))}>
          {t("pf.wizard.submit")}
        </SubmitButton>
      </div>
    </form>
  );
}

export function AddCycleForm({ projectId, nextYear }: { projectId: string; nextYear: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const [year, setYear] = useState(nextYear);
  const [due, setDue] = useState(`${nextYear + 1}-05-31`);
  const [ok, setOk] = useState(false);
  const s = useSubmit(
    () => api("POST", `/api/v1/projects/${projectId}/cycles`, { reportingYear: year, publishDue: due || null }),
    () => {
      setOk(true);
      router.refresh();
    },
  );
  return (
    <form onSubmit={s.submit} className="flex flex-col gap-3 md:flex-row md:items-end">
      <Input label={t("pf.wizard.year")} name="c-year" type="number" min={2000} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))} />
      <Input label={t("pf.wizard.publishDue")} name="c-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      <SubmitButton busy={s.busy}>{t("pf.cycle.add")}</SubmitButton>
      <ErrorNote code={s.error} />
      {ok && !s.error && <OkNote>{t("pf.cycle.added")}</OkNote>}
    </form>
  );
}

export function CycleMove({ cycleId, to, label, etag }: { cycleId: string; to: string; label: string; etag: number }) {
  const router = useRouter();
  const s = useSubmit(() => api("POST", `/api/v1/cycles/${cycleId}/status`, { to }, { ifMatch: `"${etag}"` }), () => router.refresh());
  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" disabled={s.busy} onClick={() => void s.submit()} className="rounded-[10px] border border-[var(--rule)] px-2.5 py-1 text-[12.5px] font-medium hover:border-[var(--b-300)]">
        {label}
      </button>
      <ErrorNote code={s.error} />
    </span>
  );
}
