/**
 * Portal mails sent at once, outside the job queue: the reset code, the lockout notice and the
 * new-device notice. The letter follows the E1 layout of the payment e-mail (./payment-email.ts).
 */
import type { Core } from '@strapi/strapi';
import { MAIL_COPY } from '../club/portal/copy';
import { EMAIL_CHANGED_MAIL } from '../club/portal/copy-admin';
import { longDate } from '../club/presence/dates';
import { captureMessage } from '../sentry';
import { failureStatus, sendNow } from './brevo';
import { deliveryTarget, readEmailConfig } from './config';
import { buildEmailLinks } from './links';
import { brandHtml, emailPage, escapeHtml, footerText, type EmailLinks, type RenderedEmail } from './registration-template';

export type PortalMail =
  | { kind: 'reset'; code: string }
  | { kind: 'lockout' }
  | { kind: 'new-device'; device: string; at: Date }
  | { kind: 'email-changed'; newEmail: string };

export type SendPortalMail = (to: string, mail: PortalMail) => Promise<boolean>;

const SITE_UID = 'api::site-settings.site-settings' as const;
const BUCHAREST = 'Europe/Bucharest';
const dayPart = new Intl.DateTimeFormat('en-CA', { timeZone: BUCHAREST, year: 'numeric', month: '2-digit', day: '2-digit' });
const timePart = new Intl.DateTimeFormat('ro-RO', { timeZone: BUCHAREST, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

function letter(mail: PortalMail): { subject: string; paragraphs: string[][] } {
  const signature = [MAIL_COPY.signature];
  if (mail.kind === 'reset') {
    return {
      subject: MAIL_COPY.reset.subject,
      paragraphs: [[MAIL_COPY.reset.code(mail.code)], [MAIL_COPY.reset.valid], [MAIL_COPY.reset.ignore], signature],
    };
  }
  if (mail.kind === 'lockout') {
    return { subject: MAIL_COPY.lockout.subject, paragraphs: [[MAIL_COPY.lockout.text], [MAIL_COPY.lockout.advice], signature] };
  }
  if (mail.kind === 'email-changed') {
    return { subject: EMAIL_CHANGED_MAIL.subject, paragraphs: [[EMAIL_CHANGED_MAIL.line(mail.newEmail)], [EMAIL_CHANGED_MAIL.advice], signature] };
  }
  const line = MAIL_COPY.newDevice.line(mail.device, longDate(dayPart.format(mail.at)), timePart.format(mail.at));
  return { subject: MAIL_COPY.newDevice.subject, paragraphs: [[line], [MAIL_COPY.newDevice.advice], signature] };
}

export const paragraphHtml = (lines: string[]): string => `<p style="margin:0 0 14px;">${lines.map(escapeHtml).join('<br>')}</p>`;

/** Layout E1: brand header, one paragraph per line group, footer. */
export function renderLetter(subject: string, paragraphs: string[][], links: EmailLinks): RenderedEmail {
  const body = `<div style="margin:0 0 28px;">${brandHtml(links.headerImage)}</div>${paragraphs.map(paragraphHtml).join('')}`;
  return {
    subject,
    html: emailPage(body, links),
    text: [...paragraphs.map((lines) => lines.join('\n')), ...footerText(links)].join('\n\n') + '\n',
  };
}

export function renderPortalMail(mail: PortalMail, links: EmailLinks): RenderedEmail {
  const { subject, paragraphs } = letter(mail);
  return renderLetter(subject, paragraphs, links);
}

function failed(strapi: Core.Strapi, kind: string, why: string): false {
  const message = `[portal-mail] ${kind} not sent: ${why}`;
  strapi.log.error(message);
  captureMessage(message);
  return false;
}

/** The send path every direct mail shares: test-address routing, config check, E1 render, one retry in `sendNow`. */
export function directMailSender<M extends { kind: string }>(
  strapi: Core.Strapi,
  render: (mail: M, links: EmailLinks) => RenderedEmail,
): (to: string, mail: M) => Promise<boolean> {
  return async (to, mail) => {
    const config = readEmailConfig();
    const target = deliveryTarget(config, to);
    if (target.ok === false) return failed(strapi, mail.kind, target.reason);
    if (!config.apiKey || !config.sender) return failed(strapi, mail.kind, 'not configured');
    const contact = (await strapi.documents(SITE_UID).findFirst({}))?.contact;
    const rendered = render(mail, buildEmailLinks(config, contact));
    const result = await sendNow(
      { to: target.to, subject: rendered.subject, html: rendered.html, text: rendered.text, attachments: [] },
      { apiKey: config.apiKey, sender: config.sender, replyTo: config.replyTo },
    );
    if (result.ok === true) return true;
    return failed(strapi, mail.kind, failureStatus(result.error));
  };
}

export const portalMailSender = (strapi: Core.Strapi): SendPortalMail => directMailSender(strapi, renderPortalMail);
