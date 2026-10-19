import Link from "next/link";
import { CustomSetForm } from "@/platform/g4/calc";
import { Badge, PageTitle, Section, StateBox, Table, Td } from "@/platform/ui";
import { attempt, dateOnly, titled, tr } from "@/platform/server";
import { requireWorkspace } from "@/server/http/dal";
import { memberCan } from "@/server/policy/policy";
import { factorValues, listFactorSets } from "@/server/calc/factors";

export const generateMetadata = titled("pf.factors.title");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** DATA-19: factor library — built-in sets with publisher, licence, edition and content digest; the tenant's own sets. */
export default async function FactorsPage({ params, searchParams }: PageProps<"/[lang]/app/factors">) {
  const { lang } = await params;
  const sp = await searchParams;
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
  const sets = await listFactorSets(ws.actor);
  const selected = typeof sp.set === "string" && UUID.test(sp.set) ? sets.find((s) => s.id === sp.set) : undefined;
  const values = selected ? await attempt(() => factorValues(ws.actor, selected.id)) : null;
  const canAdd = ws.actor.role !== null && memberCan(ws.actor.role, "calc.run");
  return (
    <>
      <PageTitle title={t("pf.factors.title")} lead={t("pf.factors.lead")} />
      <div className="flex flex-col gap-6">
        <Section title={t("pf.factors.sets", { n: sets.length })}>
          <Table head={[t("pf.factors.name"), t("pf.factors.publisher"), t("pf.factors.edition"), t("pf.factors.licence"), t("pf.factors.count"), t("pf.factors.digest")]}>
            {sets.map((s) => (
              <tr key={s.id} className={s.id === selected?.id ? "bg-[var(--b-50)]" : undefined}>
                <Td>
                  <Link href={`?set=${s.id}`} className="font-medium text-[var(--b-700)]">
                    {s.name}
                  </Link>
                  <div className="font-mono text-[11.5px] text-[var(--ink-3)]">
                    {s.code} {s.owner_tenant_id ? <Badge tone="info">{t("pf.factors.own")}</Badge> : null} {s.status !== "active" && <Badge tone="warn">{s.status}</Badge>}
                  </div>
                </Td>
                <Td className="text-[12.5px]">{s.publisher}</Td>
                <Td className="tabular-nums text-[12.5px]">{s.edition_year ?? (s.as_of ? dateOnly(lang, s.as_of) : "—")}</Td>
                <Td className="text-[12.5px]">{t(`pf.factors.licences.${s.licence}`)}</Td>
                <Td className="tabular-nums">{s.factors}</Td>
                <Td className="font-mono text-[11.5px] text-[var(--ink-3)]">{s.content_sha256.slice(0, 12)}…</Td>
              </tr>
            ))}
          </Table>
        </Section>
        {selected && (
          <Section title={selected.name} aside={selected.url ? <a href={selected.url} target="_blank" rel="noreferrer" className="text-[13px] text-[var(--b-700)]">{t("pf.factors.sourceLink")}</a> : undefined}>
            {selected.licence_note && <p className="text-[13px] text-[var(--ink-2)]">{selected.licence_note}</p>}
            {!values || !values.ok ? (
              <StateBox state="error" />
            ) : (
              <Table head={[t("pf.factors.kind"), t("pf.factors.key"), t("pf.factors.value"), t("pf.factors.unit"), "NCV · CH₄ · N₂O"]}>
                {values.data.map((v) => (
                  <tr key={v.id}>
                    <Td className="text-[12.5px]">{v.kind}</Td>
                    <Td>
                      <span className="font-mono text-[12.5px]">{v.key}</span>
                      {v.label && v.label !== v.key && <div className="text-[11.5px] text-[var(--ink-3)]">{v.label}</div>}
                    </Td>
                    <Td className="tabular-nums">{Number(v.value)}</Td>
                    <Td className="text-[12.5px]">{v.unit ?? "—"}</Td>
                    <Td className="tabular-nums text-[12px] text-[var(--ink-3)]">{[v.ncv, v.ch4, v.n2o].map((x) => (x === null ? "—" : Number(x))).join(" · ")}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>
        )}
        {canAdd && (
          <Section title={t("pf.factors.addTitle")}>
            <p className="text-[13px] leading-relaxed text-[var(--ink-2)]">{t("pf.factors.addLead")}</p>
            <CustomSetForm />
          </Section>
        )}
      </div>
    </>
  );
}
