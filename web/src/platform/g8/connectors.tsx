"use client";

/** G8-01: set up a controlled pull connector and queue a pull. */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui";
import { api } from "../client";
import { ErrorNote, Input, OkNote, Select, SubmitButton, useSubmit } from "../ui";

export function ConnectorForm({ campaigns }: { campaigns: { id: string; title: string }[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [f, setF] = useState({ campaign: campaigns[0]?.id ?? "", name: "", kind: "http_csv", url: "", secret: "", schedule: "manual" });
  const s = useSubmit(
    () => api("POST", `/api/v1/campaigns/${f.campaign}/connectors`, { name: f.name, kind: f.kind, url: f.url, secret: f.secret || null, schedule: f.schedule }),
    () => {
      setF({ ...f, name: "", url: "", secret: "" });
      router.refresh();
    },
  );
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <form onSubmit={s.submit} className="grid gap-3 md:grid-cols-3">
      <Select label={t("pf.con.campaign")} name="cn-campaign" value={f.campaign} onChange={set("campaign")} options={campaigns.map((c) => ({ value: c.id, label: c.title }))} />
      <Input label={t("pf.con.name")} name="cn-name" value={f.name} onChange={set("name")} required maxLength={120} />
      <Select label={t("pf.con.kind")} name="cn-kind" value={f.kind} onChange={set("kind")} options={["http_csv", "http_json"].map((k) => ({ value: k, label: t(`pf.con.kinds.${k}`) }))} />
      <Input label={t("pf.con.url")} name="cn-url" type="url" value={f.url} onChange={set("url")} required hint={t("pf.con.urlHint")} />
      <Input label={t("pf.con.secret")} name="cn-secret" type="password" autoComplete="off" value={f.secret} onChange={set("secret")} hint={t("pf.con.secretHint")} />
      <Select label={t("pf.con.schedule")} name="cn-schedule" value={f.schedule} onChange={set("schedule")} options={["manual", "daily"].map((k) => ({ value: k, label: t(`pf.con.schedules.${k}`) }))} />
      <div className="flex flex-col gap-2 md:col-span-3">
        <div>
          <SubmitButton busy={s.busy} disabled={!f.campaign || !f.name.trim() || !f.url}>
            {t("pf.con.create")}
          </SubmitButton>
        </div>
        <ErrorNote code={s.error} />
      </div>
    </form>
  );
}

export function TriggerButton({ connectorId }: { connectorId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [queued, setQueued] = useState(false);
  const s = useSubmit(
    () => api("POST", `/api/v1/connectors/${connectorId}/trigger`),
    () => {
      setQueued(true);
      router.refresh();
    },
  );
  return (
    <span className="inline-flex flex-col gap-1">
      <Button type="button" size="sm" onClick={() => s.submit()} disabled={s.busy}>
        {t("pf.con.pull")}
      </Button>
      {queued && <OkNote>{t("pf.con.queued")}</OkNote>}
      <ErrorNote code={s.error} />
    </span>
  );
}
