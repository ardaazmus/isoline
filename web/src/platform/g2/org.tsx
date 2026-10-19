"use client";

/** ORG-07..09 forms: organisation, legal entity, facility, dated ownership edges, as-of date and mapping check. */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui";
import { api } from "../client";
import { Check, ErrorNote, Input, OkNote, Select, SubmitButton, useSubmit } from "../ui";

const ENTITY_TYPES = ["listed", "bank", "bank_tmsf", "nonbank_fi", "insurer", "capital_markets_fi", "precious_metals", "unlisted_company", "public_body"];
const FACILITY_KINDS = ["plant", "office", "warehouse", "store", "site", "mine", "vessel", "other"];
const CONTROLS = ["financial", "operational", "joint", "significant_influence", "none"];

export function OrganizationForm({ ownerTenantId }: { ownerTenantId?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [fy, setFy] = useState(1);
  const s = useSubmit(() => api("POST", "/api/v1/organizations", { name, sectorCode: sector.trim().toUpperCase() || null, fiscalYearStartMonth: fy, ...(ownerTenantId ? { ownerTenantId } : {}) }), () => router.refresh());
  return (
    <form onSubmit={s.submit} className="grid gap-3 md:grid-cols-[1fr_180px_160px_auto] md:items-end">
      <Input label={t("pf.org.orgName")} name="org-name" required value={name} onChange={(e) => setName(e.target.value)} />
      <Input label={t("pf.org.sector")} name="org-sector" placeholder="C24" hint={t("pf.org.sectorHint")} value={sector} onChange={(e) => setSector(e.target.value)} />
      <Select label={t("pf.org.fiscalStart")} name="org-fy" value={String(fy)} onChange={(e) => setFy(Number(e.target.value))} options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: t(`pf.month.${i + 1}`) }))} />
      <SubmitButton busy={s.busy} disabled={!name.trim()}>
        {t("pf.org.createOrg")}
      </SubmitButton>
      <div className="md:col-span-4">
        <ErrorNote code={s.error} />
      </div>
    </form>
  );
}

