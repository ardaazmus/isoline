"use client";

/**
 * Identity forms (AUTH-01..08) on Better Auth. Errors are shown in plain language; the password rule (12+ characters)
 * is stated before typing, not discovered after.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui";
import { api, authClient } from "./client";
import { Check, ErrorNote, Input, OkNote, SubmitButton } from "./ui";

type BaError = { code?: string; message?: string; status?: number } | null;
const codeOf = (e: BaError) => (e?.code ? e.code.toLowerCase() : e?.status === 429 ? "rate_limited" : "auth_failed");

export function LoginForm({ lang, next }: { lang: string; next: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const r = await authClient.signIn.email({ email, password });
        setBusy(false);
        if (r.error) return setError(codeOf(r.error));
        if ((r.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) return; // the 2FA plugin redirects
        router.push(next);
        router.refresh();
      }}
    >
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{t("pf.auth.login.title")}</h1>
      <Input label={t("pf.auth.email")} name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input label={t("pf.auth.password")} name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      <ErrorNote code={error} />
      {error === "email_not_verified" && <ResendVerification lang={lang} email={email} />}
      <SubmitButton busy={busy}>{t("pf.auth.login.submit")}</SubmitButton>
      <div className="flex flex-wrap justify-between gap-2 text-[13px]">
        <Link href={`/${lang}/auth/forgot-password`} className="text-[var(--b-700)]">
          {t("pf.auth.login.forgot")}
        </Link>
        <Link href={`/${lang}/auth/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-[var(--b-700)]">
          {t("pf.auth.login.toSignup")}
        </Link>
      </div>
    </form>
  );
}

function ResendVerification({ lang, email }: { lang: string; email: string }) {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);
  if (sent) return <OkNote>{t("pf.auth.verify.resent")}</OkNote>;
  return (
    <Button
      size="sm"
      onClick={async () => {
        await authClient.sendVerificationEmail({ email, callbackURL: `/${lang}/app` });
        setSent(true);
      }}
    >
      {t("pf.auth.verify.resend")}
    </Button>
  );
}

export function SignupForm({ lang, next }: { lang: string; next: string }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  if (done)
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{t("pf.auth.verify.title")}</h1>
        <p className="text-[14px] leading-relaxed text-[var(--ink-2)]">{t("pf.auth.verify.sent", { email })}</p>
        <ResendVerification lang={lang} email={email} />
      </div>
    );
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (password.length < 12) return setError("password_too_short");
        setBusy(true);
        setError(null);
        const r = await authClient.signUp.email({ name, email, password, callbackURL: next });
        setBusy(false);
        if (r.error) return setError(codeOf(r.error));
        setDone(true);
      }}
    >
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{t("pf.auth.signup.title")}</h1>
      <p className="-mt-2 text-[13.5px] text-[var(--ink-2)]">{t("pf.auth.signup.lead")}</p>
      <Input label={t("pf.auth.name")} name="name" autoComplete="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
      <Input label={t("pf.auth.email")} name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input label={t("pf.auth.password")} name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} hint={t("pf.auth.passwordRule")} value={password} onChange={(e) => setPassword(e.target.value)} />
      <Check id="terms" checked={terms} onChange={setTerms} label={t("pf.auth.signup.terms")} />
      <ErrorNote code={error} />
      <SubmitButton busy={busy} disabled={!terms}>
        {t("pf.auth.signup.submit")}
      </SubmitButton>
      <Link href={`/${lang}/auth/login`} className="text-[13px] text-[var(--b-700)]">
        {t("pf.auth.signup.toLogin")}
      </Link>
    </form>
  );
}

export function VerifyNotice({ lang }: { lang: string }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{t("pf.auth.verify.title")}</h1>
      <p className="text-[14px] leading-relaxed text-[var(--ink-2)]">{t("pf.auth.verify.lead")}</p>
      <Input label={t("pf.auth.email")} name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      {email && <ResendVerification lang={lang} email={email} />}
      <Link href={`/${lang}/auth/login`} className="text-[13px] text-[var(--b-700)]">
        {t("pf.auth.signup.toLogin")}
      </Link>
    </div>
  );
}

export function ForgotForm({ lang }: { lang: string }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        // the answer is the same whether or not the address exists (no account enumeration)
        await authClient.requestPasswordReset({ email, redirectTo: `/${lang}/auth/reset-password` });
        setBusy(false);
        setSent(true);
      }}
    >
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{t("pf.auth.forgot.title")}</h1>
      {sent ? (
        <OkNote>{t("pf.auth.forgot.sent")}</OkNote>
      ) : (
        <>
          <Input label={t("pf.auth.email")} name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <SubmitButton busy={busy}>{t("pf.auth.forgot.submit")}</SubmitButton>
        </>
      )}
      <Link href={`/${lang}/auth/login`} className="text-[13px] text-[var(--b-700)]">
        {t("pf.auth.signup.toLogin")}
      </Link>
    </form>
  );
}

export function ResetForm({ lang, token, linkError }: { lang: string; token: string | null; linkError: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(linkError ? "invalid_token" : token ? null : "invalid_token");
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!token) return;
        if (password.length < 12) return setError("password_too_short");
        setBusy(true);
        const r = await authClient.resetPassword({ newPassword: password, token });
        setBusy(false);
        if (r.error) return setError(codeOf(r.error));
        router.push(`/${lang}/auth/login?reset=1`);
      }}
    >
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{t("pf.auth.reset.title")}</h1>
      <Input label={t("pf.auth.newPassword")} name="password" type="password" autoComplete="new-password" required minLength={12} hint={t("pf.auth.passwordRule")} value={password} onChange={(e) => setPassword(e.target.value)} />
      <ErrorNote code={error} />
      <SubmitButton busy={busy} disabled={!token}>
        {t("pf.auth.reset.submit")}
      </SubmitButton>
    </form>
  );
}

export function MfaForm({ next }: { next: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [trust, setTrust] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const r = backup ? await authClient.twoFactor.verifyBackupCode({ code: code.trim(), trustDevice: trust }) : await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, ""), trustDevice: trust });
        setBusy(false);
        if (r.error) return setError(codeOf(r.error));
        router.push(next);
        router.refresh();
      }}
    >
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{t("pf.auth.mfa.title")}</h1>
      <p className="-mt-2 text-[13.5px] text-[var(--ink-2)]">{backup ? t("pf.auth.mfa.backupLead") : t("pf.auth.mfa.lead")}</p>
      <Input label={backup ? t("pf.auth.mfa.backupCode") : t("pf.auth.mfa.code")} name="code" inputMode={backup ? "text" : "numeric"} autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} />
      <Check id="trust" checked={trust} onChange={setTrust} label={t("pf.auth.mfa.trust")} />
      <ErrorNote code={error} />
      <SubmitButton busy={busy}>{t("pf.auth.mfa.submit")}</SubmitButton>
      <button type="button" className="text-left text-[13px] text-[var(--b-700)]" onClick={() => setBackup(!backup)}>
        {backup ? t("pf.auth.mfa.useApp") : t("pf.auth.mfa.useBackup")}
      </button>
    </form>
  );
}

export type InvitePreview = { tenantName: string; tenantKind: string; role: string; kind: string; email: string; state: "valid" | "expired" | "used" | "revoked" };

export function InviteView({ lang, token, preview, signedInAs }: { lang: string; token: string; preview: InvitePreview | null; signedInAs: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const here = `/${lang}/auth/invite/${encodeURIComponent(token)}`;
  if (!preview || preview.state !== "valid")
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{t("pf.invite.title")}</h1>
        <ErrorNote code={preview ? `invitation_${preview.state}` : "invitation_invalid"} />
      </div>
    );
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{t("pf.invite.title")}</h1>
      <p className="text-[14.5px] leading-relaxed">
        {preview.kind === "claim" ? t("pf.invite.claimLead", { tenant: preview.tenantName }) : t("pf.invite.memberLead", { tenant: preview.tenantName, role: t(`pf.role.${preview.role}`) })}
      </p>
      <p className="text-[13px] text-[var(--ink-3)]">{t("pf.invite.forEmail", { email: preview.email })}</p>
      {preview.kind === "claim" && <p className="rounded-[12px] bg-[var(--b-50)] px-3 py-2 text-[13px] leading-relaxed text-[var(--b-800)]">{t("pf.invite.claimNote")}</p>}
      <ErrorNote code={error} />
      {signedInAs ? (
        <>
          <p className="text-[13px] text-[var(--ink-2)]">{t("pf.invite.signedInAs", { email: signedInAs })}</p>
          <Button
            variant="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await api<{ tenantId: string }>("POST", "/api/v1/invitations/accept", { token });
              if (!r.ok) {
                setBusy(false);
                return setError(r.code);
              }
              await api("POST", "/api/v1/session/tenant", { tenantId: r.data.tenantId });
              router.push(`/${lang}/app/home`);
              router.refresh();
            }}
          >
            {t("pf.invite.accept")}
          </Button>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Link href={`/${lang}/auth/signup?next=${encodeURIComponent(here)}`} className="inline-flex h-10 items-center rounded-[12px] bg-[var(--b-600)] px-4 text-[14px] font-semibold text-white no-underline">
            {t("pf.invite.signup")}
          </Link>
          <Link href={`/${lang}/auth/login?next=${encodeURIComponent(here)}`} className="inline-flex h-10 items-center rounded-[12px] border border-[var(--rule)] px-4 text-[14px] font-semibold text-[var(--ink)] no-underline">
            {t("pf.invite.login")}
          </Link>
        </div>
      )}
    </div>
  );
}
