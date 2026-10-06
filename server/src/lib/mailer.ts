import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';

let transporter: Transporter | null = null;

export const mailEnabled = () => Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);

const getTransporter = () => {
  transporter ??= nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });
  return transporter;
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** Branded, simple HTML email. Sends one message with recipients in BCC. Never throws. */
export const sendMail = async (opts: {
  bcc: string[];
  subject: string;
  heading: string;
  body?: string;
  actionUrl?: string;
  actionLabel?: string;
}) => {
  if (!mailEnabled() || !opts.bcc.length) return { sent: false };
  const html = `
  <div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#f8fafc;padding:24px">
    <div style="max-width:520px;margin:auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
      <div style="background:linear-gradient(135deg,#10b981,#0d9488);padding:20px 24px;color:#fff;font-weight:700;font-size:18px">ClassHub</div>
      <div style="padding:24px">
        <h2 style="margin:0 0 12px;color:#0f172a;font-size:18px">${escapeHtml(opts.heading)}</h2>
        ${opts.body ? `<p style="margin:0 0 20px;color:#475569;line-height:1.6;white-space:pre-line">${escapeHtml(opts.body)}</p>` : ''}
        ${
          opts.actionUrl
            ? `<a href="${opts.actionUrl}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600">${escapeHtml(opts.actionLabel ?? 'Open ClassHub')}</a>`
            : ''
        }
      </div>
    </div>
  </div>`;
  try {
    await getTransporter().sendMail({
      from: env.smtp.from || env.smtp.user,
      to: env.smtp.from || env.smtp.user,
      bcc: opts.bcc,
      subject: opts.subject,
      text: `${opts.heading}\n\n${opts.body ?? ''}\n\n${opts.actionUrl ?? ''}`,
      html,
    });
    return { sent: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Email failed:', (err as Error).message);
    return { sent: false };
  }
};
