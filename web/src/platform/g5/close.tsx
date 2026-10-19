"use client";

/**
 * CTRL-04..09 (G5): consolidation inputs and runs, reconciliation, close checklist, freeze and reopen. The server
 * re-checks every step; buttons only hide what the person cannot do.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lock, Play, Unlock } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui";
import { api } from "../client";
import { ErrorNote, Input, OkNote, Select, SubmitButton, useSubmit } from "../ui";

/** A POST button that refreshes the page on success. */
export function ActionButton({ path, label, body, variant = "quiet", confirm }: { path: string; label: string; body?: unknown; variant?: "primary" | "quiet" | "ghost"; confirm?: string }) {
  const router = useRouter();
  const s = useSubmit(() => api("POST", path, body), () => router.refresh());
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        type="button"
        size="sm"
        variant={variant}
        disabled={s.busy}
        onClick={() => {
          if (!confirm || window.confirm(confirm)) void s.submit();
        }}
      >
        {label}
      </Button>
      <ErrorNote code={s.error} />
    </span>
  );
}

type Entity = { id: string; name: string };

export function EntityFinancialForm({ cycleId, entities }: { cycleId: string; entities: Entity[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [entity, setEntity] = useState(entities[0]?.id ?? "");
  const [sales, setSales] = useState("");
  const [note, setNote] = useState("");
  const s = useSubmit(
    () => api("POST", `/api/v1/cycles/${cycleId}/entity-financials`, { legalEntityId: entity, netSales: sales, note: note || null }),
    () => {
      setSales("");
      setNote("");
      router.refresh();
    },
  );
  return (
    <form onSubmit={s.submit} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_minmax(0,1fr)_auto] md:items-end">
      <Select label={t("pf.cons.entity")} name="ef-entity" value={entity} onChange={(e) => setEntity(e.target.value)} options={entities.map((x) => ({ value: x.id, label: x.name }))} />
      <Input label={t("pf.cons.netSales")} name="ef-sales" inputMode="decimal" value={sales} onChange={(e) => setSales(e.target.value)} hint={t("pf.cons.amountHint")} required />
      <Input label={t("pf.cons.note")} name="ef-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
      <SubmitButton busy={s.busy} disabled={!entity || !sales.trim()}>
        {t("pf.cons.submit")}
      </SubmitButton>
      <div className="md:col-span-4">
        <ErrorNote code={s.error} />
      </div>
    </form>
  );
}

export function EliminationForm({ cycleId, entities }: { cycleId: string; entities: Entity[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [seller, setSeller] = useState(entities[0]?.id ?? "");
  const [buyer, setBuyer] = useState(entities[1]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const s = useSubmit(
    () => api("POST", `/api/v1/cycles/${cycleId}/eliminations`, { sellerEntityId: seller, buyerEntityId: buyer, amount, description }),
    () => {
      setAmount("");
      setDescription("");
      router.refresh();
    },
  );
  const opts = entities.map((x) => ({ value: x.id, label: x.name }));
  return (
    <form onSubmit={s.submit} className="grid gap-3 md:grid-cols-2">
      <Select label={t("pf.cons.seller")} name="el-seller" value={seller} onChange={(e) => setSeller(e.target.value)} options={opts} />
      <Select label={t("pf.cons.buyer")} name="el-buyer" value={buyer} onChange={(e) => setBuyer(e.target.value)} options={opts} />
      <Input label={t("pf.cons.amount")} name="el-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} hint={t("pf.cons.amountHint")} required />
      <Input label={t("pf.cons.description")} name="el-desc" value={description} onChange={(e) => setDescription(e.target.value)} minLength={3} maxLength={500} required />
      <div className="flex flex-col gap-2 md:col-span-2">
        <div>
          <SubmitButton busy={s.busy} disabled={!seller || !buyer || seller === buyer || !amount.trim() || description.trim().length < 3}>
            {t("pf.cons.addElimination")}
          </SubmitButton>
        </div>
        <ErrorNote code={s.error} />
      </div>
    </form>
  );
}

export function RunButton({ path, label }: { path: string; label: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [done, setDone] = useState<{ reused: boolean; blockers: number; warnings: number } | null>(null);
  const s = useSubmit(
    () => api<{ reused: boolean; blockers: number; warnings: number }>("POST", path),
    (d) => {
      setDone(d);
      router.refresh();
    },
  );
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button type="button" size="sm" variant="primary" onClick={() => s.submit()} disabled={s.busy}>
          <Play size={14} aria-hidden /> {label}
        </Button>
      </div>
      <ErrorNote code={s.error} />
      {done && <OkNote>{done.reused ? t("pf.calc.reused") : t("pf.close.runDone", { blockers: done.blockers, warnings: done.warnings })}</OkNote>}
    </div>
  );
}

export function FreezeButton({ cycleId, disabled }: { cycleId: string; disabled: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [done, setDone] = useState<{ version: number; digest: string; restated: number } | null>(null);
  const s = useSubmit(
    () => api<{ version: number; digest: string; restated: number }>("POST", `/api/v1/cycles/${cycleId}/freeze`),
    (d) => {
      setDone(d);
      router.refresh();
    },
  );
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button type="button" variant="primary" onClick={() => window.confirm(t("pf.close.freezeConfirm")) && s.submit()} disabled={disabled || s.busy}>
          <Lock size={15} aria-hidden /> {t("pf.close.freeze")}
        </Button>
      </div>
      <ErrorNote code={s.error} />
      {done && <OkNote>{t("pf.close.frozen", { version: done.version, digest: done.digest.slice(0, 12), restated: done.restated })}</OkNote>}
    </div>
  );
}

export function ReopenForm({ cycleId }: { cycleId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [reason, setReason] = useState("");
  const s = useSubmit(() => api("POST", `/api/v1/cycles/${cycleId}/reopen`, { reason }), () => router.refresh());
  return (
    <form onSubmit={s.submit} className="flex flex-col gap-2">
      <label htmlFor="reopen-reason" className="text-[13px] font-medium">
        {t("pf.close.reopenReason")}
      </label>
      <textarea id="reopen-reason" className="min-h-[70px] rounded-[10px] border border-[var(--rule)] bg-[var(--paper)] p-2 text-[13.5px]" value={reason} onChange={(e) => setReason(e.target.value)} minLength={20} maxLength={2000} required />
      <div>
        <SubmitButton busy={s.busy} disabled={reason.trim().length < 20}>
          <Unlock size={15} aria-hidden /> {t("pf.close.reopen")}
        </SubmitButton>
      </div>
      <ErrorNote code={s.error} />
    </form>
  );
}

export function ReopenRequestForm({ requestId }: { requestId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const s = useSubmit(() => api("POST", `/api/v1/requests/${requestId}/reopen`, { reason }), () => router.refresh());
  if (!open)
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
        {t("pf.close.reopenRequest")}
      </Button>
    );
  return (
    <form onSubmit={s.submit} className="flex flex-col gap-2">
      <Input label={t("pf.calc.reason")} name="rr-reason" value={reason} onChange={(e) => setReason(e.target.value)} minLength={10} maxLength={2000} />
      <div>
        <SubmitButton busy={s.busy} disabled={reason.trim().length < 10}>
          {t("pf.close.reopenRequest")}
        </SubmitButton>
      </div>
      <ErrorNote code={s.error} />
    </form>
  );
}
