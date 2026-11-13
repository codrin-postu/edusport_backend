/** The "you also have access" e-mail (a queued `portal-access` job): a parent gets a child added, a parent account gets the coach role. Pure. */
import { ACCESS_COPY, ACCESS_MAIL } from '../club/portal/access/copy';
import { isRecord } from '../club/narrow';
import { renderLinkMail } from './portal-email';
import type { EmailLinks, RenderedEmail } from './registration-template';

export type PortalAccessPayload = { name: string; variant: 'child' | 'coach'; childName: string | null; link: string; host: string; athleteIds?: string[] };
export type NewPortalAccessJob = {
  recipient: string;
  subject: string;
  accountId: string;
  notBefore: null;
  payload: PortalAccessPayload;
};

export function isPortalAccessPayload(v: unknown): v is PortalAccessPayload {
  return isRecord(v) && typeof v.name === 'string' && (v.variant === 'child' || v.variant === 'coach') && typeof v.link === 'string' && v.link.length > 0
    && typeof v.host === 'string' && v.host.length > 0 && (v.childName === null || typeof v.childName === 'string') && (v.variant === 'coach' || typeof v.childName === 'string')
    && (v.athleteIds === undefined || (Array.isArray(v.athleteIds) && v.athleteIds.every((c) => typeof c === 'string')));
}

export function renderPortalAccess(input: { payload: PortalAccessPayload; links: EmailLinks }): RenderedEmail {
  const { payload, links } = input;
  const line = payload.variant === 'coach' ? ACCESS_MAIL.coachLine(payload.host) : ACCESS_MAIL.childLine(payload.childName ?? '');
  return renderLinkMail({
    subject: ACCESS_COPY.accessSubject, before: [[ACCESS_MAIL.greeting(payload.name)], [line]], button: ACCESS_COPY.enter, link: payload.link,
    after: [[ACCESS_MAIL.signature]], links,
  });
}

export function portalAccessJob(i: { recipient: string; accountId: string; payload: PortalAccessPayload }): NewPortalAccessJob {
  return { recipient: i.recipient.trim().toLowerCase(), subject: ACCESS_COPY.accessSubject, accountId: i.accountId, notBefore: null, payload: i.payload };
}
