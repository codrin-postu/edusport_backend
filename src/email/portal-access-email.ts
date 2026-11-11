/** The "you also have access" e-mail (a queued `portal-access` job): a parent gets a child added, a parent account gets the coach role. */
import { ACCESS_COPY } from '../club/portal/access/copy';

export type PortalAccessPayload = { name: string; variant: 'child' | 'coach'; childName: string | null; link: string; host: string };
export type NewPortalAccessJob = {
  recipient: string;
  subject: string;
  accountId: string;
  notBefore: null;
  payload: PortalAccessPayload;
};

export function portalAccessJob(i: { recipient: string; accountId: string; payload: PortalAccessPayload }): NewPortalAccessJob {
  return { recipient: i.recipient.trim().toLowerCase(), subject: ACCESS_COPY.accessSubject, accountId: i.accountId, notBefore: null, payload: i.payload };
}
