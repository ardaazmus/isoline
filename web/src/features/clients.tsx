"use client";

import { useRef, useState } from "react";
import { Download, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { exportWorkspace, useWorkspace } from "@/store/workspace";
import { download } from "@/lib/export";
import { PageHeader } from "@/components/shell";
import { Button, Callout, SampleFlag, TextField } from "@/components/ui";
import { Hydrated, SectionTitle } from "./common";

export function ClientsPage() {
  return (
    <Hydrated>
      <Inner />
    </Hydrated>
  );
}

function Inner() {
  const { t } = useI18n();
  const { clients, activeId, setActive, addClient, renameClient, removeClient, restoreSample, importWorkspace } = useWorkspace();
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "note" | "crit"; text: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);

  return (
    <div data-family="compass">
      <PageHeader
        title={t("clients.title")}
        result={t("clients.result", { n: clients.length })}
        actions={
          <>
            <Button variant="onBand" onClick={() => file.current?.click()}>
              <Upload size={15} aria-hidden /> {t("clients.import")}
            </Button>
            <Button variant="onBandPrimary" onClick={() => download(`isoline-workspace-${new Date().toISOString().slice(0, 10)}.json`, exportWorkspace(), "application/json")}>
              <Download size={15} aria-hidden /> {t("clients.export")}
            </Button>
          </>
        }
      />
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            const res = importWorkspace(JSON.parse(await f.text()));
            setMsg(res.ok ? { tone: "note", text: t("clients.imported") } : { tone: "crit", text: t(`clients.err_${res.error}`) });
          } catch {
            setMsg({ tone: "crit", text: t("clients.err_invalid") });
          }
          e.target.value = "";
        }}
      />
      {msg && <Callout tone={msg.tone}>{msg.text}</Callout>}
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="glass flex min-w-0 flex-col gap-3 p-5 md:p-6">
          <SectionTitle>{t("clients.list")}</SectionTitle>
          <ul className="flex flex-col">
            {clients.map((c) => (
              <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 border-b border-[var(--rule)] py-4">
                <div className="flex min-w-0 flex-col gap-2">
                  <TextField label={c.id === activeId ? t("clients.active") : t("clients.name")} value={c.name} onChange={(v) => renameClient(c.id, v)} />
                  {c.sample && (
                    <span>
                      <SampleFlag text={t("shell.sample")} />
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {c.id !== activeId && (
                    <Button variant="quiet" size="sm" onClick={() => setActive(c.id)}>
                      {t("clients.open")}
                    </Button>
                  )}
                  {confirm === c.id ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>
                        {t("clients.cancel")}
                      </Button>
                      <Button
                        size="sm"
                        className="border border-[var(--crit)] text-[var(--crit)]"
                        onClick={() => {
                          removeClient(c.id);
                          setConfirm(null);
                        }}
                      >
                        {t("clients.confirmDelete")}
                      </Button>
                    </>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setConfirm(c.id)} aria-label={t("clients.delete")}>
                      <Trash2 size={14} aria-hidden />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
        <aside className="flex flex-col gap-6">
          <form
            className="glass flex min-w-0 flex-col gap-3 p-5 md:p-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              addClient(name.trim());
              setName("");
            }}
          >
            <SectionTitle>{t("clients.new")}</SectionTitle>
            <TextField label={t("clients.name")} value={name} onChange={setName} hint={t("clients.newHint")} />
            <Button type="submit" variant="primary" disabled={!name.trim()} className="self-start">
              <Plus size={15} aria-hidden /> {t("clients.add")}
            </Button>
          </form>
          <div className="glass flex min-w-0 flex-col gap-3 p-5 md:p-6">
            <SectionTitle>{t("clients.sampleTitle")}</SectionTitle>
            <p className="text-[13.5px] text-[var(--ink-2)]">{t("clients.sampleText")}</p>
            <Button variant="quiet" onClick={restoreSample} className="self-start">
              <RotateCcw size={15} aria-hidden /> {t("clients.restoreSample")}
            </Button>
          </div>
          <Callout>{t("clients.privacy")}</Callout>
        </aside>
      </div>
    </div>
  );
}
