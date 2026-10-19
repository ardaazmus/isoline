"use client";

/** PORT-04/05: an engagement (one contract) with several deliverables (reports) and its status. */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui";
import { api } from "../client";
import { ErrorNote, Input, Select, SubmitButton, useSubmit } from "../ui";

const KINDS = ["tsrs", "gri", "esrs", "vsme", "annual_report", "integrated", "ghg_inventory", "cbam", "tr_ets", "cdp", "other"];
const FLOW: Record<string, string[]> = { draft: ["accepted", "cancelled"], accepted: ["active", "cancelled"], active: ["review", "paused", "cancelled"], paused: ["active", "cancelled"], review: ["active", "closed"], closed: [], cancelled: [] };

export function EngagementForm({ clients }: { clients: { id: string; name: string }[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [f, setF] = useState({ title: "", scope: "", advisory: "", owner: "", startsOn: "", endsOn: "" });
  const s = useSubmit(
    () => api("POST", "/api/v1/engagements", { title: f.title, scope: f.scope.trim() || null, advisoryTenantId: f.advisory.trim() || null, startsOn: f.startsOn || null, endsOn: f.endsOn || null, ...(f.owner ? { ownerTenantId: f.owner } : {}) }),
    () => {
      setF({ title: "", scope: "", advisory: "", owner: "", startsOn: "", endsOn: "" });
      router.refresh();
    },
  );
  return (
    <form onSubmit={s.submit} className="grid gap-3 md:grid-cols-2">
      <Input label={t("pf.eng.titleField")} name="en-title" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      {clients.length > 0 ? (
        <Select label={t("pf.eng.client")} name="en-owner" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} options={[{ value: "", label: t("pf.projects.ownOwner") }, ...clients.map((c) => ({ value: c.id, label: c.name }))]} />
      ) : (
        <Input label={t("pf.eng.advisory")} name="en-adv" value={f.advisory} onChange={(e) => setF({ ...f, advisory: e.target.value })} hint={t("pf.eng.advisoryHint")} />
      )}
      <Input label={t("pf.eng.startsOn")} name="en-start" type="date" value={f.startsOn} onChange={(e) => setF({ ...f, startsOn: e.target.value })} />
      <Input label={t("pf.eng.endsOn")} name="en-end" type="date" value={f.endsOn} onChange={(e) => setF({ ...f, endsOn: e.target.value })} />
      <div className="md:col-span-2">
        <Input label={t("pf.eng.scope")} name="en-scope" maxLength={4000} value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} />
      </div>
      <div className="flex flex-col gap-2 md:col-span-2">
        <ErrorNote code={s.error} />
        <div>
          <SubmitButton busy={s.busy} disabled={!f.title.trim()}>
            {t("pf.eng.create")}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

export function DeliverableForm({ engagementId, projects }: { engagementId: string; projects: { id: string; name: string }[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [f, setF] = useState({ title: "", kind: "tsrs", dueOn: "", projectId: "" });
  const s = useSubmit(
    () => api("POST", `/api/v1/engagements/${engagementId}/deliverables`, { title: f.title, reportKind: f.kind, dueOn: f.dueOn || null, projectId: f.projectId || null }),
    () => {
      setF({ title: "", kind: "tsrs", dueOn: "", projectId: "" });
      router.refresh();
    },
  );
  return (
    <form onSubmit={s.submit} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_170px_150px_minmax(0,1fr)_auto] md:items-end">
      <Input label={t("pf.eng.deliverable")} name={`dl-t-${engagementId}`} required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <Select label={t("pf.eng.kind")} name={`dl-k-${engagementId}`} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} options={KINDS.map((k) => ({ value: k, label: t(`pf.eng.kinds.${k}`) }))} />
      <Input label={t("pf.eng.dueOn")} name={`dl-d-${engagementId}`} type="date" value={f.dueOn} onChange={(e) => setF({ ...f, dueOn: e.target.value })} />
      <Select label={t("pf.eng.project")} name={`dl-p-${engagementId}`} value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} options={[{ value: "", label: "—" }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} />
      <SubmitButton busy={s.busy} disabled={!f.title.trim()}>
        {t("pf.eng.addDeliverable")}
      </SubmitButton>
      <div className="md:col-span-5">
        <ErrorNote code={s.error} />
      </div>
    </form>
  );
}

export function EngagementStatus({ id, status }: { id: string; status: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {FLOW[status].map((to) => (
        <Button
          key={to}
          size="sm"
          variant="ghost"
          onClick={async () => {
            const r = await api("POST", `/api/v1/engagements/${id}/status`, { to });
            if (!r.ok) return setError(r.code);
            router.refresh();
          }}
        >
          {t(`pf.eng.to.${to}`)}
        </Button>
      ))}
      <ErrorNote code={error} />
    </span>
  );
}
