/** The coach invite e-mail (a queued `portal-invite` job, like the payment kind but without a hold). Pure. */
import { INVITE_MAIL } from '../club/portal/copy-admin';
import { isRecord } from '../club/narrow';
import { brandHtml, buttonHtml, emailPage, escapeHtml, footerText, type EmailLinks, type RenderedEmail } from './registration-template';

export type PortalInvitePayload = { name: string; link: string; host: string };
export type NewPortalInviteJob = {
  recipient: string;
  subject: string;
  accountId: string;
  notBefore: null;
  payload: PortalInvitePayload;
};

export function isPortalInvitePayload(v: unknown): v is PortalInvitePayload {
  return isRecord(v) && typeof v.name === 'string' && typeof v.link === 'string' && v.link.length > 0 && typeof v.host === 'string' && v.host.length > 0;
}

/** The coach portal host: `antrenor.` + the site host (without `www.`); `antrenor.localhost:port` over http locally. */
export function portalHost(siteUrl: string): { host: string; origin: string } {
  const url = new URL(siteUrl);
  const local = url.hostname === 'localhost' || url.hostname.endsWith('.localhost');
  const host = `antrenor.${url.host.replace(/^www\./, '')}`;
  return { host, origin: `${local ? 'http' : 'https'}://${host}` };
}

export const inviteLink = (siteHost: string, secret: string, protocol: 'https' | 'http' = 'https'): string =>
  `${protocol}://${siteHost}/invite/${secret}`;

const paragraphHtml = (lines: string[]): string => `<p style="margin:0 0 14px;">${lines.map(escapeHtml).join('<br>')}</p>`;

export function renderPortalInvite(input: { payload: PortalInvitePayload; links: EmailLinks }): RenderedEmail {
  const { payload, links } = input;
  const before = [[INVITE_MAIL.greeting(payload.name)], [INVITE_MAIL.line(payload.host)]];
  const after = [[INVITE_MAIL.valid], [INVITE_MAIL.signature]];
  const button =
    '<table role="presentation" class="es-btns" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 22px;"><tr>' +
    buttonHtml(escapeHtml(INVITE_MAIL.button), payload.link, true) +
    '</tr></table>';
  const body = `<div style="margin:0 0 28px;">${brandHtml(links.headerImage)}</div>${before.map(paragraphHtml).join('')}${button}${after.map(paragraphHtml).join('')}`;
  return {
    subject: INVITE_MAIL.subject,
    html: emailPage(body, links),
    text: [...before.map((l) => l.join('\n')), `${INVITE_MAIL.button}: ${payload.link}`, ...after.map((l) => l.join('\n')), ...footerText(links)].join('\n\n') + '\n',
  };
}

export function portalInviteJob(i: { recipient: string; accountId: string; payload: PortalInvitePayload }, _now: Date): NewPortalInviteJob {
  return { recipient: i.recipient.trim().toLowerCase(), subject: INVITE_MAIL.subject, accountId: i.accountId, notBefore: null, payload: i.payload };
}