export function EntityForm({ organizationId, hasParent }: { organizationId: string; hasParent: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [f, setF] = useState({ name: "", taxId: "", entityType: "unlisted_company", parent: !hasParent, validFrom: "" });
  const s = useSubmit(
    () => api("POST", "/api/v1/entities", { organizationId, name: f.name, taxId: f.taxId.trim() || null, entityType: f.entityType, isReportingParent: f.parent, validFrom: f.validFrom || null }),
    () => {
      setF({ name: "", taxId: "", entityType: "unlisted_company", parent: false, validFrom: "" });
      router.refresh();
    },
  );
  return (
    <form onSubmit={s.submit} className="grid gap-3 md:grid-cols-2">
      <Input label={t("pf.org.entityName")} name="e-name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <Select label={t("pf.org.entityType")} name="e-type" value={f.entityType} onChange={(e) => setF({ ...f, entityType: e.target.value })} options={ENTITY_TYPES.map((x) => ({ value: x, label: t(`app.entity.${x}`) }))} />
      <Input label={t("pf.org.taxId")} name="e-tax" value={f.taxId} onChange={(e) => setF({ ...f, taxId: e.target.value })} hint={t("pf.org.taxIdHint")} />
      <Input label={t("pf.org.validFrom")} name="e-from" type="date" value={f.validFrom} onChange={(e) => setF({ ...f, validFrom: e.target.value })} />
      {!hasParent && <Check id="e-parent" checked={f.parent} onChange={(v) => setF({ ...f, parent: v })} label={t("pf.org.isParent")} />}
      <div className="flex flex-col gap-2 md:col-span-2">
        <ErrorNote code={s.error} />
        <div>
          <SubmitButton busy={s.busy} disabled={!f.name.trim()}>
            {t("pf.org.addEntity")}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

export function FacilityForm({ entities }: { entities: { id: string; name: string }[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const blank = { legalEntityId: entities[0]?.id ?? "", name: "", kind: "plant", city: "", operated: true, cbam: false, grid: "distribution" };
  const [f, setF] = useState(blank);
  const s = useSubmit(
    () => api("POST", "/api/v1/facilities", { legalEntityId: f.legalEntityId, name: f.name, kind: f.kind, city: f.city.trim() || null, operated: f.operated, cbamInstallation: f.cbam, gridConnection: f.grid }),
    () => {
      setF({ ...blank, legalEntityId: f.legalEntityId });
      router.refresh();
    },
  );
  if (!entities.length) return <p className="text-[13.5px] text-[var(--ink-3)]">{t("pf.org.needEntity")}</p>;
  return (
    <form onSubmit={s.submit} className="grid gap-3 md:grid-cols-2">
      <Select label={t("pf.org.entity")} name="f-entity" value={f.legalEntityId} onChange={(e) => setF({ ...f, legalEntityId: e.target.value })} options={entities.map((x) => ({ value: x.id, label: x.name }))} />
      <Input label={t("pf.org.facilityName")} name="f-name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <Select label={t("pf.org.facilityKind")} name="f-kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} options={FACILITY_KINDS.map((x) => ({ value: x, label: t(`pf.org.kind.${x}`) }))} />
      <Input label={t("pf.org.city")} name="f-city" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
      <Select label={t("pf.org.grid")} name="f-grid" value={f.grid} onChange={(e) => setF({ ...f, grid: e.target.value })} options={["distribution", "transmission"].map((x) => ({ value: x, label: t(`pf.org.gridKind.${x}`) }))} hint={t("pf.org.gridHint")} />
      <Check id="f-operated" checked={f.operated} onChange={(v) => setF({ ...f, operated: v })} label={t("pf.org.operated")} />
      <Check id="f-cbam" checked={f.cbam} onChange={(v) => setF({ ...f, cbam: v })} label={t("pf.org.cbamInstallation")} />
      <div className="flex flex-col gap-2 md:col-span-2">
        <ErrorNote code={s.error} />
        <div>
          <SubmitButton busy={s.busy} disabled={!f.name.trim() || !f.legalEntityId}>
            {t("pf.org.addFacility")}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

export function EdgeForm({ entities }: { entities: { id: string; name: string }[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [f, setF] = useState({ parent: entities[0]?.id ?? "", child: entities[1]?.id ?? "", share: 100, control: "financial", from: `${new Date().getFullYear()}-01-01`, note: "" });
  const s = useSubmit(
    () => api("POST", "/api/v1/ownership", { parentEntityId: f.parent, childEntityId: f.child, sharePct: f.share, control: f.control, validFrom: f.from, sourceNote: f.note.trim() || null }),
    () => router.refresh(),
  );
  if (entities.length < 2) return <p className="text-[13.5px] text-[var(--ink-3)]">{t("pf.org.needTwoEntities")}</p>;
  const opts = entities.map((x) => ({ value: x.id, label: x.name }));
  return (
    <form onSubmit={s.submit} className="grid gap-3 md:grid-cols-3">
      <Select label={t("pf.org.parent")} name="o-parent" value={f.parent} onChange={(e) => setF({ ...f, parent: e.target.value })} options={opts} />
      <Select label={t("pf.org.child")} name="o-child" value={f.child} onChange={(e) => setF({ ...f, child: e.target.value })} options={opts} />
      <Input label={t("pf.org.share")} name="o-share" type="number" min={0.0001} max={100} step="0.01" required value={f.share} onChange={(e) => setF({ ...f, share: Number(e.target.value) })} />
      <Select label={t("pf.org.control")} name="o-control" value={f.control} onChange={(e) => setF({ ...f, control: e.target.value })} options={CONTROLS.map((x) => ({ value: x, label: t(`pf.org.controls.${x}`) }))} hint={t(`pf.org.controlHint.${f.control}`)} />
      <Input label={t("pf.org.validFrom")} name="o-from" type="date" required value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
      <Input label={t("pf.org.sourceNote")} name="o-note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} hint={t("pf.org.sourceNoteHint")} />
      <div className="flex flex-col gap-2 md:col-span-3">
        <ErrorNote code={s.error} />
        <div>
          <SubmitButton busy={s.busy} disabled={f.parent === f.child}>
            {t("pf.org.addEdge")}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

export function EndEdgeButton({ edgeId }: { edgeId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const s = useSubmit(() => api("POST", `/api/v1/ownership/${edgeId}/end`, { validTo: date }), () => router.refresh());
  if (!open)
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        {t("pf.org.endEdge")}
      </Button>
    );
  return (
    <form onSubmit={s.submit} className="flex flex-wrap items-end gap-2">
      <Input label={t("pf.org.validTo")} name={`end-${edgeId}`} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      <SubmitButton busy={s.busy} disabled={!date}>
        {t("pf.common.save")}
      </SubmitButton>
      <ErrorNote code={s.error} />
    </form>
  );
}

export function ConfirmMapping({ organizationId }: { organizationId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const s = useSubmit(() => api("POST", `/api/v1/organizations/${organizationId}/confirm`), () => router.refresh());
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm" variant="primary" onClick={() => void s.submit()} disabled={s.busy}>
        {t("pf.org.confirmMapping")}
      </Button>
      <ErrorNote code={s.error} />
    </div>
  );
}

export function AsOfPicker({ value, basePath }: { value: string; basePath: string }) {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Input label={t("pf.org.asOf")} name="as-of" type="date" value={value} onChange={(e) => e.target.value && router.push(`${basePath}${basePath.includes("?") ? "&" : "?"}asOf=${e.target.value}`)} />
      {value && (
        <Button size="sm" variant="ghost" onClick={() => router.push(basePath)}>
          {t("pf.org.allPeriods")}
        </Button>
      )}
    </div>
  );
}

export function EntityEditForm({ id, initial, etag }: { id: string; initial: { name: string; taxId: string | null; entityType: string; validFrom: string | null; validTo: string | null }; etag: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const [f, setF] = useState({ name: initial.name, taxId: initial.taxId ?? "", entityType: initial.entityType, validFrom: initial.validFrom ?? "", validTo: initial.validTo ?? "" });
  const [saved, setSaved] = useState(false);
  const s = useSubmit(
    () => api("PATCH", `/api/v1/entities/${id}`, { name: f.name, taxId: f.taxId.trim() || null, entityType: f.entityType, validFrom: f.validFrom || null, validTo: f.validTo || null }, { ifMatch: `"${etag}"` }),
    () => {
      setSaved(true);
      router.refresh();
    },
  );
  return (
    <form onSubmit={s.submit} className="grid gap-3 md:grid-cols-2">
      <Input label={t("pf.org.entityName")} name="ee-name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <Select label={t("pf.org.entityType")} name="ee-type" value={f.entityType} onChange={(e) => setF({ ...f, entityType: e.target.value })} options={ENTITY_TYPES.map((x) => ({ value: x, label: t(`app.entity.${x}`) }))} />
      <Input label={t("pf.org.taxId")} name="ee-tax" value={f.taxId} onChange={(e) => setF({ ...f, taxId: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <Input label={t("pf.org.validFrom")} name="ee-from" type="date" value={f.validFrom} onChange={(e) => setF({ ...f, validFrom: e.target.value })} />
        <Input label={t("pf.org.validTo")} name="ee-to" type="date" value={f.validTo} onChange={(e) => setF({ ...f, validTo: e.target.value })} />
      </div>
      <div className="flex flex-col gap-2 md:col-span-2">
        <ErrorNote code={s.error} />
        {saved && !s.error && <OkNote>{t("pf.common.saved")}</OkNote>}
        <div>
          <SubmitButton busy={s.busy}>{t("pf.common.save")}</SubmitButton>
        </div>
      </div>
    </form>
  );
}

export function FacilityEditForm({ id, initial, etag }: { id: string; initial: { name: string; kind: string; city: string | null; operated: boolean; cbam: boolean; grid: string; validTo: string | null }; etag: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const [f, setF] = useState({ ...initial, city: initial.city ?? "", validTo: initial.validTo ?? "" });
  const [saved, setSaved] = useState(false);
  const s = useSubmit(
    () => api("PATCH", `/api/v1/facilities/${id}`, { name: f.name, kind: f.kind, city: f.city.trim() || null, operated: f.operated, cbamInstallation: f.cbam, gridConnection: f.grid, validTo: f.validTo || null }, { ifMatch: `"${etag}"` }),
    () => {
      setSaved(true);
      router.refresh();
    },
  );
  return (
    <form onSubmit={s.submit} className="grid gap-3 md:grid-cols-2">
      <Input label={t("pf.org.facilityName")} name="fe-name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <Select label={t("pf.org.facilityKind")} name="fe-kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} options={FACILITY_KINDS.map((x) => ({ value: x, label: t(`pf.org.kind.${x}`) }))} />
      <Input label={t("pf.org.city")} name="fe-city" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
      <Select label={t("pf.org.grid")} name="fe-grid" value={f.grid} onChange={(e) => setF({ ...f, grid: e.target.value })} options={["distribution", "transmission"].map((x) => ({ value: x, label: t(`pf.org.gridKind.${x}`) }))} hint={t("pf.org.gridHint")} />
      <Input label={t("pf.org.validTo")} name="fe-to" type="date" value={f.validTo} onChange={(e) => setF({ ...f, validTo: e.target.value })} hint={t("pf.org.closedHint")} />
      <Check id="fe-operated" checked={f.operated} onChange={(v) => setF({ ...f, operated: v })} label={t("pf.org.operated")} />
      <Check id="fe-cbam" checked={f.cbam} onChange={(v) => setF({ ...f, cbam: v })} label={t("pf.org.cbamInstallation")} />
      <div className="flex flex-col gap-2 md:col-span-2">
        <ErrorNote code={s.error} />
        {saved && !s.error && <OkNote>{t("pf.common.saved")}</OkNote>}
        <div>
          <SubmitButton busy={s.busy}>{t("pf.common.save")}</SubmitButton>
        </div>
      </div>
    </form>
  );
}
