"use client";

/** Platform forms for G1 screens. Each one posts to /api/v1 and refreshes the server-rendered page on success. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Building2, Copy, Download, FileUp, Handshake, ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui";
import { api, authClient } from "./client";
import { Badge, Check, ErrorNote, Input, OkNote, Select, SubmitButton, useSubmit } from "./ui";

const TERMS = "terms-2026-10";
const GRANT_TERMS = "grant-2026-10";

/**
 * AUTH-09 workspace choice. With a single workspace there is nothing to choose: it is opened at once (the cookie is
 * still set through the same checked endpoint, so membership and the MFA rule apply as for a click).
 */
export function ChooseWorkspace({ lang, memberships, next, auto = true }: { lang: string; memberships: { tenantId: string; tenantName: string; kind: string; role: string; lifecycle: string; sample: boolean }[]; next?: string; auto?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const only = auto && memberships.length === 1 ? memberships[0].tenantId : null;
  const tried = useRef(false);
  const open = async (tenantId: string) => {
    setBusy(tenantId);
    const r = await api("POST", "/api/v1/session/tenant", { tenantId });
    setBusy(null);
    if (!r.ok) return r.code === "mfa_required" ? router.push(`/${lang}/app/account/security?reason=mfa_required`) : setError(r.code);
    router.push(next ?? `/${lang}/app/home`);
    router.refresh();
  };
  useEffect(() => {
    if (!only || tried.current) return;
    tried.current = true;
    void open(only);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once for the single workspace
  }, [only]);
  if (only && !error) return <p className="glass p-6 text-[14px] text-[var(--ink-2)]" role="status">{t("pf.choose.opening")}</p>;
  return (
    <div className="flex flex-col gap-3">
      <ErrorNote code={error} />
      <ul className="grid gap-3 md:grid-cols-2">
        {memberships.map((m) => (
          <li key={m.tenantId}>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void open(m.tenantId)}
              className="glass flex w-full items-start gap-3 p-5 text-left transition-shadow hover:shadow-[0_12px_30px_-18px_rgba(31,52,160,0.6)] disabled:opacity-60"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[var(--b-50)] text-[var(--b-700)]">{m.kind === "advisory" ? <Handshake size={18} aria-hidden /> : <Building2 size={18} aria-hidden />}</span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-[15px] font-semibold">{m.tenantName}</span>
                <span className="text-[13px] text-[var(--ink-2)]">
                  {t(`pf.kind.${m.kind}`)} · {t(`pf.role.${m.role}`)}
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {m.sample && <Badge tone="warn">{t("shell.sample")}</Badge>}
                  {m.lifecycle !== "active" && <Badge tone="warn">{t(`pf.lifecycle.${m.lifecycle}`)}</Badge>}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Link href={`/${lang}/app/onboarding`} className="on-ground text-[13.5px] font-medium text-[var(--b-700)] underline">
        {t("pf.choose.newWorkspace")}
      </Link>
    </div>
  );
}

export function OnboardingForm({ lang }: { lang: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [kind, setKind] = useState<"company" | "advisory">("company");
  const [name, setName] = useState("");
  const [terms, setTerms] = useState(false);
  const s = useSubmit(
    async () => {
      const r = await api<{ tenantId: string }>("POST", "/api/v1/tenants", { name, kind, acceptTerms: true, termsVersion: TERMS });
      if (r.ok) await api("POST", "/api/v1/session/tenant", { tenantId: r.data.tenantId });
      return r;
    },
    () => {
      router.push(`/${lang}/app/home`);
      router.refresh();
    },
  );
  return (
    <form onSubmit={s.submit} className="flex flex-col gap-5">
      <fieldset className="grid gap-3 md:grid-cols-2">
        <legend className="mb-2 text-[14px] font-semibold">{t("pf.onboarding.kindQuestion")}</legend>
        {(["company", "advisory"] as const).map((k) => (
          <label key={k} className={`glass flex cursor-pointer items-start gap-3 p-5 ${kind === k ? "outline outline-2 outline-[var(--b-500)]" : ""}`}>
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="mt-1 accent-[var(--b-600)]" />
            <span className="flex flex-col gap-1">
              <span className="text-[15px] font-semibold">{t(`pf.onboarding.${k}.title`)}</span>
              <span className="text-[13px] leading-snug text-[var(--ink-2)]">{t(`pf.onboarding.${k}.lead`)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <Input label={kind === "company" ? t("pf.onboarding.companyName") : t("pf.onboarding.advisoryName")} name="name" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
      <Check id="ws-terms" checked={terms} onChange={setTerms} label={t("pf.onboarding.terms")} />
      <ErrorNote code={s.error} />
      <div>
        <SubmitButton busy={s.busy} disabled={!terms || !name.trim()}>
          {t("pf.onboarding.submit")}
        </SubmitButton>
      </div>
    </form>
  );
}

export type EvidenceRow = { id: string; filename: string; mime: string; size_bytes: number; sha256: string; classification: string; scan_status: string; uploaded_at: string | Date; uploaded_by_name: string | null };

export function EvidencePanel({ projectId, items, canUpload, canDownload }: { projectId: string; items: EvidenceRow[]; canUpload: boolean; canDownload: boolean }) {
  const { t, fmt } = useI18n();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [cls, setCls] = useState("internal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const tone = (s: string) => (s === "available" ? "ok" : s === "quarantined" || s === "rejected" ? "crit" : "warn");
  return (
    <div className="flex flex-col gap-4">
      {canUpload && (
        <form
          className="flex flex-col gap-3 md:flex-row md:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            const file = input.current?.files?.[0];
            if (!file) return setError("file_required");
            setBusy(true);
            setError(null);
            const f = new FormData();
            f.set("file", file);
            f.set("classification", cls);
            const r = await api<{ duplicate: boolean }>("POST", `/api/v1/projects/${projectId}/evidence`, undefined, { form: f });
            setBusy(false);
            if (!r.ok) return setError(r.code);
            setNotice(r.data.duplicate ? t("pf.evidence.duplicate") : t("pf.evidence.queued"));
            if (input.current) input.current.value = "";
            router.refresh();
          }}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor="ev-file" className="text-[13px] font-medium text-[var(--ink-2)]">
              {t("pf.evidence.file")}
            </label>
            <input id="ev-file" ref={input} type="file" className="field-input" accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.docx,.csv,.txt,.json,.xml,.zip" />
            <p className="text-[12px] text-[var(--ink-3)]">{t("pf.evidence.rule")}</p>
          </div>
          <div className="md:w-[200px]">
            <Select label={t("pf.evidence.classification")} name="ev-class" value={cls} onChange={(e) => setCls(e.target.value)} options={["internal", "confidential", "personal", "public"].map((c) => ({ value: c, label: t(`pf.evidence.class.${c}`) }))} />
          </div>
          <Button type="submit" variant="primary" disabled={busy}>
            <FileUp size={15} aria-hidden />
            {busy ? t("pf.common.working") : t("pf.evidence.upload")}
          </Button>
        </form>
      )}
      <ErrorNote code={error} />
      {notice && <OkNote>{notice}</OkNote>}
      {items.length === 0 ? (
        <p className="text-[13.5px] text-[var(--ink-3)]">{t("pf.evidence.empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--rule)]">
          {items.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">{e.filename}</span>
                <span className="block text-[12px] text-[var(--ink-3)]">
                  {fmt.number(e.size_bytes / 1024, 0)} KB · {e.uploaded_by_name ?? "—"} · {fmt.date(new Date(e.uploaded_at).toISOString())} · SHA-256 {e.sha256.slice(0, 12)}…
                </span>
              </span>
              <Badge>{t(`pf.evidence.class.${e.classification}`)}</Badge>
              <Badge tone={tone(e.scan_status)}>{t(`pf.evidence.status.${e.scan_status}`)}</Badge>
              {canDownload && e.scan_status === "available" && (
                <a href={`/api/v1/evidence/${e.id}/download`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--b-700)]">
                  <Download size={14} aria-hidden />
                  {t("pf.evidence.download")}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RevokeButton({ path, label, confirmText }: { path: string; label: string; confirmText: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        size="sm"
        disabled={busy}
        onClick={async () => {
          if (!window.confirm(confirmText)) return;
          setBusy(true);
          const r = await api("DELETE", path);
          setBusy(false);
          if (!r.ok) return setError(r.code);
          router.refresh();
        }}
      >
        {label}
      </Button>
      <ErrorNote code={error} />
    </span>
  );
}

export function GrantForm({ projects }: { projects: { id: string; name: string }[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [recipient, setRecipient] = useState("");
  const [role, setRole] = useState("preparer");
  const [purpose, setPurpose] = useState("");
  const [days, setDays] = useState(90);
  const [download, setDownload] = useState(false);
  const [terms, setTerms] = useState(false);
  const s = useSubmit(
    () => api("POST", `/api/v1/projects/${projectId}/grants`, { recipientTenantId: recipient.trim(), role, purpose, days, canDownload: download, acceptTerms: true, termsVersion: GRANT_TERMS }),
    () => {
      setRecipient("");
      setPurpose("");
      setTerms(false);
      router.refresh();
    },
  );
  if (!projects.length) return <p className="text-[13.5px] text-[var(--ink-3)]">{t("pf.grants.noProjects")}</p>;
  return (
    <form onSubmit={s.submit} className="grid gap-4 md:grid-cols-2">
      <Select label={t("pf.grants.project")} name="g-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} options={projects.map((p) => ({ value: p.id, label: p.name }))} />
      <Input label={t("pf.grants.recipient")} name="g-recipient" required value={recipient} onChange={(e) => setRecipient(e.target.value)} hint={t("pf.grants.recipientHint")} />
      <Select label={t("pf.grants.role")} name="g-role" value={role} onChange={(e) => setRole(e.target.value)} options={["preparer", "methodology", "reviewer", "design", "assurance", "supplier"].map((r) => ({ value: r, label: t(`pf.grantRole.${r}`) }))} hint={t(`pf.grantRoleHint.${role}`)} />
      <Input label={t("pf.grants.days")} name="g-days" type="number" min={1} max={365} required value={days} onChange={(e) => setDays(Number(e.target.value))} />
      <div className="md:col-span-2">
        <Input label={t("pf.grants.purpose")} name="g-purpose" required minLength={3} maxLength={500} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2 md:col-span-2">
        <Check id="g-download" checked={download} onChange={setDownload} label={t("pf.grants.canDownload")} />
        <Check id="g-terms" checked={terms} onChange={setTerms} label={t("pf.grants.consent")} />
      </div>
      <div className="flex flex-col gap-2 md:col-span-2">
        <ErrorNote code={s.error} />
        <div>
          <SubmitButton busy={s.busy} disabled={!terms || !recipient.trim() || purpose.trim().length < 3}>
            {t("pf.grants.submit")}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

export function CopyCode({ value, label }: { value: string; label: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[13px] text-[var(--ink-2)]">{label}</span>
      <code className="rounded-md bg-[var(--b-50)] px-2 py-1 text-[12.5px]">{value}</code>
      <Button
        size="sm"
        variant="ghost"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        }}
      >
        <Copy size={14} aria-hidden />
        {copied ? t("pf.common.copied") : t("pf.common.copy")}
      </Button>
    </div>
  );
}

export function ProvisionalClientForm({ lang }: { lang: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const s = useSubmit(
    () => api<{ tenantId: string }>("POST", "/api/v1/clients", { name, contactEmail: email }),
    () => router.push(`/${lang}/app/home?client=created`),
  );
  return (
    <form onSubmit={s.submit} className="flex flex-col gap-4">
      <Input label={t("pf.clients.name")} name="c-name" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
      <Input label={t("pf.clients.contact")} name="c-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} hint={t("pf.clients.contactHint")} />
      <ErrorNote code={s.error} />
      <div>
        <SubmitButton busy={s.busy} disabled={!name.trim() || !email.trim()}>
          {t("pf.clients.submit")}
        </SubmitButton>
      </div>
    </form>
  );
}

export function InviteForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("contributor");
  const [sent, setSent] = useState<string | null>(null);
  const s = useSubmit(
    () => api("POST", "/api/v1/invitations", { email, role }),
    () => {
      setSent(email);
      setEmail("");
      router.refresh();
    },
  );
  return (
    <form onSubmit={s.submit} className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-[1fr_240px_auto] md:items-end">
        <Input label={t("pf.members.email")} name="inv-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Select label={t("pf.members.role")} name="inv-role" value={role} onChange={(e) => setRole(e.target.value)} options={["admin", "project_lead", "data_owner", "contributor", "report_editor", "management_signer", "viewer", "preparer", "reviewer"].map((r) => ({ value: r, label: t(`pf.role.${r}`) }))} />
        <SubmitButton busy={s.busy} disabled={!email.trim()}>
          {t("pf.members.invite")}
        </SubmitButton>
      </div>
      <p className="text-[12.5px] text-[var(--ink-3)]">{t(`pf.roleHint.${role}`)}</p>
      <ErrorNote code={s.error} />
      {sent && <OkNote>{t("pf.members.sent", { email: sent })}</OkNote>}
    </form>
  );
}

export function TenantSettingsForm({ name: initialName, requireMfa: initialMfa, etag }: { name: string; requireMfa: boolean; etag: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [mfa, setMfa] = useState(initialMfa);
  const [saved, setSaved] = useState(false);
  const s = useSubmit(
    () => api("PATCH", "/api/v1/tenant", { name, requireMfa: mfa }, { ifMatch: etag }),
    () => {
      setSaved(true);
      router.refresh();
    },
  );
  return (
    <form onSubmit={s.submit} className="flex flex-col gap-4">
      <Input label={t("pf.security.name")} name="t-name" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
      <Check id="t-mfa" checked={mfa} onChange={setMfa} label={t("pf.security.requireMfa")} />
      <p className="-mt-2 text-[12.5px] text-[var(--ink-3)]">{t("pf.security.requireMfaHint")}</p>
      <ErrorNote code={s.error} />
      {saved && !s.error && <OkNote>{t("pf.common.saved")}</OkNote>}
      <div>
        <SubmitButton busy={s.busy}>{t("pf.common.save")}</SubmitButton>
      </div>
    </form>
  );
}

type SessionRow = { id: string; token: string; createdAt: string | Date; expiresAt: string | Date; userAgent?: string | null; ipAddress?: string | null };

export function AccountSecurity({ twoFactorEnabled, reason, sessions, currentSessionId }: { twoFactorEnabled: boolean; reason: string | null; sessions: SessionRow[]; currentSessionId: string }) {
  const { t, fmt } = useI18n();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [uri, setUri] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(twoFactorEnabled);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [pwDone, setPwDone] = useState(false);
  // sessions come from the server render; after a change the page is rendered again
  const loadSessions = () => router.refresh();
  useEffect(() => {
    if (uri) void QRCode.toDataURL(uri, { margin: 1, width: 184 }).then(setQr);
  }, [uri]);

  const secret = uri ? new URL(uri).searchParams.get("secret") : null;

  return (
    <div className="flex flex-col gap-6">
      {reason === "mfa_required" && !enabled && <ErrorNote code="mfa_required" />}
      <section className="glass flex flex-col gap-4 p-5 md:p-6" aria-labelledby="mfa-h">
        <h2 id="mfa-h" className="flex items-center gap-2 text-[17px] font-semibold">
          <ShieldCheck size={18} aria-hidden className="text-[var(--b-600)]" />
          {t("pf.account.mfaTitle")}
          {enabled ? <Badge tone="ok">{t("pf.account.on")}</Badge> : <Badge tone="warn">{t("pf.account.off")}</Badge>}
        </h2>
        <p className="text-[13.5px] leading-relaxed text-[var(--ink-2)]">{t("pf.account.mfaLead")}</p>
        {!enabled && !uri && (
          <form
            className="flex flex-col gap-3 md:flex-row md:items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              const r = await authClient.twoFactor.enable({ password });
              setBusy(false);
              if (r.error) return setError(r.error.code?.toLowerCase() ?? "auth_failed");
              const d = r.data && "totpURI" in r.data ? r.data : null;
              setUri(d?.totpURI ?? null);
              setCodes(d?.backupCodes ?? []);
              setPassword("");
            }}
          >
            <div className="flex-1">
              <Input label={t("pf.auth.password")} name="mfa-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <SubmitButton busy={busy}>{t("pf.account.start")}</SubmitButton>
          </form>
        )}
        {uri && !enabled && (
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              const r = await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, "") });
              setBusy(false);
              if (r.error) return setError(r.error.code?.toLowerCase() ?? "auth_failed");
              setEnabled(true);
              setUri(null);
              router.refresh();
            }}
          >
            <div className="flex flex-wrap items-start gap-5">
              {/* a data: URL drawn in the browser; next/image adds nothing for it */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {qr && <img src={qr} alt={t("pf.account.qrAlt")} width={184} height={184} className="rounded-[12px] border border-[var(--rule)] bg-white p-1" />}
              <div className="flex min-w-0 flex-1 flex-col gap-2 text-[13px]">
                <p>{t("pf.account.scan")}</p>
                {secret && (
                  <p className="break-all">
                    {t("pf.account.manual")} <code className="rounded bg-[var(--b-50)] px-1.5 py-0.5">{secret}</code>
                  </p>
                )}
                <p className="font-semibold">{t("pf.account.backupCodes")}</p>
                <ul className="grid grid-cols-2 gap-1 font-mono text-[12.5px]">
                  {codes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <p className="text-[var(--ink-3)]">{t("pf.account.backupHint")}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="flex-1">
                <Input label={t("pf.auth.mfa.code")} name="mfa-code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <SubmitButton busy={busy}>{t("pf.account.confirm")}</SubmitButton>
            </div>
          </form>
        )}
        <ErrorNote code={error} />
      </section>

      <section className="glass flex flex-col gap-4 p-5 md:p-6" aria-labelledby="pw-h">
        <h2 id="pw-h" className="text-[17px] font-semibold">
          {t("pf.account.passwordTitle")}
        </h2>
        <form
          className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pw.next.length < 12) return setError("password_too_short");
            setBusy(true);
            const r = await authClient.changePassword({ currentPassword: pw.current, newPassword: pw.next, revokeOtherSessions: true });
            setBusy(false);
            if (r.error) return setError(r.error.code?.toLowerCase() ?? "auth_failed");
            setPw({ current: "", next: "" });
            setPwDone(true);
            void loadSessions();
          }}
        >
          <Input label={t("pf.account.currentPassword")} name="pw-current" type="password" autoComplete="current-password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          <Input label={t("pf.auth.newPassword")} name="pw-next" type="password" autoComplete="new-password" required minLength={12} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          <SubmitButton busy={busy}>{t("pf.common.save")}</SubmitButton>
        </form>
        {pwDone && <OkNote>{t("pf.account.passwordChanged")}</OkNote>}
      </section>

      <section className="glass flex flex-col gap-4 p-5 md:p-6" aria-labelledby="sess-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="sess-h" className="text-[17px] font-semibold">
            {t("pf.account.sessionsTitle")}
          </h2>
          <Button
            size="sm"
            onClick={async () => {
              await authClient.revokeOtherSessions();
              void loadSessions();
            }}
          >
            {t("pf.account.revokeOthers")}
          </Button>
        </div>
        <ul className="flex flex-col divide-y divide-[var(--rule)]">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5 text-[13px]">
              <span className="min-w-0 flex-1 truncate" title={s.userAgent ?? ""}>
                {s.userAgent ? s.userAgent.slice(0, 80) : t("pf.account.unknownDevice")}
              </span>
              <span className="text-[var(--ink-3)]">{fmt.date(new Date(s.createdAt).toISOString())}</span>
              {s.id === currentSessionId ? (
                <Badge tone="info">{t("pf.account.thisSession")}</Badge>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await authClient.revokeSession({ token: s.token });
                    void loadSessions();
                  }}
                >
                  {t("pf.account.revoke")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
