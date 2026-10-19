/**
 * Outgoing mail (ADR-006): SMTP through nodemailer. Development points at Mailpit; production at the
 * organisation's SMTP server. Mails are short, Turkish first with an English line, and never carry evidence.
 */
import nodemailer, { type Transporter } from "nodemailer";

let transport: Transporter | null = null;

function smtp(): Transporter {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.EMAIL_SMTP_HOST ?? "127.0.0.1",
      port: Number(process.env.EMAIL_SMTP_PORT ?? 1025),
      secure: process.env.EMAIL_SMTP_SECURE === "true",
      auth: process.env.EMAIL_SMTP_USER ? { user: process.env.EMAIL_SMTP_USER, pass: process.env.EMAIL_SMTP_PASSWORD } : undefined,
    });
  }
  return transport;
}

export type Mail = { to: string; subject: string; text: string };

export async function sendMail(m: Mail): Promise<void> {
  await smtp().sendMail({ from: process.env.EMAIL_FROM ?? "Isoline <no-reply@isoline.local>", to: m.to, subject: m.subject, text: m.text });
}

const escapeLine = (s: string) => s.replace(/[\r\n]+/g, " ").slice(0, 200);

export const MAIL = {
  verification: (url: string): Omit<Mail, "to"> => ({
    subject: "Isoline: e-posta adresinizi doğrulayın",
    text: `Hesabınızı etkinleştirmek için bağlantıyı açın (24 saat geçerli):\n${url}\n\nVerify your e-mail address with the link above.`,
  }),
  reset: (url: string): Omit<Mail, "to"> => ({
    subject: "Isoline: şifre sıfırlama",
    text: `Şifrenizi sıfırlamak için bağlantıyı açın (30 dakika geçerli, tek kullanımlık):\n${url}\n\nBu isteği siz yapmadıysanız e-postayı yok sayın.`,
  }),
  invitation: (tenant: string, role: string, url: string): Omit<Mail, "to"> => ({
    subject: `Isoline: ${escapeLine(tenant)} sizi davet etti`,
    text: `${escapeLine(tenant)} çalışma alanına "${role}" rolüyle davet edildiniz. Bağlantı 7 gün geçerli ve tek kullanımlık:\n${url}\n\nYou have been invited to an Isoline workspace.`,
  }),
  claim: (tenant: string, url: string): Omit<Mail, "to"> => ({
    subject: `Isoline: ${escapeLine(tenant)} çalışma alanının sahipliği`,
    text: `Danışmanlık firmanız ${escapeLine(tenant)} için bir çalışma alanı hazırladı. Verilerin sahibi sizsiniz; alanı sahiplenmek için bağlantıyı açın (30 gün geçerli):\n${url}\n\nSahiplenene kadar rapor yayımlanamaz.`,
  }),
  grant: (owner: string, project: string, role: string): Omit<Mail, "to"> => ({
    subject: `Isoline: ${escapeLine(owner)} bir projeye erişim açtı`,
    text: `${escapeLine(owner)}, "${escapeLine(project)}" projesine "${role}" rolüyle süreli erişim verdi. Portföyünüzde görünür.`,
  }),
};
