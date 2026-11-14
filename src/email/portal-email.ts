/** The coach invite e-mail (a queued `portal-invite` job, like the payment kind but without a hold). Pure. */
import { ACCESS_COPY, ACCESS_MAIL } from '../club/portal/access/copy';
import { INVITE_MAIL } from '../club/portal/copy-admin';
import { isRecord } from '../club/narrow';
import { brandHtml, buttonHtml, emailPage, escapeHtml, footerText, type EmailLinks, type RenderedEmail } from './registration-template';

/** `children`: the athletes the parent invite is for (a `sportiv.` host); absent on coach invites and on jobs queued before phase 7. */
/** `athleteIds`: the athlete ids of `children`, same order (the anonymize scrub matches by id); absent on jobs queued before. */
export type PortalInvitePayload = { name: string; link: string; host: string; children?: string[]; athleteIds?: string[] };
export type NewPortalInviteJob = {
  recipient: string;
  subject: string;
  accountId: string;
  notBefore: null;
  payload: PortalInvitePayload;
};

export function isPortalInvitePayload(v: unknown): v is PortalInvitePayload {
  return isRecord(v) && typeof v.name === 'string' && typeof v.link === 'string' && v.link.length > 0 && typeof v.host === 'string' && v.host.length > 0
    && (v.children === undefined || (Array.isArray(v.children) && v.children.every((c) => typeof c === 'string')))
    && (v.athleteIds === undefined || (Array.isArray(v.athleteIds) && v.athleteIds.every((c) => typeof c === 'string')));
}

/** The portal host of a site: `antrenor.` or `sportiv.` + the site host (without `www.`); `<site>.localhost:port` over http locally. */
export function portalHost(siteUrl: string, site: 'antrenor' | 'sportiv' = 'antrenor'): { host: string; origin: string } {
  const url = new URL(siteUrl);
  const local = url.hostname === 'localhost' || url.hostname.endsWith('.localhost');
  const host = `${site}.${url.host.replace(/^www\./, '')}`;
  return { host, origin: `${local ? 'http' : 'https'}://${host}` };
}

export const inviteLink = (siteHost: string, secret: string, protocol: 'https' | 'http' = 'https'): string =>
  `${protocol}://${siteHost}/invite/${secret}`;

const paragraphHtml = (lines: string[]): string => `<p style="margin:0 0 14px;">${lines.map(escapeHtml).join('<br>')}</p>`;

/** A link mail: paragraphs, one button, paragraphs. Shared by the invite and the access mail. */
export function renderLinkMail(input: { subject: string; before: string[][]; button: string; link: string; after: string[][]; links: EmailLinks }): RenderedEmail {
  const { subject, before, button, link, after, links } = input;
  const buttonRow =
    '<table role="presentation" class="es-btns" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 22px;"><tr>' +
    buttonHtml(escapeHtml(button), link, true) +
    '</tr></table>';
  const body = `<div style="margin:0 0 28px;">${brandHtml(links.headerImage)}</div>${before.map(paragraphHtml).join('')}${buttonRow}${after.map(paragraphHtml).join('')}`;
  return {
    subject,
    html: emailPage(body, links),
    text: [...before.map((l) => l.join('\n')), `${button}: ${link}`, ...after.map((l) => l.join('\n')), ...footerText(links)].join('\n\n') + '\n',
  };
}

/** A parent invite points to a `sportiv.` host (spec 11.1); anything else is the coach invite. */
export const isParentInvite = (payload: PortalInvitePayload): boolean => payload.host.startsWith('sportiv.');

export function renderPortalInvite(input: { payload: PortalInvitePayload; links: EmailLinks }): RenderedEmail {
  const { payload, links } = input;
  if (isParentInvite(payload)) {
    return renderLinkMail({
      subject: ACCESS_COPY.inviteSubject, before: [[ACCESS_MAIL.greeting(payload.name)], [ACCESS_MAIL.inviteLine(payload.children ?? [])]],
      button: ACCESS_COPY.enter, link: payload.link, after: [[ACCESS_COPY.validDays], [ACCESS_MAIL.signature]], links,
    });
  }
  return renderLinkMail({
    subject: INVITE_MAIL.subject, before: [[INVITE_MAIL.greeting(payload.name)], [INVITE_MAIL.line(payload.host)]],
    button: INVITE_MAIL.button, link: payload.link, after: [[INVITE_MAIL.valid], [INVITE_MAIL.signature]], links,
  });
}

export function portalInviteJob(i: { recipient: string; accountId: string; payload: PortalInvitePayload }, _now: Date): NewPortalInviteJob {
  return { recipient: i.recipient.trim().toLowerCase(), subject: isParentInvite(i.payload) ? ACCESS_COPY.inviteSubject : INVITE_MAIL.subject, accountId: i.accountId, notBefore: null, payload: i.payload };
}
