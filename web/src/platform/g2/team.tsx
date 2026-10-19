"use client";

/** PORT-12: project team with RACI roles; outsiders appear only with the grant that lets them in. */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/provider";
import { api } from "../client";
import { ErrorNote, Input, Select, SubmitButton, useSubmit } from "../ui";

export type Candidate = { user_id: string; name: string; email: string; tenant_id: string; tenant_name: string; role: string; grantRole: string | null; allowed: string[] };

export function AddParticipantForm({ projectId, candidates }: { projectId: string; candidates: Candidate[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const key = (c: Candidate) => `${c.user_id}|${c.tenant_id}`;
  const [who, setWho] = useState(candidates[0] ? key(candidates[0]) : "");
  const chosen = candidates.find((c) => key(c) === who);
  const [role, setRole] = useState(chosen?.allowed[0] ?? "");
  const [resp, setResp] = useState("");
  const s = useSubmit(
    () => api("POST", `/api/v1/projects/${projectId}/participants`, { userId: chosen!.user_id, memberTenantId: chosen!.tenant_id, raciRole: role, responsibilities: resp.trim() || null }),
    () => {
      setResp("");
      router.refresh();
    },
  );
  if (!candidates.length) return <p className="text-[13.5px] text-[var(--ink-3)]">{t("pf.team.noCandidates")}</p>;
  return (
    <form onSubmit={s.submit} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_minmax(0,1fr)_auto] md:items-end">
      <Select
        label={t("pf.team.person")}
        name="t-person"
        value={who}
        onChange={(e) => {
          setWho(e.target.value);
          const c = candidates.find((x) => key(x) === e.target.value);
          setRole(c?.allowed[0] ?? "");
        }}
        options={candidates.map((c) => ({ value: key(c), label: `${c.name} — ${c.tenant_name}${c.grantRole ? ` (${t(`pf.grantRole.${c.grantRole}`)})` : ""}` }))}
      />
      <Select label={t("pf.team.raci")} name="t-role" value={role} onChange={(e) => setRole(e.target.value)} options={(chosen?.allowed ?? []).map((r) => ({ value: r, label: t(`pf.team.roles.${r}`) }))} />
      <Input label={t("pf.team.responsibilities")} name="t-resp" maxLength={500} value={resp} onChange={(e) => setResp(e.target.value)} />
      <SubmitButton busy={s.busy} disabled={!chosen || !role}>
        {t("pf.team.add")}
      </SubmitButton>
      <div className="md:col-span-4">
        <ErrorNote code={s.error} />
      </div>
    </form>
  );
}
